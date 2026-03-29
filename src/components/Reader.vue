<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Annotation, TextFormat, SharedArticle } from '@/types'
import { useArticles } from '@/composables/useArticles'
import { useSettings } from '@/composables/useSettings'

const props = defineProps<{
  articleId: string
  sharedArticle?: SharedArticle | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { articles, getArticle, addAnnotation, updateAnnotation, deleteAnnotation, checkAnnotationExists, addFormat, removeFormat, updateArticle, findDictionaryEntries } = useArticles()
const { settings, updateSettings, resetSettings } = useSettings()

const article = computed(() => {
  if (props.sharedArticle) {
    return {
      id: props.sharedArticle.id,
      title: props.sharedArticle.title,
      content: props.sharedArticle.content,
      annotations: props.sharedArticle.annotations || [],
      formats: [],
      folderId: null,
      isFavorite: false,
      isDeleted: false,
      deletedAt: null,
      createdAt: props.sharedArticle.createdAt,
      updatedAt: props.sharedArticle.createdAt
    }
  }
  return getArticle(props.articleId)
})

const isSharedArticle = computed(() => !!props.sharedArticle)

const showSettings = ref(false)
const showAnnotations = ref(true)
const showDictionary = ref(false)
const selectedText = ref('')
const selectedStartIndex = ref(0)
const selectedEndIndex = ref(0)
const annotationContent = ref('')
const editingAnnotationId = ref<string | null>(null)
const editingAnnotationContent = ref('')
const expandedAnnotations = ref<Set<string>>(new Set())
const readerContent = ref<HTMLElement | null>(null)
const isEditing = ref(false)
const editContent = ref('')
const annotationLockMode = ref<'normal' | 'locked' | 'all-expanded' | 'all-collapsed'>('normal')

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0
})

const localFonts = ref<string[]>([])
const showFontPicker = ref(false)
const annotationError = ref('')
const longPressTimer = ref<number | null>(null)
const touchStartPos = ref({ x: 0, y: 0 })
const showAIChat = ref(false)
const selectedAnnotationText = ref('')
const sidebarWidth = ref(280) // 侧边栏默认宽度

// AI上下文相关状态
const aiContext = ref('')
const selectedTextPosition = ref({ paragraph: 0, line: 0, position: 0 })

// AI注释相关状态
const showAIAnnotationDialog = ref(false)
const aiAnnotationLoading = ref(false)
const aiAnnotationError = ref('')
const aiAnnotationResult = ref('')
const aiAnnotationSelectedText = ref('')

// 聊天记录管理系统
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  think: string
  timestamp: number
}

interface ChatSession {
  id: string
  title: string
  articleId: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  isDefault: boolean
}

// 聊天会话管理相关状态
const chatSessions = ref<ChatSession[]>([])
const currentSessionId = ref<string>('')
const showSessionManager = ref(false)
const editingSessionId = ref<string | null>(null)
const editingSessionTitle = ref('')

// 词典功能状态
const dictionaryQuery = ref('')
const dictionarySearchResults = computed(() => {
  if (!dictionaryQuery.value.trim()) return []
  
  const q = dictionaryQuery.value.trim().toLowerCase()
  const results: Map<string, { text: string; meanings: { content: string; articleTitle: string; articleId: string }[] }> = new Map()
  
  for (const article of articles.value) {
    for (const ann of article.annotations) {
      if (ann.text.toLowerCase().includes(q) || ann.content.toLowerCase().includes(q)) {
        if (!results.has(ann.text)) {
          results.set(ann.text, { text: ann.text, meanings: [] })
        }
        const existing = results.get(ann.text)!
        const isDuplicate = existing.meanings.some(m => m.content === ann.content)
        if (!isDuplicate) {
          existing.meanings.push({
            content: ann.content,
            articleTitle: article.title,
            articleId: article.id
          })
        }
      }
    }
  }
  
  return Array.from(results.values())
})

const dictionaryAllAnnotations = computed(() => {
  const grouped: Map<string, { text: string; meanings: { content: string; articleTitle: string; articleId: string }[] }> = new Map()
  
  for (const article of articles.value) {
    for (const ann of article.annotations) {
      if (!grouped.has(ann.text)) {
        grouped.set(ann.text, { text: ann.text, meanings: [] })
      }
      const existing = grouped.get(ann.text)!
      const isDuplicate = existing.meanings.some(m => m.content === ann.content)
      if (!isDuplicate) {
        existing.meanings.push({
          content: ann.content,
          articleTitle: article.title,
          articleId: article.id
        })
      }
    }
  }
  
  return Array.from(grouped.values()).sort((a, b) => a.text.localeCompare(b.text, 'zh-CN'))
})

const dictionaryStats = computed(() => {
  let totalAnnotations = 0
  let uniqueTexts = 0
  const allTexts = new Set<string>()
  
  for (const article of articles.value) {
    totalAnnotations += article.annotations.length
    for (const ann of article.annotations) {
      allTexts.add(ann.text)
    }
  }
  uniqueTexts = allTexts.size
  
  return { totalAnnotations, uniqueTexts, articleCount: articles.value.length }
})

// AI Chat state
const messages = ref([
  {
    role: 'assistant',
    content: '你好！我是文言文助手，有什么可以帮你的吗？',
    think: ''
  }
])

// 跟踪思考部分的展开状态
const expandedMessages = ref<Set<number>>(new Set())

// 聊天会话管理功能
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function loadChatSessions() {
  try {
    const stored = localStorage.getItem(`chat_sessions_${props.articleId}`)
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
        articleId: props.articleId,
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
    localStorage.setItem(`chat_sessions_${props.articleId}`, JSON.stringify(chatSessions.value))
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
    articleId: props.articleId,
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
          articleId: props.articleId,
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

const inputMessage = ref('')
const loading = ref(false)
const error = ref('')
const streaming = ref(false)
const streamContent = ref('')
const streamThink = ref('')
const streamHasThink = ref(false)

const isEmptyInput = computed(() => !inputMessage.value.trim())

watch(() => selectedAnnotationText.value, (newText) => {
  if (newText) {
    inputMessage.value = `解释一下"${newText}"的意思`
  }
}, { immediate: true })

const presetFonts = [
  'serif',
  'KaiTi, serif',
  'FangSong, serif',
  'SourceHanSerifCN, serif',
  'sans-serif'
]

const dictionaryEntries = computed(() => {
  if (!selectedText.value.trim()) return []
  return findDictionaryEntries(selectedText.value)
})

onMounted(async () => {
  try {
    const fonts = await (window as any).queryLocalFonts?.()
    if (fonts) {
      const fontSet = new Set<string>()
      fonts.forEach((f: any) => fontSet.add(f.family))
      localFonts.value = Array.from(fontSet).sort()
    }
  } catch (e) {
    console.log('Local fonts not supported')
  }

  // 加载聊天会话
  loadChatSessions()

  document.addEventListener('contextmenu', handleContextMenu)
  document.addEventListener('click', (e) => {
    // 检查点击目标是否在菜单内
    const menu = document.querySelector('.context-menu')
    if (!menu || !menu.contains(e.target as Node)) {
      hideContextMenu(e)
    }
  })
  
  // 添加侧边栏宽度调节的事件监听器
  document.addEventListener('mousemove', resize)
  document.addEventListener('mouseup', stopResize)
  
  const content = readerContent.value
  if (content) {
    content.addEventListener('touchstart', handleTouchStart, { passive: true })
    content.addEventListener('touchend', handleTouchEnd)
    content.addEventListener('touchmove', handleTouchMove, { passive: true })
  }
})

onUnmounted(() => {
  document.removeEventListener('contextmenu', handleContextMenu)
  // 由于我们使用了匿名函数，这里不需要移除click事件监听器，它会在组件卸载时自动清理
  
  // 移除侧边栏宽度调节的事件监听器
  document.removeEventListener('mousemove', resize)
  document.removeEventListener('mouseup', stopResize)
  
  const content = readerContent.value
  if (content) {
    content.removeEventListener('touchstart', handleTouchStart)
    content.removeEventListener('touchend', handleTouchEnd)
    content.removeEventListener('touchmove', handleTouchMove)
  }
})

function handleTouchStart(e: TouchEvent) {
  if (isEditing.value) return
  
  const touch = e.touches[0]
  touchStartPos.value = { x: touch.clientX, y: touch.clientY }
  
  longPressTimer.value = window.setTimeout(() => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) {
      handleTextSelection()
      if (selectedText.value) {
        let x = touchStartPos.value.x
        let y = touchStartPos.value.y
        
        const menuWidth = 140
        const menuHeight = 180
        const padding = 10
        
        if (x + menuWidth + padding > window.innerWidth) {
          x = window.innerWidth - menuWidth - padding
        }
        if (y + menuHeight + padding > window.innerHeight) {
          y = window.innerHeight - menuHeight - padding
        }
        
        contextMenu.value = {
          show: true,
          x: Math.max(padding, x),
          y: Math.max(padding, y)
        }
      }
    }
  }, 500)
}

function handleTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function handleTouchMove() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function handleContextMenu(e: MouseEvent) {
  if (readerContent.value?.contains(e.target as Node) && !isEditing.value) {
    e.preventDefault()
    handleTextSelection()
    if (selectedText.value) {
      let x = e.clientX
      let y = e.clientY
      
      const menuWidth = 140
      const menuHeight = 180
      const padding = 10
      
      if (x + menuWidth + padding > window.innerWidth) {
        x = window.innerWidth - menuWidth - padding
      }
      if (y + menuHeight + padding > window.innerHeight) {
        y = window.innerHeight - menuHeight - padding
      }
      
      contextMenu.value = {
        show: true,
        x: Math.max(padding, x),
        y: Math.max(padding, y)
      }
    }
  }
}

function hideContextMenu(_e?: MouseEvent) {
  if (contextMenu.value.show) {
    contextMenu.value.show = false
    // 允许点击事件继续传播到其他元素
  }
}

function handleTextSelection() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return

  const text = selection.toString()
  if (!text.trim()) return

  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(readerContent.value!)
  preCaretRange.setEnd(range.startContainer, range.startOffset)
  const startIndex = preCaretRange.toString().length
  const endIndex = startIndex + text.length

  selectedText.value = text
  selectedStartIndex.value = startIndex
  selectedEndIndex.value = endIndex
}

function addBoldFormat() {
  if (selectedText.value && article.value) {
    const existing = article.value.formats.find(
      f => f.type === 'bold' && f.startIndex === selectedStartIndex.value && f.endIndex === selectedEndIndex.value
    )
    if (existing) {
      removeFormat(article.value.id, 'bold', selectedStartIndex.value, selectedEndIndex.value)
    } else {
      addFormat(article.value.id, 'bold', selectedStartIndex.value, selectedEndIndex.value)
    }
    clearSelection()
  }
  hideContextMenu()
}

function addUnderlineFormat() {
  if (selectedText.value && article.value) {
    const existing = article.value.formats.find(
      f => f.type === 'underline' && f.startIndex === selectedStartIndex.value && f.endIndex === selectedEndIndex.value
    )
    if (existing) {
      removeFormat(article.value.id, 'underline', selectedStartIndex.value, selectedEndIndex.value)
    } else {
      addFormat(article.value.id, 'underline', selectedStartIndex.value, selectedEndIndex.value)
    }
    clearSelection()
  }
  hideContextMenu()
}

function openAnnotationPanel() {
  if (selectedText.value && article.value) {
    if (checkAnnotationExists(article.value.id, selectedStartIndex.value, selectedEndIndex.value)) {
      annotationError.value = '该文本已有注释'
      setTimeout(() => { annotationError.value = '' }, 2000)
    } else {
      showAnnotations.value = true
      editingAnnotationId.value = null
      annotationContent.value = ''
    }
  }
  hideContextMenu()
}

function createAnnotation() {
  if (article.value && annotationContent.value.trim()) {
    const success = addAnnotation(
      article.value.id,
      selectedStartIndex.value,
      selectedEndIndex.value,
      selectedText.value,
      annotationContent.value.trim()
    )
    if (!success) {
      annotationError.value = '该文本已有注释'
      setTimeout(() => { annotationError.value = '' }, 2000)
      return
    }
    annotationContent.value = ''
    selectedText.value = ''
    clearSelection()
  }
}

function startEditAnnotation(ann: Annotation) {
  editingAnnotationId.value = ann.id
  editingAnnotationContent.value = ann.content
}

function saveEditAnnotation() {
  if (article.value && editingAnnotationId.value && editingAnnotationContent.value.trim()) {
    updateAnnotation(article.value.id, editingAnnotationId.value, editingAnnotationContent.value.trim())
    editingAnnotationId.value = null
    editingAnnotationContent.value = ''
  }
}

function cancelEditAnnotation() {
  editingAnnotationId.value = null
  editingAnnotationContent.value = ''
}

function askAIAboutAnnotation(text: string) {
  selectedAnnotationText.value = text
  showAIChat.value = true
}

function askAIAboutSelection() {
  if (selectedText.value) {
    // 计算选中文本的位置
    selectedTextPosition.value = calculateTextPosition(selectedStartIndex.value)
    
    // 生成上下文信息
    if (article.value) {
      // 提取选中文本前后的上下文（各100个字符）
      const content = article.value.content
      const startContext = content.substring(Math.max(0, selectedStartIndex.value - 100), selectedStartIndex.value)
      const endContext = content.substring(selectedEndIndex.value, Math.min(content.length, selectedEndIndex.value + 100))
      
      // 生成上下文信息
      aiContext.value = `
# 上下文信息

## 文章标题
${article.value.title}

## 选中文本位置
- 段落：${selectedTextPosition.value.paragraph}
- 行：${selectedTextPosition.value.line}
- 位置：${selectedTextPosition.value.position}

## 上下文内容
...${startContext}[${selectedText.value}]${endContext}...

请基于上述上下文信息回答用户的问题，确保回答与上下文相关。
`
    }
    
    // 确保当前会话是默认会话
    const defaultSession = chatSessions.value.find(s => s.isDefault)
    if (defaultSession) {
      currentSessionId.value = defaultSession.id
    }
    
    // 设置AI输入框的内容，包含上下文信息和用户的问题
    selectedAnnotationText.value = selectedText.value
    showAIChat.value = true
  }
}

// 处理AI选区注释
async function handleAISelectionAnnotation() {
  if (!selectedText.value || !article.value) return
  
  aiAnnotationSelectedText.value = selectedText.value
  aiAnnotationLoading.value = true
  aiAnnotationError.value = ''
  aiAnnotationResult.value = ''
  
  try {
    // 提取上下文信息
    const content = article.value.content
    const startContext = content.substring(Math.max(0, selectedStartIndex.value - 100), selectedStartIndex.value)
    const endContext = content.substring(selectedEndIndex.value, Math.min(content.length, selectedEndIndex.value + 100))
    
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
            content: `你是一个专业的文言文注释专家，擅长为文言文添加准确、简洁的注释。请分析以下选中的文本内容，结合上下文信息，生成准确、简洁的注释。注释内容要非常简短，适合直接作为注释。对于字的解释，控制在四五个字以内。对于词的解释，简单说明即可，不要长篇大论。只解释词在当前文段中的意思，不需要引申义。直接返回注释内容，不要包含其他无关信息。`
          },
          {
            role: 'user',
            content: `文章标题：${article.value.title}\n\n上下文内容：...${startContext}[${selectedText.value}]${endContext}...\n\n请为选中的文本生成注释：${selectedText.value}`
          }
        ],
        temperature: 0.7,
        max_tokens: 512,
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
    
    let streamContent = ''
    let streamThink = ''
    let streamHasThink = false
    
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
            if (!streamHasThink) {
              // 检查是否包含</think>分隔符
              if (delta.content.includes('</think>')) {
                const parts = delta.content.split('</think>')
                streamThink += parts[0]
                streamContent += parts[1]
                streamHasThink = true
              } else {
                // 还没有遇到</think>，暂时全部作为思考内容
                streamThink += delta.content
              }
            } else {
              // 已经遇到</think>，后续内容全部作为输出内容
              streamContent += delta.content
            }
          }
        } catch (e) {
          console.error('Error parsing stream:', e)
        }
      }
    }
    
    // 使用分割后的内容
    let annotationContent = streamContent.trim()
    
    // 如果没有内容，使用默认提示
    if (!annotationContent) {
      annotationContent = '无法生成注释，请稍后重试。'
    }
    
    aiAnnotationResult.value = annotationContent
    showAIAnnotationDialog.value = true
    
  } catch (err) {
    aiAnnotationError.value = 'AI注释生成失败，请稍后重试'
    console.error('AI annotation error:', err)
  } finally {
    aiAnnotationLoading.value = false
  }
}

// 确认添加AI注释
function confirmAddAIAnnotation() {
  if (article.value && selectedText.value && aiAnnotationResult.value) {
    const success = addAnnotation(
      article.value.id,
      selectedStartIndex.value,
      selectedEndIndex.value,
      selectedText.value,
      aiAnnotationResult.value
    )
    if (success) {
      showAIAnnotationDialog.value = false
      aiAnnotationResult.value = ''
      aiAnnotationSelectedText.value = ''
    }
  }
}

