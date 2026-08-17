export const maxDuration = 60

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return Response.json({ text: '' })

  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    if (name.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(buffer)
      return Response.json({ text: result.text.trim() })
    }

    if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return Response.json({ text: result.value.trim() })
    }
  } catch (e) {
    console.error('Text extraction error:', e)
  }

  // Unsupported file type — store empty content
  return Response.json({ text: '' })
}
