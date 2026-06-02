'use client'

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, FileText, Link2, ImageIcon, X, Upload, Plus, Brain, Loader2, Eye, Sparkles, ClipboardPaste, Camera, ArrowUp, Mail, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAetherStore } from '@/store/aether-store'
import { createMemory, getMemoryCount, updateMemoryById } from '@/lib/supabase/data'
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

const TYPE_ACCENT_COLORS = TYPE_ACCENT_COLORS_DARK

function typeIcon(type: MemoryType, size = 'size-4') {
  const accent = TYPE_ACCENT_COLORS[type]
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
    const url = new URL(text)
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
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Primary purple orb — top center */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-30"
        style={{
          background: `radial-gradient(ellipse, var(--aurora-purple) 0%, var(--aurora-purple-edge) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'auroraFloat1 12s ease-in-out infinite',
        }}
      />
      {/* Secondary blue orb — left */}
      <div
        className="absolute top-1/3 -left-20 w-[400px] h-[300px] rounded-full opacity-20"
        style={{
          background: `radial-gradient(ellipse, var(--aurora-blue) 0%, var(--aurora-blue-edge) 40%, transparent 70%)`,
          filter: 'blur(80px)',
          animation: 'auroraFloat2 16s ease-in-out infinite',
        }}
      />
      {/* Tertiary pink orb — right */}
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
// Memory Card — Clean frosted glass feed card
// ────────────────────────────────────────────────────────────

const MemoryCard = memo(function MemoryCard({
  memory,
  onClick,
  index = 0,
  darkMode = true,
}: {
  memory: Memory
  onClick: () => void
  index?: number
  darkMode?: boolean
}) {
  const isTagging = memory.taggingStatus === 'tagging' || memory.taggingStatus === 'pending'
  const isSyncing = memory.syncStatus === 'pending' || memory.syncStatus === 'syncing'

  const previewContent = memory.type === 'link'
    ? memory.content.replace(/^\[From\s+.+?\]\s*\n*/, '').trim() || memory.content
    : memory.content

  const accent = darkMode ? TYPE_ACCENT_COLORS_DARK[memory.type] : TYPE_ACCENT_COLORS_LIGHT[memory.type]

  const displayTitle = memory.title.includes('http')
    ? (() => { try { return new URL(memory.title).hostname } catch { return memory.title } })()
    : memory.title

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative w-full text-left p-3 md:p-4 cursor-pointer group active:scale-[0.98] rounded-xl min-h-[44px]"
      style={darkMode
        ? {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }
        : {
            background: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }
      }
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center size-7 rounded-lg shrink-0 mt-0.5"
          style={{ background: accent.bg }}
        >
          {typeIcon(memory.type, 'size-3.5')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-medium text-sm leading-snug truncate ${darkMode ? 'text-white/90' : 'text-gray-900'}`}>
              {displayTitle}
            </h3>
            <span className={`text-[10px] whitespace-nowrap shrink-0 mt-0.5 ${darkMode ? 'text-white/25' : 'text-gray-400'}`}>
              {formatRelativeDate(memory.createdAt)}
            </span>
          </div>
          <p className={`text-xs mt-0.5 line-clamp-2 leading-[1.5] ${darkMode ? 'text-white/35' : 'text-gray-500'}`} style={{ wordBreak: 'break-word' }}>
            {previewContent || <em className={darkMode ? 'text-white/15' : 'text-gray-300'}>No content</em>}
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap min-w-0">
            {memory.tags.slice(0, 3).map((tag, i) => (
              <span
                key={tag}
                className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                  isTagging
                    ? 'animate-pulse ' + (darkMode ? 'bg-white/10 text-white/40' : 'bg-gray-100 text-gray-400')
                    : darkMode ? 'bg-white/10 text-white/40' : 'bg-gray-100 text-gray-500'
                }`}
                style={isTagging ? { animationDelay: `${i * 200}ms` } : undefined}
              >
                {tag}
              </span>
            ))}
            {isSyncing && !isTagging && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-500/60 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                <span className="relative flex size-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/30 opacity-75" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-amber-500/50" />
                </span>
                Syncing
              </span>
            )}
            {isTagging && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                <span className="relative flex size-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400/20 opacity-75" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-gray-400/30" />
                </span>
                Thinking...
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  )
})

// ────────────────────────────────────────────────────────────
// Empty State
// ────────────────────────────────────────────────────────────

const EmptyState = memo(function EmptyState() {
  const { setCaptureModalOpen, darkMode } = useAetherStore()

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Brain className={`size-10 mb-4 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} />
      <h3 className={`text-lg font-semibold ${darkMode ? 'text-white/80' : 'text-gray-800'}`}>
        Your second brain is empty
      </h3>
      <p className={`text-sm mt-2 max-w-xs leading-relaxed ${darkMode ? 'text-white/30' : 'text-gray-500'}`}>
        Start capturing your first memory — ideas, notes, links, anything you want to remember.
      </p>
      <button
        onClick={() => setCaptureModalOpen(true)}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#9D8BA7] to-[#c084fc] text-white rounded-xl px-5 py-2.5 text-sm font-semibold min-h-[48px] active:scale-[0.98]"
      >
        <Plus className="size-4" />
        Add Your First Memory
      </button>
    </div>
  )
})

// ────────────────────────────────────────────────────────────
// Quick Capture Modal — handles voice, link, image captures
// ────────────────────────────────────────────────────────────

async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

