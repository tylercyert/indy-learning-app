import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { LearnerV1 } from '../../src/contracts';
import { requireLearner, type AppEnv } from './auth';
import { db } from './db/client';
import { learners, streaks } from './db/schema';
import { aiEnabled } from './env';
import { learning } from './routes/learning';

export type { AppEnv } from './auth';

export const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'] }));

app.get('/health', (c) => c.json({ ok: true, ai: aiEnabled, time: new Date().toISOString() }));

/** Anonymous learner bootstrap. The client stores the token and sends it as a bearer. */
app.post('/learners', (c) => {
  const now = new Date().toISOString();
  const learner: LearnerV1 = { schemaVersion: 1, id: randomUUID(), displayName: null, createdAt: now };
  const token = randomUUID() + randomUUID().replace(/-/g, '');
  db.insert(learners).values({ id: learner.id, token, displayName: null, createdAt: now }).run();
  db.insert(streaks).values({ learnerId: learner.id, count: 0, lastActiveDate: null }).run();
  return c.json({ learner, token }, 201);
});

app.get('/me', requireLearner, (c) => c.json({ learner: c.get('learner') }));

app.route('/', learning);

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal error' }, 500);
});
