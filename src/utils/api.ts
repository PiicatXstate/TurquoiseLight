import type { User, SharedArticle, Annotation } from '@/types'

const API_BASE = '/api'

interface LoginResponse {
  user: User
  token: string
}

interface ArticlesResponse {
  articles: SharedArticle[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ArticleDetailResponse {
  article: SharedArticle
}

class ApiService {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '请求失败')
    }

    return data
  }

  async register(username: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return response
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return response
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' })
  }

  async verifyAuth(): Promise<{ user: User }> {
    return this.request('/auth/verify')
  }

  async getArticles(page: number = 1, limit: number = 10): Promise<ArticlesResponse> {
    return this.request(`/articles?page=${page}&limit=${limit}`)
  }

  async getArticle(id: string): Promise<ArticleDetailResponse> {
    return this.request(`/articles/${id}`)
  }

  async publishArticle(title: string, content: string, annotations: Annotation[]): Promise<{ article: { id: string; title: string } }> {
    return this.request('/articles', {
      method: 'POST',
      body: JSON.stringify({ title, content, annotations }),
    })
  }

  async deleteArticle(id: string): Promise<void> {
    await this.request(`/articles/${id}`, { method: 'DELETE' })
  }

  async likeArticle(id: string): Promise<{ liked: boolean; likes: number }> {
    return this.request(`/articles/like/${id}`, { method: 'POST' })
  }

  async checkLiked(id: string): Promise<{ liked: boolean }> {
    return this.request(`/articles/like/${id}`)
  }

  async downloadArticle(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/articles/download/${id}`, {
      credentials: 'include',
    })
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || '下载失败')
    }
    
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'article.json'
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^'";]+)['"]?/i)
      if (match) {
        filename = decodeURIComponent(match[1])
      }
    }
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

export const api = new ApiService()
