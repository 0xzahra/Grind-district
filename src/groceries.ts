// Shop goods that look like goods: cereal boxes, tins, bottles, milk cartons, rice sacks, jam jars, coffee bags
// and pastries, each with a painted label (original brands, drawn on a small canvas once and shared). Shelves and
// trolleys place them as instanced meshes, one draw per kind of product however many sit on the shelves.
import * as THREE from 'three'

export type Product = 'cereal' | 'tin' | 'bottle' | 'milk' | 'rice' | 'jar' | 'coffee' | 'beans' | 'croissant' | 'muffin' | 'puff' | 'loaf'

const FONT = '"Inter Variable", Inter, system-ui, sans-serif'
const labelTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
const word = (g: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, col: string, weight = 900) => {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y)
}

/** The label art for each product (front of a box, or the wrap round a tin, bottle or jar). */
const ART: Record<Product, () => THREE.CanvasTexture> = {
  cereal: () => labelTex(128, 192, (g) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, 128, 192); g.fillStyle = '#d63c3c'; g.fillRect(0, 0, 128, 46)
    word(g, 'GRAIN', 64, 18, 22, '#fff'); word(g, "O'S", 64, 38, 16, '#fff')
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(64, 128, 42, 22, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#e39a3a'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(40 + (i % 5) * 12, 118 + Math.floor(i / 5) * 12, 6, 0, Math.PI * 2); g.fill() }
    g.fillStyle = '#2f6fb3'; g.fillRect(0, 170, 128, 22); word(g, 'WHOLE GRAIN', 64, 181, 11, '#fff', 700)
  }),
  tin: () => labelTex(256, 96, (g) => {
    g.fillStyle = '#c73a2a'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#f6efe0'; g.fillRect(0, 26, 256, 44)
    for (const x of [64, 192]) { word(g, 'TOMATO', x, 42, 17, '#c73a2a'); word(g, 'PASTE', x, 60, 12, '#6b1a12', 700); g.fillStyle = '#2f8a3a'; g.fillRect(x - 6, 6, 12, 10) }
  }),
  bottle: () => labelTex(256, 128, (g) => {
    g.fillStyle = '#e8a21a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ffffff'; g.fillRect(0, 44, 256, 48)
    for (const x of [64, 192]) { word(g, 'SUNNY', x, 60, 16, '#e06a12'); word(g, 'OIL 1L', x, 80, 12, '#7a4a0a', 700) }
  }),
  milk: () => labelTex(128, 192, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 192); g.fillStyle = '#2f6fb3'; g.fillRect(0, 120, 128, 72)
    g.fillStyle = '#7ec8f0'; g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(64, 96, 128, 120); g.fill()
    word(g, 'FRESH', 64, 40, 22, '#2f6fb3'); word(g, 'MILK', 64, 66, 24, '#2f6fb3'); word(g, '1 LITRE', 64, 160, 13, '#fff', 700)
  }),
  rice: () => labelTex(160, 224, (g) => {
    g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 160, 224); g.fillStyle = '#14a058'; g.fillRect(0, 0, 160, 54)
    word(g, 'GOLDEN', 80, 22, 20, '#fff'); word(g, 'GRAIN', 80, 44, 14, '#d8f5e2', 700)
    g.fillStyle = '#e9d9a8'; for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(30 + (i * 37) % 100, 90 + ((i * 53) % 70), 5, 2.2, (i % 5) * 0.6, 0, Math.PI * 2); g.fill() }
    word(g, 'RICE', 80, 186, 30, '#14a058'); word(g, '5 KG', 80, 210, 14, '#5a4a2a', 700)
  }),
  jar: () => labelTex(256, 96, (g) => {
    g.fillStyle = '#7a1f2a'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#f6efe0'; g.fillRect(0, 24, 256, 48)
    for (const x of [64, 192]) { word(g, 'BERRY', x, 42, 15, '#7a1f2a'); word(g, 'JAM', x, 60, 12, '#3a0f14', 700) }
  }),
  coffee: () => labelTex(128, 192, (g) => {
    g.fillStyle = '#b8935f'; g.fillRect(0, 0, 128, 192); g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 192; y += 6) g.fillRect(0, y, 128, 2)
    g.fillStyle = '#f4efe2'; g.fillRect(14, 58, 100, 82)
    word(g, 'GRIND', 64, 82, 18, '#0b5c37'); word(g, 'ROAST', 64, 104, 14, '#3a2414', 800); word(g, 'single origin', 64, 126, 10, '#6b5a44', 600)
    g.fillStyle = '#3a2414'; g.fillRect(0, 0, 128, 14)
  }),
  beans: () => labelTex(256, 96, (g) => {
    g.fillStyle = '#4a2c18'; g.fillRect(0, 0, 256, 96)
    g.fillStyle = '#6b4024'; for (let i = 0; i < 60; i++) { g.beginPath(); g.ellipse((i * 41) % 256, (i * 29) % 96, 6, 4, i, 0, Math.PI * 2); g.fill() }
    g.fillStyle = '#f4efe2'; g.fillRect(0, 34, 256, 30); for (const x of [64, 192]) word(g, 'BEANS', x, 50, 14, '#3a2414')
  }),
  croissant: () => labelTex(64, 64, (g) => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#e9a64a'); gr.addColorStop(1, '#a8601e'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(90,40,10,0.45)'; g.lineWidth = 3; for (let x = 6; x < 64; x += 11) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, 64); g.stroke() } }),
  muffin: () => labelTex(64, 64, (g) => { g.fillStyle = '#7a4424'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#3a1a0a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc((i * 23) % 64, (i * 17) % 64, 3, 0, Math.PI * 2); g.fill() } }),
  puff: () => labelTex(64, 64, (g) => { g.fillStyle = '#d9a35a'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,240,200,0.5)'; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc((i * 29) % 64, (i * 13) % 64, 2, 0, Math.PI * 2); g.fill() } }),
  loaf: () => labelTex(64, 64, (g) => { g.fillStyle = '#c98a44'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,230,180,0.7)'; g.lineWidth = 4; for (let x = 10; x < 64; x += 16) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x + 8, 46); g.stroke() } }),
}

/** Shapes, in metres, standing on y = 0 and centred on x and z. */
const SHAPE: Record<Product, () => THREE.BufferGeometry> = {
  cereal: () => new THREE.BoxGeometry(0.2, 0.3, 0.07).translate(0, 0.15, 0),
  tin: () => new THREE.CylinderGeometry(0.042, 0.042, 0.11, 14).translate(0, 0.055, 0),
  bottle: () => {
    const p = [[0, 0], [0.04, 0], [0.042, 0.02], [0.042, 0.17], [0.03, 0.2], [0.016, 0.23], [0.016, 0.26], [0, 0.26]].map(([r, y]) => new THREE.Vector2(r!, y!))
    return new THREE.LatheGeometry(p, 14)
  },
  milk: () => {
    const g = new THREE.BoxGeometry(0.075, 0.19, 0.075).translate(0, 0.095, 0)
    const top = new THREE.CylinderGeometry(0, 0.054, 0.05, 4, 1).rotateY(Math.PI / 4).translate(0, 0.215, 0)
    return mergeTwo(g, top)
  },
  rice: () => new THREE.BoxGeometry(0.24, 0.34, 0.11).translate(0, 0.17, 0),
  jar: () => {
    const p = [[0, 0], [0.045, 0], [0.048, 0.015], [0.048, 0.085], [0.038, 0.1], [0.04, 0.1], [0.04, 0.125], [0, 0.125]].map(([r, y]) => new THREE.Vector2(r!, y!))
    return new THREE.LatheGeometry(p, 14)
  },
  coffee: () => {
    // a stand-up pouch: wider at the base, folded flat at the top
    const g = new THREE.BoxGeometry(0.14, 0.22, 0.08, 1, 4, 1)
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const k = (y + 0.11) / 0.22; pos.setZ(i, pos.getZ(i) * (1.2 - k * 0.85)) }
    g.computeVertexNormals()
    return g.translate(0, 0.11, 0)
  },
  beans: () => new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16).translate(0, 0.09, 0),
  croissant: () => {
    const g = new THREE.TorusGeometry(0.06, 0.03, 8, 14, Math.PI * 1.15)
    g.rotateZ(-Math.PI * 0.075).rotateX(-Math.PI / 2).scale(1, 0.75, 1)
    return g.translate(0, 0.022, -0.02)
  },
  muffin: () => {
    const cup = new THREE.CylinderGeometry(0.045, 0.035, 0.05, 14).translate(0, 0.025, 0)
    const dome = new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.05, 0)
    return mergeTwo(cup, dome)
  },
  puff: () => new THREE.SphereGeometry(0.035, 10, 8).scale(1, 0.85, 1).translate(0, 0.028, 0),
  loaf: () => new THREE.CapsuleGeometry(0.06, 0.16, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.85, 1).translate(0, 0.052, 0),
}
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const na = a.toNonIndexed(), nb = b.toNonIndexed()
  const out = new THREE.BufferGeometry()
  for (const k of ['position', 'normal', 'uv'] as const) {
    const A = na.attributes[k] as THREE.BufferAttribute, B = nb.attributes[k] as THREE.BufferAttribute
    const arr = new Float32Array(A.array.length + B.array.length); arr.set(A.array as Float32Array, 0); arr.set(B.array as Float32Array, A.array.length)
    out.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize))
  }
  a.dispose(); b.dispose(); na.dispose(); nb.dispose()
  return out
}

