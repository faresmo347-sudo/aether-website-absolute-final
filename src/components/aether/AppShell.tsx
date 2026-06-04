'use client'

import { ReactNode, memo, useMemo, useEffect, useCallback } from 'react'
import { Settings, Plus, WifiOff, Cloud, CheckCircle2, Sparkles, CalendarDays, Sun, Moon, Home, Brain, Search } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { AetherLogo } from '@/components/aether/AetherLogo'
import type { AppView } from '@/components/aether/types'
import { getSyncQueueCount } from '@/lib/offline-db'

/* ─────────── Navigation Configuration ─────────── */
interface NavItem {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  view: AppView | 'capture'
}

const desktopNavItems: NavItem[] = [
  { label: 'Home', icon: Home, view: 'dashboard' },
  { label: 'Ask Aether', icon: Brain, view: 'ask-aether' },
  { label: 'Constellations', icon: Sparkles, view: 'constellations' },
  { label: 'Recaps', icon: CalendarDays, view: 'recaps' },
  { label: 'Settings', icon: Settings, view: 'settings' },
]

/* Mobile bottom nav: 4 nav items + center FAB */
const mobileNavItems: NavItem[] = [
  { label: 'Home', icon: Home, view: 'dashboard' },
  { label: 'Search', icon: Search, view: 'ask-aether' },
  { label: 'Capture', icon: Plus, view: 'capture' },
  { label: 'Explore', icon: Sparkles, view: 'constellations' },
  { label: 'Settings', icon: Settings, view: 'settings' },
]

/* SVG icon map for reliable mobile bottom nav rendering */
const navIconSvgs: Record<string, (color: string) => React.ReactNode> = {
  dashboard: (color) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  ),
  'ask-aether': (color) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  constellations: (color) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
  ),
  settings: (color) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
}

/* ─────────── Desktop Sidebar Icon Map ─────────── */
const desktopIconSvgs: Record<string, (isActive: boolean) => React.ReactNode> = {
  dashboard: (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isActive ? '#9D8BA7' : 'none'} stroke={isActive ? '#9D8BA7' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  ),
  'ask-aether': (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isActive ? '#9D8BA7' : 'none'} stroke={isActive ? '#9D8BA7' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>
  ),
  recaps: (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isActive ? '#9D8BA7' : 'none'} stroke={isActive ? '#9D8BA7' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
  ),
  constellations: (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isActive ? '#9D8BA7' : 'none'} stroke={isActive ? '#9D8BA7' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
  ),
  settings: (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isActive ? '#9D8BA7' : 'none'} stroke={isActive ? '#9D8BA7' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1-1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
}

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
      className="cursor-pointer relative flex items-center w-[52px] h-[28px] rounded-full transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9D8BA7]/40"
      style={{
        background: darkMode
          ? 'rgba(157, 139, 167, 0.2)'
          : 'rgba(157, 139, 167, 0.15)',
      }}
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span
        className="absolute top-[2px] flex items-center justify-center w-[24px] h-[24px] rounded-full transition-all duration-300 ease-in-out shadow-md"
        style={{
          left: darkMode ? '26px' : '2px',
          background: darkMode
            ? 'linear-gradient(135deg, #9D8BA7, #c084fc)'
            : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        }}
      >
        {darkMode ? (
          <Sun size={13} className="text-white" strokeWidth={2.5} />
        ) : (
          <Moon size={13} className="text-amber-900" strokeWidth={2.5} />
        )}
      </span>
    </button>
  )
}

