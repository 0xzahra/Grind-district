// Car lanes and building footprints, shared by the renderer and the automated lane check.
// Roads: two straight arms (x and z axes) from the plaza ring out to a turnaround that stops well short of
// the civic buildings at the arm ends (trading floor, influencer row, learning hall, trenches).
export const ROAD_HALF = 3.2
export const LANE_INNER = 18
export const LANE_OUTER = 33 // the U-turn apex reaches LANE_OUTER + ROAD_HALF/2
export const ROAD_END = 37 // painted asphalt ends here (turning bay)
export const ARMS = [
  { ax: 1, az: 0 },
  { ax: -1, az: 0 },
  { ax: 0, az: 1 },
  { ax: 0, az: -1 },
] as const

export type Footprint = { x: number; z: number; w: number; d: number; label: string }
// Every building shell (centre, width in x, depth in z). Keep in sync with world.ts / houses.ts.
export const FOOTPRINTS: Footprint[] = [
  { x: 0, z: -48, w: 16, d: 11, label: 'Learning hall' },
  { x: 16, z: -54, w: 8, d: 7, label: 'Conference' },
  { x: -16, z: -54, w: 8, d: 7, label: 'Campus café' },
  { x: -12, z: -36, w: 3.2, d: 2.2, label: 'Booth' },
  { x: 12, z: -36, w: 3.2, d: 2.2, label: 'Booth' },
  { x: -48, z: 0, w: 12, d: 16, label: 'Trading floor' },
  { x: 48, z: 0, w: 12, d: 16, label: 'Influencer row' },
  { x: 0, z: 48, w: 16, d: 11, label: 'Trenches' },
  { x: 22, z: -22, w: 8, d: 7, label: 'Boutique' },
  { x: -22, z: -22, w: 8, d: 8, label: 'Gym' },
  { x: 24, z: 24.5, w: 9, d: 17, label: 'Church' },
  { x: -24, z: 25, w: 10.5, d: 13, label: 'Masjid' },
  { x: 36, z: 32, w: 7, d: 6, label: 'Your house' },
  { x: 52, z: 18, w: 6, d: 5, label: 'Notes house' },
  { x: 52, z: 28, w: 6, d: 5, label: 'Set house' },
  { x: 52, z: 40, w: 6, d: 5, label: 'Grove house' },
  { x: 36, z: 46, w: 6, d: 5, label: 'Vacant house' },
  { x: 28, z: -16, w: 8, d: 6, label: 'Terminal café' },
  { x: -28, z: 16, w: 4.4, d: 2.6, label: 'Carbon desk' },
  { x: -16, z: 14, w: 5.4, d: 4.2, label: 'Gadgets' },
]

/** Lane centre point for arm `arm`, progress t (0 = plaza ring, 1 = turnaround), outbound or inbound lane. */
export function lanePoint(arm: number, t: number, outbound: boolean): { x: number; z: number; heading: number } {
  const a = ARMS[arm]!
  const along = LANE_INNER + t * (LANE_OUTER - LANE_INNER)
  const lane = (outbound ? 1 : -1) * ROAD_HALF * 0.5
  const dir = outbound ? 1 : -1
  return { x: a.ax * along - a.az * lane, z: a.az * along + a.ax * lane, heading: Math.atan2(a.ax * dir, a.az * dir) }
}

/** Point on the U-turn semicircle at the arm end (u: 0 outbound lane -> 1 inbound lane). */
export function uturnPoint(arm: number, u: number): { x: number; z: number; heading: number } {
  const a = ARMS[arm]!
  const r = ROAD_HALF * 0.5
  const ang = u * Math.PI
  // Local frame: f = outward along the arm, s = right of outward.
  const f = LANE_OUTER + Math.sin(ang) * r
  const s = Math.cos(ang) * r
  const x = a.ax * f - a.az * s
  const z = a.az * f + a.ax * s
  // Tangent: d/du of (f, s) = (cos, -sin) * r * PI.
  const tf = Math.cos(ang)
  const ts = -Math.sin(ang)
  const hx = a.ax * tf - a.az * ts
  const hz = a.az * tf + a.ax * ts
  return { x, z, heading: Math.atan2(hx, hz) }
}

