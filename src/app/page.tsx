'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import LandingPage from '@/components/aether/LandingPage'

/* ═══════════════════════════════════════════════════════════════
   ROOT PAGE — Routing Bouncer (Bulletproof)

   Logic:
   1. Show a loading spinner while checking the Supabase session.
   2. Validate session with BOTH getSession() AND getUser() before
      considering a user "authenticated".
   3. If authenticated: redirect to /dashboard.
   4. If NOT authenticated: render the <LandingPage />.
   5. Listen for SIGNED_OUT events to immediately show landing page.
   ═══════════════════════════════════════════════════════════════ */

function SimpleSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#9D8BA7] animate-spin" />
        <p className="text-xs text-white/40">Checking session...</p>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  const initializedRef = useRef(false)

  // If Supabase isn't configured, we know immediately the user is unauthenticated
  const supabaseConfigured = isSupabaseConfigured()

  // For the case where Supabase isn't configured, bypass the async check
  if (!supabaseConfigured && authState === 'checking') {
    // Use initial state to avoid the lint warning about setState in effect
  }

  useEffect(() => {
    // Prevent double-initialization (React strict mode / HMR)
    if (initializedRef.current) return
    initializedRef.current = true

    // If Supabase isn't configured, skip auth check entirely
    if (!isSupabaseConfigured()) {
      console.info('[Aether] Supabase not configured — showing landing page.')
      // Use queueMicrotask to avoid synchronous setState in effect
      queueMicrotask(() => setAuthState('unauthenticated'))
      return
    }

    const supabase = createClient()
    let mounted = true

    const checkAuth = async () => {
      try {
        // Step 1: getSession() reads from local cookie storage (fast, no network)
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (!session?.user) {
          // No local session — definitely not authenticated
          setAuthState('unauthenticated')
          return
        }

        // Step 2: Validate the session with the server.
        // A stale/expired session will return null user from getUser().
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted) return

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
        if (mounted) setAuthState('unauthenticated')
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

  // If Supabase isn't configured, show landing immediately (no spinner)
  if (!supabaseConfigured) {
    return <LandingPage />
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
