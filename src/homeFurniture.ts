import * as THREE from 'three'
import { pbrSet } from './pbrTex.ts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Obstacle } from './physics.ts'
import { RANKS } from './logic.ts'

// Player-home furniture, tiered by the ladder (RANKS). Each rank unlocks a small, modest set;
// the home shows everything up to the player's rank. Every piece is built from low-poly parts,
// then ALL parts are merged per material, so the whole set costs ~10 draw calls whatever the tier.

type Mat = 'oak' | 'walnut' | 'white' | 'linen' | 'fabric' | 'cushion' | 'blue' | 'metal' | 'shade' | 'leaf' | 'pot' | 'rug' | 'rug2' | 'screen' | 'book'
const MATS: Record<Mat, () => THREE.Material> = {
  oak: () => new THREE.MeshStandardMaterial({ ...pbrSet('wood_table_001', 1), color: 0xe0c3a0, roughness: 1 }),
  walnut: () => new THREE.MeshStandardMaterial({ ...pbrSet('wood_table_001', 1), color: 0x8a6448, roughness: 1 }),
  white: () => new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.8 }),
  linen: () => new THREE.MeshStandardMaterial({ normalMap: pbrSet('fabric_pattern_07', 3).normalMap, roughnessMap: pbrSet('fabric_pattern_07', 3).roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xf1ede4, roughness: 1 }),
  // Plain warm upholstery: the old patterned texture read as black on phones.
  fabric: () => new THREE.MeshStandardMaterial({ normalMap: pbrSet('fabric_pattern_07', 3).normalMap, roughnessMap: pbrSet('fabric_pattern_07', 3).roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xc9b9a0, roughness: 1 }),
  cushion: () => new THREE.MeshStandardMaterial({ normalMap: pbrSet('fabric_pattern_07', 3).normalMap, roughnessMap: pbrSet('fabric_pattern_07', 3).roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0x8a5a44, roughness: 1 }),
  blue: () => new THREE.MeshStandardMaterial({ normalMap: pbrSet('fabric_pattern_07', 3).normalMap, roughnessMap: pbrSet('fabric_pattern_07', 3).roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0x4d6070, roughness: 1 }),
  metal: () => new THREE.MeshStandardMaterial({ color: 0x3a3c3f, roughness: 0.45, metalness: 0.6 }),
  // Lamp shades: faint warm self-light only (no extra real lights).
  shade: () => new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.9, emissive: 0xffd8a0, emissiveIntensity: 0.22 }),
  leaf: () => new THREE.MeshStandardMaterial({ color: 0x4f6b3e, roughness: 0.8 }),
  pot: () => new THREE.MeshStandardMaterial({ color: 0xa8664a, roughness: 0.9 }),
  rug: () => new THREE.MeshStandardMaterial({ ...pbrSet('fabric_pattern_07', 2), color: 0xd8cbb6, roughness: 1 }),
  rug2: () => new THREE.MeshStandardMaterial({ color: 0x6c7a72, roughness: 1 }),
  screen: () => new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.25, metalness: 0.3 }),
  book: () => new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.85 }),
}

export type FurnitureTier = { rank: string; items: string[] }

