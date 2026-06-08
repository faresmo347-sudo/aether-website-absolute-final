import { createBrowserClient } from '@supabase/ssr'

// Hardcoded fallback credentials — ensures the app works even if
// environment variables fail to load (common in some deployment scenarios).
const SUPABASE_URL_FALLBACK = 'https://yxtlhqtyhnholgvldmjj.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGxocXR5aG5ob2xndmxkbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY4NzMsImV4cCI6MjA5NjUyMjg3M30.flt0Sp_K9pSjkdwa7xG7aFIZW72oj7FsJrk5c8GB9oo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

// Validate environment variables at startup
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    '[Aether] Supabase environment variables not set. Running in demo mode. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for full functionality.'
  )
}

/* ═══════════════════════════════════════════════════════════════
   OFFICIAL SUPABASE SSR BROWSER CLIENT

   Uses createBrowserClient from @supabase/ssr with NO custom
   cookies configuration. The library handles cookie reading/writing
   automatically via document.cookie — this is the official, 
   bulletproof way for Next.js App Router.

   Do NOT add a custom `cookies` config here. The library's built-in
   cookie handling is specifically designed for the browser and works
   correctly with onAuthStateChange, signInWithPassword, etc.
   ═══════════════════════════════════════════════════════════════ */

// Singleton pattern — ensures only one Supabase client instance exists.
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Aether] Cannot create Supabase client — environment variables are missing.')
    throw new Error('Supabase environment variables are not configured.')
  }

  if (client) return client

  // Official @supabase/ssr browser client — no custom cookies config needed!
  // The library handles document.cookie reads/writes automatically.
  client = createBrowserClient(supabaseUrl, supabaseAnonKey)

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
