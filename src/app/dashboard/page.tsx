'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Loader2, MoreVertical } from 'lucide-react'

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
// DASHBOARD — renders INSTANTLY, NO loading state, ONE useEffect
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [inputText, setInputText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showTagPill, setShowTagPill] = useState(false)

  const userRef = useRef<{ id: string } | null>(null)

  // ─── THE ONLY useEffect — loads data ONCE, empty deps ───
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = '/';
        return;
      }

      const { data } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setMemories(data);
      }
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

  // ─── RENDER — INSTANTLY, no loading gate, no spinner ───
  return (
    <div className="min-h-screen bg-[#020206] text-white relative overflow-hidden flex flex-col items-center pt-20 px-4">
      {/* Background Glows */}
      <div
        className="w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] absolute top-[-10%] left-[-10%] z-0"
        aria-hidden="true"
      />
      <div
        className="w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[150px] absolute bottom-[-10%] right-[-10%] z-0"
        aria-hidden="true"
      />

      {/* Top Right — Log Out */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          Log Out
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto">

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
              {isSaving ? (
                <Loader2 size={18} className="animate-spin text-purple-400" />
              ) : (
                <Send size={18} />
              )}
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

        {/* Memories Feed — empty state if no memories yet */}
        <div className="space-y-4 w-full">
          {memories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.4, 0.8, 0.4],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="h-24 w-24 rounded-full flex items-center justify-center mb-6 bg-purple-500/5"
              >
                <Sparkles size={32} className="text-purple-500/40" />
              </motion.div>
              <p className="text-lg font-medium text-white/30">
                A quiet space for your thoughts
              </p>
              <p className="text-sm mt-2 text-white/20">
                Type anything above to start capturing
              </p>
            </motion.div>
          ) : (
            memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
