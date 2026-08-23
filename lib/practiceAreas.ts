import type { CqcStandard } from './cqcStandards'

// A general checklist of policy areas commonly expected of a CQC-regulated
// GP practice in England, used for the practice-wide gap analysis
// (app/api/gap-analysis). This is Claude's general knowledge, not an
// official CQC checklist or a live-sourced list -- treat it as a sensible
// starting point for a manager to sanity-check, not a definitive audit.

export type PracticeArea = {
  name: string
  standard: CqcStandard['name']
  description: string
}

export const EXPECTED_POLICY_AREAS: PracticeArea[] = [
  { name: 'Safeguarding children', standard: 'Safe', description: 'How staff identify, respond to, and escalate concerns about a child.' },
  { name: 'Safeguarding adults', standard: 'Safe', description: 'How staff identify, respond to, and escalate concerns about a vulnerable adult.' },
  { name: 'Infection prevention and control', standard: 'Safe', description: 'Hand hygiene, PPE, cleaning, and outbreak procedures.' },
  { name: 'Medicines management', standard: 'Safe', description: 'Prescribing, storage, cold chain/vaccine handling, and disposal.' },
  { name: 'Significant event analysis / incident reporting', standard: 'Safe', description: 'How incidents and near-misses are reported, reviewed, and learned from.' },
  { name: 'Health and safety', standard: 'Safe', description: 'General workplace health and safety, including risk assessments.' },
  { name: 'Fire safety', standard: 'Safe', description: 'Fire risk assessment, evacuation procedures, and staff training.' },
  { name: 'Lone working', standard: 'Safe', description: 'Protecting staff who work alone, including home visits.' },
  { name: 'Recruitment and DBS checks', standard: 'Safe', description: 'Safe recruitment practices and criminal record checks for staff.' },
  { name: 'Consent to treatment', standard: 'Effective', description: 'Obtaining and recording informed consent, including for those who lack capacity.' },
  { name: 'Staff training and appraisal', standard: 'Effective', description: 'Mandatory training, induction, and ongoing competence checks.' },
  { name: 'Chaperone policy', standard: 'Caring', description: 'Offering and recording chaperones for intimate examinations.' },
  { name: 'Complaints handling', standard: 'Responsive', description: 'How complaints are received, investigated, responded to, and learned from.' },
  { name: 'Access and reasonable adjustments', standard: 'Responsive', description: 'Ensuring services are accessible, including for patients with disabilities.' },
  { name: 'Confidentiality and data protection', standard: 'Well-led', description: 'GDPR compliance, patient confidentiality, and data breach procedures.' },
  { name: 'Records management', standard: 'Well-led', description: 'Retention, storage, and secure disposal of records.' },
  { name: 'Business continuity', standard: 'Well-led', description: 'Plans for maintaining services during major disruption (IT failure, pandemic, etc).' },
  { name: 'Whistleblowing / raising concerns', standard: 'Well-led', description: 'How staff can raise concerns about safety or conduct without fear of reprisal.' },
  { name: 'Equality and diversity', standard: 'Well-led', description: "Ensuring fair treatment of staff and patients regardless of protected characteristics." },
]

export type ReferenceSource = {
  name: string
  url: string
  note: string
}

// General-purpose reference bodies relevant to English GP practices.
// Static, informational links only -- not queried live by the app.
export const OTHER_REFERENCE_SOURCES: ReferenceSource[] = [
  { name: 'NHS England', url: 'https://www.england.nhs.uk', note: 'GP contract requirements and national service specifications' },
  { name: 'NICE', url: 'https://www.nice.org.uk', note: 'Clinical guidelines and evidence-based practice' },
  { name: 'ICO (Information Commissioner’s Office)', url: 'https://ico.org.uk', note: 'Data protection and GDPR guidance' },
  { name: 'HSE (Health and Safety Executive)', url: 'https://www.hse.gov.uk', note: 'Workplace health and safety regulation' },
  { name: 'GMC (General Medical Council)', url: 'https://www.gmc-uk.org', note: 'Professional standards and conduct for doctors' },
]
