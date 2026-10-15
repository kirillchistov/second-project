/**
 * Локальный запуск API: npm run dev -w @rr/api (база: docker compose up -d в корне репозитория)
 * Переменные (в .env в корне репозитория): ANTHROPIC_API_KEY, APP_TOKEN (необязательно), PORT, GRADER_MODEL, DAILY_LIMIT,
 * DATABASE_URL (без неё аккаунты выключены), ALLOWED_ORIGINS (через запятую), COOKIE_SECURE.
 */
import Anthropic from '@anthropic-ai/sdk';
import { serve } from '@hono/node-server';
import { loadQuestions, loadRubrics } from '@rr/content/node';
import { createApp } from './app.ts';
import { connectPostgres } from './db/index.ts';
import { claudeExaminer, GRADER_MODEL } from './examiner.ts';

const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
const client = new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {});

const rubrics = loadRubrics();
// Миграции применяются при старте: схема в репозитории всегда совпадает с базой
const database = process.env.DATABASE_URL ? await connectPostgres(process.env.DATABASE_URL) : null;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = createApp({
  db: database?.db,
  allowedOrigins,
  // Secure-cookie не уходит по http — локально без HTTPS его отключают
  secureCookies: process.env.COOKIE_SECURE !== 'false',
  questions: loadQuestions(),
  rubrics,
  examiner: claudeExaminer(client),
  token: process.env.APP_TOKEN || undefined,
  dailyLimit: process.env.DAILY_LIMIT ? Number(process.env.DAILY_LIMIT) : undefined,
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(
    `API на http://localhost:${port} — рубрик: ${rubrics.length}, модель ${GRADER_MODEL}` +
      `${process.env.APP_TOKEN ? ', нужен токен' : ', без токена'}, аккаунты ${database ? 'включены' : 'выключены (нет DATABASE_URL)'}`,
  );
});
