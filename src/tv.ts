import * as THREE from 'three'
import { getSave } from './state.ts'
import { passedCount } from './certs.ts'
import { rankFor } from './logic.ts'
import { liveNews, ensureNews, ago, fmtPrice } from './marketNews.ts'

// Wall TVs: a small canvas screen that wakes when the player is close (or taps it) and sleeps when far or
// offscreen. Repaints at ~6 fps while on, nothing at all while off, so it costs a phone almost nothing.
const W = 512
const H = 288
const NEWS = [
  'Campus adds a liquidity module · four exercises, one source line',
  'Plaza benches restored · sit a while, the city keeps moving',
  'Trading floor reminder · size the position before the entry',
  'Studio row · bounties pay in in-game cash',
  'Gym streaks count once a day · four stations, one set',
  'Not your keys, not your coins',
]

type Tv = { mesh: THREE.Mesh; tex: THREE.CanvasTexture; g: CanvasRenderingContext2D; on: boolean; forced: boolean; acc: number; t: number; glow: number; channel: number; sphere: THREE.Sphere
  /** Plasma sets: undefined wakes by itself near the player; false is switched off; true is on (remote). */
  power?: boolean; program?: number }
const tvs: Tv[] = []
const frustum = new THREE.Frustum()
const m4 = new THREE.Matrix4()

function paint(tv: Tv) {
  const g = tv.g
  const s = getSave()
  g.globalAlpha = 1
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#16181c'); bg.addColorStop(1, '#0c0d10')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  // Header.
  g.fillStyle = '#c9a25e'; g.fillRect(24, 26, 4, 22)
  g.fillStyle = '#efe9dc'; g.font = '600 20px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textBaseline = 'middle'
  g.fillText('GRIND DISTRICT', 38, 37)
  g.fillStyle = '#8d877c'; g.font = '500 16px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
  const clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  g.textAlign = 'right'; g.fillText(clock, W - 24, 37); g.textAlign = 'left'
  const slide = Math.floor(tv.t / 7 + tv.channel) % 2
  if (slide === 0) {
    // City stats.
    g.fillStyle = '#8d877c'; g.font = '500 15px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText('YOUR CITY FILE', 24, 82)
    const rows: Array<[string, string]> = [['Rank', rankFor(s.xp).label], ['Reputation', String(s.reputation ?? 0)], ['Courses passed', String(passedCount())]]
    rows.forEach(([k, val], i) => {
      const y = 118 + i * 38
      g.fillStyle = '#b9b2a5'; g.font = '400 19px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText(k, 24, y)
      g.fillStyle = '#efe9dc'; g.font = '600 21px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textAlign = 'right'; g.fillText(val, W - 24, y); g.textAlign = 'left'
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(24, y + 18, W - 48, 1)
    })
  } else {
    // A calm market line, drawn as it ticks.
    g.fillStyle = '#8d877c'; g.font = '500 15px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText('DISTRICT COIN · PRACTICE MARKET', 24, 82)
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1
    for (let y = 110; y <= 220; y += 36) { g.beginPath(); g.moveTo(24, y); g.lineTo(W - 24, y); g.stroke() }
    g.beginPath(); g.lineWidth = 2.5; g.strokeStyle = '#c9a25e'
    for (let i = 0; i <= 46; i++) {
      const k = i + tv.t * 1.5
      const y = 168 - Math.sin(k * 0.31) * 26 - Math.sin(k * 0.11 + 1) * 18
      const x = 24 + (i / 46) * (W - 48)
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.stroke()
  }
  // News ticker.
  g.fillStyle = '#1d2025'; g.fillRect(0, H - 44, W, 44)
  g.fillStyle = '#c9a25e'; g.fillRect(0, H - 44, 70, 44)
  g.fillStyle = '#14110e'; g.font = '700 14px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText('NEWS', 14, H - 22)
  g.save(); g.beginPath(); g.rect(70, H - 44, W - 70, 44); g.clip()
  g.fillStyle = '#d9d3c6'; g.font = '500 17px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
  const live = liveNews()
  const line = live && (live.crypto.length || live.markets.length) ? [...live.crypto.slice(0, 5), ...live.markets.slice(0, 4)].map((h) => `${h.t} (${h.src})`).join('     ·     ') : NEWS.join('     ·     ')
  const lw = g.measureText(line).width + 60
  const off = (tv.t * 55) % lw
  g.fillText(line, 84 - off, H - 22); g.fillText(line, 84 - off + lw, H - 22)
  g.restore()
  // Power-on fade.
  if (tv.glow < 1) { g.fillStyle = `rgba(0,0,0,${1 - tv.glow})`; g.fillRect(0, 0, W, H) }
  tv.tex.needsUpdate = true
}

export const PROGRAMS = ['Markets live', 'Crypto news', 'Market news', 'GD News', 'Nature', 'Raceway', 'Music']
const FONT = '-apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
/** The plasma's other channels: a markets board, a nature film, motorsport and a music visualiser. */
/** Wrap text into at most `lines` lines of width `w`; the last line ends with an ellipsis if cut. */
function wrap(g: CanvasRenderingContext2D, text: string, w: number, lines: number): string[] {
  const words = text.split(' '), out: string[] = []
  let cur = ''
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (g.measureText(next).width <= w) { cur = next; continue }
    out.push(cur); cur = word
    if (out.length === lines) break
  }
  if (out.length < lines && cur) out.push(cur)
  if (out.length === lines && words.join(' ') !== out.join(' ')) { let l = out[lines - 1]!; while (l && g.measureText(`${l}…`).width > w) l = l.slice(0, -1); out[lines - 1] = `${l.trimEnd()}…` }
  return out
}
const LIVE_DOT = (g: CanvasRenderingContext2D, x: number, y: number, t: number) => { g.fillStyle = `rgba(239,68,68,${0.55 + Math.sin(t * 4) * 0.45})`; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill() }
/** The bottom strip: live prices for the headline channels, or headlines for the prices channel. */
function strip(g: CanvasRenderingContext2D, t: number, text: string) {
  g.fillStyle = '#0b1220'; g.fillRect(0, H - 34, W, 34)
  g.save(); g.beginPath(); g.rect(0, H - 34, W, 34); g.clip()
  g.fillStyle = '#d6dee6'; g.font = `600 15px ${FONT}`; g.textBaseline = 'middle'
  const lw = g.measureText(text).width + 80, off = (t * 46) % lw
  g.fillText(text, 12 - off, H - 17); g.fillText(text, 12 - off + lw, H - 17)
  g.restore()
}
const priceLine = () => (liveNews()?.coins ?? []).map((c) => `${c.s} ${fmtPrice(c.last)} ${c.chg >= 0 ? '▲' : '▼'}${Math.abs(c.chg).toFixed(2)}%`).join('     ')

