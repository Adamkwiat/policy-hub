import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  const { userId, accessToken } = await request.json()

  if (!userId) return Response.json({ error: 'No user given' }, { status: 400 })
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
    return Response.json({ error: 'Only managers can remove staff' }, { status: 403 })
  }

  if (userId === caller.id) {
    return Response.json({ error: "You can't remove your own account" }, { status: 400 })
  }

  // Deleting the auth user removes their profile (cascade) and their sign-in.
  // Documents, audits and audit log entries they created stay, with uploaded_by set to null.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ ok: true })
}
