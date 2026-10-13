# Что такое React Fiber и зачем он появился?
@slug fiber
@topic rendering
@legacy 45

> Fiber — архитектура reconciler, появившаяся в React 16. Каждый компонент в дереве представлен узлом-«файбером» — единицей работы со ссылками на родителя, первого ребёнка и соседа, а также с состоянием хуков, props и флагами изменений. Главное отличие от старого рекурсивного stack reconciler: работу можно прерывать, приостанавливать, приоритизировать и выбрасывать. На этом построен весь конкурентный React: transitions, Suspense, выборочная гидрация.

Что хранит Fiber-узел (упрощённо):

- `type`, `key`, `pendingProps`, `memoizedProps`;
- `memoizedState` — связный список хуков компонента;
- `return`, `child`, `sibling` — связи для обхода дерева без рекурсии;
- `flags` — какие изменения применить в commit (вставка, обновление, удаление);
- `lanes` — приоритет ожидающей работы;
- `alternate` — ссылка на «двойника» в другом дереве.

**Двойная буферизация.** React держит два дерева: `current` (то, что на экране) и `workInProgress` (строящееся). Рендер строит work-in-progress, а commit просто меняет указатель — как двойная буферизация в графике.

**Почему это важно.** Старый reconciler обходил дерево рекурсивно и синхронно: большое обновление блокировало главный поток на сотни миллисекунд, ввод «залипал». Fiber обходит дерево циклом и может отдать управление браузеру между единицами работы (time slicing, примерно каждые 5 мс), а затем продолжить или начать заново с более приоритетным обновлением.

### Подводные камни
- Говорить, что Fiber «делает React быстрее» — он делает рендер прерываемым и приоритизируемым, отзывчивость важнее сырой скорости.

### Что спросят дальше
- Что происходит в фазах render и commit?
- Что такое lanes?
- Как Fiber позволяет Suspense?

