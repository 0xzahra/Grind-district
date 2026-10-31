import { ImageResponse } from '@vercel/og'
import { getProfile } from './_profile.js'

// GET /api/og?u=<username>: 1200x630 share card. Dark, gold accents, city skyline, logo.
export const config = { runtime: 'nodejs' }
type El = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, ...children: Array<El | string>): El => ({ type, props: { style: { display: 'flex', ...style }, children } })
const ORIGIN = 'https://grind-district.vercel.app'
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

export default async function handler(req: { url?: string }, res: { setHeader(k: string, v: string): void; status(n: number): { send(b: Buffer): void } }) {
  const u = new URL(req.url ?? '/', ORIGIN).searchParams.get('u') ?? ''
  const p = await getProfile(u).catch(() => null)
  const name = p?.name || (u ? `@${u}` : 'Grind District')
  const handle = p ? `@${p.username}` : u ? `@${u.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)}` : 'A shared 3D city'
  const stat = (k: string, v: string) => h('div', { flexDirection: 'column', marginRight: 56 }, h('div', { fontSize: 22, color: '#9c927f', letterSpacing: 3 }, k.toUpperCase()), h('div', { fontSize: 44, color: '#f2ece0', marginTop: 6 }, v))
  const tree = h('div', { width: 1200, height: 630, position: 'relative', background: 'linear-gradient(180deg, #0b0a08 0%, #14120e 60%, #0b0a08 100%)', fontFamily: 'sans-serif' },
    skyline(),
    h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 360, background: 'linear-gradient(180deg, rgba(11,10,8,0) 0%, rgba(11,10,8,0.85) 100%)' }),
    h('div', { position: 'absolute', left: 64, top: 56, right: 64, bottom: 56, flexDirection: 'column', border: `1px solid rgba(201,162,94,0.45)`, borderRadius: 24, padding: 48 },
      h('div', { alignItems: 'center' },
        { type: 'img', props: { src: `${ORIGIN}/brand/logo-black.jpg`, width: 150, height: 100, style: { borderRadius: 14, objectFit: 'cover' } } },
        h('div', { marginLeft: 24, fontSize: 26, color: GOLD, letterSpacing: 6 }, 'GRIND DISTRICT')),
      h('div', { fontSize: 72, color: '#f2ece0', marginTop: 36, fontWeight: 700 }, name.slice(0, 28)),
      h('div', { fontSize: 32, color: GOLD, marginTop: 4 }, handle),
      h('div', { marginTop: 'auto' }, ...(p ? [stat('Rank', p.rank || 'Shrimp'), stat('Reputation', String(p.reputation)), stat('Balance', `$${p.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`)] : [h('div', { fontSize: 32, color: '#d8cfbf' }, 'Learn, trade and climb from shrimp to whale.')]))))
  const img = new ImageResponse(tree as never, { width: 1200, height: 630 })
  const buf = Buffer.from(await img.arrayBuffer())
  res.setHeader('content-type', 'image/png')
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=300')
  res.status(200).send(buf)
}
