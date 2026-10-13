# Как управлять фокусом в SPA: модалки, роутинг, динамический контент?
@slug focus-management
@topic quality
@updated 2026-10

> В SPA браузер не сбрасывает фокус при переходах, а модалки и выпадающие меню появляются поверх страницы. Поэтому фокусом управляет разработчик. Модалка ставит фокус внутрь при открытии, удерживает его там и возвращает на кнопку-открывателя при закрытии. После смены маршрута фокус переносят на заголовок новой страницы. Динамические сообщения объявляют через `aria-live`.

```tsx
// Нативный <dialog> с showModal(): фокус внутрь, Esc, inert-фон и возврат фокуса — из коробки
function ConfirmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="confirm-title">
      <h2 id="confirm-title">Удалить проект?</h2>
      <button autoFocus onClick={onClose}>Отмена</button>
    </dialog>
  );
}

// После навигации — фокус на заголовок страницы, чтобы скринридер прочитал, где мы
function PageTitle({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return <h1 ref={ref} tabIndex={-1}>{children}</h1>;
}
```

Инструменты:

- **`<dialog>` + `showModal()`** вместо самописных модалок: ловушка фокуса, `Esc` и недоступный фон уже реализованы браузером.
- **Атрибут `inert`** делает часть страницы недоступной для фокуса и скринридера. Он нужен для боковых панелей и своих оверлеев.
- **`tabIndex={-1}`** позволяет программно сфокусировать неинтерактивный элемент, не добавляя его в порядок Tab. Положительные `tabIndex` ломают естественный порядок.
- **`:focus-visible`** показывает кольцо фокуса только при работе с клавиатуры. `outline: none` без замены делает сайт непригодным для клавиатуры.
- **Roving tabindex** для составных виджетов (меню, табы, тулбары): Tab попадает в виджет один раз, стрелки двигают фокус внутри.

### Подводные камни
- Если удалить сфокусированный элемент из DOM (например, закрыть пункт списка), фокус «улетает» в `body`. Нужно явно перевести его на соседний элемент.
- Самописная модалка без ловушки фокуса даёт уйти табом на страницу под ней.

### Что спросят дальше
- Как реализовать roving tabindex в меню?
- Как сообщить скринридеру об успешном сохранении без переноса фокуса?

