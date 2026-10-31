// Real rigged, animated people: Quaternius "Animated Men/Women Pack" (CC0, via poly.pizza; see CREDITS.md).
// Packed by tools/pack-people.mjs (Idle/Walk/Run only, meshopt). Each model's 5-10 colour primitives are merged
// at load into ONE skinned mesh with vertex colours, so every person is a single draw call on phones.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ShrimpAvatar } from './shrimp.ts'

export const MEN = ['man1', 'man2', 'man3', 'man4'] as const
export const WOMEN = ['woman1', 'woman2', 'woman3', 'woman4'] as const
export type HumanModel = (typeof MEN)[number] | (typeof WOMEN)[number]
export type Look = { skin?: number; hair?: number; top?: number }

type Template = { scene: THREE.Group; clips: THREE.AnimationClip[]; parts: { name: string; start: number; count: number }[]; height: number }
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const cache = new Map<HumanModel, Promise<Template>>()
const sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, envMapIntensity: 0.7 }) // matte cloth/skin: no plastic sheen

function toFloat(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number): THREE.BufferAttribute {
  const out = new Float32Array(attr.count * size)
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = attr.getComponent(i, k)
  return new THREE.BufferAttribute(out, size)
}

function load(name: HumanModel): Promise<Template> {
  let p = cache.get(name)
  if (!p) {
    p = loader.loadAsync(`/models/people/${name}.glb`).then((gltf) => {
      const scene = gltf.scene
      const skinned: THREE.SkinnedMesh[] = []
      scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh) })
      const first = skinned[0]!
      const parts: Template['parts'] = []
      const geos: THREE.BufferGeometry[] = []
      let start = 0
      for (const m of skinned) {
        const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', toFloat(src.getAttribute('position'), 3))
        g.setAttribute('normal', toFloat(src.getAttribute('normal'), 3))
        g.setAttribute('skinWeight', toFloat(src.getAttribute('skinWeight'), 4))
        const si = src.getAttribute('skinIndex')
        const idx = new Uint16Array(si.count * 4)
        for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) idx[i * 4 + k] = si.getComponent(i, k)
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4))
        const col = new Float32Array(si.count * 3)
        const c = ((m.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0xcccccc))
        for (let i = 0; i < si.count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        parts.push({ name: (m.material as THREE.Material).name, start, count: si.count })
        start += si.count
        geos.push(g)
      }
      const merged = mergeGeometries(geos)!
      merged.computeBoundingSphere()
      const one = new THREE.SkinnedMesh(merged, sharedMat)
      one.name = 'Person'
      one.position.copy(first.position); one.quaternion.copy(first.quaternion); one.scale.copy(first.scale)
      first.parent!.add(one)
      one.bind(first.skeleton, first.bindMatrix)
      for (const m of skinned) m.removeFromParent()
      scene.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(scene, true)
      return { scene, clips: gltf.animations, parts, height: Math.max(0.1, box.max.y - box.min.y) }
    })
    cache.set(name, p)
  }
  return p
}

/** Warm the cache so the first city frame does not wait on people. */
export function preloadHumans(names: HumanModel[]): void { for (const n of names) void load(n).catch(() => undefined) }

// Makeup: soft lip tint and blush as tiny matte shapes on the head bone (3 meshes, player only).
export let MAKEUP_Y = 0.008, MAKEUP_Z = 0.132
export function tuneMakeup(y: number, z: number): void { MAKEUP_Y = y; MAKEUP_Z = z }
function makeupGroup(): THREE.Group {
  const g = new THREE.Group()
  const lip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb05a5a, roughness: 0.45 }))
  lip.scale.set(1.0, 0.36, 0.45)
  g.add(lip)
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.012, 14), new THREE.MeshStandardMaterial({ color: 0xd98c84, roughness: 1, transparent: true, opacity: 0.3, depthWrite: false }))
    b.position.set(s * 0.05, 0.042, -0.012); b.rotation.y = s * 0.45
    g.add(b)
  }
  return g
}

function wireGlasses(): THREE.Group {
  const g = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.2 })
  const lens = new THREE.MeshStandardMaterial({ color: 0xc8d4de, transparent: true, opacity: 0.18, roughness: 0.05 })
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0035, 6, 18), metal)
    ring.scale.set(1.15, 0.85, 1)
    ring.position.x = s * 0.038
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), lens)
    glass.scale.set(1.15, 0.85, 1)
    glass.position.x = s * 0.038
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.11), metal)
    temple.position.set(s * 0.075, 0.005, -0.055)
    g.add(ring, glass, temple)
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.004), metal)
  bridge.position.y = 0.012
  g.add(bridge)
  return g
}

/**
 * Swap a procedural avatar's body for a real animated person once the model loads.
 * The procedural body stays as the instant fallback (and if loading fails). Masks keep the procedural body.
 */
