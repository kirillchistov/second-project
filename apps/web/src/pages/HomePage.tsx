import { Link } from 'react-router';
import { IconArrowRight, IconBook, IconBolt, IconBriefcase, IconSearch, Logo } from '../components/Icons';
import { LEVELS, TOPICS } from '@rr/content';
import { QUESTIONS } from '../data/questions';
import { openSearch } from '../lib/search';

const MODES = [
  {
    to: '/questions',
    icon: IconBook,
    title: 'Каталог',
    text: 'Все 100 вопросов с краткими и развёрнутыми ответами, примерами на TypeScript и ссылками на документацию.',
    cta: 'Открыть каталог',
  },
  {
    to: '/practice',
    icon: IconBolt,
    title: 'Тренировка',
    text: 'Случайная подборка по уровням и темам: сначала отвечаете сами, потом сверяетесь и честно оцениваете себя.',
    cta: 'Начать тренировку',
  },
  {
    to: '/interview',
    icon: IconBriefcase,
    title: 'Мок-собеседование',
    text: 'Сессия под выбранный грейд с общим таймером, уточняющими вопросами и итоговым разбором слабых тем.',
    cta: 'Пройти собеседование',
  },
];

export function HomePage() {
  const countByLevel = (id: string) => QUESTIONS.filter((q) => q.level === id).length;
  const countByTopic = (id: string) => QUESTIONS.filter((q) => q.topic === id).length;

  return (
    <>
      <title>React Refresher — 100 вопросов для собеседования</title>
      <section className="hero">
        <div className="hero__logo"><Logo size={72} /></div>
        <h1 className="hero__title">React Refresher</h1>
        <p className="hero__subtitle">
          100 актуальных вопросов для собеседования на React-разработчика — от Junior до Senior.
          Обновлено под React 19, Server Components и React Compiler.
        </p>
        <div className="hero__actions">
          <Link to="/questions" className="btn btn--primary">
            Смотреть вопросы <IconArrowRight />
          </Link>
          <Link to="/interview" className="btn btn--secondary">
            Мок-собеседование
          </Link>
        </div>
        <button type="button" className="hero__search" onClick={openSearch}>
          <IconSearch /> Быстрый поиск <kbd>⌘K</kbd>
        </button>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section__title">Три уровня</h2>
          <p className="section__lead">
            Вопросы идут по нарастающей: от того, что спросят у каждого, до внутреннего устройства и архитектуры.
          </p>
          <div className="grid grid--3">
            {LEVELS.map((level) => (
              <Link key={level.id} to={`/questions?level=${level.id}`} className={`card card--level card--${level.id}`}>
                <span className={`badge badge--${level.id}`}>{level.title}</span>
                <span className="card__count">{countByLevel(level.id)} вопросов</span>
                <p>{level.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container">
          <h2 className="section__title">Как готовиться</h2>
          <div className="grid grid--3">
            {MODES.map(({ to, icon: Icon, title, text, cta }) => (
              <Link key={to} to={to} className="card card--mode">
                <span className="card__icon"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="card__cta">{cta} <IconArrowRight /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section__title">Темы</h2>
          <div className="topic-grid">
            {TOPICS.map((t) => (
              <Link key={t.id} to={`/questions?topic=${t.id}`} className="topic-card">
                <span className="topic-card__title">{t.title}</span>
                <span className="topic-card__desc">{t.description}</span>
                <span className="topic-card__count">{countByTopic(t.id)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container callout-wide">
          <div>
            <h2 className="section__title">Что изменилось со старой версии</h2>
            <p className="section__lead">
              Исходный список из 50 вопросов писался во времена классов, <code>eject</code> и <code>mapStateToProps</code>.
              Все старые вопросы сохранены — переписаны, объединены или заменены актуальными, а список вырос до 100.
            </p>
          </div>
          <Link to="/about#changes" className="btn btn--secondary">
            Таблица изменений <IconArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
