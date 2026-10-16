/**
 * Форум игроков: темы (можно привязать к вопросу банка) и сообщения.
 *
 * Читать может любой, писать — только вошедший пользователь. Автор правит и удаляет свои сообщения,
 * модератор удаляет любые и закрывает темы. Удаление мягкое: запись остаётся, текст скрывается.
 * Текст хранится как исходный Markdown; клиенты показывают его как текст (без вставки HTML), поэтому XSS исключён.
 */
import { and, desc, eq, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { csrfGuard, RateLimiter, type AuthEnv, type SessionUser } from './accounts.ts';
import type { Db } from './db/index.ts';
import { forumPosts, forumTopics, users } from './db/schema.ts';

export interface ForumOptions {
  db: Db;
  allowedOrigins: readonly string[];
  /** Вопросы банка, к которым можно привязать тему */
  questionSlugs: ReadonlySet<string>;
  now: () => Date;
}

export const PAGE_SIZE = 20;

/** Убираем управляющие символы и лишние пустые строки — остальное хранится как написал автор */
function cleanText(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const title = z.string().transform(cleanText).pipe(z.string().min(5, 'Заголовок — от 5 символов').max(120, 'Заголовок — до 120 символов'));
const body = z.string().transform(cleanText).pipe(z.string().min(1, 'Сообщение пустое').max(5000, 'Сообщение — до 5000 символов'));

const topicBody = z.object({ title, body, questionSlug: z.string().max(100).nullish() });
const postBody = z.object({ body });
const lockBody = z.object({ locked: z.boolean() });

/** Курсор пагинации: время + id, чтобы записи с одинаковым временем не терялись между страницами */
function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string | undefined): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const date = new Date(at);
  return id && !Number.isNaN(date.getTime()) ? { at: date, id } : null;
}

function requireUser(c: Context<AuthEnv>): SessionUser | Response {
  return c.get('user') ?? c.json({ error: 'unauthorized' }, 401);
}

