import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  correctAnswerText,
  currentItem,
  currentStreak,
  lessonItems,
  lessonXp,
  localDay,
  reviewItems,
  sessionProgress,
  sessionReducer,
  startSession,
  summarize,
  type LessonItem,
} from '@rr/core';
import { feedbackLine } from './copy';
import { CONTENT, ITEMS, lessonById } from './content';
import { LessonItemView } from './exercises/LessonItemView';
import { useNow } from './now';
import { getProgress, progressPersistFailed, saveLesson } from './progress';
import { useDemoProgress } from './useProgress';

export function LessonPage({ review = false }: { review?: boolean }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const progress = useDemoProgress();
  const lesson = review ? undefined : lessonById.get(id);
  const [items] = useState<LessonItem[]>(() => {
    if (review) {
      const stored = getProgress();
      return reviewItems({
        content: CONTENT,
        cards: new Map(Object.entries(stored.cards)),
        backlog: stored.backlog,
        now,
      });
    }
    return lesson ? lessonItems(lesson) : [];
  });
  const [state, dispatch] = useReducer(sessionReducer, items, startSession);
  const savedRef = useRef(false);
  const title = !lesson && !review
    ? 'Урок не найден — React Refresher, демо'
    : review || items.length === 0
      ? 'Повторение — React Refresher, демо'
      : `Урок ${lesson?.index ?? ''} — React Refresher, демо`;

  useEffect(() => {
    document.title = title;
  }, [title]);

  useLayoutEffect(() => {
    if (savedRef.current || state.phase !== 'done' || items.length === 0) return;
    savedRef.current = true;
    saveLesson(state, lesson?.id ?? null, new Date(), (itemId) => ITEMS.get(itemId)?.skill);
  }, [state, items.length, lesson?.id]);

  if (!review && !lesson) {
    return (
      <div className="lesson-end">
        <h1>Урок не найден</h1>
        <Link to="/" className="btn btn--primary">На путь</Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="lesson-end">
        <h1>Повторять пока нечего</h1>
        <p>Пройди урок на пути — навыки появятся здесь, когда придёт время их освежить.</p>
        <Link to="/" className="btn btn--primary">На путь</Link>
      </div>
    );
  }

  if (state.phase === 'done') {
    const summary = summarize(state);
    const streak = currentStreak(Object.keys(progress.activity), localDay(now));
    return (
      <div className="lesson-end">
        <h1>{review ? 'Повторение завершено' : summary.perfect ? 'Идеальный коммит' : 'Коммит принят'}</h1>
        {lesson && <p className="lesson-end__hash">commit {lesson.hash}</p>}
        <dl className="lesson-end__stats">
          <div><dt>XP</dt><dd>+{lessonXp(summary)}</dd></div>
          <div><dt>С первой попытки</dt><dd>{Math.round(summary.accuracy * 100)}%</dd></div>
          <div><dt>Стрик</dt><dd>{streak} дн.</dd></div>
        </dl>
        {progressPersistFailed() && (
          <p className="lesson-end__warn">Браузер не дал записать прогресс. В этом сеансе он есть, после закрытия вкладки может пропасть.</p>
        )}
        <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>Готово</button>
      </div>
    );
  }

  const item = currentItem(state);
  const revealed = state.phase === 'feedback';
  const graded = item?.kind === 'exercise' ? item.exercise : item?.quiz;
  const repeat = item ? state.results[item.id] !== undefined && !revealed : false;

  return (
    <div className="lesson">
      <header className="lesson__bar">
        <button type="button" className="icon-btn" aria-label="Закрыть урок" onClick={() => navigate('/')}>
          ×
        </button>
        <div className="progress" aria-label="Прогресс урока">
          <div className="progress__bar" style={{ width: `${sessionProgress(state) * 100}%` }} />
        </div>
        {state.combo >= 3 && <span className="lesson__combo">×{state.combo}</span>}
      </header>
      <div className="lesson__body">
        {repeat && <p className="lesson__repeat">Повтор ошибки</p>}
        {item && (
          <LessonItemView
            key={`${item.id}:${state.position}`}
            item={item}
            revealed={revealed}
            onAnswer={(outcome, feedback, meta) => {
              dispatch({ type: 'answer', outcome, meta });
              if (!feedback) dispatch({ type: 'continue' });
            }}
          />
        )}
      </div>
      {revealed && graded && state.last && (
        <div className={`lesson__feedback ${state.last.correct ? 'is-correct' : 'is-wrong'}`}>
          <p className="lesson__feedback-title">{feedbackLine(state.last.correct, state.combo, state.position)}</p>
          {!state.last.correct && <p className="lesson__feedback-answer">Правильно: {correctAnswerText(graded)}</p>}
          <p>{graded.explanation}</p>
          <button type="button" className="btn btn--primary demo-submit" onClick={() => dispatch({ type: 'continue' })}>
            Дальше
          </button>
        </div>
      )}
    </div>
  );
}
