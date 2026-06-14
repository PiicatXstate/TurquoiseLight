<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SharedArticle } from '@/types'
import { useArticles } from '@/composables/useArticles'
import { useSettings } from '@/composables/useSettings'
import { useChatSessions } from '@/composables/useChatSessions'
import { useAIChat } from '@/composables/useAIChat'
import { useAnnotations } from '@/composables/useAnnotations'
import { useReader } from '@/composables/useReader'
import { renderMarkdown } from '@/utils/markdown'
import Dictionary from './Dictionary.vue'

const props = defineProps<{
  articleId: string
  sharedArticle?: SharedArticle | null
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { getArticle, addAnnotation, updateAnnotation, deleteAnnotation, checkAnnotationExists, addFormat, removeFormat, updateArticle, findDictionaryEntries } = useArticles()
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

// 初始化composables
const chatSession = useChatSessions(props.articleId)
const aiChat = useAIChat()
const annotations = useAnnotations()
const reader = useReader(article, checkAnnotationExists, addFormat, removeFormat)

// 从各个composable中解构需要的状态和方法
const {
  chatSessions,
  currentSessionId,
  showSessionManager,
  editingSessionId,
  editingSessionTitle,
  getCurrentSession,
  createChatSession,
  renameChatSession,
  deleteChatSession,
  exportChatSession
} = chatSession

const {
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
} = aiChat

const {
  showAIAnnotationDialog,
  aiAnnotationLoading,
  aiAnnotationResult,
  aiAnnotationSelectedText,
  annotationContent,
  editingAnnotationId,
  editingAnnotationContent,
  annotationError,
  expandedAnnotations,
  annotationLockMode,
  handleAISelectionAnnotation,
  confirmAddAIAnnotation,
  cancelAIAnnotation,
  toggleAnnotation,
  setAnnotationMode,
  startEditAnnotation,
  saveEditAnnotation,
  cancelEditAnnotation,
  getAnnotationDepth
} = annotations

const {
  showSettings,
  showAnnotations,
  showDictionary,
  showAIChat,
  splitPanelMode,
  splitRatio,
  selectedText,
  selectedStartIndex,
  selectedEndIndex,
  readerContent,
  isEditing,
  editContent,
  selectedAnnotationText,
  sidebarWidth,
  contextMenu,
  localFonts,
  showFontPicker,
  presetFonts,
  handleTouchStart,
  handleTouchEnd,
  handleTouchMove,
  handleContextMenu,
  hideContextMenu,
  handleTextSelection,
  addBoldFormat,
  addUnderlineFormat,
  openAnnotationPanel,
  clearSelection,
  startEditing,
  saveContent,
  cancelEditing,
  selectFont,
  getFormattedContent,
  handleContentClick,
  calculateTextPosition,
  startResize,
  startSplitResize
} = reader

const dictionaryInitialQuery = ref('')

// 打印预览相关
interface PrintOptions {
  showAnnotations: boolean
  showFormats: boolean
  fontSize: string
  pageMargin: string
  includeBackground: boolean
  showPageNumbers: boolean
}

const showPrintPreview = ref(false)
const printOptions = ref<PrintOptions>({
  showAnnotations: true,
  showFormats: true,
  fontSize: '12',
  pageMargin: 'normal',
  includeBackground: true,
  showPageNumbers: true
})
const printPreviewContent = ref('')

const printPageStyle = computed(() => {
  return {
    fontSize: `${printOptions.value.fontSize}pt`,
    lineHeight: '1.8'
  }
})

// 监听打印选项变化，自动更新预览
watch([
  () => printOptions.value.showAnnotations,
  () => printOptions.value.showFormats,
  () => printOptions.value.fontSize,
  () => printOptions.value.pageMargin
], () => {
  if (showPrintPreview.value) {
    updatePrintPreview()
  }
})

// 生成打印预览内容
function updatePrintPreview() {
  printPreviewContent.value = generatePrintContent()
}

// 打开打印预览
function openPrintPreview() {
  showPrintPreview.value = true
  updatePrintPreview()
}

// 关闭打印预览
function closePrintPreview() {
  showPrintPreview.value = false
}

// 执行打印（先转PDF再打开预览）
async function executePrint() {
  if (!article.value) return
  
  // 生成打印内容
  const titleHtml = printOptions.value.showFormats 
    ? `<h1 style="font-size: 14pt; font-weight: 600; text-align: center; margin: 0 0 0.75rem 0; color: #111827;">${article.value.title}</h1>`
    : ''
  
  const content = generatePrintContent()
  
  // 生成页眉和页脚
  const header = printOptions.value.showPageNumbers 
    ? `<div style="font-size: 0.75rem; color: #9ca3af; text-align: center; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 1rem;">${article.value.title}</div>`
    : ''
  
  const footer = printOptions.value.showPageNumbers 
    ? `<div style="font-size: 0.75rem; color: #9ca3af; text-align: center; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; margin-top: 1rem;">第 1 页</div>`
    : ''
  
  const fullContent = `
    ${header}
    ${titleHtml}
    <div style="white-space: pre-wrap; word-break: break-word;">${content}</div>
    ${footer}
  `
  
  // 检查是否在 Electron 环境中
  const electron = window.electron as any
  if (electron && electron.printWithPreview) {
    try {
      const result = await electron.printWithPreview({
        filename: `${article.value.title}.pdf`,
        content: fullContent,
        header: header,
        footer: footer,
        fontSize: `${printOptions.value.fontSize}pt`,
        margin: getPageMarginCSS()
      })
      
      if (result.success) {
        closePrintPreview()
      } else if (!result.canceled) {
        alert(`打印失败：${result.error}`)
      }
    } catch (error: any) {
      console.error('打印失败:', error)
      alert(`打印失败：${error.message}`)
    }
  } else {
    // 浏览器环境：使用打印窗口
    const printWindow = window.open('', '_blank', 'width=900,height=800,toolbar=0,menubar=0,scrollbars=1,resizable=1')
    
    if (!printWindow) {
      alert('无法打开打印预览窗口，请检查浏览器的弹窗阻止设置')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>打印预览 - ${article.value.title}</title>
        <style>
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 2rem; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
          .print-container { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 1.5in; max-width: 800px; margin: 0 auto; min-height: 100vh; box-sizing: border-box; }
          h1 { font-size: 14pt; font-weight: 600; text-align: center; margin: 0 0 0.75rem 0; color: #111827; }
          strong { font-weight: 600; }
          @media print {
            body { padding: 0; background: white; }
            .print-container { box-shadow: none; padding: 0; margin: 0; max-width: none; }
            .print-actions { display: none; }
            @page { size: A4; margin: ${getPageMarginCSS()}; }
          }
          .print-actions { display: flex; justify-content: center; gap: 0.75rem; margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; }
          .print-btn { padding: 0.5rem 1.5rem; font-size: 0.875rem; font-weight: 500; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; }
          .print-btn-primary { background: #007AFF; color: white; }
          .print-btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
          .print-btn-secondary:hover { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${fullContent}
        </div>
        <div class="print-actions">
          <button class="print-btn print-btn-secondary" onclick="window.close()">关闭</button>
          <button class="print-btn print-btn-primary" onclick="window.print()">打印</button>
        </div>
      </body>
      </html>
    `)
    
    printWindow.document.close()
    closePrintPreview()
  }
}

// 导出为 PDF
async function exportToPDF() {
  if (!article.value) return
  
  // 生成打印内容
  const content = generatePrintContent()
  
  // 生成页眉和页脚
  const header = printOptions.value.showPageNumbers 
    ? `<div style="font-size: 0.75rem; color: #9ca3af; text-align: center; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 1rem;">${article.value.title}</div>`
    : ''
  
  const footer = printOptions.value.showPageNumbers 
    ? `<div style="font-size: 0.75rem; color: #9ca3af; text-align: center; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; margin-top: 1rem;">第 1 页</div>`
    : ''
  
  // 添加标题
  const titleHtml = printOptions.value.showFormats 
    ? `<h1 style="font-size: 14pt; font-weight: 600; text-align: center; margin: 0 0 0.75rem 0; color: #111827;">${article.value.title}</h1>`
    : ''
  
  const fullContent = `
    ${header}
    ${titleHtml}
    <div style="white-space: pre-wrap; word-break: break-word;">${content}</div>
    ${footer}
  `
  
  // 检查是否在 Electron 环境中
  const electron = window.electron as any
  if (electron && electron.printToPDF) {
    try {
      const result = await electron.printToPDF({
        filename: `${article.value.title}.pdf`,
        content: fullContent,
        header: header,
        footer: footer,
        fontSize: `${printOptions.value.fontSize}pt`,
        margin: getPageMarginCSS()
      })
      
      if (result.success) {
        alert(`PDF 已成功导出到：${result.filePath}`)
        closePrintPreview()
      } else if (!result.canceled) {
        alert(`导出失败：${result.error}`)
      }
    } catch (error: any) {
      console.error('PDF 导出失败:', error)
      alert(`导出失败：${error.message}`)
    }
  } else {
    // 浏览器环境：使用打印窗口
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    
    if (!printWindow) {
      alert('无法打开打印窗口，请检查浏览器的弹窗阻止设置')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>导出 PDF - ${article.value.title}</title>
        <style>
          @page {
            size: A4;
            margin: ${getPageMarginCSS()};
          }
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: ${printOptions.value.fontSize}pt;
            line-height: 1.8;
            color: #1f2937;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          strong {
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        ${fullContent}
      </body>
      </html>
    `)
    
    printWindow.document.close()
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        closePrintPreview()
      }, 200)
    }
  }
}

// 导出为 Word
function exportToWord() {
  if (!article.value) return
  
  // 生成打印内容
  const content = generatePrintContent()
  
  // 生成 Word 文档 HTML
  const titleHtml = printOptions.value.showFormats 
    ? `<h1 style="font-size: 18pt; font-weight: 600; text-align: center; margin: 0 0 1rem 0;">${article.value.title}</h1>`
    : ''
  
  const header = printOptions.value.showPageNumbers 
    ? `<div style="font-size: 10pt; color: #6b7280; text-align: center; padding-bottom: 8pt; border-bottom: 1px solid #e5e7eb; margin-bottom: 12pt;">${article.value.title}</div>`
    : ''
  
  const footer = printOptions.value.showPageNumbers 
    ? `<div style="font-size: 10pt; color: #6b7280; text-align: center; padding-top: 8pt; border-top: 1px solid #e5e7eb; margin-top: 12pt;">第 1 页</div>`
    : ''
  
  // 生成 Word 兼容的 HTML
  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <title>${article.value.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: ${printOptions.value.fontSize}pt;
          line-height: 1.8;
          color: #1f2937;
          margin: ${getPageMarginCSS()};
        }
        h1 {
          font-size: 18pt;
          font-weight: 600;
          text-align: center;
          margin: 0 0 1rem 0;
        }
        strong {
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      ${header}
      ${titleHtml}
      <div style="white-space: pre-wrap; word-break: break-word;">${content}</div>
      ${footer}
    </body>
    </html>
  `
  
  // 创建 Blob 并下载
  const blob = new Blob([htmlContent], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${article.value.title}.doc`
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  closePrintPreview()
}

// 生成打印内容（和预览相同的逻辑）
function generatePrintContent(): string {
  if (!article.value) return ''
  
  const content = article.value.content
  const chars = content.split('')
  const result: string[] = []
  
  const annotations = article.value.annotations
  const formats = article.value.formats
  
  const annotationStarts = new Map<number, typeof annotations>()
  const annotationEnds = new Map<number, typeof annotations>()
  const formatStarts = new Map<number, typeof formats>()
  const formatEnds = new Map<number, typeof formats>()
  
  if (printOptions.value.showAnnotations) {
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
  }
  
  if (printOptions.value.showFormats) {
    for (const format of formats) {
      if (!formatStarts.has(format.startIndex)) {
        formatStarts.set(format.startIndex, [])
      }
      formatStarts.get(format.startIndex)!.push(format)
      
      if (!formatEnds.has(format.endIndex)) {
        formatEnds.set(format.endIndex, [])
      }
      formatEnds.get(format.endIndex)!.push(format)
    }
  }
  
  for (let i = 0; i < chars.length; i++) {
    if (printOptions.value.showAnnotations && annotationStarts.has(i)) {
      result.push('<span style="background: #fff9c4; border: 1px dashed #f57f17; border-radius: 2px; padding: 0 2px;">')
    }
    
    if (printOptions.value.showFormats && formatStarts.has(i)) {
      const starts = formatStarts.get(i)!
      for (const format of starts) {
        if (format.type === 'bold') {
          result.push('<strong>')
        } else if (format.type === 'underline') {
          result.push('<span style="background: linear-gradient(90deg, #1e40af 0%, #1e40af 100%) 0 100% / 100% 2px no-repeat; padding-bottom: 1px; border-radius: 2px;">')
        }
      }
    }
    
    // 处理特殊字符
    if (chars[i] === '\n') {
      result.push('\n')
    } else if (chars[i] === ' ') {
      result.push(' ')
    } else {
      result.push(chars[i])
    }
    
    if (printOptions.value.showFormats && formatEnds.has(i + 1)) {
      const ends = formatEnds.get(i + 1)!
      for (const format of ends) {
        if (format.type === 'bold') {
          result.push('</strong>')
        } else if (format.type === 'underline') {
          result.push('</span>')
        }
      }
    }
    
    if (printOptions.value.showAnnotations && annotationEnds.has(i + 1)) {
      const endingAnns = annotationEnds.get(i + 1)!
      result.push('</span>')
      for (const ann of endingAnns) {
        result.push(`<span style="font-size: 85%; color: #1e40af; font-weight: 500; margin-left: 4px;">[${ann.content}]</span>`)
      }
    }
  }
  
  return result.join('')
}

function getPageMarginCSS(): string {
  switch (printOptions.value.pageMargin) {
    case 'small':
      return '0.5in'
    case 'large':
      return '1.5in'
    default:
      return '1in'
  }
}

// 处理打印 - 重写 handlePrint
function handlePrintWrapper() {
  openPrintPreview()
}

// 监听AI聊天面板的显示状态，保存和恢复滚动位置
watch(showAIChat, (newValue, oldValue) => {
  if (!oldValue && newValue) {
    // 面板从关闭到打开，恢复滚动位置
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages')
      if (messagesContainer) {
        // 这里可以添加恢复滚动位置的逻辑
        // 由于滚动位置已经在useChatSessions中处理，这里可以不做额外操作
      }
    }, 50)
  } else if (oldValue && !newValue) {
    // 面板从打开到关闭，保存滚动位置
    const messagesContainer = document.querySelector('.messages')
    if (messagesContainer) {
      // 滚动位置已经在useChatSessions中处理
    }
  }
})

