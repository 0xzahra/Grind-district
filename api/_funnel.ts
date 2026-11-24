// Where do new players leave, and who comes back? Counts only: no names, emails, wallets or ids leave this file.
// GET /api/track?op=funnel (public page: /stats.html). Built from the events table:
//  - first-session journey: `step` and `session_length` events from journey.ts (first session of a browser only),
//  - retention: every visit event (first_visit, opened_page, session_start) by the random visitor id,
//  - learning: first course started / passed,
//  - proof: certificates and CVs shared, and their public pages opened,
//  - top-ups: credited payments (counts and totals) and whether those players came back on a later day.
// If STATS_KEY is set on the server, the page must pass ?key=<STATS_KEY>; otherwise it is open like the city stats.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const DAY = 86_400_000
const dayOf = (ms: number) => Math.floor((ms + 3_600_000) / DAY) // Lagos (WAT) days, like the city stats
const ORDER = ['opened', 'enter_city', 'learn_open', 'lesson_start', 'exercise_start', 'lesson_complete', 'cv_seen'] as const
type Stage = (typeof ORDER)[number]
const LABEL: Record<Stage | 'menu_open' | 'lesson_leave', string> = {
  opened: 'Opened the game (title screen)',
  enter_city: 'Entered the city',
  menu_open: 'Opened the menu',
  learn_open: 'Opened Campus (Learning Center)',
  lesson_start: 'Started the first lesson',
  exercise_start: 'Reached the quick check',
  lesson_complete: 'Passed the first lesson',
  cv_seen: 'Saw their CV / certificate',
  lesson_leave: 'Left a lesson unfinished',
}

export type FunnelStep = { id: string; label: string; reached: number; pct: number; leftHere: number; medianSecs: number | null }
export type Cohort = { week: string; size: number; d1: number | null; d7: number | null; d30: number | null; learned: number }
export type FunnelOut = {
  generatedAt: string
  windowDays: number
  trackingSince: string | null
  firstSessions: number
  steps: FunnelStep[]
  menuOpened: number
  lessonLeaves: Array<{ course: string; card: number; where: string; count: number }>
  biggestDrop: { from: string; to: string; lost: number; pct: number } | null
  mostLeftAt: { step: string; label: string; count: number } | null
  medianFirstSessionSecs: number | null
  retention: { visitors: number; d1: number | null; d7: number | null; d30: number | null; signedUp: { players: number; d1: number | null; d7: number | null; d30: number | null } }
  cohorts: Cohort[]
  proof: { certShares: number; cvShares: number; pageViews: number; certViews: number; cvViews: number; mints: number }
  topups: { payments: number; payers: number; usd: number; payersBack: number | null; attempts: number }
}

type Row = { name: string; anon_id: string; session_id: string; props: Record<string, unknown> | null; created_at: string }

