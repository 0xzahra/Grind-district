// The certificate exam: graded on the server before a certificate can be minted. Underscore = not a function.
// The server picks the course's checks from its own copy (api/_certExamBank.ts), shuffles the questions and
// their choices, and hands out a signed exam paper with a time limit. The player's answers come back to the
// server, which grades them against its answer key. A pass returns a signed pass ticket (30 minutes) that the
// mint voucher requires. Nothing here trusts the player's device: editing a save cannot produce a ticket.
// Open-book: the questions are the lesson's own checks, so a pass shows the player did the lesson; it is not
// a proctored exam. Stateless: both the paper and the ticket are HMAC-signed with a key derived from the
// certificate signer key, so no table is needed.
// Papers are sealed (AES-256-GCM) so the question order and choice shuffles are not readable from the token, and
// each paper can be handed in once (consumePaper, table cert_exam_papers); a failed paper means a new paper.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { EXAM_BANK } from './_certExamBank.js'

export const EXAM_SECONDS_PER_QUESTION = 60
export const TICKET_TTL_MS = 30 * 60 * 1000
/** Pass mark: three in four, rounded up (3 of 3, 3 of 4, 4 of 5, 6 of 8). */
export const passMark = (n: number) => Math.ceil(n * 0.75)

type Paper = { k: 'exam'; u: string; c: string; o: number[]; m: number[][]; iat: number; exp: number; i?: string }
type Ticket = { k: 'pass'; u: string; c: string; s: number; n: number; iat: number; exp: number }

function examKey(): Buffer | null {
  // A dedicated CERT_EXAM_KEY wins when set; until then the key is derived exactly as before.
  const k = process.env.CERT_EXAM_KEY || process.env.CERT_NEAR_SIGNER_KEY || process.env.CERT_SIGNER_PRIVATE_KEY
  return k ? createHash('sha256').update(`grind-district-cert-exam\n${k}`).digest() : null
}
const paperKey = (key: Buffer) => createHash('sha256').update('grind-district-cert-paper\n').update(key).digest()
/** Sealed paper: "p2.<iv>.<ciphertext>.<tag>" (base64url), readable and checkable only by this server. */
function sealPaper(body: Paper, key: Buffer): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', paperKey(key), iv)
  const ct = Buffer.concat([c.update(JSON.stringify(body), 'utf8'), c.final()])
  return `p2.${iv.toString('base64url')}.${ct.toString('base64url')}.${c.getAuthTag().toString('base64url')}`
}
function openPaper(token: unknown, key: Buffer): Paper | null {
  if (typeof token !== 'string' || token.length > 4000) return null
  if (!token.startsWith('p2.')) return open<Paper>(token, key) // papers handed out before sealing (expire within minutes)
  const [, iv, ct, tag] = token.split('.')
  if (!iv || !ct || !tag) return null
  try {
    const d = createDecipheriv('aes-256-gcm', paperKey(key), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')) as Paper
  } catch { return null }
}
/** The id a paper is recorded under when it is handed in. */
const paperId = (p: Paper, token: string) => createHash('sha256').update(p.i ? `p2\n${p.i}` : `p1\n${token}`).digest('hex')
const b64 = (s: string) => Buffer.from(s).toString('base64url')
function seal(body: object, key: Buffer): string {
  const p = b64(JSON.stringify(body))
  return `${p}.${createHmac('sha256', key).update(p).digest('base64url')}`
}
function open<T>(token: unknown, key: Buffer): T | null {
  if (typeof token !== 'string' || token.length > 4000) return null
  const [p, mac] = token.split('.')
  if (!p || !mac) return null
  const want = createHmac('sha256', key).update(p).digest()
  const got = Buffer.from(mac, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try { return JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as T } catch { return null }
}
function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!] }
  return a
}

export type ExamPaper = { token: string; seconds: number; passMark: number; questions: Array<{ prompt: string; choices: string[] }> }

