'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AiReview } from '@/lib/cqcReview'

export const MAX_PICKED_PAGES = 8

type Page = { id: string; title: string; url: string; website_id: string }

// Shows which guidance a CQC check was based on. Managers can change the set
// (e.g. add a mythbuster the AI didn't pick); re-checks then use exactly that set.
export default function CqcGuidance({ review, canEdit, busy, onApply }: {
  review: AiReview
  canEdit: boolean
  busy: boolean
  onApply: (ids: string[], references: { title: string; url: string }[]) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [pages, setPages] = useState<Page[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const references = review.references ?? []

  useEffect(() => {
    if (!editing || pages) return
    supabase
      .from('reference_website_pages')
      .select('id, title, url, website_id')
      .order('title')
      .then(({ data, error }) => {
        if (error) { setLoadError('Could not load the guidance pages.'); return }
        const list = (data ?? []) as Page[]
        setPages(list)
        // Start from what the last check used (older checks only saved titles and links)
        const ids = review.reference_ids?.length
          ? review.reference_ids.filter(id => list.some(p => p.id === id))
          : list.filter(p => references.some(r => r.url === p.url)).map(p => p.id)
        setSelected(ids.slice(0, MAX_PICKED_PAGES))
      })
  }, [editing, pages, review]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    if (!pages) return []
    const q = search.trim().toLowerCase()
    const matches = q ? pages.filter(p => p.title.toLowerCase().includes(q)) : pages
    // Ticked pages first, so it's easy to see the current set
    return [...matches.filter(p => selected.includes(p.id)), ...matches.filter(p => !selected.includes(p.id))]
  }, [pages, search, selected])

  function toggle(id: string) {
    setSelected(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : prev.length >= MAX_PICKED_PAGES ? prev : [...prev, id])
  }

  async function apply() {
    if (!pages || selected.length === 0) return
    const chosen = selected.map(id => pages.find(p => p.id === id)!).filter(Boolean)
    await onApply(chosen.map(p => p.id), chosen.map(p => ({ title: p.title, url: p.url })))
    setEditing(false)
  }

  return (
    <div className="bg-white/60 border border-blue-100 rounded-lg p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-blue-800">Checked against</p>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} disabled={busy} className="text-[11px] font-semibold text-blue-700 underline disabled:opacity-50">
            Change guidance
          </button>
        )}
      </div>

      {!editing && (
        references.length > 0 ? (
          <ul className="space-y-0.5">
            {references.map(r => (
              <li key={r.url} className="text-[11px]">
                <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{r.title}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-blue-700">General CQC standards only (no reference pages were used).</p>
        )
      )}

      {editing && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-600">
            Tick the guidance this document should be checked against (up to {MAX_PICKED_PAGES}). Re-checks will always use this set.
          </p>
          {loadError && <p className="text-[11px] text-red-600">{loadError}</p>}
          {!pages && !loadError && <p className="text-[11px] text-gray-400">Loading...</p>}
          {pages && pages.length === 0 && (
            <p className="text-[11px] text-gray-500">No guidance pages yet. Add a reference website (such as GP mythbusters) on the CQC standards page.</p>
          )}
          {pages && pages.length > 0 && (
            <>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search, e.g. controlled drugs or 28"
                className="w-full bg-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none text-gray-900"
              />
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {shown.map(p => {
                  const ticked = selected.includes(p.id)
                  const full = !ticked && selected.length >= MAX_PICKED_PAGES
                  return (
                    <label key={p.id} className={`flex items-start gap-2 text-xs ${full ? 'text-gray-300' : 'text-gray-800'}`}>
                      <input type="checkbox" checked={ticked} disabled={full} onChange={() => toggle(p.id)} className="mt-0.5" />
                      <span>{p.title}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-[11px] text-gray-500">{selected.length} of {MAX_PICKED_PAGES} selected</p>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setSearch('') }} disabled={busy} className="flex-1 bg-white border border-gray-200 text-gray-600 rounded-lg py-1.5 text-xs font-semibold">
              Cancel
            </button>
            <button onClick={apply} disabled={busy || !pages || selected.length === 0} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50">
              {busy ? 'Checking...' : 'Save and re-check'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
