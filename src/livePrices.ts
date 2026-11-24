// Live coin prices for the trading centre: real last prices and 24-hour change from Coinbase's public market data
// (through /api/track?op=prices, cached at the edge; straight from Coinbase if that is unreachable). The listed
// coins' practice prices follow these (logic.ts stepCoins), so the charts, Spot, Perps, Convert and the DeFi desk
// all show what the market is really doing. Trades stay practice trades with in-game money: nothing is sent.
export type Quote = { s: string; last: number; open: number; high: number; low: number }

const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'LINK', 'AVAX', 'DOT', 'NEAR', 'SUI', 'DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'ADA', 'LTC', 'BCH', 'UNI', 'AAVE', 'ATOM', 'ARB', 'OP', 'APT', 'FIL', 'XLM', 'HBAR', 'ICP', 'ETC', 'POL', 'INJ']
let quotes: Record<string, Quote> = {}
let at = 0, last = 0, busy = false, fast = 0
/** One hourly candle: [time in seconds, open, high, low, close]. */
export type Bar = [number, number, number, number, number]
const candles = new Map<string, { at: number; closes: number[]; bars: Bar[] }>()

/** Latest quote for a coin id ('btc') or symbol ('BTC'), or undefined before the first fetch lands. */
export const liveQuote = (id: string): Quote | undefined => quotes[id.toUpperCase()]
/** Live last price for a coin id, if known. */
export const livePrice = (id: string): number | undefined => quotes[id.toUpperCase()]?.last
/** 24-hour change in percent, if known. */
export const liveChange = (id: string): number | undefined => { const q = quotes[id.toUpperCase()]; return q && q.open > 0 ? (q.last / q.open - 1) * 100 : undefined }
/** When the prices were last updated (ms since epoch), 0 before the first. */
export const liveAt = (): number => at

const direct = async (): Promise<Quote[]> => {
  const rows = await Promise.all(SYMS.map(async (s) => {
    try {
      const r = await fetch(`https://api.exchange.coinbase.com/products/${s}-USD/stats`, { signal: AbortSignal.timeout(5000) })
      const j = r.ok ? (await r.json()) as Record<string, string> : null
      const lastP = Number(j?.last)
      return lastP > 0 ? { s, last: lastP, open: Number(j?.open) || lastP, high: Number(j?.high) || lastP, low: Number(j?.low) || lastP } : null
    } catch { return null }
  }))
  return rows.filter((q): q is Quote => !!q)
}

/** Ask for fresh prices: every 10 s while the trading screen wants them (see wantFast), else every minute. Cheap to call every frame. */
export function ensurePrices(): void {
  const now = Date.now()
  const every = now < fast ? 10_000 : 60_000
  if (busy || now - last < (at ? every : 15_000)) return
  busy = true; last = now
  void (async () => {
    let list: Quote[] = []
    try {
      const r = await fetch('/api/track?op=prices', { signal: AbortSignal.timeout(6000) })
      const j = r.ok ? (await r.json()) as { coins?: Quote[] } : null
      list = (j?.coins ?? []).filter((q) => q && q.last > 0)
    } catch { /* fall back below */ }
    if (!list.length) list = await direct()
    if (list.length) { const next: Record<string, Quote> = { ...quotes }; for (const q of list) next[q.s] = q; quotes = next; at = Date.now(); window.dispatchEvent(new Event('gd:prices')) }
  })().finally(() => { busy = false })
}
/** The trading screen is open: refresh every 10 s for the next minute. */
export function wantFast(): void { const was = fast; fast = Date.now() + 60_000; if (was < Date.now()) { last = 0; ensurePrices() } }

/** 48 hourly closes for a coin (real), fetched once every five minutes per coin; empty until it lands. */
export function hourly(id: string): number[] {
  const s = id.toUpperCase(), c = candles.get(s)
  if (!c || Date.now() - c.at > 300_000) {
    candles.set(s, { at: Date.now(), closes: c?.closes ?? [], bars: c?.bars ?? [] })
    void (async () => {
      let closes: number[] = [], bars: Bar[] = []
      const okBar = (k: unknown): k is Bar => Array.isArray(k) && k.length >= 5 && k.slice(0, 5).every((v) => typeof v === 'number' && v > 0)
      try { const r = await fetch(`/api/track?op=candles&s=${s}`, { signal: AbortSignal.timeout(6000) }); const j = r.ok ? (await r.json()) as { closes?: number[]; ohlc?: unknown[] } : null; closes = (j?.closes ?? []).filter((v) => v > 0); bars = (j?.ohlc ?? []).filter(okBar) } catch { /* below */ }
      if (!closes.length) {
        // Coinbase rows are [time, low, high, open, close, volume], newest first.
        try { const r = await fetch(`https://api.exchange.coinbase.com/products/${s}-USD/candles?granularity=3600`, { signal: AbortSignal.timeout(6000) }); const raw = r.ok ? (await r.json()) as unknown[][] : []; closes = raw.slice(0, 48).reverse().map((k) => Number(k[4])).filter((v) => v > 0); bars = raw.slice(0, 120).reverse().map((k) => [Number(k[0]), Number(k[3]), Number(k[2]), Number(k[1]), Number(k[4])]).filter(okBar) } catch { /* none */ }
      }
      if (closes.length) { candles.set(s, { at: Date.now(), closes, bars }); window.dispatchEvent(new Event('gd:prices')) }
    })()
  }
  return candles.get(s)?.closes ?? []
}

/** Up to 120 real hourly candles for a coin (oldest first); empty until they land. Shares hourly()'s fetch. */
export function hourlyBars(id: string): Bar[] { hourly(id); return candles.get(id.toUpperCase())?.bars ?? [] }
