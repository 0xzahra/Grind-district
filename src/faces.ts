// Collection faces: OFF unless VITE_NFT_FACES=1. Only collections listed in /collections.json
// (added after written permission from the rights holder) are offered. Until then, original placeholder faces only.
export type FaceOption = { id: string; label: string; licensed: boolean }

export const PLACEHOLDER_FACES: FaceOption[] = [
  { id: 'facet-a', label: 'Facet A (original)', licensed: false },
  { id: 'facet-b', label: 'Facet B (original)', licensed: false },
  { id: 'facet-c', label: 'Facet C (original)', licensed: false },
]

export async function availableFaces(): Promise<FaceOption[]> {
  if (import.meta.env.VITE_NFT_FACES !== '1') return PLACEHOLDER_FACES
  try {
    const list = (await (await fetch('/collections.json')).json()) as Array<{ id: string; name: string; permission?: string }>
    const allowed = list.filter((c) => c.permission).map((c) => ({ id: c.id, label: c.name, licensed: true }))
    return [...PLACEHOLDER_FACES, ...allowed]
  } catch {
    return PLACEHOLDER_FACES
  }
}
