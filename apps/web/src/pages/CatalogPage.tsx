import { Link, useSearchParams } from 'react-router';
import { LevelBadge, TopicTag } from '../components/Badges';
import { IconSearch } from '../components/Icons';
import { Inline } from '../components/Markdown';
import { LEVELS, TOPICS, type Level, type TopicId } from '@rr/content';
import { plural } from '@rr/core';
import { filterQuestions, QUESTIONS } from '../data/questions';

const LEVEL_IDS = LEVELS.map((l) => l.id);
const TOPIC_IDS = TOPICS.map((t) => t.id);

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const levelParam = params.get('level') as Level | null;
  const topicParam = params.get('topic') as TopicId | null;
  const level = levelParam && LEVEL_IDS.includes(levelParam) ? levelParam : null;
  const topic = topicParam && TOPIC_IDS.includes(topicParam) ? topicParam : null;
  const query = params.get('q') ?? '';

  const results = filterQuestions({
    levels: level ? [level] : undefined,
    topics: topic ? [topic] : undefined,
    query,
  });

  function update(key: string, value: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key === 'q' },
    );
  }

  const countFor = (filter: { level?: Level; topic?: TopicId }) =>
    QUESTIONS.filter((q) => (!filter.level || q.level === filter.level) && (!filter.topic || q.topic === filter.topic)).length;

  return (
    <div className="docs">
      <aside className="sidebar" aria-label="Фильтры">
        <div className="sidebar__group">
          <h2 className="sidebar__heading">Уровень</h2>
          <button type="button" className={`sidebar__item ${!level ? 'is-active' : ''}`} onClick={() => update('level', null)}>
            Все уровни <span>{QUESTIONS.length}</span>
          </button>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`sidebar__item ${level === l.id ? 'is-active' : ''}`}
              onClick={() => update('level', level === l.id ? null : l.id)}
            >
              {l.title} <span>{countFor({ level: l.id })}</span>
            </button>
          ))}
        </div>
        <div className="sidebar__group">
          <h2 className="sidebar__heading">Тема</h2>
          <button type="button" className={`sidebar__item ${!topic ? 'is-active' : ''}`} onClick={() => update('topic', null)}>
            Все темы
          </button>
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`sidebar__item ${topic === t.id ? 'is-active' : ''}`}
              onClick={() => update('topic', topic === t.id ? null : t.id)}
            >
              {t.title} <span>{countFor({ level: level ?? undefined, topic: t.id })}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="docs__content">
        <title>Вопросы — React Refresher</title>
        <header className="page-header">
          <h1>Вопросы</h1>
          <p className="page-header__lead">
            Сначала попробуйте ответить сами, затем откройте вопрос — там краткий ответ для собеседования,
            подробное объяснение, подводные камни и что могут спросить дальше.
          </p>
        </header>

        <div className="filters-mobile">
          <select value={level ?? ''} onChange={(e) => update('level', e.target.value || null)} aria-label="Уровень">
            <option value="">Все уровни</option>
            {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <select value={topic ?? ''} onChange={(e) => update('topic', e.target.value || null)} aria-label="Тема">
            <option value="">Все темы</option>
            {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        <label className="search-field">
          <IconSearch />
          <input
            type="search"
            value={query}
            onChange={(e) => update('q', e.target.value || null)}
            placeholder="Фильтр по тексту или номеру вопроса"
            aria-label="Фильтр по тексту"
          />
        </label>

        <p className="results-count" aria-live="polite">
          {results.length} {plural(results.length, ['вопрос', 'вопроса', 'вопросов'])}
          {(level || topic || query) && (
            <button type="button" className="link-btn" onClick={() => setParams({})}>
              Сбросить фильтры
            </button>
          )}
        </p>

        {LEVELS.map((l) => {
          const items = results.filter((q) => q.level === l.id);
          if (items.length === 0) return null;
          return (
            <section key={l.id} className="question-group">
              <h2 className="question-group__title">
                <LevelBadge level={l.id} /> <span>{l.description}</span>
              </h2>
              <ol className="question-list">
                {items.map((q) => (
                  <li key={q.slug}>
                    <Link to={`/questions/${q.slug}`} className="question-row">
                      <span className="question-row__num">{q.number}</span>
                      <span className="question-row__body">
                        <span className="question-row__title">{q.title}</span>
                        <span className="question-row__short"><Inline text={q.short} /></span>
                      </span>
                      <TopicTag topic={q.topic} />
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        {results.length === 0 && (
          <div className="empty">
            <p>По этим фильтрам ничего не нашлось.</p>
            <button type="button" className="btn btn--secondary" onClick={() => setParams({})}>Показать все вопросы</button>
          </div>
        )}
      </div>
    </div>
  );
}
