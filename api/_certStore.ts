// Server certificate records (Supabase `certificates`, service role only; clients cannot read or write it).
// A certificate page renders only from a record here. Underscore = not a Vercel function.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { canonicalCert } from './_certVoucher.js'
import { decodeCertId, certSerial, certField, watDate, type CertData } from './_certArt.js'
import { CERT_COURSES, CERT_RANKS } from './_certCourses.js'
import { mintedOnNear, mintedOnBase } from './_certChain.js'

let injected: SupabaseClient | null = null
/** Tests only: use an in-memory stand-in instead of Supabase. */
export const setCertDbForTests = (db: SupabaseClient | null) => { injected = db }
/** Service-role client (server env only), or null when the database is not configured. */
export function certDb(): SupabaseClient | null {
  if (injected) return injected
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

export type CertRow = {
  cert_id: string; serial: string; username: string; course_id: string; course_title: string; player_name: string
  issued_ms: number | null; issued_date: string | null; tries: number | null; source: string
}
const COLS = 'cert_id, serial, username, course_id, course_title, player_name, issued_ms, issued_date, tries, source'
const SERIAL = /^GD-[0-9A-Z]{4}-[0-9A-Z]{4}$/
const EARLIEST = Date.parse('2025-01-01T00:00:00Z')

type Save = { name?: unknown; skills?: Record<string, { passed?: boolean; tries?: number } | undefined>; activities?: Array<{ at?: unknown; label?: unknown }> }

/** Display fields come from the record only (never from the link). No rank: certificates do not show one. */
export const rowData = (r: CertRow): CertData => {
  const d: CertData = { v: 2, n: r.player_name, u: r.username, c: r.course_id, t: r.course_title }
  if (r.issued_ms) { d.at = Number(r.issued_ms); d.d = watDate(d.at) } else if (r.issued_date) d.d = r.issued_date
  return d
}

const toRow = (id: string, d: CertData, source: string, userId: string | null, tries: number | null) => ({
  cert_id: id, serial: certSerial(d), username: d.u.toLowerCase(), privy_user_id: userId, course_id: d.c, course_title: d.t,
  player_name: d.n, issued_ms: d.at ?? null, issued_date: d.at ? watDate(d.at) : d.d ?? null, tries, source,
})

/** The certificate for this player and course: the existing record, or a new one issued from the synced save. */
export async function issueCert(db: SupabaseClient, userId: string, username: string, course: string, hintId = ''): Promise<{ ok: true; row: CertRow } | { ok: false; status: number; error: string; exam?: boolean }> {
  const u = username.toLowerCase()
  const have = await db.from('certificates').select(COLS).eq('username', u).eq('course_id', course).eq('source', 'issued').maybeSingle()
  if (have.error) return { ok: false, status: 503, error: 'certificates unavailable' }
  if (have.data) return { ok: true, row: have.data as CertRow }
  const prog = await db.from('player_progress').select('save').eq('privy_user_id', userId).maybeSingle()
  const save = prog.data?.save as Save | undefined
  const c = canonicalCert(save as never, u, course, hintId)
  if (!c.ok) return { ok: false, status: 403, error: c.error }
  // A new record also needs a pass on the server-graded exam (recorded by op=cert-grade).
  const passed = await hasExamPass(db, userId, course)
  if (passed === null) return { ok: false, status: 503, error: 'certificates unavailable' }
  if (!passed) return { ok: false, status: 403, error: 'pass the short certificate exam first', exam: true }
  const tries = Number(save?.skills?.[course]?.tries)
  const ins = await db.from('certificates').upsert(toRow(c.id, c.data, 'issued', userId, Number.isFinite(tries) ? tries : null), { onConflict: 'cert_id', ignoreDuplicates: true })
  // (A parallel first ask may have issued it a moment ago: read back whatever is recorded for this course.)
  const row = await db.from('certificates').select(COLS).eq('username', u).eq('course_id', course).eq('source', 'issued').maybeSingle()
  if (ins.error && !row.data) return { ok: false, status: 503, error: 'certificates unavailable' }
  return row.data ? { ok: true, row: row.data as CertRow } : { ok: false, status: 503, error: 'certificates unavailable' }
}

/** Server-graded exam passes (Supabase `cert_passes`, service role only): one row per player and course. */
export async function hasExamPass(db: SupabaseClient, userId: string, course: string): Promise<boolean | null> {
  const r = await db.from('cert_passes').select('course_id').eq('privy_user_id', userId).eq('course_id', course).maybeSingle()
  return r.error ? null : !!r.data
}
/** Called when the server grades a pass. The first pass is kept. */
export async function recordExamPass(db: SupabaseClient, userId: string, username: string, course: string, score: number, of: number): Promise<boolean> {
  const r = await db.from('cert_passes').upsert(
    { privy_user_id: userId, course_id: course, username: username.toLowerCase(), score, of_total: of, source: 'exam' },
    { onConflict: 'privy_user_id,course_id', ignoreDuplicates: true },
  )
  return !r.error
}

/** An id or serial from a public link -> the server record it names, or null (shown as not valid). */
export async function findCert(db: SupabaseClient, key: string): Promise<CertRow | null> {
  key = key.trim()
  if (SERIAL.test(key.toUpperCase())) {
    const r = await db.from('certificates').select(COLS).eq('serial', key.toUpperCase()).order('source', { ascending: true }).limit(5)
    const rows = (r.data ?? []) as CertRow[]
    return rows.find((x) => x.source === 'issued') ?? rows[0] ?? null
  }
  const d = decodeCertId(key)
  if (!d) return null
  const hit = await db.from('certificates').select(COLS).eq('cert_id', key).maybeSingle()
  if (hit.data) return hit.data as CertRow
  return adoptLegacy(db, key, d)
}

/** Links shared before server records existed: accept one only when it provably belongs to a real pass. */
async function adoptLegacy(db: SupabaseClient, id: string, d: CertData): Promise<CertRow | null> {
  const u = d.u.toLowerCase()
  const title = CERT_COURSES[d.c]
  if (!u || !title || d.t !== title) return null
  const fresh = { ...d, u }
  // 1) Minted: the NFT on-chain points at exactly this link.
  const minted = await Promise.all([mintedOnNear(u, d.c).catch(() => null), mintedOnBase(u, d.c).catch(() => null)])
  const onChain = (x: string) => x.endsWith(`/cert/${id}`) || x.endsWith(`/cert/${id}/image.png`)
  let source = minted.some((m) => m?.certUrls?.some(onChain)) ? 'legacy-chain' : ''
  if (!source) {
    // 2) The same certificate the server already recorded for this player and course, in the older link
    //    format (name, course and issue time all identical; the old format also carried a rank, now ignored).
    const rec = await db.from('certificates').select(COLS).eq('username', u).eq('course_id', d.c).eq('source', 'issued').maybeSingle()
    if (rec.error) return null
    if (rec.data) {
      const r = rec.data as CertRow
      // Byte-for-byte the link the earlier game made for this record: {v,n,u,r,c,t,d,at} with r one of the rank labels.
      let rank = ''
      try { rank = String((JSON.parse(Buffer.from(id, 'base64url').toString('utf8')) as { r?: unknown }).r ?? '') } catch { /* not JSON */ }
      const at = Number(r.issued_ms)
      const before = Buffer.from(JSON.stringify({ v: 2, n: r.player_name, u: r.username, r: rank, c: r.course_id, t: r.course_title, d: watDate(at), at })).toString('base64url')
      if (!CERT_RANKS.includes(rank) || !at || before !== id) return null
      source = 'legacy-save'
    }
  }
  if (!source) {
    // 3) Not minted and nothing recorded yet: the player has a server-graded exam pass for this course and
    //    the synced save shows it passed, under this name and pass time.
    const taken = await db.from('certificates').select('cert_id').eq('username', u).eq('course_id', d.c).limit(1)
    if (taken.error || (taken.data ?? []).length) return null
    const player = await db.from('players').select('privy_user_id').eq('username', u).maybeSingle()
    if (!player.data) return null
    const prog = await db.from('player_progress').select('save').eq('privy_user_id', player.data.privy_user_id).maybeSingle()
    const save = prog.data?.save as Save | undefined
    if (!save?.skills?.[d.c]?.passed) return null
    if ((await hasExamPass(db, player.data.privy_user_id, d.c)) !== true) return null
    if (d.n !== (certField(save.name, 40) || u)) return null
    const logged = Number((save.activities ?? []).find((a) => a?.label === `Passed ${title}`)?.at)
    if (Number.isFinite(logged) && logged >= EARLIEST) {
      if (d.at ? d.at !== Math.floor(logged) : d.d !== watDate(logged)) return null
    } else if (!(d.at ? d.at >= EARLIEST && d.at <= Date.now() : d.d)) return null
    source = 'legacy-save'
  }
  const ins = await db.from('certificates').upsert(toRow(id, fresh, source, null, null), { onConflict: 'cert_id', ignoreDuplicates: true })
  if (ins.error) return null
  const row = await db.from('certificates').select(COLS).eq('cert_id', id).maybeSingle()
  return (row.data as CertRow) ?? null
}
