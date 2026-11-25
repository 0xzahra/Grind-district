// The pictures players share: the city stats card and any flyer (McGrind posters today), as 1080 x 1350 portrait
// cards (the size feeds and stories show best), plus the 1200 x 630 link-preview version of a flyer. All of them
// carry the game logo, a clear call to play and a QR code to the site. Drawn on demand, nothing kept.
import qrcode from 'qrcode-generator'
import { loadPicture, SITE } from './sharePicture.ts'
import type { Flyer } from './posters.ts'
import type { StatCard } from './statsPanel.ts'

const SANS = '"Inter Variable", Inter, system-ui, sans-serif'
const DISPLAY = SANS
const GOLD = '#e9cf8e', GOLD_DEEP = '#b8923f', MINT = '#3bfaa4', INK = '#f7f3ea'

async function ready(): Promise<{ logo: HTMLImageElement | null; city: HTMLImageElement | null; cityWide: HTMLImageElement | null }> {
  const fonts = ['500 20px "Inter Variable"', '700 20px "Inter Variable"', '800 20px "Inter Variable"', '900 20px "Inter Variable"']
  await Promise.race([Promise.all(fonts.map((f) => document.fonts?.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 2000))])
  const [logo, city, cityWide] = await Promise.all([loadPicture('/brand/logo-new.png'), loadPicture('/brand/title-p.jpg'), loadPicture('/brand/title-l.jpg')])
  return { logo, city, cityWide }
}

const canvasOf = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const }
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); if (typeof g.roundRect === "function") g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h) }

/** Fill the canvas with a photo (cover), or the game's deep green if it did not load. */
function cover(g: CanvasRenderingContext2D, img: HTMLImageElement | null, w: number, h: number): void {
  g.fillStyle = '#07130d'; g.fillRect(0, 0, w, h)
  if (!img) return
  const k = Math.max(w / img.width, h / img.height)
  g.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k)
}

/** A QR code for `link` on a white rounded tile. */
function qr(g: CanvasRenderingContext2D, link: string, x: number, y: number, size: number): void {
  const q = qrcode(0, 'M'); q.addData(link); q.make()
  const n = q.getModuleCount(), pad = Math.round(size * 0.07), cell = (size - pad * 2) / n
  g.fillStyle = '#ffffff'; rr(g, x, y, size, size, size * 0.09); g.fill()
  g.fillStyle = '#0b100d'
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(x + pad + c * cell, y + pad + r * cell, Math.ceil(cell), Math.ceil(cell))
}

function logoAt(g: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, y: number, w: number): void {
  if (logo) { g.drawImage(logo, x, y, w, (w * logo.height) / logo.width); return }
  g.fillStyle = MINT; g.font = `900 ${Math.round(w * 0.2)}px ${DISPLAY}`; g.textBaseline = 'top'; g.fillText('GRIND DISTRICT', x, y); g.textBaseline = 'alphabetic'
}

/** The gold hairline frame round a card. */
function frame(g: CanvasRenderingContext2D, w: number, h: number, inset: number): void {
  const line = g.createLinearGradient(0, 0, w, h); line.addColorStop(0, GOLD_DEEP); line.addColorStop(0.5, GOLD); line.addColorStop(1, GOLD_DEEP)
  g.strokeStyle = line; g.lineWidth = 3; rr(g, inset, inset, w - inset * 2, h - inset * 2, 34); g.stroke()
}

/** The call to play: a glass band with the words, the address and a QR code. */
function ctaBand(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, head: string, sub: string, link: string): void {
  g.save()
  g.fillStyle = 'rgba(8, 20, 14, 0.78)'; rr(g, x, y, w, h, 30); g.fill()
  g.strokeStyle = 'rgba(233, 207, 142, 0.45)'; g.lineWidth = 2; g.stroke()
  const qs = h - 48
  qr(g, link, x + w - qs - 24, y + 24, qs)
  const tx = x + 36, maxW = w - qs - 96
  g.fillStyle = INK; g.font = `800 46px ${SANS}`; g.fillText(head, tx, y + 74, maxW)
  g.fillStyle = 'rgba(247, 243, 234, 0.78)'; g.font = `500 27px ${SANS}`; g.fillText(sub, tx, y + 116, maxW)
  // The play key.
  const bw = Math.min(maxW, 380), by = y + h - 92
  const key = g.createLinearGradient(0, by, 0, by + 64); key.addColorStop(0, '#3bfaa4'); key.addColorStop(1, '#12d77c')
  g.fillStyle = '#0a7a46'; rr(g, tx, by + 5, bw, 64, 32); g.fill()
  g.fillStyle = key; rr(g, tx, by, bw, 64, 32); g.fill()
  g.fillStyle = '#04160e'; g.font = `800 28px ${SANS}`; g.textAlign = 'center'; g.fillText('grinddistrict.app  →', tx + bw / 2, by + 42)
  g.restore()
}

