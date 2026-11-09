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
export type Look = { skin?: number; hair?: number; top?: number; bottom?: number; shoes?: number; /** Long sleeves in the top colour (abaya). */ sleeves?: boolean }
export type Extras = { chain?: boolean; watch?: boolean; shades?: boolean; cap?: boolean; pearls?: boolean }

type Template = { scene: THREE.Group; clips: THREE.AnimationClip[]; parts: { name: string; start: number; count: number }[]; height: number; base: Float32Array; limb: Uint8Array; skirt?: THREE.BufferGeometry | null }
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const cache = new Map<HumanModel, Promise<Template>>()
const GOLD = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 0.9, roughness: 0.3 })
const PEARL = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.35 })
const STEEL = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.3 })
const SHADE = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.2 })
const CAP = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 })
// Faceted, matte low-poly people: flat shading shows every plane of the model (the art reference), no plastic sheen.
const sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.45 })

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
      // Which vertices sit on an arm (1) or a leg (2): lets an outfit cover them (long sleeves) by colour alone.
      const limb = new Uint8Array(merged.getAttribute('position').count)
      const names = first.skeleton.bones.map((b) => b.name)
      const si = merged.getAttribute('skinIndex'), sw = merged.getAttribute('skinWeight')
      for (let i = 0; i < limb.length; i++) {
        let best = 0
        for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
        const bone = names[si.getComponent(i, best)] ?? ''
        limb[i] = /^(UpperArm|LowerArm|Shoulder)/.test(bone) ? 1 : /^(UpperLeg|LowerLeg)/.test(bone) ? 2 : 0
      }
      const base = (merged.getAttribute('color').array as Float32Array).slice()
      return { scene, clips: gltf.animations, parts, height: Math.max(0.1, box.max.y - box.min.y), base, limb }
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
export function upgradeToHuman(avatar: ShrimpAvatar, model: HumanModel, opts: { look?: Look; extras?: Extras; glasses?: boolean; height?: number; makeup?: { lip?: number | null; blush?: number | null } } = {}): void {
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
      ;(col.array as Float32Array).set(t.base)
      const c = new THREE.Color()
      for (const p of t.parts) {
        const skin = /skin/i.test(p.name)
        const hex = skin ? look.skin : /^hair/i.test(p.name) ? look.hair : /shirt\d?$|dress|jacket/i.test(p.name) ? look.top : /pants/i.test(p.name) ? look.bottom : /shoes|socks/i.test(p.name) ? look.shoes : undefined
        if (hex !== undefined) {
          c.setHex(hex) // vertex colours are linear; setHex converts from sRGB
          for (let i = p.start; i < p.start + p.count; i++) col.setXYZ(i, c.r, c.g, c.b)
        }
        if (skin && look.sleeves && look.top !== undefined) {
          c.setHex(look.top)
          for (let i = p.start; i < p.start + p.count; i++) if (t.limb[i]) col.setXYZ(i, c.r, c.g, c.b)
        }
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
    {
      // Accessories on the rig's bones (gold chain, pearls, watch, shades, cap): a handful of tiny meshes, one shared material each.
      person.updateMatrixWorld(true)
      const inv = new THREE.Matrix4().copy(person.matrixWorld).invert()
      const at = (bone: string, obj: THREE.Object3D, dx: number, dy: number, dz: number) => {
        const b = person.getObjectByName(bone); if (!b) return
        const wp = new THREE.Vector3(); b.getWorldPosition(wp); const l = wp.applyMatrix4(inv)
        obj.position.set(l.x + dx / person.scale.x, l.y + dy / person.scale.y, l.z + dz / person.scale.z)
        obj.scale.setScalar(1 / person.scale.x); obj.visible = false
        person.add(obj); person.updateMatrixWorld(true); b.attach(obj)
      }
      const torus = (r: number, t: number, m: THREE.Material) => { const o = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 20), m); o.rotation.x = Math.PI / 2.3; return o }
      const parts: Record<keyof Extras, THREE.Object3D> = {
        chain: torus(0.085, 0.011, GOLD), pearls: torus(0.08, 0.012, PEARL),
        watch: new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 12), STEEL),
        shades: (() => { const g = new THREE.Group(); for (const x of [-0.035, 0.035]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.008), SHADE); l.position.x = x; g.add(l) } return g })(),
        cap: (() => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), CAP); const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.08), CAP); v.position.set(0, 0, 0.1); g.add(c, v); return g })(),
      }
      at('Neck', parts.chain, 0, -0.04, 0.025); at('Neck', parts.pearls, 0, -0.03, 0.02)
      at('LowerArm.L', parts.watch, 0, -0.12, 0); at('Head', parts.shades, 0, 0.1, 0.11); at('Head', parts.cap, 0, 0.17, 0)
      const setExtras = (e: Extras = {}) => { for (const k of Object.keys(parts) as Array<keyof Extras>) parts[k].visible = !!e[k] }
      setExtras((root.userData.extras as Extras | undefined) ?? opts.extras)
      root.userData.setExtras = setExtras
    }
    // Full-length gown: the woman4 dress mesh stops mid-thigh, so a faceted skirt runs from the waist to the
    // ankles. It is skinned to the hips and legs, so it sways with each stride and drapes over the lap when seated.
    if (model === 'woman4') {
      if (t.skirt === undefined) t.skirt = skirtGeometry(mesh, t)
      if (t.skirt) {
        const skirtMat = new THREE.MeshStandardMaterial({ color: look?.top ?? 0x1a1c22, flatShading: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.45 })
        const skirt = new THREE.SkinnedMesh(t.skirt, skirtMat)
        skirt.name = 'Skirt'
        skirt.position.copy(mesh.position); skirt.quaternion.copy(mesh.quaternion); skirt.scale.copy(mesh.scale)
        mesh.parent!.add(skirt)
        skirt.bind(mesh.skeleton, mesh.bindMatrix)
        skirt.castShadow = true
        skirt.frustumCulled = false
        root.userData.dressHem = skirt
        const prevLook = root.userData.applyLook as ((look: Look) => void) | undefined
        root.userData.applyLook = (next: Look) => {
          prevLook?.(next)
          if (next.top != null) skirtMat.color.setHex(next.top)
        }
      }
    }
    root.userData.person = person
    root.userData.body = bodyRef
    bodyRef.visible = false
    root.add(person)
    const mixer = new THREE.AnimationMixer(person)
    const clips = t.clips
    const act = (n: string) => { const c = clips.find((k) => k.name === n); return c ? mixer.clipAction(c) : null }
    const idle = act('Idle'), walk = act('Walk'), run = act('Run')
    for (const a of [idle, walk, run]) if (a) { a.play(); a.setEffectiveWeight(0) }
    idle?.setEffectiveWeight(1)
    const w = { idle: 1, walk: 0, run: 0 }
    const arms = armRig(person)
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
      root.userData.accLast = root.userData.acc
      root.userData.acc = 0
      // The pack's clips leave the arms raised (Idle even lacks a right-arm track on some models), so the arms
      // are posed here: they hang by the sides and swing against the opposite leg, in step with the clip.
      if (arms) poseArms(person, arms, w.run, (root.userData.armT = ((root.userData.armT as number | undefined) ?? Math.random() * 6) + root.userData.accLast))
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