### Ссылки
- [MDN: <dialog>](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
- [WAI-ARIA APG: Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

# Что такое CSRF и как от него защищаются?
@slug csrf
@topic quality
@updated 2026-10

> CSRF (Cross-Site Request Forgery) — атака, при которой чужой сайт заставляет браузер жертвы отправить запрос на ваш сайт. Браузер сам прикрепляет cookies, и сервер видит «настоящего» пользователя. Атакующий не читает ответ, но может выполнить действие: перевод, смену email. Защита строится в несколько слоёв: `SameSite` cookies, проверка `Origin`, CSRF-токен для форм на cookie-сессии и никаких изменений состояния через `GET`.

```html
<!-- Страница атакующего: форма отправится на bank.example с cookies жертвы -->
<form action="https://bank.example/transfer" method="POST">
  <input type="hidden" name="to" value="attacker" />
  <input type="hidden" name="amount" value="1000" />
</form>
<script>document.forms[0].submit()</script>
```

```ts
// Сервер: отклоняем изменяющие запросы с чужого Origin
app.use(async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin !== 'https://bank.example') return c.text('Forbidden', 403);
  }
  await next();
});
```

Слои защиты:

1. **`SameSite=Lax`** (по умолчанию в современных браузерах) не отправляет cookie с кросс-сайтовыми `POST`. `Strict` строже, но ломает переход по внешней ссылке в залогиненном виде.
2. **Проверка `Origin` / `Sec-Fetch-Site`** на сервере для всех изменяющих запросов.
3. **CSRF-токен** (synchronizer token или double-submit cookie) — случайное значение в форме или заголовке, которое чужой сайт не может узнать.
4. **Только безопасные `GET`.** Действие по `GET /delete?id=1` выполнит даже тег `<img>`.
5. **Server Actions во фреймворках** проверяют Origin сами, но кастомные Route Handlers защищайте явно.

### Подводные камни
- CORS не защищает от CSRF: запрос всё равно уходит и выполняется, CORS лишь не даёт прочитать ответ.
- Токен в `Authorization`-заголовке (а не в cookie) к CSRF не уязвим, но уязвим к краже при XSS. Это другой компромисс, а не «лучше».

### Что спросят дальше
- Чем `SameSite=Lax` отличается от `Strict` на практике?
- Почему для API на Bearer-токенах CSRF-токен не нужен?

### Ссылки
- [OWASP: CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value)

# Как мониторить фронтенд в продакшене?
@slug frontend-monitoring
@topic quality
@updated 2026-10

> Мониторинг фронтенда отвечает на два вопроса: что сломалось у пользователей и насколько быстро работает приложение у них, а не на ноутбуке разработчика. Ошибки собирают глобальными обработчиками и Error Boundary в сервис вроде Sentry, с source maps и контекстом: версия релиза, маршрут, действия перед ошибкой. Производительность измеряют RUM-метриками Core Web Vitals (`web-vitals`). На всё это настраивают алерты по росту ошибок после деплоя.

```tsx
// React 19: корневые колбэки ловят ошибки, в том числе пойманные Error Boundary
createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => report(error, { componentStack: info.componentStack }),
  onCaughtError: (error, info) => report(error, { componentStack: info.componentStack, handled: true }),
}).render(<App />);

// Ошибки вне React
window.addEventListener('unhandledrejection', (e) => report(e.reason));

// RUM: реальные метрики пользователей
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

Что важно настроить:

- **Source maps** загружают в сервис мониторинга при сборке, но не публикуют рядом с бандлом. Без них стектрейс — это `a.b is not a function` в `index-3f9a.js:1:48213`.
- **Release и environment** у каждого события: сразу видно, какой деплой принёс ошибку.
- **Breadcrumbs и контекст**: маршрут, последние клики и запросы, id пользователя без персональных данных.
- **Группировка и шум**: ошибки расширений браузера и ботов фильтруют, иначе важное тонет.
- **Алерты** по новым ошибкам и росту частоты после релиза, а не по каждому событию.
- **Перцентили, а не средние**: p75 по Web Vitals — так считает Google, длинный хвост видно по p95.

### Подводные камни
- Логирование персональных данных (email, токены в URL) в сервис мониторинга нарушает приватность и законы о данных.
- Error Boundary без отправки отчёта превращает ошибку в тихий «пустой экран», о котором команда не узнает.

### Что спросят дальше
- Как связать ошибку на фронтенде с запросом на бэкенде (trace id)?
- Чем лабораторные метрики (Lighthouse) отличаются от полевых (RUM)?

### Ссылки
- [React: createRoot options](https://react.dev/reference/react-dom/client/createRoot#parameters)
- [web.dev: Web Vitals](https://web.dev/articles/vitals)

# Как анимировать переходы с помощью ViewTransition?
@slug view-transition
@topic modern
@verified react@19.3
@updated 2026-10

> `<ViewTransition>` (стабилен с React 19.3) анимирует появление, исчезновение, перемещение и изменение элементов через браузерный View Transition API. Анимация запускается только для обновлений-переходов: `startTransition`, раскрытие `<Suspense>`, обновление из `useDeferredValue`. Срочные обновления, например ввод в поле, не анимируются. По умолчанию это cross-fade. Тип анимации задают пропсами `enter`, `exit`, `update`, `share` и CSS-классами.

```tsx
import { ViewTransition, startTransition, addTransitionType } from 'react';

function Slides() {
  const [index, setIndex] = useState(0);
  const go = (dir: 'next' | 'previous') =>
    startTransition(() => {
      addTransitionType(dir);                       // причина перехода → выбор анимации
      setIndex((i) => i + (dir === 'next' ? 1 : -1));
    });

  return (
    <ViewTransition
      key={index}
      enter={{ next: 'from-right', previous: 'from-left' }}
      exit={{ next: 'to-left', previous: 'to-right' }}
    >
      <Slide index={index} />
    </ViewTransition>
  );
}

// Анимировать смену fallback на контент, но не анимировать то, что уже в кэше
<ViewTransition update="auto" default="none">
  <Suspense fallback={<Skeleton />}>
    <Product id={id} />
  </Suspense>
</ViewTransition>
```

Четыре типа анимации:

- **enter** — `<ViewTransition>` появился в дереве.
- **exit** — `<ViewTransition>` удалён.
- **update** — изменились стили или содержимое его детей.
- **share** — `<ViewTransition>` с одинаковым `name` исчез в одном месте и появился в другом: shared element переход «карточка → детальная страница».

Как это настраивают:

- **CSS-классы.** Значение пропса — имя класса для псевдоэлементов `::view-transition-old/new(.class)`.
- **`addTransitionType`.** Одно и то же изменение состояния может анимироваться по-разному в зависимости от причины. Тип доступен и в CSS через `:active-view-transition-type()`.
- **Колбэки** `onEnter`, `onExit`, `onUpdate`, `onShare` для анимаций через Web Animations API.

### Подводные камни
- Обновление вне transition (обычный `setState` в обработчике) не анимируется — частая причина «ничего не работает».
- Пока работает только в DOM: React Native и другие рендереры поддерживаются в процессе. Пользователям с `prefers-reduced-motion` анимации нужно отключать.

### Что спросят дальше
- Почему View Transitions привязаны к transitions, а не к любым обновлениям?
- Как сделать shared element переход между списком и детальной страницей?

### Ссылки
- [React: ViewTransition](https://react.dev/reference/react/ViewTransition)
- [React 19.3](https://react.dev/blog/2026/09/09/react-19-3)

# Что такое Fragment refs и когда они заменяют обёрточный div?
@slug fragment-refs
@topic modern
@verified react@19.3
@updated 2026-10

> С React 19.3 `<Fragment>` принимает `ref` и отдаёт `FragmentInstance` — объект, который работает с DOM-детьми фрагмента как с группой. Через него можно навесить обработчик событий, наблюдать видимость или размер (`observeUsing`), сфокусировать первый или последний фокусируемый элемент, измерить и прокрутить. Раньше для этого добавляли лишний `<div>`, который ломал вёрстку (flex, grid, таблицы) и семантику.

```tsx
// Отслеживание видимости группы элементов без обёртки
function InView({ onChange, children }: { onChange: (visible: boolean) => void; children: React.ReactNode }) {
  const ref = useRef<FragmentInstance>(null);
  useLayoutEffect(() => {
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      onChange(visible.size > 0);
    });
    const fragment = ref.current!;
    fragment.observeUsing(observer);
    return () => fragment.unobserveUsing(observer);
  }, [onChange]);
  return <Fragment ref={ref}>{children}</Fragment>;
}
```

Методы `FragmentInstance`:

- **События**: `addEventListener`, `removeEventListener`, `dispatchEvent` — для детей первого уровня.
- **Фокус**: `focus()` и `focusLast()` ищут первый или последний фокусируемый элемент в глубину, `blur()`.
- **Наблюдатели**: `observeUsing` и `unobserveUsing` подключают `IntersectionObserver` или `ResizeObserver` ко всем детям.
- **Измерения и прокрутка**: `getClientRects`, `getRootNode`, `compareDocumentPosition`, `scrollIntoView`.

Когда полезно:

- компонент не имеет одного корневого DOM-элемента (возвращает список или фрагмент);
- дети — чужие компоненты, которые не принимают `ref`;
- обёртка ломает раскладку: строки таблицы, элементы grid, пункты списка `<li>`.

### Подводные камни
- Методы работают с детьми первого уровня (кроме фокуса): вложенные элементы глубже не получают обработчик напрямую.
- Это DOM-возможность: на сервере и в React Native методов нет, поэтому вызывайте их в эффектах.

### Что спросят дальше
- Чем Fragment ref отличается от ref, переданного как проп в React 19?
- Как с помощью `focus()` фрагмента реализовать возврат фокуса в группу?

### Ссылки
- [React: Fragment](https://react.dev/reference/react/Fragment)
- [React 19.3](https://react.dev/blog/2026/09/09/react-19-3)

# Как устроен App Router в Next.js: файлы-соглашения и маршруты?
@slug app-router-conventions
@topic server
@verified next@16
@updated 2026-10

> В App Router маршрут — это папка в `app/`, а поведение задают специальные файлы. `page.tsx` — содержимое маршрута. `layout.tsx` — общая обёртка, которая сохраняется при навигации между дочерними страницами. `loading.tsx` — Suspense-граница. `error.tsx` — Error Boundary. `not-found.tsx` — 404. `route.ts` — HTTP-обработчик API. Все компоненты по умолчанию серверные, `'use client'` нужен только для интерактивных частей.

```text
app/
  layout.tsx                  ← корневой: <html>, <body>, провайдеры
  (marketing)/page.tsx        ← группа маршрутов: скобки не попадают в URL → «/»
  dashboard/
    layout.tsx                ← сайдбар, не перемонтируется между страницами
    loading.tsx               ← <Suspense fallback> для page
    error.tsx                 ← 'use client', получает error и reset
    page.tsx                  ← /dashboard
    [projectId]/page.tsx      ← /dashboard/42
  api/health/route.ts         ← GET /api/health
