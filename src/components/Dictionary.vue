<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useArticles } from '@/composables/useArticles'
import DictionaryDetail from './DictionaryDetail.vue'

const props = defineProps<{
  initialQuery?: string
  currentArticleId?: string
  embedded?: boolean
  sidebarWidth?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openArticle', articleId: string): void
  (e: 'startResize', event: MouseEvent): void
}>()

const { activeArticles } = useArticles()

const query = ref(props.initialQuery || '')
const selectedArticleId = ref<string | null>(props.currentArticleId || null)
const sortBy = ref<'frequency' | 'pinyin' | 'textLength'>('frequency')
const filterType = ref<'all' | 'singleChar' | 'multiChar'>('all')
const expandedEntries = ref<Set<string>>(new Set())
const selectedDetailText = ref<string | null>(null)

const articleList = computed(() => [
  { id: null, title: '全部文章', annotationCount: activeArticles.value.reduce((sum, a) => sum + a.annotations.length, 0) },
  ...activeArticles.value
    .filter(a => a.annotations.length > 0)
    .map(a => ({ ...a, annotationCount: a.annotations.length }))
    .sort((a, b) => b.annotationCount - a.annotationCount)
])

function getRawAnnotations(articleId: string | null) {
  const results: { text: string; content: string; articleTitle: string; articleId: string; startIndex: number; endIndex: number; articleContent: string }[] = []
  
  for (const article of activeArticles.value) {
    if (articleId && article.id !== articleId) continue
    for (const ann of article.annotations) {
      results.push({
        text: ann.text,
        content: ann.content,
        articleTitle: article.title,
        articleId: article.id,
        startIndex: ann.startIndex,
        endIndex: ann.endIndex,
        articleContent: article.content
      })
    }
  }
  
  return results
}

function getFilteredAnnotations(articleId: string | null, type: 'all' | 'singleChar' | 'multiChar') {
  const raw = getRawAnnotations(articleId)
  if (type === 'all') return raw
  return raw.filter(r => {
    if (type === 'singleChar') return r.text.length === 1
    if (type === 'multiChar') return r.text.length > 1
    return true
  })
}

function extractSnippet(content: string, startIndex: number, endIndex: number): string {
  const snippetLength = 20
  const snippetStart = Math.max(0, startIndex - snippetLength)
  const snippetEnd = Math.min(content.length, endIndex + snippetLength)
  
  let snippet = content.substring(snippetStart, snippetEnd)
  
  if (snippetStart > 0) {
    snippet = '...' + snippet
  }
  if (snippetEnd < content.length) {
    snippet = snippet + '...'
  }
  
  return snippet
}

const groupedAnnotations = computed(() => {
  const filtered = getFilteredAnnotations(selectedArticleId.value, filterType.value)
  const grouped: Map<string, { 
    text: string
    meanings: { 
      content: string
      occurrences: Array<{
        articleTitle: string
        articleId: string
        snippet: string
      }>
    }[]
    frequency: number
    uniqueArticles: number
  }> = new Map()
  
  const articleSet = new Map<string, Set<string>>()
  
  for (const ann of filtered) {
    if (!grouped.has(ann.text)) {
      grouped.set(ann.text, { 
        text: ann.text, 
        meanings: [],
        frequency: 0,
        uniqueArticles: 0
      })
      articleSet.set(ann.text, new Set())
    }
    
    const entry = grouped.get(ann.text)!
    entry.frequency++
    articleSet.get(ann.text)!.add(ann.articleId)
    
    const snippet = extractSnippet(ann.articleContent, ann.startIndex, ann.endIndex)
    const meaningGroup = entry.meanings.find(m => m.content === ann.content)
    
    if (meaningGroup) {
      const isDupOccurrence = meaningGroup.occurrences.some(
        o => o.articleId === ann.articleId && o.snippet === snippet
      )
      if (!isDupOccurrence) {
        meaningGroup.occurrences.push({
          articleTitle: ann.articleTitle,
          articleId: ann.articleId,
          snippet
        })
      }
    } else {
      entry.meanings.push({
        content: ann.content,
        occurrences: [{
          articleTitle: ann.articleTitle,
          articleId: ann.articleId,
          snippet
        }]
      })
    }
  }
  
  for (const [text, entry] of grouped) {
    entry.uniqueArticles = articleSet.get(text)!.size
  }
  
  return grouped
})

