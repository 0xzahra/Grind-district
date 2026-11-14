import { speak } from './speech.ts'
import { steadyPlate } from './rig.ts'
import * as THREE from 'three'
import { createAvatar, type Avatar } from './avatars.ts'
import { CITIZENS, stepCitizens, type CitizenSim, type Solid } from './citizens.ts'
import { createDrone, spinDrone } from './drones.ts'
import type { Obstacle } from './physics.ts'
import { createSeating, kioskSeats, plazaSeats, workoutSpots, type Seat } from './seating.ts'

type Person = {
  avatar: Avatar
  sim: CitizenSim
  drone: THREE.Group | null
  radius: number
}

export function label(primary: string, secondary = ''): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not paint a nameplate.')
  context.fillStyle = 'rgba(14, 12, 10, 0.78)'
  context.beginPath()
  context.roundRect(8, 8, 240, 80, 18)
  context.fill()
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  if (secondary) {
    context.fillStyle = '#e9fff4'
    context.font = '700 28px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
    context.fillText(primary, 128, 36)
    context.fillStyle = '#d9b26a'
    context.font = '600 20px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
    context.fillText(secondary, 128, 64)
  } else {
    context.fillStyle = '#f2ece0'
    context.font = '700 28px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
    context.fillText(primary, 128, 48)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  sprite.scale.set(1.7, 0.64, 1)
  steadyPlate(sprite, 1.7, 0.64)
  sprite.position.y = 2.25
  sprite.userData.ghost = true
  sprite.raycast = () => undefined
  return sprite
}

function robot(): { object: THREE.Group; x: number; z: number } {
  const root = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({ color: 0x1c2824, roughness: 0.46, metalness: 0.35 })
  const mint = new THREE.MeshStandardMaterial({
    color: 0xd9b26a,
    emissive: 0xd9b26a,
    emissiveIntensity: 0.7,
    roughness: 0.35,
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.32), shell)
  body.position.y = 0.78
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.28), shell)
  head.position.y = 1.22
  head.castShadow = true
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.08), mint)
  eye.position.set(0, 1.22, 0.15)
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6), shell)
  antenna.position.y = 1.48
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mint)
  tip.position.y = 1.64
  root.add(body, head, eye, antenna, tip, label('Unit 4', 'Agent'))
  // Upgrade to the three.js RobotExpressive model (CC0, Tomás Laulhé) with walk animation once loaded.
  // The model is 450 KB: it loads once the city is on screen (the box robot stands in until then), so it never
  // delays the district opening.
  const later = new Promise<void>((done) => {
    window.addEventListener('gd:revealed', () => window.setTimeout(done, 2500), { once: true })
    window.setTimeout(done, 30000)
  })
  void later.then(() => import('three/examples/jsm/loaders/GLTFLoader.js')).then(({ GLTFLoader }) =>
    new GLTFLoader().loadAsync('/models/chars/RobotExpressive.glb')).then((gltf) => {
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    model.scale.setScalar(1.55 / Math.max(0.01, box.max.y - box.min.y))
    model.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true })
    for (const old of [body, head, eye, antenna, tip]) old.visible = false
    root.add(model)
    const mixer = new THREE.AnimationMixer(model)
    const walk = gltf.animations.find((a) => a.name === 'Walking')
    if (walk) mixer.clipAction(walk).play()
    root.userData.mixer = mixer
  }).catch(() => { /* keep the box robot */ })
  return { object: root, x: 10, z: 6 }
}

