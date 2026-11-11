// City architecture kit: every civic building, shop and house is built from the same parts and merged
// per material across the whole city (about a dozen draw calls in total, whatever the building count).
// Facades tile in metres (one window bay per texture cell), so windows never stretch or blur with size.
import * as THREE from 'three'
import { shrubGeometry } from './trees.ts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { paintFacets } from './facets.ts'

export type Door = 'px' | 'nx' | 'pz' | 'nz'
export type Style = 'civic' | 'glass' | 'brick' | 'arch' | 'pavilion' | 'kiosk' | 'house'
export type BuildingSpec = {
  x: number
  z: number
  w: number
  d: number
  h: number
  door: Door
  title: string
  seed?: number
  style?: Style
  /** Mint edge light instead of warm white (the Web3 desks). */
  mint?: boolean
  /** Upper floors above the shopfront podium. */
  floors?: number
  facade?: Facade
  sign?: boolean
}

const CELL = 128
const TILE = 4 // bays and floors per facade texture
const FLOOR = 3.2

export type Facade = 'stone' | 'brick' | 'glass' | 'render' | 'arch' | 'charcoal'

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (g) draw(g)
  return c
}

const WALL: Record<Facade, string> = {
  stone: '#d6ccba', brick: '#8f4f3c', glass: '#3c464e', render: '#ece6dc', arch: '#e3d5c4', charcoal: '#3a3836',
}