const cache = new Map<Product, { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }>()
const kit = (p: Product) => {
  let k = cache.get(p)
  if (!k) {
    const glassy = p === 'bottle' || p === 'jar'
    k = { geo: SHAPE[p](), mat: new THREE.MeshStandardMaterial({ map: ART[p](), roughness: glassy ? 0.3 : p === 'tin' ? 0.35 : 0.7, metalness: p === 'tin' ? 0.35 : 0 }) }
    cache.set(p, k)
  }
  return k
}

export type Placed = { p: Product; x: number; y: number; z: number; yaw?: number; tint?: number; s?: number }
/** One instanced mesh per kind of product in `items` (soft tints vary the labels so a shelf is not a single block). */
export function placeGoods(items: Placed[], parent: THREE.Object3D): THREE.InstancedMesh[] {
  const by = new Map<Product, Placed[]>()
  for (const it of items) { const l = by.get(it.p) ?? []; l.push(it); by.set(it.p, l) }
  const out: THREE.InstancedMesh[] = []
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), col = new THREE.Color()
  for (const [p, list] of by) {
    const k = kit(p)
    const im = new THREE.InstancedMesh(k.geo, k.mat, list.length)
    list.forEach((it, i) => {
      q.setFromAxisAngle(Y, it.yaw ?? 0); const sc = it.s ?? 1
      im.setMatrixAt(i, m.compose(v.set(it.x, it.y, it.z), q, s.set(sc, sc, sc)))
      im.setColorAt(i, col.setHex(it.tint ?? 0xffffff))
    })
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = true
    im.userData.ghost = true
    parent.add(im); out.push(im)
  }
  return out
}

