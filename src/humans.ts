// Real rigged, animated people: figures from the Microsoft Rocketbox Avatar Library (MIT; see CREDITS.md),
// packed by tools/pack-rocketbox.mjs. Each person is ONE skinned mesh with ONE texture atlas (one draw call on
// phones) on a 23-bone rig, and everyone shares the motion-capture clips for their sex (idle, walk, jog, run,
// talk) by bone name. Outfit colours still apply: a baked region mask (skin / hair / top / bottom / shoes)
// shifts each region of the texture to the look's colour while keeping the fabric folds and the face.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { ShrimpAvatar } from './shrimp.ts'

export const MEN = ['man1', 'man2', 'man3', 'man4'] as const
export const WOMEN = ['woman1', 'woman2', 'woman3', 'woman4'] as const
/** `kurta` (kufi and long shirt) and `abaya` (abaya with the head covered) are worn by choice, not picked at random. */
export type HumanModel = (typeof MEN)[number] | (typeof WOMEN)[number] | 'kurta' | 'abaya'
  // Boutique looks: complete outfits worn by choice.
  | 'look_skirtsuit' | 'look_pencil' | 'look_gown' | 'look_party' | 'look_tux' | 'look_navy' | 'look_thobe'
/** Figures whose head is covered: no earrings or necklace are drawn over the cloth. */
const COVERED: ReadonlySet<string> = new Set(['abaya', 'woman2', 'look_thobe'])
export type Look = {
  skin?: number; hair?: number; top?: number; bottom?: number; shoes?: number
  /** Kept for callers: sleeves are part of each figure's own clothes now. */
  sleeves?: boolean
  /** Abaya: the covered figure is used, in the top colour. */
  robe?: boolean
  /** Kaftan: the long-shirt figure is used, in the top colour. */
  kaftan?: boolean
  gown?: boolean
  /** A boutique look: wear this figure whatever the body's usual one is. */
  figure?: HumanModel
}
export type Metal = 'gold' | 'rose' | 'steel'
export type Extras = {
  chain?: boolean; shades?: boolean; cap?: boolean; pearls?: boolean
  /** `true` is the steel watch (older saves). */
  watch?: boolean | Metal
  earrings?: 'hoops' | 'studs' | 'drops'
  necklace?: 'chain' | 'pearls' | 'pendant'
  ring?: 'band' | 'solitaire' | 'signet'
}

type Region = 'skin' | 'hair' | 'top' | 'bottom' | 'shoes'
const REGIONS: Region[] = ['skin', 'hair', 'top', 'bottom', 'shoes']
type Motion = { clips: THREE.AnimationClip[]; hip: number; speed: Record<string, number> }
type Template = {
  name: HumanModel; scene: THREE.Group; material: THREE.MeshStandardMaterial; clips: THREE.AnimationClip[]; speed: Record<string, number>
  height: number; regions: Partial<Record<Region, [number, number, number]>>; eye: [number, number, number, number] | null; crown: number
  pixels?: Promise<{ base: ImageData; mask: ImageData } | null>
  fit?: Fit | null
}
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
const cache = new Map<HumanModel, Promise<Template>>()
const motions = new Map<string, Promise<Motion>>()
const GOLD = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 0.9, roughness: 0.3 })
const PEARL = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.35 })
const STEEL = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.3 })
const SHADE = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.2 })
const CAP = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 })
const ROSE = new THREE.MeshStandardMaterial({ color: 0xd9a08a, metalness: 0.9, roughness: 0.28 })
const GEM = new THREE.MeshStandardMaterial({ color: 0xf4fbff, metalness: 0.15, roughness: 0.04, envMapIntensity: 2.4 })
const DIAL = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.25, metalness: 0.4 })
const METAL: Record<Metal, THREE.Material> = { gold: GOLD, rose: ROSE, steel: STEEL }
const B = { root: 'Bip01', hips: 'Bip01_Pelvis', neck: 'Bip01_Neck', head: 'Bip01_Head' }
// Everything under /models/ is cached by browsers for a year as immutable (vercel.json), so a file here must
// NEVER change in place: a phone that has the old bytes keeps them. Change a figure -> bump this folder (r2, r3).
// (The first figures reused the old blocky people's file names, and returning phones drew those old files.)
export const FIGURES = '/models/figures/r1/'

function motion(sex: string): Promise<Motion> {
  let p = motions.get(sex)
  if (!p) {
    p = loader.loadAsync(`${FIGURES}motion-${sex}.glb`).then((gltf) => {
      const info = (gltf.scene.userData ?? {}) as Record<string, unknown>
      const speed: Record<string, number> = {}
      for (const c of gltf.animations) speed[c.name] = Number((info[c.name] as { speed?: number } | undefined)?.speed) || 0
      return { clips: gltf.animations, hip: Number(info.hip) || 0.9, speed }
    })
    motions.set(sex, p)
  }
  return p
}

