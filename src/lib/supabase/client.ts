import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Validate environment variables at startup
// Use console.warn (not error) to avoid triggering Next.js error overlay in demo mode
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[Aether] Supabase environment variables not set. Running in demo mode. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for full functionality.'
  )
}

// Singleton pattern — ensures only one Supabase client instance exists.
// This prevents race conditions where multiple instances read/write sessions
// to different cookie locations, which breaks persistence across tabs.
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // If env vars are genuinely missing, we cannot create a client.
    // This should never happen in production. Log the error and throw
    // so the caller knows auth is unavailable.
    console.warn('[Aether] Cannot create Supabase client — environment variables are missing.')
    throw new Error('Supabase environment variables are not configured.')
  }

  if (client) return client

  client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
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
          let cookieString = `${name}=${value}; path=${options.path ?? '/'}`
          if (options.maxAge !== undefined) cookieString += `; max-age=${options.maxAge}`
          if (options.domain) cookieString += `; domain=${options.domain}`
          if (options.sameSite) cookieString += `; samesite=${options.sameSite}`
          if (options.secure) cookieString += '; secure'
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

// Safe version of createClient that returns null instead of throwing
// Used in components that need to gracefully handle missing config
export function createClientSafe() {
  try {
    return createClient()
  } catch {
    return null
  }
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
    return !!(value && value.length > 20)
  } catch {
    return false
  }
}
