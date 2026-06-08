'use client'

import { ReactNode, memo, useEffect, useCallback } from 'react'
import { Settings, WifiOff, Cloud, CheckCircle2, Sun, Moon, LogOut } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { signOut } from '@/lib/supabase/data'
import { getSyncQueueCount } from '@/lib/offline-db'

/* ─────────── Theme Toggle Component ─────────── */
function ThemeToggle() {
  const { darkMode, setDarkMode } = useAetherStore()

  const handleToggle = useCallback(() => {
    const newDark = !darkMode
    setDarkMode(newDark)
    if (newDark) {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
    try {
      localStorage.setItem('aether-theme', newDark ? 'dark' : 'light')
      localStorage.setItem('aether-dark-mode', String(newDark))
    } catch {}
  }, [darkMode, setDarkMode])

  return (
    <button
      onClick={handleToggle}
      className="cursor-pointer relative flex items-center w-[44px] h-[24px] rounded-full transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9D8BA7]/40"
      style={{
        background: darkMode
          ? 'rgba(157, 139, 167, 0.2)'
          : 'rgba(157, 139, 167, 0.15)',
      }}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className="absolute top-[2px] flex items-center justify-center w-[20px] h-[20px] rounded-full transition-all duration-300 ease-in-out shadow-md"
        style={{
          left: darkMode ? '22px' : '2px',
          background: darkMode
            ? 'linear-gradient(135deg, #9D8BA7, #c084fc)'
            : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        }}
      >
        {darkMode ? (
          <Sun size={11} className="text-white" strokeWidth={2.5} />
        ) : (
          <Moon size={11} className="text-amber-900" strokeWidth={2.5} />
        )}
      </span>
    </button>
  )
}

/* ─────────── Offline Banner ─────────── */
function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const { isSyncing, pendingSyncCount, setIsOnline, setIsSyncing, setPendingSyncCount, darkMode } = useAetherStore()

  useEffect(() => {
    setIsOnline(isOnline)
    if (isOnline) {
      getSyncQueueCount().then(setPendingSyncCount)
    }
  }, [isOnline, setIsOnline, setPendingSyncCount])

  if (isOnline && !isSyncing && pendingSyncCount === 0) return null

  if (!isOnline) {
    return (
      <div className={`border-b px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-amber-500 ${darkMode ? 'bg-[#0F0E17] border-white/[0.04]' : 'bg-amber-50 border-amber-200'}`}>
        <WifiOff size={12} className="shrink-0" />
        <span>Offline — showing cached memories</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className={`border-b px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-[#c084fc] ${darkMode ? 'bg-[#c084fc]/5 border-white/[0.04]' : 'bg-[#9D8BA7]/5 border-[#9D8BA7]/10'}`}>
        <Cloud size={12} className="shrink-0 animate-pulse" />
        <span>Syncing...</span>
      </div>
    )
  }

  if (pendingSyncCount > 0) {
    return (
      <div className={`border-b px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-emerald-600 ${darkMode ? 'bg-[#0F0E17] border-white/[0.04] text-emerald-400' : 'bg-emerald-50 border-emerald-200'}`}>
        <CheckCircle2 size={12} className="shrink-0" />
        <span>{pendingSyncCount} queued</span>
      </div>
    )
  }

  return null
}

/* ─────────── Main AppShell Component ─────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const { darkMode, profile, user, setCurrentView } = useAetherStore()

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
    } catch {}
    // Clear all state
    useAetherStore.getState().setSignedOut(true)
    try {
      localStorage.removeItem('aether-memories')
      localStorage.removeItem('aether-collections')
      localStorage.removeItem('aether-profile')
      localStorage.removeItem('aether-view')
    } catch {}
    window.location.href = '/'
  }, [])

  const initials = profile?.initials || user?.initials || '?'

  return (
    <div className="h-[100dvh] md:h-screen bg-deep-space text-foreground flex flex-col overflow-hidden max-w-screen overflow-x-hidden">
      {/* ─── Minimal Top Bar — Logo left, Settings + Avatar right ─── */}
      <header
        className="shrink-0 flex items-center justify-between px-4 md:px-6 h-12 z-30 border-b"
        style={{
          background: darkMode ? 'rgba(5, 5, 16, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
        }}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className={`font-serif text-sm font-semibold tracking-tight ${darkMode ? 'text-white/70' : 'text-gray-700'}`}>
            Aether
          </span>
        </div>

        {/* Right: Theme + Settings + Avatar — NO search bar */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* Settings */}
          <button
            onClick={() => setCurrentView('settings')}
            className={`cursor-pointer p-2 rounded-lg transition-all duration-200 haptic-press ${
              darkMode
                ? 'text-white/25 hover:text-white/50 hover:bg-white/5'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>

          {/* Avatar */}
          <button
            onClick={() => setCurrentView('settings')}
            className="cursor-pointer h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 hover:opacity-80 haptic-press"
            style={{
              background: 'linear-gradient(135deg, #9D8BA7, #7c3aed)',
              color: 'white',
            }}
            aria-label="Profile"
          >
            {initials}
          </button>
        </div>
      </header>

      {/* Offline/Sync Banner */}
      <OfflineBanner />

      {/* Content Area */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
