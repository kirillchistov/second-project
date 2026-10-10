# Как типизировать полиморфные и сложные компоненты в TypeScript?
@slug typescript-advanced
@topic typescript
@legacy 46

> Полиморфный компонент принимает prop `as` и должен получать props выбранного элемента: `<Text as="a" href="...">`. Это делается дженериком `<C extends React.ElementType>` и `React.ComponentPropsWithoutRef<C>` с исключением конфликтующих ключей. Другие продвинутые приёмы: discriminated unions для взаимоисключающих props, `satisfies` для конфигураций, вывод типов из схем (`z.infer`), строгая типизация контекста и событий. В отличие от Flow и PropTypes из старой версии вопроса, сегодня стандарт — TypeScript в strict-режиме.

```tsx
type PolymorphicProps<C extends React.ElementType, P = object> = P &
  Omit<React.ComponentPropsWithoutRef<C>, keyof P | 'as'> & { as?: C };

type TextOwnProps = { size?: 'sm' | 'md' | 'lg' };

export function Text<C extends React.ElementType = 'span'>({
  as,
  size = 'md',
  ...rest
}: PolymorphicProps<C, TextOwnProps>) {
  const Component = as ?? 'span';
  return <Component className={`text-${size}`} {...rest} />;
}

<Text as="a" href="/docs">Документация</Text>;   // href разрешён
<Text as="button" href="/x" />;                    // ошибка: у button нет href

// Взаимоисключающие props через union
type ButtonProps =
  | ({ href: string } & React.ComponentProps<'a'>)
  | ({ href?: never } & React.ComponentProps<'button'>);

// satisfies: проверить форму, сохранив узкие литеральные типы
const routes = {
  home: '/',
  product: '/products/:id',
} satisfies Record<string, `/${string}`>;
type RouteName = keyof typeof routes;   // 'home' | 'product'
```

Другие темы для разговора: типизация API из OpenAPI (`openapi-typescript`), branded types для id (`type UserId = string & { __brand: 'UserId' }`), `noUncheckedIndexedAccess`, тип `React.ReactNode` против `ReactElement`, вывод типов в TanStack Query и React Hook Form.

Часто проще избежать полиморфизма через `asChild` (Slot): компонент передаёт props и поведение единственному ребёнку, и типизация становится тривиальной.

### Подводные камни
- Полиморфные типы заметно замедляют проверку TypeScript в больших кодовых базах.
- `as any` в ключевых местах дизайн-системы — потеря типобезопасности у всех потребителей.

### Что спросят дальше
- Чем `satisfies` отличается от аннотации типа?
- Что такое branded types?