function load(name: HumanModel): Promise<Template> {
  let p = cache.get(name)
  if (!p) {
    p = loader.loadAsync(`${FIGURES}${name}.glb`).then(async (gltf) => {
      const scene = gltf.scene
      const info = (scene.userData ?? {}) as { sex?: string; height?: number; hip?: number; regions?: Template['regions']; eye?: Template['eye']; crown?: number }
      let mesh: THREE.SkinnedMesh | null = null
      scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as THREE.SkinnedMesh })
      // Only a figure packed by tools/pack-rocketbox.mjs is accepted: its size and rig are known. Anything else
      // (a stale or foreign file) is refused rather than drawn at a guessed scale.
      if (!mesh || !info.height || !scene.getObjectByName(B.root)) throw new Error(`${name}: not a packed figure`)
      const body = mesh! as THREE.SkinnedMesh
      body.name = 'Person'
      const src = body.material as THREE.MeshStandardMaterial
      // Matte cloth and skin: the baked texture already carries the folds, so only a little sky light is added.
      const material = new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.82, metalness: 0, envMapIntensity: 0.5, alphaTest: src.alphaTest || 0, side: src.side })
      if (material.map) material.map.anisotropy = 4
      body.material = material
      const m = await motion(info.sex === 'f' ? 'f' : 'm')
      // The clips carry the hips' height for the mocap actor: rescale it to this figure's own leg length.
      const k = (info.hip ?? m.hip) / m.hip
      const clips = m.clips.map((c) => {
        const copy = c.clone()
        for (const t of copy.tracks) if (t.name === `${B.root}.position`) { const v = t.values; for (let i = 0; i < v.length; i++) v[i]! *= k }
        return copy
      })
      return { name, scene, material, clips, speed: m.speed, height: info.height ?? 1.75, regions: info.regions ?? {}, eye: info.eye ?? null, crown: info.crown ?? 0.22 }
    })
    cache.set(name, p)
  }
  return p
}

/** Warm the cache so the first city frame does not wait on people. */
export function preloadHumans(names: HumanModel[]): void { for (const n of names) void load(n).catch(() => undefined) }

/** Which figure wears a look: an abaya or a kaftan has its own figure. */
function figure(model: HumanModel, look?: Look): HumanModel {
  if (look?.figure) return look.figure
  const lady = (WOMEN as readonly string[]).includes(model) || model === 'abaya'
  if (look?.robe && lady) return 'abaya'
  if (look?.kaftan && !lady) return 'kurta'
  return model
}

// ---- outfit colours on the texture ----
const toLin = new Float32Array(256)
for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const toSrgb = new Uint8Array(2049)
for (let i = 0; i <= 2048; i++) { const c = i / 2048; toSrgb[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)) }
/** Roll highlights off instead of clipping them flat. */
const soft = (x: number) => (x < 0.6 ? x : 0.6 + 0.4 * (1 - Math.exp(-(x - 0.6) / 0.4)))
const out8 = (x: number) => toSrgb[Math.min(2048, Math.max(0, Math.round(x * 2048)))]!

function pixels(t: Template): Promise<{ base: ImageData; mask: ImageData } | null> {
  t.pixels ??= (async () => {
    try {
      const image = t.material.map?.image as CanvasImageSource & { width: number; height: number } | undefined
      if (!image) return null
      const w = image.width, h = image.height
      const read = (src: CanvasImageSource) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true })!; g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, w, h); return g.getImageData(0, 0, w, h) }
      const blob = await (await fetch(`${FIGURES}${t.name}.mask.png`)).blob()
      const mask = await createImageBitmap(blob)
      return { base: read(image), mask: read(mask) }
    } catch { return null }
  })()
  return t.pixels
}

type Skin = { texture: THREE.Texture; users: number; key: string }
const skins = new Map<string, Promise<Skin | null>>()
const wants = (t: Template, look?: Look) => !!look && REGIONS.some((r) => look[r] !== undefined && t.regions[r])

