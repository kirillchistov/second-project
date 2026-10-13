# Как фронтенд общается с сервером по HTTP?
@slug fetch-http
@topic fullstack
@verified react@19.3
@updated 2026-10

> Клиент отправляет HTTP-запрос: метод (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), URL, заголовки и иногда тело. Сервер отвечает статусом, заголовками и телом, обычно в JSON. В браузере запрос делают через `fetch`. Он отклоняет промис только при сетевой ошибке, поэтому статусы 4xx и 5xx нужно проверять вручную через `response.ok`.

```ts
async function createTodo(title: string): Promise<Todo> {
  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // 404 и 500 не бросают исключение сами
  return res.json();
}
```

Группы статусов, которые нужно знать наизусть:

- **2xx — успех.** `200 OK`, `201 Created` (ресурс создан), `204 No Content` (тела нет, `res.json()` упадёт).
- **3xx — перенаправление.** `301`/`308` — навсегда, `302`/`307` — временно, `304 Not Modified` — бери из кэша.
- **4xx — ошибка клиента.** `400` — неверный запрос, `401` — не аутентифицирован, `403` — нет прав, `404` — не найдено, `409` — конфликт, `422` — не прошла валидация, `429` — слишком много запросов.
- **5xx — ошибка сервера.** `500`, `502`/`503`/`504` — проблемы шлюза или перегрузка. Такие запросы иногда имеет смысл повторить.

Методы различаются семантикой. `GET` только читает и может кэшироваться. `PUT` целиком заменяет ресурс, `PATCH` меняет его частично. `GET`, `PUT` и `DELETE` идемпотентны: повтор даёт тот же результат. `POST` не идемпотентен, повтор может создать дубликат.

В React запросы почти никогда не пишут «голым» `fetch` в эффекте. Чтение данных берут на себя TanStack Query, загрузчики роутера или Server Components. Изменения идут через мутации или Actions.

### Подводные камни
- `fetch` не бросает исключение на 404 и 500 — без проверки `res.ok` ошибка превращается в «пустые данные».
- `res.json()` на ответе 204 или на HTML-странице ошибки падает с `SyntaxError`, который маскирует настоящую причину.

### Что спросят дальше
- Чем `401` отличается от `403`?
- Как отменить запрос, если компонент размонтировался?

