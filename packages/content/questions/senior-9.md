# Из-за чего React Compiler отказывается мемоизировать компонент?
@slug compiler-bailout-rules
@topic modern
@verified react@19.3
@updated 2026-11

> React Compiler требует, чтобы компонент соответствовал Rules of React — в первую очередь чистоте рендера. Он «бейлится» (отказывается оптимизировать функцию, оставляя её как есть, без автомемоизации) при мутации значений, полученных как props или из других хуков, при записи в ref **во время рендера** (а не в эффекте или обработчике), при условном вызове хуков и при не поддающихся статическому анализу паттернах вроде динамического доступа к хукам через индекс.

```tsx
// Бейлится: мутация пропса во время рендера
function BadList({ items }: { items: Item[] }) {
  items.sort((a, b) => a.order - b.order); // мутирует items из props
  return <ul>{items.map((i) => <li key={i.id}>{i.label}</li>)}</ul>;
}

// Бейлится: запись в ref во время рендера, не в эффекте
function BadLogger({ value }: { value: number }) {
  const prevRef = useRef(value);
  prevRef.current = value; // мутация ref прямо в теле компонента — не в эффекте
  return <span>{value}</span>;
}

// Компилятор оптимизирует: копия вместо мутации, ref меняется в эффекте
function GoodList({ items }: { items: Item[] }) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  return <ul>{sorted.map((i) => <li key={i.id}>{i.label}</li>)}</ul>;
}
```

Компилятор не ломает такой код — он просто пропускает его мимо автоматической мемоизации, компонент продолжает работать, как раньше, но без выгоды компилятора. ESLint-плагин `eslint-plugin-react-compiler` ловит часть этих случаев статически ещё до сборки, но не все — некоторые бейлауты видны только в отчёте компилятора при сборке.

### Подводные камни
- Думать, что бейлаут компилятора — ошибка выполнения: это тихий отказ от оптимизации, баг заметен только в профилировщике как отсутствие ожидаемой мемоизации.
- Мутировать объект, полученный как результат другого хука (например, `useMemo`), внутри того же компонента — компилятор не может доказать, что это безопасно.
- Полагаться только на компилятор и не запускать ESLint-плагин — часть нарушений чистоты рендера он ловит только в момент сборки, без раннего сигнала в редакторе.

### Что спросят дальше
- Как заметить в профилировщике, что конкретный компонент не был мемоизирован компилятором?
- Чем автоматическая мемоизация компилятора отличается от ручной расстановки `useMemo`/`useCallback` по покрытию случаев?

