# Какие утилитарные типы TypeScript нужны в React-коде?
@slug typescript-utility-types
@topic typescript
@updated 2026-10

> Утилитарные типы строят новые типы из существующих, а не дублируют их. Самые частые — `Partial`, `Required`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited` и `NonNullable`. Для React добавляются `ComponentProps<typeof X>` и `ComponentPropsWithoutRef<'button'>`: тип props берётся у чужого компонента или HTML-элемента, а не переписывается вручную.

```tsx
type User = { id: string; name: string; email: string; role: 'admin' | 'user' };

type UserPatch = Partial<Omit<User, 'id'>>;          // для PATCH: всё необязательно, id менять нельзя
type UserPreview = Pick<User, 'id' | 'name'>;
type UsersById = Record<User['id'], User>;
type Role = User['role'];                            // indexed access: 'admin' | 'user'

// Свой компонент поверх нативной кнопки: принимает все её атрибуты
type ButtonProps = ComponentPropsWithoutRef<'button'> & { variant?: 'primary' | 'ghost' };

// Тип из функции, а не наоборот
async function fetchUser(id: string) { /* ... */ return {} as User; }
type FetchedUser = Awaited<ReturnType<typeof fetchUser>>;   // User

// Props чужого компонента, который не экспортирует свой тип
type SelectProps = ComponentProps<typeof Select>;
```

Когда что применять:

- **`Partial` / `Required`** — формы редактирования, опции со значениями по умолчанию.
- **`Pick` / `Omit`** — превью, DTO и обёртки, которые «съедают» часть props (`Omit<InputProps, 'onChange'>`).
- **`Record<K, V>`** — словари и мапы конфигурации. С ключом-объединением компилятор проверит, что ни один вариант не забыт.
- **`typeof` + `ReturnType` / `Parameters` / `Awaited`** — тип выводится из кода, единственного источника истины.
- **`Extract` / `Exclude`** — выбор вариантов из объединения: `Extract<Action, { type: 'add' }>`.

### Подводные камни
- `Omit` на объединении типов «схлопывает» его: `Omit<A | B, 'x'>` теряет различия вариантов. Нужен распределяющий вариант через условный тип.
- `Partial` неглубокий: вложенные объекты остаются обязательными.

### Что спросят дальше
- Как написать свой `DeepPartial` через mapped и conditional types?
- Чем `ComponentProps` отличается от `ComponentPropsWithRef`?

### Ссылки
- [TypeScript: Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

# Зачем нужны satisfies и as const?
@slug satisfies-and-const
@topic typescript
@updated 2026-10

> `as const` делает значение максимально узким и `readonly`: `'primary'` вместо `string`, кортеж вместо массива. `satisfies T` проверяет, что значение подходит под тип `T`, но сохраняет его точный выведенный тип. Аннотация `: T` проверяет так же, но расширяет значение до `T` и теряет детали. Вместе они дают конфиги, которые и проверены, и точно типизированы.

```ts
type Route = { path: string; auth?: boolean };

// Аннотация: проверено, но ключи стали string — опечатку в ROUTES.profle не поймать
const ROUTES_A: Record<string, Route> = { home: { path: '/' }, profile: { path: '/me', auth: true } };

// satisfies: проверено и ключи сохранены — ROUTES.profle будет ошибкой
const ROUTES = {
  home: { path: '/' },
  profile: { path: '/me', auth: true },
} satisfies Record<string, Route>;

// as const: литеральные типы и readonly — удобно выводить объединения из данных
const SIZES = ['sm', 'md', 'lg'] as const;
type Size = (typeof SIZES)[number];   // 'sm' | 'md' | 'lg'

