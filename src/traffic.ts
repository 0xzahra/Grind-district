import * as THREE from 'three'
import { ARMS, lanePoint, uturnPoint, sidePoint, ringRoute, insideFootprint, ROAD_HALF, SIDE_JOIN_T, SIDE_LEN, SIDE_STOPS } from './lanes.ts'
import type { Graphics } from './logic.ts'
import type { Obstacle } from './physics.ts'
import { type CarKind } from './cars.ts'
import { createFineFleet } from './fineFleet.ts'

/**
 * Ambient traffic. Every car follows a leg (a polyline): out along an arm, U-turn in the bay, back in,
 * round the plaza roundabout to another arm, or down the side road past the houses and out of town.
 * Cars accelerate and brake smoothly, keep their distance, give way at the ring and stop for people.
 */

type Lanes = { roadHalf: number; walk: number; inner: number; outer: number }
const COUNTS: Record<Graphics, number> = { low: 10, medium: 16, high: 22 }
// Everyday cars with a luxury sports coupe every few cars, so even the phone fleet (10) has two or three of them.
const ORDER: CarKind[] = ['sedan', 'sports', 'hatchback', 'suv', 'taxi', 'sports', 'van', 'hatchback', 'pickup', 'sports', 'sedan', 'suv', 'minibus', 'sports', 'taxi', 'hatchback', 'van', 'sports', 'sedan', 'suv', 'pickup', 'sports']
// Sports coupes wear loud luxury paint (rosso, jet, giallo, lime, deep blue, pearl); the rest keep the street palette.
const LUXURY = [0xc8102e, 0x14161a, 0xf5c400, 0x7cc242, 0x1f3f8f, 0xf4f1ea, 0xe0561b]
/** Everyday paint for the saloons and coupés: pearl, graphite, midnight, burgundy, champagne, racing green, silver. */
const CHIC = [0xeeece6, 0x2e3236, 0x1b2a4a, 0x5e1622, 0xc9b590, 0x1f4a36, 0xb9bec4, 0x101215]
const HIDE = 50 // cars only leave or re-enter the city edge when the player is this far away

type LegKind = 'out' | 'u' | 'in' | 'ring' | 'sideOut' | 'sideU' | 'sideIn'
type Leg = { kind: LegKind; arm: number; to: number; xs: Float32Array; zs: Float32Array; cum: Float32Array; len: number; part: 0 | 1 }
type Car = {
  id: number; kind: CarKind; len: number; leg: Leg; s: number; seg: number; v: number; cruise: number
  x: number; z: number; px: number; pz: number; h: number; wait: number; park: number; goal: number; gone: number; hold: number; creep: number
}

function makeLeg(kind: LegKind, pts: { x: number; z: number }[], arm = 0, to = 0, part: 0 | 1 = 0): Leg {
  const n = pts.length
  const xs = new Float32Array(n), zs = new Float32Array(n), cum = new Float32Array(n)
  pts.forEach((p, i) => { xs[i] = p.x; zs[i] = p.z; if (i) cum[i] = cum[i - 1]! + Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z) })
  return { kind, arm, to, xs, zs, cum, len: cum[n - 1]!, part }
}

// Houses with room to pull fully onto the kerb (2.3 m) without the car clipping the building;
// where the house sits too close to the road a parked car would stick out into the lane.
const PARK_STOPS = SIDE_STOPS.filter((st) => {
  const p = sidePoint(st.s, true)
  return !insideFootprint(p.x - Math.cos(p.heading) * 2.3, p.z + Math.sin(p.heading) * 2.3, 1.3)
})

