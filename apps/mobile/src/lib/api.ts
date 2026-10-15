import { sessionToken } from '@/lib/session';
import type { GradeResult } from '@rr/core';
import { randomUUID } from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';

/**
 * Клиент API (apps/api): проверка ответов ИИ, аккаунт, синхронизация, лидерборд.
 * Ключ Claude живёт только на сервере. Авторизация — токен сессии пользователя, а без входа —
 * общий токен для своих. На симуляторе сервер на этом же Mac доступен как localhost.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
const TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;
const TIMEOUT_MS = 30_000;

export type ApiErrorKind = 'offline' | 'limit' | 'unauthorized' | 'server' | 'rejected';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** Тело ответа с ошибкой — например, { error: 'email_taken' } или поля валидации */
  readonly body?: unknown;
  constructor(kind: ApiErrorKind, message: string, body?: unknown) {
    super(message);
    this.kind = kind;
    this.body = body;
  }
}

const MESSAGES: Record<ApiErrorKind, string> = {
  offline: 'Нет связи с сервером проверки. Можно оценить себя самому.',
  limit: 'Лимит проверок на сегодня исчерпан. Можно оценить себя самому.',
  unauthorized: 'Сервер проверки не принял токен приложения.',
  server: 'Проверка не удалась. Попробуй ещё раз или оцени себя сам.',
  rejected: 'Сервер отклонил запрос.',
};

/** Анонимный id устройства — только для дневной квоты на сервере. */
function deviceId(): string {
  let id = Storage.getItemSync('device-id');
  if (!id) {
    id = randomUUID();
    Storage.setItemSync('device-id', id);
  }
  return id;
}

export async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const auth = sessionToken() ?? TOKEN;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-device-id': deviceId(),
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('offline', MESSAGES.offline);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new ApiError('limit', MESSAGES.limit, await res.json().catch(() => undefined));
  if (res.status === 401) throw new ApiError('unauthorized', MESSAGES.unauthorized, await res.json().catch(() => undefined));
  if (res.status >= 400 && res.status < 500) throw new ApiError('rejected', MESSAGES.rejected, await res.json().catch(() => undefined));
  if (!res.ok) throw new ApiError('server', MESSAGES.server);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const post = <T,>(path: string, body: unknown) => request<T>('POST', path, body);

export function gradeAnswer(question: string, answer: string, hints: number): Promise<GradeResult> {
  return post('/v1/grade', { question, answer, hints });
}

export async function askHint(question: string, answer: string, level: number): Promise<string> {
  return (await post<{ hint: string }>('/v1/hint', { question, answer, level })).hint;
}
