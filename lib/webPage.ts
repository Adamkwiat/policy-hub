import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 15000

// Refuse addresses on private, loopback or link-local networks, so a website
// address can't be used to reach anything that isn't on the public internet.
function isPrivateAddress(address: string) {
  if (isIP(address) === 6) {
    const a = address.toLowerCase()
    if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7))
    return a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80')
  }
  const [a, b] = address.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
}

async function checkPublicUrl(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Address must start with https://')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
    throw new Error('That address is not a public website')
  }
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Page is too large (over 5 MB)') }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', pound: '£' }

// The page's main content where it marks one, so menus and banners are left out
function mainHtml(html: string) {
  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)
  return main ? main[1] : html
}

export function htmlToText(html: string) {
  return mainHtml(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(p|div|br|li|h[1-6]|tr|section|article|ul|ol|table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#?[0-9a-z]+;/gi, decodeEntities)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export type PageLink = { url: string; title: string }

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

function htmlLinks(html: string, base: URL): PageLink[] {
  const links: PageLink[] = []
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decodeEntities(m[1]), base)
      url.hash = ''
      const title = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
      links.push({ url: url.toString(), title })
    } catch { /* ignore malformed links */ }
  }
  return links
}

// Fetches a page and returns its text, plus its links when it's an HTML page.
export async function fetchPage(address: string): Promise<{ url: URL; text: string; links: PageLink[] }> {
  let url: URL
  try { url = new URL(address.trim()) } catch { throw new Error('That is not a valid web address') }

  let res: Response | null = null
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await checkPublicUrl(url)
    res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'PolicyHub/1.0 (GP practice policy tool)', Accept: 'text/html,application/pdf,text/plain' },
    })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) { url = new URL(location, url); continue }
    break
  }
  if (!res || (res.status >= 300 && res.status < 400)) throw new Error('The website redirected too many times')
  if (!res.ok) throw new Error(`The website returned an error (${res.status})`)

  const type = res.headers.get('content-type')?.toLowerCase() ?? ''
  const buffer = await readLimited(res)

  if (type.includes('pdf') || url.pathname.toLowerCase().endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    return { url, text: (await pdfParse(buffer)).text.trim(), links: [] }
  }
  if (type.includes('html')) {
    const html = buffer.toString('utf8')
    return { url, text: htmlToText(html), links: htmlLinks(mainHtml(html), url) }
  }
  if (type.startsWith('text/')) return { url, text: buffer.toString('utf8').trim(), links: [] }
  throw new Error('That page is not a web page or PDF the app can read')
}

// Downloads a public web page (HTML, plain text or PDF) and returns its readable text.
export async function fetchPageText(address: string) {
  return (await fetchPage(address)).text
}

const MAX_SUBPAGES = 200
const MAX_LISTING_PAGES = 10

// For an index page such as CQC's GP mythbusters, finds the pages it lists:
// links on the same site that sit under the index's address (…/gp-mythbusters/…)
// or are named after it (…/gp-mythbuster-109-…). Follows the index's own
// "page 2, 3…" links so long lists are covered.
export async function findSubpages(address: string) {
  const first = await fetchPage(address)
  const hub = first.url
  const hubPath = hub.pathname.replace(/\/+$/, '')
  const hubSlug = hubPath.split('/').pop() ?? ''
  const singular = hubSlug.replace(/s$/, '')

  const isSubpage = (u: URL) => {
    if (u.host !== hub.host) return false
    const path = u.pathname.replace(/\/+$/, '')
    if (path === hubPath) return false
    if (path.startsWith(`${hubPath}/`)) return true
    const last = path.split('/').pop() ?? ''
    return singular.length >= 4 && last.startsWith(`${singular}-`)
  }
  const isListingPage = (u: URL) =>
    u.host === hub.host && u.pathname.replace(/\/+$/, '') === hubPath && u.searchParams.has('page')

  const found = new Map<string, string>()
  const seenListings = new Set([hub.toString()])
  const queue: PageLink[][] = [first.links]

  while (queue.length) {
    for (const link of queue.shift()!) {
      const u = new URL(link.url)
      if (isSubpage(u) && !found.has(u.toString()) && found.size < MAX_SUBPAGES) {
        found.set(u.toString(), link.title)
      } else if (isListingPage(u) && !seenListings.has(u.toString()) && seenListings.size < MAX_LISTING_PAGES) {
        seenListings.add(u.toString())
        try { queue.push((await fetchPage(u.toString())).links) } catch { /* skip a listing page that fails */ }
      }
    }
  }

  return { text: first.text, subpages: [...found].map(([url, title]) => ({ url, title })) }
}
