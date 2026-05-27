import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  // If env vars are missing, create a placeholder client
  const url = SUPABASE_URL || 'https://placeholder.supabase.co'
  const key = SUPABASE_ANON_KEY || 'placeholder-key'

  return createServerClient(url, key, {
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

// Check if Supabase is properly configured on the server
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY &&
    SUPABASE_URL !== 'https://placeholder.supabase.co')
}
