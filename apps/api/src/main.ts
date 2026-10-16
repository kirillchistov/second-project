/**
 * Локальный запуск API: npm run dev -w @rr/api (база: docker compose up -d в корне репозитория)
 * Переменные (в .env в корне репозитория): ANTHROPIC_API_KEY, APP_TOKEN (необязательно), PORT, GRADER_MODEL, DAILY_LIMIT,
 * DATABASE_URL (без неё аккаунты выключены), ALLOWED_ORIGINS (через запятую), COOKIE_SECURE.
 * На Vercel вместо этого файла работает src/index.ts.
 */
import { serve } from '@hono/node-server';
import { loadQuestions, loadRubrics } from '@rr/content/node';
import { createApp } from './app.ts';
import { createPostgres, migrateDatabase } from './db/index.ts';
import { optionsFromEnv } from './env.ts';
import { GRADER_MODEL } from './examiner.ts';

const rubrics = loadRubrics();
// Локально миграции применяются при старте: схема в репозитории всегда совпадает с базой
const url = process.env.DATABASE_URL;
if (url) await migrateDatabase(url);
const database = url ? createPostgres(url) : null;

// Контент читается с диска, а не из бандла: правка вопроса видна после перезапуска без сборки
const app = createApp({ questions: loadQuestions(), rubrics, db: database?.db, ...optionsFromEnv() });

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(
    `API на http://localhost:${port} — рубрик: ${rubrics.length}, модель ${GRADER_MODEL}` +
      `${process.env.APP_TOKEN ? ', нужен токен' : ', без токена'}, аккаунты ${database ? 'включены' : 'выключены (нет DATABASE_URL)'}`,
  );
});
