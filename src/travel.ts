// Grind International Airport, the flights from it and the party yacht. Built as areas by homes.ts (lazy-loaded).
// The airport stands east of the city by the shore, at the end of the metro's airport branch: a glass terminal
// under a curved roof (check-in, departures board, gate lounges, a café, duty free and the Grind One Lounge),
// two airliners and a VIP jet on their stands, a runway with real markings and lights, a control tower and a
// hangar. Two ways to fly, both seated in the plane for the whole trip: flight GA 101 (pushback, taxi, take-off
// over the sea, round the lighthouse, across the whole city at 150 m and back to land) and the Grind One party
// jet (the same, with a DJ, a dance floor and a crowd in a cabin with panoramic windows, seen from inside while
// it circles the city). The party yacht sails from a jetty off the beach with a DJ and guests on the aft deck.
// Music for the parties is made live with Web Audio (no files) and follows the player's music setting.
import * as THREE from 'three'
import type { Hotspot } from './world.ts'
import type { Arch, Move } from './homes.ts'
import { spendInGame } from './state.ts'
import { adjust } from './needs.ts'
import { posedHuman, MEN, WOMEN, type HumanModel } from './humans.ts'
import { lighthouse } from './ride.ts'
import { musicOn, musicVolume, duckMusic } from './music.ts'

export type TravelCtx = {
  startMove: (m: Move) => void
  now: () => number
  toast: (m: string) => void
  fade: () => void
  leave: () => void
  train: () => void
  wind: (speed: number) => void
  animate: (f: (t: number) => void) => void
  light: THREE.PointLight
  flying: (on: boolean) => void
  onLeave: (f: () => void) => void
}

const FLIGHT_USD = 40
/** Grind Air cabins: price, name, and what you get. */
export type Cabin = 'eco' | 'biz' | 'first'
const CABINS: Record<Cabin, { usd: number; name: string; service: string }> = {
  eco: { usd: 40, name: 'Economy', service: 'The trolley comes round: tea, a sandwich and a window seat with the sea below.' },
  biz: { usd: 140, name: 'Business', service: 'Your pod reclines flat. A hot towel, a three-course meal and noise-cancelling headphones.' },
  first: { usd: 380, name: 'First', service: 'Your own suite with a door, a proper bed, a chef\'s tasting menu and the whole window to yourself.' },
}
const JET_USD = 250

// ---------------------------------------------------------------- small helpers

export const std = (color: number, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
export const glow = (color: number) => new THREE.MeshBasicMaterial({ color, toneMapped: false })
export function put(g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; g.add(o); return o
}
/** A box by its centre. */
export const cube = (g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, shadow = true) => put(g, new THREE.BoxGeometry(w, h, d), m, x, y, z, shadow)
export function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]) }
  return t
}
const FONT = '"Inter Variable", Inter, system-ui, sans-serif'
/** A flat lit sign: text on a plate, readable from the front. */
export function sign(text: string, w: number, h: number, o: { bg?: string; fg?: string; px?: number; weight?: number; glowing?: boolean } = {}): THREE.Mesh {
  const W = 1024, H = Math.max(64, Math.round((W * h) / w))
  const t = tex(W, H, (g) => {
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, W, H) } else g.clearRect(0, 0, W, H)
    g.fillStyle = o.fg ?? '#ffffff'; g.font = `${o.weight ?? 800} ${o.px ?? Math.round(H * 0.56)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, W / 2, H / 2 + 2)
  })
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: !o.bg, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: o.glowing ? 0.8 : 0.25, side: THREE.DoubleSide })
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
  return p
}
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
/** A posed person; once loaded, scenery to the camera (it never pulls in to avoid them). */
export function person(model: HumanModel, o: Parameters<typeof posedHuman>[1]): THREE.Group {
  const root: THREE.Group = posedHuman(model, { ...o, onReady: () => root.traverse((c) => { c.userData.ghost = true }) })
  return root
}
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// ---------------------------------------------------------------- party: music, guests, lights

/** Live party music: four-on-the-floor kick, claps, hats, a bass line and chord stabs at 122 bpm. */
function partyMusic() {
  let ctx: AudioContext | null = null, master: GainNode | null = null, timer = 0
  let next = 0, step = 0
  let noise: AudioBuffer | null = null
  const BPM = 122, SIX = 60 / BPM / 4
  const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
  const ROOTS = [45, 41, 36, 43] // A, F, C, G
  const CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]
  const env = (g: GainNode, t: number, peak: number, decay: number) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + decay) }
  const kick = (t: number) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain()
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13)
    env(g, t, 0.95, 0.32); o.connect(g).connect(master!); o.start(t); o.stop(t + 0.35)
  }
  const hiss = (t: number, type: BiquadFilterType, f: number, peak: number, decay: number) => {
    const s = ctx!.createBufferSource(); s.buffer = noise
    const fl = ctx!.createBiquadFilter(); fl.type = type; fl.frequency.value = f
    const g = ctx!.createGain(); env(g, t, peak, decay)
    s.connect(fl).connect(g).connect(master!); s.start(t, Math.random() * 1.5); s.stop(t + decay + 0.02)
  }
  const tone = (t: number, m: number, type: OscillatorType, cutoff: number, peak: number, decay: number) => {
    const o = ctx!.createOscillator(); o.type = type; o.frequency.value = hz(m)
    const fl = ctx!.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); fl.frequency.exponentialRampToValueAtTime(cutoff * 0.35, t + decay)
    const g = ctx!.createGain(); env(g, t, peak, decay)
    o.connect(fl).connect(g).connect(master!); o.start(t); o.stop(t + decay + 0.02)
  }
  const tickSched = () => {
    if (!ctx) return
    while (next < ctx.currentTime + 0.14) {
      const s = step % 16, bar = Math.floor(step / 16) % 4
      if (s % 4 === 0) kick(next)
      if (s === 4 || s === 12) hiss(next, 'bandpass', 1500, 0.5, 0.14)
      if (s % 4 === 2) hiss(next, 'highpass', 7000, 0.22, 0.12)
      else if (s % 2 === 1) hiss(next, 'highpass', 8000, 0.08, 0.04)
      if ([0, 3, 6, 8, 11, 14].includes(s)) tone(next, ROOTS[bar]! + (s === 6 || s === 14 ? 12 : 0), 'sawtooth', 520, 0.32, 0.2)
      if (s === 2 || s === 10 || s === 7) for (const m of CHORDS[bar]!) tone(next, m, 'sawtooth', 2200, 0.07, 0.24)
      next += SIX; step++
    }
  }
  return {
    get on() { return !!ctx },
    start() {
      if (ctx || !musicOn()) return
      try {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!C) return
        ctx = new C()
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
        const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
        master = ctx.createGain(); master.gain.value = 0.0001
        const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination)
        master.gain.exponentialRampToValueAtTime(Math.max(0.02, 0.55 * (musicVolume() / 100)), ctx.currentTime + 1.2)
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
        next = ctx.currentTime + 0.1; step = 0
        timer = window.setInterval(tickSched, 25)
        duckMusic(true)
      } catch { ctx = null }
    },
    stop() {
      window.clearInterval(timer)
      if (!ctx) return
      const c = ctx; ctx = null
      try { master!.gain.setTargetAtTime(0.0001, c.currentTime, 0.25) } catch { /* closed */ }
      window.setTimeout(() => void c.close().catch(() => undefined), 900)
      duckMusic(false)
    },
  }
}

type Guest = [number, number, number, 'cheer' | 'stand']
/** Party crowd, a DJ, an LED dance floor and coloured light, all children of `host` (the jet or the yacht). */
function partyKit(host: THREE.Group, X: TravelCtx, spec: { y: number; guests: Guest[]; dj: [number, number, number]; floor: { x: number; z: number; cols: number; rows: number; size: number }; lightAt: [number, number, number] }) {
  const BPM = 122
  const outfits = [0xd4af37, 0xc2185b, 0x1e88e5, 0xffffff, 0x111111, 0x7b1fa2, 0x00a884, 0xff7043]
  const people: Array<{ o: THREE.Group; base: number; yaw: number; kind: 'cheer' | 'stand'; k: number }> = []
  spec.guests.forEach(([x, z, yaw, kind], i) => {
    const woman = i % 2 === 0
    const model = woman ? WOMEN[(i >> 1) % WOMEN.length]! : MEN[(i >> 1) % MEN.length]!
    const o = person(model, { pose: kind, height: woman ? 1.68 : 1.8, look: { top: outfits[i % outfits.length]!, bottom: woman ? outfits[(i + 3) % outfits.length]! : 0x1c1f26, shoes: 0x151515 } })
    o.position.set(x, spec.y, z); o.rotation.y = yaw
    host.add(o)
    people.push({ o, base: spec.y, yaw, kind, k: i })
  })
  const [dx, dz, dyaw] = spec.dj
  const dj = person('man3', { pose: 'stand', height: 1.8, look: { top: 0x101010, bottom: 0x101010, shoes: 0x0a0a0a } })
  dj.position.set(dx, spec.y, dz); dj.rotation.y = dyaw
  host.add(dj)
  // Booth: a black console with a lit front, two decks and a mixer.
  const booth = new THREE.Group()
  cube(booth, 1.9, 1.05, 0.7, std(0x0d0e10, 0.35, 0.3), 0, 0.525, 0)
  const strip = cube(booth, 1.86, 0.08, 0.02, glow(0xff2bd6), 0, 0.82, 0.36, false)
  for (const sx of [-0.55, 0.55]) { const deck = put(booth, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), std(0x222428, 0.3, 0.6), sx, 1.07, 0); deck.userData.spin = true }
  cube(booth, 0.36, 0.05, 0.4, std(0x2b2e33, 0.4, 0.4), 0, 1.075, 0)
  booth.position.set(dx + Math.sin(dyaw) * 0.6, spec.y, dz + Math.cos(dyaw) * 0.6); booth.rotation.y = dyaw
  host.add(booth)
  // LED dance floor.
  const { x: fx, z: fz, cols, rows, size } = spec.floor
  const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(size * 0.94, size * 0.94).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ toneMapped: false }), cols * rows)
  const mm = new THREE.Matrix4(), col = new THREE.Color()
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { tiles.setMatrixAt(i * rows + j, mm.makeTranslation(fx + (i - (cols - 1) / 2) * size, spec.y + 0.012, fz + (j - (rows - 1) / 2) * size)); tiles.setColorAt(i * rows + j, col.setHSL(((i + j) * 0.13) % 1, 0.9, 0.5)) }
  tiles.receiveShadow = false
  host.add(tiles)
  // Coloured light from the area's own lamp (no new lights, so nothing recompiles mid-party).
  const lamp = X.light
  lamp.userData.held = true
  host.add(lamp); lamp.position.set(...spec.lightAt); lamp.intensity = 0; lamp.distance = 16
  const music = partyMusic()
  let on = false
  let lastBeat = -1
  X.onLeave(() => { music.stop(); lamp.userData.held = false })
  return {
    get on() { return on },
    start() { if (on) return; on = true; music.start() },
    stop() { if (!on) return; on = false; music.stop(); lamp.intensity = 0 },
    tick(t: number) {
      const beat = (t * BPM) / 60
      const bounce = Math.abs(Math.sin(beat * Math.PI))
      for (const p of people) {
        if (p.kind === 'cheer') { p.o.position.y = p.base + bounce * 0.09; p.o.rotation.y = p.yaw + Math.sin(beat * 0.5 + p.k) * 0.35 }
        else { p.o.position.y = p.base + bounce * 0.025; p.o.rotation.y = p.yaw + Math.sin(beat * 0.25 + p.k) * 0.18; p.o.rotation.z = Math.sin(beat * Math.PI + p.k) * 0.03 }
      }
      dj.position.y = spec.y + bounce * 0.03
      booth.traverse((o) => { if (o.userData.spin) o.rotation.y = t * 3.5 })
      const b = Math.floor(beat)
      if (b !== lastBeat) {
        lastBeat = b
        for (let i = 0; i < cols * rows; i++) tiles.setColorAt(i, col.setHSL(((b * 0.17 + i * 0.29 + (i % 3) * 0.11) % 1), 0.95, on ? 0.5 : 0.18))
        if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true
        ;(strip.material as THREE.MeshBasicMaterial).color.setHSL((b * 0.11) % 1, 1, 0.55)
      }
      if (on) { lamp.color.setHSL((t * 0.08) % 1, 0.85, 0.6); lamp.intensity = 5 + bounce * 6 } else lamp.intensity = 0
    },
  }
}

// ---------------------------------------------------------------- the planes

/** A fuselage of revolution, nose towards +z, evenly spaced along its length so the livery maps by the metre. */
function fuselageGeo(len: number, r: number, noseLen: number, tailLen: number): THREE.BufferGeometry {
  const n = Math.round(len / 0.5)
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const y = -len / 2 + (i / n) * len
    const fromNose = len / 2 - y, fromTail = y + len / 2
    let rr = r
    if (fromNose < noseLen) { const u = fromNose / noseLen; rr = r * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))) }
    else if (fromTail < tailLen) { const u = fromTail / tailLen; rr = r * (0.16 + 0.84 * Math.pow(u, 0.7)) }
    pts.push(new THREE.Vector2(Math.max(0.002, rr), y))
  }
  return new THREE.LatheGeometry(pts, 32).rotateX(Math.PI / 2)
}
/** Livery: u runs round the fuselage (0 belly, 0.25 the +x side, 0.5 the crown), v along it (canvas top = nose). */
function livery(kind: 'liner' | 'vip', len: number, r: number): THREE.CanvasTexture {
  const W = 512, H = 1024
  const vip = kind === 'vip'
  return tex(W, H, (g) => {
    g.fillStyle = vip ? '#15171b' : '#f6f7f5'; g.fillRect(0, 0, W, H)
    g.fillStyle = vip ? '#0b0c0e' : '#c8cdd2'; g.fillRect(0, 0, W * 0.14, H); g.fillRect(W * 0.86, 0, W * 0.14, H)
    const accent = vip ? '#d8b25a' : '#14a058'
    // Cheatline below the windows, and a thinner one under it.
    for (const u of [0.245, 0.755]) { g.fillStyle = accent; g.fillRect(W * u - 7, 0, 14, H); g.fillRect(W * (u < 0.5 ? u - 0.035 : u + 0.035) - 2, 0, 4, H) }
    // Windows.
    const pxM = H / len
    const win = vip ? { gap: 1.25, h: 0.55, w: 0.62 } : { gap: 0.56, h: 0.3, w: 0.4 }
    const wpx = W / (2 * Math.PI * r)
    g.fillStyle = vip ? '#3a3f47' : '#20262e'
    for (const u of [0.285, 0.715]) {
      for (let m = 7.2; m < len - 6.5; m += win.gap) {
        const y = m * pxM, x = W * u
        g.beginPath(); g.roundRect(x - (win.w * wpx) / 2, y - (win.h * pxM) / 2, win.w * wpx, win.h * pxM, Math.min(win.w * wpx, win.h * pxM) * 0.45); g.fill()
      }
      // Door outlines, front and back.
      g.strokeStyle = vip ? '#3a3f47' : '#b9bfc5'; g.lineWidth = 2
      for (const m of [4.6, len - 6.2]) g.strokeRect(W * u - 0.5 * wpx, m * pxM - 0.45 * pxM, 1.0 * wpx, 0.9 * pxM)
    }
    // Cockpit windows.
    g.fillStyle = '#1a2129'
    for (const [a, b] of [[0.3, 0.46], [0.54, 0.7]] as const) { g.beginPath(); g.moveTo(W * a, 1.35 * pxM); g.lineTo(W * b, 1.0 * pxM); g.lineTo(W * b, 1.7 * pxM); g.lineTo(W * a, 2.0 * pxM); g.fill() }
    // Titles along both sides, reading the right way round on each.
    g.fillStyle = accent; g.font = `900 ${Math.round(0.78 * wpx)}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'center'
    const title = vip ? 'GRIND ONE' : 'GRIND AIR'
    g.save(); g.translate(W * 0.355, (len * 0.42) * pxM); g.rotate(Math.PI / 2); g.fillText(title, 0, 0); g.restore()
    g.save(); g.translate(W * 0.645, (len * 0.42) * pxM); g.rotate(-Math.PI / 2); g.fillText(title, 0, 0); g.restore()
  })
}
function wingGeo(side: 1 | -1, rx: number, rle: number, rte: number, tx: number, tle: number, tte: number, thick: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(side * rx, rle); s.lineTo(side * tx, tle); s.lineTo(side * tx, tte); s.lineTo(side * rx, rte); s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.35, bevelSize: Math.min(0.12, thick * 0.4), bevelSegments: 1 }).rotateX(Math.PI / 2)
}
/** Inside the long-haul airliner: First suites up front, Business pods, then Economy rows, under a lit ceiling,
 * with real windows cut in the cabin walls (the fuselage skin is invisible from inside, so the sky shows through). */
