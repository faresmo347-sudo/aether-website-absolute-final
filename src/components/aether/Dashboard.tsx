'use client'

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, FileText, Link2, ImageIcon, Brain, Loader2, Send, ImagePlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import { createMemory, getMemoryCount, updateMemoryById, deleteMemoryById } from '@/lib/supabase/data'
import { getCachedTags, setCachedTags } from '@/lib/tag-cache'
import type { Memory, MemoryType } from '@/components/aether/types'
import { useToast } from '@/hooks/use-toast'

// ────────────────────────────────────────────────────────────
// SPRING PHYSICS
// ────────────────────────────────────────────────────────────

const SPRING_BOUNCE = { type: 'spring' as const, stiffness: 400, damping: 17 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 260, damping: 22 }
const SPRING_GENTLE = { type: 'spring' as const, stiffness: 180, damping: 20 }

// ────────────────────────────────────────────────────────────
// STAGGER CONTAINERS
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
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full animate-aurora-breathe"
        style={{
          background: `radial-gradient(ellipse, rgba(99, 102, 241, 0.10) 0%, rgba(157, 139, 167, 0.04) 40%, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute top-1/3 -left-20 w-[350px] h-[250px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(125, 211, 232, 0.06) 0%, rgba(94, 234, 212, 0.02) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'aurora-breathe 18s ease-in-out 4s infinite',
        }}
      />
      <div
        className="absolute top-1/4 -right-20 w-[300px] h-[200px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(192, 132, 252, 0.08) 0%, rgba(157, 139, 167, 0.02) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'aurora-breathe 14s ease-in-out 7s infinite',
        }}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// MEMORY CARD — Calm, no tags visible, spring physics
// ────────────────────────────────────────────────────────────

const MemoryCard = memo(function MemoryCard({
  memory,
  onClick,
  onDelete,
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
      {isNew && (
        <motion.div
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2, ease: 'easeOut' }}
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{
            boxShadow: `0 0 20px ${accent.glow}, 0 0 40px ${accent.glow}`,
            border: `1px solid ${accent.border}`,
          }}
        />
      )}

      <motion.div
        onClick={onClick}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        transition={SPRING_GENTLE}
        className="relative w-full text-left p-4 cursor-pointer rounded-2xl"
        style={darkMode
          ? {
              background: 'rgba(255,255,255,0.025)',
              border: isNew ? `1px solid rgba(192,132,252,0.4)` : '1px solid rgba(255,255,255,0.04)',
              transition: 'border-color 1.5s ease-out',
            }
          : {
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(0,0,0,0.04)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }
        }
      >
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div
            className="flex items-center justify-center size-7 rounded-lg shrink-0 mt-0.5"
            style={{ background: accent.bg }}
          >
            {typeIcon(memory.type, 'size-3.5')}
          </div>

          <div className="min-w-0 flex-1">
            {/* Title + time row */}
            <div className="flex items-start justify-between gap-3">
              <h3 className={`font-medium text-sm leading-snug truncate ${darkMode ? 'text-white/70' : 'text-gray-800'}`}>
                {displayTitle}
              </h3>
              <div className="flex items-center gap-1.5 shrink-0">
                {isSyncing && (
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/20 opacity-75" />
                    <span className="relative inline-flex rounded-full size-1.5 bg-amber-500/30" />
                  </span>
                )}
                <span className={`text-[10px] whitespace-nowrap ${darkMode ? 'text-white/12' : 'text-gray-300'}`}>
                  {formatRelativeDate(memory.createdAt)}
                </span>
                {/* 3-dot menu */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-lg ${
                      darkMode ? 'hover:bg-white/5 text-white/15 hover:text-white/40' : 'hover:bg-black/5 text-gray-300 hover:text-gray-500'
                    }`}
                    aria-label="More actions"
                  >
                    <MoreHorizontal size={13} />
                  </button>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={SPRING_BOUNCE}
                        className={`absolute right-0 top-7 z-50 rounded-xl shadow-xl border py-1 min-w-[130px] ${
                          darkMode ? 'bg-[#161428] border-white/10' : 'bg-white border-gray-200'
                        }`}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); onClick(); setShowMenu(false) }}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                            darkMode ? 'text-white/60 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Pencil size={11} /> View & Edit
                        </button>
                        {onDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false) }}
                            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
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

            {/* Content preview — calm, no tags */}
            {previewContent && previewContent !== displayTitle && (
              <p className={`text-xs mt-1 line-clamp-2 leading-[1.6] ${darkMode ? 'text-white/15' : 'text-gray-400'}`} style={{ wordBreak: 'break-word' }}>
                {previewContent}
              </p>
            )}
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
// CALM EMPTY STATE
// ────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState({ darkMode }: { darkMode: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className="flex flex-col items-center justify-center py-32 px-4 text-center"
    >
      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-5 ${
        darkMode ? 'bg-white/[0.02] border border-white/[0.04]' : 'bg-gray-50'
      }`}>
        <Brain className={`size-7 ${darkMode ? 'text-white/8' : 'text-gray-200'}`} />
      </div>
      <h3 className={`text-base font-medium mb-1.5 ${darkMode ? 'text-white/30' : 'text-gray-500'}`}>
        A quiet space for your thoughts
      </h3>
      <p className={`text-xs max-w-xs leading-relaxed ${darkMode ? 'text-white/12' : 'text-gray-400'}`}>
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
// HERO CAPTURE ZONE — Massive, glowing, the undisputed king
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

    addMemory({
      id: tempId, type, title, content, tags: fallbackTags,
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
      try {
        await createMemory({ type, title, content, tags: fallbackTags, ...(type === 'link' ? { sourceUrl: content } : {}) })
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
          tags: aiTags, taggingStatus: 'complete', syncStatus: 'synced',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(siteName ? { siteName } : {}),
          ...(enrichedImage ? { linkImage: enrichedImage, imagePreview: enrichedImage } : {}),
          ...(insightResult.insight ? { aiSummary: insightResult.insight } : {}),
        })

        updateMemoryById(savedMemory.id, {
          title: enrichedTitle !== 'Saved link' ? enrichedTitle : title,
          content: enrichedContent, tags: aiTags,
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
          id: savedMemory.id, tags: aiTags, taggingStatus: 'complete', syncStatus: 'synced',
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

  return (
    <div className="w-full px-4 md:px-0">
      <div
        className={`relative flex items-center rounded-2xl transition-all duration-300 overflow-hidden ${
          darkMode
            ? isFocused || isListening
              ? 'bg-white/[0.05] border border-[#c084fc]/20 shadow-[0_0_40px_rgba(192,132,252,0.06)]'
              : 'bg-white/[0.025] border border-white/[0.05]'
            : isFocused || isListening
              ? 'bg-white border border-[#9D8BA7]/25 shadow-md'
              : 'bg-white border border-gray-200 shadow-sm'
        }`}
        style={darkMode ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } : undefined}
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
          placeholder={isListening ? 'Speak your thought...' : "What's on your mind?"}
          disabled={isSaving}
          autoComplete="off"
          aria-label="Capture a thought"
          className={`flex-1 h-14 px-5 text-base bg-transparent focus:outline-none placeholder:transition-colors duration-300 ${
            darkMode
              ? 'text-white/85 placeholder:text-white/12'
              : 'text-gray-900 placeholder:text-gray-300'
          }`}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1 pr-3">
          {/* Mic */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING_BOUNCE}
            onClick={handleMicClick}
            className={`p-2.5 rounded-xl transition-all duration-200 ${
              isListening
                ? 'bg-red-500/10 text-red-400'
                : darkMode
                  ? 'text-white/12 hover:text-[#c084fc] hover:bg-[#c084fc]/8'
                  : 'text-gray-300 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5'
            }`}
            aria-label={isListening ? 'Stop voice capture' : 'Start voice capture'}
          >
            <Mic size={20} />
          </motion.button>

          {/* Image upload */}
          {!isListening && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_BOUNCE}
              onClick={() => fileInputRef.current?.click()}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                darkMode
                  ? 'text-white/12 hover:text-[#c084fc] hover:bg-[#c084fc]/8'
                  : 'text-gray-300 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5'
              }`}
              aria-label="Upload image"
            >
              <ImagePlus size={20} />
            </motion.button>
          )}

          {/* Send button */}
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
              className="p-2.5 rounded-xl transition-all duration-200"
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
  )
}

