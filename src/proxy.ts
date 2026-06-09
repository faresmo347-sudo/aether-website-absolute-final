import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/* ═══════════════════════════════════════════════════════════════
   PROXY (Next.js 16 replacement for middleware.ts)

   DOES ONE THING ONLY: Refresh Supabase sessions.

   NO route protection, NO redirects. The client-side auth context
   handles all redirects. Server-side redirects cause infinite
   redirect loops when Supabase is slow/unreachable on Vercel.
   ═══════════════════════════════════════════════════════════════ */

// Hardcoded fallback credentials
const SUPABASE_URL_FALLBACK = 'https://yxtlhqtyhnholgvldmjj.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGxocXR5aG5ob2xndmxkbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY4NzMsImV4cCI6MjA5NjUyMjg3M30.flt0Sp_K9pSjkdwa7xG7aFIZW72oj7FsJrk5c8GB9oo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

// Routes that should be handled by Next.js directly
const IGNORED_PREFIXES = [
  '/api/',
  '/_next/',
  '/favicon.ico',
  '/aether-icon.svg',
  '/aether-logo.png',
  '/aether-hero.png',
  '/aether-wave.png',
  '/logo.svg',
  '/robots.txt',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Skip proxy for API routes, static assets
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // 2. If Supabase is not configured, skip session refresh
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  // 3. Quick check: if no auth cookies exist, skip the Supabase getUser() call
  const hasAuthCookies = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.value.length > 20
  )

  if (!hasAuthCookies) {
    return NextResponse.next()
  }

  // 4. Refresh the Supabase session — NO REDIRECTS, just pass through
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              maxAge: options.maxAge ?? 60 * 60 * 24 * 365,
            })
          )
        },
      },
    })

    // Call getUser() with timeout to prevent hanging
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 5000)
      ),
    ])
  } catch (err) {
    console.warn('[Aether] Proxy: Supabase session refresh failed:', err)
  }

  // ALWAYS pass through — never redirect. Client handles auth.
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