### Ссылки
- [React TypeScript Cheatsheet — Polymorphic Components](https://react-typescript-cheatsheet.netlify.app/docs/advanced/patterns_by_usecase/#polymorphic-components-eg-with-as-props)
- [TypeScript — satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)

# Какие угрозы безопасности актуальны для современного React-приложения?
@slug security-advanced
@topic quality

> Помимо XSS: утечки секретов в клиентский бандл (переменные окружения с префиксом `VITE_` / `NEXT_PUBLIC_` видны всем), незащищённые Server Functions и API-роуты, CSRF при cookie-аутентификации, атаки на цепочку поставок (вредоносные npm-пакеты), небезопасные сторонние скрипты, open redirect, кликджекинг. Защита — многоуровневая: CSP с nonce, заголовки безопасности, валидация на сервере, аудит и фиксация зависимостей, принцип минимальных привилегий.

Чек-лист:

- **Секреты** только на сервере; клиентские переменные считать публичными. Пакет `server-only` защищает от случайного импорта.
- **Server Functions / API** — аутентификация, авторизация и валидация в каждой функции; rate limiting.
- **CSRF** — `SameSite=Lax/Strict` cookies, проверка `Origin`, CSRF-токены для небезопасных методов.
- **CSP** — `script-src 'nonce-…' 'strict-dynamic'`, запрет `unsafe-inline` и `unsafe-eval`; отчёты `report-to`.
- **Заголовки** — `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors` (против кликджекинга), HSTS.
- **Зависимости** — lockfile, `npm audit` / Dependabot / Renovate, проверка новых пакетов, `ignore-scripts` где возможно, Subresource Integrity для скриптов с CDN.
- **Редиректы** — разрешать только относительные пути или белый список (`?next=//evil.com`).
- **Данные в RSC payload** — всё, что передано в Client Component, видно в браузере. Не передавать объект пользователя целиком, если нужно только имя (React предлагает экспериментальный `taintObjectReference`).

```ts
// Безопасный редирект после логина
function safeRedirect(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}
```

### Подводные камни
- Прятать API-ключ «в переменную окружения» Vite и считать его секретным — он встроен в JS-бандл.
- Передавать в клиентский компонент запись из БД целиком «для удобства».

### Что спросят дальше
- Как настроить CSP с nonce при SSR?
- Как защититься от атак на цепочку поставок?

### Ссылки
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN — Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

# Чем React отличается от Angular, Vue, Svelte и Solid?
@slug react-vs-others
@topic ecosystem
@legacy 50

> React — библиотека для UI с моделью «перерендер компонента + сравнение дерева» и большой свободой выбора остальных инструментов. Angular — полноценный фреймворк «всё включено» (DI, роутинг, формы, HTTP) с TypeScript и, с недавних версий, сигналами. Vue — прогрессивный фреймворк с реактивностью на прокси и шаблонами. Svelte и Solid используют компиляцию и мелкозернистую реактивность (сигналы/руны): обновляется конкретный DOM-узел, а не перерендеривается компонент.

| | React | Angular | Vue | Svelte / Solid |
|---|---|---|---|---|
| Модель обновлений | перерендер + reconciliation | сигналы + change detection | реактивность на Proxy + VDOM | сигналы / компиляция, без VDOM |
| Шаблоны | JSX | HTML-шаблоны | шаблоны или JSX | шаблоны / JSX |
| Объём «в коробке» | минимальный | максимальный | средний | средний |
| Серверные компоненты | RSC | нет аналога | нет аналога | частично (SolidStart) |
| Экосистема и рынок | крупнейшие | энтерпрайз | большая | растущая |

Сильные стороны React: огромная экосистема и рынок специалистов, React Native, Server Components, продвинутая конкурентность, явная модель данных. Слабые: много решений нужно выбирать самому, мемоизация (частично решена Compiler), более высокий порог для правил эффектов.

На собеседовании важно не «какой лучше», а умение выбрать под контекст: команда, требования к производительности, SEO, мобильные платформы, наличие специалистов, долгосрочная поддержка.

### Подводные камни
- Утверждать, что сигналы «всегда быстрее» — для типичных приложений разница меньше, чем от архитектурных решений.

### Что спросят дальше
- Что такое сигналы и почему React их не использует?
- Как React Compiler сокращает разрыв с компилируемыми фреймворками?

### Ссылки
- [Angular — Signals](https://angular.dev/guide/signals)
- [Vue — Reactivity in Depth](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [Solid — Fine-grained reactivity](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity)

# Как выбрать между Next.js, React Router и SPA на Vite?
@slug choosing-framework
@topic ecosystem

> Критерии: нужен ли SEO и быстрый первый контент, сколько данных грузится на сервере, нужны ли Server Components, где будет хоститься приложение, опыт команды и зависимость от вендора. Next.js (App Router) — максимум возможностей: RSC, Server Functions, стриминг, кэширование, но выше сложность. React Router v7 в режиме фреймворка — loaders/actions, SSR, ближе к веб-стандартам. TanStack Start — типобезопасность и SSR поверх TanStack Router. SPA на Vite — для приложений за логином, где SSR не нужен.

| Сценарий | Разумный выбор |
|---|---|
| Контентный сайт, маркетинг, e-commerce | Next.js, React Router, Astro для преимущественно статичного контента |
| Дашборд или админка за логином | Vite SPA + React Router / TanStack Router + TanStack Query |
| Мобильное приложение | Expo (React Native) |
| Миграция с Remix | React Router v7 (прямой наследник) |
| Нужна максимальная типобезопасность роутинга | TanStack Router / Start |

Что обсудить при выборе:

- **Хостинг.** Next.js лучше всего работает на Vercel; при self-hosted (Docker, Node) нужно разобраться с кэшем, ISR и изображениями.
- **Модель данных.** RSC меняют подход — меньше клиентского стейта, но новые концепции и ограничения.
- **Сложность отладки** кэшей фреймворка.
- **Обратимость решения.** Насколько тяжело будет мигрировать через 3 года.

### Подводные камни
- Выбирать Next.js «потому что все так делают» для внутренней админки — лишняя серверная инфраструктура.
- Делать SEO-критичный сайт как чистое SPA.

### Что спросят дальше
- В чём сложность App Router по сравнению с Pages Router?
- Как организовать SSR на React Router v7?

### Ссылки
- [Creating a React App — react.dev](https://react.dev/learn/creating-a-react-app)
- [Next.js Docs](https://nextjs.org/docs)
- [TanStack Start](https://tanstack.com/start/latest)

# Как мигрировать legacy React-приложение (классы, старые версии)?
@slug legacy-migration
@topic architecture
@legacy 10

> Постепенно и с измерениями: сначала обновить React до последней минорной версии своей мажорной ветки и убрать предупреждения, затем перейти на следующую мажорную (16 → 17 → 18.3 → 19), используя официальные codemods. Классы не обязательно переписывать — они поддерживаются; переписывают на хуки то, что активно меняется. Параллельно: CRA → Vite, Enzyme → Testing Library, PropTypes → TypeScript, `connect` → хуки Redux, legacy-контекст и строковые refs — обязательно до React 19.

План:

1. **Аудит**: версии, устаревшие API (`componentWillMount`, `findDOMNode`, строковые refs, legacy context, `ReactDOM.render`), тестовое покрытие критичных путей.
2. **Страховка**: e2e на ключевые сценарии, мониторинг ошибок, feature flags.
3. **React 18**: `createRoot` вместо `ReactDOM.render`, проверка автоматического батчинга и StrictMode (двойные эффекты выявят ошибки cleanup).
4. **React 18.3**: исправить все предупреждения об устаревших API.
5. **React 19**: `npx codemod@latest react/19/migration-recipe`, типы `npx types-react-codemod@latest preset-19`, удалить `propTypes`/`defaultProps` функций, `forwardRef` по желанию.
6. **Инфраструктура**: CRA → Vite (переменные окружения `REACT_APP_` → `VITE_`, `index.html` в корне), Jest → Vitest.
7. **Код**: новые фичи — на хуках и TypeScript; классы переписывать при касании («правило бойскаута»).

```tsx
// Класс → хуки: componentDidMount/Update/WillUnmount → один эффект
class Clock extends React.Component<{ tz: string }, { now: Date }> {
  state = { now: new Date() };
  timer?: number;
  componentDidMount() { this.timer = window.setInterval(() => this.setState({ now: new Date() }), 1000); }
  componentWillUnmount() { clearInterval(this.timer); }
  render() { return <time>{format(this.state.now, this.props.tz)}</time>; }
}

function Clock({ tz }: { tz: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <time>{format(now, tz)}</time>;
}
```

Error Boundaries остаются классами (или `react-error-boundary`) — переписать их на хуки нельзя.

### Подводные камни
- «Большой взрыв» — переписать всё сразу, заморозив фичи на месяцы.
- Сторонние библиотеки, не поддерживающие новую версию React, — проверить заранее.

### Что спросят дальше
- Что ломается при переходе на React 18?
- Как убедить бизнес выделить время на миграцию?

### Ссылки
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [How to Upgrade to React 18](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)

# Как работать с real-time данными (WebSocket, SSE) в React?
@slug realtime
@topic state

> Соединение — внешняя система, поэтому оно живёт вне компонентов: в модуле-клиенте или провайдере, а компоненты подписываются на нужные события. Входящие сообщения обновляют кэш серверного состояния (`queryClient.setQueryData` или инвалидация), а не разрозненные `useState`. Обязательно: переподключение с backoff, догрузка пропущенного после разрыва, отписка в cleanup, ограничение частоты обновлений UI.

```tsx
function useLiveOrders() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = realtime.subscribe('orders', (event: OrderEvent) => {
      if (event.type === 'updated') {
        queryClient.setQueryData<Order[]>(['orders'], (orders) =>
          orders?.map((o) => (o.id === event.order.id ? event.order : o)),
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ['orders'] });   // проще и надёжнее
      }
    });
    return unsubscribe;
  }, [queryClient]);
}

// Клиент: одно соединение на приложение, переподключение с экспоненциальной задержкой
class RealtimeClient {
  private ws?: WebSocket;
  private retry = 0;
  connect() {
    this.ws = new WebSocket(URL);
    this.ws.onopen = () => { this.retry = 0; this.resync(); };
    this.ws.onclose = () => setTimeout(() => this.connect(), Math.min(30_000, 2 ** this.retry++ * 1000));
    this.ws.onmessage = (e) => this.dispatch(JSON.parse(e.data));
  }
  // subscribe, dispatch, resync...
}
```

Выбор транспорта: SSE — проще, однонаправленно, работает через HTTP и автоматически переподключается; WebSocket — двусторонний; для коллаборативного редактирования — CRDT (Yjs, Automerge) поверх транспорта.

Производительность: при высокой частоте сообщений (котировки, телеметрия) — батчить обновления (например, раз в `requestAnimationFrame`), хранить данные во внешнем сторе и подписываться селекторами, не класть каждое сообщение в React state.

### Подводные камни
- Новое соединение в каждом компоненте, которому нужны данные.
- Не учитывать порядок сообщений и гонку между начальной загрузкой и событиями.

### Что спросят дальше
- SSE или WebSocket — как выбрать?
- Как не потерять события во время переподключения?

### Ссылки
- [TanStack Query — Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses)
- [MDN — Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

# Как управлять загрузкой ресурсов и метаданными в React 19?
@slug resource-loading
@topic performance

> React 19 умеет поднимать `<title>`, `<meta>` и `<link>` из любого компонента в `<head>`, управлять порядком подключения стилей через `precedence` (и задерживать показ контента до загрузки стилей при Suspense), дедуплицировать асинхронные скрипты и даёт API ресурсных подсказок: `preload`, `preinit`, `preconnect`, `prefetchDNS`, `preloadModule`. Это позволяет описывать зависимости компонента рядом с ним, а React сам решит, когда и куда их вставить, в том числе при стриминге SSR.

```tsx
import { preload, preconnect, preinit } from 'react-dom';

function ProductPage({ product }: { product: Product }) {
  preconnect('https://cdn.example.com');
  preload(product.heroImage, { as: 'image', fetchPriority: 'high' });

  return (
    <>
      <title>{`${product.name} — Магазин`}</title>
      <meta name="description" content={product.summary} />
      <link rel="canonical" href={`https://example.com/p/${product.slug}`} />
      <link rel="stylesheet" href="/styles/product.css" precedence="default" />

      <img src={product.heroImage} alt={product.name} fetchPriority="high" />
    </>
  );
}

function MapWidget() {
  preinit('https://maps.example.com/sdk.js', { as: 'script' });   // загрузить и выполнить
  return <div id="map" />;
}
```

Почему это лучше старых подходов: раньше метаданные выставляли через `react-helmet` (сложно при стриминге), а стили и скрипты — вручную в `index.html`. Теперь компонент сам описывает, что ему нужно, а React дедуплицирует повторы и выставляет правильный порядок.

Связь с производительностью: правильный `preload` LCP-изображения и `preconnect` к CDN заметно улучшают LCP; `precedence` предотвращает «вспышку» нестилизованного контента.

### Подводные камни
- `preload` всего подряд — конкурирует за полосу с действительно критичными ресурсами.
- Ожидать, что SPA без SSR получит SEO-выгоду от `<title>` в компонентах так же, как SSR.

### Что спросят дальше
- Чем `preload` отличается от `preinit`?
- Как работает `precedence` у стилей?

### Ссылки
- [Resource Preloading APIs](https://react.dev/reference/react-dom#resource-preloading-apis)
- [title — reference](https://react.dev/reference/react-dom/components/title)
- [link — reference](https://react.dev/reference/react-dom/components/link)

# Что такое однонаправленный поток данных и почему Flux вытеснил MVC?
@slug flux-unidirectional
@topic architecture
@legacy 41

> В классическом клиентском MVC с двусторонним связыванием модель может обновить представление, а представление — модель, и каскад таких обновлений становится трудно отследить. Flux (Facebook, 2014) ввёл однонаправленный цикл: Action → Dispatcher → Store → View → новый Action. Данные меняются только в сторе в ответ на действия, поэтому любое изменение можно отследить и воспроизвести. Redux упростил Flux до одного стора и чистых редьюсеров; та же идея лежит в `useReducer`, Zustand, Elm и в модели React «state → UI».

```text
MVC (двустороннее связывание):
  View ⇄ Controller ⇄ Model ⇄ View ...   — каскадные обновления

Flux:
  Action → Dispatcher → Store → View
     ↑                            │
     └────────── user event ──────┘
```

Что это даёт:

- **Предсказуемость** — состояние меняется только явными действиями.
- **Отладка** — лог действий, time-travel в Redux DevTools, воспроизведение багов.
- **Разделение** чтения (селекторы) и изменения (действия).

Где мы сейчас: ценность однонаправленного потока осталась, а формы его упростились. Большая часть «глобального состояния» оказалась серверным кэшем (TanStack Query, RSC), а оставшееся клиентское — небольшое. Сигналы в других фреймворках возвращают более гранулярную реактивность, но тоже с однонаправленным потоком данных.

### Подводные камни
- Путать однонаправленный поток данных с «обязательно Redux» — React сам по себе однонаправлен (props вниз, события вверх).

### Что спросят дальше
- Чем Redux отличается от оригинального Flux?
- Есть ли двустороннее связывание в React?

### Ссылки
- [Flux (архив)](https://github.com/facebookarchive/flux)
- [Redux — Motivation and Prior Art](https://redux.js.org/understanding/history-and-design/prior-art)

# Спроектируйте компонент автокомплита (frontend system design)
@slug system-design-autocomplete
@topic architecture

> Ответ структурируют как систему: требования (функциональные и нефункциональные) → API компонента → поток данных (debounce, отмена устаревших запросов, кэш) → состояния UI (пусто, загрузка, результаты, ошибка, нет результатов) → доступность (паттерн combobox из WAI-ARIA) → производительность (виртуализация, подсветка совпадений) → краевые случаи и тестирование.

**1. Требования.** Подсказки при вводе от 2 символов, навигация с клавиатуры, выбор мышью, недавние запросы, работа на мобильных, ответ сервера до 300 мс, миллионы пользователей.

**2. API компонента.**

```tsx
type AutocompleteProps<T> = {
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<T[]>;
  getKey: (item: T) => string;
  renderItem: (item: T, query: string) => React.ReactNode;
  onSelect: (item: T) => void;
  minChars?: number;
  debounceMs?: number;
};
```

**3. Поток данных.**

```tsx
const [input, setInput] = useState('');
const query = useDebouncedValue(input.trim(), 250);

const { data = [], isFetching, isError } = useQuery({
  queryKey: ['suggest', query],
  queryFn: ({ signal }) => fetchSuggestions(query, signal),  // отмена устаревших
  enabled: query.length >= minChars,
  staleTime: 60_000,                                        // кэш повторных запросов
  placeholderData: keepPreviousData,                        // без мигания списка
});
```

**4. Доступность** (паттерн combobox): `role="combobox"` с `aria-expanded`, `aria-controls`, `aria-activedescendant` на поле; `role="listbox"` и `role="option"` с `aria-selected`; стрелки, Enter, Escape, Home/End; объявление числа результатов через `aria-live`. Фокус остаётся в поле.

**5. Производительность и UX.** Debounce, отмена запросов, кэш по префиксам, виртуализация при длинном списке, подсветка совпадения без `dangerouslySetInnerHTML`, `useDeferredValue` для локальной фильтрации, предзагрузка популярных запросов.

**6. Краевые случаи.** Гонки ответов, IME-ввод (китайский, японский — события composition), очень длинные строки, сетевые ошибки и повтор, RTL, мобильная клавиатура, закрытие при клике снаружи.

**7. Тестирование.** Интеграционные тесты с MSW и фейковыми таймерами, e2e на клавиатурную навигацию, axe для доступности.

На собеседовании важны не все детали сразу, а умение задать уточняющие вопросы, расставить приоритеты и объяснить компромиссы.

### Подводные камни
- Начать писать код, не уточнив требования.
- Забыть про доступность и клавиатуру — это главная сложность автокомплита.

### Что спросят дальше
- Как кэшировать подсказки на клиенте?
- Как поддержать IME-ввод?

### Ссылки
- [WAI-ARIA — Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [GreatFrontEnd — Front End System Design](https://www.greatfrontend.com/front-end-system-design-playbook)

# На что вы смотрите при code review React-кода?
@slug code-review
@topic architecture

> На корректность (эффекты и их зависимости, гонки, утечки, ключи списков, мутации state), архитектуру (где живёт состояние, границы модулей, нет ли дублирования источников истины), производительность (лишние рендеры на горячих путях, размер бандла), доступность и безопасность, типы и тесты. Ревью — не поиск стиля: форматирование и простые правила должны проверять Prettier, ESLint и TypeScript в CI, а человек — смысл.

Чек-лист:

- **Состояние.** Минимально ли оно? Нет ли производных данных в state и синхронизации эффектами? Серверные данные — в кэше, а не в `useState`?
- **Эффекты.** Нужен ли эффект вообще? Есть ли cleanup? Честны ли зависимости? Нет ли гонок?
- **Рендеринг.** Стабильные ключи, нет компонентов, объявленных внутри компонентов, нет тяжёлых вычислений на каждом рендере в горячих местах.
- **Типы.** Нет `any` и лишних `as`; невозможные состояния непредставимы.
- **Доступность.** Семантические элементы, подписи, клавиатура, фокус.
- **Безопасность.** `dangerouslySetInnerHTML`, пользовательские URL, секреты в клиенте, проверки прав на сервере.
- **Ошибки и загрузка.** Обработаны состояния загрузки, ошибки и пустого результата.
- **Тесты.** Проверяют поведение, а не реализацию; покрыты краевые случаи.
- **Размер изменения.** PR можно понять за 15 минут? Если нет — разбить.

```tsx
// Типичный комментарий на ревью
const [filtered, setFiltered] = useState<Item[]>([]);
useEffect(() => {
  setFiltered(items.filter((i) => i.active));
}, [items]);
// → «Это производное значение: const filtered = items.filter(i => i.active).
//    Убираем лишний рендер и риск рассинхронизации.»
```

Культура ревью: комментарии с объяснением «почему», разделение блокирующих замечаний и предложений (`nit:`), автоматизация всего, что можно автоматизировать, и быстрый отклик — ревью не должно блокировать команду днями.

### Подводные камни
- Спорить в ревью о стиле, который должен решать форматтер.
- Одобрять большие PR, не разобравшись, — «LGTM» на 2000 строк.

### Что спросят дальше
- Как вы договариваетесь о правилах в команде?
- Какие проверки вы автоматизируете в CI?

### Ссылки
- [Google Engineering Practices — Code Review](https://google.github.io/eng-practices/review/)
- [Rules of React](https://react.dev/reference/rules)
