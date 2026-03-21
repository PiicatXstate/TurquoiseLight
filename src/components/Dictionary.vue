<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useArticles } from '@/composables/useArticles'

const props = defineProps<{
  initialQuery?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { articles } = useArticles()

const query = ref(props.initialQuery || '')
const searchResults = computed(() => {
  if (!query.value.trim()) return []
  
  const q = query.value.trim().toLowerCase()
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

const allAnnotations = computed(() => {
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

const stats = computed(() => {
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

watch(() => props.initialQuery, (newQuery) => {
  if (newQuery) {
    query.value = newQuery
  }
})
</script>

<template>
  <div class="dictionary">
    <div class="dict-header">
      <h2>词典</h2>
      <button class="close-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
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

    <div class="stats">
      <span>{{ stats.articleCount }} 篇文章</span>
      <span>{{ stats.uniqueTexts }} 个词条</span>
      <span>{{ stats.totalAnnotations }} 条注释</span>
    </div>

    <div class="results">
      <div v-if="query.trim()" class="result-list">
        <div v-if="searchResults.length === 0" class="empty">
          未找到"{{ query }}"相关注释
        </div>
        <div v-else class="result-item" v-for="result in searchResults" :key="result.text">
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
        <div v-if="allAnnotations.length === 0" class="empty">
          暂无注释
        </div>
        <div v-else class="entry-list">
          <div class="entry-item" v-for="entry in allAnnotations" :key="entry.text">
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
</template>

<style scoped>
.dictionary {
  position: fixed;
  inset: 0;
  background: white;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.dict-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #eee;
}

.dict-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: #1a1a1a;
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
  color: #666;
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.close-btn:hover {
  background: #f0f0f0;
}

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

.results {
  flex: 1;
  overflow-y: auto;
}

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #999;
  font-size: 0.875rem;
}

.section-title {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  color: #999;
  background: #fafafa;
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

@media (min-width: 640px) {
  .dictionary {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 480px;
    height: 80vh;
    max-height: 600px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }
}
</style>
