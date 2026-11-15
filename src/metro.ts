// The Grind Metro: a raised line round the city with branches out to Grind Park and the airport, and a three-car
// train that runs all day, stopping at six stations. Board at a station entrance in the street (a $2 fare), ride above the city
// with the camera following, and the gold button gets you off at the next stop. Loaded after the city opens.
import * as THREE from 'three'

import { STATIONS, CTRL, AWAY, type StationId } from './metroRoute.ts'
export { STATIONS, type StationId }
const DECK = 7.2 // top of the viaduct
const CAR = 10.4, CARS = 3, CRUISE = 15, ACC = 1.1, BRAKE = 1.3, DWELL = 5

export function createMetro(scene: THREE.Scene, deps: { onArrive: (s: StationId) => void }) {
  const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
  const L = curve.getLength()
  const N = Math.round(L)
  const pts = curve.getSpacedPoints(N).slice(0, N).map((v) => ({ x: v.x, z: v.z }))
  const at = (s: number) => { const f = (((s % N) + N) % N), i = Math.floor(f), j = (i + 1) % N, u = f - i; const a = pts[i]!, b = pts[j]!; return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, h: Math.atan2(b.x - a.x, b.z - a.z) } }
  const stops = STATIONS.map((st) => { let best = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.hypot(p.x - st.at[0], p.z - st.at[1]); if (d < bd) { bd = d; best = i } }); return { ...st, s: best } }).sort((a, b) => a.s - b.s)

  const group = new THREE.Group(); group.name = 'metro'
  const concrete = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.85 })
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.35, metalness: 0.8 })
  // Viaduct: a beam every 2 m along the line, a pillar every 16 m, two rails.
  const beamGeo = new THREE.BoxGeometry(3.4, 1.1, 2.06)
  const nB = Math.floor(N / 2)
  const beams = new THREE.InstancedMesh(beamGeo, concrete, nB)
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.16, 2.06), steel, nB * 2)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3()
  for (let k = 0; k < nB; k++) {
    const p = at(k * 2 + 1)
    q.setFromAxisAngle(Y, p.h)
    beams.setMatrixAt(k, m.compose(v.set(p.x, DECK - 0.55, p.z), q, one))
    for (const s of [-1, 1]) rails.setMatrixAt(k * 2 + (s > 0 ? 1 : 0), m.compose(v.set(p.x + Math.cos(p.h) * 0.72 * s, DECK + 0.08, p.z - Math.sin(p.h) * 0.72 * s), q, one))
  }
  const nP = Math.floor(N / 16)
  const pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.7, DECK - 1.1, 12).translate(0, (DECK - 1.1) / 2, 0), concrete, nP)
  const pillarSpots: Array<{ x: number; z: number }> = []
  for (let k = 0; k < nP; k++) { const p = at(k * 16 + 8); pillarSpots.push({ x: p.x, z: p.z }); pillars.setMatrixAt(k, m.makeTranslation(p.x, 0, p.z)) }
  for (const im of [beams, rails, pillars]) { im.castShadow = true; im.receiveShadow = true; im.userData.ghost = true; im.raycast = () => undefined; group.add(im) }
  // Stations: a platform, a glass canopy and the name on a sign, beside the line; a totem at the street entrance.
  const signTex = (txt: string) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 112
    const g = c.getContext('2d')!
    g.fillStyle = '#0f1a14'; g.fillRect(0, 0, 512, 112)
    g.fillStyle = '#2bd46b'; g.beginPath(); g.arc(56, 56, 38, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#0f1a14'; g.font = '900 52px "Inter Variable", Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', 56, 60)
    g.fillStyle = '#ffffff'; g.font = '700 46px "Inter Variable", Inter, system-ui, sans-serif'; g.textAlign = 'left'; g.fillText(txt, 112, 60)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, side: THREE.DoubleSide })
  }
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfd8e2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 })
  for (const st of stops) {
    const p = at(st.s)
    const sg = new THREE.Group()
    const plat = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 34), concrete); plat.position.set(3.6, DECK - 0.15, 0); plat.receiveShadow = true; sg.add(plat)
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 34), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 })); edge.position.set(1.95, DECK + 0.04, 0); sg.add(edge)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 30), glass); roof.position.set(3.4, DECK + 3.3, 0); sg.add(roof)
    for (const z of [-13, -4, 5, 13]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.3, 0.14), steel); c.position.set(5.2, DECK + 1.65, z); sg.add(c) }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8), signTex(st.title)); sign.position.set(5.12, DECK + 2.4, 0); sign.rotation.y = -Math.PI / 2; sg.add(sign)
    const stair = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 11), concrete); stair.position.set(6.6, DECK / 2, -9); stair.rotation.x = -Math.atan2(DECK, 11); sg.add(stair)
    sg.position.set(p.x, 0, p.z); sg.rotation.y = p.h
    sg.traverse((o) => { o.userData.ghost = true; o.castShadow = true })
    group.add(sg)
    if (!AWAY.includes(st.id)) {
      const totem = new THREE.Group()
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.8, 0.16), steel); post.position.y = 1.4; totem.add(post)
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), signTex(st.title)); board.position.y = 2.6; totem.add(board)
      totem.position.set(st.street[0] + 1.4, 0, st.street[1]); totem.lookAt(0, 0, 0); totem.position.y = 0
      totem.traverse((o) => { o.userData.ghost = true })
      group.add(totem)
    }
  }

  // The train: three cars, white with a green band and a dark window strip, rounded noses at both ends.
  const white = new THREE.MeshStandardMaterial({ color: 0xf3f3ef, roughness: 0.3, metalness: 0.15 })
  const band = new THREE.MeshStandardMaterial({ color: 0x1fb85a, roughness: 0.4 })
  const win = new THREE.MeshStandardMaterial({ color: 0x0f1820, roughness: 0.08, metalness: 0.5, emissive: 0x2a3a48, emissiveIntensity: 0.25 })
  const cars: THREE.Group[] = []
  for (let k = 0; k < CARS; k++) {
    const c = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.6, CAR - 0.6), white); body.position.y = 1.55; c.add(body)
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.85, CAR - 1.4), win); w.position.y = 1.95; c.add(w)
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.22, CAR - 0.7), band); b.position.y = 1.2; c.add(b)
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, CAR - 0.8), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6 })); skirt.position.y = 0.25; c.add(skirt)
    if (k === 0 || k === CARS - 1) {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), white); nose.rotation.x = k === 0 ? Math.PI / 2 : -Math.PI / 2; nose.scale.set(1, 1.6, 0.95); nose.position.set(0, 1.5, (k === 0 ? 1 : -1) * (CAR / 2 - 0.3)); c.add(nose)
      const screen = new THREE.Mesh(new THREE.SphereGeometry(1.37, 18, 8, 0, Math.PI * 2, 0.25, 0.7), win); screen.rotation.x = k === 0 ? Math.PI / 2 : -Math.PI / 2; screen.scale.set(1, 1.6, 0.95); screen.position.copy(nose.position); c.add(screen)
    }
    c.traverse((o) => { o.castShadow = true; o.userData.ghost = true; o.raycast = () => undefined })
    group.add(c)
    cars.push(c)
  }
  scene.add(group)

  // Running: cruise, brake into each stop, wait, go again. s is the head of the train along the line.
  let s = stops[0]!.s - 120
  let speed = CRUISE
  let wait = 0
  let next = 0
  let riding = false
  let stopAt: StationId | null = null
  const nextStop = () => stops[next % stops.length]!
  const ahead = (target: number) => (((target - s) % N) + N) % N
  // Which stop comes first from here.
  const pickNext = () => { let best = 0, bd = Infinity; stops.forEach((st, i) => { const d = ahead(st.s); if (d > 1 && d < bd) { bd = d; best = i } }); next = best }
  pickNext()

  const place = () => {
    for (let k = 0; k < CARS; k++) {
      const p = at(s - k * CAR - CAR / 2)
      cars[k]!.position.set(p.x, DECK + 0.1, p.z)
      cars[k]!.rotation.y = p.h
    }
  }
  place()

  // HUD while riding: the next stop and how to get off.
  const hud = document.createElement('div'); hud.id = 'ride-hud'; hud.className = 'metro-hud'; hud.hidden = true
  const hb = document.createElement('b'); hb.className = 'rh-speed'; hb.textContent = 'M'
  const hl = document.createElement('span'); hl.className = 'rh-line'
  hud.append(hb, hl)
  document.body.append(hud)
  const paint = () => { const st = nextStop(); hl.textContent = wait > 0 ? `At ${stops[(next - 1 + stops.length) % stops.length]!.title}` : `Next: ${st.title}${stopAt === st.id ? ' · getting off' : ''}` }

  let turbo = 1
  return {
    get riding() { return riding },
    /** Tests only: run the line faster. */
    set turbo(n: number) { turbo = Math.max(1, Math.min(20, n)) },
    pillars: pillarSpots,
    /** Get on at a station: the train pulls in there (or is already standing at it) and waits for you. */
    board(id: StationId) {
      const st = stops.find((x) => x.id === id)!
      s = st.s
      speed = 0
      wait = DWELL
      next = (stops.indexOf(st) + 1) % stops.length
      riding = true
      stopAt = null
      place()
      hud.hidden = false
      document.body.classList.add('riding')
      paint()
    },
    /** Where to put the camera: the middle car. */
    view(): { x: number; z: number; y: number; heading: number } { const p = at(s - CAR * 1.5); return { x: p.x, z: p.z, y: DECK + 1.0, heading: p.h } },
    nextTitle: () => nextStop().title,
    nextId: () => nextStop().id,
    /** Get off at the next stop. */
    requestStop() { stopAt = nextStop().id; paint() },
    alight() { riding = false; stopAt = null; hud.hidden = true; document.body.classList.remove('riding') },
    tick(dt: number) {
      dt *= turbo
      if (wait > 0) {
        wait -= dt
        if (wait <= 0) { speed = 0.5 }
      } else {
        const st = nextStop()
        const d = ahead(st.s)
        const limit = Math.sqrt(2 * BRAKE * Math.max(0, d - 0.5))
        const want = Math.min(CRUISE, limit)
        speed = speed < want ? Math.min(want, speed + ACC * dt) : Math.max(want, speed - BRAKE * 2.5 * dt)
        s += Math.max(0.2, speed) * dt
        if (ahead(st.s) > N - 2 || d < 0.6) {
          // Arrived.
          s = st.s; speed = 0; wait = DWELL
          next = (next + 1) % stops.length
          if (riding && stopAt === st.id) { riding = false; stopAt = null; hud.hidden = true; document.body.classList.remove('riding'); deps.onArrive(st.id) }
        }
      }
      if (riding) paint()
      place()
    },
  }
}
export type Metro = ReturnType<typeof createMetro>
