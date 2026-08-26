export default function AuditsNav() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a href="/ask" className="text-xs text-green-600 font-semibold">Ask AI</a>
      <a href="/audits/timetable" className="text-xs text-teal-600 font-semibold">Re-audit Timetable</a>
      <a href="/cqc-standards" className="text-xs text-blue-600 font-semibold">CQC Standards</a>
      <a href="/policies" className="text-xs text-purple-600 font-semibold">Policies & SOPs</a>
    </div>
  )
}
