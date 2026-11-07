# Как добавить `cancel()` и `flush()` к debounce?
@slug debounce-cancel-flush
@topic performance
@verified react@19.3
@updated 2026-11

> Базовый debounce откладывает вызов, пока не закончится пауза между вызовами — но часто нужно явно отменить отложенный вызов (`cancel`, например при размонтировании компонента) или выполнить его немедленно, не дожидаясь паузы (`flush`, например при отправке формы, пока debounce валидации ещё не сработал).

```ts
function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Args | undefined;

  const debounced = (...args: Args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => { fn(...args); lastArgs = undefined; }, ms);
  };

  debounced.cancel = () => {
    clearTimeout(timer);
    lastArgs = undefined;
  };

  debounced.flush = () => {
    if (lastArgs === undefined) return;
    clearTimeout(timer);
    fn(...lastArgs);
    lastArgs = undefined;
  };

  return debounced;
}
```

В React такой debounce обычно создают один раз через `useRef` или `useMemo` (не на каждый рендер — иначе каждый вызов получает новый таймер и debounce не работает вовсе), а `cancel()` вызывают в cleanup эффекта, чтобы отложенный вызов не сработал после размонтирования компонента.

### Подводные камни
- Создавать `debounce(...)` прямо в теле компонента без `useRef`/`useMemo` — каждый рендер получает новый экземпляр со своим таймером, и предыдущий отложенный вызов никто не отменяет.
- Не вызывать `cancel()` в cleanup — таймер может сработать после размонтирования и попытаться обновить state уже ушедшего компонента.
- Путать `flush()` с обычным немедленным вызовом `fn(...)` напрямую — `flush` должен использовать именно последние накопленные аргументы и погасить запланированный таймер, иначе `fn` вызовется дважды.

### Что спросят дальше
- Чем throttle с `leading`/`trailing` отличается от debounce по семантике вызовов?
- Как библиотеки вроде lodash реализуют те же `cancel`/`flush` для своего `debounce`?

