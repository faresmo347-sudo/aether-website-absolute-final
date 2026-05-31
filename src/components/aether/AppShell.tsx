'use client'

import { ReactNode, memo, useMemo, useEffect } from 'react'
import { Brain, FolderOpen, Settings, Search, Plus, Home, WifiOff, Cloud, CheckCircle2, Sparkles } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AetherLogo } from '@/components/aether/AetherLogo'
import type { AppView } from '@/components/aether/types'
import { getSyncQueueCount } from '@/lib/offline-db'

/* ─────────── Capture Pulse Animation Styles ─────────── */
const pulseStyles = `
@keyframes capture-pulse {
  0%, 100% {
    box-shadow: 0 4px 24px rgba(157,139,167,0.4), 0 0 0 0 rgba(157,139,167,0.4);
  }
  50% {
    box-shadow: 0 4px 24px rgba(157,139,167,0.4), 0 0 0 8px rgba(157,139,167,0);
  }
}
.animate-capture-pulse {
  animation: capture-pulse 3s ease-in-out infinite;
}
`

/* ─────────── Navigation Configuration ─────────── */
interface NavItem {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  view: AppView
  isCapture?: boolean
}

const desktopNavItems: NavItem[] = [
  { label: 'Home', icon: Home, view: 'dashboard' },
  { label: 'Ask Aether', icon: Brain, view: 'ask-aether' },
  { label: 'Collections', icon: FolderOpen, view: 'collections' },
  { label: 'Settings', icon: Settings, view: 'settings' },
]

const mobileNavItems: NavItem[] = [
  { label: 'Home', icon: Home, view: 'dashboard' },
  { label: 'Ask', icon: Brain, view: 'ask-aether' },
  { label: 'Capture', icon: Plus, view: 'dashboard', isCapture: true },
  { label: 'Collections', icon: FolderOpen, view: 'collections' },
  { label: 'Settings', icon: Settings, view: 'settings' },
]

