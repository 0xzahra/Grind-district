// Street and park trees: a bark-textured trunk with a few boughs and a crown built from cards of photographed
// leaves (Poly Haven, CC0; packed by tools/pack-nature.mjs) instead of a faceted blob. The whole city's trees
// are three instanced meshes (trunks, leafy hearts, crowns), alpha-tested so they sort for free and cast real
// leaf shadows.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296
}

/** Trunk with four boughs reaching into the crown. One unit is about two metres once placed. */
function trunkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const stem = new THREE.CylinderGeometry(0.06, 0.115, 1.3, 9, 3, true)
  // A slight lean and flare so no two silhouettes look lathe-turned.
  const p = stem.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.65; p.setX(i, p.getX(i) * (1 + 0.5 * Math.max(0, 0.18 - y)) + 0.03 * Math.sin(y * 2.4)); p.setZ(i, p.getZ(i) * (1 + 0.5 * Math.max(0, 0.18 - y))) }
  stem.translate(0, 0.65, 0)
  parts.push(stem)
  const r = rng(7)
  for (let i = 0; i < 4; i++) {
    const len = 0.62 + r() * 0.25
    const b = new THREE.CylinderGeometry(0.018, 0.045, len, 6, 1, true)
    b.translate(0, len / 2, 0)
    b.rotateZ(0.55 + r() * 0.35)
    b.rotateY((i / 4) * Math.PI * 2 + r() * 0.6)
    b.translate(0.02, 1.02 + r() * 0.22, 0)
    parts.push(b)
  }
  const g = mergeGeometries(parts)!
  // Bark runs up the trunk: stretch the wrap so it reads as bark, not bands.
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 2.5)
  return g
}

/**
 * A mass of `cards` leaf-spray cards on an ellipsoid shell about `centreY`, shaded as one soft rounded form.
 * `inner` is how far in the innermost cards sit (0..1 of the radius), `leaf` the smallest card half-size.
 */
