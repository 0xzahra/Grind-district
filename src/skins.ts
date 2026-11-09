// Collection skin slots. Disabled by default behind /skins/permissions.json.
// A slot only renders licensed art when granted:true AND permissionRef is filled AND the face file loads.
// Otherwise the original placeholder mask (masks.ts) is used. No copyrighted art ships in the repo.
import * as THREE from 'three'
import type { MaskId } from './logic.ts'

export type SkinSlot = { collection: string; granted: boolean; permissionRef: string; face: string }
type Slots = Partial<Record<Exclude<MaskId, 'none'>, SkinSlot>>

let slots: Slots = {}
const textures = new Map<string, THREE.Texture>()
const pending = new Set<THREE.Object3D>()
let geometry: THREE.PlaneGeometry | null = null

export function skinSlots(): Slots {
  return slots
}

export function isLicensed(mask: MaskId): boolean {
  if (mask === 'none') return false
  const slot = slots[mask]
  return !!slot && slot.granted && slot.permissionRef.trim().length > 0 && textures.has(mask)
}

/** Fetch the permissions config once at boot; preload only granted faces (one small texture each). */
export async function loadSkinPermissions(): Promise<void> {
  try {
    const res = await fetch('/skins/permissions.json', { cache: 'no-cache' })
    if (!res.ok) return
    const json = (await res.json()) as { slots?: Slots }
    slots = json.slots ?? {}
  } catch {
    return
  }
  const loader = new THREE.TextureLoader()
  await Promise.all(
    Object.entries(slots).map(async ([id, slot]) => {
      if (!slot || !slot.granted || !slot.permissionRef.trim()) return
      try {
        const tex = await loader.loadAsync(slot.face)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        textures.set(id, tex)
      } catch {
        /* missing art: keep placeholder */
      }
    }),
  )
  for (const anchor of pending) anchor.dispatchEvent({ type: 'skins-ready' } as never)
  pending.clear()
}

/** Returns a face decal for a licensed slot, or null to fall back to the original mask. Shared geometry + cached texture: one draw call. */
export function licensedFace(mask: MaskId): THREE.Mesh | null {
  if (!isLicensed(mask)) return null
  const tex = textures.get(mask)!
  geometry ??= new THREE.PlaneGeometry(0.26, 0.26)
  const face = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.6 }),
  )
  face.position.set(0, 0.02, 0.06)
  face.userData.sharedGeometry = true
  return face
}
