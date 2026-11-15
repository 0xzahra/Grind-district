// Zoo animals for Grind Park, built in code but shaped like the real thing: each body is one smooth skin lofted
// along a spine (no stretched balls), with a separate neck and head that can turn and bob, jointed legs (hip,
// knee, hoof or paw) that bend as they walk, and coats painted the way the animal looks: a giraffe's reticulated
// patches, a zebra's stripes that follow the body and fade under the belly, an elephant's wrinkled grey hide, a
// lion's tawny coat with a pale belly and a shaggy mane, and pink flamingos standing on one leg. parkPlus.ts
// places them in their enclosures and walks them about.
import * as THREE from 'three'

export type Animal = { g: THREE.Group; legs: THREE.Object3D[]; neck?: THREE.Object3D; tail?: THREE.Object3D; trunk?: THREE.Object3D; speed: number; stride: number }
type St = [number, number, number, number, number] // spine point x, y, z and the cross-section's half-width and half-height

// ---------------------------------------------------------------- coats (painted once, shared)
const cache = new Map<string, THREE.CanvasTexture>()
function canvasTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, img: ImageData) => void, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  draw(g, img)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  cache.set(key, t)
  return t
}
let rs = 7
const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647)
/** Giraffe: irregular liver-brown patches split by a network of cream lines (a tiling Voronoi pattern). */
const giraffeCoat = () => canvasTex('giraffe', 256, (g, img) => {
  const S = 256, pts: Array<[number, number, number]> = []
  for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 5; gx++) pts.push([(gx + 0.15 + rnd() * 0.7) / 5, (gy + 0.15 + rnd() * 0.7) / 5, rnd()])
  const d = img.data
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S
    let d1 = 9, d2 = 9, k1 = 0
    for (let i = 0; i < pts.length; i++) {
      let dx = Math.abs(u - pts[i]![0]), dy = Math.abs(v - pts[i]![1]); if (dx > 0.5) dx = 1 - dx; if (dy > 0.5) dy = 1 - dy
      const dd = Math.hypot(dx, dy)
      if (dd < d1) { d2 = d1; d1 = dd; k1 = i } else if (dd < d2) d2 = dd
    }
    const edge = d2 - d1, line = edge < 0.022 ? 1 : edge < 0.03 ? 1 - (edge - 0.022) / 0.008 : 0
    const tone = pts[k1]![2], grain = (Math.sin(x * 1.7 + y * 0.9) + Math.sin(x * 0.37 - y * 2.1)) * 4
    const pr = 128 + tone * 40 + grain, pg = 70 + tone * 22 + grain * 0.6, pb = 34 + tone * 14
    const o = (y * S + x) * 4
    d[o] = pr + (238 - pr) * line; d[o + 1] = pg + (222 - pg) * line; d[o + 2] = pb + (186 - pb) * line; d[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
})
/** Zebra: black stripes across the body that wobble and taper, fading to white under the belly (u near 0 and 1). */
const zebraCoat = (legs: boolean) => canvasTex(legs ? 'zebra-legs' : 'zebra', 256, (g, img) => {
  const S = 256, d = img.data
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S
    const wob = Math.sin(u * Math.PI * 2) * 0.035 + Math.sin(u * Math.PI * 6 + 1.3) * 0.01
    const band = Math.sin((v + wob) * Math.PI * 2 * (legs ? 6 : 5))
    const belly = legs ? 0 : Math.max(0, 1 - Math.min(u, 1 - u) / 0.16)
    const width = 0.05 + 0.25 * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 + 0.6))
    let k = band > width ? 1 : band > width - 0.12 ? (band - (width - 0.12)) / 0.12 : 0
    k *= 1 - belly
    const c = 244 - k * 226 + (Math.sin(x * 2.1 + y) * 3)
    const o = (y * S + x) * 4
    d[o] = c; d[o + 1] = c; d[o + 2] = c - (1 - k) * 6; d[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
})
/** Elephant: grey hide with fine crossing wrinkles and blotches. */
const elephantHide = () => canvasTex('elephant', 256, (g) => {
  g.fillStyle = '#8b8781'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '70,66,62' : '160,154,148'},${0.05 + rnd() * 0.08})`; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 0, Math.PI * 2); g.fill() }
  g.strokeStyle = 'rgba(48,44,40,.35)'; g.lineWidth = 1
  for (let i = 0; i < 260; i++) { const x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 8 + rnd() * 6, y + Math.sin(a) * 8, x + Math.cos(a) * 18, y + Math.sin(a) * 18); g.stroke() }
}, [2, 2])
/** Lion: tawny fur grain. */
const lionFur = () => canvasTex('lion', 128, (g) => {
  g.fillStyle = '#c99a58'; g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 1400; i++) { g.strokeStyle = `rgba(${rnd() > 0.5 ? '120,80,36' : '232,196,140'},${0.08 + rnd() * 0.12})`; const x = rnd() * 128, y = rnd() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 2 - 1, y + 3 + rnd() * 4); g.stroke() }
}, [3, 3])
/** The mane: long dark-gold locks. */
const maneFur = () => canvasTex('mane', 128, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, '#5a3418'); grd.addColorStop(1, '#8a5a28'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${rnd() > 0.4 ? '40,22,10' : '176,120,58'},${0.15 + rnd() * 0.2})`; g.lineWidth = 1 + rnd(); const x = rnd() * 128, y = rnd() * 128; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y + 6, x + rnd() * 4 - 2, y + 12 + rnd() * 8); g.stroke() }
}, [4, 2])
/** Flamingo: soft pink feathers. */
const feathers = () => canvasTex('flamingo', 128, (g) => {
  g.fillStyle = '#f39aa8'; g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '232,110,134' : '252,196,204'},${0.18 + rnd() * 0.2})`; const x = rnd() * 128, y = rnd() * 128; g.beginPath(); g.ellipse(x, y, 4, 2, rnd() * 0.6, 0, Math.PI * 2); g.fill() }
}, [2, 2])

// ---------------------------------------------------------------- shapes
const mat = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o })
const tmp = { t: new THREE.Vector3(), s: new THREE.Vector3(), u: new THREE.Vector3(), up: new THREE.Vector3() }

/** A smooth skin lofted through spine stations; `vScale` sets how many metres one copy of the coat covers.
 *  `shade` darkens the back and lightens the belly (a real coat's countershading). Caps close both ends. */
function loft(st: St[], m: THREE.Material, o: { seg?: number; steps?: number; vScale?: number; shade?: number; dark?: (v: number) => number } = {}): THREE.Mesh {
  const seg = o.seg ?? 16, steps = o.steps ?? Math.max(12, st.length * 8), vScale = o.vScale ?? 1
  const path = new THREE.CatmullRomCurve3(st.map((s) => new THREE.Vector3(s[0], s[1], s[2])), false, 'centripetal')
  const rad = new THREE.CatmullRomCurve3(st.map((s) => new THREE.Vector3(s[3], s[4], 0)), false, 'catmullrom', 0.5)
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = []
  let len = 0
  const prev = new THREE.Vector3()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = path.getPoint(t), r = rad.getPoint(t)
    if (i) len += p.distanceTo(prev); prev.copy(p)
    path.getTangent(t, tmp.t)
    tmp.up.set(0, 1, 0); if (Math.abs(tmp.t.y) > 0.92) tmp.up.set(0, 0, -1)
    tmp.s.crossVectors(tmp.t, tmp.up).normalize(); tmp.u.crossVectors(tmp.s, tmp.t).normalize()
    const dk = o.dark ? o.dark(t) : 0
    for (let j = 0; j <= seg; j++) {
      const a = -Math.PI / 2 + (j / seg) * Math.PI * 2 // the seam runs under the belly
      const c = Math.cos(a), sn = Math.sin(a)
      pos.push(p.x + tmp.s.x * r.x * c + tmp.u.x * r.y * sn, p.y + tmp.s.y * r.x * c + tmp.u.y * r.y * sn, p.z + tmp.s.z * r.x * c + tmp.u.z * r.y * sn)
      uv.push(j / seg, len / vScale)
      const sh = 1 - (o.shade ?? 0) * (0.5 + 0.5 * sn) * 0.5 + (o.shade ?? 0) * (0.5 - 0.5 * sn) * 0.15
      const k = Math.max(0, Math.min(1, sh * (1 - dk)))
      col.push(k, k, k)
    }
  }
  const ring = seg + 1
  for (let i = 0; i < steps; i++) for (let j = 0; j < seg; j++) { const a = i * ring + j, b = a + ring; idx.push(a, b, a + 1, b, b + 1, a + 1) }
  // Caps.
  for (const end of [0, steps]) {
    const ci = pos.length / 3, base = end * ring
    let cx = 0, cy = 0, cz = 0
    for (let j = 0; j < seg; j++) { cx += pos[(base + j) * 3]!; cy += pos[(base + j) * 3 + 1]!; cz += pos[(base + j) * 3 + 2]! }
    pos.push(cx / seg, cy / seg, cz / seg); uv.push(0.5, end ? len / vScale : 0); const k = col[base * 3]!; col.push(k, k, k)
    for (let j = 0; j < seg; j++) end ? idx.push(base + j, ci, base + j + 1) : idx.push(base + j + 1, ci, base + j)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx); geo.computeVertexNormals()
  // Weld the seam's normals so there is no crease under the belly.
  const n = geo.getAttribute('normal') as THREE.BufferAttribute
  for (let i = 0; i <= steps; i++) { const a = i * ring, b = a + seg; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l) }
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}
const ball = (m: THREE.Material, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.castShadow = true; return b }
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 0.15, metalness: 0.1 })
const eyes = (head: THREE.Object3D, x: number, y: number, z: number, r: number) => { for (const s of [-1, 1]) head.add(ball(eyeMat, r, s * x, y, z)) }

/** A jointed leg hanging from (x, y, z): thigh to the knee, cannon to the hoof or paw. The knee bends as it walks. */
function leg(body: THREE.Group, coat: THREE.Material, foot: THREE.Material, x: number, y: number, z: number, o: { knee: number; r: [number, number, number]; footH: number; footR: number; front: boolean; vScale?: number; paw?: boolean }): THREE.Object3D {
  const hip = new THREE.Group(); hip.position.set(x, y, z); body.add(hip)
  const kneeDrop = y - o.knee
  hip.add(loft([[0, 0.05, 0, o.r[0], o.r[0] * 1.15], [0, -kneeDrop * 0.5, 0.0, (o.r[0] + o.r[1]) * 0.55, (o.r[0] + o.r[1]) * 0.6], [0, -kneeDrop, 0, o.r[1], o.r[1]]], coat, { seg: 10, steps: 10, vScale: o.vScale ?? 1, shade: 0.2 }))
  const knee = new THREE.Group(); knee.position.set(0, -kneeDrop, 0); hip.add(knee)
  const low = o.knee - o.footH
  knee.add(loft([[0, 0.02, 0, o.r[1] * 1.05, o.r[1] * 1.05], [0, -low * 0.6, 0, o.r[2] * 1.05, o.r[2]], [0, -low, 0, o.r[2], o.r[2]]], coat, { seg: 10, steps: 8, vScale: o.vScale ?? 1, shade: 0.15 }))
  if (o.paw) knee.add(ball(foot, o.footR, 0, -low - o.footH * 0.5, 0.04, 1, 0.6, 1.25))
  else { const h = new THREE.Mesh(new THREE.CylinderGeometry(o.footR * 0.85, o.footR, o.footH, 12), foot); h.position.y = -low - o.footH / 2; h.castShadow = true; knee.add(h) }
  hip.userData.knee = knee; hip.userData.front = o.front
  return hip
}
const tailOf = (body: THREE.Group, coat: THREE.Material, tuft: THREE.Material, x: number, y: number, z: number, len: number, r: number, tuftR: number) => {
  const t = new THREE.Group(); t.position.set(x, y, z)
  t.add(loft([[0, 0, 0, r, r], [0, -len * 0.5, -0.06, r * 0.8, r * 0.8], [0, -len, -0.04, r * 0.6, r * 0.6]], coat, { seg: 8, steps: 8 }))
  t.add(ball(tuft, tuftR, 0, -len - tuftR * 0.6, -0.04, 0.9, 1.6, 0.9))
  t.rotation.x = 0.25; body.add(t)
  return t
}

// ---------------------------------------------------------------- the animals
export function giraffe(): Animal {
  const g = new THREE.Group()
  const coat = mat({ map: giraffeCoat(), vertexColors: true }), hoof = mat({ color: 0x2b211a, roughness: 0.6 }), dark = mat({ color: 0x3a2516 })
  g.add(loft([[0, 2.7, -1.05, 0.1, 0.12], [0, 2.82, -0.9, 0.4, 0.46], [0, 2.92, -0.35, 0.5, 0.58], [0, 3.02, 0.25, 0.48, 0.6], [0, 3.15, 0.72, 0.36, 0.5], [0, 3.3, 0.92, 0.22, 0.3]], coat, { vScale: 1.1, shade: 0.35 }))
  // Neck and head: one skin from inside the shoulders up to the muzzle, on a pivot so the head can turn and bob.
  const neck = new THREE.Group(); neck.position.set(0, 3.15, 0.75)
  neck.add(loft([[0, -0.1, -0.1, 0.3, 0.42], [0, 0.6, 0.22, 0.2, 0.27], [0, 1.4, 0.5, 0.15, 0.19], [0, 2.05, 0.68, 0.12, 0.15], [0, 2.22, 0.78, 0.13, 0.15], [0, 2.18, 1.02, 0.11, 0.12], [0, 2.08, 1.24, 0.08, 0.085], [0, 2.03, 1.32, 0.05, 0.05]], coat, { vScale: 1.1, shade: 0.3, dark: (t) => (t > 0.93 ? 0.45 : 0) }))
  // A short dark mane along the back of the neck.
  neck.add(loft([[0, 0.1, -0.2, 0.03, 0.06], [0, 0.9, 0.08, 0.03, 0.07], [0, 1.9, 0.5, 0.025, 0.05]], dark, { seg: 6, steps: 10 }))
  for (const s of [-1, 1]) {
    const horn = loft([[s * 0.06, 2.3, 0.78, 0.03, 0.03], [s * 0.07, 2.44, 0.76, 0.028, 0.028], [s * 0.075, 2.5, 0.75, 0.04, 0.04]], dark, { seg: 8, steps: 6 }); neck.add(horn)
    const ear = ball(coat, 0.07, s * 0.15, 2.32, 0.72, 0.5, 0.9, 1.6); ear.rotation.z = s * 0.9; neck.add(ear)
  }
  eyes(neck, 0.115, 2.25, 0.95, 0.03)
  g.add(neck)
  const legs = [[0.27, 0.62, true], [-0.27, 0.62, true], [0.25, -0.72, false], [-0.25, -0.72, false]].map(([x, z, f]) => leg(g, coat, hoof, x as number, 2.75, z as number, { knee: 1.25, r: [0.15, 0.085, 0.06], footH: 0.12, footR: 0.075, front: f as boolean, vScale: 1.1 }))
  const tail = tailOf(g, coat, dark, 0, 2.78, -1.02, 0.95, 0.035, 0.08)
  return { g, legs, neck, tail, speed: 0.9, stride: 1.6 }
}

export function zebra(): Animal {
  const g = new THREE.Group()
  const coat = mat({ map: zebraCoat(false), vertexColors: true, roughness: 0.75 }), legCoat = mat({ map: zebraCoat(true), roughness: 0.75 }), black = mat({ color: 0x141416, roughness: 0.6 })
  g.add(loft([[0, 1.26, -0.86, 0.08, 0.1], [0, 1.36, -0.7, 0.34, 0.4], [0, 1.32, -0.15, 0.38, 0.44], [0, 1.36, 0.38, 0.33, 0.43], [0, 1.48, 0.62, 0.24, 0.34]], coat, { vScale: 1.6, shade: 0.12 }))
  const neck = new THREE.Group(); neck.position.set(0, 1.45, 0.58)
  neck.add(loft([[0, -0.05, -0.05, 0.22, 0.33], [0, 0.3, 0.24, 0.15, 0.27], [0, 0.58, 0.46, 0.12, 0.17], [0, 0.6, 0.58, 0.11, 0.14], [0, 0.42, 0.78, 0.095, 0.12], [0, 0.24, 0.92, 0.075, 0.09], [0, 0.19, 0.97, 0.06, 0.06]], coat, { vScale: 1.4, shade: 0.1, dark: (t) => (t > 0.86 ? 0.9 : 0) }))
  // The upright mane, striped like the coat.
  neck.add(loft([[0, 0.12, -0.12, 0.025, 0.08], [0, 0.45, 0.2, 0.025, 0.09], [0, 0.7, 0.48, 0.02, 0.06]], legCoat, { seg: 6, steps: 10, vScale: 0.5 }))
  for (const s of [-1, 1]) { const ear = ball(coat, 0.05, s * 0.08, 0.74, 0.55, 0.6, 1.8, 0.8); ear.rotation.z = -s * 0.35; neck.add(ear) }
  eyes(neck, 0.095, 0.6, 0.66, 0.022)
  g.add(neck)
  const legs = [[0.17, 0.42, true], [-0.17, 0.42, true], [0.17, -0.62, false], [-0.17, -0.62, false]].map(([x, z, f]) => leg(g, legCoat, black, x as number, 1.25, z as number, { knee: 0.6, r: [0.11, 0.055, 0.045], footH: 0.08, footR: 0.055, front: f as boolean, vScale: 0.9 }))
  const tail = tailOf(g, legCoat, black, 0, 1.36, -0.86, 0.55, 0.025, 0.06)
  return { g, legs, neck, tail, speed: 1.3, stride: 1.7 }
}

export function elephant(): Animal {
  const g = new THREE.Group()
  const hide = mat({ map: elephantHide(), bumpMap: elephantHide(), bumpScale: 2.2, vertexColors: true, roughness: 0.95 }), nail = mat({ color: 0xd8cfc0, roughness: 0.6 }), ivory = mat({ color: 0xf1e8d6, roughness: 0.45 })
  g.add(loft([[0, 2.2, -1.42, 0.12, 0.14], [0, 2.38, -1.2, 0.82, 0.92], [0, 2.46, -0.4, 1.02, 1.1], [0, 2.5, 0.45, 0.96, 1.08], [0, 2.56, 1.0, 0.74, 0.92]], hide, { vScale: 2.2, shade: 0.2 }))
  // Head with the domed brow, the trunk and the tusks: on a pivot so the head can sway.
  const head = new THREE.Group(); head.position.set(0, 2.6, 1.05)
  head.add(loft([[0, 0.0, -0.2, 0.6, 0.75], [0, 0.25, 0.3, 0.62, 0.7], [0, 0.1, 0.72, 0.5, 0.58], [0, -0.3, 0.92, 0.32, 0.36]], hide, { vScale: 2.2, shade: 0.15 }))
  const trunk = new THREE.Group(); trunk.position.set(0, -0.35, 0.95)
  trunk.add(loft([[0, 0.05, -0.05, 0.24, 0.22], [0, -0.45, 0.16, 0.17, 0.16], [0, -1.0, 0.2, 0.12, 0.11], [0, -1.45, 0.3, 0.085, 0.08], [0, -1.62, 0.45, 0.07, 0.065]], hide, { seg: 12, steps: 24, vScale: 2.2, shade: 0.1 }))
  head.add(trunk)
  for (const s of [-1, 1]) {
    const tusk = loft([[s * 0.25, -0.35, 0.8, 0.07, 0.07], [s * 0.3, -0.75, 1.0, 0.055, 0.055], [s * 0.28, -0.9, 1.25, 0.03, 0.03]], ivory, { seg: 8, steps: 10 }); head.add(tusk)
    // Big ears: thin, wide, hanging back against the shoulders.
    const ear = loft([[s * 0.55, 0.45, 0.1, 0.06, 0.55], [s * 0.72, 0.0, -0.1, 0.06, 0.62], [s * 0.7, -0.55, -0.15, 0.05, 0.35]], hide, { seg: 10, steps: 10, vScale: 2.2 })
    ear.userData.ear = s; head.add(ear)
  }
  eyes(head, 0.5, 0.15, 0.62, 0.035)
  g.add(head)
  const legs = [[0.5, 0.75, true], [-0.5, 0.75, true], [0.48, -0.95, false], [-0.48, -0.95, false]].map(([x, z, f]) => leg(g, hide, nail, x as number, 1.95, z as number, { knee: 0.95, r: [0.34, 0.27, 0.25], footH: 0.12, footR: 0.28, front: f as boolean, vScale: 2.2 }))
  const tail = tailOf(g, hide, mat({ color: 0x2a2826 }), 0, 2.3, -1.42, 0.85, 0.04, 0.06)
  return { g, legs, neck: head, tail, trunk, speed: 0.7, stride: 1.3 }
}

export function lion(male: boolean): Animal {
  const g = new THREE.Group()
  const coat = mat({ map: lionFur(), vertexColors: true }), paw = mat({ color: 0xb98a4c }), mane = mat({ map: maneFur(), roughness: 0.95 }), nose = mat({ color: 0x3a2218, roughness: 0.4 })
  g.add(loft([[0, 0.92, -0.88, 0.07, 0.08], [0, 0.98, -0.7, 0.27, 0.32], [0, 0.93, -0.2, 0.24, 0.27], [0, 0.98, 0.32, 0.29, 0.38], [0, 1.08, 0.6, 0.26, 0.34]], coat, { vScale: 0.9, shade: 0.45 }))
  const head = new THREE.Group(); head.position.set(0, 1.12, 0.7)
  head.add(loft([[0, -0.02, -0.08, 0.2, 0.24], [0, 0.04, 0.14, 0.22, 0.23], [0, 0.04, 0.3, 0.18, 0.18], [0, -0.02, 0.44, 0.1, 0.1], [0, -0.04, 0.5, 0.07, 0.07]], coat, { vScale: 0.9, shade: 0.3 }))
  head.add(ball(nose, 0.04, 0, 0.0, 0.52, 1.2, 0.8, 0.8))
  for (const s of [-1, 1]) head.add(ball(coat, 0.055, s * 0.15, 0.2, 0.08, 1, 1, 0.5))
  eyes(head, 0.085, 0.09, 0.33, 0.022)
  if (male) {
    // A shaggy mane: overlapping ruffs round the head and down the chest.
    for (let k = 0; k < 3; k++) {
      const r = 0.34 - k * 0.04
      const ruff = loft([[0, -0.12 + k * 0.02, -0.25 + k * 0.08, r * 0.9, r], [0, 0.0, -0.05 + k * 0.05, r * 1.08, r * 1.12], [0, 0.04, 0.14 + k * 0.03, r * 0.85, r * 0.9]], mane, { seg: 14, steps: 8, vScale: 0.5 })
      ruff.rotation.z = (k - 1) * 0.15; head.add(ruff)
    }
    g.add(loft([[0, 1.08, 0.38, 0.22, 0.3], [0, 0.92, 0.6, 0.18, 0.26], [0, 0.78, 0.66, 0.1, 0.14]], mane, { seg: 12, steps: 8, vScale: 0.5 }))
  }
  g.add(head)
  const legs = [[0.15, 0.48, true], [-0.15, 0.48, true], [0.16, -0.62, false], [-0.16, -0.62, false]].map(([x, z, f]) => leg(g, coat, paw, x as number, 0.92, z as number, { knee: 0.42, r: [0.12, 0.075, 0.065], footH: 0.07, footR: 0.075, front: f as boolean, paw: true, vScale: 0.9 }))
  const tail = tailOf(g, coat, mane, 0, 0.95, -0.88, 0.8, 0.025, 0.07)
  return { g, legs, neck: head, tail, speed: 1.1, stride: 1.4 }
}

/** A flamingo standing on one leg, S-necked, with a bent black-tipped beak. */
export function flamingo(): THREE.Group {
  const g = new THREE.Group()
  const pink = mat({ map: feathers(), vertexColors: true, roughness: 0.7 }), legM = mat({ color: 0xe9798f, roughness: 0.6 })
  g.add(loft([[0, 0.98, -0.34, 0.03, 0.02], [0, 1.0, -0.2, 0.15, 0.1], [0, 1.02, 0.02, 0.19, 0.16], [0, 1.06, 0.18, 0.13, 0.13], [0, 1.12, 0.24, 0.07, 0.07]], pink, { vScale: 0.4, shade: 0.2, dark: (t) => (t < 0.18 ? 0.8 : 0) }))
  // The S-shaped neck up to a small head, and the downturned beak.
  g.add(loft([[0, 1.1, 0.22, 0.045, 0.045], [0, 1.32, 0.3, 0.035, 0.035], [0, 1.52, 0.2, 0.033, 0.033], [0, 1.68, 0.22, 0.034, 0.034], [0, 1.76, 0.3, 0.045, 0.045]], pink, { seg: 10, steps: 24, vScale: 0.4 }))
  g.add(ball(pink, 0.055, 0, 1.78, 0.33, 0.9, 0.9, 1.1))
  g.add(loft([[0, 1.78, 0.37, 0.028, 0.03], [0, 1.77, 0.45, 0.022, 0.024], [0, 1.72, 0.49, 0.016, 0.016], [0, 1.68, 0.48, 0.008, 0.008]], mat({ color: 0xf0e6dc, vertexColors: true, roughness: 0.4 }), { seg: 8, steps: 12, dark: (t) => (t > 0.45 ? 0.95 : 0) }))
  eyes(g, 0.03, 1.8, 0.35, 0.008)
  // One long leg down (backward-bending ankle), the other folded up under the body.
  g.add(loft([[0.03, 0.98, 0, 0.022, 0.022], [0.03, 0.5, -0.02, 0.016, 0.016], [0.03, 0.47, -0.02, 0.022, 0.022], [0.03, 0.05, 0.0, 0.015, 0.015]], legM, { seg: 6, steps: 12 }))
  g.add(ball(legM, 0.05, 0.03, 0.02, 0.04, 1, 0.25, 1.4))
  g.add(loft([[-0.04, 0.98, 0, 0.02, 0.02], [-0.05, 0.72, -0.08, 0.016, 0.016], [-0.05, 0.84, -0.2, 0.014, 0.014]], legM, { seg: 6, steps: 10 }))
  return g
}

/** The walk: diagonal legs swing together and the knees fold on the forward swing. Call each frame. */
export function stepLegs(legs: THREE.Object3D[], phase: number, moving: boolean): void {
  legs.forEach((l, i) => {
    const s = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI))
    l.rotation.x = moving ? s * 0.34 : l.rotation.x * 0.9
    const knee = l.userData.knee as THREE.Object3D | undefined
    if (knee) { const lift = moving ? Math.max(0, Math.cos(phase + (i === 0 || i === 3 ? 0 : Math.PI))) * 0.55 : 0; knee.rotation.x += ((l.userData.front ? lift : lift * 0.8) - knee.rotation.x) * 0.3 }
  })
}
