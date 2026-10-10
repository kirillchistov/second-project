import { useReducer, useState } from 'react';
import { Link } from 'react-router';
import { LevelBadge, TopicTag } from '../components/Badges';
import { IconChat, IconClock } from '../components/Icons';
import { Inline } from '../components/Markdown';
import { LEVELS, topicById, type Level, type Question, type TopicId } from '@rr/content';
import {
  formatDuration,
  INTERVIEW_FORMATS,
  pickInterviewQuestions,
  SCORE_LABELS,
  verdict,
  type InterviewFormat,
  type Score,
} from '@rr/core';
import { QUESTIONS } from '../data/questions';
import { useElapsedSeconds } from '../lib/timer';

type Session = {
  level: Level;
  format: InterviewFormat;
  questions: Question[];
  startedAt: number;
  index: number;
  revealed: boolean;
  notes: Record<string, string>;
  scores: Record<string, Score>;
};

type State = { phase: 'setup' } | ({ phase: 'running' } & Session) | ({ phase: 'report'; finishedAt: number } & Session);

type Action =
  | { type: 'start'; level: Level; format: InterviewFormat }
  | { type: 'note'; text: string }
  | { type: 'reveal' }
  | { type: 'score'; score: Score }
  | { type: 'next' }
  | { type: 'finish' }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  if (action.type === 'start') {
    const format = INTERVIEW_FORMATS[action.format];
    return {
      phase: 'running',
      level: action.level,
      format: action.format,
      questions: pickInterviewQuestions(QUESTIONS, action.level, format.questions),
      startedAt: Date.now(),
      index: 0,
      revealed: false,
      notes: {},
      scores: {},
    };
  }
  if (action.type === 'reset') return { phase: 'setup' };
  if (state.phase !== 'running') return state;

  const slug = state.questions[state.index].slug;
  switch (action.type) {
    case 'note':
      return { ...state, notes: { ...state.notes, [slug]: action.text } };
    case 'reveal':
      return { ...state, revealed: true };
    case 'score':
      return { ...state, scores: { ...state.scores, [slug]: action.score } };
    case 'next':
      if (state.scores[slug] === undefined) return state;
      if (state.index + 1 >= state.questions.length) return { ...state, phase: 'report', finishedAt: Date.now() };
      return { ...state, index: state.index + 1, revealed: false };
    case 'finish':
      return { ...state, phase: 'report', finishedAt: Date.now() };
  }
}

export function InterviewPage() {
  const [state, dispatch] = useReducer(reducer, { phase: 'setup' });

  return (
    <div className="container container--narrow page">
      <title>Мок-собеседование — React Refresher</title>
      {state.phase === 'setup' && <InterviewSetup onStart={(level, format) => dispatch({ type: 'start', level, format })} />}
      {state.phase === 'running' && <InterviewRun state={state} dispatch={dispatch} />}
      {state.phase === 'report' && <InterviewReport state={state} onReset={() => dispatch({ type: 'reset' })} />}
    </div>
  );
}

