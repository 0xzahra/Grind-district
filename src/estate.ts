// Estate quarter: architect-style villas, a penthouse tower, waterfront marina with promenade + yacht deck,
// a members' lounge, a plaza and a classic stone quad for the campus. Generic designs, no real buildings.
// Geometry is merged per material (about a dozen draw calls); pools and yacht detail only on medium/high.
import * as THREE from 'three'
import { pbrSet } from './pbrTex.ts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { itemModel } from './showcase.ts'
import type { Obstacle } from './physics.ts'
import type { Hotspot } from './world.ts'
import type { Graphics } from './logic.ts'
import { unlocked, UNLOCKS } from './luxury.ts'
import { getSave } from './state.ts'
import { RANKS } from './logic.ts'

/** Footprints kept clear of random trees (centre + half extents). */
export const ESTATE_ZONES = [
  { x: 42, z: -50, hx: 20, hz: 12 }, // marina + promenade + lounge
  { x: 40, z: -34, hx: 6, hz: 6 }, // plaza
  { x: 54, z: -32, hx: 5, hz: 5 }, // penthouse tower
  { x: -45, z: -50, hx: 13, hz: 10 }, // villa row
  { x: 0, z: -40, hx: 11, hz: 4 }, // campus quad
]
export const ESTATE_PINS: Array<[number, number, string]> = [[44, -53, 'Y'], [54, -32, 'P'], [-45, -50, 'V'], [40, -34, '◆'], [0, -57, 'U']]

type Bag = Map<THREE.Material, THREE.BufferGeometry[]>

