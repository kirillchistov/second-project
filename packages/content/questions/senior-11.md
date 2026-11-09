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
