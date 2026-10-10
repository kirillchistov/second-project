import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Отдельные чанки кешируются независимо: правка текста вопросов не сбрасывает кеш React
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler|cookie)[\\/]/ },
            { name: 'prism', test: /node_modules[\\/]prism-react-renderer[\\/]/ },
            { name: 'content', test: /packages[\\/]content[\\/]/ },
          ],
        },
      },
    },
  },
})
