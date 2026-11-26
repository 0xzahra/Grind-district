// At the wheel: Gas, Brake and Horn keys beside the steering stick, and auto-drive. In your own car, pick a place
// on the map and the car drives itself there: a route is found around the buildings on a 1 m grid (A*), then a
// gentle autopilot follows it (it looks ahead along the route, slows for bends and stops at the door). The stick,
// a pedal or the Stop key hands the wheel straight back. Nothing here touches the save.
import type { Obstacle } from './physics.ts'
import { RING_IN, RING_OUT, RING_R, ROAD_HALF, ROAD_END, SIDE } from './lanes.ts'

export type P = { x: number; z: number }
export type DriveCar = { x: number; z: number; heading: number; speed: number }

// ---------------------------------------------------------------- route finding (pure, tested)

const segDist = (p: P, a: P, b: P) => { const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1; const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / L2)); return { d: Math.hypot(a.x + vx * t - p.x, a.z + vz * t - p.z), x: a.x + vx * t, z: a.z + vz * t } }
/** Is this point on the city's roads: the plaza ring, the four arms, or the side road past the houses? */
export function onRoad(x: number, z: number, pad = 0.6): boolean {
  const r = Math.hypot(x, z)
  if (r >= RING_IN - pad && r <= RING_OUT + pad) return true
  if (Math.abs(z) <= ROAD_HALF + pad && Math.abs(x) >= RING_IN - pad && Math.abs(x) <= ROAD_END) return true
  if (Math.abs(x) <= ROAD_HALF + pad && Math.abs(z) >= RING_IN - pad && Math.abs(z) <= ROAD_END) return true
  for (let i = 1; i < SIDE.length; i++) if (segDist({ x, z }, SIDE[i - 1]!, SIDE[i]!).d <= ROAD_HALF + pad) return true
  return false
}
/** The nearest point on a road (the kerb a cab pulls up at). */
export function nearestRoad(p: P): P {
  const cands: P[] = []
  const r = Math.hypot(p.x, p.z) || 1
  cands.push({ x: (p.x / r) * RING_R, z: (p.z / r) * RING_R })
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) cands.push(segDist(p, { x: ax * RING_R, z: az * RING_R }, { x: ax * (ROAD_END - 2), z: az * (ROAD_END - 2) }))
  for (let i = 1; i < SIDE.length; i++) cands.push(segDist(p, SIDE[i - 1]!, SIDE[i]!))
  let best = cands[0]!, bd = Infinity
  for (const c of cands) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = { x: c.x, z: c.z } } }
  return best
}

