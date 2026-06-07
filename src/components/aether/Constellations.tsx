'use client'

import React, { useMemo, useEffect, useRef, useState, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, X } from 'lucide-react'
import { useAetherStore } from '@/store/aether-store'
import type { Memory } from './types'

/* ═══════════════════════════════════════════════════════════════
   FIXED CONSTELLATION CATEGORIES
   5 main constellations — memories auto-sorted by tags
   ═══════════════════════════════════════════════════════════════ */

interface CategoryDefinition {
  id: string
  name: string
  emoji: string
  colorDark: string         // Accent color in dark mode
  colorDarkLight: string    // Lighter variant for dark mode
  colorLight: string        // Accent color in light mode
  colorLightLight: string   // Lighter variant for light mode
  keywords: string[]        // Tags that route memories here
}

const FIXED_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'work',
    name: 'Work',
    emoji: '💼',
    colorDark: '#38bdf8',
    colorDarkLight: '#7dd3fc',
    colorLight: '#0284c7',
    colorLightLight: '#38bdf8',
    keywords: [
      'work', 'school', 'igcse', 'pcbuild', 'meeting', 'coding',
      'code', 'tech', 'learning', 'finance', 'exam', 'study',
      'college', 'assignment', 'deadline', 'office', 'career', 'job',
      'interview', 'resume', 'presentation', 'math', 'science',
      'physics', 'chemistry', 'biology', 'english', 'homework',
      'lecture', 'tutorial', 'certification', 'course', 'training',
      'hackathon', 'github', 'programming', 'software', 'hardware',
      'cpu', 'gpu', 'build',
    ],
  },
  {
    id: 'ideas',
    name: 'Ideas',
    emoji: '💡',
    colorDark: '#c084fc',
    colorDarkLight: '#d8b4fe',
    colorLight: '#9333ea',
    colorLightLight: '#c084fc',
    keywords: [
      'idea', 'creative', 'project', 'design', 'startup', 'ai', 'music',
      'movie', 'book', 'art', 'writing', 'brainstorm', 'innovation',
      'concept', 'draft', 'sketch', 'inspiration', 'prototype', 'palette',
      'compose', 'lyrics', 'script', 'story', 'novel', 'poem',
      'drawing', 'painting', 'photography', 'video', 'animation',
      'ux', 'ui', 'brand', 'logo', 'illustration', 'typography',
    ],
  },
  {
    id: 'personal',
    name: 'Personal',
    emoji: '🌿',
    colorDark: '#4ade80',
    colorDarkLight: '#86efac',
    colorLight: '#16a34a',
    colorLightLight: '#4ade80',
    keywords: [
      'personal', 'health', 'groceries', 'family', 'reminder',
      'fitness', 'friend', 'workout', 'diet', 'doctor', 'appointment',
      'home', 'chores', 'routine', 'hobby', 'pet', 'nature', 'gym',
      'yoga', 'meditation', 'sleep', 'self-care', 'mental', 'wellness',
      'shopping', 'morning', 'evening', 'weekend', 'birthday', 'anniversary',
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    emoji: '✈️',
    colorDark: '#fb923c',
    colorDarkLight: '#fdba74',
    colorLight: '#ea580c',
    colorLightLight: '#fb923c',
    keywords: [
      'travel', 'vacation', 'flight', 'hotel', 'beach', 'trip',
      'airport', 'passport', 'luggage', 'destination', 'tour', 'sightseeing',
      'adventure', 'backpack', 'resort', 'cruise', 'roadtrip', 'hostel',
      'visa', 'itinerary', 'landmark', 'culture', 'explore', 'island',
    ],
  },
  {
    id: 'recipes',
    name: 'Recipes',
    emoji: '🍳',
    colorDark: '#f87171',
    colorDarkLight: '#fca5a5',
    colorLight: '#dc2626',
    colorLightLight: '#f87171',
    keywords: [
      'recipe', 'cooking', 'food', 'baking', 'cook', 'bake', 'meal',
      'lunch', 'dinner', 'breakfast', 'kitchen', 'ingredient', 'cuisine',
      'dish', 'oven', 'stovetop', 'grill', 'seasoning', 'sauce', 'soup',
      'salad', 'dessert', 'cake', 'pastry', 'bread', 'pasta', 'rice',
      'restaurant', 'cafe', 'coffee',
    ],
  },
]

/* ═══════════════════════════════════════════════════════════════
   CATEGORY THEME — per-constellation visual properties
   ═══════════════════════════════════════════════════════════════ */

interface CategoryTheme {
  gradient: string
  gradientLight: string
  starColor: string
  starColorLight: string
  lineColor: string
  lineColorLight: string
  nebulaColor: string
  nebulaColorLight: string
}

