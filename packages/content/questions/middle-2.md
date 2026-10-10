# Что такое batching и чем функция-апдейтер лучше значения?
@slug batching
@topic rendering
@legacy 21

> Batching — объединение нескольких обновлений состояния в один рендер. С React 18 батчинг автоматический везде: в обработчиках, промисах, таймаутах и нативных событиях. Функция-апдейтер `setX(prev => ...)` получает актуальное значение из очереди, а не из снимка рендера, поэтому корректна при нескольких обновлениях подряд и в асинхронном коде.

```tsx
async function handleSave() {
  setSaving(true);
  await api.save(form);
  // React 17: два рендера (вне обработчика батчинга не было)
  // React 18+: один рендер
  setSaving(false);
  setSavedAt(Date.now());
}

// Апдейтер против значения
setCount(count + 1);       // count — значение из снимка этого рендера
setCount((c) => c + 1);    // c — актуальное значение в очереди обновлений
```

Аналог из классов: `this.setState(obj)` против `this.setState((prevState, props) => ...)`. Второй аргумент `setState` в классах — колбэк после применения обновления; в хуках его нет, вместо него — эффект.

Если нужно применить обновление синхронно (например, прокрутить к только что добавленному элементу), есть `flushSync` из `react-dom` — но это редкий инструмент, он ухудшает производительность.

```tsx
flushSync(() => setItems((xs) => [...xs, item]));
listRef.current!.lastElementChild!.scrollIntoView();
```

### Подводные камни
- В интервалах и подписках `setCount(count + 1)` захватывает старое `count` (stale closure) — используйте апдейтер.
- Апдейтер должен быть чистым: в Strict Mode он вызывается дважды.

### Что спросят дальше
- Что делает flushSync и когда он оправдан?
- Как обновить state на основе props без эффекта?

