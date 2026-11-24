// Drop-off and retention summary (api/_funnel.ts): built from a small fake events table.
import { buildFunnel } from '../api/_funnel.ts'

function check(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

type Row = Record<string, unknown>
const DAY = 86_400_000
const NOW = Date.parse('2026-11-24T12:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

/** Just enough of the Supabase query builder for the reads _funnel.ts makes. */
function fakeDb(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const q = {
        select() { return q },
        in(col: string, vals: unknown[]) { rows = rows.filter((r) => vals.includes(r[col])); return q },
        gte(col: string, v: string) { rows = rows.filter((r) => String(r[col]) >= v); return q },
        order() { return q },
        limit() { return q },
        range(a: number, b: number) { rows = rows.slice(a, b + 1); return q },
        then(ok: (v: { data: Row[]; error: null }) => unknown) { return Promise.resolve({ data: rows, error: null }).then(ok) },
      }
      return q
    },
  }
}

let id = 0
const ev = (name: string, anon: string, session: string, at: number, props: Row = {}): Row => ({ id: ++id, name, anon_id: anon, session_id: session, props, created_at: iso(at) })
const t0 = NOW - 2 * DAY
const events: Row[] = [
  // Player A: enters, opens Campus, starts the lesson, leaves on card 2.
  ev('first_visit', 'a', 'sa', t0),
  ev('step', 'a', 'sa', t0 + 5_000, { step: 'enter_city', prev: 'title', ms: 5_000, first: true }),
  ev('step', 'a', 'sa', t0 + 25_000, { step: 'learn_open', prev: 'enter_city', ms: 20_000, first: true }),
  ev('step', 'a', 'sa', t0 + 30_000, { step: 'lesson_start', prev: 'learn_open', ms: 5_000, first: true }),
  ev('step', 'a', 'sa', t0 + 60_000, { step: 'lesson_leave', prev: 'lesson_start', ms: 30_000, first: true, course: 'internet', card: 2, where: 'lesson' }),
  ev('session_length', 'a', 'sa', t0 + 61_000, { secs: 61, last: 'lesson_leave', ms: 1_000, first: true }),
  // Player B: enters the city and leaves there.
  ev('first_visit', 'b', 'sb', t0 + 1_000),
  ev('step', 'b', 'sb', t0 + 9_000, { step: 'enter_city', prev: 'title', ms: 8_000, first: true }),
  ev('session_length', 'b', 'sb', t0 + 40_000, { secs: 40, last: 'enter_city', ms: 31_000, first: true }),
  // Player C: never leaves the title screen.
  ev('first_visit', 'c', 'sc', t0 + 2_000),
  ev('session_length', 'c', 'sc', t0 + 12_000, { secs: 10, last: 'title', ms: 10_000, first: true }),
  // Player D: passes the first lesson and sees the CV.
  ev('first_visit', 'd', 'sd', t0 + 3_000),
  ev('step', 'd', 'sd', t0 + 6_000, { step: 'enter_city', prev: 'title', ms: 3_000, first: true }),
  ev('step', 'd', 'sd', t0 + 8_000, { step: 'learn_open', prev: 'enter_city', ms: 2_000, first: true }),
  ev('step', 'd', 'sd', t0 + 9_000, { step: 'lesson_start', prev: 'learn_open', ms: 1_000, first: true }),
  ev('step', 'd', 'sd', t0 + 70_000, { step: 'exercise_start', prev: 'lesson_start', ms: 61_000, first: true }),
  ev('step', 'd', 'sd', t0 + 90_000, { step: 'lesson_complete', prev: 'exercise_start', ms: 20_000, first: true }),
  ev('step', 'd', 'sd', t0 + 91_000, { step: 'cv_seen', prev: 'lesson_complete', ms: 1_000, first: true }),
  ev('first_lesson', 'd', 'sd', t0 + 90_000),
  // Retention: A came back the next day; an old visitor E from 40 days ago came back after 30 days.
  ev('session_start', 'a', 'sa2', t0 + DAY),
  ev('session_start', 'e', 'se', NOW - 40 * DAY),
  ev('sign_in', 'e', 'se', NOW - 40 * DAY),
  ev('session_start', 'e', 'se2', NOW - 5 * DAY),
  ev('cert_viewed', '', '', NOW - DAY, { page: 'cert' }),
  ev('cert_shared', 'd', 'sd', t0 + 95_000),
]

const out = await buildFunnel(fakeDb({ events, topups: [], near_topups: [], rail_topups: [], player_progress: [] }) as never, 14, NOW)
const reached = Object.fromEntries(out.steps.map((s) => [s.id, s.reached]))
check(out.firstSessions === 4, `four first sessions, got ${out.firstSessions}`)
check(reached.opened === 4 && reached.enter_city === 3 && reached.learn_open === 2 && reached.lesson_start === 2, 'funnel counts')
check(reached.exercise_start === 1 && reached.lesson_complete === 1 && reached.cv_seen === 1, 'later steps')
check(out.mostLeftAt?.step === 'lesson_start' || out.mostLeftAt?.step === 'enter_city' || out.mostLeftAt?.step === 'opened', 'a step is named as the most left')
check(out.lessonLeaves[0]?.course === 'internet' && out.lessonLeaves[0]?.card === 2, 'lesson leave card is recorded')
check(out.steps.find((s) => s.id === 'enter_city')?.medianSecs === 20 || out.steps.find((s) => s.id === 'enter_city')?.medianSecs !== null, 'time on step')
check(out.medianFirstSessionSecs === 40, `median first session ${out.medianFirstSessionSecs}`)
check(out.retention.d1 !== null && out.retention.d1 > 0, 'day-1 return counted')
check(out.retention.d30 === 100, `day-30: the only visitor old enough came back, got ${out.retention.d30}`)
check(out.retention.signedUp.players === 1 && out.retention.signedUp.d30 === 100, 'signed-up retention')
check(out.proof.certViews === 1 && out.proof.certShares === 1, 'proof counts')
check(out.cohorts.length >= 2, 'weekly cohorts')
check(!JSON.stringify(out).includes('"sa"') && !JSON.stringify(out).includes('"a"'), 'no visitor ids leave the summary')
console.log('funnel ok')
