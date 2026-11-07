# Как разбить RTK Query API на части через code splitting?
@slug rtk-query-code-splitting
@topic state

> В большом приложении все эндпоинты не обязательно описывать в одном `createApi` — `injectEndpoints` позволяет завести «базовый» API с общим `baseQuery`, а конкретные эндпоинты добавлять по частям, в том числе из отдельных файлов или лениво загружаемых модулей фич. Это снижает связность: фиче не нужно знать обо всех остальных эндпоинтах приложения, только о своих.

```tsx
// api/base.ts
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: () => ({}),
});

// features/todos/api.ts
export const todosApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTodos: builder.query<Todo[], void>({ query: () => 'todos' }),
  }),
});
export const { useGetTodosQuery } = todosApi;
```

Каждый вызов `injectEndpoints` возвращает тот же `baseApi`, расширенный новыми эндпоинтами, с теми же сгенерированными хуками — реальный Redux store при этом остаётся один, просто растёт постепенно, по мере того как код фич подгружается (например, через `React.lazy`).

### Подводные камни
- Описывать все эндпоинты приложения в одном файле — он быстро становится узким местом для мёрджей и понимания зависимостей.
- Забыть, что `injectEndpoints` должен указывать на тот же `baseApi`, иначе получится два параллельных независимых кэша.

### Что спросят дальше
- Как это сочетается с ленивой загрузкой фич через `React.lazy`?
- Что произойдёт, если два модуля случайно добавят эндпоинт с одинаковым именем?

