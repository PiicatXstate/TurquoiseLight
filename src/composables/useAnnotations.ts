import { ref } from 'vue'
import type { Annotation, Article } from '@/types'
import { useGlobalSettings } from './useGlobalSettings'

export function useAnnotations() {
  const { settings } = useGlobalSettings()
  
  const showAIAnnotationDialog = ref(false)
  const aiAnnotationLoading = ref(false)
  const aiAnnotationError = ref('')
  const aiAnnotationResult = ref('')
  const aiAnnotationSelectedText = ref('')

  const annotationContent = ref('')
  const editingAnnotationId = ref<string | null>(null)
  const editingAnnotationContent = ref('')
  const annotationError = ref('')

  const expandedAnnotations = ref<Set<string>>(new Set())
  const annotationLockMode = ref<'normal' | 'locked' | 'all-expanded' | 'all-collapsed'>('normal')

  async function handleAISelectionAnnotation(selectedText: string, article: Article | undefined, selectedStartIndex: number, selectedEndIndex: number) {
    if (!selectedText || !article) return
    
    if (!settings.value.apiKey) {
      aiAnnotationError.value = '请先设置API Key'
      return
    }
    
    aiAnnotationSelectedText.value = selectedText
    aiAnnotationLoading.value = true
    aiAnnotationError.value = ''
    aiAnnotationResult.value = ''
    
    try {
      const content = article.content
      const startContext = content.substring(Math.max(0, selectedStartIndex - 20), selectedStartIndex)
      const endContext = content.substring(selectedEndIndex, Math.min(content.length, selectedEndIndex + 20))
      
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
              content: `你是一个专业的文言文注释专家，擅长为文言文添加准确、简洁的注释。请分析以下选中的文本内容，结合上下文信息，生成准确、简洁的注释。注释内容要非常简短，适合直接作为注释。对于字的解释，控制在四五个字以内。对于词的解释，简单说明即可，不要长篇大论。只解释词在当前文段中的意思，不需要引申义。直接返回注释内容，不要包含其他无关信息。`
            },
            {
              role: 'user',
              content: `文章标题：${article.title}\n\n上下文内容：...${startContext}[${selectedText}]${endContext}...\n\n请为选中的文本生成注释：${selectedText}`
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
              if (settings.value.isThinkingModel) {
                if (!streamHasThink) {
                  if (delta.content.includes('```')) {
                    const parts = delta.content.split('```')
                    streamThink += parts[0]
                    streamContent += parts[1] || ''
                    streamHasThink = true
                  } else {
                    streamThink += delta.content
                  }
                } else {
                  streamContent += delta.content
                }
              } else {
                streamContent += delta.content
              }
            }
          } catch (e) {
            console.error('Error parsing stream:', e)
          }
        }
      }
      
      let finalContent = streamContent.trim()
      
      if (!finalContent) {
        finalContent = '无法生成注释，请稍后重试。'
      }
      
      aiAnnotationResult.value = finalContent
      showAIAnnotationDialog.value = true
      
    } catch (err) {
      aiAnnotationError.value = 'AI注释生成失败，请稍后重试'
      console.error('AI annotation error:', err)
    } finally {
      aiAnnotationLoading.value = false
    }
  }

  function confirmAddAIAnnotation(article: Article | undefined, selectedText: string, selectedStartIndex: number, selectedEndIndex: number, addAnnotation: Function) {
    if (article && selectedText && aiAnnotationResult.value) {
      const success = addAnnotation(
        article.id,
        selectedStartIndex,
        selectedEndIndex,
        selectedText,
        aiAnnotationResult.value
      )
      if (success) {
        showAIAnnotationDialog.value = false
        aiAnnotationResult.value = ''
        aiAnnotationSelectedText.value = ''
      }
    }
  }

  function cancelAIAnnotation() {
    showAIAnnotationDialog.value = false
    aiAnnotationResult.value = ''
    aiAnnotationSelectedText.value = ''
  }

  function toggleAnnotation(annotationId: string) {
    if (annotationLockMode.value !== 'normal') return
    if (expandedAnnotations.value.has(annotationId)) {
      expandedAnnotations.value.delete(annotationId)
    } else {
      expandedAnnotations.value.add(annotationId)
    }
  }

  function setAnnotationMode(mode: 'normal' | 'locked' | 'all-expanded' | 'all-collapsed', article: Article | undefined) {
    annotationLockMode.value = mode
    if (mode === 'all-expanded' && article) {
      article.annotations.forEach(ann => {
        expandedAnnotations.value.add(ann.id)
      })
    } else if (mode === 'all-collapsed') {
      expandedAnnotations.value.clear()
    }
  }

  function startEditAnnotation(ann: Annotation) {
    editingAnnotationId.value = ann.id
    editingAnnotationContent.value = ann.content
  }

  function saveEditAnnotation(article: Article | undefined, updateAnnotation: Function) {
    if (article && editingAnnotationId.value && editingAnnotationContent.value.trim()) {
      updateAnnotation(article.id, editingAnnotationId.value, editingAnnotationContent.value.trim())
      editingAnnotationId.value = null
      editingAnnotationContent.value = ''
    }
  }

  function cancelEditAnnotation() {
    editingAnnotationId.value = null
    editingAnnotationContent.value = ''
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

  return {
    showAIAnnotationDialog,
    aiAnnotationLoading,
    aiAnnotationError,
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
  }
}
