import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/curriculums/convert-pdf': { target: 'http://127.0.0.1:8001', timeout: 240000, proxyTimeout: 240000 },
      '/api/curriculums/converter-health': { target: 'http://127.0.0.1:8001' },
    },
  },
})
