<script setup lang="ts">
import { ref, computed } from 'vue'
import { useArticles } from '@/composables/useArticles'
import Logo from '@/components/Logo.vue'
import Dictionary from '@/components/Dictionary.vue'
import { generateId, saveArticles, exportData, importData } from '@/utils/storage'
import { parseMarkup, markupToJson, isValidMarkup, type ArticleJsonFormat } from '@/utils/annotationMarkup'
import { useGlobalSettings, presetModels } from '@/composables/useGlobalSettings'

const emit = defineEmits<{
  (e: 'openArticle', id: string): void
}>()

const {
  articles,
  folders,
  activeArticles,
  deletedArticles,
  favoriteArticles,
  addArticle,
  deleteArticle,
  restoreArticle,
  permanentlyDeleteArticle,
  emptyTrash,
  toggleFavorite,
  moveArticle,
  addFolder,
  deleteFolder,
  reloadArticles,
  reloadFolders
} = useArticles()

const showCreateModal = ref(false)
const showDictionary = ref(false)
const showNewFolderModal = ref(false)
const showMoveModal = ref(false)
const showMobileSidebar = ref(false)
const showMarkupConverter = ref(false)
const movingArticleId = ref<string | null>(null)
const newTitle = ref('')
const newContent = ref('')
const newFolderName = ref('')
const currentView = ref<'all' | 'favorites' | 'trash' | 'folder' | 'settings'>('all')
const currentFolderId = ref<string | null>(null)

const { settings } = useGlobalSettings()
const showApiKey = ref(false)

const converterTitle = ref('')
const converterMarkup = ref('')
const converterResult = ref<ArticleJsonFormat | null>(null)
const converterError = ref('')
const converterPreview = ref('')
const converterPlaceholder = '粘贴带 [ann] 标记的文本，例如：\n子曰：[ann="学过的内容按时复习"]学而时习之[/ann]，[ann="不也是很快乐吗"]不亦说乎[/ann]？'

const displayedArticles = computed(() => {
  if (currentView.value === 'favorites') {
    return favoriteArticles.value
  }
  if (currentView.value === 'trash') {
    return deletedArticles.value
  }
  if (currentView.value === 'folder' && currentFolderId.value) {
    return activeArticles.value.filter(a => a.folderId === currentFolderId.value)
  }
  return activeArticles.value.filter(a => !a.folderId)
})

const currentFolder = computed(() => {
  if (currentFolderId.value) {
    return folders.value.find(f => f.id === currentFolderId.value)
  }
  return null
})

function createNewArticle() {
  if (newTitle.value.trim()) {
    const folderId = currentView.value === 'folder' ? currentFolderId.value : null
    const article = addArticle(newTitle.value.trim(), newContent.value, folderId)
    showCreateModal.value = false
    newTitle.value = ''
    newContent.value = ''
    emit('openArticle', article.id)
  }
}

