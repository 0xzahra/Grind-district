import * as THREE from 'three'
import { foliageMaterial, shrubGeometry } from './trees.ts'
import type { Graphics } from './logic.ts'
import type { Obstacle } from './physics.ts'

/**
 * Street dressing, all instanced: stone planters with shrubs beside lamps, extra benches (medium/high),
 * and soft contact-shadow blobs under trees, planters and benches (one draw call, a baked radial texture).
 * Five draw calls total regardless of count. Original geometry, no third-party assets.
 */
type Segment = { x1: number; z1: number; x2: number; z2: number }

/** Shortest distance from (x, z) to the segment (x1,z1)-(x2,z2). */
function distToSegment(x: number, z: number, s: Segment): number {
  const dx = s.x2 - s.x1
  const dz = s.z2 - s.z1
  const lenSq = dx * dx + dz * dz
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x - s.x1) * dx + (z - s.z1) * dz) / lenSq)) : 0
  return Math.hypot(x - (s.x1 + dx * t), z - (s.z1 + dz * t))
}

export function createStreetProps(scene: THREE.Scene, opts: { lamps: { x: number; z: number }[]; trees: { x: number; z: number }[]; obstacles: Obstacle[]; graphics: Graphics; walkLines?: Segment[] }): { dispose: () => void } {
  const { lamps, trees, obstacles, graphics, walkLines = [] } = opts
  // Keep clear of resident walking lines too (0.5 m: a strolling body plus a step of margin),
  // not just other obstacles, so instanced benches/planters never end up straddling a route a citizen walks every lap.
  const free = (x: number, z: number, r: number) => Math.hypot(x, z) > 7.5
    && obstacles.every((o) => o.kind === 'circle' ? Math.hypot(x - o.x, z - o.z) > o.r + r : Math.abs(x - o.x) > o.hx + r || Math.abs(z - o.z) > o.hz + r)
    && walkLines.every((s) => distToSegment(x, z, s) > r + 0.5)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3()
  const planters: Array<{ x: number; z: number }> = []
  const benches: Array<{ x: number; z: number; ry: number }> = []
  for (const l of lamps) {
    // Step along the kerb (perpendicular to the plaza direction) to find a clear spot.
    const len = Math.hypot(l.x, l.z) || 1
    const tx = -l.z / len, tz = l.x / len
    const px = l.x + tx * 1.4, pz = l.z + tz * 1.4
    if (free(px, pz, 0.6)) planters.push({ x: px, z: pz })
    if (graphics !== 'low') {
      const bx = l.x - tx * 1.7, bz = l.z - tz * 1.7
      if (free(bx, bz, 0.8)) benches.push({ x: bx, z: bz, ry: Math.atan2(-l.x, -l.z) })
    }
  }
  const stone = new THREE.MeshStandardMaterial({ color: 0xb7b0a3, roughness: 0.85 })
  const leaf = foliageMaterial() // shared with the trees: real leaves, not a faceted blob
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.7 })
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.5, metalness: 0.6 })
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = [stone, wood, iron]
  const inst = (g: THREE.BufferGeometry, m: THREE.Material, n: number, set: (i: number) => void, shadow = true) => {
    geos.push(g)
    const im = new THREE.InstancedMesh(g, m, Math.max(1, n))
    im.count = n
    for (let i = 0; i < n; i++) { set(i); im.setMatrixAt(i, m4) }
    im.instanceMatrix.needsUpdate = true
    im.castShadow = shadow && graphics === 'high'
    im.receiveShadow = graphics !== 'low'
    im.computeBoundingSphere()
    scene.add(im)
    return im
  }
  const at = (x: number, y: number, z: number, ry = 0, s = 1) => m4.compose(v.set(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), sc.set(s, s, s))
  const meshes: THREE.InstancedMesh[] = []
  meshes.push(inst(new THREE.BoxGeometry(0.9, 0.5, 0.9).translate(0, 0.25, 0), stone, planters.length, (i) => at(planters[i]!.x, 0, planters[i]!.z)))
  meshes.push(inst(shrubGeometry(5).scale(0.5, 0.42, 0.5), leaf, planters.length, (i) => at(planters[i]!.x, 0.72, planters[i]!.z, i, 0.9 + (i % 3) * 0.08)))
  if (benches.length) {
    meshes.push(inst(new THREE.BoxGeometry(1.4, 0.08, 0.46).translate(0, 0.46, 0), wood, benches.length, (i) => at(benches[i]!.x, 0, benches[i]!.z, benches[i]!.ry)))
    meshes.push(inst(new THREE.BoxGeometry(1.4, 0.36, 0.06).translate(0, 0.74, -0.21), wood, benches.length, (i) => at(benches[i]!.x, 0, benches[i]!.z, benches[i]!.ry)))
    meshes.push(inst(new THREE.BoxGeometry(1.2, 0.42, 0.3).translate(0, 0.21, 0), iron, benches.length, (i) => at(benches[i]!.x, 0, benches[i]!.z, benches[i]!.ry)))
  }
  for (const p of planters) obstacles.push({ kind: 'circle', x: p.x, z: p.z, r: 0.6 })
  for (const b of benches) obstacles.push({ kind: 'circle', x: b.x, z: b.z, r: 0.75 })
  // Baked contact shadows: one soft radial blob texture, darkens the ground under props (cheap AO).
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(0.6, 'rgba(0,0,0,0.2)'); grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64)
  const blobTex = new THREE.CanvasTexture(c)
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  mats.push(blobMat)
  const blobs = [...trees.map((t) => ({ ...t, s: 2.6 })), ...planters.map((p) => ({ ...p, s: 1.5 })), ...benches.map((b) => ({ ...b, s: 1.8 }))]
  const blobMesh = inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat, blobs.length, (i) => at(blobs[i]!.x, 0.025, blobs[i]!.z, 0, blobs[i]!.s), false)
  blobMesh.receiveShadow = false
  blobMesh.renderOrder = 1
  meshes.push(blobMesh)
  return { dispose: () => { for (const m of meshes) scene.remove(m); geos.forEach((x) => x.dispose()); mats.forEach((x) => x.dispose()); blobTex.dispose() } }
}
