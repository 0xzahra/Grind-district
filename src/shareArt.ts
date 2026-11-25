// The pictures players share: the city stats card and any flyer (McGrind posters today), as 1080 x 1350 portrait
// cards (the size feeds and stories show best), plus the 1200 x 630 link-preview version of a flyer. All of them
// carry the game logo, a clear call to play and a QR code to the site. Drawn on demand, nothing kept.
import qrcode from 'qrcode-generator'
import { loadPicture, SITE } from './sharePicture.ts'
import type { Flyer } from './posters.ts'
import type { PublicStats } from './statsPanel.ts'

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

/** A number for a card: 1,587 or 12.4k. */
const big = (v: number | undefined) => { const x = Math.max(0, Math.round(Number(v) || 0)); return x >= 10000 ? `${(x / 1000).toFixed(x >= 100000 ? 0 : 1)}k` : x.toLocaleString('en-US') }

/** Base's mark (a blue disc with a bar) and NEAR's (an N in a dark tile), small, for the on-chain panel. */
function chainMarks(g: CanvasRenderingContext2D, x: number, y: number): number {
  g.fillStyle = '#0052ff'; g.beginPath(); g.arc(x + 18, y + 18, 18, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#ffffff'; g.fillRect(x + 6, y + 15, 17, 6)
  g.fillStyle = '#f7f3ea'; rr(g, x + 44, y, 36, 36, 9); g.fill()
  g.strokeStyle = '#0b100d'; g.lineWidth = 4; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(x + 53, y + 27); g.lineTo(x + 53, y + 9); g.lineTo(x + 71, y + 27); g.lineTo(x + 71, y + 9); g.stroke()
  return 80
}

/** The city stats as a premium card: the totals so far (players, courses, certificates), the city and learning
 *  numbers, everything on-chain (Base and NEAR together), and a call to play with a QR code. No "online now". */
export async function statsShareArt(st: PublicStats | null): Promise<HTMLCanvasElement> {
  const { logo, city } = await ready()
  const W = 1080, H = 1350
  const [c, g] = canvasOf(W, H)
  cover(g, city, W, H)
  const shade = g.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(4, 12, 8, 0.42)'); shade.addColorStop(0.3, 'rgba(4, 12, 8, 0.8)'); shade.addColorStop(0.5, 'rgba(4, 11, 7, 0.96)'); shade.addColorStop(1, 'rgba(3, 8, 5, 1)')
  g.fillStyle = shade; g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W * 0.8, 560, 10, W * 0.8, 560, 620); glow.addColorStop(0, 'rgba(59, 250, 164, 0.13)'); glow.addColorStop(1, 'rgba(59, 250, 164, 0)')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)
  frame(g, W, H, 26)
  logoAt(g, logo, 70, 62, 210)
  // Date pill.
  const pill = `CITY STATS · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`
  g.font = `800 22px ${SANS}`
  const pw = g.measureText(pill).width + 72
  g.fillStyle = 'rgba(8, 20, 14, 0.85)'; rr(g, W - 70 - pw, 80, pw, 54, 27); g.fill(); g.strokeStyle = 'rgba(233, 207, 142, 0.6)'; g.lineWidth = 2; g.stroke()
  g.fillStyle = GOLD; g.beginPath(); g.arc(W - 70 - pw + 30, 107, 8, 0, Math.PI * 2); g.fill()
  g.fillStyle = INK; g.fillText(pill, W - 70 - pw + 48, 115)
  // Headline.
  g.fillStyle = INK; g.font = `900 78px ${SANS}`; g.fillText('Grind District', 70, 312)
  const gold = g.createLinearGradient(70, 330, 520, 400); gold.addColorStop(0, '#f6dc96'); gold.addColorStop(1, '#c99a45')
  g.fillStyle = gold; g.fillText('in numbers.', 70, 396)
  g.fillStyle = 'rgba(247, 243, 234, 0.78)'; g.font = `500 28px ${SANS}`
  g.fillText('A free 3D city where people learn Web3 together.', 70, 446, W - 140)
  if (!st) {
    g.fillStyle = INK; g.font = `700 40px ${SANS}`; g.fillText('Learn · Work · Trade · Get certified', 70, 560, W - 140)
    ctaBand(g, 70, 1030, W - 140, 260, 'Learn Web3. Earn your CV.', 'Free in your browser · phone or computer', `${SITE}/?src=stats-card`)
    return c
  }
  // The totals so far: three big figures.
  const hero: Array<[string, string]> = [['Players', big(st.registered)], ['Courses passed', big(st.lessonsPassed)], ['Certificates', big(st.certificates)]]
  const gap = 20, tw = (W - 140 - gap * 2) / 3
  hero.forEach(([label, value], i) => {
    const x = 70 + i * (tw + gap), y = 486
    const face = g.createLinearGradient(0, y, 0, y + 196); face.addColorStop(0, 'rgba(255, 255, 255, 0.1)'); face.addColorStop(1, 'rgba(255, 255, 255, 0.03)')
    g.fillStyle = face; rr(g, x, y, tw, 196, 26); g.fill()
    g.strokeStyle = i === 0 ? 'rgba(59, 250, 164, 0.6)' : 'rgba(233, 207, 142, 0.5)'; g.lineWidth = 2; g.stroke()
    const num = g.createLinearGradient(0, y + 40, 0, y + 130); num.addColorStop(0, i === 0 ? '#8affc9' : '#f6dc96'); num.addColorStop(1, i === 0 ? '#2fd67d' : '#c99a45')
    g.fillStyle = num; g.font = `900 ${value.length > 5 ? 70 : 86}px ${SANS}`; g.fillText(value, x + 28, y + 118, tw - 56)
    g.fillStyle = 'rgba(247, 243, 234, 0.8)'; g.font = `800 20px ${SANS}`; g.fillText(label.toUpperCase(), x + 28, y + 160, tw - 56)
  })
  // The city and learning, in a row of four.
  const row: Array<[string, string]> = []
  if (typeof st.visitorsAll === 'number') row.push(['Visitors', big(st.visitorsAll)])
  if (typeof st.learners === 'number') row.push(['Learners', big(st.learners)])
  row.push(['Sign-ins', big(st.signIns)])
  if (typeof st.returning7d === 'number') row.push(['Came back in 7 days', big(st.returning7d)])
  const rw = (W - 140) / row.length
  g.strokeStyle = 'rgba(233, 207, 142, 0.28)'; g.lineWidth = 2
  row.forEach(([label, value], i) => {
    const x = 70 + i * rw
    if (i) { g.beginPath(); g.moveTo(x, 716); g.lineTo(x, 808); g.stroke() }
    g.fillStyle = INK; g.font = `800 50px ${SANS}`; g.fillText(value, x + (i ? 24 : 4), 772, rw - 30)
    g.fillStyle = 'rgba(247, 243, 234, 0.66)'; g.font = `600 20px ${SANS}`; g.fillText(label, x + (i ? 24 : 4), 804, rw - 30)
  })
  // On-chain: Base and NEAR together.
  const py = 840, ph = 166
  g.fillStyle = 'rgba(10, 26, 18, 0.88)'; rr(g, 70, py, W - 140, ph, 26); g.fill()
  g.strokeStyle = 'rgba(233, 207, 142, 0.55)'; g.lineWidth = 2; g.stroke()
  const mw = chainMarks(g, 100, py + 22)
  g.fillStyle = GOLD; g.font = `800 22px ${SANS}`; g.fillText('ON-CHAIN · BASE + NEAR', 100 + mw + 18, py + 48)
  const minted = st.mintsBase + st.mintsNear
  const chain: Array<[string, string]> = [['Certificates minted', big(minted)], ['Wallets linked', big(st.walletConnections)]]
  if (typeof st.nearAccounts === 'number') chain.push(['NEAR accounts', big(st.nearAccounts)])
  chain.push(['AI agents', big(st.agentsRegistered)])
  const cw = (W - 200) / chain.length
  chain.forEach(([label, value], i) => {
    const x = 100 + i * cw
    g.fillStyle = INK; g.font = `800 46px ${SANS}`; g.fillText(value, x, py + 114, cw - 20)
    g.fillStyle = 'rgba(247, 243, 234, 0.66)'; g.font = `600 19px ${SANS}`; g.fillText(label, x, py + 146, cw - 20)
  })
  ctaBand(g, 70, 1036, W - 140, 254, 'Learn Web3. Earn your CV.', 'Free in your browser · phone or computer', `${SITE}/?src=stats-card`)
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
