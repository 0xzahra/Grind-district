// Photo cards: a branded picture of your character to share, with your name, reputation and an invite code people
// can scan. Drawn on a canvas on the device (1080 x 1350, the portrait size social apps like), then shared through
// the phone's share sheet or saved as an image. Nothing private is on it: no balance, no holdings, no wallet.
import qrcode from 'qrcode-generator'
import { getSave } from './state.ts'
import { rankFor } from './logic.ts'
import { shareLink } from './share.ts'

const W = 1080, H = 1350
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
  const link = shareLink('/', 'invite', s.username)
  const q = qrcode(0, 'M'); q.addData(link); q.make()
  const n = q.getModuleCount(), size = 196, cell = size / n, qx = W - 84 - size, qy = 1082
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(qx - 12, qy - 12, size + 24, size + 24, 16); g.fill()
  g.fillStyle = '#0b100d'
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) g.fillRect(qx + col * cell, qy + r * cell, cell + 0.5, cell + 0.5)
  return c
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement }
/** The photo card with its Share and Save buttons, for the Profile panel. */
export function photoCardNodes(h: H, portrait: () => string | null, say: (m: string) => void): HTMLElement {
  const box = document.createElement('div'); box.className = 'pcard'
  const make = h.button('Make my photo card', 'primary', () => {
    make.remove()
    const wait = h.para('Taking your picture…', 'muted'); box.append(wait)
    void drawPhotoCard(portrait()).then((canvas) => {
      wait.remove()
      const img = document.createElement('img'); img.className = 'pcard-img'; img.alt = 'Your Grind District photo card'; img.src = canvas.toDataURL('image/png')
      const file = (): Promise<File | null> => new Promise((done) => canvas.toBlob((b) => done(b ? new File([b], 'grind-district-card.png', { type: 'image/png' }) : null), 'image/png'))
      const link = shareLink('/', 'invite', getSave().username)
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
      const row = document.createElement('div'); row.className = 'pcard-row'; row.append(share, save)
      box.append(img, row, h.para('The code on the card is your invite link. No balance or wallet is shown.', 'muted'))
    })
  })
  box.append(make)
  return box
}
