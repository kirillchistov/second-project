# Какие есть правила хуков и почему они существуют?
@slug rules-of-hooks
@topic hooks
@legacy 34

> Хуки вызываются только на верхнем уровне функционального компонента или другого хука — не в условиях, циклах, обработчиках и после раннего `return`. Причина в устройстве: React хранит состояние хуков компонента в связном списке и сопоставляет их по порядку вызова. Если порядок меняется между рендерами, состояние «съезжает» к другому хуку.

```tsx
// Плохо: порядок хуков зависит от условия
function Profile({ user }: { user?: User }) {
  if (!user) return null;
  const [tab, setTab] = useState('info');   // на рендере без user этот хук не вызовется
}

// Хорошо: сначала все хуки, потом условия
function Profile({ user }: { user?: User }) {
  const [tab, setTab] = useState('info');
  if (!user) return null;
  // ...
}
```

Правила:

1. Только на верхнем уровне — порядок вызовов одинаков на каждом рендере.
2. Только из функциональных компонентов и кастомных хуков (имя начинается с `use`).
3. Хуки и компоненты должны быть чистыми; значения, переданные в хуки и возвращённые из них, не мутируются.

Исключение — хук `use` из React 19: его можно вызывать в условиях и циклах, потому что он не хранит состояние в списке хуков.

Правила проверяет `eslint-plugin-react-hooks`. В актуальных версиях он также включает проверки для React Compiler — их стоит включить сразу.

### Подводные камни
- Вызов хука внутри `useMemo`, `useEffect` или обработчика — тоже нарушение.
- Префикс `use` у функции, которая не вызывает хуков, сбивает с толку линтер и людей.

### Что спросят дальше
- Как React хранит состояние хуков внутри Fiber?
- Почему `use` можно вызывать условно?

### Ссылки
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [Rules of React](https://react.dev/reference/rules)

# Как избежать гонок при загрузке данных в useEffect?
@slug effect-race-conditions
@topic hooks

> Если зависимость меняется быстрее, чем приходит ответ, старый запрос может завершиться позже нового и перезаписать актуальные данные. Решение — в cleanup эффекта отменять запрос через `AbortController` или игнорировать устаревший результат флагом. А в продакшене чаще используют TanStack Query, SWR или загрузчики роутера, которые решают это из коробки.

```tsx
function UserCard({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setUser(null);

    fetch(`/api/users/${userId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setUser)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e);
      });

    return () => controller.abort();   // отменяем запрос для старого userId
  }, [userId]);
  // ...
}
```

Чего не хватает этому коду по сравнению с библиотеками: кэша между компонентами, дедупликации одинаковых запросов, повторов при ошибках, обновления при фокусе окна, SSR. Поэтому на собеседовании хорошо сказать: «руками — так, но в проекте я бы взял TanStack Query».

Ещё одна проблема загрузки в эффектах — **водопады**: родитель загрузил данные, отрендерил ребёнка, и только тогда ребёнок начал свою загрузку. Фреймворки решают это, начиная загрузку раньше рендера (loaders, Server Components, prefetch).

### Подводные камни
- `async` функция прямо в `useEffect(async () => ...)` — эффект вернёт промис вместо cleanup.
- Забытая обработка `AbortError` — ложные ошибки в UI при каждом переключении.

### Что спросят дальше
- Что такое waterfall-запросы и как их избежать?
- Почему TanStack Query называют менеджером серверного состояния?

### Ссылки
- [Fetching data with Effects](https://react.dev/reference/react/useEffect#fetching-data-with-effects)
- [You Might Not Need an Effect — fetching data](https://react.dev/learn/you-might-not-need-an-effect#fetching-data)

# Какие типичные анти-паттерны с useEffect?
@slug you-might-not-need-an-effect
@topic hooks

> Эффект нужен только для синхронизации с внешней системой. Частые ошибки: вычислять производные данные через эффект + state, обрабатывать действия пользователя в эффекте вместо обработчика, сбрасывать state при смене props, строить цепочки эффектов, которые обновляют state друг друга, и уведомлять родителя через эффект.

```tsx
// 1. Производные данные — считать в рендере
const visibleTodos = useMemo(() => filter(todos, tab), [todos, tab]); // или без useMemo

// 2. Реакция на действие — в обработчике, а не в эффекте
function handleBuy() {
  addToCart(product);
  showNotification(`${product.name} в корзине`);
}

// 3. Сброс состояния при смене сущности — через key
<Comments key={postId} postId={postId} />;

