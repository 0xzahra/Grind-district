// Clothes on the boutique rails: real garment shapes on wooden hangers, not flat slabs.
// Each piece is cut as a front silhouette (shoulders, sleeves, collar or straps, waist, hem), given soft rounded
// edges, then draped: the front bows out a little, folds run down from the hanger and deepen towards the hem.
// One geometry per cut, instanced along the rails with a colour each (a handful of draw calls for the room).
import * as THREE from 'three'

type Cut = 'blazer' | 'shirt' | 'dress' | 'abaya' | 'trousers'
const P = (pts: Array<[number, number]>) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))

// Front silhouettes in metres, y = 0 at the hanger bar, hanging down (negative y).
const SHAPES: Record<Cut, () => THREE.Shape> = {
  blazer: () => P([[-0.05, 0], [-0.21, -0.04], [-0.25, -0.1], [-0.27, -0.44], [-0.23, -0.6], [-0.2, -0.6], [-0.19, -0.3], [-0.17, -0.42], [-0.2, -0.76], [0.2, -0.76], [0.17, -0.42], [0.19, -0.3], [0.2, -0.6], [0.23, -0.6], [0.27, -0.44], [0.25, -0.1], [0.21, -0.04], [0.05, 0], [0, -0.16]]),
  shirt: () => P([[-0.06, 0], [-0.2, -0.04], [-0.24, -0.1], [-0.25, -0.4], [-0.21, -0.52], [-0.18, -0.52], [-0.17, -0.26], [-0.17, -0.7], [0, -0.73], [0.17, -0.7], [0.17, -0.26], [0.18, -0.52], [0.21, -0.52], [0.25, -0.4], [0.24, -0.1], [0.2, -0.04], [0.06, 0], [0, -0.05]]),
  dress: () => P([[-0.09, 0], [-0.13, -0.03], [-0.15, -0.22], [-0.12, -0.38], [-0.17, -0.6], [-0.27, -1.08], [0.27, -1.08], [0.17, -0.6], [0.12, -0.38], [0.15, -0.22], [0.13, -0.03], [0.09, 0], [0, -0.12]]),
  abaya: () => P([[-0.07, 0], [-0.22, -0.05], [-0.36, -0.2], [-0.36, -0.52], [-0.24, -0.5], [-0.22, -1.2], [0.22, -1.2], [0.24, -0.5], [0.36, -0.52], [0.36, -0.2], [0.22, -0.05], [0.07, 0], [0, -0.1]]),
  // Trousers folded over the hanger's bar: a short double panel.
  trousers: () => P([[-0.17, 0.01], [0.17, 0.01], [0.16, -0.5], [0.03, -0.5], [0, -0.3], [-0.03, -0.5], [-0.16, -0.5]]),
}

function drape(g: THREE.BufferGeometry, seed: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  g.computeBoundingBox()
  const box = g.boundingBox!, hw = Math.max(0.05, (box.max.x - box.min.x) / 2), len = Math.max(0.1, box.max.y - box.min.y)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const down = THREE.MathUtils.clamp(-y / len, 0, 1) // 0 at the hanger, 1 at the hem
    const across = x / hw
    // The front bows out over the chest and falls back at the sides; folds grow towards the hem.
    const bow = (1 - across * across) * 0.035 * Math.sin(Math.PI * Math.min(1, down * 1.6))
    const fold = Math.sin(x * 38 + seed) * 0.009 * down + Math.sin(x * 17 + seed * 2.1) * 0.006 * down
    const flare = 1 + down * 0.04 * Math.sin(seed)
    p.setXYZ(i, x * flare, y, z + (z > 0 ? bow + fold : fold * 0.6))
  }
  g.computeVertexNormals()
  return g
}

export type GarmentKit = { cuts: Record<Cut, THREE.BufferGeometry>; hanger: THREE.BufferGeometry; cloth: THREE.MeshStandardMaterial; wood: THREE.MeshStandardMaterial }
/** Garment geometries (facing +x, i.e. across the rail) and the shared fabric and hanger materials. */
export function garmentKit(fabricNormal?: THREE.Texture | null): GarmentKit {
  const cuts = {} as Record<Cut, THREE.BufferGeometry>
  let seed = 1
  for (const k of Object.keys(SHAPES) as Cut[]) {
    const depth = k === 'trousers' ? 0.05 : 0.07
    const g = new THREE.ExtrudeGeometry(SHAPES[k](), { depth, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 3, curveSegments: 4, steps: 1 })
    g.translate(0, 0, -depth / 2)
    // More vertices to drape: subdivide by re-tessellating is costly; the bevel rings give enough to bend.
    cuts[k] = drape(g, seed++ * 1.7).rotateY(Math.PI / 2)
  }
  // Wooden hanger: a brass hook and a bowed bar with shoulder ends.
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.01, -0.23), new THREE.Vector3(0, 0.03, -0.12), new THREE.Vector3(0, 0.065, 0), new THREE.Vector3(0, 0.03, 0.12), new THREE.Vector3(0, -0.01, 0.23)])
  const bar = new THREE.TubeGeometry(curve, 16, 0.011, 6, false)
  const hook = new THREE.TorusGeometry(0.028, 0.004, 5, 12, Math.PI * 1.35).rotateY(Math.PI / 2).translate(0, 0.11, 0.008)
  const stem = new THREE.CylinderGeometry(0.0035, 0.0035, 0.04, 5).translate(0, 0.085, 0)
  const hanger = mergeGeos([bar, hook, stem])
  const cloth = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, normalMap: fabricNormal ?? null, normalScale: new THREE.Vector2(0.5, 0.5) })
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.55, metalness: 0.05 })
  return { cuts, hanger, cloth, wood }
}

function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g))
  let n = 0
  for (const g of parts) n += g.getAttribute('position').count
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3)
  let o = 0
  for (const g of parts) {
    pos.set(g.getAttribute('position').array as Float32Array, o * 3)
    const nn = g.getAttribute('normal'); if (nn) nor.set(nn.array as Float32Array, o * 3)
    o += g.getAttribute('position').count
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  return out
}
