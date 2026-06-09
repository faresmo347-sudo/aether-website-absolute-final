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
// MEMORY CARD
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
      className="bg-white/[0.02] backdrop-blur-lg border border-white/[0.05] rounded-2xl p-5 hover:bg-white/[0.04] transition-all group relative"
    >
      <p className="text-white/90 text-base leading-relaxed pr-8">
        {memory.title || memory.content}
      </p>
      <span className="text-white/30 text-xs mt-2 block">
        {formatRelativeDate(memory.created_at)}
      </span>

      <div ref={menuRef} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-white/30 hover:text-white/60 transition-colors p-1"
          aria-label="More options"
        >
          <MoreVertical size={16} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-7 bg-white/10 backdrop-blur-xl border border-white/10 rounded-lg p-1 min-w-[100px] z-20"
            >
              <button
                onClick={() => { onDelete(memory.id); setMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-colors"
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
// SIDEBAR
// ═══════════════════════════════════════════════════════════════
function Sidebar({ onLogout }: { onLogout: () => void }) {
  return (
    <aside className="w-64 h-screen bg-[#050510] border-r border-white/[0.05] flex flex-col p-6 fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="mb-10">
        <h1 className="text-xl font-bold text-white/80">Aether</h1>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-purple-400 bg-purple-500/10 transition-colors text-sm font-medium">
          <Home size={18} />
          Home
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors text-sm">
          <Search size={18} />
          Ask Aether
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors text-sm">
          <Sparkles size={18} />
          Daily Recap
        </button>
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-2 pt-4 border-t border-white/[0.05]">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors text-sm">
          <Settings size={18} />
          Settings
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors text-sm"
        >
          <LogOut size={18} />
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

  // ─── RENDER — Full Aether V2 Layout ───
  return (
    <div className="min-h-screen bg-[#020206] text-white flex">
      {/* Left Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main Content — shifted right for sidebar */}
      <main className="ml-64 flex-1 min-h-screen relative overflow-hidden">
        {/* Background Glows */}
        <div
          className="w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] absolute top-[-10%] right-[-10%] z-0"
          aria-hidden="true"
        />
        <div
          className="w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[150px] absolute bottom-[-10%] left-[-5%] z-0"
          aria-hidden="true"
        />

        {/* Content Area */}
        <div className="relative z-10 w-full max-w-2xl mx-auto pt-10 px-6 pb-20">

          {/* Ask Aether Search Bar */}
          <input
            type="text"
            placeholder="Ask Aether anything... (e.g., What was that link I saved?)"
            className="w-full bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/30 mb-8 text-sm"
          />

          {/* Capture Area */}
          <div className="mb-8">
            <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-2 shadow-[0_0_40px_rgba(139,92,246,0.2)] focus-within:shadow-[0_0_60px_rgba(139,92,246,0.4)] focus-within:border-purple-500/40 transition-all">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What's on your mind?"
                disabled={isSaving}
                className="w-full bg-transparent text-white text-lg placeholder:text-gray-500 focus:outline-none px-4 py-3"
              />
              <button
                onClick={handleSave}
                disabled={!inputText.trim() || isSaving}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all disabled:opacity-30"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </div>

            {/* Dopamine Tag Pill */}
            <div className="mt-3 min-h-[28px]">
              <AnimatePresence>
                {showTagPill && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm text-purple-300 bg-purple-500/20 px-3 py-1 rounded-full inline-block"
                  >
                    Captured & Organized ✨
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Daily Recap Section */}
          <div className="w-full max-w-2xl mx-auto mb-8">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
              Daily Recap
            </h2>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5">
              <p className="text-purple-300/70 text-sm">
                ✨ No recap yet. Save some thoughts and check back tomorrow!
              </p>
            </div>
          </div>

          {/* Memories Feed */}
          <div className="space-y-4 w-full">
            {memories.length === 0 ? (
              <p className="text-gray-600 text-center mt-20">Your mind is clear. Dump a thought above.</p>
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
