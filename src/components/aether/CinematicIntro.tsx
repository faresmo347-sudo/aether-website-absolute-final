'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { AetherLogo } from '@/components/aether/AetherLogo'

interface CinematicIntroProps {
  onComplete: () => void
}

/* ─── Shooting Star Configuration ─── */
interface StarConfig {
  id: number
  /** Starting X position (vw%) */
  x: number
  /** Starting Y position (vh%) */
  y: number
  /** Horizontal travel distance in px (CSS --star-dx) */
  dx: number
  /** Vertical travel distance in px (CSS --star-dy) */
  dy: number
  /** Animation duration in seconds */
  duration: number
  /** Delay before the star starts (seconds) */
  delay: number
  /** Star head size in px */
  size: number
}

const SHOOTING_STARS: StarConfig[] = [
  { id: 1, x: 15, y: 10, dx: 320, dy: 180, duration: 1.0, delay: 0.0, size: 3 },
  { id: 2, x: 60, y: 5, dx: 280, dy: 220, duration: 0.9, delay: 0.25, size: 2.5 },
  { id: 3, x: 35, y: 25, dx: 350, dy: 150, duration: 1.1, delay: 0.5, size: 2 },
  { id: 4, x: 75, y: 15, dx: 240, dy: 200, duration: 0.85, delay: 0.7, size: 2.5 },
  { id: 5, x: 10, y: 30, dx: 300, dy: 170, duration: 0.95, delay: 0.9, size: 2 },
]

/* ─── Particle trails per star ─── */
const PARTICLES_PER_STAR = 3

type IntroPhase = 'playing' | 'exiting' | 'done'

export function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>('playing')
  const completedRef = useRef(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    try {
      sessionStorage.setItem('intro_played', '1')
    } catch {
      // sessionStorage may be unavailable in some environments
    }
    onComplete()
  }, [onComplete])

  /* ─── Mount: check sessionStorage + prefers-reduced-motion ─── */
  useEffect(() => {
    let shouldSkip = false
    try {
      if (sessionStorage.getItem('intro_played')) shouldSkip = true
    } catch {
      // ignore
    }
    if (!shouldSkip && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shouldSkip = true
    }

    if (shouldSkip) {
      // Defer state update to avoid synchronous setState in effect
      const t = setTimeout(() => {
        setPhase('done')
        finish()
      }, 0)
      timeoutsRef.current.push(t)
      return () => {
        timeoutsRef.current.forEach(clearTimeout)
        timeoutsRef.current = []
      }
    }

    // Phase 4: start fade-out at 2.8s
    const t1 = setTimeout(() => {
      setPhase('exiting')
    }, 2800)

    timeoutsRef.current.push(t1)

    return () => {
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
    }
  }, [finish])

  /* ─── Skip handler ─── */
  const handleSkip = useCallback(() => {
    setPhase('done')
    finish()
  }, [finish])

  /* ─── If done, render nothing ─── */
  if (phase === 'done') return null

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: '#000000' }}
      /* Phase 4: Fade out with subtle scale-up */
      animate={
        phase === 'exiting'
          ? { opacity: 0, scale: 1.05 }
          : { opacity: 1, scale: 1 }
      }
      transition={
        phase === 'exiting'
          ? { duration: 0.7, ease: 'easeInOut' }
          : { duration: 0 }
      }
      onAnimationComplete={() => {
        if (phase === 'exiting') {
          finish()
        }
      }}
    >
      {/* ─── Phase 1: Pure black (0-0.5s) ─── */}
      {/* The black background is already present via style — silence and darkness */}

      {/* ─── Phase 2: Shooting Stars (0.5-2.0s) ─── */}
      <div className="absolute inset-0">
        {SHOOTING_STARS.map((star) => (
          <div
            key={star.id}
            className="absolute"
            style={{
              left: `${star.x}vw`,
              top: `${star.y}vh`,
              '--star-dx': `${star.dx}px`,
              '--star-dy': `${star.dy}px`,
              willChange: 'transform, opacity',
            } as React.CSSProperties}
          >
            {/* Star head — animated via CSS keyframe */}
            <div
              style={{
                width: star.size,
                height: star.size,
                borderRadius: '50%',
                background: 'radial-gradient(circle, #ffffff 0%, #B8A8C4 60%, transparent 100%)',
                boxShadow: `0 0 ${star.size * 3}px rgba(184, 168, 196, 0.6)`,
                animation: `shooting-star ${star.duration}s ease-out ${star.delay + 0.5}s both`,
                willChange: 'transform, opacity',
              }}
            />
            {/* Trailing particles */}
            {Array.from({ length: PARTICLES_PER_STAR }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: star.size * 0.6,
                  height: star.size * 0.6,
                  borderRadius: '50%',
                  background: 'rgba(184, 168, 196, 0.5)',
                  animation: [
                    `shooting-star ${star.duration}s ease-out ${star.delay + 0.5 + i * 0.08}s both`,
                    `shooting-star-particle ${star.duration * 0.6}s ease-out ${star.delay + 0.5 + i * 0.08}s both`,
                  ].join(', '),
                  willChange: 'transform, opacity',
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ─── Phase 3: Logo Reveal (2.0-2.8s) ─── */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0, duration: 0.8, ease: 'easeOut' }}
      >
        {/* Logo with lavender glow */}
        <div
          style={{
            animation: 'logo-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) 2.0s both',
            filter: 'drop-shadow(0 0 30px rgba(157, 139, 167, 0.4)) drop-shadow(0 0 60px rgba(157, 139, 167, 0.2))',
            willChange: 'transform, opacity',
          }}
        >
          <AetherLogo size={80} />
        </div>

        {/* AETHER text — letter-spacing animates via tagline-reveal keyframe */}
        <div
          style={{
            marginTop: '20px',
            animation: 'tagline-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) 2.2s both',
            willChange: 'opacity, letter-spacing',
          }}
        >
          <span
            style={{
              color: '#ffffff',
              fontFamily: 'var(--font-playfair), serif',
              fontWeight: 700,
              fontSize: '2rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            AETHER
          </span>
        </div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 2.4, duration: 0.4 }}
        >
          <span
            style={{
              color: '#ffffff',
              fontSize: '0.65rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginTop: '12px',
              display: 'block',
            }}
          >
            YOUR AI SECOND BRAIN
          </span>
        </motion.div>
      </motion.div>

      {/* ─── Skip Button ─── */}
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 text-white/30 hover:text-white/60 transition-colors duration-200 cursor-pointer"
        style={{
          fontSize: '0.8rem',
          letterSpacing: '0.05em',
          background: 'none',
          border: 'none',
          outline: 'none',
          padding: '8px 12px',
        }}
        aria-label="Skip intro animation"
      >
        Skip →
      </button>
    </motion.div>
  )
}
