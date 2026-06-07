<script setup lang="ts">
import { computed } from 'vue'
import { useArticles } from '@/composables/useArticles'

const props = defineProps<{
  text: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openArticle', articleId: string): void
}>()

const { activeArticles } = useArticles()

interface SnippetSegment {
  text: string
  opacity: number
  isBold: boolean
  isHighlight: boolean
}

interface SnippetWithSegments {
  segments: SnippetSegment[]
}

interface MeaningEntry {
  content: string
  occurrences: Array<{
    articleTitle: string
    articleId: string
    snippetWithSegments: SnippetWithSegments
    annotationIndex: number
  }>
}

const SENTENCE_END = /[。！？.!?；;]/
const MAX_CONTEXT_CHARS = 15

function findSentenceBoundaries(fullContent: string, targetStart: number, targetEnd: number): {
  sentenceStart: number
  sentenceEnd: number
} {
  let sentenceStart = 0
  let sentenceEnd = fullContent.length
  
  for (let i = targetStart - 1; i >= 0; i--) {
    if (SENTENCE_END.test(fullContent[i])) {
      sentenceStart = i + 1
      break
    }
  }
  
  for (let i = targetEnd; i < fullContent.length; i++) {
    if (SENTENCE_END.test(fullContent[i])) {
      sentenceEnd = i + 1
      break
    }
  }
  
  return { sentenceStart, sentenceEnd }
}

function calculateOpacity(distance: number, maxDistance: number): number {
  const progress = Math.min(1, distance / maxDistance)
  const opacity = 1 - progress * 0.9
  return Math.max(0.1, Math.round(opacity * 100) / 100)
}

function createSnippetWithSegments(
  fullContent: string, 
  targetStart: number, 
  targetEnd: number
): SnippetWithSegments {
  const { sentenceStart, sentenceEnd } = findSentenceBoundaries(fullContent, targetStart, targetEnd)
  
  const snippetStart = Math.max(0, targetStart - MAX_CONTEXT_CHARS)
  const snippetEnd = Math.min(fullContent.length, targetEnd + MAX_CONTEXT_CHARS)
  
  const segments: SnippetSegment[] = []
  
  for (let i = snippetStart; i < snippetEnd; i++) {
    const char = fullContent[i]
    let opacity: number
    let isBold = false
    let isHighlight = false
    
    if (i >= targetStart && i < targetEnd) {
      opacity = 1
      isBold = true
      isHighlight = true
    } else if (i >= sentenceStart && i < sentenceEnd) {
      opacity = 1
    } else {
      if (i < sentenceStart) {
        const distanceFromTarget = targetStart - i
        opacity = calculateOpacity(distanceFromTarget, MAX_CONTEXT_CHARS)
      } else {
        const distanceFromTarget = i - (targetEnd - 1)
        opacity = calculateOpacity(distanceFromTarget, MAX_CONTEXT_CHARS)
      }
    }
    
    if (segments.length > 0 && 
        Math.abs(segments[segments.length - 1].opacity - opacity) < 0.05 &&
        segments[segments.length - 1].isBold === isBold &&
        segments[segments.length - 1].isHighlight === isHighlight) {
      segments[segments.length - 1].text += char
    } else {
      segments.push({
        text: char,
        opacity,
        isBold,
        isHighlight
      })
    }
  }
  
  return { segments }
}

const groupedMeanings = computed(() => {
  const groups: Map<string, MeaningEntry> = new Map()
  
  for (const article of activeArticles.value) {
    for (const ann of article.annotations) {
      if (ann.text === props.text) {
        if (!groups.has(ann.content)) {
          groups.set(ann.content, {
            content: ann.content,
            occurrences: []
          })
        }
        
        const snippetWithSegments = createSnippetWithSegments(
          article.content, 
          ann.startIndex, 
          ann.endIndex
        )
        
        groups.get(ann.content)!.occurrences.push({
          articleTitle: article.title,
          articleId: article.id,
          snippetWithSegments,
          annotationIndex: ann.startIndex
        })
      }
    }
  }
  
  return Array.from(groups.values()).sort((a, b) => 
    b.occurrences.length - a.occurrences.length
  )
})

const totalOccurrences = computed(() => 
  groupedMeanings.value.reduce((sum, m) => sum + m.occurrences.length, 0)
)

