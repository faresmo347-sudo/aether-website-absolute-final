export type MemoryType = 'text' | 'voice' | 'link' | 'image'

export interface Memory {
  id: string
  type: MemoryType
  title: string
  content: string
  tags: string[]
  createdAt: string
  source?: string
  aiSummary?: string
  aiInsight?: string
  collectionId?: string
  imagePreview?: string
  // Tagging status for optimistic UI
  taggingStatus?: 'pending' | 'tagging' | 'complete'
  // Sync status for offline-first
  syncStatus?: 'synced' | 'pending' | 'syncing'
  // Supabase fields
  userId?: string
  summary?: string
  sourceUrl?: string
  fileUrl?: string
  updatedAt?: string
}

export interface Collection {
  id: string
  name: string
  icon: string
  memoryCount: number
  lastUpdated: string
  color: string
  // Supabase fields
  userId?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  referencedMemories?: string[]
  sourcesCount?: number
  detectedMode?: 'memory-search' | 'conversation' | 'both'
  confidence?: 'high' | 'medium' | 'low'
  timestamp: string
}

export type AppView = 
  | 'landing' 
  | 'signup' 
  | 'signin' 
  | 'forgot-password'
  | 'dashboard' 
  | 'memory-detail' 
  | 'ask-aether' 
  | 'collections' 
  | 'recaps' 
  | 'settings'
  | 'constellations'

export type CaptureTab = 'text' | 'voice' | 'link' | 'image'

export type RecapView = 'daily' | 'weekly'

export interface UserProfile {
  id?: string
  name: string
  email: string
  initials: string
  avatarUrl?: string
  plan?: 'free' | 'pro'
}