```

```tsx
// app/dashboard/[projectId]/page.tsx — params и searchParams асинхронные (Next.js 15+)
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);         // запрос прямо в Server Component
  if (!project) notFound();
  return <ProjectView project={project} />;
}

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return { title: (await getProject(projectId))?.name };
}
```

Что ещё спрашивают:

- **Динамические сегменты**: `[id]`, catch-all `[...slug]`, необязательный `[[...slug]]`.
- **Параллельные маршруты** `@modal` и **перехватывающие** `(.)photo/[id]` — модалка поверх ленты с собственным URL.
- **`template.tsx`** — как layout, но перемонтируется при каждой навигации.
- **Навигация**: `<Link>` с предзагрузкой, `useRouter` в клиентских компонентах, `redirect` и `notFound` на сервере.
- **Изменение данных** — Server Functions (`'use server'`) в формах и обработчиках.

### Подводные камни
- `'use client'` в корневом layout делает клиентским всё дерево ниже и отменяет выгоды Server Components.
- `error.tsx` не ловит ошибки в `layout.tsx` того же сегмента — для них нужен `error.tsx` уровнем выше или `global-error.tsx`.

### Что спросят дальше
- Чем `layout.tsx` отличается от `template.tsx`?
- Как сделать модалку с собственным URL на параллельных и перехватывающих маршрутах?

### Ссылки
- [Next.js: Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js: Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)

# Что такое proxy (бывший middleware) в Next.js и что в нём делать?
@slug nextjs-proxy
@topic server
@verified next@16
@updated 2026-10

> `proxy.ts` (до Next.js 16 — `middleware.ts`) выполняется до маршрутизации для каждого подходящего запроса. Он может переписать или перенаправить запрос, поставить заголовки и cookies или сразу вернуть ответ. Proxy подходит для быстрых решений по запросу: редирект неавторизованных, выбор языка, A/B-группа, заголовки безопасности. Тяжёлую логику и обращения к базе в него не кладут. Настоящую проверку прав выполняют там, где читаются данные.

```ts
// proxy.ts в корне проекта
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const session = request.cookies.get('session');
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}