const uniqueArticles = computed(() => {
  const ids = new Set<string>()
  groupedMeanings.value.forEach(m => 
    m.occurrences.forEach(o => ids.add(o.articleId))
  )
  return ids.size
})

function openArticle(articleId: string) {
  emit('openArticle', articleId)
  emit('close')
}
</script>

<template>
  <div class="dict-detail">
    <div class="dict-detail-header">
      <button class="back-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="header-info">
        <h2 class="detail-title">"{{ text }}"</h2>
        <div class="detail-meta">
          <span class="meta-item">{{ totalOccurrences }} 次出现</span>
          <span class="meta-item">{{ uniqueArticles }} 篇文章</span>
          <span class="meta-item">{{ groupedMeanings.length }} 种释义</span>
        </div>
      </div>
    </div>
    
    <div class="dict-detail-body scrollbar-visible">
      <div v-if="groupedMeanings.length === 0" class="empty">
        <p>暂无释义</p>
      </div>
      
      <div v-else class="meaning-groups">
        <div 
          v-for="(group, groupIdx) in groupedMeanings" 
          :key="groupIdx"
          class="meaning-group"
        >
          <div class="meaning-header">
            <span class="meaning-content">{{ group.content }}</span>
            <span class="meaning-count">{{ group.occurrences.length }} 次</span>
          </div>
          
          <div class="meaning-occurrences">
            <div 
              v-for="(occurrence, occIdx) in group.occurrences" 
              :key="occIdx"
              class="occurrence-item"
              @click="openArticle(occurrence.articleId)"
            >
              <div class="occurrence-source">
                《{{ occurrence.articleTitle }}》
              </div>
              <div class="occurrence-snippet">
                <template v-for="(segment, segIdx) in occurrence.snippetWithSegments.segments" :key="segIdx">
                  <span 
                    :style="{ opacity: segment.opacity }"
                    :class="{ 
                      'snippet-bold': segment.isBold,
                      'snippet-highlight': segment.isHighlight
                    }"
                  >{{ segment.text }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dict-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.dict-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  background: #f5f5f7;
  flex-shrink: 0;
}

:global(.dark-mode) .dict-detail-header {
  background: #1c1c1e;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #86868b;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.back-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

:global(.dark-mode) .back-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.detail-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
}

:global(.dark-mode) .detail-title {
  color: #f5f5f7;
}

.detail-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.meta-item {
  font-size: 12px;
  color: #86868b;
}

.dict-detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f5f5f7;
  min-height: 0;
}

:global(.dark-mode) .dict-detail-body {
  background: #1c1c1e;
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #86868b;
}

.meaning-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meaning-group {
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .meaning-group {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.08);
}

.meaning-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #ffffff;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

:global(.dark-mode) .meaning-header {
  background: #2c2c2e;
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.meaning-content {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
  line-height: 1.5;
}

:global(.dark-mode) .meaning-content {
  color: #f5f5f7;
}

.meaning-count {
  font-size: 12px;
  color: var(--primary-color);
  font-weight: 500;
  flex-shrink: 0;
  background: rgba(var(--primary-color-rgb), 0.08);
  padding: 2px 8px;
  border-radius: 4px;
}

.meaning-occurrences {
  display: flex;
  flex-direction: column;
}

.occurrence-item {
  padding: 10px 16px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: background 0.15s ease;
}

:global(.dark-mode) .occurrence-item {
  border-bottom-color: rgba(255, 255, 255, 0.04);
}

.occurrence-item:last-child {
  border-bottom: none;
}

.occurrence-item:hover {
  background: #f5f5f7;
}

:global(.dark-mode) .occurrence-item:hover {
  background: #3a3a3c;
}

.occurrence-source {
  font-size: 12px;
  color: #86868b;
  margin-bottom: 4px;
}

.occurrence-snippet {
  font-size: 13px;
  color: #1d1d1f;
  line-height: 1.6;
  font-family: var(--font-serif);
  letter-spacing: 0.02em;
}

:global(.dark-mode) .occurrence-snippet {
  color: #f5f5f7;
}

.occurrence-snippet span {
  display: inline;
  transition: opacity 0.2s ease;
}

.snippet-bold {
  font-weight: 700;
}

.snippet-highlight {
  font-weight: 700 !important;
  color: #ff3b30 !important;
  opacity: 1 !important;
}
</style>
