// McGrind kitchen art: the shift's counter and its four stations drawn on canvases, with the cook's gloved hands
// doing each job (lowering the fry basket, flipping with the spatula, shaving the spit, holding the cup under the
// tap, sliding the tray across) and customers who walk up, order, wait, take their tray and go.
// Pure drawing: the shift's rules live in mcgrind.ts and tell this file what happened. Each scene is drawn in a
// fixed virtual size and scaled to its canvas; its still parts (tiles, steel, machines) are painted once into a
// cached layer, so a frame is one image copy plus a few hundred simple shapes.
import { MCGRIND_BRIGHT, MCGRIND_GREEN } from './brandFronts.ts'

export type Item = 'fries' | 'burger' | 'shawarma' | 'shake' | 'smoothie' | 'boba'
type Drink = 'shake' | 'smoothie' | 'boba'
type G = CanvasRenderingContext2D
type Pt = [number, number]

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const seg = (k: number, a: number, b: number) => clamp((k - a) / (b - a))
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2)
const easeOut = (k: number) => 1 - (1 - k) ** 3
const easeIn = (k: number) => k * k
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const lp = (a: Pt, b: Pt, k: number): Pt => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)]
const nowS = () => performance.now() / 1000
const FONT = 'Inter, system-ui, sans-serif'
export const GOOD = '#17f790', OKAY = '#ffd36b', BAD = '#ff6b5b'

function hex(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function mix(a: string, b: string, k: number): string {
  const x = hex(a), y = hex(b)
  const c = (i: 0 | 1 | 2) => Math.round(lerp(x[i], y[i], clamp(k)))
  return '#' + ((1 << 24) + (c(0) << 16) + (c(1) << 8) + c(2)).toString(16).slice(1)
}
function ramp(stops: Array<[number, string]>, v: number): string {
  if (v <= stops[0]![0]) return stops[0]![1]
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i]!
    if (v <= b) { const [a, ca] = stops[i - 1]!; return mix(ca, cb, (v - a) / (b - a)) }
  }
  return stops[stops.length - 1]![1]
}
function line(g: G, x1: number, y1: number, x2: number, y2: number): void { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke() }
function rr(g: G, x: number, y: number, w: number, h: number, r: number): void { g.beginPath(); g.roundRect(x, y, w, h, r) }
function ell(g: G, x: number, y: number, rx: number, ry: number, rot = 0): void { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2) }
function poly(g: G, pts: number[]): void { g.beginPath(); g.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!); g.closePath() }

/** How sharp the kitchen draws: full on most screens, a little softer on phones in Light performance. */
export function kitchenDpr(lite: boolean): number { return lite ? 1.25 : 2 }

// ---------------------------------------------------------------------------------------------------------------
// A canvas with a fixed virtual size, its backing store sized to the element, and a cached layer of still parts.
export class View {
  readonly c = document.createElement('canvas')
  readonly g: G
  private layer = document.createElement('canvas')
  private dirty = true
  private painted = false
  private ro: ResizeObserver | null = null
  private io: IntersectionObserver | null = null
  private s = 1
  shown = true
  readonly vw: number
  readonly vh: number
  private still: (g: G) => void
  constructor(vw: number, vh: number, still: (g: G) => void) {
    this.vw = vw; this.vh = vh; this.still = still
    this.g = this.c.getContext('2d')!
    this.c.style.aspectRatio = `${vw} / ${vh}`
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => { this.dirty = true }); this.ro.observe(this.c) }
    if (typeof IntersectionObserver !== 'undefined') { this.io = new IntersectionObserver((es) => { for (const e of es) this.shown = e.isIntersecting }); this.io.observe(this.c) }
  }
  /** Start a frame (false when the canvas has no size yet or is scrolled away); the context is left in virtual units. */
  begin(maxDpr: number): boolean {
    if (!this.shown) return false
    if (this.dirty || !this.painted) {
      const cw = this.c.clientWidth
      if (!cw) return false
      this.dirty = false
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1)
      const bw = Math.max(1, Math.round(cw * dpr)), bh = Math.max(1, Math.round((cw * dpr * this.vh) / this.vw))
      if (!this.painted || bw !== this.c.width || bh !== this.c.height) {
        this.c.width = this.layer.width = bw
        this.c.height = this.layer.height = bh
        this.s = bw / this.vw
        const lg = this.layer.getContext('2d')!
        lg.setTransform(this.s, 0, 0, this.s, 0, 0)
        this.still(lg)
        this.painted = true
      }
    }
    const g = this.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = 1
    g.drawImage(this.layer, 0, 0)
    g.setTransform(this.s, 0, 0, this.s, 0, 0)
    return true
  }
  /** Virtual coordinates of a pointer. */
  at(e: { clientX: number; clientY: number }): Pt {
    const r = this.c.getBoundingClientRect()
    return [((e.clientX - r.left) / Math.max(1, r.width)) * this.vw, ((e.clientY - r.top) / Math.max(1, r.height)) * this.vh]
  }
  stop(): void { this.ro?.disconnect(); this.io?.disconnect() }
}

// ---------------------------------------------------------------------------------------------------------------
// The cook's hands: blue food-safe gloves, McGrind green sleeves.
const GLOVE = '#4b8fe2', GLOVE_D = '#24589f', GLOVE_L = '#a6cbf8', SLEEVE = '#0f7a48', SLEEVE_D = '#0a5533'
type Pose = 'open' | 'grip'
const FINGERS: Record<Pose, Array<[number, number, number]>> = {
  // x across the hand, length, splay (radians); index finger first (beside the thumb)
  open: [[-0.31, 0.58, -0.12], [-0.1, 0.68, -0.04], [0.11, 0.63, 0.04], [0.31, 0.48, 0.13]],
  grip: [[-0.31, 0.2, 0], [-0.1, 0.23, 0], [0.11, 0.22, 0], [0.31, 0.18, 0]],
}
/**
 * A gloved hand, palm at (x, y), fingers along angle a (0 = up the screen, clockwise positive), its arm reaching in
 * from `base`. `left` mirrors it (thumb on the other side).
 */
export function hand(g: G, x: number, y: number, a: number, pose: Pose, base: Pt, s = 20, left = false): void {
  const ca = Math.cos(a), sa = Math.sin(a)
  const wx = x - 0.5 * s * sa, wy = y + 0.5 * s * ca
  const dx = base[0] - wx, dy = base[1] - wy, d = Math.hypot(dx, dy) || 1
  const ux = dx / d, uy = dy / d
  const cx = wx + ux * s * 0.95, cy = wy + uy * s * 0.95
  g.lineCap = 'round'
  // glove cuff, then the sleeve over it, then the sleeve's bright hem
  g.strokeStyle = GLOVE_D; g.lineWidth = s * 0.86; line(g, wx, wy, cx + ux * 4, cy + uy * 4)
  g.strokeStyle = GLOVE; g.lineWidth = s * 0.72; line(g, wx, wy, cx + ux * 4, cy + uy * 4)
  g.lineCap = 'butt'
  g.strokeStyle = SLEEVE_D; g.lineWidth = s * 1.12; line(g, cx, cy, base[0], base[1])
  g.strokeStyle = SLEEVE; g.lineWidth = s * 0.98; line(g, cx, cy, base[0], base[1])
  g.strokeStyle = MCGRIND_BRIGHT; g.lineWidth = s * 0.13; line(g, cx - uy * s * 0.52, cy + ux * s * 0.52, cx + uy * s * 0.52, cy - ux * s * 0.52)
  g.lineCap = 'round'
  g.save()
  g.translate(x, y); g.rotate(a); g.scale(left ? -s : s, s)
  const f = FINGERS[pose]
  const thumb: [number, number, number, number] = pose === 'open' ? [-0.38, 0.12, -0.74, -0.26] : [-0.38, 0.1, -0.44, -0.4]
  const tip = (fx: number, len: number, sp: number): Pt => [fx + Math.sin(sp) * len, -0.36 - Math.cos(sp) * len]
  // outline pass (wide, dark), then fill pass, so the outline only shows round the silhouette
  g.strokeStyle = GLOVE_D
  for (const [fx, len, sp] of f) { const [tx, ty] = tip(fx, len, sp); g.lineWidth = 0.3; line(g, fx, -0.36, tx, ty) }
  g.lineWidth = 0.34; line(g, thumb[0], thumb[1], thumb[2], thumb[3])
  rr(g, -0.47, -0.47, 0.94, 1.0, 0.32); g.lineWidth = 0.08; g.stroke()
  g.strokeStyle = GLOVE
  for (const [fx, len, sp] of f) { const [tx, ty] = tip(fx, len, sp); g.lineWidth = 0.22; line(g, fx, -0.36, tx, ty) }
  g.lineWidth = 0.26; line(g, thumb[0], thumb[1], thumb[2], thumb[3])
  g.fillStyle = GLOVE; rr(g, -0.46, -0.46, 0.92, 0.98, 0.31); g.fill()
  // a sheen down the glove and the knuckle creases
  g.strokeStyle = GLOVE_L; g.globalAlpha *= 0.6; g.lineWidth = 0.07
  g.beginPath(); g.moveTo(-0.3, 0.3); g.quadraticCurveTo(-0.34, -0.28, -0.04, -0.36); g.stroke()
  g.globalAlpha /= 0.6
  g.strokeStyle = GLOVE_D; g.lineWidth = 0.035
  for (let i = 0; i < 3; i++) { const fx = (f[i]![0] + f[i + 1]![0]) / 2; line(g, fx, pose === 'grip' ? -0.46 : -0.4, fx, pose === 'grip' ? -0.36 : -0.3) }
  g.restore()
}

// ---------------------------------------------------------------------------------------------------------------
// Food, drawn in a unit box: bottom centre at (0, 0), height 1.
const DRINK: Record<Drink, string> = { shake: '#f5a3bd', smoothie: '#f39a2b', boba: '#c99f78' }
const PEARL = '#2b1a12'