### Ссылки
- [Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates)
- [flushSync — reference](https://react.dev/reference/react-dom/flushSync)

# Когда компонент перерендеривается?
@slug when-rerender
@topic rendering
@legacy 47

> Компонент рендерится, когда: изменился его state, изменился контекст, который он читает, или перерендерился его родитель. Последний пункт важен: по умолчанию React рендерит всех потомков компонента, чей state изменился, независимо от того, изменились ли их props. Рендер не равен обновлению DOM — если результат тот же, DOM не трогается.

Распространённый миф: «компонент перерендеривается, когда меняются его props». На самом деле изменение props — следствие рендера родителя. Если родитель рендерится, ребёнок рендерится тоже, даже с теми же props — если только он не обёрнут в `memo`.

```tsx
function Page() {
  const [query, setQuery] = useState('');
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <HeavyChart />   {/* рендерится на каждый ввод, хотя props нет */}
    </>
  );
}
```

Способы ограничить рендеры (по порядку предпочтения):

1. **Опустить state** в компонент, которому он нужен (`<SearchInput />` со своим state).
2. **Поднять контент** — передать тяжёлую часть как `children` из компонента выше.
3. **`memo`** для дорогого компонента + стабильные props.
4. **React Compiler** — автоматически мемоизирует компоненты и значения.

В классах аналогом было `shouldComponentUpdate(nextProps, nextState)` и `PureComponent`.

Как увидеть рендеры: React DevTools → Profiler → «Highlight updates when components render» и «Why did this render?», а также треки Performance в Chrome DevTools.

### Подводные камни
- `setState` с тем же значением (`Object.is`) может не вызвать рендер, но иногда React всё же рендерит компонент один раз перед тем, как прекратить.

### Что спросят дальше
- Почему ребёнок рендерится, если его props не изменились?
- Как узнать, почему компонент перерендерился?

### Ссылки
- [Render and Commit](https://react.dev/learn/render-and-commit)
- [memo — skipping re-renders](https://react.dev/reference/react/memo#skipping-re-rendering-when-props-are-unchanged)

# Что такое Error Boundaries и какие ошибки они не ловят?
@slug error-boundaries
@topic quality
@legacy 33

> Error Boundary — компонент, который перехватывает ошибки при рендере, в методах жизненного цикла и конструкторах потомков и показывает запасной UI вместо падения всего приложения. Его можно написать только классом (`getDerivedStateFromError` + `componentDidCatch`), поэтому обычно используют библиотеку `react-error-boundary`. Boundaries не ловят ошибки в обработчиках событий, асинхронном коде, SSR и в самом boundary.

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Что-то пошло не так: {error.message}</p>
      <button onClick={resetErrorBoundary}>Повторить</button>
    </div>
  );
}

<ErrorBoundary FallbackComponent={Fallback} onError={logToSentry} resetKeys={[userId]}>
  <UserDashboard userId={userId} />
</ErrorBoundary>;
```

Что не ловится и как с этим жить:

- **Обработчики событий** — обычный `try/catch` и state ошибки.
- **Асинхронный код** — ловите в промисе; чтобы передать ошибку в boundary, можно выбросить её в рендере через state или использовать `useErrorBoundary().showBoundary(error)`.
- **Отклонённый промис, прочитанный через `use()`**, и ошибки в Actions React 19 попадают в ближайший boundary.

Где ставить boundaries: вокруг роутов (страница), вокруг независимых виджетов (график, комментарии), чтобы падение одного не уничтожало всё.

В React 19 у `createRoot` есть опции `onCaughtError`, `onUncaughtError` и `onRecoverableError` для централизованного логирования.

### Подводные камни
- Один boundary на всё приложение — любая ошибка показывает пустой экран с «Что-то пошло не так».
- В режиме разработки ошибка всё равно показывается в оверлее — это не значит, что boundary не сработал.

### Что спросят дальше
- Почему Error Boundary нельзя написать на хуках?
- Как сбросить boundary после ошибки?

### Ссылки
- [Catching rendering errors with an error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [createRoot — error options](https://react.dev/reference/react-dom/client/createRoot#parameters)

# Что такое порталы и как в них работают события?
@slug portals
@topic rendering

> `createPortal(children, domNode)` рендерит потомков в другой DOM-узел (обычно в `document.body`), сохраняя их в React-дереве на прежнем месте. Порталы нужны для модальных окон, тултипов, тостов и выпадающих меню, которые не должны обрезаться `overflow: hidden` или перекрываться из-за `z-index` родителя. Контекст и события работают по React-дереву, а не по DOM.

```tsx
import { createPortal } from 'react-dom';

function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
```

Особенности:

- **События всплывают по React-дереву.** Клик внутри портала дойдёт до `onClick` компонента-родителя, хотя в DOM модалка лежит в `body`. Иногда это неожиданно — например, для клика «снаружи».
- **Контекст доступен** — тема, роутер и стор работают внутри портала без дополнительной настройки.
- **Доступность** — модалке нужны управление фокусом (focus trap), закрытие по Escape, `aria-modal`, возврат фокуса. Нативный `<dialog>` с `showModal()` решает часть задач сам; также помогают headless-библиотеки (Radix, React Aria).

### Подводные камни
- `document.body` не существует при SSR — порталы рендерят после монтирования.
- Обработчик «клик снаружи» через `contains()` по DOM ошибается для вложенных порталов.

### Что спросят дальше
- Как сделать доступное модальное окно?
- Чем `<dialog>` лучше div-модалки?

### Ссылки
- [createPortal — reference](https://react.dev/reference/react-dom/createPortal)

# Как работают React.lazy и Suspense для разделения кода?
@slug lazy-suspense
@topic performance

> `lazy(() => import('./Page'))` загружает код компонента только при первом рендере. Пока чанк загружается, ближайший `<Suspense fallback={...}>` выше по дереву показывает запасной UI. Это основной способ code splitting: тяжёлые страницы, редакторы и графики не попадают в начальный бандл.

```tsx
import { lazy, Suspense } from 'react';

const Settings = lazy(() => import('./pages/Settings'));
const Editor = lazy(() => import('./components/Editor'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Предзагрузка по наведению — пользователь не увидит спиннер
const loadEditor = () => import('./components/Editor');
<button onMouseEnter={loadEditor} onClick={openEditor}>Редактировать</button>;
```

Детали:

- `lazy` ожидает модуль с **default-экспортом**. Для именованного: `lazy(() => import('./x').then(m => ({ default: m.Chart })))`.
- `lazy` объявляют **на уровне модуля**, а не внутри компонента — иначе при каждом рендере будет новый тип и состояние сбросится.
- Ошибка загрузки чанка (например, после деплоя старые файлы удалены) ловится Error Boundary — стоит показать «Обновите страницу».
- Если переход вызван через `startTransition`, React продолжает показывать старый экран вместо fallback.

Suspense работает не только с кодом, но и с данными — через `use(promise)`, фреймворки и библиотеки с поддержкой Suspense.

### Подводные камни
- Слишком мелкое дробление — водопад запросов маленьких чанков вместо одного.
- Fallback на весь экран при каждом переходе — используйте переходы (transitions) и вложенные границы.

### Что спросят дальше
- Как Suspense работает с данными?
- Что будет, если чанк не загрузился?

### Ссылки
- [lazy — reference](https://react.dev/reference/react/lazy)
- [Suspense — reference](https://react.dev/reference/react/Suspense)

# HOC, render props и хуки: чем отличаются и что использовать сейчас?
@slug hoc-render-props-hooks
@topic architecture
@legacy 24

> Это три способа переиспользовать логику. HOC — функция, которая принимает компонент и возвращает новый с дополнительными props (`withRouter`, `connect`). Render props — компонент, который вызывает функцию-prop для рендера. Хуки (с React 16.8) решают ту же задачу проще и почти полностью заменили оба паттерна. HOC остаются уместны для сквозной функциональности на уровне компонента: проверка доступа, error boundary, аналитика.

```tsx
// HOC
function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function Protected(props: P) {
    const user = useUser();
    if (!user) return <Navigate to="/login" />;
    return <Component {...props} />;
  };
}

// Render props
<MouseTracker render={({ x, y }) => <Cursor x={x} y={y} />} />

// Хук
const { x, y } = useMousePosition();
```

Проблемы HOC и render props, которые решили хуки:

- **«Wrapper hell»** — глубокая вложенность в DevTools;
- **коллизии имён props** у нескольких HOC;
- **неявность** — непонятно, какой HOC добавил какой prop;
- **сложная типизация** HOC в TypeScript.

Родственный старый паттерн — **presentational и container компоненты**: «контейнер» получает данные, «презентационный» только отображает. Дэн Абрамов сам отозвал рекомендацию разделять так жёстко — сейчас ту же роль выполняют хуки, а разделение делают по смыслу, а не по шаблону.

Render props всё ещё встречаются в headless-библиотеках (Downshift, React Hook Form `Controller`), где нужно отдать управление разметкой пользователю.

### Подводные камни
- HOC, созданный внутри рендера, — новый тип компонента на каждом рендере и сброс состояния.
- Забыть пробросить `ref` и статические поля через HOC.

### Что спросят дальше
- Как типизировать HOC в TypeScript?
- Где render props всё ещё лучше хуков?

### Ссылки
- [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

# Как React сохраняет и сбрасывает состояние компонента?
@slug preserve-reset-state
@topic rendering

> Состояние привязано к позиции компонента в дереве рендера. Пока на той же позиции рендерится компонент того же типа (и с тем же `key`), state сохраняется. Если на этом месте появился другой тип или изменился `key`, React размонтирует старое поддерево со всем состоянием и смонтирует новое.

```tsx
// state сохраняется: тот же тип Counter в той же позиции
{isFancy ? <Counter isFancy /> : <Counter />}

// state сбрасывается: разные ключи — разные компоненты для React
{isPlayerA ? <Counter key="A" /> : <Counter key="B" />}

// Сброс формы при выборе другого контакта
<EditContact key={contact.id} contact={contact} />
```

Практические следствия:

- **Сброс формы** при смене сущности — через `key`, без эффектов.
- **Сохранение state** у скрытых вкладок — рендерить их всегда и скрывать CSS, поднять state выше или использовать `<Activity mode="hidden">` (React 19.2).
- **Нельзя объявлять компоненты внутри компонентов**: каждый рендер создаёт новую функцию, тип меняется, состояние теряется.
- Позиция определяется деревом JSX, а не DOM: `{cond && <A />}<B />` — `B` всегда во второй позиции, потому что `false` тоже занимает место.

### Подводные камни
- Выносить вложенный компонент «для читаемости» внутрь родителя — на каждом рендере теряется фокус и ввод.

### Что спросят дальше
- Как сохранить состояние вкладки при переключении?
- Что такое Activity?

### Ссылки
- [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)

# Как строить формы в React: подходы, библиотеки, валидация?
@slug forms
@topic ecosystem

> Есть три уровня: простые формы — неконтролируемые поля и `FormData` (в React 19 — form actions); формы средней сложности — контролируемые поля в state; сложные формы (много полей, динамические массивы, валидация) — React Hook Form со схемой Zod. Валидация на клиенте — для UX, но сервер обязан валидировать повторно.

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
});
type FormValues = z.infer<typeof schema>;

function SignUp() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit((data) => api.signUp(data))}>
      <input {...register('email')} aria-invalid={!!errors.email} />
      {errors.email && <p role="alert">{errors.email.message}</p>}
      <input type="password" {...register('password')} />
      <button disabled={isSubmitting}>Зарегистрироваться</button>
    </form>
  );
}
```

Почему React Hook Form популярен: поля неконтролируемые, поэтому ввод не перерисовывает всю форму; есть поддержка массивов полей, зависимой валидации и интеграция со схемами. Схема Zod одновременно даёт тип TypeScript и runtime-валидацию — её можно переиспользовать на сервере.

В React 19 для простых форм появились `<form action>`, `useActionState` и `useFormStatus` — без библиотек есть состояние отправки, ошибки и прогрессивное улучшение с серверными функциями.

Доступность форм: `<label htmlFor>`, `aria-invalid`, `aria-describedby` для ошибок, фокус на первом невалидном поле.

### Подводные камни
- Валидация только на клиенте — её легко обойти.
- Хранить все поля большой формы в одном `useState` и перерисовывать форму на каждый символ.

### Что спросят дальше
- Чем useActionState отличается от React Hook Form?
- Как сделать динамический список полей?

### Ссылки
- [form — reference](https://react.dev/reference/react-dom/components/form)
- [useActionState — reference](https://react.dev/reference/react/useActionState)

# Зачем нужен TanStack Query и чем серверное состояние отличается от клиентского?
@slug tanstack-query
@topic state

> Серверное состояние — копия данных, которые принадлежат серверу: оно асинхронно, может устареть, им пользуются многие компоненты. Клиентское — данные UI: открыта ли модалка, текст в поле, выбранная вкладка. TanStack Query управляет серверным состоянием: кэширует по ключу, дедуплицирует запросы, обновляет в фоне (stale-while-revalidate), повторяет при ошибках и даёт мутации с инвалидацией кэша.

```tsx
function useTodos(filter: Filter) {
  return useQuery({
    queryKey: ['todos', filter],          // ключ кэша зависит от параметров
    queryFn: ({ signal }) => api.getTodos(filter, { signal }),
    staleTime: 30_000,                    // 30 с данные считаются свежими
  });
}

function useAddTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addTodo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });
}

function TodoList({ filter }: { filter: Filter }) {
  const { data, isPending, error } = useTodos(filter);
  if (isPending) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{data.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

Что даёт «из коробки»:

- гонки и отмена запросов (передаётся `signal`);
- общий кэш: два компонента с одним ключом — один запрос;
- обновление при возврате на вкладку и восстановлении сети;
- пагинация, бесконечные списки, оптимистичные обновления, prefetch, SSR-гидрация.

Главный вывод: когда серверные данные уходят в TanStack Query (или RTK Query, SWR), глобального клиентского состояния обычно остаётся очень мало — и тяжёлый стейт-менеджер часто не нужен.

### Подводные камни
- Копировать `data` из `useQuery` в `useState` — теряется синхронизация с кэшем.
- Ключ, не включающий все параметры запроса, — разные данные попадают в одну запись кэша.

### Что спросят дальше
- Чем `staleTime` отличается от `gcTime`?
- Как сделать оптимистичное обновление?
- Нужен ли TanStack Query при использовании Server Components?

### Ссылки
- [TanStack Query — Overview](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Fetching data with Effects (альтернативы)](https://react.dev/reference/react/useEffect#what-are-good-alternatives-to-data-fetching-in-effects)
