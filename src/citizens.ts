import type { BodyId, DroneId, MaskId } from './logic.ts'

export type CitizenSpec = {
  name: string
  rank: string
  body: BodyId
  tint: number
  luxury: boolean
  mask: MaskId
  drone: DroneId | 'none'
  speed: number
  points: { x: number; z: number }[]
}

export type CitizenSim = {
  spec: CitizenSpec
  x: number
  z: number
  index: number
}

export const CITIZENS: CitizenSpec[] = [
  { name: 'Adaeze', rank: 'Crab', body: 'zuri', tint: 0xff6f61, luxury: false, mask: 'none', drone: 'none', speed: 1.15, points: [{ x: -2.2, z: -37 }, { x: 2.2, z: -37 }] },
  { name: 'Malik', rank: 'Fish', body: 'player', tint: 0x9fd4ff, luxury: false, mask: 'none', drone: 'none', speed: 1.25, points: [{ x: -37, z: -2 }, { x: -37, z: 2 }] },
  { name: 'Nia', rank: 'Dolphin', body: 'zuri', tint: 0x1a4cff, luxury: false, mask: 'azuki', drone: 'none', speed: 1.2, points: [{ x: 37, z: -2 }, { x: 37, z: 2 }] },
  { name: 'Jo', rank: 'Shrimp', body: 'player', tint: 0xf0d7b0, luxury: false, mask: 'none', drone: 'none', speed: 1.35, points: [{ x: -2, z: 37 }, { x: 2, z: 37 }] },
  { name: 'Sefu', rank: 'Shark', body: 'player', tint: 0xf0d7b0, luxury: true, mask: 'degods', drone: 'halo', speed: 1.45, points: [{ x: 0, z: -10 }, { x: 10, z: 0 }, { x: 0, z: 10 }, { x: -10, z: 0 }] },
  { name: 'Amara', rank: 'Crab', body: 'zuri', tint: 0xff6f61, luxury: false, mask: 'none', drone: 'scout', speed: 1.2, points: [{ x: -8, z: -28 }, { x: 8, z: -28 }] },
  { name: 'Kemi', rank: 'Fish', body: 'zuri', tint: 0x1af38f, luxury: false, mask: 'pudgy', drone: 'none', speed: 1.15, points: [{ x: -28, z: -6 }, { x: -28, z: 6 }] },
  { name: 'Tunde', rank: 'Crab', body: 'player', tint: 0x1a4cff, luxury: false, mask: 'punk', drone: 'none', speed: 1.3, points: [{ x: -4, z: 20 }, { x: 4, z: 20 }] },
  { name: 'Chioma', rank: 'Dolphin', body: 'zuri', tint: 0xf0d7b0, luxury: true, mask: 'ape', drone: 'courier', speed: 1.18, points: [{ x: 42, z: 16 }, { x: 42, z: 26 }] },
  { name: 'Emeka', rank: 'Fish', body: 'player', tint: 0x9fd4ff, luxury: false, mask: 'nodemonke', drone: 'scout', speed: 1.22, points: [{ x: 8, z: -8 }, { x: 8, z: 8 }] },
  { name: 'Sade', rank: 'Shark', body: 'zuri', tint: 0xff6f61, luxury: true, mask: 'azuki', drone: 'halo', speed: 1.28, points: [{ x: 18, z: -4 }, { x: 18, z: 10 }] },
  { name: 'Lola', rank: 'Crab', body: 'zuri', tint: 0x9fd4ff, luxury: false, mask: 'none', drone: 'none', speed: 1.16, points: [{ x: 40, z: 8 }, { x: 40, z: 16 }] },
  { name: 'Ife', rank: 'Crab', body: 'zuri', tint: 0xf0d7b0, luxury: false, mask: 'none', drone: 'none', speed: 0, points: [{ x: -7.4, z: 3.6 }] },
  { name: 'Bo', rank: 'Fish', body: 'player', tint: 0x9fd4ff, luxury: false, mask: 'punk', drone: 'none', speed: 0, points: [{ x: 12, z: -36 }] },
  { name: 'Zainab', rank: 'Dolphin', body: 'zuri', tint: 0x1af38f, luxury: false, mask: 'pudgy', drone: 'scout', speed: 0, points: [{ x: 8, z: 5 }] },
  { name: 'Chinedu', rank: 'Fish', body: 'player', tint: 0xf0d7b0, luxury: false, mask: 'nodemonke', drone: 'none', speed: 0, points: [{ x: -5, z: -4 }] },
  { name: 'Hauwa', rank: 'Shark', body: 'zuri', tint: 0xff6f61, luxury: true, mask: 'degods', drone: 'courier', speed: 0, points: [{ x: 14, z: 6 }] },
  { name: 'Farouk', rank: 'Crab', body: 'player', tint: 0x1a4cff, luxury: false, mask: 'ape', drone: 'halo', speed: 0, points: [{ x: -12, z: 6 }] },
  { name: 'Bisi', rank: 'Whale', body: 'zuri', tint: 0xf0d7b0, luxury: true, mask: 'azuki', drone: 'halo', speed: 0, points: [{ x: 6, z: -12 }] },
  { name: 'Kunle', rank: 'Shrimp', body: 'player', tint: 0xff6f61, luxury: false, mask: 'none', drone: 'scout', speed: 0, points: [{ x: -4, z: 12 }] },
]

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
    if (dist < 0.3) {
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
