import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-side Supabase client using the service-role key. This bypasses RLS,
// so it must NEVER be imported into client code (the `server-only` guard above
// makes a client import a build error). All DB access in the app funnels
// through API route handlers that use this client.

let cached: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        'in .env.local (see .env.example) and run supabase/migrations/0001_foundation.sql.'
    )
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

export const PHOTO_BUCKET = 'hotel-photos'
