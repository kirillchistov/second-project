/**
 * Аккаунты, сессии, синхронизация прогонов и лидерборд.
 *
 * Клиенты:
 * - веб — cookie `rr_session` (HttpOnly, Secure, SameSite=Lax) + проверка Origin на изменяющих запросах;
 * - мобильное приложение — заголовок `x-auth-mode: token` при входе, токен в ответе и дальше `Authorization: Bearer`.
 */
import { addDays, runXp, type LessonRun } from '@rr/core';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  dummyPasswordHash,
  hashPassword,
  newSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  tokenHash,
  verifyPassword,
} from './auth.ts';
import type { Db } from './db/index.ts';
import { runs, sessions, users } from './db/schema.ts';

export type Role = 'user' | 'moderator';

export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  role: Role;
}

export type AuthEnv = { Variables: { user: SessionUser | null; viaCookie: boolean } };

export interface AccountsOptions {
  db: Db;
  /** Origin веб-клиентов, которым можно слать cookie-запросы, например https://refresher.example */
  allowedOrigins: readonly string[];
  /** false только для локальной разработки по http */
  secureCookies: boolean;
  now: () => Date;
}

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Неверный формат email' }).max(254));
const password = z.string().min(8, 'Пароль — не короче 8 символов').max(200, 'Пароль слишком длинный');
const nickname = z
  .string()
  .trim()
  .min(3, 'Ник — от 3 символов')
  .max(24, 'Ник — до 24 символов')
  .regex(/^[\p{L}\p{N}_-]+$/u, 'В нике только буквы, цифры, _ и -');

const signupBody = z.object({ email, password, nickname });
const loginBody = z.object({ email, password: z.string().min(1).max(200) });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const runBody = z.object({
  id: z.string().min(8).max(64),
  lessonId: z.string().max(64).nullable(),
  day: z.string().regex(DAY),
  completedAt: z.iso.datetime({ offset: true }),
  results: z
    .array(
      z.object({
        itemId: z.string().min(1).max(200),
        first: z.enum(['again', 'hard', 'good', 'easy']),
        attempts: z.number().int().min(1).max(100),
        mode: z.enum(['voice', 'explain', 'quiz']).optional(),
        hints: z.number().int().min(0).max(10).optional(),
      }),
    )
    .min(1)
    .max(100),
});
const syncBody = z.object({ runs: z.array(runBody).max(200) });

/** Простейший ограничитель частоты в памяти процесса: для своих достаточно, при масштабировании — Redis */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  /** true — запрос разрешён */
  take(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';
}

function bearer(c: Context): string | undefined {
  const header = c.req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
}

/**
 * CSRF: запрос с cookie, меняющий данные, принимаем только со своих Origin.
 * Bearer-запросы браузер сам не отправляет, им проверка не нужна.
 */
export function csrfGuard(allowedOrigins: readonly string[]) {
  return async (c: Context, next: () => Promise<void>) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !bearer(c)) {
      const origin = c.req.header('origin');
      if (origin && !allowedOrigins.includes(origin)) return c.json({ error: 'forbidden_origin' }, 403);
    }
    await next();
  };
}

/** Понедельник недели, в которую попадает день `YYYY-MM-DD` */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

/**
 * Промежуточный слой: определяет пользователя по Bearer-токену или cookie.
 * Токен `appToken` (общий токен для своих) пользователем не считается.
 */
