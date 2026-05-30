import { create } from 'zustand'
import type { AppView, Memory, CaptureTab, RecapView, ChatMessage, UserProfile, Collection } from '@/components/aether/types'

/* ─────────── localStorage Persistence Helpers ─────────── */

const STORAGE_KEYS = {
  settings: 'aether-settings',
  memories: 'aether-memories',
  collections: 'aether-collections',
  chatMessages: 'aether-chat',
  profile: 'aether-profile',
  currentView: 'aether-view',
  authScreen: 'aether-auth-screen',
}

// Debounced localStorage writes to avoid excessive I/O
const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()

function persistToStorage(key: string, data: unknown) {
  // SSR guard: localStorage is only available in the browser
  if (typeof window === 'undefined') return
  // Debounce: only write after 300ms of no changes
  if (pendingWrites.has(key)) {
    clearTimeout(pendingWrites.get(key)!)
  }
  pendingWrites.set(key, setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (e) {
      // localStorage might be full or unavailable
      console.warn(`[Aether] Failed to persist ${key}:`, e)
    }
    pendingWrites.delete(key)
  }, 300))
}

function loadFromStorage<T>(key: string, fallback: T): T {
  // SSR guard: localStorage is only available in the browser
  if (typeof window === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as T
    }
  } catch {
    // Corrupted data — try to clear it safely
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
      }
    } catch {}
  }
  return fallback
}

// Load initial values from localStorage for instant hydration
const initialSettings = loadFromStorage<{
  darkMode: boolean
  dailySummary: boolean
  weeklyRecap: boolean
  autoTagging: boolean
  defaultCapture: CaptureTab
}>(STORAGE_KEYS.settings, {
  darkMode: false,
  dailySummary: true,
  weeklyRecap: true,
  autoTagging: true,
  defaultCapture: 'text' as CaptureTab,
})

