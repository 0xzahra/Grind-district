// Street cars, all of them the detailed designs (finecars.ts: saloons, a sport saloon, a grand tourer, an electric
// coupé, a supercar, a hypercar), drawn the efficient way: each design is built once, its parts merged by
// material, and every car of that design is one instance of those merged parts, so the whole fleet costs a fixed
// handful of draw calls however many cars drive. Paint is per car (instance colour); the wheels are separate
// instances so they turn as the car rolls. Same interface as cars.ts createFleet, so traffic and the parked cars
// use it unchanged. Taxis are a yellow saloon with the roof sign.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fineCar } from './finecars.ts'
import type { CarKind } from './cars.ts'

/** Which design each body type drives as: sporty types get the low cars, family types the saloons. */
const BY_KIND: Record<CarKind, string[]> = {
  sports: ['supercar', 'tourer', 'hypercar', 'evcoupe'],
  sedan: ['saloon', 'executive', 'sportsaloon'],
  hatchback: ['evcoupe', 'sportsaloon', 'saloon'],
  suv: ['executive', 'tourer', 'saloon'],
  taxi: ['saloon'],
  van: ['executive', 'sportsaloon'],
  pickup: ['sportsaloon', 'tourer'],
  minibus: ['executive'],
} as Record<CarKind, string[]>
export const modelFor = (kind: CarKind, i: number): string => { const list = BY_KIND[kind] ?? ['saloon']; return list[i % list.length]! }

type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; paint: boolean }
type Baked = { body: Part[]; wheel: Part[]; wheels: Array<{ pos: THREE.Vector3; flip: number }>; r: number; length: number; width: number; height: number }
const baked = new Map<string, Baked>()

const matKey = (m: THREE.Material) => {
  const a = m as THREE.MeshStandardMaterial & { clearcoat?: number }
  return `${m.type}|${a.color?.getHexString?.() ?? ''}|${a.roughness ?? ''}|${a.metalness ?? ''}|${a.clearcoat ?? ''}|${a.transparent ? 1 : 0}|${(a as { emissive?: THREE.Color }).emissive?.getHexString?.() ?? ''}`
}
/** Merge every mesh under `root` (in `root`'s own frame) into one geometry per material. */
function mergeUnder(root: THREE.Object3D, skip: (o: THREE.Object3D) => boolean, paintMat: THREE.Material | null): Part[] {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>()
  const walk = (o: THREE.Object3D) => {
    if (o !== root && skip(o)) return
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && mesh.geometry && !Array.isArray(mesh.material)) {
      const mat = mesh.material as THREE.Material
      let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
      if (!g.getAttribute('normal')) g.computeVertexNormals()
      g = g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld))
      const key = mat === paintMat ? 'paint' : matKey(mat)
      const e = groups.get(key) ?? { mat, geos: [] }
      e.geos.push(g); groups.set(key, e)
    }
    for (const c of o.children) walk(c)
  }
  walk(root)
  return [...groups.entries()].map(([k, e]) => ({ geo: mergeGeometries(e.geos)!, mat: e.mat, paint: k === 'paint' }))
}
function bake(model: string): Baked {
  const hit = baked.get(model)
  if (hit) return hit
  const g = fineCar(model)
  g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.updateMatrixWorld(true)
  const rims = g.children.filter((c) => (c as THREE.Group).isGroup && !(c as THREE.Mesh).isMesh)
  // The paint is the body's biggest mesh's material.
  let paintMat: THREE.Material | null = null, most = 0
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !rims.some((r) => r === m.parent || r === m)) { const n = m.geometry.getAttribute('position')?.count ?? 0; if (n > most) { most = n; paintMat = m.material as THREE.Material } } })
  const body = mergeUnder(g, (o) => rims.includes(o), paintMat)
  const wheel = rims[0] ? mergeUnder(rims[0], () => false, null) : []
  const box = new THREE.Box3().setFromObject(g)
  const out: Baked = {
    body, wheel,
    wheels: rims.map((r) => ({ pos: r.position.clone(), flip: Math.abs(r.rotation.y) > 1 ? Math.PI : 0 })),
    r: rims[0]?.position.y ?? 0.35, length: box.max.z - box.min.z, width: box.max.x - box.min.x, height: box.max.y,
  }
  baked.set(model, out)
  return out
}

