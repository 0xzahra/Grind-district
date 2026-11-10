// Low-poly car kit: eight body types built from a bevelled side profile with real wheel arches.
// Every type is instanced (body, glass, lamps), all wheels share one instanced mesh, so a full street
// of mixed traffic stays at a few dozen draw calls on phones. Paint is a per-instance colour.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const CAR_KINDS = ['hatchback', 'sedan', 'suv', 'taxi', 'minibus', 'pickup', 'van', 'sports'] as const
export type CarKind = (typeof CAR_KINDS)[number]

type Profile = {
  L: number; W: number; H: number; clr: number; belt: number; beltR: number; nose: number; tail: number
  bonnet: number; boot: number; fRake: number; rRake: number; r: number; wb: number; bed?: boolean; pillars?: number
}
const P: Record<CarKind, Profile> = {
  hatchback: { L: 3.95, W: 1.76, H: 1.5, clr: 0.2, belt: 0.92, beltR: 0.98, nose: 0.78, tail: 1.0, bonnet: 0.85, boot: 0.2, fRake: 0.62, rRake: 0.28, r: 0.31, wb: 2.5 },
  sedan: { L: 4.65, W: 1.8, H: 1.44, clr: 0.2, belt: 0.9, beltR: 0.94, nose: 0.76, tail: 0.94, bonnet: 1.15, boot: 0.85, fRake: 0.72, rRake: 0.55, r: 0.32, wb: 2.75 },
  suv: { L: 4.6, W: 1.9, H: 1.74, clr: 0.3, belt: 1.1, beltR: 1.14, nose: 0.98, tail: 1.14, bonnet: 1.0, boot: 0.12, fRake: 0.55, rRake: 0.18, r: 0.37, wb: 2.75 },
  taxi: { L: 4.65, W: 1.8, H: 1.44, clr: 0.2, belt: 0.9, beltR: 0.94, nose: 0.76, tail: 0.94, bonnet: 1.15, boot: 0.85, fRake: 0.72, rRake: 0.55, r: 0.32, wb: 2.75 },
  minibus: { L: 5.3, W: 1.98, H: 2.2, clr: 0.24, belt: 1.05, beltR: 1.05, nose: 0.95, tail: 1.05, bonnet: 0.45, boot: 0.06, fRake: 0.45, rRake: 0.06, r: 0.34, wb: 3.2, pillars: 3 },
  pickup: { L: 5.2, W: 1.92, H: 1.8, clr: 0.32, belt: 1.1, beltR: 1.1, nose: 1.0, tail: 1.1, bonnet: 1.15, boot: 2.05, fRake: 0.5, rRake: 0.08, r: 0.38, wb: 3.1, bed: true },
  van: { L: 5.0, W: 1.95, H: 1.88, clr: 0.24, belt: 1.05, beltR: 1.05, nose: 0.95, tail: 2.0, bonnet: 0.75, boot: 3.35, fRake: 0.5, rRake: 0.05, r: 0.34, wb: 3.1 },
  sports: { L: 4.35, W: 1.88, H: 1.16, clr: 0.14, belt: 0.74, beltR: 0.8, nose: 0.6, tail: 0.82, bonnet: 1.45, boot: 0.72, fRake: 0.85, rRake: 0.72, r: 0.33, wb: 2.6 },
}
export const carLength = (k: CarKind) => P[k].L

const PALETTE = [0xf2efe8, 0xb9c0c7, 0x4f86c6, 0xc8433a, 0xd9b26a, 0x2f8f83, 0xe07b3a, 0x3d6b4f, 0x2c4a7a, 0x5a5f66, 0x8e3a5a, 0xd8cdb8]
const FLEET = [0xf2efe8, 0xd8cdb8, 0x2f8f83, 0x4f86c6] // vans and minibuses wear calm fleet colours
export function carColour(kind: CarKind, i: number): number {
  if (kind === 'taxi') return 0xf2c230
  if (kind === 'minibus' || kind === 'van') return FLEET[(i >> 1) % FLEET.length]!
  return PALETTE[(i * 5 + kind.length) % PALETTE.length]!
}

function colour(g: THREE.BufferGeometry, c: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = c; a[i * 3 + 1] = c; a[i * 3 + 2] = c }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}
function tint(g: THREE.BufferGeometry, r: number, gg: number, b: number): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}
const clean = (g: THREE.BufferGeometry) => {
  const out = g.index ? g.toNonIndexed() : g
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(k)) out.deleteAttribute(k)
  return out
}
/** Extrude a side profile (x = length, y = height) across the car width and turn it so +z is forward. */
function extrude(shape: THREE.Shape, width: number, bevel = 0.03): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 7 })
  g.translate(0, 0, -(width - bevel * 2) / 2)
  g.rotateY(-Math.PI / 2)
  return g
}

