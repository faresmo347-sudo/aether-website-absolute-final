'use client'

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, FileText, Link2, ImageIcon, X, Plus, Brain, Loader2, Sparkles, Send, ImagePlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import { createMemory, getMemoryCount, updateMemoryById, deleteMemoryById } from '@/lib/supabase/data'
import { getCachedTags, setCachedTags } from '@/lib/tag-cache'
import type { Memory, MemoryType } from '@/components/aether/types'
import { useToast } from '@/hooks/use-toast'

// ────────────────────────────────────────────────────────────
// SPRING PHYSICS — Premium, physical, alive
// ────────────────────────────────────────────────────────────

const SPRING_BOUNCE = { type: 'spring' as const, stiffness: 400, damping: 17 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 260, damping: 22 }
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 180, damping: 20 }

// ────────────────────────────────────────────────────────────
// STAGGER CONTAINERS — "Like a machine sorting your thoughts"
// ────────────────────────────────────────────────────────────

const feedContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const feedItemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: SPRING_SMOOTH,
  },
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const CATEGORY_TAG_MAP: Record<string, string> = {
  '#work': 'blue', '#meeting': 'blue', '#project': 'blue', '#code': 'blue',
  '#programming': 'blue', '#startup': 'blue', '#business': 'blue', '#product': 'blue',
  '#tech': 'blue', '#technology': 'blue', '#finance': 'blue', '#budgeting': 'blue',
  '#idea': 'purple', '#creativity': 'purple', '#design': 'purple', '#creative': 'purple',
  '#ai': 'purple', '#books': 'purple', '#reading': 'purple', '#education': 'purple',
  '#learning': 'purple', '#study': 'purple',
  '#personal': 'green', '#health': 'green', '#fitness': 'green', '#medical': 'green',
  '#family': 'green', '#social': 'green', '#friends': 'green',
  '#travel': 'orange', '#trip': 'orange', '#events': 'orange', '#party': 'orange',
  '#food': 'rose', '#recipe': 'rose', '#cooking': 'rose', '#cafe': 'rose',
  '#coffee': 'rose', '#restaurant': 'rose', '#lunch': 'rose', '#dinner': 'rose',
  '#breakfast': 'rose',
  '#movies': 'purple', '#entertainment': 'purple', '#music': 'purple', '#shopping': 'orange',
  '#memory': 'slate', '#text': 'slate', '#voice': 'slate', '#link': 'slate', '#image': 'slate',
}

const TAG_COLOR_SCHEMES: Record<string, { dark: { bg: string; text: string }; light: { bg: string; text: string } }> = {
  blue: {
    dark: { bg: 'rgba(59,130,246,0.08)', text: 'rgba(147,197,253,0.6)' },
    light: { bg: 'rgba(59,130,246,0.06)', text: 'rgb(37,99,235)' },
  },
  purple: {
    dark: { bg: 'rgba(168,85,247,0.08)', text: 'rgba(192,132,252,0.6)' },
    light: { bg: 'rgba(168,85,247,0.06)', text: 'rgb(126,34,206)' },
  },
  green: {
    dark: { bg: 'rgba(74,222,128,0.08)', text: 'rgba(134,239,172,0.6)' },
    light: { bg: 'rgba(74,222,128,0.06)', text: 'rgb(22,163,74)' },
  },
  orange: {
    dark: { bg: 'rgba(251,146,60,0.08)', text: 'rgba(253,186,116,0.6)' },
    light: { bg: 'rgba(251,146,60,0.06)', text: 'rgb(194,65,12)' },
  },
  rose: {
    dark: { bg: 'rgba(251,113,133,0.08)', text: 'rgba(253,164,175,0.6)' },
    light: { bg: 'rgba(251,113,133,0.06)', text: 'rgb(190,18,60)' },
  },
  slate: {
    dark: { bg: 'rgba(148,163,184,0.06)', text: 'rgba(148,163,184,0.4)' },
    light: { bg: 'rgba(100,116,139,0.06)', text: 'rgb(100,116,139)' },
  },
}

