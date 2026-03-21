import type { Article, Folder, ReaderSettings } from '@/types'

const ARTICLES_KEY = 'turquoise_articles'
const FOLDERS_KEY = 'turquoise_folders'
const SETTINGS_KEY = 'turquoise_settings'

const defaultSettings: ReaderSettings = {
  fontSize: 18,
  letterSpacing: 2,
  lineHeight: 1.8,
  fontFamily: 'serif',
  annotationFontSize: 14
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export function loadArticles(): Article[] {
  try {
    const data = localStorage.getItem(ARTICLES_KEY)
    if (data) {
      const articles = JSON.parse(data)
      return articles.map((a: any) => ({
        ...a,
        folderId: a.folderId || null,
        isFavorite: a.isFavorite || false,
        isDeleted: a.isDeleted || false,
        deletedAt: a.deletedAt || null,
        formats: a.formats || []
      }))
    }
    return []
  } catch {
    return []
  }
}

export function saveArticles(articles: Article[]): void {
  localStorage.setItem(ARTICLES_KEY, JSON.stringify(articles))
}

export function createArticle(title: string, content: string, folderId: string | null = null): Article {
  return {
    id: generateId(),
    title,
    content,
    annotations: [],
    formats: [],
    folderId,
    isFavorite: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

export function loadFolders(): Folder[] {
  try {
    const data = localStorage.getItem(FOLDERS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveFolders(folders: Folder[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function createFolder(name: string, parentId: string | null = null): Folder {
  return {
    id: generateId(),
    name,
    parentId,
    createdAt: Date.now()
  }
}

export function loadSettings(): ReaderSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: ReaderSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export interface ExportData {
  version: string
  exportedAt: number
  articles: Article[]
  folders: Folder[]
  settings: ReaderSettings
}

export function exportData(): ExportData {
  return {
    version: '1.0',
    exportedAt: Date.now(),
    articles: loadArticles(),
    folders: loadFolders(),
    settings: loadSettings()
  }
}

export function importData(data: ExportData): { success: boolean; message: string } {
  try {
    if (!data.version || !data.articles) {
      return { success: false, message: '无效的数据格式' }
    }
    
    if (data.articles) {
      saveArticles(data.articles)
    }
    if (data.folders) {
      saveFolders(data.folders)
    }
    if (data.settings) {
      saveSettings(data.settings)
    }
    
    return { success: true, message: `成功导入 ${data.articles.length} 篇文章` }
  } catch (e) {
    return { success: false, message: '导入失败，请检查文件格式' }
  }
}
