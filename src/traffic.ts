import * as THREE from 'three'
import { ARMS, lanePoint, uturnPoint, sidePoint, ringRoute, insideFootprint, ROAD_HALF, SIDE_JOIN_T, SIDE_LEN, SIDE_STOPS } from './lanes.ts'
import type { Graphics } from './logic.ts'
import type { Obstacle } from './physics.ts'
import { carLength, createFleet, type CarKind } from './cars.ts'

/**
 * Ambient traffic. Every car follows a leg (a polyline): out along an arm, U-turn in the bay, back in,
 * round the plaza roundabout to another arm, or down the side road past the houses and out of town.
 * Cars accelerate and brake smoothly, keep their distance, give way at the ring and stop for people.
 */

type Lanes = { roadHalf: number; walk: number; inner: number; outer: number }
const COUNTS: Record<Graphics, number> = { low: 10, medium: 16, high: 22 }
const ORDER: CarKind[] = ['sedan', 'hatchback', 'suv', 'taxi', 'pickup', 'minibus', 'van', 'sports', 'suv', 'sedan', 'hatchback', 'taxi', 'van', 'sports', 'sedan', 'pickup']
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

export function createTraffic(scene: THREE.Scene, lanes: Lanes, graphics: Graphics): {
  tick: (dt: number, time: number, focus: { x: number; z: number }, people?: Obstacle[]) => Obstacle[]
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
  const fleet = createFleet(scene, kinds, { shadows: graphics !== 'low' })
  const cars: Car[] = []
  const laneFill = new Map<Leg, number>()
  kinds.forEach((kind, i) => {
    const a = i % 4
    const outbound = i % 2 === 0
    const legs = outbound ? outLegs[a]! : inLegs[a]!
    const leg = legs[legs.length - 1]!
    const used = laneFill.get(leg) ?? 0
    laneFill.set(leg, used + 1)
    const s = Math.min(leg.len - 1, 1.5 + used * 10)
    cars.push({ id: i, kind, len: carLength(kind), leg, s, seg: 0, v: 0, cruise: 6 + (i % 4) * 0.55, x: 0, z: 0, px: 0, pz: 0, h: 0, wait: 0, park: 0, goal: 0, gone: 0, hold: 0, creep: 0 })
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

  /** Is the ring busy just upstream of where arm `a` enters it? (ring traffic flows with angle decreasing) */
  const ringBusy = (self: Car, a: number) => {
    const entry = ringLegs[a]![(a + 1) % 4]!
    const ex = entry.xs[0]!, ez = entry.zs[0]!
    const ta = Math.atan2(ez, ex)
    for (const o of cars) {
      if (o === self || o.gone > 0) continue
      const r = Math.hypot(o.px, o.pz)
      if (r > 21.5) continue
      let d = Math.atan2(o.pz, o.px) - ta
      while (d < 0) d += Math.PI * 2
      while (d > Math.PI * 2) d -= Math.PI * 2
      if (d < 0.95 || (Math.hypot(o.px - ex, o.pz - ez) < 5.5 && o.leg.kind === 'ring')) return true
    }
    return false
  }

  const arrive = (c: Car, focus: { x: number; z: number }) => {
    const L = c.leg
    switch (L.kind) {
      case 'out':
        if (L.arm === 0 && L.part === 0) {
          const sideClear = cars.every((o) => o === c || o.leg !== sideOut || o.s > 9)
          if (Math.random() < 0.5 && sideClear) {
            c.goal = Math.random() < 0.5 ? SIDE_LEN : SIDE_STOPS[Math.floor(Math.random() * SIDE_STOPS.length)]!.s
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
        if (ringBusy(c, L.arm)) { c.s = L.len; c.v = 0; return }
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
        setLeg(c, sideU(SIDE_LEN - 4))
        c.goal = SIDE_LEN - 4
        return
      case 'sideU': setLeg(c, sideIn, SIDE_LEN - c.goal); return
      case 'sideIn': setLeg(c, inLegs[0]![1]!); return
    }
  }

  const obstacles: Obstacle[] = []
  const blockers: number[][] = cars.map(() => [])
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
        list.length = 0
        if (c.gone > 0) continue
        const fx = Math.sin(c.h), fz = Math.cos(c.h)
        for (const o of cars) {
          if (o === c || o.gone > 0) continue
          const rx = o.px - c.px, rz = o.pz - c.pz
          const ahead = rx * fx + rz * fz
          if (ahead <= 0 || ahead > 16) continue
          const lat = Math.abs(rx * fz - rz * fx)
          if (lat < 1.75) list.push(o.id)
        }
      }
      for (const c of cars) {
        if (c.gone > 0) {
          c.gone -= dt
          if (c.gone <= 0) {
            const edge = sidePoint(SIDE_LEN, false)
            const clear = cars.every((o) => o === c || o.leg !== sideIn || o.s > 9)
            if (Math.hypot(edge.x - focus.x, edge.z - focus.z) < HIDE || !clear) c.gone = 1
            else { setLeg(c, sideIn, 0); c.v = c.cruise * 0.6; c.goal = 0; pose(c) }
          }
          fleet.set(c.id, 0, 0, 0, 0, false)
          continue
        }
        if (c.wait > 0) {
          // Parked by the kerb: ease onto the shoulder, rest, ease back out.
          c.wait -= dt
          c.park = Math.min(1, c.park + dt / 1.5)
          c.v = 0
        }
        let target = c.wait > 0 ? 0 : c.leg.kind === 'u' || c.leg.kind === 'sideU' ? 2.8 : c.leg.kind === 'ring' ? 4.8 : c.cruise
        const fx = Math.sin(c.h), fz = Math.cos(c.h)
        // Keep distance: brake for any car in the lane ahead (mutual stand-offs: the lower id goes first).
        if (c.creep > 0) c.creep -= dt
        else for (const id of blockers[c.id]!) {
          const o = cars[id]!
          if (blockers[id]!.includes(c.id) && c.id < id) continue
          const ahead = (o.px - c.px) * fx + (o.pz - c.pz) * fz
          const need = (c.len + o.len) / 2 + 1.4
          target = Math.min(target, Math.max(0, (ahead - need) * 1.3))
        }
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
        if (c.leg.kind === 'in' && c.leg.part === 1 && c.leg.len - c.s < 9 && ringBusy(c, c.leg.arm)) target = Math.min(target, Math.max(0, (c.leg.len - c.s - 0.4) * 1.2))
        // Stuck behind something that is itself stopped for a long time: creep past (gridlock breaker).
        c.hold = c.v < 0.05 && c.wait <= 0 ? c.hold + dt : 0
        if (c.hold > 9 && blockers[c.id]!.length) { c.creep = 1.6; c.hold = 0 }
        if (target < c.v) c.v = Math.max(target, c.v - 8 * dt)
        else c.v = Math.min(target, c.v + 2.6 * dt)
        const before = c.s
        if (c.wait <= 0) {
          c.s += c.v * dt
          if (c.s >= c.leg.len) { const over = c.s - c.leg.len; const was = c.leg; arrive(c, focus); if (c.leg !== was) c.s = Math.min(c.leg.len, c.s + over) }
        }
        if (c.gone > 0) { fleet.set(c.id, 0, 0, 0, 0, false); continue }
        pose(c)
        let x = c.x, z = c.z
        if (c.wait <= 0 && c.park > 0) c.park = Math.max(0, c.park - dt / 1.5)
        if (c.park > 0) {
          const off = 2.0 * (c.park * c.park * (3 - 2 * c.park))
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
  }
}
