'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MoreVertical, Home, Search, Sparkles, Settings, LogOut } from 'lucide-react'

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
// MEMORY CARD — Frosted Glass (Linear Style)
// ═══════════════════════════════════════════════════════════════
function MemoryCard({
  memory,
  onDelete,
}: {
  memory: MemoryRow
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white/[0.015] border border-white/[0.04] rounded-xl p-4 hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-200 group relative"
    >
      <p className="text-white/80 text-sm leading-relaxed pr-8 group-hover:text-white transition-colors">
        {memory.title || memory.content}
      </p>

      {/* Tags */}
      {memory.tags && memory.tags.length > 0 && (
        <div className="mt-2">
          {memory.tags.map((tag, i) => (
            <span key={i} className="inline-block bg-purple-500/10 text-purple-400 text-[10px] font-medium px-2 py-0.5 rounded-md mr-1.5 uppercase tracking-wider">
              {tag}
            </span>
          ))}
        </div>
      )}

      <span className="text-white/20 text-[11px] mt-2 block">
        {formatRelativeDate(memory.created_at)}
      </span>

      <div ref={menuRef} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white/20 hover:text-white/60 transition-colors p-1"
          aria-label="More options"
        >
          <MoreVertical size={14} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-6 bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-lg p-1 min-w-[90px] z-20"
            >
              <button
                onClick={() => { onDelete(memory.id); setMenuOpen(false) }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors"
              >
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR — Linear Minimal
// ═══════════════════════════════════════════════════════════════
function Sidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <aside className="w-64 h-screen bg-[#08070b] border-r border-white/[0.04] flex flex-col p-5 fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="mb-10 px-2">
        <h1 className="text-sm font-semibold text-white/50 tracking-wider uppercase">Aether</h1>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-purple-400 bg-purple-500/10 transition-colors text-sm font-medium">
          <Home size={16} />
          Home
        </button>
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.03] transition-colors text-sm">
          <Search size={16} />
          Ask Aether
        </button>
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.03] transition-colors text-sm">
          <Sparkles size={16} />
          Daily Recap
        </button>
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-1 pt-4 border-t border-white/[0.04]">
        <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.03] transition-colors text-sm">
          <Settings size={16} />
          Settings
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.03] transition-colors text-xs"
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD — renders INSTANTLY, ZERO loading states, ZERO redirects
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [inputText, setInputText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showTagPill, setShowTagPill] = useState(false)

  const userRef = useRef<{ id: string } | null>(null)

  // ─── THE ONLY useEffect — loads data ONCE, empty deps ───
  // NO redirect on missing session. If no session, memories just
  // stays empty and the user sees the empty state. Client-side
  // auth context handles all redirects.
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Don't redirect — just show empty state. Auth context handles redirect.
        return;
      }

      userRef.current = { id: session.user.id }

      const { data } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      setMemories(data || []);
    };

    loadData();
  }, []); // EMPTY ARRAY - RUNS ONLY ONCE

  // ─── Save — no re-fetch, add to state directly ───
  async function handleSave() {
    const content = inputText.trim()
    if (!content || isSaving || !userRef.current) return

    setIsSaving(true)
    setShowTagPill(false)

    const { data, error } = await supabase
      .from('memories')
      .insert({ user_id: userRef.current.id, content })
      .select()
      .single()

    if (!error && data) {
      setMemories(prev => [data as MemoryRow, ...prev])
      setInputText('')
      setShowTagPill(true)
      setTimeout(() => setShowTagPill(false), 2000)
    } else {
      console.error('[Aether] Save failed:', error?.message)
    }

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

  // ─── RENDER — Linear.app Premium Style ───
  return (
    <div className="min-h-screen bg-[#08070b] text-white relative overflow-hidden flex flex-col items-center pt-20 pb-10 px-4">
      {/* Deep Space Ambient Orbs */}
      <div
        className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-purple-800/10 rounded-full blur-[200px] pointer-events-none z-0"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-20%] right-[10%] w-[600px] h-[600px] bg-blue-800/10 rounded-full blur-[180px] pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Left Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main Content — shifted right for sidebar */}
      <main className="ml-64 flex-1 w-full relative z-10">
        <div className="max-w-2xl mx-auto px-6">

          {/* Header */}
          <div className="w-full max-w-2xl mx-auto flex justify-between items-center mb-12">
            <h2 className="text-sm font-semibold text-white/50 tracking-wider uppercase">Memories</h2>
            <button
              onClick={handleLogout}
              className="text-white/20 hover:text-white/60 text-xs bg-white/[0.02] hover:bg-white/[0.05] px-3 py-1.5 rounded-md border border-white/[0.04] transition-all duration-200 active:scale-95"
            >
              Log Out
            </button>
          </div>

          {/* Ask Aether Search Bar */}
          <div className="w-full max-w-2xl mx-auto mb-12">
            <input
              type="text"
              placeholder="Ask Aether anything... (e.g., What was that link I saved?)"
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-500/30 focus:shadow-[0_0_0_1px_rgba(139,92,246,0.2),0_0_30px_-10px_rgba(139,92,246,0.3)] transition-all duration-300"
            />
          </div>

          {/* Gravity Capture Bar — Linear Glow Style */}
          <div className="w-full max-w-2xl mx-auto mb-12">
            <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-xl p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_40px_-10px_rgba(139,92,246,0.15)] transition-all duration-300 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.3),0_0_60px_-10px_rgba(139,92,246,0.4)] focus-within:border-purple-500/30">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What's on your mind?"
                disabled={isSaving}
                className="w-full bg-transparent text-white text-base placeholder:text-white/30 focus:outline-none px-4 py-3"
              />
              <button
                onClick={handleSave}
                disabled={!inputText.trim() || isSaving}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg shadow-[0_0_15px_-3px_rgba(139,92,246,0.6)] hover:shadow-[0_0_25px_-3px_rgba(139,92,246,0.8)] transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>

            {/* Dopamine Tag Pill */}
            <div className="mt-3 min-h-[24px]">
              <AnimatePresence>
                {showTagPill && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-md inline-block font-medium"
                  >
                    Captured & Organized ✨
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Daily Recap Section */}
          <div className="w-full max-w-2xl mx-auto mb-12">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
              Daily Recap
            </h2>
            <div className="bg-purple-500/[0.06] border border-purple-500/10 rounded-xl p-4">
              <p className="text-purple-300/50 text-sm">
                ✨ No recap yet. Save some thoughts and check back tomorrow!
              </p>
            </div>
          </div>

          {/* Memories Feed — Frosted Glass Cards */}
          <div className="w-full max-w-2xl mx-auto space-y-3">
            {memories.length === 0 ? (
              <p className="text-white/20 text-sm text-center mt-20">Your mind is clear. Dump a thought above.</p>
            ) : (
              memories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} onDelete={handleDelete} />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
