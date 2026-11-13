// Display models for the Gadgets pavilion and the auto dealership: recognisable low-poly phones, laptops,
// watches, earbuds, drones, cars, jets and an air taxi, shown on stone pedestals in glass vitrines with
// LED-lit edges and name plaques. The same models feed the shop pictures (tools/shop-renders.mjs).
import * as THREE from 'three'
import { carGeometry, type CarKind } from './cars.ts'
import type { Obstacle } from './physics.ts'
import { PIECES } from './wardrobe.ts'

const std = (color: number, roughness = 0.5, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
const M = {
  alu: std(0xc9ccd0, 0.28, 0.85),
  titanium: std(0x8d8a85, 0.32, 0.85),
  graphite: std(0x2a2d31, 0.35, 0.6),
  black: std(0x0d0e10, 0.25, 0.3),
  white: std(0xf2f2ee, 0.35, 0.05),
  glass: std(0x101418, 0.05, 0.6),
  rubber: std(0x111214, 0.85),
  mint: std(0x1d2a26, 0.4, 0, { emissive: 0x6dffc8, emissiveIntensity: 1.2 }),
  strap: std(0x9a3b35, 0.7),
  jet: std(0xf1f1ee, 0.3, 0.3),
  navy: std(0x1d2b4a, 0.35, 0.4),
  window: std(0x1a2733, 0.1, 0.6),
}
const screenTex = (() => {
  const make = (draw: (g: CanvasRenderingContext2D) => void, w = 128, h = 256) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d'); if (g) draw(g)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const phone = make((g) => {
    const gr = g.createLinearGradient(0, 0, 128, 256); gr.addColorStop(0, '#16344a'); gr.addColorStop(1, '#0c1a26'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256)
    g.fillStyle = '#6dffc8'; g.globalAlpha = 0.9
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) { g.beginPath(); g.roundRect(14 + i * 26, 40 + j * 30, 18, 18, 5); g.fill(); g.globalAlpha = 0.35 + ((i + j) % 3) * 0.2 }
    g.globalAlpha = 1; g.fillStyle = '#f2f2ee'; g.font = '600 22px sans-serif'; g.fillText('9:41', 40, 26)
  })
  const laptop = make((g) => {
    g.fillStyle = '#0f1a22'; g.fillRect(0, 0, 256, 160)
    g.strokeStyle = '#6dffc8'; g.lineWidth = 3; g.beginPath()
    for (let x = 0; x <= 200; x += 8) g.lineTo(28 + x, 110 - Math.sin(x / 24) * 22 - x * 0.18)
    g.stroke(); g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 4; i++) g.fillRect(20, 18 + i * 10, 80 - i * 12, 4)
  }, 256, 160)
  const watch = make((g) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 128, 128)
    g.strokeStyle = '#6dffc8'; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 40, -Math.PI / 2, Math.PI * 0.9); g.stroke()
    g.fillStyle = '#f2f2ee'; g.font = '600 26px sans-serif'; g.textAlign = 'center'; g.fillText('10:09', 64, 74)
  }, 128, 128)
  return { phone, laptop, watch }
})()
const lit = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.9, roughness: 0.2 })

function rounded(w: number, h: number, r: number, depth: number, bevel = 0.004): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 })
  g.translate(0, 0, -depth / 2)
  return g
}
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o }

