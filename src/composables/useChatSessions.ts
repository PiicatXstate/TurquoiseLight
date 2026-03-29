import { ref } from 'vue'
import type { ChatSession, ChatMessage } from '@/types/chat'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function useChatSessions(articleId: string) {
  const chatSessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string>('')
  const showSessionManager = ref(false)
  const editingSessionId = ref<string | null>(null)
  const editingSessionTitle = ref('')

  function loadChatSessions() {
    try {
      const stored = localStorage.getItem(`chat_sessions_${articleId}`)
      if (stored) {
        chatSessions.value = JSON.parse(stored)
        // 找到默认会话或第一个会话
        const defaultSession = chatSessions.value.find(s => s.isDefault)
        if (defaultSession) {
          currentSessionId.value = defaultSession.id
        } else if (chatSessions.value.length > 0) {
          currentSessionId.value = chatSessions.value[0].id
        }
      } else {
        // 创建默认会话
        const defaultSession: ChatSession = {
          id: generateId(),
          title: '默认会话',
          articleId: articleId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [
            {
              id: generateId(),
              role: 'assistant',
              content: '你好！我是文言文助手，有什么可以帮你的吗？',
              think: '',
              timestamp: Date.now()
            }
          ],
          isDefault: true
        }
        chatSessions.value = [defaultSession]
        currentSessionId.value = defaultSession.id
        saveChatSessions()
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e)
    }
  }

  function saveChatSessions() {
    try {
      localStorage.setItem(`chat_sessions_${articleId}`, JSON.stringify(chatSessions.value))
    } catch (e) {
      console.error('Failed to save chat sessions:', e)
    }
  }

  function getCurrentSession(): ChatSession | undefined {
    return chatSessions.value.find(s => s.id === currentSessionId.value)
  }

  function createChatSession(title: string) {
    const newSession: ChatSession = {
      id: generateId(),
      title,
      articleId: articleId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [
        {
          id: generateId(),
          role: 'assistant',
          content: '你好！我是文言文助手，有什么可以帮你的吗？',
          think: '',
          timestamp: Date.now()
        }
      ],
      isDefault: false
    }
    chatSessions.value.push(newSession)
    currentSessionId.value = newSession.id
    saveChatSessions()
    return newSession
  }

  function renameChatSession(id: string, newTitle: string) {
    const session = chatSessions.value.find(s => s.id === id)
    if (session) {
      session.title = newTitle
      session.updatedAt = Date.now()
      saveChatSessions()
    }
  }

  function deleteChatSession(id: string) {
    const index = chatSessions.value.findIndex(s => s.id === id)
    if (index !== -1) {
      // 不能删除默认会话
      if (chatSessions.value[index].isDefault) {
        return
      }
      chatSessions.value.splice(index, 1)
      if (currentSessionId.value === id) {
        // 切换到另一个会话
        if (chatSessions.value.length > 0) {
          currentSessionId.value = chatSessions.value[0].id
        } else {
          // 创建一个新的默认会话
          const defaultSession: ChatSession = {
            id: generateId(),
            title: '默认会话',
            articleId: articleId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
              {
                id: generateId(),
                role: 'assistant',
                content: '你好！我是文言文助手，有什么可以帮你的吗？',
                think: '',
                timestamp: Date.now()
              }
            ],
            isDefault: true
          }
          chatSessions.value = [defaultSession]
          currentSessionId.value = defaultSession.id
        }
      }
      saveChatSessions()
    }
  }

  function addMessageToSession(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) {
    const session = chatSessions.value.find(s => s.id === sessionId)
    if (session) {
      const newMessage: ChatMessage = {
        ...message,
        id: generateId(),
        timestamp: Date.now()
      }
      session.messages.push(newMessage)
      session.updatedAt = Date.now()
      saveChatSessions()
      
      // 当添加消息的是当前会话时，自动滚动到底部
      if (sessionId === currentSessionId.value) {
        setTimeout(() => {
          const messagesContainer = document.querySelector('.messages')
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight
          }
        }, 50)
      }
    }
  }

  function exportChatSession(format: 'txt' | 'json') {
    const currentSession = getCurrentSession()
    if (!currentSession) return
    
    let content = ''
    let filename = `${currentSession.title}.${format}`
    
    if (format === 'json') {
      content = JSON.stringify(currentSession, null, 2)
    } else if (format === 'txt') {
      content = `聊天会话：${currentSession.title}\n`
      content += `创建时间：${new Date(currentSession.createdAt).toLocaleString()}\n`
      content += `更新时间：${new Date(currentSession.updatedAt).toLocaleString()}\n\n`
      
      currentSession.messages.forEach(msg => {
        content += `${msg.role === 'user' ? '用户' : '助手'} ${new Date(msg.timestamp).toLocaleString()}\n`
        if (msg.think) {
          content += `思考过程：${msg.think}\n`
        }
        content += `${msg.content}\n\n`
      })
    }
    
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 初始化加载聊天会话
  loadChatSessions()

  return {
    chatSessions,
    currentSessionId,
    showSessionManager,
    editingSessionId,
    editingSessionTitle,
    loadChatSessions,
    saveChatSessions,
    getCurrentSession,
    createChatSession,
    renameChatSession,
    deleteChatSession,
    addMessageToSession,
    exportChatSession
  }
}
