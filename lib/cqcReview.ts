// Result of the AI CQC check, as saved in documents.ai_review / audits.ai_review.
// Checks run before gaps were labelled saved them as plain strings.
export type GapLevel = 'missing' | 'suggestion'

// open: still to act on. resolved: a re-check found it fixed.
// not_adopted / already_covered: a manager closed it, so later checks don't raise it again.
export type GapStatus = 'open' | 'resolved' | 'not_adopted' | 'already_covered'

export type ReviewGapObject = {
  level: GapLevel
  text: string
  source?: string
  status?: GapStatus // missing = open (checks before this field existed)
  decided_by?: string // manager who closed it
  decided_at?: string // ISO date
}
export type ReviewGap = string | ReviewGapObject

export type AiReview = {
  standard: string | null
  assessment: string
  gaps: ReviewGap[]
  references?: { title: string; url: string }[] // reference pages the check was based on
  reference_ids?: string[] // ids of those pages, reused on re-checks so the same guidance is applied
  checked_at?: string // ISO date
  outdated?: boolean // a new version of the file was uploaded after this check
  truncated?: boolean // the document was longer than the check could read
}

export function gapLevel(gap: ReviewGap): GapLevel | null {
  return typeof gap === 'string' ? null : gap.level
}

export function gapStatus(gap: ReviewGap): GapStatus {
  return typeof gap === 'string' ? 'open' : gap.status ?? 'open'
}

export function isOpen(gap: ReviewGap) {
  return gapStatus(gap) === 'open'
}

export function isClosedByManager(gap: ReviewGap) {
  const s = gapStatus(gap)
  return s === 'not_adopted' || s === 'already_covered'
}

export function gapText(gap: ReviewGap) {
  if (typeof gap === 'string') return gap
  return gap.source ? `${gap.text} (${gap.source})` : gap.text
}

export const STATUS_LABELS: Record<GapStatus, string> = {
  open: 'Open',
  resolved: 'Fixed',
  not_adopted: 'Not adopting',
  already_covered: 'Already covered',
}

// True when a finding is open and is something to act on. Optional suggestions saved by
// older checks are no longer shown: the check only raises missing or inadequate content.
export function isRaised(gap: ReviewGap) {
  return isOpen(gap) && gapLevel(gap) !== 'suggestion'
}

// e.g. "2 missing", or "3 gaps flagged" for older checks. Open findings only.
export function gapSummary(gaps: ReviewGap[]) {
  const open = gaps.filter(isRaised)
  const missing = open.filter(g => gapLevel(g) === 'missing').length
  const unlabelled = open.length - missing
  const parts = []
  if (missing) parts.push(`${missing} missing`)
  if (unlabelled) parts.push(`${unlabelled} gap${unlabelled !== 1 ? 's' : ''} flagged`)
  return parts.join(' · ')
}

// True when an open finding is (or may be) a definite gap
export function hasMissing(gaps: ReviewGap[]) {
  return gaps.some(isRaised)
}

// The badge shown on a policy or audit card
export function reviewBadge(review: AiReview): { label: string; className: string } {
  if (review.outdated) {
    return { label: 'New version — not yet re-checked', className: 'bg-gray-100 text-gray-600' }
  }
  if (!review.standard) {
    return { label: 'CQC checked — not clearly relevant', className: 'bg-gray-100 text-gray-500' }
  }
  if (hasMissing(review.gaps)) {
    return { label: `${gapSummary(review.gaps)} — view`, className: 'bg-red-100 text-red-700' }
  }
  return { label: 'Meets guidance · nothing to raise', className: 'bg-green-100 text-green-700' }
}

// Keeps the last review (and the manager's decisions) when a new version of the file is uploaded,
// so the next check can follow up on it instead of starting again from scratch.
export function markOutdated(review: AiReview | null): AiReview | null {
  return review ? { ...review, outdated: true } : null
}

// Records a manager's decision on one finding (or reopens it)
export function decideGap(review: AiReview, index: number, status: GapStatus, managerName: string): AiReview {
  const gaps = review.gaps.map((g, i) => {
    if (i !== index) return g
    const base: ReviewGapObject = typeof g === 'string' ? { level: 'missing', text: g } : { ...g }
    if (status === 'open') {
      delete base.decided_by
      delete base.decided_at
      return { ...base, status }
    }
    return { ...base, status, decided_by: managerName, decided_at: new Date().toISOString() }
  })
  return { ...review, gaps }
}
