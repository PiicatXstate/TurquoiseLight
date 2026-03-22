import { ref, computed } from 'vue'
import type { Article, Folder } from '@/types'
import { loadArticles, saveArticles, createArticle, generateId, loadFolders, saveFolders, createFolder } from '@/utils/storage'

const articles = ref<Article[]>(loadArticles())
const folders = ref<Folder[]>(loadFolders())

export function useArticles() {
  function addArticle(title: string, content: string, folderId: string | null = null): Article {
    const article = createArticle(title, content, folderId)
    articles.value.unshift(article)
    saveArticles(articles.value)
    return article
  }

  function updateArticle(id: string, updates: Partial<Article>): void {
    const index = articles.value.findIndex(a => a.id === id)
    if (index !== -1) {
      articles.value[index] = {
        ...articles.value[index],
        ...updates,
        updatedAt: Date.now()
      }
      saveArticles(articles.value)
    }
  }

  function deleteArticle(id: string): void {
    const article = articles.value.find(a => a.id === id)
    if (article) {
      article.isDeleted = true
      article.deletedAt = Date.now()
      saveArticles(articles.value)
    }
  }

  function restoreArticle(id: string): void {
    const article = articles.value.find(a => a.id === id)
    if (article) {
      article.isDeleted = false
      article.deletedAt = null
      saveArticles(articles.value)
    }
  }

  function permanentlyDeleteArticle(id: string): void {
    articles.value = articles.value.filter(a => a.id !== id)
    saveArticles(articles.value)
  }

  function emptyTrash(): void {
    articles.value = articles.value.filter(a => !a.isDeleted)
    saveArticles(articles.value)
  }

  function getArticle(id: string): Article | undefined {
    return articles.value.find(a => a.id === id)
  }

  function toggleFavorite(id: string): void {
    const article = articles.value.find(a => a.id === id)
    if (article) {
      article.isFavorite = !article.isFavorite
      saveArticles(articles.value)
    }
  }

  function moveArticle(articleId: string, folderId: string | null): void {
    const article = articles.value.find(a => a.id === articleId)
    if (article) {
      article.folderId = folderId
      saveArticles(articles.value)
    }
  }

  function checkAnnotationExists(articleId: string, startIndex: number, endIndex: number): boolean {
    const article = getArticle(articleId)
    if (article) {
      return article.annotations.some(
        a => a.startIndex === startIndex && a.endIndex === endIndex
      )
    }
    return false
  }

  function addAnnotation(articleId: string, startIndex: number, endIndex: number, text: string, content: string): boolean {
    const article = getArticle(articleId)
    if (article) {
      const exists = article.annotations.some(
        a => a.startIndex === startIndex && a.endIndex === endIndex
      )
      if (exists) {
        return false
      }
      article.annotations.push({
        id: generateId(),
        startIndex,
        endIndex,
        text,
        content
      })
      saveArticles(articles.value)
      return true
    }
    return false
  }

  function updateAnnotation(articleId: string, annotationId: string, content: string): void {
    const article = getArticle(articleId)
    if (article) {
      const annotation = article.annotations.find(a => a.id === annotationId)
      if (annotation) {
        annotation.content = content
        saveArticles(articles.value)
      }
    }
  }

  function deleteAnnotation(articleId: string, annotationId: string): void {
    const article = getArticle(articleId)
    if (article) {
      article.annotations = article.annotations.filter(a => a.id !== annotationId)
      saveArticles(articles.value)
    }
  }

  function addFormat(articleId: string, type: 'bold' | 'underline', startIndex: number, endIndex: number): void {
    const article = getArticle(articleId)
    if (article) {
      const existing = article.formats.find(
        f => f.type === type && f.startIndex === startIndex && f.endIndex === endIndex
      )
      if (!existing) {
        article.formats.push({ type, startIndex, endIndex })
        saveArticles(articles.value)
      }
    }
  }

  function removeFormat(articleId: string, type: 'bold' | 'underline', startIndex: number, endIndex: number): void {
    const article = getArticle(articleId)
    if (article) {
      article.formats = article.formats.filter(
        f => !(f.type === type && f.startIndex === startIndex && f.endIndex === endIndex)
      )
      saveArticles(articles.value)
    }
  }

  function addFolder(name: string, parentId: string | null = null): Folder {
    const folder = createFolder(name, parentId)
    folders.value.push(folder)
    saveFolders(folders.value)
    return folder
  }

  function updateFolder(id: string, name: string): void {
    const folder = folders.value.find(f => f.id === id)
    if (folder) {
      folder.name = name
      saveFolders(folders.value)
    }
  }

  function deleteFolder(id: string): void {
    folders.value = folders.value.filter(f => f.id !== id)
    articles.value.forEach(a => {
      if (a.folderId === id) {
        a.folderId = null
      }
    })
    saveFolders(folders.value)
    saveArticles(articles.value)
  }

  const activeArticles = computed(() => articles.value.filter(a => !a.isDeleted))
  const deletedArticles = computed(() => articles.value.filter(a => a.isDeleted))
  const favoriteArticles = computed(() => articles.value.filter(a => a.isFavorite && !a.isDeleted))

  function reloadArticles(): void {
    articles.value = loadArticles()
  }

  function reloadFolders(): void {
    folders.value = loadFolders()
  }

  function findDictionaryEntries(text: string): { content: string; articleTitle: string; articleId: string }[] {
    const results: { content: string; articleTitle: string; articleId: string }[] = []
    const normalizedText = text.trim().toLowerCase()
    
    for (const article of articles.value) {
      for (const ann of article.annotations) {
        if (ann.text.trim().toLowerCase() === normalizedText) {
          const exists = results.some(r => r.content === ann.content)
          if (!exists) {
            results.push({
              content: ann.content,
              articleTitle: article.title,
              articleId: article.id
            })
          }
        }
      }
    }
    
    return results
  }

  return {
    articles,
    folders,
    activeArticles,
    deletedArticles,
    favoriteArticles,
    addArticle,
    updateArticle,
    deleteArticle,
    restoreArticle,
    permanentlyDeleteArticle,
    emptyTrash,
    getArticle,
    toggleFavorite,
    moveArticle,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    checkAnnotationExists,
    addFormat,
    removeFormat,
    addFolder,
    updateFolder,
    deleteFolder,
    reloadArticles,
    reloadFolders,
    findDictionaryEntries
  }
}
