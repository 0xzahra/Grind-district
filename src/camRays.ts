// Fast rays for the camera (the wall check that pulls the camera in front of buildings, the look point, the
// open-side probes and the indoor cut-away). They used to test every object in the scene, triangle by triangle,
// several times a frame: about two thirds of all game logic time. Now they test a list of solid static meshes
// only (no people, foliage, effects or the player), each with a bounding-volume hierarchy (three-mesh-bvh), so a
// ray costs microseconds. The list refreshes every two seconds as places load; hierarchies are built a few at a
// time in idle moments, and a mesh without one yet is tested the old way meanwhile.
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'

type BVHGeometry = THREE.BufferGeometry & { boundsTree?: unknown; computeBoundsTree: typeof computeBoundsTree; disposeBoundsTree: typeof disposeBoundsTree }
;(THREE.BufferGeometry.prototype as BVHGeometry).computeBoundsTree = computeBoundsTree
;(THREE.BufferGeometry.prototype as BVHGeometry).disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

const MIN_TRIS = 48
export function createCamRays(scene: THREE.Scene, skip: (o: THREE.Object3D) => 'tree' | 'self' | false) {
  let list: THREE.Object3D[] = []
  let builtAt = -1e9
  const queue: BVHGeometry[] = [], queued = new WeakSet<THREE.BufferGeometry>()
  const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3
  // Small props (benches, bollards, lamps, cups) never need to stop the camera, and an instanced set of them made
  // every ray loop over hundreds of copies: only things about a metre across or bigger are walls.
  // Decided once per mesh (the world matrix the renderer already keeps), so the two-second refresh stays cheap.
  const bigness = new WeakMap<THREE.Object3D, boolean>()
  const big = (m: THREE.Mesh): boolean => {
    let v = bigness.get(m)
    if (v === undefined) {
      const g = m.geometry
      if (!g.boundingSphere) g.computeBoundingSphere()
      v = (g.boundingSphere?.radius ?? 0) * m.matrixWorld.getMaxScaleOnAxis() >= 0.9
      bigness.set(m, v)
    }
    return v
  }
  const rebuild = () => {
    const next: THREE.Object3D[] = []
    const walk = (o: THREE.Object3D) => {
      // skip: 'tree' leaves out the whole subtree (the player, things the camera passes through), 'self' only this one.
      const k = skip(o)
      if (k === 'tree') return
      const m = o as THREE.Mesh
      if (!k && m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry && big(m)) {
        next.push(m)
        const g = m.geometry as BVHGeometry
        if (!g.boundsTree && !queued.has(g) && tris(g) >= MIN_TRIS && g.getAttribute('position')) { queued.add(g); queue.push(g) }
      }
      for (const c of o.children) walk(c)
    }
    for (const c of scene.children) walk(c)
    list = next
  }
  // Build hierarchies when the browser is idle, never more than ~6 ms at a time.
  const pump = (deadline?: IdleDeadline) => {
    // A busy game is rarely idle: when the callback fires on its timeout, still spend up to 4 ms.
    const t0 = performance.now(), budget = deadline && !deadline.didTimeout ? Math.max(4, deadline.timeRemaining() - 1) : 4
    while (queue.length && performance.now() - t0 < budget) {
      const g = queue.shift()!
      try { if (!g.boundsTree) g.computeBoundsTree() } catch (e) { if (import.meta.env.DEV) console.warn('[camRays] no BVH', e) }
    }
    schedule()
  }
  const schedule = () => {
    if (!queue.length) { window.setTimeout(schedule, 1000); return }
    const idle = (window as unknown as { requestIdleCallback?: (f: (d: IdleDeadline) => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (idle) idle.call(window, pump, { timeout: 250 })
    else window.setTimeout(() => pump(), 50)
  }
  schedule()
  /** Nearest-first hits along the ray, on solid things whose parents are shown (a hidden wall itself still counts). */
  const hits = (ray: THREE.Raycaster): THREE.Intersection[] => {
    const now = performance.now()
    if (now - builtAt > 2000) { builtAt = now; rebuild() }
    const first = (ray as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly
    ;(ray as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true
    const out = ray.intersectObjects(list, false)
    ;(ray as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = first
    return out.filter((h) => { for (let p = h.object.parent; p; p = p.parent) if (!p.visible) return false; return true })
  }
  return { hits, refresh: () => { builtAt = -1e9 }, size: () => list.length, pending: () => queue.length }
}
