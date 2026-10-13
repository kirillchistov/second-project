# Как тестировать асинхронный код и запросы к API?
@slug testing-async-msw
@topic testing

> Для асинхронного UI используют `findBy…` и `waitFor`, а сеть мокают на уровне HTTP через MSW (Mock Service Worker), а не подменой `fetch` или модулей API. MSW перехватывает запросы и в тестах (Node), и в браузере, поэтому одни и те же обработчики работают в unit-тестах, Storybook и при локальной разработке.

```tsx
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'Анна' }),
  ),
];

// setupTests.ts
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// UserCard.test.tsx
test('показывает ошибку, если сервер упал', async () => {
  server.use(http.get('/api/users/:id', () => new HttpResponse(null, { status: 500 })));
  renderWithProviders(<UserCard userId="1" />);

  expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось/i);
});
```

Практические советы:

- **Провайдеры в тестах.** Обёртка `renderWithProviders` с новым `QueryClient` на каждый тест (с `retry: false`), роутером и темой.
- **Фейковые таймеры** (`vi.useFakeTimers()`) — для debounce и интервалов; с `user-event` нужно передать `advanceTimers: vi.advanceTimersByTime`.
- **Предупреждение `act(...)`** обычно значит, что тест закончился раньше, чем завершилось обновление, — дождитесь результата через `findBy`.
- **Хуки** тестируются через `renderHook`.

### Подводные камни
- Общий `QueryClient` между тестами — кэш «протекает», тесты зависят от порядка.
- `waitFor` с побочными эффектами внутри (клики) — они выполнятся многократно.

### Что спросят дальше
- Чем MSW лучше `vi.mock('./api')`?
- Как тестировать компонент с debounce?

### Ссылки
- [MSW — Getting Started](https://mswjs.io/docs/getting-started)
- [Testing Library — Async Methods](https://testing-library.com/docs/dom-testing-library/api-async)

# Как устроен роутинг в React Router v7 и v8?
@slug react-router
@verified react-router@8.4
@updated 2026-10
@topic ecosystem

> React Router v7 объединился с Remix, v8 (июнь 2026) сохранил ту же модель. Он работает в трёх режимах: declarative (`<BrowserRouter>` и `<Routes>`, как раньше), data (`createBrowserRouter` с `loader` и `action` у маршрутов) и framework (файловые роуты, SSR, типизация, сборка через Vite-плагин). Ключевые идеи: вложенные маршруты с `<Outlet>`, загрузка данных до рендера маршрута, формы и мутации через actions.

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,          // внутри <Outlet /> для дочерних маршрутов
    errorElement: <RootError />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'projects/:id',
        loader: ({ params, request }) => api.getProject(params.id!, { signal: request.signal }),
        element: <Project />,
      },
    ],
  },
]);

function Project() {
  const project = useLoaderData() as Project;   // данные загружены до рендера
  const navigation = useNavigation();           // 'idle' | 'loading' | 'submitting'
  return <ProjectView project={project} pending={navigation.state !== 'idle'} />;
}

createRoot(root).render(<RouterProvider router={router} />);
```

Почему loaders лучше `useEffect`: загрузка начинается при навигации параллельно для всех вложенных маршрутов (нет водопада), отмена запросов при уходе со страницы, ошибки попадают в `errorElement`, после action данные автоматически перезагружаются.

Защищённые маршруты — проверка в `loader` с `redirect('/login')` или компонент-обёртка с `<Navigate>`.

Альтернатива — TanStack Router с полностью типизированными путями и search params.

### Подводные камни
- В v7 пакет — `react-router`; `react-router-dom` остался только для совместимости, а в v8 удалён: `RouterProvider` импортируют из `react-router/dom`, остальное — из `react-router`. v8 требует React 19.2+ и поставляется только как ESM, middleware включён всегда.
- Для статического хостинга (GitHub Pages, S3) нужен fallback на `index.html`, иначе прямые ссылки дают 404.

### Что спросят дальше
- Чем loader отличается от загрузки в компоненте?
- Как сделать ленивую загрузку маршрутов?

### Ссылки
- [React Router — Picking a Mode](https://reactrouter.com/start/modes)
- [TanStack Router](https://tanstack.com/router/latest)

# Как обеспечить доступность (a11y) в React-приложении?
@slug accessibility
@topic quality

> Основа — семантический HTML: `<button>` для действий, `<a href>` для навигации, `<label>` для полей, правильные заголовки и landmarks. ARIA — только там, где HTML не хватает. В SPA дополнительно нужно управлять фокусом: при открытии и закрытии модалок, при переходе между страницами, при появлении ошибок. Проверять — клавиатурой, скринридером, axe и eslint-plugin-jsx-a11y.

```tsx
// Плохо: div вместо кнопки — нет фокуса, Enter/Space, роли
<div className="btn" onClick={save}>Сохранить</div>

