'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import LandingPage from '@/components/aether/LandingPage'

/* ═══════════════════════════════════════════════════════════════
   ROOT PAGE — Routing Bouncer

   Logic:
   1. Show a simple loading spinner while checking the Supabase session.
   2. If session exists (user is logged in): Redirect to /dashboard.
   3. If session is null (user is logged out): Render the <LandingPage />.
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
  const [showLanding, setShowLanding] = useState(false)
  const authInitializedRef = useRef(false)

  // If Supabase isn't configured, skip the check and show landing immediately
  const supabaseConfigured = isSupabaseConfigured()

  useEffect(() => {
    // Prevent double-initialization (React strict mode / HMR)
    if (authInitializedRef.current) return
    authInitializedRef.current = true

    if (!supabaseConfigured) {
      console.info('[Aether] Supabase not configured — showing landing page.')
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => setShowLanding(true))
      return
    }

    const supabase = createClient()
    let mounted = true

    const checkAuth = async () => {
      try {
        // Step 1: getSession() reads from local cookie storage (fast, no network)
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        if (session?.user) {
          // Session found — redirect to dashboard
          router.replace('/dashboard')
          return
        }

        // Step 2: No cookie session — validate with server
        const { data: { user } } = await supabase.auth.getUser()

        if (!mounted) return

        if (user) {
          // Authenticated via server validation
          router.replace('/dashboard')
        } else {
          // Not authenticated — show landing page
          setShowLanding(true)
        }
      } catch {
        if (mounted) {
          setShowLanding(true)
        }
      }
    }

    checkAuth()

    // Also listen for auth state changes (e.g. magic link callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        router.replace('/dashboard')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, supabaseConfigured])

  // If Supabase isn't configured and we haven't set state yet, show landing
  if (!supabaseConfigured && !showLanding) {
    return <LandingPage />
  }

  // If still checking (showLanding is false), show spinner
  if (!showLanding) {
    return <SimpleSpinner />
  }

  // Not authenticated — show the landing page
  return <LandingPage />
}
