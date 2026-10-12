import { useSyncExternalStore } from 'react';
import { getProgress, subscribeProgress } from './progress';

export function useDemoProgress() {
  return useSyncExternalStore(subscribeProgress, getProgress, getProgress);
}