async function pageAll(db: SupabaseClient, names: string[], since: string, cols = 'name, anon_id, session_id, props, created_at', max = 80): Promise<Row[]> {
  const out: Row[] = []
  for (let page = 0; page < max; page++) {
    const r = await db.from('events').select(cols).in('name', names).gte('created_at', since)
      .order('id', { ascending: true }).range(page * 1000, page * 1000 + 999)
    if (r.error) { if (page === 0) throw r.error; break }
    const rows = (r.data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)
const rate = (n: number, d: number): number | null => (d > 0 ? pct(n, d) : null)

/** Monday (Lagos) of the week a day falls in, as YYYY-MM-DD. */
function weekOf(day: number): string {
  const ms = day * DAY
  const dow = (new Date(ms).getUTCDay() + 6) % 7
  return new Date(ms - dow * DAY).toISOString().slice(0, 10)
}

let cache: { at: number; key: number; value: FunnelOut } | null = null

export async function collectFunnel(windowDays = 14): Promise<FunnelOut | { error: string; status: number }> {
  const days = Math.max(1, Math.min(90, Math.round(windowDays) || 14))
  if (cache && cache.key === days && Date.now() - cache.at < 5 * 60_000) return cache.value
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'not configured', status: 503 }
  const value = await buildFunnel(createClient(url, key, { auth: { persistSession: false } }), days, Date.now())
  cache = { at: Date.now(), key: days, value }
  return value
}

/** The summary itself, from any client (tests pass a small fake). */
export async function buildFunnel(db: SupabaseClient, days: number, now: number): Promise<FunnelOut> {
  const windowStart = new Date(now - days * DAY).toISOString()

  // --- First-session journey (window) ---
  const journey = await pageAll(db, ['step', 'session_length', 'first_visit', 'opened_page'], windowStart)
  const stepRows = journey.filter((r) => r.name === 'step')
  const trackingSince = stepRows.length ? stepRows[0].created_at : null
  type S = { reached: Set<string>; last: string | null; lastAt: number; secs: number; leaves: Array<{ course: string; card: number; where: string }> }
  const sessions = new Map<string, S>()
  const get = (id: string) => { let s = sessions.get(id); if (!s) { s = { reached: new Set(['opened']), last: null, lastAt: 0, secs: 0, leaves: [] }; sessions.set(id, s) } return s }
  const timeOn = new Map<string, number[]>()
  let menuOpened = 0
  for (const r of journey) {
    if (!r.session_id) continue
    const p = (r.props ?? {}) as Record<string, unknown>
    const at = Date.parse(r.created_at)
    if (r.name === 'first_visit') { if (trackingSince && r.created_at >= trackingSince) get(r.session_id); continue }
    if (r.name === 'opened_page') continue
    if (r.name === 'session_length') {
      if (p.first !== true) continue
      const s = get(r.session_id)
      s.secs = Math.max(s.secs, Number(p.secs) || 0)
      if (at >= s.lastAt) { s.last = String(p.last ?? ''); s.lastAt = at }
      const ms = Number(p.ms)
      if (Number.isFinite(ms) && ms > 0 && p.last) { const k = String(p.last); (timeOn.get(k) ?? timeOn.set(k, []).get(k)!).push(ms / 1000) }
      continue
    }
    // step
    const s = get(r.session_id)
    const st = String(p.step ?? '')
    if (st === 'menu_open') { if (!s.reached.has('menu_open')) menuOpened += 1 }
    if (st === 'lesson_leave') s.leaves.push({ course: String(p.course ?? ''), card: Number(p.card) || 0, where: String(p.where ?? 'lesson') })
    s.reached.add(st)
    const prev = String(p.prev ?? ''), ms = Number(p.ms)
    if (prev && Number.isFinite(ms) && ms >= 0 && ms < 6 * 3600_000) (timeOn.get(prev) ?? timeOn.set(prev, []).get(prev)!).push(ms / 1000)
  }
  // Only sessions that started after the journey tracking went live (older ones have no steps to read).
  const all = [...sessions.values()]
  const firstSessions = all.length
  const furthest = (s: S): Stage => { let f: Stage = 'opened'; for (const st of ORDER) if (s.reached.has(st)) f = st; return f }
  const leftAt = new Map<string, number>()
  for (const s of all) { const f = furthest(s); leftAt.set(f, (leftAt.get(f) ?? 0) + 1) }
  const steps: FunnelStep[] = ORDER.map((id) => {
    const reached = all.filter((s) => ORDER.indexOf(furthest(s)) >= ORDER.indexOf(id)).length
    const t = median(timeOn.get(id === 'opened' ? 'title' : id) ?? [])
    return { id, label: LABEL[id], reached, pct: pct(reached, firstSessions), leftHere: leftAt.get(id) ?? 0, medianSecs: t == null ? null : Math.round(t) }
  })
  let biggestDrop: FunnelOut['biggestDrop'] = null
  for (let i = 1; i < steps.length; i++) {
    const lost = steps[i - 1].reached - steps[i].reached
    if (lost > 0 && (!biggestDrop || lost > biggestDrop.lost)) biggestDrop = { from: steps[i - 1].label, to: steps[i].label, lost, pct: pct(lost, steps[i - 1].reached) }
  }
  let mostLeftAt: FunnelOut['mostLeftAt'] = null
  for (const st of steps) if (st.id !== 'cv_seen' && st.leftHere > 0 && (!mostLeftAt || st.leftHere > mostLeftAt.count)) mostLeftAt = { step: st.id, label: st.label, count: st.leftHere }
  const leaveCount = new Map<string, number>()
  for (const s of all) for (const l of s.leaves) { const k = `${l.course}|${l.card}|${l.where}`; leaveCount.set(k, (leaveCount.get(k) ?? 0) + 1) }
  const lessonLeaves = [...leaveCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, count]) => { const [course, card, where] = k.split('|'); return { course, card: Number(card), where, count } })
  const lengths = all.map((s) => s.secs).filter((x) => x > 0)
  const mfs = median(lengths)

  // --- Retention (all time since tracking began): visit days per visitor ---
  const visits = await pageAll(db, ['first_visit', 'opened_page', 'session_start', 'sign_in', 'signup', 'account_created', 'first_lesson', 'course_complete'], '2026-10-01T00:00:00Z', 'name, anon_id, created_at', 120)
  const daysBy = new Map<string, Set<number>>()
  const signed = new Set<string>(), learned = new Set<string>()
  for (const r of visits) {
    const a = r.anon_id
    if (!a || a === 'unknown') continue
    const d = dayOf(Date.parse(r.created_at))
    if (r.name === 'sign_in' || r.name === 'signup' || r.name === 'account_created') signed.add(a)
    if (r.name === 'first_lesson' || r.name === 'course_complete') learned.add(a)
    let set = daysBy.get(a); if (!set) { set = new Set(); daysBy.set(a, set) }
    set.add(d)
  }
  const today = dayOf(now)
  type Acc = { n1: number; d1: number; n7: number; d7: number; n30: number; d30: number }
  const blank = (): Acc => ({ n1: 0, d1: 0, n7: 0, d7: 0, n30: 0, d30: 0 })
  const total = blank(), signedAcc = blank()
  const weeks = new Map<string, Acc & { size: number; learned: number }>()
  const add = (acc: Acc, first: number, set: Set<number>) => {
    const back = (n: number) => [...set].some((d) => d >= first + n)
    if (today - first >= 1) { acc.n1 += 1; if (set.has(first + 1)) acc.d1 += 1 }
    if (today - first >= 7) { acc.n7 += 1; if (back(7)) acc.d7 += 1 }
    if (today - first >= 30) { acc.n30 += 1; if (back(30)) acc.d30 += 1 }
  }
  for (const [a, set] of daysBy) {
    const first = Math.min(...set)
    add(total, first, set)
    if (signed.has(a)) add(signedAcc, first, set)
    const w = weekOf(first)
    let acc = weeks.get(w); if (!acc) { acc = { ...blank(), size: 0, learned: 0 }; weeks.set(w, acc) }
    acc.size += 1
    if (learned.has(a)) acc.learned += 1
    add(acc, first, set)
  }
  const cohorts: Cohort[] = [...weeks.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 10).map(([week, c]) => ({
    week, size: c.size, d1: rate(c.d1, c.n1), d7: rate(c.d7, c.n7), d30: rate(c.d30, c.n30), learned: pct(c.learned, c.size),
  }))

  // --- Proof: shares, public page views, mints (window) ---
  const proofRows = await pageAll(db, ['cert_shared', 'cv_shared', 'cert_viewed', 'cert_minted', 'topup_attempt'], windowStart, 'name, anon_id, session_id, props, created_at', 20)
  const nOf = (n: string) => proofRows.filter((r) => r.name === n).length
  const views = proofRows.filter((r) => r.name === 'cert_viewed')
  const proof = {
    certShares: nOf('cert_shared'), cvShares: nOf('cv_shared'), pageViews: views.length,
    certViews: views.filter((r) => (r.props as { page?: string } | null)?.page === 'cert').length,
    cvViews: views.filter((r) => (r.props as { page?: string } | null)?.page === 'cv').length,
    mints: nOf('cert_minted'),
  }

  // --- Top-ups (all time): credited payments across the payment rails, and whether payers came back later ---
  const paid: Array<{ user: string; usd: number; at: number }> = []
  for (const t of ['topups', 'near_topups', 'rail_topups']) {
    const r = await db.from(t).select('privy_user_id, usd_micro, credited_at, created_at, status').limit(5000)
    if (r.error) continue
    for (const row of (r.data ?? []) as Array<{ privy_user_id?: string | null; usd_micro?: number | string; credited_at?: string | null; created_at?: string; status?: string }>) {
      if (row.status && row.status !== 'credited') continue
      paid.push({ user: String(row.privy_user_id ?? ''), usd: Number(row.usd_micro ?? 0) / 1e6, at: Date.parse(String(row.credited_at ?? row.created_at ?? '')) })
    }
  }
  const payers = new Set(paid.map((p) => p.user).filter(Boolean))
  let payersBack: number | null = null
  if (payers.size) {
    const r = await db.from('player_progress').select('privy_user_id, updated_at').in('privy_user_id', [...payers].slice(0, 500))
    if (!r.error) {
      const lastPay = new Map<string, number>()
      for (const p of paid) if (p.user) lastPay.set(p.user, Math.max(lastPay.get(p.user) ?? 0, p.at))
      payersBack = ((r.data ?? []) as Array<{ privy_user_id: string; updated_at: string }>)
        .filter((row) => dayOf(Date.parse(row.updated_at)) > dayOf(lastPay.get(row.privy_user_id) ?? Infinity)).length
    }
  }
  const topups = { payments: paid.length, payers: payers.size, usd: Math.round(paid.reduce((a, p) => a + p.usd, 0) * 100) / 100, payersBack, attempts: nOf('topup_attempt') }

  const value: FunnelOut = {
    generatedAt: new Date(now).toISOString(),
    windowDays: days,
    trackingSince,
    firstSessions,
    steps,
    menuOpened,
    lessonLeaves,
    biggestDrop,
    mostLeftAt,
    medianFirstSessionSecs: mfs == null ? null : Math.round(mfs),
    retention: {
      visitors: daysBy.size,
      d1: rate(total.d1, total.n1), d7: rate(total.d7, total.n7), d30: rate(total.d30, total.n30),
      signedUp: { players: [...daysBy.keys()].filter((a) => signed.has(a)).length, d1: rate(signedAcc.d1, signedAcc.n1), d7: rate(signedAcc.d7, signedAcc.n7), d30: rate(signedAcc.d30, signedAcc.n30) },
    },
    cohorts,
    proof,
    topups,
  }
  return value
}

/** The optional STATS_KEY gate. */
export function funnelAllowed(given: string | undefined): boolean {
  const want = (process.env.STATS_KEY ?? '').trim()
  return !want || given === want
}
