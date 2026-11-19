// The DeFi desk's maths (defi.ts is the screen): chains and their gas, a constant-product DEX quote, vault and
// lending yields, health factor and liquidation, bridge routes, and the Grind DAO's proposals. Kept pure so the
// checks can read it. Everything is practice: real prices from the market, in-game money, no chain is touched.

export type Chain = 'ethereum' | 'base' | 'arbitrum' | 'solana' | 'near'
export type Tok = 'USDC' | 'ETH' | 'SOL' | 'NEAR' | 'BTC'
export const CHAIN_IDS: Chain[] = ['ethereum', 'base', 'arbitrum', 'solana', 'near']
export const CHAINS: Record<Chain, { name: string; layer: string; gasTok: Tok; gasUsd: number; toks: Tok[]; depth: number; note: string }> = {
  ethereum: { name: 'Ethereum', layer: 'Layer 1', gasTok: 'ETH', gasUsd: 2.4, toks: ['USDC', 'ETH', 'BTC'], depth: 40_000_000, note: 'The most secure chain for apps, and the most expensive to use: every action costs a few dollars of gas.' },
  base: { name: 'Base', layer: 'Layer 2 on Ethereum', gasTok: 'ETH', gasUsd: 0.02, toks: ['USDC', 'ETH', 'BTC'], depth: 12_000_000, note: 'A rollup: cheap and fast, and it settles its batches to Ethereum.' },
  arbitrum: { name: 'Arbitrum', layer: 'Layer 2 on Ethereum', gasTok: 'ETH', gasUsd: 0.03, toks: ['USDC', 'ETH'], depth: 8_000_000, note: 'Another Ethereum rollup, with its own apps and liquidity.' },
  solana: { name: 'Solana', layer: 'Layer 1', gasTok: 'SOL', gasUsd: 0.002, toks: ['USDC', 'SOL'], depth: 15_000_000, note: 'Its own fast chain: fees are a fraction of a cent, paid in SOL.' },
  near: { name: 'NEAR', layer: 'Layer 1', gasTok: 'NEAR', gasUsd: 0.002, toks: ['USDC', 'NEAR'], depth: 2_000_000, note: 'Sharded chain with readable account names; fees are tiny, paid in NEAR.' },
}
/** Which listed coin prices a token (USDC is $1). */
export const COIN_OF: Record<Tok, string | null> = { USDC: null, ETH: 'eth', SOL: 'sol', NEAR: 'near', BTC: 'btc' }
export const TOK_NAME: Record<Tok, string> = { USDC: 'USD Coin', ETH: 'Ether', SOL: 'Solana', NEAR: 'NEAR', BTC: 'Wrapped Bitcoin' }

// ---- DEX: a constant-product pool (x · y = k), each side holding half the pool's depth in dollars.
export const SWAP_FEE = 0.003
export function swapQuote(amountIn: number, pIn: number, pOut: number, depthUsd: number, fee = SWAP_FEE): { out: number; feeUsd: number; impact: number } {
  const vin = Math.max(0, amountIn) * pIn
  const v = vin * (1 - fee), r = depthUsd / 2
  const vout = v > 0 ? (r * v) / (r + v) : 0
  return { out: pOut > 0 ? vout / pOut : 0, feeUsd: vin * fee, impact: v > 0 ? 1 - vout / v : 0 }
}
/** The least a swap may return before it reverts, at a slippage tolerance in percent. */
export const minOut = (out: number, slipPct: number): number => out * (1 - slipPct / 100)

// ---- Yield runs at game speed: an hour of play is a day of interest (or it would take years to see anything).
export const GAME_SPEED = 24
const YEAR = 365 * 86_400_000
export function grow(principal: number, apyPct: number, ms: number): number {
  return principal * Math.pow(1 + apyPct / 100, (Math.max(0, ms) * GAME_SPEED) / YEAR)
}