/** A fresh exam paper for this player and course: shuffled questions and choices, no answers. */
export function startExam(username: string, course: string, now = Date.now()): { ok: true; paper: ExamPaper } | { ok: false; status: number; error: string } {
  const key = examKey()
  if (!key) return { ok: false, status: 503, error: 'certificate exams are not live yet' }
  const bank = EXAM_BANK[course]
  if (!bank?.length) return { ok: false, status: 400, error: 'unknown course' }
  const order = shuffled(bank.length)
  const perms = order.map((qi) => shuffled(bank[qi]![1].length))
  const seconds = bank.length * EXAM_SECONDS_PER_QUESTION + 30
  const paper: Paper = { k: 'exam', u: username.toLowerCase(), c: course, o: order, m: perms, iat: now, exp: now + seconds * 1000, i: randomBytes(16).toString('base64url') }
  return {
    ok: true,
    paper: {
      token: sealPaper(paper, key), seconds, passMark: passMark(bank.length),
      questions: order.map((qi, j) => ({ prompt: bank[qi]![0], choices: perms[j]!.map((ci) => bank[qi]![1][ci]!) })),
    },
  }
}

export type ExamResult = { score: number; of: number; passMark: number; passed: boolean; missed: number[]; ticket?: string }

/** Grade answers (indices into the shuffled choices, in the order shown) on the server. */
export function gradeExam(username: string, course: string, token: unknown, answers: unknown, now = Date.now()): { ok: true; result: ExamResult; paperId: string; exp: number } | { ok: false; status: number; error: string } {
  const key = examKey()
  if (!key) return { ok: false, status: 503, error: 'certificate exams are not live yet' }
  const p = openPaper(token, key)
  if (!p || p.k !== 'exam' || p.u !== username.toLowerCase() || p.c !== course) return { ok: false, status: 400, error: 'this exam paper is not yours' }
  if (now > p.exp) return { ok: false, status: 410, error: 'time is up for this exam; start a new one' }
  const bank = EXAM_BANK[course]
  if (!bank || p.o.length !== bank.length || !Array.isArray(answers) || answers.length !== p.o.length) return { ok: false, status: 400, error: 'answer every question' }
  const missed: number[] = []
  p.o.forEach((qi, j) => {
    const pick = Number(answers[j])
    const chosen = Number.isInteger(pick) ? p.m[j]?.[pick] : undefined
    if (chosen !== bank[qi]![2]) missed.push(j)
  })
  const of = p.o.length, score = of - missed.length, mark = passMark(of), passed = score >= mark
  const result: ExamResult = { score, of, passMark: mark, passed, missed }
  if (passed) result.ticket = seal({ k: 'pass', u: p.u, c: course, s: score, n: of, iat: now, exp: now + TICKET_TTL_MS } satisfies Ticket, key)
  return { ok: true, result, paperId: paperId(p, String(token)), exp: p.exp }
}

/** Failed papers allowed per player and course in an hour (each paper is a fresh shuffle). */
export const FAILED_PAPERS_PER_HOUR = 6

/** Record a paper as handed in. 'used' = it was handed in before. A missing table (migration not run yet) lets the
 *  paper through rather than blocking every exam; any other storage problem is an error. */
export async function consumePaper(db: SupabaseClient, id: string, username: string, course: string, passed: boolean): Promise<'ok' | 'used' | 'error'> {
  const { error } = await db.from('cert_exam_papers').insert({ paper_hash: id, username: username.toLowerCase(), course_id: course, passed })
  if (!error) return 'ok'
  if (error.code === '23505') return 'used'
  if (/42P01|PGRST205|does not exist|schema cache/i.test(`${error.code ?? ''} ${error.message ?? ''}`)) { console.warn('cert_exam_papers missing: run the migration'); return 'ok' }
  return 'error'
}

/** Whether this player has used up their failed papers for this course in the last hour. */
export async function tooManyFailedPapers(db: SupabaseClient, username: string, course: string, now = Date.now()): Promise<boolean> {
  const { count, error } = await db.from('cert_exam_papers').select('paper_hash', { count: 'exact', head: true })
    .eq('username', username.toLowerCase()).eq('course_id', course).eq('passed', false).gte('at', new Date(now - 3_600_000).toISOString())
  return !error && (count ?? 0) >= FAILED_PAPERS_PER_HOUR
}

/** The pass ticket the mint voucher requires: signed by this server, for this player and course, not expired. */
export function checkTicket(username: string, course: string, ticket: unknown, now = Date.now()): { ok: true; score: number; of: number } | { ok: false } {
  const key = examKey()
  if (!key) return { ok: false }
  const t = open<Ticket>(ticket, key)
  if (!t || t.k !== 'pass' || t.u !== username.toLowerCase() || t.c !== course || now > t.exp || t.s < passMark(t.n)) return { ok: false }
  return { ok: true, score: t.s, of: t.n }
}
