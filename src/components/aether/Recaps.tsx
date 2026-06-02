'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Brain, Calendar, TrendingUp, Clock, Sparkles, Mic, Link2, Image as ImageIcon, FileText, Plus } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { useAetherStore } from '@/store/aether-store'

interface ExtractedTask {
  id: string
  text: string
  completed: boolean
  memoryId: string
}

export function Recaps() {
  const { recapView, setRecapView, memories, setCaptureModalOpen, setCurrentView } = useAetherStore()

  // Extract real tasks from memories using pattern matching
  const extractedTasks = useMemo<ExtractedTask[]>(() => {
    const actionPatterns = [
      /need\s+to\s+(.+)/i,
      /should\s+(.+)/i,
      /must\s+(.+)/i,
      /have\s+to\s+(.+)/i,
      /todo:?\s*(.+)/i,
      /follow\s+up\s+(.+)/i,
      /call\s+(.+)/i,
      /email\s+(.+)/i,
      /schedule\s+(.+)/i,
      /remind\s+me\s+(.+)/i,
      /don'?t\s+forget\s+(.+)/i,
    ]

    const tasks: ExtractedTask[] = []

    for (const mem of memories) {
      const textToSearch = `${mem.title} ${mem.content}`
      for (const pattern of actionPatterns) {
        const match = pattern.exec(textToSearch)
        if (match && match[1]) {
          const taskText = match[1].trim().replace(/[.!;]+$/, '')
          // Only add if meaningful (> 5 chars) and not a duplicate
          if (taskText.length > 5 && !tasks.some(t => t.text.toLowerCase() === taskText.toLowerCase())) {
            tasks.push({
              id: `task-${mem.id}-${tasks.length}`,
              text: taskText.charAt(0).toUpperCase() + taskText.slice(1),
              completed: false,
              memoryId: mem.id,
            })
          }
        }
      }
    }

    return tasks.slice(0, 10) // Cap at 10 tasks
  }, [memories])

  // Track completed task IDs separately
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set())

  const today = new Date()
  const todayStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Today's memories
  const todayMemories = useMemo(() => {
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)
    return memories.filter((m) => new Date(m.createdAt) >= startOfDay)
  }, [memories, today])

  // 5 most recent captures regardless of date (replaces recentMemories)
  const recentCaptures = useMemo(() => {
    return memories.slice(0, 5)
  }, [memories])

  // Memories from exactly 7 days ago
  const lastWeekMemories = useMemo(() => {
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const start = new Date(sevenDaysAgo)
    start.setHours(0, 0, 0, 0)
    const end = new Date(sevenDaysAgo)
    end.setHours(23, 59, 59, 999)
    return memories.filter((m) => {
      const d = new Date(m.createdAt)
      return d >= start && d <= end
    })
  }, [memories, today])

  // Memories from exactly 30 days ago
  const lastMonthMemories = useMemo(() => {
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const start = new Date(thirtyDaysAgo)
    start.setHours(0, 0, 0, 0)
    const end = new Date(thirtyDaysAgo)
    end.setHours(23, 59, 59, 999)
    return memories.filter((m) => {
      const d = new Date(m.createdAt)
      return d >= start && d <= end
    })
  }, [memories, today])

  // Weekly memories — past 7 days
  const weeklyMemories = useMemo(() => {
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    return memories.filter((m) => new Date(m.createdAt) >= sevenDaysAgo)
  }, [memories, today])

  // Derive top themes from real memories
  const topThemes = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const mem of memories) {
      for (const tag of mem.tags) {
        counts[tag] = (counts[tag] || 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [memories])

  // Derive week activity from real memories
  const weekDays = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const counts = [0, 0, 0, 0, 0, 0, 0]
    const now = new Date()
    for (const mem of memories) {
      const memDate = new Date(mem.createdAt)
      const diffDays = Math.floor((now.getTime() - memDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 7) {
        const dayIdx = memDate.getDay() === 0 ? 6 : memDate.getDay() - 1 // Mon=0...Sun=6
        counts[dayIdx]++
      }
    }
    const maxCount = Math.max(...counts, 1)
    return days.map((day, i) => ({
      day,
      activity: counts[i],
      memories: counts[i],
      isHighlight: counts[i] === maxCount && counts[i] > 0,
    }))
  }, [memories])

  const maxActivity = Math.max(...weekDays.map((d) => d.activity), 1)

  // Nostalgic memory - oldest memory
  const nostalgicMemory = useMemo(() => {
    if (memories.length === 0) return { title: 'No memories yet', content: 'Start capturing to see your memory lane.', date: '' }
    const oldest = memories[memories.length - 1]
    return {
      title: oldest.title,
      content: oldest.content,
      date: new Date(oldest.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }
  }, [memories])

  // Dynamic AI Insight based on actual data
  const aiInsight = useMemo(() => {
    if (recentCaptures.length === 0) {
      return 'Nothing to recap yet \u2014 save a few memories and I\u2019ll start surfacing highlights for you'
    }

    if (todayMemories.length === 0) {
      return `You haven\u2019t saved any memories today, but you have ${memories.length} total memor${memories.length === 1 ? 'y' : 'ies'} to revisit`
    }

    // Count today's memories by type
    const typeCounts: Record<string, number> = {}
    const todayTags: string[] = []
    for (const mem of todayMemories) {
      const label = mem.type === 'voice' ? 'voice note' : mem.type === 'link' ? 'link' : mem.type === 'image' ? 'image' : 'note'
      typeCounts[label] = (typeCounts[label] || 0) + 1
      for (const tag of mem.tags) {
        if (!todayTags.includes(tag)) todayTags.push(tag)
      }
    }

    const parts: string[] = []
    const typeParts = Object.entries(typeCounts).map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
    if (typeParts.length > 0) {
      parts.push(`You saved ${typeParts.join(', ')} today`)
    }

    if (todayTags.length > 0) {
      const tagStr = todayTags.slice(0, 3).join(', ')
      parts.push(`touching on ${tagStr}`)
    }

    // Compare with week average
    const weekTotal = weekDays.reduce((sum, d) => sum + d.memories, 0)
    const weekAvg = weekTotal / 7
    if (todayMemories.length > weekAvg + 1) {
      parts.push('you seem to be in a productive flow')
    } else if (todayMemories.length >= 3) {
      parts.push('great momentum today')
    }

    return parts.join(' — ') + '.'
  }, [recentCaptures, todayMemories, memories, weekDays])

  // Most active day - derived from real weekDays data
  const mostActiveDay = useMemo(() => {
    const activeDays = weekDays.filter(d => d.memories > 0)
    if (activeDays.length === 0) {
      return null
    }
    const best = activeDays.reduce((a, b) => a.memories > b.memories ? a : b)
    return best
  }, [weekDays])

  const totalWeekMemories = useMemo(() => weekDays.reduce((sum, d) => sum + d.memories, 0), [weekDays])

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  // Merge extracted tasks with completion state
  const displayTasks = useMemo(() =>
    extractedTasks.map((t) => ({ ...t, completed: completedTaskIds.has(t.id) })),
    [extractedTasks, completedTaskIds]
  )

  const handleCaptureMemory = () => {
    setCurrentView('dashboard')
    setTimeout(() => setCaptureModalOpen(true), 100)
  }

  // Check empty states
  const isDailyEmpty = recentCaptures.length === 0 && displayTasks.length === 0
  const isWeeklyEmpty = totalWeekMemories === 0 && topThemes.length === 0

  // Memory lane items - create a few cards from older memories
  const memoryLaneItems = useMemo(() => {
    if (memories.length === 0) return []
    // Take up to 5 older memories for the lane
    return memories.slice(Math.max(0, memories.length - 5)).reverse().map((mem) => ({
      id: mem.id,
      title: mem.title,
      content: mem.content,
      date: new Date(mem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      type: mem.type,
    }))
  }, [memories])

  return (
    <div className="bg-background flex-1 min-h-0 overflow-y-auto ios-scroll">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8 pb-28 md:pb-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Recaps
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Your memory at a glance
          </p>
        </div>

        {/* Daily/Weekly Toggle - Full width segmented control on mobile */}
        <div className="flex w-full rounded-full p-1 bg-[#9D8BA7]/10 mb-4 sm:mb-6 mx-auto max-w-xs sm:max-w-sm">
          <button
            onClick={() => setRecapView('daily')}
            className={`tap-feedback flex-1 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] ${
              recapView === 'daily'
                ? 'shadow-sm bg-[#9D8BA7] text-white'
                : 'text-foreground active:bg-muted/50'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setRecapView('weekly')}
            className={`tap-feedback flex-1 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] ${
              recapView === 'weekly'
                ? 'shadow-sm bg-[#9D8BA7] text-white'
                : 'text-foreground active:bg-muted/50'
            }`}
          >
            Weekly
          </button>
        </div>

        {recapView === 'daily' ? (
          <motion.div
            key="daily"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3 sm:space-y-5"
          >
            {/* Today's Brief Card */}
            <div className="bg-card rounded-2xl px-3 sm:px-6 py-4 sm:py-5 shadow-sm border border-border">
              <div className="flex items-center gap-3 mb-1">
                <Calendar className="size-5" style={{ color: '#9D8BA7' }} />
                <h2
                  className="text-lg font-bold text-foreground"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Today&apos;s Brief
                </h2>
              </div>
              <p className="text-sm ml-8 text-muted-foreground">
                {todayStr}
              </p>
            </div>

            {/* Empty state for daily view */}
            {isDailyEmpty ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-10 sm:py-16 text-center"
              >
                <div className="size-16 rounded-2xl flex items-center justify-center mb-4 bg-[#9D8BA7]/12">
                  <Brain className="size-8" style={{ color: '#9D8BA7' }} />
                </div>
                <h3
                  className="text-lg font-bold text-foreground mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Nothing to recap yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  Save a few memories and I&apos;ll start surfacing highlights for you
                </p>
                <Button
                  onClick={handleCaptureMemory}
                  className="gap-2 w-full sm:w-auto min-h-[44px] bg-[#9D8BA7] hover:bg-[#9D8BA7]/90 text-white"
                >
                  <Plus className="size-4" />
                  Capture Memory
                </Button>
              </motion.div>
            ) : (
              <>
                {/* Recent Captures */}
                {recentCaptures.length > 0 && (
                  <div>
                    <h3
                      className="text-sm sm:text-lg font-bold mb-2 sm:mb-3 text-foreground"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Recent Captures
                    </h3>
                    <div className="space-y-3">
                      {recentCaptures.map((memory, index) => (
                        <motion.div
                          key={memory.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.08, duration: 0.25 }}
                          className="bg-card rounded-2xl px-3 sm:px-5 py-4 shadow-sm border border-border"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-[#9D8BA7]/12"
                            >
                              {memory.type === 'voice' ? <Mic className="size-4" style={{ color: '#9D8BA7' }} /> : memory.type === 'link' ? <Link2 className="size-4" style={{ color: '#9D8BA7' }} /> : memory.type === 'image' ? <ImageIcon className="size-4" style={{ color: '#9D8BA7' }} /> : <FileText className="size-4" style={{ color: '#9D8BA7' }} />}
                            </div>
                            <div className="min-w-0">
                              <h4
                                className="font-semibold text-sm truncate text-foreground"
                              >
                                {memory.title}
                              </h4>
                              <p
                                className="text-xs mt-0.5 line-clamp-2 text-muted-foreground"
                              >
                                {memory.content}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* From Last Week */}
                {lastWeekMemories.length > 0 && (
                  <div>
                    <h3
                      className="text-sm sm:text-lg font-bold mb-2 sm:mb-3 text-foreground"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      <Clock className="inline size-4 mr-1.5 -mt-0.5" style={{ color: '#9D8BA7' }} />
                      From Last Week
                    </h3>
                    <div className="space-y-3">
                      {lastWeekMemories.map((memory, index) => (
                        <motion.div
                          key={memory.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.08, duration: 0.25 }}
                          className="bg-card rounded-2xl px-3 sm:px-5 py-4 shadow-sm border border-border"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-[#9D8BA7]/12"
                            >
                              {memory.type === 'voice' ? <Mic className="size-4" style={{ color: '#9D8BA7' }} /> : memory.type === 'link' ? <Link2 className="size-4" style={{ color: '#9D8BA7' }} /> : memory.type === 'image' ? <ImageIcon className="size-4" style={{ color: '#9D8BA7' }} /> : <FileText className="size-4" style={{ color: '#9D8BA7' }} />}
                            </div>
                            <div className="min-w-0">
                              <h4
                                className="font-semibold text-sm truncate text-foreground"
                              >
                                {memory.title}
                              </h4>
                              <p
                                className="text-xs mt-0.5 line-clamp-2 text-muted-foreground"
                              >
                                {memory.content}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* From Last Month */}
                {lastMonthMemories.length > 0 && (
                  <div>
                    <h3
                      className="text-sm sm:text-lg font-bold mb-2 sm:mb-3 text-foreground"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      <Clock className="inline size-4 mr-1.5 -mt-0.5" style={{ color: '#9D8BA7' }} />
                      From Last Month
                    </h3>
                    <div className="space-y-3">
                      {lastMonthMemories.map((memory, index) => (
                        <motion.div
                          key={memory.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.08, duration: 0.25 }}
                          className="bg-card rounded-2xl px-3 sm:px-5 py-4 shadow-sm border border-border"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="size-8 rounded-lg flex items-center justify-center shrink-0 bg-[#9D8BA7]/12"
                            >
                              {memory.type === 'voice' ? <Mic className="size-4" style={{ color: '#9D8BA7' }} /> : memory.type === 'link' ? <Link2 className="size-4" style={{ color: '#9D8BA7' }} /> : memory.type === 'image' ? <ImageIcon className="size-4" style={{ color: '#9D8BA7' }} /> : <FileText className="size-4" style={{ color: '#9D8BA7' }} />}
                            </div>
                            <div className="min-w-0">
                              <h4
                                className="font-semibold text-sm truncate text-foreground"
                              >
                                {memory.title}
                              </h4>
                              <p
                                className="text-xs mt-0.5 line-clamp-2 text-muted-foreground"
                              >
                                {memory.content}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Task Reminders */}
                {displayTasks.length > 0 && (
                  <div>
                    <h3
                      className="text-sm sm:text-lg font-bold mb-2 sm:mb-3 text-foreground"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Task Reminders
                    </h3>
                    <div className="bg-card rounded-2xl px-3 sm:px-6 py-4 sm:py-5 shadow-sm border border-border space-y-3">
                      {displayTasks.map((task, index) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1, duration: 0.2 }}
                          className="flex items-center gap-3"
                        >
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={() => toggleTask(task.id)}
                            className="shrink-0"
                          />
                          <span
                            className={`text-sm transition-all text-foreground ${
                              task.completed ? 'line-through opacity-50' : ''
                            }`}
                          >
                            {task.text}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Insight Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="bg-card rounded-2xl px-3 sm:px-6 py-4 sm:py-5 shadow-sm border-l-4"
                  style={{ borderLeftColor: '#9D8BA7' }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-[#9D8BA7]/12"
                    >
                      <Brain className="size-5" style={{ color: '#9D8BA7' }} />
                    </div>
                    <div>
                      <h4
                        className="font-semibold text-sm mb-1"
                        style={{ color: '#9D8BA7' }}
                      >
                        AI Insight
                      </h4>
                      <p className="text-sm leading-relaxed text-foreground">
                        {aiInsight}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="weekly"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3 sm:space-y-5"
          >
            {/* Empty state for weekly view */}
            {isWeeklyEmpty ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-10 sm:py-16 text-center"
              >
                <div className="size-16 rounded-2xl flex items-center justify-center mb-4 bg-[#9D8BA7]/12">
                  <Brain className="size-8" style={{ color: '#9D8BA7' }} />
                </div>
                <h3
                  className="text-lg font-bold text-foreground mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Nothing to recap yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  Save a few memories and I&apos;ll start surfacing highlights for you
                </p>
                <Button
                  onClick={handleCaptureMemory}
                  className="gap-2 w-full sm:w-auto min-h-[44px] bg-[#9D8BA7] hover:bg-[#9D8BA7]/90 text-white"
                >
                  <Plus className="size-4" />
                  Capture Memory
                </Button>
              </motion.div>
            ) : (
              <>
                {/* Week Overview Timeline */}
                <div className="bg-card rounded-2xl px-3 sm:px-6 py-4 sm:py-5 shadow-sm border border-border">
                  <h2
                    className="text-sm sm:text-lg font-bold mb-2 sm:mb-3 text-foreground"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Week Overview
                  </h2>
                  <div className="flex items-end justify-between gap-1 sm:gap-4">
                    {weekDays.map((d) => (
                      <div key={d.day} className="flex flex-col items-center gap-1.5 sm:gap-2 flex-1">
                        <span
                          className={`text-[10px] sm:text-xs font-medium ${d.isHighlight ? 'text-[#9D8BA7]' : 'text-muted-foreground'}`}
                        >
                          {d.memories}
                        </span>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max((d.activity / maxActivity) * 56, 4)}px` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="w-full rounded-t-lg sm:rounded-t-md"
                          style={{
                            backgroundColor: d.isHighlight
                              ? '#9D8BA7'
                              : 'rgba(157, 139, 167, 0.2)',
                            maxWidth: 32,
                          }}
                        />
                        <span
                          className={`text-[10px] sm:text-xs font-medium ${d.isHighlight ? 'font-bold text-[#9D8BA7]' : 'text-muted-foreground'}`}
                        >
                          {d.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Themes */}
                {topThemes.length > 0 && (
                  <div>
                    <h3
                      className="text-sm sm:text-lg font-bold mb-2 sm:mb-3 text-foreground"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      Top Themes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {topThemes.map((theme) => (
                        <span
                          key={theme.name}
                          className="px-3 py-1.5 rounded-full text-sm font-medium min-h-[44px] flex items-center bg-[#9D8BA7]/10 text-foreground"
                        >
                          {theme.name}
                          <span className="ml-1 opacity-50">({theme.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Most Active Day */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="bg-card rounded-2xl px-3 sm:px-6 py-4 sm:py-5 shadow-sm border border-border"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="size-10 rounded-xl flex items-center justify-center shrink-0 bg-[#9D8BA7]/12"
                    >
                      <TrendingUp className="size-5" style={{ color: '#9D8BA7' }} />
                    </div>
                    <div>
                      <h4
                        className="font-semibold text-sm mb-0.5"
                        style={{ color: '#9D8BA7' }}
                      >
                        Most Active Day
                      </h4>
                      <p className="text-sm leading-relaxed text-foreground">
                        {mostActiveDay
                          ? `${mostActiveDay.day} was your most productive day with ${mostActiveDay.memories} memor${mostActiveDay.memories === 1 ? 'y' : 'ies'}`
                          : 'No memories this week yet \u2014 start capturing to see your activity'}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Memory Lane - Horizontally scrollable */}
                {memoryLaneItems.length > 0 && (
                  <div>
                    <h3
                      className="text-sm sm:text-lg font-bold mb-2 sm:mb-3 text-foreground"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      <Sparkles className="inline size-5 mr-1.5 -mt-0.5" style={{ color: '#9D8BA7' }} />
                      Memory Lane
                    </h3>
                    <div className="overflow-x-auto scrollbar-none">
                      <div className="flex gap-3 pb-2">
                        {memoryLaneItems.map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.3 }}
                            className="bg-card rounded-2xl p-5 shadow-sm border border-border min-w-[280px] flex-shrink-0"
                          >
                            <p className="text-xs mb-2 font-medium" style={{ color: '#9D8BA7' }}>
                              {index === 0 ? 'One month ago today...' : `${item.date}`}
                            </p>
                            <h4 className="font-bold text-sm mb-1 text-foreground">
                              {item.title}
                            </h4>
                            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
                              {item.content}
                            </p>
                            <p className="text-xs mt-2 flex items-center gap-1 text-muted-foreground">
                              <Clock className="size-3" />
                              {item.date}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
