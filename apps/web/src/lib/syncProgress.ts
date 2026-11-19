import { ApiError, request } from './api';
import { adoptOwner, importRuns, markRunsSynced, progressOwner, unsyncedRuns } from '../demo/progress';
import { setGuest, getAccount } from './session';
import type { LessonRun } from '@rr/core';

let inFlight: Promise<number> | null = null;

/**
 * Досылает прогоны этого браузера и забирает историю аккаунта.
 * Прогресс собирается из прогонов той же функцией, что и в приложении.
 * Без входа ничего не делает: история остаётся в localStorage.
 */
export function syncProgress(): Promise<number> {
  const account = getAccount();
  if (account.status !== 'signed-in') return Promise.resolve(0);
  const userId = account.user.id;
  inFlight ??= (async () => {
    try {
      adoptOwner(userId);
      for (;;) {
        const batch = unsyncedRuns().slice(0, 200);
        if (batch.length === 0) break;
        const { accepted } = await request<{ accepted: string[] }>('POST', '/v1/progress/runs', { runs: batch });
        markRunsSynced(accepted);
        if (accepted.length < batch.length) break;
      }
      const { runs } = await request<{ runs: LessonRun[] }>('GET', '/v1/progress/runs');
      const imported = importRuns(runs);
      if (progressOwner() !== userId) adoptOwner(userId);
      return imported;
    } catch (error) {
      if (error instanceof ApiError && error.kind === 'unauthorized') setGuest();
      return 0;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
