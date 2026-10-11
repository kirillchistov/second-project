import { loadExercises } from '@rr/content/node';
import { describe, expect, test } from 'vitest';
import { checkAnswer, correctAnswerText } from './check.ts';

const byId = new Map(loadExercises().map((e) => [e.id, e]));
const get = (id: string) => {
  const ex = byId.get(id);
  if (!ex) throw new Error(`нет упражнения ${id}`);
  return ex;
};

describe('проверка ответов', () => {
  test('выбор варианта', () => {
    expect(checkAnswer(get('effect-cleanup-order'), { kind: 'choice', index: 0 })).toBe(true);
    expect(checkAnswer(get('effect-cleanup-order'), { kind: 'choice', index: 1 })).toBe(false);
  });

  test('баг: засчитывается любая отмеченная строка, но причина должна быть верной', () => {
    const ex = get('hook-after-early-return');
    expect(checkAnswer(ex, { kind: 'bug', line: 2, cause: 0 })).toBe(true);
    expect(checkAnswer(ex, { kind: 'bug', line: 3, cause: 0 })).toBe(true);
    expect(checkAnswer(ex, { kind: 'bug', line: 4, cause: 0 })).toBe(false);
    expect(checkAnswer(ex, { kind: 'bug', line: 3, cause: 1 })).toBe(false);
  });

  test('токены — по порядку пропусков', () => {
    const ex = get('abort-stale-request');
    expect(checkAnswer(ex, { kind: 'tokens', tokens: ['AbortController', 'signal', 'abort', 'userId'] })).toBe(true);
    expect(checkAnswer(ex, { kind: 'tokens', tokens: ['AbortController', 'abort', 'signal', 'userId'] })).toBe(false);
  });

  test('последовательность: порядок важен, ловушки не засчитываются', () => {
    const ex = get('build-use-debounced-value');
    if (ex.type !== 'parsons') throw new Error('ожидался parsons');
    expect(checkAnswer(ex, { kind: 'sequence', items: ex.lines })).toBe(true);
    expect(checkAnswer(ex, { kind: 'sequence', items: [...ex.lines.slice(0, 5), '  }, []);', ...ex.lines.slice(6)] })).toBe(false);
    expect(checkAnswer(ex, { kind: 'choice', index: 0 })).toBe(false);
  });

  test('у каждого упражнения есть текст правильного ответа', () => {
    for (const ex of byId.values()) expect(correctAnswerText(ex).length, ex.id).toBeGreaterThan(0);
  });
});
