<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { SharedArticle, Annotation } from '@/types'
import { api } from '@/utils/api'
import { useAuth } from '@/composables/useAuth'
import { useArticles } from '@/composables/useArticles'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openArticle', article: SharedArticle): void
}>()

const { isLoggedIn } = useAuth()
const { articles } = useArticles()

const sharedArticles = ref<SharedArticle[]>([])
const loading = ref(true)
const page = ref(1)
const totalPages = ref(1)
const showPublishModal = ref(false)
const publishStep = ref(1)
const selectedLocalArticle = ref<string | null>(null)
const publishTitle = ref('')
const publishContent = ref('')
const publishAnnotations = ref<Annotation[]>([])
const publishing = ref(false)
const likedArticles = ref<Set<string>>(new Set())

const localArticles = computed(() => 
  articles.value.filter(a => !a.isDeleted)
)

onMounted(() => {
  loadArticles()
})

async function loadArticles() {
  loading.value = true
  try {
    const response = await api.getArticles(page.value, 10)
    sharedArticles.value = response.articles
    totalPages.value = response.pagination.totalPages
    
    if (isLoggedIn.value) {
      for (const article of response.articles) {
        try {
          const likeStatus = await api.checkLiked(article.id)
          if (likeStatus.liked) {
            likedArticles.value.add(article.id)
          }
        } catch {
        }
      }
    }
  } catch (error) {
    console.error('Failed to load articles:', error)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (page.value >= totalPages.value) return
  page.value++
  loading.value = true
  try {
    const response = await api.getArticles(page.value, 10)
    sharedArticles.value.push(...response.articles)
  } catch (error) {
    console.error('Failed to load more articles:', error)
    page.value--
  } finally {
    loading.value = false
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

async function handleLike(article: SharedArticle) {
  if (!isLoggedIn.value) return
  
  try {
    const result = await api.likeArticle(article.id)
    article.likes = result.likes
    if (result.liked) {
      likedArticles.value.add(article.id)
    } else {
      likedArticles.value.delete(article.id)
    }
  } catch (error) {
    console.error('Failed to like article:', error)
  }
}

async function handleDownload(article: SharedArticle) {
  try {
    await api.downloadArticle(article.id)
  } catch (error) {
    console.error('Failed to download article:', error)
  }
}

function openPublishModal() {
  if (!isLoggedIn.value) return
  showPublishModal.value = true
  publishStep.value = 1
  selectedLocalArticle.value = null
  publishTitle.value = ''
  publishContent.value = ''
  publishAnnotations.value = []
}

function selectLocalArticle(articleId: string) {
  const article = localArticles.value.find(a => a.id === articleId)
  if (article) {
    selectedLocalArticle.value = articleId
    publishTitle.value = article.title
    publishContent.value = article.content
    publishAnnotations.value = [...article.annotations]
    publishStep.value = 2
  }
}

function goToStep2() {
  if (publishTitle.value.trim() && publishContent.value.trim()) {
    publishStep.value = 2
  }
}

async function publishArticle() {
  if (!publishTitle.value.trim() || !publishContent.value.trim()) return
  
  publishing.value = true
  try {
    await api.publishArticle(
      publishTitle.value.trim(),
      publishContent.value,
      publishAnnotations.value
    )
    showPublishModal.value = false
    loadArticles()
  } catch (error) {
    console.error('Failed to publish article:', error)
  } finally {
    publishing.value = false
  }
}

function viewArticle(article: SharedArticle) {
  emit('openArticle', article)
}
</script>

<template>
  <div class="square-page">
    <div class="square-header">
      <h2>文章广场</h2>
      <button class="close-btn" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="square-actions">
      <button 
        class="publish-btn" 
        :class="{ disabled: !isLoggedIn }"
        @click="openPublishModal"
        :disabled="!isLoggedIn"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12,20h9"></path>
          <path d="M16.5,3.5a2.121,2.121,0,0,1,3,3L7,19,3,20l1-4L16.5,3.5Z"></path>
        </svg>
        <span>{{ isLoggedIn ? '发布文章' : '登录后发布' }}</span>
      </button>
    </div>

    <div class="articles-list">
      <div v-if="loading && sharedArticles.length === 0" class="loading">
        加载中...
      </div>

      <div v-else-if="sharedArticles.length === 0" class="empty">
        <p>暂无分享的文章</p>
        <p class="hint">成为第一个分享文言文的人吧！</p>
      </div>

      <template v-else>
        <div 
          v-for="article in sharedArticles" 
          :key="article.id" 
          class="article-card"
          @click="viewArticle(article)"
        >
          <div class="card-header">
            <h3 class="card-title">{{ article.title }}</h3>
            <span class="card-author">{{ article.author }}</span>
          </div>
          <p class="card-preview">{{ article.preview || article.content.slice(0, 150) }}...</p>
          <div class="card-footer">
            <span class="card-date">{{ formatDate(article.createdAt) }}</span>
            <div class="card-stats">
              <span class="stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14,9V5a3,3,0,0,0-3-3l-4,9v11h11.28a2,2,0,0,0,2-1.7l1.38-9a2,2,0,0,0-2-2.3zM7,22H4a2,2,0,0,1-2-2v-7a2,2,0,0,1,2-2h3"></path>
                </svg>
                {{ article.likes }}
              </span>
              <span class="stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                {{ article.downloads }}
              </span>
              <span class="stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                </svg>
                {{ article.annotationCount || article.annotations?.length || 0 }} 注释
              </span>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <button 
              class="action-btn" 
              :class="{ liked: likedArticles.has(article.id) }"
              @click="handleLike(article)"
              :disabled="!isLoggedIn"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14,9V5a3,3,0,0,0-3-3l-4,9v11h11.28a2,2,0,0,0,2-1.7l1.38-9a2,2,0,0,0-2-2.3zM7,22H4a2,2,0,0,1-2-2v-7a2,2,0,0,1,2-2h3"></path>
              </svg>
            </button>
            <button class="action-btn" @click="handleDownload(article)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="page < totalPages" class="load-more">
          <button class="load-more-btn" @click="loadMore" :disabled="loading">
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPublishModal" class="publish-modal-overlay" @click.self="showPublishModal = false">
          <div class="publish-modal">
            <div class="modal-header">
              <h3>发布文章</h3>
              <button class="close-btn" @click="showPublishModal = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="modal-body">
              <div v-if="publishStep === 1" class="step-content">
                <p class="step-hint">选择要发布的文章</p>
                
                <div v-if="localArticles.length > 0" class="local-articles">
                  <button 
                    v-for="article in localArticles" 
                    :key="article.id"
                    class="local-article-item"
                    @click="selectLocalArticle(article.id)"
                  >
                    <span class="article-title">{{ article.title }}</span>
                    <span class="article-annotations">{{ article.annotations.length }} 注释</span>
                  </button>
                </div>

                <div class="divider">
                  <span>或手动输入</span>
                </div>

                <div class="manual-input">
                  <div class="form-group">
                    <label>标题</label>
                    <input v-model="publishTitle" type="text" placeholder="文章标题" />
                  </div>
                  <div class="form-group">
                    <label>内容</label>
                    <textarea v-model="publishContent" placeholder="文章内容" rows="6"></textarea>
                  </div>
                  <button 
                    class="next-btn" 
                    @click="goToStep2"
                    :disabled="!publishTitle.trim() || !publishContent.trim()"
                  >
                    下一步
                  </button>
                </div>
              </div>

              <div v-else class="step-content">
                <p class="step-hint">确认发布内容</p>
                
                <div class="preview">
                  <div class="preview-title">{{ publishTitle }}</div>
                  <div class="preview-content">{{ publishContent.slice(0, 300) }}...</div>
                  <div class="preview-annotations">
                    共 {{ publishAnnotations.length }} 条注释
                  </div>
                </div>

                <div class="publish-actions">
                  <button class="back-btn" @click="publishStep = 1">返回修改</button>
                  <button 
                    class="publish-confirm-btn" 
                    @click="publishArticle"
                    :disabled="publishing"
                  >
                    {{ publishing ? '发布中...' : '确认发布' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.square-page {
  position: fixed;
  inset: 0;
  background: var(--bg-secondary);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.square-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.square-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
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
}

.close-btn:hover {
  background: var(--bg-tertiary);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.square-actions {
  padding: 0.75rem 1rem;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.publish-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem;
  background: var(--primary-color);
  color: var(--bg-primary);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.publish-btn:hover:not(:disabled) {
  background: var(--primary-color);
}

.publish-btn.disabled {
  background: var(--gray-300);
  cursor: not-allowed;
}

.publish-btn svg {
  width: 16px;
  height: 16px;
}

.articles-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.loading, .empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-tertiary);
}

.empty .hint {
  font-size: 0.8125rem;
  margin-top: 0.5rem;
}

.article-card {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid var(--border-color);
}

.article-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.card-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.card-author {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-left: 0.75rem;
}

.card-preview {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 0.75rem 0;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-date {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.card-stats {
  display: flex;
  gap: 0.75rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.stat svg {
  width: 12px;
  height: 12px;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--bg-tertiary);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.75rem;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.action-btn.liked {
  color: var(--warning-color);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.load-more {
  text-align: center;
  padding: 1rem;
}

.load-more-btn {
  padding: 0.5rem 1.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.load-more-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.publish-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  padding: 1rem;
}

.publish-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.step-hint {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0 0 1rem 0;
}

.local-articles {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.local-article-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.local-article-item:hover {
  background: var(--primary-50);
  border-color: var(--primary-color);
}

.article-title {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.article-annotations {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.divider {
  text-align: center;
  margin: 1rem 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: calc(50% - 40px);
  height: 1px;
  background: var(--border-color);
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.divider span {
  background: var(--bg-primary);
  padding: 0 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.next-btn {
  width: 100%;
  padding: 0.625rem;
  background: var(--primary-color);
  color: var(--bg-primary);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.next-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.preview-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.preview-content {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.preview-annotations {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.publish-actions {
  display: flex;
  gap: 0.5rem;
}

.back-btn {
  flex: 1;
  padding: 0.625rem;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.publish-confirm-btn {
  flex: 1;
  padding: 0.625rem;
  background: var(--primary-color);
  color: var(--bg-primary);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.publish-confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .publish-modal,
.modal-leave-to .publish-modal {
  transform: scale(0.95);
}
</style>
