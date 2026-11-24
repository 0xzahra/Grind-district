// Stablecoin staking (Trade > Stake): USDC and USDT beside the proof-of-stake coins. Your in-game dollars are the
// stablecoin here. Earned in-game cash only (never a top-up, as on the DeFi desk and Perps). Like Perps, the stakes
// are a device-side list beside the save (the save format is untouched), and cash only moves through the save's own
// spend and earn functions. Same clock and plans as coin staking: one real hour is one game day.
import { money } from './logic.ts'
import { balanceSplit, earnCash, slotKey, spendInGame } from './state.ts'
import { STAKE_DAY_MS, STAKE_PLANS, MAX_STAKES, type StakePlan } from './staking.ts'

export type StableId = 'usdc' | 'usdt'
export type StableStake = { id: string; coin: StableId; qty: number; plan: StakePlan; apr: number; at: number }
/** Round estimates of what platforms pay to lend these out (savings / earn products), in % a year. */
export const STABLE_APR: Record<StableId, number> = { usdc: 4.5, usdt: 4 }
export const STABLES: Array<{ id: StableId; sym: string; name: string }> = [{ id: 'usdc', sym: 'USDC', name: 'USD Coin' }, { id: 'usdt', sym: 'USDT', name: 'Tether' }]
const key = () => `gd.stable.v1:${slotKey()}`

export const stableApr = (coin: StableId, plan: StakePlan): number => Math.round(STABLE_APR[coin] * STAKE_PLANS[plan].mult * 100) / 100
const lockEnd = (s: StableStake) => s.at + STAKE_PLANS[s.plan].days * STAKE_DAY_MS
export const stableLocked = (s: StableStake, now = Date.now()): boolean => s.plan !== 'flex' && now < lockEnd(s)
/** Dollars earned so far (simple interest; a locked plan stops earning at the end of its lock). */
export function stableAccrued(s: StableStake, now = Date.now()): number {
  const days = Math.max(0, now - s.at) / STAKE_DAY_MS, cap = STAKE_PLANS[s.plan].days
  return (s.qty * s.apr / 100) * (cap > 0 ? Math.min(days, cap) : days) / 365
}

export function stableStakes(): StableStake[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key()) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter((s): s is StableStake => !!s && typeof s === 'object' && typeof (s as StableStake).id === 'string' && ((s as StableStake).coin === 'usdc' || (s as StableStake).coin === 'usdt')
      && (s as StableStake).qty > 0 && (s as StableStake).qty < 1e9 && (s as StableStake).plan in STAKE_PLANS && (s as StableStake).apr >= 0 && (s as StableStake).apr <= 20).slice(0, MAX_STAKES)
  } catch { return [] }
}
const store = (list: StableStake[]): boolean => { try { localStorage.setItem(key(), JSON.stringify(list)); return true } catch { return false } }

/** Stake a share of your earned in-game cash as a stablecoin. */
export function stakeStable(coin: StableId, fraction: number, plan: StakePlan): { ok: boolean; message: string } {
  const list = stableStakes()
  if (list.length >= MAX_STAKES) return { ok: false, message: `Up to ${MAX_STAKES} stablecoin stakes at once. Claim one first.` }
  const qty = Math.floor(balanceSplit().earned * Math.min(1, Math.max(0, fraction)) * 100) / 100
  if (qty < 1) return { ok: false, message: 'You need at least $1 of earned in-game cash (top-ups cannot be staked).' }
  const s: StableStake = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, coin, qty, plan, apr: stableApr(coin, plan), at: Date.now() }
  // Record the stake before the cash leaves the balance: if it cannot be kept, nothing is spent.
  if (!store([...list, s])) return { ok: false, message: 'This device would not save the stake, so nothing was staked.' }
  const sym = coin.toUpperCase()
  const paid = spendInGame(qty, `Staked ${sym}`, `${money(qty)} on ${STAKE_PLANS[plan].label} at ~${s.apr}% a year (practice).`)
  if (!paid.ok) { store(list); return paid }
  return { ok: true, message: `Staked ${money(qty)} of ${sym} · ${STAKE_PLANS[plan].label} · est. ${s.apr}% a year.` }
}

/** End a stablecoin stake: the dollars and the reward come back; leaving a lock early forfeits the reward. */
export function unstakeStable(id: string): { ok: boolean; message: string } {
  const list = stableStakes(), s = list.find((x) => x.id === id)
  if (!s) return { ok: false, message: 'That stake is already closed.' }
  const early = stableLocked(s), reward = early ? 0 : Math.floor(stableAccrued(s) * 100) / 100
  // Take it off the list first, so it can never pay out twice.
  if (!store(list.filter((x) => x.id !== id))) return { ok: false, message: 'This device would not save the change. Try again.' }
  const sym = s.coin.toUpperCase()
  earnCash(s.qty + reward, `Unstaked ${sym}`, `${money(s.qty)} back${reward ? `, reward ${money(reward)}` : early ? ', reward forfeited (left the lock early)' : ''} (practice).`)
  return { ok: true, message: `Unstaked ${money(s.qty)} of ${sym}.${early ? ' Left the lock early, so the reward was forfeited.' : ` Reward: +${money(reward)}.`}` }
}