const initialMemories = loadFromStorage<Memory[]>(STORAGE_KEYS.memories, [])
const initialCollections = loadFromStorage<Collection[]>(STORAGE_KEYS.collections, [
  { id: 'col-work', name: 'Work', icon: 'briefcase', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
  { id: 'col-ideas', name: 'Ideas', icon: 'lightbulb', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
  { id: 'col-travel', name: 'Travel', icon: 'plane', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
  { id: 'col-books', name: 'Books', icon: 'book-open', memoryCount: 0, lastUpdated: new Date().toISOString().split('T')[0], color: '#9D8BA7' },
])
const initialChatMessages = loadFromStorage<ChatMessage[]>(STORAGE_KEYS.chatMessages, [])
const initialProfile = loadFromStorage<UserProfile>(STORAGE_KEYS.profile, { name: '', email: '', initials: '' })
const initialCurrentView = loadFromStorage<AppView>(STORAGE_KEYS.currentView, 'landing')

/* ─────────── Store Interface ─────────── */

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

  // Tag Filter
  tagFilter: string | null
  setTagFilter: (tag: string | null) => void

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

export const useAetherStore = create<AetherState>((set, get) => ({
  // Auth
  user: null,
  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
    if (user?.id) {
      persistToStorage(STORAGE_KEYS.profile, user)
    }
  },
  isAuthenticated: false,
  authScreen: 'signin',
  setAuthScreen: (screen) => set({ authScreen: screen }),
  isSessionLoading: false, // Start false — landing page shows immediately, auth check runs in background
  setIsSessionLoading: (v) => set({ isSessionLoading: v }),

  // Navigation — hydrated from localStorage so users return to their last view
  currentView: initialCurrentView,
  setCurrentView: (view) => {
    set({ currentView: view })
    persistToStorage(STORAGE_KEYS.currentView, view)
  },

  // Memories — hydrated from localStorage for instant display
  memories: initialMemories,
  setMemories: (memories) => {
    set({ memories })
    persistToStorage(STORAGE_KEYS.memories, memories)
  },
  addMemory: (memory) => {
    const updated = [memory, ...get().memories]
    set({ memories: updated })
    persistToStorage(STORAGE_KEYS.memories, updated)
  },
  deleteMemory: (id) => {
    const updated = get().memories.filter((m) => m.id !== id)
    set({ memories: updated })
    persistToStorage(STORAGE_KEYS.memories, updated)
  },
  updateMemory: (id, updates) => {
    const updated = get().memories.map((m) => m.id === id ? { ...m, ...updates } : m)
    set({ memories: updated })
    persistToStorage(STORAGE_KEYS.memories, updated)
  },
  selectedMemoryId: null,
  setSelectedMemoryId: (id) => set({ selectedMemoryId: id }),

  // Collections — hydrated from localStorage
  collections: initialCollections,
  setCollections: (collections) => {
    set({ collections })
    persistToStorage(STORAGE_KEYS.collections, collections)
  },
  addCollection: (collection) => {
    const updated = [...get().collections, collection]
    set({ collections: updated })
    persistToStorage(STORAGE_KEYS.collections, updated)
  },

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

  // Tag Filter
  tagFilter: null,
  setTagFilter: (tag) => set({ tagFilter: tag }),

  // Chat — hydrated from localStorage
  chatMessages: initialChatMessages,
  addChatMessage: (msg) => {
    const updated = [...get().chatMessages, msg]
    set({ chatMessages: updated })
    persistToStorage(STORAGE_KEYS.chatMessages, updated)
  },
  clearChatMessages: () => {
    set({ chatMessages: [] })
    persistToStorage(STORAGE_KEYS.chatMessages, [])
  },
  isChatThinking: false,
  setChatThinking: (v) => set({ isChatThinking: v }),

  // Recaps
  recapView: 'daily',
  setRecapView: (v) => set({ recapView: v }),

  // Settings — hydrated from localStorage for instant restore
  dailySummary: initialSettings.dailySummary,
  setDailySummary: (v) => {
    set({ dailySummary: v })
    persistToStorage(STORAGE_KEYS.settings, { ...getSettingsSnapshot(get()), dailySummary: v })
  },
  weeklyRecap: initialSettings.weeklyRecap,
  setWeeklyRecap: (v) => {
    set({ weeklyRecap: v })
    persistToStorage(STORAGE_KEYS.settings, { ...getSettingsSnapshot(get()), weeklyRecap: v })
  },
  autoTagging: initialSettings.autoTagging,
  setAutoTagging: (v) => {
    set({ autoTagging: v })
    persistToStorage(STORAGE_KEYS.settings, { ...getSettingsSnapshot(get()), autoTagging: v })
  },
  defaultCapture: initialSettings.defaultCapture,
  setDefaultCapture: (v) => {
    set({ defaultCapture: v })
    persistToStorage(STORAGE_KEYS.settings, { ...getSettingsSnapshot(get()), defaultCapture: v })
  },
  darkMode: initialSettings.darkMode,
  setDarkMode: (v) => {
    if (typeof window !== 'undefined') localStorage.setItem('aether-dark-mode', String(v))
    set({ darkMode: v })
    persistToStorage(STORAGE_KEYS.settings, { ...getSettingsSnapshot(get()), darkMode: v })
  },

  // Profile — hydrated from localStorage
  profile: initialProfile,
  setProfile: (p) => {
    set({ profile: p })
    persistToStorage(STORAGE_KEYS.profile, p)
  },

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
  appendMemories: (newMemories) => {
    const updated = [...get().memories, ...newMemories]
    set({ memories: updated })
    persistToStorage(STORAGE_KEYS.memories, updated)
  },

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

/* ─────────── Helper: get settings snapshot ─────────── */
function getSettingsSnapshot(state: AetherState) {
  return {
    darkMode: state.darkMode,
    dailySummary: state.dailySummary,
    weeklyRecap: state.weeklyRecap,
    autoTagging: state.autoTagging,
    defaultCapture: state.defaultCapture,
  }
}
