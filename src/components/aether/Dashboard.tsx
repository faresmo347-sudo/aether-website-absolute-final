'use client'

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, FileText, Link2, ImageIcon, X, Upload, Plus, ArrowLeft, FolderOpen, Loader2, Eye, Sparkles, ClipboardPaste, CheckSquare, Square, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAetherStore } from '@/store/aether-store'
import { createMemory, getMemoryCount } from '@/lib/supabase/data'
import { getCachedTags, setCachedTags } from '@/lib/tag-cache'
import type { Memory, MemoryType } from '@/components/aether/types'

// ---------- helpers ----------

const FILTER_MAP: Record<string, MemoryType | undefined> = {
  All: undefined,
  Text: 'text',
  Voice: 'voice',
  Links: 'link',
  Images: 'image',
}

const FILTERS = Object.keys(FILTER_MAP)

const TYPE_ACCENT_COLORS: Record<MemoryType, { border: string; bg: string; text: string; glow: string }> = {
  text: {
    border: 'rgba(157,139,167,0.6)',
    bg: 'rgba(157,139,167,0.1)',
    text: '#9D8BA7',
    glow: 'rgba(157,139,167,0.3)',
  },
  voice: {
    border: 'rgba(192,132,252,0.6)',
    bg: 'rgba(192,132,252,0.1)',
    text: '#c084fc',
    glow: 'rgba(192,132,252,0.3)',
  },
  link: {
    border: 'rgba(103,232,249,0.6)',
    bg: 'rgba(103,232,249,0.1)',
    text: '#67e8f9',
    glow: 'rgba(103,232,249,0.3)',
  },
  image: {
    border: 'rgba(134,239,172,0.6)',
    bg: 'rgba(134,239,172,0.1)',
    text: '#86efac',
    glow: 'rgba(134,239,172,0.3)',
  },
}

function typeIcon(type: MemoryType) {
  const colors = TYPE_ACCENT_COLORS[type]
  switch (type) {
    case 'voice':
      return <Mic className="size-3.5" style={{ color: colors.text }} />
    case 'link':
      return <Link2 className="size-3.5" style={{ color: colors.text }} />
    case 'image':
      return <ImageIcon className="size-3.5" style={{ color: colors.text }} />
    default:
      return <FileText className="size-3.5" style={{ color: colors.text }} />
  }
}

