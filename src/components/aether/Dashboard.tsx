'use client'

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, FileText, Link2, ImageIcon, X, Plus, Brain, Loader2, Sparkles, Send, ImagePlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAetherStore } from '@/store/aether-store'
import { createMemory, getMemoryCount, updateMemoryById, deleteMemoryById } from '@/lib/supabase/data'
import { getCachedTags, setCachedTags } from '@/lib/tag-cache'
import type { Memory, MemoryType } from '@/components/aether/types'
import { useToast } from '@/hooks/use-toast'

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

// ────────────────────────────────────────────────────────────
// ADHD-FRIENDLY TAG COLORS — Soft, muted, never harsh
// Category-mapped with gentle pastels
// ────────────────────────────────────────────────────────────

const CATEGORY_TAG_MAP: Record<string, string> = {
  // Work 💼
  '#work': 'blue', '#meeting': 'blue', '#project': 'blue', '#code': 'blue',
  '#programming': 'blue', '#startup': 'blue', '#business': 'blue', '#product': 'blue',
  '#tech': 'blue', '#technology': 'blue', '#finance': 'blue', '#budgeting': 'blue',
  // Ideas 💡
  '#idea': 'purple', '#creativity': 'purple', '#design': 'purple', '#creative': 'purple',
  '#ai': 'purple', '#books': 'purple', '#reading': 'purple', '#education': 'purple',
  '#learning': 'purple', '#study': 'purple',
  // Personal 🌿
  '#personal': 'green', '#health': 'green', '#fitness': 'green', '#medical': 'green',
  '#family': 'green', '#social': 'green', '#friends': 'green',
  // Travel ✈️
  '#travel': 'orange', '#trip': 'orange', '#events': 'orange', '#party': 'orange',
  // Recipes/Food 🍳
  '#food': 'rose', '#recipe': 'rose', '#cooking': 'rose', '#cafe': 'rose',
  '#coffee': 'rose', '#restaurant': 'rose', '#lunch': 'rose', '#dinner': 'rose',
  '#breakfast': 'rose',
  // Entertainment
  '#movies': 'purple', '#entertainment': 'purple', '#music': 'purple', '#shopping': 'orange',
  // Default
  '#memory': 'slate', '#text': 'slate', '#voice': 'slate', '#link': 'slate', '#image': 'slate',
}

const TAG_COLOR_SCHEMES: Record<string, { dark: { bg: string; text: string }; light: { bg: string; text: string } }> = {
  blue: {
    dark: { bg: 'rgba(59,130,246,0.12)', text: 'rgb(147,197,253)' },
    light: { bg: 'rgba(59,130,246,0.08)', text: 'rgb(37,99,235)' },
  },
  purple: {
    dark: { bg: 'rgba(168,85,247,0.12)', text: 'rgb(192,132,252)' },
    light: { bg: 'rgba(168,85,247,0.08)', text: 'rgb(126,34,206)' },
  },
  green: {
    dark: { bg: 'rgba(74,222,128,0.12)', text: 'rgb(134,239,172)' },
    light: { bg: 'rgba(74,222,128,0.08)', text: 'rgb(22,163,74)' },
  },
  orange: {
    dark: { bg: 'rgba(251,146,60,0.12)', text: 'rgb(253,186,116)' },
    light: { bg: 'rgba(251,146,60,0.08)', text: 'rgb(194,65,12)' },
  },
  rose: {
    dark: { bg: 'rgba(251,113,133,0.12)', text: 'rgb(253,164,175)' },
    light: { bg: 'rgba(251,113,133,0.08)', text: 'rgb(190,18,60)' },
  },
  slate: {
    dark: { bg: 'rgba(148,163,184,0.10)', text: 'rgba(148,163,184,0.7)' },
    light: { bg: 'rgba(100,116,139,0.08)', text: 'rgb(100,116,139)' },
  },
}

