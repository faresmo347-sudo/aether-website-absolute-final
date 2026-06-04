'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Briefcase,
  Lightbulb,
  Plane,
  BookOpen,
  ChefHat,
  Moon,
  Target,
  Palette,
  Music,
  Globe,
  Wrench,
  Heart,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { useAetherStore } from '@/store/aether-store'
import { createCollection as createCollectionDb } from '@/lib/supabase/data'
import type { Collection } from './types'

/* ─────────── Icon Registry ─────────── */

interface IconOption {
  key: string
  icon: LucideIcon
  label: string
}

const iconOptions: IconOption[] = [
  { key: 'briefcase', icon: Briefcase, label: 'Work' },
  { key: 'lightbulb', icon: Lightbulb, label: 'Ideas' },
  { key: 'plane', icon: Plane, label: 'Travel' },
  { key: 'book-open', icon: BookOpen, label: 'Books' },
  { key: 'chef-hat', icon: ChefHat, label: 'Recipes' },
  { key: 'moon', icon: Moon, label: 'Personal' },
  { key: 'target', icon: Target, label: 'Goals' },
  { key: 'palette', icon: Palette, label: 'Creative' },
  { key: 'music', icon: Music, label: 'Music' },
  { key: 'globe', icon: Globe, label: 'World' },
  { key: 'wrench', icon: Wrench, label: 'Tools' },
  { key: 'heart', icon: Heart, label: 'Health' },
]

const iconMap: Record<string, LucideIcon> = Object.fromEntries(
  iconOptions.map((o) => [o.key, o.icon])
)

function CollectionIcon({ iconKey, className, style }: { iconKey: string; className?: string; style?: React.CSSProperties }) {
  const Icon = iconMap[iconKey] ?? Briefcase
  return <Icon className={className} style={style} />
}

/* ─────────── Helpers ─────────── */

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ─────────── Collections Component ─────────── */

export function Collections() {
  const { setCurrentView, setCollectionFilter, setTagFilter, collections, memories, addCollection } = useAetherStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<string>('briefcase')

  // Build tag cloud from actual memories
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const mem of memories) {
      for (const tag of mem.tags) {
        counts[tag] = (counts[tag] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [memories])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const newCollection = await createCollectionDb({
        name: newName.trim(),
        icon: selectedIcon,
        color: '#9D8BA7',
      })
      addCollection(newCollection)
    } catch (err) {
      console.error('Failed to create collection:', err)
      // Fallback: add locally
      const fallback: Collection = {
        id: `col-${Date.now()}`,
        name: newName.trim(),
        icon: selectedIcon,
        memoryCount: 0,
        lastUpdated: new Date().toISOString().split('T')[0],
        color: '#9D8BA7',
      }
      addCollection(fallback)
    }
    setNewName('')
    setSelectedIcon('briefcase')
    setCreateOpen(false)
  }

  const handleCollectionClick = (collection: Collection) => {
    setCollectionFilter(collection.id)
    setTagFilter(null)
    setCurrentView('dashboard')
  }

  const handleTagClick = (tagName: string) => {
    setCollectionFilter(null)
    setTagFilter(tagName)
    setCurrentView('dashboard')
  }

  return (
    <div className="bg-background flex-1 min-h-0 overflow-y-auto ios-scroll">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-28 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Collections
            </h1>
            <p className="text-sm mt-1 text-muted-foreground">
              Organize your memories by theme
            </p>
          </div>
          {/* Desktop Create Button */}
          <Button
            onClick={() => setCreateOpen(true)}
            className="hidden md:flex rounded-full px-4 shadow-sm"
            style={{ backgroundColor: '#9D8BA7', color: '#fff', border: 'none' }}
          >
            <Plus className="size-4 mr-1" />
            Create Collection
          </Button>
        </div>

        {/* Collections Grid - 2 cols mobile, 3 cols desktop */}
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center">
            <div className="size-16 rounded-2xl flex items-center justify-center mb-4 bg-[#9D8BA7]/12">
              <FolderOpen className="size-8" style={{ color: '#9D8BA7' }} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              No collections yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Create your first collection to organize your memories by theme
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2 w-full sm:w-auto min-h-[44px] bg-[#9D8BA7] hover:bg-[#9D8BA7]/90 text-white"
            >
              <Plus className="size-4" />
              Create Collection
            </Button>
          </div>
        ) : (
          collections.every((c) => c.memoryCount === 0) && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Save memories and assign them to collections to see them organized here
            </p>
          )
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-10 px-0 sm:px-0">
          {collections.map((collection, index) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleCollectionClick(collection)}
              className="tap-feedback bg-card rounded-2xl p-3 sm:p-5 shadow-sm border border-border hover:shadow-md hover:border-[#9D8BA7]/15 transition-all cursor-pointer group flex flex-col items-center text-center"
            >
              <div
                className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center mb-3 transition-colors duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${collection.color}15` }}
              >
                <CollectionIcon
                  iconKey={collection.icon}
                  className="size-6 sm:size-7 transition-colors duration-300"
                  style={{ color: collection.color }}
                />
              </div>
              <h3 className="font-bold text-sm sm:text-base mb-1 text-foreground truncate w-full">
                {collection.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {collection.memoryCount} memories
              </p>
            </motion.div>
          ))}
        </div>

        {/* Tag Cloud Section */}
        <div>
          <h2
            className="text-lg sm:text-2xl font-bold mb-3 sm:mb-4 text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Your Tags
          </h2>
          {tagCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tags will appear here as you save memories with content
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagCounts.map((tag, index) => (
                <motion.button
                  key={tag.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTagClick(tag.name)}
                  className={`tap-feedback px-3 py-2 rounded-full transition-colors min-h-[44px] flex items-center bg-[#9D8BA7]/8 text-foreground hover:bg-[#9D8BA7]/15 active:bg-muted/50 ${
                    tag.count >= 6
                      ? 'text-base'
                      : tag.count >= 4
                        ? 'text-sm'
                        : 'text-xs'
                  }`}
                >
                  {tag.name}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile FAB - Create Collection */}
      <button
        onClick={() => setCreateOpen(true)}
        className="md:hidden fixed right-4 h-14 w-14 rounded-full bg-[#9D8BA7] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-50 tap-feedback"
        style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        aria-label="Create collection"
      >
        <Plus className="size-6" />
      </button>

      {/* Create Collection Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-background w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle
              className="text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Create Collection
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">
                Name
              </label>
              <Input
                placeholder="Enter collection name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-xl border-[#9D8BA7]/30 h-11"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Choose an Icon
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-2">
                {iconOptions.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = selectedIcon === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setSelectedIcon(opt.key)}
                      className={`tap-feedback p-3 sm:p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 min-h-[56px] sm:min-h-[44px] ${
                        isSelected
                          ? 'scale-105 shadow-sm bg-[#9D8BA7]/12'
                          : 'hover:bg-muted active:bg-muted/50'
                      }`}
                      style={
                        isSelected
                          ? { outline: '2px solid #9D8BA7' }
                          : {}
                      }
                      title={opt.label}
                    >
                      <Icon
                        className={`size-5 sm:size-5 ${isSelected ? 'text-[#9D8BA7]' : 'text-muted-foreground'}`}
                      />
                      <span className="text-[10px] text-muted-foreground leading-tight">{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" className="rounded-full flex-1 sm:flex-none min-h-[44px]">
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-full flex-1 sm:flex-none min-h-[44px]"
              style={{ backgroundColor: '#9D8BA7', color: '#fff', border: 'none' }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