export function carGeometry(kind: CarKind) {
  const p = P[kind]
  const { L, W, H, clr, r, wb } = p
  const front = L / 2, rear = -L / 2
  const arch = r + 0.07
  const s = new THREE.Shape()
  s.moveTo(rear + 0.14, clr)
  s.lineTo(-wb / 2 - arch, clr)
  s.lineTo(-wb / 2 - arch, r)
  s.absarc(-wb / 2, r, arch, Math.PI, 0, true)
  s.lineTo(-wb / 2 + arch, clr)
  s.lineTo(wb / 2 - arch, clr)
  s.lineTo(wb / 2 - arch, r)
  s.absarc(wb / 2, r, arch, Math.PI, 0, true)
  s.lineTo(wb / 2 + arch, clr)
  s.lineTo(front - 0.14, clr)
  s.lineTo(front, clr + 0.2)
  s.lineTo(front, p.nose - 0.1)
  s.lineTo(front - 0.12, p.nose)
  s.lineTo(front - p.bonnet, p.belt)
  const cabBack = rear + p.boot
  if (p.tail > p.beltR + 0.3) {
    // Panel van: the cargo box rises behind the cab.
    s.lineTo(cabBack, p.belt)
    s.lineTo(cabBack, p.tail)
    s.lineTo(rear + 0.06, p.tail)
    s.lineTo(rear, p.tail - 0.08)
  } else {
    if (p.bed) {
      // Open load bed: the body drops to the bed floor behind the cab (walls and tailgate are added below).
      s.lineTo(cabBack, p.beltR)
      s.lineTo(cabBack, p.beltR - 0.36)
      s.lineTo(rear, p.beltR - 0.36)
    } else { s.lineTo(cabBack, p.beltR); s.lineTo(rear + 0.1, p.tail); s.lineTo(rear, p.tail - 0.1) }
  }
  s.lineTo(rear, clr + 0.18)
  s.closePath()
  const parts: THREE.BufferGeometry[] = [colour(clean(extrude(s, W, 0.04)), 1)]

  // Greenhouse: glass band, painted roof and pillars.
  const gTop = H - 0.07
  const gb = p.tail > p.beltR + 0.3 ? p.belt : p.beltR
  const glassShape = new THREE.Shape([
    new THREE.Vector2(cabBack, gb), new THREE.Vector2(cabBack + p.rRake, gTop),
    new THREE.Vector2(front - p.bonnet - p.fRake, gTop), new THREE.Vector2(front - p.bonnet, p.belt),
  ])
  const glass = clean(extrude(glassShape, W - 0.16, 0.02))
  const roofShape = new THREE.Shape([
    new THREE.Vector2(cabBack + p.rRake - 0.03, gTop - 0.02), new THREE.Vector2(front - p.bonnet - p.fRake + 0.03, gTop - 0.02),
    new THREE.Vector2(front - p.bonnet - p.fRake - 0.03, H), new THREE.Vector2(cabBack + p.rRake + 0.03, H),
  ])
  parts.push(colour(clean(extrude(roofShape, W - 0.1, 0.03)), 1))
  const glassLen = front - p.bonnet - p.fRake - (cabBack + p.rRake)
  const n = p.pillars ?? (glassLen > 1.3 ? 1 : 0)
  for (let k = 1; k <= n; k++) {
    const z = cabBack + p.rRake + (glassLen * k) / (n + 1)
    parts.push(colour(clean(new THREE.BoxGeometry(W - 0.12, gTop - gb, 0.1).translate(0, (gTop + gb) / 2, z)), 1))
  }
  // A-pillars and C-pillars follow the rake: thin painted strips along each glass edge.
  for (const [z0, y0, z1, y1] of [[front - p.bonnet, p.belt, front - p.bonnet - p.fRake, gTop], [cabBack, gb, cabBack + p.rRake, gTop]] as const) {
    const len = Math.hypot(z1 - z0, y1 - y0)
    const pillar = new THREE.BoxGeometry(W - 0.13, len, 0.08)
    pillar.rotateX(Math.atan2(z1 - z0, y1 - y0)).translate(0, (y0 + y1) / 2, (z0 + z1) / 2)
    parts.push(colour(clean(pillar), 1))
  }

  // Dark trim: bumpers, grille, sills, mirrors; roof rails on the SUV; open bed on the pickup.
  const T = 0.08
  const trim = (w: number, h: number, d: number, x: number, y: number, z: number) => parts.push(colour(clean(new THREE.BoxGeometry(w, h, d).translate(x, y, z)), T))
  trim(W + 0.02, 0.16, 0.12, 0, clr + 0.1, front - 0.04)
  trim(W + 0.02, 0.16, 0.12, 0, clr + 0.1, rear + 0.04)
  trim(W * 0.52, Math.max(0.12, p.nose - clr - 0.42), 0.04, 0, clr + 0.3 + Math.max(0.12, p.nose - clr - 0.42) / 2, front + 0.005)
  trim(W + 0.03, 0.08, wb - 2 * arch - 0.1, 0, clr + 0.05, 0)
  for (const sx of [-1, 1]) trim(0.16, 0.1, 0.12, sx * (W / 2 + 0.05), p.belt + 0.06, front - p.bonnet - 0.05)
  if (kind === 'suv') for (const sx of [-1, 1]) trim(0.05, 0.05, glassLen * 0.9, sx * (W / 2 - 0.2), H + 0.04, cabBack + p.rRake + glassLen / 2)
  if (p.bed) {
    const wall = (w: number, d: number, x: number, z: number) => parts.push(colour(clean(new THREE.BoxGeometry(w, 0.38, d).translate(x, p.beltR - 0.17, z)), 1))
    for (const sx of [-1, 1]) wall(0.09, p.boot, sx * (W / 2 - 0.045), rear + p.boot / 2)
    wall(W, 0.09, 0, rear + 0.045)
    trim(W - 0.2, 0.03, p.boot - 0.12, 0, p.beltR - 0.345, rear + p.boot / 2) // bed liner
    trim(W * 0.5, 0.05, 0.02, 0, p.beltR - 0.12, rear - 0.005) // tailgate handle
  }
  const body = mergeGeometries(parts)!

  // Lamps: warm white heads, red tails (vertex colours, unlit material).
  const lamp: THREE.BufferGeometry[] = []
  const hy = p.nose - 0.13
  for (const sx of [-1, 1]) {
    lamp.push(tint(clean(new THREE.BoxGeometry(0.4, 0.13, 0.06).translate(sx * (W / 2 - 0.3), hy, front + 0.012)), 1, 0.96, 0.84))
    const ty = (p.tail > p.beltR + 0.3 ? p.belt : p.tail) - 0.16
    lamp.push(tint(clean(new THREE.BoxGeometry(p.tail > 1.6 ? 0.13 : 0.4, p.tail > 1.6 ? 0.5 : 0.12, 0.06).translate(sx * (W / 2 - 0.24), p.tail > 1.6 ? 0.9 : p.bed ? p.beltR - 0.2 : ty, rear - 0.012)), 0.92, 0.1, 0.1))
  }
  return { body, glass, lamps: mergeGeometries(lamp)!, wheel: { r: r * 1.06, track: W / 2 - 0.11, base: wb / 2 }, roofSign: kind === 'taxi', height: H, length: L, width: W }
}

