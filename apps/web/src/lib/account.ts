import { ApiError, request } from './api';
import { setGuest, setSignedIn, type AccountUser } from './session';

/** Регистрация, вход, выход и проверка сессии — тот же аккаунт, что и в мобильном приложении. */

export async function loadSession(): Promise<void> {
  try {
    const { user } = await request<{ user: AccountUser }>('GET', '/v1/me');
    setSignedIn(user);
  } catch {
    setGuest();
  }
}

export async function signUp(input: { email: string; password: string; nickname: string }): Promise<void> {
  const { user } = await request<{ user: AccountUser }>('POST', '/v1/auth/signup', input);
  setSignedIn(user);
}

export async function signIn(input: { email: string; password: string }): Promise<void> {
  const { user } = await request<{ user: AccountUser }>('POST', '/v1/auth/login', input);
  setSignedIn(user);
}

export async function signOut(): Promise<void> {
  await request('POST', '/v1/auth/logout').catch(() => {});
  setGuest();
}

/** Понятное сообщение по ответу сервера */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Что-то пошло не так. Попробуйте ещё раз.';
  const body = error.body as { error?: string; fields?: Record<string, string[]> } | undefined;
  if (body?.fields) return Object.values(body.fields).flat()[0] ?? 'Проверьте поля формы';
  switch (body?.error) {
    case 'email_taken':
      return 'Этот email уже зарегистрирован. Попробуйте войти.';
    case 'nickname_taken':
      return 'Этот ник уже занят.';
    case 'invalid_credentials':
      return 'Неверный email или пароль.';
    case 'too_many_requests':
      return 'Слишком много попыток. Подождите несколько минут.';
    case 'accounts_disabled':
      return 'Аккаунты временно недоступны.';
  }
  if (error.kind === 'offline') return 'Нет связи с сервером.';
  if (error.kind === 'unauthorized') return 'Неверный email или пароль.';
  return 'Сервер не ответил. Попробуйте позже.';
}
