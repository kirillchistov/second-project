# Как организовать большой Zustand-стор через слайсы?
@slug zustand-slices-organization
@topic state
@verified react@19.3
@updated 2026-11

> Один большой стор на всё приложение быстро становится нечитаемым файлом на сотни строк. Паттерн слайсов делит его на независимые куски — каждый слайс описывает свою часть состояния и свои действия как функцию `(set, get, api) => ({ ... })` — а затем все слайсы объединяют в один вызов `create()` через spread. Технически это всё ещё один стор с одним `useStore`, просто его **определение** физически разнесено по файлам.

```tsx
// cartSlice.ts
export const createCartSlice: StateCreator<StoreState, [], [], CartSlice> = (set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  totalPrice: () => get().items.reduce((sum, i) => sum + i.price, 0),
});

// userSlice.ts
export const createUserSlice: StateCreator<StoreState, [], [], UserSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});

// store.ts — сборка всех слайсов в один стор
type StoreState = CartSlice & UserSlice;
export const useStore = create<StoreState>()((...args) => ({
  ...createCartSlice(...args),
  ...createUserSlice(...args),
}));
```

Ключевая деталь типа `StateCreator<StoreState, [], [], CartSlice>` — каждый слайс типизирован на **весь** `StoreState`, а не только на свою часть: это позволяет действиям одного слайса читать и даже менять состояние другого через тот же `get`/`set`, если это действительно нужно (например, очистка корзины при выходе пользователя, вызванная из `userSlice`). Такая связность между слайсами должна быть осознанным решением, а не случайностью — иначе разделение на слайсы теряет смысл изоляции.

### Подводные камни
- Называть одно и то же поле в разных слайсах одинаково — при объединении через spread последний слайс молча перетирает поле предыдущего, TypeScript не всегда укажет на конфликт явно.
- Делать слайсы полностью изолированными там, где между ними объективно есть связь (корзина и пользователь) — вместо явного взаимодействия через `get()` появляется дублирующая логика синхронизации снаружи стора.
- Плодить слайсы ради самой декомпозиции, когда стор маленький — границы между тремя полями и двумя действиями не нужны, это усложнение без выгоды.

### Что спросят дальше
- Как один слайс безопасно вызывает действие другого слайса, не создавая циклическую зависимость импортов?
- Чем паттерн слайсов Zustand концептуально похож на `combineReducers` в классическом Redux?

