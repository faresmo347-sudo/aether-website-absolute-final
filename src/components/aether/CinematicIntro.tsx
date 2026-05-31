'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { AetherLogo } from '@/components/aether/AetherLogo'

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — same seed ⇒ same values on server & client
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STAR_COLORS = ['#ffffff', '#c084fc', '#67e8f9'] as const
const NUM_SHOOTING_STARS = 12
const NUM_BG_STARS = 200

// Phase timestamps (ms) — relative to the moment the intro starts playing
const T_STARS_START = 400
const T_SKIP_VISIBLE = 800
const T_LOGO = 1800
const T_TAGLINE = 2000
const T_FADE_OUT = 2800
const T_COMPLETE = 3500

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ShootingStar {
  id: number
  startX: number       // % of viewport
  startY: number       // % of viewport
  dx: number           // px translation
  dy: number           // px translation
  width: number        // px
  color: string
  delay: number        // ms (0 – 800)
  duration: number     // ms
  burstX: number       // % of viewport (approximate exit point)
  burstY: number       // % of viewport
}

interface BgStar {
  id: number
  x: number
  y: number
  opacity: number
  size: number
}

// ---------------------------------------------------------------------------
// Check whether the intro should be skipped entirely.
// Runs only on the client; returns false on the server (SSR safe).
// ---------------------------------------------------------------------------
function shouldSkipIntro(): boolean {
  if (typeof window === 'undefined') return false
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const played = sessionStorage.getItem('intro_played')
  if (reduced || played) {
    sessionStorage.setItem('intro_played', 'true')
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface CinematicIntroProps {
  onComplete: () => void
}

export function CinematicIntro({ onComplete }: CinematicIntroProps) {
  // ---- Resolve skip check once during initial render (lazy initializer) ----
  // Using a lazy initializer avoids calling setState synchronously inside an
  // effect, which the strict lint rule forbids.
  const [skipped] = useState(shouldSkipIntro)

  // ---- animation state -----------------------------------------------------
  const [starsActive, setStarsActive] = useState(false)
  const [logoVisible, setLogoVisible] = useState(false)
  const [taglineVisible, setTaglineVisible] = useState(false)
  const [skipVisible, setSkipVisible] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)
  const [fadeOutSec, setFadeOutSec] = useState(0.7)

  // Stable ref to the latest onComplete so effects don't need it in deps
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // ---- deterministic data --------------------------------------------------
  const shootingStars: ShootingStar[] = useMemo(() => {
    const rng = mulberry32(42)
    return Array.from({ length: NUM_SHOOTING_STARS }, (_, i) => {
      const edge = Math.floor(rng() * 4) // 0 top, 1 right, 2 bottom, 3 left
      const color = STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)]
      const width = 120 + rng() * 80
      const delay = rng() * 800
      const duration = 800 + rng() * 400
      const travel = 800 + rng() * 600

      let startX: number, startY: number, rotation: number

      switch (edge) {
        case 0: // top → downward
          startX = rng() * 100
          startY = -2
          rotation = 30 + rng() * 120
          break
        case 1: // right → leftward
          startX = 102
          startY = rng() * 100
          rotation = 150 + rng() * 120
          break
        case 2: // bottom → upward
          startX = rng() * 100
          startY = 102
          rotation = 210 + rng() * 120
          break
        default: // left → rightward
          startX = -2
          startY = rng() * 100
          rotation = -30 + rng() * 120
          break
      }

      const rad = (rotation * Math.PI) / 180
      const dx = Math.cos(rad) * travel
      const dy = Math.sin(rad) * travel

      // Approximate burst position — convert endpoint to % (assume 1920×1080)
      const burstX = Math.max(2, Math.min(98, startX + dx / 19.2))
      const burstY = Math.max(2, Math.min(98, startY + dy / 10.8))

      return { id: i, startX, startY, dx, dy, width, color, delay, duration, burstX, burstY }
    })
  }, [])

  const bgStars: BgStar[] = useMemo(() => {
    const rng = mulberry32(789)
    return Array.from({ length: NUM_BG_STARS }, (_, i) => ({
      id: i,
      x: rng() * 100,
      y: rng() * 100,
      opacity: 0.05 + rng() * 0.05,
      size: 1 + rng() * 1.5,
    }))
  }, [])

  // ---- if skipping, notify parent immediately (via effect, not render) ----
  useEffect(() => {
    if (skipped) onCompleteRef.current()
  }, [skipped])

  // ---- animation phase timers (only when intro plays) ----------------------
  useEffect(() => {
    if (skipped) return

    const add = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms)
      timers.current.push(id)
    }

    add(() => setStarsActive(true), T_STARS_START)
    add(() => setSkipVisible(true), T_SKIP_VISIBLE)
    add(() => setLogoVisible(true), T_LOGO)
    add(() => setTaglineVisible(true), T_TAGLINE)
    add(() => {
      setFadeOutSec(0.7)
      setFadeOut(true)
    }, T_FADE_OUT)
    add(() => {
      sessionStorage.setItem('intro_played', 'true')
      onCompleteRef.current()
    }, T_COMPLETE)

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [skipped])

  // ---- skip handler --------------------------------------------------------
  const handleSkip = useCallback(() => {
    setFadeOutSec(0.3)
    setFadeOut(true)
    const id = setTimeout(() => {
      sessionStorage.setItem('intro_played', 'true')
      onCompleteRef.current()
    }, 300)
    timers.current.push(id)
  }, [])

  // ---- early exit if skipping / already done -------------------------------
  if (skipped) return null

  // ---- render --------------------------------------------------------------
  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      animate={{
        opacity: fadeOut ? 0 : 1,
        backgroundColor: fadeOut ? '#07070f' : '#000000',
      }}
      transition={{ duration: fadeOutSec, ease: 'easeInOut' }}
    >
      {/* ── CSS keyframes ────────────────────────────────────────────── */}
      <style>{`
        @keyframes aether-shoot {
          0%   { transform: translate(0, 0); opacity: 0; }
          5%   { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate(var(--star-dx), var(--star-dy)); opacity: 0; }
        }
        @keyframes aether-burst {
          0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          40%  { opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        .aether-star {
          animation: aether-shoot var(--star-dur) cubic-bezier(0.25, 0, 1, 0.5) var(--star-del) forwards;
          opacity: 0;
          pointer-events: none;
        }
        .aether-burst {
          animation: aether-burst 500ms ease-out var(--burst-del) forwards;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>

      {/* ── Background stars (static, very low opacity) ──────────────── */}
      <div className="absolute inset-0" aria-hidden="true">
        {bgStars.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
            }}
          />
        ))}
      </div>

      {/* ── Shooting stars ───────────────────────────────────────────── */}
      {starsActive && (
        <div className="absolute inset-0" aria-hidden="true">
          {shootingStars.map((s) => (
            <div key={s.id}>
              {/* Star line */}
              <div
                className="aether-star absolute"
                style={
                  {
                    left: `${s.startX}%`,
                    top: `${s.startY}%`,
                    width: `${s.width}px`,
                    height: '1.5px',
                    background: `linear-gradient(90deg, transparent, ${s.color}, white)`,
                    boxShadow: `0 0 6px ${s.color}, 0 0 12px white`,
                    '--star-dx': `${s.dx}px`,
                    '--star-dy': `${s.dy}px`,
                    '--star-del': `${s.delay}ms`,
                    '--star-dur': `${s.duration}ms`,
                    transformOrigin: 'left center',
                  } as React.CSSProperties
                }
              />

              {/* Particle burst near exit point */}
              <div
                className="aether-burst absolute rounded-full"
                style={
                  {
                    left: `${s.burstX}%`,
                    top: `${s.burstY}%`,
                    width: '20px',
                    height: '20px',
                    background: `radial-gradient(circle, ${s.color}88, ${s.color}33, transparent)`,
                    '--burst-del': `${s.delay + s.duration * 0.75}ms`,
                  } as React.CSSProperties
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Logo reveal (Phase 3) ────────────────────────────────────── */}
      {logoVisible && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <AetherLogo
              size={72}
              variant="full"
              className="[&>span]:!text-white [&>span]:!text-3xl"
            />
          </motion.div>

          {/* Tagline — always in DOM so layout doesn't shift */}
          <motion.p
            className="mt-8 text-sm font-light tracking-[0.15em]"
            style={{ color: '#9D8BA7' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: taglineVisible ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          >
            Your memory. Your companion.
          </motion.p>
        </div>
      )}

      {/* ── Skip button ──────────────────────────────────────────────── */}
      <motion.button
        className="absolute bottom-8 right-8 text-sm cursor-pointer text-white/30 hover:text-white/60 transition-colors duration-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: skipVisible ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleSkip}
        aria-label="Skip intro"
      >
        skip
      </motion.button>
    </motion.div>
  )
}
