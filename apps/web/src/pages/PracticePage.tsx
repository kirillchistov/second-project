import { useEffect, useReducer, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { LevelBadge, TopicTag } from '../components/Badges';
import { IconClock } from '../components/Icons';
import { Inline, Markdown } from '../components/Markdown';
import { LEVELS, TOPICS, topicById, type Level, type Question, type QuizExercise, type TopicId } from '@rr/content';
import { checkAnswer, formatDuration, plural, shuffle, TIMER_MODE_OPTIONS, type TimerMode } from '@rr/core';
import { QUESTIONS } from '../data/questions';
import { quizByQuestion } from '../data/quizzes';
import { useElapsedSeconds } from '../lib/timer';

type Grade = 'know' | 'partial' | 'dont';
type AnswerMode = 'free' | 'quiz';

const GRADES: { id: Grade; label: string; key: string }[] = [
  { id: 'dont', label: 'Не знаю', key: '1' },
  { id: 'partial', label: 'Частично', key: '2' },
  { id: 'know', label: 'Знаю', key: '3' },
];

const ANSWER_MODES: { id: AnswerMode; label: string; hint: string }[] = [
  { id: 'free', label: 'Свой ответ', hint: 'Сформулируйте сами, затем сверьтесь с эталоном и оцените себя.' },
  { id: 'quiz', label: 'Варианты ответов', hint: 'Выберите вариант из нескольких — правильность проверяется сразу.' },
];

type Config = {
  levels: Level[];
  topics: TopicId[];
  count: number;          // 0 — все подходящие
  order: 'random' | 'sequential';
  timer: TimerMode;
  answerMode: AnswerMode;
};

type State =
  | { phase: 'setup' }
  | {
      phase: 'running';
      questions: Question[];
      index: number;
      revealed: boolean;
      questionStartedAt: number;
      grades: Record<string, Grade>;
      timer: TimerMode;
      answerMode: AnswerMode;
    }
  | { phase: 'finished'; questions: Question[]; grades: Record<string, Grade>; timer: TimerMode; answerMode: AnswerMode };

type Action =
  | { type: 'start'; questions: Question[]; timer: TimerMode; answerMode: AnswerMode }
  | { type: 'reveal' }
  | { type: 'grade'; grade: Grade }
  | { type: 'finish' }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return {
        phase: 'running',
        questions: action.questions,
        index: 0,
        revealed: false,
        questionStartedAt: Date.now(),
        grades: {},
        timer: action.timer,
        answerMode: action.answerMode,
      };
    case 'reveal':
      return state.phase === 'running' ? { ...state, revealed: true } : state;
    case 'grade': {
      if (state.phase !== 'running' || !state.revealed) return state;
      const grades = { ...state.grades, [state.questions[state.index].slug]: action.grade };
      if (state.index + 1 >= state.questions.length) {
        return { phase: 'finished', questions: state.questions, grades, timer: state.timer, answerMode: state.answerMode };
      }
      return { ...state, grades, index: state.index + 1, revealed: false, questionStartedAt: Date.now() };
    }
    case 'finish':
      if (state.phase !== 'running') return state;
      return {
        phase: 'finished',
        questions: state.questions.filter((q) => state.grades[q.slug]),
        grades: state.grades,
        timer: state.timer,
        answerMode: state.answerMode,
      };
    case 'reset':
      return { phase: 'setup' };
  }
}

function buildSession(config: Config): Question[] {
  const pool = QUESTIONS.filter(
    (q) =>
      (config.levels.length === 0 || config.levels.includes(q.level)) &&
      (config.topics.length === 0 || config.topics.includes(q.topic)),
  );
  const ordered = config.order === 'random' ? shuffle(pool) : pool;
  return config.count > 0 ? ordered.slice(0, config.count) : ordered;
}

