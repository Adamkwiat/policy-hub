'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'
import { formatDate } from '@/lib/documents'
import { logAction } from '@/lib/audit'
import AuditsNav from '@/components/AuditsNav'

const AUDIT_TYPES = ['Clinical', 'Prescribing', 'Infection Control', 'Safeguarding', 'Significant Event', 'Health & Safety', 'Complaints', 'Other']
const CQC_STANDARDS = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led']

type AiReview = {
  standard: string | null
  assessment: string
  gaps: string[]
}

type Audit = {
  id: string
  name: string
  audit_type: string
  owner: string
  audit_date: string | null
  reaudit_date: string | null
  storage_path: string
  cqc_standard: string | null
  content: string | null
  ai_review: AiReview | null
  uploaded_by: string
  created_at: string
}

function reauditStatus(reaudit_date: string | null) {
  if (!reaudit_date) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(reaudit_date + 'T00:00:00')
  const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: 'Overdue', className: 'bg-red-100 text-red-700' }
  if (daysLeft <= 30) return { label: 'Due soon', className: 'bg-amber-100 text-amber-700' }
  return null
}

export default function AuditsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [audits, setAudits] = useState<Audit[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload form state
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPath, setPendingPath] = useState('')
  const [pendingContent, setPendingContent] = useState('')
  const [formAuditType, setFormAuditType] = useState(AUDIT_TYPES[0])
  const [formOwner, setFormOwner] = useState('')
  const [formAuditDate, setFormAuditDate] = useState('')
  const [formReaudDate, setFormReaudDate] = useState('')
  const [formCqcStandard, setFormCqcStandard] = useState('')
  const [saving, setSaving] = useState(false)
  const [analysingCqc, setAnalysingCqc] = useState(false)
  const [aiReview, setAiReview] = useState<AiReview | null>(null)
  const [checkCqcEnabled, setCheckCqcEnabled] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)

  function toggleCheckCqc(checked: boolean) {
    setCheckCqcEnabled(checked)
    if (checked && !aiReview && !analysingCqc && pendingContent.trim() && pendingFile) {
      analyseCqc(pendingContent, pendingFile.name)
    }
  }

  const [previewingAudit, setPreviewingAudit] = useState<Audit | null>(null)

  // Edit form state
  const [editingAudit, setEditingAudit] = useState<Audit | null>(null)
  const [editAuditType, setEditAuditType] = useState(AUDIT_TYPES[0])
  const [editOwner, setEditOwner] = useState('')
  const [editAuditDate, setEditAuditDate] = useState('')
  const [editReaudDate, setEditReaudDate] = useState('')
  const [editCqcStandard, setEditCqcStandard] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Replace file state
  const replaceFileInputRef = useRef<HTMLInputElement>(null)
  const [replacingAudit, setReplacingAudit] = useState<Audit | null>(null)
  const [replacing, setReplacing] = useState(false)

  const isManager = profile?.role === 'manager'

  useEffect(() => {
    getCurrentProfile().then(setProfile)
    fetchAudits()
  }, [])

  async function fetchAudits() {
    const { data } = await supabase.from('audits').select('*').order('created_at', { ascending: false })
    if (!data) return
    setAudits(data)

    const urls: Record<string, string> = {}
    await Promise.all(data.map(async (a: Audit) => {
      const { data: signed } = await supabase.storage.from('audits').createSignedUrl(a.storage_path, 60 * 60)
      if (signed) urls[a.id] = signed.signedUrl
    }))
    setSignedUrls(urls)
  }

  const filtered = useMemo(() => {
    return audits.filter(a => {
      if (typeFilter && a.audit_type !== typeFilter) return false
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return a.name.toLowerCase().includes(q)
        || a.audit_type.toLowerCase().includes(q)
        || a.owner.toLowerCase().includes(q)
        || (a.cqc_standard ?? '').toLowerCase().includes(q)
        || (a.content ?? '').toLowerCase().includes(q)
    })
  }, [audits, search, typeFilter])

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

    const { error: uploadError } = await supabase.storage.from('audits').upload(storagePath, file)
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
    setFormAuditType(AUDIT_TYPES[0])
    setFormOwner('')
    setFormAuditDate('')
    setFormReaudDate('')
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
        setFormCqcStandard(prev => (prev ? prev : review.standard ?? ''))
      } else {
        const body = await res.json().catch(() => null)
        setError(`CQC check failed: ${body?.error ?? res.statusText}`)
      }
    } catch (e) {
      setError(`CQC check failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setAnalysingCqc(false)
    }
  }

  async function saveAudit() {
    if (!pendingFile) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from('audits').insert({
      name: pendingFile.name,
      audit_type: formAuditType,
      owner: formOwner.trim() || (profile?.display_name ?? 'Unknown'),
      audit_date: formAuditDate || null,
      reaudit_date: formReaudDate || null,
      storage_path: pendingPath,
      cqc_standard: formCqcStandard || null,
      content: pendingContent || null,
      ai_review: checkCqcEnabled ? aiReview : null,
      uploaded_by: user.id,
    })

    if (insertError) { setError(`Save failed: ${insertError.message}`); setSaving(false); return }

    await logAction({ action: 'upload_document', resourceType: 'audit', resourceName: pendingFile.name })

    setPendingFile(null)
    setSaving(false)
    await fetchAudits()
  }

  async function checkExistingAudit(a: Audit) {
    if (!a.content) return
    setCheckingId(a.id)
    setError('')
    try {
      const res = await fetch('/api/check-cqc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: a.content, document_name: a.name }),
      })
      if (!res.ok) { setError('CQC check failed for this audit.'); return }

      const review: AiReview = await res.json()
      const updates: { ai_review: AiReview; cqc_standard?: string } = { ai_review: review }
      if (!a.cqc_standard && review.standard) updates.cqc_standard = review.standard

      const { data: updated, error: updateError } = await supabase.from('audits').update(updates).eq('id', a.id).select()
      if (updateError) { setError(`Could not save CQC check: ${updateError.message}`); return }
      if (!updated || updated.length === 0) { setError("Update didn't apply — you may not have manager permissions."); return }

      await logAction({ action: 'check_cqc', resourceType: 'audit', resourceName: a.name })
      await fetchAudits()
    } finally {
      setCheckingId(null)
    }
  }

  function openEdit(a: Audit) {
    setEditingAudit(a)
    setEditAuditType(a.audit_type)
    setEditOwner(a.owner)
    setEditAuditDate(a.audit_date ?? '')
    setEditReaudDate(a.reaudit_date ?? '')
    setEditCqcStandard(a.cqc_standard ?? '')
  }

  async function saveEdit() {
    if (!editingAudit) return
    setEditSaving(true)
    setError('')

    const { data: updated, error: updateError } = await supabase
      .from('audits')
      .update({
        audit_type: editAuditType,
        owner: editOwner.trim() || editingAudit.owner,
        audit_date: editAuditDate || null,
        reaudit_date: editReaudDate || null,
        cqc_standard: editCqcStandard || null,
      })
      .eq('id', editingAudit.id)
      .select()

    if (updateError) { setError(`Save failed: ${updateError.message}`); setEditSaving(false); return }
    if (!updated || updated.length === 0) { setError("Update didn't apply — you may not have manager permissions."); setEditSaving(false); return }

    await logAction({ action: 'edit_document', resourceType: 'audit', resourceName: editingAudit.name })

    setEditingAudit(null)
    setEditSaving(false)
    await fetchAudits()
  }

  function triggerReplace(a: Audit) {
    setReplacingAudit(a)
    setError('')
    replaceFileInputRef.current?.click()
  }

  async function handleReplaceFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const target = replacingAudit
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = ''
    if (!file || !target) return
    if (file.size > 50 * 1024 * 1024) { setError('File must be under 50 MB'); setReplacingAudit(null); return }

    setReplacing(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setReplacing(false); return }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const newPath = `${user.id}/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage.from('audits').upload(newPath, file)
    if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setReplacing(false); setReplacingAudit(null); return }

    let content = ''
    const nameLower = file.name.toLowerCase()
    if (nameLower.endsWith('.pdf') || nameLower.endsWith('.docx')) {
      const extractForm = new FormData()
      extractForm.append('file', file)
      const extractRes = await fetch('/api/extract-text', { method: 'POST', body: extractForm })
      if (extractRes.ok) content = (await extractRes.json()).text ?? ''
    }

    const { data: updated, error: updateError } = await supabase
      .from('audits')
      .update({ name: file.name, storage_path: newPath, content: content || null, ai_review: null })
      .eq('id', target.id)
      .select()

    if (updateError) { setError(`Could not save replacement: ${updateError.message}`); setReplacing(false); setReplacingAudit(null); return }
    if (!updated || updated.length === 0) {
      await supabase.storage.from('audits').remove([newPath])
      setError("Update didn't apply — you may not have manager permissions.")
      setReplacing(false)
      setReplacingAudit(null)
      return
    }

    await supabase.storage.from('audits').remove([target.storage_path])
    await logAction({ action: 'replace_document', resourceType: 'audit', resourceName: file.name })

    setReplacing(false)
    setReplacingAudit(null)
    await fetchAudits()
  }

  async function deleteAudit(a: Audit) {
    await supabase.storage.from('audits').remove([a.storage_path])
    await supabase.from('audits').delete().eq('id', a.id)
    await logAction({ action: 'delete_document', resourceType: 'audit', resourceName: a.name })
    setAudits(prev => prev.filter(d => d.id !== a.id))
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 space-y-2">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 text-sm">← Back</a>
          <h1 className="text-xl font-semibold text-gray-900 flex-1">Audits</h1>
        </div>
        <AuditsNav />
      </div>

      <div className="p-4 space-y-3">
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-sm text-red-600">{error}</p></div>}

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, type, owner, or content..."
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setTypeFilter('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${typeFilter === '' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            All
          </button>
          {AUDIT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${typeFilter === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {isManager && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.doc" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full bg-teal-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50">
              {uploading ? 'Uploading...' : '+ Upload Audit'}
            </button>
            <input ref={replaceFileInputRef} type="file" className="hidden" onChange={handleReplaceFileChange} accept=".pdf,.docx,.doc" />
          </>
        )}

        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            {audits.length === 0 ? 'No audits uploaded yet.' : 'No audits match your search.'}
          </p>
        )}

        {filtered.map(a => {
          const status = reauditStatus(a.reaudit_date)
          return (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="bg-teal-100 rounded-lg p-3 shrink-0"><span className="text-xl">🔎</span></div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 text-sm truncate">{a.name}</h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.audit_type}</span>
                    {a.cqc_standard && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{a.cqc_standard}</span>}
                    {status && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${status.className}`}>Re-audit {status.label}</span>}
                    {a.ai_review && a.ai_review.gaps.length > 0 && (
                      <button onClick={() => setPreviewingAudit(a)} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                        {a.ai_review.gaps.length} gap{a.ai_review.gaps.length !== 1 ? 's' : ''} flagged — view
                      </button>
                    )}
                    {a.ai_review && a.ai_review.gaps.length === 0 && a.ai_review.standard && (
                      <button onClick={() => setPreviewingAudit(a)} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        CQC checked — no gaps
                      </button>
                    )}
                    {a.ai_review && !a.ai_review.standard && (
                      <button onClick={() => setPreviewingAudit(a)} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                        CQC checked — not clearly relevant
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Owner: {a.owner} · Audited: {formatDate(a.audit_date)} · Re-audit due: {formatDate(a.reaudit_date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                {a.content && (
                  <button onClick={() => setPreviewingAudit(a)} className="text-blue-600 text-xs font-semibold">Preview</button>
                )}
                <a href={`/audits/${a.id}/view`} target="_blank" rel="noreferrer" className="text-teal-600 text-xs font-semibold">Open</a>
                {isManager && a.content && (
                  <button
                    onClick={() => checkExistingAudit(a)}
                    disabled={checkingId === a.id}
                    className="text-blue-600 text-xs font-semibold disabled:opacity-50"
                  >
                    {checkingId === a.id ? 'Checking...' : a.ai_review ? 'Re-check CQC' : 'Check CQC'}
                  </button>
                )}
              </div>
              {isManager && (
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => openEdit(a)} className="text-gray-500 text-xs font-semibold">Edit details</button>
                  <button
                    onClick={() => triggerReplace(a)}
                    disabled={replacing && replacingAudit?.id === a.id}
                    className="text-gray-500 text-xs font-semibold disabled:opacity-50"
                  >
                    {replacing && replacingAudit?.id === a.id ? 'Replacing...' : 'Replace file'}
                  </button>
                  <button onClick={() => deleteAudit(a)} className="text-red-400 text-xs font-semibold ml-auto">Delete</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* New upload details form */}
      {pendingFile && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4">
              <p className="font-semibold text-gray-900">Tag this audit</p>
              <p className="text-xs text-gray-400 truncate">{pendingFile.name}</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Audit type</label>
                <select value={formAuditType} onChange={e => setFormAuditType(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900">
                  {AUDIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
                <label className="text-sm font-semibold text-gray-700 block mb-1">Audit date</label>
                <input
                  type="date"
                  value={formAuditDate}
                  onChange={e => setFormAuditDate(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Re-audit due date</label>
                <input
                  type="date"
                  value={formReaudDate}
                  onChange={e => setFormReaudDate(e.target.value)}
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
                      className="w-4 h-4 accent-teal-600"
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
                <button onClick={saveAudit} disabled={saving} className="flex-1 bg-teal-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit details modal */}
      {editingAudit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setEditingAudit(null)}>
          <div className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4">
              <p className="font-semibold text-gray-900">Edit audit details</p>
              <p className="text-xs text-gray-400 truncate">{editingAudit.name}</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Audit type</label>
                <select value={editAuditType} onChange={e => setEditAuditType(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900">
                  {AUDIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Owner</label>
                <input
                  type="text"
                  value={editOwner}
                  onChange={e => setEditOwner(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Audit date</label>
                <input
                  type="date"
                  value={editAuditDate}
                  onChange={e => setEditAuditDate(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Re-audit due date</label>
                <input
                  type="date"
                  value={editReaudDate}
                  onChange={e => setEditReaudDate(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">CQC standard</label>
                <select value={editCqcStandard} onChange={e => setEditCqcStandard(e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900">
                  <option value="">Not applicable</option>
                  {CQC_STANDARDS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pb-2">
                <button onClick={() => setEditingAudit(null)} className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-3 text-sm font-semibold">Cancel</button>
                <button onClick={saveEdit} disabled={editSaving} className="flex-1 bg-teal-600 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewingAudit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setPreviewingAudit(null)}>
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{previewingAudit.name}</p>
                <p className="text-xs text-gray-400">{previewingAudit.audit_type}</p>
              </div>
              <button onClick={() => setPreviewingAudit(null)} className="text-gray-400 text-lg shrink-0">×</button>
            </div>
            <div className="p-4 space-y-4">
              {previewingAudit.ai_review && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                    CQC check {previewingAudit.ai_review.standard ? `— ${previewingAudit.ai_review.standard}` : ''}
                  </p>
                  <p className="text-sm text-blue-900">{previewingAudit.ai_review.assessment}</p>
                  {previewingAudit.ai_review.gaps.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {previewingAudit.ai_review.gaps.map((gap, i) => (
                        <li key={i} className="text-sm text-blue-900">{gap}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-blue-700">No obvious gaps flagged.</p>
                  )}
                  <p className="text-[11px] text-blue-400">AI-assisted suggestion — review before relying on it.</p>
                </div>
              )}
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{previewingAudit.content}</p>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex gap-2">
              {signedUrls[previewingAudit.id] && (
                <a
                  href={signedUrls[previewingAudit.id]}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-3 text-sm font-semibold text-center"
                >
                  Download original
                </a>
              )}
              <button onClick={() => setPreviewingAudit(null)} className="flex-1 bg-teal-600 text-white rounded-xl py-3 text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