### Ссылки
- [MDN: Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN: HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

# Что такое CORS и почему браузер блокирует запрос?
@slug cors
@topic fullstack
@updated 2026-10

> CORS (Cross-Origin Resource Sharing) — механизм, которым сервер разрешает браузеру отдать ответ скрипту с другого origin. Origin — это схема, домен и порт вместе. По умолчанию действует same-origin policy: запрос с `app.example.com` на `api.example.com` уйдёт, но прочитать ответ скрипт не сможет, пока сервер не ответит заголовком `Access-Control-Allow-Origin`. Это защита пользователя в браузере, а не защита сервера: curl и бэкенд CORS не проверяют.

```http
# «Сложный» запрос (PUT, JSON, свои заголовки) — браузер сначала спрашивает разрешение
OPTIONS /api/todos HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type, authorization

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 600
```

Как это работает:

- **Простые запросы** (`GET` или `POST` с form-типами тела, без своих заголовков) уходят сразу. Браузер лишь проверяет заголовок в ответе.
- **Остальные** сначала проходят **preflight**: запрос `OPTIONS`, в котором браузер спрашивает разрешение на метод и заголовки. `Access-Control-Max-Age` кэширует этот ответ.
- **Cookies** через origin отправляются только с `credentials: 'include'` на клиенте и с `Access-Control-Allow-Credentials: true` на сервере. В этом случае `Access-Control-Allow-Origin: *` запрещён, нужен конкретный origin.

Как чинить ошибку CORS:
1. Настроить разрешённые origin на сервере списком, а не отражать любой `Origin`.
2. В разработке проксировать запросы через dev-сервер (`server.proxy` в Vite): тогда origin один и CORS не нужен.
3. В продакшене часто ставят фронтенд и API за один домен (`/api` через reverse proxy или BFF).

### Подводные камни
- «Отключить CORS» на клиенте нельзя: `mode: 'no-cors'` даёт непрозрачный ответ, который скрипт не может прочитать.
- Ошибка CORS в консоли часто скрывает настоящую причину: сервер упал с 500 и не добавил заголовки.

### Что спросят дальше
- Почему CORS не защищает от CSRF?
- Какие запросы считаются «простыми» и не вызывают preflight?

### Ссылки
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Vite: server.proxy](https://vite.dev/config/server-options#server-proxy)

# Где хранить данные в браузере: cookies, localStorage, sessionStorage, IndexedDB?
@slug web-storage
@topic fullstack
@updated 2026-10

> Cookies автоматически уходят на сервер с каждым запросом к своему домену, поэтому подходят для сессии, особенно с флагами `HttpOnly`, `Secure` и `SameSite`. `localStorage` хранит строки бессрочно и синхронно, `sessionStorage` — до закрытия вкладки. Ни тот, ни другой не уходят на сервер, и оба доступны любому скрипту на странице. IndexedDB — асинхронная база для больших объёмов и офлайн-данных.

| | Отправляется на сервер | Доступ из JS | Объём | Время жизни |
|---|---|---|---|---|
| Cookie | да, с каждым запросом | нет, если `HttpOnly` | ~4 КБ | до `Expires`/`Max-Age` |
| localStorage | нет | да, синхронно | ~5 МБ | бессрочно |
| sessionStorage | нет | да, синхронно | ~5 МБ | пока открыта вкладка |
| IndexedDB | нет | да, асинхронно | сотни МБ и больше | бессрочно (может быть вытеснено) |

```tsx
// Синхронизация состояния с localStorage — с защитой от SSR и битых данных
function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}
```

Правила выбора:

- **Токены и сессии** — в `HttpOnly` cookie: при XSS их нельзя прочитать из скрипта.
- **Настройки UI** (тема, свёрнутая панель) — в `localStorage`.
- **Черновик формы на одну вкладку** — в `sessionStorage`.
- **Офлайн-кэш и большие данные** — в IndexedDB через обёртку (`idb`, Dexie) или через persist у TanStack Query.

### Подводные камни
- На сервере (SSR) `localStorage` нет: обращение во время рендера ломает SSR и даёт ошибки гидрации.
- `localStorage` хранит только строки: `setItem('n', 1)` вернёт `'1'`, объект без `JSON.stringify` превратится в `'[object Object]'`.

### Что спросят дальше
- Что означают значения `SameSite`: `Strict`, `Lax`, `None`?
- Как синхронизировать состояние между вкладками (событие `storage`, `BroadcastChannel`)?

### Ссылки
- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)

# Как работают промисы и async/await и в каком порядке выполняется код?
@slug promises-async-await
@topic basics
@updated 2026-10

> Промис — объект-обещание результата асинхронной операции: `pending`, затем `fulfilled` или `rejected`. `async`-функция всегда возвращает промис, а `await` приостанавливает её до его завершения, не блокируя поток. Порядок выполнения задаёт event loop: сначала весь синхронный код, затем **все микрозадачи** (колбэки промисов, `queueMicrotask`), и только потом **одна макрозадача** (`setTimeout`, события, сетевые колбэки).

```ts
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
(async () => {
  console.log('4');           // тело async-функции до первого await — синхронно
  await null;
  console.log('5');           // продолжение — микрозадача
})();
console.log('6');
// 1 4 6 3 5 2
```

Что важно уметь:

- **Параллельно, а не по очереди.** Два независимых `await` подряд дают водопад. `await Promise.all([a(), b()])` запускает оба запроса сразу.
- **Комбинаторы.** `Promise.all` падает на первой ошибке. `Promise.allSettled` ждёт все результаты. `Promise.race` берёт первый завершившийся, `Promise.any` — первый успешный.
- **Ошибки.** `try/catch` вокруг `await` или `.catch()` на цепочке. Необработанный rejected-промис даёт `unhandledrejection`.
- **Отмена.** Промис нельзя отменить сам по себе: отменяют операцию через `AbortController` и передают `signal`.

```ts
// Плохо: 2 запроса последовательно
const user = await getUser(id);
const posts = await getPosts(id);

// Хорошо: параллельно
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);
```

### Подводные камни
- `array.forEach(async (x) => await save(x))` не ждёт завершения: используйте `for...of` или `Promise.all(array.map(...))`.
- Забытый `await` возвращает промис вместо значения: условие `if (await isAdmin())` без `await` всегда истинно.

### Что спросят дальше
- Почему колбэк `setTimeout(fn, 0)` выполняется позже `Promise.then`?
- Как ограничить число одновременных запросов?

