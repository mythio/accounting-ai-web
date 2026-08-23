<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { chatFinanceApp, chatManus } from '../api/chat'
import { loadSessions, saveSessions, migrateLegacySession } from '../composables/useChatStore'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  apiType: { type: String, required: true }, // 'finance-app' | 'manus'
  avatar: { type: String, default: '/images/finance-super-agent.svg' },
  placeholder: { type: String, default: '请输入你的问题，Enter 发送，Shift + Enter 换行' }
})

const sessions = ref({})
const activeSessionId = ref('')
const messages = ref([])
const input = ref('')
const streaming = ref(false)
const chatId = ref('')
const copied = ref(false)
const editingId = ref('')
const editTitle = ref('')
const messageListRef = ref(null)
const textareaRef = ref(null)

let abortController = null
let currentAssistant = null
let saveTimer = null
let isSwitchingSession = false

const shortChatId = computed(() => chatId.value.slice(0, 8))

const welcomeText = computed(() =>
  props.apiType === 'finance-app'
    ? '你好，我是财务专家，可以帮你解答财务分析、报表解读、税务与投资等问题，请告诉我你的需求。'
    : '你好，我是 AI 超级智能体，可以帮你规划、分析并执行各类复杂任务，请告诉我你的需求。'
)

const showTyping = computed(() => {
  if (!streaming.value) return false
  const last = messages.value[messages.value.length - 1]
  return !last || last.role !== 'assistant' || last.content === ''
})

const sessionList = computed(() =>
  Object.values(sessions.value).sort((a, b) => b.updatedAt - a.updatedAt)
)

function generateChatId() {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function appendMessage(role, content) {
  messages.value.push({ role, content })
  scrollToBottom()
  return messages.value[messages.value.length - 1]
}

function onStreamData(chunk) {
  if (!currentAssistant) {
    currentAssistant = appendMessage('assistant', '')
  }
  currentAssistant.content += chunk
  scrollToBottom()
}

function abortStream() {
  abortController?.abort()
  abortController = null
  streaming.value = false
  currentAssistant = null
}

function stopStreaming() {
  abortStream()
}

function isAbortError(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError' || error?.name === 'AbortError'
}

function switchSession(id) {
  if (!sessions.value[id]) return
  abortStream()
  isSwitchingSession = true
  activeSessionId.value = id
  chatId.value = id
  messages.value = (sessions.value[id].messages || []).map((m) => ({ role: m.role, content: m.content }))
  isSwitchingSession = false
  scrollToBottom()
}

function newSession() {
  abortStream()
  isSwitchingSession = true
  activeSessionId.value = ''
  chatId.value = ''
  messages.value = []
  isSwitchingSession = false
  appendMessage('assistant', welcomeText.value)
  scrollToBottom()
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveSessions(props.apiType, activeSessionId.value, sessions.value)
  }, 300)
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function startRename(session) {
  editingId.value = session.id
  editTitle.value = session.title
}

function confirmRename() {
  const id = editingId.value
  if (id && sessions.value[id]) {
    const title = editTitle.value.trim()
    if (title) {
      sessions.value[id].title = title
      sessions.value = { ...sessions.value }
      scheduleSave()
    }
  }
  editingId.value = ''
  editTitle.value = ''
}

function cancelRename() {
  editingId.value = ''
  editTitle.value = ''
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || streaming.value) return

  input.value = ''
  resetTextareaHeight()
  appendMessage('user', text)

  // 首次发送时创建新会话，标题取第一条提问
  if (!activeSessionId.value) {
    const id = generateChatId()
    const now = Date.now()
    chatId.value = id
    activeSessionId.value = id
    sessions.value = {
      ...sessions.value,
      [id]: {
        id,
        title: text.slice(0, 24),
        createdAt: now,
        updatedAt: now,
        messages: messages.value.map((m) => ({ role: m.role, content: m.content }))
      }
    }
    scheduleSave()
  }

  const sessionIdAtSend = activeSessionId.value
  streaming.value = true

  abortController = new AbortController()
  const signal = abortController.signal

  const request =
    props.apiType === 'finance-app'
      ? chatFinanceApp({ message: text, chatId: chatId.value, onData: onStreamData, signal })
      : chatManus({ message: text, chatId: chatId.value, onData: onStreamData, signal })

  try {
    await request
  } catch (error) {
    if (!isAbortError(error)) {
      appendMessage('assistant', `请求失败：${error?.message || '网络异常，请稍后重试'}`)
    }
  } finally {
    streaming.value = false
    currentAssistant = null
    abortController = null
    // 请求期间如果切换了会话，不要继续操作当前会话
    if (activeSessionId.value !== sessionIdAtSend) return
    scrollToBottom()
  }
}

