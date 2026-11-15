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
function drawQr(g: CanvasRenderingContext2D, link: string, x: number, y: number, size: number): void {
  const q = qrcode(0, 'M'); q.addData(link); q.make()
  const n = q.getModuleCount(), cell = Math.floor(size / (n + 8)), inner = cell * n, pad = (size - inner) / 2
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x, y, size, size, Math.round(size * 0.07)); g.fill()
  g.fillStyle = '#0b100d'
  const ox = Math.round(x + pad), oy = Math.round(y + pad)
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) g.fillRect(ox + col * cell, oy + r * cell, cell, cell)
}
const image = (src: string): Promise<HTMLImageElement | null> => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.onerror = () => done(null); i.src = src })

/** Draw the card. `portrait` is the full-body picture of the player (a data URL), if the 3D city is running. */
export async function drawPhotoCard(portrait: string | null): Promise<HTMLCanvasElement> {
  const s = getSave()
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  // A light studio sweep, like the Boutique preview.
  const wall = g.createRadialGradient(W / 2, 430, 60, W / 2, 520, 900)
  wall.addColorStop(0, '#fdfbf7'); wall.addColorStop(0.5, '#efe9df'); wall.addColorStop(1, '#cfc5b6')
  g.fillStyle = wall; g.fillRect(0, 0, W, H)
  const floor = g.createRadialGradient(W / 2, 1010, 10, W / 2, 1010, 330)
  floor.addColorStop(0, 'rgba(40,30,20,0.28)'); floor.addColorStop(1, 'rgba(40,30,20,0)')
  g.save(); g.translate(0, 1010); g.scale(1, 0.16); g.translate(0, -1010); g.fillStyle = floor; g.fillRect(0, 600, W, 820); g.restore()
  const [logo, body] = await Promise.all([image('/brand/logo-new.webp'), portrait ? image(portrait) : Promise.resolve(null)])
  if (body) { const h = 900, w = h * (body.width / body.height); g.drawImage(body, (W - w) / 2, 130, w, h) }
  if (logo) { const w = 250, h = w * (logo.height / logo.width); g.drawImage(logo, 60, 56, w, h) }
  // The name plate.
  const plate = g.createLinearGradient(0, 1060, 0, H)
  plate.addColorStop(0, '#16201b'); plate.addColorStop(1, '#0b100d')
  g.fillStyle = plate; g.beginPath(); g.roundRect(40, 1050, W - 80, 260, 36); g.fill()
  g.strokeStyle = 'rgba(214,178,94,0.7)'; g.lineWidth = 3; g.stroke()
  const name = s.name || 'Player', handle = s.username ? `@${s.username}` : ''
  g.fillStyle = '#f5f2ea'; g.textBaseline = 'alphabetic'
  g.font = '800 64px "Inter Variable", system-ui, sans-serif'; g.fillText(name.slice(0, 18), 84, 1146)
  g.font = '500 34px "Inter Variable", system-ui, sans-serif'; g.fillStyle = '#b9c2bb'; g.fillText([handle, rankFor(s.xp).label].filter(Boolean).join(' · '), 84, 1196)
  g.fillStyle = '#e9cf8e'; g.font = '700 36px "Inter Variable", system-ui, sans-serif'; g.fillText(`Reputation ${s.reputation}`, 84, 1250)
  g.fillStyle = '#b9c2bb'; g.font = '500 28px "Inter Variable", system-ui, sans-serif'; g.fillText('Learn Web3 by living it · grinddistrict.app', 84, 1290)
  // The invite code: scan to join through this player's link.
  drawQr(g, inviteLink(s.username), W - 84 - 210, 1072, 210)
  return c
}

/** The same card laid out for link previews (1200 x 630): the studio and avatar on the left, the name plate and a
 *  large invite code on the right. This is what X shows under a /cv link once it is uploaded. */
export async function drawShareCard(portrait: string | null): Promise<HTMLCanvasElement> {
  const s = getSave(), SW = 1200, SH = 630
  const c = document.createElement('canvas'); c.width = SW; c.height = SH
  const g = c.getContext('2d')!
  const wall = g.createRadialGradient(300, 260, 40, 300, 320, 640)
  wall.addColorStop(0, '#fdfbf7'); wall.addColorStop(0.5, '#efe9df'); wall.addColorStop(1, '#cfc5b6')
  g.fillStyle = wall; g.fillRect(0, 0, SW, SH)
  const floor = g.createRadialGradient(300, 590, 6, 300, 590, 190)
  floor.addColorStop(0, 'rgba(40,30,20,0.3)'); floor.addColorStop(1, 'rgba(40,30,20,0)')
  g.save(); g.translate(0, 590); g.scale(1, 0.16); g.translate(0, -590); g.fillStyle = floor; g.fillRect(0, 0, 640, 1200); g.restore()
  const [logo, body] = await Promise.all([image('/brand/logo-new.webp'), portrait ? image(portrait) : Promise.resolve(null)])
  if (body) { const h = 560, w = h * (body.width / body.height); g.drawImage(body, 300 - w / 2, 40, w, h) }
  if (logo) { const w = 170, h = w * (logo.height / logo.width); g.drawImage(logo, 34, 30, w, h) }
  const px = 600, py = 36, pw = SW - px - 36, ph = SH - 72
  const plate = g.createLinearGradient(0, py, 0, py + ph)
  plate.addColorStop(0, '#16201b'); plate.addColorStop(1, '#0b100d')
  g.fillStyle = plate; g.beginPath(); g.roundRect(px, py, pw, ph, 34); g.fill()
  g.strokeStyle = 'rgba(214,178,94,0.7)'; g.lineWidth = 3; g.stroke()
  const name = s.name || 'Player', handle = s.username ? `@${s.username}` : ''
  const F = '"Inter Variable", system-ui, sans-serif'
  g.textBaseline = 'alphabetic'; g.fillStyle = '#f5f2ea'; g.font = `800 58px ${F}`; g.fillText(name.slice(0, 16), px + 40, py + 92, pw - 80)
  g.font = `500 28px ${F}`; g.fillStyle = '#b9c2bb'; g.fillText([handle, rankFor(s.xp).label].filter(Boolean).join(' · '), px + 40, py + 138, pw - 80)
  g.font = `700 32px ${F}`; g.fillStyle = '#e9cf8e'; g.fillText(`Reputation ${s.reputation}`, px + 40, py + 188)
  const q = 250, qx = px + pw - 40 - q, qy = py + ph - 40 - q
  drawQr(g, inviteLink(s.username), qx, qy, q)
  g.fillStyle = '#f5f2ea'; g.font = `700 30px ${F}`; g.fillText('Scan to', px + 40, qy + q - 92); g.fillText('join me', px + 40, qy + q - 54)
  g.fillStyle = '#b9c2bb'; g.font = `500 22px ${F}`; g.fillText('grinddistrict.app', px + 40, qy + q - 12)
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
  const text = u ? `I'm grinding in Grind District as @${u}, ${rankFor(s.xp).label} rank. Scan my card or tap to join:` : "I'm grinding in Grind District. Come join:"
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
