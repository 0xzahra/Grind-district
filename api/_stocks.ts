// The tokenized stocks on Base, for the Stockholders' Club (src/stockClub.ts). Served at /api/stocks through the track
// function (vercel.json rewrite: the Hobby plan allows 12 functions). Coinbase publishes the list through a
// public, read-only API with no key, but it sends no CORS header, so the browser reads it through here. The list
// is trimmed to what the club uses and cached at the edge for ten minutes. Nothing about any player passes
// through this function.
type Res = { status(n: number): { json(b: unknown): void }; setHeader?: (k: string, v: string) => void }
type Upstream = {
  contract_address?: string
  symbol?: string
  name?: string
  decimals?: number
  multiplier?: number
  nav_price?: number
  nav_price_updated_at?: string
  isin?: string
  icon_url?: string
  description?: string
  paused_features?: number[]
}

const SOURCE = 'https://api.coinbase.com/v1/tokenized-stocks'

export async function stocksHandler(req: { method?: string }, res: Res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  try {
    const tokens: Upstream[] = []
    let page = ''
    for (let i = 0; i < 6; i++) {
      const url = new URL(SOURCE)
      url.searchParams.set('page_size', '500')
      if (page) url.searchParams.set('page_token', page)
      const r = await fetch(url, { headers: { accept: 'application/json' } })
      if (!r.ok) throw new Error(`upstream ${r.status}`)
      const j = (await r.json()) as { tokens?: Upstream[]; next_page_token?: string }
      tokens.push(...(j.tokens ?? []))
      page = j.next_page_token ?? ''
      if (!page) break
    }
    const slim = tokens
      .filter((t) => /^0x[0-9a-fA-F]{40}$/.test(t.contract_address ?? '') && t.symbol && Number.isFinite(t.decimals))
      .map((t) => ({
        s: t.symbol,
        n: t.name ?? t.symbol,
        a: t.contract_address,
        d: t.decimals,
        m: Number.isFinite(t.multiplier) && (t.multiplier as number) > 0 ? t.multiplier : 1,
        nav: Number.isFinite(t.nav_price) ? t.nav_price : null,
        navAt: t.nav_price_updated_at ?? null,
        isin: t.isin ?? null,
        icon: t.icon_url ?? null,
        desc: (t.description ?? '').slice(0, 1800),
        paused: Array.isArray(t.paused_features) ? t.paused_features : [],
      }))
    res.setHeader?.('cache-control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600')
    return res.status(200).json({ at: new Date().toISOString(), source: SOURCE, tokens: slim })
  } catch {
    return res.status(502).json({ error: 'The stock list is not available right now.' })
  }
}
