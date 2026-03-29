export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  think: string
  timestamp: number
}

export interface ChatSession {
  id: string
  title: string
  articleId: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  isDefault: boolean
}
