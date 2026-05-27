'use client'

import { useSyncExternalStore } from 'react'

// Singleton state to avoid re-renders from multiple hook instances
let isOnlineGlobal = true
let listeners: ((online: boolean) => void)[] = []

function subscribe(callback: (online: boolean) => void) {
  listeners.push(callback)
  return () => {
    listeners = listeners.filter((fn) => fn !== callback)
  }
}

function getSnapshot(): boolean {
  return isOnlineGlobal
}

function getServerSnapshot(): boolean {
  return true // Assume online during SSR
}

if (typeof window !== 'undefined') {
  isOnlineGlobal = navigator.onLine

  window.addEventListener('online', () => {
    isOnlineGlobal = true
    listeners.forEach((fn) => fn(true))
  })

  window.addEventListener('offline', () => {
    isOnlineGlobal = false
    listeners.forEach((fn) => fn(false))
  })
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// Non-hook getter for use in non-React code
export function getIsOnline(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}
