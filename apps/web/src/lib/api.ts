/**
 * Клиент API (apps/api) для веба: сессия — HttpOnly cookie `rr_session`, выставляет сам сервер.
 * `credentials: 'include'` шлёт её на поддомен api.* того же сайта (SameSite=Lax это разрешает).
 * Ключ Claude и токены для своих тут не нужны — веб входит только через аккаунт.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const TIMEOUT_MS = 15_000;

export type ApiErrorKind = 'offline' | 'unauthorized' | 'rejected' | 'server';

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

export async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('offline', 'Нет связи с сервером.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) throw new ApiError('unauthorized', 'Не удалось войти.', await res.json().catch(() => undefined));
  if (res.status >= 400 && res.status < 500) throw new ApiError('rejected', 'Сервер отклонил запрос.', await res.json().catch(() => undefined));
  if (!res.ok) throw new ApiError('server', 'Сервер не ответил. Попробуй позже.');
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