// Не запускать для статики и картинок
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

Что важно знать:

- **Переименование в Next.js 16.** `middleware` объявлен устаревшим, новое имя подчёркивает роль сетевой границы перед приложением. Для миграции есть codemod. Proxy работает в Node.js-рантайме.
- **Оптимистичная проверка.** Proxy видит только запрос: cookie есть — пропускаем. Подпись и права сессии всё равно проверяются в Server Components, Server Functions и Route Handlers.
- **`matcher`** ограничивает, на какие пути реагирует proxy. Без него он выполняется на каждый запрос, включая ассеты.
- **`rewrite`** меняет то, что отдаётся, не меняя URL: A/B-тесты, мультитенантность по поддомену.

### Подводные камни
- Защита только в proxy — дыра: Server Function можно вызвать напрямую, минуя страницу и её путь.
- Медленный код в proxy (запрос к базе на каждый запрос) замедляет всё приложение, включая статические страницы.

### Что спросят дальше
- Почему проверку авторизации нельзя ограничить proxy?
- Как сделать мультитенантность по поддомену через `rewrite`?

### Ссылки
- [Next.js: proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js 16](https://nextjs.org/blog/next-16)

# Как работают бандлинг, tree-shaking и code splitting?
@slug bundling-tree-shaking
@topic ecosystem
@updated 2026-10

> Бандлер (Vite с Rolldown, webpack, Turbopack) собирает модули в файлы для браузера. Tree-shaking удаляет неиспользуемые экспорты, но работает только для ES-модулей (`import`/`export`) и кода без побочных эффектов при импорте. Code splitting делит бандл на чанки, которые грузятся по требованию: по маршрутам и через динамический `import()`. Цель — меньше JavaScript на старте, потому что его нужно не только скачать, но и распарсить и выполнить.

```tsx
// Tree-shaking: именованный импорт из ESM-библиотеки — в бандл попадёт только debounce
import { debounce } from 'es-toolkit';
// Плохо: CommonJS-пакет или импорт «всего» тянет библиотеку целиком
import _ from 'lodash';

// Code splitting: тяжёлый редактор грузится, только когда нужен
const Editor = lazy(() => import('./Editor'));
function Post({ editing }: { editing: boolean }) {
  return editing ? (
    <Suspense fallback={<Spinner />}>
      <Editor />
    </Suspense>
  ) : (
    <PostView />
  );
}
```

Что знать для собеседования:

- **`sideEffects: false`** в `package.json` библиотеки сообщает бандлеру, что неиспользуемые модули можно выбрасывать целиком. CSS-импорты нужно оставлять в списке побочных эффектов.
- **Barrel-файлы** (`index.ts` с `export *`) замедляют сборку и dev-сервер и иногда мешают tree-shaking.
- **Разделение по маршрутам** — самый выгодный сплит. Роутеры и фреймворки делают его автоматически.
- **Вендорные чанки** кэшируются надолго: React меняется реже, чем код приложения.
- **Анализ.** `rollup-plugin-visualizer` или `vite-bundle-analyzer` показывают, кто занимает место. Бюджет размера бандла проверяют в CI.
- **Предзагрузка.** `modulepreload` и prefetch чанков следующего маршрута убирают задержку при переходе.

### Подводные камни
- Слишком мелкое дробление создаёт водопад запросов: чанк A грузит B, B грузит C.
- `lazy` внутри компонента (а не на уровне модуля) создаёт новый компонент при каждом рендере и сбрасывает его состояние.

### Что спросят дальше
- Почему tree-shaking не работает с CommonJS?
- Как найти, какая зависимость раздула бандл?

### Ссылки
- [Vite: Building for Production](https://vite.dev/guide/build)
- [web.dev: Reduce JavaScript payloads with code splitting](https://web.dev/articles/reduce-javascript-payloads-with-code-splitting)

# Зачем нормализовать состояние на клиенте?
@slug normalized-state
@topic state
@updated 2026-10

> Нормализация — хранение сущностей как в базе: каждая сущность один раз, в словаре по id, а связи — через id. Вложенные копии не используются. Так обновление пользователя в одном месте сразу видно везде, где он показан. Изменения дешёвые и иммутабельные, а поиск по id — O(1). В Redux Toolkit для этого есть `createEntityAdapter`. Серверный кэш в TanStack Query обычно не нормализуют, а инвалидируют.

```ts
// Денормализовано: автор скопирован в каждый пост — переименование нужно искать по всему дереву
const posts = [{ id: 'p1', title: '…', author: { id: 'u1', name: 'Ada' } }];

// Нормализовано
type State = {
  users: { ids: string[]; entities: Record<string, User> };
  posts: { ids: string[]; entities: Record<string, Post & { authorId: string }> };
};

// RTK: CRUD-редьюсеры и селекторы из коробки
const postsAdapter = createEntityAdapter<Post>({ sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt) });
const postsSlice = createSlice({
  name: 'posts',
  initialState: postsAdapter.getInitialState(),
  reducers: { postUpdated: postsAdapter.updateOne, postsReceived: postsAdapter.setAll },
});
export const { selectById: selectPostById, selectAll: selectAllPosts } = postsAdapter.getSelectors(
  (state: RootState) => state.posts,
);
```

Когда это нужно:

- **Одни и те же сущности видны в нескольких местах** — список, детальная карточка, счётчики — и меняются на клиенте.
- **Редакторы и офлайн-приложения**, где клиент — источник истины для сложного графа данных.
- **Real-time обновления** по сокету: пришло событие «пост 42 изменён» — обновили одну запись.

Когда не нужно:

- **Серверное состояние** в TanStack Query. Проще инвалидировать затронутые ключи после мутации или точечно обновить через `setQueryData`. Нормализованный кэш есть в Apollo и urql (GraphQL), но за него платят сложностью.
- **Локальное состояние формы или виджета.**

### Подводные камни
- Селектор, собирающий «пост с автором» из нормализованных данных, без мемоизации возвращает новый объект и вызывает лишние рендеры.
- Нормализация без удаления сущностей (сборки мусора) приводит к росту памяти в долгоживущих вкладках.

### Что спросят дальше
- Как в TanStack Query обновить сущность, которая лежит в нескольких кэшах списков?
- Как мемоизировать селекторы, собирающие данные из нескольких срезов?

### Ссылки
- [Redux: Normalizing State Shape](https://redux.js.org/usage/structuring-reducers/normalizing-state-shape)
- [Redux Toolkit: createEntityAdapter](https://redux-toolkit.js.org/api/createEntityAdapter)

# Как устроен event loop в Node.js и почему нельзя блокировать поток?
@slug node-event-loop
@topic fullstack
@updated 2026-10

> JavaScript в Node.js выполняется в одном потоке, а ввод-вывод (сеть, диск, таймеры) выполняет libuv асинхронно. Event loop по кругу проходит фазы: таймеры, ожидающие колбэки, poll (ввод-вывод), check (`setImmediate`) и close. Между колбэками выполняются `process.nextTick` и микрозадачи промисов. Пока синхронный код занимает поток, сервер не обслуживает ни один другой запрос. Поэтому CPU-тяжёлую работу выносят в worker threads, отдельный сервис или очередь.

```ts
// Блокирует сервер: пока считается хэш, все остальные запросы ждут
app.post('/hash', (c) => c.text(crypto.pbkdf2Sync(password, salt, 600_000, 64, 'sha512').toString('hex')));

// Не блокирует: работа уходит в пул потоков libuv
app.post('/hash', async (c) => {
  const key = await promisify(crypto.pbkdf2)(password, salt, 600_000, 64, 'sha512');
  return c.text(key.toString('hex'));
});

// Порядок: синхронный код → nextTick → промисы → таймеры/immediate
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
// nextTick, promise, затем timeout и immediate (их порядок в главном модуле не гарантирован)
```

Что из этого следует на практике:

- **Async I/O — не параллелизм вычислений.** Тысячи одновременных запросов к базе Node держит легко, а цикл на 2 секунды в обработчике «вешает» весь процесс.
- **Тяжёлое — вне главного потока**: `worker_threads`, очередь задач (BullMQ) с отдельными воркерами, нативные модули.
- **Синхронные API** (`readFileSync`, `JSON.parse` огромного файла) допустимы при старте, но не в обработчике запроса.
- **Масштабирование** — несколько процессов (cluster, контейнеры за балансировщиком), а не потоков.
- **Диагностика** — `monitorEventLoopDelay` из `perf_hooks` показывает задержку цикла. Её рост означает, что поток кто-то блокирует.

### Подводные камни
- Рекурсивный `process.nextTick` или бесконечная цепочка микрозадач «голодит» event loop — ввод-вывод никогда не обработается.
- Необработанный rejected-промис в современных Node.js завершает процесс. Нужны обработка ошибок и супервизор.

### Что спросят дальше
- Чем `setImmediate` отличается от `setTimeout(fn, 0)` и `process.nextTick`?
- Когда выбрать worker threads, а когда отдельный сервис или очередь?

### Ссылки
- [Node.js: The Node.js Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- [Node.js: Don't Block the Event Loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