function crownGeometry(cards: number, seed: number, centreY = 1.82, inner = 0.42, leaf = 0.5): THREE.BufferGeometry {
  const r = rng(seed)
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = []
  const centre = new THREE.Vector3(0, centreY, 0)
  const c = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), n = new THREE.Vector3(), out = new THREE.Vector3(), v = new THREE.Vector3()
  for (let i = 0; i < cards; i++) {
    // Even directions (golden spiral) with jitter, most of them on the outer shell.
    const t = (i + 0.5) / cards
    const yy = 1 - 1.75 * t
    const ang = i * 2.399963 + r() * 0.5
    const rad = Math.sqrt(Math.max(0, 1 - yy * yy))
    out.set(Math.cos(ang) * rad, yy, Math.sin(ang) * rad)
    const shell = inner + (0.92 - inner) * Math.sqrt(r())
    c.set(out.x * shell * 0.98, out.y * shell * 0.74, out.z * shell * 0.98).add(centre)
    // Each card faces roughly outward, then tips and spins so the crown is full from every side.
    n.copy(out).add(v.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.1)).normalize()
    right.crossVectors(n, Math.abs(n.y) > 0.9 ? v.set(1, 0, 0) : v.set(0, 1, 0)).normalize()
    up.crossVectors(right, n).normalize()
    const spin = r() * Math.PI * 2, cs = Math.cos(spin), sn = Math.sin(spin)
    const rx = right.clone().multiplyScalar(cs).addScaledVector(up, sn), ux = up.clone().multiplyScalar(cs).addScaledVector(right, -sn)
    const size = leaf + r() * 0.26
    // Shading normal: outward from the crown's centre, lifted a little, so the mass lights like one rounded form.
    const sn3 = c.clone().sub(centre).normalize().lerp(v.set(0, 1, 0), 0.28).normalize()
    // Baked shade: darker inside and underneath, brightest on the sunlit top.
    const shade = THREE.MathUtils.clamp(0.5 + 0.34 * shell + 0.22 * out.y, 0.42, 1)
    const u0 = r() > 0.5 ? 0 : 0.5
    const base = pos.length / 3
    for (const [a, b, s, tt] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]] as const) {
      v.copy(c).addScaledVector(rx, a * size).addScaledVector(ux, b * size)
      pos.push(v.x, v.y, v.z); nor.push(sn3.x, sn3.y, sn3.z); uv.push(u0 + s * 0.5, tt); col.push(shade, shade, shade)
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

let shared: THREE.MeshLambertMaterial | null = null
/**
 * The one leaf material every tree, shrub and planter shares. Plain diffuse (Lambert): no sheen, so a card
 * seen edge-on never mirrors the sky as a grey leaf, and it is the cheapest lit material for overlapping cards.
 */
export function foliageMaterial(): THREE.MeshLambertMaterial {
  if (shared) return shared
  // Plain green until the photograph arrives, never white.
  const m = new THREE.MeshLambertMaterial({ color: 0x4f8a3e, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide })
  // No mipmaps on the leaves: averaged alpha turns a card seen edge-on into a flat grey-green patch.
  new THREE.TextureLoader().load('/tex/nature/leaves.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; m.map = t; m.color.setHex(0xffffff); m.needsUpdate = true })
  shared = m
  return m
}

/** A shrub about one unit in radius, centred on the origin: scale and place it (planters, hedges, garden trees). */
export function shrubGeometry(seed = 1, cards = 16): THREE.BufferGeometry {
  return crownGeometry(cards, seed, 0, 0.22, 0.46)
}

/**
 * Plant the city's trees. `spots` are [x, z, size]. Returns `sway(time)` for the wind. `light` uses half the
 * leaf cards (Low graphics): the fill-rate of overlapping leaves is the cost on phones, not the triangles.
 */
export function createTrees(scene: THREE.Scene, spots: Array<[number, number, number]>, o: { light?: boolean; anisotropy?: number } = {}): { sway: (time: number) => void } {
  const loader = new THREE.TextureLoader()
  const bark = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.95 })
  const leaves = foliageMaterial()
  loader.load('/tex/nature/bark.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = o.anisotropy ?? 4; bark.map = t; bark.color.setHex(0xffffff); bark.needsUpdate = true })
  const n = spots.length
  const trunks = new THREE.InstancedMesh(trunkGeometry(), bark, n)
  const crowns = new THREE.InstancedMesh(crownGeometry(o.light ? 38 : 70, 11), leaves, n)
  // A dark leafy heart inside each crown, so the sky never shows straight through the middle of a tree.
  const heartGeo = new THREE.IcosahedronGeometry(0.56, 1)
  heartGeo.scale(1, 0.78, 1)
  heartGeo.translate(0, 1.82, 0)
  const hearts = new THREE.InstancedMesh(heartGeo, new THREE.MeshLambertMaterial({ color: 0x2c4a22 }), n)
  trunks.castShadow = true
  trunks.receiveShadow = true
  crowns.castShadow = true
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  const place = (i: number, sway: number, lean: number) => {
    const [x, z, base] = spots[i]!
    const scale = base * 1.9
    dummy.position.set(x, 0, z)
    dummy.rotation.set(lean * 0.35, i * 2.4, sway)
    dummy.scale.set(scale, scale * (0.94 + (i % 5) * 0.03), scale)
    dummy.updateMatrix()
    crowns.setMatrixAt(i, dummy.matrix)
  }
  for (let i = 0; i < n; i++) {
    const [x, z, base] = spots[i]!
    const scale = base * 1.9
    dummy.position.set(x, 0, z)
    dummy.rotation.set(0, i * 2.4, 0)
    dummy.scale.set(scale, scale * (0.94 + (i % 5) * 0.03), scale)
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)
    hearts.setMatrixAt(i, dummy.matrix)
    place(i, 0, 0)
    // Each tree its own green: a little warmer, cooler, lighter or deeper.
    tint.setHSL(0.27 + ((i * 37) % 9 - 4) * 0.006, 0.16 + ((i * 13) % 5) * 0.03, 0.82 + ((i * 7) % 6) * 0.03)
    crowns.setColorAt(i, tint)
  }
  for (const m of [trunks, crowns, hearts]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere() }
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true
  scene.add(trunks, hearts, crowns)
  return {
    /** A light wind: each crown rocks a degree or two about its foot, out of step with its neighbours. */
    sway(time: number) {
      for (let i = 0; i < n; i++) place(i, Math.sin(time * 1.1 + i * 0.7) * 0.014, Math.cos(time * 0.9 + i * 1.1) * 0.012)
      crowns.instanceMatrix.needsUpdate = true
    },
  }
}
