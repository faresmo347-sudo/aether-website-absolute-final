'use client'

import { useState, useEffect, useMemo } from 'react'
import { Menu, X } from 'lucide-react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
// AURORA MESH BACKGROUND
// ═══════════════════════════════════════════════════════════════
function AuroraMeshBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div
        className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, rgba(99, 102, 241, 0.20) 0%, rgba(157, 139, 167, 0.10) 40%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'aurora-breathe 16s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-1/3 -left-20 w-[600px] h-[400px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, rgba(125, 211, 232, 0.10) 0%, rgba(94, 234, 212, 0.05) 40%, transparent 70%)',
          filter: 'blur(120px)',
          animation: 'aurora-breathe 22s ease-in-out 4s infinite',
        }}
      />
      <div
        className="absolute top-1/4 -right-20 w-[500px] h-[350px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, rgba(192, 132, 252, 0.16) 0%, rgba(157, 139, 167, 0.05) 40%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'aurora-breathe 20s ease-in-out 8s infinite',
        }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-[500px] h-[400px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse, rgba(251, 146, 60, 0.06) 0%, rgba(251, 146, 60, 0.02) 40%, transparent 70%)',
          filter: 'blur(120px)',
          animation: 'aurora-drift-warm 20s ease-in-out infinite alternate',
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FLOATING PARTICLES
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// COUNT-UP COMPONENT
// ═══════════════════════════════════════════════════════════════
function CountUp({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number | null = null
    let rafId: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])

  return <span>{count.toLocaleString()}+</span>
}

// ═══════════════════════════════════════════════════════════════
// CTA SPARKLE DATA (deterministic positions for starfield)
// ═══════════════════════════════════════════════════════════════
const ctaSparkles = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: ((i * 37 + 13) % 97) + 1,
  y: ((i * 53 + 7) % 95) + 2,
  size: (i % 3) * 0.5 + 1,
  duration: 2.5 + (i % 4) * 0.7,
  delay: (i * 0.37) % 3,
}))

// ═══════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-[#050510]/80 backdrop-blur-2xl border-b border-white/[0.04]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-inter)' }}>Aether</span>
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
            className="md:hidden overflow-hidden border-t border-white/[0.04] bg-[#050510]/95 backdrop-blur-2xl"
          >
            <div className="px-4 py-4">
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

// ═══════════════════════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════════════════════
function HeroSection() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 120])
  const opacity = useTransform(scrollY, [0, 400], [1, 0])

  return (
    <motion.section style={{ y, opacity }} className="relative min-h-screen flex items-center justify-center pt-12 sm:pt-16">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="inline-flex items-center gap-2 bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] rounded-full px-4 py-1.5 mb-6 sm:mb-10"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#c084fc] animate-pulse" />
            <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest">Your AI-powered second brain</span>
            <span className="inline-block w-[2px] h-3 bg-[#c084fc]/70 ml-1 animate-blink-cursor align-middle" />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
          className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.0] tracking-tight mb-4 sm:mb-8"
          style={{
            fontFamily: 'var(--font-inter)',
            textShadow: '0 0 40px rgba(192,132,252,0.15), 0 0 80px rgba(99,102,241,0.08)',
          }}
        >
          <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="inline-block">Forget</motion.span>{' '}
          <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }} className="inline-block bg-gradient-to-r from-[#9D8BA7] via-[#c084fc] to-[#7DD3E8] bg-clip-text text-transparent animate-gradient">forgetting</motion.span>
          <motion.span initial={{ opacity: 0, y: 30, scale: 0.5 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.95, duration: 0.6, type: 'spring' }} className="inline-block">.</motion.span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="text-base sm:text-lg md:text-xl text-white/30 max-w-xl mx-auto mb-8 sm:mb-12 leading-relaxed"
        >
          Capture thoughts, links, and voice notes. Find them instantly.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <div className="relative">
            {/* Glowing orb/ring behind CTA */}
            <div className="absolute inset-0 -m-8 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, rgba(192,132,252,0.08) 40%, transparent 70%)', filter: 'blur(40px)', animation: 'aurora-breathe 4s ease-in-out infinite' }} />
            <Link
              href="/auth"
              className="group relative inline-flex items-center justify-center gap-2 rounded-full px-10 py-5 text-lg font-medium text-white transition-all duration-500 hover:-translate-y-1 animate-cta-pulse"
              style={{
                background: 'linear-gradient(135deg, #9D8BA7, #7c3aed, #9D8BA7)',
                backgroundSize: '200% 200%',
                animation: 'cta-pulse-glow 3s ease-in-out infinite, gradient-shift 6s ease infinite',
                boxShadow: '0 0 30px rgba(124, 58, 237, 0.3), 0 0 60px rgba(192, 132, 252, 0.15)',
              }}
            >
              Enter Aether
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform duration-300"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mt-10 sm:mt-16 flex items-center justify-center gap-4 text-[11px] text-white/15"
        >
          <span>Trusted by <CountUp target={2000} /> thinkers</span>
        </motion.div>
      </div>
    </motion.section>
  )
}

