# Зачем нужен useId?
@slug use-id
@topic hooks

> `useId()` генерирует уникальный стабильный идентификатор, одинаковый на сервере и клиенте. Он нужен для связывания элементов через атрибуты доступности: `htmlFor`/`id`, `aria-describedby`, `aria-labelledby`. Счётчик или `Math.random()` для этого не подходят: при SSR id на сервере и клиенте разойдутся и гидрация сломается.

```tsx
function PasswordField() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Пароль</label>
      <input id={id} type="password" aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`}>Не менее 8 символов</p>
    </>
  );
}
```

Почему компонент не может просто захардкодить `id="password"`: его могут отрендерить на странице дважды, и id станут неуникальными — `label` будет ссылаться не на тот input.

Чем `useId` лучше глобального счётчика: id строится из пути компонента в дереве, поэтому не зависит от порядка выполнения кода на сервере и клиенте.

### Подводные камни
- `useId` не для ключей списков — ключи должны выводиться из данных.
- Сгенерированный id содержит спецсимволы, поэтому для `querySelector` его нужно экранировать (`CSS.escape`).

### Что спросят дальше
- Почему при SSR важно совпадение разметки сервера и клиента?

### Ссылки
- [useId — reference](https://react.dev/reference/react/useId)

# Как сейчас пишут на Redux: Redux Toolkit, store, slice, селекторы?
@slug redux-toolkit
@topic state
@legacy 19

> Redux — предсказуемый контейнер состояния: одно хранилище (store), изменения только через действия (actions), новое состояние вычисляют чистые reducers. Сейчас Redux пишут только через Redux Toolkit (RTK): `configureStore`, `createSlice` (генерирует action creators и reducer, внутри Immer), а в компонентах — хуки `useSelector` и `useDispatch` вместо `connect` и `mapStateToProps`.

```tsx
// cartSlice.ts
const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] as CartItem[] },
  reducers: {
    added(state, action: PayloadAction<CartItem>) {
      state.items.push(action.payload);          // Immer: «мутация» превращается в иммутабельное обновление
    },
    removed(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
  },
});
export const { added, removed } = cartSlice.actions;

