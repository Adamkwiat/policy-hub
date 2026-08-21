import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const STANDARDS = ['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led'] as const

const STANDARD_GUIDANCE = `
- Safe: protects people from abuse and avoidable harm. Covers safeguarding, safe recruitment, medicines management, infection prevention and control, and incident reporting/learning from mistakes.
- Effective: care and treatment achieves good outcomes, based on best available evidence. Covers staff training/competence, consent, and monitoring outcomes.
- Caring: staff treat people with compassion, dignity, respect, and involve them in decisions about their care.
- Responsive: services are organised to meet people's needs. Covers access, flexibility, and how complaints are handled and acted on.
- Well-led: leadership, management and governance assure the delivery of high-quality care. Covers risk management, accountability, and a culture of learning and improvement.
`.trim()

export async function POST(request: Request) {
  const { content, document_name } = await request.json()

  if (!content?.trim()) return Response.json({ error: 'No content' }, { status: 400 })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are helping a GP practice manager check a policy document against the CQC (Care Quality Commission) fundamental standards, which every GP practice in England is regulated against.

The five standards are:
${STANDARD_GUIDANCE}

Read the policy document below, called "${document_name}", and:
1. Decide which ONE of the five standards it most relates to (or "None" if it doesn't clearly relate to any, e.g. a purely administrative document).
2. Give a short assessment (2-3 sentences) of whether it adequately covers what that standard expects.
3. List any specific, concrete gaps or missing sections (e.g. "No named person responsible for safeguarding", "No incident reporting procedure"). Give an empty list if there are no obvious gaps.

This is an assistive first-pass suggestion for a human manager to review, not a formal compliance determination.

Respond with ONLY valid JSON, no other text, in this exact shape:
{"standard": "Safe" | "Effective" | "Caring" | "Responsive" | "Well-led" | "None", "assessment": "string", "gaps": ["string", ...]}

Document:
${content.slice(0, 15000)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    const standard = STANDARDS.includes(parsed.standard) ? parsed.standard : null
    return Response.json({
      standard,
      assessment: typeof parsed.assessment === 'string' ? parsed.assessment : '',
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.filter((g: unknown) => typeof g === 'string') : [],
    })
  } catch (e) {
    console.error('CQC check parse error:', e, text)
    return Response.json({ error: 'Could not analyse this document' }, { status: 500 })
  }
}
