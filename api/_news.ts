// Live market and crypto news for the TVs in the game (src/marketNews.ts). Served at /api/track?op=news through the
// track function (the Hobby plan allows 12 functions). Prices: Coinbase's public exchange API (no key): last price
// and 24-hour change for a few coins, and BTC's hourly closes for a 48-hour chart. Headlines: the public RSS feeds of
// Cointelegraph, CoinDesk and a Google News search for crypto (crypto) and a Google News search for the stock market over the last day (markets),
// titles and source only, each linked to the original; nothing older than three days. Cached at the edge for five minutes. Nothing about any player passes through this function.
type Res = { status(n: number): { json(b: unknown): void }; setHeader?: (k: string, v: string) => void }

const COINS = ['BTC', 'ETH', 'SOL', 'NEAR', 'XRP']
const CRYPTO_FEEDS: Array<[string, string]> = [['Cointelegraph', 'https://cointelegraph.com/rss'], ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'], ['', 'https://news.google.com/rss/search?q=crypto+bitcoin+when:1d&hl=en-US&gl=US&ceid=US:en']]
const MARKET_FEEDS: Array<[string, string]> = [['', 'https://news.google.com/rss/search?q=stock+market+when:1d&hl=en-US&gl=US&ceid=US:en']]

const get = async (url: string, ms = 6000): Promise<Response | null> => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms)
  try { const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; GrindDistrictNews/1.0)', accept: '*/*' } }); return r.ok ? r : null } catch { return null } finally { clearTimeout(t) }
}
const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

async function feed(src: string, url: string): Promise<Array<{ t: string; src: string; at: number; url: string }>> {
  const r = await get(url)
  if (!r) return []
  const xml = await r.text()
  const out: Array<{ t: string; src: string; at: number; url: string }> = []
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/g)) {
    const item = m[0]
    let t = decode(/<title>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? '')
    // News searches name the outlet in <source> and at the end of the title ('Headline - Outlet').
    let from = src || decode(/<source[^>]*>([\s\S]*?)<\/source>/.exec(item)?.[1] ?? '')
    if (!src) { const cut = t.lastIndexOf(' - '); if (cut > 20) { from = from || t.slice(cut + 3); t = t.slice(0, cut) } }
    const link = decode(/<link>([\s\S]*?)<\/link>/.exec(item)?.[1] ?? '')
    const at = Date.parse(decode(/<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)?.[1] ?? '')) || 0
    const fresh = !at || Date.now() - at < 3 * 86400_000
    if (t && t.length > 8 && fresh) out.push({ t: t.slice(0, 160), src: from.slice(0, 40), at, url: /^https:\/\//.test(link) ? link : '' })
    if (out.length >= 12) break
  }
  return out
}

async function coin(sym: string): Promise<{ s: string; last: number; chg: number } | null> {
  const r = await get(`https://api.exchange.coinbase.com/products/${sym}-USD/stats`, 5000)
  if (!r) return null
  const j = (await r.json().catch(() => null)) as { open?: string; last?: string } | null
  const last = Number(j?.last), open = Number(j?.open)
  return Number.isFinite(last) && last > 0 ? { s: sym, last, chg: open > 0 ? ((last - open) / open) * 100 : 0 } : null
}

export async function newsHandler(req: { method?: string }, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const [coins, candles, crypto, markets] = await Promise.all([
    Promise.all(COINS.map((s) => coin(s))),
    get('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=3600', 5000).then((r) => (r ? r.json() : null)).catch(() => null),
    Promise.all(CRYPTO_FEEDS.map(([s, u]) => feed(s, u))),
    Promise.all(MARKET_FEEDS.map(([s, u]) => feed(s, u))),
  ])
  const byTime = (a: { at: number }, b: { at: number }) => b.at - a.at
  const btc48 = Array.isArray(candles) ? (candles as number[][]).slice(0, 48).reverse().map((c) => Number(c[4])).filter((v) => Number.isFinite(v)) : []
  const body = {
    at: new Date().toISOString(),
    coins: coins.filter(Boolean),
    btc48,
    crypto: crypto.flat().sort(byTime).slice(0, 10),
    markets: markets.flat().sort(byTime).slice(0, 8),
  }
  const empty = !body.coins.length && !body.crypto.length && !body.markets.length
  res.setHeader?.('cache-control', empty ? 'no-store' : 'public, max-age=120, s-maxage=300, stale-while-revalidate=900')
  return res.status(empty ? 502 : 200).json(body)
}
