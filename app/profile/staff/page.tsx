'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'

type StaffRow = {
  id: string
  display_name: string
  role: 'staff' | 'manager'
}

export default function ManageStaffPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const isManager = profile?.role === 'manager'

  useEffect(() => {
    getCurrentProfile().then(setProfile)
    fetchStaff()
  }, [])

  async function fetchStaff() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('id, display_name, role').order('display_name')
    setStaff(data ?? [])
    setLoading(false)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError('')
    setMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not signed in.'); setInviting(false); return }

    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), displayName: inviteName.trim(), accessToken: session.access_token }),
    })
    const body = await res.json().catch(() => null)

    if (!res.ok) {
      setError(body?.error ?? 'Could not send invite.')
    } else {
      setMessage(`Invite sent to ${inviteEmail.trim()}.`)
      setInviteEmail('')
      setInviteName('')
    }
    setInviting(false)
  }

  async function toggleRole(row: StaffRow) {
    const newRole = row.role === 'manager' ? 'staff' : 'manager'
    setUpdatingId(row.id)
    setError('')

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', row.id)
      .select()

    if (updateError) { setError(`Could not update role: ${updateError.message}`); setUpdatingId(null); return }
    if (!updated || updated.length === 0) { setError("Update didn't apply."); setUpdatingId(null); return }

    setStaff(prev => prev.map(s => s.id === row.id ? { ...s, role: newRole } : s))
    setUpdatingId(null)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/profile" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900">Manage Staff</h1>
      </div>

      <div className="p-4 space-y-4">
        {!isManager && profile && (
          <div className="bg-gray-100 rounded-xl p-4">
            <p className="text-sm text-gray-500">Only managers can invite or manage staff.</p>
          </div>
        )}

        {isManager && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
              <p className="font-semibold text-gray-900 text-sm">Invite someone new</p>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {message && <p className="text-sm text-green-600">{message}</p>}

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="e.g. Sarah Jones"
                  className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
                />
              </div>
              <button
                onClick={sendInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="w-full bg-purple-600 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send invite'}
              </button>
              <p className="text-xs text-gray-400">
                They'll get an email with a link to set their password. New accounts start as staff — promote them below once they've joined.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current staff</p>
              {loading && <p className="text-sm text-gray-400 text-center py-4">Loading...</p>}
              {!loading && staff.map(row => (
                <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{row.display_name}</p>
                    <p className="text-xs text-gray-400 uppercase">{row.role}</p>
                  </div>
                  <button
                    onClick={() => toggleRole(row)}
                    disabled={updatingId === row.id || row.id === profile?.id}
                    className="text-xs font-semibold text-purple-600 shrink-0 disabled:opacity-40"
                  >
                    {updatingId === row.id ? 'Updating...' : row.role === 'manager' ? 'Make staff' : 'Make manager'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
