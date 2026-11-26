// The Grind Raceway circuit, just south of the city (beyond the side road's end): a closed loop of asphalt
// with white edge lines, red and white kerbs on the corners, grass run-off, a low barrier all round, a start
// gantry over the chequered line, a grandstand on the main straight and trees. The car is kept inside the
// barriers by the track itself (no obstacle list): ride.ts asks where it is across the track and pushes it back.
import * as THREE from 'three'
import { crownCards, foliageMaterial } from './trees.ts'

export const TRACK_C = { x: 0, z: 196 }
export const TRACK_W = 12 // asphalt width
export const RUNOFF = 4.2 // grass between the edge and the barrier
const GRIP = 11 // m/s^2 of cornering the safe-speed profile allows (rivals and the test driver)
const CTRL: Array<[number, number]> = [
  [-58, -40], [-6, -42], [46, -40], [70, -24], [70, 2], [44, 14], [18, 4], [-2, 20], [12, 40], [-22, 46], [-56, 34], [-74, 8], [-74, -22],
]

export type Track = {
  pts: Array<{ x: number; z: number }>
  /** Unit tangent at each point. */
  tan: Array<{ x: number; z: number }>
  len: number
  start: number
  group: THREE.Group
  /** Nearest centreline point near `hint`, and the signed offset across the track (left is negative). */
  locate: (x: number, z: number, hint: number) => { i: number; lat: number }
  /** Safe speed (m/s) on the centreline at point i, from how sharply the track bends ahead. */
  safe: (i: number) => number
}

