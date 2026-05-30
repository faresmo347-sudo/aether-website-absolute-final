'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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

/**
 * Parse the site name from enriched link content.
 * Looks for the "[From SiteName]" pattern at the start of content,
 * or falls back to the memory.siteName field.
 */
function parseSiteName(memory: Memory): string | null {
  if (memory.siteName) return memory.siteName
  if (memory.type !== 'link') return null

  // Try to extract [From SiteName] from the beginning of content
  const match = memory.content.match(/^\[From\s+(.+?)\]/)
  if (match) return match[1]

  return null
}

/**
 * Strip the [From SiteName] prefix from content for display.
 */
function stripSiteNamePrefix(content: string): string {
  return content.replace(/^\[From\s+.+?\]\s*\n*/, '').trim()
}

/* ─────────── Related Memory Card ─────────── */
function RelatedMemoryCard({ memory, onClick }: { memory: Memory; onClick: () => void }) {
  const config = typeConfig[memory.type]
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className="min-w-[260px] text-left rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-[#9D8BA7]/20 transition-all duration-300 group flex-shrink-0"
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
    </button>
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-border text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="rounded-xl"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─────────── Memory Detail View ─────────── */
export function MemoryDetail() {
  const { memories, selectedMemoryId, setSelectedMemoryId, setCurrentView, deleteMemory, updateMemory } = useAetherStore()
  const { toast } = useToast()
  const isOnline = useOnlineStatus()

  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [aiInsight, setAiInsight] = useState('')
  const [isLoadingInsight, setIsLoadingInsight] = useState(false)
  const [insightError, setInsightError] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  const memory = useMemo(
    () => memories.find((m) => m.id === selectedMemoryId),
    [memories, selectedMemoryId]
  )

  useEffect(() => {
    if (!memory) return
    let cancelled = false
    const doFetch = async () => {
      setIsLoadingInsight(true)
      setInsightError(false)
      setAiInsight('')
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
        if (!cancelled) {
          const data = await res.json()
          setAiInsight(data.insight || '')
        }
      } catch {
        if (!cancelled) {
          setAiInsight('')
          setInsightError(true)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInsight(false)
        }
      }
    }
    doFetch()
    return () => {
      cancelled = true
    }
  }, [memory?.id, memory?.content, memory?.tags])

  // Find related memories: same collection or matching tags
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
      // Save — update content in the store and Supabase
      if (editContent.trim() !== memory.content) {
        updateMemory(memory.id, { content: editContent.trim() })
        try {
          await updateMemoryById(memory.id, { content: editContent.trim() })
        } catch {
          // Supabase update failed silently — store is already updated locally
          // If offline, data.ts handles queueing
        }
        toast({ title: 'Memory updated!', description: !isOnline ? 'Changes saved locally — will sync when you reconnect.' : 'Your changes have been saved.' })
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
    } catch {
      // Supabase delete failed silently — already removed from local store
    }
  }

  const handleAddTag = async () => {
    if (!newTag.trim() || !memory) return
    const tagToAdd = newTag.trim()
    // Avoid duplicate tags
    if (memory.tags.includes(tagToAdd)) {
      setNewTag('')
      setShowTagInput(false)
      toast({ title: 'Tag already exists', description: `"${tagToAdd}" is already on this memory.` })
      return
    }
    const updatedTags = [...memory.tags, tagToAdd]
    updateMemory(memory.id, { tags: updatedTags })
    setNewTag('')
    setShowTagInput(false)
    toast({ title: 'Tag added!', description: !isOnline ? 'Tag saved locally — will sync when you reconnect.' : `"${tagToAdd}" has been added to this memory.` })
    try {
      await updateMemoryById(memory.id, { tags: updatedTags })
    } catch {
      // Supabase update failed silently — store is already updated locally
    }
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
      {/* Full width on mobile, centered on larger screens */}
      <div className="md:max-w-3xl md:mx-auto px-3 sm:px-6 py-3 sm:py-10">
        {/* ── Back Button ── */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-[#9D8BA7] transition-colors duration-300 mb-4 sm:mb-6 group min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={20} className="transition-transform duration-300 group-hover:-translate-x-1" />
          <span className="hidden sm:inline">Back to Dashboard</span>
        </button>

        {/* ── Memory HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="flex items-start gap-3 sm:gap-4 mb-2">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#9D8BA7]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <TypeIcon size={20} className="text-[#9D8BA7] sm:size-[22px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-3xl font-bold text-foreground leading-tight">
                {memory.title}
              </h1>
              {/* Site name badge for link memories */}
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
            {/* Open Link button for link memories */}
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
            {memory.type !== 'link' && memory.source && (
              <a
                href={memory.source}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#9D8BA7] hover:text-[#6D597A] transition-colors duration-300 group"
              >
                <Link2 size={12} />
                <span className="truncate max-w-[140px] sm:max-w-[200px] inline-block align-bottom">{memory.source.replace(/^https?:\/\//, '')}</span>
                <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </a>
            )}
          </div>

          {/* ── Link Preview Card ── */}
          {memory.type === 'link' && (memory.linkImage || memory.imagePreview) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.11, duration: 0.3 }}
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
                  onError={(e) => {
                    // Hide broken images
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* ── AI Insights ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <div className="rounded-2xl bg-card border border-border p-3 sm:p-6 shadow-sm border-l-4 border-l-[#9D8BA7]">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={16} className="text-[#9D8BA7]" />
              <span className="text-xs font-semibold text-[#9D8BA7] uppercase tracking-wider">
                Aether Insights
              </span>
            </div>
            {isLoadingInsight ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-3/4" />
                <p className="text-xs text-muted-foreground italic mt-2">Aether is thinking...</p>
              </div>
            ) : insightError ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground italic">
                  Could not generate insight right now — try again
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Re-trigger insight fetch by toggling the memory id
                    if (memory) {
                      setIsLoadingInsight(true)
                      setInsightError(false)
                      setAiInsight('')
                      fetch('/api/ai/insights', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          content: memory.content,
                          type: memory.type,
                          tags: memory.tags,
                          title: memory.title,
                        }),
                      })
                        .then((res) => res.json())
                        .then((data) => setAiInsight(data.insight || ''))
                        .catch(() => setInsightError(true))
                        .finally(() => setIsLoadingInsight(false))
                    }
                  }}
                  className="rounded-xl border-[#9D8BA7]/20 text-[#9D8BA7] hover:bg-[#9D8BA7]/5 w-fit"
                >
                  Retry
                </Button>
              </div>
            ) : aiInsight ? (
              <p className="text-sm text-foreground leading-relaxed">
                {aiInsight}
              </p>
            ) : null}
          </div>
        </motion.div>

        {/* ── View Original Memory Toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4 }}
          className="mb-4 sm:mb-6"
        >
          <Button
            onClick={() => setShowOriginal(!showOriginal)}
            className={`rounded-xl transition-all duration-300 w-full md:w-auto min-h-[48px] font-semibold shadow-sm ${
              showOriginal
                ? 'bg-[#9D8BA7] text-white hover:bg-[#6D597A] shadow-md'
                : 'bg-[#9D8BA7]/10 text-[#9D8BA7] border border-[#9D8BA7]/20 hover:bg-[#9D8BA7] hover:text-white shadow-md hover:shadow-lg'
            }`}
          >
            {showOriginal ? (
              <>
                <EyeOff size={16} className="mr-2" />
                Hide Original Memory
              </>
            ) : (
              <>
                <Eye size={16} className="mr-2" />
                View Original Memory
              </>
            )}
          </Button>
        </motion.div>

        {/* ── Original Memory Content ── */}
        {showOriginal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-4 sm:mb-6 overflow-hidden"
          >
            <div className="rounded-2xl bg-card border border-border p-3 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Your original memory
                </span>
              </div>

              {/* Image memories: show the uploaded image */}
              {memory.type === 'image' && memory.imagePreview && (
                <div className="rounded-xl overflow-hidden border border-border mb-4">
                  <img
                    src={memory.imagePreview}
                    alt={memory.title}
                    className="w-full max-h-[400px] object-contain bg-muted/30"
                  />
                </div>
              )}

              {/* Voice memories: show raw transcription and AI summary */}
              {memory.type === 'voice' && (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">Raw Transcription</span>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-xl p-3 sm:p-4">
                      {memory.content}
                    </p>
                  </div>
                  {memory.aiSummary && (
                    <div>
                      <span className="text-xs font-medium text-[#9D8BA7] mb-1 block">AI Summary</span>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-[#9D8BA7]/5 rounded-xl p-3 sm:p-4 border border-[#9D8BA7]/10">
                        {memory.aiSummary}
                      </p>
                    </div>
                  )}
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
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {memory.content}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Content ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mb-6 sm:mb-8"
        >
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[50vh] sm:min-h-[180px] rounded-2xl border-border bg-card text-foreground text-base leading-relaxed focus-visible:border-[#9D8BA7]/30 focus-visible:ring-[#9D8BA7]/10 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border-border min-h-[44px]"
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleEdit}
                  className="rounded-xl bg-[#9D8BA7] hover:bg-[#6D597A] text-white min-h-[44px]"
                >
                  <Check size={14} className="mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-card border border-border p-3 sm:p-6 shadow-sm">
              <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
                {displayContent}
              </p>
            </div>
          )}
        </motion.div>

        {/* ── Tags ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <Tag size={14} className="text-[#9D8BA7]" />
            <h3 className="text-sm font-semibold text-foreground">Tags</h3>
          </div>
          {/* Horizontally scrollable tags on mobile, wrapping on desktop */}
          <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            <div className="flex items-center gap-2 md:flex-wrap">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-[#9D8BA7]/8 text-[#9D8BA7] border border-[#9D8BA7]/15 hover:bg-[#9D8BA7]/15 transition-colors duration-300 whitespace-nowrap flex-shrink-0"
                >
                  {tag}
                </span>
              ))}
              {showTagInput ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag()
                      if (e.key === 'Escape') {
                        setShowTagInput(false)
                        setNewTag('')
                      }
                    }}
                    placeholder="#new-tag"
                    autoFocus
                    className="h-8 w-28 rounded-full border border-[#9D8BA7]/20 bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#9D8BA7]/40 focus:ring-2 focus:ring-[#9D8BA7]/10 transition-all duration-300"
                  />
                  <button
                    onClick={handleAddTag}
                    aria-label="Add tag"
                    className="min-h-[44px] min-w-[44px] rounded-full bg-[#9D8BA7] text-white flex items-center justify-center hover:bg-[#6D597A] transition-colors duration-300"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setShowTagInput(false)
                      setNewTag('')
                    }}
                    aria-label="Cancel tag"
                    className="min-h-[44px] min-w-[44px] rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors duration-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground border border-dashed border-border hover:border-[#9D8BA7]/30 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 transition-all duration-300 whitespace-nowrap flex-shrink-0"
                >
                  <Plus size={12} />
                  Add tag
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── AI Summary ── */}
        {memory.aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="mb-6 sm:mb-8"
          >
            <div className="rounded-2xl bg-card border border-border p-3 sm:p-6 shadow-sm border-l-4 border-l-[#9D8BA7]">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} className="text-[#9D8BA7]" />
                <span className="text-xs font-semibold text-[#9D8BA7] uppercase tracking-wider">
                  Aether&apos;s Understanding
                </span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {memory.aiSummary}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Related Memories ── */}
        {relatedMemories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mb-6 sm:mb-8"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3 sm:mb-4">Related Memories</h3>
            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
              <div className="flex gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
                {relatedMemories.map((relMemory) => (
                  <RelatedMemoryCard
                    key={relMemory.id}
                    memory={relMemory}
                    onClick={() => {
                      setSelectedMemoryId(relMemory.id)
                      setIsEditing(false)
                      setShowTagInput(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Action Buttons (Desktop only — inline layout) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="hidden md:flex flex-wrap gap-3 pt-4 border-t border-border"
        >
          <Button
            onClick={handleShare}
            variant="outline"
            className="rounded-xl border-border text-foreground hover:bg-[#9D8BA7]/5 hover:border-[#9D8BA7]/20 hover:text-[#9D8BA7] transition-all duration-300"
          >
            <Share2 size={16} className="mr-2" />
            Share
          </Button>
          {memory.type === 'text' && (
            <Button
              onClick={handleEdit}
              variant="outline"
              className={`rounded-xl border-border transition-all duration-300 ${
                isEditing
                  ? 'bg-[#9D8BA7]/10 border-[#9D8BA7]/20 text-[#9D8BA7]'
                  : 'text-foreground hover:bg-[#9D8BA7]/5 hover:border-[#9D8BA7]/20 hover:text-[#9D8BA7]'
              }`}
            >
              {isEditing ? (
                <>
                  <Check size={16} className="mr-2" />
                  Editing...
                </>
              ) : (
                <>
                  <Pencil size={16} className="mr-2" />
                  Edit
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => setDeleteDialogOpen(true)}
            variant="outline"
            className="rounded-xl border-border text-red-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all duration-300"
          >
            <Trash2 size={16} className="mr-2" />
            Delete
          </Button>
        </motion.div>
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
                isEditing
                  ? 'text-[#9D8BA7] bg-[#9D8BA7]/10'
                  : 'text-muted-foreground hover:text-[#9D8BA7] active:bg-[#9D8BA7]/5'
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

      {/* ── Delete Confirmation Dialog ── */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        memoryTitle={memory.title}
      />
    </motion.div>
  )
}
