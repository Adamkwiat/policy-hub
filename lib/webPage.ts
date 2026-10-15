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

export function htmlToText(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(p|div|br|li|h[1-6]|tr|section|article|ul|ol|table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Downloads a public web page (HTML, plain text or PDF) and returns its readable text.
export async function fetchPageText(address: string) {
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
    return (await pdfParse(buffer)).text.trim()
  }
  if (type.includes('html')) return htmlToText(buffer.toString('utf8'))
  if (type.startsWith('text/')) return buffer.toString('utf8').trim()
  throw new Error('That page is not a web page or PDF the app can read')
}