interface MeaningOccurrence {
  articleTitle: string
  articleId: string
  snippet: string
}

interface Meaning {
  content: string
  occurrences: MeaningOccurrence[]
}

interface DictionaryEntry {
  text: string
  meanings: Meaning[]
  frequency: number
  uniqueArticles: number
}

const searchResults = computed(() => {
  if (!query.value.trim()) return []
  
  const q = query.value.trim().toLowerCase()
  const results: DictionaryEntry[] = []
  
  for (const [, entry] of groupedAnnotations.value) {
    if (entry.text.toLowerCase().includes(q) || entry.meanings.some(m => m.content.toLowerCase().includes(q))) {
      results.push(entry)
    }
  }
  
  return sortEntries(results)
})

const allEntries = computed(() => {
  const entries = Array.from(groupedAnnotations.value.values())
  return sortEntries(entries)
})

function sortEntries(entries: DictionaryEntry[]) {
  return [...entries].sort((a, b) => {
    if (sortBy.value === 'frequency') {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency
      if (b.uniqueArticles !== a.uniqueArticles) return b.uniqueArticles - a.uniqueArticles
    } else if (sortBy.value === 'textLength') {
      if (a.text.length !== b.text.length) return a.text.length - b.text.length
    }
    return a.text.localeCompare(b.text, 'zh-CN')
  })
}

const stats = computed(() => {
  const filtered = getFilteredAnnotations(selectedArticleId.value, filterType.value)
  const uniqueTexts = new Set(filtered.map(f => f.text))
  const singleCharCount = filtered.filter(f => f.text.length === 1).length
  const multiCharCount = filtered.filter(f => f.text.length > 1).length
  
  let maxFreq = 0
  let maxFreqText = ''
  const freqMap = new Map<string, number>()
  for (const ann of filtered) {
    freqMap.set(ann.text, (freqMap.get(ann.text) || 0) + 1)
    const freq = freqMap.get(ann.text)!
    if (freq > maxFreq) {
      maxFreq = freq
      maxFreqText = ann.text
    }
  }
  
  const articlesInFilter = new Set(filtered.map(f => f.articleId)).size
  
  return {
    totalAnnotations: filtered.length,
    uniqueTexts: uniqueTexts.size,
    articlesInFilter,
    singleCharCount,
    multiCharCount,
    mostFrequent: maxFreqText,
    mostFrequentCount: maxFreq
  }
})

function toggleExpand(text: string) {
  if (expandedEntries.value.has(text)) {
    expandedEntries.value.delete(text)
  } else {
    expandedEntries.value.add(text)
  }
}

function openDetail(text: string) {
  selectedDetailText.value = text
}

function closeDetail() {
  selectedDetailText.value = null
}

function openArticle(articleId: string) {
  emit('openArticle', articleId)
  emit('close')
}

function displayMeanings(meanings: any[], isExpanded: boolean) {
  if (isExpanded || meanings.length <= 2) {
    return meanings
  }
  return meanings.slice(0, 2)
}

function shouldShowExpandHint(meanings: any[], isExpanded: boolean) {
  return meanings.length > 2 && !isExpanded
}

watch(() => props.initialQuery, (newQuery) => {
  if (newQuery) {
    query.value = newQuery
  }
})

watch(() => props.currentArticleId, (newId) => {
  if (newId) {
    selectedArticleId.value = newId
  }
})
</script>

