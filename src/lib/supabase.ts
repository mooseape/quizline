import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export function isSupabaseConfigured() {
  return Boolean(url && anonKey)
}

export function missingSupabaseMessage() {
  return 'Online 1v1 needs Supabase. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the app.'
}

let client: SupabaseClient | null = null

export function getSupabase() {
  if (!url || !anonKey) return null
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
        storageKey: 'quizline-sb',
      },
    })
  }
  return client
}

export async function ensureAnonSession() {
  const supabase = getSupabase()
  if (!supabase) throw new Error(missingSupabaseMessage())
  const { data } = await supabase.auth.getSession()
  if (data.session) return
  const { error } = await supabase.auth.signInAnonymously()
  if (error) {
    throw new Error(
      'Turn on Anonymous sign-ins in the Supabase dashboard (Authentication → Providers → Anonymous).',
    )
  }
}
