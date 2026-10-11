import type { Exercise } from '@rr/content';

/** Ответ пользователя. Форма зависит от того, как упражнение решается пальцем. */
export type Answer =
  /** predict-output, choose-tool: выбран вариант */
  | { kind: 'choice'; index: number }
  /** find-bug: тап по строке, затем выбор причины */
  | { kind: 'bug'; line: number; cause: number }
  /** fill-tokens: токены по порядку пропусков */
  | { kind: 'tokens'; tokens: string[] }
  /** order, parsons: собранная последовательность */
  | { kind: 'sequence'; items: string[] };

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

export function checkAnswer(exercise: Exercise, answer: Answer): boolean {
  switch (exercise.type) {
    case 'predict-output':
    case 'choose-tool':
      return answer.kind === 'choice' && answer.index === exercise.answer;
    case 'find-bug':
      return answer.kind === 'bug' && exercise.bugLines.includes(answer.line) && answer.cause === exercise.answer;
    case 'fill-tokens':
      return answer.kind === 'tokens' && sameSequence(answer.tokens, exercise.tokens);
    case 'order':
      return answer.kind === 'sequence' && sameSequence(answer.items, exercise.steps);
    case 'parsons':
      // Отступы — часть ответа в коде, но сравниваем без хвостовых пробелов
      return (
        answer.kind === 'sequence' &&
        sameSequence(
          answer.items.map((l) => l.trimEnd()),
          exercise.lines.map((l) => l.trimEnd()),
        )
      );
  }
}

/** Правильный ответ коротко — показывается в разборе после ошибки. */
export function correctAnswerText(exercise: Exercise): string {
  switch (exercise.type) {
    case 'predict-output':
      return exercise.options[exercise.answer];
    case 'choose-tool':
      return exercise.options[exercise.answer].label;
    case 'find-bug': {
      const lines = exercise.bugLines.length > 1 ? `строки ${exercise.bugLines.join(', ')}` : `строка ${exercise.bugLines[0]}`;
      return `${lines}: ${exercise.causes[exercise.answer]}`;
    }
    case 'fill-tokens':
      return exercise.tokens.join(' · ');
    case 'order':
      return exercise.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    case 'parsons':
      return exercise.lines.join('\n');
  }
}