/** Models in metres at real size (cars and jets at display scale). Origin at the base centre. */
export function itemModel(id: string): THREE.Group {
  const g = new THREE.Group()
  switch (id) {
    case 'phone':
    case 'phonepro': {
      const pro = id === 'phonepro'
      const body = mesh(rounded(0.075, 0.155, 0.012, 0.007), pro ? M.titanium : M.graphite, 0, 0.0775, 0)
      // Screen sits just proud of the front glass; camera island and lenses just proud of the back.
      const screen = mesh(new THREE.PlaneGeometry(0.067, 0.147), lit(screenTex.phone), 0, 0.0775, 0.0079)
      g.add(body, screen)
      const island = mesh(rounded(0.03, 0.03, 0.008, 0.002), pro ? M.graphite : M.black, 0.018, 0.13, -0.0085)
      g.add(island)
      for (const [x, y] of pro ? [[0.025, 0.137], [0.011, 0.137], [0.025, 0.123]] : [[0.025, 0.137], [0.025, 0.123]]) g.add(mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 12).rotateX(Math.PI / 2), M.glass, x!, y!, -0.0112))
      g.rotation.x = -0.18
      break
    }
    case 'laptop': {
      g.add(mesh(rounded(0.31, 0.215, 0.012, 0.012).rotateX(-Math.PI / 2), M.alu, 0, 0.006, 0))
      g.add(mesh(new THREE.BoxGeometry(0.27, 0.002, 0.1), M.black, 0, 0.013, -0.03))
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.002, 0.06), M.graphite, 0, 0.013, 0.06))
      const lid = new THREE.Group(); lid.position.set(0, 0.012, -0.105); lid.rotation.x = -0.32
      lid.add(mesh(rounded(0.31, 0.205, 0.012, 0.006), M.alu, 0, 0.1025, -0.004), mesh(new THREE.PlaneGeometry(0.28, 0.175), lit(screenTex.laptop), 0, 0.105, 0.0005))
      g.add(lid)
      break
    }
    case 'desktop': {
      g.add(mesh(rounded(0.55, 0.32, 0.01, 0.02), M.black, 0, 0.36, 0), mesh(new THREE.PlaneGeometry(0.53, 0.3), lit(screenTex.laptop), 0, 0.36, 0.011))
      g.add(mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), M.alu, 0, 0.12, -0.03), mesh(new THREE.BoxGeometry(0.22, 0.012, 0.16), M.alu, 0, 0.006, -0.03))
      const tower = mesh(new THREE.BoxGeometry(0.2, 0.42, 0.42), M.graphite, 0.42, 0.21, -0.05)
      g.add(tower, mesh(new THREE.BoxGeometry(0.005, 0.36, 0.01), M.mint, 0.523, 0.21, 0.16))
      break
    }
    case 'watch': {
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.05, 20), M.white, 0, 0.025, 0))
      const face = new THREE.Group(); face.position.set(0, 0.07, 0); face.rotation.x = -0.35
      face.add(mesh(rounded(0.042, 0.05, 0.011, 0.012), M.alu), mesh(new THREE.PlaneGeometry(0.035, 0.043), lit(screenTex.watch), 0, 0, 0.0104))
      face.add(mesh(new THREE.BoxGeometry(0.024, 0.06, 0.004), M.strap, 0, 0.05, -0.004), mesh(new THREE.BoxGeometry(0.024, 0.06, 0.004), M.strap, 0, -0.05, -0.004))
      g.add(face)
      break
    }
    case 'earbuds': {
      g.add(mesh(rounded(0.06, 0.045, 0.02, 0.022).rotateX(-Math.PI / 2), M.white, 0, 0.023, 0))
      for (const s of [-1, 1]) {
        g.add(mesh(new THREE.SphereGeometry(0.0095, 12, 10), M.white, s * 0.022, 0.055, 0.005))
        g.add(mesh(new THREE.CylinderGeometry(0.004, 0.0035, 0.03, 8), M.white, s * 0.022, 0.04, 0.005))
      }
      break
    }
    case 'scout':
    case 'courier':
    case 'halo': {
      const hull = id === 'scout' ? std(0xd9b26a, 0.4, 0.5) : id === 'halo' ? M.graphite : M.alu
      g.add(mesh(rounded(0.16, 0.08, 0.03, 0.06).rotateX(-Math.PI / 2), hull, 0, 0.09, 0))
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const arm = mesh(new THREE.BoxGeometry(0.15, 0.012, 0.018), M.graphite, x * 0.09, 0.095, z * 0.06)
        arm.rotation.y = Math.atan2(z * 0.06, x * 0.09) * -1
        g.add(arm, mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), M.black, x * 0.15, 0.1, z * 0.1))
        const prop = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.002, 18), std(0x9fb3a8, 0.4, 0, { transparent: true, opacity: 0.45 }), x * 0.15, 0.118, z * 0.1)
        g.add(prop)
      }
      g.add(mesh(new THREE.SphereGeometry(0.018, 12, 10), M.black, 0, 0.06, 0.03))
      if (id === 'courier') g.add(mesh(new THREE.BoxGeometry(0.09, 0.06, 0.07), std(0xb07a3c, 0.8), 0, 0.03, 0))
      if (id === 'halo') g.add(mesh(new THREE.TorusGeometry(0.2, 0.006, 6, 40).rotateX(Math.PI / 2), M.mint, 0, 0.1, 0))
      for (const x of [-0.05, 0.05]) g.add(mesh(new THREE.BoxGeometry(0.006, 0.05, 0.1), M.graphite, x, 0.04, 0))
      break
    }
    case 'saloon':
    case 'tourer':
    case 'car': {
      const kind: CarKind = id === 'saloon' ? 'sedan' : 'sports'
      const geo = carGeometry(kind)
      const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.6, envMapIntensity: 1.3, color: id === 'saloon' ? 0x3a3e44 : 0x8e1b22 })
      g.add(mesh(geo.body, paint), mesh(geo.glass, std(0x18222a, 0.06, 0.7)), mesh(geo.lamps, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })))
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(sx * geo.wheel.track, geo.wheel.r, sz * geo.wheel.base); w.scale.set(1, geo.wheel.r, geo.wheel.r)
        w.add(mesh(new THREE.CylinderGeometry(1, 1, 0.22, 16).rotateZ(Math.PI / 2), M.rubber), mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.235, 10).rotateZ(Math.PI / 2), M.alu))
        g.add(w)
      }
      break
    }
    case 'lightjet':
    case 'longjet': {
      const long = id === 'longjet'
      const L = long ? 1.0 : 0.75
      const fus = mesh(new THREE.CapsuleGeometry(0.055, L, 6, 14).rotateX(Math.PI / 2), M.jet, 0, 0.16, 0)
      g.add(fus)
      const wing = new THREE.Shape([new THREE.Vector2(0, 0.08), new THREE.Vector2(L * 0.62, -0.08), new THREE.Vector2(L * 0.62, -0.16), new THREE.Vector2(0, -0.12)])
      for (const s of [-1, 1]) {
        const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.012, bevelEnabled: false }).rotateX(Math.PI / 2).rotateY(s > 0 ? 0 : Math.PI).scale(1, 1, s > 0 ? 1 : -1)
        g.add(mesh(wg, M.jet, s * 0.04, 0.15, 0.02))
        g.add(mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.16, 12).rotateX(Math.PI / 2), long ? M.navy : M.graphite, s * 0.1, 0.22, -L * 0.36))
      }
      const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0.22, 0.2), new THREE.Vector2(0.14, 0.2)])
      g.add(mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.01, bevelEnabled: false }).rotateY(Math.PI / 2).translate(0.005, 0.2, -L / 2 - 0.02), long ? M.navy : M.jet))
      g.add(mesh(new THREE.BoxGeometry(0.11, 0.02, 0.12), M.window, 0, 0.2, L / 2 + 0.01))
      for (let k = 0; k < (long ? 7 : 5); k++) for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.004, 0.02, 0.03), M.window, s * 0.055, 0.17, L / 2 - 0.14 - k * 0.09))
      if (long) g.add(mesh(new THREE.BoxGeometry(0.113, 0.012, L * 0.95), M.navy, 0, 0.13, 0))
      for (const z of [-L * 0.1, L * 0.35]) g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), M.graphite, 0, 0.05, z), mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 10).rotateZ(Math.PI / 2), M.rubber, 0, 0.012, z))
      break
    }
    case 'skydrone': {
      g.add(mesh(new THREE.CapsuleGeometry(0.12, 0.22, 6, 16).rotateX(Math.PI / 2).scale(1, 0.85, 1), M.white, 0, 0.2, 0))
      g.add(mesh(new THREE.SphereGeometry(0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1.3), M.window, 0, 0.23, 0.05))
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        g.add(mesh(new THREE.BoxGeometry(0.02, 0.015, 0.22).rotateY(Math.atan2(x, z)), M.graphite, x * 0.13, 0.27, z * 0.13))
        g.add(mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 24).rotateX(Math.PI / 2), M.graphite, x * 0.22, 0.28, z * 0.22))
        g.add(mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.002, 18), std(0x9fb3a8, 0.4, 0, { transparent: true, opacity: 0.4 }), x * 0.22, 0.28, z * 0.22))
      }
      for (const x of [-0.08, 0.08]) g.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.36), M.graphite, x, 0.04, 0))
      break
    }
    default:
      if (id.startsWith('jw:')) jewel(g, id.slice(3))
  }
  return g
}