export function sessionMiddleware(opts: { db?: Db; appToken?: string; now: () => Date }) {
  return async (c: Context<AuthEnv>, next: () => Promise<void>) => {
    c.set('user', null);
    c.set('viaCookie', false);
    if (opts.db) {
      const fromHeader = bearer(c);
      const token = fromHeader && fromHeader !== opts.appToken ? fromHeader : getCookie(c, SESSION_COOKIE);
      if (token) {
        const now = opts.now();
        const [row] = await opts.db
          .select({ id: users.id, email: users.email, nickname: users.nickname, role: users.role, expiresAt: sessions.expiresAt })
          .from(sessions)
          .innerJoin(users, eq(users.id, sessions.userId))
          .where(eq(sessions.tokenHash, tokenHash(token)))
          .limit(1);
        if (row && row.expiresAt > now) {
          c.set('user', { id: row.id, email: row.email, nickname: row.nickname, role: row.role as Role });
          c.set('viaCookie', token !== fromHeader);
          // Скользящий срок: продлеваем, когда прошла десятая часть срока, а не на каждый запрос
          if (row.expiresAt.getTime() - now.getTime() < SESSION_TTL_MS * 0.9) {
            await opts.db
              .update(sessions)
              .set({ expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
              .where(eq(sessions.tokenHash, tokenHash(token)));
          }
        }
      }
    }
    await next();
  };
}

export function accountRoutes(opts: AccountsOptions) {
  const { db, now } = opts;
  const app = new Hono<AuthEnv>();
  const byIp = new RateLimiter(20, 10 * 60 * 1000);
  const byEmail = new RateLimiter(8, 15 * 60 * 1000);

  app.use('*', csrfGuard(opts.allowedOrigins));

  async function startSession(c: Context<AuthEnv>, user: SessionUser) {
    const token = newSessionToken();
    const expiresAt = new Date(now().getTime() + SESSION_TTL_MS);
    await db.insert(sessions).values({
      tokenHash: tokenHash(token),
      userId: user.id,
      expiresAt,
      userAgent: c.req.header('user-agent')?.slice(0, 200) ?? null,
    });
    // Мобильное приложение просит токен в ответе; веб получает только HttpOnly cookie
    if (c.req.header('x-auth-mode') === 'token') return { user, token };
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: opts.secureCookies,
      sameSite: 'Lax',
      path: '/',
      expires: expiresAt,
    });
    return { user };
  }

  function limited(c: Context, key?: string): boolean {
    const t = now().getTime();
    return !byIp.take(clientIp(c), t) || (key !== undefined && !byEmail.take(key, t));
  }

  app.post('/auth/signup', async (c) => {
    const body = signupBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request', fields: z.flattenError(body.error).fieldErrors }, 400);
    if (limited(c)) return c.json({ error: 'too_many_requests' }, 429);
    const { email, password, nickname } = body.data;
    const passwordHash = await hashPassword(password);
    const inserted = await db
      .insert(users)
      .values({ email, nickname, nicknameKey: nickname.toLowerCase(), passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id, email: users.email, nickname: users.nickname, role: users.role });
    if (inserted.length === 0) {
      const [taken] = await db.select({ email: users.email }).from(users).where(eq(users.email, email)).limit(1);
      // Занятый ник подсказываем; про email — тоже, иначе пользователь не поймёт, почему не регистрируется.
      // Перебор адресов сдерживает лимит запросов.
      return c.json({ error: taken ? 'email_taken' : 'nickname_taken' }, 409);
    }
    return c.json(await startSession(c, { ...inserted[0], role: inserted[0].role as Role }), 201);
  });

  app.post('/auth/login', async (c) => {
    const body = loginBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid_credentials' }, 401);
    if (limited(c, body.data.email)) return c.json({ error: 'too_many_requests' }, 429);
    const [user] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
    // Пароль проверяем и для несуществующего адреса — время ответа не выдаёт, зарегистрирован ли email
    const ok = await verifyPassword(body.data.password, user?.passwordHash ?? (await dummyPasswordHash()));
    if (!user || !ok) return c.json({ error: 'invalid_credentials' }, 401);
    return c.json(await startSession(c, { id: user.id, email: user.email, nickname: user.nickname, role: user.role as Role }));
  });

  app.post('/auth/logout', async (c) => {
    const token = bearer(c) ?? getCookie(c, SESSION_COOKIE);
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: opts.secureCookies });
    return c.body(null, 204);
  });

  app.get('/me', (c) => {
    const user = c.get('user');
    return user ? c.json({ user }) : c.json({ error: 'unauthorized' }, 401);
  });

  /** Досылка прогонов: повторная отправка того же id ничего не меняет */
  app.post('/progress/runs', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    const body = syncBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request', message: z.prettifyError(body.error) }, 400);
    if (body.data.runs.length) {
      await db
        .insert(runs)
        .values(
          body.data.runs.map((r) => ({
            userId: user.id,
            id: r.id,
            lessonId: r.lessonId,
            day: r.day,
            completedAt: new Date(r.completedAt),
            results: r.results,
            xp: runXp(r),
          })),
        )
        .onConflictDoNothing();
    }
    return c.json({ accepted: body.data.runs.map((r) => r.id) });
  });

  /** Вся история прогонов: новое устройство собирает из неё прогресс той же функцией foldRuns */
  app.get('/progress/runs', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    const rows = await db.select().from(runs).where(eq(runs.userId, user.id)).orderBy(runs.completedAt);
    const history: LessonRun[] = rows.map((r) => ({
      id: r.id,
      lessonId: r.lessonId,
      day: r.day,
      completedAt: r.completedAt.toISOString(),
      results: r.results,
    }));
    return c.json({ runs: history });
  });

  /** Лидерборд недели: XP за прогоны с понедельника; публично только ник */
  app.get('/leaderboard', async (c) => {
    const today = c.req.query('today') && DAY.test(c.req.query('today')!) ? c.req.query('today')! : now().toISOString().slice(0, 10);
    const from = weekStart(today);
    const xp = sql<number>`sum(${runs.xp})::int`;
    const rows = await db
      .select({ userId: runs.userId, nickname: users.nickname, xp })
      .from(runs)
      .innerJoin(users, eq(users.id, runs.userId))
      .where(and(gte(runs.day, from)))
      .groupBy(runs.userId, users.nickname)
      .orderBy(desc(xp), users.nickname)
      .limit(50);
    const me = c.get('user');
    return c.json({
      weekStart: from,
      entries: rows.map((r, i) => ({ rank: i + 1, nickname: r.nickname, xp: r.xp, me: r.userId === me?.id })),
    });
  });

  return app;
}