/** One facade texture set (albedo, lit windows, roughness): TILE x TILE window bays, each CELL px square. */
function paintFacade(kind: Facade, seed: number) {
  const S = CELL * TILE
  const r = rng(seed)
  const lit: boolean[] = []
  const blind: number[] = []
  for (let i = 0; i < TILE * TILE; i++) { lit.push(r() < 0.34); blind.push(r() < 0.45 ? r() * 0.45 : 0) }
  const cellRect = (cx: number, cy: number) => {
    // Window opening inside one cell (canvas y down; floor slab at the cell bottom).
    if (kind === 'glass') return { x: cx * CELL + 4, y: cy * CELL + 4, w: CELL - 8, h: CELL - 30 }
    if (kind === 'render') return { x: cx * CELL + 34, y: cy * CELL + 26, w: CELL - 68, h: 64 }
    if (kind === 'brick' || kind === 'charcoal') return { x: cx * CELL + 30, y: cy * CELL + 16, w: CELL - 60, h: 86 }
    if (kind === 'arch') return { x: cx * CELL + 32, y: cy * CELL + 14, w: CELL - 64, h: 90 }
    return { x: cx * CELL + 26, y: cy * CELL + 18, w: CELL - 52, h: 82 }
  }
  const archPath = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inset = 0) => {
    const rad = (w - inset * 2) / 2
    g.beginPath()
    g.moveTo(x + inset, y + h - inset)
    g.lineTo(x + inset, y + rad + inset)
    g.arc(x + w / 2, y + rad + inset, rad, Math.PI, 0)
    g.lineTo(x + w - inset, y + h - inset)
    g.closePath()
  }
  const albedo = canvas(S, S, (g) => {
    g.fillStyle = WALL[kind]
    g.fillRect(0, 0, S, S)
    if (kind === 'brick' || kind === 'charcoal') {
      // Running-bond brick: 10 px courses, per-brick tone, recessed mortar.
      const base = kind === 'brick' ? [143, 79, 60] : [58, 56, 54]
      for (let y = 0; y < S; y += 10) for (let x = -((y / 10) % 2) * 12; x < S; x += 24) {
        const k = 0.92 + r() * 0.14
        g.fillStyle = `rgb(${base[0]! * k | 0},${base[1]! * k | 0},${base[2]! * k | 0})`
        g.fillRect(x + 0.5, y + 0.5, 23, 9)
      }
    } else if (kind !== 'glass') {
      // Flat wall in big soft facets (about 1.5 m): planar and matte, like the rest of the city.
      const c = parseInt(WALL[kind].slice(1), 16)
      paintFacets(g, S, S, seed, 5, 0.075, [(c >> 16) & 255, (c >> 8) & 255, c & 255])
    }
    for (let cy = 0; cy < TILE; cy++) for (let cx = 0; cx < TILE; cx++) {
      const o = cellRect(cx, cy)
      const k = cy * TILE + cx
      if (kind !== 'glass') {
        // Floor slab line and a soft shadow under each sill.
        g.fillStyle = 'rgba(0,0,0,0.10)'
        g.fillRect(cx * CELL, cy * CELL + CELL - 4, CELL, 4)
      }
      if (kind === 'glass') {
        // Curtain wall: bronze mullions, spandrel band, sky reflection gradient.
        g.fillStyle = '#2b3036'
        g.fillRect(cx * CELL, cy * CELL + CELL - 26, CELL, 26)
        g.fillStyle = '#5b5248'
        g.fillRect(cx * CELL, cy * CELL + CELL - 27, CELL, 2)
      } else {
        // Deep reveal, then the frame.
        g.fillStyle = 'rgba(40,34,28,0.55)'
        if (kind === 'arch') { archPath(g, o.x - 4, o.y - 4, o.w + 8, o.h + 8); g.fill() } else g.fillRect(o.x - 4, o.y - 4, o.w + 8, o.h + 8)
      }
      const glass = g.createLinearGradient(0, o.y, 0, o.y + o.h)
      glass.addColorStop(0, '#c4d3da')
      glass.addColorStop(0.45, '#7c93a1')
      glass.addColorStop(1, '#3f505c')
      g.fillStyle = glass
      if (kind === 'arch') { archPath(g, o.x, o.y, o.w, o.h); g.fill() } else g.fillRect(o.x, o.y, o.w, o.h)
      // Sky streak.
      g.save()
      if (kind === 'arch') { archPath(g, o.x, o.y, o.w, o.h); g.clip() } else { g.beginPath(); g.rect(o.x, o.y, o.w, o.h); g.clip() }
      g.fillStyle = 'rgba(255,255,255,0.10)'
      g.beginPath(); g.moveTo(o.x, o.y + o.h * 0.7); g.lineTo(o.x + o.w * 0.55, o.y); g.lineTo(o.x + o.w * 0.8, o.y); g.lineTo(o.x, o.y + o.h); g.fill()
      if (blind[k]! > 0) { g.fillStyle = 'rgba(236,230,218,0.92)'; g.fillRect(o.x, o.y, o.w, o.h * blind[k]!) }
      g.restore()
      // Mullion + transom.
      const frame = kind === 'brick' ? '#24302b' : kind === 'charcoal' ? '#b89a62' : kind === 'render' ? '#f4f1ea' : '#3d3832'
      g.fillStyle = frame
      g.fillRect(o.x + o.w / 2 - 1.5, o.y, 3, o.h)
      if (kind !== 'arch') g.fillRect(o.x, o.y + o.h * 0.3, o.w, 3)
      g.strokeStyle = frame
      g.lineWidth = 3
      if (kind === 'arch') { archPath(g, o.x, o.y, o.w, o.h); g.stroke() } else g.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3)
      if (kind !== 'glass') {
        // Sill (stone) and, on brick, a stone lintel.
        g.fillStyle = kind === 'charcoal' ? '#8f8a82' : '#efe7da'
        g.fillRect(o.x - 6, o.y + o.h + 2, o.w + 12, 5)
        g.fillStyle = 'rgba(0,0,0,0.18)'
        g.fillRect(o.x - 6, o.y + o.h + 7, o.w + 12, 3)
        if (kind === 'brick' || kind === 'charcoal') { g.fillStyle = kind === 'brick' ? '#d8ccb6' : '#77726b'; g.fillRect(o.x - 6, o.y - 12, o.w + 12, 8) }
      }
      if (kind === 'render') {
        // Timber shutters either side.
        g.fillStyle = '#6f5a46'
        g.fillRect(o.x - 18, o.y, 14, o.h)
        g.fillRect(o.x + o.w + 4, o.y, 14, o.h)
        g.fillStyle = 'rgba(0,0,0,0.25)'
        for (let y = o.y + 4; y < o.y + o.h; y += 6) { g.fillRect(o.x - 18, y, 14, 1); g.fillRect(o.x + o.w + 4, y, 14, 1) }
      }
    }
  })
  const glow = canvas(S, S, (g) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, S, S)
    for (let cy = 0; cy < TILE; cy++) for (let cx = 0; cx < TILE; cx++) {
      const k = cy * TILE + cx
      if (!lit[k]) continue
      const o = cellRect(cx, cy)
      const warm = g.createLinearGradient(0, o.y, 0, o.y + o.h)
      warm.addColorStop(0, '#ffe7c2')
      warm.addColorStop(1, '#b8875a')
      g.fillStyle = warm
      if (kind === 'arch') { archPath(g, o.x, o.y, o.w, o.h); g.fill() } else g.fillRect(o.x, o.y + o.h * blind[k]!, o.w, o.h * (1 - blind[k]!))
    }
  })
  // Roughness (green channel): matte wall, smooth glazing so the sky env map reads as reflection.
  const rough = canvas(S, S, (g) => {
    g.fillStyle = kind === 'glass' ? 'rgb(0,90,0)' : 'rgb(0,236,0)'
    g.fillRect(0, 0, S, S)
    g.fillStyle = 'rgb(0,40,0)'
    for (let cy = 0; cy < TILE; cy++) for (let cx = 0; cx < TILE; cx++) {
      const o = cellRect(cx, cy)
      if (kind === 'arch') { archPath(g, o.x, o.y, o.w, o.h); g.fill() } else g.fillRect(o.x, o.y, o.w, o.h)
    }
  })
  return { albedo, glow, rough }
}

