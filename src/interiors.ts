import * as THREE from 'three'
import { ownedHouseItems } from './career.ts'
import { pbrSet } from './pbrTex.ts'
import type { Obstacle } from './physics.ts'
import { claimHouse, finishGym, getSave, setTime, sitPrayer, walkGym } from './state.ts'
import { passedCount } from './certs.ts'
import { seatSpot, type Seat } from './seating.ts'
import { createTvScreen } from './tv.ts'
import { animateWater } from './water.ts'
import { RANKS, rankFor } from './logic.ts'
import { buildHomeFurniture } from './homeFurniture.ts'
import { MEN, posedHuman } from './humans.ts'
import { paintSchedule } from './events.ts'

// Walk-in 3D rooms. Built lazily far outside the city (fog hides the street), one shared lamp.
export type RoomId = 'house' | 'gym' | 'boutique' | 'mosque' | 'trading' | 'campus' | 'studio' | 'conference' | 'lounge'
export type Use = { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; run: () => void; exit?: boolean }
type Hooks = { toast: (t: string) => void; openPanel: (p: 'profile' | 'boutique' | 'trade' | 'learn' | 'bounty' | 'conference') => void; onLook: () => void; busy: (seconds: number, x: number, z: number, faceYaw: number) => void; sit: (seat: Seat) => void; rankIndex?: () => number; openCareer?: (tab?: string) => void; openCerts?: () => void }