// Realistic skin tones and hair colours (skin, hair).
const LOOKS: Array<[number, number]> = [
  [0x8d5a3b, 0x1b1411], [0xeac3a6, 0x3a2618], [0x3b2316, 0x0f0b0a], [0xcf9f78, 0x2a1a12], [0xf3d9c6, 0xd9c08a],
  [0x6f4329, 0x16100d], [0xa8714b, 0x4a2c1a], [0x55321f, 0x0e0a08], [0xe0b08e, 0x7a3420], [0xbf8a62, 0x15110e],
]
/** Personalities: a trait, a daily routine and a few short lines in their own voice. */
type Persona = { name: string; trait: string; routine: string; lines: string[] }
const WOMEN_PERSONAS: Persona[] = [
  { name: 'Amara', trait: 'Builder', routine: 'Codes at the café, gym at dusk', lines: ['Shipped a fix before breakfast.', 'Ideas are cheap. Commits are not.', 'Gym, then the hackathon board.'] },
  { name: 'Mei', trait: 'Researcher', routine: 'Library hall all day', lines: ['Read the docs, not the hype.', 'Footnotes win arguments.', 'Heading to the library hall.'] },
  { name: 'Sofia', trait: 'Designer', routine: 'Fashion house studio, waterfront walks', lines: ['Taste is a skill. Practise it.', 'Less, but better.', 'The promenade light is perfect now.'] },
  { name: 'Zainab', trait: 'Founder', routine: 'Pitch practice, investor coffees', lines: ['Demo day is in two weeks.', 'Customers first, token later.', 'Penthouse view keeps me hungry.'] },
  { name: 'Aisha', trait: 'Analyst', routine: 'Trading floor charts, evening tea at the plaza', lines: ['Charts first, opinions later.', 'I keep a trade journal.', 'Tea, then the closing bell.'] },
  { name: 'Ngozi', trait: 'Community manager', routine: 'Conference hall events, plaza meetups', lines: ['Who is new here today?', 'Event at six, bring a friend.', 'Kindness scales.'] },
  { name: 'Hana', trait: 'Product designer', routine: 'Studio sketches, gallery walks', lines: ['Fewer buttons, clearer words.', 'I test with my mum first.', 'Sketching the new wallet flow.'] },
  { name: 'Lola', trait: 'Content creator', routine: 'Filming at the waterfront, editing at the café', lines: ['New thread going up tonight.', 'Sources in the replies.', 'Disclose every holding.'] },
]
const MEN_PERSONAS: Persona[] = [
  { name: 'Leo', trait: 'Careful trader', routine: 'Trading floor mornings, library afternoons', lines: ['Size first, story second.', 'I journal every trade.', 'Stop-loss is self-respect.'] },
  { name: 'Tunde', trait: 'Community lead', routine: 'Plaza meetups, podium talks', lines: ['Who is speaking at the podium?', 'Bring a friend to the meetup.', 'Good communities compound.'] },
  { name: 'Kenji', trait: 'Security nerd', routine: 'Showroom, then the lounge', lines: ['Never sharing a seed. Ever.', 'Hardware wallet, always.', 'Check the address twice.'] },
  { name: 'Noah', trait: 'Calm saver', routine: 'Morning run, budget review', lines: ['Testnet points are a score, not a promise.', 'Slow money is still money.', 'Same time at the gym tomorrow?'] },
  { name: 'Chidi', trait: 'Smart-contract dev', routine: 'Audits at the library, gym at dusk', lines: ['Read the contract, not the tweet.', 'Tests before deploys.', 'Revoke old approvals.'] },
  { name: 'Omar', trait: 'Market maker', routine: 'Trading floor all morning', lines: ['Spreads tell the story.', 'Liquidity is a promise.', 'Never trade tired.'] },
  { name: 'Diego', trait: 'Game designer', routine: 'Arcade testing, campus talks', lines: ['Fun first, tokens later.', 'Playtesting the new level.', 'Guilds need good tools.'] },
  { name: 'Femi', trait: 'Student', routine: 'Campus lectures, library evenings', lines: ['World 3 is hard but good.', 'Passed my wallet course!', 'Group study at seven.'] },
]
/** The named residents (for friendships, wallets and the market: town.ts). */
export const RESIDENTS: ReadonlyArray<{ name: string; trait: string }> = [...WOMEN_PERSONAS, ...MEN_PERSONAS].map(({ name, trait }) => ({ name, trait }))