export type VaultId = 'usdc-base' | 'eth-stake' | 'sol-stake' | 'near-stake' | 'turbo'
export const VAULTS: Array<{ id: VaultId; name: string; chain: Chain; tok: Tok; apy: number; risk: 'Low' | 'Medium' | 'Very high'; how: string; warn?: string }> = [
  { id: 'usdc-base', name: 'Stable yield', chain: 'base', tok: 'USDC', apy: 5.2, risk: 'Low', how: 'Lends your USDC to borrowers on Base. The rate moves with how much people borrow.' },
  { id: 'eth-stake', name: 'ETH staking', chain: 'ethereum', tok: 'ETH', apy: 3.1, risk: 'Low', how: 'Your ETH backs validators that secure Ethereum. On the real chain, unstaking joins a queue.' },
  { id: 'sol-stake', name: 'SOL liquid staking', chain: 'solana', tok: 'SOL', apy: 6.8, risk: 'Medium', how: 'Stakes SOL and gives you a receipt token you could use elsewhere. Adds the staking app\'s own risk.' },
  { id: 'near-stake', name: 'NEAR staking', chain: 'near', tok: 'NEAR', apy: 9.2, risk: 'Medium', how: 'Delegates NEAR to a validator pool. Rewards are new NEAR, so the dollar value moves with the price.' },
  { id: 'turbo', name: 'Turbo Farm', chain: 'base', tok: 'USDC', apy: 240, risk: 'Very high', how: 'Pays 240% in its own freshly printed token.', warn: 'Unaudited code, an anonymous team, and rewards printed from nothing. Farms like this are drained or rugged all the time: treat anything here as already lost.' },
]
/** Turbo Farm: drawn once at deposit (fate), so the outcome cannot be re-rolled. The longer you stay, the likelier. */
export const turboDrained = (fate: number, ms: number): boolean => 1 - Math.exp((-0.25 * Math.max(0, ms)) / 3_600_000) > fate
export const TURBO_LOSS = 0.85

// ---- Lending and borrowing: one money market on Base.
export type LendTok = 'USDC' | 'ETH' | 'BTC'
export const MARKET: Record<LendTok, { supply: number; borrow: number; ltv: number; liq: number }> = {
  USDC: { supply: 4.1, borrow: 6.4, ltv: 0.8, liq: 0.85 },
  ETH: { supply: 1.8, borrow: 3.2, ltv: 0.8, liq: 0.83 },
  BTC: { supply: 0.6, borrow: 2.4, ltv: 0.73, liq: 0.78 },
}
export const LIQ_BONUS = 0.05
/** Collateral (in dollars, weighted by liquidation threshold) over debt. Below 1, the position can be liquidated. */
export function healthFactor(coll: Array<{ usd: number; tok: LendTok }>, debtUsd: number): number {
  const c = coll.reduce((n, x) => n + x.usd * MARKET[x.tok].liq, 0)
  return debtUsd > 0 ? c / debtUsd : Infinity
}
/** How much more can be borrowed (in dollars) against the collateral at its loan-to-value. */
export function borrowRoom(coll: Array<{ usd: number; tok: LendTok }>, debtUsd: number): number {
  return Math.max(0, coll.reduce((n, x) => n + x.usd * MARKET[x.tok].ltv, 0) - debtUsd)
}

// ---- Bridges. Times are shortened for play; the screen says how long the real ones take.
export type Route = { kind: 'native' | 'canonical' | 'intent'; label: string; secs: number; feePct: number; feeUsd: number; real: string; note: string }
const L2 = (c: Chain) => c === 'base' || c === 'arbitrum'
export function bridgeRoute(from: Chain, to: Chain, tok: Tok): Route | null {
  if (from === to || !CHAINS[from].toks.includes(tok) || !CHAINS[to].toks.includes(tok)) return null
  if (tok === 'USDC') return { kind: 'native', label: 'Native USDC transfer (burn and mint)', secs: 60, feePct: 0, feeUsd: 0, real: 'about a minute to a few minutes', note: 'USDC is burned on one chain and minted fresh on the other by its issuer: no wrapped copy to depeg.' }
  if (tok === 'ETH' && from === 'ethereum' && L2(to)) return { kind: 'canonical', label: `Official ${CHAINS[to].name} bridge: deposit`, secs: 60, feePct: 0, feeUsd: 0, real: '1 to 3 minutes', note: 'Deposits into a rollup are quick: Ethereum is the source of truth.' }
  if (tok === 'ETH' && L2(from) && to === 'ethereum') return { kind: 'canonical', label: `Official ${CHAINS[from].name} bridge: withdrawal`, secs: 7 * 60, feePct: 0, feeUsd: 0, real: '7 days (7 minutes here)', note: 'Optimistic rollups wait out a 7-day challenge window, so anyone can prove a fraudulent withdrawal before it pays out.' }
  if (tok === 'ETH' && L2(from) && L2(to)) return { kind: 'intent', label: 'Fast bridge (a solver fronts you the ETH)', secs: 20, feePct: 0.05, feeUsd: 0.05, real: 'seconds', note: 'A solver pays you on the other side right away and claims your funds later, for a small fee.' }
  return null
}
/** Cross-chain: any token on one chain to any token on another, swapped and delivered by a solver (an intent). */
export function crossRoute(from: Chain, to: Chain, tokIn: Tok, tokOut: Tok): Route | null {
  if (from === to || !CHAINS[from].toks.includes(tokIn) || !CHAINS[to].toks.includes(tokOut)) return null
  return { kind: 'intent', label: 'Cross-chain swap (intent, filled by a solver)', secs: 30, feePct: 0.1, feeUsd: 0.1, real: 'under a minute', note: 'You sign what you want; a solver delivers it on the other chain. Bridges hold huge pools of money and are among the most hacked parts of crypto: only use well-known ones, from their official site.' }
}

