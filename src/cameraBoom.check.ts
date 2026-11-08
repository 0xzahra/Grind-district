// Run: node --experimental-strip-types src/cameraBoom.check.ts
// Checks the camera boom rules used by main.ts against the two failures in the 8 Nov phone recording.
import { MIN_BOOM, NEED, PAD, WALL_GAP, dist, freeFraction, overHead, pickHeading, travelBeforeWall, type Box2, type Room2, type Vec3 } from './cameraBoom.ts'

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

// 3) Narrow passage (preview of 3b2fc15, 8 Nov): two partitions 0.8 m apart of clear floor, player in the
//    middle, camera aimed into one partition. Old search (normal pad only) found no heading and fell onto
//    the head; the new one frames down the passage at a normal boom, never inside a wall.
const room: Room2 = { x: 0, z: 0, hw: 9.5, hd: 7 }
const passage: Box2[] = [{ x: -0.475, z: 0, hx: 0.075, hz: 4 }, { x: 0.475, z: 0, hx: 0.075, hz: 4 }]
const want = 3.2
const oldBest = (() => { // the 3b2fc15 rule, verbatim: pad 0.45 only
  let best = freeFraction(0, 0, want, 0, room, passage, PAD) * want
  for (let k = 1; k < 8; k++) {
    const a = Math.PI / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4)
    best = Math.max(best, freeFraction(0, 0, Math.sin(a) * want, Math.cos(a) * want, room, passage, PAD) * want)
  }
  return best
})()
check(oldBest < NEED, `regression: the old rule found no room in the passage (${oldBest.toFixed(2)} m)`)
const pick = pickHeading(0, 0, want, 0, want, room, passage)
check(pick.dir !== null && pick.reach >= NEED, `passage: a heading with at least ${NEED} m of room (${pick.reach.toFixed(2)} m)`)
check(Math.abs(pick.dir!.x) < 0.2, 'passage: camera looks along the passage, not into a partition')
const cam = overHead({ x: 0, y: 1.45, z: 0 }, { x: pick.dir!.x, y: 0, z: pick.dir!.z }, Math.max(0.6, pick.reach - 0.1), 2.6)
check(dist(cam, { x: 0, y: 1.45, z: 0 }) >= MIN_BOOM - 1e-9, 'passage: boom at least MIN_BOOM, not a head close-up')
check(Math.atan2(cam.y - 1.45, Math.hypot(cam.x, cam.z)) < Math.PI / 4, 'passage: shallow view (< 45 degrees), not a steep overhead')
for (const w of passage) check(!(Math.abs(cam.x - w.x) < w.hx + 0.2 && Math.abs(cam.z - w.z) < w.hz + 0.2), 'passage: camera keeps 0.2 m off each partition')
// Open room: unchanged behaviour (pass 1 only), and a wide room never needs the thin pad.
const open = pickHeading(0, 0, 0, 3.2, 3.2, room, [{ x: 0, z: 0.8, hx: 3, hz: 0.075 }])
check(open.pad === PAD && open.reach >= NEED, 'open room backed against one wall: normal pad, heading found as before')
console.log('ok - narrow passage: camera frames along it instead of collapsing over the head')
console.log('camera boom checks passed')
