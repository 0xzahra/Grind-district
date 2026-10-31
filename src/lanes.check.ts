// Asserts that no car lane point (straight lanes, U-turns, spawn range) lies inside any building + margin,
// and that every lane stays on the painted road.
import { ARMS, LANE_OUTER, ROAD_END, ROAD_HALF, insideFootprint, lanePoint, uturnPoint } from './lanes.ts'

const MARGIN = 2.5 // car half-length plus clearance
let failed = 0
for (let arm = 0; arm < ARMS.length; arm += 1) {
  for (let i = 0; i <= 200; i += 1) {
    const t = i / 200
    for (const outbound of [true, false]) {
      const p = lanePoint(arm, t, outbound)
      const hit = insideFootprint(p.x, p.z, MARGIN)
      if (hit) { failed += 1; console.error(`lane arm ${arm} t=${t.toFixed(3)} ${outbound ? 'out' : 'in'} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is inside ${hit.label}`) }
    }
    const u = uturnPoint(arm, t)
    const hit = insideFootprint(u.x, u.z, MARGIN)
    if (hit) { failed += 1; console.error(`u-turn arm ${arm} u=${t.toFixed(3)} is inside ${hit.label}`) }
    const along = Math.abs(u.x) + Math.abs(u.z)
    if (along > ROAD_END - 0.5) { failed += 1; console.error(`u-turn arm ${arm} leaves the painted road`) }
  }
}
// The painted asphalt itself must not run under any building.
for (let arm = 0; arm < ARMS.length; arm += 1) {
  const a = ARMS[arm]!
  for (let f = 0; f <= ROAD_END; f += 0.5) for (const s of [-ROAD_HALF, 0, ROAD_HALF]) {
    const hit = insideFootprint(a.ax * f - a.az * s, a.az * f + a.ax * s, 0.5)
    if (hit) { failed += 1; console.error(`road arm ${arm} at ${f} runs under ${hit.label}`); break }
  }
}
if (LANE_OUTER + ROAD_HALF / 2 > ROAD_END) failed += 1
if (failed) {
  console.error(`${failed} lane check(s) failed`)
  ;(globalThis as unknown as { process: { exit(n: number): void } }).process.exit(1)
}
console.log('lanes ok: no lane point inside any building footprint')
// Ring swing between arms (traffic.ts): from the inbound end of one arm round the plaza to the next arm's outbound start,
// radius r(s) = lane radius - 2.5 sin(pi s). Cars stay visible and must clear every building.
{
  let bad = 0
  for (let arm = 0; arm < 4; arm += 1) for (const k of [1, 2]) {
    const from = lanePoint(arm, 0, false)
    const to = lanePoint((arm + k) % 4, 0, true)
    const a0 = Math.atan2(from.z, from.x)
    let a1 = Math.atan2(to.z, to.x)
    while (a1 - a0 > Math.PI) a1 -= Math.PI * 2
    while (a1 - a0 < -Math.PI) a1 += Math.PI * 2
    const R = Math.hypot(to.x, to.z)
    for (let s = 0; s <= 1; s += 0.01) {
      const a = a0 + (a1 - a0) * s
      const r = R - 2.5 * Math.sin(Math.PI * s)
      const hit = insideFootprint(Math.cos(a) * r, Math.sin(a) * r, 1.0)
      if (hit) { bad += 1; console.error(`ring swing arm ${arm}->${(arm + k) % 4} s=${s.toFixed(2)} touches ${hit.label}`) }
    }
  }
  if (bad) (globalThis as unknown as { process: { exit(n: number): void } }).process.exit(1)
  console.log('ring swing ok: cars stay visible and clear of buildings between arms')
}
