'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/audit'
import { THEME_AREAS, type ThemeRow } from '@/lib/cqcThemes'

const YEARS_BACK = 2
const LOCATIONS_PER_STEP = 60

type Counts = { done: number; pending: number; failed: number }

async function step<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/cqc-reports/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
  return data as T
}

// The CQC Standards page section for inspection reports of other GP practices:
// what inspectors keep picking up on, by policy area, and (for managers) updating it from CQC.
export default function CqcReportThemes({ isManager }: { isManager: boolean }) {
  const [ready, setReady] = useState(true)
  const [themes, setThemes] = useState<ThemeRow[]>([])
  const [counts, setCounts] = useState<Counts>({ done: 0, pending: 0, failed: 0 })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const stopRef = useRef(false)

  const load = useCallback(async () => {
    const { data, error: themeError } = await supabase
      .from('cqc_report_themes')
      .select('area, themes, report_count, updated_at')
    // The tables are created by supabase/010_cqc_inspection_reports.sql
    setReady(!themeError)
    if (themeError) return
    setThemes(((data ?? []) as ThemeRow[]).sort((a, b) => THEME_AREAS.indexOf(a.area) - THEME_AREAS.indexOf(b.area)))
    const count = async (status: string) =>
      (await supabase.from('cqc_reports').select('link_id', { count: 'exact', head: true }).eq('status', status)).count ?? 0
    const [done, pending, failed] = await Promise.all([count('done'), count('pending'), count('failed')])
    setCounts({ done, pending, failed })
  }, [])

  useEffect(() => { load() }, [load])

  function stopped() {
    if (stopRef.current) throw new Error('Stopped. Press Update again to carry on.')
  }

  async function readAndSummarise() {
    let total = 0
    for (;;) {
      stopped()
      const r = await step<{ read: number; failed: number; remaining: number }>({ step: 'read' })
      total += r.read
      setProgress(`Reading reports: ${total} read, ${r.remaining} to go`)
      if (r.remaining === 0 || r.read + r.failed === 0) break
    }
    for (const [i, area] of THEME_AREAS.entries()) {
      stopped()
      setProgress(`Summarising what CQC picks up on: ${i + 1} of ${THEME_AREAS.length} areas`)
      await step({ step: 'summarise', area })
    }
  }

  async function update(fullUpdate: boolean) {
    setError('')
    setBusy(true)
    stopRef.current = false
    try {
      if (fullUpdate) {
        const since = new Date()
        since.setFullYear(since.getFullYear() - YEARS_BACK)
        const sinceText = since.toISOString().slice(0, 10)

        setProgress('Getting the list of GP practices from CQC...')
        const ids: string[] = []
        for (let page = 1, totalPages = 1; page <= totalPages; page++) {
          stopped()
          const r = await step<{ locationIds: string[]; totalPages: number }>({ step: 'list', page })
          ids.push(...r.locationIds)
          totalPages = r.totalPages
        }

        let found = 0
        for (let i = 0; i < ids.length; i += LOCATIONS_PER_STEP) {
          stopped()
          setProgress(`Finding recent reports: ${Math.min(i + LOCATIONS_PER_STEP, ids.length)} of ${ids.length} practices checked, ${found} reports found`)
          const r = await step<{ found: number }>({ step: 'locations', locationIds: ids.slice(i, i + LOCATIONS_PER_STEP), since: sinceText })
          found += r.found
        }
      }
      await readAndSummarise()
      await logAction({ action: 'update_cqc_reports', resourceType: 'cqc_reports', resourceName: 'CQC inspection reports' })
      setProgress('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setProgress('')
    }
    setBusy(false)
    await load()
  }

  const withThemes = themes.filter(t => t.themes.length)
  const lastUpdated = themes.reduce<string | null>((latest, t) => (!latest || t.updated_at > latest ? t.updated_at : latest), null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900">What CQC inspectors pick up on</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Findings from CQC’s published inspection reports of other GP practices over the last {YEARS_BACK} years, grouped by policy area. The CQC check stays strict on what’s missing or inadequate, and separately lists anything here that a policy lacks under “Picked up at other practices”. The policy chat uses them too.
        </p>
      </div>

      {!ready ? (
        <p className="text-sm text-amber-700">This needs a one-off database update (supabase/010_cqc_inspection_reports.sql) before it can be used.</p>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {counts.done} reports read
            {counts.pending ? ` · ${counts.pending} still to read` : ''}
            {counts.failed ? ` · ${counts.failed} couldn’t be read` : ''}
            {lastUpdated ? ` · updated ${new Date(lastUpdated).toLocaleDateString('en-GB')}` : ''}
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {progress && <p className="text-sm text-gray-500">{progress}</p>}

          {isManager && (
            busy ? (
              <button onClick={() => { stopRef.current = true }} className="w-full bg-gray-100 text-gray-700 rounded-xl py-2.5 font-semibold text-sm">
                Stop
              </button>
            ) : (
              <div className="space-y-2">
                <button onClick={() => update(true)} className="w-full bg-purple-600 text-white rounded-xl py-2.5 font-semibold text-sm">
                  {counts.done ? 'Update from CQC' : 'Read CQC inspection reports'}
                </button>
                {counts.pending > 0 && (
                  <button onClick={() => update(false)} className="w-full bg-white border border-purple-300 text-purple-700 rounded-xl py-2.5 font-semibold text-sm">
                    Carry on reading the {counts.pending} reports still to read
                  </button>
                )}
                <p className="text-[11px] text-gray-400">
                  The first update reads a couple of thousand reports and can take an hour or more. Keep this page open; if it stops, press the button again to carry on.
                </p>
              </div>
            )
          )}

          {withThemes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">Nothing read from CQC yet.</p>
          ) : (
            <div className="space-y-2">
              {withThemes.map(row => (
                <details key={row.area} className="border border-gray-100 rounded-lg p-2.5">
                  <summary className="text-sm font-semibold text-gray-900 cursor-pointer">
                    {row.area} <span className="text-xs font-normal text-gray-400">· {row.themes.length} themes from {row.report_count} reports</span>
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {row.themes.map(t => (
                      <li key={t.text} className="text-sm text-gray-700">
                        <span className={`text-[11px] font-semibold mr-1 ${t.type === 'must' ? 'text-red-700' : 'text-amber-700'}`}>
                          {t.type === 'must' ? 'MUST' : 'SHOULD'}
                        </span>
                        {t.text} <span className="text-xs text-gray-400">({t.reports} practices)</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
