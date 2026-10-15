import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { schema } from './schema.ts';

/** Общий тип базы: в продакшене postgres.js, в тестах PGlite (Postgres в памяти) — запросы одинаковые. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_DIR = new URL('../../drizzle', import.meta.url).pathname;

/** Подключение к Postgres по DATABASE_URL и применение миграций */
export async function connectPostgres(url: string): Promise<{ db: Db; close: () => Promise<void> }> {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  // NOTICE от Postgres (например, «schema already exists» при повторной миграции) в лог не нужны
  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db: db as unknown as Db, close: () => client.end() };
}

export { schema };
