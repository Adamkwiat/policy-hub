import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  const { question, context } = await request.json()

  if (!question?.trim()) return Response.json({ error: 'No question' }, { status: 400 })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a helpful assistant answering staff questions about a GP practice's policies, SOPs, and audits.

Here are the policies and audits currently in the library:

${context || '(nothing has been uploaded yet)'}

Answer this question based only on the documents above: ${question}

If a specific policy or audit clearly addresses the question, name it directly, e.g. "Yes — see 'Safeguarding Adults Policy' (Safeguarding, reviewed 12 Jan 2026)." If nothing in the library addresses it, say so plainly rather than guessing, and note that it may be worth uploading one. Keep your answer concise and reference specific document names and dates where relevant.`,
      },
    ],
  })

  const response = message.content[0]
  if (response.type === 'text') {
    return Response.json({ answer: response.text })
  }

  return Response.json({ answer: 'Sorry, I could not find an answer.' })
}
