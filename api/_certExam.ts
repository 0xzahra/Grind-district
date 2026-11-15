// The certificate exam: graded on the server before a certificate can be minted. Underscore = not a function.
// The server picks the course's checks from its own copy (api/_certExamBank.ts), shuffles the questions and
// their choices, and hands out a signed exam paper with a time limit. The player's answers come back to the
// server, which grades them against its answer key. A pass returns a signed pass ticket (30 minutes) that the
// mint voucher requires. Nothing here trusts the player's device: editing a save cannot produce a ticket.
// Open-book: the questions are the lesson's own checks, so a pass shows the player did the lesson; it is not
// a proctored exam. Stateless: both the paper and the ticket are HMAC-signed with a key derived from the
// certificate signer key, so no table is needed.
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { EXAM_BANK } from './_certExamBank.js'

export const EXAM_SECONDS_PER_QUESTION = 60
export const TICKET_TTL_MS = 30 * 60 * 1000
/** Pass mark: three in four, rounded up (3 of 3, 3 of 4, 4 of 5, 6 of 8). */
export const passMark = (n: number) => Math.ceil(n * 0.75)

type Paper = { k: 'exam'; u: string; c: string; o: number[]; m: number[][]; iat: number; exp: number }
type Ticket = { k: 'pass'; u: string; c: string; s: number; n: number; iat: number; exp: number }

function examKey(): Buffer | null {
  const k = process.env.CERT_NEAR_SIGNER_KEY || process.env.CERT_SIGNER_PRIVATE_KEY || process.env.CERT_EXAM_KEY
  return k ? createHash('sha256').update(`grind-district-cert-exam\n${k}`).digest() : null
}
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
  const paper: Paper = { k: 'exam', u: username.toLowerCase(), c: course, o: order, m: perms, iat: now, exp: now + seconds * 1000 }
  return {
    ok: true,
    paper: {
      token: seal(paper, key), seconds, passMark: passMark(bank.length),
      questions: order.map((qi, j) => ({ prompt: bank[qi]![0], choices: perms[j]!.map((ci) => bank[qi]![1][ci]!) })),
    },
  }
}

export type ExamResult = { score: number; of: number; passMark: number; passed: boolean; missed: number[]; ticket?: string }

/** Grade answers (indices into the shuffled choices, in the order shown) on the server. */
export function gradeExam(username: string, course: string, token: unknown, answers: unknown, now = Date.now()): { ok: true; result: ExamResult } | { ok: false; status: number; error: string } {
  const key = examKey()
  if (!key) return { ok: false, status: 503, error: 'certificate exams are not live yet' }
  const p = open<Paper>(token, key)
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
  return { ok: true, result }
}

/** The pass ticket the mint voucher requires: signed by this server, for this player and course, not expired. */
export function checkTicket(username: string, course: string, ticket: unknown, now = Date.now()): { ok: true; score: number; of: number } | { ok: false } {
  const key = examKey()
  if (!key) return { ok: false }
  const t = open<Ticket>(ticket, key)
  if (!t || t.k !== 'pass' || t.u !== username.toLowerCase() || t.c !== course || now > t.exp || t.s < passMark(t.n)) return { ok: false }
  return { ok: true, score: t.s, of: t.n }
}
