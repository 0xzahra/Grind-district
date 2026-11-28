// Lessons leaderboard: ranks from server-graded passes only, weekly top 3 paid once, names only. In-memory tables.
const { buildBoard, rank, weekStart, weekKey, LB_COURSES, LB_REWARDS, FIRST_PAID_WEEK, WEEK_MS } = await import('../api/_leaderboard.ts')
type Row = Record<string, unknown>
const mon = Date.UTC(2026, 11, 7) - 3600_000 // Mon 7 Dec 2026 00:00 WAT
const wed = mon + 2 * 86_400_000 + 12 * 3600_000
const lastMon = mon - WEEK_MS
const iso = (ms: number) => new Date(ms).toISOString()
const pass = (u: string, name: string, course: string, at: number, score = 4, of = 4): Row => ({ privy_user_id: u, username: name, course_id: course, score, of_total: of, passed_at: iso(at) })
const tables: Record<string, Row[]> = {
  cert_passes: [
    // last week (Mon 30 Nov): ann 3 passes, bob 2, cy 2 (lower score), dee 1, eve 1 later
    pass('a', 'ann', LB_COURSES[0]!, lastMon + 1000), pass('a', 'ann', LB_COURSES[1]!, lastMon + 2000), pass('a', 'ann', LB_COURSES[2]!, lastMon + 3000),
    pass('b', 'bob', LB_COURSES[0]!, lastMon + 1000), pass('b', 'bob', LB_COURSES[1]!, lastMon + 2000),
    pass('c', 'cy', LB_COURSES[0]!, lastMon + 500, 3, 4), pass('c', 'cy', LB_COURSES[1]!, lastMon + 600, 3, 4),
    pass('d', 'dee', LB_COURSES[0]!, lastMon + 100), pass('e', 'eve', LB_COURSES[0]!, lastMon + 9999),
    // a duplicate row for the same course must not count twice
    pass('d', 'dee', LB_COURSES[0]!, lastMon + 200),
    // w1Boss is not on the path
    pass('d', 'dee', 'w1Boss', lastMon + 300),
    // this week
    pass('e', 'eve', LB_COURSES[1]!, mon + 5000),
    // finished everything: zed
    ...LB_COURSES.map((c, i) => pass('z', 'zed', c, lastMon - 86_400_000 * 20 + i * 1000)),
  ],
  player_grants: [],
  public_profiles: [{ username: 'ann', name: 'Ann Star' }, { username: 'bob', name: 'Bob' }, { username: 'zed', name: 'Zed' }],
}
const db = { from: (t: string) => {
  const f: Array<[string, unknown]> = []; let inList: [string, unknown[]] | null = null; let lo = 0, hi = 1e9; let upsertRow: Row | null = null
  const run = () => {
    const rows = tables[t] ?? []
    if (upsertRow) {
      const dupe = rows.some((r) => r.privy_user_id === upsertRow!.privy_user_id && r.grant_id === upsertRow!.grant_id)
      if (!dupe) rows.push(upsertRow)
      return { data: dupe ? [] : [upsertRow], error: null }
    }
    return { data: rows.filter((r) => f.every(([k, v]) => r[k] === v) && (!inList || inList[1].includes(r[inList[0]]))).slice(lo, hi + 1), error: null }
  }
  const b: Record<string, unknown> = {
    select: () => b, eq: (k: string, v: unknown) => { f.push([k, v]); return b }, in: (k: string, v: unknown[]) => { inList = [k, v]; return b },
    order: () => b, range: (a: number, z: number) => { lo = a; hi = z; return b }, upsert: (row: Row) => { upsertRow = row; return b },
    then: (ok: (v: unknown) => void) => ok(run()),
  }
  return b
} } as never
let fails = 0
const expect = (name: string, c: boolean) => { if (!c) { fails++; console.error('FAIL - ' + name) } }

expect('weeks start on Monday 00:00 WAT', weekStart(wed) === mon && weekStart(mon) === mon && weekStart(mon - 1) === lastMon)
expect('week key is the Monday date', weekKey(mon) === 'lb:2026-12-07')
expect('first paid week is Mon 30 Nov 2026', FIRST_PAID_WEEK === Date.UTC(2026, 10, 30) - 3600_000)
const all = rank(((tables.cert_passes as Row[]).map((r) => ({ uid: String(r.privy_user_id), username: String(r.username), course: String(r.course_id), score: r.score as number, of: r.of_total as number, at: Date.parse(String(r.passed_at)) }))))
expect('finished-everything player ranks first', all[0]!.username === 'zed' && all[0]!.passed === LB_COURSES.length)
expect('duplicates and w1Boss are not counted', all.find((r) => r.username === 'dee')!.passed === 1)
expect('more lessons beats fewer', all.findIndex((r) => r.username === 'ann') < all.findIndex((r) => r.username === 'bob'))
expect('better scores break a tie', all.findIndex((r) => r.username === 'bob') < all.findIndex((r) => r.username === 'cy'))

const board = (await buildBoard(db, 'b', wed))!
expect('board builds', !!board)
expect('last week top 3 are ann, bob, cy', board.lastWeek.map((r) => r.name).join() === 'Ann Star,Bob,cy')
expect('names fall back to the game ID, never anything else', board.lastWeek[2]!.name === 'cy')
expect('no ids, emails or wallets in the answer', !/privy|did:|@|0x/.test(JSON.stringify(board)))
expect('finished list has zed only', board.finished.length === 1 && board.finished[0]!.name === 'Zed')
expect('this week lists only this week', board.week.length === 1 && board.week[0]!.name === 'eve' && board.week[0]!.gained === 1)
expect('bob (2nd last week) is paid the 2nd reward, fresh', board.reward?.rank === 2 && board.reward.amount === LB_REWARDS[1] && board.reward.fresh === true)
const again = (await buildBoard(db, 'b', wed))!
expect('second ask pays nothing more (idempotent)', again.reward?.fresh === false && (tables.player_grants as Row[]).length === 1)
const nope = (await buildBoard(db, 'e', wed))!
expect('a player outside the top 3 gets no reward row', nope.reward === null && (tables.player_grants as Row[]).length === 1)
const pre = (await buildBoard(db, 'a', FIRST_PAID_WEEK + 3 * 86_400_000))!
expect('nothing pays before the first paid week has ended', pre.reward === null && pre.lastWeek.length === 0)
expect('me is flagged on my own rows only', board.finished.filter((r) => r.me).length === 0 && board.climbing.filter((r) => r.me).length === 1 && board.climbing.find((r) => r.me)!.name === 'Bob' && board.lastWeek.filter((r) => r.me).length === 1 && board.week.filter((r) => r.me).length === 0)
if (fails) { console.error(`${fails} leaderboard check(s) failed`); process.exit(1) }
console.log('ok - leaderboard: server-graded ranks, weekly top 3 paid once, names only')
process.exit(0)