function linerCabin(floorY: number): { group: THREE.Group; seats: Record<Cabin, THREE.Vector3> } {
  const g = new THREE.Group()
  const Z0 = -11.4, Z1 = 10.8, W = 2.2
  const carpet = std(0x34404f, 0.95), cream = std(0xefe9df, 0.7), grey = std(0xd9dcdf, 0.6)
  cube(g, W * 2, 0.06, Z1 - Z0, carpet, 0, floorY - 0.03, (Z0 + Z1) / 2, false)
  const wallTex = tex(1024, 96, (c) => {
    c.fillStyle = '#efe9df'; c.fillRect(0, 0, 1024, 96)
    c.globalCompositeOperation = 'destination-out'
    const n = Math.round((Z1 - Z0) / 0.95)
    for (let k = 0; k < n; k++) { c.beginPath(); c.roundRect(((k + 0.5) / n) * 1024 - 11, 26, 22, 40, 10); c.fill() }
  })
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, 1.25), new THREE.MeshStandardMaterial({ map: wallTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }))
    wall.position.set(s * W, floorY + 1.05, (Z0 + Z1) / 2); wall.rotation.y = -s * Math.PI / 2; g.add(wall)
    const low = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, 0.45), cream); low.position.set(s * W, floorY + 0.22, (Z0 + Z1) / 2); low.rotation.y = -s * Math.PI / 2; low.material.side = THREE.DoubleSide; g.add(low)
    // Overhead bins over Business and Economy.
    cube(g, 0.62, 0.42, 16, grey, s * (W - 0.33), floorY + 2.08, -3.4, false)
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, Z1 - Z0), std(0xf4f2ee, 0.8)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, floorY + 2.42, (Z0 + Z1) / 2); g.add(ceil)
  for (const s of [-1, 1]) cube(g, 0.08, 0.02, Z1 - Z0, glow(0xfff2d8), s * 0.9, floorY + 2.4, (Z0 + Z1) / 2, false)
  cube(g, W * 2, 2.4, 0.08, cream, 0, floorY + 1.2, Z1, false)
  cube(g, W * 2, 2.4, 0.08, cream, 0, floorY + 1.2, Z0, false)
  // Class dividers with a gap for the aisle.
  for (const z of [-1.7, 5.4]) for (const s of [-1, 1]) cube(g, W - 0.55, 2.0, 0.06, std(0x223040, 0.6), s * (W + 0.55) / 2, floorY + 1.0, z, false)
  // Economy: rows of 3 + 3 (instanced), a trolley in the aisle.
  const ecoX = [-1.85, -1.37, -0.89, 0.89, 1.37, 1.85], rows: number[] = []
  for (let z = -2.9; z > Z0 + 0.6; z -= 0.92) rows.push(z)
  const fabric = std(0x1f4f63, 0.9), head = std(0xf4f4f2, 0.8)
  const n = ecoX.length * rows.length
  const base = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.12, 0.46), fabric, n)
  const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.66, 0.09), fabric, n)
  const rest = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), head, n)
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.12), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3()
  let i = 0
  for (const z of rows) for (const x of ecoX) {
    base.setMatrixAt(i, mm.makeTranslation(x, floorY + 0.42, z))
    back.setMatrixAt(i, mm.compose(v.set(x, floorY + 0.8, z - 0.24), q, one))
    rest.setMatrixAt(i, mm.compose(v.set(x, floorY + 1.08, z - 0.26), q, one))
    i++
  }
  for (const im of [base, back, rest]) g.add(im)
  cube(g, 0.38, 1.0, 0.75, std(0xc9ced4, 0.4, 0.6), 0, floorY + 0.5, -2.4)
  // Business: four pods with shells, screens and ottomans.
  const shell = std(0xe8e6e1, 0.4), dark = std(0x2b2f36, 0.7), screenM = std(0x0b1220, 0.25, 0, { emissive: 0x2a5c8a, emissiveIntensity: 0.8 })
  for (const z of [0.2, 2.9]) for (const s of [-1, 1]) {
    const x = s * 1.42
    cube(g, 0.66, 0.14, 0.72, dark, x, floorY + 0.42, z)
    const bk = cube(g, 0.66, 0.85, 0.12, dark, x, floorY + 0.88, z - 0.38); bk.rotation.x = -0.18
    cube(g, 0.08, 1.15, 2.1, shell, x - s * 0.42, floorY + 0.58, z + 0.45)
    cube(g, 0.95, 1.15, 0.08, shell, x, floorY + 0.58, z - 0.6)
    cube(g, 0.5, 0.38, 0.42, dark, x, floorY + 0.19, z + 1.05)
    cube(g, 0.52, 0.32, 0.03, screenM, x, floorY + 0.95, z + 1.36, false)
  }
  // First: two suites with walnut walls, a wide seat, a bed, a big screen and a lamp.
  const walnut = std(0x5a3a22, 0.45), gold = std(0xd8b25a, 0.3, 0.85), leather = std(0xe9e1d2, 0.6)
  for (const s of [-1, 1]) {
    const x = s * 1.32
    cube(g, 0.08, 1.3, 4.2, walnut, s * 0.42, floorY + 0.65, 8.0)
    cube(g, 0.09, 0.04, 4.2, gold, s * 0.42, floorY + 1.32, 8.0, false)
    cube(g, 1.7, 1.3, 0.08, walnut, x, floorY + 0.65, 10.1)
    cube(g, 0.82, 0.16, 0.8, leather, x, floorY + 0.42, 7.0)
    const sb = cube(g, 0.82, 0.95, 0.16, leather, x, floorY + 0.95, 6.55); sb.rotation.x = -0.15
    cube(g, 0.82, 0.42, 1.4, leather, x, floorY + 0.21, 8.9)
    cube(g, 0.3, 0.62, 0.7, walnut, x + s * 0.55, floorY + 0.31, 7.0)
    put(g, new THREE.SphereGeometry(0.08, 10, 8), glow(0xffd9a0), x + s * 0.55, floorY + 0.95, 7.2, false)
    put(g, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), gold, x + s * 0.55, floorY + 0.77, 7.2)
    cube(g, 1.0, 0.56, 0.03, screenM, x, floorY + 1.0, 10.05, false)
  }
  g.traverse((o) => { o.castShadow = false })
  // A few fellow passengers and the crew.
  const pax: Array<[number, number, 'woman1' | 'man2' | 'woman3' | 'man4' | 'woman2' | 'man1']> = [[-1.85, rows[2]!, 'woman1'], [0.89, rows[1]!, 'man2'], [1.37, rows[3]!, 'woman3'], [-0.89, rows[4]!, 'man4'], [1.42, 0.2, 'woman2'], [1.32, 7.0, 'man1']]
  for (const [x, z, m] of pax) { const p = person(m, { pose: 'sit', seatY: 0.48, height: m.startsWith('w') ? 1.66 : 1.78 }); p.position.set(x, floorY, z); g.add(p) }
  const crew = person('woman4', { pose: 'stand', height: 1.7, look: { top: 0x14a058, bottom: 0x1c1f26, shoes: 0x111111 } }); crew.position.set(0, floorY, -1.0); crew.rotation.y = Math.PI; g.add(crew)
  return { group: g, seats: { eco: new THREE.Vector3(-1.37, floorY, rows[2]!), biz: new THREE.Vector3(-1.42, floorY, 2.9), first: new THREE.Vector3(-1.32, floorY, 7.0) } }
}
type Jet = { group: THREE.Group; gear: THREE.Group; floorY: number; cabin: THREE.Group | null; seats: Record<Cabin, THREE.Vector3> | null; tick: (t: number, airborne: boolean) => void }
function jet(kind: 'liner' | 'vip', interior = false): Jet {
  const vip = kind === 'vip'
  const len = 34, r = vip ? 2.7 : 2.5, axis = vip ? 3.7 : 3.4
  const group = new THREE.Group()
  const body = std(0xffffff, 0.32, 0.25, { map: livery(kind, len, r) })
  const paint = vip ? std(0x15171b, 0.28, 0.4) : std(0xf2f3f1, 0.34, 0.25)
  const accent = vip ? std(0xd8b25a, 0.3, 0.8) : std(0x14a058, 0.45, 0.1)
  const metal = std(0xc9ced4, 0.3, 0.8)
  const dark = std(0x1a1d22, 0.5, 0.3)
  const fus = put(group, fuselageGeo(len, r, vip ? 5.2 : 4.2, vip ? 9.6 : 8.4), body, 0, axis, 0)
  fus.castShadow = true
  // Wings, low on the fuselage, swept, with winglets.
  const wingY = axis - r * 0.62
  const span = vip ? 17 : 16, root = vip ? 7.2 : 6.8, sweep = 0.58
  const rle = vip ? 3.0 : 2.4
  for (const side of [1, -1] as const) {
    const w = new THREE.Group(); w.position.set(0, wingY, 0); w.rotation.z = side * 0.07
    put(w, wingGeo(side, r * 0.7, rle, rle - root, span, rle - (span - r) * sweep, rle - (span - r) * sweep - root * 0.3, 0.32), paint, 0, 0.16, 0)
    const tipZ = rle - (span - r) * sweep
    const wl = new THREE.Shape(); wl.moveTo(0, 0); wl.lineTo(-root * 0.3, 0); wl.lineTo(-root * 0.3 - 0.5, 1.6); wl.lineTo(-0.9, 1.6); wl.closePath()
    const wlg = new THREE.ExtrudeGeometry(wl, { depth: 0.1, bevelEnabled: false }).rotateY(-Math.PI / 2)
    put(w, wlg, accent, side * span + 0.05, 0.12, tipZ)
    // Navigation light at the tip (port red on +x, starboard green on -x).
    put(w, new THREE.SphereGeometry(0.12, 8, 6), glow(side > 0 ? 0xff2a2a : 0x2aff6a), side * (span + 0.1), 0.05, tipZ - 0.4, false)
    group.add(w)
    // Engine: nacelle, intake lip, fan and spinner, exhaust cone, pylon.
    const ex = side * (vip ? 6.4 : 6.1)
    const nr = vip ? 1.15 : 1.08, nl = vip ? 4.2 : 4.0
    const ez = rle - (Math.abs(ex) - r * 0.7) * sweep + nl * 0.45
    const eng = new THREE.Group(); eng.position.set(ex, wingY - nr - 0.25, ez)
    put(eng, new THREE.CylinderGeometry(nr, nr * 0.86, nl, 24, 1, true).rotateX(Math.PI / 2), vip ? paint : std(0xdde1e5, 0.3, 0.5))
    put(eng, new THREE.TorusGeometry(nr * 0.97, 0.09, 8, 28), metal, 0, 0, nl / 2)
    put(eng, new THREE.CircleGeometry(nr * 0.93, 24), dark, 0, 0, nl / 2 - 0.25)
    put(eng, new THREE.ConeGeometry(nr * 0.28, 0.6, 16).rotateX(Math.PI / 2), metal, 0, 0, nl / 2 - 0.05)
    put(eng, new THREE.ConeGeometry(nr * 0.55, 1.0, 16).rotateX(-Math.PI / 2), dark, 0, 0, -nl / 2 - 0.45)
    cube(eng, 0.26, 0.7, nl * 0.7, paint, 0, nr + 0.25, -0.2)
    group.add(eng)
  }
  // Tail: fin with the logo on both sides, tailplanes.
  const finRoot = axis + r * 0.55, finH = vip ? 7.2 : 6.2
  const zt = -len / 2
  const fin = new THREE.Shape(); fin.moveTo(zt + 5.4, 0); fin.lineTo(zt + 2.0, finH); fin.lineTo(zt + 0.5, finH); fin.lineTo(zt + 0.1, 0); fin.closePath()
  const finMat = vip ? std(0x15171b, 0.3, 0.4) : std(0x14a058, 0.45, 0.1)
  put(group, new THREE.ExtrudeGeometry(fin, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 }).rotateY(-Math.PI / 2), finMat, 0.12, finRoot, 0)
  const logo = tex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256)
    g.strokeStyle = vip ? '#d8b25a' : '#ffffff'; g.lineWidth = 16; g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.stroke()
    g.fillStyle = vip ? '#d8b25a' : '#ffffff'; g.font = `900 150px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(vip ? '1' : 'G', 128, 138)
  })
  const logoMat = new THREE.MeshBasicMaterial({ map: logo, transparent: true, depthWrite: false })
  for (const side of [1, -1]) { const p = put(group, new THREE.PlaneGeometry(2.6, 2.6), logoMat, side * 0.2, finRoot + finH * 0.5, zt + 2.6, false); p.rotation.y = side * Math.PI / 2 }
  for (const side of [1, -1] as const) put(group, wingGeo(side, 0.3, zt + 4.8, zt + 2.0, vip ? 6.4 : 5.4, zt + 1.6, zt + 0.4, 0.2), paint, 0, axis + 0.35, 0)
  // Lights: red beacons top and bottom, a white strobe on the tail.
  const beaconMat = glow(0xff2020)
  const beacons = [put(group, new THREE.SphereGeometry(0.16, 8, 6), beaconMat, 0, axis + r + 0.05, 0, false), put(group, new THREE.SphereGeometry(0.16, 8, 6), beaconMat, 0, axis - r - 0.05, 2, false)]
  const strobe = put(group, new THREE.SphereGeometry(0.14, 8, 6), glow(0xffffff), 0, axis + 0.2, zt - 0.1, false)
  // Landing gear.
  const gear = new THREE.Group()
  const tyre = std(0x16171a, 0.85)
  const wheel = (x: number, z: number, rr: number) => { const w = put(gear, new THREE.CylinderGeometry(rr, rr, 0.34, 16).rotateZ(Math.PI / 2), tyre, x, rr, z); w.castShadow = true }
  const nz = len / 2 - (vip ? 4.4 : 3.6)
  put(gear, new THREE.CylinderGeometry(0.1, 0.1, axis - r - 0.3, 8), metal, 0, 0.45 + (axis - r - 0.3) / 2, nz)
  for (const s of [-0.24, 0.24]) wheel(s, nz, 0.42)
  for (const s of [-1, 1]) {
    const mx = s * (vip ? 3.0 : 2.5)
    put(gear, new THREE.CylinderGeometry(0.16, 0.16, wingY - 0.6, 8), metal, mx, 0.6 + (wingY - 0.6) / 2, -0.6)
    for (const dz of [-1.2, 0]) for (const dxw of [-0.32, 0.32]) wheel(mx + dxw, dz, 0.55)
  }
  group.add(gear)
  const floorY = axis - (vip ? 1.3 : 1.0)
  let cabin: THREE.Group | null = null
  let seats: Record<Cabin, THREE.Vector3> | null = null
  if (!vip && interior) { const c = linerCabin(floorY); cabin = c.group; seats = c.seats; group.add(cabin) }
  if (vip) {
    // The lounge: dark floor, cream leather lower walls, a panoramic window band, a lit ceiling, a bar.
    cabin = new THREE.Group()
    const cream = std(0xe9e1d2, 0.7)
    const black = std(0x0e0f12, 0.5, 0.2)
    const gold = std(0xd8b25a, 0.3, 0.85)
    const L0 = -9.4, L1 = 7.6, cw = 4.5
    cube(cabin, cw, 0.06, L1 - L0, black, 0, floorY - 0.03, (L0 + L1) / 2, false)
    for (const s of [-1, 1]) {
      const lower = new THREE.Mesh(new THREE.PlaneGeometry(L1 - L0, 1.0), cream); lower.position.set(s * cw / 2, floorY + 0.5, (L0 + L1) / 2); lower.rotation.y = -s * Math.PI / 2; cabin.add(lower)
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(L1 - L0, 1.15), new THREE.MeshPhysicalMaterial({ color: 0xbfd6e6, roughness: 0.05, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }))
      glass.position.set(s * cw / 2, floorY + 1.6, (L0 + L1) / 2); glass.rotation.y = -s * Math.PI / 2; cabin.add(glass)
      for (let z = L0 + 1; z < L1; z += 1.5) cube(cabin, 0.06, 1.15, 0.12, gold, s * (cw / 2 - 0.02), floorY + 1.6, z, false)
      const upper = new THREE.Mesh(new THREE.PlaneGeometry(L1 - L0, 0.3), cream); upper.position.set(s * cw / 2, floorY + 2.32, (L0 + L1) / 2); upper.rotation.y = -s * Math.PI / 2; cabin.add(upper)
      cube(cabin, 0.05, 0.05, L1 - L0, gold, s * (cw / 2 - 0.03), floorY + 1.02, (L0 + L1) / 2, false)
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(cw, L1 - L0), std(0x1b1c20, 0.6)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, floorY + 2.46, (L0 + L1) / 2); cabin.add(ceil)
    const ledMat = glow(0xff3cc8)
    for (const s of [-1, 1]) cube(cabin, 0.06, 0.03, L1 - L0, ledMat, s * 1.4, floorY + 2.43, (L0 + L1) / 2, false)
    cabin.userData.led = ledMat
    // Bulkheads with a screen at the front.
    cube(cabin, cw, 2.5, 0.1, black, 0, floorY + 1.25, L1, false)
    cube(cabin, cw, 2.5, 0.1, black, 0, floorY + 1.25, L0, false)
    const screen = cube(cabin, 2.6, 1.2, 0.03, glow(0x6a2cff), 0, floorY + 1.55, L1 - 0.07, false)
    cabin.userData.screen = screen
    // Bar on the right, sofas on the left (towards the back).
    // Bar up front on the right, by the DJ, where you can see it from the dance floor.
    cube(cabin, 0.7, 1.05, 3.0, std(0x101114, 0.25, 0.4), 1.75, floorY + 0.525, 4.6)
    cube(cabin, 0.74, 0.05, 3.04, gold, 1.75, floorY + 1.07, 4.6, false)
    for (let k = 0; k < 6; k++) put(cabin, new THREE.CylinderGeometry(0.05, 0.06, 0.32, 10), std([0x7ad3ff, 0xffd36b, 0xff7ab5, 0x9cff8a][k % 4]!, 0.1, 0.2, { emissive: [0x7ad3ff, 0xffd36b, 0xff7ab5, 0x9cff8a][k % 4]!, emissiveIntensity: 0.6 }), 1.82, floorY + 1.25, 3.5 + k * 0.42, false)
    for (const z of [-7.6, -5.4]) { cube(cabin, 0.75, 0.42, 1.9, cream, -1.82, floorY + 0.21, z); cube(cabin, 0.2, 0.55, 1.9, cream, -2.12, floorY + 0.6, z) }
    // Disco ball and four light beams.
    const ballTex = tex(128, 64, (g) => { for (let i = 0; i < 32; i++) for (let j = 0; j < 16; j++) { const v = 120 + Math.floor(Math.random() * 135); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * 4, j * 4, 3.5, 3.5) } })
    const ball = put(cabin, new THREE.SphereGeometry(0.3, 20, 12), std(0xffffff, 0.15, 1, { map: ballTex, emissive: 0xffffff, emissiveMap: ballTex, emissiveIntensity: 0.4 }), 0, floorY + 2.05, 0.6, false)
    cabin.userData.ball = ball
    const beams: THREE.Mesh[] = []
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.9, 12, 1, true).translate(0, -0.95, 0), new THREE.MeshBasicMaterial({ color: [0xff3cc8, 0x3cc8ff, 0xffe03c, 0x6aff3c][k]!, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
      b.position.copy(ball.position); cabin.add(b); beams.push(b)
    }
    cabin.userData.beams = beams
    group.add(cabin)
  }
  return {
    group, gear, floorY, cabin, seats,
    tick(t, airborne) {
      const flash = (t * 1.1) % 1 < 0.08
      for (const b of beacons) b.visible = flash
      strobe.visible = airborne && (t * 1.3) % 1 < 0.05
      if (cabin && cabin.userData.ball) {
        const ball = cabin.userData.ball as THREE.Mesh; ball.rotation.y = t * 0.8
        // Beams sweep forward over the crowd, never back at the camera.
        ;(cabin.userData.beams as THREE.Mesh[]).forEach((b, k) => { b.rotation.set(-0.55 - Math.sin(t * 1.3 + k) * 0.3, 0, Math.sin(t * 0.9 + k * 1.7) * 0.7) })
        ;(cabin.userData.led as THREE.MeshBasicMaterial).color.setHSL((t * 0.09) % 1, 1, 0.55)
        ;((cabin.userData.screen as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHSL((t * 0.05 + 0.6) % 1, 0.8, 0.35 + Math.abs(Math.sin(t * 4)) * 0.1)
      }
    },
  }
}

// ---------------------------------------------------------------- moving along a route

export type Leg = { curve: THREE.CatmullRomCurve3; L: number; v: number[]; rev: boolean }
export function leg(pts: number[][], rev = false): Leg {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal')
  curve.arcLengthDivisions = Math.max(200, Math.round(curve.getLength() / 3))
  return { curve, L: curve.getLength(), v: pts.map((p) => p[3]!), rev }
}
/** A route of legs with speeds set at each point; time-sampled so a Move can play it back. */
export function route(legs: Leg[]) {
  const DT = 1 / 30
  const sampleV = (lg: Leg, s: number) => {
    const t = lg.curve.getUtoTmapping(Math.min(1, Math.max(0, s / lg.L)), 0) * (lg.v.length - 1)
    const i = Math.min(lg.v.length - 2, Math.floor(t)), f = t - i
    return lerp(lg.v[i]!, lg.v[i + 1]!, f)
  }
  const steps: Array<[number, number]> = [] // [leg, s]
  legs.forEach((lg, li) => {
    let s = 0
    steps.push([li, 0])
    let guard = 0
    while (s < lg.L && guard++ < 40000) { s = Math.min(lg.L, s + Math.max(0.6, sampleV(lg, s)) * DT); steps.push([li, s]) }
    for (let k = 0; k < 8; k++) steps.push([li, lg.L]) // a breath between legs
  })
  const T = (steps.length - 1) * DT
  const p = new THREE.Vector3(), tan = new THREE.Vector3(), q = new THREE.Vector3()
  const at = (time: number) => {
    const k = Math.min(steps.length - 1, Math.max(0, time / DT))
    const i = Math.floor(k), j = Math.min(steps.length - 1, i + 1), f = k - i
    const [li, s0] = steps[i]!, [lj, s1] = steps[j]!
    const lg = legs[li]!
    const s = lj === li ? lerp(s0, s1, f) : s0
    const u = Math.min(1, Math.max(0, s / lg.L))
    lg.curve.getPointAt(u, p)
    lg.curve.getTangentAt(u, tan)
    if (lg.rev) tan.multiplyScalar(-1)
    // Turn rate for banking: heading a few metres back and ahead.
    const ua = Math.max(0, u - 6 / lg.L), ub = Math.min(1, u + 6 / lg.L)
    lg.curve.getTangentAt(ua, q); const ha = Math.atan2(q.x, q.z)
    lg.curve.getTangentAt(ub, q); const hb = Math.atan2(q.x, q.z)
    const turn = ub > ua ? wrapA(hb - ha) / ((ub - ua) * lg.L) : 0
    const speed = (lj === li ? s1 - s0 : 0) / DT
    return { p, tan, turn, speed, leg: li, s }
  }
  return { T, at }
}

// ---------------------------------------------------------------- the airport

// Layout (world metres). Terminal x 200..224, z -24..56; stands nose-in to its east side; taxiway x 272;
// runway x 289..311 from the shore (z -78) to z 112, flown north (towards the sea) and landed southbound.
const RWY = { x: 300, z0: -78, z1: 112, w: 22 }
const STAND_A1 = { x: 245, z: 0 }, STAND_A2 = { x: 245, z: 34 }, STAND_VIP = { x: 247, z: 72 }

/** GA 101 and the party jet share the runway, the climb out over the bay and the landing; the jet circles the city. */
function flightLegs(kind: 'liner' | 'vip'): Leg[] {
  const st = kind === 'vip' ? STAND_VIP : STAND_A1
  const push = leg([[st.x, 0, st.z, 0.8], [st.x + 7, 0, st.z, 2.6], [st.x + 14, 0, st.z - 2.5, 2.6], [st.x + 19, 0, st.z - 8, 0.8]], true)
  const roll: number[][] = [
    [st.x + 19, 0, st.z - 8, 1], [st.x + 23, 0, st.z + 4, 8], [272, 0, st.z + 18, 10], [272, 0, 92, 10], [276, 0, 104, 7], [288, 0, 110, 6], [298, 0, 104, 6], [300, 0, 92, 7],
    [300, 0, 70, 20], [300, 0, 32, 42], [300, 0.5, -6, 54], [300, 9, -40, 58], [300, 28, -90, 62], [296, 52, -150, 64], [276, 82, -205, 64],
    ...(kind === 'vip'
      ? [[226, 108, -240, 64], [150, 130, -256, 64], [60, 146, -250, 64], [-20, 150, -235, 64], [-85, 150, -210, 64], [-135, 150, -160, 64], [-152, 150, -90, 64]]
      // GA 101 cruises far out over the sea first: time in your cabin, with the coast on the horizon.
      : [[240, 112, -290, 60], [170, 138, -430, 50], [40, 152, -540, 46], [-90, 156, -520, 46], [-170, 154, -420, 48], [-170, 152, -300, 54], [-128, 150, -200, 62], [-152, 150, -90, 64]]),
  ]
  const city: number[][] = kind === 'vip'
    ? [[-122, 155, 0, 42], [-62, 156, 72, 40], [30, 156, 102, 40], [104, 156, 62, 40], [118, 156, -28, 40], [64, 156, -100, 40], [-30, 156, -118, 40], [-106, 156, -72, 40], [-128, 156, 18, 40], [-82, 155, 96, 42], [10, 153, 128, 50], [100, 150, 140, 58]]
    : [[-112, 150, -20, 62], [-45, 150, 30, 60], [25, 150, 76, 60], [95, 148, 115, 62]]
  const home: number[][] = [
    [175, 140, 140, 64], [275, 125, 140, 64], [370, 110, 100, 64], [430, 95, 20, 62], [440, 85, -80, 60], [410, 75, -170, 58], [360, 64, -226, 56], [312, 54, -232, 54],
    [300, 44, -196, 52], [300, 30, -150, 48], [300, 16, -110, 46], [300, 5, -80, 44], [300, 0.4, -60, 40], [300, 0, -30, 34], [300, 0, 10, 26], [300, 0, 40, 13], [295, 0, 52, 8],
    [284, 0, 58, 8], [275, 0, 52, 8], [272, 0, 40, 9],
  ]
  const taxiIn: number[][] = kind === 'vip'
    ? [[272, 0, 56, 9], [271, 0, 66, 7], [264, 0, 71, 5], [256, 0, st.z, 3], [st.x, 0, st.z, 0.5]]
    : [[272, 0, 20, 9], [272, 0, 8, 7], [266, 0, 1, 5], [256, 0, st.z, 3], [st.x, 0, st.z, 0.5]]
  return [push, leg([...roll, ...city, ...home, ...taxiIn])]
}

export function buildAirport(A: Arch, X: TravelCtx): void {
  const add = (o: THREE.Object3D) => A.add(0, o)
  const g = new THREE.Group(); add(g)
  // --- Countryside round the city (only while you are here): grass to the horizon, fields and trees.
  const grassTex = tex(256, 256, (c) => {
    c.fillStyle = '#5d8a45'; c.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2600; i++) { const v = Math.random(); c.fillStyle = v < 0.5 ? 'rgba(70,110,50,0.5)' : 'rgba(120,150,80,0.35)'; c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2) }
  }, [260, 260])
  const land = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1300), std(0xffffff, 1, 0, { map: grassTex })); land.rotation.x = -Math.PI / 2; land.position.set(0, -0.06, 575); land.receiveShadow = true; add(land)
  const fieldCols = [0x8ea85a, 0xb9a865, 0x6f9a4c, 0xa7b86a, 0x7fa255, 0xc2b06e]
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const clear = (x: number, z: number, pad: number) => z < -72 || (x > 120 - pad && x < 350 + pad && z > -90 && z < 135 + pad) || Math.hypot(x, z) < 165 + pad || (Math.abs(x) < 90 + pad && z > 120 && z < 270 + pad) || (x > -220 - pad && x < -100 + pad && z > 90 - pad && z < 215 + pad) || Math.hypot(x - 150, z - 118) < 60 + pad
  for (let k = 0; k < 26; k++) {
    const x = (rnd() - 0.5) * 1300, z = -60 + rnd() * 700, w = 40 + rnd() * 70, d = 40 + rnd() * 70
    if (clear(x, z, Math.max(w, d) * 0.6)) continue
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(fieldCols[k % fieldCols.length]!, 1)); f.rotation.x = -Math.PI / 2; f.rotation.z = rnd() * 0.6; f.position.set(x, -0.045, z); f.receiveShadow = true; add(f)
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6).translate(0, 1.5, 0), std(0x5a4632, 0.9), 520)
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.4, 0), std(0xffffff, 0.85, 0, { flatShading: true }), 520)
  let nT = 0
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), ss = new THREE.Vector3(), vv = new THREE.Vector3(), cc = new THREE.Color()
  for (let k = 0; k < 2400 && nT < 520; k++) {
    // Clumps: pick a centre, then a few trees round it.
    const cx = (rnd() - 0.5) * 1300, cz = -60 + rnd() * 720
    if (clear(cx, cz, 8)) continue
    const n = 3 + Math.floor(rnd() * 6)
    for (let j = 0; j < n && nT < 520; j++) {
      const x = cx + (rnd() - 0.5) * 22, z = cz + (rnd() - 0.5) * 22, s = 0.7 + rnd() * 0.9
      mm.compose(vv.set(x, 0, z), qq.setFromAxisAngle(ss.set(0, 1, 0), rnd() * 6), ss.set(s, s * (0.9 + rnd() * 0.4), s))
      trunks.setMatrixAt(nT, mm); crowns.setMatrixAt(nT, mm); crowns.setColorAt(nT, cc.setHSL(0.27 + rnd() * 0.06, 0.45, 0.25 + rnd() * 0.12)); nT++
    }
  }
  trunks.count = crowns.count = nT
  for (const im of [trunks, crowns]) { im.castShadow = false; im.computeBoundingSphere(); add(im) }

  // --- Airfield surfaces.
  const asphaltTex = tex(256, 256, (c) => { c.fillStyle = '#3b3e42'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 3000; i++) { const v = 40 + Math.random() * 40; c.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; c.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5) } }, [8, 60])
  const flat = (w: number, d: number, m: THREE.Material, x: number, z: number, y: number) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; add(p); return p }
  const concrete = tex(256, 256, (c) => { c.fillStyle = '#b9b8b3'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(80,80,80,0.35)'; c.lineWidth = 2; for (let i = 0; i <= 256; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke() } for (let i = 0; i < 1600; i++) { c.fillStyle = 'rgba(90,90,90,0.12)'; c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2) } }, [12, 24])
  flat(64, 128, std(0xffffff, 0.9, 0, { map: concrete }), 256, 30, 0.006)
  flat(14, 146, std(0xffffff, 0.85, 0, { map: asphaltTex }), 272, 41, 0.009)
  flat(22, 16, std(0xffffff, 0.85, 0, { map: asphaltTex }), 282, 104, 0.009)
  flat(22, 14, std(0xffffff, 0.85, 0, { map: asphaltTex }), 282, 52, 0.009)
  // Runway with its markings: edge lines, centre line, thresholds ("piano keys"), numbers, touchdown bars.
  const rwLen = RWY.z1 - RWY.z0
  const marks = tex(256, 2048, (c) => {
    c.fillStyle = '#34373b'; c.fillRect(0, 0, 256, 2048)
    for (let i = 0; i < 9000; i++) { const v = 45 + Math.random() * 30; c.fillStyle = `rgba(${v},${v},${v},0.4)`; c.fillRect(Math.random() * 256, Math.random() * 2048, 1.5, 1.5) }
    c.fillStyle = '#f2f2ee'
    c.fillRect(8, 0, 5, 2048); c.fillRect(243, 0, 5, 2048)
    for (let y = 150; y < 1898; y += 52) c.fillRect(126, y, 4, 30)
    const keys = (y0: number) => { for (let k = 0; k < 8; k++) { const x = 24 + k * 27 + (k >= 4 ? 10 : 0); c.fillRect(x, y0, 13, 60) } }
    keys(20); keys(2048 - 80)
    for (const y of [240, 340, 2048 - 300, 2048 - 400]) { c.fillRect(56, y, 22, 50); c.fillRect(178, y, 22, 50) }
    c.font = `900 82px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'
    c.save(); c.translate(128, 2048 - 150); c.fillText('36', 0, 0); c.restore()
    c.save(); c.translate(128, 150); c.rotate(Math.PI); c.fillText('18', 0, 0); c.restore()
  })
  const runway = flat(RWY.w, rwLen, std(0xffffff, 0.8, 0, { map: marks }), RWY.x, (RWY.z0 + RWY.z1) / 2, 0.012)
  void runway
  // Taxiway centre line (yellow) and stand lead-in lines.
  const yellow = std(0xf2c230, 0.6)
  flat(0.3, 146, yellow, 272, 41, 0.014)
  for (const st of [STAND_A1, STAND_A2, STAND_VIP]) { flat(30, 0.3, yellow, st.x + 3, st.z, 0.014); flat(0.3, 2.4, yellow, st.x - 13, st.z, 0.014) }
  // Edge lights: white along the runway, blue along the taxiway; approach lights out over the sea.
  const bulbs: Array<[number, number, number]> = []
  for (let z = RWY.z0 + 2; z <= RWY.z1; z += 10) for (const s of [-1, 1]) bulbs.push([RWY.x + s * (RWY.w / 2 + 0.6), 0.25, z])
  const lightGeo = new THREE.SphereGeometry(0.14, 6, 4)
  const white = new THREE.InstancedMesh(lightGeo, glow(0xfff6d8), bulbs.length)
  bulbs.forEach(([x, y, z], i) => white.setMatrixAt(i, mm.makeTranslation(x, y, z))); add(white)
  const blues: Array<[number, number]> = []
  for (let z = -28; z <= 112; z += 8) for (const s of [-1, 1]) blues.push([272 + s * 7.4, z])
  const blue = new THREE.InstancedMesh(lightGeo, glow(0x3d7bff), blues.length)
  blues.forEach(([x, z], i) => blue.setMatrixAt(i, mm.makeTranslation(x, 0.22, z))); add(blue)
  const appr: Array<[number, number]> = []
  for (let k = 0; k < 11; k++) appr.push([RWY.x, RWY.z0 - 6 - k * 6])
  for (const z of [RWY.z0 - 30, RWY.z0 - 54]) for (const dx of [-6, -3, 3, 6]) appr.push([RWY.x + dx, z])
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6).translate(0, 0.4, 0), std(0xe6e6e6, 0.5), appr.length)
  const apprL = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), glow(0xffffff), appr.length)
  appr.forEach(([x, z], i) => { posts.setMatrixAt(i, mm.makeTranslation(x, 0, z)); apprL.setMatrixAt(i, mm.makeTranslation(x, 1.25, z)) })
  add(posts); add(apprL)
  const rabbit = put(g, new THREE.SphereGeometry(0.6, 10, 8), glow(0xffffff), RWY.x, 1.25, RWY.z0 - 66, false)
  X.animate((t) => { const k = 10 - (Math.floor(t * 12) % 14); rabbit.visible = k >= 0; rabbit.position.z = RWY.z0 - 6 - Math.max(0, k) * 6 })
  // Windsock.
  {
    const ws = new THREE.Group(); ws.position.set(318, 0, 6)
    put(ws, new THREE.CylinderGeometry(0.07, 0.09, 6, 8), std(0xdddddd, 0.4, 0.6), 0, 3, 0)
    const sock = put(ws, new THREE.CylinderGeometry(0.35, 0.16, 2.2, 12, 4, true).rotateZ(Math.PI / 2).translate(1.1, 0, 0), std(0xff6a1a, 0.7, 0, { side: THREE.DoubleSide }), 0, 5.7, 0)
    add(ws)
    X.animate((t) => { sock.rotation.y = 0.7 + Math.sin(t * 0.6) * 0.25; sock.rotation.z = -0.08 + Math.sin(t * 1.7) * 0.05 })
  }
  // --- Control tower.
  {
    const tw = new THREE.Group(); tw.position.set(212, 0, -46)
    const conc = std(0xe7e4dd, 0.7)
    put(tw, new THREE.CylinderGeometry(2.2, 3.0, 32, 20), conc, 0, 16, 0)
    put(tw, new THREE.CylinderGeometry(4.6, 3.2, 1.6, 8), conc, 0, 32.8, 0)
    put(tw, new THREE.CylinderGeometry(4.7, 4.4, 3.6, 8), std(0x22303c, 0.06, 0.5, { emissive: 0x2a4a5e, emissiveIntensity: 0.4 }), 0, 35.4, 0)
    put(tw, new THREE.CylinderGeometry(5.2, 4.8, 0.6, 8), conc, 0, 37.5, 0)
    put(tw, new THREE.CylinderGeometry(0.08, 0.08, 6, 6), std(0xcccccc, 0.4, 0.8), 0, 40.8, 0)
    const bea = put(tw, new THREE.BoxGeometry(0.6, 0.4, 0.4), glow(0x30ff7a), 0, 38.2, 0, false)
    add(tw)
    X.animate((t) => { bea.rotation.y = t * 3; (bea.material as THREE.MeshBasicMaterial).color.setHex(Math.floor(t * 1.5) % 2 ? 0x30ff7a : 0xffffff) })
    A.block(0, { x0: 209, z0: -49, x1: 215, z1: -43 })
  }
  // --- Hangar with a curved roof.
  {
    const hg = new THREE.Group(); hg.position.set(234, 0, 108)
    const shell = new THREE.CylinderGeometry(16, 16, 30, 28, 1, true, Math.PI / 2 - 1.05, 2.1).rotateZ(Math.PI / 2)
    put(hg, shell, std(0xd5d8dc, 0.45, 0.6, { side: THREE.DoubleSide }), 0, -8.3, 0)
    cube(hg, 0.4, 7.8, 27.4, std(0xb4b8bd, 0.5, 0.5), -15, 3.9, 0)
    const door = sign('GRIND AVIATION', 18, 2.2, { bg: '#123524', fg: '#ffd36b' }); door.position.set(15.3, 8.8, 0); door.rotation.y = Math.PI / 2; hg.add(door)
    add(hg)
    A.block(0, { x0: 219, z0: 94, x1: 249, z1: 122 })
  }
  // --- Terminal: curtain walls of glass, a curved roof on tree columns, a polished floor.
  const T = { x0: 200, x1: 224, z0: -24, z1: 56 }
  flat(T.x1 - T.x0, T.z1 - T.z0, std(0xe9e5de, 0.28, 0.05), (T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2, 0.02)
  A.wall(0, T.x0, T.z0, T.x0, T.z1, 9, 'glass', [[8, 20]])
  A.wall(0, T.x1, T.z0, T.x1, T.z1, 9, 'glass')
  A.wall(0, T.x0, T.z0, T.x1, T.z0, 9, 'glass')
  A.wall(0, T.x0, T.z1, T.x1, T.z1, 9, 'glass')
  {
    const R = 40, half = 16, alpha = Math.asin(half / R)
    const roof = new THREE.CylinderGeometry(R, R, 86, 40, 1, true, Math.PI - alpha, alpha * 2).rotateX(Math.PI / 2)
    const rm = put(g, roof, std(0xf1f0ec, 0.55, 0.15, { side: THREE.DoubleSide }), (T.x0 + T.x1) / 2, 12 - R, (T.z0 + T.z1) / 2, false)
    rm.receiveShadow = false
    const edge = std(0x9aa3ab, 0.3, 0.8)
    for (const s of [-1, 1]) cube(g, 0.5, 0.6, 86, edge, (T.x0 + T.x1) / 2 + s * half, 12 - R + Math.sqrt(R * R - half * half), (T.z0 + T.z1) / 2, false)
    for (const x of [206, 218]) for (let z = -16; z <= 48; z += 16) {
      put(g, new THREE.CylinderGeometry(0.32, 0.42, 8.4, 12), std(0xdfe2e5, 0.3, 0.7), x, 4.2, z)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const br = put(g, new THREE.CylinderGeometry(0.12, 0.18, 3.2, 8), std(0xdfe2e5, 0.3, 0.7), x + dx * 0.9, 9.4, z + dz * 0.9, false); br.rotation.set(dz * 0.55, 0, -dx * 0.55) }
      A.block(0, { x0: x - 0.5, z0: z - 0.5, x1: x + 0.5, z1: z + 0.5 })
    }
    const name = sign('GRIND INTERNATIONAL AIRPORT', 26, 2.0, { fg: '#1d3b2b', weight: 900 }); name.position.set(T.x0 - 0.3, 10.2, (T.z0 + T.z1) / 2); name.rotation.y = -Math.PI / 2; g.add(name)
    const name2 = sign('GRIND INTERNATIONAL', 18, 1.8, { fg: '#ffffff', weight: 900 }); name2.position.set(T.x1 + 0.3, 10.0, (T.z0 + T.z1) / 2); name2.rotation.y = Math.PI / 2; g.add(name2)
  }
  // Check-in island: counter, backlit panel, an agent, and the departures board above.
  {
    const ci = new THREE.Group()
    cube(ci, 1.0, 1.1, 14, std(0xf4f2ee, 0.3), 208.6, 0.55, 8)
    cube(ci, 0.3, 0.06, 13.6, std(0x14a058, 0.5), 208.1, 1.12, 8, false)
    cube(ci, 0.4, 2.8, 14, std(0x123524, 0.5), 210.6, 1.4, 8)
    const ga = sign('GRIND AIR  ·  CHECK-IN', 10, 1.0, { bg: '#123524', fg: '#ffd36b', glowing: true }); ga.position.set(210.38, 2.2, 8); ga.rotation.y = -Math.PI / 2; ci.add(ga)
    for (const z of [3, 8, 13]) { const sc = cube(ci, 0.05, 0.36, 0.5, std(0x0b1220, 0.25, 0, { emissive: 0x2a5c8a, emissiveIntensity: 0.7 }), 208.3, 1.32, z, false); void sc }
    const board = tex(1024, 400, (c) => {
      c.fillStyle = '#0b0f14'; c.fillRect(0, 0, 1024, 400)
      c.fillStyle = '#ffd36b'; c.font = `800 46px ${FONT}`; c.fillText('DEPARTURES', 28, 58)
      c.fillStyle = '#7f8b96'; c.font = `600 24px ${FONT}`; c.fillText('FLIGHT', 28, 104); c.fillText('TO', 190, 104); c.fillText('GATE', 640, 104); c.fillText('STATUS', 790, 104)
      const rows = [['GA 101', 'Skyline Tour (round trip)', 'A1', 'BOARDING', '#30ff7a'], ['G1', 'Party Jet · Grind One', 'LOUNGE', 'ON REQUEST', '#ffd36b'], ['GA 220', 'Lagos', 'A2', 'SCHEDULED', '#e8edf2'], ['GA 314', 'Dubai', 'A3', 'SCHEDULED', '#e8edf2'], ['GA 412', 'London', 'A4', 'SCHEDULED', '#e8edf2']]
      rows.forEach((r, i) => { const y = 152 + i * 50; c.font = `700 30px ${FONT}`; c.fillStyle = '#e8edf2'; c.fillText(r[0]!, 28, y); c.fillText(r[1]!, 190, y); c.fillText(r[2]!, 640, y); c.fillStyle = r[4]!; c.fillText(r[3]!, 790, y) })
    })
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.8), new THREE.MeshStandardMaterial({ map: board, emissive: 0xffffff, emissiveMap: board, emissiveIntensity: 0.9, roughness: 0.4 }))
    bm.position.set(210.35, 5.0, 8); bm.rotation.y = -Math.PI / 2; ci.add(bm)
    cube(ci, 0.2, 3.2, 7.6, std(0x1b1d21, 0.4, 0.5), 210.6, 5.0, 8)
    add(ci)
    A.block(0, { x0: 208, z0: 1, x1: 211, z1: 15 })
    const agent = person('woman2', { pose: 'stand', height: 1.68, look: { top: 0x14a058, bottom: 0x1c1f26, shoes: 0x111111 } }); agent.position.set(209.6, 0, 8); agent.rotation.y = -Math.PI / 2; add(agent)
  }
  // Gate lounges by the airside glass: rows of seats and a gate desk with its screen.
  const seatMat = std(0x2c3e50, 0.6), legMat = std(0x9aa3ab, 0.3, 0.8)
  const seatRow = (x: number, z: number) => { const r = new THREE.Group(); cube(r, 0.55, 0.12, 4.4, seatMat, 0, 0.46, 0); cube(r, 0.1, 0.55, 4.4, seatMat, -0.3, 0.78, 0); for (const dz of [-1.8, 1.8]) cube(r, 0.08, 0.4, 0.08, legMat, 0, 0.2, dz); r.position.set(x, 0, z); add(r); A.block(0, { x0: x - 0.4, z0: z - 2.2, x1: x + 0.4, z1: z + 2.2 }) }
  for (const z0 of [-16, 22]) for (let k = 0; k < 3; k++) { seatRow(214.5 + k * 2.2, z0); seatRow(214.5 + k * 2.2, z0 + 5.4) }
  for (const [z, gate, dest] of [[-3, 'A1', 'GA 101 · SKYLINE TOUR'], [31, 'A2', 'GA 220 · LAGOS']] as const) {
    cube(g, 1.6, 1.05, 0.7, std(0xf4f2ee, 0.3), 221.4, 0.525, z)
    const s = sign(`${gate}  ${dest}`, 3.4, 0.5, { bg: '#0b0f14', fg: '#ffd36b', glowing: true }); s.position.set(221.4, 2.4, z + 0.4); g.add(s)
    A.block(0, { x0: 220.5, z0: z - 0.4, x1: 222.3, z1: z + 0.4 })
  }
  // Café and duty free.
  {
    cube(g, 3.4, 1.05, 1.0, std(0x6b4a33, 0.5), 204.5, 0.525, 30)
    cube(g, 3.5, 0.06, 1.1, std(0xf0eee9, 0.2), 204.5, 1.08, 30, false)
    cube(g, 0.5, 0.55, 0.45, std(0xbfc4c9, 0.25, 0.9), 204.0, 1.38, 30.2)
    const cs = sign('FLAT WHITE', 3.2, 0.6, { bg: '#2a1a10', fg: '#f3d9b5' }); cs.position.set(204.5, 2.6, 30.55); g.add(cs)
    A.block(0, { x0: 202.7, z0: 29.4, x1: 206.3, z1: 30.6 })
    const df = new THREE.Group()
    for (const z of [37, 39.6, 42.2]) { cube(df, 0.6, 1.8, 2.0, std(0xf6f4f0, 0.3), 201.4, 0.9, z); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) cube(df, 0.12, 0.22, 0.12, std([0xd4af37, 0xc2185b, 0x1e88e5, 0x7ad3ff][(k + j) % 4]!, 0.15, 0.3), 201.75, 0.5 + k * 0.42, z - 0.6 + j * 0.6) }
    const dsn = sign('DUTY FREE', 4.6, 0.7, { bg: '#0b0f14', fg: '#ffffff' }); dsn.position.set(201.2, 3.0, 39.6); dsn.rotation.y = Math.PI / 2; df.add(dsn)
    add(df)
    A.block(0, { x0: 200.6, z0: 35.8, x1: 202.2, z1: 43.4 })
  }
  // Grind One Lounge (the party jet's lounge), behind a glass screen at the south end.
  {
    A.wall(0, T.x0, 45, 210, 45, 3, 'glass')
    A.wall(0, 216, 45, T.x1, 45, 3, 'glass')
    cube(g, 2.6, 1.1, 0.9, std(0xf0eee9, 0.18), 213, 0.55, 50.5)
    cube(g, 2.64, 0.06, 0.94, std(0xd8b25a, 0.3, 0.85), 213, 1.12, 50.5, false)
    const ls = sign('GRIND ONE LOUNGE', 6, 0.8, { bg: '#0b0c0e', fg: '#d8b25a', glowing: true }); ls.position.set(213, 3.6, 55.6); ls.rotation.y = Math.PI; g.add(ls)
    for (const [x, z] of [[204, 49], [204, 53], [220, 52]] as const) { cube(g, 2.4, 0.42, 0.9, std(0xe9e1d2, 0.8), x, 0.21, z); cube(g, 2.4, 0.5, 0.22, std(0xe9e1d2, 0.8), x, 0.6, z + 0.4); A.block(0, { x0: x - 1.2, z0: z - 0.5, x1: x + 1.2, z1: z + 0.6 }) }
    A.block(0, { x0: 211.6, z0: 50, x1: 214.4, z1: 51 })
    const host = person('woman3', { pose: 'stand', height: 1.7, look: { top: 0x0b0c0e, bottom: 0x0b0c0e, shoes: 0x111111 } }); host.position.set(213, 0, 51.4); host.rotation.y = Math.PI; add(host)
  }
  // Jet bridges to the airliner stands.
  for (const st of [STAND_A1, STAND_A2]) {
    cube(g, 9.4, 2.6, 2.4, std(0xd9dde1, 0.4, 0.5), 228.7, 3.3, st.z - 5.6)
    cube(g, 2.6, 2.8, 2.8, std(0xd9dde1, 0.4, 0.5), 234.4, 3.4, st.z - 3.6)
    for (const x of [229, 233]) put(g, new THREE.CylinderGeometry(0.14, 0.14, 2.0, 8), std(0x8a9096, 0.4, 0.7), x, 1.0, st.z - 5.6)
    cube(g, 9.4, 0.05, 0.05, std(0x14a058, 0.5), 228.7, 3.9, st.z - 4.38, false)
  }
  // Ground vehicles: a tug, baggage carts, a fuel truck.
  {
    const vy = std(0xf2c230, 0.5), vw = std(0xf4f4f2, 0.4)
    cube(g, 2.2, 1.0, 3.6, vy, 258, 0.7, 12); cube(g, 1.6, 0.8, 1.2, std(0x1a2129, 0.2), 258, 1.6, 11.2)
    for (let k = 0; k < 3; k++) { cube(g, 1.6, 0.9, 2.2, vw, 238 + k * 2.6, 0.75, 14); cube(g, 1.4, 0.6, 1.8, std([0x2b6cb0, 0xc0392b, 0x16a085][k]!, 0.6), 238 + k * 2.6, 1.5, 14) }
    cube(g, 2.4, 2.2, 7.0, vw, 262, 1.5, 52); cube(g, 2.4, 1.6, 2.2, std(0x14a058, 0.5), 262, 1.3, 47.6)
  }
  // Landside: plaza from the station, palms, planters, flags.
  {
    flat(64, 60, std(0xd9d3c6, 0.85), 168, 14, 0.008)
    const trunkM = std(0x8a6a48, 0.9), leafM = std(0x3f7a3a, 0.8, 0, { side: THREE.DoubleSide })
    for (const [x, z] of [[176, -6], [176, 34], [190, -6], [190, 34], [160, -6], [160, 34]] as const) {
      put(g, new THREE.CylinderGeometry(0.22, 0.32, 6.5, 8), trunkM, x, 3.25, z)
      for (let k = 0; k < 7; k++) { const lf = put(g, new THREE.PlaneGeometry(0.9, 3.4), leafM, x, 6.4, z, false); lf.rotation.set(-0.9, (k / 7) * Math.PI * 2, 0); lf.translateY(1.4) }
      cube(g, 2.2, 0.5, 2.2, std(0xcfc8ba, 0.8), x, 0.25, z)
      A.block(0, { x0: x - 1.1, z0: z - 1.1, x1: x + 1.1, z1: z + 1.1 })
    }
    for (const [k, z] of [[0, 4], [1, 9], [2, 14], [3, 19], [4, 24]] as const) {
      put(g, new THREE.CylinderGeometry(0.06, 0.08, 9, 8), std(0xdddddd, 0.3, 0.8), 196, 4.5, z)
      const f = put(g, new THREE.PlaneGeometry(1.8, 1.1), std([0x14a058, 0xd8b25a, 0x1e88e5, 0xc2185b, 0xffffff][k]!, 0.8, 0, { side: THREE.DoubleSide }), 196, 8.2, z + 0.95, false); f.rotation.y = Math.PI / 2
      X.animate((t) => { f.rotation.x = Math.sin(t * 2.2 + k) * 0.12 })
    }
  }
  // --- The planes on their stands.
  const liner = jet('liner', true), spare = jet('liner'), vip = jet('vip')
  const park = (j: Jet, st: { x: number; z: number }) => { j.group.position.set(st.x, 0, st.z); j.group.rotation.set(0, -Math.PI / 2, 0, 'YXZ'); add(j.group) }
  park(liner, STAND_A1); park(spare, STAND_A2); park(vip, STAND_VIP)
  const party = partyKit(vip.cabin!, X, {
    y: vip.floorY,
    guests: [[-1.0, 0.2, Math.PI, 'cheer'], [1.0, 0.6, Math.PI + 0.4, 'cheer'], [0.2, 2.0, Math.PI, 'cheer'], [-1.3, 2.8, Math.PI - 0.5, 'stand'], [1.4, 3.0, Math.PI + 0.6, 'stand'], [-0.5, -0.9, 0.2, 'cheer'], [1.15, 3.6, Math.PI / 2, 'stand']],
    dj: [0, 6.2, Math.PI],
    floor: { x: 0, z: 1.0, cols: 4, rows: 5, size: 0.86 },
    lightAt: [0, vip.floorY + 2.2, 2.0],
  })
  X.animate((t) => { liner.tick(t, flying === liner); spare.tick(t, false); vip.tick(t, flying === vip); party.tick(t) })

  // --- Flying.
  let flying: Jet | null = null
  const seatW = new THREE.Vector3()
  const fly = (j: Jet, kind: 'liner' | 'vip', cls: Cabin = 'eco') => {
    const usd = kind === 'vip' ? JET_USD : CABINS[cls].usd
    const paid = spendInGame(usd, kind === 'vip' ? 'Grind One party jet charter' : `Flight GA 101, ${CABINS[cls].name}`, kind === 'vip' ? 'DJ, dance floor and a city flypast' : 'Round trip over the sea and Grind District')
    if (!paid.ok) { X.toast(paid.message); return }
    const R = route(flightLegs(kind))
    flying = j
    X.flying(true)
    X.fade()
    const said = new Set<string>()
    const say = (k: string, m: string) => { if (!said.has(k)) { said.add(k); X.toast(m) } }
    const seatLocal = kind === 'vip' ? new THREE.Vector3(-1.0, j.floorY, -6.4) : (j.seats?.[cls] ?? new THREE.Vector3(-0.85, j.floorY, 4)).clone()
    const danceLocal = new THREE.Vector3(0, j.floorY, -2.7)
    let inside = false
    let heading = -Math.PI / 2, pitch = 0, bank = 0, alt = 0
    const high = () => THREE.MathUtils.smoothstep(alt, 60, 130)
    say('board', kind === 'vip' ? 'Welcome aboard Grind One. The party starts once we\'re up over the city.' : `Welcome aboard GA 101, ${CABINS[cls].name}. Pushing back now.`)
    X.startMove({
      from: { x: j.group.position.x, z: j.group.position.z, y: j.floorY }, to: { x: j.group.position.x, z: j.group.position.z, y: j.floorY },
      t: 0, dur: R.T, toLv: 0,
      path: (u) => {
        const time = u * R.T
        const f = R.at(time)
        heading = Math.atan2(f.tan.x, f.tan.z)
        const climb = Math.asin(THREE.MathUtils.clamp(f.tan.y, -1, 1))
        alt = f.p.y
        // Nose up a little as the wheels leave the runway, and bank into the turns (gently while the party is on).
        const rotate = f.leg === 1 && f.p.y < 6 && f.speed > 44 ? 0.12 * Math.min(1, (f.speed - 44) / 8) : 0
        pitch += ((climb + rotate) - pitch) * 0.08
        const want = alt > 3 ? THREE.MathUtils.clamp(-Math.atan((f.speed * f.speed * f.turn) / 9.8) * 0.6, inside ? -0.08 : -0.5, inside ? 0.08 : 0.5) : 0
        bank += (want - bank) * 0.05
        j.group.position.copy(f.p)
        j.group.rotation.set(-pitch, heading, bank, 'YXZ')
        j.gear.visible = alt < 18 || (alt < 45 && f.tan.y < -0.02)
        X.wind(inside ? f.speed * 0.12 : Math.min(70, f.speed) * 0.75)
        // Commentary.
        if (alt > 1) say('up', kind === 'vip' ? 'Wheels up. Climbing out over the bay.' : 'Wheels up! Climbing out over the bay.')
        if (f.p.x < 20 && f.p.z < -200) say('light', 'The lighthouse on its rock, off the left wing.')
        if (alt > 140 && Math.hypot(f.p.x, f.p.z) < 130) say('city', 'Below you: the whole of Grind District. The Sky Tower, the Raceway, Grind Park.')
        if (f.p.x > 360 && f.p.z < -150) say('land', 'Seats upright. We\'re lining up for runway 18 over the sea.')
        if (alt < 0.6 && f.p.z > -62 && f.p.z < 10 && said.has('up')) say('touch', 'Touchdown. Welcome back to Grind International.')
        // The party jet: once at height, you're inside on the dance floor; back in your seat for the landing.
        // GA 101: once at cruise over the open sea you're in your seat in the cabin; out again for the city.
        if (kind === 'liner') {
          const want2 = alt > 120 && f.p.z < -185 && said.has('up')
          if (want2 !== inside) {
            inside = want2
            X.fade()
            if (inside) X.toast(`${CABINS[cls].name}: ${CABINS[cls].service}`)
            else { X.toast('Back over the coast: the lighthouse, then the whole city below.'); adjust(cls === 'first' ? { hunger: 40, energy: 40, hygiene: 10, social: 10 } : cls === 'biz' ? { hunger: 30, energy: 20, social: 6 } : { hunger: 10, social: 4 }, 'quiet') }
          }
        }
        if (kind === 'vip') {
          const want2 = alt > 128 && said.has('up')
          if (want2 !== inside) {
            inside = want2
            X.fade()
            if (inside) { party.start(); X.toast('Party time! The DJ\'s on and the city\'s all round you.') } else { party.stop(); X.toast('Back to your seat: we\'re heading down to land.') }
          }
        }
        j.group.updateMatrixWorld(true)
        const dancing = inside && kind === 'vip'
        seatW.copy(dancing ? danceLocal : seatLocal)
        if (dancing) seatW.y += Math.abs(Math.sin((X.now() * 122 / 60) * Math.PI)) * 0.05
        seatW.applyMatrix4(j.group.matrixWorld)
        return { x: seatW.x, z: seatW.z, y: seatW.y }
      },
      seat: () => (inside && kind === 'vip' ? null : { yaw: heading, y: 0.45 }),
      face: () => (inside && kind === 'vip' ? heading : null),
      // Up high the camera stands further back and looks down, so the city fills the frame below the plane.
      camFn: () => (inside ? (kind === 'vip' ? 4.3 : 2.9) : (kind === 'vip' ? 30 : 36) + high() * 18),
      view: () => (inside ? { heading, pitch: kind === 'vip' ? 0.12 : 0.3 } : { heading, pitch: 0.22 + Math.min(1, alt / 20) * 0.08 + high() * 0.2 }),
      done: () => {
        X.wind(0)
        party.stop()
        flying = null
        X.flying(false)
        X.fade()
        j.group.position.set(kind === 'vip' ? STAND_VIP.x : STAND_A1.x, 0, kind === 'vip' ? STAND_VIP.z : STAND_A1.z)
        j.group.rotation.set(0, -Math.PI / 2, 0, 'YXZ')
        j.gear.visible = true
        X.toast(adjust(kind === 'vip' ? { social: 45 } : { social: 12 }, 'quiet') || (kind === 'vip' ? 'What a party. Same again some time?' : `Thanks for flying Grind Air ${CABINS[cls].name}.`))
      },
      exit: kind === 'vip' ? { x: 212.4, z: 48.4 } : { x: 219, z: -1 },
    })
  }

  // --- What you can do here.
  const use = (u: Hotspot) => A.use(0, u)
  use({ id: 'air-train', x: 143, z: 16, r: 1.8, title: 'Grind Metro · Airport', body: 'Trains back round the city: the Marina, the Raceway, Grind Park, the Sky Tower and the Beach.', enter: 'Take the train · $2', use: () => X.train() })
  // Check-in by cabin: Economy, Business and First, each with its own desk on the counter.
  const route101 = 'Flight GA 101: push back, take off over the bay, cruise far out over the sea in your cabin, back past the lighthouse, across the whole city at 150 m, and land here.'
  for (const [cls, z] of [['eco', 13], ['biz', 8], ['first', 3]] as const) {
    const c = CABINS[cls]
    const tag = sign(c.name.toUpperCase(), 1.6, 0.34, { bg: cls === 'first' ? '#0b0c0e' : cls === 'biz' ? '#1d2b45' : '#123524', fg: cls === 'first' ? '#d8b25a' : '#ffffff', glowing: true })
    tag.position.set(208.07, 0.82, z); tag.rotation.y = -Math.PI / 2; g.add(tag)
    use({ id: `air-checkin-${cls}`, x: 207.3, z, r: 1.9, title: `Grind Air · ${c.name}`, body: `${route101} ${c.service}`, enter: `Board GA 101 ${c.name} · $${c.usd}`, use: () => fly(liner, 'liner', cls) })
  }
  use({ id: 'air-gate', x: 219.6, z: -3, r: 1.6, title: 'Gate A1', body: 'GA 101, boarding now. Economy seats left at the gate; Business and First at check-in.', enter: `Board GA 101 Economy · $${FLIGHT_USD}`, use: () => fly(liner, 'liner', 'eco') })
  use({ id: 'air-vip', x: 213, z: 49, r: 1.8, title: 'Grind One Lounge', body: 'Charter Grind One, the party jet: a DJ, an LED dance floor, a bar and a crowd, in a cabin with panoramic windows, circling the city at 155 m.', enter: `Charter the party jet · $${JET_USD}`, use: () => fly(vip, 'vip') })
  use({ id: 'air-cafe', x: 204.5, z: 28.6, r: 1.6, title: 'Café', body: 'Coffee before your flight.', enter: 'Flat white · $4', use: () => { const p = spendInGame(4, 'Flat white', 'Grind International'); X.toast(p.ok ? adjust({ energy: 12, hunger: 4 }, 'quiet') || 'Lovely coffee.' : p.message) } })
}