/** The figure's texture with each region shifted to the look's colour. `detail` 1 = full size, 0.5 = half (crowd). */
function dress(t: Template, look: Look, detail: number): Promise<Skin | null> {
  const key = `${t.name}|${detail}|${REGIONS.map((r) => (t.regions[r] ? look[r] ?? '' : '')).join(',')}`
  let p = skins.get(key)
  if (!p) {
    p = pixels(t).then((px) => {
      if (!px) return null
      const { base, mask } = px
      const w = base.width, h = base.height
      const data = new Uint8ClampedArray(base.data)
      const m = mask.data
      // Per region: the target colour and the texture's own average, both linear.
      const target: Array<[number, number, number] | null> = [null], mean: Array<[number, number, number]> = [[1, 1, 1]], luma: number[] = [1], keep: number[] = [1]
      const c = new THREE.Color()
      for (const r of REGIONS) {
        const avg = t.regions[r], hex = look[r]
        if (!avg || hex === undefined) { target.push(null); mean.push([1, 1, 1]); luma.push(1); keep.push(1); continue }
        c.setHex(hex)
        target.push([c.r, c.g, c.b]); mean.push(avg)
        const l = 0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2]
        luma.push(Math.max(0.004, l))
        // Near-black cloth has no real shading in it, only noise: carry less of it over.
        keep.push(THREE.MathUtils.clamp((l - 0.006) / 0.07, 0.3, 1))
      }
      for (let i = 0, n = w * h; i < n; i++) {
        const o = i * 4
        const id = Math.round(m[o]! / 40), wt = m[o + 1]! / 255
        const tg = target[id]
        if (!tg || wt <= 0) continue
        const r = toLin[data[o]!]!, g = toLin[data[o + 1]!]!, b = toLin[data[o + 2]!]!
        let nr: number, ng: number, nb: number
        if (id === 1) {
          // Skin: scale every channel so the average lands on the target; lips, shadows and freckles follow.
          // The creator's tones are flat swatches; a lit, textured face reads lighter, so aim a little under them.
          const a = mean[1]!
          nr = soft(r * (tg[0] * 0.74 / a[0])); ng = soft(g * (tg[1] * 0.74 / a[1])); nb = soft(b * (tg[2] * 0.74 / a[2]))
        } else {
          const rel = (0.2126 * r + 0.7152 * g + 0.0722 * b) / luma[id]!
          const shade = THREE.MathUtils.clamp(1 + (rel - 1) * keep[id]!, 0.22, 1.9)
          nr = tg[0] * shade; ng = tg[1] * shade; nb = tg[2] * shade
        }
        data[o] = out8(r + (nr - r) * wt); data[o + 1] = out8(g + (ng - g) * wt); data[o + 2] = out8(b + (nb - b) * wt)
      }
      const full = document.createElement('canvas'); full.width = w; full.height = h
      full.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0)
      let canvas = full
      if (detail < 1) {
        canvas = document.createElement('canvas'); canvas.width = Math.round(w * detail); canvas.height = Math.round(h * detail)
        const g = canvas.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(full, 0, 0, canvas.width, canvas.height)
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.flipY = false
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      return { texture, users: 0, key }
    })
    skins.set(key, p)
  }
  return p
}

/** Wear a look: the person gets its own material with the recoloured texture (or goes back to the shared one). */
function paint(mesh: THREE.SkinnedMesh, t: Template, look: Look | undefined, detail: number): Promise<void> {
  const stamp = (mesh.userData.paint = ((mesh.userData.paint as number | undefined) ?? 0) + 1)
  // A texture nobody wears any more is freed once the wardrobe has grown past a handful.
  const release = () => { const s = mesh.userData.skin as Skin | undefined; if (!s) return; s.users -= 1; mesh.userData.skin = undefined; if (s.users <= 0 && skins.size > 14) { s.texture.dispose(); skins.delete(s.key) } }
  if (!wants(t, look)) { release(); if (mesh.material !== t.material) { (mesh.material as THREE.Material).dispose(); mesh.material = t.material } return Promise.resolve() }
  return dress(t, look!, detail).then((skin) => {
    if (!skin || mesh.userData.paint !== stamp) return
    release()
    skin.users += 1
    mesh.userData.skin = skin
    if (mesh.material === t.material) mesh.material = t.material.clone()
    const own = mesh.material as THREE.MeshStandardMaterial
    own.map = skin.texture
    own.needsUpdate = true
    window.dispatchEvent(new Event('gd-avatar-ready'))
  })
}

// ---- jewellery, fitted to each figure ----
type Fit = {
  /** Ear lobes (left, right), the chest and nape points a necklace rests on and the neck's half-width, and the
   * middle finger of the left hand (centre, direction, thickness). All in the figure's own rest space, metres. */
  ears: [THREE.Vector3, THREE.Vector3] | null
  chest: THREE.Vector3 | null; nape: THREE.Vector3 | null; neckHalf: number
  finger: { at: THREE.Vector3; dir: THREE.Vector3; r: number } | null
}
/**
 * Measure where jewellery sits from the figure's own surface (once per figure): nothing is placed by a fixed
 * offset, so a necklace lies on this jacket's lapels or that dress's neckline, and a ring is as wide as this
 * hand's finger. That is what keeps pieces from floating or sinking in on different bodies and outfits.
 */
