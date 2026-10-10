import { Link, useParams } from 'react-router';
import { LevelBadge, TopicTag } from '../components/Badges';
import { IconAlert, IconArrowLeft, IconArrowRight, IconChat, IconHistory, IconLink } from '../components/Icons';
import { Inline, Markdown } from '../components/Markdown';
import { levelTitle, topicById } from '@rr/content';
import { QUESTIONS, questionBySlug } from '../data/questions';
import { NotFoundPage } from './NotFoundPage';

export function QuestionPage() {
  const { slug } = useParams();
  const question = slug ? questionBySlug.get(slug) : undefined;
  if (!question) return <NotFoundPage />;

  const index = question.number - 1;
  const prev = QUESTIONS[index - 1];
  const next = QUESTIONS[index + 1];
  const sameLevel = QUESTIONS.filter((q) => q.level === question.level);

  return (
    <div className="docs">
      <aside className="sidebar sidebar--questions" aria-label={`Вопросы уровня ${levelTitle[question.level]}`}>
        <h2 className="sidebar__heading">{levelTitle[question.level]}</h2>
        <ol className="sidebar__list">
          {sameLevel.map((q) => (
            <li key={q.slug}>
              <Link
                to={`/questions/${q.slug}`}
                className={`sidebar__link ${q.slug === question.slug ? 'is-active' : ''}`}
                aria-current={q.slug === question.slug ? 'page' : undefined}
                ref={q.slug === question.slug ? (node) => node?.scrollIntoView({ block: 'nearest' }) : undefined}
              >
                <span className="sidebar__num">{q.number}</span>
                {q.title}
              </Link>
            </li>
          ))}
        </ol>
      </aside>

      <article className="docs__content article">
        <title>{`${question.number}. ${question.title} — React Refresher`}</title>
        <nav className="breadcrumbs" aria-label="Хлебные крошки">
          <Link to="/questions">Вопросы</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/questions?level=${question.level}`}>{levelTitle[question.level]}</Link>
          <span aria-hidden="true">/</span>
          <TopicTag topic={question.topic} link />
        </nav>

        <header className="article__header">
          <div className="article__meta">
            <span className="article__num">Вопрос {question.number} из {QUESTIONS.length}</span>
            <LevelBadge level={question.level} />
          </div>
          <h1>{question.title}</h1>
        </header>

        <section className="callout callout--answer" aria-labelledby="short-answer">
          <h2 id="short-answer" className="callout__title">Краткий ответ</h2>
          <p><Inline text={question.short} /></p>
        </section>

        <h2 className="article__section-title">Подробнее</h2>
        <Markdown source={question.body} />

        {question.pitfalls.length > 0 && (
          <section className="callout callout--pitfall" aria-labelledby="pitfalls">
            <h2 id="pitfalls" className="callout__title"><IconAlert /> Подводные камни</h2>
            <ul>{question.pitfalls.map((p, i) => <li key={i}><Inline text={p} /></li>)}</ul>
          </section>
        )}

        {question.followUps.length > 0 && (
          <section className="callout callout--follow" aria-labelledby="follow-ups">
            <h2 id="follow-ups" className="callout__title"><IconChat /> Что спросят дальше</h2>
            <ul>{question.followUps.map((f, i) => <li key={i}><Inline text={f} /></li>)}</ul>
          </section>
        )}

        {question.links.length > 0 && (
          <section className="links" aria-labelledby="links">
            <h2 id="links" className="article__section-title">Почитать</h2>
            <ul>
              {question.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noreferrer"><IconLink /> {l.label}</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {question.legacy && (
          <p className="legacy-note">
            <IconHistory /> Обновлённая версия вопроса №{question.legacy} из{' '}
            <Link to="/about#changes">старого списка из 50 вопросов</Link>.
          </p>
        )}

        <div className="article__train">
          <Link to={`/practice?topic=${question.topic}`} className="btn btn--secondary">
            Потренировать тему «{topicById[question.topic].title}»
          </Link>
        </div>

        <nav className="pager" aria-label="Соседние вопросы">
          {prev ? (
            <Link to={`/questions/${prev.slug}`} className="pager__link">
              <span className="pager__label"><IconArrowLeft /> Предыдущий</span>
              <span className="pager__title">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/questions/${next.slug}`} className="pager__link pager__link--next">
              <span className="pager__label">Следующий <IconArrowRight /></span>
              <span className="pager__title">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
}
