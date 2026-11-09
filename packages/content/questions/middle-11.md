# Как комбинировать middleware в Zustand и в каком порядке их оборачивать?
@slug zustand-middleware
@topic state
@verified react@19.3
@updated 2026-11

> Middleware в Zustand — функция-обёртка вокруг создателя стора: она получает `set`/`get`/`api` и возвращает свою версию, добавляя побочное поведение вокруг каждого обновления. `devtools` подключает стор к Redux DevTools (та же история actions и time-travel, что и у Redux), не требуя самого Redux. Middleware оборачивают друг друга снаружи внутрь — порядок в коде определяет, кто видит состояние раньше, а кто позже.

```tsx
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set) => ({
        theme: 'system',
        setTheme: (theme) => set({ theme }, false, 'setTheme'), // третий аргумент — имя action для DevTools
      }),
      { name: 'settings-storage' }, // persist — внутренний слой, пишет в localStorage напрямую
    ),
    { name: 'SettingsStore' }, // devtools — внешний слой, видит уже персистентный стор целиком
  ),
);
```

`devtools` обычно ставят снаружи, а `persist` — внутри: тогда в DevTools видны actions уже восстановленного из `localStorage` состояния, а не промежуточные шаги гидрации. Третий необязательный аргумент `set(partial, replace, actionName)` — имя action, которое появится в DevTools вместо généric `"setState"`; без него отладка в DevTools с несколькими действиями подряд превращается в угадывание, какое изменение к чему относится.

### Подводные камни
- Поменять местами `devtools` и `persist` без понимания, что это изменит порядок обработки — лишние или, наоборот, невидимые шаги гидрации в истории DevTools.
- Включать `devtools` в production-сборке — расширение продолжит получать полную историю состояния, хотя пользователю это не нужно и чуть расходует память.
- Не давать action-имена в `set(...)` — история DevTools превращается в список неотличимых друг от друга `anonymous`.

### Что спросят дальше
- Как написать собственный middleware для Zustand — что он обязан принять и вернуть?
- Чем `devtools` middleware Zustand отличается по возможностям от полноценного Redux DevTools с time-travel?

