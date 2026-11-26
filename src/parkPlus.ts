// Grind Park, west side: a picnic lawn, Grind Zoo (giraffes, zebras, elephants, lions and flamingos, with a safari
// tram that takes you between the enclosures) and Grind Golf (three par-3 holes with a swing meter: tap to set the
// power, follow the ball, then putt it in). Built by homes.ts into the park area; animals are made here from simple
// shapes and walk about their enclosures. The day pass covers the safari tram; golf has its own green fee.
import * as THREE from 'three'
import type { Hotspot } from './world.ts'
import type { Arch } from './homes.ts'
import type { TravelCtx } from './travel.ts'
import { std, put, cube, tex, sign, person, leg, route } from './travel.ts'
import { spendInGame } from './state.ts'
import { adjust } from './needs.ts'
import { crownCards, foliageMaterial } from './trees.ts'
import { giraffe, zebra, elephant, lion, flamingo, stepLegs, rhino, hippo, crocodile, ostrich, cheetah, tiger, gorilla } from './animals.ts'

export type ParkCtx = TravelCtx & { fare: (usd: number) => string; charge: (usd: number, label: string) => { ok: boolean; message: string }; onRelabel: (f: () => void) => void }
type Box = { x0: number; z0: number; x1: number; z1: number }

// ---------------------------------------------------------------- animals

type Beast = { g: THREE.Group; legs: THREE.Object3D[]; neck?: THREE.Object3D; tail?: THREE.Object3D; trunk?: THREE.Object3D; speed: number; box: Box; tx: number; tz: number; heading: number; phase: number; rest: number; stride: number }

// ---------------------------------------------------------------- the build

