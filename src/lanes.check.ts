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
// Roundabout transfers (traffic.ts): every ring route stays on the ring asphalt and clear of every building.
{
  const { ringRoute, RING_IN, RING_OUT } = await import('./lanes.ts')
  let bad = 0
  for (let from = 0; from < 4; from += 1) for (let to = 0; to < 4; to += 1) {
    if (from === to) continue
    for (const p of ringRoute(from, to)) {
      const hit = insideFootprint(p.x, p.z, 1.0)
      if (hit) { bad += 1; console.error(`ring ${from}->${to} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) touches ${hit.label}`) }
      const r = Math.hypot(p.x, p.z)
      const onArm = Math.abs(p.x) < ROAD_HALF + 2 || Math.abs(p.z) < ROAD_HALF + 2 // flared entry mouths
      if (r < RING_IN + 0.9 || (r > RING_OUT - 0.9 && !onArm)) { bad += 1; console.error(`ring ${from}->${to} leaves the ring asphalt at r=${r.toFixed(2)}`) }
    }
  }
  if (bad) (globalThis as unknown as { process: { exit(n: number): void } }).process.exit(1)
  console.log('ring ok: roundabout routes stay on the asphalt and clear of buildings')
}

// Side road (houses + city edge): both lanes stay clear of every footprint and join the east arm seamlessly.
{
  const { sidePoint, SIDE_LEN, SIDE_JOIN_T, lanePoint: lp, insideFootprint: inside } = await import('./lanes.ts')
  for (let s = 0; s <= SIDE_LEN; s += 0.25) for (const o of [true, false]) {
    const p = sidePoint(s, o)
    const hit = inside(p.x, p.z, 1.1)
    if (hit) throw new Error(`side road lane at s=${s.toFixed(1)} enters ${hit.label}`)
  }
  for (const o of [true, false]) {
    const a = sidePoint(0, o), b = lp(0, SIDE_JOIN_T, o)
    if (Math.hypot(a.x - b.x, a.z - b.z) > 0.01) throw new Error('side road does not join the east arm lane')
  }
  console.log('side road ok: lanes clear of buildings, joins the east arm without a jump')
}