/** The city stats as a premium card: the live headline figures, the learning numbers and a call to join. */
export async function statsShareArt(card: StatCard): Promise<HTMLCanvasElement> {
  const { logo, city } = await ready()
  const W = 1080, H = 1350
  const [c, g] = canvasOf(W, H)
  cover(g, city, W, H)
  // Darken for the words: lighter at the top so the city shows, deep at the foot.
  const shade = g.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(4, 12, 8, 0.58)'); shade.addColorStop(0.35, 'rgba(4, 12, 8, 0.72)'); shade.addColorStop(1, 'rgba(3, 9, 6, 0.96)')
  g.fillStyle = shade; g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(170, 120, 10, 170, 120, 620); glow.addColorStop(0, 'rgba(233, 207, 142, 0.22)'); glow.addColorStop(1, 'rgba(233, 207, 142, 0)')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)
  frame(g, W, H, 26)
  logoAt(g, logo, 70, 66, 230)
  // The live pill.
  const pill = 'LIVE CITY STATS'
  g.font = `800 24px ${SANS}`
  const pw = g.measureText(pill).width + 76
  g.fillStyle = 'rgba(8, 20, 14, 0.82)'; rr(g, W - 70 - pw, 82, pw, 56, 28); g.fill(); g.strokeStyle = 'rgba(59, 250, 164, 0.5)'; g.lineWidth = 2; g.stroke()
  g.fillStyle = MINT; g.beginPath(); g.arc(W - 70 - pw + 32, 110, 9, 0, Math.PI * 2); g.fill()
  g.fillStyle = INK; g.fillText(pill, W - 70 - pw + 52, 119)
  // Headline.
  g.fillStyle = INK; g.font = `900 76px ${DISPLAY}`
  g.fillText('A whole city', 70, 330); g.fillText('learning Web3.', 70, 414)
  g.fillStyle = 'rgba(247, 243, 234, 0.8)'; g.font = `500 32px ${SANS}`
  g.fillText('Real players, real lessons, one shared 3D city. Free.', 70, 470, W - 140)
  // Headline figures: up to three glass tiles.
  // Always three tiles: the live figures first, then plain facts if some figures did not load.
  const facts = [{ label: 'To play', value: 'Free' }, { label: 'Live city', value: '24/7' }, { label: 'Web3 CV', value: 'Yours' }]
  const hero = [...card.hero, ...facts].slice(0, 3)
  const gap = 22, tw = (W - 140 - gap * (hero.length - 1)) / Math.max(1, hero.length)
  hero.forEach((t, i) => {
    const x = 70 + i * (tw + gap), y = 530
    g.fillStyle = 'rgba(255, 255, 255, 0.08)'; rr(g, x, y, tw, 200, 28); g.fill()
    g.strokeStyle = i === 0 ? 'rgba(59, 250, 164, 0.55)' : 'rgba(233, 207, 142, 0.4)'; g.lineWidth = 2; g.stroke()
    g.fillStyle = i === 0 ? MINT : GOLD; g.font = `800 ${t.value.length > 5 ? 66 : 82}px ${SANS}`; g.fillText(t.value, x + 30, y + 112, tw - 60)
    g.fillStyle = 'rgba(247, 243, 234, 0.78)'; g.font = `700 24px ${SANS}`; g.fillText(t.label.toUpperCase(), x + 30, y + 162, tw - 60)
  })
  // Learning figures (when they loaded): a row of four.
  const learn = card.sections.find((s) => s.title === 'Learning')?.tiles ?? card.sections.find((s) => s.title === 'Players')?.tiles ?? []
  const row = learn.slice(0, 4)
  if (!row.length) {
    g.strokeStyle = 'rgba(233, 207, 142, 0.3)'; g.lineWidth = 2
    g.beginPath(); g.moveTo(70, 770); g.lineTo(W - 70, 770); g.stroke()
    g.fillStyle = INK; g.font = `800 46px ${SANS}`; g.fillText('Learn · Work · Trade · Get certified', 70, 860, W - 140)
    g.fillStyle = 'rgba(247, 243, 234, 0.68)'; g.font = `600 24px ${SANS}`; g.fillText('Every course you pass goes on your CV, with a certificate you can share.', 70, 900, W - 140)
  }
  if (row.length) {
    const lw = (W - 140) / row.length
    g.strokeStyle = 'rgba(233, 207, 142, 0.3)'; g.lineWidth = 2
    g.beginPath(); g.moveTo(70, 770); g.lineTo(W - 70, 770); g.stroke()
    row.forEach((t, i) => {
      const x = 70 + i * lw
      if (i) { g.beginPath(); g.moveTo(x, 800); g.lineTo(x, 900); g.stroke() }
      g.fillStyle = INK; g.font = `800 54px ${SANS}`; g.fillText(t.value, x + (i ? 26 : 0), 860, lw - 30)
      g.fillStyle = 'rgba(247, 243, 234, 0.68)'; g.font = `600 22px ${SANS}`; g.fillText(t.label, x + (i ? 26 : 0), 896, lw - 30)
    })
  }
  ctaBand(g, 70, 960, W - 140, 300, 'Come build your Web3 CV', 'Play free in your browser · phone or computer', `${SITE}/?src=stats-card`)
  g.fillStyle = 'rgba(247, 243, 234, 0.5)'; g.font = `500 20px ${SANS}`; g.textAlign = 'center'
  g.fillText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, H - 44)
  return c
}

