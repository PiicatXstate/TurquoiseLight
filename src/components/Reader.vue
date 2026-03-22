<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Annotation, TextFormat } from '@/types'
import { useArticles } from '@/composables/useArticles'
import { useSettings } from '@/composables/useSettings'
import Dictionary from '@/components/Dictionary.vue'

const props = defineProps<{
  articleId: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const { getArticle, addAnnotation, updateAnnotation, deleteAnnotation, checkAnnotationExists, addFormat, removeFormat, updateArticle, findDictionaryEntries } = useArticles()
const { settings, updateSettings, resetSettings } = useSettings()

const article = computed(() => getArticle(props.articleId))

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

  document.addEventListener('contextmenu', handleContextMenu)
  document.addEventListener('click', hideContextMenu)
  
  const content = readerContent.value
  if (content) {
    content.addEventListener('touchstart', handleTouchStart, { passive: true })
    content.addEventListener('touchend', handleTouchEnd)
    content.addEventListener('touchmove', handleTouchMove, { passive: true })
  }
})

onUnmounted(() => {
  document.removeEventListener('contextmenu', handleContextMenu)
  document.removeEventListener('click', hideContextMenu)
  
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

function hideContextMenu() {
  contextMenu.value.show = false
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

function handlePrint() {
  window.print()
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
        <button v-if="isEditing" class="btn-text" @click="cancelEditing">取消</button>
        <button class="btn-primary" @click="isEditing ? saveContent() : startEditing()">
          {{ isEditing ? '保存' : '编辑' }}
        </button>
        <button v-if="!isEditing" class="btn-icon" @click="handlePrint" title="打印">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 6,2 18,2 18,9"></polyline>
            <path d="M6,18H4a2,2,0,0,1-2-2V9a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v7a2,2,0,0,1-2,2H18"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" @click="showDictionary = true" title="词典">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"></path>
            <path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5V4.5A2.5,2.5,0,0,1,6.5,2Z"></path>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showSettings }" @click="showSettings = !showSettings; showAnnotations = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4,15a1.65,1.65,0,0,0,.33,1.82l.06.06a2,2,0,0,1,0,2.83,2,2,0,0,1-2.83,0l-.06-.06a1.65,1.65,0,0,0-1.82-.33,1.65,1.65,0,0,0-1,1.51V21a2,2,0,0,1-2,2,2,2,0,0,1-2-2v-.09A1.65,1.65,0,0,0,9,19.4a1.65,1.65,0,0,0-1.82.33l-.06.06a2,2,0,0,1-2.83,0,2,2,0,0,1,0-2.83l.06-.06a1.65,1.65,0,0,0,.33-1.82,1.65,1.65,0,0,0-1.51-1H3a2,2,0,0,1-2-2,2,2,0,0,1,2-2h.09A1.65,1.65,0,0,0,4.6,9a1.65,1.65,0,0,0-.33-1.82l-.06-.06a2,2,0,0,1,0-2.83,2,2,0,0,1,2.83,0l.06.06a1.65,1.65,0,0,0,1.82.33H9a1.65,1.65,0,0,0,1-1.51V3a2,2,0,0,1,2-2,2,2,0,0,1,2,2v.09a1.65,1.65,0,0,0,1,1.51,1.65,1.65,0,0,0,1.82-.33l.06-.06a2,2,0,0,1,2.83,0,2,2,0,0,1,0,2.83l-.06.06a1.65,1.65,0,0,0-.33,1.82V9a1.65,1.65,0,0,0,1.51,1H21a2,2,0,0,1,2,2,2,2,0,0,1-2,2h-.09a1.65,1.65,0,0,0-1.51,1Z"></path>
          </svg>
        </button>
        <button v-if="!isEditing" class="btn-icon" :class="{ active: showAnnotations }" @click="showAnnotations = !showAnnotations; showSettings = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span v-if="article.annotations.length > 0" class="badge">{{ article.annotations.length }}</span>
        </button>
      </div>
    </header>

    <div class="body" :class="{ 'with-panel': showSettings || showAnnotations }">
      <div class="content-wrapper">
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
        <div v-if="showSettings" class="panel">
          <div class="panel-header">
            <span>阅读设置</span>
            <button class="panel-close" @click="showSettings = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
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
        <div v-if="showAnnotations && !isEditing" class="panel">
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
            <div v-if="selectedText" class="new-ann">
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
                    <div class="ann-actions">
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
          <button class="menu-item" @click="showDictionary = true; hideContextMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"></path>
              <path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5V4.5A2.5,2.5,0,0,1,6.5,2Z"></path>
            </svg>
            <span>查词典</span>
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

      <Dictionary v-if="showDictionary" :initial-query="selectedText" @close="showDictionary = false" />
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
