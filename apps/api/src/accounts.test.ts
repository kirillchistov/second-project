import { PGlite } from '@electric-sql/pglite';
import type { Question } from '@rr/content';
import type { Rubric } from '@rr/content/rubrics';
import { runXp, type LessonRun } from '@rr/core';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeAll, describe, expect, test } from 'vitest';
import { weekStart } from './accounts.ts';
import { createApp } from './app.ts';
import { hashPassword, verifyPassword } from './auth.ts';
import { MIGRATIONS_DIR, schema, type Db } from './db/index.ts';
import type { Examiner } from './examiner.ts';

const ORIGIN = 'https://refresher.example';
let db: Db;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: MIGRATIONS_DIR });
  db = pg as unknown as Db;
});

const examiner: Examiner = {
  grade: async () => ({ points: [], errors: [], feedback: '', followUp: '' }),
  hint: async () => 'подсказка',
};
const question = { slug: 'keys', title: 'Зачем нужен key?' } as Question;
const rubric: Rubric = { question: 'keys', points: [{ id: 'p', text: 'p', weight: 1 }], misconceptions: [] };

let clock = new Date('2026-10-15T10:00:00.000Z');
function makeApp(token?: string) {
  return createApp({ questions: [question], rubrics: [rubric], examiner, db, token, allowedOrigins: [ORIGIN], now: () => clock });
}

let seq = 0;
function uniqueUser() {
  seq++;
  return { email: `User${seq}@Example.com`, password: 'correct horse battery', nickname: `игрок_${seq}` };
}

function call(app: ReturnType<typeof makeApp>, method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  return app.request(path, {
    method,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    headers: { 'content-type': 'application/json', ...opts.headers },
  });
}

/** Регистрация мобильным клиентом: токен в ответе */
async function signupMobile(app: ReturnType<typeof makeApp>, user = uniqueUser()) {
  const res = await call(app, 'POST', '/v1/auth/signup', { body: user, headers: { 'x-auth-mode': 'token' } });
  const body = (await res.json()) as { token: string; user: { id: string; nickname: string } };
  return { ...body, auth: { authorization: `Bearer ${body.token}` }, input: user };
}

function cookieFrom(res: Response): string {
  return res.headers.get('set-cookie')!.split(';')[0];
}

describe('пароли', () => {
  test('scrypt с солью: разные хэши у одного пароля, проверка верная', async () => {
    const a = await hashPassword('пароль-123');
    const b = await hashPassword('пароль-123');
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword('пароль-123', a)).toBe(true);
    expect(await verifyPassword('пароль-124', a)).toBe(false);
    expect(await verifyPassword('x', 'plaintext')).toBe(false);
  });
});

