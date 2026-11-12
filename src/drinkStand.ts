// Plaza drinks stand: a real kiosk, not a prop. Timber counter with a stone top and brass foot rail, a back
// bar with shelves, bottles, jars and an espresso machine, a striped canvas awning with a scalloped valance,
// warm bulb pendants, three stools and a small fascia sign. The drink on the counter is a still prop.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createDrinkStand(scene: THREE.Scene, anisotropy: number): { setNight: (n: number) => void } {
  const std = (color: number, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d'); if (g) draw(g)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = anisotropy
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  }
  // Vertical timber battens with grain.
  const battens = canvasTex(256, 256, (g) => {
    for (let x = 0; x < 256; x += 32) {
      const k = 0.85 + ((x * 37) % 23) / 100
      g.fillStyle = `rgb(${122 * k | 0},${82 * k | 0},${52 * k | 0})`; g.fillRect(x, 0, 32, 256)
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 30, 0, 2, 256)
      g.fillStyle = 'rgba(255,230,200,0.06)'; for (let y = 0; y < 256; y += 9) g.fillRect(x + 4 + ((y * 7) % 20), y, 1, 6)
    }
  }, true)
  const stripes = canvasTex(512, 64, (g) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1f5a4c' : '#efe6d6'; g.fillRect(i * 64, 0, 64, 64) }
    g.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 0; y < 64; y += 3) g.fillRect(0, y, 512, 1)
  })
  const valance = canvasTex(512, 64, (g) => {
    g.clearRect(0, 0, 512, 64)
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#1f5a4c' : '#efe6d6'
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 64, 0); g.lineTo(i * 64 + 64, 30); g.arc(i * 64 + 32, 30, 32, 0, Math.PI); g.closePath(); g.fill()
    }
  })
  const signTex = canvasTex(1024, 192, (g) => {
    g.fillStyle = '#1b1814'; g.fillRect(0, 0, 1024, 192)
    g.strokeStyle = '#b8955a'; g.lineWidth = 6; g.strokeRect(10, 10, 1004, 172)
    g.fillStyle = '#f3e3c3'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = '600 92px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
    const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string }; ctx.letterSpacing = '10px'
    g.fillText('GRIND RING', 512, 82)
    ctx.letterSpacing = '6px'; g.font = '500 40px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillStyle = '#c9b48a'
    g.fillText('COFFEE · JUICE · TEA', 512, 150)
  })
  const menuTex = canvasTex(256, 320, (g) => {
    g.fillStyle = '#20251f'; g.fillRect(0, 0, 256, 320)
    g.strokeStyle = '#b8955a'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 308)
    g.fillStyle = '#f2ece0'; g.font = '600 30px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textAlign = 'left'
    const rows = [['Flat white', '2'], ['Cold brew', '3'], ['Mint tea', '2'], ['Zobo', '2'], ['Orange', '3']]
    rows.forEach(([n, p], i) => { g.fillText(n!, 22, 62 + i * 52); g.textAlign = 'right'; g.fillText(p!, 234, 62 + i * 52); g.textAlign = 'left' })
  })

  const M = {
    wood: new THREE.MeshStandardMaterial({ map: battens, roughness: 0.72 }),
    woodDark: std(0x4a3222, 0.6),
    top: std(0xe9e3d8, 0.3, 0, { envMapIntensity: 0.9 }),
    brass: std(0xb8955a, 0.32, 0.85),
    steel: std(0xc9ccd0, 0.25, 0.85),
    black: std(0x1a1b1d, 0.4, 0.3),
    deck: std(0xbfb5a5, 0.85),
    canvas: new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.85, side: THREE.DoubleSide }),
    valance: new THREE.MeshStandardMaterial({ map: valance, roughness: 0.85, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    sign: new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25, roughness: 0.5 }),
    menu: new THREE.MeshStandardMaterial({ map: menuTex, emissive: 0xffffff, emissiveMap: menuTex, emissiveIntensity: 0.2, roughness: 0.7 }),
    bulb: std(0xfff2d6, 0.3, 0, { emissive: 0xffd28a, emissiveIntensity: 0.6 }),
    cup: std(0xf5f0e6, 0.55),
    lid: std(0x2b2d31, 0.4),
    straw: std(0x1f5a4c, 0.5),
    green: std(0x1d4a3a, 0.15, 0.2, { transparent: true, opacity: 0.88 }),
    amber: std(0x9a5a1e, 0.15, 0.2, { transparent: true, opacity: 0.88 }),
    clear: std(0xd8e2e4, 0.08, 0.1, { transparent: true, opacity: 0.45 }),
    lemon: std(0xe8c63a, 0.6),
    leaf: std(0x3f6b3a, 0.8),
    cushion: std(0x1f5a4c, 0.8),
  }
  const root = new THREE.Group()
  root.name = 'grind-ring-drinks'
  const bags = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const put = (m: THREE.Material, g: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
    g.translate(x, y, z)
    const list = bags.get(m) ?? []; list.push(g.index ? g.toNonIndexed() : g); bags.set(m, list)
  }
  const box = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => put(m, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z)
  const cyl = (m: THREE.Material, r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 12) => put(m, new THREE.CylinderGeometry(r0, r1, h, seg), x, y + h / 2, z)

  // Deck: a low stone plinth with a brass edge.
  cyl(M.deck, 2.6, 2.7, 0.2, 0, 0, 0, 40)
  put(M.brass, new THREE.TorusGeometry(2.6, 0.025, 6, 64).rotateX(Math.PI / 2), 0, 0.2, 0)
  const y0 = 0.2
  // Counter: front run and two returns, timber battens, stone top with overhang, kick recess, brass foot rail.
  const H = 1.05
  box(M.wood, 3.0, H - 0.08, 0.5, 0, y0 + 0.08, 0.95)
  for (const sx of [-1, 1]) box(M.wood, 0.5, H - 0.08, 1.4, sx * 1.25, y0 + 0.08, 0.05)
  box(M.woodDark, 2.9, 0.08, 0.42, 0, y0, 0.93)
  box(M.top, 3.2, 0.06, 0.66, 0, y0 + H, 0.98)
  for (const sx of [-1, 1]) box(M.top, 0.66, 0.06, 1.5, sx * 1.27, y0 + H, 0.05)
  put(M.brass, new THREE.CylinderGeometry(0.025, 0.025, 3.0, 8).rotateZ(Math.PI / 2), 0, y0 + 0.24, 1.33)
  for (const x of [-1.3, 0, 1.3]) box(M.brass, 0.03, 0.2, 0.03, x, y0 + 0.06, 1.3)
  // Back bar: tall cabinet with open shelves, bottles, jars and the espresso machine.
  box(M.woodDark, 3.2, 2.3, 0.42, 0, y0, -1.15)
  box(M.wood, 3.2, 0.9, 0.5, 0, y0, -0.85)
  box(M.top, 3.3, 0.05, 0.56, 0, y0 + 0.9, -0.85)
  for (const y of [1.45, 1.85]) box(M.brass, 3.0, 0.03, 0.3, 0, y0 + y, -0.88)
  const bottles: Array<[THREE.Material, number, number]> = []
  for (let i = 0; i < 9; i++) bottles.push([[M.green, M.amber, M.clear][i % 3]!, -1.3 + i * 0.32, 1.48])
  for (let i = 0; i < 7; i++) bottles.push([[M.amber, M.clear, M.green][i % 3]!, -1.1 + i * 0.36, 1.88])
  for (const [m, x, y] of bottles) {
    put(m, mergeGeometries([new THREE.CylinderGeometry(0.045, 0.05, 0.22, 10).translate(0, 0.11, 0), new THREE.CylinderGeometry(0.016, 0.03, 0.08, 8).translate(0, 0.26, 0)])!, x, y0 + y, -0.9)
  }
  // Espresso machine: steel body, brass group heads, a cup on top.
  box(M.steel, 0.75, 0.42, 0.42, -0.85, y0 + 0.95, -0.85)
  for (const x of [-1.0, -0.7]) cyl(M.brass, 0.045, 0.045, 0.08, x, y0 + 1.05, -0.62, 10)
  box(M.black, 0.75, 0.04, 0.3, -0.85, y0 + 1.37, -0.85)
  // Lemon jar and a small potted herb on the back counter.
  cyl(M.clear, 0.13, 0.13, 0.28, 0.45, y0 + 0.95, -0.82, 16)
  for (let i = 0; i < 6; i++) put(M.lemon, new THREE.SphereGeometry(0.05, 8, 6).scale(1, 0.85, 1), 0.45 + Math.cos(i * 1.7) * 0.06, y0 + 1.02 + (i % 3) * 0.06, -0.82 + Math.sin(i * 1.7) * 0.06)
  cyl(M.woodDark, 0.09, 0.07, 0.16, 1.15, y0 + 0.95, -0.85, 10)
  put(M.leaf, new THREE.IcosahedronGeometry(0.14, 1), 1.15, y0 + 1.23, -0.85)
  // Menu board on the back cabinet.
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), M.menu)
  menu.position.set(1.0, y0 + 1.75, -0.935)
  root.add(menu)
  // Takeaway cups stacked by the till; the house drink stands still on the counter (no spin, no halo).
  for (let i = 0; i < 3; i++) cyl(M.cup, 0.05, 0.04, 0.12, -1.0 + i * 0.002, y0 + H + 0.06 + i * 0.09, 0.98, 12)
  {
    const cx = 0.55, cz = 1.02, cy = y0 + H + 0.06
    cyl(M.cup, 0.062, 0.048, 0.17, cx, cy, cz, 16)
    cyl(M.straw, 0.0632, 0.0632, 0.05, cx, cy + 0.07, cz, 16) // sleeve
    cyl(M.lid, 0.066, 0.066, 0.02, cx, cy + 0.17, cz, 16)
    put(M.straw, new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6).rotateZ(0.18), cx + 0.012, cy + 0.24, cz)
    cyl(M.clear, 0.045, 0.04, 0.11, cx + 0.22, cy, cz - 0.05, 12)
    cyl(M.lemon, 0.035, 0.035, 0.008, cx + 0.22, cy + 0.11, cz - 0.05, 10)
  }
  // Brass till and a card reader.
  box(M.brass, 0.3, 0.16, 0.24, -0.45, y0 + H + 0.06, 0.92)
  box(M.black, 0.08, 0.03, 0.13, -0.15, y0 + H + 0.06, 1.05)
  // Awning: slim steel frame, striped canvas sloping toward the customers, scalloped valance.
  for (const sx of [-1, 1]) {
    box(M.black, 0.06, 2.55, 0.06, sx * 1.55, y0, 1.25)
    box(M.black, 0.06, 2.8, 0.06, sx * 1.55, y0, -1.3)
    box(M.black, 0.05, 0.05, 2.6, sx * 1.55, y0 + 2.62, -0.02)
  }
  const canopy = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.9), M.canvas)
  canopy.rotation.x = -Math.PI / 2 + 0.18
  canopy.position.set(0, y0 + 2.75, -0.02)
  canopy.castShadow = true
  const front = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.28), M.valance)
  front.position.set(0, y0 + 2.36, 1.42)
  root.add(canopy, front)
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.28), M.valance)
    side.rotation.y = Math.PI / 2; side.position.set(sx * 1.7, y0 + 2.5, -0.02)
    root.add(side)
  }
  // Fascia sign on the top of the back frame.
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.375, 0.05), [M.black, M.black, M.black, M.black, M.sign, M.black])
  sign.position.set(0, y0 + 3.15, -1.28)
  root.add(sign)
  // Warm bulb pendants under the canvas.
  for (const x of [-0.9, 0, 0.9]) {
    put(M.black, new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4), x, y0 + 2.2, 0.75)
    put(M.bulb, new THREE.SphereGeometry(0.06, 12, 10).scale(1, 1.25, 1), x, y0 + 2.12, 0.75)
  }
  // Three stools on the customer side.
  for (const x of [-0.9, 0, 0.9]) {
    cyl(M.black, 0.02, 0.02, 0.72, x, y0, 1.75, 6)
    cyl(M.brass, 0.17, 0.17, 0.02, x, y0 + 0.28, 1.75, 16)
    cyl(M.black, 0.16, 0.2, 0.03, x, y0, 1.75, 16)
    cyl(M.cushion, 0.19, 0.18, 0.07, x, y0 + 0.72, 1.75, 16)
  }

  for (const [m, list] of bags) {
    const merged = mergeGeometries(list.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g }), false)
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, m)
    mesh.castShadow = m !== M.bulb
    mesh.receiveShadow = true
    root.add(mesh)
  }
  scene.add(root)
  return {
    setNight(n: number) {
      M.bulb.emissiveIntensity = 0.5 + n * 2.2
      M.sign.emissiveIntensity = 0.22 + n * 0.8
      M.menu.emissiveIntensity = 0.18 + n * 0.6
    },
  }
}
