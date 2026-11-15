// Home tech for your house: light switches by each room's door with ceiling lights that really go on and off,
// a wall plasma with a power button and channels, and the appliances a modern home runs on: an over-range
// microwave, an espresso machine, split air conditioning, a ceiling fan and a robot vacuum that cleans the
// living room. Moving parts animate only while they are on screen (onBeforeRender), so nothing ticks for free.
import * as THREE from 'three'
import { createPlasma } from './tv.ts'
import type { Seat } from './seating.ts'
import type { Obstacle } from './physics.ts'

type UseSpec = { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; run: () => void }
export type TechCtx = {
  group: THREE.Group; ox: number; oz: number; w: number; d: number; H: number
  /** Adds a use; returns the live entry (its `enter` label can change after a tap). */
  use: (u: UseSpec) => UseSpec | void; toast: (m: string) => void; sit: (s: Seat) => void; busy: (seconds: number, x: number, z: number, yaw: number) => void
  obstacles: Obstacle[]
  /** Share of the house's lights that are on (0..1): the room lamp follows it. */
  setLights: (frac: number) => void
}
const std = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })

export function buildHomeTech(c: TechCtx): void {
  const { group, H } = c
  /** Add a use and keep the live entry, so a label like 'Lights off' can flip to 'Lights on'. */
  const live = (u: UseSpec): UseSpec => (c.use(u) as UseSpec | undefined) ?? u
  const M = { plastic: std(0xf3f1ec, 0.35), rocker: std(0xe9e6df, 0.3), black: std(0x0d0e10, 0.25, 0.3), gloss: std(0x08090b, 0.12, 0.4), steel: std(0xc9ccd0, 0.28, 0.75), walnut: std(0x5a3d28, 0.55), fabric: std(0x6f7d86, 0.95), cushion: std(0x7f8d95, 0.95), white: std(0xf7f7f5, 0.4) }
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = false; m.receiveShadow = true; group.add(m); return m
  }
  const block = (x: number, z: number, hx: number, hz: number) => c.obstacles.push({ kind: 'box', x: c.ox + x, z: c.oz + z, hx, hz })

  // ---------------------------------------------------------------- lights and switches
  type Zone = { id: string; title: string; on: boolean; mat: THREE.MeshStandardMaterial; weight: number; rocker: THREE.Mesh[] }
  const zones: Zone[] = []
  const apply = () => {
    let on = 0, all = 0
    for (const z of zones) { all += z.weight; if (z.on) on += z.weight; z.mat.emissiveIntensity = z.on ? 1.6 : 0; z.mat.color.setHex(z.on ? 0xfff6e6 : 0xd9d6cf); for (const r of z.rocker) r.rotation.x = z.on ? -0.22 : 0.22 }
    c.setLights(all ? on / all : 1)
  }
  const fixtureGeo = new THREE.CylinderGeometry(0.26, 0.3, 0.05, 24)
  const rimGeo = new THREE.TorusGeometry(0.29, 0.012, 6, 28).rotateX(Math.PI / 2)
  const zone = (id: string, title: string, weight: number, fixtures: Array<[number, number]>) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xffe2b0, emissiveIntensity: 1.6, roughness: 0.4 })
    for (const [x, z] of fixtures) { mesh(fixtureGeo, mat, x, H - 0.03, z); mesh(rimGeo, M.steel, x, H - 0.05, z) }
    const zn: Zone = { id, title, on: true, mat, weight, rocker: [] }
    zones.push(zn)
    return zn
  }
  /** A switch plate on a wall: `face` is the direction it faces (into the room). */
  const plateGeo = new THREE.BoxGeometry(0.085, 0.13, 0.012), rockGeo = new THREE.BoxGeometry(0.034, 0.07, 0.014)
  const switchAt = (zn: Zone, x: number, z: number, face: 'px' | 'nx' | 'pz' | 'nz', ux: number, uz: number) => {
    const ry = face === 'pz' ? 0 : face === 'nz' ? Math.PI : face === 'px' ? Math.PI / 2 : -Math.PI / 2
    mesh(plateGeo, M.plastic, x, 1.22, z, ry)
    const nx = face === 'px' ? 1 : face === 'nx' ? -1 : 0, nz = face === 'pz' ? 1 : face === 'nz' ? -1 : 0
    const r = mesh(rockGeo, M.rocker, x + nx * 0.01, 1.22, z + nz * 0.01, ry)
    zn.rocker.push(r)
    const u = live({ id: `switch-${zn.id}`, x: ux, z: uz, r: 0.7, title: `Light switch · ${zn.title}`, body: 'Click. The ceiling lights in this room.', enter: 'Lights off', run: () => {
      zn.on = !zn.on; apply()
      u.enter = zn.on ? 'Lights off' : 'Lights on'
      c.toast(zn.on ? `${zn.title}: lights on.` : `${zn.title}: lights off.`)
    } })
  }
  const living = zone('living', 'Hall, living and dining', 3, [[-1.6, -4.6], [-7.6, -3.4], [-6.0, 2.6]])
  const kitchen = zone('kitchen', 'Kitchen', 1.2, [[7.2, -4.4]])
  const bedroom = zone('bedroom', 'Bedroom', 1.4, [[3.2, 2.5]])
  const pool = zone('pool', 'Pool room', 1.4, [[7.6, 3.2], [8.6, 0.4]])
  switchAt(living, -9.93, -0.9, 'px', -9.2, -0.9)
  switchAt(kitchen, 4.585, -4.3, 'px', 5.3, -4.3)
  switchAt(bedroom, 4.515, 2.7, 'nx', 3.8, 2.7)
  switchAt(pool, 4.685, 2.9, 'px', 5.4, 2.9)
  apply()

  // ---------------------------------------------------------------- the plasma, on the living-room wall
  {
    const TX = -5.4, TZ = -5.5, TY = 1.5, TW = 1.84
    mesh(new THREE.BoxGeometry(0.05, TW * 0.5625 + 0.06, TW + 0.06), M.gloss, TX, TY, TZ)
    const tv = createPlasma(TW)
    tv.mesh.position.set(TX + 0.027, TY, TZ); tv.mesh.rotation.y = Math.PI / 2; group.add(tv.mesh)
    // A low walnut console with a soundbar.
    mesh(new THREE.BoxGeometry(0.44, 0.42, 2.0), M.walnut, TX + 0.24, 0.21, TZ); block(TX + 0.24, TZ, 0.24, 1.0)
    mesh(new THREE.BoxGeometry(0.1, 0.07, 1.1), M.black, TX + 0.2, 0.455, TZ)
    // A three-seat sofa facing the screen.
    const SX = -2.7, SZ = TZ - 0.2
    mesh(new THREE.BoxGeometry(0.85, 0.42, 1.7), M.fabric, SX, 0.21, SZ); block(SX, SZ, 0.44, 0.86)
    mesh(new THREE.BoxGeometry(0.2, 0.5, 1.7), M.fabric, SX + 0.33, 0.67, SZ)
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.85, 0.22, 0.16), M.fabric, SX, 0.52, SZ + s * 0.77)
    for (const k of [-0.36, 0.36]) mesh(new THREE.BoxGeometry(0.62, 0.1, 0.68), M.cushion, SX - 0.06, 0.47, SZ + k)
    c.use({ id: 'sofa-tv', x: SX - 0.8, z: SZ, r: 0.6, title: 'Sofa', body: 'Put your feet up in front of the plasma.', enter: 'Sit and watch', run: () => {
      c.sit({ x: c.ox + SX - 0.08, z: c.oz + SZ + 0.36, yaw: -Math.PI / 2, y: 0.47 })
      if (!tv.isOn()) { tv.power(true); powerUse.enter = 'Turn the TV off'; c.toast(`TV on: ${tv.channel()}.`) }
    } })
    const powerUse = live({ id: 'plasma-power', x: TX + 1.25, z: TZ - 0.55, r: 0.5, title: 'Plasma TV · power', body: 'A 75-inch plasma. News, markets, nature, motorsport and music.', enter: 'Turn the TV on', run: () => {
      const on = tv.power(); powerUse.enter = on ? 'Turn the TV off' : 'Turn the TV on'
      c.toast(on ? `TV on: ${tv.channel()}.` : 'TV off.')
    } })
    c.use({ id: 'plasma-channel', x: TX + 1.25, z: TZ + 0.55, r: 0.5, title: 'Plasma TV · channels', body: 'GD News, Markets, Nature, Raceway and Music.', enter: 'Next channel', run: () => {
      if (!tv.isOn()) { tv.power(true); powerUse.enter = 'Turn the TV off' }
      c.toast(`Channel: ${tv.next()}.`)
    } })
  }

  // ---------------------------------------------------------------- kitchen appliances
  {
    // Over-range microwave above the gas cooker, with a glowing display and a lit cavity while it runs.
    const MX = 6.4, MY = 1.62, MZ = -c.d / 2 + 0.2
    mesh(new THREE.BoxGeometry(0.76, 0.42, 0.38), M.steel, MX, MY, MZ)
    const door = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.15, metalness: 0.3, emissive: 0xffc070, emissiveIntensity: 0 })
    mesh(new THREE.BoxGeometry(0.52, 0.32, 0.01), door, MX - 0.08, MY, MZ + 0.195)
    const disp = new THREE.MeshStandardMaterial({ color: 0x0a2a1a, emissive: 0x2cff8a, emissiveIntensity: 0.6 })
    mesh(new THREE.BoxGeometry(0.12, 0.05, 0.01), disp, MX + 0.27, MY + 0.1, MZ + 0.196)
    c.use({ id: 'microwave', x: 5.6, z: -6.3, r: 0.6, title: 'Microwave', body: 'Over the cooker. Two minutes on full power.', enter: 'Heat a meal', run: () => {
      door.emissiveIntensity = 0.9; c.busy(2.2, c.ox + MX, c.oz + MZ + 1.0, Math.PI)
      window.setTimeout(() => { door.emissiveIntensity = 0; c.toast('Ding. Leftover jollof, piping hot.') }, 2200)
    } })
    // Espresso machine on the counter.
    const EX = 9.3, EZ = -c.d / 2 + 0.45
    mesh(new THREE.BoxGeometry(0.3, 0.36, 0.34), M.steel, EX, 1.1, EZ)
    mesh(new THREE.BoxGeometry(0.22, 0.04, 0.12), M.black, EX, 0.95, EZ + 0.12)
    mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 12), M.white, EX, 0.97, EZ + 0.12)
    c.use({ id: 'espresso', x: EX - 0.3, z: EZ + 0.95, r: 0.6, title: 'Espresso machine', body: 'Beans ground fresh, a double shot.', enter: 'Make a coffee', run: () => {
      c.busy(1.8, c.ox + EX, c.oz + EZ + 0.9, Math.PI); window.setTimeout(() => c.toast('A double espresso. Focus up.'), 1800)
    } })
  }

  // ---------------------------------------------------------------- climate: split AC (living) and a ceiling fan (bedroom)
  {
    const AX = 2.2, AY = 2.2, AZ = -c.d / 2 + 0.12
    mesh(new THREE.BoxGeometry(0.95, 0.3, 0.22), M.white, AX, AY, AZ)
    const flap = mesh(new THREE.BoxGeometry(0.8, 0.02, 0.08), M.plastic, AX, AY - 0.15, AZ + 0.1)
    const led = new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x4cf0a0, emissiveIntensity: 0 })
    mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), led, AX + 0.36, AY - 0.06, AZ + 0.112)
    let acOn = false
    flap.onBeforeRender = () => { const goal = acOn ? 0.75 + Math.sin(performance.now() / 900) * 0.15 : 0; flap.rotation.x += (goal - flap.rotation.x) * 0.08 }
    const ac = live({ id: 'aircon', x: AX, z: AZ + 1.1, r: 0.7, title: 'Air conditioning', body: 'Split unit, quiet inverter. 22°C.', enter: 'Turn the AC on', run: () => {
      acOn = !acOn; led.emissiveIntensity = acOn ? 1.2 : 0; ac.enter = acOn ? 'Turn the AC off' : 'Turn the AC on'
      c.toast(acOn ? 'AC on: cool air at 22°C.' : 'AC off.')
    } })
    // Ceiling fan with a light kit, over the bedroom.
    const FX = 1.0, FZ = 4.4
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), M.walnut, FX, H - 0.15, FZ)
    const hub = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), M.walnut, FX, H - 0.32, FZ)
    const blades = new THREE.Group(); blades.position.set(FX, H - 0.32, FZ); group.add(blades)
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.12), M.walnut); b.position.set(Math.cos(i * 1.2566) * 0.42, 0, Math.sin(i * 1.2566) * 0.42); b.rotation.y = -i * 1.2566; blades.add(b) }
    let fanOn = false, spin = 0, last = performance.now()
    hub.onBeforeRender = () => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; spin += ((fanOn ? 9 : 0) - spin) * Math.min(1, dt * 1.2); blades.rotation.y += spin * dt }
    mesh(plateGeo, M.plastic, -2.515, 1.22, 3.45, Math.PI / 2)
    const fan = live({ id: 'ceiling-fan', x: -1.8, z: 3.55, r: 0.5, title: 'Ceiling fan', body: 'Five walnut blades. A soft breeze over the bed.', enter: 'Fan on', run: () => {
      fanOn = !fanOn; fan.enter = fanOn ? 'Fan off' : 'Fan on'; c.toast(fanOn ? 'Fan on.' : 'Fan off.')
    } })
  }

  // ---------------------------------------------------------------- robot vacuum: docks by the west wall, cleans the living room
  {
    const DX = -9.55, DZ = 1.6
    mesh(new THREE.BoxGeometry(0.12, 0.14, 0.34), M.black, DX, 0.07, DZ)
    const bot = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 24), M.gloss); body.position.y = 0.05; bot.add(body)
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), M.steel); eye.position.set(0, 0.1, 0.05); bot.add(eye)
    bot.position.set(DX + 0.25, 0, DZ); group.add(bot)
    let cleaning = false, t = 0, last = performance.now()
    // A lawnmower sweep over the open floor of the living room, then home to the dock.
    const path: Array<[number, number]> = []
    for (let i = 0; i < 6; i++) { const z = 1.3 + i * 0.95; path.push(i % 2 ? [-3.2, z] : [-9.2, z], i % 2 ? [-9.2, z] : [-3.2, z]) }
    path.push([DX + 0.25, DZ])
    const seg = path.map((p, i) => (i ? Math.hypot(p[0] - path[i - 1]![0], p[1] - path[i - 1]![1]) : 0))
    body.onBeforeRender = () => {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now
      if (!cleaning) return
      t += dt * 0.32
      let d = t, i = 1
      while (i < path.length && d > seg[i]!) { d -= seg[i]!; i++ }
      if (i >= path.length) { cleaning = false; t = 0; bot.position.set(DX + 0.25, 0, DZ); c.toast('The robot vacuum is back on its dock. Floors done.'); return }
      const a = path[i - 1]!, b = path[i]!, k = d / seg[i]!
      bot.position.set(a[0] + (b[0] - a[0]) * k, 0, a[1] + (b[1] - a[1]) * k)
      bot.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1])
    }
    c.use({ id: 'robot-vacuum', x: DX + 0.75, z: DZ + 0.6, r: 0.6, title: 'Robot vacuum', body: 'It maps the living room and sweeps it in neat rows.', enter: 'Start cleaning', run: () => {
      if (cleaning) { cleaning = false; t = 0; bot.position.set(DX + 0.25, 0, DZ); c.toast('Sent back to the dock.'); return }
      cleaning = true; c.toast('Cleaning the living room. It comes home when it is done.')
    } })
  }
}
