// Single source of truth for what the AI CQC check (app/api/check-cqc) looks
// for, and what the reference page (app/cqc-standards) shows staff. Keep
// these two uses in sync by always going through this file rather than
// duplicating the guidance text elsewhere.
//
// This is Claude's own summary of the CQC's five fundamental standards for
// GP practices, not a verbatim copy of CQC's regulations. It's what the AI
// gap-check is actually working from -- for the authoritative, up-to-date
// wording, refer to CQC's own guidance at https://www.cqc.org.uk.

export type CqcStandard = {
  name: 'Safe' | 'Effective' | 'Caring' | 'Responsive' | 'Well-led'
  summary: string
  covers: string[]
}

export const CQC_FUNDAMENTAL_STANDARDS: CqcStandard[] = [
  {
    name: 'Safe',
    summary: 'Protects people from abuse and avoidable harm.',
    covers: [
      'Safeguarding',
      'Safe recruitment',
      'Medicines management',
      'Infection prevention and control',
      'Incident reporting and learning from mistakes',
    ],
  },
  {
    name: 'Effective',
    summary: 'Care and treatment achieves good outcomes, based on best available evidence.',
    covers: [
      'Staff training and competence',
      'Consent',
      'Monitoring outcomes',
    ],
  },
  {
    name: 'Caring',
    summary: 'Staff treat people with compassion, dignity, and respect, and involve them in decisions about their care.',
    covers: [
      'Compassion and dignity',
      'Involving people in decisions',
    ],
  },
  {
    name: 'Responsive',
    summary: "Services are organised to meet people's needs.",
    covers: [
      'Access and flexibility',
      'Handling and acting on complaints',
    ],
  },
  {
    name: 'Well-led',
    summary: 'Leadership, management and governance assure the delivery of high-quality care.',
    covers: [
      'Risk management',
      'Accountability',
      'A culture of learning and improvement',
    ],
  },
]

export function cqcStandardNames(): string[] {
  return CQC_FUNDAMENTAL_STANDARDS.map(s => s.name)
}

export function cqcStandardGuidanceText(): string {
  return CQC_FUNDAMENTAL_STANDARDS
    .map(s => `- ${s.name}: ${s.summary} Covers ${s.covers.join(', ').toLowerCase()}.`)
    .join('\n')
}
