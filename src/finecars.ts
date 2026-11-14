// Dealership cars: smooth, lofted bodies instead of an extruded side profile.
// Each car is described by a few curves (the bonnet-to-boot line, the roof line, the plan taper) and built as a
// surface of cross-sections along its length, so panels curve in both directions, the wings rise over the wheels
// and the wheel arches are real openings with the wheels sitting inside them. Clear-coat paint, dark glass, spoked
// alloys with brake discs, lamps, grilles, mirrors and exhausts.
// The designs are original: an executive saloon, a sport saloon, a grand tourer, an electric coupé, a mid-engined
// supercar and a hypercar, in the manner of the great marques but with no real badge, name or exact shape.
// Used for the showroom and shop photographs only (street traffic keeps the light kit in cars.ts).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Pt = [number, number]
type Style = 'saloon' | 'executive' | 'sport' | 'gt' | 'ev' | 'super' | 'hyper'
type Spec = {
  L: number; W: number; clr: number; r: number; fo: number; ro: number
  /** Body top line (boot, belt, bonnet): [fraction of length from the rear, height]. */
  deck: Pt[]
  /** Cabin: from/to along the length, and the roof line between them. */
  cab: [number, number]; roof: Pt[]
  taper: number; paint: number; style: Style; accent?: number; rim?: number
}

/** A smooth curve through points with rising x (Catmull-Rom on y). */
function curve(pts: Pt[]): (x: number) => number {
  return (x) => {
    const n = pts.length
    if (x <= pts[0]![0]) return pts[0]![1]
    if (x >= pts[n - 1]![0]) return pts[n - 1]![1]
    let i = 0
    while (i < n - 2 && x > pts[i + 1]![0]) i++
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(n - 1, i + 2)]!
    const w = p2[0] - p1[0], u = (x - p1[0]) / w, u2 = u * u, u3 = u2 * u
    const m1 = p2[0] === p0[0] ? 0 : ((p2[1] - p0[1]) / (p2[0] - p0[0])) * w
    const m2 = p3[0] === p1[0] ? 0 : ((p3[1] - p1[1]) / (p3[0] - p1[0])) * w
    return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2
  }
}

