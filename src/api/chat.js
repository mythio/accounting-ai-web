import http from './http'

/**
 * 基于 Axios 的 SSE 流式请求封装。
 * 浏览器端 Axios 底层使用 XMLHttpRequest，onDownloadProgress 收到的对象中
 * event 是原始 XHR ProgressEvent，可通过 event.currentTarget.responseText
 * 增量读取响应文本，再按 SSE 协议（data: xxx\n\n）解析。
 */
function streamRequest(url, params, { onData, signal }) {
  let buffer = ''
  let lastLength = 0
  let sseDetected = false

  const isEventStreamContentType = (contentType = '') =>
    contentType.includes('text/event-stream')

  const emitDataLines = (lines) => {
    const dataLines = lines
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
    if (dataLines.length) onData(dataLines.join('\n'))
  }

  const consume = (fullText) => {
    const incoming = fullText.slice(lastLength)
    lastLength = fullText.length
    if (!incoming) return

    // 非标准 SSE（例如后端直接输出纯文本流）时按原始文本增量输出
    if (!sseDetected) {
      sseDetected = fullText.includes('data:')
      if (!sseDetected) {
        onData(incoming)
        return
      }
    }

    // 按 SSE 事件块（空行分隔）解析 data: 行
    buffer += incoming.replace(/\r\n/g, '\n')
    let separatorIndex
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      emitDataLines(block)
    }
  }

  const flush = () => {
    // 处理缓冲区中尚未以空行结尾的残留数据
    if (sseDetected && buffer.trim()) {
      emitDataLines(buffer)
      buffer = ''
    }
  }

  const handleProgress = (progress) => {
    const xhr = progress?.event?.currentTarget
    if (!xhr || typeof xhr.responseText !== 'string') return
    if (isEventStreamContentType(xhr.getResponseHeader('Content-Type') || '')) {
      sseDetected = true
    }
    consume(xhr.responseText)
  }

  return http
    .get(url, {
      params,
      responseType: 'text',
      signal,
      onDownloadProgress: handleProgress
    })
    .then((response) => {
      // 请求结束后以最终响应体为准，补齐进度事件可能丢失的尾部内容
      if (isEventStreamContentType(response.headers?.['content-type'] || '')) {
        sseDetected = true
      }
      consume(typeof response.data === 'string' ? response.data : '')
      flush()
    })
}

/**
 * 财务小助手（对应后端 doChatAccountAppSse -> GET /ai/accountingAssistant/chat/sse）
 * @param {object} options
 * @param {string} options.message 用户消息
 * @param {string} options.chatId 会话 ID（进入页面时自动生成）
 * @param {(chunk: string) => void} options.onData 流式内容回调
 * @param {AbortSignal} options.signal 请求取消信号
 */
export function chatFinanceApp({ message, chatId, onData, signal }) {
  return streamRequest('/ai/accountingAssistant/chat/sse', { message, chatId }, { onData, signal })
}

/**
 * AI 超级智能体（对应后端 doChatAccountManus -> GET /ai/accountingManus/chat）
 * @param {object} options
 * @param {string} options.message 用户消息
 * @param {string} [options.chatId] 会话 ID（后端若未定义该参数会自动忽略，保留以便扩展）
 * @param {(chunk: string) => void} options.onData 流式内容回调
 * @param {AbortSignal} options.signal 请求取消信号
 */
export function chatManus({ message, chatId, onData, signal }) {
  const params = { message }
  if (chatId) params.chatId = chatId
  return streamRequest('/ai/accountingManus/chat', params, { onData, signal })
}
