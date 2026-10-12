import { useState } from 'react';
import { GAP, type Exercise } from '@rr/content';
import { checkAnswer, shuffle } from '@rr/core';
import { Prompt } from './ui';

export function FillTokensExercise({
  exercise,
  revealed,
  onSubmit,
}: {
  exercise: Extract<Exercise, { type: 'fill-tokens' }>;
  revealed: boolean;
  onSubmit: (correct: boolean) => void;
}) {
  const parts = exercise.code.trimEnd().split(GAP);
  const [chips] = useState(() => shuffle([...exercise.tokens, ...exercise.decoys]).map((text, id) => ({ id, text })));
  const [filled, setFilled] = useState<(number | null)[]>(() => exercise.tokens.map(() => null));
  const used = new Set(filled.filter((id): id is number => id !== null));
  const answer = filled.map((id) => (id === null ? '' : chips[id].text));

  const put = (chipId: number) => {
    const gap = filled.indexOf(null);
    if (gap === -1) return;
    setFilled(filled.map((value, index) => (index === gap ? chipId : value)));
  };

  return (
    <div className="task">
      <Prompt label="Заполни пропуски" text={exercise.prompt} />
      <pre className="token-code">
        {parts.map((part, index) => (
          <span key={index}>
            {part}
            {index < parts.length - 1 && (
              <button
                type="button"
                className={`token-gap ${revealed ? (answer[index] === exercise.tokens[index] ? 'is-correct' : 'is-wrong') : ''}`}
                disabled={revealed}
                onClick={() => setFilled(filled.map((value, gap) => (gap === index ? null : value)))}
              >
                {answer[index] || '____'}
              </button>
            )}
          </span>
        ))}
      </pre>
      {!revealed && (
        <div className="chips">
          {chips.map((chip) => (
            <button key={chip.id} type="button" className="chip" disabled={used.has(chip.id)} onClick={() => put(chip.id)}>
              {chip.text}
            </button>
          ))}
        </div>
      )}
      {!revealed && (
        <button
          type="button"
          className="btn btn--primary demo-submit"
          disabled={filled.includes(null)}
          onClick={() => onSubmit(checkAnswer(exercise, { kind: 'tokens', tokens: answer }))}
        >
          Проверить
        </button>
      )}
    </div>
  );
}
