'use client'

import { useState } from 'react'
import { gapLevel, gapStatus, gapText, isRaised, STATUS_LABELS, type GapStatus, type ReviewGap } from '@/lib/cqcReview'

// Lists CQC check findings: open gaps first, then what's been fixed or closed by a manager.
// Says so plainly when there is nothing to raise. Optional suggestions saved by older checks
// aren't shown: the check only raises missing or inadequate content. With onDecide, managers can close or reopen a finding.
export default function CqcGapList({ gaps, references = [], size = 'sm', onDecide }: {
  gaps: ReviewGap[]
  references?: { title: string; url: string }[]
  size?: 'xs' | 'sm'
  onDecide?: (index: number, status: GapStatus) => Promise<void>
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const text = size === 'xs' ? 'text-xs' : 'text-sm'
  const indexed = gaps.map((gap, index) => ({ gap, index, status: gapStatus(gap) }))

  const groups = [
    { title: 'Missing or inadequate', items: indexed.filter(g => g.status === 'open' && gapLevel(g.gap) === 'missing'), heading: 'text-red-700', item: 'text-red-900' },
    { title: 'Picked up at other practices', items: indexed.filter(g => g.status === 'open' && gapLevel(g.gap) === 'inspection'), heading: 'text-amber-700', item: 'text-gray-800' },
    { title: 'Gaps flagged', items: indexed.filter(g => g.status === 'open' && gapLevel(g.gap) === null), heading: 'text-blue-800', item: 'text-blue-900' },
    { title: 'Fixed since the last check', items: indexed.filter(g => g.status === 'resolved'), heading: 'text-green-700', item: 'text-gray-500' },
    { title: 'Closed by a manager', items: indexed.filter(g => g.status === 'not_adopted' || g.status === 'already_covered'), heading: 'text-gray-500', item: 'text-gray-500' },
  ].filter(g => g.items.length > 0)

  async function decide(index: number, status: GapStatus) {
    if (!onDecide) return
    setBusy(index)
    try { await onDecide(index, status) } finally { setBusy(null) }
  }

  const buttonClass = 'text-[11px] font-semibold px-2 py-0.5 rounded-full border disabled:opacity-50'

  const nothingToRaise = !gaps.some(isRaised)
  const nothingMissing = !nothingToRaise && !gaps.some(g => isRaised(g) && gapLevel(g) !== 'inspection')

  return (
    <div className="space-y-2">
      {nothingToRaise && (
        <p className={`${text} font-semibold text-green-700`}>✓ Nothing to raise: no missing or inadequate content found.</p>
      )}
      {nothingMissing && (
        <p className={`${text} font-semibold text-green-700`}>✓ No missing or inadequate content found.</p>
      )}
      {groups.map(group => (
        <div key={group.title}>
          <p className={`text-xs font-semibold ${group.heading}`}>{group.title}</p>
          <ul className="list-disc list-inside space-y-1">
            {group.items.map(({ gap, index, status }) => (
              <li key={index} className={`${text} ${group.item}`}>
                <span className={status === 'resolved' ? 'line-through' : ''}>{gapText(gap)}</span>
                {(status === 'not_adopted' || status === 'already_covered') && typeof gap !== 'string' && (
                  <span className="text-[11px] text-gray-400">
                    {' '}— {STATUS_LABELS[status]}{gap.decided_by ? `, ${gap.decided_by}` : ''}
                    {gap.decided_at ? `, ${new Date(gap.decided_at).toLocaleDateString('en-GB')}` : ''}
                  </span>
                )}
                {onDecide && status === 'open' && (
                  <span className="inline-flex gap-1 ml-1 align-middle">
                    <button onClick={() => decide(index, 'already_covered')} disabled={busy !== null} className={`${buttonClass} border-gray-300 text-gray-600 bg-white`}>
                      Already covered
                    </button>
                    <button onClick={() => decide(index, 'not_adopted')} disabled={busy !== null} className={`${buttonClass} border-gray-300 text-gray-600 bg-white`}>
                      Not adopting
                    </button>
                  </span>
                )}
                {onDecide && (status === 'not_adopted' || status === 'already_covered') && (
                  <button onClick={() => decide(index, 'open')} disabled={busy !== null} className={`${buttonClass} ml-1 border-gray-200 text-gray-500 bg-white align-middle`}>
                    Reopen
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {onDecide && groups.some(g => g.items.some(i => i.status === 'open')) && (
        <p className="text-[11px] text-gray-400">
          Closing a finding records that it has been considered. Re-checks won&apos;t raise it again.
        </p>
      )}
      {references.length > 0 && (
        <p className="text-[11px] text-blue-500">
          Checked against:{' '}
          {references.map((r, i) => (
            <span key={r.url}>
              {i > 0 && ', '}
              <a href={r.url} target="_blank" rel="noreferrer" className="underline">{r.title}</a>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
