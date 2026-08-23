import axios from 'axios'

// 本地开发默认走 Vite 代理（/api -> https://localhost:8123）
// 如需直连后端或对接生产环境，可通过环境变量 VITE_API_BASE_URL 覆盖
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 0 // SSE 长连接不设置超时
})

export default http
