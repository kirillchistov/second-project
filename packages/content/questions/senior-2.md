# Как работает useOptimistic?
@slug use-optimistic
@topic modern

> `useOptimistic(state, updateFn)` показывает временное «оптимистичное» состояние, пока выполняется Action. Как только действие завершается (успешно или с ошибкой), оптимистичное значение отбрасывается и UI возвращается к реальному `state` — откат при ошибке происходит автоматически. Используется для лайков, отправки сообщений, переключателей.

```tsx
function Messages({ messages, send }: { messages: Message[]; send: (text: string) => Promise<void> }) {
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (current, text: string) => [...current, { id: crypto.randomUUID(), text, pending: true }],
  );

  async function action(formData: FormData) {
    const text = String(formData.get('text'));
    addOptimistic(text);          // сразу показываем сообщение
    await send(text);             // реальное обновление messages придёт от родителя
  }

  return (
    <>
      {optimistic.map((m) => (
        <p key={m.id} style={{ opacity: m.pending ? 0.5 : 1 }}>{m.text}</p>
      ))}
      <form action={action}>
        <input name="text" />
      </form>
    </>
  );
}
```

Ключевые моменты:

- `addOptimistic` вызывается **внутри Action** или `startTransition` — вне transition React выдаст предупреждение.
- Оптимистичное состояние живёт, только пока действие в процессе. После завершения React показывает то, что пришло в `state` (из props, кэша или серверного ответа).
- При ошибке откат автоматический, но сообщить пользователю об ошибке нужно самим (Error Boundary или state ошибки).

Сравнение с TanStack Query: там оптимистичные обновления делаются через `onMutate` с ручным снимком и откатом в `onError`, либо через `variables` мутации. `useOptimistic` проще, но работает только с моделью Actions.

### Подводные камни
- Использовать `useOptimistic` для данных, которые после успеха не обновляются из источника — значение «откатится» к старому.

### Что спросят дальше
- Как сделать оптимистичное обновление в TanStack Query?
- Что если сервер вернул данные, отличные от оптимистичных?

