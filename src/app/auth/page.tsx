'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClientSafe } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Lock,
  User,
  ArrowLeft,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   AUTH PAGE — Hard Redirect Auth Flow

   CRITICAL: Uses window.location.href for ALL auth redirects.
   DO NOT use router.push or router.replace — Next.js caches
   them and causes the auth loop.

   After successful sign-in/sign-up, we use a hard browser
   redirect (window.location.href = '/dashboard') which:
   1. Forces a FULL page reload
   2. Destroys the Next.js router cache
   3. Forces the server to re-read the new Supabase cookies
   4. Guarantees the dashboard sees the authenticated session
   ═══════════════════════════════════════════════════════════════ */

const AUTH_TIMEOUT_MS = 12000

// Deterministic star positions
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const STAR_DATA = (() => {
  const rand = seededRandom(42)
  return Array.from({ length: 35 }, (_, i) => ({
    id: i,
    left: `${rand() * 100}%`,
    top: `${rand() * 100}%`,
    size: rand() > 0.7 ? 2 : 1,
    delay: `${rand() * 4}s`,
    duration: `${2 + rand() * 3}s`,
  }))
})()

function friendlyAuthError(msg: string): string {
  if (msg === 'Failed to fetch' || msg.includes('fetch'))
    return 'Unable to connect to the authentication service. Please check your internet connection.'
  if (msg.includes('timeout') || msg.includes('Timeout'))
    return 'Connection timed out. Please try again in a moment.'
  if (msg.includes('Invalid login credentials'))
    return 'Invalid email or password. Please try again.'
  if (msg.includes('User already registered'))
    return 'An account with this email already exists. Try signing in instead.'
  if (msg.includes('Password should be'))
    return 'Password is too weak. Please use at least 6 characters.'
  if (msg.includes('Email not confirmed'))
    return 'Please check your email and confirm your account before signing in.'
  return msg
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<[result: T | null, timedOut: boolean]> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<[null, true]>((resolve) => {
    timer = setTimeout(() => resolve([null, true]), ms)
  })
  return Promise.race([
    promise.then((r) => [r, false] as [T, false]),
    timeout,
  ]).finally(() => clearTimeout(timer))
}

type AuthScreen = 'signin' | 'signup' | 'forgot'

function getPasswordStrength(password: string) {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return { score: 1, label: 'Weak', color: '#f87171' }
  if (score <= 3) return { score: 2, label: 'Medium', color: '#fbbf24' }
  return { score: 3, label: 'Strong', color: '#4ade80' }
}

function useProgressiveLoading(loading: boolean) {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!loading) return
    const t1 = setTimeout(() => setMessage('Still working...'), 3000)
    const t2 = setTimeout(() => setMessage('This is taking longer than usual. Check your connection.'), 6000)
    return () => { clearTimeout(t1); clearTimeout(t2); setMessage(null) }
  }, [loading])
  return message
}

