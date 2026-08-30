import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  const { email, displayName, accessToken } = await request.json()

  if (!email?.trim()) return Response.json({ error: 'No email provided' }, { status: 400 })
  if (!accessToken) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  // Verify the caller is actually signed in and a manager before using the admin key
  const callerClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user: caller } } = await callerClient.auth.getUser()
  if (!caller) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: callerProfile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'manager') {
    return Response.json({ error: 'Only managers can invite staff' }, { status: 403 })
  }

  const origin = new URL(request.url).origin

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim(), {
    redirectTo: `${origin}/reset-password`,
    data: displayName?.trim() ? { display_name: displayName.trim() } : undefined,
  })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
