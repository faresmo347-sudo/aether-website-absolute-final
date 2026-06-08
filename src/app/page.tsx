'use client'

import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import LandingPage from '@/components/aether/LandingPage'

/* ═══════════════════════════════════════════════════════════════
   ROOT PAGE — Auth Bouncer (Hard Redirect Version)

   Uses the AuthContext (onAuthStateChange) as the SINGLE source
   of truth for auth state.

   CRITICAL: Uses window.location.href for ALL auth redirects.
   DO NOT use router.push or router.replace — Next.js caches
   them and causes the auth loop.

   Flow:
   1. AuthContext.isLoading === true → Show spinner, wait.
   2. AuthContext.isLoading === false + isSignedIn === true →
      Hard redirect: window.location.href = '/dashboard'
      This forces a FULL page reload, destroying the Next.js
      cache and forcing the server to read the new cookies.
   3. AuthContext.isLoading === false + isSignedIn === false →
      Show <LandingPage />
   ═══════════════════════════════════════════════════════════════ */

function SimpleSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#c084fc] animate-spin" />
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    </div>
  )
}

export default function Home() {
  const { isLoading, isSignedIn } = useAuth()

  useEffect(() => {
    // Only redirect once auth state is fully resolved AND user is signed in.
    // CRITICAL: Use window.location.href, NOT router.replace.
    // The hard redirect forces a full page reload, destroys the
    // Next.js router cache, and forces the server to read the
    // new Supabase session cookies.
    if (!isLoading && isSignedIn) {
      window.location.href = '/dashboard'
    }
  }, [isLoading, isSignedIn])

  // CRITICAL: While auth state is loading, show ONLY a spinner.
  // Do NOT render the Landing Page or Dashboard yet. Just wait.
  if (isLoading) {
    return <SimpleSpinner />
  }

  // Auth state resolved: user is signed in → spinner while redirect happens
  if (isSignedIn) {
    return <SimpleSpinner />
  }

  // Auth state resolved: user is NOT signed in → show the Landing Page
  return <LandingPage />
}
