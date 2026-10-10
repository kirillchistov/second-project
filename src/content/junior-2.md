# Как React обрабатывает события?
@slug events
@topic basics
@legacy 18

> React навешивает обработчики не на каждый элемент, а на корневой контейнер приложения (делегирование, с React 17 — на root, а не на `document`). В обработчик приходит SyntheticEvent — кроссбраузерная обёртка над нативным событием с тем же API (`stopPropagation`, `preventDefault`, `target`). Обработчики передаются как функции в camelCase-пропсах: `onClick`, `onChange`, `onSubmit`.

```tsx
function SearchForm({ onSearch }: { onSearch: (q: string) => void }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();                       // return false в React не работает
    const data = new FormData(e.currentTarget);
    onSearch(String(data.get('q')));
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="q" />
      <button>Найти</button>
    </form>
  );
}
```

Детали, которые любят спрашивать:

- **Передавайте функцию, а не вызов:** `onClick={handleClick}`, а не `onClick={handleClick()}`. Для аргументов — стрелка: `onClick={() => remove(id)}`.
- **Всплытие и перехват.** События всплывают по дереву React-компонентов. Фаза перехвата — суффикс `Capture`: `onClickCapture`.
- **Порталы.** Событие из портала всплывает по дереву *React*, а не DOM: родитель портала получит клик, даже если в DOM модалка лежит в `body`.
- **`onChange` в React** срабатывает на каждый ввод (как нативный `input`), а не при потере фокуса.
- **Event pooling** (переиспользование объектов событий) удалён в React 17 — `e.persist()` больше не нужен.

### Подводные камни
- `onClick={handleClick()}` вызывает функцию при рендере, а не при клике.
- Нативный `addEventListener` в эффекте без cleanup — утечка и двойные обработчики в Strict Mode.

### Что спросят дальше
- Почему в React 17 делегирование перенесли с `document` на root?
- Как остановить всплытие из портала?

