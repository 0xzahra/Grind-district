import { ImageResponse } from '@vercel/og'
import qrcode from 'qrcode-generator'

// GET /api/og?u=<username>: the 1200x630 link preview for /cv/<username> on X and other apps.
// First choice: the player's own invite photo card (avatar, name, rank, reputation, invite code), drawn in the game
// and stored by POST /api/referrals?op=card. Without one: the same card layout drawn here, with the logo in place
// of the avatar. Never a balance, holdings or wallet.

type P = { username: string; name: string; rank: string; reputation: number }
const clean = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
async function getProfile(u: string): Promise<P | null> {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!u || !url || !key) return null
  const r = await fetch(`${url}/rest/v1/public_profiles?username=eq.${u}&select=username,name,rank,reputation`, { headers: { apikey: key, authorization: `Bearer ${key}` } })
  const rows = r.ok ? ((await r.json()) as P[]) : []
  return rows[0] ?? null
}
/** The card the player made in the game, if there is one. */
async function storedCard(u: string): Promise<ArrayBuffer | null> {
  const url = process.env.SUPABASE_URL
  if (!u || !url) return null
  const r = await fetch(`${url}/storage/v1/object/public/invite-cards/${u}.jpg`).catch(() => null)
  if (!r?.ok || !(r.headers.get('content-type') ?? '').includes('image')) return null
  return r.arrayBuffer()
}
type El = { type: string; props: Record<string, unknown> }
const h = (type: string, style: Record<string, unknown>, ...children: Array<El | string>): El => ({ type, props: { style: { display: 'flex', ...style }, children } })
const ORIGIN = 'https://www.grinddistrict.app'
const GOLD = '#e9cf8e'

/** The invite code as an SVG image (black on white, four-module quiet zone). */
function qrImg(link: string, size: number): El {
  const q = qrcode(0, 'M'); q.addData(link); q.make()
  const n = q.getModuleCount(), m = 4, all = n + m * 2
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${all} ${all}" shape-rendering="crispEdges"><rect width="${all}" height="${all}" fill="#fff"/><path d="${d}" fill="#0b100d"/></svg>`
  return { type: 'img', props: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: size, height: size, style: { borderRadius: 14 } } }
}
const inviteLink = (u: string) => `${ORIGIN}/?src=invite${u ? `&ref=${u}` : ''}`

export async function GET(req: Request): Promise<Response> {
  const u = clean(new URL(req.url, ORIGIN).searchParams.get('u') ?? '')
  const card = await storedCard(u).catch(() => null)
  if (card) return new Response(card, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=300, s-maxage=300' } })
  const p = await getProfile(u).catch(() => null)
  const name = p?.name || (u ? 'Player profile' : 'Grind District')
  const handle = p ? `@${p.username}` : u ? `@${u}` : 'A shared 3D city'
  const line = [handle, p?.rank].filter(Boolean).join(' · ')
  const tree = h('div', { width: 1200, height: 630, position: 'relative', background: 'radial-gradient(circle at 300px 300px, #fdfbf7 0%, #efe9df 45%, #cfc5b6 100%)', fontFamily: 'sans-serif' },
    h('div', { position: 'absolute', left: 60, top: 60, width: 470, height: 510, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
      { type: 'img', props: { src: `${ORIGIN}/brand/logo-black.jpg`, width: 330, height: 220, style: { borderRadius: 28, objectFit: 'cover', boxShadow: '0 18px 40px rgba(40,30,20,0.28)' } } },
      h('div', { marginTop: 34, fontSize: 30, color: '#2a2418', letterSpacing: 6, fontWeight: 700 }, 'GRIND DISTRICT'),
      h('div', { marginTop: 10, fontSize: 24, color: '#6a5e4e' }, 'Learn Web3 by living it')),
    h('div', { position: 'absolute', left: 580, top: 40, width: 580, height: 550, flexDirection: 'column', padding: '44px 44px', borderRadius: 36, background: 'linear-gradient(180deg, #16201b 0%, #0b100d 100%)', border: '3px solid rgba(214,178,94,0.7)' },
      h('div', { fontSize: 60, fontWeight: 800, color: '#f5f2ea' }, name.slice(0, 18)),
      h('div', { fontSize: 30, color: '#b9c2bb', marginTop: 6 }, line),
      ...(p ? [h('div', { fontSize: 34, color: GOLD, marginTop: 14, fontWeight: 700 }, `Reputation ${p.reputation}`)] : []),
      h('div', { marginTop: 'auto', alignItems: 'flex-end', justifyContent: 'space-between' },
        h('div', { flexDirection: 'column', width: 220 }, h('div', { fontSize: 30, color: '#f5f2ea', fontWeight: 700 }, 'Scan to join me'), h('div', { fontSize: 22, color: '#b9c2bb', marginTop: 8 }, 'grinddistrict.app')),
        qrImg(inviteLink(u), 232))))
  return new ImageResponse(tree as never, { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=300, s-maxage=300' } })
}
