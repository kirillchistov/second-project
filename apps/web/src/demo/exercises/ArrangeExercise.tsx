import { useState } from 'react';
import type { Exercise } from '@rr/content';
import { checkAnswer, shuffle } from '@rr/core';
import { ChoiceButton, Prompt } from './ui';

type Piece = { id: number; text: string };

function shuffledPieces(items: string[], correct: string[]): Piece[] {
  const pieces = items.map((text, id) => ({ id, text }));
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = shuffle(pieces);
    if (result.slice(0, correct.length).some((piece, index) => piece.text !== correct[index])) return result;
  }
  return [...pieces].reverse();
}

function keepIndent(text: string): string {
  return text.replace(/^ +/, (spaces) => '\u00A0'.repeat(spaces.length));
}

export function ArrangeExercise({
  exercise,
  revealed,
  onSubmit,
}: {
  exercise: Extract<Exercise, { type: 'order' | 'parsons' }>;
  revealed: boolean;
  onSubmit: (correct: boolean) => void;
}) {
  const isCode = exercise.type === 'parsons';
  const correct = isCode ? exercise.lines : exercise.steps;
  const [pool] = useState(() => shuffledPieces(isCode ? [...exercise.lines, ...exercise.distractors] : exercise.steps, correct));
  const [answer, setAnswer] = useState<number[]>([]);
  const byId = new Map(pool.map((piece) => [piece.id, piece]));
  const label = isCode ? 'Собери код' : exercise.kind === 'timeline' ? 'Расставь по порядку' : 'Собери алгоритм';

  return (
    <div className="task">
      <Prompt label={label} text={exercise.prompt} />
      <div className="arrange" aria-label="Собранный ответ">
        {answer.length === 0 && <p className="arrange__empty">Нажимай фрагменты ниже по порядку</p>}
        {answer.map((id, index) => {
          const piece = byId.get(id)!;
          const state = revealed ? (piece.text === correct[index] ? 'correct' : 'wrong') : undefined;
          return (
            <ChoiceButton key={id} state={state} disabled={revealed} mono={isCode} onClick={() => setAnswer(answer.filter((item) => item !== id))}>
              {!isCode && <span className="arrange__index">{index + 1}</span>}
              <span>{isCode ? keepIndent(piece.text) : piece.text}</span>
            </ChoiceButton>
          );
        })}
      </div>
      {!revealed && (
        <div className="choices">
          {pool
            .filter((piece) => !answer.includes(piece.id))
            .map((piece) => (
              <ChoiceButton key={piece.id} mono={isCode} onClick={() => setAnswer([...answer, piece.id])}>
                {isCode ? keepIndent(piece.text) : piece.text}
              </ChoiceButton>
            ))}
        </div>
      )}
      {!revealed && (
        <button
          type="button"
          className="btn btn--primary demo-submit"
          disabled={answer.length !== correct.length}
          onClick={() => onSubmit(checkAnswer(exercise, { kind: 'sequence', items: answer.map((id) => byId.get(id)!.text) }))}
        >
          Проверить
        </button>
      )}
    </div>
  );
}
