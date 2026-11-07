# Что делает createSlice и при чём тут Immer?
@slug rtk-create-slice
@topic state

> `createSlice` берёт имя, начальное состояние и объект редьюсеров и сам генерирует action creators и итоговый reducer — без ручного написания `switch` по `action.type` и строковых констант. Внутри каждого редьюсера можно писать код, который выглядит как мутация (`state.items.push(x)`), потому что Redux Toolkit оборачивает его в Immer: Immer записывает изменения в «черновик» и сам производит новое иммутабельное состояние.

```tsx
const todosSlice = createSlice({
  name: 'todos',
  initialState: [] as Todo[],
  reducers: {
    added: (state, action: PayloadAction<Todo>) => {
      state.push(action.payload); // выглядит как мутация, на деле — иммутабельное обновление
    },
  },
});
export const { added } = todosSlice.actions;
```

Immer работает только внутри редьюсера `createSlice` — если вернуть новое значение явно (`return newState`), работает обычное иммутабельное обновление, но мешать оба подхода в одном редьюсере (и мутировать, и возвращать) нельзя.

### Подводные камни
- Мутировать `state` вне `createSlice`, в обычном Redux-редьюсере — там Immer не подключён, это испортит состояние.
- Делать асинхронные вызовы прямо внутри редьюсера `createSlice` — редьюсер обязан оставаться синхронным и чистым, для асинхронности есть `createAsyncThunk`.

### Что спросят дальше
- Как `createSlice` генерирует строковые типы actions из имени slice?
- Чем Immer отличается от ручного `{ ...state, items: [...state.items, x] }`?