// Хорошо
<button type="button" onClick={save}>Сохранить</button>

// Кнопка-иконка — нужно доступное имя
<button aria-label="Закрыть" onClick={onClose}><XIcon aria-hidden /></button>

// Объявление о динамических изменениях
<div role="status" aria-live="polite">{saved && 'Изменения сохранены'}</div>

// Ошибка поля
<input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
{error && <p id={`${id}-err`}>{error}</p>}
```

Чек-лист:

- всё работает с клавиатуры, фокус виден (`:focus-visible`), порядок логичен;
- у изображений есть `alt` (пустой для декоративных);
- контраст текста не ниже 4.5:1;
- после навигации в SPA фокус переносится на заголовок новой страницы или объявляется смена;
- модалки: focus trap, Escape, возврат фокуса;
- `prefers-reduced-motion` для анимаций.

Сложные виджеты (комбобокс, меню, табы, датапикер) лучше брать из headless-библиотек с готовой доступностью: React Aria, Radix UI, Ariakit.

### Подводные камни
- `tabIndex` больше 0 ломает естественный порядок фокуса.
- `aria-label` на `div` без роли не работает.

### Что спросят дальше
- Как сделать доступную модалку?
- Как тестировать доступность автоматически?

### Ссылки
- [MDN — Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

# Как отлаживать React-приложение?
@slug debugging
@topic ecosystem

> Основные инструменты: React DevTools (дерево компонентов, props, state, хуки, «почему этот компонент отрендерился»), Profiler в DevTools (время рендера, коммиты), треки React в панели Performance Chrome DevTools (React 19.2), обычный отладчик браузера с source maps и сообщения об ошибках с owner stack. Для сетевых проблем — вкладка Network и DevTools библиотек данных (TanStack Query Devtools, Redux DevTools).

Типовой порядок поиска проблемы:

1. **Воспроизвести** и сузить: какой компонент, какое действие.
2. **Components** в React DevTools: какие props и state у компонента сейчас, кто его отрендерил (owner).
3. **Profiler**: записать взаимодействие, найти долгие коммиты и компоненты, которые рендерятся без необходимости. Включить «Record why each component rendered».
4. **Performance** в Chrome: посмотреть треки Scheduler и Components, long tasks и что блокирует главный поток.
5. **Точки останова** в обработчиках и эффектах, `debugger`, логирование с условием.

Полезные приёмы:

- «Highlight updates when components render» — подсветка рендеров.
- `useDebugValue` — подпись для кастомного хука в DevTools.
- `<Profiler onRender>` — измерения в коде, в том числе в production-профилирующей сборке.
- В разработке React 19 показывает **owner stack** — цепочку компонентов, которые привели к ошибке, а не только стек вызовов.

### Подводные камни
- Профилировать dev-сборку и делать выводы о production — dev медленнее в разы.
- Забывать про двойной рендер StrictMode при подсчёте вызовов.

### Что спросят дальше
- Как найти причину лишнего рендера?
- Как профилировать production?

### Ссылки
- [React Developer Tools](https://react.dev/learn/react-developer-tools)
- [Profiler — reference](https://react.dev/reference/react/Profiler)
- [React Performance Tracks](https://react.dev/reference/dev-tools/react-performance-tracks)

# Как защитить React-приложение от XSS?
@slug xss
@topic quality

> React по умолчанию экранирует всё, что выводится через `{}` в JSX, поэтому обычная вставка строк безопасна. Опасные места: `dangerouslySetInnerHTML`, URL из пользовательских данных в `href` и `src` (схема `javascript:`), прямая работа с DOM через ref (`innerHTML`), сериализация состояния в HTML при SSR и сторонние скрипты. HTML от пользователя нужно санитизировать (DOMPurify), а политика CSP — вторая линия защиты.

```tsx
import DOMPurify from 'dompurify';