// 监听分屏模式的变化，保存和恢复滚动位置
watch(splitPanelMode, (newValue, oldValue) => {
  if (!oldValue && newValue) {
    // 进入分屏模式，恢复滚动位置
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages')
      if (messagesContainer) {
        // 滚动位置已经在useChatSessions中处理
      }
    }, 50)
  } else if (oldValue && !newValue) {
    // 退出分屏模式，保存滚动位置
    const messagesContainer = document.querySelector('.messages')
    if (messagesContainer) {
      // 滚动位置已经在useChatSessions中处理
    }
  }
})

// 确保readerContent被使用，避免TypeScript错误
if (readerContent) {
  // readerContent用于绑定到DOM元素，在useReader中使用
}

// 监听选中的注释文本变化
watch(() => selectedAnnotationText.value, (newText) => {
  if (newText) {
    inputMessage.value = `解释一下"${newText}"的意思`
  }
}, { immediate: true })

// 计算词典条目
const dictionaryEntries = computed(() => {
  if (!selectedText.value.trim()) return []
  return findDictionaryEntries(selectedText.value)
})

// 创建注释
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

// 移除注释
function removeAnnotation(annotationId: string) {
  if (article.value) {
    deleteAnnotation(article.value.id, annotationId)
  }
}

// 保存内容
function saveContentWrapper() {
  saveContent(updateArticle)
}

