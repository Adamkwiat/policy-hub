// Result of the AI CQC check, as saved in documents.ai_review / audits.ai_review.
// Checks run before gaps were labelled saved them as plain strings.
export type GapLevel = 'missing' | 'suggestion'
export type ReviewGap = string | { level: GapLevel; text: string; source?: string }

export type AiReview = {
  standard: string | null
  assessment: string
  gaps: ReviewGap[]
  references?: { title: string; url: string }[] // reference pages the check was based on
}

export function gapLevel(gap: ReviewGap): GapLevel | null {
  return typeof gap === 'string' ? null : gap.level
}

export function gapText(gap: ReviewGap) {
  if (typeof gap === 'string') return gap
  return gap.source ? `${gap.text} (${gap.source})` : gap.text
}

// e.g. "2 missing · 1 suggestion", or "3 gaps flagged" for older checks
export function gapSummary(gaps: ReviewGap[]) {
  const missing = gaps.filter(g => gapLevel(g) === 'missing').length
  const suggestions = gaps.filter(g => gapLevel(g) === 'suggestion').length
  const unlabelled = gaps.length - missing - suggestions
  const parts = []
  if (missing) parts.push(`${missing} missing`)
  if (suggestions) parts.push(`${suggestions} suggestion${suggestions !== 1 ? 's' : ''}`)
  if (unlabelled) parts.push(`${unlabelled} gap${unlabelled !== 1 ? 's' : ''} flagged`)
  return parts.join(' · ')
}

export function hasMissing(gaps: ReviewGap[]) {
  return gaps.some(g => gapLevel(g) !== 'suggestion')
}