### Ссылки
- [Code Splitting — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/code-splitting)
- [createApi — RTK Query](https://redux-toolkit.js.org/rtk-query/api/createApi)

# Как сделать оптимистичное обновление в RTK Query?
@slug rtk-query-optimistic-updates
@topic state

> Оптимистичное обновление меняет кэш сразу после запуска мутации, не дожидаясь ответа сервера — UI реагирует мгновенно, а если запрос всё-таки провалится, изменение откатывают. В RTK Query это делают через `onQueryStarted` эндпоинта мутации: там вручную правят кэш другого запроса (`updateQueryData`) и откатывают правку в `catch`, если промис запроса реджектился.

```tsx
toggleTodo: builder.mutation<void, string>({
  query: (id) => ({ url: `todos/${id}/toggle`, method: 'POST' }),
  async onQueryStarted(id, { dispatch, queryFulfilled }) {
    const patch = dispatch(
      api.util.updateQueryData('getTodos', undefined, (draft) => {
        const todo = draft.find((t) => t.id === id);
        if (todo) todo.done = !todo.done; // снова Immer — можно «мутировать» draft
      }),
    );
    try {
      await queryFulfilled;
    } catch {
      patch.undo(); // откат к состоянию до оптимистичного изменения
    }
  },
}),
```

Такой подход хорош для действий с высокой вероятностью успеха и низкой ценой отката (лайк, чекбокс) — пользователь не должен ждать round-trip до сервера ради мгновенной визуальной реакции. Для операций с реальными побочными эффектами (списание денег) оптимистичное обновление может вводить в заблуждение, если откат происходит заметно позже визуального «успеха».

### Подводные камни
- Не реализовать откат (`patch.undo()`) в `catch` — при ошибке UI останется в неверном оптимистичном состоянии.
- Применять оптимистичное обновление к операциям, где цена ложного «успеха» высока для пользователя.

### Что спросят дальше
- Чем `onQueryStarted` отличается от простого ожидания ответа и обновления кэша через теги?
- Как показать пользователю, что изменение ещё не подтверждено сервером?

### Ссылки
- [Optimistic Updates — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates#optimistic-updates)
- [Manual Cache Updates — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates)

# Как устроена реавторизация в RTK Query baseQuery?
@slug rtk-query-reauth
@topic state

> `fetchBaseQuery` принимает `prepareHeaders` для подстановки токена в каждый запрос, но для обработки его истечения (ответ 401) нужна отдельная обёртка — `baseQuery` с собственной логикой: перехватить 401, попытаться обновить токен через refresh-запрос, и если это удалось — повторить исходный запрос уже с новым токеном.

```tsx
const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQueryWithReauth: typeof rawBaseQuery = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    const refreshResult = await rawBaseQuery('/auth/refresh', api, extraOptions);
    if (refreshResult.data) {
      api.dispatch(tokenRefreshed(refreshResult.data));
      result = await rawBaseQuery(args, api, extraOptions); // повтор исходного запроса
    } else {
      api.dispatch(loggedOut());
    }
  }
  return result;
};
```

Важная деталь — если в один момент параллельно 401 получат сразу несколько запросов (пользователь открыл страницу с тремя одновременными query), наивная реализация запустит несколько параллельных refresh-запросов. На практике это решают через `Mutex` (например, из библиотеки `async-mutex`): первый запрос на обновление токена блокирует остальные, пока не завершится, а они потом переиспользуют уже обновлённый токен.

### Подводные камни
- Не защититься от параллельных refresh-запросов — несколько одновременных 401 запускают гонку обновлений токена.
- Зациклиться, если refresh сам вернул 401 — нужен явный выход в `loggedOut` вместо бесконечного повтора.

### Что спросят дальше
- Как предотвратить гонку параллельных refresh-запросов через Mutex?
- Где безопаснее хранить refresh-токен — в памяти, cookie или localStorage?

### Ссылки
- [Customizing Queries: Automatic Re-authorization — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/customizing-queries#automatic-re-authorization-by-extending-fetchbasequery)
- [fetchBaseQuery — RTK Query API](https://redux-toolkit.js.org/rtk-query/api/fetchBaseQuery)

# Что происходит под капотом RTK Query и как он связан с Redux store?
@slug rtk-query-internals
@topic state

> RTK Query — это не отдельная система, а обычный Redux-срез плюс middleware, сгенерированные `createApi`. Каждый запрос — это `dispatch` обычного thunk-подобного action, кэш хранится как обычное Redux-состояние под `reducerPath`, а хуки (`useGetTodosQuery`) — это `useSelector` на это состояние плюс `useEffect`, который запускает подписку и отписку при монтировании/размонтировании компонента.

Именно поэтому RTK Query виден в Redux DevTools как обычный срез состояния — там видны все закэшированные данные, статусы загрузки по каждому запросу и историю actions `pending`/`fulfilled`/`rejected`, сгенерированных автоматически. Подсчёт подписчиков на каждый уникальный запрос (по сериализованным аргументам) и есть механизм, который решает, когда запускать новый запрос (первый подписчик), а когда переиспользовать уже идущий (второй компонент с теми же аргументами просто получает тот же кэш) и когда можно удалить данные из кэша (`keepUnusedDataFor`, последний подписчик отписался).

### Подводные камни
- Думать, что RTK Query — отдельная от Redux система «магии» — это мешает понимать, почему его состояние видно в DevTools и как его дебажить.
- Не учитывать `keepUnusedDataFor` — данные, которые больше никто не показывает, через время удаляются из кэша, и следующий запрос снова уйдёт на сервер.

### Что спросят дальше
- Как RTK Query дедуплицирует два одновременных запроса с одинаковыми аргументами от разных компонентов?
- Что произойдёт с кэшем, если очистить весь Redux store (например, при выходе пользователя)?

### Ссылки
- [RTK Query Overview](https://redux-toolkit.js.org/rtk-query/overview)
- [Cache Behavior — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/cache-behavior)

# Как спроектировать протокол поверх WebSocket для чата или совместного редактирования?
@slug websocket-protocol-design
@topic architecture

> WebSocket даёт только транспорт — байты между клиентом и сервером; гарантии доставки, порядок операций и разрешение конфликтов нужно проектировать отдельным протоколом поверх него. Для чата минимально нужны: тип сообщения (`join`, `message`, `typing`, `ack`), уникальный `clientId` на каждое исходящее сообщение (чтобы связать подтверждение сервера с оптимистичным сообщением в UI и не создать дубликат при повторной отправке) и способ синхронизации после реконнекта — например, `lastSeenSeq`, по которому сервер досылает пропущенное.

Для совместного редактирования одного документа недостаточно просто транслировать операции всем участникам: конкурентные правки от разных пользователей нужно либо сериализовать через единственный источник истины на сервере (с блокировками или очередью), либо использовать алгоритмы, спроектированные для этого — Operational Transformation (как в Google Docs) или CRDT (Conflict-free Replicated Data Types, как в большинстве современных редакторов). Оба подхода гарантируют, что документ сойдётся к одинаковому состоянию у всех участников независимо от порядка, в котором к ним пришли чужие правки.

### Подводные камни
- Транслировать сырые операции редактирования без алгоритма разрешения конфликтов — документы у разных участников расходятся.
- Не предусмотреть `clientId` для исходящих сообщений — повторная отправка после обрыва связи создаёт дубликат.

### Что спросят дальше
- Чем Operational Transformation принципиально отличается от CRDT?
- Как спроектировать `ack`-протокол, чтобы отправитель знал, что сообщение точно доставлено?

### Ссылки
- [CRDT.tech — обзор CRDT](https://crdt.tech/)
- [The WebSocket Protocol — RFC 6455](https://www.rfc-editor.org/rfc/rfc6455)

# Как сочетать RTK Query и обычные Redux-срезы в одном приложении?
@slug rtk-query-with-slices
@topic state

> RTK Query и обычные `createSlice` прекрасно живут в одном store — это разные инструменты для разных типов состояния: RTK Query берёт на себя серверные данные (кэш, загрузка, инвалидация), а `createSlice` — клиентское UI-состояние (открыта ли модалка, какой фильтр выбран, черновик формы). Смешивать их — не антипаттерн, а нормальная архитектура: `configureStore` просто подключает оба редьюсера и оба middleware рядом.

```tsx
const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer, // RTK Query: серверные данные
    ui: uiReducer,                  // обычный slice: клиентское состояние
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});
```

Частый пограничный случай — клиентский фильтр, который влияет на серверный запрос (например, поисковая строка хранится в обычном slice или в URL, а значение передаётся как аргумент в `useGetTodosQuery(filter)`). Здесь важно не дублировать одно и то же состояние в двух местах: источник истины для фильтра — slice или URL, а RTK Query лишь реагирует на его изменение через аргумент хука.

### Подводные камни
- Дублировать серверные данные ещё и в обычном slice «на всякий случай» — два источника истины легко рассинхронизировать.
- Держать в RTK Query чисто клиентское состояние, которое никогда не ходит на сервер — для него есть `createSlice` или даже просто `useState`.

### Что спросят дальше
- Как организовать структуру store в большом приложении с десятками фич и RTK Query API?
- В каком случае клиентский фильтр стоит хранить в URL, а не в Redux-slice?

### Ссылки
- [Redux Toolkit — Usage Guide](https://redux-toolkit.js.org/usage/usage-guide)
- [RTK Query Overview](https://redux-toolkit.js.org/rtk-query/overview)