// ═══════════════════════════════════════════════════════════════
// FEATURES GRID
// ═══════════════════════════════════════════════════════════════
const features = [
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>,
    title: 'Voice Capture',
    description: 'Speak freely. Aether transcribes and understands your voice notes automatically.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
    title: 'AI Search',
    description: 'Ask in natural language. Find any memory, even if you forgot how you saved it.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>,
    title: 'Auto-Tagging',
    description: 'Aether tags and organizes your memories automatically. Zero manual sorting.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>,
    title: 'Auto Summaries',
    description: 'Every memory gets an AI-generated summary. Get the gist in seconds.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>,
    title: 'Daily Spark',
    description: 'Rediscover forgotten memories. Aether resurfaces what matters most.',
  },
  {
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>,
    title: 'Private & Secure',
    description: 'Your memories are yours. End-to-end encrypted and never shared.',
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
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight" style={{ fontFamily: 'var(--font-inter)' }}>
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
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="relative group feature-card-tilt"
            >
              {/* Animated gradient border glow on hover */}
              <div className="absolute -inset-[1px] rounded-2xl animate-gradient-border opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-[1px]" />
              {/* Vibrant outer glow on hover */}
              <div className="absolute -inset-3 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(192,132,252,0.08) 0%, transparent 70%)', filter: 'blur(20px)' }} />
              <div className="relative bg-white/[0.02] rounded-2xl p-5 sm:p-7 border border-white/[0.05] group-hover:border-[#c084fc]/20 transition-all duration-500 hover:-translate-y-1.5 overflow-hidden">
                {/* Number badge */}
                <span className="absolute top-4 right-4 text-xs font-mono text-white/[0.07] group-hover:text-white/[0.15] transition-colors duration-500">{String(i + 1).padStart(2, '0')}</span>
                <div className="relative z-10">
                  <div className="h-10 w-10 rounded-xl bg-[#c084fc]/10 flex items-center justify-center text-[#c084fc] mb-4 group-hover:bg-[#c084fc]/20 group-hover:scale-110 transition-all duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white/90 mb-2" style={{ fontFamily: 'var(--font-inter)' }}>{feature.title}</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════
function Footer() {
  return (
    <footer className="relative">
      {/* Gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            </div>
            <span className="text-sm font-bold text-white/60" style={{ fontFamily: 'var(--font-inter)' }}>Aether</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/20">
            <Link href="/privacy" className="hover:text-[#c084fc] transition-colors duration-300">Privacy</Link>
            <Link href="/terms" className="hover:text-[#c084fc] transition-colors duration-300">Terms</Link>
          </div>
          <p className="text-[11px] text-white/15">&copy; {new Date().getFullYear()} Aether</p>
        </div>
      </div>
    </footer>
  )
}

// ═══════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#050510] text-white/90">
      <div className="fixed inset-0 pointer-events-none">
        <AuroraMeshBackground />
      </div>
      <FloatingParticles />
      <Navbar />
      <HeroSection />
      <FeaturesSection />

      {/* Final CTA */}
      <section className="relative py-16 sm:py-32">
        {/* Starfield/sparkle background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {ctaSparkles.map((s) => (
            <div
              key={s.id}
              className="absolute rounded-full bg-white"
              style={{
                width: s.size,
                height: s.size,
                left: `${s.x}%`,
                top: `${s.y}%`,
                opacity: 0,
                animation: `sparkle-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px', amount: 0.2 }}
            transition={{ duration: 0.8 }}
            className="relative text-center bg-white/[0.02] rounded-3xl p-8 sm:p-16 border border-white/[0.05] animate-breathe-border overflow-hidden"
          >
            {/* Inner glow accent line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-[#c084fc]/40 to-transparent" />
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight" style={{ fontFamily: 'var(--font-inter)' }}>
              Ready to never forget again?
            </h2>
            <p className="text-gray-300 text-base sm:text-lg max-w-lg mx-auto mb-8">
              Join thousands of thinkers who trust Aether as their second brain.
            </p>
            <Link
              href="/auth"
              className="relative inline-flex items-center justify-center gap-2 rounded-full px-10 py-4 text-lg font-medium text-white transition-all duration-500 hover:-translate-y-1 animate-cta-pulse"
              style={{
                background: 'linear-gradient(135deg, #9D8BA7, #7c3aed, #9D8BA7)',
                backgroundSize: '200% 200%',
                animation: 'cta-pulse-glow 3s ease-in-out infinite, gradient-shift 6s ease infinite',
                boxShadow: '0 0 30px rgba(124, 58, 237, 0.3), 0 0 60px rgba(192, 132, 252, 0.15)',
              }}
            >
              Enter Aether
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="mt-auto">
        <Footer />
      </div>
    </div>
  )
}