const CELL = 1
/** A route from `from` to `to` that keeps `clear` metres from every obstacle, inside ±limit; null if none. */
/** Off-road ground costs this much more, so cars keep to the streets wherever the streets go. */
const OFF_ROAD = 3
export function planRoute(from: P, to: P, obstacles: readonly Obstacle[], limit: number, clear = 1.5, roads = true): P[] | null {
  const n = Math.floor((limit * 2) / CELL) + 1
  const idx = (gx: number, gz: number) => gz * n + gx
  const toG = (v: number) => Math.max(0, Math.min(n - 1, Math.round((v + limit) / CELL)))
  const toW = (g: number) => g * CELL - limit
  const blocked = new Uint8Array(n * n)
  const weight = new Float32Array(n * n).fill(1)
  if (roads) for (let gz = 0; gz < n; gz++) for (let gx = 0; gx < n; gx++) if (!onRoad(toW(gx), toW(gz))) weight[idx(gx, gz)] = OFF_ROAD
  for (const o of obstacles) {
    const hx = o.kind === 'circle' ? o.r : o.hx, hz = o.kind === 'circle' ? o.r : o.hz
    const x0 = toG(o.x - hx - clear), x1 = toG(o.x + hx + clear), z0 = toG(o.z - hz - clear), z1 = toG(o.z + hz + clear)
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
      const wx = toW(gx), wz = toW(gz)
      if (o.kind === 'circle') { if (Math.hypot(wx - o.x, wz - o.z) <= o.r + clear) blocked[idx(gx, gz)] = 1 }
      else {
        const dx = Math.max(0, Math.abs(wx - o.x) - o.hx), dz = Math.max(0, Math.abs(wz - o.z) - o.hz)
        if (Math.hypot(dx, dz) <= clear) blocked[idx(gx, gz)] = 1
      }
    }
  }
  // Start and goal in the nearest free cell (the car itself, or a door, can sit inside a padded obstacle).
  const nearestFree = (gx: number, gz: number): number => {
    if (!blocked[idx(gx, gz)]) return idx(gx, gz)
    for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
      const x = gx + dx, z = gz + dz
      if (x >= 0 && z >= 0 && x < n && z < n && !blocked[idx(x, z)]) return idx(x, z)
    }
    return -1
  }
  const s = nearestFree(toG(from.x), toG(from.z)), g = nearestFree(toG(to.x), toG(to.z))
  if (s < 0 || g < 0) return null
  const gx = g % n, gz = Math.floor(g / n)
  const cost = new Float32Array(n * n).fill(Infinity), came = new Int32Array(n * n).fill(-1)
  // A small binary min-heap of cells keyed by f.
  const hf: number[] = [], hc: number[] = []
  const swap = (i: number, j: number) => { const f = hf[i]!; hf[i] = hf[j]!; hf[j] = f; const c = hc[i]!; hc[i] = hc[j]!; hc[j] = c }
  const push = (f: number, c: number) => { hf.push(f); hc.push(c); let i = hf.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p]! <= hf[i]!) break; swap(i, p); i = p } }
  const pop = (): number => {
    const top = hc[0]!
    const lf = hf.pop()!, lc = hc.pop()!
    if (hf.length) {
      hf[0] = lf; hc[0] = lc
      let i = 0
      for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hf.length && hf[l]! < hf[m]!) m = l; if (r < hf.length && hf[r]! < hf[m]!) m = r; if (m === i) break; swap(i, m); i = m }
    }
    return top
  }
  const h = (c: number) => { const x = c % n, z = Math.floor(c / n); const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) }
  cost[s] = 0; push(h(s), s)
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]] as const
  let found = false, guard = 0
  while (hf.length && guard++ < n * n * 4) {
    const c = pop()
    if (c === g) { found = true; break }
    const cx = c % n, cz = Math.floor(c / n)
    for (const [dx, dz, w] of D) {
      const x = cx + dx, z = cz + dz
      if (x < 0 || z < 0 || x >= n || z >= n) continue
      const k = idx(x, z)
      if (blocked[k]) continue
      if (dx && dz && (blocked[idx(cx + dx, cz)] || blocked[idx(cx, cz + dz)])) continue // no corner cutting
      const nc = cost[c]! + w * weight[k]!
      if (nc < cost[k]!) { cost[k] = nc; came[k] = c; push(nc + h(k), k) }
    }
  }
  if (!found) return null
  const cells: number[] = []
  for (let c = g; c >= 0; c = came[c]!) { cells.push(c); if (c === s) break }
  cells.reverse()
  // Straighten: jump ahead to the furthest point the straight line reaches without hitting anything and without
  // costing more than the route it replaces (so a shortcut never swaps a street for a crowded square).
  const lineCost = (a: number, b: number): number => {
    const ax = a % n, az = Math.floor(a / n), bx = b % n, bz = Math.floor(b / n)
    const len = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(len * 2))
    let c = 0
    for (let i = 0; i < steps; i++) {
      const x = Math.round(ax + ((bx - ax) * (i + 0.5)) / steps), z = Math.round(az + ((bz - az) * (i + 0.5)) / steps)
      if (blocked[idx(x, z)]) return Infinity
      c += weight[idx(x, z)]! * (len / steps)
    }
    return c
  }
  const kept = [cells[0]!]
  let i = 0
  while (i < cells.length - 1) {
    let j = cells.length - 1
    while (j > i + 1 && lineCost(cells[i]!, cells[j]!) > (cost[cells[j]!]! - cost[cells[i]!]!) * 1.04 + 0.5) j--
    kept.push(cells[j]!); i = j
  }
  const pts = kept.map((c) => ({ x: toW(c % n), z: toW(Math.floor(c / n)) }))
  pts[pts.length - 1] = { ...to }
  return pts
}