export function createEstate(scene: THREE.Scene, o: { graphics: Graphics; obstacles: Obstacle[]; hotspots: Hotspot[]; toast: (m: string) => void }): void {
  const hi = o.graphics !== 'low'
  const M = {
    stone: new THREE.MeshStandardMaterial({ color: 0xd9cfbd, roughness: 0.9 }),
    stoneWarm: new THREE.MeshStandardMaterial({ color: 0xc8b391, roughness: 0.92 }),
    plaster: new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.85 }),
    timber: new THREE.MeshStandardMaterial({ ...pbrSet('brown_planks_03', 1), color: 0xc9a27e, roughness: 1 }),
    deck: new THREE.MeshStandardMaterial({ ...pbrSet('brown_planks_03', 1), color: 0xd8b48e, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2b3a44, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6, metalness: 0.4 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb8975a, roughness: 0.4, metalness: 0.8 }),
    lawn: new THREE.MeshStandardMaterial({ ...pbrSet('leafy_grass', 1), color: 0xb6c79a, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x1d4f60, roughness: 0.08, metalness: 0.55, envMapIntensity: 1.4, normalMap: waveNormals(), normalScale: new THREE.Vector2(0.35, 0.35) }),
    pool: new THREE.MeshStandardMaterial({ color: 0x5fb3c8, roughness: 0.1, metalness: 0.1 }),
    hull: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.35, metalness: 0.1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.95 }),
  }
  const bag: Bag = new Map()
  const put = (m: THREE.Material, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => {
    g = g.index ? g.toNonIndexed() : g
    g.rotateY(ry); g.translate(x, y, z)
    if (!bag.has(m)) bag.set(m, [])
    bag.get(m)!.push(g)
  }
  const box = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) => put(m, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry)
  const cyl = (m: THREE.Material, r: number, h: number, x: number, y: number, z: number, seg = 10) => put(m, new THREE.CylinderGeometry(r, r, h, seg), x, y + h / 2, z)
  const block = (x: number, z: number, hx: number, hz: number) => o.obstacles.push({ kind: 'box', x, z, hx, hz })
  const tree = (x: number, z: number, s = 1) => { cyl(M.timber, 0.12 * s, 1.6 * s, x, 0, z, 5); put(M.leaf, new THREE.IcosahedronGeometry(0.9 * s, 0), x, 2.2 * s, z); o.obstacles.push({ kind: 'circle', x, z, r: 0.35 }) }
  const statusSpot = (id: string, unlock: string, x: number, z: number, title: string, open: string) => {
    const u = UNLOCKS.find((k) => k.id === unlock)!
    o.hotspots.push({ id, x, z, r: 2.4, title, body: `${u.where}. Unlocks at ${RANKS[u.rank].label} rank with $${u.cash.toLocaleString()} in-game cash.`, enter: 'Visit', use: () => {
      if (unlocked().includes(unlock)) { o.toast(open); return }
      const s = getSave()
      o.toast(`Locked · needs ${RANKS[u.rank].label} rank and $${u.cash.toLocaleString()} held (you have $${Math.floor(s.ledger).toLocaleString()}).`)
    } })
  }

  // --- Waterfront marina (north-east): basin, timber promenade with a tree boulevard, pier, yacht.
  box(M.water, 36, 0.02, 12.4, 42, 0.02, -53.8)
  box(M.stone, 36, 0.35, 0.6, 42, 0, -47.4) // quay edge
  box(M.deck, 36, 0.12, 4, 42, 0, -45.2) // promenade
  for (let x = 26; x <= 58; x += 4) { tree(x, -42.6, 0.9); if (hi) cyl(M.dark, 0.12, 0.5, x + 2, 0, -47) }
  box(M.deck, 2.2, 0.14, 4.4, 44, 0, -49.6) // pier to the yacht
  block(42, -54, 18, 6.4)
  // Yacht: layered white hull, tinted glass bands, teak deck.
  const yx = 44, yz = -54.6
  box(M.hull, 15, 1.4, 3.8, yx, 0.1, yz)
  put(M.hull, new THREE.ConeGeometry(1.9, 3, 4, 1).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.5, 1), yx + 8.9, 0.85, yz)
  box(M.deck, 14, 0.06, 3.4, yx, 1.5, yz)
  box(M.hull, 8.5, 1.1, 3.0, yx - 1, 1.56, yz)
  box(M.glass, 8.6, 0.45, 3.06, yx - 1, 1.9, yz)
  box(M.hull, 5, 0.9, 2.5, yx - 1.6, 2.66, yz)
  box(M.glass, 5.1, 0.35, 2.56, yx - 1.6, 2.95, yz)
  if (hi) { box(M.brass, 14, 0.05, 0.05, yx, 2.2, yz + 1.85); box(M.brass, 14, 0.05, 0.05, yx, 2.2, yz - 1.85); cyl(M.dark, 0.06, 1.6, yx - 2, 3.5, yz, 6) }
  statusSpot('yacht-deck', 'yacht', 44, -47.2, 'Yacht deck', 'Welcome aboard. The yacht deck is yours to enjoy.')
  // Members' lounge pavilion: glass box under a floating timber roof.
  box(M.stone, 7, 0.3, 5, 28.5, 0, -39.5)
  box(M.glass, 6, 2.8, 4, 28.5, 0.3, -39.5)
  box(M.timber, 8, 0.3, 6, 28.5, 3.1, -39.5)
  block(28.5, -39.5, 3.5, 2.5)
  statusSpot('lounge', 'lounge', 28.5, -36.4, 'Members\u2019 lounge', 'Lounge access confirmed. Take a seat, the view is on the house.')

  // --- Plaza: stone paving, a low round fountain, benches, four trees.
  put(M.stoneWarm, new THREE.CylinderGeometry(5.6, 5.6, 0.06, 28), 40, 0.03, -34)
  cyl(M.stone, 1.6, 0.5, 40, 0, -34, 20); put(M.pool, new THREE.CylinderGeometry(1.35, 1.35, 0.05, 20), 40, 0.5, -34)
  o.obstacles.push({ kind: 'circle', x: 40, z: -34, r: 1.7 })
  for (const [dx, dz] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) tree(40 + dx, -34 + dz, 1.1)

  // --- Penthouse tower: slim stone frame, glass floors, cantilevered glass crown.
  const px = 54, pz = -32
  box(M.stone, 6, 1, 6, px, 0, pz)
  for (let f = 0; f < 7; f++) { box(M.glass, 5.4, 2.8, 5.4, px, 1 + f * 3.2, pz); box(M.plaster, 5.9, 0.4, 5.9, px, 3.8 + f * 3.2, pz) }
  box(M.glass, 7.4, 3, 6.2, px - 0.7, 23.4, pz)
  box(M.timber, 8, 0.35, 6.8, px - 0.7, 26.4, pz)
  block(px, pz, 3.2, 3.2)
  statusSpot('penthouse', 'penthouse', px - 4.4, pz + 2, 'Sky penthouse', 'Lift to the crown. Your penthouse looks over the whole district.')

  // --- Villa row (north-west): stone plinth, glass ground floor, timber-clad cantilevered upper box, pools.
  const villa = (x: number, z: number, flip: number) => {
    box(M.stoneWarm, 10, 0.4, 8, x, 0, z)
    box(M.glass, 6.5, 2.6, 5.5, x - 1.2 * flip, 0.4, z)
    box(M.stone, 1.2, 2.6, 5.5, x + 2.6 * flip, 0.4, z)
    box(M.timber, 9.5, 2.4, 4.6, x + 1.0 * flip, 3.0, z - 0.6) // upper box cantilevers past the base
    box(M.glass, 9.6, 1.4, 0.05, x + 1.0 * flip, 3.5, z + 1.72)
    box(M.plaster, 10.2, 0.25, 5.2, x + 1.0 * flip, 5.4, z - 0.6)
    if (hi) { box(M.stone, 5.2, 0.2, 2.6, x - 1.2 * flip, 0, z + 5.2); box(M.pool, 4.6, 0.06, 2.0, x - 1.2 * flip, 0.2, z + 5.2) }
    block(x, z, 5, 4)
  }
  villa(-52, -54, 1); villa(-38, -54, -1)
  // Supercar garage pad: timber canopy and a low grand tourer.
  box(M.stoneWarm, 6, 0.1, 4, -45, 0, -45)
  for (const [dx, dz] of [[-2.8, -1.8], [2.8, -1.8], [-2.8, 1.8], [2.8, 1.8]]) cyl(M.dark, 0.08, 2.8, -45 + dx, 0, -45 + dz, 6)
  box(M.timber, 6.4, 0.2, 4.4, -45, 2.8, -45)
  block(-45, -45, 2.6, 1.4)
  statusSpot('supercar', 'supercar', -45, -42, 'Supercar garage', 'Keys are yours. Your grand tourer waits under the canopy.')
  o.hotspots.push({ id: 'villas', x: -45, z: -48.5, r: 2.5, title: 'Villa row', body: 'Architect villas: stone, glass and timber, with cantilevered upper floors and pools.' })
  { // The same grand tourer the dealership shows, from the city's own car kit.
    const car = itemModel('tourer')
    car.position.set(-45, 0.1, -45); car.rotation.y = Math.PI / 2
    scene.add(car)
  }

  // --- Campus quad: classic stone portico on the hall, arcades to the wings, clock tower, lawns.
  for (let x = -7; x <= 7; x += 2) if (Math.abs(x) > 2) { cyl(M.stone, 0.28, 4.6, x, 0, -41.9, 12); o.obstacles.push({ kind: 'circle', x, z: -41.9, r: 0.3 }) }
  box(M.stone, 15.6, 0.6, 1.2, 0, 4.6, -41.9)
  put(M.stone, new THREE.CylinderGeometry(0.01, 8.2, 1.4, 3, 1).rotateY(Math.PI / 6).scale(1, 1, 0.12), 0, 5.9, -41.9)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) { const x = s * (8.6 + i * 1.4); cyl(M.stone, 0.22, 3, x, 0, -49.6, 10) }
    box(M.stone, 4.2, 0.7, 1.4, s * 10, 3, -49.6)
    box(M.lawn, 4.8, 0.04, 9, s * 7.6, 0, -34)
  }
  box(M.stone, 3.6, 16, 3.6, 0, 0, -57.4)
  box(M.stoneWarm, 4.2, 0.5, 4.2, 0, 16, -57.4)
  put(M.stone, new THREE.ConeGeometry(2.6, 4.5, 4).rotateY(Math.PI / 4), 0, 18.75, -57.4)
  block(0, -57.4, 1.8, 1.8)
  // Clock faces (canvas, drawn once).
  const cv = document.createElement('canvas'); cv.width = cv.height = 128
  const g2 = cv.getContext('2d')!
  g2.fillStyle = '#f3efe4'; g2.beginPath(); g2.arc(64, 64, 60, 0, 7); g2.fill()
  g2.strokeStyle = '#2a2418'; g2.lineWidth = 4; g2.stroke()
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g2.fillStyle = '#2a2418'; g2.fillRect(64 + Math.sin(a) * 48 - 2, 64 - Math.cos(a) * 48 - 2, 4, 4) }
  g2.lineWidth = 5; g2.beginPath(); g2.moveTo(64, 64); g2.lineTo(64, 28); g2.moveTo(64, 64); g2.lineTo(88, 70); g2.stroke()
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })
  for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), faceMat); const a = (k * Math.PI) / 2; f.position.set(Math.sin(a) * 1.82, 13.5, -57.4 + Math.cos(a) * 1.82); f.rotation.y = a; scene.add(f) }
  o.hotspots.push({ id: 'quad', x: 0, z: -38, r: 2.6, title: 'The quad', body: 'Stone portico, arcades and the clock tower. The old-university heart of the campus.' })

  for (const [mat, list] of bag) {
    const merged = mergeGeometries(list.map((g) => { g.deleteAttribute('uv'); return g }), false)
    if (!merged) continue
    worldUV(merged, mat === M.water ? 0.25 : mat === M.lawn ? 0.5 : 0.6)
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = hi && mat !== M.water && mat !== M.lawn && mat !== M.pool
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    scene.add(mesh)
  }
}

/** Small tiling wave normal map (painted once) so the marina water breaks up its sky reflection. */
function waveNormals(): THREE.Texture {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d')!, img = g.createImageData(S, S)
  const h = (x: number, y: number) => Math.sin((x / S) * Math.PI * 2 * 3 + Math.sin((y / S) * Math.PI * 2 * 2) * 1.5) + 0.6 * Math.sin((y / S) * Math.PI * 2 * 5 + (x / S) * Math.PI * 2)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1)
    const n = new THREE.Vector3(-dx, -dy, 2).normalize(), k = (y * S + x) * 4
    img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1)
  return t
}

/** World-space box-projected UVs (merged geometry is already in world space), metres * scale. */
function worldUV(g: THREE.BufferGeometry, scale: number): void {
  const p = g.getAttribute('position'), n = g.getAttribute('normal')
  if (!p || !n) return
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i))
    const [u, w] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)]
    uv[i * 2] = u * scale; uv[i * 2 + 1] = w * scale
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
