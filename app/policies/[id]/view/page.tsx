'use client'

import { use, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Document = {
  id: string
  name: string
  storage_path: string
}

export default function ViewDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [doc, setDoc] = useState<Document | null>(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [html, setHtml] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    setError('')

    const { data: document } = await supabase.from('documents').select('id, name, storage_path').eq('id', id).single()
    if (!document) { setError('Document not found.'); setLoading(false); return }
    setDoc(document)

    const { data: signed } = await supabase.storage.from('policies').createSignedUrl(document.storage_path, 60 * 60)
    if (!signed) { setError('Could not access this file.'); setLoading(false); return }
    setDownloadUrl(signed.signedUrl)

    const nameLower = document.name.toLowerCase()

    if (nameLower.endsWith('.pdf')) {
      setPdfUrl(signed.signedUrl)
      setLoading(false)
      return
    }

    if (nameLower.endsWith('.docx')) {
      const res = await fetch('/api/render-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: signed.signedUrl }),
      })
      if (res.ok) {
        setHtml((await res.json()).html ?? '')
      } else {
        setError("This file type can't be previewed — download it instead.")
        setPdfUrl(signed.signedUrl)
      }
      setLoading(false)
      return
    }

    // Unsupported preview type — fall back to a direct link
    setPdfUrl(signed.signedUrl)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3 shrink-0">
        <a href="/policies" className="text-gray-500 text-sm shrink-0">← Back</a>
        <h1 className="text-sm font-semibold text-gray-900 truncate flex-1">{doc?.name ?? 'Loading...'}</h1>
        {downloadUrl && (
          <a href={downloadUrl} target="_blank" rel="noreferrer" className="text-purple-600 text-xs font-semibold shrink-0">
            Download original
          </a>
        )}
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400">Loading document...</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-sm text-gray-500">{error}</p>
          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="bg-purple-600 text-white rounded-xl px-4 py-2 text-sm font-semibold">
              Download file
            </a>
          )}
        </div>
      )}

      {!loading && !error && pdfUrl && (
        <iframe src={pdfUrl} className="flex-1 w-full border-0" title={doc?.name} />
      )}

      {!loading && !error && html && (
        <div className="flex-1 overflow-y-auto p-4">
          <div
            className="doc-preview max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-sm text-gray-800"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </main>
  )
}
