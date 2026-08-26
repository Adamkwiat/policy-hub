'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'
import { CQC_FUNDAMENTAL_STANDARDS } from '@/lib/cqcStandards'
import { OTHER_REFERENCE_SOURCES } from '@/lib/practiceAreas'
import PolicyHubNav from '@/components/PolicyHubNav'

type ReferenceDoc = {
  id: string
  name: string
  storage_path: string
  created_at: string
}

export default function CqcStandardsReference() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [refDocs, setRefDocs] = useState<ReferenceDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isManager = profile?.role === 'manager'

  useEffect(() => {
    getCurrentProfile().then(setProfile)
    fetchRefDocs()
  }, [])

  async function fetchRefDocs() {
    const { data } = await supabase
      .from('reference_documents')
      .select('id, name, storage_path, created_at')
      .order('created_at', { ascending: false })
    setRefDocs(data ?? [])
  }

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

    const { error: uploadError } = await supabase.storage.from('reference-documents').upload(storagePath, file)
    if (uploadError) { setError(`Upload failed: ${uploadError.message}`); setUploading(false); return }

    let content = ''
    const nameLower = file.name.toLowerCase()
    if (nameLower.endsWith('.pdf') || nameLower.endsWith('.docx')) {
      const extractForm = new FormData()
      extractForm.append('file', file)
      const extractRes = await fetch('/api/extract-text', { method: 'POST', body: extractForm })
      if (extractRes.ok) content = (await extractRes.json()).text ?? ''
    }

    const { error: insertError } = await supabase.from('reference_documents').insert({
      name: file.name,
      storage_path: storagePath,
      content: content || null,
      uploaded_by: user.id,
    })
    if (insertError) setError(`Save failed: ${insertError.message}`)

    await fetchRefDocs()
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function deleteRefDoc(doc: ReferenceDoc) {
    await supabase.storage.from('reference-documents').remove([doc.storage_path])
    await supabase.from('reference_documents').delete().eq('id', doc.id)
    setRefDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 space-y-2">
        <div className="flex items-center gap-3">
          <a href="/policies" className="text-gray-500 text-sm">← Back</a>
          <h1 className="text-xl font-semibold text-gray-900">CQC Standards Reference</h1>
        </div>
        <PolicyHubNav />
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-sm text-blue-900">
            This is exactly what the AI CQC check reads before assessing your policies — the same summary is sent to Claude for every check, so what you see below is what it's actually looking for.
          </p>
          <p className="text-xs text-blue-700">
            It's Claude's own summary of the five standards, not verbatim CQC regulation text. For the authoritative, up-to-date wording, refer to{' '}
            <a href="https://www.cqc.org.uk" target="_blank" rel="noreferrer" className="underline font-semibold">
              CQC's official website
            </a>.
          </p>
        </div>

        {CQC_FUNDAMENTAL_STANDARDS.map(standard => (
          <div key={standard.name} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2">
            <h2 className="font-semibold text-gray-900">{standard.name}</h2>
            <p className="text-sm text-gray-700">{standard.summary}</p>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Covers</p>
              <ul className="list-disc list-inside space-y-0.5">
                {standard.covers.map(item => (
                  <li key={item} className="text-sm text-gray-600">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900">Your reference documents</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Upload your own checklists or guidance documents (e.g. one produced for your practice) and the Gap Analysis will read them alongside the built-in checklist above.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {isManager && (
            <>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.doc" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full bg-purple-600 text-white rounded-xl py-2.5 font-semibold text-sm disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : '+ Upload reference document'}
              </button>
            </>
          )}

          {refDocs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-2">No reference documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {refDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-2.5">
                  <p className="text-sm text-gray-700 truncate">{doc.name}</p>
                  {isManager && (
                    <button onClick={() => deleteRefDoc(doc)} className="text-red-400 text-xs font-semibold shrink-0 ml-2">Delete</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900">Other reference sources</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Static links for further reading — not queried by the AI, just useful bodies to know about for practice policies.
            </p>
          </div>
          <div className="space-y-2">
            {OTHER_REFERENCE_SOURCES.map(source => (
              <a
                key={source.name}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block border border-gray-100 rounded-lg p-2.5 hover:bg-gray-50"
              >
                <p className="text-sm font-semibold text-blue-600">{source.name}</p>
                <p className="text-xs text-gray-500">{source.note}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
