import * as THREE from 'three'
import { createFleet, type CarKind } from './cars.ts'
import type { Graphics } from './logic.ts'
import type { Obstacle } from './physics.ts'
import { RING_IN, RING_OUT, ROAD_END, ROAD_HALF } from './lanes.ts'
import { pbrSet } from './pbrTex.ts'

/**
 * Street infrastructure, all instanced and sharing a few materials: granite kerbs, paver sidewalks (CC0 Poly Haven
 * concrete_pavers), zebra crossings + stop lines, traffic lights, street name signs, bus shelters, bollards,
 * manholes, kerb drains, timber power poles with wires, park grass (CC0 leafy_grass), hedges, flower beds,
 * a railing round the basin, roundabout kerbs and a few parked cars (instanced car kit). Original geometry, no brands.
 */
export function createStreetscape(scene: THREE.Scene, o: { obstacles: Obstacle[]; graphics: Graphics }): void {
  const { obstacles, graphics } = o
  const low = graphics === 'low'
  const free = (x: number, z: number, r: number) => o.obstacles.every((b) => b.kind === 'circle' ? Math.hypot(x - b.x, z - b.z) > b.r + r : Math.abs(x - b.x) > b.hx + r || Math.abs(z - b.z) > b.hz + r)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0)
  type T = { x: number; y?: number; z: number; ry?: number; sx?: number; sy?: number; sz?: number }
  const inst = (g: THREE.BufferGeometry, m: THREE.Material, list: T[], cast = false) => {
    if (!list.length) return
    const im = new THREE.InstancedMesh(g, m, list.length)
    list.forEach((t, i) => im.setMatrixAt(i, m4.compose(v.set(t.x, t.y ?? 0, t.z), q.setFromAxisAngle(Y, t.ry ?? 0), sc.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1))))
    im.castShadow = cast && graphics === 'high'
    im.receiveShadow = !low
    im.userData.ghost = true
    im.raycast = () => undefined
    im.computeBoundingSphere()
    scene.add(im)
  }
  const paint = new THREE.MeshStandardMaterial({ color: 0x2d3133, roughness: 0.45, metalness: 0.6 })
  const granite = new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.85 })
  const white = new THREE.MeshStandardMaterial({ color: 0xe9e7df, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 })
  const pavers = new THREE.MeshStandardMaterial({ ...pbrSet('concrete_pavers', 1), color: 0xd0cbc2, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })
  const timber = new THREE.MeshStandardMaterial({ ...pbrSet('brown_planks_03', 1), color: 0x9a8670, roughness: 1 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4bd, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false })

  // Arms of the cross road, from the roundabout's outer edge to the turning bays.
  const arms = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
  const A0 = RING_OUT + 1.6, A1 = ROAD_END, LEN = A1 - A0, MID = (A0 + A1) / 2
  const along = (dx: number, dz: number, t: number, side: number) => ({ x: dx * t - dz * side, z: dz * t + dx * side, ry: dx ? 0 : Math.PI / 2 })

  // Kerbs (granite, 15 cm) and paver sidewalks on both sides of every arm.
  const kerbs: T[] = [], walks: T[] = []
  for (const [dx, dz] of arms) for (const s of [-1, 1]) {
    const k = along(dx, dz, MID, s * (ROAD_HALF + 0.08)); kerbs.push({ ...k, sx: LEN, y: 0.07 })
    const w = along(dx, dz, MID, s * (ROAD_HALF + 0.8)); walks.push({ ...w, sx: LEN, y: 0.02 })
  }
  inst(new THREE.BoxGeometry(1, 0.15, 0.18), granite, kerbs)
  {
    const g = new THREE.PlaneGeometry(1, 1.3).rotateX(-Math.PI / 2)
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * LEN / 1.6, uv.getY(i) * 1.3 / 1.6)
    // Scale only x in the instance: pre-bake the UV for the full length so tiles stay square.
    inst(g, pavers, walks)
  }

  // Roundabout: granite kerbs on both edges of the ring (gaps where the arms join), dashed give-way lines at
  // every entry, zebra crossings on each arm just outside the ring, pedestrian signals beside them.
  const ringKerb: T[] = []
  for (const [r, n] of [[RING_IN - 0.05, 72], [RING_OUT + 0.05, 92]] as const) for (let a = 0; a < n; a++) {
    const ang = ((a + 0.5) / n) * Math.PI * 2, x = Math.cos(ang) * r, z = Math.sin(ang) * r
    if (r > RING_IN && (Math.abs(x) < ROAD_HALF + 1.4 || Math.abs(z) < ROAD_HALF + 1.4)) continue
    ringKerb.push({ x, z, y: 0.07, ry: -ang, sx: 0.18, sz: (Math.PI * 2 * r) / n + 0.02 })
  }
  inst(new THREE.BoxGeometry(1, 0.15, 1), granite, ringKerb)
  const stripes: T[] = [], stops: T[] = [], lights: T[] = []
  for (const [dx, dz] of arms) {
    for (let k = -2; k <= 2; k++) stripes.push({ ...along(dx, dz, A0 + 1.6, k * 1.1), y: 0.012, sx: dx ? 2.2 : 0.55, sz: dx ? 0.55 : 2.2, ry: 0 })
    for (let k = 0; k < 4; k++) stops.push({ ...along(dx, dz, RING_OUT + 0.5, -0.4 - k * 0.8), y: 0.012, sx: dx ? 0.25 : 0.5, sz: dx ? 0.5 : 0.25, ry: 0 })
    for (const s of [-1, 1]) { const p = along(dx, dz, A0 + 3.2, s * (ROAD_HALF + 0.45)); if (free(p.x, p.z, 0.3)) lights.push({ ...p, ry: Math.atan2(-dx, -dz) }) }
  }
  inst(new THREE.BoxGeometry(1, 0.01, 1), white, [...stripes, ...stops])
  inst(new THREE.CylinderGeometry(0.06, 0.07, 3, 8).translate(0, 1.5, 0), paint, lights, true)
  inst(new THREE.BoxGeometry(0.32, 0.9, 0.26).translate(0, 2.85, 0.12), paint, lights, true)
  const lamp = (c: number, y: number, e: number) => inst(new THREE.CircleGeometry(0.09, 12).translate(0, y, 0.255),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.3 }), lights)
  lamp(0x5a1a14, 3.12, 0.15); lamp(0x6a5214, 2.85, 0.1); lamp(0x2bd17a, 2.58, 0.9)
  for (const l of lights) obstacles.push({ kind: 'circle', x: l.x, z: l.z, r: 0.2 })

  // Street name signs (generic names) on a post at each crossing.
  const names = ['Ledger Ave', 'Harbour St', 'Campus Rd', 'Market Way']
  arms.forEach(([dx, dz], i) => {
    const p = along(dx, dz, A0 + 0.3, ROAD_HALF + 0.5)
    if (!free(p.x, p.z, 0.2)) return
    const c = document.createElement('canvas'); c.width = 256; c.height = 64
    const g = c.getContext('2d')!; g.fillStyle = '#1f4d3a'; g.fillRect(0, 0, 256, 64); g.strokeStyle = '#e8e8e0'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 56)
    g.fillStyle = '#f2f2ea'; g.font = '600 34px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(names[i]!, 128, 34)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6).translate(0, 1.3, 0), paint)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.02), [paint, paint, paint, paint, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })])
    plate.position.y = 2.5; plate.rotation.y = dx ? 0 : Math.PI / 2
    const gr = new THREE.Group(); gr.add(post, plate); gr.position.set(p.x, 0, p.z); scene.add(gr)
    obstacles.push({ kind: 'circle', x: p.x, z: p.z, r: 0.12 })
  })

  // Bus shelters: steel frame, glass back and sides, timber bench, slim roof.
  for (const [x, z, ry] of [[26, -5.6, 0], [-5.6, 26, Math.PI / 2]] as const) {
    if (!free(x, z, 1.2)) continue
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, px: number, py: number, pz: number) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = graphics === 'high'; me.receiveShadow = !low; g.add(me) }
    for (const px of [-1.4, 1.4]) for (const pz of [-0.5, 0.5]) add(new THREE.BoxGeometry(0.06, 2.3, 0.06), paint, px, 1.15, pz)
    add(new THREE.BoxGeometry(3.1, 0.08, 1.4), paint, 0, 2.32, 0)
    add(new THREE.BoxGeometry(2.8, 1.9, 0.02), glass, 0, 1.15, -0.5)
    for (const px of [-1.4, 1.4]) add(new THREE.BoxGeometry(0.02, 1.9, 0.9), glass, px, 1.15, 0)
    add(new THREE.BoxGeometry(2.2, 0.06, 0.38), timber, 0, 0.46, -0.28)
    add(new THREE.BoxGeometry(2.0, 0.42, 0.06), paint, 0, 0.22, -0.3)
    scene.add(g)
    obstacles.push({ kind: 'box', x, z, hx: ry ? 0.7 : 1.55, hz: ry ? 1.55 : 0.7 })
  }

  // Bollards ring the plaza where the arms meet it (keeps cars off the paving visually).
  const bollards: T[] = []
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2, x = Math.cos(ang) * 15.3, z = Math.sin(ang) * 15.3
    if (Math.abs(x) < ROAD_HALF + 0.3 || Math.abs(z) < ROAD_HALF + 0.3) continue
    if (a % 2 === 0 && free(x, z, 0.15)) bollards.push({ x, z })
  }
  inst(new THREE.CylinderGeometry(0.09, 0.1, 0.8, 10).translate(0, 0.4, 0), paint, bollards, true)
  inst(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10).translate(0, 0.66, 0), new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.5 }), bollards)

  // Manholes in the lanes, kerb drains along the gutter.
  const holes: T[] = [], drains: T[] = []
  for (const [dx, dz] of arms) for (let t = A0 + 3; t < A1 - 2; t += 9) {
    holes.push({ ...along(dx, dz, t, (t % 2 ? 1 : -1) * ROAD_HALF * 0.5), y: 0.013 })
    for (const s of [-1, 1]) drains.push({ ...along(dx, dz, t + 3, s * (ROAD_HALF - 0.25)), y: 0.013 })
  }
  // Covers are painted so they read as what they are: a cast manhole lid with a ring and treads, a slotted kerb drain.
  const cover = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')!; draw(g)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.35, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -3 })
  }
  const lid = cover((g) => {
    g.fillStyle = '#5f6266'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill()
    g.strokeStyle = '#3d4043'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke()
    g.lineWidth = 5; for (let i = -3; i <= 3; i++) { const w = Math.sqrt(1 - (i / 4) ** 2) * 40; g.beginPath(); g.moveTo(64 - w, 64 + i * 11); g.lineTo(64 + w, 64 + i * 11); g.stroke() }
  })
  const grate = cover((g) => {
    g.fillStyle = '#5f6266'; g.fillRect(2, 34, 124, 60)
    g.fillStyle = '#26282a'; for (let x = 12; x < 116; x += 15) g.fillRect(x, 42, 8, 44)
  })
  inst(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), lid, holes)
  inst(new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2), grate, drains.map((d) => ({ ...d, ry: (d.ry ?? 0) })))

  // Park (basin at -40,40): real grass, a clipped hedge ring, flower beds and a steel railing round the water.
  const grassSet = pbrSet('leafy_grass', 9)
  const grass = new THREE.Mesh(new THREE.RingGeometry(6.7, 14, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ ...grassSet, color: 0xb6c79a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }))
  grass.position.set(-40, 0.01, 40); grass.receiveShadow = !low; grass.userData.ghost = true; grass.raycast = () => undefined
  scene.add(grass)
  const hedge = new THREE.MeshStandardMaterial({ ...pbrSet('leafy_grass', 1), color: 0x5c7a45, roughness: 1 })
  const hedges: T[] = [], flowers: T[] = [], rails: T[] = []
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2, x = -40 + Math.cos(ang) * 13.4, z = 40 + Math.sin(ang) * 13.4
    if (a % 6 === 0 || !free(x, z, 0.6)) continue
    hedges.push({ x, z, y: 0.35, ry: -ang, sx: 0.6, sy: 0.7, sz: 3.2 })
  }
  const fr = (s: number) => { s = Math.sin(s * 91.7) * 43758.5; return s - Math.floor(s) }
  for (let i = 0; i < (low ? 60 : 160); i++) {
    const ang = fr(i) * Math.PI * 2, r = 8 + fr(i + 50) * 1.2
    flowers.push({ x: -40 + Math.cos(ang) * r, z: 40 + Math.sin(ang) * r, y: 0.12, sx: 0.12, sy: 0.12, sz: 0.12 })
  }
  for (let a = 0; a < 40; a++) { if (a % 10 === 0) continue; const ang = (a / 40) * Math.PI * 2; rails.push({ x: -40 + Math.cos(ang) * 6.9, z: 40 + Math.sin(ang) * 6.9, ry: -ang }) }
  inst(new THREE.BoxGeometry(1, 1, 1), hedge, hedges, true)
  {
    const g = new THREE.IcosahedronGeometry(1, 0)
    const col = new Float32Array(g.getAttribute('position').count * 3)
    g.setAttribute('color', new THREE.BufferAttribute(col.fill(1), 3))
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.8 }), flowers.length)
    const palette = [0xd9534f, 0xf0c419, 0xe7e2f0, 0xc56cd6, 0xf08a4b].map((c) => new THREE.Color(c))
    flowers.forEach((t, i) => { im.setMatrixAt(i, m4.compose(v.set(t.x, t.y!, t.z), q.identity(), sc.set(t.sx!, t.sy!, t.sz!))); im.setColorAt(i, palette[i % palette.length]!) })
    im.userData.ghost = true; im.raycast = () => undefined; scene.add(im)
  }
  inst(new THREE.BoxGeometry(0.04, 0.9, 1.1).translate(0, 0.45, 0), paint, rails)
  inst(new THREE.BoxGeometry(0.06, 0.05, 1.1).translate(0, 0.92, 0), paint, rails)

  // Parked cars in kerbside bays at the far end of each arm (lazy: after first paint, medium/high only).
  if (!low) {
    const bays: T[] = []
    for (const [dx, dz] of arms) { const p = along(dx, dz, 31, ROAD_HALF + 2.6); if (free(p.x, p.z, 1.3)) bays.push({ ...p, ry: (dx ? Math.PI / 2 : 0) }) }
    const kinds: CarKind[] = ['sedan', 'suv', 'hatchback', 'van']
    const go = () => {
      const fleet = createFleet(scene, bays.map((_, i) => kinds[i % kinds.length]!), { shadows: graphics === 'high', colours: [0x2b2e33, 0xc8b48f, 0x8e1b22, 0xf1f1ee] })
      bays.forEach((b, i) => fleet.set(i, b.x, b.z, b.ry!, 0))
      fleet.commit()
      for (const b of bays) obstacles.push({ kind: 'box', x: b.x, z: b.z, hx: b.ry ? 2.3 : 1.0, hz: b.ry ? 1.0 : 2.3 })
    }
    ;(window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500)))(go)
  }
}
