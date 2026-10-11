import type { LessonItem } from './path.ts';
import type { Outcome } from './srs.ts';

/** Как ответили на карточку вопроса: голосом с проверкой ИИ, про себя с самооценкой или выбором варианта. */
export type AnswerMode = 'voice' | 'explain' | 'quiz';

export interface AnswerMeta {
  mode: AnswerMode;
  /** Сколько наводящих подсказок понадобилось */
  hints: number;
}

/**
 * Ход урока как чистый редьюсер: UI только отправляет события и рисует состояние.
 * Ошибка не «отнимает жизнь», а возвращает задание в конец урока — урок не закончится, пока всё не решено.
 */
export interface ItemResult {
  /** Результат первой попытки — именно он идёт в интервальное повторение */
  first: Outcome;
  attempts: number;
  solved: boolean;
  /** Способ и подсказки первой попытки — для метрики «без подсказок» */
  meta?: AnswerMeta;
}

export interface SessionState {
  queue: LessonItem[];
  position: number;
  phase: 'answering' | 'feedback' | 'done';
  /** Результат последнего ответа — для экрана разбора */
  last?: { correct: boolean; outcome: Outcome };
  results: Record<string, ItemResult>;
  /** Сколько раз подряд ответ был верным — для реакций маскота */
  combo: number;
}

export type SessionAction =
  /** Ответ на упражнение или самооценка карточки */
  | { type: 'answer'; outcome: Outcome; meta?: AnswerMeta }
  | { type: 'continue' };

export function startSession(items: LessonItem[]): SessionState {
  return { queue: items, position: 0, phase: items.length ? 'answering' : 'done', results: {}, combo: 0 };
}

export function currentItem(state: SessionState): LessonItem | undefined {
  return state.queue[state.position];
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'answer': {
      const item = currentItem(state);
      if (!item || state.phase !== 'answering') return state;
      const correct = action.outcome !== 'again';
      const prev = state.results[item.id];
      const result: ItemResult = prev
        ? { ...prev, attempts: prev.attempts + 1, solved: correct }
        : { first: action.outcome, attempts: 1, solved: correct, meta: action.meta };
      return {
        ...state,
        phase: 'feedback',
        last: { correct, outcome: action.outcome },
        results: { ...state.results, [item.id]: result },
        // Ошибку повторяем в конце урока
        queue: correct ? state.queue : [...state.queue, item],
        combo: correct ? state.combo + 1 : 0,
      };
    }
    case 'continue': {
      if (state.phase !== 'feedback') return state;
      const position = state.position + 1;
      return {
        ...state,
        position,
        phase: position >= state.queue.length ? 'done' : 'answering',
        last: undefined,
      };
    }
  }
}

/** Доля урока, пройденная к текущему моменту, 0..1 — для полоски прогресса. */
export function sessionProgress(state: SessionState): number {
  const total = new Set(state.queue.map((i) => i.id)).size;
  if (total === 0) return 1;
  const solved = Object.values(state.results).filter((r) => r.solved).length;
  return solved / total;
}

export interface SessionSummary {
  total: number;
  /** Решено с первой попытки */
  firstTry: number;
  accuracy: number;
  perfect: boolean;
  /** id элементов с ошибкой на первой попытке — кандидаты в Bug Backlog */
  mistakes: string[];
}

export function summarize(state: SessionState): SessionSummary {
  const entries = Object.entries(state.results);
  const firstTry = entries.filter(([, r]) => r.first !== 'again').length;
  const total = entries.length;
  return {
    total,
    firstTry,
    accuracy: total ? firstTry / total : 0,
    perfect: total > 0 && firstTry === total,
    mistakes: entries.filter(([, r]) => r.first === 'again').map(([id]) => id),
  };
}