const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  work: {
    gradient: 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(103,232,249,0.08) 50%, transparent 100%)',
    gradientLight: 'linear-gradient(135deg, rgba(2,132,199,0.10) 0%, rgba(56,189,248,0.05) 50%, transparent 100%)',
    starColor: '#67e8f9',
    starColorLight: '#374151',
    lineColor: 'rgba(103,232,249,0.4)',
    lineColorLight: 'rgba(2,132,199,0.45)',
    nebulaColor: 'rgba(56,189,248,0.08)',
    nebulaColorLight: 'rgba(56,189,248,0.12)',
  },
  ideas: {
    gradient: 'linear-gradient(135deg, rgba(192,132,252,0.18) 0%, rgba(232,121,249,0.08) 50%, transparent 100%)',
    gradientLight: 'linear-gradient(135deg, rgba(147,51,234,0.10) 0%, rgba(192,132,252,0.05) 50%, transparent 100%)',
    starColor: '#e879f9',
    starColorLight: '#4b5563',
    lineColor: 'rgba(192,132,252,0.4)',
    lineColorLight: 'rgba(147,51,234,0.45)',
    nebulaColor: 'rgba(192,132,252,0.08)',
    nebulaColorLight: 'rgba(192,132,252,0.10)',
  },
  personal: {
    gradient: 'linear-gradient(135deg, rgba(74,222,128,0.18) 0%, rgba(134,239,172,0.08) 50%, transparent 100%)',
    gradientLight: 'linear-gradient(135deg, rgba(22,163,74,0.10) 0%, rgba(74,222,128,0.05) 50%, transparent 100%)',
    starColor: '#4ade80',
    starColorLight: '#374151',
    lineColor: 'rgba(74,222,128,0.4)',
    lineColorLight: 'rgba(22,163,74,0.45)',
    nebulaColor: 'rgba(74,222,128,0.08)',
    nebulaColorLight: 'rgba(74,222,128,0.10)',
  },
  travel: {
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.18) 0%, rgba(253,186,116,0.08) 50%, transparent 100%)',
    gradientLight: 'linear-gradient(135deg, rgba(234,88,12,0.10) 0%, rgba(251,146,60,0.05) 50%, transparent 100%)',
    starColor: '#fdba74',
    starColorLight: '#374151',
    lineColor: 'rgba(251,146,60,0.4)',
    lineColorLight: 'rgba(234,88,12,0.45)',
    nebulaColor: 'rgba(251,146,60,0.08)',
    nebulaColorLight: 'rgba(251,146,60,0.12)',
  },
  recipes: {
    gradient: 'linear-gradient(135deg, rgba(248,113,113,0.18) 0%, rgba(252,165,165,0.08) 50%, transparent 100%)',
    gradientLight: 'linear-gradient(135deg, rgba(220,38,38,0.10) 0%, rgba(248,113,113,0.05) 50%, transparent 100%)',
    starColor: '#fca5a5',
    starColorLight: '#374151',
    lineColor: 'rgba(248,113,113,0.4)',
    lineColorLight: 'rgba(220,38,38,0.45)',
    nebulaColor: 'rgba(248,113,113,0.08)',
    nebulaColorLight: 'rgba(248,113,113,0.12)',
  },
}

/* ═══════════════════════════════════════════════════════════════
   CRITICAL FEATURE 1: categorizeMemories()
   Auto-sorts memories into 5 fixed categories based on tags
   ═══════════════════════════════════════════════════════════════ */

interface CategorizedGroup {
  id: string
  name: string
  emoji: string
  category: CategoryDefinition
  theme: CategoryTheme
  memories: Memory[]
  count: number
}

// Pre-build keyword → categoryId lookup for O(1) matching instead of O(n*m)
const KEYWORD_TO_CATEGORY: Map<string, string> = new Map()
for (const cat of FIXED_CATEGORIES) {
  for (const kw of cat.keywords) {
    KEYWORD_TO_CATEGORY.set(kw, cat.id)
  }
}

