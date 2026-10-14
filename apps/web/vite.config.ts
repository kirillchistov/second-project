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
            '140 актуальных вопросов для собеседования на React-разработчика: Junior, Middle, Senior. React 19, Server Components, React Compiler.',
            'Демо React Refresher: путь обучения в браузере, без сервера и без ИИ. Прогресс хранится в этом браузере.',
          )
          .replace(
            '<title>React Refresher — 140 вопросов для собеседования</title>',
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
              // Вопросы — в обеих сборках, двумя частями: так у банка есть запас до порога в 500 КБ
              { name: 'questions-junior-middle', test: /packages[\\/]content[\\/]questions[\\/](junior|middle)-/ },
              { name: 'questions-senior', test: /packages[\\/]content[\\/]questions[\\/]/ },
              // В демо банк больше 1,5 МБ. Вопросы и упражнения кешируются отдельно и делятся
              // на части примерно по 350 КБ, чтобы ни один файл не перешагнул порог в 500 КБ.
              // Новую тему добавляйте в одну из групп упражнений (иначе она попадёт в последнюю).
              ...(pages
                ? [
                    {
                      name: 'exercises-core',
                      test: /packages[\\/]content[\\/]exercises[\\/](basics|hooks|rendering|state)\.yaml/,
                    },
                    {
                      name: 'exercises-modern',
                      test: /packages[\\/]content[\\/]exercises[\\/](modern|server|performance|typescript|testing)\.yaml/,
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