function typeLabel(type: MemoryType): string {
  switch (type) {
    case 'voice': return 'Voice'
    case 'link': return 'Link'
    case 'image': return 'Image'
    default: return 'Text'
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

// ---------- sub-components (memoized) ----------

const MemoryCard = memo(function MemoryCard({
  memory,
  onClick,
  index,
}: {
  memory: Memory
  onClick: () => void
  index: number
}) {
  const isTagging = memory.taggingStatus === 'tagging' || memory.taggingStatus === 'pending'
  const isSyncing = memory.syncStatus === 'pending' || memory.syncStatus === 'syncing'
  const accent = TYPE_ACCENT_COLORS[memory.type]

  return (
    <button
      onClick={onClick}
      className="tap-feedback card-contain animate-card-entrance w-full text-left cursor-pointer group active:scale-[0.98]"
      style={{
        animationDelay: `${index * 40}ms`,
        background: 'rgba(15, 15, 26, 0.8)',
        border: '1px solid rgba(157,139,167,0.1)',
        borderRadius: '16px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: `1px solid ${accent.border}`,
        transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.border = '1px solid rgba(157,139,167,0.25)'
        el.style.borderTop = `1px solid ${accent.border}`
        el.style.background = 'rgba(20, 20, 35, 0.9)'
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(157,139,167,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.border = '1px solid rgba(157,139,167,0.1)'
        el.style.borderTop = `1px solid ${accent.border}`
        el.style.background = 'rgba(15, 15, 26, 0.8)'
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      <div className="p-4 relative">
        {/* Type pill badge — top right */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{
            background: accent.bg,
            border: `1px solid ${accent.border.replace('0.6', '0.2')}`,
          }}
        >
          <span style={{ filter: `drop-shadow(0 0 4px ${accent.glow})` }}>
            {typeIcon(memory.type)}
          </span>
          <span className="text-[10px] font-medium" style={{ color: accent.text }}>
            {typeLabel(memory.type)}
          </span>
        </div>

        <div className="min-w-0 pr-20">
          {/* Title */}
          <h3
            className="font-semibold leading-snug truncate transition-colors"
            style={{
              fontSize: '15px',
              color: '#f0f0f8',
              textShadow: '0 0 20px rgba(157,139,167,0.3)',
            }}
          >
            {memory.title}
          </h3>

          {/* Content preview */}
          <p
            className="mt-1.5 line-clamp-2 leading-relaxed overflow-hidden"
            style={{
              fontSize: '12px',
              color: 'rgba(240,240,248,0.5)',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {memory.content}
          </p>

          {/* AI insight preview */}
          {memory.aiSummary && !isTagging && (
            <div
              className="mt-2 text-xs italic leading-relaxed"
              style={{
                color: 'rgba(240,240,248,0.4)',
                borderLeft: '2px solid rgba(157,139,167,0.3)',
                paddingLeft: '8px',
              }}
            >
              {memory.aiSummary}
            </div>
          )}
        </div>

        {/* Bottom row: tags + date */}
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {memory.tags.slice(0, 3).map((tag, i) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-0.5 rounded-full whitespace-nowrap transition-all duration-500"
                style={
                  isTagging
                    ? {
                        background: 'rgba(157,139,167,0.05)',
                        color: 'rgba(157,139,167,0.4)',
                        border: '1px solid rgba(157,139,167,0.08)',
                        animationDelay: `${i * 200}ms`,
                      }
                    : {
                        background: 'rgba(157,139,167,0.08)',
                        color: '#c084fc',
                        border: '1px solid rgba(157,139,167,0.15)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!isTagging) e.currentTarget.style.background = 'rgba(157,139,167,0.15)'
                }}
                onMouseLeave={(e) => {
                  if (!isTagging) e.currentTarget.style.background = 'rgba(157,139,167,0.08)'
                }}
              >
                {isTagging ? (
                  <span className="animate-pulse">{tag}</span>
                ) : (
                  tag
                )}
              </span>
            ))}
            {/* Sync indicator for offline-captured memories */}
            {isSyncing && !isTagging && (
              <span
                className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  color: 'rgba(251,191,36,0.7)',
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.15)',
                }}
              >
                <span className="relative flex size-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/40 opacity-75" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-amber-500/70" />
                </span>
                Syncing...
              </span>
            )}
            {/* Aether is thinking indicator */}
            {isTagging && (
              <span
                className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  color: 'rgba(157,139,167,0.6)',
                  background: 'rgba(157,139,167,0.05)',
                  border: '1px solid rgba(157,139,167,0.1)',
                }}
              >
                <span className="relative flex size-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9D8BA7]/40 opacity-75" />
                  <span className="relative inline-flex rounded-full size-1.5 bg-[#9D8BA7]/60" />
                </span>
                Aether is thinking...
              </span>
            )}
          </div>
          <span
            className="font-mono whitespace-nowrap shrink-0"
            style={{ fontSize: '11px', color: 'rgba(240,240,248,0.35)' }}
          >
            {formatDate(memory.createdAt)}
          </span>
        </div>
      </div>
    </button>
  )
})

// ---------- EmptyState (deep-space star) ----------

const EmptyState = memo(function EmptyState({ collectionName }: { collectionName?: string }) {
  const { setCaptureModalOpen } = useAetherStore()

  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4 sm:px-6 text-center">
      {/* Deep-space star */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Outer radial glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(157,139,167,0.2) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
        {/* Star core */}
        <div
          className="animate-star-pulse relative size-5 rounded-full bg-[#9D8BA7]"
          style={{
            boxShadow: '0 0 40px #9D8BA7, 0 0 80px rgba(157,139,167,0.5)',
          }}
        />
        {/* Tiny ambient stars */}
        <div
          className="absolute size-1 rounded-full bg-[#9D8BA7]/40"
          style={{ top: '-8px', right: '12px', boxShadow: '0 0 6px rgba(157,139,167,0.4)' }}
        />
        <div
          className="absolute size-0.5 rounded-full bg-[#9D8BA7]/30"
          style={{ bottom: '4px', left: '8px', boxShadow: '0 0 4px rgba(157,139,167,0.3)' }}
        />
        <div
          className="absolute size-0.5 rounded-full bg-[#c084fc]/30"
          style={{ top: '16px', left: '-6px', boxShadow: '0 0 4px rgba(192,132,252,0.3)' }}
        />
      </div>

      <h3 className="font-serif text-xl font-semibold" style={{ color: '#f0f0f8' }}>
        {collectionName
          ? `No memories in ${collectionName} yet`
          : 'Your universe is empty'}
      </h3>
      <p
        className="text-sm mt-2 max-w-xs leading-relaxed"
        style={{ color: 'rgba(240,240,248,0.45)' }}
      >
        {collectionName
          ? `Start capturing memories to this collection and they'll appear here.`
          : 'Save your first memory and watch your constellation grow'}
      </p>

      {/* Glowing CTA button */}
      {!collectionName && (
        <button
          onClick={() => setCaptureModalOpen(true)}
          className="mt-6 inline-flex items-center gap-2 text-white rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] min-h-[44px]"
          style={{
            background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
            boxShadow: '0 4px 20px rgba(157,139,167,0.3), 0 0 40px rgba(157,139,167,0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(157,139,167,0.4), 0 0 60px rgba(157,139,167,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(157,139,167,0.3), 0 0 40px rgba(157,139,167,0.15)'
          }}
        >
          <Plus className="size-4" />
          Save your first memory →
        </button>
      )}
    </div>
  )
})

// ---------- StatsBar ----------

const StatsBar = memo(function StatsBar() {
  const { memories, collections } = useAetherStore()

  const lastSaved = useMemo(() => {
    if (memories.length === 0) return null
    const sorted = [...memories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return sorted[0].createdAt
  }, [memories])

  return (
    <div
      className="font-mono select-none"
      style={{ fontSize: '11px', color: 'rgba(240,240,248,0.3)' }}
    >
      ✦ {memories.length} memories · {collections.length} collections
      {lastSaved && ` · last saved ${formatRelativeTime(lastSaved)}`}
    </div>
  )
})

// ---------- FilterBar (memoized) ----------

const FilterBar = memo(function FilterBar() {
  const { activeFilter, setActiveFilter, collectionFilter, setCollectionFilter, collections } = useAetherStore()

  const activeCollection = useMemo(
    () => (collectionFilter ? collections.find((c) => c.id === collectionFilter) : null),
    [collectionFilter, collections]
  )

  if (activeCollection) {
    return (
      <div className="flex items-center gap-3 min-h-[44px]">
        <button
          onClick={() => setCollectionFilter(null)}
          className="tap-feedback flex items-center gap-1.5 text-sm transition-colors font-medium active:scale-[0.98] min-h-[44px]"
          style={{ color: '#9D8BA7' }}
        >
          <ArrowLeft className="size-4" />
          All memories
        </button>
        <div className="h-4 w-px" style={{ background: 'rgba(157,139,167,0.12)' }} />
        <div
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium"
          style={{
            color: '#9D8BA7',
            background: 'rgba(157,139,167,0.08)',
            border: '1px solid rgba(157,139,167,0.15)',
          }}
        >
          <FolderOpen className="size-3.5" />
          {activeCollection.name}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto flex-nowrap scrollbar-none pb-1">
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => setActiveFilter(f)}
          className={`tap-feedback text-sm px-4 py-2.5 rounded-full whitespace-nowrap min-w-fit transition-all duration-200 active:scale-[0.96] min-h-[40px] ${
            activeFilter === f
              ? 'text-white shadow-lg'
              : ''
          }`}
          style={
            activeFilter === f
              ? {
                  background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
                  boxShadow: '0 4px 16px rgba(157,139,167,0.2)',
                }
              : {
                  background: 'rgba(15, 15, 26, 0.8)',
                  color: 'rgba(240,240,248,0.45)',
                  border: '1px solid rgba(157,139,167,0.06)',
                }
          }
        >
          {f}
        </button>
      ))}
    </div>
  )
})

