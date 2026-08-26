'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type QA = { question: string; answer: string }

type PolicyRow = { name: string; category: string; cqc_standard: string | null; review_date: string | null; content: string | null }
type AuditRow = { name: string; audit_type: string; cqc_standard: string | null; reaudit_date: string | null; content: string | null }

const MAX_CHARS_PER_DOC = 6000
const MAX_CHARS_TOTAL = 60000

function formatDate(str: string | null) {
  if (!str) return 'no date set'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function buildContext(policies: PolicyRow[], audits: AuditRow[]): string {
  let used = 0
  const parts: string[] = []

  for (const p of policies) {
    if (!p.content?.trim() || used >= MAX_CHARS_TOTAL) continue
    const chunk = p.content.slice(0, MAX_CHARS_PER_DOC)
    parts.push(`[Policy] "${p.name}" — category: ${p.category}, CQC standard: ${p.cqc_standard ?? 'none'}, reviewed: ${formatDate(p.review_date)}\n${chunk}`)
    used += chunk.length
  }

  for (const a of audits) {
    if (!a.content?.trim() || used >= MAX_CHARS_TOTAL) continue
    const chunk = a.content.slice(0, MAX_CHARS_PER_DOC)
    parts.push(`[Audit] "${a.name}" — type: ${a.audit_type}, CQC standard: ${a.cqc_standard ?? 'none'}, next re-audit: ${formatDate(a.reaudit_date)}\n${chunk}`)
    used += chunk.length
  }

  return parts.join('\n\n---\n\n')
}

export default function AskAiPage() {
  const [context, setContext] = useState('')
  const [docCount, setDocCount] = useState(0)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<QA[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadContext()
  }, [])

  async function loadContext() {
    setLoadingDocs(true)
    const [{ data: policies }, { data: audits }] = await Promise.all([
      supabase.from('documents').select('name, category, cqc_standard, review_date, content'),
      supabase.from('audits').select('name, audit_type, cqc_standard, reaudit_date, content'),
    ])
    const p = policies ?? []
    const a = audits ?? []
    setDocCount(p.length + a.length)
    setContext(buildContext(p, a))
    setLoadingDocs(false)
  }

  async function askQuestion() {
    if (!question.trim()) return
    setLoading(true)
    const currentQuestion = question
    setQuestion('')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestion, context }),
      })
      const data = await res.json()
      setHistory(prev => [...prev, { question: currentQuestion, answer: data.answer ?? data.error ?? 'Sorry, something went wrong.' }])
    } catch {
      setHistory(prev => [...prev, { question: currentQuestion, answer: 'Sorry, something went wrong. Please try again.' }])
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/policies" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900">Ask AI</h1>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askQuestion()}
          placeholder="e.g. Do we have a policy for safeguarding?"
          disabled={loadingDocs}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none text-gray-900 disabled:opacity-50"
        />
        <button onClick={askQuestion} disabled={loading || loadingDocs} className="bg-purple-600 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg disabled:opacity-50">↑</button>
      </div>

      <div className="px-4 py-4 space-y-4 flex-1">
        {loadingDocs && <p className="text-center text-gray-400 text-sm mt-8">Loading your policies and audits...</p>}

        {!loadingDocs && history.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Ask about your {docCount} polic{docCount === 1 ? 'y' : 'ies'} and audits above 👆
          </p>
        )}

        {history.map((qa, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-end">
              <div className="bg-purple-600 rounded-xl rounded-tr-none px-4 py-2 max-w-xs"><p className="text-white text-sm">{qa.question}</p></div>
            </div>
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none px-4 py-3 max-w-sm shadow-sm"><p className="text-sm text-gray-900 whitespace-pre-wrap">{qa.answer}</p></div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none px-4 py-3 shadow-sm"><p className="text-sm text-gray-400">Thinking...</p></div>
          </div>
        )}
      </div>
    </main>
  )
}