/* ─────────── Sidebar Nav Item (Desktop) — Icons Only ─────────── */
const SidebarNavItem = memo(function SidebarNavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  const svgIcon = desktopIconSvgs[item.view]

  return (
    <button
      onClick={onClick}
      className="cursor-pointer group relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200"
      aria-label={item.label}
      title={item.label}
    >
      {isActive && (
        <span
          className="absolute inset-0 rounded-full transition-all duration-300"
          style={{
            background: 'rgba(157, 139, 167, 0.15)',
            boxShadow: '0 0 12px rgba(157, 139, 167, 0.25), 0 0 4px rgba(157, 139, 167, 0.15)',
          }}
        />
      )}
      <span
        className="relative z-10 transition-all duration-200"
        style={isActive ? { filter: 'drop-shadow(0 0 6px #9D8BA7)' } : undefined}
      >
        {svgIcon ? svgIcon(isActive) : <item.icon size={20} />}
      </span>
    </button>
  )
})

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
      <div className={`border-b px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-500 ${darkMode ? 'bg-[#1e1c29] border-[#9D8BA7]/10' : 'bg-amber-50 border-amber-200'}`}>
        <WifiOff size={14} className="shrink-0" />
        <span>You are offline — showing cached memories</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className={`border-b px-4 py-2 flex items-center justify-center gap-2 text-xs text-[#9D8BA7] ${darkMode ? 'bg-[#9D8BA7]/5 border-[#9D8BA7]/10' : 'bg-[#9D8BA7]/5 border-[#9D8BA7]/10'}`}>
        <Cloud size={14} className="shrink-0 animate-pulse" />
        <span>Syncing your memories...</span>
      </div>
    )
  }

  if (pendingSyncCount > 0) {
    return (
      <div className={`border-b px-4 py-2 flex items-center justify-center gap-2 text-xs text-emerald-600 ${darkMode ? 'bg-[#1e1c29] border-[#9D8BA7]/10 text-emerald-400' : 'bg-emerald-50 border-emerald-200'}`}>
        <CheckCircle2 size={14} className="shrink-0" />
        <span>{pendingSyncCount} memories queued to sync</span>
      </div>
    )
  }

  return null
}

