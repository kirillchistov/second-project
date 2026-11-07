# Дополнительные темы

Ниже — 60 дополнительных заданий, сформулированных так, чтобы они дополняли типичные React/TypeScript-пулы и не повторяли базовые темы вроде простого `useState`, `useEffect`, пропсов и JSX. Я сделал упор на современные React 19, TypeScript, браузерные API, производительность, доступность, тестирование и архитектурные сценарии, которые часто встречаются в актуальных frontend-интервью.[^1][^2][^3]

## React и React 19

**Источник: GreatFrontEnd — подборка вопросов от ex-интервьюеров; актуальные React-интервью-гайды.**[^4][^1]

1. Объясните разницу между фазами **render** и **commit** в React. Какие операции нельзя выполнять в render-фазе?
2. Почему React может повторно вызывать рендер компонента в режиме разработки и как писать код, устойчивый к этому?
3. В каких ситуациях `useEffect` не нужен вовсе? Перепишите компонент, который синхронизирует вычисляемое состояние через effect.
4. Когда нужен `useLayoutEffect`, а когда `useEffect`? Приведите пример с измерением DOM.
5. Спроектируйте компонент с `Suspense`: загрузка профиля, skeleton, обработка ошибки и повторная попытка.
6. Объясните, как `startTransition` влияет на отзывчивость интерфейса. Реализуйте поиск, где ввод не блокируется тяжёлой фильтрацией.
7. Реализуйте optimistic update для добавления комментария: мгновенное появление, серверное подтверждение, rollback при ошибке.
8. В каких случаях стоит применять `useDeferredValue`? Реализуйте таблицу с дорогой фильтрацией и отложенным обновлением результатов.
9. Что такое Server Components и чем они отличаются от Client Components с точки зрения исполнения, сериализации и границ данных?
10. Объясните причины hydration mismatch в SSR-приложении и предложите способ диагностировать и устранить проблему.

## Состояние и архитектура React

**Источник: scenario-based набор Frontend Interview Questions; GitHub-подборки реальных frontend-вопросов.** В таких задачах часто проверяют разделение локального и серверного состояния, API компонентов и масштабируемость решений.[^2][^5]

11. Спроектируйте state-модель для многошаговой формы с автосохранением, возвратом на предыдущий шаг и восстановлением черновика после перезагрузки.
12. Как отличить UI state, server state, URL state и form state? Разложите состояние интернет-магазина по этим категориям.
13. Спроектируйте API compound-компонента `<Tabs>` с поддержкой клавиатуры, controlled/uncontrolled режима и динамических вкладок.
14. Реализуйте `useControllableState<T>`: хук должен поддерживать `value`, `defaultValue` и `onChange` без рассинхронизации.
15. Как предотвратить лишние ререндеры при использовании Context в большом приложении? Сравните разделение контекстов, selector-подход и внешний store.
16. Спроектируйте глобальную систему уведомлений: очередь, типы уведомлений, auto-dismiss, ручное закрытие, accessibility и лимит одновременных toast’ов.
17. Реализуйте undo/redo для редактора списка задач, учитывая группировку быстрых последовательных изменений.
18. Как безопасно хранить состояние фильтров в URL и синхронизировать его с UI без циклических обновлений?
19. Предложите архитектуру feature-based frontend-проекта: где живут API-клиенты, UI-kit, фичи, сущности, маршруты и тесты.
20. Спроектируйте механизм feature flags: типизированные ключи, значения по умолчанию, удалённая конфигурация и безопасный fallback.

## TypeScript

**Источник: TypeScript interview-подборки и frontend-репозитории с вопросами по React/TS.** Темы включают различия `type`/`interface`, utility types и типизацию React-компонентов.[^6][^7][^2]

21. В чём практическая разница между `type` и `interface`? Покажите ситуацию, где declaration merging делает `interface` предпочтительнее.
22. Создайте тип `DeepReadonly<T>`, рекурсивно делающий вложенные поля readonly, включая массивы.
23. Напишите `DeepPartial<T>` и поясните, почему наивная рекурсивная версия может неверно работать с массивами, функциями и `Date`.
24. Реализуйте тип, который извлекает параметры маршрута из строки `'/users/:userId/posts/:postId'`.
25. Создайте discriminated union для состояний загрузки: `idle | loading | success | error`, исключив доступ к данным в неверном состоянии.
26. Почему `any` опаснее, чем `unknown`? Перепишите функцию парсинга JSON с `unknown`, type guard и валидным error flow.
27. Реализуйте generic-компонент `<Select<T>>`, который получает элементы, функцию отображения и callback выбора с корректно выведенным типом.
28. Когда использовать `as const`, `satisfies` и обычную аннотацию типа? Покажите разницу на конфигурации роутов.
29. Типизируйте полиморфный UI-компонент `<Button as="a" | "button">`, чтобы пропсы и ref соответствовали выбранному HTML-элементу.
30. Реализуйте type guard `isApiError(error): error is ApiError` и объясните, как он улучшает обработку исключений в `catch`.

## JavaScript и браузер

**Источник: актуальные frontend-интервью-подборки, охватывающие JavaScript, браузер и React.**[^8][^9][^2]