<template>
  <div :class="['dictionary', { embedded, 'detail-mode': selectedDetailText }]">
    <template v-if="!selectedDetailText">
      <div class="dict-header">
        <h2 v-if="!embedded">注释词典</h2>
        <h2 v-else>词典</h2>
        <button class="close-btn" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="filters">
        <div class="filter-row" v-if="!embedded">
          <div class="filter-group">
            <label class="filter-label">文章</label>
            <select v-model="selectedArticleId" class="filter-select">
              <option v-for="article in articleList" :key="article.id || 'all'" :value="article.id">
                {{ article.title }} ({{ article.annotationCount || (article as any).annotations?.length || 0 }})
              </option>
            </select>
          </div>
          
          <div class="filter-group">
            <label class="filter-label">类型</label>
            <select v-model="filterType" class="filter-select">
              <option value="all">全部</option>
              <option value="singleChar">单字</option>
              <option value="multiChar">多字</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label class="filter-label">排序</label>
            <select v-model="sortBy" class="filter-select">
              <option value="frequency">按出现频率</option>
              <option value="textLength">按字数</option>
              <option value="pinyin">按拼音</option>
            </select>
          </div>
        </div>
        
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            v-model="query" 
            type="text" 
            placeholder="搜索字或词..." 
            @keyup.escape="emit('close')"
          />
        </div>
      </div>

      <div class="stats-grid" v-if="!embedded">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalAnnotations }}</div>
          <div class="stat-label">总注释</div>
        </div>
        <div class="stat-card primary">
          <div class="stat-value">{{ stats.uniqueTexts }}</div>
          <div class="stat-label">不同词条</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.singleCharCount }}</div>
          <div class="stat-label">单字注释</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.multiCharCount }}</div>
          <div class="stat-label">多字注释</div>
        </div>
      </div>

      <div class="stats-extra" v-if="!embedded && stats.mostFrequent">
        <span class="stat-highlight">
          高频词：<strong>"{{ stats.mostFrequent }}"</strong> 出现 {{ stats.mostFrequentCount }} 次
        </span>
        <span class="stat-highlight" v-if="stats.articlesInFilter > 1">
          覆盖 {{ stats.articlesInFilter }} 篇文章
        </span>
      </div>

      <div v-if="embedded" class="stats-inline">
        <span>{{ articleList[0].annotationCount || 0 }} 条注释</span>
        <span>{{ stats.uniqueTexts }} 个词条</span>
      </div>

      <div class="results scrollbar-visible">
        <div v-if="query.trim()" class="result-list">
          <div v-if="searchResults.length === 0" class="empty">
            未找到"{{ query }}"相关注释
          </div>
          <div 
            v-else 
            class="result-item" 
            v-for="result in searchResults" 
            :key="result.text"
          >
            <div class="result-header" @click="openDetail(result.text)">
              <div class="result-text">"{{ result.text }}"</div>
              <div class="result-meta">
                <span class="meta-tag freq" v-if="result.frequency > 1">{{ result.frequency }}次</span>
                <span class="meta-tag articles" v-if="result.uniqueArticles > 1">{{ result.uniqueArticles }}文</span>
                <span class="meta-tag meanings" v-if="result.meanings.length > 2">{{ result.meanings.length }}释义</span>
                <button class="detail-btn" @click.stop="openDetail(result.text)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div class="result-meanings" v-if="!shouldShowExpandHint(result.meanings, expandedEntries.has(result.text))">
              <div 
                class="meaning" 
                v-for="(meaning, idx) in displayMeanings(result.meanings, expandedEntries.has(result.text))" 
                :key="idx"
              >
                <span class="meaning-content">{{ meaning.content }}</span>
                <span 
                  v-if="meaning.occurrences.length <= 2" 
                  class="meaning-source"
                  v-for="(occ, occIdx) in meaning.occurrences.slice(0, 2)"
                  :key="occIdx"
                >
                  ——《{{ occ.articleTitle }}》
                </span>
                <span 
                  v-else 
                  class="meaning-source"
                >
                  ——{{ meaning.occurrences.length }}处
                </span>
              </div>
            </div>
            <div class="result-meanings collapsed" v-else>
              <div 
                class="meaning" 
                v-for="(meaning, idx) in displayMeanings(result.meanings, expandedEntries.has(result.text))" 
                :key="idx"
              >
                <span class="meaning-content">{{ meaning.content }}</span>
                <span 
                  class="meaning-source"
                >
                  ——{{ meaning.occurrences.length }}处
                </span>
              </div>
              <div class="expand-hint" @click="toggleExpand(result.text)">
                还有 {{ result.meanings.length - 2 }} 种释义，点击展开
              </div>
            </div>
          </div>
        </div>

        <div v-else class="all-entries">
          <div class="section-title">
            全部词条
            <span class="section-count">{{ allEntries.length }} 个</span>
          </div>
          <div v-if="allEntries.length === 0" class="empty">
            暂无注释
          </div>
          <div v-else class="entry-list">
            <div 
              class="entry-item" 
              v-for="entry in allEntries" 
              :key="entry.text"
            >
              <div class="entry-header" @click="openDetail(entry.text)">
                <div class="entry-text">"{{ entry.text }}"</div>
                <div class="entry-meta">
                  <span class="meta-tag freq" v-if="entry.frequency > 1">{{ entry.frequency }}次</span>
                  <span class="meta-tag articles" v-if="entry.uniqueArticles > 1">{{ entry.uniqueArticles }}文</span>
                  <span class="meta-tag meanings" v-if="entry.meanings.length > 2">{{ entry.meanings.length }}释义</span>
                  <button class="detail-btn" @click.stop="openDetail(entry.text)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="entry-meanings" v-if="!shouldShowExpandHint(entry.meanings, expandedEntries.has(entry.text))">
                <div 
                  class="meaning" 
                  v-for="(meaning, idx) in displayMeanings(entry.meanings, expandedEntries.has(entry.text))" 
                  :key="idx"
                >
                  <span class="meaning-content">{{ meaning.content }}</span>
                  <span 
                    v-if="meaning.occurrences.length <= 2" 
                    class="meaning-source"
                    v-for="(occ, occIdx) in meaning.occurrences.slice(0, 2)"
                    :key="occIdx"
                  >
                    ——《{{ occ.articleTitle }}》
                  </span>
                  <span 
                    v-else 
                    class="meaning-source"
                  >
                    ——{{ meaning.occurrences.length }}处
                  </span>
                </div>
              </div>
              <div class="entry-meanings collapsed" v-else>
                <div 
                  class="meaning" 
                  v-for="(meaning, idx) in displayMeanings(entry.meanings, expandedEntries.has(entry.text))" 
                  :key="idx"
                >
                  <span class="meaning-content">{{ meaning.content }}</span>
                  <span 
                    class="meaning-source"
                  >
                    ——{{ meaning.occurrences.length }}处
                  </span>
                </div>
                <div class="expand-hint" @click="toggleExpand(entry.text)">
                  还有 {{ entry.meanings.length - 2 }} 种释义，点击展开
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <DictionaryDetail 
      v-else
      :text="selectedDetailText!"
      @close="closeDetail"
      @open-article="openArticle"
    />
  </div>
