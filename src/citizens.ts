import type { BodyId, DroneId, MaskId } from './logic.ts'

export type CitizenSpec = {
  rank: string
  body: BodyId
  tint: number
  luxury: boolean
  mask: MaskId
  drone: DroneId | 'none'
  speed: number
  points: { x: number; z: number }[]
  /** Pause at each waypoint (plaza strollers). */
  pause?: boolean
  /** Plaza pair id: partners pick the same next stop and idle time, so they keep meeting. */
  pair?: number
}

export type CitizenSim = {
  spec: CitizenSpec
  x: number
  z: number
  index: number
  /** Seconds left standing at the current waypoint (idle: chatting, looking around). */
  wait?: number
  rested?: boolean
  visits?: number
  /** Street walkers: where this leg goes (a random spot on the route, not the next point of a fixed loop). */
  tx?: number
  tz?: number
  /** This leg's own pace (each leg a little faster or slower). */
  pace?: number
  /** Gone into a building for this many seconds (hidden; only while the player is not close). -1: going in. */
  inside?: number
}

/** A round body people walk around: the player, the robot. */
export type Solid = { x: number; z: number; r: number }

export const CITIZENS: CitizenSpec[] = [
  { rank: 'Crab', body: 'zuri', tint: 0xff6f61, luxury: false, mask: 'none', drone: 'none', speed: 1.15, points: [{ x: -2.2, z: -37 }, { x: 2.2, z: -37 }] },
  { rank: 'Fish', body: 'player', tint: 0x9fd4ff, luxury: false, mask: 'none', drone: 'none', speed: 1.25, points: [{ x: -37, z: -2 }, { x: -37, z: 2 }] },
  { rank: 'Dolphin', body: 'zuri', tint: 0x1a4cff, luxury: false, mask: 'azuki', drone: 'none', speed: 1.2, points: [{ x: 37, z: -2 }, { x: 37, z: 2 }] },
  { rank: 'Shrimp', body: 'player', tint: 0xf0d7b0, luxury: false, mask: 'none', drone: 'none', speed: 1.35, points: [{ x: -2, z: 37 }, { x: 2, z: 37 }] },
  { rank: 'Shark', body: 'player', tint: 0xf0d7b0, luxury: true, mask: 'degods', drone: 'halo', speed: 1.45, points: [{ x: 0, z: -10 }, { x: 10, z: 0 }, { x: 0, z: 10 }, { x: -10, z: 0 }] },
  { rank: 'Crab', body: 'zuri', tint: 0xff6f61, luxury: false, mask: 'none', drone: 'scout', speed: 1.2, points: [{ x: -8, z: -28 }, { x: 8, z: -28 }] },
  { rank: 'Fish', body: 'zuri', tint: 0x3f6b5a, luxury: false, mask: 'pudgy', drone: 'none', speed: 1.15, points: [{ x: -28, z: -6 }, { x: -28, z: 6 }] },
  { rank: 'Crab', body: 'player', tint: 0x1a4cff, luxury: false, mask: 'punk', drone: 'none', speed: 1.3, points: [{ x: -4, z: 20 }, { x: 4, z: 20 }] },
  { rank: 'Dolphin', body: 'zuri', tint: 0xf0d7b0, luxury: true, mask: 'ape', drone: 'courier', speed: 1.18, points: [{ x: 42, z: 16 }, { x: 42, z: 26 }] },
  { rank: 'Fish', body: 'player', tint: 0x9fd4ff, luxury: false, mask: 'nodemonke', drone: 'scout', speed: 1.22, points: [{ x: 8, z: -8 }, { x: 8, z: 8 }] },
  { rank: 'Shark', body: 'zuri', tint: 0xff6f61, luxury: true, mask: 'azuki', drone: 'halo', speed: 1.28, points: [{ x: 18, z: -4 }, { x: 18, z: 10 }] },
  { rank: 'Crab', body: 'zuri', tint: 0x9fd4ff, luxury: false, mask: 'none', drone: 'none', speed: 1.16, points: [{ x: 40, z: 8 }, { x: 40, z: 16 }] },
  { rank: 'Crab', body: 'zuri', tint: 0xf0d7b0, luxury: false, mask: 'none', drone: 'none', speed: 0, points: [{ x: -7.4, z: 3.6 }] },
  { rank: 'Fish', body: 'player', tint: 0x9fd4ff, luxury: false, mask: 'punk', drone: 'none', speed: 0, points: [{ x: 12, z: -36 }] },
  { rank: 'Dolphin', body: 'zuri', tint: 0x3f6b5a, luxury: false, mask: 'pudgy', drone: 'scout', speed: 0, points: [{ x: 8, z: 5 }] },
  { rank: 'Fish', body: 'player', tint: 0xf0d7b0, luxury: false, mask: 'nodemonke', drone: 'none', speed: 0, points: [{ x: -5, z: -4 }] },
  { rank: 'Shark', body: 'zuri', tint: 0xff6f61, luxury: true, mask: 'degods', drone: 'courier', speed: 0, points: [{ x: 14, z: 6 }] },
  { rank: 'Crab', body: 'player', tint: 0x1a4cff, luxury: false, mask: 'ape', drone: 'halo', speed: 0, points: [{ x: -12, z: 6 }] },
  { rank: 'Whale', body: 'zuri', tint: 0xf0d7b0, luxury: true, mask: 'azuki', drone: 'halo', speed: 0, points: [{ x: 6, z: -12 }] },
  { rank: 'Shrimp', body: 'player', tint: 0xff6f61, luxury: false, mask: 'none', drone: 'scout', speed: 0, points: [{ x: -4, z: 12 }] },
]

