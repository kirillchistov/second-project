# Как поставить таймаут на fetch-запрос?
@slug fetch-timeout
@topic fullstack

> У `fetch` нет параметра `timeout`. Таймаут делают через `AbortController`: запускают `setTimeout`, который вызывает `abort()`, если ответ не пришёл вовремя, и сбрасывают таймер, если ответ пришёл раньше.

```tsx
async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

Начиная с современных браузеров есть готовый хелпер `AbortSignal.timeout(ms)`, который делает то же самое в одну строку: `fetch(url, { signal: AbortSignal.timeout(5000) })`. Он создаёт сигнал, который сам сработает через указанное время — отдельный `setTimeout` и `clearTimeout` не нужны.

Таймаут на клиенте не отменяет работу на сервере: если запрос уже начал тяжёлую операцию (например, запись в базу), она продолжится — клиент просто перестанет ждать ответ. Для действительно безопасной отмены нужна поддержка отмены и на стороне сервера.

### Подводные камни
- Не чистить `setTimeout` после успешного ответа — лишний отложенный вызов `abort()` на уже свободный контроллер (безвреден, но мусорит).
- Путать таймаут клиента с отменой работы на сервере — это разные вещи.

### Что спросят дальше
- Чем `AbortSignal.timeout` отличается от ручной связки `setTimeout` + `AbortController`?
- Как совместить таймаут с ретраями запроса?

### Ссылки
- [AbortSignal.timeout() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)
- [AbortController — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

# Как правильно повторять неудавшийся запрос (retry с backoff)?
@slug fetch-retry-backoff
@topic fullstack

> Повторять стоит не всякую ошибку: сетевой обрыв и 503/429 — кандидаты на ретрай, а 400 или 404 повторять бессмысленно, ответ не изменится. Между попытками выдерживают экспоненциально растущую паузу (backoff) с небольшим случайным разбросом (jitter), чтобы много клиентов не ударили по восстановившемуся серверу одновременно.

```tsx
async function fetchWithRetry(url: string, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return res;
    } catch {
      // сетевая ошибка — пробуем ещё раз
    }
    const delay = 2 ** i * 300 + Math.random() * 200;
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Не удалось получить ответ после нескольких попыток');
}
```

Сервер может прислать заголовок `Retry-After` при 429 или 503 — его стоит уважать вместо собственного расчёта паузы. Ретраи небезопасны для не-идемпотентных запросов (`POST`, который создаёт заказ дважды) без ключа идемпотентности на сервере — повторять без него можно только `GET`, `PUT`, `DELETE` и `POST` с явной защитой от дублей.

### Подводные камни
- Повторять 400/404 — ошибка в запросе, а не временная проблема сети.
- Ретраить `POST` без идемпотентности — повтор может создать дубликат операции.
- Фиксированная пауза без jitter — синхронизированные ретраи многих клиентов создают новый всплеск нагрузки.

### Что спросят дальше
- Что такое идемпотентность запроса и как её обеспечить на сервере?
- Как ограничить общее число попыток и время ожидания?

### Ссылки
- [Retry-After — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
- [Exponential Backoff And Jitter — AWS Architecture Blog](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

# Что передаётся в cookies при fetch-запросе и как это настроить?
@slug fetch-credentials
@topic fullstack

> По умолчанию `fetch` отправляет cookies только для запросов на тот же origin (`credentials: 'same-origin'`). Для кросс-доменных запросов с cookie-сессией нужно явно указать `credentials: 'include'`, и сервер должен ответить `Access-Control-Allow-Credentials: true` с конкретным (не `*`) `Access-Control-Allow-Origin`.

```tsx
fetch('https://api.example.com/me', { credentials: 'include' });
```

Если нужного заголовка на сервере нет, браузер не отдаст ответ скрипту — не из-за `fetch`, а из-за политики CORS. Отдельно важен атрибут cookie `SameSite`: `SameSite=Lax` или `Strict` может не отправить cookie даже с `credentials: 'include'`, если запрос идёт с другого поддомена в определённых сценариях навигации — для API на отдельном поддомене обычно достаточно `SameSite=Lax`, так как браузер считает поддомены одного домена «тем же сайтом».

### Подводные камни
- Поставить `Access-Control-Allow-Origin: *` вместе с `Allow-Credentials: true` — браузер такую комбинацию отклонит.
- Забыть `credentials: 'include'` на клиенте — cookie просто не уйдёт в кросс-доменный запрос.

### Что спросят дальше
- Чем `SameSite=Lax`, `Strict` и `None` отличаются друг от друга?
- Как настроить CORS на сервере для cookie-сессии с конкретного домена?

### Ссылки
- [Fetch: credentials — MDN](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials)
- [SameSite cookies — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)

# Как fetch ведёт себя с заголовками и Content-Type?
@slug fetch-headers-content-type
@topic fullstack

> `Content-Type` не выставляется автоматически для строкового тела — его нужно указать явно, иначе сервер может не распознать JSON. Исключение — `FormData`: для неё браузер сам ставит `multipart/form-data` с нужным boundary, и вручную его указывать нельзя.

```tsx
await fetch('/api/todos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Купить молоко' }),
});
```

Заголовок `Accept` стоит ставить, когда сервер умеет отдавать разные форматы (JSON или CSV, например) — без него сервер отдаёт формат по умолчанию. Часть заголовков браузер не позволяет подделать из кода ради безопасности (`Content-Length`, `Host`, `Cookie` напрямую через `headers`) — их выставляет сам браузер.

### Подводные камни
- Забыть `Content-Type: application/json` — на бэкенде тело придёт нераспарсенным либо как `undefined`.
- Вручную прописать `Content-Type` для `FormData` — потеряется boundary, и сервер не разберёт части запроса.

### Что спросят дальше
- Какие заголовки считаются «небезопасными» и браузер не даёт их переопределить?
- Как сервер должен обрабатывать `Accept` для нескольких форматов ответа?

### Ссылки
- [Headers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
- [Content negotiation — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation)

# Как написать свой хук для WebSocket-соединения в React?
@slug use-websocket-hook
@topic state

> Соединение создают в `useEffect` и обязательно закрывают в cleanup — иначе при каждом ре-рендере или размонтировании будут копиться незакрытые сокеты. Входящие сообщения складывают в state через `onmessage`, а отправку сообщений наружу дают через функцию, обёрнутую в `useCallback`.

```tsx
function useWebSocket(url: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onmessage = (e) => setMessages((prev) => [...prev, JSON.parse(e.data)]);
    return () => ws.close();
  }, [url]);

  const send = useCallback((data: unknown) => {
    wsRef.current?.send(JSON.stringify(data));
  }, []);

  return { messages, send };
}
```

Главная ловушка — React Strict Mode в разработке монтирует эффект дважды, и наивная реализация на мгновение открывает два соединения подряд (первое сразу закрывается cleanup'ом) — это нормально и не баг, но стоит об этом знать, чтобы не чинить несуществующую проблему. В production такого двойного монтирования нет.

### Подводные камни
- Создавать `WebSocket` без cleanup в `useEffect` — соединения накапливаются при каждом перерендере с новым `url`.
- Хранить сам сокет в state, а не в `ref` — запись в state не должна вызывать ре-рендер ради объекта соединения.

### Что спросят дальше
- Как добавить в этот хук автоматическое переподключение?
- Почему Strict Mode дважды монтирует эффекты в разработке?

### Ссылки
- [WebSocket — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Synchronizing with Effects — react.dev](https://react.dev/learn/synchronizing-with-effects)

# Как переподключаться к WebSocket и не потерять сообщения?
@slug websocket-reconnect
@topic state

> При разрыве соединения (`onclose`) запускают переподключение с экспоненциальным backoff — как при ретраях fetch, но с более долгим ожиданием и обычно без верхнего предела попыток, поскольку соединение нужно держать постоянно. Параллельно шлют heartbeat (`ping`/`pong`) — короткие технические сообщения, чтобы быстрее обнаружить «подвисшее» соединение, которое формально не закрылось, но перестало отвечать.

```tsx
function connect(url: string, onMessage: (data: unknown) => void, attempt = 0) {
  const ws = new WebSocket(url);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => {
    const delay = Math.min(1000 * 2 ** attempt, 30000);
    setTimeout(() => connect(url, onMessage, attempt + 1), delay);
  };
  return ws;
}
```

Переподключение само по себе не возвращает пропущенные во время разрыва сообщения — для этого сервер должен поддерживать историю или `since`/`cursor` параметр, по которому клиент после реконнекта запрашивает «что произошло, пока меня не было». Без этого протокола часть сообщений теряется безвозвратно — ровно поэтому важно различать транспорт (WebSocket) и протокол поверх него (гарантии доставки).

### Подводные камни
- Переподключаться без верхней границы задержки — при долгом падении сервера клиенты синхронно засыпают, а потом синхронно же бьют по нему при восстановлении.
- Считать, что реконнект сам восстановит пропущенные сообщения — для этого нужен отдельный механизм на сервере.

### Что спросят дальше
- Как спроектировать протокол с гарантией доставки поверх WebSocket?
- Чем heartbeat отличается от обычного ping на уровне TCP?

### Ссылки
- [WebSocket — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Writing WebSocket servers — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers)

# Чем SSE отличается от WebSocket и когда чего достаточно?
@slug sse-vs-websocket
@topic fullstack

> Server-Sent Events (SSE) — это однонаправленный поток событий от сервера к клиенту поверх обычного HTTP: клиент не может ничего отправить через то же соединение, зато SSE проще в реализации, работает через обычные прокси и автоматически переподключается силами браузера (`EventSource` сам реконнектится). WebSocket — двунаправленный канал, но без встроенного автореконнекта и с более сложной серверной частью.

```tsx
const source = new EventSource('/api/notifications');
source.onmessage = (e) => console.log(JSON.parse(e.data));
```

SSE подходит для живых уведомлений, прогресса долгой операции, ленты обновлений — везде, где клиенту нужно только слушать. WebSocket нужен, когда клиент тоже активно шлёт данные с той же частотой: чат, совместное редактирование, игры. Долгий polling (`long polling`) — третий вариант, более простой в инфраструктуре (обычный HTTP-запрос, который сервер не закрывает, пока не появится событие), но с большей задержкой и накладными расходами на каждое новое соединение.

### Подводные камни
- Выбрать WebSocket там, где достаточно SSE — усложнение инфраструктуры и сервера без необходимости.
- Забыть, что SSE передаёт только текст — для бинарных данных нужен WebSocket.

### Что спросят дальше
- Почему у `EventSource` ограничение на число одновременных соединений с одним доменом в HTTP/1.1 и как его обходит HTTP/2?
- Как реализовать двунаправленный сценарий через SSE плюс обычные POST-запросы?

### Ссылки
- [Server-Sent Events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource — MDN](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

# Как аутентифицировать WebSocket-соединение?
@slug websocket-auth
@topic fullstack

> Конструктор `WebSocket` не даёт задать произвольные заголовки — `Authorization` с токеном в хендшейк так просто не вставить. На практике токен передают через query-параметр URL (`wss://.../ws?token=...`), через subprotocol-заголовок, либо полагаются на cookie, которая браузер сам приложит к хендшейку, если домен совпадает.