### Ссылки
- [createSlice — Redux Toolkit](https://redux-toolkit.js.org/api/createSlice)
- [Immer — Introduction](https://immerjs.github.io/immer/)

# Как устроен createAsyncThunk и какие actions он создаёт?
@slug rtk-create-async-thunk
@topic state

> `createAsyncThunk` принимает тип action и асинхронную функцию, а возвращает thunk, который при диспатче автоматически рассылает три actions: `pending` (сразу), `fulfilled` (при успехе, с результатом в `payload`) или `rejected` (при ошибке). Это избавляет от ручного написания трёх action creators и трёх веток в редьюсере для каждого запроса.

```tsx
const fetchUser = createAsyncThunk('users/fetch', async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json() as Promise<User>;
});

builder
  .addCase(fetchUser.pending, (state) => { state.status = 'loading'; })
  .addCase(fetchUser.fulfilled, (state, action) => { state.status = 'done'; state.user = action.payload; })
  .addCase(fetchUser.rejected, (state, action) => { state.status = 'error'; state.error = action.error.message; });
```

Ошибку в `rejected` кладут в `action.error`, но для управляемых бизнес-ошибок (не исключение, а, например, «неверный пароль» с кодом 401) принято использовать `rejectWithValue`, чтобы передать структурированные данные ошибки в `action.payload`, а не полагаться на текст исключения.

### Подводные камни
- Не обрабатывать `rejected` — ошибка просто теряется, а UI остаётся в состоянии загрузки навсегда.
- Бросать произвольные объекты вместо `Error` или `rejectWithValue` — теряется стек и единообразие обработки ошибок.

### Что спросят дальше
- Чем `rejectWithValue` отличается от обычного `throw` внутри thunk?
- Как отменить уже запущенный `createAsyncThunk` через `AbortController`?

### Ссылки
- [createAsyncThunk — Redux Toolkit](https://redux-toolkit.js.org/api/createAsyncThunk)
- [Writing Logic with Thunks — Redux](https://redux.js.org/usage/writing-logic-thunks)

# Что настраивает configureStore по умолчанию?
@slug rtk-configure-store
@topic state

> `configureStore` — это обёртка над классическим `createStore`, которая сразу включает набор разумных настроек по умолчанию: `thunk` middleware для асинхронности, Redux DevTools Extension в разработке, и проверки в режиме разработки на сериализуемость state/actions и на случайные мутации состояния вне Immer.

```tsx
const store = configureStore({
  reducer: { todos: todosReducer, user: userReducer },
});
```

Проверка сериализуемости (`serializableCheck`) ругается, если в state или action попадает несериализуемое значение — например, `Date`, `Map` или функция. Это намеренное ограничение: Redux-состояние задумано сериализуемым, чтобы работали DevTools, time-travel и персистентность. Если в проекте есть легитимный случай (например, объект `File` при загрузке), эту проверку можно точечно отключить для конкретного action через опции `serializableCheck`.

### Подводные камни
- Отключать все проверки разработки целиком вместо точечной настройки под конкретный легитимный случай.
- Не знать, что `thunk` middleware уже включён по умолчанию, и подключать его вручную второй раз.

### Что спросят дальше
- Зачем Redux-состояние должно быть сериализуемым и что это даёт?
- Как добавить собственный middleware, не потеряв стандартные из `getDefaultMiddleware`?

### Ссылки
- [configureStore — Redux Toolkit](https://redux-toolkit.js.org/api/configureStore)
- [Redux Toolkit — Usage Guide](https://redux-toolkit.js.org/usage/usage-guide)

# Зачем нужен createEntityAdapter в Redux Toolkit?
@slug rtk-entity-adapter
@topic state

> `createEntityAdapter` генерирует готовый набор редьюсеров и селекторов для хранения коллекции сущностей в нормализованной форме — `{ ids: string[], entities: Record<string, T> }` — вместо того чтобы вручную писать `addOne`, `updateOne`, `removeOne` и логику поиска по id. Это та же идея нормализации, что и при ручном дизайне state (словарь по id), но без boilerplate.

```tsx
const todosAdapter = createEntityAdapter<Todo>();
const todosSlice = createSlice({
  name: 'todos',
  initialState: todosAdapter.getInitialState(),
  reducers: {
    added: todosAdapter.addOne,
    removed: todosAdapter.removeOne,
  },
});
export const { selectAll, selectById } = todosAdapter.getSelectors((state: RootState) => state.todos);
```

Готовые селекторы (`selectAll`, `selectById`, `selectIds`) уже мемоизированы через `createSelector`, так что `selectAll` не создаёт новый массив на каждый вызов, если сущности не менялись. Адаптер также умеет сортировать сущности по заданному компаратору при каждом обновлении, поддерживая порядок без ручной пересортировки.

### Подводные камни
- Хранить коллекцию как плоский массив вместо словаря по id — поиск и обновление одного элемента становится O(n) вместо O(1).
- Писать свои `addOne`/`updateOne` вручную, не зная, что адаптер уже даёт готовые и протестированные версии.

### Что спросят дальше
- Как `createEntityAdapter` сочетается с RTK Query и общим кэшем сущностей?
- Чем нормализованное состояние лучше вложенных объектов с дублирующимися данными?

### Ссылки
- [createEntityAdapter — Redux Toolkit](https://redux-toolkit.js.org/api/createEntityAdapter)
- [Normalizing State Shape — Redux](https://redux.js.org/usage/structuring-reducers/normalizing-state-shape)

# Как тестировать редьюсеры и async thunk?
@slug testing-redux
@topic testing

> Редьюсер `createSlice` — чистая функция, поэтому тест просто вызывает её с начальным состоянием и action и сравнивает результат: `expect(reducer(undefined, added(todo))).toEqual([todo])`. Моков и окружения не нужно — это обычный unit-тест чистой функции.

```tsx
test('added добавляет todo в список', () => {
  const state = todosReducer([], added({ id: '1', title: 'Молоко' }));
  expect(state).toHaveLength(1);
});
```

Для `createAsyncThunk` проще тестировать не сам thunk изолированно, а интеграционно: создать тестовый `store` через `configureStore` с замоканным `fetch` (например, через MSW), продиспатчить thunk и проверить итоговое состояние после `pending`/`fulfilled`. Так тест проверяет реальное поведение приложения — запрос ушёл, состояние обновилось — а не внутренние детали реализации thunk.

### Подводные камни
- Пытаться тестировать `createAsyncThunk` вызовом «напрямую» без реального `dispatch` через store — thunk рассчитан на то, что его диспатчат, а не вызывают как обычную функцию.
- Мокать сам Redux (`jest.mock('@reduxjs/toolkit')`) вместо мока сети — тест перестаёт проверять реальную логику.

### Что спросят дальше
- Чем интеграционный тест через реальный store отличается от изолированного теста чистого редьюсера?
- Как замокать `fetch` внутри thunk через MSW?

### Ссылки
- [Writing Tests — Redux](https://redux.js.org/usage/writing-tests)
- [createAsyncThunk — Redux Toolkit](https://redux-toolkit.js.org/api/createAsyncThunk)

# С чего начать работу с RTK Query: createApi и эндпоинты?
@slug rtk-query-basics
@topic state

> `createApi` описывает набор эндпоинтов декларативно — `query` для чтения данных, `mutation` для их изменения — и генерирует готовые React-хуки для каждого (`useGetTodosQuery`, `useAddTodoMutation`). RTK Query сам берёт на себя кэширование, состояния загрузки/ошибки и повторные запросы — не нужно вручную писать `useEffect` с `fetch` и свой `useState` для статуса.

```tsx
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getTodos: builder.query<Todo[], void>({ query: () => 'todos' }),
    addTodo: builder.mutation<Todo, string>({
      query: (title) => ({ url: 'todos', method: 'POST', body: { title } }),
    }),
  }),
});
export const { useGetTodosQuery, useAddTodoMutation } = api;
```

Сгенерированный `reducerPath` подключают в `configureStore` как обычный срез, а `api.middleware` добавляют в middleware store — без этого не заработают кэширование и автоматическое обновление по тегам. RTK Query построен на Redux и использует тот же store, поэтому его состояние видно в тех же Redux DevTools.

### Подводные камни
- Забыть подключить `api.reducer` и `api.middleware` в `configureStore` — хуки `useGetTodosQuery` не заработают.
- Писать свой `useEffect` с `fetch` рядом с RTK Query «на всякий случай» — дублирование того, что уже решает библиотека.

### Что спросят дальше
- Чем `query` отличается от `mutation` в RTK Query?
- Как RTK Query решает проблему дублирующихся запросов от разных компонентов?

### Ссылки
- [RTK Query Overview](https://redux-toolkit.js.org/rtk-query/overview)
- [createApi — RTK Query](https://redux-toolkit.js.org/rtk-query/api/createApi)

# Как работает инвалидация кэша через теги в RTK Query?
@slug rtk-query-tags
@topic state

> Каждый `query` может объявить, какие теги он `providesTags`, а каждая `mutation` — какие теги она `invalidatesTags`. Когда мутация с определённым тегом выполняется, RTK Query автоматически перезапрашивает все активные запросы, которые этот тег предоставляли — без ручного вызова `refetch` в компоненте, который ничего не знает об успешной мутации в другом месте приложения.

```tsx
getTodos: builder.query<Todo[], void>({
  query: () => 'todos',
  providesTags: (result) => result ? [...result.map(({ id }) => ({ type: 'Todo' as const, id })), { type: 'Todo', id: 'LIST' }] : [{ type: 'Todo', id: 'LIST' }],
}),
addTodo: builder.mutation<Todo, string>({
  query: (title) => ({ url: 'todos', method: 'POST', body: { title } }),
  invalidatesTags: [{ type: 'Todo', id: 'LIST' }],
}),
```

Тег с id `'LIST'` — распространённый приём: он инвалидирует именно список, не трогая кэш конкретных отдельных элементов, которые могли быть загружены отдельно. Теги с конкретным id отдельных сущностей позволяют точечно обновлять только то, что изменилось, не перезапрашивая весь список из-за правки одного элемента.

### Подводные камни
- Указывать одинаковый общий тег на всё подряд — теряется точность, любая мутация обновляет всё сразу.
- Забыть тег `'LIST'` — добавление нового элемента не обновит уже отрендеренный список.

### Что спросят дальше
- Чем инвалидация по тегам отличается от ручного `refetch()` после мутации?
- Как RTK Query решает, какие именно активные подписки нужно перезапросить?

### Ссылки
- [Automated Re-fetching — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching)
- [Cache Behavior — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/cache-behavior)

# Как сделать мутацию и отследить её состояние в RTK Query?
@slug rtk-query-mutations
@topic state

> Хук мутации возвращает кортеж: триггер-функцию для запуска запроса и объект состояния (`isLoading`, `isError`, `data`, `error`) — похоже на `useState` плюс управляемый запрос. Триггер возвращает промис, который можно дождаться отдельно от состояния хука, если нужно, например, закрыть модалку только после успеха.

```tsx
const [addTodo, { isLoading, error }] = useAddTodoMutation();

async function onSubmit(title: string) {
  try {
    await addTodo(title).unwrap(); // unwrap превращает результат в обычный промис с throw при ошибке
    closeModal();
  } catch {
    // error уже доступен и через объект состояния хука
  }
}
```

`.unwrap()` нужен, потому что по умолчанию триггер-промис резолвится всегда (с `{ data }` или `{ error }` внутри), а не реджектится при ошибке запроса — это сделано, чтобы случайный необработанный `catch` не превращался в необработанное исключение. `.unwrap()` явно просит реджект при ошибке, когда это действительно нужно для `try/catch`-логики.

### Подводные камни
- Полагаться на `await addTodo(...)` в `try/catch` без `.unwrap()` — промис не реджектится, `catch` не сработает.
- Не читать `isLoading` из состояния хука и держать для этого свой `useState`, дублируя то, что уже есть.

### Что спросят дальше
- Чем мутация с `fixedCacheKey` отличается от обычной — зачем делиться состоянием мутации между компонентами?
- Как RTK Query решает, когда сбросить состояние завершённой мутации?

### Ссылки
- [Mutations — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/mutations)
- [useMutation — RTK Query API](https://redux-toolkit.js.org/rtk-query/api/created-api/hooks#usemutation)

# Что такое polling и refetchOnFocus/refetchOnReconnect в RTK Query?
@slug rtk-query-polling
@topic state

> `pollingInterval` в опциях хука запроса заставляет RTK Query автоматически перезапрашивать данные каждые N миллисекунд, пока у запроса есть хотя бы один активный подписчик — удобно для почти-реалтайм данных вроде котировок или счётчика непрочитанных, когда полноценный WebSocket избыточен. `refetchOnFocus` и `refetchOnReconnect` перезапрашивают данные, когда пользователь вернулся на вкладку или восстановилось сетевое соединение — это настраивается глобально при создании API или на конкретном хуке.

```tsx
const { data } = useGetPricesQuery(undefined, { pollingInterval: 5000, refetchOnFocus: true });
```

Polling останавливается сам, если ни один компонент больше не подписан на этот запрос (все размонтировались) — RTK Query не держит фоновые запросы для данных, которые никто не показывает. Это отличает его от «ручного» `setInterval`, который продолжит работать, пока явно не очищен.

### Подводные камни
- Ставить слишком короткий `pollingInterval` для редко меняющихся данных — лишняя нагрузка на сервер без пользы.
- Не знать, что polling сам остановится при отсутствии подписчиков, и городить ручную очистку интервала поверх.

### Что спросят дальше
- Чем `pollingInterval` в RTK Query лучше или хуже честного WebSocket-соединения для тех же данных?
- Как совместить polling с `skip`, чтобы не опрашивать сервер, пока вкладка неактивна?

### Ссылки
- [Polling — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/polling)
- [Automated Re-fetching — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/automated-refetching)

# Как трансформировать и выбирать данные из кэша RTK Query?
@slug rtk-query-transform-select
@topic state

> `transformResponse` в описании эндпоинта меняет форму ответа сервера один раз, перед тем как результат попадёт в кэш — удобно, если API отдаёт данные не в том виде, в котором их использует UI (например, снять обёртку `{ data: [...] }`). Опция `selectFromResult` хука, напротив, работает уже на клиенте и решает, какую часть закэшированных данных реально нужно именно этому компоненту — так несколько компонентов, подписанных на один и тот же запрос, перерисовываются только от изменений своей части данных.

```tsx
getTodos: builder.query<Todo[], void>({
  query: () => 'todos',
  transformResponse: (response: { data: Todo[] }) => response.data,
}),
```

```tsx
const { todoTitle } = useGetTodosQuery(undefined, {
  selectFromResult: ({ data }) => ({ todoTitle: data?.find((t) => t.id === id)?.title }),
});
```

Без `selectFromResult` компонент перерисовывается при любом изменении всего результата запроса, даже если его касается только один элемент списка — та же проблема, что решают мемоизированные селекторы в обычном Redux.

### Подводные камни
- Делать тяжёлые вычисления в `transformResponse` на каждый ответ, когда их можно сделать один раз на сервере.
- Не использовать `selectFromResult` в списках с частыми обновлениями — лишние перерисовки по всему списку из-за одного изменённого элемента.

### Что спросят дальше
- Чем `transformResponse` отличается от трансформации данных прямо в компоненте после получения `data`?
- Как `selectFromResult` взаимодействует с мемоизацией, чтобы не создавать новый объект на каждый рендер?

### Ссылки
- [Customizing Query Responses — RTK Query](https://redux-toolkit.js.org/rtk-query/usage/customizing-queries)
- [useQuery: selectFromResult — RTK Query API](https://redux-toolkit.js.org/rtk-query/api/created-api/hooks#selectfromresult)

# Когда вообще не нужен Redux?
@slug when-not-redux
@topic state

> Если состояние — это копия данных с сервера (список товаров, профиль пользователя), для него не нужен Redux: RTK Query, TanStack Query или даже простой `useEffect` с кэшем решают задачу кэширования и инвалидации лучше, потому что умеют работать с устареванием, повторными запросами и фоновым обновлением из коробки. Redux (как и его классический стор) предназначен для **клиентского** состояния: что выбрано, что открыто, какой фильтр активен — данных, у которых нет «источника истины» на сервере.

Если состояние нужно только одному компоненту и паре его детей — хватает `useState` и передачи props или, в крайнем случае, `Context` с `useReducer`. Редукс оправдан, когда состояние действительно читают и меняют многие несвязанные части дерева, и важна предсказуемость: единый способ менять данные, который можно залогировать, протестировать и отследить в DevTools.

### Подводные камни
- Заводить Redux-срез для данных, которые на самом деле являются кэшем ответа сервера.
- Решать любую задачу с состоянием через глобальный стор «для единообразия», даже когда локального `useState` достаточно.

### Что спросят дальше
- Как по конкретному кейсу решить: Context, Zustand или Redux?
- Чем серверное состояние принципиально отличается от клиентского с точки зрения требований к хранилищу?

### Ссылки
- [You Might Not Need Redux — блог Dan Abramov](https://redux.js.org/faq/general#when-should-i-use-redux)
- [Redux Essentials: State, Actions, and Reducers](https://redux.js.org/tutorials/essentials/part-1-overview-concepts)
