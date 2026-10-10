/**
 * Вопросы из старой версии (PDF «React JS: 50 вопросов на собеседование»)
 * и куда они переехали в обновлённом списке.
 */
export interface LegacyQuestion {
  number: number;
  title: string;
  /** slug нового вопроса, который покрывает старый */
  target: string;
  /** Что поменялось по сути */
  note?: string;
}

export const LEGACY: LegacyQuestion[] = [
  { number: 1, title: 'Что такое React?', target: 'what-is-react' },
  { number: 2, title: 'Какие основные преимущества есть в React?', target: 'what-is-react', note: 'Объединён с вопросом «Что такое React?»' },
  { number: 3, title: 'Какие есть ограничения в React?', target: 'what-is-react', note: 'Объединён с вопросом «Что такое React?»' },
  { number: 4, title: 'Что такое JSX?', target: 'jsx', note: 'Добавлен новый JSX transform (react/jsx-runtime)' },
  { number: 5, title: 'Что такое Virtual DOM в React?', target: 'virtual-dom' },
  { number: 6, title: 'Что такое Props?', target: 'props', note: 'defaultProps для функций удалены в React 19' },
  { number: 7, title: 'Что такое state и как он используется?', target: 'state-vs-props', note: 'State нельзя мутировать — в старом ответе была ошибка' },
  { number: 8, title: 'Что такое refs в React?', target: 'use-ref', note: 'ref как обычный prop в React 19' },
  { number: 9, title: 'Что такое JEST?', target: 'testing-library', note: 'Теперь про Testing Library и Vitest' },
  { number: 10, title: 'Когда использовать Class компоненты, а когда функциональные?', target: 'legacy-migration', note: 'Классы — только legacy и Error Boundaries' },
  { number: 11, title: 'Что происходит, когда вы вызываете setState?', target: 'use-state' },
  { number: 12, title: 'В чем разница между state и props?', target: 'state-vs-props' },
  { number: 13, title: 'Когда следует делать асинхронные запросы на сервер?', target: 'use-effect-basics', note: 'Плюс гонки запросов и библиотеки данных' },
  { number: 14, title: 'В чем смысл специального атрибута key?', target: 'keys' },
  { number: 15, title: 'Что значит компонент mounted?', target: 'lifecycle' },
  { number: 16, title: 'Контролируемый и неконтролируемый компонент', target: 'controlled-vs-uncontrolled', note: 'Добавлены form actions React 19' },
  { number: 17, title: 'Что такое фрагменты?', target: 'fragments' },
  { number: 18, title: 'Как React обрабатывает пользовательские события?', target: 'events', note: 'Делегирование на root с React 17, без event pooling' },
  { number: 19, title: 'Что такое Redux?', target: 'redux-toolkit', note: 'Только через Redux Toolkit' },
  { number: 20, title: 'Основные этапы жизненного цикла компонента', target: 'lifecycle', note: 'Через эффекты, с таблицей соответствия классам' },
  { number: 21, title: 'setState: объект или функция?', target: 'batching', note: 'Автоматический батчинг React 18' },
  { number: 22, title: 'Презентационный и контейнер компонент', target: 'project-structure', note: 'Паттерн устарел — сейчас хуки и фичевая структура' },
  { number: 23, title: 'Что такое Context?', target: 'context' },
  { number: 24, title: 'Что такое Higher-Order компоненты?', target: 'hoc-render-props-hooks' },
  { number: 25, title: 'Что делает shouldComponentUpdate?', target: 'react-memo', note: 'Аналог в функциях — memo' },
  { number: 26, title: 'Что такое store в Redux?', target: 'redux-toolkit' },
  { number: 27, title: 'Что такое action в Redux?', target: 'redux-toolkit' },
  { number: 28, title: 'Что нельзя делать в методе render?', target: 'purity-strict-mode' },
  { number: 29, title: 'Какие типы middleware есть в redux для асинхронности?', target: 'redux-async', note: 'Плюс RTK Query' },
  { number: 30, title: 'Что такое Pure Components?', target: 'react-memo' },
  { number: 31, title: 'Почему не стоит изменять state напрямую?', target: 'immutable-updates' },
  { number: 32, title: 'Как изменить state, используя динамический ключ?', target: 'immutable-updates' },
  { number: 33, title: 'Что такое Error Boundaries?', target: 'error-boundaries', note: 'Плюс react-error-boundary и onCaughtError' },
  { number: 34, title: 'Что такое React Hooks?', target: 'rules-of-hooks' },
  { number: 35, title: 'В чем разница между useRef и createRef?', target: 'use-ref' },
  { number: 36, title: 'Что такое useState?', target: 'use-state' },
  { number: 37, title: 'Что такое prop drilling и как этого избежать?', target: 'prop-drilling', note: 'Сначала композиция, потом Context' },
  { number: 38, title: 'Как валидировать props в React?', target: 'typescript-props', note: 'PropTypes удалены в React 19 — TypeScript и Zod' },
  { number: 39, title: 'Зачем делать eject?', target: 'project-setup', note: 'CRA устарел, вопрос неактуален' },
  { number: 40, title: 'Что такое reducer?', target: 'use-reducer' },
  { number: 41, title: 'Разница между Flux и MVC?', target: 'flux-unidirectional' },
  { number: 42, title: 'Что не так с этим кодом?', target: 'stale-closure', note: 'Новый пример — stale closure' },
  { number: 43, title: 'Второй параметр setState', target: 'batching', note: 'Только для классов' },
  { number: 44, title: 'Что такое mapStateToProps и mapDispatchToProps?', target: 'redux-toolkit', note: 'Заменены хуками useSelector/useDispatch' },
  { number: 45, title: 'Что такое React Fiber?', target: 'fiber' },
  { number: 46, title: 'Разница между Flow и PropTypes?', target: 'typescript-advanced', note: 'Flow и PropTypes уступили TypeScript' },
  { number: 47, title: 'Правда ли, что React ре-рендерит всех детей при setState?', target: 'when-rerender' },
  { number: 48, title: 'Как улучшить производительность React-приложения?', target: 'performance-methodology', note: 'Методика: измерения, Web Vitals, Compiler' },
  { number: 49, title: 'Зачем нужен Redux Thunk?', target: 'redux-async' },
  { number: 50, title: 'Ключевое отличие React и Angular?', target: 'react-vs-others', note: 'Добавлены Vue, Svelte и Solid' },
];
