// Real surface finishes for room floors and walls: CC0 Poly Haven sets (see CREDITS.md), packed small by
// tools/pack-surfaces.mjs. Low keeps colour only (matte, cheapest); Medium adds relief and sheen maps;
// High adds a real mirror pass on polished floors, so people, lamps and furniture reflect in the boards.
import * as THREE from 'three'
import type { Graphics } from './logic.ts'

export type FloorKind = 'wood' | 'stone' | 'tile' | 'rubber' | 'carpet'
type Entry = { mat: THREE.MeshStandardMaterial; normal: THREE.Texture | null; rough: THREE.Texture | null; matte: number; sheen: number; relief: number }

const DIR = '/tex/surf/'
const loader = new THREE.TextureLoader()
const images = new Map<string, Promise<THREE.Texture>>()
const entries: Entry[] = []
const mirrors: Array<{ uniforms: { uMirror: { value: number } }; strength: number }> = []
let tier: Graphics = 'low'

function image(file: string, srgb: boolean): Promise<THREE.Texture> {
  let p = images.get(file)
  if (!p) {
    p = loader.loadAsync(DIR + file).then((t) => { t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t })
    images.set(file, p)
  }
  return p
}
/** A tiling copy with its own repeat (copies share one upload). */
async function tile(file: string, srgb: boolean, rx: number, ry: number): Promise<THREE.Texture> {
  const t = (await image(file, srgb)).clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

function apply(e: Entry): void {
  const rich = tier !== 'low'
  const want = rich ? e.normal : null
  if (e.mat.normalMap !== want || e.mat.roughnessMap !== (rich ? e.rough : null)) {
    e.mat.normalMap = want
    e.mat.roughnessMap = rich ? e.rough : null
    e.mat.needsUpdate = true
  }
  e.mat.normalScale.setScalar(e.relief)
  // With a roughness map the factor scales the map; without one it is the roughness itself.
  e.mat.roughness = rich ? (e.rough ? e.sheen / 0.5 : e.sheen) : e.matte
  e.mat.envMapIntensity = rich ? 0.55 : 0.3
}

/** Called when the graphics setting changes (Low / Medium / High). */
export function setSurfaceTier(g: Graphics): void {
  tier = g
  for (const e of entries) apply(e)
  for (const m of mirrors) m.uniforms.uMirror.value = g === 'high' ? m.strength : 0
}

const FLOORS: Record<FloorKind, { colour?: string; normal?: string; rough?: string; metres: number; matte: number; sheen: number; relief: number }> = {
  wood: { colour: 'wood_d.webp', normal: 'wood_n.webp', rough: 'wood_r.webp', metres: 2.4, matte: 0.78, sheen: 0.34, relief: 0.5 },
  stone: { colour: 'stone_d.webp', normal: 'stone_n.webp', rough: 'stone_r.webp', metres: 2.4, matte: 0.7, sheen: 0.28, relief: 0.6 },
  tile: { normal: 'rubber_n.webp', metres: 1.6, matte: 0.5, sheen: 0.22, relief: 0.35 },
  rubber: { normal: 'rubber_n.webp', metres: 2, matte: 0.95, sheen: 0.9, relief: 0.8 },
  carpet: { normal: 'fabric_n.webp', metres: 0.8, matte: 1, sheen: 1, relief: 0.9 },
}

/** Dress a floor (or a carpet) of `w` x `d` metres. The material's colour tints the boards or tiles. */
export function floorFinish(mat: THREE.MeshStandardMaterial, kind: FloorKind, w: number, d: number): void {
  const f = FLOORS[kind]
  const rx = w / f.metres, ry = d / f.metres
  const e: Entry = { mat, normal: null, rough: null, matte: f.matte, sheen: f.sheen, relief: f.relief }
  entries.push(e)
  apply(e)
  if (f.colour) void tile(f.colour, true, rx, ry).then((t) => { mat.map = t; mat.needsUpdate = true }).catch(() => undefined)
  if (f.normal) void tile(f.normal, false, rx, ry).then((t) => { e.normal = t; apply(e) }).catch(() => undefined)
  if (f.rough) void tile(f.rough, false, rx, ry).then((t) => { e.rough = t; apply(e) }).catch(() => undefined)
}

/** Trowelled plaster on walls: relief only, the wall keeps its own colour. */
export function wallFinish(mat: THREE.MeshStandardMaterial, rx = 4, ry = 1.4): void {
  const e: Entry = { mat, normal: null, rough: null, matte: mat.roughness, sheen: Math.min(mat.roughness, 0.86), relief: 0.7 }
  entries.push(e)
  void tile('plaster_n.webp', false, rx, ry).then((t) => { e.normal = t; apply(e) }).catch(() => undefined)
}

// ---- polished floors: a planar mirror, High only ----
const SIZE = 512
const vCam = new THREE.PerspectiveCamera()
const pos = new THREE.Vector3(), camPos = new THREE.Vector3(), normal = new THREE.Vector3(), view = new THREE.Vector3(), look = new THREE.Vector3(), target = new THREE.Vector3()
const rot = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4()

/**
 * Make a floor mesh (a plane facing local +z) reflect the room. The mirrored view is drawn once a frame into a
 * small target while the floor is on screen and the setting is High; otherwise it costs nothing.
 */
export function glossFloor(mesh: THREE.Mesh, strength = 0.24): void {
  const mat = mesh.material as THREE.MeshStandardMaterial
  let rt: THREE.WebGLRenderTarget | null = null
  const uniforms = { tMirror: { value: null as THREE.Texture | null }, uMirrorMatrix: { value: new THREE.Matrix4() }, uMirror: { value: tier === 'high' ? strength : 0 } }
  mirrors.push({ uniforms, strength })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uMirrorMatrix;\nvarying vec4 vMirror;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMirror = uMirrorMatrix * vec4(transformed, 1.0);')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tMirror;\nuniform float uMirror;\nvarying vec4 vMirror;')
      .replace('#include <opaque_fragment>', `if (uMirror > 0.0) {
        // The boards' relief nudges the reflection; five taps soften it like a satin varnish.
        vec2 m = vMirror.xy / vMirror.w + normal.xy * 0.012;
        vec2 px = vec2(${(2.2 / SIZE).toFixed(6)});
        vec3 refl = texture2D(tMirror, m).rgb * 0.36 + (texture2D(tMirror, m + vec2(px.x, 0.0)).rgb + texture2D(tMirror, m - vec2(px.x, 0.0)).rgb + texture2D(tMirror, m + vec2(0.0, px.y)).rgb + texture2D(tMirror, m - vec2(0.0, px.y)).rgb) * 0.16;
        float graze = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 4.0);
        float k = uMirror * (0.6 + 1.0 * graze) * (1.0 - 0.55 * roughnessFactor);
        outgoingLight = mix(outgoingLight, refl, clamp(k, 0.0, 0.8));
      }
      #include <opaque_fragment>`)
  }
  mat.customProgramCacheKey = () => 'gloss-floor'
  let frame = -1
  mesh.onBeforeRender = (renderer, scene, camera) => {
    if (uniforms.uMirror.value <= 0 || scene.overrideMaterial || renderer.info.render.frame === frame) return
    if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return
    // Same construction as three's Reflector: mirror the camera in the floor plane and clip at the floor.
    pos.setFromMatrixPosition(mesh.matrixWorld)
    camPos.setFromMatrixPosition(camera.matrixWorld)
    rot.extractRotation(mesh.matrixWorld)
    normal.set(0, 0, 1).applyMatrix4(rot)
    view.subVectors(pos, camPos)
    if (view.dot(normal) > 0) return
    frame = renderer.info.render.frame
    if (!rt) { rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 0 }); uniforms.tMirror.value = rt.texture }
    view.reflect(normal).negate().add(pos)
    rot.extractRotation(camera.matrixWorld)
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos)
    target.subVectors(pos, look).reflect(normal).negate().add(pos)
    vCam.position.copy(view)
    vCam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal)
    vCam.lookAt(target)
    vCam.far = (camera as THREE.PerspectiveCamera).far
    vCam.updateMatrixWorld()
    vCam.projectionMatrix.copy(camera.projectionMatrix)
    uniforms.uMirrorMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vCam.projectionMatrix).multiply(vCam.matrixWorldInverse).multiply(mesh.matrixWorld)
    plane.setFromNormalAndCoplanarPoint(normal, pos).applyMatrix4(vCam.matrixWorldInverse)
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
    const pm = vCam.projectionMatrix.elements
    q.set((Math.sign(clip.x) + pm[8]!) / pm[0]!, (Math.sign(clip.y) + pm[9]!) / pm[5]!, -1, (1 + pm[10]!) / pm[14]!)
    clip.multiplyScalar(2 / clip.dot(q))
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w
    mesh.visible = false
    const prevTarget = renderer.getRenderTarget(), prevXr = renderer.xr.enabled, prevShadow = renderer.shadowMap.autoUpdate
    renderer.xr.enabled = false
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(rt)
    renderer.state.buffers.depth.setMask(true)
    if (renderer.autoClear === false) renderer.clear()
    renderer.render(scene, vCam)
    renderer.xr.enabled = prevXr
    renderer.shadowMap.autoUpdate = prevShadow
    renderer.setRenderTarget(prevTarget)
    const viewport = (camera as THREE.PerspectiveCamera & { viewport?: THREE.Vector4 }).viewport
    if (viewport !== undefined) renderer.state.viewport(viewport)
    mesh.visible = true
  }
}
