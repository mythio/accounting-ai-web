const SESSION_PREFIX = 'ai-app-center:sessions:'
const LEGACY_PREFIX = 'ai-app-center:chat:'

// localStorage 不可用时的内存兜底（例如无痕模式）
const memoryStore = new Map()

/**
 * 读取某个应用的所有会话
 * @param {string} apiType 'finance-app' | 'manus'
 * @returns {{ activeId: string|null, sessions: Object<string, {id: string, title: string, createdAt: number, updatedAt: number, messages: Array<{role: string, content: string}>}> } | null}
 */
export function loadSessions(apiType) {
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + apiType)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return {
      activeId: data.activeId || null,
      sessions: data.sessions && typeof data.sessions === 'object' ? data.sessions : {}
    }
  } catch {
    return memoryStore.get(apiType) || null
  }
}

/**
 * 保存某个应用的所有会话
 * @param {string} apiType 'finance-app' | 'manus'
 * @param {string|null} activeId 当前选中的会话 ID
 * @param {Object} sessions 会话集合
 */
export function saveSessions(apiType, activeId, sessions) {
  const payload = { activeId, sessions }
  try {
    localStorage.setItem(SESSION_PREFIX + apiType, JSON.stringify(payload))
  } catch {
    memoryStore.set(apiType, payload)
  }
}

/**
 * 兼容旧的单会话存储（ai-app-center:chat:<apiType>），
 * 升级为多会话结构，并用第一条提问作为会话标题。
 * @param {string} apiType 'finance-app' | 'manus'
 */
export function migrateLegacySession(apiType) {
  try {
    const raw = localStorage.getItem(LEGACY_PREFIX + apiType)
    if (!raw) return
    const data = JSON.parse(raw)
    if (!data || typeof data.chatId !== 'string' || !Array.isArray(data.messages) || !data.messages.length) {
      localStorage.removeItem(LEGACY_PREFIX + apiType)
      return
    }
    const id = data.chatId
    const firstUser = data.messages.find((m) => m.role === 'user')
    const now = Date.now()
    const sessions = {
      [id]: {
        id,
        title: firstUser ? firstUser.content.slice(0, 24) : '历史会话',
        createdAt: now,
        updatedAt: now,
        messages: data.messages
      }
    }
    localStorage.setItem(SESSION_PREFIX + apiType, JSON.stringify({ activeId: id, sessions }))
    localStorage.removeItem(LEGACY_PREFIX + apiType)
  } catch {
    // 解析失败则忽略旧数据
  }
}
