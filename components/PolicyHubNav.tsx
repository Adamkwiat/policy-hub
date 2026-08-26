'use client'

import { useEffect, useState } from 'react'
import { getCurrentProfile, type Profile } from '@/lib/profile'

export default function PolicyHubNav() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    getCurrentProfile().then(setProfile)
  }, [])

  const isManager = profile?.role === 'manager'

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a href="/ask" className="text-xs text-green-600 font-semibold">Ask AI</a>
      <a href="/policies/review-schedule" className="text-xs text-teal-600 font-semibold">Review Schedule</a>
      {isManager && <a href="/policies/gap-analysis" className="text-xs text-purple-600 font-semibold">Gap Analysis</a>}
      <a href="/cqc-standards" className="text-xs text-blue-600 font-semibold">CQC Standards</a>
      <a href="/audits" className="text-xs text-teal-700 font-semibold">Audits</a>
      {isManager && <a href="/policies/audit" className="text-xs text-gray-600 font-semibold">Activity Log</a>}
    </div>
  )
}
