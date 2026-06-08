import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Hardcoded fallback credentials — ensures auth callback works
// even if environment variables fail to load.
const SUPABASE_URL_FALLBACK = 'https://yxtlhqtyhnholgvldmjj.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGxocXR5aG5ob2xndmxkbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY4NzMsImV4cCI6MjA5NjUyMjg3M30.flt0Sp_K9pSjkdwa7xG7aFIZW72oj7FsJrk5c8GB9oo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // If "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  // If Supabase is not configured, redirect to home
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Aether] Auth callback failed — Supabase environment variables are missing.')
    return NextResponse.redirect(`${origin}`)
  }

  if (code) {
    // Create a Supabase server client with proper cookie handling
    // so the session is persisted in cookies with path=/
    const res = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          // Parse cookies from the request
          const cookieHeader = request.headers.get('cookie') ?? ''
          return cookieHeader.split(';').map((c) => {
            const [name, ...rest] = c.trim().split('=')
            return { name, value: rest.join('=') }
          })
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              maxAge: options.maxAge ?? 60 * 60 * 24 * 365,
            })
          })
        },
      },
    })

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Successfully exchanged code for session.
      // Now ensure the user has a profile row in the `profiles` table.
      // This handles the email confirmation flow where the user signed up
      // and just confirmed their email — the profile may not exist yet.
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || ''
          const email = user.email || ''

          // Upsert profile — if it already exists, this is a no-op
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              email,
              name,
              plan: 'free',
            }, { onConflict: 'id' })

          if (profileError) {
            console.warn('[Aether] Profile creation in callback warning:', profileError.message)
          }
        }
      } catch (profileErr) {
        // Profile creation failure should NOT block the redirect
        console.warn('[Aether] Profile creation in callback failed:', profileErr)
      }

      // The client-side onAuthStateChange will detect the session
      // and load the dashboard automatically.
      return res
    }

    console.error('Auth callback error:', error.message)
  }

  // Return the user to the app root on error
  return NextResponse.redirect(`${origin}`)
}
