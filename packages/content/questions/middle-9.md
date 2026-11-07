# Что можно передать через границу `'use client'` и что она тянет в бандл?
@slug use-client-boundary
@topic server
@verified react@19.3
@updated 2026-11

> `'use client'` в начале файла помечает модуль и всё, что он экспортирует, как клиентский: эти компоненты гидрируются в браузере и могут использовать state, эффекты и события. Через границу из серверного компонента в клиентский можно передать только **сериализуемые** props — простые объекты, массивы, строки, числа, и JSX-дерево как `children`. Функции и классы передать нельзя: их негде выполнить на клиенте, они не переживают сериализацию в RSC payload.

```tsx
// ServerPage.tsx — Server Component, без 'use client'
import { LikeButton } from './LikeButton';

export default function Post({ id }: { id: string }) {
  const post = await db.posts.find(id); // обращение к базе прямо здесь — ок на сервере
  return (
    <article>
      <h1>{post.title}</h1>
      <LikeButton postId={id} initialCount={post.likes} /> {/* initialCount — число, ок */}
    </article>
  );
}
```

```tsx
// LikeButton.tsx
'use client';
export function LikeButton({ postId, initialCount }: { postId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  return <button onClick={() => setCount((c) => c + 1)}>❤️ {count}</button>;
}
```

Граница односторонняя: серверный компонент может импортировать клиентский и передать ему props, но клиентский компонент не может импортировать серверный напрямую (обратное — только через `children`, переданный сверху). Любой модуль, который импортирует файл с `'use client'`, сам по себе не становится клиентским — директива действует на уровне конкретного файла и его графа импортов вниз, а не распространяется вверх по дереву импортов.

### Подводные камни
- Передать функцию (например, колбэк, созданный на сервере) в клиентский компонент — RSC payload её сериализовать не может, это ошибка сборки или рантайма.
- Импортировать тяжёлую серверную библиотеку (например, клиент базы данных) внутри файла с `'use client'` — она целиком попадёт в клиентский бандл, хотя там бесполезна.
- Думать, что `'use client'` нужен на каждом файле с интерактивностью — директива нужна только у «входа» в клиентское поддерево, его дети клиентские автоматически.

### Что спросят дальше
- Как передать функцию с сервера на клиент, если это действительно нужно (Server Actions)?
- Чем RSC payload отличается от обычного HTML при первой загрузке страницы?