// Deterministic color assignment for unknown tags
function getTagColorScheme(tag: string) {
  const lowerTag = tag.toLowerCase()
  const category = CATEGORY_TAG_MAP[lowerTag]
  if (category && TAG_COLOR_SCHEMES[category]) {
    return TAG_COLOR_SCHEMES[category]
  }
  // Hash-based assignment for unknown tags
  let hash = 0
  for (let i = 0; i < lowerTag.length; i++) {
    hash = lowerTag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = Object.keys(TAG_COLOR_SCHEMES)
  const idx = Math.abs(hash) % colors.length
  return TAG_COLOR_SCHEMES[colors[idx]]
}

const TYPE_ACCENT_COLORS_DARK: Record<MemoryType, { border: string; bg: string; text: string; glow: string }> = {
  text: { border: 'rgba(157,139,167,0.6)', bg: 'rgba(157,139,167,0.1)', text: '#9D8BA7', glow: 'rgba(157,139,167,0.3)' },
  voice: { border: 'rgba(192,132,252,0.6)', bg: 'rgba(192,132,252,0.1)', text: '#c084fc', glow: 'rgba(192,132,252,0.3)' },
  link: { border: 'rgba(103,232,249,0.6)', bg: 'rgba(103,232,249,0.1)', text: '#67e8f9', glow: 'rgba(103,232,249,0.3)' },
  image: { border: 'rgba(134,239,172,0.6)', bg: 'rgba(134,239,172,0.1)', text: '#86efac', glow: 'rgba(134,239,172,0.3)' },
}

const TYPE_ACCENT_COLORS_LIGHT: Record<MemoryType, { border: string; bg: string; text: string; glow: string }> = {
  text: { border: 'rgba(157,139,167,0.3)', bg: 'rgba(157,139,167,0.08)', text: '#7c6d8a', glow: 'rgba(157,139,167,0.12)' },
  voice: { border: 'rgba(192,132,252,0.3)', bg: 'rgba(192,132,252,0.08)', text: '#9333ea', glow: 'rgba(192,132,252,0.12)' },
  link: { border: 'rgba(103,232,249,0.3)', bg: 'rgba(103,232,249,0.08)', text: '#0891b2', glow: 'rgba(103,232,249,0.12)' },
  image: { border: 'rgba(134,239,172,0.3)', bg: 'rgba(134,239,172,0.08)', text: '#16a34a', glow: 'rgba(134,239,172,0.12)' },
}

function typeIcon(type: MemoryType, size = 'size-4') {
  const accent = TYPE_ACCENT_COLORS_DARK[type]
  switch (type) {
    case 'voice':
      return <Mic className={size} style={{ color: accent.text }} />
    case 'link':
      return <Link2 className={size} style={{ color: accent.text }} />
    case 'image':
      return <ImageIcon className={size} style={{ color: accent.text }} />
    default:
      return <FileText className={size} style={{ color: accent.text }} />
  }
}

function formatRelativeDate(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getSmartFallbackTags(content: string, type: string): string[] {
  const lower = content.toLowerCase()
  const tags: string[] = []
  const topicMap: Record<string, string[]> = {
    cafe: ['#cafe', '#food'], coffee: ['#coffee', '#food'], restaurant: ['#restaurant', '#food'],
    lunch: ['#food', '#lunch'], dinner: ['#food', '#dinner'], breakfast: ['#food', '#breakfast'],
    meeting: ['#meeting', '#work'], project: ['#project', '#work'], code: ['#code', '#programming'],
    programming: ['#programming', '#tech'], book: ['#books', '#reading'], recipe: ['#recipe', '#food', '#cooking'],
    travel: ['#travel'], trip: ['#travel'], idea: ['#idea', '#creativity'],
    workout: ['#fitness', '#health'], gym: ['#fitness', '#health'], movie: ['#movies', '#entertainment'],
    music: ['#music'], shopping: ['#shopping'], budget: ['#finance', '#budgeting'],
    money: ['#finance'], doctor: ['#health', '#medical'], family: ['#family'],
    friend: ['#social', '#friends'], party: ['#social', '#events'],
    school: ['#education', '#learning'], study: ['#education', '#study'],
    design: ['#design', '#creative'], ai: ['#ai', '#technology'],
    startup: ['#startup', '#business'], product: ['#product', '#business'],
  }
  for (const [keyword, kTags] of Object.entries(topicMap)) {
    if (lower.includes(keyword)) { for (const t of kTags) { if (!tags.includes(t)) tags.push(t) } }
  }
  if (tags.length === 0) tags.push('#' + type)
  return tags.slice(0, 3)
}

function isUrl(text: string): boolean {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// ────────────────────────────────────────────────────────────
// Aurora Background
// ────────────────────────────────────────────────────────────

function AuroraBackground() {
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  if (isMobile) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-30"
        style={{
          background: `radial-gradient(ellipse, var(--aurora-purple) 0%, var(--aurora-purple-edge) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'auroraFloat1 12s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-1/3 -left-20 w-[400px] h-[300px] rounded-full opacity-20"
        style={{
          background: `radial-gradient(ellipse, var(--aurora-blue) 0%, var(--aurora-blue-edge) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'auroraFloat2 16s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-1/4 -right-20 w-[350px] h-[250px] rounded-full opacity-15"
        style={{
          background: `radial-gradient(ellipse, var(--aurora-pink) 0%, var(--aurora-pink-edge) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'auroraFloat3 14s ease-in-out infinite',
        }}
      />
      <style jsx>{`
        @keyframes auroraFloat1 {
          0%, 100% { transform: translateX(-50%) translateY(0px) scale(1); }
          50% { transform: translateX(-45%) translateY(-20px) scale(1.05); }
        }
        @keyframes auroraFloat2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(15px) scale(1.08); }
        }
        @keyframes auroraFloat3 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.03); }
        }
      `}</style>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// ADHD-FRIENDLY MEMORY CARD
// Principles: Visual Calm, Muted Tags, Hidden Actions, Breathable
// ────────────────────────────────────────────────────────────

const MemoryCard = memo(function MemoryCard({
  memory,
  onClick,
  onDelete,
  index = 0,
  darkMode = true,
  isNew = false,
}: {
  memory: Memory
  onClick: () => void
  onDelete?: () => void
  index?: number
  darkMode?: boolean
  isNew?: boolean
}) {
  const isTagging = memory.taggingStatus === 'tagging' || memory.taggingStatus === 'pending'
  const isSyncing = memory.syncStatus === 'pending' || memory.syncStatus === 'syncing'
  const [showMenu, setShowMenu] = useState(false)

  const previewContent = memory.type === 'link'
    ? memory.content.replace(/^\[From\s+.+?\]\s*\n*/, '').trim() || memory.content
    : memory.content

  const accent = darkMode ? TYPE_ACCENT_COLORS_DARK[memory.type] : TYPE_ACCENT_COLORS_LIGHT[memory.type]

  const displayTitle = memory.title.includes('http')
    ? (() => { try { return new URL(memory.title).hostname } catch { return memory.title } })()
    : memory.title

  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.9, y: 20 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={isNew
        ? { type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }
        : { duration: 0.3, delay: Math.min(index * 0.04, 0.3) }
      }
      className="relative w-full group"
    >
      {/* Dopamine glow effect on new cards */}
      {isNew && (
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: `0 0 30px ${accent.glow}, 0 0 60px ${accent.glow}`,
          }}
        />
      )}

      <div
        onClick={onClick}
        className="relative w-full text-left p-4 md:p-5 cursor-pointer active:scale-[0.99] rounded-2xl transition-all duration-200"
        style={darkMode
          ? {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
            }
          : {
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(0,0,0,0.05)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }
        }
      >
        <div className="flex items-start gap-3.5">
          {/* Type icon */}
          <div
            className="flex items-center justify-center size-8 rounded-xl shrink-0 mt-0.5 transition-colors duration-300"
            style={{ background: accent.bg }}
          >
            {typeIcon(memory.type, 'size-4')}
          </div>

          <div className="min-w-0 flex-1">
            {/* Title + time row */}
            <div className="flex items-start justify-between gap-3">
              <h3 className={`font-medium text-sm leading-snug truncate ${darkMode ? 'text-white/85' : 'text-gray-900'}`}>
                {displayTitle}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] whitespace-nowrap ${darkMode ? 'text-white/20' : 'text-gray-400'}`}>
                  {formatRelativeDate(memory.createdAt)}
                </span>
                {/* 3-dot menu — only visible on hover/tap */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-lg ${
                      darkMode ? 'hover:bg-white/5 text-white/30 hover:text-white/60' : 'hover:bg-black/5 text-gray-400 hover:text-gray-600'
                    }`}
                    aria-label="More actions"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute right-0 top-8 z-50 rounded-xl shadow-xl border py-1 min-w-[140px] ${
                          darkMode
                            ? 'bg-[#1a1a24] border-white/10'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); onClick(); setShowMenu(false) }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                            darkMode ? 'text-white/70 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Pencil size={12} /> View & Edit
                        </button>
                        {onDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false) }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                              darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Content preview */}
            <p className={`text-xs mt-1 line-clamp-2 leading-[1.6] ${darkMode ? 'text-white/30' : 'text-gray-500'}`} style={{ wordBreak: 'break-word' }}>
              {previewContent || <em className={darkMode ? 'text-white/15' : 'text-gray-300'}>No content</em>}
            </p>

            {/* ADHD-FRIENDLY MUTED TAGS — Soft, calming, never harsh */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap min-w-0">
              {memory.tags.slice(0, 3).map((tag, i) => {
                const colorScheme = getTagColorScheme(tag)
                const colors = darkMode ? colorScheme.dark : colorScheme.light
                return (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium transition-all duration-300"
                    style={{
                      background: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {isTagging ? (
                      <span className="animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                        {tag}
                      </span>
                    ) : tag}
                  </span>
                )
              })}
              {isSyncing && !isTagging && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-500/50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/25 opacity-75" />
                    <span className="relative inline-flex rounded-full size-1.5 bg-amber-500/40" />
                  </span>
                  Syncing
                </span>
              )}
              {isTagging && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ color: darkMode ? 'rgba(157,139,167,0.5)' : 'rgba(157,139,167,0.7)' }}
                >
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ background: 'rgba(157,139,167,0.2)' }} />
                    <span className="relative inline-flex rounded-full size-1.5"
                      style={{ background: 'rgba(157,139,167,0.3)' }} />
                  </span>
                  Thinking...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </motion.div>
  )
})

// ────────────────────────────────────────────────────────────
// CALM EMPTY STATE — No guilt, just calm invitation
// ────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-5 ${
        darkMode ? 'bg-white/[0.03]' : 'bg-gray-100'
      }`}>
        <Brain className={`size-8 ${darkMode ? 'text-white/15' : 'text-gray-300'}`} />
      </div>
      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white/60' : 'text-gray-700'}`}>
        A quiet space for your thoughts
      </h3>
      <p className={`text-sm max-w-xs leading-relaxed ${darkMode ? 'text-white/25' : 'text-gray-400'}`}>
        Type anything above — a thought, a link, an idea. Aether will take care of the rest.
      </p>
    </div>
  )
})