// The once-static plaza people now stroll the Grind Ring in pairs: each pair shares meeting spots
// (1.3 m apart, so they stop face to face and chat) and pauses there before moving on.
{
  const ring = (a: number, r: number) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r })
  const statics = CITIZENS.filter((c) => c.speed === 0)
  statics.forEach((c, i) => {
    const pair = Math.floor(i / 2), side = i % 2 ? 0.65 : -0.65
    const base = pair * 1.9 + 0.4
    c.speed = 0.9 + (i % 3) * 0.08
    c.pause = true
    c.pair = pair
    // Three spots on the ring plus one stop in toward the stall, so pairs drift about instead of circling.
    c.points = [0, 2.1, 4.2].map((k) => { const p = ring(base + k, 7.5 + (pair % 3) * 2); const t = ring(base + k + Math.PI / 2, side); return { x: p.x + t.x * 1, z: p.z + t.z * 1 } })
    { const p = ring(base + 1.05, 5.4 + (pair % 2) * 0.6); const t = ring(base + 1.05 + Math.PI / 2, side); c.points.push({ x: p.x + t.x, z: p.z + t.z }) }
  })
}

// Soften perfectly straight 2-point patrols: insert a mid waypoint with a small lateral arc
// so walkers weave instead of skating on a ruler line (Zahra phase-2).
{
  CITIZENS.forEach((c, i) => {
    if (c.points.length !== 2 || c.speed <= 0) return
    const a = c.points[0]!, b = c.points[1]!
    const dx = b.x - a.x, dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    const side = (i % 2 ? 1 : -1) * (1.4 + (i % 3) * 0.35)
    const mx = (a.x + b.x) / 2 + (-dz / len) * side
    const mz = (a.z + b.z) / 2 + (dx / len) * side
    c.points = [a, { x: mx, z: mz }, b]
  })
}

for (const c of CITIZENS) for (const pt of c.points) { const r = Math.hypot(pt.x, pt.z); if (r < 3.2 && r > 1e-3) { pt.x *= 3.2 / r; pt.z *= 3.2 / r } }

export function bootCitizens(): CitizenSim[] {
  return CITIZENS.map((spec) => {
    const start = spec.points[0] ?? { x: 0, z: 0 }
    return { spec, x: start.x, z: start.z, index: spec.points.length > 1 ? 1 % spec.points.length : 0 }
  })
}

const pairHash = (a: number, b: number) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x) }

/** A point `t` (0..1) of the way along a walker's route, with the route's direction there. */
function along(pts: { x: number; z: number }[], t: number): { x: number; z: number; dx: number; dz: number } {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)
  let d = t * total
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!, l = Math.hypot(b.x - a.x, b.z - a.z) || 1
    if (d <= l || i === pts.length - 1) { const k = Math.min(1, d / l); return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: (b.x - a.x) / l, dz: (b.z - a.z) / l } }
    d -= l
  }
  return { x: pts[0]!.x, z: pts[0]!.z, dx: 1, dz: 0 }
}

/**
 * Street walkers no longer pace A-B-A forever: each leg heads for a random spot along their stretch of
 * pavement (a little to either side), at its own pace; some stop a while, and now and then one goes into a
 * building at the end of the street and comes back out later (only while the player is not close by).
 */
function nextLeg(person: CitizenSim, focus?: { x: number; z: number }): void {
  const pts = person.spec.points
  for (let tries = 0; tries < 6; tries++) {
    const end = Math.random() < 0.3
    const t = end ? (Math.random() < 0.5 ? 0 : 1) : Math.random()
    const p = along(pts, t)
    const side = (Math.random() - 0.5) * 1.2
    const x = p.x - p.dz * side, z = p.z + p.dx * side
    if (Math.hypot(x - person.x, z - person.z) < 2.5 && tries < 5) continue
    person.tx = x; person.tz = z
    person.pace = person.spec.speed * (0.8 + Math.random() * 0.45)
    if (end && focus && Math.random() < 0.35) person.inside = -1
    return
  }
}

/**
 * Move everyone one step. `solids` (the player, the robot) are walked round, never into, and people keep
 * apart from each other. A coarse grid keeps the neighbour checks local.
 */
