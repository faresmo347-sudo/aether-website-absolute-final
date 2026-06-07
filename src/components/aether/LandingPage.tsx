'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Menu, X } from 'lucide-react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { AetherLogo } from '@/components/aether/AetherLogo'

/* ═══════════════════════════════════════════════════════════════
   ANIMATED BACKGROUND — Canvas with floating gradient orbs
   ═══════════════════════════════════════════════════════════════ */

function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
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
      className="absolute inset-0 pointer-events-none z-0"
    />
  )
}

/* ═══════════════════════════════════════════════════════════════
   FLOATING PARTICLES
   ═══════════════════════════════════════════════════════════════ */

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function FloatingParticles() {
  const [count, setCount] = useState(4)

  useEffect(() => {
    const updateCount = () => setCount(window.innerWidth < 768 ? 4 : 15)
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
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
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
   NAVBAR — "Enter Aether" links to /auth
   ═══════════════════════════════════════════════════════════════ */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#pricing', label: 'Pricing' },
  ]

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#050505]/90 backdrop-blur-xl border-b border-white/5'
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
            <a key={link.href} href={link.href} className="text-sm text-white/60 hover:text-[#9D8BA7] transition-colors">{link.label}</a>
          ))}
        </div>

        {/* Right side: CTA + Hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-full px-4 sm:px-5 py-2 text-sm font-medium shadow-lg shadow-[#9D8BA7]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#9D8BA7]/30"
          >
            Enter Aether
          </Link>

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden h-10 w-10 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/5 transition-colors"
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
            className="md:hidden overflow-hidden border-t border-white/5 bg-[#050505]/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-base text-white/70 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 transition-colors min-h-[44px] flex items-center"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-base text-[#9D8BA7] font-medium hover:bg-[#9D8BA7]/5 transition-colors min-h-[44px] flex items-center"
              >
                Enter Aether →
              </Link>
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

function HeroSection() {
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
          className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-1.5 mb-4 sm:mb-8 shadow-sm"
        >
          <span className="h-2 w-2 rounded-full bg-[#9D8BA7] animate-pulse" />
          <span className="text-xs font-medium text-white/70">Your AI-powered second brain</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-3 sm:mb-6"
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
          className="text-base sm:text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-4 sm:mb-8 leading-relaxed"
        >
          Your AI-powered second brain. Capture thoughts, links, and voice notes, and find them instantly.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/auth"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-full px-8 py-4 text-base font-medium shadow-xl shadow-[#9D8BA7]/25 transition-all duration-300 hover:shadow-2xl hover:shadow-[#9D8BA7]/35 hover:-translate-y-1"
          >
            Enter Aether
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 text-white/60 hover:text-[#9D8BA7] text-base font-medium transition-colors duration-300 group"
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
          className="mt-6 sm:mt-12 flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/30"
        >
          <div className="hidden xs:flex -space-x-2">
            {['A', 'S', 'M', 'J'].map((initial, i) => (
              <div
                key={i}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border-2 border-[#050505] flex items-center justify-center text-[10px] sm:text-xs font-semibold text-white"
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
    title: 'Constellations & Tags',
    description: 'Organize memories your way with constellations and smart auto-tagging powered by AI.',
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
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-12"
        >
          <span className="inline-block text-xs font-semibold text-[#9D8BA7] uppercase tracking-widest mb-3">Features</span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Everything your brain needs
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto">
            Capture, connect, and retrieve — Aether handles the rest.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group bg-white/5 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/5 shadow-sm hover:shadow-lg md:hover:-translate-y-1 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-[#9D8BA7]/10 flex items-center justify-center text-[#9D8BA7] mb-4 group-hover:bg-[#9D8BA7]/15 group-hover:scale-110 transition-all duration-300">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
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
  { step: '01', title: 'Capture anything', description: 'Voice notes, text, links, images — save it all in seconds.', icon: 'mic' },
  { step: '02', title: 'AI understands', description: 'Aether reads, summarizes, tags, and connects your memories automatically.', icon: 'brain' },
  { step: '03', title: 'Retrieve instantly', description: 'Ask in natural language. Aether finds exactly what you need.', icon: 'sparkles' },
]

const stepIconMap: Record<string, React.ReactNode> = {
  mic: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
  brain: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>,
  sparkles: <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9D8BA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>,
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-12 sm:py-24 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-12"
        >
          <span className="inline-block text-xs font-semibold text-[#9D8BA7] uppercase tracking-widest mb-3">How It Works</span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            Three steps to a perfect memory
          </h2>
        </motion.div>

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
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-[2px] bg-gradient-to-r from-[#9D8BA7]/20 to-[#9D8BA7]/5" />
              )}
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="h-16 w-16 sm:h-24 sm:w-24 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/10 to-[#9D8BA7]/5 flex items-center justify-center">
                  {stepIconMap[step.icon]}
                </div>
                <span className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-[#9D8BA7] text-white text-xs font-bold flex items-center justify-center shadow-lg shadow-[#9D8BA7]/30">
                  {step.step}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER — with privacy/terms links
   ═══════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <AetherLogo size={28} showText />
          </div>

          <div className="flex items-center gap-6 text-sm text-white/30">
            <Link href="/privacy" className="hover:text-[#9D8BA7] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#9D8BA7] transition-colors">Terms of Service</Link>
          </div>

          <p className="text-xs text-white/40">
            &copy; {new Date().getFullYear()} Aether
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE — Full standalone page (no sidebar, no bottom nav)
   ═══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-white/90">
      {/* Animated Canvas Background */}
      <div className="fixed inset-0 pointer-events-none">
        <AnimatedBackground />
      </div>

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Navbar */}
      <Navbar />

      {/* Hero */}
      <HeroSection />

      {/* Features */}
      <FeaturesSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Final CTA */}
      <section className="relative py-12 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px', amount: 0.2 }}
            transition={{ duration: 0.6 }}
            className="text-center bg-gradient-to-br from-[#9D8BA7]/5 via-[#9D8BA7]/3 to-transparent rounded-2xl sm:rounded-3xl p-5 sm:p-12 md:p-16 border border-white/5"
          >
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Ready to never forget again?
            </h2>
            <p className="text-white/50 text-base sm:text-lg max-w-xl mx-auto mb-6 sm:mb-8">
              Join thousands of thinkers who trust Aether as their second brain.
            </p>
            <Link
              href="/auth"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#9D8BA7] hover:bg-[#7A6B85] text-white rounded-full px-10 py-4 text-lg font-medium shadow-xl shadow-[#9D8BA7]/25 transition-all duration-300 hover:shadow-2xl hover:shadow-[#9D8BA7]/35 hover:-translate-y-1"
            >
              Enter Aether
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer — mt-auto pushes it to bottom when content is short */}
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  )
}
