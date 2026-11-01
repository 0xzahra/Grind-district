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
}

export type CitizenSim = {
  spec: CitizenSpec
  x: number
  z: number
  index: number
  /** Seconds left standing at the current waypoint (idle: chatting, looking around). */
  wait?: number
  rested?: boolean
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
    c.points = [0, 2.1, 4.2].map((k) => { const p = ring(base + k, 7.5 + (pair % 3) * 2); const t = ring(base + k + Math.PI / 2, side); return { x: p.x + t.x * 1, z: p.z + t.z * 1 } })
  })
}

export function bootCitizens(): CitizenSim[] {
  return CITIZENS.map((spec) => {
    const start = spec.points[0] ?? { x: 0, z: 0 }
    return { spec, x: start.x, z: start.z, index: spec.points.length > 1 ? 1 % spec.points.length : 0 }
  })
}

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
      if (person.spec.pause && !person.rested) { person.wait = 3 + Math.random() * 6; person.rested = true; continue }
      person.rested = false
      person.index = (person.index + 1) % person.spec.points.length
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
  }
}
