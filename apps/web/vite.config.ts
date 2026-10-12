import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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
            '100 актуальных вопросов для собеседования на React-разработчика: Junior, Middle, Senior. React 19, Server Components, React Compiler.',
            'Демо React Refresher: путь обучения в браузере, без сервера и без ИИ. Прогресс хранится в этом браузере.',
          )
          .replace(
            '<title>React Refresher — 100 вопросов для собеседования</title>',
            '<title>React Refresher — демо</title>',
          )
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages'
  return {
    base: pages ? pagesBase() : '/',
    plugins: [react(), ...(pages ? [pagesEntry()] : [])],
    build: {
      rolldownOptions: {
        output: {
          // Отдельные чанки кешируются независимо: правка текста вопросов не сбрасывает кеш React
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler|cookie)[\\/]/ },
              { name: 'prism', test: /node_modules[\\/]prism-react-renderer[\\/]/ },
              // В демо банк больше 500 КБ. Вопросы и упражнения кешируются отдельно,
              // а упражнения делятся надвое, чтобы ни один файл не перешагнул порог.
              ...(pages
                ? [
                    { name: 'questions', test: /packages[\\/]content[\\/]questions[\\/]/ },
                    {
                      name: 'exercises-core',
                      test: /packages[\\/]content[\\/]exercises[\\/](basics|hooks|rendering|state|modern)\.yaml/,
                    },
                    { name: 'exercises-rest', test: /packages[\\/]content[\\/]exercises[\\/]/ },
                  ]
                : []),
              { name: 'content', test: /packages[\\/]content[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
