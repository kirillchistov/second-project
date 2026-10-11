import type { GradeResult } from '@rr/core';
import { randomUUID } from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';

/**
 * Клиент ИИ-прокси (apps/api). Ключ Claude живёт только на сервере; приложение знает адрес
 * и общий токен для своих. На симуляторе сервер на этом же Mac доступен как localhost.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
const TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;
const TIMEOUT_MS = 30_000;

export type ApiErrorKind = 'offline' | 'limit' | 'unauthorized' | 'server';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<ApiErrorKind, string> = {
  offline: 'Нет связи с сервером проверки. Можно оценить себя самому.',
  limit: 'Лимит проверок на сегодня исчерпан. Можно оценить себя самому.',
  unauthorized: 'Сервер проверки не принял токен приложения.',
  server: 'Проверка не удалась. Попробуй ещё раз или оцени себя сам.',
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

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-id': deviceId(),
        ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('offline', MESSAGES.offline);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new ApiError('limit', MESSAGES.limit);
  if (res.status === 401) throw new ApiError('unauthorized', MESSAGES.unauthorized);
  if (!res.ok) throw new ApiError('server', MESSAGES.server);
  return (await res.json()) as T;
}

export function gradeAnswer(question: string, answer: string, hints: number): Promise<GradeResult> {
  return post('/v1/grade', { question, answer, hints });
}

export async function askHint(question: string, answer: string, level: number): Promise<string> {
  return (await post<{ hint: string }>('/v1/hint', { question, answer, level })).hint;
}