export function PracticePage() {
  const [state, dispatch] = useReducer(reducer, { phase: 'setup' });

  return (
    <div className="container container--narrow page">
      <title>Тренировка — React Refresher</title>
      {state.phase === 'setup' && (
        <PracticeSetup onStart={(questions, timer, answerMode) => dispatch({ type: 'start', questions, timer, answerMode })} />
      )}
      {state.phase === 'running' && <PracticeRun state={state} dispatch={dispatch} />}
      {state.phase === 'finished' && (
        <PracticeResults
          questions={state.questions}
          grades={state.grades}
          onRetry={(questions) =>
            dispatch({ type: 'start', questions: shuffle(questions), timer: state.timer, answerMode: state.answerMode })
          }
          onReset={() => dispatch({ type: 'reset' })}
        />
      )}
    </div>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function PracticeSetup({
  onStart,
}: {
  onStart: (questions: Question[], timer: TimerMode, answerMode: AnswerMode) => void;
}) {
  const [params] = useSearchParams();
  const [config, setConfig] = useState<Config>(() => {
    const topicIds = TOPICS.map((t) => t.id);
    const levelIds = LEVELS.map((l) => l.id);
    return {
      topics: (params.get('topic')?.split(',') ?? []).filter((t): t is TopicId => topicIds.includes(t as TopicId)),
      levels: (params.get('level')?.split(',') ?? []).filter((l): l is Level => levelIds.includes(l as Level)),
      count: 10,
      order: 'random',
      timer: 'off',
      answerMode: 'free',
    };
  });

  const available = buildSession({ ...config, count: 0 }).length;
  const sessionSize = config.count > 0 ? Math.min(config.count, available) : available;

  return (
    <>
      <header className="page-header">
        <h1>Тренировка</h1>
        <p className="page-header__lead">
          Вопрос появляется без ответа. Сформулируйте ответ вслух или на бумаге, затем откройте эталон и честно
          оцените себя. В конце — список того, что стоит повторить.
        </p>
      </header>

      <form
        className="setup"
        onSubmit={(e) => {
          e.preventDefault();
          onStart(buildSession(config), config.timer, config.answerMode);
        }}
      >
        <fieldset className="setup__group">
          <legend>Как отвечать</legend>
          <div className="segmented">
            {ANSWER_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={config.answerMode === m.id ? 'is-active' : ''}
                aria-pressed={config.answerMode === m.id}
                onClick={() => setConfig((c) => ({ ...c, answerMode: m.id }))}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="setup__hint">{ANSWER_MODES.find((m) => m.id === config.answerMode)?.hint}</p>
        </fieldset>

        <fieldset className="setup__group">
          <legend>Уровень</legend>
          <div className="chips">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`chip ${config.levels.includes(l.id) ? 'is-active' : ''}`}
                aria-pressed={config.levels.includes(l.id)}
                onClick={() => setConfig((c) => ({ ...c, levels: toggle(c.levels, l.id) }))}
              >
                {l.title}
              </button>
            ))}
          </div>
          <p className="setup__hint">Ничего не выбрано — все уровни.</p>
        </fieldset>

        <fieldset className="setup__group">
          <legend>Темы</legend>
          <div className="chips">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip ${config.topics.includes(t.id) ? 'is-active' : ''}`}
                aria-pressed={config.topics.includes(t.id)}
                onClick={() => setConfig((c) => ({ ...c, topics: toggle(c.topics, t.id) }))}
              >
                {t.title}
              </button>
            ))}
          </div>
          <p className="setup__hint">Ничего не выбрано — все темы.</p>
        </fieldset>

        <div className="setup__row">
          <fieldset className="setup__group">
            <legend>Сколько вопросов</legend>
            <div className="segmented">
              {[5, 10, 20, 0].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={config.count === n ? 'is-active' : ''}
                  aria-pressed={config.count === n}
                  onClick={() => setConfig((c) => ({ ...c, count: n }))}
                >
                  {n === 0 ? 'Все' : n}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="setup__group">
            <legend>Порядок</legend>
            <div className="segmented">
              {(['random', 'sequential'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  className={config.order === o ? 'is-active' : ''}
                  aria-pressed={config.order === o}
                  onClick={() => setConfig((c) => ({ ...c, order: o }))}
                >
                  {o === 'random' ? 'Случайный' : 'По порядку'}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset className="setup__group">
          <legend>Время на вопрос</legend>
          <div className="segmented">
            {TIMER_MODE_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={config.timer === t.id ? 'is-active' : ''}
                aria-pressed={config.timer === t.id}
                onClick={() => setConfig((c) => ({ ...c, timer: t.id }))}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="setup__hint">{TIMER_MODE_OPTIONS.find((t) => t.id === config.timer)?.hint}</p>
        </fieldset>

        <div className="setup__footer">
          <span>
            {sessionSize} {plural(sessionSize, ['вопрос', 'вопроса', 'вопросов'])} в сессии
          </span>
          <button className="btn btn--primary" disabled={sessionSize === 0}>
            Начать
          </button>
        </div>
      </form>
    </>
  );
}

function PracticeRun({
  state,
  dispatch,
}: {
  state: Extract<State, { phase: 'running' }>;
  dispatch: React.Dispatch<Action>;
}) {
  const question = state.questions[state.index];
  const quiz = state.answerMode === 'quiz' ? quizByQuestion.get(question.slug) : undefined;
  const limit = TIMER_MODE_OPTIONS.find((t) => t.id === state.timer)!.seconds;
  const elapsed = useElapsedSeconds(state.questionStartedAt, !state.revealed);
  const remaining = limit - elapsed;
  const expired = limit > 0 && remaining <= 0;

  // Жёсткий режим: время вышло — открываем ответ сами
  useEffect(() => {
    if (expired && state.timer === 'exam' && !state.revealed) dispatch({ type: 'reveal' });
  }, [expired, state.timer, state.revealed, dispatch]);

  useEffect(() => {
    // В режиме вариантов ответ выбирают кликом — клавиши 1/2/3 там оценкой не управляют
    if (quiz) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey) return;
      if (!state.revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        dispatch({ type: 'reveal' });
      }
      const grade = GRADES.find((g) => g.key === e.key);
      if (state.revealed && grade) dispatch({ type: 'grade', grade: grade.id });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.revealed, quiz, dispatch]);

  return (
    <div className="session">
      <div className="session__top">
        <span>
          Вопрос {state.index + 1} из {state.questions.length}
        </span>
        {limit > 0 && !state.revealed && (
          <span className={`timer ${expired ? 'timer--expired' : ''}`} role="timer" aria-live="off">
            <IconClock /> {expired ? 'Время вышло' : formatDuration(remaining)}
          </span>
        )}
        <button type="button" className="link-btn" onClick={() => dispatch({ type: 'finish' })}>
          Завершить
        </button>
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress__bar" style={{ width: `${(state.index / state.questions.length) * 100}%` }} />
      </div>

      {quiz ? (
        <QuizCard
          key={question.slug}
          question={question}
          quiz={quiz}
          revealed={state.revealed}
          onReveal={() => dispatch({ type: 'reveal' })}
          onNext={(correct) => dispatch({ type: 'grade', grade: correct ? 'know' : 'dont' })}
        />
      ) : (
        <FreeCard key={question.slug} question={question} revealed={state.revealed} dispatch={dispatch} />
      )}
    </div>
  );
}

function FreeCard({
  question,
  revealed,
  dispatch,
}: {
  question: Question;
  revealed: boolean;
  dispatch: React.Dispatch<Action>;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <section className="flashcard">
      <div className="flashcard__meta">
        <LevelBadge level={question.level} />
        <TopicTag topic={question.topic} />
        <span className="flashcard__num">№{question.number}</span>
      </div>
      <h1 className="flashcard__title">{question.title}</h1>

      {!revealed ? (
        <div className="flashcard__prompt">
          <p>Сформулируйте ответ: определение, зачем это нужно, пример и подводные камни.</p>
          <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'reveal' })}>
            Показать ответ <kbd>Пробел</kbd>
          </button>
        </div>
      ) : (
        <div className="flashcard__answer">
          <div className="callout callout--answer">
            <h2 className="callout__title">Краткий ответ</h2>
            <p><Inline text={question.short} /></p>
          </div>
          {question.pitfalls.length > 0 && (
            <div className="callout callout--pitfall">
              <h2 className="callout__title">Подводные камни</h2>
              <ul>{question.pitfalls.map((p, i) => <li key={i}><Inline text={p} /></li>)}</ul>
            </div>
          )}
          <button type="button" className="link-btn" onClick={() => setShowDetails((s) => !s)} aria-expanded={showDetails}>
            {showDetails ? 'Скрыть подробный разбор' : 'Показать подробный разбор'}
          </button>
          {showDetails && <Markdown source={question.body} />}

          <div className="grade">
            <p className="grade__label">Насколько хорошо вы ответили?</p>
            <div className="grade__buttons">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`grade__btn grade__btn--${g.id}`}
                  onClick={() => dispatch({ type: 'grade', grade: g.id })}
                >
                  {g.label} <kbd>{g.key}</kbd>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function QuizCard({
  question,
  quiz,
  revealed,
  onReveal,
  onNext,
}: {
  question: Question;
  quiz: QuizExercise;
  revealed: boolean;
  onReveal: () => void;
  onNext: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [order] = useState(() => shuffle(quiz.options.map((_, i) => i)));
  const correct = selected !== null && checkAnswer(quiz, { kind: 'choice', index: selected });

  return (
    <section className="flashcard">
      <div className="flashcard__meta">
        <LevelBadge level={question.level} />
        <TopicTag topic={question.topic} />
        <span className="flashcard__num">№{question.number}</span>
      </div>
      <h1 className="flashcard__title">{question.title}</h1>
      <p className="quiz__prompt"><Inline text={quiz.prompt} /></p>

      <div className="choices">
        {order.map((i) => {
          const option = quiz.options[i];
          const state = revealed ? (i === quiz.answer ? 'correct' : i === selected ? 'wrong' : undefined) : undefined;
          return (
            <button
              key={i}
              type="button"
              className={`choice ${selected === i ? 'is-selected' : ''} ${state ? `is-${state}` : ''}`}
              disabled={revealed}
              onClick={() => setSelected(i)}
            >
              <Inline text={option.label} />
              {revealed && <span className="choice__why">{option.why}</span>}
            </button>
          );
        })}
      </div>

      {!revealed ? (
        <button type="button" className="btn btn--primary" disabled={selected === null} onClick={onReveal}>
          Проверить
        </button>
      ) : (
        <div className="flashcard__answer">
          <div className={`callout ${correct ? 'callout--answer' : 'callout--pitfall'}`}>
            <h2 className="callout__title">{correct ? 'Верно' : 'Неверно'}</h2>
            <p><Inline text={quiz.explanation} /></p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => onNext(correct)}>
            Далее
          </button>
        </div>
      )}
    </section>
  );
}

function PracticeResults({
  questions,
  grades,
  onRetry,
  onReset,
}: {
  questions: Question[];
  grades: Record<string, Grade>;
  onRetry: (questions: Question[]) => void;
  onReset: () => void;
}) {
  const count = (g: Grade) => questions.filter((q) => grades[q.slug] === g).length;
  const weak = questions.filter((q) => grades[q.slug] !== 'know');
  const weakTopics = [...new Set(weak.map((q) => q.topic))];

  if (questions.length === 0) {
    return (
      <div className="empty">
        <p>Вы завершили тренировку, не ответив ни на один вопрос.</p>
        <button type="button" className="btn btn--primary" onClick={onReset}>Новая тренировка</button>
      </div>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1>Итоги тренировки</h1>
        <p className="page-header__lead">
          {questions.length} {plural(questions.length, ['вопрос', 'вопроса', 'вопросов'])}. Оценка своя — главное,
          чтобы она была честной.
        </p>
      </header>

      <div className="stats">
        <div className="stat stat--know"><span>{count('know')}</span>Знаю</div>
        <div className="stat stat--partial"><span>{count('partial')}</span>Частично</div>
        <div className="stat stat--dont"><span>{count('dont')}</span>Не знаю</div>
      </div>

      {weak.length > 0 ? (
        <>
          <h2 className="article__section-title">Стоит повторить</h2>
          {weakTopics.length > 0 && (
            <p className="muted">Темы: {weakTopics.map((t) => topicById[t].title).join(', ')}</p>
          )}
          <ul className="review-list">
            {weak.map((q) => (
              <li key={q.slug}>
                <span className={`dot dot--${grades[q.slug]}`} aria-label={grades[q.slug] === 'dont' ? 'Не знаю' : 'Частично'} />
                <Link to={`/questions/${q.slug}`}>{q.title}</Link>
                <LevelBadge level={q.level} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="success-note">Все вопросы отмечены как «Знаю». Попробуйте мок-собеседование или следующий уровень.</p>
      )}

      <div className="actions">
        {weak.length > 0 && (
          <button type="button" className="btn btn--primary" onClick={() => onRetry(weak)}>
            Повторить {weak.length} {plural(weak.length, ['слабый вопрос', 'слабых вопроса', 'слабых вопросов'])}
          </button>
        )}
        <button type="button" className="btn btn--secondary" onClick={onReset}>Новая тренировка</button>
      </div>
    </>
  );
}