function measure(t: Template): Fit | null {
  if (t.fit !== undefined) return t.fit
  t.fit = null
  const mesh = t.scene.getObjectByName('Person') as THREE.SkinnedMesh | undefined
  if (!mesh) return null
  t.scene.updateMatrixWorld(true)
  const pos = mesh.geometry.getAttribute('position'), si = mesh.geometry.getAttribute('skinIndex'), sw = mesh.geometry.getAttribute('skinWeight')
  const names = mesh.skeleton.bones.map((b) => b.name)
  const bone = (n: string) => { const b = t.scene.getObjectByName(n); return b ? b.getWorldPosition(new THREE.Vector3()) : null }
  const head = bone(B.head), neck = bone(B.neck), hand = bone('Bip01_L_Hand')
  if (!head || !neck) return null
  const eyeY = head.y + (t.eye?.[1] ?? 0.095)
  const v = new THREE.Vector3()
  const lead = (i: number) => { let best = 0; for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k; return [names[si.getComponent(i, best)] ?? '', sw.getComponent(i, best)] as const }
  let earL: THREE.Vector3 | null = null, earR: THREE.Vector3 | null = null
  let chest: THREE.Vector3 | null = null, nape: THREE.Vector3 | null = null, neckHalf = 0.055
  const handVerts: THREE.Vector3[] = []
  for (let i = 0; i < pos.count; i++) {
    mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
    const [name, w] = lead(i)
    if (name === B.head && w > 0.85 && v.y > eyeY - 0.05 && v.y < eyeY - 0.012 && v.z < head.z + 0.05) {
      if (!earL || v.x > earL.x) earL = v.clone()
      if (!earR || v.x < earR.x) earR = v.clone()
    }
    if (Math.abs(v.x - neck.x) < 0.03) {
      if (v.y > neck.y - 0.125 && v.y < neck.y - 0.06 && v.z > neck.z && (!chest || v.z > chest.z)) chest = v.clone()
      if (v.y > neck.y - 0.02 && v.y < neck.y + 0.035 && v.z < neck.z && (!nape || v.z < nape.z)) nape = v.clone()
    }
    if (Math.abs(v.y - (neck.y - 0.005)) < 0.02 && Math.abs(v.z - neck.z) < 0.03 && Math.abs(v.x - neck.x) < 0.1) neckHalf = Math.max(neckHalf, Math.abs(v.x - neck.x))
    if (hand && name === 'Bip01_L_Hand' && w > 0.6) handVerts.push(v.clone())
  }
  let finger: Fit['finger'] = null
  if (hand && handVerts.length > 8) {
    // The middle finger is the hand's far end: its tip is the vertex farthest from the wrist.
    let tip = handVerts[0]!
    for (const p of handVerts) if (p.distanceToSquared(hand) > tip.distanceToSquared(hand)) tip = p
    const dir = tip.clone().sub(hand), len = dir.length()
    dir.normalize()
    // The ring sits on the first joint (about 62% of the way out): take the finger's own cross-section there.
    const along = len * 0.62
    const slab = handVerts.filter((p) => Math.abs(p.clone().sub(hand).dot(dir) - along) < 0.012).map((p) => ({ p, off: p.clone().sub(hand).addScaledVector(dir, -p.clone().sub(hand).dot(dir)) }))
    const core = slab.filter((q) => q.off.length() < 0.016)
    const at = hand.clone().addScaledVector(dir, along)
    let r = 0.0105
    if (core.length >= 3) {
      const c = new THREE.Vector3(); for (const q of core) c.add(q.off); c.multiplyScalar(1 / core.length)
      at.add(c)
      r = THREE.MathUtils.clamp(Math.max(...core.map((q) => q.off.distanceTo(c))) + 0.0012, 0.0085, 0.0125)
    }
    finger = { at, dir, r }
  }
  t.fit = { ears: earL && earR && earL.x - earR.x > 0.1 ? [earL, earR] : null, chest, nape, neckHalf, finger }
  return t.fit
}

