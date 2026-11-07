// Run: node --experimental-strip-types src/look.check.ts
// Checks the warm-look palette, the per-tier light budget and the furniture detail pass in Node.
// Nothing here renders: visuals still need a look on the preview (see LOOK_PASS.md).
import * as THREE from 'three'
import { BASE_LOOK, LIGHT_BUDGET, WARM_LOOK, lightBudget, pickLook, type LookPalette } from './lookPalette.ts'
import { buildHomeFurniture } from './homeFurniture.ts'
import { FURNITURE_BASELINE } from './look.fixture.ts'

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`FAIL: ${message}`)
}
const rgb = (hex: number) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255] as const
const luma = (hex: number) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b }

// --- Palette ---
const shipped: LookPalette = { bounceDay: 0x3d4f3a, bounceNight: 0x07090c, lookBounceDay: 0x3d4f3a, lookBounceNight: 0x1c2e26, furnitureMetal: 0x3a3c3f }
check(JSON.stringify(BASE_LOOK) === JSON.stringify(shipped), 'BASE_LOOK is exactly the 072e64b colours')
for (const key of Object.keys(shipped) as (keyof LookPalette)[]) {
  const [r, g, b] = rgb(WARM_LOOK[key])
  check(r >= g && g >= b, `${key} is warm (r >= g >= b)`)
  const ratio = luma(WARM_LOOK[key]) / luma(BASE_LOOK[key])
  check(ratio > 0.85 && ratio < 1.15, `${key} keeps brightness within 15% (got ${ratio.toFixed(2)})`)
}
check(pickLook('?look=base') === BASE_LOOK && pickLook('?x=1&look=base') === BASE_LOOK, '?look=base restores the shipped colours')
check(pickLook('') === WARM_LOOK && pickLook('?look=warm') === WARM_LOOK && pickLook('%%%') === WARM_LOOK, 'warm is the default')
console.log('ok - palette')

// --- Light budget ---
const GLOW_LIGHTS = 10 // addGlow() lights in world.ts (7 calls, one of them a loop of 4)
const POOL_LIGHTS = 6 // follow-the-player pool in world.ts
const INTERIOR_LIGHTS = 1 // shared interior lamp (interiors.ts)
const points = (g: 'low' | 'medium' | 'high') => lightBudget(g).pool + (lightBudget(g).glow ? GLOW_LIGHTS : 0) + INTERIOR_LIGHTS
check(points('low') === 4 && points('medium') === 5, 'low/medium evaluate 4/5 point lights per fragment')
check(points('high') === POOL_LIGHTS + GLOW_LIGHTS + INTERIOR_LIGHTS, 'high keeps every 072e64b light (17)')
check(LIGHT_BUDGET.low.pool <= LIGHT_BUDGET.medium.pool && LIGHT_BUDGET.medium.pool <= LIGHT_BUDGET.high.pool, 'budget never shrinks as tiers rise')
check(LIGHT_BUDGET.high.pool <= POOL_LIGHTS, 'budget never asks for more pool lights than world.ts creates')
check(lightBudget('unknown' as never) === LIGHT_BUDGET.high, 'unknown tier falls back to the full 072e64b set')
console.log('ok - light budget')

// --- Furniture: detail pass keeps gameplay geometry and draw calls exactly ---
// TextureLoader needs an <img>; these never load in Node, which is fine for geometry checks.
const g = globalThis as { document?: unknown }
g.document ??= { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) }
const TRI_GROWTH = 1.08 // at most +8% triangles per tier
const TRI_CAP = 9000 // absolute ceiling for the richest home
for (const base of FURNITURE_BASELINE) {
  const pieces: number[][] = []
  const f = buildHomeFurniture(base.tier, 400, 0, (b) => pieces.push([...b.min.toArray(), ...b.max.toArray()].map((n) => +n.toFixed(3))))
  let tris = 0
  const box = new THREE.Box3()
  f.group.traverse((o) => { if (o instanceof THREE.Mesh) { tris += o.geometry.attributes.position!.count / 3; box.expandByObject(o) } })
  const t = `tier ${base.tier}`
  check(f.group.children.length === base.meshes, `${t}: draw calls unchanged (${base.meshes})`)
  check(JSON.stringify(f.obstacles) === JSON.stringify(base.obstacles), `${t}: colliders unchanged`)
  check(JSON.stringify(f.seats) === JSON.stringify(base.seats), `${t}: seats unchanged`)
  check(JSON.stringify(f.screens) === JSON.stringify(base.screens), `${t}: TV screens unchanged`)
  const round = (v: THREE.Vector3) => v.toArray().map((n) => +n.toFixed(4))
  check(JSON.stringify([round(box.min), round(box.max)]) === JSON.stringify(base.box), `${t}: outer bounds unchanged (detail stays inside footprints)`)
  check(pieces.length === base.pieces.length, `${t}: same number of pieces`)
  pieces.forEach((p, i) => check(JSON.stringify(p) === JSON.stringify(base.pieces[i]), `${t}: piece ${i} bounds unchanged (detail stays inside the piece)`))
  check(tris >= base.tris && tris <= base.tris * TRI_GROWTH && tris <= TRI_CAP, `${t}: ${tris} triangles within budget (base ${base.tris})`)
  let metal: THREE.MeshStandardMaterial | undefined
  f.group.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.metalness === 0.6) metal = o.material })
  if (metal) check(metal.color.getHex() === WARM_LOOK.furnitureMetal, `${t}: furniture metal uses the palette`)
  f.dispose()
}
console.log('ok - furniture detail keeps colliders, seats, screens, per-piece bounds, draw calls; triangles in budget')
console.log('look checks passed')
