import type { ProgressSnapshot, SavedLesson } from '@/lib/db';
import type { SessionState } from '@rr/core';
import { createContext, use } from 'react';

export interface ProgressContextValue extends ProgressSnapshot {
  ready: boolean;
  save: (session: SessionState, lessonId: string | null) => Promise<SavedLesson>;
  /** Синхронизация с сервером; прогресс перечитывается, если пришли прогоны с других устройств */
  sync: () => Promise<unknown>;
}

export const ProgressContext = createContext<ProgressContextValue | null>(null);

export function useProgress(): ProgressContextValue {
  const ctx = use(ProgressContext);
  if (!ctx) throw new Error('useProgress вне ProgressProvider');
  return ctx;
}