// 取消AI注释
function cancelAIAnnotation() {
  showAIAnnotationDialog.value = false
  aiAnnotationResult.value = ''
  aiAnnotationSelectedText.value = ''
}

function removeAnnotation(annotationId: string) {
  if (article.value) {
    deleteAnnotation(article.value.id, annotationId)
  }
}

function toggleAnnotation(annotationId: string) {
  if (annotationLockMode.value !== 'normal') return
  if (expandedAnnotations.value.has(annotationId)) {
    expandedAnnotations.value.delete(annotationId)
  } else {
    expandedAnnotations.value.add(annotationId)
  }
}

function setAnnotationMode(mode: 'normal' | 'locked' | 'all-expanded' | 'all-collapsed') {
  annotationLockMode.value = mode
  if (mode === 'all-expanded' && article.value) {
    article.value.annotations.forEach(ann => {
      expandedAnnotations.value.add(ann.id)
    })
  } else if (mode === 'all-collapsed') {
    expandedAnnotations.value.clear()
  }
}

function clearSelection() {
  selectedText.value = ''
  window.getSelection()?.removeAllRanges()
}

function startEditing() {
  if (article.value) {
    editContent.value = article.value.content
    isEditing.value = true
    showAnnotations.value = false
    showSettings.value = false
  }
}

function saveContent() {
  if (article.value) {
    updateArticle(article.value.id, { content: editContent.value })
    isEditing.value = false
  }
}

function cancelEditing() {
  isEditing.value = false
}

function selectFont(font: string) {
  updateSettings({ fontFamily: font })
  showFontPicker.value = false
}

function getAnnotationDepth(annotation: Annotation, allAnnotations: Annotation[]): number {
  let depth = 0
  for (const other of allAnnotations) {
    if (other.id !== annotation.id) {
      if (other.startIndex < annotation.startIndex && other.endIndex > annotation.endIndex) {
        depth = Math.max(depth, getAnnotationDepth(other, allAnnotations) + 1)
      } else if (other.startIndex <= annotation.startIndex && other.endIndex >= annotation.endIndex && 
                 (other.startIndex < annotation.startIndex || other.endIndex > annotation.endIndex)) {
        depth = Math.max(depth, 1)
      }
    }
  }
  return depth
}

function getFormattedContent() {
  if (!article.value) return ''

  const content = article.value.content
  const chars = content.split('')
  const annotations = article.value.annotations

  const sortedFormats = [...article.value.formats].sort((a, b) => a.startIndex - b.startIndex)

  const formatStarts = new Map<number, TextFormat[]>()
  const formatEnds = new Map<number, TextFormat[]>()

  for (const format of sortedFormats) {
    if (!formatStarts.has(format.startIndex)) {
      formatStarts.set(format.startIndex, [])
    }
    formatStarts.get(format.startIndex)!.push(format)

    if (!formatEnds.has(format.endIndex)) {
      formatEnds.set(format.endIndex, [])
    }
    formatEnds.get(format.endIndex)!.push(format)
  }

  const annotationStarts = new Map<number, Annotation[]>()
  const annotationEnds = new Map<number, Annotation[]>()

  for (const ann of annotations) {
    if (!annotationStarts.has(ann.startIndex)) {
      annotationStarts.set(ann.startIndex, [])
    }
    annotationStarts.get(ann.startIndex)!.push(ann)

    if (!annotationEnds.has(ann.endIndex)) {
      annotationEnds.set(ann.endIndex, [])
    }
    annotationEnds.get(ann.endIndex)!.push(ann)
  }

  let result = ''

  for (let i = 0; i < chars.length; i++) {
    if (annotationStarts.has(i)) {
      const startingAnns = annotationStarts.get(i)!
      for (const ann of startingAnns) {
        const depth = getAnnotationDepth(ann, annotations)
        result += `<span class="ann-highlight ann-depth-${depth}" data-id="${ann.id}">`
      }
    }

    if (formatStarts.has(i)) {
      const starts = formatStarts.get(i)!
      for (const format of starts) {
        if (format.type === 'bold') {
          result += '<strong>'
        } else if (format.type === 'underline') {
          result += '<u>'
        }
      }
    }

    result += chars[i]

    if (formatEnds.has(i + 1)) {
      const ends = formatEnds.get(i + 1)!
      for (const format of ends) {
        if (format.type === 'bold') {
          result += '</strong>'
        } else if (format.type === 'underline') {
          result += '</u>'
        }
      }
    }

    if (annotationEnds.has(i + 1)) {
      const endingAnns = annotationEnds.get(i + 1)!
      for (const ann of endingAnns) {
        const depth = getAnnotationDepth(ann, annotations)
        const isExpanded = annotationLockMode.value === 'locked' || annotationLockMode.value === 'all-expanded' || expandedAnnotations.value.has(ann.id)
        result += `</span>`
        result += `<span class="ann-note ann-depth-${depth}" data-id="${ann.id}" data-content="${ann.content.replace(/"/g, '&quot;')}" data-expanded="${isExpanded}"></span>`
      }
    }
  }

  return result
}

function handleContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement

  if (target.classList.contains('ann-note')) {
    e.stopPropagation()
    const id = target.dataset.id
    if (id) {
      toggleAnnotation(id)
    }
  }

  if (target.classList.contains('ann-highlight')) {
    const id = target.dataset.id
    if (id) {
      toggleAnnotation(id)
    }
  }
}

// 计算选中文本在文本中的位置
function calculateTextPosition(startIndex: number) {
  if (!article.value) return { paragraph: 0, line: 0, position: 0 }
  
  const content = article.value.content
  const paragraphs = content.split('\n')
  
  let currentIndex = 0
  let paragraph = 0
  let line = 0
  let position = 0
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraphText = paragraphs[i]
    const lines = paragraphText.split('\n')
    
    for (let j = 0; j < lines.length; j++) {
      const lineText = lines[j]
      const lineLength = lineText.length
      
      if (currentIndex + lineLength >= startIndex) {
        paragraph = i + 1 // 段落编号从1开始
        line = j + 1 // 行号从1开始
        position = startIndex - currentIndex + 1 // 位置从1开始
        return { paragraph, line, position }
      }
      
      currentIndex += lineLength + 1 // +1 for the newline
    }
  }
  
  return { paragraph: 0, line: 0, position: 0 }
}

function handlePrint() {
  window.print()
}

// AI Chat methods
async function sendMessage() {
  if (isEmptyInput.value || loading.value || streaming.value) return
  
  const message = inputMessage.value.trim()
  const currentSession = getCurrentSession()
  if (!currentSession) return
  
  // 添加用户消息到当前会话
  addMessageToSession(currentSession.id, { role: 'user', content: message, think: '' })
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
            content: `你是一个专业的文言文助手，精通文言文的翻译、解释和赏析。请用简洁明了的语言回答用户的问题，避免使用过于学术化的术语。${aiContext.value}`
          },
          ...currentSession.messages.map(m => ({
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
            if (!streamHasThink.value) {
              // 检查是否包含</think>分隔符
              if (delta.content.includes('</think>')) {
                const parts = delta.content.split('</think>')
                streamThink.value += parts[0]
                streamContent.value += parts[1]
                streamHasThink.value = true
              } else {
                // 还没有遇到</think>，暂时全部作为思考内容
                streamThink.value += delta.content
              }
            } else {
              // 已经遇到</think>，后续内容全部作为输出内容
              streamContent.value += delta.content
            }
          }
        } catch (e) {
          console.error('Error parsing stream:', e)
        }
      }
    }
    
    // 使用之前在流式处理中分离好的思考部分和输出部分
    let think = streamThink.value.trim()
    let content = streamContent.value.trim()
    
    // 如果没有思考部分，确保content不为空
    if (!think && !content) {
      content = '抱歉，我无法生成回答，请稍后重试。'
    }
    
    // 添加助手消息到当前会话
    addMessageToSession(currentSession.id, { role: 'assistant', content, think })
    
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

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

function clearMessages() {
  const currentSession = getCurrentSession()
  if (currentSession) {
    currentSession.messages = [
      {
        id: generateId(),
        role: 'assistant',
        content: '你好！我是文言文助手，有什么可以帮你的吗？',
        think: '',
        timestamp: Date.now()
      }
    ]
    currentSession.updatedAt = Date.now()
    saveChatSessions()
  }
  error.value = ''
  streamContent.value = ''
  streamThink.value = ''
  streamHasThink.value = false
  expandedMessages.value.clear()
  aiContext.value = ''
  selectedTextPosition.value = { paragraph: 0, line: 0, position: 0 }
}

// 导出聊天记录功能
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

// 侧边栏宽度调节功能
const isResizing = ref(false)

