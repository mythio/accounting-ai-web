# accounting-ai-web
财务AI前端

<img width="1280" height="672" alt="首页" src="https://github.com/user-attachments/assets/fb80a41f-ca2d-4300-9362-8f611832a78d" />
<img width="1280" height="764" alt="财务小助手" src="https://github.com/user-attachments/assets/655c5604-5675-4b60-a377-95ebb85bb742" />
<img width="1280" height="761" alt="财务智能体" src="https://github.com/user-attachments/assets/b7d5ea16-cb30-439c-a9d5-cbe6cf7b33bb" />

---

## 项目说明

一个用于切换多个 AI 应用的前端项目，包含三个页面：

1. 主页：应用入口，用于切换不同的应用
2. 财务专家（AI 财务小助手）：聊天室风格的流式对话（SSE 实时输出）
3. AI 财务超级智能体：聊天室风格的流式对话（SSE 实时输出）

## 技术栈

- Vue 3（Composition API / `<script setup>`）
- Vite
- Vue Router
- Axios（SSE 流式读取基于 `onDownloadProgress` 实现）

## 快速开始

```bash
npm install
npm run dev
```

启动后访问 http://localhost:5173 ，Vite 会把 `/api` 开头的请求代理到后端
`http://localhost:8123`，避免开发环境跨域问题。

## 接口对接

| 功能 | 后端方法 | 前端请求 | 参数 |
| --- | --- | --- | --- |
| 财务专家 | `doChatAccountAppSse` | `GET /api/ai/accountingAssistant/chat/sse` | `message`、`chatId` |
| AI 超级智能体 | `doChatAccountManus` | `GET /api/ai/accountingManus/chat` | `message` |

- 财务专家页面进入后会自动生成一个 UUID 形式的聊天室 ID（`chatId`）用于区分不同会话，
  展示在聊天页头部，点击可复制。
- AI 超级智能体页面同样会生成并展示会话 ID；后端若不需要 `chatId` 参数会自动忽略。
- 后端地址可通过环境变量覆盖：新建 `.env.local`，写入
  `VITE_API_BASE_URL=https://your-host/api`。

## 生产部署建议

使用 Nginx 反向代理后端并关闭缓冲，SSE 才能实时推送：

```nginx
location /api/ {
    proxy_pass http://localhost:8123/api/;
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
}
```

## 目录结构

```
src/
├── api/          # Axios 实例与 SSE 流式接口封装
├── components/   # ChatRoom 聊天室公共组件
├── composables/  # 会话存储（多会话历史记录）
├── router/       # 路由
├── styles/       # 全局样式
└── views/        # 主页 / 财务专家 / AI 超级智能体
```

## 常见问题

- 接口请求失败：开发环境请通过 Vite 代理访问（`/api -> http://localhost:8123`）。
- 无实时输出：确认后端返回 `text/event-stream`；当前封装同时兼容纯文本流。
