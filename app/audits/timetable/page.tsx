'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/documents'
import AuditsNav from '@/components/AuditsNav'

type AuditSummary = {
  id: string
  name: string
  audit_type: string
  owner: string
  audit_date: string | null
  reaudit_date: string | null
}

function reauditStatus(reaudit_date: string | null) {
  if (!reaudit_date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(reaudit_date + 'T00:00:00')
  const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return 'Overdue'
  if (daysLeft <= 30) return 'Due soon'
  return null
}

export default function AuditsTimetablePage() {
  const [audits, setAudits] = useState<AuditSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAudits()
  }, [])

  async function fetchAudits() {
    setLoading(true)
    const { data } = await supabase
      .from('audits')
      .select('id, name, audit_type, owner, audit_date, reaudit_date')
      .order('reaudit_date', { ascending: true, nullsFirst: false })
    setAudits(data ?? [])
    setLoading(false)
  }

  const withDate = audits.filter(a => a.reaudit_date)
  const noDate = audits.filter(a => !a.reaudit_date)

  const overdue = withDate.filter(a => reauditStatus(a.reaudit_date) === 'Overdue')
  const dueSoon = withDate.filter(a => reauditStatus(a.reaudit_date) === 'Due soon')
  const upcoming = withDate.filter(a => !reauditStatus(a.reaudit_date))

  function AuditRow({ a }: { a: AuditSummary }) {
    return (
      <a
        href={`/audits/${a.id}/view`}
        target="_blank"
        rel="noreferrer"
        className="block bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{a.audit_type} · Owner: {a.owner} · Audited: {formatDate(a.audit_date)}</p>
          </div>
          <p className="text-xs font-semibold text-gray-600 shrink-0">{formatDate(a.reaudit_date)}</p>
        </div>
      </a>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 space-y-2">
        <div className="flex items-center gap-3">
          <a href="/audits" className="text-gray-500 text-sm">← Back</a>
          <h1 className="text-xl font-semibold text-gray-900">Re-audit Timetable</h1>
        </div>
        <AuditsNav />
      </div>

      <div className="p-4 space-y-5">
        {loading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}

        {!loading && audits.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No audits uploaded yet.</p>
        )}

        {!loading && overdue.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Overdue ({overdue.length})</p>
            {overdue.map(a => <AuditRow key={a.id} a={a} />)}
          </div>
        )}

        {!loading && dueSoon.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Due soon — next 30 days ({dueSoon.length})</p>
            {dueSoon.map(a => <AuditRow key={a.id} a={a} />)}
          </div>
        )}

        {!loading && upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Upcoming ({upcoming.length})</p>
            {upcoming.map(a => <AuditRow key={a.id} a={a} />)}
          </div>
        )}

        {!loading && noDate.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">No re-audit date set ({noDate.length})</p>
            {noDate.map(a => <AuditRow key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </main>
  )
}
