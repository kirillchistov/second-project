import { Link } from 'react-router';
import { LevelBadge } from '../components/Badges';
import { LEGACY } from '@rr/content';
import { questionBySlug } from '../data/questions';

export function AboutPage() {
  return (
    <div className="container container--narrow page">
      <title>О проекте — React Refresher</title>
      <header className="page-header">
        <h1>О проекте</h1>
        <p className="page-header__lead">
          React Refresher — обновлённая версия популярного списка «React JS: 50 вопросов на собеседование».
          Список расширен до 100 вопросов, разбит на три уровня и переписан под современный React.
        </p>
      </header>

      <div className="prose">
        <h2>Как пользоваться</h2>
        <ul>
          <li>
            <strong><Link to="/questions">Каталог</Link></strong> — читайте вопрос, пробуйте ответить сами, затем
            сверяйтесь с кратким ответом. Краткий ответ — то, что стоит сказать в первые 30 секунд, подробный разбор —
            чтобы выдержать уточняющие вопросы.
          </li>
          <li>
            <strong><Link to="/practice">Тренировка</Link></strong> — карточки по выбранным уровням и темам с
            самооценкой и списком того, что повторить.
          </li>
          <li>
            <strong><Link to="/interview">Мок-собеседование</Link></strong> — подборка под грейд с общим таймером и
            отчётом по темам.
          </li>
          <li>Горячие клавиши: <code>⌘K</code> или <code>/</code> — поиск; в тренировке <code>Пробел</code> — показать ответ, <code>1</code>–<code>3</code> — оценка.</li>
        </ul>

        <h2>Принципы ответов</h2>
        <ul>
          <li>Актуальность на React 19.2 и React Compiler 1.0; устаревшие API упоминаются только для контекста и миграции.</li>
          <li>Примеры кода — на TypeScript, без классов там, где они не нужны.</li>
          <li>У каждого ответа есть ссылки на первоисточники: react.dev и документацию библиотек.</li>
          <li>Отдельно — подводные камни и вопросы, которые интервьюер задаст следом.</li>
        </ul>
      </div>

      <section id="changes" className="changes">
        <h2 className="article__section-title">Что стало со старыми вопросами</h2>
        <p className="muted">
          Все 50 вопросов исходного списка сохранены: одни переписаны, другие объединены или заменены более
          актуальной формулировкой.
        </p>
        <div className="table-wrap">
          <table className="changes-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Старый вопрос</th>
                <th>Новый вопрос</th>
              </tr>
            </thead>
            <tbody>
              {LEGACY.map((l) => {
                const q = questionBySlug.get(l.target)!;
                return (
                  <tr key={l.number}>
                    <td className="changes-table__num">{l.number}</td>
                    <td>
                      {l.title}
                      {l.note && <span className="changes-table__note">{l.note}</span>}
                    </td>
                    <td>
                      <Link to={`/questions/${q.slug}`}>
                        {q.number}. {q.title}
                      </Link>{' '}
                      <LevelBadge level={q.level} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
