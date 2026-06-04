'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to detect when the mobile virtual keyboard is open.
 *
 * Uses the Visual Viewport API when available (Chrome, Safari 13+),
 * falling back to window size heuristics for older browsers.
 *
 * Returns `true` when the keyboard is likely visible.
 */
export function useMobileKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    // Only run on mobile-like viewports
    if (typeof window === 'undefined') return
    if (window.innerWidth >= 768) return

    // Preferred: Visual Viewport API
    if (window.visualViewport) {
      const vv = window.visualViewport!

      const onResize = () => {
        // When the keyboard is open, the visual viewport height is significantly
        // less than the layout viewport height (typically > 100px difference)
        const heightDiff = window.innerHeight - vv.height
        setIsKeyboardOpen(heightDiff > 100)
      }

      vv.addEventListener('resize', onResize)
      // Also listen for scroll since iOS sometimes fires scroll but not resize
      vv.addEventListener('scroll', onResize)

      return () => {
        vv.removeEventListener('resize', onResize)
        vv.removeEventListener('scroll', onResize)
      }
    }

    // Fallback: listen for focus events on input/textarea elements
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        setIsKeyboardOpen(true)
      }
    }

    const onFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        // Small delay to allow for focus switching between inputs
        setTimeout(() => {
          const active = document.activeElement
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && !active.isContentEditable)) {
            setIsKeyboardOpen(false)
          }
        }, 100)
      }
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return isKeyboardOpen
}
