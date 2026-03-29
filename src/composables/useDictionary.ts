import { ref, computed } from 'vue'
import type { Article } from '@/types'

export function useDictionary(articles: any) {
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

  return {
    dictionaryQuery,
    dictionarySearchResults,
    dictionaryAllAnnotations,
    dictionaryStats
  }
}
