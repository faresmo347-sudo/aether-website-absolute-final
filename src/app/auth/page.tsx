'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowLeft, Check, Loader2, Wifi, WifiOff } from 'lucide-react'
import { AetherLogo } from '@/components/aether/AetherLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClientSafe } from '@/lib/supabase/client'
import { useAetherStore } from '@/store/aether-store'
import { getInitials } from '@/lib/supabase/data'

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

/* ─────────── Aurora Background ─────────── */
function AuroraBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ background: '#050505' }}>
      {/* Slow-moving aurora blur */}
      <div
        className="absolute animate-float"
        style={{
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(157,139,167,0.15) 0%, rgba(157,139,167,0.03) 50%, transparent 70%)',
          top: '-15%', right: '-10%', filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute animate-float-delayed"
        style={{
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(128,203,196,0.10) 0%, rgba(128,203,196,0.02) 50%, transparent 70%)',
          bottom: '-10%', left: '-8%', filter: 'blur(50px)',
        }}
      />
      <div
        className="absolute animate-float-slow hidden sm:block"
        style={{
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(157,139,167,0.08) 0%, transparent 60%)',
          top: '50%', left: '30%', filter: 'blur(40px)',
        }}
      />
    </div>
  )
}

/* ─────────── Icon Wrapper ─────────── */
function IconWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9D8BA7]/50 pointer-events-none">
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   AUTH PAGE — Sign In / Sign Up / Forgot Password
   ═══════════════════════════════════════════════════ */