function categorizeMemories(memories: Memory[]): CategorizedGroup[] {
  const categoryMap = new Map<string, Memory[]>()

  // Initialize all 5 categories (always shown even if empty)
  for (const cat of FIXED_CATEGORIES) {
    categoryMap.set(cat.id, [])
  }

  for (const mem of memories) {
    let assigned = false

    // Fast path: exact keyword match via lookup map
    if (mem.tags && mem.tags.length > 0) {
      for (const tag of mem.tags) {
        const normalizedTag = tag.toLowerCase().replace(/^#/, '')
        // Direct lookup first (O(1))
        const directMatch = KEYWORD_TO_CATEGORY.get(normalizedTag)
        if (directMatch) {
          categoryMap.get(directMatch)!.push(mem)
          assigned = true
          break
        }
        // Fallback: substring matching (slower, but only for unmatched tags)
        for (const cat of FIXED_CATEGORIES) {
          if (cat.keywords.some(kw => normalizedTag.includes(kw) || kw.includes(normalizedTag))) {
            categoryMap.get(cat.id)!.push(mem)
            assigned = true
            break
          }
        }
        if (assigned) break
      }
    }

    // Unassigned memories default to Personal
    if (!assigned) {
      categoryMap.get('personal')!.push(mem)
    }
  }

  // Build the result array preserving the fixed order
  return FIXED_CATEGORIES.map(cat => ({
    id: cat.id,
    name: cat.name,
    emoji: cat.emoji,
    category: cat,
    theme: CATEGORY_THEMES[cat.id],
    memories: categoryMap.get(cat.id) ?? [],
    count: categoryMap.get(cat.id)?.length ?? 0,
  }))
}

/* ═══════════════════════════════════════════════════════════════
   CRITICAL FEATURE 2: Mock AI Category Recap Generator
   Generates a 2-3 sentence summary of the user's "life" in this area
   ═══════════════════════════════════════════════════════════════ */

function generateCategoryRecap(categoryName: string, memories: Memory[]): string {
  if (memories.length === 0) {
    return `No memories in ${categoryName} yet. Start saving notes, links, or ideas and Aether will paint a picture of your life here.`
  }

  // Extract tag frequencies for this category
  const tagCounts: Record<string, number> = {}
  for (const mem of memories) {
    for (const tag of mem.tags) {
      const t = tag.startsWith('#') ? tag : `#${tag}`
      tagCounts[t] = (tagCounts[t] || 0) + 1
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag)

  // Extract memory type distribution
  const typeBreakdown: Record<string, number> = {}
  for (const mem of memories) {
    typeBreakdown[mem.type] = (typeBreakdown[mem.type] || 0) + 1
  }
  const dominantType = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])[0]
  const typeLabel = dominantType
    ? dominantType[0] === 'voice' ? 'voice notes'
      : dominantType[0] === 'link' ? 'saved links'
        : dominantType[0] === 'image' ? 'images'
          : 'notes'
    : 'memories'

  // Build a contextual 2-3 sentence recap
  const tagPhrase = topTags.length > 0
    ? `You've been mostly focused on ${topTags.join(', ')}.`
    : ''

  const count = memories.length
  const memWord = count === 1 ? 'memory' : 'memories'

  // Category-specific insight templates
  const insights: Record<string, string[]> = {
    work: [
      `Your work life has ${count} ${memWord} tracked. ${tagPhrase} Aether is keeping tabs on your progress and deadlines.`,
      `${count} ${memWord} in your work constellation. ${tagPhrase || 'Your professional life is taking shape.'} Stay on top of it — Aether will surface key details when you need them.`,
    ],
    ideas: [
      `Your creative mind has produced ${count} ${memWord}. ${tagPhrase} The spark is alive — keep capturing those ideas.`,
      `${count} ${memWord} fuel your ideas constellation. ${tagPhrase || 'Your imagination is active.'} Aether connects the dots between your creative thoughts.`,
    ],
    personal: [
      `Your personal life has ${count} ${memWord} captured. ${tagPhrase} Aether helps you stay organized across all areas of your life.`,
      `${count} ${memWord} make up your personal constellation. ${tagPhrase || 'Life is happening and you\'re capturing it.'} From routines to special moments, it's all here.`,
    ],
    travel: [
      `You've saved ${count} travel ${memWord}. ${tagPhrase} Your wanderlust is well-documented — Aether keeps every destination at your fingertips.`,
      `${count} ${memWord} in your travel constellation. ${tagPhrase || 'The world is calling.'} From flight details to hidden gems, Aether remembers every journey.`,
    ],
    recipes: [
      `Your recipe collection has ${count} ${memWord}. ${tagPhrase} Aether keeps your culinary inspiration organized and ready to cook.`,
      `${count} ${memWord} in your recipes constellation. ${tagPhrase || 'Your kitchen adventures await.'} From weeknight dinners to weekend bakes, it's all saved here.`,
    ],
  }

  // Get category-specific insight, fallback to generic
  const categoryId = FIXED_CATEGORIES.find(c => c.name === categoryName)?.id ?? ''
  const categoryInsights = insights[categoryId] ?? [
    `${count} ${memWord} in your ${categoryName} constellation. ${tagPhrase} Aether is learning your patterns.`,
  ]

  return categoryInsights[Math.floor(Math.random() * categoryInsights.length)]
}

/* ═══════════════════════════════════════════════════════════════
   SEEDED RANDOM
   ═══════════════════════════════════════════════════════════════ */

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/* ═══════════════════════════════════════════════════════════════
   STARFIELD CANVAS — DUAL UNIVERSE
   Dark Mode: Interactive twinkling stars with mouse parallax
   Light Mode: Soft drifting clouds on a bright blue sky
   ═══════════════════════════════════════════════════════════════ */

interface CloudData {
  x: number
  y: number
  baseX: number
  baseY: number
  radiusX: number
  radiusY: number
  speed: number
  opacity: number
}

