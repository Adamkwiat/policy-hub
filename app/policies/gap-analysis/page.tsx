'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'

type DocSummary = { name: string; category: string; cqc_standard: string | null }
type Gap = { area: string; standard: string; suggestion: string }
type Result = { gaps: Gap[]; coveredAreas: string[] }

export default function GapAnalysisPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [documents, setDocuments] = useState<DocSummary[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  const isManager = profile?.role === 'manager'

  useEffect(() => {
    getCurrentProfile().then(setProfile)
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    setLoadingDocs(true)
    const { data } = await supabase.from('documents').select('name, category, cqc_standard')
    setDocuments(data ?? [])
    setLoadingDocs(false)
  }

  async function runAnalysis() {
    setAnalysing(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents }),
      })
      if (!res.ok) { setError('Gap analysis failed. Please try again.'); return }
      setResult(await res.json())
    } finally {
      setAnalysing(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/policies" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900">Gap Analysis</h1>
      </div>

      <div className="p-4 space-y-4">
        {!isManager && profile && (
          <div className="bg-gray-100 rounded-xl p-4">
            <p className="text-sm text-gray-500">Only managers can run gap analysis.</p>
          </div>
        )}

        {isManager && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm text-blue-900">
                Compares your policy library's names, categories, and CQC tags against a general checklist of areas commonly expected of a CQC-regulated GP practice, and suggests what to add.
              </p>
              <p className="text-xs text-blue-700">
                It's a first-pass, name-and-tag-level check — not a deep read of every document's content. See{' '}
                <a href="/cqc-standards" className="underline font-semibold">CQC Standards Reference</a> for the checklist basis.
              </p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-sm text-red-600">{error}</p></div>}

            <button
              onClick={runAnalysis}
              disabled={loadingDocs || analysing}
              className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
            >
              {analysing ? 'Analysing...' : `Run gap analysis (${documents.length} polic${documents.length === 1 ? 'y' : 'ies'})`}
            </button>

            {result && (
              <>
                {result.gaps.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-sm text-green-700 font-semibold">No obvious gaps found against the checklist.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">{result.gaps.length} area{result.gaps.length !== 1 ? 's' : ''} to consider</p>
                    {result.gaps.map((gap, i) => (
                      <div key={i} className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-gray-900 text-sm">{gap.area}</h2>
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold shrink-0">{gap.standard}</span>
                        </div>
                        <p className="text-sm text-gray-600">{gap.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}

                {result.coveredAreas.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Looks covered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.coveredAreas.map(area => (
                        <span key={area} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{area}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
