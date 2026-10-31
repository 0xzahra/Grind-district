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