function startResize(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resize(e: MouseEvent) {
  if (!isResizing.value) return
  
  // 计算新的侧边栏宽度，限制最小宽度为200px，最大宽度为500px
  // 直接使用鼠标相对于文档的x坐标作为新的侧边栏宽度
  const newWidth = window.innerWidth - e.clientX
  if (newWidth >= 200 && newWidth <= 500) {
    sidebarWidth.value = newWidth
  }
}

function stopResize() {
  isResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}
</script>

<template>
  <div class="reader" v-if="article">
    <header class="header">
      <button class="back-btn" @click="emit('back')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"></polyline>
        </svg>
      </button>
      <h1 class="title">{{ article.title }}</h1>
      <div class="actions">
        <template v-if="!isSharedArticle">
          <button v-if="isEditing" class="btn-text" @click="cancelEditing">取消</button>
          <button class="btn-primary" @click="isEditing ? saveContent() : startEditing()">
            {{ isEditing ? '保存' : '编辑' }}
          </button>
        </template>
        <span v-if="isSharedArticle" class="shared-badge">来自广场</span>
        <button v-if="!isEditing" class="btn-icon" @click="handlePrint" title="打印">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 6,2 18,2 18,9"></polyline>
            <path d="M6,18H4a2,2,0,0,1-2-2V9a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v7a2,2,0,0,1-2,2H18"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showDictionary }" @click="showDictionary = !showDictionary; showSettings = false; showAnnotations = false; showAIChat = false" title="词典">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"></path>
            <path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5V4.5A2.5,2.5,0,0,1,6.5,2Z"></path>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showSettings }" @click="showSettings = !showSettings; showAnnotations = false; showAIChat = false; showDictionary = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1,0,2.83,2,2,0,0,1-2.83,0l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-2,2,2,2,0,0,1-2-2v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83,0,2,2,0,0,1,0-2.83l.06-.06a1.65,1.65,0,0,0,.33-1.82,1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1-2-2,2,2,0,0,1,2-2h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06a2,2,0,0,1,0-2.83,2,2,0,0,1,2.83,0l.06.06a1.65,1.65,0,0,0,1.82.33H9a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,2-2,2,2,0,0,1,2,2v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,0,2,2,0,0,1,0,2.83l-.06.06a1.65,1.65,0,0,0-.33,1.82V9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,2,2,2,2,0,0,1-2,2h-.09a1.65,1.65,0,0,0-1.51,1Z"></path>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showAnnotations }" @click="showAnnotations = !showAnnotations; showSettings = false; showAIChat = false; showDictionary = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span v-if="article.annotations.length > 0" class="badge">{{ article.annotations.length }}</span>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showAIChat }" @click="showAIChat = !showAIChat; showSettings = false; showAnnotations = false; showDictionary = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12,2a10,10,0,0,1,9.95,9h1.5a1.5,1.5,0,0,1,0,3h-1.5a9.94,9.94,0,0,1-1.33,4.67,1.5,1.5,0,0,1-2.68,0,6.47,6.47,0,0,0-10.87,0,1.5,1.5,0,0,1-2.68,0A9.94,9.94,0,0,1,3.5,14H2a1.5,1.5,0,0,1,0-3H3.5A10,10,0,0,1,12,2Z"></path>
            <path d="M8,11h0a1,1,0,0,0,0,2h0"></path>
            <path d="M12,11h0a1,1,0,0,0,0,2h0"></path>
            <path d="M16,11h0a1,1,0,0,0,0,2h0"></path>
          </svg>
        </button>
      </div>
    </header>

    <div class="body" :class="{ 'with-panel': showSettings || showAnnotations || showAIChat || showDictionary }">
      <div class="content-wrapper" :style="{ marginRight: (showSettings || showAnnotations || showAIChat || showDictionary) ? sidebarWidth + 'px' : '0' }">
        <div v-if="isEditing" class="editor">
          <textarea
            v-model="editContent"
            class="editor-input"
            placeholder="输入或粘贴文言文内容..."
          ></textarea>
        </div>
        <article v-else class="article-container">
          <h1 class="print-title">{{ article.title }}</h1>
          <div
            ref="readerContent"
            class="content"
            :style="{
              fontSize: settings.fontSize + 'px',
              letterSpacing: settings.letterSpacing + 'px',
              lineHeight: settings.lineHeight,
              fontFamily: settings.fontFamily,
              '--ann-font-size': settings.annotationFontSize + 'px'
            }"
            @mouseup="handleTextSelection"
            v-html="getFormattedContent()"
            @click="handleContentClick"
          ></div>
        </article>
      </div>

      <Transition name="panel">
        <div v-if="showSettings" class="panel" :style="{ width: sidebarWidth + 'px' }">
          <div class="panel-header">
            <span>阅读设置</span>
            <button class="panel-close" @click="showSettings = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="resize-handle" @mousedown="startResize"></div>
          <div class="panel-body">
            <div class="setting">
              <div class="setting-label">
                <span>字体大小</span>
                <span class="setting-value">{{ settings.fontSize }}px</span>
              </div>
              <input type="range" :min="12" :max="36" :value="settings.fontSize"
                @input="updateSettings({ fontSize: Number(($event.target as HTMLInputElement).value) })" />
            </div>
            <div class="setting">
              <div class="setting-label">
                <span>字间距</span>
                <span class="setting-value">{{ settings.letterSpacing }}px</span>
              </div>
              <input type="range" :min="0" :max="10" :value="settings.letterSpacing"
                @input="updateSettings({ letterSpacing: Number(($event.target as HTMLInputElement).value) })" />
            </div>
            <div class="setting">
              <div class="setting-label">
                <span>行间距</span>
                <span class="setting-value">{{ settings.lineHeight }}</span>
              </div>
              <input type="range" :min="1" :max="3" :step="0.1" :value="settings.lineHeight"
                @input="updateSettings({ lineHeight: Number(($event.target as HTMLInputElement).value) })" />
            </div>
            <div class="setting">
              <div class="setting-label">
                <span>注释字号</span>
                <span class="setting-value">{{ settings.annotationFontSize }}px</span>
              </div>
              <input type="range" :min="10" :max="24" :value="settings.annotationFontSize"
                @input="updateSettings({ annotationFontSize: Number(($event.target as HTMLInputElement).value) })" />
            </div>
            <div class="setting">
              <div class="setting-label"><span>字体</span></div>
              <div class="font-select" @click="showFontPicker = !showFontPicker">
                <span>{{ settings.fontFamily }}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </div>
              <div class="font-dropdown" v-if="showFontPicker">
                <div class="font-group">
                  <div class="font-group-title">预设</div>
                  <div v-for="font in presetFonts"
                    :key="font" class="font-option" :class="{ active: settings.fontFamily === font }"
                    :style="{ fontFamily: font }" @click.stop="selectFont(font)">
                    {{ font.includes('SourceHan') ? '思源宋体' : font.includes(',') ? font.split(',')[0] : font === 'serif' ? '宋体' : font === 'sans-serif' ? '黑体' : font }}
                  </div>
                </div>
                <div class="font-group" v-if="localFonts.length > 0">
                  <div class="font-group-title">本地</div>
                  <div v-for="font in localFonts.slice(0, 30)" :key="font"
                    class="font-option" :class="{ active: settings.fontFamily === font }"
                    :style="{ fontFamily: font }" @click.stop="selectFont(font)">
                    {{ font }}
                  </div>
                </div>
              </div>
            </div>
            <button class="reset-btn" @click="resetSettings">重置</button>
          </div>
        </div>
      </Transition>

      <Transition name="panel">
        <div v-if="showAnnotations && !isEditing" class="panel" :style="{ width: sidebarWidth + 'px' }">
          <div class="panel-header">
            <span>注释 ({{ article.annotations.length }})</span>
            <button class="panel-close" @click="showAnnotations = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="resize-handle" @mousedown="startResize"></div>
          <div class="ann-controls">
            <button 
              class="ann-mode-btn" 
              :class="{ active: annotationLockMode === 'normal' }" 
              @click="setAnnotationMode('normal')"
              title="正常模式"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12,20h9"></path>
                <path d="M16.5,3.5a2.121,2.121,0,0,1,3,3L7,19,3,20l1-4L16.5,3.5Z"></path>
              </svg>
            </button>
            <button 
              class="ann-mode-btn" 
              :class="{ active: annotationLockMode === 'locked' }" 
              @click="setAnnotationMode('locked')"
              title="锁定展开"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7,11V7a5,5,0,0,1,10,0v4"></path>
              </svg>
            </button>
            <button 
              class="ann-mode-btn" 
              :class="{ active: annotationLockMode === 'all-expanded' }" 
              @click="setAnnotationMode('all-expanded')"
              title="全部展开"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,3 21,3 21,9"></polyline>
                <polyline points="9,21 3,21 3,15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
            <button 
              class="ann-mode-btn" 
              :class="{ active: annotationLockMode === 'all-collapsed' }" 
              @click="setAnnotationMode('all-collapsed')"
              title="全部折叠"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4,14 10,14 10,20"></polyline>
                <polyline points="20,10 14,10 14,4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
          </div>
          <div class="panel-body">
            <div v-if="selectedText && !isSharedArticle" class="new-ann">
              <div class="new-ann-header">
                <span class="new-ann-label">选中</span>
                <span class="new-ann-text">"{{ selectedText }}"</span>
              </div>
              
              <div v-if="dictionaryEntries.length > 0" class="dict-suggestions">
                <div class="dict-suggestions-title">已有释义 (点击选择)</div>
                <div class="dict-suggestions-list">
                  <button 
                    v-for="(entry, idx) in dictionaryEntries" 
                    :key="idx"
                    class="dict-suggestion-item"
                    @click="annotationContent = entry.content"
                  >
                    <span class="dict-suggestion-content">{{ entry.content }}</span>
                    <span class="dict-suggestion-source">——《{{ entry.articleTitle }}》</span>
                  </button>
                </div>
              </div>
              
              <textarea v-model="annotationContent" placeholder="注释内容..." rows="2"></textarea>
              <div v-if="annotationError" class="error">{{ annotationError }}</div>
              <div class="new-ann-actions">
                <button class="btn-text" @click="selectedText = ''; annotationContent = ''">取消</button>
                <button class="btn-primary sm" @click="createAnnotation" :disabled="!annotationContent.trim()">添加</button>
              </div>
            </div>

            <div class="ann-list">
              <div class="ann-item" v-for="ann in article.annotations" :key="ann.id">
                <div v-if="editingAnnotationId === ann.id" class="ann-edit">
                  <div class="ann-ref">"{{ ann.text }}"</div>
                  <textarea v-model="editingAnnotationContent" rows="2"></textarea>
                  <div class="ann-edit-actions">
                    <button class="btn-text" @click="cancelEditAnnotation">取消</button>
                    <button class="btn-primary sm" @click="saveEditAnnotation" :disabled="!editingAnnotationContent.trim()">保存</button>
                  </div>
                </div>
                <div v-else>
                  <div class="ann-header">
                    <span class="ann-text">"{{ ann.text }}"</span>
                    <div v-if="!isSharedArticle" class="ann-actions">
                      <button class="btn-icon sm" @click="startEditAnnotation(ann)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11,4H4A2,2,0,0,0,2,6V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V13"></path>
                          <path d="M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15,8,16l1-4Z"></path>
                        </svg>
                      </button>
                      <button class="btn-icon sm delete" @click="removeAnnotation(ann.id)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3,6 5,6 21,6"></polyline>
                          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                        </svg>
                      </button>
                      <button class="btn-icon sm ai" @click="askAIAboutAnnotation(ann.text)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12,2a10,10,0,0,1,9.95,9h1.5a1.5,1.5,0,0,1,0,3h-1.5a9.94,9.94,0,0,1-1.33,4.67,1.5,1.5,0,0,1-2.68,0,6.47,6.47,0,0,0-10.87,0,1.5,1.5,0,0,1-2.68,0A9.94,9.94,0,0,1,3.5,14H2a1.5,1.5,0,0,1,0-3H3.5A10,10,0,0,1,12,2Z"></path>
                          <path d="M8,11h0a1,1,0,0,0,0,2h0"></path>
                          <path d="M12,11h0a1,1,0,0,0,0,2h0"></path>
                          <path d="M16,11h0a1,1,0,0,0,0,2h0"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p class="ann-content">{{ ann.content }}</p>
                </div>
              </div>
            </div>

            <div v-if="article.annotations.length === 0 && !selectedText" class="empty">
              <p>暂无注释</p>
              <p class="hint">选中文本后右键添加</p>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="panel">
        <div v-if="showDictionary" class="panel" :style="{ width: sidebarWidth + 'px' }">
          <div class="panel-header">
            <span>词典</span>
            <button class="panel-close" @click="showDictionary = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="resize-handle" @mousedown="startResize"></div>
          <div class="search-box">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              v-model="dictionaryQuery" 
              type="text" 
              placeholder="搜索字或词..." 
              @keyup.escape="showDictionary = false"
            />
          </div>
          <div class="stats">
            <span>{{ dictionaryStats.articleCount }} 篇文章</span>
            <span>{{ dictionaryStats.uniqueTexts }} 个词条</span>
            <span>{{ dictionaryStats.totalAnnotations }} 条注释</span>
          </div>
          <div class="panel-body">
            <div v-if="dictionaryQuery.trim()" class="result-list">
              <div v-if="dictionarySearchResults.length === 0" class="empty">
                未找到"{{ dictionaryQuery }}"相关注释
              </div>
              <div v-else class="result-item" v-for="result in dictionarySearchResults" :key="result.text">
                <div class="result-text">"{{ result.text }}"</div>
                <div class="result-meanings">
                  <div class="meaning" v-for="(meaning, idx) in result.meanings" :key="idx">
                    <span class="meaning-content">{{ meaning.content }}</span>
                    <span class="meaning-source">——《{{ meaning.articleTitle }}》</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="all-entries">
              <div class="section-title">全部词条</div>
              <div v-if="dictionaryAllAnnotations.length === 0" class="empty">
                暂无注释
              </div>
              <div v-else class="entry-list">
                <div class="entry-item" v-for="entry in dictionaryAllAnnotations" :key="entry.text">
                  <div class="entry-text">"{{ entry.text }}"</div>
                  <div class="entry-count" v-if="entry.meanings.length > 1">
                    {{ entry.meanings.length }} 种释义
                  </div>
                  <div class="entry-meanings">
                    <div class="meaning" v-for="(meaning, idx) in entry.meanings" :key="idx">
                      <span class="meaning-content">{{ meaning.content }}</span>
                      <span class="meaning-source">——《{{ meaning.articleTitle }}》</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="panel">
        <div v-if="showAIChat" class="panel" :style="{ width: sidebarWidth + 'px' }">
          <div class="panel-header">
            <div class="chat-header-left">
              <button class="btn-icon" @click="showSessionManager = !showSessionManager" title="会话管理">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <span>{{ getCurrentSession()?.title || '文言文助手' }}</span>
            </div>
            <button class="panel-close" @click="showAIChat = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="resize-handle" @mousedown="startResize"></div>
          
          <!-- 会话管理界面 -->
          <div v-if="showSessionManager" class="session-manager">
            <div class="session-manager-header">
              <span>会话管理</span>
              <button class="btn-icon sm" @click="showSessionManager = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="session-list">
              <div 
                v-for="session in chatSessions" 
                :key="session.id"
                :class="['session-item', { active: session.id === currentSessionId }]"
              >
                <div class="session-info">
                  <div class="session-title" @click="currentSessionId = session.id; showSessionManager = false">
                    {{ session.title }}
                    <span v-if="session.isDefault" class="session-badge">默认</span>
                  </div>
                  <div class="session-meta">
                    {{ new Date(session.updatedAt).toLocaleString() }}
                  </div>
                </div>
                <div class="session-actions">
                  <button class="btn-icon sm" @click="editingSessionId = session.id; editingSessionTitle = session.title" title="重命名">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11,4H4A2,2,0,0,0,2,6V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V13"></path>
                      <path d="M18.5,2.5a2.121,2.121,0,0,1,3,3L12,15,8,16l1-4Z"></path>
                    </svg>
                  </button>
                  <button class="btn-icon sm delete" @click="deleteChatSession(session.id)" title="删除">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6"></polyline>
                      <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="session-manager-footer">
              <input 
                v-model="editingSessionTitle"
                placeholder="输入会话名称"
                class="session-title-input"
              />
              <div class="session-manager-actions">
                <button class="btn-text" @click="editingSessionId = null; editingSessionTitle = ''">取消</button>
                <button class="btn-primary sm" @click="editingSessionId ? renameChatSession(editingSessionId, editingSessionTitle) : createChatSession(editingSessionTitle); editingSessionId = null; editingSessionTitle = ''">
                  {{ editingSessionId ? '保存' : '创建' }}
                </button>
              </div>
            </div>
          </div>
          
          <!-- 聊天界面 -->
          <div v-else class="panel-body">
            <div class="messages">
              <div 
                v-for="(msg, index) in getCurrentSession()?.messages || []" 
                :key="msg.id"
                :class="['message', msg.role]"
              >
                <div class="message-avatar">
                  <span v-if="msg.role === 'user'">用户</span>
                  <span v-else>助手</span>
                </div>
                <div class="message-body">
                  <!-- 思考部分 -->
                  <div v-if="msg.think && msg.role === 'assistant'" class="think-container">
                    <button class="think-toggle" @click="expandedMessages.has(index) ? expandedMessages.delete(index) : expandedMessages.add(index)">
                      <svg v-if="!expandedMessages.has(index)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9,18 15,12 9,6"></polyline>
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15,18 9,12 15,6"></polyline>
                      </svg>
                      <span>思考过程</span>
                    </button>
                    <div v-if="expandedMessages.has(index)" class="think-content">
                      {{ msg.think }}
                    </div>
                  </div>
                  <!-- 输出部分 -->
                  <div class="message-content">{{ msg.content }}</div>
                  <!-- 时间戳 -->
                  <div class="message-timestamp">{{ new Date(msg.timestamp).toLocaleTimeString() }}</div>
                </div>
              </div>
              
              <div v-if="streaming" class="message assistant">
                <div class="message-avatar">助手</div>
                <div class="message-body">
                  <!-- 流式思考部分 -->
                  <div v-if="streamThink && !streamHasThink" class="think-container streaming">
                    <div class="think-content">
                      {{ streamThink }}
                    </div>
                  </div>
                  <!-- 流式输出部分 -->
                  <div class="message-content streaming">{{ streamContent }}</div>
                </div>
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
          <div class="panel-footer">
            <textarea 
              v-model="inputMessage"
              placeholder="输入你的问题，例如：'学而时习之，不亦说乎'是什么意思？"
              rows="2"
              @keydown="handleKeyDown"
              :disabled="loading || streaming"
            ></textarea>
            <div class="footer-actions">
              <div class="export-menu">
                <button class="btn-text" title="导出聊天记录">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2V9a2,2,0,0,1,2-2h4"></path>
                    <polyline points="17,8 21,4 21,8"></polyline>
                    <line x1="12" y1="12" x2="21" y2="4"></line>
                  </svg>
                  <div class="export-dropdown">
                    <button class="export-option" @click="exportChatSession('txt')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10,9 9,9 8,9"></polyline>
                      </svg>
                      <span>导出为TXT</span>
                    </button>
                    <button class="export-option" @click="exportChatSession('json')">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                        <path d="M12,18a3,3,0,0,1-3-3,3,3,0,0,1,3-3,3,3,0,0,1,3,3,3,3,0,0,1-3,3Z"></path>
                        <path d="M6,10a2,2,0,0,1-2-2V4a2,2,0,0,1,2-2h8a2,2,0,0,1,2,2"></path>
                      </svg>
                      <span>导出为JSON</span>
                    </button>
                  </div>
                </button>
              </div>
              <button class="btn-text" @click="clearMessages" title="清空对话">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                </svg>
              </button>
              <button 
                class="btn-primary" 
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
      </Transition>
    </div>

    <Teleport to="body">
      <Transition name="context">
        <div v-if="contextMenu.show" class="context-menu"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
          <button class="menu-item" @click="addBoldFormat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M6,4h8a4,4,0,0,1,4,4h0a4,4,0,0,1-4,4H6Z"></path>
              <path d="M6,12h9a4,4,0,0,1,4,4h0a4,4,0,0,1-4,4H6Z"></path>
            </svg>
            <span>加粗</span>
          </button>
          <button class="menu-item" @click="addUnderlineFormat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6,3v7a6,6,0,0,0,6,6,6,6,0,0,0,6-6V3"></path>
              <line x1="4" y1="21" x2="20" y2="21"></line>
            </svg>
            <span>下划线</span>
          </button>
          <div class="menu-divider"></div>
          <button class="menu-item" @click="dictionaryQuery = selectedText; showDictionary = true; showSettings = false; showAnnotations = false; showAIChat = false; hideContextMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"></path>
              <path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5V4.5A2.5,2.5,0,0,1,6.5,2Z"></path>
            </svg>
            <span>查词典</span>
          </button>
          <button class="menu-item" @click="askAIAboutSelection(); hideContextMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12,2a10,10,0,0,1,9.95,9h1.5a1.5,1.5,0,0,1,0,3h-1.5a9.94,9.94,0,0,1-1.33,4.67,1.5,1.5,0,0,1-2.68,0,6.47,6.47,0,0,0-10.87,0,1.5,1.5,0,0,1-2.68,0A9.94,9.94,0,0,1,3.5,14H2a1.5,1.5,0,0,1,0-3H3.5A10,10,0,0,1,12,2Z"></path>
              <path d="M8,11h0a1,1,0,0,0,0,2h0"></path>
              <path d="M12,11h0a1,1,0,0,0,0,2h0"></path>
              <path d="M16,11h0a1,1,0,0,0,0,2h0"></path>
            </svg>
            <span>问AI</span>
          </button>
          <button class="menu-item" @click="handleAISelectionAnnotation(); hideContextMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12,2a10,10,0,0,1,9.95,9h1.5a1.5,1.5,0,0,1,0,3h-1.5a9.94,9.94,0,0,1-1.33,4.67,1.5,1.5,0,0,1-2.68,0,6.47,6.47,0,0,0-10.87,0,1.5,1.5,0,0,1-2.68,0A9.94,9.94,0,0,1,3.5,14H2a1.5,1.5,0,0,1,0-3H3.5A10,10,0,0,1,12,2Z"></path>
              <path d="M12,16v-4"></path>
              <path d="M12,8h.01"></path>
            </svg>
            <span>AI注释</span>
          </button>
          <button class="menu-item highlight" @click="openAnnotationPanel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12,20h9"></path>
              <path d="M16.5,3.5a2.121,2.121,0,0,1,3,3L7,19,3,20l1-4L16.5,3.5Z"></path>
            </svg>
            <span>注释</span>
          </button>
        </div>
      </Transition>

      <!-- AI注释加载对话框 -->
      <Transition name="dialog">
        <div v-if="aiAnnotationLoading" class="dialog-overlay" @click.stop>
          <div class="dialog-content loading-dialog">
            <div class="loading-circle"></div>
            <span>AI正在分析...</span>
          </div>
        </div>
      </Transition>

      <!-- AI注释结果对话框 -->
      <Transition name="dialog">
        <div v-if="showAIAnnotationDialog" class="dialog-overlay" @click.stop>
          <div class="dialog-content">
            <div class="dialog-header">
              <h3>AI注释结果</h3>
              <button class="dialog-close" @click="cancelAIAnnotation">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="dialog-body">
              <div class="ai-annotation-selected">
                <span class="label">选中的文本：</span>
                <span class="text">{{ aiAnnotationSelectedText }}</span>
              </div>
              <div class="ai-annotation-result">
                <div class="result-header">
                  <span class="label">AI生成的注释：</span>
                  <button class="btn-icon sm" @click="handleAISelectionAnnotation()" title="重新生成">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23,4 23,10 17,10"></polyline>
                      <polyline points="1,20 1,14 7,14"></polyline>
                      <path d="M3.51,9a9,9,0,0,1,14.85-3.36L23,10M1,14l4.64,4.36A9,9,0,0,0,20.49,15"></path>
                    </svg>
                  </button>
                </div>
                <textarea v-model="aiAnnotationResult" class="result-content editable"></textarea>
                <div class="ai-note">AI生成的注释内容</div>
              </div>
              <div class="ai-annotation-question">
                是否需要将注释添加到内容中？
              </div>
            </div>
            <div class="dialog-footer">
              <button class="btn-text" @click="cancelAIAnnotation">取消</button>
              <button class="btn-primary" @click="confirmAddAIAnnotation">添加到文章</button>
            </div>
          </div>
        </div>
      </Transition>

    </Teleport>
  </div>
