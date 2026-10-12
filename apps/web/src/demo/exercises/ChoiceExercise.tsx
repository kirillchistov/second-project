import { useState } from 'react';
import type { Exercise } from '@rr/content';
import { checkAnswer } from '@rr/core';
import { CodeBlock } from '../../components/CodeBlock';
import { Inline } from '../../components/Markdown';
import { useShuffledOrder } from './useShuffledOrder';
import { ChoiceButton, Prompt } from './ui';

export function ChoiceExercise({
  exercise,
  revealed,
  onSubmit,
}: {
  exercise: Extract<Exercise, { type: 'predict-output' | 'choose-tool' }>;
  revealed: boolean;
  onSubmit: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const order = useShuffledOrder(exercise.options.length);
  const isTool = exercise.type === 'choose-tool';

  return (
    <div className="task">
      <Prompt label={isTool ? 'Выбери инструмент' : 'Предскажи вывод'} text={exercise.prompt} />
      {exercise.type === 'predict-output' && <CodeBlock code={exercise.code} language={exercise.language} />}
      <div className="choices">
        {order.map((index) => {
          const option = exercise.options[index];
          const label = typeof option === 'string' ? option : option.label;
          const state = revealed ? (index === exercise.answer ? 'correct' : index === selected ? 'wrong' : undefined) : undefined;
          return (
            <ChoiceButton
              key={index}
              selected={selected === index}
              state={state}
              disabled={revealed}
              mono={!isTool}
              onClick={() => setSelected(index)}
            >
              <Inline text={label} />
              {revealed && typeof option !== 'string' && <span className="choice__why">{option.why}</span>}
            </ChoiceButton>
          );
        })}
      </div>
      {!revealed && (
        <button
          type="button"
          className="btn btn--primary demo-submit"
          disabled={selected === null}
          onClick={() => selected !== null && onSubmit(checkAnswer(exercise, { kind: 'choice', index: selected }))}
        >
          Проверить
        </button>
      )}
    </div>
  );
}
