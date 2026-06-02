'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Cpu,
  Sparkles,
  Crown,
  Download,
  FileText,
  Trash2,
  Check,
  X,
  Loader2,
  LogOut,
  AlertTriangle,
  Moon,
  MessageSquare,
  Tag,
  Camera,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAetherStore } from '@/store/aether-store'
import { useToast } from '@/hooks/use-toast'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { signOut, updateProfile, exportAllMemories } from '@/lib/supabase/data'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { CaptureTab } from './types'

export function Settings() {
  const {
    dailySummary,
    setDailySummary,
    weeklyRecap,
    setWeeklyRecap,
    autoTagging,
    setAutoTagging,
    defaultCapture,
    setDefaultCapture,
    darkMode,
    setDarkMode,
    profile,
    setProfile,
    memories,
    user,
    setCurrentView,
  } = useAetherStore()

  const { toast } = useToast()
  const isOnline = useOnlineStatus()

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(profile.name)
  const [editEmail, setEditEmail] = useState(profile.email)

  // Export loading states
  const [isExportingJson, setIsExportingJson] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  // Delete account dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // ──── Dark mode: DOM sync is handled by the blocking script in layout.tsx
  // (initial paint) and the useEffect in page.tsx (ongoing sync with store).
  // No additional mount-time sync needed here — handleDarkModeToggle below
  // is the single source of truth for toggling.

  // ──── Profile handlers ────
  const handleEditStart = () => {
    setEditName(profile.name)
    setEditEmail(profile.email)
    setIsEditing(true)
  }

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditName(profile.name)
    setEditEmail(profile.email)
  }

  const handleEditSave = async () => {
    const trimmedName = editName.trim()
    const trimmedEmail = editEmail.trim()
    if (!trimmedName || !trimmedEmail) return

    // Compute initials from name
    const parts = trimmedName.split(' ')
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : trimmedName.slice(0, 2).toUpperCase()

    try {
      // Save to Supabase if we have a user ID
      if (user?.id) {
        await updateProfile(user.id, { name: trimmedName })
      }

      setProfile({ ...profile, name: trimmedName, email: trimmedEmail, initials })
      setIsEditing(false)
      toast({ title: 'Profile updated!', description: !isOnline ? 'Changes saved locally — will sync when you reconnect.' : 'Your changes have been saved.' })
    } catch (err) {
      console.error('Failed to update profile:', err)
      toast({ title: 'Update failed', description: 'Could not save your profile. Please try again.', variant: 'destructive' })
    }
  }

  // ──── Dark mode handler ────
  const handleDarkModeToggle = useCallback((enabled: boolean) => {
    setDarkMode(enabled)
    if (enabled) {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
    // Persist to localStorage so the preference survives page refresh
    try {
      localStorage.setItem('aether-theme', enabled ? 'dark' : 'light')
      localStorage.setItem('aether-dark-mode', String(enabled))
    } catch {}
  }, [setDarkMode])

  // ──── Bloom upgrade handler ────
  const handleBloomUpgrade = useCallback(() => {
    toast({
      title: 'Bloom plan coming soon!',
      description: 'Stay tuned for unlimited memories and premium features.',
    })
  }, [toast])

  // ──── Delete account handler ────
  const handleDeleteAccount = useCallback(async () => {
    try {
      await signOut()
      setCurrentView('landing')
      toast({ title: 'Signed out', description: 'Your account session has been ended.' })
    } catch (err) {
      console.error('Sign out failed:', err)
      toast({ title: 'Error', description: 'Could not sign out. Please try again.', variant: 'destructive' })
    }
  }, [setCurrentView, toast])

  // ──── Export JSON handler ────
  const handleExportJson = useCallback(async () => {
    setIsExportingJson(true)
    try {
      const jsonString = await exportAllMemories()
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `aether-memories-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: 'Export complete!',
        description: !isOnline ? 'Exported from cached memories.' : 'All memories exported as JSON from Supabase.',
      })
    } catch (err) {
      console.error('Export failed:', err)
      toast({
        title: 'Export failed',
        description: 'Could not export your memories. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsExportingJson(false)
    }
  }, [toast, isOnline])

  // ──── Export PDF handler ────
  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true)
    try {
      // Dynamically import jspdf to avoid SSR issues
      const { jsPDF } = await import('jspdf')

      // Get memories from the store (works offline)
      const allMemories = memories.length > 0 ? memories : (() => {
        try {
          const stored = localStorage.getItem('aether-memories')
          return stored ? JSON.parse(stored) : []
        } catch { return [] }
      })()

      if (allMemories.length === 0) {
        toast({ title: 'No memories to export', description: 'Capture some memories first.' })
        setIsExportingPdf(false)
        return
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const contentWidth = pageWidth - margin * 2
      let y = margin

      const addPageNumber = (pageNum: number) => {
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
      }

      // Title page
      doc.setFontSize(24)
      doc.setTextColor(157, 139, 167) // #9D8BA7
      doc.text('Aether Memories', pageWidth / 2, y + 20, { align: 'center' })
      y += 30

      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      const exportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      doc.text(`Exported on ${exportDate}`, pageWidth / 2, y + 10, { align: 'center' })
      y += 20

      doc.setFontSize(10)
      doc.text(`${allMemories.length} memories`, pageWidth / 2, y + 10, { align: 'center' })

      addPageNumber(1)

      // Memory pages
      let currentPage = 2
      let memoryIndex = 0

      for (const memory of allMemories) {
        memoryIndex++

        // Start new page for each memory
        doc.addPage()
        y = margin
        addPageNumber(currentPage)
        currentPage++

        // Memory title
        doc.setFontSize(14)
        doc.setTextColor(40, 40, 40)
        const titleLines = doc.splitTextToSize(memory.title || 'Untitled', contentWidth)
        doc.text(titleLines, margin, y)
        y += titleLines.length * 7 + 4

        // Date and type
        doc.setFontSize(9)
        doc.setTextColor(157, 139, 167)
        const dateStr = new Date(memory.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        const typeLabel = memory.type ? memory.type.charAt(0).toUpperCase() + memory.type.slice(1) : 'Text'
        doc.text(`${dateStr}  •  ${typeLabel}`, margin, y)
        y += 8

        // Divider
        doc.setDrawColor(220, 220, 220)
        doc.line(margin, y, pageWidth - margin, y)
        y += 8

        // Content
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        const contentText = memory.content || 'No content'
        const contentLines = doc.splitTextToSize(contentText, contentWidth)

        for (let i = 0; i < contentLines.length; i++) {
          if (y > pageHeight - 30) {
            doc.addPage()
            currentPage++
            y = margin
            addPageNumber(currentPage - 1)
          }
          doc.text(contentLines[i], margin, y)
          y += 5
        }
        y += 6

        // Tags
        if (memory.tags && memory.tags.length > 0) {
          if (y > pageHeight - 30) {
            doc.addPage()
            currentPage++
            y = margin
            addPageNumber(currentPage - 1)
          }
          doc.setFontSize(9)
          doc.setTextColor(157, 139, 167)
          doc.text(`Tags: ${memory.tags.join(', ')}`, margin, y)
        }
      }

      doc.save(`aether-memories-${new Date().toISOString().split('T')[0]}.pdf`)

      toast({
        title: 'PDF exported!',
        description: `${allMemories.length} memories exported as PDF.`,
      })
    } catch (err) {
      console.error('PDF export failed:', err)
      toast({
        title: 'PDF export failed',
        description: 'Could not generate PDF. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsExportingPdf(false)
    }
  }, [toast, memories])

  // ──── Logout handler ────
  const handleLogout = useCallback(async () => {
    try {
      await signOut()
      setCurrentView('landing')
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  }, [setCurrentView])

  return (
    <div className="bg-background text-foreground flex-1 min-h-0 overflow-y-auto ios-scroll">
      <div className="max-w-2xl mx-auto px-0 sm:px-6 py-6 sm:py-8 pb-8">
        {/* Header */}
        <div className="px-4 sm:px-0 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Settings
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Manage your Aether experience
          </p>
        </div>

        <div className="space-y-0">
          {/* ── Profile Section - Centered Avatar ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="px-4 sm:px-0 py-6"
          >
            {isEditing ? (
              /* ── Edit Mode ── */
              <div className="space-y-4">
                <div className="flex flex-col items-center mb-4">
                  <div className="size-20 rounded-full flex items-center justify-center text-white font-bold text-2xl bg-[#9D8BA7] mb-2">
                    {editName.trim().split(' ').length >= 2
                      ? (editName.trim().split(' ')[0][0] + editName.trim().split(' ').pop()![0]).toUpperCase()
                      : editName.trim().slice(0, 2).toUpperCase() || 'AJ'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">Editing profile</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">
                    Name
                  </label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your name"
                    className="rounded-xl h-11"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="flex items-center gap-2 justify-end pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditCancel}
                    className="rounded-xl min-h-[44px]"
                  >
                    <X className="size-3.5 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleEditSave}
                    disabled={!editName.trim() || !editEmail.trim()}
                    className="rounded-xl min-h-[44px] bg-[#9D8BA7] hover:bg-[#7A6B85] text-white"
                  >
                    <Check className="size-3.5 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              /* ── View Mode - Centered ── */
              <div className="flex flex-col items-center text-center">
                <button
                  onClick={handleEditStart}
                  className="tap-feedback relative group mb-3"
                >
                  <div className="h-20 w-20 rounded-full flex items-center justify-center text-white font-bold text-2xl bg-[#9D8BA7] transition-transform group-active:scale-95">
                    {profile.initials}
                  </div>
                  <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-background border-2 border-border flex items-center justify-center">
                    <Camera className="size-3.5 text-muted-foreground" />
                  </div>
                </button>
                <p className="text-xs text-muted-foreground mb-2">Tap to change</p>
                <h3 className="font-bold text-lg text-foreground">
                  {profile.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {profile.email}
                </p>
              </div>
            )}
          </motion.div>

          {/* Divider */}
          <div className="h-px bg-border mx-4 sm:mx-0" />

          {/* ── Notifications Section ── */}
          <div className="sticky top-0 z-10 bg-background px-4 sm:px-0 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Bell className="size-3.5" />
              Notifications
            </h3>
          </div>
          <div className="px-4 sm:px-0">
            <div className="flex items-center justify-between py-3 min-h-[48px] active:bg-muted/50 rounded-lg px-0 transition-colors">
              <div className="flex items-center gap-3">
                <MessageSquare className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Daily summary
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recap of your day&apos;s memories
                  </p>
                </div>
              </div>
              <Switch checked={dailySummary} onCheckedChange={setDailySummary} />
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between py-3 min-h-[48px] active:bg-muted/50 rounded-lg px-0 transition-colors">
              <div className="flex items-center gap-3">
                <Bell className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Weekly recap email
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Weekly digest every Sunday
                  </p>
                </div>
              </div>
              <Switch checked={weeklyRecap} onCheckedChange={setWeeklyRecap} />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border mx-4 sm:mx-0" />

          {/* ── Appearance Section ── */}
          <div className="sticky top-0 z-10 bg-background px-4 sm:px-0 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Moon className="size-3.5" />
              Appearance
            </h3>
          </div>
          <div className="px-4 sm:px-0">
            <div className="flex items-center justify-between py-3 min-h-[48px] active:bg-muted/50 rounded-lg px-0 transition-colors">
              <div className="flex items-center gap-3">
                <Moon className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Dark mode
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Switch between light and dark theme
                  </p>
                </div>
              </div>
              <Switch
                checked={darkMode}
                onCheckedChange={handleDarkModeToggle}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border mx-4 sm:mx-0" />

          {/* ── Memory Preferences Section ── */}
          <div className="sticky top-0 z-10 bg-background px-4 sm:px-0 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Cpu className="size-3.5" />
              Memory Preferences
            </h3>
          </div>
          <div className="px-4 sm:px-0">
            <div className="flex items-center justify-between py-3 min-h-[48px] active:bg-muted/50 rounded-lg px-0 transition-colors">
              <div className="flex items-center gap-3">
                <Cpu className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Default capture type
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Opens first when you capture
                  </p>
                </div>
              </div>
              <Select
                value={defaultCapture}
                onValueChange={(v) => setDefaultCapture(v as CaptureTab)}
              >
                <SelectTrigger className="w-[110px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between py-3 min-h-[48px] active:bg-muted/50 rounded-lg px-0 transition-colors">
              <div className="flex items-center gap-3">
                <Tag className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Auto-tagging
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Let AI automatically tag memories
                  </p>
                </div>
              </div>
              <Switch checked={autoTagging} onCheckedChange={setAutoTagging} />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border mx-4 sm:mx-0" />

          {/* ── Subscription Section ── */}
          <div className="sticky top-0 z-10 bg-background px-4 sm:px-0 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="size-3.5" />
              Subscription
            </h3>
          </div>
          <div className="px-4 sm:px-0">
            <div className="flex items-center justify-between py-3 min-h-[48px]">
              <div className="flex items-center gap-3">
                <Sparkles className="size-4 text-[#9D8BA7]" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {user?.plan === 'pro' ? 'Bloom (Pro)' : 'Seed (Free)'}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#9D8BA7]/10 text-[#9D8BA7]">
                      Current
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    {user?.plan === 'pro'
                      ? `${memories.length} memories · Unlimited`
                      : `${memories.length} out of 50 memories`}
                  </p>
                </div>
              </div>
            </div>
            {user?.plan !== 'pro' && (
              <div className="mt-2 p-4 rounded-xl bg-[#9D8BA7]/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Crown className="size-4 text-[#9D8BA7] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      Bloom
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Unlimited memories, AI insights, priority support
                    </p>
                  </div>
                </div>
                <Button
                  className="rounded-full text-xs shadow-sm bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shrink-0"
                  size="sm"
                  onClick={handleBloomUpgrade}
                >
                  $6/mo
                </Button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-border mx-4 sm:mx-0" />

          {/* ── Logout Button ── */}
          <div className="px-4 sm:px-0 py-4">
            <button
              onClick={handleLogout}
              className="tap-feedback w-full flex items-center justify-center gap-2 py-3 min-h-[48px] rounded-xl text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-medium"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-border mx-4 sm:mx-0" />

          {/* ── Danger Zone ── */}
          <div className="sticky top-0 z-10 bg-background px-4 sm:px-0 pt-4 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-500 flex items-center gap-2">
              <Trash2 className="size-3.5" />
              Danger Zone
            </h3>
          </div>
          <div className="px-4 sm:px-0 space-y-2 pb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleExportJson}
                disabled={isExportingJson}
                className="tap-feedback flex-1 flex items-center justify-center gap-2 py-3 min-h-[48px] rounded-xl border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isExportingJson ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Export as JSON
                  </>
                )}
              </button>
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="tap-feedback flex-1 flex items-center justify-center gap-2 py-3 min-h-[48px] rounded-xl border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isExportingPdf ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <FileText className="size-4" />
                    Export as PDF
                  </>
                )}
              </button>
            </div>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="tap-feedback w-full flex items-center justify-center gap-2 py-3 min-h-[48px] rounded-xl border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-medium"
            >
              <Trash2 className="size-4" />
              Delete account
            </button>
          </div>
        </div>
      </div>

      {/* ── Delete Account Confirmation Dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All your memories, collections, and
              personal data will be permanently deleted. Are you sure you want to
              proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, delete my account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
