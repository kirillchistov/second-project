/**
 * Точка входа для Vercel: функция находит Hono-приложение по default-экспорту из src/index.ts.
 * Контент (вопросы и рубрики) встроен в сборку из packages/content/dist/server.json —
 * собирается командой build (npm run bundle -w @rr/content). Миграции здесь не применяются:
 * их запускают отдельно — npm run db:migrate -w @rr/api.
 */
import server from '@rr/content/server.json' with { type: 'json' };
import type { ServerBundle } from '@rr/content';
import { createApp } from './app.ts';
import { createPostgres } from './db/index.ts';
import { optionsFromEnv } from './env.ts';

const content = server as ServerBundle;
const database = process.env.DATABASE_URL ? createPostgres(process.env.DATABASE_URL, { serverless: true }) : null;

const app = createApp({ questions: content.questions, rubrics: content.rubrics, db: database?.db, ...optionsFromEnv() });

export default app;