### Ссылки
- [Responding to Events](https://react.dev/learn/responding-to-events)
- [React event object](https://react.dev/reference/react-dom/components/common#react-event-object)

# Чем отличаются контролируемые и неконтролируемые компоненты?
@slug controlled-vs-uncontrolled
@topic basics
@legacy 16

> Контролируемый компонент получает значение из state через `value` и сообщает об изменениях через `onChange` — источником истины является React. Неконтролируемый хранит значение сам (в DOM), а React читает его при необходимости — через `ref`, `FormData` или form action. Термин применим и к своим компонентам: «контролируемый» — тот, чьё поведение задаётся props, а не внутренним state.

```tsx
// Контролируемый: можно валидировать и форматировать на лету
const [email, setEmail] = useState('');
<input value={email} onChange={(e) => setEmail(e.target.value)} />;

// Неконтролируемый: значение читаем при отправке
<form action={(formData) => subscribe(formData.get('email'))}>
  <input name="email" defaultValue="" />
  <button>Подписаться</button>
</form>;
```

Когда что выбирать:

- **Контролируемый** — если UI должен реагировать на каждый ввод: маски, мгновенная валидация, зависимые поля, кнопка disabled.
- **Неконтролируемый** — простые формы, интеграция с не-React кодом, файловые инпуты (`<input type="file">` всегда неконтролируемый). В React 19 form actions делают такой подход удобным «из коробки».
- Библиотека **React Hook Form** по умолчанию работает с неконтролируемыми полями ради производительности.

### Подводные камни
- `value` без `onChange` — поле становится read-only, React выведет предупреждение.
- Переход `value={undefined}` → `value="..."` превращает неконтролируемое поле в контролируемое — предупреждение. Инициализируйте пустой строкой.

### Что спросят дальше
- Как сделать свой компонент, который поддерживает оба режима?
- Почему React Hook Form быстрее «наивной» контролируемой формы?

### Ссылки
- [Controlling an input with a state variable](https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable)
- [Controlled and uncontrolled components](https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components)

# Что такое фрагменты и зачем они нужны?
@slug fragments
@topic basics
@legacy 17

> Фрагмент позволяет вернуть несколько элементов без лишней обёртки в DOM. Короткий синтаксис — `<>...</>`; если нужен `key` (например, в списке), используется полная форма `<Fragment key={...}>`.

```tsx
import { Fragment } from 'react';

function Glossary({ items }: { items: { id: string; term: string; text: string }[] }) {
  return (
    <dl>
      {items.map((item) => (
        <Fragment key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.text}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

Зачем это важно:

- **Валидная разметка.** Внутри `<table>`, `<ul>`, `<dl>` лишний `<div>` ломает HTML-семантику и доступность.
- **CSS-раскладка.** Лишние обёртки ломают flex/grid-контейнеры, где важны прямые потомки.
- **Чище DOM.** Меньше узлов, проще стили и отладка.

### Подводные камни
- У `<>` нельзя указать `key` и другие атрибуты.

### Что спросят дальше
- Как вернуть из компонента массив элементов и чем это хуже фрагмента?

### Ссылки
- [Fragment — reference](https://react.dev/reference/react/Fragment)

# Что такое useEffect и когда он действительно нужен?
@slug use-effect-basics
@topic hooks
@legacy 13

> `useEffect` синхронизирует компонент с внешней системой: сетью, подписками, таймерами, DOM-API, сторонними виджетами. Эффект запускается после того, как React применил изменения к экрану, повторяется при изменении зависимостей, а функция cleanup вызывается перед следующим запуском и при размонтировании.

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    return () => connection.disconnect();   // cleanup
  }, [roomId]);                              // переподключиться при смене комнаты

  return <h1>Комната {roomId}</h1>;
}
```

Массив зависимостей:

- `[a, b]` — запуск после первого рендера и когда `a` или `b` изменились (сравнение `Object.is`);
- `[]` — только после монтирования (и cleanup при размонтировании);
- без массива — после каждого рендера.

Чего **не** стоит делать в эффекте: вычислять данные для рендера (считайте прямо в теле компонента), реагировать на действия пользователя (это работа обработчика событий), сбрасывать state при смене props (используйте `key`).

Загрузка данных в эффекте возможна, но требует обработки гонок и cleanup. В реальных проектах её чаще отдают библиотекам (TanStack Query, SWR) или фреймворку (loaders, Server Components).

В Strict Mode в режиме разработки React монтирует компонент, сразу размонтирует и монтирует снова — чтобы проверить, что cleanup корректен. Это не баг.

### Подводные камни
- Пропущенные зависимости — эффект видит устаревшие значения (stale closure). Доверяйте линтеру `react-hooks/exhaustive-deps`.
- Объекты и функции, создаваемые в рендере, в зависимостях — эффект срабатывает на каждом рендере.

### Что спросят дальше
- Почему эффект запускается дважды в разработке?
- Как избежать гонки при загрузке данных в эффекте?
- Чем useEffect отличается от useLayoutEffect?

### Ссылки
- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [useEffect — reference](https://react.dev/reference/react/useEffect)

# Что такое ref и useRef?
@slug use-ref
@topic hooks
@legacy 8

> `useRef(initial)` возвращает изменяемый объект `{ current }`, который живёт столько же, сколько компонент. Изменение `ref.current` не вызывает рендер. Два главных применения: доступ к DOM-узлу (фокус, скролл, размеры, интеграция с библиотеками) и хранение значения «вне рендера» — id таймера, предыдущее значение, экземпляр стороннего объекта.

```tsx
function SearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  function focus() {
    inputRef.current?.focus();
  }

  function startPolling() {
    timerRef.current = window.setInterval(poll, 5000);
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return <input ref={inputRef} />;
}
```

`useRef` vs `createRef`: `createRef` создаёт новый объект при каждом вызове и использовался в классах (в конструкторе). В функциональном компоненте `createRef` вернул бы новый ref на каждом рендере — поэтому там нужен `useRef`.

В React 19 `ref` можно передавать в свой компонент как обычный prop — `forwardRef` больше не нужен. Также ref-колбэк может возвращать функцию очистки.

```tsx
function TextField({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} />;
}
```

### Подводные камни
- Читать или писать `ref.current` во время рендера (кроме ленивой инициализации) — результат непредсказуем, особенно в конкурентном режиме.
- Использовать ref вместо state для данных, которые показываются на экране, — UI не обновится.

### Что спросят дальше
- Как получить ref на элемент внутри своего компонента?
- Что такое useImperativeHandle?
- Как хранить предыдущее значение props?

### Ссылки
- [Referencing Values with Refs](https://react.dev/learn/referencing-values-with-refs)
- [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs)
- [useRef — reference](https://react.dev/reference/react/useRef)

# Какой жизненный цикл у функционального компонента?
@slug lifecycle
@topic rendering
@legacy 15

> У компонента три этапа: монтирование (появление в дереве), обновления (повторные рендеры при изменении state, props или контекста) и размонтирование (удаление). В функциональных компонентах нет методов жизненного цикла — вместо них эффекты, которые синхронизируются с внешним миром и очищаются при изменении зависимостей или размонтировании.

Соответствие «классы → хуки» (полезно знать для поддержки legacy-кода):

| Класс | Функциональный компонент |
|---|---|
| `constructor` | `useState` (ленивая инициализация) |
| `componentDidMount` | `useEffect(fn, [])` |
| `componentDidUpdate` | `useEffect(fn, [deps])` |
| `componentWillUnmount` | cleanup-функция эффекта |
| `shouldComponentUpdate` | `React.memo` |
| `getDerivedStateFromProps` | вычисление в рендере или `key` |
| `componentDidCatch` | нет аналога — только классовый Error Boundary |

Порядок для одного обновления: React вызывает функции компонентов (render) → обновляет DOM (commit) → запускает `useLayoutEffect` синхронно → браузер рисует кадр → запускаются `useEffect`.

«Компонент смонтирован» (mounted) значит, что его результат вставлен в DOM и эффекты монтирования отработали.

Важно сменить мышление: эффект — это не «код при монтировании», а синхронизация с внешней системой, которая может запускаться и останавливаться много раз.

### Подводные камни
- Думать о `useEffect(fn, [])` как о точном аналоге `componentDidMount` — в Strict Mode он выполнится дважды в разработке, и код должен это выдерживать.

### Что спросят дальше
- Когда стоит писать классовые компоненты сейчас?
- В каком порядке выполняются эффекты родителя и ребёнка?

### Ссылки
- [Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- [Component — legacy reference](https://react.dev/reference/react/Component)

# Как передать данные от ребёнка к родителю и между соседями?
@slug lifting-state-up
@topic state

> Данные в React идут сверху вниз. Чтобы ребёнок повлиял на родителя, родитель передаёт ему функцию-колбэк. Если двум соседним компонентам нужно общее состояние, его «поднимают» к ближайшему общему предку (lifting state up), а вниз передают значение и функции изменения.

```tsx
function Filters({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

function ProductPage() {
  const [query, setQuery] = useState('');          // общее состояние у предка
  return (
    <>
      <Filters value={query} onChange={setQuery} />
      <ProductList query={query} />
    </>
  );
}
```

Если общий предок очень высоко и данные приходится передавать через много уровней, это prop drilling. Варианты решения: композиция через `children`, Context, внешний стор (Zustand, Redux) или URL (для фильтров и пагинации это часто лучший вариант).

### Подводные камни
- Поднимать state «на всякий случай» в корень приложения — каждое изменение перерисовывает всё дерево.
- Дублировать одно и то же состояние в двух компонентах и синхронизировать их эффектами.

### Что спросят дальше
- Что такое prop drilling и как его избежать?
- Когда состояние стоит хранить в URL?

### Ссылки
- [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)

# Что значит «рендер должен быть чистым» и что делает StrictMode?
@slug purity-strict-mode
@topic rendering
@legacy 28

> Компонент — чистая функция от props, state и контекста: при одинаковых входных данных возвращает одинаковый JSX и не имеет побочных эффектов во время рендера (не меняет внешние переменные, не делает запросов, не трогает DOM). StrictMode в разработке помогает найти нарушения: вызывает рендер дважды, а эффекты и ref-колбэки — с дополнительным циклом mount → unmount → mount.

```tsx
let guestCount = 0;

// Плохо: рендер меняет внешнюю переменную
function Guest() {
  guestCount += 1;
  return <p>Гость №{guestCount}</p>;
}

// Хорошо: результат зависит только от props
function Guest({ index }: { index: number }) {
  return <p>Гость №{index}</p>;
}
```

Что нельзя делать во время рендера:

- менять props, state, объекты из контекста и глобальные переменные;
- вызывать `setState` безусловно;
- делать запросы, подписки, `localStorage.setItem`;
- читать или писать `ref.current` (кроме ленивой инициализации).

Почему это важно: React может вызывать рендер несколько раз, прерывать его и выбрасывать результат (конкурентный рендеринг), а React Compiler полагается на чистоту для автоматической мемоизации.

Локальные мутации внутри рендера допустимы — например, заполнить массив, созданный в этом же рендере.

### Подводные камни
- Двойные `console.log` в разработке — следствие StrictMode, а не ошибка. В DevTools второй вызов показывается приглушённым.

### Что спросят дальше
- Почему StrictMode не влияет на production?
- Как правила чистоты связаны с React Compiler?

### Ссылки
- [Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
- [StrictMode — reference](https://react.dev/reference/react/StrictMode)
- [Rules of React](https://react.dev/reference/rules)

# Какие есть способы стилизации React-компонентов?
@slug styling
@topic ecosystem

> Основные варианты: обычный CSS и CSS Modules, utility-first (Tailwind CSS), CSS-in-JS в рантайме (styled-components, Emotion) и CSS-in-JS без рантайма (vanilla-extract, Panda CSS, StyleX). Выбор зависит от команды, SSR/RSC и требований к производительности.

| Подход | Плюсы | Минусы |
|---|---|---|
| CSS Modules | изоляция классов, ноль рантайма, работает везде | динамика через CSS-переменные или классы |
| Tailwind | скорость разработки, единая система токенов, маленький CSS | «шумная» разметка, нужна дисциплина |
| Runtime CSS-in-JS | стили рядом с логикой, динамика через props | стоимость в рантайме, сложности с RSC и стримингом |
| Zero-runtime CSS-in-JS | типобезопасность, статический CSS | настройка сборки |

```tsx
import styles from './Button.module.css';

export function Button({ variant = 'primary', ...props }: ButtonProps) {
  return <button className={`${styles.button} ${styles[variant]}`} {...props} />;
}
```

Тренд последних лет — уход от CSS-in-JS в рантайме: такие библиотеки плохо сочетаются с Server Components и вычисляют стили на каждом рендере. Хорошая практика для динамики — CSS-переменные: `style={{ '--progress': '40%' }}` и `width: var(--progress)` в CSS.

Inline-стили (`style={{ ... }}`) подходят для по-настоящему динамических значений, но не для всего оформления: нет псевдоклассов и медиазапросов.

### Подводные камни
- Глобальный CSS без соглашений об именовании (BEM и т. п.) быстро приводит к конфликтам.
- Конкатенация классов строками без утилиты (`clsx`) — ошибки с лишними пробелами и `undefined`.

### Что спросят дальше
- Почему runtime CSS-in-JS плохо работает с Server Components?
- Как организовать темизацию (светлая/тёмная тема)?

### Ссылки
- [Styling — React FAQ (Adding styles)](https://react.dev/learn#adding-styles)

# Как создать React-проект сегодня и почему Create React App устарел?
@slug project-setup
@topic ecosystem
@legacy 39

> Для нового приложения команда React рекомендует фреймворк (Next.js, React Router в режиме фреймворка, Expo для мобильных) или сборщик Vite для SPA. Create React App официально признан устаревшим в феврале 2025: он медленный, не развивался и не решал роутинг, загрузку данных и code splitting. Команда `eject` из CRA выгружала конфигурацию webpack/Babel — сейчас вопрос неактуален.

```bash
# SPA на Vite
npm create vite@latest my-app -- --template react-ts

# Full-stack фреймворк
npx create-next-app@latest
npx create-react-router@latest
```

Почему Vite стал стандартом для SPA:

- мгновенный старт dev-сервера на нативных ES-модулях без полной сборки;
- быстрый HMR с сохранением состояния (React Fast Refresh);
- production-сборка через Rolldown/Rollup с code splitting;
- простая конфигурация и экосистема плагинов.

Когда нужен фреймворк, а не просто сборщик: SSR/SSG для SEO, загрузка данных на сервере, Server Components, файловый роутинг, API-роуты. Важно понимать, что без фреймворка эти вопросы придётся решать вручную.

### Подводные камни
- Брать фреймворк с SSR для внутренней админки за логином — лишняя инфраструктура без пользы.

### Что спросят дальше
- Что такое HMR и как работает Fast Refresh?
- Чем Vite отличается от webpack?

### Ссылки
- [Creating a React App](https://react.dev/learn/creating-a-react-app)
- [Build a React app from scratch](https://react.dev/learn/build-a-react-app-from-scratch)
- [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)
