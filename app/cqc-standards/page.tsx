import { CQC_FUNDAMENTAL_STANDARDS } from '@/lib/cqcStandards'

export default function CqcStandardsReference() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <a href="/policies" className="text-gray-500 text-sm">← Back</a>
        <h1 className="text-xl font-semibold text-gray-900">CQC Standards Reference</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-sm text-blue-900">
            This is exactly what the AI CQC check reads before assessing your policies — the same summary is sent to Claude for every check, so what you see below is what it's actually looking for.
          </p>
          <p className="text-xs text-blue-700">
            It's Claude's own summary of the five standards, not verbatim CQC regulation text. For the authoritative, up-to-date wording, refer to{' '}
            <a href="https://www.cqc.org.uk" target="_blank" rel="noreferrer" className="underline font-semibold">
              CQC's official website
            </a>.
          </p>
        </div>

        {CQC_FUNDAMENTAL_STANDARDS.map(standard => (
          <div key={standard.name} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2">
            <h2 className="font-semibold text-gray-900">{standard.name}</h2>
            <p className="text-sm text-gray-700">{standard.summary}</p>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Covers</p>
              <ul className="list-disc list-inside space-y-0.5">
                {standard.covers.map(item => (
                  <li key={item} className="text-sm text-gray-600">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
