'use client'

import { useCallback, useEffect } from 'react'
import { useAetherStore } from '@/store/aether-store'

/**
 * Centralized theme management hook.
 *
 * Single source of truth for:
 *  - Adding/removing the "dark" class on <html>
 *  - Setting data-theme="dark"|"light" attribute on <html> (used by CSS custom properties)
 *  - Persisting the preference to localStorage ('aether-theme' key)
 *  - Syncing the Zustand store's darkMode boolean with the DOM
 *
 * The blocking script in layout.tsx handles the initial paint to prevent flash.
 * This hook ensures ongoing sync whenever darkMode changes in the store.
 */
export function useTheme() {
  const darkMode = useAetherStore((s) => s.darkMode)
  const setDarkMode = useAetherStore((s) => s.setDarkMode)

  // Sync DOM with store state on mount and on every change
  useEffect(() => {
    applyTheme(darkMode)
  }, [darkMode])

  const toggleTheme = useCallback(() => {
    const newDark = !darkMode
    setDarkMode(newDark)
    applyTheme(newDark)
    persistTheme(newDark)
  }, [darkMode, setDarkMode])

  const setTheme = useCallback((dark: boolean) => {
    setDarkMode(dark)
    applyTheme(dark)
    persistTheme(dark)
  }, [setDarkMode])

  return { darkMode, toggleTheme, setTheme }
}

/** Apply theme classes and attributes to the <html> element */
function applyTheme(isDark: boolean) {
  if (typeof document === 'undefined') return

  if (isDark) {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.setAttribute('data-theme', 'light')
  }
}

/** Persist theme to localStorage */
function persistTheme(isDark: boolean) {
  try {
    localStorage.setItem('aether-theme', isDark ? 'dark' : 'light')
    // Also write to the key the store reads
    localStorage.setItem('aether-dark-mode', String(isDark))
  } catch {
    // localStorage unavailable
  }
}
