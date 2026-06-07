'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Menu, X } from 'lucide-react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { AetherLogo } from '@/components/aether/AetherLogo'

/* ═══════════════════════════════════════════════════════════════
   AURORA MESH BACKGROUND — Slow-breathing gradient mesh
   ═══════════════════════════════════════════════════════════════ */

function AuroraMeshBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Primary orb — deep indigo/purple */}
      <div
        className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full animate-aurora-breathe"
        style={{
          background: `radial-gradient(ellipse, rgba(99, 102, 241, 0.15) 0%, rgba(157, 139, 167, 0.08) 40%, transparent 70%)`,
          filter: 'blur(100px)',
        }}
      />
      {/* Secondary orb — teal/cyan */}
      <div
        className="absolute top-1/3 -left-20 w-[600px] h-[400px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(125, 211, 232, 0.08) 0%, rgba(94, 234, 212, 0.04) 40%, transparent 70%)`,
          filter: 'blur(120px)',
          animation: 'aurora-breathe 18s ease-in-out 4s infinite',
        }}
      />
      {/* Tertiary orb — bright purple/pink */}
      <div
        className="absolute top-1/4 -right-20 w-[500px] h-[350px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(192, 132, 252, 0.12) 0%, rgba(157, 139, 167, 0.04) 40%, transparent 70%)`,
          filter: 'blur(100px)',
          animation: 'aurora-breathe 15s ease-in-out 8s infinite',
        }}
      />
      {/* Fourth orb — subtle warm glow at bottom */}
      <div
        className="absolute -bottom-32 left-1/3 w-[700px] h-[400px] rounded-full"
        style={{
          background: `radial-gradient(ellipse, rgba(157, 139, 167, 0.1) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%)`,
          filter: 'blur(120px)',
          animation: 'aurora-breathe 20s ease-in-out 2s infinite',
        }}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FLOATING PARTICLES — Soft, sparse, calming
   ═══════════════════════════════════════════════════════════════ */

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function FloatingParticles() {
  const [count, setCount] = useState(3)

  useEffect(() => {
    const updateCount = () => setCount(window.innerWidth < 768 ? 3 : 12)
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
      size: rand() * 3 + 1.5,
      duration: rand() * 12 + 12,
      delay: rand() * 5,
      opacity: rand() * 0.2 + 0.05,
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
            backgroundColor: '#c084fc',
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -25, 0],
            x: [0, p.id % 2 === 0 ? 8 : -8, 0],
            opacity: [p.opacity, p.opacity * 1.8, p.opacity],
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
   NAVBAR — Transparent, calm, "Enter Aether" CTA
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
    { href: '#how-it-works', label: 'How It Works' },
  ]

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0A0A14]/80 backdrop-blur-2xl border-b border-white/[0.04]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AetherLogo size={36} showText />
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-white/40 hover:text-[#c084fc] transition-colors duration-300">{link.label}</a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="relative bg-white/[0.06] backdrop-blur-sm hover:bg-white/[0.1] text-white/80 hover:text-white rounded-full px-5 py-2 text-sm font-medium border border-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
          >
            Enter Aether
          </Link>

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden h-10 w-10 rounded-xl flex items-center justify-center text-white/50 hover:bg-white/5 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-white/[0.04] bg-[#0A0A14]/95 backdrop-blur-2xl"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-base text-white/50 hover:text-[#c084fc] hover:bg-white/[0.03] transition-colors min-h-[44px] flex items-center"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-base text-[#c084fc] font-medium hover:bg-white/[0.03] transition-colors min-h-[44px] flex items-center"
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
   HERO SECTION — "Forget forgetting."
   ═══════════════════════════════════════════════════════════════ */

function HeroSection() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 120])
  const opacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <motion.section style={{ y, opacity }} className="relative min-h-screen flex items-center justify-center pt-12 sm:pt-16">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Subtle badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="inline-flex items-center gap-2 bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-full px-4 py-1.5 mb-6 sm:mb-10"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#c084fc] animate-pulse" />
          <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest">Your AI-powered second brain</span>
        </motion.div>

        {/* Headline — massive, bold, breathable */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
          className="font-sans text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.0] tracking-tight mb-4 sm:mb-8"
        >
          Forget{' '}
          <span className="bg-gradient-to-r from-[#9D8BA7] via-[#c084fc] to-[#7DD3E8] bg-clip-text text-transparent animate-gradient">
            forgetting
          </span>
          .
        </motion.h1>

        {/* Subheadline — soft, muted */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="text-base sm:text-lg md:text-xl text-white/30 max-w-xl mx-auto mb-8 sm:mb-12 leading-relaxed"
        >
          Capture thoughts, links, and voice notes. Find them instantly.
        </motion.p>

        {/* CTA — Slow-pulsing gradient glow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/auth"
            className="group relative inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-medium text-white transition-all duration-500 hover:-translate-y-0.5 animate-cta-pulse"
            style={{
              background: 'linear-gradient(135deg, #9D8BA7, #7c3aed, #9D8BA7)',
              backgroundSize: '200% 200%',
              animation: 'cta-pulse-glow 3s ease-in-out infinite, gradient-shift 6s ease infinite',
            }}
          >
            Enter Aether
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform duration-300"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 text-white/30 hover:text-[#c084fc] text-sm font-medium transition-colors duration-300 group"
          >
            See how it works
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6"/></svg>
          </a>
        </motion.div>

        {/* Social proof — minimal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-10 sm:mt-16 flex items-center justify-center gap-4 text-[11px] text-white/15"
        >
          <span>Trusted by 2,000+ thinkers</span>
        </motion.div>
      </div>
    </motion.section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES GRID — Glassmorphism 2.0 cards
   ═══════════════════════════════════════════════════════════════ */

const features = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
    ),
    title: 'Voice Capture',
    description: 'Speak freely. Aether transcribes and understands your voice notes automatically.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    ),
    title: 'AI Search',
    description: 'Ask in natural language. Find any memory, even if you forgot how you saved it.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    ),
    title: 'Smart Connections',
    description: 'Aether connects related memories automatically, revealing hidden patterns.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>
    ),
    title: 'Auto Summaries',
    description: 'Every memory gets an AI-generated summary. Get the gist in seconds.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
    ),
    title: 'Constellations',
    description: 'AI auto-organizes your memories into constellations. Zero manual sorting.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
    ),
    title: 'Daily Recaps',
    description: 'Intelligent recaps that surface what matters most from your memories.',
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="relative py-16 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10 sm:mb-16"
        >
          <span className="inline-block text-[11px] font-semibold text-[#c084fc]/60 uppercase tracking-[0.2em] mb-4">Features</span>
          <h2 className="font-sans text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Everything your brain needs
          </h2>
          <p className="text-white/25 text-base sm:text-lg max-w-lg mx-auto">
            Capture, connect, and retrieve — Aether handles the rest.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ delay: i * 0.08, duration: 0.6 }}
              className="group bg-white/[0.03] backdrop-blur-xl rounded-2xl p-5 sm:p-7 border border-white/[0.06] hover:border-[#c084fc]/20 transition-all duration-500 hover:-translate-y-1"
              style={{ boxShadow: '0 0 40px rgba(0, 0, 0, 0.2)' }}
            >
              <div className="h-10 w-10 rounded-xl bg-[#c084fc]/10 flex items-center justify-center text-[#c084fc] mb-4 group-hover:bg-[#c084fc]/15 group-hover:scale-110 transition-all duration-500">
                {feature.icon}
              </div>
              <h3 className="text-base font-semibold text-white/90 mb-2">{feature.title}</h3>
              <p className="text-sm text-white/25 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS — Three clean steps
   ═══════════════════════════════════════════════════════════════ */

