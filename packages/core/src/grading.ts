import type { Outcome } from './srs.ts';

/**
 * Оценка устного ответа по рубрике. Модель только отмечает, какие пункты раскрыты и какие ошибки прозвучали,
 * а балл, вердикт и шаг интервального повторения считает этот код — одинаково при каждой проверке.
 */
export type PointStatus = 'covered' | 'partial' | 'missing';

export interface GradedPoint {
  id: string;
  text: string;
  weight: 1 | 2 | 3;
  status: PointStatus;
}

export type Verdict = 'good' | 'partial' | 'weak';

export interface GradeResult {
  /** 0..100 */
  score: number;
  verdict: Verdict;
  points: GradedPoint[];
  /** Фактические ошибки в ответе */
  errors: string[];
  /** Короткий разбор: что добавить, на что обратить внимание */
  feedback: string;
  /** Вопрос, который задал бы интервьюер следующим */
  followUp: string;
  /** Шаг интервального повторения с учётом подсказок */
  outcome: Outcome;
}

const CREDIT: Record<PointStatus, number> = { covered: 1, partial: 0.5, missing: 0 };

export function scorePoints(points: readonly Pick<GradedPoint, 'weight' | 'status'>[]): number {
  const total = points.reduce((sum, p) => sum + p.weight, 0);
  if (total === 0) return 0;
  const earned = points.reduce((sum, p) => sum + p.weight * CREDIT[p.status], 0);
  return Math.round((earned / total) * 100);
}

/**
 * Вердикт: суть (пункты с весом 3) должна быть раскрыта, а фактическая ошибка не даёт «хорошо»,
 * даже если пунктов набрано много — уверенно сказанная неправда хуже пробела.
 */
export function verdictFor(points: readonly Pick<GradedPoint, 'weight' | 'status'>[], errors: readonly string[]): Verdict {
  const score = scorePoints(points);
  const coreMissing = points.some((p) => p.weight === 3 && p.status === 'missing');
  if (score >= 75 && !coreMissing && errors.length === 0) return 'good';
  if (score >= 40) return 'partial';
  return 'weak';
}

/** Подсказка снижает зачёт: ответ с подсказкой не может считаться уверенным знанием. */
export function outcomeFor(verdict: Verdict, hintsUsed: number): Outcome {
  if (verdict === 'weak') return 'again';
  if (verdict === 'partial' || hintsUsed > 0) return 'hard';
  return 'good';
}

/** Совсем короткий ответ не отправляем модели: это пропуск, а не ответ. */
export const MIN_ANSWER_CHARS = 20;
export const MAX_ANSWER_CHARS = 4000;
