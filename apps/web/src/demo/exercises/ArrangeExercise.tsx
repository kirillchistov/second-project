import { useState } from 'react';
import type { Exercise } from '@rr/content';
import { checkAnswer, shuffle } from '@rr/core';
import { ReorderList } from './ReorderList';
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
  return text.replace(/^ +/, (spaces) => ' '.repeat(spaces.length));
}

/**
 * Порядок шагов (order): все шаги сразу в списке, их перетаскивают вверх-вниз.
 * Код Парсонса (parsons): строки сначала выбирают из пула (среди них есть лишние), собранное тоже можно переставлять.
 */
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
  const [answer, setAnswer] = useState<number[]>(() => (isCode ? [] : pool.map((piece) => piece.id)));
  const byId = new Map(pool.map((piece) => [piece.id, piece]));
  const label = isCode ? 'Собери код' : exercise.kind === 'timeline' ? 'Расставь по порядку' : 'Собери алгоритм';
  const text = (id: number) => byId.get(id)!.text;

  return (
    <div className="task">
      <Prompt label={label} text={exercise.prompt} />
      {!isCode && !revealed && <p className="task__hint">Перетаскивай шаги за ручку слева или двигай стрелками ↑ ↓</p>}
      <div className="arrange" aria-label="Собранный ответ">
        {answer.length === 0 && <p className="arrange__empty">Нажимай фрагменты ниже по порядку</p>}
        <ReorderList
          ids={answer}
          onChange={setAnswer}
          disabled={revealed}
          describe={text}
          renderItem={(id, index, handle) => {
            const state = revealed ? (text(id) === correct[index] ? 'correct' : 'wrong') : undefined;
            return (
              <div className={`reorder__row ${state ? `is-${state}` : ''} ${isCode ? 'is-mono' : ''}`}>
                {handle}
                {!isCode && <span className="arrange__index">{index + 1}</span>}
                {isCode && !revealed ? (
                  // В коде строку можно вернуть в пул нажатием
                  <button type="button" className="reorder__text" onClick={() => setAnswer(answer.filter((item) => item !== id))}>
                    {keepIndent(text(id))}
                  </button>
                ) : (
                  <span className="reorder__text">{isCode ? keepIndent(text(id)) : text(id)}</span>
                )}
              </div>
            );
          }}
        />
      </div>
      {isCode && !revealed && (
        <div className="choices">
          {pool
            .filter((piece) => !answer.includes(piece.id))
            .map((piece) => (
              <ChoiceButton key={piece.id} mono onClick={() => setAnswer([...answer, piece.id])}>
                {keepIndent(piece.text)}
              </ChoiceButton>
            ))}
        </div>
      )}
      {!revealed && (
        <button
          type="button"
          className="btn btn--primary demo-submit"
          disabled={answer.length !== correct.length}
          onClick={() => onSubmit(checkAnswer(exercise, { kind: 'sequence', items: answer.map(text) }))}
        >
          Проверить
        </button>
      )}
    </div>
  );
}