// store.ts
export const store = configureStore({ reducer: { cart: cartSlice.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export const useAppSelector = useSelector.withTypes<RootState>();

// Компонент
const count = useAppSelector((s) => s.cart.items.length);
const dispatch = useDispatch();
dispatch(added(item));
```

Основные понятия:

- **Store** — объект с `getState`, `dispatch`, `subscribe`; единый источник истины.
- **Action** — объект `{ type, payload }`, описывающий, *что произошло*.
- **Reducer** — `(state, action) => newState`, чистая функция.
- **Selector** — функция чтения среза; `useSelector` перерисовывает компонент только если результат селектора изменился (`===`). Для производных данных — мемоизированные селекторы `createSelector`.

Когда Redux оправдан: большое клиентское состояние со сложными переходами, много команд, нужны DevTools с time-travel, middleware, строгие соглашения. Для серверных данных в RTK есть RTK Query.

### Подводные камни
- Селектор, возвращающий новый объект или массив (`s => s.items.filter(...)`), перерисовывает компонент на каждое изменение стора.
- Класть в Redux серверные данные вручную вместо RTK Query или TanStack Query.

### Что спросят дальше
- Как работает `createSelector`?
- Что такое middleware в Redux?
- Чем Redux отличается от Zustand?

### Ссылки
- [Redux Essentials](https://redux.js.org/tutorials/essentials/part-1-overview-concepts)
- [Redux Toolkit — Usage with TypeScript](https://redux-toolkit.js.org/usage/usage-with-typescript)

# Как работать с асинхронностью в Redux: thunk, RTK Query, saga?
@slug redux-async
@topic state
@legacy 29

> Reducer должен быть синхронным и чистым, поэтому асинхронная логика живёт в middleware. Redux Thunk позволяет диспатчить функции; в RTK это `createAsyncThunk`, который автоматически создаёт действия `pending/fulfilled/rejected`. Для загрузки и кэширования данных лучше подходит RTK Query. Redux-Saga (генераторы) и Redux-Observable (RxJS) — для сложных сценариев оркестрации; в новых проектах встречаются редко.

```tsx
// createAsyncThunk
export const fetchUser = createAsyncThunk('user/fetch', async (id: string, { signal }) => {
  const res = await fetch(`/api/users/${id}`, { signal });
  return (await res.json()) as User;
});

const userSlice = createSlice({
  name: 'user',
  initialState: { data: null as User | null, status: 'idle' as Status },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchUser.fulfilled, (s, a) => { s.status = 'idle'; s.data = a.payload; })
      .addCase(fetchUser.rejected, (s) => { s.status = 'failed'; });
  },
});

// RTK Query — кэш, дедупликация и хуки генерируются автоматически
export const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (b) => ({
    getUser: b.query<User, string>({ query: (id) => `users/${id}` }),
  }),
});
export const { useGetUserQuery } = api;
```

Как выбирать:

- **Загрузка данных с сервера** — RTK Query (если уже Redux) или TanStack Query.
- **Разовая асинхронная логика** (последовательность шагов, побочные действия) — `createAsyncThunk` или listener middleware.
- **Сложные долгоживущие процессы** (отмена, гонки, очереди, WebSocket) — listener middleware или saga.

Что такое middleware: функция-обёртка над `dispatch`, которая видит каждое действие до reducer и может его изменить, задержать, залогировать или вызвать побочный эффект.

### Подводные камни
- Хранить флаги `isLoading` для каждого запроса вручную, когда RTK Query делает это за вас.

### Что спросят дальше
- Как отменить thunk?
- Что такое listener middleware?

### Ссылки
- [Redux Fundamentals — Async Logic](https://redux.js.org/tutorials/fundamentals/part-6-async-logic)
- [RTK Query Overview](https://redux-toolkit.js.org/rtk-query/overview)

# Как выбрать способ управления состоянием: Context, Zustand, Jotai, Redux?
@slug state-management-choice
@topic state

> Сначала классифицировать состояние: серверное (TanStack Query, RTK Query, Server Components), URL (search params), формы (React Hook Form), локальное UI (useState). То, что осталось глобальным и клиентским, обычно небольшое. Для него: Context — для редко меняющихся значений; Zustand — простой стор с селекторами; Jotai — атомарное состояние; Redux Toolkit — для больших команд и сложной логики с жёсткими соглашениями.

```tsx
// Zustand: стор — это хук, подписка на срез через селектор
import { create } from 'zustand';

type CartStore = {
  items: CartItem[];
  add: (item: CartItem) => void;
};

export const useCart = create<CartStore>()((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
}));

// Компонент перерисуется только при изменении количества
const count = useCart((s) => s.items.length);
```

Сравнение:

| | Context | Zustand | Jotai | Redux Toolkit |
|---|---|---|---|---|
| Бойлерплейт | минимум | минимум | минимум | средний |
| Подписка на срез | нет | селекторы | атомы | селекторы |
| DevTools | нет | через middleware | есть | лучшие |
| Работа вне React | нет | да | частично | да |

Хорошие аргументы на собеседовании: «Context — не стейт-менеджер, а транспорт», «внешние сторы используют `useSyncExternalStore`, поэтому безопасны в конкурентном режиме», «главное — не тащить серверные данные в глобальный стор».

### Подводные камни
- Выбирать Redux «потому что так принято» для приложения с тремя глобальными флагами.
- Деструктурировать весь стор Zustand без селектора (`const { items } = useCart()`) — подписка на всё.

### Что спросят дальше
- Как внешние сторы интегрируются с конкурентным рендерингом?
- Что такое атомарное состояние?

### Ссылки
- [Zustand — Introduction](https://zustand.docs.pmnd.rs/getting-started/introduction)
- [Jotai — Introduction](https://jotai.org/docs/introduction)

# Когда хранить состояние в URL?
@slug url-state
@topic state

> В URL стоит хранить состояние, которым пользователь захочет поделиться или к которому вернуться: фильтры, сортировку, поиск, пагинацию, открытую вкладку, выбранный элемент. Плюсы: ссылка воспроизводит экран, работают кнопки «Назад/Вперёд», состояние переживает перезагрузку, нет дублирования в глобальном сторе.

```tsx
import { useSearchParams } from 'react-router';

