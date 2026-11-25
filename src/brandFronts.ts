// Street fronts for two places behind a door: McGrind (the city's own burger, fries, shawarma and boba restaurant,
// in the game's green; an original name and mark, no borrowed fast-food branding) and the Grind Market gate.
// A big lit sign over the door, an awning and a few details, merged per material so each front is a few draws.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const MCGRIND_GREEN = '#0f7a48'
export const MCGRIND_BRIGHT = '#17f790'

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/** The McGrind mark: a rounded green tile with a bun-and-patty "G" (original). */
export function drawMcGrindMark(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save(); g.translate(x, y)
  g.fillStyle = MCGRIND_GREEN; g.beginPath(); g.roundRect(0, 0, s, s, s * 0.22); g.fill()
  g.strokeStyle = MCGRIND_BRIGHT; g.lineWidth = s * 0.05; g.stroke()
  // Bun top, patty, bun bottom, stacked as a G opening to the right.
  const cx = s / 2, cy = s / 2, r = s * 0.3
  g.lineCap = 'round'
  g.strokeStyle = '#ffe3a3'; g.lineWidth = s * 0.11; g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.25, Math.PI * 1.75, false); g.stroke()
  g.strokeStyle = '#6b3a1f'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(cx + r * 0.05, cy + s * 0.02); g.lineTo(cx + r * 1.02, cy + s * 0.02); g.stroke()
  g.fillStyle = MCGRIND_BRIGHT; g.beginPath(); g.arc(cx + r * 1.02, cy + s * 0.02, s * 0.05, 0, Math.PI * 2); g.fill()
  g.restore()
}

type Part = { geo: THREE.BufferGeometry; mat: THREE.Material }
function merged(parts: Part[]): THREE.Group {
  const g = new THREE.Group()
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const p of parts) { const l = by.get(p.mat) ?? []; l.push(p.geo); by.set(p.mat, l) }
  for (const [mat, geos] of by) {
    const m = new THREE.Mesh(mergeGeometries(geos.map((q) => (q.index ? q.toNonIndexed() : q)), false)!, mat)
    m.castShadow = true; m.receiveShadow = true
    m.userData.ghost = true; m.raycast = () => undefined
    g.add(m)
  }
  return g
}

/** McGrind front: the face of a w x d building at (x, z) with its door on the +z side. */
export function mcgrindFront(x: number, z: number, w: number, d: number, h: number): THREE.Group {
  const sign = tex(1024, 256, (g) => {
    g.fillStyle = MCGRIND_GREEN; g.fillRect(0, 0, 1024, 256)
    g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 1024; i += 24) g.fillRect(i, 0, 12, 256)
    drawMcGrindMark(g, 28, 28, 200)
    g.fillStyle = '#ffffff'; g.font = '900 150px "Archivo Black", "Inter Variable", Inter, system-ui, sans-serif'; g.textBaseline = 'middle'
    g.fillText('McGrind', 258, 120, 720)
    g.fillStyle = MCGRIND_BRIGHT; g.font = '700 36px "Inter Variable", Inter, system-ui, sans-serif'
    g.fillText('BURGERS · FRIES · SHAWARMA · BOBA · OPEN DAY & NIGHT', 262, 214, 740)
  })
  const signMat = new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.5 })
  const green = new THREE.MeshStandardMaterial({ color: 0x0f7a48, roughness: 0.55 })
  const bright = new THREE.MeshStandardMaterial({ color: 0x17f790, emissive: 0x17f790, emissiveIntensity: 0.35, roughness: 0.4 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 0.7 })
  const face = z + d / 2
  const parts: Part[] = []
  const box = (bw: number, bh: number, bd: number, px: number, py: number, pz: number, mat: THREE.Material) => parts.push({ geo: new THREE.BoxGeometry(bw, bh, bd).translate(px, py, pz), mat })
  // Sign band across the front, a striped awning over the door and green pilasters at the corners.
  const sw = Math.min(w - 0.6, 6.4), sh = sw / 4
  parts.push({ geo: new THREE.PlaneGeometry(sw, sh).translate(x, h - 0.15 - sh / 2, face + 0.08), mat: signMat })
  box(w + 0.2, 0.18, 0.3, x, h + 0.15, face + 0.02, green)
  box(w - 0.4, 0.08, 1.7, x, 2.75, face + 0.85, green)
  for (let i = 0; i < 7; i++) box((w - 0.4) / 14, 0.1, 1.72, x - (w - 0.4) / 2 + ((i * 2 + 0.5) * (w - 0.4)) / 14, 2.79, face + 0.85, cream)
  box(w - 0.4, 0.05, 0.05, x, 2.72, face + 1.7, bright)
  for (const sx of [-1, 1]) box(0.35, h, 0.35, x + sx * (w / 2 - 0.05), h / 2, face + 0.05, green)
  // A standing mark on the roof that can be seen from the Campus road.
  const mark = tex(256, 256, (g) => drawMcGrindMark(g, 8, 8, 240))
  const markMat = new THREE.MeshStandardMaterial({ map: mark, emissiveMap: mark, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.5, side: THREE.DoubleSide })
  parts.push({ geo: new THREE.PlaneGeometry(1.8, 1.8).translate(x + w / 2 - 1.2, h + 1.25, face - 0.6), mat: markMat })
  box(0.08, 0.6, 0.08, x + w / 2 - 1.2, h + 0.3, face - 0.6, green)
  return merged(parts)
}

/** Grind Market gate: a tall arch sign over the door of a w x d building at (x, z), door on the +z side. */
export function marketFront(x: number, z: number, w: number, d: number, h: number): THREE.Group {
  const sign = tex(1024, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 1024, 0); grad.addColorStop(0, '#7a2f1c'); grad.addColorStop(1, '#a8471f'); g.fillStyle = grad; g.fillRect(0, 0, 1024, 256)
    g.strokeStyle = '#f2c46a'; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 236)
    g.fillStyle = '#fff6e2'; g.font = '900 120px "Archivo Black", "Inter Variable", Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText('GRIND MARKET', 512, 112, 960)
    g.fillStyle = '#f2c46a'; g.font = '700 34px "Inter Variable", Inter, system-ui, sans-serif'
    g.fillText('RENT A STALL · SELL TO THE CITY · BUY FROM PLAYERS', 512, 208, 960)
  })
  const signMat = new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.55 })
  const timber = new THREE.MeshStandardMaterial({ color: 0x6b3f24, roughness: 0.8 })
  const face = z + d / 2
  const parts: Part[] = []
  parts.push({ geo: new THREE.PlaneGeometry(w + 0.4, (w + 0.4) / 4).translate(x, h + 0.9, face + 0.6), mat: signMat })
  for (const sx of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.3, h + 2, 0.3).translate(x + sx * (w / 2 + 0.1), (h + 2) / 2, face + 0.6), mat: timber })
  // Strings of little awnings in market colours along the front.
  const cols = [0xd9534f, 0xf0c419, 0x2f7a58, 0x3a5f8a, 0xe07a2f]
  cols.forEach((c, i) => parts.push({ geo: new THREE.BoxGeometry(w / cols.length - 0.1, 0.06, 1.1).translate(x - w / 2 + (i + 0.5) * (w / cols.length), 2.6, face + 0.55), mat: new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }) }))
  return merged(parts)
}
