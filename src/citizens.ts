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
}

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

export function stepCitizens(people: CitizenSim[], dt: number): void {
  for (const person of people) {
    if (person.spec.points.length < 2) continue
    const target = person.spec.points[person.index]
    if (!target) continue
    let dx = target.x - person.x
    let dz = target.z - person.z
    let dist = Math.hypot(dx, dz)
    if ((person.wait ?? 0) > 0) { person.wait! -= dt; continue }
    if (dist < 0.3) {
      // Plaza strollers pause at each stop (3-9 s) so the square has people chatting, not just marching.
      if (person.spec.pause && !person.rested) {
        // Idle a varied while (chat, look around), sometimes a long stop; partners share the same numbers.
        const v = person.visits ?? 0
        const h = pairHash(person.spec.pair ?? 0, v)
        person.wait = h < 0.25 ? 14 + h * 40 : 4 + h * 8
        person.rested = true
        continue
      }
      person.rested = false
      if (person.spec.pause) {
        // Pick the next stop instead of looping the ring forever (never the same spot twice in a row).
        const n = person.spec.points.length
        const v = (person.visits = (person.visits ?? 0) + 1)
        person.index = (person.index + 1 + Math.floor(pairHash((person.spec.pair ?? 0) + 17, v) * (n - 1))) % n
      } else person.index = (person.index + 1) % person.spec.points.length
      const next = person.spec.points[person.index]
      if (!next) continue
      dx = next.x - person.x
      dz = next.z - person.z
      dist = Math.hypot(dx, dz)
    }
    if (dist < 0.001) continue
    const step = Math.min(dist, person.spec.speed * dt)
    person.x += (dx / dist) * step
    person.z += (dz / dist) * step
    // Nobody walks through the Grind Ring stand at the centre of the plaza: slide round its deck instead.
    const r = Math.hypot(person.x, person.z)
    if (r < STAND_R && r > 1e-3) { person.x *= STAND_R / r; person.z *= STAND_R / r }
  }
}
/** Radius kept clear around the plaza drinks stand (its deck is 2.7 m across the middle). */
const STAND_R = 3.1
