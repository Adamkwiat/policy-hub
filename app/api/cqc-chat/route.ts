import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { cqcStandardGuidanceText } from '@/lib/cqcStandards'
import { gapLevel, gapText, type ReviewGap } from '@/lib/cqcReview'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STANDARD_GUIDANCE = cqcStandardGuidanceText()
const MAX_TURNS = 20
const MAX_MESSAGE_LENGTH = 4000

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(request: Request) {
  const { documentId, messages, accessToken } = await request.json()

  if (!accessToken) return Response.json({ error: 'Not authenticated' }, { status: 401 })
  if (!documentId) return Response.json({ error: 'No document' }, { status: 400 })

  // Load the document as the signed-in user, so row-level security applies and
  // the policy text comes from the database rather than from the browser
  const callerClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await callerClient.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: doc } = await callerClient
    .from('documents')
    .select('name, content, ai_review')
    .eq('id', documentId)
    .single()

  if (!doc?.content) return Response.json({ error: 'This document has no text to discuss' }, { status: 400 })

  const history: ChatMessage[] = Array.isArray(messages)
    ? messages
        .filter((m: ChatMessage) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-MAX_TURNS)
        .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }))
    : []

  // The conversation has to start with the user and end with a new user question
  while (history.length && history[0].role !== 'user') history.shift()
  if (!history.length || history[history.length - 1].role !== 'user') {
    return Response.json({ error: 'No question' }, { status: 400 })
  }

  const review = doc.ai_review
    ? `Standard: ${doc.ai_review.standard ?? 'None'}\nAssessment: ${doc.ai_review.assessment}\nGaps flagged:\n${(doc.ai_review.gaps ?? []).map((g: ReviewGap) => `- ${gapLevel(g) === 'suggestion' ? '[Suggestion] ' : gapLevel(g) === 'missing' ? '[Missing or inadequate] ' : ''}${gapText(g)}`).join('\n') || '(none)'}`
    : '(no CQC check has been run on this document yet)'

  const system = `You are helping a GP practice manager in England improve a policy document so it meets the CQC (Care Quality Commission) fundamental standards.

The five standards are:
${STANDARD_GUIDANCE}

The policy is called "${doc.name}". An earlier automated CQC check gave this result:
${review}

Answer the manager's follow-up questions about this policy and that check: explain what a gap means, why CQC inspectors would look for it, and what the policy could say to address it. When suggesting wording, keep it practical and specific to a GP surgery. Base your answers on the policy text below; if the policy doesn't say something, say so rather than assuming. Be concise. This is assistive guidance for a human to review, not a formal compliance determination.

Policy text:
${doc.content.slice(0, 15000)}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages: history,
    })
    const reply = message.content.map(block => (block.type === 'text' ? block.text : '')).join('').trim()
    return Response.json({ reply })
  } catch (e) {
    console.error('CQC chat API error:', e)
    return Response.json({ error: e instanceof Error ? e.message : 'Anthropic API call failed' }, { status: 502 })
  }
}
