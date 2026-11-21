// Public profile fields that read as achievements or money are built here from server records, not taken
// from the request. Underscore = not a Vercel function.
//  - skills: the CV line of each course with a server-graded exam pass (cert_passes).
//  - rank: the player's ladder rank, capped at the highest starting-balance grant recorded (player_grants).
//  - balance: in-game $ the server itself credited (grants plus credited top-ups).
//  - reputation: the game's figure, allowed to grow only at a bounded pace from the last stored value.
import type { SupabaseClient } from '@supabase/supabase-js'
import { CERT_CV, CERT_RANKS } from './_certCourses.js'

const LADDER: Record<string, number> = { starter: 0, signup: 0, 'start:shrimp': 0, 'start:crab': 1, 'start:fish': 2, 'start:dolphin': 3, 'start:shark': 4, 'start:whale': 5 }
export const REP_START = 100
export const REP_PER_DAY = 200
export const REP_MAX = 1_000_000

type Prev = { reputation?: number | null; updated_at?: string | null } | null
export type PublicFields = { rank: string; skills: string[]; balance: number; reputation: number }

export function capReputation(claimed: unknown, prev: Prev, now = Date.now()): number {
  const want = Math.max(0, Math.min(REP_MAX, Math.round(Number(claimed) || 0)))
  if (!prev || prev.reputation == null) return Math.min(want, REP_START)
  const was = Math.max(0, Number(prev.reputation) || 0)
  const since = Math.max(0, now - (Date.parse(String(prev.updated_at ?? '')) || now))
  const room = Math.ceil(REP_PER_DAY * Math.min(30, Math.max(1 / 24, since / 86_400_000)))
  return Math.min(want, was + room)
}

export function rankFrom(claimed: unknown, grantIds: string[]): string {
  const top = grantIds.reduce((m, g) => Math.max(m, LADDER[g] ?? -1), 0)
  const said = CERT_RANKS.indexOf(String(claimed ?? ''))
  return CERT_RANKS[Math.max(0, Math.min(said < 0 ? 0 : said, top))]!
}

const micro = (rows: Array<{ credit_micro?: unknown }> | null | undefined) => (rows ?? []).reduce((s, r) => s + (Number(r.credit_micro) || 0), 0)

/** null when the records cannot be read (the caller answers 503 rather than publishing guesses). */
export async function publicFields(db: SupabaseClient, userId: string, body: Record<string, unknown>, prev: Prev, now = Date.now()): Promise<PublicFields | null> {
  const [grants, passes, base, near, rails] = await Promise.all([
    db.from('player_grants').select('grant_id,amount').eq('privy_user_id', userId),
    db.from('cert_passes').select('course_id').eq('privy_user_id', userId),
    db.from('topups').select('credit_micro').eq('privy_user_id', userId).eq('status', 'credited'),
    db.from('near_topups').select('credit_micro').eq('privy_user_id', userId).eq('status', 'credited'),
    db.from('rail_topups').select('credit_micro').eq('privy_user_id', userId).eq('status', 'credited'),
  ])
  if (grants.error || passes.error) return null
  const g = (grants.data ?? []) as Array<{ grant_id: string; amount: unknown }>
  const passed = new Set(((passes.data ?? []) as Array<{ course_id: string }>).map((r) => r.course_id))
  const granted = g.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  // Top-up tables that are missing or unreadable count as nothing credited.
  const topups = (micro(base.data as never) + micro(near.data as never) + micro(rails.data as never)) / 1e6
  return {
    rank: rankFrom(body.rank, g.map((r) => r.grant_id)),
    skills: Object.keys(CERT_CV).filter((c) => passed.has(c)).map((c) => CERT_CV[c]!).slice(0, 12),
    balance: Math.round(Math.min(1e11, granted + topups) * 100) / 100,
    reputation: capReputation(body.reputation, prev, now),
  }
}