// ---- The Grind DAO. Governance tokens (GRIND) come from providing liquidity; they have no cash value here.
export type Proposal = { n: number; id: string; title: string; body: string; effect: string; lean: number }
const PROPOSALS: Array<Omit<Proposal, 'n' | 'id' | 'lean'>> = [
  { title: 'Raise the Stable yield vault\'s reserve factor from 10% to 15%', body: 'More of the interest goes to the DAO\'s safety reserve, which covers bad debt.', effect: 'Slightly lower yield for depositors, a bigger cushion if a borrower goes bad.' },
  { title: 'List cbBTC as collateral at 73% loan-to-value', body: 'Lets people borrow against Bitcoin on Base.', effect: 'More borrowing demand; more risk if BTC falls fast.' },
  { title: 'Fund a $250k audit of the Turbo Farm contracts', body: 'An independent security firm reviews the code before the DAO touches it.', effect: 'Spends treasury money; audits lower but never remove risk.' },
  { title: 'Lower the ETH liquidation threshold from 83% to 80%', body: 'Positions get liquidated a little earlier.', effect: 'Safer for lenders, tighter for borrowers.' },
  { title: 'Give 2% of the treasury to Campus scholarships', body: 'Grants for new players taking the security and wallet courses.', effect: 'Less in the treasury, more people who know how to stay safe.' },
  { title: 'Add a 48-hour timelock to every contract upgrade', body: 'Changes are announced two days before they take effect.', effect: 'Slower upgrades; users get time to leave if they disagree.' },
  { title: 'Pay delegates who vote on 90% of proposals', body: 'A small GRIND stipend for active, public delegates.', effect: 'More participation; costs tokens from the treasury.' },
  { title: 'Move 20% of the treasury from GRIND into USDC', body: 'Diversify so the DAO can pay its bills in a downturn.', effect: 'Sells GRIND on the market; steadier runway.' },
]
const hash = (s: string): number => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h }
/** Two proposals open each day (UTC); each closes at midnight UTC. */
export function proposalsFor(day: number): Proposal[] {
  return [0, 1].map((k) => {
    const n = day * 2 + k
    const p = PROPOSALS[((n % PROPOSALS.length) + PROPOSALS.length) % PROPOSALS.length]!
    return { ...p, n, id: `GIP-${100 + (((n % 900) + 900) % 900)}`, lean: 0.35 + (hash(`gip${n}`) % 40) / 100 }
  })
}
export const GRIND_SUPPLY = 1_000_000
export const QUORUM = 0.04
/** The vote so far: other holders (deterministic for the day) plus your own weight. */
export function tally(p: Proposal, mine?: { choice: 'for' | 'against' | 'abstain'; weight: number }): { for: number; against: number; abstain: number; turnout: number; quorum: boolean; passing: boolean } {
  const turnout0 = GRIND_SUPPLY * (0.03 + (hash(`t${p.n}`) % 60) / 1000)
  let f = turnout0 * p.lean * 0.94, a = turnout0 * (1 - p.lean) * 0.94, ab = turnout0 * 0.06
  if (mine) { if (mine.choice === 'for') f += mine.weight; else if (mine.choice === 'against') a += mine.weight; else ab += mine.weight }
  const t = f + a + ab
  return { for: f, against: a, abstain: ab, turnout: t, quorum: t >= GRIND_SUPPLY * QUORUM, passing: f > a }
}
/** Liquidity mining: GRIND earned per dollar provided per game day. */
export const GRIND_PER_USD_DAY = 0.005