function ProductFilters() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? 'all';
  const sort = params.get('sort') ?? 'popular';

  function update(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(key, value);
      next.delete('page');              // сбрасываем пагинацию при смене фильтра
      return next;
    }, { replace: true });
  }

  return (
    <select value={sort} onChange={(e) => update('sort', e.target.value)}>
      <option value="popular">Популярные</option>
      <option value="price">По цене</option>
    </select>
  );
}
```

Нюансы:

- **Валидация.** Параметры — пользовательский ввод, их нужно парсить и проверять (Zod или типизированные search params в TanStack Router, а также библиотека `nuqs`).
- **`replace` vs `push`.** Для ввода в поиск — `replace`, чтобы не засорять историю каждым символом.
- **Ключ запроса.** Параметры URL естественно становятся частью `queryKey` в TanStack Query.

Чего не класть в URL: секреты и персональные данные, большие объёмы, временные UI-флаги вроде hover.

### Подводные камни
- Дублировать фильтры и в URL, и в `useState` — источников истины становится два.

### Что спросят дальше
- Как типизировать search params?
- Как синхронизировать URL и форму фильтров с debounce?

### Ссылки
- [React Router — useSearchParams](https://reactrouter.com/api/hooks/useSearchParams)
- [nuqs](https://nuqs.dev)

# Как типизировать props, children и события в TypeScript?
@slug typescript-props
@topic typescript
@legacy 38

> Props описывают через `type` или `interface` и деструктурируют с аннотацией. Для children — `React.ReactNode`, для событий — `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>` и т. п. Чтобы расширить нативный элемент, используют `React.ComponentProps<'button'>`. PropTypes устарели: в React 19 их проверка удалена, а TypeScript проверяет типы на этапе компиляции.

```tsx
type ButtonProps = React.ComponentProps<'button'> & {
  variant?: 'primary' | 'ghost';
  icon?: React.ReactNode;
};

