/**
 * Локальный запуск API: npm run dev -w @rr/api
 * Переменные (в .env в корне репозитория): ANTHROPIC_API_KEY, APP_TOKEN (необязательно), PORT, GRADER_MODEL, DAILY_LIMIT.
 */
import Anthropic from '@anthropic-ai/sdk';
import { serve } from '@hono/node-server';
import { loadQuestions, loadRubrics } from '@rr/content/node';
import { createApp } from './app.ts';
import { claudeExaminer, GRADER_MODEL } from './examiner.ts';

const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
const client = new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {});

const rubrics = loadRubrics();
const app = createApp({
  questions: loadQuestions(),
  rubrics,
  examiner: claudeExaminer(client),
  token: process.env.APP_TOKEN || undefined,
  dailyLimit: process.env.DAILY_LIMIT ? Number(process.env.DAILY_LIMIT) : undefined,
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API на http://localhost:${port} — рубрик: ${rubrics.length}, модель ${GRADER_MODEL}${process.env.APP_TOKEN ? ', нужен токен' : ', без токена'}`);
});
