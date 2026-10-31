import { ImageResponse } from '@vercel/og'

// GET /api/og?u=<username>: 1200x630 share card. Dark, gold accents, city skyline, logo.

type P = { username: string; name: string; rank: string; reputation: number; balance: number; pinned?: string[] }
async function getProfile(raw: string): Promise<P | null> {
  const u = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!u || !url || !key) return null
  const r = await fetch(`${url}/rest/v1/public_profiles?username=eq.${u}&select=username,name,rank,reputation,balance,pinned`, { headers: { apikey: key, authorization: `Bearer ${key}` } })
  const rows = r.ok ? ((await r.json()) as P[]) : []
  return rows[0] ? { ...rows[0], balance: Number(rows[0].balance) } : null
}
type El = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, ...children: Array<El | string>): El => ({ type, props: { style: { display: 'flex', ...style }, children } })
const ORIGIN = 'https://grinddistrict.vercel.app'
const GOLD = '#c9a25e'

function skyline(): El {
  const towers: El[] = []
  const hs = [140, 220, 180, 300, 160, 250, 200, 340, 190, 260, 150, 230, 290, 170, 210, 320, 180, 240]
  hs.forEach((ht, i) => {
    const lit: El[] = []
    for (let r = 0; r < Math.floor(ht / 34); r += 1) lit.push(h('div', { width: 30, height: 4, marginTop: 26, marginLeft: 12, background: (i * 7 + r * 3) % 5 === 0 ? 'rgba(201,162,94,0.55)' : 'rgba(242,236,224,0.08)' }))
    towers.push(h('div', { width: 54, height: ht, marginLeft: 12, background: i % 2 ? '#1b1a17' : '#211f1b', borderTop: `2px solid ${i % 3 === 0 ? 'rgba(201,162,94,0.5)' : '#2c2923'}`, flexDirection: 'column' }, ...lit))
  })
  return h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, alignItems: 'flex-end', opacity: 0.9 }, ...towers)
}

export async function GET(req: Request): Promise<Response> {
  const u = new URL(req.url, ORIGIN).searchParams.get('u') ?? ''
  const p = await getProfile(u).catch(() => null)
  const name = p?.name || (u ? 'Player profile' : 'Grind District')
  const handle = p ? `@${p.username}` : u ? `@${u.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)}` : 'A shared 3D city'
  const stat = (k: string, v: string) => h('div', { flexDirection: 'column', marginRight: 56 }, h('div', { fontSize: 22, color: '#9c927f', letterSpacing: 3 }, k.toUpperCase()), h('div', { fontSize: 44, color: '#f2ece0', marginTop: 6 }, v))
  const tree = h('div', { width: 1200, height: 630, position: 'relative', background: 'linear-gradient(180deg, #0b0a08 0%, #14120e 60%, #0b0a08 100%)', fontFamily: 'sans-serif' },
    skyline(),
    h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, background: 'linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0.85) 100%)' }),
    h('div', { position: 'absolute', left: 64, top: 56, right: 64, bottom: 56, flexDirection: 'column', border: `1px solid rgba(201,162,94,0.45)`, borderRadius: 24, padding: 48 },
      h('div', { alignItems: 'center' },
        { type: 'img', props: { src: "https://grind-district.vercel.app/brand/logo-black.jpg", width: 150, height: 100, style: { borderRadius: 14, objectFit: 'cover' } } },
        h('div', { marginLeft: 24, fontSize: 26, color: GOLD, letterSpacing: 6 }, 'GRIND DISTRICT')),
      h('div', { fontSize: 72, color: '#f2ece0', marginTop: 36, fontWeight: 700 }, name.slice(0, 28)),
      h('div', { fontSize: 32, color: GOLD, marginTop: 4 }, handle),
      ...(p?.pinned?.length ? [h('div', { marginTop: 22, flexWrap: 'wrap' }, ...p.pinned.slice(0, 3).map((t) => h('div', { fontSize: 22, color: '#e6dcc8', border: '1px solid rgba(201,162,94,0.5)', borderRadius: 999, padding: '8px 18px', marginRight: 12 }, `✓ ${t}`)))] : []),
      h('div', { marginTop: 'auto' }, ...(p ? [stat('Rank', p.rank || 'Shrimp'), stat('Reputation', String(p.reputation)), stat('Balance', `$${p.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`)] : [h('div', { fontSize: 32, color: '#d8cfbf' }, 'Learn, trade and climb from shrimp to whale.')]))))
  return new ImageResponse(tree as never, { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=300, s-maxage=300' } })
}
