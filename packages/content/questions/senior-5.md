# Что такое Cache Components и 'use cache' в Next.js?
@slug cache-components
@topic server
@verified next@16.4, react@19.3
@updated 2026-10

> Cache Components — модель кэширования Next.js, в которой всё динамично по умолчанию, а кэшируется только явно помеченное директивой `'use cache'`. Её можно поставить на функцию, компонент или файл. Время жизни задаёт `cacheLife`, теги для инвалидации — `cacheTag`. При сборке страница превращается в статическую оболочку: всё кэшируемое пререндерится, а динамические части в `<Suspense>` стримятся при запросе (Partial Prerendering). Неявное кэширование `fetch` из ранних версий App Router больше не используется.

```tsx
// next.config.ts — в Next.js 16 включается флагом, в create-next-app с 16.4 включён по умолчанию
export default { cacheComponents: true };

// Кэшируемые данные: результат переиспользуется между запросами
async function getProducts(category: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(`products:${category}`);
  return db.product.findMany({ where: { category } });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <ProductGrid products={await getProducts(slug)} />      {/* в статической оболочке */}
      <Suspense fallback={<CartSkeleton />}>
        <Cart />                                              {/* cookies() → динамика при запросе */}
      </Suspense>
    </>
  );
}

// После изменения — инвалидация по тегу
async function updateProduct(formData: FormData) {
  'use server';
  await db.product.update(/* ... */);
  updateTag('products:keyboards'); // read-your-writes: следующий рендер увидит новые данные
}
```

Ключевые идеи:

- **Явное лучше неявного.** Раньше было трудно понять, почему страница статическая или почему данные устарели. Теперь кэш виден в коде.
- **Динамика требует границы.** Компонент, читающий `cookies()`, `headers()` или некэшированные данные, должен быть внутри `<Suspense>`. Иначе сборка подскажет ошибкой, что страница блокирует оболочку.
- **Ключ кэша** строится из аргументов и замкнутых значений, поэтому они должны сериализоваться.
- **Инвалидация.** `updateTag` в Server Functions — немедленно, для сценария «изменил и сразу вижу». `revalidateTag(tag, profile)` — stale-while-revalidate для фоновых обновлений.
- **Вариации.** `'use cache: private'` — для персональных данных, `'use cache: remote'` — общий кэш между инстансами.

### Подводные камни
- `'use cache'` на функции, которая читает `cookies()` внутри, — ошибка: персональные данные нельзя класть в общий кэш. Их читают снаружи и передают аргументом.
- Слишком широкий тег (`'products'`) после каждой мелкой правки сбрасывает весь каталог и создаёт нагрузку на базу.

### Что спросят дальше
- Чем Partial Prerendering отличается от ISR и SSR?
- Как кэш Next.js сочетается с HTTP-кэшем CDN?

### Ссылки
- [Next.js: Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)
- [Next.js: use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache)

# Где запускать серверный код: долгоживущий Node, serverless или edge?
@slug server-runtimes
@topic server
@updated 2026-10

> Долгоживущий Node-сервер (контейнер, VM) держит соединения, кэши в памяти и WebSocket, но его нужно масштабировать и обслуживать самому. Serverless-функции масштабируются автоматически и стоят ноль в простое, но страдают от холодного старта, ограничений по времени и того, что каждый вызов — новый процесс без общей памяти. Edge-функции работают в точках присутствия CDN рядом с пользователем, стартуют быстро, но рантайм урезан (Web API без полного Node) и далёк от базы данных.

| | Долгоживущий Node | Serverless | Edge |
|---|---|---|---|
| Холодный старт | нет | сотни мс — секунды | единицы мс |
| Длинные задачи, WebSocket | да | ограничено | ограничено |
| Память между запросами | общая | нет гарантий | нет |
| Близость к пользователю | один регион | один регион | везде |
| Близость к базе | рядом | рядом | далеко, если база в одном регионе |
| Масштабирование | вручную или автоскейлер | автоматически | автоматически |

Как выбирать:

- **Edge** — для лёгких решений по запросу без базы: редиректы, геолокация, A/B, проверка подписи токена, персонализация из cookie. Запрос к базе в другом регионе съедает выигрыш, особенно цепочка из нескольких запросов.
- **Serverless рядом с базой** — для типичных SSR и API с неравномерной нагрузкой. Подключения к базе — через пулер (PgBouncer, Data API), иначе тысяча функций исчерпает лимит соединений.
- **Долгоживущий сервер** — для WebSocket, стриминга, фоновых задач, тяжёлых вычислений и стабильной высокой нагрузки, где он дешевле.
- **Гибрид** — частый ответ: статика и оболочка на CDN, SSR в serverless в регионе базы, real-time и очереди на отдельных серверах.