const SPECS: Record<string, Spec> = {
  saloon: {
    L: 4.7, W: 1.82, clr: 0.16, r: 0.33, fo: 0.92, ro: 1.02, taper: 0.2, paint: 0x3c4046, style: 'saloon',
    deck: [[0, 0.8], [0.03, 0.93], [0.18, 0.98], [0.3, 0.99], [0.7, 0.97], [0.82, 0.9], [0.94, 0.8], [0.985, 0.72], [1, 0.62]],
    cab: [0.2, 0.75], roof: [[0.3, 1.34], [0.42, 1.44], [0.55, 1.43], [0.65, 1.3]],
  },
  executive: {
    L: 5.2, W: 1.93, clr: 0.16, r: 0.36, fo: 0.95, ro: 1.15, taper: 0.17, paint: 0xc9ced3, style: 'executive',
    deck: [[0, 0.84], [0.03, 0.97], [0.18, 1.03], [0.3, 1.04], [0.68, 1.03], [0.8, 0.99], [0.94, 0.94], [0.985, 0.88], [1, 0.76]],
    cab: [0.2, 0.71], roof: [[0.3, 1.4], [0.42, 1.5], [0.54, 1.49], [0.62, 1.37]],
  },
  sportsaloon: {
    L: 4.76, W: 1.89, clr: 0.13, r: 0.36, fo: 0.9, ro: 1.0, taper: 0.2, paint: 0x1c3f96, style: 'sport', accent: 0xd9261c,
    deck: [[0, 0.8], [0.03, 0.94], [0.16, 0.99], [0.3, 0.98], [0.7, 0.95], [0.82, 0.87], [0.94, 0.76], [0.985, 0.68], [1, 0.56]],
    cab: [0.2, 0.73], roof: [[0.3, 1.32], [0.42, 1.4], [0.54, 1.39], [0.64, 1.26]],
  },
  tourer: {
    L: 4.62, W: 1.9, clr: 0.13, r: 0.35, fo: 0.95, ro: 0.92, taper: 0.22, paint: 0x7a1420, style: 'gt',
    deck: [[0, 0.76], [0.03, 0.88], [0.14, 0.93], [0.26, 0.94], [0.6, 0.92], [0.78, 0.86], [0.92, 0.74], [0.985, 0.64], [1, 0.54]],
    cab: [0.14, 0.62], roof: [[0.26, 1.12], [0.4, 1.29], [0.5, 1.27], [0.57, 1.12]],
  },
  evcoupe: {
    L: 4.7, W: 1.9, clr: 0.14, r: 0.36, fo: 0.88, ro: 0.92, taper: 0.22, paint: 0xe9eef2, style: 'ev', accent: 0x9ff3e0,
    deck: [[0, 0.82], [0.03, 0.95], [0.12, 0.99], [0.3, 0.98], [0.72, 0.94], [0.84, 0.86], [0.95, 0.74], [0.985, 0.66], [1, 0.56]],
    cab: [0.1, 0.78], roof: [[0.24, 1.22], [0.42, 1.42], [0.56, 1.41], [0.68, 1.24]],
  },
  supercar: {
    L: 4.56, W: 1.98, clr: 0.11, r: 0.36, fo: 1.06, ro: 0.86, taper: 0.24, paint: 0xc4161c, style: 'super', accent: 0xf2c230,
    deck: [[0, 0.72], [0.03, 0.86], [0.18, 0.93], [0.36, 0.94], [0.7, 0.8], [0.84, 0.67], [0.95, 0.54], [0.985, 0.47], [1, 0.4]],
    cab: [0.34, 0.77], roof: [[0.45, 1.13], [0.55, 1.2], [0.62, 1.17], [0.7, 1.02]],
  },
  hypercar: {
    L: 4.62, W: 2.04, clr: 0.09, r: 0.37, fo: 1.04, ro: 0.86, taper: 0.26, paint: 0x2a2d32, style: 'hyper', accent: 0xff7a1a, rim: 0x16181b,
    deck: [[0, 0.7], [0.03, 0.83], [0.18, 0.89], [0.38, 0.89], [0.7, 0.74], [0.84, 0.62], [0.95, 0.5], [0.985, 0.43], [1, 0.36]],
    cab: [0.36, 0.75], roof: [[0.46, 1.06], [0.55, 1.12], [0.62, 1.09], [0.69, 0.95]],
  },
}
export const FINE_CARS = Object.keys(SPECS)
export const isFineCar = (id: string): boolean => id in SPECS

const WELL = 0.27 // how deep the wheel wells go into the body
const STATIONS = 120

