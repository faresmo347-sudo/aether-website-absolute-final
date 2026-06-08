import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/ask',
  '/ask-aether',
  '/collections',
  '/constellations',
  '/recaps',
  '/settings',
  '/memory/',
]

// Routes that are always public (no auth needed)
const PUBLIC_ROUTES = [
  '/',
  '/privacy',
  '/terms',
]

export async function middleware(request: NextRequest) {
  // First, refresh the Supabase session (sets cookies, etc.)
  const supabaseResponse = await updateSession(request)

  // Check if the current path is a protected route
  const { pathname } = request.nextUrl
  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  )
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route)
  const isApiRoute = pathname.startsWith('/api/')
  const isAuthCallback = pathname.startsWith('/auth/')

  // Skip protection for public routes, API routes, and auth callbacks
  if (!isProtectedRoute || isPublicRoute || isApiRoute || isAuthCallback) {
    return supabaseResponse
  }

  // Check for auth cookies — if none exist, redirect to landing page
  const hasAccessToken = request.cookies.get('sb-access-token')?.value
  const hasRefreshToken = request.cookies.get('sb-refresh-token')?.value

  if (!hasAccessToken && !hasRefreshToken) {
    // No auth cookies → redirect to landing page
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    redirectUrl.searchParams.delete('XTransformPort')
    return NextResponse.redirect(redirectUrl)
  }

  // Auth cookies exist → let the request through
  // The client-side code will handle invalid/expired sessions
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
