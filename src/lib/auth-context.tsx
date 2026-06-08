'use client'

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { createClientSafe } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import { getInitials } from '@/lib/supabase/data'

/* ═══════════════════════════════════════════════════════════════
   AUTH CONTEXT — Single Source of Truth

   This provider uses Supabase's onAuthStateChange listener as the
   ONLY mechanism for detecting auth state. No page should independently
   call getSession() or getUser() to determine auth status.

   Flow:
   1. Provider mounts → isLoading = true
   2. onAuthStateChange fires INITIAL_SESSION → set session/user, isLoading = false
   3. Subsequent SIGNED_IN / SIGNED_OUT events update state
   4. Pages consume this context to decide what to render
   ═══════════════════════════════════════════════════════════════ */

export interface UserProfile {
  id: string
  name: string
  email: string
  initials: string
  plan: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isLoading: boolean     // True until INITIAL_SESSION fires
  isSignedIn: boolean    // True when we have a confirmed session
}

const DEFAULT_STATE: AuthState = {
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isSignedIn: false,
}

const AuthContext = createContext<AuthState>(DEFAULT_STATE)

export function useAuth() {
  return useContext(AuthContext)
}

// Module-level state store — allows setState to be called from
// onAuthStateChange callbacks without triggering the
// "set-state-in-effect" lint rule.
let authState: AuthState = DEFAULT_STATE
let listeners: Set<() => void> = new Set()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function setAuthState(newState: AuthState) {
  authState = newState
  emitChange()
}

function subscribeToAuthState(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getAuthStateSnapshot(): AuthState {
  return authState
}

// Initialize the Supabase auth listener once at module level.
// This ensures it runs before any component mounts and there's
// no "setState in effect" issue.
let authInitialized = false

function initializeAuthListener() {
  if (authInitialized) return
  authInitialized = true

  const supabase = createClientSafe()
  if (!supabase) {
    // No Supabase client available — not loading, no session
    setAuthState({ ...DEFAULT_STATE, isLoading: false })
    return
  }

  supabase.auth.onAuthStateChange((event, session) => {
    // INITIAL_SESSION fires once when the listener is first attached.
    // This is our signal that the auth state has been fully loaded.
    // SIGNED_IN fires on subsequent sign-ins.
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (session?.user) {
        const email = session.user.email || ''
        const name =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          email.split('@')[0]
        const initials = getInitials(name || email)

        setAuthState({
          session,
          user: session.user,
          profile: { id: session.user.id, name, email, initials, plan: 'free' },
          isLoading: false,
          isSignedIn: true,
        })
      } else {
        // No session after INITIAL_SESSION means user is not logged in
        setAuthState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          isSignedIn: false,
        })
      }
    } else if (event === 'SIGNED_OUT') {
      setAuthState({
        session: null,
        user: null,
        profile: null,
        isLoading: false,
        isSignedIn: false,
      })
    }
    // Ignore other events (PASSWORD_RECOVERY, MFA, etc.)
  })
}

// Initialize immediately when the module loads
if (typeof window !== 'undefined') {
  initializeAuthListener()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use useSyncExternalStore to subscribe to the module-level auth state.
  // This avoids the "set-state-in-effect" lint issue entirely.
  const state = useSyncExternalStore(
    subscribeToAuthState,
    getAuthStateSnapshot,
    // Server snapshot: always loading (we don't know auth state on the server)
    () => DEFAULT_STATE
  )

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  )
}
