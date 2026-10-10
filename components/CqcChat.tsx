'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default function CqcChat({ documentId }: { documentId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    const question = input.trim()
    if (!question || sending) return

    const next: ChatMessage[] = [...messages, { role: 'user', content: question }]
    setMessages(next)
    setInput('')
    setSending(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Your session has expired — please sign in again.'); return }

      const res = await fetch('/api/cqc-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, messages: next, accessToken: session.access_token }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.reply) { setError(`Couldn't get an answer: ${body?.error ?? res.statusText}`); return }

      setMessages([...next, { role: 'assistant', content: body.reply }])
    } catch (e) {
      setError(`Couldn't get an answer: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t border-blue-200 pt-2 mt-2 space-y-2">
      <p className="text-xs font-semibold text-blue-800">Ask about this check</p>
      {messages.map((m, i) => (
        <div
          key={i}
          className={`text-sm rounded-xl px-3 py-2 whitespace-pre-wrap ${m.role === 'user' ? 'bg-purple-600 text-white ml-8' : 'bg-white text-gray-800 border border-blue-100 mr-8'}`}
        >
          {m.content}
        </div>
      ))}
      {sending && <p className="text-xs text-blue-500">Thinking...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder={messages.length ? 'Ask a follow-up...' : 'e.g. What should the safeguarding section say?'}
          className="flex-1 bg-white rounded-xl px-3 py-2 text-sm outline-none border border-blue-200 text-gray-900"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-purple-600 text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </div>
  )
}