/** Stick input that follows a route: steer to a point a little ahead, ease off for bends, stop at the end. */
export function followRoute(path: P[], car: DriveCar, top: number, cap = 9): { x: number; y: number; done: boolean; left: number } {
  // Nearest segment, then a look-ahead point further along the route.
  let best = 0, bestD = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!, b = path[i + 1]!
    const vx = b.x - a.x, vz = b.z - a.z, L2 = vx * vx + vz * vz || 1
    const t = Math.max(0, Math.min(1, ((car.x - a.x) * vx + (car.z - a.z) * vz) / L2))
    const d = Math.hypot(a.x + vx * t - car.x, a.z + vz * t - car.z)
    if (d < bestD) { bestD = d; best = i }
  }
  const end = path[path.length - 1]!
  // Distance still to drive: to the route, then along the rest of it.
  let left = 0, lx = car.x, lz = car.z
  for (let i = best + 1; i < path.length; i++) { left += Math.hypot(path[i]!.x - lx, path[i]!.z - lz); lx = path[i]!.x; lz = path[i]!.z }
  const look = Math.max(3.5, Math.abs(car.speed) * 0.9)
  let target = end, acc = 0
  let px = car.x, pz = car.z
  for (let i = best + 1; i < path.length; i++) {
    const q = path[i]!, seg = Math.hypot(q.x - px, q.z - pz)
    if (acc + seg >= look) { const f = (look - acc) / (seg || 1); target = { x: px + (q.x - px) * f, z: pz + (q.z - pz) * f }; break }
    acc += seg; px = q.x; pz = q.z; target = q
  }
  if (left < 2.2) return { x: 0, y: car.speed > 0.3 ? -1 : 0, done: Math.abs(car.speed) < 0.3, left }
  const want = Math.atan2(target.x - car.x, target.z - car.z)
  let err = want - car.heading
  while (err > Math.PI) err -= Math.PI * 2
  while (err < -Math.PI) err += Math.PI * 2
  // The car's heading falls as the steer input rises (ride.ts), so steer against the error.
  const x = Math.max(-1, Math.min(1, -err * 2.4))
  const cruise = Math.min(top * 0.62, cap) * (1 - Math.min(0.7, Math.abs(err) * 0.9))
  const vGoal = Math.max(2.2, Math.min(cruise, left * 0.7))
  const y = car.speed < vGoal - 0.4 ? Math.min(1, 0.35 + (vGoal - car.speed) * 0.25) : car.speed > vGoal + 1.2 ? -0.5 : 0.12
  return { x, y, done: false, left }
}

/** Metres of free road in front of the car's bumper before the nearest car or person in its lane (Infinity if clear). */
export function gapAhead(car: DriveCar, blockers: readonly Obstacle[]): number {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading)
  let best = Infinity
  for (const b of blockers) {
    if (b.kind !== 'circle') continue
    const rx = b.x - car.x, rz = b.z - car.z
    const ahead = rx * fx + rz * fz
    if (ahead <= 0 || ahead > 18) continue
    if (Math.abs(rx * fz - rz * fx) > 1.05 + b.r) continue
    best = Math.min(best, ahead - b.r - 2.4)
  }
  return best
}

// ---------------------------------------------------------------- pedals, horn and the auto-drive chip

let horn: { ctx: AudioContext; gain: GainNode } | null = null
function hornOn(on: boolean): void {
  try {
    if (!horn) {
      const ctx = new AudioContext(), gain = ctx.createGain(); gain.gain.value = 0
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800
      for (const f of [349, 440]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start() }
      lp.connect(gain).connect(ctx.destination)
      horn = { ctx, gain }
    }
    void horn.ctx.resume().catch(() => undefined)
    const t = horn.ctx.currentTime
    horn.gain.gain.cancelScheduledValues(t)
    horn.gain.gain.setTargetAtTime(on ? 0.16 : 0, t, on ? 0.01 : 0.04)
  } catch { /* no sound */ }
}

