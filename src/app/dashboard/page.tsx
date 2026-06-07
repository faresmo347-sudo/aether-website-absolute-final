'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAetherStore } from '@/store/aether-store'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { ensureProfile, fetchMemories, fetchCollections, getInitials } from '@/lib/supabase/data'
import { initOfflineDB, getCachedMemories, getCachedCollections, getSyncQueueCount } from '@/lib/offline-db'
import { onSyncStatus, onSyncComplete } from '@/lib/sync-engine'
import AppShell from '@/components/aether/AppShell'
import Dashboard from '@/components/aether/Dashboard'
import { MemoryDetail } from '@/components/aether/MemoryDetail'
import { AskAether } from '@/components/aether/AskAether'
import { Recaps } from '@/components/aether/Recaps'
import { Settings } from '@/components/aether/Settings'
import type { AppView } from '@/components/aether/types'

const Constellations = dynamic(() => import('@/components/aether/Constellations'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <p className="text-[11px] text-muted-foreground">Loading constellation...</p>
    </div>
  ),
})

/* ─────────── App Content Router ─────────── */
function AppContent() {
  const { currentView } = useAetherStore()

  switch (currentView) {
    case 'dashboard':
      return <Dashboard />
    case 'memory-detail':
      return <MemoryDetail />
    case 'ask-aether':
      return <AskAether />
    case 'constellations':
      return <Constellations />
    case 'recaps':
      return <Recaps />
    case 'settings':
      return <Settings />
    default:
      return <Dashboard />
  }
}

