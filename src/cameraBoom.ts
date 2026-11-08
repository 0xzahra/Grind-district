// Third-person camera boom rules, kept pure so they can be checked in Node (src/cameraBoom.check.ts).
//
// The phone recording of 8 Nov 2026 (upstairs in the house) showed two failures:
// - backed against a wall, the camera was pulled to ~0.7 m from the head, inside the avatar, so the
//   body vanished and only the wall behind showed;
// - with a wall closer than 0.7 m, the old rule (travel = max(0.7, hit - 0.45)) put the camera on the
//   far side of the wall.
// The rules here: the camera never goes past the first thing it hits, and when there is no room
// behind the player it rises over the head instead of pushing into it.

/** Closest the camera may sit to the look target (the head/shoulder point) before it clips the body. */
export const MIN_BOOM = 1.15
/** Gap kept between the camera and the surface it hit, so the near plane stays in front of the wall. */
export const WALL_GAP = 0.35

export type Vec3 = { x: number; y: number; z: number }

/** How far along the look ray the camera may go when the ray hits something at `hitDistance`. */
export function travelBeforeWall(hitDistance: number): number {
  return Math.max(0.05, hitDistance - WALL_GAP)
}

/**
 * Camera spot when the room behind the player is shorter than MIN_BOOM: keep the horizontal
 * distance the wall allows (`flat`), then rise straight up until the camera is MIN_BOOM from the
 * target. `dir` is the unit look ray from the target toward where the camera wanted to be.
 * Rising never crosses the wall: the horizontal part stays at or inside the allowed travel.
 */
export function overHead(origin: Vec3, dir: Vec3, flat: number, maxY = Infinity): Vec3 {
  const hx = dir.x
  const hz = dir.z
  const hl = Math.hypot(hx, hz) || 1
  const h = Math.max(0, flat)
  const rise = Math.sqrt(Math.max(0, MIN_BOOM * MIN_BOOM - h * h))
  return {
    x: origin.x + (hx / hl) * h,
    y: Math.min(maxY, origin.y + rise),
    z: origin.z + (hz / hl) * h,
  }
}

export const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