// 4. Уведомление родителя — в том же обработчике
function handleToggle() {
  const next = !isOn;
  setIsOn(next);
  onChange(next);
}
```

Вопрос, который помогает решить: **почему** этот код должен выполниться? Если «потому что пользователь нажал кнопку» — это обработчик. Если «потому что компонент показан на экране и должен быть синхронизирован с чем-то снаружи» — эффект.

Цена лишних эффектов: дополнительные рендеры (сначала со старым значением, потом с новым), мерцание UI, сложный для отладки поток данных и баги с порядком обновлений.

### Подводные камни
- Цепочки «эффект меняет state → другой эффект реагирует» превращают компонент в неявную машину состояний.
- Аналитика «при показе экрана» — допустимый эффект, а «при клике» — нет.

### Что спросят дальше
- Как загрузить данные при изменении фильтра без эффекта?
- Как подписаться на внешний стор правильно?

### Ссылки
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects)

# Когда действительно нужны useMemo и useCallback?
@slug use-memo-use-callback
@topic performance

> `useMemo` кэширует результат вычисления, `useCallback` — саму функцию между рендерами, пока не изменились зависимости. Они нужны, когда (1) вычисление действительно дорогое, (2) значение передаётся в компонент, обёрнутый в `memo`, или (3) значение используется как зависимость другого хука. В остальных случаях они только усложняют код. С React Compiler большая часть ручной мемоизации становится не нужна.

```tsx
const ProductList = memo(function ProductList({ items, onSelect }: Props) { /* ... */ });

function Catalog({ products, query }: { products: Product[]; query: string }) {
  // Дорогая фильтрация большого массива
  const filtered = useMemo(
    () => products.filter((p) => matches(p, query)),
    [products, query],
  );

  // Стабильная ссылка, иначе memo у ProductList бесполезен
  const handleSelect = useCallback((id: string) => {
    track('select', id);
  }, []);

  return <ProductList items={filtered} onSelect={handleSelect} />;
}
```

`useCallback(fn, deps)` — то же самое, что `useMemo(() => fn, deps)`.

Как понять, что вычисление дорогое: измерить через `console.time` или Profiler на медленном устройстве (CPU throttling). Если меньше миллисекунды — мемоизация не нужна.

Мемоизация не бесплатна: хранение значения, сравнение зависимостей, усложнение кода. А главное — она легко ломается, если хотя бы одна зависимость (объект или функция) создаётся заново на каждом рендере.

Прежде чем мемоизировать, стоит попробовать: опустить state ниже, передать JSX как `children`, убрать лишние эффекты.

### Подводные камни
- `useMemo` — подсказка для оптимизации, а не гарантия: React может сбросить кэш. Корректность кода не должна от него зависеть.
- Мемоизировать всё подряд «на всякий случай» — шум и ложное чувство контроля.

### Что спросят дальше
- Как React Compiler меняет подход к мемоизации?
- Почему `memo` не помогает, если передавать `children`?

### Ссылки
- [useMemo — reference](https://react.dev/reference/react/useMemo)
- [useCallback — reference](https://react.dev/reference/react/useCallback)

# Как работает React.memo и когда он бесполезен?
@slug react-memo
@topic performance
@legacy 30

> `memo(Component)` пропускает повторный рендер, если props поверхностно равны предыдущим (`Object.is` для каждого prop). Это аналог `PureComponent` и `shouldComponentUpdate` из классов. `memo` бесполезен, если какие-то props каждый раз новые (инлайн-объекты, стрелочные функции, `children`), или если компонент перерисовывается из-за своего state или контекста.

```tsx
const Row = memo(function Row({ item, onRemove }: RowProps) {
  return <li>{item.title} <button onClick={() => onRemove(item.id)}>×</button></li>;
});

// memo сломан: новая функция и новый объект на каждом рендере родителя
<Row item={{ ...item }} onRemove={(id) => remove(id)} />