// 选择字体
function selectFontWrapper(font: string) {
  selectFont(font, updateSettings)
}

// 处理内容点击
function handleContentClickWrapper(e: MouseEvent | TouchEvent) {
  handleContentClick(e, toggleAnnotation)
}

// 获取格式化内容
function getFormattedContentWrapper() {
  return getFormattedContent(getAnnotationDepth, expandedAnnotations.value, annotationLockMode.value)
}

// 处理AI关于选中内容的询问
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
async function handleAISelectionAnnotationWrapper() {
  await handleAISelectionAnnotation(selectedText.value, article.value, selectedStartIndex.value, selectedEndIndex.value)
}

// 确认添加AI注释
function confirmAddAIAnnotationWrapper() {
  confirmAddAIAnnotation(article.value, selectedText.value, selectedStartIndex.value, selectedEndIndex.value, addAnnotation)
}

// 保存编辑的注释
function saveEditAnnotationWrapper() {
  saveEditAnnotation(article.value, updateAnnotation)
}

// 切换词典面板
function toggleDictionary() {
  showDictionary.value = !showDictionary.value
  if (showDictionary.value) {
    showSettings.value = false
    showAnnotations.value = false
    showAIChat.value = false
    splitPanelMode.value = false
  }
}

// 切换设置面板
function toggleSettings() {
  showSettings.value = !showSettings.value
  if (showSettings.value) {
    showAnnotations.value = false
    showAIChat.value = false
    showDictionary.value = false
    splitPanelMode.value = false
  }
}

// 切换注释面板
function toggleAnnotations() {
  if (showAIChat.value) {
    splitPanelMode.value = !showAnnotations.value
    showAnnotations.value = !showAnnotations.value
  } else {
    showAnnotations.value = !showAnnotations.value
    showSettings.value = false
    showDictionary.value = false
    splitPanelMode.value = false
  }
}