</template>

<style scoped>
.reader {
  min-height: 100vh;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: white;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 50;
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: all 0.15s;
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.back-btn:hover {
  background: #f0f0f0;
  color: #2dd4bf;
}

.title {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #1a1a1a;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.actions {
  display: flex;
  gap: 0.375rem;
}

.btn-primary {
  padding: 0.375rem 0.75rem;
  background: #2dd4bf;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover {
  background: #14b8a6;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary.sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-text {
  padding: 0.375rem 0.5rem;
  background: transparent;
  color: #666;
  border: none;
  font-size: 0.8125rem;
  cursor: pointer;
}

.btn-text:hover {
  color: #333;
}

.shared-badge {
  padding: 0.25rem 0.5rem;
  background: #f0fdfa;
  color: #14b8a6;
  font-size: 0.6875rem;
  border-radius: 4px;
  margin-right: 0.5rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  position: relative;
  transition: all 0.15s;
}

.btn-icon svg {
  width: 18px;
  height: 18px;
}

.btn-icon:hover,
.btn-icon.active {
  background: #f0fdfa;
  color: #2dd4bf;
}

.print-title {
  display: none;
}

.btn-icon.sm {
  width: 24px;
  height: 24px;
}

.btn-icon.sm svg {
  width: 14px;
  height: 14px;
}

.btn-icon.delete:hover {
  background: #fef2f2;
  color: #dc2626;
}

.badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  background: #f59e0b;
  color: white;
  font-size: 9px;
  font-weight: 600;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.content-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  transition: margin-right 0.25s ease;
}

