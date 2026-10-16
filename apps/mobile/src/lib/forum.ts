import { request } from '@/lib/api';

/** Клиент форума (apps/api, /v1/forum). Читать может гость, писать — после входа. */

export interface TopicSummary {
  id: string;
  title: string;
  questionSlug: string | null;
  postsCount: number;
  lastPostAt: string;
  createdAt: string;
  locked: boolean;
  author: string;
}

export interface Post {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  mine: boolean;
}

export interface TopicPage {
  topic: { id: string; title: string; questionSlug: string | null; locked: boolean; createdAt: string; author: string; mine: boolean };
  posts: Post[];
  next: string | null;
}

export function listTopics(opts: { question?: string; cursor?: string | null } = {}): Promise<{ topics: TopicSummary[]; next: string | null }> {
  const query = new URLSearchParams();
  if (opts.question) query.set('question', opts.question);
  if (opts.cursor) query.set('cursor', opts.cursor);
  const qs = query.toString();
  return request('GET', `/v1/forum/topics${qs ? `?${qs}` : ''}`);
}

export function getTopic(id: string, cursor?: string | null): Promise<TopicPage> {
  return request('GET', `/v1/forum/topics/${id}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
}

export async function createTopic(input: { title: string; body: string; questionSlug?: string | null }): Promise<string> {
  return (await request<{ topic: { id: string } }>('POST', '/v1/forum/topics', input)).topic.id;
}

export function replyTo(topicId: string, body: string): Promise<unknown> {
  return request('POST', `/v1/forum/topics/${topicId}/posts`, { body });
}

export function editPost(postId: string, body: string): Promise<unknown> {
  return request('PATCH', `/v1/forum/posts/${postId}`, { body });
}

export function deletePost(postId: string): Promise<unknown> {
  return request('DELETE', `/v1/forum/posts/${postId}`);
}

/** «5 мин назад», «вчера», «12 окт» — для списка тем и сообщений */
export function relativeTime(iso: string, now: Date): string {
  const at = new Date(iso);
  const minutes = Math.round((now.getTime() - at.getTime()) / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  if (hours < 48) return 'вчера';
  return at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