// Jewellery for the boutique's product pictures: id 'jw:<piece id>' (wardrobe.ts), e.g. jw:watch-gold.
// Metal from the piece colour, stones and pearls where the name says so.
function jewel(g: THREE.Group, id: string): void {
  const piece = PIECES.find((p) => p.id === id)
  const hex = piece?.hex ?? 0xd9b26a
  const pid = `${id} ${piece?.label.toLowerCase() ?? ''}`
  const metal = std(hex, hex === 0x2a2a2e ? 0.28 : 0.18, 0.95, { envMapIntensity: 1.4 })
  const stone = (c: number) => std(c, 0.04, 0.1, { transparent: true, opacity: 0.92, envMapIntensity: 2.2, emissive: c, emissiveIntensity: 0.08 })
  const gemColour = /emerald/.test(pid) ? 0x1f9d63 : 0xeef6ff
  const pearl = std(0xf4efe6, 0.32, 0.05, { envMapIntensity: 1.3 })
  if (/watch|chronograph/.test(pid)) {
    // Case, bezel, dial with hands and markers, crown, and a bracelet loop behind.
    const face = new THREE.Group()
    face.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.011, 40).rotateX(Math.PI / 2), metal, 0, 0, 0))
    face.add(mesh(new THREE.TorusGeometry(0.0205, 0.0022, 10, 40), metal, 0, 0, 0.0056))
    const dialC = /onyx|gold|rose/.test(pid) ? 0x14161a : 0xf2efe8
    face.add(mesh(new THREE.CircleGeometry(0.0185, 40), std(dialC, 0.35, 0.2), 0, 0, 0.0057))
    const hand = std(dialC === 0x14161a ? 0xe9cf96 : 0x1a1c20, 0.3, 0.8)
    face.add(mesh(new THREE.BoxGeometry(0.0016, 0.013, 0.0006).translate(0, 0.006, 0), hand, 0, 0, 0.0062).rotateZ(-0.6))
    face.add(mesh(new THREE.BoxGeometry(0.0013, 0.009, 0.0006).translate(0, 0.0042, 0), hand, 0, 0, 0.0063).rotateZ(1.9))
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; face.add(mesh(new THREE.BoxGeometry(0.0011, i % 3 ? 0.002 : 0.0035, 0.0005), hand, Math.sin(a) * 0.0155, Math.cos(a) * 0.0155, 0.0061).rotateZ(-a)) }
    if (/chronograph/.test(pid)) for (const [x, y] of [[-0.008, -0.004], [0.008, -0.004], [0, -0.01]]) face.add(mesh(new THREE.TorusGeometry(0.0034, 0.0004, 6, 20), hand, x!, y!, 0.0062))
    face.add(mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.004, 12).rotateZ(Math.PI / 2), metal, 0.0235, 0, 0))
    // Upright on its stand, facing you, the bracelet looping back behind the case like a watch on a cushion.
    const band = mesh(new THREE.TorusGeometry(0.026, 0.0048, 10, 48).scale(1, 1.05, 1), metal, 0, 0.037, -0.024)
    band.rotation.y = Math.PI / 2
    const cushion = mesh(new THREE.CapsuleGeometry(0.013, 0.03, 6, 16).rotateZ(Math.PI / 2), std(0x2a2d31, 0.85), 0, 0.03, -0.024)
    face.position.set(0, 0.037, 0.002); face.rotation.x = -0.08
    g.add(cushion, band, face)
    return
  }
  if (/ring|band|signet|solitaire/.test(pid)) {
    const ring = mesh(new THREE.TorusGeometry(0.011, 0.0022, 14, 48), metal, 0, 0.0132, 0)
    g.add(ring)
    if (/signet/.test(pid)) g.add(mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 24), metal, 0, 0.0255, 0))
    else if (/solitaire|emerald/.test(pid)) {
      g.add(mesh(new THREE.CylinderGeometry(0.0028, 0.002, 0.003, 6), metal, 0, 0.026, 0))
      g.add(mesh(new THREE.OctahedronGeometry(0.0045, 0).scale(1, 0.75, 1), stone(gemColour), 0, 0.0302, 0))
    }
    g.rotation.y = 0.5
    return
  }
  if (/earrings|ear-|studs/.test(pid)) {
    for (const x of [-0.016, 0.016]) {
      if (/hoops/.test(pid)) g.add(mesh(new THREE.TorusGeometry(0.009, 0.0013, 10, 36), metal, x, 0.012, 0))
      else if (/drops/.test(pid)) { g.add(mesh(new THREE.SphereGeometry(0.0022, 12, 10), metal, x, 0.024, 0)); g.add(mesh(new THREE.OctahedronGeometry(0.0055, 0).scale(0.7, 1.3, 0.7), stone(gemColour), x, 0.013, 0)) }
      else g.add(mesh(new THREE.SphereGeometry(0.0042, 16, 12), /pearl|studs/.test(pid) && !/emerald/.test(pid) ? pearl : stone(gemColour), x, 0.006, 0))
    }
    return
  }
  // Necklaces: a chain hanging in a U, with pearls or a pendant where named.
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 32; i++) { const t = i / 32 * Math.PI; pts.push(new THREE.Vector3(Math.cos(t) * 0.045, 0.07 - Math.sin(t) * 0.055, 0)) }
  const curve = new THREE.CatmullRomCurve3(pts)
  if (/pearl/.test(pid)) { for (let i = 0; i <= 30; i++) g.add(mesh(new THREE.SphereGeometry(0.0034, 12, 10), pearl, ...(curve.getPoint(i / 30).toArray() as [number, number, number]))) }
  else g.add(mesh(new THREE.TubeGeometry(curve, 64, 0.0012, 6, false), metal))
  if (/pendant/.test(pid)) { g.add(mesh(new THREE.TorusGeometry(0.0022, 0.0006, 6, 12), metal, 0, 0.0128, 0)); g.add(mesh(new THREE.OctahedronGeometry(0.0062, 0).scale(0.8, 1.2, 0.5), stone(gemColour), 0, 0.006, 0)) }
}


