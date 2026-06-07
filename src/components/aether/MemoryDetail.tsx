'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  Share2,
  Pencil,
  Trash2,
  Plus,
  Mic,
  Link2,
  FileText,
  Image as ImageIcon,
  Calendar,
  Tag,
  X,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAetherStore } from '@/store/aether-store'
import { useToast } from '@/hooks/use-toast'
import { deleteMemoryById, updateMemoryById } from '@/lib/supabase/data'
import { useOnlineStatus } from '@/hooks/use-online-status'
import type { Memory, MemoryType } from '@/components/aether/types'

// ────────────────────────────────────────────────────────────
// SPRING PHYSICS
// ────────────────────────────────────────────────────────────

const SPRING_BOUNCE = { type: 'spring' as const, stiffness: 400, damping: 17 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 260, damping: 22 }

const typeConfig: Record<MemoryType, { icon: typeof Mic; label: string; color: string }> = {
  text: { icon: FileText, label: 'Text', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  voice: { icon: Mic, label: 'Voice', color: 'bg-[#9D8BA7]/10 text-[#9D8BA7] border-[#9D8BA7]/20' },
  link: { icon: Link2, label: 'Link', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  image: { icon: ImageIcon, label: 'Image', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function parseSiteName(memory: Memory): string | null {
  if (memory.siteName) return memory.siteName
  if (memory.type !== 'link') return null
  const match = memory.content.match(/^\[From\s+(.+?)\]/)
  if (match) return match[1]
  return null
}

function stripSiteNamePrefix(content: string): string {
  return content.replace(/^\[From\s+.+?\]\s*\n*/, '').trim()
}

/* ─────────── Related Memory Card ─────────── */
function RelatedMemoryCard({ memory, onClick }: { memory: Memory; onClick: () => void }) {
  const config = typeConfig[memory.type]
  const Icon = config.icon

  return (
    <motion.button
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_BOUNCE}
      onClick={onClick}
      className="min-w-[260px] text-left rounded-2xl border border-border bg-card p-4 shadow-sm group flex-shrink-0"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-[#9D8BA7]/8 flex items-center justify-center flex-shrink-0 group-hover:bg-[#9D8BA7]/15 transition-colors duration-300">
          <Icon size={16} className="text-[#9D8BA7]" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-[#9D8BA7] transition-colors duration-300">
            {memory.title}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
            {memory.content}
          </p>
        </div>
      </div>
    </motion.button>
  )
}

/* ─────────── Delete Confirmation Dialog ─────────── */
function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  memoryTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  memoryTitle: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-border bg-background">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete Memory</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Are you sure you want to delete &ldquo;{memoryTitle}&rdquo;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border text-foreground hover:bg-muted">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="rounded-xl">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────── Streaming AI Recap Hook ─────────── */
function useStreamingInsight(memory: Memory | undefined) {
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Reset when memory changes
  useEffect(() => {
    setStreamedText('')
    setIsStreaming(false)
    setError(false)

    if (!memory) return

    // If the memory already has an AI summary, use it immediately
    if (memory.aiSummary || memory.aiInsight) {
      setStreamedText(memory.aiSummary || memory.aiInsight || '')
      return
    }

    // Start streaming
    const controller = new AbortController()
    abortRef.current = controller

    const streamInsight = async () => {
      setIsStreaming(true)
      setError(false)
      setStreamedText('')

      try {
        const res = await fetch('/api/ai/insights/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: memory.content,
            type: memory.type,
            tags: memory.tags,
            title: memory.title,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          throw new Error('Stream failed')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                setIsStreaming(false)
                return
              }
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  setStreamedText(prev => prev + parsed.text)
                }
              } catch {}
            }
          }
        }

        setIsStreaming(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(true)
        setIsStreaming(false)

        // Fallback: try the non-streaming endpoint
        try {
          const res = await fetch('/api/ai/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: memory.content,
              type: memory.type,
              tags: memory.tags,
              title: memory.title,
            }),
          })
          const data = await res.json()
          if (data.insight) {
            setStreamedText(data.insight)
            setError(false)
          }
        } catch {}
      }
    }

    streamInsight()

    return () => {
      controller.abort()
    }
  }, [memory?.id])

  const retry = useCallback(() => {
    if (!memory) return
    setError(false)
    setStreamedText('')
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const streamInsight = async () => {
      try {
        const res = await fetch('/api/ai/insights/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: memory.content,
            type: memory.type,
            tags: memory.tags,
            title: memory.title,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) throw new Error('Stream failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') { setIsStreaming(false); return }
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) setStreamedText(prev => prev + parsed.text)
              } catch {}
            }
          }
        }
        setIsStreaming(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError(true)
        setIsStreaming(false)
      }
    }

    streamInsight()
  }, [memory])

  return { streamedText, isStreaming, error, retry }
}