</template>

<style scoped>
.dictionary {
  position: fixed;
  inset: 0;
  background: var(--bg-primary);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.dictionary.embedded {
  position: static;
  inset: auto;
  z-index: auto;
  background: #f5f5f7;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:global(.dark-mode) .dictionary.embedded {
  background: #1c1c1e;
}

.dict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.dictionary.embedded .dict-header {
  padding: 12px 16px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .dictionary.embedded .dict-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.dict-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.dictionary.embedded .dict-header h2 {
  font-size: 14px;
  font-weight: 500;
  color: #1d1d1f;
}

:global(.dark-mode) .dictionary.embedded .dict-header h2 {
  color: #f5f5f7;
}

.close-btn {
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

.dictionary.embedded .close-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #86868b;
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.dictionary.embedded .close-btn svg {
  width: 16px;
  height: 16px;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dictionary.embedded .close-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

:global(.dark-mode) .dictionary.embedded .close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}

.filters {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 0.75rem 1rem;
}

.dictionary.embedded .filters {
  background: #f5f5f7;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  padding: 0 16px 12px;
}

:global(.dark-mode) .dictionary.embedded .filters {
  background: #1c1c1e;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.filter-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.filter-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  outline: none;
  transition: all 0.15s;
}

.filter-select:focus {
  border-color: var(--primary-color);
}

.search-box {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.dictionary.embedded .search-box {
  padding: 8px 12px;
  background: #ffffff;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
}

:global(.dark-mode) .dictionary.embedded .search-box {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.12);
}

.search-box:focus-within {
  border-color: var(--primary-color);
}

.search-icon {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  margin-right: 0.5rem;
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  outline: none;
  color: var(--text-primary);
}

.search-box input::placeholder {
  color: var(--text-tertiary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.stat-card {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  border: 1px solid var(--border-color);
}

.stat-card.primary {
  background: var(--primary-50);
  border-color: var(--primary-color);
}

.stat-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-card.primary .stat-value {
  color: var(--primary-color);
}

.stat-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  margin-top: 0.125rem;
}

.stats-extra {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  font-size: 0.75rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.stat-highlight strong {
  color: var(--primary-color);
  font-weight: 600;
}

.stats-inline {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  font-size: 12px;
  color: #86868b;
}

:global(.dark-mode) .stats-inline {
  background: rgba(0, 0, 0, 0.04);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.results {
  flex: 1;
  overflow-y: auto;
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.section-title {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dictionary.embedded .section-title {
  padding: 10px 16px;
  font-size: 12px;
  background: #f5f5f7;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .dictionary.embedded .section-title {
  background: #1c1c1e;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.section-count {
  font-weight: 400;
  color: var(--text-tertiary);
}

.result-list,
.entry-list {
  padding: 0.25rem 0;
}

.result-item,
.entry-item {
  padding: 12px 16px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: background 0.15s;
}

:global(.dark-mode) .result-item,
:global(.dark-mode) .entry-item {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.result-item:hover,
.entry-item:hover {
  background: rgba(0, 0, 0, 0.02);
}

:global(.dark-mode) .result-item:hover,
:global(.dark-mode) .entry-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.result-item:last-child,
.entry-item:last-child {
  border-bottom: none;
}

.result-header,
.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.result-text,
.entry-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
}

.result-meta,
.entry-meta {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
}

.meta-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.meta-tag.freq {
  background: rgba(var(--primary-color-rgb), 0.08);
  color: var(--primary-color);
}

.meta-tag.articles {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(22, 163, 74);
}

.meta-tag.meanings {
  background: #e9e9eb;
  color: #86868b;
}

:global(.dark-mode) .meta-tag.meanings {
  background: #3a3a3c;
  color: #a3a3a8;
}

.meta-tag.length {
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
}

.detail-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #86868b;
  transition: all 0.15s;
}

.detail-btn svg {
  width: 14px;
  height: 14px;
}

.detail-btn:hover {
  background: rgba(var(--primary-color-rgb), 0.08);
  color: var(--primary-color);
}

.result-meanings,
.entry-meanings {
  margin-top: 8px;
}

.meaning {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 2px 0;
}

.meaning-content {
  color: var(--text-primary);
}

.meaning-source {
  color: var(--text-tertiary);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
  white-space: nowrap;
}

.meaning-source:hover {
  color: var(--primary-color);
  text-decoration: underline;
}

.expand-hint {
  font-size: 12px;
  color: var(--primary-color);
  padding-top: 4px;
  font-weight: 500;
  cursor: pointer;
}

.expand-hint:hover {
  text-decoration: underline;
}

@media (min-width: 640px) {
  .dictionary:not(.embedded) {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 95%;
    max-width: 600px;
    height: 85vh;
    max-height: 700px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }
}

@media (min-width: 768px) {
  .dictionary:not(.embedded) {
    max-width: 700px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