// ────────────────────────────────────────────────────────────
// SINGLE-SCREEN DASHBOARD — Hero Capture + Calm Feed
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

  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [memories]
  )

  const handleDelete = useCallback(async (id: string) => {
    deleteMemory(id)
    try { await deleteMemoryById(id) } catch {}
  }, [deleteMemory])

  const handleMemoryClick = useCallback((id: string) => {
    setSelectedMemoryId(id)
    setCurrentView('memory-detail')
  }, [setSelectedMemoryId, setCurrentView])

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <AuroraBackground />

      <div className="relative z-10 flex-1 overflow-y-auto ios-scroll">
        <div className="max-w-2xl mx-auto w-full">
          {/* Hero Capture Zone — massive whitespace above */}
          <div className="pt-16 md:pt-24 pb-10 md:pb-14 px-4 md:px-0">
            <CaptureBar onSaved={(id) => setNewMemoryId(id)} />
          </div>

          {/* Calm Feed — no header, just flow */}
          <div className="px-4 md:px-0 pb-24 md:pb-32">
            <AnimatePresence mode="wait">
              {sortedMemories.length === 0 ? (
                <EmptyState darkMode={darkMode} />
              ) : (
                <motion.div
                  key="feed"
                  variants={feedContainerVariants}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-2"
                >
                  {sortedMemories.map((memory, index) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      onClick={() => handleMemoryClick(memory.id)}
                      onDelete={() => handleDelete(memory.id)}
                      index={index}
                      darkMode={darkMode}
                      isNew={memory.id === newMemoryId}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
