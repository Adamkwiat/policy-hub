export function formatDate(str: string | null) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function reviewStatus(reviewDate: string | null) {
  if (!reviewDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(reviewDate + 'T00:00:00')
  const daysLeft = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: 'Overdue', className: 'bg-red-100 text-red-700' }
  if (daysLeft <= 30) return { label: 'Due soon', className: 'bg-amber-100 text-amber-700' }
  return null
}