const ORIGIN: Record<RoomId, { x: number; z: number }> = { house: { x: 400, z: 0 }, gym: { x: 400, z: 60 }, boutique: { x: 400, z: 120 }, mosque: { x: 400, z: 180 }, trading: { x: 460, z: 0 }, campus: { x: 460, z: 60 }, studio: { x: 460, z: 120 }, conference: { x: 460, z: 180 }, lounge: { x: 520, z: 0 } }
const DOOR_Z: Partial<Record<RoomId, number>> = { house: -2.2 }
const SIZE: Record<RoomId, { w: number; d: number }> = { house: { w: 20, d: 15 }, gym: { w: 15, d: 11 }, boutique: { w: 12, d: 9 }, mosque: { w: 16, d: 12 }, trading: { w: 18, d: 13 }, campus: { w: 17, d: 13 }, studio: { w: 14, d: 10 }, conference: { w: 18, d: 14 }, lounge: { w: 16, d: 12 } }
// Street side: building centre and door hotspot id.
export const STREET: Record<RoomId, { spot: string; cx: number; cz: number }> = {
  house: { spot: 'yours', cx: 36, cz: 32 },
  gym: { spot: 'gym', cx: -22, cz: -22 },
  boutique: { spot: 'boutique', cx: 22, cz: -22 },
  mosque: { spot: 'prayer', cx: -24, cz: 27 },
  trading: { spot: 'trade', cx: -48, cz: 0 },
  campus: { spot: 'learn', cx: 0, cz: -48 },
  studio: { spot: 'bounty', cx: 48, cz: 0 },
  conference: { spot: 'conference', cx: 16, cz: -54 },
  lounge: { spot: 'lounge', cx: -40, cz: -36 },
}

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function createInteriors(scene: THREE.Scene, hooks: Hooks) {
  const built = new Map<RoomId, { group: THREE.Group; obstacles: Obstacle[]; uses: Use[] }>()
  const lamp = new THREE.PointLight(0xffd29a, 0, 18, 1.6)
  lamp.position.set(0, -50, 0)
  scene.add(lamp)
  // Indoors always reads clearly: soft room fill independent of the street's time of day.
  const roomFill = new THREE.HemisphereLight(0xfff3e2, 0x5a4636, 0)
  roomFill.position.set(0, -50, 0)
  scene.add(roomFill)
  let inside: RoomId | null = null
  const gymDone = new Set<string>()
  let cvTex: THREE.CanvasTexture | null = null
  const paintCv = (g: CanvasRenderingContext2D) => {
    const s = getSave()
    g.fillStyle = '#f5f2ea'; g.fillRect(0, 0, 512, 320)
    g.fillStyle = '#14110e'; g.font = '700 40px -apple-system, Inter, sans-serif'; g.fillText(`${s.name || 'Your'} · CV`, 28, 64)
    g.font = '500 26px -apple-system, Inter, sans-serif'; g.fillStyle = '#5b5348'
    g.fillText(`@${s.username || 'guest'} · ${rankFor(s.xp).label}`, 28, 110)
    g.fillText(`Courses passed: ${passedCount()}`, 28, 160)
    g.fillText(passedCount() >= 3 ? 'CV page unlocked' : `CV page unlocks at 3`, 28, 200)
    g.fillStyle = '#c9a25e'; g.fillRect(28, 236, 456, 6)
  }

  // Home: ladder-tiered furniture (homeFurniture.ts) and a simple second floor reached by the stairs.
  const UP = { x: 400, z: -40, w: 12, d: 9 }
  let floorLevel = 0
  let savedFog: THREE.Scene['fog'] = null
  let savedEnv = 1
  let homeFurn: { tier: number; group: THREE.Group; obstacles: Obstacle[]; uses: Use[]; dispose: () => void } | null = null
  let upper: { group: THREE.Group; obstacles: Obstacle[]; uses: Use[] } | null = null
  const rankIndex = () => Math.max(0, RANKS.findIndex((r) => r.id === rankFor(getSave().xp).id))
  const syncFurniture = (house: THREE.Group) => {
    const items = ownedHouseItems()
    const tier = rankIndex() * 100 + items.length
    if (homeFurn?.tier === tier) return
    if (homeFurn) { house.remove(homeFurn.group); homeFurn.dispose() }
    const f = buildHomeFurniture(rankIndex(), ORIGIN.house.x, ORIGIN.house.z)
    // Season track rewards appear in the home: plant, reading lamp, kilim rug.
    const extra: Array<THREE.BufferGeometry | THREE.Material> = []
    const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); f.group.add(me); extra.push(g, m); return me }
    if (items.includes('house-rug')) { const r = put(new THREE.PlaneGeometry(3.2, 2.1), std(0x7a3b2a, 0.95), 1.5, 0.015, 2.2); r.rotation.x = -Math.PI / 2; put(new THREE.PlaneGeometry(2.6, 1.5), std(0xc9a46a, 0.95), 1.5, 0.02, 2.2).rotation.x = -Math.PI / 2 }
    if (items.includes('house-plant')) { put(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 10), std(0xd8d2c6, 0.6), -8.6, 0.25, 6.4); for (const [dx, dy, s] of [[0, 1.1, 0.5], [0.15, 1.55, 0.38], [-0.12, 1.35, 0.34]]) put(new THREE.IcosahedronGeometry(s, 0), std(0x3f5a34, 0.85), -8.6 + dx, dy, 6.4) }
    if (items.includes('house-lamp')) { put(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), std(0x4e3626, 0.5), 8.6, 0.75, -6.3); put(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.9, emissive: 0xffd8a0, emissiveIntensity: 0.25 }), 8.6, 1.55, -6.3); put(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), std(0x4e3626, 0.5), 8.6, 0.02, -6.3) }

    const fUses: Use[] = f.seats.map((st) => { const sp = seatSpot(`house-seat-${st.id}`, st.title, { x: ORIGIN.house.x + st.x, z: ORIGIN.house.z + st.z, yaw: st.yaw, y: st.y }, hooks.sit, 1.3); return { ...sp, run: sp.use } as Use })
    for (const sc of f.screens) {
      const t = createTvScreen(sc.width)
      t.mesh.position.set(sc.x, sc.y, sc.z)
      t.mesh.rotation.y = sc.ry
      f.group.add(t.mesh)
      fUses.push({ id: 'house-tv', x: ORIGIN.house.x + sc.x, z: ORIGIN.house.z + sc.z + 1.2, r: 0.9, title: 'TV', body: 'City news and your file.', enter: 'Switch channel', run: t.toggle } as Use)
    }
    house.add(f.group)
    homeFurn = { tier, group: f.group, obstacles: f.obstacles, uses: fUses, dispose: f.dispose }
  }
  const buildUpper = () => {
    const group = new THREE.Group()
    group.position.set(UP.x, 0, UP.z)
    const obstacles: Obstacle[] = []
    const uses: Use[] = []
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; group.add(m); return m }
    const { w, d } = UP
    // Same oak boards and plaster grain as the ground floor (the upstairs room was flat colour; 8 Nov recording).
    const upFloor = std(0x8a6243, 0.6)
    Object.assign(upFloor, pbrSet('wood_floor', 4), { roughness: 1 })
    mk(new THREE.PlaneGeometry(w, d), upFloor, 0, 0.01, 0).rotation.x = -Math.PI / 2
    const wall = std(0xe9e0d0, 0.92)
    wall.map = pbrSet('plastered_wall_04', 2).map
    mk(new THREE.BoxGeometry(w + 0.5, 3.2, 0.25), wall, 0, 1.6, -d / 2 - 0.125); mk(new THREE.BoxGeometry(w + 0.5, 3.2, 0.25), wall, 0, 1.6, d / 2 + 0.125)
    mk(new THREE.BoxGeometry(0.25, 3.2, d), wall, -w / 2 - 0.125, 1.6, 0); mk(new THREE.BoxGeometry(0.25, 3.2, d), wall, w / 2 + 0.125, 1.6, 0)
    mk(new THREE.BoxGeometry(1.8, 1.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xbfd8ea, emissive: 0x8fb4cf, emissiveIntensity: 0.12, roughness: 0.1 }), 1.5, 1.5, -d / 2 + 0.02)
    // Stair opening (railing + top steps) in the west end.
    const rail = std(0x6b4e37, 0.6)
    mk(new THREE.BoxGeometry(1.2, 0.05, 2.2), std(0x3a2a20, 0.8), -w / 2 + 1.0, 0.02, 2.4)
    mk(new THREE.BoxGeometry(0.06, 0.95, 2.2), rail, -w / 2 + 1.65, 0.48, 2.4)
    obstacles.push({ kind: 'box', x: UP.x - w / 2 + 1.0, z: UP.z + 2.4, hx: 0.7, hz: 1.15 })
    // Perimeter walls block like the ground floor.
    for (const sz of [-1, 1]) obstacles.push({ kind: 'box', x: UP.x, z: UP.z + sz * (d / 2 + 0.125), hx: w / 2 + 0.3, hz: 0.18 })
    for (const sx of [-1, 1]) obstacles.push({ kind: 'box', x: UP.x + sx * (w / 2 + 0.125), z: UP.z, hx: 0.18, hz: d / 2 + 0.3 })
    uses.push({ id: 'stairs-down', x: UP.x - w / 2 + 1.0, z: UP.z + 0.6, r: 0.9, title: 'Stairs', body: 'Back down to the ground floor.', enter: 'Go downstairs', run: () => goFloor(0) } as Use)
    const bulb = new THREE.MeshStandardMaterial({ color: 0xfff1d8, emissive: 0xffd9a0, emissiveIntensity: 0.55 })
    mk(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), bulb, 0, 3.15, 0)
    group.visible = false
    scene.add(group)
    return { group, obstacles, uses }
  }
  const goFloor = (n: number) => {
    const house = built.get('house')
    if (!house) return
    upper ??= buildUpper()
    floorLevel = n
    house.group.visible = n === 0
    upper.group.visible = n === 1
    if (n === 1) {
      lamp.position.set(UP.x, 2.9, UP.z)
      hooks.busy(0.3, UP.x - UP.w / 2 + 1.0, UP.z + 0.2, Math.PI / 2)
      hooks.toast('Second floor. Room to grow as you climb the ladder.')
    } else {
      lamp.position.set(ORIGIN.house.x, 2.9, ORIGIN.house.z)
      hooks.busy(0.3, ORIGIN.house.x + 5.3, ORIGIN.house.z - 0.2, 0)
    }
  }

  const build = (id: RoomId) => {
    const o = ORIGIN[id]
    const { w, d } = SIZE[id]
    const group = new THREE.Group()
    group.position.set(o.x, 0, o.z)
    const obstacles: Obstacle[] = []
    const uses: Use[] = []
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, block = false, ry = 0) => {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.y = ry
      m.castShadow = true
      m.receiveShadow = true
      group.add(m)
      if (block && geo instanceof THREE.BoxGeometry) {
        const p = geo.parameters
        const sw = Math.abs(Math.cos(ry)) > 0.5
        obstacles.push({ kind: 'box', x: o.x + x, z: o.z + z, hx: (sw ? p.width : p.depth) / 2 + 0.05, hz: (sw ? p.depth : p.width) / 2 + 0.05 })
      }
      return m
    }
    const box = (bw: number, bh: number, bd: number, mat: THREE.Material, x: number, z: number, y = 0, block = true, ry = 0) =>
      add(new THREE.BoxGeometry(bw, bh, bd), mat, x, y + bh / 2, z, block, ry)
    const use = (u: Omit<Use, 'x' | 'z'> & { x: number; z: number }) => uses.push({ ...u, x: o.x + u.x, z: o.z + u.z })
    // Seats: room-local position, facing yaw, seat-top height. Tap or E sits; any move stands.
    const seat = (sid: string, title: string, x: number, z: number, yaw: number, y: number) => {
      const sp = seatSpot(`${id}-seat-${sid}`, title, { x: o.x + x, z: o.z + z, yaw, y }, hooks.sit, 1.3)
      uses.push({ ...sp, run: sp.use })
    }
    const tv = (x: number, y: number, z: number, width: number, ry = 0) => {
      const t = createTvScreen(width)
      t.mesh.position.set(x, y, z)
      t.mesh.rotation.y = ry
      group.add(t.mesh)
      return t
    }

    // Shell: floor, skirting, four walls, ceiling beams, exit door on the west wall.
    const floorMat = id === 'gym' ? std(0x2b2d30, 0.95) : id === 'trading' ? std(0x23262a, 0.5, 0.1) : id === 'campus' ? std(0x9a7550, 0.62) : id === 'conference' ? std(0x5b4636, 0.7) : std(id === 'house' ? 0x8a6243 : 0xd9d2c6, 0.6)
    // Real oak boards (Poly Haven wood_floor, CC0) on the warm floors; plaster grain on the walls.
    if (id === 'house' || id === 'campus' || id === 'conference') Object.assign(floorMat, pbrSet('wood_floor', Math.max(2, Math.round(w / 3))), { roughness: 1 })
    const floor = add(new THREE.PlaneGeometry(w, d), floorMat, 0, 0.01, 0)
    floor.rotation.x = -Math.PI / 2
    const wallMat = std(id === 'gym' ? 0xb9b4ac : id === 'house' ? 0xe9e0d0 : id === 'trading' ? 0x3b3f44 : id === 'studio' ? 0xd8d2c8 : id === 'conference' ? 0x2f3338 : id === 'boutique' ? 0xeedfd6 : 0xf1ebe2, 0.92)
    // Home: cutaway-height walls and no beams, so the phone's high follow camera sees over them.
    // Faceted plaster: big soft planes of tone on every wall (flat colour, no photo texture).
    wallMat.map = pbrSet('plastered_wall_04', 2).map
    const H = id === 'house' ? 2.6 : 3.2
    const T = 0.25
    box(w + T * 2, H, T, wallMat, 0, -d / 2 - T / 2)
    box(w + T * 2, H, T, wallMat, 0, d / 2 + T / 2)
    box(T, H, d, wallMat, w / 2 + T / 2, 0)
    box(T, H, d, wallMat, -w / 2 - T / 2, 0)
    const trim = std(0xc9a25e, 0.45, 0.8)
    for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) box(w, 0.12, 0.04, trim, 0, z, 0, false)
    if (id !== 'house') for (let x = -w / 2 + 2; x < w / 2; x += 3) box(0.22, 0.25, d, std(0x5a4636, 0.8), x, 0, H - 0.25, false)
    // Exit door (double leaf) with brass handle. Home: in the middle of the entry hall's west wall, clear of partitions.
    const DZ = DOOR_Z[id] ?? 0
    const doorMat = std(0x4a3426, 0.6)
    box(0.08, 2.3, 0.75, doorMat, -w / 2 + 0.04, DZ - 0.4, 0, false)
    box(0.08, 2.3, 0.75, doorMat, -w / 2 + 0.04, DZ + 0.4, 0, false)
    box(0.06, 0.06, 0.3, trim, -w / 2 + 0.12, DZ, 1.05, false)
    box(0.1, 0.12, 1.9, doorMat, -w / 2 + 0.05, DZ, 2.3, false) // lintel
    for (const s of [-1, 1]) box(0.1, 2.42, 0.1, doorMat, -w / 2 + 0.05, DZ + s * 0.85, 0, false) // jambs
    const exitSign = add(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(256, 86, (g) => {
      g.fillStyle = '#14110e'; g.fillRect(0, 0, 256, 86); g.fillStyle = '#f2ece0'; g.font = '700 44px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(id === 'house' ? 'EXIT' : 'STREET', 128, 60)
    }) }), -w / 2 + 0.06, Math.min(2.6, H - 0.2), DZ)
    exitSign.rotation.y = Math.PI / 2
    use({ id: `${id}-exit`, x: -w / 2 + 0.9, z: DZ, r: 0.9, title: 'Door', body: 'Back to the street.', enter: 'Go outside', run: () => {}, exit: true })

    // Repeated furniture uses InstancedMesh: one draw call per part, however many seats.
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, spots: Array<[number, number, number, number?]>, blockHalf?: [number, number]) => {
      const im = new THREE.InstancedMesh(geo, mat, spots.length)
      const m4 = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const one = new THREE.Vector3(1, 1, 1)
      spots.forEach(([x, y, z, ry = 0], i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry)
        im.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), q, one))
        if (blockHalf) obstacles.push({ kind: 'box', x: o.x + x, z: o.z + z, hx: blockHalf[0], hz: blockHalf[1] })
      })
      im.castShadow = true
      im.receiveShadow = true
      group.add(im)
      return im
    }
    // Furniture kit: desks and office chairs from a few instanced parts (one draw call per part type),
    // so rooms read as furniture instead of solid blocks. Spots are room-local [x, z, yaw].
    type Spot = [number, number, number?]
    const turn = (x: number, z: number, ry: number): [number, number] => [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)]
    const deskKit = (spots: Spot[], dw: number, dd: number, dh: number, top: THREE.Material, frame: THREE.Material, blockHalf?: [number, number]) => {
      inst(new THREE.BoxGeometry(dw, 0.05, dd), top, spots.map(([x, z, ry = 0]) => [x, dh - 0.025, z, ry]), blockHalf)
      const legs: Array<[number, number, number, number?]> = []
      const panels: Array<[number, number, number, number?]> = []
      for (const [x, z, ry = 0] of spots) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [ox, oz] = turn(sx * (dw / 2 - 0.06), sz * (dd / 2 - 0.06), ry); legs.push([x + ox, (dh - 0.05) / 2, z + oz, ry]) }
        const [px, pz] = turn(0, -(dd / 2 - 0.09), ry)
        panels.push([x + px, dh * 0.62, z + pz, ry])
      }
      inst(new THREE.BoxGeometry(0.05, dh - 0.05, 0.05), frame, legs)
      inst(new THREE.BoxGeometry(dw - 0.2, dh * 0.42, 0.025), top, panels)
    }
    const officeChairs = (spots: Spot[], pad: THREE.Material, frame: THREE.Material) => {
      const backs: Array<[number, number, number, number?]> = spots.map(([x, z, ry = 0]) => { const [ox, oz] = turn(0, 0.22, ry); return [x + ox, 0.74, z + oz, ry] })
      inst(new THREE.BoxGeometry(0.48, 0.07, 0.46), pad, spots.map(([x, z, ry = 0]) => [x, 0.45, z, ry]))
      inst(new THREE.BoxGeometry(0.46, 0.48, 0.05), pad, backs)
      inst(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), frame, spots.map(([x, z]) => [x, 0.22, z]))
      inst(new THREE.CylinderGeometry(0.27, 0.27, 0.035, 10), frame, spots.map(([x, z]) => [x, 0.03, z]))
    }

    if (id === 'house') {
      // Large family house (Lagos Life cutaway reference): entry hall, living room, kitchen + stairs,
      // dining, bedroom with a round bed, indoor pool. Brick perimeter, warm ceiling lights.
      const brick = std(0x8a4a36, 0.9)
      for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) box(w, 0.35, 0.06, brick, 0, z, 0, false)
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) box(0.06, 0.35, d, brick, x, 0, 0, false)
      const part = std(0xe9e0d0, 0.9)
      // Partitions with doorways (blocking).
      box(0.15, H, 4.0, part, -5.5, -5.5)            // hall | living
      box(0.15, H, 4.0, part, 4.5, -5.5)             // living | kitchen
      box(5.0, H, 0.15, part, -7.5, 0.6)             // hall/dining split (west)
      box(6.0, H, 0.15, part, 0.5, 1.2)              // living | bedroom (doorway at x 4)
      box(3.0, H, 0.15, part, 8.5, -0.8)             // kitchen | pool
      box(0.15, H, 5.0, part, -2.6, 4.9)             // dining | bedroom
      box(0.15, H, 5.0, part, 4.6, 4.9)              // bedroom | pool
      // Entry hall (NW). No car indoors: cars belong on the street and at the dealership. A runner rug, a
      // bench with a shoe shelf under coat pegs, and a console with a plant.
      { const rug = add(new THREE.PlaneGeometry(2.0, 3.8), std(0x8a5a44, 1), -7.8, 0.015, -4.4); rug.rotation.x = -Math.PI / 2; rug.castShadow = false }
      { const inset = add(new THREE.PlaneGeometry(1.7, 3.5), std(0xd8cbb6, 1), -7.8, 0.02, -4.4); inset.rotation.x = -Math.PI / 2; inset.castShadow = false }
      const hallWood = std(0x8a6a4c, 0.65)
      box(1.7, 0.06, 0.42, hallWood, -7.8, -d / 2 + 0.36, 0.42)
      for (const sx of [-0.82, 0.82]) box(0.05, 0.42, 0.4, hallWood, -7.8 + sx, -d / 2 + 0.36, 0, false)
      box(1.6, 0.03, 0.36, hallWood, -7.8, -d / 2 + 0.36, 0.14, false)
      for (const [sx, col] of [[-0.5, 0x2a2c2f], [0, 0x8c5240], [0.5, 0xe8e2d8]] as const) for (const dx of [-0.07, 0.07]) box(0.1, 0.07, 0.26, std(col, 0.8), -7.8 + sx + dx, -d / 2 + 0.36, 0.17, false)
      box(1.7, 0.1, 0.03, hallWood, -7.8, -d / 2 + 0.05, 1.6, false)
      for (const sx of [-0.6, -0.2, 0.2, 0.6]) add(new THREE.CylinderGeometry(0.015, 0.015, 0.09, 6).rotateX(Math.PI / 2), trim, -7.8 + sx, 1.65, -d / 2 + 0.1)
      for (const [sx, col] of [[-0.6, 0x3d5a80], [0.2, 0x6b5a45]] as const) { box(0.34, 0.75, 0.1, std(col, 0.95), -7.8 + sx, -d / 2 + 0.14, 0.86, false); box(0.44, 0.12, 0.1, std(col, 0.95), -7.8 + sx, -d / 2 + 0.14, 1.5, false) }
      seat('hall', 'Hall bench', -7.8, -d / 2 + 0.5, 0, 0.48)
      box(1.1, 0.04, 0.34, hallWood, -9.6, -5.4, 0.78, true, Math.PI / 2)
      for (const sz of [-0.48, 0.48]) box(0.04, 0.78, 0.3, hallWood, -9.6, -5.4 + sz, 0, false, 0)
      add(new THREE.CylinderGeometry(0.11, 0.09, 0.2, 10), std(0xa8664a, 0.9), -9.6, 0.92, -5.4)
      { const leaf = add(new THREE.IcosahedronGeometry(0.2, 0), std(0x4f6b3e, 0.8), -9.6, 1.18, -5.4); leaf.scale.set(1, 1.3, 1) }
      // Living room: rug, L sofa, coffee table, TV wall.
      // Furniture itself is tiered by ladder rank: see homeFurniture.ts (rebuilt on enter).
      use({ id: 'lights', x: -4.8, z: -1.2, r: 0.8, title: 'Light switch', body: 'Dim the house for the evening.', enter: 'Lights to night', run: () => { setTime('night'); hooks.onLook(); hooks.toast('Lamp on. Night in the district.') } })
      // Kitchen (NE): counters, island, fridge, stove; stairs up.
      const steel = std(0xc9ccd0, 0.3, 0.7), dark = std(0x2a2c2f, 0.4, 0.4), worktop = std(0x8a8d90, 0.35, 0.1)
      box(4.6, 0.86, 0.7, std(0xe7e2d8, 0.45), 7.4, -d / 2 + 0.45)
      box(4.66, 0.04, 0.74, worktop, 7.4, -d / 2 + 0.45, 0.86, false)
      for (let k = 0; k < 4; k++) { box(0.02, 0.7, 0.02, dark, 5.7 + k * 1.15, -d / 2 + 0.81, 0.08, false); box(0.16, 0.02, 0.03, steel, 6.2 + k * 1.15, -d / 2 + 0.82, 0.72, false) } // door gaps and pulls
      // Hob: glass plate with four ringed burners. Sink: steel basin with a tap.
      box(0.7, 0.012, 0.56, std(0x1b1c1e, 0.15, 0.6), 6.4, -d / 2 + 0.45, 0.9, false)
      for (const [bx, bz] of [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.13], [0.17, 0.13]] as const) { const ring = add(new THREE.TorusGeometry(0.085, 0.012, 6, 16), steel, 6.4 + bx, 0.915, -d / 2 + 0.45 + bz); ring.rotation.x = Math.PI / 2 }
      box(0.6, 0.02, 0.44, steel, 8.3, -d / 2 + 0.45, 0.895, false)
      box(0.5, 0.012, 0.34, dark, 8.3, -d / 2 + 0.45, 0.906, false)
      box(0.03, 0.22, 0.03, steel, 8.3, -d / 2 + 0.2, 0.9, false); box(0.03, 0.03, 0.16, steel, 8.3, -d / 2 + 0.27, 1.1, false)
      // Fridge-freezer: two doors, bar handles, a dark plinth.
      box(0.9, 2.0, 0.75, steel, w / 2 - 0.55, -4.5)
      box(0.84, 0.012, 0.012, dark, w / 2 - 0.55, -4.118, 1.3, false)
      for (const [hy, hh] of [[1.4, 0.45], [0.55, 0.6]] as const) box(0.03, hh, 0.04, dark, w / 2 - 0.86, -4.1, hy, false)
      box(0.9, 0.08, 0.02, dark, w / 2 - 0.55, -4.12, 0, false)
      // Island: timber base, stone top with an overhang and two stools tucked under it.
      box(1.8, 0.86, 0.9, std(0x5a4030, 0.55), 7.0, -4.2)
      box(2.0, 0.05, 1.1, std(0xe9e3d8, 0.3), 7.0, -4.2, 0.86, false)
      for (const sx of [6.55, 7.45]) { add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14), std(0x3a2a20, 0.7), sx, 0.64, -3.5); add(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6), dark, sx, 0.31, -3.5); add(new THREE.CylinderGeometry(0.15, 0.17, 0.02, 14), dark, sx, 0.01, -3.5) }
      const steps: Array<[number, number, number, number?]> = []
      for (let k = 0; k < 7; k++) steps.push([5.3, 0.12 + k * 0.24, -1.6 - k * 0.32])
      inst(new THREE.BoxGeometry(1.0, 0.24, 0.32), std(0x6b4e37, 0.6), steps, undefined)
      obstacles.push({ kind: 'box', x: o.x + 5.3, z: o.z - 2.6, hx: 0.55, hz: 1.2 })
      use({ id: 'stairs', x: 5.3, z: -0.6, r: 0.9, title: 'Stairs', body: 'Up to the second floor.', enter: 'Go upstairs', run: () => goFloor(1) })
      use({ id: 'kitchen', x: 7.0, z: -3.0, r: 1.2, title: 'Kitchen', body: 'Water and a hot plate. Food is free here.', enter: 'Cook', run: () => hooks.toast('You cooked jollof. Free, and it does not move a chart.') })
      // Dining (SW): round table and four chairs.
      // Wardrobe inside the bedroom, against the dining|bedroom partition; key hook by the front door.
      const WX = -2.2, WZ = 4.4
      box(1.4, 2.2, 0.6, std(0x6b4b36, 0.7), WX, WZ, 0, true, Math.PI / 2)
      // Wardrobe doors: a centre gap, two brass pulls and a cornice so the block reads as a closet.
      box(0.012, 2.05, 0.012, std(0x2e2018, 0.8), WX + 0.305, WZ, 0.08, false)
      for (const dz of [-0.06, 0.06]) box(0.03, 0.22, 0.02, trim, WX + 0.32, WZ + dz, 1.05, false)
      box(0.66, 0.06, 1.46, std(0x4a3426, 0.7), WX, WZ, 2.2, false)
      use({ id: 'closet', x: WX + 0.75, z: WZ, r: 0.9, title: 'Closet', body: 'Change bodies and outfits.', enter: 'Open closet', run: () => hooks.openPanel('boutique') })
      use({ id: 'key', x: -9.2, z: -3.4, r: 0.8, title: 'Key hook', body: getSave().houseClaimed ? 'The key is yours.' : 'The room is empty until you claim it.', enter: 'Take the key', run: () => hooks.toast(claimHouse().message) })
      // Bedroom (S middle): round bed, side tables, desk with the live CV laptop.
      use({ id: 'bed', x: 1.0, z: 4.6, r: 1.1, title: 'Bed', body: 'Sleep and wake to daylight.', enter: 'Sleep', run: () => {
        hooks.sit({ x: ORIGIN.house.x + 1.0, z: ORIGIN.house.z + 4.6, yaw: 0, y: 0.5, pose: 'lie' })
        // Soft dim on this screen only, then wake to daylight. Other players just see you lying down.
        const dim = document.createElement('div')
        dim.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;transition:opacity 1.2s;pointer-events:none;z-index:40'
        document.body.append(dim); requestAnimationFrame(() => { dim.style.opacity = '0.55' })
        window.setTimeout(() => { setTime('day'); hooks.onLook(); dim.style.opacity = '0'; hooks.toast('Morning. You feel rested.'); window.setTimeout(() => dim.remove(), 1300) }, 3500)
      } })
      const deskWood = std(0x8a6a4c, 0.65)
      // Desk on the north wall, mid-room: both doorways (dining at x -2.6, living at x 4) stay clear.
      const DX = 1.3
      box(1.4, 0.04, 0.6, deskWood, DX, 1.65, 0.71)
      for (const sx of [-0.66, 0.66]) box(0.05, 0.71, 0.56, deskWood, DX + sx, 1.65, 0, false)
      obstacles.push({ kind: 'box', x: o.x + DX, z: o.z + 1.65, hx: 0.75, hz: 0.35 })
      box(0.6, 0.03, 0.42, std(0x9aa0a6, 0.3, 0.8), DX, 1.65, 0.76, false)
      cvTex = canvasTex(512, 320, paintCv)
      const screen = add(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshBasicMaterial({ map: cvTex }), DX, 0.97, 1.48)
      screen.rotation.y = Math.PI
      screen.rotation.x = 0.18
      use({ id: 'desk', x: DX, z: 2.6, r: 1.0, title: 'Desk · laptop', body: 'Your CV, live on the screen.', enter: 'Open my CV', run: () => hooks.openPanel('profile') })
      // Indoor pool (SE) with a stone deck.
      box(4.6, 0.04, 5.8, std(0xd8d0c2, 0.7), 7.4, 3.8, 0, false)
      const water = new THREE.MeshStandardMaterial({ color: 0x3f8fb8, emissive: 0x1d5f80, emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.1 })
      const pool = add(new THREE.PlaneGeometry(2.6, 4.6), water, 7.6, 0.06, 4.0)
      pool.rotation.x = -Math.PI / 2
      pool.castShadow = false
      animateWater(pool)
      water.emissiveIntensity = 0.08
      // Slightly inside the water edge so the player can stand right at the rim on the narrow deck.
      obstacles.push({ kind: 'box', x: o.x + 7.6, z: o.z + 4.0, hx: 1.15, hz: 2.15 })
      seat('pool', 'Pool edge', 6.3, 4.0, Math.PI / 2, 0.1)
      // Windows.
      for (const x of [-0.5, 7.0]) box(1.8, 1.2, 0.04, new THREE.MeshStandardMaterial({ color: 0xbfd8ea, emissive: 0x8fb4cf, emissiveIntensity: 0.12, roughness: 0.1 }), x, -d / 2 + 0.02, 1.4, false)
    }

    if (id === 'gym') {
      const black = std(0x16181b, 0.5, 0.3)
      const steel = std(0xb8bec4, 0.25, 0.9)
      const mirror = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.03, metalness: 1 })
      box(10, 2.2, 0.04, mirror, 0.8, -d / 2 + 0.03, 0.4, false)
      for (let i = 0; i < 3; i++) box(1.8, 0.04, 1.0, std(0x2f5c74, 0.9), -3 + i * 2.2, 3.6, 0, false)
      const station = (sid: string, label: string, x: number, z: number, ux: number, uz: number) => use({
        id: sid, x: ux, z: uz, r: 1.0, title: label, body: 'Use each of the four stations for today’s set.', enter: 'Use', run: () => {
          hooks.busy(1.6, o.x + ux, o.z + uz, Math.atan2(x - ux, z - uz))
          gymDone.add(sid)
          if (gymDone.size < 4) hooks.toast(`${label} done · ${gymDone.size}/4 stations`)
          else { gymDone.clear(); hooks.toast(finishGym(8, 8).message) }
        },
      })
      // Treadmills.
      for (const x of [-4.5, -2.6]) {
        box(0.8, 0.18, 1.8, black, x, -3.2)
        box(0.08, 1.2, 0.08, steel, x - 0.35, -3.9, 0.18, false); box(0.08, 1.2, 0.08, steel, x + 0.35, -3.9, 0.18, false)
        box(0.8, 0.25, 0.2, black, x, -3.9, 1.3, false)
      }
      station('treadmill', 'Treadmill', -4.5, -3.2, -4.5, -1.8)
      // Bench press.
      box(0.36, 0.08, 1.45, black, 1.0, -3.0, 0.4) // padded bench on a steel frame
      for (const bz of [-3.6, -2.4]) { box(0.3, 0.4, 0.05, steel, 1.0, bz, 0, false); box(0.5, 0.04, 0.08, steel, 1.0, bz, 0, false) }
      box(2.0, 0.06, 0.06, steel, 1.0, -3.6, 1.05, false)
      for (const x of [0.15, 1.85]) add(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), black, x, 1.08, -3.6).rotation.z = Math.PI / 2
      box(0.08, 1.1, 0.08, steel, 0.4, -3.6, 0, false); box(0.08, 1.1, 0.08, steel, 1.6, -3.6, 0, false)
      station('bench', 'Bench press', 1.0, -3.0, 1.0, -1.6)
      // Squat rack.
      for (const [x, z] of [[4.2, -3.8], [5.6, -3.8], [4.2, -2.6], [5.6, -2.6]]) box(0.1, 2.4, 0.1, steel, x, z, 0, false)
      box(1.6, 0.1, 1.4, steel, 4.9, -3.2, 2.4, false)
      obstacles.push({ kind: 'box', x: o.x + 4.9, z: o.z - 3.2, hx: 0.8, hz: 0.7 })
      box(2.0, 0.06, 0.06, steel, 4.9, -3.2, 1.5, false)
      station('rack', 'Squat rack', 4.9, -3.2, 4.9, -1.8)
      // Dumbbell rack on the east wall.
      box(0.6, 0.8, 3.0, black, w / 2 - 0.5, 1.6)
      for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 10), steel, w / 2 - 0.5, 0.88, 0.4 + i * 0.48).rotation.z = Math.PI / 2
      // Mat station for core work.
      station('mats', 'Mats', -0.8, 3.6, -0.8, 2.4)
      use({ id: 'board', x: -5.6, z: 3.8, r: 0.9, title: 'Whiteboard', body: 'What the set counts.', enter: 'Read', run: () => hooks.toast(walkGym().message) })
      box(0.05, 1.0, 1.6, std(0xf6f6f2, 0.4), -w / 2 + 0.05, 3.8, 1.2, false)
      box(1.7, 1.0, 0.06, std(0x0d0f12, 0.2, 0.5), -3.6, d / 2 - 0.06, 1.7, false)
      const gymTv = tv(-3.6, 2.2, d / 2 - 0.1, 1.6, Math.PI)
      use({ id: 'tv', x: -3.6, z: d / 2 - 1.3, r: 0.9, title: 'TV', body: 'City news while you train.', enter: 'Change channel', run: gymTv.toggle })
    }

    if (id === 'boutique') {
      const rail = std(0xc9a25e, 0.4, 0.85)
      // Fashion-house palette: ivory, blush, champagne, noir, nude, wine, dove grey.
      const colours = [0xf3ece2, 0xe4b9b4, 0xd8c3a0, 0x2a2a2e, 0xc9a08a, 0x6e2533, 0xb8b4b0]
      const garments: Array<{ x: number; z: number; c: number; long: boolean }> = []
      for (const z of [-2.4, 0.4, 3.0]) {
        box(2.6, 0.05, 0.05, rail, 1.2, z, 1.6, false)
        box(0.05, 1.6, 0.05, rail, 0.0, z, 0, false); box(0.05, 1.6, 0.05, rail, 2.4, z, 0, false)
        obstacles.push({ kind: 'box', x: o.x + 1.2, z: o.z + z, hx: 1.35, hz: 0.35 })
        for (let i = 0; i < 7; i++) garments.push({ x: 0.2 + i * 0.33, z, c: colours[(i * 3 + Math.round(z) + 14) % 7] ?? 0x555555, long: (i + Math.round(z)) % 3 === 0 })
      }
      {
        // Each garment: sloped shoulders, a nipped waist and a flared hem, hanging from a brass hook.
        const cut = (hem: number) => {
          const sh = new THREE.Shape([[-0.25, 0.84], [-0.07, 0.9], [0.07, 0.9], [0.25, 0.84], [0.19, 0.55], [0.26, hem], [-0.26, hem], [-0.19, 0.55]].map(([px, py]) => new THREE.Vector2(px!, py!)))
          return new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false }).translate(0, 0, -0.035).rotateY(Math.PI / 2)
        }
        const cloth = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true })
        const tint = new THREE.Color()
        for (const long of [false, true]) {
          const list = garments.filter((g) => g.long === long)
          const im = inst(cut(long ? -0.25 : 0.12), cloth, list.map((g) => [g.x, 0.66, g.z]))
          list.forEach((g, i) => im.setColorAt(i, tint.setHex(g.c)))
        }
        inst(new THREE.TorusGeometry(0.03, 0.006, 5, 10, Math.PI * 1.4).rotateY(Math.PI / 2), rail, garments.map((g) => [g.x, 1.58, g.z]))
      }
      const mirror = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.03, metalness: 1 })
      box(0.06, 2.0, 1.2, mirror, w / 2 - 0.05, -1.5, 0.3, false)
      box(0.1, 2.3, 1.4, rail, w / 2 - 0.1, -1.5, 0.2, false)
      use({ id: 'mirror', x: w / 2 - 1.2, z: -1.5, r: 1.1, title: 'Mirror', body: 'Try on bodies, tints and masks.', enter: 'Try on', run: () => hooks.openPanel('boutique') })
      // Runway: raised ivory stone catwalk with brass edge, soft light strips overhead (emissive, no extra lights).
      const runway = std(0xf4efe8, 0.35)
      box(4.8, 0.16, 1.2, runway, -3.2, -0.6, 0, false)
      box(4.8, 0.02, 0.04, rail, -3.2, -0.6 + 0.62, 0.16, false); box(4.8, 0.02, 0.04, rail, -3.2, -1.22, 0.16, false)
      const soft = new THREE.MeshStandardMaterial({ color: 0xfff6ec, emissive: 0xffeedd, emissiveIntensity: 0.7, roughness: 0.5 })
      for (const x of [-4.8, -3.2, -1.6]) box(0.9, 0.04, 0.5, soft, x, -0.6, 3.05, false)
      // Arched backdrop panel at the runway head.
      box(0.08, 2.6, 1.8, std(0xe9d3cc, 0.9), -w / 2 + 0.06, -0.6, 0, false)
      add(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 20, 1, false, 0, Math.PI), std(0xe9d3cc, 0.9), -w / 2 + 0.06, 2.6, -0.6).rotation.set(Math.PI / 2, 0, Math.PI / 2)
      use({ id: 'runway', x: -1.2, z: -0.6, r: 0.9, title: 'Runway', body: 'Walk the runway in your look.', enter: 'Walk', run: () => { hooks.busy(2.4, o.x - 5.0, o.z - 0.6, -Math.PI / 2); hooks.toast('Runway walk · lights soft, heads turn.') } })
      // Beauty bar: vanity with a lit mirror, opens lips, blush and skin tone.
      box(1.6, 0.8, 0.5, std(0xf4efe8, 0.4), -3.0, d / 2 - 0.4)
      box(1.2, 0.9, 0.04, mirror, -3.0, d / 2 - 0.08, 1.05, false)
      for (const dx of [-0.66, 0.66]) box(0.05, 0.9, 0.05, soft, -3.0 + dx, d / 2 - 0.1, 1.05, false)
      use({ id: 'beauty', x: -3.0, z: d / 2 - 1.3, r: 0.9, title: 'Beauty bar', body: 'Makeup: lip tint and blush, plus skin tone.', enter: 'Sit down', run: () => hooks.openPanel('boutique') })
      // Fitting room with curtain.
      box(1.6, 2.4, 0.06, std(0x6e2c34, 1), w / 2 - 1.0, 3.2, 0, false)
      box(0.06, 2.4, 1.6, wallMat, w / 2 - 1.8, 3.9)
      use({ id: 'fitting', x: w / 2 - 1.0, z: 2.4, r: 0.9, title: 'Fitting room', body: 'Step in and change.', enter: 'Change', run: () => hooks.openPanel('boutique') })
      // Counter.
      box(2.4, 1.0, 0.7, std(0x3a2a20, 0.5), -3.0, -3.6)
      box(2.4, 0.04, 0.75, rail, -3.0, -3.6, 1.0, false)
      // Mannequins: full figures on brass bases, dressed from the rails (an abaya with its hijab, and a suit).
      const figures: Array<[number, THREE.Group]> = [
        [-3.6, posedHuman('woman4', { pose: 'stand', height: 1.7, mono: 0xd9d2c6, look: { top: 0xd4a0b0, robe: true, sleeves: true } })],
        [-2.0, posedHuman('man4', { pose: 'stand', height: 1.8, look: { top: 0x2e3136, bottom: 0x2e3136, shoes: 0x1a1c1f, skin: 0xd9d2c6, hair: 0xd9d2c6 } })],
      ]
      for (const [x, figure] of figures) {
        add(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 20), rail, x, 0.025, 2.4)
        figure.position.set(x, 0.05, 2.4)
        figure.rotation.y = -Math.PI / 2
        group.add(figure)
        obstacles.push({ kind: 'circle', x: o.x + x, z: o.z + 2.4, r: 0.36 })
      }
    }
    if (id === 'mosque') {
      // Qibla wall is the east wall (+x). Carpet rows run north-south, worshippers face +x.
      const carpet = std(0x7a1f2b, 1)
      const stripe = std(0xc9a25e, 0.9)
      box(w - 1.2, 0.02, d - 1.2, carpet, 0.3, 0, 0, false)
      for (let x = -5; x <= 5; x += 1.6) box(0.05, 0.025, d - 1.4, stripe, x, 0, 0, false)
      // Mihrab niche and minbar.
      const niche = std(0xe6dcc6, 0.6)
      box(0.4, 3.0, 1.8, niche, w / 2 - 0.2, 0)
      box(0.05, 2.4, 1.2, std(0x1f3f5a, 0.5), w / 2 - 0.42, 0, 0.1, false)
      add(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), niche, w / 2 - 0.45, 2.5, 0).scale.set(0.4, 1, 1)
      for (let i = 0; i < 5; i++) box(0.5, 0.3 + i * 0.3, 0.9, std(0x5a3f2c, 0.6), w / 2 - 0.9 - i * 0.5, 2.0, 0, i === 0)
      obstacles.push({ kind: 'box', x: o.x + w / 2 - 1.9, z: o.z + 2.0, hx: 1.3, hz: 0.5 })
      // Soft natural light: tall arched windows on the side walls, warm skylight.
      const glass = new THREE.MeshStandardMaterial({ color: 0xf5ead2, emissive: 0xffe9c4, emissiveIntensity: 0.55, roughness: 0.2 })
      for (let x = -5; x <= 5; x += 2.5) for (const side of [-1, 1]) box(1.0, 2.0, 0.04, glass, x, side * (d / 2 - 0.02), 0.9, false)
      // Worshippers: real people from the city's own cast, seated on their heels in two rows facing the qibla.
      // Still figures (no animation), one draw call each.
      const robes = [0xf2efe8, 0xe4dccd, 0x4a4f57, 0x7a6a55, 0x2f3f5c, 0xd9d2c6]
      const skins = [0x8d5a3b, 0xc68a62, 0x5a3825, 0xe0b08e, 0x6f4329, 0xbf8a62]
      let n = 0
      for (const x of [3.2, 1.6]) for (let z = -4.2; z <= 4.2; z += 1.4) {
        const robe = robes[n % robes.length]!
        // Two in three wear a kufi and long shirt in their own colour; the rest came in from the street as they are.
        const man = n % 3 === 2
          ? posedHuman(MEN[(n >> 1) % MEN.length]!, { pose: 'kneel', height: 1.76, look: n % 2 ? { skin: skins[(n * 5) % skins.length]!, hair: 0x16110e } : undefined })
          : posedHuman('kurta', { pose: 'kneel', height: 1.76, look: { top: robe, skin: skins[(n * 5) % skins.length]! } })
        man.position.set(x, 0, z)
        man.rotation.y = Math.PI / 2
        group.add(man)
        obstacles.push({ kind: 'circle', x: o.x + x, z: o.z + z, r: 0.4 })
        n++
      }
      use({ id: 'pray', x: -1.0, z: 0, r: 1.4, title: 'Prayer rows', body: 'Join the back row. Quiet focus for your next course.', enter: 'Pray', run: () => {
        hooks.busy(2.2, o.x - 0.6, o.z, Math.PI / 2)
        hooks.toast(sitPrayer().message)
      } })
      box(1.2, 0.5, 0.4, std(0x5a3f2c, 0.7), -w / 2 + 1.0, -d / 2 + 0.6)
    }

    if (id === 'trading') {
      // Trading floor: six desks with twin screens, a ticker wall, a glass corner office.
      const chart = canvasTex(256, 160, (g) => {
        g.fillStyle = '#0f1216'; g.fillRect(0, 0, 256, 160)
        g.strokeStyle = 'rgba(255,255,255,0.06)'; for (let y = 20; y < 160; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke() }
        let p = 90
        for (let i = 0; i < 22; i++) {
          const n = p + Math.sin(i * 1.7) * 14 + Math.cos(i * 0.6) * 9
          g.fillStyle = n < p ? '#7fae8e' : '#c4776c'
          g.fillRect(10 + i * 11, Math.min(p, n), 7, Math.max(2, Math.abs(n - p)))
          g.fillRect(13 + i * 11, Math.min(p, n) - 5, 1, Math.abs(n - p) + 10)
          p = n
        }
      })
      const screenMat = new THREE.MeshBasicMaterial({ map: chart })
      const deskMat = std(0x6b4e37, 0.45)
      const blackMat = std(0x15171a, 0.4, 0.4)
      const desks: Array<[number, number, number, number?]> = []
      for (const x of [-3.5, 0.5, 4.5]) for (const z of [-2.4, 2.0]) desks.push([x, 0.75 / 2, z])
      // Desk top on four legs with a modesty panel; same footprint and collider as the old solid block.
      deskKit(desks.map(([x, , z]) => [x, z] as Spot), 2.6, 1.0, 0.75, deskMat, blackMat, [1.35, 0.55])
      const screens: Array<[number, number, number, number?]> = []
      const chairs: Spot[] = []
      for (const [x, , z] of desks) { screens.push([x - 0.5, 1.12, z - 0.3], [x + 0.5, 1.12, z - 0.3]); chairs.push([x, z + 0.85]) }
      inst(new THREE.BoxGeometry(0.85, 0.5, 0.04), blackMat, screens)
      inst(new THREE.PlaneGeometry(0.8, 0.45), screenMat, screens.map(([x, y, z]) => [x, y, z + 0.025]))
      // Monitor necks and feet so the screens stand on the desk instead of floating.
      inst(new THREE.BoxGeometry(0.05, 0.14, 0.04), blackMat, screens.map(([x, , z]) => [x, 0.82, z - 0.02]))
      inst(new THREE.BoxGeometry(0.26, 0.02, 0.18), blackMat, screens.map(([x, , z]) => [x, 0.76, z]))
      officeChairs(chairs, std(0x22262b, 0.6), blackMat)
      const keys: Array<[number, number, number, number?]> = desks.map(([x, , z]) => [x, 0.765, z + 0.12])
      inst(new THREE.BoxGeometry(0.45, 0.02, 0.15), std(0x2a2d31, 0.5), keys)
      chairs.forEach(([x, z], i) => seat(`desk${i}`, 'Desk chair', x, z, Math.PI, 0.5))
      // Ticker wall on the north wall.
      const tickerTex = canvasTex(1024, 128, (g) => {
        g.fillStyle = '#121418'; g.fillRect(0, 0, 1024, 128)
        g.font = '600 40px Inter, sans-serif'; let x = 20
        for (const [t, v, up] of [['UNIT', '+1.8%', 1], ['MEME', '-4.2%', 0], ['ETH', '+0.6%', 1], ['BTC', '+0.3%', 1], ['USDC', '0.0%', 1]] as const) {
          g.fillStyle = '#efe9dc'; g.fillText(t, x, 78); x += g.measureText(t).width + 12
          g.fillStyle = up ? '#8fbf9f' : '#d08a7f'; g.fillText(String(v), x, 78); x += g.measureText(String(v)).width + 44
        }
      })
      add(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshBasicMaterial({ map: tickerTex }), 0.5, 2.5, -d / 2 + 0.02)
      add(new THREE.PlaneGeometry(4.2, 1.6), screenMat, 0.5, 1.3, -d / 2 + 0.02)
      // Glass corner office.
      const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ec, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.22 })
      box(0.05, 2.6, 4.0, glassMat, w / 2 - 3.5, d / 2 - 2.0, 0, true)
      box(3.4, 2.6, 0.05, glassMat, w / 2 - 1.7, d / 2 - 4.0, 0, false)
      box(1.6, 0.75, 0.8, deskMat, w / 2 - 1.6, d / 2 - 1.4)
      use({ id: 'desk', x: 0.5, z: 3.2, r: 1.4, title: 'Trading desk', body: 'A practice book in UNIT. A sized plan can count even when the close is red.', enter: 'Open the book', run: () => hooks.openPanel('trade') })
      use({ id: 'ticker', x: 0.5, z: -d / 2 + 1.4, r: 1.6, title: 'Ticker wall', body: 'Prices move. Size moves your result.', enter: 'Read', run: () => hooks.toast('The wall is a mood, not a plan. Size first.') })
    }

    if (id === 'campus') {
      // Lecture hall: tiered benches facing a lectern and a chalkboard, a library wall.
      const wood = std(0x6b4e37, 0.55)
      const benches: Array<[number, number, number, number?]> = []
      const seats: Array<[number, number, number, number?]> = []
      for (let r = 0; r < 4; r++) for (const x of [-3.6, 2.6]) {
        const z = -0.8 + r * 1.5
        benches.push([x, 0.72 / 2, z])
        seats.push([x, 0.22, z + 0.6])
      }
      // Writing desk (top on end panels, modesty panel facing the board) and a slatted bench with a backrest.
      // Same footprint and collider as the old solid rows.
      const dark = std(0x3c2c20, 0.7)
      inst(new THREE.BoxGeometry(4.2, 0.05, 0.5), wood, benches.map(([x, , z]) => [x, 0.695, z]), [2.15, 0.3])
      inst(new THREE.BoxGeometry(0.05, 0.67, 0.48), dark, benches.flatMap(([x, , z]) => [[x - 2.07, 0.335, z], [x + 2.07, 0.335, z]] as Array<[number, number, number]>))
      inst(new THREE.BoxGeometry(4.1, 0.32, 0.025), wood, benches.map(([x, , z]) => [x, 0.5, z - 0.23]))
      inst(new THREE.BoxGeometry(4.0, 0.05, 0.36), dark, seats.map(([x, , z]) => [x, 0.43, z]))
      inst(new THREE.BoxGeometry(4.0, 0.3, 0.04), dark, seats.map(([x, , z]) => [x, 0.68, z + 0.18]))
      inst(new THREE.BoxGeometry(0.05, 0.41, 0.34), dark, seats.flatMap(([x, , z]) => [[x - 1.9, 0.205, z], [x, 0.205, z], [x + 1.9, 0.205, z]] as Array<[number, number, number]>))
      // Lecture seats face the board (north, -z): two places per bench.
      seats.forEach(([x, , z], i) => { seat(`row${i}a`, 'Lecture seat', x - 1.0, z, Math.PI, 0.44); seat(`row${i}b`, 'Lecture seat', x + 1.0, z, Math.PI, 0.44) })
      const board = canvasTex(512, 256, (g) => {
        g.fillStyle = '#1f2a24'; g.fillRect(0, 0, 512, 256)
        g.fillStyle = '#e8e4d8'; g.font = '500 30px Georgia, serif'
        g.fillText('Custody · Risk · Liquidity', 28, 70)
        g.font = '400 22px Georgia, serif'; g.fillText('Not your keys, not your coins.', 28, 130); g.fillText('Size the position before the entry.', 28, 170)
      })
      add(new THREE.PlaneGeometry(6, 2.4), new THREE.MeshStandardMaterial({ map: board, roughness: 0.9 }), -0.5, 1.9, -d / 2 + 0.04)
      box(6.4, 0.12, 0.12, wood, -0.5, -d / 2 + 0.08, 0.64, false)
      box(0.8, 1.1, 0.6, wood, -0.5, -d / 2 + 2.2)
      // Library wall (east): closed back + shelf boards, then packed book spines with varied
      // heights/depths/colours so you cannot see through gaps to a flat colour grid.
      const shelfX = w / 2 - 0.32
      box(0.18, 2.7, 9.2, wood, shelfX + 0.12, 0) // solid back
      box(0.36, 0.08, 9.2, wood, shelfX, 0.04, 0, false) // plinth
      box(0.36, 0.08, 9.2, wood, shelfX, 2.62, 0, false) // crown
      for (let shelf = 0; shelf < 5; shelf++) box(0.34, 0.05, 9.0, wood, shelfX, 0.48 + shelf * 0.5, 0, false)
      // Pack books flush on each shelf board (no gaps). Four height classes x four colours = 8 draws.
      type BookSpot = [number, number, number]
      const tall: BookSpot[] = [], mid: BookSpot[] = [], short: BookSpot[] = [], squat: BookSpot[] = []
      const packs = [tall, mid, short, squat]
      const heights = [0.42, 0.36, 0.30, 0.24]
      const depths = [0.22, 0.20, 0.18, 0.16]
      const widths = [0.16, 0.14, 0.13, 0.15]
      const colours = [
        [0x6e3228, 0x2a3f52, 0x3f5a34, 0x5a3a5c],
        [0x8a5a2c, 0x1f2a3a, 0xb08d57, 0xc4b496],
        [0x4a2c28, 0x2c4a5c, 0x355a40, 0x6b4e37],
        [0x7a3a2c, 0x243040, 0x8a6a3a, 0xd0c4a8],
      ]
      let bi = 0
      for (let shelf = 0; shelf < 5; shelf++) {
        let cursor = -4.35
        while (cursor < 4.35) {
          const k = bi % 4
          const bw = widths[k]!
          const bh = heights[k]!
          const bd = depths[k]!
          const y = 0.48 + shelf * 0.5 + 0.028 + bh / 2
          packs[k]!.push([shelfX - 0.01 - bd / 2, y, cursor + bw / 2])
          cursor += bw + 0.004
          bi += 1
        }
      }
      packs.forEach((spots, k) => {
        if (!spots.length) return
        // Split each height class across its four colours by index.
        colours[k]!.forEach((col, ci) => {
          const subset = spots.filter((_, i) => i % 4 === ci)
          if (!subset.length) return
          inst(new THREE.BoxGeometry(widths[k]!, heights[k]!, depths[k]!), std(col, 0.82), subset)
        })
      })
      const glass = new THREE.MeshStandardMaterial({ color: 0xcfe0ea, emissive: 0x8fb4cf, emissiveIntensity: 0.08, roughness: 0.15, metalness: 0.05 })
      for (const x of [-5, -1, 3]) box(1.8, 1.8, 0.04, glass, x, d / 2 - 0.02, 1.0, false)
      use({ id: 'lectern', x: -0.5, z: -d / 2 + 3.4, r: 1.4, title: 'Lectern', body: 'Twenty short courses. Pass one and it writes your CV, resume, and portfolio.', enter: 'Open the hall', run: () => hooks.openPanel('learn') })
      use({ id: 'library', x: w / 2 - 1.6, z: 0, r: 1.4, title: 'Library', body: 'Every course has a source line. The shelf has the rest.', enter: 'Browse', run: () => hooks.toast('Read the source line under each course. Then do the four exercises.') })
    }

    if (id === 'studio') {
      // Influencer row studio: backdrop + softbox set, podcast table with mics, lounge.
      const fabric = std(0xcfc6b8, 1)
      box(5.0, 3.0, 0.08, std(0x6a5a4c, 1), 2.0, -d / 2 + 0.3, 0, false)
      box(5.0, 0.04, 2.6, std(0x6a5a4c, 1), 2.0, -d / 2 + 1.6, 0, false)
      const soft = new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xfff1dc, emissiveIntensity: 0.6, roughness: 0.6 })
      const stand = std(0x1a1c1f, 0.4, 0.6)
      const tripod = (x: number, z: number, h: number) => {
        // Three splayed legs under a short centre column.
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + 0.5
          const leg = add(new THREE.CylinderGeometry(0.014, 0.014, h * 0.8, 6), stand, x + Math.sin(a) * 0.19, h * 0.36, z + Math.cos(a) * 0.19)
          leg.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5)
        }
        box(0.035, h * 0.34, 0.035, stand, x, z, h * 0.66, false)
      }
      for (const x of [-0.6, 4.6]) {
        const ry = x < 2 ? 0.5 : -0.5
        tripod(x, -d / 2 + 2.8, 1.95)
        // Softbox: black housing tapering back from a glowing diffuser.
        const sb = add(new THREE.CylinderGeometry(0.16, 0.62, 0.36, 4, 1, true).rotateY(Math.PI / 4).rotateX(Math.PI / 2), stand, x - Math.sin(ry) * 0.2, 2.35, -d / 2 + 2.8 + Math.cos(ry) * 0.2, false, ry)
        ;(sb.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
        box(0.86, 0.86, 0.03, soft, x - Math.sin(ry) * 0.02, -d / 2 + 2.8 + Math.cos(ry) * 0.02 - 0.0, 1.92, false, ry)
        obstacles.push({ kind: 'circle', x: o.x + x, z: o.z - d / 2 + 2.8, r: 0.3 })
      }
      // Cinema camera: body, lens with a glass front, matte box, top handle and a small monitor, on a tripod.
      tripod(2.0, -d / 2 + 4.2, 1.45)
      box(0.2, 0.2, 0.34, stand, 2.0, -d / 2 + 4.2, 1.45, false)
      add(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 14).rotateX(Math.PI / 2), std(0x2c2f33, 0.35, 0.7), 2.0, 1.55, -d / 2 + 3.92)
      add(new THREE.CircleGeometry(0.068, 14).rotateY(Math.PI), new THREE.MeshStandardMaterial({ color: 0x20324a, roughness: 0.05, metalness: 0.9 }), 2.0, 1.55, -d / 2 + 3.798)
      box(0.26, 0.2, 0.03, stand, 2.0, -d / 2 + 3.8, 1.45, false)
      box(0.03, 0.05, 0.22, stand, 2.0, -d / 2 + 4.2, 1.67, false)
      box(0.16, 0.1, 0.015, new THREE.MeshStandardMaterial({ color: 0x0c1014, emissive: 0x9fd4ff, emissiveIntensity: 0.5, roughness: 0.3 }), 2.14, -d / 2 + 4.38, 1.62, false, 0.5)
      add(new THREE.SphereGeometry(0.012, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 1.9, 1.62, -d / 2 + 4.38)
      obstacles.push({ kind: 'circle', x: o.x + 2.0, z: o.z - d / 2 + 4.2, r: 0.3 })
      // Podcast table with three mics on arms.
      add(new THREE.CylinderGeometry(1.0, 1.0, 0.06, 32), std(0x3a2a20, 0.4), -3.2, 0.76, 2.2)
      add(new THREE.CylinderGeometry(0.08, 0.12, 0.74, 10), stand, -3.2, 0.37, 2.2)
      obstacles.push({ kind: 'circle', x: o.x - 3.2, z: o.z + 2.2, r: 1.05 })
      const mics: Array<[number, number, number, number?]> = [[-3.2, 0.95, 1.5], [-3.8, 0.95, 2.6], [-2.6, 0.95, 2.6]]
      inst(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 10), stand, mics)
      inst(new THREE.BoxGeometry(0.5, 0.45, 0.5), fabric, [[-3.2, 0.22, 0.8], [-4.4, 0.22, 3.0], [-2.0, 0.22, 3.0]])
      seat('mic1', 'Podcast stool', -3.2, 0.8, 0, 0.45)
      seat('mic2', 'Podcast stool', -4.4, 3.0, Math.atan2(1.2, -0.8), 0.45); seat('mic3', 'Podcast stool', -2.0, 3.0, Math.atan2(-1.2, -0.8), 0.45)
      // Lounge sofa and a framed wall of covers.
      box(2.8, 0.45, 0.9, std(0x3d4a3f, 0.95), 3.6, d / 2 - 0.9)
      box(2.8, 0.5, 0.2, std(0x3d4a3f, 0.95), 3.6, d / 2 - 0.4, 0.45, false)
      for (const x of [3.6 - 1.42, 3.6 + 1.42]) box(0.16, 0.64, 0.9, std(0x34403a, 0.95), x, d / 2 - 0.9, 0, false)
      box(0.015, 0.02, 0.7, std(0x1f2622, 0.9), 3.6, d / 2 - 0.95, 0.45, false)
      seat('lounge-l', 'Sofa', 2.9, d / 2 - 0.95, Math.PI, 0.45); seat('lounge-r', 'Sofa', 4.3, d / 2 - 0.95, Math.PI, 0.45)
      // Monitor wall TV beside the set.
      box(0.06, 1.0, 1.7, std(0x0d0f12, 0.2, 0.5), w / 2 - 0.06, -1.0, 1.4, false)
      const studioTv = tv(w / 2 - 0.1, 1.9, -1.0, 1.6, -Math.PI / 2)
      use({ id: 'tv', x: w / 2 - 1.3, z: -1.0, r: 0.9, title: 'TV', body: 'What the city is talking about.', enter: 'Change channel', run: studioTv.toggle })
      const frames: Array<[number, number, number, number?]> = []
      for (let i = 0; i < 4; i++) frames.push([-w / 2 + 0.06, 1.7, -3 + i * 1.3, Math.PI / 2])
      inst(new THREE.BoxGeometry(1.0, 0.7, 0.04), std(0xc9a25e, 0.4, 0.8), frames)
      use({ id: 'set', x: 2.0, z: -d / 2 + 3.2, r: 1.4, title: 'Studio set', body: 'Write a bounty. Practice pay lands, and the sentence goes on your portfolio.', enter: 'Post a bounty', run: () => hooks.openPanel('bounty') })
      use({ id: 'podcast', x: -3.2, z: 0.6, r: 1.2, title: 'Podcast table', body: 'Three mics. Say what you built, not what you hold.', enter: 'Record', run: () => {
        hooks.busy(1.6, o.x - 3.2, o.z + 0.8, Math.PI)
        hooks.toast('Recorded. Proof of work reads better than a price call.')
      } })
    }
    if (id === 'lounge') {
      // Members' lounge: quiet walnut, leather and brass. Stations unlock by the visitor's rank; friends and guests may walk in.
      const walnut = std(0x4e3626, 0.55), leather = std(0x3a2a20, 0.7), brass = std(0xb08d57, 0.35, 0.6), rugM = std(0x6b4b3a, 0.95)
      const lampGlass = new THREE.MeshStandardMaterial({ color: 0x1f6b4f, emissive: 0x2fae7a, emissiveIntensity: 0.45, roughness: 0.25, side: THREE.DoubleSide })
      const rug = add(new THREE.PlaneGeometry(7, 4.5), rugM, 0, 0.02, 0); rug.rotation.x = -Math.PI / 2
      // Each station opens a real tool: study, practice trading, certificates, Career / Earn Paths.
      const STATIONS: Array<{ sid: string; title: string; rank: number; x: number; z: number; text: string; go: () => void }> = [
        { sid: 'library', title: 'Study desk', rank: 0, x: -5.5, z: -4, text: 'Opens the courses. Pick up where you left off.', go: () => hooks.openPanel('learn') },
        { sid: 'strategy', title: 'Trading desk', rank: 0, x: -1.8, z: -4.6, text: 'Practice trading with in-game balance only.', go: () => hooks.openPanel('trade') },
        { sid: 'trophy', title: 'Trophy wall', rank: 0, x: 1.8, z: -4.6, text: 'Your course certificates, ready to share.', go: () => hooks.openCerts?.() },
        { sid: 'board', title: 'Career board', rank: 0, x: 5.5, z: -4, text: 'Career progress, Earn Paths and jobs.', go: () => hooks.openCareer?.('paths') },
        { sid: 'study', title: 'Weekly planner', rank: 2, x: 5.5, z: 3.5, text: 'This week\u2019s challenges in Career.', go: () => hooks.openCareer?.('weekly') },
        { sid: 'suite', title: 'Mentor suite', rank: 4, x: -5.5, z: 3.5, text: 'Jobs and duties for senior members.', go: () => hooks.openCareer?.('jobs') },
      ]
      const RN = ['Shrimp', 'Crab', 'Fish', 'Dolphin', 'Shark', 'Whale']
      // Writing desks on brass legs with a drawer pedestal; colliders match the old solid blocks.
      deskKit(STATIONS.map((st) => [st.x, st.z] as Spot), 1.6, 0.8, 0.75, walnut, brass, [0.85, 0.45])
      inst(new THREE.BoxGeometry(0.45, 0.6, 0.66), walnut, STATIONS.map((st) => [st.x - 0.5, 0.33, st.z]))
      inst(new THREE.BoxGeometry(0.3, 0.025, 0.02), brass, STATIONS.flatMap((st) => [[st.x - 0.5, 0.5, st.z + 0.335], [st.x - 0.5, 0.25, st.z + 0.335]] as Array<[number, number, number]>))
      for (const st of STATIONS) {
        // Banker's lamp: brass foot and stem, green glass shade.
        add(new THREE.CylinderGeometry(0.07, 0.085, 0.025, 12), brass, st.x + 0.55, 0.763, st.z)
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 6), brass, st.x + 0.55, 0.9, st.z)
        add(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), lampGlass, st.x + 0.55, 1.03, st.z)
        use({ id: `lounge-${st.sid}`, x: st.x, z: st.z + 1, r: 1.2, title: st.title, body: st.rank ? `${RN[st.rank]}+ · ${st.text}` : st.text, enter: 'Open', run: () => {
          const lvl = hooks.rankIndex?.() ?? 0
          if (lvl >= st.rank) st.go()
          else hooks.toast(`${st.title} unlocks at ${RN[st.rank]}. Keep learning and showing up.`)
        } })
      }
      // Trophy wall: brass frames on the north wall behind the trophy station.
      for (let k = 0; k < 4; k++) box(0.55, 0.42, 0.05, brass, 1.0 + k * 0.55, -d / 2 + 0.06, 1.5, false)
      const sofas = [[-2, 1.5, 0], [2, 1.5, 0], [0, 3.2, Math.PI]] as Array<[number, number, number]>
      for (const [x, z, ry] of sofas) { box(1.8, 0.45, 0.8, leather, x, z, 0, true, ry); box(1.8, 0.5, 0.18, leather, x, z + (ry ? -0.35 : 0.35), 0.45, false, ry) }
      // Rolled arms and a seam between the two seat cushions so the blocks read as sofas.
      inst(new THREE.BoxGeometry(0.16, 0.66, 0.8), leather, sofas.flatMap(([x, z, ry]) => [[x - 0.92, 0.33, z, ry], [x + 0.92, 0.33, z, ry]] as Array<[number, number, number, number]>))
      inst(new THREE.BoxGeometry(0.015, 0.02, 0.6), std(0x22180f, 0.8), sofas.map(([x, z, ry]) => [x, 0.455, z + (ry ? 0.05 : -0.05), ry]))
      box(1.2, 0.4, 0.7, walnut, 0, 2.4)
    }
    if (id === 'conference') {
      // Conference centre: raised walnut stage on the north wall, a lectern, one big schedule screen,
      // and five rows of upholstered seats facing it with a centre aisle. Matte materials, one soft screen glow.
      const walnut = std(0x5a3e2b, 0.55)
      const stageZ = -d / 2 + 1.6
      box(11, 0.45, 3.2, walnut, 0, stageZ)
      box(11, 0.06, 0.06, trim, 0, stageZ + 1.6, 0.42, false)
      box(0.9, 1.1, 0.55, walnut, 3.6, stageZ + 0.4, 0.45)
      box(0.5, 0.04, 0.4, trim, 3.6, stageZ + 0.4, 1.55, false)
      // Big screen: framed, matte, gently lit (low emissive), repainted when the room is entered.
      const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 512
      const screenTex = new THREE.CanvasTexture(sc); screenTex.colorSpace = THREE.SRGBColorSpace
      const repaint = () => { paintSchedule(sc.getContext('2d')!, 1024, 512); screenTex.needsUpdate = true }
      repaint()
      group.userData.repaint = repaint
      box(5.9, 2.45, 0.08, std(0x14161a, 0.4, 0.3), 0, -d / 2 + 0.06, 0.62, false)
      add(new THREE.PlaneGeometry(5.6, 2.2), new THREE.MeshStandardMaterial({ map: screenTex, emissiveMap: screenTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.85 }), 0, 1.85, -d / 2 + 0.11)
      // Seats: 5 rows x 2 blocks x 4, instanced (chair base + back), each a sittable spot facing the stage.
      const fabric = std(0x2e3a4a, 0.95)
      const bases: Array<[number, number, number, number?]> = []
      const backs: Array<[number, number, number, number?]> = []
      for (let r = 0; r < 5; r++) {
        const z = -0.6 + r * 1.3
        for (const side of [-1, 1]) for (let c = 0; c < 4; c++) {
          const x = side * (1.3 + c * 0.75)
          bases.push([x, 0.22, z]); backs.push([x, 0.62, z + 0.27])
          seat(`r${r}c${side}${c}`, 'Conference seat', x, z, Math.PI, 0.45)
        }
        for (const side of [-1, 1]) obstacles.push({ kind: 'box', x: o.x + side * 2.425, z: o.z + z + 0.27, hx: 1.5, hz: 0.06 })
      }
      inst(new THREE.BoxGeometry(0.6, 0.44, 0.55), fabric, bases)
      inst(new THREE.BoxGeometry(0.6, 0.5, 0.08), fabric, backs)
      inst(new THREE.BoxGeometry(0.06, 0.66, 0.5), std(0x1a1c1f, 0.5, 0.6), bases.map(([x, , z]) => [x + 0.33, 0.33, z] as [number, number, number]))
      // Warm wall sconces (matte, low glow) and a runner down the aisle.
      const sconce = new THREE.MeshStandardMaterial({ color: 0xf3e6cf, emissive: 0xffe2b8, emissiveIntensity: 0.25, roughness: 0.7 })
      for (const z of [-3, 1, 5]) for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) box(0.06, 0.4, 0.25, sconce, x, z, 2.1, false)
      box(1.2, 0.01, 7.0, std(0x6e2f2a, 1), 0, 2.0, 0.005, false)
      use({ id: 'event-screen', x: 0, z: 1.2 - 2.4, r: 1.6, title: 'Event schedule', body: 'Upcoming AMAs, Spaces-style talks and demo days. Join for in-game cash and reputation.', enter: 'Join event', run: () => hooks.openPanel('conference') })
      use({ id: 'stage', x: 3.6, z: stageZ + 2.2, r: 1.2, title: 'Stage', body: 'The lectern. Speakers stand here on event nights.', enter: 'See the programme', run: () => hooks.openPanel('conference') })
    }
    scene.add(group)
    const entry = { group, obstacles, uses }
    built.set(id, entry)
    return entry
  }

  // Filled rooms: potted plants in the corners, framed art on the back wall, warm pendant shades. Shared geometry,
  // basic emissive shades (no extra lights), built once per room on first entry.
  const propMat = { pot: new THREE.MeshStandardMaterial({ color: 0x7a4e36, roughness: 0.85 }), leaf: new THREE.MeshStandardMaterial({ color: 0x355f3c, roughness: 0.75 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.6 }),
    shade: new THREE.MeshStandardMaterial({ color: 0xf6ecd8, emissive: 0xffd7a0, emissiveIntensity: 0.55, roughness: 0.7, flatShading: true }),
    shadeCap: new THREE.MeshStandardMaterial({ color: 0xb8955a, roughness: 0.4, metalness: 0.8 }),
  }
  const art = [0xb8954e, 0x3a5f8a, 0xa84a38, 0x2f7a58].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }))
  const propGeo = {
    pot: new THREE.CylinderGeometry(0.28, 0.22, 0.45, 10),
    leaf: new THREE.IcosahedronGeometry(0.45, 0),
    frame: new THREE.BoxGeometry(1.3, 0.9, 0.05),
    canvas: new THREE.PlaneGeometry(1.15, 0.75),
    // Globe pendant: a faceted frosted globe under a small brass cup on a thin rod.
    shade: new THREE.IcosahedronGeometry(0.19, 1),
    shadeTop: new THREE.CylinderGeometry(0.05, 0.085, 0.07, 10),
    stem: new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6),
  }
  const addProps = (group: THREE.Group, id: RoomId) => {
    const o = ORIGIN[id], s = SIZE[id]
    group.updateMatrixWorld(true)
    const at = (m: THREE.Object3D, x: number, y: number, z: number) => { m.position.copy(group.worldToLocal(new THREE.Vector3(o.x + x, y, o.z + z))); group.add(m) }
    const hw = s.w / 2 - 0.7, hd = s.d / 2 - 0.7
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      // Skip east-wall pots in campus: they collide with the library wall and read as blank blobs.
      if (id === 'campus' && sx > 0) continue
      at(new THREE.Mesh(propGeo.pot, propMat.pot), sx * hw, 0.22, sz * hd)
      const leaf = new THREE.Mesh(propGeo.leaf, propMat.leaf); leaf.scale.set(1, 1.4, 1); at(leaf, sx * hw, 0.95, sz * hd)
    }
    for (let i = 0; i < 3; i += 1) {
      const x = (i - 1) * s.w * 0.25
      // Art on the back wall; skip campus (chalkboard already owns that wall).
      if (id !== 'campus') {
        at(new THREE.Mesh(propGeo.frame, propMat.frame), x, 1.9, -s.d / 2 + 0.08)
        at(new THREE.Mesh(propGeo.canvas, art[(i + Math.round(s.w)) % art.length]!), x, 1.9, -s.d / 2 + 0.115)
      }
      // The house has cutaway walls and no ceiling, so nothing can hang there: pendants only in roofed rooms.
      if (id === 'house') continue
      const stem = new THREE.Mesh(propGeo.stem, propMat.shadeCap); at(stem, x, 3.05, 0)
      const shade = new THREE.Mesh(propGeo.shade, propMat.shade); at(shade, x, 2.68, 0)
      const cap = new THREE.Mesh(propGeo.shadeTop, propMat.shadeCap); at(cap, x, 2.88, 0)
    }
  }
  return {
    get inside() { return inside },
    roomFor(spotId: string): RoomId | null {
      for (const id of Object.keys(STREET) as RoomId[]) if (STREET[id].spot === spotId) return id
      return null
    },
    enter(id: RoomId): { x: number; z: number; yaw: number } {
      const room = built.get(id) ?? build(id)
      if (!room.group.userData.props && id !== 'house' && id !== 'mosque') { room.group.userData.props = true; addProps(room.group, id) }
      room.group.visible = true
      inside = id
      const o = ORIGIN[id]
      lamp.position.set(o.x, 2.9, o.z)
      if (id === 'house') { syncFurniture(room.group); floorLevel = 0 }
      ;(room.group.userData.repaint as (() => void) | undefined)?.()
      // Indoors: no street fog (it washed the home out to white on phones) and a dimmer HDRI.
      if (scene.fog) { savedFog = scene.fog; scene.fog = null }
      savedEnv = scene.environmentIntensity
      scene.environmentIntensity = Math.min(savedEnv, 0.18)
      // Softer indoor light: previous values (~25 on campus) washed rooms to stark white.
      lamp.intensity = id === 'house' ? 5.5 : 7.5 + SIZE[id].w * 0.28
      lamp.distance = Math.max(16, SIZE[id].w * 1.15)
      roomFill.intensity = id === 'house' ? 0.22 : 0.28
      if (id === 'house' && cvTex) { paintCv((cvTex.image as HTMLCanvasElement).getContext('2d')!); cvTex.needsUpdate = true }
      // Home: spawn a few steps in, facing the rooms (camera behind, toward the door), so the view opens on the interior.
      if (id === 'house') return { x: o.x - SIZE[id].w / 2 + 3.2, z: o.z + DOOR_Z.house!, yaw: Math.PI / 2 }
      return { x: o.x - SIZE[id].w / 2 + 2.0, z: o.z, yaw: -Math.PI / 2 }
    },
    exit(doorX: number, doorZ: number): { x: number; z: number } {
      const id = inside
      inside = null
      lamp.intensity = 0
      roomFill.intensity = 0
      if (savedFog) { scene.fog = savedFog; savedFog = null }
      scene.environmentIntensity = savedEnv
      lamp.position.set(0, -50, 0)
      if (id) built.get(id)!.group.visible = false
      if (upper) upper.group.visible = false
      floorLevel = 0
      const s = id ? STREET[id] : { cx: 0, cz: 0 }
      const dx = doorX - s.cx
      const dz = doorZ - s.cz
      const len = Math.hypot(dx, dz) || 1
      return { x: doorX + (dx / len) * 1.2, z: doorZ + (dz / len) * 1.2 }
    },
    obstacles(): Obstacle[] {
      if (!inside) return []
      if (inside === 'house' && floorLevel === 1 && upper) return upper.obstacles
      return inside === 'house' && homeFurn ? [...built.get(inside)!.obstacles, ...homeFurn.obstacles] : built.get(inside)!.obstacles
    },
    uses() { return inside ? (inside === 'house' && floorLevel === 1 && upper ? upper.uses : inside === 'house' && homeFurn ? [...built.get(inside)!.uses, ...homeFurn.uses] : built.get(inside)!.uses).map((u) => ({ ...u, use: u.exit ? undefined : u.run })) : [] },
    bounds(): { x: number; z: number; hw: number; hd: number } | null {
      if (!inside) return null
      if (inside === 'house' && floorLevel === 1) return { x: UP.x, z: UP.z, hw: UP.w / 2 - 0.5, hd: UP.d / 2 - 0.5 }
      return { ...ORIGIN[inside], hw: SIZE[inside].w / 2 - 0.5, hd: SIZE[inside].d / 2 - 0.5 }
    },
  }
}
