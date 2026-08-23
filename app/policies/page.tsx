'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'

const CATEGORIES = ['Clinical', 'HR', 'Health & Safety', 'Information Governance', 'Safeguarding', 'Complaints', 'Other']
const CQC_STANDARDS = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']

type AiReview = {
  standard: string | null
  assessment: string
  gaps: string[]
}

type Document = {
  id: string
  name: string
  category: string
  owner: string
  review_date: string | null
  storage_path: string
  cqc_standard: string | null
  content: string | null
  ai_review: AiReview | null
  uploaded_by: string
  created_at: string
}

function formatDate(str: string | null) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function reviewStatus(reviewDate: string | null) {
  if (!reviewDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(reviewDate + 'T00:00:00')
  const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: 'Overdue', className: 'bg-red-100 text-red-700' }
  if (daysLeft <= 30) return { label: 'Due soon', className: 'bg-amber-100 text-amber-700' }
  return null
}

export default function PoliciesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload form state (shown after a file is picked, before saving the row)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPath, setPendingPath] = useState('')
  const [pendingContent, setPendingContent] = useState('')
  const [formCategory, setFormCategory] = useState(CATEGORIES[0])
  const [formOwner, setFormOwner] = useState('')
  const [formReviewDate, setFormReviewDate] = useState('')
  const [formCqcStandard, setFormCqcStandard] = useState('')
  const [saving, setSaving] = useState(false)
  const [analysingCqc, setAnalysingCqc] = useState(false)
  const [aiReview, setAiReview] = useState<AiReview | null>(null)
  const [checkCqcEnabled, setCheckCqcEnabled] = useState(false)
  const [checkingDocId, setCheckingDocId] = useState<string | null>(null)

  function toggleCheckCqc(checked: boolean) {
    setCheckCqcEnabled(checked)
    if (checked && !aiReview && !analysingCqc && pendingContent.trim() && pendingFile) {
      analyseCqc(pendingContent, pendingFile.name)
    }
  }

  const [previewingDoc, setPreviewingDoc] = useState<Document | null>(null)

  const isManager = profile?.role === 'manager'

  useEffect(() => {
    getCurrentProfile().then(setProfile)
    fetchDocuments()
  }, [])

  async function fetchDocuments() {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false })
    if (!data) return
    setDocuments(data)

    const urls: Record<string, string> = {}
    await Promise.all(data.map(async (doc: Document) => {
      const { data: signed } = await supabase.storage.from('policies').createSignedUrl(doc.storage_path, 60 * 60)
      if (signed) urls[doc.id] = signed.signedUrl
    }))
    setSignedUrls(urls)
  }

  const filtered = useMemo(() => {
    return documents.filter(d => {
      if (categoryFilter && d.category !== categoryFilter) return false
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return d.name.toLowerCase().includes(q)
        || d.category.toLowerCase().includes(q)
        || d.owner.toLowerCase().includes(q)
        || (d.cqc_standard ?? '').toLowerCase().includes(q)
        || (d.content ?? '').toLowerCase().includes(q)
    })
  }, [documents, search, categoryFilter])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { setError('File must be under 50 MB'); return }

    setError('')
    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const storagePath = `${user.id}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage.from('policies').upload(storagePath, file)
    if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setUploading(false); return }

    let content = ''
    const nameLower = file.name.toLowerCase()
    if (nameLower.endsWith('.pdf') || nameLower.endsWith('.docx')) {
      const extractForm = new FormData()
      extractForm.append('file', file)
      const extractRes = await fetch('/api/extract-text', { method: 'POST', body: extractForm })
      if (extractRes.ok) content = (await extractRes.json()).text ?? ''
    }

    setPendingFile(file)
    setPendingPath(storagePath)
    setPendingContent(content)
    setFormCategory(CATEGORIES[0])
    setFormOwner('')
    setFormReviewDate('')
    setFormCqcStandard('')
    setAiReview(null)
    setCheckCqcEnabled(false)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function analyseCqc(content: string, documentName: string) {
    setAnalysingCqc(true)
    try {
      const res = await fetch('/api/check-cqc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, document_name: documentName }),
      })
      if (res.ok) {
        const review: AiReview = await res.json()
        setAiReview(review)
        setFormCqcStandard(prev => {
          if (prev) return prev // manager already picked one manually
          return review.standard ?? ''
        })
      }
    } catch (e) {
      console.error('CQC analysis failed:', e)
    } finally {
      setAnalysingCqc(false)
    }
  }

  async function saveDocument() {
    if (!pendingFile) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from('documents').insert({
      name: pendingFile.name,
      category: formCategory,
      owner: formOwner.trim() || (profile?.display_name ?? 'Unknown'),
      review_date: formReviewDate || null,
      storage_path: pendingPath,
      cqc_standard: formCqcStandard || null,
      content: pendingContent || null,
      ai_review: checkCqcEnabled ? aiReview : null,
      uploaded_by: user.id,
    })

    if (insertError) {
      setError(`Save failed: ${insertError.message}`)
      setSaving(false)
      return
    }

    setPendingFile(null)
    setSaving(false)
    await fetchDocuments()
  }

  async function checkExistingDocument(doc: Document) {
    if (!doc.content) return
    setCheckingDocId(doc.id)
    setError('')
    try {
      const res = await fetch('/api/check-cqc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: doc.content, document_name: doc.name }),
      })
      if (!res.ok) { setError('CQC check failed for this document.'); return }

      const review: AiReview = await res.json()
      const updates: { ai_review: AiReview; cqc_standard?: string } = { ai_review: review }
      if (!doc.cqc_standard && review.standard) updates.cqc_standard = review.standard // don't overwrite an existing manual tag

      const { data: updated, error: updateError } = await supabase.from('documents').update(updates).eq('id', doc.id).select()
      if (updateError) { setError(`Could not save CQC check: ${updateError.message}`); return }
      if (!updated || updated.length === 0) { setError("Update didn't apply — you may not have manager permissions on this document."); return }

      await fetchDocuments()
    } finally {
      setCheckingDocId(null)
    }
  }

  async function deleteDocument(doc: Document) {
    await supabase.storage.from('policies').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900 flex-1">Policies & SOPs</h1>
        <a href="/cqc-standards" className="text-xs text-blue-600 font-semibold shrink-0">CQC Standards</a>
      </div>

      <div className="p-4 space-y-3">
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-sm text-red-600">{error}</p></div>}

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, category, owner, or content..."
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${categoryFilter === '' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${categoryFilter === c ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {isManager && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.doc" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50">
              {uploading ? 'Uploading...' : '+ Upload Policy'}
            </button>
          </>
        )}

        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            {documents.length === 0 ? 'No policies uploaded yet.' : 'No policies match your search.'}
          </p>
        )}

        {filtered.map(doc => {
          const status = reviewStatus(doc.review_date)
          return (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-lg p-3 shrink-0"><span className="text-xl">📄</span></div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 text-sm truncate">{doc.name}</h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{doc.category}</span>
                    {doc.cqc_standard && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{doc.cqc_standard}</span>}
                    {status && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.className}`}>{status.label}</span>}
                    {doc.ai_review && doc.ai_review.gaps.length > 0 && (
                      <button
                        onClick={() => setPreviewingDoc(doc)}
                        className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold"
                      >
                        {doc.ai_review.gaps.length} gap{doc.ai_review.gaps.length !== 1 ? 's' : ''} flagged — view
                      </button>
                    )}
                    {doc.ai_review && doc.ai_review.gaps.length === 0 && doc.ai_review.standard && (
                      <button
                        onClick={() => setPreviewingDoc(doc)}
                        className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold"
                      >
                        CQC checked — no gaps
                      </button>
                    )}
                    {doc.ai_review && !doc.ai_review.standard && (
                      <button
                        onClick={() => setPreviewingDoc(doc)}
                        className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold"
                      >
                        CQC checked — not clearly relevant
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Owner: {doc.owner} · Review: {formatDate(doc.review_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                {doc.content && (
                  <button onClick={() => setPreviewingDoc(doc)} className="text-blue-600 text-xs font-semibold">Preview</button>
                )}
                <a href={`/policies/${doc.id}/view`} target="_blank" rel="noreferrer" className="text-purple-600 text-xs font-semibold">Open</a>
                {isManager && doc.content && (
                  <button
                    onClick={() => checkExistingDocument(doc)}
                    disabled={checkingDocId === doc.id}
                    className="text-blue-600 text-xs font-semibold disabled:opacity-50"
                  >
                    {checkingDocId === doc.id ? 'Checking...' : doc.ai_review ? 'Re-check CQC' : 'Check CQC'}
                  </button>
                )}
                {isManager && (
                  <button onClick={() => deleteDocument(doc)} className="text-red-400 text-xs font-semibold ml-auto">Delete</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* New upload details form */}
      {pendingFile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4">
              <p className="font-semibold text-gray-900">Tag this policy</p>
              <p className="text-xs text-gray-400 truncate">{pendingFile.name}</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Category</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Owner</label>
                <input
                  type="text"
                  value={formOwner}
                  onChange={e => setFormOwner(e.target.value)}
                  placeholder={profile?.display_name ?? 'e.g. Practice Manager'}
                  className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Review date</label>
                <input
                  type="date"
                  value={formReviewDate}
                  onChange={e => setFormReviewDate(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">CQC standard</label>
                <select value={formCqcStandard} onChange={e => setFormCqcStandard(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900">
                  <option value="">Not applicable</option>
                  {CQC_STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {pendingContent.trim() && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkCqcEnabled}
                      onChange={e => toggleCheckCqc(e.target.checked)}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span className="text-xs text-gray-600">Check against CQC standards</span>
                  </label>
                )}

                {checkCqcEnabled && analysingCqc && (
                  <p className="text-xs text-gray-400 mt-1.5">Checking against CQC standards...</p>
                )}

                {checkCqcEnabled && !analysingCqc && aiReview && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-2 space-y-1.5">
                    <p className="text-xs font-semibold text-blue-800">
                      {aiReview.standard ? `AI suggests: ${aiReview.standard}` : "AI didn't find a clear match to any standard"}
                    </p>
                    <p className="text-xs text-blue-900">{aiReview.assessment}</p>
                    {aiReview.gaps.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5">
                        {aiReview.gaps.map((gap, i) => <li key={i} className="text-xs text-blue-900">{gap}</li>)}
                      </ul>
                    )}
                  </div>
                )}

              </div>
              <div className="flex gap-2 pb-2">
                <button onClick={() => setPendingFile(null)} className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-3 text-sm font-semibold">Cancel</button>
                <button onClick={saveDocument} disabled={saving} className="flex-1 bg-purple-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal — shows extracted text, no download required */}
      {previewingDoc && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setPreviewingDoc(null)}>
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{previewingDoc.name}</p>
                <p className="text-xs text-gray-400">{previewingDoc.category}</p>
              </div>
              <button onClick={() => setPreviewingDoc(null)} className="text-gray-400 text-lg shrink-0">×</button>
            </div>
            <div className="p-4 space-y-4">
              {previewingDoc.ai_review && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                    CQC check {previewingDoc.ai_review.standard ? `— ${previewingDoc.ai_review.standard}` : ''}
                  </p>
                  <p className="text-sm text-blue-900">{previewingDoc.ai_review.assessment}</p>
                  {previewingDoc.ai_review.gaps.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {previewingDoc.ai_review.gaps.map((gap, i) => (
                        <li key={i} className="text-sm text-blue-900">{gap}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-blue-700">No obvious gaps flagged.</p>
                  )}
                  <p className="text-[11px] text-blue-400">AI-assisted suggestion — review before relying on it.</p>
                </div>
              )}
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{previewingDoc.content}</p>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-2">
              {signedUrls[previewingDoc.id] && (
                <a
                  href={signedUrls[previewingDoc.id]}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-3 text-sm font-semibold text-center"
                >
                  Download original
                </a>
              )}
              <button onClick={() => setPreviewingDoc(null)} className="flex-1 bg-purple-600 text-white rounded-xl py-3 text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
