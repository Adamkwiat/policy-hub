'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (p) {
        setProfile(p)
        setDisplayName(p.display_name)
      }
    })
  }, [])

  async function save() {
    if (!profile || !displayName.trim()) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', profile.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 shadow-sm">

          <div className="flex justify-center">
            <div className="bg-purple-200 rounded-full w-16 h-16 flex items-center justify-center text-2xl font-semibold text-purple-800">
              {displayName[0]?.toUpperCase() ?? '?'}
            </div>
          </div>

          {profile && (
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {profile.role === 'manager' ? 'Manager' : 'Staff'}
            </p>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="Your name"
              className="w-full bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none text-gray-900"
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !displayName.trim()}
            className="w-full bg-purple-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <button
            onClick={signOut}
            className="w-full text-red-600 font-semibold text-sm py-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </main>
  )
}
