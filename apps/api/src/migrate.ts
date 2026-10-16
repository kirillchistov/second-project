/**
 * Миграции базы: DATABASE_URL='postgres://…' npm run db:migrate -w @rr/api
 * Для Neon используйте прямой адрес (без -pooler): DDL через пулер соединений не нужен.
 */
import { migrateDatabase } from './db/index.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Нужна переменная DATABASE_URL');
  process.exit(1);
}
await migrateDatabase(url);
console.log('Миграции применены');
