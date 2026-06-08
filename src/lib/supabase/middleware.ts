import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hardcoded fallback credentials — ensures middleware auth works
// even if environment variables fail to load.
const SUPABASE_URL_FALLBACK = 'https://yxtlhqtyhnholgvldmjj.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGxocXR5aG5ob2xndmxkbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY4NzMsImV4cCI6MjA5NjUyMjg3M30.flt0Sp_K9pSjkdwa7xG7aFIZW72oj7FsJrk5c8GB9oo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

// Auth cookie names used by Supabase — checked to skip getUser() when no session exists
const AUTH_COOKIE_NAMES = ['sb-access-token', 'sb-refresh-token']

// Timeout for Supabase getUser() call when the project might be paused/unreachable.
// If the call doesn't complete within this time, we skip the session refresh
// and let the client-side auth handle it gracefully.
const SUPABASE_TIMEOUT_MS = 3000

// Module-level cache: tracks whether Supabase was reachable on the last attempt.
// Used by proxy.ts to decide whether to enforce auth redirects when Supabase
// is configured but the project is paused/unreachable.
let _supabaseReachable: boolean | null = null

// Timestamp of the last reachability check (to avoid checking too frequently)
let _lastReachabilityCheck = 0

// How long to cache the reachability result (5 minutes)
const REACHABILITY_CACHE_MS = 5 * 60 * 1000

/** Check if Supabase was recently detected as reachable/unreachable */
export function isSupabaseReachable(): boolean | null {
  // If we have a cached result that's still fresh, use it
  if (_supabaseReachable !== null && Date.now() - _lastReachabilityCheck < REACHABILITY_CACHE_MS) {
    return _supabaseReachable
  }
  // If the cache is stale, return null (unknown) to trigger a re-check
  if (_supabaseReachable !== null && Date.now() - _lastReachabilityCheck >= REACHABILITY_CACHE_MS) {
    _supabaseReachable = null
  }
  return _supabaseReachable
}

/**
 * Performs a lightweight reachability check against Supabase.
 * Tries to fetch the Supabase health/rest endpoint with a short timeout.
 * Updates the module-level _supabaseReachable cache.
 */
export async function checkSupabaseReachability(): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) {
    _supabaseReachable = false
    _lastReachabilityCheck = Date.now()
    return false
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)

    // Try to hit the Supabase REST API root (lightweight health check)
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        apikey: supabaseAnonKey,
      },
    })
    clearTimeout(timer)

    // Any response (even 401/404) means Supabase is reachable
    _supabaseReachable = true
    _lastReachabilityCheck = Date.now()
    return true
  } catch {
    // Network error, DNS failure, or timeout — Supabase is unreachable
    _supabaseReachable = false
    _lastReachabilityCheck = Date.now()
    return false
  }
}

/**
 * Wraps a promise with a timeout. Returns `null` if the promise doesn't
 * settle within the specified timeout, instead of rejecting/throwing.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // If Supabase is not configured, skip session refresh
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  // If we recently detected Supabase as unreachable (paused project, DNS failure),
  // skip the session refresh entirely. This prevents the middleware from hanging
  // on every request when Supabase is down, which can crash the server.
  if (_supabaseReachable === false && Date.now() - _lastReachabilityCheck < REACHABILITY_CACHE_MS) {
    supabaseResponse.headers.set('x-supabase-unreachable', '1')
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

  // Quick DNS/reachability pre-check before creating the Supabase client.
  // This prevents creating a client that will hang on unreachable hosts.
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { apikey: supabaseAnonKey },
    })
    clearTimeout(timer)
    _supabaseReachable = true
    _lastReachabilityCheck = Date.now()
  } catch {
    // Supabase is unreachable — mark it and skip
    _supabaseReachable = false
    _lastReachabilityCheck = Date.now()
    supabaseResponse.headers.set('x-supabase-unreachable', '1')
    return supabaseResponse
  }

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
            sameSite: 'lax',
            path: '/',
            maxAge: options.maxAge ?? 60 * 60 * 24 * 365,
          })
        )
      },
    },
  })

  try {
    const result = await withTimeout(supabase.auth.getUser(), SUPABASE_TIMEOUT_MS)
    if (result === null) {
      _supabaseReachable = false
      _lastReachabilityCheck = Date.now()
      supabaseResponse.headers.set('x-supabase-unreachable', '1')
    } else {
      _supabaseReachable = true
      _lastReachabilityCheck = Date.now()
    }
  } catch (err) {
    _supabaseReachable = false
    _lastReachabilityCheck = Date.now()
    supabaseResponse.headers.set('x-supabase-unreachable', '1')
  }

  return supabaseResponse
}
