# В каком порядке выполнятся Promise.then, queueMicrotask, setTimeout и requestAnimationFrame?
@slug raf-microtask-macrotask-order
@topic rendering
@verified react@19.3
@updated 2026-11

> Порядок задаёт не один общий список очередей, а несколько уровней: весь синхронный код выполняется первым, затем **все** накопленные микрозадачи (`Promise.then`, `queueMicrotask`) подряд, пока очередь микрозадач не опустеет. `requestAnimationFrame` коллбэки запускаются перед следующей отрисовкой кадра — после микрозадач текущего цикла, но до того, как браузер реально нарисует кадр. `setTimeout`, даже с задержкой `0`, — это макрозадача: она ждёт своей очереди в event loop и выполняется уже после кадра, нарисованного по rAF.

```ts
console.log('1 sync');
setTimeout(() => console.log('2 setTimeout'), 0);
requestAnimationFrame(() => console.log('3 rAF'));
Promise.resolve().then(() => console.log('4 promise'));
queueMicrotask(() => console.log('5 microtask'));
console.log('6 sync');

// Порядок: 1, 6 (синхронный код) → 4, 5 (все микрозадачи) → 3 (rAF, перед кадром) → 2 (setTimeout, макрозадача)
```

Важная деталь: если внутри rAF-коллбэка запланировать ещё одну микрозадачу, она выполнится сразу после этого rAF-коллбэка, ещё до отрисовки кадра и до следующей макрозадачи — микрозадачи имеют приоритет перед выполнением *любого* следующего шага event loop, а не только перед первой макрозадачей.

### Подводные камни
- Считать `setTimeout(fn, 0)` «немедленным» — он всегда позже не только синхронного кода, но и всех микрозадач, и обычно позже ближайшего rAF.
- Не учитывать, что браузер может объединить несколько rAF-коллбэков в один кадр, если скрипт выполняется быстрее частоты обновления экрана.
- Путать порядок `Promise.then` и `queueMicrotask` между собой — оба попадают в одну и ту же очередь микрозадач и выполняются строго в порядке постановки, без приоритета одного над другим.

### Что спросят дальше
- Почему `async/await` внутренне использует ту же очередь микрозадач, что и `.then()`?
- Как `requestIdleCallback` соотносится по приоритету с `requestAnimationFrame` и макрозадачами?