/** Build the jewellery for `e` on a person (rest pose) and hang each piece on the bone that carries it. */
function jewels(person: THREE.Object3D, t: Template, e: Extras): THREE.Object3D[] {
  const fit = measure(t)
  const made: THREE.Object3D[] = []
  if (!fit) return made
  // `fit` is in the figure's REST space. Each piece is expressed relative to its bone's rest transform and then
  // parented to the live bone, so it lands in the same place whatever pose the person is in right now.
  const local = new THREE.Matrix4()
  const hang = (bone: string, obj: THREE.Object3D, at: THREE.Vector3) => {
    const live = person.getObjectByName(bone), rest = t.scene.getObjectByName(bone)
    if (!live || !rest) return
    obj.position.copy(at)
    obj.updateMatrix()
    local.copy(rest.matrixWorld).invert().multiply(obj.matrix).decompose(obj.position, obj.quaternion, obj.scale)
    live.add(obj)
    made.push(obj)
  }
  const covered = COVERED.has(t.name)
  if (e.earrings && fit.ears && !covered) {
    for (const [i, lobe] of fit.ears.entries()) {
      const side = i === 0 ? 1 : -1
      const g = new THREE.Group()
      if (e.earrings === 'hoops') { const h = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0013, 6, 20), GOLD); h.rotation.y = Math.PI / 2; h.position.y = -0.011; g.add(h) }
      else if (e.earrings === 'studs') g.add(new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), PEARL))
      else { const s = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 8, 6), GOLD); const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.0055, 0), GEM); d.scale.set(0.75, 1.5, 0.75); d.position.y = -0.012; g.add(s, d) }
      hang(B.head, g, lobe.clone().add(new THREE.Vector3(side * 0.0015, -0.006, 0.002)))
    }
  }
  const necklace = e.necklace ?? (e.pearls ? 'pearls' : e.chain ? 'chain' : undefined)
  if (necklace && fit.chest && fit.nape && !covered) {
    // An ellipse through the nape and the chest point, as wide as this neck, resting 3 mm off the surface.
    const front = fit.chest.clone().add(new THREE.Vector3(0, 0, 0.004)), back = fit.nape.clone().add(new THREE.Vector3(0, 0, -0.003))
    const mid = front.clone().add(back).multiplyScalar(0.5)
    const along = front.clone().sub(back), half = along.length() / 2
    along.normalize()
    const wide = fit.neckHalf + 0.01
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * wide, 0, 0).addScaledVector(along, Math.cos(a) * half)) }
    const path = new THREE.CatmullRomCurve3(pts, true)
    const g = new THREE.Group()
    if (necklace === 'pearls') { for (let i = 0; i < 34; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 8, 6), PEARL); b.position.copy(path.getPointAt(i / 34)); g.add(b) } }
    else {
      g.add(new THREE.Mesh(new THREE.TubeGeometry(path, 56, necklace === 'chain' ? 0.0028 : 0.0012, 5, true), GOLD))
      if (necklace === 'pendant') { const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.008, 0), GEM); d.scale.set(0.8, 1.25, 0.5); d.position.copy(along).multiplyScalar(half).add(new THREE.Vector3(0, -0.01, 0.002)); g.add(d) }
    }
    hang('Bip01_Spine2', g, mid)
  }
  if (e.ring && fit.finger) {
    const f = fit.finger
    const g = new THREE.Group()
    const band = new THREE.Mesh(new THREE.TorusGeometry(f.r, e.ring === 'signet' ? 0.0022 : 0.0016, 6, 20), GOLD)
    g.add(band)
    if (e.ring === 'solitaire') { const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.0042, 0), GEM); d.position.y = f.r + 0.0028; g.add(d) }
    if (e.ring === 'signet') { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.0026, 10), GOLD); p.position.y = f.r + 0.0012; g.add(p) }
    // The torus lies in its own xy plane: turn its axis (z) along the finger.
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.dir)
    hang('Bip01_L_Hand', g, f.at)
  }
  const watch = e.watch === true ? 'steel' : e.watch || undefined
  if (watch) {
    const hand = t.scene.getObjectByName('Bip01_L_Hand'), fore = t.scene.getObjectByName('Bip01_L_Forearm')
    if (hand && fore) {
      const a = fore.getWorldPosition(new THREE.Vector3()), b = hand.getWorldPosition(new THREE.Vector3())
      const dir = b.clone().sub(a).normalize()
      const g = new THREE.Group()
      // A strap round the wrist and a round case with a dark dial on top of it.
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.02, 16, 1, true), METAL[watch])
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.007, 16), METAL[watch])
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.0075, 16), DIAL)
      face.rotation.x = Math.PI / 2; dial.rotation.x = Math.PI / 2
      face.position.z = -0.031; dial.position.z = -0.0312
      g.add(strap, face, dial)
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      hang('Bip01_L_Forearm', g, b.clone().addScaledVector(dir, -0.028))
    }
  }
  return made
}

function wireGlasses(ipd: number): THREE.Group {
  const g = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.2 })
  const lens = new THREE.MeshStandardMaterial({ color: 0xc8d4de, transparent: true, opacity: 0.18, roughness: 0.05 })
  const half = ipd / 2
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.003, 6, 18), metal)
    ring.scale.set(1.15, 0.85, 1)
    ring.position.x = s * half
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), lens)
    glass.scale.set(1.15, 0.85, 1)
    glass.position.x = s * half
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.1), metal)
    temple.position.set(s * (half + 0.034), 0.004, -0.05)
    g.add(ring, glass, temple)
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.006, ipd - 0.062), 0.003, 0.003), metal)
  bridge.position.y = 0.008
  g.add(bridge)
  return g
}

/**
 * Swap a procedural avatar's body for a real animated person once the model loads.
 * The procedural body stays as the instant fallback (and if loading fails). Masks keep the procedural body.
 */
