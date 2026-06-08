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
  '/settings',
  '/memory',
]

// Routes that should redirect to dashboard if already authenticated
const AUTH_ONLY_PATHS = [
  '/auth',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Skip proxy for API routes, static assets
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // 2. Auth-based route protection (lightweight cookie check — no server-side validation)
  // The client-side auth in page.tsx handles the full session validation.
  // This just prevents unauthenticated users from loading protected page shells.
  const hasAuthCookies =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('sb-refresh-token')?.value ||
    // Also check for Supabase project-specific cookie prefix
    request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.value.length > 20)

  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  // If trying to access protected route without auth cookies → redirect to landing page
  if (isProtectedPath && !hasAuthCookies) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    return NextResponse.redirect(redirectUrl)
  }

  // 3. If accessing /auth with valid session → redirect to dashboard
  const isAuthOnlyPath = AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path))
  if (isAuthOnlyPath && hasAuthCookies) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // 4. For all other routes, just pass through
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
