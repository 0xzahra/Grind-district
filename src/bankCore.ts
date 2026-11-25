// Grind Bank, the numbers (no screen code, so the checks can run it): two spot crypto ETFs priced from the live
// coin price, and a halal profit-sharing savings account. Practice money only: both use earned in-game cash.
//
// ETFs. A spot Bitcoin ETF holds real bitcoin with a custodian; one share stands for a fixed amount of coin. Its
// NAV (net asset value) is that coin times the price, less the yearly fee (the expense ratio) taken a little each
// day. On the exchange the share trades near NAV but not exactly on it: a small premium or discount that market
// makers close by creating or redeeming shares. Both are modelled here, deterministically from the clock.
//
// Halal savings. No interest (riba). The bank invests the pool in screened, asset-backed trade and shares the
// result: profits split at an agreed ratio (60% to savers, 40% to the bank); a loss falls on the capital, so the
// return is never guaranteed. Each day's pool result is fixed by the date, so every player sees the same one.

export type FundId = 'gbtx' | 'geth'
export type Fund = { id: FundId; ticker: string; name: string; coin: 'BTC' | 'ETH'; perShare: number; fee: number; fallback: number }
export const FUNDS: Fund[] = [
  { id: 'gbtx', ticker: 'GBTX', name: 'Grind Spot Bitcoin ETF', coin: 'BTC', perShare: 0.0005, fee: 0.0025, fallback: 95_000 },
  { id: 'geth', ticker: 'GETH', name: 'Grind Spot Ether ETF', coin: 'ETH', perShare: 0.01, fee: 0.0025, fallback: 3_300 },
]
/** The funds' launch date: fee drag counts from here. */
export const LAUNCH = Date.UTC(2026, 0, 12)
const YEAR = 365.25 * 864e5
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/** NAV per share: the coin each share holds, at this price, less the fees taken since launch. */
export function nav(f: Fund, coinPrice: number, now = Date.now()): number {
  const years = Math.max(0, (now - LAUNCH) / YEAR)
  return f.perShare * coinPrice * (1 - f.fee) ** years
}
/** Premium (+) or discount (-) to NAV on the exchange right now, within about ±0.35%. */
export function premium(f: Fund, now = Date.now()): number {
  const m = now / 60_000, k = f.id === 'gbtx' ? 1 : 1.7
  return 0.0022 * Math.sin(m / 37 * k) + 0.0013 * Math.sin(m / 11 + k)
}
/** The share's price on the exchange: NAV times (1 + premium), in cents. */
export function sharePrice(f: Fund, coinPrice: number, now = Date.now()): number {
  return round(nav(f, coinPrice, now) * (1 + premium(f, now)))
}

export type Position = { shares: number; cost: number }
export type Holdings = Partial<Record<FundId, Position>>

/** Buy `usd` worth at `price` (fractional shares, to 4 places). Returns the new holdings and the shares bought. */
export function buy(h: Holdings, id: FundId, usd: number, price: number): { h: Holdings; shares: number } {
  if (!(usd > 0) || !(price > 0)) return { h, shares: 0 }
  const shares = Math.floor((usd / price) * 1e4) / 1e4
  if (shares <= 0) return { h, shares: 0 }
  const p = h[id] ?? { shares: 0, cost: 0 }
  return { h: { ...h, [id]: { shares: round(p.shares + shares, 4), cost: round(p.cost + shares * price) } }, shares }
}
/** Sell `shares` (capped at what is held) at `price`. Returns the new holdings and the cash it brings. */
export function sell(h: Holdings, id: FundId, shares: number, price: number): { h: Holdings; usd: number; shares: number } {
  const p = h[id]
  if (!p || !(shares > 0) || !(price > 0)) return { h, usd: 0, shares: 0 }
  const n = Math.min(p.shares, Math.floor(shares * 1e4) / 1e4)
  const left = round(p.shares - n, 4)
  const cost = left > 0 ? round(p.cost * (left / p.shares)) : 0
  const next: Holdings = { ...h }
  if (left > 0) next[id] = { shares: left, cost }; else delete next[id]
  return { h: next, usd: round(n * price), shares: n }
}

// ---- Halal savings (mudarabah) ----
export const SAVER_SHARE = 0.6
export type Savings = { balance: number; day: string; paid: number; log: Array<{ day: string; pool: number; amount: number }> }
export const emptySavings = (day: string): Savings => ({ balance: 0, day, paid: 0, log: [] })

/** The pool's result for a day (a fraction of capital): mostly a small profit, sometimes a small loss. */
export function poolResult(day: string): number {
  let h = 2166136261
  for (const c of day) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  const u = (h % 10_000) / 10_000
  // Savers net about 0.7% a month (roughly 8 to 9% a year, never promised): -0.03% to +0.09% a day, a loss one day in four.
  return u * 0.0012 - 0.0003
}
const dayAfter = (day: string) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10) }

/** Pay out every whole day since the account was last settled (at most 60 days at once). */
export function settle(s: Savings, today: string): Savings {
  if (!s.day || s.day >= today) return { ...s, day: s.day || today }
  let day = s.day, balance = s.balance, paid = s.paid
  const log = [...s.log]
  for (let i = 0; i < 60 && day < today; i++) {
    const pool = poolResult(day)
    // Profit is shared 60:40; a loss is borne by the capital in full (the bank loses its effort, not money).
    const amount = balance > 0 ? round(pool > 0 ? balance * pool * SAVER_SHARE : balance * pool) : 0
    balance = round(balance + amount); paid = round(paid + amount)
    if (balance > 0) log.push({ day, pool, amount })
    day = dayAfter(day)
  }
  return { balance, day: today, paid, log: log.slice(-30) }
}
