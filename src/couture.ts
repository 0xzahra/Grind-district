// Couture: hand-beaded looks from the boutique's Runway collection. Real beads, not a printed pattern: pearls,
// gold beads and diamonds are scattered over the garment on the figure's own surface, drop fringes hang from the
// hems, and every bead is skinned to the bone under it, so the whole piece moves with the body. The bralette sets
// also bare the midriff, shoulders and arms: the top's cloth outside the cups and band is painted as skin in the
// figure's texture (see skinPaint.ts, `bare`). Original designs.
//
// Each look is one mesh per material (pearl, gold, diamond), so a beaded figure adds two or three draw calls.
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { inBra as inBraAt, type Bare } from './skinPaint.ts'

export type Couture = 'pearl-dress' | 'gold-dress' | 'pearl-bra' | 'gold-bra' | 'diamond-bra'
export const COUTURE: readonly Couture[] = ['pearl-dress', 'gold-dress', 'pearl-bra', 'gold-bra', 'diamond-bra']
export const isCouture = (v: unknown): v is Couture => typeof v === 'string' && (COUTURE as readonly string[]).includes(v)
/** The bralette sets bare the midriff (and the shoulders and arms): the texture is painted for those. */
export const bares = (c?: Couture) => !!c && c.endsWith('-bra')
/** A fine woven dot under the beads (the texture), so the cloth between them reads as beaded too. */
export const beadedCloth = (c?: Couture) => !!c

type Kind = 'pearl' | 'gold' | 'diamond'
const MAT: Record<Kind, THREE.Material> = {
  // Pearl: a warm white with a soft lustre (clearcoat over a satin body).
  pearl: new THREE.MeshPhysicalMaterial({ color: 0xf3ede2, roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.2 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 1, roughness: 0.26, envMapIntensity: 1.4 }),
  // Diamond: faceted mirror (flat-shaded octahedra) that throws the sky back in sparks.
  diamond: new THREE.MeshStandardMaterial({ color: 0xf4f8ff, metalness: 1, roughness: 0.03, emissive: 0x1c2230, flatShading: true, envMapIntensity: 2.6 }),
}

// ---- the figure, measured once ----
type Body = {
  n: number
  pos: Float32Array; nrm: Float32Array // rest pose, world metres (y up, +z the way the figure faces)
  uv: Float32Array; index: ArrayLike<number>
  skinI: THREE.BufferAttribute | THREE.InterleavedBufferAttribute; skinW: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
  vRegion: Uint8Array // per vertex: 1 skin, 2 hair, 3 top, 4 bottom, 5 shoes (from the region mask)
  /** From a vertex's bind space (the geometry as stored) to the rest pose in the world, by that vertex's own bone
   *  weights: a bead built in the world is carried back into bind space by its inverse. */
  toWorld: (v: number) => THREE.Matrix4
  land: { neck: THREE.Vector3; bust: THREE.Vector3[]; bustY: number; underY: number; waistY: number; cx: number; cz: number } | null
}
const bodies = new Map<string, Promise<Body | null>>()

/** Read the figure's region mask small (nearest pixel, so region ids stay exact). */
async function smallMask(url: string): Promise<{ d: Uint8ClampedArray; w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(await (await fetch(url)).blob())
    const w = 256, h = Math.max(1, Math.round((256 * bmp.height) / bmp.width))
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
    const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
    g.imageSmoothingEnabled = false
    g.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    return { d: g.getImageData(0, 0, w, h).data, w, h }
  } catch { return null }
}