/** Paint a flyer into a box (fit, centred), with a soft shadow and a thin print border. */
function placeFlyer(g: CanvasRenderingContext2D, f: Flyer, bx: number, by: number, bw: number, bh: number): { x: number; y: number; w: number; h: number } {
  const k = Math.min(bw / f.w, bh / f.h), w = f.w * k, h = f.h * k, x = bx + (bw - w) / 2, y = by + (bh - h) / 2
  g.save()
  g.shadowColor = 'rgba(0, 0, 0, 0.55)'; g.shadowBlur = 50; g.shadowOffsetY = 24
  g.fillStyle = '#f7f3ea'; g.fillRect(x - 10, y - 10, w + 20, h + 20)
  g.restore()
  g.save(); g.translate(x, y); g.scale(k, k); f.paint(g); g.restore()
  return { x, y, w, h }
}

/** Background for a flyer card: the McGrind greens with a light behind the poster. */
function flyerBack(g: CanvasRenderingContext2D, W: number, H: number, cx: number, cy: number): void {
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#08281a'); bg.addColorStop(0.55, '#0b3a25'); bg.addColorStop(1, '#04140c')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.fillStyle = 'rgba(23, 247, 144, 0.05)'; for (let k = -10; k < 40; k++) { g.save(); g.translate(k * 70, 0); g.rotate(0.35); g.fillRect(0, -200, 24, H + 400); g.restore() }
  const glow = g.createRadialGradient(cx, cy, 20, cx, cy, Math.max(W, H) * 0.55); glow.addColorStop(0, 'rgba(233, 207, 142, 0.28)'); glow.addColorStop(1, 'rgba(233, 207, 142, 0)')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)
}

/** A flyer as a 1080 x 1350 card to share: the poster itself, then the logo and the call to play. */
export async function flyerShareArt(f: Flyer): Promise<HTMLCanvasElement> {
  const { logo } = await ready()
  const W = 1080, H = 1350
  const [c, g] = canvasOf(W, H)
  const portrait = f.h > f.w
  const box = portrait ? { x: 250, y: 90, w: 580, h: 870 } : { x: 70, y: 200, w: 940, h: 560 }
  flyerBack(g, W, H, W / 2, box.y + box.h / 2)
  frame(g, W, H, 26)
  if (!portrait) logoAt(g, logo, 70, 70, 200)
  placeFlyer(g, f, box.x, box.y, box.w, box.h)
  if (!portrait) { g.fillStyle = INK; g.font = `900 52px ${DISPLAY}`; g.fillText('Seen in Grind District', 70, 870, W - 140) }
  ctaBand(g, 70, 1000, W - 140, 290, 'Work a shift in Grind District', 'A free 3D city where you learn Web3', `${SITE}/p/${f.id}`)
  if (portrait) logoAt(g, logo, 56, 70, 160)
  return c
}

/** A flyer's 1200 x 630 link preview (what X, Farcaster and chats show for /p/<id>). */
export async function flyerPreviewArt(f: Flyer): Promise<HTMLCanvasElement> {
  const { logo } = await ready()
  const W = 1200, H = 630
  const [c, g] = canvasOf(W, H)
  const portrait = f.h > f.w
  const box = portrait ? { x: 70, y: 40, w: 370, h: 550 } : { x: 50, y: 150, w: 600, h: 330 }
  flyerBack(g, W, H, box.x + box.w / 2, H / 2)
  frame(g, W, H, 18)
  placeFlyer(g, f, box.x, box.y, box.w, box.h)
  const tx = portrait ? 500 : 700, tw = W - tx - 60
  logoAt(g, logo, tx, 64, 190)
  g.fillStyle = INK; g.font = `900 ${portrait ? 50 : 40}px ${DISPLAY}`
  const words = f.title.replace(/^McGrind:\s*/, '').split(' ')
  let line = '', y = 250
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > tw && line) { g.fillText(line, tx, y); line = w; y += 58 } else line = t }
  if (line) g.fillText(line, tx, y)
  g.fillStyle = 'rgba(247, 243, 234, 0.82)'; g.font = `500 26px ${SANS}`; g.fillText('McGrind is hiring in Grind District,', tx, y + 56, tw); g.fillText('a free 3D city where you learn Web3.', tx, y + 90, tw)
  const by = H - 128
  const key = g.createLinearGradient(0, by, 0, by + 64); key.addColorStop(0, '#3bfaa4'); key.addColorStop(1, '#12d77c')
  g.fillStyle = '#0a7a46'; rr(g, tx, by + 5, 360, 64, 32); g.fill(); g.fillStyle = key; rr(g, tx, by, 360, 64, 32); g.fill()
  g.fillStyle = '#04160e'; g.font = `800 27px ${SANS}`; g.textAlign = 'center'; g.fillText('Play free  →', tx + 180, by + 42)
  return c
}
