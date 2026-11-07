import type * as THREE from 'three'
export type TapHit = { kind: 'ground' | 'door' | 'npc' | 'blocker' | 'ignore'; x: number; z: number; id?: string }
export type TapChoice = { kind: 'ground' | 'door' | 'npc'; x: number; z: number; id?: string }
// Hits arrive nearest-first. A wall/roof/prop occludes all targets behind it.
export function chooseTap(hits: TapHit[], limit: number, blocked: (x: number, z: number) => boolean): TapChoice | null {
  for (const hit of hits) {
    if (hit.kind === 'ignore') continue
    if (!Number.isFinite(hit.x) || !Number.isFinite(hit.z) || Math.abs(hit.x) > limit || Math.abs(hit.z) > limit) return null
    if (hit.kind === 'blocker') return null
    if (hit.kind === 'npc') return { ...hit, kind: hit.kind }
    if (blocked(hit.x, hit.z)) return null
    return { ...hit, kind: hit.kind }
  }
  return null
}

export function tapIntersections(ray: THREE.Raycaster, camera: THREE.PerspectiveCamera, pointer: THREE.Vector2, scene: THREE.Scene): THREE.Intersection[] {
  ray.setFromCamera(pointer, camera)
  ray.near = 0
  ray.far = camera.far
  return ray.intersectObjects(scene.children, true)
}