### Ссылки
- [In the loop — Jake Archibald (конференция JSConf.Asia)](https://www.youtube.com/watch?v=cCOL7MC4Pl0)
- [Tasks, microtasks, queues and schedules — Jake Archibald](https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/)

# Спроектируйте доступный автокомплит: стрелки, Enter, Escape, объявление результатов
@slug accessible-autocomplete
@topic quality
@verified react@19.3
@updated 2026-11

> Доступный автокомплит (ARIA combobox pattern) — это `<input>` с `role="combobox"`, связанный через `aria-controls` со списком `role="listbox"`, и `aria-activedescendant` на самом инпуте, который указывает `id` текущей подсвеченной стрелками опции. Фокус физически остаётся на `<input>` всё время — стрелки лишь двигают визуальное выделение и `aria-activedescendant`, а не переносят DOM-фокус на пункты списка.

```tsx
function Autocomplete({ options, onSelect }: { options: Option[]; onSelect: (o: Option) => void }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const listboxId = useId();

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    if (e.key === 'ArrowUp') setActiveIndex((i) => Math.max(i - 1, 0));
    if (e.key === 'Enter' && activeIndex >= 0) onSelect(options[activeIndex]);
    if (e.key === 'Escape') setActiveIndex(-1);
  }

  return (
    <div>
      <input
        role="combobox" aria-expanded={options.length > 0} aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `opt-${activeIndex}` : undefined}
        value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown}
      />
      <ul role="listbox" id={listboxId}>
        {options.map((o, i) => (
          <li key={o.id} id={`opt-${i}`} role="option" aria-selected={i === activeIndex}>{o.label}</li>
        ))}
      </ul>
      <div aria-live="polite" className="visually-hidden">
        {loading ? 'Загрузка…' : `Найдено вариантов: ${options.length}`}
      </div>
    </div>
  );
}
```

Отдельный `aria-live="polite"` регион с текстом («Найдено вариантов: 5») нужен потому, что сам по себе список с `role="listbox"` не объявляется скринридером заново при каждом изменении количества опций — без явного объявления пользователь скринридера не узнает, что результаты поиска вообще изменились после ввода символа.

### Подводные камни
- Переносить реальный DOM-фокус на пункты списка стрелками вместо `aria-activedescendant` — тогда `<input>` теряет фокус, и дальнейший ввод текста прерывается.
- Не объявлять через `aria-live` изменение числа результатов — визуально список обновляется, а пользователь скринридера не получает обратной связи, если не читает весь список заново вручную.
- Закрывать список по клику вне, но забыть такую же логику для `Escape` и потери фокуса с `<input>` — несогласованное поведение путает и мышиного, и клавиатурного пользователя.

### Что спросят дальше
- Чем `aria-activedescendant` принципиально отличается от переноса реального фокуса между элементами списка?
- Как реализовать debounce запроса к серверу за результатами, не ломая при этом порядок обработки клавиш?

### Ссылки
- [ARIA Authoring Practices: Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [ARIA: combobox role — MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/combobox_role)

# Как cascade layers и CSS Modules вместе решают «войны специфичности» в дизайн-системе?
@slug css-cascade-layers
@topic ecosystem
@verified react@19.3
@updated 2026-11

> Специфичность CSS-селектора — число, не зависящее от порядка объявления в файле, поэтому `.button { }` и более специфичный `.card .button { }` конкурируют по специфичности, а не по тому, какое правило написано позже. В большой дизайн-системе это рано или поздно приводит к `!important` как единственному доступному «молотку», чтобы точно переопределить чужой стиль. `@layer` вводит отдельную ось приоритета **поверх** специфичности: правило из более позднего слоя побеждает правило из более раннего слоя независимо от специфичности внутри них.

```css
@layer reset, base, components, utilities;

@layer base {
  .button { padding: 8px 16px; border-radius: 4px; }
}

@layer components {
  /* Даже очень специфичный селектор из reset-слоя проиграет этому правилу,
     потому что components объявлен позже reset в списке @layer сверху */
  .button { background: var(--accent); }
}

@layer utilities {
  .button.is-compact { padding: 4px 8px; } /* utilities — последний слой, всегда выигрывает */
}
```

CSS Modules решает смежную, но другую проблему — не приоритет, а **коллизию имён**: `.button` в одном файле компонента не конфликтует с `.button` в другом, потому что сборщик генерирует уникальные имена классов на файл. Вместе cascade layers упорядочивают приоритет между слоями стилей (сброс → базовые → компоненты → утилиты), а CSS Modules гарантируют, что классы внутри каждого слоя не пересекаются по имени между разными компонентами.

### Подводные камни
- Объявлять слои в разных файлах в разном порядке — порядок **первого** объявления `@layer name;` в каскаде определяет приоритет слоёв, независимо от того, где позже добавляются правила в каждый слой.
- Пытаться решить проблему специфичности только `!important` — он сам по себе становится новой «войной», потому что внутри `!important`-правил снова работает обычная специфичность.
- Смешивать стили вне всякого `@layer` с слоистыми стилями — безслойные правила по умолчанию приоритетнее **любого** слоя, что может неожиданно всё переопределить.

### Что спросят дальше
- Как `@layer` взаимодействует с `!important` — что произойдёт, если `!important` стоит в раннем слое?
- Чем cascade layers отличаются от BEM как способа избежать конфликтов специфичности?

### Ссылки
- [CSS Cascade Layers — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [CSS cascade layers — web.dev](https://web.dev/articles/css-cascade-layers)

# Как виртуализировать список из 50 000 строк переменной высоты и сохранять позицию прокрутки?
@slug virtualization-variable-height
@topic performance
@verified react@19.3
@updated 2026-11

> Базовая виртуализация с фиксированной высотой строки вычисляет видимый диапазон простой арифметикой: `scrollTop / rowHeight`. С переменной высотой (например, сообщения чата разной длины) это не работает — приходится либо измерять реальную высоту уже отрисованных строк и кэшировать оценки для ещё не отрисованных, либо заранее знать высоту каждой строки из данных.

```tsx
function useVariableVirtualizer(items: Item[], estimateHeight: (i: Item) => number, containerHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const heightCache = useRef(new Map<string, number>()); // измеренная высота по id, по умолчанию — оценка

  const offsets = useMemo(() => {
    let acc = 0;
    return items.map((item) => {
      const top = acc;
      acc += heightCache.current.get(item.id) ?? estimateHeight(item);
      return top;
    });
  }, [items, estimateHeight]); // пересчитывается не на каждый скролл, а когда меняются данные

  const start = offsets.findIndex((top) => top + (heightCache.current.get(items[0]?.id) ?? 0) >= scrollTop);
  const visibleCount = Math.ceil(containerHeight / 40) + 2; // приблизительно, с запасом
  return { range: [Math.max(0, start), start + visibleCount], offsets, onScroll: setScrollTop, heightCache };
}
```

После реальной отрисовки строки её настоящую высоту измеряют через `ResizeObserver` на DOM-узле и записывают в `heightCache`, после чего офсеты последующих строк пересчитывают. Сохранение позиции прокрутки при изменении данных сверху списка (например, подгрузка более старых сообщений чата вверх) требует отдельного трюка: после вставки новых элементов перед текущими нужно скорректировать `scrollTop` на суммарную высоту вставленного **до** следующей отрисовки, иначе видимый контент визуально «прыгнет».

### Подводные камни
- Пересчитывать все офсеты списка на каждое событие `scroll` — дорого при 50 000 элементах; офсеты пересчитывают только при изменении данных, а при скролле просто ищут видимый диапазон по уже посчитанным офсетам.
- Не корректировать `scrollTop` при вставке элементов выше видимой области — список визуально дёргается, хотя логически позиция не должна была смениться.
- Использовать индекс массива как React `key` для виртуализированных строк — при переменной высоте и вставке/удалении элементов это ломает сопоставление DOM-узлов с данными так же, как и в невиртуализированном списке.

### Что спросят дальше
- Как `ResizeObserver` помогает уточнять оценку высоты строки уже после первой отрисовки?
- Чем задача «виртуализация с переменной высотой» отличается от просто «виртуализации» по сложности реализации?

### Ссылки
- [ResizeObserver — MDN](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- [TanStack Virtual — документация](https://tanstack.com/virtual/latest)

# Как CSP, SRI и флаги cookie влияют на архитектуру фронтенд-приложения?
@slug csp-sri-headers
@topic quality
@verified react@19.3
@updated 2026-11

> Content-Security-Policy (CSP) — заголовок ответа сервера, который перечисляет разрешённые источники для скриптов, стилей, изображений и соединений; браузер блокирует всё, что не входит в белый список, **даже если** через XSS удалось внедрить `<script>` в страницу. Это архитектурное ограничение, а не просто защитная мера: `script-src` без `'unsafe-inline'` требует, чтобы все инлайн-скрипты либо выносились в файлы, либо получали nonce, сгенерированный сервером на каждый запрос заново.

```http
Content-Security-Policy: script-src 'self' 'nonce-r4nd0m123' https://cdn.example.com; object-src 'none'
```

```html
<script nonce="r4nd0m123">/* разрешён, потому что nonce совпадает с заголовком этого запроса */</script>
```

Subresource Integrity (SRI) защищает от другой угрозы — компрометации самого CDN, с которого грузится сторонний скрипт: браузер сверяет хэш загруженного файла с указанным в атрибуте `integrity`, и если они не совпадают (файл на CDN подменили), скрипт не выполнится. `HttpOnly` на cookie сессии не даёт JavaScript её прочитать (защита при XSS), `Secure` — не отправляет её по незашифрованному HTTP, а `SameSite` — ограничивает отправку cookie в межсайтовых запросах (защита от CSRF, см. вопрос про сам CSRF). Вместе эти заголовки формируют слои защиты, которые нужно закладывать на уровне архитектуры (откуда вообще грузится код, как генерируется nonce на каждый запрос), а не добавлять постфактум.

### Подводные камни
- Начать с `'unsafe-inline'` в CSP «чтобы заработало» и никогда не вернуться к nonce-подходу — это сводит защиту CSP от XSS почти к нулю.
- Подключать сторонние скрипты без `integrity` — компрометация CDN становится компрометацией всего сайта без какого-либо предупреждения браузера.
- Полагаться только на CSP и забыть `HttpOnly`/`SameSite` для cookie — это независимые уровни защиты от разных векторов атаки, один не заменяет другой.

### Что спросят дальше
- Как сгенерировать уникальный CSP-nonce на каждый серверный рендер в SSR/RSC-приложении?
- Чем CSP-репортинг (`report-uri`/`report-to`) помогает заметить попытки атаки до того, как политику ужесточат окончательно?

### Ссылки
- [Content Security Policy (CSP) — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [Subresource Integrity — MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
