// Public share pages: /cv/<username>?d=<profile> and /cert/<id>. Serves OG/Twitter meta, then opens the game.
type Req = { query: Record<string, string | undefined>; url?: string }
type Res = { setHeader(k: string, v: string): void; status(n: number): { send(b: string): void } }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function decodeCert(id: string): { n?: string; u?: string; r?: string; t?: string; d?: string } {
  try {
    return JSON.parse(Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

import { getProfile } from './_profile.js'

export default async function handler(req: Req, res: Res) {
  const kind = req.query.kind === 'cert' ? 'cert' : 'cv'
  const origin = 'https://grinddistrict.vercel.app'
  let title = 'Grind District'
  let desc = 'A shared 3D city. No tribe, no continent, just come and grind.'
  let heading = title
  let sub = ''
  if (kind === 'cert') {
    const c = decodeCert(String(req.query.id ?? ''))
    heading = `${c.t ?? 'Course'} certificate`
    sub = `${c.n ?? ''} (@${c.u ?? ''}) · ${c.r ?? ''} · ${c.d ?? ''}`
    title = `${heading} · ${c.n ?? 'Player'} · Grind District`
    desc = `${c.n ?? 'A player'} passed ${c.t ?? 'a course'} in Grind District.`
  } else {
    const u = String(req.query.username ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
    const p = await getProfile(u).catch(() => null)
    heading = p?.name ? `${p.name} (@${u})` : `@${u} · Grind District`
    title = `${p?.name || `@${u}`} is grinding in Grind District`
    desc = p ? `${p.rank} · reputation ${p.reputation}. Join @${u} in a shared 3D city.` : `Join @${u} in a shared 3D city. Learn, trade and climb from shrimp to whale.`
    if (p?.skills.length) sub = `${desc} Skills: ${p.skills.slice(0, 4).join(', ')}`
  }
  const ref = kind === 'cv' ? String(req.query.username ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) : ''
  const image = kind === 'cv' ? `${origin}/api/og?u=${ref}` : `${origin}/og-image.png`
  const game = `${origin}/?src=${ref ? 'invite' : kind}${ref ? `&ref=${ref}` : ''}`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${kind === 'cv' ? `${origin}/cv/${ref}` : `${origin}${esc(req.url ?? '')}`}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,system-ui,sans-serif;background:#0b0a08;color:#f2ece0;display:grid;place-items:center;min-height:100vh}
main{max-width:640px;padding:32px;border:1px solid #c9a25e;border-radius:18px;background:#15130f;margin:24px}h1{margin:.2em 0}p{color:#bdb3a3}
a.btn{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:999px;background:#f5f5f7;color:#111;text-decoration:none;font-weight:600}
section{margin-top:24px;border-top:1px solid #2a251d;padding-top:16px}</style></head>
<body><main><img src="/brand/lockup.png" alt="Grind District" width="120"><h1>${esc(heading)}</h1><p>${esc(sub || desc)}</p>
<a class="btn" href="${game}">Open Grind District</a>
<section><h2>Endorsements</h2><p>Reviews and endorsements are coming soon.</p></section></main></body></html>`
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', 'public, max-age=300')
  res.status(200).send(html)
}
