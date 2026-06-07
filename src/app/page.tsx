'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientSafe } from '@/lib/supabase/client'
import LandingPage from '@/components/aether/LandingPage'

/* ═══════════════════════════════════════════════════════════════
   ROOT PAGE — Routing Bouncer (Bulletproof)

   Logic:
   1. Show a minimal loading spinner while checking the Supabase session.
   2. Validate session with BOTH getSession() AND getUser() before
      considering a user "authenticated".
   3. If authenticated: redirect to /dashboard.
   4. If NOT authenticated: render the <LandingPage />.
   5. Listen for SIGNED_OUT events to immediately show landing page.
   6. If Supabase is unreachable/paused, timeout gracefully and
      fall back to unauthenticated (landing page / demo mode).
   ═══════════════════════════════════════════════════════════════ */

// Timeout for Supabase auth calls when the project may be paused/unreachable.
const AUTH_TIMEOUT_MS = 5000

/**
 * Wraps a promise with a timeout. Returns a tuple of [result, timedOut].
 * If the promise doesn't settle within the timeout, returns [null, true].
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<[result: T | null, timedOut: boolean]> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<[null, true]>((resolve) => {
    timer = setTimeout(() => resolve([null, true]), ms)
  })
  return Promise.race([
    promise.then((r) => [r, false] as [T, false]),
    timeout,
  ]).finally(() => clearTimeout(timer))
}

function SimpleSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A14]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#c084fc] animate-spin" />
        <p className="text-xs text-white/40">Checking session...</p>
      </div>
    </div>
  )
}

function ConfigError() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A14]">
      <div className="max-w-md mx-4 text-center">
        <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Configuration Error</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          Supabase environment variables are missing. Please set{' '}
          <code className="text-[#9D8BA7] bg-white/5 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          and{' '}
          <code className="text-[#9D8BA7] bg-white/5 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
          in your environment.
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated' | 'error'>('checking')
  const initializedRef = useRef(false)

  useEffect(() => {
    // Prevent double-initialization (React strict mode / HMR)
    if (initializedRef.current) return
    initializedRef.current = true

    const supabase = createClientSafe()
    if (!supabase) {
      // Supabase not configured — show landing page (demo mode)
      // Users can still navigate to /dashboard to preview the UI
      console.warn('[Aether] Supabase not configured — showing landing page in demo mode.')
      queueMicrotask(() => setAuthState('unauthenticated'))
      return
    }

    let mounted = true

    const checkAuth = async () => {
      try {
        // Step 1: getSession() reads from local cookie storage (fast, no network)
        // Add timeout in case the Supabase project is paused/unreachable
        const [sessionResult, sessionTimedOut] = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS
        )
        if (!mounted) return

        if (sessionTimedOut) {
          // Supabase is unreachable — treat as unauthenticated
          console.warn('[Aether] Supabase getSession() timed out — Supabase may be paused/unreachable. Falling back to demo mode.')
          setAuthState('unauthenticated')
          return
        }

        const { data: { session } } = sessionResult

        if (!session?.user) {
          // No local session — definitely not authenticated
          setAuthState('unauthenticated')
          return
        }

        // Step 2: Validate the session with the server.
        // A stale/expired session will return null user from getUser().
        // Add timeout for the same unreachable-Supabase case.
        const [userResult, userTimedOut] = await withTimeout(
          supabase.auth.getUser(),
          AUTH_TIMEOUT_MS
        )
        if (!mounted) return

        if (userTimedOut) {
          // Supabase is unreachable — can't validate session, treat as unauthenticated
          console.warn('[Aether] Supabase getUser() timed out — cannot validate session. Falling back to demo mode.')
          setAuthState('unauthenticated')
          return
        }

        const { data: { user } } = userResult

        if (user) {
          // Validated — redirect to dashboard
          setAuthState('authenticated')
          router.replace('/dashboard')
        } else {
          // Stale session cookie — treat as unauthenticated
          // Clear the stale session to prevent ghost access
          try { await supabase.auth.signOut() } catch {}
          setAuthState('unauthenticated')
        }
      } catch {
        // Network error or other unexpected failure — treat as unauthenticated
        if (mounted) {
          console.warn('[Aether] Auth check failed — Supabase may be unreachable. Falling back to demo mode.')
          setAuthState('unauthenticated')
        }
      }
    }

    checkAuth()

    // Also listen for auth state changes (e.g. magic link callback, sign out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        setAuthState('authenticated')
        router.replace('/dashboard')
      } else if (event === 'SIGNED_OUT') {
        // User signed out (possibly from another tab) — show landing immediately
        setAuthState('unauthenticated')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  // Show config error if Supabase isn't configured
  if (authState === 'error') {
    return <ConfigError />
  }

  // Show spinner while checking auth
  if (authState === 'checking') {
    return <SimpleSpinner />
  }

  // Authenticated users get redirected to /dashboard (handled in useEffect)
  if (authState === 'authenticated') {
    return <SimpleSpinner />
  }

  // Unauthenticated — show the landing page
  return <LandingPage />
}
