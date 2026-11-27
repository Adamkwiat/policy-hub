import type Anthropic from '@anthropic-ai/sdk'
import { EXPECTED_POLICY_AREAS } from './practiceAreas'

// Findings read from CQC inspection reports of other GP practices (supabase/010), and the
// recurring themes summarised from them for each policy area. Used by the CQC check and the
// policy chat as evidence of what inspectors actually pick up on.

export type FindingType = 'must' | 'should' | 'shortcoming'
export type ReportFinding = { type: FindingType; area: string; text: string }
export type Theme = { type: 'must' | 'should'; text: string; reports: number }
export type ThemeRow = { area: string; themes: Theme[]; report_count: number; updated_at: string }

export const OTHER_AREA = 'Other'
export const THEME_AREAS = [...EXPECTED_POLICY_AREAS.map(a => a.name), OTHER_AREA]

const MAX_AREAS_PER_POLICY = 2
const MODEL = 'claude-haiku-4-5-20251001'

// Picks the policy areas (that have themes) this policy relates to.
// Asks Claude; falls back to matching words in the area names.
export async function chooseThemeAreas(anthropic: Anthropic, rows: ThemeRow[], documentName: string, content: string): Promise<ThemeRow[]> {
  const usable = rows.filter(r => r.area !== OTHER_AREA && r.themes.length)
  if (!usable.length) return []
  const list = usable.map((r, i) => `${i + 1}. ${r.area}`).join('\n')
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 50,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `A GP practice document is called "${documentName}". Its opening reads:\n\n${content.slice(0, 2000)}\n\nWhich of these policy areas does it cover? Choose up to ${MAX_AREAS_PER_POLICY}, most relevant first, and only ones it clearly covers. Respond with ONLY JSON like {"areas": [3]}, or {"areas": []} if none.\n\n${list}`,
      }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text)
    if (Array.isArray(parsed.areas)) {
      return parsed.areas
        .map((n: unknown) => (typeof n === 'number' ? usable[n - 1] : undefined))
        .filter((r: ThemeRow | undefined): r is ThemeRow => !!r)
        .slice(0, MAX_AREAS_PER_POLICY)
    }
  } catch (e) {
    console.error('Theme area selection failed, matching names instead:', e)
  }
  const words = new Set(`${documentName} ${content.slice(0, 1500)}`.toLowerCase().match(/[a-z]{5,}/g) ?? [])
  return usable
    .map(r => ({ r, score: (r.area.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter(w => words.has(w)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_AREAS_PER_POLICY)
    .map(x => x.r)
}

// The themes as text for a prompt
export function themesText(rows: ThemeRow[]) {
  return rows.map(r => {
    if (!r.themes.length) return ''
    const lines = r.themes.map(t => `- [${t.type === 'must' ? 'MUST (breach of regulations)' : 'SHOULD'}, ${t.reports} practice${t.reports === 1 ? '' : 's'}] ${t.text}`)
    return `${r.area} (from ${r.report_count} inspection reports):\n${lines.join('\n')}`
  }).filter(Boolean).join('\n\n')
}