// 切换AI聊天面板
function toggleAIChat() {
  if (showAnnotations.value) {
    splitPanelMode.value = !showAIChat.value
    showAIChat.value = !showAIChat.value
  } else {
    showAIChat.value = !showAIChat.value
    showSettings.value = false
    showDictionary.value = false
    splitPanelMode.value = false
  }
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
      <div class="actions">
        <template v-if="!isSharedArticle">
          <button v-if="isEditing" class="btn-text" @click="cancelEditing">取消</button>
          <button class="btn-primary" @click="isEditing ? saveContentWrapper() : startEditing()">
            {{ isEditing ? '保存' : '编辑' }}
          </button>
        </template>
        <span v-if="isSharedArticle" class="shared-badge">来自广场</span>
        <button v-if="!isEditing" class="btn-icon" @click="handlePrintWrapper" title="打印">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 6,2 18,2 18,9"></polyline>
            <path d="M6,18H4a2,2,0,0,1-2-2V9a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v7a2,2,0,0,1-2,2H18"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showDictionary }" @click="toggleDictionary" title="词典">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"></path>
            <path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5V4.5A2.5,2.5,0,0,1,6.5,2Z"></path>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showSettings }" @click="toggleSettings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1,0,2.83,2,2,0,0,1-2.83,0l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-2,2,2,2,0,0,1-2-2v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83,0,2,2,0,0,1,0-2.83l.06-.06a1.65,1.65,0,0,0,.33-1.82,1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1-2-2,2,2,0,0,1,2-2h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06a2,2,0,0,1,0-2.83,2,2,0,0,1,2.83,0l.06.06a1.65,1.65,0,0,0,1.82.33H9a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,2-2,2,2,0,0,1,2,2v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,0,2,2,0,0,1,0,2.83l-.06.06a1.65,1.65,0,0,0-.33,1.82V9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,2,2,2,2,0,0,1-2,2h-.09a1.65,1.65,0,0,0-1.51,1Z"></path>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showAnnotations }" @click="toggleAnnotations">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span v-if="article.annotations.length > 0" class="badge">{{ article.annotations.length }}</span>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showAIChat }" @click="toggleAIChat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2H3v16h5v4l4-4h5l4-4V2h-5z"></path>
            <path d="M10 6v6"></path>
            <path d="M14 6v6"></path>
          </svg>
        </button>
      </div>
    </header>

    <div class="body" :class="{ 'with-panel': showSettings || showAnnotations || showAIChat || showDictionary || splitPanelMode }">
      <div class="content-wrapper scrollbar-visible" :style="{ marginRight: (showSettings || showAnnotations || showAIChat || showDictionary || splitPanelMode) ? sidebarWidth + 'px' : '0' }">
        <div v-if="isEditing" class="editor">
          <textarea
            v-model="editContent"
            class="editor-input"
            placeholder="输入或粘贴文言文内容..."
          ></textarea>
        </div>
        <article v-else class="article-container">
          <h1 class="article-title">{{ article.title }}</h1>
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
            @contextmenu="handleContextMenu"
            @touchstart="handleTouchStart"
            @touchend="(e) => {
              handleTouchEnd();
              handleContentClickWrapper(e);
            }"
            @touchmove="handleTouchMove"
            v-html="getFormattedContentWrapper()"
            @click="handleContentClickWrapper"
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
          <div class="panel-body scrollbar-visible">
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
                    :style="{ fontFamily: font }" @click.stop="selectFontWrapper(font)">
                    {{ font.includes('SourceHan') ? '思源宋体' : font.includes(',') ? font.split(',')[0] : font === 'serif' ? '宋体' : font === 'sans-serif' ? '黑体' : font }}
                  </div>
                </div>
                <div class="font-group" v-if="localFonts.length > 0">
                  <div class="font-group-title">本地</div>
                  <div v-for="font in localFonts.slice(0, 30)" :key="font"
                    class="font-option" :class="{ active: settings.fontFamily === font }"
                    :style="{ fontFamily: font }" @click.stop="selectFontWrapper(font)">
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
        <div v-if="showAnnotations && !isEditing && !splitPanelMode" class="panel" :style="{ width: sidebarWidth + 'px' }">
          <div class="panel-header">
            <span>注释 ({{ article.annotations.length }})</span>
            <button class="panel-close" @click="showAnnotations = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="ann-controls">
            <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'normal' }" @click="setAnnotationMode('normal', article)" title="普通模式">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'locked' }" @click="setAnnotationMode('locked', article)" title="锁定展开">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </button>
            <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'all-expanded' }" @click="setAnnotationMode('all-expanded', article)" title="全部展开">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
            <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'all-collapsed' }" @click="setAnnotationMode('all-collapsed', article)" title="全部折叠">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
          <div class="resize-handle" @mousedown="startResize"></div>
          <div class="panel-body scrollbar-visible">
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
                    <button class="btn-primary sm" @click="saveEditAnnotationWrapper" :disabled="!editingAnnotationContent.trim()">保存</button>
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
                    </div>
                  </div>
                  <p class="ann-content" v-html="renderMarkdown(ann.content)"></p>
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
          <div class="resize-handle" @mousedown="startResize"></div>
          <Dictionary 
            :initial-query="dictionaryInitialQuery"
            :embedded="true"
            @close="showDictionary = false"
            @open-article="(_id: string) => { showDictionary = false }"
          />
        </div>
      </Transition>

      <Transition name="panel">
        <div v-if="splitPanelMode" class="panel split-panel" :style="{ width: sidebarWidth + 'px' }">
          <div class="resize-handle" @mousedown="startResize"></div>
          
          <div class="split-left" :style="{ width: splitRatio + '%' }">
            <div class="panel-header split-header">
              <span>注释 ({{ article.annotations.length }})</span>
              <button class="panel-close" @click="showAnnotations = false; splitPanelMode = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="ann-controls">
              <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'normal' }" @click="setAnnotationMode('normal', article)" title="普通模式">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
              <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'locked' }" @click="setAnnotationMode('locked', article)" title="锁定展开">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </button>
              <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'all-expanded' }" @click="setAnnotationMode('all-expanded', article)" title="全部展开">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </button>
              <button class="ann-mode-btn" :class="{ active: annotationLockMode === 'all-collapsed' }" @click="setAnnotationMode('all-collapsed', article)" title="全部折叠">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
            <div class="split-body scrollbar-visible">
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
                      <button class="btn-primary sm" @click="saveEditAnnotationWrapper" :disabled="!editingAnnotationContent.trim()">保存</button>
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
                      </div>
                    </div>
                    <p class="ann-content" v-html="renderMarkdown(ann.content)"></p>
                  </div>
                </div>
              </div>
              <div v-if="article.annotations.length === 0 && !selectedText" class="empty">
                <p>暂无注释</p>
              </div>
            </div>
          </div>
          
          <div class="split-divider-v" @mousedown="startSplitResize"></div>
          
          <div class="split-right" :style="{ width: (100 - splitRatio) + '%' }">
            <div class="panel-header split-header">
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
              <button class="panel-close" @click="showAIChat = false; splitPanelMode = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
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
            <div v-else class="split-body">
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
                    <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
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
                    <div class="message-content streaming" v-html="renderMarkdown(streamContent)"></div>
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
                @keydown="(e) => handleKeyDown(e, chatSession)"
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
                          <path d="M12,20a2,2,0,0,1-2-2V6a2,2,0,0,1,2-2h5a2,2,0,0,1,2,2v6a2,2,0,0,1-2,2h-5a2,2,0,0,0-2,2v4Z"></path>
                          <path d="M5,10a2,2,0,0,1-2-2V4a2,2,0,0,1,2-2h5a2,2,0,0,1,2,2v4a2,2,0,0,1-2,2Z"></path>
                        </svg>
                        <span>导出为JSON</span>
                      </button>
                    </div>
                  </button>
                </div>
                <button class="btn-text" title="清空上下文">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                  </svg>
                </button>
                <button 
                  class="btn-primary" 
                  @click="sendMessage(chatSession)"
                  :disabled="isEmptyInput || loading || streaming"
                >
                  <svg v-if="!loading && !streaming" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                  </svg>
                  <div v-else class="loading-spinner">
                    <div class="spinner"></div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="panel">
        <div v-if="showAIChat && !splitPanelMode" class="panel" :style="{ width: sidebarWidth + 'px' }">
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
                  <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
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
                  <div class="message-content streaming" v-html="renderMarkdown(streamContent)"></div>
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
              @keydown="(e) => handleKeyDown(e, chatSession)"
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
              <button class="btn-text" @click="clearMessages(chatSession)" title="清空对话">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"></polyline>
                  <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                </svg>
              </button>
              <button 
                class="btn-primary" 
                @click="sendMessage(chatSession)"
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
          <button class="menu-item" @click="dictionaryInitialQuery = selectedText; showDictionary = true; showSettings = false; showAnnotations = false; showAIChat = false; hideContextMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"></path>
              <path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5V4.5A2.5,2.5,0,0,1,6.5,2Z"></path>
            </svg>
            <span>查词典</span>
          </button>
          <button class="menu-item" @click="askAIAboutSelection(); hideContextMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>问AI</span>
          </button>
          <button class="menu-item" @click="handleAISelectionAnnotationWrapper(); hideContextMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
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
                  <button class="btn-icon sm" @click="handleAISelectionAnnotationWrapper()" title="重新生成">
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
              <button class="btn-primary" @click="confirmAddAIAnnotationWrapper">添加到文章</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- 打印预览对话框 -->
      <Transition name="dialog">
        <div v-if="showPrintPreview" class="dialog-overlay print-overlay" @click.stop>
          <div class="dialog-content print-dialog">
            <div class="print-dialog-header">
              <button class="dialog-close" @click="closePrintPreview">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="dialog-body print-body">
              <div class="print-controls">
                <div class="control-group">
                  <label>打印选项</label>
                  <div class="control-options">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="printOptions.showAnnotations">
                      <span>显示注释</span>
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="printOptions.showFormats">
                      <span>显示格式（加粗、下划线）</span>
                    </label>
                  </div>
                </div>

                <div class="control-group">
                  <label>字体大小</label>
                  <div class="control-options">
                    <select v-model="printOptions.fontSize">
                      <option value="10">小 (10pt)</option>
                      <option value="12">标准 (12pt)</option>
                      <option value="14">大 (14pt)</option>
                      <option value="16">特大 (16pt)</option>
                    </select>
                  </div>
                </div>

                <div class="control-group">
                  <label>页边距</label>
                  <div class="control-options">
                    <select v-model="printOptions.pageMargin">
                      <option value="small">小</option>
                      <option value="normal">标准</option>
                      <option value="large">大</option>
                    </select>
                  </div>
                </div>

                <div class="control-group">
                  <label>打印效果</label>
                  <div class="control-options">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="printOptions.includeBackground">
                      <span>包含背景色</span>
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="printOptions.showPageNumbers">
                      <span>显示页码</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="print-preview-area">
                <div class="preview-header">
                  <span>预览</span>
                  <button class="btn-text" @click="updatePrintPreview" title="刷新预览">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23,4 23,10 17,10"></polyline>
                      <polyline points="1,20 1,14 7,14"></polyline>
                      <path d="M3.51,9a9,9,0,0,1,14.85-3.36L23,10M1,14l4.64,4.36A9,9,0,0,0,20.49,15"></path>
                    </svg>
                    刷新
                  </button>
                </div>
                <div class="preview-container">
                  <div class="print-page" :class="`margin-${printOptions.pageMargin}`">
                    <div class="page-header" v-if="printOptions.showPageNumbers">
                      <span class="page-title">{{ article.title }}</span>
                    </div>
                    <div class="page-content" :style="printPageStyle">
                      <div v-if="printOptions.showFormats" class="article-title">{{ article.title }}</div>
                      <div v-html="printPreviewContent"></div>
                    </div>
                    <div class="page-footer" v-if="printOptions.showPageNumbers">
                      <span class="page-number">第 1 页</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="dialog-footer">
              <div class="left-actions">
                <button class="btn-text" @click="closePrintPreview">取消</button>
              </div>
              <div class="right-actions">
                <button class="btn-secondary" @click="exportToWord" title="导出为 Word">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <text x="7" y="16" font-size="8" font-weight="600" fill="currentColor" stroke="none">W</text>
                    <text x="14" y="16" font-size="8" font-weight="600" fill="currentColor" stroke="none">X</text>
                  </svg>
                  Word
                </button>
                <button class="btn-secondary pdf-btn" @click="exportToPDF" title="导出为 PDF">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14,2 14,8 20,8"></polyline>
                    <text x="6" y="17" font-size="6" font-weight="600" fill="currentColor" stroke="none">PDF</text>
                  </svg>
                  PDF
                </button>
                <button class="btn-primary" @click="executePrint">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 6,2 18,2 18,9"></polyline>
                    <path d="M6,18H4a2,2,0,0,1-2-2V9a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v7a2,2,0,0,1-2,2H18"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  打印
                </button>
              </div>
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
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 50;
  -webkit-app-region: drag;
}

