import { PGlite } from '@electric-sql/pglite';
import type { Question } from '@rr/content';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeAll, describe, expect, test } from 'vitest';
import { createApp } from './app.ts';
import { MIGRATIONS_DIR, schema, type Db } from './db/index.ts';
import { users } from './db/schema.ts';
import type { Examiner } from './examiner.ts';

const ORIGIN = 'https://refresher.example';
let db: Db;
let clock = new Date('2026-10-15T10:00:00.000Z');
const tick = (seconds = 15) => (clock = new Date(clock.getTime() + seconds * 1000));

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: MIGRATIONS_DIR });
  db = pg as unknown as Db;
});

const examiner = { grade: async () => ({}), hint: async () => '' } as unknown as Examiner;
const questions = [{ slug: 'keys', title: 'Зачем нужен key?' }] as Question[];
const makeApp = () => createApp({ questions, rubrics: [], examiner, db, allowedOrigins: [ORIGIN], now: () => clock });
type App = ReturnType<typeof makeApp>;

function call(app: App, method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  return app.request(path, {
    method,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    headers: { 'content-type': 'application/json', ...opts.headers },
  });
}

let seq = 0;
async function member(app: App, role: 'user' | 'moderator' = 'user') {
  seq++;
  const res = await call(app, 'POST', '/v1/auth/signup', {
    body: { email: `forum${seq}@example.com`, password: 'correct horse battery', nickname: `forum_${seq}` },
    headers: { 'x-auth-mode': 'token' },
  });
  const { token, user } = (await res.json()) as { token: string; user: { id: string; nickname: string } };
  if (role === 'moderator') await db.update(users).set({ role: 'moderator' }).where(eq(users.id, user.id));
  return { user, auth: { authorization: `Bearer ${token}` } };
}

interface TopicPage {
  topic: { id: string; title: string; locked: boolean; mine: boolean; questionSlug: string | null };
  posts: { id: string; body: string; deleted: boolean; mine: boolean; author: string; editedAt: string | null }[];
  next: string | null;
}

