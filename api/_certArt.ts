// Shared by the game (src/certs.ts), the API (api/page.ts) and scripts. No imports: safe everywhere.
// Grind District certificate: id codec, timestamp formatting, metadata and the premium art.
// Pure module (no DOM lookups, no app state): the game (browser canvas), the Vercel API
// (@napi-rs/canvas) and the preview script all draw the exact same certificate from it.

export const CERT_ORIGIN = 'https://www.grinddistrict.app'
export const CERT_W = 1600
export const CERT_H = 1131
export const CERT_ISSUER = 'Grind District'
export const CERT_WORDING = 'Practice credential, earned by passing the course in Grind District. Not an accredited qualification.'

/** Payload inside a certificate id. v1 ids (old) only had n,u,r,c,t,d (d = YYYY-MM-DD). */
export type CertData = {
  v?: number
  n: string // display name
  u: string // username (no @)
  r: string // rank label at issue
  c: string // course id (SkillId)
  t: string // course title
  d?: string // YYYY-MM-DD (WAT) — kept for old readers
  at?: number // issued / completed time, epoch ms (v2+)
}

/** Control chars removed; quote/backslash swapped so the on-chain JSON (Base/NEAR) is always valid. */
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/"/g, "'").replace(/\\/g, '/').trim().slice(0, max)
export const certField = clean

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s: string): string {
  const std = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** WAT calendar date YYYY-MM-DD for an epoch ms. Lagos is UTC+1 all year (no DST). */
export const watDate = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10)

export function encodeCertId(d: CertData): string {
  const at = typeof d.at === 'number' && Number.isFinite(d.at) ? Math.floor(d.at) : undefined
  const body: CertData = { v: 2, n: clean(d.n, 40), u: clean(d.u, 16).toLowerCase(), r: clean(d.r, 24), c: clean(d.c, 32), t: clean(d.t, 80), d: at ? watDate(at) : clean(d.d, 10) }
  if (at) body.at = at
  return b64urlEncode(JSON.stringify(body))
}

/** Decodes v2 and old v1 (date-only) ids. Returns null for anything that is not a certificate. */
export function decodeCertId(id: string): CertData | null {
  if (!id || id.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(id)) return null
  try {
    const j = JSON.parse(b64urlDecode(id)) as Record<string, unknown>
    if (!j || typeof j !== 'object' || typeof j.t !== 'string') return null
    const out: CertData = { v: Number(j.v) || 1, n: clean(j.n, 40), u: clean(j.u, 16), r: clean(j.r, 24), c: clean(j.c, 32), t: clean(j.t, 80) }
    const d = clean(j.d, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) out.d = d
    const at = Number(j.at)
    if (Number.isFinite(at) && at > 1_500_000_000_000 && at < 4_200_000_000_000) out.at = Math.floor(at)
    return out
  } catch {
    return null
  }
}

/** Stable serial from the identity fields, e.g. GD-7F3K-9Q2M. Not a secret, just a readable reference. */
export function certSerial(d: CertData): string {
  const src = `${d.u}|${d.c}|${d.at ?? d.d ?? ''}|${d.n}`
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < src.length; i += 1) {
    const ch = src.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ ch, 0x5bd1e995) >>> 0
  }
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  let n = BigInt(h1) * 4294967296n + BigInt(h2), s = ''
  for (let i = 0; i < 8; i += 1) { s += A[Number(n % 32n)]; n /= 32n }
  return `GD-${s.slice(0, 4)}-${s.slice(4)}`
}