/** Shopfront podium: one bay = stone piers, granite plinth, tall glazing, fascia band. */
function paintPodium(seed: number) {
  const r = rng(seed)
  const W = 256, H = 512
  const albedo = canvas(W, H, (g) => {
    g.fillStyle = '#cfc6b6'
    g.fillRect(0, 0, W, H)
    void r
    g.fillStyle = '#3f3c39' // granite plinth
    g.fillRect(0, H - 34, W, 34)
    const gx = 24, gy = 120, gw = W - 48, gh = H - 34 - 120
    g.fillStyle = 'rgba(30,26,22,0.6)'
    g.fillRect(gx - 5, gy - 5, gw + 10, gh + 5)
    const glass = g.createLinearGradient(0, gy, 0, gy + gh)
    glass.addColorStop(0, '#9fb3bd'); glass.addColorStop(0.5, '#4d606b'); glass.addColorStop(1, '#2b363d')
    g.fillStyle = glass
    g.fillRect(gx, gy, gw, gh)
    // Hints of a lit interior: shelves and pendant dots.
    g.fillStyle = 'rgba(255,236,206,0.10)'
    for (let y = gy + 70; y < gy + gh - 20; y += 60) g.fillRect(gx + 10, y, gw - 20, 4)
    g.fillStyle = '#2e2a26' // bronze frame, transom
    g.fillRect(gx, gy + 46, gw, 5)
    g.fillRect(gx + gw / 2 - 2, gy + 46, 4, gh - 46)
    g.lineWidth = 5; g.strokeStyle = '#2e2a26'; g.strokeRect(gx, gy, gw, gh)
    g.fillStyle = 'rgba(255,255,255,0.08)'
    g.beginPath(); g.moveTo(gx, gy + gh * 0.6); g.lineTo(gx + gw * 0.5, gy); g.lineTo(gx + gw * 0.72, gy); g.lineTo(gx, gy + gh); g.fill()
    g.fillStyle = 'rgba(0,0,0,0.12)' // fascia shadow line
    g.fillRect(0, 96, W, 6)
  })
  const glow = canvas(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
    const gx = 24, gy = 120, gw = W - 48, gh = H - 34 - 120
    const warm = g.createLinearGradient(0, gy, 0, gy + gh)
    warm.addColorStop(0, '#ffe2b4'); warm.addColorStop(1, '#6b4a2c')
    g.fillStyle = warm
    g.fillRect(gx, gy + 51, gw, gh - 51)
    g.fillStyle = '#000'
    g.fillRect(gx + gw / 2 - 2, gy, 4, gh)
  })
  return { albedo, glow }
}

function signCanvas(title: string): { c: HTMLCanvasElement; aspect: number } {
  const label = title.toUpperCase()
  const probe = document.createElement('canvas').getContext('2d')
  const font = '600 64px Outfit, "Archivo Black", sans-serif'
  let tw = label.length * 40
  if (probe) { probe.font = font; tw = probe.measureText(label).width + label.length * 6 }
  const W = Math.min(2048, Math.max(256, Math.ceil(tw + 120)))
  const c = canvas(W, 128, (g) => {
    g.fillStyle = '#1b1814'
    g.fillRect(0, 0, W, 128)
    g.strokeStyle = '#b8955a'
    g.lineWidth = 4
    g.strokeRect(6, 6, W - 12, 116)
    g.fillStyle = '#f3e3c3'
    g.font = font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const ctx = g as CanvasRenderingContext2D & { letterSpacing?: string }
    ctx.letterSpacing = '6px'
    g.fillText(label, W / 2, 68)
  })
  return { c, aspect: W / 128 }
}