function getTagColorScheme(tag: string) {
  const lowerTag = tag.toLowerCase()
  const category = CATEGORY_TAG_MAP[lowerTag]
  if (category && TAG_COLOR_SCHEMES[category]) return TAG_COLOR_SCHEMES[category]
  let hash = 0
  for (let i = 0; i < lowerTag.length; i++) {
    hash = lowerTag.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = Object.keys(TAG_COLOR_SCHEMES)
  const idx = Math.abs(hash) % colors.length
  return TAG_COLOR_SCHEMES[colors[idx]]
}

const TYPE_ACCENT_COLORS_DARK: Record<MemoryType, { border: string; bg: string; text: string; glow: string }> = {
  text: { border: 'rgba(157,139,167,0.4)', bg: 'rgba(157,139,167,0.06)', text: '#9D8BA7', glow: 'rgba(157,139,167,0.2)' },
  voice: { border: 'rgba(192,132,252,0.4)', bg: 'rgba(192,132,252,0.06)', text: '#c084fc', glow: 'rgba(192,132,252,0.2)' },
  link: { border: 'rgba(125,211,232,0.4)', bg: 'rgba(125,211,232,0.06)', text: '#7DD3E8', glow: 'rgba(125,211,232,0.2)' },
  image: { border: 'rgba(134,239,172,0.4)', bg: 'rgba(134,239,172,0.06)', text: '#86efac', glow: 'rgba(134,239,172,0.2)' },
}

const TYPE_ACCENT_COLORS_LIGHT: Record<MemoryType, { border: string; bg: string; text: string; glow: string }> = {
  text: { border: 'rgba(157,139,167,0.2)', bg: 'rgba(157,139,167,0.06)', text: '#7c6d8a', glow: 'rgba(157,139,167,0.1)' },
  voice: { border: 'rgba(192,132,252,0.2)', bg: 'rgba(192,132,252,0.06)', text: '#9333ea', glow: 'rgba(192,132,252,0.1)' },
  link: { border: 'rgba(125,211,232,0.2)', bg: 'rgba(125,211,232,0.06)', text: '#0891b2', glow: 'rgba(125,211,232,0.1)' },
  image: { border: 'rgba(134,239,172,0.2)', bg: 'rgba(134,239,172,0.06)', text: '#16a34a', glow: 'rgba(134,239,172,0.1)' },
}

function typeIcon(type: MemoryType, size = 'size-4') {
  const accent = TYPE_ACCENT_COLORS_DARK[type]
  switch (type) {
    case 'voice': return <Mic className={size} style={{ color: accent.text }} />
    case 'link': return <Link2 className={size} style={{ color: accent.text }} />
    case 'image': return <ImageIcon className={size} style={{ color: accent.text }} />
    default: return <FileText className={size} style={{ color: accent.text }} />
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
// Aurora Background — Midnight Oasis
// ────────────────────────────────────────────────────────────

function AuroraBackground() {
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  if (isMobile) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full animate-aurora-breathe"
        style={{
          background: `radial-gradient(ellipse, rgba(99, 102, 241, 0.12) 0%, rgba(157, 139, 167, 0.05) 40%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute top-1/3 -left-20 w-[400px] h-[300px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(125, 211, 232, 0.08) 0%, rgba(94, 234, 212, 0.03) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'aurora-breathe 18s ease-in-out 4s infinite',
        }}
      />
      <div
        className="absolute top-1/4 -right-20 w-[350px] h-[250px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(192, 132, 252, 0.1) 0%, rgba(157, 139, 167, 0.03) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'aurora-breathe 14s ease-in-out 7s infinite',
        }}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// MEMORY CARD — Spring physics, stagger animation, hover glow
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
      variants={feedItemVariants}
      className="relative w-full group"
    >
      {/* Dopamine glow pulse on new cards */}
      {isNew && (
        <motion.div
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2, ease: 'easeOut' }}
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            boxShadow: `0 0 25px ${accent.glow}, 0 0 50px ${accent.glow}, inset 0 0 25px ${accent.glow}`,
            border: `1px solid ${accent.border}`,
          }}
        />
      )}

      <motion.div
        onClick={onClick}
        whileHover={{ y: -2, boxShadow: darkMode ? '0 8px 30px rgba(124,58,237,0.08)' : '0 4px 12px rgba(0,0,0,0.08)' }}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_GENTLE}
        className="relative w-full text-left p-4 md:p-5 cursor-pointer rounded-2xl"
        style={darkMode
          ? {
              background: 'rgba(255,255,255,0.03)',
              border: isNew ? `1px solid rgba(192,132,252,0.5)` : '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              transition: 'border-color 1.5s ease-out',
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
              <h3 className={`font-medium text-sm leading-snug truncate ${darkMode ? 'text-white/80' : 'text-gray-900'}`}>
                {displayTitle}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                {/* Syncing indicator — tiny, elegant */}
                {isSyncing && !isTagging && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative flex size-2"
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/20 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2 bg-amber-500/30" />
                  </motion.span>
                )}
                <span className={`text-[11px] whitespace-nowrap ${darkMode ? 'text-white/15' : 'text-gray-400'}`}>
                  {formatRelativeDate(memory.createdAt)}
                </span>
                {/* 3-dot menu — only on hover */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-lg ${
                      darkMode ? 'hover:bg-white/5 text-white/20 hover:text-white/50' : 'hover:bg-black/5 text-gray-400 hover:text-gray-600'
                    }`}
                    aria-label="More actions"
                  >
                    <MoreHorizontal size={14} />
                  </motion.button>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={SPRING_BOUNCE}
                        className={`absolute right-0 top-8 z-50 rounded-xl shadow-xl border py-1 min-w-[140px] ${
                          darkMode ? 'bg-[#161428] border-white/10' : 'bg-white border-gray-200'
                        }`}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); onClick(); setShowMenu(false) }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                            darkMode ? 'text-white/60 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Pencil size={12} /> View & Edit
                        </button>
                        {onDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false) }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                              darkMode ? 'text-red-400/70 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
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

            {/* Content preview — softer */}
            <p className={`text-xs mt-1.5 line-clamp-2 leading-[1.65] ${darkMode ? 'text-white/20' : 'text-gray-500'}`} style={{ wordBreak: 'break-word' }}>
              {previewContent || <em className={darkMode ? 'text-white/10' : 'text-gray-300'}>No content</em>}
            </p>

            {/* INVISIBLE TAGS + Status indicators */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap min-w-0">
              {memory.tags.slice(0, 3).map((tag, i) => {
                const colorScheme = getTagColorScheme(tag)
                const colors = darkMode ? colorScheme.dark : colorScheme.light
                return (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap font-medium transition-all duration-300"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {isTagging ? (
                      <span className="animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                        {tag}
                      </span>
                    ) : tag}
                  </span>
                )
              })}
              {isTagging && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ color: darkMode ? 'rgba(157,139,167,0.3)' : 'rgba(157,139,167,0.5)' }}
                >
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ background: 'rgba(157,139,167,0.15)' }} />
                    <span className="relative inline-flex rounded-full size-1.5"
                      style={{ background: 'rgba(157,139,167,0.2)' }} />
                  </span>
                  Thinking...
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Click outside to close menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </motion.div>
  )
})

