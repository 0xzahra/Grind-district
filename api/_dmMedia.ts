// Photos, voice notes, videos and documents in direct messages. The file goes to a private Supabase Storage bucket; the message row
// keeps only a short marker, so inbox listings stay small. Thread reads swap the marker for a signed link that
// expires after an hour, so only the two people in the chat (who can read the thread) can open the file.
import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKET = 'dm-media'
const MARK = /\n?\[\[media:(image|voice|video|file):([A-Za-z0-9_./-]{8,160})(?:\|([^\]|]{1,180}))?\]\]$/
export type Kind = 'image' | 'voice' | 'video' | 'file'
export type Media = { kind: Kind; url: string; name?: string; size?: number }

/** Videos and documents are too big to pass through the API (a request is capped near 4.5 MB): the phone uploads them
 *  straight to the private bucket through a one-time signed upload link, then sends the message with the path. */
export const BIG: Record<string, { kind: 'video' | 'file'; type: string; max: number }> = {
  mp4: { kind: 'video', type: 'video/mp4', max: 40_000_000 },
  webm: { kind: 'video', type: 'video/webm', max: 40_000_000 },
  mov: { kind: 'video', type: 'video/quicktime', max: 40_000_000 },
  pdf: { kind: 'file', type: 'application/pdf', max: 15_000_000 },
  txt: { kind: 'file', type: 'text/plain', max: 2_000_000 },
  csv: { kind: 'file', type: 'text/csv', max: 5_000_000 },
  doc: { kind: 'file', type: 'application/msword', max: 15_000_000 },
  docx: { kind: 'file', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', max: 15_000_000 },
  xls: { kind: 'file', type: 'application/vnd.ms-excel', max: 15_000_000 },
  xlsx: { kind: 'file', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', max: 15_000_000 },
  ppt: { kind: 'file', type: 'application/vnd.ms-powerpoint', max: 25_000_000 },
  pptx: { kind: 'file', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', max: 25_000_000 },
}
const extOf = (name: string) => (/\.([a-z0-9]{2,5})$/i.exec(name)?.[1] ?? '').toLowerCase()
const safeName = (name: unknown) => String(name ?? 'file').replace(/[\u0000-\u001f\]|\[\\/]+/g, ' ').trim().slice(0, 120) || 'file'

async function ensureBucket(db: SupabaseClient): Promise<void> {
  const r = await db.storage.getBucket(BUCKET).catch(() => null)
  if (!r || r.error) await db.storage.createBucket(BUCKET, { public: false }).catch(() => undefined)
}

/** A one-time upload link for a video or document: the path is chosen here, inside the sender's own folder. */
export async function uploadSlot(db: SupabaseClient, user: string, raw: unknown): Promise<{ path: string; url: string } | { error: string }> {
  const m = (raw ?? {}) as { name?: unknown; size?: unknown }
  const name = safeName(m.name), ext = extOf(name), spec = BIG[ext]
  if (!spec) return { error: 'Send videos (MP4, WebM, MOV) or documents (PDF, Word, Excel, PowerPoint, TXT, CSV)' }
  const size = Number(m.size)
  if (!Number.isFinite(size) || size <= 0) return { error: 'That file is empty' }
  if (size > spec.max) return { error: `${spec.kind === 'video' ? 'Videos' : 'Documents'} up to ${Math.round(spec.max / 1_000_000)} MB` }
  const path = `${user}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  let r = await db.storage.from(BUCKET).createSignedUploadUrl(path)
  if (r.error) { await ensureBucket(db); r = await db.storage.from(BUCKET).createSignedUploadUrl(path) }
  if (r.error || !r.data) return { error: 'Could not start the upload' }
  return { path, url: r.data.signedUrl }
}

/** Attach an uploaded video or document: it must be in the sender's folder, of an allowed kind, and really there. */
export async function attachUploaded(db: SupabaseClient, user: string, raw: unknown): Promise<{ mark: string } | { error: string }> {
  const m = (raw ?? {}) as { path?: unknown; name?: unknown }
  const path = String(m.path ?? '')
  if (!path.startsWith(`${user}/`) || !/^[A-Za-z0-9_./-]{8,160}$/.test(path) || path.includes('..')) return { error: 'Attachment not found' }
  const spec = BIG[extOf(path)]
  if (!spec) return { error: 'Attachment type not allowed' }
  const file = path.slice(user.length + 1)
  const list = await db.storage.from(BUCKET).list(user, { search: file, limit: 1 })
  const hit = (list.data ?? []).find((f) => f.name === file)
  if (!hit) return { error: 'The upload did not finish. Try again.' }
  const size = Number((hit.metadata as { size?: number } | null)?.size ?? 0)
  if (size > spec.max) { await removeMedia(db, path); return { error: 'File too large' } }
  return { mark: `[[media:${spec.kind}:${path}|${encodeURIComponent(safeName(m.name))}]]` }
}

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

/** An edited message starts with this marker (no extra column needed); readers see an "Edited" label instead. */
export const EDITED = '[[edited]]'
/** The text part of a body, the attachment marker if there is one, and whether it was edited. */
export function splitBody(body: string): { text: string; kind?: Kind; path?: string; name?: string; edited?: boolean } {
  const edited = body.startsWith(EDITED)
  const rest = edited ? body.slice(EDITED.length) : body
  const m = MARK.exec(rest)
  if (!m) return { text: rest, ...(edited ? { edited } : {}) }
  let name: string | undefined
  try { name = m[3] ? decodeURIComponent(m[3]) : undefined } catch { name = undefined }
  return { text: rest.slice(0, m.index).trim(), kind: m[1] as Kind, path: m[2], ...(name ? { name } : {}), ...(edited ? { edited } : {}) }
}
/** Remove a message's attachment from storage (the message itself was deleted by its sender). */
export async function removeMedia(db: SupabaseClient, path: string): Promise<void> {
  await db.storage.from(BUCKET).remove([path]).catch(() => undefined)
}

/** A one-line preview for the inbox. */
export function previewBody(body: string): string {
  const s = splitBody(body)
  if (!s.kind) return s.text
  const tag = s.kind === 'image' ? '📷 Photo' : s.kind === 'voice' ? '🎤 Voice note' : s.kind === 'video' ? '🎬 Video' : `📄 ${s.name ?? 'Document'}`
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
    const edited = p.edited ? { edited: true } : {}
    if (!p.kind || !p.path) return { ...l, body: p.text, ...edited }
    const url = urls.get(p.path)
    return { ...l, body: p.text, ...edited, ...(url ? { media: { kind: p.kind, url, ...(p.name ? { name: p.name } : {}) } } : {}) }
  })
}