export function measureBody(key: string, scene: THREE.Object3D, maskUrl: string): Promise<Body | null> {
  let p = bodies.get(key)
  if (!p) {
    p = smallMask(maskUrl).then((mask) => {
      const mesh = scene.getObjectByName('Person') as THREE.SkinnedMesh | undefined
      if (!mesh || !mask) return null
      scene.updateMatrixWorld(true)
      const g = mesh.geometry
      const P = g.getAttribute('position'), N = g.getAttribute('normal'), U = g.getAttribute('uv')
      const skinI = g.getAttribute('skinIndex'), skinW = g.getAttribute('skinWeight')
      if (!P || !N || !U || !skinI || !skinW) return null
      const n = P.count
      // The geometry is stored in bind space; the figure stands in its rest pose. Each vertex goes from one to the
      // other by the blend of its bones' (rest x inverse bind) matrices, wrapped in the mesh's own bind matrices.
      const sk = mesh.skeleton
      const boneMat = sk.bones.map((b, j) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[j]!))
      const pre = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, mesh.bindMatrixInverse)
      const cache = new Map<number, THREE.Matrix4>()
      const toWorld = (i: number) => {
        let K = cache.get(i)
        if (!K) {
          const e = new Array<number>(16).fill(0)
          for (let j = 0; j < 4; j++) {
            const w = skinW.getComponent(i, j)
            if (!w) continue
            const be = boneMat[skinI.getComponent(i, j)]?.elements
            if (be) for (let k = 0; k < 16; k++) e[k]! += w * be[k]!
          }
          K = new THREE.Matrix4().fromArray(e).premultiply(pre).multiply(mesh.bindMatrix)
          cache.set(i, K)
        }
        return K
      }
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), vRegion = new Uint8Array(n)
      const v = new THREE.Vector3(), nm = new THREE.Matrix3()
      for (let i = 0; i < n; i++) {
        const K = toWorld(i)
        v.fromBufferAttribute(P, i).applyMatrix4(K); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z
        v.fromBufferAttribute(N, i).applyMatrix3(nm.getNormalMatrix(K)).normalize(); nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z
        const u = U.getX(i), w = U.getY(i)
        uv[i * 2] = u; uv[i * 2 + 1] = w
        const x = Math.min(mask.w - 1, Math.max(0, Math.floor(u * mask.w))), y = Math.min(mask.h - 1, Math.max(0, Math.floor(w * mask.h)))
        const o = (y * mask.w + x) * 4
        vRegion[i] = mask.d[o + 1]! > 40 ? Math.round(mask.d[o]! / 40) : 0
      }
      const index = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i)
      // Landmarks: the neck, and each side's bust point (the furthest-forward part of the top on that side).
      const neckBone = scene.getObjectByName('Bip01_Neck')
      let land: Body['land'] = null
      if (neckBone) {
        const neck = neckBone.getWorldPosition(new THREE.Vector3())
        const bust: THREE.Vector3[] = []
        for (const side of [1, -1]) {
          let best = -1, bz = -Infinity
          for (let i = 0; i < n; i++) {
            if (vRegion[i] !== 3) continue
            const x = pos[i * 3]! - neck.x, y = pos[i * 3 + 1]!, z = pos[i * 3 + 2]!
            if (x * side < 0.035 || x * side > 0.16 || y > neck.y - 0.1 || y < neck.y - 0.32) continue
            if (z > bz) { bz = z; best = i }
          }
          if (best >= 0) bust.push(new THREE.Vector3(pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2]))
        }
        if (bust.length === 2) {
          // Symmetric about the neck: the further-out side sets the spacing (the nearer one can land in the cleavage).
          const bustY = (bust[0]!.y + bust[1]!.y) / 2, z = Math.max(bust[0]!.z, bust[1]!.z)
          const ax = THREE.MathUtils.clamp(Math.max(Math.abs(bust[0]!.x - neck.x), Math.abs(bust[1]!.x - neck.x)), 0.06, 0.105)
          // The waist: the top edge of the skirt (the top hangs over it; below this line it is cut as skirt).
          let skirtTop = -Infinity
          for (let i = 0; i < n; i++) if (vRegion[i] === 4) skirtTop = Math.max(skirtTop, pos[i * 3 + 1]!)
          const underY = bustY - 0.072
          const waistY = Number.isFinite(skirtTop) ? Math.min(underY - 0.08, skirtTop + 0.012) : underY - 0.16
          land = { neck, bust: [new THREE.Vector3(neck.x + ax, bustY, z), new THREE.Vector3(neck.x - ax, bustY, z)], bustY, underY, waistY, cx: neck.x, cz: neck.z }
        }
      }
      // Only the anchors of beads need their matrices again: let the per-vertex cache go.
      cache.clear()
      return { n, pos, nrm, uv, index, skinI, skinW, vRegion, toWorld, land }
    })
    bodies.set(key, p)
  }
  return p
}