// Опасно
<div dangerouslySetInnerHTML={{ __html: comment.html }} />

// Безопаснее — санитизация
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.html) }} />

// Опасно: пользователь может передать "javascript:alert(1)"
<a href={user.website}>Сайт</a>

// Проверка схемы
function safeUrl(url: string) {
  try {
    const { protocol } = new URL(url, location.origin);
    return ['http:', 'https:', 'mailto:'].includes(protocol) ? url : '#';
  } catch {
    return '#';
  }
}
```

Ещё по теме:

- React блокирует URL со схемой `javascript:` в `href` и выводит предупреждение, но лучше не полагаться на это.
- При SSR состояние встраивают в `<script>` через безопасную сериализацию (экранирование `</script>` и `<`), а не `JSON.stringify` «как есть».
- **CSP** (`Content-Security-Policy`) с nonce запрещает выполнение инлайн-скриптов, которые внедрил атакующий.
- Токены доступа не стоит хранить в `localStorage` — при XSS их легко украсть; лучше httpOnly cookies.

### Подводные камни
- Markdown-рендереры с включённым HTML без санитизации.
- Spread непроверенного объекта в props: `<div {...userProps} />` может передать `dangerouslySetInnerHTML`.

### Что спросят дальше
- Что такое CSP и как она работает с инлайн-скриптами?
- Где хранить токены авторизации?

### Ссылки
- [dangerouslySetInnerHTML — react.dev](https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

# Как отрендерить список из 10 000 элементов?
@slug virtualization
@topic performance

> Не рендерить все: использовать виртуализацию (windowing) — в DOM находятся только видимые строки плюс небольшой запас, а остальное заменено отступами. Библиотеки: TanStack Virtual, react-window, react-virtuoso. Альтернативы — пагинация, бесконечная подгрузка, а для простых случаев CSS `content-visibility: auto`.

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function BigList({ rows }: { rows: Row[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            style={{ position: 'absolute', top: 0, transform: `translateY(${item.start}px)`, height: item.size, width: '100%' }}
          >
            {rows[item.index].title}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Что ещё важно:

- **Стабильные ключи** и мемоизированные строки (`memo`), чтобы прокрутка не перерисовывала всё.
- **Переменная высота** — измерение через `measureElement`.
- **Поиск по странице (Ctrl+F)** и доступность страдают: скрытых элементов нет в DOM. Это компромисс, о котором стоит сказать.
- **Фильтрация** большого массива — `useDeferredValue`, чтобы ввод оставался отзывчивым.

### Подводные камни
- Виртуализировать список из 50 элементов — сложность без пользы.

### Что спросят дальше
- Как виртуализировать таблицу с фиксированной шапкой?
- Как совместить виртуализацию и бесконечную подгрузку?

### Ссылки
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [content-visibility — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility)

# Что не так с этим кодом? (stale closure в интервале)
@slug stale-closure
@topic hooks
@legacy 42

> Эффект с пустыми зависимостями захватывает `count` из первого рендера — замыкание «застывает», и счётчик навсегда остаётся равным 1. Исправление: функция-апдейтер `setCount(c => c + 1)`, либо правильные зависимости, либо `useEffectEvent` для чтения актуальных значений в эффекте.

```tsx
// Баг
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1);     // count всегда 0 из первого рендера
    }, 1000);
    return () => clearInterval(id);
  }, []);                      // линтер предупредит: не хватает count

  return <p>{count}</p>;
}

// Исправление 1: апдейтер — эффекту не нужен count
useEffect(() => {
  const id = setInterval(() => setCount((c) => c + 1), 1000);
  return () => clearInterval(id);
}, []);