export function upgradeToHuman(avatar: ShrimpAvatar, model: HumanModel, opts: { look?: Look; extras?: Extras; glasses?: boolean; height?: number; detail?: number; makeup?: unknown } = {}): void {
  const root = avatar.object
  // The procedural body is the root child with the most descendants (it is the one face() rotates).
  let body: THREE.Object3D | null = null
  let most = -1
  for (const c of root.children) { let n = 0; c.traverse(() => { n++ }); if (n > most) { most = n; body = c } }
  if (!body) return
  const bodyRef = body
  // The old procedural body is never shown for a person: the figure appears when it has loaded (it is preloaded
  // from the title screen), and only if it cannot load at all does the stand-in come back.
  root.userData.body = bodyRef
  bodyRef.visible = false
  const detail = opts.detail ?? 1
  let mounted: HumanModel | null = null
  let pending: HumanModel | null = null
  let step: ((dt: number, moving: boolean, speed: number) => void) | null = null
  const baseFace = avatar.face
  const baseStep = avatar.step
  avatar.face = (x, z, dt, moving) => { baseFace(x, z, dt, moving); const p = root.userData.person as THREE.Object3D | undefined; if (p) p.rotation.y = bodyRef.rotation.y }
  avatar.step = (dt, moving, speed) => { if (step) step(dt, moving, speed); else baseStep(dt, moving, speed) }

  const mount = (name: HumanModel, first: Look | undefined) => {
    pending = name
    void load(name).then((t) => {
      if (pending === name) pending = null
      if (root.userData.masked) { bodyRef.visible = true; return }
      // The outfit may have changed while the figure loaded: wear the latest, or stand down for the right figure.
      const look = (root.userData.look as Look | undefined) ?? first
      if (figure(model, look) !== name) return
      const old = root.userData.person as THREE.Object3D | undefined
      const person = cloneSkinned(t.scene) as THREE.Group
      person.scale.setScalar((opts.height ?? 1.74) / t.height)
      const mesh = person.getObjectByName('Person') as THREE.SkinnedMesh
      mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false
      paint(mesh, t, look, detail)
      person.updateMatrixWorld(true)
      const inv = new THREE.Matrix4().copy(person.matrixWorld).invert()
      /** Put `obj` at `bone` plus an offset in metres (person axes: x left, y up, z forward) and let it ride the bone. */
      const at = (bone: string, obj: THREE.Object3D, dx: number, dy: number, dz: number) => {
        const b = person.getObjectByName(bone); if (!b) return
        const l = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)
        obj.position.set(l.x + dx, l.y + dy, l.z + dz)
        person.add(obj); person.updateMatrixWorld(true); b.attach(obj)
      }
      const eye = t.eye ?? [0, 0.095, 0.12, 0.062]
      if (opts.glasses) at(B.head, wireGlasses(eye[3]), eye[0], eye[1], eye[2] + 0.012)
      {
        // Face shape from the creator: widen or narrow the head across and front to back, never its height.
        const head = person.getObjectByName(B.head)
        if (head) {
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert())
          const ax = Math.abs(up.x) > Math.abs(up.y) && Math.abs(up.x) > Math.abs(up.z) ? 'x' : Math.abs(up.y) > Math.abs(up.z) ? 'y' : 'z'
          const setFace = (f = 1) => head.scale.set(ax === 'x' ? 1 : f, ax === 'y' ? 1 : f, ax === 'z' ? 1 : f)
          setFace(root.userData.face as number | undefined)
          root.userData.setFace = setFace
        }
      }
      {
        // Shades and a cap ride the head; jewellery is measured to this figure (see `jewels`) and rebuilt whenever
        // what is worn changes.
        const shades = (() => { const g = new THREE.Group(); for (const x of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.03, 0.006), SHADE); l.position.x = x * eye[3] / 2; g.add(l) } const bar = new THREE.Mesh(new THREE.BoxGeometry(eye[3], 0.005, 0.005), SHADE); bar.position.y = 0.008; g.add(bar); return g })()
        const cap = (() => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.SphereGeometry(0.108, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), CAP); c.scale.set(0.92, 0.82, 1.12); const v = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.008, 0.075), CAP); v.position.set(0, 0.004, 0.14); g.add(c, v); return g })()
        at(B.head, shades, eye[0], eye[1], eye[2] + 0.014); at(B.head, cap, 0, t.crown - 0.062, 0.012)
        let worn: THREE.Object3D[] = []
        const setExtras = (e: Extras = {}) => {
          shades.visible = !!e.shades; cap.visible = !!e.cap
          for (const o of worn) o.removeFromParent()
          worn = jewels(person, t, e)
        }
        setExtras((root.userData.extras as Extras | undefined) ?? opts.extras)
        root.userData.setExtras = setExtras
      }
      if (old) { old.removeFromParent(); const om = old.getObjectByName('Person') as THREE.SkinnedMesh | undefined; if (om) paint(om, om.userData.template as Template, undefined, detail) }
      mesh.userData.template = t
      person.rotation.y = bodyRef.rotation.y
      person.visible = !root.userData.masked
      root.userData.person = person
      root.userData.body = bodyRef
      bodyRef.visible = !!root.userData.masked
      root.add(person)
      mounted = name
      window.dispatchEvent(new Event('gd-avatar-ready'))
      const mixer = new THREE.AnimationMixer(person)
      const act = (n: string) => { const c = t.clips.find((k) => k.name === n); return c ? mixer.clipAction(c) : null }
      const idle = act('Idle'), walk = act('Walk'), jog = act('Jog'), run = act('Run'), talk = act('Talk')
      const all = [idle, walk, jog, run, talk]
      for (const a of all) if (a) { a.play(); a.setEffectiveWeight(0) }
      // Nobody stands or chats in step with the next person.
      if (idle) idle.time = Math.random() * idle.getClip().duration
      if (talk) talk.time = Math.random() * talk.getClip().duration
      idle?.setEffectiveWeight(1)
      const w = [1, 0, 0, 0, 0]
      const pace = { walk: t.speed.Walk || 1.1, jog: t.speed.Jog || 2.8, run: t.speed.Run || 5.6 }
      mixer.update(0)
      step = (dt, moving, speed) => {
        // Gait by ground speed, so feet match the pace: walk, then jog, then run.
        const gait = !moving ? 0 : speed < pace.walk * 1.75 ? 1 : speed < pace.jog * 1.6 ? 2 : 3
        const chat = !moving && !!root.userData.chat && !!talk
        const k = 1 - Math.exp(-9 * dt)
        for (let i = 0; i < 5; i++) {
          const goal = i === 0 ? (gait === 0 && !chat ? 1 : 0) : i === 4 ? (gait === 0 && chat ? 1 : 0) : gait === i ? 1 : 0
          w[i]! += (goal - w[i]!) * k
          all[i]?.setEffectiveWeight(w[i]!)
        }
        if (walk) walk.timeScale = THREE.MathUtils.clamp(speed / pace.walk, 0.7, 1.75)
        if (jog) jog.timeScale = THREE.MathUtils.clamp(speed / pace.jog, 0.75, 1.6)
        if (run) run.timeScale = THREE.MathUtils.clamp(speed / pace.run, 0.8, 1.35)
        // Distance LOD: offscreen people barely animate (nobody sees them); far ones at ~8 fps; near ones every frame.
        root.userData.acc = (root.userData.acc ?? 0) + dt
        const lod = mixerLod(root)
        if (root.userData.acc < lod) return
        mixer.update(root.userData.acc)
        root.userData.acc = 0
      }
    }).catch(() => { if (pending === name) pending = null; if (!root.userData.person) bodyRef.visible = true })
  }

  const first = (root.userData.look as Look | undefined) ?? opts.look
  root.userData.applyLook = (next: Look) => {
    root.userData.look = next
    const want = figure(model, next)
    const person = root.userData.person as THREE.Object3D | undefined
    if (pending === want) return // already on its way: it will wear root.userData.look, or this look
    if (want !== mounted || !person) { mount(want, next); return }
    const mesh = person.getObjectByName('Person') as THREE.SkinnedMesh | undefined
    if (mesh) paint(mesh, mesh.userData.template as Template, next, detail)
  }
  mount(figure(model, first), first)
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