export function forumRoutes(opts: ForumOptions) {
  const { db, now } = opts;
  const app = new Hono<AuthEnv>();
  const postLimit = new RateLimiter(6, 60 * 1000);
  const topicLimit = new RateLimiter(3, 10 * 60 * 1000);

  app.use('*', csrfGuard(opts.allowedOrigins));

  /** Список тем: свежие обсуждения сверху; ?question=slug — темы по вопросу */
  app.get('/topics', async (c) => {
    const cursor = decodeCursor(c.req.query('cursor'));
    const question = c.req.query('question');
    const where: SQL[] = [isNull(forumTopics.deletedAt)];
    if (question) where.push(eq(forumTopics.questionSlug, question));
    if (cursor) {
      where.push(or(lt(forumTopics.lastPostAt, cursor.at), and(eq(forumTopics.lastPostAt, cursor.at), lt(forumTopics.id, cursor.id)))!);
    }
    const rows = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        questionSlug: forumTopics.questionSlug,
        postsCount: forumTopics.postsCount,
        lastPostAt: forumTopics.lastPostAt,
        createdAt: forumTopics.createdAt,
        locked: forumTopics.locked,
        author: users.nickname,
      })
      .from(forumTopics)
      .innerJoin(users, eq(users.id, forumTopics.authorId))
      .where(and(...where))
      .orderBy(desc(forumTopics.lastPostAt), desc(forumTopics.id))
      .limit(PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    const last = page.at(-1);
    return c.json({
      topics: page,
      next: rows.length > PAGE_SIZE && last ? encodeCursor(last.lastPostAt, last.id) : null,
    });
  });

  app.post('/topics', async (c) => {
    const user = requireUser(c);
    if (user instanceof Response) return user;
    const parsed = topicBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request', fields: z.flattenError(parsed.error).fieldErrors }, 400);
    const { questionSlug } = parsed.data;
    if (questionSlug && !opts.questionSlugs.has(questionSlug)) return c.json({ error: 'unknown_question' }, 400);
    if (!topicLimit.take(user.id, now().getTime())) return c.json({ error: 'too_many_requests' }, 429);

    const at = now();
    const topic = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(forumTopics)
        .values({ authorId: user.id, title: parsed.data.title, questionSlug: questionSlug ?? null, postsCount: 1, lastPostAt: at, createdAt: at })
        .returning({ id: forumTopics.id });
      await tx.insert(forumPosts).values({ topicId: created.id, authorId: user.id, body: parsed.data.body, createdAt: at });
      return created;
    });
    return c.json({ topic }, 201);
  });

  /** Тема и её сообщения по порядку; ?cursor= — следующая страница сообщений */
  app.get('/topics/:id', async (c) => {
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const [topic] = await db
      .select({
        id: forumTopics.id,
        title: forumTopics.title,
        questionSlug: forumTopics.questionSlug,
        locked: forumTopics.locked,
        createdAt: forumTopics.createdAt,
        authorId: forumTopics.authorId,
        author: users.nickname,
      })
      .from(forumTopics)
      .innerJoin(users, eq(users.id, forumTopics.authorId))
      .where(and(eq(forumTopics.id, id), isNull(forumTopics.deletedAt)))
      .limit(1);
    if (!topic) return c.json({ error: 'not_found' }, 404);

    const cursor = decodeCursor(c.req.query('cursor'));
    const where: SQL[] = [eq(forumPosts.topicId, id)];
    if (cursor) {
      where.push(or(sql`${forumPosts.createdAt} > ${cursor.at}`, and(eq(forumPosts.createdAt, cursor.at), sql`${forumPosts.id} > ${cursor.id}`))!);
    }
    const rows = await db
      .select({
        id: forumPosts.id,
        body: forumPosts.body,
        createdAt: forumPosts.createdAt,
        editedAt: forumPosts.editedAt,
        deletedAt: forumPosts.deletedAt,
        authorId: forumPosts.authorId,
        author: users.nickname,
      })
      .from(forumPosts)
      .innerJoin(users, eq(users.id, forumPosts.authorId))
      .where(and(...where))
      .orderBy(forumPosts.createdAt, forumPosts.id)
      .limit(PAGE_SIZE + 1);

    const me = c.get('user');
    const page = rows.slice(0, PAGE_SIZE);
    const last = page.at(-1);
    const { authorId, ...publicTopic } = topic;
    return c.json({
      topic: { ...publicTopic, mine: authorId === me?.id },
      // Удалённое сообщение остаётся в ленте, чтобы не ломать нить разговора, но без текста
      posts: page.map(({ authorId: postAuthor, deletedAt, ...p }) => ({
        ...p,
        body: deletedAt ? '' : p.body,
        deleted: deletedAt !== null,
        mine: postAuthor === me?.id,
      })),
      next: rows.length > PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
    });
  });

  app.post('/topics/:id/posts', async (c) => {
    const user = requireUser(c);
    if (user instanceof Response) return user;
    const parsed = postBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request', fields: z.flattenError(parsed.error).fieldErrors }, 400);
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    if (!postLimit.take(user.id, now().getTime())) return c.json({ error: 'too_many_requests' }, 429);

    const at = now();
    const result = await db.transaction(async (tx) => {
      const [topic] = await tx
        .select({ locked: forumTopics.locked })
        .from(forumTopics)
        .where(and(eq(forumTopics.id, id), isNull(forumTopics.deletedAt)))
        .for('update')
        .limit(1);
      if (!topic) return 'not_found' as const;
      if (topic.locked && user.role !== 'moderator') return 'locked' as const;
      const [post] = await tx
        .insert(forumPosts)
        .values({ topicId: id, authorId: user.id, body: parsed.data.body, createdAt: at })
        .returning({ id: forumPosts.id });
      await tx
        .update(forumTopics)
        .set({ postsCount: sql`${forumTopics.postsCount} + 1`, lastPostAt: at })
        .where(eq(forumTopics.id, id));
      return post;
    });
    if (result === 'not_found') return c.json({ error: 'not_found' }, 404);
    if (result === 'locked') return c.json({ error: 'topic_locked' }, 423);
    return c.json({ post: result }, 201);
  });

  /** Правка — только автор, и только пока сообщение не удалено */
  app.patch('/posts/:id', async (c) => {
    const user = requireUser(c);
    if (user instanceof Response) return user;
    const parsed = postBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request', fields: z.flattenError(parsed.error).fieldErrors }, 400);
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const [post] = await db.select().from(forumPosts).where(and(eq(forumPosts.id, id), isNull(forumPosts.deletedAt))).limit(1);
    if (!post) return c.json({ error: 'not_found' }, 404);
    if (post.authorId !== user.id) return c.json({ error: 'forbidden' }, 403);
    await db.update(forumPosts).set({ body: parsed.data.body, editedAt: now() }).where(eq(forumPosts.id, id));
    return c.body(null, 204);
  });

  /** Удаление сообщения — автор или модератор; счётчик темы уменьшается */
  app.delete('/posts/:id', async (c) => {
    const user = requireUser(c);
    if (user instanceof Response) return user;
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const [post] = await db.select().from(forumPosts).where(and(eq(forumPosts.id, id), isNull(forumPosts.deletedAt))).limit(1);
    if (!post) return c.json({ error: 'not_found' }, 404);
    if (post.authorId !== user.id && user.role !== 'moderator') return c.json({ error: 'forbidden' }, 403);
    await db.transaction(async (tx) => {
      await tx.update(forumPosts).set({ deletedAt: now() }).where(eq(forumPosts.id, id));
      await tx
        .update(forumTopics)
        .set({ postsCount: sql`greatest(${forumTopics.postsCount} - 1, 0)` })
        .where(eq(forumTopics.id, post.topicId));
    });
    return c.body(null, 204);
  });

  /** Удаление темы — автор (пока ему никто не ответил) или модератор */
  app.delete('/topics/:id', async (c) => {
    const user = requireUser(c);
    if (user instanceof Response) return user;
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const [topic] = await db.select().from(forumTopics).where(and(eq(forumTopics.id, id), isNull(forumTopics.deletedAt))).limit(1);
    if (!topic) return c.json({ error: 'not_found' }, 404);
    if (user.role !== 'moderator') {
      if (topic.authorId !== user.id) return c.json({ error: 'forbidden' }, 403);
      const [others] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(forumPosts)
        .where(and(eq(forumPosts.topicId, id), isNull(forumPosts.deletedAt), sql`${forumPosts.authorId} <> ${user.id}`));
      // Чужие ответы — часть разговора: удалить тему с ними может только модератор
      if (others.n > 0) return c.json({ error: 'has_replies' }, 409);
    }
    await db.update(forumTopics).set({ deletedAt: now() }).where(eq(forumTopics.id, id));
    return c.body(null, 204);
  });

  app.post('/topics/:id/lock', async (c) => {
    const user = requireUser(c);
    if (user instanceof Response) return user;
    if (user.role !== 'moderator') return c.json({ error: 'forbidden' }, 403);
    const parsed = lockBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request' }, 400);
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success) return c.json({ error: 'not_found' }, 404);
    const updated = await db
      .update(forumTopics)
      .set({ locked: parsed.data.locked })
      .where(and(eq(forumTopics.id, id), isNull(forumTopics.deletedAt)))
      .returning({ id: forumTopics.id });
    return updated.length ? c.body(null, 204) : c.json({ error: 'not_found' }, 404);
  });

  return app;
}