let built: Track | null = null
export function buildTrack(): Track {
  if (built) return built
  const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(TRACK_C.x + x, 0, TRACK_C.z + z)), true, 'centripetal')
  const total = curve.getLength()
  const n = Math.round(total) // about a metre apart
  const pts = curve.getSpacedPoints(n).slice(0, n).map((v) => ({ x: v.x, z: v.z }))
  const tan = pts.map((_, i) => { const a = pts[(i - 1 + n) % n]!, b = pts[(i + 1) % n]!; const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l } })
  // Curvature -> safe speed (lateral grip about 7 m/s^2), looking a little ahead.
  const bend = pts.map((_, i) => { const a = tan[(i - 3 + n) % n]!, b = tan[(i + 3) % n]!; return Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z)) / 6 })
  const safeRaw = bend.map((k) => Math.min(40, Math.sqrt(GRIP / Math.max(1e-4, k))))
  const safeAt = safeRaw.map((_, i) => { let m = Infinity; for (let d = 0; d < 26; d++) m = Math.min(m, safeRaw[(i + d) % n]! + d * 0.55); return m })
  // Start and finish on the main straight, at the second control point.
  let start = 0, bd = Infinity
  pts.forEach((p, i) => { const d = Math.hypot(p.x - (TRACK_C.x + CTRL[1]![0]), p.z - (TRACK_C.z + CTRL[1]![1])); if (d < bd) { bd = d; start = i } })

  const group = new THREE.Group()
  group.name = 'raceway'
  const left = (i: number, off: number) => ({ x: pts[i]!.x + tan[i]!.z * off, z: pts[i]!.z - tan[i]!.x * off })
  // A ribbon between two offsets across the track, closed round the loop; colour per segment.
  const ribbon = (o0: number, o1: number, y: number, colour: (i: number) => number, mat: THREE.Material, uvScale = 0) => {
    const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = []
    const c = new THREE.Color()
    for (let i = 0; i <= n; i++) {
      const k = i % n
      const a = left(k, o0), b = left(k, o1)
      pos.push(a.x, y, a.z, b.x, y, b.z)
      c.setHex(colour(k)); col.push(c.r, c.g, c.b, c.r, c.g, c.b)
      if (uvScale) uv.push(0, i * uvScale, 1, i * uvScale)
      if (i < n) { const v = i * 2; idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    if (uvScale) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat)
    m.receiveShadow = true
    group.add(m)
    return m
  }
  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    draw(cv.getContext('2d')!)
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4
    return t
  }
  // Ground: mown grass with stripes, round the whole circuit.
  const grassTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#4f7d3a'; g.fillRect(0, 0, 128, 128)
    g.fillStyle = '#5a8a42'; g.fillRect(0, 0, 128, 64)
    for (let k = 0; k < 900; k++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(30,60,20,0.25)' : 'rgba(140,180,90,0.18)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 2) }
  })
  grassTex.repeat.set(30, 22)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(380, 220), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }))
  ground.rotation.x = -Math.PI / 2; ground.position.set(TRACK_C.x, 0.005, TRACK_C.z - 6); ground.receiveShadow = true
  group.add(ground)
  // Asphalt with a little grain.
  const tarTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#44474c'; g.fillRect(0, 0, 128, 128)
    for (let k = 0; k < 2600; k++) { const v = Math.random(); g.fillStyle = v < 0.5 ? 'rgba(20,20,22,0.35)' : 'rgba(150,150,155,0.22)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1) }
  })
  ribbon(-TRACK_W / 2, TRACK_W / 2, 0.03, () => 0xffffff, new THREE.MeshStandardMaterial({ map: tarTex, vertexColors: true, roughness: 0.82 }), 0.12)
  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })
  // Edge lines, and kerbs where the track bends.
  ribbon(-TRACK_W / 2 + 0.35, -TRACK_W / 2 + 0.6, 0.036, () => 0xf2f2ee, flat)
  ribbon(TRACK_W / 2 - 0.6, TRACK_W / 2 - 0.35, 0.036, () => 0xf2f2ee, flat)
  const kerb = (i: number) => (bend[i]! > 0.012 ? (Math.floor(i / 2) % 2 ? 0xd8261c : 0xf4f1ea) : 0x4f7d3a)
  ribbon(-TRACK_W / 2 - 1.3, -TRACK_W / 2, 0.034, kerb, flat)
  ribbon(TRACK_W / 2, TRACK_W / 2 + 1.3, 0.034, kerb, flat)
  // Chequered start and finish line across the track.
  {
    const chk = canvasTex(64, 8, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x * 4, y * 4, 4, 4) } })
    const line = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W, 1.6), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.6 }))
    line.rotation.x = -Math.PI / 2
    line.rotation.z = -Math.atan2(tan[start]!.x, tan[start]!.z) + Math.PI / 2
    line.position.set(pts[start]!.x, 0.04, pts[start]!.z)
    group.add(line)
  }
  // Barriers: a low wall of white and blue blocks all round, beyond the run-off.
  const wallGeo = (off: number) => {
    const pos: number[] = [], col: number[] = [], idx: number[] = []
    const c = new THREE.Color()
    const H = 0.85
    for (let i = 0; i <= n; i++) {
      const k = i % n
      const p = left(k, off)
      c.setHex(Math.floor(i / 3) % 2 ? 0x2a5fb0 : 0xf4f4f0)
      pos.push(p.x, 0, p.z, p.x, H, p.z)
      col.push(c.r, c.g, c.b, c.r, c.g, c.b)
      if (i < n) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx); g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }))
    m.castShadow = true
    group.add(m)
  }
  wallGeo(-(TRACK_W / 2 + RUNOFF)); wallGeo(TRACK_W / 2 + RUNOFF)
  // Start gantry with the name across it.
  {
    const i = start
    const g = new THREE.Group()
    const steel = new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.4, metalness: 0.6 })
    const span = TRACK_W + 2 * RUNOFF + 1
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), steel); post.position.set((s * span) / 2, 3.5, 0); post.castShadow = true; g.add(post) }
    const name = canvasTex(1024, 128, (c) => {
      c.fillStyle = '#0f1216'; c.fillRect(0, 0, 1024, 128)
      c.fillStyle = '#2bd46b'; c.font = '800 78px "Inter Variable", Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('GRIND RACEWAY', 512, 68)
    })
    const banner = new THREE.Mesh(new THREE.BoxGeometry(span, 1.5, 0.4), [steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: name, roughness: 0.5, emissive: 0xffffff, emissiveMap: name, emissiveIntensity: 0.35 }), new THREE.MeshStandardMaterial({ map: name, roughness: 0.5, emissive: 0xffffff, emissiveMap: name, emissiveIntensity: 0.35 })])
    banner.position.y = 6.6; banner.castShadow = true
    g.add(banner)
    g.position.set(pts[i]!.x, 0, pts[i]!.z)
    g.rotation.y = Math.atan2(tan[i]!.x, tan[i]!.z)
    group.add(g)
  }
  // Grandstand beside the main straight, outside the barrier.
  {
    const i = (start + 18) % n
    const g = new THREE.Group()
    const conc = new THREE.MeshStandardMaterial({ color: 0xbfbab0, roughness: 0.9 })
    const seatCol = [0x1f5fbf, 0xe8e4da, 0x2bd46b]
    for (let r = 0; r < 6; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(48, 0.6, 1.3), conc)
      step.position.set(0, 0.3 + r * 0.6, r * 1.3); step.castShadow = true; step.receiveShadow = true; g.add(step)
      const seats = new THREE.Mesh(new THREE.BoxGeometry(47, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: seatCol[r % 3], roughness: 0.6 }))
      seats.position.set(0, 0.78 + r * 0.6, r * 1.3 - 0.2); g.add(seats)
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(50, 0.25, 9.5), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4, metalness: 0.2 }))
    roof.position.set(0, 6.4, 3.4); roof.castShadow = true; g.add(roof)
    for (const x of [-24, -8, 8, 24]) { const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.4, 0.35), new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.4, metalness: 0.6 })); col.position.set(x, 3.2, 7.6); g.add(col) }
    // The stand faces the track: it sits outside the barrier on the left of the straight.
    const off = -(TRACK_W / 2 + RUNOFF + 2.4)
    const p = left(i, off)
    g.position.set(p.x, 0, p.z)
    g.rotation.y = Math.atan2(tan[i]!.x, tan[i]!.z) - Math.PI / 2
    group.add(g)
  }
  // Trees round the outside, kept clear of the track and run-off.
  {
    const trunk = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 7).translate(0, 1.1, 0)
    const crown = crownCards(1.9, 3.4, 9, 14)
    const spots: Array<{ x: number; z: number; s: number }> = []
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let k = 0; k < 140 && spots.length < 46; k++) {
      const x = TRACK_C.x + (rnd() - 0.5) * 230, z = TRACK_C.z + (rnd() - 0.5) * 150
      let ok = true
      for (let i = 0; i < n; i += 3) if (Math.hypot(pts[i]!.x - x, pts[i]!.z - z) < TRACK_W / 2 + RUNOFF + 5) { ok = false; break }
      if (ok && z > 120) spots.push({ x, z, s: 0.8 + rnd() * 0.6 })
    }
    const tr = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x5b4330, roughness: 0.9 }), spots.length)
    const cr = new THREE.InstancedMesh(crown, foliageMaterial(), spots.length)
    const m = new THREE.Matrix4()
    spots.forEach((s, k) => { m.makeScale(s.s, s.s, s.s).setPosition(s.x, 0, s.z); tr.setMatrixAt(k, m); cr.setMatrixAt(k, m) })
    tr.castShadow = cr.castShadow = true
    group.add(tr, cr)
  }
  group.traverse((o) => { o.userData.ghost = true })

  const locate = (x: number, z: number, hint: number) => {
    let best = hint, bd = Infinity
    for (let d = -30; d <= 60; d++) { const k = (hint + d + n) % n; const p = pts[k]!; const dd = (p.x - x) ** 2 + (p.z - z) ** 2; if (dd < bd) { bd = dd; best = k } }
    if (bd > 30 * 30) { for (let k = 0; k < n; k++) { const p = pts[k]!; const dd = (p.x - x) ** 2 + (p.z - z) ** 2; if (dd < bd) { bd = dd; best = k } } }
    const p = pts[best]!, t = tan[best]!
    // Signed offset: positive to the left of travel (the left() helper's side).
    const lat = (x - p.x) * t.z - (z - p.z) * t.x
    return { i: best, lat }
  }
  built = { pts, tan, len: total, start, group, locate, safe: (i) => safeAt[((i % n) + n) % n]! }
  return built
}
