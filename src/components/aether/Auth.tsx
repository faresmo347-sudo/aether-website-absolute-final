'use client'

import { useState, useEffect } from 'react'
import { Mail, Lock, User, ArrowLeft, Check, Loader2, Wifi, WifiOff } from 'lucide-react'
import { AetherLogo } from '@/components/aether/AetherLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

/* ─────────── Shared Types ─────────── */
type AuthScreen = 'signup' | 'signin' | 'forgot'

interface AuthProps {
  onSwitch: (screen: AuthScreen) => void
  onSuccess?: () => void
}

/* ─────────── Password Strength Calculator ─────────── */
function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
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

/* ─────────── Progressive Loading Message Hook ─────────── */
function useProgressiveLoading(loading: boolean) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) return

    // After 3 seconds: "Still working..."
    const t1 = setTimeout(() => setMessage('Still working...'), 3000)
    // After 6 seconds: connection warning
    const t2 = setTimeout(() => setMessage('This is taking longer than usual. Check your connection.'), 6000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      setMessage(null)
    }
  }, [loading])

  return message
}

/* ─────────── Animated Background Orbs + Stars ─────────── */
function AuthBackground() {
  // Generate static stars once
  const stars = useState(() =>
    Array.from({ length: typeof window !== 'undefined' && window.innerWidth < 768 ? 80 : 200 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.15,
    }))
  )[0]

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ background: '#0A0A14' }}>
      {/* Static background stars */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            background: `rgba(240, 240, 248, ${star.opacity})`,
          }}
        />
      ))}

      {/* Primary lavender orb */}
      <div
        className="absolute animate-float"
        style={{
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(157,139,167,0.18) 0%, rgba(157,139,167,0.04) 50%, transparent 70%)',
          top: '-10%',
          right: '-8%',
          filter: 'blur(40px)',
        }}
      />
      {/* Secondary teal orb */}
      <div
        className="absolute animate-float-delayed"
        style={{
          width: '250px',
          height: '250px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(128,203,196,0.12) 0%, rgba(128,203,196,0.02) 50%, transparent 70%)',
          bottom: '-5%',
          left: '-5%',
          filter: 'blur(40px)',
        }}
      />
      {/* Tertiary small lavender orb */}
      <div
        className="absolute animate-float-slow hidden sm:block"
        style={{
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(157,139,167,0.10) 0%, transparent 60%)',
          top: '50%',
          left: '30%',
          filter: 'blur(30px)',
        }}
      />
      {/* Subtle accent orb */}
      <div
        className="absolute animate-pulse-glow hidden sm:block"
        style={{
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(184,168,196,0.15) 0%, transparent 60%)',
          top: '20%',
          left: '10%',
          filter: 'blur(20px)',
        }}
      />
    </div>
  )
}

/* ─────────── Brain Logo Icon ─────────── */
function AetherBrainLogo() {
  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      <AetherLogo size={56} />
      <span className="font-serif text-2xl font-bold text-[#f0f0f8] tracking-tight">
        Aether
      </span>
    </div>
  )
}

/* ─────────── Shared Input Icon Wrapper ─────────── */
function IconWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9D8BA7]/50 pointer-events-none">
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SIGN UP COMPONENT
   ═══════════════════════════════════════════════════ */