export function drawItem(g: G, it: Item, x: number, y: number, s: number, alpha = 1): void {
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha *= alpha; g.lineJoin = 'round'; g.lineCap = 'round'
  if (it === 'fries') friesBox(g)
  else if (it === 'burger') burgerIcon(g)
  else if (it === 'shawarma') wrapIcon(g)
  else cupIcon(g, it)
  g.restore()
}
function friesBox(g: G): void {
  for (let i = 0; i < 9; i++) {
    const fx = -0.26 + i * 0.065, tilt = (hash(i * 3.1) - 0.5) * 0.25, top = -0.86 - hash(i + 9) * 0.14
    g.strokeStyle = '#c98a22'; g.lineWidth = 0.085; line(g, fx, -0.4, fx + tilt * 0.4, top)
    g.strokeStyle = '#f6c94f'; g.lineWidth = 0.056; line(g, fx, -0.4, fx + tilt * 0.4, top)
  }
  poly(g, [-0.35, -0.64, 0.35, -0.64, 0.25, 0, -0.25, 0]); g.fillStyle = MCGRIND_GREEN; g.fill()
  poly(g, [0.06, -0.64, 0.35, -0.64, 0.25, 0, 0.04, 0]); g.fillStyle = 'rgba(0,0,0,0.16)'; g.fill()
  g.strokeStyle = MCGRIND_BRIGHT; g.lineWidth = 0.035; line(g, -0.35, -0.64, 0.35, -0.64)
  g.strokeStyle = '#ffe3a3'; g.lineWidth = 0.05; g.beginPath(); g.arc(0, -0.3, 0.11, 0.8, 5.5); g.stroke()
}
function burgerIcon(g: G): void {
  rr(g, -0.42, -0.2, 0.84, 0.2, 0.08); g.fillStyle = '#cf8838'; g.fill()
  rr(g, -0.45, -0.37, 0.9, 0.18, 0.08); g.fillStyle = '#5a321c'; g.fill()
  poly(g, [-0.44, -0.41, 0.44, -0.41, 0.42, -0.34, 0.14, -0.33, 0.06, -0.24, -0.02, -0.33, -0.44, -0.34]); g.fillStyle = '#f5c431'; g.fill()
  g.strokeStyle = '#58b947'; g.lineWidth = 0.07; g.beginPath()
  for (let i = 0; i <= 12; i++) { const px = -0.47 + i * 0.078, py = -0.44 + (i % 2 ? 0.035 : -0.01); if (i) g.lineTo(px, py); else g.moveTo(px, py) }
  g.stroke()
  g.beginPath(); g.moveTo(-0.47, -0.45); g.bezierCurveTo(-0.47, -1.0, 0.47, -1.0, 0.47, -0.45); g.closePath(); g.fillStyle = '#e2a24a'; g.fill()
  ell(g, -0.15, -0.76, 0.15, 0.06, -0.3); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill()
  g.fillStyle = '#fff3d6'
  for (const [sx, sy] of [[-0.2, -0.62], [0.02, -0.7], [0.22, -0.6], [-0.05, -0.55], [0.14, -0.78], [-0.28, -0.52]] as Pt[]) { ell(g, sx, sy, 0.035, 0.018, 0.4); g.fill() }
}
function wrapIcon(g: G): void {
  g.rotate(-0.16)
  rr(g, -0.21, -0.98, 0.42, 0.98, 0.2); g.fillStyle = '#e8c98c'; g.fill()
  ell(g, 0, -0.9, 0.17, 0.07); g.fillStyle = '#8a4524'; g.fill()
  g.fillStyle = '#4fa83d'; ell(g, -0.08, -0.93, 0.05, 0.03); g.fill(); ell(g, 0.09, -0.92, 0.045, 0.03); g.fill()
  g.fillStyle = '#d8432f'; ell(g, 0.02, -0.95, 0.035, 0.025); g.fill()
  rr(g, -0.23, -0.6, 0.46, 0.6, 0.12); g.fillStyle = '#f7f0e2'; g.fill()
  g.fillStyle = MCGRIND_GREEN; g.fillRect(-0.23, -0.4, 0.46, 0.08)
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.025; line(g, -0.23, -0.6, 0.18, -0.12)
}
function cupIcon(g: G, d: Drink): void {
  const top = -0.78, bw = 0.23, tw = 0.31
  poly(g, [-tw + 0.03, top + 0.06, tw - 0.03, top + 0.06, bw - 0.02, -0.03, -bw + 0.02, -0.03]); g.fillStyle = DRINK[d]; g.fill()
  if (d === 'boba') { g.fillStyle = PEARL; for (let i = 0; i < 8; i++) { ell(g, -0.17 + (i % 4) * 0.11 + (i > 3 ? 0.05 : 0), -0.07 - (i > 3 ? 0.08 : 0), 0.045, 0.045); g.fill() } }
  if (d === 'smoothie') { g.fillStyle = 'rgba(255,220,120,0.6)'; for (let i = 0; i < 6; i++) { ell(g, -0.15 + hash(i) * 0.3, -0.2 - hash(i + 3) * 0.45, 0.02, 0.02); g.fill() } }
  poly(g, [-tw, top, tw, top, bw, 0, -bw, 0]); g.fillStyle = 'rgba(255,255,255,0.16)'; g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.025; g.stroke()
  g.fillStyle = MCGRIND_GREEN; poly(g, [-0.285, -0.5, 0.285, -0.5, 0.268, -0.38, -0.268, -0.38]); g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.035; line(g, -0.2, -0.7, -0.15, -0.08)
  if (d === 'shake') {
    g.beginPath(); g.ellipse(0, top, tw, 0.2, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#fff1f4'; g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.02; g.stroke()
    ell(g, 0.03, top - 0.2, 0.05, 0.05); g.fillStyle = '#d8283f'; g.fill()
    g.strokeStyle = '#e8364a'; g.lineWidth = 0.05; line(g, 0.1, top - 0.1, 0.18, top - 0.32)
  } else {
    rr(g, -tw - 0.02, top - 0.05, tw * 2 + 0.04, 0.07, 0.03); g.fillStyle = d === 'boba' ? 'rgba(255,255,255,0.85)' : '#f2f2f2'; g.fill()
    g.strokeStyle = d === 'boba' ? '#1e1e24' : MCGRIND_BRIGHT; g.lineWidth = d === 'boba' ? 0.09 : 0.05
    line(g, 0.05, top - 0.04, 0.13, top - 0.3)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Shared scenery for the stations (320 x 220): subway tiles above, brushed steel counter below.
function tiles(g: G, w: number, y1: number): void {
  const grad = g.createLinearGradient(0, 0, 0, y1)
  grad.addColorStop(0, '#dfe6e3'); grad.addColorStop(1, '#f3f6f4')
  g.fillStyle = grad; g.fillRect(0, 0, w, y1)
  g.strokeStyle = 'rgba(120,140,132,0.28)'; g.lineWidth = 1
  g.beginPath()
  for (let y = 0, r = 0; y < y1; y += 15, r++) {
    g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5)
    for (let x = r % 2 ? 0 : 17; x < w; x += 34) { g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, Math.min(y1, y + 15)) }
  }
  g.stroke()
  const hood = g.createLinearGradient(0, 0, 0, 36)
  hood.addColorStop(0, 'rgba(20,30,26,0.35)'); hood.addColorStop(1, 'rgba(20,30,26,0)')
  g.fillStyle = hood; g.fillRect(0, 0, w, 36)
}
function steel(g: G, x: number, y: number, w: number, h: number, dark = false): void {
  const grad = g.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, dark ? '#7d878d' : '#c9d0d4'); grad.addColorStop(1, dark ? '#545d63' : '#9aa4aa')
  g.fillStyle = grad; g.fillRect(x, y, w, h)
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.6
  g.beginPath(); for (let yy = y + 2; yy < y + h; yy += 2.6) { g.moveTo(x, yy); g.lineTo(x + w, yy) } g.stroke()
}
function counterTop(g: G, w: number, h: number, y: number): void {
  steel(g, 0, y, w, h - y)
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, y, w, 2)
}
function gauge(g: G, x: number, y: number, w: number, h: number, v: number, band: [number, number]): void {
  const on = v >= band[0] && v <= band[1]
  rr(g, x, y, w, h, h / 2); g.fillStyle = '#121a16'; g.fill()
  g.fillStyle = on ? 'rgba(23,247,144,0.6)' : 'rgba(23,247,144,0.26)'
  g.fillRect(x + band[0] * w, y, (band[1] - band[0]) * w, h)
  if (v >= 0) {
    g.fillStyle = v > band[1] ? BAD : on ? GOOD : '#f3b545'
    rr(g, x + 1, y + 1.5, Math.max(h - 3, clamp(v) * (w - 2)), h - 3, (h - 3) / 2); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1
    const mx = x + clamp(v) * w
    g.fillStyle = '#fff'; poly(g, [mx - 4, y - 4, mx + 4, y - 4, mx, y + 1]); g.fill()
  }
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.2
  line(g, x + band[0] * w, y - 1, x + band[0] * w, y + h + 1); line(g, x + band[1] * w, y - 1, x + band[1] * w, y + h + 1)
}

type Pop = { text: string; col: string; t0: number; x: number; y: number }
function drawPops(g: G, list: Pop[], now: number, size = 19): void {
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
  g.font = `800 ${size}px ${FONT}`
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!, k = (now - p.t0) / 1.2
    if (k >= 1) { list.splice(i, 1); continue }
    if (k < 0) continue
    g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3
    const y = p.y - easeOut(k) * 24, sc = k < 0.12 ? 0.7 + (k / 0.12) * 0.3 : 1
    g.save(); g.translate(p.x, y); g.scale(sc, sc)
    g.lineWidth = 5; g.strokeStyle = 'rgba(5,16,11,0.85)'; g.strokeText(p.text, 0, 0)
    g.fillStyle = p.col; g.fillText(p.text, 0, 0)
    g.restore()
  }
  g.globalAlpha = 1
}
type Flight = { it: Item; t0: number; from: Pt; to: Pt; s: number }
function drawFlights(g: G, list: Flight[], now: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i]!, k = (now - f.t0) / 0.55
    if (k >= 1) { list.splice(i, 1); continue }
    if (k < 0) continue
    const e = ease(k), p = lp(f.from, f.to, e)
    drawItem(g, f.it, p[0], p[1] - Math.sin(k * Math.PI) * 26, f.s * (1 - 0.35 * e), k > 0.75 ? (1 - k) / 0.25 : 1)
  }
}
function steam(g: G, now: number, x: number, y: number, w: number, n: number, alpha: number, dark = false): void {
  if (alpha <= 0.01) return
  g.fillStyle = dark ? '#3b3b3b' : '#ffffff'
  for (let j = 0; j < n; j++) {
    const ph = (now * (0.32 + hash(j) * 0.12) + j / n) % 1
    const px = x + (hash(j + 5) - 0.5) * w + Math.sin(now * 1.3 + j * 2) * 7
    g.globalAlpha = alpha * (1 - ph) * (ph < 0.15 ? ph / 0.15 : 1)
    ell(g, px, y - ph * 70, 7 + ph * 15, 6 + ph * 12); g.fill()
  }
  g.globalAlpha = 1
}