// ────────────────────────────────────────────────────────────
// CALM EMPTY STATE
// ────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState({ darkMode }: { darkMode: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className="flex flex-col items-center justify-center py-24 px-4 text-center"
    >
      <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-6 ${
        darkMode ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-gray-100'
      }`}>
        <Brain className={`size-8 ${darkMode ? 'text-white/10' : 'text-gray-300'}`} />
      </div>
      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white/50' : 'text-gray-700'}`}>
        A quiet space for your thoughts
      </h3>
      <p className={`text-sm max-w-xs leading-relaxed ${darkMode ? 'text-white/20' : 'text-gray-400'}`}>
        Type anything above — a thought, a link, an idea. Aether will take care of the rest.
      </p>
    </motion.div>
  )
})

// ────────────────────────────────────────────────────────────
// WEB SPEECH API HOOK — Real-time on-device transcription
// ────────────────────────────────────────────────────────────

function useWebSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported] = useState(() => {
    if (typeof window === 'undefined') return false
    return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
  })
  const recognitionRef = useRef<any>(null)

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return false

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let finalTranscript = ''

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      setTranscript(finalTranscript + interim)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setTranscript('')
    return true
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  return { isListening, transcript, isSupported, startListening, stopListening }
}

// ────────────────────────────────────────────────────────────
// DOPAMINE CAPTURE BAR — Premium, glowing, addictive
// Web Speech API for real-time voice transcription
// ────────────────────────────────────────────────────────────

