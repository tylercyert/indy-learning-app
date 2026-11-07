import { serve } from '@hono/node-server';
import { app } from './app';
import { runMigrations } from './db/client';
import { aiEnabled, env } from './env';

runMigrations();

serve({ fetch: app.fetch, port: env.PORT, hostname: '0.0.0.0' }, (info) => {
  console.log(`indy-learning server on http://0.0.0.0:${info.port} (ai: ${aiEnabled ? 'on' : 'OFF'})`);
});
