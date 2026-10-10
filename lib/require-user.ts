import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// API routes are skipped by proxy.ts, so each one must check the session itself.
// Returns a 401 response when nobody is logged in, otherwise null.
export async function requireUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
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

  // getUser() checks the token with Supabase, unlike getSession() which trusts the cookie
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  return null
}
