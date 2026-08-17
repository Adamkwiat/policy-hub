'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type Profile } from '@/lib/profile'

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    getCurrentProfile().then(setProfile)
    checkDue()
  }, [])

  async function checkDue() {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .lte('review_date', in30Days)
    setDueCount(count ?? 0)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Policy Hub</h1>
          <p className="text-sm text-gray-500">
            {profile ? `Welcome, ${profile.display_name}` : 'Welcome'}
          </p>
        </div>
        <a href="/profile" className="text-sm text-purple-600 font-medium">Profile</a>
      </div>

      <div className="p-4 space-y-3">
        <a
          href="/policies"
          className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm block"
        >
          <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center text-xl shrink-0">
            📋
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900">Policies & SOPs</h2>
            <p className="text-sm text-gray-500">
              {dueCount > 0 ? `${dueCount} due for review` : 'Search the document library'}
            </p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </a>

        <a
          href={process.env.NEXT_PUBLIC_MEETING_HUB_URL || '#'}
          className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm block"
        >
          <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center text-xl shrink-0">
            📅
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900">Meeting Hub</h2>
            <p className="text-sm text-gray-500">Team meetings, minutes & messages</p>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </a>
      </div>
    </main>
  )
}
