import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router';
import { PATH } from './content';

/**
 * Лендинг для тех, у кого ещё нет прогресса: что это за тренажёр и почему он работает.
 * Анимации запускаются, когда блок попадает в экран; при prefers-reduced-motion сразу видно итоговое состояние.
 */

/** Класс `is-visible`, когда элемент впервые попал в экран */
function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  // Без IntersectionObserver показываем всё сразу
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  return [ref, visible];
}

/** Число, которое «набегает» от 0 до значения за duration мс */
function useCountUp(target: number, run: boolean, duration = 1600): number {
  const [value, setValue] = useState(0);
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!run || reduced) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, run, duration, reduced]);
  return reduced && run ? target : value;
}

function Section({ className, children }: { className: string; children: (visible: boolean) => ReactNode }) {
  const [ref, visible] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`landing__block ${className} ${visible ? 'is-visible' : ''}`}>
      {children(visible)}
    </section>
  );
}

const COMMITS = ['Ядро React', 'Хуки в деталях', 'Состояние и данные', 'React 19+', 'SSR и RSC'];

function Hero({ start }: { start: string }) {
  const [ref, visible] = useInView<HTMLDivElement>();
  const xp = useCountUp(30, visible);
  const streak = useCountUp(14, visible, 1900);
  return (
    <section className="landing__block landing__hero">
      <div className="landing__hero-text">
        <p className="landing__eyebrow">Тренажёр для React-разработчиков</p>
        <h1>
          Пять минут в день —
          <br />
          <span className="landing__accent">и React не выветривается</span>
        </h1>
        <p className="landing__lead">
          Короткие уроки по 140 вопросам собеседования: предскажи вывод, найди баг, собери хук, расставь шаги.
          Интервальное повторение возвращает тему ровно тогда, когда ты начинаешь её забывать.
        </p>
        <div className="landing__actions">
          <Link to={start} className="btn btn--primary">Начать первый урок</Link>
          <a href="#how" className="btn btn--secondary">Как это работает</a>
        </div>
      </div>

      <div ref={ref} className={`landing__branch ${visible ? 'is-visible' : ''}`} aria-hidden="true">
        <div className="landing__branch-stats">
          <span><b>{streak}</b> дней подряд</span>
          <span><b>{xp}</b>/30 XP</span>
        </div>
        <div className="landing__xp"><div className="landing__xp-bar" /></div>
        <ol className="landing__commits">
          {COMMITS.map((title, i) => (
            <li key={title} style={{ '--i': i } as CSSProperties}>
              <span className="landing__node" />
              <span className="landing__commit-hash">{['c742f54', 'a19e0b3', '5d0c7e1', '0fb2d96', 'e83a4c2'][i]}</span>
              <span className="landing__commit-title">{title}</span>
            </li>
          ))}
        </ol>
        <p className="landing__release">v1.0 Middle</p>
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', title: 'Попробуй', text: 'Сначала задание, потом теория. Ответ из головы запоминается лучше, чем перечитанный конспект.' },
  { n: '02', title: 'Ошибись спокойно', text: 'Ошибка не отнимает жизнь: задание вернётся в конце урока, а навык попадёт в Bug Backlog.' },
  { n: '03', title: 'Вернись вовремя', text: 'Алгоритм FSRS считает, когда ты начнёшь забывать, и подкладывает тему в повторение.' },
];

/** Кривые для схемы: без повторений память падает, с повторениями — каждый раз медленнее */
const FORGET = 'M 0 10 C 60 90, 140 150, 400 175';
const REVIEWED =
  'M 0 10 C 25 45, 50 60, 70 66 L 70 12 C 110 40, 150 52, 180 55 L 180 14 C 240 32, 300 40, 330 42 L 330 16 C 360 22, 385 26, 400 27';

const TYPES = [
  ['Предскажи вывод', 'порядок рендеров, эффектов и микрозадач'],
  ['Найди баг', 'тапни строку и назови причину'],
  ['Собери код', 'хук из перемешанных строк с ловушками'],
  ['Заполни пропуски', 'клавиатура из токенов вместо печати'],
  ['Расставь шаги', 'алгоритм отладки или таймлайн гидрации'],
  ['Выбери инструмент', 'класс задачи → подходящая технология'],
  ['Объясни своими словами', 'и сверь с эталонным ответом'],
];

const WEEKS = 18;

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}

export function Landing({ onSkip }: { onSkip: () => void }) {
  const start = `/lesson/${PATH[0].lessons[0].id}`;
  const lessons = PATH.reduce((sum, unit) => sum + unit.lessons.length, 0);

  return (
    <div className="landing">
      <Hero start={start} />

      <Section className="landing__how">
        {() => (
          <>
            <h2 id="how">Как устроен урок</h2>
            <div className="landing__steps">
              {STEPS.map((s, i) => (
                <article key={s.n} className="landing__step" style={{ '--i': i } as CSSProperties}>
                  <span className="landing__step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section className="landing__curve">
        {() => (
          <>
            <h2>Почему повторение, а не марафон</h2>
            <p className="landing__lead">
              Без практики большая часть нового забывается за пару недель. Каждое повторение в нужный момент делает
              спад медленнее — и следующего повторения можно ждать дольше.
            </p>
            <figure className="landing__chart">
              <svg viewBox="0 0 400 190" role="img" aria-label="Кривая забывания без повторений падает почти до нуля, с повторениями остаётся высокой">
                <line x1="0" y1="186" x2="400" y2="186" className="landing__axis" />
                <path d={FORGET} className="landing__line landing__line--forget" pathLength={1} />
                <path d={REVIEWED} className="landing__line landing__line--review" pathLength={1} />
                {[70, 180, 330].map((x, i) => (
                  <circle key={x} cx={x} cy={[12, 14, 16][i]} r="5" className="landing__dot" style={{ '--i': i } as CSSProperties} />
                ))}
              </svg>
              <figcaption>
                <span className="landing__legend landing__legend--review">с повторениями</span>
                <span className="landing__legend landing__legend--forget">без повторений</span>
              </figcaption>
            </figure>
          </>
        )}
      </Section>

      <Section className="landing__types">
        {() => (
          <>
            <h2>Задания под палец, а не под клавиатуру</h2>
            <ul className="landing__chips">
              {TYPES.map(([title, hint], i) => (
                <li key={title} style={{ '--i': i } as CSSProperties}>
                  <b>{title}</b>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section className="landing__final">
        {() => (
          <>
            <div className="landing__graph" aria-hidden="true">
              {Array.from({ length: WEEKS * 7 }, (_, i) => {
                // Стабильная псевдослучайная «активность», к правому краю гуще — привычка складывается
                const week = Math.floor(i / 7);
                const rnd = (Math.imul(i + 1, 2654435761) >>> 0) / 2 ** 32;
                const active = rnd < 0.15 + (week / WEEKS) * 0.8;
                const level = active ? 1 + (Math.imul(i + 7, 40503) >>> 4) % 4 : 0;
                return <span key={i} className={`landing__cell is-l${level}`} style={{ '--i': i } as CSSProperties} />;
              })}
            </div>
            <h2>Зелёные клетки складываются в привычку</h2>
            <p className="landing__lead">
              {plural(lessons, 'урок', 'урока', 'уроков')} в {plural(PATH.length, 'юните', 'юнитах', 'юнитах')} — от JSX до архитектуры и fullstack. Прогресс хранится в этом браузере,
              регистрация не нужна.
            </p>
            <div className="landing__actions">
              <Link to={start} className="btn btn--primary">Начать первый урок</Link>
              <button type="button" className="btn btn--secondary" onClick={onSkip}>Посмотреть весь путь</button>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