/** "11 November 2026, 09:42 WAT" (or date only for old ids). */
export function issuedWat(d: CertData): string {
  if (d.at) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    const p = Object.fromEntries(f.formatToParts(new Date(d.at)).map((x) => [x.type, x.value]))
    return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} WAT`
  }
  if (d.d) {
    const [y, m, day] = d.d.split('-').map(Number)
    const month = new Date(Date.UTC(y, m - 1, day)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })
    return `${day} ${month} ${y}`
  }
  return 'Date not recorded'
}

/** ISO-8601 in WAT, e.g. 2026-11-11T09:42:13+01:00 (date only for old ids). */
export function issuedIso(d: CertData): string {
  if (d.at) return new Date(d.at + 3_600_000).toISOString().slice(0, 19) + '+01:00'
  return d.d ?? ''
}

export const certPageUrl = (id: string) => `${CERT_ORIGIN}/cert/${id}`
export const certImageUrl = (id: string) => `${CERT_ORIGIN}/cert/${id}/image.png`
export const certMetaUrl = (id: string) => `${CERT_ORIGIN}/cert/${id}/meta.json`

export type CertChain = 'base' | 'near'

/** ERC-721 / NEP-177 style metadata JSON. Same fields the contracts store on-chain. */
export function certMetadata(id: string, d: CertData, chain?: CertChain) {
  const serial = certSerial(d)
  const attrs: Array<{ trait_type: string; value: string | number; display_type?: string }> = [
    { trait_type: 'Course', value: d.t },
    { trait_type: 'Course ID', value: d.c },
    { trait_type: 'Player', value: d.n },
    { trait_type: 'Username', value: `@${d.u}` },
    { trait_type: 'Rank at issue', value: d.r },
    { trait_type: 'Issued (WAT)', value: issuedWat(d) },
    { trait_type: 'Issued (ISO-8601)', value: issuedIso(d) },
    { trait_type: 'Certificate ID', value: id },
    { trait_type: 'Serial', value: serial },
    { trait_type: 'Issuer', value: CERT_ISSUER },
    { trait_type: 'Credential type', value: 'Practice credential (earned by passing the course; not accredited)' },
  ]
  if (d.at) attrs.push({ trait_type: 'Issued at', value: Math.floor(d.at / 1000), display_type: 'date' })
  if (chain) attrs.push({ trait_type: 'Chain', value: chain === 'base' ? 'Base' : 'NEAR' })
  return {
    name: `${d.t} · Grind District Certificate`,
    description: `${d.n || 'A player'} (@${d.u}) passed the ${d.t} course in Grind District. ${CERT_WORDING} Non-transferable. It carries no money value and cannot be redeemed.`,
    image: certImageUrl(id),
    external_url: certPageUrl(id),
    serial,
    attributes: attrs,
  }
}

// ---------------------------------------------------------------- art

type Ctx = CanvasRenderingContext2D
type Img = CanvasImageSource & { width: number; height: number }
export type CertAssets = {
  lockup: Img
  shrimp: Img
  /** Offscreen canvas factory (document.createElement('canvas') or @napi-rs/canvas createCanvas). */
  makeCanvas(w: number, h: number): { width: number; height: number; getContext(k: '2d'): unknown }
}

const F = { sans: 'Outfit, "Helvetica Neue", Arial, sans-serif', serif: '"Cormorant Garamond", Georgia, "Times New Roman", serif', heavy: '"Archivo Black", Outfit, sans-serif' }
const C = { ink: '#2a2418', paper: '#f7f1e6', cream: '#fffaf2', sand: '#7a6548', gold: '#b8903e', muted: '#6a5e4e', dim: '#8a8070' }

function foil(g: Ctx, x0: number, x1: number, y0 = 0, y1 = 0): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1)
  gr.addColorStop(0, '#8a6a34')
  gr.addColorStop(0.22, '#e9cd8f')
  gr.addColorStop(0.45, '#b38b4b')
  gr.addColorStop(0.62, '#f5e1ad')
  gr.addColorStop(0.82, '#a98345')
  gr.addColorStop(1, '#dcbc7c')
  return gr
}

/** Letter-spaced text (canvas letterSpacing is not everywhere yet). */
function spaced(g: Ctx, text: string, x: number, y: number, track: number, align: 'center' | 'left' = 'center'): number {
  const chars = [...text]
  const widths = chars.map((ch) => g.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1)
  const prev = g.textAlign
  g.textAlign = 'left'
  let cx = align === 'center' ? x - total / 2 : x
  chars.forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + track })
  g.textAlign = prev
  return total
}

/** Fit a font size so text stays inside maxW. */
function fit(g: Ctx, text: string, font: (px: number) => string, start: number, min: number, maxW: number): number {
  let px = start
  g.font = font(px)
  while (px > min && g.measureText(text).width > maxW) { px -= 2; g.font = font(px) }
  return px
}

function diamond(g: Ctx, x: number, y: number, r: number) {
  g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill()
}

function ruleWithDiamond(g: Ctx, cx: number, y: number, half: number) {
  const gr = g.createLinearGradient(cx - half, y, cx + half, y)
  gr.addColorStop(0, 'rgba(201,162,94,0)'); gr.addColorStop(0.5, 'rgba(233,205,143,0.95)'); gr.addColorStop(1, 'rgba(201,162,94,0)')
  g.strokeStyle = gr; g.lineWidth = 1.2
  g.beginPath(); g.moveTo(cx - half, y); g.lineTo(cx - 14, y); g.moveTo(cx + 14, y); g.lineTo(cx + half, y); g.stroke()
  g.fillStyle = '#e9cd8f'; diamond(g, cx, y, 5)
  g.fillStyle = 'rgba(233,205,143,0.6)'; diamond(g, cx - 22, y, 2.2); diamond(g, cx + 22, y, 2.2)
}

function tinted(a: CertAssets, img: Img, w: number, h: number, paint: (g: Ctx) => void): CanvasImageSource {
  const cv = a.makeCanvas(Math.ceil(w), Math.ceil(h))
  const g = cv.getContext('2d') as Ctx
  g.drawImage(img, 0, 0, w, h)
  g.globalCompositeOperation = 'source-in'
  paint(g)
  g.fillRect(0, 0, w, h)
  return cv as unknown as CanvasImageSource
}

/** Banknote-style guilloche between two frame lines. */
function guilloche(g: Ctx, x0: number, y0: number, x1: number, y1: number, band: number) {
  g.save()
  g.lineWidth = 0.7
  const side = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const len = Math.hypot(bx - ax, by - ay)
    for (let k = 0; k < 3; k += 1) {
      g.strokeStyle = k === 1 ? 'rgba(184,144,62,0.28)' : 'rgba(184,144,62,0.16)'
      for (const phase of [0, Math.PI]) {
        g.beginPath()
        for (let s = 0; s <= len; s += 3) {
          const t = s / len
          const off = band / 2 + Math.sin(s / (11 + k * 3) + phase + k) * (band / 2 - 3) * (0.75 + 0.25 * Math.cos(s / 57))
          const px = ax + (bx - ax) * t + nx * off
          const py = ay + (by - ay) * t + ny * off
          if (s === 0) g.moveTo(px, py); else g.lineTo(px, py)
        }
        g.stroke()
      }
    }
  }
  side(x0, y0, x1, y0, 0, 1)
  side(x0, y1, x1, y1, 0, -1)
  side(x0, y0 + band, x0, y1 - band, 1, 0)
  side(x1, y0 + band, x1, y1 - band, -1, 0)
  g.restore()
}

function cornerOrnament(g: Ctx, x: number, y: number, sx: number, sy: number) {
  g.save()
  g.translate(x, y); g.scale(sx, sy)
  g.strokeStyle = '#d7b878'; g.lineWidth = 1.4
  g.beginPath(); g.moveTo(0, 64); g.lineTo(0, 0); g.lineTo(64, 0); g.stroke()
  g.lineWidth = 0.8; g.strokeStyle = 'rgba(215,184,120,0.7)'
  g.beginPath(); g.moveTo(10, 44); g.lineTo(10, 10); g.lineTo(44, 10); g.stroke()
  g.beginPath(); g.arc(10, 10, 16, 0, Math.PI / 2); g.stroke()
  g.fillStyle = '#e9cd8f'; diamond(g, 10, 10, 5)
  g.fillStyle = 'rgba(233,205,143,0.7)'; diamond(g, 64, 0, 3); diamond(g, 0, 64, 3)
  g.restore()
}

function seal(g: Ctx, a: CertAssets, cx: number, cy: number) {
  const R = 92
  // ribbon tails
  g.save()
  for (const dir of [-1, 1]) {
    g.beginPath()
    g.moveTo(cx + dir * 22, cy + 40); g.lineTo(cx + dir * 60, cy + 112); g.lineTo(cx + dir * 43, cy + 102); g.lineTo(cx + dir * 30, cy + 124); g.lineTo(cx + dir * 0, cy + 60); g.closePath()
    const rg = g.createLinearGradient(cx, cy + 40, cx + dir * 60, cy + 124)
    rg.addColorStop(0, '#0f3d2a'); rg.addColorStop(1, '#0a2a1d')
    g.fillStyle = rg; g.fill()
    g.strokeStyle = 'rgba(233,205,143,0.55)'; g.lineWidth = 1; g.stroke()
  }
  g.restore()
  // starburst rim
  g.beginPath()
  const pts = 60
  for (let i = 0; i <= pts * 2; i += 1) {
    const ang = (i / (pts * 2)) * Math.PI * 2
    const r = i % 2 ? R : R - 7
    const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
  }
  g.closePath()
  g.fillStyle = foil(g, cx - R, cx + R, cy - R, cy + R); g.fill()
  g.shadowColor = 'transparent'
  // inner disc
  const disc = g.createRadialGradient(cx - 20, cy - 24, 6, cx, cy, R - 12)
  disc.addColorStop(0, '#fff8e8'); disc.addColorStop(1, '#ead9a8')
  g.beginPath(); g.arc(cx, cy, R - 13, 0, Math.PI * 2); g.fillStyle = disc; g.fill()
  g.strokeStyle = '#e9cd8f'; g.lineWidth = 1.4; g.beginPath(); g.arc(cx, cy, R - 18, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = 'rgba(233,205,143,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.arc(cx, cy, R - 44, 0, Math.PI * 2); g.stroke()
  // circular legend
  const legend = 'GRIND DISTRICT  ✦  CERTIFICATE  ✦  '
  g.save()
  g.fillStyle = '#5c4a24'
  g.font = `600 12px ${F.sans}`
  g.textAlign = 'center'
  const chars = [...legend]
  const step = (Math.PI * 2) / chars.length
  chars.forEach((ch, i) => {
    g.save()
    g.translate(cx, cy); g.rotate(-Math.PI / 2 + i * step); g.translate(0, -(R - 31))
    g.fillText(ch === '✦' ? '•' : ch, 0, 4)
    g.restore()
  })
  g.restore()
  // shrimp
  const sw = 64, sh = (sw * a.shrimp.height) / a.shrimp.width
  g.drawImage(tinted(a, a.shrimp, sw, sh, (t) => { t.fillStyle = foil(t, 0, sw, 0, sh) }), cx - sw / 2, cy - sh / 2, sw, sh)
}

/** Paints the full certificate on a CERT_W x CERT_H (or scaled) context. Never throws for odd data. */
export function drawCertificate(g: Ctx, d: CertData, id: string, a: CertAssets, scale = 1): void {
  const W = CERT_W, H = CERT_H, cx = W / 2
  g.save()
  g.scale(scale, scale)
  g.textBaseline = 'alphabetic'
  g.textAlign = 'center'

  // Paper: warm ivory with a soft, slightly deeper gold edge.
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H)
  const bg = g.createRadialGradient(cx, H * 0.42, 80, cx, H * 0.5, W * 0.72)
  bg.addColorStop(0, '#fffcf6'); bg.addColorStop(0.55, '#f7f1e6'); bg.addColorStop(1, '#eadfcb')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)

  // Fine linen hatch for texture.
  g.save(); g.globalAlpha = 0.07; g.strokeStyle = '#c9a25e'; g.lineWidth = 1
  for (let x = -H; x < W; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke() }
  g.restore()

  // Rosette watermark behind the text.
  g.save(); g.translate(cx, 560); g.strokeStyle = 'rgba(184,144,62,0.10)'; g.lineWidth = 1
  for (let i = 0; i < 36; i += 1) { g.rotate(Math.PI / 36); g.beginPath(); g.ellipse(0, 0, 360, 130, 0, 0, Math.PI * 2); g.stroke() }
  g.restore()
  const ww = 560, wh = (ww * a.shrimp.height) / a.shrimp.width
  g.save(); g.globalAlpha = 0.07
  g.drawImage(tinted(a, a.shrimp, ww, wh, (t) => { t.fillStyle = '#c9a25e' }), cx - ww / 2, 560 - wh / 2, ww, wh)
  g.restore()

  // Frames: foil outer, guilloche band, double inner line, corner ornaments.
  const o = 34
  g.strokeStyle = foil(g, 0, W, 0, H); g.lineWidth = 4; g.strokeRect(o, o, W - 2 * o, H - 2 * o)
  g.lineWidth = 1; g.strokeStyle = 'rgba(233,205,143,0.75)'; g.strokeRect(o + 9, o + 9, W - 2 * (o + 9), H - 2 * (o + 9))
  guilloche(g, o + 12, o + 12, W - o - 12, H - o - 12, 28)
  const ib = o + 44
  g.strokeStyle = 'rgba(233,205,143,0.85)'; g.lineWidth = 1.5; g.strokeRect(ib, ib, W - 2 * ib, H - 2 * ib)
  g.strokeStyle = 'rgba(201,162,94,0.45)'; g.lineWidth = 0.75; g.strokeRect(ib + 7, ib + 7, W - 2 * (ib + 7), H - 2 * (ib + 7))
  const co = ib + 16
  cornerOrnament(g, co, co, 1, 1); cornerOrnament(g, W - co, co, -1, 1); cornerOrnament(g, co, H - co, 1, -1); cornerOrnament(g, W - co, H - co, -1, -1)

  // Logo lockup, clearly visible on the light paper.
  const lh = 132, lw = (lh * a.lockup.width) / a.lockup.height
  g.drawImage(a.lockup, cx - lw / 2, 120, lw, lh)

  // Title band.
  g.fillStyle = foil(g, cx - 260, cx + 260)
  g.font = `600 22px ${F.sans}`
  const tw = spaced(g, 'CERTIFICATE OF COMPLETION', cx, 316, 9)
  g.strokeStyle = 'rgba(233,205,143,0.7)'; g.lineWidth = 1
  for (const s of [-1, 1]) { const x = cx + s * (tw / 2 + 22); g.beginPath(); g.moveTo(x, 308); g.lineTo(x + s * 120, 308); g.stroke(); g.fillStyle = '#e9cd8f'; diamond(g, x + s * 128, 308, 3.5) }

  g.fillStyle = C.muted
  g.font = `italic 400 34px ${F.serif}`
  g.fillText('This certifies that', cx, 386)

  // Name in foil serif italic.
  const name = d.n || (d.u ? `@${d.u}` : 'Grind District player')
  fit(g, name, (px) => `italic 600 ${px}px ${F.serif}`, 118, 56, 1120)
  g.fillStyle = foil(g, cx - 520, cx + 520, 400, 520)
  g.fillText(name, cx, 496)
  ruleWithDiamond(g, cx, 534, 360)

  g.fillStyle = C.sand
  g.font = `500 23px ${F.sans}`
  spaced(g, `@${d.u || 'player'}   ·   ${(d.r || 'Shrimp').toUpperCase()} RANK`, cx, 580, 3.2)

  g.fillStyle = C.muted
  g.font = `italic 400 31px ${F.serif}`
  g.fillText('has passed the Grind District course', cx, 646)

  const title = (d.t || 'Course').toUpperCase()
  const tpx = fit(g, title, (px) => `600 ${px}px ${F.sans}`, 56, 30, 1160)
  g.fillStyle = C.ink
  g.font = `600 ${tpx}px ${F.sans}`
  spaced(g, title, cx, 722, tpx * 0.06)
  g.fillStyle = C.dim
  g.font = `400 19px ${F.sans}`
  g.fillText(CERT_WORDING, cx, 774)

  // Bottom: issued date/time · seal · issuer.
  const lx = 400, rx = W - 400, by = 912
  g.textAlign = 'center'
  g.fillStyle = C.ink
  fit(g, issuedWat(d), (px) => `500 ${px}px ${F.sans}`, 27, 18, 420)
  g.fillText(issuedWat(d), lx, by)
  g.font = `italic 600 36px ${F.serif}`
  g.fillStyle = foil(g, rx - 200, rx + 200)
  g.fillText('Grind District Campus', rx, by)
  for (const x of [lx, rx]) {
    const gr = g.createLinearGradient(x - 210, 0, x + 210, 0)
    gr.addColorStop(0, 'rgba(201,162,94,0)'); gr.addColorStop(0.5, 'rgba(201,162,94,0.9)'); gr.addColorStop(1, 'rgba(201,162,94,0)')
    g.strokeStyle = gr; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 210, by + 22); g.lineTo(x + 210, by + 22); g.stroke()
  }
  g.fillStyle = C.gold
  g.font = `600 14px ${F.sans}`
  spaced(g, 'DATE & TIME ISSUED', lx, by + 52, 3.4)
  spaced(g, 'ISSUED BY', rx, by + 52, 3.4)
  g.fillStyle = C.dim
  g.font = `400 15px ${F.sans}`
  g.fillText(issuedIso(d) ? `ISO-8601  ${issuedIso(d)}` : 'Issued before timestamps were recorded', lx, by + 80)
  g.fillText('grinddistrict.app', rx, by + 80)

  seal(g, a, cx, 884)

  // Footer: serial and verification.
  g.fillStyle = C.dim
  g.font = `500 14px ${F.sans}`
  spaced(g, `CERTIFICATE Nº ${certSerial(d)}   ·   COURSE ID ${(d.c || '-').toUpperCase()}   ·   VERIFY AT GRINDDISTRICT.APP/CERT`, cx, H - 98, 2.2)
  void id
  g.restore()
}
