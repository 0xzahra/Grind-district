// Home life: the things a home is actually used for. A gas cooker with pots, a fridge whose door opens on real
// food, utensils and groceries, doors in the doorways, a bathroom, a laundry corner, a planter garden, a pool
// lounger and a place to work. Everything is built in code from a handful of shared materials. Small items are
// merged into one mesh per material and hung on the piece they belong to (a wall, the fridge, a door), so the
// indoor cut-away hides them together and nothing is left floating. Interactions are short and free: they
// change nothing in the save.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Obstacle } from './physics.ts'
import type { Seat } from './seating.ts'
import { foliageMaterial, shrubGeometry } from './trees.ts'

type UseSpec = { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; run: () => void }
export type HomeCtx = {
  group: THREE.Group
  /** Room origin in the world (uses are room-local; `sit` and `busy` take world coordinates). */
  ox: number; oz: number; w: number; d: number; H: number
  obstacles: Obstacle[]
  use: (u: UseSpec) => void
  toast: (m: string) => void
  sit: (s: Seat) => void
  busy: (seconds: number, x: number, z: number, yaw: number) => void
  wall: THREE.Material
  /** Existing walls that fittings hang on: the north and east outer walls and the kitchen | pool partition. */
  walls: { north: THREE.Object3D; east: THREE.Object3D; bath: THREE.Object3D }
}

const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