// ────────────────────────────────────────────────────────────
// ZERO-FRICTION CAPTURE BAR — One input, one mic, one save
// PRINCIPLE 1: "One-Click" Capture
// ────────────────────────────────────────────────────────────

function CaptureBar({ onSaved }: { onSaved: (id: string) => void }) {
  const { addMemory, updateMemory, autoTagging, user, darkMode } = useAetherStore()
  const { toast } = useToast()

  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateTags = useCallback(async (content: string, type: string): Promise<string[]> => {
    if (!content.trim()) return getSmartFallbackTags(content, type)
    const cached = getCachedTags(content, type)
    if (cached) return cached
    if (!autoTagging) return getSmartFallbackTags(content, type)
    try {
      const res = await fetch('/api/ai/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      })
      const data = await res.json()
      const tags = data.tags || ['#memory']
      setCachedTags(content, type, tags)
      return tags
    } catch {
      return getSmartFallbackTags(content, type)
    }
  }, [autoTagging])

  const handleSave = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content) return

    setIsSaving(true)
    const tempId = `mem-${Date.now()}`

    // Auto-detect type
    let type: MemoryType = 'text'
    if (isUrl(content)) type = 'link'

    const title = type === 'link'
      ? (() => { try { return new URL(content).hostname } catch { return 'Saved link' } })()
      : content.slice(0, 60)

    const fallbackTags = getSmartFallbackTags(content, type)
    const isOffline = !navigator.onLine

    // Add to UI immediately with dopamine pop
    addMemory({
      id: tempId,
      type,
      title,
      content,
      tags: fallbackTags,
      createdAt: new Date().toISOString(),
      taggingStatus: isOffline ? 'complete' : 'pending',
      syncStatus: isOffline ? 'pending' : 'synced',
      ...(type === 'link' ? { source: content, sourceUrl: content } : {}),
    })

    // Clear input immediately
    setInput('')
    setIsSaving(false)
    onSaved(tempId)

    // ✨ Dopamine hit: satisfying toast
    toast({
      title: 'Saved ✨',
      description: type === 'link' ? 'Link captured & enriching...' : 'Your thought is safe with Aether.',
    })

    // Background: AI tagging + save to Supabase
    const taggingTimeout = setTimeout(() => {
      updateMemory(tempId, { taggingStatus: 'tagging' })
    }, 2000)

    if (isOffline) {
      clearTimeout(taggingTimeout)
      try {
        await createMemory({ type, title, content, tags: fallbackTags, ...(type === 'link' ? { sourceUrl: content } : {}) })
      } catch {}
      return
    }

    try {
      if (user?.plan === 'free') {
        const count = await getMemoryCount()
        if (count >= 50) {
          clearTimeout(taggingTimeout)
          updateMemory(tempId, { taggingStatus: 'complete' })
          toast({ title: 'Free plan limit reached', description: 'Upgrade for unlimited memories.' })
          return
        }
      }

      if (type === 'link') {
        // Enrich link in background
        const [linkResult, savedMemory] = await Promise.all([
          fetch('/api/ai/fetch-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: content }),
          }).then(r => r.json()).catch(() => ({ success: false, title: '', description: '', content: '', siteName: '', image: '' })),
          createMemory({ type: 'link', title, content, tags: fallbackTags, sourceUrl: content }),
        ])

        let enrichedContent = content
        let enrichedTitle = title
        let siteName = ''
        let enrichedImage = ''

        if (linkResult.success) {
          siteName = linkResult.siteName || ''
          enrichedImage = linkResult.image || ''
          enrichedTitle = linkResult.title || title
          const parts: string[] = []
          if (siteName) parts.push(`[From ${siteName}]`)
          if (linkResult.description) parts.push(linkResult.description)
          if (linkResult.content) parts.push(linkResult.content)
          enrichedContent = parts.join('\n\n') || content
        }

        const tagContent = enrichedContent === content ? content : enrichedContent
        const [aiTags, insightResult] = await Promise.all([
          generateTags(tagContent, 'link'),
          fetch('/api/ai/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: tagContent, type: 'link', tags: fallbackTags, title: enrichedTitle }),
          }).then(r => r.json()).catch(() => ({ insight: '' })),
        ])

        clearTimeout(taggingTimeout)
        updateMemory(tempId, {
          id: savedMemory.id,
          title: enrichedTitle !== 'Saved link' ? enrichedTitle : title,
          content: enrichedContent,
          tags: aiTags,
          taggingStatus: 'complete',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(siteName ? { siteName } : {}),
          ...(enrichedImage ? { linkImage: enrichedImage, imagePreview: enrichedImage } : {}),
          ...(insightResult.insight ? { aiSummary: insightResult.insight } : {}),
        })

        updateMemoryById(savedMemory.id, {
          title: enrichedTitle !== 'Saved link' ? enrichedTitle : title,
          content: enrichedContent,
          tags: aiTags,
          ...(insightResult.insight ? { summary: insightResult.insight } : {}),
          ...(enrichedImage ? { imagePreview: enrichedImage } : {}),
        }).catch(() => {})
      } else {
        // Text/voice save
        const [savedMemory, aiTags] = await Promise.all([
          createMemory({ type, title, content, tags: fallbackTags }),
          generateTags(content, type),
        ])

        clearTimeout(taggingTimeout)
        updateMemory(tempId, {
          id: savedMemory.id,
          tags: aiTags,
          taggingStatus: 'complete',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(savedMemory.aiSummary ? { aiSummary: savedMemory.aiSummary } : {}),
        })
      }
    } catch {
      clearTimeout(taggingTimeout)
      try {
        const aiTags = await generateTags(content, type)
        updateMemory(tempId, { tags: aiTags, taggingStatus: 'complete' })
      } catch {
        updateMemory(tempId, { taggingStatus: 'complete' })
      }
    }
  }, [input, addMemory, updateMemory, autoTagging, user, generateTags, toast, onSaved])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        setIsTranscribing(true)

        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1]
          if (base64Audio) {
            try {
              const res = await fetch('/api/ai/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: base64Audio }),
              })
              const data = await res.json()
              if (data.transcription?.trim()) {
                setInput(data.transcription.trim())
                // Auto-focus input so user can review/edit and hit Save
                setTimeout(() => inputRef.current?.focus(), 100)
              }
            } catch {
              // Transcription failed — user can type manually
            } finally {
              setIsTranscribing(false)
            }
          }
        }
        reader.readAsDataURL(blob)
      }

      setMediaRecorder(recorder)
      recorder.start()
      setIsRecording(true)
    } catch {
      setIsRecording(false)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    setIsRecording(false)
  }, [mediaRecorder])

  const handleImageUpload = useCallback(async (file: File) => {
    const MAX_SIZE = 5 * 1024 * 1024
    let fileToRead = file
    if (file.size > MAX_SIZE) {
      toast({ title: 'Image too large', description: 'Try a smaller image (max 5MB).', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    const tempId = `mem-${Date.now()}`
    const reader = new FileReader()
    reader.onloadend = async () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]

      if (base64) {
        try {
          const res = await fetch('/api/ai/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl }),
          })
          const data = await res.json()

          const description = data.description || 'Captured image'
          const title = data.title || description.slice(0, 50) || 'Image capture'
          const tags = (data.tags && data.tags.length > 0) ? data.tags : getSmartFallbackTags(description, 'image')

          addMemory({
            id: tempId,
            type: 'image',
            title,
            content: description,
            tags,
            createdAt: new Date().toISOString(),
            taggingStatus: 'complete',
            syncStatus: 'synced',
            imagePreview: dataUrl,
            aiSummary: `AI detected: ${description}`,
          })

          onSaved(tempId)
          toast({ title: 'Saved ✨', description: 'Image captured and analyzed.' })

          // Save to Supabase in background
          try {
            await createMemory({ type: 'image', title, content: description, tags, summary: `AI detected: ${description}`, imagePreview: dataUrl })
          } catch {}
        } catch {
          // Image analysis failed
          addMemory({
            id: tempId,
            type: 'image',
            title: 'Image capture',
            content: 'Captured image',
            tags: ['#image'],
            createdAt: new Date().toISOString(),
            taggingStatus: 'complete',
            syncStatus: 'pending',
          })
          onSaved(tempId)
          toast({ title: 'Saved ✨', description: 'Image saved. AI analysis will complete shortly.' })
        } finally {
          setIsSaving(false)
        }
      }
    }
    reader.readAsDataURL(fileToRead)
  }, [addMemory, autoTagging, onSaved, toast])

  // Auto-detect URL on paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    // If it looks like a URL, auto-save immediately
    if (pastedText && isUrl(pastedText.trim())) {
      e.preventDefault()
      setInput(pastedText.trim())
      // Auto-save after a tiny delay so the user sees the input
      setTimeout(() => handleSave(pastedText.trim()), 100)
    }
  }, [handleSave])

  return (
    <div className={`shrink-0 px-4 md:px-6 pt-4 md:pt-5 pb-3 ${darkMode ? 'bg-[#050505]' : 'bg-gray-50'}`}>
      <div className="md:max-w-3xl md:mx-auto">
        <div
          className={`relative flex items-center rounded-2xl transition-all duration-200 overflow-hidden ${
            darkMode
              ? 'bg-white/[0.04] border border-white/[0.06] focus-within:border-[#9D8BA7]/25 focus-within:bg-white/[0.06]'
              : 'bg-white border border-gray-200 focus-within:border-[#9D8BA7]/30 shadow-sm'
          }`}
        >
          {/* Main input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                e.preventDefault()
                handleSave()
              }
            }}
            onPaste={handlePaste}
            placeholder="Dump a thought here..."
            disabled={isSaving || isRecording || isTranscribing}
            autoComplete="off"
            aria-label="Capture a thought"
            className={`flex-1 h-12 px-4 text-sm bg-transparent focus:outline-none placeholder:transition-colors duration-200 ${
              darkMode
                ? 'text-white/85 placeholder:text-white/20'
                : 'text-gray-900 placeholder:text-gray-400'
            }`}
          />

          {/* Transcribing indicator */}
          {isTranscribing && (
            <span className="flex items-center gap-1.5 text-xs pr-2" style={{ color: darkMode ? 'rgba(157,139,167,0.6)' : 'rgba(157,139,167,0.8)' }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="hidden sm:inline">Transcribing…</span>
            </span>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 text-xs pr-2 text-red-400 hover:text-red-300 transition-colors"
              aria-label="Stop recording"
            >
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-red-500" />
              </span>
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 pr-2">
            {/* Mic button */}
            {!isRecording && !isTranscribing && (
              <button
                onClick={startRecording}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  darkMode
                    ? 'text-white/20 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/10 active:bg-[#9D8BA7]/15'
                    : 'text-gray-400 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 active:bg-[#9D8BA7]/10'
                }`}
                aria-label="Voice capture"
              >
                <Mic size={18} />
              </button>
            )}

            {/* Image upload button */}
            {!isRecording && !isTranscribing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  darkMode
                    ? 'text-white/20 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/10 active:bg-[#9D8BA7]/15'
                    : 'text-gray-400 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 active:bg-[#9D8BA7]/10'
                }`}
                aria-label="Upload image"
              >
                <ImagePlus size={18} />
              </button>
            )}

            {/* Save button */}
            {input.trim() && !isRecording && !isTranscribing && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => handleSave()}
                className="p-2 rounded-xl bg-[#9D8BA7] text-white hover:bg-[#7A6B85] active:scale-95 transition-all duration-200"
                aria-label="Save thought"
              >
                <Send size={16} />
              </motion.button>
            )}

            {isSaving && !isRecording && (
              <div className="p-2">
                <Loader2 size={16} className="animate-spin text-[#9D8BA7]" />
              </div>
            )}
          </div>

          {/* Hidden file input for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
              e.target.value = '' // Reset so same file can be re-selected
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// CALM DASHBOARD — Just CaptureBar + Feed, nothing else
// PRINCIPLE 5: The Calm Dashboard
// ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    memories,
    currentView,
    selectedMemoryId,
    setSelectedMemoryId,
    setCurrentView,
    deleteMemory,
    isLoadingMemories,
    darkMode,
  } = useAetherStore()

  const [newlySavedId, setNewlySavedId] = useState<string | null>(null)

  // Filter by search if active
  const filteredMemories = useMemo(() => {
    return memories // No filtering on dashboard — show everything chronologically
  }, [memories])

  const handleCardClick = useCallback((memoryId: string) => {
    setSelectedMemoryId(memoryId)
    setCurrentView('memory-detail')
  }, [setSelectedMemoryId, setCurrentView])

  const handleDelete = useCallback(async (memoryId: string) => {
    deleteMemory(memoryId)
    try {
      await deleteMemoryById(memoryId)
    } catch {}
  }, [deleteMemory])

  const handleSaved = useCallback((tempId: string) => {
    setNewlySavedId(tempId)
    // Clear the "new" highlight after 2s
    setTimeout(() => setNewlySavedId(null), 2000)
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      {/* Aurora Background — desktop only */}
      <AuroraBackground />

      {/* ═══ CAPTURE BAR — The hero of the calm dashboard ═══ */}
      <div className="relative z-10">
        <CaptureBar onSaved={handleSaved} />
      </div>

      {/* ═══ MEMORY FEED — Clean, breathable, reverse-chronological ═══ */}
      <div className={`flex-1 min-h-0 overflow-y-auto ios-scroll px-4 md:px-6 pb-4 relative z-10 ${
        darkMode ? 'bg-[#050505]' : 'bg-gray-50'
      }`}>
        <div className="md:max-w-3xl md:mx-auto">
          {filteredMemories.length === 0 && !isLoadingMemories ? (
            <EmptyState darkMode={darkMode} />
          ) : (
            <div className="flex flex-col gap-4 py-3 md:py-4">
              <AnimatePresence mode="popLayout">
                {filteredMemories.map((memory, index) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => handleCardClick(memory.id)}
                    onDelete={() => handleDelete(memory.id)}
                    index={index}
                    darkMode={darkMode}
                    isNew={memory.id === newlySavedId}
                  />
                ))}
              </AnimatePresence>

              {/* Loading more indicator */}
              {isLoadingMemories && (
                <div className="flex justify-center py-6">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-white/10 border-t-[#9D8BA7] animate-spin" />
                    <span className={`text-xs ${darkMode ? 'text-white/25' : 'text-gray-400'}`}>Loading memories...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
