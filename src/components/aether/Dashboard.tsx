'use client'

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, Loader2, Send, ImagePlus, MoreHorizontal, Pencil, Trash2, Sparkles, RotateCcw } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import { createMemory, getMemoryCount, updateMemoryById, deleteMemoryById } from '@/lib/supabase/data'
import { getCachedTags, setCachedTags } from '@/lib/tag-cache'
import type { Memory, MemoryType } from '@/components/aether/types'
import { useToast } from '@/hooks/use-toast'

// ────────────────────────────────────────────────────────────
// SPRING PHYSICS — tuned for ADHD micro-interactions
// ────────────────────────────────────────────────────────────

const SPRING_BOUNCE = { type: 'spring' as const, stiffness: 400, damping: 17 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 260, damping: 22 }
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 180, damping: 20 }

// ────────────────────────────────────────────────────────────
// 5 FIXED CATEGORIES — invisible to user, used for auto-tag badge
// ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Work', emoji: '💼', color: '#3b82f6' },
  { name: 'Ideas', emoji: '💡', color: '#a855f7' },
  { name: 'Personal', emoji: '🌿', color: '#22c55e' },
  { name: 'Travel', emoji: '✈️', color: '#f97316' },
  { name: 'Recipes', emoji: '🍳', color: '#ef4444' },
] as const

