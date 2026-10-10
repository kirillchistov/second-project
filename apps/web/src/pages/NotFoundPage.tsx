import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="container container--narrow page empty">
      <title>Не найдено — React Refresher</title>
      <h1>Страница не найдена</h1>
      <p>Возможно, вопрос переехал. Попробуйте поиск или вернитесь к списку.</p>
      <Link to="/questions" className="btn btn--primary">К вопросам</Link>
    </div>
  );
}
