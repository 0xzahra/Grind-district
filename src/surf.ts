// Grind Surf School on the city beach: a shack with a board rack and an instructor on the sand, west of the
// yacht jetty. "Go surfing" ($20): sit on the board and paddle out past the break, wait in the line-up while a
// set rolls in, then pop up and ride a wave back to the shore, standing sideways and carving left and right,
// with the breaking crest and its whitewater just behind you. Built by homes.ts into the 'surf' area.
import * as THREE from 'three'
import type { Arch, Move } from './homes.ts'
import type { TravelCtx } from './travel.ts'
import { std, put, cube, sign, person } from './travel.ts'
import { spendInGame } from './state.ts'
import { adjust } from './needs.ts'

const SHACK = { x: -27.5, z: -66.5 }
const SHORE = -80 // the waterline (beach.ts)
const LINEUP = { x: -21, z: -104 }

/** A shortboard: a flattened capsule with a stripe and a fin. */
function board(color: number, stripe: number): THREE.Group {
  const g = new THREE.Group()
  const deck = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.7, 6, 14), std(color, 0.35))
  deck.rotation.x = Math.PI / 2; deck.scale.set(1, 1, 0.22); g.add(deck)
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 1.7), std(stripe, 0.4)); line.position.y = 0.046; g.add(line)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.14), std(0x1d1f22, 0.4)); fin.position.set(0, -0.1, 0.85); g.add(fin)
  return g
}