function buildBody(s: Spec) {
  const deck = curve(s.deck)
  const [c0, c1] = s.cab
  const roof = curve([[c0, deck(c0)], ...s.roof, [c1, deck(c1)]])
  const roofTop = Math.max(...s.roof.map((p) => p[1]))
  const axles = [-s.L / 2 + s.ro, s.L / 2 - s.fo]
  const R = s.r + 0.065
  const half = (t: number) => { const e = Math.max(0, (Math.abs(2 * t - 1) - 0.62) / 0.38); return (s.W / 2) * (1 - s.taper * Math.pow(e, 2.3)) }
  // The wing line: the body side rises over each wheel, so low bonnets still clear the tyres.
  const wing = (t: number, z: number) => {
    let y = deck(t)
    for (const zc of axles) { const k = Math.max(0, 1 - Math.abs(z - zc) / (R + 0.34)); y = Math.max(y, (2 * s.r + 0.085) * (k * k * (3 - 2 * k)) + deck(t) * (1 - k * k * (3 - 2 * k))) }
    return y
  }
  const pos: number[] = [], paintIdx: number[] = [], glassPos: number[] = [], glassIdx: number[] = [], roofIdx: number[] = []
  const RING = 18
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS, z = -s.L / 2 + t * s.L
    const e = Math.max(0, (Math.abs(2 * t - 1) - 0.62) / 0.38)
    const hw = half(t), yd = deck(t), ys = wing(t, z), y0 = s.clr + 0.1 * e * e
    let ya = y0
    for (const zc of axles) { const d = z - zc; if (Math.abs(d) < R) ya = Math.max(ya, s.r + Math.sqrt(R * R - d * d)) }
    ya = Math.min(ya, ys - 0.075)
    const xi = Math.max(hw * 0.45, hw - WELL), c = 0.035
    const y4 = Math.min(ya + 0.07, ys - 0.06), y5 = Math.max(y4 + 0.01, ys - 0.09)
    const right: Pt[] = [[0, y0], [xi, y0], [xi, ya], [hw - 0.012, ya], [hw, y4], [hw, y5], [hw * 0.955, ys - 0.012], [hw * 0.8, (ys + yd) / 2 + c * 0.4], [hw * 0.42, yd + c * 0.85], [0, yd + c]]
    for (const [x, y] of right) pos.push(x, y, z)
    for (let j = 8; j >= 1; j--) pos.push(-right[j]![0], right[j]![1], z)
    if (i < STATIONS) for (let j = 0; j < RING; j++) {
      const a = i * RING + j, b = i * RING + ((j + 1) % RING), d = (i + 1) * RING + j, cc = (i + 1) * RING + ((j + 1) % RING)
      paintIdx.push(a, b, d, b, cc, d)
    }
  }
  // End caps.
  for (const [i, front] of [[0, false], [STATIONS, true]] as const) {
    const t = i / STATIONS, z = -s.L / 2 + t * s.L
    const centre = pos.length / 3
    pos.push(0, (deck(t) + s.clr + 0.1) / 2, z)
    for (let j = 0; j < RING; j++) { const a = i * RING + j, b = i * RING + ((j + 1) % RING); if (front) paintIdx.push(centre, a, b); else paintIdx.push(centre, b, a) }
  }
  // The cabin: side glass and screens in glass, the flat of the roof in paint.
  const CAB = 46
  for (let i = 0; i <= CAB; i++) {
    const t = c0 + ((c1 - c0) * i) / CAB, z = -s.L / 2 + t * s.L
    const hw = half(t) * 0.87, yd = deck(t) - 0.012, yr = Math.max(yd, roof(t))
    const h = yr - yd
    const right: Pt[] = [[hw, yd], [hw * 0.91, yd + h * 0.55], [hw * 0.8, yr - Math.min(0.04, h * 0.3)], [hw * 0.6, yr], [0, yr + Math.min(0.014, h * 0.2)]]
    for (const [x, y] of right) glassPos.push(x, y, z)
    for (let j = 3; j >= 0; j--) glassPos.push(-right[j]![0], right[j]![1], z)
    if (i < CAB) {
      const tm = c0 + ((c1 - c0) * (i + 0.5)) / CAB
      const flat = (roof(tm) - deck(tm)) / (roofTop - deck(tm)) > 0.9
      // Painted pillars across the side glass: at each end of the roof, and between the doors on a four-door.
      const f = (tm - c0) / (c1 - c0)
      const four = s.style === 'saloon' || s.style === 'executive' || s.style === 'sport'
      const firstFlat = s.roof[0]![0], lastFlat = s.roof[s.roof.length - 1]![0]
      const pillar = Math.abs(tm - lastFlat) < 0.012 || (four ? tm > firstFlat - 0.035 && tm < firstFlat + 0.03 : Math.abs(tm - firstFlat) < 0.014) || (four && Math.abs(f - 0.6) < 0.022)
      for (let j = 0; j < 8; j++) {
        const a = i * 9 + j, b = i * 9 + j + 1, d = (i + 1) * 9 + j, cc = (i + 1) * 9 + j + 1
        const top = j >= 2 && j <= 5
        ;((top && flat) || (!top && pillar) ? roofIdx : glassIdx).push(a, b, d, b, cc, d)
      }
    }
  }
  const make = (p: number[], idx: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals(); return g }
  return { paint: make(pos, paintIdx), glass: make(glassPos, glassIdx), roofPanel: make(glassPos, roofIdx), deck, half, wing, roof, roofTop, axles, R }
}

const std = (color: number, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
const RUBBER = std(0x101113, 0.9)
const LINER = std(0x0a0b0c, 0.95)
const DISC = std(0x8f9499, 0.35, 0.9)
const TRIM = std(0x0e0f11, 0.45, 0.4)
const CHROME = std(0xe8ebee, 0.12, 1, { envMapIntensity: 1.6 })
const GLASS = new THREE.MeshPhysicalMaterial({ color: 0x0b1116, roughness: 0.04, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8, side: THREE.DoubleSide })
const lamp = (c: number) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o }

