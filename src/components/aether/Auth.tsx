'use client'

import { useState } from 'react'
import { Mail, Lock, User, ArrowLeft, Check, Loader2 } from 'lucide-react'
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

  if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' }
  if (score <= 3) return { score: 2, label: 'Medium', color: '#f59e0b' }
  return { score: 3, label: 'Strong', color: '#22c55e' }
}

/* ─────────── Animated Background Orbs ─────────── */
function AuthBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ background: '#FFFAF5' }}>
      {/* Primary lavender orb */}
      <div
        className="absolute animate-float"
        style={{
          width: '500px',
          height: '500px',
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
          width: '400px',
          height: '400px',
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
          width: '300px',
          height: '300px',
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
          width: '200px',
          height: '200px',
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
      <span className="font-serif text-2xl font-bold text-[#1a1a2e] tracking-tight">
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

  const strength = getPasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({
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
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
                <Check size={28} className="text-green-500" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#1a1a2e] mb-2">
                  Check your email
                </h2>
                <p className="text-[#6c757d] text-sm leading-relaxed">
                  We&apos;ve sent a confirmation link to <span className="font-medium text-[#1a1a2e]">{email}</span>.
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
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-10">
          {/* Logo & Tagline */}
          <AetherBrainLogo />
          <p className="text-center text-[#6c757d] text-sm mb-8 -mt-2">
            Your mind, expanded
          </p>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm leading-relaxed">
              {error}
            </div>
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="signup-name" className="text-[#1a1a2e] text-sm font-medium cursor-pointer">
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
                  className="h-12 text-base pl-11 rounded-xl border-[#9D8BA7]/15 bg-[#FFFAF5]/50 text-[#1a1a2e] placeholder:text-[#9D8BA7]/40 focus-visible:border-[#9D8BA7] focus-visible:ring-[#9D8BA7]/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="signup-email" className="text-[#1a1a2e] text-sm font-medium cursor-pointer">
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
                  className="h-12 text-base pl-11 rounded-xl border-[#9D8BA7]/15 bg-[#FFFAF5]/50 text-[#1a1a2e] placeholder:text-[#9D8BA7]/40 focus-visible:border-[#9D8BA7] focus-visible:ring-[#9D8BA7]/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="signup-password" className="text-[#1a1a2e] text-sm font-medium cursor-pointer">
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
                  className="h-12 text-base pl-11 rounded-xl border-[#9D8BA7]/15 bg-[#FFFAF5]/50 text-[#1a1a2e] placeholder:text-[#9D8BA7]/40 focus-visible:border-[#9D8BA7] focus-visible:ring-[#9D8BA7]/20 transition-all duration-200"
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
                              : '#e5e7eb',
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
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Start Your Free Brain'
              )}
            </Button>
          </form>

          {/* Switch to Sign In */}
          <div className="text-center text-sm text-[#6c757d] mt-8 flex items-center justify-center min-h-[44px]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onSwitch('signin')}
              className="text-[#9D8BA7] font-semibold hover:text-[#6D597A] transition-colors duration-150 px-2 py-1"
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
   SIGN IN COMPONENT
   ═══════════════════════════════════════════════════ */
export function SignIn({ onSwitch, onSuccess }: AuthProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

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
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-10">
          {/* Logo & Heading */}
          <AetherBrainLogo />
          <h1 className="text-center font-serif text-2xl font-bold text-[#1a1a2e] mb-1">
            Welcome back
          </h1>
          <p className="text-center text-[#6c757d] text-sm mb-8">
            Sign in to access your second brain
          </p>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm leading-relaxed">
              {error}
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="text-[#1a1a2e] text-sm font-medium cursor-pointer">
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
                  className="h-12 text-base pl-11 rounded-xl border-[#9D8BA7]/15 bg-[#FFFAF5]/50 text-[#1a1a2e] placeholder:text-[#9D8BA7]/40 focus-visible:border-[#9D8BA7] focus-visible:ring-[#9D8BA7]/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="signin-password" className="text-[#1a1a2e] text-sm font-medium cursor-pointer">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => onSwitch('forgot')}
                  className="text-xs text-[#9D8BA7] font-medium hover:text-[#6D597A] transition-colors duration-150 min-h-[44px] flex items-center"
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
                  className="h-12 text-base pl-11 rounded-xl border-[#9D8BA7]/15 bg-[#FFFAF5]/50 text-[#1a1a2e] placeholder:text-[#9D8BA7]/40 focus-visible:border-[#9D8BA7] focus-visible:ring-[#9D8BA7]/20 transition-all duration-200"
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
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Switch to Sign Up */}
          <div className="text-center text-sm text-[#6c757d] mt-8 flex items-center justify-center min-h-[44px]">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => onSwitch('signup')}
              className="text-[#9D8BA7] font-semibold hover:text-[#6D597A] transition-colors duration-150 px-2 py-1"
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
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
                <Mail size={28} className="text-[#9D8BA7]" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#1a1a2e] mb-2">
                  Check your email
                </h2>
                <p className="text-[#6c757d] text-sm leading-relaxed">
                  We&apos;ve sent a password reset link to <span className="font-medium text-[#1a1a2e]">{email}</span>.
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
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-10">
          {/* Logo & Heading */}
          <AetherBrainLogo />
          <h1 className="text-center font-serif text-2xl font-bold text-[#1a1a2e] mb-1">
            Reset password
          </h1>
          <p className="text-center text-[#6c757d] text-sm mb-8">
            Enter your email and we&apos;ll send you a reset link
          </p>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm leading-relaxed">
              {error}
            </div>
          )}

          {/* Reset Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-[#1a1a2e] text-sm font-medium cursor-pointer">
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
                  className="h-12 text-base pl-11 rounded-xl border-[#9D8BA7]/15 bg-[#FFFAF5]/50 text-[#1a1a2e] placeholder:text-[#9D8BA7]/40 focus-visible:border-[#9D8BA7] focus-visible:ring-[#9D8BA7]/20 transition-all duration-200"
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
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>

          {/* Back to Sign In */}
          <button
            type="button"
            onClick={() => onSwitch('signin')}
            className="flex items-center justify-center gap-2 w-full text-sm text-[#9D8BA7] font-medium hover:text-[#6D597A] transition-colors duration-150 mt-8 min-h-[44px]"
          >
            <ArrowLeft size={14} />
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