### Ссылки
- [Debouncing and Throttling Explained Through Examples — CSS-Tricks](https://css-tricks.com/debouncing-throttling-explained-examples/)
- [lodash debounce — документация](https://lodash.com/docs/4.17.15#debounce)

# Как написать memoize для функции с несколькими аргументами и почему ключ через `JSON.stringify` ненадёжен?
@slug memoize-multi-arg
@topic performance
@verified react@19.3
@updated 2026-11

> Memoize кэширует результат по аргументам вызова — для одного аргумента достаточно `Map<arg, result>`, но для нескольких аргументов нужен составной ключ. `JSON.stringify(args)` — соблазнительно простой способ получить ключ, но он не различает `undefined` и отсутствующее поле, по-разному сериализует объекты с одинаковым содержимым, но разным порядком ключей, не умеет функции и `Symbol`, и не различает `NaN`-граничные случаи так, как ожидал бы автор.

```ts
function memoize<Args extends unknown[], R>(fn: (...args: Args) => R) {
  const cache = new Map<string, R>();
  return (...args: Args): R => {
    const key = JSON.stringify(args); // работает для простых случаев, см. подводные камни
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
```

Надёжнее для **одного** объектного аргумента — вложенный `Map`/`WeakMap` по ссылке на сам объект (а не его сериализацию): тогда равенство по ссылке решает всё быстро и без искажений. Для нескольких примитивных аргументов (числа, строки) вложенные `Map` по каждому аргументу по очереди — тоже надёжнее сериализации и дешевле по CPU, чем `JSON.stringify` на каждый вызов.

### Подводные камни
- `JSON.stringify({ a: 1, b: 2 })` и `JSON.stringify({ b: 2, a: 1 })` дают разные строки для содержательно одинаковых объектов — кэш не найдёт совпадение.
- `JSON.stringify` пропускает поля со значением `undefined` и не умеет функции — два разных набора аргументов могут дать одинаковый ключ.
- Неограниченный рост `Map`-кэша без вытеснения (LRU или по размеру) — memoize сам становится утечкой памяти при большом разнообразии аргументов.

### Что спросят дальше
- Как `WeakMap` помогает memoize не удерживать объект-аргумент в памяти вечно?
- Чем мемоизация функции отличается от мемоизации React-компонента через `React.memo`?

### Ссылки
- [Map — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map)
- [WeakMap — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap)

# Как реализовать доступную модалку: фокус, Escape, блокировка прокрутки?
@slug accessible-modal
@topic quality
@verified react@19.3
@updated 2026-11

> Доступная модалка должна при открытии перенести фокус внутрь себя (обычно на первый интерактивный элемент или на заголовок), запереть `Tab`/`Shift+Tab` внутри себя (focus trap — фокус не должен уходить на контент под модалкой), закрываться по `Escape`, блокировать прокрутку фона и при закрытии вернуть фокус туда, откуда модалку открыли — иначе пользователь клавиатуры и скринридера теряет место, на котором был.

```tsx
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    document.body.style.overflow = 'hidden'; // блокировка прокрутки фона

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapFocus(e, dialogRef.current!); // держит фокус внутри диалога
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      triggerRef.current?.focus(); // возврат фокуса туда, откуда открыли
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" tabIndex={-1} ref={dialogRef}>
      {children}
    </div>
  );
}
```

`role="dialog"` и `aria-modal="true"` сообщают вспомогательным технологиям, что контент за пределами модалки сейчас недоступен для взаимодействия — без этого скринридер может продолжить объявлять элементы фона, как будто модалки нет.

### Подводные камни
- Не возвращать фокус элементу, который открыл модалку, при закрытии — пользователь клавиатуры «теряется» в начале страницы.
- Забыть focus trap — `Tab` уводит фокус на невидимый (перекрытый) контент под модалкой, что сбивает с толку и мышиного, и клавиатурного пользователя.
- Не остановить прокрутку body, пока модалка открыта — на мобильных это особенно заметно: фон скроллится «сквозь» модалку.

### Что спросят дальше
- Чем `<dialog>` со встроенным `showModal()` отличается от самодельной реализации на `div` + `role="dialog"`?
- Как focus trap должен себя вести, если внутри модалки нет ни одного фокусируемого элемента?

### Ссылки
- [ARIA: dialog role — MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/dialog_role)
- [<dialog>: The Dialog element — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)

# Как переключать светлую/тёмную тему без мигания неверной темой при загрузке?
@slug theme-switch-no-fouc
@topic ecosystem
@verified react@19.3
@updated 2026-11

> `prefers-color-scheme` в CSS даёт тему по умолчанию из настроек ОС, а ручной выбор пользователя обычно хранят в `localStorage` и применяют через атрибут на `<html>` (например, `data-theme="dark"`). Проблема мигания (FOUC — flash of unstyled/incorrect content) возникает, если тему применяют уже после того, как React загрузился и срендерился: страница на долю секунды показывает тему по умолчанию, а потом перескакивает на сохранённую.

```html
<!-- Инлайн-скрипт в <head>, до рендера React — выполняется синхронно, до первой отрисовки -->
<script>
  (function () {
    const saved = localStorage.getItem('theme');
    const theme = saved ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

```css
:root { --bg: #fff; --text: #111; }
:root[data-theme='dark'] { --bg: #111; --text: #eee; }
/* Без ручного выбора — doверяем системной теме через media query */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { --bg: #111; --text: #eee; }
}
```

Ключевая идея — применить сохранённую тему **синхронным** скриптом в `<head>` до того, как браузер начнёт рендерить `<body>`, а не ждать гидратации React. В SSR/RSC-приложениях этот же инлайн-скрипт встраивают в HTML-шаблон, и его нужно исключить из проверки совпадения при гидратации (атрибут на `<html>`, выставленный до рендера React, не считается ошибкой гидрации, потому что React не рендерит сам `<html>` целиком).

### Подводные камни
- Применять тему в `useEffect` после монтирования React — это гарантированно вызывает мигание, потому что первый кадр уже отрисован с темой по умолчанию.
- Хранить выбор только в React state без `localStorage` — тема сбрасывается при каждой перезагрузке страницы.
- Забыть `matchMedia(...).addEventListener('change', ...)` — если пользователь не выбирал тему вручную, а поменял системную тему ОС прямо во время сессии, страница не обновится сама.

### Что спросят дальше
- Почему инлайн-скрипт в `<head>` не ломает гидрацию, хотя меняет DOM до рендера React?
- Как синхронизировать выбор темы между несколькими открытыми вкладками одного сайта?

### Ссылки
- [prefers-color-scheme — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [matchMedia() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)

# Как оптимизировать загрузку изображений для LCP и без сдвигов разметки?
@slug image-optimization-lcp
@topic performance
@verified react@19.3
@updated 2026-11

> Для изображения, которое, скорее всего, станет LCP-элементом (крупная картинка в первом экране), нужно: явно задать `width`/`height` (браузер резервирует место до загрузки — без этого CLS), отдать `fetchpriority="high"` вместо `loading="lazy"` (его не откладывают), а остальным изображениям ниже экрана — наоборот, `loading="lazy"`, чтобы не тратить полосу на то, что пользователь ещё не видит.

```tsx
<img
  src="/hero.webp"
  srcSet="/hero-480.webp 480w, /hero-960.webp 960w, /hero-1920.webp 1920w"
  sizes="(max-width: 600px) 480px, (max-width: 1200px) 960px, 1920px"
  width={1920}
  height={1080}
  fetchPriority="high"
  alt="Описание для скринридера"
/>

<img src="/below-fold.webp" width={800} height={600} loading="lazy" alt="…" />
```

`srcSet` + `sizes` дают браузеру выбрать подходящий по размеру файл для текущего viewport и плотности пикселей — без этого даже на маленьком экране может загрузиться файл, рассчитанный на 4K-дисплей. Современные форматы AVIF и WebP дают заметно меньший размер файла при том же визуальном качестве, чем JPEG/PNG; их обычно подключают через `<picture>` с фолбэком на более совместимый формат для старых браузеров.

### Подводные камни
- Не указать `width`/`height` (или `aspect-ratio` в CSS) — браузер не знает заранее, сколько места займёт изображение, и сдвигает остальной контент, когда оно догружается (CLS).
- Поставить `loading="lazy"` на LCP-изображение в первом экране — браузер намеренно откладывает его загрузку, что как раз ухудшает LCP.
- Отдавать один и тот же огромный файл всем устройствам без `srcSet` — мобильный пользователь на медленной сети скачивает мегабайты ради экрана в несколько сотен пикселей.

### Что спросят дальше
- Как браузер решает, какой элемент считать LCP-кандидатом на конкретной странице?
- Чем `<picture>` с несколькими `<source>` отличается от `srcSet` на одном `<img>`?

### Ссылки
- [Largest Contentful Paint (LCP) — web.dev](https://web.dev/articles/lcp)
- [Responsive images — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images)

# Как сделать бесконечную прокрутку без дублей запросов, использующую `IntersectionObserver`?
@slug infinite-scroll-intersection-observer
@topic performance
@verified react@19.3
@updated 2026-11

> `IntersectionObserver` следит за появлением «якорного» элемента в конце списка в области видимости — вместо того чтобы вручную считать `scrollTop` в обработчике `onScroll` (это срабатывает очень часто и требует троттлинга). Когда якорь становится видимым, запускают загрузку следующей страницы — но только если в этот момент нет уже идущего запроса и список точно не закончился, иначе быстрая прокрутка породит несколько параллельных одинаковых запросов.

```tsx
function useInfiniteScroll(loadMore: () => Promise<boolean>) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // ref, а не state — не должен вызывать лишний ре-рендер
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingRef.current) return;
      loadingRef.current = true;
      const more = await loadMore();
      setHasMore(more);
      loadingRef.current = false;
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return sentinelRef;
}
```

Якорный `<div ref={sentinelRef} />` обычно ставят последним элементом списка (или чуть выше — через опцию `rootMargin`, чтобы подгрузка начиналась заранее, пока пользователь ещё не долистал до самого низа, и прокрутка не «спотыкалась» о паузу загрузки).

### Подводные камни
- Не проверять флаг «уже грузится» перед стартом нового запроса — быстрая прокрутка через несколько пересечений якоря запускает параллельные дублирующие запросы.
- Хранить флаг загрузки в `useState` вместо `useRef` — лишний ре-рендер ради значения, которое не влияет на отображение напрямую.
- Не остановить observer, когда данные закончились (`hasMore === false`) — наблюдатель продолжает бессмысленно существовать, хотя подгружать больше нечего.

### Что спросят дальше
- Чем `rootMargin` у `IntersectionObserver` помогает сгладить паузу загрузки для пользователя?
- Как совместить бесконечную прокрутку с сохранением позиции скролла при возврате на страницу списка назад из карточки?

### Ссылки
- [Intersection Observer API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [IntersectionObserver() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver)
