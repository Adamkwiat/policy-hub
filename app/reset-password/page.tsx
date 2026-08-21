'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [linkExpired, setLinkExpired] = useState(false)
  const readyRef = useRef(false)

  function markReady() {
    readyRef.current = true
    setReady(true)
  }

  useEffect(() => {
    // Supabase's recovery link needs a moment to exchange its one-time code
    // for a session before we can call updateUser(). Listen for that, and
    // also check in case the session was already established by page load.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) markReady()
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady()
    })

    const timeout = setTimeout(() => {
      if (!readyRef.current) setLinkExpired(true)
    }, 5000)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleReset() {
    if (!password.trim()) { setError('Please enter a new password.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="bg-purple-600 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📋</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Policy Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Set a new password</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm shadow-sm space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {linkExpired && !ready ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-amber-800">This link has expired or was already used</p>
            <p className="text-xs text-amber-700 mt-1">Recovery links only work once. Go back to the login page and request a fresh one.</p>
          </div>
        ) : !ready ? (
          <p className="text-sm text-gray-400 text-center py-2">Verifying your link...</p>
        ) : (
          <>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                placeholder="••••••••"
                className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
              />
            </div>

            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Set new password'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
