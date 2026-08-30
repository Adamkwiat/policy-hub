import { createClient } from '@supabase/supabase-js'

// Server-only client using the service_role key -- bypasses RLS entirely.
// NEVER import this from a 'use client' component or expose it to the browser.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
