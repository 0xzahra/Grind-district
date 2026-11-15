// Driving and boating with one stick and one button.
// The stick does everything: push up to go, pull back to brake (hold it to reverse), left and right to steer.
// The gold action button says Get out (or Back to harbour). No pedals, no gears, no handbrake.
// Three modes: a free drive in the city (your own car, or a test drive from the dealership), a two-lap race on the
// Grind Raceway circuit against three rival drivers (gates to drive through, a gold arrow over the car, your place
// and time at the top, a ghost of your best run), and a cruise on the bay in a day cruiser, round buoys and a
// lighthouse. Lazy-loaded by main.ts on the first ride.
import * as THREE from 'three'
import { fineCar } from './finecars.ts'
import { resolveCollision, CITY_LIMIT, type Obstacle } from './physics.ts'
import { buildTrack, TRACK_W, RUNOFF, type Track } from './circuit.ts'
import { addReputation, getSave, slotKey } from './state.ts'
import { adjust } from './needs.ts'
import { KART, OWNED } from './race.ts'

type P = { x: number; z: number }
export type RideOpts = {
  kind: 'car' | 'boat'
  /** Dealership car id, 'kart' for the Raceway club car, or 'cruiser'. */
  model: string
  label: string
  mode: 'free' | 'race' | 'cruise'
  /** Handed back when you get out (test drives, the club car, the boat); your own car stays parked. */
  temp?: boolean
  at?: { x: number; z: number; heading: number }
}
export type Ride = ReturnType<typeof createRide>
type Input = { x: number; y: number } | null

// ---------------------------------------------------------------- routes

const RACE_LAPS = 2
// Seconds for two clean laps by the test driver (an autopilot that brakes for every bend, in the club car).
// Medals: gold within 4 %, silver within 12 %, bronze within 25 %.
const RACE_PAR = 61
const RIVALS = [
  { name: 'Kenji', skill: 0.93, lat: -1.3 },
  { name: 'Aisha', skill: 0.88, lat: 1.5 },
  { name: 'Diego', skill: 0.83, lat: 0 },
]

/** A grid slot on the Grind Raceway: k = 0 is pole, two by two behind the line. */
function gridSlot(t: Track, k: number) {
  const n = t.pts.length
  const back = 8 + k * 7
  const i = (t.start - back + n) % n
  const lat = k % 2 ? -2.6 : 2.6
  const p = t.pts[i]!, tg = t.tan[i]!
  return { x: p.x + tg.z * lat, z: p.z - tg.x * lat, heading: Math.atan2(tg.x, tg.z), back, lat }
}
/** Eight sector gates round the circuit; the last one is the finish line. The player starts at the back. */
function raceRoute() {
  const t = buildTrack()
  const n = t.pts.length
  const gates = Array.from({ length: 8 }, (_, k) => (t.start + Math.round(((k + 1) * n) / 8)) % n)
  gates[7] = t.start
  return { t, pts: t.pts, gates, start: gridSlot(t, RIVALS.length) }
}

/** The bay cruise: a loop of buoy gates out from the beach, round the lighthouse rock and back. */
const LIGHTHOUSE = { x: -58, z: -158, r: 11 }
const CRUISE_GATES: P[] = [{ x: 38, z: -140 }, { x: -2, z: -198 }, { x: -70, z: -210 }, { x: -112, z: -156 }, { x: -86, z: -110 }, { x: -22, z: -112 }, { x: 34, z: -100 }]
const CRUISE_START = { x: 44, z: -94, heading: Math.PI }
function cruiseRoute(): { pts: P[]; gates: number[] } {
  const ctrl = [CRUISE_START, ...CRUISE_GATES]
  const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal')
  const pts = curve.getSpacedPoints(400).map((v) => ({ x: v.x, z: v.z }))
  const gates = CRUISE_GATES.map((g) => { let best = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.hypot(p.x - g.x, p.z - g.z); if (d < bd) { bd = d; best = i } }); return best })
  return { pts, gates }
}

// ---------------------------------------------------------------- the boat