/** Markets live: real prices with 24-hour change, and Bitcoin over the last 48 hours. */
function paintMarkets(tv: Tv) {
  const g = tv.g, t = tv.t, news = liveNews()
  g.fillStyle = '#07101a'; g.fillRect(0, 0, W, H)
  g.textBaseline = 'middle'; g.textAlign = 'left'
  LIVE_DOT(g, 22, 24, t)
  g.fillStyle = '#f2f5f8'; g.font = `800 18px ${FONT}`; g.fillText('MARKETS LIVE', 34, 24)
  g.fillStyle = '#7f93a6'; g.font = `500 13px ${FONT}`; g.textAlign = 'right'
  g.fillText(news ? `Updated ${new Date(news.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting to the markets…', W - 16, 24); g.textAlign = 'left'
  const coins = news?.coins ?? []
  coins.slice(0, 5).forEach((c, i) => {
    const y = 64 + i * 34
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(12, y - 15, 186, 30)
    g.fillStyle = '#e6edf3'; g.font = `700 15px ${FONT}`; g.fillText(c.s, 20, y)
    g.font = `600 14px ${FONT}`; g.fillText(fmtPrice(c.last), 66, y)
    g.fillStyle = c.chg >= 0 ? '#4fd18b' : '#ef6b6b'; g.textAlign = 'right'; g.fillText(`${c.chg >= 0 ? '+' : ''}${c.chg.toFixed(2)}%`, 192, y); g.textAlign = 'left'
  })
  if (!coins.length) { g.fillStyle = '#7f93a6'; g.font = `500 14px ${FONT}`; g.fillText('Live prices load in a moment.', 20, 80) }
  // Bitcoin, 48 hours.
  const pts = news?.btc48 ?? []
  const X0 = 214, X1 = W - 16, Y0 = 52, Y1 = 214
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1
  for (let y = Y0; y <= Y1; y += 40) { g.beginPath(); g.moveTo(X0, y); g.lineTo(X1, y); g.stroke() }
  g.fillStyle = '#9fb3c6'; g.font = `600 12px ${FONT}`; g.fillText('BITCOIN · 48 HOURS', X0, Y0 - 12)
  if (pts.length > 2) {
    const lo = Math.min(...pts), hi = Math.max(...pts), up = pts[pts.length - 1]! >= pts[0]!
    const px = (i: number) => X0 + (i / (pts.length - 1)) * (X1 - X0), py = (v: number) => Y1 - ((v - lo) / Math.max(1e-9, hi - lo)) * (Y1 - Y0 - 8)
    const area = g.createLinearGradient(0, Y0, 0, Y1); area.addColorStop(0, up ? 'rgba(79,209,139,.35)' : 'rgba(239,107,107,.35)'); area.addColorStop(1, 'rgba(0,0,0,0)')
    g.beginPath(); pts.forEach((v, i) => (i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v)))); g.lineTo(X1, Y1); g.lineTo(X0, Y1); g.closePath(); g.fillStyle = area; g.fill()
    g.beginPath(); pts.forEach((v, i) => (i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v)))); g.strokeStyle = up ? '#4fd18b' : '#ef6b6b'; g.lineWidth = 2.4; g.stroke()
    g.fillStyle = '#9fb3c6'; g.font = `500 11px ${FONT}`; g.textAlign = 'right'; g.fillText(`H ${fmtPrice(hi)}`, X1, Y0 - 12); g.fillText(`L ${fmtPrice(lo)}`, X1, Y1 + 12); g.textAlign = 'left'
  }
  const heads = [...(news?.crypto ?? []), ...(news?.markets ?? [])].map((h) => `${h.t} (${h.src})`).join('     ·     ')
  strip(g, t, heads || 'Market and crypto headlines are on their way.     Practice trading in the game uses in-game money only.')
  if (tv.glow < 1) { g.fillStyle = `rgba(0,0,0,${1 - tv.glow})`; g.fillRect(0, 0, W, H) }
  tv.tex.needsUpdate = true
}

/** Crypto news / Market news: the latest real headlines, three to a page, with the source and how long ago. */
function paintHeadlines(tv: Tv, kind: 'crypto' | 'markets') {
  const g = tv.g, t = tv.t, news = liveNews()
  const list = news?.[kind] ?? []
  g.fillStyle = kind === 'crypto' ? '#0c0a1a' : '#0a1410'; g.fillRect(0, 0, W, H)
  g.fillStyle = kind === 'crypto' ? '#f7931a' : '#2bd47d'; g.fillRect(0, 0, W, 44)
  g.textBaseline = 'middle'; g.textAlign = 'left'
  g.fillStyle = '#0b0b0b'; g.font = `900 19px ${FONT}`; g.fillText(kind === 'crypto' ? 'CRYPTO NEWS' : 'MARKET NEWS', 16, 22)
  LIVE_DOT(g, W - 60, 22, t); g.fillStyle = '#0b0b0b'; g.font = `800 13px ${FONT}`; g.fillText('LIVE', W - 50, 22)
  const page = Math.floor(t / 9) % Math.max(1, Math.ceil(list.length / 3))
  const items = list.slice(page * 3, page * 3 + 3)
  items.forEach((h, i) => {
    const y = 66 + i * 64
    g.fillStyle = '#f5f5f5'; g.font = `800 19px ${FONT}`
    const lines = wrap(g, h.t, W - 32, 2)
    lines.forEach((l, k) => g.fillText(l, 16, y + k * 21))
    g.fillStyle = '#9aa6b2'; g.font = `600 13px ${FONT}`; g.fillText(`${h.src}${h.at ? ` · ${ago(h.at)}` : ''}`, 16, y + lines.length * 21 + 1)
  })
  if (!items.length) { g.fillStyle = '#9aa4ae'; g.font = `500 15px ${FONT}`; g.fillText(news ? 'No fresh headlines right now.' : 'Loading the latest headlines…', 16, 90) }
  strip(g, t, priceLine() || 'Live prices load in a moment.')
  if (tv.glow < 1) { g.fillStyle = `rgba(0,0,0,${1 - tv.glow})`; g.fillRect(0, 0, W, H) }
  tv.tex.needsUpdate = true
}

function paintProgram(tv: Tv) {
  const p = tv.program ?? 0
  if (p === 0) { paintMarkets(tv); return }
  if (p === 1 || p === 2) { paintHeadlines(tv, p === 1 ? 'crypto' : 'markets'); return }
  if (p === 3) { paint(tv); return }
  paintExtra(tv, p - 2)
}

/** The other channels: Nature (2), Raceway (3) and Music (4). */
function paintExtra(tv: Tv, p: number) {
  const g = tv.g, t = tv.t
  if (p === 2) {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f6b26b'); sky.addColorStop(0.55, '#f9d9a0'); sky.addColorStop(1, '#a7c98a')
    g.fillStyle = sky; g.fillRect(0, 0, W, H)
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(W * 0.7, 120 + Math.sin(t * 0.05) * 6, 30, 0, Math.PI * 2); g.fill()
    for (const [c, base, amp, f] of [['#7a9a6a', 190, 22, 0.012], ['#56794c', 214, 16, 0.02], ['#3d5a37', 240, 12, 0.03]] as const) {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, H)
      for (let x = 0; x <= W; x += 8) g.lineTo(x, base - Math.sin(x * f + t * 0.1) * amp)
      g.lineTo(W, H); g.fill()
    }
    g.strokeStyle = '#3a2e22'; g.lineWidth = 2
    for (let i = 0; i < 5; i++) { const bx = ((t * 30 + i * 70) % (W + 80)) - 40, by = 70 + i * 12 + Math.sin(t * 3 + i) * 4, w = 6 + Math.sin(t * 8 + i) * 3; g.beginPath(); g.moveTo(bx - 8, by - w / 2); g.quadraticCurveTo(bx - 3, by, bx, by); g.quadraticCurveTo(bx + 3, by, bx + 8, by - w / 2); g.stroke() }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H - 34, W, 34); g.fillStyle = '#fff'; g.font = `600 15px ${FONT}`; g.textBaseline = 'middle'; g.fillText('WILD DISTRICT · the savanna at dusk', 16, H - 17)
  } else if (p === 3) {
    g.fillStyle = '#2f6b2f'; g.fillRect(0, 0, W, H)
    g.strokeStyle = '#3b3f44'; g.lineWidth = 34; g.beginPath(); g.ellipse(W / 2, H / 2 + 6, 190, 90, 0, 0, Math.PI * 2); g.stroke()
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([10, 10]); g.beginPath(); g.ellipse(W / 2, H / 2 + 6, 190, 90, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
    const cars = ['#e8403a', '#3a7be8', '#f2c12e', '#e8e8e8']
    cars.forEach((c, i) => { const a = t * (0.9 - i * 0.07) + i * 0.5; g.fillStyle = c; g.beginPath(); g.arc(W / 2 + Math.cos(a) * 190, H / 2 + 6 + Math.sin(a) * 90, 7, 0, Math.PI * 2); g.fill() })
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, 34); g.fillStyle = '#fff'; g.font = `700 16px ${FONT}`; g.textBaseline = 'middle'; g.fillText(`GRIND RACEWAY · LAP ${1 + (Math.floor(t / 7) % 5)}/5`, 14, 17)
  } else {
    g.fillStyle = '#0d0716'; g.fillRect(0, 0, W, H)
    const n = 32
    for (let i = 0; i < n; i++) {
      const v = (Math.sin(t * 4 + i * 0.6) * 0.5 + 0.5) * (Math.sin(t * 1.3 + i * 0.25) * 0.4 + 0.6)
      const h = 30 + v * 170, x = 24 + i * ((W - 48) / n)
      const gr = g.createLinearGradient(0, H - 40 - h, 0, H - 40); gr.addColorStop(0, '#f05ad8'); gr.addColorStop(1, '#5a6cf0')
      g.fillStyle = gr; g.fillRect(x, H - 40 - h, (W - 48) / n - 3, h)
    }
    g.fillStyle = '#fff'; g.font = `700 16px ${FONT}`; g.textBaseline = 'middle'; g.fillText('♪ DISTRICT FM · late-night grooves', 20, 24)
  }
  if (tv.glow < 1) { g.fillStyle = `rgba(0,0,0,${1 - tv.glow})`; g.fillRect(0, 0, W, H) }
  tv.tex.needsUpdate = true
}

function blank(tv: Tv) {
  const g = tv.g
  g.fillStyle = '#07080a'; g.fillRect(0, 0, W, H)
  // Faint glass reflection so an off TV still reads as a screen.
  const r = g.createLinearGradient(0, 0, W, H)
  r.addColorStop(0, 'rgba(255,255,255,0.07)'); r.addColorStop(0.45, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, W, H)
  tv.tex.needsUpdate = true
}

/** A 16:9 screen plane (front faces +z). Add it to a group just in front of the TV body. */
export function createTvScreen(width: number): { mesh: THREE.Mesh; toggle: () => void } {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (H / W)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  const tv: Tv = { mesh, tex, g: c.getContext('2d')!, on: false, forced: false, acc: 0, t: 0, glow: 0, channel: tvs.length, sphere: new THREE.Sphere(new THREE.Vector3(), width) }
  blank(tv)
  tvs.push(tv)
  return { mesh, toggle: () => { tv.forced = !tv.on; tv.channel++; tv.acc = 1 } }
}

/** A wall plasma with a real power switch and channels (it never wakes by itself). */
export function createPlasma(width: number): { mesh: THREE.Mesh; power: (on?: boolean) => boolean; next: () => string; isOn: () => boolean; channel: () => string } {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (H / W)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  const tv: Tv = { mesh, tex, g: c.getContext('2d')!, on: false, forced: false, acc: 0, t: 0, glow: 0, channel: 0, sphere: new THREE.Sphere(new THREE.Vector3(), width), power: false, program: 0 }
  blank(tv)
  tvs.push(tv)
  return {
    mesh,
    power: (on) => { tv.power = on ?? !tv.power; tv.acc = 1; if (!tv.power) { tv.on = false; tv.glow = 0; blank(tv) } return tv.power },
    next: () => { tv.program = ((tv.program ?? 0) + 1) % PROGRAMS.length; tv.acc = 1; tv.glow = 0.4; return PROGRAMS[tv.program]! },
    isOn: () => !!tv.power,
    channel: () => PROGRAMS[tv.program ?? 0]!,
  }
}

/** Per frame from the render loop. Wakes TVs within 7 m that are visible; sleeps the rest. */
export function tickTvs(dt: number, x: number, z: number, camera: THREE.Camera) {
  if (!tvs.length) return
  let frustumReady = false
  if (tvs.some((x) => x.on || x.power)) ensureNews()
  for (const tv of tvs) {
    if (tv.power === false) continue
    if (!tv.mesh.parent || !tv.mesh.parent.visible) { if (tv.on) { tv.on = false; tv.forced = false; blank(tv) } continue }
    tv.mesh.getWorldPosition(tv.sphere.center)
    const near = Math.hypot(tv.sphere.center.x - x, tv.sphere.center.z - z) < (tv.power ? 16 : 7)
    if (!near) tv.forced = false
    let visible = false
    if (near || tv.forced) {
      if (!frustumReady) { m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(m4); frustumReady = true }
      visible = frustum.intersectsSphere(tv.sphere)
    }
    const want = (near || tv.forced) && visible
    if (!want) { if (tv.on && !near) { tv.on = false; tv.glow = 0; blank(tv) } continue }
    if (!tv.on) { tv.on = true; tv.glow = 0; tv.acc = 1 }
    tv.t += dt
    tv.acc += dt
    tv.glow = Math.min(1, tv.glow + dt * 2.5)
    if (tv.acc >= (tv.glow < 1 ? 0.05 : 0.16)) { tv.acc = 0; if (tv.power) paintProgram(tv); else paint(tv) }
  }
}
