import type * as THREE from 'three'
import { facetMap, plankMap, slabMap } from './facets.ts'

// Surface finishes by name. These used to be photo-scanned PBR sets; the art direction is flat, faceted
// low-poly, so each name now maps to a clean painted finish (facets, boards or slabs) multiplied by the
// material colour. No normal or roughness maps: surfaces stay matte and planar.
const FINISH: Record<string, (repeat: number, anisotropy: number) => THREE.Texture> = {
  wood_floor: (r, a) => plankMap(5, 6, r, a),
  brown_planks_03: (r, a) => plankMap(9, 5, r, a),
  wood_table_001: (r, a) => plankMap(13, 4, r, a),
  concrete_pavers: (r, a) => slabMap(3, 3, r, a),
  leafy_grass: (r, a) => facetMap(21, 5, 0.2, r, a),
  fabric_pattern_07: (r, a) => facetMap(17, 4, 0.07, r, a),
  metal_plate: (r, a) => facetMap(29, 3, 0.1, r, a),
}
export function pbrSet(name: string, repeat = 2, anisotropy = 8): { map: THREE.Texture } {
  return { map: (FINISH[name] ?? ((r, a) => facetMap(7, 3, 0.1, r, a)))(repeat, anisotropy) }
}
