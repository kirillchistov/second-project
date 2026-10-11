import type { ProgressSnapshot, SavedLesson } from '@/lib/db';
import type { SessionState } from '@rr/core';
import { createContext, use } from 'react';

export interface ProgressContextValue extends ProgressSnapshot {
  ready: boolean;
  save: (session: SessionState, lessonId: string | null) => Promise<SavedLesson>;
}

export const ProgressContext = createContext<ProgressContextValue | null>(null);

export function useProgress(): ProgressContextValue {
  const ctx = use(ProgressContext);
  if (!ctx) throw new Error('useProgress вне ProgressProvider');
  return ctx;
}