.body.with-panel .content-wrapper {
  margin-right: 280px;
}

.editor {
  max-width: 720px;
  margin: 0 auto;
}

.editor-input {
  width: 100%;
  min-height: calc(100vh - 140px);
  padding: 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  resize: none;
  line-height: 1.8;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.editor-input:focus {
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.article-container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
}

.content {
  padding: 2rem 2.5rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: #1a1a1a;
  user-select: text;
  line-height: 1.8;
}

.content :deep(strong) {
  font-weight: 600;
}

.content :deep(u) {
  text-decoration: underline;
  text-decoration-color: #2dd4bf;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.content :deep(.ann-highlight) {
  background: rgba(245, 158, 11, 0.12);
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.15s;
}

.content :deep(.ann-highlight:hover) {
  background: rgba(245, 158, 11, 0.2);
}

.content :deep(.ann-highlight.ann-depth-1) {
  background: rgba(59, 130, 246, 0.1);
}

.content :deep(.ann-highlight.ann-depth-1:hover) {
  background: rgba(59, 130, 246, 0.18);
}

.content :deep(.ann-highlight.ann-depth-2) {
  background: rgba(168, 85, 247, 0.1);
}

.content :deep(.ann-highlight.ann-depth-2:hover) {
  background: rgba(168, 85, 247, 0.18);
}

.content :deep(.ann-note) {
  display: inline;
  cursor: pointer;
  margin-left: 1px;
  font-size: var(--ann-font-size, 14px);
  vertical-align: sub;
  color: #f59e0b;
}

.content :deep(.ann-note.ann-depth-1) {
  color: #3b82f6;
}

.content :deep(.ann-note.ann-depth-2) {
  color: #a855f7;
}

.content :deep(.ann-note::before) {
  content: none;
}

.content :deep(.ann-note::after) {
  content: none;
}

.content :deep(.ann-note[data-expanded="true"]::before) {
  content: "【";
}

.content :deep(.ann-note[data-expanded="true"]::after) {
  content: attr(data-content) "】";
}

.panel {
  position: fixed;
  right: 0;
  top: 49px;
  bottom: 0;
  width: 280px;
  background: white;
  border-left: 1px solid #eee;
  display: flex;
  flex-direction: column;
  z-index: 40;
}

.ann-controls {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #eee;
}

.ann-mode-btn {
  flex: 1;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #999;
  transition: all 0.15s;
}

.ann-mode-btn svg {
  width: 14px;
  height: 14px;
}

.ann-mode-btn:hover {
  background: #f0f0f0;
  color: #666;
}

.ann-mode-btn.active {
  background: #f0fdfa;
  color: #2dd4bf;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #eee;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #333;
}

.panel-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #999;
}

