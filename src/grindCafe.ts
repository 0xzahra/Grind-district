// Grind Café: the city's glass café beside McGrind (it was the brick Campus café). A steel-and-glass pavilion you
// can see straight into and walk into through its open front: a barista at the espresso bar, people at little
// tables with cups and laptops, more outside, warm pendants under a timber soffit. Also McGrind's patio, so the
// restaurant front has customers eating outside.
// Built like the other street fronts: every part merged per material (a few draws for the whole café), people as
// frozen instanced crowds (hallCrowd.ts), and nothing that rays or taps test (ghost meshes), so the camera never
// snaps on the glass. Colliders are plain boxes and circles in the world's obstacle list.
import * as THREE from 'three'
import { placeGoods, TINTS, type Placed } from './groceries.ts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hallCrowd, standing, STUDENTS, ATTENDEES, type CrowdSpot } from './hallCrowd.ts'
import type { Obstacle } from './physics.ts'
import { MCGRIND_GREEN } from './brandFronts.ts'
import { houseplantMaterial, houseplantGeometry } from './trees.ts'

type Parts = Map<THREE.Material, THREE.BufferGeometry[]>
const put = (parts: Parts, mat: THREE.Material, geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => {
  const g = (geo.index ? geo.toNonIndexed() : geo)
  if (ry) g.rotateY(ry)
  g.translate(x, y, z)
  const l = parts.get(mat) ?? []; l.push(g); parts.set(mat, l)
}
const box = (parts: Parts, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => put(parts, mat, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry)
const cyl = (parts: Parts, mat: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 14) => put(parts, mat, new THREE.CylinderGeometry(rt, rb, h, seg), x, y + h / 2, z)
function build(parts: Parts, group: THREE.Group, shadows = true): void {
  for (const [mat, geos] of parts) {
    const m = new THREE.Mesh(mergeGeometries(geos, false)!, mat)
    const glassy = (mat as THREE.MeshStandardMaterial).transparent
    m.castShadow = shadows && !glassy; m.receiveShadow = !glassy
    m.userData.ghost = true; m.raycast = () => undefined
    if (glassy) m.renderOrder = 2
    group.add(m)
  }
}
const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
/** A coffee cup with steam, drawn as the café's mark. */
function cupMark(g: CanvasRenderingContext2D, x: number, y: number, s: number, ink: string): void {
  g.save(); g.translate(x, y); g.scale(s, s)
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 0.09; g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(-0.42, -0.1); g.lineTo(0.3, -0.1); g.lineTo(0.24, 0.36); g.quadraticCurveTo(-0.06, 0.52, -0.36, 0.36); g.closePath(); g.fill()
  g.beginPath(); g.arc(0.36, 0.1, 0.13, -1.2, 1.4); g.stroke()
  g.beginPath(); g.ellipse(-0.06, 0.52, 0.5, 0.06, 0, 0, Math.PI * 2); g.fill()
  for (const sx of [-0.22, 0, 0.18]) { g.beginPath(); g.moveTo(sx, -0.22); g.bezierCurveTo(sx - 0.1, -0.36, sx + 0.1, -0.46, sx, -0.62); g.stroke() }
  g.restore()
}
const FONT = '"Archivo Black", "Inter Variable", Inter, system-ui, sans-serif'

/**
 * People are frozen figures in instanced draws; how many depends on the device (`many` false on Light). They sit in
 * `people`, which the world shows only when the player is near (about 4k triangles a figure is wasted far away).
 */
export type Built = { group: THREE.Group; obstacles: Obstacle[]; people: THREE.Group }

/**
 * Grind Café, centred at (cx, cz), w x d, its open front facing +z. Returns the meshes and colliders; the caller adds
 * its hotspots (the front step and the counter).
 */
export function grindCafe(cx: number, cz: number, many: boolean): Built {
  const W = 8, D = 7, H = 3.4
  const x0 = cx - W / 2, x1 = cx + W / 2, zb = cz - D / 2, zf = cz + D / 2
  const group = new THREE.Group(); group.name = 'grind-cafe'
  const parts: Parts = new Map()
  // Few materials, so the whole café is about a dozen draws: light (render, stone, cups, pots), dark (steel frame
  // and stone tops), metal (chrome and laptops), two woods, leaves, soil, glass and the lamp glow.
  const light = std(0xefe9de, 0.75), dark = std(0x23292a, 0.4, 0.45), metal = std(0xc2c9ce, 0.3, 0.8)
  const steel = dark, stone = light, white = light, timber = std(0xb98652, 0.6)
  const walnut = std(0x6b4428, 0.55), top = dark, chrome = metal
  const leaf = houseplantMaterial(), soil = std(0x2e2118, 1), pot = light, cream = light, mug = light, laptop = metal
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe9f2, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide })
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 1.1, roughness: 0.5 })
  // Floor, frame and roof: a stone plinth, slim steel posts, a white roof slab with a timber soffit.
  box(parts, stone, W + 0.6, 0.05, D + 0.6, cx, 0, cz)
  for (const x of [x0, x1]) for (const z of [zb, zf]) box(parts, steel, 0.14, H, 0.14, x, 0, z)
  for (const x of [cx - 1.4, cx + 1.4]) box(parts, steel, 0.12, H, 0.12, x, 0, zf)
  box(parts, white, W + 1.0, 0.26, D + 1.0, cx, H, cz)
  box(parts, timber, W + 0.9, 0.04, D + 0.9, cx, H - 0.04, cz)
  box(parts, steel, W + 1.02, 0.08, 0.06, cx, H + 0.09, zf + 0.5)
  // Glass on three sides and either side of the open front; steel mullions between the panes.
  box(parts, glass, 0.04, H - 0.1, D - 0.1, x0, 0.05, cz)
  box(parts, glass, 0.04, H - 0.1, D - 0.1, x1, 0.05, cz)
  box(parts, glass, (W / 2 - 1.4) - 0.08, H - 0.1, 0.04, (x0 + cx - 1.4) / 2, 0.05, zf)
  box(parts, glass, (W / 2 - 1.4) - 0.08, H - 0.1, 0.04, (x1 + cx + 1.4) / 2, 0.05, zf)
  for (const z of [cz - D / 6, cz + D / 6]) { box(parts, steel, 0.06, H, 0.06, x0, 0, z); box(parts, steel, 0.06, H, 0.06, x1, 0, z) }
  for (const x of [x0, x1]) box(parts, steel, 0.08, 0.06, D, x, 1.05, cz)
  // The back wall: warm timber with shelves of bags and jars, and the menu board.
  box(parts, walnut, W - 0.1, H, 0.14, cx, 0, zb)
  // Shelves of what the café sells by the bag: Grind Roast pouches below, tins of beans and jars above.
  const goods: Placed[] = []
  for (const [k, y] of [[0, 1.55], [1, 2.05]] as const) {
    box(parts, timber, 3.2, 0.05, 0.3, cx + 2.0, y, zb + 0.22)
    for (let i = 0; i < 9; i++) {
      const x = cx + 0.62 + i * 0.34
      if (k === 0) goods.push({ p: 'coffee', x, y: y + 0.05, z: zb + 0.24, tint: TINTS[i % 3], s: 1.05 })
      else goods.push({ p: i % 3 === 2 ? 'jar' : 'beans', x, y: y + 0.05, z: zb + 0.24, tint: TINTS[(i + 2) % TINTS.length] })
    }
  }
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), new THREE.MeshBasicMaterial({ map: tex(520, 240, (g) => {
    g.fillStyle = '#16201c'; g.fillRect(0, 0, 520, 240)
    g.strokeStyle = '#c9a25e'; g.lineWidth = 6; g.strokeRect(6, 6, 508, 228)
    g.fillStyle = '#f6efe2'; g.font = `400 34px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'
    g.fillText('GRIND CAFÉ', 28, 46); cupMark(g, 470, 48, 44, '#f6efe2')
    g.font = '600 24px Inter, system-ui, sans-serif'
    const rows: Array<[string, string]> = [['Coffee', '$3'], ['Tea & chin chin', '$2'], ['Meat pie', '$4'], ['Water', 'free']]
    rows.forEach(([a, b], i) => { g.fillStyle = '#eadfca'; g.fillText(a, 32, 98 + i * 36); g.textAlign = 'right'; g.fillStyle = '#17f790'; g.fillText(b, 490, 98 + i * 36); g.textAlign = 'left' })
  }) }))
  menu.position.set(cx - 1.6, 2.15, zb + 0.08); menu.userData.ghost = true; menu.raycast = () => undefined
  group.add(menu)
  // The espresso bar: a walnut counter with a stone top, the machine, a grinder, cups and a pastry case.
  const cz2 = zb + 1.25
  box(parts, walnut, 5.0, 1.0, 0.7, cx, 0, cz2)
  box(parts, top, 5.2, 0.06, 0.82, cx, 1.0, cz2)
  box(parts, chrome, 0.8, 0.46, 0.5, cx - 1.2, 1.06, cz2 - 0.05)
  for (const dx of [-0.2, 0.2]) cyl(parts, top, 0.05, 0.05, 0.12, cx - 1.2 + dx, 1.14, cz2 + 0.24)
  cyl(parts, top, 0.12, 0.16, 0.5, cx - 0.4, 1.06, cz2 - 0.1)
  for (let i = 0; i < 4; i++) cyl(parts, mug, 0.05, 0.04, 0.1, cx + 0.1 + (i % 2) * 0.13, 1.06 + Math.floor(i / 2) * 0.1, cz2 - 0.15)
  box(parts, glass, 1.4, 0.5, 0.6, cx + 1.4, 1.06, cz2)
  // The pastry case: two trays, croissants and muffins above, puff-puff and loaves below.
  for (const y of [1.07, 1.3]) box(parts, cream, 1.3, 0.015, 0.5, cx + 1.4, y, cz2)
  for (let i = 0; i < 4; i++) goods.push({ p: 'croissant', x: cx + 0.88 + i * 0.32, y: 1.315, z: cz2 - 0.1, yaw: 0.3 * (i % 2 ? 1 : -1), s: 1.1 })
  for (let i = 0; i < 4; i++) goods.push({ p: 'muffin', x: cx + 0.9 + i * 0.32, y: 1.315, z: cz2 + 0.12 })
  for (let i = 0; i < 9; i++) goods.push({ p: 'puff', x: cx + 0.84 + (i % 5) * 0.12, y: 1.085, z: cz2 - 0.12 + Math.floor(i / 5) * 0.1 })
  for (let i = 0; i < 2; i++) goods.push({ p: 'loaf', x: cx + 1.62 + i * 0.32, y: 1.085, z: cz2 + 0.02, yaw: Math.PI / 2 })
  placeGoods(goods, group)
  // Little tables by the glass, two seats each, with cups and the odd laptop; more outside on the terrace.
  const tables: Array<[number, number]> = [[x0 + 1.3, cz - 0.4], [x0 + 1.3, cz + 1.8], [x1 - 1.3, cz - 0.4], [x1 - 1.3, cz + 1.8]]
  const terrace: Array<[number, number]> = [[x0 + 0.9, zf + 1.6], [x1 - 0.9, zf + 1.6]]
  const seated: CrowdSpot[] = []
  const obstacles: Obstacle[] = []
  ;[...tables, ...terrace].forEach(([tx, tz], i) => {
    cyl(parts, top, 0.42, 0.42, 0.04, tx, 0.74, tz, 20); cyl(parts, chrome, 0.04, 0.04, 0.72, tx, 0.02, tz, 8); cyl(parts, chrome, 0.24, 0.26, 0.03, tx, 0, tz, 16)
    cyl(parts, mug, 0.045, 0.038, 0.09, tx - 0.12, 0.78, tz + 0.1, 10)
    if (i % 2 === 0) { box(parts, laptop, 0.34, 0.02, 0.24, tx + 0.08, 0.78, tz - 0.05); box(parts, laptop, 0.34, 0.22, 0.015, tx + 0.08, 0.79, tz - 0.17, 0) }
    for (const s of [-1, 1]) {
      const sx = tx + s * 0.72
      box(parts, timber, 0.42, 0.05, 0.42, sx, 0.43, tz); box(parts, steel, 0.04, 0.43, 0.04, sx - 0.17, 0, tz - 0.17); box(parts, steel, 0.04, 0.43, 0.04, sx + 0.17, 0, tz + 0.17)
      box(parts, steel, 0.04, 0.43, 0.04, sx - 0.17, 0, tz + 0.17); box(parts, steel, 0.04, 0.43, 0.04, sx + 0.17, 0, tz - 0.17)
      box(parts, timber, 0.04, 0.46, 0.4, sx + s * 0.2, 0.45, tz)
      seated.push({ x: sx, z: tz, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2 })
    }
    obstacles.push({ kind: 'circle', x: tx, z: tz, r: 0.95 })
  })
  // Warm pendants over the tables and the bar; plants in the corners.
  for (const [px, pz] of [[x0 + 1.3, cz + 0.7], [x1 - 1.3, cz + 0.7], [cx - 1.2, cz2], [cx + 1.2, cz2]] as Array<[number, number]>) {
    cyl(parts, steel, 0.008, 0.008, 0.7, px, H - 0.7, pz, 4)
    cyl(parts, glow, 0.16, 0.2, 0.18, px, H - 0.88, pz, 12)
  }
  for (const [px, pz] of [[x0 + 0.45, zb + 0.5], [x1 - 0.45, zb + 0.5], [cx - 2.2, zf + 0.7], [cx + 2.2, zf + 0.7]] as Array<[number, number]>) {
    cyl(parts, pot, 0.24, 0.2, 0.46, px, 0, pz); cyl(parts, soil, 0.228, 0.228, 0.012, px, 0.444, pz, 24)
    put(parts, leaf, houseplantGeometry(Math.round(px * 7 + pz * 3) & 63, 0.85, 0.46), px, 0.44, pz)
  }
  build(parts, group)
  // The sign on the roof edge over the open front: GRIND CAFÉ with the cup.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.72), new THREE.MeshBasicMaterial({ transparent: true, map: tex(1024, 160, (g) => {
    g.fillStyle = '#16201c'; g.beginPath(); g.roundRect(4, 4, 1016, 152, 30); g.fill()
    g.fillStyle = '#f6efe2'; g.font = `400 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText('GRIND CAFÉ', 470, 86); cupMark(g, 880, 82, 110, '#17f790')
  }) }))
  sign.position.set(cx, H + 0.62, zf + 0.52); sign.userData.ghost = true; sign.raycast = () => undefined
  group.add(sign)
  // People: a barista behind the bar, customers at the tables and outside, two waiting at the counter.
  const people = new THREE.Group(); people.name = 'grind-cafe-people'; group.add(people)
  standing(people, ATTENDEES[1] ?? STUDENTS[0]!, cx - 0.9, 0, cz2 - 0.65, 0)
  // A few figures from the city's cast, repeated (each figure is one model to load and one draw).
  hallCrowd(people, seated, [...STUDENTS.slice(0, 3), ...ATTENDEES.slice(0, 2)], { cap: many ? seated.length : Math.ceil(seated.length / 2), seatY: 0.45 })
  hallCrowd(people, [{ x: cx + 0.2, z: cz2 + 0.9, yaw: Math.PI }, { x: cx + 1.0, z: cz2 + 1.0, yaw: Math.PI + 0.3 }], ATTENDEES.slice(2, 5), { cap: many ? 2 : 1, pose: 'stand' })
  // Colliders: back wall and bar, the glass sides, the glass either side of the open front.
  obstacles.push(
    { kind: 'box', x: cx, z: zb, hx: W / 2, hz: 0.2 },
    { kind: 'box', x: cx, z: cz2, hx: 2.6, hz: 0.45 },
    { kind: 'box', x: x0, z: cz, hx: 0.12, hz: D / 2 },
    { kind: 'box', x: x1, z: cz, hx: 0.12, hz: D / 2 },
    { kind: 'box', x: (x0 + cx - 1.4) / 2, z: zf, hx: (W / 2 - 1.4) / 2, hz: 0.12 },
    { kind: 'box', x: (x1 + cx + 1.4) / 2, z: zf, hx: (W / 2 - 1.4) / 2, hz: 0.12 },
    { kind: 'circle', x: cx + 0.6, z: cz2 + 0.95, r: 0.55 },
  )
  return { group, obstacles, people }
}

