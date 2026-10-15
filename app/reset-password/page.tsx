'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [linkExpired, setLinkExpired] = useState(false)
  const [isInvite, setIsInvite] = useState(false)
  const [pendingLink, setPendingLink] = useState<{ tokenHash: string; type: EmailOtpType } | null>(null)
  const readyRef = useRef(false)

  function markReady() {
    readyRef.current = true
    setReady(true)
  }

  useEffect(() => {
    // Password reset links arrive as a one-time code that the Supabase client exchanges
    // on its own. Listen for that, and also check in case it already happened.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) markReady()
    })

    const timeout = setTimeout(() => {
      if (!readyRef.current) setLinkExpired(true)
    }, 5000)

    async function readLink() {
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const query = new URLSearchParams(window.location.search)
      const type = hash.get('type') ?? query.get('type')

      // Let the client finish handling the URL itself before we look at it.
      const { data } = await supabase.auth.getSession()
      if (type === 'invite') setIsInvite(true)

      // Supabase sends people back here with an error when the link was already used.
      if (hash.get('error_code') || query.get('error_code')) {
        clearTimeout(timeout)
        return setLinkExpired(true)
      }

      // Links carrying a token_hash are only used up when the person presses Continue,
      // so email link scanners (e.g. Outlook Safe Links) that open the link first can't spend it.
      const tokenHash = query.get('token_hash')
      if (tokenHash && type) {
        clearTimeout(timeout)
        return setPendingLink({ tokenHash, type: type as EmailOtpType })
      }

      // Invite links arrive with the session in the URL fragment instead, which our
      // client (set up for one-time codes) ignores, so pick it up here.
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      if (accessToken && refreshToken) {
        const { data: set, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        window.history.replaceState(null, '', window.location.pathname)
        if (set.session && !error) markReady()
        else setLinkExpired(true)
        return
      }

      if (data.session) markReady()
    }
    readLink()

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleContinue() {
    if (!pendingLink) return
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: pendingLink.tokenHash, type: pendingLink.type })
    setLoading(false)
    window.history.replaceState(null, '', window.location.pathname)
    setPendingLink(null)
    if (data.session && !error) markReady()
    else setLinkExpired(true)
  }

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
        <p className="text-sm text-gray-500 mt-1">{isInvite ? 'Welcome! Choose a password to finish setting up your account' : 'Set a new password'}</p>
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
            <p className="text-xs text-amber-700 mt-1">
              {isInvite
                ? 'Invite links only work once. Go to the login page, enter your email and press "Forgot password?" to get a new link, or ask your practice manager to invite you again.'
                : 'Recovery links only work once. Go back to the login page and request a fresh one.'}
            </p>
          </div>
        ) : pendingLink ? (
          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
          >
            {loading ? 'Checking your link...' : 'Continue'}
          </button>
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
