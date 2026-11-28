// Photo cards: a branded picture of your character to share, with your name, reputation and an invite code people
// can scan. Drawn on a canvas on the device (1080 x 1350, the portrait size social apps like), then shared through
// the phone's share sheet or saved as an image. Nothing private is on it: no balance, no holdings, no wallet.
import qrcode from 'qrcode-generator'
import { getSave } from './state.ts'
import { rankFor } from './logic.ts'
import { shareLink } from './share.ts'

const W = 1080, H = 1350
/** The short invite link in the code (fewer modules, so it scans from a phone screen or a print). */
export const inviteLink = (username: string): string => `https://www.grinddistrict.app/?src=invite${username ? `&ref=${encodeURIComponent(username.toLowerCase())}` : ''}`
/** A QR code on a white rounded tile with the four-module quiet zone scanners expect; whole-pixel modules. */
export function drawQr(g: CanvasRenderingContext2D, link: string, x: number, y: number, size: number): void {
  const q = qrcode(0, 'M'); q.addData(link); q.make()
  const n = q.getModuleCount(), cell = Math.floor(size / (n + 8)), inner = cell * n, pad = (size - inner) / 2
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, size, size, Math.round(size * 0.07)); g.fill()
  g.fillStyle = '#0b100d'
  const ox = Math.round(x + pad), oy = Math.round(y + pad)
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) g.fillRect(ox + col * cell, oy + r * cell, cell, cell)
}
const image = (src: string): Promise<HTMLImageElement | null> => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.onerror = () => done(null); i.src = src })

/** The opaque bounds of the portrait (it is rendered on a transparent studio), so the figure fills the card. */
function trimmed(img: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } {
  const w = img.naturalWidth, h = img.naturalHeight
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, w, h).data
    let x0 = w, y0 = h, x1 = -1, y1 = -1
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4 + 3]! > 170) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    if (x1 < x0) return { sx: 0, sy: 0, sw: w, sh: h }
    const pad = 6
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad)
    return { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 }
  } catch { return { sx: 0, sy: 0, sw: w, sh: h } }
}
/** Draw the figure standing on the studio floor at (cx, floorY), as tall as `maxH` and no wider than `maxW`. */
function figure(g: CanvasRenderingContext2D, body: HTMLImageElement, cx: number, floorY: number, maxH: number, maxW: number): void {
  const t = trimmed(body), k = Math.min(maxH / t.sh, maxW / t.sw)
  const w = t.sw * k, h = t.sh * k
  g.drawImage(body, t.sx, t.sy, t.sw, t.sh, cx - w / 2, floorY - h, w, h)
}
const F = '"Inter Variable", Inter, system-ui, sans-serif'
/** Letter-spaced text, measured (canvas letterSpacing is not everywhere yet). */
function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, track: number): number {
  let cx = x
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + track }
  return cx - x - track
}
/** A rounded chip with a thin gold edge. Returns its width. */
function chip(g: CanvasRenderingContext2D, text: string, x: number, y: number, k: number, strong = false): number {
  g.font = `600 ${Math.round(22 * k)}px ${F}`
  const w = g.measureText(text).width + 30 * k, h = 42 * k
  g.fillStyle = strong ? 'rgba(233,207,142,0.16)' : 'rgba(255,255,255,0.06)'
  g.beginPath(); g.roundRect(x, y - h / 2, w, h, h / 2); g.fill()
  g.strokeStyle = strong ? 'rgba(233,207,142,0.75)' : 'rgba(233,207,142,0.32)'; g.lineWidth = 1.5 * k; g.stroke()
  g.fillStyle = strong ? '#f3dfa6' : '#e8e2d4'; g.textBaseline = 'middle'; g.fillText(text, x + 15 * k, y + 1)
  g.textBaseline = 'alphabetic'
  return w
}
/** The words on the plate: name; @handle with the rank as a gold chip; reputation and courses chips; the tagline. */
function nameplate(g: CanvasRenderingContext2D, x: number, y: number, maxW: number, k: number): void {
  const s = getSave()
  const name = s.name || 'Player', handle = s.username ? `@${s.username}` : ''
  const courses = Object.values(s.skills as Record<string, { passed?: boolean } | undefined>).filter((v) => v?.passed).length
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'
  g.fillStyle = '#f7f3ea'; g.font = `800 ${Math.round(62 * k)}px ${F}`
  let px = 62 * k
  while (px > 36 * k && g.measureText(name).width > maxW) { px -= 2; g.font = `800 ${Math.round(px)}px ${F}` }
  g.fillText(name, x, y)
  let cx = x
  if (handle) { g.fillStyle = '#d9bd7a'; g.font = `600 ${Math.round(30 * k)}px ${F}`; g.fillText(handle, x, y + 52 * k); cx = x + g.measureText(handle).width + 16 * k }
  chip(g, `${rankFor(s.xp).label.toUpperCase()} RANK`, cx, y + 42 * k, k, true)
  let c2 = x
  c2 += chip(g, `★  ${s.reputation} reputation`, c2, y + 108 * k, k) + 12 * k
  if (courses) chip(g, `✓  ${courses} course${courses === 1 ? '' : 's'} passed`, c2, y + 108 * k, k)
  g.fillStyle = '#8f9b93'; g.font = `600 ${Math.round(16 * k)}px ${F}`
  spaced(g, 'LEARN WEB3 BY LIVING IT  ·  GRINDDISTRICT.APP', x, y + 168 * k, 2.6 * k)
}
/** The dark plate with a fine gold edge and a soft top sheen. */
function plateAt(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const plate = g.createLinearGradient(0, y, 0, y + h)
  plate.addColorStop(0, '#18231d'); plate.addColorStop(1, '#0a0f0c')
  g.save(); g.shadowColor = 'rgba(20,14,6,0.35)'; g.shadowBlur = 30; g.shadowOffsetY = 12
  g.fillStyle = plate; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); g.restore()
  const sheen = g.createLinearGradient(0, y, 0, y + h * 0.5)
  sheen.addColorStop(0, 'rgba(255,255,255,0.06)'); sheen.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sheen; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill()
  const edge = g.createLinearGradient(x, 0, x + w, 0)
  edge.addColorStop(0, 'rgba(214,178,94,0.55)'); edge.addColorStop(0.5, 'rgba(240,214,150,0.95)'); edge.addColorStop(1, 'rgba(214,178,94,0.55)')
  g.strokeStyle = edge; g.lineWidth = 2.5; g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke()
}
function studio(g: CanvasRenderingContext2D, w: number, h: number, cx: number, floorY: number): void {
  const wall = g.createRadialGradient(cx, floorY * 0.45, 60, cx, floorY * 0.55, Math.max(w, h) * 0.85)
  wall.addColorStop(0, '#fdfbf7'); wall.addColorStop(0.5, '#efe9df'); wall.addColorStop(1, '#cfc5b6')
  g.fillStyle = wall; g.fillRect(0, 0, w, h)
  const floor = g.createRadialGradient(cx, floorY, 6, cx, floorY, w * 0.3)
  floor.addColorStop(0, 'rgba(40,30,20,0.32)'); floor.addColorStop(1, 'rgba(40,30,20,0)')
  g.save(); g.translate(0, floorY); g.scale(1, 0.15); g.translate(0, -floorY); g.fillStyle = floor; g.fillRect(0, floorY - w, w, w * 2); g.restore()
}