const CHAT = ['Did you see the demo day list?', 'Passed Risk sizing this morning.', 'Size first, story second.', 'Never sharing a seed. Ever.', 'The café board is gossip, not a signal.', 'Heading to the Campus.', 'Who is speaking at the podium?', 'Reading proposals before I vote.', 'Testnet points are a score, not a promise.', 'Same time at the gym tomorrow?']
function bubble(text: string): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96
  const g = c.getContext('2d')!
  g.font = '500 30px -apple-system, system-ui, sans-serif'
  const w = Math.min(500, g.measureText(text).width + 44)
  g.fillStyle = 'rgba(248,246,242,0.92)'; g.beginPath(); g.roundRect((512 - w) / 2, 10, w, 70, 22); g.fill()
  g.fillStyle = '#1c1c1e'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 46)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }))
  sp.scale.set(2.4, 0.45, 1); sp.position.y = 2.5; sp.userData.ghost = true; sp.raycast = () => undefined
  return sp
}

export type CrowdInfo = { name: string; trait: string; routine: string; doing: string }
// Residents further than this from the camera are too small on screen to be a deliberate tap.
const PICK_RANGE = 30
const segA = new THREE.Vector3()
const segB = new THREE.Vector3()
const onRay = new THREE.Vector3()

/** Distance along the ray to a standing body (a 0.45 m capsule from the feet to 1.8 m), or null on a miss.
 *  The old test (0.85 m around the chest) covered a third of the screen when someone stood next to the
 *  camera, so taps on open street kept opening that person's card. */
export function bodyHit(ray: THREE.Ray, x: number, z: number, radius = 0.45): number | null {
  segA.set(x, 0, z)
  segB.set(x, 1.8, z)
  if (ray.distanceSqToSegment(segA, segB, onRay) > radius * radius) return null
  const along = onRay.sub(ray.origin).dot(ray.direction)
  return along > 0 ? along : null
}