function plaque(text: string): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#1b1814'; g.fillRect(0, 0, 512, 128)
    g.strokeStyle = '#b8955a'; g.lineWidth = 4; g.strokeRect(6, 6, 500, 116)
    g.fillStyle = '#f3e3c3'; g.font = '600 52px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, 256, 68)
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, roughness: 0.5 }))
  m.userData.ghost = true
  return m
}

/** Gadgets pavilion displays + the dealership's car platform. */
export function buildShowroom(scene: THREE.Scene, o: { obstacles: Obstacle[]; pavilion: { x: number; z: number; w: number; d: number }; dealer: { x: number; z: number } }) {
  const stone = std(0xece6dc, 0.45)
  const brass = std(0xb8955a, 0.35, 0.8)
  const vitrine = new THREE.MeshStandardMaterial({ color: 0xd8e6ec, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false, envMapIntensity: 1.5 })
  const led = std(0x222222, 0.5, 0, { emissive: 0xfff1d8, emissiveIntensity: 1.6 })
  const { x: px, z: pz, d } = o.pavilion
  const room = new THREE.Group()
  room.position.set(px, 0.18, pz)
  // Pedestals face the glass front (door on the plaza side, -z).
  const items: Array<[string, string, number, number, number]> = [['phonepro', 'Pro phone', -1.7, -0.6, 3.1], ['laptop', 'Laptop', 0, -0.9, 1.7], ['watch', 'Smartwatch', 1.7, -0.6, 4.4]]
  for (const [id, label, x, z, scale] of items) {
    const ped = new THREE.Group(); ped.position.set(x, 0, z)
    ped.add(mesh(new THREE.BoxGeometry(0.62, 0.92, 0.62), stone, 0, 0.46, 0), mesh(new THREE.BoxGeometry(0.66, 0.04, 0.66), brass, 0, 0.94, 0))
    ped.add(mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56), vitrine, 0, 1.24, 0))
    for (const [ex, ez] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) ped.add(mesh(new THREE.BoxGeometry(0.012, 0.56, 0.012), led, ex * 0.28, 1.24, ez * 0.28))
    ped.add(mesh(new THREE.BoxGeometry(0.58, 0.02, 0.58), led, 0, 1.53, 0))
    const model = itemModel(id); model.scale.setScalar(scale); model.position.y = 0.97
    model.rotation.y = Math.PI + (id === 'laptop' ? 0.35 : 0.25)
    ped.add(model)
    const p = plaque(label); p.position.set(0, 0.7, -0.315); p.rotation.y = Math.PI
    ped.add(p)
    room.add(ped)
  }
  // A drone on a slim stand at the back, desktop rig on a low plinth.
  const stand = new THREE.Group(); stand.position.set(-0.9, 0, d / 2 - 0.8)
  stand.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 20), brass, 0, 0.03, 0), mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 8), brass, 0, 0.68, 0))
  const drone = itemModel('halo'); drone.scale.setScalar(2.2); drone.position.y = 1.2; stand.add(drone)
  room.add(stand)
  const rig = new THREE.Group(); rig.position.set(1.0, 0, d / 2 - 0.9); rig.rotation.y = Math.PI
  rig.add(mesh(new THREE.BoxGeometry(1.4, 0.7, 0.7), stone, 0, 0.35, 0))
  const pc = itemModel('desktop'); pc.position.y = 0.7; pc.scale.setScalar(1.3); rig.add(pc)
  room.add(rig)
  // Ceiling: a light frame of LED bars so the displays read lit day and night.
  for (const x of [-1.7, 0, 1.7]) room.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.08), led, x, 2.85, -0.6))
  scene.add(room)

  // Dealership: stone platform with a brass LED rim, the grand tourer parked on it (static, no spinning),
  // a plaque on a slim totem.
  const { x: dx, z: dz } = o.dealer
  const plat = new THREE.Group(); plat.position.set(dx, 0, dz)
  plat.add(mesh(new THREE.CylinderGeometry(2.7, 2.8, 0.22, 48), stone, 0, 0.11, 0), mesh(new THREE.TorusGeometry(2.72, 0.025, 6, 64).rotateX(Math.PI / 2), led, 0, 0.21, 0))
  const car = itemModel('tourer'); car.position.y = 0.22; car.rotation.y = 2.3; plat.add(car)
  // Plaque on a low bronze lectern at the platform's edge, readable from both sides.
  const totem = new THREE.Group(); totem.position.set(1.9, 0.22, -1.9); totem.rotation.y = 0.9
  totem.add(mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), brass, 0, 0.4, 0))
  for (const side of [0, Math.PI]) { const p = plaque('Auto dealership'); p.position.set(0, 0.86, side ? -0.012 : 0.012); p.rotation.set(-0.35 * (side ? -1 : 1), side, 0); totem.add(p) }
  totem.add(mesh(new THREE.BoxGeometry(0.48, 0.13, 0.016), brass, 0, 0.86, 0))
  plat.add(totem)
  scene.add(plat)
  o.obstacles.push({ kind: 'box', x: dx, z: dz, hx: 2.6, hz: 2.6 })
}
