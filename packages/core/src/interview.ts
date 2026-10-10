import type { Level, Question, TopicId } from '@rr/content';
import { shuffle } from './random.ts';

export type InterviewFormat = 'short' | 'full';

export const INTERVIEW_FORMATS: Record<InterviewFormat, { title: string; questions: number; minutes: number }> = {
  short: { title: 'Скрининг', questions: 8, minutes: 30 },
  full: { title: 'Техническое интервью', questions: 12, minutes: 45 },
};

/** Доля вопросов каждого уровня в собеседовании на грейд. */
const MIX: Record<Level, Record<Level, number>> = {
  junior: { junior: 0.75, middle: 0.25, senior: 0 },
  middle: { junior: 0.25, middle: 0.6, senior: 0.15 },
  senior: { junior: 0, middle: 0.4, senior: 0.6 },
};

const LEVEL_ORDER: Level[] = ['junior', 'middle', 'senior'];

/**
 * Подбирает вопросы под грейд: нужная пропорция уровней, как можно больше разных тем,
 * порядок — от простых к сложным, как на настоящем интервью.
 */
export function pickInterviewQuestions(pool: readonly Question[], level: Level, total: number): Question[] {
  const quotas = LEVEL_ORDER.map((l) => ({ level: l, count: Math.round(MIX[level][l] * total) }));
  // Округление может дать ±1 — подгоняем за счёт основного уровня
  const diff = total - quotas.reduce((sum, q) => sum + q.count, 0);
  quotas.find((q) => q.level === level)!.count += diff;

  const usedTopics = new Set<TopicId>();
  const picked: Question[] = [];

  for (const { level: l, count } of quotas) {
    const candidates = shuffle(pool.filter((q) => q.level === l));
    for (let i = 0; i < count && candidates.length > 0; i++) {
      const freshIndex = candidates.findIndex((q) => !usedTopics.has(q.topic));
      const [chosen] = candidates.splice(freshIndex === -1 ? 0 : freshIndex, 1);
      usedTopics.add(chosen.topic);
      picked.push(chosen);
    }
  }

  return picked;
}

export type Score = 0 | 1 | 2;

export const SCORE_LABELS: Record<Score, { label: string; hint: string }> = {
  0: { label: 'Не ответил', hint: 'Не знал или ответил неверно' },
  1: { label: 'Частично', hint: 'Суть верная, но без деталей или с ошибками' },
  2: { label: 'Уверенно', hint: 'Полный ответ, примеры, нюансы' },
};

export function verdict(percent: number, level: Level): { title: string; text: string; tone: 'good' | 'mid' | 'low' } {
  const grade = { junior: 'Junior', middle: 'Middle', senior: 'Senior' }[level];
  if (percent >= 80) {
    return { tone: 'good', title: `Уверенный ${grade}`, text: 'Вы закрываете большинство вопросов грейда. Отполируйте слабые темы и тренируйте подачу ответа.' };
  }
  if (percent >= 55) {
    return { tone: 'mid', title: `Близко к ${grade}`, text: 'База есть, но часть ответов неполная. Разберите вопросы с оценкой «Частично» и вернитесь к собеседованию.' };
  }
  return { tone: 'low', title: 'Пока рано', text: 'Начните с тренировки по слабым темам: прочитайте разборы, затем попробуйте ещё раз.' };
}
