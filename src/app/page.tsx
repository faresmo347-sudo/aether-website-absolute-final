'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Menu, X } from 'lucide-react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { useAetherStore } from '@/store/aether-store'
import { createClient, isSupabaseConfigured, hasValidSession } from '@/lib/supabase/client'
import { getProfile, fetchMemories, fetchCollections } from '@/lib/supabase/data'
import { initOfflineDB, getCachedMemories, getCachedCollections, getSyncQueueCount } from '@/lib/offline-db'
import { syncAll, onSyncStatus, onSyncComplete } from '@/lib/sync-engine'
import AppShell from '@/components/aether/AppShell'
import Dashboard from '@/components/aether/Dashboard'
import { MemoryDetail } from '@/components/aether/MemoryDetail'
import { AskAether } from '@/components/aether/AskAether'
import { Collections } from '@/components/aether/Collections'
import { Recaps } from '@/components/aether/Recaps'
import { Settings } from '@/components/aether/Settings'
import { SignUp, SignIn, ForgotPassword } from '@/components/aether/Auth'
import { AetherLogo } from '@/components/aether/AetherLogo'
import type { AppView } from '@/components/aether/types'

/* ═══════════════════════════════════════════════════════════════
   ANIMATED BACKGROUND — Canvas with floating gradient orbs
   ═══════════════════════════════════════════════════════════════ */

