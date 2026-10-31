import * as THREE from 'three'
import type { Obstacle } from './physics.ts'
import { claimHouse, finishGym, getSave, setTime, walkGym } from './state.ts'
import { passedCount } from './certs.ts'
import { rankFor } from './logic.ts'

// Walk-in 3D rooms. Built lazily far outside the city (fog hides the street), one shared lamp.
export type RoomId = 'house' | 'gym' | 'boutique'
export type Use = { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; run: () => void; exit?: boolean }
type Hooks = { toast: (t: string) => void; openPanel: (p: 'profile' | 'boutique') => void; onLook: () => void; busy: (seconds: number, x: number, z: number, faceYaw: number) => void }

const ORIGIN: Record<RoomId, { x: number; z: number }> = { house: { x: 400, z: 0 }, gym: { x: 400, z: 60 }, boutique: { x: 400, z: 120 } }
const SIZE: Record<RoomId, { w: number; d: number }> = { house: { w: 13, d: 10 }, gym: { w: 15, d: 11 }, boutique: { w: 12, d: 9 } }
// Street side: building centre and door hotspot id.
export const STREET: Record<RoomId, { spot: string; cx: number; cz: number }> = {
  house: { spot: 'yours', cx: 36, cz: 32 },
  gym: { spot: 'gym', cx: -22, cz: -22 },
  boutique: { spot: 'boutique', cx: 22, cz: -22 },
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

    // Shell: floor, skirting, four walls, ceiling beams, exit door on the west wall.
    const floorMat = id === 'gym' ? std(0x2b2d30, 0.95) : std(id === 'house' ? 0x8a6243 : 0xd9d2c6, 0.6)
    const floor = add(new THREE.PlaneGeometry(w, d), floorMat, 0, 0.01, 0)
    floor.rotation.x = -Math.PI / 2
    const wallMat = std(id === 'gym' ? 0xb9b4ac : id === 'house' ? 0xe9e0d0 : 0xf1ebe2, 0.92)
    const H = 3.2
    const T = 0.25
    box(w + T * 2, H, T, wallMat, 0, -d / 2 - T / 2)
    box(w + T * 2, H, T, wallMat, 0, d / 2 + T / 2)
    box(T, H, d, wallMat, w / 2 + T / 2, 0)
    box(T, H, d, wallMat, -w / 2 - T / 2, 0)
    const trim = std(0xc9a25e, 0.45, 0.8)
    for (const z of [-d / 2 + 0.03, d / 2 - 0.03]) box(w, 0.12, 0.04, trim, 0, z, 0, false)
    for (let x = -w / 2 + 2; x < w / 2; x += 3) box(0.22, 0.25, d, std(0x5a4636, 0.8), x, 0, H - 0.25, false)
    // Exit door (double leaf) with brass handle.
    const doorMat = std(0x4a3426, 0.6)
    box(0.08, 2.3, 0.75, doorMat, -w / 2 + 0.04, -0.4, 0, false)
    box(0.08, 2.3, 0.75, doorMat, -w / 2 + 0.04, 0.4, 0, false)
    box(0.06, 0.06, 0.3, trim, -w / 2 + 0.12, 0, 1.05, false)
    const exitSign = add(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(256, 86, (g) => {
      g.fillStyle = '#14110e'; g.fillRect(0, 0, 256, 86); g.fillStyle = '#f2ece0'; g.font = '700 44px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('STREET', 128, 60)
    }) }), -w / 2 + 0.06, 2.6, 0)
    exitSign.rotation.y = Math.PI / 2
    use({ id: `${id}-exit`, x: -w / 2 + 0.9, z: 0, r: 0.9, title: 'Door', body: 'Back to the street.', enter: 'Go outside', run: () => {}, exit: true })

    if (id === 'house') {
      const fabric = std(0x41556b, 0.95)
      // Living room: rug, sofa, coffee table, TV wall.
      box(3.6, 0.02, 2.6, std(0xb48a5a, 1), -2.6, 2.4, 0, false)
      box(2.8, 0.45, 0.9, fabric, -2.6, 4.2); box(2.8, 0.5, 0.2, fabric, -2.6, 4.6, 0.45, false)
      box(1.2, 0.4, 0.6, std(0x3a2a20, 0.6), -2.6, 2.4)
      box(1.8, 1.0, 0.06, std(0x0d0f12, 0.2, 0.5), -2.6, -4.9 + 0.1, 1.0, false)
      box(2.2, 0.5, 0.4, std(0x3a2a20, 0.6), -2.6, -4.7)
      use({ id: 'sofa', x: -2.6, z: 3.4, r: 1.1, title: 'Sofa', body: 'Sit a while. The window sets the light.', enter: 'Turn the lamp on (night)', run: () => { setTime('night'); hooks.onLook(); hooks.toast('Lamp on. Night in the district.') } })
      // Bedroom corner: bed, pillow, blanket, side table.
      box(2.0, 0.5, 2.6, std(0x6b4b36, 0.7), 4.6, 3.4)
      box(1.9, 0.18, 2.0, std(0xe9e4da, 1), 4.6, 3.1, 0.5, false)
      box(1.2, 0.15, 0.5, std(0xffffff, 1), 4.6, 4.4, 0.55, false)
      box(0.5, 0.5, 0.5, std(0x3a2a20), 3.2, 4.4)
      use({ id: 'bed', x: 4.6, z: 1.6, r: 1.1, title: 'Bed', body: 'Sleep and wake to daylight.', enter: 'Sleep till morning', run: () => { setTime('day'); hooks.onLook(); hooks.toast('Morning. The district is up.') } })
      // Desk, chair, laptop with a live CV screen.
      box(1.8, 0.75, 0.8, std(0x5a3f2c, 0.6), 4.6, -4.1)
      box(0.55, 0.5, 0.55, std(0x22262b, 0.6), 4.6, -3.2)
      box(0.6, 0.03, 0.42, std(0x9aa0a6, 0.3, 0.8), 4.6, -4.15, 0.76, false)
      cvTex = canvasTex(512, 320, paintCv)
      const screen = add(new THREE.PlaneGeometry(0.6, 0.38), new THREE.MeshBasicMaterial({ map: cvTex }), 4.6, 0.97, -4.38)
      screen.rotation.x = -0.18
      use({ id: 'desk', x: 4.6, z: -2.7, r: 1.0, title: 'Desk · laptop', body: 'Your CV, live on the screen.', enter: 'Open my CV', run: () => hooks.openPanel('profile') })
      // Kitchen: counters, stove, fridge, sink.
      box(3.4, 0.9, 0.7, std(0xe7e2d8, 0.5), 0.2, -4.6)
      box(0.7, 0.04, 0.6, std(0x1b1c1e, 0.3, 0.6), -0.6, -4.6, 0.9, false)
      box(0.8, 1.9, 0.7, std(0xd9dde0, 0.35, 0.4), 2.3, -4.6)
      box(0.5, 0.08, 0.4, std(0xb8bec4, 0.2, 0.9), 0.9, -4.6, 0.88, false)
      use({ id: 'kitchen', x: 0.4, z: -3.6, r: 1.0, title: 'Kitchen', body: 'Water and a hot plate. Food is free here.', enter: 'Cook', run: () => hooks.toast('You cooked jollof. Free, and it does not move a chart.') })
      // Closet + key hook.
      box(1.4, 2.2, 0.6, std(0x6b4b36, 0.7), -5.4, -3.6)
      use({ id: 'closet', x: -5.0, z: -2.6, r: 0.9, title: 'Closet', body: 'Change bodies and outfits.', enter: 'Open closet', run: () => hooks.openPanel('boutique') })
      use({ id: 'key', x: -5.2, z: 2.2, r: 0.9, title: 'Key hook', body: getSave().houseClaimed ? 'The key is yours.' : 'The room is empty until you claim it.', enter: 'Take the key', run: () => hooks.toast(claimHouse().message) })
      box(0.3, 0.3, 0.05, trim, -6.4, 2.2, 1.5, false)
      // Windows on the south wall.
      for (const x of [-2.6, 2.0]) box(1.6, 1.2, 0.04, new THREE.MeshStandardMaterial({ color: 0xbfd8ea, emissive: 0x8fb4cf, emissiveIntensity: 0.35, roughness: 0.1 }), x, d / 2 - 0.02, 1.2, false)
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
      lamp.intensity = 22
      if (id === 'house' && cvTex) { paintCv((cvTex.image as HTMLCanvasElement).getContext('2d')!); cvTex.needsUpdate = true }
      return { x: o.x - SIZE[id].w / 2 + 2.0, z: o.z, yaw: -Math.PI / 2 }
    },
    exit(doorX: number, doorZ: number): { x: number; z: number } {
      const id = inside
      inside = null
      lamp.intensity = 0
      lamp.position.set(0, -50, 0)
      if (id) built.get(id)!.group.visible = false
      const s = id ? STREET[id] : { cx: 0, cz: 0 }
      const dx = doorX - s.cx
      const dz = doorZ - s.cz
      const len = Math.hypot(dx, dz) || 1
      return { x: doorX + (dx / len) * 1.2, z: doorZ + (dz / len) * 1.2 }
    },
    obstacles(): Obstacle[] { return inside ? built.get(inside)!.obstacles : [] },
    uses() { return inside ? built.get(inside)!.uses.map((u) => ({ ...u, use: u.exit ? undefined : u.run })) : [] },
    bounds(): { x: number; z: number; hw: number; hd: number } | null {
      if (!inside) return null
      return { ...ORIGIN[inside], hw: SIZE[inside].w / 2 - 0.5, hd: SIZE[inside].d / 2 - 0.5 }
    },
  }
}