/* ─────────── Loading Spinner ─────────── */
function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/20 border-t-[#9D8BA7] animate-spin" />
        <p className="text-xs text-muted-foreground">Loading your memories...</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD PAGE — Protected route for authenticated users

   CRITICAL: The auth gate is BULLETPROOF.
   - We NEVER set authConfirmed=true based on getSession() alone.
   - getUser() MUST validate the session with the Supabase server.
   - Stale/expired sessions are immediately rejected → redirect to /.
   - SIGNED_OUT events clear all state and redirect to /.
   ═══════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const router = useRouter()
  const {
    currentView,
    setCurrentView,
    setUser,
    setProfile,
    setMemories,
    setCollections,
    setIsLoadingMemories,
    setIsSyncing,
    setPendingSyncCount,
    setLastSyncedAt,
    updateMemory,
    setSelectedMemoryId,
    darkMode,
  } = useAetherStore()

  const [authConfirmed, setAuthConfirmed] = useState(false)
  const dataLoadedRef = useRef(false)
  const authInitializedRef = useRef(false)

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
    try {
      localStorage.setItem('aether-theme', darkMode ? 'dark' : 'light')
      localStorage.setItem('aether-dark-mode', String(darkMode))
    } catch {}
  }, [darkMode])

  // Load user data from Supabase
  const loadUserData = useCallback(async (userId: string) => {
    if (dataLoadedRef.current) return
    dataLoadedRef.current = true

    // Load from localStorage cache for instant display
    try {
      const cachedMemories = localStorage.getItem('aether-memories')
      const cachedCollections = localStorage.getItem('aether-collections')
      const cachedProfile = localStorage.getItem('aether-profile')
      if (cachedMemories) {
        const parsed = JSON.parse(cachedMemories)
        if (Array.isArray(parsed) && parsed.length > 0) setMemories(parsed)
      }
      if (cachedCollections) {
        const parsed = JSON.parse(cachedCollections)
        if (Array.isArray(parsed) && parsed.length > 0) setCollections(parsed)
      }
      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile)
        if (parsed && parsed.name) setProfile(parsed)
      }
    } catch {}

    setIsLoadingMemories(true)
    try {
      const profile = await ensureProfile(userId)
      if (profile) {
        setUser(profile)
        setProfile(profile)
      } else {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        const fallbackName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || ''
        const fallbackEmail = authUser?.email || ''
        const fallbackProfile = {
          id: userId, name: fallbackName, email: fallbackEmail,
          initials: getInitials(fallbackName || fallbackEmail), plan: 'free' as const,
        }
        try {
          await supabase.from('profiles').upsert({ id: userId, email: fallbackEmail, name: fallbackName, plan: 'free' }, { onConflict: 'id' })
        } catch {}
        setUser(fallbackProfile)
        setProfile(fallbackProfile)
      }
      try {
        const [memResult, collections] = await Promise.all([fetchMemories(0), fetchCollections()])
        setMemories(memResult.memories)
        setCollections(collections)
      } catch (err) {
        console.warn('Failed to fetch from Supabase, loading from cache:', err)
        try {
          const [cachedMems, cachedCols] = await Promise.all([getCachedMemories(), getCachedCollections()])
          if (cachedMems.length > 0) setMemories(cachedMems)
          if (cachedCols.length > 0) setCollections(cachedCols)
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load user data:', err)
    } finally {
      setIsLoadingMemories(false)
    }
  }, [setUser, setProfile, setMemories, setCollections, setIsLoadingMemories])

  // ── FULL STATE CLEAR on sign-out ──
  const clearAllStateAndRedirect = useCallback(() => {
    dataLoadedRef.current = false
    setAuthConfirmed(false)
    setUser(null)
    setProfile({ name: '', email: '', initials: '' })
    setMemories([])
    setCollections([])
    // Clear localStorage to prevent stale data on next login
    try {
      localStorage.removeItem('aether-memories')
      localStorage.removeItem('aether-collections')
      localStorage.removeItem('aether-profile')
      localStorage.removeItem('aether-view')
    } catch {}
    router.replace('/')
  }, [router, setUser, setProfile, setMemories, setCollections])

  // Auth check + data loading — runs once on mount
  useEffect(() => {
    if (authInitializedRef.current) return
    authInitializedRef.current = true

    // If Supabase isn't configured, redirect to landing
    if (!isSupabaseConfigured()) {
      router.replace('/')
      return
    }

    const supabase = createClient()
    let mounted = true

    const checkAuth = async () => {
      try {
        // Step 1: Fast local check
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (!session?.user) {
          // No local session — redirect immediately
          router.replace('/')
          return
        }

        // Step 2: CRITICAL — Validate with Supabase server.
        // This is the ONLY place we set authConfirmed=true.
        // A stale session cookie will return null from getUser().
        const { data: { user: validatedUser } } = await supabase.auth.getUser()
        if (!mounted) return

        if (!validatedUser) {
          // Stale/expired session — clear and redirect
          try { await supabase.auth.signOut() } catch {}
          clearAllStateAndRedirect()
          return
        }

        // ── SESSION IS VALIDATED ──
        const email = validatedUser.email || ''
        const name = validatedUser.user_metadata?.full_name || validatedUser.user_metadata?.name || email.split('@')[0]
        const initials = getInitials(name || email)
        setUser({ id: validatedUser.id, name, email, initials, plan: 'free' })
        setAuthConfirmed(true)

        // Load user data in the background
        loadUserData(validatedUser.id).catch((err) =>
          console.warn('[Aether] Background data load failed:', err)
        )
      } catch {
        if (mounted) {
          clearAllStateAndRedirect()
        }
      }
    }

    checkAuth()

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION') return // Already handled in checkAuth

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        // Fresh sign-in or token refresh
        dataLoadedRef.current = false
        const email = session.user.email || ''
        const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0]
        const initials = getInitials(name || email)
        setUser({ id: session.user.id, name, email, initials, plan: 'free' })
        setAuthConfirmed(true)
        loadUserData(session.user.id).catch((err) =>
          console.warn('[Aether] Background data load failed:', err)
        )
      } else if (event === 'SIGNED_OUT') {
        // ── SIGN OUT: Clear everything and redirect ──
        clearAllStateAndRedirect()
      }
    })

    // Initialize offline DB
    initOfflineDB().catch((err) => console.warn('Failed to init offline DB:', err))

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Listen for sync events
    const unsubStatus = onSyncStatus((status) => setIsSyncing(status === 'syncing'))
    const unsubComplete = onSyncComplete((result) => {
      getSyncQueueCount().then(setPendingSyncCount)
      if (result.synced > 0) setLastSyncedAt(new Date().toISOString())
    })

    const handleMemorySynced = ((e: CustomEvent) => {
      const { tempId, realId, memory } = e.detail
      updateMemory(tempId, { id: realId, syncStatus: 'synced', ...memory })
    }) as EventListener
    window.addEventListener('aether:memory-synced', handleMemorySynced)

    return () => {
      mounted = false
      subscription.unsubscribe()
      unsubStatus()
      unsubComplete()
      window.removeEventListener('aether:memory-synced', handleMemorySynced)
    }
  }, [clearAllStateAndRedirect, loadUserData, setCurrentView, setSelectedMemoryId, setIsSyncing, setPendingSyncCount, setLastSyncedAt, updateMemory])

  // URL-based navigation: read the current URL path to determine which view to show
  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '')

    const urlToViewMap: Record<string, AppView> = {
      '/dashboard': 'dashboard',
      '/ask': 'ask-aether',
      '/collections': 'constellations',
      '/constellations': 'constellations',
      '/recaps': 'recaps',
      '/settings': 'settings',
    }

    const view = urlToViewMap[path]
    if (view) {
      setCurrentView(view)
      return
    }

    if (path.startsWith('/memory/')) {
      const memoryId = path.replace('/memory/', '')
      if (memoryId) {
        setSelectedMemoryId(memoryId)
        setCurrentView('memory-detail')
      }
    }
  }, [setCurrentView, setSelectedMemoryId])

  // If auth hasn't been confirmed yet, show loading
  if (!authConfirmed) {
    return <LoadingSpinner />
  }

  return (
    <AppShell>
      <AppContent />
    </AppShell>
  )
}