/** Gentle label tints: the same product in a few flavours. */
export const TINTS = [0xffffff, 0xffe2e2, 0xe2ecff, 0xe6ffe6, 0xfff3d6, 0xf0e2ff]

/** A gondola shelf unit (both faces) with four shelves, stocked; returns the goods it placed. `along` is the
 *  shelf's length axis. Shelf boards, uprights and the back panel go into `frame` boxes for the caller to merge. */
export function stockGondola(o: { x: number; z: number; len: number; along: 'x' | 'z'; seed: number }, frame: Array<[number, number, number, number, number, number]>): Placed[] {
  const out: Placed[] = []
  const L = o.len, depth = 0.9, H = 1.9
  const ax = o.along === 'x'
  const at = (u: number, side: number, y: number): [number, number, number] => (ax ? [o.x + u, y, o.z + side] : [o.x + side, y, o.z + u])
  const box = (u: number, side: number, y: number, lu: number, h: number, d: number) => { const [x, yy, z] = at(u, side, y); frame.push(ax ? [x, yy, z, lu, h, d] : [x, yy, z, d, h, lu]) }
  box(0, 0, H / 2, L, H, 0.05) // back panel
  box(0, 0, 0.06, L, 0.12, depth) // kick plate
  for (const e of [-L / 2, L / 2]) box(e, 0, H / 2, 0.05, H, depth)
  const kinds: Product[] = ['cereal', 'tin', 'bottle', 'milk', 'rice', 'jar']
  const levels = [0.14, 0.58, 1.02, 1.46]
  for (const side of [-1, 1]) levels.forEach((y, li) => {
    box(0, side * depth * 0.25, y - 0.02, L, 0.03, depth / 2)
    // each shelf run holds one product, faced to the aisle, the way shops stock them
    const p = kinds[(o.seed * 3 + li * 2 + (side > 0 ? 1 : 0)) % kinds.length]!
    const w = p === 'rice' ? 0.27 : p === 'cereal' ? 0.23 : p === 'tin' || p === 'jar' ? 0.1 : 0.09
    const n = Math.floor((L - 0.1) / w)
    const rows = p === 'rice' || p === 'cereal' ? 1 : 2
    for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
      if ((i * 7 + li * 3 + r + o.seed) % 13 === 0) continue // a gap here and there, as on a real shelf
      const u = -L / 2 + 0.05 + w / 2 + i * w
      const d = side * (depth * 0.42 - r * 0.12)
      const [x, yy, z] = at(u, d, y)
      out.push({ p, x, y: yy, z, yaw: ax ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2, tint: TINTS[(i + li + o.seed) % TINTS.length] })
    }
  })
  return out
}

