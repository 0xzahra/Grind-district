// Graduation: the Campus diploma. You graduate once every core course in the six Campus worlds is passed
// (missions and final checks); the ceremony itself is graduation.ts (lazy). This file is light: progress, the
// graduated flag beside the save, and the diploma drawn on a canvas to download or share.
import { getSave, slotKey } from './state.ts'
import { WORLDS } from './worlds.ts'

const KEY = () => `${slotKey()}.graduated`
export const CORE = (): string[] => WORLDS.flatMap((w) => [...w.missions, ...(w.boss ? [w.boss] : [])])
export function campusProgress(): { passed: number; total: number } {
  const s = getSave(), core = CORE()
  return { passed: core.filter((id) => (s.skills as Record<string, { passed?: boolean } | undefined>)[id]?.passed).length, total: core.length }
}
export const canGraduate = (): boolean => { const p = campusProgress(); return p.passed >= p.total }
export function graduatedOn(): string | null { try { return localStorage.getItem(KEY()) } catch { return null } }
export function markGraduated(): void { try { if (!localStorage.getItem(KEY())) localStorage.setItem(KEY(), new Date().toISOString().slice(0, 10)) } catch { /* private mode */ } }

/** A short printed serial for the diploma (stable for the player and the day they graduated). */
export function diplomaSerial(user: string, on: string): string {
  let h = 2166136261
  for (const ch of `${user}|${on}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) { out += A[h % 32]; h = Math.floor(h / 32) + i * 7919 }
  return `GD-DIP-${out}`
}

/** The diploma, in the same premium language as the minted certificates: ivory paper with linen texture, a
 *  guilloche frame, corner ornaments, gold-foil type, the Campus seal with green ribbons, and Zahra's signature. */
export async function diplomaCanvas(name: string, on: string): Promise<HTMLCanvasElement> {
  const [{ certArt: A, CERT_W: W, CERT_H: H }, { certAssets }] = await Promise.all([import('../api/_certArt.ts'), import('./certs.ts')])
  const img = await certAssets()
  const a = { ...img, makeCanvas: (w: number, h: number) => { const o = document.createElement('canvas'); o.width = w; o.height = h; return o } }
  const s = getSave(), user = s.username || 'player', cx = W / 2
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const { F, C, foil, spaced, fit, diamond, ruleWithDiamond, tinted, guilloche, cornerOrnament, seal } = A
  g.textBaseline = 'alphabetic'; g.textAlign = 'center'
  // Paper, linen, rosette and the shrimp watermark.
  const bg = g.createRadialGradient(cx, H * 0.42, 80, cx, H * 0.5, W * 0.72)
  bg.addColorStop(0, '#fffcf6'); bg.addColorStop(0.55, '#f7f1e6'); bg.addColorStop(1, '#e8dcc5')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  g.save(); g.globalAlpha = 0.07; g.strokeStyle = '#c9a25e'; g.lineWidth = 1
  for (let x = -H; x < W; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke() }
  g.restore()
  g.save(); g.translate(cx, 560); g.strokeStyle = 'rgba(184,144,62,0.10)'; g.lineWidth = 1
  for (let i = 0; i < 48; i += 1) { g.rotate(Math.PI / 48); g.beginPath(); g.ellipse(0, 0, 420, 150, 0, 0, Math.PI * 2); g.stroke() }
  g.restore()
  const ww = 600, wh = (ww * a.shrimp.height) / a.shrimp.width
  g.save(); g.globalAlpha = 0.06
  g.drawImage(tinted(a, a.shrimp, ww, wh, (t) => { t.fillStyle = '#c9a25e' }), cx - ww / 2, 560 - wh / 2, ww, wh)
  g.restore()
  // Frames: a deep green outer band (the Campus colour) inside the foil line, then the guilloche and corners.
  const o = 30
  g.fillStyle = '#123524'; g.fillRect(0, 0, W, o); g.fillRect(0, H - o, W, o); g.fillRect(0, 0, o, H); g.fillRect(W - o, 0, o, H)
  g.strokeStyle = foil(g, 0, W, 0, H); g.lineWidth = 5; g.strokeRect(o, o, W - 2 * o, H - 2 * o)
  g.lineWidth = 1; g.strokeStyle = 'rgba(233,205,143,0.75)'; g.strokeRect(o + 10, o + 10, W - 2 * (o + 10), H - 2 * (o + 10))
  guilloche(g, o + 14, o + 14, W - o - 14, H - o - 14, 30)
  const ib = o + 50
  g.strokeStyle = 'rgba(233,205,143,0.9)'; g.lineWidth = 1.6; g.strokeRect(ib, ib, W - 2 * ib, H - 2 * ib)
  g.strokeStyle = 'rgba(201,162,94,0.45)'; g.lineWidth = 0.75; g.strokeRect(ib + 7, ib + 7, W - 2 * (ib + 7), H - 2 * (ib + 7))
  const co = ib + 16
  cornerOrnament(g, co, co, 1, 1); cornerOrnament(g, W - co, co, -1, 1); cornerOrnament(g, co, H - co, 1, -1); cornerOrnament(g, W - co, H - co, -1, -1)
  // Lockup, then DIPLOMA in large foil capitals.
  const lh = 100, lw = (lh * a.lockup.width) / a.lockup.height
  g.drawImage(a.lockup, cx - lw / 2, 104, lw, lh)
  g.fillStyle = C.gold; g.font = `600 19px ${F.sans}`
  spaced(g, 'GRIND DISTRICT CAMPUS', cx, 242, 8)
  g.fillStyle = foil(g, cx - 300, cx + 300, 250, 330); g.font = `600 92px ${F.serif}`
  const dw = spaced(g, 'DIPLOMA', cx, 328, 22)
  g.strokeStyle = 'rgba(233,205,143,0.8)'; g.lineWidth = 1
  for (const sd of [-1, 1]) { const x = cx + sd * (dw / 2 + 30); g.beginPath(); g.moveTo(x, 300); g.lineTo(x + sd * 150, 300); g.stroke(); g.fillStyle = '#e9cd8f'; diamond(g, x + sd * 158, 300, 4) }
  g.fillStyle = C.muted; g.font = `italic 400 33px ${F.serif}`
  g.fillText('This is to certify that', cx, 388)
  fit(g, name, (px) => `italic 600 ${px}px ${F.serif}`, 112, 54, 1100)
  g.fillStyle = foil(g, cx - 520, cx + 520, 396, 506)
  g.fillText(name, cx, 486)
  ruleWithDiamond(g, cx, 520, 380)
  g.fillStyle = C.sand; g.font = `500 22px ${F.sans}`
  spaced(g, `@${user}`, cx, 560, 3.2)
  g.fillStyle = C.muted; g.font = `italic 400 30px ${F.serif}`
  g.fillText(`having passed all ${CORE().length} core courses across the six worlds of study, is awarded the`, cx, 614, 1200)
  g.fillStyle = C.ink
  const t = 'DIPLOMA IN WEB3 FOUNDATIONS'
  const tpx = fit(g, t, (px) => `600 ${px}px ${F.sans}`, 50, 30, 1150)
  g.font = `600 ${tpx}px ${F.sans}`; spaced(g, t, cx, 678, tpx * 0.08)
  g.fillStyle = C.gold; g.font = `600 15px ${F.sans}`
  const worlds = WORLDS.map((w) => w.title.toUpperCase())
  spaced(g, worlds.slice(0, 3).join('   ·   '), cx, 716, 2.6)
  spaced(g, worlds.slice(3).join('   ·   '), cx, 740, 2.6)
  // Bottom: graduation date · seal · Zahra's signature.
  const lx = 400, rx = W - 400, by = 866
  g.fillStyle = C.ink; g.font = `500 28px ${F.sans}`
  g.fillText(new Date(`${on}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), lx, by)
  g.font = `italic 600 54px ${F.serif}`; g.fillStyle = foil(g, rx - 160, rx + 160, by - 50, by + 10)
  g.fillText('Zahra', rx, by)
  for (const x of [lx, rx]) {
    const gr = g.createLinearGradient(x - 210, 0, x + 210, 0)
    gr.addColorStop(0, 'rgba(201,162,94,0)'); gr.addColorStop(0.5, 'rgba(201,162,94,0.9)'); gr.addColorStop(1, 'rgba(201,162,94,0)')
    g.strokeStyle = gr; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 210, by + 22); g.lineTo(x + 210, by + 22); g.stroke()
  }
  g.fillStyle = C.gold; g.font = `600 14px ${F.sans}`
  spaced(g, 'DATE OF GRADUATION', lx, by + 52, 3.4)
  spaced(g, 'CAMPUS MENTOR', rx, by + 52, 3.4)
  g.fillStyle = C.dim; g.font = `400 15px ${F.sans}`
  g.fillText('Conferred in the Great Hall', lx, by + 80)
  g.fillText('Grind District Campus', rx, by + 80)
  seal(g, a, cx, 852, 'GRIND DISTRICT  ✦  CAMPUS DIPLOMA  ✦  ')
  g.fillStyle = C.dim; g.font = `400 16px ${F.sans}`
  g.fillText('Practice credential, earned by passing every core course in Grind District. Not an accredited qualification.', cx, H - 124)
  g.font = `500 14px ${F.sans}`
  spaced(g, `DIPLOMA Nº ${diplomaSerial(user, on)}   ·   CLASS OF ${on.slice(0, 4)}   ·   GRINDDISTRICT.APP`, cx, H - 98, 2.2)
  return c
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement }
/** The Graduation panel: progress, or your diploma with download and share. */
export function diplomaNodes(h: H, attend: () => void): HTMLElement[] {
  const out: HTMLElement[] = []
  const p = campusProgress(), on = graduatedOn()
  if (!canGraduate()) {
    out.push(h.para(`Graduation comes when every core course in the six Campus worlds is passed: ${p.passed} of ${p.total} so far. ${p.total - p.passed} to go.`))
    out.push(h.para('Then there is a ceremony in the Great Hall: cap and gown, your name called, the diploma from Zahra on stage, and the cap toss.'))
    return out
  }
  if (!on) {
    out.push(h.para(`All ${p.total} courses passed. Your graduation is ready: cap and gown are waiting in the Great Hall.`))
    out.push(h.button('Attend your graduation 🎓', 'primary', attend))
    return out
  }
  const name = (getSave().name || getSave().username || 'Graduate').trim()
  const img = document.createElement('img'); img.alt = `Diploma in Web3 Foundations, ${name}`; img.className = 'diploma-img'
  void diplomaCanvas(name, on).then((c) => { img.src = c.toDataURL('image/png') })
  out.push(img)
  out.push(h.button('Download the diploma', 'primary', () => { if (!img.src) return; const a = document.createElement('a'); a.href = img.src; a.download = 'grind-district-diploma.png'; a.click() }))
  out.push(h.button('Share on 𝕏', 'ghost', () => window.open(`https://x.com/intent/post?text=${encodeURIComponent('I just graduated from Grind District Campus with a Diploma in Web3 Foundations 🎓')}&url=${encodeURIComponent('https://www.grinddistrict.app')}`, '_blank', 'noopener')))
  out.push(h.button('Relive the ceremony', 'ghost', attend))
  return out
}
