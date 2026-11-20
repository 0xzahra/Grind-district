// The Grand Masjid. An octagonal prayer hall under a gilded dome: white marble below, cobalt and turquoise tile
// above, a lead roof ring and a tiled drum with arched windows. In front, a walled courtyard with arcades on two
// sides (alternating cream and rust voussoirs), an ablution fountain under a small gilded canopy, and a tall tiled
// gate on the street side between two minarets with balconies and crescent finials.
// Original geometry and hand-painted patterns (canvas, no photos). Everything is static and merges into one mesh
// per material, so the whole compound costs about ten draw calls.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Obstacle } from './physics.ts'

/** Compound bounds (world units), the hall centre and the hall door. */
export const MASJID = {
  x0: -26.2, x1: -13.4, z0: 19.2, z1: 46.4,
  cx: -19.8, hallZ: 39.6,
  /** Where the 'Go inside' spot sits, under the porch. */
  door: { x: -19.8, z: 32.7 },
  /** Outside the street gate (east wall), for the walkway to the road. */
  gate: { x: -12.2, z: 25.4 },
}

const R = 6.2 // hall circumradius
const AP = R * Math.cos(Math.PI / 8) // hall apothem (centre to a flat face)
const FACE_W = 2 * R * Math.sin(Math.PI / 8)
const WALL_H = 7.0

// ---------------------------------------------------------------- painting
const canvasOf = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  return c
}
const tex = (c: HTMLCanvasElement, aniso: number, repeat = true) => {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
const rand = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

/** A pointed (two-centred) arch outline from the left springing point up to the apex and down the right side. */
function archPath(g: CanvasRenderingContext2D, x: number, bottom: number, w: number, spring: number, apex: number) {
  const rise = spring - apex
  g.moveTo(x, bottom)
  g.lineTo(x, spring)
  g.bezierCurveTo(x, spring - rise * 0.62, x + w * 0.3, apex + rise * 0.1, x + w / 2, apex)
  g.bezierCurveTo(x + w * 0.7, apex + rise * 0.1, x + w, spring - rise * 0.62, x + w, spring)
  g.lineTo(x + w, bottom)
  g.closePath()
}

/** Eight-point star (two squares) centred at cx, cy with outer radius r. */
function star8(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath()
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.76
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
  }
  g.closePath()
}

/** Cobalt and turquoise tile field: eight-point stars with crosses between, white outlines, gold centres. */
function paintTiles(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, cell: number) {
  g.save()
  g.beginPath(); g.rect(x0, y0, w, h); g.clip()
  g.fillStyle = '#163f86'; g.fillRect(x0, y0, w, h)
  for (let y = y0 - cell; y < y0 + h + cell; y += cell) for (let x = x0 - cell; x < x0 + w + cell; x += cell) {
    const cx = x + cell / 2, cy = y + cell / 2
    // Cross between four stars (on the cell corner).
    g.fillStyle = '#0e2c63'
    g.fillRect(x - cell * 0.12, y - cell * 0.3, cell * 0.24, cell * 0.6)
    g.fillRect(x - cell * 0.3, y - cell * 0.12, cell * 0.6, cell * 0.24)
    star8(g, cx, cy, cell * 0.42)
    g.fillStyle = '#2aa3b5'; g.fill()
    g.lineWidth = Math.max(1, cell * 0.035); g.strokeStyle = '#f4f1e8'; g.stroke()
    star8(g, cx, cy, cell * 0.2)
    g.fillStyle = '#f4f1e8'; g.fill()
    g.beginPath(); g.arc(cx, cy, cell * 0.08, 0, Math.PI * 2); g.fillStyle = '#d9a73e'; g.fill()
  }
  g.restore()
}

/** A band of white interlace on cobalt (a frieze), between y0 and y0+h. */
function paintFrieze(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  g.fillStyle = '#10306c'; g.fillRect(x0, y0, w, h)
  g.strokeStyle = '#f4f1e8'; g.lineWidth = Math.max(1.5, h * 0.07)
  const step = h * 1.1
  for (let x = x0 - step; x < x0 + w + step; x += step) {
    g.beginPath(); g.ellipse(x + step / 2, y0 + h / 2, step * 0.42, h * 0.3, 0, 0, Math.PI * 2); g.stroke()
    g.beginPath(); g.moveTo(x, y0 + h * 0.2); g.lineTo(x + step / 2, y0 + h * 0.8); g.lineTo(x + step, y0 + h * 0.2); g.stroke()
  }
  g.fillStyle = '#d9a73e'; g.fillRect(x0, y0, w, Math.max(1, h * 0.06)); g.fillRect(x0, y0 + h - Math.max(1, h * 0.06), w, Math.max(1, h * 0.06))
}