export function buildHomeLife(c: HomeCtx): void {
  const { group, w, d, H } = c
  const M = {
    steel: std(0xc9ccd0, 0.28, 0.75), iron: std(0x1c1d1f, 0.55, 0.5), enamel: std(0x18191b, 0.2, 0.3), wood: std(0x7a5a40, 0.6), oak: std(0xb08a62, 0.6),
    white: std(0xf4f3ef, 0.25), tile: std(0xeef1f2, 0.18), chrome: std(0xe6e9ec, 0.12, 0.9), dark: std(0x2a2c2f, 0.4, 0.4),
    china: new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.2, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe6ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
    frost: new THREE.MeshStandardMaterial({ color: 0xe4f0f3, roughness: 0.7, transparent: true, opacity: 0.55, depthWrite: false }),
    ovenGlass: std(0x101214, 0.08, 0.6), flame: new THREE.MeshBasicMaterial({ color: 0x4fa8ff, transparent: true, opacity: 0 }),
    red: std(0xc23a2b, 0.5), orange: std(0xe07b2a, 0.6), yellow: std(0xe8c33a, 0.55), green: std(0x4f8a3a, 0.6), leafy: std(0x3f7a34, 0.7), cream: std(0xf1e6c8, 0.6),
    brown: std(0x8a5a34, 0.7), blue: std(0x4a7fb8, 0.35), rice: std(0xd9622a, 0.9), soil: std(0x4a3626, 1), terracotta: std(0xb5653f, 0.8),
    towel: std(0x9fb8c8, 0.95), basket: std(0xb8956a, 0.9), cloth1: std(0xc8433a, 0.95), cloth2: std(0x3d6b9a, 0.95), cloth3: std(0xe8dcc4, 0.95),
    light: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0.9, roughness: 0.6 }),
    mirror: std(0xdfe8ee, 0.03, 0.95), cushion: std(0xe9e2d2, 0.95),
    pan: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.28, metalness: 0.75, side: THREE.DoubleSide }),
  }
  // ---- small items: one merged mesh per material, hung on an anchor (the room itself unless `on` says otherwise) ----
  const bags = new Map<THREE.Object3D, Map<THREE.Material, THREE.BufferGeometry[]>>()
  let anchor: THREE.Object3D = group
  const on = (a: THREE.Object3D, fn: () => void) => { const prev = anchor; anchor = a; fn(); anchor = prev }
  /** Add a shape at room coordinates (turned by ry, rx, rz first). */
  const put = (m: THREE.Material, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => {
    const geo = g.index ? g.toNonIndexed() : g
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k)
    if (rx || ry || rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)))
    geo.translate(x, y, z)
    let per = bags.get(anchor)
    if (!per) bags.set(anchor, per = new Map())
    const list = per.get(m)
    if (list) list.push(geo); else per.set(m, [geo])
  }
  /** Box standing on height y. */
  const box = (m: THREE.Material, bw: number, bh: number, bd: number, x: number, y: number, z: number, ry = 0) => put(m, new THREE.BoxGeometry(bw, bh, bd), x, y + bh / 2, z, ry)
  /** Upright cylinder standing on height y. */
  const cyl = (m: THREE.Material, r1: number, r2: number, h: number, x: number, y: number, z: number, seg = 14) => put(m, new THREE.CylinderGeometry(r1, r2, h, seg), x, y + h / 2, z)
  /** Rod of length `len` centred on (x, y, z), lying along the x or z axis. */
  const rod = (m: THREE.Material, r: number, len: number, x: number, y: number, z: number, along: 'x' | 'z') => put(m, new THREE.CylinderGeometry(r, r, len, 8), x, y, z, 0, along === 'z' ? Math.PI / 2 : 0, along === 'x' ? Math.PI / 2 : 0)
  const ball = (m: THREE.Material, r: number, x: number, y: number, z: number, sy = 1) => put(m, new THREE.SphereGeometry(r, 10, 8).scale(1, sy, 1), x, y, z)
  /** An open bowl (lower half of a sphere) with its rim at height y. */
  const bowl = (m: THREE.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => put(m, new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(sx, sy, sz), x, y, z)
  // ---- larger pieces: their own meshes, so the cut-away can hide one piece at a time ----
  const solid = (m: THREE.Material | THREE.Material[], g: THREE.BufferGeometry, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(g, m)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  const block = (x: number, z: number, hx: number, hz: number) => c.obstacles.push({ kind: 'box', x: c.ox + x, z: c.oz + z, hx, hz })
  const now = () => performance.now() / 1000
  const N = -d / 2, E = w / 2 // north and east walls

  // =================== KITCHEN (north-east) ===================
  {
    // Gas cooker, set into the run of counters: steel body, oven door with a window, a row of knobs, cast-iron
    // pan supports over four burners and a splash-back.
    const X = 6.4, Z = N + 0.47
    const range = solid(M.steel, new THREE.BoxGeometry(0.66, 0.9, 0.74), X, 0.45, Z)
    block(X, Z, 0.36, 0.42)
    const burners: Array<[number, number]> = [[X - 0.16, Z - 0.16], [X + 0.16, Z - 0.16], [X - 0.16, Z + 0.14], [X + 0.16, Z + 0.14]]
    on(range, () => {
      box(M.dark, 0.56, 0.5, 0.008, X, 0.1, Z + 0.372)
      box(M.ovenGlass, 0.44, 0.3, 0.008, X, 0.2, Z + 0.378)
      rod(M.chrome, 0.012, 0.5, X, 0.66, Z + 0.41, 'x')
      for (const s of [-0.19, 0.19]) box(M.chrome, 0.014, 0.014, 0.04, X + s, 0.653, Z + 0.39)
      for (let i = 0; i < 5; i++) put(M.dark, new THREE.CylinderGeometry(0.022, 0.026, 0.03, 10), X - 0.24 + i * 0.12, 0.79, Z + 0.385, 0, Math.PI / 2)
      box(M.enamel, 0.64, 0.02, 0.7, X, 0.9, Z)
      box(M.steel, 0.66, 0.14, 0.03, X, 0.9, Z - 0.355)
      for (const [bx, bz] of burners) {
        cyl(M.iron, 0.045, 0.05, 0.014, bx, 0.92, bz, 12)
        for (const r of [0, Math.PI / 2]) box(M.iron, 0.24, 0.012, 0.018, bx, 0.94, bz, r)
      }
    })
    const flames = solid(M.flame, mergeGeometries(burners.map(([bx, bz]) => new THREE.TorusGeometry(0.05, 0.009, 6, 18).rotateX(Math.PI / 2).translate(bx, 0.945, bz)))!, 0, 0, 0)
    flames.castShadow = false
    flames.visible = false
    flames.userData.ghost = true
    flames.raycast = () => undefined
    // A pot of jollof on the back burner, a frying pan of plantain on the front one.
    const potX = X - 0.16, potZ = Z - 0.16, top = 0.953
    cyl(M.steel, 0.115, 0.105, 0.14, potX, top, potZ, 18)
    cyl(M.rice, 0.105, 0.105, 0.012, potX, top + 0.118, potZ, 18)
    for (const s of [-1, 1]) box(M.dark, 0.05, 0.016, 0.03, potX + s * 0.135, top + 0.1, potZ)
    for (let i = 0; i < 6; i++) ball(i % 2 ? M.red : M.green, 0.012, potX + Math.cos(i * 1.1) * 0.06, top + 0.132, potZ + Math.sin(i * 1.1) * 0.06)
    cyl(M.iron, 0.125, 0.11, 0.035, X + 0.16, top, Z + 0.14, 18)
    box(M.iron, 0.2, 0.016, 0.03, X + 0.36, top + 0.02, Z + 0.14)
    for (const [dx, dz] of [[-0.04, 0.02], [0.05, -0.03], [0.01, 0.06], [-0.02, -0.06]] as const) put(M.yellow, new THREE.SphereGeometry(0.035, 8, 6).scale(1.5, 0.3, 0.8), X + 0.16 + dx, top + 0.04, Z + 0.14 + dz, dx * 20)
    let cookingUntil = 0
    range.onBeforeRender = () => {
      const lit = now() < cookingUntil
      M.flame.opacity += ((lit ? 0.85 + Math.sin(now() * 17) * 0.1 : 0) - M.flame.opacity) * 0.2
      flames.visible = M.flame.opacity > 0.02
    }
    c.use({ id: 'kitchen', x: X, z: N + 1.5, r: 1.0, title: 'Gas cooker', body: 'A pot of jollof and a pan of plantain. Food is free at home.', enter: 'Cook', run: () => {
      cookingUntil = now() + 6
      c.busy(2.4, c.ox + X, c.oz + N + 1.3, Math.PI)
      c.toast('Burners lit. Jollof is on, plantain is frying.')
      window.setTimeout(() => c.toast('Dinner is ready. You ate well.'), 2600)
    } })
    c.use({ id: 'sink', x: 8.3, z: N + 1.5, r: 0.8, title: 'Sink', body: 'Plates, cups and a rack to dry them on.', enter: 'Wash the dishes', run: () => { c.busy(2.0, c.ox + 8.3, c.oz + N + 1.3, Math.PI); c.toast('Dishes washed and racked.') } })

    // Utensils and groceries on the worktop (top at 0.9).
    const T = 0.9, B = N + 0.2
    box(M.wood, 0.14, 0.2, 0.1, 5.42, T, B + 0.08, 0.2) // knife block
    for (let i = 0; i < 4; i++) box(M.dark, 0.018, 0.07, 0.014, 5.38 + i * 0.027, T + 0.2, B + 0.07, 0.2)
    cyl(M.white, 0.055, 0.05, 0.14, 5.72, T, B + 0.1) // crock of wooden spoons
    for (const [dx, dz, h] of [[-0.02, 0, 0.3], [0.02, 0.01, 0.27], [0, -0.02, 0.32]] as const) cyl(M.oak, 0.007, 0.007, h, 5.72 + dx, T + 0.05, B + 0.1 + dz, 6)
    put(M.oak, new THREE.SphereGeometry(0.028, 8, 6).scale(1, 0.4, 1.3), 5.72, T + 0.37, B + 0.08)
    box(M.oak, 0.38, 0.02, 0.26, 7.25, T, N + 0.5) // chopping board: knife, tomatoes, onion, pepper
    box(M.steel, 0.16, 0.004, 0.03, 7.32, T + 0.02, N + 0.42, 0.5); box(M.dark, 0.09, 0.016, 0.022, 7.21, T + 0.02, N + 0.48, 0.5)
    for (const [dx, dz] of [[-0.1, 0.05], [-0.03, 0.08], [-0.07, -0.02]] as const) ball(M.red, 0.034, 7.25 + dx, T + 0.052, N + 0.5 + dz, 0.9)
    ball(M.cream, 0.036, 7.36, T + 0.054, N + 0.56); ball(M.green, 0.03, 7.4, T + 0.05, N + 0.47, 1.3)
    cyl(M.steel, 0.075, 0.085, 0.16, 7.72, T, B + 0.12, 16) // kettle
    cyl(M.dark, 0.03, 0.03, 0.02, 7.72, T + 0.16, B + 0.12); box(M.dark, 0.02, 0.1, 0.02, 7.83, T + 0.06, B + 0.12); put(M.steel, new THREE.CylinderGeometry(0.012, 0.018, 0.08, 8), 7.63, T + 0.11, B + 0.12, 0, 0, 0.9)
    box(M.chrome, 0.44, 0.012, 0.32, 9.15, T, N + 0.45) // dish rack: plates on edge, two cups
    for (let i = 0; i < 5; i++) put(M.white, new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16), 8.99 + i * 0.05, T + 0.112, N + 0.42, 0, 0, Math.PI / 2 - 0.12)
    for (const dz of [0.34, 0.52]) cyl(M.blue, 0.035, 0.03, 0.08, 9.3, T + 0.012, N + dz)
    // On the wall: a rail of ladle, turner and whisk under the window, and a shelf of spice jars.
    on(c.walls.north, () => {
      rod(M.chrome, 0.008, 0.9, 7.25, 1.3, N + 0.06, 'x')
      for (const [dx, kind] of [[-0.36, 0], [-0.18, 1], [0, 2], [0.18, 0], [0.36, 1]] as const) {
        const x = 7.25 + dx
        box(M.steel, 0.012, 0.2, 0.006, x, 1.1, N + 0.07)
        if (kind === 0) bowl(M.pan, 0.04, x, 1.11, N + 0.08)
        else if (kind === 1) box(M.steel, 0.06, 0.08, 0.005, x, 1.03, N + 0.07)
        else put(M.steel, new THREE.SphereGeometry(0.035, 6, 5).scale(1, 1.6, 1), x, 1.06, N + 0.08)
      }
      box(M.oak, 1.3, 0.025, 0.16, 8.6, 1.55, N + 0.1)
      for (let i = 0; i < 7; i++) {
        const x = 8.05 + i * 0.18
        cyl(M.glass, 0.03, 0.03, 0.09, x, 1.575, N + 0.1, 10)
        cyl([M.red, M.yellow, M.brown, M.green, M.orange, M.cream, M.red][i]!, 0.026, 0.026, 0.055, x, 1.578, N + 0.1, 10)
        cyl(M.dark, 0.031, 0.031, 0.012, x, 1.665, N + 0.1, 10)
      }
    })
    // On the island (top at 0.91): a fruit bowl, bread on a board, a jug of water and glasses.
    const IX = 7.0, IZ = -4.2, IT = 0.91
    bowl(M.china, 0.16, IX - 0.5, IT + 0.1, IZ, 1, 0.62, 1)
    for (const [dx, dz, m] of [[-0.05, 0.03, M.orange], [0.05, -0.03, M.orange], [0, 0.07, M.red], [-0.06, -0.06, M.green], [0.07, 0.05, M.orange]] as const) ball(m, 0.045, IX - 0.5 + dx, IT + 0.085, IZ + dz)
    for (const r of [-0.25, 0.1]) put(M.yellow, new THREE.TorusGeometry(0.08, 0.016, 6, 10, Math.PI * 0.8), IX - 0.5, IT + 0.12, IZ, r, Math.PI / 2.4)
    box(M.oak, 0.34, 0.018, 0.2, IX + 0.1, IT, IZ + 0.15); put(M.brown, new THREE.CapsuleGeometry(0.06, 0.16, 4, 10), IX + 0.1, IT + 0.075, IZ + 0.15, 0, 0, Math.PI / 2)
    cyl(M.glass, 0.05, 0.045, 0.2, IX + 0.6, IT, IZ - 0.2, 12); cyl(M.blue, 0.044, 0.04, 0.13, IX + 0.6, IT + 0.005, IZ - 0.2, 12)
    for (const dx of [0.42, 0.74]) cyl(M.glass, 0.03, 0.026, 0.1, IX + dx, IT, IZ - 0.05, 10)

    // Fridge-freezer by the east wall, facing the room: a shell with lit shelves of food behind two real doors.
    const FX = E - 0.55, FZ = -4.5
    const shell = mergeGeometries([
      new THREE.BoxGeometry(0.9, 2.0, 0.04).translate(0, 1.0, -0.355), new THREE.BoxGeometry(0.04, 2.0, 0.71).translate(-0.43, 1.0, 0.02), new THREE.BoxGeometry(0.04, 2.0, 0.71).translate(0.43, 1.0, 0.02),
      new THREE.BoxGeometry(0.9, 0.04, 0.71).translate(0, 1.98, 0.02), new THREE.BoxGeometry(0.9, 0.08, 0.71).translate(0, 0.04, 0.02), new THREE.BoxGeometry(0.82, 0.04, 0.67).translate(0, 0.72, 0),
    ])!
    const fridge = solid(M.steel, shell, FX, 0, FZ)
    block(FX, FZ, 0.47, 0.4)
    on(fridge, () => {
      box(M.light, 0.8, 1.2, 0.01, FX, 0.76, FZ - 0.33)
      for (const y of [1.08, 1.4, 1.7]) box(M.glass, 0.8, 0.012, 0.56, FX, y, FZ - 0.03)
      for (const [x, m] of [[-0.3, M.blue], [-0.2, M.blue], [-0.1, M.orange]] as const) cyl(m, 0.035, 0.035, 0.24, FX + x, 1.712, FZ - 0.05, 10) // water, juice
      box(M.white, 0.08, 0.2, 0.08, FX + 0.1, 1.712, FZ - 0.05); box(M.cream, 0.2, 0.07, 0.14, FX + 0.27, 1.712, FZ) // milk, eggs
      cyl(M.red, 0.1, 0.09, 0.11, FX - 0.22, 1.412, FZ, 14); cyl(M.white, 0.102, 0.102, 0.012, FX - 0.22, 1.522, FZ, 14) // a pot of stew
      box(M.yellow, 0.16, 0.08, 0.12, FX + 0.05, 1.412, FZ + 0.02); box(M.green, 0.14, 0.06, 0.2, FX + 0.26, 1.412, FZ)
      for (const [x, z, m] of [[-0.28, 0.05, M.green], [-0.16, -0.02, M.red], [-0.05, 0.06, M.red], [0.08, 0, M.orange], [0.2, 0.06, M.orange], [0.3, -0.03, M.yellow]] as const) ball(m, 0.05, FX + x, 1.142, FZ + z)
      box(M.glass, 0.78, 0.24, 0.5, FX, 0.76, FZ - 0.04) // crisper drawer of greens
      for (const x of [-0.25, -0.08, 0.1, 0.26]) ball(M.leafy, 0.085, FX + x, 0.86, FZ - 0.04, 0.8)
    })
    const door = (y: number, h: number) => {
      // Hinged on the wall side: the pivot sits on the hinge line and the leaf hangs off it.
      const pivot = new THREE.Group()
      pivot.position.set(0.45, y, 0.375)
      fridge.add(pivot)
      const leaf = solid(M.steel, new THREE.BoxGeometry(0.9, h, 0.05), -0.45, 0, 0.025, pivot)
      on(pivot, () => {
        box(M.dark, 0.024, h * 0.55, 0.024, FX - 0.38, y - h * 0.275, FZ + 0.445)
        box(M.white, 0.8, h - 0.1, 0.03, FX, y - h / 2 + 0.05, FZ + 0.363)
      })
      return { pivot, leaf }
    }
    const upper = door(1.37, 1.22)
    door(0.39, 0.62)
    on(upper.pivot, () => { // door shelf: sauce bottles ride on the door
      box(M.white, 0.76, 0.02, 0.09, FX, 1.02, FZ + 0.31)
      for (const [x, m] of [[0.2, M.green], [0.05, M.red], [-0.15, M.yellow], [-0.28, M.brown]] as const) cyl(m, 0.03, 0.03, 0.18, FX + x, 1.04, FZ + 0.31, 8)
    })
    let openUntil = 0
    fridge.onBeforeRender = () => { upper.pivot.rotation.y += ((now() < openUntil ? 1.5 : 0) - upper.pivot.rotation.y) * 0.12 }
    c.use({ id: 'fridge', x: FX - 0.3, z: FZ + 1.3, r: 0.95, title: 'Fridge', body: 'Cold water, juice, fruit, eggs and last night\'s stew.', enter: 'Open the fridge', run: () => {
      openUntil = now() + 5
      c.busy(1.8, c.ox + FX - 0.3, c.oz + FZ + 1.25, Math.PI)
      c.toast('Fridge open. You took a cold drink and some fruit.')
    } })
  }

  // =================== DOORS ===================
  {
    // A cased doorway: two jambs and a head in timber with the wall carried over the top, and the door itself
    // standing open, folded back against the wall beside it. `along` is the axis the wall runs on.
    const doorway = (x: number, z: number, along: 'x' | 'z', width: number, px: number, pz: number, yaw: number, leafMat: THREE.Material = M.oak) => {
      const ax = along === 'x'
      const casing = [-1, 1].map((s) => new THREE.BoxGeometry(ax ? 0.07 : 0.21, 2.12, ax ? 0.21 : 0.07).translate(ax ? s * (width / 2 - 0.035) : 0, 1.06, ax ? 0 : s * (width / 2 - 0.035)))
      casing.push(new THREE.BoxGeometry(ax ? width : 0.21, 0.08, ax ? 0.21 : width).translate(0, 2.16, 0))
      const over = new THREE.BoxGeometry(ax ? width : 0.15, H - 2.2, ax ? 0.15 : width).translate(0, (H + 2.2) / 2, 0)
      solid([M.wood, c.wall], mergeGeometries([mergeGeometries(casing)!, over], true)!, x, 0, z)
      const pivot = new THREE.Group()
      pivot.position.set(px, 0, pz)
      pivot.rotation.y = yaw
      group.add(pivot)
      const lw = width - 0.16
      // The leaf: a slab with two raised panels on each face, and a lever handle on each side.
      const slab = [new THREE.BoxGeometry(lw, 2.04, 0.04).translate(lw / 2, 1.04, 0)]
      for (const y of [0.56, 1.52]) slab.push(new THREE.BoxGeometry(lw - 0.24, y < 1 ? 0.7 : 0.86, 0.056).translate(lw / 2, y, 0))
      const leaf = solid(leafMat, mergeGeometries(slab)!, 0, 0, 0, pivot)
      const lever = mergeGeometries([-1, 1].flatMap((s) => [new THREE.CylinderGeometry(0.011, 0.011, 0.05, 8).rotateX(Math.PI / 2).translate(lw - 0.09, 1.02, s * 0.045), new THREE.BoxGeometry(0.12, 0.018, 0.014).translate(lw - 0.14, 1.02, s * 0.07)]))!
      solid(M.chrome, lever, 0, 0, 0, leaf).raycast = () => undefined
      return leaf
    }
    // The bedroom's open north-east corner gets a post, so its two doorways are real openings.
    solid(c.wall, new THREE.BoxGeometry(0.15, H, 0.15), 4.6, H / 2, 1.2)
    block(4.6, 1.2, 0.1, 0.1)
    doorway(4.025, 1.2, 'x', 1.0, 3.56, 1.3, Math.PI + 0.12)       // living room -> bedroom
    doorway(-2.6, 1.84, 'z', 1.12, -2.5, 2.36, -Math.PI / 2 + 0.12)  // dining room -> bedroom
    doorway(4.6, 1.84, 'z', 1.12, 4.7, 2.36, -Math.PI / 2 + 0.12)   // bedroom -> pool room

    // =================== BATHROOM (north end of the pool room) ===================
    const x0 = 7.3, x1 = E, z0 = -0.72, z1 = 1.45
    solid(c.wall, new THREE.BoxGeometry(0.12, H, 0.95), x0, H / 2, z0 + 0.475) // west wall; the door is south of it
    const south = solid(c.wall, new THREE.BoxGeometry(x1 - x0 + 0.06, H, 0.12), (x0 + x1) / 2 - 0.03, H / 2, z1)
    block(x0, z0 + 0.475, 0.1, 0.5); block((x0 + x1) / 2, z1, (x1 - x0) / 2 + 0.05, 0.1)
    solid(M.tile, new THREE.PlaneGeometry(x1 - x0 - 0.06, z1 - z0 - 0.06).rotateX(-Math.PI / 2), (x0 + x1) / 2 + 0.03, 0.05, (z0 + z1) / 2 - 0.03).castShadow = false
    doorway(x0, 0.82, 'z', 1.14, x0 + 0.1, 1.33, 0.12, M.white) // opens inward, against the south wall
    // Vanity basin under a mirror on the north wall; tiling to shoulder height.
    const VX = 7.95, VZ = z0 + 0.25
    solid(M.oak, new THREE.BoxGeometry(0.8, 0.78, 0.46), VX, 0.39, VZ)
    block(VX, VZ, 0.42, 0.26)
    box(M.white, 0.84, 0.05, 0.5, VX, 0.78, VZ)
    bowl(M.china, 0.17, VX, 0.915, VZ + 0.02, 1.15, 0.5, 0.9)
    cyl(M.chrome, 0.012, 0.012, 0.14, VX, 0.83, VZ - 0.17, 8); rod(M.chrome, 0.01, 0.12, VX, 0.96, VZ - 0.12, 'z')
    cyl(M.white, 0.03, 0.03, 0.1, VX + 0.32, 0.83, VZ - 0.1, 10); cyl(M.blue, 0.006, 0.006, 0.17, VX + 0.32, 0.84, VZ - 0.1, 5); cyl(M.red, 0.006, 0.006, 0.17, VX + 0.335, 0.84, VZ - 0.09, 5) // tooth mug
    box(M.green, 0.07, 0.03, 0.05, VX - 0.3, 0.83, VZ - 0.08) // soap
    on(c.walls.bath, () => {
      box(M.tile, x1 - x0 - 0.1, 1.5, 0.02, (x0 + x1) / 2, 0.05, z0 + 0.012)
      box(M.oak, 0.76, 0.96, 0.012, VX, 1.07, z0 + 0.03)
      box(M.mirror, 0.7, 0.9, 0.012, VX, 1.1, z0 + 0.04)
    })
    // Toilet against the east wall.
    const TX = x1 - 0.42, TZ = 0.95
    solid(M.white, mergeGeometries([new THREE.BoxGeometry(0.2, 0.42, 0.42).translate(0.22, 0.62, 0), new THREE.CylinderGeometry(0.2, 0.15, 0.4, 16).scale(1.25, 1, 1).translate(-0.12, 0.2, 0), new THREE.TorusGeometry(0.17, 0.035, 8, 18).rotateX(Math.PI / 2).scale(1.25, 1, 1).translate(-0.12, 0.42, 0)])!, TX, 0, TZ)
    block(TX - 0.05, TZ, 0.36, 0.25)
    box(M.chrome, 0.02, 0.03, 0.08, x1 - 0.2, 0.84, TZ)
    // Walk-in shower in the north-east corner: tray, a frosted screen, a rain head and a mixer.
    const SX = x1 - 0.5, SZ = z0 + 0.52
    box(M.white, 0.92, 0.04, 0.92, SX, 0.05, SZ)
    // The glass screen stands between the shower and the toilet; the shower is open to the room on its west
    // side, so nobody is ever boxed in between the tray and the toilet.
    const screen = solid(M.frost, new THREE.BoxGeometry(0.92, 1.95, 0.02), SX, 1.05, SZ + 0.46)
    screen.castShadow = false
    block(SX, SZ + 0.46, 0.46, 0.04)
    on(c.walls.east, () => {
      box(M.tile, 0.02, 1.5, z1 - z0 - 0.12, x1 - 0.1, 0.05, (z0 + z1) / 2 - 0.03) // stands proud of the brick skirting
      rod(M.chrome, 0.012, 0.42, x1 - 0.21, 2.05, SZ, 'x')
      cyl(M.chrome, 0.11, 0.11, 0.015, SX + 0.1, 2.03, SZ, 16)
      rod(M.chrome, 0.03, 0.05, x1 - 0.13, 1.15, SZ, 'x')
      rod(M.white, 0.055, 0.1, x1 - 0.17, 0.7, TZ - 0.45, 'z') // paper roll
    })
    // Falling water: thin streaks that only show while the shower runs.
    const rain = new THREE.MeshBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0, depthWrite: false })
    const drops: THREE.Mesh[] = []
    for (let i = 0; i < 14; i++) {
      const dm = solid(rain, new THREE.BoxGeometry(0.014, 0.42, 0.014), SX + 0.1 + Math.cos(i * 2.4) * (0.03 + (i % 3) * 0.035), 1.5, SZ + Math.sin(i * 2.4) * (0.03 + (i % 3) * 0.035))
      dm.castShadow = false; dm.visible = false; dm.userData.ghost = true; dm.raycast = () => undefined
      drops.push(dm)
    }
    let showerUntil = 0
    screen.onBeforeRender = () => {
      rain.opacity += ((now() < showerUntil ? 0.8 : 0) - rain.opacity) * 0.15
      drops.forEach((dm, i) => { dm.visible = rain.opacity > 0.02; dm.position.y = 1.8 - ((now() * 2.4 + i * 0.37) % 1.5) })
    }
    // Towels on a rail by the door, a bath mat by the shower.
    on(south, () => {
      box(M.tile, x1 - x0 - 1.2, 1.5, 0.02, (x0 + x1) / 2 + 0.55, 0.05, z1 - 0.072)
      rod(M.chrome, 0.01, 0.7, 8.78, 1.25, z1 - 0.12, 'x')
      box(M.towel, 0.3, 0.5, 0.03, 8.62, 0.77, z1 - 0.12); box(M.cloth3, 0.3, 0.42, 0.03, 8.95, 0.85, z1 - 0.12)
    })
    box(M.towel, 0.6, 0.015, 0.4, SX - 0.85, 0.052, SZ + 0.1)
    c.use({ id: 'shower', x: SX - 0.75, z: SZ + 0.1, r: 0.75, title: 'Shower', body: 'Hot water, a rain head and clean towels.', enter: 'Take a shower', run: () => {
      showerUntil = now() + 5
      c.busy(4.5, c.ox + SX + 0.1, c.oz + SZ, -Math.PI / 2)
      c.toast('Hot shower. You feel fresh.')
    } })
    c.use({ id: 'basin', x: VX, z: VZ + 0.8, r: 0.7, title: 'Basin', body: 'Wash your face and brush your teeth.', enter: 'Freshen up', run: () => { c.busy(1.8, c.ox + VX, c.oz + VZ + 0.62, Math.PI); c.toast('Teeth brushed, face washed.') } })
    c.use({ id: 'toilet', x: TX - 0.8, z: TZ, r: 0.7, title: 'Toilet', body: 'Nature calls.', enter: 'Use the toilet', run: () => { c.sit({ x: c.ox + TX - 0.14, z: c.oz + TZ, yaw: -Math.PI / 2, y: 0.42 }); c.toast('Remember to wash your hands.') } })
  }

  // =================== LAUNDRY (south-east corner) ===================
  {
    const LX = 9.45, LZ = d / 2 - 0.42
    const machine = solid(M.white, new THREE.BoxGeometry(0.62, 0.86, 0.62), LX, 0.43, LZ)
    block(LX, LZ, 0.34, 0.34)
    on(machine, () => {
      box(M.dark, 0.56, 0.1, 0.01, LX, 0.71, LZ - 0.312)
      put(M.chrome, new THREE.TorusGeometry(0.2, 0.025, 8, 24), LX, 0.41, LZ - 0.316)
      for (const dx of [-0.2, -0.12]) put(M.chrome, new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), LX + dx, 0.76, LZ - 0.32, 0, Math.PI / 2)
      box(M.blue, 0.1, 0.22, 0.07, LX + 0.18, 0.86, LZ + 0.1) // detergent on top
    })
    // Clothes behind the glass: three coloured lobes that tumble while the drum turns.
    const drum = solid(M.ovenGlass, new THREE.CylinderGeometry(0.185, 0.185, 0.02, 20).rotateX(Math.PI / 2), 0, -0.02, -0.312, machine)
    drum.raycast = () => undefined
    for (const [a, m] of [[0, M.cloth1], [2.1, M.cloth2], [4.2, M.cloth3]] as const) { const lobe = solid(m, new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1, 0.2), Math.cos(a) * 0.08, Math.sin(a) * 0.08, -0.014, drum); lobe.castShadow = false; lobe.raycast = () => undefined }
    let washUntil = 0
    machine.onBeforeRender = () => { if (now() < washUntil) drum.rotation.z = now() * 6 }
    // A basket of washing and a drying rack with clothes on it.
    cyl(M.basket, 0.22, 0.17, 0.36, LX - 0.75, 0.04, LZ + 0.02, 14)
    for (const [dx, dz, m] of [[-0.05, 0, M.cloth2], [0.06, 0.05, M.cloth1], [0, -0.07, M.cloth3]] as const) ball(m, 0.1, LX - 0.75 + dx, 0.42, LZ + dz, 0.7)
    const RX = LX + 0.2, RZ = LZ - 1.35
    block(RX, RZ, 0.2, 0.5)
    for (const sz of [-0.46, 0.46]) { box(M.chrome, 0.36, 0.016, 0.016, RX, 1.03, RZ + sz); for (const sx of [-0.17, 0.17]) box(M.chrome, 0.016, 1.0, 0.016, RX + sx, 0.04, RZ + sz) }
    for (const dx of [-0.14, 0, 0.14]) rod(M.chrome, 0.007, 0.92, RX + dx, 1.04, RZ, 'z')
    for (const [dx, dz, m, h] of [[-0.14, -0.26, M.cloth1, 0.5], [0, 0.05, M.cloth3, 0.42], [0.14, 0.28, M.cloth2, 0.55], [-0.14, 0.24, M.towel, 0.36]] as const) box(m, 0.022, h, 0.26, RX + dx, 1.04 - h, RZ + dz)
    c.use({ id: 'laundry', x: LX - 0.2, z: LZ - 0.8, r: 0.8, title: 'Washing machine', body: 'A basket of clothes and a rack to dry them on.', enter: 'Do the laundry', run: () => {
      washUntil = now() + 7
      c.busy(2.2, c.ox + LX, c.oz + LZ - 0.7, 0)
      c.toast('Laundry on. Clean clothes for tomorrow.')
    } })
  }

  // =================== GARDEN (a planter beside the pool) and a lounger to rest on ===================
  {
    const GX = 4.98, G0 = 3.7, G1 = 6.9, mid = (G0 + G1) / 2
    solid(M.terracotta, new THREE.BoxGeometry(0.46, 0.42, G1 - G0), GX, 0.21, mid)
    block(GX, mid, 0.26, (G1 - G0) / 2)
    box(M.soil, 0.38, 0.02, G1 - G0 - 0.08, GX, 0.405, mid)
    const leaf = foliageMaterial()
    // Tomatoes and peppers on canes with herbs between them: leafy clumps with fruit showing.
    const clumps: THREE.BufferGeometry[] = []
    for (let i = 0; i < 6; i++) {
      const z = G0 + 0.3 + i * 0.52, tall = i % 2 === 0
      clumps.push(shrubGeometry(40 + i, 9).scale(0.21, tall ? 0.34 : 0.2, 0.21).translate(GX, tall ? 0.74 : 0.56, z))
      if (tall) { cyl(M.oak, 0.008, 0.008, 0.7, GX, 0.42, z, 5); for (const [dx, dy, dz] of [[0.1, 0.62, 0.03], [-0.09, 0.74, -0.04], [0.03, 0.88, 0.09]] as const) ball(i === 2 ? M.yellow : M.red, 0.03, GX + dx, dy, z + dz) }
    }
    const plants = solid(leaf, mergeGeometries(clumps)!, 0, 0, 0)
    plants.userData.ghost = true
    plants.raycast = () => undefined
    // Watering can.
    cyl(M.steel, 0.09, 0.09, 0.18, GX + 0.45, 0.04, G0 + 0.1, 12); put(M.steel, new THREE.CylinderGeometry(0.012, 0.018, 0.22, 8), GX + 0.58, 0.16, G0 + 0.1, 0, 0, -0.9); put(M.steel, new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), GX + 0.45, 0.22, G0 + 0.1)
    c.use({ id: 'garden', x: GX + 0.6, z: mid, r: 0.9, title: 'Kitchen garden', body: 'Tomatoes, peppers and herbs in a planter by the water.', enter: 'Tend the garden', run: () => {
      c.busy(2.4, c.ox + GX + 0.55, c.oz + mid, -Math.PI / 2)
      c.toast('Watered, weeded, and three ripe tomatoes picked.')
    } })
    // Sun lounger at the south end of the pool.
    const PX = 7.35, PZ = d / 2 - 0.5
    solid(M.oak, new THREE.BoxGeometry(1.9, 0.06, 0.62), PX, 0.27, PZ)
    block(PX, PZ, 0.95, 0.3)
    for (const sx of [-0.85, 0.85]) for (const sz of [-0.26, 0.26]) box(M.oak, 0.05, 0.24, 0.05, PX + sx, 0.04, PZ + sz)
    box(M.cushion, 1.84, 0.08, 0.56, PX, 0.3, PZ)
    box(M.towel, 0.4, 0.07, 0.44, PX - 0.68, 0.38, PZ)
    c.use({ id: 'lounger', x: PX, z: PZ - 0.75, r: 0.8, title: 'Pool lounger', body: 'Put your feet up by the water.', enter: 'Lie down and rest', run: () => {
      c.sit({ x: c.ox + PX + 0.85, z: c.oz + PZ, yaw: Math.PI / 2, y: 0.38, pose: 'lie' }) // head to the west end
      c.toast('Feet up by the pool. Rested.')
    } })
  }

  // =================== WORK FROM HOME (the bedroom desk) ===================
  c.use({ id: 'remote', x: 0.3, z: 2.45, r: 0.7, title: 'Work from home', body: 'Laptop open on the desk. A quiet hour of focused work.', enter: 'Sit down to work', run: () => {
    c.sit({ x: c.ox + 1.3, z: c.oz + 2.35, yaw: Math.PI, y: 0.48 })
    c.toast('Head down. A focused hour of remote work.')
  } })

  // Small things never block the view on their own and are skipped by the cut-away's rays.
  for (const [a, per] of bags) for (const [m, list] of per) {
    const merged = mergeGeometries(list)
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, m)
    mesh.castShadow = !(m as THREE.MeshStandardMaterial).transparent
    mesh.receiveShadow = true
    mesh.userData.ghost = true
    mesh.raycast = () => undefined
    group.add(mesh)
    if (a !== group) a.attach(mesh)
  }
}
