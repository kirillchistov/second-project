import { describe, expect, test } from 'vitest';
import { LEGACY } from './legacy';
import { QUESTIONS, questionBySlug } from './questions';
import { TOPICS } from './topics';

describe('контент вопросов', () => {
  test('100 вопросов: 20 junior, 40 middle, 40 senior', () => {
    expect(QUESTIONS).toHaveLength(100);
    const count = (level: string) => QUESTIONS.filter((q) => q.level === level).length;
    expect([count('junior'), count('middle'), count('senior')]).toEqual([20, 40, 40]);
  });

  test('slug уникальны и в формате kebab-case', () => {
    expect(questionBySlug.size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) expect(q.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  test('у каждого вопроса есть тема, краткий ответ, объяснение и ссылки', () => {
    const topics = new Set(TOPICS.map((t) => t.id));
    for (const q of QUESTIONS) {
      expect(topics, q.slug).toContain(q.topic);
      expect(q.short.length, q.slug).toBeGreaterThan(40);
      expect(q.body.length, q.slug).toBeGreaterThan(200);
      expect(q.links.length, q.slug).toBeGreaterThan(0);
      for (const link of q.links) expect(link.href, q.slug).toMatch(/^https:\/\//);
    }
  });

  test('блоки кода закрыты', () => {
    for (const q of QUESTIONS) {
      const fences = q.body.split('\n').filter((l) => l.startsWith('```')).length;
      expect(fences % 2, q.slug).toBe(0);
    }
  });

  test('каждый вопрос из старой версии ведёт на существующий вопрос', () => {
    expect(LEGACY.map((l) => l.number)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    for (const l of LEGACY) expect(questionBySlug.has(l.target), `#${l.number} → ${l.target}`).toBe(true);
  });
});

test('поиск ставит совпадения в заголовке первыми', async () => {
  const { searchQuestions } = await import('./questions');
  expect(searchQuestions('гидрац').slice(0, 2).map((q) => q.slug)).toEqual(['streaming-ssr', 'hydration-mismatch']);
  expect(searchQuestions('42')[0].number).toBe(42);
});