const steps = [
  { step: '01', title: 'Capture anything', description: 'Voice, text, links, images — save it all in one tap.', icon: 'mic' },
  { step: '02', title: 'AI understands', description: 'Aether reads, summarizes, tags, and connects automatically.', icon: 'brain' },
  { step: '03', title: 'Retrieve instantly', description: 'Ask in natural language. Get exactly what you need.', icon: 'sparkles' },
]

const stepIconSvgs: Record<string, React.ReactNode> = {
  mic: <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
  brain: <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>,
  sparkles: <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>,
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-16 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px', amount: 0.2 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10 sm:mb-16"
        >
          <span className="inline-block text-[11px] font-semibold text-[#c084fc]/60 uppercase tracking-[0.2em] mb-4">How It Works</span>
          <h2 className="font-sans text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Three steps to a perfect memory
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px', amount: 0.2 }}
              transition={{ delay: i * 0.15, duration: 0.8 }}
              className="relative text-center"
            >
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-14 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-px bg-gradient-to-r from-[#c084fc]/15 to-transparent" />
              )}
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  {stepIconSvgs[step.icon]}
                </div>
                <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-[#c084fc] text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-[#c084fc]/30">
                  {step.step}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white/90 mb-2">{step.title}</h3>
              <p className="text-sm text-white/25 leading-relaxed max-w-xs mx-auto">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <AetherLogo size={28} showText />
          </div>

          <div className="flex items-center gap-6 text-sm text-white/20">
            <Link href="/privacy" className="hover:text-[#c084fc] transition-colors duration-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#c084fc] transition-colors duration-300">Terms of Service</Link>
          </div>

          <p className="text-[11px] text-white/15">
            &copy; {new Date().getFullYear()} Aether
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE — Full standalone page
   ═══════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A14] text-white/90">
      {/* Aurora Mesh Background */}
      <div className="fixed inset-0 pointer-events-none">
        <AuroraMeshBackground />
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
      <section className="relative py-16 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px', amount: 0.2 }}
            transition={{ duration: 0.8 }}
            className="text-center bg-white/[0.03] backdrop-blur-xl rounded-3xl p-8 sm:p-16 border border-white/[0.06]"
            style={{ boxShadow: '0 0 80px rgba(124, 58, 237, 0.08)' }}
          >
            <h2 className="font-sans text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Ready to never forget again?
            </h2>
            <p className="text-white/25 text-base sm:text-lg max-w-lg mx-auto mb-8">
              Join thousands of thinkers who trust Aether as their second brain.
            </p>
            <Link
              href="/auth"
              className="relative inline-flex items-center justify-center gap-2 rounded-full px-10 py-4 text-lg font-medium text-white transition-all duration-500 hover:-translate-y-1 animate-cta-pulse"
              style={{
                background: 'linear-gradient(135deg, #9D8BA7, #7c3aed, #9D8BA7)',
                backgroundSize: '200% 200%',
                animation: 'cta-pulse-glow 3s ease-in-out infinite, gradient-shift 6s ease infinite',
              }}
            >
              Enter Aether
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  )
}