.header button,
.header .btn-icon,
.header .btn-text,
.header .btn-primary,
.header .shared-badge {
  -webkit-app-region: no-drag;
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
  color: var(--text-secondary);
  transition: all 0.15s;
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.back-btn:hover {
  background: var(--bg-tertiary);
  color: var(--primary-color);
}

.title {
  flex: 1;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
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
  padding: 0.375rem 1rem;
  background: var(--primary-color);
  color: var(--bg-primary);
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-primary:hover {
  background: var(--primary-color);
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
  color: var(--text-secondary);
  border: none;
  font-size: 0.8125rem;
  cursor: pointer;
}

.btn-text:hover {
  color: var(--text-primary);
}

.btn-secondary {
  padding: 0.375rem 1rem;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 0.5px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-secondary:hover {
  background: var(--bg-primary);
  border-color: var(--primary-color);
}

.btn-secondary svg {
  width: 16px;
  height: 16px;
}

.shared-badge {
  padding: 0.25rem 0.5rem;
  background: var(--primary-50);
  color: var(--primary-color);
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
  color: var(--text-secondary);
  position: relative;
  transition: all 0.15s;
}

.btn-icon svg {
  width: 18px;
  height: 18px;
}

.btn-icon:hover,
.btn-icon.active {
  background: var(--primary-50);
  color: var(--primary-color);
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
  background: rgba(239, 68, 68, 0.05);
  color: var(--error-color);
}

.badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  background: var(--warning-color);
  color: var(--bg-primary);
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
  background: var(--bg-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.editor-input:focus {
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.article-container {
  max-width: 800px;
  margin: 0 auto;
  background: var(--bg-primary);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
}

.content {
  padding: 0.5rem 2.5rem 2rem 2.5rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
  user-select: text;
  line-height: 1.8;
}

.content :deep(.article-title) {
  font-family: 'Source Han Serif CN', 'Noto Serif SC', serif;
  font-size: 1.25em;
  font-weight: 600;
  text-align: center;
  margin: 0 0 1em 0;
  color: var(--text-primary);
}

.article-title {
  font-family: 'Source Han Serif CN', 'Noto Serif SC', serif;
  font-size: 1.25em;
  font-weight: 600;
  text-align: center;
  margin: 1.5em 0 0.5em 0;
  padding: 0 2.5rem;
  color: var(--text-primary);
}

.content :deep(strong) {
  font-weight: 600;
}

.content :deep(u) {
  text-decoration: none;
  background: linear-gradient(90deg, var(--primary-color) 0%, var(--primary-color) 100%) 0 100% / 100% 2px no-repeat;
  padding-bottom: 1px;
  border-radius: 2px;
}

.content :deep(.ann-highlight) {
  background: linear-gradient(to top, rgba(100, 116, 139, 0.3)) 0 100% / 100% 50% no-repeat;
  cursor: pointer;
  transition: background 0.15s;
}

.content :deep(.ann-highlight:hover) {
  background: linear-gradient(to top, rgba(100, 116, 139, 0.45)) 0 100% / 100% 50% no-repeat;
}

.content :deep(.ann-highlight.ann-depth-1) {
  background: linear-gradient(to top, rgba(100, 116, 139, 0.25)) 0 100% / 100% 50% no-repeat;
}

.content :deep(.ann-highlight.ann-depth-1:hover) {
  background: linear-gradient(to top, rgba(100, 116, 139, 0.4)) 0 100% / 100% 50% no-repeat;
}

.content :deep(.ann-highlight.ann-depth-2) {
  background: linear-gradient(to top, rgba(100, 116, 139, 0.2)) 0 100% / 100% 50% no-repeat;
}

.content :deep(.ann-highlight.ann-depth-2:hover) {
  background: linear-gradient(to top, rgba(100, 116, 139, 0.35)) 0 100% / 100% 50% no-repeat;
}

.content :deep(.ann-note) {
  display: inline;
  cursor: pointer;
  margin-left: 2px;
  font-size: var(--ann-font-size, 14px);
  color: var(--text-secondary);
}

.content :deep(.ann-note::before) {
  content: none;
}

.content :deep(.ann-note::after) {
  content: none;
}

.content :deep(.ann-note[data-expanded="true"]) {
  display: inline;
  padding: 1px 4px;
  background: rgba(100, 116, 139, 0.15);
  border-radius: 3px;
  letter-spacing: 0;
}

.content :deep(.ann-note[data-expanded="true"]::before) {
  content: none;
}

.content :deep(.ann-note[data-expanded="true"]::after) {
  content: attr(data-content);
}

.panel {
  position: fixed;
  right: 0;
  top: 49px;
  bottom: 0;
  width: 280px;
  background: #f5f5f7;
  border-left: 0.5px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  z-index: 40;
}

:global(.dark-mode) .panel {
  background: #1c1c1e;
  border-left-color: rgba(255, 255, 255, 0.08);
}

.split-panel {
  display: flex;
  flex-direction: row;
}

.split-left,
.split-right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.split-header {
  flex-shrink: 0;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
}

.split-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.split-body.messages {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.split-footer {
  flex-shrink: 0;
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);
}

:global(.dark-mode) .split-footer {
  border-top-color: rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.04);
}

.split-footer textarea {
  flex: 1;
  padding: 8px 10px;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  font-size: 13px;
  resize: none;
  min-height: 32px;
  max-height: 80px;
  background: #ffffff;
  color: #1d1d1f;
}

:global(.dark-mode) .split-footer textarea {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.12);
  color: #f5f5f7;
}

.split-footer textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb), 0.12);
}

