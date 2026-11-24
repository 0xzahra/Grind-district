// Auto-drive (src/drive.ts): a route around buildings, and an autopilot that follows it to the door.
import { planRoute, followRoute, nearestRoad, onRoad, type P } from '../src/drive.ts'
import type { Obstacle } from '../src/physics.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

// A wall between start and goal with gaps at both ends, and a round fountain.
const obs: Obstacle[] = [
  { kind: 'box', x: 0, z: 0, hx: 30, hz: 2 },
  { kind: 'circle', x: -20, z: 20, r: 4 },
]
const from: P = { x: 0, z: -20 }, to: P = { x: 0, z: 20 }
const path = planRoute(from, to, obs, 62)
check(!!path && path.length >= 3, `a route exists and bends round the wall (${path?.length} points)`)
const hits = (p: P) => obs.some((o) => o.kind === 'circle' ? Math.hypot(p.x - o.x, p.z - o.z) < o.r + 0.9 : Math.abs(p.x - o.x) < o.hx + 0.9 && Math.abs(p.z - o.z) < o.hz + 0.9)
let clear = true
for (let i = 0; path && i < path.length - 1; i++) for (let k = 0; k <= 20; k++) { const a = path[i]!, b = path[i + 1]!; if (hits({ x: a.x + (b.x - a.x) * k / 20, z: a.z + (b.z - a.z) * k / 20 })) clear = false }
check(clear, 'the route never runs through the wall or the fountain')
check(planRoute(from, to, [{ kind: 'box', x: 0, z: 0, hx: 80, hz: 2 }], 62) === null, 'no route when a wall closes the whole city')

// Drive it with the same car model as ride.ts (bicycle steering, throttle and brakes from the stick).
let x = from.x, z = from.z, heading = 0, vf = 0, steer = 0
const top = 14, acc = 4, wb = 2.6
let done = false, t = 0
for (; t < 90 && !done && path; t += 1 / 60) {
  const r = followRoute(path, { x, z, heading, speed: vf }, top)
  done = r.done
  const dt = 1 / 60
  if (r.y > 0.05) vf = Math.min(top * r.y, vf + acc * dt)
  else if (r.y < -0.05) vf = vf > 0.4 ? Math.max(0, vf - 15 * -r.y * dt) : Math.max(-5 * -r.y, vf - 4 * dt)
  else vf = Math.abs(vf) < 2.2 * dt ? 0 : vf - Math.sign(vf) * 2.2 * dt
  const lock = 0.72 / (1 + Math.abs(vf) / 9)
  steer += (r.x * lock - steer) * (1 - Math.exp(-7 * dt))
  heading -= (vf / wb) * Math.tan(steer) * dt
  x += Math.sin(heading) * vf * dt; z += Math.cos(heading) * vf * dt
  if (hits({ x, z })) { check(false, `drove into an obstacle at ${x.toFixed(1)}, ${z.toFixed(1)}`); break }
}
check(done, `the autopilot stops at the destination (t=${t.toFixed(1)} s)`)
check(Math.hypot(x - to.x, z - to.z) < 3.5, `it stops at the door (${Math.hypot(x - to.x, z - to.z).toFixed(1)} m away)`)
// In the real city: from the plaza to Campus the route keeps to the streets (the ring, then the north arm).
const kerb = nearestRoad({ x: 2, z: 5 })
check(onRoad(kerb.x, kerb.z), `a cab pulls up on a road (${kerb.x.toFixed(1)}, ${kerb.z.toFixed(1)})`)
const campus = planRoute(kerb, { x: 0, z: -40 }, [{ kind: 'box', x: 0, z: -48, hx: 8, hz: 5.5 }], 61)
let onLen = 0, allLen = 0
for (let i = 0; campus && i < campus.length - 1; i++) for (let k = 0; k < 20; k++) {
  const a = campus[i]!, b = campus[i + 1]!, l = Math.hypot(b.x - a.x, b.z - a.z) / 20
  const x = a.x + (b.x - a.x) * (k + 0.5) / 20, z = a.z + (b.z - a.z) * (k + 0.5) / 20
  allLen += l; if (onRoad(x, z, 1)) onLen += l
}
check(!!campus && onLen / allLen > 0.8, `the Campus route keeps to roads (${Math.round((onLen / Math.max(1, allLen)) * 100)}% on road)`)
console.log(fail ? `drive: ${pass} passed, ${fail} failed` : `drive: ${pass} passed, 0 failed`)
if (fail) process.exit(1)
