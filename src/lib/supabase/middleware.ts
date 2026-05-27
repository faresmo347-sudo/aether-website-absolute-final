import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Auth cookie names used by Supabase — checked to skip getUser() when no session exists
const AUTH_COOKIE_NAMES = ['sb-access-token', 'sb-refresh-token']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // If Supabase is not configured, skip session refresh
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

  // Performance optimization: if there are no auth cookies at all,
  // skip the Supabase getUser() call entirely. This avoids a network
  // request to Supabase on every page load for unauthenticated users,
  // making the landing page and auth pages load significantly faster.
  const hasAuthCookies = AUTH_COOKIE_NAMES.some((name) =>
    request.cookies.get(name)?.value
  )

  if (!hasAuthCookies) {
    return supabaseResponse
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // First, set cookies on the request so the Supabase client can read them
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        // Then create a new response with the updated cookies
        supabaseResponse = NextResponse.next({ request })
        // Set cookies on the response so the browser persists them.
        // Always use path=/ so cookies are visible on all routes and persist
        // when opening in new tabs or from direct links.
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            sameSite: 'lax',
            path: '/',
            maxAge: options.maxAge ?? 60 * 60 * 24 * 365, // 1 year default
          })
        )
      },
    },
  })

  // This will refresh the user's session if it's expired.
  // Only runs when auth cookies are present (checked above).
  await supabase.auth.getUser()

  return supabaseResponse
}