### Ссылки
- [React Compiler — react.dev](https://react.dev/learn/react-compiler/introduction)
- [Rules of React — react.dev](https://react.dev/reference/rules)

# Как диагностировать плохой INP на конкретном экране React-приложения?
@slug inp-debugging-react-tracks
@topic performance
@verified react@19.3
@updated 2026-11

> INP (Interaction to Next Paint) измеряет задержку от взаимодействия пользователя (клик, тап, нажатие клавиши) до следующей отрисовки кадра — в отличие от устаревшего FID, он учитывает **весь** путь: время до начала обработки, саму обработку события и время до отрисовки результата. В DevTools Performance панель React 19.2+ размечает длинные задачи специальными треками `Scheduler ⚛` и `Components ⚛`, которые показывают, какой именно React-компонент и какая фаза (рендер, эффект) держат главный поток дольше остальных.

Типичный сценарий разбора: клик по кнопке фильтра в таблице с 5000 строк даёт заметную задержку. В Performance-записи ищут самое длинное взаимодействие (interaction), разворачивают его `Scheduler ⚛` трек и видят, что 180 из 220 мс ушло на `beginWork` одного конкретного компонента списка — это указывает на дорогой рендер без мемоизации или виртуализации, а не на сам обработчик клика. Если долгая часть — не рендер, а эффект после коммита, задача обычно в синхронном вычислении внутри `useEffect`, которое стоит либо отложить, либо разбить на части через `scheduler.yield` / `startTransition`.

### Подводные камни
- Оптимизировать первое, что увидели в профиле, не проверив, что это действительно самое долгое взаимодействие (interaction) на странице — профиль содержит много шума от несвязанных задач.
- Путать общий `Long Tasks` трек с React-специфичными `Scheduler ⚛`/`Components ⚛` — последние точнее показывают, какой компонент виноват, а не просто «где-то в JS было долго».
- Мерить INP только локально на мощной машине разработчика — реальные значения у пользователей со слабыми устройствами и throttled CPU могут отличаться на порядок.

### Что спросят дальше
- Чем `startTransition` помогает снизить INP для тяжёлого обновления после клика?
- Как RUM (web-vitals библиотека) собирает INP с реальных пользователей, а не синтетически?

### Ссылки
- [Interaction to Next Paint (INP) — web.dev](https://web.dev/articles/inp)
- [React DevTools Performance tracks — react.dev](https://react.dev/blog/2024/09/27/react-labs-react-compiler-react-devtools-react-19)

# Спроектируйте API compound-компонента `<Tabs>` с клавиатурной навигацией и динамическими вкладками
@slug compound-component-tabs
@topic architecture
@verified react@19.3
@updated 2026-11

> Compound-компонент делит один виджет на несколько тесно связанных частей (`<Tabs>`, `<Tabs.List>`, `<Tabs.Tab>`, `<Tabs.Panel>`), которые общаются через общий Context, а не через длинный список props у одного компонента. Снаружи API выглядит декларативно и гибко — порядок и набор вкладок задаёт сам потребитель через JSX, а не через конфигурационный массив.

```tsx
const TabsContext = createContext<{ active: string; setActive: (id: string) => void } | null>(null);

function Tabs({ defaultTab, value, onChange, children }: TabsProps) {
  const [internal, setInternal] = useState(defaultTab);
  const active = value ?? internal; // та же логика controlled/uncontrolled, что и у useControllableState
  const setActive = (id: string) => { if (value === undefined) setInternal(id); onChange?.(id); };
  return <TabsContext value={{ active, setActive }}>{children}</TabsContext>;
}

function TabList({ children }: { children: React.ReactNode }) {
  const ids = Children.map(children, (c) => (isValidElement(c) ? c.props.id : null)) ?? [];
  function onKeyDown(e: React.KeyboardEvent) {
    const ctx = useContext(TabsContext)!;
    const i = ids.indexOf(ctx.active);
    if (e.key === 'ArrowRight') ctx.setActive(ids[(i + 1) % ids.length]);
    if (e.key === 'ArrowLeft') ctx.setActive(ids[(i - 1 + ids.length) % ids.length]);
  }
  return <div role="tablist" onKeyDown={onKeyDown}>{children}</div>;
}

function Tab({ id, children }: { id: string; children: React.ReactNode }) {
  const ctx = useContext(TabsContext)!;
  return (
    <button role="tab" aria-selected={ctx.active === id} tabIndex={ctx.active === id ? 0 : -1}
      onClick={() => ctx.setActive(id)}>
      {children}
    </button>
  );
}
```

По WAI-ARIA Authoring Practices стрелки переключают активную вкладку, а `Tab` в последовательности фокуса заходит только на саму панель вкладок — внутри неё фокус двигают стрелки, а не `Tab` (roving tabindex: активная вкладка получает `tabIndex={0}`, остальные `-1`). Динамические вкладки (добавление/удаление в рантайме) работают сами собой, потому что список вкладок — это просто дети `<Tabs.List>` в JSX, а не отдельный массив состояния, который нужно синхронизировать.

### Подводные камни
- Жёстко связать `Tabs.Tab` и `Tabs.Panel` позиционно (по индексу в массиве детей) вместо общего `id` — при удалении вкладки из середины списка сопоставление собьётся.
- Не реализовать roving tabindex — тогда `Tab` при обходе клавиатурой заходит на каждую вкладку по очереди, что не соответствует ожидаемому паттерну и ломает связность стрелочной навигации.
- Забыть `aria-controls` на вкладке и `aria-labelledby` на панели — связь между ними для скринридера остаётся только визуальной.

### Что спросят дальше
- Чем compound-компонент отличается от передачи единого массива конфигурации `tabs={[{id, label, content}]}` по удобству и гибкости для потребителя?
- Как `Tabs` того же API поддержать в controlled-режиме для синхронизации активной вкладки с URL?

### Ссылки
- [ARIA Authoring Practices: Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [Passing Data Deeply with Context — react.dev](https://react.dev/learn/passing-data-deeply-with-context)

# Спроектируйте систему уведомлений (toast): очередь, типы, автозакрытие, лимит и доступность
@slug notification-system-design
@topic architecture
@verified react@19.3
@updated 2026-11

> Система уведомлений — это один глобальный стор вне дерева конкретного экрана (Context + reducer, или внешний store вроде Zustand) плюс один `<Toaster />`, смонтированный один раз у корня приложения. Любой компонент вызывает `notify({ type, message })` императивно — не рендерит JSX уведомления сам, иначе уведомление исчезнет вместе с компонентом, который его вызвал.

```tsx
type Toast = { id: string; type: 'success' | 'error' | 'info'; message: string; duration?: number };

function notificationReducer(state: Toast[], action: { type: 'add' | 'remove'; toast?: Toast; id?: string }) {
  if (action.type === 'add') {
    const next = [...state, action.toast!];
    return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next; // лимит одновременных
  }
  return state.filter((t) => t.id !== action.id);
}

function Toaster() {
  const [toasts, dispatch] = useContext(NotificationContext)!;
  return (
    <div aria-live="polite" aria-atomic="false" className="toaster">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dispatch({ type: 'remove', id: t.id })} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.duration === 0) return; // 0 — не закрывать само, ждать ручного закрытия
    const t = setTimeout(onDismiss, toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [toast.duration, onDismiss]);
  return <div role="status">{toast.message}<button onClick={onDismiss} aria-label="Закрыть">×</button></div>;
}
```

`aria-live="polite"` на контейнере — скринридер объявит новое уведомление, не прерывая то, что пользователь уже слушает (в отличие от `assertive`, который прерывает немедленно и уместен только для срочных ошибок). Ошибочные уведомления обычно не закрывают по таймеру автоматически (`duration: 0`) — пользователь должен успеть прочитать и осознанно закрыть.

### Подводные камни
- Рендерить toast прямо из компонента, который его инициировал — уведомление исчезает вместе с размонтированием этого компонента, хотя должно жить независимо.
- Использовать `aria-live="assertive"` для всех типов уведомлений — частые неважные уведомления постоянно перебивают речь скринридера.
- Не ограничивать число одновременно видимых уведомлений — быстрая серия событий (например, массовое удаление элементов) заваливает экран стопкой toast.

### Что спросят дальше
- Как остановить таймер автозакрытия, пока курсор наведён на уведомление (pause on hover)?
- Чем `aria-live` регион отличается от использования `role="alert"` для срочных сообщений?

### Ссылки
- [ARIA: live region — MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
- [Managing State — react.dev](https://react.dev/learn/managing-state)

# Спроектируйте undo/redo для списка задач с группировкой быстрых последовательных правок
@slug undo-redo-design
@topic architecture
@verified react@19.3
@updated 2026-11

> Классическая модель undo/redo — два стека: `past` (прошлые состояния) и `future` (отменённые, доступные для повтора). Каждое изменение кладёт текущее состояние в `past` и очищает `future` (новое действие после отмены делает «редо» невозможным для старой ветки). `undo` переносит последнее состояние из `past` в `future` и делает его текущим; `redo` — наоборот.

```tsx
type History<T> = { past: T[]; present: T; future: T[] };

function historyReducer<T>(state: History<T>, action: { type: 'set' | 'undo' | 'redo'; value?: T }): History<T> {
  if (action.type === 'set') {
    return { past: [...state.past, state.present], present: action.value!, future: [] };
  }
  if (action.type === 'undo' && state.past.length > 0) {
    const previous = state.past[state.past.length - 1];
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  if (action.type === 'redo' && state.future.length > 0) {
    const next = state.future[0];
    return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
  }
  return state;
}
```

Без группировки каждое нажатие клавиши при редактировании текста задачи создавало бы отдельный шаг истории — `undo` отменял бы по одному символу. Группировку делают по времени: если новое изменение того же поля приходит в пределах короткого окна (например, 500 мс) после предыдущего, его **заменяют** последнюю запись в `past` вместо того, чтобы добавлять новую — так непрерывный ввод текста становится одним шагом отмены, а пауза (переключение на другое поле, явная остановка ввода) начинает новую группу.

### Подводные камни
- Класть в историю weak-ссылки или мутируемые объекты напрямую — если состояние потом мутируется на месте, в истории тоже меняется то, что должно было остаться снимком прошлого.
- Не ограничивать размер `past` — долгая сессия редактирования превращает историю в утечку памяти; обычно держат последние N шагов.
- Группировать по количеству изменений вместо времени — тогда пауза в середине быстрого ввода не разбивает группу, и один `undo` неожиданно отменяет слишком много.

### Что спросят дальше
- Как совместить этот подход с совместным редактированием несколькими пользователями (где chronology общая, а не только локальная)?
- Чем группировка по времени отличается от явной группировки по «транзакциям» (пользователь явно начинает и заканчивает составное изменение)?

### Ссылки
- [Extracting State Logic into a Reducer — react.dev](https://react.dev/learn/extracting-state-logic-into-a-reducer)
- [Command pattern — Refactoring Guru](https://refactoring.guru/design-patterns/command)

# Как извлечь параметры маршрута из строкового литерала на уровне типов?
@slug ts-route-params-type
@topic typescript
@verified react@19.3
@updated 2026-11

> Template literal types позволяют TypeScript разбирать строковый литерал по частям прямо в системе типов — то же самое, что `infer` делает для обычных типов, но применённое к сегментам строки. Для пути вида `'/users/:userId/posts/:postId'` можно рекурсивно извлечь имена параметров (`userId`, `postId`) и собрать из них объектный тип без единой строки рантайм-кода.

```ts
type ExtractParams<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string }
    : Path extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : {};

type Params = ExtractParams<'/users/:userId/posts/:postId'>;
// Params выводится как { userId: string; postId: string }

function useParams<Path extends string>(path: Path): ExtractParams<Path> {
  // рантайм-реализация парсит тот же path через regexp — типы и рантайм должны совпадать по смыслу
  return {} as ExtractParams<Path>;
}

const { userId, postId } = useParams('/users/:userId/posts/:postId'); // оба — string, автокомплит работает
```

Тип и рантайм-парсинг здесь — две независимые реализации одной и той же идеи: TypeScript не читает регулярку и не запускает код, он разбирает буквально тот же строковый литерал на уровне типов через сопоставление шаблона. Если рантайм-парсер и тип выведения разойдутся (например, кто-то поправит один, забыв про другой), типы останутся «правильными на бумаге», но не будут соответствовать тому, что реально возвращает функция.

### Подводные камни
- Думать, что template literal type выполняет регулярное выражение — на самом деле это чистое сопоставление с шаблоном на уровне типов, без рантайма.
- Не обработать случай пути без параметров (`'/about'`) — без базового случая условный тип может зависнуть в бесконечной рекурсии или вернуть не тот тип.
- Разойтись между типом и рантайм-парсером параметров маршрута — компилятор не проверяет, что они реализуют одну и ту же логику, только то, что сигнатура типов самосогласована.

### Что спросят дальше
- Как React Router типизирует `useParams()` для конкретного маршрута похожим механизмом?
- Чем рекурсивные условные типы отличаются от обычной рекурсии в рантайме по ограничениям (глубина, производительность компиляции)?

### Ссылки
- [Template Literal Types — TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
- [Conditional Types — TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
