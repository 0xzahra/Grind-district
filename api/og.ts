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

/** A phone notification's big picture (1024 x 512): Zahra beside the message, in the game's colours. Android shows
 *  it under the title when the notification is opened; it is cached hard, as the same words make the same picture. */
function notePicture(q: URLSearchParams): Response {
  const title = (q.get('t') ?? 'Grind District').slice(0, 70)
  const body = (q.get('b') ?? '').slice(0, 120)
  const cta = (q.get('c') ?? 'Tap to play').slice(0, 24)
  const tree = h('div', { width: 1024, height: 512, position: 'relative', background: 'linear-gradient(135deg, #07130d 0%, #0f2419 50%, #183626 100%)', fontFamily: 'sans-serif', overflow: 'hidden' },
    // A warm light behind Zahra, and a thin gold line along the foot.
    h('div', { position: 'absolute', left: -80, top: 40, width: 520, height: 520, borderRadius: 260, background: 'radial-gradient(circle, rgba(233,207,142,0.38) 0%, rgba(233,207,142,0.08) 55%, rgba(233,207,142,0) 70%)' }),
    h('div', { position: 'absolute', left: 0, bottom: 0, width: 1024, height: 6, background: 'linear-gradient(90deg, #b8923f 0%, #e9cf8e 50%, #b8923f 100%)' }),
    { type: 'img', props: { src: `${ORIGIN}/notify/zahra.png`, width: 262, height: 512, style: { position: 'absolute', left: 70, top: 22 } } },
    h('div', { position: 'absolute', left: 390, top: 46, width: 590, height: 420, flexDirection: 'column', justifyContent: 'center' },
      { type: 'img', props: { src: `${ORIGIN}/brand/logo-new.png`, width: 150, height: 93, style: { marginBottom: 22 } } },
      h('div', { fontSize: title.length > 34 ? 46 : 54, fontWeight: 800, color: '#f7f3ea', lineHeight: 1.12 }, title),
      ...(body ? [h('div', { fontSize: 27, color: '#c3cec7', marginTop: 16, lineHeight: 1.35 }, body)] : []),
      h('div', { marginTop: 28 },
        h('div', { padding: '14px 30px', borderRadius: 999, background: 'linear-gradient(180deg, #3bfaa4 0%, #12d77c 100%)', color: '#04160e', fontSize: 26, fontWeight: 800 }, cta))))
  return new ImageResponse(tree as never, { width: 1024, height: 512, headers: { 'cache-control': 'public, max-age=86400, s-maxage=604800, immutable' } })
}

/** The live city stats as a 1200 x 630 link preview for /s/stats: the city photo, the logo, the headline figures
 *  and a call to play. Counts only (the same public numbers as the Online card); refreshed every hour. */
async function statsPicture(): Promise<Response> {
  type S = { activeToday?: number; visitorsAll?: number; learners?: number; lessonsPassed?: number; certificates?: number; registered?: number }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000)
  const st = await fetch(`${ORIGIN}/api/track?op=stats`, { signal: ctl.signal }).then((r) => (r.ok ? (r.json() as Promise<S>) : null)).catch(() => null)
  clearTimeout(t)
  const k = (v: number | undefined) => { const x = Math.max(0, Math.round(Number(v) || 0)); return x >= 10000 ? `${(x / 1000).toFixed(x >= 100000 ? 0 : 1)}k` : x.toLocaleString('en-US') }
  const tiles: Array<[string, string]> = st ? ([
    ['Visitors', st.visitorsAll], ['Active today', st.activeToday], ['Learners', st.learners],
    ['Courses passed', st.lessonsPassed], ['Certificates', st.certificates], ['Players', st.registered],
  ] as Array<[string, number | undefined]>).filter(([, v]) => typeof v === 'number').slice(0, 6).map(([l, v]) => [l, k(v)]) : []
  const facts: Array<[string, string]> = [['To play', 'Free'], ['Live city', '24/7'], ['Web3 CV', 'Yours']]
  const show = tiles.length >= 3 ? tiles : [...tiles, ...facts].slice(0, 3)
  const tile = ([label, value]: [string, string], i: number) => h('div', { width: 172, height: 128, flexDirection: 'column', justifyContent: 'center', padding: '0 20px', borderRadius: 22, background: 'rgba(255,255,255,0.09)', border: `2px solid ${i === 0 ? 'rgba(59,250,164,0.55)' : 'rgba(233,207,142,0.42)'}` },
    h('div', { fontSize: value.length > 5 ? 38 : 46, fontWeight: 800, color: i === 0 ? '#3bfaa4' : GOLD }, value),
    h('div', { fontSize: 17, color: 'rgba(247,243,234,0.78)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }, label))
  const tree = h('div', { width: 1200, height: 630, position: 'relative', background: '#07130d', fontFamily: 'sans-serif', overflow: 'hidden' },
    { type: 'img', props: { src: `${ORIGIN}/brand/title-l.jpg`, width: 1200, height: 630, style: { position: 'absolute', left: 0, top: 0, objectFit: 'cover' } } },
    h('div', { position: 'absolute', left: 0, top: 0, width: 1200, height: 630, background: 'linear-gradient(90deg, rgba(4,12,8,0.94) 0%, rgba(4,12,8,0.82) 55%, rgba(4,12,8,0.7) 100%)' }),
    h('div', { position: 'absolute', left: 18, top: 18, width: 1164, height: 594, borderRadius: 30, border: '3px solid rgba(233,207,142,0.75)' }),
    h('div', { position: 'absolute', left: 64, top: 56, width: 480, height: 520, flexDirection: 'column' },
      { type: 'img', props: { src: `${ORIGIN}/brand/logo-new.png`, width: 210, height: 130 } },
      h('div', { marginTop: 30, fontSize: 58, fontWeight: 800, color: '#f7f3ea', lineHeight: 1.08 }, 'A whole city learning Web3.'),
      h('div', { marginTop: 16, fontSize: 25, color: '#c3cec7' }, 'Live city stats · free to play in your browser'),
      h('div', { marginTop: 'auto' },
        h('div', { padding: '16px 32px', borderRadius: 999, background: 'linear-gradient(180deg, #3bfaa4 0%, #12d77c 100%)', color: '#04160e', fontSize: 27, fontWeight: 800 }, 'Play free at grinddistrict.app'))),
    h('div', { position: 'absolute', left: 590, top: 70, width: 560, flexWrap: 'wrap', gap: 14 },
      h('div', { width: 560, alignItems: 'center', marginBottom: 6 },
        h('div', { width: 14, height: 14, borderRadius: 7, background: '#3bfaa4', marginRight: 10 }),
        h('div', { fontSize: 22, fontWeight: 800, color: '#f7f3ea', letterSpacing: 2 }, 'LIVE CITY STATS')),
      ...show.map(tile)))
  // Live numbers keep for an hour; the fallback (the numbers did not load in time) only for a minute.
  return new ImageResponse(tree as never, { width: 1200, height: 630, headers: { 'cache-control': tiles.length >= 3 ? 'public, max-age=600, s-maxage=3600' : 'public, max-age=60, s-maxage=60' } })
}

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url, ORIGIN).searchParams
  if (q.get('kind') === 'note') return notePicture(q)
  if (q.get('kind') === 'stats') return statsPicture()
  const u = clean(q.get('u') ?? '')
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