function InterviewSetup({ onStart }: { onStart: (level: Level, format: InterviewFormat) => void }) {
  const [level, setLevel] = useState<Level>('middle');
  const [format, setFormat] = useState<InterviewFormat>('short');

  return (
    <>
      <header className="page-header">
        <h1>Мок-собеседование</h1>
        <p className="page-header__lead">
          Подборка вопросов под грейд: разные темы, от простого к сложному, общий таймер. Отвечайте вслух — так, как
          ответили бы интервьюеру, — коротко записывайте тезисы, затем сверяйтесь с эталоном и ставьте себе оценку.
        </p>
      </header>

      <form
        className="setup"
        onSubmit={(e) => {
          e.preventDefault();
          onStart(level, format);
        }}
      >
        <fieldset className="setup__group">
          <legend>Грейд</legend>
          <div className="option-cards">
            {LEVELS.map((l) => (
              <label key={l.id} className={`option-card ${level === l.id ? 'is-active' : ''}`}>
                <input type="radio" name="level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} />
                <LevelBadge level={l.id} />
                <span>{l.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="setup__group">
          <legend>Формат</legend>
          <div className="option-cards option-cards--2">
            {(Object.keys(INTERVIEW_FORMATS) as InterviewFormat[]).map((id) => {
              const f = INTERVIEW_FORMATS[id];
              return (
                <label key={id} className={`option-card ${format === id ? 'is-active' : ''}`}>
                  <input type="radio" name="format" value={id} checked={format === id} onChange={() => setFormat(id)} />
                  <strong>{f.title}</strong>
                  <span>{f.questions} вопросов · {f.minutes} минут</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="callout callout--note">
          <h2 className="callout__title">Как оценивать</h2>
          <ul>
            {([2, 1, 0] as Score[]).map((s) => (
              <li key={s}><strong>{SCORE_LABELS[s].label}</strong> — {SCORE_LABELS[s].hint.toLowerCase()}</li>
            ))}
          </ul>
        </div>

        <div className="setup__footer">
          <span>Таймер общий: если время выйдет, можно закончить, но это отразится в отчёте.</span>
          <button className="btn btn--primary">Начать собеседование</button>
        </div>
      </form>
    </>
  );
}

function InterviewRun({
  state,
  dispatch,
}: {
  state: Extract<State, { phase: 'running' }>;
  dispatch: React.Dispatch<Action>;
}) {
  const question = state.questions[state.index];
  const elapsed = useElapsedSeconds(state.startedAt);
  const remaining = INTERVIEW_FORMATS[state.format].minutes * 60 - elapsed;
  const score = state.scores[question.slug];
  const isLast = state.index + 1 === state.questions.length;

  return (
    <div className="session">
      <div className="session__top">
        <span>
          <LevelBadge level={state.level} /> Вопрос {state.index + 1} из {state.questions.length}
        </span>
        <span className={`timer ${remaining < 0 ? 'timer--expired' : remaining < 300 ? 'timer--warn' : ''}`} role="timer" aria-live="off">
          <IconClock /> {remaining < 0 ? `Перерасход ${formatDuration(-remaining)}` : formatDuration(remaining)}
        </span>
        <button type="button" className="link-btn" onClick={() => dispatch({ type: 'finish' })}>
          Завершить
        </button>
      </div>
      <div className="progress" aria-hidden="true">
        <div className="progress__bar" style={{ width: `${(state.index / state.questions.length) * 100}%` }} />
      </div>

      <section className="flashcard">
        <div className="flashcard__meta">
          <LevelBadge level={question.level} />
          <TopicTag topic={question.topic} />
        </div>
        <h1 className="flashcard__title">{question.title}</h1>

        <label className="notes">
          <span>Тезисы ответа (для себя)</span>
          <textarea
            value={state.notes[question.slug] ?? ''}
            onChange={(e) => dispatch({ type: 'note', text: e.target.value })}
            placeholder="Определение, зачем, пример, компромиссы…"
            rows={4}
          />
        </label>

        {!state.revealed ? (
          <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'reveal' })}>
            Сверить с эталоном
          </button>
        ) : (
          <div className="flashcard__answer">
            <div className="callout callout--answer">
              <h2 className="callout__title">Эталонный ответ</h2>
              <p><Inline text={question.short} /></p>
              <Link to={`/questions/${question.slug}`} target="_blank" className="callout__more">
                Полный разбор в новой вкладке
              </Link>
            </div>
            {question.followUps.length > 0 && (
              <div className="callout callout--follow">
                <h2 className="callout__title"><IconChat /> Интервьюер может уточнить</h2>
                <ul>{question.followUps.map((f, i) => <li key={i}><Inline text={f} /></li>)}</ul>
              </div>
            )}

            <div className="grade">
              <p className="grade__label">Ваша оценка ответа</p>
              <div className="grade__buttons" role="radiogroup" aria-label="Оценка ответа">
                {([0, 1, 2] as Score[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={score === s}
                    className={`grade__btn grade__btn--s${s} ${score === s ? 'is-active' : ''}`}
                    onClick={() => dispatch({ type: 'score', score: s })}
                    title={SCORE_LABELS[s].hint}
                  >
                    {SCORE_LABELS[s].label}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" className="btn btn--primary" disabled={score === undefined} onClick={() => dispatch({ type: 'next' })}>
              {isLast ? 'Получить отчёт' : 'Следующий вопрос'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function InterviewReport({ state, onReset }: { state: Extract<State, { phase: 'report' }>; onReset: () => void }) {
  const answered = state.questions.filter((q) => state.scores[q.slug] !== undefined);
  const total = answered.reduce((sum, q) => sum + state.scores[q.slug], 0);
  // Неотвеченные вопросы считаются как 0 — как на реальном интервью
  const percent = Math.round((total / (state.questions.length * 2)) * 100);
  const result = verdict(percent, state.level);
  const duration = Math.round((state.finishedAt - state.startedAt) / 1000);
  const limit = INTERVIEW_FORMATS[state.format].minutes * 60;

  const byTopic = new Map<TopicId, { got: number; max: number }>();
  for (const q of state.questions) {
    const entry = byTopic.get(q.topic) ?? { got: 0, max: 0 };
    entry.got += state.scores[q.slug] ?? 0;
    entry.max += 2;
    byTopic.set(q.topic, entry);
  }
  const topics = [...byTopic.entries()].sort((a, b) => a[1].got / a[1].max - b[1].got / b[1].max);
  const weakTopics = topics.filter(([, v]) => v.got / v.max < 0.75).map(([t]) => t);

  return (
    <>
      <header className="page-header">
        <h1>Отчёт о собеседовании</h1>
        <p className="page-header__lead">
          {INTERVIEW_FORMATS[state.format].title} на <LevelBadge level={state.level} /> · время {formatDuration(duration)}
          {duration > limit && <> (лимит {formatDuration(limit)})</>}
        </p>
      </header>

      <section className={`verdict verdict--${result.tone}`}>
        <div className="verdict__score">{percent}%</div>
        <div>
          <h2>{result.title}</h2>
          <p>{result.text}</p>
          {answered.length < state.questions.length && (
            <p className="muted">
              Отвечено {answered.length} из {state.questions.length} — неотвеченные засчитаны как 0.
            </p>
          )}
        </div>
      </section>

      <h2 className="article__section-title">По темам</h2>
      <ul className="topic-bars">
        {topics.map(([topic, v]) => (
          <li key={topic}>
            <span className="topic-bars__name">{topicById[topic].title}</span>
            <span className="topic-bars__track">
              <span className="topic-bars__fill" style={{ width: `${(v.got / v.max) * 100}%` }} />
            </span>
            <span className="topic-bars__value">{v.got}/{v.max}</span>
          </li>
        ))}
      </ul>

      <h2 className="article__section-title">Разбор ответов</h2>
      <ol className="report-list">
        {state.questions.map((q) => {
          const s = state.scores[q.slug];
          return (
            <li key={q.slug} className="report-item">
              <div className="report-item__head">
                <Link to={`/questions/${q.slug}`}>{q.title}</Link>
                <span className={`score-pill score-pill--s${s ?? 'none'}`}>
                  {s === undefined ? 'Без ответа' : SCORE_LABELS[s].label}
                </span>
              </div>
              {state.notes[q.slug] && <p className="report-item__notes">{state.notes[q.slug]}</p>}
            </li>
          );
        })}
      </ol>

      <div className="actions">
        {weakTopics.length > 0 && (
          <Link to={`/practice?topic=${weakTopics.join(',')}`} className="btn btn--primary">
            Тренировать слабые темы
          </Link>
        )}
        <button type="button" className="btn btn--secondary" onClick={onReset}>
          Новое собеседование
        </button>
      </div>
    </>
  );
}