export function createCrowd(scene: THREE.Scene, placeName: (x: number, z: number) => string = () => 'the city'): { setFreeWill: (on: boolean) => void; tick: (dt: number, player?: { x: number; z: number }) => Obstacle[]; nearest: (x: number, z: number, r: number) => boolean; occupied: (x: number, z: number) => boolean; pick: (ray: THREE.Raycaster, maxAlong?: number) => CrowdInfo | null; debug: () => Array<{ x: number; z: number; state: string; body: string }> } {
  const people: Person[] = []
  // Each resident gets a name that fits the figure: women's names on women, men's names on men.
  const personas = new Map<Person, Persona>()
  let womenNamed = 0, menNamed = 0
  const persona = (p: Person): Persona => personas.get(p) ?? MEN_PERSONAS[0]!
  for (const spec of CITIZENS) {
    const avatar = createAvatar(spec.body, spec.tint, spec.luxury, people.length)
    // Street citizens show natural faces (licensed NFT faces only ever go on players who own them).
    void spec.mask
    const look = LOOKS[people.length % LOOKS.length]!
    avatar.object.traverse((node) => {
      const m = (node as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (!m || !('color' in m)) return
      if (m.name === 'skin') m.color.setHex(look[0])
      if (m.name === 'hair') m.color.setHex(look[1])
    })
    avatar.object.userData.look = { skin: look[0], hair: look[1], top: spec.tint }
    const named = spec.body === 'zuri' ? WOMEN_PERSONAS[womenNamed++ % WOMEN_PERSONAS.length]! : MEN_PERSONAS[menNamed++ % MEN_PERSONAS.length]!
    avatar.object.userData.persona = named
    const start = spec.points[0]
    if (!start) continue
    avatar.object.position.set(start.x, 0, start.z)
    let drone: THREE.Group | null = null
    if (false as boolean && spec.drone !== 'none') { // follow drones retired
      drone = createDrone(spec.drone)
      drone.position.set(0.55, 2.15, 0.2)
      avatar.object.add(drone)
    }
    avatar.object.userData.camPass = true // the player's camera never zooms in for a passer-by
    scene.add(avatar.object)
    people.push({
      avatar,
      sim: { spec, x: start.x, z: start.z, index: spec.points.length > 1 ? 1 % spec.points.length : 0 },
      drone,
      radius: spec.points.length > 1 ? 0.42 : 0.38,
    })
    personas.set(people[people.length - 1]!, named)
  }

  // A few residents sit on the plaza benches or work out in the park; they rotate every ~40 s.
  const posed: Array<{ p: Person; seat: Seat; seating: ReturnType<typeof createSeating> }> = []
  // ...and one sits at the Grind Ring kiosk with a drink. A seat the player is on is never given to anyone else.
  const poseSeats: Seat[] = [plazaSeats()[0]!, plazaSeats()[2]!, workoutSpots()[1]!, kioskSeats()[2]!]
  let poseClock = 0
  let lastPlayer: { x: number; z: number } | null = null
  const assignPoses = () => {
    for (const q of posed) q.seating.stand()
    posed.length = 0
    const walkers = people.filter((p) => p.sim.spec.points.length > 1)
    const women = walkers.filter((p) => p.sim.spec.body === 'zuri')
    poseSeats.forEach((seat, k) => {
      if (lastPlayer && Math.hypot(lastPlayer.x - seat.x, lastPlayer.z - seat.z) < 0.45) return
      // Plaza benches (k 0,1): prefer a woman so the plaza is not all standing men.
      const pool = (k < 2 && women.length) ? women : walkers
      const p = pool[(k * 5 + Math.floor(poseClock / 40)) % pool.length]
      if (!p || posed.some((q) => q.p === p)) return
      const seating = createSeating(); seating.sit(seat, p.avatar.object)
      posed.push({ p, seat, seating })
    })
  }
  assignPoses()
  const unit = robot()
  unit.object.position.set(unit.x, 0, unit.z)
  unit.object.userData.camPass = true
  scene.add(unit.object)
  let robotLeg = 0
  // Unit 4 tends its corner of the east street (the spots it used to pace between, widened a little).
  const ROBOT_HOME = { x: 10.1, z: 7.6 }
  let robotGoal = { x: 10, z: 9.2 }
  let robotPace = 0.7
  let robotWait = 0
  let robotHops = 0
  let robotX = 10
  let robotZ = 6

  let chatClock = 3, chatLine = 0
  const live: Array<{ sp: THREE.Sprite; host: THREE.Object3D; ttl: number }> = []
  const still = new Set<number>()
  const gaze: Array<{ t: number; cool: number }> = []
  // Free Will: each resident has a mood for the day and a routine by the hour, and talks to you up close.
  let freeWill = false
  const talked: number[] = []
  const MOODS = ['upbeat', 'focused', 'tired', 'chatty', 'calm']
  const moodOf = (i: number) => MOODS[(i * 7 + Math.floor(Date.now() / 864e5)) % MOODS.length]!
  const routineNow = (i: number) => {
    const h = new Date().getHours()
    const per = persona(people[i]!)
    if (h < 6) return 'Should be asleep, honestly'
    if (h < 12) return `Work time: ${per.routine.split(',')[0]!.toLowerCase()}`
    if (h < 14) return 'Lunch break at the Campus café'
    if (h < 16) return 'Off to the masjid, then back to work'
    if (h < 19) return `After work: ${(per.routine.split(',')[1] ?? ' a walk by the water').trim().toLowerCase()}`
    return 'Heading home for the night'
  }
  const doing = (p: Person, i: number): string => {
    if (freeWill) return `${moodOf(i)[0]!.toUpperCase()}${moodOf(i).slice(1)} · ${routineNow(i)}`
    const tgt = p.sim.spec.points[p.sim.index]
    if (!still.has(i) && tgt) return `Heading to ${placeName(tgt.x, tgt.z)}`
    const partner = people.find((o, j) => j !== i && still.has(j) && Math.hypot(o.sim.x - p.sim.x, o.sim.z - p.sim.z) < 2.6)
    if (partner) return `Chatting with ${persona(partner).name}`
    return `Hanging out at ${placeName(p.sim.x, p.sim.z)}`
  }
  return {
    // maxAlong: how far down the ray the tap can reach (the ground hit). Without it a tap on empty
    // street picked any resident anywhere along the infinite ray, so taps opened cards instead of walking.
    pick(ray, maxAlong = Infinity) {
      let best: CrowdInfo | null = null, bestD = Math.min(maxAlong, PICK_RANGE)
      for (const [i, p] of people.entries()) {
        if (!p.avatar.object.visible) continue
        const along = bodyHit(ray.ray, p.sim.x, p.sim.z)
        if (along !== null && along < bestD) {
          const per = persona(people[i]!)
          bestD = along; best = { name: per.name, trait: per.trait, routine: per.routine, doing: doing(p, i) }
        }
      }
      return best
    },
    setFreeWill(on) { freeWill = on },
    occupied(x, z) { return posed.some((q) => Math.hypot(q.seat.x - x, q.seat.z - z) < 0.3) },
    nearest(x, z, r) { return people.some((p) => Math.hypot(p.sim.x - x, p.sim.z - z) < r) },
    debug() { return people.map((p, i) => ({ x: +p.sim.x.toFixed(2), z: +p.sim.z.toFixed(2), state: posed.some((q) => q.p === p) ? 'seated' : still.has(i) ? 'idle' : 'walking', body: p.sim.spec.body })) },
    tick(dt, player) {
      lastPlayer = player ?? null
      const obstacles: Obstacle[] = []
      // Pair chat: two standing people near each other trade a line (one bubble at a time, cheap canvas sprite).
      chatClock -= dt
      for (let i = live.length - 1; i >= 0; i -= 1) { const b = live[i]!; b.ttl -= dt; if (b.ttl <= 0) { b.host.remove(b.sp); b.sp.material.map?.dispose(); b.sp.material.dispose(); live.splice(i, 1) } }
      if (chatClock <= 0 && player) {
        chatClock = 5 + (chatLine % 3)
        const near = people.filter((p, i) => still.has(i) && Math.hypot(p.sim.x - player.x, p.sim.z - player.z) < 22)
        const a = near[chatLine % Math.max(1, near.length)]
        if (a && live.length < 0) { const per = persona(a); const sp = bubble(chatLine % 3 === 2 ? CHAT[chatLine % CHAT.length]! : `${per.name}: ${per.lines[chatLine % per.lines.length]}`); a.avatar.object.add(sp); live.push({ sp, host: a.avatar.object, ttl: 3.6 }) }
        chatLine += 1
      }
      if (freeWill && player && live.length < 1) {
        // Walk up to someone and they talk to you: their mood, what they are doing now, or one of their lines.
        const now = performance.now() / 1000
        const i = people.findIndex((p, k) => Math.hypot(p.sim.x - player.x, p.sim.z - player.z) < 2.6 && (talked[k] ?? -99) < now - 20)
        if (i >= 0) {
          talked[i] = now
          const per = persona(people[i]!)
          const turn = Math.floor(now) % 3
          const text = turn === 0 ? `${per.name}: Feeling ${moodOf(i)} today.` : turn === 1 ? `${per.name}: ${routineNow(i)}.` : `${per.name}: ${per.lines[Math.floor(now) % per.lines.length]}`
          const sp = bubble(text); people[i]!.avatar.object.add(sp); live.push({ sp, host: people[i]!.avatar.object, ttl: 3.6 })
          speak(text.replace(/^[^:]{1,20}:\s*/, ''), { gender: people[i]!.sim.spec.body === 'zuri' ? 'f' : 'm', seed: i })
          gaze[i] = { t: 0, cool: 0 } // turn to face you while talking
        }
      }
      // Look at the player only when very close (< 2.2 m) and only briefly (2 s, then 12 s cooldown).
      // Otherwise walkers face where they walk, and paused people face their nearest paused partner (chatting).
      const before = people.map((person) => ({ x: person.sim.x, z: person.sim.z }))
      poseClock += dt
      if (Math.floor(poseClock / 40) !== Math.floor((poseClock - dt) / 40)) assignPoses()
      // Walk round the player, the robot and anyone seated, never through them.
      const solids: Solid[] = [{ x: robotX, z: robotZ, r: 0.45 }, ...posed.map((q) => ({ x: q.seat.x, z: q.seat.z, r: 0.35 }))]
      if (player) solids.push({ x: player.x, z: player.z, r: 0.38 })
      stepCitizens(people.filter((person) => !posed.some((q) => q.p === person)).map((person) => person.sim), dt, solids, player)
      for (const q of posed) { q.p.sim.x = q.seat.x; q.p.sim.z = q.seat.z }
      people.forEach((person, index) => {
        const prior = before[index]
        const dx = prior ? person.sim.x - prior.x : 0
        const dz = prior ? person.sim.z - prior.z : 0
        const moving = Math.hypot(dx, dz) > 0.001
        const g = gaze[index] ?? (gaze[index] = { t: 0, cool: 0 })
        g.cool = Math.max(0, g.cool - dt)
        if (moving) { person.avatar.face(dx, dz, dt, true); still.delete(index); g.t = 0 } else still.add(index)
        let chatting = false
        if (!moving) {
          const close = player && Math.hypot(player.x - person.sim.x, player.z - person.sim.z) < 2.2
          if (close && g.cool <= 0 && g.t < 2) { g.t += dt; person.avatar.face(player!.x - person.sim.x, player!.z - person.sim.z, dt, true); if (g.t >= 2) g.cool = 12 }
          else {
            if (!close) g.t = 0
            let best: Person | null = null, bd = 2.6
            for (const [j, o] of people.entries()) { if (j === index || !still.has(j)) continue; const d = Math.hypot(o.sim.x - person.sim.x, o.sim.z - person.sim.z); if (d < bd) { bd = d; best = o } }
            if (best) person.avatar.face(best.sim.x - person.sim.x, best.sim.z - person.sim.z, dt * 0.6, true)
            // Two people stopped together take turns talking (the talk clip) while the other listens.
            chatting = !!best && (Math.floor(poseClock / 6) + index) % 2 === 0
          }
        }
        person.avatar.object.userData.chat = chatting
        const seated = posed.some((o) => o.p === person)
        person.avatar.step(dt, moving && !seated, person.sim.spec.speed)
        person.avatar.object.position.set(person.sim.x, 0, person.sim.z)
        const q = posed.find((o) => o.p === person)
        if (q) q.seating.apply(person.avatar.object, dt)
        if (person.drone) spinDrone(person.drone, dt, performance.now() / 1000)
        // Gone into a building for a while: out of sight and out of the way.
        const away = (person.sim.inside ?? 0) > 0
        person.avatar.object.visible = !away
        if (!away) obstacles.push({ kind: 'circle', x: person.sim.x, z: person.sim.z, r: person.radius })
      })

      // Unit 4 wanders its corner: a fresh random spot each time, a varied pause, a varied pace, and it waits
      // or steps round anyone in its way instead of walking through them.
      if (robotWait > 0) robotWait -= dt
      else {
        const dx = robotGoal.x - robotX, dz = robotGoal.z - robotZ, dist = Math.hypot(dx, dz)
        if (dist < 0.2) {
          robotHops += 1
          robotWait = Math.random() < 0.7 ? 2 + Math.random() * 8 : 0.3
          const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.4
          robotGoal = { x: ROBOT_HOME.x + Math.cos(a) * r, z: ROBOT_HOME.z + Math.sin(a) * r * 0.8 }
          robotPace = 0.5 + Math.random() * 0.35
        } else {
          let ux = dx / dist, uz = dz / dist
          let blocked = false
          const near = [...people.filter((p) => p.avatar.object.visible).map((p) => ({ x: p.sim.x, z: p.sim.z })), ...(player ? [player] : [])]
          for (const o of near) {
            const rx = o.x - robotX, rz = o.z - robotZ, ahead = rx * ux + rz * uz
            if (ahead <= 0 || ahead > 1.4) continue
            const lat = rx * uz - rz * ux
            if (Math.abs(lat) < 0.75) { if (ahead < 0.8) blocked = true; const sgn = lat >= 0 ? 1 : -1; const nx = ux - uz * sgn, nz = uz + ux * sgn, l = Math.hypot(nx, nz) || 1; ux = nx / l; uz = nz / l }
          }
          if (!blocked) {
            const step = Math.min(dist, robotPace * dt)
            robotX += ux * step
            robotZ += uz * step
            unit.object.rotation.y = Math.atan2(ux, uz)
          }
        }
      }
      robotLeg += dt
      ;(unit.object.userData.mixer as THREE.AnimationMixer | undefined)?.update(dt)
      unit.object.position.set(robotX, Math.sin(robotLeg * 2) * 0.03, robotZ)
      obstacles.push({ kind: 'circle', x: robotX, z: robotZ, r: 0.5 })
      return obstacles
    },
  }
}
