'use client'

import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, FileText, Link2, ImageIcon, X, Upload, Plus, Brain, ArrowLeft, FolderOpen, Loader2, Eye, Sparkles, ClipboardPaste, CheckSquare, Square, Camera } from 'lucide-react'
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

function typeIcon(type: MemoryType) {
  switch (type) {
    case 'voice':
      return <Mic className="size-4 text-[#9D8BA7]" />
    case 'link':
      return <Link2 className="size-4 text-[#9D8BA7]" />
    case 'image':
      return <ImageIcon className="size-4 text-[#9D8BA7]" />
    default:
      return <FileText className="size-4 text-[#9D8BA7]" />
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

// ---------- sub-components (memoized) ----------

const MemoryCard = memo(function MemoryCard({ memory, onClick }: { memory: Memory; onClick: () => void }) {
  const isTagging = memory.taggingStatus === 'tagging' || memory.taggingStatus === 'pending'
  const isSyncing = memory.syncStatus === 'pending' || memory.syncStatus === 'syncing'

  return (
    <button
      onClick={onClick}
      className="tap-feedback card-contain w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border transition-all duration-200 hover:-translate-y-0 md:hover:-translate-y-0.5 hover:shadow-lg cursor-pointer group active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center size-9 rounded-xl bg-[#9D8BA7]/10 shrink-0 mt-0.5">
          {typeIcon(memory.type)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-foreground text-sm leading-snug truncate group-hover:text-[#9D8BA7] transition-colors">
            {memory.title}
          </h3>
          <p className="text-muted-foreground text-xs mt-1 line-clamp-2 leading-relaxed overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {memory.content}
          </p>
          <div className="flex items-center justify-between mt-3 gap-2">
            <div className="flex items-center gap-1.5 overflow-hidden">
              {memory.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={tag}
                  className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-all duration-500 ${
                    isTagging
                      ? 'bg-[#9D8BA7]/5 text-[#9D8BA7]/40 animate-pulse'
                      : 'bg-[#9D8BA7]/10 text-[#9D8BA7]'
                  }`}
                  style={isTagging ? { animationDelay: `${i * 200}ms` } : undefined}
                >
                  {tag}
                </span>
              ))}
              {/* Sync indicator for offline-captured memories */}
              {isSyncing && !isTagging && (
                <span className="inline-flex items-center gap-1 text-[9px] text-amber-600/70 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400/40 opacity-75" />
                    <span className="relative inline-flex rounded-full size-1.5 bg-amber-500/70" />
                  </span>
                  Syncing...
                </span>
              )}
              {/* Aether is thinking indicator */}
              {isTagging && (
                <span className="inline-flex items-center gap-1 text-[9px] text-[#9D8BA7]/60 bg-[#9D8BA7]/5 px-2 py-0.5 rounded-full whitespace-nowrap">
                  <span className="relative flex size-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9D8BA7]/40 opacity-75" />
                    <span className="relative inline-flex rounded-full size-1.5 bg-[#9D8BA7]/60" />
                  </span>
                  Aether is thinking...
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
              {formatDate(memory.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
})

const EmptyState = memo(function EmptyState({ collectionName }: { collectionName?: string }) {
  const { setCaptureModalOpen } = useAetherStore()

  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-4 sm:px-6 text-center">
      {/* Animated brain icon with pulse ring */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-[#9D8BA7]/20 animate-ping opacity-20" />
        <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-[#9D8BA7]/15 to-[#9D8BA7]/5 flex items-center justify-center ring-4 ring-[#9D8BA7]/10">
          {collectionName ? (
            <FolderOpen className="size-9 text-[#9D8BA7]" />
          ) : (
            <Brain className="size-9 text-[#9D8BA7]" />
          )}
        </div>
      </div>

      <h3 className="font-serif text-xl font-semibold text-foreground">
        {collectionName
          ? `No memories in ${collectionName} yet`
          : 'Your second brain is empty'}
      </h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
        {collectionName
          ? `Start capturing memories to this collection and they'll appear here.`
          : 'Start capturing your first memory — ideas, notes, links, anything you want to remember.'}
      </p>

      {/* Prominent CTA button for new users */}
      {!collectionName && (
        <button
          onClick={() => setCaptureModalOpen(true)}
          className="mt-6 inline-flex items-center gap-2 bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-xl px-6 py-3 text-sm font-semibold shadow-lg shadow-[#9D8BA7]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#9D8BA7]/30 hover:-translate-y-0.5 active:scale-[0.98] min-h-[44px]"
        >
          <Plus className="size-4" />
          Add Your First Memory
        </button>
      )}
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
          className="tap-feedback flex items-center gap-1.5 text-sm text-[#9D8BA7] hover:text-[#7A6B85] transition-colors font-medium active:scale-[0.98] min-h-[44px]"
        >
          <ArrowLeft className="size-4" />
          All memories
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 bg-[#9D8BA7]/10 text-[#9D8BA7] text-sm px-3 py-1.5 rounded-full font-medium">
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
              ? 'bg-[#9D8BA7] text-white shadow-sm'
              : 'bg-card text-muted-foreground hover:bg-muted border border-border'
          }`}
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
    // Only allow drag from the drag handle area (top 40px of sheet)
    const sheet = sheetRef.current
    if (!sheet) return
    const rect = sheet.getBoundingClientRect()
    const touchY = e.touches[0].clientY
    // Only start drag if touching near the top (drag handle area)
    if (touchY - rect.top < 48) {
      setIsDragging(true)
      setDragY(0)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaY = e.touches[0].clientY - (e as any)._startY || 0
    // Only allow dragging down
    setDragY(Math.max(0, deltaY))
  }, [isDragging])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    // Dismiss if dragged more than 100px down
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

  // Generate AI tags based on content (for text, voice, link) — with caching
  const generateTags = useCallback(async (
    content: string,
    type: string,
    summary?: string,
    imgDescription?: string,
  ): Promise<string[]> => {
    if (!content.trim()) {
      return getSmartFallbackTags(content, type)
    }

    // Check cache first
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
      // Cache the result
      setCachedTags(content, type, tags)
      return tags
    } catch {
      return getSmartFallbackTags(content, type)
    }
  }, [autoTagging])

  const handleSave = useCallback(async () => {
    // Don't save if no content for text/link tabs
    if (activeCaptureTab === 'text' && !textContent.trim()) return
    if (activeCaptureTab === 'link' && !linkUrl.trim()) return
    if (activeCaptureTab === 'voice' && !voiceTranscript && !isTranscribing) return
    setIsSaving(true)
    const tempId = `mem-${Date.now()}`
    let title = ''
    let content = ''
    let fallbackTags: string[] = []
    let aiSummary: string | undefined

    // Step 1: Compute title, content, and smart fallback tags IMMEDIATELY (no await)
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

    // Check if we're offline
    const isOffline = !navigator.onLine

    // Step 2: Add memory to store IMMEDIATELY with fallback tags + tagging status
    addMemory({
      id: tempId,
      type: activeCaptureTab,
      title,
      content,
      tags: fallbackTags,
      createdAt: new Date().toISOString(),
      taggingStatus: isOffline ? 'complete' : 'pending', // Skip AI tagging when offline
      syncStatus: isOffline ? 'pending' : 'synced', // Mark as pending sync when offline
      ...(aiSummary ? { aiSummary } : {}),
      ...(activeCaptureTab === 'link' && linkUrl ? { source: linkUrl } : {}),
      ...(activeCaptureTab === 'image' && imagePreview ? { imagePreview } : {}),
    })

    // Step 3: Close modal immediately so user sees their memory in the feed
    setIsSaving(false)
    setCaptureModalOpen(false)
    resetForm()

    // Step 4: After 2 seconds, upgrade to 'tagging' status (shows "Aether is thinking")
    const taggingTimeout = setTimeout(() => {
      updateMemory(tempId, { taggingStatus: 'tagging' })
    }, 2000)

    // Step 5: In the background — save to Supabase AND generate AI tags simultaneously
    // If offline, data.ts handles queueing — we just update the local state
    if (isOffline) {
      clearTimeout(taggingTimeout)
      // createMemory in data.ts will save to IndexedDB and queue for sync
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
      // Check free plan limit first
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
        // For image type with pre-existing tags, skip AI tagging
        activeCaptureTab === 'image' && imageTags.length > 0
          ? Promise.resolve(imageTags)
          : generateTags(content, activeCaptureTab, voiceSummary || undefined, imageDescription || undefined),
      ])

      clearTimeout(taggingTimeout)

      // Step 6: Update memory with real ID from Supabase and real AI tags
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
        // Still try to get AI tags even if Supabase save failed
        try {
          const aiTags = await generateTags(content, activeCaptureTab, voiceSummary || undefined, imageDescription || undefined)
          updateMemory(tempId, { tags: aiTags, taggingStatus: 'complete' })
        } catch {
          // Keep fallback tags
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

        // Start transcription IMMEDIATELY on stop — don't wait for save
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

  // Debounced link processing — start scraping/tagging as URL is typed
  const handleLinkUrlChange = useCallback((value: string) => {
    setLinkUrl(value)
    setLinkPreview(value.length > 5)

    // Clear previous debounce
    if (linkDebounceRef.current) {
      clearTimeout(linkDebounceRef.current)
    }

    // Debounce by 500ms — start early processing
    if (value.length > 5) {
      linkDebounceRef.current = setTimeout(() => {
        setIsProcessingLink(true)
        // Simulate early link processing (could call a link-preview API)
        // For now, just set the processing state briefly to show the indicator
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
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setShowUpgradeDialog(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="bg-card rounded-3xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl border border-[#9D8BA7]/20"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-1.5 bg-gradient-to-r from-[#9D8BA7] to-[#C4B5CE]" />
                <div className="p-6 text-center">
                  <div className="mx-auto size-16 rounded-2xl bg-[#9D8BA7]/10 flex items-center justify-center mb-4">
                    <Sparkles className="size-8 text-[#9D8BA7]" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                    You've reached your Seed plan limit
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                    50 memories saved! Upgrade to <span className="font-semibold text-[#9D8BA7]">Bloom</span> for unlimited memories, advanced AI insights, and more.
                  </p>
                  <button
                    className="w-full bg-[#9D8BA7] hover:bg-[#8A7A96] text-white rounded-xl h-11 text-sm font-semibold transition-colors mb-3 min-h-[44px]"
                    onClick={() => setShowUpgradeDialog(false)}
                  >
                    Upgrade to Bloom
                  </button>
                  <button
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 min-h-[44px]"
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
          className="fixed inset-0 z-50 bg-black/40"
          onClick={handleClose}
        />

        {/* Bottom Sheet */}
        <motion.div
          ref={sheetRef}
          initial={{ y: '100%' }}
          animate={{ y: isDragging ? dragY : 0, opacity: 1 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl h-[85dvh] flex flex-col shadow-2xl"
          style={{ transform: isDragging ? `translateY(${dragY}px)` : undefined }}
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
            <div className="w-10 h-1 rounded-full bg-muted" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-2 shrink-0">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Quick Capture
            </h2>
            <button
              onClick={handleClose}
              className="size-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground min-w-[44px] min-h-[44px]"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Tabs — touch-friendly with larger targets */}
          <div className="flex items-center gap-1 px-4 pb-3 shrink-0">
            {captureTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveCaptureTab(tab.key)}
                className={`tap-feedback flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-full transition-all duration-200 active:scale-[0.96] min-h-[44px] ${
                  activeCaptureTab === tab.key
                    ? 'bg-[#9D8BA7] text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content — scrollable, takes remaining space */}
          <div className="flex-1 overflow-y-auto ios-scroll px-4 pb-4 min-h-0">
            {/* Text */}
            {activeCaptureTab === 'text' && (
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full min-h-[200px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#9D8BA7]/30 transition-shadow"
              />
            )}

            {/* Voice */}
            {activeCaptureTab === 'voice' && (
              <div className="flex flex-col items-center py-4">
                <div className="relative">
                  {/* Pulsing ring animation when recording */}
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
                        ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                        : 'bg-[#9D8BA7]/10 text-[#9D8BA7] hover:bg-[#9D8BA7]/20'
                    }`}
                  >
                    <Mic className="size-7" />
                  </button>
                </div>

                {isRecording && (
                  <p className="text-sm text-red-500 mt-3 font-medium">
                    Recording... tap to stop
                  </p>
                )}

                {!isRecording && !voiceTranscript && !isTranscribing && (
                  <p className="text-sm text-muted-foreground mt-3">
                    Tap to start recording
                  </p>
                )}

                {/* Show transcribing state immediately after stop */}
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
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground mb-1">Transcription</p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {voiceTranscript}
                      </p>
                    </div>
                    {voiceSummary && (
                      <div className="rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-3">
                        <p className="text-xs text-[#9D8BA7] font-medium mb-1">AI Summary</p>
                        <p className="text-sm text-foreground leading-relaxed">
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
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#9D8BA7]/30 transition-shadow min-h-[44px]"
                  />
                  {/* Paste button */}
                  <button
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-[#9D8BA7] hover:text-[#7A6B85] bg-[#9D8BA7]/10 hover:bg-[#9D8BA7]/20 rounded-lg px-2.5 py-1.5 transition-colors min-h-[36px]"
                  >
                    <ClipboardPaste className="size-3.5" />
                    <span>Paste</span>
                  </button>
                </div>

                {/* Link processing indicator */}
                {isProcessingLink && (
                  <div className="mt-2 rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-2.5 flex items-center gap-2">
                    <Loader2 className="size-3.5 text-[#9D8BA7] animate-spin" />
                    <p className="text-xs text-[#9D8BA7]">Processing link...</p>
                  </div>
                )}

                {linkPreview && linkUrl.length > 5 && (
                  <div className="mt-3 rounded-xl border border-border bg-background p-3 flex gap-3">
                    <div className="size-14 rounded-lg bg-[#9D8BA7]/10 flex items-center justify-center shrink-0">
                      <Link2 className="size-5 text-[#9D8BA7]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        Article Preview
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
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
                    {/* Gallery button - opens native photo picker */}
                    <label className="tap-feedback w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl border-2 border-dashed border-border bg-background cursor-pointer hover:border-[#9D8BA7]/40 transition-colors active:scale-[0.98]">
                      <Upload className="size-5 text-[#9D8BA7]/70" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Choose from Gallery</p>
                        <p className="text-xs text-muted-foreground">Select a photo from your library</p>
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
                    {/* Camera button - opens camera directly */}
                    <label className="tap-feedback w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl bg-[#9D8BA7]/10 border border-[#9D8BA7]/20 cursor-pointer hover:bg-[#9D8BA7]/15 transition-colors active:scale-[0.98]">
                      <Camera className="size-5 text-[#9D8BA7]" />
                      <div>
                        <p className="text-sm font-medium text-[#9D8BA7]">Take a Photo</p>
                        <p className="text-xs text-[#9D8BA7]/60">Open camera to capture</p>
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
                    {/* Full width image preview */}
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
                      className="absolute top-2 right-2 size-8 rounded-full bg-card/80 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors min-w-[36px] min-h-[36px]"
                    >
                      <X className="size-4" />
                    </button>

                    {/* AI analysis overlay */}
                    {isAnalyzingImage && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 text-white animate-spin" />
                        <p className="text-xs text-white font-medium">Analyzing image...</p>
                      </div>
                    )}

                    {/* Show AI analysis results */}
                    {!isAnalyzingImage && imageDescription && (
                      <div className="mt-2 rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Eye className="size-3.5 text-[#9D8BA7]" />
                          <p className="text-xs text-[#9D8BA7] font-medium">AI Analysis</p>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {imageDescription}
                        </p>
                        {imageTags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {imageTags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-[#9D8BA7]/10 text-[#9D8BA7] text-[10px] px-2 py-0.5 rounded-full"
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

          {/* Save button — always visible, full width, min 48px */}
          <div className="shrink-0 px-4 pb-5 pt-2 border-t border-border/50 bg-card">
            <Button
              onClick={handleSave}
              disabled={isSaving || isAnalyzingImage}
              className="w-full bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-xl min-h-[48px] text-sm font-medium transition-colors"
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
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUpgradeDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-card rounded-3xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl border border-[#9D8BA7]/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1.5 bg-gradient-to-r from-[#9D8BA7] to-[#C4B5CE]" />
              <div className="p-6 text-center">
                <div className="mx-auto size-16 rounded-2xl bg-[#9D8BA7]/10 flex items-center justify-center mb-4">
                  <Sparkles className="size-8 text-[#9D8BA7]" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                  You've reached your Seed plan limit
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  50 memories saved! Upgrade to <span className="font-semibold text-[#9D8BA7]">Bloom</span> for unlimited memories, advanced AI insights, and more.
                </p>
                <button
                  className="w-full bg-[#9D8BA7] hover:bg-[#8A7A96] text-white rounded-xl h-11 text-sm font-semibold transition-colors mb-3"
                  onClick={() => setShowUpgradeDialog(false)}
                >
                  Upgrade to Bloom
                </button>
                <button
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      >
        <div
          className="bg-card rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-2">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Quick Capture
            </h2>
            <button
              onClick={handleClose}
              className="size-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
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
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-all duration-200 ${
                  activeCaptureTab === tab.key
                    ? 'bg-[#9D8BA7] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
                }`}
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
                className="w-full h-36 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#9D8BA7]/30 transition-shadow"
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
                        ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                        : 'bg-[#9D8BA7]/10 text-[#9D8BA7] hover:bg-[#9D8BA7]/20'
                    }`}
                  >
                    <Mic className="size-7" />
                  </button>
                </div>

                {isRecording && (
                  <p className="text-sm text-red-500 mt-3 font-medium">
                    Recording... click to stop
                  </p>
                )}

                {!isRecording && !voiceTranscript && !isTranscribing && (
                  <p className="text-sm text-muted-foreground mt-3">
                    Click to start recording
                  </p>
                )}

                {/* Show transcribing state immediately after stop */}
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
                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground mb-1">Transcription</p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {voiceTranscript}
                      </p>
                    </div>
                    {voiceSummary && (
                      <div className="rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-3">
                        <p className="text-xs text-[#9D8BA7] font-medium mb-1">AI Summary</p>
                        <p className="text-sm text-foreground leading-relaxed">
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
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#9D8BA7]/30 transition-shadow"
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-[#9D8BA7] hover:text-[#7A6B85] bg-[#9D8BA7]/10 hover:bg-[#9D8BA7]/20 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <ClipboardPaste className="size-3.5" />
                    <span>Paste</span>
                  </button>
                </div>

                {/* Link processing indicator */}
                {isProcessingLink && (
                  <div className="mt-2 rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-2.5 flex items-center gap-2">
                    <Loader2 className="size-3.5 text-[#9D8BA7] animate-spin" />
                    <p className="text-xs text-[#9D8BA7]">Processing link...</p>
                  </div>
                )}

                {linkPreview && linkUrl.length > 5 && (
                  <div className="mt-3 rounded-xl border border-border bg-background p-3 flex gap-3">
                    <div className="size-14 rounded-lg bg-[#9D8BA7]/10 flex items-center justify-center shrink-0">
                      <Link2 className="size-5 text-[#9D8BA7]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        Article Preview
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
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
                  <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-border bg-background cursor-pointer hover:border-[#9D8BA7]/40 transition-colors">
                    <Upload className="size-8 text-[#9D8BA7]/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
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
                      className="absolute top-2 right-2 size-6 rounded-full bg-card/80 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="size-3" />
                    </button>

                    {isAnalyzingImage && (
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-6 text-white animate-spin" />
                        <p className="text-xs text-white font-medium">Analyzing image...</p>
                      </div>
                    )}

                    {!isAnalyzingImage && imageDescription && (
                      <div className="mt-2 rounded-xl border border-[#9D8BA7]/20 bg-[#9D8BA7]/5 p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Eye className="size-3.5 text-[#9D8BA7]" />
                          <p className="text-xs text-[#9D8BA7] font-medium">AI Analysis</p>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {imageDescription}
                        </p>
                        {imageTags.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {imageTags.map((tag) => (
                              <span
                                key={tag}
                                className="bg-[#9D8BA7]/10 text-[#9D8BA7] text-[10px] px-2 py-0.5 rounded-full"
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
              className="w-full bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-xl h-11 text-sm font-medium transition-colors"
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
      <div className="shrink-0 pb-3 px-4 sm:px-6">
        <FilterBar />
      </div>

      {/* Extracted Tasks Section — mobile-friendly touch targets */}
      {extractedTasks.length > 0 && (
        <div className="shrink-0 mb-4 px-4 sm:px-6">
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="size-4 text-[#9D8BA7]" />
              <h3 className="text-sm font-semibold text-foreground">Extracted Tasks</h3>
              <span className="text-xs text-muted-foreground ml-auto">
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
                    <CheckSquare className="size-5 text-[#9D8BA7] shrink-0 mt-0.5" />
                  ) : (
                    <Square className="size-5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-[#9D8BA7] transition-colors" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm leading-relaxed transition-colors ${completedTasks.has(task.id) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.text}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">from: {task.memoryTitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Memory Feed — iOS-style scroll, mobile gap */}
      <div className="flex-1 overflow-y-auto min-h-0 ios-scroll px-4 sm:px-6 pb-4">
        {isLoadingMemories ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 shadow-sm border border-border">
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
            {sortedMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onClick={() => handleMemoryClick(memory.id)}
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
