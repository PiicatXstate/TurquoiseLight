export interface Annotation {
  id: string
  startIndex: number
  endIndex: number
  text: string
  content: string
}

export interface TextFormat {
  type: 'bold' | 'underline'
  startIndex: number
  endIndex: number
}

export interface Article {
  id: string
  title: string
  content: string
  annotations: Annotation[]
  formats: TextFormat[]
  folderId: string | null
  isFavorite: boolean
  isDeleted: boolean
  deletedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

export interface ReaderSettings {
  fontSize: number
  letterSpacing: number
  lineHeight: number
  fontFamily: string
  annotationFontSize: number
}

export interface User {
  id: string
  username: string
  createdAt?: number
}

export interface SharedArticle {
  id: string
  title: string
  content: string
  annotations: Annotation[]
  author: string
  authorId: string
  preview?: string
  annotationCount?: number
  likes: number
  downloads: number
  createdAt: number
}
