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

// ---- Indoor heading search (2D, no raycast) -------------------------------------------------------
// Preview of 3b2fc15, 8 Nov: in a narrow ground-floor passage the camera fell to a steep close-up over
// the head. Cause: every partition and furniture box carried a 0.45 m pad, and the search stopped at the
// first pad sample beyond 0.6 m. In a passage narrower than about 0.9 m of clear floor the whole passage
// is pad, so every heading (including straight along the passage) read as blocked and the camera dropped
// onto the head. Now a second pass with a thin pad (still never inside a wall or past the room shell)
// lets the camera sit down the passage behind or ahead of the player, at a normal boom.

export type Box2 = { x: number; z: number; hx: number; hz: number }
export type Room2 = { x: number; z: number; hw: number; hd: number }
/** Normal clearance from walls, and the thin clearance used only when the normal one leaves no room. */
export const PAD = 0.45
export const THIN_PAD = 0.2
/** Below this much horizontal room the camera is treated as backed against a wall. */
export const NEED = 1.2

/** 2: inside a wall or past the room shell (never allowed); 1: within `pad` of a wall; 0: clear. */
export function blockedAt(x: number, z: number, room: Room2, walls: Box2[], pad: number): 0 | 1 | 2 {
  const dx = Math.abs(x - room.x), dz = Math.abs(z - room.z)
  if (dx > room.hw + 0.4 || dz > room.hd + 0.4) return 2
  for (const w of walls) if (Math.abs(x - w.x) < w.hx && Math.abs(z - w.z) < w.hz) return 2
  if (!(dx < room.hw + 0.5 - pad && dz < room.hd + 0.5 - pad)) return 1
  for (const w of walls) if (Math.abs(x - w.x) < w.hx + pad && Math.abs(z - w.z) < w.hz + pad) return 1
  return 0
}

/** Free fraction of the segment origin -> (tx, tz), 12 samples. The first 0.6 m may cross pad (not wall). */
export function freeFraction(ox: number, oz: number, tx: number, tz: number, room: Room2, walls: Box2[], pad = PAD): number {
  const len = Math.hypot(tx - ox, tz - oz)
  let g = 0
  for (let i = 1; i <= 12; i++) {
    const t = i / 12
    const b = blockedAt(ox + (tx - ox) * t, oz + (tz - oz) * t, room, walls, pad)
    if (b === 2 || (b === 1 && t * len > 0.6)) break
    g = t
  }
  return g
}

/**
 * Backed against something: pick the heading (8 around the player) with the most room for a boom of
 * length `want`. Returns the unit direction and the reach along it, or dir null when nothing beats
 * the current aim. Pass 1 uses the normal pad (unchanged behaviour in open rooms); only when that
 * leaves less than NEED does pass 2 try the thin pad, which is what opens up narrow passages.
 */
export function pickHeading(ox: number, oz: number, aimX: number, aimZ: number, want: number, room: Room2, walls: Box2[]) {
  const base = Math.atan2(aimX, aimZ)
  const search = (pad: number, includeAim: boolean) => {
    let best = freeFraction(ox, oz, ox + aimX, oz + aimZ, room, walls, pad) * want
    let dir: { x: number; z: number } | null = null
    if (includeAim && best >= NEED) dir = { x: Math.sin(base), z: Math.cos(base) }
    const aimReach = best
    for (let k = 1; k < 8; k++) {
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4)
      const d = freeFraction(ox, oz, ox + Math.sin(a) * want, oz + Math.cos(a) * want, room, walls, pad) * want
      if (d > best + 0.3) { best = d; dir = { x: Math.sin(a), z: Math.cos(a) } }
    }
    return { dir, reach: best, aimReach, pad }
  }
  const first = search(PAD, false)
  if (first.reach >= NEED) return first
  const thin = search(THIN_PAD, true)
  return thin.dir && thin.reach > first.reach + 0.3 ? thin : first
}
