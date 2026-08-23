import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 本地开发时，将 /api 开头的请求代理到后端 http://localhost:8123
      '/api': {
        target: 'http://localhost:8123',
        changeOrigin: true
      }
    }
  }
})
