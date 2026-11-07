# Чем `structuredClone`, spread-оператор и `JSON.parse(JSON.stringify())` отличаются для копирования данных?
@slug structured-clone-vs-spread
@topic basics
@verified react@19.3
@updated 2026-11

> Spread (`{ ...obj }`, `[...arr]`) копирует только один уровень — вложенные объекты остаются общими ссылками. `JSON.parse(JSON.stringify(x))` копирует глубоко, но теряет `undefined`, функции, `Date` (превращается в строку), `Map`/`Set`, и падает на циклических ссылках. `structuredClone(x)` — встроенный глубокий клон, который правильно копирует `Date`, `Map`, `Set`, `ArrayBuffer` и умеет циклические ссылки, но тоже не клонирует функции и DOM-узлы.

```tsx
const original = { date: new Date(), tags: new Set(['a']), nested: { count: 1 } };

const shallow = { ...original };
shallow.nested.count = 2; // испортит original.nested — общая ссылка

const viaJson = JSON.parse(JSON.stringify(original));
// viaJson.date — строка, viaJson.tags — {} (пустой объект, не Set)

const deep = structuredClone(original);
// deep.date instanceof Date === true, deep.tags instanceof Set === true
```

Для чистого иммутабельного обновления одного поля вложенного state в React лучшим выбором обычно остаётся точечный spread на каждом уровне (`{ ...state, nested: { ...state.nested, count: 2 } }`) или Immer — клонировать весь объект целиком ради одного поля избыточно. `structuredClone` пригождается, когда нужна настоящая независимая копия: снимок для отмены действия, передача данных в Web Worker (он тоже использует structured clone algorithm) или сохранение состояния до рискованной мутации стороннего кода.

### Подводные камни
- Использовать `JSON.parse(JSON.stringify())` для данных с `Date`, `Map`, `Set` или `undefined`-полями — они либо теряются, либо меняют тип.
- Думать, что spread делает глубокую копию — он копирует только верхний уровень, вложенные объекты остаются общими.
- Пытаться клонировать функции или DOM-узлы через `structuredClone` — он выбросит `DataCloneError`.

### Что спросят дальше
- Почему Web Worker использует именно structured clone algorithm для передачи сообщений?
- Как Immer позволяет писать «мутирующий» код, но получать иммутабельный результат?

### Ссылки
- [structuredClone() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone)
- [The structured clone algorithm — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)

# Почему `unknown` безопаснее, чем `any`, при работе с данными из внешнего источника?
@slug ts-unknown-vs-any
@topic typescript
@verified react@19.3
@updated 2026-11

> `any` отключает проверку типов полностью: TypeScript разрешит любое свойство, вызов или присваивание, даже если они обязательно упадут в рантайме. `unknown` тоже принимает любое значение, но не даёт им пользоваться без предварительной проверки (type guard или сужение типа) — компилятор заставляет сначала доказать, что значение действительно того типа, с которым вы работаете.

```ts
function parseConfig(json: string): unknown {
  return JSON.parse(json); // мы ещё не знаем реальную форму данных
}

interface ApiError { code: string; message: string }
function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value;
}

try {
  const data = parseConfig(raw);
  // data.code — ошибка компиляции: нельзя читать свойство unknown без проверки
  if (isApiError(data)) {
    console.error(data.code, data.message); // здесь уже безопасно: тип сужен до ApiError
  }
} catch (error) {
  if (isApiError(error)) handleApiError(error);
  else throw error; // неизвестная форма ошибки — не глотаем молча
}
```

Типизированный `catch` в TypeScript по умолчанию даёт `unknown` для пойманной ошибки (начиная с `useUnknownInCatchVariables`) — именно поэтому `error.message` без проверки не компилируется, и это осознанное ограничение: JavaScript позволяет бросить что угодно, не только `Error`.

### Подводные камни
- Использовать `any` как «временное решение», которое остаётся в коде надолго и отключает проверки для всего, что к нему прикасается.
- Писать `value as ApiError` вместо `isApiError(value)` — `as` ничего не проверяет в рантайме, просто обманывает компилятор.
- Забыть обработать случай, когда `unknown`-значение не прошло ни один type guard — тогда его стоит явно перебросить, а не проигнорировать.

### Что спросят дальше
- Чем `as` отличается от настоящей проверки типа в рантайме — когда он безопасен?
- Как Zod или другая библиотека валидации рантайма сочетается с `unknown`?

### Ссылки
- [unknown — TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown)
- [useUnknownInCatchVariables — TypeScript Handbook Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html#use-unknown-catch-variables)

# Как сверстать адаптивную сетку карточек без JavaScript?
@slug css-grid-container-queries
@topic ecosystem
@verified react@19.3
@updated 2026-11

> `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))` сам считает, сколько карточек шириной от 240px помещается в ряд, и тянет их на всю доступную ширину — без медиазапросов и JS-измерений контейнера. `auto-fill` оставляет пустые колонки-заглушки, если карточек мало; `auto-fit` схлопывает их, и карточки растягиваются шире.

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
```

Container queries (`@container`) решают другую задачу: адаптация стилей самой карточки зависит не от ширины экрана, а от ширины её родительского контейнера — то есть одна и та же карточка выглядит по-разному в узком сайдбаре и в широкой основной колонке, без привязки к брейкпоинтам всей страницы.

```css
.card-wrapper { container-type: inline-size; }

@container (min-width: 320px) {
  .card { grid-template-columns: 100px 1fr; } /* шире — картинка и текст в ряд */
}
```

### Подводные камни
- Путать `auto-fill` и `auto-fit` — с малым числом карточек они выглядят по-разному: `auto-fill` оставляет пустое место, `auto-fit` растягивает карточки на всю ширину.
- Забыть `container-type: inline-size` на родителе — без него `@container` просто не сработает.
- Использовать только `grid-template-columns: repeat(N, 1fr)` с фиксированным N — тогда карточки не адаптируются к ширине сами, нужен явный медиазапрос под каждый брейкпоинт.

### Что спросят дальше
- Чем container queries отличаются от обычных media queries по смыслу использования?
- Как `minmax()` взаимодействует с `gap` при расчёте числа колонок?

### Ссылки
- [CSS Grid Layout — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
- [CSS Container Queries — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
