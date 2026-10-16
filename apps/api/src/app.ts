/**
 * HTTP-слой: проверка доступа, квота и валидация запросов. Модель подставляется снаружи —
 * в тестах это заглушка, в main.ts — Claude.
 */
import type { Question } from '@rr/content';
import type { Rubric } from '@rr/content/rubrics';
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS, type GradeResult } from '@rr/core';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { accountRoutes, sessionMiddleware, type AuthEnv } from './accounts.ts';
import type { Db } from './db/index.ts';
import { forumRoutes } from './forum.ts';
import { buildResult, type Examiner } from './examiner.ts';

export interface AppOptions {
  questions: readonly Question[];
  rubrics: readonly Rubric[];
  examiner: Examiner;
  /** Общий токен для своих: без него проверка ответов открыта (удобно локально). Вошедшему пользователю не нужен */
  token?: string;
  /** База аккаунтов; без неё маршруты аккаунтов отвечают 503 (например, в тестах проверки ответов) */
  db?: Db;
  /** Origin веб-клиентов: CORS с cookie и защита от CSRF */
  allowedOrigins?: readonly string[];
  /** Secure у cookie сессии; false — только для локальной разработки по http */
  secureCookies?: boolean;
  /** Сколько обращений к модели в сутки на устройство */
  dailyLimit?: number;
  now?: () => Date;
}

const gradeBody = z.object({
  question: z.string(),
  answer: z.string().max(MAX_ANSWER_CHARS),
  hints: z.number().int().min(0).max(10).default(0),
});

const hintBody = z.object({
  question: z.string(),
  answer: z.string().max(MAX_ANSWER_CHARS).default(''),
  level: z.number().int().min(1).max(3).default(1),
});

export function createApp(options: AppOptions) {
  const { examiner, token, db, dailyLimit = 150, now = () => new Date() } = options;
  const allowedOrigins = options.allowedOrigins ?? [];
  const questionBySlug = new Map(options.questions.map((q) => [q.slug, q]));
  const rubricBySlug = new Map(options.rubrics.map((r) => [r.question, r]));
  // Квота в памяти процесса: для своих этого достаточно, при деплое её заменит хранилище
  const usage = new Map<string, number>();

  const app = new Hono<AuthEnv>();

  app.get('/health', (c) => c.json({ ok: true, rubrics: rubricBySlug.size, accounts: Boolean(db) }));

  // Веб-клиенты со своих доменов шлют cookie сессии; мобильному приложению CORS не нужен
  app.use('/v1/*', cors({ origin: (origin) => (allowedOrigins.includes(origin) ? origin : null), credentials: true }));
  app.use('/v1/*', sessionMiddleware({ db, appToken: token, now }));

  // Проверка ответов ИИ стоит денег: доступ — вошедшему пользователю или по общему токену, квота — на пользователя или устройство
  const aiGate = async (c: Context<AuthEnv>, next: () => Promise<void>) => {
    const user = c.get('user');
    if (!user && token && c.req.header('authorization') !== `Bearer ${token}`) return c.json({ error: 'unauthorized' }, 401);
    const who = user ? `user:${user.id}` : `device:${c.req.header('x-device-id') ?? 'anonymous'}`;
    const key = `${now().toISOString().slice(0, 10)}:${who}`;
    const count = (usage.get(key) ?? 0) + 1;
    if (count > dailyLimit) return c.json({ error: 'daily_limit', message: 'Лимит проверок на сегодня исчерпан' }, 429);
    usage.set(key, count);
    await next();
  };
  app.use('/v1/grade', aiGate);
  app.use('/v1/hint', aiGate);

  if (db) {
    app.route('/v1', accountRoutes({ db, allowedOrigins, secureCookies: options.secureCookies ?? true, now }));
    app.route('/v1/forum', forumRoutes({ db, allowedOrigins, questionSlugs: new Set(questionBySlug.keys()), now }));
  } else {
    app.all('/v1/auth/*', (c) => c.json({ error: 'accounts_disabled' }, 503));
    app.all('/v1/forum/*', (c) => c.json({ error: 'accounts_disabled' }, 503));
  }

  /** Вопрос и рубрика по slug — или ответ с ошибкой */
  function lookup(slug: string) {
    const question = questionBySlug.get(slug);
    const rubric = rubricBySlug.get(slug);
    if (!question) return { error: 'unknown_question' as const };
    if (!rubric) return { error: 'no_rubric' as const };
    return { question, rubric };
  }

  app.post('/v1/grade', async (c) => {
    const body = gradeBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request', message: z.prettifyError(body.error) }, 400);
    const found = lookup(body.data.question);
    if ('error' in found) return c.json({ error: found.error }, 404);

    const answer = body.data.answer.trim();
    // Пустой ответ не отправляем модели: это пропуск — все пункты не раскрыты
    if (answer.length < MIN_ANSWER_CHARS) {
      const empty: GradeResult = {
        ...buildResult(found.rubric, { points: [], errors: [], feedback: '', followUp: '' }, body.data.hints),
        feedback: 'Ответ слишком короткий, чтобы его оценить. Попробуй рассказать своими словами хотя бы главную мысль.',
      };
      return c.json(empty);
    }
    try {
      const output = await examiner.grade(found.question, found.rubric, answer);
      return c.json(buildResult(found.rubric, output, body.data.hints));
    } catch (error) {
      console.error('grade failed', error);
      return c.json({ error: 'examiner_failed' }, 502);
    }
  });

  app.post('/v1/hint', async (c) => {
    const body = hintBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request', message: z.prettifyError(body.error) }, 400);
    const found = lookup(body.data.question);
    if ('error' in found) return c.json({ error: found.error }, 404);
    try {
      const hint = await examiner.hint(found.question, found.rubric, body.data.answer.trim(), body.data.level);
      return c.json({ hint });
    } catch (error) {
      console.error('hint failed', error);
      return c.json({ error: 'examiner_failed' }, 502);
    }
  });

  return app;
}