.panel-close svg {
  width: 14px;
  height: 14px;
}

.panel-close:hover {
  background: #f0f0f0;
  color: #333;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.setting {
  margin-bottom: 1rem;
}

.setting-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
  color: #666;
}

.setting-value {
  color: #2dd4bf;
  font-weight: 500;
}

.setting input[type="range"] {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #e5e5e5;
  outline: none;
  -webkit-appearance: none;
}

.setting input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #2dd4bf;
  cursor: pointer;
}

.font-select {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.625rem;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  color: #333;
}

.font-select svg {
  width: 14px;
  height: 14px;
  color: #999;
}

.font-dropdown {
  margin-top: 0.375rem;
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
  max-height: 180px;
  overflow-y: auto;
}

.font-group {
  padding: 0.25rem 0;
}

.font-group-title {
  padding: 0.25rem 0.625rem;
  font-size: 0.625rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.font-option {
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  cursor: pointer;
  color: #333;
}

.font-option:hover {
  background: #f8f9fa;
}

.font-option.active {
  background: #f0fdfa;
  color: #2dd4bf;
}

.reset-btn {
  width: 100%;
  padding: 0.5rem;
  background: #f8f9fa;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  color: #666;
  cursor: pointer;
  margin-top: 0.5rem;
}

.reset-btn:hover {
  background: #f0f0f0;
}

.new-ann {
  background: #f0fdfa;
  border-radius: 6px;
  padding: 0.625rem;
  margin-bottom: 0.75rem;
}

.new-ann-header {
  margin-bottom: 0.375rem;
}

.new-ann-label {
  font-size: 0.625rem;
  color: #2dd4bf;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.new-ann-text {
  display: block;
  font-size: 0.75rem;
  color: #333;
  font-weight: 500;
  margin-top: 0.125rem;
}

.dict-suggestions {
  margin-bottom: 0.5rem;
  background: white;
  border-radius: 4px;
  padding: 0.5rem;
}

.dict-suggestions-title {
  font-size: 0.625rem;
  color: #2dd4bf;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.375rem;
}

.dict-suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 120px;
  overflow-y: auto;
}

.dict-suggestion-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.375rem 0.5rem;
  background: #f8f9fa;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.15s;
}

.dict-suggestion-item:hover {
  background: #f0fdfa;
  border-color: #2dd4bf;
}

.dict-suggestion-content {
  font-size: 0.75rem;
  color: #333;
  line-height: 1.4;
}

.dict-suggestion-source {
  font-size: 0.625rem;
  color: #999;
  margin-top: 0.125rem;
}

.new-ann textarea {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.new-ann textarea:focus {
  outline: none;
  border-color: #2dd4bf;
}

.new-ann .error {
  color: #dc2626;
  font-size: 0.6875rem;
  margin-top: 0.25rem;
}

.new-ann-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
  margin-top: 0.375rem;
}

.ann-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ann-item {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 0.625rem;
}

.ann-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.ann-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: #333;
}

.ann-actions {
  display: flex;
  gap: 0.125rem;
}

.btn-icon.sm.ai {
  color: #0284c7;
}

.ann-content {
  margin: 0;
  font-size: 0.75rem;
  color: #666;
  line-height: 1.5;
}

.ann-edit .ann-ref {
  font-size: 0.75rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 0.375rem;
}

.ann-edit textarea {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: 0.375rem;
}

.ann-edit textarea:focus {
  outline: none;
  border-color: #2dd4bf;
}

.ann-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
}

.empty {
  text-align: center;
  padding: 2rem;
  color: #999;
}

.empty p {
  margin: 0;
  font-size: 0.8125rem;
}

.empty .hint {
  font-size: 0.6875rem;
  margin-top: 0.25rem;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  background: white;
  border-radius: 8px;
  padding: 0.375rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  min-width: 120px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #333;
  text-align: left;
}

.menu-item svg {
  width: 14px;
  height: 14px;
  color: #999;
}

.menu-item:hover {
  background: #f8f9fa;
}

.menu-item:hover svg {
  color: #2dd4bf;
}

.menu-item.highlight {
  color: #f59e0b;
}

.menu-item.highlight svg {
  color: #f59e0b;
}

.menu-item.highlight:hover {
  background: #fffbeb;
}

.menu-divider {
  height: 1px;
  background: #eee;
  margin: 0.25rem 0;
}

.panel-enter-active,
.panel-leave-active {
  transition: all 0.25s ease;
}

.panel-enter-from,
.panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.context-enter-active,
.context-leave-active {
  transition: all 0.15s ease;
}

.context-enter-from,
.context-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

