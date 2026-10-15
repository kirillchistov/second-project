import { ApiError, request } from '@/lib/api';
import { getDatabase } from '@/lib/db';
import { importRuns, markSynced as markRunsSynced, rebuildFromRuns, resetLocalProgress, unsyncedRuns } from '@/lib/runs';
import Storage from 'expo-sqlite/kv-store';
import { clearSession, getAccount, markSynced, saveSession, type AccountUser } from '@/lib/session';
import type { LessonRun } from '@rr/core';

/** Регистрация, вход, выход и синхронизация прогонов с сервером. */

type AuthResponse = { user: AccountUser; token: string };

/** Чей прогресс лежит на устройстве: id аккаунта, с которым он уже синхронизирован */
const OWNER_KEY = 'progress-owner';

/**
 * Вход в другой аккаунт на этом устройстве: прогресс прежнего владельца уже на сервере,
 * смешивать его с чужим нельзя — очищаем. Прогресс гостя (владельца ещё нет) объединяется с аккаунтом.
 */
async function adoptDevice(res: AuthResponse): Promise<void> {
  const owner = Storage.getItemSync(OWNER_KEY);
  if (owner && owner !== res.user.id) {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync((txn) => resetLocalProgress(txn));
  }
  await saveSession(res.token, res.user);
}

/** Понятное сообщение по ответу сервера */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Что-то пошло не так. Попробуй ещё раз.';
  const body = error.body as { error?: string; fields?: Record<string, string[]> } | undefined;
  if (body?.fields) return Object.values(body.fields).flat()[0] ?? 'Проверь поля формы';
  switch (body?.error) {
    case 'email_taken':
      return 'Этот email уже зарегистрирован. Попробуй войти.';
    case 'nickname_taken':
      return 'Этот ник уже занят.';
    case 'invalid_credentials':
      return 'Неверный email или пароль.';
    case 'too_many_requests':
      return 'Слишком много попыток. Подожди несколько минут.';
  }
  if (error.kind === 'offline') return 'Нет связи с сервером.';
  if (error.kind === 'unauthorized') return 'Неверный email или пароль.';
  return 'Сервер не ответил. Попробуй позже.';
}

export async function signUp(input: { email: string; password: string; nickname: string }): Promise<void> {
  const res = await request<AuthResponse>('POST', '/v1/auth/signup', input, { 'x-auth-mode': 'token' });
  await adoptDevice(res);
}

export async function signIn(input: { email: string; password: string }): Promise<void> {
  const res = await request<AuthResponse>('POST', '/v1/auth/login', input, { 'x-auth-mode': 'token' });
  await adoptDevice(res);
}

export async function signOut(): Promise<void> {
  // Сессию на сервере отзываем, но выйти локально нужно и без сети
  await request('POST', '/v1/auth/logout').catch(() => {});
  await clearSession();
}

let inFlight: Promise<number> | null = null;

/**
 * Синхронизация: досылаем свои прогоны, забираем историю с сервера и, если пришли прогоны
 * с другого устройства, пересобираем прогресс. Возвращает число новых прогонов с сервера.
 * Параллельные вызовы склеиваются в один.
 */
export function syncProgress(): Promise<number> {
  if (getAccount().status !== 'signed-in') return Promise.resolve(0);
  inFlight ??= (async () => {
    try {
      const db = await getDatabase();
      for (;;) {
        const batch = await unsyncedRuns(db);
        if (batch.length === 0) break;
        const { accepted } = await request<{ accepted: string[] }>('POST', '/v1/progress/runs', { runs: batch });
        await markRunsSynced(db, accepted);
        if (accepted.length < batch.length) break;
      }
      const { runs } = await request<{ runs: LessonRun[] }>('GET', '/v1/progress/runs');
      let imported = 0;
      await db.withExclusiveTransactionAsync(async (txn) => {
        imported = await importRuns(txn, runs);
        if (imported > 0) await rebuildFromRuns(txn);
      });
      const account = getAccount();
      if (account.status === 'signed-in') Storage.setItemSync(OWNER_KEY, account.user.id);
      markSynced({ at: new Date().toISOString() });
      return imported;
    } catch (error) {
      // Сессию отозвали или она истекла — выходим, прогресс на устройстве остаётся
      if (error instanceof ApiError && error.kind === 'unauthorized') await clearSession();
      else markSynced({ error: error instanceof ApiError ? error.message : 'Не удалось синхронизировать' });
      return 0;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  xp: number;
  me: boolean;
}

export function fetchLeaderboard(today: string): Promise<{ weekStart: string; entries: LeaderboardEntry[] }> {
  return request('GET', `/v1/leaderboard?today=${today}`);
}