// memo работает
const handleRemove = useCallback((id: string) => remove(id), [remove]);
<Row item={item} onRemove={handleRemove} />
```

Вторым аргументом можно передать свою функцию сравнения `arePropsEqual(prev, next)`, но это редкость: легко забыть новый prop и получить «застывший» UI.

`memo` не мешает рендеру из-за:

- изменения собственного state компонента;
- изменения контекста, который компонент читает через `useContext`.

Альтернативы без `memo`: переместить state вниз (в компонент, которому он нужен) или передавать тяжёлые части как `children` — элементы, созданные родителем выше, не пересоздаются при изменении state в промежуточном компоненте.

```tsx
function ScrollTracker({ children }: { children: React.ReactNode }) {
  const [y, setY] = useState(0);         // часто меняется
  // ...
  return <div>{children}</div>;          // children не перерисовываются при смене y
}
```

### Подводные камни
- Оборачивать в `memo` компоненты, которые и так дешёвые — сравнение props тоже стоит времени.

### Что спросят дальше
- Чем `memo` отличается от `useMemo`?
- Зачем нужен второй аргумент `memo`?

### Ссылки
- [memo — reference](https://react.dev/reference/react/memo)

# Чем useReducer отличается от useState и что такое reducer?
@slug use-reducer
@topic hooks
@legacy 40

> Reducer — чистая функция `(state, action) => newState`, которая описывает все переходы состояния в одном месте. `useReducer` удобен, когда state сложный, переходы зависят друг от друга или одно действие меняет несколько полей. `useState` проще для независимых простых значений.

```tsx
type State = { status: 'idle' | 'loading' | 'success' | 'error'; data?: Item[]; error?: string };
type Action =
  | { type: 'fetch' }
  | { type: 'resolve'; data: Item[] }
  | { type: 'reject'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'fetch':
      return { status: 'loading' };
    case 'resolve':
      return { status: 'success', data: action.data };
    case 'reject':
      return { status: 'error', error: action.error };
  }
}

const [state, dispatch] = useReducer(reducer, { status: 'idle' });
dispatch({ type: 'fetch' });
```

Плюсы `useReducer`:

- логика обновлений отделена от компонента и легко тестируется как чистая функция;
- `dispatch` стабилен — его можно передавать вниз без `useCallback`;
- discriminated unions в TypeScript исключают невозможные состояния;
- в связке с Context даёт простой глобальный стор без библиотек.

Reducer обязан быть чистым: никаких запросов, `Math.random()` и мутаций — в Strict Mode он вызывается дважды.

### Подводные камни
- Мутировать `state` внутри reducer и возвращать тот же объект — рендера не будет.
- Делать один огромный reducer на всё приложение без необходимости.

### Что спросят дальше
- Как совместить useReducer и Context?
- Чем reducer в React отличается от reducer в Redux?

### Ссылки
- [useReducer — reference](https://react.dev/reference/react/useReducer)
- [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer)
- [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)

# Как работает Context и какие у него проблемы?
@slug context
@topic state
@legacy 23

> Context передаёт значение всем потомкам без явной передачи props. Провайдер задаёт значение, а `useContext` (или `use`) читает ближайшее сверху. Главная проблема — производительность: при смене значения перерисовываются все компоненты, читающие этот контекст, даже если им нужна лишь часть данных. Context — механизм передачи, а не стейт-менеджер.

```tsx
type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }),
    [theme],
  );
  // React 19: <ThemeContext> вместо <ThemeContext.Provider>
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme должен вызываться внутри ThemeProvider');
  return ctx;
}
```

Как ограничить лишние рендеры:

- **Мемоизировать value**, иначе новый объект на каждом рендере провайдера перерисует всех потребителей.
- **Разделять контексты**: данные отдельно от функций (`StateContext` и `DispatchContext`), редко и часто меняющиеся данные — по разным контекстам.
- Для часто меняющегося глобального состояния брать стор с селекторами (Zustand, Redux, Jotai) — они подписывают компонент только на нужный срез.

Хорошие кандидаты для Context: тема, локаль, текущий пользователь, зависимости (клиенты API) — то, что меняется редко.

### Подводные камни
- Значение по умолчанию в `createContext` используется только если провайдера нет выше — частая причина «контекст не работает».
- Один гигантский `AppContext` со всем состоянием — каждое изменение перерисовывает пол-приложения.

### Что спросят дальше
- Почему Zustand с селекторами не вызывает лишних рендеров?
- Можно ли читать контекст условно?

### Ссылки
- [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
- [useContext — reference](https://react.dev/reference/react/useContext)

# Что такое prop drilling и как его избежать?
@slug prop-drilling
@topic architecture
@legacy 37

> Prop drilling — передача данных через несколько промежуточных компонентов, которым эти данные не нужны. Это делает код хрупким и шумным. Решения по возрастанию «тяжести»: композиция через `children` и слоты, Context, внешний стор, а для фильтров и выбора — URL.

Самое недооценённое решение — композиция. Вместо того чтобы передавать `user` через `Layout` и `Sidebar`, можно передать уже готовый элемент:

```tsx
// Drilling: Layout и Sidebar только пробрасывают user
<Layout user={user} />