export type DriveUi = {
  /** Merge the pedals and the autopilot into this frame's stick input. */
  input(stick: { x: number; y: number }, car: DriveCar, top: number, dt: number): { x: number; y: number }
  /** Start driving to a place; false when no route was found (the caller travels the usual way). */
  autoTo(title: string, to: P, from: P, obstacles: readonly Obstacle[], limit: number, cab?: { label: string; stop: () => void }): boolean
  stopAuto(): void
  readonly auto: boolean
  /** Riding in a cab: the driver drives, the stick and pedals rest, and the pedals are not shown. */
  readonly passenger: boolean
  show(on: boolean): void
}

export function createDriveUi(toast: (m: string) => void, arrived: (title: string, cab: boolean) => void, o: {
  /** People, stalls and cars where they are now: a re-plan routes round them too. */
  blockers?: () => readonly Obstacle[]
  /** No way through after a few tries: a cab finishes the trip the quick way; your own car hands back the wheel. */
  stuck?: (title: string, cab: boolean) => void
} = {}): DriveUi {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e }
  const pedals = el('div', '', 'drive-pedals'); pedals.id = 'drive-pedals'; pedals.hidden = true
  const held = { gas: false, brake: false }
  const pedal = (label: string, cls: string, aria: string, down: () => void, up: () => void) => {
    const b = el('button', label, `drive-key ${cls}`); b.type = 'button'; b.setAttribute('aria-label', aria)
    const on = (e: Event) => { e.preventDefault(); b.classList.add('on'); down() }
    const off = () => { b.classList.remove('on'); up() }
    b.addEventListener('pointerdown', (e) => { b.setPointerCapture?.((e as PointerEvent).pointerId); on(e) })
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off)
    b.addEventListener('contextmenu', (e) => e.preventDefault())
    return b
  }
  const hornKey = pedal('Horn', 'drive-horn', 'Horn', () => hornOn(true), () => hornOn(false))
  const brakeKey = pedal('Brake', 'drive-brake', 'Brake (hold to reverse)', () => { held.brake = true; stopAutoBy('you braked') }, () => { held.brake = false })
  const gasKey = pedal('Gas', 'drive-gas', 'Gas', () => { held.gas = true; stopAutoBy('you took the wheel') }, () => { held.gas = false })
  pedals.append(hornKey, brakeKey, gasKey)
  const chip = el('div', '', 'auto-drive'); chip.id = 'auto-drive'; chip.hidden = true; chip.setAttribute('role', 'status')
  const chipText = el('span'), stop = el('button', 'Stop', 'auto-stop'); stop.type = 'button'
  chip.append(chipText, stop)
  document.body.append(pedals, chip)
  // Keyboard: Space brakes, H sounds the horn (W/S and the arrows still drive).
  window.addEventListener('keydown', (e) => {
    if (pedals.hidden || (e.target as HTMLElement | null)?.closest?.('input, textarea')) return
    if (e.code === 'KeyH' && !e.repeat) hornOn(true)
    if (e.code === 'Space') { held.brake = true; e.preventDefault() }
  })
  window.addEventListener('keyup', (e) => { if (e.code === 'KeyH') hornOn(false); if (e.code === 'Space') held.brake = false })

  let route: P[] | null = null, title = '', stuckT = 0, backT = 0, queued = 0
  let cab: { label: string; stop: () => void } | null = null
  // Progress watch: the distance left must keep falling. If it has not for 4 s, plan again from here (round
  // whatever is in the way now); after three tries, give up gracefully.
  let dest: P = { x: 0, z: 0 }, statics: readonly Obstacle[] = [], lim = 60, bestLeft = Infinity, sinceBest = 0, replans = 0
  const setChip = (left: number) => { chipText.textContent = `${cab ? cab.label : 'Auto-drive'} to ${title} · ${Math.max(0, Math.round(left))} m` }
  const stopAuto = () => { route = null; chip.hidden = true; cab = null; stop.textContent = 'Stop' }
  const stopAutoBy = (why: string) => { if (route && !cab) { stopAuto(); toast(`Auto-drive off: ${why}.`) } }
  stop.onclick = () => { if (cab) { const c = cab; stopAuto(); c.stop(); return } stopAuto(); toast('Auto-drive stopped. The wheel is yours.') }
  return {
    get auto() { return !!route },
    get passenger() { return !!cab },
    show(on) { pedals.hidden = !on || !!cab; if (!on) { held.gas = held.brake = false; hornOn(false) } },
    stopAuto,
    autoTo(t, to, from, obstacles, limit, asCab) {
      const path = planRoute(from, to, obstacles, limit)
      if (!path || path.length < 2) return false
      route = path; title = t; stuckT = 0; backT = 0; queued = 0
      dest = { ...to }; statics = obstacles; lim = limit; bestLeft = Infinity; sinceBest = 0; replans = 0
      cab = asCab ?? null
      stop.textContent = cab ? 'Stop here' : 'Stop'
      pedals.hidden = pedals.hidden || !!cab
      setChip(Math.hypot(to.x - from.x, to.z - from.z)); chip.hidden = false
      if (!cab) toast(`Auto-drive to ${t}. Touch the stick or a pedal to take the wheel.`)
      return true
    },
    input(stick, car, top, dt) {
      // The player's own hands win: the stick (or a pedal) turns auto-drive off. In a cab the driver drives.
      if (route && !cab && Math.hypot(stick.x, stick.y) > 0.3) stopAutoBy('you took the wheel')
      if (route) {
        if (backT > 0) { backT -= dt; return { x: 0, y: -1 } }
        // A cab keeps to city speed (about 45 km/h on the straights); your own car on auto-drive a little gentler.
        const r = followRoute(route, car, top, cab ? 12.5 : 9)
        setChip(r.left)
        // Traffic ahead: slow and wait behind it like a driver would, never into it. Waiting in a queue is not
        // being stuck, so it does not count towards a new route until it has lasted a while.
        const gap = gapAhead(car, o.blockers?.() ?? [])
        if (gap < 14 && !r.done) {
          const cap = Math.max(0, (gap - 1.2) * 0.85)
          if (car.speed >= cap - 0.2 && queued < 9) {
            queued += dt; bestLeft = Math.min(bestLeft, r.left); sinceBest = 0; stuckT = 0
            return { x: r.x, y: car.speed > cap + 1.5 ? -1 : car.speed > cap ? -0.4 : 0 }
          }
        } else queued = 0
        if (r.left < bestLeft - 0.8) { bestLeft = r.left; sinceBest = 0 } else sinceBest += dt
        if (sinceBest > 4 && !r.done) {
          sinceBest = 0; bestLeft = Infinity; replans += 1
          const again = replans <= 3 ? planRoute({ x: car.x, z: car.z }, dest, [...statics, ...(o.blockers?.() ?? [])], lim) : null
          if (again && again.length >= 2) { route = again; backT = 0.6 }
          else { const t = title, wasCab = !!cab; stopAuto(); if (o.stuck) o.stuck(t, wasCab); else toast('Auto-drive could not find a way through. The wheel is yours.'); return { x: 0, y: 0 } }
        }
        // Held up (a car, a person, a kerb): back off a little and carry on.
        stuckT = Math.abs(car.speed) < 0.25 && !r.done ? stuckT + dt : 0
        if (stuckT > 2.5) { stuckT = 0; backT = 0.9 }
        if (r.done) { const t = title, wasCab = !!cab; stopAuto(); arrived(t, wasCab) }
        return { x: r.x, y: r.y }
      }
      if (cab) return { x: 0, y: 0 }
      let y = stick.y
      if (held.gas) y = Math.max(y, 1)
      if (held.brake) y = -1
      return { x: stick.x, y }
    },
  }
}
