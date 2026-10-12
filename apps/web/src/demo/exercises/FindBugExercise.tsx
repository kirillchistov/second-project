import { useMemo, useState } from 'react';
import type { Exercise } from '@rr/content';
import { checkAnswer } from '@rr/core';
import { CodeLines } from './CodeLines';
import { useShuffledOrder } from './useShuffledOrder';
import { ChoiceButton, Prompt } from './ui';

export function FindBugExercise({
  exercise,
  revealed,
  onSubmit,
}: {
  exercise: Extract<Exercise, { type: 'find-bug' }>;
  revealed: boolean;
  onSubmit: (correct: boolean) => void;
}) {
  const [line, setLine] = useState<number | null>(null);
  const [cause, setCause] = useState<number | null>(null);
  const order = useShuffledOrder(exercise.causes.length);
  const marked = useMemo(() => {
    if (!revealed) return undefined;
    const map = new Map<number, 'correct' | 'wrong'>(exercise.bugLines.map((number) => [number, 'correct']));
    if (line !== null && !exercise.bugLines.includes(line)) map.set(line, 'wrong');
    return map;
  }, [revealed, line, exercise.bugLines]);

  return (
    <div className="task">
      <Prompt label="Найди баг" text={exercise.prompt} />
      <CodeLines
        code={exercise.code}
        language={exercise.language}
        selectedLine={line ?? undefined}
        marked={marked}
        onLine={revealed ? undefined : setLine}
      />
      {line === null ? (
        <p className="task__hint">Нажми строку с ошибкой</p>
      ) : (
        <div className="choices">
          <p className="task__step">Строка {line}. Почему это ошибка?</p>
          {order.map((index) => (
            <ChoiceButton
              key={index}
              selected={cause === index}
              state={revealed ? (index === exercise.answer ? 'correct' : index === cause ? 'wrong' : undefined) : undefined}
              disabled={revealed}
              onClick={() => setCause(index)}
            >
              {exercise.causes[index]}
            </ChoiceButton>
          ))}
        </div>
      )}
      {!revealed && (
        <button
          type="button"
          className="btn btn--primary demo-submit"
          disabled={line === null || cause === null}
          onClick={() => line !== null && cause !== null && onSubmit(checkAnswer(exercise, { kind: 'bug', line, cause }))}
        >
          Проверить
        </button>
      )}
    </div>
  );
}