// ═══════════════════════════════════════════════════════════════
// STARRY NIGHT AURORA BACKGROUND
// ═══════════════════════════════════════════════════════════════
function StarryAuroraBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ background: '#050510' }}>
      <div
        className="absolute"
        style={{
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(147,51,234,0.25) 0%, rgba(147,51,234,0.06) 50%, transparent 70%)',
          top: '-10%', left: '-5%', filter: 'blur(120px)',
          animation: 'aurora-drift-1 15s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute"
        style={{
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.03) 50%, transparent 70%)',
          bottom: '-15%', right: '-8%', filter: 'blur(150px)',
          animation: 'aurora-drift-2 18s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute"
        style={{
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.02) 50%, transparent 70%)',
          top: '40%', left: '35%', filter: 'blur(100px)',
          animation: 'aurora-drift-3 12s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute"
        style={{
          width: '500px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,146,60,0.06) 0%, rgba(251,146,60,0.02) 50%, transparent 70%)',
          bottom: '-10%', left: '-8%', filter: 'blur(130px)',
          animation: 'aurora-drift-warm 20s ease-in-out infinite alternate',
        }}
      />
      {STAR_DATA.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: star.left, top: star.top,
            width: `${star.size}px`, height: `${star.size}px`,
            animation: `twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// LOADING SPINNER (shown while waiting for auth context redirect)
// ═══════════════════════════════════════════════════════════════
function AuthSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-white/10 border-t-[#c084fc] animate-spin" />
        <p className="text-xs text-white/30">Signing you in...</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// AUTH PAGE
// ═══════════════════════════════════════════════════════════════
export default function AuthPage() {
  const { isLoading, isSignedIn } = useAuth()
  const [screen, setScreen] = useState<AuthScreen>('signup')
  const [postSignInLoading, setPostSignInLoading] = useState(false)

  // If auth context says user is already signed in, HARD redirect.
  // This handles the case where a signed-in user navigates to /auth.
  // CRITICAL: Use window.location.href, NOT router.replace.
  useEffect(() => {
    if (!isLoading && isSignedIn) {
      window.location.href = '/dashboard'
    }
  }, [isLoading, isSignedIn])

  // If auth is still loading, or user just signed in and we're waiting
  // for the redirect, show a spinner instead of the auth form.
  if (isLoading || postSignInLoading || isSignedIn) {
    return <AuthSpinner />
  }

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-y-auto py-8 pb-12">
      <StarryAuroraBackground />

      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
        {/* Back to home */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-purple-400 transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>

        {/* Glassmorphic Card — V2 Premium */}
        <div className="relative">
          {/* Breathing glow backdrop */}
          <div
            className="absolute -inset-5 rounded-[36px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(147,51,234,0.12) 0%, rgba(99,102,241,0.06) 40%, transparent 70%)',
              animation: 'auth-card-breathe 4s ease-in-out infinite',
            }}
          />
          {/* Animated gradient border */}
          <div
            className="p-[1px] rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(157,139,167,0.5), rgba(192,132,252,0.6), rgba(125,211,232,0.4), rgba(192,132,252,0.6), rgba(157,139,167,0.5))',
              backgroundSize: '300% 300%',
              animation: 'gradient-border-breathe 6s ease infinite',
            }}
          >
          <div
            className="bg-[#0a0a1a]/85 backdrop-blur-[40px] rounded-[23px] p-8 md:p-10 shadow-2xl"
            style={{ boxShadow: '0 25px 60px -12px rgba(88, 28, 135, 0.3), 0 0 60px rgba(147,51,234,0.08), inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
          {/* Logo — V2 Premium */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: [0.4, 0, 0.2, 1], delay: 0.5 }}
            >
              <div className="auth-logo-ring">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 relative z-10">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
              </div>
            </motion.div>
            <span className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-inter)' }}>
              Aether
            </span>
          </div>

          {/* Screen Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-inter)' }}>
              {screen === 'signin' && 'Welcome back'}
              {screen === 'signup' && 'Create your account'}
              {screen === 'forgot' && 'Reset password'}
            </h1>
            <p className="text-gray-400 text-sm">
              {screen === 'signin' && 'Sign in to access your second brain'}
              {screen === 'signup' && 'Your mind, expanded.'}
              {screen === 'forgot' && "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {screen === 'signin' && (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -20, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <SignInForm onSwitch={setScreen} onSignInSuccess={() => setPostSignInLoading(true)} />
              </motion.div>
            )}
            {screen === 'signup' && (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <SignUpForm onSwitch={setScreen} onSignUpSuccess={() => setPostSignInLoading(true)} />
              </motion.div>
            )}
            {screen === 'forgot' && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <ForgotForm onSwitch={setScreen} />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SIGN IN FORM
// ═══════════════════════════════════════════════════════════════
function SignInForm({ onSwitch, onSignInSuccess }: { onSwitch: (s: AuthScreen) => void; onSignInSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const progressiveMsg = useProgressiveLoading(loading)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClientSafe()
      if (!supabase) {
        setError('Authentication service is not available. Please try again later.')
        return
      }

      const [signInResult, signInTimedOut] = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_TIMEOUT_MS
      )
      if (signInTimedOut) {
        setError('Unable to connect to authentication service. Please try again later.')
        return
      }
      if (signInResult!.error) {
        setError(friendlyAuthError(signInResult!.error.message))
        return
      }

      // ═══════════════════════════════════════════════════════════
      // SIGN-IN SUCCEEDED!
      //
      // CRITICAL: Use window.location.href for a HARD redirect.
      // DO NOT use router.push — Next.js caches it and causes
      // the auth loop. The hard redirect forces a full page
      // reload, destroys the router cache, and forces the
      // server to read the new Supabase cookies.
      // ═══════════════════════════════════════════════════════════

      // Show spinner immediately
      onSignInSuccess()

      // Ensure profile exists (fire-and-forget)
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', authUser.id).single()
          if (!existingProfile) {
            const name = authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || ''
            await supabase.from('profiles').upsert({ id: authUser.id, email: authUser.email, name, plan: 'free' }, { onConflict: 'id' })
          }
        }
      } catch {}

      // HARD redirect — bypasses Next.js router cache entirely
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(friendlyAuthError(err?.message || 'An unexpected error occurred.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed shake-error">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="signin-email" className="text-sm font-medium text-gray-300 mb-1.5 block">
            Email
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400/50 pointer-events-none">
              <Mail size={17} />
            </div>
            <input
              id="signin-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:shadow-[0_0_20px_rgba(139,92,246,0.3)] focus:outline-none transition-all"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="signin-password" className="text-sm font-medium text-gray-300">
              Password
            </label>
            <button
              type="button"
              onClick={() => onSwitch('forgot')}
              className="text-xs text-purple-400 font-semibold hover:text-purple-300 transition-colors min-h-[44px] flex items-center"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400/50 pointer-events-none">
              <Lock size={17} />
            </div>
            <input
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 pl-11 pr-11 text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:shadow-[0_0_20px_rgba(139,92,246,0.3)] focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:scale-[1.015] hover:shadow-[0_0_30px_rgba(124,58,237,0.4),0_0_60px_rgba(147,51,234,0.1)] active:scale-[0.97] transition-all duration-300 shadow-lg shadow-purple-500/25 auth-btn-shimmer mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </span>
              {progressiveMsg && <span className="text-xs opacity-70">{progressiveMsg}</span>}
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
      <div className="text-center text-sm text-gray-400 mt-6 flex items-center justify-center min-h-[44px]">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitch('signup')}
          className="text-purple-400 font-semibold hover:text-purple-300 transition-colors px-2 py-1"
        >
          Sign up
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// SIGN UP FORM
// ═══════════════════════════════════════════════════════════════
function SignUpForm({ onSwitch, onSignUpSuccess }: { onSwitch: (s: AuthScreen) => void; onSignUpSuccess: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const progressiveMsg = useProgressiveLoading(loading)
  const strength = getPasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClientSafe()
      if (!supabase) {
        setError('Authentication service is not available. Please try again later.')
        return
      }

      const [signUpResult, signUpTimedOut] = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, name } },
        }),
        AUTH_TIMEOUT_MS
      )
      if (signUpTimedOut) {
        setError('Unable to connect to authentication service. Please try again later.')
        return
      }
      if (signUpResult!.error) {
        setError(friendlyAuthError(signUpResult!.error.message))
        return
      }

      // If signUp returned both user AND session, the user is auto-confirmed.
      if (signUpResult!.data.user && signUpResult!.data.session) {
        // Auto-confirmed — session is established.
        // Create profile, then redirect to dashboard with router.refresh()
        try {
          await supabase.from('profiles').upsert({
            id: signUpResult!.data.user.id, email, name, plan: 'free',
          }, { onConflict: 'id' })
        } catch {}

        // Show spinner
        onSignUpSuccess()

        // HARD redirect — bypasses Next.js router cache entirely
        window.location.href = '/dashboard'
        return
      }

      // Email confirmation required — show confirmation message
      setConfirmationSent(true)
    } catch (err: any) {
      setError(friendlyAuthError(err?.message || 'An unexpected error occurred.'))
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center confirm-pop">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check size={28} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            We&apos;ve sent a confirmation link to <span className="font-medium text-white">{email}</span>.
            Please check your inbox to confirm your account.
          </p>
        </div>
        <button
          onClick={() => onSwitch('signin')}
          className="mt-2 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:scale-[1.015] hover:shadow-[0_0_30px_rgba(124,58,237,0.4),0_0_60px_rgba(147,51,234,0.1)] active:scale-[0.97] transition-all duration-300 shadow-lg shadow-purple-500/25 auth-btn-shimmer"
        >
          Continue to Sign In
        </button>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed shake-error">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="signup-name" className="text-sm font-medium text-gray-300 mb-1.5 block">Full Name</label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400/50 pointer-events-none">
              <User size={17} />
            </div>
            <input
              id="signup-name"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:shadow-[0_0_20px_rgba(139,92,246,0.3)] focus:outline-none transition-all"
            />
          </div>
        </div>
        <div>
          <label htmlFor="signup-email" className="text-sm font-medium text-gray-300 mb-1.5 block">Email</label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400/50 pointer-events-none">
              <Mail size={17} />
            </div>
            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:shadow-[0_0_20px_rgba(139,92,246,0.3)] focus:outline-none transition-all"
            />
          </div>
        </div>
        <div>
          <label htmlFor="signup-password" className="text-sm font-medium text-gray-300 mb-1.5 block">Password</label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400/50 pointer-events-none">
              <Lock size={17} />
            </div>
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 pl-11 pr-11 text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:shadow-[0_0_20px_rgba(139,92,246,0.3)] focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {password.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className="h-1.5 flex-1 rounded-full transition-all duration-500 ease-out"
                    style={{ background: strength.score >= level ? strength.color : 'rgba(255,255,255,0.08)' }}
                  />
                ))}
              </div>
              <p className="text-xs font-medium transition-colors duration-300" style={{ color: strength.color }}>
                {strength.label}
              </p>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:scale-[1.015] hover:shadow-[0_0_30px_rgba(124,58,237,0.4),0_0_60px_rgba(147,51,234,0.1)] active:scale-[0.97] transition-all duration-300 shadow-lg shadow-purple-500/25 auth-btn-shimmer mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Creating account...
              </span>
              {progressiveMsg && <span className="text-xs opacity-70">{progressiveMsg}</span>}
            </span>
          ) : (
            'Start Your Free Brain'
          )}
        </button>
      </form>
      <div className="text-center text-sm text-gray-400 mt-6 flex items-center justify-center min-h-[44px]">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitch('signin')}
          className="text-purple-400 font-semibold hover:text-purple-300 transition-colors px-2 py-1"
        >
          Sign in
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// FORGOT PASSWORD FORM
// ═══════════════════════════════════════════════════════════════
function ForgotForm({ onSwitch }: { onSwitch: (s: AuthScreen) => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const progressiveMsg = useProgressiveLoading(loading)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClientSafe()
      if (!supabase) {
        setError('Authentication service is not available. Please try again later.')
        return
      }

      const [resetResult, resetTimedOut] = await withTimeout(
        supabase.auth.resetPasswordForEmail(email),
        AUTH_TIMEOUT_MS
      )
      if (resetTimedOut) {
        setError('Unable to connect. Please try again later.')
        return
      }
      if (resetResult!.error) { setError(friendlyAuthError(resetResult!.error.message)); return }
      setSent(true)
    } catch (err: any) {
      setError(friendlyAuthError(err?.message || 'An unexpected error occurred.'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center confirm-pop">
        <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center">
          <Mail size={28} className="text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            We&apos;ve sent a password reset link to <span className="font-medium text-white">{email}</span>.
          </p>
        </div>
        <button
          onClick={() => onSwitch('signin')}
          className="mt-2 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:scale-[1.015] hover:shadow-[0_0_30px_rgba(124,58,237,0.4),0_0_60px_rgba(147,51,234,0.1)] active:scale-[0.97] transition-all duration-300 shadow-lg shadow-purple-500/25 auth-btn-shimmer flex items-center justify-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Sign In
        </button>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed shake-error">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="forgot-email" className="text-sm font-medium text-gray-300 mb-1.5 block">Email</label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400/50 pointer-events-none">
              <Mail size={17} />
            </div>
            <input
              id="forgot-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:shadow-[0_0_20px_rgba(139,92,246,0.3)] focus:outline-none transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:scale-[1.015] hover:shadow-[0_0_30px_rgba(124,58,237,0.4),0_0_60px_rgba(147,51,234,0.1)] active:scale-[0.97] transition-all duration-300 shadow-lg shadow-purple-500/25 auth-btn-shimmer mt-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Sending link...
              </span>
              {progressiveMsg && <span className="text-xs opacity-70">{progressiveMsg}</span>}
            </span>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>
      <button
        type="button"
        onClick={() => onSwitch('signin')}
        className="flex items-center justify-center gap-2 w-full text-sm text-purple-400 font-medium hover:text-purple-300 transition-colors mt-6 min-h-[44px]"
      >
        <ArrowLeft size={14} />
        Back to Sign In
      </button>
    </>
  )
}