// Композиция: Layout ничего не знает о user
<Layout
  sidebar={<Sidebar><UserMenu user={user} /></Sidebar>}
>
  <Feed user={user} />
</Layout>
```

Когда что выбирать:

- **2–3 уровня** — передача props нормальна и явна, это не проблема.
- **Глубокая вложенность, редко меняющиеся данные** (тема, пользователь, локаль) — Context.
- **Часто меняющиеся глобальные данные** — стор с селекторами.
- **Состояние, которое должно переживать перезагрузку и делиться ссылкой** — URL (search params).
- **Серверные данные** — кэш TanStack Query: любой компонент вызывает `useQuery` с тем же ключом и получает данные без передачи.

### Подводные камни
- Убегать от drilling в Context при первой же возможности — неявные зависимости хуже явных props.

### Что спросят дальше
- Что такое slot-паттерн?
- Как композиция помогает с производительностью?

### Ссылки
- [Before you use context](https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context)

# Как писать собственные хуки?
@slug custom-hooks
@topic hooks

> Кастомный хук — функция с именем на `use`, которая вызывает другие хуки и инкапсулирует переиспользуемую логику с состоянием. Хуки делятся логикой, а не состоянием: каждый вызов получает своё независимое состояние. Хороший хук решает одну конкретную задачу и имеет понятный API.

```tsx
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
    () => true,                          // значение на сервере
  );
}
```

Принципы хорошего хука:

- **Конкретная цель.** `useChatRoom`, `useMediaQuery`, `useDebouncedValue` — хорошо. `useMount` или `useEffectOnce` — плохо: они прячут суть эффекта.
- **Стабильный API.** Возвращаемые функции — стабильные (`useCallback`), объекты — мемоизированы, если их будут класть в зависимости.
- **Не переизобретать.** Для данных — TanStack Query, для форм — React Hook Form.
- **Тестируемость.** Хук тестируется через `renderHook` из Testing Library.

Хуки появились в React 16.8 и заменили HOC и render props как основной способ переиспользования логики.

### Подводные камни
- Два компонента, вызвавшие один хук, не делят состояние — для этого нужен Context или стор.
- Возвращать новый объект `{ data, refetch }` на каждом рендере и ломать мемоизацию у потребителей.

### Что спросят дальше
- Как протестировать кастомный хук?
- Что такое useSyncExternalStore?

### Ссылки
- [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

# Чем useLayoutEffect отличается от useEffect?
@slug use-layout-effect
@topic hooks

> `useLayoutEffect` запускается синхронно после изменения DOM, но до того, как браузер нарисует кадр. `useEffect` — после отрисовки, не блокируя её. `useLayoutEffect` нужен, когда надо измерить DOM и сразу поправить положение или размер без визуального мерцания — тултипы, поповеры, автоскролл.

```tsx
function Tooltip({ targetRect, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    // Измеряем до отрисовки, чтобы тултип не «прыгнул»
    setHeight(ref.current!.getBoundingClientRect().height);
  }, []);

  const top = targetRect.top - height < 0 ? targetRect.bottom : targetRect.top - height;
  return <div ref={ref} style={{ position: 'absolute', top }}>{children}</div>;
}
```

Порядок выполнения: render → commit (DOM обновлён) → `useLayoutEffect` → отрисовка браузером → `useEffect`.

Компромиссы:

- `useLayoutEffect` блокирует отрисовку — тяжёлый код в нём ухудшает отзывчивость.
- На сервере он не выполняется (раньше давал предупреждение при SSR).
- Есть ещё `useInsertionEffect` — запускается до layout-эффектов и предназначен только для авторов CSS-in-JS библиотек, чтобы вставлять стили.

Правило: по умолчанию `useEffect`; `useLayoutEffect` — только если видите мерцание из-за измерений.

### Подводные камни
- Переносить в `useLayoutEffect` загрузку данных «чтобы быстрее» — это не ускорит загрузку, но заблокирует кадр.

### Что спросят дальше
- Что такое useInsertionEffect?
- Как измерять DOM-элементы при SSR?

### Ссылки
- [useLayoutEffect — reference](https://react.dev/reference/react/useLayoutEffect)
- [useInsertionEffect — reference](https://react.dev/reference/react/useInsertionEffect)