### Ссылки
- [Zustand — Slices pattern](https://zustand.docs.pmnd.rs/guides/slices-pattern)
- [Zustand — TypeScript Guide](https://zustand.docs.pmnd.rs/guides/typescript)

# Как использовать Zustand-стор вне React-компонентов?
@slug zustand-outside-react
@topic state
@verified react@19.3
@updated 2026-11

> `create()` возвращает не просто хук — у результата есть методы `getState()`, `setState()` и `subscribe()`, которые работают без всякого React-рендера. Это открывает стор для кода, который принципиально живёт вне дерева компонентов: loader'а роутера, который должен прочитать токен из стора до первого рендера страницы, обработчика WebSocket-сообщения, который обновляет состояние по приходу события, или модуля аналитики, который подписывается на изменения, чтобы отправлять события.

```tsx
// Роутер читает стор до рендера компонента — getState(), не хук
export async function protectedLoader() {
  const { token } = useAuthStore.getState();
  if (!token) throw redirect('/login');
  return null;
}

// Подписка вне компонента: вызывается при каждом изменении стора
const unsubscribe = useAuthStore.subscribe((state, prevState) => {
  if (state.token !== prevState.token) {
    analytics.identify(state.user?.id ?? null);
  }
});

// WebSocket-обработчик обновляет стор напрямую, без промежуточного компонента
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  useChatStore.getState().addMessage(message);
};
```

Для действительно изолированного от React стора (например, переиспользуемого в не-React части приложения или в библиотеке компонентов) есть `createStore` из `zustand/vanilla` — он не содержит самого React-хука вообще, а хук `useStore(store, selector)` из `zustand/react` подключают поверх отдельно, когда он всё же нужен компоненту. Это разделение явно показывает: сам стор не обязан ничего знать о React — хук лишь мост к нему.

### Подводные камни
- Вызывать `useAuthStore()` (хук) там, где нужен просто `.getState()` — вне компонента хуки вызывать нельзя в принципе, это сразу ошибка правил хуков.
- Не отписываться (`unsubscribe()`) от `subscribe()`, вызванного вне React-дерева — в отличие от эффекта компонента, здесь никто не вызовет cleanup автоматически при размонтировании чего-либо.
- Читать состояние через `getState()` один раз и закэшировать значение в переменную модуля — в отличие от селектора в компоненте, это не создаёт живую подписку, значение устареет при следующем изменении стора.

### Что спросят дальше
- Чем `zustand/vanilla` принципиально отличается от обычного `create()` с точки зрения зависимости от React?
- Как организовать несколько независимых экземпляров одного и того же стора (например, для разных вкладок или виджетов на одной странице)?

### Ссылки
- [Zustand — Practice with no store actions / vanilla store](https://zustand.docs.pmnd.rs/guides/practice-with-no-store-actions)
- [Zustand — API Reference: subscribe](https://zustand.docs.pmnd.rs/apis/create-store)

# Как задеплоить SPA на собственный сервер: Nginx как reverse proxy и TLS через Let's Encrypt?
@slug deploy-own-server-nginx-tls
@topic fullstack
@verified react@19.3
@updated 2026-11

> Собственный сервер даёт то, чего не даёт статический хостинг: контроль над заголовками, собственный reverse proxy перед API, произвольные редиректы и работу с несколькими сервисами на одном домене. Nginx здесь решает две разные задачи сразу — отдаёт статические файлы SPA с диска и проксирует запросы `/api/*` на бэкенд-процесс (Node, например, слушающий `localhost:3000`), так что с точки зрения браузера сайт и API выглядят одним origin без проблем CORS.

```nginx
server {
  listen 80;
  server_name example.com;
  location / { return 301 https://$host$request_uri; } # редирект на HTTPS
}

server {
  listen 443 ssl;
  server_name example.com;
  ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  root /var/www/app/dist;
  location / {
    try_files $uri /index.html; # SPA-роутинг: несуществующий путь отдаёт index.html, а не 404
  }
  location /api/ {
    proxy_pass http://localhost:3000; # проксирование на бэкенд-процесс на том же сервере
    proxy_set_header Host $host;
  }
}
```

Сертификат от Let's Encrypt получают через `certbot` — он умеет автоматически прописать нужные location-блоки в конфиг Nginx (`certbot --nginx`) и ставит задачу на автопродление, потому что сертификаты Let's Encrypt живут всего 90 дней и требуют регулярного обновления без ручного вмешательства. `try_files $uri /index.html` — аналог SPA fallback для GitHub Pages, но настроенный на уровне самого веб-сервера, а не через подмену `404.html`.

### Подводные камни
- Забыть `try_files $uri /index.html` в location-блоке — прямые ссылки на клиентские маршруты (`/profile`) дают честный 404 от Nginx, потому что файла `profile` на диске нет.
- Не настроить автопродление сертификата Let's Encrypt — через 90 дней сайт начинает показывать посетителям предупреждение о недоверенном сертификате.
- Проксировать `/api/` без `proxy_set_header Host` — бэкенд может получить неверный `Host`-заголовок и сломать логику, которая на него полагается (например, построение абсолютных ссылок).

### Что спросят дальше
- Чем деплой за собственным Nginx отличается по эксплуатационной нагрузке от managed-хостинга вроде Vercel или Netlify?
- Как добавить кэширующие заголовки в Nginx для статических ассетов с хэшем в имени файла?

### Ссылки
- [Nginx — Beginner's Guide](https://nginx.org/en/docs/beginners_guide.html)
- [Certbot — Instructions](https://certbot.eff.org/instructions)

# Как один WebSocket-middleware переиспользовать для разных лент данных?
@slug realtime-socket-middleware-reuse
@topic architecture
@verified react@19.3
@updated 2026-11

> Если в приложении две WebSocket-ленты (например, лента всех заказов и лента заказов текущего пользователя), не нужно писать Redux middleware на каждую — различается только URL, набор экшенов и обработчик сообщения, а логика подключения, переподключения и очистки одна и та же. Решение — middleware-**фабрика**: функция, принимающая конфиг (`connect`/`disconnect`/`closed`/`failed`-экшены, `getUrl`, `onMessage`) и возвращающая готовый middleware. Каждая лента вызывает фабрику со своим конфигом и получает независимый экземпляр сокета.

```ts
// socket-middleware.ts — фабрика, не привязанная к конкретной ленте
type TSocketMiddlewareOptions = {
  closed: ActionCreatorWithoutPayload;
  connect: ActionCreatorWithoutPayload;
  disconnect: ActionCreatorWithoutPayload;
  failed: PayloadActionCreator<string>;
  getUrl: () => string | null;
  onMessage: (data: unknown, dispatch: Dispatch) => void;
};

export const createSocketMiddleware =
  (options: TSocketMiddlewareOptions): Middleware =>
  (storeApi) => {
    let socket: WebSocket | null = null;
    let shouldReconnect = false;

    const openSocket = (): void => {
      const url = options.getUrl();
      if (!url) return storeApi.dispatch(options.failed('…'));
      socket = new WebSocket(url);
      socket.onmessage = (e) => options.onMessage(JSON.parse(e.data), storeApi.dispatch);
      socket.onclose = () => {
        if (!shouldReconnect) return;
        storeApi.dispatch(options.closed());
        setTimeout(() => storeApi.dispatch(options.connect()), 3000); // реконнект только если не отключались явно
      };
    };

    return (next) => (action) => {
      if (options.connect.match(action)) { shouldReconnect = true; openSocket(); }
      if (options.disconnect.match(action)) { shouldReconnect = false; socket?.close(); }
      return next(action);
    };
  };

// feed-middleware.ts и profile-orders-middleware.ts — два применения одной фабрики
export const feedMiddleware = createSocketMiddleware({
  connect: feedConnecting, disconnect: feedDisconnect, closed: feedClosed,
  failed: feedFailed, getUrl: () => `${WS_URL}/orders/all`, onMessage: handleFeedMessage,
});
export const profileOrdersMiddleware = createSocketMiddleware({
  connect: profileOrdersConnecting, disconnect: profileOrdersDisconnect, closed: profileOrdersClosed,
  failed: profileOrdersFailed, getUrl: () => `${WS_URL}/orders`, onMessage: handleProfileOrdersMessage,
});
```

Переподключение запускается только через `setTimeout`, если `shouldReconnect` ещё включён — это флаг, который выключается именно экшеном `disconnect`, а не просто обрывом соединения. Благодаря этому компонент, который вызывает `disconnect` при размонтировании (см. `useFeedConnection`), гарантированно не оставляет висящий таймер, который попытался бы переподключиться к уже ненужному сокету.

### Подводные камни
- Переподключаться при **любом** закрытии сокета, включая закрытие по явному `disconnect()` — без флага `shouldReconnect` приложение будет бесконечно переоткрывать соединение после ухода со страницы.
- Писать для каждой WebSocket-ленты отдельный middleware с почти идентичным кодом вместо одной параметризуемой фабрики — дублирование логики reconnect/cleanup, которую придётся чинить в нескольких местах при любом исправлении.
- Держать состояние `socket`/`shouldReconnect` в Redux-сторе, а не в закрытии (closure) самого middleware — WebSocket-инстанс не сериализуется и не должен лежать в сторе.

### Что спросят дальше
- Почему `getUrl()` — функция, а не строка, переданная в конфиг один раз?
- Как обработать экспоненциальный backoff вместо фиксированной паузы в 3 секунды перед реконнектом?

### Ссылки
- [react-burger-ts — socket-middleware.ts](https://github.com/kirillchistov/react-burger-ts/blob/main/src/services/socket/socket-middleware.ts)
- [Redux Toolkit — Writing Middleware](https://redux.js.org/usage/writing-logic-thunks)

# Зачем в RTK-слайсе назначать `uuid` через `prepare()`, если у ингредиента уже есть `_id`?
@slug rtk-per-domain-slices
@topic state
@verified react@19.3
@updated 2026-11

> В конструкторе бургера один и тот же ингредиент (например, «Соус Spicy-X») можно добавить несколько раз — у всех копий будет одинаковый `_id` с сервера. Если использовать `_id` как React `key` или как идентификатор для удаления/перестановки, все копии станут неразличимы: удаление одной уберёт первую найденную, а не именно ту, на которую нажал пользователь. Решение — `prepare()` в `createSlice`, который на **каждый** `addIngredient` генерирует новый `nanoid()` и кладёт его в `uuid` — это клиентский идентификатор конкретного экземпляра в конструкторе, не совпадающий с `_id` самого ингредиента.

```ts
export const burgerConstructorSlice = createSlice({
  name: 'burgerConstructor',
  initialState: { bun: null, ingredients: [] as TConstructorIngredient[] },
  reducers: {
    addIngredient: {
      reducer: (state, action: PayloadAction<TConstructorIngredient>) => {
        state.ingredients.push(action.payload); // bun обрабатывается отдельной веткой
      },
      // prepare превращает "сырой" TIngredient в TConstructorIngredient с уникальным uuid
      prepare: (ingredient: TIngredient) => ({ payload: { ...ingredient, uuid: nanoid() } }),
    },
    removeIngredient: (state, action: PayloadAction<string>) => {
      state.ingredients = state.ingredients.filter((i) => i.uuid !== action.payload); // по uuid, не по _id
    },
  },
  selectors: {
    // мемоизированный селектор: пересчитывается только если bun/ingredients реально изменились
    selectConstructorTotalPrice: createSelector(
      [(s) => s.bun, (s) => s.ingredients],
      (bun, ingredients) => (bun?.price ?? 0) * 2 + ingredients.reduce((sum, i) => sum + i.price, 0),
    ),
  },
});
```

`prepare()` — именно то место, где это решение должно жить: оно гарантирует, что `uuid` появится ровно один раз, в момент создания действия, а не будет случайно пересоздаваться или теряться где-то в UI-коде. Селектор общей стоимости через `createSelector` — отдельное, но связанное решение: без мемоизации пересчёт суммы на каждом рендере любого подписанного компонента был бы дешёвой, но бессмысленной работой при каждом action, не меняющем ни `bun`, ни `ingredients`.

### Подводные камни
- Использовать `_id` ингредиента как React `key` в списке начинок конструктора — при двух одинаковых ингредиентах React не сможет различить два DOM-узла и будет путать их состояние/анимации при перестановке.
- Генерировать `uuid` в компоненте перед диспатчем, а не в `prepare()` — переносит ответственность за уникальность идентификатора из единого места (слайса) в каждый вызывающий код, что легко забыть сделать правильно хотя бы один раз.
- Писать селектор суммы как обычную функцию в компоненте без `createSelector` — работает, но пересчитывает сумму на каждый render независимо от того, что именно изменилось в сторе.

### Что спросят дальше
- Чем `prepare()` отличается от обработки той же логики прямо внутри `reducer`?
- Почему `selectIngredientCounts` в этом слайсе возвращает `Record<string, number>`, а не просто массив?

### Ссылки
- [react-burger-ts — burger-constructor-slice.ts](https://github.com/kirillchistov/react-burger-ts/blob/main/src/services/burger-constructor/burger-constructor-slice.ts)
- [Redux Toolkit — createSlice prepare callback](https://redux-toolkit.js.org/api/createSlice#customizing-generated-action-creators)

# Почему drag-and-drop ингредиентов в конструктор бургера не делает сетевой запрос?
@slug dnd-optimistic-ingredient-add
@topic state
@verified react@19.3
@updated 2026-11

> В конструкторе бургера перетаскивание ингредиента в зону сборки выглядит как мгновенное действие — потому что это буквально так: `useDrop` на `drop` диспатчит `addIngredient` в Redux-стор синхронно, без единого обращения к серверу. Сервер вообще не знает о текущем составе бургера, пока пользователь не нажмёт «Оформить заказ» — тогда на сервер уходит только финальный список `_id` ингредиентов одним запросом. Это не недосмотр, а осознанная граница: сборка бургера — чисто клиентское состояние, а заказ — единственная операция, которая требует сети.

```tsx
const [{ draggedType, isOver }, dropRef] = useDrop<TIngredient, void, TConstructorDropCollected>({
  accept: [DND_TYPES.BUN, DND_TYPES.FILLING],
  collect: (monitor) => ({
    draggedType: monitor.getItemType(), // тип того, что тащат прямо сейчас
    isOver: monitor.isOver(),
  }),
  drop: (item) => {
    dispatch(addIngredient(item)); // синхронный диспатч, без await и без fetch
  },
});

// Подсветка нужного плейсхолдера зависит от типа того, что тащат, а не от факта наведения вообще
const isBunHovered = isOver && draggedType === DND_TYPES.BUN;
const isFillingHovered = isOver && draggedType === DND_TYPES.FILLING;
```

Разделение на «DnD + локальный state» и «один финальный API-запрос» снимает целый класс проблем: не нужно откатывать оптимистичное обновление при ошибке сети на каждое перетаскивание, не нужна дебаунс-синхронизация состава с сервером при быстрой серии перетаскиваний, а `useDrop`/`collect` отвечают только за то, что действительно требует немедленной обратной связи — какой именно плейсхолдер подсветить под то, что сейчас держит пользователь.

### Подводные камни
- Пытаться синхронизировать состав конструктора с сервером на каждое `addIngredient` «на всякий случай» — добавляет сетевые ошибки и состояния загрузки туда, где они просто не нужны пользователю.
- Подсвечивать один и тот же плейсхолдер независимо от `draggedType` — тогда зона для начинки будет подсвечиваться, даже когда пользователь тащит булку, что сбивает с толку.
- Возвращать из `collect` объект с новой ссылкой при каждом рендере дроп-зоны без привязки к реальному изменению — провоцирует лишние ререндеры компонента на каждое движение мыши над зоной.

### Что спросят дальше
- Что изменится, если бы состав конструктора должен был сохраняться между перезагрузками страницы?
- Как `useDrop`/`useDrag` из `react-dnd` взаимодействуют с клавиатурной (не мышиной) перестановкой ингредиентов?

### Ссылки
- [react-burger-ts — burger-constructor.tsx](https://github.com/kirillchistov/react-burger-ts/blob/main/src/components/burger-constructor/burger-constructor.tsx)
- [react-dnd — useDrop](https://react-dnd.github.io/react-dnd/docs/api/use-drop)
