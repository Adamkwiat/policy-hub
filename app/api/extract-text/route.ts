import { extractDocText } from '@/lib/wordDoc'
import { requireUser } from '@/lib/require-user'

export const maxDuration = 60

export async function POST(request: Request) {
  const unauthorised = await requireUser()
  if (unauthorised) return unauthorised

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

    if (name.endsWith('.doc')) {
      return Response.json({ text: await extractDocText(buffer) })
    }
  } catch (e) {
    console.error('Text extraction error:', e)
  }

  // Unsupported file type — store empty content
  return Response.json({ text: '' })
}
