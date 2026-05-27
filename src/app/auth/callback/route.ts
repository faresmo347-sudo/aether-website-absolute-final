import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // If "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  // If Supabase is not configured, redirect to home
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.redirect(`${origin}`)
  }

  if (code) {
    // Create a Supabase server client with proper cookie handling
    // so the session is persisted in cookies with path=/
    const res = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
      // The client-side onAuthStateChange will detect the session
      // and load the dashboard automatically.
      return res
    }

    console.error('Auth callback error:', error.message)
  }

  // Return the user to the app root on error
  return NextResponse.redirect(`${origin}`)
}
