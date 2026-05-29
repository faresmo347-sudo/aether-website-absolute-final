import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate environment variables at startup
if (typeof window !== 'undefined' && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.warn(
    '[Aether] Missing Supabase environment variables. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file. ' +
    'The app will run in demo/offline mode until these are configured.'
  )
}

// Singleton pattern — ensures only one Supabase client instance exists.
// This prevents race conditions where multiple instances read/write sessions
// to different cookie locations, which breaks persistence across tabs.
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  // If env vars are missing, return a mock client that won't crash
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (!client) {
      // Create a no-op client that won't throw
      client = createBrowserClient(
        'https://placeholder.supabase.co',
        'placeholder-key',
        {
          cookies: {
            getAll() { return [] },
            setAll() {},
          },
        }
      )
    }
    return client
  }

  if (client) return client

  client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        if (typeof document === 'undefined') return []
        return document.cookie.split(';').map((c) => {
          const [name, ...rest] = c.trim().split('=')
          return { name, value: rest.join('=') }
        })
      },
      setAll(cookiesToSet) {
        if (typeof document === 'undefined') return
        cookiesToSet.forEach(({ name, value, options }) => {
          // Always set path=/ to ensure cookies are visible across all routes
          // and persist when opening in a new tab or from a link.
          // Without this, cookies default to the current URL path, which can
          // cause session loss when navigating between tabs.
          let cookieString = `${name}=${value}; path=${options.path ?? '/'}`
          if (options.maxAge !== undefined) cookieString += `; max-age=${options.maxAge}`
          if (options.domain) cookieString += `; domain=${options.domain}`
          if (options.sameSite) cookieString += `; samesite=${options.sameSite}`
          if (options.secure) cookieString += '; secure'
          // Note: httpOnly cookies cannot be set via document.cookie (browser restriction).
          // Supabase auth tokens don't need httpOnly since they're read client-side.
          document.cookie = cookieString
        })
      },
    },
    // Disable realtime — we don't use any realtime subscriptions and this
    // eliminates the overhead of maintaining a WebSocket connection on auth pages.
    realtime: {
      transport: undefined as any, // Prevents WebSocket connection
    },
  })

  return client
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY &&
    SUPABASE_URL !== 'https://placeholder.supabase.co')
}

// Fast synchronous check for whether auth cookies exist.
// Used as a fast-path to show the dashboard immediately without waiting
// for the async getSession()/getUser() calls. Returns true if a Supabase
// auth cookie with a non-empty value is found — does NOT validate the
// token or check expiry. The async auth flow validates afterwards.
export function hasValidSession(): boolean {
  if (typeof document === 'undefined') return false
  const cookies = document.cookie.split(';')
  const authCookie = cookies.find(c => c.trim().startsWith('sb-'))
  if (!authCookie) return false
  try {
    const value = authCookie.split('=')[1]
    // A non-trivial cookie value strongly suggests a stored session
    return !!(value && value.length > 20)
  } catch {
    return false
  }
}