type Anim = { kind: string; t0: number; dur: number; v: number }
class Station {
  readonly view: View
  anim: Anim | null = null
  readonly pops: Pop[] = []
  readonly flights: Flight[] = []
  constructor(still: (g: G) => void) { this.view = new View(320, 220, still) }
  protected play(kind: string, dur: number, v = 0): void { this.anim = { kind, t0: nowS(), dur, v } }
  /** The running animation and its progress 0..1, or null. */
  protected cur(now: number): [string, number, number] | null {
    const a = this.anim
    if (!a) return null
    const k = (now - a.t0) / a.dur
    if (k >= 1) { this.anim = null; return null }
    return [a.kind, Math.max(0, k), a.v]
  }
  pop(text: string, col: string, x = 160, y = 54): void {
    // quick taps stack their words instead of printing over each other
    const t = nowS(), busy = this.pops.filter((p) => t - p.t0 < 0.7 && Math.abs(p.x - x) < 80).length
    this.pops.push({ text, col, t0: t, x, y: y + busy * 20 })
  }
  protected send(it: Item, from: Pt, s: number, delay = 0, to: Pt = [306, -24]): void { this.flights.push({ it, t0: nowS() + delay, from, to, s }) }
  protected finish(g: G, now: number): void { drawFlights(g, this.flights, now); drawPops(g, this.pops, now) }
}