### Ссылки
- [Zustand — devtools middleware](https://zustand.docs.pmnd.rs/middlewares/devtools)
- [Zustand — Third-party Libraries (список middleware)](https://zustand.docs.pmnd.rs/integrations/third-party-libraries)

# Как сохранить состояние Zustand-стора между перезагрузками через `persist`?
@slug zustand-persist
@topic state
@verified react@19.3
@updated 2026-11

> Middleware `persist` сохраняет стор в хранилище (по умолчанию `localStorage`) после каждого изменения и восстанавливает его при инициализации — асинхронно, поэтому на самый первый рендер стор ещё содержит исходное значение по умолчанию, а не сохранённое. `partialize` ограничивает, какие поля вообще попадают в хранилище (например, не стоит персистить состояние загрузки или временный UI-флаг), а `version` + `migrate` дают способ исправить форму данных, если она изменилась между релизами приложения.

```tsx
const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: false, // временное поле — в хранилище попадать не должно
      setSession: (token, user) => set({ token, user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }), // isLoading отфильтрован
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) return { ...(persisted as object), user: null }; // старый формат без user — досоздаём поле
        return persisted;
      },
    },
  ),
);

function AuthGate({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore.persist.hasHydrated(); // true только после восстановления из хранилища
  if (!hasHydrated) return <Spinner />;
  return <>{children}</>;
}
```

В SSR-окружении (Next.js) гидрация `persist` на клиенте происходит уже после первого рендера, поэтому серверный HTML и первый клиентский рендер **должны** совпадать с исходным значением по умолчанию — показывать персистентные данные раньше `hasHydrated() === true` рискует несовпадением при гидрации React, а не только логической ошибкой.

### Подводные камни
- Персистить весь стор без `partialize` — временные UI-флаги (`isLoading`, `isModalOpen`) переживают перезагрузку страницы, хотя не должны.
- Менять форму персистентных данных между релизами без `version`/`migrate` — у пользователей со старым форматом в хранилище приложение падает или ведёт себя непредсказуемо при чтении нового поля из старых данных.
- Читать персистентное значение до `hasHydrated()` в SSR-приложении — несовпадение серверного и клиентского рендера.

### Что спросят дальше
- Чем `createJSONStorage` с кастомным storage engine (например, `AsyncStorage` в React Native) отличается от дефолтного `localStorage`?
- Как `persist` решает, что состояние действительно изменилось и нужно ли записывать в хранилище заново?

### Ссылки
- [Zustand — persist middleware](https://zustand.docs.pmnd.rs/middlewares/persist)
- [Zustand — persist: hasHydrated и onRehydrateStorage](https://zustand.docs.pmnd.rs/middlewares/persist#hashydrated-and-onhydrate)

# Как `immer` middleware упрощает вложенные обновления в Zustand?
@slug zustand-immer
@topic state
@verified react@19.3
@updated 2026-11

> Без `immer` глубоко вложенное обновление требует разворачивать spread на каждом уровне вручную (`{ ...state, user: { ...state.user, address: { ...state.user.address, city } } }`) — легко забыть один уровень и случайно замкнуть ссылку на старый вложенный объект. Middleware `immer` оборачивает `set`, и внутри него можно писать код, который выглядит как прямая мутация черновика (`draft.user.address.city = city`), а Immer сам производит новое иммутабельное состояние — та же модель, что и в `createSlice` Redux Toolkit.

```tsx
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useProfileStore = create<ProfileStore>()(
  immer((set) => ({
    user: { name: '', address: { city: '', zip: '' } },
    setCity: (city) =>
      set((draft) => {
        draft.user.address.city = city; // «мутация» черновика — на деле иммутабельное обновление
      }),
    addTag: (tag) =>
      set((draft) => {
        draft.tags.push(tag); // push на draft-массиве тоже безопасен благодаря Immer
      }),
  })),
);
```

`immer` middleware меняет саму сигнатуру `set`: вместо объекта или функции, возвращающей новое состояние, он ожидает функцию, которая мутирует переданный `draft` и ничего не возвращает — попытка одновременно и мутировать `draft`, и `return` новое значение из той же функции (смешение двух стилей) — частый источник путаницы при переходе с обычного Zustand на `immer`-версию.

### Подводные камни
- Писать `return { ...draft, city }` внутри `immer`-обёрнутого `set` вместо прямой мутации `draft` — смешение стилей иммутабельного и мутирующего обновления в одной функции не то, для чего рассчитан этот middleware.
- Тянуть `immer` ради одного неглубоко вложенного поля — там обычный spread короче и не требует новой зависимости.
- Мутировать `draft` **вне** функции, переданной в `set` (например, сохранить ссылку на `draft` в переменную снаружи и использовать позже) — Immer завершает работу черновика сразу после выполнения функции, использование ссылки после — undefined behavior.

### Что спросят дальше
- Чем мутация `draft` в Zustand+immer принципиально отличается от прямой мутации обычного React state?
- Когда вложенность состояния — сама по себе сигнал, что стоит пересмотреть форму данных, а не просто упрощать апдейт через Immer?

### Ссылки
- [Zustand — immer middleware](https://zustand.docs.pmnd.rs/integrations/immer-middleware)
- [Immer — Introduction](https://immerjs.github.io/immer/)

# Как написать асинхронное действие в Zustand-сторе?
@slug zustand-async-actions
@topic state
@verified react@19.3
@updated 2026-11

> Действие в Zustand — обычная функция в объекте стора, и ей ничто не мешает быть `async`: она читает текущее состояние через `get()`, делает `await fetch(...)`, и несколько раз вызывает `set(...)` по ходу выполнения — для состояния загрузки до запроса и для результата после. В отличие от Redux, здесь не нужен отдельный `thunk` middleware — асинхронность встроена в сам стор естественным образом, потому что действие — просто функция JavaScript.

```tsx
interface TodosStore {
  todos: Todo[];
  status: 'idle' | 'loading' | 'error';
  fetchTodos: () => Promise<void>;
}

const useTodosStore = create<TodosStore>((set, get) => ({
  todos: [],
  status: 'idle',
  fetchTodos: async () => {
    if (get().status === 'loading') return; // защита от повторного параллельного запроса
    set({ status: 'loading' });
    try {
      const res = await fetch('/api/todos');
      const todos = await res.json();
      set({ todos, status: 'idle' });
    } catch {
      set({ status: 'error' });
    }
  },
}));
```

Проверка `get().status === 'loading'` в начале действия — простая защита от гонки: если компонент вызывает `fetchTodos()` дважды подряд (например, из двух разных мест на экране), второй вызов просто выходит раньше, не запуская дублирующий запрос. Для более сложных сценариев (отмена предыдущего запроса при новом, а не просто игнорирование) внутрь действия добавляют `AbortController`, который хранят в самом сторе или в `ref` вне React.

### Подводные камни
- Не проверять состояние загрузки перед стартом нового запроса — быстрые повторные вызовы действия плодят параллельные одинаковые запросы.
- Не обрабатывать ошибку (`catch`) — необработанный `reject` в async-функции действия теряется молча, UI остаётся в состоянии `loading` навсегда.
- Делать побочные эффекты (навигацию, показ toast) прямо внутри действия стора вместо того, чтобы вернуть результат и обработать последствия в компоненте — усложняет тестирование стора в изоляции.

### Что спросят дальше
- Как отменить предыдущий in-flight запрос, если `fetchTodos` вызвали снова с новыми параметрами?
- Чем асинхронное действие Zustand отличается от `createAsyncThunk` по объёму вспомогательного кода для одной и той же задачи?

### Ссылки
- [Zustand — Updating state (async actions)](https://zustand.docs.pmnd.rs/guides/updating-state)
- [AbortController — MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

# Как тестировать Zustand-стор в изоляции и сбрасывать его состояние между тестами?
@slug zustand-testing-store
@topic testing
@verified react@19.3
@updated 2026-11

> Стор Zustand — обычный модуль с состоянием, поэтому его можно тестировать без рендера React-компонентов вовсе: вызвать действие через `useStore.getState().addItem(...)`, затем проверить `useStore.getState()`. Главная сложность — состояние стора **переживает** между тестами, потому что модуль с `create()` импортируется один раз и его не пересоздают автоматически; без явного сброса один тест может повлиять на следующий.

```tsx
import { beforeEach, expect, test } from 'vitest';
import { useCartStore } from './cartStore';

const initialState = useCartStore.getState(); // снимок состояния сразу после создания стора

beforeEach(() => {
  useCartStore.setState(initialState, true); // true — полная замена, а не слияние с текущим
});

test('addItem добавляет товар в корзину', () => {
  useCartStore.getState().addItem({ id: '1', title: 'Книга' });
  expect(useCartStore.getState().items).toHaveLength(1);
});
```

Для тестов, которые всё же рендерят компонент, подписанный на стор через хук, действия вызывают так же — через `getState()` вне `act()`, но обновление самого компонента (ре-рендер от изменения стора) React требует обернуть в `act()`, если оно происходит не в ответ на обычное пользовательское взаимодействие через Testing Library (клики через `userEvent` сами оборачивают `act()`).

### Подводные камни
- Не сбрасывать состояние стора между тестами — тест, который должен быть независимым, получает корзину, заполненную предыдущим тестом.
- Использовать `setState(partial)` без второго аргумента `true` для сброса — по умолчанию `setState` **сливает** объект с текущим состоянием, а не заменяет его целиком, и лишние поля из предыдущего теста остаются.
- Мокать сам Zustand вместо мока только сетевого слоя, который вызывают действия стора — тест перестаёт проверять реальную логику действий.

### Что спросят дальше
- Чем тестирование Zustand-стора отличается по сложности от тестирования Redux-редьюсера той же задачи?
- Как протестировать `persist` middleware, не трогая реальный `localStorage` браузера?

### Ссылки
- [Zustand — Testing](https://zustand.docs.pmnd.rs/guides/testing)
- [Vitest — beforeEach](https://vitest.dev/api/#beforeeach)

# Как настроить Vitest и Testing Library в React-проекте с нуля?
@slug test-harness-setup
@topic testing
@verified react@19.3
@updated 2026-11

> Минимальная настройка — три вещи: окружение, имитирующее DOM (`jsdom` или более быстрый `happy-dom`), глобальный `setupFiles` с матчерами `@testing-library/jest-dom` (`toBeInTheDocument()` и подобные), и, если проект на Vite, подключение `vitest/config` вместо отдельного Jest-конфига — тогда тесты используют тот же алиасинг путей и трансформации, что и обычная сборка.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true, // test()/expect() доступны без явного import
  },
});
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup()); // размонтирует отрендеренные компоненты после каждого теста
```

`cleanup()` после каждого теста обязателен при ручной настройке (Testing Library делает это автоматически только при интеграции с конкретными раннерами из коробки) — без него DOM-узлы от предыдущего теста остаются в документе, и следующий тест может случайно найти чужой элемент по тексту или роли.

### Подводные камни
- Не вызывать `cleanup()` между тестами — DOM накапливается, и `screen.getByText(...)` в одном тесте может найти элемент, отрендеренный в предыдущем.
- Использовать `jsdom` там, где нужны реальные браузерные API (например, `IntersectionObserver`, `ResizeObserver`) без их мока — `jsdom` не реализует их, тесты падают с `ReferenceError`.
- Не синхронизировать алиасы путей (`@/components`) между `tsconfig.json` и конфигом тестового раннера — импорты резолвятся в приложении, но падают в тестах или наоборот.

### Что спросят дальше
- Чем `jsdom` отличается от `happy-dom` по скорости и полноте реализации DOM API?
- Как замокать браузерные API, которых `jsdom` не реализует (`matchMedia`, `IntersectionObserver`)?

### Ссылки
- [Vitest — Configuring Vitest](https://vitest.dev/config/)
- [Testing Library — Setup](https://testing-library.com/docs/react-testing-library/setup/)

# Как задеплоить SPA на GitHub Pages, не сломав прямые ссылки и роутинг?
@slug deploy-github-pages
@topic fullstack
@verified react@19.3
@updated 2026-11

> GitHub Pages отдаёт статику из репозитория или ветки `gh-pages`, без серверной логики — значит, и `base` путь сборки, и обработка client-side роутинга должны быть явно настроены под это ограничение. Проект, опубликованный не в корне домена (`username.github.io/repo-name/`), должен собираться с этим префиксом в путях ассетов, иначе CSS и JS по абсолютным путям `/assets/...` не найдутся.

```ts
// vite.config.ts
export default defineConfig({
  base: '/repo-name/', // иначе собранные ссылки на ассеты будут вести в корень домена
});
```

GitHub Pages не умеет отдавать `index.html` на любой маршрут SPA (`/profile`, `/settings`) — физического файла по такому пути нет, и сервер отвечает честным 404. Обходной приём — положить копию `index.html` как `404.html`: GitHub Pages покажет её на любой несуществующий путь, а дальше SPA-роутер на клиенте уже сам разбирает `location.pathname` и рендерит нужный экран. Деплой автоматизируют через GitHub Actions: сборка на пуш в `main`, публикация `dist/` в ветку `gh-pages` или через встроенный Pages deployment.

### Подводные камни
- Забыть `base` в конфиге сборщика для проекта не в корне домена — ассеты запрашиваются по неверным путям, белый экран с ошибками 404 в консоли.
- Не продублировать `index.html` в `404.html` — прямые ссылки и перезагрузка страницы на клиентском маршруте (не на `/`) дают честный 404 от GitHub, а не рендер SPA.
- Коммитить собранный `dist/` руками вместо автоматизации через Actions — расхождение между исходниками и опубликованной версией рано или поздно случается.

### Что спросят дальше
- Чем деплой на GitHub Pages принципиально ограничен по сравнению с Vercel или Netlify (например, в части переменных окружения или serverless-функций)?
- Как настроить собственный домен (custom domain) для GitHub Pages, не теряя HTTPS?

### Ссылки
- [GitHub Pages — документация](https://docs.github.com/en/pages)
- [Vite — Static Deploy: GitHub Pages](https://vite.dev/guide/static-deploy#github-pages)

# Как встроить тесты в CI, чтобы они реально защищали main-ветку?
@slug ci-cd-pipeline
@topic testing
@verified react@19.3
@updated 2026-11

> CI-пайплайн на каждый push или pull request запускает тот же набор проверок, что разработчик мог бы прогнать локально: установка зависимостей (с закэшированным `node_modules` или lock-файлом для воспроизводимости), типизация, линтер, unit- и интеграционные тесты, иногда — сборка production-бандла как проверка, что она вообще не падает. Branch protection на `main` требует, чтобы эти проверки прошли **зелёным**, прежде чем pull request разрешат смержить — то есть CI не просто «показывает статус», а физически блокирует merge.

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'npm' }
      - run: npm ci # не npm install — ставит строго по lock-файлу
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test -- --coverage
```

`npm ci` вместо `npm install` в CI принципиален: он ставит ровно то, что зафиксировано в lock-файле, и падает при любом расхождении с `package.json` — CI не должен тихо «подтягивать» более новую версию зависимости, которую никто не тестировал. Покрытие тестами (`--coverage`) само по себе не гарантирует качество проверок, но помогает заметить код, который вообще никогда не выполняется ни одним тестом.

### Подводные камни
- Использовать `npm install` вместо `npm ci` в пайплайне — CI может поставить не те версии, что были протестированы у разработчика, и «работает у меня» превращается в нестабильный CI.
- Не кэшировать зависимости между запусками — каждый прогон CI заново скачивает весь `node_modules`, что ощутимо увеличивает время и стоимость пайплайна.
- Настроить CI, но не включить branch protection — зелёные и красные проверки видны, но ничто физически не мешает смержить pull request с падающими тестами.

### Что спросят дальше
- Как ускорить CI для большого монорепозитория — какие задачи можно запускать только для затронутых пакетов (affected)?
- Чем деплой из CI (continuous deployment) отличается от просто continuous integration с точки зрения того, что происходит после зелёных проверок?

### Ссылки
- [GitHub Actions — документация](https://docs.github.com/en/actions)
- [npm ci — документация npm](https://docs.npmjs.com/cli/v10/commands/npm-ci)

# Как подключить аналитику во фронтенд-приложение, не нарушая приватность и производительность?
@slug analytics-integration
@topic quality
@verified react@19.3
@updated 2026-11

> Аналитику подключают через один модуль-обёртку (`trackEvent(name, props)`), а не разбрасывают вызовы конкретного SDK (Google Analytics, Plausible, собственный сервис) по всему приложению — это позволяет сменить провайдера или отключить трекинг в тестах, поправив один файл. Загрузку скрипта аналитики откладывают (`async`/динамический `import()` после первого взаимодействия) — аналитика не должна конкурировать с LCP-ресурсами за полосу и приоритет загрузки.

```tsx
// lib/analytics.ts — единая точка, за которой скрыт конкретный провайдер
let queue: Array<{ name: string; props?: Record<string, unknown> }> = [];
let ready = false;

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!ready) { queue.push({ name, props }); return; } // события до загрузки SDK не теряются
  sendToProvider(name, props);
}

export async function initAnalytics() {
  await import('./provider'); // ленивая загрузка SDK, не в основном бандле
  ready = true;
  queue.forEach(({ name, props }) => sendToProvider(name, props));
  queue = [];
}
```

Для одностраничных приложений важно отдельно отслеживать переходы между маршрутами (в отличие от классических многостраничных сайтов, где каждая навигация — новая загрузка страницы, и аналитика считает её автоматически) — обычно это делают в одном месте, подписавшись на смену маршрута роутера, а не в каждом отдельном экране. SPA без согласия пользователя не должны инициализировать аналитику, которая устанавливает cookie или идентифицирует устройство — это требование GDPR/аналогичных регуляций, а не просто хорошая практика.

### Подводные камни
- Разбрасывать прямые вызовы SDK конкретного провайдера по компонентам — миграция на другого провайдера превращается в правку десятков файлов вместо одного.
- Грузить скрипт аналитики синхронно в `<head>`, блокируя рендер — тяжёлый сторонний скрипт конкурирует с LCP-ресурсами за полосу.
- Инициализировать трекинг до согласия пользователя на использование cookie — юридический риск независимо от технической реализации.

### Что спросят дальше
- Как трекать переходы между маршрутами в SPA, не плодя дублирующие события при повторном рендере того же экрана?
- Чем событийная аналитика (`trackEvent`) отличается от RUM-метрик производительности (`web-vitals`) по назначению?

### Ссылки
- [web.dev — Measure Performance with the RUM](https://web.dev/articles/vitals-field-measurement-best-practices)
- [web-vitals — библиотека для сбора метрик](https://github.com/GoogleChrome/web-vitals)