export function insideFootprint(x: number, z: number, margin: number): Footprint | null {
  for (const f of FOOTPRINTS) if (Math.abs(x - f.x) < f.w / 2 + margin && Math.abs(z - f.z) < f.d / 2 + margin) return f
  return null
}

// Side road: leaves the east arm, runs past the house row and out of the city at the south-east edge.
// Rects (centre + half extents) for painting; the route polyline is the centre line cars follow.
export const SIDE_RECTS = [
  { x: 30, z: 6, hx: ROAD_HALF, hz: 6 + ROAD_HALF },
  { x: 37, z: 12, hx: 7 + ROAD_HALF, hz: ROAD_HALF },
  { x: 44, z: 50.5, hx: ROAD_HALF, hz: 38.5 },
]
export const SIDE_LINES = [
  { horizontal: false, at: 30, from: 0, to: 12 },
  { horizontal: true, at: 12, from: 30, to: 44 },
  { horizontal: false, at: 44, from: 12, to: 89 },
]
const SIDE_POLY: [number, number][] = [[24, 0], [30, 0], [30, 12], [44, 12], [44, 89]]
export const SIDE_JOIN_T = (24 - LANE_INNER) / (LANE_OUTER - LANE_INNER) // east-arm progress where the side road starts

/** Dense centre line with rounded corners (radius 3.4). */
function buildSide(): { x: number; z: number; s: number }[] {
  const R = 3.4
  const out: { x: number; z: number; s: number }[] = []
  const push = (x: number, z: number) => {
    const last = out[out.length - 1]
    out.push({ x, z, s: last ? last.s + Math.hypot(x - last.x, z - last.z) : 0 })
  }
  push(SIDE_POLY[0]![0], SIDE_POLY[0]![1])
  for (let i = 1; i < SIDE_POLY.length; i++) {
    const [px, pz] = SIDE_POLY[i - 1]!
    const [cx, cz] = SIDE_POLY[i]!
    const next = SIDE_POLY[i + 1]
    const inX = Math.sign(cx - px), inZ = Math.sign(cz - pz)
    if (!next) { push(cx, cz); break }
    const outX = Math.sign(next[0] - cx), outZ = Math.sign(next[1] - cz)
    const ax = cx - inX * R, az = cz - inZ * R // arc start
    push(ax, az)
    // Arc centre sits at start + R * outward-turn direction.
    const ox = ax + outX * R, oz = az + outZ * R
    const a0 = Math.atan2(az - oz, ax - ox)
    const a1 = Math.atan2(cz + outZ * R - oz, cx + outX * R - ox)
    let da = a1 - a0
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    for (let k = 1; k <= 8; k++) { const a = a0 + (da * k) / 8; push(ox + Math.cos(a) * R, oz + Math.sin(a) * R) }
  }
  return out
}
export const SIDE = buildSide()
export const SIDE_LEN = SIDE[SIDE.length - 1]!.s
/** Stops on the side road: by each house, and the city edge at the end. */
export const SIDE_STOPS = [
  { label: 'Notes house', z: 18 }, { label: 'Set house', z: 28 }, { label: 'Your house', z: 32 },
  { label: 'Grove house', z: 40 }, { label: 'Vacant house', z: 46 },
].map((h) => ({ label: h.label, s: SIDE_LEN - (89 - h.z) }))

/** Lane point on the side road at distance s; outbound = away from the arm. Drive on the right. */
export function sidePoint(s: number, outbound: boolean): { x: number; z: number; heading: number } {
  s = Math.max(0, Math.min(SIDE_LEN, s))
  let i = 1
  while (i < SIDE.length - 1 && SIDE[i]!.s < s) i++
  const a = SIDE[i - 1]!, b = SIDE[i]!
  const f = (s - a.s) / Math.max(1e-6, b.s - a.s)
  const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f
  let hx = b.x - a.x, hz = b.z - a.z
  const l = Math.hypot(hx, hz) || 1
  hx /= l; hz /= l
  if (!outbound) { hx = -hx; hz = -hz }
  // Right of travel (y up): (-hz, hx)... for +z travel right is -x, i.e. (-hz, ?): right = (-hz, hx) gives (-1, 0) for (0,1).
  const off = ROAD_HALF * 0.5
  return { x: x - hz * off, z: z + hx * off, heading: Math.atan2(hx, hz) }
}