export function createArchitecture(o: {
  anisotropy: number
  stone: THREE.MeshStandardMaterial
  stoneDark: THREE.MeshStandardMaterial
  leaf: THREE.Material
  boxUV: (g: THREE.BufferGeometry, scale: number) => void
}) {
  const tex = (c: HTMLCanvasElement, srgb: boolean, repeat = true) => {
    const t = new THREE.CanvasTexture(c)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = o.anisotropy
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    return t
  }
  const nightMats: Array<{ m: THREE.MeshStandardMaterial; day: number; night: number }> = []
  const facadeMat = (kind: Facade, seed: number) => {
    const p = paintFacade(kind, seed)
    const m = new THREE.MeshStandardMaterial({
      map: tex(p.albedo, true), emissiveMap: tex(p.glow, true), emissive: 0xffffff, emissiveIntensity: 0,
      roughnessMap: tex(p.rough, false), roughness: 1, metalness: kind === 'glass' ? 0.35 : 0.02, envMapIntensity: kind === 'glass' ? 1.0 : 0.6,
    })
    nightMats.push({ m, day: 0, night: 0.95 })
    return m
  }
  const F: Record<Facade, THREE.MeshStandardMaterial> = {
    stone: facadeMat('stone', 11), brick: facadeMat('brick', 23), glass: facadeMat('glass', 5),
    render: facadeMat('render', 31), arch: facadeMat('arch', 19), charcoal: facadeMat('charcoal', 53),
  }
  const pod = paintPodium(7)
  const podium = new THREE.MeshStandardMaterial({ map: tex(pod.albedo, true), emissiveMap: tex(pod.glow, true), emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.55, metalness: 0.1 })
  nightMats.push({ m: podium, day: 0.1, night: 1.05 })
  const bronze = new THREE.MeshStandardMaterial({ color: 0x3b342d, roughness: 0.42, metalness: 0.75 })
  const roof = new THREE.MeshStandardMaterial({ color: 0x5d5a55, roughness: 0.96 })
  const plant = new THREE.MeshStandardMaterial({ color: 0xc3c6c8, roughness: 0.6, metalness: 0.3 })
  const solar = new THREE.MeshStandardMaterial({ color: 0x1c2a44, roughness: 0.25, metalness: 0.6, envMapIntensity: 1.2 })
  const timber = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.78 })
  const brickPlain = new THREE.MeshStandardMaterial({ color: 0x8c5240, roughness: 0.92 })
  const tiles = new THREE.MeshStandardMaterial({ color: 0x6e3f30, roughness: 0.85, map: tex(canvas(128, 128, (g) => {
    g.fillStyle = '#8a5a48'; g.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 128; y += 16) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y + 13, 128, 3); for (let x = (y / 16) % 2 * 8; x < 128; x += 16) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 2, 13) } }
  }), true) })
  const lawn = new THREE.MeshStandardMaterial({ color: 0x5f8a45, roughness: 0.95 })
  const clearGlass = new THREE.MeshStandardMaterial({ color: 0xbfd2da, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.4 })
  const doorGlass = new THREE.MeshStandardMaterial({ color: 0x8a9ea8, roughness: 0.06, metalness: 0.55, emissive: 0xffd9a8, emissiveIntensity: 0.12, envMapIntensity: 1.3 })
  nightMats.push({ m: doorGlass, day: 0.12, night: 0.9 })
  const ledWarm = new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffecd0, emissiveIntensity: 0.15, roughness: 0.5 })
  const ledMint = new THREE.MeshStandardMaterial({ color: 0x1d2a26, emissive: 0x6dffc8, emissiveIntensity: 0.15, roughness: 0.5 })
  nightMats.push({ m: ledWarm, day: 0.12, night: 2.2 }, { m: ledMint, day: 0.12, night: 2.0 })
  const signs: THREE.MeshStandardMaterial[] = []

  const bag = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const push = (m: THREE.Material, g: THREE.BufferGeometry) => {
    const list = bag.get(m) ?? []
    list.push(g.index ? g.toNonIndexed() : g)
    bag.set(m, list)
  }
  const stoneBox = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = o.stone) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)
    if (m === o.stone || m === o.stoneDark) o.boxUV(g, 0.35)
    push(m, g)
  }
  /** One flat wall: width W (along its face), height H from y0, facing out at angle rotY around (cx, cz). */
  const wall = (m: THREE.Material, W: number, H: number, cx: number, y0: number, cz: number, rotY: number, uScale: number, vScale: number, v0 = 0) => {
    const g = new THREE.PlaneGeometry(W, H)
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W * uScale, v0 + uv.getY(i) * H * vScale)
    g.rotateY(rotY).translate(cx, y0 + H / 2, cz)
    push(m, g)
  }
  /** Four facade walls round a w x d footprint. Bays fit each face exactly so no window is cut at a corner. */
  const shell = (m: THREE.Material, w: number, d: number, y0: number, H: number, cx: number, cz: number, bay: number, floor: number, v0 = 0) => {
    const nx = Math.max(1, Math.round(w / bay)), nz = Math.max(1, Math.round(d / bay))
    const uw = nx / w / TILE, ud = nz / d / TILE, vv = 1 / floor / TILE
    wall(m, w, H, cx, y0, cz + d / 2, 0, uw, vv, v0)
    wall(m, w, H, cx, y0, cz - d / 2, Math.PI, uw, vv, v0)
    wall(m, d, H, cx + w / 2, y0, cz, Math.PI / 2, ud, vv, v0)
    wall(m, d, H, cx - w / 2, y0, cz, -Math.PI / 2, ud, vv, v0)
  }
  const podiumShell = (w: number, d: number, H: number, cx: number, cz: number) => {
    const nx = Math.max(1, Math.round(w / 2.6)), nz = Math.max(1, Math.round(d / 2.6))
    wall(podium, w, H, cx, 0, cz + d / 2, 0, nx / w, 1 / H)
    wall(podium, w, H, cx, 0, cz - d / 2, Math.PI, nx / w, 1 / H)
    wall(podium, d, H, cx + w / 2, 0, cz, Math.PI / 2, nz / d, 1 / H)
    wall(podium, d, H, cx - w / 2, 0, cz, -Math.PI / 2, nz / d, 1 / H)
  }
  /** Parapet + coping + roof deck + LED edge strip. */
  const crown = (w: number, d: number, y: number, cx: number, cz: number, led: THREE.Material | null, parapet = 0.7) => {
    const t = 0.22
    stoneBox(w + 0.12, parapet, t, cx, y, cz + d / 2 - t / 2 + 0.06)
    stoneBox(w + 0.12, parapet, t, cx, y, cz - d / 2 + t / 2 - 0.06)
    stoneBox(t, parapet, d - 2 * t + 0.12, cx + w / 2 - t / 2 + 0.06, y, cz)
    stoneBox(t, parapet, d - 2 * t + 0.12, cx - w / 2 + t / 2 - 0.06, y, cz)
    stoneBox(w + 0.3, 0.08, d + 0.3, cx, y + parapet, cz) // coping lip (reads as a crisp roof line)
    push(roof, new THREE.PlaneGeometry(w - 0.3, d - 0.3).rotateX(-Math.PI / 2).translate(cx, y + 0.12, cz))
    if (led) {
      const e = 0.05, top = y + parapet + 0.08
      push(led, new THREE.BoxGeometry(w + 0.34, e, e).translate(cx, top + e / 2, cz + d / 2 + 0.15))
      push(led, new THREE.BoxGeometry(w + 0.34, e, e).translate(cx, top + e / 2, cz - d / 2 - 0.15))
      push(led, new THREE.BoxGeometry(e, e, d + 0.34).translate(cx + w / 2 + 0.15, top + e / 2, cz))
      push(led, new THREE.BoxGeometry(e, e, d + 0.34).translate(cx - w / 2 - 0.15, top + e / 2, cz))
    }
  }
  const corners = (w: number, d: number, y0: number, H: number, cx: number, cz: number, m: THREE.Material, s = 0.42) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) stoneBox(s, H, s, cx + sx * (w / 2 - s / 2 + 0.06), y0, cz + sz * (d / 2 - s / 2 + 0.06), m)
  }
  const rooftop = (w: number, d: number, y: number, cx: number, cz: number, r: () => number, kind: 'plant' | 'solar' | 'garden') => {
    if (w < 5 || d < 4) return
    if (kind === 'solar') {
      const rows = Math.max(1, Math.floor((d - 2) / 1.6))
      for (let i = 0; i < rows; i++) {
        const z = cz - d / 2 + 1.4 + i * 1.6
        push(solar, new THREE.BoxGeometry(Math.min(w - 2.2, 7), 0.05, 1.1).rotateX(-0.35).translate(cx, y + 0.55, z))
        push(bronze, new THREE.BoxGeometry(Math.min(w - 2.2, 7), 0.4, 0.06).translate(cx, y + 0.32, z - 0.42))
      }
    } else if (kind === 'garden') {
      push(lawn, new THREE.BoxGeometry(w - 1.4, 0.3, d - 1.4).translate(cx, y + 0.27, cz))
      for (let i = 0; i < 4; i++) {
        const bx = cx + (r() - 0.5) * (w - 3), bz = cz + (r() - 0.5) * (d - 3)
        { const rr = (0.45 + r() * 0.35) * 1.15; push(o.leaf, shrubGeometry(Math.floor(r() * 90) + 3).scale(rr, rr * 0.8, rr).translate(bx, y + 0.8, bz)) }
      }
      push(bronze, new THREE.BoxGeometry(w - 1.0, 0.05, 0.05).translate(cx, y + 1.25, cz + d / 2 - 0.5))
    } else {
      for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
        const ax = cx + (r() - 0.5) * (w - 3), az = cz + (r() - 0.5) * (d - 3)
        push(plant, new THREE.BoxGeometry(1.1, 0.7, 0.8).translate(ax, y + 0.47, az))
        push(bronze, new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12).translate(ax, y + 0.85, az))
      }
    }
  }
  const outward = (door: Door) => ({ pz: [0, 1], nz: [0, -1], px: [1, 0], nx: [-1, 0] } as const)[door]
  const yawOf = (door: Door) => ({ pz: 0, nz: Math.PI, px: Math.PI / 2, nx: -Math.PI / 2 } as const)[door]
  /** Place geometry built in a door-local frame (facade plane z = 0, x along it, +z out of the building). */
  const doorFrame = (spec: BuildingSpec) => {
    const [fx, fz] = outward(spec.door)
    const yaw = yawOf(spec.door)
    const face = spec.door === 'px' || spec.door === 'nx' ? spec.w / 2 : spec.d / 2
    const cx = spec.x + fx * face, cz = spec.z + fz * face
    return (g: THREE.BufferGeometry, lx: number, ly: number, lz: number) => g.translate(lx, ly, lz).rotateY(yaw).translate(cx, 0, cz)
  }
  /** Recessed entrance: bronze portal, glazed double door, stone step, thin canopy blade with a light line. */
  const entrance = (spec: BuildingSpec, podH: number) => {
    const at = doorFrame(spec)
    const dw = Math.min(1.9, (spec.door === 'px' || spec.door === 'nx' ? spec.d : spec.w) * 0.45)
    const dh = Math.min(2.5, podH - 1.1)
    push(bronze, at(new THREE.BoxGeometry(dw + 0.36, dh + 0.18, 0.16), 0, dh / 2 + 0.05, 0.07))
    push(doorGlass, at(new THREE.PlaneGeometry(dw, dh), 0, dh / 2 + 0.05, 0.16))
    push(bronze, at(new THREE.BoxGeometry(0.04, dh, 0.03), 0, dh / 2 + 0.05, 0.18))
    const step = at(new THREE.BoxGeometry(dw + 1.0, 0.1, 1.4), 0, 0.05, 0.7)
    o.boxUV(step, 0.35)
    push(o.stone, step)
    push(bronze, at(new THREE.BoxGeometry(dw + 1.2, 0.08, 1.35), 0, dh + 0.32, 0.68))
    push(ledWarm, at(new THREE.BoxGeometry(dw + 1.0, 0.02, 0.04), 0, dh + 0.27, 1.34))
  }
  const sign = (spec: BuildingSpec, y: number, maxW: number, out = 0.06) => {
    if (spec.sign === false) return null
    const { c, aspect } = signCanvas(spec.title)
    const t = tex(c, true, false)
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6, metalness: 0.2 })
    signs.push(m)
    const w = Math.min(maxW, 0.5 * aspect)
    const h = w / aspect
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), [bronze, bronze, bronze, bronze, m, bronze])
    const [fx, fz] = outward(spec.door)
    const face = spec.door === 'px' || spec.door === 'nx' ? spec.w / 2 : spec.d / 2
    mesh.position.set(spec.x + fx * (face + out), y, spec.z + fz * (face + out))
    mesh.rotation.y = yawOf(spec.door)
    mesh.castShadow = false
    mesh.userData.ghost = true
    return mesh
  }

  const build = (spec: BuildingSpec): THREE.Object3D[] => {
    const style = spec.style ?? 'civic'
    const r = rng((spec.seed ?? 1) * 97 + 13)
    const { x, z, w, d } = spec
    const led = spec.mint ? ledMint : ledWarm
    const extra: THREE.Object3D[] = []
    if (style === 'house') {
      // Two-storey townhouse: rendered walls with shuttered windows, gabled tile roof, chimney, timber porch.
      const H = 5.6
      stoneBox(w + 0.2, 0.4, d + 0.2, x, 0, z, o.stoneDark)
      shell(F.render, w, d, 0.4, H - 0.4, x, z, 2.0, 2.6, 0.05)
      stoneBox(w + 0.25, 0.14, d + 0.25, x, H, z)
      const along = w >= d
      const span = along ? d : w, len = along ? w : d
      const shape = new THREE.Shape([new THREE.Vector2(-span / 2 - 0.35, 0), new THREE.Vector2(span / 2 + 0.35, 0), new THREE.Vector2(0, span * 0.42)])
      const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: len + 0.5, bevelEnabled: false }).translate(0, 0, -(len + 0.5) / 2)
      // ExtrudeGeometry UVs are in shape units: scale so tiles stay ~0.4 m.
      const uv = roofGeo.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6)
      if (along) roofGeo.rotateY(Math.PI / 2)
      push(tiles, roofGeo.translate(x, H + 0.14, z))
      // Gable end walls fill the triangle under the roof.
      const gable = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, span * 0.42 - 0.2)]))
      for (const s of [-1, 1]) {
        const gg = gable.clone()
        if (along) gg.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2).translate(x + s * (w / 2), H + 0.14, z)
        else gg.rotateY(s > 0 ? 0 : Math.PI).translate(x, H + 0.14, z + s * (d / 2))
        o.boxUV(gg, 0.35)
        push(o.stone, gg)
      }
      const chx = x + (along ? w * 0.28 : span * 0.2), chz = z + (along ? -span * 0.18 : d * 0.28)
      push(brickPlain, new THREE.BoxGeometry(0.7, 1.9, 0.7).translate(chx, H + 1.55, chz))
      stoneBox(0.86, 0.14, 0.86, chx, H + 2.5, chz)
      entrance(spec, 3.2)
      const s = sign(spec, 3.3, 1.5)
      if (s) extra.push(s)
      return extra
    }
    if (style === 'kiosk' || style === 'pavilion') {
      // Glass pavilion: stone plinth, slim columns, clear glazing, floating timber roof with an LED edge.
      const H = spec.h
      stoneBox(w + 0.6, 0.18, d + 0.6, x, 0, z)
      push(clearGlass, new THREE.BoxGeometry(w, H, d).translate(x, 0.18 + H / 2, z))
      push(o.stone, doorFrame(spec)(new THREE.PlaneGeometry(spec.door === 'px' || spec.door === 'nx' ? d - 0.1 : w - 0.1, H), 0, 0.18 + H / 2, -(spec.door === 'px' || spec.door === 'nx' ? w : d) + 0.08))
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) push(bronze, new THREE.BoxGeometry(0.1, H, 0.1).translate(x + sx * w / 2, 0.18 + H / 2, z + sz * d / 2))
      push(timber, new THREE.BoxGeometry(w + 1.3, 0.24, d + 1.3).translate(x, 0.18 + H + 0.12, z))
      push(style === 'kiosk' && spec.mint ? lawn : roof, new THREE.BoxGeometry(w + 1.1, 0.06, d + 1.1).translate(x, 0.18 + H + 0.27, z))
      const e = 0.04, top = 0.18 + H
      push(led, new THREE.BoxGeometry(w + 1.34, e, e).translate(x, top, z + (d + 1.3) / 2))
      push(led, new THREE.BoxGeometry(w + 1.34, e, e).translate(x, top, z - (d + 1.3) / 2))
      push(led, new THREE.BoxGeometry(e, e, d + 1.34).translate(x + (w + 1.3) / 2, top, z))
      push(led, new THREE.BoxGeometry(e, e, d + 1.34).translate(x - (w + 1.3) / 2, top, z))
      const s = sign(spec, 0.18 + H + 0.12, Math.min(1.7, (spec.door === 'px' || spec.door === 'nx' ? d : w) * 0.6), 0.68)
      if (s) extra.push(s)
      return extra
    }
    // Civic, glass, brick and arcade blocks: shopfront podium, upper floors, crown.
    const small = w < 9 && d < 9
    const podH = small ? 3.8 : 4.4
    const floors = spec.floors ?? (style === 'glass' ? (small ? 1 : 3) : small ? 1 : 2)
    const facade = spec.facade ? F[spec.facade] : style === 'glass' ? F.glass : style === 'brick' ? F.brick : style === 'arch' ? F.arch : F.stone
    const bodyH = floors * FLOOR
    podiumShell(w, d, podH, x, z)
    stoneBox(w + 0.36, 0.3, d + 0.36, x, podH - 0.05, z) // cornice over the shopfronts
    const bay = style === 'glass' ? 1.6 : 2.2
    shell(facade, w, d, podH + 0.25, bodyH, x, z, bay, FLOOR)
    if (style !== 'glass') corners(w, d, podH + 0.25, bodyH, x, z, style === 'brick' ? o.stone : o.stone, 0.36)
    let top = podH + 0.25 + bodyH
    if (style === 'glass') {
      // Bronze fins on the long faces give depth and a vertical rhythm.
      const along = w >= d
      const n = Math.max(2, Math.round((along ? w : d) / 1.6))
      for (let i = 1; i < n; i++) {
        const t = -((along ? w : d) / 2) + (i * (along ? w : d)) / n
        for (const s of [-1, 1]) push(bronze, new THREE.BoxGeometry(along ? 0.08 : 0.42, bodyH, along ? 0.42 : 0.08).translate(x + (along ? t : s * (w / 2 + 0.2)), podH + 0.25 + bodyH / 2, z + (along ? s * (d / 2 + 0.2) : t)))
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) push(led, new THREE.BoxGeometry(0.05, bodyH, 0.05).translate(x + sx * (w / 2 + 0.03), podH + 0.25 + bodyH / 2, z + sz * (d / 2 + 0.03)))
    }
    // Setback crown on the big blocks: a recessed glass attic floor, so the roofline steps.
    if (!small && (style === 'glass' || style === 'civic')) {
      crown(w, d, top, x, z, null, 0.5)
      const sw = w - 3, sd = d - 3
      shell(F.glass, sw, sd, top + 0.1, 3.0, x, z, 1.6, 3.0)
      top += 3.1
      crown(sw, sd, top, x, z, led, 0.6)
      rooftop(sw, sd, top, x, z, r, 'solar')
    } else {
      crown(w, d, top, x, z, led, style === 'brick' ? 0.8 : 0.7)
      rooftop(w, d, top, x, z, r, (spec.seed ?? 0) % 3 === 0 ? 'garden' : (spec.seed ?? 0) % 3 === 1 ? 'plant' : 'solar')
    }
    entrance(spec, podH)
    const faceW = spec.door === 'px' || spec.door === 'nx' ? d : w
    const s = sign(spec, podH - 0.75, Math.min(3.6, faceW * 0.5))
    if (s) extra.push(s)
    return extra
  }

  return {
    build,
    /** 0 = day, 1 = night. */
    setNight(n: number) {
      for (const e of nightMats) e.m.emissiveIntensity = e.day + (e.night - e.day) * n
      for (const s of signs) s.emissiveIntensity = 0.22 + n * 0.75
    },
    flush(scene: THREE.Scene) {
      for (const [m, list] of bag) {
        const merged = mergeGeometries(list.map((g) => {
          for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
          if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
          return g
        }), false)
        if (!merged) continue
        merged.computeBoundingSphere()
        const mesh = new THREE.Mesh(merged, m)
        const lit = m === ledWarm || m === ledMint || m === clearGlass
        mesh.castShadow = !lit
        mesh.receiveShadow = !lit
        if (m === clearGlass) mesh.renderOrder = 2
        mesh.name = 'architecture'
        scene.add(mesh)
      }
      bag.clear()
    },
  }
}
