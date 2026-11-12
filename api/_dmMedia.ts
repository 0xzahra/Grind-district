// Photos and voice notes in direct messages. The file goes to a private Supabase Storage bucket; the message row
// keeps only a short marker, so inbox listings stay small. Thread reads swap the marker for a signed link that
// expires after an hour, so only the two people in the chat (who can read the thread) can open the file.
import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKET = 'dm-media'
const MARK = /\n?\[\[media:(image|voice):([A-Za-z0-9_./-]{8,160})\]\]$/
export type Media = { kind: 'image' | 'voice'; url: string }

/** Kinds, their accepted types, a magic-byte check and the size cap (bytes after base64 decoding). */
const TYPES: Record<string, { kind: 'image' | 'voice'; ext: string; max: number; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { kind: 'image', ext: 'jpg', max: 450_000, magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  'image/png': { kind: 'image', ext: 'png', max: 450_000, magic: (b) => b.subarray(0, 4).toString('hex') === '89504e47' },
  'image/webp': { kind: 'image', ext: 'webp', max: 450_000, magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'audio/webm': { kind: 'voice', ext: 'webm', max: 600_000, magic: (b) => b.subarray(0, 4).toString('hex') === '1a45dfa3' },
  'audio/mp4': { kind: 'voice', ext: 'm4a', max: 600_000, magic: (b) => b.subarray(4, 8).toString() === 'ftyp' },
  'audio/ogg': { kind: 'voice', ext: 'ogg', max: 600_000, magic: (b) => b.subarray(0, 4).toString() === 'OggS' },
}

/** Validate and store an attachment; returns the marker to append to the message body, or an error. */
export async function storeMedia(db: SupabaseClient, user: string, raw: unknown): Promise<{ mark: string } | { error: string }> {
  const m = (raw ?? {}) as { type?: unknown; data?: unknown }
  const type = String(m.type ?? '').split(';')[0]!.trim().toLowerCase()
  const spec = TYPES[type]
  if (!spec) return { error: 'Photos (JPEG, PNG, WebP) and voice notes only' }
  const data = String(m.data ?? '')
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return { error: 'Attachment is not readable' }
  const bytes = Buffer.from(data, 'base64')
  if (!bytes.length || bytes.length > spec.max) return { error: spec.kind === 'image' ? 'Photo too large' : 'Voice note too long' }
  if (!spec.magic(bytes)) return { error: 'Attachment does not match its type' }
  const path = `${user}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${spec.ext}`
  let up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false })
  if (up.error && /bucket|not found/i.test(up.error.message)) {
    // First attachment ever: make the private bucket, then try once more.
    await db.storage.createBucket(BUCKET, { public: false }).catch(() => undefined)
    up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false })
  }
  if (up.error) return { error: 'Could not store the attachment' }
  return { mark: `[[media:${spec.kind}:${path}]]` }
}

/** The text part of a body, and the attachment marker if there is one. */
export function splitBody(body: string): { text: string; kind?: 'image' | 'voice'; path?: string } {
  const m = MARK.exec(body)
  if (!m) return { text: body }
  return { text: body.slice(0, m.index).trim(), kind: m[1] as 'image' | 'voice', path: m[2] }
}

/** A one-line preview for the inbox. */
export function previewBody(body: string): string {
  const s = splitBody(body)
  if (!s.kind) return body
  const tag = s.kind === 'image' ? '📷 Photo' : '🎤 Voice note'
  return s.text ? `${tag} · ${s.text}` : tag
}

/** Replace markers in thread lines with signed links (one batch call). */
export async function signLines<T extends { body: string }>(db: SupabaseClient, lines: T[]): Promise<Array<T & { media?: Media }>> {
  const parts = lines.map((l) => splitBody(l.body))
  const paths = [...new Set(parts.flatMap((p) => (p.path ? [p.path] : [])))]
  const urls = new Map<string, string>()
  if (paths.length) {
    const r = await db.storage.from(BUCKET).createSignedUrls(paths, 3600)
    for (const s of r.data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl)
  }
  return lines.map((l, i) => {
    const p = parts[i]!
    if (!p.kind || !p.path) return l
    const url = urls.get(p.path)
    return { ...l, body: p.text, ...(url ? { media: { kind: p.kind, url } } : {}) }
  })
}