export function buildParkPlus(A: Arch, X: ParkCtx): void {
  const g = new THREE.Group(); A.add(0, g)
  const add = (o: THREE.Object3D) => g.add(o)
  const flat = (w: number, d: number, m: THREE.Material, x: number, z: number, y: number, rot = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); p.rotation.set(-Math.PI / 2, 0, rot); p.position.set(x, y, z); p.receiveShadow = true; add(p); return p }
  // West lawn and paths from the park centre.
  flat(93, 116, std(0x5f8f45, 1), -259.5, 154, -0.012)
  const path = std(0xe0d6c2, 0.95)
  flat(56, 3, path, -186, 172, 0.006)
  flat(3, 40, path, -212, 152, 0.006)
  flat(84, 3, path, -256, 153, 0.006)

  // ---------------------------------------------------------------- picnic lawn
  {
    const check = tex(128, 128, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#d63c3c' : '#f4f1ea'; c.fillRect(i * 16, j * 16, 16, 16) } })
    const blue = tex(128, 128, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? '#2f6fb3' : '#f4f1ea'; c.fillRect(i * 16, j * 16, 16, 16) } })
    const wicker = std(0xb9874e, 0.9), plate = std(0xf7f7f4, 0.3)
    const set = (x: number, z: number, r: number, t: THREE.Texture) => {
      const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = r
      const bl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.1), std(0xffffff, 0.95, 0, { map: t })); bl.rotation.x = -Math.PI / 2; bl.position.y = 0.012; bl.receiveShadow = true; s.add(bl)
      cube(s, 0.55, 0.32, 0.38, wicker, 0.7, 0.16, -0.5)
      const handle = put(s, new THREE.TorusGeometry(0.2, 0.02, 6, 16, Math.PI), wicker, 0.7, 0.32, -0.5); handle.rotation.y = Math.PI / 2
      for (const [px, pz] of [[-0.5, 0.3], [0.1, 0.45], [-0.2, -0.3]] as const) put(s, new THREE.CylinderGeometry(0.15, 0.13, 0.02, 16), plate, px, 0.022, pz)
      for (let k = 0; k < 5; k++) put(s, new THREE.SphereGeometry(0.05, 8, 6), std([0xd63c3c, 0xf2c230, 0x6aa84f, 0xff8c1a][k % 4]!, 0.6), -0.55 + k * 0.05, 0.07, 0.3 + (k % 2) * 0.05)
      put(s, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), std(0x2f7a3a, 0.2, 0.2), 0.3, 0.15, 0.1)
      add(s)
      return s
    }
    set(-121, 182, 0.3, check); set(-113, 194, -0.4, blue); set(-124, 198, 0.9, check)
    const mine = set(-115, 182.5, -0.2, blue)
    cube(mine, 0.7, 0.42, 0.7, std(0xe9e1d2, 0.95), 0, 0.21, 0.2)
    // Families picnicking.
    const fam: Array<[number, number, number, 'woman1' | 'man2' | 'woman4' | 'man1']> = [[-121.6, 181.6, 2.6, 'woman1'], [-120.2, 182.8, -0.6, 'man2'], [-113.6, 193.4, 1.8, 'woman4'], [-124.4, 197.6, -2.2, 'man1']]
    for (const [x, z, r, m] of fam) { const p = person(m, { pose: 'kneel', height: m.startsWith('w') ? 1.66 : 1.78 }); p.position.set(x, 0, z); p.rotation.y = r; add(p) }
    const spotAt = new THREE.Vector3(0, 0, 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.2).add(new THREE.Vector3(-115, 0, 182.5))
    A.use(0, { id: 'park-picnic', x: spotAt.x, z: spotAt.z + 1.2, r: 1.5, title: 'Picnic lawn', body: 'A blanket in the sun, a hamper of sandwiches, fruit and lemonade. Sit down and take it easy.', enter: 'Have a picnic · $12', use: () => {
      const paid = spendInGame(12, 'Picnic hamper', 'Grind Park picnic lawn')
      if (!paid.ok) { X.toast(paid.message); return }
      X.toast('Sandwiches, strawberries and lemonade. Nice and slow.')
      X.startMove({ from: { x: spotAt.x, z: spotAt.z, y: 0 }, to: { x: spotAt.x, z: spotAt.z, y: 0 }, t: 0, dur: 14, toLv: 0, path: () => ({ x: spotAt.x, z: spotAt.z, y: 0 }), seat: () => ({ yaw: -0.2 + Math.PI, y: 0.45 }), cam: 5.5, done: () => { X.toast(adjust({ hunger: 35, social: 12, energy: 6 }, 'quiet') || 'A lovely picnic.') } })
    } })
  }

  // ---------------------------------------------------------------- Grind Zoo
  const fence = (b: Box) => {
    const wood = std(0x7a5a3a, 0.85)
    const sides: Array<[number, number, number, number]> = [[b.x0, b.z0, b.x1, b.z0], [b.x0, b.z1, b.x1, b.z1], [b.x0, b.z0, b.x0, b.z1], [b.x1, b.z0, b.x1, b.z1]]
    for (const [x0, z0, x1, z1] of sides) {
      const len = Math.hypot(x1 - x0, z1 - z0), alongX = z0 === z1
      for (const h of [0.55, 1.05]) cube(g, alongX ? len : 0.08, 0.08, alongX ? 0.08 : len, wood, (x0 + x1) / 2, h, (z0 + z1) / 2, false)
      for (let k = 0; k <= Math.round(len / 3); k++) { const u = k / Math.round(len / 3); cube(g, 0.14, 1.2, 0.14, wood, x0 + (x1 - x0) * u, 0.6, z0 + (z1 - z0) * u) }
      A.block(0, alongX ? { x0: Math.min(x0, x1), z0: z0 - 0.15, x1: Math.max(x0, x1), z1: z0 + 0.15 } : { x0: x0 - 0.15, z0: Math.min(z0, z1), x1: x0 + 0.15, z1: Math.max(z0, z1) })
    }
  }
  const sand = std(0xd8c08a, 1), dirt = std(0xb89a6a, 1)
  const E1: Box = { x0: -298, z0: 104, x1: -262, z1: 127 }, E2: Box = { x0: -256, z0: 104, x1: -218, z1: 127 }
  const E3: Box = { x0: -298, z0: 133, x1: -262, z1: 150 }, E4: Box = { x0: -256, z0: 133, x1: -218, z1: 150 }
  for (const [b, m] of [[E1, sand], [E2, dirt], [E3, sand], [E4, dirt]] as const) { flat(b.x1 - b.x0, b.z1 - b.z0, m, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0.004); fence(b) }
  // The big cats' yard is split: lions on the west side, cheetahs on the east.
  const E3L: Box = { x0: E3.x0, z0: E3.z0, x1: -280.6, z1: E3.z1 }, E3C: Box = { x0: -279.4, z0: E3.z0, x1: E3.x1, z1: E3.z1 }
  fence({ x0: -280, z0: E3.z0, x1: -280, z1: E3.z1 })
  // A second row by the golf clubhouse: rhinos (with a mud wallow), tigers (with a pool) and gorillas.
  const E5: Box = { x0: -210, z0: 177, x1: -195, z1: 204 }, E6: Box = { x0: -193, z0: 177, x1: -178, z1: 204 }, E7: Box = { x0: -176, z0: 177, x1: -163, z1: 204 }
  const grassY = std(0x7f9a4a, 1)
  for (const [b, m] of [[E5, dirt], [E6, grassY], [E7, grassY]] as const) { flat(b.x1 - b.x0, b.z1 - b.z0, m, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 0.004); fence(b) }
  flat(52, 3, path, -186.5, 175, 0.006)
  const mud = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), std(0x4a3524, 0.35, 0.05)); mud.rotation.x = -Math.PI / 2; mud.scale.set(1, 1.4, 1); mud.position.set(-202.5, 0.02, 196); add(mud)
  // Acacias, rocks, a water hole and the flamingo pond.
  const acacia = (x: number, z: number, s = 1) => { const t = new THREE.Group(); put(t, new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 3.4 * s, 7), std(0x6b4c32, 0.9), 0, 1.7 * s, 0); const c = put(t, crownCards(2.6 * s, 0, Math.round(x * 3 + z), 18).scale(1, 0.32, 0.85), foliageMaterial(), 0, 3.5 * s, 0); c.castShadow = true; t.position.set(x, 0, z); add(t); A.block(0, { x0: x - 0.4, z0: z - 0.4, x1: x + 0.4, z1: z + 0.4 }) }
  acacia(-290, 110); acacia(-268, 121, 1.2); acacia(-226, 108, 1.1); acacia(-292, 145, 0.9)
  const rock = std(0x8b8378, 0.95, 0, { flatShading: true })
  for (const [x, z, r] of [[-280, 141, 2.4], [-272, 146, 1.4], [-250, 110, 1.6], [-183, 199, 2.0], [-189, 183, 1.2], [-166, 200, 1.8], [-172, 196, 1.1]] as const) { const o = put(g, new THREE.DodecahedronGeometry(r, 0), rock, x, r * 0.45, z); o.scale.y = 0.6 }
  acacia(-207, 182, 0.8); acacia(-168, 184, 1.0)
  // the gorillas' climbing frame: logs lashed into an A-frame with a platform
  { const log = std(0x6b4c32, 0.9); for (const [x, z, h, rx, rz] of [[-171, 190, 3.2, 0.25, 0], [-169, 190, 3.2, -0.25, 0], [-171, 193, 3.2, 0.25, 0], [-169, 193, 3.2, -0.25, 0]] as const) { const o = put(g, new THREE.CylinderGeometry(0.12, 0.14, h, 7), log, x, h / 2 - 0.1, z); o.rotation.set(rx, 0, rz) } cube(g, 2.6, 0.12, 3.4, log, -170, 2.6, 191.5); const fallen = put(g, new THREE.CylinderGeometry(0.28, 0.32, 5, 8), log, -188, 0.28, 192); fallen.rotation.set(0, 0.6, Math.PI / 2) }
  const water = std(0x2b8fb0, 0.08, 0.1, { transparent: true, opacity: 0.85 })
  const drink = new THREE.Mesh(new THREE.CircleGeometry(5.8, 36), water); drink.rotation.x = -Math.PI / 2; drink.scale.set(1.25, 1, 1); drink.position.set(-232, 0.03, 117.5); add(drink)
  // a muddy bank round the water hole
  const bank = new THREE.Mesh(new THREE.RingGeometry(5.8, 6.8, 36), std(0x7a5a3a, 1)); bank.rotation.x = -Math.PI / 2; bank.scale.set(1.25, 1, 1); bank.position.set(-232, 0.02, 117.5); add(bank)
  const pond = new THREE.Mesh(new THREE.CircleGeometry(7.5, 32), water); pond.rotation.x = -Math.PI / 2; pond.scale.set(1.3, 0.85, 1); pond.position.set(-237, 0.03, 141.5); add(pond)
  const tigerPool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), water); tigerPool.rotation.x = -Math.PI / 2; tigerPool.position.set(-185, 0.03, 186); add(tigerPool)
  // Signs on each enclosure.
  for (const [b, t] of [[E1, 'GIRAFFES, ZEBRAS & OSTRICHES'], [E2, 'ELEPHANTS, HIPPOS & A CROC'], [E3L, 'LIONS'], [E3C, 'CHEETAHS'], [E4, 'FLAMINGOS'], [E5, 'RHINOS'], [E6, 'TIGERS'], [E7, 'GORILLAS']] as const) {
    const s = sign(t, 3.6, 0.6, { bg: '#2b3b22', fg: '#f3e6c4' }); s.position.set((b.x0 + b.x1) / 2, 1.7, b.z0 > 130 ? b.z0 - 0.2 : b.z1 + 0.2); s.rotation.y = b.z0 > 130 ? Math.PI : 0; add(s)
    cube(g, 0.1, 1.4, 0.1, std(0x5a4632, 0.9), (b.x0 + b.x1) / 2 - 1.6, 0.7, b.z0 > 130 ? b.z0 - 0.2 : b.z1 + 0.2); cube(g, 0.1, 1.4, 0.1, std(0x5a4632, 0.9), (b.x0 + b.x1) / 2 + 1.6, 0.7, b.z0 > 130 ? b.z0 - 0.2 : b.z1 + 0.2)
  }
  // Gate.
  {
    const gate = new THREE.Group(); gate.position.set(-217, 0, 131)
    for (const sz of [-2.8, 2.8]) put(gate, new THREE.CylinderGeometry(0.35, 0.4, 4.6, 10), std(0x6b4c32, 0.9), 0, 2.3, sz)
    const s = sign('GRIND ZOO', 6.4, 1.2, { bg: '#2b3b22', fg: '#ffd36b' }); s.position.set(0, 4.9, 0); s.rotation.y = Math.PI / 2; gate.add(s)
    add(gate)
  }
  // The animals.
  const beasts: Beast[] = []
  const place = (b: ReturnType<typeof giraffe>, box: Box, k: number) => {
    const x = box.x0 + 3 + ((k * 7.3) % (box.x1 - box.x0 - 6)), z = box.z0 + 3 + ((k * 5.1) % (box.z1 - box.z0 - 6))
    b.g.position.set(x, 0, z)
    b.g.traverse((c) => { c.castShadow = true })
    add(b.g)
    beasts.push({ ...b, box, tx: x, tz: z, heading: k, phase: k, rest: 1 + k })
  }
  place(giraffe(), E1, 0); place(giraffe(), E1, 3); place(zebra(), E1, 1); place(zebra(), E1, 2); place(zebra(), E1, 4)
  place(elephant(), E2, 0); place(elephant(), E2, 2)
  place(lion(true), E3L, 0); place(lion(false), E3L, 1); place(lion(false), E3L, 2)
  place(ostrich(), E1, 5); place(ostrich(), E1, 6); place(ostrich(), E1, 7)
  place(cheetah(), E3C, 0); place(cheetah(), E3C, 1)
  place(rhino(), E5, 0); place(rhino(), E5, 1)
  place(tiger(), E6, 0); place(tiger(), E6, 1)
  place(gorilla(true), E7, 0); place(gorilla(false), E7, 1); place(gorilla(false), E7, 2)
  { const young = gorilla(false); young.g.scale.setScalar(0.55); young.speed *= 0.8; place(young, E7, 3) }
  // Hippos wallow in the water hole with only their backs, ears and eyes showing; a crocodile basks on the bank.
  const soakers: THREE.Group[] = []
  // two wallowing well apart (backs, ears and eyes above the water), one walking the bank
  for (const [x, z, h] of [[-236, 116, 0.5], [-228.2, 119.6, -2.5]] as const) { const hp = hippo(); hp.g.position.set(x, -0.8, z); hp.g.rotation.y = h; hp.g.traverse((c) => { c.castShadow = true }); add(hp.g); soakers.push(hp.g) }
  place(hippo(), { x0: -250, z0: 106, x1: -240, z1: 125 }, 2)
  { const cr = crocodile(); cr.position.set(-223.6, 0.02, 112.2); cr.rotation.y = -0.9; add(cr) }
  const birds: THREE.Group[] = []
  for (let k = 0; k < 9; k++) { const f = flamingo(); const a = k * 0.7; f.position.set(-237 + Math.cos(a) * (2 + (k % 3) * 2.2), 0, 141.5 + Math.sin(a) * (1.4 + (k % 3) * 1.4)); f.rotation.y = a * 2; add(f); birds.push(f) }
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let last = X.now()
  X.animate((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t
    for (const b of beasts) {
      const dx = b.tx - b.g.position.x, dz = b.tz - b.g.position.z, d = Math.hypot(dx, dz)
      let moving = false
      if (b.rest > 0) { b.rest -= dt; if (b.rest <= 0) { b.tx = b.box.x0 + 2.5 + rnd() * (b.box.x1 - b.box.x0 - 5); b.tz = b.box.z0 + 2.5 + rnd() * (b.box.z1 - b.box.z0 - 5) } }
      else if (d < 0.4) b.rest = 3 + rnd() * 6
      else {
        const want = Math.atan2(dx, dz)
        b.heading += Math.atan2(Math.sin(want - b.heading), Math.cos(want - b.heading)) * Math.min(1, dt * 1.6)
        const step = b.speed * dt
        b.g.position.x += Math.sin(b.heading) * step; b.g.position.z += Math.cos(b.heading) * step
        b.phase += (step / b.stride) * Math.PI * 2
        moving = true
      }
      b.g.rotation.y = b.heading
      stepLegs(b.legs, b.phase, moving)
      if (b.tail) b.tail.rotation.z = Math.sin(t * 2.2 + b.phase) * 0.3
      if (b.neck && !moving) b.neck.rotation.y = Math.sin(t * 0.5 + b.heading) * 0.35
      if (b.trunk) b.trunk.rotation.x = Math.sin(t * 1.1 + b.heading) * 0.25
    }
    birds.forEach((f, k) => { f.rotation.y += Math.sin(t * 0.3 + k) * 0.002; f.position.y = Math.sin(t * 1.4 + k) * 0.01 })
    soakers.forEach((h, k) => { h.position.y = -0.8 + Math.sin(t * 0.5 + k * 2) * 0.04; h.rotation.y += Math.sin(t * 0.13 + k) * 0.0008 })
  })
  // Safari tram: a little open tram on a loop between and round the enclosures.
  {
    const tram = new THREE.Group()
    const body = std(0x2f6b3a, 0.5), stripe = std(0xf2c230, 0.5), seat = std(0xe9e1d2, 0.8)
    cube(tram, 1.8, 0.5, 4.2, body, 0, 0.6, 0)
    cube(tram, 1.84, 0.12, 4.24, stripe, 0, 0.9, 0)
    for (const z of [-1.2, 0, 1.2]) { cube(tram, 1.5, 0.2, 0.5, seat, 0, 1.0, z); cube(tram, 1.5, 0.22, 0.08, seat, 0, 1.2, z - 0.25) }
    // Open-top, so nothing comes between you and the animals.
    for (const [sx, sz] of [[-0.85, -2.0], [0.85, -2.0], [-0.85, 2.0], [0.85, 2.0]] as const) put(tram, new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12).rotateZ(Math.PI / 2), std(0x1a1a1a, 0.8), sx, 0.3, sz * 0.8)
    for (const s of [-1, 1]) cube(tram, 0.05, 0.05, 4.2, std(0xdddddd, 0.3, 0.7), s * 0.9, 1.35, 0, false)
    const STATION = { x: -210, z: 140 }
    tram.position.set(STATION.x, 0, STATION.z)
    add(tram)
    const stop = new THREE.Group(); cube(stop, 3.2, 0.12, 2, std(0xf4f2ee, 0.6), 0, 2.6, 0); for (const sz of [-0.9, 0.9]) put(stop, new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), std(0xdddddd, 0.4, 0.6), 1.4, 1.3, sz); const ss = sign('SAFARI TRAM', 2.8, 0.45, { bg: '#2f6b3a', fg: '#ffffff' }); ss.position.set(1.55, 2.2, 0); ss.rotation.y = Math.PI / 2; stop.add(ss); stop.position.set(-207.4, 0, 140); add(stop)
    const R = route([leg([
      [STATION.x, 0, STATION.z, 0.6], [-213, 0, 133.5, 2], [-217, 0, 131, 2.6], [-225, 0, 130, 3.6], [-240, 0, 130, 3.6], [-258, 0, 130, 3.6], [-280, 0, 130, 3.6], [-298, 0, 130, 3.6], [-303, 0, 140, 2.8],
      [-298, 0, 154, 2.8], [-276, 0, 154, 3.6], [-252, 0, 154, 3.6], [-228, 0, 154, 3.6], [-214, 0, 150, 2.4], [STATION.x, 0, STATION.z + 0.2, 0.6],
    ])])
    const seatL = new THREE.Vector3(-0.45, 0.75, 0)
    const w = new THREE.Vector3()
    let heading = 0
    const u: Hotspot = { id: 'park-safari', x: -208, z: 137.4, r: 1.6, title: 'Safari tram', body: 'A slow open tram between the enclosures: giraffes, zebras and ostriches, elephants with hippos and a crocodile at the water hole, lions, cheetahs and the flamingo pond, close up. Rhinos, tigers and gorillas are by the golf clubhouse. The day pass covers it.', enter: '', use: () => {
      const paid = X.charge(15, 'Safari tram')
      if (!paid.ok) { X.toast(paid.message); return }
      X.toast('Hold on: the safari tram is off. Giraffes and zebras first.')
      X.startMove({
        from: { x: STATION.x, z: STATION.z, y: 0 }, to: { x: STATION.x, z: STATION.z, y: 0 }, t: 0, dur: R.T, toLv: 0,
        path: (uu) => { const f = R.at(uu * R.T); heading = Math.atan2(f.tan.x, f.tan.z); tram.position.set(f.p.x, 0, f.p.z); tram.rotation.y = heading; tram.updateMatrixWorld(true); w.copy(seatL).applyMatrix4(tram.matrixWorld); return { x: w.x, z: w.z, y: 0.6 } },
        // Sit facing the enclosures on your left and look across them; on the way back the lions and the
        // flamingos are on the same side.
        seat: () => ({ yaw: heading + Math.PI / 2, y: 0.45 }),
        cam: 6,
        view: () => ({ heading: heading + Math.PI / 2 - 0.35, pitch: 0.24 }),
        done: () => { tram.position.set(STATION.x, 0, STATION.z); tram.rotation.y = 0; X.toast(adjust({ social: 10 }, 'quiet') || 'Back at the gate. The elephants waved.') },
        exit: { x: -208, z: 137.4 },
      })
    } }
    const paint = () => { u.enter = `Safari tram · ${X.fare(15)}` }
    paint(); X.onRelabel(paint)
    A.use(0, u)
  }

  // ---------------------------------------------------------------- Grind Golf
  const HOLES = [
    { tee: { x: -222, z: 199 }, cup: { x: -258, z: 200 } },
    { tee: { x: -266, z: 193 }, cup: { x: -289, z: 170 } },
    { tee: { x: -283, z: 162 }, cup: { x: -247, z: 166 } },
  ]
  const fairway = std(0x6fae4f, 0.95), green = std(0x7cc35a, 0.7), teeM = std(0x5d9a43, 0.9)
  for (const h of HOLES) {
    const dx = h.cup.x - h.tee.x, dz = h.cup.z - h.tee.z, L = Math.hypot(dx, dz), a = Math.atan2(dx, dz)
    flat(7, L, fairway, (h.tee.x + h.cup.x) / 2, (h.tee.z + h.cup.z) / 2, 0.002, a)
    const gr = new THREE.Mesh(new THREE.CircleGeometry(6, 32), green); gr.rotation.x = -Math.PI / 2; gr.position.set(h.cup.x, 0.005, h.cup.z); gr.receiveShadow = true; add(gr)
    const cup = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), std(0x111111, 1)); cup.rotation.x = -Math.PI / 2; cup.position.set(h.cup.x, 0.008, h.cup.z); add(cup)
    put(g, new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), std(0xf2f2f2, 0.4), h.cup.x, 1.1, h.cup.z)
    const flag = put(g, new THREE.PlaneGeometry(0.7, 0.45), std(0xe02b2b, 0.8, 0, { side: THREE.DoubleSide }), h.cup.x + 0.35, 1.95, h.cup.z, false)
    X.animate((t) => { flag.rotation.y = Math.sin(t * 2 + h.cup.x) * 0.3 })
    cube(g, 3, 0.1, 3, teeM, h.tee.x, 0.05, h.tee.z)
    const bunker = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), std(0xe8d7a8, 1)); bunker.rotation.x = -Math.PI / 2; bunker.scale.set(1.5, 0.8, 1); bunker.position.set(h.cup.x + Math.cos(a) * 5, 0.006, h.cup.z - Math.sin(a) * 5); add(bunker)
  }
  // Clubhouse with the green fee desk.
  {
    const ch = new THREE.Group(); ch.position.set(-226, 0, 180)
    cube(ch, 8, 3.2, 5, std(0xf4f1ea, 0.8), 0, 1.6, 0)
    cube(ch, 9, 0.3, 6, std(0x2f5a3a, 0.7), 0, 3.35, 0)
    cube(ch, 3, 2.2, 0.06, std(0x223040, 0.1, 0.4), 0, 1.3, 2.52, false)
    const s = sign('GRIND GOLF', 4.6, 0.7, { bg: '#2f5a3a', fg: '#ffffff' }); s.position.set(0, 2.85, 2.55); ch.add(s)
    add(ch)
    A.block(0, { x0: -230.2, z0: 177.4, x1: -221.8, z1: 182.6 })
  }
  const ball = put(g, new THREE.SphereGeometry(0.11, 12, 8), std(0xffffff, 0.3), 0, -5, 0)
  let hole = -1, strokes = 0
  const card: number[] = []
  const at = { x: 0, z: 0 }
  const swing: Hotspot = { id: 'park-golf-swing', x: 0, z: -999, r: 1.5, title: 'Grind Golf', body: '', enter: 'Swing', use: () => (hitNow ? hitNow() : openMeter()) }
  let swingAdded = false
  let hitNow: (() => void) | null = null
  const placeBall = (x: number, z: number) => { at.x = x; at.z = z; ball.position.set(x, 0.11, z); swing.x = x; swing.z = z; paintSwing() }
  const paintSwing = () => {
    if (hole < 0) return
    const h = HOLES[hole]!, d = Math.hypot(h.cup.x - at.x, h.cup.z - at.z)
    swing.title = `Hole ${hole + 1} of 3 · par 3`
    swing.body = `Stroke ${strokes + 1}. ${d.toFixed(1)} m to the pin. Tap to start the swing, tap again when the marker is in the gold zone.`
    swing.enter = d < 7 ? 'Putt' : 'Swing'
  }
  const startHole = (k: number) => { hole = k; strokes = 0; placeBall(HOLES[k]!.tee.x, HOLES[k]!.tee.z) }
  A.use(0, { id: 'park-golf', x: -226, z: 183.4, r: 1.8, title: 'Grind Golf', body: 'Three par-3 holes. Tap to swing, aim is automatic: power is yours. Clubs and balls included.', enter: 'Play 3 holes · $25', use: () => {
    const paid = spendInGame(25, 'Grind Golf green fee', 'Three holes')
    if (!paid.ok) { X.toast(paid.message); return }
    card.length = 0
    startHole(0)
    if (!swingAdded) { swingAdded = true; A.use(0, swing) }
    X.toast('Head to the first tee: the ball is waiting. Aim is automatic; stop the marker in the gold zone.')
  } })
  // The swing meter: a marker sweeps the bar; tap to hit. The gold zone is the right power for this distance.
  let meter: HTMLDivElement | null = null
  const closeMeter = () => { meter?.remove(); meter = null; hitNow = null }
  X.onLeave(closeMeter)
  const openMeter = () => {
    if (hole < 0 || meter) return
    const h = HOLES[hole]!
    const d = Math.hypot(h.cup.x - at.x, h.cup.z - at.z)
    const putt = d < 7
    const maxD = putt ? Math.max(4, d * 2) : 52
    const ideal = Math.min(0.98, d / maxD)
    meter = document.createElement('div')
    meter.setAttribute('style', 'position:fixed;left:50%;top:130px;transform:translateX(-50%);width:min(300px,80vw);padding:12px 14px;border-radius:16px;background:rgba(12,16,14,0.86);color:#fff;font:600 14px Inter,system-ui,sans-serif;z-index:60;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.35)')
    const zw = putt ? 0.1 : 0.08
    meter.innerHTML = `<div style="margin-bottom:8px">${putt ? 'Putt' : 'Swing'}: ${d.toFixed(1)} m to the pin</div><div style="position:relative;height:18px;border-radius:9px;background:linear-gradient(90deg,#2a7a3a,#f2c230 70%,#e0402b);overflow:hidden"><span style="position:absolute;top:0;bottom:0;left:${(Math.max(0, ideal - zw / 2)) * 100}%;width:${zw * 100}%;background:rgba(255,215,90,.85);outline:2px solid #fff"></span><i style="position:absolute;top:-2px;bottom:-2px;width:4px;background:#fff;border-radius:2px;left:0"></i></div><button type="button" style="margin-top:10px;width:100%;padding:10px;border:0;border-radius:12px;background:linear-gradient(#ffe08a,#e5b23a);color:#2a1d05;font:800 16px Inter,system-ui,sans-serif">Hit</button>`
    document.body.append(meter)
    const mark = meter.querySelector('i') as HTMLElement
    const t0 = performance.now()
    let p = 0, live = true
    const tick = () => { if (!live || !meter) return; const s = ((performance.now() - t0) / 1000) * 0.75; p = 1 - Math.abs(((s % 2) + 2) % 2 - 1); mark.style.left = `calc(${p * 100}% - 2px)`; requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    const hit = (e?: Event) => { e?.stopPropagation(); if (!live) return; live = false; closeMeter(); shoot(p, ideal, maxD, putt) }
    meter.querySelector('button')!.addEventListener('click', hit)
    hitNow = () => hit()
  }
  const shoot = (p: number, ideal: number, maxD: number, putt: boolean) => {
    const h = HOLES[hole]!
    strokes++
    const d0 = Math.hypot(h.cup.x - at.x, h.cup.z - at.z)
    const aim = Math.atan2(h.cup.x - at.x, h.cup.z - at.z)
    const miss = p - ideal
    const err = (putt ? 0.06 : 0.1) * miss + (Math.random() - 0.5) * (putt ? 0.03 : 0.08)
    const dir = aim + err
    const travel = p * maxD
    const end = { x: at.x + Math.sin(dir) * travel, z: at.z + Math.cos(dir) * travel }
    const lateral = Math.abs(Math.sin(err)) * Math.min(travel, d0)
    const holed = putt ? travel >= d0 - 0.2 && travel <= d0 + 1.4 && lateral < 0.28 : Math.hypot(end.x - h.cup.x, end.z - h.cup.z) < 0.55
    if (holed) { end.x = h.cup.x; end.z = h.cup.z }
    // Keep the ball on the course.
    end.x = THREE.MathUtils.clamp(end.x, -300, -212); end.z = THREE.MathUtils.clamp(end.z, 156, 205)
    const from = { x: at.x, z: at.z }
    const len = Math.hypot(end.x - from.x, end.z - from.z)
    const dur = putt ? 0.8 + len / 4 : 1.2 + len / 22
    const apex = putt ? 0 : len * 0.26
    X.startMove({
      from: { x: from.x, z: from.z, y: 0 }, to: { x: end.x, z: end.z, y: 0 }, t: 0, dur, toLv: 0, hide: true, cam: putt ? 5 : 9,
      view: () => ({ heading: dir, pitch: putt ? 0.5 : 0.3 }),
      path: (u) => {
        const e = putt ? 1 - Math.pow(1 - u, 2) : u < 0.85 ? u / 0.85 : 1
        const roll = putt ? 0 : u < 0.85 ? 0 : (u - 0.85) / 0.15
        const k = putt ? e : e * 0.94 + roll * 0.06
        const x = from.x + (end.x - from.x) * k, z = from.z + (end.z - from.z) * k
        const y = putt ? 0 : u < 0.85 ? Math.sin(e * Math.PI) * apex : 0
        ball.position.set(x, 0.11 + y, z)
        if (holed && u > 0.96) ball.position.y = -0.2
        return { x, z, y: Math.max(0, y - 1.0) }
      },
      // Holed: straight on to the next tee (or back by the last green when the round is over).
      exit: holed && hole < HOLES.length - 1 ? { x: HOLES[hole + 1]!.tee.x + 0.9, z: HOLES[hole + 1]!.tee.z + 0.9 } : { x: end.x - Math.sin(aim) * 0.8, z: end.z - Math.cos(aim) * 0.8 },
      done: () => {
        if (holed || strokes >= 6) {
          const par = 3, diff = strokes - par
          const word = holed ? (strokes === 1 ? 'Hole in one!' : diff <= -2 ? 'Eagle!' : diff === -1 ? 'Birdie!' : diff === 0 ? 'Par.' : diff === 1 ? 'Bogey.' : `${strokes} strokes.`) : 'Picked up after six.'
          card.push(strokes)
          if (hole < HOLES.length - 1) { X.toast(`${word} Hole ${hole + 1} done. You're on the ${['', 'second', 'third'][hole + 1]} tee.`); startHole(hole + 1) }
          else {
            const total = card.reduce((a, b) => a + b, 0)
            adjust({ social: 10, energy: -4 }, 'quiet')
            X.toast(`${word} Round over: ${total} for three holes (par 9).`)
            hole = -1; ball.position.y = -5; swing.z = -999
          }
        } else { placeBall(end.x, end.z); X.toast(putt ? 'So close. Putt again.' : `${Math.hypot(h.cup.x - end.x, h.cup.z - end.z).toFixed(1)} m to the pin.`) }
      },
    })
  }
}