export function Button({ variant = 'primary', icon, children, ...rest }: ButtonProps) {
  return (
    <button className={`btn btn--${variant}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

function Search({ onSearch }: { onSearch: (q: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => onSearch(e.target.value);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') e.currentTarget.blur();
  };
  return <input onChange={handleChange} onKeyDown={handleKeyDown} />;
}
```

Полезные типы:

- `React.ReactNode` — всё, что можно отрендерить (строки, числа, элементы, массивы, `null`).
- `React.ReactElement` — только JSX-элемент.
- `React.ComponentProps<typeof MyComponent>` — props существующего компонента.
- `React.PropsWithChildren<P>` — добавляет `children`.
- `React.CSSProperties` — объект стилей.

`React.FC` использовать можно, но большинство команд предпочитают обычные функции с типизированными props: проще с дженериками и нет неявных особенностей.

Runtime-валидация всё ещё нужна на границах системы (ответы API, формы, URL) — для неё используют Zod или Valibot, а не PropTypes.

### Подводные камни
- `JSX.Element` вместо `ReactNode` для children — нельзя передать строку или `null`.
- `any` в обработчиках событий — теряется автодополнение `e.target`.

### Что спросят дальше
- Чем `type` отличается от `interface` для props?
- Как типизировать полиморфный компонент с prop `as`?

### Ссылки
- [Using TypeScript — react.dev](https://react.dev/learn/typescript)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

# Как написать дженерик-компонент на TypeScript?
@slug typescript-generics
@topic typescript

> Дженерик-компонент объявляется как функция с параметром типа: `function List<T>(props: ListProps<T>)`. TypeScript выводит `T` из переданных данных, и колбэки (`renderItem`, `onSelect`, `getKey`) получают точный тип элемента. Это основа переиспользуемых таблиц, списков, селектов и автокомплитов.

```tsx
type ListProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onSelect?: (item: T) => void;
};

export function List<T>({ items, getKey, renderItem, onSelect }: ListProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={getKey(item)} onClick={() => onSelect?.(item)}>
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}

// T выведен как User — user.name типизирован
<List items={users} getKey={(u) => u.id} renderItem={(u) => u.name} />;
```

Детали:

- В `.tsx` стрелочной функции нужна запятая: `const List = <T,>(props: ListProps<T>) => ...`, иначе `<T>` читается как JSX.
- Ограничения: `<T extends { id: string }>` позволяет обойтись без `getKey`.
- Ключи объекта: `<T, K extends keyof T>` — например, таблица с колонками `{ key: K; title: string }`.
- `memo` и `forwardRef` теряют дженерик — нужен каст типа. В React 19 `ref` — обычный prop, и `forwardRef` не нужен.

### Подводные камни
- Указывать `T = any` по умолчанию — теряется весь смысл дженерика.

### Что спросят дальше
- Как типизировать колонки таблицы через `keyof`?
- Как сохранить дженерик при обёртке в `memo`?

### Ссылки
- [React TypeScript Cheatsheet — Generic Components](https://react-typescript-cheatsheet.netlify.app/docs/advanced/patterns_by_usecase/#generic-components)

# Как типизировать хуки и описывать состояние через discriminated unions?
@slug typescript-hooks
@topic typescript

> `useState` выводит тип из начального значения; если начальное значение `null` или пустой массив — тип указывают явно: `useState<User | null>(null)`. `useRef<HTMLDivElement>(null)` для DOM-ссылок. `useReducer` типизируется через тип состояния и union действий. Для асинхронного состояния лучше discriminated union, чем набор независимых флагов: невозможные состояния становятся непредставимыми.

```tsx
// Плохо: возможна комбинация isLoading && error && data
const [isLoading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [data, setData] = useState<User[] | null>(null);

// Хорошо: одно состояние, каждая ветка со своими полями
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; error: string };

const [state, setState] = useState<State>({ status: 'idle' });

if (state.status === 'success') {
  state.data.map(/* TypeScript знает, что data есть */);
}

// Ссылки
const inputRef = useRef<HTMLInputElement>(null);     // RefObject<HTMLInputElement | null>
const timerRef = useRef<number | undefined>(undefined);

// Контекст без значения по умолчанию
const AuthContext = createContext<AuthValue | null>(null);
```

Для кастомных хуков, возвращающих кортеж, используйте `as const`, иначе TypeScript выведет массив объединённых типов:

```tsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const;     // readonly [boolean, () => void]
}
```

Проверка полноты в `switch` по union — через `never`: если добавить новый статус и забыть ветку, будет ошибка компиляции.

### Подводные камни
- `useState([])` — тип `never[]`, ничего добавить нельзя.
- `useRef<T>()` без аргумента в React 19 типах — ошибка: аргумент теперь обязателен.

### Что спросят дальше
- Как обеспечить исчерпывающую проверку union через `never`?
- Как типизировать контекст без значения по умолчанию?

### Ссылки
- [TypeScript with React Hooks — react.dev](https://react.dev/learn/typescript#typing-hooks)

# Что изменилось в React 19 для повседневного кода?
@slug react-19-changes
@topic modern

> Главное: Actions и хуки для форм (`useActionState`, `useFormStatus`, `useOptimistic`), новый API `use`, `ref` как обычный prop (без `forwardRef`), `<Context>` вместо `<Context.Provider>`, cleanup у ref-колбэков, нативная поддержка `<title>`, `<meta>` и стилей в компонентах, стабильные Server Components. Удалены давно устаревшие API: `propTypes` и `defaultProps` у функций, строковые refs, legacy context, `ReactDOM.render` и `hydrate`.

```tsx
// ref как prop — forwardRef не нужен
function Input({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} />;
}

// Контекст как провайдер
<ThemeContext value="dark">{children}</ThemeContext>

// Метаданные прямо в компоненте — React поднимет их в <head>
function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      <title>{post.title}</title>
      <meta name="description" content={post.excerpt} />
      <h1>{post.title}</h1>
    </article>
  );
}

// Ref-колбэк с очисткой
<div ref={(node) => {
  const observer = new ResizeObserver(onResize);
  observer.observe(node!);
  return () => observer.disconnect();
}} />
```

Также стоит знать:

- **Лучшие сообщения об ошибках гидрации** — один дифф вместо десятка предупреждений.
- **Опции `onCaughtError` / `onUncaughtError`** у `createRoot`.
- **Поддержка Custom Elements** — props передаются как свойства.
- **API предзагрузки ресурсов**: `preload`, `preinit`, `prefetchDNS`, `preconnect` из `react-dom`.
- В **React 19.2** добавлены `<Activity>`, `useEffectEvent`, `cacheSignal`, треки производительности в Chrome DevTools; **React Compiler 1.0** вышел стабильным.

Миграция: обновиться до React 18.3 (он предупреждает об устаревших API), применить codemods (`npx codemod@latest react/19/migration-recipe`), затем обновить.

### Подводные камни
- Ref-колбэк со стрелочной функцией, неявно возвращающей значение (`ref={n => (this.x = n)}`), в React 19 будет воспринят как cleanup — TypeScript это отловит.

### Что спросят дальше
- Что такое Actions?
- Как работает хук `use`?
- Что даёт React Compiler?

### Ссылки
- [React v19 — blog](https://react.dev/blog/2024/12/05/react-19)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [React 19.2 — blog](https://react.dev/blog/2025/10/01/react-19-2)

# Как тестировать React-компоненты: философия Testing Library и Vitest?
@slug testing-library
@topic testing
@legacy 9

> Стандарт — React Testing Library поверх Vitest или Jest. Философия: тестировать поведение так, как пользователь взаимодействует с интерфейсом, а не детали реализации. Искать элементы по ролям и подписям (`getByRole`, `getByLabelText`), взаимодействовать через `user-event`, проверять видимый результат. Тогда рефакторинг внутренностей не ломает тесты.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

test('отправляет форму с введённым email', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<SubscribeForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/email/i), 'ann@example.com');
  await user.click(screen.getByRole('button', { name: /подписаться/i }));

  expect(onSubmit).toHaveBeenCalledWith('ann@example.com');
  expect(screen.getByText(/спасибо/i)).toBeInTheDocument();
});
```

Приоритет запросов: `getByRole` → `getByLabelText` → `getByPlaceholderText` → `getByText` → … → `getByTestId` в последнюю очередь. Если элемент не найти по роли — это часто сигнал о проблеме с доступностью.

Варианты запросов:

- `getBy…` — элемент обязан быть (иначе ошибка);
- `queryBy…` — возвращает `null`, для проверки отсутствия;
- `findBy…` — промис, ждёт появления (асинхронный UI).

Почему Vitest вытесняет Jest в проектах на Vite: использует ту же конфигурацию и трансформации, нативно понимает ESM и TypeScript, быстрее, API совместим с Jest. Enzyme мёртв — он не поддерживает современный React.

### Подводные камни
- Проверять state, вызовы хуков или имена CSS-классов — тест ломается при рефакторинге без изменения поведения.
- `fireEvent` вместо `user-event` — не воспроизводит реальную последовательность событий (focus, keydown, input…).

### Что спросят дальше
- Как тестировать компонент с асинхронной загрузкой?
- Что такое snapshot-тесты и почему их критикуют?

### Ссылки
- [Testing Library — Guiding Principles](https://testing-library.com/docs/guiding-principles)
- [Testing Library — Query priority](https://testing-library.com/docs/queries/about#priority)
- [Vitest](https://vitest.dev/guide/)