function wheel(r: number, rim: THREE.Material, caliper: number, spokes: number): THREE.Group {
  const g = new THREE.Group(), w = 0.25
  const tyre = new THREE.LatheGeometry([new THREE.Vector2(r * 0.66, -w / 2), new THREE.Vector2(r * 0.94, -w / 2), new THREE.Vector2(r, -w / 2 + 0.035), new THREE.Vector2(r, w / 2 - 0.035), new THREE.Vector2(r * 0.94, w / 2), new THREE.Vector2(r * 0.66, w / 2)], 32).rotateZ(Math.PI / 2)
  g.add(mesh(tyre, RUBBER))
  const barrel = new THREE.CylinderGeometry(r * 0.67, r * 0.67, w * 0.8, 28, 1, true).rotateZ(Math.PI / 2)
  g.add(mesh(barrel, rim))
  g.add(mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.02, 24).rotateZ(Math.PI / 2), DISC, w * 0.18))
  g.add(mesh(new THREE.BoxGeometry(0.06, r * 0.36, r * 0.2), std(caliper, 0.4, 0.3), w * 0.2, r * 0.36, 0))
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2
    for (const off of [-0.07, 0.07]) parts.push(new THREE.BoxGeometry(0.03, r * 0.6, r * 0.075).translate(0, r * 0.36, 0).rotateX(a + off))
  }
  parts.push(new THREE.CylinderGeometry(r * 0.16, r * 0.2, 0.05, 16).rotateZ(Math.PI / 2))
  parts.push(new THREE.TorusGeometry(r * 0.655, r * 0.035, 8, 32).rotateY(Math.PI / 2))
  g.add(mesh(mergeGeometries(parts)!, rim, w * 0.34))
  return g
}

