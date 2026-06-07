import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import type { Article, Annotation, TextFormat } from '@/types'

export function useReader(article: Ref<Article | undefined>, checkAnnotationExists: Function, addFormat: Function, removeFormat: Function) {
  const showSettings = ref(false)
  const showAnnotations = ref(true)
  const showDictionary = ref(false)
  const showAIChat = ref(false)
  const splitPanelMode = ref(false)
  const splitRatio = ref(50)
  const selectedText = ref('')
  const selectedStartIndex = ref(0)
  const selectedEndIndex = ref(0)
  const readerContent = ref<HTMLElement | null>(null)
  const isEditing = ref(false)
  const editContent = ref('')
  const selectedAnnotationText = ref('')
  const sidebarWidth = ref(280)

  // 上下文菜单
  const contextMenu = ref({
    show: false,
    x: 0,
    y: 0
  })

  // 本地字体
  const localFonts = ref<string[]>([])
  const showFontPicker = ref(false)

  // 长按计时器
  const longPressTimer = ref<number | null>(null)
  const touchStartPos = ref({ x: 0, y: 0 })

  // 侧边栏宽度调节
  const isResizing = ref(false)
  const isSplitResizing = ref(false)

  const presetFonts = [
    'serif',
    'KaiTi, serif',
    'FangSong, serif',
    'SourceHanSerifCN, serif',
    'sans-serif'
  ]

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
    document.addEventListener('mousemove', splitResize)
    document.addEventListener('mouseup', stopSplitResize)
    
    const content = readerContent.value
    if (content) {
      content.addEventListener('touchstart', handleTouchStart, { passive: true })
      content.addEventListener('touchend', handleTouchEnd)
      content.addEventListener('touchmove', handleTouchMove, { passive: true })
    }
  })

  onUnmounted(() => {
    document.removeEventListener('contextmenu', handleContextMenu)
    
    // 移除侧边栏宽度调节的事件监听器
    document.removeEventListener('mousemove', resize)
    document.removeEventListener('mouseup', stopResize)
    document.removeEventListener('mousemove', splitResize)
    document.removeEventListener('mouseup', stopSplitResize)
    
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
        (f: TextFormat) => f.type === 'bold' && f.startIndex === selectedStartIndex.value && f.endIndex === selectedEndIndex.value
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
        (f: TextFormat) => f.type === 'underline' && f.startIndex === selectedStartIndex.value && f.endIndex === selectedEndIndex.value
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
        // 注释已存在的处理逻辑
      } else {
        showAnnotations.value = true
      }
    }
    hideContextMenu()
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

  function saveContent(updateArticle: Function) {
    if (article.value) {
      updateArticle(article.value.id, { content: editContent.value })
      isEditing.value = false
    }
  }

  function cancelEditing() {
    isEditing.value = false
  }

  function selectFont(font: string, updateSettings: Function) {
    updateSettings({ fontFamily: font })
    showFontPicker.value = false
  }

  function getFormattedContent(getAnnotationDepth: Function) {
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
          result += `</span>`
          result += `<span class="ann-note ann-depth-${depth}" data-id="${ann.id}" data-content="${ann.content.replace(/"/g, '&quot;')}" data-expanded="true"></span>`
        }
      }
    }

    return result
  }

  // 用于跟踪触摸事件，防止移动端click事件重复触发
  let lastTouchTime = 0

  function handleContentClick(e: MouseEvent | TouchEvent, toggleAnnotation: Function) {
    let target: HTMLElement | null = null
    
    // 检查是否是由触摸事件触发的click事件
    if (e instanceof MouseEvent) {
      const now = Date.now()
      const timeSinceLastTouch = now - lastTouchTime
      
      // 如果是在300ms内触发的click事件，认为是触摸事件的后续，不处理
      if (timeSinceLastTouch < 300) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      
      target = e.target as HTMLElement
    } else if (e instanceof TouchEvent) {
      // 记录触摸事件时间
      lastTouchTime = Date.now()
      
      // 优先使用changedTouches，因为在touchend事件中touches是空的
      if (e.changedTouches.length > 0) {
        target = e.changedTouches[0].target as HTMLElement
      } else if (e.touches.length > 0) {
        target = e.touches[0].target as HTMLElement
      }
    }
    
    if (!target) return

    // 测试点击的元素
    console.log('点击的元素:', target)
    console.log('元素类名:', target.className)
    console.log('元素数据:', target.dataset)

    // 检查是否点击了注释元素
    let annotationElement: HTMLElement | null = target
    while (annotationElement && !annotationElement.classList.contains('ann-note') && !annotationElement.classList.contains('ann-highlight')) {
      annotationElement = annotationElement.parentElement
    }
    
    if (annotationElement) {
      console.log('找到注释元素:', annotationElement)
      // 阻止事件冒泡，防止触发其他点击事件
      if (e instanceof MouseEvent) {
        e.stopPropagation()
      } else if (e instanceof TouchEvent) {
        e.preventDefault()
      }
      const id = annotationElement.dataset.id
      if (id) {
        console.log('切换注释:', id)
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

  // 侧边栏宽度调节功能
  function startResize(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    isResizing.value = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function resize(e: MouseEvent) {
    if (!isResizing.value) return
    
    // 计算新的侧边栏宽度，无限制
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= 100) {
      sidebarWidth.value = newWidth
    }
  }

  function stopResize() {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  function startSplitResize(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    isSplitResizing.value = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function splitResize(e: MouseEvent) {
    if (!isSplitResizing.value) return
    
    const panel = document.querySelector('.split-panel') as HTMLElement
    if (!panel) return
    
    const rect = panel.getBoundingClientRect()
    const newRatio = ((e.clientX - rect.left) / rect.width) * 100
    
    splitRatio.value = Math.max(0, Math.min(100, newRatio))
  }

  function stopSplitResize() {
    isSplitResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  return {
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
    handlePrint,
    startResize,
    resize,
    stopResize,
    startSplitResize,
    splitResize,
    stopSplitResize
  }
}
