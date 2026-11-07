import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { LearnerV1Schema, type LearnerV1 } from '../../src/contracts';
import { db } from './db/client';
import { learners } from './db/schema';

export type AppEnv = { Variables: { learner: LearnerV1 } };

/** Resolves the anonymous bearer token to a learner. */
export const requireLearner = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return c.json({ error: 'missing bearer token' }, 401);
  const row = db.select().from(learners).where(eq(learners.token, token)).get();
  if (!row) return c.json({ error: 'unknown token' }, 401);
  c.set(
    'learner',
    LearnerV1Schema.parse({ schemaVersion: 1, id: row.id, displayName: row.displayName, createdAt: row.createdAt }),
  );
  await next();
});