export function SignUp({ onSwitch, onSuccess }: AuthProps) {
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
      const supabase = createClient()
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // If Supabase auto-confirms (no email verification), the user is
      // immediately authenticated. Try to create a profile row in that case.
      // If email confirmation is required, the profile will be created in
      // the auth callback route when they confirm.
      if (signUpData.user && signUpData.session) {
        // Auto-confirmed: user is already signed in
        try {
          await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            email,
            name,
            plan: 'free',
          }, { onConflict: 'id' })
        } catch {
          // Profile creation failure should not block signup
        }
      }

      // Show confirmation screen INSTANTLY — no additional processing
      setConfirmationSent(true)
      onSuccess?.()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="relative min-h-[100dvh] flex items-center justify-center overflow-y-auto py-4 pb-8">
        <AuthBackground />
        <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
          <div className="bg-[#0f0f1a] border border-[rgba(157,139,167,0.12)] rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-8 md:p-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-[rgba(74,222,128,0.1)] flex items-center justify-center">
                <Check size={28} className="text-[#4ade80]" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#f0f0f8] mb-2">
                  Check your email
                </h2>
                <p className="text-[rgba(240,240,248,0.45)] text-sm leading-relaxed">
                  We&apos;ve sent a confirmation link to <span className="font-medium text-[#f0f0f8]">{email}</span>.
                  Please check your inbox to confirm your account.
                </p>
              </div>
              <Button
                onClick={() => onSwitch('signin')}
                className="mt-4 w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200"
                style={{ border: 'none' }}
              >
                Continue to Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-y-auto py-4 pb-8">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
        <div className="bg-[#0f0f1a] border border-[rgba(157,139,167,0.12)] rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-8 md:p-10">
          {/* Logo & Tagline */}
          <AetherBrainLogo />
          <p className="text-center text-[rgba(240,240,248,0.45)] text-sm mb-8 -mt-2">
            Your mind, expanded
          </p>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] text-[#f87171] text-sm leading-relaxed">
              {error}
            </div>
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">
                Full Name
              </Label>
              <div className="relative">
                <IconWrapper>
                  <User size={17} />
                </IconWrapper>
                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#0A0A14] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#c084fc] focus-visible:ring-[rgba(192,132,252,0.1)] transition-all duration-200"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">
                Email
              </Label>
              <div className="relative">
                <IconWrapper>
                  <Mail size={17} />
                </IconWrapper>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#0A0A14] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#c084fc] focus-visible:ring-[rgba(192,132,252,0.1)] transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">
                Password
              </Label>
              <div className="relative">
                <IconWrapper>
                  <Lock size={17} />
                </IconWrapper>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#0A0A14] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#c084fc] focus-visible:ring-[rgba(192,132,252,0.1)] transition-all duration-200"
                />
              </div>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background:
                            strength.score >= level
                              ? strength.color
                              : 'rgba(157,139,167,0.12)',
                        }}
                      />
                    ))}
                  </div>
                  <p
                    className="text-xs font-medium transition-colors duration-300"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200 mt-2"
              style={{ border: 'none' }}
            >
              {loading ? (
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Creating account...
                  </span>
                  {progressiveMsg && (
                    <span className="text-xs opacity-70 flex items-center gap-1">
                      {progressiveMsg.includes('Check your connection') ? <WifiOff size={12} /> : <Wifi size={12} />}
                      {progressiveMsg}
                    </span>
                  )}
                </span>
              ) : (
                'Start Your Free Brain'
              )}
            </Button>
          </form>

          {/* Switch to Sign In */}
          <div className="text-center text-sm text-[rgba(240,240,248,0.45)] mt-8 flex items-center justify-center min-h-[44px]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onSwitch('signin')}
              className="text-[#c084fc] font-semibold hover:text-[#d4a5ff] transition-colors duration-150 px-2 py-1"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SIGN IN COMPONENT — OPTIMIZED FOR SPEED
   ═══════════════════════════════════════════════════ */