type Limbs = { sides: Array<{ upper: THREE.Object3D; fore: THREE.Object3D; hand: THREE.Object3D; thigh: THREE.Object3D; knee: THREE.Object3D; foot: THREE.Object3D; side: number }> }
function limbs(person: THREE.Object3D): Limbs | null {
  const get = (n: string) => person.getObjectByName(n)
  const hips = get(B.hips)
  if (!hips) return null
  const mid = hips.getWorldPosition(new THREE.Vector3())
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(person.getWorldQuaternion(new THREE.Quaternion()))
  const sides: Limbs['sides'] = []
  for (const k of ['L', 'R']) {
    const upper = get(`Bip01_${k}_UpperArm`), fore = get(`Bip01_${k}_Forearm`), hand = get(`Bip01_${k}_Hand`), thigh = get(`Bip01_${k}_Thigh`), knee = get(`Bip01_${k}_Calf`), foot = get(`Bip01_${k}_Foot`)
    if (!upper || !fore || !hand || !thigh || !knee || !foot) return null
    // Which side of the body this arm is on, from where it actually is.
    const side = Math.sign(upper.getWorldPosition(new THREE.Vector3()).sub(mid).dot(right)) || 1
    sides.push({ upper, fore, hand, thigh, knee, foot, side })
  }
  return { sides }
}

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vDir = new THREE.Vector3()
const vUp = new THREE.Vector3(0, 1, 0)
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

