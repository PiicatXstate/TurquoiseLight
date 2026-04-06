import { ref, computed } from 'vue'
import type { ChatMessage } from '@/types/chat'
import { useGlobalSettings } from './useGlobalSettings'

export function useAIChat() {
  const { settings } = useGlobalSettings()
  
  const messages = ref([
    {
      role: 'assistant',
      content: '你好！我是文言文助手，有什么可以帮你的吗？',
      think: ''
    }
  ])

  // 跟踪思考部分的展开状态
  const expandedMessages = ref<Set<number>>(new Set())

  const inputMessage = ref('')
  const loading = ref(false)
  const error = ref('')
  const streaming = ref(false)
  const streamContent = ref('')
  const streamThink = ref('')
  const streamHasThink = ref(false)

  // AI上下文相关状态
  const aiContext = ref('')
  const selectedTextPosition = ref({ paragraph: 0, line: 0, position: 0 })

  const isEmptyInput = computed(() => !inputMessage.value.trim())

  async function sendMessage(chatSession: any) {
    if (isEmptyInput.value || loading.value || streaming.value) return
    
    const message = inputMessage.value.trim()
    if (!chatSession) return
    
    // 检查API Key是否设置
    if (!settings.value.apiKey) {
      error.value = '请先设置API Key'
      return
    }
    
    // 添加用户消息到当前会话
    chatSession.addMessageToSession(chatSession.currentSessionId.value, { role: 'user', content: message, think: '' })
    inputMessage.value = ''
    error.value = ''
    loading.value = true
    streaming.value = true
    streamContent.value = ''
    streamThink.value = ''
    streamHasThink.value = false
    
    try {
      const response = await fetch(`${settings.value.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.value.apiKey}`
        },
        body: JSON.stringify({
          model: settings.value.aiModel === 'custom' ? settings.value.customModelName : settings.value.aiModel,
          messages: [
            {
              role: 'system',
              content: `你是一个专业的文言文助手，精通文言文的翻译、解释和赏析。请用简洁明了的语言回答用户的问题，避免使用过于学术化的术语。${aiContext.value}`
            },
            ...chatSession.getCurrentSession()?.messages.map((m: ChatMessage) => ({
              role: m.role,
              content: m.content
            })) || []
          ],
          temperature: 0.7,
          max_tokens: 1024,
          stream: true
        })
      })
      
      if (!response.ok) {
        throw new Error('API请求失败')
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = new TextDecoder('utf-8').decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          if (line === 'data: [DONE]') {
            continue
          }
          
          try {
            const data = JSON.parse(line.replace('data: ', ''))
            const delta = data.choices[0]?.delta
            if (delta?.content) {
              // 如果是思考模型，解析思考过程
              if (settings.value.isThinkingModel) {
                if (!streamHasThink.value) {
                  // 检查是否包含```分隔符
                  if (delta.content.includes('```')) {
                    const parts = delta.content.split('```')
                    streamThink.value += parts[0]
                    streamContent.value += parts[1]
                    streamHasThink.value = true
                  } else {
                    // 还没有遇到```，暂时全部作为思考内容
                    streamThink.value += delta.content
                  }
                } else {
                  // 已经遇到```，后续内容全部作为输出内容
                  streamContent.value += delta.content
                }
              } else {
                // 非思考模型，直接作为输出内容
                streamContent.value += delta.content
              }
            }
          } catch (e) {
            console.error('Error parsing stream:', e)
          }
        }
      }
      
      // 使用之前在流式处理中分离好的思考部分和输出部分
      let think = settings.value.isThinkingModel ? streamThink.value.trim() : ''
      let content = streamContent.value.trim()
      
      // 如果没有思考部分，确保content不为空
      if (!think && !content) {
        content = '抱歉，我无法生成回答，请稍后重试。'
      }
      
      // 添加助手消息到当前会话
      chatSession.addMessageToSession(chatSession.currentSessionId.value, { role: 'assistant', content, think })
      
      // 重置流式处理状态
      streamContent.value = ''
      streamThink.value = ''
      streamHasThink.value = false
      
      // 自动滚动到底部
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      }, 100)
      
    } catch (err) {
      error.value = 'AI回复失败，请稍后重试'
      console.error('AI error:', err)
    } finally {
      loading.value = false
      streaming.value = false
    }
  }

  function handleKeyDown(event: KeyboardEvent, chatSession: any) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage(chatSession)
    }
  }

  function clearMessages(chatSession: any) {
    const currentSession = chatSession.getCurrentSession()
    if (currentSession) {
      currentSession.messages = [
        {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          role: 'assistant',
          content: '你好！我是文言文助手，有什么可以帮你的吗？',
          think: '',
          timestamp: Date.now()
        }
      ]
      currentSession.updatedAt = Date.now()
      chatSession.saveChatSessions()
    }
    error.value = ''
    streamContent.value = ''
    streamThink.value = ''
    streamHasThink.value = false
    expandedMessages.value.clear()
    aiContext.value = ''
    selectedTextPosition.value = { paragraph: 0, line: 0, position: 0 }
  }

  return {
    messages,
    expandedMessages,
    inputMessage,
    loading,
    error,
    streaming,
    streamContent,
    streamThink,
    streamHasThink,
    aiContext,
    selectedTextPosition,
    isEmptyInput,
    sendMessage,
    handleKeyDown,
    clearMessages
  }
}
