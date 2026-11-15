// Luxury homes in 3D: the garden duplex, the hillside mansion (escalator and glass lift), the crown penthouse on the
// marina tower and the sky house on the Sky Tower, both with infinity pools over the real city. Furniture follows
// the home's look (homesShop.ts STYLES) and every piece can be moved with two taps (Arrange). Lazy-loaded by main.ts.
// The player stands at a real height in these homes (main.ts levelY); walking into a pool lowers you into the water.
import * as THREE from 'three'
import type { Obstacle } from './physics.ts'
import type { Hotspot } from './world.ts'
import { animateWater } from './water.ts'
import { slotKey, spendInGame } from './state.ts'
import { adjust } from './needs.ts'
import { HOMES, LUXE, STYLES, readHomes, saveLayout, styleOf, type HomeId, type Palette, type StyleId } from './homesShop.ts'
import { buildAirport, buildYacht, type TravelCtx } from './travel.ts'
import { buildParkPlus } from './parkPlus.ts'

export type Rect = { x0: number; z0: number; x1: number; z1: number }
type Level = { y: number; walk: Rect; pools: Rect[]; obstacles: Obstacle[]; group: THREE.Group; uses: Hotspot[] }
export type AreaId = HomeId | 'park' | 'airport' | 'yacht'
/** Places anyone can visit (not homes you own): no styles, no arranging, nothing saved. */
export const PUBLIC_AREAS: AreaId[] = ['park', 'airport', 'yacht']
const isPublic = (id: AreaId) => PUBLIC_AREAS.includes(id)
type Kind = 'bench' | 'tree' | 'swings' | 'slide' | 'kiosk' | 'sofaL' | 'sofa' | 'arm' | 'coffee' | 'rug' | 'lamp' | 'dining' | 'island' | 'kitchen' | 'bed' | 'tv' | 'plant' | 'art' | 'lounger' | 'tub' | 'desk' | 'recliners' | 'screen' | 'heli'
  | 'piano' | 'chandelier' | 'lounge' | 'sculpture' | 'painting' | 'aquarium' | 'winewall' | 'cinema' | 'fireplace' | 'telescope' | 'palms' | 'barcart'
type Piece = { key: string; kind: Kind; x: number; z: number; r: number; lv: number; obj?: THREE.Group }
export type Move = { seat?: () => { yaw: number; y: number } | null; face?: () => number | null; exit?: { x: number; z: number }; hide?: boolean; camFn?: () => number; done?: () => void; view?: () => { heading: number; pitch: number }; cam?: number; path?: (u: number) => { x: number; z: number; y: number }; from: { x: number; z: number; y: number }; to: { x: number; z: number; y: number }; t: number; dur: number; toLv: number; car?: THREE.Object3D; carY0?: number; carY1?: number }

// Footprints (width along local x, depth along local z) for the walking player; 0 = walk over it.
const FOOT: Record<Kind, [number, number]> = {
  bench: [1.8, 0.7], tree: [1.0, 1.0], swings: [3.2, 1.6], slide: [1.2, 4.2], kiosk: [2.6, 2.0],
  sofaL: [3.0, 2.2], sofa: [2.5, 0.95], arm: [0.9, 0.9], coffee: [1.3, 0.7], rug: [0, 0], lamp: [0.4, 0.4], dining: [2.4, 1.9], island: [2.6, 1.0], kitchen: [4.0, 0.7],
  bed: [3.0, 2.3], tv: [3.0, 0.5], plant: [0.6, 0.6], art: [0, 0], lounger: [0.7, 1.9], tub: [1.7, 0.8], desk: [1.5, 1.2], recliners: [2.0, 1.0], screen: [3.6, 0.3], heli: [2.6, 8.5],
  piano: [1.6, 2.2], chandelier: [0, 0], lounge: [0.9, 1.6], sculpture: [0.7, 0.7], painting: [0, 0], aquarium: [2.6, 0.6], winewall: [2.6, 0.5], cinema: [3.4, 1.6], fireplace: [1.8, 0.5], telescope: [0.8, 0.8], palms: [1.6, 0.8], barcart: [0.9, 0.5],
}

// ---------------------------------------------------------------- materials