// Исправление 2: читать актуальный step без перезапуска интервала (React 19.2)
const onTick = useEffectEvent(() => setCount((c) => c + step));
useEffect(() => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}, []);
```

Почему так происходит: каждый рендер — отдельный вызов функции со своими константами. Колбэк, созданный в первом рендере, видит только значения первого рендера. Это не особенность React, а обычные замыкания JavaScript; React лишь делает их заметнее.

Где ещё встречается: подписки на события, WebSocket-обработчики, `setTimeout` в обработчиках, колбэки сторонних библиотек.

### Подводные камни
- «Чинить» добавлением `count` в зависимости — интервал будет пересоздаваться каждую секунду (работает, но интервал сбивается).
- Отключать правило линтера `exhaustive-deps` вместо исправления.

### Что спросят дальше
- Что такое useEffectEvent?
- Как хранить актуальное значение в ref?

### Ссылки
- [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects)
- [useEffectEvent — reference](https://react.dev/reference/react/useEffectEvent)

# Как организовать структуру React-проекта?
@slug project-structure
@topic architecture
@legacy 22

> Группировать по функциональности (фичам), а не по типам файлов. Код, который меняется вместе, лежит рядом (colocation): компонент, его хуки, стили, тесты. У каждой фичи — публичный API (`index.ts`), а импортировать внутренности чужих фич нельзя. Общее — в `shared` (UI-кит, утилиты, API-клиент). Популярная формализация — Feature-Sliced Design.

```text
src/
  app/              # инициализация: провайдеры, роутер, глобальные стили
  pages/            # страницы: композиция фич
  features/
    cart/
      ui/CartButton.tsx
      model/useCart.ts
      api/cartApi.ts
      index.ts      # публичный API фичи
  entities/         # бизнес-сущности: user, product
  shared/
    ui/             # кнопки, инпуты, модалки
    lib/            # утилиты
    api/            # http-клиент
```

Принципы:

- **Направление зависимостей** сверху вниз: `pages → features → entities → shared`. Нижние слои не знают о верхних.
- **Публичный API** модуля и запрет глубоких импортов — проверяется линтером (eslint-plugin-boundaries, steiger для FSD).
- **Не дробить раньше времени.** Для маленького проекта достаточно `components/`, `pages/`, `hooks/`, `lib/`. Структура растёт вместе с проектом.
- **Абсолютные импорты** через алиасы (`@/shared/ui`).

### Подводные камни
- Папки `components/`, `hooks/`, `utils/` с сотнями файлов — изменение одной фичи затрагивает пять директорий.
- Barrel-файлы, реэкспортирующие всё, могут ухудшать tree-shaking и скорость dev-сервера.

### Что спросят дальше
- Что такое Feature-Sliced Design?
- Как запретить импорт внутренностей модуля?

### Ссылки
- [Feature-Sliced Design](https://feature-sliced.design/)

# Чем отличаются CSR, SSR, SSG и ISR?
@slug rendering-strategies
@topic server

> CSR — сервер отдаёт пустой HTML, всё рендерится в браузере. SSR — HTML генерируется на сервере на каждый запрос, затем гидрируется. SSG — HTML генерируется заранее при сборке. ISR — статические страницы перегенерируются в фоне по таймеру или по событию. Выбор зависит от того, насколько данные динамичны, важен ли SEO и время до первого контента.

| | Когда генерируется HTML | Плюсы | Минусы |
|---|---|---|---|
| CSR | в браузере | простая инфраструктура, статический хостинг | пустой экран до загрузки JS, хуже SEO |
| SSR | на каждый запрос | быстрый первый контент, SEO, актуальные данные | нагрузка на сервер, TTFB зависит от данных |
| SSG | при сборке | максимально быстро, CDN | данные устаревают до пересборки |
| ISR | при сборке + фоновое обновление | скорость SSG и относительная свежесть | сложнее инвалидация, привязка к платформе |

Гидрация — процесс, при котором React на клиенте «оживляет» серверный HTML: строит дерево компонентов, сверяет его с разметкой и навешивает обработчики. До окончания гидрации страница видна, но не интерактивна.

Современные подходы смешивают стратегии: статическая оболочка + динамические «дыры» со стримингом (Partial Prerendering), Server Components, которые не отправляют свой код на клиент вообще, и выборочная гидрация.

Для внутренних приложений за логином CSR на Vite часто остаётся самым разумным выбором.

### Подводные камни
- Использовать `window` и `localStorage` при рендере в SSR — ошибка на сервере или несовпадение гидрации.

### Что спросят дальше
- Что такое ошибка гидрации и как её исправить?
- Что такое стриминг SSR?

### Ссылки
- [Server React DOM APIs](https://react.dev/reference/react-dom/server)
- [hydrateRoot — reference](https://react.dev/reference/react-dom/client/hydrateRoot)

# Как реализовать debounce и throttle в React?
@slug debounce-throttle
@topic performance

> Debounce откладывает вызов до паузы в событиях (поиск по вводу), throttle ограничивает частоту (скролл, resize). В React важно, чтобы debounced-функция не пересоздавалась на каждом рендере — иначе таймер сбрасывается. Варианты: хук `useDebouncedValue` для значения, стабильная функция через `useMemo`/`useRef` с отменой в cleanup или встроенный `useDeferredValue`, если задача — не тормозить рендер.

```tsx
// 1. Debounce значения — чаще всего достаточно
const [query, setQuery] = useState('');
const debouncedQuery = useDebouncedValue(query, 300);
const { data } = useQuery({
  queryKey: ['search', debouncedQuery],
  queryFn: () => api.search(debouncedQuery),
  enabled: debouncedQuery.length > 1,
});

