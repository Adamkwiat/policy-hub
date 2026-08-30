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

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setMessage('Password reset email sent — check your inbox.')
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

        <p className="text-xs text-gray-400 text-center">
          Policy Hub is invite-only. Contact your practice manager if you need access.
        </p>

      </div>
    </main>
  )
}
