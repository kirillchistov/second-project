import type { Catalog } from '../../src/catalog.ts';

/** Продуктовый каталог. Это не грейды Junior/Middle/Senior и не банк React. */
export const PRODUCT_CATALOG: Catalog = {
  id: 'product',
  lessonPrefix: 'product',
  levels: [
    {
      id: 'practice',
      title: 'Практика',
      description: 'Короткий рабочий путь: от проблемы до эксперимента. Без грейдов и без проверки свободного текста.',
    },
  ],
  topics: [
    { id: 'problem', title: 'Проблема', description: 'Кто страдает, в какой ситуации и почему это стоит решать' },
    { id: 'discovery', title: 'Discovery', description: 'Возможности из исследований, а не список фич' },
    { id: 'priority', title: 'Приоритет', description: 'Одно решение на страницу: что делаем и чего не делаем' },
    { id: 'experiment', title: 'Эксперимент', description: 'Гипотеза, метрика и правило решения до того, как смотреть результат' },
  ],
  units: [
    {
      id: 'discovery',
      title: 'Discovery',
      goal: 'Сформулировать проблему, выбрать возможность и проверить её экспериментом',
      topics: ['problem', 'discovery', 'priority', 'experiment'],
    },
  ],
};