/* ─────────── Memory Detail View ─────────── */
export function MemoryDetail() {
  const { memories, selectedMemoryId, setSelectedMemoryId, setCurrentView, deleteMemory, updateMemory, darkMode } = useAetherStore()
  const { toast } = useToast()
  const isOnline = useOnlineStatus()

  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)
  const [showOriginal, setShowOriginal] = useState(false)

  const memory = useMemo(
    () => memories.find((m) => m.id === selectedMemoryId),
    [memories, selectedMemoryId]
  )

  // Streaming AI insight
  const { streamedText: aiInsight, isStreaming, error: insightError, retry } = useStreamingInsight(memory)

  // Related memories
  const relatedMemories = useMemo(() => {
    if (!memory) return []
    return memories
      .filter((m) => {
        if (m.id === memory.id) return false
        const sameCollection = m.collectionId && m.collectionId === memory.collectionId
        const sharedTags = m.tags.some((t) => memory.tags.includes(t))
        return sameCollection || sharedTags
      })
      .slice(0, 5)
  }, [memories, memory])

  const handleBack = () => {
    setSelectedMemoryId(null)
    setCurrentView('dashboard')
  }

  const handleShare = () => {
    navigator.clipboard.writeText(`https://aether.app/memory/${memory?.id ?? ''}`)
    toast({ title: 'Link copied!', description: 'Memory link has been copied to your clipboard.' })
  }

  const handleEdit = async () => {
    if (!memory) return
    if (isEditing) {
      if (editContent.trim() !== memory.content) {
        updateMemory(memory.id, { content: editContent.trim() })
        try {
          await updateMemoryById(memory.id, { content: editContent.trim() })
        } catch {}
        toast({ title: 'Memory updated!', description: !isOnline ? 'Changes saved locally.' : 'Your changes have been saved.' })
      }
      setIsEditing(false)
    } else {
      setEditContent(memory.content)
      setIsEditing(true)
    }
  }

  const handleDelete = async () => {
    if (!memory) return
    deleteMemory(memory.id)
    setDeleteDialogOpen(false)
    setSelectedMemoryId(null)
    setCurrentView('dashboard')
    try {
      await deleteMemoryById(memory.id)
    } catch {}
  }

  const handleAddTag = async () => {
    if (!newTag.trim() || !memory) return
    if (memory.tags.length >= 6) {
      toast({ title: 'Maximum tags reached', description: 'You can have up to 6 tags per memory.' })
      return
    }
    let tagToAdd = newTag.trim()
    tagToAdd = tagToAdd.replace(/^#+/, '')
    tagToAdd = `#${tagToAdd}`
    if (memory.tags.includes(tagToAdd)) {
      setNewTag('')
      setTimeout(() => tagInputRef.current?.focus(), 0)
      toast({ title: 'Tag already exists', description: `"${tagToAdd}" is already on this memory.` })
      return
    }
    const updatedTags = [...memory.tags, tagToAdd]
    updateMemory(memory.id, { tags: updatedTags })
    setNewTag('')
    setTimeout(() => tagInputRef.current?.focus(), 0)
    toast({ title: 'Tag added!', description: !isOnline ? 'Tag saved locally.' : `"${tagToAdd}" has been added.` })
    try {
      await updateMemoryById(memory.id, { tags: updatedTags })
    } catch {}
  }

  // Empty state
  if (!memory) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] px-4"
      >
        <div className="h-16 w-16 rounded-2xl bg-[#9D8BA7]/10 flex items-center justify-center mb-4">
          <Brain size={28} className="text-[#9D8BA7]" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Memory not found</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center">
          This memory may have been deleted or doesn&apos;t exist.
        </p>
        <Button
          onClick={handleBack}
          variant="outline"
          className="rounded-xl border-[#9D8BA7]/20 text-[#9D8BA7] hover:bg-[#9D8BA7]/5 min-h-[44px]"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Dashboard
        </Button>
      </motion.div>
    )
  }

  const config = typeConfig[memory.type]
  const TypeIcon = config.icon
  const siteName = parseSiteName(memory)
  const displayContent = memory.type === 'link' ? stripSiteNamePrefix(memory.content) : memory.content

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-background flex-1 min-h-0 overflow-y-auto ios-scroll pb-28 md:pb-6"
    >
      <div className="md:max-w-3xl md:mx-auto px-3 sm:px-6 py-3 sm:py-10">
        {/* ── Back Button ── */}
        <motion.button
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          transition={SPRING_BOUNCE}
          onClick={handleBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-[#9D8BA7] transition-colors duration-300 mb-4 sm:mb-6 group min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={20} className="transition-transform duration-300 group-hover:-translate-x-1" />
          <span className="hidden sm:inline">Back to Dashboard</span>
        </motion.button>

        {/* ═══════════════════════════════════════════════════════
           THE ORIGINAL MEMORY — What the user typed/pasted
           Pristine, unedited, preserved perfectly
           ═══════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...SPRING_SMOOTH }}
          className="mb-4 sm:mb-6"
        >
          {/* ── Memory HEADER ── */}
          <div className="flex items-start gap-3 sm:gap-4 mb-2">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#9D8BA7]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <TypeIcon size={20} className="text-[#9D8BA7] sm:size-[22px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-3xl font-bold text-foreground leading-tight">
                {memory.title}
              </h1>
              {memory.type === 'link' && siteName && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
                  From {siteName}
                </p>
              )}
            </div>
          </div>

          {/* ── Metadata Row ── */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
              <Calendar size={13} className="sm:size-[14px]" />
              <span>{formatDate(memory.createdAt)}</span>
            </div>
            <Badge
              variant="outline"
              className={`${config.color} text-xs font-medium rounded-lg px-2.5 py-0.5`}
            >
              <TypeIcon size={12} className="mr-1" />
              {config.label}
            </Badge>
            {memory.type === 'link' && (memory.source || memory.sourceUrl) && (
              <a
                href={memory.source || memory.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#9D8BA7]/10 text-[#9D8BA7] hover:bg-[#9D8BA7] hover:text-white px-3 py-1.5 rounded-lg transition-all duration-300"
              >
                <ExternalLink size={12} />
                Open Link
              </a>
            )}
          </div>

          {/* ── Link Preview Card ── */}
          {memory.type === 'link' && (memory.linkImage || memory.imagePreview) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.11, ...SPRING_SMOOTH }}
              className="mb-4 sm:mb-6"
            >
              <div
                className="rounded-xl overflow-hidden border border-border cursor-pointer group"
                onClick={() => {
                  const url = memory.source || memory.sourceUrl
                  if (url) window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                <img
                  src={memory.linkImage || memory.imagePreview}
                  alt={memory.title}
                  className="w-full max-h-[200px] object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            </motion.div>
          )}

          {/* ── THE SOURCE — Pristine, unedited ── */}
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[50vh] sm:min-h-[180px] rounded-2xl border-border bg-card text-foreground text-base leading-relaxed focus-visible:border-[#9D8BA7]/30 focus-visible:ring-[#9D8BA7]/10 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="rounded-xl border-border min-h-[44px]">
                    <X size={14} className="mr-1" /> Cancel
                  </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button size="sm" onClick={handleEdit} className="rounded-xl bg-[#9D8BA7] hover:bg-[#6D597A] text-white min-h-[44px]">
                    <Check size={14} className="mr-1" /> Save
                  </Button>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-card border border-border p-3 sm:p-6 shadow-sm">
              {/* Image memories: show the uploaded image */}
              {memory.type === 'image' && memory.imagePreview && (
                <div className="rounded-xl overflow-hidden border border-border mb-4">
                  <img src={memory.imagePreview} alt={memory.title} className="w-full max-h-[400px] object-contain bg-muted/30" />
                </div>
              )}

              {/* Voice memories: show raw transcription */}
              {memory.type === 'voice' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">Raw Transcription</span>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-xl p-3 sm:p-4">
                      {memory.content}
                    </p>
                  </div>
                </div>
              )}

              {/* Link memories: show original URL and extracted content */}
              {memory.type === 'link' && (
                <div className="space-y-3 overflow-hidden">
                  {(memory.source || memory.sourceUrl) && (
                    <div className="flex items-center gap-2">
                      <a
                        href={memory.source || memory.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-[#9D8BA7] hover:text-[#6D597A] underline underline-offset-2 transition-colors duration-300 break-all max-w-full overflow-hidden"
                      >
                        <Link2 size={14} className="shrink-0" />
                        <span className="break-all">{memory.source || memory.sourceUrl}</span>
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                    </div>
                  )}
                  {displayContent && displayContent !== (memory.source || memory.sourceUrl) && (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-all overflow-hidden">
                      {displayContent}
                    </p>
                  )}
                </div>
              )}

              {/* Text memories: show original text as typed */}
              {memory.type === 'text' && (
                <p className="text-foreground text-base leading-[1.65] whitespace-pre-wrap">
                  {memory.content}
                </p>
              )}
            </div>
          )}
        </motion.section>

        {/* ═══════════════════════════════════════════════════════
           THE AI LAYER — Generated recap/tags
           Visually separated: glowing glassmorphic box
           ═══════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, ...SPRING_SMOOTH }}
          className="mb-4 sm:mb-6"
        >
          <div
            className="rounded-2xl p-3 sm:p-6 relative overflow-hidden"
            style={{
              background: darkMode
                ? 'rgba(157, 139, 167, 0.04), rgba(15, 14, 23, 0.8)'
                : 'rgba(157, 139, 167, 0.04)',
              border: darkMode
                ? '1px solid rgba(192, 132, 252, 0.12)'
                : '1px solid rgba(157, 139, 167, 0.12)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: darkMode
                ? '0 0 30px rgba(192, 132, 252, 0.06), inset 0 1px 0 rgba(255,255,255,0.03)'
                : '0 0 20px rgba(157, 139, 167, 0.04)',
            }}
          >
            {/* Subtle glow accent at top */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(192, 132, 252, 0.3), transparent)',
              }}
            />

            <div className="flex items-center gap-2 mb-3">
              <motion.div
                animate={isStreaming ? { rotate: [0, 360] } : {}}
                transition={isStreaming ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
              >
                <Brain size={16} className="text-[#c084fc]" />
              </motion.div>
              <span className="text-xs font-semibold text-[#c084fc] uppercase tracking-wider">
                Aether&apos;s Understanding
              </span>
              {isStreaming && (
                <span className="text-[10px] text-[#c084fc]/40 ml-auto animate-pulse">
                  Thinking...
                </span>
              )}
            </div>

            {/* Streaming text with blinking cursor */}
            <div className="min-h-[40px]">
              {isStreaming && !aiInsight ? (
                // Blinking cursor before first token arrives
                <span className="text-sm text-foreground/60 animate-blink-cursor">▊</span>
              ) : aiInsight ? (
                <p className="text-sm text-foreground leading-relaxed">
                  {aiInsight}
                  {isStreaming && (
                    <span className="animate-blink-cursor text-[#c084fc]">▊</span>
                  )}
                </p>
              ) : insightError ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground italic">
                    Could not generate insight right now
                  </p>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={retry}
                      className="rounded-xl border-[#9D8BA7]/20 text-[#9D8BA7] hover:bg-[#9D8BA7]/5 w-fit"
                    >
                      Retry
                    </Button>
                  </motion.div>
                </div>
              ) : null}
            </div>
          </div>
        </motion.section>

        {/* ── Tags ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...SPRING_SMOOTH }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-[#9D8BA7]" />
            <h3 className="text-sm font-semibold text-foreground">Tags</h3>
          </div>
          <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            <div className="flex items-center gap-2 md:flex-wrap">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 min-h-[32px] px-3 py-1 rounded-full text-xs font-medium bg-[#9D8BA7]/10 text-[#9D8BA7] border border-[#9D8BA7]/15 hover:bg-[#9D8BA7]/15 transition-colors duration-300 whitespace-nowrap flex-shrink-0"
                >
                  {tag}
                  <button
                    onClick={async () => {
                      if (!memory) return
                      const updatedTags = memory.tags.filter((t) => t !== tag)
                      updateMemory(memory.id, { tags: updatedTags })
                      try { await updateMemoryById(memory.id, { tags: updatedTags }) } catch {}
                    }}
                    className="ml-0.5 size-3.5 rounded-full flex items-center justify-center hover:bg-[#9D8BA7]/25 transition-colors"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              {memory.tags.length < 6 && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && newTag.trim()) {
                        e.preventDefault()
                        handleAddTag()
                      }
                      if (e.key === ' ' && newTag.trim() && newTag.trim().length >= 2) {
                        e.preventDefault()
                        handleAddTag()
                      }
                      if (e.key === 'Escape') setNewTag('')
                      if (e.key === 'Backspace' && !newTag && memory.tags.length > 0) {
                        const lastTag = memory.tags[memory.tags.length - 1]
                        const updatedTags = memory.tags.slice(0, -1)
                        updateMemory(memory.id, { tags: updatedTags })
                        updateMemoryById(memory.id, { tags: updatedTags }).catch(() => {})
                        toast({ title: 'Tag removed', description: `Removed ${lastTag}` })
                      }
                    }}
                    placeholder="#new-tag"
                    className="min-h-[32px] w-28 rounded-full border border-[#9D8BA7]/20 bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#9D8BA7]/40 focus:ring-2 focus:ring-[#9D8BA7]/10 transition-all duration-300"
                  />
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* ── Related Memories ── */}
        {relatedMemories.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...SPRING_SMOOTH }}
            className="mb-6 sm:mb-8"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3 sm:mb-4">Related Memories</h3>
            <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
              <div className="flex gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
                {relatedMemories.map((relMemory) => (
                  <RelatedMemoryCard
                    key={relMemory.id}
                    memory={relMemory}
                    onClick={() => {
                      setSelectedMemoryId(relMemory.id)
                      setIsEditing(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* ── Desktop Action Buttons ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, ...SPRING_SMOOTH }}
          className="hidden md:flex flex-wrap gap-3 pt-4 border-t border-border"
        >
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleShare}
              variant="outline"
              className="rounded-xl border-border text-foreground hover:bg-[#9D8BA7]/5 hover:border-[#9D8BA7]/20 hover:text-[#9D8BA7] transition-all duration-300"
            >
              <Share2 size={16} className="mr-2" /> Share
            </Button>
          </motion.div>
          {memory.type === 'text' && (
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleEdit}
                variant="outline"
                className={`rounded-xl border-border transition-all duration-300 ${
                  isEditing ? 'bg-[#9D8BA7]/10 border-[#9D8BA7]/20 text-[#9D8BA7]' : 'text-foreground hover:bg-[#9D8BA7]/5 hover:border-[#9D8BA7]/20 hover:text-[#9D8BA7]'
                }`}
              >
                {isEditing ? <><Check size={16} className="mr-2" /> Editing...</> : <><Pencil size={16} className="mr-2" /> Edit</>}
              </Button>
            </motion.div>
          )}
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => setDeleteDialogOpen(true)}
              variant="outline"
              className="rounded-xl border-border text-red-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all duration-300"
            >
              <Trash2 size={16} className="mr-2" /> Delete
            </Button>
          </motion.div>
        </motion.section>
      </div>

      {/* ── Fixed Action Bar (Mobile only) ── */}
      <div className="md:hidden fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border">
        <div className="flex items-center justify-around px-4 h-16">
          <button
            onClick={handleShare}
            aria-label="Share memory"
            className="flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] rounded-xl text-muted-foreground hover:text-[#9D8BA7] active:bg-[#9D8BA7]/5 transition-colors duration-150"
          >
            <Share2 size={18} />
            <span className="text-[10px] font-medium">Share</span>
          </button>
          {memory.type === 'text' && (
            <button
              onClick={handleEdit}
              className={`flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] rounded-xl transition-colors duration-150 ${
                isEditing ? 'text-[#9D8BA7] bg-[#9D8BA7]/10' : 'text-muted-foreground hover:text-[#9D8BA7] active:bg-[#9D8BA7]/5'
              }`}
              aria-label={isEditing ? 'Save changes' : 'Edit memory'}
            >
              {isEditing ? <Check size={18} /> : <Pencil size={18} />}
              <span className="text-[10px] font-medium">{isEditing ? 'Save' : 'Edit'}</span>
            </button>
          )}
          <button
            onClick={() => setDeleteDialogOpen(true)}
            aria-label="Delete memory"
            className="flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] rounded-xl text-red-500 hover:text-red-600 active:bg-red-50 transition-colors duration-150"
          >
            <Trash2 size={18} />
            <span className="text-[10px] font-medium">Delete</span>
          </button>
        </div>
      </div>

      {/* ── Delete Confirmation ── */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        memoryTitle={memory.title}
      />
    </motion.div>
  )
}
