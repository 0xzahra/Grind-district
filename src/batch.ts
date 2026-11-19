// Fewer draw calls, same picture. Two tools:
// - compactGroups: a mesh with a material per face (a signboard box is [frame, frame, frame, frame, sign, frame])
//   draws once per face. Faces that share a material are gathered into one group, so that sign draws twice, not
//   six times. Run over the whole scene once it is built, and again as places load (sweepScene).
// - mergeStatic: a prop built from many small parts (a booth, a stand) becomes one mesh per material.
// Neither touches anything animated: skinned people, instanced sets, sprites and anything marked dynamic stay as they are.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const done = new WeakSet<THREE.Object3D>()

/** Gather a multi-material mesh's faces by material. Returns how many draw calls it saved. */
export function compactGroups(mesh: THREE.Mesh): number {
  if (done.has(mesh)) return 0
  done.add(mesh)
  const mats = mesh.material
  const g = mesh.geometry
  if (!Array.isArray(mats) || !g || g.groups.length < 2) return 0
  const unique: THREE.Material[] = []
  const slotOf = (m: THREE.Material) => { let i = unique.indexOf(m); if (i < 0) { unique.push(m); i = unique.length - 1 } return i }
  const per = g.groups.map((gr) => ({ gr, slot: slotOf(mats[gr.materialIndex ?? 0] ?? mats[0]!) }))
  if (unique.length >= g.groups.length) return 0
  const geo = g.clone()
  const src = geo.index ? Array.from(geo.index.array) : null
  const order: number[] = []
  const groups: Array<{ start: number; count: number; materialIndex: number }> = []
  for (let s = 0; s < unique.length; s++) {
    const start = order.length
    for (const p of per) if (p.slot === s) for (let i = p.gr.start; i < p.gr.start + p.gr.count; i++) order.push(src ? src[i]! : i)
    groups.push({ start, count: order.length - start, materialIndex: s })
  }
  geo.setIndex(order)
  geo.clearGroups()
  const saved = g.groups.length - unique.length
  if (unique.length === 1) mesh.material = unique[0]!
  else { for (const gr of groups) geo.addGroup(gr.start, gr.count, gr.materialIndex); mesh.material = unique }
  mesh.geometry = geo
  return saved
}

/** Compact every multi-material mesh in the scene (cheap to repeat: each mesh is handled once). */
export function sweepScene(root: THREE.Object3D): number {
  let saved = 0
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && Array.isArray(m.material) && !(m as THREE.SkinnedMesh).isSkinnedMesh) saved += compactGroups(m) })
  return saved
}

/** Merge the static meshes under `root` into one mesh per material (kept under `root`, same look and shadows). */
/** A material's look, so separately made but identical materials can share one draw (only where none of them is
 * changed later; pass byLook only then). */
const look = (m: THREE.Material): string => {
  const a = m as THREE.MeshPhysicalMaterial
  return [m.type, a.color?.getHexString(), a.roughness, a.metalness, a.emissive?.getHexString(), a.emissiveIntensity, a.map?.uuid, a.emissiveMap?.uuid, a.clearcoat, a.transparent, a.opacity, m.side, a.vertexColors, a.toneMapped, a.depthWrite].join('|')
}
export function mergeStatic(root: THREE.Object3D, opts: { skip?: (o: THREE.Object3D) => boolean; byLook?: boolean } = {}): number {
  const skip = opts.skip ?? (() => false)
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map<string, { mat: THREE.Material; meshes: THREE.Mesh[] }>()
  const walk = (o: THREE.Object3D) => {
    if (o !== root && (skip(o) || o.userData.dynamic)) return
    const m = o as THREE.Mesh
    if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material) && m.geometry && !m.morphTargetInfluences) {
      const mat = m.material as THREE.Material & { map?: THREE.Texture | null }
      const uv = !!mat.map
      if (!uv || m.geometry.getAttribute('uv')) {
        const k = `${opts.byLook ? look(mat) : mat.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${m.renderOrder}|${uv ? 'uv' : ''}${m.geometry.getAttribute('color') ? 'c' : ''}`
        const b = buckets.get(k) ?? { mat, meshes: [] }
        b.meshes.push(m); buckets.set(k, b)
      }
    }
    for (const c of [...o.children]) walk(c)
  }
  walk(root)
  let saved = 0
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue
    const keepUv = !!(b.mat as { map?: unknown }).map, keepColor = !!b.meshes[0]!.geometry.getAttribute('color')
    const geos = b.meshes.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
      for (const k of Object.keys(g.attributes)) if (!(k === 'position' || k === 'normal' || (keepUv && k === 'uv') || (keepColor && k === 'color'))) g.deleteAttribute(k)
      if (!g.getAttribute('normal')) g.computeVertexNormals()
      g.clearGroups()
      g = g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
      return g
    })
    const merged = mergeGeometries(geos)
    if (!merged) continue
    const one = new THREE.Mesh(merged, b.mat)
    const first = b.meshes[0]!
    one.castShadow = first.castShadow; one.receiveShadow = first.receiveShadow; one.renderOrder = first.renderOrder
    one.userData = { ...first.userData, batched: true }
    one.name = 'batched'
    for (const m of b.meshes) m.removeFromParent()
    root.add(one)
    saved += b.meshes.length - 1
  }
  return saved
}
