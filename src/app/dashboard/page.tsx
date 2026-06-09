'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreVertical, Home, Search, Sparkles, Settings, LogOut, Zap, ArrowRight } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════════════════
const supabase = createClient(
  'https://yxtlhqtyhnholgvldmjj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGxocXR5aG5ob2xndmxkbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY4NzMsImV4cCI6MjA5NjUyMjg3M30.flt0Sp_K9pSjkdwa7xG7aFIZW72oj7FsJrk5c8GB9oo'
)

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface MemoryRow {
  id: string
  content: string
  created_at: string
  title?: string
  type?: string
  tags?: string[]
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function formatRelativeDate(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ═══════════════════════════════════════════════════════════════
// MEMORY CARD — Premium Frosted Glass with Hover Glow
// ═══════════════════════════════════════════════════════════════
function MemoryCard({
  memory,
  onDelete,
  index = 0,
}: {
  memory: MemoryRow
  onDelete: (id: string) => void
  index?: number
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={`group relative rounded-2xl transition-all duration-300 hover:-translate-y-0.5 ${
        isNew ? 'new-memory-glow' : ''
      }`}
      onAnimationEnd={() => setIsNew(false)}
    >
      {/* Hover glow effect */}
      <div className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(192,132,252,0.06) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />

      <div className="relative backdrop-blur-sm bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.035] hover:border-white/[0.1] transition-all duration-300">
        <p className="text-white/75 text-sm leading-relaxed pr-8 group-hover:text-white/90 transition-colors duration-200">
          {memory.title || memory.content}
        </p>

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {memory.tags.map((tag, i) => (
              <span key={i} className="entity-pill inline-flex items-center gap-1 bg-purple-500/[0.08] text-purple-400/80 text-[10px] font-medium px-2.5 py-1 rounded-lg uppercase tracking-wider border border-purple-500/[0.06]">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <span className="text-white/20 text-[11px] font-medium">
            {formatRelativeDate(memory.created_at)}
          </span>
        </div>

        <div ref={menuRef} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-white/20 hover:text-white/50 transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
            aria-label="More options"
          >
            <MoreVertical size={14} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute right-0 top-7 bg-[#0f0e17]/95 backdrop-blur-2xl border border-white/[0.08] rounded-xl p-1.5 min-w-[100px] z-20 shadow-xl shadow-black/40"
              >
                <button
                  onClick={() => { onDelete(memory.id); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-red-400/60 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all duration-150"
                >
                  Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR — Premium Glassmorphism with Animated Active State
// ═══════════════════════════════════════════════════════════════
function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [activeItem, setActiveItem] = useState('home')

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: Search, label: 'Ask Aether' },
    { id: 'recap', icon: Sparkles, label: 'Daily Recap' },
  ]

  return (
    <aside className="w-[72px] lg:w-64 h-screen bg-[#08070b]/80 backdrop-blur-xl border-r border-white/[0.04] flex flex-col fixed left-0 top-0 z-50 transition-all duration-300">
      {/* Logo */}
      <div className="px-4 lg:px-6 py-6 mb-2">
        <div className="flex items-center gap-3">
          {/* Logo icon — always visible */}
          <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/20 relative overflow-hidden">
            {/* Animated shimmer on logo */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-logo-shimmer" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {/* Logo text — hidden on small sidebar */}
          <span className="hidden lg:block text-sm font-bold text-white/70 tracking-wider uppercase" style={{ fontFamily: 'var(--font-inter)' }}>
            Aether
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 lg:px-3 flex-1">
        {navItems.map((item) => {
          const isActive = activeItem === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setActiveItem(item.id)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'text-purple-300 bg-purple-500/[0.12] shadow-[0_0_20px_-5px_rgba(139,92,246,0.25)]'
                  : 'text-white/25 hover:text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-purple-400 to-violet-500"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <Icon size={18} className={`flex-shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-1 px-3 lg:px-3 pt-4 pb-4 border-t border-white/[0.04]">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/25 hover:text-white/60 hover:bg-white/[0.03] transition-all duration-200 text-sm group">
          <Settings size={18} className="flex-shrink-0 group-hover:rotate-45 transition-transform duration-300" />
          <span className="hidden lg:inline">Settings</span>
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/15 hover:text-red-400/60 hover:bg-red-500/[0.05] transition-all duration-200 text-sm group"
        >
          <LogOut size={18} className="flex-shrink-0 group-hover:-translate-x-0.5 transition-transform duration-200" />
          <span className="hidden lg:inline">Log Out</span>
        </button>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED MESH GRADIENT BACKGROUND
// ═══════════════════════════════════════════════════════════════
function DashboardBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Primary deep purple orb */}
      <div
        className="absolute top-[-15%] left-[15%] w-[700px] h-[700px] rounded-full animate-aurora-1"
        style={{
          background: 'radial-gradient(ellipse, rgba(88,28,135,0.12) 0%, rgba(88,28,135,0.03) 50%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
      {/* Secondary indigo orb */}
      <div
        className="absolute bottom-[-15%] right-[5%] w-[600px] h-[600px] rounded-full animate-aurora-2"
        style={{
          background: 'radial-gradient(ellipse, rgba(49,46,129,0.1) 0%, rgba(49,46,129,0.02) 50%, transparent 70%)',
          filter: 'blur(120px)',
        }}
      />
      {/* Tertiary violet accent */}
      <div
        className="absolute top-[40%] right-[25%] w-[400px] h-[400px] rounded-full animate-aurora-3"
        style={{
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 60%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Subtle warm accent */}
      <div
        className="absolute bottom-[10%] left-[30%] w-[300px] h-[300px] rounded-full animate-aurora-breathe"
        style={{
          background: 'radial-gradient(ellipse, rgba(251,146,60,0.03) 0%, transparent 60%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD — $10M Startup Aesthetic
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [inputText, setInputText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showTagPill, setShowTagPill] = useState(false)
  const [captureShimmer, setCaptureShimmer] = useState(false)

  // ─── AI States ───
  const [searchQuery, setSearchQuery] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [dailyRecap, setDailyRecap] = useState('')
  const [isRecapLoading, setIsRecapLoading] = useState(false)

  const userRef = useRef<{ id: string } | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  // ─── THE ONLY useEffect — loads data ONCE, empty deps ───
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      userRef.current = { id: session.user.id }

      const { data } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setMemories(data || []);

      // ─── Fetch Daily Recap after memories load ───
      if (data && data.length > 0) {
        setIsRecapLoading(true)
        try {
          const res = await fetch('/api/ask-aether', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memories: data }),
          })
          const json = await res.json()
          if (json.response) {
            setDailyRecap(json.response)
          }
        } catch (err) {
          console.error('[Aether] Daily recap failed:', err)
        } finally {
          setIsRecapLoading(false)
        }
      }
    };

    loadData();
  }, []);

  // ─── Save — no re-fetch, add to state directly ───
  async function handleSave() {
    const content = inputText.trim()
    if (!content || isSaving || !userRef.current) return

    setIsSaving(true)
    setShowTagPill(false)
    setCaptureShimmer(true)

    const { data, error } = await supabase
      .from('memories')
      .insert({ user_id: userRef.current.id, content })
      .select()
      .single()

    if (!error && data) {
      setMemories(prev => [data as MemoryRow, ...prev])
      setInputText('')
      setShowTagPill(true)
      setTimeout(() => setShowTagPill(false), 2500)

      // Capture bar "thump" animation
      if (captureRef.current) {
        captureRef.current.classList.add('animate-capture-thump')
        setTimeout(() => captureRef.current?.classList.remove('animate-capture-thump'), 400)
      }
    } else {
      console.error('[Aether] Save failed:', error?.message)
    }

    // Shimmer fade out
    setTimeout(() => setCaptureShimmer(false), 1200)
    setIsSaving(false)
  }

  // ─── Delete — optimistic, no re-fetch ───
  async function handleDelete(memoryId: string) {
    setMemories(prev => prev.filter(m => m.id !== memoryId))

    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId)

    if (error) {
      console.error('[Aether] Delete failed:', error.message)
      if (userRef.current) {
        const { data } = await supabase
          .from('memories')
          .select('*')
          .eq('user_id', userRef.current.id)
          .order('created_at', { ascending: false })
        if (data) setMemories(data)
      }
    }
  }

  // ─── Logout ───
  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // ─── Enter to save ───
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
  }

  // ─── Question Detection ───
  function isQuestion(text: string): boolean {
    const lower = text.toLowerCase().trim()
    const questionStarters = ['what', 'who', 'where', 'when', 'how', 'why', 'did i', 'do i', 'have i', 'is there', 'was there', 'can you', 'remind']
    return questionStarters.some(starter => lower.startsWith(starter)) || lower.endsWith('?')
  }

  // ─── Ask Aether Search Handler ───
  async function handleSearch() {
    const query = searchQuery.trim()
    if (!query || isAsking) return

    // If it's a question, ask AI
    if (isQuestion(query)) {
      setIsAsking(true)
      setAiResponse('')
      try {
        const res = await fetch('/api/ask-aether', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query, memories }),
        })
        const json = await res.json()
        if (json.response) {
          setAiResponse(json.response)
        }
      } catch (err) {
        console.error('[Aether] Ask failed:', err)
        setAiResponse('Something went wrong — try again? 💙')
      } finally {
        setIsAsking(false)
      }
    } else {
      // Not a question — save as a memory
      setSearchQuery('')
      if (!userRef.current) return
      setIsSaving(true)
      setShowTagPill(false)
      setCaptureShimmer(true)
      const { data, error } = await supabase
        .from('memories')
        .insert({ user_id: userRef.current.id, content: query })
        .select()
        .single()
      if (!error && data) {
        setMemories(prev => [data as MemoryRow, ...prev])
        setShowTagPill(true)
        setTimeout(() => setShowTagPill(false), 2500)
        if (captureRef.current) {
          captureRef.current.classList.add('animate-capture-thump')
          setTimeout(() => captureRef.current?.classList.remove('animate-capture-thump'), 400)
        }
      } else {
        console.error('[Aether] Save failed:', error?.message)
      }
      setTimeout(() => setCaptureShimmer(false), 1200)
      setIsSaving(false)
    }
  }

  // ─── Search Enter handler ───
  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  // ─── RENDER — $10M Premium Aesthetic ───
  return (
    <div className="min-h-screen bg-[#06060e] text-white relative overflow-hidden">
      <DashboardBackground />

      {/* Left Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main Content — shifted right for sidebar */}
      <main className="ml-[72px] lg:ml-64 relative z-10 min-h-screen">
        <div className="max-w-2xl mx-auto px-6 lg:px-8 py-10 lg:py-14">

          {/* Greeting Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-10"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-white/90 tracking-tight" style={{ fontFamily: 'var(--font-inter)' }}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
            </h1>
            <p className="text-white/25 text-sm mt-1.5">What&apos;s on your mind today?</p>
          </motion.div>

          {/* ═══ Ask Aether — Premium Search with Gradient Focus ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-8"
          >
            <div className="relative group">
              {/* Animated gradient border on focus */}
              <div className="absolute -inset-[1px] rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 animate-gradient-border" />
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-purple-400/50 transition-colors duration-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Ask Aether anything..."
                  className="w-full bg-white/[0.025] border border-white/[0.06] rounded-2xl pl-11 pr-4 py-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-purple-500/25 focus:bg-white/[0.035] focus:shadow-[0_0_30px_-10px_rgba(139,92,246,0.2)] transition-all duration-400"
                />
              </div>
            </div>

            {/* AI Response Bubble */}
            <AnimatePresence>
              {(aiResponse || isAsking) && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="bg-white/[0.03] border border-purple-500/20 rounded-xl p-4 text-white/80 text-sm mb-8 max-w-2xl w-full"
                >
                  {isAsking ? (
                    <span className="flex items-center gap-2 text-white/50">
                      <div className="h-3 w-3 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
                      Thinking...
                    </span>
                  ) : (
                    <span>{aiResponse}</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ═══ Capture Bar — Premium Gravity Input ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-10"
          >
            <div
              ref={captureRef}
              className={`relative rounded-2xl transition-all duration-400 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.25),0_0_50px_-10px_rgba(139,92,246,0.3)] ${
                captureShimmer ? 'magic-processing-shimmer' : ''
              }`}
            >
              {/* Subtle breathing glow around capture bar */}
              <div className="absolute -inset-[1px] rounded-2xl capture-breathe pointer-events-none" />

              <div className="relative bg-white/[0.025] border border-white/[0.06] focus-within:border-purple-500/25 rounded-2xl p-2 transition-all duration-400">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What's on your mind?"
                  disabled={isSaving}
                  className="w-full bg-transparent text-white text-base placeholder:text-white/20 focus:outline-none px-4 py-3"
                />
                <button
                  onClick={handleSave}
                  disabled={!inputText.trim() || isSaving}
                  className="absolute right-3 top-1/2 -translate-y-1/2 group/btn relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 active:scale-[0.96] disabled:opacity-20 disabled:cursor-not-allowed disabled:active:scale-100"
                  style={{
                    background: inputText.trim()
                      ? 'linear-gradient(135deg, #8b5cf6, #7c3aed, #6d28d9)'
                      : 'rgba(139, 92, 246, 0.15)',
                    boxShadow: inputText.trim()
                      ? '0 0 20px -3px rgba(139,92,246,0.5), 0 4px 12px -2px rgba(0,0,0,0.3)'
                      : 'none',
                  }}
                >
                  {/* Button hover shimmer */}
                  {inputText.trim() && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {isSaving ? (
                      <>
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                        Saving
                      </>
                    ) : (
                      <>
                        Save
                        <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform duration-200" />
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Dopamine Tag Pill — Enhanced */}
            <div className="mt-3 min-h-[28px]">
              <AnimatePresence>
                {showTagPill && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
                    className="inline-flex items-center gap-1.5 text-xs text-purple-300/80 bg-purple-500/[0.08] border border-purple-500/[0.1] px-3 py-1.5 rounded-lg font-medium"
                  >
                    <Zap size={11} className="text-purple-400" />
                    Captured &amp; Organized
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ═══ Daily Recap — Glassmorphism with Glowing Border ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-10"
          >
            <h2 className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
              <Sparkles size={12} className="text-purple-400/40" />
              Daily Recap
            </h2>
            <div className="daily-spark-card backdrop-blur-sm bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 relative overflow-hidden">
              {/* Inner top accent line */}
              <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-purple-400/20 to-transparent" />
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/[0.08] border border-purple-500/[0.06] flex items-center justify-center flex-shrink-0">
                  <Sparkles size={18} className="text-purple-400/40" />
                </div>
                <div className="flex-1 min-w-0">
                  {isRecapLoading ? (
                    <>
                      <p className="text-white/50 text-sm font-medium">
                        Generating your recap...
                      </p>
                      <p className="text-white/15 text-xs mt-0.5">
                        Aether is looking through your memories ✨
                      </p>
                    </>
                  ) : dailyRecap ? (
                    <>
                      <p className="text-white/70 text-sm leading-relaxed">
                        {dailyRecap}
                      </p>
                      <p className="text-white/15 text-xs mt-2">
                        Powered by Aether AI ✨
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/30 text-sm font-medium">
                        No recap yet
                      </p>
                      <p className="text-white/15 text-xs mt-0.5">
                        Save some thoughts and check back tomorrow
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══ Memories Feed — Premium Frosted Glass Cards ═══ */}
          <div>
            <h2 className="text-[11px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
              <Home size={12} className="text-purple-400/30" />
              Recent Memories
              {memories.length > 0 && (
                <span className="text-white/10 text-[10px] font-normal ml-1">
                  {memories.length}
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {memories.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="text-center py-16"
                >
                  <div className="h-16 w-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mx-auto mb-4">
                    <Zap size={24} className="text-white/10" />
                  </div>
                  <p className="text-white/20 text-sm font-medium">Your mind is clear</p>
                  <p className="text-white/10 text-xs mt-1">Capture a thought above to get started</p>
                </motion.div>
              ) : (
                memories.map((memory, index) => (
                  <MemoryCard key={memory.id} memory={memory} onDelete={handleDelete} index={index} />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
