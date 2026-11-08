import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/src/db/schema.ts',
  out: './server/drizzle',
  dbCredentials: { url: process.env.DATABASE_PATH ?? './data/poko.sqlite' },
  strict: true,
  verbose: true,
});