function cruiser(): THREE.Group {
  const g = new THREE.Group()
  const L = 8.8, B = 2.75, N = 44
  // Hull: cross-sections along the length (stern to bow), a deep V below the chine, flared topsides, a rising sheer.
  const rows = [0, 1, 2, 3, 4, 5, 6, 7, 8] // sheer, rub line, boot top, chine, keel, chine, boot, rub, sheer (port to starboard)
  const band = [0xf6f5f1, 0xf6f5f1, 0x14284a, 0x14284a, 0x14284a, 0x14284a, 0xf6f5f1, 0xf6f5f1] // face colour between rows k and k+1
  const section = (u: number) => {
    const half = Math.max(0.03, (B / 2) * (u < 0.5 ? 1 - 0.1 * ((0.5 - u) / 0.5) ** 2 : Math.cos(((u - 0.5) / 0.5) * (Math.PI / 2)) ** 0.85))
    const sheer = 1.12 + 0.42 * Math.max(0, u - 0.45) ** 2 * 3.3
    const keel = -0.55 + Math.max(0, (u - 0.72) / 0.28) ** 1.6 * 0.95
    const chineY = Math.min(sheer - 0.4, keel + 0.36 + 0.1 * u)
    const boot = Math.min(sheer - 0.25, 0.34)
    const rub = sheer - 0.1
    const p: Array<[number, number]> = [[-half, sheer], [-half * 0.995, rub], [-half * 0.97, boot], [-half * 0.86, chineY], [0, keel], [half * 0.86, chineY], [half * 0.97, boot], [half * 0.995, rub], [half, sheer]]
    return p
  }
  const pos: number[] = [], col: number[] = []
  const c = new THREE.Color()
  const tri = (a: number[], b: number[], d: number[], hex: number) => { c.setHex(hex); pos.push(...a, ...b, ...d); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b) }
  let prev = section(0).map(([x, y]) => [x, y, -L / 2])
  const deck: number[][][] = [prev]
  for (let i = 1; i <= N; i++) {
    const u = i / N
    const cur = section(u).map(([x, y]) => [x, y, -L / 2 + u * L])
    for (let k = 0; k < rows.length - 1; k++) {
      const a = prev[k]!, b = prev[k + 1]!, d = cur[k]!, e = cur[k + 1]!
      tri(a, d, b, band[k]!); tri(b, d, e, band[k]!)
    }
    deck.push(cur)
    prev = cur
  }
  // Transom: the flat stern, white above the boot top.
  const st = deck[0]!
  for (let k = 1; k < st.length - 2; k++) tri(st[0]!, st[k + 1]!, st[k]!, st[k]![1]! > 0.34 ? 0xf6f5f1 : 0x14284a)
  const hull = new THREE.BufferGeometry()
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  hull.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  hull.computeVertexNormals()
  const gel = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide })
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o }
  add(hull, gel)
  // Teak deck between the sheers, a little below the rail.
  const dp: number[] = []
  for (let i = 0; i < deck.length - 1; i++) {
    const a = deck[i]!, b = deck[i + 1]!
    const pl = a[0]!, pr = a[8]!, nl = b[0]!, nr = b[8]!
    dp.push(pl[0]! * 0.97, pl[1]! - 0.05, pl[2]!, nl[0]! * 0.97, nl[1]! - 0.05, nl[2]!, pr[0]! * 0.97, pr[1]! - 0.05, pr[2]!)
    dp.push(pr[0]! * 0.97, pr[1]! - 0.05, pr[2]!, nl[0]! * 0.97, nl[1]! - 0.05, nl[2]!, nr[0]! * 0.97, nr[1]! - 0.05, nr[2]!)
  }
  const deckGeo = new THREE.BufferGeometry(); deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); deckGeo.computeVertexNormals()
  const teakTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256
    const x = cv.getContext('2d')!
    x.fillStyle = '#a8733f'; x.fillRect(0, 0, 64, 256)
    for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#b07b46' : '#9c6a39'; x.fillRect(k * 8, 0, 7, 256); x.fillStyle = '#2b2118'; x.fillRect(k * 8 + 7, 0, 1, 256) }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })()
  const uv: number[] = []
  for (let k = 0; k < dp.length; k += 3) uv.push(dp[k]! * 1.6, dp[k + 2]! * 0.4)
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  add(deckGeo, new THREE.MeshStandardMaterial({ map: teakTex, roughness: 0.62 }))
  // Cabin: a swept white superstructure with a raked windscreen and a dark glass band, then a hardtop.
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.3 })
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1820, roughness: 0.05, metalness: 0.4, clearcoat: 1, envMapIntensity: 1.6 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.12, metalness: 1, envMapIntensity: 1.5 })
  const cushion = new THREE.MeshStandardMaterial({ color: 0xece6da, roughness: 0.85 })
  const prof = new THREE.Shape()
  prof.moveTo(-1.9, 0); prof.lineTo(1.5, 0); prof.quadraticCurveTo(1.2, 0.35, 0.55, 0.78); prof.lineTo(-1.7, 0.82); prof.quadraticCurveTo(-1.9, 0.8, -1.9, 0.6); prof.lineTo(-1.9, 0)
  const cabin = new THREE.ExtrudeGeometry(prof, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 8 })
  cabin.rotateY(-Math.PI / 2).translate(0.95, 0, 0)
  const deckAt = 1.12 - 0.05
  add(cabin, white, 0, deckAt, 0.2)
  const band2 = new THREE.ExtrudeGeometry(prof, { depth: 1.96, bevelEnabled: false, curveSegments: 8 })
  band2.rotateY(-Math.PI / 2).translate(0.98, 0, 0)
  const win = add(band2, glass, 0, deckAt + 0.43, 0.2)
  win.scale.set(1, 0.38, 0.985)
  add(new THREE.BoxGeometry(2.1, 0.08, 2.5), white, 0, deckAt + 1.75, -0.35)
  for (const sx of [-1, 1]) for (const z of [-1.4, 0.55]) add(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 10), chrome, sx * 0.95, deckAt + 1.27, z - 0.35)
  // Aft seating and a sun pad on the foredeck.
  add(new THREE.BoxGeometry(2.0, 0.42, 0.7), cushion, 0, deckAt + 0.21, -3.4)
  add(new THREE.BoxGeometry(0.55, 0.42, 1.5), cushion, -0.8, deckAt + 0.21, -2.4)
  add(new THREE.BoxGeometry(1.5, 0.12, 1.4), cushion, 0, deckAt + 0.32, 2.35)
  // Bow rail: a chrome tube along each sheer on stanchions.
  for (const sx of [-1, 1]) {
    const railPts: THREE.Vector3[] = []
    for (let u = 0.42; u <= 0.985; u += 0.04) { const s = section(u); const h = s[sx < 0 ? 0 : 8]!; railPts.push(new THREE.Vector3(h[0] * 0.93, h[1] + 0.48, -L / 2 + u * L)) }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 40, 0.022, 6), chrome)
    for (let k = 0; k < railPts.length; k += 3) { const p = railPts[k]!; add(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 6), chrome, p.x, p.y - 0.24, p.z) }
  }
  // Swim platform and the navigation lights.
  add(new THREE.BoxGeometry(2.3, 0.07, 0.75), new THREE.MeshStandardMaterial({ map: teakTex, roughness: 0.6 }), 0, 0.42, -L / 2 - 0.3)
  add(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }), -0.86, deckAt + 0.38, 2.6)
  add(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2aff6a }), 0.86, deckAt + 0.38, 2.6)
  return g
}

