import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** В продуктовой сборке те же импорты смотрят в каталог продукта, а не в банк React. */
function productCatalog(): Plugin {
  return {
    name: 'product-catalog',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || !/(questions|exercises|quizzes)\.react(\.ts)?$/.test(source)) return
      const swapped = source.replace('.react.ts', '.product.ts').replace('.react', '.product')
      if (swapped === source) return
      const resolved = await this.resolve(swapped, importer, { skipSelf: true })
      return resolved?.id
    },
  }
}

/** Проектный сайт GitHub Pages живёт в подкаталоге; пользовательский — в корне. */
function pagesBase(): string {
  const raw = process.env.VITE_BASE?.trim() || '/'
  if (raw === '/') return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`
}

/** Демо подключается только в `vite --mode pages`, обычная сборка для Vercel его не видит. */
function pagesEntry(): Plugin {
  return {
    name: 'pages-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace('src="/src/main.tsx"', 'src="/src/demo/main.tsx"')
          .replace(
            '224 актуальных вопроса для собеседования на React-разработчика: Junior, Middle, Senior. React 19, Server Components, React Compiler.',
            'Демо React Refresher: путь обучения в браузере, без сервера и без ИИ. Прогресс хранится в этом браузере.',
          )
          .replace(
            '<title>React Refresher — 224 вопроса для собеседования</title>',
            '<title>React Refresher — демо</title>',
          )
      },
    },
  }
}

/** Заголовок продуктовой сборки. React-банк в неё не подключается: его выбирает alias каталога. */
function productEntry(): Plugin {
  return {
    name: 'product-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(
            '224 актуальных вопроса для собеседования на React-разработчика: Junior, Middle, Senior. React 19, Server Components, React Compiler.',
            'Короткий путь продакта: теория, квиз и рабочие шаблоны. Без голосовой проверки и без оценки свободного текста.',
          )
          .replace(
            '<title>React Refresher — 224 вопроса для собеседования</title>',
            '<title>Практикум продукта</title>',
          )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages'
  const product = mode === 'product'
  return {
    base: pages ? pagesBase() : '/',
    plugins: [react(), ...(product ? [productCatalog(), productEntry()] : []), ...(pages ? [pagesEntry()] : [])],
    server: product ? { port: 5175 } : undefined,
    build: {
      rolldownOptions: {
        output: {
          // Отдельные чанки кешируются независимо: правка текста вопросов не сбрасывает кеш React
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler|cookie)[\\/]/ },
              { name: 'prism', test: /node_modules[\\/]prism-react-renderer[\\/]/ },
              // Вопросы — в обеих сборках, двумя частями: так у банка есть запас до порога в 500 КБ
              { name: 'questions-junior-middle', test: /packages[\\/]content[\\/]questions[\\/](junior|middle)-/ },
              { name: 'questions-senior', test: /packages[\\/]content[\\/]questions[\\/]/ },
              // Банк упражнений больше 1,5 МБ и теперь есть и на сайте, и в демо.
              // Вопросы и упражнения кешируются отдельно и делятся на части примерно по 350 КБ,
              // чтобы ни один файл не перешагнул порог в 500 КБ.
              // Новую тему добавляйте в одну из групп упражнений (иначе она попадёт в последнюю).
              {
                name: 'exercises-core',
                test: /packages[\\/]content[\\/]exercises[\\/](basics|hooks|rendering|state)\.yaml/,
              },
              {
                name: 'exercises-modern',
                test: /packages[\\/]content[\\/]exercises[\\/](modern|server|performance|typescript|testing)\.yaml/,
              },
              { name: 'exercises-rest', test: /packages[\\/]content[\\/]exercises[\\/]/ },
              { name: 'content', test: /packages[\\/]content[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
