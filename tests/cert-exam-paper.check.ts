// Certificate exam papers: sealed (order and shuffles not readable), handed in once, and papers handed out before
// this change still grade. No network; a fake table for the hand-in record.
import { createHash, createHmac } from 'node:crypto'
import { EXAM_BANK } from '../api/_certExamBank.ts'
import { consumePaper, gradeExam, startExam, tooManyFailedPapers, FAILED_PAPERS_PER_HOUR } from '../api/_certExam.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }
process.env.CERT_EXAM_KEY = 'test-only-exam-key'
const t0 = Date.parse('2026-11-28T09:00:00Z')

const s = startExam('amina', 'spot', t0)
if (!s.ok) throw new Error('exam off')
const tok = s.paper.token
ok(tok.startsWith('p2.'), 'new papers are sealed')
let readable = false
for (const part of tok.split('.')) { try { const j = Buffer.from(part, 'base64url').toString('utf8'); if (/"o"|"m"|amina|spot/.test(j)) readable = true } catch { /* binary */ } }
ok(!readable, 'question order, shuffles, player and course are not readable from the token')
const right = s.paper.questions.map((q) => { const b = EXAM_BANK.spot!.find((x) => x[0] === q.prompt)!; return q.choices.indexOf(b[1][b[2]]!) })
const g1 = gradeExam('amina', 'spot', tok, right, t0 + 30_000)
ok(g1.ok && g1.result.passed, 'right answers on a sealed paper pass')
const g2 = gradeExam('amina', 'spot', tok, right, t0 + 31_000)
ok(g1.ok && g2.ok && g1.paperId === g2.paperId, 'the same paper always maps to the same hand-in id')
const s2 = startExam('amina', 'spot', t0)
const g3 = s2.ok ? gradeExam('amina', 'spot', s2.paper.token, s2.paper.questions.map(() => 0), t0 + 30_000) : null
ok(!!g3 && g3.ok && g1.ok && g3.paperId !== g1.paperId, 'a new paper has a new id')
const tampered = tok.slice(0, -3) + (tok.endsWith('A') ? 'BBB' : 'AAA')
ok(!gradeExam('amina', 'spot', tampered, right, t0 + 30_000).ok, 'a tampered sealed paper is refused')
ok(!gradeExam('bola', 'spot', tok, right, t0 + 30_000).ok, 'another player cannot hand in this paper')

// A paper handed out by the previous build (signed, not sealed) still grades during its time limit.
const key = createHash('sha256').update('grind-district-cert-exam\ntest-only-exam-key').digest()
const n = EXAM_BANK.spot!.length
const legacyBody = { k: 'exam', u: 'amina', c: 'spot', o: Array.from({ length: n }, (_, i) => i), m: EXAM_BANK.spot!.map((q) => q[1].map((_, i) => i)), iat: t0, exp: t0 + 600_000 }
const p = Buffer.from(JSON.stringify(legacyBody)).toString('base64url')
const legacy = `${p}.${createHmac('sha256', key).update(p).digest('base64url')}`
const gl = gradeExam('amina', 'spot', legacy, EXAM_BANK.spot!.map((q) => q[2]), t0 + 60_000)
ok(gl.ok && gl.result.passed, 'an exam in progress from before the update still grades')

// Hand-in record
const seen = new Set<string>(); let rows: Array<{ username: string; course_id: string; passed: boolean }> = []
let mode: 'ok' | 'missing' | 'down' = 'ok'
const db = { from: () => ({
  insert: async (r: { paper_hash: string; username: string; course_id: string; passed: boolean }) => {
    if (mode === 'missing') return { error: { code: 'PGRST205', message: 'Could not find the table in the schema cache' } }
    if (mode === 'down') return { error: { code: '57P01', message: 'terminating connection' } }
    if (seen.has(r.paper_hash)) return { error: { code: '23505', message: 'duplicate' } }
    seen.add(r.paper_hash); rows.push(r); return { error: null }
  },
  select: () => { const f: Record<string, unknown> = {}; const c: any = { eq(k: string, v: unknown) { f[k] = v; return c }, gte() { return Promise.resolve({ count: rows.filter((r) => r.username === f.username && r.course_id === f.course_id && r.passed === f.passed).length, error: null }) } }; return c },
}) } as never
if (g1.ok) {
  ok(await consumePaper(db, g1.paperId, 'amina', 'spot', true) === 'ok', 'first hand-in is recorded')
  ok(await consumePaper(db, g1.paperId, 'amina', 'spot', true) === 'used', 'second hand-in of the same paper is refused (no replay)')
}
mode = 'missing'
ok(await consumePaper(db, 'x'.repeat(64), 'amina', 'spot', false) === 'ok', 'table not created yet: exams keep working')
mode = 'down'
ok(await consumePaper(db, 'y'.repeat(64), 'amina', 'spot', false) === 'error', 'storage down: grading refused, not silently allowed')
mode = 'ok'
ok(!(await tooManyFailedPapers(db, 'amina', 'spot')), 'a few tries are fine')
rows = Array.from({ length: FAILED_PAPERS_PER_HOUR }, () => ({ username: 'amina', course_id: 'spot', passed: false }))
ok(await tooManyFailedPapers(db, 'amina', 'spot'), `after ${FAILED_PAPERS_PER_HOUR} failed papers in an hour, new papers wait`)
ok(!(await tooManyFailedPapers(db, 'amina', 'risk')), 'other courses are not affected')

delete process.env.CERT_EXAM_KEY
console.log(`cert exam papers: ${pass} ok, ${fail} failed`)
if (fail) process.exit(1)
