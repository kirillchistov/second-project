import { Link } from 'react-router';
import { DAILY_GOAL_XP, currentStreak, dueCount, localDay, reviewItems, type PathLesson, type PathUnit } from '@rr/core';
import { CONTENT, PATH, topicTitle } from './content';
import { useNow } from './now';
import { resetProgress } from './progress';
import { useDemoProgress } from './useProgress';

type LessonStatus = 'done' | 'next' | 'locked';

function lessonStatus(unit: PathUnit, index: number, done: Record<string, number>): LessonStatus {
  const lesson = unit.lessons[index];
  if (lesson.id in done) return 'done';
  if (index === 0 || unit.lessons[index - 1].id in done) return 'next';
  return 'locked';
}

export function PathPage() {
  const progress = useDemoProgress();
  const now = useNow();
  const today = localDay(now);
  const streak = currentStreak(Object.keys(progress.activity), today);
  const xpToday = progress.activity[today] ?? 0;
  const cards = new Map(Object.entries(progress.cards));
  const due = dueCount(cards, now);
  const reviewCount = reviewItems({ content: CONTENT, cards, backlog: progress.backlog, now }).length;

  return (
    <>
      <title>Путь — React Refresher, демо</title>
      <header className="page-header">
        <h1>Путь</h1>
        <p className="page-header__lead">
          Уроки и упражнения проверяются в браузере. Голосовой проверки и ИИ здесь нет: ответ выбирается, собирается
          или сверяется с эталоном. Прогресс, стрик и повторения хранятся в localStorage этого браузера.
        </p>
      </header>

      <div className="demo-stats">
        <div>
          <span className="demo-stats__value">{streak}</span>
          <span className="demo-stats__label">дней подряд</span>
        </div>
        <div className="demo-stats__goal">
          <span className="demo-stats__label">
            Цель дня: {Math.min(xpToday, DAILY_GOAL_XP)}/{DAILY_GOAL_XP} XP
          </span>
          <div className="progress" aria-hidden="true">
            <div className="progress__bar" style={{ width: `${Math.min(100, (xpToday / DAILY_GOAL_XP) * 100)}%` }} />
          </div>
        </div>
        <Link to="/review" className="btn btn--secondary">
          Повторение{reviewCount > 0 ? ` · ${reviewCount}` : ''}
        </Link>
      </div>
      {due > 0 && <p className="demo-due">Пора освежить {due} навыков.</p>}

      <div className="units">
        {PATH.map((unit) => (
          <Unit key={unit.id} unit={unit} done={progress.lessonsDone} />
        ))}
      </div>

      <p className="demo-reset">
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            if (window.confirm('Сбросить прогресс в этом браузере? Уроки, стрик и повторения удалятся.')) resetProgress();
          }}
        >
          Сбросить прогресс этого браузера
        </button>
      </p>
    </>
  );
}

function Unit({ unit, done }: { unit: PathUnit; done: Record<string, number> }) {
  const completed = unit.lessons.filter((lesson) => lesson.id in done).length;
  return (
    <section className="unit">
      <div className="unit__head">
        <p className="unit__branch">feature/{unit.id}</p>
        <h2>{unit.title}</h2>
        <p>{unit.goal}</p>
        <div className="unit__meter">
          <div className="progress" aria-hidden="true">
            <div className="progress__bar" style={{ width: `${(completed / unit.lessons.length) * 100}%` }} />
          </div>
          <span>
            {completed}/{unit.lessons.length}
          </span>
        </div>
      </div>
      <ol className="commits">
        {unit.lessons.map((lesson, index) => (
          <Commit key={lesson.id} lesson={lesson} status={lessonStatus(unit, index, done)} last={index === unit.lessons.length - 1} />
        ))}
      </ol>
    </section>
  );
}

function Commit({ lesson, status, last }: { lesson: PathLesson; status: LessonStatus; last: boolean }) {
  const locked = status === 'locked';
  const body = (
    <>
      <span className="commit__hash">
        {lesson.hash} · урок {lesson.index}
        {lesson.exercises.length > 0 ? ` · ${lesson.exercises.length} практ.` : ''}
      </span>
      {lesson.questions.map((question) => (
        <span key={question.slug} className="commit__title">
          <span className="commit__topic">{topicTitle.get(question.topic)}</span>
          {question.title}
        </span>
      ))}
    </>
  );
  return (
    <li className={`commit commit--${status} ${last ? 'is-last' : ''}`}>
      {locked ? (
        <div className="commit__link" aria-disabled="true">{body}</div>
      ) : (
        <Link to={`/lesson/${lesson.id}`} className="commit__link">{body}</Link>
      )}
    </li>
  );
}
