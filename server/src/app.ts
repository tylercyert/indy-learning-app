import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { logger } from 'hono/logger';
import { LearnerV1Schema, type LearnerV1 } from '../../src/contracts';
import { aiEnabled } from './env';
import { db } from './db/client';
import { learners, streaks } from './db/schema';

export type AppEnv = { Variables: { learner: LearnerV1 } };

export const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'] }));

app.get('/health', (c) => c.json({ ok: true, ai: aiEnabled, time: new Date().toISOString() }));

/** Anonymous learner bootstrap. The client stores the token and sends it as a bearer. */
app.post('/learners', async (c) => {
  const now = new Date().toISOString();
  const learner: LearnerV1 = { schemaVersion: 1, id: randomUUID(), displayName: null, createdAt: now };
  const token = randomUUID() + randomUUID().replace(/-/g, '');
  db.insert(learners).values({ id: learner.id, token, displayName: null, createdAt: now }).run();
  db.insert(streaks).values({ learnerId: learner.id, count: 0, lastActiveDate: null }).run();
  return c.json({ learner, token }, 201);
});

/** Resolves the bearer token to a learner for everything below. */
export const requireLearner = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ error: 'missing bearer token' }, 401);
  const row = db.select().from(learners).where(eq(learners.token, token)).get();
  if (!row) return c.json({ error: 'unknown token' }, 401);
  const learner = LearnerV1Schema.parse({
    schemaVersion: 1,
    id: row.id,
    displayName: row.displayName,
    createdAt: row.createdAt,
  });
  c.set('learner', learner);
  await next();
});

app.use('/me/*', requireLearner);
app.get('/me', requireLearner, (c) => c.json({ learner: c.get('learner') }));

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal error' }, 500);
});