### Ссылки
- [use client — react.dev](https://react.dev/reference/rsc/use-client)
- [Server and Client Components — react.dev](https://react.dev/reference/rsc/server-components)

# Как `useFormStatus` и `useActionState` работают вместе в форме?
@slug form-status-action-state
@topic modern
@verified react@19.3
@updated 2026-11

> `useFormStatus()` обязан вызываться в компоненте-**потомке** `<form>`, а не в том компоненте, который саму форму рендерит, — он читает статус ближайшего родительского `<form action={...}>` через контекст, и в компоненте с самой формой всегда вернёт `pending: false`. `useActionState(action, initialState)` живёт на уровне формы: оборачивает Action, хранит последнее возвращённое состояние (например, ошибку валидации) и даёт свою версию `pending`, которая обновляется синхроннее, чем у `useFormStatus` в дочерних компонентах.

```tsx
function SubmitButton() {
  const { pending } = useFormStatus(); // работает, только если это потомок <form>
  return <button disabled={pending}>{pending ? 'Отправка…' : 'Сохранить'}</button>;
}

function ProfileForm() {
  const [state, formAction] = useActionState(updateProfile, { error: null });
  return (
    <form action={formAction}>
      <input name="name" defaultValue={state.lastName} />
      {state.error && <p role="alert">{state.error}</p>}
      <SubmitButton /> {/* SubmitButton — потомок form, useFormStatus видит его состояние */}
    </form>
  );
}
```

После неудачной отправки React 19 **не** сбрасывает несистемные поля формы — значения, которые пользователь ввёл, остаются на экране, и именно `state.error` из `useActionState` показывает, что пошло не так, без явного `useState` для ошибки. Если Action завершился успехом и вернул новое состояние без ошибки, несохранённые значения в неконтролируемых полях (`defaultValue`) не трогаются автоматически — форму очищает сам Action или код, который его вызвал.

### Подводные камни
- Вызвать `useFormStatus` в том же компоненте, где находится `<form>` — он вернёт `pending: false` всегда, потому что форма ещё не «над» ним в дереве.
- Ожидать, что `useActionState` сам очистит поля формы после успеха — это нужно сделать явно внутри Action или ответом на него.
- Путать `pending` из `useActionState` и из `useFormStatus` — у вложенных нескольких `<SubmitButton>` в разных формах каждый видит статус только своей ближайшей формы.

### Что спросят дальше
- Чем Action отличается от обычного `onSubmit` с ручным `fetch` с точки зрения отслеживания состояния?
- Как показать опциональные (non-blocking) ошибки валидации по мере ввода, не дожидаясь отправки формы?

### Ссылки
- [useFormStatus — react.dev](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [useActionState — react.dev](https://react.dev/reference/react/useActionState)

# Когда `useImperativeHandle` нужен, а когда достаточно ref-колбэка с cleanup?
@slug use-imperative-handle
@topic hooks
@verified react@19.3
@updated 2026-11

> `useImperativeHandle` меняет, что окажется в `ref` родителя, когда он указывает на дочерний компонент: вместо реального DOM-узла или вложенного значения родитель получает выбранный вами «урезанный» API — например, только методы `focus()` и `scrollIntoView()`, а не весь `HTMLInputElement`. Ref-колбэк с cleanup (`ref={(node) => { ...; return () => {...}; }}`) решает другую задачу: он нужен, когда важно знать не содержимое ref, а сам момент присоединения и отсоединения DOM-узла — например, чтобы подписаться на сторонний виджет при маунте и аккуратно его уничтожить при отсоединении.

```tsx
interface VideoHandle { play(): void; pause(): void }

const VideoPlayer = forwardRef<VideoHandle, { src: string }>(({ src }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
  }), []);
  return <video ref={videoRef} src={src} />;
});

// Родитель: playerRef.current имеет только play/pause, не весь <video>
```

С React 19 функциональные компоненты получают `ref` как обычный prop — `forwardRef` для этого уже не обязателен, но `useImperativeHandle` остаётся тем же: он нужен именно тогда, когда родителю нельзя давать прямой доступ к DOM-узлу целиком, а нужен контролируемый, узкий набор операций.

### Подводные камни
- Использовать `useImperativeHandle`, чтобы «прокинуть» весь DOM-узел без изменений — тогда достаточно просто передать `ref` насквозь, без обёртки.
- Через `useImperativeHandle` выставлять наружу изменение состояния родителя напрямую (императивный `setState` родителя из ребёнка) — это ломает однонаправленный поток данных, лучше поднять колбэк через props.
- Не закрыть подписку в cleanup ref-колбэка — при каждом повторном подключении узла (смена `key`, условный рендер) старая подписка остаётся висеть.

### Что спросят дальше
- Почему императивные API (`play()`, `focus()`) обычно считаются исключением из декларативного стиля React, а не нормой?
- Как ref-колбэк с cleanup изменил работу с DOM-узлами по сравнению с обычным `useEffect` + `useRef`?

### Ссылки
- [useImperativeHandle — react.dev](https://react.dev/reference/react/useImperativeHandle)
- [Manipulating the DOM with Refs — react.dev](https://react.dev/learn/manipulating-the-dom-with-refs)

# Чем `suppressHydrationWarning` отличается от полного клиентского рендера через `use(browser())`?
@slug suppress-hydration-warning
@topic server
@verified react@19.3
@updated 2026-11

> `suppressHydrationWarning` — точечный инструмент: он гасит предупреждение о несовпадении **одного текстового узла** (например, относительного времени «5 минут назад», которое неизбежно чуть отличается между сервером и клиентом) и ставится именно на элемент с этим текстом, а не на всё поддерево. React всё равно рендерит то, что вычислил сервер, при первой отрисовке — несовпадение просто не считается ошибкой гидрации для этого узла.

```tsx
<time suppressHydrationWarning>{formatRelative(createdAt)}</time>
```

Для контента, который **в принципе не существует** на сервере (значение из `window`, `localStorage`, геолокация), `suppressHydrationWarning` не подходит — он не решает проблему отсутствия данных, только глушит предупреждение о разнице в тексте. Здесь нужен паттерн «рендерить только на клиенте»: например, через `use()` с промисом, который резолвится к браузерному значению и оборачивается в `<Suspense>` с серверным fallback, либо через `useEffect` + отдельный флаг «гидратация завершена» для простых случаев.

### Подводные камни
- Ставить `suppressHydrationWarning` на весь компонент или контейнер вместо конкретного текстового узла — предупреждения о реальных расхождениях в остальном поддереве продолжат появляться или, наоборот, маскируются там, где их быть не должно.
- Использовать `suppressHydrationWarning` для контента, которого вообще нет на сервере — warning уйдёт, но несовпадение останется, просто незаметно.
- Вычислять дату или случайное значение прямо в JSX без привязки к `suppressHydrationWarning` или клиентскому паттерну — это гарантированный mismatch при каждой гидрации.

### Что спросят дальше
- Что React делает автоматически при несовпадении разметки сервера и первого клиентского рендера, если `suppressHydrationWarning` не стоит?
- Как `<Suspense>` помогает показать осмысленный fallback, пока клиентское значение ещё не готово?

### Ссылки
- [Hydration Mismatch — react.dev](https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content)
- [use — react.dev](https://react.dev/reference/react/use)

# Как написать `useControllableState<T>` без рассинхронизации controlled/uncontrolled режимов?
@slug use-controllable-state
@topic hooks
@verified react@19.3
@updated 2026-11

> Компонент должен уметь работать и как **controlled** (родитель передаёт `value` и `onChange`, сам хранит состояние), и как **uncontrolled** (компонент хранит состояние сам, родитель даёт только `defaultValue`). Хук выбирает источник истины один раз — по тому, передан ли `value` — и дальше либо всегда читает из props, либо всегда из внутреннего state, не смешивая источники между рендерами.

```tsx
function useControllableState<T>({
  value, defaultValue, onChange,
}: { value?: T; defaultValue: T; onChange?: (v: T) => void }) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = isControlled ? value : internal;

  const setValue = useCallback((next: T) => {
    if (!isControlled) setInternal(next);
    onChange?.(next); // вызывается в обоих режимах — родитель узнаёт об изменении всегда
  }, [isControlled, onChange]);

  return [current, setValue] as const;
}
```

Ключевой инвариант — `isControlled` не должен меняться между рендерами одного и того же экземпляра: если родитель однажды передал `value`, а потом перестал (стал `undefined`), React в dev-режиме предупредит о переключении uncontrolled↔controlled, а поведение компонента станет непредсказуемым. На практике это фиксируют проверкой при монтировании (`useRef` с первым значением `isControlled`) или просто документируют как недопустимое использование API.

### Подводные камни
- Проверять `isControlled` только один раз при монтировании через `useState`, а не вычислять на каждом рендере по актуальному `value` — тогда компонент не заметит, что родитель всё-таки передал `value` позже.
- Не вызывать `onChange` в uncontrolled-режиме — родитель, которому не нужен полный контроль, но нужно знать об изменениях (например, для аналитики), ничего не получит.
- Хранить `internal` state даже в controlled-режиме и пытаться синхронизировать его с `value` через `useEffect` — это создаёт на один рендер расхождение и лишний источник правды.

### Что спросят дальше
- Почему переключение compiled↔uncontrolled в процессе жизни компонента считается антипаттерном в React?
- Как `<input>` сам реализует эту же двойственность (value/defaultValue) на уровне DOM?

### Ссылки
- [Sharing State Between Components — react.dev](https://react.dev/learn/sharing-state-between-components)
- [Controlled and uncontrolled components — react.dev](https://react.dev/learn/forms-controlled-vs-uncontrolled)

# Как написать `DeepReadonly<T>` и `DeepPartial<T>`, не сломав массивы, функции и `Date`?
@slug ts-deep-utility-types
@topic typescript
@verified react@19.3
@updated 2026-11

> Наивная рекурсия по всем полям объекта ломается на не-объектных и специальных типах: `Date` и функции — тоже объекты с точки зрения `typeof`, но превращать их поля в readonly/partial бессмысленно и может сломать их методы; массивы нужно обрабатывать через индексный тип, а не как обычный объект с числовыми ключами.

```ts
type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T // функции не трогаем
  : T extends Date
    ? T // Date не трогаем
    : T extends readonly (infer U)[]
      ? readonly DeepReadonly<U>[] // массив — readonly массив, рекурсия на элемент
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T; // примитивы — как есть

type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends Date
    ? T
    : T extends (infer U)[]
      ? DeepPartial<U>[] // массив остаётся массивом, не становится readonly
      : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;
```

Отличие двух типов не только в `readonly` vs `?`: `DeepReadonly` может оставить массив `readonly` безопасно (чтение не ломается), а `DeepPartial` этого делать не должен — partial-массив с `?` на элементах превратил бы `number[]` в бессмысленный `(number | undefined)[]` там, где ожидался просто более короткий или пустой массив.

### Подводные камни
- Проверять `T extends object` раньше проверки на массив, функцию и `Date` — массивы и функции тоже проходят `extends object`, и рекурсия пойдёт по их внутренним полям (`length`, `call`, и т.д.), а не по смыслу.
- Забыть случай примитива (`string`, `number`, `boolean`) в самом конце условного типа — без него рекурсия не завершится корректно на листьях объекта.
- Использовать такие типы для данных, которые реально мутируются библиотекой (например, Immer-драфты) — `DeepReadonly` там будет противоречить рантайм-поведению.

### Что спросят дальше
- Как `Readonly<T>` и встроенный `Partial<T>` в TypeScript устроены на один уровень вложенности и чем рекурсивная версия сложнее?
- Зачем в условном типе нужен `infer`, и как TypeScript выводит через него тип элемента массива?

### Ссылки
- [Conditional Types — TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [Mapped Types — TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)

# Как описать типом состояние загрузки так, чтобы нельзя было прочитать данные в неверном состоянии?
@slug ts-discriminated-loading-state
@topic typescript
@verified react@19.3
@updated 2026-11

> Вместо трёх независимых булевых флагов (`isLoading`, `isError`, `data`) используют **discriminated union**: одно поле-тег (`status`) определяет, какие остальные поля вообще существуют в этой ветке. TypeScript сужает тип по проверке тега, и доступ к `data` в ветке `loading` становится ошибкой компиляции, а не возможной ошибкой в рантайме.

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

function render<T>(state: RequestState<T>) {
  switch (state.status) {
    case 'idle': return null;
    case 'loading': return <Spinner />;
    case 'success': return <View data={state.data} />; // data существует только здесь
    case 'error': return <ErrorMessage text={state.error} />; // error — только здесь
  }
}
```

Три независимых булевых флага допускают невозможные комбинации — `isLoading: true, isError: true` одновременно, или `data` без явного признака, актуальны ли они ещё после новой загрузки. Discriminated union физически не даёт собрать такую комбинацию: структура типа соответствует структуре реальных состояний приложения один в один.

### Подводные камни
- Добавить необязательные поля `data?` и `error?` сразу во все ветки union вместо того, чтобы класть их только в нужные — тогда union вырождается обратно в «флаги плюс опциональные поля» и перестаёт защищать от неверного чтения.
- Забыть `default`/exhaustiveness check в `switch` — при добавлении нового варианта статуса TypeScript не предупредит, что он не обработан, если явно не включить проверку на `never`.
- Путать discriminated union состояния запроса с конечным автоматом переходов — union описывает **формы данных**, а не то, какие переходы между ними разрешены.

### Что спросят дальше
- Как добавить exhaustiveness check, чтобы TypeScript ловил необработанный новый вариант `status`?
- Чем discriminated union отличается от полноценной конечно-автоматной модели с явными переходами?

### Ссылки
- [Discriminated Unions — TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [Narrowing — TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
