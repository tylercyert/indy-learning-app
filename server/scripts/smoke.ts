/**
 * Live end-to-end smoke test against a running server (real model calls, real spend).
 *   npx tsx server/scripts/smoke.ts [baseUrl] ["goal text"]
 * Creates a learner, runs intake with scripted answers, plans a course, generates and
 * completes the orientation lesson, and prints a compact report. Exits non-zero on failure.
 */
import {
  CourseViewSchema,
  ExperienceEventResponseSchema,
  ExperienceViewSchema,
  IntakeSessionViewSchema,
  componentRole,
} from '../../src/contracts';

const base = process.argv[2] ?? 'http://127.0.0.1:8787';
const goal = process.argv[3] ?? 'I want to make great cocktails for a party on Saturday, including a good non-alcoholic option';
const scriptedAnswers = ['I mostly follow recipes', 'Being able to fix a drink that tastes off, and one great non-alcoholic option', 'This Saturday, about 20 minutes to learn', 'I have a shaker and a jigger'];

const t0 = Date.now();
const log = (msg: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

async function call(path: string, init: RequestInit = {}, token?: string): Promise<unknown> {
  const res = await fetch(base + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const health = (await call('/health')) as { ai: boolean };
  if (!health.ai) throw new Error('server has AI disabled');
  const { token } = (await call('/learners', { method: 'POST' })) as { token: string };
  log('learner created');

  let intake = IntakeSessionViewSchema.parse(await call('/intakes', { method: 'POST', body: JSON.stringify({ goal }) }, token));
  log(`intake started: ${intake.turn?.kind} ${intake.turn?.kind === 'ask' ? `"${intake.turn.question}" [${intake.turn.suggestedAnswers.join(' | ')}]` : ''}`);
  let i = 0;
  while (intake.status === 'open' && i < scriptedAnswers.length) {
    intake = IntakeSessionViewSchema.parse(await call(`/intakes/${intake.id}/reply`, { method: 'POST', body: JSON.stringify({ answer: scriptedAnswers[i++] }) }, token));
    log(`reply ${i}: ${intake.turn?.kind} ${intake.turn?.kind === 'ask' ? `"${intake.turn.question}"` : `"${intake.turn?.kind === 'ready' ? intake.turn.summary : ''}"`}`);
  }
  if (intake.status !== 'ready') throw new Error(`intake ended as ${intake.status} after ${i} answers`);
  log(`context: topic=${intake.context?.goal.topic} level=${intake.context?.experience.level} horizon=${intake.context?.horizon} facts=${intake.context?.facts.length} constraints=${intake.context?.constraints.length}`);

  const course = CourseViewSchema.parse(await call('/courses', { method: 'POST', body: JSON.stringify({ intakeId: intake.id }) }, token));
  const tree = course.trees[0]!;
  log(`course "${course.course.title}" companion=${course.course.companion.name} nodes=${tree.tree.nodes.length} next=${tree.nextNodeId}`);
  for (const n of tree.tree.nodes) log(`  ${tree.nodeStates[n.id]!.padEnd(9)} ${n.kind.padEnd(11)} ${n.required ? 'req' : 'opt'} ${n.id} <- ${JSON.stringify(n.rule)}`);

  const nodeId = tree.nextNodeId!;
  const exp = ExperienceViewSchema.parse(await call(`/courses/${course.course.id}/nodes/${nodeId}/experience`, { method: 'POST', body: '{}' }, token));
  log(`experience ${exp.experience.id}: ${exp.experience.slides.length} slides by ${exp.experience.generatedBy}`);
  for (const s of exp.experience.slides) log(`  [${s.purpose}] ${s.title} :: ${s.components.map((c) => c.type).join(', ')}`);

  let last;
  for (const s of exp.experience.slides) {
    for (const c of s.components) {
      if (componentRole(c.type) === 'assessable' && c.type === 'multipleChoice') {
        const wrong = c.options.find((o) => o.id !== c.correctOptionId)!;
        const r1 = ExperienceEventResponseSchema.parse(await call(`/experiences/${exp.experience.id}/events`, { method: 'POST', body: JSON.stringify({ type: 'answer', slideId: s.id, componentId: c.id, selectedOptionId: wrong.id }) }, token));
        log(`  answered wrong on ${c.id}: correct=${r1.scored?.correct} explanation="${r1.scored?.explanation.slice(0, 70)}…"`);
        const r2 = ExperienceEventResponseSchema.parse(await call(`/experiences/${exp.experience.id}/events`, { method: 'POST', body: JSON.stringify({ type: 'answer', slideId: s.id, componentId: c.id, selectedOptionId: c.correctOptionId }) }, token));
        log(`  answered right on ${c.id}: correct=${r2.scored?.correct} attempt=${r2.scored?.attempt}`);
      }
    }
    last = ExperienceEventResponseSchema.parse(await call(`/experiences/${exp.experience.id}/events`, { method: 'POST', body: JSON.stringify({ type: 'slideViewed', slideId: s.id }) }, token));
  }
  log(`lessonCompleted=${last?.lessonCompleted} streak=${last?.streak.count}`);
  const after = CourseViewSchema.parse(await call(`/courses/${course.course.id}`, {}, token));
  log(`states after: ${Object.entries(after.trees[0]!.nodeStates).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  if (!last?.lessonCompleted) throw new Error('orientation lesson did not complete');
  log('SMOKE OK');
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