function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Skip canvas animation if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let time = 0
    let isVisible = true

    const isMobile = window.innerWidth < 768

    // Pause animation when page is not visible to save CPU/battery
    const onVisibilityChange = () => {
      isVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Use fewer, smaller orbs on mobile for performance
    const orbs = isMobile
      ? [
          { x: 0.3, y: 0.4, r: 150, color: 'rgba(157, 139, 167, 0.06)', speed: 0.0003, phase: 0 },
          { x: 0.7, y: 0.6, r: 140, color: 'rgba(224, 242, 241, 0.08)', speed: 0.0004, phase: 1.5 },
        ]
      : [
          { x: 0.2, y: 0.3, r: 300, color: 'rgba(157, 139, 167, 0.08)', speed: 0.0003, phase: 0 },
          { x: 0.8, y: 0.6, r: 250, color: 'rgba(224, 242, 241, 0.15)', speed: 0.0004, phase: 1.5 },
          { x: 0.5, y: 0.8, r: 350, color: 'rgba(157, 139, 167, 0.05)', speed: 0.0002, phase: 3 },
          { x: 0.3, y: 0.7, r: 200, color: 'rgba(224, 242, 241, 0.1)', speed: 0.0005, phase: 4.5 },
          { x: 0.7, y: 0.2, r: 280, color: 'rgba(184, 168, 196, 0.06)', speed: 0.00035, phase: 2 },
        ]

    const draw = () => {
      if (!isVisible) {
        animationId = requestAnimationFrame(draw)
        return
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time++

      orbs.forEach((orb) => {
        const x = canvas.width * orb.x + Math.sin(time * orb.speed + orb.phase) * 80
        const y = canvas.height * orb.y + Math.cos(time * orb.speed * 0.7 + orb.phase) * 60

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, orb.r)
        gradient.addColorStop(0, orb.color)
        gradient.addColorStop(1, 'transparent')

        ctx.beginPath()
        ctx.arc(x, y, orb.r, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      })

      animationId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}

/* ═══════════════════════════════════════════════════════════════
   FLOATING PARTICLES — Deterministic seeded PRNG for SSR safety
   ═══════════════════════════════════════════════════════════════ */

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function FloatingParticles() {
  // Responsive particle count: 8 on mobile, 15 on desktop
  // SSR-safe: defaults to 8, updates on client via resize subscription
  const [count, setCount] = useState(8)

  useEffect(() => {
    const updateCount = () => setCount(window.innerWidth < 768 ? 8 : 15)
    updateCount()
    window.addEventListener('resize', updateCount)
    return () => window.removeEventListener('resize', updateCount)
  }, [])

  const particles = useMemo(() => {
    const rand = seededRandom(42)
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: rand() * 4 + 2,
      duration: rand() * 10 + 10,
      delay: rand() * 5,
      opacity: rand() * 0.3 + 0.1,
    }))
  }, [count])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: '#9D8BA7',
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, p.id % 2 === 0 ? 10 : -10, 0],
            opacity: [p.opacity, p.opacity * 1.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════════════ */

function Navbar({ onEnterApp }: { onEnterApp: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#pricing', label: 'Pricing' },
  ]

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#FFFAF5]/90 backdrop-blur-xl shadow-sm border-b border-[#1a1a2e]/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <AetherLogo size={36} showText />
        </div>

        {/* Nav Links (Desktop) */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-[#1a1a2e]/60 hover:text-[#9D8BA7] transition-colors">{link.label}</a>
          ))}
        </div>

        {/* Right side: CTA + Hamburger */}
        <div className="flex items-center gap-3">
          {/* CTA — always visible */}
          <button
            onClick={onEnterApp}
            className="bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-full px-4 sm:px-5 py-2 text-sm font-medium shadow-lg shadow-[#9D8BA7]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#9D8BA7]/30"
          >
            Enter Aether
          </button>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden h-10 w-10 rounded-xl flex items-center justify-center text-[#1a1a2e]/70 hover:bg-[#1a1a2e]/5 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu slide-down */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-[#1a1a2e]/5 bg-[#FFFAF5]/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-base text-[#1a1a2e]/70 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 transition-colors min-h-[44px] flex items-center"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════════════════════ */

function HeroSection({ onEnterApp }: { onEnterApp: () => void }) {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 150])
  const opacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <motion.section style={{ y, opacity }} className="relative min-h-screen flex items-center justify-center pt-12 sm:pt-16">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-[#9D8BA7]/15 rounded-full px-4 py-1.5 mb-4 sm:mb-8 shadow-sm"
        >
          <span className="h-2 w-2 rounded-full bg-[#9D8BA7] animate-pulse" />
          <span className="text-xs font-medium text-[#1a1a2e]/70">Your AI-powered second brain</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#1a1a2e] leading-[1.05] tracking-tight mb-3 sm:mb-6"
        >
          Forget{' '}
          <span className="bg-gradient-to-r from-[#9D8BA7] via-[#B8A8C4] to-[#9D8BA7] bg-clip-text text-transparent animate-gradient">
            forgetting
          </span>
          .
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-base sm:text-lg md:text-xl text-[#1a1a2e]/50 max-w-2xl mx-auto mb-4 sm:mb-8 leading-relaxed"
        >
          Aether remembers everything — so you don&apos;t have to. Capture ideas, voice notes, links, and more. 
          Retrieve any memory instantly with natural language AI search.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={onEnterApp}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-full px-8 py-4 text-base font-medium shadow-xl shadow-[#9D8BA7]/25 transition-all duration-300 hover:shadow-2xl hover:shadow-[#9D8BA7]/35 hover:-translate-y-1"
          >
            Enter Aether
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 text-[#1a1a2e]/60 hover:text-[#9D8BA7] text-base font-medium transition-colors duration-300 group"
          >
            See how it works
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6"/></svg>
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-6 sm:mt-12 flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-[#1a1a2e]/30"
        >
          <div className="hidden xs:flex -space-x-2">
            {['A', 'S', 'M', 'J'].map((initial, i) => (
              <div
                key={i}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-2 border-[#FFFAF5] flex items-center justify-center text-[10px] sm:text-xs font-semibold text-white"
                style={{ backgroundColor: ['#9D8BA7', '#B8A8C4', '#7A6B85', '#6D597A'][i] }}
              >
                {initial}
              </div>
            ))}
          </div>
          <span>Trusted by 2,000+ thinkers</span>
        </motion.div>
      </div>
    </motion.section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES GRID
   ═══════════════════════════════════════════════════════════════ */

const features = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
    ),
    title: 'Voice Capture',
    description: 'Record thoughts on the go. Aether transcribes and understands your voice notes automatically.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    ),
    title: 'AI Search',
    description: 'Ask questions in natural language. Find any memory instantly, even if you forgot how you saved it.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    ),
    title: 'Smart Connections',
    description: 'Aether connects related memories automatically, revealing patterns and insights you might have missed.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>
    ),
    title: 'Auto Summaries',
    description: 'Every memory gets an AI-generated summary. Get the gist without re-reading everything.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
    ),
    title: 'Collections & Tags',
    description: 'Organize memories your way with collections and smart auto-tagging powered by AI.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
    ),
    title: 'Daily & Weekly Recaps',
    description: 'Never lose a thought. Get intelligent recaps that surface what matters most from your memories.',
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="relative py-12 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-12"
        >
          <span className="inline-block text-xs font-semibold text-[#9D8BA7] uppercase tracking-widest mb-3">Features</span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#1a1a2e] mb-4">
            Everything your brain needs
          </h2>
          <p className="text-[#1a1a2e]/50 text-base sm:text-lg max-w-2xl mx-auto">
            Capture, connect, and retrieve — Aether handles the rest.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group bg-white/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-[#1a1a2e]/5 shadow-sm hover:shadow-lg md:hover:-translate-y-1 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-[#9D8BA7]/10 flex items-center justify-center text-[#9D8BA7] mb-4 group-hover:bg-[#9D8BA7]/15 group-hover:scale-110 transition-all duration-300">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-[#1a1a2e] mb-2">{feature.title}</h3>
              <p className="text-sm text-[#1a1a2e]/50 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════════ */

const steps = [
  {
    step: '01',
    title: 'Capture anything',
    description: 'Voice notes, text, links, images — save it all in seconds. Aether handles the rest.',
    icon: 'mic',
  },
  {
    step: '02',
    title: 'AI understands',
    description: 'Aether reads, summarizes, tags, and connects your memories automatically.',
    icon: 'brain',
  },
  {
    step: '03',
    title: 'Retrieve instantly',
    description: 'Ask in natural language. Aether finds exactly what you need, when you need it.',
    icon: 'sparkles',
  },
]

const stepIconMap: Record<string, React.ReactNode> = {
  mic: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
  ),
  brain: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>
  ),
  sparkles: (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
  ),
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-12 sm:py-24 bg-white/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-12"
        >
          <span className="inline-block text-xs font-semibold text-[#9D8BA7] uppercase tracking-widest mb-3">How It Works</span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-[#1a1a2e] mb-4">
            Three steps to a perfect memory
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ delay: i * 0.2, duration: 0.6 }}
              className="relative text-center"
            >
              {/* Connector line (desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-[2px] bg-gradient-to-r from-[#9D8BA7]/20 to-[#9D8BA7]/5" />
              )}

              {/* Step number + icon */}
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="h-16 w-16 sm:h-24 sm:w-24 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/10 to-[#9D8BA7]/5 flex items-center justify-center">
                  {stepIconMap[step.icon]}
                </div>
                <span className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-[#9D8BA7] text-white text-xs font-bold flex items-center justify-center shadow-lg shadow-[#9D8BA7]/30">
                  {step.step}
                </span>
              </div>

              <h3 className="text-xl font-bold text-[#1a1a2e] mb-3">{step.title}</h3>
              <p className="text-sm text-[#1a1a2e]/50 leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AI CHAT DEMO
   ═══════════════════════════════════════════════════════════════ */

function AiChatDemo() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const sampleConversation = [
    { role: 'user' as const, text: 'What ideas did I save this week?' },
    {
      role: 'ai' as const,
      text: 'You saved 3 ideas this week! The most notable was about a "Fintech for Artisans" platform with micro-lending integration — you recorded it as a voice note on Wednesday. You also had an insight about building a graph-based memory view, and saved a link about AI in knowledge management.',
    },
  ]

  const handleDemoClick = useCallback(() => {
    if (messages.length > 0 || isTyping) return

    setMessages([{ role: 'user', text: sampleConversation[0].text }])
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      setMessages(sampleConversation)
    }, 2000)
  }, [messages.length, isTyping])

  return (
    <section className="relative py-12 sm:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-12"
        >
          <span className="inline-block text-xs font-semibold text-[#9D8BA7] uppercase tracking-widest mb-3">Ask Aether</span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#1a1a2e] mb-4">
            Your memories, one question away
          </h2>
          <p className="text-[#1a1a2e]/50 text-base sm:text-lg max-w-2xl mx-auto">
            Ask in natural language and Aether retrieves the right memory instantly.
          </p>
        </motion.div>

        {/* Chat Window */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px', amount: 0.2 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-[#9D8BA7]/10 border border-[#1a1a2e]/5 overflow-hidden max-w-2xl mx-2 sm:mx-auto"
        >
          {/* Window header */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[#1a1a2e]/5 bg-[#FFFAF5]">
            <AetherLogo size={32} />
            <div>
              <p className="text-sm font-semibold text-[#1a1a2e]">Aether</p>
              <p className="text-xs text-[#1a1a2e]/40">AI Search</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium">Online</span>
            </div>
          </div>

          {/* Chat messages area */}
          <div className="p-4 sm:p-6 min-h-[180px] sm:min-h-[280px] max-h-[400px] overflow-y-auto space-y-4">
            {messages.length === 0 && !isTyping && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-[#1a1a2e]/30 text-sm mb-4">Click to see Aether in action</p>
                <button
                  onClick={handleDemoClick}
                  className="bg-[#9D8BA7]/10 hover:bg-[#9D8BA7]/20 text-[#9D8BA7] rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-300"
                >
                  &ldquo;What ideas did I save this week?&rdquo;
                </button>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#9D8BA7] text-white rounded-br-md'
                      : 'bg-[#FFFAF5] text-[#1a1a2e] border border-[#1a1a2e]/5 rounded-bl-md'
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#FFFAF5] border border-[#1a1a2e]/5 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-[#9D8BA7]/40"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-[#1a1a2e]/5 bg-white/50">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Aether anything..."
                className="flex-1 bg-[#FFFAF5] border border-[#1a1a2e]/5 rounded-full px-4 py-2.5 sm:py-3 text-sm text-[#1a1a2e] placeholder:text-[#1a1a2e]/30 focus:outline-none focus:border-[#9D8BA7]/30 transition-colors min-h-[44px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDemoClick()
                }}
              />
              <button
                onClick={handleDemoClick}
                className="h-10 w-10 rounded-full bg-[#9D8BA7] text-white flex items-center justify-center hover:bg-[#7A6B85] transition-colors shadow-lg shadow-[#9D8BA7]/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════════════════════ */

const testimonials = [
  {
    quote: "I used to have 47 different note apps. Now I just talk to Aether and it remembers everything. It's like having a conversation with my own brain.",
    author: 'Alex Chen',
    role: 'Startup Founder',
    initials: 'AC',
  },
  {
    quote: "The AI search is insane. I asked 'what was that recipe my friend recommended?' and it found it instantly from a voice note 3 months ago.",
    author: 'Sarah Miller',
    role: 'Product Designer',
    initials: 'SM',
  },
  {
    quote: "My weekly recaps have become the highlight of my Sunday. Aether surfaces connections between my ideas I never would have made myself.",
    author: 'David Park',
    role: 'Creative Director',
    initials: 'DP',
  },
]

function TestimonialsSection() {
  return (
    <section className="relative py-12 sm:py-24 bg-white/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-12"
        >
          <span className="inline-block text-xs font-semibold text-[#9D8BA7] uppercase tracking-widest mb-3">Testimonials</span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#1a1a2e] mb-4">
            People love their second brain
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-[#1a1a2e]/5 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <svg key={j} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#9D8BA7" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ))}
              </div>

              <p className="text-sm text-[#1a1a2e]/70 leading-relaxed mb-3 sm:mb-6 italic">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center text-white text-xs font-bold">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a2e]">{t.author}</p>
                  <p className="text-xs text-[#1a1a2e]/40">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PRICING
   ═══════════════════════════════════════════════════════════════ */

function PricingSection({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <section id="pricing" className="relative py-12 sm:py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-12"
        >
          <span className="inline-block text-xs font-semibold text-[#9D8BA7] uppercase tracking-widest mb-3">Pricing</span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#1a1a2e] mb-4">
            Start free, grow forever
          </h2>
          <p className="text-[#1a1a2e]/50 text-base sm:text-lg max-w-2xl mx-auto">
            No credit card required. Upgrade when you&apos;re ready.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
          {/* Seed Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px', amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-[#1a1a2e]/5 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="font-serif text-2xl font-bold text-[#1a1a2e] mb-1">Seed</h3>
              <p className="text-sm text-[#1a1a2e]/40">Get started for free</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-[#1a1a2e]">$0</span>
              <span className="text-[#1a1a2e]/40 text-sm">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {['50 memories/month', 'Basic AI search', 'Text & voice capture', 'Daily recaps'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#1a1a2e]/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={onEnterApp}
              className="w-full py-3 rounded-xl border border-[#1a1a2e]/10 text-[#1a1a2e]/70 font-medium text-sm hover:bg-[#9D8BA7]/5 hover:border-[#9D8BA7]/20 transition-all duration-300"
            >
              Get Started Free
            </button>
          </motion.div>

          {/* Bloom Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px', amount: 0.2 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative bg-gradient-to-br from-[#9D8BA7]/10 to-[#9D8BA7]/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-[#9D8BA7]/20 shadow-xl shadow-[#9D8BA7]/10"
          >
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#9D8BA7] text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg shadow-[#9D8BA7]/30">
              Most Popular
            </div>

            <div className="mb-6">
              <h3 className="font-serif text-2xl font-bold text-[#1a1a2e] mb-1">Bloom</h3>
              <p className="text-sm text-[#1a1a2e]/40">Unlimited memory power</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-[#1a1a2e]">$6</span>
              <span className="text-[#1a1a2e]/40 text-sm">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              {['Unlimited memories', 'Advanced AI search & insights', 'All capture types', 'Daily & weekly recaps', 'Priority support', 'Smart connections'].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-[#1a1a2e]/60">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={onEnterApp}
              className="w-full py-3 rounded-xl bg-[#9D8BA7] hover:bg-[#7A6B85] text-white font-medium text-sm shadow-lg shadow-[#9D8BA7]/20 hover:shadow-xl hover:shadow-[#9D8BA7]/30 transition-all duration-300"
            >
              Start Bloom Plan
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FINAL CTA
   ═══════════════════════════════════════════════════════════════ */

function CtaSection({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <section className="relative py-12 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center bg-gradient-to-br from-[#9D8BA7]/10 via-[#9D8BA7]/5 to-[#E0F2F1]/20 rounded-2xl sm:rounded-3xl p-6 sm:p-12 md:p-16 border border-[#9D8BA7]/10"
        >
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#1a1a2e] mb-4">
            Ready to never forget again?
          </h2>
          <p className="text-[#1a1a2e]/50 text-base sm:text-lg max-w-xl mx-auto mb-6 sm:mb-8">
            Join thousands of thinkers who trust Aether as their second brain.
          </p>
          <button
            onClick={onEnterApp}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-full px-10 py-4 text-lg font-medium shadow-xl shadow-[#9D8BA7]/25 transition-all duration-300 hover:shadow-2xl hover:shadow-[#9D8BA7]/35 hover:-translate-y-1"
          >
            Enter Aether
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </motion.div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-[#1a1a2e]/5 bg-white/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AetherLogo size={32} showText />
          </div>

          <div className="flex items-center gap-6 text-sm text-[#1a1a2e]/40">
            <a href="#features" className="hover:text-[#9D8BA7] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#9D8BA7] transition-colors">Pricing</a>
            <a href="#" className="hover:text-[#9D8BA7] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#9D8BA7] transition-colors">Terms</a>
          </div>

          <p className="text-xs text-[#1a1a2e]/30">
            Made with care in San Francisco, CA
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE — Full page with all sections
   ═══════════════════════════════════════════════════════════════ */

function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FFFAF5] text-[#1a1a2e]">
      {/* Animated Canvas Background */}
      <div className="fixed inset-0 pointer-events-none">
        <AnimatedBackground />
      </div>

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Navbar */}
      <Navbar onEnterApp={onEnterApp} />

      {/* Hero */}
      <HeroSection onEnterApp={onEnterApp} />

      {/* Features */}
      <FeaturesSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* AI Chat Demo */}
      <AiChatDemo />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Pricing */}
      <PricingSection onEnterApp={onEnterApp} />

      {/* CTA */}
      <CtaSection onEnterApp={onEnterApp} />

      {/* Footer — mt-auto pushes it to bottom when content is short */}
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   APP CONTENT ROUTER
   ═══════════════════════════════════════════════════════════════ */

function AppContent() {
  const { currentView } = useAetherStore()

  switch (currentView) {
    case 'dashboard':
      return <Dashboard />
    case 'memory-detail':
      return <MemoryDetail />
    case 'ask-aether':
      return <AskAether />
    case 'collections':
      return <Collections />
    case 'recaps':
      return <Recaps />
    case 'settings':
      return <Settings />
    default:
      return <Dashboard />
  }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE — Routes between Landing, Auth, and App
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   LOADING SPLASH — Only shown during session transitions, NEVER on initial load
   ═══════════════════════════════════════════════════════════════ */
function LoadingSplash() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#FFFAF5' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse">
          <AetherLogo size={64} />
        </div>
        <p className="text-sm text-[#1a1a2e]/40 font-medium">Loading...</p>
      </div>
    </div>
  )
}

export default function Home() {
  const {
    currentView,
    setCurrentView,
    darkMode,
    isAuthenticated,
    setUser,
    setProfile,
    setMemories,
    setCollections,
    setIsLoadingMemories,
    setIsSyncing,
    setPendingSyncCount,
    setLastSyncedAt,
    updateMemory,
    authScreen,
    setAuthScreen,
    setSelectedMemoryId,
  } = useAetherStore()

  // URL-based navigation: read the current URL path to determine which view to show.
  // This ensures that direct links like /dashboard, /ask, /collections work correctly.
  // The middleware rewrites all paths to / but the browser URL stays the same,
  // so we can read window.location.pathname to determine the desired view.
  const navigateFromUrl = useCallback(() => {
    if (typeof window === 'undefined') return
    const path = window.location.pathname.replace(/\/$/, '') // remove trailing slash

    const urlToViewMap: Record<string, AppView> = {
      '/dashboard': 'dashboard',
      '/ask': 'ask-aether',
      '/collections': 'collections',
      '/recaps': 'recaps',
      '/settings': 'settings',
      '/signup': 'signup',
      '/signin': 'signin',
      '/forgot-password': 'forgot-password',
    }

    const view = urlToViewMap[path]
    if (view) {
      // For auth views, also update the auth screen
      if (view === 'signup' || view === 'signin' || view === 'forgot-password') {
        setAuthScreen(view === 'forgot-password' ? 'forgot' : view)
      }
      return view
    }

    // Check for memory detail URL pattern: /memory/{id}
    if (path.startsWith('/memory/')) {
      const memoryId = path.replace('/memory/', '')
      if (memoryId) {
        setSelectedMemoryId(memoryId)
        return 'memory-detail'
      }
    }

    return null
  }, [setAuthScreen, setSelectedMemoryId])

  // Track whether initial data has been loaded for this session
  const dataLoadedRef = useRef(false)

  // Initialize dark mode from store on mount
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Load user data from Supabase — called once per auth session
  const loadUserData = useCallback(async (userId: string) => {
    if (dataLoadedRef.current) return
    dataLoadedRef.current = true

    setIsLoadingMemories(true)
    try {
      const profile = await getProfile(userId)
      if (profile) {
        setUser(profile)
        setProfile(profile)
      }
      try {
        const [memResult, collections] = await Promise.all([
          fetchMemories(0),
          fetchCollections(),
        ])
        setMemories(memResult.memories)
        setCollections(collections)
      } catch (err) {
        // Network error — fall back to cached data from IndexedDB
        console.warn('Failed to fetch from Supabase, loading from cache:', err)
        try {
          const [cachedMems, cachedCols] = await Promise.all([
            getCachedMemories(),
            getCachedCollections(),
          ])
          if (cachedMems.length > 0) setMemories(cachedMems)
          if (cachedCols.length > 0) setCollections(cachedCols)
        } catch {
          // IndexedDB also failed — nothing we can do
        }
      }
    } catch (err) {
      console.error('Failed to load user data:', err)
      // Don't block the user from using the app if data load fails
    } finally {
      setIsLoadingMemories(false)
    }
  }, [setUser, setProfile, setMemories, setCollections, setIsLoadingMemories])

  // ═══════════════════════════════════════════════════════════════════
  // AUTH INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════
  // CRITICAL DESIGN: The landing page MUST render immediately on first load.
  // Auth checks run in the background and only redirect if a session is found.
  // There is NO loading screen gate on initial load — ever.
  //
  // SPEED OPTIMIZATION: If auth cookies exist (hasValidSession()), we show
  // the dashboard INSTANTLY before any async calls. getSession(), getUser(),
  // and loadUserData() all run in the background. If the session turns out
  // to be expired, we redirect gracefully to signin.
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Initialize offline IndexedDB (non-blocking)
    initOfflineDB().catch((err) => console.warn('Failed to init offline DB:', err))

    // Listen for sync events
    const unsubStatus = onSyncStatus((status) => {
      setIsSyncing(status === 'syncing')
    })
    const unsubComplete = onSyncComplete((result) => {
      getSyncQueueCount().then(setPendingSyncCount)
      if (result.synced > 0) {
        setLastSyncedAt(new Date().toISOString())
      }
    })

    // Listen for memory synced events (temp ID -> real ID replacement)
    const handleMemorySynced = ((e: CustomEvent) => {
      const { tempId, realId, memory } = e.detail
      updateMemory(tempId, { id: realId, syncStatus: 'synced', ...memory })
    }) as EventListener
    window.addEventListener('aether:memory-synced', handleMemorySynced)

    // ─── If Supabase isn't configured, skip auth entirely ───
    if (!isSupabaseConfigured()) {
      console.info('[Aether] Supabase not configured — showing landing page. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable auth.')
      // Check if URL points to a specific view, otherwise landing is already showing
      const urlView = navigateFromUrl()
      if (urlView) {
        setCurrentView(urlView)
      }
      return () => {
        unsubStatus()
        unsubComplete()
        window.removeEventListener('aether:memory-synced', handleMemorySynced)
      }
    }

    // ─── Supabase is configured — check auth in background ───
    const supabase = createClient()
    let mounted = true
    let authResolved = false
    let fastPathUsed = false

    // Helper: resolve auth to a view (prevents double-redirects)
    const resolveAuth = (view: AppView) => {
      if (!mounted || authResolved) return
      authResolved = true
      clearTimeout(timeoutId)
      setCurrentView(view)
    }

    // ─── 1.5-SECOND HARD TIMEOUT: force landing page if auth hangs ───
    // Reduced from 3s — if auth hasn't resolved in 1.5s the user is likely
    // not signed in, and showing the landing page quickly is better than waiting.
    const timeoutId = setTimeout(() => {
      if (!authResolved && mounted) {
        console.warn('[Aether] Auth check timed out after 1.5s — showing landing page')
        authResolved = true
        // If fast-path showed dashboard but auth never confirmed, revert
        if (fastPathUsed) {
          setUser(null)
          setProfile({ name: '', email: '', initials: '' })
        }
        const urlView = navigateFromUrl()
        if (urlView === 'signup' || urlView === 'signin' || urlView === 'forgot-password') {
          setCurrentView(urlView)
        } else {
          setCurrentView('landing')
        }
      }
    }, 1500)

    // ─── FAST PATH: Synchronous cookie check ───
    // If Supabase auth cookies exist, show the dashboard IMMEDIATELY
    // without waiting for any async getSession()/getUser() calls.
    // The async checkAuth validates the session afterwards — if it's
    // expired we redirect gracefully to signin.
    if (hasValidSession()) {
      fastPathUsed = true
      const urlView = navigateFromUrl()
      const targetView = urlView && urlView !== 'signup' && urlView !== 'signin' && urlView !== 'forgot-password' ? urlView : 'dashboard'
      // Set a placeholder user so the isAuthenticated render guard passes
      // and the dashboard renders with skeleton loading states.
      // The real profile will be loaded by loadUserData() shortly.
      setUser({ name: '', email: '', initials: '' })
      setIsLoadingMemories(true)
      setCurrentView(targetView)
    }

    // ─── Background auth check ───
    const checkAuth = async () => {
      try {
        // Step 1: getSession() reads from local cookie storage (no network request)
        // This resolves almost instantly (~5ms)
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        if (session?.user) {
          // Session found in cookies — update user with real info from session
          const email = session.user.email || ''
          const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0]
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || email[0].toUpperCase()
          setUser({ name, email, initials })

          if (!authResolved) {
            const urlView = navigateFromUrl()
            resolveAuth(urlView && urlView !== 'signup' && urlView !== 'signin' && urlView !== 'forgot-password' ? urlView : 'dashboard')
          }

          // Validate session AND load data IN PARALLEL:
          // - getUser() verifies the session with the Supabase server (catches expired tokens)
          // - loadUserData() fetches profile, memories, collections
          // Running them concurrently saves 500-2000ms vs sequential.
          const [userResult] = await Promise.allSettled([
            supabase.auth.getUser(),
            loadUserData(session.user.id),
          ])

          // Check if session validation revealed an expired/invalid session
          if (userResult.status === 'fulfilled' && mounted) {
            const { data: { user: validatedUser } } = userResult.value
            if (!validatedUser) {
              // Session is expired or invalid — redirect to signin
              console.warn('[Aether] Session validation failed — redirecting to signin')
              dataLoadedRef.current = false
              setUser(null)
              setProfile({ name: '', email: '', initials: '' })
              setMemories([])
              setCollections([])
              setCurrentView('signin')
            }
          }
          return
        }

        // Step 2: No cookie session — try getUser() which validates with server.
        // This can be slow or hang if Supabase is unreachable.
        const { data: { user } } = await supabase.auth.getUser()

        if (!mounted || authResolved) return

        if (user) {
          const email = user.email || ''
          const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0]
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || email[0].toUpperCase()
          setUser({ name, email, initials })

          const urlView = navigateFromUrl()
          resolveAuth(urlView && urlView !== 'signup' && urlView !== 'signin' && urlView !== 'forgot-password' ? urlView : 'dashboard')
          loadUserData(user.id).catch((err) =>
            console.warn('[Aether] Background data load failed:', err)
          )
        } else {
          // Not authenticated
          // If fast-path incorrectly showed dashboard, revert to landing
          if (fastPathUsed && mounted) {
            setUser(null)
            setProfile({ name: '', email: '', initials: '' })
            setCurrentView('landing')
          }

          const urlView = navigateFromUrl()
          if (urlView === 'signup' || urlView === 'signin' || urlView === 'forgot-password') {
            resolveAuth(urlView)
          }
          // If no URL view override, landing page stays (already the default)
          authResolved = true
          clearTimeout(timeoutId)
        }
      } catch {
        // Any error — ensure landing page is showing
        if (!mounted || authResolved) return
        // If fast-path showed dashboard but auth failed, revert
        if (fastPathUsed) {
          setUser(null)
          setProfile({ name: '', email: '', initials: '' })
          setCurrentView('landing')
        }
        authResolved = true
        clearTimeout(timeoutId)
        // Don't change view — landing page is already the default
      }
    }

    checkAuth()

    // ─── Subscribe to auth state changes for ongoing events ───
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        // Skip INITIAL_SESSION — handled above
        if (event === 'INITIAL_SESSION') return

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          dataLoadedRef.current = false
          // Load data in the background — don't block navigation.
          // The dashboard is already showing via handleAuthSuccess.
          // If handleAuthSuccess hasn't fired yet (e.g. token refresh),
          // navigate to dashboard first.
          setCurrentView('dashboard')
          // Fire-and-forget data loading
          loadUserData(session.user.id).catch((err) =>
            console.warn('[Aether] Background data load failed:', err)
          )
        } else if (event === 'SIGNED_OUT') {
          dataLoadedRef.current = false
          setUser(null)
          setProfile({ name: '', email: '', initials: '' })
          setMemories([])
          setCollections([])
          setCurrentView('landing')
        }
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
      unsubStatus()
      unsubComplete()
      window.removeEventListener('aether:memory-synced', handleMemorySynced)
    }
  }, [loadUserData, setUser, setProfile, setMemories, setCollections, setCurrentView, setIsSyncing, setIsLoadingMemories, setPendingSyncCount, setLastSyncedAt, updateMemory, navigateFromUrl])

  // "Enter Aether" on the landing page should go to signup for new users
  const handleEnterApp = useCallback(() => {
    if (isAuthenticated) {
      setCurrentView('dashboard')
    } else {
      setAuthScreen('signup')
      setCurrentView('signup')
    }
  }, [isAuthenticated, setCurrentView, setAuthScreen])

  const handleAuthSwitch = useCallback((screen: 'signup' | 'signin' | 'forgot') => {
    setAuthScreen(screen)
    setCurrentView(screen === 'forgot' ? 'forgot-password' : screen)
  }, [setAuthScreen, setCurrentView])

  // After auth success — IMMEDIATELY navigate to dashboard.
  // This is the critical speed optimization: we navigate FIRST, then load data in background.
  // The onAuthStateChange listener handles data loading when it fires.
  const handleAuthSuccess = useCallback(() => {
    // Navigate to dashboard IMMEDIATELY — don't wait for any data loading.
    // Data (profile, memories, collections) loads in the background via
    // the onAuthStateChange SIGNED_IN handler, which runs after this.
    // The dashboard shows skeleton loading states while data loads.
    setCurrentView('dashboard')
  }, [setCurrentView])

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOGIC
  // ═══════════════════════════════════════════════════════════════
  // IMPORTANT: There is NO loading screen gate on initial load.
  // The landing page renders immediately. Auth checks happen in the
  // background and redirect to dashboard only if a session is found.
  // ═══════════════════════════════════════════════════════════════

  // Render auth screens
  if (currentView === 'signup') {
    return <SignUp onSwitch={handleAuthSwitch} onSuccess={handleAuthSuccess} />
  }
  if (currentView === 'signin') {
    return <SignIn onSwitch={handleAuthSwitch} onSuccess={handleAuthSuccess} />
  }
  if (currentView === 'forgot-password') {
    return <ForgotPassword onSwitch={handleAuthSwitch} onSuccess={handleAuthSuccess} />
  }

  // Landing page
  if (currentView === 'landing') {
    return <LandingPage onEnterApp={handleEnterApp} />
  }

  // If trying to access app but not authenticated, redirect to signup
  if (!isAuthenticated) {
    return <SignUp onSwitch={handleAuthSwitch} onSuccess={handleAuthSuccess} />
  }

  // App views
  return (
    <AppShell>
      <AppContent />
    </AppShell>
  )
}