### Ссылки
- [useOptimistic — reference](https://react.dev/reference/react/useOptimistic)

# Что такое хук use и чем он отличается от остальных хуков?
@slug use-hook
@topic modern

> `use(resource)` читает значение промиса или контекста во время рендера. С промисом компонент приостанавливается (Suspense) до разрешения, а при отклонении ошибка уходит в Error Boundary. В отличие от других хуков, `use` можно вызывать в условиях и циклах. Главное ограничение: промис должен приходить извне и быть стабильным (из Server Component, кэша или библиотеки), а не создаваться в рендере.

```tsx
// Server Component создаёт промис, но не ждёт его
async function Page({ id }: { id: string }) {
  const commentsPromise = getComments(id);   // запрос стартует сразу
  const post = await getPost(id);
  return (
    <>
      <Post post={post} />
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments commentsPromise={commentsPromise} />
      </Suspense>
    </>
  );
}

// Client Component читает промис
'use client';
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);
  return comments.map((c) => <p key={c.id}>{c.text}</p>);
}

// Условное чтение контекста — с useContext так нельзя
function Heading({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  const theme = use(ThemeContext);
  return <h1 className={theme}>{children}</h1>;
}
```

Почему промис нельзя создавать в Client Component: при каждом рендере (в том числе повторном после приостановки) создавался бы новый промис — бесконечный цикл загрузки. React выведет предупреждение «uncached promise».

`use` не вызывается в `try/catch` — ошибки обрабатываются Error Boundary или `promise.catch(...)` с запасным значением.

### Подводные камни
- `use(fetch(url))` в клиентском компоненте — бесконечная загрузка.
- Ожидать, что `use` заменит библиотеку данных: кэширование, инвалидация и повторы остаются задачей фреймворка или библиотеки.

### Что спросят дальше
- Почему `use` можно вызывать условно?
- Как передать промис из Server Component в Client Component?

### Ссылки
- [use — reference](https://react.dev/reference/react/use)

# Что такое React Server Components?
@slug server-components
@topic server

> Server Components — компоненты, которые выполняются только на сервере (или при сборке) и не отправляют свой код в браузер. Они могут быть `async`, напрямую обращаться к БД и файловой системе, а результат передаётся клиенту в сериализованном виде (RSC payload). Интерактивные части помечаются директивой `'use client'` — это граница, за которой код становится клиентским и гидрируется как обычно.

```tsx
// app/products/page.tsx — Server Component по умолчанию
import { db } from '@/lib/db';
import { AddToCart } from './AddToCart';

export default async function ProductsPage() {
  const products = await db.product.findMany();     // без API-слоя и useEffect
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>
          {p.name} — {p.price} ₽
          <AddToCart productId={p.id} />            {/* клиентский остров */}
        </li>
      ))}
    </ul>
  );
}

// AddToCart.tsx
'use client';
export function AddToCart({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(() => addToCart(productId))}>В корзину</button>;
}
```

Что важно понимать:

- **RSC ≠ SSR.** SSR превращает компоненты в HTML для первой загрузки и затем гидрирует всё. RSC — модель, где часть дерева вообще не попадает на клиент; RSC payload используется и при навигации без перезагрузки. Обычно используются вместе.
- **`'use client'` помечает модуль-границу**, а не «только этот компонент»: всё, что он импортирует, тоже становится клиентским.
- **Через границу передаются только сериализуемые props**: примитивы, простые объекты, массивы, Date, Map/Set, промисы, JSX, Server Functions. Обычные функции и классы — нельзя.
- **Server Component можно передать в Client Component как `children`** — так серверный контент оказывается внутри клиентской обёртки.
- В Server Components нет state, эффектов и обработчиков событий.

Где используется: Next.js App Router, React Router (экспериментально), Waku, Parcel; RSC — фича React, но требует интеграции с бандлером и роутером.

### Подводные камни
- Ставить `'use client'` в корне дерева «чтобы работало» — весь код уходит в клиентский бандл.
- Импортировать серверные модули с секретами в клиентский — используйте пакет `server-only`.

### Что спросят дальше
- Чем RSC отличаются от SSR?
- Что можно передавать через границу server/client?
- Как кэшировать данные в Server Components?

### Ссылки
- [Server Components — reference](https://react.dev/reference/rsc/server-components)
- ['use client' — reference](https://react.dev/reference/rsc/use-client)

# Что такое Server Functions и как их защищать?
@slug server-functions
@topic server

> Server Functions (функции с директивой `'use server'`) вызываются с клиента как обычные асинхронные функции, а фреймворк превращает вызов в POST-запрос к серверу. Это удобно для мутаций в формах и Actions. Но по сути каждая такая функция — публичный HTTP-эндпоинт: её аргументы нужно валидировать, а аутентификацию и авторизацию проверять внутри, как в любом API.

```tsx
// actions.ts
'use server';

import { z } from 'zod';

const schema = z.object({ postId: z.uuid(), text: z.string().min(1).max(2000) });

export async function addComment(_prev: unknown, formData: FormData) {
  const session = await auth();                       // 1. кто вызывает
  if (!session) return { error: 'Нужно войти' };

  const parsed = schema.safeParse(Object.fromEntries(formData));  // 2. валидация входа
  if (!parsed.success) return { error: 'Некорректные данные' };

  const post = await db.post.find(parsed.data.postId);
  if (!canComment(session.user, post)) return { error: 'Нет доступа' };  // 3. авторизация

  await db.comment.create({ ...parsed.data, authorId: session.user.id });
  revalidatePath(`/posts/${post.id}`);                // 4. обновить кэш
  return { error: null };
}
```

Риски и защита:

- **Доверие к аргументам.** TypeScript-типы на сервере не проверяются в рантайме — нужен Zod/Valibot.
- **Утечки через замыкания.** Функция, объявленная внутри Server Component, может захватить переменные — фреймворки шифруют их, но лучше не замыкать секреты.
- **Возвращаемые данные** уходят клиенту — не возвращать лишние поля (хэши, внутренние id).
- **CSRF** — фреймворки обычно проверяют Origin для Server Actions; при собственной инфраструктуре это ваша задача.
- **Rate limiting** и логирование — как у любого эндпоинта.

Термин: ранее все такие функции назывались Server Actions; сейчас общее название — Server Functions, а Server Action — Server Function, переданная в `action` формы или вызванная в transition.

### Подводные камни
- Проверять права только в UI (скрытая кнопка), а не в функции — её можно вызвать напрямую.
- Использовать Server Functions для загрузки данных — они выполняются последовательно и предназначены для мутаций.

### Что спросят дальше
- Почему Server Functions выполняются последовательно?
- Как работает прогрессивное улучшение форм?

### Ссылки
- [Server Functions — reference](https://react.dev/reference/rsc/server-functions)
- ['use server' — reference](https://react.dev/reference/rsc/use-server)

# Как работают стриминговый SSR и выборочная гидрация?
@slug streaming-ssr
@topic server

> Стриминговый SSR (`renderToPipeableStream` в Node, `renderToReadableStream` в Web Streams) отправляет HTML по частям: сначала оболочку страницы с fallback-ами Suspense-границ, затем — HTML готовых границ вместе с маленькими инлайн-скриптами, которые вставляют его на место. Выборочная гидрация позволяет гидрировать части независимо и в первую очередь ту, с которой пользователь начал взаимодействовать.

```tsx
// server.ts (Node)
import { renderToPipeableStream } from 'react-dom/server';

app.get('*', (req, res) => {
  const { pipe, abort } = renderToPipeableStream(<App url={req.url} />, {
    bootstrapScripts: ['/assets/client.js'],
    onShellReady() {                 // оболочка готова — начинаем отдавать
      res.setHeader('content-type', 'text/html');
      pipe(res);
    },
    onShellError() {
      res.status(500).send('<h1>Ошибка</h1>');
    },
    onError(err) {
      logger.error(err);
    },
  });
  setTimeout(abort, 10_000);         // не держать соединение бесконечно
});

// client.tsx
hydrateRoot(document, <App url={location.pathname} />);
```

Что даёт стриминг по сравнению с классическим `renderToString`:

- **TTFB не ждёт самых медленных данных** — оболочка уходит сразу.
- **Не нужно ждать весь JS для гидрации**: границы гидрируются по мере загрузки кода.
- **Приоритет взаимодействия**: если пользователь кликнул по ещё не гидрированной части, React гидрирует её раньше остальных и воспроизведёт событие.

Ограничения: статус-код и заголовки отправляются до того, как известно содержимое отложенных частей; для SEO-ботов можно ждать `onAllReady`. В React 19 есть `prerender` / `prerenderToNodeStream` для статической генерации с ожиданием данных, а в 19.2 — частичный пререндер (`resume`).

### Подводные камни
- Ошибка в Suspense-границе при стриминге не ломает страницу: React отправит fallback и попробует отрендерить на клиенте — но о ней нужно узнать через `onError`.

### Что спросят дальше
- Что такое Partial Prerendering?
- Почему статус-код нельзя поменять после начала стрима?

### Ссылки
- [renderToPipeableStream — reference](https://react.dev/reference/react-dom/server/renderToPipeableStream)
- [hydrateRoot — reference](https://react.dev/reference/react-dom/client/hydrateRoot)

# Почему возникают ошибки гидрации и как их исправлять?
@slug hydration-mismatch
@topic server

> Ошибка гидрации (hydration mismatch) — HTML, отрендеренный на сервере, не совпадает с тем, что React получил при первом рендере на клиенте. Типичные причины: значения, разные на сервере и клиенте (`Date.now()`, `Math.random()`, локаль и часовой пояс), проверки `typeof window`, данные из `localStorage`, невалидная вложенность HTML (`<div>` внутри `<p>`), расширения браузера, меняющие DOM. React перерисует дерево на клиенте до ближайшей Suspense-границы — это дорого и может мигать.

```tsx
// Плохо: разный результат на сервере и клиенте
function Greeting() {
  const hour = new Date().getHours();
  return <p>{hour < 12 ? 'Доброе утро' : 'Добрый день'}</p>;
}

// Решение 1: клиентское значение — после монтирования
function useIsClient() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}
function Greeting() {
  const isClient = useIsClient();
  if (!isClient) return <p>Здравствуйте</p>;
  return <p>{new Date().getHours() < 12 ? 'Доброе утро' : 'Добрый день'}</p>;
}

// Решение 2: заведомо разный текст (таймстемп) — подавить предупреждение точечно
<time suppressHydrationWarning>{new Date().toLocaleTimeString()}</time>
```

Другие подходы:

- передавать «время запроса» и часовой пояс с сервера в props, чтобы оба рендера использовали одно значение;
- тему и подобные настройки хранить в cookie, а не в `localStorage`, чтобы сервер знал их заранее; либо выставлять класс на `<html>` инлайн-скриптом до гидрации;
- клиентские виджеты (карты, редакторы) рендерить только на клиенте (`dynamic(..., { ssr: false })` в Next.js или после монтирования).

React 19 показывает одно сообщение с диффом вместо нескольких, что сильно упрощает поиск причины.

### Подводные камни
- `suppressHydrationWarning` работает только на один уровень и только для текста/атрибутов — это не способ «замолчать» реальную ошибку.
- `typeof window !== 'undefined'` в рендере — частая причина рассинхронизации.

### Что спросят дальше
- Как реализовать тёмную тему без мигания при SSR?
- Что делает React при mismatch?

### Ссылки
- [hydrateRoot — handling different client and server content](https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content)

# Что такое компонент Activity?
@slug activity
@topic modern

> `<Activity mode="visible" | "hidden">` (стабилен с React 19.2) скрывает часть UI, сохраняя её состояние и DOM. В режиме `hidden` содержимое скрывается через `display: none`, эффекты размонтируются (подписки останавливаются), а обновления обрабатываются с самым низким приоритетом. При возврате в `visible` состояние восстанавливается мгновенно, а эффекты запускаются снова. Это замена «условному рендерингу», если нужно сохранить состояние, и способ заранее подготовить экран, на который пользователь, вероятно, перейдёт.

```tsx
function Tabs({ active }: { active: 'home' | 'inbox' }) {
  return (
    <>
      <Activity mode={active === 'home' ? 'visible' : 'hidden'}>
        <Home />
      </Activity>
      <Activity mode={active === 'inbox' ? 'visible' : 'hidden'}>
        <Inbox />          {/* сохраняет скролл, черновики, загруженные данные */}
      </Activity>
    </>
  );
}
```

Сравнение вариантов скрытия:

| Способ | State | DOM | Эффекты | Стоимость |
|---|---|---|---|---|
| `{cond && <X />}` | теряется | удаляется | размонтируются | дешево, но заново при показе |
| CSS `display: none` | сохраняется | сохраняется | продолжают работать | подписки и таймеры работают зря |
| `<Activity hidden>` | сохраняется | сохраняется | размонтируются | рендер с низким приоритетом |

Применения: вкладки и боковые панели, сохранение черновиков, предзагрузка следующего экрана в фоне (рендер `hidden` заранее подгружает данные и код через Suspense), back/forward навигация.

### Подводные камни
- Эффекты скрытых компонентов отключаются — если логика должна работать в фоне (например, плеер), её нужно вынести выше.
- Скрытые деревья занимают память; держать в Activity десятки тяжёлых экранов не стоит.

### Что спросят дальше
- Чем Activity отличается от display: none?
- Как Activity помогает предзагрузке?

### Ссылки
- [Activity — reference](https://react.dev/reference/react/Activity)
- [React 19.2 — blog](https://react.dev/blog/2025/10/01/react-19-2)

# Какую проблему решает useEffectEvent?
@slug use-effect-event
@topic hooks

> Иногда эффект должен реагировать на изменение одних значений (например, `roomId` — переподключиться), но лишь читать актуальные значения других (`theme` — для уведомления), не перезапускаясь из-за них. `useEffectEvent` (стабилен с React 19.2) создаёт функцию-«событие эффекта»: она всегда видит последние props и state, но не является реактивной зависимостью. Раньше для этого использовали паттерн с `useRef` и «latest value».

```tsx
function ChatRoom({ roomId, theme }: { roomId: string; theme: Theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Подключено!', theme);    // всегда актуальная тема
  });

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', () => onConnected());
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);   // theme не в зависимостях — смена темы не переподключает чат
}
```

Правила:

- вызывать функцию-событие **только внутри эффектов** (и функций, вызываемых из них), а не в рендере и не в обработчиках;
- **не передавать** её в другие компоненты и хуки;
- **не добавлять** в массив зависимостей — линтер это знает.

Это инструмент для разделения «реактивной» и «нереактивной» логики, а не способ обойти линтер. Если всё, что вы хотите, — убрать зависимость, сначала проверьте, нужна ли она вообще.

### Подводные камни
- Оборачивать в `useEffectEvent` весь код эффекта, чтобы избавиться от зависимостей, — эффект перестанет синхронизироваться с реальными изменениями.

### Что спросят дальше
- Как это решали до useEffectEvent?
- Чем событие эффекта отличается от useCallback?

### Ссылки
- [useEffectEvent — reference](https://react.dev/reference/react/useEffectEvent)
- [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects)

# Как избежать водопадов запросов и кэшировать данные?
@slug data-waterfalls
@topic performance

> Водопад — цепочка последовательных запросов, где каждый ждёт предыдущего, хотя мог бы стартовать сразу. Типичная причина — загрузка внутри компонентов: дети начинают грузить данные только после того, как родитель загрузил свои и отрендерился. Решения: начинать загрузку раньше рендера (loaders роутера, prefetch, Server Components), запускать независимые запросы параллельно, поднимать запросы выше и дедуплицировать через кэш.

```tsx
// Водопад: Posts начнёт загрузку только после загрузки user
function Profile({ id }: { id: string }) {
  const { data: user } = useQuery({ queryKey: ['user', id], queryFn: () => getUser(id) });
  if (!user) return <Spinner />;
  return <Posts userId={user.id} />;
}

// Параллельно: оба запроса стартуют одновременно
const [user, posts] = useQueries({
  queries: [
    { queryKey: ['user', id], queryFn: () => getUser(id) },
    { queryKey: ['posts', id], queryFn: () => getPosts(id) },
  ],
});

// В Server Components: старт без await, ожидание — вместе
async function ProfilePage({ id }: { id: string }) {
  const userPromise = getUser(id);
  const postsPromise = getPosts(id);
  const [user, posts] = await Promise.all([userPromise, postsPromise]);
  // ...
}

// Дедупликация в рамках запроса на сервере
import { cache } from 'react';
export const getUser = cache(async (id: string) => db.user.find(id));
```

Другие приёмы:

- **Render-as-you-fetch**: запрос стартует при навигации (в loader или обработчике клика), а компонент читает уже летящий промис через Suspense.
- **Prefetch по наведению** на ссылку — `queryClient.prefetchQuery`.
- **Ресурсные подсказки** (`preload`, `preconnect`) для критичных файлов.
- **Агрегация на бэкенде** (BFF, GraphQL), если клиенту нужно 10 запросов для одного экрана.

`cache()` из React дедуплицирует вызовы в рамках одного серверного рендера (не между запросами); для кэша между запросами используют механизмы фреймворка.

### Подводные камни
- Последовательные `await` в Server Component, когда запросы независимы.
- Вложенные Suspense-границы с собственной загрузкой в каждой — водопад «по слоям».

### Что спросят дальше
- Что такое render-as-you-fetch?
- Чем `cache` отличается от кэша TanStack Query?

### Ссылки
- [cache — reference](https://react.dev/reference/react/cache)
- [TanStack Query — Request Waterfalls](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls)

# Как системно улучшать производительность React-приложения?
@slug performance-methodology
@topic performance
@legacy 48

> Сначала измерить, потом оптимизировать. Определить метрику (INP, LCP, время конкретного взаимодействия), воспроизвести на слабом устройстве, найти узкое место профайлером и только затем выбирать инструмент. Типичные источники проблем: большой JS-бандл, лишние рендеры больших поддеревьев, тяжёлые вычисления в рендере, длинные списки, водопады запросов, layout thrashing.

Методика:

1. **Полевые данные.** Web Vitals из реальных пользователей (RUM: `web-vitals`, Sentry, Vercel Analytics) — где и у кого медленно.
2. **Воспроизведение.** Production-сборка, CPU throttling 4–6x, медленная сеть.
3. **Профилирование.** Chrome Performance (long tasks, треки React), React Profiler (какие компоненты и почему рендерятся), Lighthouse, анализ бандла (`rollup-plugin-visualizer`, `source-map-explorer`).
4. **Исправление** по категории проблемы.
5. **Проверка эффекта** теми же измерениями и защита от регресса (бюджеты размера бандла в CI, performance-тесты).

Инструменты по категориям:

| Проблема | Решения |
|---|---|
| Большой бандл | code splitting (`lazy`, роуты), tree-shaking, замена тяжёлых библиотек, Server Components |
| Лишние рендеры | state ниже, композиция через `children`, `memo`, React Compiler, селекторы в сторах |
| Тяжёлый рендер | `useTransition`, `useDeferredValue`, мемоизация вычислений, Web Worker |
| Длинные списки | виртуализация, пагинация, `content-visibility` |
| Загрузка данных | параллельные запросы, prefetch, кэш, стриминг SSR |
| Медиа | `loading="lazy"`, правильные размеры, AVIF/WebP, `fetchpriority="high"` для LCP-картинки |

Оптимизации из старой версии вопроса (`shouldComponentUpdate`, `PureComponent`, `React.memo`) по-прежнему работают, но это лишь одна категория из многих — и часто не главная.

### Подводные камни
- Оптимизировать на глаз без измерений.
- Измерять в dev-режиме — StrictMode и отладочные проверки искажают картину.

### Что спросят дальше
- Как найти, что вызывает плохой INP?
- Как установить бюджет производительности в CI?

### Ссылки
- [Profiler — reference](https://react.dev/reference/react/Profiler)
- [React Performance Tracks](https://react.dev/reference/dev-tools/react-performance-tracks)
- [web.dev — Core Web Vitals](https://web.dev/articles/vitals)