.split-footer .btn-primary {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--primary-color);
}

.split-footer .btn-primary:hover {
  background: var(--primary-600);
}

.split-footer .btn-primary svg {
  width: 16px;
  height: 16px;
}

.split-divider-v {
  width: 4px;
  background: rgba(0, 0, 0, 0.08);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.15s;
}

.split-divider-v:hover {
  background: var(--primary-color);
}

.ann-controls {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

:global(.dark-mode) .ann-controls {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.ann-mode-btn {
  flex: 1;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #86868b;
  transition: all 0.15s;
}

:global(.dark-mode) .ann-mode-btn {
  background: #2c2c2e;
  color: #86868b;
}

.ann-mode-btn svg {
  width: 16px;
  height: 16px;
}

.ann-mode-btn:hover {
  background: #e9e9eb;
  color: #1d1d1f;
}

:global(.dark-mode) .ann-mode-btn:hover {
  background: #3a3a3c;
  color: #f5f5f7;
}

.ann-mode-btn.active {
  background: rgba(var(--primary-color-rgb), 0.15);
  color: var(--primary-color);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

:global(.dark-mode) .panel-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}

.panel-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #86868b;
  transition: all 0.15s ease;
}

:global(.dark-mode) .panel-close {
  color: #86868b;
}

.panel-close svg {
  width: 16px;
  height: 16px;
}

.panel-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

:global(.dark-mode) .panel-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.setting {
  margin-bottom: 20px;
}

.setting-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #86868b;
}

.setting-value {
  color: var(--primary-color);
  font-weight: 500;
}

.setting input[type="range"] {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: #e9e9eb;
  outline: none;
  -webkit-appearance: none;
}

:global(.dark-mode) .setting input[type="range"] {
  background: #3a3a3c;
}

.setting input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  border: 0.5px solid rgba(0, 0, 0, 0.1);
}

.font-select {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #ffffff;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #1d1d1f;
  transition: all 0.2s ease;
}

:global(.dark-mode) .font-select {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.12);
  color: #f5f5f7;
}

.font-select:hover {
  border-color: var(--primary-color);
}

.font-select svg {
  width: 16px;
  height: 16px;
  color: #86868b;
}

.font-dropdown {
  margin-top: 8px;
  background: #ffffff;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  max-height: 180px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

:global(.dark-mode) .font-dropdown {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.12);
}

.font-group {
  padding: 4px 0;
}

