<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  initialText?: string
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const messages = ref([
  {
    role: 'assistant',
    content: '你好！我是文言文助手，有什么可以帮你的吗？'
  }
])

const inputMessage = ref('')
const loading = ref(false)
const error = ref('')
const streaming = ref(false)
const streamContent = ref('')

const isEmptyInput = computed(() => !inputMessage.value.trim())

watch(() => props.initialText, (newText) => {
  if (newText) {
    inputMessage.value = `解释一下"${newText}"的意思`
  }
}, { immediate: true })

async function sendMessage() {
  if (isEmptyInput.value || loading.value || streaming.value) return
  
  const message = inputMessage.value.trim()
  messages.value.push({ role: 'user', content: message })
  inputMessage.value = ''
  error.value = ''
  loading.value = true
  streaming.value = true
  streamContent.value = ''
  
  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-lbtjhwrjebrwhwttikwrkasfwcbsijbuojzlizzihmoksyca'
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的文言文助手，精通文言文的翻译、解释和赏析。请用简洁明了的语言回答用户的问题，避免使用过于学术化的术语。'
          },
          ...messages.value.map(m => ({
            role: m.role,
            content: m.content
          }))
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
            streamContent.value += delta.content
          }
        } catch (e) {
          console.error('Error parsing stream:', e)
        }
      }
    }
    
    messages.value.push({ role: 'assistant', content: streamContent.value })
    streamContent.value = ''
    
  } catch (err) {
    error.value = 'AI回复失败，请稍后重试'
    console.error('AI error:', err)
  } finally {
    loading.value = false
    streaming.value = false
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

function clearMessages() {
  messages.value = [
    {
      role: 'assistant',
      content: '你好！我是文言文助手，有什么可以帮你的吗？'
    }
  ]
  error.value = ''
  streamContent.value = ''
}
</script>

<template>
  <div v-if="open" class="ai-sidebar" @click.self="emit('close')">
    <div class="ai-content" @click.stop>
      <div class="ai-header">
        <h2>文言文助手</h2>
        <div class="ai-actions">
          <button class="clear-btn" @click="clearMessages" title="清空对话">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
            </svg>
          </button>
          <button class="close-btn" @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="ai-body scrollbar-visible">
        <div class="messages">
          <div 
            v-for="(msg, index) in messages" 
            :key="index"
            :class="['message', msg.role]"
          >
            <div class="message-avatar">
              <span v-if="msg.role === 'user'">用户</span>
              <span v-else>助手</span>
            </div>
            <div class="message-content">{{ msg.content }}</div>
          </div>
          
          <div v-if="streaming" class="message assistant">
            <div class="message-avatar">助手</div>
            <div class="message-content streaming">{{ streamContent }}</div>
          </div>
          
          <div v-if="loading && !streaming" class="loading-message">
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>正在思考...</span>
          </div>
          
          <div v-if="error" class="error-message">{{ error }}</div>
        </div>
      </div>
      
      <div class="ai-footer">
        <textarea 
          v-model="inputMessage"
          placeholder="输入你的问题，例如：'学而时习之，不亦说乎'是什么意思？"
          rows="2"
          @keydown="handleKeyDown"
          :disabled="loading || streaming"
        ></textarea>
        <button 
          class="send-btn" 
          @click="sendMessage"
          :disabled="isEmptyInput || loading || streaming"
        >
          <svg v-if="!loading && !streaming" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
          </svg>
          <div v-else-if="loading" class="send-loading"></div>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12,6 12,12 16,14"></polyline>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-sidebar {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  z-index: 1000;
}

.ai-content {
  background: var(--bg-primary);
  width: 100%;
  max-width: 400px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: -20px 0 60px rgba(0, 0, 0, 0.1);
  border-left: 1px solid var(--border-color);
}

.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.ai-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.ai-actions {
  display: flex;
  gap: 0.5rem;
}

.clear-btn, .close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.clear-btn:hover, .close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.clear-btn svg, .close-btn svg {
  width: 16px;
  height: 16px;
}

.ai-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.message {
  display: flex;
  gap: 0.5rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  align-self: flex-start;
  max-width: 80%;
}

.message.assistant {
  align-self: flex-start;
  max-width: 80%;
}

.message-avatar {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.message-content {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  line-height: 1.5;
  font-size: 0.875rem;
}

.message.user .message-content {
  background: rgba(59, 130, 246, 0.1);
  color: var(--info-color);
  border-top-left-radius: 4px;
}

.message.assistant .message-content {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-top-right-radius: 4px;
}

.message.assistant .message-content.streaming {
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.2);
}

.loading-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  padding: 0.5rem 0;
}

.loading-dots {
  display: flex;
  gap: 0.25rem;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  background: var(--text-tertiary);
  border-radius: 50%;
  animation: loading 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes loading {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.error-message {
  background: rgba(239, 68, 68, 0.05);
  color: var(--error-color);
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  text-align: center;
}

.ai-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  position: relative;
}

.ai-footer textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  resize: none;
  transition: all 0.15s;
  box-sizing: border-box;
  padding-right: 3rem;
}

.ai-footer textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
}

.ai-footer textarea:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.send-btn {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: var(--primary-color);
  color: var(--bg-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: var(--primary-color);
  transform: scale(1.05);
}

.send-btn:disabled {
  background: var(--gray-300);
  cursor: not-allowed;
}

.send-btn svg {
  width: 18px;
  height: 18px;
}

.send-loading {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: var(--bg-primary);
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .ai-content {
    max-width: 100%;
  }
  
  .message {
    max-width: 90%;
  }
}
</style>
