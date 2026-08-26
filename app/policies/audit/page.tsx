'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'
import type { AuditAction } from '@/lib/audit'
import PolicyHubNav from '@/components/PolicyHubNav'

type AuditEntry = {
  id: string
  user_name: string
  action: AuditAction
  resource_type: string
  resource_name: string | null
  created_at: string
}

const ACTION_LABELS: Record<AuditAction, string> = {
  upload_document: 'uploaded',
  edit_document: 'edited the details of',
  replace_document: 'replaced the file for',
  delete_document: 'deleted',
  check_cqc: 'ran a CQC check on',
  run_gap_analysis: 'ran a gap analysis',
}

function formatDateTime(str: string) {
  return new Date(str).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const isManager = profile?.role === 'manager'

  useEffect(() => {
    getCurrentProfile().then(setProfile)
    fetchEntries()
  }, [])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('id, user_name, action, resource_type, resource_name, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    setEntries(data ?? [])
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 space-y-2">
        <div className="flex items-center gap-3">
          <a href="/policies" className="text-gray-500 text-sm">← Back</a>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
        </div>
        <PolicyHubNav />
      </div>

      <div className="p-4 space-y-3">
        {!isManager && profile && (
          <div className="bg-gray-100 rounded-xl p-4">
            <p className="text-sm text-gray-500">Only managers can view the audit log.</p>
          </div>
        )}

        {isManager && (
          <>
            <p className="text-xs text-gray-400">Most recent 200 actions across the policy library.</p>

            {loading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}

            {!loading && entries.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No activity recorded yet.</p>
            )}

            {!loading && entries.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">{entry.user_name}</span>{' '}
                  {ACTION_LABELS[entry.action] ?? entry.action}
                  {entry.resource_name && <> <span className="font-medium">"{entry.resource_name}"</span></>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(entry.created_at)}</p>
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
