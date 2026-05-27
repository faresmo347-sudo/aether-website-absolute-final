import { create } from 'zustand'
import type { AppView, Memory, CaptureTab, RecapView, ChatMessage, UserProfile, Collection } from '@/components/aether/types'

interface AetherState {
  // Auth
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void
  isAuthenticated: boolean
  authScreen: 'signup' | 'signin' | 'forgot'
  setAuthScreen: (screen: 'signup' | 'signin' | 'forgot') => void
  isSessionLoading: boolean
  setIsSessionLoading: (v: boolean) => void

  // Navigation
  currentView: AppView
  setCurrentView: (view: AppView) => void

  // Memories
  memories: Memory[]
  setMemories: (memories: Memory[]) => void
  addMemory: (memory: Memory) => void
  deleteMemory: (id: string) => void
  updateMemory: (id: string, updates: Partial<Memory>) => void
  selectedMemoryId: string | null
  setSelectedMemoryId: (id: string | null) => void

  // Collections
  collections: Collection[]
  setCollections: (collections: Collection[]) => void
  addCollection: (collection: Collection) => void

  // Quick Capture
  captureModalOpen: boolean
  setCaptureModalOpen: (open: boolean) => void
  activeCaptureTab: CaptureTab
  setActiveCaptureTab: (tab: CaptureTab) => void

  // Search / Filter
  searchQuery: string
  setSearchQuery: (q: string) => void
  activeFilter: string
  setActiveFilter: (f: string) => void

  // Collection Filter
  collectionFilter: string | null
  setCollectionFilter: (id: string | null) => void

  // Chat
  chatMessages: ChatMessage[]
  addChatMessage: (msg: ChatMessage) => void
  clearChatMessages: () => void
  isChatThinking: boolean
  setChatThinking: (v: boolean) => void

  // Recaps
  recapView: RecapView
  setRecapView: (v: RecapView) => void

  // Settings
  dailySummary: boolean
  setDailySummary: (v: boolean) => void
  weeklyRecap: boolean
  setWeeklyRecap: (v: boolean) => void
  autoTagging: boolean
  setAutoTagging: (v: boolean) => void
  defaultCapture: CaptureTab
  setDefaultCapture: (v: CaptureTab) => void
  darkMode: boolean
  setDarkMode: (v: boolean) => void

  // Profile
  profile: UserProfile
  setProfile: (p: UserProfile) => void

  // Loading states
  isLoadingMemories: boolean
  setIsLoadingMemories: (v: boolean) => void
  isLoadingCollections: boolean
  setIsLoadingCollections: (v: boolean) => void

  // Pagination
  memoriesPage: number
  hasMoreMemories: boolean
  setHasMoreMemories: (v: boolean) => void
  incrementPage: () => void
  resetPage: () => void
  appendMemories: (memories: Memory[]) => void

  // ─── Offline / Sync State ───
  isOnline: boolean
  setIsOnline: (v: boolean) => void
  isSyncing: boolean
  setIsSyncing: (v: boolean) => void
  pendingSyncCount: number
  setPendingSyncCount: (v: number) => void
  lastSyncedAt: string | null
  setLastSyncedAt: (v: string | null) => void
  showOfflineBanner: boolean
  setShowOfflineBanner: (v: boolean) => void
}

export const useAetherStore = create<AetherState>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  isAuthenticated: false,
  authScreen: 'signin',
  setAuthScreen: (screen) => set({ authScreen: screen }),
  isSessionLoading: false, // Start false — landing page shows immediately, auth check runs in background
  setIsSessionLoading: (v) => set({ isSessionLoading: v }),

  // Navigation
  currentView: 'landing',
  setCurrentView: (view) => set({ currentView: view }),

  // Memories
  memories: [],
  setMemories: (memories) => set({ memories }),
  addMemory: (memory) => set((s) => ({ memories: [memory, ...s.memories] })),
  deleteMemory: (id) => set((s) => ({ memories: s.memories.filter((m) => m.id !== id) })),
  updateMemory: (id, updates) => set((s) => ({
    memories: s.memories.map((m) => m.id === id ? { ...m, ...updates } : m),
  })),
  selectedMemoryId: null,
  setSelectedMemoryId: (id) => set({ selectedMemoryId: id }),

  // Collections
  collections: [
    { id: 'col-work', name: 'Work', icon: 'briefcase', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
    { id: 'col-ideas', name: 'Ideas', icon: 'lightbulb', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
    { id: 'col-travel', name: 'Travel', icon: 'plane', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
    { id: 'col-books', name: 'Books', icon: 'book-open', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
  ],
  setCollections: (collections) => set({ collections }),
  addCollection: (collection) => set((s) => ({ collections: [...s.collections, collection] })),

  // Quick Capture
  captureModalOpen: false,
  setCaptureModalOpen: (open) => set({ captureModalOpen: open }),
  activeCaptureTab: 'text',
  setActiveCaptureTab: (tab) => set({ activeCaptureTab: tab }),

  // Search / Filter
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  activeFilter: 'All',
  setActiveFilter: (f) => set({ activeFilter: f }),

  // Collection Filter
  collectionFilter: null,
  setCollectionFilter: (id) => set({ collectionFilter: id }),

  // Chat
  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChatMessages: () => set({ chatMessages: [] }),
  isChatThinking: false,
  setChatThinking: (v) => set({ isChatThinking: v }),

  // Recaps
  recapView: 'daily',
  setRecapView: (v) => set({ recapView: v }),

  // Settings
  dailySummary: true,
  setDailySummary: (v) => set({ dailySummary: v }),
  weeklyRecap: true,
  setWeeklyRecap: (v) => set({ weeklyRecap: v }),
  autoTagging: true,
  setAutoTagging: (v) => set({ autoTagging: v }),
  defaultCapture: 'text',
  setDefaultCapture: (v) => set({ defaultCapture: v }),
  darkMode: typeof window !== 'undefined' ? localStorage.getItem('aether-dark-mode') === 'true' : false,
  setDarkMode: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('aether-dark-mode', String(v))
    set({ darkMode: v })
  },

  // Profile
  profile: { name: '', email: '', initials: '' },
  setProfile: (p) => set({ profile: p }),

  // Loading states
  isLoadingMemories: false,
  setIsLoadingMemories: (v) => set({ isLoadingMemories: v }),
  isLoadingCollections: false,
  setIsLoadingCollections: (v) => set({ isLoadingCollections: v }),

  // Pagination
  memoriesPage: 0,
  hasMoreMemories: true,
  setHasMoreMemories: (v) => set({ hasMoreMemories: v }),
  incrementPage: () => set((s) => ({ memoriesPage: s.memoriesPage + 1 })),
  resetPage: () => set({ memoriesPage: 0, hasMoreMemories: true }),
  appendMemories: (newMemories) => set((s) => ({ memories: [...s.memories, ...newMemories] })),

  // ─── Offline / Sync State ───
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  setIsOnline: (v) => set({ isOnline: v }),
  isSyncing: false,
  setIsSyncing: (v) => set({ isSyncing: v }),
  pendingSyncCount: 0,
  setPendingSyncCount: (v) => set({ pendingSyncCount: v }),
  lastSyncedAt: null,
  setLastSyncedAt: (v) => set({ lastSyncedAt: v }),
  showOfflineBanner: false,
  setShowOfflineBanner: (v) => set({ showOfflineBanner: v }),
}))
