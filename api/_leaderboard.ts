// Lessons leaderboard. Ranks come only from `cert_passes` (written by the server when it grades the certificate
// exam), so a player cannot fake a place. Underscore = not a Vercel function (served by api/profile.ts op=lb).
// Weekly in-game cash for the top 3 is granted once per player and week through `player_grants` (idempotent).
import type { SupabaseClient } from '@supabase/supabase-js'
import { CERT_COURSES } from './_certCourses.js'

const WAT = 3600_000
const DAY = 86_400_000
export const WEEK_MS = 7 * DAY
/** In-game cash (practice dollars) for 1st, 2nd, 3rd. Never real money or tokens. */
export const LB_REWARDS = [5000, 3000, 2000] as const
/** Weeks start Monday 00:00 WAT. The first week that pays is the one starting Mon 30 Nov 2026. */
export const FIRST_PAID_WEEK = Date.UTC(2026, 10, 30) - WAT
/** Lessons on the path (the old World 1 sorting practice is not on it). */
export const LB_COURSES = Object.keys(CERT_COURSES).filter((c) => c !== 'w1Boss')

export function weekStart(now: number): number {
  const d = new Date(now + WAT)
  const dow = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dow * DAY - WAT
}
/** Grant id for a week: `lb:` plus the Monday's date (fits the 40 character limit). */
export const weekKey = (start: number): string => `lb:${new Date(start + WAT).toISOString().slice(0, 10)}`

export type Pass = { uid: string; username: string; course: string; score: number | null; of: number | null; at: number }
export type Row = { uid: string; username: string; passed: number; pct: number; last: number }

/** Most lessons first, then the best exam scores, then whoever got there earlier. Deterministic. */
export function rank(passes: Pass[], from = 0, to = Infinity): Row[] {
  const by = new Map<string, { username: string; courses: Set<string>; frac: number; last: number }>()
  for (const p of passes) {
    if (p.at < from || p.at >= to || !LB_COURSES.includes(p.course)) continue
    const e = by.get(p.uid) ?? { username: p.username, courses: new Set<string>(), frac: 0, last: 0 }
    if (e.courses.has(p.course)) continue
    e.courses.add(p.course)
    e.frac += p.score != null && p.of ? Math.min(1, p.score / p.of) : 1
    e.last = Math.max(e.last, p.at)
    by.set(p.uid, e)
  }
  return [...by].map(([uid, e]) => ({ uid, username: e.username, passed: e.courses.size, pct: e.frac / e.courses.size, last: e.last }))
    .sort((a, b) => b.passed - a.passed || b.pct - a.pct || a.last - b.last || (a.uid < b.uid ? -1 : 1))
}

export async function loadPasses(db: SupabaseClient): Promise<Pass[] | null> {
  const out: Pass[] = []
  for (let from = 0; from < 20_000; from += 1000) {
    const r = await db.from('cert_passes').select('privy_user_id,username,course_id,score,of_total,passed_at').order('passed_at', { ascending: true }).range(from, from + 999)
    if (r.error) return null
    for (const x of (r.data ?? []) as Array<{ privy_user_id: string; username: string; course_id: string; score: number | null; of_total: number | null; passed_at: string }>) {
      out.push({ uid: x.privy_user_id, username: x.username, course: x.course_id, score: x.score, of: x.of_total, at: Date.parse(x.passed_at) })
    }
    if ((r.data?.length ?? 0) < 1000) break
  }
  return out
}

export type Entry = { rank: number; name: string; passed: number; me?: boolean }
export type Board = {
  total: number
  weekStart: number
  weekEnd: number
  rewards: readonly number[]
  firstPayout: number
  finished: Entry[]
  climbing: Entry[]
  me: { rank: number; passed: number; finished: boolean } | null
  week: Array<{ rank: number; name: string; gained: number; me?: boolean }>
  lastWeek: Array<{ rank: number; name: string; gained: number; me?: boolean }>
  /** Set when the caller won last week: the grant is recorded here, once. fresh = first time (credit it now). */
  reward: { rank: number; amount: number; fresh: boolean; period: string } | null
}

/** Build the board for a caller. Display names are the in-game public names only: no email, wallet or real name. */
export async function buildBoard(db: SupabaseClient, callerId: string, now = Date.now()): Promise<Board | null> {
  const passes = await loadPasses(db)
  if (!passes) return null
  const total = LB_COURSES.length
  const all = rank(passes)
  const ws = weekStart(now), lastStart = ws - WEEK_MS
  const wk = rank(passes, ws, ws + WEEK_MS), last = lastStart >= FIRST_PAID_WEEK ? rank(passes, lastStart, ws).slice(0, 3) : []
  const gainedOf = (rows: Row[]) => rows.slice(0, 3)
  const shown = new Set<string>()
  const finishedRows = all.filter((r) => r.passed >= total).slice(0, 15)
  const climbRows = all.filter((r) => r.passed < total).slice(0, 15)
  for (const r of [...finishedRows, ...climbRows, ...gainedOf(wk), ...last]) shown.add(r.username)
  const names = new Map<string, string>()
  if (shown.size) {
    const pp = await db.from('public_profiles').select('username,name').in('username', [...shown])
    for (const r of (pp.data ?? []) as Array<{ username: string; name: string | null }>) names.set(r.username, String(r.name ?? '').trim().slice(0, 24))
  }
  const nm = (r: Row) => names.get(r.username) || r.username
  const idx = all.findIndex((r) => r.uid === callerId)
  const mine = idx >= 0 ? all[idx]! : null
  const place = (r: Row) => (r.passed >= total ? all.filter((x) => x.passed >= total) : all.filter((x) => x.passed < total)).indexOf(r) + 1
  const entry = (r: Row): Entry => ({ rank: place(r), name: nm(r), passed: r.passed, ...(r.uid === callerId ? { me: true } : {}) })
  const wrow = (r: Row, i: number) => ({ rank: i + 1, name: nm(r), gained: r.passed, ...(r.uid === callerId ? { me: true } : {}) })
  let reward: Board['reward'] = null
  const won = last.findIndex((r) => r.uid === callerId)
  if (won >= 0) {
    const period = weekKey(lastStart), amount = LB_REWARDS[won]!
    const ins = await db.from('player_grants').upsert({ privy_user_id: callerId, grant_id: period, amount }, { onConflict: 'privy_user_id,grant_id', ignoreDuplicates: true }).select('grant_id')
    if (!ins.error) reward = { rank: won + 1, amount, fresh: (ins.data ?? []).length === 1, period }
  }
  return {
    total, weekStart: ws, weekEnd: ws + WEEK_MS, rewards: LB_REWARDS, firstPayout: FIRST_PAID_WEEK + WEEK_MS,
    finished: finishedRows.map(entry), climbing: climbRows.map(entry),
    me: mine ? { rank: place(mine), passed: mine.passed, finished: mine.passed >= total } : null,
    week: wk.slice(0, 3).map(wrow), lastWeek: last.map(wrow), reward,
  }
}
