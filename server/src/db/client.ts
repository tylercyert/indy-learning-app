import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env';
import * as schema from './schema';

const inMemory = env.DATABASE_PATH === ':memory:';
const dbPath = inMemory ? ':memory:' : path.resolve(process.cwd(), env.DATABASE_PATH);
if (!inMemory) fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;

/** Applies pending SQL migrations from server/drizzle at startup. Idempotent. */
export function runMigrations(): void {
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'server/drizzle') });
}
