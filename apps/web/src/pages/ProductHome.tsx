import { Link } from 'react-router';
import { IconArrowRight, Logo } from '../components/Icons';
import { SITE_NAME } from '../catalog/site';

const TEMPLATES = [
  { slug: 'problem-brief', title: 'Бриф проблемы', text: 'Кто страдает, в какой ситуации и какое свидетельство это подтвердит.' },
  { slug: 'opportunity-tree', title: 'Дерево возможностей', text: 'Исход, возможности из исследований и несколько решений под каждой.' },
  { slug: 'one-pager', title: 'One-pager', text: 'Одно решение: подход, что не делаем, и одна метрика исхода.' },
  { slug: 'experiment-card', title: 'Карточка эксперимента', text: 'Гипотеза, метрика и правило решения — до того, как смотреть график.' },
];

export function ProductHome() {
  return (
    <>
      <title>Практикум продукта</title>
      <section className="hero">
        <div className="hero__logo"><Logo size={72} /></div>
        <h1 className="hero__title">{SITE_NAME}</h1>
        <p className="hero__subtitle">
          Короткий путь от проблемы до эксперимента: теория, квиз и шаблон, который можно забрать в работу.
        </p>
        <div className="hero__actions">
          <Link to="/learn" className="btn btn--primary">
            Начать путь <IconArrowRight />
          </Link>
          <Link to="/questions" className="btn btn--secondary">
            Смотреть шаблоны
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section__title">Четыре шаблона</h2>
          <p className="section__lead">
            Каждый шаблон лежит в разборе вопроса. Квиз рядом проверяет, когда он уместен и какой выбор в нём ошибочен.
          </p>
          <div className="grid grid--3">
            {TEMPLATES.map((template) => (
              <Link key={template.slug} to={`/questions/${template.slug}`} className="card card--mode">
                <h3>{template.title}</h3>
                <p>{template.text}</p>
                <span className="card__cta">Открыть шаблон <IconArrowRight /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
