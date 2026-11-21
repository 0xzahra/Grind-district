// Practice staking (Trade > Stake). Lock a coin you hold for a while and earn more of it, at an estimated yearly
// rate. In-game only: no wallet, no chain, nothing withdrawable, no new token. Stakes live in the save as one
// optional field (`stakes`): an old save simply has none, and nothing else in the save changes.
//
// The clock is the city's game speed (the same as the DeFi desk): one real hour is one game day, so a 7-day
// lock opens after 7 real hours. Rewards are simple interest on the coins staked, paid in the same coin.
// Locked plans earn only up to the end of the lock; leaving a locked plan early returns the coins and forfeits
// the rewards. Flexible earns a lower rate and can be left at any time with its rewards.
import type { Holding } from './logic.ts'

export type StakePlan = 'flex' | 'd7' | 'd30'
export type Stake = { id: string; coin: string; qty: number; avg: number; plan: StakePlan; apr: number; at: number }

/** One game day in real milliseconds (game speed 24: a real hour is a game day). */
export const STAKE_DAY_MS = 3_600_000
export const MAX_STAKES = 6
/** Minimum stake, in in-game dollars at the current price. */
export const MIN_STAKE_USD = 1
/** Proof-of-stake coins of the city's market and a round estimate of their yearly staking rate, in %. */
export const STAKE_APR: Record<string, number> = { eth: 3, sol: 7, near: 9, sui: 3, avax: 7, dot: 12 }
export const STAKE_PLANS: Record<StakePlan, { label: string; days: number; mult: number }> = {
  flex: { label: 'Flexible', days: 0, mult: 0.5 },
  d7: { label: '7 days', days: 7, mult: 1 },
  d30: { label: '30 days', days: 30, mult: 1.3 },
}
const PLAN_IDS = Object.keys(STAKE_PLANS) as StakePlan[]

export const canStake = (coin: string): boolean => coin in STAKE_APR
/** Estimated yearly rate for a coin on a plan, in %. */
export const planApr = (coin: string, plan: StakePlan): number => Math.round((STAKE_APR[coin] ?? 0) * STAKE_PLANS[plan].mult * 100) / 100
export const unlockAt = (s: Stake): number => s.at + STAKE_PLANS[s.plan].days * STAKE_DAY_MS
export const isLocked = (s: Stake, now = Date.now()): boolean => s.plan !== 'flex' && now < unlockAt(s)
/** Game days the stake has earned for (a locked plan stops earning at the end of its lock). */
export function earningDays(s: Stake, now = Date.now()): number {
  const days = Math.max(0, now - s.at) / STAKE_DAY_MS
  const cap = STAKE_PLANS[s.plan].days
  return cap > 0 ? Math.min(days, cap) : days
}
/** Reward earned so far, in coins (simple interest). */
export const accrued = (s: Stake, now = Date.now()): number => (s.qty * s.apr / 100) * earningDays(s, now) / 365

type Wallet = { coins: Record<string, Holding>; stakes?: Stake[] }
type Out = { ok: boolean; message: string }

/** Move `fraction` of a held coin into a new stake. `price` is the coin's current in-game price. */
export function stakeInto(w: Wallet, coin: string, fraction: number, plan: StakePlan, price: number, now = Date.now(), id = `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`): Out & { stake?: Stake } {
  if (!canStake(coin)) return { ok: false, message: 'That coin has no staking here.' }
  if (!PLAN_IDS.includes(plan)) return { ok: false, message: 'Pick a plan.' }
  const list = w.stakes ?? []
  if (list.length >= MAX_STAKES) return { ok: false, message: `Up to ${MAX_STAKES} stakes at once. Claim one first.` }
  const h = w.coins[coin] ?? { qty: 0, avg: 0 }
  const f = Math.min(1, Math.max(0, fraction))
  const qty = f >= 1 ? h.qty : h.qty * f
  if (!(qty > 0)) return { ok: false, message: 'You hold none of that coin. Buy some on Spot first.' }
  if (qty * price < MIN_STAKE_USD) return { ok: false, message: `Stake at least $${MIN_STAKE_USD} worth.` }
  const left = h.qty - qty
  w.coins[coin] = left > 1e-12 ? { qty: left, avg: h.avg } : { qty: 0, avg: 0 }
  const stake: Stake = { id, coin, qty, avg: h.avg, plan, apr: planApr(coin, plan), at: now }
  w.stakes = [...list, stake]
  return { ok: true, message: '', stake }
}

/** End a stake: the coins (and any reward earned) go back to the holding. Early exit from a lock forfeits the reward. */
export function unstakeFrom(w: Wallet, id: string, now = Date.now()): Out & { stake?: Stake; reward: number; forfeited: number } {
  const list = w.stakes ?? []
  const s = list.find((x) => x.id === id)
  if (!s) return { ok: false, message: 'That stake is already closed.', reward: 0, forfeited: 0 }
  const earned = accrued(s, now)
  const early = isLocked(s, now)
  const reward = early ? 0 : earned
  const h = w.coins[s.coin] ?? { qty: 0, avg: 0 }
  const qty = h.qty + s.qty + reward
  // The reward cost nothing, so it lowers the average price paid.
  w.coins[s.coin] = { qty, avg: qty > 0 ? (h.qty * h.avg + s.qty * s.avg) / qty : 0 }
  const rest = list.filter((x) => x.id !== id)
  if (rest.length) w.stakes = rest
  else delete w.stakes
  return { ok: true, message: '', stake: s, reward, forfeited: early ? earned : 0 }
}

const fin = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null)
/** Stakes from a stored save, checked field by field. Anything malformed is dropped. */
export function cleanStakes(raw: unknown, now = Date.now()): Stake[] {
  if (!Array.isArray(raw)) return []
  const out: Stake[] = []
  for (const r of raw.slice(0, MAX_STAKES)) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const coin = typeof o.coin === 'string' ? o.coin : '', plan = o.plan as StakePlan
    const qty = fin(o.qty, 0, 1e15), avg = fin(o.avg, 0, 1e9), apr = fin(o.apr, 0, 50), at0 = fin(o.at, 0, 1e15)
    if (!canStake(coin) || !PLAN_IDS.includes(plan) || !qty || avg === null || apr === null || at0 === null) continue
    const at = Math.min(at0, now) // a stake dated ahead (device clock) starts now rather than being lost
    const id = typeof o.id === 'string' && o.id ? o.id.slice(0, 24) : `s${out.length}${Math.round(at).toString(36)}`
    if (out.some((x) => x.id === id)) continue
    out.push({ id, coin, qty, avg, plan, apr: Math.min(apr, planApr(coin, plan)), at })
  }
  return out
}