// ---- where the bralette is: the cups and the band under them; everything else of the top is bare ----
const braOf = (b: Body) => (b.land ? { bust: b.land.bust.flatMap((v) => [v.x, v.y, v.z]), underY: b.land.underY, waistY: b.land.waistY } : null)
function inBra(b: Body, x: number, y: number, z: number): boolean {
  const bra = braOf(b)
  return !bra || inBraAt(bra, x, y, z)
}
/** The top's triangles with their rest-pose corners, for the texture painter to bare all but the bralette. */
export function bareTriangles(b: Body): Bare | undefined {
  const bra = braOf(b)
  if (!bra) return undefined
  const out: number[] = []
  const I = b.index, P = b.pos
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!, c = I[t + 1]!, d = I[t + 2]!
    if (b.vRegion[a] !== 3 && b.vRegion[c] !== 3 && b.vRegion[d] !== 3) continue
    for (const k of [a, c, d]) out.push(b.uv[k * 2]!, b.uv[k * 2 + 1]!, P[k * 3]!, P[k * 3 + 1]!, P[k * 3 + 2]!)
  }
  return { tris: new Float32Array(out), ...bra }
}

// ---- beads ----
type Bead = { x: number; y: number; z: number; nx: number; ny: number; nz: number; r: number; kind: Kind; v: number; drop?: number }
/** A small seeded random, so a look's beads sit in the same places every time it is worn. */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