const cache = new Map<string, THREE.Group>()
/** The dealership model for a car id, wheels on the ground at y = 0, nose towards +z. */
export function fineCar(id: string): THREE.Group {
  const hit = cache.get(id)
  if (hit) return hit.clone()
  const s = SPECS[id] ?? SPECS.tourer!
  const b = buildBody(s)
  const g = new THREE.Group()
  const paint = new THREE.MeshPhysicalMaterial({ color: s.paint, roughness: s.style === 'hyper' ? 0.42 : 0.34, metalness: s.style === 'hyper' ? 0.55 : 0.62, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.5 })
  g.add(mesh(b.paint, paint), mesh(b.glass, GLASS), mesh(b.roofPanel, s.style === 'ev' ? GLASS : paint))
  const acc = s.accent ?? s.paint
  const rimMat = std(s.rim ?? 0xd5d8db, 0.22, 0.95, { envMapIntensity: 1.5 })
  const T = (z: number) => (z + s.L / 2) / s.L

  // Wheels in their wells, with a dark liner behind each.
  for (const zc of b.axles) for (const sx of [-1, 1]) {
    const hw = b.half(T(zc))
    const w = wheel(s.r, rimMat, s.style === 'saloon' || s.style === 'executive' ? 0x4a4d52 : acc, s.style === 'hyper' || s.style === 'super' ? 5 : s.style === 'executive' ? 9 : 6)
    w.position.set(sx * (hw - 0.125), s.r, zc)
    if (sx < 0) w.rotation.y = Math.PI
    g.add(w)
    g.add(mesh(new THREE.CylinderGeometry(b.R - 0.004, b.R - 0.004, WELL - 0.01, 28, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), LINER, sx * (hw - WELL / 2 - 0.004), s.r, zc))
    g.add(mesh(new THREE.CircleGeometry(b.R, 24).rotateY(sx * Math.PI / 2), LINER, sx * (hw - WELL + 0.006), s.r, zc))
  }

  const zf = s.L / 2, zr = -s.L / 2
  const hwN = b.half(0.992), hwT = b.half(0.008)
  const noseY = b.deck(0.992), tailY = b.deck(0.008)
  // Head lamps and tail lamps follow the corners.
  const low = s.style === 'super' || s.style === 'hyper'
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(low ? 0.3 : 0.42, low ? 0.05 : 0.085, 0.07), lamp(0xf3f7ff))
    head.position.set(sx * hwN * (low ? 0.66 : 0.62), noseY - (low ? 0.035 : 0.075), zf - 0.035); head.rotation.y = sx * -0.42
    g.add(head)
    if (s.style === 'gt' || s.style === 'super') {
      for (const k of [0, 1]) g.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 18).rotateX(Math.PI / 2), lamp(0xff2a22), sx * (hwT * 0.72 - k * 0.15), tailY - 0.1, zr + 0.012))
    } else {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(s.style === 'executive' ? 0.44 : 0.4, 0.07, 0.05), lamp(0xff2a22))
      tail.position.set(sx * hwT * 0.64, tailY - 0.09, zr + 0.02); tail.rotation.y = sx * 0.4
      g.add(tail)
    }
    // Door mirrors at the base of the windscreen pillar.
    const mz = -s.L / 2 + (s.cab[1] - 0.045) * s.L, mt = T(mz)
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.085, 0.07), paint, sx * (b.half(mt) * 0.87 + 0.1), b.deck(mt) + 0.06, mz))
    g.add(mesh(new THREE.BoxGeometry(0.13, 0.02, 0.05), TRIM, sx * (b.half(mt) * 0.87 + 0.03), b.deck(mt) + 0.035, mz))
    // Door shut lines and a handle.
    const four = s.style === 'saloon' || s.style === 'executive' || s.style === 'sport'
    const span = s.cab[1] - s.cab[0]
    for (const f of four ? [0.97, 0.62, 0.3] : [0.97, 0.5]) {
      const dz = -s.L / 2 + (s.cab[0] + span * f) * s.L, dt = T(dz), top = b.deck(dt) - 0.03, bot = Math.max(s.clr + 0.12, 0.3)
      g.add(mesh(new THREE.BoxGeometry(0.006, top - bot, 0.012), TRIM, sx * (b.half(dt) + 0.001), (top + bot) / 2, dz))
    }
    for (const f of four ? [0.66, 0.34] : [0.54]) { const dz = -s.L / 2 + (s.cab[0] + span * f) * s.L, dt = T(dz); g.add(mesh(new THREE.BoxGeometry(0.014, 0.022, 0.14), s.style === 'executive' ? CHROME : paint, sx * (b.half(dt) + 0.006), b.deck(dt) - 0.11, dz)) }
    // Sill.
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.07, b.axles[1]! - b.axles[0]! - 2 * b.R - 0.06), TRIM, sx * (s.W / 2 - 0.004), s.clr + 0.05, (b.axles[0]! + b.axles[1]!) / 2))
  }
  // Number plates.
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.11, 0.012), std(0xf4f4f0, 0.5), 0, Math.max(s.clr + 0.16, tailY - 0.27), zr - 0.002))

  // The face and the tail of each design.
  const grilleH = noseY - s.clr - 0.2
  if (s.style === 'executive') {
    // An upright chrome grille with fine slats, and a chrome waistline.
    g.add(mesh(new THREE.BoxGeometry(hwN * 0.9, grilleH * 0.62, 0.03), CHROME, 0, s.clr + 0.2 + grilleH * 0.52, zf + 0.004))
    g.add(mesh(new THREE.BoxGeometry(hwN * 0.84, grilleH * 0.54, 0.034), TRIM, 0, s.clr + 0.2 + grilleH * 0.52, zf + 0.006))
    for (let k = -4; k <= 4; k++) g.add(mesh(new THREE.BoxGeometry(0.014, grilleH * 0.54, 0.04), CHROME, (k / 4.6) * hwN * 0.42, s.clr + 0.2 + grilleH * 0.52, zf + 0.008))
    for (const sx of [-1, 1]) { const z0 = -s.L / 2 + s.cab[0] * s.L, z1 = -s.L / 2 + s.cab[1] * s.L; g.add(mesh(new THREE.BoxGeometry(0.008, 0.018, z1 - z0 - 0.1), CHROME, sx * (s.W / 2 * 0.87 + 0.002), b.deck(0.45) - 0.004, (z0 + z1) / 2)) }
    g.add(mesh(new THREE.BoxGeometry(hwN * 1.5, 0.05, 0.03), TRIM, 0, s.clr + 0.12, zf + 0.004))
    for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), CHROME, sx * hwT * 0.6, s.clr + 0.13, zr - 0.005))
  } else if (s.style === 'ev') {
    // No grille: a light bar front and rear.
    g.add(mesh(new THREE.BoxGeometry(hwN * 1.36, 0.016, 0.02), lamp(acc), 0, noseY - 0.075, zf + 0.004))
    g.add(mesh(new THREE.BoxGeometry(hwT * 1.5, 0.018, 0.02), lamp(0xff3a32), 0, tailY - 0.09, zr - 0.004))
    g.add(mesh(new THREE.BoxGeometry(hwN * 1.3, 0.07, 0.03), TRIM, 0, s.clr + 0.13, zf + 0.004))
  } else {
    // A wide lower intake; the sport saloon and the supercars add a splitter.
    g.add(mesh(new THREE.BoxGeometry(hwN * (low ? 1.5 : 1.2), Math.max(0.09, grilleH * (low ? 0.5 : 0.42)), 0.03), TRIM, 0, s.clr + 0.16 + grilleH * 0.2, zf + 0.004))
    if (s.style === 'saloon' || s.style === 'sport' || s.style === 'gt') g.add(mesh(new THREE.BoxGeometry(hwN * 0.9, 0.06, 0.03), TRIM, 0, noseY - 0.16, zf + 0.004))
    if (s.style !== 'saloon') g.add(mesh(new THREE.BoxGeometry(hwN * 1.8, 0.02, 0.1), TRIM, 0, s.clr + 0.02, zf - 0.03))
    const pipes = s.style === 'sport' ? [-0.62, -0.46, 0.46, 0.62] : s.style === 'hyper' ? [0] : s.style === 'super' ? [-0.2, 0.2] : [-0.55, 0.55]
    for (const k of pipes) g.add(mesh(new THREE.CylinderGeometry(s.style === 'hyper' ? 0.075 : 0.045, s.style === 'hyper' ? 0.075 : 0.045, 0.1, 16).rotateX(Math.PI / 2), CHROME, k * hwT, s.style === 'hyper' ? tailY - 0.2 : s.clr + 0.12, zr - 0.01))
    g.add(mesh(new THREE.BoxGeometry(hwT * 1.7, 0.1, 0.05), TRIM, 0, s.clr + 0.09, zr + 0.01))
  }
  if (s.style === 'sport') g.add(mesh(new THREE.BoxGeometry(s.W * 0.78, 0.022, 0.1), TRIM, 0, b.deck(0.02) + 0.045, zr + 0.1))
  if (low) {
    // Side intakes ahead of the rear wheels, a louvred engine cover and a wing.
    for (const sx of [-1, 1]) { const iz = b.axles[0]! + b.R + 0.3; g.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.46), TRIM, sx * (b.half(T(iz)) + 0.002), 0.5, iz)) }
    const e0 = -s.L / 2 + 0.1 * s.L, e1 = -s.L / 2 + (s.cab[0] + 0.02) * s.L
    for (let k = 0; k < 5; k++) { const z = e0 + ((e1 - e0) * (k + 0.5)) / 5; g.add(mesh(new THREE.BoxGeometry(s.W * 0.34, 0.012, 0.07), TRIM, 0, b.deck(T(z)) + 0.04, z)) }
    if (s.style === 'hyper') {
      const wy = b.deck(0.04) + 0.3
      g.add(mesh(new THREE.BoxGeometry(s.W * 0.94, 0.025, 0.3), TRIM, 0, wy, zr + 0.2))
      for (const sx of [-1, 1]) { g.add(mesh(new THREE.BoxGeometry(0.02, 0.3, 0.2), TRIM, sx * s.W * 0.3, wy - 0.15, zr + 0.24)); g.add(mesh(new THREE.BoxGeometry(0.02, 0.1, 0.32), std(acc, 0.4, 0.3), sx * s.W * 0.47, wy + 0.03, zr + 0.2)) }
      g.add(mesh(new THREE.BoxGeometry(0.26, 0.07, 0.5), TRIM, 0, b.roofTop + 0.03, -s.L / 2 + (s.cab[0] + 0.1) * s.L))
    } else g.add(mesh(new THREE.BoxGeometry(s.W * 0.86, 0.02, 0.14), paint, 0, b.deck(0.02) + 0.05, zr + 0.09))
  }
  g.traverse((o) => { o.castShadow = true })
  cache.set(id, g)
  return g.clone()
}