/** Warm white marble with soft clouding and a few grey veins. Tiles seamlessly. */
function paintMarble(g: CanvasRenderingContext2D, s: number, seed: number, base = '#efe8da') {
  const r = rand(seed)
  g.fillStyle = base; g.fillRect(0, 0, s, s)
  for (let i = 0; i < 40; i++) {
    const x = r() * s, y = r() * s, rad = s * (0.08 + r() * 0.2)
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      const grd = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad)
      grd.addColorStop(0, r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(196,184,164,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2)
    }
  }
  g.lineCap = 'round'
  for (let i = 0; i < 7; i++) {
    let x = r() * s, y = r() * s
    const pts: Array<[number, number]> = [[x, y]]
    for (let k = 0; k < 6; k++) { x += (r() - 0.3) * s * 0.18; y += (r() - 0.5) * s * 0.14; pts.push([x, y]) }
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      g.beginPath(); g.moveTo(pts[0]![0] + ox, pts[0]![1] + oy)
      for (const [px, py] of pts.slice(1)) g.lineTo(px + ox, py + oy)
      g.strokeStyle = `rgba(120,112,100,${0.12 + r() * 0.12})`; g.lineWidth = 0.8 + r() * 1.4; g.stroke()
    }
  }
}

/** An arched window: white frame, gold line, deep blue glass with a white lattice. `lit` paints only the glow. */
function paintWindow(g: CanvasRenderingContext2D, x: number, bottom: number, w: number, spring: number, apex: number, lit: boolean) {
  if (lit) {
    g.save(); g.beginPath(); archPath(g, x, bottom, w, spring, apex); g.clip()
    const grd = g.createLinearGradient(0, apex, 0, bottom); grd.addColorStop(0, '#ffe7b0'); grd.addColorStop(1, '#ffb25e')
    g.fillStyle = grd; g.fillRect(x, apex, w, bottom - apex)
    g.strokeStyle = '#000'; g.lineWidth = w * 0.05
    for (let yy = apex; yy < bottom; yy += w * 0.32) for (let xx = x; xx < x + w; xx += w * 0.32) { g.beginPath(); g.arc(xx + w * 0.16, yy + w * 0.16, w * 0.13, 0, Math.PI * 2); g.stroke() }
    g.restore()
    return
  }
  const b = w * 0.1
  g.beginPath(); archPath(g, x - b, bottom + b * 0.4, w + b * 2, spring, apex - b); g.fillStyle = '#f4f1e8'; g.fill()
  g.beginPath(); archPath(g, x - b * 0.35, bottom + b * 0.2, w + b * 0.7, spring, apex - b * 0.35); g.fillStyle = '#d9a73e'; g.fill()
  g.save(); g.beginPath(); archPath(g, x, bottom, w, spring, apex); g.clip()
  const grd = g.createLinearGradient(0, apex, 0, bottom); grd.addColorStop(0, '#22406e'); grd.addColorStop(1, '#0d1a33')
  g.fillStyle = grd; g.fillRect(x, apex, w, bottom - apex)
  g.strokeStyle = 'rgba(244,241,232,0.85)'; g.lineWidth = Math.max(1, w * 0.035)
  for (let yy = apex; yy < bottom; yy += w * 0.32) for (let xx = x; xx < x + w; xx += w * 0.32) { g.beginPath(); g.arc(xx + w * 0.16, yy + w * 0.16, w * 0.13, 0, Math.PI * 2); g.stroke() }
  g.restore()
}