async function copyChatId() {
  try {
    await navigator.clipboard.writeText(chatId.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    // 剪贴板不可用时静默忽略
  }
}

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

function resetTextareaHeight() {
  const el = textareaRef.value
  if (el) el.style.height = 'auto'
}

onMounted(() => {
  migrateLegacySession(props.apiType)
  const saved = loadSessions(props.apiType)
  if (saved) {
    sessions.value = saved.sessions || {}
    const firstId =
      saved.activeId && sessions.value[saved.activeId]
        ? saved.activeId
        : Object.keys(sessions.value)[0]
    if (firstId) {
      isSwitchingSession = true
      activeSessionId.value = firstId
      chatId.value = firstId
      messages.value = (sessions.value[firstId].messages || []).map((m) => ({
        role: m.role,
        content: m.content
      }))
      isSwitchingSession = false
    }
  }
  if (!chatId.value) {
    appendMessage('assistant', welcomeText.value)
  }
  scrollToBottom()
})

watch(
  messages,
  (val) => {
    if (isSwitchingSession) return
    if (activeSessionId.value && sessions.value[activeSessionId.value]) {
      const session = sessions.value[activeSessionId.value]
      session.messages = val.map((m) => ({ role: m.role, content: m.content }))
      session.updatedAt = Date.now()
      sessions.value = { ...sessions.value }
    }
    scheduleSave()
  },
  { deep: true }
)

onBeforeUnmount(() => {
  abortController?.abort()
  if (saveTimer) clearTimeout(saveTimer)
  saveSessions(props.apiType, activeSessionId.value, sessions.value)
})
</script>

<template>
  <div class="chat-page">
    <aside class="session-sidebar">
      <button type="button" class="new-session-btn" @click="newSession">＋ 新建会话</button>
      <div class="session-list">
        <div
          v-for="s in sessionList"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === activeSessionId }"
          @click="switchSession(s.id)"
        >
          <template v-if="editingId !== s.id">
            <span class="session-title" :title="s.title">{{ s.title }}</span>
            <span class="session-meta">
              <span class="session-time">{{ formatTime(s.updatedAt) }}</span>
              <button
                type="button"
                class="rename-btn"
                title="重命名会话"
                @click.stop="startRename(s)"
              >
                ✏️
              </button>
            </span>
          </template>
          <div v-else class="session-rename" @click.stop>
            <input
              v-model="editTitle"
              class="rename-input"
              @keydown.enter.prevent="confirmRename"
              @keydown.esc.prevent="cancelRename"
              @blur="confirmRename"
            />
          </div>
        </div>
        <p v-if="!sessionList.length" class="session-empty">暂无历史会话</p>
      </div>
    </aside>

    <div class="chat-main">
    <header class="chat-header">
      <RouterLink to="/" class="back-btn" title="返回首页">←</RouterLink>
      <div class="header-info">
        <h1 class="chat-title">{{ title }}</h1>
        <p v-if="subtitle" class="chat-subtitle">{{ subtitle }}</p>
      </div>
      <button
        v-if="chatId"
        type="button"
        class="chat-id-btn"
        :title="`会话 ID：${chatId}（点击复制）`"
        @click="copyChatId"
      >
        <span v-if="copied" class="copied-tip">已复制</span>
        <span v-else>会话 ID：{{ shortChatId }}</span>
      </button>
    </header>

    <main ref="messageListRef" class="message-list">
      <div
        v-for="(msg, index) in messages"
        :key="`${msg.role}-${index}`"
        class="message-row"
        :class="msg.role === 'user' ? 'row-user' : 'row-assistant'"
      >
        <div v-if="msg.role === 'assistant'" class="avatar avatar-ai" :title="title">
          <img :src="avatar" :alt="title" />
        </div>
        <div v-if="msg.role === 'user'" class="avatar avatar-user" title="我">我</div>
        <div class="bubble">{{ msg.content }}</div>
      </div>

      <div v-if="showTyping" class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </main>

    <footer class="input-bar">
      <textarea
        ref="textareaRef"
        v-model="input"
        rows="1"
        :placeholder="placeholder"
        @input="autoResize"
        @keydown.enter.exact.prevent="sendMessage"
      ></textarea>
      <button v-if="streaming" type="button" class="btn-stop" @click="stopStreaming">停止</button>
      <button
        type="button"
        class="btn-send"
        :disabled="streaming || !input.trim()"
        @click="sendMessage"
      >
        发送
      </button>
    </footer>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  height: 100vh;
  display: flex;
  background:
    linear-gradient(rgba(10, 22, 36, 0.55), rgba(10, 22, 36, 0.55)),
    url('/images/home-bg.png') center / cover no-repeat;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.session-sidebar {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 12px;
  background: rgba(10, 22, 36, 0.72);
  backdrop-filter: blur(8px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
}

.new-session-btn {
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(79, 124, 255, 0.35);
  color: #ffffff;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.new-session-btn:hover {
  background: rgba(79, 124, 255, 0.5);
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.session-item:hover {
  background: rgba(255, 255, 255, 0.12);
}

.session-item.active {
  background: rgba(79, 124, 255, 0.4);
  color: #ffffff;
}

.session-title {
  font-size: 13px;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.session-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.rename-btn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.rename-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.session-rename {
  width: 100%;
}

.rename-input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 13px;
  padding: 7px 9px;
  outline: none;
}

.rename-input:focus {
  border-color: #9ec5ff;
}

.session-empty {
  margin: 8px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}

.chat-header,
.message-list,
.input-bar {
  width: 100%;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: rgba(18, 34, 52, 0.78);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  text-decoration: none;
  font-size: 18px;
  transition: background 0.15s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

.header-info {
  flex: 1;
  min-width: 0;
}

.chat-title {
  margin: 0;
  font-size: 18px;
  color: #ffffff;
}

.chat-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.chat-id-btn {
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
}

.chat-id-btn:hover {
  border-color: #9ec5ff;
  color: #9ec5ff;
}

.copied-tip {
  color: #7ee2a8;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}

.message-list::-webkit-scrollbar,
.session-sidebar::-webkit-scrollbar {
  width: 6px;
}

.message-list::-webkit-scrollbar-track,
.session-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.message-list::-webkit-scrollbar-thumb,
.session-sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 3px;
}

.message-list::-webkit-scrollbar-thumb:hover,
.session-sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
}

.row-user {
  flex-direction: row-reverse;
}

.avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.avatar-ai {
  background: rgba(255, 255, 255, 0.16);
  overflow: hidden;
}

.avatar-ai img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-user {
  background: #4f7cff;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.bubble {
  max-width: 78%;
  padding: 12px 16px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 15px;
}

.row-assistant .bubble {
  background: rgba(30, 48, 68, 0.78);
  color: #ffffff;
  border-radius: 4px 16px 16px 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
}

.row-user .bubble {
  background: linear-gradient(135deg, #4f7cff, #3f6aff);
  color: #fff;
  border-radius: 16px 4px 16px 16px;
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  background: rgba(30, 48, 68, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 4px 16px 16px 16px;
  padding: 14px 16px;
}

.typing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  animation: typing 1.2s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.input-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 14px 18px;
  background: rgba(18, 34, 52, 0.78);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.input-bar textarea {
  flex: 1;
  resize: none;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 15px;
  line-height: 1.5;
  font-family: inherit;
  color: #ffffff;
  outline: none;
  max-height: 160px;
  transition: border-color 0.15s;
}

.input-bar textarea::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.input-bar textarea:focus {
  border-color: #9ec5ff;
}

.btn-send,
.btn-stop {
  border: none;
  border-radius: 12px;
  padding: 10px 22px;
  font-size: 15px;
  cursor: pointer;
  color: #fff;
}

.btn-send {
  background: #4f7cff;
}

.btn-send:hover:not(:disabled) {
  background: #3f6aff;
}

.btn-send:disabled {
  background: rgba(105, 130, 175, 0.5);
  cursor: not-allowed;
}

.btn-stop {
  background: rgba(255, 255, 255, 0.18);
}

.btn-stop:hover {
  background: rgba(255, 255, 255, 0.28);
}
</style>