### Подводные камни
- Глобальный кэш в памяти serverless-функции — иллюзия: разные экземпляры не видят друг друга, а сам кэш исчезает при масштабировании.
- «Всё на edge» с базой в одном регионе даёт медленнее, а не быстрее: каждый запрос пересекает океан.

### Что спросят дальше
- Как бороться с холодным стартом serverless?
- Как держать пул соединений к Postgres при serverless?

### Ссылки
- [Vercel: Fluid compute](https://vercel.com/docs/fluid-compute)
- [Cloudflare Workers: How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)

# Как выбрать стиль API: REST, GraphQL или tRPC?
@slug api-styles
@topic fullstack
@updated 2026-10

> REST — ресурсы и HTTP-семантика: простой, кэшируемый на уровне HTTP и CDN, понятный любым клиентам. GraphQL — один эндпоинт и схема, клиент сам выбирает поля. Он решает over- и under-fetching для многих разных клиентов, но усложняет кэширование, авторизацию по полям и защиту от тяжёлых запросов. tRPC — вызов типизированных процедур в TypeScript-монорепо: типы сервера автоматически доступны клиенту без схемы и кодогенерации, но это внутренний API, а не публичный контракт.

```ts
// tRPC: процедура на сервере…
export const appRouter = router({
  orderById: publicProcedure.input(z.object({ id: z.string() })).query(({ input }) => db.order.find(input.id)),
});
export type AppRouter = typeof appRouter;

// …и на клиенте с полным выводом типов, без кодогенерации
const order = trpc.orderById.useQuery({ id: '42' });   // order.data: Order | undefined
```

```graphql
# GraphQL: экран получает ровно нужные поля одним запросом
query OrderScreen($id: ID!) {
  order(id: $id) { id status total items { name qty } customer { name } }
}
```

Критерии выбора:

- **Кто клиенты.** Публичный API для партнёров — REST с OpenAPI. Много разных клиентов с разными потребностями (веб, мобильное, виджеты) — GraphQL. Один TypeScript-фронтенд и бэкенд в одном репозитории — tRPC или Server Functions.
- **Кэширование.** REST использует HTTP-кэш и CDN бесплатно. GraphQL обычно идёт через `POST` и требует клиентского нормализованного кэша или persisted queries.
- **Типобезопасность.** REST — через OpenAPI и генерацию клиента. GraphQL — схема и codegen. tRPC — типы напрямую из кода.
- **Производительность сервера.** GraphQL легко порождает N+1 в резолверах. Нужны DataLoader, ограничение глубины и сложности запросов.
- **Команда и экосистема.** GraphQL требует отдельной экспертизы: схема, федерация, инструменты.

### Подводные камни
- GraphQL без лимитов глубины и сложности позволяет одним запросом положить сервер.
- tRPC-эндпоинты — тоже публичные HTTP-эндпоинты: авторизация и валидация входа обязательны, даже если «их вызывает только наш фронтенд».

### Что спросят дальше
- Как решается N+1 в GraphQL с помощью DataLoader?
- Чем BFF отличается от GraphQL-шлюза?

### Ссылки
- [GraphQL: Best Practices](https://graphql.org/learn/best-practices/)
- [tRPC: Concepts](https://trpc.io/docs/concepts)

# Что такое Backend for Frontend (BFF) и когда он нужен?
@slug bff-pattern
@topic fullstack
@updated 2026-10

> BFF — серверный слой, принадлежащий конкретному фронтенду. Он собирает данные из нескольких сервисов в форму, удобную экрану, хранит токены и секреты вне браузера и даёт клиенту простой стабильный API. Каждый тип клиента (веб, мобильное приложение) может иметь свой BFF. Им владеет фронтенд-команда, поэтому меняется он вместе с UI. В Next.js и других фреймворках с серверными компонентами роль BFF часто берут на себя Server Components и Server Functions.

```ts
// BFF-эндпоинт: один запрос клиента вместо четырёх, токены не покидают сервер
app.get('/bff/order-screen/:id', async (c) => {
  const token = await getServiceToken(c);             // из сессии, не из браузера
  const order = await ordersApi.get(c.req.param('id'), token);
  const [customer, items, delivery] = await Promise.all([
    customersApi.get(order.customerId, token),
    catalogApi.getMany(order.itemIds, token),
    deliveryApi.status(order.id, token).catch(() => null), // некритичное — деградирует мягко
  ]);
  return c.json({
    id: order.id,
    status: order.status,
    customerName: customer.name,
    items: items.map((i) => ({ name: i.title, price: i.price })),
    delivery,                                           // null → UI покажет «статус недоступен»
  });
});
```

Что даёт BFF:

- **Агрегация и меньше запросов с клиента** — особенно важно на мобильных сетях.
- **Безопасность**: OAuth-токены и ключи сервисов на сервере, браузер получает `HttpOnly` cookie сессии (паттерн token handler).
- **Форма данных под экран**: переименование, фильтрация лишнего, версии под старые мобильные клиенты.
- **Устойчивость**: таймауты, кэш, мягкая деградация, когда упал некритичный сервис.

Цена:

- ещё один сервис, который нужно деплоить, мониторить и масштабировать;
- риск превратить BFF в «второй бэкенд» с бизнес-логикой, которая дублирует сервисы;
- при множестве клиентов — дублирование между несколькими BFF.

### Подводные камни
- Бизнес-правила (расчёт цены, права) в BFF расходятся с правилами сервисов. В BFF только композиция и адаптация.
- Последовательные вызовы сервисов там, где можно параллельно, делают BFF медленнее прямых запросов.

### Что спросят дальше
- Чем BFF отличается от API Gateway?
- Как Server Components меняют потребность в отдельном BFF?

### Ссылки
- [Sam Newman: Backends For Frontends](https://samnewman.io/patterns/architectural/bff/)
- [Microsoft: Backends for Frontends pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/backends-for-frontends)

# Что фулстек-разработчику нужно знать о базах данных: индексы, N+1, транзакции?
@slug database-for-frontend
@topic fullstack
@updated 2026-10

> Три вещи определяют, будет ли API быстрым и корректным. **Индексы**: без индекса по полю фильтрации или сортировки база читает всю таблицу. **N+1**: список из N записей и ещё N запросов за связанными данными вместо одного-двух. **Транзакции**: несколько изменений, которые должны примениться вместе или не примениться вовсе. Плюс выбор хранилища: реляционная база по умолчанию, документная или key-value — под конкретные задачи.

```ts
// N+1: 1 запрос за постами + 20 запросов за авторами
const posts = await db.post.findMany({ take: 20 });
for (const p of posts) p.author = await db.user.findUnique({ where: { id: p.authorId } });

// Решение: JOIN или пакетная загрузка
const postsWithAuthors = await db.post.findMany({ take: 20, include: { author: true } });

// Транзакция: списание и запись заказа — атомарно
await db.$transaction(async (tx) => {
  const product = await tx.product.update({
    where: { id, stock: { gte: qty } },               // условие защищает от ухода в минус
    data: { stock: { decrement: qty } },
  });
  await tx.order.create({ data: { productId: product.id, qty, userId } });
});
```

```sql
-- Запрос «последние заказы пользователя» и индекс под него
SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20;
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);
```

Что ещё важно:

- **`EXPLAIN ANALYZE`** показывает, используется ли индекс (`Index Scan`) или таблица читается целиком (`Seq Scan`).
- **Составные индексы** работают слева направо: индекс `(user_id, created_at)` помогает фильтру по `user_id`, но не по одному `created_at`.
- **Индексы не бесплатны**: каждый замедляет запись и занимает место.
- **ORM скрывает запросы.** Включайте лог SQL в разработке, чтобы видеть N+1.
- **Пул соединений.** Соединение с Postgres дорогое, их число ограничено.
- **Миграции** версионируются вместе с кодом. Опасные изменения (переименование колонки) делают в несколько шагов без простоя.

### Подводные камни
- «Прочитать, проверить в коде, записать» без транзакции и блокировки даёт гонку: два запроса одновременно продадут последний товар дважды.
- `OFFSET 100000` заставляет базу прочитать и выбросить сто тысяч строк — для глубокой пагинации нужен курсор.

### Что спросят дальше
- Когда выбрать документную базу вместо реляционной?
- Что такое уровни изоляции транзакций и какие аномалии они предотвращают?

### Ссылки
- [PostgreSQL: Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Use The Index, Luke](https://use-the-index-luke.com/)

# Зачем нужны очереди и фоновые задачи?
@slug queues-background-jobs
@topic fullstack
@updated 2026-10

> Очередь отделяет «принять запрос» от «выполнить работу». API быстро отвечает `202 Accepted`, кладёт задачу в очередь (BullMQ на Redis, SQS, RabbitMQ), а воркеры обрабатывают её отдельно, с повторами при ошибках. Так делают отправку писем, генерацию отчётов, обработку видео и вызовы медленных внешних API. Пиковая нагрузка сглаживается, сбой внешнего сервиса не роняет основной запрос, а воркеры масштабируются независимо.

```ts
// API: ставим задачу и сразу отвечаем
app.post('/reports', async (c) => {
  const { from, to } = await c.req.json();
  const job = await reportsQueue.add('build', { userId: c.get('userId'), from, to }, {
    jobId: `report:${c.get('userId')}:${from}:${to}`, // повторный запрос не создаст дубликат
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  });
  return c.json({ jobId: job.id }, 202);
});

// Воркер: отдельный процесс, можно масштабировать независимо от API
new Worker('reports', async (job) => {
  const file = await buildReport(job.data);
  await notifyUser(job.data.userId, file.url);
}, { connection, concurrency: 4 });
```

Как фронтенд узнаёт о результате:

- **Polling** статуса `GET /jobs/:id` — просто и надёжно, TanStack Query делает это через `refetchInterval`.
- **Push** через SSE или WebSocket, когда задача завершилась.
- **Уведомление вне сессии**: письмо или push, если задача долгая.

Принципы надёжности:

- **At-least-once.** Большинство очередей доставляют задачу минимум один раз, поэтому обработчик должен быть идемпотентным.
- **Повторы с экспоненциальной задержкой** и dead letter queue для задач, которые исчерпали попытки.
- **Outbox-паттерн**: запись в базу и постановка задачи не должны расходиться. Событие пишут в таблицу в той же транзакции, а отдельный процесс публикует его в очередь.
- **Наблюдаемость**: длина очереди, время ожидания, доля ошибок.

### Подводные камни
- «Отправить письмо» прямо в обработчике запроса: SMTP завис — запрос висит, повтор пользователя отправит письмо дважды.
- Задача без идемпотентности при повторной доставке списывает деньги или создаёт запись второй раз.

### Что спросят дальше
- Что такое outbox-паттерн и какую проблему он решает?
- Чем очередь задач отличается от брокера событий (pub/sub, Kafka)?

### Ссылки
- [BullMQ: Documentation](https://docs.bullmq.io/)
- [microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)

# Как сделать повторы запросов безопасными: идемпотентность и ретраи?
@slug idempotency-retries
@topic fullstack
@updated 2026-10

> В сети запрос может дойти, а ответ — потеряться. Клиент не знает, выполнилось ли действие, и повторяет его. Для `GET`, `PUT` и `DELETE` повтор безопасен: они идемпотентны по семантике. Для `POST` (создать заказ, оплатить) нужен **ключ идемпотентности**. Клиент генерирует уникальный ключ на операцию и отправляет его в заголовке `Idempotency-Key`. Сервер при повторе с тем же ключом возвращает сохранённый результат, а не выполняет действие снова.

```ts
// Клиент: один ключ на одну попытку оформления, повторы — с тем же ключом
const key = crypto.randomUUID();
await retry(() => fetch('/api/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  body: JSON.stringify({ orderId, amount }),
}), { attempts: 3, backoff: (n) => 2 ** n * 300 + Math.random() * 300 }); // экспонента + jitter

// Сервер: сохранить ключ атомарно, при повторе вернуть прошлый ответ
app.post('/api/payments', async (c) => {
  const key = c.req.header('idempotency-key');
  if (!key) return c.json({ error: 'idempotency_key_required' }, 400);
  const saved = await db.idempotency.findUnique({ where: { key } });
  if (saved) return c.json(saved.response, saved.status);
  // Уникальный индекс по key: параллельный дубликат упадёт на вставке и не спишет деньги второй раз
  const result = await db.$transaction(async (tx) => {
    const payment = await charge(tx, await c.req.json());
    return tx.idempotency.create({ data: { key, status: 201, response: payment } });
  });
  return c.json(result.response, 201);
});
```

Правила ретраев:

- **Повторять только то, что может пройти**: сетевые ошибки, `429`, `502`, `503`, `504`. `400`, `401`, `403`, `404`, `422` повтор не исправит.
- **Экспоненциальная задержка с jitter**: иначе тысячи клиентов повторяют одновременно и добивают восстанавливающийся сервис.
- **Учитывать `Retry-After`** в ответах `429` и `503`.
- **Ограничивать число попыток и общее время**, а на стороне сервера ставить circuit breaker для зависимостей.
- **Мутации в UI**: блокировать повторную отправку формы (`useFormStatus`, `isPending`) — это UX, но не замена серверной идемпотентности.

### Подводные камни
- Новый ключ на каждый повтор (генерация внутри функции повтора) превращает защиту в пустую формальность.
- TanStack Query по умолчанию повторяет запросы, но не мутации. Включать `retry` для мутации без идемпотентности на сервере опасно.

### Что спросят дальше
- Как сделать ключ идемпотентности для операций, которые повторяет очередь?
- Что такое circuit breaker и зачем он нужен вместе с ретраями?

### Ссылки
- [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [AWS Builders' Library: Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