/** One face of the octagon (FACE_W x WALL_H): tiles and two windows above, a marble dado with panels below. */
function hallFace(lit: boolean) {
  return canvasOf(512, 768, (g) => {
    const W = 512, H = 768
    if (lit) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H) } else {
      paintFrieze(g, 0, 0, W, 44)
      paintTiles(g, 0, 46, W, 348, 64)
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 392, W, 10); g.fillStyle = '#d9a73e'; g.fillRect(0, 402, W, 4)
      // Marble dado: two book-matched panels round a blind arch.
      const m = canvasOf(256, 256, (mg) => paintMarble(mg, 256, 7))
      g.fillStyle = g.createPattern(m, 'repeat')!; g.fillRect(0, 406, W, H - 406)
      g.strokeStyle = 'rgba(150,138,118,0.55)'; g.lineWidth = 3
      g.strokeRect(34, 440, 120, 270); g.strokeRect(358, 440, 120, 270)
      g.beginPath(); archPath(g, 184, 712, 144, 520, 450); g.stroke()
      g.strokeStyle = 'rgba(217,167,62,0.8)'; g.lineWidth = 2
      g.beginPath(); archPath(g, 196, 712, 120, 528, 468); g.stroke()
      g.fillStyle = '#cfc5b2'; g.fillRect(0, H - 34, W, 34)
      // Corner pilaster strips.
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 44, 14, H - 44); g.fillRect(W - 14, 44, 14, H - 44)
      g.fillStyle = '#d9a73e'; g.fillRect(14, 44, 3, 362); g.fillRect(W - 17, 44, 3, 362)
    }
    paintWindow(g, 98, 330, 104, 160, 96, lit)
    paintWindow(g, 310, 330, 104, 160, 96, lit)
  })
}

/** The drum: tile with four arched windows per repeat (the texture repeats four times round). */
function drumFace(lit: boolean) {
  return canvasOf(512, 256, (g) => {
    if (lit) { g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256) } else {
      paintTiles(g, 0, 24, 512, 210, 52)
      paintFrieze(g, 0, 0, 512, 24)
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 232, 512, 24); g.fillStyle = '#d9a73e'; g.fillRect(0, 232, 512, 3)
    }
    for (let k = 0; k < 4; k++) paintWindow(g, 64 + k * 128 - 26, 212, 52, 96, 54, lit)
  })
}

/** The street gate and the hall doorway (4.6 x 7 m): tiled frame, niche cells above a tall pointed arch.
 * `open` leaves the arch transparent (the gate); otherwise it paints carved double doors (the hall door). */