export function upgradeToHuman(avatar: ShrimpAvatar, model: HumanModel, opts: { look?: Look; glasses?: boolean; height?: number; makeup?: { lip?: number | null; blush?: number | null } } = {}): void {
  const root = avatar.object
  // The procedural body is the root child with the most descendants (it is the one face() rotates).
  let body: THREE.Object3D | null = null
  let most = -1
  for (const c of root.children) { let n = 0; c.traverse(() => { n++ }); if (n > most) { most = n; body = c } }
  if (!body) return
  const bodyRef = body
  void load(model).then((t) => {
    if (root.userData.masked) return
    const person = cloneSkinned(t.scene) as THREE.Group
    person.scale.setScalar((opts.height ?? 1.74) / t.height)
    person.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false } })
    const mesh = person.getObjectByName('Person') as THREE.SkinnedMesh
    const recolor = (look: Look) => {
      if (!mesh.userData.ownGeo) { mesh.geometry = mesh.geometry.clone(); mesh.userData.ownGeo = true }
      const geo = mesh.geometry
      const col = geo.getAttribute('color') as THREE.BufferAttribute
      const c = new THREE.Color()
      for (const p of t.parts) {
        const hex = /skin/i.test(p.name) ? look.skin : /^hair/i.test(p.name) ? look.hair : /shirt$|dress|^jacket/i.test(p.name) ? look.top : undefined
        if (hex === undefined) continue
        c.setHex(hex) // vertex colours are linear; setHex converts from sRGB
        for (let i = p.start; i < p.start + p.count; i++) col.setXYZ(i, c.r, c.g, c.b)
      }
      col.needsUpdate = true
    }
    const look = (root.userData.look as Look | undefined) ?? opts.look
    if (look) recolor(look)
    root.userData.applyLook = recolor
    if (opts.glasses) {
      person.updateMatrixWorld(true)
      const head = person.getObjectByName('Head')
      if (head) {
        const hp = new THREE.Vector3(); head.getWorldPosition(hp)
        const rootInv = new THREE.Matrix4().copy(person.matrixWorld).invert()
        const local = hp.clone().applyMatrix4(rootInv)
        const g = wireGlasses()
        // Place in the person's own frame at eye height, then reparent to the head bone so it follows the animation.
        g.position.set(local.x, local.y + 0.09 / person.scale.y, local.z + 0.11 / person.scale.z)
        g.scale.setScalar(1 / person.scale.x)
        person.add(g)
        person.updateMatrixWorld(true)
        head.attach(g)
      }
    }
    if (opts.makeup) {
      person.updateMatrixWorld(true)
      const head = person.getObjectByName('Head')
      if (head) {
        const hp = new THREE.Vector3(); head.getWorldPosition(hp)
        const local = hp.clone().applyMatrix4(new THREE.Matrix4().copy(person.matrixWorld).invert())
        const mk = makeupGroup()
        mk.position.set(local.x, local.y + MAKEUP_Y / person.scale.y, local.z + MAKEUP_Z / person.scale.z)
        mk.scale.setScalar(1 / person.scale.x)
        person.add(mk); person.updateMatrixWorld(true); head.attach(mk)
        const set = (lip?: number | null, blush?: number | null) => {
          const [l, b1, b2] = mk.children as THREE.Mesh[]
          l!.visible = lip != null; if (lip != null) (l!.material as THREE.MeshStandardMaterial).color.setHex(lip)
          for (const b of [b1!, b2!]) { b.visible = blush != null; if (blush != null) (b.material as THREE.MeshStandardMaterial).color.setHex(blush) }
        }
        set(opts.makeup.lip, opts.makeup.blush)
        root.userData.setMakeup = set
      }
    }
    root.userData.person = person
    root.userData.body = bodyRef
    bodyRef.visible = false
    root.add(person)
    const mixer = new THREE.AnimationMixer(person)
    const act = (n: string) => { const c = t.clips.find((k) => k.name === n); return c ? mixer.clipAction(c) : null }
    const idle = act('Idle'), walk = act('Walk'), run = act('Run')
    for (const a of [idle, walk, run]) if (a) { a.play(); a.setEffectiveWeight(0) }
    idle?.setEffectiveWeight(1)
    const w = { idle: 1, walk: 0, run: 0 }
    const baseFace = avatar.face
    avatar.face = (x, z, dt, moving) => { baseFace(x, z, dt, moving); person.rotation.y = bodyRef.rotation.y }
    avatar.step = (dt, moving, speed) => {
      const gi = moving ? 0 : 1, gr = moving && speed > 4.2 ? 1 : 0, gw = moving && !gr ? 1 : 0
      const k = 1 - Math.exp(-10 * dt)
      w.idle += (gi - w.idle) * k; w.walk += (gw - w.walk) * k; w.run += (gr - w.run) * k
      idle?.setEffectiveWeight(w.idle); walk?.setEffectiveWeight(w.walk); run?.setEffectiveWeight(w.run)
      if (walk) walk.timeScale = THREE.MathUtils.clamp(speed / 1.9, 0.6, 1.6)
      if (run) run.timeScale = THREE.MathUtils.clamp(speed / 5.2, 0.7, 1.4)
      // Distance LOD: people far from the camera animate at a quarter rate (set by the crowd via userData.far).
      root.userData.acc = (root.userData.acc ?? 0) + dt
      // Offscreen people barely animate (nobody sees them); far ones at ~8 fps; near ones every frame.
      const lod = mixerLod(root)
      if (root.userData.acc < lod) return
      mixer.update(root.userData.acc)
      root.userData.acc = 0
    }
  }).catch(() => { /* keep the procedural body */ })
}

// Shared per-frame view info for mixer LOD (set once per frame by the render loop; no allocations per person).
const viewFrustum = new THREE.Frustum()
const viewMat = new THREE.Matrix4()
const viewPos = new THREE.Vector3()
const lodSphere = new THREE.Sphere(new THREE.Vector3(), 1.2)
let viewReady = false
export function setMixerViewer(camera: THREE.Camera): void {
  viewMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  viewFrustum.setFromProjectionMatrix(viewMat)
  viewPos.setFromMatrixPosition(camera.matrixWorld)
  viewReady = true
}
function mixerLod(root: THREE.Object3D): number {
  if (!viewReady || root.userData.player) return 0
  root.getWorldPosition(lodSphere.center)
  lodSphere.center.y += 0.9
  if (!viewFrustum.intersectsSphere(lodSphere)) return 0.5
  const d = lodSphere.center.distanceToSquared(viewPos)
  return d > 900 ? 0.12 : d > 324 ? 0.06 : 0
}
