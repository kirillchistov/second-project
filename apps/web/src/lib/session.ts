import { useSyncExternalStore } from 'react';

/**
 * Аккаунт в браузере: сессия живёт в HttpOnly cookie, здесь — только профиль в памяти.
 * При загрузке статус 'loading', пока не пришёл ответ /v1/me — тогда 'guest' или 'signed-in'.
 */
export interface AccountUser {
  id: string;
  email: string;
  nickname: string;
  role?: 'user' | 'moderator';
}

export type AccountState = { status: 'loading' } | { status: 'guest' } | { status: 'signed-in'; user: AccountUser };

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

export function setSignedIn(user: AccountUser): void {
  emit({ status: 'signed-in', user });
}

export function setGuest(): void {
  emit({ status: 'guest' });
}
