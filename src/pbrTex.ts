import * as THREE from 'three'
import { facetMap } from './facets.ts'

// Surface finishes by name. Lawns and hedges, kerb pavers and timber use real photographs (Poly Haven, CC0)
// with their own average colour divided out by tools/pack-nature.mjs, so each material keeps the colour it
// was given and gains the real surface. Cloth and metal keep a soft painted tone.
const PHOTO: Record<string, string> = {
  leafy_grass: 'grass_t.webp',
  concrete_pavers: 'pavers_t.webp',
  wood_floor: 'wood_t.webp',
  brown_planks_03: 'wood_t.webp',
  wood_table_001: 'wood_t.webp',
}
const PAINTED: Record<string, (repeat: number, anisotropy: number) => THREE.Texture> = {
  fabric_pattern_07: (r, a) => facetMap(17, 4, 0.07, r, a),
  metal_plate: (r, a) => facetMap(29, 3, 0.1, r, a),
}
const loader = new THREE.TextureLoader()
const photos = new Map<string, { base: THREE.Texture; copies: THREE.Texture[] }>()

function photo(file: string, repeat: number, anisotropy: number): THREE.Texture {
  let entry = photos.get(file)
  if (!entry) {
    const e = { base: null as unknown as THREE.Texture, copies: [] as THREE.Texture[] }
    // Copies share the one upload; each is told when the picture arrives.
    e.base = loader.load(`/tex/nature/${file}`, () => { for (const c of e.copies) c.needsUpdate = true })
    e.base.colorSpace = THREE.SRGBColorSpace
    photos.set(file, e)
    entry = e
  }
  const t = entry.base.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = anisotropy
  entry.copies.push(t)
  if (entry.base.image) t.needsUpdate = true
  return t
}

export function pbrSet(name: string, repeat = 2, anisotropy = 8): { map: THREE.Texture } {
  const file = PHOTO[name]
  // No images outside a browser (the Node look check): the painted fallback keeps materials valid there.
  if (file && typeof document !== 'undefined') return { map: photo(file, repeat, anisotropy) }
  return { map: (PAINTED[name] ?? ((r, a) => facetMap(7, 3, 0.1, r, a)))(repeat, anisotropy) }
}