// Вместе: точные литералы + проверка формы
const theme = { primary: '#0a7', radius: 8 } as const satisfies Record<string, string | number>;
```

Где это нужно в React-коде:

- **Кортежи из хуков.** `return [value, setValue] as const` — иначе тип станет массивом объединения, а не парой.
- **Списки вариантов.** Массив `as const` и тип из него: один источник для UI (рендер опций) и для типов.
- **Конфиги, роуты, ключи запросов** TanStack Query (`['users', id] as const`).
- **Карты компонентов:** `satisfies Record<Variant, ComponentType>` гарантирует, что ни один вариант не забыт.

### Подводные камни
- `as Type` (утверждение типа) — не то же самое: оно отключает проверку. `{} as User` скомпилируется, `{} satisfies User` — нет.
- `as const` делает массив `readonly`, и его нельзя передать в функцию, ожидающую изменяемый `string[]`.

### Что спросят дальше
- Чем `satisfies` отличается от `as` и от аннотации?
- Что такое `const` type parameters (`function f<const T>(x: T)`)?

### Ссылки
- [TypeScript 4.9: The satisfies Operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)
- [TypeScript: const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html)

# Зачем валидировать данные в рантайме, если есть TypeScript?
@slug runtime-validation-zod
@topic typescript
@updated 2026-10

> Типы TypeScript стираются при компиляции и ничего не проверяют в рантайме. Ответ API, `localStorage`, параметры URL, переменные окружения и данные формы приходят как `unknown`. `as User` просто верит им на слово. Схема (Zod, Valibot, ArkType) проверяет данные на границе системы и выводит из себя статический тип, поэтому тип и проверка не расходятся.

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.email(),
  createdAt: z.coerce.date(),          // строка из JSON → Date
  role: z.enum(['admin', 'user']).default('user'),
});
type User = z.infer<typeof UserSchema>; // тип из схемы — один источник истины

async function getUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return UserSchema.parse(await res.json()); // бросит ZodError с путём к полю
}

// Без исключений: для форм и мягкой обработки
const result = UserSchema.safeParse(input);
if (!result.success) console.log(z.flattenError(result.error).fieldErrors);
```

Где валидировать:

- **Входящие данные сервера** — тела запросов, параметры, Server Functions. Это защита, а не удобство: клиент может прислать что угодно.
- **Ответы чужих API** на клиенте — чтобы поломка контракта падала понятной ошибкой у границы, а не `undefined is not a function` в глубине UI.
- **Формы** — одна схема для клиента (через `zodResolver` в React Hook Form) и для сервера.
- **Переменные окружения** при старте приложения: пропущенный ключ — ошибка запуска, а не баг в продакшене.

### Подводные камни
- `JSON.parse(x) as Config` — тот же `any` в другой обёртке: TypeScript перестаёт защищать.
- Валидация только на клиенте ничего не защищает: проверки сервера обязательны.

### Что спросят дальше
- Как поделиться схемами между фронтендом и бэкендом в монорепо?
- Чем `parse` отличается от `safeParse` и что выбрать для формы?