function createNewFolder() {
  if (newFolderName.value.trim()) {
    addFolder(newFolderName.value.trim())
    showNewFolderModal.value = false
    newFolderName.value = ''
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleDelete(id: string, event: Event) {
  event.stopPropagation()
  deleteArticle(id)
}

function handleRestore(id: string, event: Event) {
  event.stopPropagation()
  restoreArticle(id)
}

function handlePermanentDelete(id: string, event: Event) {
  event.stopPropagation()
  if (confirm('确定要永久删除这篇文章吗？此操作不可撤销。')) {
    permanentlyDeleteArticle(id)
  }
}

function handleEmptyTrash() {
  if (confirm('确定要清空回收站吗？此操作不可撤销。')) {
    emptyTrash()
  }
}

function handleToggleFavorite(id: string, event: Event) {
  event.stopPropagation()
  toggleFavorite(id)
}

function openMoveModal(id: string, event: Event) {
  event.stopPropagation()
  movingArticleId.value = id
  showMoveModal.value = true
}

function handleMoveToFolder(folderId: string | null) {
  if (movingArticleId.value) {
    moveArticle(movingArticleId.value, folderId)
    showMoveModal.value = false
    movingArticleId.value = null
  }
}

function switchView(view: 'all' | 'favorites' | 'trash' | 'folder' | 'settings', folderId?: string) {
  currentView.value = view
  currentFolderId.value = folderId || null
  showMobileSidebar.value = false
}

function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      
      if (data.type === 'single-article' && data.article) {
        const newArticle = {
          ...data.article,
          id: generateId(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        articles.value.unshift(newArticle)
        saveArticles(articles.value)
        alert('文章导入成功')
      } else {
        alert('不支持的文件格式')
      }
    } catch {
      alert('导入失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  ;(event.target as HTMLInputElement).value = ''
}

function handleExportArticle(id: string, event: Event) {
  event.stopPropagation()
  const article = articles.value.find(a => a.id === id)
  if (!article) return
  
  const exportArticle = {
    version: '1.0',
    type: 'single-article',
    exportedAt: Date.now(),
    article
  }
  
  const blob = new Blob([JSON.stringify(exportArticle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeTitle = article.title.replace(/[\\/:*?"<>|]/g, '_')
  a.download = `${safeTitle}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleExportAll() {
  const data = exportData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().split('T')[0]
  a.download = `turquoise_backup_${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleImportAll(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      
      if (data.version && data.articles) {
        const result = importData(data)
        if (result.success) {
          reloadArticles()
          reloadFolders()
          alert(result.message)
        } else {
          alert(result.message)
        }
      } else {
        alert('无效的备份文件格式')
      }
    } catch {
      alert('导入失败，请检查文件格式')
    }
  }
  reader.readAsText(file)
  ;(event.target as HTMLInputElement).value = ''
}

function convertMarkupToJson() {
  converterError.value = ''
  converterResult.value = null
  converterPreview.value = ''

  const markup = converterMarkup.value.trim()
  const title = converterTitle.value.trim() || '未命名文章'

  if (!markup) {
    converterError.value = '请输入带注释标记的文本'
    return
  }

  const validation = isValidMarkup(markup)
  if (!validation.valid) {
    converterError.value = validation.error || '标记格式错误'
    return
  }

  try {
    const result = markupToJson(markup, title)
    converterResult.value = result

    const parsed = parseMarkup(markup, title)
    converterPreview.value = `解析结果：
- 文章标题：${parsed.title}
- 正文长度：${parsed.plainContent.length} 字
- 注释数量：${parsed.annotations.length} 条

注释列表：
${parsed.annotations.map((ann, idx) => 
  `${idx + 1}. "${ann.text}" → ${ann.content}`
).join('\n')}`

  } catch (e) {
    converterError.value = '转换失败：' + (e as Error).message
  }
}

function downloadJson() {
  if (!converterResult.value) return

  const blob = new Blob([JSON.stringify(converterResult.value, null, 2)], { 
    type: 'application/json' 
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeTitle = converterResult.value.article.title.replace(/[\\/:*?"<>|]/g, '_')
  a.download = `${safeTitle}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importConvertedArticle() {
  if (!converterResult.value) {
    converterError.value = '请先转换文本'
    return
  }

  try {
    const newArticle = {
      id: generateId(),
      title: converterResult.value.article.title,
      content: converterResult.value.article.content,
      annotations: converterResult.value.article.annotations.map(ann => ({
        ...ann,
        id: generateId()
      })),
      formats: [],
      folderId: currentView.value === 'folder' ? currentFolderId.value : null,
      isFavorite: false,
      isDeleted: false,
      deletedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    articles.value.unshift(newArticle)
    saveArticles(articles.value)
    
    alert(`成功导入文章，包含 ${newArticle.annotations.length} 条注释`)
    
    showMarkupConverter.value = false
    converterTitle.value = ''
    converterMarkup.value = ''
    converterResult.value = null
    converterError.value = ''
    converterPreview.value = ''
  } catch (e) {
    converterError.value = '导入失败：' + (e as Error).message
  }
}

function closeConverter() {
  showMarkupConverter.value = false
  converterTitle.value = ''
  converterMarkup.value = ''
  converterResult.value = null
  converterError.value = ''
  converterPreview.value = ''
}

// 窗口控制方法
const minimize = () => {
  if (window.electron) {
    window.electron.minimize()
  }
}

const maximize = () => {
  if (window.electron) {
    window.electron.maximize()
  }
}

const close = () => {
  if (window.electron) {
    window.electron.close()
  }
}


</script>

<template>
  <div class="article-list">
    <div class="mobile-logo">
      <Logo />
    </div>

    <div class="sidebar scrollbar-hidden" :class="{ 'mobile-open': showMobileSidebar }">
      <div class="sidebar-logo">
        <Logo />
      </div>
      <button class="mobile-sidebar-close" @click="showMobileSidebar = false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      


      <div class="sidebar-section">
        <button class="nav-item" :class="{ active: currentView === 'all' }" @click="switchView('all')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span>全部文章</span>
          <span class="count">{{ activeArticles.length }}</span>
        </button>
        <button class="nav-item" :class="{ active: currentView === 'favorites' }" @click="switchView('favorites')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"></polygon>
          </svg>
          <span>收藏</span>
          <span class="count" v-if="favoriteArticles.length">{{ favoriteArticles.length }}</span>
        </button>
        <button class="nav-item" :class="{ active: currentView === 'trash' }" @click="switchView('trash')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
          </svg>
          <span>回收站</span>
          <span class="count" v-if="deletedArticles.length">{{ deletedArticles.length }}</span>
        </button>
      </div>

      <div class="sidebar-section">
        <div class="section-header">
          <span>文件夹</span>
          <button class="section-btn" @click="showNewFolderModal = true" title="新建文件夹">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        <div class="folder-list">
          <button
            v-for="folder in folders"
            :key="folder.id"
            class="nav-item"
            :class="{ active: currentView === 'folder' && currentFolderId === folder.id }"
            @click="switchView('folder', folder.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22,19a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V5A2,2,0,0,1,4,3H9l2,3h9a2,2,0,0,1,2,2Z"></path>
            </svg>
            <span>{{ folder.name }}</span>
            <button class="delete-folder" @click.stop="deleteFolder(folder.id)" title="删除文件夹">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </button>
          <div v-if="folders.length === 0" class="empty-folder">暂无文件夹</div>
        </div>
      </div>

      <div class="sidebar-spacer"></div>

      <div class="sidebar-section settings-section">
        <div class="section-header">
          <span>数据</span>
        </div>
        <label class="nav-item import-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"></path>
            <polyline points="17,8 12,3 7,8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span>导入文章</span>
          <input type="file" accept=".json" @change="handleImport" hidden />
        </label>
        <button class="nav-item" @click="showMarkupConverter = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>注释转换</span>
        </button>
        <button class="nav-item" @click="handleExportAll">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>导出全部</span>
        </button>
        <button class="nav-item" @click="($refs.importAllInput as HTMLInputElement).click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <span>导入备份</span>
        </button>
        <input 
          ref="importAllInput"
          type="file" 
          accept=".json"
          @change="handleImportAll"
          style="display: none"
        >
      </div>

      <div class="sidebar-section settings-section">
        <button class="nav-item" :class="{ active: currentView === 'settings' }" @click="switchView('settings')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>设置</span>
        </button>
      </div>
    </div>

    <!-- 窗口控制按钮 - 绝对定位固定在右上角 -->
    <div class="window-controls-fixed">
      <button class="window-control-btn" @click="minimize" title="最小化">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="4" y1="12" x2="20" y2="12"></line>
        </svg>
      </button>
      <button class="window-control-btn" @click="maximize" title="最大化">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16"></rect>
        </svg>
      </button>
      <button class="window-control-btn close" @click="close" title="关闭">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <main class="main-content">
      <template v-if="currentView === 'settings'">
        <div class="settings-panel">
          <section class="settings-section">
            <h3>AI 助手</h3>
            
            <div class="settings-card">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">AI 模型</span>
                  <span class="setting-desc">选择用于 AI 聊天和注释功能</span>
                </div>
                <div class="setting-control">
                  <select v-model="settings.aiModel" class="setting-select">
                    <option v-for="model in presetModels" :key="model.value" :value="model.value">
                      {{ model.name }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="setting-row" v-if="settings.aiModel === 'custom'">
                <div class="setting-info">
                  <span class="setting-label">自定义模型名称</span>
                  <span class="setting-desc">输入自定义 AI 模型名称</span>
                </div>
                <div class="setting-control">
                  <input 
                    type="text" 
                    v-model="settings.customModelName"
                    placeholder="gpt-4o-mini"
                    class="setting-input"
                  />
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">思考模型</span>
                  <span class="setting-desc">解析 AI 的思考过程</span>
                </div>
                <div class="setting-control">
                  <label class="toggle">
                    <input type="checkbox" v-model="settings.isThinkingModel">
                    <span class="toggle-track">
                      <span class="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3>API 配置</h3>
            
            <div class="settings-card">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">API Key</span>
                  <span class="setting-desc">你的 API 密钥</span>
                </div>
                <div class="setting-control">
                  <div class="api-key-wrapper">
                    <input 
                      :type="showApiKey ? 'text' : 'password'" 
                      v-model="settings.apiKey"
                      placeholder="输入你的 API Key"
                      class="setting-input api-input"
                    />
                    <button class="api-toggle" @click="showApiKey = !showApiKey">
                      <svg v-if="!showApiKey" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">API 地址</span>
                  <span class="setting-desc">API 基础 URL</span>
                </div>
                <div class="setting-control">
                  <input 
                    type="text" 
                    v-model="settings.apiBaseUrl"
                    placeholder="https://api.siliconflow.cn/v1"
                    class="setting-input"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3>显示</h3>
            
            <div class="settings-card">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-label">缩放</span>
                  <span class="setting-desc">调整界面显示大小</span>
                </div>
                <div class="setting-control">
                  <div class="scale-wrapper">
                    <input 
                      type="range" 
                      v-model.number="settings.globalScale"
                      min="0.8"
                      max="1.5"
                      step="0.05"
                      class="scale-input"
                    />
                    <span class="scale-value">{{ Math.round(settings.globalScale * 100) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>

      <template v-else>
        <div class="view-header">
          <h2 v-if="currentView === 'all'">全部文章</h2>
          <h2 v-else-if="currentView === 'favorites'">收藏</h2>
          <h2 v-else-if="currentView === 'trash'">回收站</h2>
          <h2 v-else-if="currentFolder">{{ currentFolder.name }}</h2>
        </div>
        <button v-if="currentView === 'trash' && deletedArticles.length" class="empty-trash-btn" @click="handleEmptyTrash">
          清空回收站
        </button>

        <div class="articles" v-if="displayedArticles.length > 0">
        <div
          v-for="article in displayedArticles"
          :key="article.id"
          class="article-card"
          @click="currentView !== 'trash' && emit('openArticle', article.id)"
        >
          <div class="card-body">
            <div class="card-header">
              <h3 class="card-title">{{ article.title }}</h3>
              <div class="card-actions">
                <button
                  v-if="currentView !== 'trash'"
                  class="action-btn"
                  :class="{ active: article.isFavorite }"
                  @click="handleToggleFavorite(article.id, $event)"
                  title="收藏"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"></polygon>
                  </svg>
                </button>
                <button
                  v-if="currentView !== 'trash' && folders.length > 0"
                  class="action-btn"
                  @click="openMoveModal(article.id, $event)"
                  title="移动到文件夹"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22,19a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V5A2,2,0,0,1,4,3H9l2,3h9a2,2,0,0,1,2,2Z"></path>
                  </svg>
                </button>
                <button
                  v-if="currentView !== 'trash'"
                  class="action-btn"
                  @click="handleExportArticle(article.id, $event)"
                  title="导出"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"></path>
                    <polyline points="7,10 12,15 17,10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
                <button
                  v-if="currentView !== 'trash'"
                  class="action-btn delete"
                  @click="handleDelete(article.id, $event)"
                  title="删除"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"></polyline>
                    <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
                  </svg>
                </button>
                <button
                  v-if="currentView === 'trash'"
                  class="action-btn"
                  @click="handleRestore(article.id, $event)"
                  title="恢复"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="1,4 1,10 7,10"></polyline>
                    <path d="M3.51,15a9,9,0,1,0,2.13-9.36L1,10"></path>
                  </svg>
                </button>
                <button
                  v-if="currentView === 'trash'"
                  class="action-btn delete"
                  @click="handlePermanentDelete(article.id, $event)"
                  title="永久删除"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            <p class="card-preview">{{ article.content.slice(0, 120) }}{{ article.content.length > 120 ? '...' : '' }}</p>
            <div class="card-footer">
              <span class="card-time">{{ formatDate(article.updatedAt) }}</span>
              <span v-if="article.annotations && article.annotations.length > 0" class="card-annotations">
                {{ article.annotations.length }} 注释
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <div class="empty-illustration">
          <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="30" y="20" width="140" height="120" rx="4" stroke="#d4d4d4" stroke-width="2" fill="none"/>
            <line x1="50" y1="50" x2="150" y2="50" stroke="#d4d4d4" stroke-width="2" stroke-linecap="round"/>
            <line x1="50" y1="70" x2="130" y2="70" stroke="#d4d4d4" stroke-width="2" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="140" y2="90" stroke="#d4d4d4" stroke-width="2" stroke-linecap="round"/>
            <line x1="50" y1="110" x2="100" y2="110" stroke="#d4d4d4" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 v-if="currentView === 'trash'">回收站为空</h3>
        <h3 v-else-if="currentView === 'favorites'">暂无收藏</h3>
        <h3 v-else>还没有文章</h3>
        <p v-if="currentView !== 'trash'">点击右下角按钮创建第一篇文言文笔记</p>
      </div>
      </template>
    </main>

    <button class="fab dict" @click="showDictionary = true" title="词典">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"></path>
        <path d="M6.5,2H20V22H6.5A2.5,2.5,0,0,1,4,19.5V4.5A2.5,2.5,0,0,1,6.5,2Z"></path>
      </svg>
    </button>

    <button v-if="currentView !== 'trash'" class="fab" @click="showCreateModal = true" title="创建文章">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>

    <div class="mobile-nav">
      <button class="mobile-nav-item" :class="{ active: currentView === 'all' }" @click="switchView('all')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </svg>
        <span>文章</span>
      </button>
      <button class="mobile-nav-item" :class="{ active: currentView === 'favorites' }" @click="switchView('favorites')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"></polygon>
        </svg>
        <span>收藏</span>
      </button>
      <button class="mobile-nav-item create" @click="showCreateModal = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button class="mobile-nav-item" @click="showMobileSidebar = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22,19a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V5A2,2,0,0,1,4,3H9l2,3h9a2,2,0,0,1,2,2Z"></path>
        </svg>
        <span>文件夹</span>
      </button>
      <button class="mobile-nav-item" :class="{ active: currentView === 'trash' }" @click="switchView('trash')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"></path>
        </svg>
        <span>回收站</span>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="showMobileSidebar" class="mobile-sidebar-overlay" @click="showMobileSidebar = false"></div>
    </Transition>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
          <div class="modal">
            <div class="modal-header">
              <h2>创建新文章</h2>
              <button class="modal-close" @click="showCreateModal = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>文章标题</label>
                <input v-model="newTitle" type="text" placeholder="例如：岳阳楼记" @keyup.enter="createNewArticle" />
              </div>
              <div class="form-group">
                <label>文章内容 <span class="optional">（可选）</span></label>
                <textarea v-model="newContent" placeholder="粘贴或输入文言文内容..." rows="8"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" @click="showCreateModal = false">取消</button>
              <button class="btn-primary" @click="createNewArticle" :disabled="!newTitle.trim()">
                创建文章
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="showNewFolderModal" class="modal-overlay" @click.self="showNewFolderModal = false">
          <div class="modal sm">
            <div class="modal-header">
              <h2>新建文件夹</h2>
              <button class="modal-close" @click="showNewFolderModal = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>文件夹名称</label>
                <input v-model="newFolderName" type="text" placeholder="输入文件夹名称" @keyup.enter="createNewFolder" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" @click="showNewFolderModal = false">取消</button>
              <button class="btn-primary" @click="createNewFolder" :disabled="!newFolderName.trim()">
                创建
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="showMoveModal" class="modal-overlay" @click.self="showMoveModal = false">
          <div class="modal sm">
            <div class="modal-header">
              <h2>移动到文件夹</h2>
              <button class="modal-close" @click="showMoveModal = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="folder-select-list">
                <button class="folder-select-item" @click="handleMoveToFolder(null)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3,9l9-7,9,7v11a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2Z"></path>
                    <polyline points="9,22 9,12 15,12 15,22"></polyline>
                  </svg>
                  <span>根目录</span>
                </button>
                <button
                  v-for="folder in folders"
                  :key="folder.id"
                  class="folder-select-item"
                  @click="handleMoveToFolder(folder.id)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22,19a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V5A2,2,0,0,1,4,3H9l2,3h9a2,2,0,0,1,2,2Z"></path>
                  </svg>
                  <span>{{ folder.name }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="showMarkupConverter" class="modal-overlay" @click.self="closeConverter">
          <div class="modal markup-converter">
            <div class="modal-header">
              <h2>注释转换工具</h2>
              <button class="modal-close" @click="closeConverter">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal-body converter-body">
              <div class="converter-section">
                <div class="form-group">
                  <label>文章标题</label>
                  <input v-model="converterTitle" type="text" placeholder="例如：论语·学而" />
                </div>
                <div class="form-group">
                  <label>带注释标记的文本</label>
                  <textarea 
                    v-model="converterMarkup" 
                    :placeholder="converterPlaceholder"
                    rows="10"
                  ></textarea>
                </div>
                <div class="converter-tip">
                  <strong>使用说明：</strong><br/>
                  格式：<code>[ann="注释内容"]被注释的文本[/ann]</code><br/>
                  可以使用AI生成带标记的文本，然后在此处转换导入。
                </div>
                <button class="btn-primary convert-btn" @click="convertMarkupToJson" :disabled="!converterMarkup.trim()">
                  转换文本
                </button>
                <div v-if="converterError" class="converter-error">{{ converterError }}</div>
              </div>

              <div class="converter-section" v-if="converterResult">
                <div class="section-title">转换结果</div>
                <pre class="converter-preview">{{ converterPreview }}</pre>
                
                <div class="section-title">JSON 预览</div>
                <pre class="json-preview">{{ JSON.stringify(converterResult, null, 2) }}</pre>

                <div class="converter-actions">
                  <button class="btn-secondary" @click="downloadJson">
                    下载 JSON
                  </button>
                  <button class="btn-primary" @click="importConvertedArticle">
                    直接导入
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <Dictionary 
        v-if="showDictionary" 
        @close="showDictionary = false"
        @open-article="(id: string) => { emit('openArticle', id); showDictionary = false; }"
      />
    </Teleport>
  </div>
</template>

<style scoped>
button, a, input, textarea, select {
  -webkit-app-region: no-drag;
}

.article-list {
  min-height: 100vh;
  background: var(--bg-secondary);
  position: relative;
  display: flex;
}

.sidebar {
  width: 220px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  padding: 3rem 0.75rem 1rem;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  -webkit-app-region: no-drag;
}

.sidebar-logo {
  position: absolute;
  top: 1rem;
  left: 1rem;
  -webkit-app-region: drag;
}

.sidebar-logo :deep(.logo-svg) {
  width: 24px;
  height: 24px;
}

.sidebar-spacer {
  flex: 1;
}

.mobile-logo {
  display: none;
}

.mobile-nav {
  display: none;
}

.mobile-sidebar-overlay {
  display: none;
}

.mobile-sidebar-close {
  display: none;
}

.sidebar-section {
  margin-bottom: 1.5rem;
}

.user-section {
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--primary-color);
  color: var(--text-inverse);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
}

.user-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.logout-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 0.6875rem;
  cursor: pointer;
  text-align: left;
  padding: 0;
}

.logout-btn:hover {
  color: var(--error-color);
}

.login-btn {
  background: var(--primary-50) !important;
  color: var(--primary-color) !important;
}

.square-btn {
  background: linear-gradient(135deg, var(--primary-50) 0%, var(--primary-50) 100%) !important;
  color: var(--primary-color) !important;
}

.import-label {
  cursor: pointer;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.5rem;
  margin-bottom: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary);
}

.section-btn svg {
  width: 14px;
  height: 14px;
}

.section-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-align: left;
  transition: all 0.15s;
}

.nav-item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.nav-item:hover {
  background: var(--bg-tertiary);
}

.nav-item.active {
  background: var(--primary-50);
  color: var(--primary-color);
}

.nav-item .count {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
}

.nav-item.active .count {
  background: var(--primary-color);
  color: var(--text-inverse);
}

.delete-folder {
  margin-left: auto;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary);
  opacity: 0;
  transition: all 0.15s;
}

.delete-folder svg {
  width: 12px;
  height: 12px;
}

.nav-item:hover .delete-folder {
  opacity: 1;
}

.delete-folder:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.empty-folder {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  padding: 0.5rem 0.625rem;
}

.settings-section {
  padding-top: 0.75rem;
  border-top: 0.5px solid var(--border-color);
}

.window-controls {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 0.625rem;
  margin-top: 1rem;
  border-top: 1px solid var(--border-color);
  justify-content: center;
}

.window-control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.15s;
}

.window-control-btn svg {
  width: 16px;
  height: 16px;
}

.window-control-btn:hover {
  background: var(--bg-primary);
  color: var(--text-secondary);
}

.window-control-btn.close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.main-content {
  flex: 1;
  margin-left: 220px;
  padding: 1.5rem 2rem 6rem;
  max-width: 100%;
  -webkit-app-region: no-drag;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.view-header h2 {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.window-controls-fixed {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  z-index: 1000;
  -webkit-app-region: no-drag;
}

.window-control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.15s;
}

.window-control-btn svg {
  width: 16px;
  height: 16px;
}

.window-control-btn:hover {
  background: var(--bg-primary);
  color: var(--text-secondary);
}

.window-control-btn.close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.empty-trash-btn {
  padding: 0.375rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  margin-bottom: 1rem;
  display: inline-block;
}

.empty-trash-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.articles {
  display: grid;
  gap: 0.75rem;
}

.article-card {
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--border-color);
}

.article-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-body {
  padding: 1.25rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.card-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.15s;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.action-btn.active {
  color: var(--warning-color);
  fill: var(--warning-color);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.card-preview {
  color: var(--text-secondary);
  font-size: 0.8125rem;
  margin: 0 0 0.75rem 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-illustration {
  margin-bottom: 1.5rem;
}

.empty-illustration svg {
  width: 180px;
  height: 140px;
}

.empty-state h3 {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 0.375rem;
  font-weight: 500;
}

.empty-state p {
  color: var(--text-tertiary);
  font-size: 0.8125rem;
}

.fab {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
  width: 44px;
  height: 44px;
  background: var(--primary-color);
  color: var(--bg-primary);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(45, 212, 191, 0.25);
  transition: all 0.2s ease;
  z-index: 100;
}

.fab.dict {
  right: 5.5rem;
  background: var(--bg-primary);
  color: var(--text-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.fab.dict:hover {
  background: var(--primary-50);
  color: var(--primary-color);
}

.fab svg {
  width: 20px;
  height: 20px;
}

.fab:hover {
  background: var(--primary-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(45, 212, 191, 0.35);
}

.fab:active {
  transform: scale(0.98);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal {
  background: #f5f5f7;
  border-radius: 14px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 
    0 32px 80px rgba(0, 0, 0, 0.24),
    0 0 0 0.5px rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .modal {
  background: #1c1c1e;
  box-shadow: 
    0 32px 80px rgba(0, 0, 0, 0.6),
    0 0 0 0.5px rgba(255, 255, 255, 0.1);
}

.modal.sm {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}

:global(.dark-mode) .modal-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.01em;
}

:global(.dark-mode) .modal-header h2 {
  color: #f5f5f7;
}

.modal-close {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: #86868b;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close svg {
  width: 18px;
  height: 18px;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
}

:global(.dark-mode) .modal-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 500;
}

:global(.dark-mode) .form-group label {
  color: #f5f5f7;
}

.optional {
  color: #86868b;
  font-weight: 400;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s ease;
  box-sizing: border-box;
  background: #ffffff;
  color: #1d1d1f;
}

:global(.dark-mode) .form-group input,
:global(.dark-mode) .form-group textarea {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.12);
  color: #f5f5f7;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb), 0.12);
}

:global(.dark-mode) .form-group input:focus,
:global(.dark-mode) .form-group textarea:focus {
  background: #2c2c2e;
}

.form-group textarea {
  resize: none;
  min-height: 140px;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 14px 24px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  background: rgba(0, 0, 0, 0.02);
}

:global(.dark-mode) .modal-footer {
  border-top-color: rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.04);
}

.btn-primary,
.btn-secondary {
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn-primary {
  background: var(--primary-color);
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-600);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: var(--primary-color);
}

.btn-secondary:hover {
  background: rgba(var(--primary-color-rgb), 0.08);
}

.folder-select-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.folder-select-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: left;
  width: 100%;
  transition: all 0.15s;
}

.folder-select-item svg {
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
}

.folder-select-item:hover {
  background: var(--primary-50);
  color: var(--primary-color);
}

.folder-select-item:hover svg {
  color: var(--primary-color);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.95);
}

.markup-converter {
  max-width: 1000px;
}

.converter-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 24px;
}

.converter-section {
  display: flex;
  flex-direction: column;
}

.converter-section textarea {
  width: 100%;
  min-height: 240px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  padding: 12px 14px;
  border: 0.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: #ffffff;
  color: #1d1d1f;
  line-height: 1.6;
  transition: all 0.2s ease;
  resize: none;
}

:global(.dark-mode) .converter-section textarea {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.12);
  color: #f5f5f7;
}

.converter-section textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb), 0.12);
}

.converter-tip {
  padding: 12px 14px;
  background: #f5f5f7;
  border-radius: 8px;
  font-size: 12px;
  color: #86868b;
  margin-bottom: 16px;
  line-height: 1.6;
  border: 0.5px solid rgba(0, 0, 0, 0.05);
}

:global(.dark-mode) .converter-tip {
  background: #2c2c2e;
  color: #86868b;
  border-color: rgba(255, 255, 255, 0.08);
}

.converter-tip code {
  background: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', Courier, monospace;
  color: var(--primary-color);
  font-size: 11px;
}

:global(.dark-mode) .converter-tip code {
  background: #1c1c1e;
}

.convert-btn {
  width: 100%;
  margin-bottom: 16px;
  padding: 10px 18px;
  font-size: 14px;
}

.converter-error {
  padding: 12px 14px;
  background: rgba(255, 59, 48, 0.08);
  border: 0.5px solid rgba(255, 59, 48, 0.2);
  border-radius: 8px;
  font-size: 13px;
  color: #ff3b30;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}

:global(.dark-mode) .section-title {
  color: #f5f5f7;
}

.converter-preview,
.json-preview {
  background: #f5f5f7;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 12px;
  color: #1d1d1f;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 16px;
  border: 0.5px solid rgba(0, 0, 0, 0.05);
}

:global(.dark-mode) .converter-preview,
:global(.dark-mode) .json-preview {
  background: #2c2c2e;
  color: #f5f5f7;
  border-color: rgba(255, 255, 255, 0.08);
}

.json-preview {
  font-family: 'Courier New', Courier, monospace;
}

.converter-actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}

.converter-actions .btn-primary,
.converter-actions .btn-secondary {
  flex: 1;
  padding: 10px 18px;
}

@media (max-width: 900px) {
  .converter-body {
    grid-template-columns: 1fr;
  }
  
  .converter-actions {
    margin-top: 1rem;
  }
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
    position: fixed;
    z-index: 200;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
  }

  .sidebar.mobile-open {
    display: block;
    transform: translateX(0);
  }

  .mobile-sidebar-close {
    display: none;
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-secondary);
  }

  .mobile-sidebar-close svg {
    width: 16px;
    height: 16px;
  }

  .sidebar.mobile-open .mobile-sidebar-close {
    display: flex;
  }

  .sidebar.mobile-open .sidebar-logo {
    left: 1rem;
  }

  .mobile-sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 150;
  }

  .mobile-logo {
    display: block;
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 100;
  }

  .mobile-logo :deep(.logo-svg) {
    width: 20px;
    height: 20px;
  }

  .main-content {
    margin-left: 0;
    padding: 4rem 1rem 5rem;
  }

  .fab {
    display: none;
  }

  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border-top: 1px solid var(--border-color);
    padding: 0.5rem 0.25rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    z-index: 100;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  }

  .mobile-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    padding: 0.375rem 0.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary);
    font-size: 0.625rem;
    transition: all 0.15s;
  }

  .mobile-nav-item svg {
    width: 20px;
    height: 20px;
  }

  .mobile-nav-item.active {
    color: var(--primary-color);
  }

  .mobile-nav-item.create {
    background: var(--primary-color);
    color: var(--bg-primary);
    border-radius: 50%;
    width: 44px;
    height: 44px;
    margin-top: -22px;
    flex: none;
    margin-left: auto;
    margin-right: auto;
    box-shadow: 0 2px 8px rgba(45, 212, 191, 0.3);
  }

  .mobile-nav-item.create svg {
    width: 22px;
    height: 22px;
  }

  .mobile-nav-item.create:hover {
    background: var(--primary-color);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.settings-panel {
  padding: 2rem;
}

.settings-section {
  margin-bottom: 28px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 10px 0;
  letter-spacing: -0.01em;
}

.settings-card {
  background: var(--bg-primary);
  border-radius: 12px;
  overflow: hidden;
  border: 0.5px solid var(--border-color);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  min-height: 52px;
  border-bottom: 0.5px solid var(--border-color);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  padding-right: 16px;
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.setting-control {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.setting-input,
.setting-select {
  padding: 8px 12px;
  border: 0.5px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  outline: none;
  transition: all 0.2s ease;
  min-width: 160px;
  max-width: 200px;
}

.setting-input:focus,
.setting-select:focus {
  border-color: var(--primary-color);
  background: var(--bg-primary);
  box-shadow: 0 0 0 4px rgba(var(--primary-color-rgb), 0.12);
}

.api-key-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-input {
  width: 160px;
}

.api-toggle {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}

.api-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.api-toggle svg {
  width: 18px;
  height: 18px;
}

.toggle {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-track {
  display: block;
  width: 51px;
  height: 31px;
  background: var(--bg-tertiary);
  border-radius: 31px;
  position: relative;
  transition: background 0.2s ease;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  background: var(--bg-primary);
  border-radius: 50%;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.08);
  transition: transform 0.25s cubic-bezier(0.36, 0, 0.18, 1);
}

.toggle input:checked + .toggle-track {
  background: #34c759;
}

.toggle input:checked + .toggle-track .toggle-thumb {
  transform: translateX(20px);
}

.scale-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scale-input {
  width: 140px;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.scale-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-primary);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  border: 0.5px solid rgba(0, 0, 0, 0.1);
}

.scale-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-primary);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.scale-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  min-width: 40px;
  text-align: right;
}

@media (max-width: 768px) {
  .settings-panel {
    padding: 1rem;
  }

  .setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .setting-info {
    padding-right: 0;
  }

  .setting-control {
    width: 100%;
  }

  .setting-input,
  .setting-select {
    width: 100%;
    max-width: 100%;
  }

  .api-key-wrapper {
    width: 100%;
  }

  .api-input {
    flex: 1;
  }
}
</style>
