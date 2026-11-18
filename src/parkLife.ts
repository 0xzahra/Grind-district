// Grind Park, everyday things you can actually do: swing on the swings (the seat really swings, with you on it),
// climb the ladder and go down the slide, sit on a bench, toss a coin in the fountain, and squeeze into the photo
// booth for a four-frame strip of yourself. Park staff in green polos stand by every ride and stand. Built by
// homes.ts into the park area, beside parkPlus.ts (zoo, golf, picnic) and the rides in homes.ts.
import * as THREE from 'three'
import type { Arch } from './homes.ts'
import type { ParkCtx } from './parkPlus.ts'
import { std, put, cube, sign } from './travel.ts'
import { spendInGame } from './state.ts'
import { adjust } from './needs.ts'
import { posedHuman, MEN, WOMEN } from './humans.ts'

const BOX = (x0: number, z0: number, x1: number, z1: number) => ({ x0, z0, x1, z1 })

export function buildParkLife(A: Arch, X: ParkCtx): void {
  const g = new THREE.Group(); A.add(0, g)
  const metal = std(0x3b4248, 0.4, 0.6), wood = std(0x9a6a42, 0.7), seatMat = std(0xe0457b, 0.5), chainMat = std(0x2a2c2f, 0.5, 0.6)

  // ---------------------------------------------------------------- swings: two seats that really swing
  {
    const SX = -116, SZ = 150, TOP = 2.5, L = 1.94
    for (const x of [-1.5, 1.5]) for (const z of [-0.7, 0.7]) { const l = put(g, new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), metal, SX + x, 1.25, SZ + z); l.rotation.x = z > 0 ? -0.25 : 0.25 }
    const bar = put(g, new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), metal, SX, TOP, SZ); bar.rotation.z = Math.PI / 2
    A.block(0, BOX(SX - 1.7, SZ - 0.9, SX - 1.3, SZ + 0.9)); A.block(0, BOX(SX + 1.3, SZ - 0.9, SX + 1.7, SZ + 0.9))
    const pivots = [-0.7, 0.7].map((x) => {
      const p = new THREE.Group(); p.position.set(SX + x, TOP, SZ); g.add(p)
      for (const dx of [-0.2, 0.2]) put(p, new THREE.CylinderGeometry(0.012, 0.012, L, 5), chainMat, dx, -L / 2, 0)
      put(p, new THREE.BoxGeometry(0.5, 0.05, 0.22), seatMat, 0, -L, 0)
      return p
    })
    let ride: { k: number; t0: number } | null = null
    const DUR = 14, PERIOD = 2.8
    const angle = (t: number) => 0.75 * Math.min(1, t / 4) * Math.min(1, Math.max(0, (DUR - t) / 3)) * Math.sin((t / PERIOD) * Math.PI * 2)
    X.animate((t) => {
      pivots.forEach((p, k) => {
        if (ride && ride.k === k) p.rotation.x = angle(X.now() - ride.t0)
        else p.rotation.x = Math.sin(t * 1.3 + k * 2) * 0.05 // the empty seat sways in the breeze
      })
    })
    A.use(0, { id: 'park-swings', x: SX, z: SZ + 1.6, r: 1.5, title: 'Swings', body: 'Nobody is too old for the swings. Sit down and kick off.', enter: 'Have a swing', use: () => {
      const k = 0, px = SX - 0.7, t0 = X.now()
      ride = { k, t0 }
      X.startMove({
        cam: 5.5, seat: () => ({ yaw: 0, y: 0.45 }),
        path: () => { const a = angle(X.now() - t0); return { x: px, z: SZ - Math.sin(a) * L, y: TOP - Math.cos(a) * L + 0.03 - 0.45 } },
        from: { x: px, z: SZ + 1.2, y: 0 }, to: { x: SX, z: SZ + 1.6, y: 0 }, t: 0, dur: DUR, toLv: 0,
        done: () => { ride = null; X.toast(adjust({ social: 5, energy: -2 }, 'quiet') || 'Whee. Your stomach is still up there.') },
      })
    } })
  }

  // ---------------------------------------------------------------- the slide (the frame is the 'slide' piece in homes.ts)
  {
    // The piece stands at (-116, 158) turned a quarter: the ladder is at the west end, the chute runs east.
    const Z = 158, LADDER = -118.35, TOPX = -117.02, TOPY = 1.62, BOTX = -114.3, BOTY = 0.16
    A.use(0, { id: 'park-slide', x: -119.4, z: Z, r: 1.3, title: 'Slide', body: 'Up the ladder, down the slide.', enter: 'Go down the slide', use: () => {
      const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k))
      let sliding = false, uu = 0
      X.startMove({
        cam: 6,
        // Standing on the ladder and the platform, sitting on the way down; facing the ladder and stepping up it.
        seat: () => (sliding ? { yaw: Math.PI / 2, y: 0.45 } : null),
        face: () => (sliding ? null : Math.PI / 2),
        gait: () => (uu < 0.06 || (uu >= 0.4 && uu < 0.5) || uu >= 0.86 ? 1.3 : uu < 0.4 ? 1.1 : 0),
        path: (u: number) => {
          uu = u
          sliding = u >= 0.5 && u < 0.86
          // Walk up to the foot of the ladder, climb it rung by rung (just in front of the rungs), step onto the top.
          if (u < 0.06) { const k = u / 0.06; return { x: lerp(-119.1, LADDER - 0.3, k), z: Z, y: 0 } }
          if (u < 0.4) { const k = (u - 0.06) / 0.34; return { x: lerp(LADDER - 0.3, LADDER - 0.12, k), z: Z, y: lerp(0, 1.7, k) } }
          if (u < 0.5) { const k = (u - 0.4) / 0.1; return { x: lerp(LADDER - 0.12, TOPX - 0.3, k), z: Z, y: 1.7 } }
          if (u < 0.86) { const k = ((u - 0.5) / 0.36) ** 1.6; return { x: lerp(TOPX, BOTX, k), z: Z, y: lerp(TOPY, BOTY, k) - 0.32 } }
          const k = (u - 0.86) / 0.14; return { x: lerp(BOTX, BOTX + 1.1, k), z: Z, y: lerp(BOTY - 0.32, 0, k) }
        },
        from: { x: -118.9, z: Z, y: 0 }, to: { x: BOTX + 1.1, z: Z, y: 0 }, t: 0, dur: 6.5, toLv: 0,
        done: () => X.toast(adjust({ social: 4 }, 'quiet') || 'Wheee! Again?'),
      })
    } })
  }

  // ---------------------------------------------------------------- benches: sit a while
  const benches: Array<[number, number, number]> = [[-136, 131.6, 0], [-140.4, 140, Math.PI / 2], [-131.6, 140, -Math.PI / 2], [-136, 148.4, Math.PI], [-150, 131, Math.PI], [-158, 120, Math.PI / 2]]
  benches.forEach(([bx, bz, ry], i) => {
    const fx = Math.sin(ry), fz = Math.cos(ry)
    A.use(0, { id: `park-bench-${i}`, x: bx + fx * 0.95, z: bz + fz * 0.95, r: 1.0, title: 'Park bench', body: 'Sit and watch the park go by.', enter: 'Sit down', use: () => {
      X.startMove({ cam: 4.5, seat: () => ({ yaw: ry, y: 0.46 }), path: () => ({ x: bx + fx * 0.05, z: bz + fz * 0.05, y: 0 }), from: { x: bx + fx * 0.9, z: bz + fz * 0.9, y: 0 }, to: { x: bx + fx * 0.95, z: bz + fz * 0.95, y: 0 }, t: 0, dur: 12, toLv: 0, done: () => X.toast(adjust({ energy: 6, social: 2 }, 'quiet') || 'A quiet moment in the park.') })
    } })
  })

  // ---------------------------------------------------------------- the fountain: a coin and a wish
  A.use(0, { id: 'park-fountain', x: -138, z: 144.8, r: 1.4, title: 'Fountain', body: 'Toss a coin and make a wish.', enter: 'Toss a coin · $1', use: () => {
    const paid = spendInGame(1, 'A coin in the fountain', 'Grind Park')
    X.toast(paid.ok ? ['Plink. Wish made. Keep it to yourself.', 'Plink. May your next trade be sized right.', 'Plink. A wish for the whole district.'][Math.floor(X.now()) % 3]! : paid.message)
  } })

  // ---------------------------------------------------------------- photo booth: four frames, one strip
  {
    const BX = -122.6, BZ = 132.4
    const booth = new THREE.Group(); booth.position.set(BX, 0, BZ); g.add(booth)
    const shell = std(0x1c2a24, 0.5, 0.2), trim = std(0xd9b26a, 0.35, 0.7), curtain = std(0xb3203a, 0.9)
    cube(booth, 0.08, 2.3, 1.4, shell, 0.66, 1.15, 0)
    for (const z of [-0.66, 0.66]) cube(booth, 1.4, 2.3, 0.08, shell, 0, 1.15, z)
    cube(booth, 1.5, 0.1, 1.5, shell, 0, 2.35, 0)
    cube(booth, 1.52, 0.06, 1.52, trim, 0, 2.42, 0)
    const cur = cube(booth, 0.04, 1.6, 0.7, curtain, -0.7, 1.2, -0.3); cur.castShadow = false
    cube(booth, 0.5, 0.45, 0.04, std(0x111214, 0.3), 0.6, 1.5, 0) // the camera window
    cube(booth, 0.6, 0.08, 0.5, wood, 0.2, 0.5, 0) // the stool
    const s = sign('PHOTO BOOTH', 1.5, 0.34, { bg: '#111312', fg: '#ffd84a', px: 120 }); s.position.set(-0.76, 2.62, 0); s.rotation.y = -Math.PI / 2; booth.add(s)
    // A sample strip on the outside wall.
    const strip = sign('★ ★ ★ ★', 0.34, 1.1, { bg: '#f5efe2', fg: '#e0457b', px: 90 }); strip.position.set(0, 1.4, 0.71); booth.add(strip)
    A.block(0, BOX(BX - 0.75, BZ - 0.75, BX + 0.75, BZ + 0.75))
    A.use(0, { id: 'park-photobooth', x: BX - 1.25, z: BZ, r: 1.2, title: 'Photo booth', body: 'Four flashes, one strip of you. Save it or share it.', enter: 'Take my photos · $5', use: () => {
      const paid = spendInGame(5, 'Photo booth strip', 'Grind Park')
      if (!paid.ok) { X.toast(paid.message); return }
      const flash = () => {
        const f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:.85;pointer-events:none;z-index:80;transition:opacity .35s'
        document.body.append(f); requestAnimationFrame(() => { f.style.opacity = '0' }); window.setTimeout(() => f.remove(), 420)
      }
      X.toast('Smile! Four flashes…')
      for (let i = 0; i < 4; i++) window.setTimeout(flash, 900 + i * 900)
      X.startMove({ cam: 3.2, seat: () => ({ yaw: -Math.PI / 2, y: 0.5 }), path: () => ({ x: BX + 0.2, z: BZ, y: 0 }), from: { x: BX - 1.0, z: BZ, y: 0 }, to: { x: BX - 1.3, z: BZ, y: 0 }, t: 0, dur: 4.6, toLv: 0,
        done: () => window.dispatchEvent(new CustomEvent('gd:photobooth')) })
    } })
  }

  // ---------------------------------------------------------------- park staff by every ride and stand
  const uniform = { top: 0x14a058, bottom: 0x26302b, shoes: 0x1a1c1f }
  const skins = [0x8d5a3b, 0x5a3825, 0xc89b78, 0x6e4630, 0xe0b896, 0x4a2e1f]
  const staff: Array<[number, number, number, number]> = [
    // [x, z, face towards x, face towards z]
    [-121.4, 126.0, -119.6, 128.4], // the gate
    [-169.4, 114.6, -171, 116.4], // roller coaster
    [-150.0, 178.4, -150, 175.5], // water slides
    [-143.6, 152.6, -145.4, 150.4], // Ferris wheel
    [-130.2, 141.6, -128, 141.0], // carousel
    [-128.0, 114.8, -128, 118.6], // ice cream (behind the counter)
    [-206.2, 138.8, -208, 137.0], // safari tram
    [-224.2, 184.8, -226, 183.0], // golf
    [-113.2, 154.0, -116, 154.0], // playground
    [-121.0, 130.4, -123.8, 132.2], // photo booth
  ]
  staff.forEach(([x, z, tx, tz], i) => {
    const model = i % 2 ? WOMEN[i % WOMEN.length]! : MEN[i % MEN.length]!
    const p = posedHuman(model, { pose: 'stand', height: i % 2 ? 1.68 : 1.78, look: { ...uniform, skin: skins[i % skins.length]!, hair: 0x16110e } })
    p.position.set(x, 0, z); p.rotation.y = Math.atan2(tx - x, tz - z)
    p.traverse((o) => { o.userData.ghost = true })
    g.add(p)
    A.block(0, BOX(x - 0.25, z - 0.25, x + 0.25, z + 0.25))
  })
}