export function SignIn({ onSwitch, onSuccess }: AuthProps) {
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
      const supabase = createClient()

      // SINGLE CALL: authenticate with Supabase — nothing else
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      // After sign-in, ensure profile exists in the `profiles` table.
      // This handles users who signed up but may not have a profile row yet
      // (e.g. email confirmation just completed, or auto-confirm was enabled).
      // Fire-and-forget — don't block the UI.
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', authUser.id)
            .single()

          if (!existingProfile) {
            const name = authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || ''
            await supabase.from('profiles').upsert({
              id: authUser.id,
              email: authUser.email,
              name,
              plan: 'free',
            }, { onConflict: 'id' })
          }
        }
      } catch {
        // Profile check/creation failure should NOT block sign-in
      }

      // IMMEDIATELY call onSuccess — this navigates to dashboard INSTANTLY.
      // Data loading (profile, memories, collections) happens in the background
      // AFTER the user sees the dashboard with skeleton loading states.
      onSuccess?.()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-y-auto py-4 pb-8">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
        <div className="bg-[#0f0f1a] border border-[rgba(157,139,167,0.12)] rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-8 md:p-10">
          {/* Logo & Heading */}
          <AetherBrainLogo />
          <h1 className="text-center font-serif text-2xl font-bold text-[#f0f0f8] mb-1">
            Welcome back
          </h1>
          <p className="text-center text-[rgba(240,240,248,0.45)] text-sm mb-8">
            Sign in to access your second brain
          </p>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] text-[#f87171] text-sm leading-relaxed">
              {error}
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">
                Email
              </Label>
              <div className="relative">
                <IconWrapper>
                  <Mail size={17} />
                </IconWrapper>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#0A0A14] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#c084fc] focus-visible:ring-[rgba(192,132,252,0.1)] transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="signin-password" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => onSwitch('forgot')}
                  className="text-xs text-[#d4a5ff] font-semibold hover:text-white transition-colors duration-150 min-h-[44px] flex items-center"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <IconWrapper>
                  <Lock size={17} />
                </IconWrapper>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#0A0A14] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#c084fc] focus-visible:ring-[rgba(192,132,252,0.1)] transition-all duration-200"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200 mt-2"
              style={{ border: 'none' }}
            >
              {loading ? (
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Signing in...
                  </span>
                  {progressiveMsg && (
                    <span className="text-xs opacity-70 flex items-center gap-1">
                      {progressiveMsg.includes('Check your connection') ? <WifiOff size={12} /> : <Wifi size={12} />}
                      {progressiveMsg}
                    </span>
                  )}
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Switch to Sign Up */}
          <div className="text-center text-sm text-[rgba(240,240,248,0.45)] mt-8 flex items-center justify-center min-h-[44px]">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => onSwitch('signup')}
              className="text-[#c084fc] font-semibold hover:text-[#d4a5ff] transition-colors duration-150 px-2 py-1"
            >
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   FORGOT PASSWORD COMPONENT
   ═══════════════════════════════════════════════════ */
export function ForgotPassword({ onSwitch, onSuccess }: AuthProps) {
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
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSent(true)
      onSuccess?.()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="relative min-h-[100dvh] flex items-center justify-center overflow-y-auto py-4 pb-8">
        <AuthBackground />
        <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
          <div className="bg-[#0f0f1a] border border-[rgba(157,139,167,0.12)] rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-8 md:p-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-[rgba(157,139,167,0.1)] flex items-center justify-center">
                <Mail size={28} className="text-[#9D8BA7]" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#f0f0f8] mb-2">
                  Check your email
                </h2>
                <p className="text-[rgba(240,240,248,0.45)] text-sm leading-relaxed">
                  We&apos;ve sent a password reset link to <span className="font-medium text-[#f0f0f8]">{email}</span>.
                  Please check your inbox and follow the instructions.
                </p>
              </div>
              <Button
                onClick={() => onSwitch('signin')}
                className="mt-4 w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200"
                style={{ border: 'none' }}
              >
                <ArrowLeft size={16} className="mr-2" />
                Back to Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-y-auto py-4 pb-8">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-md mx-4 sm:mx-auto">
        <div className="bg-[#0f0f1a] border border-[rgba(157,139,167,0.12)] rounded-3xl shadow-2xl shadow-black/30 p-6 sm:p-8 md:p-10">
          {/* Logo & Heading */}
          <AetherBrainLogo />
          <h1 className="text-center font-serif text-2xl font-bold text-[#f0f0f8] mb-1">
            Reset password
          </h1>
          <p className="text-center text-[rgba(240,240,248,0.45)] text-sm mb-8">
            Enter your email and we&apos;ll send you a reset link
          </p>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.15)] text-[#f87171] text-sm leading-relaxed">
              {error}
            </div>
          )}

          {/* Reset Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-[#f0f0f8] text-sm font-medium cursor-pointer">
                Email
              </Label>
              <div className="relative">
                <IconWrapper>
                  <Mail size={17} />
                </IconWrapper>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base pl-11 rounded-xl border-[rgba(157,139,167,0.15)] bg-[#0A0A14] text-[#f0f0f8] placeholder:text-[#9D8BA7]/60 focus-visible:border-[#c084fc] focus-visible:ring-[rgba(192,132,252,0.1)] transition-all duration-200"
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-sm font-semibold bg-[#9D8BA7] hover:bg-[#7A6B85] text-white shadow-md shadow-[#9D8BA7]/20 transition-all duration-200 mt-2"
              style={{ border: 'none' }}
            >
              {loading ? (
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Sending link...
                  </span>
                  {progressiveMsg && (
                    <span className="text-xs opacity-70 flex items-center gap-1">
                      {progressiveMsg.includes('Check your connection') ? <WifiOff size={12} /> : <Wifi size={12} />}
                      {progressiveMsg}
                    </span>
                  )}
                </span>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          {/* Back to Sign In */}
          <button
            type="button"
            onClick={() => onSwitch('signin')}
            className="flex items-center justify-center gap-2 w-full text-sm text-[#9D8BA7] font-medium hover:text-[#c084fc] transition-colors duration-150 mt-8 min-h-[44px]"
          >
            <ArrowLeft size={14} />
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
