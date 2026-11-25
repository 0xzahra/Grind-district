// Public share pages: /cv/<username>?d=<profile> and /cert/<id>. Serves OG/Twitter meta, then opens the game.
// /cert/<id>/image.png renders the certificate (same art as the game); /cert/<id>/meta.json is the NFT metadata.
type Req = { query: Record<string, string | undefined>; url?: string; headers?: Record<string, string | string[] | undefined> }
type Res = { setHeader(k: string, v: string): void; status(n: number): { send(b: string | Buffer): void } }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

import { getProfile } from './_profile.js'
import { certMetadata, issuedWat, issuedIso, certPageUrl, CERT_ORIGIN, CERT_WORDING, CERT_W, CERT_H, type CertChain, type CertData } from './_certArt.js'
import { findCert, rowData, certDb, type CertRow } from './_certStore.js'
import { countPageView } from './_stats.js'
import { FLYER_PAGES } from './_posters.js'

/** A certificate is shown only from its server record; anything else (edited, made-up or unknown) is not valid. */
async function certFor(key: string): Promise<{ row: CertRow; d: CertData } | null> {
  const db = certDb()
  if (!key || key.length > 1024 || !db) return null
  const row = await findCert(db, key).catch(() => null)
  return row ? { row, d: rowData(row) } : null
}

const ORIGIN = CERT_ORIGIN

async function certAsset(req: Req, res: Res, kind: 'certpng' | 'certmeta') {
  const rec = await certFor(String(req.query.id ?? ''))
  if (!rec) { res.setHeader('content-type', 'text/plain'); res.setHeader('cache-control', 'no-store'); return res.status(404).send('not a valid certificate') }
  const { d } = rec, id = rec.row.cert_id
  if (kind === 'certmeta') {
    const chain = req.query.chain === 'base' || req.query.chain === 'near' ? (req.query.chain as CertChain) : undefined
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400')
    return res.status(200).send(JSON.stringify(certMetadata(id, d, chain)))
  }
  const w = Math.max(300, Math.min(CERT_W, Number(req.query.w) || CERT_W))
  try {
    const { renderCertPng } = await import('./_certRender.js')
    const png = await renderCertPng(d, id, w)
    res.setHeader('content-type', 'image/png')
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('cache-control', 'public, max-age=3600, s-maxage=86400')
    return res.status(200).send(png)
  } catch (e) {
    console.error('cert render', e)
    res.setHeader('cache-control', 'no-store')
    res.setHeader('location', `${ORIGIN}/og-image.png`)
    return res.status(302).send('')
  }
}

/** /s/stats and /p/<flyer>: a page whose link preview is the shared picture (the live city stats card, or the
 *  poster itself), with a key into the game. Posts on X and Farcaster show the picture from these. */
