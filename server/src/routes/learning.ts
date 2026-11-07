import { Hono } from 'hono';
import type { z } from 'zod';
import {
  AddTreeRequestSchema,
  CreateCourseRequestSchema,
  ExperienceEventRequestSchema,
  IntakeReplyRequestSchema,
  StartFromDiscoveredRequestSchema,
  StartIntakeRequestSchema,
  UpdateCompanionRequestSchema,
} from '../../../src/contracts';
import { renameCompanion, rerollCompanion } from '../services/companion';
import { listDiscoverable, startFromDiscovered } from '../services/discovery';
import { addSkillTree } from '../services/trees';
import { GenerationError } from '../ai/claude';
import { aiEnabled } from '../env';
import type { AppEnv } from '../app';
import { requireLearner } from '../auth';
import { getOrGenerateExperience, NodeLockedError } from '../services/experiences';
import { getIntake, readyContext, replyIntake, startIntake } from '../services/intake';
import { createCourseFromIntake } from '../services/planning';
import { courseList, courseView, experienceView, recordEvent } from '../services/progress';
import * as repo from '../services/repo';

/** All learner-scoped routes. Request bodies are validated with the shared contracts. */
export const learning = new Hono<AppEnv>();
learning.use('*', requireLearner);

async function body<S extends z.ZodType>(c: { req: { json: () => Promise<unknown> } }, schema: S): Promise<z.infer<S>> {
  const raw = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new BadRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return parsed.data;
}

export class BadRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}

function requireAi() {
  if (!aiEnabled) throw new GenerationError('disabled', 'AI generation is disabled on this server');
}

// ---- intake ----
learning.post('/intakes', async (c) => {
  requireAi();
  const req = await body(c, StartIntakeRequestSchema);
  return c.json(await startIntake(c.get('learner').id, req.goal, req.courseId), 201);
});
learning.get('/intakes/:id', (c) => c.json(getIntake(c.get('learner').id, c.req.param('id'))));
learning.post('/intakes/:id/reply', async (c) => {
  requireAi();
  const req = await body(c, IntakeReplyRequestSchema);
  return c.json(await replyIntake(c.get('learner').id, c.req.param('id'), req.answer));
});

// ---- courses ----
learning.get('/courses', (c) => c.json(courseList(c.get('learner').id)));
learning.post('/courses', async (c) => {
  requireAi();
  const req = await body(c, CreateCourseRequestSchema);
  const course = await createCourseFromIntake(c.get('learner').id, req.intakeId);
  return c.json(courseView(c.get('learner').id, course.id), 201);
});
learning.get('/courses/:id', (c) => c.json(courseView(c.get('learner').id, c.req.param('id'))));

learning.patch('/courses/:id/companion', async (c) => {
  const learnerId = c.get('learner').id;
  const req = await body(c, UpdateCompanionRequestSchema);
  if (req.action === 'rename') renameCompanion(learnerId, c.req.param('id'), req.name);
  else {
    requireAi();
    await rerollCompanion(learnerId, c.req.param('id'));
  }
  return c.json(courseView(learnerId, c.req.param('id')));
});

learning.post('/courses/:id/trees', async (c) => {
  requireAi();
  const learnerId = c.get('learner').id;
  const req = await body(c, AddTreeRequestSchema);
  if (req.kind === 'continue') await addSkillTree(learnerId, c.req.param('id'), { kind: 'continue' });
  else {
    const { context } = readyContext(learnerId, req.intakeId);
    await addSkillTree(learnerId, c.req.param('id'), { kind: 'explore', context });
  }
  return c.json(courseView(learnerId, c.req.param('id')), 201);
});

// ---- discovery ----
learning.get('/discover', (c) => c.json({ courses: listDiscoverable(c.get('learner').id) }));
learning.post('/discover/:id/start', async (c) => {
  const learnerId = c.get('learner').id;
  const req = await body(c, StartFromDiscoveredRequestSchema);
  const course = startFromDiscovered(learnerId, c.req.param('id'), req.goal);
  return c.json(courseView(learnerId, course.id), 201);
});
learning.post('/courses/:id/nodes/:nodeId/experience', async (c) => {
  const learnerId = c.get('learner').id;
  const experience = await getOrGenerateExperience(learnerId, c.req.param('id'), c.req.param('nodeId'));
  return c.json(experienceView(learnerId, experience));
});

// ---- experiences ----
learning.get('/experiences/:id', (c) => {
  const learnerId = c.get('learner').id;
  return c.json(experienceView(learnerId, repo.getExperience(learnerId, c.req.param('id'))));
});
learning.post('/experiences/:id/events', async (c) => {
  const req = await body(c, ExperienceEventRequestSchema);
  return c.json(recordEvent(c.get('learner').id, c.req.param('id'), req));
});

learning.onError((err, c) => {
  if (err instanceof BadRequest) return c.json({ error: err.message }, 400);
  if (err instanceof repo.NotFoundError) return c.json({ error: err.message }, 404);
  if (err instanceof NodeLockedError) return c.json({ error: err.message }, 409);
  if (err instanceof GenerationError) {
    const status = err.kind === 'disabled' ? 503 : err.kind === 'refused' ? 422 : 502;
    console.error(`[generation:${err.kind}] ${err.message}`, err.detail ?? '');
    return c.json({ error: err.message, kind: err.kind, detail: err.kind === 'invalid' ? err.detail : undefined }, status);
  }
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : 'internal error' }, 500);
});
