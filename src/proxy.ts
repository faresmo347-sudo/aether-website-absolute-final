import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

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
  '/constellations',
  '/collections',
  '/recaps',
  '/settings',
  '/memory',
]

// Routes that should redirect to dashboard if already authenticated
const AUTH_ONLY_PATHS = [
  '/auth',
]

// Actual Next.js page routes — these should NOT be rewritten to /
const PAGE_ROUTES = [
  '/dashboard',
  '/auth',
  '/privacy',
  '/terms',
  '/ask',
  '/constellations',
  '/collections',
  '/recaps',
  '/settings',
  '/memory',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Skip proxy for API routes, static assets
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // 2. Skip for auth callback — just refresh session
  if (pathname === '/auth/callback') {
    return updateSession(request)
  }

  // 3. Refresh Supabase session — critical for auth across tabs & direct links
  const supabaseResponse = await updateSession(request)

  // 4. Auth-based route protection (lightweight cookie check — no server-side validation)
  const hasAuthCookies =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('sb-refresh-token')?.value ||
    // Also check for Supabase project-specific cookie prefix
    request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.value.length > 20)

  // If trying to access protected route without auth cookies → redirect to landing page
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path))
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

  // 5. If accessing /auth with valid session → redirect to dashboard
  const isAuthOnlyPath = AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path))
  if (isAuthOnlyPath && hasAuthCookies) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    const redirectResponse = NextResponse.redirect(redirectUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  // 6. For actual Next.js page routes, just pass through (Next.js will handle them)
  const isPageRoute = PAGE_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'))
  if (isPageRoute) {
    // Copy cookies from session refresh to the response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      supabaseResponse.cookies.set(cookie.name, cookie.value)
    })
    return supabaseResponse
  }

  // 7. SPA fallback: for any other non-root, non-static path, rewrite to "/"
  //    This ensures deep links that don't have a real page still load the app.
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
