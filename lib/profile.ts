import { supabase } from './supabase'

export type Profile = {
  id: string
  display_name: string
  role: 'staff' | 'manager'
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', user.id)
    .single()

  if (data) return data

  // Auto-create profile for existing users who predate the trigger
  const display_name = user.email?.split('@')[0] ?? 'User'
  await supabase.from('profiles').insert({ id: user.id, display_name })
  return { id: user.id, display_name, role: 'staff' }
}