export function createFineFleet(scene: THREE.Scene, kinds: CarKind[], opts: { shadows: boolean; colours?: number[] }) {
  const models = kinds.map((k, i) => modelFor(k, i))
  const byModel = new Map<string, number[]>()
  models.forEach((m, i) => { const l = byModel.get(m) ?? []; l.push(i); byModel.set(m, l) })
  const prep = <T extends THREE.InstancedMesh>(m: T, cast: boolean): T => {
    m.castShadow = cast; m.receiveShadow = false; m.frustumCulled = false
    m.userData.ghost = true; m.raycast = () => undefined
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(m)
    return m
  }
  const slot: Array<{ model: string; i: number }> = []
  const sets = new Map<string, { b: Baked; body: THREE.InstancedMesh[]; wheels: THREE.InstancedMesh[] }>()
  const col = new THREE.Color()
  for (const [model, ids] of byModel) {
    const b = bake(model)
    const body = b.body.map((p) => {
      // Paint takes each car's own colour: a white copy of the paint, tinted per instance.
      const mat = p.paint ? (() => { const c = (p.mat as THREE.MeshPhysicalMaterial).clone(); c.color.set(0xffffff); return c })() : p.mat
      const m = prep(new THREE.InstancedMesh(p.geo, mat, ids.length), opts.shadows && p.paint)
      if (p.paint) { ids.forEach((id, i) => m.setColorAt(i, col.setHex(opts.colours?.[id] ?? 0x3c4046))); if (m.instanceColor) m.instanceColor.needsUpdate = true }
      return m
    })
    const wheels = b.wheel.map((p) => prep(new THREE.InstancedMesh(p.geo, p.mat, ids.length * b.wheels.length), false))
    ids.forEach((id, i) => { slot[id] = { model, i } })
    sets.set(model, { b, body, wheels })
  }
  // Soft blob shadows under every car (cheap, and they read well on phones).
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32)
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  const shadows = prep(new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), kinds.length), false)
  shadows.renderOrder = 1
  // Taxi roof signs.
  const taxiIds = kinds.map((k, i) => (k === 'taxi' ? i : -1)).filter((i) => i >= 0)
  let signs: THREE.InstancedMesh | null = null
  const signSlot: number[] = []
  if (taxiIds.length) {
    const logo = new THREE.TextureLoader().load('/brand/logo-car.jpg'); logo.colorSpace = THREE.SRGBColorSpace
    const side = new THREE.MeshStandardMaterial({ map: logo, roughness: 0.5, emissive: 0xffffff, emissiveMap: logo, emissiveIntensity: 0.25 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 })
    signs = prep(new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.26, 0.56), [side, side, dark, dark, dark, dark], taxiIds.length), false)
    taxiIds.forEach((id, k) => { signSlot[id] = k })
  }
  const spin = new Float32Array(kinds.length)
  const m = new THREE.Matrix4(), w = new THREE.Matrix4(), off = new THREE.Matrix4(), rot = new THREE.Matrix4(), ry = new THREE.Matrix4()
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  const touched = new Set<THREE.InstancedMesh>()
  return {
    length: (id: number) => sets.get(slot[id]!.model)!.b.length,
    model: (id: number) => slot[id]!.model,
    /** Place car `id`; `dist` is how far it moved this frame (turns the wheels). */
    set(id: number, x: number, z: number, heading: number, dist: number, visible = true) {
      const s = slot[id]!, k = sets.get(s.model)!, b = k.b
      if (!visible) {
        for (const mesh of k.body) { mesh.setMatrixAt(s.i, zero); touched.add(mesh) }
        for (const mesh of k.wheels) for (let j = 0; j < b.wheels.length; j++) { mesh.setMatrixAt(s.i * b.wheels.length + j, zero); touched.add(mesh) }
        shadows.setMatrixAt(id, zero); touched.add(shadows)
        if (signs && signSlot[id] !== undefined) { signs.setMatrixAt(signSlot[id]!, zero); touched.add(signs) }
        return
      }
      q.setFromAxisAngle(Y, heading)
      m.compose(v.set(x, 0, z), q, one)
      for (const mesh of k.body) { mesh.setMatrixAt(s.i, m); touched.add(mesh) }
      spin[id] = (spin[id]! + dist / b.r) % (Math.PI * 2)
      b.wheels.forEach((wh, j) => {
        off.makeTranslation(wh.pos.x, wh.pos.y, wh.pos.z)
        ry.makeRotationY(wh.flip)
        rot.makeRotationX(wh.flip ? -spin[id]! : spin[id]!)
        w.copy(m).multiply(off).multiply(ry).multiply(rot)
        for (const mesh of k.wheels) { mesh.setMatrixAt(s.i * b.wheels.length + j, w); touched.add(mesh) }
      })
      shadows.setMatrixAt(id, w.compose(v.set(x, 0.02, z), q, sc.set(b.width + 0.5, 1, b.length + 0.4))); touched.add(shadows)
      if (signs && signSlot[id] !== undefined) { off.makeTranslation(0, b.height + 0.12, -0.2); signs.setMatrixAt(signSlot[id]!, w.copy(m).multiply(off)); touched.add(signs) }
    },
    commit() { for (const mesh of touched) mesh.instanceMatrix.needsUpdate = true; touched.clear() },
  }
}
