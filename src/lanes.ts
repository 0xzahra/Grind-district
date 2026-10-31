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
