import { describe, expect, test } from 'vitest';
import { loadQuestions } from '@rr/content/node';
import { pickInterviewQuestions, verdict } from './interview.ts';

const QUESTIONS = loadQuestions();

describe('pickInterviewQuestions', () => {
  test.each(['junior', 'middle', 'senior'] as const)('%s: нужное число уникальных вопросов', (level) => {
    for (const total of [8, 12]) {
      const picked = pickInterviewQuestions(QUESTIONS, level, total);
      expect(picked).toHaveLength(total);
      expect(new Set(picked.map((q) => q.slug)).size).toBe(total);
    }
  });

  test('senior не получает junior-вопросов, вопросы идут от простых к сложным', () => {
    const picked = pickInterviewQuestions(QUESTIONS, 'senior', 12);
    expect(picked.some((q) => q.level === 'junior')).toBe(false);
    const order = picked.map((q) => q.level);
    expect(order.indexOf('senior')).toBeGreaterThan(order.lastIndexOf('middle'));
  });

  test('темы разнообразны', () => {
    const picked = pickInterviewQuestions(QUESTIONS, 'middle', 8);
    expect(new Set(picked.map((q) => q.topic)).size).toBeGreaterThanOrEqual(6);
  });
});

test('verdict по порогам', () => {
  expect(verdict(85, 'middle').tone).toBe('good');
  expect(verdict(60, 'middle').tone).toBe('mid');
  expect(verdict(30, 'middle').tone).toBe('low');
});
