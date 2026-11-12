// Practice perpetuals on the listed coins. A position sets margin aside from EARNED in-game cash (never from a
// top-up), marks to the same practice prices as the spot book, and pays margin plus profit or minus loss when
// closed. It is liquidated when the loss reaches the margin. Positions are a device-side list beside the save
// (the save format is untouched): cash only moves through the save's own spend and earn functions.
import { COINS, RANKS, cents, money, rankFor } from './logic.ts'
import { balanceSplit, earnCash, getSave, slotKey, spendInGame } from './state.ts'

export type Perp = { id: string; coin: string; side: 'long' | 'short'; lev: number; margin: number; entry: number; at: number }
export const LEVERAGE = [2, 5, 10] as const
export const MAX_PERPS = 6
const key = () => `gd.perps.v1:${slotKey()}`

const sym = (coin: string) => COINS.find((c) => c.id === coin)?.label.split(' ')[0] ?? coin.toUpperCase()
const label = (p: Pick<Perp, 'coin' | 'side' | 'lev'>) => `${sym(p.coin)} ${p.side} ${p.lev}x`
export const markPrice = (coin: string): number => getSave().coinPrices[coin] ?? COINS.find((c) => c.id === coin)?.base ?? 0

export function perps(): Perp[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key()) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter((p): p is Perp => !!p && typeof p === 'object' && typeof (p as Perp).id === 'string' && COINS.some((c) => c.id === (p as Perp).coin)
      && ((p as Perp).side === 'long' || (p as Perp).side === 'short') && (p as Perp).margin > 0 && (p as Perp).entry > 0 && (p as Perp).lev >= 1 && (p as Perp).lev <= 10)
  } catch { return [] }
}
const store = (list: Perp[]): boolean => { try { localStorage.setItem(key(), JSON.stringify(list)); return true } catch { return false } }

/** Profit or loss in dollars at a mark price. */
export const perpPnl = (p: Perp, mark = markPrice(p.coin)): number => cents(p.margin * p.lev * (mark / p.entry - 1) * (p.side === 'long' ? 1 : -1))
/** The mark price at which the loss equals the margin. */
export const liqPrice = (p: Pick<Perp, 'side' | 'lev' | 'entry'>): number => p.entry * (p.side === 'long' ? 1 - 1 / p.lev : 1 + 1 / p.lev)
/** Cash a new position may use: earned in-game balance only. */
export const perpCash = (): number => balanceSplit().earned

export function openPerp(coin: string, side: 'long' | 'short', lev: number, fraction: number): { ok: boolean; message: string } {
  const c = COINS.find((x) => x.id === coin)
  if (!c) return { ok: false, message: 'Not listed.' }
  const save = getSave()
  if (RANKS.findIndex((r) => r.id === c.minRank) > RANKS.findIndex((r) => r.id === rankFor(save.xp).id)) return { ok: false, message: `Opens at ${RANKS.find((r) => r.id === c.minRank)!.label}.` }
  if (!LEVERAGE.includes(lev as (typeof LEVERAGE)[number])) return { ok: false, message: 'Pick a leverage.' }
  const list = perps()
  if (list.length >= MAX_PERPS) return { ok: false, message: `Close a position first: ${MAX_PERPS} is the most you can hold.` }
  const margin = cents(perpCash() * fraction)
  if (margin < 1) return { ok: false, message: 'You need at least $1 of earned in-game cash for margin.' }
  const entry = markPrice(coin)
  if (!(entry > 0)) return { ok: false, message: 'No price on the book.' }
  const p: Perp = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, coin, side, lev, margin, entry, at: Date.now() }
  // Record the position before the margin leaves the balance: if it cannot be kept, nothing is spent.
  if (!store([...list, p])) return { ok: false, message: 'This device would not save the position, so nothing was opened.' }
  const paid = spendInGame(margin, `Opened ${label(p)}`, 'Practice perpetual: margin set aside.')
  if (!paid.ok) { store(list); return paid }
  return { ok: true, message: `Opened ${label(p)} · ${money(margin * lev)} position on ${money(margin)} margin.` }
}

export function closePerp(id: string): { ok: boolean; message: string } {
  const list = perps()
  const p = list.find((x) => x.id === id)
  if (!p) return { ok: false, message: 'That position is already closed.' }
  const pnl = perpPnl(p)
  const back = cents(Math.max(0, p.margin + pnl))
  // Take the position off the list first, so it can never pay out twice.
  if (!store(list.filter((x) => x.id !== id))) return { ok: false, message: 'This device would not save the change. Try again.' }
  earnCash(back, `Closed ${label(p)}`, `P&L ${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))} on ${money(p.margin)} margin.`)
  return { ok: true, message: `Closed ${label(p)} · P&L ${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl))}.` }
}

/** Remove positions whose loss has reached their margin. Returns one line per liquidation. */
export function sweepPerps(): string[] {
  const list = perps()
  const gone = list.filter((p) => p.margin + perpPnl(p) <= 0)
  if (!gone.length || !store(list.filter((p) => !gone.includes(p)))) return []
  return gone.map((p) => {
    earnCash(0, `Liquidated ${label(p)}`, `The ${money(p.margin)} margin is gone.`)
    return `${label(p)} was liquidated at ${markPrice(p.coin) >= 1 ? money(markPrice(p.coin)) : `$${markPrice(p.coin).toPrecision(3)}`}. The ${money(p.margin)} margin is gone.`
  })
}

let watching = 0
/** Check open positions against the market every two seconds while any exist. */
export function watchPerps(onLiquidated: (message: string) => void): void {
  if (watching) return
  watching = window.setInterval(() => { if (perps().length) for (const m of sweepPerps()) onLiquidated(m) }, 2000)
}
