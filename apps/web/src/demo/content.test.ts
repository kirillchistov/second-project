import { expect, test } from 'vitest';
import { CONTENT, PATH } from './content';
import { lessonItems } from '@rr/core';

test('демо собирает путь из вопросов и упражнений без голоса и ИИ', () => {
  expect(CONTENT.questions.length).toBe(140);
  expect(CONTENT.exercises.length).toBeGreaterThan(0);
  expect(CONTENT.exercises.some((exercise) => exercise.type === 'quiz')).toBe(true);
  expect(PATH.length).toBe(CONTENT.units.length);
  const items = PATH.flatMap((unit) => unit.lessons.flatMap(lessonItems));
  expect(items.length).toBeGreaterThan(PATH.length);
  expect(items.every((item) => item.kind === 'exercise' || item.kind === 'card')).toBe(true);
});