@media (max-width: 768px) {
  .header {
    padding: 0.625rem 0.75rem;
    padding-top: calc(0.625rem + env(safe-area-inset-top));
  }

  .back-btn {
    width: 28px;
    height: 28px;
  }

  .back-btn svg {
    width: 16px;
    height: 16px;
  }

  .title {
    font-size: 0.875rem;
  }

  .actions {
    gap: 0.25rem;
  }

  .btn-icon {
    width: 28px;
    height: 28px;
  }

  .btn-icon svg {
    width: 16px;
    height: 16px;
  }

  .btn-primary {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  .body.with-panel .content-wrapper {
    margin-right: 0;
    margin-bottom: 0;
  }

  .panel {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
    max-height: 70vh;
    border-left: none;
    border-top: 1px solid #eee;
    border-radius: 16px 16px 0 0;
    padding-bottom: env(safe-area-inset-bottom);
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }

  .panel-enter-from,
  .panel-leave-to {
    transform: translateY(100%);
  }

  .panel-enter-to,
  .panel-leave-from {
    transform: translateY(0);
  }

  .content-wrapper {
    padding: 0.75rem;
    padding-bottom: 1rem;
  }

  .article-container {
    border-radius: 8px;
  }

  .content {
    padding: 1rem;
    font-size: 16px;
  }

  .context-menu {
    max-width: calc(100vw - 2rem);
    left: 1rem !important;
    right: 1rem !important;
  }

  .ann-controls {
    flex-wrap: wrap;
  }

  .ann-mode-btn {
    min-width: calc(25% - 0.2rem);
  }

  .new-ann {
    padding: 0.5rem;
  }

  .dict-suggestions {
    max-height: 100px;
  }

  .dict-suggestion-item {
    padding: 0.25rem 0.375rem;
  }
}

/* 全局滚动条样式 */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  /* 侧边栏宽度调节样式 */
  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: transparent;
    cursor: col-resize;
    z-index: 10;
  }

  .resize-handle:hover {
    background: rgba(45, 212, 191, 0.3);
  }

  /* 词典功能样式 */
  .search-box {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #eee;
  }

  .search-icon {
    width: 18px;
    height: 18px;
    color: #999;
    margin-right: 0.5rem;
    flex-shrink: 0;
  }

  .search-box input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.9375rem;
    outline: none;
    color: #1a1a1a;
  }

  .search-box input::placeholder {
    color: #999;
  }

  .stats {
    display: flex;
    gap: 1rem;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    color: #999;
    border-bottom: 1px solid #eee;
  }

  .result-list,
  .entry-list {
    padding: 0.5rem 0;
  }

  .result-item,
  .entry-item {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f0f0f0;
  }

  .result-item:last-child,
  .entry-item:last-child {
    border-bottom: none;
  }

  .result-text,
  .entry-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 0.375rem;
  }

  .entry-count {
    display: inline-block;
    font-size: 0.625rem;
    color: #2dd4bf;
    background: #f0fdfa;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    margin-left: 0.5rem;
    vertical-align: middle;
  }

  .result-meanings,
  .entry-meanings {
    margin-top: 0.25rem;
  }

  .meaning {
    font-size: 0.8125rem;
    color: #666;
    line-height: 1.6;
    padding: 0.25rem 0;
  }

  .meaning-content {
    color: #333;
  }

  .meaning-source {
    color: #999;
    font-size: 0.75rem;
  }

  .section-title {
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: #999;
    background: #fafafa;
    border-bottom: 1px solid #eee;
  }

  /* AI Chat styles */
  .panel-footer {
    padding: 1rem;
    border-top: 1px solid #eee;
    background: #f8f9fa;
    position: relative;
  }

  .panel-footer textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    font-size: 0.875rem;
    resize: none;
    transition: all 0.15s;
    box-sizing: border-box;
    margin-bottom: 0.75rem;
  }

  .panel-footer textarea:focus {
    outline: none;
    border-color: #2dd4bf;
    box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
  }

  .panel-footer textarea:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-actions .btn-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
  }

  .footer-actions .btn-text svg {
    width: 16px;
    height: 16px;
  }

  .footer-actions .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    padding: 0;
  }

  .footer-actions .btn-primary svg {
    width: 18px;
    height: 18px;
  }

  .export-menu {
    position: relative;
  }

  .export-dropdown {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 0.5rem;
    background: white;
    border: 1px solid #eee;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 100;
    min-width: 140px;
    display: none;
  }

  .export-menu:hover .export-dropdown {
    display: flex;
    flex-direction: column;
  }

  .export-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 0.75rem;
    color: #333;
    transition: background 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .export-option:hover {
    background: #f8f9fa;
  }

  .export-option svg {
    width: 14px;
    height: 14px;
    color: #666;
  }

  .send-loading {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* 对话框样式 */
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog-content {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    width: 90%;
    max-width: 480px;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #eee;
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
    color: #333;
  }

  .dialog-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: #999;
  }

  .dialog-close:hover {
    background: #f0f0f0;
    color: #333;
  }

  .dialog-body {
    padding: 1.5rem;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #eee;
    background: #f8f9fa;
  }

  .ai-annotation-selected {
    margin-bottom: 1.5rem;
  }

  .ai-annotation-selected .label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .ai-annotation-selected .text {
    display: block;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #333;
  }

  .ai-annotation-result {
    margin-bottom: 1.5rem;
  }

  .ai-annotation-result .label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #666;
    margin-bottom: 0.5rem;
  }

  .result-content {
    padding: 0.75rem;
    background: #f0fdfa;
    border: 1px solid #e0f2f1;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #333;
    margin-bottom: 0.5rem;
  }

  .ai-note {
    font-size: 0.75rem;
    color: #999;
    font-style: italic;
  }

  .ai-annotation-question {
    font-size: 0.875rem;
    color: #333;
    text-align: center;
    margin-top: 1rem;
  }

  .loading-dialog {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .loading-circle {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #2dd4bf;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .result-content.editable {
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    border: 1px solid #e0f2f1;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .result-content.editable:focus {
    outline: none;
    border-color: #2dd4bf;
    box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.1);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 对话框过渡动画 */
  .dialog-enter-active,
  .dialog-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .dialog-enter-from,
  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.95);
  }

  .messages {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    flex: 1;
  }

  .message {
    display: flex;
    gap: 0.5rem;
    animation: fadeIn 0.3s ease;
  }

  .message-body {
    flex: 1;
  }

  .think-container {
    background: #f8f9fa;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    overflow: hidden;
  }

  .think-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.75rem;
    color: #666;
    transition: all 0.15s;
  }

  .think-toggle:hover {
    background: #f0f2f5;
  }

  .think-toggle svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .think-content {
    padding: 0.75rem;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: #4b5563;
    background: #fefefe;
    border-top: 1px solid #e5e7eb;
  }

  .think-container.streaming {
    margin-bottom: 0.5rem;
  }

  .think-container.streaming .think-content {
    border-top: none;
  }

  /* 聊天记录管理系统样式 */
  .chat-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .session-manager {
    height: calc(100vh - 49px);
    display: flex;
    flex-direction: column;
  }

  .session-manager-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #eee;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #333;
  }

  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .session-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .session-item:hover {
    background: #f8f9fa;
  }

  .session-item.active {
    background: #f0fdfa;
    border: 1px solid #e0f2fe;
  }

  .session-info {
    flex: 1;
  }

  .session-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .session-badge {
    font-size: 0.6875rem;
    color: #2dd4bf;
    background: #f0fdfa;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .session-meta {
    font-size: 0.75rem;
    color: #999;
  }

  .session-actions {
    display: flex;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .session-item:hover .session-actions {
    opacity: 1;
  }

  .session-manager-footer {
    padding: 1rem;
    border-top: 1px solid #eee;
    background: #f8f9fa;
  }

  .session-title-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .session-title-input:focus {
    outline: none;
    border-color: #2dd4bf;
    box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
  }

  .session-manager-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .message-timestamp {
    font-size: 0.6875rem;
    color: #999;
    margin-top: 0.25rem;
    text-align: right;
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
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    color: #666;
  }

  .message-content {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    line-height: 1.5;
    font-size: 0.875rem;
  }

  .message.user .message-content {
    background: #e3f2fd;
    color: #1565c0;
    border-top-left-radius: 4px;
  }

  .message.assistant .message-content {
    background: #f8f9fa;
    color: #333;
    border-top-right-radius: 4px;
  }

  .message.assistant .message-content.streaming {
    background: #f0f9ff;
    border: 1px solid #e0f2fe;
  }

  .loading-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #666;
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
    background: #999;
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
    background: #fef2f2;
    color: #dc2626;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    text-align: center;
  }

  @media print {
    .reader {
      background: white;
    }

    .header,
    .panel,
    .context-menu,
    .btn-primary,
    .btn-icon {
      display: none !important;
    }

    .print-title {
      display: block;
      font-size: 18pt;
      font-weight: 600;
      text-align: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .body {
      display: block;
    }

    .body.with-panel .content-wrapper {
      margin-right: 0;
    }

    .content-wrapper {
      padding: 0;
      overflow: visible;
    }

    .article-container {
      max-width: none;
      box-shadow: none;
      border-radius: 0;
    }

    .content {
      padding: 0;
      font-size: 12pt;
      line-height: 1.8;
    }

    .content :deep(.ann-highlight) {
      background: rgba(245, 158, 11, 0.15);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .content :deep(.ann-note::before) {
      content: "【";
      color: #f59e0b;
    }

    .content :deep(.ann-note::after) {
      content: attr(data-content) "】";
      display: inline;
      color: #666;
    }
  }
</style>
