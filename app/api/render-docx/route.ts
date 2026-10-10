import { isLegacyDoc, extractDocText, textToHtml } from '@/lib/wordDoc'
import { requireUser } from '@/lib/require-user'

export const maxDuration = 60

export async function POST(request: Request) {
  const unauthorised = await requireUser()
  if (unauthorised) return unauthorised

  const { url } = await request.json()
  if (!url) return Response.json({ error: 'No url provided' }, { status: 400 })

  // Only fetch signed file links from this app's own Supabase storage
  let parsed: URL
  try { parsed = new URL(url) } catch { return Response.json({ error: 'Invalid url' }, { status: 400 }) }
  const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  if (parsed.origin !== storageOrigin || !parsed.pathname.startsWith('/storage/v1/object/sign/')) {
    return Response.json({ error: 'Invalid url' }, { status: 400 })
  }

  const fileRes = await fetch(url)
  if (!fileRes.ok) return Response.json({ error: 'Could not fetch file' }, { status: 400 })

  const buffer = Buffer.from(await fileRes.arrayBuffer())

  try {
    if (isLegacyDoc(buffer)) {
      return Response.json({ html: textToHtml(await extractDocText(buffer)) })
    }

    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ buffer })
    return Response.json({ html: result.value })
  } catch (e) {
    console.error('Docx render error:', e)
    return Response.json({ error: 'Could not render document' }, { status: 500 })
  }
}
