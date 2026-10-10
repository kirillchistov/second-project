# Как React-приложение влияет на Core Web Vitals (LCP, INP, CLS)?
@slug web-vitals
@topic performance

> LCP (Largest Contentful Paint, цель ≤ 2.5 с) страдает от CSR, большого JS и позднего старта загрузки главного изображения или данных. INP (Interaction to Next Paint, ≤ 200 мс) — от долгих задач в главном потоке: тяжёлых рендеров, синхронных обработчиков, гидрации. CLS (Cumulative Layout Shift, ≤ 0.1) — от контента, который появляется без зарезервированного места: изображений без размеров, баннеров, шрифтов, скелетонов неверного размера.

Что делать для каждой метрики:

**LCP**
- SSR/SSG или стриминг вместо пустого HTML;
- `fetchpriority="high"` и `preload` для LCP-изображения, без `loading="lazy"` у него;
- уменьшить и разделить JS, отложить сторонние скрипты.

**INP**
- разбивать долгие задачи: `startTransition` для несрочных обновлений, `scheduler.yield()` / `setTimeout` в длинных циклах;
- уменьшить объём рендера на взаимодействие (state ниже, `memo`, Compiler, виртуализация);
- выносить тяжёлые вычисления в Web Worker;
- сокращать стоимость гидрации (Server Components, выборочная гидрация, меньше клиентских компонентов).

**CLS**
- `width`/`height` или `aspect-ratio` у медиа;
- скелетоны того же размера, что и контент;
- `font-display: optional` или подбор fallback-шрифта (`size-adjust`);
- новые элементы — ниже видимой области или по действию пользователя.

```tsx
import { onINP, onLCP, onCLS } from 'web-vitals/attribution';

onINP(({ value, attribution }) => {
  sendToAnalytics('INP', value, attribution.interactionTarget);  // какой элемент тормозит
});
onLCP(report);
onCLS(report);
```

Важно различать лабораторные данные (Lighthouse) и полевые (CrUX, RUM): Google оценивает по полевым на 75-м перцентиле.

### Подводные камни
- Оптимизировать Lighthouse score на мощном ноутбуке, когда проблема у пользователей на бюджетных Android.

### Что спросят дальше
- Почему INP заменил FID?
- Как найти конкретное взаимодействие с плохим INP?