// ---------------------------------------------------------------------------------------------------------------
// Fryer: a basket on a hook over hot oil. Drop it in, watch the fries go from pale to golden, lift and shake.
const FRY_CX = 150, FRY_UP = 28, FRY_DOWN = 96
const OIL: number[] = [54, 104, 266, 104, 280, 146, 40, 146]
const friesTone = (p: number) => ramp([[0, '#f6e8b6'], [0.45, '#f2d47e'], [0.7, '#eab546'], [0.88, '#d9952e'], [1.0, '#a8612a'], [1.2, '#3c2412']], p)
function stick(g: G, x1: number, y1: number, x2: number, y2: number, col: string): void {
  g.strokeStyle = 'rgba(90,55,15,0.55)'; g.lineWidth = 6.2; line(g, x1, y1, x2, y2)
  g.strokeStyle = col; g.lineWidth = 4.4; line(g, x1, y1, x2, y2)
}
function basket(g: G, top: number, fries: string | null, alpha = 1): void {
  const cx = FRY_CX
  g.lineCap = 'round'
  if (fries) {
    g.globalAlpha = alpha
    for (let i = 0; i < 17; i++) {
      const fx = cx - 52 + (i + 0.5) * (104 / 17) + (hash(i) - 0.5) * 4
      stick(g, fx, top + 30, fx + (hash(i + 8) - 0.5) * 12, top - 4 - hash(i + 4) * 12, fries)
    }
    g.globalAlpha = 1
  }
  g.fillStyle = 'rgba(60,68,74,0.22)'; g.fillRect(cx - 60, top, 120, 44)
  g.strokeStyle = 'rgba(160,170,176,0.85)'; g.lineWidth = 1
  g.beginPath()
  for (let x = cx - 60; x <= cx + 60; x += 7.5) { g.moveTo(x, top); g.lineTo(x, top + 44) }
  for (let y = top + 7; y < top + 44; y += 7.5) { g.moveTo(cx - 60, y); g.lineTo(cx + 60, y) }
  g.stroke()
  g.strokeStyle = '#8b959b'; g.lineWidth = 3; g.strokeRect(cx - 60, top, 120, 44)
  g.strokeStyle = '#a7b0b5'; g.lineWidth = 4; line(g, cx + 60, top + 6, cx + 98, top + 28)
  g.strokeStyle = '#1c1e21'; g.lineWidth = 10; line(g, cx + 98, top + 28, cx + 124, top + 43)
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; line(g, cx + 100, top + 26, cx + 122, top + 39)
}
function paintFryer(g: G): void {
  tiles(g, 320, 130)
  counterTop(g, 320, 220, 130)
  // the fryer: a steel cabinet with the oil well on top and a timer display on the front
  steel(g, 26, 96, 268, 124)
  poly(g, [44, 98, 276, 98, 290, 150, 30, 150]); g.fillStyle = '#5d676d'; g.fill()
  poly(g, OIL); const oil = g.createLinearGradient(0, 104, 0, 146); oil.addColorStop(0, '#b97a1f'); oil.addColorStop(1, '#d9a43c'); g.fillStyle = oil; g.fill()
  g.strokeStyle = '#e2e7ea'; g.lineWidth = 3; poly(g, OIL); g.stroke()
  // the hook the basket hangs on
  g.strokeStyle = '#7d878d'; g.lineWidth = 3; line(g, 200, 0, 200, 20); line(g, 200, 20, 212, 30)
  rr(g, 38, 170, 244, 40, 8); g.fillStyle = '#0c120f'; g.fill()
  g.font = `700 9px ${FONT}`; g.fillStyle = '#7fa391'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('FRY TIME', 48, 180)
  g.textAlign = 'right'; g.fillStyle = '#ff9d4a'; g.fillText('175°C', 272, 180)
}
export class FryerArt extends Station {
  /** Fry progress from the shift (-1 while the basket is up). */
  cook = -1
  private held = 0
  private empty = 0
  constructor() { super(paintFryer) }
  drop(): void { this.play('drop', 0.5) }
  /** The basket comes up with fries cooked to `p`; `keep` sends two portions to the pass, otherwise they are binned. */
  lift(p: number, keep: boolean): void {
    this.held = p; this.play('lift', 0.95, keep ? 1 : 0); this.empty = nowS() + 0.7
    const to: Pt = keep ? [306, -24] : [18, 236]
    this.send('fries', [FRY_CX - 20, FRY_UP + 30], 42, 0.68, to); this.send('fries', [FRY_CX + 20, FRY_UP + 30], 42, 0.76, to)
  }
  draw(now: number, band: [number, number], dpr: number): void {
    if (!this.view.begin(dpr)) return
    const g = this.view.g, a = this.cur(now)
    const rest: Pt = [284, 178 + Math.sin(now * 1.7) * 1.2], grip = (top: number): Pt => [FRY_CX + 113, top + 37]
    let top = this.cook >= 0 ? FRY_DOWN : FRY_UP, hp = rest, pose: Pose = 'open', ang = -0.9
    let fries: string | null = this.cook >= 0 ? friesTone(this.cook) : friesTone(0), falpha = 1
    if (this.cook < 0 && now < this.empty) fries = null
    else if (this.cook < 0 && now < this.empty + 0.35) falpha = (now - this.empty) / 0.35
    let splash = -1, drip = false
    if (a && a[0] === 'drop') {
      const k = a[1]
      top = lerp(FRY_UP, FRY_DOWN, easeIn(seg(k, 0.3, 0.72)))
      hp = k < 0.3 ? lp(rest, grip(FRY_UP), ease(seg(k, 0, 0.3))) : k < 0.75 ? grip(top) : lp(grip(FRY_DOWN), rest, ease(seg(k, 0.75, 1)))
      pose = k > 0.22 && k < 0.8 ? 'grip' : 'open'; ang = pose === 'grip' ? -1.05 : -0.9
      fries = friesTone(0); falpha = 1
      if (k > 0.68) splash = seg(k, 0.68, 1)
    } else if (a && a[0] === 'lift') {
      const k = a[1]
      top = k < 0.2 ? FRY_DOWN : lerp(FRY_DOWN, FRY_UP, easeOut(seg(k, 0.2, 0.48)))
      if (k > 0.48 && k < 0.74) top += Math.sin(seg(k, 0.48, 0.74) * Math.PI * 6) * 3.5
      hp = k < 0.2 ? lp(rest, grip(FRY_DOWN), ease(seg(k, 0, 0.2))) : k < 0.74 ? grip(top) : lp(grip(FRY_UP), rest, ease(seg(k, 0.74, 1)))
      pose = k > 0.15 && k < 0.8 ? 'grip' : 'open'; ang = pose === 'grip' ? -1.05 : -0.9
      fries = k < 0.7 ? friesTone(this.held) : null; falpha = 1
      drip = k > 0.25 && k < 0.95
    }
    const down = top > 70
    // oil shimmer
    g.strokeStyle = 'rgba(255,236,170,0.35)'; g.lineWidth = 1.2
    for (let i = 0; i < 4; i++) { const ph = (now * 0.25 + i / 4) % 1, y = 110 + i * 9; line(g, 60 + ph * 150, y, 84 + ph * 150, y) }
    if (down) {
      basket(g, top, fries, falpha)
      g.save(); poly(g, OIL); g.clip()
      g.fillStyle = 'rgba(190,124,30,0.8)'; g.fillRect(0, 104, 320, 50)
      g.restore()
    }
    // bubbles: a fierce boil just after the drop, a steady fry after
    const boil = this.cook >= 0 ? (this.cook < 0.3 ? 1 : 0.6) : down ? 0.5 : 0.08
    const n = Math.round(30 * boil)
    g.strokeStyle = 'rgba(255,244,200,0.9)'; g.lineWidth = 1
    for (let i = 0; i < n; i++) {
      const ph = (now * (1.2 + hash(i + 2) * 1.4) + hash(i)) % 1
      const bx = 62 + hash(i + 7) * 196, by = 108 + hash(i + 13) * 34
      g.globalAlpha = 1 - ph; ell(g, bx, by, 1 + ph * 3.5, 0.7 + ph * 2); g.stroke()
    }
    g.globalAlpha = 1
    if (splash >= 0) {
      g.fillStyle = '#f6cd6a'
      for (let i = 0; i < 12; i++) { const h = Math.sin(splash * Math.PI) * (10 + hash(i + 30) * 22); ell(g, 92 + i * 11 + (hash(i) - 0.5) * 6, 104 - h, 1.8, 1.8); g.fill() }
    }
    if (!down) {
      if (drip) { g.fillStyle = '#d9a43c'; for (let i = 0; i < 5; i++) { const ph = (now * 2.2 + i / 5) % 1; ell(g, 100 + i * 24, top + 46 + ph * (104 - top - 46), 1.4, 2.2); g.fill() } }
      basket(g, top, fries, falpha)
    }
    steam(g, now, 160, 100, 150, 5, this.cook >= 0 ? 0.22 : 0.06)
    if (this.cook > 0.95) steam(g, now, 160, 96, 120, 5, clamp((this.cook - 0.95) * 3) * 0.55, true)
    hand(g, hp[0], hp[1], ang, pose, [hp[0] + 150, hp[1] + 92], 21)
    gauge(g, 48, 190, 224, 11, this.cook, band)
    this.finish(g, now)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Grill: a flat-top griddle and a spatula. Lay the patty on, flip it once, lift it onto the bun and build.
const PAT: Pt = [116, 122]
const BUN: Pt = [275, 146]
const sear = (v: number) => ramp([[0, '#c4545a'], [0.35, '#a8675a'], [0.7, '#8a5236'], [0.95, '#6c3e24'], [1.25, '#3a2216'], [1.7, '#141010']], v)
function patty(g: G, x: number, y: number, top: string, side: string, marks: boolean, flip = 1, sc = 1): void {
  const rx = 38 * sc, ry = 15 * sc * Math.max(0.12, Math.abs(flip)), th = 6 * sc
  ell(g, x, y + th, rx, ry); g.fillStyle = side; g.fill()
  g.fillRect(x - rx, y, rx * 2, th)
  ell(g, x, y, rx, ry); g.fillStyle = flip < 0 ? side : top; g.fill()
  if (marks && flip > 0) {
    g.save(); ell(g, x, y, rx, ry); g.clip()
    g.strokeStyle = 'rgba(25,12,6,0.55)'; g.lineWidth = 3 * sc
    for (let i = -2; i <= 2; i++) line(g, x + i * 14 * sc - 12 * sc, y - ry, x + i * 14 * sc + 12 * sc, y + ry)
    g.restore()
  }
  ell(g, x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill()
}
function spatula(g: G, hx: number, hy: number, ang: number): void {
  g.save(); g.translate(hx, hy); g.rotate(ang)
  rr(g, -4, -3.5, 30, 7, 3); g.fillStyle = '#1c1e21'; g.fill()
  g.fillStyle = '#9aa4aa'; g.fillRect(25, -2, 14, 4)
  poly(g, [38, -10, 76, -14, 76, 14, 38, 10]); g.fillStyle = '#cfd6da'; g.fill()
  g.strokeStyle = '#8a949a'; g.lineWidth = 1; g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.2; line(g, 44, -6, 72, -9)
  g.restore()
}
function paintGrill(g: G): void {
  tiles(g, 320, 130)
  counterTop(g, 320, 220, 130)
  steel(g, 8, 150, 226, 70, true)
  poly(g, [22, 96, 218, 96, 232, 152, 8, 152])
  const plate = g.createLinearGradient(0, 96, 0, 152); plate.addColorStop(0, '#25292d'); plate.addColorStop(1, '#3c4247'); g.fillStyle = plate; g.fill()
  g.strokeStyle = '#9aa4aa'; g.lineWidth = 3; g.stroke()
  for (const kx of [44, 120, 196]) { ell(g, kx, 180, 9, 9); g.fillStyle = '#16181a'; g.fill(); g.strokeStyle = '#e8e8e8'; g.lineWidth = 2; line(g, kx, 180, kx + 5, 174) }
  // the bun board
  poly(g, [238, 128, 312, 128, 318, 170, 232, 170]); g.fillStyle = '#c99256'; g.fill()
  g.fillStyle = '#9c6a36'; g.fillRect(232, 170, 86, 7)
  g.strokeStyle = 'rgba(110,70,30,0.35)'; g.lineWidth = 1
  for (let i = 0; i < 5; i++) line(g, 240 + i * 2, 134 + i * 8, 310 + i, 134 + i * 8)
}
export class GrillArt extends Station {
  /** Cook progress (-1 = nothing on the grill) and the progress when it was flipped (-1 = not yet). */
  cook = -1
  flipAt = -1
  private lastTop = '#8a5236'
  private lastSide = '#8a5236'
  constructor() { super(paintGrill) }
  put(): void { this.play('on', 0.55) }
  flip(): void { this.play('flip', 0.6) }
  /** Off the grill: `keep` builds a burger; otherwise the patty is scraped into the bin. */
  off(keep: boolean): void { this.play(keep ? 'off' : 'bin', keep ? 1.25 : 0.8); if (keep) this.send('burger', [BUN[0], BUN[1] + 14], 46, 1.05) }
  draw(now: number, band: [number, number], dpr: number): void {
    if (!this.view.begin(dpr)) return
    const g = this.view.g, a = this.cur(now)
    const restH: Pt = [270, 206 + Math.sin(now * 1.6) * 1.2], restA = Math.PI + 0.55
    const under: Pt = [PAT[0] + 58, PAT[1] + 3]
    let sh = restH, sa = restA, carried: { p: Pt; flip: number; sc: number } | null = null
    let showPatty = this.cook >= 0, lh: { p: Pt; pose: Pose } | null = null
    let bun = -1
    // colours: before the flip the raw top greys as the underside sears; after it, the seared side is on top
    const flipped = this.flipAt >= 0
    let top = flipped ? sear((this.flipAt / 0.5) * 0.9) : mix('#c4545a', '#b07c70', clamp(this.cook / 0.6) * 0.5)
    let side = flipped ? sear(((this.cook - this.flipAt) / 0.45) * 0.9) : sear(clamp(this.cook / 0.55) * 0.9)
    if (this.cook >= 0) { this.lastTop = top; this.lastSide = side }
    if (a) {
      const [kind, k] = a
      if (kind === 'on') {
        const from: Pt = [30, 250], at: Pt = [PAT[0], PAT[1] - 4]
        const hp = k < 0.6 ? lp(from, at, ease(seg(k, 0, 0.6))) : lp(at, [10, 262], ease(seg(k, 0.6, 1)))
        lh = { p: [hp[0] - 6, hp[1] + 14], pose: 'open' }
        if (k < 0.6) { showPatty = false; carried = { p: [hp[0], hp[1] - 4], flip: 1, sc: 0.95 }; top = side = '#c4545a' }
      } else if (kind === 'flip' || kind === 'off' || kind === 'bin') {
        const kIn = kind === 'off' ? 0.2 : 0.3
        if (k < kIn) { sh = lp(restH, under, ease(seg(k, 0, kIn))); sa = lerp(restA, Math.PI + 0.06, ease(seg(k, 0, kIn))) }
        else if (kind === 'flip') {
          const kf = seg(k, 0.3, 0.8), lift = Math.sin(kf * Math.PI) * 30
          sh = k < 0.8 ? [under[0], under[1] - lift] : lp(under, restH, ease(seg(k, 0.8, 1)))
          sa = k < 0.8 ? Math.PI + 0.06 - Math.sin(kf * Math.PI) * 0.25 : lerp(Math.PI + 0.06, restA, ease(seg(k, 0.8, 1)))
          if (k < 0.8) { showPatty = false; const fl = Math.cos(seg(k, 0.35, 0.75) * Math.PI); carried = { p: [PAT[0] + 2, PAT[1] - lift], flip: fl, sc: 1 } }
        } else if (kind === 'off') {
          const kc = seg(k, 0.2, 0.48)
          const dest: Pt = [BUN[0] + 58, BUN[1] - 6]
          if (k < 0.48) { sh = [lerp(under[0], dest[0], ease(kc)), lerp(under[1], dest[1], ease(kc)) - Math.sin(kc * Math.PI) * 24]; sa = Math.PI + 0.06; showPatty = false; carried = { p: [sh[0] - 58, sh[1] - 3], flip: 1, sc: 1 - kc * 0.22 } }
          else { sh = lp(dest, restH, ease(seg(k, 0.48, 0.75))); sa = lerp(Math.PI + 0.06, restA, ease(seg(k, 0.48, 0.75))); showPatty = false }
          bun = k
          top = this.lastTop; side = this.lastSide
          if (k > 0.5 && k < 1) {
            const from: Pt = [180, 260], above: Pt = [BUN[0] - 4, BUN[1] - 40], on: Pt = [BUN[0] - 4, BUN[1] - 22]
            const hp = k < 0.72 ? lp(from, above, ease(seg(k, 0.5, 0.72))) : k < 0.84 ? lp(above, on, ease(seg(k, 0.72, 0.84))) : lp(on, [150, 270], ease(seg(k, 0.84, 1)))
            lh = { p: hp, pose: 'grip' }
          }
        } else {
          const kb = seg(k, 0.3, 0.75)
          sh = k < 0.75 ? [lerp(under[0], 30, ease(kb)), under[1] + 4] : lp([30, under[1] + 4], restH, ease(seg(k, 0.75, 1)))
          sa = Math.PI + 0.06
          showPatty = false; top = side = '#1c1410'
          if (k < 0.75) carried = { p: [sh[0] - 58, sh[1] - 3], flip: 1, sc: 1 }
        }
      }
    }
    // heat shimmer over the plate
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2
    for (let i = 0; i < 4; i++) { const y = 92 - ((now * 18 + i * 14) % 56); g.beginPath(); for (let x = 30; x <= 210; x += 12) g.lineTo(x, y + Math.sin(x * 0.12 + now * 4 + i) * 2); g.stroke() }
    if (showPatty) {
      patty(g, PAT[0], PAT[1], top, side, flipped && this.flipAt > 0.3)
      // fat spitting round the edge
      g.fillStyle = 'rgba(255,230,180,0.85)'
      for (let i = 0; i < 8; i++) { const ph = (now * 2.4 + hash(i)) % 1; const an = hash(i + 3) * Math.PI * 2; ell(g, PAT[0] + Math.cos(an) * 44, PAT[1] + 4 + Math.sin(an) * 18 - ph * 8, 1.2, 1.2); g.globalAlpha = 1 - ph; g.fill() }
      g.globalAlpha = 1
    }
    // the burger being built on the board
    if (bun >= 0) {
      const [bx, by] = BUN, gone = bun > 0.84 ? 1 - seg(bun, 0.84, 0.92) : 1
      g.globalAlpha = gone
      ell(g, bx, by, 30, 9); g.fillStyle = '#cf8838'; g.fill()
      if (bun >= 0.48) patty(g, bx, by - 6, this.lastTop, this.lastSide, true, 1, 0.78)
      if (bun >= 0.6) { g.strokeStyle = '#58b947'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 10; i++) g.lineTo(bx - 30 + i * 6, by - 11 + (i % 2) * 3); g.stroke() }
      if (bun >= 0.66) { poly(g, [bx - 26, by - 13, bx + 26, by - 13, bx + 10, by - 6, bx - 4, by - 1, bx - 10, by - 8]); g.fillStyle = '#f5c431'; g.fill() }
      // the top bun rides in the left hand, then sits on the stack
      const tbp: Pt | null = bun >= 0.84 ? [bx, by - 16] : bun >= 0.5 && lh ? [lh.p[0] + 4, lh.p[1] + 6] : null
      if (tbp) { g.beginPath(); g.ellipse(tbp[0], tbp[1], 30, 16, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#e2a24a'; g.fill(); ell(g, tbp[0] - 9, tbp[1] - 9, 9, 3.5, -0.3); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fill() }
      g.globalAlpha = 1
    }
    if (carried) {
      spatula(g, sh[0], sh[1], sa)
      patty(g, carried.p[0], carried.p[1], top, side, flipped && carried.flip > 0 && this.flipAt > 0.3, carried.flip, carried.sc)
    } else spatula(g, sh[0], sh[1], sa)
    if (this.cook >= 0) steam(g, now, PAT[0], PAT[1] - 6, 60, 4, 0.2)
    if (this.cook > 1) steam(g, now, PAT[0], PAT[1] - 6, 60, 5, clamp((this.cook - 1) * 4) * 0.55, true)
    hand(g, sh[0] + 6 * Math.cos(sa + Math.PI), sh[1] + 6 * Math.sin(sa + Math.PI), Math.atan2(Math.cos(sa), -Math.sin(sa)), 'grip', [sh[0] + 120, sh[1] + 110], 20)
    if (lh) hand(g, lh.p[0], lh.p[1], 0.15, lh.pose, [lh.p[0] - 70, lh.p[1] + 150], 20, true)
    gauge(g, 22, 203, 196, 10, this.cook, band)
    this.finish(g, now)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Shawarma: a turning spit by the heater, a long knife that sweeps up and down it, a tray, and a board to wrap on.
const SP_X = 128, SP_TOP = 34, SP_BOT = 166, SP_RT = 46, SP_RB = 28
const spY = (v: number) => 42 + v * 116
const spR = (y: number) => lerp(SP_RT, SP_RB, clamp((y - SP_TOP) / (SP_BOT - SP_TOP)))
const WRAP: Pt = [262, 184]
function knife(g: G, hx: number, hy: number, ang: number): void {
  g.save(); g.translate(hx, hy); g.rotate(ang)
  rr(g, -26, -4.5, 30, 9, 3); g.fillStyle = '#3a2416'; g.fill()
  g.fillStyle = '#d7c7a8'; ell(g, -18, 0, 1.4, 1.4); g.fill(); ell(g, -8, 0, 1.4, 1.4); g.fill()
  g.fillStyle = '#9aa4aa'; g.fillRect(4, -5, 4, 10)
  g.beginPath(); g.moveTo(8, -5); g.lineTo(76, -5); g.quadraticCurveTo(60, 6, 8, 6); g.closePath(); g.fillStyle = '#dde3e7'; g.fill()
  g.strokeStyle = '#8a949a'; g.lineWidth = 1; g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; line(g, 10, -3, 66, -3)
  g.restore()
}
function paintSpit(g: G): void {
  tiles(g, 320, 130)
  counterTop(g, 320, 220, 130)
  steel(g, 26, 20, 40, 160, true)
  g.fillStyle = '#2a1c14'; g.fillRect(32, 28, 28, 144)
  steel(g, 76, 174, 106, 18)
  rr(g, 86, 176, 84, 14, 4); g.fillStyle = '#5d676d'; g.fill()
  g.strokeStyle = '#b8c1c6'; g.lineWidth = 3; line(g, SP_X, 8, SP_X, 176)
  ell(g, SP_X, SP_TOP - 4, 22, 5); g.fillStyle = '#9aa4aa'; g.fill()
  // the wrap board
  poly(g, [206, 150, 314, 150, 318, 212, 202, 212]); g.fillStyle = '#d2a066'; g.fill()
  g.strokeStyle = 'rgba(110,70,30,0.3)'; g.lineWidth = 1
  for (let i = 0; i < 6; i++) line(g, 208 + i, 156 + i * 9, 312 + i * 0.6, 156 + i * 9)
}
type Flake = { t0: number; x: number; y: number; vx: number; good: boolean }
export class SpitArt extends Station {
  /** Shaves so far this wrap (1 = clean cut in the crisp band). */
  shaves: number[] = []
  private flakes: Flake[] = []
  private cutY = 100
  constructor() { super(paintSpit) }
  shave(m: number, good: boolean): void {
    this.play('shave', 0.3, m)
    const y = spY(m); this.cutY = y
    const x = SP_X + spR(y)
    for (let i = 0; i < 7; i++) this.flakes.push({ t0: nowS() + i * 0.025, x: x - 4 - i * 2, y: y + 2, vx: -10 - hash(i + y) * 30, good })
  }
  wrap(): void { this.play('wrap', 1.25); this.send('shawarma', [WRAP[0], WRAP[1] + 8], 50, 1.12) }
  draw(now: number, m: number, band: [number, number], dpr: number): void {
    if (!this.view.begin(dpr)) return
    const g = this.view.g, a = this.cur(now)
    // the heater's glowing elements
    for (let i = 0; i < 3; i++) {
      const fl = 0.75 + 0.25 * Math.sin(now * 7 + i * 2.1)
      const gr = g.createLinearGradient(36 + i * 9, 0, 42 + i * 9, 0); gr.addColorStop(0, '#ff7a1a'); gr.addColorStop(1, '#ffd36b')
      g.globalAlpha = fl; g.fillStyle = gr; g.fillRect(35 + i * 9, 32, 5, 136)
    }
    g.globalAlpha = 1
    const glow = g.createRadialGradient(60, 100, 4, 60, 100, 90); glow.addColorStop(0, 'rgba(255,140,40,0.25)'); glow.addColorStop(1, 'rgba(255,140,40,0)')
    g.fillStyle = glow; g.fillRect(0, 10, 200, 180)
    // the meat cone, lit from the heater side, with its layers and char streaks turning
    const cone = () => { g.beginPath(); g.moveTo(SP_X - SP_RT, SP_TOP); g.quadraticCurveTo(SP_X, SP_TOP - 14, SP_X + SP_RT, SP_TOP); g.lineTo(SP_X + SP_RB, SP_BOT); g.quadraticCurveTo(SP_X, SP_BOT + 6, SP_X - SP_RB, SP_BOT); g.closePath() }
    cone()
    const meat = g.createLinearGradient(SP_X - SP_RT, 0, SP_X + SP_RT, 0)
    meat.addColorStop(0, '#d98a3d'); meat.addColorStop(0.45, '#b4652e'); meat.addColorStop(1, '#6a3318')
    g.fillStyle = meat; g.fill()
    g.save(); cone(); g.clip()
    g.strokeStyle = 'rgba(70,28,10,0.32)'; g.lineWidth = 1.2
    for (let y = SP_TOP + 6; y < SP_BOT; y += 9) { const r = spR(y); g.beginPath(); g.ellipse(SP_X, y, r, 3, 0, 0, Math.PI); g.stroke() }
    for (let i = 0; i < 9; i++) {
      const th = now * 1.3 + (i * Math.PI * 2) / 9, c = Math.cos(th)
      if (c < -0.1) continue
      g.strokeStyle = `rgba(60,24,8,${(0.22 + 0.3 * c).toFixed(3)})`; g.lineWidth = 2 + 2 * c
      g.beginPath(); for (let y = SP_TOP; y <= SP_BOT; y += 11) g.lineTo(SP_X + spR(y) * Math.sin(th), y); g.stroke()
    }
    const yA = spY(band[0]), yB = spY(band[1])
    const inBand = m >= band[0] && m <= band[1]
    g.fillStyle = inBand ? 'rgba(255,205,90,0.55)' : 'rgba(255,190,80,0.28)'; g.fillRect(SP_X - 60, yA, 120, yB - yA)
    g.fillStyle = 'rgba(120,52,14,0.55)'
    for (let i = 0; i < 26; i++) { ell(g, SP_X - 40 + hash(i) * 80, yA + hash(i + 40) * (yB - yA), 2.2, 1.2, hash(i + 3)); g.fill() }
    g.restore()
    // ticks beside the crisp band so the target reads at a glance
    g.strokeStyle = inBand ? GOOD : 'rgba(23,247,144,0.7)'; g.lineWidth = 2.5
    for (const y of [yA, yB]) line(g, SP_X - spR(y) - 10, y, SP_X - spR(y) - 2, y)
    // shavings in the tray
    const n = this.shaves.length
    for (let i = 0; i < n * 9; i++) {
      const good = this.shaves[Math.floor(i / 9)] === 1
      g.strokeStyle = good ? (i % 2 ? '#a3561f' : '#c77a35') : (i % 2 ? '#c9a58c' : '#b79077'); g.lineWidth = 2.6
      const fx = 96 + hash(i + 2) * 64, fy = 186 - hash(i + 9) * (3 + n * 1.6)
      g.beginPath(); g.moveTo(fx - 4, fy); g.quadraticCurveTo(fx, fy - 3, fx + 4, fy); g.stroke()
    }
    // the knife rides up and down the spit; a shave pushes it into the meat
    const wrapping = a && a[0] === 'wrap'
    let ky = spY(m), kx = SP_X + spR(ky) - 4, kang = Math.PI
    if (a && a[0] === 'shave') { const k = a[1]; ky = this.cutY + k * 8; kx = SP_X + spR(ky) - 4 - Math.sin(k * Math.PI) * 12; kang = Math.PI - 0.12 * Math.sin(k * Math.PI) }
    // falling flakes
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i]!, t = now - f.t0
      if (t < 0) continue
      const fy = f.y + 30 * t + 300 * t * t
      if (fy > 184 || t > 0.9) { this.flakes.splice(i, 1); continue }
      g.strokeStyle = f.good ? '#b8692e' : '#c9a08a'; g.lineWidth = 2.4
      const fx = f.x + f.vx * t; g.beginPath(); g.moveTo(fx - 3, fy); g.quadraticCurveTo(fx, fy - 2.5, fx + 3, fy + 1); g.stroke()
    }
    if (wrapping) {
      const k = a[1]
      knife(g, 250, 146, Math.PI + 0.05)
      // the flatbread, the meat and salad, the roll, the paper
      const [wx, wy] = WRAP
      const kb = ease(seg(k, 0, 0.18)), kr = ease(seg(k, 0.45, 0.78)), kp = seg(k, 0.78, 0.92), gone = 1 - seg(k, 0.9, 0.98)
      g.globalAlpha = gone
      if (kr < 1) {
        ell(g, wx, wy, 44 * kb * (1 - kr * 0.55), 17 * kb * (1 - kr * 0.25)); g.fillStyle = '#ecd29a'; g.fill()
        g.fillStyle = 'rgba(160,100,40,0.45)'; for (let i = 0; i < 6; i++) { ell(g, wx - 26 + hash(i) * 52 * (1 - kr * 0.5), wy - 8 + hash(i + 5) * 16, 2.6, 1.6); g.fill() }
      }
      const km = seg(k, 0.15, 0.4)
      if (k >= 0.15 && kr < 0.7) {
        const c = lp([128, 182], [wx, wy - 2], ease(km))
        g.globalAlpha = gone * (1 - kr / 0.7)
        for (let i = 0; i < 12; i++) { g.strokeStyle = i % 2 ? '#a3561f' : '#c77a35'; g.lineWidth = 2.6; const fx = c[0] - 16 + hash(i) * 32, fy = c[1] - 3 + hash(i + 3) * 6; g.beginPath(); g.moveTo(fx - 4, fy); g.quadraticCurveTo(fx, fy - 3, fx + 4, fy); g.stroke() }
        if (k > 0.36) { g.fillStyle = '#5cb84a'; for (let i = 0; i < 5; i++) { ell(g, wx - 14 + i * 7, wy - 6 + (i % 2) * 5, 3.2, 1.6, 0.5); g.fill() } g.fillStyle = '#d8432f'; for (let i = 0; i < 3; i++) { ell(g, wx - 8 + i * 9, wy + 2, 2.2, 2.2); g.fill() } }
        g.globalAlpha = gone
      }
      if (kr > 0) {
        g.save(); g.translate(wx, wy); g.rotate(-0.12)
        const len = lerp(40, 74, kr), th = lerp(10, 24, kr)
        g.globalAlpha = gone * clamp(kr * 1.6)
        rr(g, -len / 2, -th / 2, len, th, th / 2); g.fillStyle = '#e8c98c'; g.fill()
        g.strokeStyle = 'rgba(150,95,40,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(-len / 2 + th / 2, 0, th * 0.3, th * 0.45, 0, -1.4, 1.4); g.stroke()
        if (kp > 0) { g.globalAlpha = gone * kp; rr(g, -len / 2 - 1, -th / 2 - 1, len * 0.62, th + 2, th / 2); g.fillStyle = '#f7f0e2'; g.fill(); g.fillStyle = MCGRIND_GREEN; g.fillRect(-len / 2 + len * 0.36, -th / 2 - 1, 5, th + 2) }
        g.restore()
      }
      g.globalAlpha = 1
      // two hands: lay the bread, then roll it from both ends
      const lIn: Pt = [130, 262], rIn: Pt = [330, 262]
      const lAt: Pt = kr > 0 ? [wx - 30 + kr * 6, wy + 10 - kr * 6] : [wx - 36, wy + 6], rAt: Pt = kr > 0 ? [wx + 30 - kr * 6, wy + 10 - kr * 6] : [wx + 40, wy + 12]
      const lp1 = k < 0.15 ? lp(lIn, lAt, ease(seg(k, 0, 0.15))) : k < 0.86 ? lAt : lp(lAt, lIn, ease(seg(k, 0.86, 1)))
      const rp1 = k < 0.4 ? lp(rIn, rAt, ease(seg(k, 0.2, 0.4))) : k < 0.86 ? rAt : lp(rAt, rIn, ease(seg(k, 0.86, 1)))
      hand(g, lp1[0], lp1[1], 0.35, kr > 0 && kr < 1 ? 'grip' : 'open', [lp1[0] - 40, lp1[1] + 120], 19, true)
      hand(g, rp1[0], rp1[1], -0.35, kr > 0 && kr < 1 ? 'grip' : 'open', [rp1[0] + 40, rp1[1] + 120], 19)
    } else {
      knife(g, kx + 76, ky, kang)
      hand(g, kx + 76 - 10, ky + 3, -0.2, 'grip', [kx + 140, ky + 150], 19)
    }
    this.finish(g, now)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Drinks: a machine with three taps. Set the cup under its tap (pearls first for boba), hold to pour, let go at
// the line, lid and straw, out to the pass.
const TAP: Record<Drink, number> = { shake: 92, smoothie: 160, boba: 228 }
const CUP_B = 196, CUP_H = 98, CUP_TW = 27, CUP_BW = 20, IN_B = 193, IN_H = 90
function paintDrinks(g: G): void {
  tiles(g, 320, 130)
  counterTop(g, 320, 220, 130)
  steel(g, 28, 4, 264, 80)
  rr(g, 38, 12, 244, 40, 8); g.fillStyle = '#0d1411'; g.fill()
  g.textAlign = 'center'; g.textBaseline = 'middle'
  for (const [d, label] of [['shake', 'SHAKE'], ['smoothie', 'SMOOTHIE'], ['boba', 'BOBA TEA']] as Array<[Drink, string]>) {
    const x = TAP[d]
    ell(g, x, 26, 6, 6); g.fillStyle = DRINK[d]; g.fill()
    g.font = `800 8.5px ${FONT}`; g.fillStyle = '#e8f4ee'; g.fillText(label, x, 41)
    g.fillStyle = '#c2cacf'; g.fillRect(x - 6, 84, 12, 6); g.fillStyle = '#7d878d'; g.fillRect(x - 3, 90, 6, 5)
  }
  rr(g, 34, 196, 252, 14, 3); g.fillStyle = '#2b3236'; g.fill()
  g.strokeStyle = '#59646a'; g.lineWidth = 1.4; for (let x = 40; x < 284; x += 6) line(g, x, 198, x, 208)
}
function cupPath(g: G, x: number, b: number): void { poly(g, [x - CUP_TW, b - CUP_H, x + CUP_TW, b - CUP_H, x + CUP_BW, b, x - CUP_BW, b]) }
export class DrinksArt extends Station {
  pick: Drink | null = null
  pearls = false
  level = 0
  pouring = false
  private lastPick: Drink = 'shake'
  private lastLevel = 0
  private lastPearls = false
  constructor() { super(paintDrinks) }
  place(d: Drink): void { this.lastPick = d; this.play('place', 0.4) }
  addPearls(): void { this.play('pearls', 0.65) }
  /** The cup leaves: lidded to the pass when `keep`, otherwise poured away (`spill` = ran over the top). */
  done(d: Drink, level: number, keep: boolean, spill: boolean): void {
    this.lastPick = d; this.lastLevel = level; this.lastPearls = d === 'boba'
    this.play(keep ? 'lid' : spill ? 'spill' : 'waste', keep ? 0.8 : 0.7)
    if (keep) this.send(d, [TAP[d], CUP_B], 64, 0.62)
  }
  cancel(): void { this.play('waste', 0.35) }
  draw(now: number, band: [number, number], dpr: number): void {
    if (!this.view.begin(dpr)) return
    const g = this.view.g, a = this.cur(now)
    const rest: Pt = [292, 176 + Math.sin(now * 1.7) * 1.2]
    let d: Drink | null = this.pick, level = this.level, pearls = this.pearls
    let cupX = d ? TAP[d] : 0, cupB = CUP_B, cupAlpha = 1, lid = false, straw = false, spill = 0
    let rh: Pt | null = null, lh: { p: Pt; tool: 'ladle' | 'lid' } | null = null, pearlDrop = -1
    if (a) {
      const [kind, k] = a
      if (kind === 'place' && d) { cupB = lerp(250, CUP_B, easeOut(seg(k, 0, 1))) }
      else if (kind === 'pearls' && d) {
        const above: Pt = [cupX - 18, CUP_B - CUP_H - 14]
        lh = { p: k < 0.4 ? lp([-30, 150], above, ease(seg(k, 0, 0.4))) : k < 0.75 ? above : lp(above, [-30, 150], ease(seg(k, 0.75, 1))), tool: 'ladle' }
        if (k > 0.42 && k < 0.78) pearlDrop = seg(k, 0.42, 0.78)
        pearls = k > 0.7
      } else if (kind === 'lid' || kind === 'spill' || kind === 'waste') {
        d = this.lastPick; cupX = TAP[d]; level = this.lastLevel; pearls = this.lastPearls
        if (kind === 'lid') {
          const above: Pt = [cupX - 6, CUP_B - CUP_H - 30], on: Pt = [cupX - 4, CUP_B - CUP_H - 8]
          if (k < 0.5) lh = { p: k < 0.3 ? lp([-30, 60], above, ease(seg(k, 0, 0.3))) : lp(above, on, ease(seg(k, 0.3, 0.42))), tool: 'lid' }
          else lh = { p: lp(on, [-30, 80], ease(seg(k, 0.5, 0.75))), tool: 'lid' }
          lid = k > 0.42; straw = k > 0.52
          if (k > 0.6) cupAlpha = 1 - seg(k, 0.6, 0.78)
        } else {
          spill = kind === 'spill' ? 1 : 0
          if (kind === 'waste' && this.lastLevel === 0) level = 0
          cupB = lerp(CUP_B, 260, ease(seg(k, 0.45, 1)))
        }
      }
    }
    // a slow drip from the taps when nothing pours
    if (!this.pouring) for (const dd of ['shake', 'smoothie', 'boba'] as Drink[]) {
      const ph = (now * 0.4 + hash(TAP[dd]) * 3) % 1
      if (ph < 0.5) { g.fillStyle = DRINK[dd]; ell(g, TAP[dd], 96 + ph * 200, 1.6, 2.2); g.fill() }
    }
    if (d) {
      const surf = IN_B - clamp(level, 0, 1.06) * IN_H
      // the stream from the tap
      if (this.pouring) {
        g.strokeStyle = DRINK[d]; g.lineWidth = 5.5; g.lineCap = 'round'
        g.beginPath(); g.moveTo(cupX, 95); for (let y = 95; y <= surf; y += 8) g.lineTo(cupX + Math.sin(y * 0.3 + now * 18) * 0.8, y); g.stroke()
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.4; line(g, cupX - 1.2, 96, cupX - 1.2, surf)
      }
      g.globalAlpha = cupAlpha
      // the liquid inside the cup
      g.save(); cupPath(g, cupX, cupB); g.clip()
      if (level > 0) {
        const s = cupB - (CUP_B - surf)
        g.fillStyle = DRINK[d]; g.fillRect(cupX - 40, s, 80, CUP_B)
        ell(g, cupX, s, 24, 2.5); g.fillStyle = mix(DRINK[d], '#ffffff', 0.35); g.fill()
        if (this.pouring) { g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 4; i++) { const ph = (now * 3 + i / 4) % 1; ell(g, cupX + Math.sin(i * 2) * 8, s + 2, 2 + ph * 5, 1 + ph * 1.4); g.globalAlpha = cupAlpha * (1 - ph); g.fill() } g.globalAlpha = cupAlpha }
      }
      if (pearls) { g.fillStyle = PEARL; for (let i = 0; i < 14; i++) { ell(g, cupX - 16 + (i % 7) * 5.4, cupB - 6 - Math.floor(i / 7) * 5, 3, 3); g.fill() } }
      g.restore()
      // the cup: clear plastic with a green sleeve and the fill lines printed on it
      cupPath(g, cupX, cupB); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.4; g.stroke()
      const yA = cupB - (CUP_B - (IN_B - band[0] * IN_H)), yB = cupB - (CUP_B - (IN_B - band[1] * IN_H))
      const on = level >= band[0] && level <= band[1]
      g.fillStyle = on ? 'rgba(23,247,144,0.45)' : 'rgba(23,247,144,0.18)'; g.fillRect(cupX - 25, yB, 50, yA - yB)
      g.strokeStyle = on ? GOOD : 'rgba(10,120,70,0.9)'; g.lineWidth = 1.6
      line(g, cupX - 25, yA, cupX + 25, yA); line(g, cupX - 25.5, yB, cupX + 25.5, yB)
      g.fillStyle = MCGRIND_GREEN; poly(g, [cupX - 22.5, cupB - 44, cupX + 22.5, cupB - 44, cupX + 21.5, cupB - 30, cupX - 21.5, cupB - 30]); g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; line(g, cupX - 18, cupB - 88, cupX - 14, cupB - 8)
      if (spill) {
        g.fillStyle = DRINK[d]
        for (let i = 0; i < 4; i++) { const ph = (now * 1.6 + i / 4) % 1; ell(g, cupX + (i < 2 ? -CUP_TW + 2 : CUP_TW - 2) + (i % 2) * 3, cupB - CUP_H + 4 + ph * CUP_H, 2, 3.5); g.fill() }
        ell(g, cupX, CUP_B + 4, 36, 4); g.globalAlpha = 0.7; g.fill(); g.globalAlpha = cupAlpha
      }
      if (lid) {
        if (d === 'shake') { g.beginPath(); g.ellipse(cupX, cupB - CUP_H, CUP_TW + 1, 16, 0, Math.PI, 0); g.closePath(); g.fillStyle = 'rgba(255,240,244,0.92)'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke() }
        else { rr(g, cupX - CUP_TW - 2, cupB - CUP_H - 4, CUP_TW * 2 + 4, 6, 3); g.fillStyle = '#f2f2f2'; g.fill() }
      }
      if (straw) { g.strokeStyle = d === 'boba' ? '#1e1e24' : d === 'shake' ? '#e8364a' : MCGRIND_BRIGHT; g.lineWidth = d === 'boba' ? 6 : 3.5; line(g, cupX + 6, cupB - CUP_H + 10, cupX + 14, cupB - CUP_H - 30) }
      g.globalAlpha = 1
      if (pearlDrop >= 0) { g.fillStyle = PEARL; for (let i = 0; i < 10; i++) { const t = clamp(pearlDrop * 1.4 - i * 0.04); if (t <= 0 || t >= 1) continue; ell(g, cupX - 10 + hash(i) * 20, lerp(CUP_B - CUP_H - 6, CUP_B - 8, t * t), 3, 3); g.fill() } }
      // the right hand steadies the cup while it is set down and filled
      if (!a || a[0] === 'place' || a[0] === 'pearls') rh = [cupX + CUP_TW + 8, cupB - 52]
    }
    if (lh) {
      const p = lh.p
      if (lh.tool === 'ladle') {
        g.strokeStyle = '#9aa4aa'; g.lineWidth = 3; line(g, p[0] - 30, p[1] + 26, p[0] + 10, p[1] + 2)
        ell(g, p[0] + 16, p[1] + 2, 9, 5); g.fillStyle = '#c9d0d4'; g.fill()
        if (pearlDrop < 0.2 && !pearls) { g.fillStyle = PEARL; for (let i = 0; i < 5; i++) { ell(g, p[0] + 11 + i * 2.5, p[1] - 1, 2.6, 2.6); g.fill() } }
        hand(g, p[0] - 26, p[1] + 26, 0.9, 'grip', [p[0] - 120, p[1] + 110], 19, true)
      } else {
        rr(g, p[0] - CUP_TW - 2, p[1] - 6, CUP_TW * 2 + 4, 6, 3); g.fillStyle = '#f2f2f2'; if (!lid) g.fill()
        hand(g, p[0] - 2, p[1] - 10, 0.35, 'open', [p[0] - 80, p[1] + 170], 19, true)
      }
    }
    if (rh) hand(g, rh[0], rh[1], -1.5, 'grip', [rh[0] + 130, rh[1] + 60], 20)
    else hand(g, rest[0], rest[1], -0.75, 'open', [rest[0] + 110, rest[1] + 90], 20)
    this.finish(g, now)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The counter: customers walk up, say their order in a bubble, wait (their face says how long), and take a tray.
export type Guest = { id: number; name: string; items: Item[]; got: boolean[]; k: number; ready: boolean }
type Look = { skin: string; top: string; hair: 'hijab' | 'gele' | 'braids' | 'short' | 'kufi' | 'afro'; wrap: string }
type Sprite = { id: number; look: Look; items: Item[]; got: boolean[]; x: number; tx: number; born: number; k: number; ready: boolean; state: 'line' | 'served' | 'left'; t1: number; amount: string }
const SKINS = ['#5a3825', '#6b4229', '#8a5a3c', '#a06a45', '#7a4b30', '#c68e5d', '#4a2f20']
const TOPS = ['#e4572e', '#2e86ab', '#f2c14e', '#7b4ea3', '#2a9d8f', '#d1495b', '#3d405b', '#ef8354', '#1b998b', '#c44569']
const HAIR: Record<string, Look['hair']> = {
  Zainab: 'hijab', Halima: 'hijab', Fatima: 'hijab', Aisha: 'hijab', Amaka: 'gele', Ngozi: 'gele', Kemi: 'gele',
  Ada: 'braids', Bola: 'braids', Musa: 'kufi', Yusuf: 'kufi', Uche: 'afro', Seyi: 'afro',
}
const SLOT = (i: number) => 80 + i * 160
function lookFor(name: string, id: number): Look {
  const h = (n: number) => Math.floor(hash(id * 7.3 + n) * 1000)
  return { skin: SKINS[h(1) % SKINS.length]!, top: TOPS[h(2) % TOPS.length]!, hair: HAIR[name] ?? 'short', wrap: TOPS[h(3) % TOPS.length]! }
}
function paintCounter(g: G): void {
  // the dining room behind the customers: warm wall, big windows on the street, a green band
  const wall = g.createLinearGradient(0, 0, 0, 140); wall.addColorStop(0, '#f6efe2'); wall.addColorStop(1, '#e7dcc6')
  g.fillStyle = wall; g.fillRect(0, 0, 640, 140)
  for (const wx of [18, 338]) {
    const sky = g.createLinearGradient(0, 14, 0, 108); sky.addColorStop(0, '#b9dff5'); sky.addColorStop(1, '#eaf6fb')
    g.fillStyle = sky; g.fillRect(wx, 14, 284, 94)
    g.fillStyle = '#c9d8e1'
    for (let i = 0; i < 9; i++) { const bw = 20 + hash(wx + i) * 22, bh = 26 + hash(wx + i + 20) * 46; g.fillRect(wx + 4 + i * 31, 108 - bh, bw, bh) }
    g.fillStyle = 'rgba(255,255,255,0.35)'; poly(g, [wx + 40, 14, wx + 90, 14, wx + 40, 108, wx, 108]); g.fill()
    g.strokeStyle = '#f9f6f0'; g.lineWidth = 5; g.strokeRect(wx, 14, 284, 94)
    g.lineWidth = 3; line(g, wx + 142, 14, wx + 142, 108)
  }
  g.fillStyle = MCGRIND_GREEN; g.fillRect(0, 116, 640, 12)
  g.fillStyle = MCGRIND_BRIGHT; g.fillRect(0, 116, 640, 2)
  // the counter top (the pass) under warm heat lamps, and the steel edge on the cook's side
  const top = g.createLinearGradient(0, 140, 0, 198); top.addColorStop(0, '#ddd5c6'); top.addColorStop(1, '#f1ebe0')
  g.fillStyle = top; g.fillRect(0, 140, 640, 58)
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, 140, 640, 2)
  for (const lx of [110, 320, 530]) {
    const lamp = g.createRadialGradient(lx, 176, 6, lx, 176, 120); lamp.addColorStop(0, 'rgba(255,170,70,0.28)'); lamp.addColorStop(1, 'rgba(255,170,70,0)')
    g.fillStyle = lamp; g.fillRect(lx - 120, 140, 240, 58)
  }
  steel(g, 0, 198, 640, 32)
  g.font = `800 10px ${FONT}`; g.fillStyle = 'rgba(30,40,36,0.55)'; g.textAlign = 'left'; g.textBaseline = 'middle'
  g.fillText('THE PASS', 12, 214)
}
function person(g: G, s: Sprite, now: number, mood: number, talk: boolean, holding: boolean): void {
  const L = s.look
  // body
  if (L.hair === 'hijab') { g.beginPath(); g.moveTo(-21, -58); g.quadraticCurveTo(-30, -30, -32, 0); g.lineTo(32, 0); g.quadraticCurveTo(30, -30, 21, -58); g.closePath(); g.fillStyle = L.wrap; g.fill() }
  g.beginPath(); g.moveTo(-30, 0); g.lineTo(-26, -32); g.quadraticCurveTo(0, -44, 26, -32); g.lineTo(30, 0); g.closePath(); g.fillStyle = L.top; g.fill()
  g.fillStyle = 'rgba(0,0,0,0.12)'; poly(g, [6, -40, 26, -32, 30, 0, 10, 0]); g.fill()
  if (L.hair === 'hijab') { g.beginPath(); g.moveTo(-20, -60); g.quadraticCurveTo(-24, -36, -16, -30); g.lineTo(16, -30); g.quadraticCurveTo(24, -36, 20, -60); g.closePath(); g.fillStyle = L.wrap; g.fill() }
  else { g.fillStyle = L.skin; rr(g, -6, -48, 12, 12, 4); g.fill() }
  // head
  if (L.hair === 'afro') { ell(g, 0, -64, 21, 19); g.fillStyle = '#1d1410'; g.fill() }
  if (L.hair === 'hijab') { ell(g, 0, -60, 20, 21); g.fillStyle = L.wrap; g.fill(); ell(g, 0, -57, 11.5, 13.5); g.fillStyle = L.skin; g.fill() }
  else {
    ell(g, -14.5, -57, 3, 4); g.fillStyle = L.skin; g.fill(); ell(g, 14.5, -57, 3, 4); g.fill()
    ell(g, 0, -58, 14.5, 16); g.fill()
  }
  if (L.hair === 'short') { g.beginPath(); g.ellipse(0, -62, 15, 13, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#1d1410'; g.fill() }
  else if (L.hair === 'braids') { g.beginPath(); g.ellipse(0, -63, 16, 13, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#1d1410'; g.fill(); g.strokeStyle = '#1d1410'; g.lineWidth = 3.4; for (const bx of [-15, -12, 12, 15]) line(g, bx, -64, bx * 1.1, -34) }
  else if (L.hair === 'kufi') { rr(g, -13, -80, 26, 14, 5); g.fillStyle = L.wrap; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; line(g, -11, -74, 11, -74) }
  else if (L.hair === 'gele') {
    g.beginPath(); g.ellipse(0, -74, 22, 13, 0, Math.PI * 0.95, Math.PI * 0.05 + Math.PI * 2); g.closePath(); g.fillStyle = L.wrap; g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1.4; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-4 + i * 6, -72, 10 - i * 2, Math.PI * 1.1, Math.PI * 1.8); g.stroke() }
  } else if (L.hair === 'afro') { g.beginPath(); g.ellipse(0, -66, 18, 13, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#1d1410'; g.fill() }
  // face: eyes blink now and then, brows and mouth follow patience
  const blink = (now + s.id * 1.7) % 4 < 0.12
  g.fillStyle = '#1b1410'; g.strokeStyle = '#1b1410'; g.lineWidth = 1.6
  for (const ex of [-5.5, 5.5]) { if (blink) line(g, ex - 2, -58, ex + 2, -58); else { ell(g, ex, -58, 1.9, 2.2); g.fill() } }
  const cross = mood < 0.3 ? 1 : 0
  g.lineWidth = 1.5; line(g, -8, -63 + cross * 1.5, -3.5, -63 - cross * 1.5); line(g, 3.5, -63 - cross * 1.5, 8, -63 + cross * 1.5)
  g.strokeStyle = '#5a1f17'; g.lineWidth = 1.8
  if (talk && Math.sin(now * 22) > -0.2) { ell(g, 0, -49.5, 3, 2 + Math.abs(Math.sin(now * 13)) * 1.6); g.fillStyle = '#5a1f17'; g.fill() }
  else if (mood > 0.55) { g.beginPath(); g.arc(0, -52, 4.5, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke() }
  else if (mood > 0.3) line(g, -3.5, -49.5, 3.5, -49.5)
  else { g.beginPath(); g.arc(0, -45.5, 4.5, 1.25 * Math.PI, 1.75 * Math.PI); g.stroke() }
  if (holding) { g.fillStyle = s.look.skin; ell(g, -44, -6, 5, 4.5); g.fill(); ell(g, 44, -6, 5, 4.5); g.fill() }
}
function tray(g: G, x: number, y: number, items: Item[], sc = 1): void {
  g.save(); g.translate(x, y); g.scale(sc, sc)
  poly(g, [-46, -8, 46, -8, 52, 6, -52, 6]); g.fillStyle = MCGRIND_GREEN; g.fill()
  g.fillStyle = '#0b5c37'; g.fillRect(-52, 6, 104, 4)
  const n = items.length
  items.forEach((it, i) => drawItem(g, it, (i - (n - 1) / 2) * 26, 0, 30))
  g.restore()
}
export class CounterArt {
  readonly view = new View(640, 230, paintCounter)
  private sprites = new Map<number, Sprite>()
  private pass: Array<[Item, number]> = []
  private bumps = new Map<Item, number>()
  private more = 0
  private last = nowS()
  private readonly pops: Pop[] = []
  /** The line as the shift sees it: the first four stand at the counter. */
  sync(guests: Guest[], waiting: number): void {
    const now = nowS()
    const shown = new Set<number>()
    guests.slice(0, 4).forEach((q, i) => {
      let s = this.sprites.get(q.id)
      if (!s) { s = { id: q.id, look: lookFor(q.name, q.id), items: q.items, got: q.got, x: 700 + i * 60, tx: SLOT(i), born: now, k: q.k, ready: q.ready, state: 'line', t1: 0, amount: '' }; this.sprites.set(q.id, s) }
      s.tx = SLOT(i); s.k = q.k; s.ready = q.ready; s.got = q.got
      shown.add(q.id)
    })
    for (const s of this.sprites.values()) if (s.state === 'line' && !shown.has(s.id)) { s.state = 'left'; s.t1 = now }
    this.more = waiting
  }
  served(id: number, amount: string): void { const s = this.sprites.get(id); if (s) { s.state = 'served'; s.t1 = nowS(); s.amount = amount; this.pops.push({ text: amount, col: GOOD, t0: s.t1 + 0.3, x: s.x, y: 40 }) } }
  /** A word from a customer who was handed part of their order. */
  note(id: number, text: string): void { const s = this.sprites.get(id); if (s) this.pops.push({ text, col: GOOD, t0: nowS(), x: s.x, y: 40 }) }
  left(id: number): void { const s = this.sprites.get(id); if (s) { s.state = 'left'; s.t1 = nowS(); this.pops.push({ text: 'Left', col: BAD, t0: s.t1, x: s.x, y: 40 }) } }
  setPass(list: Array<[Item, number]>): void {
    const old = new Map(this.pass)
    for (const [it, n] of list) if (n > (old.get(it) ?? 0)) this.bumps.set(it, nowS())
    this.pass = list
  }
  /** Which counter slot a tap landed on (0-3), or -1. */
  slotAt(e: { clientX: number; clientY: number }): number {
    const [x, y] = this.view.at(e)
    if (y > 140) return -1
    return Math.max(0, Math.min(3, Math.floor(x / 160)))
  }
  draw(now: number, dpr: number): void {
    const dt = Math.min(0.1, now - this.last); this.last = now
    // the next in line waits a step back until the last customer has taken the tray and gone
    const going = [...this.sprites.values()].filter((d) => d.state !== 'line' && now - d.t1 < 0.95)
    for (const s of this.sprites.values()) {
      if (s.state !== 'line') continue
      const to = going.some((d) => Math.abs(d.x - s.tx) < 70) ? s.tx + 78 : s.tx
      s.x += (to - s.x) * (1 - Math.exp(-dt * 5))
    }
    if (!this.view.begin(dpr)) return
    const g = this.view.g
    const list = [...this.sprites.values()].sort((a, b) => (a.state === 'line' ? 1 : 0) - (b.state === 'line' ? 1 : 0))
    if (!list.length) {
      g.font = `700 15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
      rr(g, 170, 50, 300, 34, 17); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill()
      g.fillStyle = '#0b5c37'; g.fillText('Quiet for now: cook ahead, fries and drinks keep', 320, 67)
    }
    for (const s of list) {
      let y = 140, sc = 1, alpha = 1, holding = false
      const age = now - s.born
      const walking = Math.abs(s.tx - s.x) > 4 && s.state === 'line'
      if (walking) y += Math.abs(Math.sin(now * 9)) * -2.5
      if (s.state !== 'line') {
        const t = now - s.t1
        const leaveAt = s.state === 'served' ? 0.6 : 0.2
        if (t > leaveAt + 0.9) { this.sprites.delete(s.id); continue }
        const kl = seg(t, leaveAt, leaveAt + 0.9)
        sc = 1 - kl * 0.25; y -= kl * 18; alpha = 1 - kl
        holding = s.state === 'served' && t > 0.3
      }
      g.save(); g.globalAlpha = alpha; g.translate(s.x, y); g.scale(sc * 1.15, sc * 1.15)
      if (s.state === 'served' && now - s.t1 > 0.3) tray(g, 0, -4, s.items, 0.9)
      person(g, s, now, s.state === 'left' ? 0 : s.state === 'served' ? 1 : s.k, s.state === 'line' && age > 0.5 && age < 1.8, holding)
      g.restore()
      // the order bubble with a patience bar
      if (s.state === 'line' && !walking) {
        const n = s.items.length, bw = n * 36 + 18, bx = s.x - bw / 2
        g.globalAlpha = clamp((age - 0.4) * 4)
        rr(g, bx, 4, bw, 50, 12); g.fillStyle = '#ffffff'; g.fill()
        g.lineWidth = s.ready ? 3 : 1; g.strokeStyle = s.ready ? GOOD : 'rgba(0,0,0,0.12)'; g.stroke()
        poly(g, [s.x - 7, 53, s.x + 7, 53, s.x, 62]); g.fillStyle = '#ffffff'; g.fill()
        s.items.forEach((it, i) => {
          const ix = bx + 27 + i * 36
          // what they already have is faded with a small green tick
          if (s.got[i]) { g.globalAlpha = clamp((age - 0.4) * 4) * 0.35 }
          drawItem(g, it, ix, 43, 34)
          g.globalAlpha = clamp((age - 0.4) * 4)
          if (s.got[i]) { ell(g, ix + 10, 14, 6.5, 6.5); g.fillStyle = GOOD; g.fill(); g.strokeStyle = '#04331b'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(ix + 7, 14); g.lineTo(ix + 9.5, 16.5); g.lineTo(ix + 13.5, 11); g.stroke() }
        })
        rr(g, bx + 9, 46, bw - 18, 4, 2); g.fillStyle = '#e6e6e6'; g.fill()
        rr(g, bx + 9, 46, Math.max(4, (bw - 18) * clamp(s.k)), 4, 2); g.fillStyle = s.k > 0.5 ? '#20b46a' : s.k > 0.25 ? '#f0a020' : BAD; g.fill()
        if (s.ready) { ell(g, bx + bw - 4, 8, 8, 8); g.fillStyle = GOOD; g.fill(); g.strokeStyle = '#04331b'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(bx + bw - 8, 8); g.lineTo(bx + bw - 5, 11); g.lineTo(bx + bw, 4.5); g.stroke() }
        g.globalAlpha = 1
      }
      // our hands slide the tray across the counter to them
      if (s.state === 'served') {
        const t = now - s.t1
        if (t < 0.6) {
          const kt = easeOut(seg(t, 0, 0.32)), ty = lerp(250, 136, kt), back = seg(t, 0.32, 0.6)
          if (t < 0.32) tray(g, s.x, ty, s.items)
          const hy = ty + 8 + back * 90
          hand(g, s.x - 48, hy, -0.15, 'open', [s.x - 80, hy + 140], 19, true)
          hand(g, s.x + 48, hy, 0.15, 'open', [s.x + 80, hy + 140], 19)
        }
      }
    }
    // the pass: what is cooked and waiting, newest additions bounce
    g.textAlign = 'center'; g.textBaseline = 'middle'
    this.pass.forEach(([it, n], i) => {
      const x = 118 + i * 84, b = this.bumps.get(it) ?? 0, kb = now - b < 0.35 ? Math.sin(((now - b) / 0.35) * Math.PI) * 0.18 : 0
      drawItem(g, it, x, 192, 44 * (1 + kb))
      ell(g, x + 20, 156, 10, 10); g.fillStyle = MCGRIND_GREEN; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.stroke()
      g.font = `800 11px ${FONT}`; g.fillStyle = '#fff'; g.fillText(String(n), x + 20, 156.5)
    })
    if (!this.pass.length) { g.font = `600 12px ${FONT}`; g.fillStyle = 'rgba(40,50,46,0.6)'; g.fillText('Nothing on the pass yet: cook below', 320, 172) }
    if (this.more > 0) {
      g.font = `800 12px ${FONT}`
      rr(g, 560, 120, 72, 18, 9); g.fillStyle = 'rgba(11,92,55,0.92)'; g.fill(); g.fillStyle = '#fff'; g.fillText(`+${this.more} waiting`, 596, 129.5)
    }
    drawPops(g, this.pops, now, 20)
  }
}