// ---------------------------------------------------------------- the party yacht

/** A 30 m motor yacht, bow towards +z: hull, superstructure on two decks, flybridge hardtop, teak decks, rails. */
function superyacht(): { group: THREE.Group; deckY: number; aft: THREE.Group; wake: THREE.Mesh } {
  const g = new THREE.Group()
  const white = std(0xf7f7f4, 0.25, 0.1), navy = std(0x10213a, 0.35, 0.2)
  const glass = std(0x182430, 0.05, 0.6, { emissive: 0x1d3446, emissiveIntensity: 0.35 })
  const teak = tex(256, 256, (c) => { c.fillStyle = '#9b6a3e'; c.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 16) { c.fillStyle = '#3a2614'; c.fillRect(0, y, 256, 2); for (let x = 0; x < 256; x += 64) c.fillRect((x + (y / 16) * 23) % 256, y, 2, 16) } for (let i = 0; i < 800; i++) { c.fillStyle = 'rgba(60,35,15,0.15)'; c.fillRect(Math.random() * 256, Math.random() * 256, 8, 1) } }, [2, 6])
  const plan = (sx: number, sz: number, z0: number) => {
    const s = new THREE.Shape()
    const P: Array<[number, number]> = [[-3.4, -15], [3.4, -15], [3.65, -6], [3.45, 3], [2.6, 9], [1.3, 13], [0, 15.2], [-1.3, 13], [-2.6, 9], [-3.45, 3], [-3.65, -6]]
    P.forEach(([x, z], i) => { const X0 = x * sx, Z0 = z0 + (z - z0) * sz; if (i === 0) s.moveTo(X0, Z0); else s.lineTo(X0, Z0) })
    s.closePath()
    return s
  }
  const slab = (s: THREE.Shape, y0: number, h: number, m: THREE.Material | THREE.Material[], bevel = 0.12) => put(g, new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 }).rotateX(Math.PI / 2), m, 0, y0 + h, 0)
  slab(plan(0.84, 0.97, 0), -0.5, 1.0, navy)
  slab(plan(1, 1, 0), 0.5, 1.9, white)
  const deckY = 2.5
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(plan(0.97, 0.985, 0), 8).rotateX(-Math.PI / 2), std(0xffffff, 0.6, 0, { map: teak }))
  deck.position.y = deckY + 0.02; deck.receiveShadow = true; g.add(deck)
  // Superstructure: main deck saloon with a glass band, upper deck, flybridge hardtop and radar arch.
  const sup = (x: number, z0: number, z1: number, nose: number) => { const s = new THREE.Shape(); s.moveTo(-x, z0); s.lineTo(x, z0); s.lineTo(x, z1 - nose); s.quadraticCurveTo(x * 0.6, z1, 0, z1); s.quadraticCurveTo(-x * 0.6, z1, -x, z1 - nose); s.closePath(); return s }
  slab(sup(2.9, -6.2, 9.5, 3), deckY, 2.3, white, 0.08)
  slab(sup(2.95, -6.1, 9.4, 3), deckY + 0.9, 1.0, glass, 0.04)
  slab(sup(2.6, -7.8, 6.5, 2.4), deckY + 2.4, 0.14, white, 0.05)
  slab(sup(2.4, -3.2, 5.4, 2.2), deckY + 2.55, 2.0, white, 0.06)
  slab(sup(2.45, -3.1, 5.3, 2.2), deckY + 3.05, 0.9, glass, 0.03)
  slab(sup(2.3, -8.2, 3.6, 1.5), deckY + 4.6, 0.12, white, 0.05)
  for (const s of [-1, 1]) cube(g, 0.22, 2.3, 0.4, white, s * 2.0, deckY + 5.8, -2.0)
  cube(g, 4.2, 0.3, 0.6, white, 0, deckY + 6.9, -2.0)
  put(g, new THREE.CylinderGeometry(0.55, 0.55, 0.25, 18), white, 0, deckY + 7.2, -2.0)
  // Rails round the decks.
  const rail = std(0xdfe3e7, 0.15, 1)
  const outline = plan(0.95, 0.975, 0).getPoints(4).map((p) => new THREE.Vector3(p.x, deckY + 1.0, p.y))
  put(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 120, 0.04, 6, true), rail, 0, 0, 0, false)
  // Swim platform and the aft sofa (where you sit) along the transom.
  cube(g, 6.6, 0.18, 1.4, std(0xffffff, 0.6, 0, { map: teak }), 0, 0.75, -15.6)
  const cushion = std(0xf1ede4, 0.95), accent = std(0x10213a, 0.6)
  cube(g, 5.6, 0.45, 0.8, cushion, 0, deckY + 0.23, -14.2); cube(g, 5.6, 0.6, 0.25, cushion, 0, deckY + 0.6, -14.6)
  for (const s of [-1, 1]) { cube(g, 0.8, 0.45, 2.4, cushion, s * 2.85, deckY + 0.23, -12.6); cube(g, 0.4, 0.4, 0.4, accent, s * 2.4, deckY + 0.66, -14.2) }
  // Sun pads on the foredeck.
  cube(g, 3.2, 0.3, 2.6, cushion, 0, deckY + 0.15, 11.0)
  // Navigation lights.
  put(g, new THREE.SphereGeometry(0.08, 8, 6), glow(0xff2a2a), -2.9, deckY + 1.2, 6, false)
  put(g, new THREE.SphereGeometry(0.08, 8, 6), glow(0x2aff6a), 2.9, deckY + 1.2, 6, false)
  // Party lights: bulbs strung from the radar arch to the stern corners.
  const bulbs: THREE.Vector3[] = []
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(s * 2.0, deckY + 6.8, -2.0), b = new THREE.Vector3(s * 3.2, deckY + 1.1, -15)
    for (let k = 0; k <= 14; k++) { const u = k / 14; const p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * 0.9; bulbs.push(p) }
  }
  const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), glow(0xffe2a0), bulbs.length)
  const mm = new THREE.Matrix4(); bulbs.forEach((p, i) => bm.setMatrixAt(i, mm.makeTranslation(p.x, p.y, p.z))); g.add(bm)
  // Wake: a white V that grows with speed.
  const wakeTex = tex(128, 256, (c) => {
    c.clearRect(0, 0, 128, 256)
    const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = gr; c.beginPath(); c.moveTo(54, 0); c.lineTo(74, 0); c.lineTo(128, 256); c.lineTo(0, 256); c.closePath(); c.fill()
    // Soft streaks along the wake rather than holes.
    c.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 26; i++) { const x = 20 + Math.random() * 88; const lg = c.createLinearGradient(x - 3, 0, x + 3, 0); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, 'rgba(0,0,0,0.45)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.fillRect(x - 3, 30 + Math.random() * 60, 6, 120 + Math.random() * 100) }
  })
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(14, 40), new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: 0 }))
  wake.rotation.x = -Math.PI / 2; wake.rotation.z = Math.PI; wake.position.set(0, 0.08, -35); g.add(wake)
  const aft = new THREE.Group(); g.add(aft)
  return { group: g, deckY, aft, wake }
}

