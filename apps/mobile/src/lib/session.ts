import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * Аккаунт на устройстве: токен сессии в Keychain (SecureStore), профиль и время синхронизации — в памяти
 * и в Keychain рядом с токеном. Токен никогда не попадает в SQLite или kv-store.
 */
export interface AccountUser {
  id: string;
  email: string;
  nickname: string;
}

export type AccountState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'signed-in'; user: AccountUser; token: string; syncedAt?: string; syncError?: string };

const TOKEN_KEY = 'session-token';
const USER_KEY = 'session-user';

let state: AccountState = { status: 'loading' };
const listeners = new Set<() => void>();

function emit(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

export function getAccount(): AccountState {
  return state;
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function sessionToken(): string | undefined {
  return state.status === 'signed-in' ? state.token : undefined;
}

/** Вызывается один раз при старте приложения */
export async function loadSession(): Promise<void> {
  try {
    const [token, user] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(USER_KEY)]);
    emit(token && user ? { status: 'signed-in', token, user: JSON.parse(user) as AccountUser } : { status: 'guest' });
  } catch {
    emit({ status: 'guest' });
  }
}

export async function saveSession(token: string, user: AccountUser): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  emit({ status: 'signed-in', token, user });
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
  emit({ status: 'guest' });
}

export function markSynced(result: { at: string } | { error: string }) {
  if (state.status !== 'signed-in') return;
  emit('at' in result ? { ...state, syncedAt: result.at, syncError: undefined } : { ...state, syncError: result.error });
}
