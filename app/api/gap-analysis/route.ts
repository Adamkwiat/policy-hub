import Anthropic from '@anthropic-ai/sdk'
import { EXPECTED_POLICY_AREAS } from '@/lib/practiceAreas'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type DocSummary = { name: string; category: string; cqc_standard: string | null }

export async function POST(request: Request) {
  const { documents } = await request.json() as { documents: DocSummary[] }

  if (!Array.isArray(documents)) return Response.json({ error: 'No documents provided' }, { status: 400 })

  const checklistText = EXPECTED_POLICY_AREAS
    .map(a => `- ${a.name} (${a.standard}): ${a.description}`)
    .join('\n')

  const docsText = documents.length > 0
    ? documents.map(d => `- "${d.name}" — category: ${d.category}, CQC standard: ${d.cqc_standard ?? 'none set'}`).join('\n')
    : '(no policies uploaded yet)'

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are helping a GP practice manager spot gaps in their policy library, compared against a general checklist of policy areas commonly expected of a CQC-regulated GP practice in England.

Checklist of expected policy areas:
${checklistText}

Policies currently uploaded to the practice's library (you only have their name, category, and CQC standard tag -- not their full content):
${docsText}

For each checklist area, judge from the document names/categories/tags alone whether it looks reasonably covered by an existing policy. Be reasonably generous with matching (e.g. a policy literally named "Infection Control" covers "Infection prevention and control"), but don't assume something is covered just because it's plausible -- if there's no document that clearly relates to an area, treat it as a gap.

For every area that looks uncovered, write a short, concrete 1-2 sentence suggestion of what such a policy should address for a GP practice.

Respond with ONLY valid JSON, no other text, in this exact shape:
{"gaps": [{"area": "string", "standard": "string", "suggestion": "string"}], "coveredAreas": ["string", ...]}`,
        },
      ],
    })
  } catch (e) {
    console.error('Gap analysis API error:', e)
    return Response.json({ error: e instanceof Error ? e.message : 'Anthropic API call failed' }, { status: 502 })
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return Response.json({
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      coveredAreas: Array.isArray(parsed.coveredAreas) ? parsed.coveredAreas : [],
    })
  } catch (e) {
    console.error('Gap analysis parse error:', e, text)
    return Response.json({ error: 'Could not run gap analysis' }, { status: 500 })
  }
}