export default function AuthPage() {
  const router = useRouter()
  const { setUser, setProfile } = useAetherStore()
  const [screen, setScreen] = useState<AuthScreen>('signin')

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    const supabase = createClientSafe()
    if (!supabase) return // Not configured — stay on auth page
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace('/dashboard')
      }
    })
  }, [router])

  // Listen for auth state changes (handles email confirmation callbacks)
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
    // Auth was successful — get user info and redirect
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
      <AuroraBackground />

      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
        {/* Back to home link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-[#9D8BA7] transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back to home
        </Link>

        {/* Glassmorphic Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/30 p-6 sm:p-8">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <AetherLogo size={56} />
            <span className="font-serif text-2xl font-bold text-[#f0f0f8] tracking-tight">Aether</span>
          </div>

          {/* Screen Title */}
          <div className="text-center mb-6">
            <h1 className="font-serif text-xl font-bold text-[#f0f0f8] mb-1">
              {screen === 'signin' && 'Welcome back'}
              {screen === 'signup' && 'Create your account'}
              {screen === 'forgot' && 'Reset password'}
            </h1>
            <p className="text-[rgba(240,240,248,0.45)] text-sm">
              {screen === 'signin' && 'Sign in to access your second brain'}
              {screen === 'signup' && 'Your mind, expanded'}
              {screen === 'forgot' && 'Enter your email and we\'ll send you a reset link'}
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

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
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
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] text-[#f87171] text-sm leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="signin-email" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">Email</Label>
          <div className="relative">
            <IconWrapper><Mail size={17} /></IconWrapper>
            <Input
              id="signin-email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required disabled={loading}
              className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#050505] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#9D8BA7]/40 transition-all duration-200"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">Password</Label>
            <button type="button" onClick={() => onSwitch('forgot')} className="text-xs text-[#d4a5ff] font-semibold hover:text-white transition-colors min-h-[44px] flex items-center">
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <IconWrapper><Lock size={17} /></IconWrapper>
            <Input
              id="signin-password" type="password" placeholder="Enter your password" value={password}
              onChange={(e) => setPassword(e.target.value)} required disabled={loading}
              className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#050505] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#9D8BA7]/40 transition-all duration-200"
            />
          </div>
        </div>

        <Button
          type="submit" disabled={loading}
          className="w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200 mt-2"
          style={{ border: 'none' }}
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" />Signing in...</span>
              {progressiveMsg && (
                <span className="text-xs opacity-70 flex items-center gap-1">
                  {progressiveMsg.includes('Check your connection') ? <WifiOff size={12} /> : <Wifi size={12} />}
                  {progressiveMsg}
                </span>
              )}
            </span>
          ) : 'Sign In'}
        </Button>
      </form>

      <div className="text-center text-sm text-[rgba(240,240,248,0.45)] mt-6 flex items-center justify-center min-h-[44px]">
        Don&apos;t have an account?{' '}
        <button type="button" onClick={() => onSwitch('signup')} className="text-[#c084fc] font-semibold hover:text-[#d4a5ff] transition-colors px-2 py-1">
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

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email, password, options: { data: { name } },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // If auto-confirmed (no email verification), user is immediately authenticated
      if (signUpData.user && signUpData.session) {
        try {
          await supabase.from('profiles').upsert({ id: signUpData.user.id, email, name, plan: 'free' }, { onConflict: 'id' })
        } catch {}
        onSuccess()
        return
      }

      // Email confirmation required — show confirmation screen
      setConfirmationSent(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-[rgba(74,222,128,0.1)] flex items-center justify-center">
          <Check size={28} className="text-[#4ade80]" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold text-[#f0f0f8] mb-2">Check your email</h2>
          <p className="text-[rgba(240,240,248,0.45)] text-sm leading-relaxed">
            We&apos;ve sent a confirmation link to <span className="font-medium text-[#f0f0f8]">{email}</span>.
            Please check your inbox to confirm your account.
          </p>
        </div>
        <Button
          onClick={() => onSwitch('signin')}
          className="mt-2 w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200"
          style={{ border: 'none' }}
        >
          Continue to Sign In
        </Button>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] text-[#f87171] text-sm leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="signup-name" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">Full Name</Label>
          <div className="relative">
            <IconWrapper><User size={17} /></IconWrapper>
            <Input
              id="signup-name" type="text" placeholder="Enter your name" value={name}
              onChange={(e) => setName(e.target.value)} required disabled={loading}
              className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#050505] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#9D8BA7]/40 transition-all duration-200"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">Email</Label>
          <div className="relative">
            <IconWrapper><Mail size={17} /></IconWrapper>
            <Input
              id="signup-email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required disabled={loading}
              className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#050505] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#9D8BA7]/40 transition-all duration-200"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">Password</Label>
          <div className="relative">
            <IconWrapper><Lock size={17} /></IconWrapper>
            <Input
              id="signup-password" type="password" placeholder="Create a password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={loading}
              className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#050505] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#9D8BA7]/40 transition-all duration-200"
            />
          </div>
          {password.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((level) => (
                  <div key={level} className="h-1.5 flex-1 rounded-full transition-all duration-300"
                    style={{ background: strength.score >= level ? strength.color : 'rgba(157,139,167,0.12)' }}
                  />
                ))}
              </div>
              <p className="text-xs font-medium transition-colors duration-300" style={{ color: strength.color }}>{strength.label}</p>
            </div>
          )}
        </div>

        <Button
          type="submit" disabled={loading}
          className="w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200 mt-2"
          style={{ border: 'none' }}
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" />Creating account...</span>
              {progressiveMsg && (
                <span className="text-xs opacity-70 flex items-center gap-1">
                  {progressiveMsg.includes('Check your connection') ? <WifiOff size={12} /> : <Wifi size={12} />}
                  {progressiveMsg}
                </span>
              )}
            </span>
          ) : 'Start Your Free Brain'}
        </Button>
      </form>

      <div className="text-center text-sm text-[rgba(240,240,248,0.45)] mt-6 flex items-center justify-center min-h-[44px]">
        Already have an account?{' '}
        <button type="button" onClick={() => onSwitch('signin')} className="text-[#c084fc] font-semibold hover:text-[#d4a5ff] transition-colors px-2 py-1">
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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
      if (resetError) { setError(resetError.message); return }
      setSent(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-[rgba(157,139,167,0.1)] flex items-center justify-center">
          <Mail size={28} className="text-[#9D8BA7]" />
        </div>
        <div>
          <h2 className="font-serif text-xl font-bold text-[#f0f0f8] mb-2">Check your email</h2>
          <p className="text-[rgba(240,240,248,0.45)] text-sm leading-relaxed">
            We&apos;ve sent a password reset link to <span className="font-medium text-[#f0f0f8]">{email}</span>.
          </p>
        </div>
        <Button
          onClick={() => onSwitch('signin')}
          className="mt-2 w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200"
          style={{ border: 'none' }}
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Sign In
        </Button>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] text-[#f87171] text-sm leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="forgot-email" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">Email</Label>
          <div className="relative">
            <IconWrapper><Mail size={17} /></IconWrapper>
            <Input
              id="forgot-email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required disabled={loading}
              className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#050505] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#9D8BA7]/40 transition-all duration-200"
            />
          </div>
        </div>

        <Button
          type="submit" disabled={loading}
          className="w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200 mt-2"
          style={{ border: 'none' }}
        >
          {loading ? (
            <span className="flex flex-col items-center gap-1">
              <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin" />Sending link...</span>
              {progressiveMsg && (
                <span className="text-xs opacity-70 flex items-center gap-1">
                  {progressiveMsg.includes('Check your connection') ? <WifiOff size={12} /> : <Wifi size={12} />}
                  {progressiveMsg}
                </span>
              )}
            </span>
          ) : 'Send Reset Link'}
        </Button>
      </form>

      <button
        type="button" onClick={() => onSwitch('signin')}
        className="flex items-center justify-center gap-2 w-full text-sm text-[#9D8BA7] font-medium hover:text-[#c084fc] transition-colors mt-6 min-h-[44px]"
      >
        <ArrowLeft size={14} />
        Back to Sign In
      </button>
    </>
  )
}