/**
 * A still, posed person for a room (worshippers, shop mannequins, the mentor): one skinned mesh, no animation
 * mixer afterwards. `stand` is a relaxed standing pose from the idle clip; `pray` folds the hands over the
 * chest; `kneel` sits back on the heels with the hands on the thighs. `mono` paints skin and hair one colour
 * (a shop mannequin). Returns at once and fills in when the model has loaded.
 */
export function posedHuman(model: HumanModel, o: { pose: 'stand' | 'pray' | 'kneel'; look?: Look; height?: number; cap?: number; mono?: number; detail?: number; extras?: Extras; onReady?: () => void }): THREE.Group {
  const root = new THREE.Group()
  const look: Look | undefined = o.mono !== undefined ? { skin: o.mono, hair: o.mono, ...o.look } : o.look
  void load(figure(model, look)).then((t) => {
    const person = cloneSkinned(t.scene) as THREE.Group
    person.scale.setScalar((o.height ?? 1.74) / t.height)
    const mesh = person.getObjectByName('Person') as THREE.SkinnedMesh
    mesh.castShadow = true
    mesh.frustumCulled = false
    mesh.userData.template = t
    const painted = paint(mesh, t, look, o.detail ?? 0.5)
    root.add(person)
    // Start from a moment of the idle clip: weight on both feet, arms hanging naturally.
    const idle = t.clips.find((c) => c.name === 'Idle')
    if (idle) {
      const mixer = new THREE.AnimationMixer(person)
      mixer.clipAction(idle).play()
      mixer.setTime((Math.abs(Math.sin(root.id * 12.9898)) * 0.9 + 0.05) * idle.duration)
    }
    root.updateMatrixWorld(true)
    const rig = limbs(person)
    if (!rig) return
    person.getWorldQuaternion(qWorld)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(qWorld).normalize()
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(qWorld).normalize()
    const dir = (r: number, u: number, f: number) => new THREE.Vector3().addScaledVector(right, r).addScaledVector(vUp, u).addScaledVector(fwd, f).normalize()
    if (o.pose === 'kneel') {
      // Sit back on the heels: thighs forward and a little down, shins folded back under them along the floor.
      for (const s of rig.sides) {
        aim(s.thigh, s.knee, dir(s.side * 0.06, -0.36, 0.93))
        aim(s.knee, s.foot, dir(s.side * 0.02, -0.16, -0.98))
      }
      root.updateMatrixWorld(true)
      // Rest the knees on the floor.
      const knee = rig.sides[0]!.knee.getWorldPosition(new THREE.Vector3())
      const base = root.getWorldPosition(new THREE.Vector3())
      person.position.y += (0.085 - (knee.y - base.y)) / (root.scale.y || 1)
      root.updateMatrixWorld(true)
    }
    for (const s of rig.sides) {
      if (o.pose === 'pray') {
        aim(s.upper, s.fore, dir(s.side * 0.22, -0.93, 0.28))
        aim(s.fore, s.hand, dir(-s.side * 0.86, 0.22, 0.46))
      } else if (o.pose === 'kneel') {
        aim(s.upper, s.fore, dir(s.side * 0.2, -0.93, 0.3))
        aim(s.fore, s.hand, dir(-s.side * 0.2, -0.42, 0.88))
      }
    }
    if (o.cap !== undefined && t.name !== 'kurta') {
      // Kufi: a small round cap on the crown, fixed to the head bone.
      const head = person.getObjectByName(B.head)
      if (head) {
        person.updateMatrixWorld(true)
        const hp = head.getWorldPosition(new THREE.Vector3())
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.096, 0.07, 12), new THREE.MeshStandardMaterial({ color: o.cap, roughness: 0.9 }))
        cap.position.copy(root.worldToLocal(hp.clone().add(new THREE.Vector3(0, (t.crown - 0.03) * person.scale.y, 0)).addScaledVector(fwd, 0.012)))
        root.add(cap)
        head.attach(cap)
      }
    }
    if (o.extras) jewels(person, t, o.extras)
    window.dispatchEvent(new Event('gd-avatar-ready'))
    void painted.then(() => o.onReady?.())
  }).catch(() => { o.onReady?.() /* the room simply has one figure fewer */ })
  return root
}

/** Let go of a posed figure's own texture (shop photographs make many and keep none). */
export function releaseHuman(root: THREE.Object3D): void {
  const mesh = root.getObjectByName('Person') as THREE.SkinnedMesh | undefined
  const t = mesh?.userData.template as Template | undefined
  if (mesh && t) void paint(mesh, t, undefined, 1)
}
