import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// A Supabase client acting as the logged-in user (from their session cookie),
// so row level security applies exactly as it does in the browser.
export async function serverSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}

// API routes are skipped by proxy.ts, so each one must check the session itself.
// Returns a 401 response when nobody is logged in, otherwise null.
export async function requireUser() {
  const supabase = await serverSupabase()
  // getUser() checks the token with Supabase, unlike getSession() which trusts the cookie
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  return null
}

// Like requireUser, but also returns 403 unless the user is a manager.
export async function requireManager() {
  const supabase = await serverSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'manager') return Response.json({ error: 'Only managers can do this' }, { status: 403 })
  return null
}
