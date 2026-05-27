import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // If Supabase is not configured, skip session refresh
  // This prevents crashes when env vars are missing
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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
            // Set a long max-age so sessions persist across browser restarts.
            // Supabase manages the actual token expiry independently.
            maxAge: options.maxAge ?? 60 * 60 * 24 * 365, // 1 year default
          })
        )
      },
    },
  })

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // This will refresh the user's session if it's expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Session refresh is handled above via getUser().
  // All app views are managed client-side via Zustand state,
  // so no server-side route protection is needed here.

  return supabaseResponse
}