export function createTraffic(scene: THREE.Scene, lanes: Lanes, graphics: Graphics): {
  tick: (dt: number, time: number, focus: { x: number; z: number }, people?: Obstacle[]) => Obstacle[]
  /** Read-only snapshot for local traffic checks. */
  debug: () => Array<{ blk: number[]; fol: number[]; hold: number; wait: number; id: number; leg: string; s: number; v: number; x: number; z: number; h: number; len: number; on: boolean }>
} {
  void lanes
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const count = COUNTS[coarse && graphics !== 'low' ? 'low' : graphics]

  // --- Legs -------------------------------------------------------------------------------------------
  const sample = (f: (u: number) => { x: number; z: number }, n: number) => Array.from({ length: n + 1 }, (_, i) => f(i / n))
  const armLeg = (kind: 'out' | 'in', a: number, t0: number, t1: number, part: 0 | 1) =>
    makeLeg(kind, [lanePoint(a, t0, kind === 'out'), lanePoint(a, t1, kind === 'out')], a, a, part)
  const outLegs = ARMS.map((_, a) => a === 0 ? [armLeg('out', 0, 0, SIDE_JOIN_T, 0), armLeg('out', 0, SIDE_JOIN_T, 1, 1)] : [armLeg('out', a, 0, 1, 1)])
  const inLegs = ARMS.map((_, a) => a === 0 ? [armLeg('in', 0, 1, SIDE_JOIN_T, 0), armLeg('in', 0, SIDE_JOIN_T, 0, 1)] : [armLeg('in', a, 1, 0, 1)])
  const uLegs = ARMS.map((_, a) => makeLeg('u', sample((u) => uturnPoint(a, u), 14), a, a))
  const ringLegs = ARMS.map((_, a) => ARMS.map((__, b) => (a === b ? null : makeLeg('ring', ringRoute(a, b), a, b))))
  const sideOut = makeLeg('sideOut', sample((u) => sidePoint(u * SIDE_LEN, true), Math.ceil(SIDE_LEN / 0.5)))
  const sideIn = makeLeg('sideIn', sample((u) => sidePoint((1 - u) * SIDE_LEN, false), Math.ceil(SIDE_LEN / 0.5)))
  /** Distance along the outbound lane to side-road position p (the lane is shorter than the centre line round the bends). */
  const outS = (p: number) => {
    const f = Math.max(0, Math.min(1, p / SIDE_LEN)) * (sideOut.cum.length - 1), i = Math.min(sideOut.cum.length - 2, Math.floor(f))
    return sideOut.cum[i]! + (sideOut.cum[i + 1]! - sideOut.cum[i]!) * (f - i)
  }
  const sideU = (s: number) => {
    // U-turn across the side road at distance s, from the outbound lane to the inbound lane.
    const p = sidePoint(s, true)
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading)
    const rx = -Math.cos(p.heading), rz = Math.sin(p.heading)
    const r = ROAD_HALF * 0.5
    const cx = p.x - rx * r, cz = p.z - rz * r
    return makeLeg('sideU', sample((u) => { const a = u * Math.PI; return { x: cx + fx * Math.sin(a) * r + rx * Math.cos(a) * r, z: cz + fz * Math.sin(a) * r + rz * Math.cos(a) * r } }, 12))
  }
  const firstOut = (a: number) => outLegs[a]![0]!
  const firstIn = (a: number) => inLegs[a]![0]!

  // --- Fleet ------------------------------------------------------------------------------------------
  const kinds = Array.from({ length: count }, (_, i) => ORDER[i % ORDER.length]!)
  let lux = 0
  const colours = kinds.map((k, i) => (k === 'taxi' ? 0xf2c230 : k === 'sports' ? LUXURY[lux++ % LUXURY.length]! : CHIC[i % CHIC.length]!))
  // Every car on the street is one of the showroom's detailed designs (fineFleet.ts), batched per design.
  const fleet = createFineFleet(scene, kinds, { shadows: graphics !== 'low', colours })
  const cars: Car[] = []
  // Start every car in its own spot: at most as many per leg as fit with a car-length gap, the rest wait off the
  // map and drive in from the side road one by one (they used to be clamped onto the same spot and overlap).
  const spawnLegs = [...outLegs.flat(), ...inLegs.flat()]
  const fill = new Map<Leg, number>()
  kinds.forEach((kind, i) => {
    const len = fleet.length(i)
    let leg: Leg | null = null, s = 0
    for (let k = 0; k < spawnLegs.length && !leg; k++) {
      const L = spawnLegs[(i + k) % spawnLegs.length]!
      const at = fill.get(L) ?? 1.5
      if (at + len / 2 <= L.len - 2.5) { leg = L; s = at + len / 2; fill.set(L, s + len / 2 + 3.2) }
    }
    const car: Car = { id: i, kind, len, leg: leg ?? sideIn, s, seg: 0, v: 0, cruise: 6 + (i % 4) * 0.55, x: 0, z: 0, px: 0, pz: 0, h: 0, wait: 0, park: 0, goal: 0, gone: 0, hold: 0, creep: 0 }
    if (!leg) car.gone = 2 + cars.filter((c) => c.gone > 0).length * 4
    cars.push(car)
  })

  const pose = (c: Car) => {
    const L = c.leg
    const s = Math.min(Math.max(c.s, 0), L.len)
    while (c.seg < L.cum.length - 2 && L.cum[c.seg + 1]! < s) c.seg++
    while (c.seg > 0 && L.cum[c.seg]! > s) c.seg--
    const i = c.seg
    const seg = Math.max(1e-6, L.cum[i + 1]! - L.cum[i]!)
    const f = (s - L.cum[i]!) / seg
    c.x = L.xs[i]! + (L.xs[i + 1]! - L.xs[i]!) * f
    c.z = L.zs[i]! + (L.zs[i + 1]! - L.zs[i]!) * f
    // Heading from a short chord around the car, so curves turn smoothly instead of snapping per segment.
    const back = Math.max(0, s - 0.9), ahead = Math.min(L.len, s + 0.9)
    const at = (d: number) => {
      let j = 0
      while (j < L.cum.length - 2 && L.cum[j + 1]! < d) j++
      const g = Math.max(1e-6, L.cum[j + 1]! - L.cum[j]!), k = (d - L.cum[j]!) / g
      return [L.xs[j]! + (L.xs[j + 1]! - L.xs[j]!) * k, L.zs[j]! + (L.zs[j + 1]! - L.zs[j]!) * k] as const
    }
    const [bx, bz] = at(back), [ax, az] = at(ahead)
    if (Math.hypot(ax - bx, az - bz) > 1e-4) c.h = Math.atan2(ax - bx, az - bz)
  }
  const setLeg = (c: Car, leg: Leg, s = 0) => { c.leg = leg; c.s = s; c.seg = 0 }

  /** Legs a car can drive onto next (only the fixed ones; the ring and side-road U-turns are decided on arrival). */
  const next = (L: Leg): Leg[] => {
    switch (L.kind) {
      case 'u': return [firstIn(L.arm)]
      case 'in': return L.arm === 0 && L.part === 0 ? [inLegs[0]![1]!] : []
      case 'sideIn': return [inLegs[0]![1]!]
      case 'sideU': return [sideIn]
      case 'ring': return [firstOut(L.to)]
      case 'out': return L.arm === 0 && L.part === 0 ? [outLegs[0]![1]!, sideOut] : [uLegs[L.arm]!]
      default: return []
    }
  }
  /** Distance along the road from c's centre to o's centre when o is ahead on c's route, else -1.
   *  Covers a queue round a bend (where "straight ahead" misses the car in front) and two lanes merging into one. */
  const pathAhead = (c: Car, o: Car): number => {
    if (o.leg === c.leg) return o.s > c.s ? o.s - c.s : -1
    // A car pulling in to (or out of) a house is still in the outbound lane until it is fully on the kerb.
    if (c.leg === sideOut && o.leg.kind === 'sideU' && o.park < 0.9 && o.s < 1.5) { const d = outS(o.goal) - c.s; return d > 0 ? d : -1 }
    const nc = next(c.leg)
    if (nc.includes(o.leg)) return c.leg.len - c.s + o.s
    // Two legs ahead (e.g. the car just out of the U-turn while this one is still approaching it).
    for (const L of nc) if (next(L).includes(o.leg)) return c.leg.len - c.s + L.len + o.s
    if (c.leg.kind === 'ring' && o.leg.kind === 'ring') {
      // Both on the roundabout: follow whoever is just ahead round the ring (it flows with angle decreasing),
      // whichever arm they came from or are leaving by, as long as they share the same circle.
      // (Not while this car is already turning off: the one "ahead" may be joining from the arm it is leaving by.)
      if (c.leg.len - c.s < 6) return -1
      const rc = Math.hypot(c.px, c.pz), ro = Math.hypot(o.px, o.pz)
      if (Math.abs(rc - ro) > 2.2) return -1
      let d = Math.atan2(c.pz, c.px) - Math.atan2(o.pz, o.px)
      while (d < 0) d += Math.PI * 2
      while (d >= Math.PI * 2) d -= Math.PI * 2
      const along = d * (rc + ro) / 2
      return along < 14 ? along : -1
    }
    if (nc.length && next(o.leg).some((L) => nc.includes(L))) {
      // Merging: whoever is nearer the merge goes first; the other follows it.
      const dc = c.leg.len - c.s, dO = o.leg.len - o.s
      if (dO < dc - 0.05 || (Math.abs(dO - dc) <= 0.05 && o.id < c.id)) return dc - dO
    }
    return -1
  }
  /** Road distance to the ring's give-way line, or Infinity when not heading for it. */
  const toRing = (c: Car): number => {
    const L = c.leg
    if (L.kind === 'in' && L.part === 1) return L.len - c.s
    if ((L.kind === 'in' && L.arm === 0) || L.kind === 'sideIn') return L.len - c.s + inLegs[0]![1]!.len
    return Infinity
  }
  /** Can a car U-turn across the side road at distance `goal` without cutting up someone in the other lane? */
  const uturnClear = (self: Car, goal: number) => {
    const at = SIDE_LEN - goal // where the U-turn joins the inbound lane
    return cars.every((o) => o === self || o.gone > 0 ||
      !((o.leg === sideIn && o.s > at - 28 && o.s < at + 5) || (o.leg === sideOut && o.s > outS(goal) - 16 && o.s < outS(goal) + 4) ||
        (o.leg.kind === 'sideU' && Math.hypot(o.px - self.px, o.pz - self.pz) < 9)))
  }
  // The side road meets the east arm at a T: inbound side-road cars cross the arm's outbound lane to join the
  // inbound lane. Their stop line keeps the bonnet out of that lane until it is clear.
  const SIDE_STOP = (() => {
    let s = 0
    for (; s < sideIn.len; s += 0.25) { const p = sidePoint(SIDE_LEN - s, false); if (p.z < ROAD_HALF + 0.5 && p.x > 26) break }
    return s // sideIn distance where the outbound lane's kerb is reached
  })()
  // Cars on the arm stop short of where a side-road car sweeps round the corner (out lane at x≈29.4, in lane at x≈30.6).
  const OUT_LINE = 29.4, IN_LINE = 30.6
  const sideJoinClear = (self: Car) => cars.every((o) => {
    if (o === self || o.gone > 0) return true
    const L = o.leg
    if (L === outLegs[0]![0]! || L === outLegs[0]![1]!) return o.px + o.len / 2 < OUT_LINE - 10 || o.px - o.len / 2 > 31.6 + 1.0
    if (L.kind === 'ring' && L.to === 0) return L.len - o.s > 14
    if (L === inLegs[0]![0]!) return o.px + o.len / 2 < 24.5
    if (L === inLegs[0]![1]!) return false // no room to merge yet; never stop across the arm
    if (L === uLegs[0]!) return L.len - o.s > 4
    return true
  })
  /** A side-road car has passed its stop line and is crossing the arm: arm traffic waits for it. */
  // (A car merely waiting at its stop line is not crossing: counting it made it and the arm wait for each other.)
  const sideCrossing = (self: Car) => cars.some((o) => {
    if (o === self || o.gone > 0 || o.leg !== sideIn) return false
    const nose = o.s + o.len / 2
    return nose >= SIDE_STOP - 0.12 || (nose >= SIDE_STOP - 0.5 && o.v > 0.5)
  })
  const armGap = (c: Car): number => {
    const L = c.leg
    if (L === outLegs[0]![0]! || L === outLegs[0]![1]!) { const nose = c.px + c.len / 2; return nose < OUT_LINE + 0.2 ? OUT_LINE - nose : Infinity }
    // Wait on the ring before the mouth (not in it, where entering cars swing past, and not half out of it).
    if (L.kind === 'ring' && L.to === 0) { const g = L.len - c.s - 6.5; return g > -0.3 ? g : Infinity }
    if (L === inLegs[0]![0]!) { const nose = c.px - c.len / 2; return nose > IN_LINE - 0.2 ? nose - IN_LINE : Infinity }
    if (L === uLegs[0]!) return L.len - c.s + (33 - IN_LINE) - c.len / 2
    return Infinity
  }
  /** Is the ring busy just upstream of where arm `a` enters it? (ring traffic flows with angle decreasing) */
  const ringBusy = (self: Car, a: number) => {
    const entry = ringLegs[a]![(a + 1) % 4]!
    const ex = entry.xs[0]!, ez = entry.zs[0]!
    const ta = Math.atan2(ez, ex)
    for (const o of cars) {
      if (o === self || o.gone > 0) continue
      // A car leaving by this same arm turns off before it reaches the entry, so it never crosses an entering car.
      // (Waiting for it could lock the arm: it may itself be queued behind this arm's traffic.)
      // Exception: one about to swing out through the mouth (or stopped in it), where its body sweeps past the entry.
      if (o.leg.kind === 'ring' && o.leg.to === a) { const left = o.leg.len - o.s; if ((left < 6 && o.hold < 4) || (left < 12 && o.v > 0.3)) return true; continue }
      // Only cars on the ring itself: one that has already turned off onto an arm (even one queued just
      // outside the ring) is not coming round, and counting it made the entry wait for nothing.
      if (o.leg.kind !== 'ring') continue
      const r = Math.hypot(o.px, o.pz)
      if (r > 21.5) continue
      let d = Math.atan2(o.pz, o.px) - ta
      while (d < 0) d += Math.PI * 2
      while (d > Math.PI * 2) d -= Math.PI * 2
      // Upstream and about to pass, or just past the entry (still in the merge): either way, not yet.
      if (d < 0.95 || d > Math.PI * 2 - 0.42 || (Math.hypot(o.px - ex, o.pz - ez) < 5.5 && o.leg.kind === 'ring')) return true
    }
    return false
  }

  /** A ring car right at arm `a`'s entry point (used once a car is already over the give-way line). */
  const ringAt = (self: Car, a: number) => {
    const entry = ringLegs[a]![(a + 1) % 4]!
    const ex = entry.xs[0]!, ez = entry.zs[0]!
    return cars.some((o) => o !== self && o.gone <= 0 && o.leg.kind === 'ring' && o.leg.to !== a && Math.hypot(o.px - ex, o.pz - ez) < 4.5)
  }
  const arrive = (c: Car, focus: { x: number; z: number }) => {
    const L = c.leg
    switch (L.kind) {
      case 'out':
        if (L.arm === 0 && L.part === 0) {
          const sideClear = cars.every((o) => o === c || o.leg !== sideOut || o.s > 9)
          if (Math.random() < 0.5 && sideClear) {
            // Park only where nobody else is parked or heading to park (some houses are just 4 m apart).
            const free = PARK_STOPS.filter((st) => cars.every((o) => o === c || o.gone > 0 || !(o.leg === sideOut || o.leg.kind === 'sideU') || Math.abs(o.goal - st.s) > 7.5))
            c.goal = Math.random() < 0.5 || !free.length ? SIDE_LEN : free[Math.floor(Math.random() * free.length)]!.s
            setLeg(c, sideOut)
          } else setLeg(c, outLegs[0]![1]!)
        } else {
          setLeg(c, uLegs[L.arm]!)
          c.s = 0
        }
        return
      case 'u': setLeg(c, firstIn(L.arm)); return
      case 'in':
        if (L.arm === 0 && L.part === 0) { setLeg(c, inLegs[0]![1]!); return }
        if (ringAt(c, L.arm)) { c.s = L.len; c.v = 0; return }
        {
          const pick = [1, 2, 3].map((k) => (L.arm + k) % 4)
          const to = pick[Math.floor(Math.random() * pick.length)]!
          setLeg(c, ringLegs[L.arm]![to]!)
        }
        return
      case 'ring': setLeg(c, firstOut(L.to)); return
      case 'sideOut':
        if (c.goal < SIDE_LEN - 1) { c.wait = 8 + Math.random() * 12; setLeg(c, sideU(c.goal)); return }
        if (Math.hypot(c.x - focus.x, c.z - focus.z) > HIDE) { c.gone = 6 + Math.random() * 14; return }
        if (!uturnClear(c, SIDE_LEN - 4)) { c.s = L.len; c.v = 0; return }
        setLeg(c, sideU(SIDE_LEN - 4))
        c.goal = SIDE_LEN - 4
        return
      case 'sideU': setLeg(c, sideIn, SIDE_LEN - c.goal); return
      case 'sideIn': setLeg(c, inLegs[0]![1]!); return
    }
  }

  /** Would moving `step` forward bring this car's nose within touching distance of another car's body? */
  const bumps = (c: Car, fx: number, fz: number, step: number) => {
    const nx = c.px + fx * c.len / 2, nz = c.pz + fz * c.len / 2
    for (const o of cars) {
      if (o === c || o.gone > 0) continue
      const ox = Math.sin(o.h), oz = Math.cos(o.h), half = o.len / 2 - 0.35
      const gap = (x: number, z: number) => {
        const t = Math.max(-half, Math.min(half, (x - o.px) * ox + (z - o.pz) * oz))
        return Math.hypot(x - (o.px + ox * t), z - (o.pz + oz * t))
      }
      const after = gap(nx + fx * step, nz + fz * step)
      if (after < 1.25 && after < gap(nx, nz)) return true
    }
    return false
  }
  const obstacles: Obstacle[] = []
  const blockers: number[][] = cars.map(() => [])
  const followers: Array<Array<[number, number]>> = cars.map(() => []) // [car id, road distance] ahead on the same route
  let first = true
  return {
    tick(dt, time, focus, people = []) {
      void time
      dt = Math.min(dt, 0.1)
      obstacles.length = 0
      if (first) { for (const c of cars) { pose(c); c.px = c.x; c.pz = c.z } first = false }
      // Pass 1: who is in front of whom (from last frame's poses).
      for (const c of cars) {
        const list = blockers[c.id]!
        const road = followers[c.id]!
        list.length = 0
        road.length = 0
        if (c.gone > 0) continue
        const fx = Math.sin(c.h), fz = Math.cos(c.h)
        for (const o of cars) {
          if (o === c || o.gone > 0) continue
          if (o.wait > 0 && o.park > 0.9) continue // parked on the kerb, out of the lane (still a car in the lane while pulling in)
          const along = pathAhead(c, o)
          if (along >= 0 && along < 22) { road.push([o.id, along]); continue }
          const rx = o.px - c.px, rz = o.pz - c.pz
          const ahead = rx * fx + rz * fz
          if (ahead <= 0 || ahead > 16) continue
          const lat = Math.abs(rx * fz - rz * fx)
          // Oncoming car passing in the other lane: braking can't help and only causes stand-offs at junctions.
          if (Math.sin(o.h) * fx + Math.cos(o.h) * fz < -0.3 && lat > 1.9) continue
          // Leaving the ring: a car waiting to enter from the same arm is in the other lane and gives way to us.
          if (c.leg.kind === 'ring' && (o.leg === inLegs[c.leg.to]![0]! || o.leg === inLegs[c.leg.to]![1]!) && o.v < 0.5) continue
          // Wider when close, so a car crossing or merging at a junction counts too, not only one dead ahead.
          if (lat < (ahead < 7 ? 2.4 : 1.75)) list.push(o.id)
        }
      }
      for (const c of cars) {
        if (c.gone > 0) {
          c.gone -= dt
          if (c.gone <= 0) {
            const edge = sidePoint(SIDE_LEN, false)
            const clear = cars.every((o) => o === c || o.gone > 0 || o.leg !== sideIn || o.s > 9)
            if (Math.hypot(edge.x - focus.x, edge.z - focus.z) < HIDE || !clear) c.gone = 1
            else { setLeg(c, sideIn, 0); c.v = c.cruise * 0.6; c.goal = 0; pose(c); c.px = c.x; c.pz = c.z }
          }
          fleet.set(c.id, 0, 0, 0, 0, false)
          continue
        }
        if (c.wait > 0) {
          // Parked by the kerb: ease onto the shoulder, rest, ease back out.
          c.wait -= dt
          // About to pull out across the road: wait for a gap in the other lane.
          if (c.wait <= 0 && c.leg.kind === 'sideU' && !uturnClear(c, c.goal)) c.wait = 0.5
          c.park = Math.min(1, c.park + dt / 1.5)
          c.v = 0
        }
        let target = c.wait > 0 ? 0 : c.leg.kind === 'u' || c.leg.kind === 'sideU' ? 2.8 : c.leg.kind === 'ring' ? 4.8 : c.cruise
        const fx = Math.sin(c.h), fz = Math.cos(c.h)
        // Keep distance: brake for any car in the lane ahead. When two cars each see the other (merging or crossing
        // at a junction), the one further back yields and the one already in front carries on.
        if (c.creep > 0) c.creep -= dt
        else for (const id of blockers[c.id]!) {
          const o = cars[id]!
          const ahead = (o.px - c.px) * fx + (o.pz - c.pz) * fz
          if (blockers[id]!.includes(c.id)) {
            const back = (c.px - o.px) * Math.sin(o.h) + (c.pz - o.pz) * Math.cos(o.h)
            if (back > ahead + 0.3 || (Math.abs(back - ahead) <= 0.3 && c.id < id)) continue
          }
          const need = (c.len + o.len) / 2 + 1.4
          target = Math.min(target, Math.max(0, (ahead - need) * 1.3))
        }
        // Same route (queue round a bend, merge): keep a car-length-plus gap measured along the road.
        for (const [id, along] of followers[c.id]!) {
          const o = cars[id]!
          // Extra room on the tight U-turns, where bodies swing wider than the centre line suggests.
          const bend = c.leg.kind === 'u' || o.leg.kind === 'u' || c.leg.kind === 'sideU' || o.leg.kind === 'sideU' ? 1.2
            // Leaving the ring: wait on the circle until there is room to drive right out, not half-way through the mouth.
            : c.leg.kind === 'ring' && o.leg.kind === 'out' ? 5.5 : 0.4
          target = Math.min(target, Math.max(0, (along - (c.len + o.len) / 2 - 1.4 - bend) * 1.3))
        }
        // Pulling over at a house: brake to the stop instead of halting from full speed.
        if (c.leg === sideOut && c.goal < SIDE_LEN - 1) target = Math.min(target, 1.2 + Math.max(0, outS(c.goal) - c.s) * 0.9)
        // People and the player: slow when close in front, stop short of them.
        const yieldTo = (x: number, z: number) => {
          const rx = x - c.px, rz = z - c.pz
          const ahead = rx * fx + rz * fz
          if (ahead <= 0 || ahead > 10) return
          if (Math.abs(rx * fz - rz * fx) > 1.7) return
          target = Math.min(target, Math.max(0, (ahead - c.len / 2 - 1.6) * 1.1))
        }
        yieldTo(focus.x, focus.z)
        for (const p of people) if (p.kind === 'circle') yieldTo(p.x, p.z)
        // Give way before the ring.
        // The stop line sits so the bonnet stays out of the ring lane (it used to poke into passing ring cars).
        {
          const d = toRing(c), line = Math.max(0.4, c.len / 2 - 0.4)
          // Approach the give-way line like a yield sign (slow enough to stop on it), and once past it, go.
          if (d < 12 && d > line - 0.3) {
            target = Math.min(target, 2.6 + Math.max(0, d - line) * 1.1)
            if (ringBusy(c, c.leg.arm)) target = Math.min(target, Math.max(0, (d - line) * 1.2))
          }
          // Side road → arm: give way to the outbound lane before nosing across it.
          if (c.leg === sideIn) {
            const nose = c.s + c.len / 2, line = SIDE_STOP - 0.6
            if (nose < line + 0.2 && line - nose < 10 && !sideJoinClear(c)) target = Math.min(target, Math.max(0, (line - nose) * 1.2))
          } else {
            const g = armGap(c)
            if (g < 12 && sideCrossing(c)) target = Math.min(target, Math.max(0, g * 1.2))
          }
        }
        // Stuck behind something that is itself stopped for a long time: creep past (gridlock breaker).
        c.hold = c.v < 0.05 && c.wait <= 0 ? c.hold + dt : 0
        if (c.hold > 9 && (blockers[c.id]!.length || followers[c.id]!.length)) { c.creep = 1.6; c.hold = 0 }
        // Truly wedged (two noses at a merge) and out of the player's sight: lift it out; it drives back in later.
        if (c.hold > 14 && Math.hypot(c.px - focus.x, c.pz - focus.z) > 30) { c.hold = 0; c.gone = 4 + Math.random() * 6; fleet.set(c.id, 0, 0, 0, 0, false); continue }
        if (target < c.v) c.v = Math.max(target, c.v - 8 * dt)
        else c.v = Math.min(target, c.v + 2.6 * dt)
        // Last check, whatever the rules above decided (gridlock creep included): never nose into another car's body.
        if (c.v > 0 && c.wait <= 0 && bumps(c, fx, fz, c.v * dt)) c.v = 0
        const before = c.s
        if (c.wait <= 0) {
          c.s += c.v * dt
          // A car heading to park stops at its house (it used to drive on to the end of the road and reappear at the house).
          if (c.leg === sideOut && c.goal < SIDE_LEN - 1 && c.s >= outS(c.goal)) { arrive(c, focus); c.s = 0 }
          else if (c.s >= c.leg.len) { const over = c.s - c.leg.len; const was = c.leg; arrive(c, focus); if (c.leg !== was) c.s = Math.min(c.leg.len, c.s + over) }
        }
        if (c.gone > 0) { fleet.set(c.id, 0, 0, 0, 0, false); continue }
        pose(c)
        if ((c.park > 0 || c.wait > 0) && c.leg.kind === 'sideU') {
          // Parked: sit square to the kerb; only start turning as the car pulls back out.
          const lh = sidePoint(c.goal, true).heading
          let dh = c.h - lh
          while (dh > Math.PI) dh -= Math.PI * 2
          while (dh < -Math.PI) dh += Math.PI * 2
          c.h = lh + dh * (1 - c.park)
        }
        let x = c.x, z = c.z
        if (c.wait <= 0 && c.park > 0) c.park = Math.max(0, c.park - dt / 1.5)
        if (c.park > 0) {
          const off = 2.3 * (c.park * c.park * (3 - 2 * c.park)) // well onto the kerb, clear of passing cars
          x += -Math.cos(c.h) * off
          z += Math.sin(c.h) * off
        }
        const hit = insideFootprint(x, z, 1.3)
        if (hit) {
          // Never inside a wall: push straight out of the nearest face.
          const ox = hit.w / 2 + 1.3 - Math.abs(x - hit.x), oz = hit.d / 2 + 1.3 - Math.abs(z - hit.z)
          if (ox < oz) x += Math.sign(x - hit.x || 1) * ox
          else z += Math.sign(z - hit.z || 1) * oz
        }
        c.px = x; c.pz = z
        fleet.set(c.id, x, z, c.h, Math.max(0, c.s - before), true)
        obstacles.push({ kind: 'circle', x: x + fx * c.len * 0.25, z: z + fz * c.len * 0.25, r: 1.05 })
        obstacles.push({ kind: 'circle', x: x - fx * c.len * 0.25, z: z - fz * c.len * 0.25, r: 1.05 })
      }
      fleet.commit()
      return obstacles
    },
    debug: () => cars.map((c) => ({ blk: blockers[c.id]!.slice(), fol: followers[c.id]!.map((f) => f[0]), hold: +c.hold.toFixed(1), wait: +c.wait.toFixed(1), id: c.id, leg: `${c.leg.kind}${c.leg.arm}${c.leg.kind === 'ring' ? '>' + c.leg.to : ''}${c.leg.part ? 'b' : ''}`, s: +c.s.toFixed(2), v: +c.v.toFixed(2), x: c.px, z: c.pz, h: c.h, len: c.len, on: c.gone <= 0 })),
  }
}