/** Draw the card. `portrait` is the full-body picture of the player (a data URL), if the 3D city is running. */
export async function drawPhotoCard(portrait: string | null): Promise<HTMLCanvasElement> {
  const s = getSave()
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  studio(g, W, H, W / 2, 990)
  const [logo, body] = await Promise.all([image('/brand/logo-new.webp'), portrait ? image(portrait) : Promise.resolve(null)])
  if (body) figure(g, body, W / 2, 990, 820, 700)
  if (logo) { const w = 230, h = w * (logo.height / logo.width); g.drawImage(logo, 60, 56, w, h) }
  plateAt(g, 40, 1026, W - 80, 290, 36)
  nameplate(g, 84, 1110, W - 84 - 300, 1)
  // The invite code: scan to join through this player's link.
  drawQr(g, inviteLink(s.username), W - 84 - 206, 1054, 206)
  g.fillStyle = '#c9b88e'; g.font = `700 15px ${F}`
  const lw = g.measureText('SCAN TO JOIN').width + 2.4 * 11
  spaced(g, 'SCAN TO JOIN', W - 84 - 103 - lw / 2, 1292, 2.4)
  return c
}

/** The same card laid out for link previews (1200 x 630): the studio and avatar on the left, the name plate and a
 *  large invite code on the right. This is what X shows under a /cv link once it is uploaded. */
export async function drawShareCard(portrait: string | null): Promise<HTMLCanvasElement> {
  const s = getSave(), SW = 1200, SH = 630
  const c = document.createElement('canvas'); c.width = SW; c.height = SH
  const g = c.getContext('2d')!
  studio(g, SW, SH, 300, 596)
  const [logo, body] = await Promise.all([image('/brand/logo-new.webp'), portrait ? image(portrait) : Promise.resolve(null)])
  if (body) figure(g, body, 310, 596, 560, 420)
  if (logo) { const w = 160, h = w * (logo.height / logo.width); g.drawImage(logo, 34, 30, w, h) }
  const px = 590, py = 36, pw = SW - px - 36, ph = SH - 72
  plateAt(g, px, py, pw, ph, 34)
  nameplate(g, px + 40, py + 96, pw - 80, 0.92)
  const q = 236, qx = px + pw - 40 - q, qy = py + ph - 36 - q
  drawQr(g, inviteLink(s.username), qx, qy, q)
  g.fillStyle = '#f5f2ea'; g.font = `700 30px ${F}`; g.fillText('Scan to', px + 40, qy + q - 96); g.fillText('join me', px + 40, qy + q - 58)
  g.fillStyle = '#b9c2bb'; g.font = `500 21px ${F}`; g.fillText('or tap the link', px + 40, qy + q - 20)
  return c
}