/** Builds the furniture for rank index `tier` (0 = Shrimp). Coordinates are room-local. */
export function buildHomeFurniture(tier: number, ox: number, oz: number) {
  const parts = new Map<Mat, THREE.BufferGeometry[]>()
  const obstacles: Obstacle[] = []
  // Sittable spots (room-local, facing yaw, seat-top height) and wall-TV screens, wired up by interiors.ts.
  const seats: Array<{ id: string; title: string; x: number; z: number; yaw: number; y: number }> = []
  const screens: Array<{ x: number; y: number; z: number; ry: number; width: number }> = []
  const sit = (id: string, title: string, x: number, z: number, yaw: number, y: number) => seats.push({ id, title, x, z, yaw, y })
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  let px = 0, pz = 0, pry = 0
  const push = (mat: Mat, g: THREE.BufferGeometry, x: number, y: number, z: number) => {
    g.translate(x, y, z)
    g.applyMatrix4(m4.compose(new THREE.Vector3(px, 0, pz), q.setFromAxisAngle(up, pry), new THREE.Vector3(1, 1, 1)))
    if (g.index) g = g.toNonIndexed()
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    ;(parts.get(mat) ?? parts.set(mat, []).get(mat)!).push(g)
  }
  // b: box with its bottom at y. c: cylinder with its bottom at y.
  const b = (mat: Mat, w: number, h: number, d: number, x: number, y: number, z: number) => push(mat, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z)
  // r: soft rounded box (sofas, cushions, mattresses) with its bottom at y.
  const r = (mat: Mat, w: number, h: number, d: number, x: number, y: number, z: number, rad = 0.05) => push(mat, new RoundedBoxGeometry(w, h, d, 2, Math.min(rad, h / 2 - 0.001, w / 2 - 0.001, d / 2 - 0.001)), x, y + h / 2, z)
  const c = (mat: Mat, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 10) => push(mat, new THREE.CylinderGeometry(rt, rb, h, seg), x, y + h / 2, z)
  const piece = (x: number, z: number, ry: number, hx: number, hz: number, build: () => void, block = true) => {
    px = x; pz = z; pry = ry
    build()
    if (block) {
      const sw = Math.abs(Math.cos(ry)) > 0.5
      obstacles.push({ kind: 'box', x: ox + x, z: oz + z, hx: sw ? hx : hz, hz: sw ? hz : hx })
    }
  }
  const legs4 = (mat: Mat, w: number, d: number, h: number, t = 0.05) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b(mat, t, h, t, sx * (w / 2 - t), 0, sz * (d / 2 - t))
  }

  // ---- Furniture parts (local: +z is the "front" the piece faces) ----
  const bed = (w: number) => { // frame, slats box, mattress, pillow(s), blanket, headboard
    b('oak', w + 0.1, 0.3, 2.1, 0, 0.12, 0)
    legs4('oak', w + 0.1, 2.1, 0.12, 0.08)
    r('linen', w, 0.2, 1.95, 0, 0.42, 0.03, 0.06)
    r('blue', w + 0.04, 0.06, 1.3, 0, 0.6, 0.36, 0.025)
    const n = w > 1.3 ? 2 : 1
    for (let i = 0; i < n; i++) r('white', n === 2 ? w / 2 - 0.12 : w - 0.3, 0.12, 0.38, n === 2 ? (i - 0.5) * (w / 2) : 0, 0.62, -0.72)
    b('oak', w + 0.1, 0.75, 0.07, 0, 0.12, -1.04)
  }
  const chair = (mat: Mat = 'oak') => { // legs, seat, back with two posts
    legs4(mat, 0.42, 0.42, 0.44, 0.04)
    b(mat, 0.44, 0.04, 0.44, 0, 0.44, 0)
    for (const sx of [-0.19, 0.19]) b(mat, 0.04, 0.45, 0.04, sx, 0.48, -0.2)
    b(mat, 0.42, 0.14, 0.03, 0, 0.76, -0.2)
  }
  const table = (w: number, d: number, h: number, mat: Mat = 'oak') => { legs4(mat, w, d, h - 0.04); b(mat, w, 0.04, d, 0, h - 0.04, 0) }
  const nightstand = () => { b('oak', 0.45, 0.5, 0.4, 0, 0.04, 0); legs4('oak', 0.45, 0.4, 0.04, 0.04); b('walnut', 0.3, 0.03, 0.02, 0, 0.36, 0.2) }
  const tableLamp = (y: number) => { c('metal', 0.08, 0.1, 0.03, 0, y, 0); c('metal', 0.012, 0.012, 0.3, 0, y + 0.03, 0, 6); c('shade', 0.1, 0.15, 0.18, 0, y + 0.28, 0, 12) }
  const floorLamp = () => { c('metal', 0.16, 0.18, 0.03, 0, 0, 0, 12); c('metal', 0.015, 0.015, 1.45, 0, 0.03, 0, 6); c('shade', 0.15, 0.22, 0.28, 0, 1.4, 0, 14) }
  const shelf = () => { // wall shelf: two boards on brackets with books
    for (const y of [1.2, 1.6]) { b('walnut', 1.0, 0.03, 0.24, 0, y, 0); for (const sx of [-0.4, 0.4]) b('metal', 0.02, 0.1, 0.18, sx, y - 0.1, -0.02) }
    for (let i = 0; i < 6; i++) b(i % 2 ? 'book' : 'blue', 0.05, 0.2 + (i % 3) * 0.03, 0.17, -0.38 + i * 0.07, 1.23, 0)
    b('pot', 0.12, 0.1, 0.12, 0.3, 1.63, 0); b('leaf', 0.18, 0.12, 0.16, 0.3, 1.72, 0)
  }
  const bookcase = () => {
    for (const sx of [-0.45, 0.45]) b('oak', 0.03, 1.7, 0.32, sx, 0, 0)
    b('oak', 0.93, 0.02, 0.02, 0, 0, -0.15); b('oak', 0.93, 1.7, 0.02, 0, 0, -0.16)
    for (const y of [0.05, 0.45, 0.85, 1.25, 1.68]) b('oak', 0.88, 0.03, 0.3, 0, y, 0)
    for (const y of [0.08, 0.88]) for (let i = 0; i < 9; i++) b(i % 3 ? 'book' : 'blue', 0.06, 0.26 + (i % 2) * 0.04, 0.22, -0.36 + i * 0.075, y, 0)
  }
  const sofa = () => { // base, 2 seat cushions, back, arms, little feet
    legs4('walnut', 1.7, 0.8, 0.1, 0.05)
    r('fabric', 1.7, 0.28, 0.8, 0, 0.1, 0, 0.06)
    for (const sx of [-0.39, 0.39]) r('fabric', 0.74, 0.14, 0.62, sx, 0.38, 0.06, 0.06)
    r('fabric', 1.7, 0.46, 0.2, 0, 0.38, -0.3, 0.08)
    for (const sx of [-0.8, 0.8]) r('fabric', 0.16, 0.32, 0.8, sx, 0.38, 0, 0.07)
    for (const sx of [-0.55, 0.55]) r('cushion', 0.36, 0.32, 0.12, sx, 0.52, -0.16, 0.05) // throw pillows
  }
  const armchair = () => {
    legs4('walnut', 0.8, 0.78, 0.1, 0.05)
    r('blue', 0.8, 0.28, 0.78, 0, 0.1, 0, 0.06); r('blue', 0.56, 0.12, 0.6, 0, 0.38, 0.06, 0.05)
    r('blue', 0.8, 0.48, 0.18, 0, 0.38, -0.3, 0.07); for (const sx of [-0.33, 0.33]) r('blue', 0.16, 0.26, 0.78, sx, 0.38, 0, 0.06)
    r('cushion', 0.34, 0.3, 0.1, 0, 0.5, -0.18, 0.04)
  }
  const plant = (s = 1) => { c('pot', 0.16 * s, 0.12 * s, 0.3 * s, 0, 0, 0); push('leaf', new THREE.IcosahedronGeometry(0.26 * s, 0), 0, 0.55 * s, 0); push('leaf', new THREE.IcosahedronGeometry(0.18 * s, 0), 0.1 * s, 0.82 * s, 0.05) }
  const rug = (w: number, d: number, mat: Mat = 'rug') => { b(mat, w, 0.015, d, 0, 0.005, 0); b('white', w - 0.2, 0.004, 0.04, 0, 0.02, d / 2 - 0.15); b('white', w - 0.2, 0.004, 0.04, 0, 0.02, -d / 2 + 0.15) }
  const tv = () => { // low media stand with doors, flat TV on a foot
    b('walnut', 1.5, 0.45, 0.42, 0, 0.06, 0); legs4('metal', 1.5, 0.42, 0.06, 0.03)
    for (const sx of [-0.37, 0.37]) b('oak', 0.7, 0.36, 0.01, sx, 0.1, 0.21)
    b('metal', 0.3, 0.02, 0.18, 0, 0.51, 0); b('metal', 0.05, 0.12, 0.03, 0, 0.53, 0)
    b('screen', 1.2, 0.7, 0.04, 0, 0.62, 0)
    screens.push({ x: px + Math.sin(pry) * 0.025, y: 0.97, z: pz + Math.cos(pry) * 0.025, ry: pry, width: 1.12 })
  }
  const dresser = () => { b('white', 1.1, 0.8, 0.45, 0, 0.08, 0); legs4('oak', 1.1, 0.45, 0.08, 0.04); for (const y of [0.22, 0.47, 0.72]) b('oak', 0.2, 0.03, 0.02, 0, y, 0.23) }
  const coffeeTable = () => table(0.9, 0.5, 0.4, 'walnut')
  const art = () => { b('walnut', 0.8, 0.6, 0.03, 0, 1.4, 0); b('rug2', 0.68, 0.48, 0.01, 0, 1.46, 0.02); b('pot', 0.3, 0.18, 0.012, 0.1, 1.55, 0.025) }

  // ---- Ladder unlocks (house is 20 x 15; door on the west wall at z 0; walk lane z -1..0.4 kept clear) ----
  const T: Array<{ items: string[]; place: () => void }> = [
    { items: ['Twin bed', 'Nightstand + table lamp', 'Desk chair', 'Bedroom rug', 'Armchair corner'], place: () => {
      piece(1.0, 6.35, Math.PI, 0.6, 1.05, () => bed(1.0))
      piece(2.0, 7.0, 0, 0.25, 0.22, () => { nightstand(); tableLamp(0.54) })
      piece(1.0, 4.4, 0, 0, 0, () => rug(2.0, 1.3), false)
      piece(-1.4, 2.75, Math.PI, 0.24, 0.24, () => chair()); sit('desk', 'Desk chair', -1.4, 2.75, Math.PI, 0.48)
      // Starter living corner: an armchair, side table with a lamp, a rug and a plant, so the first home reads as lived-in.
      piece(-2.6, -3.0, 0, 0, 0, () => rug(2.2, 1.6), false)
      piece(-3.4, -3.3, Math.PI / 2, 0.42, 0.42, () => armchair()); sit('arm0', 'Armchair', -3.4, -3.3, Math.PI / 2, 0.48)
      piece(-3.4, -4.3, 0, 0.22, 0.22, () => { table(0.4, 0.4, 0.5, 'walnut'); tableLamp(0.5) })
      piece(-4.8, -6.8, 0, 0.2, 0.2, () => plant())
    } },
    { items: ['Small dining table + 2 chairs', 'Wall shelf with books'], place: () => {
      piece(-6.0, 4.4, 0, 0.62, 0.42, () => table(1.2, 0.8, 0.76))
      piece(-6.0, 3.6, 0, 0.24, 0.24, () => chair()); sit('din1', 'Dining chair', -6.0, 3.6, 0, 0.48)
      piece(-6.0, 5.2, Math.PI, 0.24, 0.24, () => chair()); sit('din2', 'Dining chair', -6.0, 5.2, Math.PI, 0.48)
      piece(-1.4, 7.35, 0, 0, 0, () => shelf(), false)
    } },
    { items: ['Two-seat sofa', 'Coffee table', 'Living-room rug', 'Potted plant'], place: () => {
      piece(-0.5, -3.2, 0, 0, 0, () => rug(3.0, 2.0, 'rug2'), false)
      piece(-0.5, -2.0, Math.PI, 0.88, 0.42, () => sofa())
      sit('sofa-l', 'Sofa', -0.9, -2.05, Math.PI, 0.5); sit('sofa-r', 'Sofa', -0.1, -2.05, Math.PI, 0.5)
      piece(-0.5, -3.4, 0, 0.47, 0.27, () => coffeeTable())
    } },
    { items: ['TV on media stand', 'Floor lamp'], place: () => {
      piece(-0.5, -7.1, 0, 0.77, 0.24, () => tv())
      piece(2.0, -2.0, 0, 0.2, 0.2, () => floorLamp())
    } },
    { items: ['Bookcase', 'Two more dining chairs', 'Second plant'], place: () => {
      piece(3.7, -7.1, 0, 0.48, 0.18, () => bookcase())
      piece(-7.0, 4.4, Math.PI / 2, 0.24, 0.24, () => chair()); sit('din3', 'Dining chair', -7.0, 4.4, Math.PI / 2, 0.48)
      piece(-5.0, 4.4, -Math.PI / 2, 0.24, 0.24, () => chair()); sit('din4', 'Dining chair', -5.0, 4.4, -Math.PI / 2, 0.48)
      piece(-3.2, 7.0, 0, 0.2, 0.2, () => plant(1.2))
    } },
    { items: ['Full-size bed upgrade', 'Dresser', 'Framed wall art'], place: () => {
      piece(3.9, 3.0, -Math.PI / 2, 0.57, 0.25, () => dresser())
      piece(-0.5, 1.1, Math.PI, 0, 0, () => art(), false) // on the living|bedroom partition, living side
    } },
  ]
  const lvl = Math.max(0, Math.min(tier, T.length - 1))
  for (let i = 0; i <= lvl; i++) {
    if (i === 0 && lvl >= 5) { // full bed replaces the twin
      piece(1.0, 6.35, Math.PI, 0.8, 1.05, () => bed(1.4))
      piece(2.2, 7.0, 0, 0.25, 0.22, () => { nightstand(); tableLamp(0.54) })
      piece(1.0, 4.4, 0, 0, 0, () => rug(2.2, 1.3), false)
      piece(-1.4, 2.75, Math.PI, 0.24, 0.24, () => chair()); sit('desk', 'Desk chair', -1.4, 2.75, Math.PI, 0.48)
      piece(-2.6, -3.0, 0, 0, 0, () => rug(2.2, 1.6), false)
      piece(-3.4, -3.3, Math.PI / 2, 0.42, 0.42, () => armchair()); sit('arm0', 'Armchair', -3.4, -3.3, Math.PI / 2, 0.48)
      piece(-3.4, -4.3, 0, 0.22, 0.22, () => { table(0.4, 0.4, 0.5, 'walnut'); tableLamp(0.5) })
      piece(-4.8, -6.8, 0, 0.2, 0.2, () => plant())
      continue
    }
    T[i].place()
  }

  const group = new THREE.Group()
  for (const [mat, geos] of parts) {
    const mesh = new THREE.Mesh(mergeGeometries(geos)!, MATS[mat]())
    mesh.castShadow = mat !== 'rug' && mat !== 'rug2'
    mesh.receiveShadow = true
    group.add(mesh)
    for (const g of geos) g.dispose()
  }
  const dispose = () => group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() } })
  return { group, obstacles, seats, screens, dispose }
}

export const FURNITURE_TIERS: FurnitureTier[] = ['Twin bed, nightstand + table lamp, desk chair, bedroom rug, armchair corner with lamp and plant', 'Small dining table + 2 chairs, wall shelf with books', 'Two-seat sofa, coffee table, living-room rug, potted plant', 'TV on media stand, floor lamp', 'Bookcase, two more dining chairs, second plant', 'Full-size bed upgrade, dresser, framed wall art']
  .map((s, i) => ({ rank: RANKS[i]?.label ?? `Tier ${i}`, items: s.split(', ') }))