/** A shopping trolley (wire basket, handle, four castors) with a few things in it. Frame boxes go to `frame`. */
export function trolley(x: number, z: number, yaw: number, seed: number, frame: Array<[number, number, number, number, number, number]>, wheels: Array<[number, number, number]>): Placed[] {
  const c = Math.cos(yaw), s = Math.sin(yaw)
  const P = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c]
  const fb = (lx: number, y: number, lz: number, w: number, h: number, d: number) => {
    const [wx, wz] = P(lx, lz)
    // boxes are axis-aligned in the caller's merge, so a trolley turned 90° swaps its width and depth
    const turned = Math.abs(Math.sin(yaw)) > 0.7
    frame.push([wx, y, wz, turned ? d : w, h, turned ? w : d])
  }
  fb(0, 0.42, 0, 0.5, 0.02, 0.8) // basket floor
  for (const sx of [-0.25, 0.25]) fb(sx, 0.62, 0, 0.015, 0.4, 0.8) // sides
  for (const sz of [-0.4, 0.4]) fb(0, 0.62, sz, 0.5, 0.4, 0.015)
  for (const y of [0.56, 0.7]) { for (const sx of [-0.25, 0.25]) fb(sx, y, 0, 0.02, 0.012, 0.8); for (const sz of [-0.4, 0.4]) fb(0, y, sz, 0.5, 0.012, 0.02) }
  fb(0, 0.86, 0.5, 0.52, 0.035, 0.035) // handle
  for (const sx of [-0.24, 0.24]) fb(sx, 0.62, 0.46, 0.02, 0.5, 0.02)
  for (const sx of [-0.2, 0.2]) fb(sx, 0.21, 0, 0.025, 0.42, 0.025)
  fb(0, 0.08, 0, 0.42, 0.02, 0.7) // chassis
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.32, 0.32]) { const [wx, wz] = P(sx, sz); wheels.push([wx, 0.05, wz]) }
  const kinds: Product[] = ['cereal', 'milk', 'bottle', 'rice', 'tin', 'jar', 'loaf']
  const out: Placed[] = []
  for (let i = 0; i < 5 + (seed % 3); i++) {
    const p = kinds[(seed + i * 3) % kinds.length]!
    const lx = -0.14 + (i % 3) * 0.14, lz = -0.25 + Math.floor(i / 3) * 0.22 + ((seed * 7 + i) % 3) * 0.04
    const [wx, wz] = P(lx, lz)
    out.push({ p, x: wx, y: 0.43 + (p === 'tin' || p === 'jar' ? Math.floor(i / 6) * 0.11 : 0), z: wz, yaw: yaw + (i % 2 ? 0.4 : -0.3), tint: TINTS[(seed + i) % TINTS.length] })
  }
  return out
}