### Ссылки
- [React Fiber Architecture (acdlite)](https://github.com/acdlite/react-fiber-architecture)
- [Render and Commit](https://react.dev/learn/render-and-commit)

# Чем фаза render отличается от фазы commit?
@slug render-vs-commit
@topic rendering

> В фазе render React вызывает компоненты и вычисляет, что изменилось; она должна быть чистой, может прерываться, повторяться и выбрасываться. В фазе commit React синхронно и без прерываний применяет изменения к DOM, обновляет refs и запускает layout-эффекты; после отрисовки — пассивные эффекты (`useEffect`). Поэтому побочные эффекты допустимы только в commit-фазе — в эффектах и обработчиках.

Порядок работы одного обновления:

1. **Render (прерываемая).** Обход дерева: `beginWork` вызывает компонент и сравнивает детей, `completeWork` готовит DOM-узлы (ещё не вставленные) и собирает флаги.
2. **Commit — before mutation.** Чтение DOM до изменений (например, `getSnapshotBeforeUpdate` у классов).
3. **Commit — mutation.** Вставка, обновление и удаление DOM-узлов, отсоединение старых refs.
4. **Commit — layout.** Присоединение refs, `useLayoutEffect`, `componentDidMount/Update`. Затем указатель `current` переключается на новое дерево.
5. **Браузер рисует кадр.**
6. **Passive effects.** `useEffect` — асинхронно после отрисовки (но до следующего рендера).

Следствия для кода:

- в рендере нельзя менять внешнее состояние: в конкурентном режиме рендер может выполниться несколько раз, а результат — никогда не попасть на экран;
- `useLayoutEffect` блокирует отрисовку — только для измерений;
- если рендер вызван дискретным событием (клик), React синхронно выполняет пассивные эффекты до следующего события, чтобы не было рассинхронизации.

### Подводные камни
- Подписываться на внешний источник прямо в рендере — в прерванном рендере подписка останется без отписки.

### Что спросят дальше
- В каком порядке выполняются эффекты родителей и детей?
- Почему рендер может вызваться, но не дойти до commit?

### Ссылки
- [Render and Commit](https://react.dev/learn/render-and-commit)
- [Keeping Components Pure](https://react.dev/learn/keeping-components-pure)

# По каким эвристикам работает reconciliation?
@slug reconciliation
@topic rendering

> React сравнивает деревья за O(n), опираясь на две эвристики. Первая: элементы разных типов создают разные деревья — при смене типа старое поддерево размонтируется целиком, без попытки сравнить детей. Вторая: дети списка сопоставляются по `key`, а без ключей — по индексу. Для элементов одного типа React обновляет только изменившиеся атрибуты и рекурсивно сравнивает детей.

Как это проявляется:

```tsx
// Смена типа обёртки — Counter внутри размонтируется и потеряет state
{isMobile ? <div><Counter /></div> : <section><Counter /></section>}

// Тот же тип — DOM-узел сохраняется, меняется только className
<div className={active ? 'on' : 'off'} />

// Без ключей вставка в начало списка обновит каждый элемент;
// с ключами — один insertBefore
{items.map((it) => <Row key={it.id} item={it} />)}
```

Алгоритм для детей с ключами: React идёт по новому списку, сопоставляет ключи со старыми файберами (через Map), переиспользует совпавшие, удаляет лишние и помечает перемещённые. Перемещение элемента с конца в начало дороже, чем наоборот, — алгоритм оптимизирован под типичные операции добавления и удаления.

Сравнение не «глубокое»: React не сравнивает props между собой, чтобы решить, рендерить ли компонент, — он просто вызывает его (если нет `memo` или bailout). Сравнение — это сравнение результата, а не входа.

**Bailout**: React пропускает поддерево, если у файбера не изменились props (по ссылке), state и контекст — например, когда родитель вернул тот же самый элемент (`children` из компонента выше).

### Подводные камни
- Условно оборачивать компонент в разные контейнеры — неожиданная потеря state и повторная загрузка данных.

### Что спросят дальше
- Почему полное сравнение деревьев — O(n³)?
- Что такое bailout?

### Ссылки
- [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [Legacy: Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html)

# Как React приоритизирует обновления (lanes)?
@slug lanes-priorities
@topic rendering

> Каждое обновление получает приоритет — lane (бит в 31-битной маске). Дискретные события (клик, ввод) получают синхронный lane, непрерывные (scroll, mousemove) — чуть ниже, обычные — default, а `startTransition` — transition lanes; есть ещё idle и offscreen. Планировщик сначала обрабатывает самые приоритетные lanes и может прервать низкоприоритетный рендер, чтобы обработать срочное обновление, а потом начать его заново.

Как это выглядит на практике:

```tsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);                     // SyncLane: ввод обновится сразу
    startTransition(() => {
      setResults(filterHuge(e.target.value));     // TransitionLane: можно прервать
    });
  }
  // ...
}
```

Почему битовые маски: можно дёшево объединять обновления в группы, проверять, входит ли lane в набор, и рендерить несколько lanes за раз (батчинг по приоритету).

Связанные механизмы:

- **Scheduler** — пакет, который выполняет задачи по приоритету и отдаёт управление браузеру (через `MessageChannel`) примерно каждые 5 мс.
- **Starvation** — если низкоприоритетная работа слишком долго откладывается, её lane помечается как просроченный и выполняется синхронно.
- **Entanglement** — связанные обновления (например, несколько переходов) обрабатываются вместе, чтобы не показать промежуточное состояние.

На собеседовании редко ждут внутренних деталей — важнее объяснить, *зачем* приоритеты: срочный ввод не должен ждать тяжёлого рендера.

### Подводные камни
- Оборачивать в `startTransition` обновление контролируемого инпута — ввод станет «ленивым».

### Что спросят дальше
- Чем transition отличается от debounce?
- Как Scheduler отдаёт управление браузеру?

### Ссылки
- [useTransition — reference](https://react.dev/reference/react/useTransition)
- [React 18: What's new — concurrent features](https://react.dev/blog/2022/03/29/react-v18)

# Как работают useTransition и startTransition?
@slug use-transition
@verified react@19.3
@updated 2026-10
@topic modern

> Transition помечает обновление состояния как несрочное. React рендерит его в фоне, прерывает при срочных обновлениях (ввод) и не показывает Suspense-fallback для уже видимого контента — вместо этого старый UI остаётся на экране, а `isPending` позволяет показать индикатор. В React 19 transition может принимать асинхронную функцию — это и есть Action.

```tsx
function TabContainer() {
  const [tab, setTab] = useState('about');
  const [isPending, startTransition] = useTransition();

  function selectTab(next: string) {
    startTransition(() => {
      setTab(next);           // тяжёлая вкладка рендерится без блокировки
    });
  }

  return (
    <>
      <TabButtons onSelect={selectTab} pendingTab={isPending ? tab : null} />
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <Suspense fallback={<Spinner />}>
          {tab === 'posts' ? <Posts /> : <About />}
        </Suspense>
      </div>
    </>
  );
}

// React 19: асинхронный transition (Action)
startTransition(async () => {
  const error = await updateName(name);
  startTransition(() => {          // обновления после await нужно снова обернуть
    if (error) setError(error);
    else navigate('/profile');
  });
});
```

Когда использовать:

- навигация между экранами и вкладками;
- тяжёлый ререндер в ответ на ввод (фильтры, графики);
- мутации с отображением состояния ожидания (Actions).

Ограничения: внутри transition нельзя управлять текстовым инпутом (ввод должен быть срочным); `startTransition` вызывает функцию сразу и синхронно — откладывается не вызов, а рендер. `startTransition` без хука (импорт из `react`) нужен вне компонентов — например, в роутере или сторе.

С React 19.3 несколько transitions рендерятся независимо: медленный переход больше не задерживает остальные. Кроме того, transition запускает анимации `<ViewTransition>`: анимируются только обновления внутри `startTransition`, а `addTransitionType` выбирает тип анимации по причине перехода.

### Подводные камни
- Обновления state после `await` в async transition пока не считаются частью transition — их надо оборачивать повторно.
- Ожидать, что transition сделает рендер быстрее — он делает его неблокирующим.

### Что спросят дальше
- Чем useTransition отличается от useDeferredValue?
- Как transitions связаны с Suspense?

### Ссылки
- [useTransition — reference](https://react.dev/reference/react/useTransition)
- [startTransition — reference](https://react.dev/reference/react/startTransition)

# Что делает useDeferredValue и чем он отличается от debounce?
@slug use-deferred-value
@topic modern

> `useDeferredValue(value)` возвращает «отстающую» копию значения: при срочном обновлении React сначала рендерит со старым отложенным значением, а затем в фоне — с новым, прерывая этот фоновый рендер, если пользователь продолжает вводить. В отличие от debounce, нет фиксированной задержки: на быстром устройстве обновление почти мгновенное, на медленном — адаптивно отстаёт. Это инструмент для отзывчивого рендера, а не для уменьшения количества запросов.

```tsx
function Search() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        {/* memo обязателен: иначе SlowList рендерится и при срочном обновлении */}
        <SlowList query={deferredQuery} />
      </div>
    </>
  );
}

const SlowList = memo(function SlowList({ query }: { query: string }) { /* ... */ });
```

`useDeferredValue` vs `useTransition`: оба помечают работу как несрочную. `useTransition` — когда вы контролируете вызов `setState`; `useDeferredValue` — когда значение приходит извне (props, сторонний хук) и вы не можете обернуть его обновление.

С Suspense: если отложенное значение вызывает загрузку, пользователь продолжает видеть старый результат вместо fallback. В React 19 есть второй аргумент `initialValue` — значение для первого рендера.

### Подводные камни
- Без `memo` на тяжёлом компоненте выигрыша нет: он рендерится и в срочном проходе.
- Отложенное значение не уменьшает число запросов к API — для этого нужен debounce.

### Что спросят дальше
- Почему нужен memo вместе с useDeferredValue?
- Как показать, что контент устарел?

### Ссылки
- [useDeferredValue — reference](https://react.dev/reference/react/useDeferredValue)

# Как работает Suspense под капотом и как проектировать границы загрузки?
@slug suspense-deep-dive
@topic modern

> Компонент «приостанавливается», когда при рендере читает ещё не готовые данные: через `use(promise)`, `lazy` или библиотеку с поддержкой Suspense. React прерывает рендер этого поддерева, показывает fallback ближайшей границы `<Suspense>` и повторяет рендер, когда промис разрешится. Дизайн границ — это решение о UX: что грузится вместе, а что независимо, и где показывать скелетоны.

```tsx
function ProfilePage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileHeader userId={userId} />              {/* критичное: грузится вместе со страницей */}
      <Suspense fallback={<PostsSkeleton />}>
        <Posts userId={userId} />                     {/* может появиться позже */}
      </Suspense>
      <Suspense fallback={<FriendsSkeleton />}>
        <Friends userId={userId} />
      </Suspense>
    </Suspense>
  );
}
```

Важные свойства:

- **Промис должен быть стабильным** (кэшированным), иначе каждый повторный рендер создаёт новый запрос — бесконечная загрузка. Поэтому Suspense для данных используют через фреймворки и библиотеки (TanStack Query `useSuspenseQuery`, RSC), а не создавая промис в рендере.
- **Transitions не показывают fallback** для уже видимого контента — старый экран остаётся, пока новый не готов.
- **Сброс по ключу.** Чтобы при смене параметра снова показать fallback, а не старые данные, меняют `key` у границы.
- **Throttling показа.** React группирует появление соседних границ, чтобы контент не «мигал» по кускам.
- **Pre-warming (React 19).** После показа fallback React продолжает рендерить соседей приостановленного компонента в фоне, чтобы запустить их запросы параллельно.
- **На сервере** Suspense определяет точки стриминга: оболочка уходит сразу, контент границ — по мере готовности.

### Подводные камни
- Одна граница на всё приложение — любая загрузка заменяет экран спиннером.
- Слишком много мелких границ — «попкорн» из скелетонов.

### Что спросят дальше
- Как Suspense связан со стримингом SSR?
- Почему нельзя создавать промис прямо в рендере?

### Ссылки
- [Suspense — reference](https://react.dev/reference/react/Suspense)
- [use — reference](https://react.dev/reference/react/use)

# Что такое useSyncExternalStore и проблема tearing?
@slug use-sync-external-store
@topic state

> Tearing («разрыв») — ситуация в конкурентном рендеринге, когда разные части UI во время одного рендера читают разные версии внешнего стора, потому что рендер был прерван, а стор успел измениться. `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` — официальный способ подписаться на внешний источник данных так, чтобы React гарантировал согласованность. На нём построены Redux, Zustand и другие сторы.

```tsx
function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: T) => {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const counterStore = createStore(0);

function useCounter() {
  return useSyncExternalStore(counterStore.subscribe, counterStore.get, counterStore.get);
}

// Подписка на браузерный API
function useWindowWidth() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); },
    () => window.innerWidth,
    () => 1024,
  );
}
```

Требования:

- `getSnapshot` возвращает **одно и то же значение по ссылке**, если данные не изменились. Возврат нового объекта каждый раз — бесконечный цикл рендеров.
- `subscribe` должен быть стабильным (вне компонента или мемоизирован), иначе переподписка на каждом рендере.
- Если стор меняется во время non-blocking transition, React откатится к синхронному рендеру, чтобы избежать tearing, — то есть внешние сторы «отключают» часть преимуществ конкурентности.

### Подводные камни
- `getSnapshot: () => ({ ...state })` или `() => items.filter(...)` — новая ссылка каждый раз.
- Подписка на внешний стор через `useEffect + useState` — возможен tearing и пропуск обновлений между рендером и подпиской.

### Что спросят дальше
- Почему обновления внешних сторов нельзя сделать transition?
- Как реализовать селектор поверх useSyncExternalStore?

### Ссылки
- [useSyncExternalStore — reference](https://react.dev/reference/react/useSyncExternalStore)

# Что такое React Compiler и нужны ли теперь useMemo и useCallback?
@slug react-compiler
@verified react@19.3, babel-plugin-react-compiler@1.0
@updated 2026-10
@topic modern

> React Compiler (стабильная версия 1.0 вышла в октябре 2025) — плагин сборки (Babel, есть интеграции для Vite, Next.js, Expo), который анализирует компоненты и хуки и автоматически мемоизирует значения, функции и JSX с точностью до отдельных выражений, в том числе в условных ветках, где ручной `useMemo` невозможен. Для нового кода ручные `memo`, `useMemo` и `useCallback` в большинстве случаев не нужны; они остаются как «ручка» для точного контроля, например, для зависимостей эффектов.

```tsx
// Вы пишете
function TodoList({ todos, tab }: Props) {
  const visible = filterTodos(todos, tab);
  const handleClick = (id: string) => toggle(id);
  return <List items={visible} onClick={handleClick} />;
}

// Компилятор генерирует примерно такое (упрощённо)
function TodoList({ todos, tab }) {
  const $ = _c(4);                   // кэш на уровне компонента
  let visible;
  if ($[0] !== todos || $[1] !== tab) {
    visible = filterTodos(todos, tab);
    $[0] = todos; $[1] = tab; $[2] = visible;
  } else {
    visible = $[2];
  }
  // ...аналогично для handleClick и JSX
}
```

Требования к коду: компилятор полагается на **Rules of React** — чистые компоненты, иммутабельность props и state, правила хуков. Код, нарушающий правила, компилятор пропускает (не оптимизирует), а не ломает. Нарушения показывает `eslint-plugin-react-hooks` (в нём теперь есть правила компилятора).

Внедрение в существующий проект: включить линтер, исправить нарушения, включить компилятор постепенно (по директориям или через директиву `'use memo'`), проверить поведение и профилирование. Отключить для конкретного компонента — `'use no memo'`.

Работает с React 17+ (для 17 и 18 нужен пакет `react-compiler-runtime`).

Практическая ловушка: `eslint-plugin-react-hooks` 7.1.x собран с более новой версией компилятора, чем `babel-plugin-react-compiler` 1.0. «Зелёный» линтер не гарантирует, что компонент оптимизирован при сборке — это проверяют в React DevTools по бейджу Memo ✨. Версии плагина и линтера стоит обновлять вместе.

### Подводные камни
- Код, «работавший» благодаря мутациям во время рендера, может вести себя иначе после компиляции.
- Компилятор не уменьшает работу в самом вычислении — он лишь избегает повторов. Медленный алгоритм останется медленным.

### Что спросят дальше
- Почему ручной useMemo нельзя вызвать после условного return, а компилятор так может?
- Как внедрять компилятор в большой проект?

### Ссылки
- [React Compiler — Introduction](https://react.dev/learn/react-compiler/introduction)
- [React Compiler v1.0 — blog](https://react.dev/blog/2025/10/07/react-compiler-1)
- [Rules of React](https://react.dev/reference/rules)

# Что такое Actions в React 19: useActionState и useFormStatus?
@slug actions
@topic modern

> Action — асинхронная функция, запущенная в transition. React автоматически управляет состоянием ожидания, ошибками (через Error Boundary), оптимистичными обновлениями и порядком последовательных отправок. `<form action={fn}>` вызывает действие с `FormData` и сбрасывает неконтролируемые поля после успеха. `useActionState` хранит результат последнего действия и флаг ожидания, `useFormStatus` даёт дочерним компонентам статус родительской формы.

```tsx
async function updateName(prev: State, formData: FormData): Promise<State> {
  const name = String(formData.get('name'));
  const error = await api.updateName(name);
  return error ? { error } : { error: null, name };
}

function NameForm() {
  const [state, formAction, isPending] = useActionState(updateName, { error: null });

  return (
    <form action={formAction}>
      <input name="name" defaultValue={state.name} />
      <SubmitButton />
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();        // статус ближайшей родительской <form>
  return <button disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить'}</button>;
}
```

Почему это удобно:

- нет ручных `isLoading`, `try/finally` и гонок между отправками — действия выполняются последовательно;
- с серверными функциями (`'use server'`) форма работает **до загрузки JS** (прогрессивное улучшение), а `useActionState` может принять `permalink`;
- `useFormStatus` избавляет от прокидывания `isSubmitting` в кнопку.

Ограничения: `useFormStatus` работает только внутри `<form>` (в компоненте-потомке, не в том же компоненте, где форма); для сложной клиентской валидации многие по-прежнему берут React Hook Form.

### Подводные камни
- Ожидать, что `useActionState` даст контролируемые поля — сброс формы после action стирает несохранённые значения, если их не вернуть в state.

### Что спросят дальше
- Как Actions работают с useOptimistic?
- Чем Action отличается от обычного onSubmit?

### Ссылки
- [useActionState — reference](https://react.dev/reference/react/useActionState)
- [useFormStatus — reference](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [form — reference](https://react.dev/reference/react-dom/components/form)
