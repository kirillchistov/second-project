import { useState } from 'react';
import type { Question } from '@rr/content';
import { checkAnswer, type Outcome, type QuizExercise } from '@rr/core';
import { Inline } from '../../components/Markdown';
import { useShuffledOrder } from './useShuffledOrder';
import { ChoiceButton, Prompt } from './ui';

export function CardExercise({
  question,
  quiz,
  revealed,
  onAnswer,
}: {
  question: Question;
  quiz?: QuizExercise;
  revealed: boolean;
  onAnswer: (outcome: Outcome, feedback: boolean) => void;
}) {
  if (quiz) return <QuizCard quiz={quiz} revealed={revealed} onAnswer={onAnswer} />;
  return <RecallCard question={question} onAnswer={onAnswer} />;
}

function QuizCard({
  quiz,
  revealed,
  onAnswer,
}: {
  quiz: QuizExercise;
  revealed: boolean;
  onAnswer: (outcome: Outcome, feedback: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const order = useShuffledOrder(quiz.options.length);

  return (
    <div className="task">
      <Prompt label="Вопрос" text={quiz.prompt} />
      <div className="choices">
        {order.map((index) => {
          const state = revealed ? (index === quiz.answer ? 'correct' : index === selected ? 'wrong' : undefined) : undefined;
          return (
            <ChoiceButton
              key={index}
              selected={selected === index}
              state={state}
              disabled={revealed}
              onClick={() => setSelected(index)}
            >
              <Inline text={quiz.options[index].label} />
              {revealed && <span className="choice__why">{quiz.options[index].why}</span>}
            </ChoiceButton>
          );
        })}
      </div>
      {!revealed && (
        <button
          type="button"
          className="btn btn--primary demo-submit"
          disabled={selected === null}
          onClick={() => {
            if (selected === null) return;
            onAnswer(checkAnswer(quiz, { kind: 'choice', index: selected }) ? 'good' : 'again', true);
          }}
        >
          Проверить
        </button>
      )}
    </div>
  );
}

/** Если у вопроса нет карточки с вариантами, остаётся сверка с эталоном — без сети и без ИИ. */
function RecallCard({ question, onAnswer }: { question: Question; onAnswer: (outcome: Outcome, feedback: boolean) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="task">
        <Prompt label="Вопрос" text={question.title} />
        <p className="recall">Сформулируй ответ сам. Потом сверься с эталоном и оцени, насколько совпало.</p>
        <button type="button" className="btn btn--primary demo-submit" onClick={() => setOpen(true)}>
          Показать эталон
        </button>
      </div>
    );
  }

  return (
    <div className="task">
      <Prompt label="Вопрос" text={question.title} />
      <div className="recall recall--answer">
        <Inline text={question.short} />
        {question.pitfalls.length > 0 && (
          <div>
            <p className="recall__title">Подводные камни</p>
            <ul>
              {question.pitfalls.slice(0, 2).map((pitfall) => (
                <li key={pitfall}>
                  <Inline text={pitfall} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="task__hint">Насколько твой ответ совпал с эталоном?</p>
      <div className="grades">
        <button type="button" className="btn demo-grade demo-grade--again" onClick={() => onAnswer('again', false)}>Не вспомнил</button>
        <button type="button" className="btn demo-grade demo-grade--hard" onClick={() => onAnswer('hard', false)}>Частично</button>
        <button type="button" className="btn demo-grade demo-grade--good" onClick={() => onAnswer('good', false)}>Знаю</button>
      </div>
    </div>
  );
}
