export const maxDuration = 60

export async function POST(request: Request) {
  const { url } = await request.json()
  if (!url) return Response.json({ error: 'No url provided' }, { status: 400 })

  const fileRes = await fetch(url)
  if (!fileRes.ok) return Response.json({ error: 'Could not fetch file' }, { status: 400 })

  const buffer = Buffer.from(await fileRes.arrayBuffer())

  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.convertToHtml({ buffer })
    return Response.json({ html: result.value })
  } catch (e) {
    console.error('Docx render error:', e)
    return Response.json({ error: 'Could not render document' }, { status: 500 })
  }
}