/** Shared wheel: tyre + alloy rim + hub, vertex coloured, axle along x. */
function wheelGeometry(): THREE.BufferGeometry {
  const tyre = colour(clean(new THREE.CylinderGeometry(1, 1, 0.22, 14).rotateZ(Math.PI / 2)), 0.05)
  const rim = colour(clean(new THREE.CylinderGeometry(0.62, 0.62, 0.235, 8).rotateZ(Math.PI / 2)), 0.86)
  const hub = colour(clean(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 6).rotateZ(Math.PI / 2)), 0.25)
  return mergeGeometries([tyre, rim, hub])!
}

export type Fleet = ReturnType<typeof createFleet>

/** One instanced fleet. `kinds` gives each car's body type (index = car id). */
export function createFleet(scene: THREE.Scene, kinds: CarKind[], opts: { shadows: boolean; colours?: number[] }) {
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.12, envMapIntensity: 0.7 })
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x33434e, roughness: 0.05, metalness: 0.55, envMapIntensity: 1.5 })
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.25 })
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32)
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const byKind = new Map<CarKind, number[]>()
  kinds.forEach((k, i) => { const list = byKind.get(k) ?? []; list.push(i); byKind.set(k, list) })
  const slot: Array<{ kind: CarKind; i: number }> = []
  const meshes = new Map<CarKind, { body: THREE.InstancedMesh; glass: THREE.InstancedMesh; lamps: THREE.InstancedMesh; geo: ReturnType<typeof carGeometry>; wheelScale: THREE.Matrix4 }>()
  const prep = (m: THREE.InstancedMesh, cast: boolean) => {
    m.castShadow = cast
    m.receiveShadow = false
    m.frustumCulled = false
    m.userData.ghost = true
    m.raycast = () => undefined
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(m)
    return m
  }
  const c = new THREE.Color()
  for (const [kind, ids] of byKind) {
    const geo = carGeometry(kind)
    const body = prep(new THREE.InstancedMesh(geo.body, paint, ids.length), opts.shadows)
    const glass = prep(new THREE.InstancedMesh(geo.glass, glassMat, ids.length), false)
    const lamps = prep(new THREE.InstancedMesh(geo.lamps, lampMat, ids.length), false)
    ids.forEach((id, i) => { slot[id] = { kind, i }; body.setColorAt(i, c.setHex(opts.colours?.[id] ?? carColour(kind, id))) })
    if (body.instanceColor) body.instanceColor.needsUpdate = true
    meshes.set(kind, { body, glass, lamps, geo, wheelScale: new THREE.Matrix4().makeScale(1, geo.wheel.r, geo.wheel.r) })
  }
  const wheels = prep(new THREE.InstancedMesh(wheelGeometry(), wheelMat, kinds.length * 4), opts.shadows)
  const shadows = prep(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMat, kinds.length), false)
  const shadowScale = new THREE.Vector3()
  shadows.renderOrder = 1
  const taxis = kinds.filter((k) => k === 'taxi').length
  let signs: THREE.InstancedMesh | null = null
  const signSlot: number[] = []
  if (taxis) {
    const logo = new THREE.TextureLoader().load('/brand/logo-car.jpg')
    logo.colorSpace = THREE.SRGBColorSpace
    const side = new THREE.MeshStandardMaterial({ map: logo, roughness: 0.5, emissive: 0xffffff, emissiveMap: logo, emissiveIntensity: 0.25 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 })
    signs = prep(new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.26, 0.56), [side, side, dark, dark, dark, dark], taxis), false)
    let t = 0
    kinds.forEach((k, id) => { if (k === 'taxi') signSlot[id] = t++ })
  }
  const spin = new Float32Array(kinds.length)
  const m = new THREE.Matrix4(), w = new THREE.Matrix4(), rot = new THREE.Matrix4(), off = new THREE.Matrix4()
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0)
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  const touched = new Set<THREE.InstancedMesh>()
  return {
    length: (id: number) => meshes.get(slot[id]!.kind)!.geo.length,
    /** Place car `id`; `dist` is how far it moved this frame (spins the wheels). */
    set(id: number, x: number, z: number, heading: number, dist: number, visible = true) {
      const s = slot[id]!
      const k = meshes.get(s.kind)!
      if (!visible) {
        for (const mesh of [k.body, k.glass, k.lamps]) { mesh.setMatrixAt(s.i, zero); touched.add(mesh) }
        for (let j = 0; j < 4; j++) wheels.setMatrixAt(id * 4 + j, zero)
        shadows.setMatrixAt(id, zero)
        if (signs && signSlot[id] !== undefined) signs.setMatrixAt(signSlot[id]!, zero)
        touched.add(wheels); touched.add(shadows)
        return
      }
      m.compose(v.set(x, 0, z), q.setFromAxisAngle(Y, heading), one)
      for (const mesh of [k.body, k.glass, k.lamps]) { mesh.setMatrixAt(s.i, m); touched.add(mesh) }
      const wh = k.geo.wheel
      spin[id] = (spin[id]! + dist / wh.r) % (Math.PI * 2)
      rot.makeRotationX(spin[id]!)
      let j = 0
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        off.makeTranslation(sx * wh.track, wh.r, sz * wh.base)
        wheels.setMatrixAt(id * 4 + j++, w.copy(m).multiply(off).multiply(rot).multiply(k.wheelScale))
      }
      shadows.setMatrixAt(id, w.compose(v.set(x, 0.02, z), q, shadowScale.set(k.geo.width + 0.5, 1, k.geo.length + 0.4)))
      if (signs && signSlot[id] !== undefined) {
        off.makeTranslation(0, k.geo.height + 0.14, -0.15)
        signs.setMatrixAt(signSlot[id]!, w.copy(m).multiply(off))
        touched.add(signs)
      }
      touched.add(wheels); touched.add(shadows)
    },
    commit() {
      for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true
      touched.clear()
    },
  }
}