const std = (color: number, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
const texCache = new Map<string, THREE.CanvasTexture>()
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4
  texCache.set(key, t)
  return t
}
let seed = 3
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
function floorTex(kind: Palette['floor']): THREE.CanvasTexture {
  return canvasTex(`floor-${kind}`, 256, 256, (g) => {
    seed = 11
    if (kind === 'oak' || kind === 'walnut') {
      const base = kind === 'oak' ? [214, 178, 134] : [118, 80, 54]
      for (let r = 0; r < 8; r++) {
        const v = (rnd() - 0.5) * 22
        g.fillStyle = `rgb(${base[0]! + v},${base[1]! + v},${base[2]! + v})`; g.fillRect(0, r * 32, 256, 32)
        for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(${kind === 'oak' ? '120,80,40' : '40,24,14'},0.18)`; g.beginPath(); const y = r * 32 + rnd() * 32; g.moveTo(0, y); g.bezierCurveTo(80, y + rnd() * 4 - 2, 170, y + rnd() * 4 - 2, 256, y); g.stroke() }
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, r * 32, 256, 1)
        const cut = (r * 97) % 256; g.fillRect(cut, r * 32, 1, 32)
      }
    } else if (kind === 'marble') {
      g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, 256, 256)
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(120,120,128,${0.12 + rnd() * 0.2})`; g.lineWidth = 0.6 + rnd() * 1.6; g.beginPath(); let x = rnd() * 256, y = 0; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 70; y += 34; g.lineTo(x, y) } g.stroke() }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 256, 1); g.fillRect(0, 0, 1, 256)
    } else if (kind === 'travertine') {
      g.fillStyle = '#e4d4b8'; g.fillRect(0, 0, 256, 256)
      for (let k = 0; k < 90; k++) { g.fillStyle = `rgba(${150 + rnd() * 40},${120 + rnd() * 30},${80 + rnd() * 30},0.2)`; g.fillRect(0, rnd() * 256, 256, 1 + rnd() * 2) }
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 256, 1); g.fillRect(0, 128, 256, 1); g.fillRect(0, 0, 1, 256)
    } else {
      g.fillStyle = '#8f8f8b'; g.fillRect(0, 0, 256, 256)
      for (let k = 0; k < 5000; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(40,40,40,0.16)' : 'rgba(220,220,215,0.12)'; g.fillRect(rnd() * 256, rnd() * 256, 1, 1) }
    }
  })
}
function artTex(c: number): THREE.CanvasTexture {
  return canvasTex(`art-${c}`, 256, 180, (g) => {
    const hex = `#${c.toString(16).padStart(6, '0')}`
    g.fillStyle = '#f2eee6'; g.fillRect(0, 0, 256, 180)
    g.fillStyle = hex; g.fillRect(24, 26, 120, 120)
    g.globalAlpha = 0.75; g.fillStyle = '#1d1d1f'; g.beginPath(); g.arc(170, 96, 48, 0, Math.PI * 2); g.fill()
    g.globalAlpha = 0.6; g.fillStyle = hex; g.fillRect(150, 30, 80, 14)
  })
}
function masterTex(): THREE.CanvasTexture {
  return canvasTex('master', 256, 192, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 120); sky.addColorStop(0, '#5d6f80'); sky.addColorStop(1, '#d9c79c'); g.fillStyle = sky; g.fillRect(0, 0, 256, 192)
    g.fillStyle = '#4a4a2c'; g.fillRect(0, 120, 256, 72)
    seed = 5
    for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(${30 + rnd() * 30},${40 + rnd() * 30},${20 + rnd() * 10},0.9)`; g.beginPath(); g.arc(rnd() * 256, 110 + rnd() * 20, 18 + rnd() * 26, 0, Math.PI * 2); g.fill() }
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(200, 40, 10, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(30,24,16,0.35)'; g.fillRect(0, 160, 256, 32)
  })
}
type Mats = ReturnType<typeof mats>
function mats(p: Palette) {
  const floor = (w: number, d: number) => {
    const t = floorTex(p.floor).clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, w / 3), Math.max(1, d / 3))
    return std(0xffffff, p.floor === 'marble' ? 0.16 : p.floor === 'concrete' ? 0.55 : p.floor === 'travertine' ? 0.4 : 0.42, 0, { map: t })
  }
  return {
    floor,
    wall: std(p.wall, 0.92), sofa: std(p.sofa, 0.95), accent: std(p.accent, 0.85), rug: std(p.rug, 1), metal: std(p.metal, 0.28, 0.85), wood: std(p.wood, 0.5),
    white: std(0xf4f2ee, 0.45), linen: std(0xf1ede4, 0.95), dark: std(0x1b1c1f, 0.45), stone: std(0xd8d1c3, 0.75), tile: std(0x9fd0dc, 0.35), marble: std(0xf0eee9, 0.18),
    chrome: std(0xdfe3e7, 0.14, 1), leaf: std(0x3f6b33, 0.8), pot: std(0xd2cbbd, 0.7), black: std(0x0d0e10, 0.3, 0.2), screen: std(0x0b1220, 0.25, 0, { emissive: 0x1a3550, emissiveIntensity: 0.6 }),
    shade: std(0xf3e6cf, 0.9, 0, { emissive: 0xffd8a0, emissiveIntensity: 0.35 }), glow: new THREE.MeshBasicMaterial({ color: 0xffe2b0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe3ea, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    frame: std(0x1d1f22, 0.4, 0.6),
    water: std(0x2b9fc0, 0.05, 0.1, { transparent: true, opacity: 0.84, emissive: 0x0b4b5e, emissiveIntensity: 0.1 }),
    art: std(0xffffff, 0.8, 0, { map: artTex(p.art) }),
    crystal: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.7, emissive: 0xfff3d8, emissiveIntensity: 0.25 }),
  }
}

// ---------------------------------------------------------------- furniture

function box(g: THREE.Group, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o
}
function cyl(g: THREE.Group, rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 14): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = true; g.add(o); return o
}
function soft(g: THREE.Group, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  // Puff the middle of each face a little so cushions read as upholstered, not crates.
  for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i); const k = 1 + 0.06 * (1 - Math.abs(px) / (w / 2)) * (1 - Math.abs(pz) / (d / 2)); pos.setY(i, py * (py > 0 ? k : 1)) }
  geo.computeVertexNormals()
  const o = new THREE.Mesh(geo, m); o.position.set(x, y + h / 2, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o
}

/** One piece of furniture, its front towards +z, standing on y = 0. */
function piece(kind: Kind, M: Mats): THREE.Group {
  const g = new THREE.Group()
  switch (kind) {
    case 'sofa': case 'sofaL': {
      const w = kind === 'sofa' ? 2.5 : 3.0
      soft(g, w, 0.42, 0.95, M.sofa, 0, 0.1, 0); soft(g, w, 0.5, 0.24, M.sofa, 0, 0.45, -0.36)
      for (const s of [-1, 1]) soft(g, 0.22, 0.32, 0.95, M.sofa, s * (w / 2 - 0.11), 0.45, 0)
      for (let k = 0; k < (kind === 'sofa' ? 3 : 4); k++) soft(g, w / (kind === 'sofa' ? 3 : 4) - 0.08, 0.14, 0.7, M.sofa, -w / 2 + (k + 0.5) * (w / (kind === 'sofa' ? 3 : 4)), 0.52, 0.06)
      for (const s of [-1, 1]) soft(g, 0.5, 0.36, 0.14, M.accent, s * (w / 2 - 0.55), 0.62, -0.2).rotation.x = -0.25
      if (kind === 'sofaL') { soft(g, 0.95, 0.42, 1.25, M.sofa, w / 2 - 0.475, 0.1, 1.1); soft(g, 0.85, 0.14, 1.15, M.sofa, w / 2 - 0.475, 0.52, 1.12) }
      for (const [x, z] of [[-w / 2 + 0.1, -0.4], [w / 2 - 0.1, -0.4], [-w / 2 + 0.1, 0.4], [w / 2 - 0.1, 0.4]] as const) box(g, 0.05, 0.1, 0.05, M.metal, x, 0, z)
      break
    }
    case 'arm': soft(g, 0.86, 0.4, 0.86, M.sofa, 0, 0.12, 0); soft(g, 0.86, 0.48, 0.2, M.sofa, 0, 0.45, -0.33); for (const s of [-1, 1]) soft(g, 0.16, 0.28, 0.86, M.sofa, s * 0.35, 0.45, 0); soft(g, 0.45, 0.32, 0.12, M.accent, 0, 0.6, -0.16); for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]] as const) box(g, 0.04, 0.12, 0.04, M.metal, x, 0, z); break
    case 'coffee': box(g, 1.3, 0.05, 0.7, M.marble, 0, 0.4, 0); for (const [x, z] of [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]] as const) box(g, 0.04, 0.4, 0.04, M.metal, x, 0, z); box(g, 0.32, 0.06, 0.24, M.accent, -0.2, 0.45, 0.05); cyl(g, 0.07, 0.06, 0.16, M.white, 0.3, 0.45, -0.05); break
    case 'rug': { const r = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.3), M.rug); r.rotation.x = -Math.PI / 2; r.position.y = 0.012; r.receiveShadow = true; g.add(r); const b = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 4, 1), M.accent); b.rotation.set(-Math.PI / 2, 0, Math.PI / 4); b.scale.set(1.55, 1.12, 1); b.position.y = 0.016; g.add(b); break }
    case 'lamp': cyl(g, 0.16, 0.18, 0.03, M.metal); cyl(g, 0.015, 0.015, 1.45, M.metal, 0, 0.03); cyl(g, 0.2, 0.26, 0.32, M.shade, 0, 1.4); break
    case 'dining': {
      box(g, 2.4, 0.05, 1.0, M.wood, 0, 0.73, 0); for (const s of [-1, 1]) box(g, 0.08, 0.73, 0.7, M.metal, s * 0.95, 0, 0)
      for (const [x, z, r] of [[-0.75, -0.75, 0], [0, -0.75, 0], [0.75, -0.75, 0], [-0.75, 0.75, Math.PI], [0, 0.75, Math.PI], [0.75, 0.75, Math.PI]] as const) {
        const c = new THREE.Group(); soft(c, 0.46, 0.08, 0.46, M.sofa, 0, 0.44, 0); soft(c, 0.46, 0.5, 0.08, M.sofa, 0, 0.5, -0.2); for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]] as const) box(c, 0.03, 0.44, 0.03, M.metal, a, 0, b)
        c.position.set(x, 0, z); c.rotation.y = r; g.add(c)
      }
      cyl(g, 0.09, 0.06, 0.24, M.white, 0, 0.78, 0); for (const s of [-1, 1]) { const f = cyl(g, 0.012, 0.012, 0.3, M.leaf, s * 0.04, 0.95, 0); f.rotation.z = s * 0.3 }
      break
    }
    case 'island': box(g, 2.6, 0.9, 1.0, M.wood, 0, 0, 0); box(g, 2.7, 0.05, 1.1, M.marble, 0, 0.9, 0); for (let k = 0; k < 3; k++) { cyl(g, 0.17, 0.17, 0.06, M.sofa, -0.8 + k * 0.8, 0.72, 0.75); cyl(g, 0.02, 0.02, 0.72, M.metal, -0.8 + k * 0.8, 0, 0.75) } cyl(g, 0.12, 0.1, 0.12, M.white, 0.6, 0.95, 0); break
    case 'kitchen': {
      box(g, 3.2, 0.88, 0.62, M.wood, -0.4, 0, 0); box(g, 3.25, 0.05, 0.66, M.marble, -0.4, 0.88, 0); box(g, 3.2, 0.7, 0.38, M.wood, -0.4, 1.55, -0.12)
      box(g, 0.8, 2.1, 0.66, M.chrome, 1.6, 0, 0); box(g, 0.02, 1.2, 0.02, M.dark, 1.3, 0.8, 0.34)
      box(g, 0.6, 0.02, 0.5, M.black, -1.2, 0.93, 0); box(g, 0.6, 0.55, 0.02, M.black, -1.2, 0.18, 0.32); box(g, 0.5, 0.02, 0.38, M.chrome, 0.2, 0.93, 0)
      break
    }
    case 'bed': {
      box(g, 2.0, 0.3, 2.2, M.wood, 0, 0.1, 0); soft(g, 1.95, 0.22, 2.1, M.linen, 0, 0.4, 0.02); soft(g, 1.98, 0.08, 1.3, M.white, 0, 0.6, 0.42); soft(g, 1.98, 0.06, 0.5, M.accent, 0, 0.66, 0.85)
      for (const s of [-1, 1]) soft(g, 0.7, 0.16, 0.38, M.white, s * 0.45, 0.62, -0.78); soft(g, 2.2, 1.0, 0.12, M.sofa, 0, 0.3, -1.1)
      for (const s of [-1, 1]) { box(g, 0.5, 0.5, 0.42, M.wood, s * 1.3, 0, -0.85); cyl(g, 0.12, 0.15, 0.3, M.shade, s * 1.3, 0.5, -0.85) }
      break
    }
    case 'tv': box(g, 3.0, 0.45, 0.45, M.wood, 0, 0, 0); box(g, 2.0, 1.15, 0.05, M.black, 0, 0.95, -0.1); box(g, 1.92, 1.07, 0.01, M.screen, 0, 0.99, -0.07); break
    case 'plant': cyl(g, 0.24, 0.18, 0.5, M.pot); for (const [x, y, z, s] of [[0, 0.95, 0, 0.42], [0.18, 1.25, 0.06, 0.3], [-0.16, 1.15, -0.05, 0.32], [0.04, 1.45, -0.1, 0.24]] as const) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), M.leaf); l.position.set(x, y, z); l.castShadow = true; g.add(l) } cyl(g, 0.02, 0.03, 0.7, M.wood, 0, 0.45); break
    case 'art': box(g, 1.5, 1.08, 0.05, M.metal, 0, 1.15, 0); { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.98), M.art); c.position.set(0, 1.69, 0.03); g.add(c) } break
    case 'lounger': box(g, 0.66, 0.08, 1.9, M.white, 0, 0.3, 0); soft(g, 0.62, 0.08, 1.2, M.linen, 0, 0.38, 0.3); { const b = soft(g, 0.62, 0.08, 0.7, M.linen, 0, 0.55, -0.55); b.rotation.x = 0.6 } for (const [x, z] of [[-0.28, -0.8], [0.28, -0.8], [-0.28, 0.8], [0.28, 0.8]] as const) box(g, 0.04, 0.3, 0.04, M.chrome, x, 0, z); break
    case 'tub': { const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 6, 16), M.white); t.rotation.z = Math.PI / 2; t.scale.set(1, 1, 0.95); t.position.y = 0.38; t.castShadow = true; g.add(t); const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), M.water); w.rotation.x = -Math.PI / 2; w.position.y = 0.62; g.add(w); cyl(g, 0.02, 0.02, 0.9, M.chrome, 0.75, 0, -0.3); break }
    case 'desk': box(g, 1.5, 0.04, 0.7, M.wood, 0, 0.74, -0.25); for (const s of [-1, 1]) box(g, 0.04, 0.74, 0.6, M.metal, s * 0.7, 0, -0.25); box(g, 0.5, 0.32, 0.02, M.black, 0, 0.78, -0.45); { const c = new THREE.Group(); soft(c, 0.5, 0.08, 0.5, M.sofa, 0, 0.45, 0); soft(c, 0.5, 0.55, 0.08, M.sofa, 0, 0.5, -0.22); cyl(c, 0.02, 0.02, 0.45, M.metal); c.position.z = 0.35; c.rotation.y = Math.PI; g.add(c) } break
    case 'recliners': for (const s of [-0.5, 0.5]) { soft(g, 0.9, 0.42, 0.95, M.dark, s, 0.08, 0); soft(g, 0.9, 0.7, 0.24, M.dark, s, 0.4, -0.36); for (const a of [-1, 1]) soft(g, 0.14, 0.24, 0.9, M.dark, s + a * 0.42, 0.45, 0) } break
    case 'screen': box(g, 3.6, 2.0, 0.06, M.black, 0, 0.6, 0); box(g, 3.5, 1.9, 0.01, M.screen, 0, 0.65, 0.035); break
    case 'heli': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M.dark); body.scale.set(1.15, 1.0, 2.2); body.position.set(0, 1.35, 0.6); body.castShadow = true; g.add(body)
      const win = new THREE.Mesh(new THREE.SphereGeometry(1.01, 16, 10, 0, Math.PI * 2, 0, 0.9), M.glass); win.scale.set(1.12, 0.96, 2.18); win.rotation.x = 1.15; win.position.set(0, 1.4, 0.7); g.add(win)
      const boom = cyl(g, 0.12, 0.28, 4.6, M.dark, 0, 0, 0); boom.rotation.x = Math.PI / 2; boom.position.set(0, 1.55, -2.9)
      box(g, 0.08, 1.0, 0.6, M.dark, 0, 1.45, -5.0); box(g, 0.05, 0.12, 2.9, M.metal, 0, 1.12, 0.6)
      for (const s of [-1, 1]) { const sk = cyl(g, 0.05, 0.05, 3.0, M.chrome, s * 0.85, 0, 0); sk.rotation.x = Math.PI / 2; sk.position.set(s * 0.85, 0.08, 0.5); box(g, 0.05, 0.4, 0.05, M.chrome, s * 0.75, 0.08, 1.1); box(g, 0.05, 0.4, 0.05, M.chrome, s * 0.75, 0.08, -0.1) }
      cyl(g, 0.12, 0.12, 0.35, M.metal, 0, 2.35, 0.6); for (const r of [0, Math.PI / 2]) { const b = box(g, 9.0, 0.04, 0.26, M.black, 0, 2.7, 0.6); b.rotation.y = r + 0.4 }
      break
    }
    case 'piano': {
      const sh = new THREE.Shape(); sh.moveTo(-0.75, -1.05); sh.lineTo(0.75, -1.05); sh.lineTo(0.75, 0.2); sh.bezierCurveTo(0.75, 1.0, 0.1, 1.15, -0.2, 1.1); sh.bezierCurveTo(-0.6, 1.0, -0.75, 0.7, -0.75, 0.3); sh.lineTo(-0.75, -1.05)
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false, curveSegments: 16 }); geo.rotateX(Math.PI / 2); geo.translate(0, 0.98, 0)
      const bodyM = std(0x0b0b0d, 0.08, 0.3); const b = new THREE.Mesh(geo, bodyM); b.castShadow = true; g.add(b)
      const lidGeo = new THREE.ShapeGeometry(sh, 16); lidGeo.rotateX(Math.PI / 2); lidGeo.translate(-0.75, 0, 0); lidGeo.rotateZ(-0.7)
      const lid = new THREE.Mesh(lidGeo, std(0x0b0b0d, 0.08, 0.3, { side: THREE.DoubleSide })); lid.position.set(0.75, 0.99, 0); g.add(lid)
      box(g, 1.5, 0.05, 0.3, M.white, 0, 0.92, -1.2); for (const [x, z] of [[-0.65, -0.95], [0.65, -0.95], [0, 0.95]] as const) box(g, 0.08, 0.66, 0.08, bodyM, x, 0, z)
      box(g, 0.9, 0.06, 0.38, bodyM, 0, 0.5, -1.7); for (const s of [-1, 1]) box(g, 0.05, 0.5, 0.3, bodyM, s * 0.4, 0, -1.7)
      break
    }
    case 'chandelier': {
      const y0 = 2.55
      cyl(g, 0.01, 0.01, 0.5, M.metal, 0, y0 + 0.4)
      for (const [r, y, n] of [[0.55, y0, 12], [0.38, y0 + 0.2, 9], [0.2, y0 + 0.36, 6]] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.015, 6, 32), M.metal); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring)
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), M.crystal); c.scale.y = 1.8; c.position.set(Math.cos(a) * r, y - 0.09, Math.sin(a) * r); g.add(c) }
      }
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.glow); bulb.position.y = y0 + 0.1; g.add(bulb)
      break
    }
    case 'lounge': { const shell = std(0x5a3a26, 0.4); soft(g, 0.8, 0.22, 0.8, shell, 0, 0.28, 0); soft(g, 0.72, 0.16, 0.7, M.black, 0, 0.48, 0.02); const back = soft(g, 0.8, 0.75, 0.16, shell, 0, 0.45, -0.36); back.rotation.x = -0.35; cyl(g, 0.03, 0.03, 0.3, M.chrome); soft(g, 0.6, 0.3, 0.5, shell, 0, 0.1, 0.95); soft(g, 0.55, 0.12, 0.45, M.black, 0, 0.38, 0.95); break }
    case 'sculpture': box(g, 0.6, 1.0, 0.6, M.white, 0, 0, 0); { const k = new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.07, 80, 10), M.marble); k.position.y = 1.35; k.castShadow = true; g.add(k) } break
    case 'painting': box(g, 1.9, 1.45, 0.08, std(0xb8892f, 0.3, 0.8), 0, 0.9, 0); { const c = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.18), std(0xffffff, 0.8, 0, { map: masterTex() })); c.position.set(0, 1.625, 0.045); g.add(c) } break
    case 'aquarium': {
      box(g, 2.6, 0.7, 0.6, M.wood, 0, 0, 0); box(g, 2.6, 0.9, 0.6, M.glass, 0, 0.7, 0)
      const w = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 0.5), std(0x2a8fbf, 0.1, 0, { transparent: true, opacity: 0.55, emissive: 0x0d4f7a, emissiveIntensity: 0.6 })); w.position.y = 1.12; g.add(w)
      box(g, 2.5, 0.08, 0.5, std(0xe2d2a8, 1), 0, 0.72, 0)
      for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 + (k % 3) * 0.03, 0), std([0xff7a59, 0xf2c14e, 0xb05cd8][k % 3]!, 0.6)); c.position.set(-1 + k * 0.4, 0.86, (k % 2) * 0.15 - 0.07); g.add(c) }
      for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std(k % 2 ? 0xff8c1a : 0x2aa8ff, 0.5, 0, { emissive: k % 2 ? 0x552200 : 0x002244 })); f.scale.set(1.8, 1, 0.6); f.position.set(-0.9 + k * 0.45, 1.05 + (k % 3) * 0.12, 0); f.userData.fish = k; g.add(f) }
      break
    }
    case 'winewall': {
      box(g, 2.6, 2.4, 0.45, M.wood, 0, 0, -0.02); box(g, 2.4, 2.2, 0.02, std(0xffd9a0, 0.6, 0, { emissive: 0xffb860, emissiveIntensity: 0.5 }), 0, 0.1, 0.2)
      const bottle = new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8).rotateX(Math.PI / 2)
      const inst = new THREE.InstancedMesh(bottle, std(0x2b0f12, 0.2, 0.2), 96); const m = new THREE.Matrix4(); let k = 0
      for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) { m.makeTranslation(-1.1 + c * 0.2, 0.3 + r * 0.25, 0.12); inst.setMatrixAt(k++, m) }
      g.add(inst); box(g, 2.6, 2.4, 0.02, M.glass, 0, 0, 0.24)
      break
    }
    case 'cinema': box(g, 3.4, 1.9, 0.05, M.black, 0, 0.7, -0.6); box(g, 3.3, 1.8, 0.01, M.screen, 0, 0.75, -0.57); for (const s of [-0.5, 0.5]) { soft(g, 0.9, 0.42, 0.95, std(0x5a1c1c, 0.9), s, 0.08, 0.6); soft(g, 0.9, 0.7, 0.24, std(0x5a1c1c, 0.9), s, 0.4, 0.24) } break
    case 'fireplace': {
      box(g, 1.8, 1.2, 0.45, M.marble, 0, 0, 0); box(g, 1.0, 0.7, 0.05, M.black, 0, 0.2, 0.21); box(g, 2.0, 0.08, 0.55, M.marble, 0, 1.2, 0)
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), new THREE.MeshBasicMaterial({ color: 0xff9a2e })); flame.position.set(0, 0.45, 0.12); flame.userData.flame = 1; g.add(flame)
      break
    }
    case 'telescope': { for (let k = 0; k < 3; k++) { const l = cyl(g, 0.015, 0.02, 1.2, M.wood, 0, 0, 0); l.position.set(Math.cos((k * Math.PI * 2) / 3) * 0.25, 0.55, Math.sin((k * Math.PI * 2) / 3) * 0.25); l.rotation.set(Math.sin((k * Math.PI * 2) / 3) * 0.35, 0, -Math.cos((k * Math.PI * 2) / 3) * 0.35) } const t = cyl(g, 0.07, 0.09, 1.1, std(0xb8892f, 0.25, 0.9), 0, 0, 0); t.rotation.x = -1.1; t.position.set(0, 1.3, 0.2); break }
    case 'palms': for (const [x, s] of [[-0.55, 1], [0, 1.25], [0.55, 0.9]] as const) { box(g, 0.42, 0.45, 0.42, M.stone, x, 0, 0); cyl(g, 0.03, 0.04, 1.2 * s, M.wood, x, 0.45); for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.7 * s), M.leaf); f.material.side = THREE.DoubleSide; f.position.set(x, 0.45 + 1.2 * s, 0); f.rotation.set(0.9, (k / 6) * Math.PI * 2, 0); f.translateY(0.3 * s); g.add(f) } } break
    case 'bench': box(g, 1.8, 0.06, 0.45, M.wood, 0, 0.44, 0.05); box(g, 1.8, 0.4, 0.05, M.wood, 0, 0.55, -0.2); for (const sx of [-0.8, 0.8]) { box(g, 0.06, 0.44, 0.5, M.black, sx, 0, 0); box(g, 0.06, 0.45, 0.06, M.black, sx, 0.44, -0.2) } break
    case 'tree': { cyl(g, 0.22, 0.32, 3.2, M.wood); for (const [x, y, z, r] of [[0, 4.4, 0, 2.2], [1.1, 3.8, 0.4, 1.5], [-1, 3.9, -0.5, 1.6], [0.2, 5.4, -0.3, 1.5]] as const) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M.leaf); c.position.set(x, y, z); c.castShadow = true; g.add(c) } break }
    case 'swings': { for (const x of [-1.5, 1.5]) for (const z of [-0.7, 0.7]) { const l = cyl(g, 0.05, 0.05, 2.6, M.metal, x, 0, z); l.rotation.x = z > 0 ? -0.25 : 0.25 } const top = cyl(g, 0.06, 0.06, 3.2, M.metal, 0, 0, 0); top.rotation.z = Math.PI / 2; top.position.set(0, 2.5, 0); for (const x of [-0.7, 0.7]) { cyl(g, 0.01, 0.01, 1.9, M.black, x - 0.2, 0.6, 0); cyl(g, 0.01, 0.01, 1.9, M.black, x + 0.2, 0.6, 0); box(g, 0.5, 0.04, 0.2, M.accent, x, 0.56, 0) } break }
    case 'slide': { box(g, 1.0, 0.1, 1.0, M.wood, 0, 1.6, -1.6); for (const [x, z] of [[-0.45, -2.05], [0.45, -2.05], [-0.45, -1.15], [0.45, -1.15]] as const) box(g, 0.08, 1.6, 0.08, M.metal, x, 0, z); const sl = box(g, 0.7, 0.05, 3.0, M.accent, 0, 0, 0.3); sl.rotation.x = 0.5; sl.position.set(0, 0.85, 0.3); for (let k = 0; k < 5; k++) box(g, 0.6, 0.04, 0.12, M.metal, 0, k * 0.32, -2.3); break }
    case 'kiosk': { box(g, 2.4, 1.0, 1.4, M.white, 0, 0, 0); box(g, 2.6, 0.06, 1.6, M.marble, 0, 1.0, 0); for (const x of [-1.1, 1.1]) box(g, 0.08, 1.4, 0.08, M.metal, x, 1.06, 0.6); const awn = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.9), std(0xf06292, 0.7)); awn.position.set(0, 2.5, 0.2); awn.rotation.x = 0.15; awn.castShadow = true; g.add(awn); for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), std([0xf7c6d9, 0xfff1c1, 0x7a4a2a, 0xb6e3c6][k]!, 0.6)); c.position.set(-0.6 + k * 0.4, 1.12, 0.3); g.add(c) } break }
    case 'barcart': box(g, 0.85, 0.02, 0.45, M.glass, 0, 0.82, 0); box(g, 0.85, 0.02, 0.45, M.glass, 0, 0.35, 0); for (const [x, z] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]] as const) cyl(g, 0.012, 0.012, 0.85, M.metal, x, 0, z); for (let k = 0; k < 4; k++) cyl(g, 0.04, 0.045, 0.26, std([0x7a3d12, 0x2a5a2a, 0xd8d0b0, 0x5a1218][k]!, 0.15, 0.1, { transparent: true, opacity: 0.85 }), -0.3 + k * 0.2, 0.84, 0); break
  }
  return g
}

// ---------------------------------------------------------------- the homes

type Plan = {
  id: AreaId
  levels: Array<{ y: number; walk: Rect; pools: Rect[] }>
  spawn: { x: number; z: number; heading: number; lv: number }
  exitTo: { x: number; z: number }
  /** Footprint of the house (upper levels show from outside it); null for homes on a tower. */
  house: Rect | null
  pieces: Array<[string, Kind, number, number, number, number]>
  build: (A: Arch) => void
}
export type Arch = {
  M: Mats
  lv: Level[]
  slab: (l: number, r: Rect, hole?: Rect, mat?: THREE.Material) => void
  wall: (l: number, x0: number, z0: number, x1: number, z1: number, h: number, mat: THREE.Material | 'glass', gaps?: Array<[number, number]>) => void
  rail: (l: number, x0: number, z0: number, x1: number, z1: number) => void
  block: (l: number, r: Rect) => void
  pool: (l: number, r: Rect, edge: 'x0' | 'x1' | 'z0' | 'z1') => void
  add: (l: number, o: THREE.Object3D) => void
  use: (l: number, u: Hotspot) => void
  lift: (x: number, z: number, levels: number[], label: (from: number, to: number) => string, exit?: { x: number; z: number; label: string }) => void
  ride: (kind: 'esc' | 'stair', a: { x: number; z: number }, b: { x: number; z: number }, lo: number, hi: number) => void
}

const R = (x0: number, z0: number, x1: number, z1: number): Rect => ({ x0, z0, x1, z1 })
const PEN = { x: 51, z: -32, y: 26.8 }
const SKY = { x: -80, z: -18, y: 108 }

function plans(): Record<AreaId, Plan> {
  return {
    // Grind Park, south-west of the city at the end of the metro branch: lawns, a lake, a fountain, a playground,
    // an ice-cream kiosk, and two rides: a Ferris wheel and a carousel (built in the plan, ridden with the gold button).
    park: {
      id: 'park',
      levels: [{ y: 0, walk: R(-302, 100, -108, 206), pools: [] }],
      spawn: { x: -118.5, z: 124, heading: -0.9, lv: 0 },
      exitTo: { x: -8, z: -59.5 },
      house: null,
      pieces: [
        ['b1', 'bench', -136, 131.6, 0, 0], ['b2', 'bench', -140.4, 140, Math.PI / 2, 0], ['b3', 'bench', -131.6, 140, -Math.PI / 2, 0], ['b4', 'bench', -136, 148.4, Math.PI, 0],
        ['b5', 'bench', -150, 131, Math.PI, 0], ['b6', 'bench', -158, 120, Math.PI / 2, 0],
        ['t1', 'tree', -112, 110, 0, 0], ['t2', 'tree', -125, 108, 0, 0], ['t3', 'tree', -165, 108, 0, 0], ['t4', 'tree', -166, 132, 0, 0], ['t5', 'tree', -166, 160, 0, 0],
        ['t6', 'tree', -112, 162, 0, 0], ['t7', 'tree', -124, 166, 0, 0], ['t8', 'tree', -112, 140, 0, 0], ['t9', 'tree', -146, 108, 0, 0], ['t10', 'tree', -160, 145, 0, 0], ['t11', 'tree', -140, 166, 0, 0],
        ['swings', 'swings', -116, 150, 0, 0], ['slide', 'slide', -116, 158, Math.PI / 2, 0], ['kiosk', 'kiosk', -128, 116, 0, 0],
        ['l1', 'lamp', -132, 128, 0, 0], ['l2', 'lamp', -144, 152, 0, 0], ['l3', 'lamp', -124, 152, 0, 0],
      ],
      build: (A) => {
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(176, 152), std(0x5f8f45, 1)); lawn.rotation.x = -Math.PI / 2; lawn.position.set(-125, -0.012, 138); lawn.receiveShadow = true; A.add(0, lawn)
        const path = std(0xe0d6c2, 0.95)
        for (const [x, z, w, d] of [[-127, 128, 3, 16], [-138, 140, 3, 50], [-138, 140, 52, 3]] as const) { const pth = new THREE.Mesh(new THREE.PlaneGeometry(w, d), path); pth.rotation.x = -Math.PI / 2; pth.position.set(x, 0.006, z); pth.receiveShadow = true; A.add(0, pth) }
        const ringP = new THREE.Mesh(new THREE.RingGeometry(5.5, 8, 40), path); ringP.rotation.x = -Math.PI / 2; ringP.position.set(-138, 0.008, 140); A.add(0, ringP)
        // Fountain at the centre.
        const fount = new THREE.Group(); cyl(fount, 3.2, 3.4, 0.55, A.M.stone); const fw = new THREE.Mesh(new THREE.CircleGeometry(3.0, 28), A.M.water); fw.rotation.x = -Math.PI / 2; fw.position.y = 0.5; fount.add(fw); cyl(fount, 0.3, 0.45, 2.0, A.M.stone, 0, 0.4); cyl(fount, 1.1, 0.9, 0.2, A.M.stone, 0, 2.2); fount.position.set(-138, 0, 140); A.add(0, fount)
        A.block(0, R(-141.5, 136.5, -134.5, 143.5))
        // Lake with a sandy edge (not for swimming).
        const sand = new THREE.Mesh(new THREE.CircleGeometry(11, 40), std(0xd9c79f, 1)); sand.rotation.x = -Math.PI / 2; sand.position.set(-152, 0.004, 120); A.add(0, sand)
        const lake = new THREE.Mesh(new THREE.CircleGeometry(9.6, 40), A.M.water.clone()); lake.rotation.x = -Math.PI / 2; lake.position.set(-152, 0.03, 120); animateWater(lake, 4); A.add(0, lake)
        A.block(0, R(-160.5, 112, -143.5, 128))
        // Flower beds.
        const bedCols = [0xe0457b, 0xf2c230, 0xffffff, 0x8e5bd1]
        for (let k = 0; k < 4; k++) { const b = new THREE.Group(); cyl(b, 1.6, 1.7, 0.35, A.M.stone); for (let f = 0; f < 14; f++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), std(bedCols[(f + k) % 4]!, 0.7)); const a = f * 2.4; fl.position.set(Math.cos(a) * (0.3 + (f % 4) * 0.3), 0.45, Math.sin(a) * (0.3 + (f % 4) * 0.3)); b.add(fl) } b.position.set(-138 + [-10, 10, -10, 10][k]!, 0, 140 + [-10, -10, 10, 10][k]!); A.add(0, b); A.block(0, R(b.position.x - 1.7, b.position.z - 1.7, b.position.x + 1.7, b.position.z + 1.7)) }
      },
    },
    // Grind International Airport, east of the city at the end of the metro's airport branch (travel.ts builds it).
    airport: {
      id: 'airport',
      levels: [{ y: 0, walk: R(134, -78, 330, 128), pools: [] }],
      spawn: { x: 143, z: 12, heading: Math.PI / 2, lv: 0 },
      exitTo: { x: 59, z: 8 },
      house: null,
      pieces: [],
      build: () => {},
    },
    // The party yacht at the end of a jetty off the beach (travel.ts): you board on the aft deck.
    yacht: {
      id: 'yacht',
      levels: [{ y: 2.5, walk: R(41, -93.5, 47, -86.6), pools: [] }],
      spawn: { x: 44, z: -87.6, heading: Math.PI, lv: 0 },
      exitTo: { x: 30.5, z: -47.6 },
      house: null,
      pieces: [],
      build: () => {},
    },
    penthouse: {
      id: 'penthouse',
      levels: [{ y: PEN.y, walk: R(42.3, -38.2, 59.7, -25.8), pools: [R(42.3, -36.5, 44.8, -27.5)] }],
      spawn: { x: 56.6, z: -32, heading: -Math.PI / 2, lv: 0 },
      exitTo: { x: 49.6, z: -28.4 },
      house: null,
      pieces: [
        ['sofa', 'sofaL', 50.4, -32, -Math.PI / 2, 0], ['rug', 'rug', 48.8, -32, -Math.PI / 2, 0], ['coffee', 'coffee', 48.7, -32, -Math.PI / 2, 0],
        ['arm1', 'arm', 48.6, -34.4, 0, 0], ['arm2', 'arm', 48.6, -29.6, Math.PI, 0], ['lamp', 'lamp', 51.4, -34.8, 0, 0],
        ['dining', 'dining', 54.2, -35.6, 0, 0], ['kitchen', 'kitchen', 56.4, -37.8, 0, 0], ['island', 'island', 55.8, -35.5, Math.PI / 2, 0],
        ['bed', 'bed', 57.6, -27.1, Math.PI, 0], ['art', 'art', 54.5, -29.15, Math.PI, 0], ['plant1', 'plant', 47.1, -37.5, 0, 0], ['plant2', 'plant', 47.1, -26.5, 0, 0],
        ['lounger1', 'lounger', 45.7, -35.2, -Math.PI / 2, 0], ['lounger2', 'lounger', 45.7, -33.6, -Math.PI / 2, 0], ['lounger3', 'lounger', 45.7, -29.2, -Math.PI / 2, 0],
      ],
      build: (A) => {
        const y = PEN.y
        A.slab(0, R(42, -38.5, 60, -25.5), R(42.3, -36.5, 44.8, -27.5))
        A.pool(0, R(42.3, -36.5, 44.8, -27.5), 'x0')
        // Glass all round, the terrace open to the west, a sliding glass line between terrace and living room.
        A.wall(0, 46.5, -38.5, 46.5, -25.5, 3.1, 'glass', [[-33.4, -30.6]])
        A.wall(0, 46.5, -38.5, 60, -38.5, 3.1, 'glass'); A.wall(0, 46.5, -25.5, 60, -25.5, 3.1, 'glass'); A.wall(0, 60, -38.5, 60, -25.5, 3.1, 'glass')
        A.rail(0, 42, -38.5, 46.5, -38.5); A.rail(0, 42, -25.5, 46.5, -25.5)
        A.wall(0, 52.6, -29.2, 56.2, -29.2, 3.1, A.M.wall)
        // Lift core.
        const core = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.1, 2.2), A.M.wall); core.position.set(59.1, y + 1.55, -32); A.add(0, core); A.block(0, R(58.2, -33.1, 60, -30.9))
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.2, 1.1), A.M.metal); door.position.set(58.18, y + 1.1, -32); A.add(0, door)
        A.use(0, { id: 'home-exit', x: 57.4, z: -32, r: 1.1, title: 'Lift', body: 'Down to the street, at the foot of the marina tower.', enter: 'Lift down to the street', use: () => undefined })
        // Overhead: a floating roof plane shows only from the street, so the camera keeps its view inside.
      },
    },
    skyhouse: {
      id: 'skyhouse',
      levels: [
        { y: SKY.y, walk: R(-91.7, -25.7, -64.3, -10.3), pools: [R(-68.6, -24, -64.3, -12)] },
        { y: SKY.y + 4.6, walk: R(-91.7, -25.7, -76.3, -10.3), pools: [] },
      ],
      spawn: { x: -88.2, z: -14.2, heading: Math.PI / 2, lv: 0 },
      exitTo: { x: 40, z: -27.2 },
      house: null,
      pieces: [
        ['sofa', 'sofaL', -75.2, -18, Math.PI / 2, 0], ['rug', 'rug', -73.6, -18, Math.PI / 2, 0], ['coffee', 'coffee', -73.5, -18, Math.PI / 2, 0],
        ['arm1', 'arm', -73.4, -20.5, 0, 0], ['arm2', 'arm', -73.4, -15.5, Math.PI, 0], ['lamp', 'lamp', -76.6, -21, 0, 0],
        ['dining', 'dining', -81, -22.6, 0, 0], ['kitchen', 'kitchen', -86.2, -25.6, 0, 0], ['island', 'island', -86, -22.8, 0, 0],
        ['tv', 'tv', -83, -10.6, Math.PI, 0], ['art', 'art', -78, -25.75, 0, 0], ['plant1', 'plant', -71.3, -25, 0, 0], ['plant2', 'plant', -71.3, -11, 0, 0],
        ['lounger1', 'lounger', -69.6, -22.6, Math.PI / 2, 0], ['lounger2', 'lounger', -69.6, -13.4, Math.PI / 2, 0],
        ['bed', 'bed', -83.5, -11.6, Math.PI, 1], ['tub', 'tub', -89.2, -24.6, 0, 1], ['desk', 'desk', -79.5, -24.6, 0, 1], ['art2', 'art', -84, -10.35, Math.PI, 1], ['plant3', 'plant', -77.2, -11.2, 0, 1], ['lamp2', 'lamp', -77.2, -24.8, 0, 1],
      ],
      build: (A) => {
        const y = SKY.y
        A.slab(0, R(-92, -26, -64, -10), R(-68.6, -24, -64.3, -12))
        A.pool(0, R(-68.6, -24, -64.3, -12), 'x1')
        A.wall(0, -70.6, -26, -70.6, -10, 3.4, 'glass', [[-19.4, -16.6]])
        A.wall(0, -92, -26, -70.6, -26, 3.4, 'glass'); A.wall(0, -92, -10, -70.6, -10, 3.4, 'glass'); A.wall(0, -92, -26, -92, -10, 3.4, 'glass')
        A.rail(0, -70.6, -26, -64, -26); A.rail(0, -70.6, -10, -64, -10)
        A.slab(1, R(-92, -26, -76, -10))
        A.wall(1, -92, -26, -76, -26, 3.2, 'glass'); A.wall(1, -92, -10, -76, -10, 3.2, 'glass'); A.wall(1, -92, -26, -92, -10, 3.2, 'glass'); A.rail(1, -76, -26, -76, -10)
        // Lift core through both floors; its south door is the express lift to the street.
        for (const l of [0, 1]) { const core = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.4, 2.0), A.M.wall); core.position.set(-90.6, (l ? y + 4.6 : y) + 1.7, -12); A.add(l, core); A.block(l, R(-91.7, -13.1, -89.5, -10.9)) }
        A.lift(-88.2, -12, [0, 1], (_, to) => (to === 1 ? 'Lift up to the bedroom floor' : 'Lift down to the living floor'))
        A.use(0, { id: 'home-exit', x: -90.6, z: -14.4, r: 0.9, title: 'Express lift', body: 'Down 110 m to the street.', enter: 'Express lift to the street', use: () => undefined })
      },
    },
    mansion: {
      id: 'mansion',
      levels: [
        { y: 0, walk: R(116, 128, 184, 193), pools: [R(139, 160, 147, 165)] },
        { y: 4.6, walk: R(137.3, 136.3, 162.7, 153.7), pools: [] },
        { y: 9.2, walk: R(137.3, 136.3, 162.7, 153.7), pools: [R(139, 150.2, 161, 153.6)] },
      ],
      spawn: { x: 150, z: 151.6, heading: Math.PI, lv: 0 },
      exitTo: { x: 40, z: -27.2 },
      house: R(137, 136, 163, 154),
      pieces: [
        ['sofa', 'sofaL', 157, 146.2, 0, 0], ['rug', 'rug', 157, 148.3, 0, 0], ['coffee', 'coffee', 156.6, 148.4, 0, 0], ['arm1', 'arm', 154.4, 148.6, Math.PI / 2, 0], ['arm2', 'arm', 159.6, 148.6, -Math.PI / 2, 0],
        ['tv', 'tv', 162.5, 146.5, -Math.PI / 2, 0], ['lamp', 'lamp', 154.2, 145.2, 0, 0], ['dining', 'dining', 143.5, 149.6, 0, 0], ['kitchen', 'kitchen', 157, 136.6, 0, 0], ['island', 'island', 157, 139.6, 0, 0],
        ['art', 'art', 137.15, 145, Math.PI / 2, 0], ['plant1', 'plant', 138.2, 153, 0, 0], ['plant2', 'plant', 161.8, 153, 0, 0],
        ['lounger1', 'lounger', 150, 162.5, 0, 0], ['lounger2', 'lounger', 152, 162.5, 0, 0],
        ['bed', 'bed', 156.6, 138.4, 0, 1], ['tub', 'tub', 161.2, 151.2, -Math.PI / 2, 1], ['screen', 'screen', 141.5, 136.4, 0, 1], ['recliners', 'recliners', 141.5, 139.6, Math.PI, 1],
        ['sofa2', 'sofa', 156.6, 150.4, 0, 1], ['lamp2', 'lamp', 153.8, 151.6, 0, 1], ['art2', 'art', 162.85, 144.5, -Math.PI / 2, 1], ['plant3', 'plant', 152.2, 137, 0, 1],
        ['lounger3', 'lounger', 142, 147.6, 0, 2], ['lounger4', 'lounger', 145, 147.6, 0, 2], ['lounger5', 'lounger', 155, 147.6, 0, 2], ['lounger6', 'lounger', 158, 147.6, 0, 2], ['heli', 'heli', 145, 141.4, Math.PI / 2, 2], ['plant4', 'plant', 161.6, 137.6, 0, 2],
      ],
      build: (A) => {
        // Grounds: lawn, gravel drive, hedges and a fountain.
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(76, 72), std(0x5d8a43, 1)); lawn.rotation.x = -Math.PI / 2; lawn.position.set(150, 0.005, 160.5); lawn.receiveShadow = true; A.add(0, lawn)
        const drive = new THREE.Mesh(new THREE.PlaneGeometry(6, 38), std(0xd8cfbd, 0.95)); drive.rotation.x = -Math.PI / 2; drive.position.set(150, 0.012, 174); A.add(0, drive)
        for (const [x0, z0, x1, z1] of [[114, 126, 186, 126], [114, 195, 147, 195], [153, 195, 186, 195], [114, 126, 114, 195], [186, 126, 186, 195]] as const) {
          const len = Math.hypot(x1 - x0, z1 - z0); const h = new THREE.Mesh(new THREE.BoxGeometry(x0 === x1 ? 1 : len, 1.4, x0 === x1 ? len : 1), A.M.leaf); h.position.set((x0 + x1) / 2, 0.7, (z0 + z1) / 2); h.castShadow = true; A.add(0, h)
        }
        const fount = new THREE.Group(); cyl(fount, 2.4, 2.6, 0.5, A.M.stone); const fw = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), A.M.water); fw.rotation.x = -Math.PI / 2; fw.position.y = 0.46; fount.add(fw); cyl(fount, 0.25, 0.35, 1.6, A.M.stone, 0, 0.4); fount.position.set(150, 0, 180); A.add(0, fount); A.block(0, R(147.5, 177.5, 152.5, 182.5))
        A.pool(0, R(139, 160, 147, 165), 'z1')
        // The house: stone walls north, east and west, a glass front to the garden.
        A.slab(0, R(137, 136, 163, 154))
        A.wall(0, 137, 136, 163, 136, 4.6, A.M.wall); A.wall(0, 137, 136, 137, 154, 4.6, A.M.wall); A.wall(0, 163, 136, 163, 154, 4.6, A.M.wall); A.wall(0, 137, 154, 163, 154, 4.6, 'glass', [[148.6, 151.4]])
        // First floor: a gallery round a double-height hall.
        A.slab(1, R(137, 136, 163, 154), R(137, 142, 151, 154))
        A.wall(1, 137, 136, 163, 136, 4.6, A.M.wall); A.wall(1, 137, 136, 137, 142, 4.6, A.M.wall); A.wall(1, 163, 136, 163, 154, 4.6, A.M.wall); A.wall(1, 151, 154, 163, 154, 4.6, 'glass')
        A.rail(1, 137, 142, 151, 142); A.rail(1, 151, 144.3, 151, 154); A.block(1, R(137, 142, 151, 154))
        // Roof terrace: infinity pool on the garden side, a helipad, glass balustrade all round.
        A.slab(2, R(137, 136, 163, 154), R(139, 150.2, 161, 153.6))
        A.pool(2, R(139, 150.2, 161, 153.6), 'z1')
        A.rail(2, 137, 136, 163, 136); A.rail(2, 137, 136, 137, 154); A.rail(2, 163, 136, 163, 154)
        const pad = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), std(0x2b2d31, 0.7)); pad.rotation.x = -Math.PI / 2; pad.position.set(145, 9.215, 141.4); A.add(2, pad)
        const ring = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.25, 40), std(0xf2c230, 0.6)); ring.rotation.x = -Math.PI / 2; ring.position.set(145, 9.22, 141.4); A.add(2, ring)
        A.ride('esc', { x: 142.8, z: 143.2 }, { x: 151.6, z: 143.2 }, 0, 1)
        A.lift(160.2, 140.6, [0, 1, 2], (from) => (from === 0 ? 'Lift up to the first floor' : from === 1 ? 'Lift up to the roof' : 'Lift down to the hall'))
        A.use(0, { id: 'home-exit', x: 150, z: 155.6, r: 1.2, title: 'Front door', body: 'Back to the city.', enter: 'Leave for the city', use: () => undefined })
      },
    },
    duplex: {
      id: 'duplex',
      levels: [
        { y: 0, walk: R(139, 84, 161, 110), pools: [R(144, 101, 150, 104)] },
        { y: 3.6, walk: R(143.3, 86.3, 156.7, 95.7), pools: [] },
      ],
      spawn: { x: 150, z: 94.4, heading: Math.PI, lv: 0 },
      exitTo: { x: 40, z: -27.2 },
      house: R(143, 86, 157, 96),
      pieces: [
        ['sofa', 'sofa', 153.6, 92.6, 0, 0], ['rug', 'rug', 153.6, 94, 0, 0], ['coffee', 'coffee', 153.6, 94.2, 0, 0], ['arm1', 'arm', 151.2, 94.4, Math.PI / 2, 0],
        ['kitchen', 'kitchen', 146.2, 86.5, 0, 0], ['island', 'island', 146.4, 89.4, 0, 0], ['dining', 'dining', 146.6, 93.4, 0, 0], ['plant1', 'plant', 143.7, 95.3, 0, 0], ['art', 'art', 156.85, 92.5, -Math.PI / 2, 0],
        ['lounger1', 'lounger', 153, 102.6, 0, 0], ['lounger2', 'lounger', 155, 102.6, 0, 0], ['plant2', 'plant', 141, 98, 0, 0],
        ['bed', 'bed', 146.2, 89.8, 0, 1], ['desk', 'desk', 154.4, 94.6, Math.PI, 1], ['tub', 'tub', 144.4, 94.8, 0, 1], ['lamp', 'lamp', 156.3, 88.2, 0, 1], ['plant3', 'plant', 156, 95.2, 0, 1],
      ],
      build: (A) => {
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(24, 28), std(0x5d8a43, 1)); lawn.rotation.x = -Math.PI / 2; lawn.position.set(150, 0.005, 97); lawn.receiveShadow = true; A.add(0, lawn)
        for (const [x0, z0, x1, z1] of [[138, 83, 162, 83], [138, 111, 148, 111], [152, 111, 162, 111], [138, 83, 138, 111], [162, 83, 162, 111]] as const) {
          const len = Math.hypot(x1 - x0, z1 - z0); const w = new THREE.Mesh(new THREE.BoxGeometry(x0 === x1 ? 0.4 : len, 1.9, x0 === x1 ? len : 0.4), A.M.stone); w.position.set((x0 + x1) / 2, 0.95, (z0 + z1) / 2); w.castShadow = true; A.add(0, w)
        }
        A.pool(0, R(144, 101, 150, 104), 'z1')
        A.slab(0, R(143, 86, 157, 96))
        A.wall(0, 143, 86, 157, 86, 3.6, A.M.wall); A.wall(0, 143, 86, 143, 96, 3.6, A.M.wall); A.wall(0, 157, 86, 157, 96, 3.6, A.M.wall); A.wall(0, 143, 96, 157, 96, 3.6, 'glass', [[148.8, 151.2]])
        A.slab(1, R(143, 86, 157, 96))
        A.wall(1, 143, 86, 157, 86, 3.2, A.M.wall); A.wall(1, 143, 86, 143, 96, 3.2, A.M.wall); A.wall(1, 157, 86, 157, 96, 3.2, A.M.wall); A.wall(1, 143, 96, 157, 96, 3.2, 'glass')
        A.ride('stair', { x: 149.6, z: 86.8 }, { x: 154.4, z: 86.8 }, 0, 1)
        A.lift(155.6, 90.6, [0, 1], (_, to) => (to === 1 ? 'Lift up to the bedroom' : 'Lift down'))
        A.use(0, { id: 'home-exit', x: 150, z: 110, r: 1.4, title: 'Garden gate', body: 'Back to the city.', enter: 'Leave for the city', use: () => undefined })
      },
    },
  }
}

// ---------------------------------------------------------------- runtime

export function createHomes(scene: THREE.Scene, deps: { toast: (m: string) => void; openPanel: () => void; leave: () => void; train: (id: 'park' | 'airport') => void; fade: () => void }) {
  const P = plans()
  let inside: AreaId | null = null
  let extraObs: Obstacle[] = []
  let viewing = false
  let trying: StyleId | null = null
  let plan: Plan | null = null
  let root: THREE.Group | null = null
  let levels: Level[] = []
  let pieces: Piece[] = []
  let level = 0
  let move: Move | null = null
  const animated: Array<{ tick: (t: number) => void }> = []
  let swamToday = false
  let time = 0
  let turbo = 1
  let flying = false
  const cleanups: Array<() => void> = []
  const light = new THREE.PointLight(0xffe2b8, 0, 26, 1.6)
  light.castShadow = false

  // HUD chips: Styles, Arrange (your own homes), and Turn / Done while arranging.
  const hud = document.createElement('div'); hud.id = 'home-hud'; hud.hidden = true
  const chip = (label: string, f: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = (e) => { e.stopPropagation(); f() }; hud.append(b); return b }
  const stylesBtn = chip('Styles', () => deps.openPanel())
  const arrangeBtn = chip('Arrange', () => setArranging(!arranging))
  const turnBtn = chip('⟳ Turn', () => turnSelected())
  document.body.append(hud)
  let arranging = false
  let selected: Piece | null = null
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.85, depthWrite: false })
  const selRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), ringMat)
  selRing.rotation.x = -Math.PI / 2; selRing.visible = false; selRing.renderOrder = 4
  const paintHud = () => {
    hud.hidden = !inside
    arrangeBtn.hidden = viewing
    stylesBtn.hidden = !plan || isPublic(plan.id)
    if (plan && isPublic(plan.id)) arrangeBtn.hidden = true
    arrangeBtn.textContent = arranging ? 'Done' : 'Arrange'
    turnBtn.hidden = !arranging || !selected
    stylesBtn.textContent = viewing ? 'Try a look' : 'Styles'
  }
  const setArranging = (on: boolean) => {
    arranging = on
    selected = null
    selRing.visible = false
    if (on) deps.toast('Tap a piece, then tap where it goes. ⟳ turns it.')
    paintHud()
  }
  const turnSelected = () => {
    if (!selected || !plan) return
    selected.r += Math.PI / 4
    placePiece(selected)
    if (!isPublic(plan.id)) saveLayout(plan.id as HomeId, selected.key, selected.x, selected.z, selected.r)
    rebuildObstacles()
  }

  const palette = (): Palette => (trying ? STYLES.find((s) => s.id === trying)!.p : plan && !isPublic(plan.id) ? styleOf(plan.id as HomeId).p : STYLES[0]!.p)

  const placePiece = (p: Piece) => {
    if (!p.obj) return
    const L = levels[p.lv]!
    p.obj.position.set(p.x, L.y + (p.kind === 'heli' ? 0.02 : 0), p.z)
    p.obj.rotation.y = p.r
  }
  const pieceObstacle = (p: Piece): Obstacle | null => {
    const [w, d] = FOOT[p.kind]
    if (!w || !d) return null
    const c = Math.abs(Math.cos(p.r)), s = Math.abs(Math.sin(p.r))
    return { kind: 'box', x: p.x, z: p.z, hx: (w * c + d * s) / 2, hz: (w * s + d * c) / 2 }
  }
  const staticObs: Obstacle[][] = []
  const rebuildObstacles = () => {
    levels.forEach((L, i) => { L.obstacles = [...(staticObs[i] ?? []), ...((plan?.id === 'park' || plan?.id === 'airport') && i === 0 ? extraObs : [])]; for (const p of pieces) if (p.lv === i) { const o = pieceObstacle(p); if (o) L.obstacles.push(o) } })
  }

  const build = () => {
    if (!plan) return
    dispose3d()
    const M = mats(palette())
    root = new THREE.Group(); root.name = `home-${plan.id}`
    levels = plan.levels.map((l) => { const group = new THREE.Group(); root!.add(group); return { y: l.y, walk: l.walk, pools: l.pools, obstacles: [], group, uses: [] } })
    staticObs.length = 0
    levels.forEach(() => staticObs.push([]))
    animated.length = 0
    const A: Arch = {
      M, lv: levels,
      add: (l, o) => { o.traverse((c) => { c.userData.ghost = true }); levels[l]!.group.add(o) },
      block: (l, r) => { staticObs[l]!.push({ kind: 'box', x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, hx: (r.x1 - r.x0) / 2, hz: (r.z1 - r.z0) / 2 }) },
      use: (l, u) => { levels[l]!.uses.push(u) },
      slab: (l, r, hole, mat) => {
        const y = levels[l]!.y
        const parts: Rect[] = hole ? [R(r.x0, r.z0, r.x1, hole.z0), R(r.x0, hole.z1, r.x1, r.z1), R(r.x0, hole.z0, hole.x0, hole.z1), R(hole.x1, hole.z0, r.x1, hole.z1)] : [r]
        for (const p of parts) {
          const w = p.x1 - p.x0, d = p.z1 - p.z0
          if (w < 0.05 || d < 0.05) continue
          const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), mat ?? M.floor(w, d)); m.position.set(p.x0 + w / 2, y - 0.15, p.z0 + d / 2); m.receiveShadow = true
          A.add(l, m)
        }
      },
      wall: (l, x0, z0, x1, z1, h, mat, gaps = []) => {
        const y = levels[l]!.y
        const alongX = z0 === z1
        const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1)
        const segs: Array<[number, number]> = []
        let cur = a0
        for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > cur) segs.push([cur, g0]); cur = Math.max(cur, g1) }
        if (cur < a1) segs.push([cur, a1])
        for (const [s0, s1] of segs) {
          const len = s1 - s0, mid = (s0 + s1) / 2
          const cx = alongX ? mid : x0, cz = alongX ? z0 : mid
          if (mat === 'glass') {
            const pane = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.03, h, alongX ? 0.03 : len), M.glass); pane.position.set(cx, y + h / 2, cz); pane.renderOrder = 3; A.add(l, pane)
            for (let k = 0; k <= Math.floor(len / 2.4); k++) { const at = s0 + Math.min(len, k * 2.4); const mu = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), M.frame); mu.position.set(alongX ? at : x0, y + h / 2, alongX ? z0 : at); A.add(l, mu) }
            const top = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.08, 0.08, alongX ? 0.08 : len), M.frame); top.position.set(cx, y + h, cz); A.add(l, top)
          } else {
            const w = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.24, h, alongX ? 0.24 : len), mat); w.position.set(cx, y + h / 2, cz); w.castShadow = true; w.receiveShadow = true; A.add(l, w)
          }
          staticObs[l]!.push({ kind: 'box', x: cx, z: cz, hx: alongX ? len / 2 : 0.15, hz: alongX ? 0.15 : len / 2 })
        }
      },
      rail: (l, x0, z0, x1, z1) => {
        const y = levels[l]!.y
        const alongX = z0 === z1
        const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0)
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
        const g = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.02, 1.05, alongX ? 0.02 : len), M.glass); g.position.set(cx, y + 0.525, cz); g.renderOrder = 3; A.add(l, g)
        const t = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.06, 0.05, alongX ? 0.06 : len), M.metal); t.position.set(cx, y + 1.07, cz); A.add(l, t)
        staticObs[l]!.push({ kind: 'box', x: cx, z: cz, hx: alongX ? len / 2 : 0.12, hz: alongX ? 0.12 : len / 2 })
      },
      pool: (l, r, edge) => {
        const y = levels[l]!.y
        const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2
        const depth = 1.3
        if (y === 0) {
          // On a lawn the ground plane would cover a sunken basin: show the water just above it, in a stone coping.
          const deep = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(0x1f86a8, 0.3)); deep.rotation.x = -Math.PI / 2; deep.position.set(cx, 0.014, cz); A.add(l, deep)
          for (const [bx, bz, bw, bd] of [[cx, r.z0 - 0.2, w + 0.8, 0.4], [cx, r.z1 + 0.2, w + 0.8, 0.4], [r.x0 - 0.2, cz, 0.4, d], [r.x1 + 0.2, cz, 0.4, d]] as const) { const c = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, bd), M.stone); c.position.set(bx, 0.04, bz); c.receiveShadow = true; A.add(l, c) }
          const wat = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.water.clone()); wat.rotation.x = -Math.PI / 2; wat.position.set(cx, 0.03, cz); wat.renderOrder = 2
          animateWater(wat, Math.max(1, Math.round(w / 3)))
          A.add(l, wat)
          return
        }
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), M.tile); bottom.position.set(cx, y - depth, cz); A.add(l, bottom)
        for (const side of ['x0', 'x1', 'z0', 'z1'] as const) {
          const along = side[0] === 'z'
          const top = side === edge ? y - 0.07 : y
          const s = new THREE.Mesh(new THREE.BoxGeometry(along ? w : 0.12, top - (y - depth), along ? 0.12 : d), M.tile)
          s.position.set(side === 'x0' ? r.x0 : side === 'x1' ? r.x1 : cx, (top + y - depth) / 2, side === 'z0' ? r.z0 : side === 'z1' ? r.z1 : cz)
          A.add(l, s)
        }
        const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.water.clone()); water.rotation.x = -Math.PI / 2; water.position.set(cx, y - 0.06, cz); water.renderOrder = 2
        animateWater(water, Math.max(1, Math.round(w / 3)))
        A.add(l, water)
      },
      lift: (x, z, lvls, label) => {
        const yLo = levels[lvls[0]!]!.y, yHi = levels[lvls[lvls.length - 1]!]!.y + 3.2
        const shaft = new THREE.Group()
        for (const [dx, dz, w, d] of [[-0.95, 0, 0.04, 1.9], [0.95, 0, 0.04, 1.9], [0, -0.95, 1.9, 0.04]] as const) { const pn = new THREE.Mesh(new THREE.BoxGeometry(w, yHi - yLo, d), M.glass); pn.position.set(x + dx, (yLo + yHi) / 2, z + dz); shaft.add(pn) }
        for (const [dx, dz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]] as const) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, yHi - yLo, 0.08), M.frame); post.position.set(x + dx, (yLo + yHi) / 2, z + dz); shaft.add(post) }
        shaft.traverse((c) => { c.userData.ghost = true })
        root!.add(shaft)
        const car = new THREE.Group()
        const floor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), M.metal); floor.position.y = -0.05; car.add(floor)
        const ceil = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.8), M.metal); ceil.position.y = 2.5; car.add(ceil)
        const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), M.glow); lamp.rotation.x = Math.PI / 2; lamp.position.y = 2.45; car.add(lamp)
        car.position.set(x, levels[plan!.spawn.lv]?.y ?? yLo, z)
        car.traverse((c) => { c.userData.ghost = true })
        root!.add(car)
        for (const l of lvls) {
          const i = lvls.indexOf(l)
          const to = i < lvls.length - 1 ? lvls[i + 1]! : lvls[0]!
          levels[l]!.uses.push({ id: `home-lift-${l}`, x, z: z + 1.6, r: 1.0, title: 'Glass lift', body: 'Ride between the floors.', enter: label(l, to), use: () => startMove({ from: { x, z: z + 0.15, y: levels[l]!.y }, to: { x, z: z + 0.15, y: levels[to]!.y }, t: 0, dur: 1.2 + Math.abs(levels[to]!.y - levels[l]!.y) * 0.25, toLv: to, car, carY0: levels[l]!.y, carY1: levels[to]!.y }) })
          staticObs[l]!.push({ kind: 'box', x, z: z - 0.95, hx: 1, hz: 0.1 }, { kind: 'box', x: x - 0.95, z, hx: 0.1, hz: 1 }, { kind: 'box', x: x + 0.95, z, hx: 0.1, hz: 1 })
        }
      },
      ride: (kind, a, b, lo, hi) => {
        const y0 = levels[lo]!.y, y1 = levels[hi]!.y
        const run = Math.hypot(b.x - a.x, b.z - a.z), rise = y1 - y0
        const len = Math.hypot(run, rise), ang = Math.atan2(rise, run), head = Math.atan2(b.x - a.x, b.z - a.z)
        const g = new THREE.Group(); g.position.set((a.x + b.x) / 2, (y0 + y1) / 2, (a.z + b.z) / 2); g.rotation.y = head
        const incl = new THREE.Group(); incl.rotation.x = -ang; g.add(incl)
        const truss = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, len), kind === 'esc' ? M.metal : M.wood); truss.position.y = -0.3; incl.add(truss)
        const n = Math.round(len / 0.42)
        const steps: THREE.Mesh[] = []
        for (let k = 0; k < n; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.38), kind === 'esc' ? M.frame : M.wood); st.position.set(0, 0.0, -len / 2 + (k + 0.5) * (len / n)); st.castShadow = true; incl.add(st); steps.push(st) }
        if (kind === 'esc') {
          for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, len), M.glass); side.position.set(s * 0.58, 0.45, 0); incl.add(side); const hr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, len + 0.4), M.black); hr.position.set(s * 0.58, 0.93, 0); incl.add(hr) }
          animated.push({ tick: (t) => { for (let k = 0; k < steps.length; k++) steps[k]!.position.z = -len / 2 + ((((k + 0.5) * (len / n) + t * 0.5) % len + len) % len) } })
        }
        g.traverse((c) => { c.userData.ghost = true })
        root!.add(g)
        const word = kind === 'esc' ? 'escalator' : 'stairs'
        const dur = kind === 'esc' ? len / 2.6 : len / 2.4
        levels[lo]!.uses.push({ id: `home-${word}-up`, x: a.x - Math.sin(head) * 0.9, z: a.z - Math.cos(head) * 0.9, r: 1.0, title: kind === 'esc' ? 'Escalator' : 'Stairs', body: 'Up to the next floor.', enter: kind === 'esc' ? 'Ride the escalator up' : 'Take the stairs up', use: () => startMove({ from: { x: a.x, z: a.z, y: y0 }, to: { x: b.x, z: b.z, y: y1 }, t: 0, dur, toLv: hi }) })
        levels[hi]!.uses.push({ id: `home-${word}-down`, x: b.x + Math.sin(head) * 0.9, z: b.z + Math.cos(head) * 0.9, r: 1.0, title: kind === 'esc' ? 'Escalator' : 'Stairs', body: 'Down to the floor below.', enter: kind === 'esc' ? 'Ride the escalator down' : 'Take the stairs down', use: () => startMove({ from: { x: b.x, z: b.z, y: y1 }, to: { x: a.x, z: a.z, y: y0 }, t: 0, dur, toLv: lo }) })
        // The top landing and the run itself are not floor on the upper level, nor walkable below.
        staticObs[hi]!.push({ kind: 'box', x: (a.x + b.x) / 2 - Math.sin(head) * 0.6, z: (a.z + b.z) / 2 - Math.cos(head) * 0.6, hx: Math.abs(Math.sin(head)) * (run / 2) + 0.7, hz: Math.abs(Math.cos(head)) * (run / 2) + 0.7 })
        staticObs[lo]!.push({ kind: 'box', x: (a.x + b.x) / 2 + Math.sin(head) * 1.2, z: (a.z + b.z) / 2 + Math.cos(head) * 1.2, hx: Math.abs(Math.sin(head)) * (run / 2 - 1.2) + 0.7, hz: Math.abs(Math.cos(head)) * (run / 2 - 1.2) + 0.7 })
      },
    }
    plan.build(A)
    if (plan.id === 'park') { parkRides(A); parkThrills(A); buildParkPlus(A, { ...travel, fare, charge, onRelabel: (f) => { relabelHooks.push(f) } }) }
    if (plan.id === 'airport') buildAirport(A, travel)
    if (plan.id === 'yacht') buildYacht(A, travel)
    // Everything in an area is scenery to the camera (people load in later and mark themselves).
    root!.traverse((c) => { c.userData.ghost = true })
    // Everyday uses on top of the plan's: sleep in the bed, cook at the kitchen.
    const layout = isPublic(plan.id) ? {} : readHomes().layout[plan.id as HomeId] ?? {}
    const luxe = viewing || isPublic(plan.id) ? [] : readHomes().luxe[plan.id as HomeId] ?? []
    pieces = plan.pieces.map(([key, kind, x, z, r, lv]) => ({ key, kind, x, z, r, lv }))
    // Premium pieces go in free spots on the main floor; their place is remembered once moved.
    const main = levels[plan.spawn.lv]!.walk
    luxe.forEach((id, i) => {
      const cols = 4
      const x = main.x0 + 2 + ((i % cols) + 0.5) * ((Math.min(main.x1, main.x0 + 20) - main.x0 - 4) / cols)
      const z = (plan!.house ? plan!.house.z0 + 2.5 : main.z0 + 2.5) + Math.floor(i / cols) * 2.2
      pieces.push({ key: `luxe-${id}`, kind: id as Kind, x, z, r: 0, lv: plan!.spawn.lv })
    })
    for (const p of pieces) { const l = layout[p.key]; if (l && !viewing) { p.x = l[0]; p.z = l[1]; p.r = l[2] } }
    for (const p of pieces) {
      p.obj = piece(p.kind, M)
      p.obj.traverse((c) => { c.userData.ghost = true; c.userData.pieceKey = p.key })
      levels[p.lv]!.group.add(p.obj)
      placePiece(p)
      if (p.kind === 'bed') levels[p.lv]!.uses.push({ id: `home-bed-${p.key}`, x: p.x + Math.sin(p.r) * 1.5, z: p.z + Math.cos(p.r) * 1.5, r: 1.1, title: 'Bed', body: 'A proper night\'s sleep.', enter: 'Sleep', use: () => { deps.toast(adjust({ energy: 60 }) || 'Rested.') } })
      if (p.kind === 'island') levels[p.lv]!.uses.push({ id: `home-cook-${p.key}`, x: p.x + Math.sin(p.r + Math.PI / 2) * 1.1, z: p.z + Math.cos(p.r + Math.PI / 2) * 1.1, r: 1.0, title: 'Kitchen', body: 'Cook something good.', enter: 'Cook a meal', use: () => { deps.toast(adjust({ hunger: 45 }) || 'Fed.') } })
      if (p.kind === 'aquarium' || p.kind === 'fireplace') animated.push({ tick: (t) => p.obj!.traverse((c) => { if (c.userData.fish !== undefined) c.position.x = -0.9 + ((c.userData.fish as number) * 0.45 + t * 0.12 * (1 + (c.userData.fish as number) % 2)) % 1.9; if (c.userData.flame) c.scale.y = 0.85 + Math.sin(t * 9) * 0.12 }) })
    }
    rebuildObstacles()
    for (const L of levels) for (const u of L.uses) if (u.id === 'home-exit') u.use = () => deps.leave()
    root.add(selRing)
    if (!light.userData.held) root.add(light)
    scene.add(root)
    showLevels()
  }
  const dispose3d = () => {
    for (const f of cleanups.splice(0)) { try { f() } catch { /* already gone */ } }
    flying = false
    if (!root) return
    scene.remove(root)
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material as THREE.Material | THREE.Material[]; for (const x of Array.isArray(mm) ? mm : [mm]) x.dispose() } })
    root = null
  }
  const outsideHouse = (x: number, z: number) => !!plan?.house && (x < plan.house.x0 || x > plan.house.x1 || z < plan.house.z0 || z > plan.house.z1)
  let lastOutside = false
  const showLevels = (x = 0, z = 0) => {
    const out = level === 0 && outsideHouse(x, z)
    levels.forEach((L, i) => { L.group.visible = i <= level || out })
    lastOutside = out
    if (plan && !light.userData.held) { const L = levels[level]!; light.position.set((L.walk.x0 + L.walk.x1) / 2, L.y + 2.8, (L.walk.z0 + L.walk.z1) / 2); light.intensity = plan.house && level === 0 ? 4 : 7 }
  }
  // --- Grind Park tickets: a day pass at the gate covers every ride today; without one, each ride has its fare.
  const PASS_USD = 100
  const passKey = () => `${slotKey()}.park`
  const today = () => new Date().toLocaleDateString('en-CA')
  const hasPass = () => { try { return (JSON.parse(localStorage.getItem(passKey()) ?? '{}') as { pass?: string }).pass === today() } catch { return false } }
  const fare = (usd: number) => (hasPass() ? 'day pass' : `$${usd}`)
  const charge = (usd: number, label: string): { ok: boolean; message: string } => (hasPass() ? { ok: true, message: '' } : spendInGame(usd, label, 'Grind Park'))
  const fareSpots: Array<{ u: Hotspot; words: string; usd: number }> = []
  const relabelHooks: Array<() => void> = []
  const relabel = () => { for (const f of fareSpots) f.u.enter = `${f.words} · ${fare(f.usd)}`; activeLabelBump++; relabelExtra(); for (const h of relabelHooks) h() }
  let activeLabelBump = 0
  void activeLabelBump
  const buyPass = () => {
    if (hasPass()) { deps.toast('Your day pass covers every ride today.'); return }
    const paid = spendInGame(PASS_USD, 'Grind Park day pass', 'Every ride, all day')
    if (!paid.ok) { deps.toast(paid.message); return }
    try { localStorage.setItem(passKey(), JSON.stringify({ pass: today() })) } catch { /* private mode */ }
    relabel()
    deps.toast('Day pass on your wrist: the coaster, both slides, the Ferris wheel, the carousel and the zoo\'s safari tram are yours all day.')
  }
  // The wind on fast rides: filtered noise that rises with speed.
  let windCtx: AudioContext | null = null, windGain: GainNode | null = null, windFilter: BiquadFilterNode | null = null
  const wind = (speed: number) => {
    try {
      if (!windCtx) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!C) return
        windCtx = new C()
        const buf = windCtx.createBuffer(1, windCtx.sampleRate * 2, windCtx.sampleRate)
        const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
        const src = windCtx.createBufferSource(); src.buffer = buf; src.loop = true
        windFilter = windCtx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.Q.value = 0.7
        windGain = windCtx.createGain(); windGain.gain.value = 0
        src.connect(windFilter).connect(windGain).connect(windCtx.destination); src.start()
      }
      if (windCtx.state === 'suspended') void windCtx.resume().catch(() => undefined)
      const t = windCtx.currentTime
      windFilter!.frequency.setTargetAtTime(300 + speed * 60, t, 0.1)
      windGain!.gain.setTargetAtTime(Math.min(0.22, speed * 0.012), t, 0.15)
    } catch { /* no audio */ }
  }

  /** A track or chute swept along a curve: a cross-section (sideways, up) carried along it. */
  const sweep = (curve: THREE.Curve<THREE.Vector3>, segs: number, profile: Array<[number, number]>, closed: boolean): THREE.BufferGeometry => {
    const pos: number[] = [], idx: number[] = []
    const P = profile.length
    const t = new THREE.Vector3(), n = new THREE.Vector3(), b = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i <= segs; i++) {
      const u = i / segs
      const p = curve.getPointAt(u); curve.getTangentAt(u, t)
      n.crossVectors(upv, t); if (n.lengthSq() < 1e-6) n.set(1, 0, 0); n.normalize()
      b.crossVectors(t, n).normalize()
      for (const [lx, ly] of profile) pos.push(p.x + n.x * lx + b.x * ly, p.y + n.y * lx + b.y * ly, p.z + n.z * lx + b.z * ly)
      if (i < segs) for (let k = 0; k < P - (closed ? 0 : 1); k++) { const a = i * P + k, c = i * P + ((k + 1) % P), dd = (i + 1) * P + k, e = (i + 1) * P + ((k + 1) % P); idx.push(a, dd, c, c, dd, e) }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals()
    return g
  }
  /** Time table for a run down a curve: gravity speeds you up, friction takes a little; a chain pulls you up a lift. */
  const runTable = (curve: THREE.Curve<THREE.Vector3>, opts: { v0: number; lift?: [number, number]; liftV?: number; brakeFrom?: number; friction: number; minV: number }) => {
    const L = curve.getLength()
    const yAt = (s: number) => curve.getPointAt(Math.min(1, Math.max(0, s / L))).y
    let s = 0, v = opts.v0, t = 0
    let topY = yAt(0), topV = opts.v0
    const times: number[] = [0], dists: number[] = [0]
    const dt = 1 / 60
    while (s < L && t < 240) {
      const onLift = opts.lift && s >= opts.lift[0] && s <= opts.lift[1]
      if (onLift) { v = opts.liftV ?? 3; topY = yAt(s); topV = v }
      else {
        const e = topV * topV + 2 * 9.81 * (topY - yAt(s)) * opts.friction
        v = Math.max(opts.minV, Math.sqrt(Math.max(0, e)))
        if (opts.brakeFrom !== undefined && s > opts.brakeFrom) v = Math.max(1.2, v * (1 - (s - opts.brakeFrom) / (L - opts.brakeFrom)) + 1.2)
      }
      s = Math.min(L, s + v * dt); t += dt
      times.push(t); dists.push(s)
    }
    const T = t
    const at = (time: number) => { const k = Math.min(times.length - 1, Math.max(0, Math.round((time / T) * (times.length - 1)))); return dists[k]! }
    return { L, T, at }
  }
  const frameAt = (curve: THREE.Curve<THREE.Vector3>, u: number) => {
    const p = curve.getPointAt(Math.min(1, Math.max(0, u))), t = curve.getTangentAt(Math.min(1, Math.max(0, u)))
    return { p, t, heading: Math.atan2(t.x, t.z), pitch: Math.asin(Math.max(-1, Math.min(1, t.y))) }
  }

  /** The roller coaster, the speed slide and the tube slide, and the gate where the day pass is sold. */
  const parkThrills = (A: Arch) => {
    const M = A.M
    const L0 = levels[0]!
    fareSpots.length = 0
    relabelHooks.length = 0
    relabelExtra = () => {}
    // --- Gate: an arch over the path from the station, with the pass desk.
    {
      const gate = new THREE.Group()
      for (const sx of [-3.2, 3.2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), std(0xf2f2ee, 0.5)); post.position.set(sx, 2.5, 0); gate.add(post) }
      const c = document.createElement('canvas'); c.width = 512; c.height = 96
      const g = c.getContext('2d')!; g.fillStyle = '#123524'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#ffd36b'; g.font = '900 60px "Inter Variable", Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GRIND PARK', 256, 52)
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace
      const sign = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.3, 0.3), [std(0x123524), std(0x123524), std(0x123524), std(0x123524), std(0xffffff, 0.5, 0, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 }), std(0xffffff, 0.5, 0, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3 })])
      sign.position.y = 5.4; gate.add(sign)
      const booth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.4), std(0xe0457b, 0.6)); booth.position.set(4.6, 1.1, 0); gate.add(booth)
      gate.position.set(-121, 0, 128.5); gate.rotation.y = -0.9
      A.add(0, gate)
      A.block(0, R(-123.6, 129.6, -121.4, 131.4))
      const u: Hotspot = { id: 'park-gate', x: -119.6, z: 127.4, r: 1.8, title: 'Grind Park gate', body: `A day pass covers every ride today: the roller coaster, both water slides, the Ferris wheel, the carousel and the safari tram at the zoo. Or pay at each ride.`, enter: '', use: () => buyPass() }
      const paint = () => { u.enter = hasPass() ? 'Day pass: valid today' : `Buy a day pass · $${PASS_USD}` }
      paint()
      L0.uses.push(u)
      relabelExtra = paint
    }

    // --- Roller coaster: lift hill, a big drop, a climb, a tight turn and a camel hump, then brakes into the station.
    const pts: Array<[number, number, number]> = [
      [-176, 1.6, 110], [-176, 1.6, 122], [-176, 9, 136], [-176.5, 20, 150], [-179, 22.5, 158], [-186, 22.5, 163], [-193, 19, 162],
      [-200, 4, 150], [-203, 6, 134], [-200, 14, 124], [-196, 9, 114], [-201, 3.5, 106], [-192, 5, 103], [-184, 2.4, 104], [-178, 1.7, 106],
    ]
    const track = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal')
    const TL = track.getLength()
    const railM = std(0xd8263a, 0.35, 0.6), steelM = std(0x9aa0a8, 0.4, 0.7)
    const segs = Math.round(TL * 1.5)
    const railsG = new THREE.Group()
    for (const side of [-0.55, 0.55]) { const prof: Array<[number, number]> = []; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; prof.push([side + Math.cos(a) * 0.08, Math.sin(a) * 0.08]) } railsG.add(new THREE.Mesh(sweep(track, segs, prof, true), railM)) }
    railsG.add(new THREE.Mesh(sweep(track, segs, [[-0.16, -0.25], [0.16, -0.25], [0.16, -0.55], [-0.16, -0.55]], true), steelM))
    // Ties and supports.
    const nTie = Math.floor(TL / 1.4)
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.08, 0.16), steelM, nTie)
    const supports: THREE.Matrix4[] = []
    const mm = new THREE.Matrix4(), nn = new THREE.Vector3(), bb = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0)
    for (let k = 0; k < nTie; k++) {
      const f = frameAt(track, k / nTie)
      nn.crossVectors(upv, f.t).normalize(); bb.crossVectors(f.t, nn).normalize()
      mm.makeBasis(nn, bb, f.t).setPosition(f.p.x - bb.x * 0.12, f.p.y - bb.y * 0.12, f.p.z - bb.z * 0.12)
      ties.setMatrixAt(k, mm)
      if (k % 3 === 0 && f.p.y > 2.2) supports.push(new THREE.Matrix4().makeScale(1, f.p.y - 0.5, 1).setPosition(f.p.x, 0, f.p.z))
    }
    const sup = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.22, 1, 8).translate(0, 0.5, 0), std(0xf2f2ee, 0.5, 0.3), supports.length)
    supports.forEach((m, k) => { sup.setMatrixAt(k, m); A.block(0, R(m.elements[12] - 0.35, m.elements[14] - 0.35, m.elements[12] + 0.35, m.elements[14] + 0.35)) })
    for (const o of [ties, sup]) { o.castShadow = true; railsG.add(o) }
    railsG.traverse((o) => { o.castShadow = true })
    A.add(0, railsG)
    const stationDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 14), std(0xd8d1c3, 0.8)); stationDeck.position.set(-173.4, 0.7, 116); A.add(0, stationDeck)
    const stationRoof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 15), std(0xd8263a, 0.6)); stationRoof.position.set(-175, 4.6, 116); A.add(0, stationRoof)
    for (const z of [109.5, 122.5]) for (const x of [-172, -178]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.6, 0.2), steelM); c.position.set(x, 2.3, z); A.add(0, c) }
    A.block(0, R(-178.2, 108, -171.8, 124))
    // The train: three cars with high backs and lap bars.
    const carCols = [0xf2c230, 0x2f7ae5, 0x2bd46b]
    const cars: THREE.Object3D[] = []
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.9), std(carCols[k]!, 0.35, 0.3)); body.position.y = 0.45; c.add(body)
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.18), std(0x1b1c1f, 0.6)); back.position.set(0, 0.95, -0.7); c.add(back)
      const bar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 16, Math.PI), steelM); bar.position.set(0, 0.85, 0.35); bar.rotation.y = Math.PI / 2; c.add(bar)
      if (k === 0) { const nose = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.9, 4), std(carCols[0]!, 0.35, 0.3)); nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4; nose.position.set(0, 0.45, 1.3); c.add(nose) }
      c.matrixAutoUpdate = false
      c.traverse((o) => { o.castShadow = true; o.userData.ghost = true })
      root!.add(c); cars.push(c)
    }
    const coaster = runTable(track, { v0: 1.5, lift: [TL * 0.06, TL * 0.24], liftV: 3.2, brakeFrom: TL * 0.88, friction: 0.93, minV: 3 })
    const DWELL = 6
    let coasterT0 = time
    const coasterS = (t: number) => { const c = (((t - coasterT0) % (coaster.T + DWELL)) + coaster.T + DWELL) % (coaster.T + DWELL); return c < DWELL ? 0 : coaster.at(c - DWELL) }
    const placeCars = (t: number) => {
      const s0 = coasterS(t)
      cars.forEach((c, k) => {
        const u = (((s0 - k * 2.2) / TL) % 1 + 1) % 1
        const f = frameAt(track, u)
        nn.crossVectors(upv, f.t).normalize(); bb.crossVectors(f.t, nn).normalize()
        c.matrix.makeBasis(nn, bb, f.t).setPosition(f.p.x + bb.x * 0.05, f.p.y + bb.y * 0.05, f.p.z + bb.z * 0.05)
        c.matrixWorldNeedsUpdate = true
      })
    }
    animated.push({ tick: (t) => placeCars(t) })
    const coasterSpot: Hotspot = { id: 'park-coaster', x: -171, z: 116, r: 2.0, title: 'Roller coaster', body: 'A chain lift to 22 m, a big first drop, a climb, a tight turn and a camel hump. Hold on.', enter: '', use: () => {
      const paid = charge(5, 'Roller coaster ride')
      if (!paid.ok) { deps.toast(paid.message); return }
      // The train waits in the station for you, then leaves at once.
      coasterT0 = time - DWELL + 1.2
      const t0 = time
      startMove({
        cam: 6.8,
        view: () => { const f = frameAt(track, ((coasterS(time) / TL) % 1 + 1) % 1); return { heading: f.heading, pitch: Math.max(0.22, Math.min(0.55, -f.pitch * 0.5 + 0.26)) } },
        path: () => { const f = frameAt(track, (((coasterS(time) - 0.9) / TL) % 1 + 1) % 1); nn.crossVectors(upv, f.t).normalize(); bb.crossVectors(f.t, nn).normalize(); const sp = coaster.at(Math.max(0, time - t0 - 1.2) + 0.016) - coaster.at(Math.max(0, time - t0 - 1.2)); wind(sp * 60); return { x: f.p.x + bb.x * 0.15, z: f.p.z + bb.z * 0.15, y: f.p.y + bb.y * 0.15 } },
        seat: () => { const f = frameAt(track, (((coasterS(time) - 0.9) / TL) % 1 + 1) % 1); return { yaw: f.heading, y: 0.45 } },
        from: { x: -175, z: 112, y: 0 }, to: { x: -171, z: 116, y: 0 }, t: 0, dur: coaster.T + 1.2, toLv: 0,
        done: () => { wind(0); deps.toast(adjust({ social: 8 }, 'quiet') || 'What a ride!') },
      })
      deps.toast('Lap bar down. Here comes the lift hill.')
    } }
    fareSpots.push({ u: coasterSpot, words: 'Ride the roller coaster', usd: 5 })
    L0.uses.push(coasterSpot)

    // --- Water slides from a 14 m tower into a splash pool: a straight speed slide and a winding tube slide.
    const TW = { x: -150, z: 182, top: 14.2 }
    const tower = new THREE.Group()
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]] as const) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, TW.top + 1.2, 0.3), std(0xf2f2ee, 0.5)); p.position.set(TW.x + dx, (TW.top + 1.2) / 2, TW.z + dz); tower.add(p) }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), std(0x2f7ae5, 0.5)); deck.position.set(TW.x, TW.top - 0.15, TW.z); tower.add(deck)
    const roofT = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 4), std(0xf2c230, 0.6)); roofT.rotation.y = Math.PI / 4; roofT.position.set(TW.x, TW.top + 2.4, TW.z); tower.add(roofT)
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.1, 0.5), std(0xd8d1c3, 0.7), 48)
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 4; steps.setMatrixAt(k, new THREE.Matrix4().makeRotationY(-a).setPosition(TW.x + Math.cos(a) * 2.4, (k / 48) * TW.top, TW.z + Math.sin(a) * 2.4)) }
    tower.add(steps)
    tower.traverse((o) => { o.castShadow = true })
    A.add(0, tower)
    A.block(0, R(TW.x - 1.9, TW.z - 1.9, TW.x + 1.9, TW.z + 1.9))
    const pool = R(-146, 184, -130, 197)
    A.pool(0, pool, 'z1')
    L0.pools.push(pool)
    const speed = new THREE.CatmullRomCurve3([[-148.2, 14.25, 182.4], [-146, 11, 183.4], [-144.4, 6.5, 184.6], [-142.6, 2.4, 186], [-141.2, 0.6, 187], [-139.6, 0.25, 188]].map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal')
    const tube = new THREE.CatmullRomCurve3([[-151.6, 14.25, 180.3], [-156, 13.4, 178.6], [-160.4, 12.2, 182], [-161, 10.8, 188.6], [-157, 9.4, 195], [-150, 8, 199.6], [-142, 6.4, 201], [-135, 4.6, 199], [-131.6, 2.8, 194.6], [-132.6, 1.2, 191.4], [-135.6, 0.3, 190.2]].map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal')
    const chuteM = std(0xffffff, 0.25, 0.1, { side: THREE.DoubleSide })
    const speedMesh = new THREE.Mesh(sweep(speed, 60, [[-0.7, 0.55], [-0.66, 0.12], [-0.4, -0.04], [0, -0.1], [0.4, -0.04], [0.66, 0.12], [0.7, 0.55]], false), std(0xe0457b, 0.3, 0.1, { side: THREE.DoubleSide }))
    const tubeProf: Array<[number, number]> = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; tubeProf.push([Math.cos(a) * 0.9, 0.45 + Math.sin(a) * 0.9]) }
    const tubeMesh = new THREE.Mesh(sweep(tube, 160, tubeProf, true), std(0x2f9be0, 0.2, 0.1, { side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }))
    tubeMesh.renderOrder = 3
    for (const o of [speedMesh, tubeMesh]) { o.castShadow = true; A.add(0, o) }
    void chuteM
    // Slide supports.
    const slideSup: THREE.Matrix4[] = []
    for (const [c, n] of [[speed, 4], [tube, 12]] as const) for (let k = 1; k < n; k++) { const p = c.getPointAt(k / n); if (p.y > 1.2) slideSup.push(new THREE.Matrix4().makeScale(1, p.y - 0.4, 1).setPosition(p.x, 0, p.z)) }
    const ss = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1, 8).translate(0, 0.5, 0), std(0xf2f2ee, 0.5, 0.3), slideSup.length)
    slideSup.forEach((m, k) => { ss.setMatrixAt(k, m); if (!(m.elements[12] > pool.x0 && m.elements[12] < pool.x1 && m.elements[14] > pool.z0 && m.elements[14] < pool.z1)) A.block(0, R(m.elements[12] - 0.3, m.elements[14] - 0.3, m.elements[12] + 0.3, m.elements[14] + 0.3)) })
    A.add(0, ss)
    // A ride: climb the tower stairs, then slide down into the pool.
    const slideRide = (curve: THREE.CatmullRomCurve3, words: string, usd: number, startA: number) => {
      const run = runTable(curve, { v0: 1.2, friction: 0.82, minV: 1.5 })
      const CLIMB = 4
      return () => {
        const paid = charge(usd, words)
        if (!paid.ok) { deps.toast(paid.message); return }
        const t0 = time
        startMove({
          cam: 5.6,
          camFn: () => (time - t0 < CLIMB ? 10 : 5.6),
          seat: () => { const tt = time - t0; if (tt < CLIMB) return null; const f = frameAt(curve, run.at(tt - CLIMB) / run.L); return { yaw: f.heading, y: 0.35 } },
          view: () => { const tt = time - t0; if (tt < CLIMB) return { heading: Math.atan2(TW.x - (-138), TW.z - 190), pitch: 0.5 }; const f = frameAt(curve, run.at(tt - CLIMB) / run.L); return { heading: f.heading, pitch: Math.max(-0.4, Math.min(0.5, -f.pitch * 0.5 + 0.18)) } },
          path: () => {
            const tt = time - t0
            if (tt < CLIMB) { const a = (tt / CLIMB) * Math.PI * 4 + startA; return { x: TW.x + Math.cos(a) * 2.4, z: TW.z + Math.sin(a) * 2.4, y: (tt / CLIMB) * TW.top } }
            const s = run.at(tt - CLIMB), f = frameAt(curve, s / run.L)
            const sp = run.at(tt - CLIMB + 0.016) - s
            wind(sp * 60)
            return { x: f.p.x, z: f.p.z, y: f.p.y - 0.25 }
          },
          from: { x: TW.x, z: TW.z, y: 0 }, to: { x: TW.x, z: TW.z, y: 0 }, t: 0, dur: CLIMB + run.T, toLv: 0,
          done: () => { wind(0); deps.toast(adjust({ hygiene: 12, social: 6 }, 'quiet') || 'Splash!') },
        })
        deps.toast('Up the tower stairs…')
      }
    }
    const sp1: Hotspot = { id: 'park-speedslide', x: TW.x + 2.6, z: TW.z - 2.6, r: 1.6, title: 'Speed slide', body: 'Fourteen metres, nearly straight down, into the splash pool.', enter: '', use: slideRide(speed, 'Speed slide', 3, 0) }
    const sp2: Hotspot = { id: 'park-tubeslide', x: TW.x - 2.6, z: TW.z - 2.6, r: 1.6, title: 'Tube slide', body: 'A long winding tunnel from the top of the tower to the splash pool.', enter: '', use: slideRide(tube, 'Tube slide', 3, Math.PI) }
    fareSpots.push({ u: sp1, words: 'Ride the speed slide', usd: 3 }, { u: sp2, words: 'Ride the tube slide', usd: 3 })
    L0.uses.push(sp1, sp2)
    // Loungers round the splash pool.
    for (const [x, z] of [[-150, 190], [-150, 193], [-127, 186], [-127, 189]] as const) { const lg = piece('lounger', M); lg.position.set(x, 0, z); lg.rotation.y = x < -140 ? Math.PI / 2 : -Math.PI / 2; lg.traverse((o) => { o.userData.ghost = true }); A.add(0, lg) }
    // The Ferris wheel and the carousel follow the day pass too.
    for (const [id, words, usd] of [['park-wheel', 'Ride the Ferris wheel', 3], ['park-carousel', 'Ride the carousel', 2]] as const) { const u = L0.uses.find((x) => x.id === id); if (u) fareSpots.push({ u, words, usd }) }
    relabel()
  }
  let relabelExtra = () => {}

  /** The Ferris wheel and the carousel: they turn all the time; the gold button rides one round. */
  const parkRides = (A: Arch) => {
    const M = A.M
    // Ferris wheel: two rims and spokes turning about an axis along x, sixteen cabins that stay upright.
    const W = { x: -150, z: 150, hub: 15.5, r: 13, n: 16, period: 36 }
    const legs = new THREE.Group()
    for (const sx of [-1.6, 1.6]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, W.hub + 1.5, 10), M.metal); l.position.set(W.x + sx, (W.hub + 1.5) / 2, W.z + sz * 4.2); l.rotation.x = sz * -0.27; l.castShadow = true; legs.add(l) }
    const plat = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 6), A.M.stone); plat.position.set(W.x, 0.15, W.z); legs.add(plat)
    A.add(0, legs)
    const wheel = new THREE.Group(); wheel.position.set(W.x, W.hub, W.z)
    for (const sx of [-1.2, 1.2]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(W.r, 0.14, 8, 64), std(0xf2f2ee, 0.4, 0.3)); rim.rotation.y = Math.PI / 2; rim.position.x = sx; wheel.add(rim)
      for (let k = 0; k < W.n; k++) { const a = (k / W.n) * Math.PI * 2; const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, W.r, 0.08), std(0xf2f2ee, 0.4, 0.3)); sp.position.set(sx, Math.sin(a) * W.r / 2, Math.cos(a) * W.r / 2); sp.rotation.x = -a + Math.PI / 2; wheel.add(sp) }
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3.4, 16), M.metal); hub.rotation.z = Math.PI / 2; wheel.add(hub)
    // A string of lights round the rim.
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }), 64)
    const mm = new THREE.Matrix4(); for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; bulbs.setMatrixAt(k, mm.makeTranslation(1.35, Math.sin(a) * W.r, Math.cos(a) * W.r)) } wheel.add(bulbs)
    wheel.traverse((c) => { c.userData.ghost = true })
    root!.add(wheel)
    const cabinCols = [0xe0457b, 0x2bd46b, 0x3b82f6, 0xf2c230]
    const cabins: THREE.Group[] = []
    for (let k = 0; k < W.n; k++) {
      const c = new THREE.Group()
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 1.6, 12), std(cabinCols[k % 4]!, 0.4, 0.2)); body.position.y = -1.5; c.add(body)
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.6, 12), std(0xf2f2ee, 0.4)); top.position.y = -0.4; c.add(top)
      const glassBand = new THREE.Mesh(new THREE.CylinderGeometry(1.01, 1.01, 0.6, 12, 1, true), M.glass); glassBand.position.y = -1.2; c.add(glassBand)
      c.traverse((o) => { o.userData.ghost = true; o.castShadow = true })
      root!.add(c); cabins.push(c)
    }
    const wheelAngle = (t: number) => (t / W.period) * Math.PI * 2
    const cabinAt = (k: number, t: number) => { const a = wheelAngle(t) + (k / W.n) * Math.PI * 2; return { x: W.x, y: W.hub - Math.cos(a) * W.r, z: W.z + Math.sin(a) * W.r } }
    animated.push({ tick: (t) => { wheel.rotation.x = -wheelAngle(t); cabins.forEach((c, k) => { const p = cabinAt(k, t); c.position.set(p.x, p.y, p.z) }) } })
    A.block(0, R(W.x - 3.5, W.z - 5, W.x + 3.5, W.z + 5))
    levels[0]!.uses.push({ id: 'park-wheel', x: W.x + 4.6, z: W.z, r: 1.8, title: 'Ferris wheel', body: 'One slow turn, 29 m up at the top, with the whole city in view.', enter: `Ride the Ferris wheel · ${fare(3)}`, use: () => {
      const paid = charge(3, 'Ferris wheel ride')
      if (!paid.ok) { deps.toast(paid.message); return }
      // Board the cabin nearest the bottom; ride it once round, standing in it.
      let k0 = 0, best = Infinity
      for (let k = 0; k < W.n; k++) { const p = cabinAt(k, time); if (p.y < best) { best = p.y; k0 = k } }
      const t0 = time
      startMove({ cam: 17, seat: () => ({ yaw: Math.PI / 2, y: 0.45 }), path: () => { const p = cabinAt(k0, time); return { x: p.x, z: p.z, y: p.y - 2.3 } }, from: { x: W.x, z: W.z, y: 0 }, to: { x: W.x + 4.2, z: W.z, y: 0 }, t: 0, dur: W.period, toLv: 0 })
      void t0
      deps.toast('Hold on: one full turn of the Ferris wheel.')
    } })
    // Carousel: a striped canopy, twelve horses on brass poles rising and falling as it turns.
    const C = { x: -128, z: 150, r: 4.6, period: 12 }
    const caro = new THREE.Group(); caro.position.set(C.x, 0, C.z)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.4, 0.5, 32), std(0xf2e6cc, 0.6)); base.position.y = 0.25; caro.add(base)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4.2, 16), std(0xd4af37, 0.3, 0.8)); pole.position.y = 2.6; caro.add(pole)
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(7, 2.4, 24), std(0xd8263a, 0.7)); canopy.position.y = 5.6; caro.add(canopy)
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.5, 24, 1, true), std(0xf4f1ea, 0.6)); trim.position.y = 4.2; caro.add(trim)
    const spin = new THREE.Group(); caro.add(spin)
    const horses: THREE.Group[] = []
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      const h = new THREE.Group()
      const bodyH = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 10), std(k % 2 ? 0xf4f1ea : 0x8a5a3a, 0.5)); bodyH.rotation.z = Math.PI / 2; h.add(bodyH)
      const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.45, 4, 8), bodyH.material); neck.position.set(0.55, 0.35, 0); neck.rotation.z = -0.6; h.add(neck)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), bodyH.material); head.position.set(0.8, 0.6, 0); h.add(head)
      for (const lx of [-0.35, 0.35]) for (const lz of [-0.12, 0.12]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), bodyH.material); leg.position.set(lx, -0.45, lz); h.add(leg) }
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 6), std(0xd4af37, 0.3, 0.8)); p.position.y = 0.6; h.add(p)
      h.position.set(Math.cos(a) * C.r, 1.6, Math.sin(a) * C.r); h.rotation.y = -a
      spin.add(h); horses.push(h)
    }
    caro.traverse((o) => { o.userData.ghost = true; o.castShadow = true })
    A.add(0, caro)
    const caroAngle = (t: number) => (t / C.period) * Math.PI * 2
    animated.push({ tick: (t) => { spin.rotation.y = -caroAngle(t); horses.forEach((h, k) => { h.position.y = 1.5 + Math.sin(t * 2.2 + k) * 0.25 }) } })
    A.block(0, R(C.x - 6.4, C.z - 6.4, C.x + 6.4, C.z + 6.4))
    levels[0]!.uses.push({ id: 'park-carousel', x: C.x, z: C.z - 7.6, r: 1.8, title: 'Carousel', body: 'Two turns on a painted horse.', enter: `Ride the carousel · ${fare(2)}`, use: () => {
      const paid = charge(2, 'Carousel ride')
      if (!paid.ok) { deps.toast(paid.message); return }
      const k = 3
      startMove({ cam: 8.5, seat: () => { const a = (k / 12) * Math.PI * 2 + caroAngle(time); return { yaw: Math.atan2(-Math.sin(a), -Math.cos(a)), y: 0.45 } }, path: () => { const a = (k / 12) * Math.PI * 2 + caroAngle(time); return { x: C.x + Math.cos(a) * C.r, z: C.z - Math.sin(a) * C.r, y: 1.33 + Math.sin(time * 2.2 + k) * 0.25 } }, from: { x: C.x, z: C.z, y: 0 }, to: { x: C.x, z: C.z - 7.4, y: 0 }, t: 0, dur: C.period * 2, toLv: 0 })
    } })
    // Back to the city by train, an ice cream, a go on the swings.
    levels[0]!.uses.push({ id: 'park-train', x: -118.5, z: 121.5, r: 1.8, title: 'Grind Metro', body: 'Grind Park station. Trains round the city to the Beach, the Marina, the Raceway and the Sky Tower.', enter: 'Take the train · $2', use: () => deps.train('park') })
    levels[0]!.uses.push({ id: 'park-icecream', x: -128, z: 118.6, r: 1.6, title: 'Ice-cream kiosk', body: 'Three scoops in a waffle cone.', enter: 'Buy an ice cream · $3', use: () => { const paid = spendInGame(3, 'Ice cream', 'Grind Park'); deps.toast(paid.ok ? adjust({ hunger: 10, social: 4 }) || 'Lovely.' : paid.message) } })
    levels[0]!.uses.push({ id: 'park-swings', x: -116, z: 152.2, r: 1.6, title: 'Swings', body: 'Nobody is too old for the swings.', enter: 'Have a swing', use: () => { deps.toast(adjust({ social: 5 }, 'quiet') || 'Whee.') } })
  }
  const startMove = (m: Move) => {
    if (move) return
    if (arranging) setArranging(false)
    move = m
    levels.forEach((L) => { L.group.visible = true })
  }
  const travel: TravelCtx = {
    startMove, now: () => time, toast: deps.toast, fade: deps.fade, leave: deps.leave,
    train: () => deps.train(plan?.id === 'airport' ? 'airport' : 'park'),
    wind: (v) => wind(v), animate: (f) => { animated.push({ tick: f }) }, light,
    flying: (on) => { flying = on }, onLeave: (f) => { cleanups.push(f) },
  }

  const levelY = (x: number, z: number): number => {
    const L = levels[level]
    if (!L) return 0
    for (const p of L.pools) if (x > p.x0 + 0.2 && x < p.x1 - 0.2 && z > p.z0 + 0.2 && z < p.z1 - 0.2) {
      if (!swamToday) { swamToday = true; deps.toast(adjust({ hygiene: 15, energy: 6 }, 'quiet') || 'A swim. Fresh.') }
      return L.y - 0.95
    }
    return L.y
  }

  return {
    get inside() { return inside },
    get viewing() { return viewing },
    get arranging() { return arranging },
    get title() { return plan ? (plan.id === 'park' ? 'Grind Park' : plan.id === 'airport' ? 'Grind International Airport' : plan.id === 'yacht' ? 'Party yacht' : HOMES.find((h) => h.id === plan!.id)!.title) : '' },
    /** On a flight: the camera sees much further, the haze thins and the sky follows you up. */
    get flying() { return flying },
    /** Tests only: run rides and flights faster. */
    set turbo(n: number) { turbo = Math.max(1, Math.min(30, n)) },
    /** Metro pillars standing in the park. */
    setParkObstacles(o: Obstacle[]) { extraObs = o },
    /** Go into a home: build it, and return where to stand. */
    enter(id: AreaId, asViewing: boolean): { x: number; z: number; heading: number; y: number } {
      inside = id
      viewing = asViewing
      trying = null
      plan = P[id]
      level = plan.spawn.lv
      swamToday = false
      build()
      for (const n of ['shell-penthouse', 'shell-skyhouse']) { const o = scene.getObjectByName(n); if (o) o.visible = n !== `shell-${id}` }
      paintHud()
      const s = plan.spawn
      return { x: s.x, z: s.z, heading: s.heading, y: levels[level]!.y }
    },
    leave(): { x: number; z: number } {
      const out = plan?.exitTo ?? { x: 40, z: -27.2 }
      dispose3d()
      wind(0)
      for (const n of ['shell-penthouse', 'shell-skyhouse']) { const o = scene.getObjectByName(n); if (o) o.visible = true }
      inside = null; plan = null; levels = []; pieces = []; move = null; trying = null
      setArranging(false)
      hud.hidden = true
      return out
    },
    /** Try a look on (free, until you leave) or rebuild after buying or applying one. */
    tryStyle(id: StyleId | null) { if (!plan) return; trying = id; build(); deps.toast(id ? `Trying ${STYLES.find((s) => s.id === id)!.title}. Buy it in Styles to keep it.` : 'Look applied.') },
    restyle() { if (!plan) return; trying = null; build() },
    obstacles(): Obstacle[] { return levels[level]?.obstacles ?? [] },
    uses(): Hotspot[] { return move ? [] : levels[level]?.uses ?? [] },
    bounds(): { x: number; z: number; hw: number; hd: number } | null {
      const L = levels[level]
      if (!L) return null
      return { x: (L.walk.x0 + L.walk.x1) / 2, z: (L.walk.z0 + L.walk.z1) / 2, hw: (L.walk.x1 - L.walk.x0) / 2, hd: (L.walk.z1 - L.walk.z0) / 2 }
    },
    /** The height to stand at here (lower in a pool). */
    floorY(x: number, z: number): number { return levelY(x, z) },
    get moving() { return !!move },
    /** How far back the camera sits during a ride (the Ferris wheel, the carousel). */
    get rideCam(): number | null { return move?.camFn?.() ?? move?.cam ?? null },
    /** Seated on a ride: which way you face and how high the seat is above where you stand. */
    get rideSeat(): { yaw: number; y: number } | null { return move?.seat?.() ?? null },
    /** On the coaster and the slides the camera rides just behind you, looking where you are going. */
    get rideView(): { heading: number; pitch: number } | null { return move?.view?.() ?? null },
    /** Standing on a moving ride (the party jet's dance floor): which way to face. */
    get rideFace(): number | null { return move?.face?.() ?? null },
    /** Following something else (a golf ball): the player is out of sight until it stops. */
    get rideHidden(): boolean { return !!move?.hide },
    /** Animate the home; while a lift or escalator ride is on, return where the player is. */
    tick(dt: number, x: number, z: number): { x: number; z: number; y: number } | null {
      dt *= turbo
      time += dt
      for (const a of animated) a.tick(time)
      if (!move) {
        const out = level === 0 && outsideHouse(x, z)
        if (out !== lastOutside) showLevels(x, z)
        return null
      }
      move.t += dt
      const u = Math.min(1, move.t / move.dur)
      const e = u * u * (3 - 2 * u)
      let p = move.path ? move.path(u) : { x: move.from.x + (move.to.x - move.from.x) * e, z: move.from.z + (move.to.z - move.from.z) * e, y: move.from.y + (move.to.y - move.from.y) * e }
      if (move.car && move.carY0 !== undefined && move.carY1 !== undefined) move.car.position.y = move.carY0 + (move.carY1 - move.carY0) * e
      if (u >= 1) {
        level = move.toLv
        if (move.exit) p = { x: move.exit.x, z: move.exit.z, y: levels[level]!.y }
        const done = move.done
        move = null
        done?.()
        showLevels(p.x, p.z)
      }
      return p
    },
    /** Arrange mode: the first tap picks a piece, the next tap on the floor puts it there. */
    arrangeTap(ray: THREE.Raycaster, ground: THREE.Vector3 | null): void {
      if (!plan) return
      const hits = ray.intersectObjects(pieces.filter((p) => p.lv === level && p.obj).map((p) => p.obj!), true)
      const hitKey = hits.find((h) => h.object.userData.pieceKey)?.object.userData.pieceKey as string | undefined
      if (hitKey && (!selected || hitKey !== selected.key)) {
        selected = pieces.find((p) => p.key === hitKey) ?? null
      } else if (selected && ground) {
        const L = levels[level]!
        selected.x = THREE.MathUtils.clamp(ground.x, L.walk.x0 + 0.4, L.walk.x1 - 0.4)
        selected.z = THREE.MathUtils.clamp(ground.z, L.walk.z0 + 0.4, L.walk.z1 - 0.4)
        placePiece(selected)
        if (!isPublic(plan.id)) saveLayout(plan.id as HomeId, selected.key, selected.x, selected.z, selected.r)
        rebuildObstacles()
      }
      if (selected) {
        const L = levels[level]!
        selRing.visible = true
        const [w, d] = FOOT[selected.kind]
        selRing.scale.setScalar(Math.max(0.7, Math.hypot(w || 1, d || 1) / 2))
        selRing.position.set(selected.x, L.y + 0.04, selected.z)
      }
      paintHud()
    },
    dispose() { this.leave(); hud.remove() },
  }
}
export type Homes = ReturnType<typeof createHomes>
export const LUXE_IDS = LUXE.map((l) => l.id)