31. Предскажите порядок вывода `console.log` для комбинации `Promise.then`, `queueMicrotask`, `setTimeout` и `requestAnimationFrame`, затем объясните очереди задач браузера.
32. Реализуйте `debounce` с методами `cancel()` и `flush()`, сохранив типы аргументов и возвращаемого значения.
33. Реализуйте `throttle` и объясните различие между leading/trailing edge на примере аналитики скролла.
34. Напишите функцию `memoize` для функций с несколькими аргументами и обсудите, почему сериализация аргументов через `JSON.stringify` ненадёжна.
35. Объясните утечку памяти из-за event listener, timer и замыкания. Найдите проблему в React-компоненте с подпиской на `window`.
36. Реализуйте отменяемую загрузку данных через `AbortController`; корректно обработайте смену запроса и размонтирование компонента.
37. В чём разница между `structuredClone`, spread-оператором и `JSON.parse(JSON.stringify())` для копирования данных?
38. Спроектируйте retry-обёртку для `fetch`: экспоненциальная задержка, jitter, максимум попыток, отмена и запрет retry для части HTTP-статусов.
39. Объясните разницу между `localStorage`, `sessionStorage`, IndexedDB и Cache Storage. Где хранить офлайн-черновики и почему?
40. Реализуйте клиент для пагинированного API, защищённый от race condition при быстром переключении фильтров.

## HTML, CSS и доступность

**Источник: Frontend Interview Questions \& Answers и scenario-based вопросы, где accessibility рассматривается как часть качества UI.**[^5][^2]

41. Реализуйте accessible modal: фокус при открытии, focus trap, возврат фокуса, `Escape`, блокировка прокрутки и правильные ARIA-атрибуты.
42. Спроектируйте accessible autocomplete: управление стрелками, `Enter`, `Escape`, announcement для screen reader и загрузка результатов.
43. Объясните, почему нельзя заменять все интерактивные элементы на `<div onClick>`. Перепишите такой компонент семантично.
44. Как реализовать responsive layout карточек без JavaScript, используя CSS Grid, `minmax()` и container queries?
45. Найдите причины layout shift в карточке товара и предложите исправления для изображений, веб-шрифтов и асинхронного контента.
46. Сравните CSS specificity, cascade layers и CSS Modules. Как избежать “войн специфичности” в дизайн-системе?
47. Реализуйте переключение светлой/тёмной темы с `prefers-color-scheme`, ручным выбором пользователя и отсутствием flash неверной темы.
48. Объясните разницу между визуально скрытым текстом и `display: none`. В каких случаях каждый подход корректен?
49. Спроектируйте компонент tooltip, который работает для mouse, keyboard и touch, не нарушая доступность.
50. Как проверить цветовой контраст и состояние focus? Назовите минимум три типовые ошибки доступности в формах.

## Производительность и Web Platform

**Источник: современные React-интервью-гайды и сценарные frontend-задачи, где отдельно рассматриваются отзывчивость, real-time UI и оптимизация.**[^10][^1][^5]

51. У вас виртуализированный список на 50 000 строк. Как реализовать windowing, измерение строк переменной высоты и сохранение позиции прокрутки?
52. Как профилировать медленный React-экран? Опишите последовательность: React Profiler, Performance panel, network waterfall и поиск дорогих вычислений.
53. В каких случаях `React.memo`, `useMemo` и `useCallback` ухудшают код или производительность? Как подтвердить необходимость оптимизации измерениями?
54. Спроектируйте стратегию code splitting для dashboard-приложения: маршруты, тяжёлые виджеты, prefetch и error boundary.
55. Как оптимизировать загрузку изображений: `srcset`, `sizes`, AVIF/WebP, lazy loading, LCP-изображение и предотвращение CLS?
56. Спроектируйте offline-first поведение для списка задач: Service Worker, кэширование, локальная очередь мутаций и синхронизация после восстановления сети.
57. Реализуйте infinite scroll, который не создаёт дублирующих запросов, корректно обрабатывает конец списка и использует `IntersectionObserver`.
58. Как диагностировать долгий TTI/INP на странице? Назовите возможные источники long tasks и варианты снижения нагрузки.
59. Спроектируйте обработку real-time обновлений по WebSocket: reconnect, backoff, дедупликация событий, порядок сообщений и очистка ресурсов.
60. Объясните, как CSP, SRI, `HttpOnly`/`Secure`/`SameSite` cookies и защита от XSS/CSRF влияют на архитектуру frontend-приложения.

## Как использовать набор

Для практики удобно чередовать форматы: 20 вопросов на объяснение концепций, 20 задач на написание кода и 20 архитектурно-сценарных разборов. В опубликованных наборах реальных вопросов особенно часто встречаются reusable modal, работа с несколькими API, рефакторинг legacy-кода, drag-and-drop, таблицы, real-time dashboard и интеграции с rate limit — поэтому я не включал их как отдельные пункты, а сместил фокус на соседние, более узкие и современные навыки.[^11]

<span style="display:none">[^12][^13][^14][^15]</span>

<div align="center">⁂</div>

[^1]: https://www.greatfrontend.com/blog/100-react-interview-questions-straight-from-ex-interviewers

[^2]: https://github.com/readytodev-pro/frontend-interview-questions

[^3]: https://mimo.org/blog/front-end-developer-interview-questions

[^4]: https://www.interviewbit.com/react-interview-questions/

[^5]: https://github.com/ArminShaikhy/frontend-interview-questions/blob/main/scenario-based-questions/questions.md

[^6]: https://github.com/topics/typescript-interview-questions

[^7]: https://www.datacamp.com/blog/typescript-interview-questions

[^8]: https://dev.to/maurya-sachin/650-frontend-interview-questions-javascript-react-nextjs-more-my-complete-prep-journey-12in

[^9]: https://github.com/topics/frontend-interview-preparation?o=desc\&s=forks

[^10]: https://www.onlyfrontendjobs.com/blog/frontend-developer-interview-questions-2026

[^11]: https://github.com/topics/interview-preparation?l=typescript

[^12]: https://github.com/greatfrontend/top-reactjs-interview-questions

[^13]: https://www.linkedin.com/pulse/react-interview-guide-2026-questions-every-frontend-developer-misal-48khf

[^14]: https://github.com/GTech1256/frontend-interview-questions-react-js

[^15]: https://github.com/topics/frontend-interview

