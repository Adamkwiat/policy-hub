import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only client using the service_role key -- bypasses RLS entirely.
// NEVER import this from a 'use client' component or expose it to the browser.
// Created on first use, so a build without the key (e.g. a preview) doesn't fail.
let client: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase admin key is not configured')
    client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return client
}