/** The lighthouse on its rock, across the bay (the cruise rounds it; the party yacht sails past it). */
export function lighthouse(): THREE.Group {
  const group = new THREE.Group()
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(LIGHTHOUSE.r, 1), new THREE.MeshStandardMaterial({ color: 0x6b675f, roughness: 0.95, flatShading: true }))
  rock.scale.set(1, 0.32, 1); rock.position.set(LIGHTHOUSE.x, -0.6, LIGHTHOUSE.z); rock.castShadow = true
  group.add(rock)
  const tower = new THREE.Group()
  const bands = 6
  for (let k = 0; k < bands; k++) {
    const r0 = 1.9 - (k / bands) * 0.7, r1 = 1.9 - ((k + 1) / bands) * 0.7
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 2.2, 20), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xc81e1e : 0xf4f1ea, roughness: 0.6 }))
    m.position.y = 2.2 * k + 1.1; m.castShadow = true; tower.add(m)
  }
  const top = 2.2 * bands
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.3, 16), new THREE.MeshBasicMaterial({ color: 0xfff1b8 }))
  lantern.position.y = top + 0.65; tower.add(lantern)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.1, 16), new THREE.MeshStandardMaterial({ color: 0x1d2228, roughness: 0.4, metalness: 0.5 }))
  cap.position.y = top + 1.85; tower.add(cap)
  tower.position.set(LIGHTHOUSE.x, 2.2, LIGHTHOUSE.z)
  group.add(tower)
  return group
}

/** The lighthouse rock and the buoys of the cruise route. */
function bayScenery(gates: P[], route: P[], gateIdx: number[]): { group: THREE.Group; buoys: Array<{ red: THREE.Mesh; green: THREE.Mesh }>; obstacles: Obstacle[] } {
  const group = new THREE.Group()
  const obstacles: Obstacle[] = [{ kind: 'circle', x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: LIGHTHOUSE.r }]
  group.add(lighthouse())
  // A gate is a red buoy to port and a green one to starboard, 14 m apart across the route.
  const buoyGeo = new THREE.CylinderGeometry(0.0, 0.55, 1.6, 12).translate(0, 0.8, 0)
  const ring = new THREE.CylinderGeometry(0.62, 0.62, 0.3, 14).translate(0, 0.15, 0)
  const red = new THREE.MeshStandardMaterial({ color: 0xd42a20, roughness: 0.5, emissive: 0x3a0603 })
  const green = new THREE.MeshStandardMaterial({ color: 0x1f9a4a, roughness: 0.5, emissive: 0x032a10 })
  const buoys: Array<{ red: THREE.Mesh; green: THREE.Mesh }> = []
  gates.forEach((_, i) => {
    const k = gateIdx[i]!
    const a = route[Math.max(0, k - 2)]!, b = route[Math.min(route.length - 1, k + 2)]!
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1
    const rx = -dz / l, rz = dx / l // to the left of travel... port side
    const at = route[k]!
    const mk = (m: THREE.Material, s: number) => {
      const o = new THREE.Group()
      const body = new THREE.Mesh(buoyGeo, m), base = new THREE.Mesh(ring, m)
      o.add(body, base); o.position.set(at.x + rx * 7 * s, 0, at.z + rz * 7 * s); group.add(o)
      obstacles.push({ kind: 'circle', x: o.position.x, z: o.position.z, r: 0.7 })
      return body
    }
    buoys.push({ red: mk(red, -1), green: mk(green, 1) })
  })
  return { group, buoys, obstacles }
}

// ---------------------------------------------------------------- sound

let actx: AudioContext | null = null
function ac(): AudioContext | null {
  if (!actx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    try { actx = new C() } catch { return null }
  }
  if (actx.state === 'suspended') void actx.resume().catch(() => undefined)
  return actx
}
const volume = () => Math.max(0, Math.min(100, getSave().volume ?? 70)) / 100

/** A soft engine note that rises with speed and opens up under throttle; the boat's is lower. */
function engine(kind: 'car' | 'boat'): { set: (speed01: number, load: number) => void; stop: () => void } {
  const a = ac()
  if (!a) return { set: () => undefined, stop: () => undefined }
  const out = a.createGain(); out.gain.value = 0
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'car' ? 900 : 500
  const o1 = a.createOscillator(); o1.type = 'sawtooth'
  const o2 = a.createOscillator(); o2.type = 'square'
  const g2 = a.createGain(); g2.gain.value = 0.35
  o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(out).connect(a.destination)
  o1.start(); o2.start()
  let live = true
  return {
    set(s, load) {
      if (!live) return
      if (a.state === 'suspended') void a.resume().catch(() => undefined)
      const t = a.currentTime
      const base = kind === 'car' ? 46 + s * 120 : 38 + s * 70
      o1.frequency.setTargetAtTime(base, t, 0.08)
      o2.frequency.setTargetAtTime(base * 0.5, t, 0.08)
      lp.frequency.setTargetAtTime((kind === 'car' ? 500 : 320) + load * 900 + s * 600, t, 0.1)
      out.gain.setTargetAtTime(load <= 0 ? 0 : volume() * (kind === 'car' ? 0.05 + load * 0.05 : 0.07 + load * 0.05), t, 0.12)
    },
    stop() {
      if (!live) return
      live = false
      try { out.gain.setTargetAtTime(0, a.currentTime, 0.05) } catch { /* */ }
      window.setTimeout(() => { try { o1.stop(); o2.stop(); out.disconnect() } catch { /* already stopped */ } }, 400)
    },
  }
}

function beep(high: boolean): void {
  const a = ac()
  if (!a || a.state !== 'running') return
  const v = volume()
  if (v <= 0) return
  const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = high ? 1320 : 660
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(0.14 * v, a.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + (high ? 0.5 : 0.2))
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.6)
}

// ---------------------------------------------------------------- race records

type Record_ = { best: number; medal: number; day: string; ghost: number[] }
const recKey = () => `${slotKey()}.cityrace`
const readRec = (): Record_ => { try { return { best: 0, medal: 0, day: '', ghost: [], ...(JSON.parse(localStorage.getItem(recKey()) ?? '{}') as Partial<Record_>) } } catch { return { best: 0, medal: 0, day: '', ghost: [] } } }
export const cityRaceBest = (): number => readRec().best
export const CITY_MEDALS = ['', 'Bronze', 'Silver', 'Gold'] as const
const medalFor = (sec: number) => (sec <= RACE_PAR * 1.04 ? 3 : sec <= RACE_PAR * 1.12 ? 2 : sec <= RACE_PAR * 1.25 ? 1 : 0)
export const cityRacePar = () => RACE_PAR