### Ссылки
- [Zod](https://zod.dev/)
- [TypeScript: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)

# Как тестировать собственные хуки?
@slug testing-hooks
@topic testing
@updated 2026-10

> Хук, который используется в одном компоненте, тестируют через этот компонент — так тест ближе к поведению. Переиспользуемый хук тестируют отдельно через `renderHook` из Testing Library. Он рендерит хук в тестовом компоненте и отдаёт `result.current`. Изменения состояния оборачивают в `act`, асинхронные результаты ждут через `waitFor`. Контексты передают опцией `wrapper`.

```tsx
import { renderHook, act, waitFor } from '@testing-library/react';

test('useCounter увеличивает и сбрасывает значение', () => {
  const { result } = renderHook(() => useCounter(5));
  act(() => result.current.increment());
  expect(result.current.count).toBe(6);
  act(() => result.current.reset());
  expect(result.current.count).toBe(5);
});

test('useUser загружает пользователя', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender } = renderHook(({ id }) => useUser(id), { wrapper, initialProps: { id: '1' } });
  await waitFor(() => expect(result.current.data?.name).toBe('Ada'));   // ответ от MSW
  rerender({ id: '2' });                                                 // смена аргумента
});
```

Что проверять:

- **Контракт хука**: что возвращается при разных аргументах и после вызова его функций.
- **Смену аргументов** через `rerender` с новыми `initialProps`: хук не должен показывать данные старого id.
- **Очистку**: после `unmount()` таймеры и подписки сняты, а `setState` после размонтирования не вызывается.
- **Время**: таймеры через `vi.useFakeTimers()` и `act(() => vi.advanceTimersByTime(300))` — для debounce и интервалов.

### Подводные камни
- Деструктуризация `const { count } = result.current` фиксирует старое значение. Читайте `result.current` после каждого `act`.
- `retry` в TanStack Query по умолчанию повторяет ошибки, поэтому тест ошибки висит до таймаута. В тестовом клиенте отключайте повторы.

### Что спросят дальше
- Когда тестировать хук отдельно, а когда через компонент?
- Как тестировать хук, который подписывается на `window` или `matchMedia`?

### Ссылки
- [Testing Library: renderHook](https://testing-library.com/docs/react-testing-library/api#renderhook)
- [Vitest: Fake Timers](https://vitest.dev/guide/mocking/timers)

# Что и как мокать в тестах фронтенда?
@slug mocking-boundaries
@topic testing
@updated 2026-10

> Мокать нужно границы системы, а не собственный код: сеть, время, случайность, браузерные API, которых нет в jsdom. Сеть лучше перехватывать на уровне HTTP через MSW. Тогда настоящие `fetch`, TanStack Query и обработка ошибок работают как в продакшене. `vi.mock` модуля — крайняя мера. Он привязывает тест к структуре импортов и легко проверяет «вызвался ли мок» вместо поведения.

```ts
// Сеть — через MSW: общий набор обработчиков, переопределение в конкретном тесте
const server = setupServer(
  http.get('/api/todos', () => HttpResponse.json([{ id: '1', title: 'Купить молоко' }])),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('показывает ошибку загрузки', async () => {
  server.use(http.get('/api/todos', () => new HttpResponse(null, { status: 500 })));
  render(<TodoList />, { wrapper: Providers });
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить');
});

// Время — фейковые таймеры, а не мок setTimeout руками
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-01-01'));
```

Лестница вариантов, от лучшего к худшему:

1. **Ничего не мокать**: чистые функции и компоненты без внешних зависимостей.
2. **Внедрение зависимостей**: передать `now`, `random`, `storage` или клиент API параметром или через контекст. В тесте подставить реализацию без магии.
3. **Перехват на границе**: MSW для HTTP, фейковые таймеры для времени, `vi.stubGlobal` для `matchMedia` и `IntersectionObserver`.
4. **`vi.mock` модуля**: для тяжёлых сторонних SDK (аналитика, карты), которые нельзя запустить в тесте.

### Подводные камни
- Тест, который проверяет только `expect(api.get).toHaveBeenCalledWith(...)`, проходит даже при сломанном UI.
- Моки, не сброшенные между тестами (`restoreMocks`, `resetHandlers`), делают тесты зависимыми от порядка запуска.

### Что спросят дальше
- Как переиспользовать одни и те же MSW-обработчики в тестах, Storybook и при локальной разработке?
- Чем `vi.fn`, `vi.spyOn` и `vi.mock` отличаются по назначению?

### Ссылки
- [MSW: Philosophy](https://mswjs.io/docs/philosophy)
- [Vitest: Mocking](https://vitest.dev/guide/mocking)

# Как писать e2e-тесты на Playwright, чтобы они не ломались?
@slug e2e-playwright
@topic testing
@updated 2026-10

> E2E-тест проверяет пользовательский сценарий в настоящем браузере: вход, оформление заказа, оплата. Таких тестов немного — только на критичные пути. Устойчивость дают три вещи: локаторы по роли и тексту (`getByRole`), web-first проверки с автоожиданием (`await expect(locator).toBeVisible()`) и изоляция данных. Каждый тест создаёт свои данные или использует подготовленное состояние, а не зависит от соседних тестов.

```ts
import { test, expect } from '@playwright/test';

test('пользователь добавляет товар в корзину', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('searchbox', { name: 'Поиск' }).fill('клавиатура');
  await page.getByRole('link', { name: /Клавиатура K2/ }).click();
  await page.getByRole('button', { name: 'В корзину' }).click();

  // Автоожидание: проверка повторяется, пока не выполнится или не истечёт таймаут
  await expect(page.getByRole('status')).toHaveText('Товар добавлен');
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
```

Приёмы для стабильности:

- **Аутентификация один раз.** Setup-проект логинится и сохраняет `storageState`, остальные тесты стартуют уже залогиненными.
- **Данные через API, а не через UI.** Создать товар запросом (`request.post`) быстрее и надёжнее, чем кликами.
- **Никаких `waitForTimeout(2000)`.** Ждать нужно состояния: текста, URL (`toHaveURL`) или ответа (`page.waitForResponse`).
- **Сеть под контролем.** `page.route` подменяет нестабильные внешние сервисы.
- **Отладка падений в CI.** Trace viewer (`trace: 'on-first-retry'`) показывает DOM, сеть и консоль на каждом шаге.

### Подводные камни
- Селекторы по CSS-классам и структуре DOM ломаются при любом рефакторинге вёрстки.
- `expect(await locator.isVisible()).toBe(true)` проверяет один раз без ожидания — это частая причина флаки-тестов.

### Что спросят дальше
- Как распределить проверки между unit-, интеграционными и e2e-тестами?
- Как запускать e2e против preview-деплоя в CI?

### Ссылки
- [Playwright: Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright: Authentication](https://playwright.dev/docs/auth)

# Как спроектировать REST API?
@slug rest-api-design
@topic fullstack
@updated 2026-10

> REST API строится вокруг ресурсов: URL — это существительные во множественном числе (`/orders/42/items`), действие задаёт HTTP-метод, результат — статус-код. Хороший API предсказуем: единый формат ошибок, пагинация, фильтрация через query-параметры, версионирование и идемпотентность там, где запрос могут повторить. Контракт описывают в OpenAPI и генерируют из него типы для клиента.

```http
GET    /api/v1/orders?status=paid&limit=20&cursor=eyJpZCI6NDJ9   → 200 { items, nextCursor }
POST   /api/v1/orders                                             → 201 + Location: /api/v1/orders/43
PATCH  /api/v1/orders/43        { "status": "cancelled" }         → 200 | 409 (уже отправлен)
DELETE /api/v1/orders/43                                          → 204

# Единый формат ошибки (RFC 9457 Problem Details)
422 { "type": "/errors/validation", "title": "Validation failed",
      "errors": [{ "field": "email", "message": "Неверный формат" }] }
```

Решения, о которых спрашивают:

- **Пагинация.** Offset (`?page=3`) прост, но на больших таблицах медленный и «прыгает» при вставках. Cursor (`?cursor=…`) стабилен и подходит для бесконечных лент.
- **Ошибки.** `400`/`422` для валидации с указанием полей, `401` против `403`, `404`, `409` для конфликтов состояния. Тело — в одном формате по всему API.
- **Частичные ответы.** Поле `fields` или отдельные эндпоинты под экраны, если клиенту нужно мало данных.
- **Версионирование.** `/v1` в пути или заголовком. Добавлять поля можно без новой версии, удалять или переименовывать — нельзя.
- **Конкурентные изменения.** `ETag` + `If-Match` — оптимистическая блокировка: `412`, если ресурс уже изменили.
- **Действия, не укладывающиеся в CRUD** — подресурсом: `POST /orders/43/cancel`.

### Подводные камни
- Глаголы в URL (`/getOrders`, `/createOrder`) дублируют метод и ломают единообразие.
- `200 OK` с `{ "error": "..." }` в теле: кэши, мониторинг и клиентские библиотеки считают ошибку успехом.

### Что спросят дальше
- Чем cursor-пагинация лучше offset и как она устроена?
- Когда REST неудобен и стоит взять GraphQL или tRPC?

### Ссылки
- [MDN: HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)
- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)

# Как работает вход через OAuth 2.0 и OpenID Connect?
@slug oauth-oidc
@topic fullstack
@updated 2026-10

> OAuth 2.0 — протокол **делегирования доступа**: приложение получает токен на действия от имени пользователя, не узнавая его пароль. OpenID Connect поверх него добавляет **аутентификацию**: `id_token` (JWT) с данными о том, кто вошёл. Для веб-приложений и SPA стандарт — Authorization Code Flow с PKCE. Implicit flow устарел.

```text
1. Клиент генерирует code_verifier и code_challenge = SHA256(code_verifier), а также state
2. Редирект → https://auth.example.com/authorize?response_type=code&client_id=…
     &redirect_uri=…&scope=openid profile email&state=…&code_challenge=…&code_challenge_method=S256
3. Пользователь входит у провайдера → редирект на redirect_uri?code=…&state=…
4. Клиент проверяет state (защита от CSRF) и меняет code на токены:
     POST /token { code, code_verifier, redirect_uri, client_id }
5. Ответ: access_token (доступ к API), id_token (кто вошёл), refresh_token (обновление)
```

Что нужно понимать:

- **Зачем PKCE.** Перехваченный `code` бесполезен без `code_verifier`, который не покидал клиент. Это защищает публичных клиентов (SPA, мобильные), у которых нет секрета.
- **Где обменивать code.** Надёжнее всего на своём сервере (BFF). Токены остаются на сервере, браузер получает только `HttpOnly` cookie сессии. Токены в `localStorage` уязвимы при XSS.
- **Токены разные по назначению.** `id_token` — для клиента, чтобы узнать пользователя. Его не отправляют в API. `access_token` — для API. API проверяет подпись, `aud`, `iss` и `exp`.
- **Scopes** — запрашиваемые права (`openid`, `email`, `read:orders`). Запрашивают минимально необходимые.
- **Выход** — удалить свою сессию и при необходимости завершить сессию у провайдера (RP-initiated logout).

### Подводные камни
- Без проверки `state` атакующий может «подсунуть» свой `code` и залогинить жертву в чужой аккаунт.
- Использовать `access_token` как доказательство личности для своего бэкенда без проверки `aud` — токен от другого приложения тоже пройдёт.

### Что спросят дальше
- Чем аутентификация отличается от авторизации?
- Как организовать обновление access-токена, если несколько запросов одновременно получили 401?

### Ссылки
- [OAuth 2.0 for Browser-Based Apps](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)

# Как работает HTTP-кэширование: Cache-Control, ETag, CDN?
@slug http-caching
@topic fullstack
@updated 2026-10

> Кэшированием управляет заголовок `Cache-Control` в ответе. `max-age` — сколько секунд ответ свеж для браузера, `s-maxage` — для общих кэшей (CDN). `no-cache` — можно хранить, но перед использованием нужно спросить сервер. `no-store` — не хранить вовсе. Когда свежесть истекла, браузер делает условный запрос с `If-None-Match` (по `ETag`) и получает короткий `304 Not Modified`, если ничего не изменилось.

```http
# Ассеты с хэшем в имени (app.3f9a1c.js): кэшировать «навсегда»
Cache-Control: public, max-age=31536000, immutable

# HTML: всегда сверяться, чтобы после деплоя подтянулись новые ассеты
Cache-Control: no-cache
ETag: "v42-a1b2"

# API для каталога: CDN держит минуту, потом отдаёт старое и обновляет в фоне
Cache-Control: public, s-maxage=60, stale-while-revalidate=300

# Личные данные: только в браузере пользователя, не в CDN
Cache-Control: private, max-age=0, must-revalidate
```

Стратегия для SPA:

1. **Хэш в имени файла** (Vite делает его по умолчанию) + `immutable`. Новая версия получает новое имя, старая не мешает.
2. **`index.html` без долгого кэша.** Иначе пользователь застрянет на старом HTML, который ссылается на удалённые ассеты.
3. **`stale-while-revalidate`** — мгновенный ответ из кэша и обновление в фоне. Ту же идею использует TanStack Query на клиенте.
4. **`Vary`** — по каким заголовкам различать варианты (`Accept-Encoding`, `Accept-Language`). Без него CDN может отдать ответ одного пользователя другому.
5. **Инвалидация CDN** — по тегам или путям при деплое и изменении данных.

### Подводные камни
- `no-cache` не значит «не кэшировать» — это `no-store`.
- Ответ с персональными данными без `private` может закэшироваться на CDN и показаться другим пользователям.

### Что спросят дальше
- Как кэш браузера сочетается с кэшем TanStack Query и Service Worker?
- Чем `ETag` отличается от `Last-Modified`?

### Ссылки
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [web.dev: Love your cache](https://web.dev/articles/love-your-cache)

# Как сделать интернационализацию (i18n) React-приложения?
@slug i18n
@topic ecosystem
@updated 2026-10

> Тексты выносят из кода в словари по ключам и подключают библиотекой: `react-i18next`, FormatJS (`react-intl`), Lingui. Плюрализацию, даты, числа и валюты не собирают конкатенацией строк. Для них есть ICU-сообщения и встроенный `Intl` (`Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.PluralRules`). Язык определяют по URL или настройке пользователя, а словари грузят лениво по языку.

```tsx
// ru.json: { "cart.items": "{count, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}" }
function CartSummary({ count, total }: { count: number; total: number }) {
  const { t, i18n } = useTranslation();
  const price = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'RUB' }).format(total);
  return <p>{t('cart.items', { count })} на {price}</p>;
}
// count = 3 → «3 товара на 1 234,50 ₽»
```

Решения, которые принимают в проекте:

- **Ключи или исходный текст.** Ключи (`cart.items`) стабильны. Исходный текст как ключ (Lingui, `msgid`) удобнее переводчикам и не даёт забыть строку.
- **Где хранится язык.** В URL (`/en/catalog`) — хорошо для SEO и шаринга ссылок. В cookie или профиле — для приложений за логином.
- **Загрузка словарей.** По языку и по разделам (namespaces), чтобы не грузить переводы всего приложения сразу.
- **SSR.** Язык должен совпасть на сервере и клиенте, иначе будет ошибка гидрации. Даты форматируют с явной таймзоной.
- **RTL.** `dir="rtl"` и логические CSS-свойства (`margin-inline-start` вместо `margin-left`).
- **Процесс.** Извлечение ключей, проверка недостающих переводов в CI, платформа для переводчиков.

### Подводные камни
- Склейка `t('hello') + ' ' + name` ломает языки с другим порядком слов. Нужна интерполяция в одном сообщении.
- Русская плюрализация имеет формы `one`, `few`, `many`. Условие «1 или не 1» даёт «5 товара».

### Что спросят дальше
- Как избежать ошибки гидрации при форматировании дат в SSR?
- Как типизировать ключи переводов, чтобы опечатка была ошибкой компиляции?

### Ссылки
- [MDN: Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [react-i18next](https://react.i18next.com/)