/** The jetty off the beach, the yacht at the end of it, and the cruise (started a moment after you step aboard). */
export function buildYacht(A: Arch, X: TravelCtx): void {
  const add = (o: THREE.Object3D) => A.add(0, o)
  const MOOR = { x: 44, z: -100, heading: Math.PI }
  // Jetty on piles from the sand to the stern.
  const wood = std(0x8a6a48, 0.85)
  const jetty = new THREE.Group()
  cube(jetty, 2.4, 0.2, 30, wood, 38.6, 0.9, -76)
  for (let z = -62; z >= -90; z -= 4) for (const s of [-1, 1]) put(jetty, new THREE.CylinderGeometry(0.16, 0.18, 2.4, 8), wood, 38.6 + s * 1.1, -0.2, z)
  add(jetty)
  add(lighthouse())
  const Y = superyacht()
  Y.group.position.set(MOOR.x, 0, MOOR.z); Y.group.rotation.y = MOOR.heading
  add(Y.group)
  const party = partyKit(Y.aft, X, {
    y: Y.deckY,
    guests: [[-1.5, -10.4, 0.2, 'cheer'], [1.4, -9.8, -0.3, 'cheer'], [0.1, -8.8, 0, 'cheer'], [-0.9, -12.0, 0.4, 'stand'], [2.3, -11.6, -0.6, 'stand'], [-2.4, -8.4, 0.9, 'stand'], [0.9, -11.2, 0.1, 'cheer']],
    dj: [0, -6.9, Math.PI],
    floor: { x: 0, z: -9.8, cols: 4, rows: 3, size: 0.95 },
    lightAt: [0, Y.deckY + 3.8, -10],
  })
  // The cruise: out past the lighthouse and back along the beach.
  const R = route([leg([
    [44, 0, -100, 0.4], [44, 0, -112, 3], [42, 0, -132, 7.5], [30, 0, -166, 8.5], [-5, 0, -200, 9], [-55, 0, -214, 9], [-98, 0, -192, 9], [-112, 0, -150, 8.5], [-92, 0, -118, 8.5],
    [-48, 0, -104, 8.5], [0, 0, -106, 8.5], [34, 0, -114, 6], [46, 0, -110, 3], [47, 0, -104, 0.4],
  ])])
  const seatLocal = new THREE.Vector3(0, Y.deckY, -14.1)
  const w = new THREE.Vector3()
  let heading = MOOR.heading, started = false
  const t0 = X.now()
  X.animate((t) => {
    party.tick(t)
    if (!started && t - t0 > 2.2) {
      started = true
      party.start()
      X.toast('Casting off. The DJ\'s on: enjoy the bay, the lighthouse and the city from the water.')
      const said = new Set<string>()
      X.startMove({
        from: { x: MOOR.x, z: MOOR.z, y: Y.deckY }, to: { x: MOOR.x, z: MOOR.z, y: Y.deckY }, t: 0, dur: R.T, toLv: 0,
        path: (u) => {
          const f = R.at(u * R.T)
          heading = Math.atan2(f.tan.x, f.tan.z)
          const now = X.now()
          Y.group.position.set(f.p.x, Math.sin(now * 1.3) * 0.06, f.p.z)
          Y.group.rotation.set(Math.sin(now * 0.9) * 0.012, heading, Math.sin(now * 1.1) * 0.02 - THREE.MathUtils.clamp(f.turn * f.speed * 0.5, -0.06, 0.06), 'YXZ')
          ;(Y.wake.material as THREE.MeshBasicMaterial).opacity = Math.min(0.75, f.speed / 10)
          X.wind(f.speed * 0.6)
          if (f.p.x < -40 && f.p.z < -190) { if (!said.has('l')) { said.add('l'); X.toast('The lighthouse, close enough to wave at.') } }
          Y.group.updateMatrixWorld(true)
          w.copy(seatLocal).applyMatrix4(Y.group.matrixWorld)
          return { x: w.x, z: w.z, y: w.y }
        },
        seat: () => ({ yaw: heading, y: 0.45 }),
        camFn: () => 9.5,
        view: () => ({ heading, pitch: 0.3 }),
        done: () => { X.wind(0); party.stop(); X.toast(adjust({ social: 35, energy: 5 }, 'quiet') || 'Back at the jetty. What a night on the water.'); window.setTimeout(() => X.leave(), 1600) },
      })
    }
  })
}
