import { config } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

// server/.env is gitignored; server/.env.example documents the shape.
config({ path: path.resolve(process.cwd(), 'server/.env') });

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required (server/.env)'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DATABASE_PATH: z.string().min(1).default('./data/indy.sqlite'),
  /** Set to "1" to boot without a key for schema/migration work. Generation routes then return 503. */
  ALLOW_NO_AI: z.enum(['0', '1']).default('0'),
  /** Anthropic fast mode (research preview, Opus 5.5): ~2.5x output speed at 2x price. "0" to disable. */
  ANTHROPIC_FAST_MODE: z.enum(['0', '1']).default('1'),
});

const parsed = EnvSchema.safeParse({
  ...process.env,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? (process.env.ALLOW_NO_AI === '1' ? 'disabled' : undefined),
});

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid server environment:\n${lines}\nCopy server/.env.example to server/.env and fill it in.`);
}

export const env = parsed.data;
export const aiEnabled = env.ANTHROPIC_API_KEY !== 'disabled';
