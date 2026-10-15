import { requireManager } from '@/lib/require-user'
import { fetchPageText } from '@/lib/webPage'

export const maxDuration = 60

// Managers add reference websites; this reads the page so its text can be saved
// with it and used by the CQC check.
export async function POST(request: Request) {
  const forbidden = await requireManager()
  if (forbidden) return forbidden

  const { url } = await request.json()
  if (typeof url !== 'string' || !url.trim()) return Response.json({ error: 'No web address given' }, { status: 400 })

  try {
    const text = await fetchPageText(url)
    if (!text) return Response.json({ error: 'No readable text found on that page' }, { status: 422 })
    return Response.json({ text })
  } catch (e) {
    console.error('Fetch website error:', e)
    const message = e instanceof Error && !/fetch failed|ENOTFOUND|aborted|timeout/i.test(e.message)
      ? e.message
      : 'Could not reach that website'
    return Response.json({ error: message }, { status: 400 })
  }
}