/**
 * McGrind's patio: green-and-white parasols over tables either side of the door, with people eating, and a few
 * friends chatting by the A-boards. The door at (doorX, doorZ) stays clear.
 */
export function mcgrindPatio(doorX: number, doorZ: number, many: boolean): Built {
  const group = new THREE.Group(); group.name = 'mcgrind-patio'
  const parts: Parts = new Map()
  const steel = std(0x1f2a26, 0.45, 0.6), top = std(0xf4f1ea, 0.5), seat = std(0x0f7a48, 0.6), food = std(0xe2a24a, 0.6), cup = top
  const canvas = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, map: tex(256, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1ea' : MCGRIND_GREEN; g.fillRect(i * 32, 0, 32, 64) } }) })
  const tables: Array<[number, number]> = [[doorX - 4.6, doorZ + 2.4], [doorX - 4.6, doorZ + 5.4], [doorX + 4.4, doorZ + 5.6]]
  const seated: CrowdSpot[] = []
  const obstacles: Obstacle[] = []
  for (const [tx, tz] of tables) {
    box(parts, top, 0.9, 0.04, 0.9, tx, 0.74, tz); cyl(parts, steel, 0.04, 0.04, 0.72, tx, 0.02, tz, 8); box(parts, steel, 0.6, 0.03, 0.6, tx, 0, tz)
    cyl(parts, steel, 0.025, 0.025, 2.3, tx, 0, tz, 6)
    put(parts, canvas, new THREE.ConeGeometry(1.35, 0.5, 8, 1, true), tx, 2.35, tz)
    box(parts, food, 0.18, 0.08, 0.18, tx - 0.15, 0.78, tz); cyl(parts, cup, 0.05, 0.04, 0.14, tx + 0.2, 0.78, tz + 0.1, 10)
    for (const s of [-1, 1]) {
      const sz = tz + s * 0.75
      box(parts, seat, 0.44, 0.05, 0.42, tx, 0.43, sz); box(parts, seat, 0.44, 0.44, 0.04, tx, 0.45, sz + s * 0.2)
      for (const [dx, dz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) box(parts, steel, 0.035, 0.43, 0.035, tx + dx!, 0, sz + dz!)
      seated.push({ x: tx, z: sz, yaw: s > 0 ? Math.PI : 0 })
    }
    obstacles.push({ kind: 'circle', x: tx, z: tz, r: 1.05 })
  }
  build(parts, group)
  const people = new THREE.Group(); people.name = 'mcgrind-patio-people'; group.add(people)
  hallCrowd(people, seated, [...ATTENDEES.slice(0, 2), ...STUDENTS.slice(2, 4)], { cap: many ? seated.length : 3, seatY: 0.45 })
  // Friends chatting outside, and one reading the hiring board.
  hallCrowd(people, [{ x: doorX + 2.2, z: doorZ + 3.2, yaw: 2.36 }, { x: doorX + 3.0, z: doorZ + 2.4, yaw: -0.79 }, { x: doorX + 6.4, z: doorZ + 1.0, yaw: -Math.PI / 2 }], STUDENTS.slice(1, 4), { cap: many ? 3 : 2, pose: 'stand' })
  obstacles.push({ kind: 'circle', x: doorX + 2.6, z: doorZ + 2.8, r: 0.6 })
  return { group, obstacles, people }
}
