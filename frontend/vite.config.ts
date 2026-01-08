import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100,
    },
    fs: {
      cachedChecks: false // <--- ESSENCIAL PARA O MAC NÃO DAR ERRO 35
    }
  }
})
