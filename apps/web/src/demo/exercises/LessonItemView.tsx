import type { AnswerMeta, LessonItem, Outcome } from '@rr/core';
import { ArrangeExercise } from './ArrangeExercise';
import { CardExercise } from './CardExercise';
import { ChoiceExercise } from './ChoiceExercise';
import { FillTokensExercise } from './FillTokensExercise';
import { FindBugExercise } from './FindBugExercise';

export function LessonItemView({
  item,
  revealed,
  onAnswer,
}: {
  item: LessonItem;
  revealed: boolean;
  onAnswer: (outcome: Outcome, feedback: boolean, meta?: AnswerMeta) => void;
}) {
  if (item.kind === 'card') {
    return (
      <CardExercise
        question={item.question}
        quiz={item.quiz}
        revealed={revealed}
        onAnswer={(outcome, feedback) => onAnswer(outcome, feedback, { mode: item.quiz ? 'quiz' : 'explain', hints: 0 })}
      />
    );
  }

  const onSubmit = (correct: boolean) => onAnswer(correct ? 'good' : 'again', true);
  const exercise = item.exercise;
  switch (exercise.type) {
    case 'quiz':
      return null;
    case 'predict-output':
    case 'choose-tool':
      return <ChoiceExercise exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
    case 'find-bug':
      return <FindBugExercise exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
    case 'fill-tokens':
      return <FillTokensExercise exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
    case 'order':
    case 'parsons':
      return <ArrangeExercise exercise={exercise} revealed={revealed} onSubmit={onSubmit} />;
  }
}