/** A breaking wave: a curling face of sea water with a band of foam along its lip, and whitewater in front. */
function waveCrest(): { group: THREE.Group; foam: THREE.MeshBasicMaterial } {
  const g = new THREE.Group()
  // The face is painted from green-blue water at its foot to white foam at the lip, so it reads as a breaking wave.
  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const cg = c.getContext('2d')!
  const grad = cg.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, 'rgba(36,128,150,0.9)'); grad.addColorStop(0.55, 'rgba(70,170,190,0.92)'); grad.addColorStop(0.8, 'rgba(190,232,240,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,1)')
  cg.fillStyle = grad; cg.fillRect(0, 0, 256, 64)
  for (let i = 0; i < 500; i++) { const x = 150 + Math.random() * 106; cg.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`; cg.beginPath(); cg.arc(x, Math.random() * 64, 1 + Math.random() * 3, 0, Math.PI * 2); cg.fill() }
  const faceTex = new THREE.CanvasTexture(c); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.wrapT = THREE.RepeatWrapping; faceTex.repeat.set(1, 6)
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 18, 28, 1, true, Math.PI * 0.5, Math.PI * 0.9),
    new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.15, metalness: 0.05, emissive: 0x0b3a48, emissiveIntensity: 0.2, transparent: true, side: THREE.DoubleSide, depthWrite: false }))
  face.rotation.z = Math.PI / 2; face.position.y = 0.02; g.add(face)
  const foam = new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.8, depthWrite: false })
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 18, 10, 1, true), foam); lip.rotation.z = Math.PI / 2; lip.position.set(0, 1.2, 0.3); g.add(lip)
  const washMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.2), washMat); wash.rotation.x = -Math.PI / 2; wash.position.set(0, 0.06, 1.0); g.add(wash)
  g.traverse((o) => { o.userData.ghost = true; o.castShadow = false })
  return { group: g, foam }
}

export function buildSurf(A: Arch, X: TravelCtx): void {
  const g = new THREE.Group(); A.add(0, g)
  // The shack: a timber hut with a palm-thatch roof, a counter and a rack of boards.
  const wood = std(0xa77b4f, 0.85), dark = std(0x5b3b22, 0.9), thatch = std(0xc9a764, 1)
  cube(g, 3.6, 0.12, 2.6, wood, SHACK.x, 0.06, SHACK.z)
  for (const [dx, dz] of [[-1.7, -1.2], [1.7, -1.2], [-1.7, 1.2], [1.7, 1.2]]) cube(g, 0.14, 2.5, 0.14, dark, SHACK.x + dx!, 1.25, SHACK.z + dz!)
  const roof = put(g, new THREE.ConeGeometry(2.9, 1.1, 4), thatch, SHACK.x, 3.0, SHACK.z); roof.rotation.y = Math.PI / 4
  cube(g, 3.2, 1.0, 0.5, wood, SHACK.x, 0.62, SHACK.z - 1.0)
  const sgn = sign('GRIND SURF SCHOOL', 3.2, 0.5, { bg: '#0d4a5c', fg: '#ffe7a3' }); sgn.position.set(SHACK.x, 2.35, SHACK.z - 1.32); sgn.rotation.y = Math.PI; g.add(sgn)
  const colors: Array<[number, number]> = [[0xf2c14e, 0xd8263a], [0x3fb6c8, 0xffffff], [0xe86a8a, 0xffffff], [0x9bd16a, 0x1d6b3a], [0xffffff, 0x2a6fd6]]
  colors.forEach(([c, s], i) => { const b = board(c, s); b.rotation.set(Math.PI / 2 - 0.25, 0, 0); b.position.set(SHACK.x + 2.3, 1.0, SHACK.z - 0.9 + i * 0.45); g.add(b) })
  cube(g, 0.1, 0.1, 2.4, dark, SHACK.x + 2.15, 0.25, SHACK.z)
  A.block(0, { x0: SHACK.x - 1.9, z0: SHACK.z - 1.35, x1: SHACK.x + 2.6, z1: SHACK.z + 1.35 })
  // The instructor, in a rash vest, by the counter.
  const coach = person('woman3', { pose: 'stand', height: 1.7, look: { top: 0x13a3b8, bottom: 0x1d1f22, shoes: 0x1d1f22, skin: 0x8d5a3b, hair: 0x16110e } })
  coach.position.set(SHACK.x - 0.6, 0, SHACK.z - 1.75); coach.rotation.y = Math.PI; g.add(coach)
  A.block(0, { x0: SHACK.x - 0.9, z0: SHACK.z - 2.05, x1: SHACK.x - 0.3, z1: SHACK.z - 1.45 })

  // The rider's board and the wave (hidden until a session starts).
  const ride = board(0xf2c14e, 0xd8263a); ride.visible = false; g.add(ride)
  const W = waveCrest(); W.group.visible = false; g.add(W.group)
  let busy = false

  const go = () => {
    if (busy) return
    const paid = spendInGame(20, 'Surf session', 'Grind Surf School: board, leash and a coach')
    if (!paid.ok) { X.toast(paid.message); return }
    busy = true
    ride.visible = true
    const start = { x: SHACK.x + 4.5, z: SHORE + 1.2 }
    const said = new Set<string>()
    const say = (k: string, m: string) => { if (!said.has(k)) { said.add(k); X.toast(m) } }
    // Phases over the session (u from 0 to 1): paddle out, wait in the line-up, pop up, ride in, step off.
    const DUR = 26, PAD = 0.3, WAIT = 0.42, POP = 0.47, RIDE = 0.94
    let heading = Math.PI, standing = false, phase: 'out' | 'wait' | 'ride' = 'out'
    const m: Move = {
      from: { x: start.x, z: start.z, y: 0 }, to: { x: start.x, z: start.z, y: 0 }, t: 0, dur: DUR, toLv: 0,
      path: (u) => {
        const t = X.now()
        let x: number, z: number, y: number
        if (u < PAD) {
          // Paddle out: straight through the shore break to the line-up.
          const k = u / PAD, e = k * k * (3 - 2 * k)
          x = start.x + (LINEUP.x - start.x) * e; z = start.z + (LINEUP.z - start.z) * e
          heading = Math.PI; y = 0.04 + Math.sin(t * 2.2) * 0.05; phase = 'out'
          say('out', 'Paddle out past the break: chest on the board, long strokes.')
        } else if (u < WAIT) {
          // Sit up in the line-up, turned to face the beach, rising and falling on the swell.
          x = LINEUP.x; z = LINEUP.z; heading = 0; y = 0.04 + Math.sin(t * 1.6) * 0.12; phase = 'wait'
          say('wait', 'Sit up and watch the horizon. Here comes a set…')
          W.group.visible = true
          const k = (u - PAD) / (WAIT - PAD)
          W.group.position.set(LINEUP.x, 0, LINEUP.z - 14 + k * 12)
        } else {
          // Pop up and ride: carving left and right as the wave carries you to the shore.
          const k = Math.min(1, (u - WAIT) / (RIDE - WAIT)), e = 1 - (1 - k) * (1 - k)
          z = LINEUP.z + (SHORE - 2 - LINEUP.z) * e
          x = LINEUP.x + Math.sin(k * Math.PI * 3) * 2.6 - k * 4
          const dx = Math.cos(k * Math.PI * 3) * 2.6 * Math.PI * 3 - 4, dz = (SHORE - 2 - LINEUP.z) * 2 * (1 - k)
          heading = Math.atan2(dx, dz)
          standing = u >= POP && u < RIDE; phase = 'ride'
          y = standing ? 0.16 + Math.sin(t * 3) * 0.04 : 0.05
          W.group.visible = u < RIDE
          W.group.position.set(x + 4 * k, 0, z - 2.2)
          W.foam.opacity = 0.85 * (1 - Math.max(0, k - 0.8) * 5)
          if (u >= POP) say('pop', 'Pop up! Back foot on the tail, front foot forward, knees soft.')
          if (k > 0.35) say('carve', 'Lean into the turns: carve down the face, then back up.')
          if (u >= RIDE) say('in', 'Ride it all the way in. Step off in the shallows.')
          X.wind(standing ? 9 : 0)
        }
        // The board under you, nose along the heading, tilting into the carve.
        ride.position.set(x, y - 0.02, z)
        ride.rotation.set(0, heading, standing ? Math.sin(t * 2) * 0.12 : 0, 'YXZ')
        return { x, z, y: Math.max(0.02, y + (standing ? 0.08 : 0)) }
      },
      // Sitting on the board to paddle and wait; standing, sideways to the board, to ride.
      seat: () => (standing ? null : { yaw: heading, y: 0.18 }),
      face: () => (standing ? heading + Math.PI / 2 : null),
      // Paddling: from behind, out to sea. Waiting: from the beach side, the set rolling in behind you. Riding:
      // from in front and to one side, looking back at you with the wave over your shoulder.
      camFn: () => (phase === 'ride' ? 7 : 8.5),
      view: () => (phase === 'out' ? { heading: Math.PI + 0.25, pitch: 0.3 } : phase === 'wait' ? { heading: Math.PI - 0.35, pitch: 0.2 } : { heading: heading + Math.PI - 0.6, pitch: 0.18 }),
      exit: { x: SHACK.x + 4.5, z: SHACK.z - 4 },
      done: () => {
        busy = false; ride.visible = false; W.group.visible = false; X.wind(0)
        X.toast(adjust({ social: 8, energy: -10, hygiene: -6 }, 'quiet') ? 'Stoked! That was a real wave. Rinse off and go again any time.' : 'Stoked! That was a real wave.')
      },
    }
    X.startMove(m)
  }
  A.use(0, {
    id: 'surf-go', x: SHACK.x + 3.2, z: SHACK.z - 2.4, r: 2.0, title: 'Grind Surf School',
    body: 'A board, a leash and a coach. Paddle out past the break, wait for a set, pop up and ride a wave all the way in. About half a minute.',
    enter: 'Go surfing · $20', use: go,
  })
}