### Ссылки
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals)
- [web.dev — Optimize INP](https://web.dev/articles/optimize-inp)

# Как сделать глобальное состояние без лишних рендеров?
@slug context-selectors
@topic state

> Context перерисовывает всех потребителей при любом изменении value, селекторов у него нет. Варианты: разделить контексты по частоте изменений и по «данные/действия»; хранить в контексте не значение, а стабильный стор (объект с `subscribe/getState`) и подписываться на срез через `useSyncExternalStore` с селектором — так устроены Zustand, Redux и Jotai; либо взять готовую библиотеку.

```tsx
type Store<T> = { getState: () => T; setState: (fn: (s: T) => T) => void; subscribe: (l: () => void) => () => void };

function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (fn) => { state = fn(state); listeners.forEach((l) => l()); },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

const StoreContext = createContext<Store<AppState> | null>(null);

export function useAppStore<S>(selector: (s: AppState) => S): S {
  const store = useContext(StoreContext)!;           // ссылка на стор не меняется
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),                // перерисовка только при изменении среза
  );
}

const userName = useAppStore((s) => s.user.name);
```

Нюансы:

- Селектор должен возвращать **стабильное значение**: примитив или мемоизированный объект. `s => ({ a: s.a, b: s.b })` создаёт новый объект — бесконечные рендеры; нужен `shallow`-компаратор (`useShallow` в Zustand) или мемоизация.
- Стор в контексте (а не в модуле) удобен для SSR и тестов: у каждого запроса и теста — свой экземпляр.
- **React Compiler** не решает проблему контекста — он мемоизирует внутри компонента, но не отменяет подписку на весь контекст.

### Подводные камни
- Писать свой «стор с селекторами» в продукте, когда есть проверенные Zustand и Redux.

### Что спросят дальше
- Почему стор лучше хранить в контексте, а не в глобальной переменной при SSR?
- Как работает useShallow?

### Ссылки
- [useSyncExternalStore — reference](https://react.dev/reference/react/useSyncExternalStore)
- [Zustand — Prevent rerenders with useShallow](https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow)

# Откуда берутся утечки памяти в React-приложениях и как их искать?
@slug memory-leaks
@topic performance

> Основные источники: подписки, таймеры и слушатели без cleanup; замыкания, удерживающие большие объекты (в том числе в глобальных кэшах и сторах); незакрытые WebSocket и наблюдатели (`ResizeObserver`, `IntersectionObserver`); отсоединённые DOM-узлы, на которые ссылаются refs или сторонние библиотеки; бесконечно растущие кэши. Искать — через Memory в Chrome DevTools: heap-снимки до и после сценария, сравнение и поиск «Detached» элементов.

```tsx
// Утечка: подписка без отписки, интервал без очистки
useEffect(() => {
  socket.on('message', handleMessage);
  const id = setInterval(poll, 5000);
}, []);

// Корректно
useEffect(() => {
  socket.on('message', handleMessage);
  const id = setInterval(poll, 5000);
  return () => {
    socket.off('message', handleMessage);
    clearInterval(id);
  };
}, []);

// Сторонняя библиотека: уничтожать экземпляр
useEffect(() => {
  const chart = new Chart(canvasRef.current!, config);
  return () => chart.destroy();
}, [config]);
```

Методика поиска:

1. Сделать heap snapshot.
2. Выполнить сценарий несколько раз (открыть и закрыть модалку, перейти между страницами).
3. Сделать snapshot снова, сравнить (Comparison), отфильтровать по «Detached» и по классам, количество которых растёт.
4. Посмотреть Retainers — цепочку ссылок, которая удерживает объект.

Также помогают: вкладка Performance monitor (JS heap и DOM nodes со временем), `FinalizationRegistry` в отладочных целях, Strict Mode (двойной mount выявляет отсутствие cleanup).

Предупреждение «Can't perform a React state update on an unmounted component» убрано в React 18 — оно чаще было ложным, а не признаком утечки.

### Подводные камни
- Глобальный Map-кэш без ограничения размера и инвалидации растёт всю сессию.
- Забытые `console.log` с большими объектами удерживают их в памяти при открытых DevTools.

### Что спросят дальше
- Что такое detached DOM nodes?
- Как ограничить размер клиентского кэша?

### Ссылки
- [Chrome DevTools — Fix memory problems](https://developer.chrome.com/docs/devtools/memory-problems)
- [Synchronizing with Effects — cleanup](https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed)

# Как спроектировать архитектуру большого фронтенд-приложения?
@slug large-scale-architecture
@topic architecture

> Цель архитектуры — чтобы команды могли менять код независимо и предсказуемо. Основные решения: разбиение на модули по доменам с явными публичными API и направлением зависимостей; разделение типов состояния (серверное, URL, формы, UI); единые слои для API, ошибок, авторизации и наблюдаемости; дизайн-система; монорепозиторий с общими пакетами; автоматическая проверка границ и контрактов в CI. Всё это фиксируется в ADR и проверяется инструментами, а не только договорённостями.

Ключевые элементы:

- **Модульность.** Домены (каталог, корзина, профиль) с публичным API. Импорт внутренностей запрещён линтером. Зависимости только «вниз».
- **Слой данных.** Типизированный API-клиент (генерация из OpenAPI/GraphQL-схемы), TanStack Query или RTK Query, единая обработка ошибок и авторизации.
- **Монорепозиторий** (pnpm workspaces + Turborepo или Nx): пакеты `ui`, `api-client`, `config`, приложения; кэширование сборок и тестов, запуск только затронутого.
- **Границы рендеринга.** Что на сервере (RSC/SSR), что на клиенте; где Suspense и Error Boundary.
- **Качество.** Строгий TypeScript, линтеры, тестовая стратегия, бюджеты производительности, превью-окружения для каждого PR.
- **Наблюдаемость.** Ошибки (Sentry), RUM, логирование, feature flags для постепенных релизов.

```text
apps/
  web/                 # Next.js или Vite
  admin/
packages/
  ui/                  # дизайн-система
  api-client/          # сгенерированные типы и хуки
  eslint-config/
  tsconfig/
```

Что важно сказать на собеседовании: архитектура зависит от контекста — размера команды, частоты релизов, требований к SEO и офлайну. Хорошо показывать компромиссы и то, как вы принимали решения на реальном проекте, а не перечислять модные слова.

### Подводные камни
- Преждевременная сложность: микрофронтенды и пять слоёв абстракций в приложении для одной команды.
- Общий пакет `utils` или `common`, от которого зависит всё и который никто не владеет.

### Что спросят дальше
- Как вы проверяете границы модулей автоматически?
- Когда монорепозиторий оправдан?

### Ссылки
- [Feature-Sliced Design](https://feature-sliced.design/)
- [Turborepo — Monorepo Handbook](https://turborepo.com/docs)

# Когда оправданы микрофронтенды и как их реализовать?
@slug micro-frontends
@topic architecture

> Микрофронтенды — разбиение фронтенда на независимо разрабатываемые и деплоемые части, принадлежащие разным командам. Они решают организационную проблему (много команд, независимые релизы, разные циклы), а не техническую. Цена — сложность инфраструктуры, дублирование зависимостей, согласование версий, единообразие UX и производительность. Для одной-двух команд модульный монолит почти всегда лучше.

Способы интеграции:

| Подход | Как работает | Особенности |
|---|---|---|
| Build-time (npm-пакеты) | модули собираются вместе | просто, но нет независимого деплоя |
| Module Federation | загрузка удалённых модулей в рантайме, общие зависимости | независимый деплой, нужно согласовать версии React (singleton) |
| Маршрутизация по путям | разные приложения на разных URL (`/shop`, `/account`) | максимальная изоляция, переход — перезагрузка страницы |
| iframe | полная изоляция | сложная коммуникация, a11y и UX |
| Web Components | обёртка в custom elements | независимость от фреймворка |

```ts
// Module Federation (Vite/Rspack): хост подключает удалённый модуль
federation({
  name: 'host',
  remotes: { checkout: 'https://checkout.example.com/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});

const Checkout = lazy(() => import('checkout/App'));
```

Обязательные договорённости: общая дизайн-система, единая авторизация, контракт коммуникации (события, URL, общий стор — минимально), стратегия версий общих зависимостей, мониторинг ошибок по каждому модулю, fallback при недоступности удалённого модуля (Error Boundary + Suspense).

### Подводные камни
- Два экземпляра React на странице — хуки ломаются, контекст не передаётся.
- Общее глобальное состояние между микрофронтендами превращает их в распределённый монолит.

### Что спросят дальше
- Как микрофронтенды обмениваются данными?
- Как обеспечить единый UX?

### Ссылки
- [Martin Fowler — Micro Frontends](https://martinfowler.com/articles/micro-frontends.html)
- [Module Federation](https://module-federation.io/)

# Как построить дизайн-систему и библиотеку компонентов на React?
@slug design-system
@topic architecture

> Основа — дизайн-токены (цвета, типографика, отступы, радиусы) как CSS-переменные, из которых строятся темы. Сложное поведение (фокус, клавиатура, ARIA, позиционирование) берут из headless-библиотек — Radix UI, React Aria, Ariakit, — а стили накладывают свои. API компонентов — композиционное: compound components, `asChild` или полиморфный `as`, расширение нативных props. Документация и визуальное тестирование — в Storybook.

```tsx
// Компонент поверх headless-примитива Radix
import * as DialogPrimitive from '@radix-ui/react-dialog';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content className={cn('dialog-content', className)} {...props}>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// asChild: поведение кнопки, разметка — ссылки роутера
<DialogTrigger asChild>
  <Link to="/settings">Настройки</Link>
</DialogTrigger>
```

Решения, которые стоит обсудить:

- **Поставлять пакетом или копировать код** (подход shadcn/ui: компоненты копируются в проект и принадлежат команде).
- **Стили**: CSS Modules, Tailwind или zero-runtime CSS-in-JS — без runtime-стилей, чтобы работало с RSC.
- **Версионирование и changelog** (Changesets), codemods для breaking changes.
- **Качество**: тесты взаимодействия (Storybook play-функции), визуальная регрессия (Chromatic, Playwright screenshots), a11y-проверки axe в CI.
- **Токены из дизайна** — синхронизация с Figma Variables, генерация через Style Dictionary.

### Подводные камни
- Компоненты с сотней boolean-props (`isLarge`, `isRounded`, `withIcon`) вместо вариантов и композиции.
- Писать собственные модалки, меню и комбобоксы с нуля и забыть про доступность.

### Что спросят дальше
- Что такое headless-компоненты?
- Как реализовать asChild (Slot)?

### Ссылки
- [Radix Primitives](https://www.radix-ui.com/primitives)
- [React Aria](https://react-spectrum.adobe.com/react-aria/)
- [Storybook](https://storybook.js.org/docs)

# Какие продвинутые паттерны компонентов вы знаете?
@slug component-patterns
@topic architecture

> Compound components — набор компонентов, которые делят неявное состояние через контекст (`<Tabs>`, `<Tabs.List>`, `<Tabs.Panel>`). Control props — компонент поддерживает и контролируемый, и неконтролируемый режим. State reducer — пользователь может переопределить переходы состояния. Props getters и headless hooks — хук отдаёт логику и функции для навешивания props, а разметка остаётся за потребителем. Slot/asChild — передача поведения произвольному элементу.

```tsx
// Compound components + control props
type TabsCtx = { value: string; setValue: (v: string) => void };
const TabsContext = createContext<TabsCtx | null>(null);

function useControllableState<T>(controlled: T | undefined, defaultValue: T, onChange?: (v: T) => void) {
  const [inner, setInner] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : inner;
  const setValue = useCallback((next: T) => {
    if (!isControlled) setInner(next);
    onChange?.(next);
  }, [isControlled, onChange]);
  return [value, setValue] as const;
}

function Tabs({ value, defaultValue = '', onValueChange, children }: TabsProps) {
  const [current, setCurrent] = useControllableState(value, defaultValue, onValueChange);
  return <TabsContext value={{ value: current, setValue: setCurrent }}>{children}</TabsContext>;
}

function Tab({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = use(TabsContext)!;
  return (
    <button role="tab" aria-selected={ctx.value === value} onClick={() => ctx.setValue(value)}>
      {children}
    </button>
  );
}

// Использование: неконтролируемо или контролируемо
<Tabs defaultValue="a"><Tab value="a">A</Tab><Tab value="b">B</Tab></Tabs>
<Tabs value={tab} onValueChange={setTab}>...</Tabs>
```

Когда что применять:

- **Compound** — гибкая разметка со связанными частями (табы, аккордеон, селект, меню).
- **Control props** — компонент библиотеки, которым иногда нужно управлять снаружи.
- **State reducer** — когда пользователи просят «а можно, чтобы меню не закрывалось при…» (Downshift).
- **Headless hook** — когда разметка сильно разная в каждом месте (`useCombobox`, TanStack Table).

### Подводные камни
- Переключение между контролируемым и неконтролируемым режимом во время жизни компонента — источник багов; стоит предупреждать в dev.

### Что спросят дальше
- Как реализовать asChild?
- Чем headless-хук лучше компонента с кучей props?

### Ссылки
- [Kent C. Dodds — Advanced React Patterns](https://kentcdodds.com/blog/inversion-of-control)
- [Downshift — state reducer](https://www.downshift-js.com/use-combobox#state-reducer)

# Как выстроить обработку ошибок и наблюдаемость на уровне приложения?
@slug error-handling-strategy
@topic quality

> Нужна многоуровневая стратегия: Error Boundaries на уровне корня, маршрутов и независимых виджетов; единая обработка ошибок API в http-клиенте и библиотеке данных (повторы, 401, сетевые ошибки); глобальные обработчики `onUncaughtError`/`onCaughtError`, `window.onerror` и `unhandledrejection`; отправка в систему мониторинга (Sentry) с source maps, контекстом пользователя и релиза; понятный UX для каждого типа ошибки.

Классификация ошибок и реакция:

| Тип | Пример | Реакция |
|---|---|---|
| Ожидаемая бизнес-ошибка | «Email занят» | показать рядом с полем, не логировать как сбой |
| Сетевая / временная | таймаут, 503 | повтор с backoff, сообщение «нет связи», офлайн-режим |
| Авторизация | 401 / 403 | обновить токен или перенаправить на вход |
| Ошибка рендера | `undefined.map` | Error Boundary с «Повторить», отчёт в мониторинг |
| Ошибка загрузки чанка | после деплоя | предложить перезагрузку |

```tsx
const root = createRoot(container, {
  onUncaughtError(error, errorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  },
  onCaughtError(error, errorInfo) {
    Sentry.captureException(error, { level: 'warning', extra: { componentStack: errorInfo.componentStack } });
  },
});

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) toast.error('Не удалось обновить данные');
    },
  }),
  defaultOptions: { queries: { retry: (count, err) => !isClientError(err) && count < 3 } },
});
```

Наблюдаемость — это не только ошибки: RUM (Web Vitals), трассировка запросов от фронта до бэкенда, отметки о релизах, feature flags, чтобы быстро выключить проблемную функцию, и алерты по росту ошибок после деплоя.

### Подводные камни
- Логировать ожидаемые ошибки валидации как исключения — шум в мониторинге скрывает реальные проблемы.
- Не загружать source maps в мониторинг — стеки бесполезны.

### Что спросят дальше
- Как обработать ошибку загрузки чанка после деплоя?
- Как не потерять ошибки в обработчиках событий?

### Ссылки
- [createRoot — error handling options](https://react.dev/reference/react-dom/client/createRoot#parameters)
- [Sentry for React](https://docs.sentry.io/platforms/javascript/guides/react/)

# Когда использовать конечные автоматы (state machines) в UI?
@slug state-machines
@topic state

> Когда у компонента или процесса много состояний и переходов, а набор булевых флагов (`isLoading`, `isError`, `isEditing`, `isSubmitted`) допускает невозможные комбинации. Конечный автомат явно описывает состояния, события и допустимые переходы: невозможные состояния непредставимы, логику можно визуализировать и тестировать отдельно от UI. Для простых случаев хватает `useReducer` с discriminated union, для сложных — XState.

```tsx
type State =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'error'; message: string }
  | { status: 'done'; url: string };

type Event =
  | { type: 'START' }
  | { type: 'PROGRESS'; value: number }
  | { type: 'FAIL'; message: string }
  | { type: 'SUCCESS'; url: string }
  | { type: 'RETRY' };

function reducer(state: State, event: Event): State {
  switch (state.status) {
    case 'idle':
      return event.type === 'START' ? { status: 'uploading', progress: 0 } : state;
    case 'uploading':
      if (event.type === 'PROGRESS') return { ...state, progress: event.value };
      if (event.type === 'FAIL') return { status: 'error', message: event.message };
      if (event.type === 'SUCCESS') return { status: 'done', url: event.url };
      return state;
    case 'error':
      return event.type === 'RETRY' ? { status: 'uploading', progress: 0 } : state;
    case 'done':
      return state;
  }
}
```

Переходы зависят от текущего состояния: событие `SUCCESS` в состоянии `idle` просто игнорируется — такие баги невозможны по построению.

XState добавляет: вложенные и параллельные состояния, отложенные переходы, вызов промисов и акторов, визуальный редактор (Stately), генерацию тестовых путей. Хорошие кандидаты: многошаговые мастера, загрузка файлов, видеоплеер, сложные формы с асинхронной валидацией, real-time соединения.

### Подводные камни
- Внедрять XState в каждую кнопку — для простых флагов это лишняя церемония.

### Что спросят дальше
- Чем XState отличается от редьюсера?
- Как тестировать автомат?

### Ссылки
- [XState — Docs](https://stately.ai/docs)
- [Choosing the State Structure — avoid contradictions](https://react.dev/learn/choosing-the-state-structure#avoid-contradictions-in-state)

# Как выстроить стратегию тестирования фронтенда?
@slug testing-strategy
@topic testing

> Большая часть уверенности — от интеграционных тестов компонентов и страниц (Testing Library + MSW): они проверяют поведение и дёшевы в поддержке («тестовый трофей»). Unit-тесты — для чистой логики (утилиты, редьюсеры, валидация). E2E (Playwright) — для критичных пользовательских путей: регистрация, оплата. Статический анализ (TypeScript, ESLint) — фундамент. Плюс визуальная регрессия для дизайн-системы и проверки доступности. Метрика — уверенность в релизе, а не процент покрытия.

Слои:

| Слой | Инструменты | Что проверяем |
|---|---|---|
| Статический | TypeScript strict, ESLint | типы, правила хуков, a11y-линтер |
| Unit | Vitest | чистые функции, редьюсеры, хуки |
| Интеграционный | Testing Library, MSW, Vitest (jsdom или Browser Mode) | страница или фича целиком с замоканным API |
| E2E | Playwright | ключевые сценарии в реальном браузере на стенде |
| Визуальный | Storybook + Chromatic / Playwright screenshots | регрессии вёрстки |
| Контрактный | сгенерированные типы из OpenAPI, Pact | совместимость с API |

```ts
// Playwright: критичный сценарий
test('пользователь оформляет заказ', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'В корзину' }).first().click();
  await page.getByRole('link', { name: /корзина/i }).click();
  await page.getByRole('button', { name: 'Оформить' }).click();
  await expect(page.getByRole('heading', { name: 'Заказ оформлен' })).toBeVisible();
});
```

Что ещё обсудить: где запускаются тесты (pre-commit — быстрые, PR — всё, nightly — тяжёлые e2e), борьба с flaky-тестами (автоожидания Playwright, изоляция данных, ретраи только с отчётом), тестовые данные и фабрики, Vitest Browser Mode для тестов в реальном браузере вместо jsdom.

### Подводные камни
- Гнаться за 100% покрытия — тесты на детали реализации, которые ломаются при каждом рефакторинге.
- Много e2e-тестов вместо интеграционных — медленно и нестабильно.

### Что спросят дальше
- Как бороться с нестабильными тестами?
- Что такое тестовый трофей?

### Ссылки
- [Kent C. Dodds — The Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Playwright](https://playwright.dev/docs/intro)