function StarfieldCanvas({ darkMode }: { darkMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const animRef = useRef<number>(0)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let time = 0
    let isVisible = true

    const onVisibility = () => { isVisible = !document.hidden }
    document.addEventListener('visibilitychange', onVisibility)

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMouse)

    const isMobile = window.innerWidth < 768

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    if (darkMode) {
      const STAR_COUNT = isMobile ? 50 : 150
      const rand = seededRandom(777)
      const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
        x: rand() * canvas.width,
        y: rand() * canvas.height,
        baseX: rand() * canvas.width,
        baseY: rand() * canvas.height,
        r: 0.3 + rand() * 1.5,
        opacity: 0.2 + rand() * 0.6,
        twinkleSpeed: 0.01 + rand() * 0.03,
        twinklePhase: rand() * Math.PI * 2,
        parallaxFactor: 0.005 + rand() * 0.015,
      }))

      const draw = () => {
        if (!isVisible) {
          animRef.current = requestAnimationFrame(draw)
          return
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        time++

        const mx = mouseRef.current.x - canvas.width / 2
        const my = mouseRef.current.y - canvas.height / 2

        for (const star of stars) {
          const px = star.baseX + mx * star.parallaxFactor
          const py = star.baseY + my * star.parallaxFactor
          star.x = ((px % canvas.width) + canvas.width) % canvas.width
          star.y = ((py % canvas.height) + canvas.height) % canvas.height

          const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase)
          const opacity = star.opacity * (0.6 + 0.4 * twinkle)

          ctx.beginPath()
          ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
          ctx.fill()

          if (star.r > 1) {
            ctx.beginPath()
            ctx.arc(star.x, star.y, star.r * 3, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.08})`
            ctx.fill()
          }
        }

        animRef.current = requestAnimationFrame(draw)
      }
      draw()
    } else {
      const CLOUD_COUNT = isMobile ? 4 : 6
      const rand = seededRandom(999)
      const clouds: CloudData[] = Array.from({ length: CLOUD_COUNT }, () => {
        const baseX = rand() * canvas.width
        const baseY = rand() * canvas.height * 0.7
        return {
          x: baseX,
          y: baseY,
          baseX,
          baseY,
          radiusX: 80 + rand() * 200,
          radiusY: 40 + rand() * 80,
          speed: 0.15 + rand() * 0.35,
          opacity: 0.15 + rand() * 0.25,
        }
      })

      const draw = () => {
        if (!isVisible) {
          animRef.current = requestAnimationFrame(draw)
          return
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        time++

        for (const cloud of clouds) {
          cloud.x = ((cloud.baseX + time * cloud.speed) % (canvas.width + cloud.radiusX * 4)) - cloud.radiusX * 2

          ctx.save()
          ctx.filter = 'blur(40px)'
          ctx.beginPath()
          ctx.ellipse(cloud.x, cloud.y, cloud.radiusX, cloud.radiusY, 0, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`
          ctx.fill()

          ctx.beginPath()
          ctx.ellipse(cloud.x + cloud.radiusX * 0.3, cloud.y - cloud.radiusY * 0.2, cloud.radiusX * 0.6, cloud.radiusY * 0.5, 0, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity * 0.6})`
          ctx.fill()

          ctx.restore()
        }

        animRef.current = requestAnimationFrame(draw)
      }
      draw()
    }

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [darkMode])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  )
}

/* ═══════════════════════════════════════════════════════════════
   NEBULA BLURS / SUNLIGHT GLOWS — DUAL UNIVERSE
   ═══════════════════════════════════════════════════════════════ */

const NebulaBlurs = memo(function NebulaBlurs({ darkMode }: { darkMode: boolean }) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  const nebulae = useMemo(() => {
    if (darkMode) {
      return [
        { x: '15%', y: '20%', w: 500, h: 400, color: 'rgba(157,139,167,0.08)', delay: 0 },
        { x: '70%', y: '60%', w: 450, h: 350, color: 'rgba(103,232,249,0.06)', delay: 2 },
        { x: '45%', y: '75%', w: 550, h: 300, color: 'rgba(192,132,252,0.07)', delay: 4 },
        { x: '80%', y: '15%', w: 350, h: 280, color: 'rgba(134,239,172,0.04)', delay: 1 },
      ]
    }
    return [
      { x: '75%', y: '5%', w: 600, h: 400, color: 'rgba(251,191,36,0.12)', delay: 0 },
      { x: '60%', y: '15%', w: 500, h: 350, color: 'rgba(255,255,255,0.15)', delay: 2 },
      { x: '30%', y: '35%', w: 400, h: 300, color: 'rgba(253,224,71,0.08)', delay: 4 },
      { x: '85%', y: '45%', w: 350, h: 280, color: 'rgba(255,255,255,0.10)', delay: 1 },
    ]
  }, [darkMode])

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  if (isMobile) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {nebulae.map((neb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: neb.x,
            top: neb.y,
            width: neb.w,
            height: neb.h,
            background: `radial-gradient(ellipse, ${neb.color} 0%, transparent 70%)`,
            filter: 'blur(80px)',
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 8 + i * 2,
            delay: neb.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════
   MINI CONSTELLATION SVG — DUAL UNIVERSE
   ═══════════════════════════════════════════════════════════════ */

interface MiniConstellationProps {
  theme: CategoryTheme
  seed: number
  isHovered: boolean
  darkMode: boolean
}

const MiniConstellationSVG = memo(function MiniConstellationSVG({ theme, seed, isHovered, darkMode }: MiniConstellationProps) {
  const constellation = useMemo(() => {
    const rand = seededRandom(seed)
    const starCount = 3 + Math.floor(rand() * 4)
    const stars = Array.from({ length: starCount }, (_, i) => ({
      x: 15 + rand() * 70,
      y: 15 + rand() * 70,
      r: 1.5 + rand() * 1.5,
      delay: i * 0.3,
    }))

    const lines = []
    for (let i = 0; i < stars.length - 1; i++) {
      lines.push({
        x1: stars[i].x,
        y1: stars[i].y,
        x2: stars[i + 1].x,
        y2: stars[i + 1].y,
        delay: i * 0.5,
      })
    }
    if (rand() > 0.5 && stars.length >= 3) {
      lines.push({
        x1: stars[stars.length - 1].x,
        y1: stars[stars.length - 1].y,
        x2: stars[0].x,
        y2: stars[0].y,
        delay: (stars.length - 1) * 0.5,
      })
    }

    return { stars, lines }
  }, [seed])

  const lineAnimDuration = isHovered ? 1.5 : 3
  const lineColor = darkMode ? theme.lineColor : theme.lineColorLight
  const starColor = darkMode ? theme.starColor : theme.starColorLight
  const outerGlowColor = darkMode ? theme.starColor : theme.starColorLight

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" aria-hidden="true">
      {constellation.lines.map((line, i) => (
        <motion.line
          key={`line-${i}`}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={lineColor}
          strokeWidth={isHovered ? 0.8 : 0.5}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: isHovered ? (darkMode ? 0.8 : 0.9) : (darkMode ? 0.5 : 0.6),
          }}
          transition={{
            pathLength: { duration: lineAnimDuration, delay: line.delay, ease: 'easeInOut' },
            opacity: { duration: 0.5, delay: line.delay },
          }}
          strokeDasharray="100"
          strokeDashoffset="0"
        />
      ))}

      {constellation.stars.map((star, i) => (
        <g key={`star-${i}`}>
          <motion.circle
            cx={star.x}
            cy={star.y}
            r={star.r * 4}
            fill={outerGlowColor}
            initial={{ opacity: 0 }}
            animate={{
              opacity: isHovered ? (darkMode ? 0.2 : 0.15) : (darkMode ? 0.08 : 0.06),
              scale: isHovered ? [1, 1.3, 1] : [1, 1.1, 1],
            }}
            transition={{
              opacity: { duration: 0.5, delay: star.delay },
              scale: { duration: isHovered ? 2 : 4, repeat: Infinity, ease: 'easeInOut', delay: star.delay },
            }}
          />
          <motion.circle
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill={starColor}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.4,
              delay: star.delay,
              ease: 'easeOut',
            }}
          />
        </g>
      ))}
    </svg>
  )
})

/* ═══════════════════════════════════════════════════════════════
   CATEGORY CARD — Fixed constellation card with category theme
   ═══════════════════════════════════════════════════════════════ */

interface CategoryCardProps {
  group: CategorizedGroup
  index: number
  darkMode: boolean
  onClick: () => void
}

const CategoryCard = memo(function CategoryCard({
  group,
  index,
  darkMode,
  onClick,
}: CategoryCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const memoryLabel = group.count === 1 ? '1 memory' : `${group.count} memories`
  const theme = group.theme
  const cat = group.category

  const cardGradient = darkMode ? theme.gradient : theme.gradientLight
  const nebulaColor = darkMode ? theme.nebulaColor : theme.nebulaColorLight
  const accentColor = darkMode ? cat.colorDark : cat.colorLight
  const accentLightColor = darkMode ? cat.colorDarkLight : cat.colorLightLight

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: 0.3 + index * 0.12,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9D8BA7]/40 rounded-xl md:rounded-2xl overflow-hidden min-h-[80px] md:min-h-[200px]"
      aria-label={`${group.name} — ${memoryLabel}`}
    >
      {/* Card background — flat on mobile, glass on desktop */}
      <div
        className="absolute inset-0 rounded-xl md:rounded-2xl transition-all duration-500 backdrop-blur-none md:backdrop-blur-xl"
        style={darkMode
          ? {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }
          : {
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }
        }
      />

      {/* Category gradient overlay — hidden on mobile */}
      <motion.div
        className="hidden md:block absolute inset-0 rounded-2xl"
        style={{ background: cardGradient }}
        animate={{ opacity: isHovered ? 1 : 0.7 }}
        transition={{ duration: 0.4 }}
      />

      {/* Mini constellation SVG — hidden on mobile */}
      <div className="hidden md:block absolute inset-0 opacity-60 group-hover:opacity-90 transition-opacity duration-500">
        <MiniConstellationSVG
          theme={theme}
          seed={group.id.length * 137 + index * 42}
          isHovered={isHovered}
          darkMode={darkMode}
        />
      </div>

      {/* Nebula glow — hidden on mobile */}
      <motion.div
        className="hidden md:block absolute -inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse, ${nebulaColor} 0%, transparent 65%)`,
          filter: 'blur(40px)',
        }}
        animate={{
          opacity: isHovered ? 1 : 0,
          scale: isHovered ? 1.1 : 1,
        }}
        transition={{ duration: 0.6 }}
      />

      {/* Content overlay */}
      <div className="relative z-10 p-3 md:p-4 flex flex-row md:flex-col md:justify-between h-full text-left min-h-[80px] md:min-h-[200px] items-center">
        {/* Emoji + Name + Count — horizontal on mobile */}
        <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-0 flex-1 min-w-0">
          <div
            className="flex items-center justify-center size-10 md:size-12 rounded-xl md:mb-2 md:mb-3 shrink-0 text-lg md:text-xl"
            style={{
              background: `${accentColor}18`,
            }}
          >
            {group.emoji}
          </div>
          <div className="min-w-0">
            <h3
              className={`font-semibold text-sm md:text-lg leading-tight truncate ${darkMode ? 'text-white/90' : 'text-gray-900'}`}
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {group.name}
            </h3>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-white/25' : 'text-gray-500'}`}>
              {group.count === 0 ? 'No memories yet' : `${group.count} ${group.count === 1 ? 'memory' : 'memories'}`}
            </p>
          </div>
        </div>

        {/* Memory count badge */}
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}
        >
          {memoryLabel}
        </span>
      </div>

      {/* Shimmer effect — hidden on mobile */}
      <motion.div
        className="hidden md:block absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: darkMode
            ? 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)'
            : 'linear-gradient(105deg, transparent 40%, rgba(251,191,36,0.15) 45%, rgba(255,255,255,0.4) 50%, rgba(251,191,36,0.15) 55%, transparent 60%)',
          backgroundSize: '200% 100%',
        }}
        animate={{
          backgroundPosition: isHovered ? '200% 0%' : '-100% 0%',
        }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      />
    </motion.button>
  )
})