Токен в URL-строке — рабочий, но не идеальный вариант: он может осесть в логах сервера или прокси. Более аккуратный подход — установить соединение без токена, а первым сообщением после `onopen` отправить токен и дождаться подтверждения от сервера, прежде чем слать остальные данные. Истечение токена посреди долгого соединения — отдельная проблема: сервер должен либо периодически проверять свежесть токена, либо явно закрывать соединение кодом, по которому клиент поймёт, что нужно переавторизоваться и переподключиться с новым токеном.

### Подводные камни
- Передавать долгоживущий секрет в query-параметре — он может попасть в логи сервера, прокси и истории браузера.
- Не продумать, что происходит при истечении токена во время уже открытого соединения.

### Что спросят дальше
- Как сервер должен сообщить клиенту, что нужно переавторизоваться?
- Чем аутентификация WebSocket отличается от аутентификации обычных HTTP-запросов?

### Ссылки
- [WebSocket — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [The WebSocket Protocol — RFC 6455](https://www.rfc-editor.org/rfc/rfc6455)

# Как работает middleware в Redux и что происходит при dispatch?
@slug redux-middleware
@topic state

> Middleware — это функция-обёртка вокруг `dispatch`, которая встаёт в цепочку между вызовом `dispatch(action)` и тем моментом, когда action долетает до reducer. Каждый middleware получает `action`, может его изменить, отменить, залогировать или подождать (для асинхронных операций), а затем вызвать `next(action)`, чтобы передать его дальше по цепочке.

```tsx
const logger = (store) => (next) => (action) => {
  console.log('dispatching', action);
  const result = next(action);
  console.log('next state', store.getState());
  return result;
};
```

Именно через middleware в Redux добавляют асинхронность: сам reducer обязан быть чистой синхронной функцией, поэтому `thunk` middleware разрешает `dispatch` принимать не только объект-action, но и функцию — эта функция получает `dispatch` и `getState` и может внутри делать `fetch`, а затем диспатчить обычные actions с результатом. `configureStore` из Redux Toolkit уже включает `thunk` middleware по умолчанию.

### Подводные камни
- Забыть вызвать `next(action)` в своём middleware — цепочка оборвётся, action никуда не дойдёт.
- Пытаться делать `fetch` прямо в reducer — reducer обязан быть чистым и синхронным.

### Что спросят дальше
- Чем `thunk` отличается от `redux-saga` и когда нужен более сложный инструмент?
- Как middleware видит `action` до того, как он попадёт в reducer?

### Ссылки
- [Middleware — Redux](https://redux.js.org/understanding/history-and-design/middleware)
- [Redux Toolkit: getDefaultMiddleware](https://redux-toolkit.js.org/api/getDefaultMiddleware)

# Зачем нужны селекторы и мемоизация (reselect) в Redux?
@slug redux-selectors-reselect
@topic state

> Селектор — функция `(state) => значение`, которая достаёт нужный кусок из общего стора. Без мемоизации вычисляемый селектор (например, отфильтрованный и отсортированный список) создаёт новый массив на каждый рендер, даже если исходные данные не менялись — а новая ссылка заставляет подписанные компоненты перерисовываться без реальной причины.

```tsx
import { createSelector } from '@reduxjs/toolkit';

const selectDoneTodos = createSelector(
  (state: RootState) => state.todos.items,
  (items) => items.filter((t) => t.done), // пересчитается только если items изменился
);
```

`createSelector` из Redux Toolkit (реэкспорт `reselect`) кэширует результат по последним входным аргументам: пока `state.todos.items` — та же ссылка, функция фильтрации не вызывается повторно, и компонент не перерисовывается из-за новой ссылки на массив. Это особенно важно для вычислений, которые проходят по большим спискам или делают сортировку/группировку на каждый рендер.

### Подводные камни
- Создавать `createSelector` прямо внутри компонента на каждом рендере — тогда кэш-ключ каждый раз новый, и мемоизация не работает.
- Забывать про селекторы вовсе и фильтровать данные прямо в JSX — работает, но пересчитывается на каждый рендер без всякой защиты.

### Что спросят дальше
- Как устроена мемоизация внутри `reselect` — по каким аргументам сравнивается кэш?
- Чем селекторы с параметрами (например, `selectTodoById(id)`) усложняют мемоизацию?

### Ссылки
- [Deriving Data with Selectors — Redux](https://redux.js.org/usage/deriving-data-selectors)
- [Reselect — GitHub](https://github.com/reduxjs/reselect)

# Как посмотреть и отладить state в Redux DevTools?
@slug redux-devtools
@topic state

> Расширение Redux DevTools показывает полную историю всех `dispatch`-нутых actions и diff состояния после каждого из них, позволяет «отмотать» стор к любому предыдущему action (time-travel) и экспортировать/импортировать состояние для воспроизведения бага. `configureStore` из Redux Toolkit подключает DevTools автоматически в разработке — ничего настраивать вручную не нужно.

Time-travel работает только потому, что Redux-состояние меняется исключительно через чистые reducer-функции: зная начальное состояние и список actions, DevTools может воспроизвести любое промежуточное состояние, просто прогоняя reducer заново. Этот же принцип используют для записи и воспроизведения багов: сохранили последовательность actions — получили точный сценарий для репродукции, без утечки реальных пользовательских данных, если actions не содержат секретов.

### Подводные камни
- Включать DevTools в production-сборке — вся история actions и состояния видна в инструментах разработчика пользователя.
- Хранить в actions чувствительные данные (пароли, токены) — они останутся в истории DevTools на экране разработчика.

### Что спросят дальше
- Почему time-travel debugging невозможен с мутирующими изменениями состояния?
- Как экспортировать и переиспользовать сценарий из DevTools для автотеста?

### Ссылки
- [Redux DevTools Extension — GitHub](https://github.com/reduxjs/redux-devtools)
- [Redux Toolkit: configureStore](https://redux-toolkit.js.org/api/configureStore)