/* ─────────── Main AppShell Component ─────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const { currentView, setCurrentView, setCaptureModalOpen, darkMode, profile, user } = useAetherStore()
  const isKeyboardOpen = useMobileKeyboard()

  // Determine which nav item is active
  const activeNavView = useMemo((): AppView => {
    if (currentView === 'memory-detail') return 'dashboard'
    if (currentView === 'landing') return 'dashboard'
    if (currentView === 'signup') return 'dashboard'
    if (currentView === 'signin') return 'dashboard'
    if (currentView === 'forgot-password') return 'dashboard'
    return currentView
  }, [currentView])

  // Sidebar background based on theme
  const sidebarBg = darkMode
    ? 'rgba(10, 10, 15, 0.8)'
    : 'rgba(255, 255, 255, 0.7)'

  const sidebarBorder = darkMode
    ? 'rgba(157, 139, 167, 0.08)'
    : 'rgba(157, 139, 167, 0.12)'

  return (
    <div className="h-[100dvh] md:h-screen bg-background text-foreground flex overflow-hidden max-w-screen overflow-x-hidden">
      {/* ─── Left Sidebar (Desktop ONLY) ─── */}
      <aside
        className="hidden md:flex md:flex-col md:w-[72px] fixed inset-y-0 left-0 z-40 items-center"
        style={{
          background: sidebarBg,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: `1px solid ${sidebarBorder}`,
        }}
      >
        {/* Logo at top */}
        <div className="flex items-center justify-center py-5">
          <AetherLogo size={36} />
        </div>

        <div className="w-8 h-px mb-2" style={{ background: sidebarBorder }} />

        <nav className="flex-1 flex flex-col items-center gap-2 py-4 overflow-y-auto scrollbar-none">
          {desktopNavItems.map((item) => (
            <SidebarNavItem
              key={item.view}
              item={item}
              isActive={activeNavView === item.view}
              onClick={() => setCurrentView(item.view as AppView)}
            />
          ))}
        </nav>

        <div className="w-8 h-px mb-3" style={{ background: sidebarBorder }} />

        <div className="pb-5 flex flex-col items-center gap-3">
          <div className="hidden md:flex">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <div className="flex-1 md:pl-[72px] flex flex-col h-[100dvh] md:h-screen overflow-hidden">
        {/* Offline/Sync Banner */}
        <OfflineBanner />

        {/* ─── MOBILE: NO separate header — each view handles its own ─── */}

        {/* ─── DESKTOP Header — Hero Search Bar ─── */}
        <header
          className="hidden md:flex shrink-0 z-30 items-center justify-center backdrop-blur-xl border-b"
          style={{
            background: darkMode ? 'rgba(10, 10, 15, 0.6)' : 'rgba(255, 255, 255, 0.7)',
            borderColor: sidebarBorder,
            height: '60px',
          }}
        >
          <div className="animate-gradient-border p-[2px] rounded-2xl max-w-2xl w-full mx-6">
            <button
              onClick={() => setCurrentView('ask-aether')}
              className="cursor-pointer w-full flex items-center gap-3 rounded-[14px] px-5 py-2.5 text-sm transition-all duration-200 group min-h-[44px]"
              style={{
                background: darkMode ? 'rgba(10, 10, 15, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
              aria-label="Search memories"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[#9D8BA7]/60 group-hover:text-[#9D8BA7] transition-colors duration-150"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <span className={`truncate flex-1 text-left ${darkMode ? 'text-[rgba(240,240,248,0.4)]' : 'text-[rgba(0,0,0,0.35)]'}`}>
                What do you need to remember?
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-md border flex-shrink-0"
                style={{
                  borderColor: sidebarBorder,
                  color: darkMode ? 'rgba(240,240,248,0.25)' : 'rgba(0,0,0,0.25)',
                }}
              >
                ⌘K
              </span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className={`flex-1 min-h-0 flex flex-col overflow-hidden ${isKeyboardOpen ? 'pb-4' : 'mobile-bottom-pad'}`}>
          {children}
        </main>
      </div>

      {/* ─── Desktop FAB ─── */}
      <button
        onClick={() => setCaptureModalOpen(true)}
        className="cursor-pointer hidden md:flex fixed z-40 bottom-8 right-8 h-12 w-12 rounded-full items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 animate-capture-button-pulse"
        style={{
          background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(157, 139, 167, 0.4), 0 0 0 0 rgba(157, 139, 167, 0)',
        }}
        aria-label="Quick capture"
      >
        <Plus size={22} className="stroke-[2.5] text-white" />
      </button>

      {/* ═══════════════════════════════════════════════════════════
         MOBILE BOTTOM NAV — glassmorphic + center FAB
         Hidden when mobile keyboard is open to prevent overlap
         ═══════════════════════════════════════════════════════════ */}
      <nav
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-md transition-transform duration-200 ${isKeyboardOpen ? 'translate-y-full' : 'translate-y-0'}`}
        style={{
          background: darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.85)',
          borderColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="relative flex items-center justify-around h-16 px-2">
          {mobileNavItems.map((item) => {
            const isCapture = item.view === 'capture'

            // ─── CENTER FAB: Large glowing capture button ───
            if (isCapture) {
              return (
                <button
                  key="capture-fab"
                  onClick={() => setCaptureModalOpen(true)}
                  className="relative -mt-6 cursor-pointer flex items-center justify-center transition-transform duration-150 active:scale-90 z-50"
                  style={{ width: '20%' }}
                  aria-label="Capture new memory"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #9D8BA7, #c084fc)', boxShadow: '0 4px 20px rgba(157, 139, 167, 0.5)' }}
                  >
                    <Plus size={24} className="text-white" strokeWidth={2.5} />
                  </div>
                </button>
              )
            }

            // ─── Regular nav items ───
            const isActive = activeNavView === item.view
            const activeColor = '#9D8BA7'
            const inactiveColor = darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'
            const iconColor = isActive ? activeColor : inactiveColor
            const svgIcon = navIconSvgs[item.view as string]

            return (
              <button
                key={item.view}
                onClick={() => setCurrentView(item.view as AppView)}
                className={`cursor-pointer flex flex-col items-center justify-center transition-all duration-150 ${isActive ? '' : 'active:opacity-60'}`}
                style={{
                  width: '20%',
                  height: '100%',
                  color: iconColor,
                }}
                aria-label={item.label}
              >
                <span className={`transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                  {svgIcon ? svgIcon(iconColor) : <item.icon size={22} className="transition-colors duration-150" />}
                </span>
                <span
                  className="text-[10px] mt-0.5 font-medium transition-colors duration-150"
                  style={{ color: iconColor }}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