.font-group-title {
  padding: 6px 12px;
  font-size: 11px;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.font-option {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  color: #1d1d1f;
  transition: background 0.15s ease;
}

:global(.dark-mode) .font-option {
  color: #f5f5f7;
}

.font-option:hover {
  background: #f5f5f7;
}

:global(.dark-mode) .font-option:hover {
  background: #3a3a3c;
}

.font-option.active {
  background: rgba(var(--primary-color-rgb), 0.08);
  color: var(--primary-color);
}

.reset-btn {
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: var(--primary-color);
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.15s ease;
}

.reset-btn:hover {
  background: rgba(var(--primary-color-rgb), 0.08);
}

.new-ann {
  background: rgba(var(--primary-color-rgb), 0.08);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 0.5px solid rgba(var(--primary-color-rgb), 0.15);
}

.new-ann-header {
  margin-bottom: 6px;
}

.new-ann-label {
  font-size: 11px;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.new-ann-text {
  display: block;
  font-size: 13px;
  color: #1d1d1f;
  font-weight: 500;
  margin-top: 2px;
}

:global(.dark-mode) .new-ann-text {
  color: #f5f5f7;
}

.dict-suggestions {
  margin-bottom: 8px;
  background: #ffffff;
  border-radius: 8px;
  padding: 8px;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .dict-suggestions {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.08);
}

.dict-suggestions-title {
  font-size: 11px;
  color: var(--primary-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.dict-suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.dict-suggestion-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 10px;
  background: #f5f5f7;
  border: 0.5px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.15s;
}

:global(.dark-mode) .dict-suggestion-item {
  background: #3a3a3c;
}

.dict-suggestion-item:hover {
  background: var(--primary-50);
  border-color: var(--primary-color);
}

.dict-suggestion-content {
  font-size: 0.75rem;
  color: var(--text-primary);
  line-height: 1.4;
}

.dict-suggestion-source {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  margin-top: 0.125rem;
}

.new-ann textarea {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
}

.new-ann textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.new-ann .error {
  color: var(--error-color);
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
  background: var(--bg-secondary);
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
  color: var(--text-primary);
}

.ann-actions {
  display: flex;
  gap: 0.125rem;
}

.btn-icon.sm.ai {
  color: var(--info-color);
}

.ann-content {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.ann-content :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 0.1em 0.3em;
  border-radius: 2px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

.ann-content :deep(strong) {
  font-weight: 600;
  color: var(--text-primary);
}

.ann-content :deep(em) {
  font-style: italic;
}

.ann-content :deep(p) {
  margin: 0.3em 0;
}

.ann-content :deep(ul),
.ann-content :deep(ol) {
  margin: 0.3em 0;
  padding-left: 1.2em;
}

.ann-edit .ann-ref {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.375rem;
}

.ann-edit textarea {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  margin-bottom: 0.375rem;
}

.ann-edit textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.ann-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
}

.empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary);
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
  background: var(--bg-primary);
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
  color: var(--text-primary);
  text-align: left;
}

.menu-item svg {
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
}

.menu-item:hover {
  background: var(--bg-secondary);
}

.menu-item:hover svg {
  color: var(--primary-color);
}

.menu-item.highlight {
  color: var(--warning-color);
}

.menu-item.highlight svg {
  color: var(--warning-color);
}

.menu-item.highlight:hover {
  background: rgba(245, 158, 11, 0.1);
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
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
    border-top: 1px solid var(--border-color);
    border-radius: 16px 16px 0 0;
    padding-bottom: env(safe-area-inset-bottom);
    transition: transform 0.3s ease;
  }

  .panel-enter-from,
  .panel-leave-to {
    transform: translateY(100%);
  }

  .panel-enter-active,
  .panel-leave-active {
    transform: translateY(0);
  }

  .content-wrapper {
    padding: 0.75rem;
    padding-bottom: 1rem;
  }

  .article-container {
    border-radius: 4px;
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

  .new-ann {
    padding: 0.5rem;
  }

  .ann-controls {
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 8px;
  }

  .ann-mode-btn {
    min-width: calc(25% - 3px);
    height: 28px;
  }

  .dict-suggestions {
    max-height: 100px;
  }

  .dict-suggestion-item {
    padding: 0.25rem 0.375rem;
  }

  .print-dialog {
    width: 95vw;
    height: 90vh;
  }

  .print-body {
    flex-direction: column;
  }

  .print-controls {
    width: 100%;
    height: auto;
    max-height: 30vh;
    overflow-y: auto;
    padding-right: 0;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .print-preview-area {
    border-left: none;
    padding-left: 0;
    padding-top: 1rem;
  }

  .control-group {
    margin-bottom: 1rem;
  }

  .control-options {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .checkbox-label {
    flex: 1;
    min-width: 45%;
  }

  .preview-container {
    padding: 0.5rem;
  }

  .print-page {
    max-width: 100%;
    min-height: 400px;
  }

  .print-page.margin-small {
    padding: 0.25in;
  }

  .print-page.margin-normal {
    padding: 0.5in;
  }

  .print-page.margin-large {
    padding: 0.75in;
  }
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
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .search-icon {
    width: 18px;
    height: 18px;
    color: var(--text-tertiary);
    margin-right: 0.5rem;
    flex-shrink: 0;
  }

  .search-box input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: 0.9375rem;
    outline: none;
    color: var(--text-primary);
  }

  .search-box input::placeholder {
    color: var(--text-tertiary);
  }

  .stats {
    display: flex;
    gap: 1rem;
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--border-color);
  }

  .result-list,
  .entry-list {
    padding: 0.5rem 0;
  }

  .result-item,
  .entry-item {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bg-tertiary);
  }

  .result-item:last-child,
  .entry-item:last-child {
    border-bottom: none;
  }

  .result-text,
  .entry-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.375rem;
  }

  .entry-count {
    display: inline-block;
    font-size: 0.625rem;
    color: var(--primary-color);
    background: var(--primary-50);
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
    color: var(--text-secondary);
    line-height: 1.6;
    padding: 0.25rem 0;
  }

  .meaning-content {
    color: var(--text-primary);
  }

  .meaning-source {
    color: var(--text-tertiary);
    font-size: 0.75rem;
  }

  .section-title {
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: var(--text-tertiary);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  /* AI Chat styles */
  .panel-footer {
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    position: relative;
  }

  .panel-footer textarea {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.875rem;
    resize: none;
    transition: all 0.15s;
    box-sizing: border-box;
    margin-bottom: 0.5rem;
  }

  .panel-footer textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
  }

  .panel-footer textarea:disabled {
    background: var(--bg-tertiary);
    cursor: not-allowed;
  }

  .footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.25rem;
  }

  .footer-actions .btn-text {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem;
  }

  .footer-actions .btn-text svg {
    width: 14px;
    height: 14px;
  }

  .footer-actions .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
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
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
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
    color: var(--text-primary);
    transition: background 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  .export-option:hover {
    background: var(--bg-secondary);
  }

  .export-option svg {
    width: 14px;
    height: 14px;
    color: var(--text-secondary);
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
    background: var(--bg-primary);
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
    border-bottom: 1px solid var(--border-color);
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--text-primary);
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
    color: var(--text-tertiary);
  }

  .dialog-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .dialog-body {
    padding: 1.5rem;
  }

  .dialog-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-top: 0.5px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .dialog-footer .left-actions {
    display: flex;
    gap: 0.5rem;
  }

  .dialog-footer .right-actions {
    display: flex;
    gap: 0.5rem;
  }

  .dialog-footer .btn-primary {
    padding: 0.5rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 6px;
    background: var(--primary-color);
    color: white;
    border: none;
    box-shadow: none;
    transition: background 0.15s;
  }

  .dialog-footer .btn-primary:hover {
    background: var(--primary-600, #0056b3);
    transform: none;
  }

  .dialog-footer .btn-secondary {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    background: #f5f5f7;
    color: #1d1d1f;
    border: 1px solid #e5e5ea;
    box-shadow: none;
    transition: all 0.15s;
  }

  .dialog-footer .btn-secondary:hover {
    background: #e8e8ed;
    border-color: #d1d1d6;
    transform: none;
  }

  .dialog-footer .btn-secondary.pdf-btn {
    background: #fff5f5;
    border-color: #fecaca;
    color: #dc2626;
  }

  .dialog-footer .btn-secondary.pdf-btn:hover {
    background: #fee2e2;
    border-color: #fca5a5;
  }

  .dialog-footer .btn-text {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    color: var(--text-secondary);
    transition: all 0.15s;
  }

  .dialog-footer .btn-text:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .ai-annotation-selected {
    margin-bottom: 1.5rem;
  }

  .ai-annotation-selected .label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .ai-annotation-selected .text {
    display: block;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
  }

  .ai-annotation-result {
    margin-bottom: 1.5rem;
  }

  .ai-annotation-result .label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .result-content {
    padding: 0.75rem;
    background: var(--primary-50);
    border: 1px solid var(--primary-100);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .ai-note {
    font-size: 0.75rem;
    color: var(--text-tertiary);
    font-style: italic;
  }

  .ai-annotation-question {
    font-size: 0.875rem;
    color: var(--text-primary);
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
    border: 3px solid var(--bg-tertiary);
    border-top: 3px solid var(--primary-color);
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
    border: 1px solid var(--primary-100);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    box-sizing: border-box;
  }

  .result-content.editable:focus {
    outline: none;
    border-color: var(--primary-color);
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
    background: var(--bg-secondary);
    border: 1px solid var(--gray-200);
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
    color: var(--text-secondary);
    transition: all 0.15s;
  }

  .think-toggle:hover {
    background: var(--bg-secondary);
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
    color: var(--gray-600);
    background: #fefefe;
    border-top: 1px solid var(--gray-200);
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
    border-bottom: 1px solid var(--border-color);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
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
    background: var(--bg-secondary);
  }

  .session-item.active {
    background: var(--primary-50);
    border: 1px solid rgba(6, 182, 212, 0.2);
  }

  .session-info {
    flex: 1;
  }

  .session-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .session-badge {
    font-size: 0.6875rem;
    color: var(--primary-color);
    background: var(--primary-50);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .session-meta {
    font-size: 0.75rem;
    color: var(--text-tertiary);
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
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .session-title-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--gray-200);
    border-radius: 6px;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .session-title-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
  }

  .session-manager-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .message-timestamp {
    font-size: 0.6875rem;
    color: var(--text-tertiary);
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
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .message-content {
    padding: 0.5rem 0.75rem;
    border-radius: 12px;
    line-height: 1.5;
    font-size: 0.875rem;
  }

  .message-content :deep(h1),
  .message-content :deep(h2),
  .message-content :deep(h3),
  .message-content :deep(h4),
  .message-content :deep(h5),
  .message-content :deep(h6) {
    margin: 0.5em 0 0.3em;
    font-weight: 600;
    line-height: 1.3;
  }

  .message-content :deep(h1) { font-size: 1.5em; }
  .message-content :deep(h2) { font-size: 1.3em; }
  .message-content :deep(h3) { font-size: 1.15em; }

  .message-content :deep(p) {
    margin: 0.5em 0;
  }

  .message-content :deep(ul),
  .message-content :deep(ol) {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }

  .message-content :deep(li) {
    margin: 0.25em 0;
  }

  .message-content :deep(code) {
    background: rgba(0, 0, 0, 0.05);
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9em;
  }

  .message-content :deep(pre) {
    background: rgba(0, 0, 0, 0.05);
    padding: 0.75em 1em;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.5em 0;
  }

  .message-content :deep(pre code) {
    background: none;
    padding: 0;
  }

  .message-content :deep(blockquote) {
    border-left: 3px solid var(--primary-color);
    margin: 0.5em 0;
    padding: 0.25em 0 0.25em 1em;
    color: var(--text-secondary);
  }

  .message-content :deep(strong) {
    font-weight: 600;
  }

  .message-content :deep(em) {
    font-style: italic;
  }

  .message-content :deep(a) {
    color: var(--primary-color);
    text-decoration: none;
  }

  .message-content :deep(a:hover) {
    text-decoration: underline;
  }

  .message-content :deep(hr) {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 1em 0;
  }

  .message-content :deep(table) {
    border-collapse: collapse;
    margin: 0.5em 0;
    width: 100%;
  }

  .message-content :deep(th),
  .message-content :deep(td) {
    border: 1px solid var(--border-color);
    padding: 0.4em 0.6em;
    text-align: left;
  }

  .message-content :deep(th) {
    background: var(--bg-tertiary);
    font-weight: 600;
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

  .print-overlay {
    z-index: 1000;
    background: rgba(0, 0, 0, 0.4);
  }

  .print-dialog {
    max-width: 90vw;
    max-height: 90vh;
    width: 1200px;
    height: 85vh;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    border: none;
  }

  .print-dialog-header {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e5e7eb;
  }

  .print-dialog-header .dialog-close {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.15s;
  }

  .print-dialog-header .dialog-close:hover {
    background: #e5e7eb;
    color: #1f2937;
  }

  .print-dialog-header .dialog-close svg {
    width: 16px;
    height: 16px;
  }

  .print-body {
    flex: 1;
    display: flex;
    gap: 0;
    min-height: 0;
    background: #ffffff;
  }

  .print-controls {
    width: 260px;
    flex-shrink: 0;
    overflow-y: auto;
    padding: 1.25rem;
    background: #fafafa;
    border-right: 1px solid #e5e7eb;
  }

  .control-group {
    margin-bottom: 1.25rem;
  }

  .control-group label:first-child {
    display: block;
    font-weight: 600;
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.5rem;
  }

  .control-options {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #374151;
    cursor: pointer;
    user-select: none;
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .checkbox-label:hover {
    background: #f3f4f6;
  }

  .checkbox-label input {
    width: 16px;
    height: 16px;
    accent-color: var(--primary-color, #007AFF);
  }

  .control-options select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.8125rem;
    background: #ffffff;
    color: #1f2937;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 16px;
    padding-right: 2rem;
  }

  .control-options select:focus {
    outline: none;
    border-color: var(--primary-color, #007AFF);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  }

  .print-preview-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    background: #f5f5f5;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: none;
  }

  .preview-header span {
    font-weight: 600;
    font-size: 0.875rem;
    color: #1f2937;
  }

  .preview-header .btn-text {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    transition: background 0.15s;
    color: #6b7280;
  }

  .preview-header .btn-text:hover {
    background: #e5e7eb;
    color: #1f2937;
  }

  .preview-header .btn-text svg {
    width: 14px;
    height: 14px;
  }

  .preview-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: #e5e7eb;
    border-radius: 6px;
    padding: 1.25rem;
    border: none;
  }

  .print-page {
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    margin: 0 auto;
    max-width: 700px;
    min-height: 850px;
    box-sizing: border-box;
    position: relative;
    border-radius: 4px;
  }

  .print-page.margin-small {
    padding: 0.5in;
  }

  .print-page.margin-normal {
    padding: 1in;
  }

  .print-page.margin-large {
    padding: 1.5in;
  }

  .page-header,
  .page-footer {
    font-size: 0.75rem;
    color: #9ca3af;
    text-align: center;
    padding: 0.625rem 0;
  }

  .page-header {
    border-bottom: 0.5px solid #e5e7eb;
    margin-bottom: 1rem;
  }

  .page-footer {
    border-top: 0.5px solid #e5e7eb;
    margin-top: 1rem;
  }

  .page-content {
    line-height: 1.8;
    color: #1f2937;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .page-content .article-title {
    font-size: 1.25rem;
    font-weight: 600;
    text-align: center;
    margin-bottom: 1rem;
    color: #111827;
  }

  .print-underline {
    background: linear-gradient(90deg, #1e40af 0%, #1e40af 100%) 0 100% / 100% 2px no-repeat;
    padding-bottom: 1px;
    border-radius: 2px;
  }

  .print-highlight {
    background: #fff9c4;
    border: 1px dashed #f57f17;
    border-radius: 2px;
    padding: 0 2px;
  }

  .print-note {
    font-size: 85%;
    color: #1e40af;
    font-weight: 500;
    margin-left: 4px;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.05);
    color: var(--error-color);
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    text-align: center;
  }

  @media print {
    .reader {
      background: var(--bg-primary);
    }

    .header,
    .panel,
    .context-menu,
    .btn-primary,
    .btn-icon {
      display: none !important;
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

    .content :deep(.article-title),
    .article-title {
      font-size: 14pt;
      font-weight: 600;
      text-align: center;
      margin-bottom: 0.75rem;
    }

    .content :deep(.ann-highlight) {
      background: linear-gradient(to top, rgba(100, 116, 139, 0.3)) 0 100% / 100% 50% no-repeat;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .content :deep(.ann-note) {
      display: inline;
      padding: 0 2pt;
      background: rgba(100, 116, 139, 0.15);
      border-radius: 2pt;
      font-size: 10pt;
      letter-spacing: 0;
    }

    .content :deep(.ann-note::before) {
      content: none;
    }

    .content :deep(.ann-note::after) {
      content: attr(data-content);
      color: var(--text-secondary);
    }
  }
</style>
