import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/* ═══════════════════════════════════════════════════════════════
   PROXY (Next.js 16 replacement for middleware.ts)

   This does TWO critical things on every request:

   1. SUPABASE SESSION REFRESH (THE FIX):
      Creates a Supabase server client and calls getUser().
      This reads the session from cookies, refreshes the access
      token if expired, and writes the refreshed session back to
      cookies. WITHOUT THIS, sessions expire and users are logged
      out on every navigation.

   2. ROUTE PROTECTION:
      - Protected routes (/dashboard, /ask, /settings, /memory)
        redirect to / if no valid session exists
      - Auth-only routes (/auth) redirect to /dashboard if
        a valid session already exists
   ═══════════════════════════════════════════════════════════════ */

// Hardcoded fallback credentials
const SUPABASE_URL_FALLBACK = 'https://yxtlhqtyhnholgvldmjj.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGxocXR5aG5ob2xndmxkbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY4NzMsImV4cCI6MjA5NjUyMjg3M30.flt0Sp_K9pSjkdwa7xG7aFIZW72oj7FsJrk5c8GB9oo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

// Routes that should be handled by Next.js directly (API routes, static assets, etc.)
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

// Routes that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/ask',
  '/settings',
  '/memory',
]

// Routes that should redirect to dashboard if already authenticated
const AUTH_ONLY_PATHS = [
  '/auth',
]

// Timeout for the Supabase getUser() call — if Supabase is unreachable
// (paused project, DNS failure), we don't want the proxy to hang.
const SUPABASE_GETUSER_TIMEOUT_MS = 5000

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

  // Quick check: if no auth cookies exist, skip the Supabase getUser() call
  // entirely. This avoids a network request to Supabase on every page load
  // for unauthenticated users, making the landing page load much faster.
  const hasAuthCookies = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.value.length > 20
  )

  if (!hasAuthCookies) {
    // No auth cookies → user is definitely not signed in.
    // Apply route protection using the simple cookie check.
    return applyRouteProtection(request, null)
  }

  // ═══════════════════════════════════════════════════════════════
  // CRITICAL: Create Supabase server client and call getUser().
  //
  // This is the OFFICIAL way to refresh sessions in Next.js App Router.
  // getUser() reads the session from cookies, refreshes the access
  // token if expired using the refresh token, and writes the new
  // session back to cookies via setAll().
  // ═══════════════════════════════════════════════════════════════
  let supabaseResponse = NextResponse.next({ request })

  let user: any = null

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // First, set cookies on the request so supabase.auth.getUser() can read them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Create a new response with the updated request cookies
          supabaseResponse = NextResponse.next({ request })
          // Set cookies on the response so the browser receives them
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

    // Call getUser() with a timeout to prevent hanging on unreachable Supabase
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), SUPABASE_GETUSER_TIMEOUT_MS)
      ),
    ])

    if (result && 'data' in result) {
      user = result.data.user
    }
  } catch (err) {
    // If Supabase is unreachable or getUser() fails, continue without
    // session refresh. The client-side auth will handle it gracefully.
    console.warn('[Aether] Proxy: Supabase getUser() failed:', err)
  }

  return applyRouteProtection(request, user, supabaseResponse)
}

/**
 * Apply route protection based on the user's auth state.
 * If user is null (not authenticated), protected routes redirect to /.
 * If user is authenticated, auth-only routes redirect to /dashboard.
 */
function applyRouteProtection(
  request: NextRequest,
  user: any,
  response?: NextResponse
) {
  const { pathname } = request.nextUrl
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path))
  const isAuthOnlyPath = AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path))
  const isDemoMode = request.nextUrl.searchParams.get('demo') === 'true'

  // If trying to access protected route without a valid session → redirect to /
  if (isProtectedPath && !user && !isDemoMode) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    return NextResponse.redirect(redirectUrl)
  }

  // If accessing /auth with a valid session → redirect to /dashboard
  if (isAuthOnlyPath && user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // Return the response with updated cookies (if available)
  return response ?? NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