function QuickCaptureModal() {
  const {
    captureModalOpen,
    setCaptureModalOpen,
    activeCaptureTab,
    setActiveCaptureTab,
    addMemory,
    updateMemory,
    autoTagging,
    user,
  } = useAetherStore()

  const { toast } = useToast()

  const [textContent, setTextContent] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceTitle, setVoiceTitle] = useState('')
  const [voiceSummary, setVoiceSummary] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPreview, setLinkPreview] = useState(false)
  const [isProcessingLink, setIsProcessingLink] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageDescription, setImageDescription] = useState('')
  const [imageTitle, setImageTitle] = useState('')
  const [imageTags, setImageTags] = useState<string[]>([])
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [manualTags, setManualTags] = useState<string[]>([])
  const [manualTagInput, setManualTagInput] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const linkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const resetForm = useCallback(() => {
    setTextContent('')
    setIsRecording(false)
    setVoiceTranscript('')
    setVoiceTitle('')
    setVoiceSummary('')
    setIsTranscribing(false)
    setLinkUrl('')
    setLinkPreview(false)
    setIsProcessingLink(false)
    setImagePreview(null)
    setImageBase64(null)
    setImageDescription('')
    setImageTitle('')
    setImageTags([])
    setIsAnalyzingImage(false)
    setIsSaving(false)
    setManualTags([])
    setManualTagInput('')
    setAudioChunks([])
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    setMediaRecorder(null)
    if (linkDebounceRef.current) {
      clearTimeout(linkDebounceRef.current)
      linkDebounceRef.current = null
    }
  }, [mediaRecorder])

  const handleClose = useCallback(() => {
    setCaptureModalOpen(false)
    resetForm()
  }, [setCaptureModalOpen, resetForm])

  const generateTags = useCallback(async (
    content: string,
    type: string,
    summary?: string,
    imgDescription?: string,
  ): Promise<string[]> => {
    if (!content.trim()) return getSmartFallbackTags(content, type)
    const cached = getCachedTags(content, type)
    if (cached) return cached
    if (!autoTagging) return getSmartFallbackTags(content, type)
    try {
      const res = await fetch('/api/ai/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          type,
          ...(summary ? { summary } : {}),
          ...(imgDescription ? { imageDescription: imgDescription } : {}),
        }),
      })
      const data = await res.json()
      const tags = data.tags || ['#memory']
      setCachedTags(content, type, tags)
      return tags
    } catch {
      return getSmartFallbackTags(content, type)
    }
  }, [autoTagging])

  const handleSave = useCallback(async () => {
    if (activeCaptureTab === 'text' && !textContent.trim()) return
    if (activeCaptureTab === 'link' && !linkUrl.trim()) return
    if (activeCaptureTab === 'voice' && !voiceTranscript && !isTranscribing) return
    setIsSaving(true)
    const tempId = `mem-${Date.now()}`
    let title = ''
    let content = ''
    let fallbackTags: string[] = []
    let aiSummary: string | undefined

    switch (activeCaptureTab) {
      case 'text':
        title = textContent.slice(0, 50) || 'Quick note'
        content = textContent
        fallbackTags = getSmartFallbackTags(content, 'text')
        break
      case 'voice':
        if (!voiceTranscript || !voiceTranscript.trim() || voiceTranscript.includes('microphone access needed')) {
          toast({ title: "Couldn't transcribe", description: "Voice note was empty or transcription failed — please try again.", variant: "destructive" })
          setIsSaving(false)
          return
        }
        title = voiceTitle || voiceSummary || voiceTranscript.slice(0, 50)
        content = voiceTranscript
        fallbackTags = getSmartFallbackTags(content, 'voice')
        if (voiceSummary) aiSummary = voiceSummary
        break
      case 'link':
        title = linkUrl ? `Saved link` : 'Bookmark'
        content = linkUrl || 'Saved bookmark'
        fallbackTags = getSmartFallbackTags(content, 'link')
        break
      case 'image':
        if (imageDescription && imageTags.length > 0) {
          title = imageTitle || imageDescription.slice(0, 50) || 'Image capture'
          content = imageDescription
          fallbackTags = imageTags
        } else if (imageDescription) {
          title = imageTitle || imageDescription.slice(0, 50) || 'Image capture'
          content = imageDescription
          fallbackTags = getSmartFallbackTags(content, 'image')
        } else {
          title = 'Image capture'
          content = 'Captured image'
          fallbackTags = getSmartFallbackTags(content, 'image')
        }
        if (imageDescription) aiSummary = `AI detected: ${imageDescription}`
        break
    }

    if (manualTags.length > 0) {
      const merged = [...manualTags]
      for (const ft of fallbackTags) {
        if (!merged.includes(ft) && merged.length < 6) merged.push(ft)
      }
      fallbackTags = merged.slice(0, 6)
    }

    const isOffline = !navigator.onLine

    addMemory({
      id: tempId,
      type: activeCaptureTab,
      title,
      content,
      tags: fallbackTags,
      createdAt: new Date().toISOString(),
      taggingStatus: isOffline ? 'complete' : 'pending',
      syncStatus: isOffline ? 'pending' : 'synced',
      ...(aiSummary ? { aiSummary } : {}),
      ...(activeCaptureTab === 'link' && linkUrl ? { source: linkUrl, sourceUrl: linkUrl } : {}),
      ...(activeCaptureTab === 'image' && imagePreview ? { imagePreview } : {}),
    })

    setIsSaving(false)
    setCaptureModalOpen(false)
    resetForm()
    toast({ title: 'Memory saved ✓', description: 'Your memory has been captured.' })

    const taggingTimeout = setTimeout(() => {
      updateMemory(tempId, { taggingStatus: 'tagging' })
    }, 2000)

    if (isOffline) {
      clearTimeout(taggingTimeout)
      try {
        await createMemory({
          type: activeCaptureTab,
          title,
          content,
          tags: fallbackTags,
          ...(aiSummary ? { summary: aiSummary } : {}),
          ...(activeCaptureTab === 'link' && linkUrl ? { sourceUrl: linkUrl } : {}),
          ...(activeCaptureTab === 'image' && imagePreview ? { imagePreview } : {}),
        })
      } catch { /* offline save failed */ }
      return
    }

    try {
      if (user?.plan === 'free') {
        const count = await getMemoryCount()
        if (count >= 50) {
          clearTimeout(taggingTimeout)
          updateMemory(tempId, { taggingStatus: 'complete' })
          setShowUpgradeDialog(true)
          return
        }
      }

      if (activeCaptureTab === 'link' && linkUrl) {
        const [linkResult, savedMemory] = await Promise.all([
          fetch('/api/ai/fetch-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: linkUrl }),
          })
            .then((r) => r.json())
            .catch(() => ({ success: false, title: '', description: '', content: '', siteName: '', image: '' })),
          createMemory({
            type: 'link',
            title,
            content,
            tags: fallbackTags,
            sourceUrl: linkUrl,
          }),
        ])

        let enrichedContent = content
        let enrichedTitle = title
        let enrichedImage = ''
        let siteName = ''

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

        const tagContent = enrichedContent === content ? linkUrl : enrichedContent
        const [aiTags, insightResult] = await Promise.all([
          generateTags(tagContent, 'link'),
          fetch('/api/ai/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: tagContent, type: 'link', tags: fallbackTags, title: enrichedTitle }),
          })
            .then((r) => r.json())
            .catch(() => ({ insight: '' })),
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
          ...(savedMemory.source ? { source: savedMemory.source } : {}),
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
          createMemory({
            type: activeCaptureTab,
            title,
            content,
            tags: fallbackTags,
            ...(aiSummary ? { summary: aiSummary } : {}),
            ...(activeCaptureTab === 'link' && linkUrl ? { sourceUrl: linkUrl } : {}),
            ...(activeCaptureTab === 'image' && imagePreview ? { imagePreview } : {}),
          }),
          activeCaptureTab === 'image' && imageTags.length > 0
            ? Promise.resolve(imageTags)
            : generateTags(content, activeCaptureTab, voiceSummary || undefined, imageDescription || undefined),
        ])

        clearTimeout(taggingTimeout)

        updateMemory(tempId, {
          id: savedMemory.id,
          tags: aiTags,
          taggingStatus: 'complete',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(savedMemory.aiSummary ? { aiSummary: savedMemory.aiSummary } : {}),
          ...(savedMemory.source ? { source: savedMemory.source } : {}),
        })
      }
    } catch (error: any) {
      clearTimeout(taggingTimeout)
      if (error?.message?.toLowerCase().includes('limit') || error?.message?.toLowerCase().includes('quota')) {
        updateMemory(tempId, { taggingStatus: 'complete' })
        setShowUpgradeDialog(true)
      } else {
        toast({
          title: "Couldn't save that memory",
          description: "Please try again — your memory is saved locally in the meantime.",
          variant: "destructive"
        })
        try {
          const aiTags = await generateTags(content, activeCaptureTab, voiceSummary || undefined, imageDescription || undefined)
          updateMemory(tempId, { tags: aiTags, taggingStatus: 'complete' })
        } catch {
          updateMemory(tempId, { taggingStatus: 'complete' })
        }
      }
    }
  }, [activeCaptureTab, textContent, voiceTranscript, voiceTitle, voiceSummary, linkUrl, imagePreview, imageDescription, imageTitle, imageTags, manualTags, generateTags, addMemory, updateMemory, setCaptureModalOpen, resetForm, user])

  const handleImageUpload = useCallback(async (file: File) => {
    const MAX_SIZE = 5 * 1024 * 1024
    let fileToRead = file
    if (file.size > MAX_SIZE) {
      try { fileToRead = await compressImage(file) }
      catch (e) {
        console.error('Image compression failed:', e)
        toast({ title: 'Image too large', description: 'Could not compress the image. Try a smaller one.', variant: 'destructive' })
        return
      }
    }
    const reader = new FileReader()
    reader.onloadend = async () => {
      const dataUrl = reader.result as string
      setImagePreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      if (base64) {
        setImageBase64(base64)
        setIsAnalyzingImage(true)
        try {
          const res = await fetch('/api/ai/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl }),
          })
          const data = await res.json()
          if (data.description) setImageDescription(data.description)
          if (data.title) setImageTitle(data.title)
          if (data.tags && data.tags.length > 0) setImageTags(data.tags)
        } catch {
          setImageDescription(''); setImageTitle(''); setImageTags([])
        } finally { setIsAnalyzingImage(false) }
      }
    }
    reader.readAsDataURL(fileToRead)
  }, [toast])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
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
              if (data.error) {
                setVoiceTranscript('Voice memo recorded — transcription will be available shortly.')
              } else if (data.transcription) {
                setVoiceTranscript(data.transcription)
              } else {
                setVoiceTranscript('Voice memo recorded — transcription will be available shortly.')
              }
              if (data.title) setVoiceTitle(data.title)
              if (data.summary) setVoiceSummary(data.summary)
            } catch {
              setVoiceTranscript('Voice memo recorded — transcription will be available shortly.')
            } finally { setIsTranscribing(false) }
          }
        }
        reader.readAsDataURL(blob)
        setAudioChunks([])
      }
      setMediaRecorder(recorder)
      setAudioChunks(chunks)
      recorder.start()
      setIsRecording(true)
    } catch {
      setIsRecording(true)
      setTimeout(() => {
        setIsRecording(false)
        setVoiceTranscript('Voice memo recorded — microphone access needed for transcription.')
      }, 2000)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop()
    setIsRecording(false)
  }, [mediaRecorder])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) { setLinkUrl(text); setLinkPreview(text.length > 5) }
    } catch { /* clipboard API not available */ }
  }, [])

  const handleLinkUrlChange = useCallback((value: string) => {
    setLinkUrl(value)
    setLinkPreview(value.length > 5)
    if (linkDebounceRef.current) clearTimeout(linkDebounceRef.current)
    if (value.length > 5) {
      linkDebounceRef.current = setTimeout(() => {
        setIsProcessingLink(true)
        setTimeout(() => setIsProcessingLink(false), 1500)
      }, 500)
    }
  }, [])

  const captureTabs: { key: typeof activeCaptureTab; icon: React.ReactNode; label: string }[] = [
    { key: 'text', icon: <FileText className="size-4" />, label: 'Text' },
    { key: 'voice', icon: <Mic className="size-4" />, label: 'Voice' },
    { key: 'link', icon: <Link2 className="size-4" />, label: 'Link' },
    { key: 'image', icon: <ImageIcon className="size-4" />, label: 'Image' },
  ]

  if (!captureModalOpen) return null

  // Shared tag input + save button for both mobile & desktop
  const tagAndSaveSection = (
    <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/5">
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {manualTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 min-h-[32px] px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50 border border-white/8 whitespace-nowrap"
            >
              {tag}
              <button
                onClick={() => setManualTags((prev) => prev.filter((t) => t !== tag))}
                className="ml-0.5 size-3.5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {manualTags.length < 6 && (
            <input
              ref={tagInputRef}
              type="text"
              value={manualTagInput}
              onChange={(e) => setManualTagInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ',') && manualTagInput.trim()) {
                  e.preventDefault()
                  let tag = manualTagInput.trim().replace(/^#+/, '')
                  tag = `#${tag}`
                  if (!manualTags.includes(tag)) setManualTags((prev) => [...prev, tag])
                  setManualTagInput('')
                  setTimeout(() => tagInputRef.current?.focus(), 0)
                }
                if (e.key === ' ' && manualTagInput.trim() && manualTagInput.trim().length >= 2) {
                  e.preventDefault()
                  let tag = manualTagInput.trim().replace(/^#+/, '')
                  tag = `#${tag}`
                  if (!manualTags.includes(tag)) setManualTags((prev) => [...prev, tag])
                  setManualTagInput('')
                  setTimeout(() => tagInputRef.current?.focus(), 0)
                }
                if (e.key === 'Backspace' && !manualTagInput && manualTags.length > 0) {
                  setManualTags((prev) => prev.slice(0, -1))
                }
              }}
              placeholder={manualTags.length === 0 ? 'Add tags (press Enter or comma)' : '#tag'}
              className="min-h-[32px] flex-1 min-w-[100px] rounded-full border border-white/8 bg-transparent px-3 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/15 transition-all duration-300"
            />
          )}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={isSaving || isAnalyzingImage}
        className="w-full bg-gradient-to-r from-[#9D8BA7] to-[#c084fc] hover:from-[#8A7A96] hover:to-[#a76bf0] text-white rounded-xl min-h-[48px] text-sm font-medium transition-all duration-300 shadow-lg shadow-[#9D8BA7]/15"
      >
        {isSaving && <Loader2 className="size-4 animate-spin mr-1.5" />}
        {isSaving ? 'Saving...' : isAnalyzingImage ? 'Analyzing image...' : (
          <>
            <Plus className="size-4 mr-1" />
            Save Memory
          </>
        )}
      </Button>
    </div>
  )

  // Shared tab content for both mobile & desktop
  const tabContent = (
    <div className="flex-1 overflow-y-auto ios-scroll px-5 pb-4 min-h-0">
      {/* Text */}
      {activeCaptureTab === 'text' && (
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full min-h-[180px] resize-none rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#9D8BA7]/30 transition-shadow"
        />
      )}

      {/* Voice */}
      {activeCaptureTab === 'voice' && (
        <div className="flex flex-col items-center py-4">
          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
            )}
            <button
              onClick={() => { if (!isRecording) startRecording(); else stopRecording() }}
              className={`relative size-16 rounded-full flex items-center justify-center transition-all duration-300 min-w-[64px] min-h-[64px] ${
                isRecording
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : 'bg-white/5 text-[#9D8BA7] hover:bg-white/10 border border-white/8'
              }`}
            >
              <Mic className="size-7" />
            </button>
          </div>
          {isRecording && <p className="text-sm text-red-400 mt-3 font-medium">Recording... tap to stop</p>}
          {!isRecording && !voiceTranscript && !isTranscribing && (
            <p className="text-sm text-white/30 mt-3">Tap to start recording</p>
          )}
          {isTranscribing && !isRecording && (
            <div className="mt-4 w-full">
              <div className="rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-3 flex items-center gap-2">
                <Loader2 className="size-4 text-[#9D8BA7] animate-spin" />
                <p className="text-sm text-[#9D8BA7] font-medium">Transcribing your voice...</p>
              </div>
            </div>
          )}
          {voiceTranscript && !isRecording && (
            <div className="mt-4 w-full space-y-2">
              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                <p className="text-xs text-white/25 mb-1">Transcription</p>
                <p className="text-sm text-white/70 leading-relaxed">{voiceTranscript}</p>
              </div>
              {voiceSummary && (
                <div className="rounded-xl border border-[#9D8BA7]/15 bg-[#9D8BA7]/5 p-3">
                  <p className="text-xs text-[#9D8BA7]/70 font-medium mb-1">AI Summary</p>
                  <p className="text-sm text-white/70 leading-relaxed">{voiceSummary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Link */}
      {activeCaptureTab === 'link' && (
        <div>
          <div className="relative">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => handleLinkUrlChange(e.target.value)}
              placeholder="Paste any link..."
              className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-3 pr-14 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#9D8BA7]/30 transition-shadow min-h-[44px]"
            />
            <button
              onClick={handlePaste}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-[#9D8BA7] hover:text-[#c084fc] bg-[#9D8BA7]/10 hover:bg-[#9D8BA7]/20 rounded-lg px-2.5 py-1.5 transition-colors min-h-[36px]"
            >
              <ClipboardPaste className="size-3.5" />
              <span>Paste</span>
            </button>
          </div>
          {isProcessingLink && (
            <div className="mt-2 rounded-xl border border-[#9D8BA7]/15 bg-[#9D8BA7]/5 p-2.5 flex items-center gap-2">
              <Loader2 className="size-3.5 text-[#9D8BA7] animate-spin" />
              <p className="text-xs text-[#9D8BA7]">Processing link...</p>
            </div>
          )}
          {linkPreview && linkUrl.length > 5 && (
            <div className="mt-3 rounded-xl border border-white/8 bg-white/3 p-3 flex gap-3">
              <div className="size-14 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <Link2 className="size-5 text-[#9D8BA7]/50" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/70 truncate">Article Preview</p>
                <p className="text-xs text-white/25 mt-0.5 line-clamp-2">
                  A preview of the content from the link you saved. The full article will be summarized and tagged automatically.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image */}
      {activeCaptureTab === 'image' && (
        <div>
          {!imagePreview ? (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <label className="w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl border-2 border-dashed border-white/10 bg-white/2 cursor-pointer hover:border-[#9D8BA7]/25 transition-colors active:scale-[0.98]">
                <Upload className="size-5 text-[#9D8BA7]/50" />
                <div>
                  <p className="text-sm font-medium text-white/50">Choose from Gallery</p>
                  <p className="text-xs text-white/20">Select a photo from your library</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file) }}
                />
              </label>
              <label className="w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl bg-[#9D8BA7]/8 border border-[#9D8BA7]/15 cursor-pointer hover:bg-[#9D8BA7]/12 transition-colors active:scale-[0.98]">
                <Camera className="size-5 text-[#9D8BA7]" />
                <div>
                  <p className="text-sm font-medium text-[#9D8BA7]">Take a Photo</p>
                  <p className="text-xs text-[#9D8BA7]/40">Open camera to capture</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file) }}
                />
              </label>
            </div>
          ) : (
            <div className="relative">
              <img src={imagePreview} alt="Uploaded image preview" className="w-full rounded-xl object-cover max-h-[300px]" />
              <button
                onClick={() => { setImagePreview(null); setImageBase64(null); setImageDescription(''); setImageTags([]) }}
                className="absolute top-2 right-2 size-8 rounded-full bg-black/50 flex items-center justify-center text-white/60 hover:text-red-400 transition-colors min-w-[36px] min-h-[36px]"
              >
                <X className="size-4" />
              </button>
              {isAnalyzingImage && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center gap-2">
                  <Loader2 className="size-6 text-white animate-spin" />
                  <p className="text-xs text-white font-medium">Analyzing image...</p>
                </div>
              )}
              {!isAnalyzingImage && imageDescription && (
                <div className="mt-2 rounded-xl border border-[#9D8BA7]/15 bg-[#9D8BA7]/5 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Eye className="size-3.5 text-[#9D8BA7]" />
                    <p className="text-xs text-[#9D8BA7] font-medium">AI Analysis</p>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{imageDescription}</p>
                  {imageTags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {imageTags.map((tag) => (
                        <span key={tag} className="bg-[#9D8BA7]/10 text-[#9D8BA7] text-[10px] px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Shared tab buttons
  const tabButtons = (
    <div className="flex items-center gap-1 px-5 pb-3 shrink-0">
      {captureTabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveCaptureTab(tab.key)}
          className={`flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-full transition-all duration-200 min-h-[40px] whitespace-nowrap ${
            activeCaptureTab === tab.key
              ? 'bg-[#9D8BA7] text-white'
              : 'bg-white/5 text-white/35 hover:text-white/50 hover:bg-white/8'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )

  // Upgrade dialog (shared)
  const upgradeDialog = (
    <AnimatePresence>
      {showUpgradeDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-none md:backdrop-blur-sm"
          onClick={() => setShowUpgradeDialog(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="rounded-3xl max-w-sm w-full mx-4 overflow-hidden shadow-none md:shadow-2xl border border-[var(--glass-border)]"
            style={{ background: 'var(--modal-bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-[#9D8BA7] to-[#C4B5CE]" />
            <div className="p-6 text-center">
              <div className="mx-auto size-16 rounded-2xl bg-[#9D8BA7]/10 flex items-center justify-center mb-4">
                <Sparkles className="size-8 text-[#9D8BA7]" />
              </div>
              <h3 className="text-xl font-semibold text-white/90 mb-2">
                You've reached your Seed plan limit
              </h3>
              <p className="text-sm text-white/40 leading-relaxed mb-6">
                50 memories saved! Upgrade to <span className="font-semibold text-[#9D8BA7]">Bloom</span> for unlimited memories, advanced AI insights, and more.
              </p>
              <button
                className="w-full bg-[#9D8BA7] hover:bg-[#8A7A96] text-white rounded-xl h-11 text-sm font-semibold transition-colors mb-3 min-h-[44px]"
                onClick={() => setShowUpgradeDialog(false)}
              >
                Upgrade to Bloom
              </button>
              <button
                className="w-full text-sm text-white/30 hover:text-white/50 transition-colors py-2 min-h-[44px]"
                onClick={() => setShowUpgradeDialog(false)}
              >
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ---- Mobile Bottom Sheet ----
  if (isMobile) {
    return (
      <>
        {upgradeDialog}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50"
          onClick={handleClose}
        />
        <motion.div
          ref={sheetRef}
          initial={{ y: '100%' }}
          animate={{ y: isDragging ? dragY : 0, opacity: 1 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl h-[92dvh] flex flex-col overflow-hidden border-t border-[var(--glass-border)]"
          style={{ background: 'var(--modal-bg)', transform: isDragging ? `translateY(${dragY}px)` : undefined }}
          onTouchStart={(e) => {
            const sheet = sheetRef.current
            if (!sheet) return
            const rect = sheet.getBoundingClientRect()
            const touchY = e.touches[0].clientY
            if (touchY - rect.top < 48) {
              setIsDragging(true)
              ;(e as any)._startY = touchY
            }
          }}
          onTouchMove={(e) => {
            if (!isDragging) return
            const sheet = sheetRef.current
            if (!sheet) return
            const rect = sheet.getBoundingClientRect()
            const startY = (e as any)._startY || (rect.bottom - 85 * window.innerHeight / 100)
            const currentY = e.touches[0].clientY
            const delta = currentY - startY
            setDragY(Math.max(0, delta))
          }}
          onTouchEnd={() => {
            if (!isDragging) return
            setIsDragging(false)
            if (dragY > 100) handleClose()
            setDragY(0)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/15" />
          </div>
          <div className="flex items-center justify-between px-4 pb-2 shrink-0">
            <h2 className="text-base font-semibold text-white/80">Quick Capture</h2>
            <button
              onClick={handleClose}
              className="size-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white/30 min-w-[44px] min-h-[44px]"
            >
              <X className="size-4" />
            </button>
          </div>
          {/* Tab content - scrollable area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden ios-scroll px-4 pb-4 min-h-0">
            {activeCaptureTab === 'text' && (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full min-h-[160px] resize-none rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#9D8BA7]/30 transition-shadow"
              />
            )}

            {activeCaptureTab === 'voice' && (
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                  )}
                  <button
                    onClick={() => { if (!isRecording) startRecording(); else stopRecording() }}
                    className={`relative size-16 rounded-full flex items-center justify-center transition-all duration-300 min-w-[64px] min-h-[64px] ${
                      isRecording
                        ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                        : 'bg-white/5 text-[#9D8BA7] hover:bg-white/10 border border-white/8'
                    }`}
                  >
                    <Mic className="size-7" />
                  </button>
                </div>
                {isRecording && <p className="text-sm text-red-400 mt-3 font-medium">Recording... tap to stop</p>}
                {!isRecording && !voiceTranscript && !isTranscribing && (
                  <p className="text-sm text-white/30 mt-3">Tap to start recording</p>
                )}
                {isTranscribing && !isRecording && (
                  <div className="mt-4 w-full">
                    <div className="rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-3 flex items-center gap-2">
                      <Loader2 className="size-4 text-[#9D8BA7] animate-spin" />
                      <p className="text-sm text-[#9D8BA7] font-medium">Transcribing your voice...</p>
                    </div>
                  </div>
                )}
                {voiceTranscript && !isRecording && (
                  <div className="mt-4 w-full space-y-2">
                    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                      <p className="text-xs text-white/25 mb-1">Transcription</p>
                      <p className="text-sm text-white/70 leading-relaxed">{voiceTranscript}</p>
                    </div>
                    {voiceSummary && (
                      <div className="rounded-xl border border-[#9D8BA7]/15 bg-[#9D8BA7]/5 p-3">
                        <p className="text-xs text-[#9D8BA7]/70 font-medium mb-1">AI Summary</p>
                        <p className="text-sm text-white/70 leading-relaxed">{voiceSummary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeCaptureTab === 'link' && (
              <div>
                <div className="relative">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => handleLinkUrlChange(e.target.value)}
                    placeholder="Paste any link..."
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-3 pr-14 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#9D8BA7]/30 transition-shadow min-h-[44px]"
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-[#9D8BA7] hover:text-[#c084fc] bg-[#9D8BA7]/10 hover:bg-[#9D8BA7]/20 rounded-lg px-2.5 py-1.5 transition-colors min-h-[36px]"
                  >
                    <ClipboardPaste className="size-3.5" />
                    <span>Paste</span>
                  </button>
                </div>
                {isProcessingLink && (
                  <div className="mt-2 rounded-xl border border-[#9D8BA7]/15 bg-[#9D8BA7]/5 p-2.5 flex items-center gap-2">
                    <Loader2 className="size-3.5 text-[#9D8BA7] animate-spin" />
                    <p className="text-xs text-[#9D8BA7]">Processing link...</p>
                  </div>
                )}
                {linkPreview && linkUrl.length > 5 && (
                  <div className="mt-3 rounded-xl border border-white/8 bg-white/3 p-3 flex gap-3">
                    <div className="size-14 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <Link2 className="size-5 text-[#9D8BA7]/50" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white/70 truncate">Article Preview</p>
                      <p className="text-xs text-white/25 mt-0.5 line-clamp-2">
                        A preview of the content from the link you saved. The full article will be summarized and tagged automatically.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeCaptureTab === 'image' && (
              <div>
                {!imagePreview ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-4">
                    <label className="w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl border-2 border-dashed border-white/10 bg-white/2 cursor-pointer hover:border-[#9D8BA7]/25 transition-colors active:scale-[0.98]">
                      <Upload className="size-5 text-[#9D8BA7]/50" />
                      <div>
                        <p className="text-sm font-medium text-white/50">Choose from Gallery</p>
                        <p className="text-xs text-white/20">Select a photo from your library</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file) }}
                      />
                    </label>
                    <label className="w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl bg-[#9D8BA7]/8 border border-[#9D8BA7]/15 cursor-pointer hover:bg-[#9D8BA7]/12 transition-colors active:scale-[0.98]">
                      <Camera className="size-5 text-[#9D8BA7]" />
                      <div>
                        <p className="text-sm font-medium text-[#9D8BA7]">Take a Photo</p>
                        <p className="text-xs text-[#9D8BA7]/40">Open camera to capture</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file) }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <img src={imagePreview} alt="Uploaded image preview" className="w-full rounded-xl object-cover max-h-[300px]" />
                    <button
                      onClick={() => { setImagePreview(null); setImageBase64(null); setImageDescription(''); setImageTags([]) }}
                      className="absolute top-2 right-2 size-8 rounded-full bg-black/50 flex items-center justify-center text-white/60 hover:text-red-400 transition-colors min-w-[36px] min-h-[36px]"
                    >
                      <X className="size-4" />
                    </button>
                    {isAnalyzingImage && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 text-white animate-spin" />
                        <p className="text-xs text-white font-medium">Analyzing image...</p>
                      </div>
                    )}
                    {!isAnalyzingImage && imageDescription && (
                      <div className="mt-2 rounded-xl border border-[#9D8BA7]/15 bg-[#9D8BA7]/5 p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Eye className="size-3.5 text-[#9D8BA7]" />
                          <p className="text-xs text-[#9D8BA7] font-medium">AI Analysis</p>
                        </div>
                        <p className="text-sm text-white/70 leading-relaxed">{imageDescription}</p>
                        {imageTags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {imageTags.map((tag) => (
                              <span key={tag} className="bg-[#9D8BA7]/10 text-[#9D8BA7] text-[10px] px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom bar: tags + tab icons + send button */}
          <div className="shrink-0 px-4 pt-2 border-t border-white/5" style={{ paddingBottom: 'max(1.5rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)))' }}>
            {/* Tags row */}
            <div className="mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                {manualTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50 border border-white/8 whitespace-nowrap"
                  >
                    {tag}
                    <button
                      onClick={() => setManualTags((prev) => prev.filter((t) => t !== tag))}
                      className="ml-0.5 w-7 h-7 -my-1 -mr-1 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {manualTags.length < 6 && (
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={manualTagInput}
                    onChange={(e) => setManualTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && manualTagInput.trim()) {
                        e.preventDefault()
                        let tag = manualTagInput.trim().replace(/^#+/, '')
                        tag = `#${tag}`
                        if (!manualTags.includes(tag)) setManualTags((prev) => [...prev, tag])
                        setManualTagInput('')
                        setTimeout(() => tagInputRef.current?.focus(), 0)
                      }
                      if (e.key === ' ' && manualTagInput.trim() && manualTagInput.trim().length >= 2) {
                        e.preventDefault()
                        let tag = manualTagInput.trim().replace(/^#+/, '')
                        tag = `#${tag}`
                        if (!manualTags.includes(tag)) setManualTags((prev) => [...prev, tag])
                        setManualTagInput('')
                        setTimeout(() => tagInputRef.current?.focus(), 0)
                      }
                      if (e.key === 'Backspace' && !manualTagInput && manualTags.length > 0) {
                        setManualTags((prev) => prev.slice(0, -1))
                      }
                    }}
                    placeholder={manualTags.length === 0 ? 'Tags' : '#'}
                    className="min-h-[36px] flex-1 min-w-[80px] rounded-full border border-white/8 bg-transparent px-3 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/15 transition-all duration-300"
                  />
                )}
              </div>
            </div>

            {/* Tab icons + Send button row */}
            <div className="flex items-center gap-1.5">
              {/* Tab icon buttons */}
              {captureTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveCaptureTab(tab.key)}
                  className={`size-11 flex items-center justify-center rounded-xl transition-all duration-200 ${
                    activeCaptureTab === tab.key
                      ? 'text-[#9D8BA7] bg-[#9D8BA7]/10'
                      : 'text-white/30 hover:text-white/50 hover:bg-white/5'
                  }`}
                  aria-label={tab.label}
                >
                  {tab.icon}
                </button>
              ))}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Send button — 48px circle with purple gradient */}
              <button
                onClick={handleSave}
                disabled={isSaving || isAnalyzingImage || (activeCaptureTab === 'text' && !textContent.trim()) || (activeCaptureTab === 'link' && !linkUrl.trim()) || (activeCaptureTab === 'voice' && !voiceTranscript && !isTranscribing)}
                className="size-12 rounded-full bg-gradient-to-r from-[#9D8BA7] to-[#c084fc] flex items-center justify-center text-white shadow-lg shadow-[#9D8BA7]/25 disabled:opacity-40 disabled:shadow-none transition-all duration-200 active:scale-95 shrink-0"
                aria-label="Save memory"
              >
                {isSaving ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </>
    )
  }

  // ---- Desktop Centered Modal ----
  return (
    <>
      {upgradeDialog}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-none md:backdrop-blur-xl"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-none md:shadow-xl border border-[var(--glass-border)]"
          style={{ background: 'var(--modal-bg)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <h2 className="text-lg font-semibold text-white/80">Quick Capture</h2>
            <button
              onClick={handleClose}
              className="size-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors text-white/30"
            >
              <X className="size-4" />
            </button>
          </div>
          {tabButtons}
          {tabContent}
          {tagAndSaveSection}
        </motion.div>
      </motion.div>
    </>
  )
}

// ────────────────────────────────────────────────────────────
// Main Dashboard
// ────────────────────────────────────────────────────────────

interface DashboardProps {
  onMemoryClick?: (id: string) => void
}

export default function Dashboard({ onMemoryClick }: DashboardProps) {
  const {
    memories,
    setSelectedMemoryId,
    setCurrentView,
    setCaptureModalOpen,
    setActiveCaptureTab,
    addMemory,
    updateMemory,
    autoTagging,
    user,
    searchQuery,
    isLoadingMemories,
    darkMode,
    activeFilter,
    setActiveFilter,
  } = useAetherStore()

  const { toast } = useToast()
  const [captureInput, setCaptureInput] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSendingRecap, setIsSendingRecap] = useState(false)
  const [recapCooldown, setRecapCooldown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = setTimeout(() => setPrefersReducedMotion(mq.matches), 0)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => {
      clearTimeout(timer)
      mq.removeEventListener('change', handler)
    }
  }, [])

  // Filter + sort memories (search + type filter)
  const sortedMemories = useMemo(() => {
    let filtered = memories
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (activeFilter && activeFilter !== 'All') {
      const typeMap: Record<string, string> = { 'Text': 'text', 'Voice': 'voice', 'Links': 'link', 'Images': 'image' }
      const filterType = typeMap[activeFilter]
      if (filterType) {
        filtered = filtered.filter((m) => m.type === filterType)
      }
    }
    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [memories, searchQuery, activeFilter])

  const handleMemoryClick = useCallback((id: string) => {
    if (onMemoryClick) {
      onMemoryClick(id)
    } else {
      setSelectedMemoryId(id)
      setCurrentView('memory-detail')
    }
  }, [onMemoryClick, setSelectedMemoryId, setCurrentView])

  // Inline generateTags for quick capture
  const generateTags = useCallback(async (content: string, type: string): Promise<string[]> => {
    if (!content.trim()) return getSmartFallbackTags(content, type)
    const cached = getCachedTags(content, type)
    if (cached) return cached
    const { autoTagging } = useAetherStore.getState()
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
  }, [])

  // Quick capture — inline text/link input
  const handleQuickCapture = useCallback(async () => {
    const text = captureInput.trim()
    if (!text) return

    setIsCapturing(true)
    const detectedType: MemoryType = isUrl(text) ? 'link' : 'text'
    const tempId = `mem-${Date.now()}`
    const title = detectedType === 'link'
      ? 'Saved link'
      : text.slice(0, 50) || 'Quick note'
    const content = text
    const fallbackTags = getSmartFallbackTags(content, detectedType)

    const isOffline = !navigator.onLine

    // Immediately add to store
    addMemory({
      id: tempId,
      type: detectedType,
      title,
      content,
      tags: fallbackTags,
      createdAt: new Date().toISOString(),
      taggingStatus: isOffline ? 'complete' : 'pending',
      syncStatus: isOffline ? 'pending' : 'synced',
      ...(detectedType === 'link' ? { source: text, sourceUrl: text } : {}),
    })

    // Clear input immediately
    setCaptureInput('')
    setIsCapturing(false)
    toast({ title: 'Memory saved ✓', description: 'Your memory has been captured.' })

    // After 2 seconds, upgrade tagging status
    const taggingTimeout = setTimeout(() => {
      updateMemory(tempId, { taggingStatus: 'tagging' })
    }, 2000)

    if (isOffline) {
      clearTimeout(taggingTimeout)
      try {
        await createMemory({
          type: detectedType,
          title,
          content,
          tags: fallbackTags,
          ...(detectedType === 'link' ? { sourceUrl: text } : {}),
        })
      } catch { /* offline save failed */ }
      return
    }

    // Background: save to Supabase + generate AI tags
    try {
      const { user } = useAetherStore.getState()
      if (user?.plan === 'free') {
        const count = await getMemoryCount()
        if (count >= 50) {
          clearTimeout(taggingTimeout)
          updateMemory(tempId, { taggingStatus: 'complete' })
          return
        }
      }

      if (detectedType === 'link') {
        const [linkResult, savedMemory] = await Promise.all([
          fetch('/api/ai/fetch-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: text }),
          })
            .then((r) => r.json())
            .catch(() => ({ success: false, title: '', description: '', content: '', siteName: '', image: '' })),
          createMemory({
            type: 'link',
            title,
            content,
            tags: fallbackTags,
            sourceUrl: text,
          }),
        ])

        let enrichedContent = content
        let enrichedTitle = title
        let enrichedImage = ''
        let siteName = ''

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

        const tagContent = enrichedContent === content ? text : enrichedContent
        const [aiTags, insightResult] = await Promise.all([
          generateTags(tagContent, 'link'),
          fetch('/api/ai/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: tagContent, type: 'link', tags: fallbackTags, title: enrichedTitle }),
          })
            .then((r) => r.json())
            .catch(() => ({ insight: '' })),
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
          ...(savedMemory.source ? { source: savedMemory.source } : {}),
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
          createMemory({
            type: detectedType,
            title,
            content,
            tags: fallbackTags,
          }),
          generateTags(content, detectedType),
        ])

        clearTimeout(taggingTimeout)

        updateMemory(tempId, {
          id: savedMemory.id,
          tags: aiTags,
          taggingStatus: 'complete',
          createdAt: savedMemory.createdAt,
          ...(savedMemory.syncStatus ? { syncStatus: savedMemory.syncStatus } : {}),
          ...(savedMemory.aiSummary ? { aiSummary: savedMemory.aiSummary } : {}),
          ...(savedMemory.source ? { source: savedMemory.source } : {}),
        })
      }
    } catch {
      clearTimeout(taggingTimeout)
      try {
        const aiTags = await generateTags(content, detectedType)
        updateMemory(tempId, { tags: aiTags, taggingStatus: 'complete' })
      } catch {
        updateMemory(tempId, { taggingStatus: 'complete' })
      }
    }
  }, [captureInput, addMemory, updateMemory, generateTags, toast])

  const handleMicClick = useCallback(() => {
    setActiveCaptureTab('voice')
    setCaptureModalOpen(true)
  }, [setActiveCaptureTab, setCaptureModalOpen])

  // ─── Weekly Recap Email Handler ───
  const handleSendRecap = useCallback(async () => {
    if (isSendingRecap || recapCooldown) return

    // Need user info from the store
    const currentUser = user ?? useAetherStore.getState().user
    if (!currentUser?.id || !currentUser?.email) {
      toast({ title: 'Please sign in first', description: 'You need to be logged in to send a recap.' })
      return
    }

    setIsSendingRecap(true)

    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      const res = await fetch('https://tbompcwyijpnzwlttkq.supabase.co/functions/v1/weekly-recap-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          userId: currentUser.id,
          userEmail: currentUser.email,
        }),
      })

      if (res.ok) {
        toast({ title: 'Recap sent to your inbox! ✉️', description: 'Check your email for your weekly summary.' })
      } else {
        toast({ title: 'Could not send recap', description: 'Something went wrong. Please try again later.' })
      }
    } catch {
      toast({ title: 'Could not send recap', description: 'Network error. Please check your connection and try again.' })
    } finally {
      setIsSendingRecap(false)
      // 5-second cooldown to prevent spamming
      setRecapCooldown(true)
      setTimeout(() => setRecapCooldown(false), 5000)
    }
  }, [user, isSendingRecap, recapCooldown, toast])

  // Count memories this week for stats bar
  const memoriesThisWeek = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)
    return memories.filter((m) => new Date(m.createdAt) >= weekAgo).length
  }, [memories])

  // Filter pills configuration
  const filterPills = useMemo(() => [
    { key: 'All', label: 'All' },
    { key: 'Text', label: 'Text' },
    { key: 'Voice', label: 'Voice' },
    { key: 'Links', label: 'Links' },
    { key: 'Images', label: 'Images' },
  ], [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden overflow-x-hidden w-full relative" style={darkMode ? { background: 'var(--main-bg)' } : { background: '#ffffff' }}>
      {/* Aurora Background — behind capture area */}
      {!prefersReducedMotion && <AuroraBackground />}

      {/* ─── Mobile Header — compact: logo + search pill + theme toggle ─── */}
      <div
        className="md:hidden sticky top-0 z-20 px-3 py-2 backdrop-blur-xl border-b"
        style={{
          background: darkMode ? 'rgba(7,7,15,0.8)' : 'rgba(255,255,255,0.85)',
          borderColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          <h1 className={`text-base font-bold ${darkMode ? 'text-white/90' : 'text-gray-900'}`}>Aether</h1>
          <div className="flex-1" />
          {/* Search icon pill — taps into Ask Aether */}
          <button
            onClick={() => setCurrentView('ask-aether')}
            className="cursor-pointer flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs min-h-[32px] transition-colors"
            style={{
              background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            }}
            aria-label="Search memories"
          >
            <Search size={14} className="text-[#9D8BA7]/70" />
            <span>Ask</span>
          </button>
        </div>
      </div>

      {/* ─── Mobile Search Pill (tappable to open Ask Aether) ─── */}
      <div className="md:hidden px-4 pt-2 pb-1">
        <button
          onClick={() => setCurrentView('ask-aether')}
          className="cursor-pointer w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm backdrop-blur-xl min-h-[44px] relative z-10 transition-colors"
          style={{
            background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
            border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
          }}
          aria-label="Search memories"
        >
          <Search size={15} className={`flex-shrink-0 ${darkMode ? 'text-[#9D8BA7]/60' : 'text-[#9D8BA7]/50'}`} />
          <span className={`flex-1 text-left text-sm ${darkMode ? 'text-white/30' : 'text-gray-400'}`}>
            What do you remember?
          </span>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 ios-scroll relative z-10">
        <div className="px-4 md:px-6 md:pt-8 md:pb-6 pb-24 max-w-2xl mx-auto">
          {/* Aurora glow — compact version for mobile */}
          <div className="md:hidden absolute top-0 left-1/2 -translate-x-1/2 w-[250px] h-[80px] rounded-full blur-3xl pointer-events-none" aria-hidden="true" style={{ background: darkMode ? 'rgba(157, 139, 167, 0.12)' : 'rgba(157, 139, 167, 0.06)' }} />

          {/* ─── Desktop Search Bar (hidden on mobile) ─── */}
          <motion.section
            initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="hidden md:block mb-6"
          >
            <button
              onClick={() => setCurrentView('ask-aether')}
              className="cursor-pointer w-full flex items-center gap-2.5 rounded-xl px-4 text-sm md:text-base transition-all duration-200 group min-h-[44px]"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: 'var(--card-shadow)',
              }}
              aria-label="Search memories"
            >
              <Search
                size={16}
                className="flex-shrink-0 text-[#9D8BA7]/60 group-hover:text-[#9D8BA7] transition-colors duration-150"
              />
              <span className="flex-1 text-left text-sm md:text-base" style={{ color: 'var(--text-subtle)' }}>
                What do you remember?
              </span>
              <kbd
                className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: 'var(--glass-tag-bg)', color: 'var(--glass-tag-text)' }}
              >
                ⌘K
              </kbd>
            </button>
          </motion.section>

          {/* ─── Stats Bar ─── */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-center py-1 mb-2 flex items-center justify-center gap-1 flex-wrap"
          >
            <span className={`text-[11px] ${darkMode ? 'text-white/30' : 'text-gray-400'}`}>
              <span>{sortedMemories.length} {sortedMemories.length === 1 ? 'memory' : 'memories'}</span>
              <span className={`hidden sm:inline ${darkMode ? 'text-white/15' : 'text-gray-300'}`}>·</span>
              <span>{memoriesThisWeek} this week</span>
            </span>
          </motion.div>

          {/* ─── Filter Pills ─── */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 md:mb-5 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0"
          >
            {filterPills.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setActiveFilter(pill.key)}
                className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium transition-all duration-200 min-w-[44px] ${
                  activeFilter === pill.key
                    ? 'bg-[#9D8BA7]/15 text-[#9D8BA7]'
                    : darkMode
                      ? 'bg-white/5 text-white/40 hover:bg-white/8 hover:text-white/60'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </motion.div>

          {/* ─── Recent Memories Section ─── */}
          <motion.section
            initial={prefersReducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3 md:mb-4 gap-2">
              <h2 className={`text-sm md:text-base font-semibold tracking-wide uppercase ${darkMode ? 'text-white/40' : 'text-gray-400'}`}>
                Recent Memories
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendRecap}
                  disabled={isSendingRecap || recapCooldown}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-muted)',
                  }}
                  aria-label="Send weekly recap email"
                >
                  {isSendingRecap ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Mail className="size-3" />
                  )}
                  <span className="hidden sm:inline">{isSendingRecap ? 'Sending...' : recapCooldown ? 'Sent ✓' : 'Weekly Recap'}</span>
                </button>
              </div>
            </div>

            {isLoadingMemories ? (
              /* Loading skeletons */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 md:p-5"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border-subtle)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-7 rounded-lg animate-pulse" style={{ background: 'var(--glass-bg-hover)' }} />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: 'var(--glass-bg-hover)' }} />
                        <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--glass-input-bg)' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedMemories.length > 0 ? (
              /* Memory feed — single column on mobile, grid on larger screens */
              <div className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
                {sortedMemories.map((memory, index) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => handleMemoryClick(memory.id)}
                    index={index}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </motion.section>
        </div>
      </div>

      {/* Quick Capture Modal — for voice, link, image captures */}
      <QuickCaptureModal />
    </div>
  )
}