// ---------- Quick Capture Modal (Bottom Sheet on Mobile) ----------

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

  const [textContent, setTextContent] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceSummary, setVoiceSummary] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkPreview, setLinkPreview] = useState(false)
  const [isProcessingLink, setIsProcessingLink] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageDescription, setImageDescription] = useState('')
  const [imageTags, setImageTags] = useState<string[]>([])
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const linkDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Drag-to-dismiss logic
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const sheet = sheetRef.current
    if (!sheet) return
    const rect = sheet.getBoundingClientRect()
    const touchY = e.touches[0].clientY
    if (touchY - rect.top < 48) {
      setIsDragging(true)
      setDragY(0)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaY = e.touches[0].clientY - (e as any)._startY || 0
    setDragY(Math.max(0, deltaY))
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragY > 100) {
      handleClose()
    }
    setDragY(0)
  }, [isDragging, dragY])

  const resetForm = useCallback(() => {
    setTextContent('')
    setIsRecording(false)
    setVoiceTranscript('')
    setVoiceSummary('')
    setIsTranscribing(false)
    setLinkUrl('')
    setLinkPreview(false)
    setIsProcessingLink(false)
    setImagePreview(null)
    setImageBase64(null)
    setImageDescription('')
    setImageTags([])
    setIsAnalyzingImage(false)
    setIsSaving(false)
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

  // Generate AI tags based on content — with caching
  const generateTags = useCallback(async (
    content: string,
    type: string,
    summary?: string,
    imgDescription?: string,
  ): Promise<string[]> => {
    if (!content.trim()) {
      return getSmartFallbackTags(content, type)
    }

    const cached = getCachedTags(content, type)
    if (cached) {
      return cached
    }

    if (!autoTagging) {
      return getSmartFallbackTags(content, type)
    }

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
        title = voiceTranscript
          ? voiceTranscript.slice(0, 50)
          : 'Voice memo'
        content = voiceTranscript || 'Recorded voice memo'
        fallbackTags = getSmartFallbackTags(content, 'voice')
        if (voiceSummary) {
          aiSummary = voiceSummary
        }
        break

      case 'link':
        title = linkUrl ? `Saved link` : 'Bookmark'
        content = linkUrl || 'Saved bookmark'
        fallbackTags = getSmartFallbackTags(content, 'link')
        break

      case 'image':
        if (imageDescription && imageTags.length > 0) {
          title = imageDescription.slice(0, 50) || 'Image capture'
          content = imageDescription
          fallbackTags = imageTags
        } else if (imageDescription) {
          title = imageDescription.slice(0, 50) || 'Image capture'
          content = imageDescription
          fallbackTags = getSmartFallbackTags(content, 'image')
        } else {
          title = 'Image capture'
          content = 'Captured image'
          fallbackTags = getSmartFallbackTags(content, 'image')
        }
        if (imageDescription) {
          aiSummary = `AI detected: ${imageDescription}`
        }
        break
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
      ...(activeCaptureTab === 'link' && linkUrl ? { source: linkUrl } : {}),
      ...(activeCaptureTab === 'image' && imagePreview ? { imagePreview } : {}),
    })

    setIsSaving(false)
    setCaptureModalOpen(false)
    resetForm()

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
      } catch {
        // Offline save to IndexedDB failed — memory is still in the store
      }
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
        ...(savedMemory.aiSummary ? { aiSummary: savedMemory.aiSummary } : {}),
        ...(savedMemory.source ? { source: savedMemory.source } : {}),
      })
    } catch (error: any) {
      clearTimeout(taggingTimeout)

      if (error?.message?.toLowerCase().includes('limit') || error?.message?.toLowerCase().includes('quota')) {
        updateMemory(tempId, { taggingStatus: 'complete' })
        setShowUpgradeDialog(true)
      } else {
        try {
          const aiTags = await generateTags(content, activeCaptureTab, voiceSummary || undefined, imageDescription || undefined)
          updateMemory(tempId, { tags: aiTags, taggingStatus: 'complete' })
        } catch {
          updateMemory(tempId, { taggingStatus: 'complete' })
        }
      }
    }
  }, [activeCaptureTab, textContent, voiceTranscript, voiceSummary, linkUrl, imagePreview, imageDescription, imageTags, generateTags, addMemory, updateMemory, setCaptureModalOpen, resetForm, user])

  // Handle image file selection
  const handleImageUpload = useCallback(async (file: File) => {
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

          if (data.description) {
            setImageDescription(data.description)
          }
          if (data.tags && data.tags.length > 0) {
            setImageTags(data.tags)
          }
        } catch (error) {
          console.error('Image analysis failed:', error)
          setImageDescription('')
          setImageTags([])
        } finally {
          setIsAnalyzingImage(false)
        }
      }
    }
    reader.readAsDataURL(file)
  }, [])

  // Start voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })

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
              if (data.transcription) {
                setVoiceTranscript(data.transcription)
              } else {
                setVoiceTranscript('Voice memo recorded — transcription will be available shortly.')
              }
              if (data.summary) {
                setVoiceSummary(data.summary)
              }
            } catch {
              setVoiceTranscript('Voice memo recorded — transcription will be available shortly.')
            } finally {
              setIsTranscribing(false)
            }
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
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    setIsRecording(false)
  }, [mediaRecorder])

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setLinkUrl(text)
        setLinkPreview(text.length > 5)
      }
    } catch {
      // Clipboard API not available or permission denied
    }
  }, [])

  // Debounced link processing
  const handleLinkUrlChange = useCallback((value: string) => {
    setLinkUrl(value)
    setLinkPreview(value.length > 5)

    if (linkDebounceRef.current) {
      clearTimeout(linkDebounceRef.current)
    }

    if (value.length > 5) {
      linkDebounceRef.current = setTimeout(() => {
        setIsProcessingLink(true)
        setTimeout(() => {
          setIsProcessingLink(false)
        }, 1500)
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

  // Shared deep-space modal styling
  const modalBg = 'rgba(15, 15, 26, 0.98)'
  const modalBorder = 'rgba(157,139,167,0.12)'
  const inputBg = 'rgba(7, 7, 15, 0.8)'
  const inputBorder = 'rgba(157,139,167,0.1)'

  // ---- Mobile Bottom Sheet ----
  if (isMobile) {
    return (
      <>
        {/* Upgrade Dialog */}
        <AnimatePresence>
          {showUpgradeDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowUpgradeDialog(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="rounded-3xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl"
                style={{
                  background: modalBg,
                  border: `1px solid ${modalBorder}`,
                  backdropFilter: 'blur(20px)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-1 bg-gradient-to-r from-[#9D8BA7] to-[#c084fc]" />
                <div className="p-6 text-center">
                  <div className="mx-auto size-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(157,139,167,0.1)' }}>
                    <Sparkles className="size-8" style={{ color: '#9D8BA7' }} />
                  </div>
                  <h3 className="font-serif text-xl font-semibold mb-2" style={{ color: '#f0f0f8' }}>
                    You&apos;ve reached your Seed plan limit
                  </h3>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(240,240,248,0.45)' }}>
                    50 memories saved! Upgrade to <span className="font-semibold" style={{ color: '#9D8BA7' }}>Bloom</span> for unlimited memories, advanced AI insights, and more.
                  </p>
                  <button
                    className="w-full text-white rounded-xl h-11 text-sm font-semibold transition-all duration-300 mb-3 min-h-[44px]"
                    style={{
                      background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
                      boxShadow: '0 4px 20px rgba(157,139,167,0.3)',
                    }}
                    onClick={() => setShowUpgradeDialog(false)}
                  >
                    Upgrade to Bloom
                  </button>
                  <button
                    className="w-full text-sm transition-colors py-2 min-h-[44px]"
                    style={{ color: 'rgba(240,240,248,0.45)' }}
                    onClick={() => setShowUpgradeDialog(false)}
                  >
                    Not now
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Bottom Sheet */}
        <motion.div
          ref={sheetRef}
          initial={{ y: '100%' }}
          animate={{ y: isDragging ? dragY : 0, opacity: 1 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl h-[85dvh] flex flex-col shadow-2xl"
          style={{
            background: modalBg,
            border: `1px solid ${modalBorder}`,
            borderBottom: 'none',
            backdropFilter: 'blur(20px)',
          }}
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
            if (dragY > 100) {
              handleClose()
            }
            setDragY(0)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2 shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(157,139,167,0.2)' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-2 shrink-0">
            <h2 className="font-serif text-lg font-semibold" style={{ color: '#f0f0f8' }}>
              Quick Capture
            </h2>
            <button
              onClick={handleClose}
              className="size-9 flex items-center justify-center rounded-full transition-colors min-w-[44px] min-h-[44px]"
              style={{ color: 'rgba(240,240,248,0.45)' }}
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pb-3 shrink-0">
            {captureTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveCaptureTab(tab.key)}
                className="tap-feedback flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-full transition-all duration-200 active:scale-[0.96] min-h-[44px]"
                style={
                  activeCaptureTab === tab.key
                    ? {
                        background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
                        color: '#fff',
                      }
                    : {
                        background: 'rgba(157,139,167,0.06)',
                        color: 'rgba(240,240,248,0.45)',
                        border: '1px solid rgba(157,139,167,0.08)',
                      }
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto ios-scroll px-4 pb-4 min-h-0">
            {/* Text */}
            {activeCaptureTab === 'text' && (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full min-h-[200px] resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition-shadow"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: '#f0f0f8',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2), 0 0 0 2px rgba(157,139,167,0.15)' }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
              />
            )}

            {/* Voice */}
            {activeCaptureTab === 'voice' && (
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-red-500/30 animate-pulse-ring" />
                  )}
                  <button
                    onClick={() => {
                      if (!isRecording) {
                        startRecording()
                      } else {
                        stopRecording()
                      }
                    }}
                    className={`relative size-16 rounded-full flex items-center justify-center transition-all duration-300 min-w-[64px] min-h-[64px] ${
                      isRecording
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : ''
                    }`}
                    style={
                      !isRecording
                        ? {
                            background: 'rgba(157,139,167,0.1)',
                            color: '#9D8BA7',
                          }
                        : undefined
                    }
                  >
                    <Mic className="size-7" />
                  </button>
                </div>

                {isRecording && (
                  <p className="text-sm text-red-400 mt-3 font-medium">
                    Recording... tap to stop
                  </p>
                )}

                {!isRecording && !voiceTranscript && !isTranscribing && (
                  <p className="text-sm mt-3" style={{ color: 'rgba(240,240,248,0.45)' }}>
                    Tap to start recording
                  </p>
                )}

                {isTranscribing && !isRecording && (
                  <div className="mt-4 w-full">
                    <div
                      className="rounded-xl p-3 flex items-center gap-2"
                      style={{
                        background: 'rgba(157,139,167,0.05)',
                        border: '1px solid rgba(157,139,167,0.15)',
                      }}
                    >
                      <Loader2 className="size-4 animate-spin" style={{ color: '#9D8BA7' }} />
                      <p className="text-sm font-medium" style={{ color: '#9D8BA7' }}>Transcribing your voice...</p>
                    </div>
                  </div>
                )}

                {voiceTranscript && !isRecording && (
                  <div className="mt-4 w-full space-y-2">
                    <div
                      className="rounded-xl p-3"
                      style={{
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                      }}
                    >
                      <p className="text-xs mb-1" style={{ color: 'rgba(240,240,248,0.35)' }}>Transcription</p>
                      <p className="text-sm leading-relaxed" style={{ color: '#f0f0f8' }}>
                        {voiceTranscript}
                      </p>
                    </div>
                    {voiceSummary && (
                      <div
                        className="rounded-xl p-3"
                        style={{
                          background: 'rgba(157,139,167,0.05)',
                          border: '1px solid rgba(157,139,167,0.15)',
                        }}
                      >
                        <p className="text-xs font-medium mb-1" style={{ color: '#9D8BA7' }}>AI Summary</p>
                        <p className="text-sm leading-relaxed" style={{ color: '#f0f0f8' }}>
                          {voiceSummary}
                        </p>
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
                    onChange={(e) => {
                      handleLinkUrlChange(e.target.value)
                    }}
                    placeholder="Paste any link..."
                    className="w-full rounded-xl px-4 py-3 pr-14 text-sm focus:outline-none transition-shadow min-h-[44px]"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: '#f0f0f8',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2), 0 0 0 2px rgba(157,139,167,0.15)' }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-colors min-h-[36px]"
                    style={{
                      color: '#9D8BA7',
                      background: 'rgba(157,139,167,0.1)',
                      border: '1px solid rgba(157,139,167,0.1)',
                    }}
                  >
                    <ClipboardPaste className="size-3.5" />
                    <span>Paste</span>
                  </button>
                </div>

                {isProcessingLink && (
                  <div
                    className="mt-2 rounded-xl p-2.5 flex items-center gap-2"
                    style={{
                      background: 'rgba(157,139,167,0.05)',
                      border: '1px solid rgba(157,139,167,0.15)',
                    }}
                  >
                    <Loader2 className="size-3.5 animate-spin" style={{ color: '#9D8BA7' }} />
                    <p className="text-xs" style={{ color: '#9D8BA7' }}>Processing link...</p>
                  </div>
                )}

                {linkPreview && linkUrl.length > 5 && (
                  <div
                    className="mt-3 rounded-xl p-3 flex gap-3"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                    }}
                  >
                    <div className="size-14 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(103,232,249,0.08)' }}>
                      <Link2 className="size-5" style={{ color: '#67e8f9' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#f0f0f8' }}>
                        Article Preview
                      </p>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(240,240,248,0.45)' }}>
                        A preview of the content from the link you saved. The full
                        article will be summarized and tagged automatically.
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
                    <label
                      className="tap-feedback w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl cursor-pointer transition-colors active:scale-[0.98]"
                      style={{
                        border: '2px dashed rgba(157,139,167,0.15)',
                        background: inputBg,
                      }}
                    >
                      <Upload className="size-5" style={{ color: 'rgba(157,139,167,0.7)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#f0f0f8' }}>Choose from Gallery</p>
                        <p className="text-xs" style={{ color: 'rgba(240,240,248,0.35)' }}>Select a photo from your library</p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleImageUpload(file)
                          }
                        }}
                      />
                    </label>
                    <label
                      className="tap-feedback w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl cursor-pointer transition-colors active:scale-[0.98]"
                      style={{
                        background: 'rgba(157,139,167,0.08)',
                        border: '1px solid rgba(157,139,167,0.15)',
                      }}
                    >
                      <Camera className="size-5" style={{ color: '#9D8BA7' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#9D8BA7' }}>Take a Photo</p>
                        <p className="text-xs" style={{ color: 'rgba(157,139,167,0.6)' }}>Open camera to capture</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleImageUpload(file)
                          }
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Uploaded image preview"
                      className="w-full rounded-xl object-cover max-h-[300px]"
                    />
                    <button
                      onClick={() => {
                        setImagePreview(null)
                        setImageBase64(null)
                        setImageDescription('')
                        setImageTags([])
                      }}
                      className="absolute top-2 right-2 size-8 rounded-full flex items-center justify-center transition-colors min-w-[36px] min-h-[36px]"
                      style={{
                        background: 'rgba(15,15,26,0.8)',
                        color: 'rgba(240,240,248,0.6)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <X className="size-4" />
                    </button>

                    {isAnalyzingImage && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                        <Loader2 className="size-6 text-white animate-spin" />
                        <p className="text-xs text-white font-medium">Analyzing image...</p>
                      </div>
                    )}

                    {!isAnalyzingImage && imageDescription && (
                      <div
                        className="mt-2 rounded-xl p-3"
                        style={{
                          background: 'rgba(157,139,167,0.05)',
                          border: '1px solid rgba(157,139,167,0.15)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Eye className="size-3.5" style={{ color: '#9D8BA7' }} />
                          <p className="text-xs font-medium" style={{ color: '#9D8BA7' }}>AI Analysis</p>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: '#f0f0f8' }}>
                          {imageDescription}
                        </p>
                        {imageTags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {imageTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{
                                  background: 'rgba(157,139,167,0.08)',
                                  color: '#c084fc',
                                  border: '1px solid rgba(157,139,167,0.15)',
                                }}
                              >
                                {tag}
                              </span>
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

          {/* Save button */}
          <div className="shrink-0 px-4 pb-5 pt-2" style={{ borderTop: '1px solid rgba(157,139,167,0.08)', background: modalBg }}>
            <Button
              onClick={handleSave}
              disabled={isSaving || isAnalyzingImage}
              className="w-full text-white rounded-xl min-h-[48px] text-sm font-medium transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
                boxShadow: '0 4px 20px rgba(157,139,167,0.25)',
              }}
            >
              {isSaving || isAnalyzingImage ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {isAnalyzingImage ? 'Analyzing image...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-1" />
                  Save Memory
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </>
    )
  }

  // ---- Desktop Centered Modal ----
  return (
    <>
      {/* Upgrade Dialog */}
      <AnimatePresence>
        {showUpgradeDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowUpgradeDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="rounded-3xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl"
              style={{
                background: modalBg,
                border: `1px solid ${modalBorder}`,
                backdropFilter: 'blur(20px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 bg-gradient-to-r from-[#9D8BA7] to-[#c084fc]" />
              <div className="p-6 text-center">
                <div className="mx-auto size-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(157,139,167,0.1)' }}>
                  <Sparkles className="size-8" style={{ color: '#9D8BA7' }} />
                </div>
                <h3 className="font-serif text-xl font-semibold mb-2" style={{ color: '#f0f0f8' }}>
                  You&apos;ve reached your Seed plan limit
                </h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(240,240,248,0.45)' }}>
                  50 memories saved! Upgrade to <span className="font-semibold" style={{ color: '#9D8BA7' }}>Bloom</span> for unlimited memories, advanced AI insights, and more.
                </p>
                <button
                  className="w-full text-white rounded-xl h-11 text-sm font-semibold transition-all duration-300 mb-3"
                  style={{
                    background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
                    boxShadow: '0 4px 20px rgba(157,139,167,0.3)',
                  }}
                  onClick={() => setShowUpgradeDialog(false)}
                >
                  Upgrade to Bloom
                </button>
                <button
                  className="w-full text-sm transition-colors py-2"
                  style={{ color: 'rgba(240,240,248,0.45)' }}
                  onClick={() => setShowUpgradeDialog(false)}
                >
                  Not now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture Modal — Desktop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className="rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-xl"
          style={{
            background: modalBg,
            border: `1px solid ${modalBorder}`,
            backdropFilter: 'blur(20px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-2">
            <h2 className="font-serif text-lg font-semibold" style={{ color: '#f0f0f8' }}>
              Quick Capture
            </h2>
            <button
              onClick={handleClose}
              className="size-8 flex items-center justify-center rounded-full transition-colors"
              style={{ color: 'rgba(240,240,248,0.45)' }}
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 pb-3">
            {captureTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveCaptureTab(tab.key)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-all duration-200"
                style={
                  activeCaptureTab === tab.key
                    ? {
                        background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
                        color: '#fff',
                      }
                    : {
                        background: 'rgba(157,139,167,0.06)',
                        color: 'rgba(240,240,248,0.45)',
                        border: '1px solid rgba(157,139,167,0.08)',
                      }
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-4 pb-4 min-h-[220px]">
            {/* Text */}
            {activeCaptureTab === 'text' && (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full h-36 resize-none rounded-xl px-4 py-3 text-sm focus:outline-none transition-shadow"
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: '#f0f0f8',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2), 0 0 0 2px rgba(157,139,167,0.15)' }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
              />
            )}

            {/* Voice */}
            {activeCaptureTab === 'voice' && (
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  {isRecording && (
                    <div className="absolute inset-0 rounded-full bg-red-500/30 animate-pulse-ring" />
                  )}
                  <button
                    onClick={() => {
                      if (!isRecording) {
                        startRecording()
                      } else {
                        stopRecording()
                      }
                    }}
                    className={`relative size-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isRecording
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                        : ''
                    }`}
                    style={
                      !isRecording
                        ? {
                            background: 'rgba(157,139,167,0.1)',
                            color: '#9D8BA7',
                          }
                        : undefined
                    }
                  >
                    <Mic className="size-7" />
                  </button>
                </div>

                {isRecording && (
                  <p className="text-sm text-red-400 mt-3 font-medium">
                    Recording... click to stop
                  </p>
                )}

                {!isRecording && !voiceTranscript && !isTranscribing && (
                  <p className="text-sm mt-3" style={{ color: 'rgba(240,240,248,0.45)' }}>
                    Click to start recording
                  </p>
                )}

                {isTranscribing && !isRecording && (
                  <div className="mt-4 w-full">
                    <div
                      className="rounded-xl p-3 flex items-center gap-2"
                      style={{
                        background: 'rgba(157,139,167,0.05)',
                        border: '1px solid rgba(157,139,167,0.15)',
                      }}
                    >
                      <Loader2 className="size-4 animate-spin" style={{ color: '#9D8BA7' }} />
                      <p className="text-sm font-medium" style={{ color: '#9D8BA7' }}>Transcribing your voice...</p>
                    </div>
                  </div>
                )}

                {voiceTranscript && !isRecording && (
                  <div className="mt-4 w-full space-y-2">
                    <div
                      className="rounded-xl p-3"
                      style={{
                        background: inputBg,
                        border: `1px solid ${inputBorder}`,
                      }}
                    >
                      <p className="text-xs mb-1" style={{ color: 'rgba(240,240,248,0.35)' }}>Transcription</p>
                      <p className="text-sm leading-relaxed" style={{ color: '#f0f0f8' }}>
                        {voiceTranscript}
                      </p>
                    </div>
                    {voiceSummary && (
                      <div
                        className="rounded-xl p-3"
                        style={{
                          background: 'rgba(157,139,167,0.05)',
                          border: '1px solid rgba(157,139,167,0.15)',
                        }}
                      >
                        <p className="text-xs font-medium mb-1" style={{ color: '#9D8BA7' }}>AI Summary</p>
                        <p className="text-sm leading-relaxed" style={{ color: '#f0f0f8' }}>
                          {voiceSummary}
                        </p>
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
                    onChange={(e) => {
                      handleLinkUrlChange(e.target.value)
                    }}
                    placeholder="Paste any link..."
                    className="w-full rounded-xl px-4 py-3 pr-14 text-sm focus:outline-none transition-shadow"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: '#f0f0f8',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2), 0 0 0 2px rgba(157,139,167,0.15)' }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 transition-colors"
                    style={{
                      color: '#9D8BA7',
                      background: 'rgba(157,139,167,0.1)',
                      border: '1px solid rgba(157,139,167,0.1)',
                    }}
                  >
                    <ClipboardPaste className="size-3.5" />
                    <span>Paste</span>
                  </button>
                </div>

                {isProcessingLink && (
                  <div
                    className="mt-2 rounded-xl p-2.5 flex items-center gap-2"
                    style={{
                      background: 'rgba(157,139,167,0.05)',
                      border: '1px solid rgba(157,139,167,0.15)',
                    }}
                  >
                    <Loader2 className="size-3.5 animate-spin" style={{ color: '#9D8BA7' }} />
                    <p className="text-xs" style={{ color: '#9D8BA7' }}>Processing link...</p>
                  </div>
                )}

                {linkPreview && linkUrl.length > 5 && (
                  <div
                    className="mt-3 rounded-xl p-3 flex gap-3"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                    }}
                  >
                    <div className="size-14 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(103,232,249,0.08)' }}>
                      <Link2 className="size-5" style={{ color: '#67e8f9' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#f0f0f8' }}>
                        Article Preview
                      </p>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(240,240,248,0.45)' }}>
                        A preview of the content from the link you saved. The full
                        article will be summarized and tagged automatically.
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
                  <label
                    className="flex flex-col items-center justify-center h-36 rounded-xl cursor-pointer transition-colors"
                    style={{
                      border: '2px dashed rgba(157,139,167,0.15)',
                      background: inputBg,
                    }}
                  >
                    <Upload className="size-8 mb-2" style={{ color: 'rgba(157,139,167,0.5)' }} />
                    <p className="text-sm" style={{ color: 'rgba(240,240,248,0.45)' }}>
                      Drop an image or click to upload
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleImageUpload(file)
                        }
                      }}
                    />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={imagePreview}
                      alt="Uploaded image preview"
                      className="w-full h-36 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => {
                        setImagePreview(null)
                        setImageBase64(null)
                        setImageDescription('')
                        setImageTags([])
                      }}
                      className="absolute top-2 right-2 size-6 rounded-full flex items-center justify-center transition-colors"
                      style={{
                        background: 'rgba(15,15,26,0.8)',
                        color: 'rgba(240,240,248,0.6)',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <X className="size-3" />
                    </button>

                    {isAnalyzingImage && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                        <Loader2 className="size-6 text-white animate-spin" />
                        <p className="text-xs text-white font-medium">Analyzing image...</p>
                      </div>
                    )}

                    {!isAnalyzingImage && imageDescription && (
                      <div
                        className="mt-2 rounded-xl p-3"
                        style={{
                          background: 'rgba(157,139,167,0.05)',
                          border: '1px solid rgba(157,139,167,0.15)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Eye className="size-3.5" style={{ color: '#9D8BA7' }} />
                          <p className="text-xs font-medium" style={{ color: '#9D8BA7' }}>AI Analysis</p>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: '#f0f0f8' }}>
                          {imageDescription}
                        </p>
                        {imageTags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {imageTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-2 py-0.5 rounded-full"
                                style={{
                                  background: 'rgba(157,139,167,0.08)',
                                  color: '#c084fc',
                                  border: '1px solid rgba(157,139,167,0.15)',
                                }}
                              >
                                {tag}
                              </span>
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

          {/* Save button */}
          <div className="px-4 pb-5">
            <Button
              onClick={handleSave}
              disabled={isSaving || isAnalyzingImage}
              className="w-full text-white rounded-xl h-11 text-sm font-medium transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #9D8BA7, #c084fc)',
                boxShadow: '0 4px 20px rgba(157,139,167,0.25)',
              }}
            >
              {isSaving || isAnalyzingImage ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {isAnalyzingImage ? 'Analyzing image...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-1" />
                  Save Memory
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------- Smart fallback tags based on content keywords ----------

function getSmartFallbackTags(content: string, type: string): string[] {
  const lower = content.toLowerCase()
  const tags: string[] = []

  const topicMap: Record<string, string[]> = {
    cafe: ['#cafe', '#food'],
    coffee: ['#coffee', '#food'],
    restaurant: ['#restaurant', '#food'],
    lunch: ['#food', '#lunch'],
    dinner: ['#food', '#dinner'],
    breakfast: ['#food', '#breakfast'],
    meeting: ['#meeting', '#work'],
    project: ['#project', '#work'],
    code: ['#code', '#programming'],
    programming: ['#programming', '#tech'],
    book: ['#books', '#reading'],
    recipe: ['#recipe', '#food', '#cooking'],
    travel: ['#travel'],
    trip: ['#travel'],
    idea: ['#idea', '#creativity'],
    workout: ['#fitness', '#health'],
    gym: ['#fitness', '#health'],
    movie: ['#movies', '#entertainment'],
    music: ['#music'],
    shopping: ['#shopping'],
    budget: ['#finance', '#budgeting'],
    money: ['#finance'],
    doctor: ['#health', '#medical'],
    family: ['#family'],
    friend: ['#social', '#friends'],
    party: ['#social', '#events'],
    school: ['#education', '#learning'],
    study: ['#education', '#study'],
    design: ['#design', '#creative'],
    ai: ['#ai', '#technology'],
    startup: ['#startup', '#business'],
    product: ['#product', '#business'],
  }

  for (const [keyword, tagList] of Object.entries(topicMap)) {
    if (lower.includes(keyword) && tags.length < 4) {
      for (const tag of tagList) {
        if (!tags.includes(tag) && tags.length < 4) {
          tags.push(tag)
        }
      }
    }
  }

  if (tags.length === 0) {
    switch (type) {
      case 'voice':
        return ['#spoken', '#memo']
      case 'link':
        return ['#bookmark', '#saved']
      case 'image':
        return ['#visual', '#capture']
      default:
        return ['#memory']
    }
  }

  return tags
}

// ---------- main Dashboard ----------

export default function Dashboard() {
  const { memories, activeFilter, collectionFilter, setSelectedMemoryId, setCurrentView, collections, isLoadingMemories } = useAetherStore()
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  const activeCollection = useMemo(
    () => (collectionFilter ? collections.find((c) => c.id === collectionFilter) : null),
    [collectionFilter, collections]
  )

  // Extract actionable tasks from memory content
  const extractedTasks = useMemo(() => {
    const taskPatterns = [
      /(?:i\s+)?need\s+to\s+(.+?)(?:\.|$)/gi,
      /(?:i\s+)?should\s+(.+?)(?:\.|$)/gi,
      /(?:i\s+)?must\s+(.+?)(?:\.|$)/gi,
      /(?:i\s+)?have\s+to\s+(.+?)(?:\.|$)/gi,
      /todo:?\s*(.+?)(?:\.|$)/gi,
      /follow\s+up\s+(?:with\s+)?(.+?)(?:\.|$)/gi,
      /(?:don't\s+)?forget\s+(?:to\s+)?(.+?)(?:\.|$)/gi,
      /remind\s+me\s+(?:to\s+)?(.+?)(?:\.|$)/gi,
    ]
    const tasks: { id: string; text: string; memoryId: string; memoryTitle: string }[] = []

    for (const mem of memories) {
      const content = mem.content || ''
      for (const pattern of taskPatterns) {
        pattern.lastIndex = 0
        let match
        while ((match = pattern.exec(content)) !== null && tasks.length < 8) {
          const text = match[1].trim()
          if (text.length >= 5) {
            const id = `task-${mem.id}-${tasks.length}`
            if (!tasks.some(t => t.text.toLowerCase() === text.toLowerCase())) {
              tasks.push({
                id,
                text: text.charAt(0).toUpperCase() + text.slice(1),
                memoryId: mem.id,
                memoryTitle: mem.title,
              })
            }
          }
        }
      }
    }
    return tasks
  }, [memories])

  const toggleTask = useCallback((taskId: string) => {
    setCompletedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  // Filter and sort memories (memoized)
  const sortedMemories = useMemo(() => {
    const filterType = FILTER_MAP[activeFilter]
    let filtered = filterType
      ? memories.filter((m) => m.type === filterType)
      : memories

    if (collectionFilter) {
      filtered = filtered.filter((m) => m.collectionId === collectionFilter)
    }

    return [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [memories, activeFilter, collectionFilter])

  const handleMemoryClick = useCallback((id: string) => {
    setSelectedMemoryId(id)
    setCurrentView('memory-detail')
  }, [setSelectedMemoryId, setCurrentView])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Filter Bar — horizontally scrollable on mobile */}
      <div className="shrink-0 pb-2 px-4 sm:px-6">
        <FilterBar />
      </div>

      {/* Stats Bar */}
      <div className="shrink-0 px-4 sm:px-6 pb-3">
        <StatsBar />
      </div>

      {/* Extracted Tasks Section */}
      {extractedTasks.length > 0 && (
        <div className="shrink-0 mb-4 px-4 sm:px-6">
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'rgba(15, 15, 26, 0.8)',
              border: '1px solid rgba(157,139,167,0.1)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderTop: '1px solid rgba(157,139,167,0.2)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="size-4" style={{ color: '#9D8BA7' }} />
              <h3 className="text-sm font-semibold" style={{ color: '#f0f0f8' }}>Extracted Tasks</h3>
              <span className="text-xs ml-auto font-mono" style={{ color: 'rgba(240,240,248,0.35)' }}>
                {completedTasks.size}/{extractedTasks.length} done
              </span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto ios-scroll">
              {extractedTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className="tap-feedback w-full flex items-start gap-2.5 text-left py-2 active:scale-[0.98] transition-transform"
                >
                  {completedTasks.has(task.id) ? (
                    <CheckSquare className="size-5 shrink-0 mt-0.5" style={{ color: '#9D8BA7' }} />
                  ) : (
                    <Square className="size-5 shrink-0 mt-0.5" style={{ color: 'rgba(240,240,248,0.3)' }} />
                  )}
                  <div className="min-w-0">
                    <p
                      className="text-sm leading-relaxed transition-colors"
                      style={{
                        color: completedTasks.has(task.id) ? 'rgba(240,240,248,0.35)' : '#f0f0f8',
                        textDecoration: completedTasks.has(task.id) ? 'line-through' : 'none',
                      }}
                    >
                      {task.text}
                    </p>
                    <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'rgba(240,240,248,0.3)' }}>
                      from: {task.memoryTitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Memory Feed */}
      <div className="flex-1 overflow-y-auto min-h-0 ios-scroll px-4 sm:px-6 pb-20 md:pb-6">
        {isLoadingMemories ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(15, 15, 26, 0.8)',
                  border: '1px solid rgba(157,139,167,0.1)',
                  borderTop: '1px solid rgba(157,139,167,0.2)',
                }}
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="size-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-1.5">
                        <Skeleton className="h-4 w-12 rounded-full" />
                        <Skeleton className="h-4 w-12 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedMemories.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sortedMemories.map((memory, index) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onClick={() => handleMemoryClick(memory.id)}
                index={index}
              />
            ))}
          </div>
        ) : (
          <EmptyState collectionName={activeCollection?.name} />
        )}
      </div>

      {/* Quick Capture Modal */}
      <QuickCaptureModal />
    </div>
  )
}