describe('регистрация и вход', () => {
  test('веб получает HttpOnly cookie, а не токен в теле', async () => {
    const app = makeApp();
    const res = await call(app, 'POST', '/v1/auth/signup', { body: uniqueUser(), headers: { origin: ORIGIN } });
    expect(res.status).toBe(201);
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/rr_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(await res.json()).not.toHaveProperty('token');

    const me = await call(app, 'GET', '/v1/me', { headers: { cookie: cookieFrom(res) } });
    expect(me.status).toBe(200);
  });

  test('мобильный клиент получает токен; email в нижнем регистре', async () => {
    const app = makeApp();
    const { token, auth, input } = await signupMobile(app);
    expect(token.length).toBeGreaterThan(40);
    const me = (await (await call(app, 'GET', '/v1/me', { headers: auth })).json()) as { user: { email: string; nickname: string } };
    expect(me.user).toMatchObject({ email: input.email.toLowerCase(), nickname: input.nickname });
  });

  test('занятые email и ник (без учёта регистра), невалидные поля', async () => {
    const app = makeApp();
    const { input } = await signupMobile(app);
    const sameEmail = await call(app, 'POST', '/v1/auth/signup', { body: { ...uniqueUser(), email: input.email.toUpperCase() } });
    expect(sameEmail.status).toBe(409);
    expect(await sameEmail.json()).toEqual({ error: 'email_taken' });
    const sameNick = await call(app, 'POST', '/v1/auth/signup', { body: { ...uniqueUser(), nickname: input.nickname.toUpperCase() } });
    expect(await sameNick.json()).toEqual({ error: 'nickname_taken' });

    const bad = await call(app, 'POST', '/v1/auth/signup', { body: { email: 'нет', password: '123', nickname: 'a b' } });
    expect(bad.status).toBe(400);
    const { fields } = (await bad.json()) as { fields: Record<string, string[]> };
    expect(Object.keys(fields).sort()).toEqual(['email', 'nickname', 'password']);
  });

  test('вход: одинаковый ответ для чужого email и неверного пароля', async () => {
    const app = makeApp();
    const { input } = await signupMobile(app);
    const wrong = await call(app, 'POST', '/v1/auth/login', { body: { email: input.email, password: 'не тот пароль' } });
    const unknown = await call(app, 'POST', '/v1/auth/login', { body: { email: 'nobody@example.com', password: 'не тот пароль' } });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(await wrong.json()).toEqual(await unknown.json());

    const ok = await call(app, 'POST', '/v1/auth/login', { body: { email: input.email, password: input.password }, headers: { 'x-auth-mode': 'token' } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toHaveProperty('token');
  });

  test('выход отзывает токен', async () => {
    const app = makeApp();
    const { auth } = await signupMobile(app);
    expect((await call(app, 'POST', '/v1/auth/logout', { headers: auth })).status).toBe(204);
    expect((await call(app, 'GET', '/v1/me', { headers: auth })).status).toBe(401);
  });

  test('истёкшая сессия не пускает', async () => {
    const app = makeApp();
    const { auth } = await signupMobile(app);
    const saved = clock;
    clock = new Date(clock.getTime() + 61 * 24 * 60 * 60 * 1000);
    expect((await call(app, 'GET', '/v1/me', { headers: auth })).status).toBe(401);
    clock = saved;
  });

  test('CSRF: cookie-запрос с чужого Origin отклоняется', async () => {
    const app = makeApp();
    const res = await call(app, 'POST', '/v1/auth/signup', { body: uniqueUser(), headers: { origin: ORIGIN } });
    const cookie = cookieFrom(res);
    const evil = await call(app, 'POST', '/v1/progress/runs', { body: { runs: [] }, headers: { cookie, origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
    const own = await call(app, 'POST', '/v1/progress/runs', { body: { runs: [] }, headers: { cookie, origin: ORIGIN } });
    expect(own.status).toBe(200);
  });

  test('перебор паролей упирается в лимит', async () => {
    const app = makeApp();
    const { input } = await signupMobile(app);
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await call(app, 'POST', '/v1/auth/login', {
        body: { email: input.email, password: `guess-${i}` },
        headers: { 'x-forwarded-for': '203.0.113.7' },
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
  });
});

function makeRun(id: string, day: string, firsts: LessonRun['results'][number]['first'][]): LessonRun {
  return {
    id,
    lessonId: 'core-1',
    day,
    completedAt: `${day}T09:00:00.000Z`,
    results: firsts.map((first, i) => ({ itemId: `q:item-${i}`, first, attempts: first === 'again' ? 2 : 1 })),
  };
}

describe('синхронизация прогонов', () => {
  test('повторная отправка не дублирует, XP считает сервер, история возвращается', async () => {
    const app = makeApp();
    const { auth } = await signupMobile(app);
    const run = makeRun('run-00000001', '2026-10-15', ['good', 'again', 'easy']);
    const forged = { ...run, xp: 100500 };
    for (let i = 0; i < 2; i++) {
      const res = await call(app, 'POST', '/v1/progress/runs', { body: { runs: [forged] }, headers: auth });
      expect(await res.json()).toEqual({ accepted: ['run-00000001'] });
    }
    const { runs } = (await (await call(app, 'GET', '/v1/progress/runs', { headers: auth })).json()) as { runs: LessonRun[] };
    expect(runs).toEqual([run]);

    const board = (await (await call(app, 'GET', '/v1/leaderboard?today=2026-10-15', { headers: auth })).json()) as {
      entries: { xp: number; me: boolean }[];
    };
    expect(board.entries.find((e) => e.me)?.xp).toBe(runXp(run));
  });

  test('без входа и с кривыми данными — отказ', async () => {
    const app = makeApp();
    expect((await call(app, 'POST', '/v1/progress/runs', { body: { runs: [] } })).status).toBe(401);
    const { auth } = await signupMobile(app);
    const bad = await call(app, 'POST', '/v1/progress/runs', { body: { runs: [{ ...makeRun('x', '2026-10-15', ['good']), id: 'x' }] }, headers: auth });
    expect(bad.status).toBe(400);
  });

  test('чужие прогоны не видны', async () => {
    const app = makeApp();
    const alice = await signupMobile(app);
    const bob = await signupMobile(app);
    await call(app, 'POST', '/v1/progress/runs', { body: { runs: [makeRun('run-alice-1', '2026-10-15', ['good'])] }, headers: alice.auth });
    const { runs } = (await (await call(app, 'GET', '/v1/progress/runs', { headers: bob.auth })).json()) as { runs: LessonRun[] };
    expect(runs).toEqual([]);
  });
});

describe('лидерборд', () => {
  test('неделя начинается с понедельника', () => {
    expect(weekStart('2026-10-15')).toBe('2026-10-12'); // четверг
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // воскресенье
  });

  test('сумма XP за неделю, прошлые недели не считаются, публично только ник', async () => {
    const app = makeApp();
    const a = await signupMobile(app);
    const b = await signupMobile(app);
    await call(app, 'POST', '/v1/progress/runs', {
      body: { runs: [makeRun('leader-a-week', '2026-10-13', ['good', 'good']), makeRun('leader-a-old', '2026-10-05', ['good', 'good', 'good'])] },
      headers: a.auth,
    });
    await call(app, 'POST', '/v1/progress/runs', { body: { runs: [makeRun('leader-b-week', '2026-10-14', ['good', 'good', 'good'])] }, headers: b.auth });
    const res = (await (await call(app, 'GET', '/v1/leaderboard?today=2026-10-15', { headers: a.auth })).json()) as {
      weekStart: string;
      entries: { nickname: string; xp: number; me: boolean }[];
    };
    expect(res.weekStart).toBe('2026-10-12');
    const mine = res.entries.filter((e) => e.nickname === a.user.nickname || e.nickname === b.user.nickname);
    expect(mine.map((e) => [e.nickname, e.me])).toEqual([
      [b.user.nickname, false],
      [a.user.nickname, true],
    ]);
    expect(JSON.stringify(res)).not.toMatch(/@/); // email не утекает
  });
});

describe('проверка ответов ИИ', () => {
  test('с общим токеном: вошедшему пользователю токен не нужен, чужому — нужен', async () => {
    const app = makeApp('shared-secret');
    const body = { question: 'keys', answer: 'короткий' };
    expect((await call(app, 'POST', '/v1/grade', { body })).status).toBe(401);
    expect((await call(app, 'POST', '/v1/grade', { body, headers: { authorization: 'Bearer shared-secret' } })).status).toBe(200);
    const { auth } = await signupMobile(app);
    expect((await call(app, 'POST', '/v1/grade', { body, headers: auth })).status).toBe(200);
  });
});
