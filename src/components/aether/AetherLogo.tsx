'use client'

import { cn } from '@/lib/utils'

interface AetherLogoProps {
  size?: number
  className?: string
  showText?: boolean
  variant?: 'icon-only' | 'full'
}

/**
 * Premium Aether brain/neural network logo.
 * - `icon-only` (default): Just the brain icon in a lavender circle
 * - `full`: Brain icon + "Aether" text
 * Works on both light and dark backgrounds.
 * Crisp at all sizes including 16×16px favicon.
 */
export function AetherLogo({
  size = 36,
  className,
  showText = false,
  variant = 'icon-only',
}: AetherLogoProps) {
  const iconSize = size
  const fontSize = Math.round(size * 0.55)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Brain icon in lavender circle */}
      <div
        className="flex-shrink-0 rounded-xl bg-gradient-to-br from-[#6D597A] to-[#9D8BA7] flex items-center justify-center shadow-lg shadow-[#9D8BA7]/20 overflow-hidden"
        style={{ width: iconSize, height: iconSize }}
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-hidden="true"
        >
          {/* Abstract brain / neural network icon */}
          {/* Left hemisphere - flowing curve */}
          <path
            d="M256 96C256 96 180 96 148 148C116 200 116 240 140 276C164 312 180 328 180 356C180 384 164 404 164 404"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          {/* Right hemisphere - flowing curve */}
          <path
            d="M256 96C256 96 332 96 364 148C396 200 396 240 372 276C348 312 332 328 332 356C332 384 348 404 348 404"
            stroke="white"
            strokeWidth="12"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          {/* Central vertical spine */}
          <path
            d="M256 88L256 424"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.5"
          />
          {/* Left inner curve */}
          <path
            d="M256 160C220 160 196 180 196 220C196 260 220 280 256 280"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          {/* Right inner curve */}
          <path
            d="M256 160C292 160 316 180 316 220C316 260 292 280 256 280"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          {/* Lower inner curves */}
          <path
            d="M256 300C224 300 200 320 200 350C200 380 224 396 256 396"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M256 300C288 300 312 320 312 350C312 380 288 396 256 396"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          {/* Neural nodes */}
          <circle cx="256" cy="88" r="10" fill="white" opacity="0.95" />
          <circle cx="256" cy="424" r="10" fill="white" opacity="0.95" />
          <circle cx="148" cy="148" r="9" fill="white" opacity="0.8" />
          <circle cx="364" cy="148" r="9" fill="white" opacity="0.8" />
          <circle cx="140" cy="276" r="8" fill="white" opacity="0.7" />
          <circle cx="372" cy="276" r="8" fill="white" opacity="0.7" />
          <circle cx="196" cy="220" r="7" fill="white" opacity="0.7" />
          <circle cx="316" cy="220" r="7" fill="white" opacity="0.7" />
          <circle cx="256" cy="160" r="8" fill="white" opacity="0.8" />
          <circle cx="256" cy="280" r="8" fill="white" opacity="0.8" />
          <circle cx="200" cy="350" r="6" fill="white" opacity="0.6" />
          <circle cx="312" cy="350" r="6" fill="white" opacity="0.6" />
          <circle cx="256" cy="396" r="7" fill="white" opacity="0.7" />
          <circle cx="180" cy="356" r="7" fill="white" opacity="0.65" />
          <circle cx="332" cy="356" r="7" fill="white" opacity="0.65" />
          {/* Subtle connection lines between nodes */}
          <line x1="148" y1="148" x2="196" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
          <line x1="364" y1="148" x2="316" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
          <line x1="140" y1="276" x2="196" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
          <line x1="372" y1="276" x2="316" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
          <line x1="140" y1="276" x2="200" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
          <line x1="372" y1="276" x2="312" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
          <line x1="180" y1="356" x2="200" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
          <line x1="332" y1="356" x2="312" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
        </svg>
      </div>

      {/* "Aether" text — shown for full variant or when showText=true */}
      {(variant === 'full' || showText) && (
        <span
          className="font-serif font-bold text-[#1a1a2e] tracking-tight"
          style={{ fontSize }}
        >
          Aether
        </span>
      )}
    </div>
  )
}

/**
 * Standalone SVG icon only — no background, no text.
 * Used for favicon, app icons, and places where
 * you need just the raw brain symbol on a custom background.
 */
export function AetherIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="256" cy="256" r="240" fill="#6D597A" />
      <path
        d="M256 96C256 96 180 96 148 148C116 200 116 240 140 276C164 312 180 328 180 356C180 384 164 404 164 404"
        stroke="white"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M256 96C256 96 332 96 364 148C396 200 396 240 372 276C348 312 332 328 332 356C332 384 348 404 348 404"
        stroke="white"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path d="M256 88L256 424" stroke="white" strokeWidth="8" strokeLinecap="round" opacity="0.5" />
      <path
        d="M256 160C220 160 196 180 196 220C196 260 220 280 256 280"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M256 160C292 160 316 180 316 220C316 260 292 280 256 280"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M256 300C224 300 200 320 200 350C200 380 224 396 256 396"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M256 300C288 300 312 320 312 350C312 380 288 396 256 396"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <circle cx="256" cy="88" r="10" fill="white" opacity="0.95" />
      <circle cx="256" cy="424" r="10" fill="white" opacity="0.95" />
      <circle cx="148" cy="148" r="9" fill="white" opacity="0.8" />
      <circle cx="364" cy="148" r="9" fill="white" opacity="0.8" />
      <circle cx="140" cy="276" r="8" fill="white" opacity="0.7" />
      <circle cx="372" cy="276" r="8" fill="white" opacity="0.7" />
      <circle cx="196" cy="220" r="7" fill="white" opacity="0.7" />
      <circle cx="316" cy="220" r="7" fill="white" opacity="0.7" />
      <circle cx="256" cy="160" r="8" fill="white" opacity="0.8" />
      <circle cx="256" cy="280" r="8" fill="white" opacity="0.8" />
      <circle cx="200" cy="350" r="6" fill="white" opacity="0.6" />
      <circle cx="312" cy="350" r="6" fill="white" opacity="0.6" />
      <circle cx="256" cy="396" r="7" fill="white" opacity="0.7" />
      <circle cx="180" cy="356" r="7" fill="white" opacity="0.65" />
      <circle cx="332" cy="356" r="7" fill="white" opacity="0.65" />
      <line x1="148" y1="148" x2="196" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
      <line x1="364" y1="148" x2="316" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
      <line x1="140" y1="276" x2="196" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="372" y1="276" x2="316" y2="220" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="140" y1="276" x2="200" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="372" y1="276" x2="312" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="180" y1="356" x2="200" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="332" y1="356" x2="312" y2="350" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
    </svg>
  )
}