function sharePage(req: Req, res: Res) {
  const origin = ORIGIN
  let title = 'Grind District · live city stats', desc = 'A whole city is learning Web3, live. Free to play in your browser, on a phone or a computer.'
  let image = `${origin}/api/og?kind=stats&h=${Math.floor(Date.now() / 3_600_000)}`, imgW = 1200, imgH = 630, pageUrl = `${origin}/s/stats`, src = 'stats'
  if (req.query.kind === 'poster') {
    const id = String(req.query.id ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48)
    const f = FLYER_PAGES[id]
    if (!f) { res.setHeader('cache-control', 'no-store'); res.setHeader('location', `${origin}/?src=poster`); return res.status(302).send('') }
    title = `${f.title} · Grind District`; desc = `${f.text} A free 3D city where you learn Web3.`
    image = `${origin}/posters/${id}.jpg`; pageUrl = `${origin}/p/${id}`; src = 'poster'
  }
  const game = `${origin}/?src=${src}`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="${imgW}"><meta property="og:image:height" content="${imgH}"><meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 30% 0%,#183626,#07130d 60%);color:#f7f3ea;font-family:-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif}
main{max-width:760px;margin:24px;padding:20px;border-radius:24px;border:1px solid #e9cf8e66;background:#0b120ecc;text-align:center}
img.pic{display:block;width:100%;height:auto;border-radius:14px;box-shadow:0 14px 40px #0008}h1{font-size:24px;margin:18px 0 6px}p{color:#c3cec7;margin:0 0 16px}
a.btn{display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(180deg,#3bfaa4,#12d77c);color:#04160e;font-weight:800;text-decoration:none}</style></head>
<body><main><img class="pic" src="${esc(image)}" alt="${esc(title)}" width="${imgW}" height="${imgH}"><h1>${esc(title)}</h1><p>${esc(desc)}</p><a class="btn" href="${esc(game)}">Play Grind District free</a></main></body></html>`
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', 'public, max-age=300, s-maxage=600')
  return res.status(200).send(html)
}

export default async function handler(req: Req, res: Res) {
  if (req.query.kind === 'stats' || req.query.kind === 'poster') return sharePage(req, res)
  if (req.query.kind === 'certpng' || req.query.kind === 'certmeta') return certAsset(req, res, req.query.kind)
  const kind = req.query.kind === 'cert' ? 'cert' : 'cv'
  const origin = ORIGIN
  let title = 'Grind District'
  let desc = 'Live a Web3 life. Build proof that travels with you. City · Career · Skills · CV.'
  let heading = title
  let sub = ''
  let image = `${origin}/og-image-v3.png`
  let imgW = 1200, imgH = 630
  let body = ''
  let valid = true
  if (kind === 'cert') {
    const rec = await certFor(String(req.query.id ?? ''))
    const c = rec?.d, id = rec?.row.cert_id ?? ''
    if (rec && c) {
      heading = `${c.t} certificate`
      title = `${heading} · ${c.n || `@${c.u}`} · Grind District`
      desc = `${c.n || 'A player'} (@${c.u}) passed ${c.t} in Grind District on ${issuedWat(c)}.`
      image = `${origin}/cert/${id}/image.png?w=1200`
      imgW = 1200; imgH = Math.round((1200 * CERT_H) / CERT_W)
      const { mintedOnBase, mintedOnNear } = await import('./_certChain.js')
      const minted = (await Promise.all([mintedOnBase(c.u, c.c).catch(() => null), mintedOnNear(c.u, c.c).catch(() => null)])).filter(Boolean)
      const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`
      const chainRows = minted.map((m) => `<tr><th>${m!.chain === 'base' ? 'Minted on Base' : 'Minted on NEAR'}</th><td><a href="${esc(m!.explorer)}" rel="noopener">Token #${esc(m!.tokenId)}</a> · ${esc(m!.contract)}</td></tr>`).join('')
      body = `<img class="cert" src="/cert/${esc(id)}/image.png?w=1600" alt="${esc(`${c.t} certificate for ${c.n || c.u}`)}" width="${CERT_W}" height="${CERT_H}">
<h1>${esc(c.n || `@${c.u}`)}</h1>
<p class="sub">@${esc(c.u)} · ${esc(c.t)} · ${esc(issuedWat(c))}</p>
<table>${row('Course', c.t)}${row('Player', c.n || '-')}${row('Username', `@${c.u}`)}${row('Issued (WAT)', issuedWat(c))}${row('Issued (ISO-8601)', issuedIso(c) || '-')}${row('Serial', rec.row.serial)}${row('Issuer', 'Grind District')}${chainRows || row('On-chain', 'Not minted yet. The player can mint it as a soulbound NFT on Base or NEAR from the game.')}</table>
<p class="small">Certificate ID: <code>${esc(id)}</code> · <a href="/cert/${esc(id)}/meta.json">Metadata JSON</a> · <a href="/cert/${esc(id)}/image.png" download>Download PNG</a></p>
<p class="foot">${esc(CERT_WORDING)}</p>`
    } else {
      heading = 'Invalid certificate'
      title = 'Invalid certificate · Grind District'
      desc = 'This link is not a valid Grind District certificate.'
      body = `<h1>${esc(heading)}</h1><p>This link is not a valid Grind District certificate. It may have been changed, or it was never issued by Grind District. Ask the player for the link from their game, or check the serial printed on the certificate.</p>`
      valid = false
    }
  } else {
    const u = String(req.query.username ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
    const p = await getProfile(u).catch(() => null)
    heading = p?.name ? `${p.name} (@${u})` : `@${u} · Grind District`
    title = `${p?.name || `@${u}`} is grinding in Grind District`
    desc = p ? `${p.rank} · reputation ${p.reputation}. Scan the card or tap to join @${u} in a shared 3D city.` : `Join @${u} in a shared 3D city. Learn, trade and climb from shrimp to whale.`
    if (p?.pinned?.length) sub = `${desc} Pinned: ${p.pinned.join(', ')}`
    else if (p?.skills.length) sub = `${desc} Skills: ${p.skills.slice(0, 4).join(', ')}`
    // ?v= is the card version from the game, so X fetches a fresh preview after the player remakes their card.
    const v = String(req.query.v ?? '').replace(/[^a-z0-9]/g, '').slice(0, 12)
    image = `${origin}/api/og?u=${u}${v ? `&v=${v}` : ''}`
  }
  const ref = kind === 'cv' ? String(req.query.username ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) : ''
  const game = `${origin}/?src=${ref ? 'invite' : kind}${ref ? `&ref=${ref}` : ''}`
  const pageUrl = kind === 'cv' ? `${origin}/cv/${ref}` : certPageUrl(String(req.query.id ?? ''))
  if (kind === 'cv') body = `<img src="/brand/lockup.png" alt="Grind District" width="120"><h1>${esc(heading)}</h1><p>${esc(sub || desc)}</p>`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="${imgW}"><meta property="og:image:height" content="${imgH}"><meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',Inter,system-ui,sans-serif;background:#f7f1e6;color:#2a2418;display:grid;place-items:center;min-height:100vh}
main{max-width:980px;padding:24px;border:1px solid #c9a25e99;border-radius:18px;background:#fffaf2;margin:24px;box-shadow:0 12px 40px #c9a25e22}h1{margin:.6em 0 .15em;font-weight:600}p{color:#6a5e4e}
img.cert{display:block;width:100%;height:auto;border-radius:10px;box-shadow:0 10px 30px #c9a25e33}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}th{text-align:left;color:#8a7350;font-weight:600;padding:6px 12px 6px 0;white-space:nowrap;vertical-align:top}td{padding:6px 0;color:#2a2418;word-break:break-word}tr{border-top:1px solid #eadfcb}
a{color:#8a6a2a}.small{font-size:12px;word-break:break-all}code{font-size:11px;color:#6a5e4e}.sub{margin:0 0 8px}.foot{margin-top:18px;font-size:12px;color:#8a8070}
a.btn{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:999px;background:#2a2418;color:#fffaf2;text-decoration:none;font-weight:600}
section{margin-top:24px;border-top:1px solid #eadfcb;padding-top:16px}</style></head>
<body><main>${body}
<a class="btn" href="${game}">Open Grind District</a>
${kind === 'cv' ? '<section><h2>Endorsements</h2><p>Reviews and endorsements are coming soon.</p></section>' : ''}</main></body></html>`
  // How often shared certificates and CVs are opened by people (counts only, for the stats page).
  await countPageView(kind, String(req.headers?.['user-agent'] ?? ''), valid)
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', valid ? 'public, max-age=300' : 'no-store')
  res.status(valid ? 200 : 404).send(html)
}
