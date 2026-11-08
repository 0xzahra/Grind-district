// Run: node --experimental-strip-types src/cameraBoom.check.ts
// Checks the camera boom rules used by main.ts against the two failures in the 8 Nov phone recording.
import { MIN_BOOM, WALL_GAP, dist, overHead, travelBeforeWall, type Vec3 } from './cameraBoom.ts'

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`FAIL: ${message}`)
}
const head: Vec3 = { x: 0, y: 1.45, z: 0 }
const along = (dir: Vec3, t: number): Vec3 => ({ x: head.x + dir.x * t, y: head.y + dir.y * t, z: head.z + dir.z * t })
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l } }

// 1) Never past the wall: for any hit distance, the travel stops short of it.
for (const hit of [0.1, 0.3, 0.6, 0.7, 1.0, 1.5, 3, 8]) {
  const t = travelBeforeWall(hit)
  check(t < hit, `travel ${t} stays in front of a wall at ${hit}`)
  check(hit >= 0.4 ? t === hit - WALL_GAP : t <= hit, `gap kept at ${hit}`)
}
// The old rule max(0.7, hit - 0.45) crossed walls closer than 0.7 m; the new one does not.
check(Math.max(0.7, 0.5 - 0.45) > 0.5 && travelBeforeWall(0.5) < 0.5, 'regression: wall at 0.5 m is not crossed')
console.log('ok - camera never crosses the first wall')

// 2) No room behind: rising over the head keeps the camera MIN_BOOM from the head, and the
//    horizontal part never exceeds what the wall allowed.
const back = norm({ x: 0.3, y: 0.35, z: 1 })
for (const hit of [0.2, 0.5, 0.9, 1.3]) {
  const flat = travelBeforeWall(hit) * Math.hypot(back.x, back.z)
  const p = overHead(head, back, flat)
  check(Math.abs(dist(p, head) - MIN_BOOM) < 1e-9 || flat >= MIN_BOOM, `boom is MIN_BOOM over the head (hit ${hit})`)
  check(Math.hypot(p.x - head.x, p.z - head.z) <= Math.max(0, flat) + 1e-9, `horizontal stays inside the allowed travel (hit ${hit})`)
  check(p.y > head.y, 'camera rises, not drops')
  // The recording's failure: 0.7 m straight back put the camera inside the head and body.
  check(dist(p, head) > dist(along(back, 0.7), head), 'farther from the head than the old 0.7 m pull')
}
// Indoors the climb is capped under the room height; it still clears the old 0.7 m pull.
const capped = overHead(head, back, 0.25, 2.6)
check(capped.y <= 2.6 && dist(capped, head) > 1.1, 'indoor cap: at most 2.6 m up, still clear of the head')
const low = overHead({ x: 0, y: 1.8, z: 0 }, back, 0.25, 2.6)
check(low.y === 2.6, 'a tall look target still respects the 2.6 m room cap')
console.log('ok - no room behind: camera rises over the head instead of into it')
console.log('camera boom checks passed')
