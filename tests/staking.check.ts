// Practice staking (src/staking.ts): reward maths, lock rules, holdings in and out, and the save round-trip
// (stakes survive a reload; a save from before staking loads exactly as it did).
import { MAX_STAKES, STAKE_DAY_MS, accrued, cleanStakes, isLocked, planApr, stakeInto, unlockAt, unstakeFrom, type Stake } from '../src/staking.ts'
import { createSave, hydrate } from '../src/logic.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))
const T = 1_800_000_000_000
const day = STAKE_DAY_MS

// Rates: Flexible is half, 30 days is 1.3x, unknown coins earn nothing.
check(planApr('sol', 'd7') === 7 && planApr('sol', 'flex') === 3.5 && planApr('sol', 'd30') === 9.1, 'SOL rates per plan')
check(planApr('btc', 'd7') === 0, 'BTC has no staking')

// Reward maths: simple interest by game day; a lock stops earning at its end.
{
  const s: Stake = { id: 'a', coin: 'sol', qty: 100, avg: 50, plan: 'd7', apr: 7, at: T }
  check(accrued(s, T) === 0, 'nothing at the start')
  check(near(accrued(s, T + 7 * day), 100 * 0.07 * 7 / 365), 'seven game days at 7%')
  check(near(accrued(s, T + 20 * day), accrued(s, T + 7 * day)), 'a 7-day lock stops earning at day 7')
  check(accrued(s, T - day) === 0, 'time before the stake earns nothing')
  check(isLocked(s, T + 6.9 * day) && !isLocked(s, T + 7 * day), 'lock opens after 7 game days')
  check(unlockAt(s) === T + 7 * day, 'unlock time')
  const f: Stake = { ...s, plan: 'flex', apr: 3.5 }
  check(!isLocked(f, T) && near(accrued(f, T + 400 * day), 100 * 0.035 * 400 / 365), 'Flexible never locks and keeps earning')
}

// Staking moves coins out of the holding; unstaking brings them back with the reward.
{
  const w = { coins: { sol: { qty: 10, avg: 60 } } as Record<string, { qty: number; avg: number }>, stakes: undefined as Stake[] | undefined }
  check(!stakeInto(w, 'btc', 1, 'd7', 60000, T).ok, 'BTC cannot be staked')
  check(!stakeInto(w, 'eth', 1, 'd7', 1800, T).ok, 'cannot stake a coin you do not hold')
  check(!stakeInto({ coins: { sol: { qty: 0.001, avg: 60 } } }, 'sol', 1, 'd7', 60, T).ok, 'under $1 is refused')
  const r = stakeInto(w, 'sol', 0.5, 'd7', 60, T, 'k1')
  check(r.ok && w.coins.sol!.qty === 5 && w.stakes?.length === 1 && w.stakes[0]!.qty === 5 && w.stakes[0]!.avg === 60, 'half the SOL is staked')
  // Early exit: coins back, reward forfeited.
  const e = unstakeFrom(w, 'k1', T + 3 * day)
  check(e.ok && e.reward === 0 && e.forfeited > 0 && near(w.coins.sol!.qty, 10) && near(w.coins.sol!.avg, 60), 'early unstake returns the coins and forfeits the reward')
  check(w.stakes === undefined, 'no stakes left: the field goes away')
  check(!unstakeFrom(w, 'k1', T).ok, 'a closed stake cannot be closed twice')
  // Full term: coins plus reward; the free reward lowers the average price.
  stakeInto(w, 'sol', 1, 'd30', 60, T, 'k2')
  check(w.coins.sol!.qty === 0, 'Max stakes everything')
  const m = unstakeFrom(w, 'k2', T + 31 * day)
  const want = 10 * 9.1 / 100 * 30 / 365
  check(m.ok && near(m.reward, want) && m.forfeited === 0 && near(w.coins.sol!.qty, 10 + want), 'after the lock the reward is paid in SOL')
  check(w.coins.sol!.avg < 60 && near(w.coins.sol!.avg * w.coins.sol!.qty, 600), 'cost basis unchanged, average lowered by the free reward')
  // Flexible: leave any time with the reward.
  stakeInto(w, 'sol', 0.25, 'flex', 60, T, 'k3')
  const fx = unstakeFrom(w, 'k3', T + 2 * day)
  check(fx.ok && fx.reward > 0 && fx.forfeited === 0, 'Flexible pays its reward whenever you leave')
  // At most MAX_STAKES at once.
  const many = { coins: { eth: { qty: 100, avg: 1 } } as Record<string, { qty: number; avg: number }> }
  for (let i = 0; i < MAX_STAKES; i++) stakeInto(many, 'eth', 0.1, 'flex', 1800, T, `m${i}`)
  check(!stakeInto(many, 'eth', 0.1, 'flex', 1800, T, 'mx').ok, `no more than ${MAX_STAKES} stakes`)
}

// Save round-trip and old saves.
{
  const now = new Date(T)
  const old = createSave(now)
  old.coins.sol = { qty: 4, avg: 70 }
  const oldJson = JSON.stringify(old)
  check(!('stakes' in hydrate(JSON.parse(oldJson), now)), 'a save from before staking has no stakes field')
  check(JSON.stringify(hydrate(JSON.parse(oldJson), now)) === JSON.stringify(hydrate(JSON.parse(JSON.stringify(hydrate(JSON.parse(oldJson), now))), now)), 'an old save loads the same every time')
  const s = hydrate(JSON.parse(oldJson), now)
  stakeInto(s, 'sol', 0.5, 'd7', 70, T - 1000, 'rt1')
  const back = hydrate(JSON.parse(JSON.stringify(s)), now)
  check(back.stakes?.length === 1 && back.stakes[0]!.id === 'rt1' && back.stakes[0]!.qty === 2 && back.coins.sol!.qty === 2, 'stakes survive a reload')
  const { stakes: _drop, ...restA } = back, { stakes: _drop2, ...restB } = s
  check(JSON.stringify(restA) === JSON.stringify(restB), 'nothing else in the save changes')
  // Malformed or tampered entries are dropped or clipped.
  const bad = cleanStakes([{ id: 'x', coin: 'btc', qty: 1, avg: 1, plan: 'd7', apr: 5, at: T }, { id: 'y', coin: 'sol', qty: -1, avg: 1, plan: 'd7', apr: 5, at: T }, { id: 'z', coin: 'sol', qty: 1, avg: 1, plan: 'forever', apr: 5, at: T }, { id: 'w', coin: 'sol', qty: 1, avg: 1, plan: 'd7', apr: 49, at: T }, 'junk'], T)
  check(bad.length === 1 && bad[0]!.id === 'w' && bad[0]!.apr === 7, 'bad entries dropped, inflated rate clipped to the plan')
  check(cleanStakes(undefined).length === 0 && cleanStakes({}).length === 0, 'missing or wrong type gives no stakes')
}

console.log(`staking: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
