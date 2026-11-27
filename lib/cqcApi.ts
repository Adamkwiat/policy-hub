// CQC's public "Syndication" API, used to read recent GP practice inspection reports.
// Needs a free subscription key from https://api-portal.service.cqc.org.uk, saved on
// Vercel as CQC_API_KEY. Server-side only.

const BASE_URL = 'https://api.service.cqc.org.uk/public/v1'
const PARTNER_CODE = 'PolicyHub' // CQC asks every caller to identify itself
const TIMEOUT_MS = 20000

export class CqcApiError extends Error {}

function apiKey() {
  const key = process.env.CQC_API_KEY
  if (!key) throw new CqcApiError('CQC_API_KEY is not set on Vercel yet. See the setup steps on this page.')
  return key
}

async function cqcFetch(path: string, accept = 'application/json') {
  const url = new URL(BASE_URL + path)
  url.searchParams.set('partnerCode', PARTNER_CODE)
  const res = await fetch(url, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey(), Accept: accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (res.status === 401 || res.status === 403) throw new CqcApiError('CQC rejected the API key. Check CQC_API_KEY on Vercel is the Syndication primary key.')
  if (res.status === 429) throw new CqcApiError('CQC is limiting requests. Wait a minute, then press Update again to carry on.')
  if (!res.ok) throw new CqcApiError(`CQC returned an error (${res.status}) for ${path}`)
  return res
}

export type LocationPage = { locationIds: string[]; page: number; totalPages: number; total: number }

// One page of locations inspected by CQC's primary medical services directorate
// (GP practices, plus some urgent care and independent doctors, filtered out later)
export async function listPrimaryCareLocations(page: number, perPage = 1000): Promise<LocationPage> {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    inspectionDirectorate: 'Primary medical services',
  })
  const res = await cqcFetch(`/locations?${params}`)
  const body = await res.json() as { locations?: { locationId?: string }[]; totalPages?: number; total?: number }
  return {
    locationIds: (body.locations ?? []).map(l => l.locationId).filter((id): id is string => !!id),
    page,
    totalPages: body.totalPages ?? 1,
    total: body.total ?? 0,
  }
}

export type CqcReportRef = {
  linkId: string
  locationId: string
  locationName: string
  region: string | null
  reportDate: string // YYYY-MM-DD
  rating: string | null
}

type LocationDetail = {
  locationId?: string
  name?: string
  registrationStatus?: string
  region?: string
  inspectionCategories?: { name?: string; primary?: string | boolean }[]
  gacServiceTypes?: { name?: string; description?: string }[]
  currentRatings?: { overall?: { rating?: string } }
  reports?: { linkId?: string; reportDate?: string; reportType?: string }[]
}

function isGpPractice(d: LocationDetail) {
  if (d.registrationStatus && d.registrationStatus !== 'Registered') return false
  if (d.inspectionCategories?.length) return d.inspectionCategories.some(c => /gp practices/i.test(c.name ?? ''))
  return (d.gacServiceTypes ?? []).some(s => /doctors\/gps/i.test(`${s.name ?? ''} ${s.description ?? ''}`))
}

// The GP practice's inspection reports published on or after `since` (YYYY-MM-DD).
// Returns [] for locations that aren't registered GP practices.
export async function gpReportsSince(locationId: string, since: string): Promise<CqcReportRef[]> {
  const res = await cqcFetch(`/locations/${encodeURIComponent(locationId)}`)
  const d = await res.json() as LocationDetail
  if (!isGpPractice(d)) return []
  return (d.reports ?? [])
    .filter(r => r.linkId && r.reportDate && r.reportDate.slice(0, 10) >= since && (!r.reportType || r.reportType === 'Location'))
    .map(r => ({
      linkId: r.linkId!,
      locationId,
      locationName: d.name ?? locationId,
      region: d.region ?? null,
      reportDate: r.reportDate!.slice(0, 10),
      rating: d.currentRatings?.overall?.rating ?? null,
    }))
}

// The plain text of a published report
export async function reportText(linkId: string): Promise<string> {
  const res = await cqcFetch(`/reports/${encodeURIComponent(linkId)}`, 'text/plain')
  return (await res.text()).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

// The practice's public page on the CQC website
export function locationPageUrl(locationId: string) {
  return `https://www.cqc.org.uk/location/${encodeURIComponent(locationId)}`
}