function getCategoryFromTags(tags: string[]): { name: string; emoji: string } {
  if (!tags || tags.length === 0) return { name: 'Personal', emoji: '🌿' }

  const lower = tags.join(' ').toLowerCase()

  // Work patterns
  if (/work|meeting|project|deadline|office|client|email|task|sprint|standup|qa|deploy|review/.test(lower)) {
    return { name: 'Work', emoji: '💼' }
  }
  // Ideas patterns
  if (/idea|concept|creative|design|brainstorm|startup|invent|build|app|feature|prototype/.test(lower)) {
    return { name: 'Ideas', emoji: '💡' }
  }
  // Travel patterns
  if (/travel|trip|flight|hotel|vacation|visit|city|country|airport|airbnb|booking/.test(lower)) {
    return { name: 'Travel', emoji: '✈️' }
  }
  // Recipes patterns
  if (/recipe|cook|food|meal|dinner|lunch|breakfast|ingredient|bake|chef|restaurant|cafe/.test(lower)) {
    return { name: 'Recipes', emoji: '🍳' }
  }

  return { name: 'Personal', emoji: '🌿' }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

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

/** Generate a human-friendly title from raw content (client-side heuristic) */
function generateFriendlyTitle(content: string, type: string): string {
  if (type === 'link') {
    try {
      const hostname = new URL(content).hostname.replace('www.', '')
      // Capitalize first letter
      return hostname.charAt(0).toUpperCase() + hostname.slice(1) + ' link'
    } catch {
      return 'Saved link'
    }
  }

  // For text: try to extract the core idea in a few words
  const cleaned = content.trim()
  if (cleaned.length <= 40) return cleaned

  // Try first sentence or clause
  const firstClause = cleaned.split(/[.!?,;:]/)[0].trim()
  if (firstClause.length <= 50) return firstClause

  // Truncate to last complete word under 45 chars
  const truncated = cleaned.slice(0, 45)
  const lastSpace = truncated.lastIndexOf(' ')
  return truncated.slice(0, lastSpace > 0 ? lastSpace : 45) + '...'
}

// ────────────────────────────────────────────────────────────
// Aurora Background — Deep Space (#050510)
// ────────────────────────────────────────────────────────────

function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full animate-aurora-breathe"
        style={{
          background: `radial-gradient(ellipse, rgba(99, 102, 241, 0.08) 0%, rgba(157, 139, 167, 0.03) 40%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute top-1/3 -left-20 w-[350px] h-[250px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(125, 211, 232, 0.04) 0%, rgba(94, 234, 212, 0.01) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'aurora-breathe 18s ease-in-out 4s infinite',
        }}
      />
      <div
        className="absolute top-1/4 -right-20 w-[300px] h-[200px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(192, 132, 252, 0.06) 0%, rgba(157, 139, 167, 0.01) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'aurora-breathe 14s ease-in-out 7s infinite',
        }}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// UPGRADE 1: AUTO-TAG BADGE — Dopamine hit after save
// Shows "Context Identified: Work 💼" and fades away
// ────────────────────────────────────────────────────────────

function AutoTagBadge({ category, visible }: { category: { name: string; emoji: string }; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: 'rgba(192, 132, 252, 0.08)',
            border: '1px solid rgba(192, 132, 252, 0.15)',
            color: 'rgba(192, 132, 252, 0.8)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span>{category.emoji}</span>
          <span>Context: {category.name}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ────────────────────────────────────────────────────────────
// MEMORY CARD — Flat glassmorphism, no tags, human-friendly title
// ────────────────────────────────────────────────────────────

const MemoryCard = memo(function MemoryCard({
  memory,
  onClick,
  onDelete,
  darkMode = true,
  isNew = false,
  isFloating = false,
  floatIndex = 0,
}: {
  memory: Memory
  onClick: () => void
  onDelete?: () => void
  index?: number
  darkMode?: boolean
  isNew?: boolean
  isFloating?: boolean
  floatIndex?: number
}) {
  const [showMenu, setShowMenu] = useState(false)

  // UPGRADE 2: Show human-friendly title if available, otherwise generate one
  const displayTitle = memory.title && memory.title.length > 0 && memory.title !== memory.content
    ? memory.title
    : generateFriendlyTitle(memory.content, memory.type)

  const displayContent = memory.content

  // UPGRADE 4: Floating cards have staggered offsets
  const floatingOffsets = [
    { rotate: -1.5, translateY: 0, marginLeft: '0px' },
    { rotate: 1, translateY: 4, marginLeft: '-8px' },
    { rotate: -0.5, translateY: 8, marginLeft: '4px' },
  ]

  const floatStyle = isFloating ? floatingOffsets[floatIndex] || floatingOffsets[0] : null

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: -20, scale: 0.98 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={isNew ? { type: 'spring', stiffness: 300, damping: 20 } : SPRING_SMOOTH}
      className="relative w-full group"
      style={isFloating && floatStyle ? {
        rotate: `${floatStyle.rotate}deg`,
        marginTop: `${floatStyle.translateY}px`,
        marginLeft: floatStyle.marginLeft,
        zIndex: 3 - floatIndex,
      } : undefined}
    >
      <motion.div
        onClick={onClick}
        whileHover={darkMode
          ? { y: -2, boxShadow: '0 8px 30px rgba(192, 132, 252, 0.06), 0 2px 10px rgba(0,0,0,0.2)' }
          : { y: -1 }
        }
        whileTap={{ scale: 0.97 }}
        transition={SPRING_GENTLE}
        className={`relative w-full text-left cursor-pointer rounded-2xl transition-colors duration-200 floating-memory ${
          isFloating && darkMode
            ? 'shadow-lg shadow-purple-500/5'
            : ''
        } ${
          darkMode
            ? 'bg-white/[0.02] border border-white/[0.05] hover:border-purple-500/10'
            : 'bg-white border border-black/[0.04] hover:border-gray-200 hover:shadow-sm'
        }`}
        style={isFloating ? { padding: '16px' } : { padding: '14px 16px' }}
      >
        {/* UPGRADE 2: Human-friendly title — prominent, first line */}
        <p className={`font-medium leading-snug ${darkMode ? 'text-white/90' : 'text-gray-800'}`} style={{ wordBreak: 'break-word', fontSize: '14px' }}>
          {displayTitle}
        </p>

        {/* Content preview — muted, only if different from title */}
        {displayContent !== displayTitle && (
          <p className={`text-xs leading-relaxed mt-1 ${darkMode ? 'text-white/35' : 'text-gray-400'}`} style={{ wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {displayContent}
          </p>
        )}

        {/* Date + actions row */}
        <div className="flex items-center justify-between mt-2.5">
          <span className={`text-xs ${darkMode ? 'text-white/25' : 'text-gray-400'}`}>
            {formatRelativeDate(memory.createdAt)}
          </span>

          <div className="flex items-center gap-1">
            {/* Sync indicator */}
            {(memory.syncStatus === 'pending' || memory.syncStatus === 'syncing') && (
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/20 opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-amber-500/30" />
              </span>
            )}

            {/* 3-dot menu */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-full haptic-press ${
                  darkMode
                    ? 'hover:bg-white/10 text-white/20 hover:text-white/50'
                    : 'hover:bg-black/5 text-gray-300 hover:text-gray-500'
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
                    transition={SPRING_BOUNCE}
                    className={`absolute right-0 top-8 z-50 rounded-xl shadow-xl border py-1 min-w-[130px] ${
                      darkMode ? 'bg-[#161428] border-white/10' : 'bg-white border-gray-200'
                    }`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onClick(); setShowMenu(false) }}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 haptic-press ${
                        darkMode ? 'text-white/60 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Pencil size={11} /> View & Edit
                    </button>
                    {onDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false) }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 haptic-press ${
                          darkMode ? 'text-red-400/70 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </motion.div>
  )
})

// ────────────────────────────────────────────────────────────
// UPGRADE 3: DAILY SPARK — Resurfaces an old memory
// Addresses ADHD "object permanence" — prevents the black hole
// ────────────────────────────────────────────────────────────

const DailySpark = memo(function DailySpark({
  memory,
  darkMode,
  onRefresh,
}: {
  memory: Memory | null
  darkMode: boolean
  onRefresh: () => void
}) {
  const [reflection, setReflection] = useState<string | null>(null)
  const [isLoadingReflection, setIsLoadingReflection] = useState(false)
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!memory || fetchedRef.current === memory.id) return
    fetchedRef.current = memory.id
    setReflection(null)

    // Fetch AI reflection for this spark
    const fetchReflection = async () => {
      setIsLoadingReflection(true)
      try {
        const res = await fetch('/api/ai/daily-spark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: memory.content,
            type: memory.type,
            title: memory.title,
            tags: memory.tags,
            createdAt: memory.createdAt,
          }),
        })
        const data = await res.json()
        setReflection(data.reflection || 'Something worth remembering from your past.')
      } catch {
        setReflection('A thought from your past, worth revisiting.')
      } finally {
        setIsLoadingReflection(false)
      }
    }

    fetchReflection()
  }, [memory])

  if (!memory) return null

  const displayTitle = memory.title && memory.title.length > 0 && memory.title !== memory.content
    ? memory.title
    : generateFriendlyTitle(memory.content, memory.type)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className={`relative rounded-2xl overflow-hidden daily-spark-card ${
        darkMode
          ? 'bg-white/[0.025] border border-purple-500/10'
          : 'bg-white border border-gray-200 shadow-sm'
      }`}
    >
      {/* Sparkle accent */}
      <div className="p-4 pb-2 flex items-start gap-3">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{ 
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="shrink-0 mt-0.5"
        >
          <Sparkles className={`size-4 ${darkMode ? 'text-purple-400/40' : 'text-purple-300/60'}`} />
        </motion.div>
        
        <div className="flex-1 min-w-0">
          {/* "From your past" label */}
          <p className={`text-[10px] font-medium uppercase tracking-wider mb-1.5 ${darkMode ? 'text-purple-400/30' : 'text-purple-400/50'}`}>
            Daily Spark — {formatRelativeDate(memory.createdAt)}
          </p>

          {/* Memory title */}
          <p className={`text-sm font-medium leading-snug ${darkMode ? 'text-white/80' : 'text-gray-700'}`} style={{ wordBreak: 'break-word' }}>
            {displayTitle}
          </p>

          {/* AI Reflection */}
          {isLoadingReflection ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border border-purple-400/20 border-t-purple-400/50 animate-spin" />
              <span className={`text-xs ${darkMode ? 'text-white/20' : 'text-gray-300'}`}>Reflecting...</span>
            </div>
          ) : reflection && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`text-xs leading-relaxed mt-2 italic ${darkMode ? 'text-white/30' : 'text-gray-400'}`}
            >
              {reflection}
            </motion.p>
          )}
        </div>

        {/* Refresh button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onRefresh}
          className={`shrink-0 p-1.5 rounded-full transition-colors haptic-press ${
            darkMode
              ? 'text-white/15 hover:text-white/30 hover:bg-white/5'
              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
          }`}
          aria-label="Show another memory"
        >
          <RotateCcw size={12} />
        </motion.button>
      </div>
    </motion.div>
  )
})

// ────────────────────────────────────────────────────────────
// MAGICAL EMPTY STATE — Animated orb + sparkles
// ────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState({ darkMode }: { darkMode: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className="flex flex-col items-center justify-center py-32 px-4 text-center"
    >
      {/* Animated gradient orb */}
      <div className="relative mb-8">
        <div
          className="w-20 h-20 rounded-full animate-aurora-breathe"
          style={{
            background: darkMode
              ? 'radial-gradient(circle at 30% 30%, rgba(192, 132, 252, 0.15), rgba(99, 102, 241, 0.08) 50%, transparent 70%)'
              : 'radial-gradient(circle at 30% 30%, rgba(157, 139, 167, 0.12), rgba(99, 102, 241, 0.06) 50%, transparent 70%)',
            filter: 'blur(1px)',
          }}
        />
        <div
          className="absolute inset-0 w-20 h-20 rounded-full"
          style={{
            background: darkMode
              ? 'radial-gradient(circle at 60% 60%, rgba(125, 211, 232, 0.08), transparent 60%)'
              : 'radial-gradient(circle at 60% 60%, rgba(125, 211, 232, 0.06), transparent 60%)',
            animation: 'aurora-breathe 10s ease-in-out 3s infinite',
          }}
        />
        {/* Sparkles icon — slow-pulsing */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Sparkles className={`size-7 ${darkMode ? 'text-purple-400/30' : 'text-purple-300/50'}`} />
        </motion.div>
      </div>

      <h3 className={`text-base font-medium mb-1.5 ${darkMode ? 'text-white/30' : 'text-gray-500'}`}>
        A quiet space for your thoughts
      </h3>
      <p className={`text-xs max-w-xs leading-relaxed ${darkMode ? 'text-white/15' : 'text-gray-400'}`}>
        Type anything above — a thought, a link, an idea. Aether will take care of the rest.
      </p>
    </motion.div>
  )
})

// ────────────────────────────────────────────────────────────
// WEB SPEECH API HOOK
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

    recognition.onerror = () => { setIsListening(false) }
    recognition.onend = () => { setIsListening(false) }

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
// UPGRADE 2: HERO CAPTURE BAR — "Gravity" center of the page
// Accepts text and pasted URLs without asking for a title
// Auto-generates human-friendly titles in background
// ────────────────────────────────────────────────────────────

function CaptureBar({
  onSaved,
  onProcessing,
  onTagIdentified,
}: {
  onSaved: (id: string) => void
  onProcessing: (isProcessing: boolean) => void
  onTagIdentified: (category: { name: string; emoji: string }) => void
}) {
  const { addMemory, updateMemory, autoTagging, user, darkMode } = useAetherStore()
  const { toast } = useToast()

  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [savePulse, setSavePulse] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { isListening, transcript, startListening, stopListening } = useWebSpeechRecognition()

  useEffect(() => {
    if (isListening && transcript) { setInput(transcript) }
  }, [transcript, isListening])

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

  /** Generate a human-friendly title via AI */
  const generateHumanTitle = useCallback(async (content: string, type: string, tags: string[]): Promise<string | null> => {
    try {
      const res = await fetch('/api/ai/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type, tags }),
      })
      const data = await res.json()
      return data.title || null
    } catch {
      return null
    }
  }, [])

  const handleSave = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content) return

    setIsSaving(true)

    // UPGRADE 1: Trigger "Magic Processing" animation
    setIsProcessing(true)
    onProcessing(true)

    const tempId = `mem-${Date.now()}`

    let type: MemoryType = 'text'
    if (isUrl(content)) type = 'link'

    // UPGRADE 2: Auto-generate a human-friendly title
    const initialTitle = generateFriendlyTitle(content, type)

    const fallbackTags = getSmartFallbackTags(content, type)
    const isOffline = !navigator.onLine

    addMemory({
      id: tempId, type, title: initialTitle, content, tags: fallbackTags,
      createdAt: new Date().toISOString(),
      taggingStatus: isOffline ? 'complete' : 'pending',
      syncStatus: isOffline ? 'pending' : 'syncing',
      ...(type === 'link' ? { source: content, sourceUrl: content } : {}),
    })

    setSavePulse(true)
    setTimeout(() => setSavePulse(false), 600)

    setInput('')
    setIsSaving(false)
    onSaved(tempId)

    toast({
      title: 'Saved ✨',
      description: type === 'link' ? 'Link captured.' : 'Your thought is safe.',
    })

    const taggingTimeout = setTimeout(() => {
      updateMemory(tempId, { taggingStatus: 'tagging' })
    }, 2000)

    if (isOffline) {
      clearTimeout(taggingTimeout)
      setIsProcessing(false)
      onProcessing(false)
      // UPGRADE 1: Show auto-tag badge after 1 second
      const category = getCategoryFromTags(fallbackTags)
      setTimeout(() => onTagIdentified(category), 1000)
      try {
        await createMemory({ type, title: initialTitle, content, tags: fallbackTags, ...(type === 'link' ? { sourceUrl: content } : {}) })
        updateMemory(tempId, { syncStatus: 'synced' })
      } catch {}
      return
    }

    try {
      if (user?.plan === 'free') {
        const count = await getMemoryCount()
        if (count >= 50) {
          clearTimeout(taggingTimeout)
          updateMemory(tempId, { taggingStatus: 'complete', syncStatus: 'synced' })
          setIsProcessing(false)
          onProcessing(false)
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
          createMemory({ type: 'link', title: initialTitle, content, tags: fallbackTags, sourceUrl: content }),
        ])

        let enrichedContent = content
        let enrichedTitle = initialTitle
        let siteName = ''
        let enrichedImage = ''

        if (linkResult.success) {
          siteName = linkResult.siteName || ''
          enrichedImage = linkResult.image || ''
          enrichedTitle = linkResult.title || initialTitle
          const parts: string[] = []
          if (siteName) parts.push(`[From ${siteName}]`)
          if (linkResult.description) parts.push(linkResult.description)
          if (linkResult.content) parts.push(linkResult.content)
          enrichedContent = parts.join('\n\n') || content
        }

        const tagContent = enrichedContent === content ? content : enrichedContent
        const [aiTags, insightResult, aiTitle] = await Promise.all([
          generateTags(tagContent, 'link'),
          fetch('/api/ai/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: tagContent, type: 'link', tags: fallbackTags, title: enrichedTitle }),
          }).then(r => r.json()).catch(() => ({ insight: '' })),
          // UPGRADE 2: Generate human-friendly title
          generateHumanTitle(enrichedContent, 'link', fallbackTags),
        ])

        clearTimeout(taggingTimeout)

        // UPGRADE 2: Use AI-generated title if available
        const finalTitle = aiTitle && aiTitle.length > 0 ? aiTitle : enrichedTitle

        updateMemory(tempId, {
          id: savedMemory.id,
          title: finalTitle,
          content: enrichedContent,
          tags: aiTags, taggingStatus: 'complete', syncStatus: 'synced',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(siteName ? { siteName } : {}),
          ...(enrichedImage ? { linkImage: enrichedImage, imagePreview: enrichedImage } : {}),
          ...(insightResult.insight ? { aiSummary: insightResult.insight } : {}),
        })

        updateMemoryById(savedMemory.id, {
          title: finalTitle,
          content: enrichedContent, tags: aiTags,
          ...(insightResult.insight ? { summary: insightResult.insight } : {}),
          ...(enrichedImage ? { imagePreview: enrichedImage } : {}),
        }).catch(() => {})

        // UPGRADE 1: Show auto-tag badge
        setIsProcessing(false)
        onProcessing(false)
        const category = getCategoryFromTags(aiTags)
        setTimeout(() => onTagIdentified(category), 1000)
      } else {
        const [savedMemory, aiTags, aiTitle] = await Promise.all([
          createMemory({ type, title: initialTitle, content, tags: fallbackTags }),
          generateTags(content, type),
          // UPGRADE 2: Generate human-friendly title
          generateHumanTitle(content, type, fallbackTags),
        ])

        clearTimeout(taggingTimeout)

        const finalTitle = aiTitle && aiTitle.length > 0 ? aiTitle : initialTitle

        updateMemory(tempId, {
          id: savedMemory.id,
          title: finalTitle,
          tags: aiTags, taggingStatus: 'complete', syncStatus: 'synced',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(savedMemory.aiSummary ? { aiSummary: savedMemory.aiSummary } : {}),
        })

        // UPGRADE 1: Show auto-tag badge
        setIsProcessing(false)
        onProcessing(false)
        const category = getCategoryFromTags(aiTags)
        setTimeout(() => onTagIdentified(category), 1000)
      }
    } catch {
      clearTimeout(taggingTimeout)
      setIsProcessing(false)
      onProcessing(false)
      try {
        const aiTags = await generateTags(content, type)
        updateMemory(tempId, { tags: aiTags, taggingStatus: 'complete', syncStatus: 'synced' })
        const category = getCategoryFromTags(aiTags)
        setTimeout(() => onTagIdentified(category), 1000)
      } catch {
        updateMemory(tempId, { taggingStatus: 'complete', syncStatus: 'synced' })
        const category = getCategoryFromTags(fallbackTags)
        setTimeout(() => onTagIdentified(category), 1000)
      }
    }
  }, [input, addMemory, updateMemory, autoTagging, user, generateTags, generateHumanTitle, toast, onSaved, onProcessing, onTagIdentified])

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
      toast({ title: 'Image too large', description: 'Max 5MB.', variant: 'destructive' })
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
            id: tempId, type: 'image', title, content: description, tags,
            createdAt: new Date().toISOString(), taggingStatus: 'complete', syncStatus: 'synced',
            imagePreview: dataUrl, aiSummary: `AI detected: ${description}`,
          })

          onSaved(tempId)
          toast({ title: 'Saved ✨', description: 'Image captured.' })

          try {
            await createMemory({ type: 'image', title, content: description, tags, summary: `AI detected: ${description}`, imagePreview: dataUrl })
          } catch {}
        } catch {
          addMemory({
            id: tempId, type: 'image', title: 'Image capture', content: 'Captured image',
            tags: ['#image'], createdAt: new Date().toISOString(), taggingStatus: 'complete', syncStatus: 'pending',
          })
          onSaved(tempId)
          toast({ title: 'Saved ✨', description: 'Image saved.' })
        } finally {
          setIsSaving(false)
        }
      }
    }
    reader.readAsDataURL(file)
  }, [addMemory, onSaved, toast])

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
        toast({ title: 'Voice not available', description: 'Try typing instead.' })
      }
    }
  }, [isListening, startListening, stopListening, toast])

  // Determine glow state
  const isEmpty = !input.trim()
  const showBreathingGlow = darkMode && isEmpty && !isFocused && !isListening

  return (
    <div className="w-full px-4 md:px-0">
      {/* UPGRADE 1: Auto-tag badge appears below input after processing */}
      <div className="relative">
        <div
          className={`relative flex items-center rounded-2xl transition-all duration-500 overflow-hidden ${
            isProcessing ? 'magic-processing-shimmer' : ''
          } ${
            showBreathingGlow
              ? 'capture-breathe'
              : darkMode
                ? isFocused || isListening
                  ? 'bg-white/[0.04] border border-purple-500/20'
                  : 'bg-white/[0.025] border border-white/[0.05]'
                : isFocused || isListening
                  ? 'bg-white border border-[#9D8BA7]/25 shadow-md'
                  : 'bg-white border border-gray-200 shadow-sm'
          }`}
          style={darkMode ? {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: isFocused || isListening
              ? '0 0 40px rgba(192,132,252,0.06), 0 0 80px rgba(99,102,241,0.03)'
              : undefined,
            transition: 'box-shadow 0.5s ease, border-color 0.5s ease, background-color 0.5s ease',
          } : undefined}
        >
          {/* Voice recording indicator */}
          {isListening && (
            <div className="flex items-center gap-2 pl-5">
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="size-2.5 rounded-full bg-red-500"
              />
              <span className="text-xs text-red-400 font-medium">Listening...</span>
            </div>
          )}

          {/* Main input — large, inviting, zero-decision typography */}
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
            placeholder={isListening ? 'Speak your thought...' : "What's on your mind?"}
            disabled={isSaving}
            autoComplete="off"
            aria-label="Capture a thought"
            className={`flex-1 h-14 px-5 bg-transparent focus:outline-none placeholder:transition-colors duration-300 text-lg md:text-xl ${
              darkMode
                ? 'text-white placeholder:text-gray-500'
                : 'text-gray-900 placeholder:text-gray-300'
            }`}
            style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif', lineHeight: '1.5' }}
          />

          {/* Action buttons — soft rounded hover states */}
          <div className="flex items-center gap-0.5 pr-2">
            {/* Mic */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={SPRING_BOUNCE}
              onClick={handleMicClick}
              className={`p-2.5 rounded-full transition-colors duration-200 haptic-press ${
                isListening
                  ? 'bg-red-500/10 text-red-400'
                  : darkMode
                    ? 'text-white/20 hover:text-purple-400 hover:bg-white/10'
                    : 'text-gray-300 hover:text-[#9D8BA7] hover:bg-gray-100'
              }`}
              aria-label={isListening ? 'Stop voice capture' : 'Start voice capture'}
            >
              <Mic size={20} />
            </motion.button>

            {/* Image upload */}
            {!isListening && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                transition={SPRING_BOUNCE}
                onClick={() => fileInputRef.current?.click()}
                className={`p-2.5 rounded-full transition-colors duration-200 haptic-press ${
                  darkMode
                    ? 'text-white/20 hover:text-purple-400 hover:bg-white/10'
                    : 'text-gray-300 hover:text-[#9D8BA7] hover:bg-gray-100'
                }`}
                aria-label="Upload image"
              >
                <ImagePlus size={20} />
              </motion.button>
            )}

            {/* Send button — appears when there's text */}
            {input.trim() && !isListening && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: savePulse ? [1, 1.2, 1] : 1,
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={savePulse ? { duration: 0.3 } : SPRING_BOUNCE}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleSave()}
                className="p-2.5 rounded-full transition-all duration-200 haptic-press"
                style={{
                  background: 'linear-gradient(135deg, #9D8BA7, #7c3aed)',
                  color: 'white',
                  boxShadow: savePulse
                    ? '0 0 30px rgba(192, 132, 252, 0.5), 0 0 60px rgba(157, 139, 167, 0.25)'
                    : '0 0 20px rgba(157, 139, 167, 0.25)',
                  transition: 'box-shadow 0.3s ease',
                }}
                aria-label="Save thought"
              >
                <Send size={18} />
              </motion.button>
            )}

            {isSaving && !isListening && (
              <div className="p-2.5">
                <Loader2 size={18} className="animate-spin text-[#c084fc]" />
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
// SINGLE-SCREEN DASHBOARD — ADHD-optimized, ultra-premium
// ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    memories,
    deleteMemory,
    setSelectedMemoryId,
    setCurrentView,
    darkMode,
  } = useAetherStore()

  const [newMemoryId, setNewMemoryId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tagBadgeCategory, setTagBadgeCategory] = useState<{ name: string; emoji: string } | null>(null)
  const [showTagBadge, setShowTagBadge] = useState(false)
  const [sparkRefreshKey, setSparkRefreshKey] = useState(0)

  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [memories]
  )

  // UPGRADE 3: Daily Spark — pick a random memory older than 1 day
  // Uses useMemo + a deterministic seed from sparkRefreshKey to avoid
  // setState-in-effect lint violation. The seed changes when user clicks refresh.
  const dailySparkMemory = useMemo(() => {
    const oneDayAgo = Date.now() - 86400000
    const olderMemories = sortedMemories.filter(m => new Date(m.createdAt).getTime() < oneDayAgo)

    if (olderMemories.length === 0) return null

    // Use sparkRefreshKey as a seed to pick a different memory each refresh
    // Simple deterministic "random" based on key + array length
    const index = (sparkRefreshKey * 7 + 3) % olderMemories.length
    return olderMemories[index]
  }, [sortedMemories, sparkRefreshKey])

  const handleDelete = useCallback(async (id: string) => {
    deleteMemory(id)
    try { await deleteMemoryById(id) } catch {}
  }, [deleteMemory])

  const handleMemoryClick = useCallback((id: string) => {
    setSelectedMemoryId(id)
    setCurrentView('memory-detail')
  }, [setSelectedMemoryId, setCurrentView])

  const handleProcessing = useCallback((processing: boolean) => {
    setIsProcessing(processing)
  }, [])

  const handleTagIdentified = useCallback((category: { name: string; emoji: string }) => {
    setTagBadgeCategory(category)
    setShowTagBadge(true)

    // Badge fades away after 3 seconds
    setTimeout(() => {
      setShowTagBadge(false)
    }, 3000)
  }, [])

  const handleSparkRefresh = useCallback(() => {
    setSparkRefreshKey(prev => prev + 1)
  }, [])

  // UPGRADE 4: Split memories into floating (3 most recent) and standard (rest)
  const floatingMemories = sortedMemories.slice(0, 3)
  const standardMemories = sortedMemories.slice(3)

  const hasMemories = sortedMemories.length > 0

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-deep-space">
      <AuroraBackground />

      <div className="relative z-10 flex-1 overflow-y-auto ios-scroll">
        <div className="max-w-2xl mx-auto w-full">
          {/* Hero Capture Zone — massive whitespace above */}
          <div className="pt-16 md:pt-24 pb-6 md:pb-8 px-4 md:px-0">
            <CaptureBar
              onSaved={(id) => setNewMemoryId(id)}
              onProcessing={handleProcessing}
              onTagIdentified={handleTagIdentified}
            />

            {/* UPGRADE 1: Auto-tag badge — appears below capture bar */}
            <div className="flex justify-center mt-3">
              <AutoTagBadge
                category={tagBadgeCategory || { name: 'Personal', emoji: '🌿' }}
                visible={showTagBadge}
              />
            </div>
          </div>

          {/* Content area */}
          <div className="px-4 md:px-0 pb-24 md:pb-32">
            <AnimatePresence mode="wait">
              {!hasMemories ? (
                <EmptyState darkMode={darkMode} />
              ) : (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col"
                >
                  {/* UPGRADE 3: Daily Spark */}
                  {dailySparkMemory && (
                    <div className="mb-6">
                      <DailySpark
                        key={sparkRefreshKey}
                        memory={dailySparkMemory}
                        darkMode={darkMode}
                        onRefresh={handleSparkRefresh}
                      />
                    </div>
                  )}

                  {/* UPGRADE 4: Floating Memories — 3 most recent, staggered masonry */}
                  {floatingMemories.length > 0 && (
                    <div className="mb-4 space-y-3">
                      <div className="flex flex-col gap-3">
                        {floatingMemories.map((memory, index) => (
                          <MemoryCard
                            key={memory.id}
                            memory={memory}
                            onClick={() => handleMemoryClick(memory.id)}
                            onDelete={() => handleDelete(memory.id)}
                            darkMode={darkMode}
                            isNew={memory.id === newMemoryId}
                            isFloating={true}
                            floatIndex={index}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Standard memories — calm list below floating ones */}
                  {standardMemories.length > 0 && (
                    <div className="space-y-4">
                      {/* Separator between floating and standard — subtle */}
                      {floatingMemories.length > 0 && (
                        <div className="flex items-center gap-3 py-2">
                          <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-100'}`} />
                          <span className={`text-[10px] font-medium uppercase tracking-wider ${darkMode ? 'text-white/10' : 'text-gray-300'}`}>
                            Earlier
                          </span>
                          <div className={`flex-1 h-px ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-100'}`} />
                        </div>
                      )}

                      {standardMemories.map((memory) => (
                        <MemoryCard
                          key={memory.id}
                          memory={memory}
                          onClick={() => handleMemoryClick(memory.id)}
                          onDelete={() => handleDelete(memory.id)}
                          darkMode={darkMode}
                          isNew={memory.id === newMemoryId}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
