import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { schema } from './schema.ts';

/** Общий тип базы: в продакшене postgres.js, в тестах PGlite (Postgres в памяти) — запросы одинаковые. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_DIR = new URL('../../drizzle', import.meta.url).pathname;

/**
 * Подключение к Postgres. Синхронное: соединение открывается при первом запросе,
 * поэтому serverless-функция не платит за подключение при холодном старте, если база не нужна.
 * `serverless` — для Vercel: одно соединение на экземпляр функции и без prepared statements,
 * которые не работают через пулер соединений Neon (PgBouncer в режиме транзакций).
 */
export function createPostgres(url: string, opts: { serverless?: boolean } = {}): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, {
    max: opts.serverless ? 1 : 10,
    prepare: !opts.serverless,
    // NOTICE от Postgres (например, «schema already exists» при повторной миграции) в лог не нужны
    onnotice: () => {},
  });
  return { db: drizzle(client, { schema }) as unknown as Db, close: () => client.end() };
}

/** Применение миграций из apps/api/drizzle — локально при старте, в продакшене отдельной командой */
export async function migrateDatabase(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await client.end();
  }
}

export { schema };
