'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [username, setUsername] = useState('')

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      router.refresh()
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Please enter your email address first.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setMessage('Password reset email sent — check your inbox.')
    }
    setLoading(false)
  }

  async function handleSignUp() {
    if (!consentGiven) { setError('Please agree to the data notice before creating an account.'); return }
    if (!username.trim()) { setError('Please enter a username.'); return }
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, display_name: username.trim() })
      if (data.session) {
        router.refresh()
      } else {
        setMessage('Account created! Please sign in now.')
        setIsSigningUp(false)
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">

      <div className="mb-8 text-center">
        <div className="bg-purple-600 rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📋</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Policy Hub</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm shadow-sm space-y-4">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-sm text-green-600">{message}</p>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleForgotPassword}
            disabled={loading}
            className="text-xs text-purple-600 font-medium"
          >
            Forgot password?
          </button>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs text-gray-400 bg-white px-2">or</div>
        </div>

        {!isSigningUp ? (
          <button
            onClick={() => { setIsSigningUp(true); setError('') }}
            disabled={loading}
            className="w-full bg-gray-100 text-gray-700 rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
          >
            Create account
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Your name</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Sarah Jones"
                className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1">This is how you'll appear to your team</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Data notice</p>
              <p className="text-xs text-amber-700">This app stores your name, email address, and any policy documents you upload. Data is held by Northam Surgery and processed by Supabase and Anthropic AI. Do not upload patient data or sensitive personal information.</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={e => setConsentGiven(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-purple-600 shrink-0"
              />
              <span className="text-xs text-gray-600">I understand and agree to the data notice above</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => { setIsSigningUp(false); setConsentGiven(false); setError('') }}
                className="flex-1 bg-gray-100 text-gray-600 rounded-xl py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSignUp}
                disabled={loading || !consentGiven}
                className="flex-1 bg-purple-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create account'}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
