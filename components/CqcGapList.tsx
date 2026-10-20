import { gapLevel, gapText, type ReviewGap } from '@/lib/cqcReview'

// Lists CQC check findings, with definite gaps kept apart from suggestions
export default function CqcGapList({ gaps, references = [], size = 'sm' }: {
  gaps: ReviewGap[]
  references?: { title: string; url: string }[]
  size?: 'xs' | 'sm'
}) {
  const text = size === 'xs' ? 'text-xs' : 'text-sm'
  const groups = [
    { title: 'Missing or inadequate', items: gaps.filter(g => gapLevel(g) === 'missing'), heading: 'text-red-700', item: 'text-red-900' },
    { title: 'Suggestions', items: gaps.filter(g => gapLevel(g) === 'suggestion'), heading: 'text-amber-700', item: 'text-gray-800' },
    { title: 'Gaps flagged', items: gaps.filter(g => gapLevel(g) === null), heading: 'text-blue-800', item: 'text-blue-900' },
  ].filter(g => g.items.length > 0)

  return (
    <div className="space-y-2">
      {groups.map(group => (
        <div key={group.title}>
          <p className={`text-xs font-semibold ${group.heading}`}>{group.title}</p>
          <ul className="list-disc list-inside space-y-0.5">
            {group.items.map((gap, i) => <li key={i} className={`${text} ${group.item}`}>{gapText(gap)}</li>)}
          </ul>
        </div>
      ))}
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
