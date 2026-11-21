// Public profile fields come from server records, not the request (no network, in-memory tables).
const { publicFields, capReputation, rankFrom, REP_START, REP_PER_DAY } = await import('../api/_publicFields.ts')
const { CERT_CV } = await import('../api/_certCourses.ts')
const { SKILL_ORDER, SKILL_META } = await import('../src/logic.ts')
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = {
  player_grants: [{ privy_user_id: 'u1', grant_id: 'starter', amount: 1000 }, { privy_user_id: 'u1', grant_id: 'start:crab', amount: 500 }, { privy_user_id: 'u2', grant_id: 'starter', amount: 1000 }],
  cert_passes: [{ privy_user_id: 'u1', course_id: 'spot' }],
  topups: [{ privy_user_id: 'u1', status: 'credited', credit_micro: 25_000_000 }, { privy_user_id: 'u1', status: 'pending', credit_micro: 99_000_000 }],
  near_topups: [], rail_topups: [{ privy_user_id: 'u1', status: 'credited', credit_micro: 4_500_000 }],
}
const db = { from: (t: string) => { const f: Array<[string, unknown]> = []; const b = { select: () => b, eq: (k: string, v: unknown) => { f.push([k, v]); return b }, then: (ok: (v: unknown) => void) => ok({ data: (tables[t] ?? []).filter((r) => f.every(([k, v]) => r[k] === v)), error: null }) }; return b } } as never
let fails = 0
const expect = (name: string, c: boolean) => { if (!c) { fails++; console.error('FAIL - ' + name) } }
expect('CV lines mirror SKILL_META (rerun scripts/gen-cert-courses.ts)', SKILL_ORDER.every((id) => CERT_CV[id] === SKILL_META[id].cv))
const forged = { rank: 'Whale', balance: 99_999_999, reputation: 900_000, skills: Object.values(CERT_CV) }
const u1 = (await publicFields(db, 'u1', forged, { reputation: 40, updated_at: new Date(Date.now() - 3_600_000).toISOString() }))!
expect('rank capped at the grant ladder (Crab)', u1.rank === 'Crab')
expect('skills only for server exam passes', JSON.stringify(u1.skills) === JSON.stringify([CERT_CV.spot]))
expect('balance = grants + credited top-ups only', u1.balance === 1529.5)
expect('reputation growth is bounded', u1.reputation <= 40 + REP_PER_DAY && u1.reputation > 40)
const u2 = (await publicFields(db, 'u2', { rank: 'Shrimp', balance: 5, reputation: 12 }, null))!
expect('honest new player keeps their numbers', u2.rank === 'Shrimp' && u2.reputation === 12 && u2.balance === 1000 && u2.skills.length === 0)
expect('lower claimed rank is kept', rankFrom('Shrimp', ['starter', 'start:crab', 'start:fish']) === 'Shrimp')
expect('unknown rank label -> Shrimp', rankFrom('Galaxy', ['start:whale']) === 'Shrimp')
expect('first profile reputation capped', capReputation(5000, null) === REP_START)
expect('reputation may go down', capReputation(3, { reputation: 50, updated_at: new Date().toISOString() }) === 3)
if (fails) { console.error(`${fails} public field check(s) failed`); process.exit(1) }
console.log('ok - public profile fields: server-derived rank, skills, balance; bounded reputation')
process.exit(0)
