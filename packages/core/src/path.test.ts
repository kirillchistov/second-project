import { UNITS } from '@rr/content';
import { loadExercises, loadQuestions } from '@rr/content/node';
import { describe, expect, test } from 'vitest';
import { buildPath, dueCount, lessonItems, QUESTIONS_PER_LESSON, reviewItems } from './path.ts';
import { review, type StoredCard } from './srs.ts';

const content = { units: UNITS, questions: loadQuestions(), exercises: loadExercises() };
const path = buildPath(content);

describe('путь обучения', () => {
  test('каждый вопрос попадает ровно в один урок', () => {
    const slugs = path.flatMap((u) => u.lessons.flatMap((l) => l.questions.map((q) => q.slug)));
    expect(slugs).toHaveLength(content.questions.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('уроки небольшие, id и хеши уникальны', () => {
    const lessons = path.flatMap((u) => u.lessons);
    for (const l of lessons) expect(l.questions.length).toBeLessThanOrEqual(QUESTIONS_PER_LESSON);
    expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
    expect(new Set(lessons.map((l) => l.hash)).size).toBe(lessons.length);
  });

  test('внутри юнита вопросы идут от junior к senior', () => {
    const rank = { junior: 0, middle: 1, senior: 2 };
    for (const unit of path) {
      const levels = unit.lessons.flatMap((l) => l.questions.map((q) => rank[q.level]));
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
  });

  test('в уроке упражнения идут перед карточкой своего вопроса', () => {
    const lesson = path.flatMap((u) => u.lessons).find((l) => l.exercises.some((e) => e.id === 'hook-after-early-return'))!;
    const ids = lessonItems(lesson).map((i) => i.id);
    expect(ids.indexOf('ex:hook-after-early-return')).toBeLessThan(ids.indexOf('q:rules-of-hooks'));
  });
});

describe('повторение', () => {
  const t0 = new Date('2026-10-01T09:00:00');
  const later = new Date('2026-12-01T09:00:00');

  test('ошибки из backlog идут первыми, затем навыки к повторению, по одному на навык', () => {
    const cards = new Map<string, StoredCard>([
      ['rules-of-hooks', review(undefined, 'good', t0)],
      ['q:jsx', review(undefined, 'good', t0)],
    ]);
    const items = reviewItems({ content, cards, backlog: ['q:keys'], now: later });
    expect(items[0].id).toBe('q:keys');
    // для навыка с упражнением берём упражнение, а не карточку
    expect(items.slice(1).map((i) => i.id).sort()).toEqual(['ex:hook-after-early-return', 'q:jsx']);
    expect(dueCount(cards, later)).toBe(2);
    expect(dueCount(cards, t0)).toBe(0);
  });

  test('неизвестные id в backlog пропускаются', () => {
    expect(reviewItems({ content, cards: new Map(), backlog: ['ex:deleted'], now: t0 })).toEqual([]);
  });
});