export function stepCitizens(people: CitizenSim[], dt: number, solids: Solid[] = [], focus?: { x: number; z: number }): void {
  for (const person of people) {
    if (person.spec.points.length < 2) continue
    if (person.inside !== undefined && person.inside > 0) {
      person.inside -= dt
      if (person.inside <= 0) {
        // Come back out only while the player is not standing right there.
        if (focus && Math.hypot(person.x - focus.x, person.z - focus.z) < 12) person.inside = 3
        else { person.inside = undefined; nextLeg(person, focus) }
      }
      continue
    }
    if ((person.wait ?? 0) > 0) { person.wait! -= dt; continue }
    let dx: number, dz: number, dist: number, speed = person.spec.speed
    if (!person.spec.pause) {
      if (person.tx === undefined || person.tz === undefined) nextLeg(person, focus)
      dx = person.tx! - person.x; dz = person.tz! - person.z; dist = Math.hypot(dx, dz)
      if (dist < 0.3) {
        if (person.inside === -1) {
          person.inside = focus && Math.hypot(person.x - focus.x, person.z - focus.z) > 14 ? 8 + Math.random() * 20 : undefined
          if (person.inside !== undefined) continue
        }
        if (Math.random() < 0.4) person.wait = 1.5 + Math.random() * 6
        nextLeg(person, focus)
        continue
      }
      speed = person.pace ?? speed
    } else {
      const target = person.spec.points[person.index]
      if (!target) continue
      dx = target.x - person.x; dz = target.z - person.z; dist = Math.hypot(dx, dz)
      if (dist < 0.3) {
        // Plaza strollers pause at each stop so the square has people chatting, not just marching.
        if (!person.rested) {
          // Idle a varied while (chat, look around), sometimes a long stop; partners share the same numbers.
          const v = person.visits ?? 0
          const h = pairHash(person.spec.pair ?? 0, v)
          person.wait = h < 0.25 ? 14 + h * 40 : 4 + h * 8
          person.rested = true
          continue
        }
        person.rested = false
        // Pick the next stop instead of looping the ring forever (never the same spot twice in a row).
        const n = person.spec.points.length
        const v = (person.visits = (person.visits ?? 0) + 1)
        person.index = (person.index + 1 + Math.floor(pairHash((person.spec.pair ?? 0) + 17, v) * (n - 1))) % n
        const next = person.spec.points[person.index]
        if (!next) continue
        dx = next.x - person.x; dz = next.z - person.z; dist = Math.hypot(dx, dz)
      }
    }
    if (dist < 0.001) continue
    let ux = dx / dist, uz = dz / dist
    // Side-step: the player or the robot close ahead on the line: bear round them instead of walking in.
    for (const o of solids) {
      const rx = o.x - person.x, rz = o.z - person.z
      const ahead = rx * ux + rz * uz
      if (ahead <= 0 || ahead > 1.8) continue
      const lat = rx * uz - rz * ux
      if (Math.abs(lat) < o.r + 0.45) {
        const s = lat >= 0 ? 1 : -1
        const nx = ux - uz * s * 0.9, nz = uz + ux * s * 0.9, l = Math.hypot(nx, nz) || 1
        ux = nx / l; uz = nz / l
      }
    }
    const step = Math.min(dist, speed * dt)
    person.x += ux * step
    person.z += uz * step
  }
  separate(people, solids)
  for (const person of people) {
    // Nobody walks through the Grind Ring stand at the centre of the plaza: slide round its deck instead.
    const r = Math.hypot(person.x, person.z)
    if (r < STAND_R && r > 1e-3) { person.x *= STAND_R / r; person.z *= STAND_R / r }
  }
}

/** Body radius for people keeping apart (shoulders, not a personal-space bubble). */
const BODY = 0.34
const CELL = 2
/** Push overlapping bodies apart: two people share the push; the player and the robot are never shoved. */
function separate(people: CitizenSim[], solids: Solid[]): void {
  const live = people.filter((p) => !(p.inside !== undefined && p.inside > 0))
  const grid = new Map<number, number[]>()
  const key = (cx: number, cz: number) => (cx + 512) * 1024 + (cz + 512)
  live.forEach((p, i) => { const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)); const l = grid.get(k); if (l) l.push(i); else grid.set(k, [i]) })
  for (let pass = 0; pass < 2; pass++) {
    live.forEach((p, i) => {
      const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL)
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        for (const j of grid.get(key(cx + ox, cz + oz)) ?? []) {
          if (j <= i) continue
          const q = live[j]!
          const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), min = BODY * 2
          if (d >= min) continue
          const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, push = (min - d) / 2
          p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push
        }
      }
    })
    for (const p of live) for (const o of solids) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = BODY + o.r
      if (d >= min) continue
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0
      p.x += nx * (min - d); p.z += nz * (min - d)
    }
  }
}

/** Radius kept clear around the plaza drinks stand (its deck is 2.7 m across the middle). */
const STAND_R = 3.1