/* SVG icon map for reliable mobile bottom nav rendering */
const navIconSvgs: Record<string, (isActive: boolean) => React.ReactNode> = {
  dashboard: (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill={isActive ? '#c084fc' : 'none'} stroke={isActive ? '#c084fc' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  ),
  'ask-aether': (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill={isActive ? '#c084fc' : 'none'} stroke={isActive ? '#c084fc' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>
  ),
  collections: (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill={isActive ? '#c084fc' : 'none'} stroke={isActive ? '#c084fc' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
  ),
  settings: (isActive) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill={isActive ? '#c084fc' : 'none'} stroke={isActive ? '#c084fc' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
}

/* ─────────── Sidebar Nav Item (Desktop) ─────────── */
const SidebarNavItem = memo(function SidebarNavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5
        text-sm font-medium transition-all duration-150
        ${
          isActive
            ? 'text-[#c084fc] bg-[#9D8BA7]/10 border-l-2 border-[#9D8BA7]'
            : 'text-[rgba(240,240,248,0.5)] border-l-2 border-transparent hover:text-[rgba(240,240,248,0.8)] hover:bg-[rgba(157,139,167,0.06)]'
        }
      `}
    >
      <Icon
        size={20}
        className={`flex-shrink-0 transition-all duration-150 ${
          isActive
            ? 'text-[#c084fc]'
            : 'text-[rgba(240,240,248,0.5)] group-hover:text-[rgba(240,240,248,0.8)]'
        }`}
        style={isActive ? { filter: 'drop-shadow(0 0 6px #9D8BA7)' } : undefined}
      />
      <span className="truncate">{item.label}</span>
    </button>
  )
})

/* ─────────── Bottom Nav Item (Mobile) ─────────── */
const BottomNavItem = memo(function BottomNavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  // Use reliable inline SVGs for mobile bottom nav
  const svgIcon = navIconSvgs[item.view]

  return (
    <button
      onClick={onClick}
      className={`
        tap-feedback relative flex flex-col items-center justify-center gap-0.5
        min-w-[48px] min-h-[44px] transition-all duration-150
        ${
          isActive
            ? 'text-[#c084fc] scale-[1.05]'
            : 'text-[rgba(240,240,248,0.5)] active:text-[rgba(240,240,248,0.8)]'
        }
      `}
      aria-label={item.label}
    >
      <span style={isActive ? { filter: 'drop-shadow(0 0 6px #9D8BA7)' } : undefined}>
        {svgIcon ? svgIcon(isActive) : <item.icon size={22} className="transition-colors duration-150" />}
      </span>
      <span className={`text-[10px] font-medium leading-tight ${isActive ? 'text-[#c084fc]' : ''}`}>{item.label}</span>
    </button>
  )
})

/* ─────────── Offline Banner ─────────── */
function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const { isSyncing, pendingSyncCount, setIsOnline, setIsSyncing, setPendingSyncCount } = useAetherStore()

  // Sync online status and pending count
  useEffect(() => {
    setIsOnline(isOnline)
    if (isOnline) {
      getSyncQueueCount().then(setPendingSyncCount)
    }
  }, [isOnline, setIsOnline, setPendingSyncCount])

  if (isOnline && !isSyncing && pendingSyncCount === 0) return null

  // Offline banner
  if (!isOnline) {
    return (
      <div className="bg-amber-900/20 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-300">
        <WifiOff size={14} className="shrink-0" />
        <span>You are offline — showing cached memories</span>
      </div>
    )
  }

  // Syncing banner
  if (isSyncing) {
    return (
      <div className="bg-[#9D8BA7]/5 border-b border-[#9D8BA7]/10 px-4 py-2 flex items-center justify-center gap-2 text-xs text-[#9D8BA7]">
        <Cloud size={14} className="shrink-0 animate-pulse" />
        <span>Syncing your memories...</span>
      </div>
    )
  }

  // Pending items but not actively syncing
  if (pendingSyncCount > 0) {
    return (
      <div className="bg-emerald-900/20 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-emerald-300">
        <CheckCircle2 size={14} className="shrink-0" />
        <span>{pendingSyncCount} memories queued to sync</span>
      </div>
    )
  }

  return null
}

/* ─────────── Main AppShell Component ─────────── */
export default function AppShell({ children }: { children: ReactNode }) {
  const { currentView, setCurrentView, setCaptureModalOpen, profile, user } = useAetherStore()

  // Determine which nav item is active based on current view
  const activeNavView = useMemo((): AppView => {
    if (currentView === 'memory-detail') return 'dashboard'
    if (currentView === 'landing') return 'dashboard'
    return currentView
  }, [currentView])

  return (
    <div className="h-dvh bg-background text-foreground flex overflow-hidden">
      {/* Inject capture pulse animation */}
      <style dangerouslySetInnerHTML={{ __html: pulseStyles }} />

      {/* ── Left Sidebar (Desktop) ── */}
      <aside
        className="hidden md:flex md:flex-col md:w-64 fixed inset-y-0 left-0 z-40"
        style={{
          background: 'rgba(7, 7, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(157,139,167,0.08)',
        }}
      >
        {/* Logo with purple glow */}
        <div className="relative flex items-center gap-3 px-5 py-6 border-b border-[rgba(157,139,167,0.08)]">
          {/* Subtle purple glow behind logo */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 h-16 w-16 bg-[#9D8BA7]/5 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10">
            <AetherLogo size={36} showText />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none">
          {desktopNavItems.map((item) => (
            <SidebarNavItem
              key={item.view}
              item={item}
              isActive={activeNavView === item.view}
              onClick={() => setCurrentView(item.view)}
            />
          ))}
        </nav>

        {/* Sidebar footer — user avatar */}
        <div className="px-4 py-4 border-t border-[rgba(157,139,167,0.08)]">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-[#9D8BA7]/30">
              <AvatarFallback className="bg-[#9D8BA7]/10 text-[#9D8BA7] text-sm font-semibold">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
              <p className="text-xs text-[rgba(240,240,248,0.45)] truncate">{user?.plan === 'pro' ? 'Bloom Plan' : 'Seed Plan'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 md:pl-64 flex flex-col h-dvh overflow-hidden">
        {/* Offline/Sync Banner */}
        <OfflineBanner />

        {/* ── Top Header - Mobile ── */}
        <header className="md:hidden shrink-0 z-30 bg-transparent border-b border-[rgba(157,139,167,0.06)]">
          <div className="flex items-center gap-3 px-4 h-12 safe-area-top">
            {/* Brain logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <AetherLogo size={28} />
            </div>

            {/* Futuristic search pill — tappable to open Ask Aether */}
            <button
              onClick={() => setCurrentView('ask-aether')}
              className="flex-1 flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-[rgba(240,240,248,0.45)] transition-all duration-200 group min-h-[44px]"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(157,139,167,0.15)',
              }}
            >
              <Sparkles
                size={14}
                className="flex-shrink-0 text-[#9D8BA7]/60 group-hover:text-[#9D8BA7] transition-colors duration-150"
              />
              <span className="truncate text-xs">Search memories or ask Aether...</span>
            </button>
          </div>
        </header>

        {/* ── Top Header - Desktop ── */}
        <header className="hidden md:block shrink-0 z-30 bg-transparent border-b border-[rgba(157,139,167,0.06)]">
          <div className="flex items-center gap-4 px-6 h-14">
            {/* Futuristic Search Bar */}
            <button
              onClick={() => setCurrentView('ask-aether')}
              className="flex-1 max-w-xl mx-auto flex items-center gap-3 rounded-xl px-4 py-2 text-sm text-[rgba(240,240,248,0.45)] transition-all duration-200 group min-h-[44px] focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(157,139,167,0.15)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(192,132,252,0.4)'
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(192,132,252,0.1)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(157,139,167,0.15)'
                e.currentTarget.style.boxShadow = 'none'
              }}
              aria-label="Search memories"
            >
              <Sparkles
                size={16}
                className="flex-shrink-0 text-[#9D8BA7]/60 group-hover:text-[#9D8BA7] transition-colors duration-150"
              />
              <span className="truncate">Search memories or ask Aether...</span>
            </button>

            {/* Avatar (Desktop) */}
            <div className="flex-shrink-0">
              <Avatar className="h-8 w-8 ring-2 ring-[#9D8BA7]/30 cursor-pointer hover:ring-[#9D8BA7]/50 transition-all duration-150">
                <AvatarFallback className="bg-[#9D8BA7]/10 text-[#9D8BA7] text-xs font-semibold">
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {/* ── Desktop FAB Capture Button ── */}
      <button
        onClick={() => setCaptureModalOpen(true)}
        className="hidden md:flex fixed z-40 bottom-8 right-8 h-14 w-14 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#c084fc] text-white items-center justify-center transition-all duration-200 hover:scale-[1.08] active:scale-95 animate-capture-pulse hover:shadow-[0_4px_32px_rgba(157,139,167,0.5)]"
        aria-label="Quick capture"
      >
        <Plus size={24} className="stroke-[1.5]" />
      </button>

      {/* ── Bottom Navigation Bar (Mobile) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 mobile-gpu safe-area-bottom"
        style={{
          background: 'rgba(7, 7, 15, 0.95)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(157,139,167,0.08)',
        }}
      >
        <div className="relative flex items-end justify-around px-1 pt-1.5" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {mobileNavItems.map((item, index) => {
            // Center Capture button — raised and prominent with gradient + pulse
            if (item.isCapture) {
              return (
                <button
                  key={item.view}
                  onClick={() => setCaptureModalOpen(true)}
                  className="tap-feedback relative flex flex-col items-center justify-center -mt-5 z-10"
                  aria-label="Quick capture"
                >
                  {/* Raised circular gradient button with pulse */}
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#c084fc] flex items-center justify-center shadow-lg shadow-[#9D8BA7]/40 ring-4 ring-[rgba(7,7,15,0.8)] transition-all duration-200 hover:shadow-xl hover:shadow-[#c084fc]/50 active:scale-95 animate-capture-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  </div>
                  <span className="text-[10px] font-medium text-[#c084fc] mt-1 leading-tight">Capture</span>
                </button>
              )
            }

            // Regular nav items
            return (
              <BottomNavItem
                key={item.view}
                item={item}
                isActive={activeNavView === item.view}
                onClick={() => setCurrentView(item.view)}
              />
            )
          })}
        </div>
      </nav>
    </div>
  )
}