// 2. Debounce функции
function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });

  const debounced = useMemo(() => {
    let id: ReturnType<typeof setTimeout>;
    const call = (...args: A) => {
      clearTimeout(id);
      id = setTimeout(() => fnRef.current(...args), delay);
    };
    call.cancel = () => clearTimeout(id);
    return call;
  }, [delay]);

  useEffect(() => debounced.cancel, [debounced]);
  return debounced;
}
```

Debounce vs `useDeferredValue`: debounce уменьшает **количество запросов** и вызовов, а `useDeferredValue` не откладывает по времени — он позволяет React рендерить «тяжёлый» результат с низким приоритетом, не блокируя ввод. Для поиска по API — debounce; для фильтрации большого локального списка — `useDeferredValue`.

### Подводные камни
- `const debounced = debounce(fn, 300)` прямо в теле компонента — новый таймер на каждом рендере, debounce не работает.
- Не отменять отложенный вызов при размонтировании — `setState` в размонтированном компоненте и лишние запросы.

### Что спросят дальше
- Чем useDeferredValue отличается от debounce?
- Как отменить устаревший запрос поиска?

### Ссылки
- [useDeferredValue — reference](https://react.dev/reference/react/useDeferredValue)

# Как организовать аутентификацию в SPA?
@slug spa-auth
@topic quality

> Надёжный вариант — сессия или refresh-токен в httpOnly Secure SameSite cookie, которую JS не может прочитать (защита от кражи при XSS), и короткоживущий access-токен в памяти. На клиенте — провайдер текущего пользователя, защищённые маршруты (проверка в loader или компоненте-обёртке) и единая обработка 401 с попыткой обновить токен. Главное: проверки на клиенте — только UX, реальные права проверяет сервер.

```tsx
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useCurrentUser();   // например, useQuery(['me'])
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

// Перехватчик 401 в http-клиенте: одно обновление токена на все параллельные запросы
let refreshing: Promise<void> | null = null;
async function request(input: RequestInfo, init?: RequestInit) {
  let res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status === 401) {
    refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(() => undefined)
      .finally(() => { refreshing = null; });
    await refreshing;
    res = await fetch(input, { ...init, credentials: 'include' });
  }
  return res;
}
```

Важные детали:

- **localStorage для токенов** — удобно, но любой XSS украдёт токен; cookie httpOnly безопаснее, но требует защиты от CSRF (SameSite, CSRF-токен).
- **Выход из системы** — очистить кэш запросов (`queryClient.clear()`), чтобы данные прошлого пользователя не показались следующему.
- **OAuth/OIDC** — Authorization Code Flow с PKCE; лучше доверить готовой библиотеке или BFF (backend for frontend).
- **Права в UI** (скрыть кнопку) — не замена серверной проверки.

### Подводные камни
- Мерцание защищённой страницы до проверки пользователя — нужно состояние загрузки.
- Несколько одновременных refresh-запросов при истечении токена.

### Что спросят дальше
- Что такое CSRF и как SameSite помогает от него?
- Что такое BFF?

### Ссылки
- [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [React Router — Navigate](https://reactrouter.com/api/components/Navigate)
