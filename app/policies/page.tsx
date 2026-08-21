'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'

const CATEGORIES = ['Clinical', 'HR', 'Health & Safety', 'Information Governance', 'Safeguarding', 'Complaints', 'Other']
const CQC_STANDARDS = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']

type Document = {
  id: string
  name: string
  category: string
  owner: string
  review_date: string | null
  storage_path: string
  cqc_standard: string | null
  content: string | null
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
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  async function deleteDocument(doc: Document) {
    await supabase.storage.from('policies').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900">Policies & SOPs</h1>
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
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Owner: {doc.owner} · Review: {formatDate(doc.review_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                {signedUrls[doc.id] ? (
                  <a href={signedUrls[doc.id]} target="_blank" rel="noreferrer" className="text-purple-600 text-xs font-semibold">Open</a>
                ) : (
                  <span className="text-gray-300 text-xs">Loading...</span>
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
    </main>
  )
}
