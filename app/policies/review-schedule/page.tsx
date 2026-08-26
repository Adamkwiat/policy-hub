'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, reviewStatus } from '@/lib/documents'

type DocSummary = {
  id: string
  name: string
  category: string
  owner: string
  review_date: string | null
  cqc_standard: string | null
}

export default function ReviewSchedulePage() {
  const [documents, setDocuments] = useState<DocSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    setLoading(true)
    const { data } = await supabase
      .from('documents')
      .select('id, name, category, owner, review_date, cqc_standard')
      .order('review_date', { ascending: true, nullsFirst: false })
    setDocuments(data ?? [])
    setLoading(false)
  }

  const withDate = documents.filter(d => d.review_date)
  const noDate = documents.filter(d => !d.review_date)

  const overdue = withDate.filter(d => reviewStatus(d.review_date)?.label === 'Overdue')
  const dueSoon = withDate.filter(d => reviewStatus(d.review_date)?.label === 'Due soon')
  const upcoming = withDate.filter(d => !reviewStatus(d.review_date))

  function DocRow({ doc }: { doc: DocSummary }) {
    return (
      <a
        href={`/policies/${doc.id}/view`}
        target="_blank"
        rel="noreferrer"
        className="block bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{doc.category} · Owner: {doc.owner}</p>
          </div>
          <p className="text-xs font-semibold text-gray-600 shrink-0">{formatDate(doc.review_date)}</p>
        </div>
      </a>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/policies" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900">Review Schedule</h1>
      </div>

      <div className="p-4 space-y-5">
        {loading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}

        {!loading && documents.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No policies uploaded yet.</p>
        )}

        {!loading && overdue.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide">Overdue ({overdue.length})</p>
            {overdue.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        )}

        {!loading && dueSoon.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Due soon — next 30 days ({dueSoon.length})</p>
            {dueSoon.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        )}

        {!loading && upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Upcoming ({upcoming.length})</p>
            {upcoming.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        )}

        {!loading && noDate.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">No review date set ({noDate.length})</p>
            {noDate.map(doc => <DocRow key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>
    </main>
  )
}