/** Scatter beads evenly (no two closer than `gap`) over the triangles that pass `keep`. */
function scatter(b: Body, keep: (region: number, x: number, y: number, z: number) => boolean, gap: number, max: number, rand: () => number, make: (s: Omit<Bead, 'r' | 'kind'>) => Bead | null, where?: (x: number, y: number, z: number) => boolean): Bead[] {
  const I = b.index, P = b.pos, Nn = b.nrm
  const tris: number[] = [], acc: number[] = []
  let total = 0
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t]!, c = I[t + 1]!, d = I[t + 2]!
    const reg = b.vRegion[a] === b.vRegion[c] ? b.vRegion[a]! : b.vRegion[d]!
    const x = (P[a * 3]! + P[c * 3]! + P[d * 3]!) / 3, y = (P[a * 3 + 1]! + P[c * 3 + 1]! + P[d * 3 + 1]!) / 3, z = (P[a * 3 + 2]! + P[c * 3 + 2]! + P[d * 3 + 2]!) / 3
    if (!keep(reg, x, y, z)) continue
    e1.set(P[c * 3]! - P[a * 3]!, P[c * 3 + 1]! - P[a * 3 + 1]!, P[c * 3 + 2]! - P[a * 3 + 2]!)
    e2.set(P[d * 3]! - P[a * 3]!, P[d * 3 + 1]! - P[a * 3 + 1]!, P[d * 3 + 2]! - P[a * 3 + 2]!)
    const area = e1.cross(e2).length() / 2
    if (area <= 0) continue
    total += area; tris.push(t); acc.push(total)
  }
  if (!tris.length) return []
  const cell = gap, grid = new Map<string, number[]>(), pts: number[] = []
  const near = (x: number, y: number, z: number) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell)
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const l = grid.get(`${gx + i},${gy + j},${gz + k}`)
      if (l) for (const q of l) { const dx = pts[q]! - x, dy = pts[q + 1]! - y, dz = pts[q + 2]! - z; if (dx * dx + dy * dy + dz * dz < gap * gap) return true }
    }
    return false
  }
  const out: Bead[] = []
  for (let tries = 0; tries < max * 10 && out.length < max; tries++) {
    // Pick a triangle by area, then a point in it.
    const want = rand() * total
    let lo = 0, hi = acc.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (acc[mid]! < want) lo = mid + 1; else hi = mid }
    const t = tris[lo]!, a = I[t]!, c = I[t + 1]!, d = I[t + 2]!
    let u = rand(), w = rand(); if (u + w > 1) { u = 1 - u; w = 1 - w }
    const s = 1 - u - w
    const x = P[a * 3]! * s + P[c * 3]! * u + P[d * 3]! * w, y = P[a * 3 + 1]! * s + P[c * 3 + 1]! * u + P[d * 3 + 1]! * w, z = P[a * 3 + 2]! * s + P[c * 3 + 2]! * u + P[d * 3 + 2]! * w
    if ((where && !where(x, y, z)) || near(x, y, z)) continue
    let nx = Nn[a * 3]! * s + Nn[c * 3]! * u + Nn[d * 3]! * w, ny = Nn[a * 3 + 1]! * s + Nn[c * 3 + 1]! * u + Nn[d * 3 + 1]! * w, nz = Nn[a * 3 + 2]! * s + Nn[c * 3 + 2]! * u + Nn[d * 3 + 2]! * w
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl
    // Skinned to the corner that carries most of the point, so a bead never straddles two bone sets.
    const v = s >= u && s >= w ? a : u >= w ? c : d
    const bead = make({ x, y, z, nx, ny, nz, v })
    if (!bead) continue
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`
    const l = grid.get(key) ?? []; l.push(pts.length); grid.set(key, l); pts.push(x, y, z)
    out.push(bead)
  }
  return out
}

/** Drop fringe: strands of beads hanging straight down from a hem, ending in a long drop. */
function fringe(b: Body, region: number, pick: (x: number, y: number, z: number) => boolean, spacing: number, beads: [number, number], r: number, kind: Kind, dropKind: Kind, rand: () => number, edge: 'low' | number): Bead[] {
  const P = b.pos
  const idx: number[] = []
  let lowY = Infinity
  for (let i = 0; i < b.n; i++) if (b.vRegion[i] === region && pick(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!)) { idx.push(i); lowY = Math.min(lowY, P[i * 3 + 1]!) }
  if (!idx.length) return []
  const at = edge === 'low' ? lowY : edge
  const ring = idx.filter((i) => Math.abs(P[i * 3 + 1]! - at) < 0.018)
  if (!ring.length) return []
  let cx = 0, cz = 0
  for (const i of ring) { cx += P[i * 3]!; cz += P[i * 3 + 2]! }
  cx /= ring.length; cz /= ring.length
  let R = 0
  for (const i of ring) R += Math.hypot(P[i * 3]! - cx, P[i * 3 + 2]! - cz)
  R /= ring.length
  const bins = Math.max(6, Math.round((Math.PI * 2 * R) / spacing))
  const best = new Map<number, number>()
  for (const i of ring) {
    const a = Math.atan2(P[i * 3]! - cx, P[i * 3 + 2]! - cz)
    const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * bins) % bins
    const cur = best.get(k)
    if (cur === undefined || Math.abs(P[i * 3 + 1]! - at) < Math.abs(P[cur * 3 + 1]! - at)) best.set(k, i)
  }
  const out: Bead[] = []
  for (const i of best.values()) {
    const ox = P[i * 3]! - cx, oz = P[i * 3 + 2]! - cz, ol = Math.hypot(ox, oz) || 1
    const rx = ox / ol, rz = oz / ol
    const x = P[i * 3]! + rx * 0.004, z = P[i * 3 + 2]! + rz * 0.004
    let y = P[i * 3 + 1]! - r
    const count = beads[0] + Math.floor(rand() * (beads[1] - beads[0] + 1))
    for (let k = 0; k < count; k++) {
      // Each strand flares out a touch as it falls, so it clears the leg below.
      const flare = 1 + k * 0.08
      out.push({ x: cx + (x - cx) * flare, y, z: cz + (z - cz) * flare, nx: rx, ny: 0, nz: rz, r: r * (0.85 + rand() * 0.3), kind, v: i })
      y -= r * 2.15
    }
    out.push({ x: cx + (x - cx) * (1 + count * 0.08), y: y - r * 0.6, z: cz + (z - cz) * (1 + count * 0.08), nx: rx, ny: 0, nz: rz, r: r * 1.25, kind: dropKind, v: i, drop: 1.75 })
  }
  return out
}

/** All the beads of a look, in rest-pose world metres. */
function plan(b: Body, c: Couture): Bead[] {
  const rand = rng(COUTURE.indexOf(c) * 7919 + 17)
  const bead = (kind: Kind, r: number, jitter = 0.25) => (s: Omit<Bead, 'r' | 'kind'>): Bead => ({ ...s, kind, r: r * (1 - jitter / 2 + rand() * jitter) })
  const mix = (main: Kind, r: number, accent: Kind, share: number) => (s: Omit<Bead, 'r' | 'kind'>): Bead => (rand() < share ? { ...s, kind: accent, r: r * 0.8 } : { ...s, kind: main, r: r * (0.85 + rand() * 0.3) })
  const top = (reg: number) => reg === 3
  const L = b.land
  // The skirt, and for the bralette sets the part of the top below the waist (cut as skirt in the texture too).
  const skirt = (reg: number, _x = 0, y = 0) => reg === 4 || (bares(c) && reg === 3 && !!L && y < L.waistY + 0.03)
  if (c === 'pearl-dress' || c === 'gold-dress') {
    const main: Kind = c === 'pearl-dress' ? 'pearl' : 'gold'
    return [
      // Bodice and sleeves densely, the skirt a little looser, then a long fringe from the hem.
      ...scatter(b, (reg) => top(reg), 0.0135, 1500, rand, c === 'gold-dress' ? mix('gold', 0.0056, 'diamond', 0.12) : bead('pearl', 0.0058)),
      ...scatter(b, (reg) => skirt(reg), 0.0145, 1100, rand, c === 'gold-dress' ? mix('gold', 0.006, 'diamond', 0.1) : bead('pearl', 0.0062)),
      ...fringe(b, 4, () => true, 0.0155, [3, 6], 0.0042, main, main, rand, 'low'),
    ]
  }
  // Bralette sets: the cups and band covered close, a short fringe from the band, a beaded mini skirt with a fringe.
  // Triangles of the top near the bust, then each bead tested at its own point (the top is coarse: one triangle
  // can cross the edge of a cup).
  const cups = (reg: number, _x: number, y: number) => reg === 3 && (!L || (y > L.underY - 0.06 && y < L.bustY + 0.1))
  const onBra = (x: number, y: number, z: number) => inBra(b, x, y, z)
  const belowWaist = (_x: number, y: number) => !L || y < L.waistY - 0.004
  const front = (_x: number, _y: number, z: number) => !L || z > L.cz - 0.01
  if (c === 'diamond-bra') {
    return [
      ...scatter(b, cups, 0.0092, 900, rand, mix('diamond', 0.0046, 'gold', 0.08), onBra),
      ...(L ? fringe(b, 3, (x, y, z) => front(x, y, z) && Math.abs(y - L.underY) < 0.03, 0.012, [1, 3], 0.0032, 'diamond', 'diamond', rand, L.underY - 0.01) : []),
      ...scatter(b, (reg, x, y) => skirt(reg, x, y), 0.016, 800, rand, bead('diamond', 0.0042), belowWaist),
      ...fringe(b, 4, () => true, 0.013, [2, 4], 0.0034, 'diamond', 'diamond', rand, 'low'),
    ]
  }
  const main: Kind = c === 'pearl-bra' ? 'pearl' : 'gold'
  return [
    ...scatter(b, cups, 0.0098, 900, rand, c === 'gold-bra' ? mix('gold', 0.0048, 'diamond', 0.16) : mix('pearl', 0.005, 'gold', 0.06), onBra),
    ...(L ? fringe(b, 3, (x, y, z) => front(x, y, z) && Math.abs(y - L.underY) < 0.03, 0.013, [1, 3], 0.0036, main, main, rand, L.underY - 0.01) : []),
    ...scatter(b, (reg, x, y) => skirt(reg, x, y), 0.017, 800, rand, bead(main, 0.0048), belowWaist),
    ...fringe(b, 4, () => true, 0.0135, [2, 4], 0.0038, main, main, rand, 'low'),
  ]
}

// Unit bead shapes: a round pearl/gold bead (indexed, smooth) and a faceted diamond.
const ROUND = (() => { const g = mergeVertices(new THREE.IcosahedronGeometry(1, 1)); g.deleteAttribute('uv'); const p = g.getAttribute('position'); g.setAttribute('normal', p.clone()); return g })()
const FACET = (() => { const g = new THREE.OctahedronGeometry(1, 0); g.deleteAttribute('uv'); g.computeVertexNormals(); return g })()

/** One skinned mesh per bead material, in the Person mesh's own (bind) space. */
export function beadMeshes(b: Body, c: Couture): Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> {
  const beads = plan(b, c)
  const out: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = []
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3()
  const v = new THREE.Vector3(), nmm = new THREE.Matrix3(), inv = new THREE.Matrix4()
  for (const kind of ['pearl', 'gold', 'diamond'] as Kind[]) {
    const mine = beads.filter((x) => x.kind === kind)
    if (!mine.length) continue
    const shape = kind === 'diamond' ? FACET : ROUND
    const sp = shape.getAttribute('position'), sn = shape.getAttribute('normal'), si = shape.index
    const nv = sp.count, ni = si ? si.count : 0
    const pos = new Float32Array(mine.length * nv * 3), nrm = new Float32Array(mine.length * nv * 3)
    const skI = new Uint16Array(mine.length * nv * 4), skW = new Float32Array(mine.length * nv * 4)
    const idx = si ? new Uint32Array(mine.length * ni) : null
    mine.forEach((bd, k) => {
      // Sit the bead on the surface (most of it proud of the cloth); a drop hangs long and points down.
      dir.set(bd.nx, bd.ny, bd.nz)
      if (kind === 'diamond' && !bd.drop) q.setFromUnitVectors(up, dir)
      else q.identity()
      s.set(bd.r, bd.r * (bd.drop ?? (kind === 'diamond' ? 0.8 : 1)), bd.r)
      const lift = bd.drop ? 0 : bd.r * 0.55
      t.set(bd.x + bd.nx * lift, bd.y + bd.ny * lift, bd.z + bd.nz * lift)
      m.compose(t, q, s).premultiply(inv.copy(b.toWorld(bd.v)).invert())
      nmm.getNormalMatrix(m)
      for (let i = 0; i < nv; i++) {
        const o = (k * nv + i) * 3
        v.fromBufferAttribute(sp, i).applyMatrix4(m); pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z
        v.fromBufferAttribute(sn, i).applyMatrix3(nmm).normalize(); nrm[o] = v.x; nrm[o + 1] = v.y; nrm[o + 2] = v.z
        const w = (k * nv + i) * 4
        for (let j = 0; j < 4; j++) { skI[w + j] = b.skinI.getComponent(bd.v, j); skW[w + j] = b.skinW.getComponent(bd.v, j) }
      }
      if (idx && si) for (let i = 0; i < ni; i++) idx[k * ni + i] = si.getX(i) + k * nv
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skI, 4))
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skW, 4))
    if (idx) g.setIndex(new THREE.BufferAttribute(idx, 1))
    g.computeBoundingSphere()
    out.push({ geometry: g, material: MAT[kind] })
  }
  return out
}

/** Dress a live figure in a look's beads: skinned meshes riding the figure's own skeleton. Returns them. */
export function wearBeads(person: THREE.Object3D, parts: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>): THREE.SkinnedMesh[] {
  const body = person.getObjectByName('Person') as THREE.SkinnedMesh | undefined
  if (!body?.parent) return []
  const made: THREE.SkinnedMesh[] = []
  for (const p of parts) {
    const m = new THREE.SkinnedMesh(p.geometry, p.material)
    m.name = 'couture'
    m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale)
    m.frustumCulled = false
    m.castShadow = false
    m.raycast = () => undefined
    m.userData.ghost = true
    body.parent.add(m)
    m.bind(body.skeleton, body.bindMatrix)
    made.push(m)
  }
  return made
}
