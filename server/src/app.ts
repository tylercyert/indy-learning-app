import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
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

// Every API route lives under /api so the exported web app can own the root.
app.get('/api/health', (c) => c.json({ ok: true, ai: aiEnabled, time: new Date().toISOString() }));

/** Anonymous learner bootstrap. The client stores the token and sends it as a bearer. */
app.post('/api/learners', (c) => {
  const now = new Date().toISOString();
  const learner: LearnerV1 = { schemaVersion: 1, id: randomUUID(), displayName: null, createdAt: now };
  const token = randomUUID() + randomUUID().replace(/-/g, '');
  db.insert(learners).values({ id: learner.id, token, displayName: null, createdAt: now }).run();
  db.insert(streaks).values({ learnerId: learner.id, count: 0, lastActiveDate: null }).run();
  return c.json({ learner, token }, 201);
});

app.get('/api/me', requireLearner, (c) => c.json({ learner: c.get('learner') }));

app.route('/api', learning);

/**
 * The exported web app (npm run web:export → dist/) is served from the same origin, so a laptop
 * browser on the tailnet opens http://<tailscale-ip>:8787 and the app talks to this server
 * without CORS. Expo Router web export is a single-page app: unknown GET paths fall back to index.html.
 */
const distDir = path.resolve(process.cwd(), 'dist');
const indexHtml = path.join(distDir, 'index.html');
export const servesWeb = fs.existsSync(indexHtml);
if (servesWeb) {
  app.use('/*', serveStatic({ root: './dist' }));
}

app.notFound((c) => {
  const isApi = c.req.path.startsWith('/api/');
  if (!isApi && servesWeb && c.req.method === 'GET' && (c.req.header('Accept') ?? '').includes('text/html')) {
    return c.html(fs.readFileSync(indexHtml, 'utf8'));
  }
  return c.json({ error: 'not found' }, 404);
});
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal error' }, 500);
});