function portalFace(open: boolean) {
  return canvasOf(512, 768, (g) => {
    const W = 512, H = 768
    paintTiles(g, 0, 0, W, H, 58)
    paintFrieze(g, 0, 0, W, 40)
    g.fillStyle = '#f4f1e8'
    g.fillRect(0, 40, 22, H); g.fillRect(W - 22, 40, 22, H)
    g.fillStyle = '#d9a73e'; g.fillRect(22, 40, 4, H); g.fillRect(W - 26, 40, 4, H)
    // Recessed niche: white band, then honey-comb niche cells (muqarnas) in the hood above the arch.
    const ax = 104, aw = 304, spring = 300, apex = 236
    g.beginPath(); archPath(g, ax - 34, H, aw + 68, spring - 10, 90); g.fillStyle = '#f4f1e8'; g.fill()
    g.beginPath(); archPath(g, ax - 24, H, aw + 48, spring - 6, 104); g.fillStyle = '#d9a73e'; g.fill()
    g.save(); g.beginPath(); archPath(g, ax - 18, H, aw + 36, spring - 4, 112); g.clip()
    g.fillStyle = '#0f2a5c'; g.fillRect(0, 100, W, H)
    for (let row = 0; row < 6; row++) {
      const y = 116 + row * 26, n = 4 + row * 2, cw = (aw + 36) / n
      for (let i = 0; i < n; i++) {
        const x = ax - 18 + i * cw
        g.beginPath(); archPath(g, x + 2, y + 24, cw - 4, y + 12, y); g.fillStyle = (i + row) % 2 ? '#f4f1e8' : '#2aa3b5'; g.fill()
        g.strokeStyle = '#d9a73e'; g.lineWidth = 1.5; g.stroke()
      }
    }
    g.restore()
    // Spandrel roundels.
    for (const x of [58, W - 58]) { g.beginPath(); g.arc(x, 150, 26, 0, Math.PI * 2); g.fillStyle = '#d9a73e'; g.fill(); star8(g, x, 150, 18); g.fillStyle = '#10306c'; g.fill() }
    // The arch itself.
    g.beginPath(); archPath(g, ax - 8, H, aw + 16, spring + 4, apex - 10); g.fillStyle = '#d9a73e'; g.fill()
    if (open) {
      g.save(); g.globalCompositeOperation = 'destination-out'
      g.beginPath(); archPath(g, ax, H + 2, aw, spring, apex); g.fill()
      g.restore()
    } else {
      g.save(); g.beginPath(); archPath(g, ax, H, aw, spring, apex); g.clip()
      g.fillStyle = '#4a2c18'; g.fillRect(ax, apex, aw, H - apex)
      // Lunette grille above the doors.
      g.fillStyle = '#0d1a33'; g.fillRect(ax, apex, aw, 120)
      g.strokeStyle = '#d9a73e'; g.lineWidth = 2
      for (let x = ax; x < ax + aw; x += 24) for (let y = apex; y < apex + 120; y += 24) { g.beginPath(); g.arc(x + 12, y + 12, 9, 0, Math.PI * 2); g.stroke() }
      // Two carved leaves with star panels and studs.
      for (const lx of [ax + 8, ax + aw / 2 + 4]) {
        const lw = aw / 2 - 12, top = apex + 128
        g.fillStyle = '#5c3720'; g.fillRect(lx, top, lw, H - top)
        g.strokeStyle = '#2e1a0c'; g.lineWidth = 3; g.strokeRect(lx + 10, top + 12, lw - 20, H - top - 24)
        for (let y = top + 70; y < H - 40; y += 110) { star8(g, lx + lw / 2, y, 34); g.fillStyle = '#7a4c2c'; g.fill(); g.strokeStyle = '#d9a73e'; g.lineWidth = 2; g.stroke() }
        g.fillStyle = '#d9a73e'
        for (let y = top + 24; y < H - 20; y += 30) { g.beginPath(); g.arc(lx + 18, y, 3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(lx + lw - 18, y, 3, 0, Math.PI * 2); g.fill() }
      }
      g.fillStyle = '#d9a73e'; g.fillRect(ax + aw / 2 - 3, apex + 128, 6, H - apex - 128)
      g.restore()
    }
  })
}

/** One arcade bay (2.4 x 3.3 m): marble piers, rust and cream voussoirs, tiled spandrels; the arch is open. */
function arcadeBay() {
  return canvasOf(256, 352, (g) => {
    const W = 256, H = 352
    const m = canvasOf(128, 128, (mg) => paintMarble(mg, 128, 11))
    g.fillStyle = g.createPattern(m, 'repeat')!; g.fillRect(0, 0, W, H)
    paintTiles(g, 0, 40, W, 120, 40)
    paintFrieze(g, 0, 0, W, 34)
    g.fillStyle = '#d9a73e'; g.fillRect(0, 34, W, 4)
    const ax = 30, aw = W - 60, spring = 168, apex = 66
    // Voussoirs: alternate cream and rust round the arch.
    g.save(); g.beginPath(); archPath(g, ax - 18, H, aw + 36, spring, apex - 18); g.clip()
    const cx = W / 2, cy = spring + 10
    for (let i = 0; i < 18; i++) {
      const a0 = Math.PI + (i / 18) * Math.PI, a1 = Math.PI + ((i + 1) / 18) * Math.PI
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 260, a0, a1); g.closePath()
      g.fillStyle = i % 2 ? '#b5542f' : '#f1e6cf'; g.fill()
    }
    g.fillStyle = '#f1e6cf'; g.fillRect(0, spring, W, H - spring)
    g.restore()
    // Piers below the springing line.
    g.fillStyle = g.createPattern(m, 'repeat')!; g.fillRect(0, spring, ax, H - spring); g.fillRect(W - ax, spring, ax, H - spring)
    g.fillStyle = '#d9a73e'; g.fillRect(0, spring - 4, ax, 6); g.fillRect(W - ax, spring - 4, ax, 6)
    g.save(); g.globalCompositeOperation = 'destination-out'
    g.beginPath(); archPath(g, ax, H + 2, aw, spring, apex); g.fill()
    g.restore()
  })
}

/** Courtyard paving: white and dove-grey squares with dark diamond inlays at the corners (one 4 m repeat). */
function floorTiles() {
  return canvasOf(512, 512, (g) => {
    const m = canvasOf(128, 128, (mg) => paintMarble(mg, 128, 3, '#ece6da'))
    const d = canvasOf(128, 128, (mg) => paintMarble(mg, 128, 5, '#d6d0c4'))
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.save(); g.translate(i * 128, j * 128); g.fillStyle = g.createPattern((i + j) % 2 ? d : m, 'repeat')!; g.fillRect(0, 0, 128, 128); g.restore()
    }
    g.strokeStyle = 'rgba(110,100,86,0.5)'; g.lineWidth = 2
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, k * 128); g.lineTo(512, k * 128); g.stroke() }
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
      const x = i * 128, y = j * 128
      g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 18, y); g.lineTo(x, y + 18); g.lineTo(x - 18, y); g.closePath()
      g.fillStyle = '#3c4654'; g.fill(); g.strokeStyle = '#d9a73e'; g.lineWidth = 1.5; g.stroke()
    }
  })
}

