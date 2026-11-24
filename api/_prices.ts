// Live prices for the trading centre (src/livePrices.ts), served at /api/track?op=prices and ?op=candles through
// the track function (the Hobby plan allows 12 functions). Source: Coinbase's public exchange API (no key): last,
// 24-hour open, high and low per coin, and hourly closes for a coin's 48-hour chart. Cached at the edge for a few
// seconds, so however many players have the screen open, Coinbase sees a handful of requests. Nothing about any
// player passes through this function. Trades in the game stay practice trades with in-game money.
type Res = { status(n: number): { json(b: unknown): void }; setHeader?: (k: string, v: string) => void }
type Req = { method?: string; query?: Record<string, string | string[] | undefined> }

/** The coins the game lists (ids in src/logic.ts COINS), as Coinbase product symbols. */
export const LIVE_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'LINK', 'AVAX', 'DOT', 'NEAR', 'SUI', 'DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'ADA', 'LTC', 'BCH', 'UNI', 'AAVE', 'ATOM', 'ARB', 'OP', 'APT', 'FIL', 'XLM', 'HBAR', 'ICP', 'ETC', 'POL', 'INJ'] as const

const get = async (url: string, ms = 5000): Promise<unknown> => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms)
  try { const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json', 'user-agent': 'GrindDistrictPrices/1.0' } }); return r.ok ? await r.json() : null } catch { return null } finally { clearTimeout(t) }
}
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }

export async function pricesHandler(req: Req, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  if (req.query?.op === 'candles') {
    const s = String(req.query?.s ?? '').toUpperCase()
    if (!(LIVE_SYMBOLS as readonly string[]).includes(s)) return res.status(400).json({ error: 'unknown coin' })
    const raw = await get(`https://api.exchange.coinbase.com/products/${s}-USD/candles?granularity=3600`)
    // Coinbase returns [time, low, high, open, close, volume], newest first.
    const closes = Array.isArray(raw) ? (raw as unknown[][]).slice(0, 48).reverse().map((c) => num(c[4])).filter((v) => v > 0) : []
    // The same hourly candles as [time (s), open, high, low, close] for the candlestick chart: up to 120 hours.
    const ohlc = Array.isArray(raw) ? (raw as unknown[][]).slice(0, 120).reverse()
      .map((c) => [Math.floor(Number(c[0])), num(c[3]), num(c[2]), num(c[1]), num(c[4])])
      .filter((k) => k[0]! > 0 && k[1]! > 0 && k[2]! > 0 && k[3]! > 0 && k[4]! > 0) : []
    res.setHeader?.('cache-control', closes.length ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' : 'no-store')
    return res.status(closes.length ? 200 : 502).json({ s, closes, ohlc })
  }
  const rows = await Promise.all(LIVE_SYMBOLS.map(async (s) => {
    const j = (await get(`https://api.exchange.coinbase.com/products/${s}-USD/stats`)) as { open?: string; high?: string; low?: string; last?: string } | null
    const last = num(j?.last)
    return last ? { s, last, open: num(j?.open) || last, high: num(j?.high) || last, low: num(j?.low) || last } : null
  }))
  const coins = rows.filter(Boolean)
  res.setHeader?.('cache-control', coins.length ? 'public, max-age=5, s-maxage=10, stale-while-revalidate=60' : 'no-store')
  return res.status(coins.length ? 200 : 502).json({ at: new Date().toISOString(), src: 'Coinbase', coins })
}