const VKEY = (u: string) => `gd.cardv.${u.toLowerCase()}`
/** The version of the card last uploaded for this username ('' if none), for the /cv link's ?v=. */
export function cardVersion(username: string): string { try { return username ? localStorage.getItem(VKEY(username)) ?? '' : '' } catch { return '' } }
/** Store the landscape card as this player's link preview. Needs a signed-in account with a username. */
export async function uploadShareCard(portrait: string | null): Promise<string | null> {
  const u = getSave().username
  if (!u) return null
  const canvas = await drawShareCard(portrait)
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.88))
  if (!blob) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const { accessToken } = await import('./login.ts')
  const token = await accessToken().catch(() => null)
  const near = token ? null : (await import('./state.ts')).heldNearProof()
  if (!token && !near) return null
  const r = await fetch('/api/referrals?op=card', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ data: btoa(bin), ...(near ? { near } : {}) }) }).catch(() => null)
  const j = r?.ok ? await r.json().catch(() => null) as { v?: string } | null : null
  if (!j?.v) return null
  try { localStorage.setItem(VKEY(u), j.v) } catch { /* private mode */ }
  return j.v
}
/** Share on X with the photo card as the link preview: the card is refreshed first, then X opens. */
export function shareCardToX(portrait: () => string | null, say: (m: string) => void): void {
  const s = getSave(), u = s.username
  // Lead with what the player did: courses passed (each one a certificate), then who they are.
  const passed = Object.values(s.skills as Record<string, { passed?: boolean } | undefined>).filter((v) => v?.passed).length
  const did = passed ? `Passed ${passed} Web3 course${passed === 1 ? '' : 's'} in Grind District. Each one is on my CV.` : 'Learning Web3 in Grind District, a free 3D city.'
  const text = `${did} Come join:`
  const open = (v: string) => {
    const intent = new URL('https://x.com/intent/post')
    intent.searchParams.set('text', text)
    intent.searchParams.set('url', u ? `https://www.grinddistrict.app/cv/${encodeURIComponent(u.toLowerCase())}${v ? `?v=${v}` : ''}` : 'https://www.grinddistrict.app/')
    return intent.toString()
  }
  void import('./share.ts').then((m) => m.publishProfile())
  if (!u) { window.open(open(''), '_blank', 'noopener'); return }
  // Open the tab inside the tap (so it is not blocked), then point it at X once the card is stored.
  const w = window.open('', '_blank')
  say('Preparing your photo card…')
  void uploadShareCard(portrait()).catch(() => null).then((v) => {
    const url = open(v ?? cardVersion(u))
    if (w && !w.closed) { try { w.opener = null } catch { /* ignore */ } w.location.href = url } else window.open(url, '_blank', 'noopener')
  })
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement }
/** The photo card with its Share and Save buttons, for the Profile panel. */
export function photoCardNodes(h: H, portrait: () => string | null, say: (m: string) => void): HTMLElement {
  const box = document.createElement('div'); box.className = 'pcard'
  const make = h.button('Make my photo card', 'primary', () => {
    make.remove()
    const wait = h.para('Taking your picture…', 'muted'); box.append(wait)
    const shot = portrait()
    void drawPhotoCard(shot).then((canvas) => {
      wait.remove()
      const img = document.createElement('img'); img.className = 'pcard-img'; img.alt = 'Your Grind District photo card'; img.src = canvas.toDataURL('image/png')
      const file = (): Promise<File | null> => new Promise((done) => canvas.toBlob((b) => done(b ? new File([b], 'grind-district-card.png', { type: 'image/png' }) : null), 'image/png'))
      const link = shareLink('/', 'invite', getSave().username)
      // The landscape version becomes the /cv link preview on X (signed-in players).
      void uploadShareCard(shot).catch(() => null)
      const share = h.button('Share', 'primary', () => {
        void file().then(async (f) => {
          const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
          try {
            if (f && nav.canShare?.({ files: [f] })) { await nav.share({ files: [f], title: 'Grind District', text: `Join me in Grind District: ${link}` }); return }
            if (nav.share) { await nav.share({ title: 'Grind District', text: 'Join me in Grind District', url: link }); return }
            await navigator.clipboard.writeText(link); say('Invite link copied. Save the picture to post it.')
          } catch { /* the player closed the share sheet */ }
        })
      })
      const save = h.button('Save picture', 'ghost', () => { const a = document.createElement('a'); a.href = img.src; a.download = 'grind-district-card.png'; a.click(); say('Photo card saved.') })
      const toX = h.button('Post on 𝕏', 'ghost', () => shareCardToX(() => shot, say))
      const row = document.createElement('div'); row.className = 'pcard-row'; row.append(share, toX, save)
      box.append(img, row, h.para('The code on the card is your invite link: scan it with a phone camera to open the game. Your 𝕏 link preview shows this card. No balance or wallet is shown.', 'muted'))
    })
  })
  box.append(make)
  return box
}
