// Old-style Word (.doc) files are a binary format mammoth can't read, so we
// pull their text out with word-extractor and lay it out as simple paragraphs.

// .doc files start with the OLE compound-file signature; .docx files are zip archives.
export function isLegacyDoc(buffer: Buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
}

export async function extractDocText(buffer: Buffer) {
  const WordExtractor = (await import('word-extractor')).default
  const doc = await new WordExtractor().extract(buffer)
  return doc.getBody().trim()
}

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function textToHtml(text: string) {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('\n')
}
