// Live market and crypto news for the TVs (tv.ts): prices, a 48-hour BTC line and real headlines, fetched from
// /api/track?op=news (api/_news.ts) at most every five minutes while a TV is on. Read-only; nothing is sent.
export type Headline = { t: string; src: string; at: number; url: string }
export type LiveNews = { at: string; coins: Array<{ s: string; last: number; chg: number }>; btc48: number[]; crypto: Headline[]; markets: Headline[] }

let live: LiveNews | null = null
let last = 0
let busy = false

/** The latest news, or null until the first fetch lands (or if the feed is unavailable). */
export const liveNews = (): LiveNews | null => live

/** Fetch if the copy is older than five minutes (or never fetched). Cheap to call every frame. */
export function ensureNews(): void {
  const now = Date.now()
  if (busy || now - last < (live ? 300_000 : 60_000)) return
  busy = true; last = now
  void fetch('/api/track?op=news').then((r) => (r.ok ? r.json() : null)).then((j: LiveNews | null) => {
    if (j && (j.coins?.length || j.crypto?.length || j.markets?.length)) live = j
  }).catch(() => undefined).finally(() => { busy = false })
}

/** '12m ago', '3h ago', '2d ago'. */
export function ago(at: number): string {
  if (!at) return ''
  const m = Math.max(1, Math.round((Date.now() - at) / 60_000))
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}

export const fmtPrice = (v: number) => (v >= 1000 ? `$${Math.round(v).toLocaleString('en-US')}` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`)
