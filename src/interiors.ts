import * as THREE from 'three'
import type { Obstacle } from './physics.ts'
import { claimHouse, finishGym, getSave, setTime, sitPrayer, walkGym } from './state.ts'
import { passedCount } from './certs.ts'
import { seatSpot, type Seat } from './seating.ts'
import { createTvScreen } from './tv.ts'
import { animateWater } from './water.ts'
import { RANKS, rankFor } from './logic.ts'
import { buildHomeFurniture } from './homeFurniture.ts'
import { paintSchedule } from './events.ts'

// Walk-in 3D rooms. Built lazily far outside the city (fog hides the street), one shared lamp.
export type RoomId = 'house' | 'gym' | 'boutique' | 'mosque' | 'trading' | 'campus' | 'studio' | 'conference'
export type Use = { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; run: () => void; exit?: boolean }
type Hooks = { toast: (t: string) => void; openPanel: (p: 'profile' | 'boutique' | 'trade' | 'learn' | 'bounty' | 'conference') => void; onLook: () => void; busy: (seconds: number, x: number, z: number, faceYaw: number) => void; sit: (seat: Seat) => void }

const ORIGIN: Record<RoomId, { x: number; z: number }> = { house: { x: 400, z: 0 }, gym: { x: 400, z: 60 }, boutique: { x: 400, z: 120 }, mosque: { x: 400, z: 180 }, trading: { x: 460, z: 0 }, campus: { x: 460, z: 60 }, studio: { x: 460, z: 120 }, conference: { x: 460, z: 180 } }
const SIZE: Record<RoomId, { w: number; d: number }> = { house: { w: 20, d: 15 }, gym: { w: 15, d: 11 }, boutique: { w: 12, d: 9 }, mosque: { w: 16, d: 12 }, trading: { w: 18, d: 13 }, campus: { w: 17, d: 13 }, studio: { w: 14, d: 10 }, conference: { w: 18, d: 14 } }
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
  const lamp = new THREE.PointLight(0xffe3c0, 0, 18, 1.6)
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
    const tier = rankIndex()
    if (homeFurn?.tier === tier) return
    if (homeFurn) { house.remove(homeFurn.group); homeFurn.dispose() }
    const f = buildHomeFurniture(tier, ORIGIN.house.x, ORIGIN.house.z)
    const fUses: Use[] = f.seats.map((st) => { const sp = seatSpot(`house-seat-${st.id}`, st.title, { x: ORIGIN.house.x + st.x, z: ORIGIN.house.z + st.z, yaw: st.yaw, y: st.y }, hooks.sit, 0.7); return { ...sp, run: sp.use } as Use })
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
    mk(new THREE.PlaneGeometry(w, d), std(0x8a6243, 0.6), 0, 0.01, 0).rotation.x = -Math.PI / 2
    const wall = std(0xe9e0d0, 0.92)
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
      const sp = seatSpot(`${id}-seat-${sid}`, title, { x: o.x + x, z: o.z + z, yaw, y }, hooks.sit, 0.7)
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
    const floor = add(new THREE.PlaneGeometry(w, d), floorMat, 0, 0.01, 0)
    floor.rotation.x = -Math.PI / 2
    const wallMat = std(id === 'gym' ? 0xb9b4ac : id === 'house' ? 0xe9e0d0 : id === 'trading' ? 0x3b3f44 : id === 'studio' ? 0xd8d2c8 : id === 'conference' ? 0x2f3338 : 0xf1ebe2, 0.92)
    // Home: cutaway-height walls and no beams, so the phone's high follow camera sees over them.
    const H = id === 'house' ? 2.6 : 3.2
    const T = 0.25
    box(w + T * 2, H, T, wallMat, 0, -d / 2 - T / 2)
    box(w + T * 2, H, T, wallMat, 0, d / 2 + T / 2)
    box(T, H, d, wallMat, w / 2 + T / 2, 0)
    box(T, H, d, wallMat, -w / 2 - T / 2, 0)
    const trim = std(0xc9a25e, 0.45, 0.8)
    for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) box(w, 0.12, 0.04, trim, 0, z, 0, false)
    if (id !== 'house') for (let x = -w / 2 + 2; x < w / 2; x += 3) box(0.22, 0.25, d, std(0x5a4636, 0.8), x, 0, H - 0.25, false)
    // Exit door (double leaf) with brass handle.
    const doorMat = std(0x4a3426, 0.6)
    box(0.08, 2.3, 0.75, doorMat, -w / 2 + 0.04, -0.4, 0, false)
    box(0.08, 2.3, 0.75, doorMat, -w / 2 + 0.04, 0.4, 0, false)
    box(0.06, 0.06, 0.3, trim, -w / 2 + 0.12, 0, 1.05, false)
    const exitSign = add(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(256, 86, (g) => {
      g.fillStyle = '#14110e'; g.fillRect(0, 0, 256, 86); g.fillStyle = '#f2ece0'; g.font = '700 44px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(id === 'house' ? 'EXIT' : 'STREET', 128, 60)
    }) }), -w / 2 + 0.06, Math.min(2.6, H - 0.2), 0)
    exitSign.rotation.y = Math.PI / 2
    use({ id: `${id}-exit`, x: -w / 2 + 0.9, z: 0, r: 0.9, title: 'Door', body: 'Back to the street.', enter: 'Go outside', run: () => {}, exit: true })

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

    if (id === 'house') {
      // Large family house (Lagos Life cutaway reference): garage, living room, kitchen + stairs,
      // dining, bedroom with a round bed, indoor pool. Brick perimeter, warm ceiling lights.
      const brick = std(0x8a4a36, 0.9)
      for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) box(w, 0.35, 0.06, brick, 0, z, 0, false)
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) box(0.06, 0.35, d, brick, x, 0, 0, false)
      const part = std(0xe9e0d0, 0.9)
      // Partitions with doorways (blocking).
      box(0.15, H, 4.0, part, -5.5, -5.5)            // garage | living
      box(0.15, H, 4.0, part, 4.5, -5.5)             // living | kitchen
      box(5.0, H, 0.15, part, -7.5, 0.6)             // garage/dining split (west)
      box(6.0, H, 0.15, part, 0.5, 1.2)              // living | bedroom (doorway at x 4)
      box(3.0, H, 0.15, part, 8.5, -0.8)             // kitchen | pool
      box(0.15, H, 5.0, part, -2.6, 4.9)             // dining | bedroom
      box(0.15, H, 5.0, part, 4.6, 4.9)              // bedroom | pool
      // Garage (NW) with a parked car.
      box(4.0, 0.02, 5.2, std(0x5d5f62, 0.9), -7.8, -4.4, 0, false)
      box(1.8, 0.55, 3.8, std(0x7a1f24, 0.35, 0.5), -7.8, -4.6, 0.25)
      box(1.5, 0.45, 1.9, std(0x1d2226, 0.1, 0.6), -7.8, -4.9, 0.8, false)
      // Living room: rug, L sofa, coffee table, TV wall.
      // Furniture itself is tiered by ladder rank: see homeFurniture.ts (rebuilt on enter).
      use({ id: 'lights', x: -4.8, z: -1.2, r: 0.8, title: 'Light switch', body: 'Dim the house for the evening.', enter: 'Lights to night', run: () => { setTime('night'); hooks.onLook(); hooks.toast('Lamp on. Night in the district.') } })
      // Kitchen (NE): counters, island, fridge, stove; stairs up.
      box(4.6, 0.9, 0.7, std(0xe7e2d8, 0.45), 7.4, -d / 2 + 0.45)
      box(0.7, 0.04, 0.6, std(0x1b1c1e, 0.3, 0.6), 6.4, -d / 2 + 0.45, 0.9, false)
      box(0.9, 2.0, 0.75, std(0xd9dde0, 0.3, 0.5), w / 2 - 0.55, -4.5)
      box(1.8, 0.9, 0.9, std(0x3a2a20, 0.45), 7.0, -4.2)
      const steps: Array<[number, number, number, number?]> = []
      for (let k = 0; k < 7; k++) steps.push([5.3, 0.12 + k * 0.24, -1.6 - k * 0.32])
      inst(new THREE.BoxGeometry(1.0, 0.24, 0.32), std(0x6b4e37, 0.6), steps, undefined)
      obstacles.push({ kind: 'box', x: o.x + 5.3, z: o.z - 2.6, hx: 0.55, hz: 1.2 })
      use({ id: 'stairs', x: 5.3, z: -0.6, r: 0.9, title: 'Stairs', body: 'Up to the second floor.', enter: 'Go upstairs', run: () => goFloor(1) })
      use({ id: 'kitchen', x: 7.0, z: -3.0, r: 1.2, title: 'Kitchen', body: 'Water and a hot plate. Food is free here.', enter: 'Cook', run: () => hooks.toast('You cooked jollof. Free, and it does not move a chart.') })
      // Dining (SW): round table and four chairs.
      // Closet + key hook by the front door.
      box(1.4, 2.2, 0.6, std(0x6b4b36, 0.7), -8.6, 2.0, 0, true, Math.PI / 2)
      use({ id: 'closet', x: -8.0, z: 2.0, r: 0.9, title: 'Closet', body: 'Change bodies and outfits.', enter: 'Open closet', run: () => hooks.openPanel('boutique') })
      use({ id: 'key', x: -8.4, z: -1.0, r: 0.8, title: 'Key hook', body: getSave().houseClaimed ? 'The key is yours.' : 'The room is empty until you claim it.', enter: 'Take the key', run: () => hooks.toast(claimHouse().message) })
      // Bedroom (S middle): round bed, side tables, desk with the live CV laptop.
      use({ id: 'bed', x: 1.0, z: 4.6, r: 1.1, title: 'Bed', body: 'Sleep and wake to daylight.', enter: 'Sleep till morning', run: () => { setTime('day'); hooks.onLook(); hooks.toast('Morning. The district is up.') } })
      const deskWood = std(0x8a6a4c, 0.65)
      box(1.4, 0.04, 0.6, deskWood, -1.4, 2.0, 0.71)
      for (const sx of [-0.66, 0.66]) box(0.05, 0.71, 0.56, deskWood, -1.4 + sx, 2.0, 0, false)
      obstacles.push({ kind: 'box', x: o.x - 1.4, z: o.z + 2.0, hx: 0.75, hz: 0.35 })
      box(0.6, 0.03, 0.42, std(0x9aa0a6, 0.3, 0.8), -1.4, 2.0, 0.76, false)
      cvTex = canvasTex(512, 320, paintCv)
      const screen = add(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshBasicMaterial({ map: cvTex }), -1.4, 0.97, 1.83)
      screen.rotation.y = Math.PI
      screen.rotation.x = 0.18
      use({ id: 'desk', x: -1.4, z: 3.0, r: 1.0, title: 'Desk · laptop', body: 'Your CV, live on the screen.', enter: 'Open my CV', run: () => hooks.openPanel('profile') })
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
      box(0.4, 0.45, 1.5, black, 1.0, -3.0)
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
      const colours = [0x2a3b5c, 0x8c2f39, 0xe8dcc8, 0x3d4a3f, 0x111111, 0xc77d3a, 0x6b5a8e]
      for (const z of [-2.4, 0.4, 3.0]) {
        box(2.6, 0.05, 0.05, rail, 1.2, z, 1.6, false)
        box(0.05, 1.6, 0.05, rail, 0.0, z, 0, false); box(0.05, 1.6, 0.05, rail, 2.4, z, 0, false)
        obstacles.push({ kind: 'box', x: o.x + 1.2, z: o.z + z, hx: 1.35, hz: 0.35 })
        for (let i = 0; i < 7; i++) box(0.12, 0.9, 0.55, std(colours[(i * 3 + Math.round(z) + 14) % 7] ?? 0x555555, 0.95), 0.2 + i * 0.33, z, 0.65, false)
      }
      const mirror = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.03, metalness: 1 })
      box(0.06, 2.0, 1.2, mirror, w / 2 - 0.05, -1.5, 0.3, false)
      box(0.1, 2.3, 1.4, rail, w / 2 - 0.1, -1.5, 0.2, false)
      use({ id: 'mirror', x: w / 2 - 1.2, z: -1.5, r: 1.1, title: 'Mirror', body: 'Try on bodies, tints and masks.', enter: 'Try on', run: () => hooks.openPanel('boutique') })
      // Fitting room with curtain.
      box(1.6, 2.4, 0.06, std(0x6e2c34, 1), w / 2 - 1.0, 3.2, 0, false)
      box(0.06, 2.4, 1.6, wallMat, w / 2 - 1.8, 3.9)
      use({ id: 'fitting', x: w / 2 - 1.0, z: 2.4, r: 0.9, title: 'Fitting room', body: 'Step in and change.', enter: 'Change', run: () => hooks.openPanel('boutique') })
      // Counter.
      box(2.4, 1.0, 0.7, std(0x3a2a20, 0.5), -3.0, -3.6)
      box(2.4, 0.04, 0.75, rail, -3.0, -3.6, 1.0, false)
      // Mannequins.
      for (const x of [-3.6, -2.0]) {
        add(new THREE.CylinderGeometry(0.22, 0.18, 0.9, 10), std(0xe8e2d8, 0.6), x, 1.3, 2.4)
        add(new THREE.SphereGeometry(0.16, 12, 10), std(0xe8e2d8, 0.6), x, 1.95, 2.4)
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), rail, x, 0.42, 2.4)
        obstacles.push({ kind: 'circle', x: o.x + x, z: o.z + 2.4, r: 0.3 })
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
      // Modest low-poly worshippers in rows facing the qibla: standing, bowing, prostrating. No faces.
      const robes = [0xf2efe8, 0xe4dccd, 0x3a3f47, 0x6b5a45, 0x2a3b5c]
      const pose = (x: number, z: number, kind: number, c: number) => {
        const m = std(c, 0.95)
        const g = new THREE.Group()
        g.position.set(x, 0, z)
        g.rotation.y = Math.PI / 2
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.8, 8), m)
        const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.8, 8), m)
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), std(0xffffff, 0.9))
        if (kind === 0) { legs.position.y = 0.4; torso.position.y = 1.2; head.position.y = 1.72 }
        else if (kind === 1) { legs.position.y = 0.4; torso.position.set(0, 0.95, 0.35); torso.rotation.x = Math.PI / 2; head.position.set(0, 0.95, 0.82) }
        else { legs.position.set(0, 0.22, -0.2); legs.rotation.x = Math.PI / 2.4; torso.position.set(0, 0.3, 0.35); torso.rotation.x = Math.PI / 2.2; head.position.set(0, 0.14, 0.82) }
        g.add(torso, legs, head)
        group.add(g)
        obstacles.push({ kind: 'circle', x: o.x + x, z: o.z + z, r: 0.35 })
      }
      let n = 0
      for (const x of [3.2, 1.6]) for (let z = -4; z <= 4; z += 1.0) { pose(x, z, n % 3 === 0 ? 0 : n % 3 === 1 ? 1 : 2, robes[n % robes.length]!); n++ }
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
      inst(new THREE.BoxGeometry(2.6, 0.75, 1.0), deskMat, desks, [1.35, 0.55])
      const screens: Array<[number, number, number, number?]> = []
      const chairs: Array<[number, number, number, number?]> = []
      for (const [x, , z] of desks) { screens.push([x - 0.5, 1.12, z - 0.3], [x + 0.5, 1.12, z - 0.3]); chairs.push([x, 0.25, z + 0.85]) }
      inst(new THREE.BoxGeometry(0.85, 0.5, 0.04), blackMat, screens)
      inst(new THREE.PlaneGeometry(0.8, 0.45), screenMat, screens.map(([x, y, z]) => [x, y, z + 0.025]))
      inst(new THREE.BoxGeometry(0.55, 0.5, 0.55), std(0x22262b, 0.6), chairs)
      chairs.forEach(([x, , z], i) => seat(`desk${i}`, 'Desk chair', x, z, Math.PI, 0.5))
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
      inst(new THREE.BoxGeometry(4.2, 0.72, 0.5), wood, benches, [2.15, 0.3])
      inst(new THREE.BoxGeometry(4.0, 0.44, 0.4), std(0x3c2c20, 0.7), seats)
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
      // Library wall (east): shelves with instanced book spines.
      box(0.4, 2.6, 9.0, wood, w / 2 - 0.25, 0)
      const books: Array<[number, number, number, number?]> = []
      for (let shelf = 0; shelf < 5; shelf++) for (let i = 0; i < 26; i++) books.push([w / 2 - 0.5, 0.35 + shelf * 0.5, -4.2 + i * 0.33 + (shelf % 2) * 0.1])
      inst(new THREE.BoxGeometry(0.22, 0.36, 0.24), std(0x7a3a2c, 0.8), books.filter((_, i) => i % 3 === 0))
      inst(new THREE.BoxGeometry(0.22, 0.34, 0.24), std(0x2c4a5c, 0.8), books.filter((_, i) => i % 3 === 1))
      inst(new THREE.BoxGeometry(0.22, 0.38, 0.24), std(0xd8ccb0, 0.8), books.filter((_, i) => i % 3 === 2))
      const glass = new THREE.MeshStandardMaterial({ color: 0xf5ead2, emissive: 0xffe9c4, emissiveIntensity: 0.4, roughness: 0.2 })
      for (const x of [-5, -1, 3]) box(1.8, 1.8, 0.04, glass, x, d / 2 - 0.02, 1.0, false)
      use({ id: 'lectern', x: -0.5, z: -d / 2 + 3.4, r: 1.4, title: 'Lectern', body: 'Twelve short courses. Pass one and it writes your CV, resume, and portfolio.', enter: 'Open the hall', run: () => hooks.openPanel('learn') })
      use({ id: 'library', x: w / 2 - 1.6, z: 0, r: 1.4, title: 'Library', body: 'Every course has a source line. The shelf has the rest.', enter: 'Browse', run: () => hooks.toast('Read the source line under each course. Then do the four exercises.') })
    }

    if (id === 'studio') {
      // Influencer row studio: backdrop + softbox set, podcast table with mics, lounge.
      const fabric = std(0xcfc6b8, 1)
      box(5.0, 3.0, 0.08, std(0x6a5a4c, 1), 2.0, -d / 2 + 0.3, 0, false)
      box(5.0, 0.04, 2.6, std(0x6a5a4c, 1), 2.0, -d / 2 + 1.6, 0, false)
      const soft = new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xfff1dc, emissiveIntensity: 0.6, roughness: 0.6 })
      const stand = std(0x1a1c1f, 0.4, 0.6)
      for (const x of [-0.6, 4.6]) {
        box(0.04, 1.9, 0.04, stand, x, -d / 2 + 2.8, 0, false)
        box(0.9, 0.9, 0.06, soft, x, -d / 2 + 2.8, 1.9, false, x < 2 ? 0.5 : -0.5)
        obstacles.push({ kind: 'circle', x: o.x + x, z: o.z - d / 2 + 2.8, r: 0.3 })
      }
      box(0.3, 0.2, 0.25, stand, 2.0, -d / 2 + 4.2, 1.45, false)
      box(0.04, 1.45, 0.04, stand, 2.0, -d / 2 + 4.2, 0, false)
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
      use({ id: 'event-screen', x: 0, z: 1.2 - 2.4, r: 1.6, title: 'Event schedule', body: 'Upcoming AMAs, Spaces-style talks and demo days. Join for XP and reputation.', enter: 'Join event', run: () => hooks.openPanel('conference') })
      use({ id: 'stage', x: 3.6, z: stageZ + 2.2, r: 1.2, title: 'Stage', body: 'The lectern. Speakers stand here on event nights.', enter: 'See the programme', run: () => hooks.openPanel('conference') })
    }
    scene.add(group)
    const entry = { group, obstacles, uses }
    built.set(id, entry)
    return entry
  }

  return {
    get inside() { return inside },
    roomFor(spotId: string): RoomId | null {
      for (const id of Object.keys(STREET) as RoomId[]) if (STREET[id].spot === spotId) return id
      return null
    },
    enter(id: RoomId): { x: number; z: number; yaw: number } {
      const room = built.get(id) ?? build(id)
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
      lamp.intensity = id === 'house' ? 6 : 10 + SIZE[id].w * 0.6
      lamp.distance = Math.max(18, SIZE[id].w * 1.3)
      roomFill.intensity = id === 'house' ? 0.3 : 0.45
      if (id === 'house' && cvTex) { paintCv((cvTex.image as HTMLCanvasElement).getContext('2d')!); cvTex.needsUpdate = true }
      // Home: spawn a few steps in, facing the rooms (camera behind, toward the door), so the view opens on the interior.
      if (id === 'house') return { x: o.x - SIZE[id].w / 2 + 3.6, z: o.z - 0.3, yaw: Math.PI / 2 }
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
