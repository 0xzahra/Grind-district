// The DeFi desk's maths (src/defiCore.ts): the DEX charges its fee and more impact for bigger trades, yield
// compounds at game speed, health factor and borrow room follow the market's thresholds, bridges pick the right
// route (and refuse what they cannot carry), the Turbo Farm cannot be re-rolled, and the DAO's votes add up.
import {
  CHAINS, CHAIN_IDS, GAME_SPEED, MARKET, QUORUM, GRIND_SUPPLY, SWAP_FEE, VAULTS,
  borrowRoom, bridgeRoute, crossRoute, grow, healthFactor, minOut, proposalsFor, swapQuote, tally, turboDrained,
} from '../src/defiCore.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))

// Chains: every chain lists its gas token among its tokens, and L1 Ethereum is the dearest to use.
for (const c of CHAIN_IDS) check(CHAINS[c].toks.includes(CHAINS[c].gasTok), `${c}: gas token is listed`)
check(CHAIN_IDS.every((c) => c === 'ethereum' || CHAINS[c].gasUsd < CHAINS.ethereum.gasUsd), 'Ethereum gas is the highest')

// DEX quote.
{
  const small = swapQuote(100, 1, 2000, 10_000_000), big = swapQuote(1_000_000, 1, 2000, 10_000_000)
  check(near(small.feeUsd, 100 * SWAP_FEE), 'fee is 0.3% of what you pay')
  check(small.out > 0 && small.out < 100 / 2000, 'out is a little under the mid-market amount')
  check(small.impact < 0.0001, `small trade barely moves the pool (${small.impact})`)
  check(big.impact > 0.15, `a $1m trade into a $10m pool moves it a lot (${big.impact.toFixed(3)})`)
  check(swapQuote(0, 1, 2000, 1e7).out === 0, 'nothing in, nothing out')
  check(near(minOut(100, 0.5), 99.5), 'min received at 0.5% slippage')
}
// Yield at game speed: one real hour is a day of interest.
{
  const day = 86_400_000
  check(near(grow(100, 5, 0), 100), 'no time, no yield')
  check(near(grow(100, 5, (365 * day) / GAME_SPEED), 105, 1e-9), 'a game year at 5% gives 5%')
  check(grow(100, 240, 3_600_000) > grow(100, 5, 3_600_000), 'higher APY grows faster')
  check(near(grow(100, 5, -5), 100), 'negative time does nothing')
}
// Vaults: the farm with the absurd yield is the only one flagged.
check(VAULTS.filter((v) => v.warn).map((v) => v.id).join() === 'turbo', 'only Turbo Farm carries the warning')
check(VAULTS.every((v) => CHAINS[v.chain].toks.includes(v.tok)), 'each vault takes a token its chain has')
check(!turboDrained(0.9, 0) && turboDrained(0.1, 4 * 3_600_000) && !turboDrained(0.99, 3_600_000), 'Turbo drain follows the fate drawn at deposit')
// Lending.
{
  const coll = [{ tok: 'ETH' as const, usd: 1000 }]
  check(near(borrowRoom(coll, 0), 1000 * MARKET.ETH.ltv), 'borrow room is collateral × LTV')
  check(near(borrowRoom(coll, 300), 1000 * MARKET.ETH.ltv - 300), 'existing debt uses up the room')
  check(borrowRoom(coll, 5000) === 0, 'room never negative')
  check(healthFactor(coll, 0) === Infinity, 'no debt, infinite health')
  check(near(healthFactor(coll, 500), (1000 * MARKET.ETH.liq) / 500), 'health = collateral × threshold / debt')
  // Borrow to the limit, then a 10% drop in ETH puts health under 1 (liquidatable).
  const maxDebt = borrowRoom(coll, 0)
  check(healthFactor([{ tok: 'ETH', usd: 900 }], maxDebt) < 1, 'max borrow + 10% drop = liquidation')
  check(Object.values(MARKET).every((m) => m.ltv < m.liq && m.supply < m.borrow), 'LTV under threshold; borrow rate over supply rate')
}
// Bridges.
check(bridgeRoute('base', 'base', 'USDC') === null, 'no bridge to the same chain')
check(bridgeRoute('base', 'solana', 'USDC')?.kind === 'native', 'USDC moves natively (burn and mint)')
check(bridgeRoute('ethereum', 'base', 'ETH')?.kind === 'canonical' && bridgeRoute('ethereum', 'base', 'ETH')!.secs < 120, 'ETH deposit to a rollup is quick')
check(bridgeRoute('arbitrum', 'ethereum', 'ETH')!.secs === 7 * 60, 'rollup withdrawal waits the challenge window (7 min here)')
check(bridgeRoute('base', 'arbitrum', 'ETH')?.kind === 'intent', 'L2 to L2 ETH goes through a fast bridge')
check(bridgeRoute('base', 'solana', 'ETH') === null && bridgeRoute('base', 'near', 'SOL') === null, 'bridges refuse tokens the far chain does not have')
check(crossRoute('base', 'solana', 'ETH', 'SOL')?.kind === 'intent', 'cross-chain swaps any listed pair')
check(crossRoute('base', 'base', 'ETH', 'USDC') === null && crossRoute('base', 'near', 'SOL', 'NEAR') === null, 'cross-chain refuses same chain or a missing token')
// DAO.
{
  const day = 20776, ps = proposalsFor(day)
  check(ps.length === 2 && ps[0]!.id !== ps[1]!.id, 'two different proposals a day')
  check(proposalsFor(day)[0]!.id === ps[0]!.id, 'same proposals all day (deterministic)')
  check(proposalsFor(day + 1)[0]!.id !== ps[0]!.id, 'new ones the next day')
  const t0 = tally(ps[0]!), t1 = tally(ps[0]!, { choice: 'for', weight: 50_000 })
  check(near(t0.for + t0.against + t0.abstain, t0.turnout), 'votes add up to turnout')
  check(near(t1.for - t0.for, 50_000) && near(t1.against, t0.against), 'your weight lands on your side only')
  check(tally(ps[0]!, { choice: 'for', weight: GRIND_SUPPLY * QUORUM }).quorum, 'enough weight reaches quorum')
}

console.log(`defi: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