/* ═══════════════════════════════════════════════════════════════
   CRITICAL FEATURE 2: CONSTELLATION DETAIL SLIDE-OUT PANEL
   + CRITICAL FEATURE 3: AI RECAP + DETAIL FEED
   ═══════════════════════════════════════════════════════════════ */

interface ConstellationPanelProps {
  group: CategorizedGroup | null
  darkMode: boolean
  onClose: () => void
}

function ConstellationPanel({ group, darkMode, onClose }: ConstellationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Recap — computed via useMemo (instant, no fake delays, no render-time setState)
  const recap = useMemo(() => {
    if (!group) return null
    return generateCategoryRecap(group.name, group.memories)
  }, [group])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!group) return null

  const cat = group.category
  const accentColor = darkMode ? cat.colorDark : cat.colorLight

  return (
    <>
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[60]"
        style={{
          background: darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Slide-out panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 bottom-0 z-[60] w-full md:w-[440px] overflow-y-auto ios-scroll backdrop-blur-none md:backdrop-blur-xl shadow-none md:shadow-2xl"
        style={darkMode
          ? {
              background: 'rgba(255,255,255,0.05)',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
            }
          : {
              background: 'rgba(255,255,255,0.7)',
              borderLeft: '1px solid rgba(255,255,255,0.5)',
            }
        }
      >
        {/* Close button */}
        <div className="sticky top-0 z-10 flex justify-end p-4">
          <button
            onClick={onClose}
            className={`cursor-pointer size-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${
              darkMode
                ? 'bg-white/10 hover:bg-white/15 text-white/60 hover:text-white'
                : 'bg-black/5 hover:bg-black/10 text-black/40 hover:text-black/70'
            }`}
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Panel content */}
        <div className="px-4 md:px-6 pb-8 md:pb-10 -mt-2">
          {/* Large emoji + Constellation name */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-4 md:mb-6"
          >
            <div
              className="inline-flex items-center justify-center size-12 md:size-16 rounded-2xl mb-2 md:mb-3 text-2xl md:text-3xl"
              style={{
                background: `${accentColor}15`,
              }}
            >
              {group.emoji}
            </div>
            <h2
              className={`text-xl md:text-3xl font-bold leading-tight ${darkMode ? 'text-white/90' : 'text-sky-900'}`}
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {group.name}
            </h2>
            <p className={`text-sm mt-1 ${darkMode ? 'text-white/30' : 'text-sky-800/50'}`}>
              {group.count} {group.count === 1 ? 'memory' : 'memories'} auto-sorted into this constellation
            </p>
          </motion.div>

          {/* ─── AI RECAP SECTION ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-4 md:mb-8"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className={`size-4 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
              <h3 className={`text-sm font-semibold uppercase tracking-wider ${darkMode ? 'text-purple-400/80' : 'text-purple-700/80'}`}>
                AI Recap
              </h3>
            </div>

            {/* Glowing recap card — instant, no loading delay */}
            <div
              className="rounded-xl md:rounded-2xl p-2.5 md:p-4"
              style={darkMode
                ? {
                    background: 'rgba(147,51,234,0.08)',
                    border: '1px solid rgba(147,51,234,0.15)',
                    boxShadow: '0 0 30px rgba(147,51,234,0.08)',
                  }
                : {
                    background: 'rgba(147,51,234,0.06)',
                    border: '1px solid rgba(147,51,234,0.12)',
                    boxShadow: '0 0 30px rgba(147,51,234,0.05)',
                  }
              }
            >
              <p className={`text-sm leading-relaxed ${darkMode ? 'text-white/70' : 'text-sky-900/70'}`}>
                {recap}
              </p>
            </div>
          </motion.div>

          {/* ─── CRITICAL FEATURE 3: DETAIL FEED ─── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h3 className={`text-xs md:text-sm font-semibold uppercase tracking-wider mb-2 md:mb-3 ${darkMode ? 'text-white/40' : 'text-sky-800/50'}`}>
              Memories in this constellation
            </h3>

            {group.count === 0 ? (
              <div className={`rounded-2xl p-4 md:p-6 text-center ${darkMode ? 'bg-white/3 border border-white/5' : 'bg-white/40 border border-black/5'}`}>
                <p className={`text-sm ${darkMode ? 'text-white/30' : 'text-sky-800/40'}`}>
                  No memories here yet. Start saving with relevant tags and they'll appear automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-420px)] overflow-y-auto ios-scroll pr-1">
                {group.memories.map((memory, i) => (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
                    className={`rounded-xl p-2.5 md:p-3.5 transition-all duration-200 ${
                      darkMode
                        ? 'bg-white/5 hover:bg-white/8 border border-white/5'
                        : 'bg-white/60 hover:bg-white/80 border border-black/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div
                        className={`shrink-0 size-8 rounded-lg flex items-center justify-center text-xs ${
                          darkMode ? 'bg-white/10 text-white/50' : 'bg-black/5 text-black/40'
                        }`}
                      >
                        {memory.type === 'voice' ? '🎤' : memory.type === 'link' ? '🔗' : memory.type === 'image' ? '🖼️' : '📝'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-medium truncate ${darkMode ? 'text-white/80' : 'text-sky-900/80'}`}>
                          {memory.title || 'Untitled'}
                        </h4>
                        <p className={`text-xs mt-0.5 line-clamp-2 ${darkMode ? 'text-white/30' : 'text-sky-800/40'}`}>
                          {memory.content.slice(0, 100)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[10px] ${darkMode ? 'text-white/20' : 'text-sky-800/30'}`}>
                            {new Date(memory.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {/* Show ALL original tags — this is the Detail Feed */}
                          {memory.tags.map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{
                                background: `${accentColor}12`,
                                color: accentColor,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE — DUAL UNIVERSE
   ═══════════════════════════════════════════════════════════════ */

function EmptyConstellation({ darkMode, onCreateClick }: { darkMode: boolean; onCreateClick: () => void }) {
  const outerGlowFill = darkMode ? '#9D8BA7' : '#D97706'
  const dotFill = darkMode ? '#9D8BA7' : '#374151'
  const lineStroke = darkMode ? '#9D8BA7' : '#D97706'
  const backgroundGlow = darkMode
    ? 'radial-gradient(circle, rgba(157,139,167,0.12) 0%, transparent 60%)'
    : 'radial-gradient(circle, rgba(217,119,6,0.10) 0%, transparent 60%)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="flex flex-col items-center justify-center py-16 sm:py-24 px-4 text-center"
    >
      <div className="relative w-48 h-48 sm:w-64 sm:h-64 mb-8">
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden="true">
          {[
            { cx: 100, cy: 40, r: 3, delay: 0 },
            { cx: 55, cy: 80, r: 2.5, delay: 0.3 },
            { cx: 145, cy: 75, r: 2.5, delay: 0.6 },
            { cx: 70, cy: 140, r: 2, delay: 0.9 },
            { cx: 135, cy: 145, r: 2, delay: 1.2 },
            { cx: 100, cy: 165, r: 2.5, delay: 1.5 },
          ].map((star, i) => (
            <g key={`empty-star-${i}`}>
              <motion.circle
                cx={star.cx}
                cy={star.cy}
                r={star.r * 5}
                fill={outerGlowFill}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.05, 0.12, 0.05],
                  scale: [1, 1.3, 1],
                }}
                transition={{
                  duration: 4,
                  delay: star.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <motion.circle
                cx={star.cx}
                cy={star.cy}
                r={star.r}
                fill={dotFill}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: star.delay, ease: 'easeOut' }}
              />
            </g>
          ))}

          {[
            { x1: 100, y1: 40, x2: 55, y2: 80, delay: 0.5 },
            { x1: 100, y1: 40, x2: 145, y2: 75, delay: 0.8 },
            { x1: 55, y1: 80, x2: 70, y2: 140, delay: 1.1 },
            { x1: 145, y1: 75, x2: 135, y2: 145, delay: 1.4 },
            { x1: 70, y1: 140, x2: 100, y2: 165, delay: 1.7 },
            { x1: 135, y1: 145, x2: 100, y2: 165, delay: 2.0 },
          ].map((line, i) => (
            <motion.line
              key={`empty-line-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={lineStroke}
              strokeWidth={0.8}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: darkMode ? 0.35 : 0.45 }}
              transition={{
                pathLength: { duration: 1.5, delay: line.delay, ease: 'easeInOut' },
                opacity: { duration: 0.5, delay: line.delay },
              }}
            />
          ))}
        </svg>

        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: backgroundGlow,
            filter: 'blur(20px)',
          }}
        />
      </div>

      <h3
        className={`text-xl sm:text-2xl font-bold mb-3 ${darkMode ? 'text-white/80' : 'text-sky-900'}`}
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        Your universe is waiting
      </h3>
      <p className={`text-sm sm:text-base max-w-xs mb-8 leading-relaxed ${darkMode ? 'text-white/35' : 'text-sky-800/60'}`}>
        Save your first memory and watch your constellations come to life — auto-sorted by topic.
      </p>

      <motion.button
        onClick={onCreateClick}
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#9D8BA7] to-[#c084fc] hover:from-[#8A7A96] hover:to-[#a76bf0] text-white rounded-xl px-6 py-3 text-sm font-semibold shadow-lg shadow-[#9D8BA7]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#9D8BA7]/30 min-h-[44px]"
      >
        <Plus className="size-4" />
        Save Your First Memory
      </motion.button>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CONSTELLATIONS PAGE COMPONENT — FIXED CATEGORIES
   4 main constellations, auto-sorted by tags
   ═══════════════════════════════════════════════════════════════ */

function ConstellationsInner() {
  const {
    darkMode,
    memories,
    setCurrentView,
    setCaptureModalOpen,
  } = useAetherStore()

  // Panel state for the slide-out
  const [selectedGroup, setSelectedGroup] = useState<CategorizedGroup | null>(null)

  // CRITICAL FEATURE 1: Auto-categorize all memories into 4 fixed constellations
  const categories = useMemo(() => categorizeMemories(memories), [memories])

  const totalMemories = memories.length

  const handleCategoryClick = useCallback((group: CategorizedGroup) => {
    setSelectedGroup(group)
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedGroup(null)
  }, [])

  const handleCaptureClick = useCallback(() => {
    setCurrentView('dashboard')
    setCaptureModalOpen(true)
  }, [setCurrentView, setCaptureModalOpen])

  return (
    <div className={`relative flex-1 min-h-0 overflow-y-auto ios-scroll ${darkMode ? 'bg-[#050505]' : 'bg-gray-50'}`}>
      {/* ─── Desktop Background (hidden on mobile) ─── */}
      <div
        className="hidden md:block absolute inset-0 pointer-events-none"
        style={{
          background: darkMode
            ? 'linear-gradient(180deg, #030308 0%, #070714 40%, #050510 100%)'
            : 'linear-gradient(180deg, #87CEEB 0%, #B0DFF8 30%, #E0F6FF 70%, #F0FAFF 100%)',
          zIndex: 0,
        }}
      />

      <div className="hidden md:block">
        <StarfieldCanvas darkMode={darkMode} />
        <NebulaBlurs darkMode={darkMode} />
      </div>

      {/* ─── Content Layer ─── */}
      <div className="relative max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-8 pb-24 md:pb-0" style={{ zIndex: 10 }}>
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className={`size-4 ${darkMode ? 'text-[#9D8BA7]' : 'text-sky-700/70'}`} />
              <span className={`text-xs font-semibold uppercase tracking-widest ${darkMode ? 'text-[#9D8BA7]/70' : 'text-sky-800/60'}`}>
                Collections
              </span>
            </div>
            <h1
              className={`text-xl md:text-4xl font-bold leading-tight ${darkMode ? 'text-white/90' : 'text-gray-900'}`}
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Your Collections
            </h1>
            <p
              className={`text-sm mt-1 max-w-lg ${darkMode ? 'text-white/35' : 'text-gray-500'}`}
            >
              {totalMemories === 0
                ? 'Save memories with tags and watch your constellations form automatically.'
                : `${totalMemories} ${totalMemories === 1 ? 'memory' : 'memories'} auto-sorted across 5 constellations`
              }
            </p>
          </div>
        </div>

        {/* Content or Empty State */}
        {totalMemories === 0 ? (
          <EmptyConstellation darkMode={darkMode} onCreateClick={handleCaptureClick} />
        ) : (
          <>
            {/* ─── 5 FIXED CONSTELLATION CARDS ─── */}
            {/* 2x2+1 grid on desktop, single column on mobile */}
            <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
              <AnimatePresence>
                {categories.map((group, index) => (
                  <CategoryCard
                    key={group.id}
                    group={group}
                    index={index}
                    darkMode={darkMode}
                    onClick={() => handleCategoryClick(group)}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* ─── Quick Stats Bar ─── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="mt-4 md:mt-8"
            >
              <div
                className={`rounded-xl md:rounded-2xl p-3 md:p-4 ${
                  darkMode
                    ? 'bg-gray-900 border border-gray-800'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className={`size-3.5 ${darkMode ? 'text-[#9D8BA7]/60' : 'text-sky-700/50'}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-white/40' : 'text-sky-800/50'}`}>
                    Distribution
                  </span>
                </div>
                <div className="flex gap-2 md:gap-4">
                  {categories.map(cat => {
                    const percentage = totalMemories > 0 ? Math.round((cat.count / totalMemories) * 100) : 0
                    const accent = darkMode ? cat.category.colorDark : cat.category.colorLight
                    return (
                      <div key={cat.id} className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-sm">{cat.emoji}</span>
                          <span className={`text-[11px] font-medium truncate ${darkMode ? 'text-white/50' : 'text-sky-800/50'}`}>
                            {cat.name.split(' / ')[0]}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: accent }}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: 1.2, duration: 0.8, ease: 'easeOut' }}
                          />
                        </div>
                        <span className={`text-[10px] mt-1 block ${darkMode ? 'text-white/25' : 'text-sky-800/35'}`}>
                          {cat.count} {cat.count === 1 ? 'memory' : 'memories'} · {percentage}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* ─── CONSTELLATION DETAIL SLIDE-OUT PANEL ─── */}
      <AnimatePresence>
        {selectedGroup && (
          <ConstellationPanel
            group={selectedGroup}
            darkMode={darkMode}
            onClose={handleClosePanel}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTED WRAPPER — Dynamic import safe
   ═══════════════════════════════════════════════════════════════ */

export default function Constellations() {
  return <ConstellationsInner />
}