// ---------------------------------------------------------------- the ride

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
const wrap = (i: number, n: number) => ((i % n) + n) % n

export function createRide(scene: THREE.Scene, opts: RideOpts, deps: { toast: (m: string) => void }) {
  const isBoat = opts.kind === 'boat'
  const spec = isBoat ? { top: 15, acc: 3.6 } : (() => { const c = OWNED[opts.model] ?? KART; return { top: (c.top / 3.6) * 0.42, acc: (c.acc / 100) * 6.8 } })()
  const model = isBoat ? cruiser() : fineCar(opts.model === 'kart' ? 'saloon' : opts.model)
  if (opts.model === 'kart') model.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined
    if (m && m.isMeshPhysicalMaterial && m.roughness > 0.2) { const k = m.clone(); k.color.set(KART.tint); (o as THREE.Mesh).material = k }
  })
  const root = new THREE.Group()
  root.name = 'ride'
  root.add(model)
  scene.add(root)
  root.traverse((o) => { o.userData.ghost = true })
  const box = new THREE.Box3().setFromObject(model)
  const len = isBoat ? 8.8 : box.max.z - box.min.z
  const wid = isBoat ? 2.75 : box.max.x - box.min.x
  const wb = isBoat ? 4 : len * 0.6
  const wheelsOf = (g: THREE.Object3D) => g.children.filter((c) => (c as THREE.Group).isGroup && !(c as THREE.Mesh).isMesh).map((w) => { w.rotation.order = 'YXZ'; return { w, front: w.position.z > 0, flip: w.rotation.y } })
  const wheels = isBoat ? [] : wheelsOf(model)

  let x = opts.at?.x ?? 0, z = opts.at?.z ?? 0, heading = opts.at?.heading ?? 0
  let vx = 0, vz = 0, steer = 0, spin = 0, bob = 0, roll = 0, pitch = 0
  let driving = true
  let elapsed = 0
  const snd = engine(opts.kind)

  // HUD: one small chip at the top (speed, and the race or cruise line), a countdown in the middle.
  const hud = document.createElement('div'); hud.id = 'ride-hud'; hud.setAttribute('role', 'status')
  const spd = document.createElement('b'); spd.className = 'rh-speed'; spd.textContent = '0'
  const unit = document.createElement('small'); unit.textContent = isBoat ? 'knots' : 'km/h'
  const line = document.createElement('span'); line.className = 'rh-line'
  hud.append(spd, unit, line)
  const count = document.createElement('div'); count.id = 'ride-count'; count.hidden = true
  document.body.append(hud, count)
  document.body.classList.add('riding')

  // Route, gates, arrow, rivals and ghost (race and cruise).
  const race = opts.mode === 'race' ? raceRoute() : null
  const route = race ?? (opts.mode === 'cruise' ? { ...cruiseRoute(), start: CRUISE_START } : null)
  const extras = new THREE.Group(); scene.add(extras)
  if (race) extras.add(race.t.group)
  let bay: ReturnType<typeof bayScenery> | null = null
  const gateMeshes: THREE.Group[] = []
  const hot = new THREE.MeshBasicMaterial({ color: 0xffc93c, toneMapped: false })
  const dim = new THREE.MeshBasicMaterial({ color: 0xf4efe2, transparent: true, opacity: 0.55 })
  if (isBoat && route) { bay = bayScenery(CRUISE_GATES, route.pts, route.gates); extras.add(bay.group) }
  if (race) {
    const span = TRACK_W + 2.6
    const post = new THREE.CylinderGeometry(0.18, 0.18, 4.2, 10).translate(0, 2.1, 0)
    const bar = new THREE.BoxGeometry(span, 0.55, 0.2).translate(0, 4.15, 0)
    race.gates.forEach((k) => {
      const tg = race.t.tan[k]!
      const gate = new THREE.Group()
      const p1 = new THREE.Mesh(post, dim), p2 = new THREE.Mesh(post, dim), top = new THREE.Mesh(bar, dim)
      p1.position.x = -span / 2; p2.position.x = span / 2
      gate.add(p1, p2, top)
      gate.position.set(race.pts[k]!.x, 0, race.pts[k]!.z)
      gate.rotation.y = Math.atan2(tg.x, tg.z)
      gate.visible = false
      extras.add(gate); gateMeshes.push(gate)
    })
  }
  const chevron = (() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0.9); s.lineTo(0.75, -0.2); s.lineTo(0.3, -0.2); s.lineTo(0.3, -0.75); s.lineTo(-0.3, -0.75); s.lineTo(-0.3, -0.2); s.lineTo(-0.75, -0.2); s.lineTo(0, 0.9)
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(Math.PI), hot)
    m.renderOrder = 5
    return m
  })()
  chevron.visible = !!route
  extras.add(chevron)

  // Rival drivers: same car performance as yours, each a little less brave in the bends.
  type Rival = { obj: THREE.Group; d: number; lat: number; latGoal: number; baseLat: number; v: number; skill: number; wheels: ReturnType<typeof wheelsOf>; spin: number }
  const rivals: Rival[] = []
  if (race) {
    const pool = ['supercar', 'tourer', 'sportsaloon', 'evcoupe', 'hypercar', 'executive'].filter((id) => id !== opts.model)
    RIVALS.forEach((r, k) => {
      const obj = fineCar(pool[k]!)
      const g = gridSlot(race.t, k)
      obj.position.set(g.x, 0, g.z); obj.rotation.y = g.heading
      obj.traverse((o) => { o.userData.ghost = true; o.raycast = () => undefined })
      extras.add(obj)
      rivals.push({ obj, d: -g.back, lat: g.lat, latGoal: r.lat, baseLat: r.lat, v: 0, skill: r.skill, wheels: wheelsOf(obj), spin: 0 })
    })
  }
  let ghost: THREE.Group | null = null
  const rec0 = readRec()
  if (race && rec0.ghost.length > 6) {
    ghost = fineCar(opts.model === 'kart' ? 'saloon' : opts.model)
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.26, depthWrite: false })
    ghost.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = ghostMat; o.castShadow = false } })
    ghost.visible = false
    extras.add(ghost)
  }
  extras.traverse((o) => { o.userData.ghost = true; if (o !== race?.t.group) o.raycast = () => undefined })

  // Race and cruise state.
  let phase: 'count' | 'go' | 'done' = race ? 'count' : 'go'
  let countT = 3.4
  let lastBeep = 4
  let raceT = 0, lap = 1, next = 0, progress = 0, hint = race ? wrap(race.t.start - 30, race.pts.length) : 0
  let playerD = 0, place = RIVALS.length + 1, onGrass = false
  const trail: number[] = []
  let trailT = 0
  let resultUntil = 0
  if (route) { const s = route.start; x = s.x; z = s.z; heading = s.heading }
  if (race) { count.hidden = false; count.textContent = '3' }

  // A short fade when the ride starts somewhere else (the raceway, the bay).
  if (route) {
    const f = document.createElement('div'); f.className = 'ride-fade'
    document.body.append(f)
    window.setTimeout(() => f.remove(), 900)
  }

  // The boat's wake: a ribbon of the stern's last positions, widening and fading.
  const WAKE = 44
  let wake: THREE.Mesh | null = null
  const wakePts: P[] = []
  if (isBoat) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WAKE * 2 * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(WAKE * 2 * 4), 4))
    const idx: number[] = []
    for (let i = 0; i < WAKE - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    geo.setIndex(idx)
    wake = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    wake.frustumCulled = false
    wake.renderOrder = 2
    extras.add(wake)
  }

  const place3d = () => {
    root.position.set(x, isBoat ? bob : 0, z)
    root.rotation.set(0, heading, 0)
    model.rotation.set(pitch, 0, roll, 'YXZ')
    for (const w of wheels) { w.w.rotation.y = w.flip + (w.front ? steer : 0); w.w.rotation.x = w.flip ? -spin : spin }
  }
  place3d()

  const front = { x: 0, z: 0 }, rear = { x: 0, z: 0 }, dummy = { x: 0, z: 0 }
  const half = Math.max(0.1, len / 2 - wid / 2)
  const rad = wid / 2
  const rivalObs: Obstacle[] = []

  /** Debug: drive the route by itself (used to set the par time and check the circuit). */
  let auto = false
  let turbo = 1, inTurbo = false
  const autopilot = (): { x: number; y: number } => {
    if (!route) return { x: 0, y: 0 }
    const sp = Math.hypot(vx, vz)
    let t: P, limit: number
    if (race) {
      const n = race.pts.length
      t = race.pts[wrap(hint + Math.round(Math.max(7, Math.min(16, sp * 0.8))), n)]!
      limit = race.t.safe(hint) * 0.98
    } else {
      t = route.pts[Math.min(route.pts.length - 1, progress + (sp > 8 ? 18 : 10))]!
      limit = spec.top
    }
    const want = Math.atan2(t.x - x, t.z - z)
    const err = Math.atan2(Math.sin(want - heading), Math.cos(want - heading))
    return { x: THREE.MathUtils.clamp(-err * 2.4, -1, 1), y: sp > limit + 0.4 ? -0.7 : 1 }
  }

  const finishRace = () => {
    phase = 'done'
    const sec = Math.round(raceT * 100) / 100
    const n = race!.pts.length
    place = 1 + rivals.filter((r) => r.d >= RACE_LAPS * n).length
    const r = readRec()
    const medal = medalFor(sec)
    const better = !r.best || sec < r.best
    if (better) { r.best = sec; r.ghost = trail.slice() }
    const newMedal = medal > r.medal
    if (newMedal) r.medal = medal
    const today = new Date().toLocaleDateString('en-CA')
    const first = r.day !== today
    r.day = today
    try { localStorage.setItem(recKey(), JSON.stringify(r)) } catch { /* private mode */ }
    if (first) window.setTimeout(() => addReputation(2, 'Reputation: Grind Raceway', `Two laps in ${fmt(sec)}, finished P${place}.`), 0)
    const msg = `P${place} of ${RIVALS.length + 1} · ${fmt(sec)}${medal ? ` · ${CITY_MEDALS[medal]}` : ''}${better ? ' · best' : ''}`
    line.textContent = msg
    resultUntil = elapsed + 10
    count.hidden = false
    count.textContent = place === 1 ? 'WIN' : `P${place}`
    window.setTimeout(() => { count.hidden = true }, 2200)
    deps.toast(`${place === 1 ? 'You win! ' : ''}${msg}.${first ? ' +2 reputation.' : ''} Get out to hand the car back.`)
    for (const gm of gateMeshes) gm.visible = false
    chevron.visible = false
    if (ghost) ghost.visible = false
  }

  let cruiseDone = false
  const finishCruise = () => {
    cruiseDone = true
    const today = new Date().toLocaleDateString('en-CA')
    const k = `${slotKey()}.cruise`
    let day = ''
    try { day = localStorage.getItem(k) ?? '' } catch { /* */ }
    try { localStorage.setItem(k, today) } catch { /* */ }
    adjust({ social: 8, energy: 4 }, 'quiet')
    if (day !== today) window.setTimeout(() => addReputation(2, 'Reputation: bay cruise', 'Round the lighthouse and home.'), 0)
    deps.toast(`Round the lighthouse and home. Sea air lifts your mood.${day !== today ? ' +2 reputation.' : ''}`)
    chevron.visible = false
    line.textContent = 'Free cruise'
  }

  /** Rivals follow the racing line at the speed each one dares, and keep out of each other's (and your) way. */
  const moveRivals = (dt: number) => {
    if (!race) return
    const n = race.pts.length
    rivalObs.length = 0
    for (const r of rivals) {
      const finished = r.d >= RACE_LAPS * n
      if (phase === 'go' || finished) {
        const i = wrap(Math.floor(race.t.start + r.d), n)
        let want = finished ? 7 : Math.min(spec.top, race.t.safe(i) * r.skill)
        // Someone just ahead in the same line: hold back a touch and pull out to pass.
        r.latGoal = r.baseLat
        const others = [...rivals.filter((o) => o !== r).map((o) => ({ d: o.d, lat: o.lat, v: o.v })), { d: playerD, lat: playerLat, v: Math.abs(speedNow) }]
        for (const o of others) {
          const gap = o.d - r.d
          if (gap > 0 && gap < 9 && Math.abs(o.lat - r.lat) < 2.3) {
            r.latGoal = THREE.MathUtils.clamp(o.lat + (o.lat > 0 ? -3.4 : 3.4), -TRACK_W / 2 + 1.3, TRACK_W / 2 - 1.3)
            if (gap < 5.5) want = Math.min(want, o.v * 0.95)
          }
        }
        r.v += THREE.MathUtils.clamp(want - r.v, -10 * dt, spec.acc * dt)
        r.d += r.v * dt
        r.lat += (r.latGoal - r.lat) * (1 - Math.exp(-1.1 * dt))
      }
      const f = wrap(race.t.start + r.d, n), i0 = Math.floor(f), i1 = (i0 + 1) % n, u = f - i0
      const p0 = race.pts[i0]!, p1 = race.pts[i1]!, t0 = race.t.tan[i0]!, t1 = race.t.tan[i1]!
      const tx = t0.x + (t1.x - t0.x) * u, tz = t0.z + (t1.z - t0.z) * u
      const px = p0.x + (p1.x - p0.x) * u + tz * r.lat, pz = p0.z + (p1.z - p0.z) * u - tx * r.lat
      r.obj.position.set(px, 0, pz)
      r.obj.rotation.y = Math.atan2(tx, tz)
      r.spin = (r.spin + (r.v * dt) / 0.35) % (Math.PI * 2)
      for (const w of r.wheels) w.w.rotation.x = w.flip ? -r.spin : r.spin
      const hx = Math.sin(r.obj.rotation.y) * 1.35, hz = Math.cos(r.obj.rotation.y) * 1.35
      rivalObs.push({ kind: 'circle', x: px + hx, z: pz + hz, r: 0.95 }, { kind: 'circle', x: px - hx, z: pz - hz, r: 0.95 })
    }
  }
  let playerLat = race ? race.start.lat : 0
  let speedNow = 0

  return {
    get x() { return x },
    get z() { return z },
    get heading() { return heading },
    get speed() { return vx * Math.sin(heading) + vz * Math.cos(heading) },
    get driving() { return driving },
    kind: opts.kind,
    mode: opts.mode,
    label: opts.label,
    model: opts.model,
    temp: !!opts.temp,
    object: root,
    extras,
    set auto(v: boolean) { auto = v },
    /** Tests only: run several physics steps per frame. */
    set turbo(n: number) { turbo = Math.max(1, Math.min(8, Math.round(n))) },
    /** Where the race or cruise is (for tests). */
    debug: () => ({ phase, lap, next, gates: route?.gates.length ?? 0, raceT, progress, place, playerD: Math.round(playerD), x, z, heading, rivals: rivals.map((r) => Math.round(r.d)) }),
    /** Circles the walking player bumps into while the car stands parked. */
    shape(): Obstacle[] {
      return [
        { kind: 'circle', x: x + Math.sin(heading) * half, z: z + Math.cos(heading) * half, r: rad },
        { kind: 'circle', x: x - Math.sin(heading) * half, z: z - Math.cos(heading) * half, r: rad },
      ]
    },
    /** A free spot beside the driver's door to step out to. */
    exitSpot(obstacles: readonly Obstacle[]): P {
      const side = { x: -Math.cos(heading), z: Math.sin(heading) } // the car's right
      for (const s of [-1, 1]) {
        const p = { x: x - side.x * s * (wid / 2 + 0.75), z: z - side.z * s * (wid / 2 + 0.75) }
        const q = { ...p }
        resolveCollision(q, dummy, obstacles, 0.45)
        if (Math.hypot(q.x - p.x, q.z - p.z) < 0.05) return p
      }
      return { x: x - Math.sin(heading) * (len / 2 + 1), z: z - Math.cos(heading) * (len / 2 + 1) }
    },
    park() { driving = false; vx = vz = 0; steer = 0; snd.set(0, 0); hud.hidden = true; count.hidden = true; document.body.classList.remove('riding') },
    resume() { driving = true; hud.hidden = false; document.body.classList.add('riding') },
    step(dt: number, input: Input, obstacles: readonly Obstacle[], still: readonly Obstacle[] = obstacles): void {
      if (turbo > 1 && !inTurbo) { inTurbo = true; for (let i = 0; i < turbo; i++) this.step(dt, input, obstacles, still); inTurbo = false; return }
      // The test driver times an empty city: it ignores traffic and people, which move.
      if (auto) obstacles = still
      elapsed += dt
      let ix = 0, iy = 0
      if (driving && input) { ix = input.x; iy = input.y }
      if (auto && driving) { const a = autopilot(); ix = a.x; iy = a.y }
      // Countdown before a race: everyone waits on the grid.
      if (phase === 'count') {
        countT -= dt
        const k = Math.ceil(countT - 0.4)
        if (k < lastBeep && k >= 0) { lastBeep = k; beep(k === 0) }
        count.textContent = k > 0 ? String(k) : 'GO'
        if (countT <= 0.4) phase = 'go'
        ix = 0; iy = 0
      }
      if (phase === 'go' && race && countT > -0.6) { countT -= dt; if (countT <= -0.6) count.hidden = true }
      const fx = Math.sin(heading), fz = Math.cos(heading)
      const rx = -Math.cos(heading), rz = Math.sin(heading)
      let vf = vx * fx + vz * fz
      let vl = vx * rx + vz * rz
      // Throttle and brakes from the stick: up goes, back brakes, held back reverses. Grass slows you.
      const top = onGrass ? spec.top * 0.55 : spec.top
      let load = 0
      if (iy > 0.05) {
        const want = top * Math.min(1, iy * 1.1)
        if (vf < -0.3) vf = Math.min(0, vf + 16 * dt)
        else if (vf < want) { vf = Math.min(want, vf + spec.acc * (1 - (vf / spec.top) * 0.55) * dt); load = iy }
        else vf = Math.max(want, vf - (onGrass ? 9 : 3) * dt)
      } else if (iy < -0.05) {
        if (vf > 0.4) vf = Math.max(0, vf - (isBoat ? 6 : 15) * -iy * dt)
        else vf = Math.max(-(isBoat ? 2.5 : 5) * -iy, vf - (isBoat ? 1.5 : 4) * dt)
        load = vf < 0 ? 0.4 : 0
      } else {
        const drag = isBoat ? 1.6 : onGrass ? 6 : 2.2
        vf = Math.abs(vf) < drag * dt ? 0 : vf - Math.sign(vf) * drag * dt
      }
      // Steering: wide lock when slow, gentle at speed. The boat's rudder needs way on.
      if (isBoat) {
        steer += (ix * 0.6 - steer) * (1 - Math.exp(-4 * dt))
        heading -= steer * Math.min(1, Math.abs(vf) / 4) * Math.sign(vf || 1) * 0.75 * dt
        vl *= Math.exp(-2.2 * dt)
      } else {
        const lock = 0.72 / (1 + Math.abs(vf) / 9)
        steer += (ix * lock - steer) * (1 - Math.exp(-7 * dt))
        heading -= (vf / wb) * Math.tan(steer) * dt
        vl *= Math.exp(-9 * dt)
      }
      const nfx = Math.sin(heading), nfz = Math.cos(heading), nrx = -Math.cos(heading), nrz = Math.sin(heading)
      vx = nfx * vf + nrx * vl
      vz = nfz * vf + nrz * vl
      if (race) moveRivals(dt)
      // Move in small steps and push both ends of the body out of anything solid (or back inside the barriers).
      const steps = Math.max(1, Math.ceil((Math.hypot(vx, vz) * dt) / 0.25))
      for (let i = 0; i < steps; i++) {
        x += (vx * dt) / steps; z += (vz * dt) / steps
        const hx = Math.sin(heading) * half, hz = Math.cos(heading) * half
        front.x = x + hx; front.z = z + hz; rear.x = x - hx; rear.z = z - hz
        const f0x = front.x, f0z = front.z, r0x = rear.x, r0z = rear.z
        if (isBoat) {
          for (const p of [front, rear]) { p.x = THREE.MathUtils.clamp(p.x, -220, 220); p.z = THREE.MathUtils.clamp(p.z, -340, -86) }
          resolveCollision(front, dummy, bay?.obstacles ?? [], rad, true)
          resolveCollision(rear, dummy, bay?.obstacles ?? [], rad, true)
        } else if (race) {
          resolveCollision(front, dummy, rivalObs, rad, true)
          resolveCollision(rear, dummy, rivalObs, rad, true)
          const lim = TRACK_W / 2 + RUNOFF - rad - 0.15
          for (const p of [front, rear]) {
            const L = race.t.locate(p.x, p.z, hint)
            if (Math.abs(L.lat) > lim) { const tg = race.t.tan[L.i]!; const over = L.lat - Math.sign(L.lat) * lim; p.x -= tg.z * over; p.z += tg.x * over }
          }
        } else {
          resolveCollision(front, dummy, obstacles, rad)
          resolveCollision(rear, dummy, obstacles, rad)
        }
        const push = Math.hypot(front.x - f0x, front.z - f0z) + Math.hypot(rear.x - r0x, rear.z - r0z)
        if (push > 0.002) {
          const nx = (front.x - f0x + rear.x - r0x), nz = (front.z - f0z + rear.z - r0z), nl = Math.hypot(nx, nz) || 1
          const into = (vx * nx + vz * nz) / nl
          if (into < 0) { vx -= (into * nx / nl) * 1.25; vz -= (into * nz / nl) * 1.25; vx *= 0.8; vz *= 0.8 }
          x = (front.x + rear.x) / 2; z = (front.z + rear.z) / 2
          heading = Math.atan2(front.x - rear.x, front.z - rear.z)
        }
      }
      if (!isBoat && !race) { x = THREE.MathUtils.clamp(x, -CITY_LIMIT, CITY_LIMIT); z = THREE.MathUtils.clamp(z, -CITY_LIMIT, CITY_LIMIT) }
      const sp = vx * Math.sin(heading) + vz * Math.cos(heading)
      speedNow = sp
      spin = (spin + (sp * dt) / 0.35) % (Math.PI * 2)
      if (race) {
        const L = race.t.locate(x, z, hint)
        hint = L.i
        playerLat = L.lat
        onGrass = Math.abs(L.lat) > TRACK_W / 2 + 0.9
      }
      // Body motion: the boat rides the swell and lifts its bow at speed; the car leans a little in bends.
      if (isBoat) {
        bob = 0.05 * Math.sin(elapsed * 1.6) + 0.02 * Math.sin(elapsed * 2.7 + 1)
        pitch += ((-0.07 * THREE.MathUtils.clamp(sp / spec.top, 0, 1) + 0.015 * Math.sin(elapsed * 1.3)) - pitch) * (1 - Math.exp(-2 * dt))
        roll += ((steer * 0.18 * THREE.MathUtils.clamp(sp / spec.top, 0, 1) + 0.02 * Math.sin(elapsed * 1.1)) - roll) * (1 - Math.exp(-2.5 * dt))
      } else {
        roll += ((steer * 0.06 * THREE.MathUtils.clamp(sp / spec.top, 0, 1)) - roll) * (1 - Math.exp(-6 * dt))
        pitch += ((iy < -0.05 && sp > 1 ? 0.02 : iy > 0.2 && sp < spec.top * 0.6 ? -0.012 : 0) - pitch) * (1 - Math.exp(-6 * dt))
      }
      place3d()
      snd.set(THREE.MathUtils.clamp(Math.abs(sp) / spec.top, 0, 1), driving ? Math.max(load, 0.15) : 0)
      if (driving) spd.textContent = String(Math.round(Math.abs(sp) * (isBoat ? 1.944 : 3.6)))

      // Wake behind the stern.
      if (wake) {
        trailT += dt
        if (trailT > 0.07) {
          trailT = 0
          wakePts.unshift({ x: x - Math.sin(heading) * 4.4, z: z - Math.cos(heading) * 4.4 })
          if (wakePts.length > WAKE) wakePts.pop()
        }
        const posA = wake.geometry.getAttribute('position') as THREE.BufferAttribute
        const colA = wake.geometry.getAttribute('color') as THREE.BufferAttribute
        const strength = THREE.MathUtils.clamp(Math.abs(sp) / 6, 0, 1)
        for (let i = 0; i < WAKE; i++) {
          const p = wakePts[Math.min(i, wakePts.length - 1)] ?? { x, z }
          const q = wakePts[Math.min(i + 1, wakePts.length - 1)] ?? p
          let dx = p.x - q.x, dz = p.z - q.z
          const l = Math.hypot(dx, dz) || 1
          dx /= l; dz /= l
          const w = 0.9 + i * 0.16
          posA.setXYZ(i * 2, p.x - dz * w, 0.06, p.z + dx * w)
          posA.setXYZ(i * 2 + 1, p.x + dz * w, 0.06, p.z - dx * w)
          const a = (1 - i / WAKE) * 0.55 * strength * (i < wakePts.length ? 1 : 0)
          colA.setXYZW(i * 2, 1, 1, 1, a); colA.setXYZW(i * 2 + 1, 1, 1, 1, a)
        }
        posA.needsUpdate = true; colA.needsUpdate = true
      }

      // Race: gates in order, laps, your place, the ghost.
      if (race && driving) {
        const n = race.pts.length
        progress = hint
        let rel = wrap(hint - race.t.start, n)
        if (lap === 1 && next === 0 && rel > n / 2) rel -= n
        playerD = (lap - 1) * n + rel
        if (phase === 'go') {
          raceT += dt
          const g = race.gates[next]!
          const gp = race.pts[g]!
          if (Math.hypot(gp.x - x, gp.z - z) < TRACK_W / 2 + RUNOFF) {
            next += 1
            beep(false)
            if (next >= race.gates.length) {
              if (lap >= RACE_LAPS) { playerD = RACE_LAPS * n; finishRace() }
              else { lap += 1; next = 0 }
            }
          }
          if (phase === 'go') {
            place = 1 + rivals.filter((r) => r.d > playerD).length
            line.textContent = `P${place}/${RIVALS.length + 1} · lap ${lap}/${RACE_LAPS} · ${fmt(raceT)}`
          }
          trailT += dt
          if (trailT > 0.1) { trailT = 0; trail.push(Math.round(x * 10) / 10, Math.round(z * 10) / 10, Math.round(heading * 100) / 100) }
          gateMeshes.forEach((gm, i) => {
            const show = phase === 'go' && (i === next || i === (next + 1) % gateMeshes.length)
            gm.visible = show
            if (show) for (const c of gm.children) (c as THREE.Mesh).material = i === next ? hot : dim
          })
          if (ghost && rec0.ghost.length > 6) {
            const k = Math.min(rec0.ghost.length / 3 - 1, Math.floor(raceT / 0.1))
            ghost.visible = phase === 'go'
            ghost.position.set(rec0.ghost[k * 3]!, 0, rec0.ghost[k * 3 + 1]!)
            ghost.rotation.y = rec0.ghost[k * 3 + 2]!
          }
        } else if (phase === 'count') {
          line.textContent = `Grid · P${RIVALS.length + 1}/${RIVALS.length + 1}`
          gateMeshes.forEach((gm, i) => { gm.visible = i === 0; for (const c of gm.children) (c as THREE.Mesh).material = hot })
        }
      }
      // Cruise: buoy gates in order along the route.
      if (route && !race && driving) {
        const n = route.pts.length
        let best = progress, bd = Infinity
        for (let k = progress; k < Math.min(n, progress + 60); k++) { const p = route.pts[k]!; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = k } }
        if (bd < 24 * 24) progress = best
        if (!cruiseDone) {
          const gi = route.gates[next]!
          const gp = route.pts[gi]!
          if (Math.hypot(gp.x - x, gp.z - z) < 9) { progress = Math.max(progress, gi); next += 1; beep(false); if (next >= route.gates.length) finishCruise() }
          if (!cruiseDone) line.textContent = `Buoy gate ${next + 1} of ${route.gates.length}`
          bay?.buoys.forEach((b, i) => { const on = i === next; b.red.scale.setScalar(on ? 1.3 : 1); b.green.scale.setScalar(on ? 1.3 : 1) })
        }
      }
      // The arrow floats over the roof and points along the route ahead.
      if (route && driving && chevron.visible && phase !== 'done') {
        const n = route.pts.length
        const ahead = route.pts[race ? wrap(progress + 22, n) : Math.min(n - 1, progress + (isBoat ? 40 : 24))]!
        chevron.position.set(x, isBoat ? 4.2 : 2.5, z)
        chevron.rotation.y = Math.atan2(ahead.x - x, ahead.z - z)
        chevron.scale.setScalar(isBoat ? 1.6 : 0.9)
      }
      if (resultUntil && elapsed > resultUntil) { resultUntil = 0; line.textContent = '' }
    },
    dispose() {
      snd.stop()
      hud.remove(); count.remove()
      document.body.classList.remove('riding')
      scene.remove(root); scene.remove(extras)
    },
  }
}
