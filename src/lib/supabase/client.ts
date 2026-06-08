import { createBrowserClient } from '@supabase/ssr'

// Hardcoded fallback credentials — ensures the app works even if
// environment variables fail to load (common in some deployment scenarios).
const SUPABASE_URL_FALLBACK = 'https://tbompcwyijpnzwlttkq.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRib21wY3d5aWpwbnZ3bHR0a3EiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3OTc4ODU2MSwiZXhwIjoyMDk1MzY0NTYxfQ.xVA7xccb34Uqd8fhR9HopF6KpSYYrKoX-nrpnvMl-88'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

// Validate environment variables at startup
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[Aether] Supabase environment variables not set. Running in demo mode. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for full functionality.'
  )
}

// Singleton pattern — ensures only one Supabase client instance exists.
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
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
    // Disable realtime — we don't use any realtime subscriptions
    realtime: {
      transport: undefined as any,
    },
  })

  return client
}

// Safe version of createClient that returns null instead of throwing
export function createClientSafe() {
  try {
    return createClient()
  } catch {
    return null
  }
}

// Fast synchronous check for whether auth cookies exist.
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