type ArmRig = { hips: THREE.Object3D; sides: Array<{ upper: THREE.Object3D; fore: THREE.Object3D; hand: THREE.Object3D; thigh: THREE.Object3D; knee: THREE.Object3D; side: number }> }
function armRig(person: THREE.Object3D): ArmRig | null {
  const get = (n: string) => person.getObjectByName(n)
  const hips = get('Hips')
  const sides: ArmRig['sides'] = []
  // Each arm swings against the opposite leg.
  for (const [arm, leg, side] of [['L', 'R', 1], ['R', 'L', -1]] as const) {
    const upper = get(`UpperArm${arm}`), fore = get(`LowerArm${arm}`), hand = get(`Palm${arm}`), thigh = get(`UpperLeg${leg}`), knee = get(`LowerLeg${leg}`)
    if (upper && fore && hand && thigh && knee) sides.push({ upper, fore, hand, thigh, knee, side })
  }
  return hips && sides.length === 2 ? { hips, sides } : null
}

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vDir = new THREE.Vector3(), vWant = new THREE.Vector3()
const vRight = new THREE.Vector3(), vFwd = new THREE.Vector3(), vUp = new THREE.Vector3(0, 1, 0)
const qWorld = new THREE.Quaternion(), qParent = new THREE.Quaternion(), qTurn = new THREE.Quaternion()
/** Turn `bone` so that the segment from it to `child` points along the world direction `want`. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, want: THREE.Vector3): void {
  bone.getWorldPosition(vA); child.getWorldPosition(vB)
  vDir.subVectors(vB, vA).normalize()
  qTurn.setFromUnitVectors(vDir, want)
  bone.parent!.getWorldQuaternion(qParent)
  // local' = parent^-1 * turn * parent * local
  bone.quaternion.premultiply(qWorld.copy(qParent).invert().multiply(qTurn).multiply(qParent))
  bone.updateMatrixWorld(true)
}
function poseArms(person: THREE.Object3D, rig: ArmRig, run: number, time: number): void {
  person.updateMatrixWorld(true)
  person.getWorldQuaternion(qWorld)
  vRight.set(1, 0, 0).applyQuaternion(qWorld).normalize()
  vFwd.set(0, 0, 1).applyQuaternion(qWorld).normalize()
  for (const s of rig.sides) {
    // Stride angle of the opposite thigh (forward positive) drives this arm.
    s.thigh.getWorldPosition(vA); s.knee.getWorldPosition(vB)
    vDir.subVectors(vB, vA).normalize()
    const stride = Math.atan2(vDir.dot(vFwd), -vDir.y)
    const reach = 0.5 + run * 0.35
    const swing = THREE.MathUtils.clamp(stride * (0.6 + run * 0.4), -reach, reach) + Math.sin(time * 1.3 + s.side) * 0.025
    const out = 0.13 + run * 0.05
    vWant.copy(vUp).multiplyScalar(-Math.cos(swing)).addScaledVector(vFwd, Math.sin(swing)).addScaledVector(vRight, s.side * out).normalize()
    aim(s.upper, s.fore, vWant)
    // Elbow: a relaxed bend that opens on the back swing and closes on the forward swing (more when running).
    const bend = swing + 0.2 + Math.max(0, swing) * 0.5 + run * 0.9
    vWant.copy(vUp).multiplyScalar(-Math.cos(bend)).addScaledVector(vFwd, Math.sin(bend)).addScaledVector(vRight, s.side * (out - 0.07)).normalize()
    aim(s.fore, s.hand, vWant)
  }
}

/** Waist-to-ankle skirt in the skinned mesh's bind space, weighted to the hips and legs. Null if the rig lacks the bones. */
function skirtGeometry(mesh: THREE.SkinnedMesh, t: Template): THREE.BufferGeometry | null {
  const bones = mesh.skeleton.bones
  const index = (n: string) => bones.findIndex((b) => b.name === n)
  const iHips = index('Hips'), iUL = index('UpperLegL'), iUR = index('UpperLegR'), iLL = index('LowerLegL'), iLR = index('LowerLegR'), iHead = index('Head')
  if ([iHips, iUL, iUR, iLL, iLR, iHead].some((i) => i < 0)) return null
  const m = new THREE.Matrix4()
  const bind = (i: number) => new THREE.Vector3().setFromMatrixPosition(m.copy(mesh.skeleton.boneInverses[i]!).invert().premultiply(mesh.bindMatrixInverse))
  const hipL = bind(iUL), hipR = bind(iUR), head = bind(iHead)
  const mid = hipL.clone().add(hipR).multiplyScalar(0.5)
  const up = head.clone().sub(mid).normalize()
  const right = hipL.clone().sub(hipR)
  const half = right.length() / 2
  right.addScaledVector(up, -right.dot(up)).normalize()
  const fwd = right.clone().cross(up).normalize()
  // Ground: the lowest vertex along `up`.
  const pos = mesh.geometry.getAttribute('position')
  let low = 0
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) low = Math.min(low, v.fromBufferAttribute(pos, i).sub(mid).dot(up))
  const leg = -low
  void t
  // Rows: waist, hip line, knee line, hem. [height, radius across, radius front-back, hips, upper leg, lower leg]
  const rows = [
    [0.17 * leg, 1.75 * half, 1.4 * half, 1, 0, 0],
    [-0.06 * leg, 2.35 * half, 2.0 * half, 0.7, 0.3, 0],
    [-0.5 * leg, 2.85 * half, 2.75 * half, 0.3, 0.7, 0],
    [-0.955 * leg, 3.3 * half, 3.5 * half, 0.22, 0, 0.78],
  ] as const
  const SEG = 12
  const P: number[] = [], SI: number[] = [], SW: number[] = [], idx: number[] = []
  for (const [h, rx, rz, wH, wU, wL] of rows) for (let k = 0; k < SEG; k++) {
    const a = (k / SEG) * Math.PI * 2
    const c = Math.cos(a), sn = Math.sin(a)
    v.copy(mid).addScaledVector(up, h).addScaledVector(right, c * rx).addScaledVector(fwd, sn * rz)
    P.push(v.x, v.y, v.z)
    const left = THREE.MathUtils.smoothstep(c, -0.55, 0.55)
    if (wL > 0) { SI.push(iHips, iLL, iLR, 0); SW.push(wH, wL * left, wL * (1 - left), 0) }
    else { SI.push(iHips, iUL, iUR, 0); SW.push(wH, wU * left, wU * (1 - left), 0) }
  }
  for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < SEG; k++) {
    const a = r * SEG + k, b = r * SEG + ((k + 1) % SEG), c = a + SEG, d = b + SEG
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4))
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