// ---------------------------------------------------------------- geometry
/** World-projected UVs (like the city's box projection, but on placed geometry) at `scale` repeats per metre. */
function projUV(geo: THREE.BufferGeometry, scale: number) {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i))
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const [u, v] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y]
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geo
}

const DOME: Array<[number, number]> = [[3.98, 0], [4.08, 0.45], [4.06, 1.0], [3.88, 1.65], [3.5, 2.35], [2.95, 3.0], [2.25, 3.6], [1.45, 4.1], [0.7, 4.45], [0.2, 4.62], [0, 4.66]]
const ONION: Array<[number, number]> = [[0.48, 0], [0.55, 0.25], [0.5, 0.55], [0.36, 0.85], [0.18, 1.15], [0.05, 1.35], [0, 1.42]]

export type GrandMosque = { group: THREE.Group; obstacles: Obstacle[]; setNight: (k: number) => void }

export function buildGrandMosque(anisotropy: number): GrandMosque {
  const { x0, x1, z0, cx, hallZ } = MASJID
  const parts = new Map<string, THREE.BufferGeometry[]>()
  const put = (key: string, geo: THREE.BufferGeometry) => { const l = parts.get(key) ?? []; l.push(geo); parts.set(key, l) }
  const TILED: Record<string, number> = { marble: 0.5, tile: 1.1, floor: 0.25 }
  const place = (key: string, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => {
    if (ry) geo.rotateY(ry)
    geo.translate(x, y, z)
    if (key in TILED) projUV(geo, TILED[key]!)
    put(key, geo)
    return geo
  }
  const box = (key: string, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => place(key, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry)
  const cyl = (key: string, rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, open = false, start = 0) =>
    place(key, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, start), x, y + h / 2, z)
  const lathe = (key: string, prof: Array<[number, number]>, s: number, x: number, y: number, z: number, seg = 32) =>
    place(key, new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r * s, h * s)), seg), x, y, z)
  const crescent = (x: number, y: number, z: number, r: number, ry: number) => {
    const t = new THREE.TorusGeometry(r, r * 0.16, 6, 20, Math.PI * 1.45)
    t.rotateZ(2.43); t.rotateY(ry)
    place('gold', t, x, y, z)
  }
  const obstacles: Obstacle[] = []
  const OCT = Math.PI / 8

  // ---- Courtyard paving over the whole compound.
  { const f = new THREE.PlaneGeometry(x1 - x0, MASJID.z1 - z0); f.rotateX(-Math.PI / 2); place('floor', f, cx, 0.03, (z0 + MASJID.z1) / 2) }

  // ---- Courtyard walls (3.6 m) with stepped merlons; the street gate is in the east wall.
  const CZ1 = 31.6 // courtyard south edge
  const WH = 3.6
  const merlons = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 0.8)
    for (let i = 0; i <= n; i++) {
      const t = (i + 0.5) / (n + 1), x = ax + (bx - ax) * t, z = az + (bz - az) * t
      const ry = Math.atan2(bx - ax, bz - az)
      box('marble', 0.42, 0.34, 0.3, x, WH, z, ry)
      box('marble', 0.22, 0.2, 0.3, x, WH + 0.34, z, ry)
    }
  }
  const wall = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az)
    box('marble', 0.4, WH, len, (ax + bx) / 2, 0, (az + bz) / 2, ry)
    box('tile', 0.44, 0.45, len, (ax + bx) / 2, WH - 0.7, (az + bz) / 2, ry)
    merlons(ax, az, bx, bz)
  }
  wall(x0 + 0.2, z0 + 0.2, x1 - 0.2, z0 + 0.2) // north
  wall(x0 + 0.2, z0 + 0.2, x0 + 0.2, CZ1) // west
  const EX = x1 - 0.2
  wall(EX, z0 + 0.2, EX, 24.1) // east, north of the gate
  wall(EX, 26.7, EX, CZ1) // east, south of the gate
  obstacles.push({ kind: 'box', x: cx, z: z0 + 0.2, hx: (x1 - x0) / 2, hz: 0.3 })
  obstacles.push({ kind: 'box', x: x0 + 0.2, z: (z0 + CZ1) / 2, hx: 0.3, hz: (CZ1 - z0) / 2 })
  obstacles.push({ kind: 'box', x: EX, z: (z0 + 24.1) / 2, hx: 0.4, hz: (24.1 - z0) / 2 })
  obstacles.push({ kind: 'box', x: EX, z: (26.7 + CZ1) / 2, hx: 0.4, hz: (CZ1 - 26.7) / 2 })

  // ---- Street gate: tall tiled portal round an open pointed arch (alpha), piers and a hood.
  {
    const GZ = 25.4, GW = 4.6, GH = 7.0
    box('marble', 0.9, GH, 1.0, EX, 0, GZ - GW / 2 + 0.5)
    box('marble', 0.9, GH, 1.0, EX, 0, GZ + GW / 2 - 0.5)
    box('marble', 0.9, 2.1, GW, EX, 4.9, GZ)
    box('tile', 1.0, 0.35, GW + 0.2, EX, GH, GZ)
    for (let i = 0; i < 7; i++) box('marble', 0.5, 0.3, 0.32, EX, GH + 0.35, GZ - GW / 2 + 0.35 + i * (GW - 0.7) / 6)
    for (const side of [1, -1]) {
      const p = new THREE.PlaneGeometry(GW, GH)
      p.rotateY(side * Math.PI / 2)
      place('gate', p, EX + side * 0.46, GH / 2, GZ)
    }
  }

  // ---- Arcades: north and west sides of the courtyard.
  {
    const AH = 3.3
    const arcade = (len: number, bays: number, x: number, z: number, ry: number) => {
      const p = new THREE.PlaneGeometry(len, AH)
      const uv = p.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * bays)
      place('arcade', p, x, AH / 2, z, ry)
    }
    // North: front at z 21.6, facing south.
    const nx0 = x0 + 0.4, nx1 = x1 - 0.45, nLen = nx1 - nx0
    arcade(nLen, 5, (nx0 + nx1) / 2, 21.6, 0)
    box('marble', nLen, 0.32, 2.2, (nx0 + nx1) / 2, AH, 20.55)
    box('tile', nLen, 0.3, 0.06, (nx0 + nx1) / 2, AH, 21.66)
    for (let i = 0; i <= 5; i++) {
      const x = nx0 + (nLen * i) / 5
      cyl('marble', 0.13, 0.15, AH - 0.5, 12, x, 0, 21.78)
      box('gold', 0.34, 0.22, 0.34, x, AH - 0.5, 21.78)
      obstacles.push({ kind: 'circle', x, z: 21.78, r: 0.22 })
    }
    // West: front at x -23.8, facing east.
    const wz0 = 21.6, wz1 = CZ1, wLen = wz1 - wz0, wx = x0 + 2.4
    arcade(wLen, 4, wx, (wz0 + wz1) / 2, Math.PI / 2)
    box('marble', 2.2, 0.32, wLen, x0 + 1.35, AH, (wz0 + wz1) / 2)
    box('tile', 0.06, 0.3, wLen, wx + 0.06, AH, (wz0 + wz1) / 2)
    for (let i = 1; i <= 4; i++) {
      const z = wz0 + (wLen * i) / 4
      cyl('marble', 0.13, 0.15, AH - 0.5, 12, wx + 0.18, 0, z)
      box('gold', 0.34, 0.22, 0.34, wx + 0.18, AH - 0.5, z)
      obstacles.push({ kind: 'circle', x: wx + 0.18, z, r: 0.22 })
    }
  }

  // ---- Ablution fountain under a small gilded canopy.
  {
    const FX = -19.4, FZ = 25.9
    cyl('marble', 1.35, 1.45, 0.55, 8, FX, 0, FZ, false, OCT)
    cyl('water', 1.2, 1.2, 0.04, 24, FX, 0.48, FZ)
    cyl('marble', 0.12, 0.2, 0.7, 12, FX, 0.5, FZ)
    cyl('marble', 0.45, 0.15, 0.2, 16, FX, 1.2, FZ)
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + OCT; cyl('marble', 0.07, 0.08, 2.6, 8, FX + Math.sin(a) * 1.52, 0, FZ + Math.cos(a) * 1.52) }
    cyl('tile', 1.68, 1.68, 0.36, 8, FX, 2.6, FZ, false, OCT)
    cyl('marble', 1.76, 1.76, 0.12, 8, FX, 2.96, FZ, false, OCT)
    lathe('gold', DOME, 0.37, FX, 3.08, FZ, 24)
    cyl('gold', 0.02, 0.05, 0.6, 6, FX, 4.8, FZ)
    crescent(FX, 5.55, FZ, 0.14, Math.PI / 2)
    obstacles.push({ kind: 'circle', x: FX, z: FZ, r: 1.7 })
  }

  // ---- Minarets at the two street corners of the courtyard.
  const minaret = (mx: number, mz: number) => {
    box('marble', 1.7, 3.9, 1.7, mx, 0, mz)
    box('tile', 1.76, 0.45, 1.76, mx, 3.15, mz)
    cyl('marble', 0.62, 0.72, 7.6, 8, mx, 3.9, mz, false, OCT)
    cyl('tile', 0.67, 0.67, 0.75, 8, mx, 9.4, mz, false, OCT)
    cyl('marble', 1.06, 0.62, 0.55, 16, mx, 11.5, mz)
    cyl('marble', 1.09, 1.09, 0.14, 16, mx, 12.05, mz)
    const rail = new THREE.TorusGeometry(1.03, 0.035, 6, 28); rail.rotateX(Math.PI / 2); place('gold', rail, mx, 12.68, mz)
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; cyl('gold', 0.025, 0.025, 0.5, 4, mx + Math.sin(a) * 1.03, 12.19, mz + Math.cos(a) * 1.03) }
    cyl('tile', 0.48, 0.54, 3.4, 8, mx, 12.19, mz, false, OCT)
    cyl('marble', 0.76, 0.48, 0.36, 16, mx, 15.59, mz)
    const ring = new THREE.TorusGeometry(0.73, 0.03, 6, 24); ring.rotateX(Math.PI / 2); place('gold', ring, mx, 16.2, mz)
    cyl('marble', 0.4, 0.4, 1.5, 8, mx, 15.95, mz, false, OCT)
    lathe('gold', ONION, 1, mx, 17.45, mz, 20)
    cyl('gold', 0.015, 0.03, 0.75, 6, mx, 18.85, mz)
    place('gold', new THREE.SphereGeometry(0.09, 10, 8), mx, 19.1, mz)
    crescent(mx, 19.85, mz, 0.18, Math.PI / 2)
    obstacles.push({ kind: 'circle', x: mx, z: mz, r: 1.0 })
  }
  minaret(x1 - 0.55, z0 + 0.6)
  minaret(x1 - 0.55, CZ1 - 0.4)

  // ---- The prayer hall: octagon on a two-step plinth, tiled parapet, lead roof ring, drum, golden dome.
  {
    const HX = cx, HZ = hallZ
    cyl('marble', R + 0.6, R + 0.62, 0.2, 8, HX, 0, HZ, false, OCT)
    cyl('marble', R + 0.3, R + 0.32, 0.25, 8, HX, 0.2, HZ, false, OCT)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const p = new THREE.PlaneGeometry(FACE_W, WALL_H)
      p.rotateY(a)
      place('hall', p, HX + Math.sin(a) * AP, 0.45 + WALL_H / 2, HZ + Math.cos(a) * AP)
      const v = a + OCT
      box('marble', 0.32, WALL_H, 0.32, HX + Math.sin(v) * (R - 0.02), 0.45, HZ + Math.cos(v) * (R - 0.02), v)
    }
    const top = 0.45 + WALL_H
    cyl('tile', R + 0.1, R + 0.1, 0.42, 8, HX, top, HZ, false, OCT)
    cyl('marble', R + 0.18, R + 0.18, 0.12, 8, HX, top + 0.42, HZ, false, OCT)
    cyl('roof', 3.95, R + 0.05, 1.0, 8, HX, top + 0.54, HZ, false, OCT)
    const drumY = top + 1.54
    const drum = new THREE.CylinderGeometry(3.75, 3.75, 2.6, 40, 1, true)
    { const uv = drum.getAttribute('uv') as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 4) }
    place('drum', drum, HX, drumY + 1.3, HZ)
    cyl('marble', 3.99, 3.99, 0.22, 40, HX, drumY + 2.6, HZ)
    const domeY = drumY + 2.82
    lathe('gold', DOME, 1, HX, domeY, HZ, 40)
    const peak = domeY + 4.62
    cyl('gold', 0.05, 0.09, 0.5, 8, HX, peak, HZ)
    place('gold', new THREE.SphereGeometry(0.17, 12, 10), HX, peak + 0.62, HZ)
    place('gold', new THREE.SphereGeometry(0.11, 10, 8), HX, peak + 0.92, HZ)
    cyl('gold', 0.02, 0.04, 0.55, 6, HX, peak + 1.02, HZ)
    crescent(HX, peak + 1.95, HZ, 0.32, Math.PI / 2)
    obstacles.push({ kind: 'circle', x: HX, z: HZ, r: AP + 0.35 })

    // Entrance porch on the north face: the carved doorway, four columns and a tiled cornice.
    const FZ = HZ - AP
    const d = new THREE.PlaneGeometry(3.6, 5.3); d.rotateY(Math.PI); place('door', d, HX, 0.45 + 2.65, FZ - 0.03)
    const PZ = FZ - 1.75
    for (const dx of [-2.6, -1.15, 1.15, 2.6]) {
      box('marble', 0.5, 0.3, 0.5, HX + dx, 0.2, PZ)
      cyl('marble', 0.17, 0.2, 5.05, 14, HX + dx, 0.5, PZ)
      box('gold', 0.46, 0.28, 0.46, HX + dx, 5.55, PZ)
      obstacles.push({ kind: 'circle', x: HX + dx, z: PZ, r: 0.28 })
    }
    box('marble', 6.4, 0.38, 2.15, HX, 5.83, FZ - 1.0)
    box('tile', 6.44, 0.32, 0.06, HX, 5.86, FZ - 2.09)
    for (let i = 0; i < 9; i++) box('marble', 0.4, 0.28, 0.3, HX - 3.0 + i * 0.75, 6.21, FZ - 1.95)
  }

  // ---- Materials, then one mesh per material.
  const marbleTex = tex(canvasOf(512, 512, (g) => paintMarble(g, 512, 21)), anisotropy)
  const tileTex = tex(canvasOf(512, 512, (g) => paintTiles(g, 0, 0, 512, 512, 128)), anisotropy)
  const floorTex = tex(floorTiles(), anisotropy)
  const hallTex = tex(hallFace(false), anisotropy, false)
  const hallGlow = tex(hallFace(true), anisotropy, false)
  const drumTex = tex(drumFace(false), anisotropy); drumTex.wrapT = THREE.ClampToEdgeWrapping
  const drumGlow = tex(drumFace(true), anisotropy); drumGlow.wrapT = THREE.ClampToEdgeWrapping
  const arcadeTex = tex(arcadeBay(), anisotropy); arcadeTex.wrapT = THREE.ClampToEdgeWrapping
  const hallMat = new THREE.MeshStandardMaterial({ map: hallTex, emissiveMap: hallGlow, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.62 })
  const drumMat = new THREE.MeshStandardMaterial({ map: drumTex, emissiveMap: drumGlow, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.55, side: THREE.DoubleSide })
  const mats: Record<string, THREE.Material> = {
    marble: new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.5 }),
    tile: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.35, metalness: 0.05 }),
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42 }),
    hall: hallMat,
    drum: drumMat,
    door: new THREE.MeshStandardMaterial({ map: tex(portalFace(false), anisotropy, false), roughness: 0.55 }),
    gate: new THREE.MeshStandardMaterial({ map: tex(portalFace(true), anisotropy, false), roughness: 0.5, alphaTest: 0.5 }),
    arcade: new THREE.MeshStandardMaterial({ map: arcadeTex, roughness: 0.55, alphaTest: 0.5, side: THREE.DoubleSide }),
    gold: new THREE.MeshStandardMaterial({ color: 0xe2b24c, metalness: 1, roughness: 0.26, emissive: 0x5a3a08, emissiveIntensity: 0.35 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x7d8a92, roughness: 0.55, metalness: 0.35 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2f8fa0, roughness: 0.08, metalness: 0.3 }),
  }
  const group = new THREE.Group()
  group.name = 'grand-masjid'
  for (const [key, list] of parts) {
    const mat = mats[key]!
    const keepUv = !!(mat as THREE.MeshStandardMaterial).map
    const geos = list.map((g0) => {
      const g = g0.index ? g0.toNonIndexed() : g0
      for (const k of Object.keys(g.attributes)) if (!(k === 'position' || k === 'normal' || (keepUv && k === 'uv'))) g.deleteAttribute(k)
      g.clearGroups()
      return g
    })
    const merged = mergeGeometries(geos)
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, mat)
    mesh.name = `masjid-${key}`
    mesh.castShadow = key !== 'floor' && key !== 'water'
    mesh.receiveShadow = true
    if (key === 'floor') { mesh.userData.ghost = true; mesh.raycast = () => undefined }
    group.add(mesh)
  }
  return {
    group,
    obstacles,
    setNight(k: number) {
      hallMat.emissiveIntensity = 1.6 * k
      drumMat.emissiveIntensity = 1.4 * k
    },
  }
}
