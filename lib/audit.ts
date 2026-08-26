import { supabase } from './supabase'

export type AuditAction =
  | 'upload_document'
  | 'edit_document'
  | 'replace_document'
  | 'delete_document'
  | 'check_cqc'
  | 'run_gap_analysis'

export async function logAction({
  action,
  resourceType,
  resourceName,
}: {
  action: AuditAction
  resourceType: string
  resourceName?: string
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_name: profile?.display_name ?? user.email ?? 'Unknown',
    action,
    resource_type: resourceType,
    resource_name: resourceName ?? null,
  })
}
