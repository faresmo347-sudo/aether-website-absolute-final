'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowLeft, Check, Loader2, Eye, EyeOff } from 'lucide-react'
import { AetherLogo } from '@/components/aether/AetherLogo'
import { createClientSafe } from '@/lib/supabase/client'
import { useAetherStore } from '@/store/aether-store'
import { getInitials } from '@/lib/supabase/data'

// Timeout for Supabase auth calls when the project may be paused/unreachable.
const AUTH_TIMEOUT_MS = 12000

// Deterministic pseudo-random number generator (same results on server & client)
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Pre-computed star positions using a fixed seed — no hydration mismatch
const STAR_DATA = (() => {
  const rand = seededRandom(42)
  return Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${rand() * 100}%`,
    top: `${rand() * 100}%`,
    size: rand() > 0.7 ? 2 : 1,
    delay: `${rand() * 4}s`,
    duration: `${2 + rand() * 3}s`,
  }))
})()

// Map raw Supabase/network errors to user-friendly messages
function friendlyAuthError(msg: string): string {
  if (msg === 'Failed to fetch' || msg.includes('fetch')) {
    return 'Unable to connect to the authentication service. Please check your internet connection and try again.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return 'Connection timed out. The server may be temporarily unavailable — please try again in a moment.'
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.'
  }
  if (msg.includes('User already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (msg.includes('Password should be')) {
    return 'Password is too weak. Please use at least 6 characters.'
  }
  return msg
}

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

/* ─────────── Types ─────────── */
type AuthScreen = 'signin' | 'signup' | 'forgot'

/* ─────────── Password Strength ─────────── */
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

/* ─────────── Progressive Loading ─────────── */
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

/* ═══════════════════════════════════════════════════
   STARRY NIGHT AURORA BACKGROUND
   ═══════════════════════════════════════════════════ */
function StarryAuroraBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ background: '#050510' }}>
      {/* Aurora blur — top-left: purple */}
      <div
        className="absolute"
        style={{
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(147,51,234,0.2) 0%, rgba(147,51,234,0.05) 50%, transparent 70%)',
          top: '-10%',
          left: '-5%',
          filter: 'blur(120px)',
          animation: 'aurora-drift-1 15s ease-in-out infinite alternate',
        }}
      />
      {/* Aurora blur — bottom-right: blue */}
      <div
        className="absolute"
        style={{
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0.03) 50%, transparent 70%)',
          bottom: '-15%',
          right: '-8%',
          filter: 'blur(150px)',
          animation: 'aurora-drift-2 18s ease-in-out infinite alternate',
        }}
      />
      {/* Aurora blur — center: indigo */}
      <div
        className="absolute"
        style={{
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.02) 50%, transparent 70%)',
          top: '40%',
          left: '35%',
          filter: 'blur(100px)',
          animation: 'aurora-drift-3 12s ease-in-out infinite alternate',
        }}
      />

      {/* Twinkling Stars — pre-computed with deterministic seed */}
      {STAR_DATA.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animation: `twinkle ${star.duration} ease-in-out ${star.delay} infinite`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   AUTH PAGE — Sign In / Sign Up / Forgot Password
   ═══════════════════════════════════════════════════ */

export default function AuthPage() {
  const router = useRouter()
  const { setUser, setProfile } = useAetherStore()
  const [screen, setScreen] = useState<AuthScreen>('signup')

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    const supabase = createClientSafe()
    if (!supabase) return
    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS).then(([result, timedOut]) => {
      if (timedOut) return
      if (result?.data?.session?.user) {
        router.replace('/dashboard')
      }
    }).catch(() => {})
  }, [router])

  // Listen for auth state changes
  useEffect(() => {
    const supabase = createClientSafe()
    if (!supabase) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        const email = session.user.email || ''
        const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split('@')[0]
        const initials = getInitials(name || email)
        setUser({ id: session.user.id, name, email, initials, plan: 'free' })
        setProfile({ id: session.user.id, name, email, initials, plan: 'free' })
        router.replace('/dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, setUser, setProfile])

  const handleAuthSuccess = useCallback(async () => {
    try {
      const supabase = createClientSafe()
      if (supabase) {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const email = authUser.email || ''
          const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0]
          const initials = getInitials(name || email)
          setUser({ id: authUser.id, name, email, initials, plan: 'free' })
          setProfile({ id: authUser.id, name, email, initials, plan: 'free' })
        }
      }
    } catch {
      // Profile fetch failed — still redirect
    }
    router.replace('/dashboard')
  }, [router, setUser, setProfile])

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-y-auto py-8 pb-12">
      <StarryAuroraBackground />

      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
        {/* Back to home link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-purple-400 transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>

        {/* ─── Glassmorphic Card ─── */}
        <div
          className="bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-8 md:p-10 shadow-2xl"
          style={{ boxShadow: '0 25px 60px -12px rgba(88, 28, 135, 0.2)' }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <AetherLogo size={56} />
            <span className="font-serif text-2xl font-bold text-white tracking-tight">Aether</span>
          </div>

          {/* Screen Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
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

          {/* Sign In Form */}
          {screen === 'signin' && <SignInForm onSwitch={setScreen} onSuccess={handleAuthSuccess} />}
          {screen === 'signup' && <SignUpForm onSwitch={setScreen} onSuccess={handleAuthSuccess} />}
          {screen === 'forgot' && <ForgotForm onSwitch={setScreen} />}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SIGN IN FORM
   ═══════════════════════════════════════════════════ */

function SignInForm({ onSwitch, onSuccess }: { onSwitch: (s: AuthScreen) => void; onSuccess: () => void }) {
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
        setError('Supabase is not configured. Please set environment variables.')
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

      if (signInResult.error) {
        setError(friendlyAuthError(signInResult.error.message))
        return
      }

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

      onSuccess()
    } catch {
      setError('Unable to connect to authentication service. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed">
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
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
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
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-11 pr-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
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
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </span>
              {progressiveMsg && (
                <span className="text-xs opacity-70">{progressiveMsg}</span>
              )}
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

/* ═══════════════════════════════════════════════════
   SIGN UP FORM
   ═══════════════════════════════════════════════════ */

function SignUpForm({ onSwitch, onSuccess }: { onSwitch: (s: AuthScreen) => void; onSuccess: () => void }) {
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
        setError('Supabase is not configured. Please set environment variables.')
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

      if (signUpResult.error) {
        setError(friendlyAuthError(signUpResult.error.message))
        return
      }

      // If auto-confirmed (no email verification), user is immediately authenticated
      if (signUpResult.data.user && signUpResult.data.session) {
        try {
          await supabase.from('profiles').upsert({
            id: signUpResult.data.user.id,
            email,
            name,
            plan: 'free',
          }, { onConflict: 'id' })
        } catch {}
        onSuccess()
        return
      }

      // Email confirmation required — show confirmation screen
      setConfirmationSent(true)
    } catch {
      setError('Unable to connect to authentication service. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
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
          className="mt-2 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20"
        >
          Continue to Sign In
        </button>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div>
          <label htmlFor="signup-name" className="text-sm font-medium text-gray-300 mb-1.5 block">
            Full Name
          </label>
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
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="signup-email" className="text-sm font-medium text-gray-300 mb-1.5 block">
            Email
          </label>
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
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signup-password" className="text-sm font-medium text-gray-300 mb-1.5 block">
            Password
          </label>
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
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-11 pr-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
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
                    className="h-1.5 flex-1 rounded-full transition-all duration-300"
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

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Creating account...
              </span>
              {progressiveMsg && (
                <span className="text-xs opacity-70">{progressiveMsg}</span>
              )}
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

/* ═══════════════════════════════════════════════════
   FORGOT PASSWORD FORM
   ═══════════════════════════════════════════════════ */

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
        setError('Supabase is not configured.')
        return
      }
      const [resetResult, resetTimedOut] = await withTimeout(
        supabase.auth.resetPasswordForEmail(email),
        AUTH_TIMEOUT_MS
      )
      if (resetTimedOut) {
        setError('Unable to connect to authentication service. Please try again later.')
        return
      }
      if (resetResult.error) { setError(friendlyAuthError(resetResult.error.message)); return }
      setSent(true)
    } catch {
      setError('Unable to connect to authentication service. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
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
          className="mt-2 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
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
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="forgot-email" className="text-sm font-medium text-gray-300 mb-1.5 block">
            Email
          </label>
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
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-11 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Sending link...
              </span>
              {progressiveMsg && (
                <span className="text-xs opacity-70">{progressiveMsg}</span>
              )}
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