async function createTopic(app: App, auth: Record<string, string>, body: Record<string, unknown> = {}) {
  tick();
  const res = await call(app, 'POST', '/v1/forum/topics', {
    body: { title: 'Почему index как key — плохо?', body: 'Объясните на примере', ...body },
    headers: auth,
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { topic: { id: string } }).topic.id;
}

async function reply(app: App, auth: Record<string, string>, topicId: string, body = 'Потому что состояние съезжает') {
  tick();
  return call(app, 'POST', `/v1/forum/topics/${topicId}/posts`, { body: { body }, headers: auth });
}

const readTopic = async (app: App, id: string, headers: Record<string, string> = {}, query = '') =>
  (await (await call(app, 'GET', `/v1/forum/topics/${id}${query}`, { headers })).json()) as TopicPage;

describe('форум', () => {
  test('гость читает, но не пишет', async () => {
    const app = makeApp();
    const alice = await member(app);
    const id = await createTopic(app, alice.auth, { questionSlug: 'keys' });

    const list = (await (await call(app, 'GET', '/v1/forum/topics?question=keys')).json()) as { topics: { id: string; author: string; postsCount: number }[] };
    expect(list.topics.find((t) => t.id === id)).toMatchObject({ author: alice.user.nickname, postsCount: 1 });

    const page = await readTopic(app, id);
    expect(page.posts.map((p) => [p.body, p.mine])).toEqual([['Объясните на примере', false]]);
    expect((await call(app, 'POST', `/v1/forum/topics/${id}/posts`, { body: { body: 'привет' } })).status).toBe(401);
    expect((await call(app, 'POST', '/v1/forum/topics', { body: { title: 'Новая тема', body: 'текст' } })).status).toBe(401);
  });

  test('ответ поднимает тему наверх и увеличивает счётчик', async () => {
    const app = makeApp();
    const alice = await member(app);
    const bob = await member(app);
    const first = await createTopic(app, alice.auth, { title: 'Первая тема форума' });
    const second = await createTopic(app, alice.auth, { title: 'Вторая тема форума' });
    expect((await reply(app, bob.auth, first)).status).toBe(201);

    const { topics } = (await (await call(app, 'GET', '/v1/forum/topics')).json()) as { topics: { id: string; postsCount: number }[] };
    const ours = topics.filter((t) => t.id === first || t.id === second);
    expect(ours.map((t) => [t.id, t.postsCount])).toEqual([
      [first, 2],
      [second, 1],
    ]);
  });

  test('валидация: короткий заголовок, пустое сообщение, неизвестный вопрос, управляющие символы', async () => {
    const app = makeApp();
    const alice = await member(app);
    const bad = await call(app, 'POST', '/v1/forum/topics', { body: { title: 'Хм', body: '   ' }, headers: alice.auth });
    expect(bad.status).toBe(400);
    expect(Object.keys(((await bad.json()) as { fields: object }).fields).sort()).toEqual(['body', 'title']);
    const unknown = await call(app, 'POST', '/v1/forum/topics', { body: { title: 'Тема про что-то', body: 'текст', questionSlug: 'nope' }, headers: alice.auth });
    expect(unknown.status).toBe(400);

    const id = await createTopic(app, alice.auth, { body: 'строка\u0007\n\n\n\nещё строка' });
    expect((await readTopic(app, id)).posts[0].body).toBe('строка\n\nещё строка');
  });

  test('правка и удаление: своё — можно, чужое — нет; удалённое остаётся в нити без текста', async () => {
    const app = makeApp();
    const alice = await member(app);
    const bob = await member(app);
    const id = await createTopic(app, alice.auth);
    await reply(app, bob.auth, id, 'ответ Боба');
    const postId = (await readTopic(app, id, bob.auth)).posts[1].id;

    expect((await call(app, 'PATCH', `/v1/forum/posts/${postId}`, { body: { body: 'взлом' }, headers: alice.auth })).status).toBe(403);
    expect((await call(app, 'PATCH', `/v1/forum/posts/${postId}`, { body: { body: 'ответ Боба, исправленный' }, headers: bob.auth })).status).toBe(204);
    expect((await call(app, 'DELETE', `/v1/forum/posts/${postId}`, { headers: alice.auth })).status).toBe(403);
    expect((await call(app, 'DELETE', `/v1/forum/posts/${postId}`, { headers: bob.auth })).status).toBe(204);

    const page = await readTopic(app, id, alice.auth);
    expect(page.posts.map((p) => [p.body, p.deleted, p.mine])).toEqual([
      ['Объясните на примере', false, true],
      ['', true, false],
    ]);
    const { topics } = (await (await call(app, 'GET', '/v1/forum/topics')).json()) as { topics: { id: string; postsCount: number }[] };
    expect(topics.find((t) => t.id === id)?.postsCount).toBe(1);
  });

  test('тему с чужими ответами автор не удалит, модератор — удалит', async () => {
    const app = makeApp();
    const alice = await member(app);
    const bob = await member(app);
    const mod = await member(app, 'moderator');
    const id = await createTopic(app, alice.auth);
    await reply(app, bob.auth, id);
    expect((await call(app, 'DELETE', `/v1/forum/topics/${id}`, { headers: alice.auth })).status).toBe(409);
    expect((await call(app, 'DELETE', `/v1/forum/topics/${id}`, { headers: mod.auth })).status).toBe(204);
    expect((await call(app, 'GET', `/v1/forum/topics/${id}`)).status).toBe(404);

    const lonely = await createTopic(app, alice.auth);
    expect((await call(app, 'DELETE', `/v1/forum/topics/${lonely}`, { headers: alice.auth })).status).toBe(204);
  });

  test('закрытая тема: пишет только модератор; закрывать может только модератор', async () => {
    const app = makeApp();
    const alice = await member(app);
    const mod = await member(app, 'moderator');
    const id = await createTopic(app, alice.auth);
    expect((await call(app, 'POST', `/v1/forum/topics/${id}/lock`, { body: { locked: true }, headers: alice.auth })).status).toBe(403);
    expect((await call(app, 'POST', `/v1/forum/topics/${id}/lock`, { body: { locked: true }, headers: mod.auth })).status).toBe(204);
    expect((await reply(app, alice.auth, id)).status).toBe(423);
    expect((await reply(app, mod.auth, id, 'Тема закрыта, ответ в FAQ')).status).toBe(201);
    expect((await readTopic(app, id)).topic.locked).toBe(true);
  });

  test('сообщения листаются страницами по 20 без потерь', async () => {
    const app = makeApp();
    const alice = await member(app);
    const id = await createTopic(app, alice.auth);
    for (let i = 1; i <= 24; i++) expect((await reply(app, alice.auth, id, `ответ ${i}`)).status).toBe(201);

    const first = await readTopic(app, id);
    expect(first.posts).toHaveLength(20);
    expect(first.next).not.toBeNull();
    const second = await readTopic(app, id, {}, `?cursor=${first.next}`);
    expect(second.posts.map((p) => p.body)).toEqual(['ответ 20', 'ответ 21', 'ответ 22', 'ответ 23', 'ответ 24']);
    expect(second.next).toBeNull();
  });

  test('лимит частоты сообщений', async () => {
    const app = makeApp();
    const alice = await member(app);
    const id = await createTopic(app, alice.auth);
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await call(app, 'POST', `/v1/forum/topics/${id}/posts`, { body: { body: `спам ${i}` }, headers: alice.auth });
      statuses.push(res.status);
    }
    expect(statuses.filter((s) => s === 429).length).toBe(2);
  });

  test('CSRF: cookie-запрос с чужого сайта отклоняется', async () => {
    const app = makeApp();
    const res = await call(app, 'POST', '/v1/auth/signup', {
      body: { email: 'csrf-forum@example.com', password: 'correct horse battery', nickname: 'csrf_forum' },
      headers: { origin: ORIGIN },
    });
    const cookie = res.headers.get('set-cookie')!.split(';')[0];
    const evil = await call(app, 'POST', '/v1/forum/topics', {
      body: { title: 'Подменённая тема', body: 'текст' },
      headers: { cookie, origin: 'https://evil.example' },
    });
    expect(evil.status).toBe(403);
  });
});