function CaptureBar({ onSaved }: { onSaved: (id: string) => void }) {
  const { addMemory, updateMemory, autoTagging, user, darkMode } = useAetherStore()
  const { toast } = useToast()

  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [savePulse, setSavePulse] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Web Speech API for real-time voice transcription
  const { isListening, transcript, isSupported: speechSupported, startListening, stopListening } = useWebSpeechRecognition()

  // Update input as voice transcription comes in real-time
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript)
    }
  }, [transcript, isListening])

  // When voice stops, auto-save
  const voiceAutoSaveRef = useRef(false)
  useEffect(() => {
    if (!isListening && transcript && input === transcript && input.trim()) {
      voiceAutoSaveRef.current = true
    } else {
      voiceAutoSaveRef.current = false
    }
  }, [isListening, transcript, input])

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

    let type: MemoryType = 'text'
    if (isUrl(content)) type = 'link'

    const title = type === 'link'
      ? (() => { try { return new URL(content).hostname } catch { return 'Saved link' } })()
      : content.slice(0, 60)

    const fallbackTags = getSmartFallbackTags(content, type)
    const isOffline = !navigator.onLine

    // ✨ OPTIMISTIC UI — Instantly add to feed
    addMemory({
      id: tempId,
      type,
      title,
      content,
      tags: fallbackTags,
      createdAt: new Date().toISOString(),
      taggingStatus: isOffline ? 'complete' : 'pending',
      syncStatus: isOffline ? 'pending' : 'syncing', // Show syncing indicator
      ...(type === 'link' ? { source: content, sourceUrl: content } : {}),
    })

    // ✨ DOPAMINE HIT — Pulse the save button
    setSavePulse(true)
    setTimeout(() => setSavePulse(false), 600)

    setInput('')
    setIsSaving(false)
    onSaved(tempId)

    // ✨ Dopamine toast — "Saved to your universe ✨"
    toast({
      title: 'Saved to your universe ✨',
      description: type === 'link' ? 'Link captured & enriching...' : 'Your thought is safe with Aether.',
    })

    const taggingTimeout = setTimeout(() => {
      updateMemory(tempId, { taggingStatus: 'tagging' })
    }, 2000)

    if (isOffline) {
      clearTimeout(taggingTimeout)
      try {
        await createMemory({ type, title, content, tags: fallbackTags, ...(type === 'link' ? { sourceUrl: content } : {}) })
        updateMemory(tempId, { syncStatus: 'synced' })
      } catch {
        // Already in store with pending status
      }
      return
    }

    try {
      if (user?.plan === 'free') {
        const count = await getMemoryCount()
        if (count >= 50) {
          clearTimeout(taggingTimeout)
          updateMemory(tempId, { taggingStatus: 'complete', syncStatus: 'synced' })
          toast({ title: 'Free plan limit reached', description: 'Upgrade for unlimited memories.' })
          return
        }
      }

      if (type === 'link') {
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
          syncStatus: 'synced',
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
        const [savedMemory, aiTags] = await Promise.all([
          createMemory({ type, title, content, tags: fallbackTags }),
          generateTags(content, type),
        ])

        clearTimeout(taggingTimeout)
        updateMemory(tempId, {
          id: savedMemory.id,
          tags: aiTags,
          taggingStatus: 'complete',
          syncStatus: 'synced',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(savedMemory.aiSummary ? { aiSummary: savedMemory.aiSummary } : {}),
        })
      }
    } catch {
      clearTimeout(taggingTimeout)
      try {
        const aiTags = await generateTags(content, type)
        updateMemory(tempId, { tags: aiTags, taggingStatus: 'complete', syncStatus: 'synced' })
      } catch {
        updateMemory(tempId, { taggingStatus: 'complete', syncStatus: 'synced' })
      }
    }
  }, [input, addMemory, updateMemory, autoTagging, user, generateTags, toast, onSaved])

  // Auto-save when voice stops (after handleSave is defined)
  useEffect(() => {
    if (voiceAutoSaveRef.current && transcript.trim()) {
      const timer = setTimeout(() => {
        handleSave(transcript)
        voiceAutoSaveRef.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [voiceAutoSaveRef.current, transcript, handleSave])

  const handleImageUpload = useCallback(async (file: File) => {
    const MAX_SIZE = 5 * 1024 * 1024
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
          toast({ title: 'Saved to your universe ✨', description: 'Image captured and analyzed.' })

          try {
            await createMemory({ type: 'image', title, content: description, tags, summary: `AI detected: ${description}`, imagePreview: dataUrl })
          } catch {}
        } catch {
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
          toast({ title: 'Saved to your universe ✨', description: 'Image saved. AI analysis will complete shortly.' })
        } finally {
          setIsSaving(false)
        }
      }
    }
    reader.readAsDataURL(file)
  }, [addMemory, autoTagging, onSaved, toast])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    if (pastedText && isUrl(pastedText.trim())) {
      e.preventDefault()
      setInput(pastedText.trim())
      setTimeout(() => handleSave(pastedText.trim()), 100)
    }
  }, [handleSave])

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      const started = startListening()
      if (!started) {
        // Fallback: no Web Speech API support
        toast({ title: 'Voice not available', description: 'Try typing instead.' })
      }
    }
  }, [isListening, startListening, stopListening, toast])

  return (
    <div className={`shrink-0 px-4 md:px-6 pt-4 md:pt-5 pb-3 ${darkMode ? 'bg-[#0A0A14]' : 'bg-gray-50'}`}>
      <div className="md:max-w-3xl md:mx-auto">
        <div
          className={`relative flex items-center rounded-2xl transition-all duration-300 overflow-hidden ${
            darkMode
              ? isFocused || isListening
                ? 'bg-white/[0.05] border border-[#c084fc]/25 shadow-[0_0_30px_rgba(192,132,252,0.08)]'
                : 'bg-white/[0.03] border border-white/[0.06]'
              : isFocused || isListening
                ? 'bg-white border border-[#9D8BA7]/30 shadow-sm'
                : 'bg-white border border-gray-200 shadow-sm'
          }`}
          style={darkMode ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : undefined}
        >
          {/* Voice recording indicator */}
          {isListening && (
            <div className="flex items-center gap-2 pl-4">
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="size-2.5 rounded-full bg-red-500"
              />
              <span className="text-xs text-red-400 font-medium">Listening...</span>
            </div>
          )}

          {/* Main input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                e.preventDefault()
                handleSave()
              }
            }}
            onPaste={handlePaste}
            placeholder={isListening ? 'Speak your thought...' : 'Dump a thought here...'}
            disabled={isSaving}
            autoComplete="off"
            aria-label="Capture a thought"
            className={`flex-1 h-12 px-4 text-sm bg-transparent focus:outline-none placeholder:transition-colors duration-300 ${
              darkMode
                ? 'text-white/85 placeholder:text-white/15'
                : 'text-gray-900 placeholder:text-gray-400'
            }`}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 pr-2">
            {/* Mic button — Web Speech API */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_BOUNCE}
              onClick={handleMicClick}
              className={`p-2 rounded-xl transition-all duration-200 ${
                isListening
                  ? 'bg-red-500/10 text-red-400'
                  : darkMode
                    ? 'text-white/15 hover:text-[#c084fc] hover:bg-[#c084fc]/8 active:bg-[#c084fc]/12'
                    : 'text-gray-400 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 active:bg-[#9D8BA7]/10'
              }`}
              aria-label={isListening ? 'Stop voice capture' : 'Start voice capture'}
            >
              <Mic size={18} />
            </motion.button>

            {/* Image upload */}
            {!isListening && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={SPRING_BOUNCE}
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  darkMode
                    ? 'text-white/15 hover:text-[#c084fc] hover:bg-[#c084fc]/8 active:bg-[#c084fc]/12'
                    : 'text-gray-400 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 active:bg-[#9D8BA7]/10'
                }`}
                aria-label="Upload image"
              >
                <ImagePlus size={18} />
              </motion.button>
            )}

            {/* Save button — dopamine pulse */}
            {input.trim() && !isListening && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: savePulse ? [1, 1.2, 1] : 1,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={savePulse ? { duration: 0.3 } : SPRING_BOUNCE}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSave()}
                className="p-2 rounded-xl transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #9D8BA7, #7c3aed)',
                  color: 'white',
                  boxShadow: savePulse
                    ? '0 0 30px rgba(192, 132, 252, 0.6), 0 0 60px rgba(157, 139, 167, 0.3)'
                    : '0 0 20px rgba(157, 139, 167, 0.3)',
                  transition: 'box-shadow 0.3s ease',
                }}
                aria-label="Save thought"
              >
                <Send size={16} />
              </motion.button>
            )}

            {isSaving && !isListening && (
              <div className="p-2">
                <Loader2 size={16} className="animate-spin text-[#c084fc]" />
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// CALM DASHBOARD — CaptureBar + Staggered Feed
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

  const filteredMemories = useMemo(() => {
    return memories
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
    setTimeout(() => setNewlySavedId(null), 2000)
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      {/* Aurora Background — desktop only */}
      <AuroraBackground />

      {/* ═══ CAPTURE BAR ═══ */}
      <div className="relative z-10">
        <CaptureBar onSaved={handleSaved} />
      </div>

      {/* ═══ MEMORY FEED — Staggered animations, calm spacing ═══ */}
      <div className={`flex-1 min-h-0 overflow-y-auto ios-scroll px-4 md:px-6 pb-4 relative z-10 ${
        darkMode ? 'bg-[#0A0A14]' : 'bg-gray-50'
      }`}>
        <div className="md:max-w-3xl md:mx-auto">
          {filteredMemories.length === 0 && !isLoadingMemories ? (
            <EmptyState darkMode={darkMode} />
          ) : (
            <motion.div
              className="flex flex-col gap-5 py-3 md:py-4"
              variants={feedContainerVariants}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence mode="popLayout">
                {filteredMemories.map((memory, index) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => handleCardClick(memory.id)}
                    onDelete={() => handleDelete(memory.id)}
                    index={index}
                    darkMode={darkMode}
                    isNew={newlySavedId === memory.id}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
          {isLoadingMemories && filteredMemories.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-5 w-5 rounded-full border-2 border-white/10 border-t-[#c084fc]"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
