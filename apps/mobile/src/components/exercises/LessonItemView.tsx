import type { LessonItem, Outcome } from '@rr/core';
import { ArrangeExercise } from './ArrangeExercise';
import { CardExercise } from './CardExercise';
import { ChoiceExercise } from './ChoiceExercise';
import { FillTokensExercise } from './FillTokensExercise';
import { FindBugExercise } from './FindBugExercise';

/** Выбирает компонент под тип элемента урока. */
export function LessonItemView({
  item,
  revealed,
  onAnswer,
}: {
  item: LessonItem;
  revealed: boolean;
  onAnswer: (outcome: Outcome) => void;
}) {
  if (item.kind === 'card') return <CardExercise question={item.question} onGrade={onAnswer} />;

  const onSubmit = (correct: boolean) => onAnswer(correct ? 'good' : 'again');
  const ex = item.exercise;
  switch (ex.type) {
    case 'predict-output':
    case 'choose-tool':
      return <ChoiceExercise exercise={ex} revealed={revealed} onSubmit={onSubmit} />;
    case 'find-bug':
      return <FindBugExercise exercise={ex} revealed={revealed} onSubmit={onSubmit} />;
    case 'fill-tokens':
      return <FillTokensExercise exercise={ex} revealed={revealed} onSubmit={onSubmit} />;
    case 'order':
    case 'parsons':
      return <ArrangeExercise exercise={ex} revealed={revealed} onSubmit={onSubmit} />;
  }
}
