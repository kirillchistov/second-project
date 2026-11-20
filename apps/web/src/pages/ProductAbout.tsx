import { Link } from 'react-router';
import { SITE_NAME } from '../catalog/site';

export function ProductAbout() {
  return (
    <div className="container container--narrow page">
      <title>О проекте — {SITE_NAME}</title>
      <header className="page-header">
        <h1>О проекте</h1>
        <p className="page-header__lead">
          {SITE_NAME} — короткий путь для продакта на том же движке уроков, что и React Refresher.
          Свой каталог, свои уроки и свой прогресс. Банк вопросов по React сюда не входит.
        </p>
      </header>
      <div className="prose">
        <h2>Как пользоваться</h2>
        <ul>
          <li>
            <strong><Link to="/learn">Путь</Link></strong> — два урока: бриф, дерево возможностей и one-pager, затем карточка эксперимента.
          </li>
          <li>
            <strong><Link to="/questions">Шаблоны</Link></strong> — текст, который копируют в рабочий документ. Рядом квиз: когда шаблон уместен и какой выбор в нём ошибочен.
          </li>
          <li>Голосовые ответы, оценка свободного текста и проверка кода или SQL в этот тренажёр не входят.</li>
        </ul>
      </div>
    </div>
  );
}
