import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Hardcoded fallback credentials — ensures server-side auth works
// even if environment variables fail to load.
const SUPABASE_URL_FALLBACK = 'https://yxtlhqtyhnholgvldmjj.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4dGxocXR5aG5ob2xndmxkbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDY4NzMsImV4cCI6MjA5NjUyMjg3M30.flt0Sp_K9pSjkdwa7xG7aFIZW72oj7FsJrk5c8GB9oo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

// Validate at module load time
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Aether] CRITICAL: Missing Supabase environment variables on the server. ' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  })
}
