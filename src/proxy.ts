import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that should be handled by Next.js directly (API routes, static assets, etc.)
const IGNORED_PREFIXES = [
  '/api/',
  '/_next/',
  '/auth/',
  '/favicon.ico',
  '/aether-icon.svg',
  '/aether-logo.png',
  '/aether-hero.png',
  '/aether-wave.png',
  '/logo.svg',
  '/robots.txt',
]

// Routes that exist as actual Next.js pages or API routes
const EXISTING_ROUTES = [
  '/auth/callback',
]

// Routes that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/ask',
  '/constellations',
  '/settings',
  '/recaps',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Skip proxy for API routes, static assets
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // 2. For existing Next.js routes (like auth callback), refresh session
  if (EXISTING_ROUTES.some((route) => pathname === route)) {
    return updateSession(request)
  }

  // 3. Refresh Supabase session — critical for auth across tabs & direct links
  const supabaseResponse = await updateSession(request)

  // 4. Auth-based route protection (lightweight cookie check — no server-side validation)
  const hasAuthCookies =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('sb-refresh-token')?.value

  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  // If trying to access protected route without auth cookies → redirect to landing page
  if (isProtectedPath && !hasAuthCookies) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    const redirectResponse = NextResponse.redirect(redirectUrl)
    // Copy cookies from the session refresh
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  // 5. SPA routing: rewrite non-root paths to "/" so client-side router handles them.
  //    This ensures /dashboard, /ask, /collections, /settings all load the app
  //    instead of returning 404 on Vercel or direct URL access.
  if (pathname !== '/' && !pathname.includes('.')) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = '/'
    const rewriteResponse = NextResponse.rewrite(rewriteUrl)

    // Copy cookies from the Supabase session refresh to the rewrite response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie.name, cookie.value)
    })

    return rewriteResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