### Ссылки
- [MDN: Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [MDN: The event loop](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop)

# Как сделать форму доступной?
@slug accessible-forms
@topic quality
@updated 2026-10

> У каждого поля должна быть связанная подпись: `<label htmlFor>` или поле внутри `<label>`, а не только placeholder. Ошибки нужно связать с полем через `aria-describedby` и пометить поле `aria-invalid`. После неудачной отправки фокус переводится на первое поле с ошибкой. Форма должна работать с клавиатуры, а отправка — идти через `<button type="submit">` внутри `<form>`, тогда сработает Enter.

```tsx
function EmailField({ error }: { error?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>Email</label>
      <input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`}>{error}</p>}
    </div>
  );
}
```

Чек-лист:

- **Подписи.** Placeholder исчезает при вводе и плохо читается — это не подпись. `useId` даёт стабильные id, в том числе при SSR.
- **Правильные типы и `autoComplete`.** `type="email"`, `inputMode="numeric"`, `autoComplete="one-time-code"` упрощают ввод на телефоне и работу менеджеров паролей.
- **Группы.** Радиокнопки и связанные чекбоксы — в `<fieldset>` с `<legend>`.
- **Ошибки.** Текст ошибки рядом с полем, а не только красная рамка: цвет не должен быть единственным признаком. Сводку ошибок можно объявить через `role="alert"`.
- **Обязательные поля.** Атрибут `required` (или `aria-required`), а не только звёздочка.
- **Кнопки.** Настоящий `<button>`, а не `div` с `onClick`: у кнопки есть фокус, Enter и Space и роль для скринридера.

### Подводные камни
- `disabled` у кнопки отправки до заполнения формы скрывает причину: пользователь не понимает, что не так. Лучше дать отправить и показать ошибки.
- Сгенерированные вручную id вроде `Math.random()` расходятся между сервером и клиентом. Используйте `useId`.

### Что спросят дальше
- Как проверить форму скринридером (VoiceOver, NVDA)?
- Когда нужен `aria-live` и чем `polite` отличается от `assertive`?

### Ссылки
- [WAI: Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/)
- [React: useId](https://react.dev/reference/react/useId)

# Как устроены npm-пакеты, semver и lock-файл?
@slug package-management
@topic ecosystem
@updated 2026-10

> Зависимости описаны в `package.json`. `dependencies` нужны в рантайме, `devDependencies` — только для разработки и сборки. Версии записываются по semver `MAJOR.MINOR.PATCH`: `^1.4.2` разрешает любую `1.x.x` не ниже `1.4.2`, `~1.4.2` — только `1.4.x`. Lock-файл (`package-lock.json`, `pnpm-lock.yaml`) фиксирует точные версии всего дерева, чтобы у всех и в CI ставилось одно и то же.

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "zod": "~4.1.0"
  },
  "devDependencies": {
    "vite": "^8.0.0",
    "typescript": "^5.9.0"
  },
  "overrides": {
    "some-lib": { "react": "$react" }
  }
}
```

Что важно знать:

- **Semver — это договорённость, а не гарантия.** MINOR и PATCH не должны ломать API, но иногда ломают. Защищает lock-файл и тесты.
- **`npm install` против `npm ci`.** Первый может обновить lock-файл в пределах диапазонов. Второй ставит строго по lock-файлу и падает при расхождении — его используют в CI.
- **Lock-файл коммитят** в приложениях. Без него «у меня работает» превращается в разные версии у разных людей.
- **`peerDependencies`** — «мне нужна версия React, которую поставишь ты». Так библиотеки не тащат свою копию React.
- **`overrides`/`resolutions`** принудительно меняют версию транзитивной зависимости, например для патча уязвимости.
- **Безопасность.** `npm audit` и Dependabot или Renovate для обновлений. Скрипты `postinstall` в чужих пакетах — частый вектор атаки на цепочку поставок.

### Подводные камни
- Две копии React в бандле (из-за разных версий) ломают хуки ошибкой «Invalid hook call».
- Ручная правка lock-файла или его удаление «чтобы починить» меняет версии десятков пакетов разом.

### Что спросят дальше
- Чем npm, pnpm и Yarn отличаются в устройстве `node_modules`?
- Как безопасно обновить мажорную версию библиотеки?

### Ссылки
- [npm: package.json](https://docs.npmjs.com/cli/configuring-npm/package-json)
- [Semantic Versioning](https://semver.org/)
