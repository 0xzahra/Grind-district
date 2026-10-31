import { HOUSES, type HouseId } from './houses.ts'
import type { PanelId, Season, TimeOfDay } from './logic.ts'
import { CITY_LIMIT, type Obstacle } from './physics.ts'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type Hotspot = {
  id: string
  x: number
  z: number
  r: number
  title: string
  body: string
  action?: PanelId
  enter?: string
  house?: HouseId
  use?: () => void
  exit?: boolean
}

export type World = {
  obstacles: Obstacle[]
  hotspots: Hotspot[]
  sun: THREE.DirectionalLight
  tick: (time: number, focus: THREE.Vector3) => void
  setLook: (look: { time: TimeOfDay; season: Season }) => void
  setRank: (label: string) => void
  /** Continuous day clock. 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
  setDaylight: (phase: number) => void
  /** Sidewalk lanes and stop lines for the ambient city. */
  lanes: { roadHalf: number; walk: number; inner: number; outer: number }
}

type Door = 'px' | 'nx' | 'pz' | 'nz'
/** Axis-aligned walkway rectangle, centre and half extents. */
type Rect = { x: number; z: number; hx: number; hz: number }

const ROAD_HALF = 3.2
const WALK_HALF = 1.1
const ROAD_END = 58

const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < a.hx + b.hx && Math.abs(a.z - b.z) < a.hz + b.hz
const legRect = (x1: number, z1: number, x2: number, z2: number, half: number): Rect => ({
  x: (x1 + x2) / 2,
  z: (z1 + z2) / 2,
  hx: Math.abs(x2 - x1) / 2 + half,
  hz: Math.abs(z2 - z1) / 2 + half,
})
type Series = { unit: number[]; meme: number[] }

const SPAN = 180

export function districtName(x: number, z: number): string {
  if (x > 30 && z > 14 && z < 54) return 'The houses'
  if (Math.hypot(x, z + 48) < 24) return 'Campus'
  if (Math.hypot(x + 48, z) < 22) return 'Trading floor'
  if (Math.hypot(x - 48, z) < 22) return 'Influencer row'
  if (Math.hypot(x, z - 48) < 22) return 'Trenches'
  if (Math.hypot(x + 40, z - 40) < 14) return 'The basin'
  if (z < -16 && Math.abs(x) < 8) return 'Campus'
  if (x < -16 && Math.abs(z) < 8) return 'Trading floor'
  if (x > 16 && Math.abs(z) < 8) return 'Influencer row'
  if (z > 16 && Math.abs(x) < 8) return 'Trenches'
  if (Math.hypot(x, z) < 16) return 'The Plaza'
  return 'The streets'
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-projected UVs in object space (metres * scale) so textures tile instead of stretching. */
function boxProjectUV(geometry: THREE.BufferGeometry, scale: number): void {
  const pos = geometry.getAttribute('position')
  const nor = geometry.getAttribute('normal')
  if (!pos || !nor) return
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i))
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const [u, v] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y]
    uv[i * 2] = u * scale
    uv[i * 2 + 1] = v * scale
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

export function createWorld(options: {
  scene: THREE.Scene
  anisotropy: number
  mark: THREE.Texture
  aspect: number
  reduceMotion: boolean
  rankLabel: string
  getSeries: () => Series
}): World {
  const { scene, anisotropy, mark, aspect, reduceMotion, getSeries } = options
  const obstacles: Obstacle[] = []
  const hotspots: Hotspot[] = []
  const reserved: Obstacle[] = []
  const facades: THREE.MeshStandardMaterial[] = []
  const ripples: { mesh: THREE.Mesh; offset: number }[] = []
  const glow: THREE.PointLight[] = []
  const doors: { x: number; z: number; own: Obstacle }[] = []
  const paths: Rect[] = []

  const stone = new THREE.MeshStandardMaterial({ color: 0x3c4b45, roughness: 0.88, metalness: 0.04 })
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x24302b, roughness: 0.9, metalness: 0.05 })
  const trim = new THREE.MeshStandardMaterial({
    color: 0xc9a25e,
    emissive: 0x000000,
    emissiveIntensity: 1.1,
    roughness: 0.38,
  })
  // CC0 PBR sets (ambientCG). Phones get 512 px, desktops 1k.
  const texSize = window.matchMedia('(pointer: coarse)').matches ? '512' : '1k'
  const texLoader = new THREE.TextureLoader()
  const pbr = (name: string, color = true) => {
    const load = (ch: string, srgb: boolean) => {
      const t = texLoader.load(`/textures/${name}_${ch}_${texSize}.jpg`)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = anisotropy
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    return { map: color ? load('color', true) : null, normalMap: load('normal', false), roughnessMap: load('rough', false) }
  }
  const concrete = pbr('concrete')
  Object.assign(stone, concrete, { color: new THREE.Color(0xd8cfc0), roughness: 1, metalness: 0 })
  stone.normalScale.set(0.8, 0.8)
  Object.assign(stoneDark, pbr('concrete'), { color: new THREE.Color(0x6e675e), roughness: 1, metalness: 0 })
  const brass = pbr('brass')
  Object.assign(trim, brass, { color: new THREE.Color(0xd9b26a), metalness: 0.9, roughness: 0.55 })
  for (const m of [stone, stoneDark, trim]) m.needsUpdate = true
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a38, roughness: 0.82 })
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.9 })
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.8, flatShading: true })
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe2b8,
    emissive: 0xffc27a,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  })
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a5566,
    roughness: 0.06,
    metalness: 0.35,
    emissive: 0x061820,
    emissiveIntensity: 0.3,
  })

  const solid = (geometry: THREE.BufferGeometry, material: THREE.Material, cast = true) => {
    if (material === stone || material === stoneDark || material === trim) boxProjectUV(geometry, material === trim ? 1.2 : 0.35)
    const item = new THREE.Mesh(geometry, material)
    item.castShadow = cast
    item.receiveShadow = true
    return item
  }

  const finalize = (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = anisotropy
    return texture
  }

  const paint = (width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not paint the city.')
    draw(context)
    return finalize(new THREE.CanvasTexture(canvas))
  }

  const paintSign = (title: string, subtitle: string) =>
    paint(1024, 448, (g) => {
      g.fillStyle = '#0c1411'
      g.fillRect(0, 0, 1024, 448)
      g.strokeStyle = '#c9a25e'
      g.lineWidth = 16
      g.strokeRect(18, 18, 988, 412)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const label = title.toUpperCase()
      let size = 92
      g.font = `${size}px "Archivo Black", sans-serif`
      while (g.measureText(label).width > 900 && size > 42) {
        size -= 4
        g.font = `${size}px "Archivo Black", sans-serif`
      }
      g.fillStyle = '#e8c98f'
      g.fillText(label, 512, 170)
      g.fillStyle = '#f2ece0'
      g.font = '500 40px Outfit, sans-serif'
      g.fillText(subtitle, 512, 300)
    })

  const paintLadder = (current: string) =>
    paint(512, 1024, (g) => {
      g.fillStyle = '#14110e'
      g.fillRect(0, 0, 512, 1024)
      g.strokeStyle = '#c9a25e'
      g.lineWidth = 12
      g.strokeRect(16, 16, 480, 992)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#d9c6a2'
      g.font = '36px Outfit, sans-serif'
      g.fillText('THE LADDER', 256, 78)
      const ranks = ['WHALE', 'SHARK', 'DOLPHIN', 'FISH', 'CRAB', 'SHRIMP']
      const you = current.toUpperCase()
      ranks.forEach((rank, index) => {
        const y = 210 + index * 120
        if (rank === you) {
          g.fillStyle = '#c9a25e'
          g.fillRect(48, y - 42, 416, 84)
          g.fillStyle = '#062117'
          g.font = '52px "Archivo Black", sans-serif'
        } else {
          g.fillStyle = '#a89c88'
          g.font = '42px "Archivo Black", sans-serif'
        }
        g.fillText(rank, 256, y)
      })
    })

  let ladderMap = paintLadder(options.rankLabel)
  const ladderMat = new THREE.MeshBasicMaterial({ map: ladderMap, toneMapped: false })

  const facadeTex = (seed: number, wall = false) => {
    const rand = mulberry32(seed)
    return paint(128, 256, (g) => {
      // Albedo: warm limestone with window frames and sills. Emissive copy: black wall, lit panes only.
      g.fillStyle = wall ? ['#9a8f7f', '#8c8478', '#a39684', '#7d776e'][seed % 4]! : '#000000'
      g.fillRect(0, 0, 128, 256)
      if (wall) {
        g.fillStyle = 'rgba(0,0,0,0.12)'
        for (let row = 10; row < 256; row += 28) g.fillRect(0, row, 128, 2)
        g.fillStyle = '#4a4238'
        for (let row = 18; row < 240; row += 28) for (let col = 14; col < 118; col += 22) {
          g.fillRect(col - 2, row - 2, 14, 20)
          g.fillStyle = '#c9b89a'
          g.fillRect(col - 3, row + 18, 16, 2)
          g.fillStyle = '#4a4238'
        }
      }
      for (let row = 18; row < 240; row += 28) {
        for (let col = 14; col < 118; col += 22) {
          if (rand() > 0.72) continue
          const lit = rand()
          g.fillStyle = wall ? (lit > 0.45 ? '#3a4850' : '#1e262b') : lit > 0.86 ? '#ffe7c2' : lit > 0.45 ? '#f0d7b0' : '#000000'
          g.fillRect(col, row, 10, 16)
        }
      }
    })
  }

  const groundMap = paint(2048, 2048, (g) => {
    const scale = 2048 / SPAN
    const mid = 1024
    const toX = (x: number) => mid + x * scale
    const toY = (z: number) => mid + z * scale
    const rect = (x: number, z: number, w: number, d: number) => {
      g.fillRect(toX(x - w / 2), toY(z - d / 2), w * scale, d * scale)
    }
    g.fillStyle = '#24312c'
    g.fillRect(0, 0, 2048, 2048)
    g.fillStyle = '#2c6a46'
    g.beginPath()
    g.arc(toX(-40), toY(40), 14 * scale, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#1a4f48'
    g.beginPath()
    g.arc(toX(-40), toY(40), 6.4 * scale, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#4e6874'
    rect(0, -48, 32, 26)
    g.fillStyle = '#3e4a46'
    rect(-48, 0, 24, 30)
    g.fillStyle = '#5c4e4a'
    rect(48, 0, 24, 30)
    g.fillStyle = '#4a3a42'
    rect(0, 48, 32, 24)
    g.fillStyle = '#6d7c74'
    rect(0, 0, 80, 6.4)
    rect(0, 0, 6.4, 80)
    g.strokeStyle = 'rgba(26, 243, 143, 0.55)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(toX(-40), toY(0))
    g.lineTo(toX(40), toY(0))
    g.moveTo(toX(0), toY(-40))
    g.lineTo(toX(0), toY(40))
    g.stroke()
    g.fillStyle = '#8b9b93'
    g.beginPath()
    g.arc(mid, mid, 15 * scale, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(16, 24, 22, 0.45)'
    g.lineWidth = 2
    for (let radius = 3; radius <= 14; radius += 1.6) {
      g.beginPath()
      g.arc(mid, mid, radius * scale, 0, Math.PI * 2)
      g.stroke()
    }
    g.strokeStyle = 'rgba(26, 243, 143, 0.85)'
    g.lineWidth = 4
    g.beginPath()
    g.arc(mid, mid, 3.1 * scale, 0, Math.PI * 2)
    g.stroke()
  })

  const groundMat = new THREE.MeshStandardMaterial({ map: groundMap, roughness: 0.92, metalness: 0.02 })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  ground.name = 'ground'
  scene.add(ground)

  const hemi = new THREE.HemisphereLight(0x9fb8d8, 0x0b120f, 0.25)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff1d6, 0.85)
  sun.position.set(14, 22, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 48
  sun.shadow.camera.left = -18
  sun.shadow.camera.right = 18
  sun.shadow.camera.top = 18
  sun.shadow.camera.bottom = -18
  sun.shadow.bias = -0.00035
  sun.shadow.normalBias = 0.04
  scene.add(sun)
  scene.add(sun.target)
  const fill = new THREE.DirectionalLight(0xe8e2d6, 0.2)
  fill.position.set(-12, 10, -8)
  scene.add(fill)

  const skyTop = new THREE.Color(0x02040a)
  const skyLow = new THREE.Color(0x070a09)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: skyTop }, low: { value: skyLow } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 low; varying float h; void main(){ gl_FragColor = vec4(mix(low, top, smoothstep(-0.05, 0.6, h)), 1.0); }',
    }),
  )
  sky.userData.ghost = true
  sky.raycast = () => undefined
  sky.renderOrder = -1
  scene.add(sky)
  const fog = new THREE.FogExp2(0x0a1412, 0.012)
  scene.fog = fog
  const background = new THREE.Color(0x070a09)
  scene.background = background
  const sunOffset = new THREE.Vector3(14, 22, 10)

  const addGlow = (x: number, y: number, z: number, color: number, night: number) => {
    const light = new THREE.PointLight(color, night, 14, 2)
    light.position.set(x, y, z)
    light.userData.night = night
    scene.add(light)
    glow.push(light)
  }

  const curb = (x: number, z: number, w: number, d: number) => {
    const height = 1.3
    const wall = solid(new THREE.BoxGeometry(w, height, d), stoneDark)
    wall.position.set(x, height / 2, z)
    const lip = solid(new THREE.BoxGeometry(w, 0.06, d), trim, false)
    lip.position.set(x, height + 0.02, z)
    scene.add(wall, lip)
    obstacles.push({ kind: 'box', x, z, hx: w / 2, hz: d / 2 })
  }
  const edge = CITY_LIMIT - 1.5
  const thick = 1.15
  const span = edge * 2 + thick
  curb(0, -edge - thick / 2, span, thick)
  curb(0, edge + thick / 2, span, thick)
  curb(-edge - thick / 2, 0, thick, span)
  curb(edge + thick / 2, 0, thick, span)

  const spot = (id: string, x: number, z: number, r: number, title: string, body: string, action?: PanelId, enter?: string, house?: HouseId) => {
    hotspots.push({ id, x, z, r, title, body, action, enter, house })
  }

  const addArch = (title: string, subtitle: string, x: number, z: number, rotationY: number) => {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = rotationY
    const left = solid(new THREE.BoxGeometry(0.55, 3.3, 0.6), stone)
    left.position.set(-3.7, 1.65, 0)
    const right = solid(new THREE.BoxGeometry(0.55, 3.3, 0.6), stone)
    right.position.set(3.7, 1.65, 0)
    const beam = solid(new THREE.BoxGeometry(8.1, 0.42, 0.6), stone)
    beam.position.y = 3.45
    const strip = solid(new THREE.BoxGeometry(7.6, 0.06, 0.66), trim, false)
    strip.position.y = 3.7
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 1.7),
      new THREE.MeshBasicMaterial({ map: paintSign(title, subtitle), toneMapped: false }),
    )
    sign.position.set(0, 2.15, 0.36)
    sign.userData.ghost = true
    group.add(left, right, beam, strip, sign)
    scene.add(group)
  }
  addArch('Campus', 'learning hall', 0, -16.5, 0)
  addArch('Trenches', 'wild book', 0, 16.5, Math.PI)
  addArch('Trading floor', 'spot book', -16.5, 0, Math.PI / 2)
  addArch('Influencer row', 'post a bounty', 16.5, 0, -Math.PI / 2)
  for (const [x, z] of [
    [-3.7, -16.5],
    [3.7, -16.5],
    [-3.7, 16.5],
    [3.7, 16.5],
    [-16.5, -3.7],
    [-16.5, 3.7],
    [16.5, -3.7],
    [16.5, 3.7],
  ] as const) {
    obstacles.push({ kind: 'circle', x, z, r: 0.48 })
  }
  spot('north-arch', 0, -13.4, 2.5, 'Campus road', 'North, to the learning hall. Courses you pass write your CV.')
  spot('south-arch', 0, 13.4, 2.5, 'Trenches road', 'South. Attention trades here. Your rank does not.')
  spot('west-arch', -13.4, 0, 2.5, 'Trading road', 'West, to the spot book. Practice funds only.')
  spot('east-arch', 13.4, 0, 2.5, 'Row road', 'East. Post a bounty. It lands on the portfolio.')

  const addBuilding = (spec: {
    x: number
    z: number
    w: number
    d: number
    h: number
    door: Door
    title: string
    subtitle: string
    windows?: boolean
    seed?: number
    steeple?: boolean
  }) => {
    const group = new THREE.Group()
    const material = spec.windows
      ? new THREE.MeshStandardMaterial({
          map: facadeTex(spec.seed ?? 1, true),
          normalMap: concrete.normalMap,
          roughness: 0.84,
          metalness: 0.04,
          emissive: 0xfff1dd,
          emissiveMap: facadeTex(spec.seed ?? 1),
          emissiveIntensity: 0.28,
        })
      : stone
    if (spec.windows && material instanceof THREE.MeshStandardMaterial) facades.push(material)
    // Varied silhouettes: bigger civic blocks step up by seed.
    if (spec.windows && spec.w >= 8) spec = { ...spec, h: spec.h + ((spec.seed ?? 0) % 3) * 1.3 }
    const block = solid(new THREE.BoxGeometry(spec.w, spec.h, spec.d), material)
    block.position.y = spec.h / 2
    group.add(block)
    // Facade detail, merged to two draw calls per building: plinth, corner pilasters, stepped cornice,
    // string course, balconies with rails on the long faces.
    {
      const { w, d, h } = spec
      const light: THREE.BufferGeometry[] = []
      const dark: THREE.BufferGeometry[] = []
      const bx = (list: THREE.BufferGeometry[], gw: number, gh: number, gd: number, x: number, y: number, z: number) =>
        list.push(new THREE.BoxGeometry(gw, gh, gd).translate(x, y, z))
      bx(dark, w + 0.24, 0.55, d + 0.24, 0, 0.275, 0)
      bx(light, w + 0.56, 0.22, d + 0.56, 0, h - 0.06, 0)
      bx(light, w + 0.36, 0.16, d + 0.36, 0, h - 0.26, 0)
      bx(dark, w + 0.2, 0.32, d + 0.2, 0, h + 0.16, 0)
      if (h > 4.2) bx(light, w + 0.14, 0.12, d + 0.14, 0, h * 0.5, 0)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(light, 0.38, h - 0.5, 0.38, sx * (w / 2 + 0.02), h / 2, sz * (d / 2 + 0.02))
      if (spec.windows && h > 4.6) {
        const along = w >= d
        for (const side of [-1, 1]) for (const k of [-0.25, 0.25]) {
          const px = along ? k * w : side * (w / 2 + 0.32)
          const pz = along ? side * (d / 2 + 0.32) : k * d
          bx(dark, along ? 1.7 : 0.64, 0.1, along ? 0.64 : 1.7, px, h * 0.5 + 0.12, pz)
          bx(dark, along ? 1.7 : 0.04, 0.5, along ? 0.04 : 1.7, along ? px : px + side * 0.3, h * 0.5 + 0.42, along ? pz + side * 0.3 : pz)
        }
      }
      const lm = mergeGeometries(light)
      const dm = mergeGeometries(dark)
      if (lm) group.add(solid(lm, stone))
      if (dm) group.add(solid(dm, stoneDark))
    }
    if (spec.steeple) {
      const tower = solid(new THREE.BoxGeometry(1.4, 3.2, 1.4), stoneDark)
      tower.position.y = spec.h + 1.6
      const cap = solid(new THREE.ConeGeometry(1.1, 1.6, 4), stoneDark)
      cap.position.y = spec.h + 3.8
      const arm = solid(new THREE.BoxGeometry(0.7, 0.08, 0.08), trim, false)
      arm.position.y = spec.h + 4.5
      const stem = solid(new THREE.BoxGeometry(0.08, 0.7, 0.08), trim, false)
      stem.position.y = spec.h + 4.5
      group.add(tower, cap, arm, stem)
    }
    const outward: Record<Door, { x: number; y: number; z: number; rot: number }> = {
      pz: { x: 0, y: spec.h * 0.58, z: spec.d / 2 + 0.05, rot: 0 },
      nz: { x: 0, y: spec.h * 0.58, z: -spec.d / 2 - 0.05, rot: Math.PI },
      px: { x: spec.w / 2 + 0.05, y: spec.h * 0.58, z: 0, rot: Math.PI / 2 },
      nx: { x: -spec.w / 2 - 0.05, y: spec.h * 0.58, z: 0, rot: -Math.PI / 2 },
    }
    const face = outward[spec.door]
    const signWidth = spec.w > 10 ? 4.2 : 2.6
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(signWidth, signWidth * 0.42),
      new THREE.MeshBasicMaterial({ map: paintSign(spec.title, spec.subtitle), toneMapped: false }),
    )
    sign.position.set(face.x, Math.min(face.y, spec.h - 0.7), face.z)
    sign.rotation.y = face.rot
    sign.userData.ghost = true
    const awningShift: Record<Door, [number, number]> = {
      pz: [0, 0.7],
      nz: [0, -0.7],
      px: [0.7, 0],
      nx: [-0.7, 0],
    }
    const shift = awningShift[spec.door]
    const awning = solid(new THREE.BoxGeometry(spec.door === 'px' || spec.door === 'nx' ? 1.3 : spec.w * 0.7, 0.08, spec.door === 'pz' || spec.door === 'nz' ? 1.3 : spec.d * 0.7), stoneDark, false)
    awning.position.set(face.x + shift[0], spec.h - 0.08, face.z + shift[1])
    awning.userData.ghost = true
    group.add(sign, awning)
    group.position.set(spec.x, 0, spec.z)
    scene.add(group)
    obstacles.push({ kind: 'box', x: spec.x, z: spec.z, hx: spec.w / 2 + 0.15, hz: spec.d / 2 + 0.15 })
    reserved.push({ kind: 'box', x: spec.x, z: spec.z, hx: spec.w / 2 + 1.8, hz: spec.d / 2 + 1.8 })
    const stepOut = 1.45
    const doorAt: Record<Door, { x: number; z: number }> = {
      pz: { x: spec.x, z: spec.z + spec.d / 2 + stepOut },
      nz: { x: spec.x, z: spec.z - spec.d / 2 - stepOut },
      px: { x: spec.x + spec.w / 2 + stepOut, z: spec.z },
      nx: { x: spec.x - spec.w / 2 - stepOut, z: spec.z },
    }
    const at = doorAt[spec.door]
    doors.push({ x: at.x, z: at.z, own: obstacles[obstacles.length - 1] as Obstacle })
    const mat = solid(new THREE.BoxGeometry(1.5, 0.04, 1.5), trim, false)
    mat.position.set(at.x, 0.03, at.z)
    mat.userData.ghost = true
    scene.add(mat)
    return at
  }

  const hall = addBuilding({ x: 0, z: -48, w: 16, d: 11, h: 5.2, door: 'pz', title: 'Learning hall', subtitle: 'courses file themselves', windows: true, seed: 3 })
  spot('learn', hall.x, hall.z, 2.5, 'Learning hall', 'Twelve short courses. Pass one and it writes your CV, resume, and portfolio.', 'learn', 'Open the hall')
  const conference = addBuilding({ x: 16, z: -54, w: 8, d: 7, h: 4.2, door: 'pz', title: 'Conference', subtitle: 'ninety seconds', windows: true, seed: 5 })
  spot('conference', conference.x, conference.z, 2.3, 'Conference hall', 'One talk. Proof of work, not a slogan. The chairs are real enough.', 'conference', 'Take a seat')
  const campusCafe = addBuilding({ x: -16, z: -54, w: 8, d: 7, h: 3.6, door: 'pz', title: 'Campus café', subtitle: 'the season, posted', windows: true, seed: 8 })
  spot('campus-cafe', campusCafe.x, campusCafe.z, 2.3, 'Campus café', 'Headlines change with the season. They are not a signal to size up.', 'cafe', 'Read the room')
  addBuilding({ x: -12, z: -36, w: 3.2, d: 2.2, h: 2.5, door: 'pz', title: 'Booth', subtitle: 'no seed asks', seed: 2 })
  addBuilding({ x: 12, z: -36, w: 3.2, d: 2.2, h: 2.5, door: 'pz', title: 'Booth', subtitle: 'one-pagers', seed: 4 })
  spot('booths', 0, -35.2, 2.2, 'Campus booths', 'Projects pin a one-pager here. None of them can ask for your seed.')

  const floor = addBuilding({ x: -48, z: 0, w: 12, d: 16, h: 6, door: 'px', title: 'Trading floor', subtitle: 'spot, sized', windows: true, seed: 11 })
  spot('trade', floor.x, floor.z, 2.6, 'Trading floor', 'A practice book in UNIT. A sized plan can count even when the close is red.', 'trade', 'Open the book')
  const row = addBuilding({ x: 48, z: 0, w: 12, d: 16, h: 6, door: 'nx', title: 'Influencer row', subtitle: 'post the work', windows: true, seed: 13 })
  spot('bounty', row.x, row.z, 2.6, 'Influencer row', 'Write a bounty. Practice pay lands, and the sentence goes on your portfolio.', 'bounty', 'Post a bounty')
  const trench = addBuilding({ x: 0, z: 48, w: 16, d: 11, h: 4.8, door: 'nz', title: 'Trenches', subtitle: 'attention, sized', windows: true, seed: 17 })
  spot('trench', trench.x, trench.z, 2.6, 'Trenches corner', 'MEME moves like attention. It can leave. Rank will not follow it down.', 'trench', 'Open the trench book')

  const shop = addBuilding({ x: 22, z: -22, w: 8, d: 7, h: 3.8, door: 'nx', title: 'Boutique', subtitle: 'free bodies', windows: true, seed: 19 })
  spot('boutique', shop.x, shop.z, 2.4, 'Boutique', 'The man, the woman, and the mascots. Masks from the collection list hang on the side wall.', 'boutique', 'Try a body')
  const gym = addBuilding({ x: -22, z: -22, w: 8, d: 8, h: 4, door: 'px', title: 'Gym', subtitle: 'reps, not leverage', windows: true, seed: 23 })
  spot('gym', gym.x, gym.z, 2.4, 'Gym', 'A short timing set. One logged set a day. Balance is not invited.', 'gym', 'Train')
  // Church: gabled stone nave, tall bell tower + spire + cross on the north facade, arched stained glass,
  // double doors, steps and a forecourt. Faces north to the plaza, away from the house row.
  const church = (() => {
    const cx = 24
    const cz = 27
    const W = 8
    const L = 11
    const H = 6
    const g = new THREE.Group()
    g.position.set(cx, 0, cz)
    const nave = solid(new THREE.BoxGeometry(W, H, L), stone)
    nave.position.y = H / 2
    g.add(nave)
    // Gabled roof: triangular prism along z, slate dark, with eaves.
    const roofShape = new THREE.Shape([new THREE.Vector2(-W / 2 - 0.45, 0), new THREE.Vector2(W / 2 + 0.45, 0), new THREE.Vector2(0, 3.6)])
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: L + 0.6, bevelEnabled: false })
    roofGeo.translate(0, 0, -(L + 0.6) / 2)
    const roof = solid(roofGeo, new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.75, metalness: 0.1 }))
    roof.position.y = H
    g.add(roof)
    // Cornice band and buttresses.
    const cornice = solid(new THREE.BoxGeometry(W + 0.3, 0.3, L + 0.3), stoneDark)
    cornice.position.y = H - 0.15
    g.add(cornice)
    for (let i = 0; i < 4; i += 1) {
      for (const side of [-1, 1]) {
        const b = solid(new THREE.BoxGeometry(0.5, H * 0.8, 0.7), stoneDark)
        b.position.set(side * (W / 2 + 0.25), H * 0.4, -L / 2 + 1.6 + i * 2.6)
        g.add(b)
      }
    }
    // Stained glass texture (arched lancet).
    const glassTex = paint(128, 256, (c) => {
      c.fillStyle = '#1a1410'
      c.fillRect(0, 0, 128, 256)
      c.save()
      c.beginPath()
      c.moveTo(10, 256)
      c.lineTo(10, 70)
      c.quadraticCurveTo(64, -20, 118, 70)
      c.lineTo(118, 256)
      c.closePath()
      c.clip()
      const cols = ['#7a1f2b', '#1f3f7a', '#c99a2e', '#2f6a4a', '#5a2a6a', '#b85a1f']
      for (let y = 0; y < 256; y += 22) for (let x = 0; x < 128; x += 22) {
        c.fillStyle = cols[(x / 22 + y / 22 * 2) % cols.length | 0] ?? '#7a1f2b'
        c.fillRect(x, y, 21, 21)
      }
      c.restore()
      c.strokeStyle = '#2a2018'
      c.lineWidth = 5
      c.beginPath()
      c.moveTo(10, 256)
      c.lineTo(10, 70)
      c.quadraticCurveTo(64, -20, 118, 70)
      c.lineTo(118, 256)
      c.stroke()
    })
    const glassMat = new THREE.MeshStandardMaterial({ map: glassTex, emissive: 0xffffff, emissiveMap: glassTex, emissiveIntensity: 0.25, roughness: 0.2, transparent: true, alphaTest: 0.01 })
    for (let i = 0; i < 4; i += 1) {
      for (const side of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.6), glassMat)
        win.position.set(side * (W / 2 + 0.02), 3.1, -L / 2 + 2.9 + i * 2.6)
        win.rotation.y = side * Math.PI / 2
        win.userData.ghost = true
        g.add(win)
      }
    }
    // Bell tower on the north facade, open belfry, spire and brass cross.
    const T = 3.0
    const tower = solid(new THREE.BoxGeometry(T, 11, T), stone)
    tower.position.set(0, 5.5, -L / 2 - T / 2 + 0.3)
    g.add(tower)
    const belfryZ = -L / 2 - T / 2 + 0.3
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const post = solid(new THREE.BoxGeometry(0.5, 2.2, 0.5), stoneDark)
      post.position.set(x * (T / 2 - 0.25), 12.1, belfryZ + z * (T / 2 - 0.25))
      g.add(post)
    }
    const bell = solid(new THREE.CylinderGeometry(0.25, 0.55, 0.8, 14, 1, true), trim)
    bell.position.set(0, 12.0, belfryZ)
    const deck = solid(new THREE.BoxGeometry(T + 0.3, 0.3, T + 0.3), stoneDark)
    deck.position.set(0, 13.3, belfryZ)
    const spire = solid(new THREE.ConeGeometry(T * 0.72, 6, 8), new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.7, metalness: 0.15 }))
    spire.position.set(0, 16.45, belfryZ)
    spire.rotation.y = Math.PI / 8
    const crossV = solid(new THREE.BoxGeometry(0.16, 1.6, 0.16), trim, false)
    crossV.position.set(0, 20.2, belfryZ)
    const crossH = solid(new THREE.BoxGeometry(0.9, 0.16, 0.16), trim, false)
    crossH.position.set(0, 20.5, belfryZ)
    g.add(bell, deck, spire, crossV, crossH)
    // Rose-ish arched window over the doors and big double doors.
    const front = -L / 2 - T + 0.28
    const rose = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), glassMat)
    rose.position.set(0, 6.6, front)
    rose.rotation.y = Math.PI
    rose.userData.ghost = true
    const arch = solid(new THREE.BoxGeometry(2.4, 3.6, 0.3), stoneDark, false)
    arch.position.set(0, 1.8, front - 0.05)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.7 })
    for (const side of [-1, 1]) {
      const leaf = solid(new THREE.BoxGeometry(0.95, 3.0, 0.12), doorMat, false)
      leaf.position.set(side * 0.5, 1.5, front - 0.22)
      const ring = solid(new THREE.TorusGeometry(0.08, 0.02, 6, 12), trim, false)
      ring.position.set(side * 0.18, 1.4, front - 0.3)
      g.add(leaf, ring)
    }
    g.add(rose, arch)
    // Steps and forecourt with two benches' worth of paving.
    for (let i = 0; i < 3; i += 1) {
      const step = solid(new THREE.BoxGeometry(4.2 - i * 0.5, 0.16, 0.5), stone, false)
      step.position.set(0, 0.08 + i * 0.16, front - 1.6 + i * 0.45)
      step.userData.ghost = true
      g.add(step)
    }
    const court = solid(new THREE.BoxGeometry(7, 0.04, 3), stoneDark, false)
    court.position.set(0, 0.02, front - 3.3)
    court.userData.ghost = true
    g.add(court)
    scene.add(g)
    obstacles.push({ kind: 'box', x: cx, z: cz, hx: W / 2 + 0.55, hz: L / 2 })
    obstacles.push({ kind: 'box', x: cx, z: cz + belfryZ, hx: T / 2 + 0.05, hz: T / 2 + 0.05 })
    reserved.push({ kind: 'box', x: cx, z: cz - 3, hx: W / 2 + 1.8, hz: L / 2 + 5 })
    const at = { x: cx, z: cz + front - 2.0 }
    doors.push({ x: at.x, z: at.z, own: obstacles[obstacles.length - 2] as Obstacle })
    return at
  })()
  spot('church', church.x, church.z, 2.4, 'Church', 'A quiet room. Rest counts. Nobody checks your positions at the door.', 'church', 'Step in')
  for (const home of HOUSES) {
    const door = addBuilding({
      x: home.x,
      z: home.z,
      w: home.w,
      d: home.d,
      h: home.h,
      door: home.door,
      title: home.title,
      subtitle: home.subtitle,
      windows: true,
      seed: home.seed,
    })
    spot(home.id, door.x, door.z, 2.2, home.spotTitle, home.body, 'house', home.enter, home.id)
    if (home.id === 'yours') {
      // Landmark so the player can find home from the plaza: brass roof marker + street signpost.
      const marker = solid(new THREE.OctahedronGeometry(0.6, 0), trim, false)
      marker.position.set(home.x, home.h + 1.6, home.z)
      marker.name = 'home-marker'
      scene.add(marker)
      const post = solid(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), stoneDark)
      post.position.set(door.x - 1.4, 1.2, door.z + 1.6)
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.4), new THREE.MeshStandardMaterial({ map: paint(256, 80, (g) => {
        g.fillStyle = '#14110e'; g.fillRect(0, 0, 256, 80)
        g.strokeStyle = '#c9a25e'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 72)
        g.fillStyle = '#f2ece0'; g.font = '600 38px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('YOUR HOUSE', 128, 42)
      }), roughness: 0.6 }))
      plate.position.set(door.x - 1.4, 2.2, door.z + 1.6)
      plate.rotation.y = -Math.PI / 2
      scene.add(post, plate)
    }
  }
  const net = addBuilding({ x: 28, z: -16, w: 8, d: 6, h: 3.4, door: 'pz', title: 'Terminal café', subtitle: 'gossip and posts', windows: true, seed: 37 })
  spot('net', net.x, net.z, 2.3, 'Internet café', 'Same board as campus, closer to the row. Read it once a day.', 'cafe', 'Read the room')
  const desk = addBuilding({ x: -28, z: 16, w: 4.4, d: 2.6, h: 2.7, door: 'px', title: 'Carbon', subtitle: 'practice pledge', seed: 41 })
  spot('climate', desk.x, desk.z, 2.3, 'Carbon desk', 'Back a project with practice funds. It records the pledge. It does not retire a real tonne.', 'climate', 'The desk')
  const gadgets = addBuilding({ x: -16, z: 14, w: 5.4, d: 4.2, h: 3.1, door: 'pz', title: 'Gadgets', subtitle: 'drones', windows: true, seed: 47 })
  spot('gadgets', gadgets.x, gadgets.z, 2.2, 'Gadgets', 'Scout, courier, and halo. A drone follows you. Practice funds.', 'gadgets', 'Open the case')

  // Walkways: every door gets a paved path to the nearest road or to a path laid before it.
  // Paths are routed around building footprints and the basin, and trees keep off them.
  {
    const blockers: Rect[] = obstacles
      .filter((o): o is Extract<Obstacle, { kind: 'box' }> => o.kind === 'box')
      .map((o) => ({ x: o.x, z: o.z, hx: o.hx, hz: o.hz }))
    blockers.push({ x: -40, z: 40, hx: 6.6, hz: 6.6 })
    type Line = { horizontal: boolean; at: number; from: number; to: number }
    const lines: Line[] = [
      { horizontal: true, at: 0, from: -ROAD_END, to: ROAD_END },
      { horizontal: false, at: 0, from: -ROAD_END, to: ROAD_END },
    ]
    const clear = (rect: Rect, own: Obstacle) =>
      blockers.every((b) => (own.kind === 'box' && b.x === own.x && b.z === own.z) || !overlaps(rect, b))
    const ordered = [...doors].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
    for (const door of ordered) {
      let best: Rect[] | null = null
      let bestLen = Infinity
      const consider = (legs: Rect[], length: number) => {
        if (length < bestLen && legs.every((leg) => clear(leg, door.own))) {
          best = legs
          bestLen = length
        }
      }
      for (const line of lines) {
        if (line.horizontal) {
          // Straight north/south onto the line.
          if (door.x >= line.from && door.x <= line.to) consider([legRect(door.x, door.z, door.x, line.at, WALK_HALF)], Math.abs(door.z - line.at))
          // Across, then north/south onto it.
          const tx = THREE.MathUtils.clamp(door.x, line.from, line.to)
          consider(
            [legRect(door.x, door.z, tx, door.z, WALK_HALF), legRect(tx, door.z, tx, line.at, WALK_HALF)],
            Math.abs(door.x - tx) + Math.abs(door.z - line.at),
          )
        } else {
          if (door.z >= line.from && door.z <= line.to) consider([legRect(door.x, door.z, line.at, door.z, WALK_HALF)], Math.abs(door.x - line.at))
          const tz = THREE.MathUtils.clamp(door.z, line.from, line.to)
          consider(
            [legRect(door.x, door.z, door.x, tz, WALK_HALF), legRect(door.x, tz, line.at, tz, WALK_HALF)],
            Math.abs(door.z - tz) + Math.abs(door.x - line.at),
          )
        }
      }
      const chosen = best as Rect[] | null
      if (!chosen) continue
      for (const leg of chosen) {
        paths.push(leg)
        const horizontal = leg.hx > leg.hz
        lines.push(horizontal
          ? { horizontal: true, at: leg.z, from: leg.x - leg.hx + WALK_HALF, to: leg.x + leg.hx - WALK_HALF }
          : { horizontal: false, at: leg.x, from: leg.z - leg.hz + WALK_HALF, to: leg.z + leg.hz - WALK_HALF })
      }
    }

    const canvas = groundMap.image as HTMLCanvasElement
    const g = canvas.getContext('2d')
    if (g) {
      const scale = canvas.width / SPAN
      const mid = canvas.width / 2
      const fillRect = (r: Rect) => g.fillRect(mid + (r.x - r.hx) * scale, mid + (r.z - r.hz) * scale, r.hx * 2 * scale, r.hz * 2 * scale)
      const roads: Rect[] = [
        { x: 0, z: 0, hx: ROAD_END, hz: ROAD_HALF },
        { x: 0, z: 0, hx: ROAD_HALF, hz: ROAD_END },
      ]
      // Sidewalks first, then the asphalt over them, then walkways.
      g.fillStyle = '#7d8a83'
      for (const road of roads) fillRect({ ...road, hx: road.hx + (road.hx > road.hz ? 0 : 1.3), hz: road.hz + (road.hz > road.hx ? 0 : 1.3) })
      g.fillStyle = '#1e2624'
      for (const road of roads) fillRect(road)
      g.strokeStyle = 'rgba(230, 236, 232, 0.5)'
      g.lineWidth = 3
      g.setLineDash([18, 16])
      g.beginPath()
      g.moveTo(mid - ROAD_END * scale, mid)
      g.lineTo(mid - 16 * scale, mid)
      g.moveTo(mid + 16 * scale, mid)
      g.lineTo(mid + ROAD_END * scale, mid)
      g.moveTo(mid, mid - ROAD_END * scale)
      g.lineTo(mid, mid - 16 * scale)
      g.moveTo(mid, mid + 16 * scale)
      g.lineTo(mid, mid + ROAD_END * scale)
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#5f5a50'
      for (const path of paths) fillRect({ ...path, hx: path.hx + 0.18, hz: path.hz + 0.18 })
      g.fillStyle = '#8d8676'
      for (const path of paths) fillRect(path)
      // The plaza paving sits on top so the roads meet it cleanly.
      g.fillStyle = '#8b9b93'
      g.beginPath()
      g.arc(mid, mid, 15 * scale, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(16, 24, 22, 0.45)'
      g.lineWidth = 2
      for (let radius = 3; radius <= 14; radius += 1.6) {
        g.beginPath()
        g.arc(mid, mid, radius * scale, 0, Math.PI * 2)
        g.stroke()
      }
      g.strokeStyle = 'rgba(26, 243, 143, 0.85)'
      g.lineWidth = 4
      g.beginPath()
      g.arc(mid, mid, 3.1 * scale, 0, Math.PI * 2)
      g.stroke()
      groundMap.needsUpdate = true
    }
  }

  // Masjid: white stone prayer hall with a central dome, a tall minaret with a crescent, arched entrance
  // and windows, and a walled courtyard. Walk-in (door trigger -> 3D prayer hall in interiors.ts).
  const masjid = new THREE.Group()
  const MX = -24
  const MZ = 27
  masjid.position.set(MX, 0, MZ)
  const white = new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: 0.85 })
  Object.assign(white, { normalMap: concrete.normalMap, roughnessMap: concrete.roughnessMap })
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.5, metalness: 0.05 })
  const prayerHall = solid(new THREE.BoxGeometry(10, 5, 9), white)
  prayerHall.position.set(0, 2.5, 1.5)
  const drum = solid(new THREE.CylinderGeometry(3.0, 3.0, 1.2, 24), white)
  drum.position.set(0, 5.6, 1.5)
  const dome = solid(new THREE.SphereGeometry(3.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat)
  dome.position.set(0, 6.2, 1.5)
  const finial = solid(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), trim, false)
  finial.position.set(0, 9.6, 1.5)
  masjid.add(prayerHall, drum, dome, finial)
  // Minaret with balcony and crescent.
  const minaret = solid(new THREE.CylinderGeometry(0.75, 0.9, 14, 12), white)
  minaret.position.set(4.6, 7, -3.4)
  const balcony = solid(new THREE.CylinderGeometry(1.15, 1.0, 0.35, 14), stoneDark)
  balcony.position.set(4.6, 11.2, -3.4)
  const cap = solid(new THREE.ConeGeometry(0.8, 2.2, 12), domeMat)
  cap.position.set(4.6, 15.1, -3.4)
  const crescent = solid(new THREE.TorusGeometry(0.32, 0.06, 6, 18, Math.PI * 1.45), trim, false)
  crescent.position.set(4.6, 16.75, -3.4)
  crescent.rotation.z = Math.PI * 0.27
  masjid.add(minaret, balcony, cap, crescent)
  // Arched entrance (north) and arched windows.
  const archTex = paint(128, 192, (c) => {
    c.fillStyle = '#f1ece2'; c.fillRect(0, 0, 128, 192)
    c.fillStyle = '#2c2a26'
    c.beginPath(); c.moveTo(16, 192); c.lineTo(16, 70); c.quadraticCurveTo(64, -10, 112, 70); c.lineTo(112, 192); c.fill()
    c.strokeStyle = '#c9a25e'; c.lineWidth = 6; c.stroke()
  })
  const archMat = new THREE.MeshStandardMaterial({ map: archTex, roughness: 0.7 })
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.3), archMat)
  door.position.set(0, 1.65, 1.5 - 4.52)
  door.rotation.y = Math.PI
  masjid.add(door)
  for (const x of [-3.4, 3.4]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.7), archMat)
    w.position.set(x, 2.6, 1.5 - 4.52)
    w.rotation.y = Math.PI
    masjid.add(w)
  }
  for (const z of [-0.5, 2.0, 4.5]) for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.7), archMat)
    w.position.set(side * 5.02, 2.6, z)
    w.rotation.y = side * Math.PI / 2
    masjid.add(w)
  }
  // Courtyard: low walls with a gap at the gate, paving, and a small fountain for wudu.
  const yard = solid(new THREE.BoxGeometry(10, 0.05, 5), stone, false)
  yard.position.set(0, 0.03, -5.6)
  yard.userData.ghost = true
  const wallW = new THREE.BoxGeometry(0.35, 1.0, 5)
  for (const x of [-5, 5]) {
    const wl = solid(wallW, white)
    wl.position.set(x, 0.5, -5.6)
    masjid.add(wl)
    obstacles.push({ kind: 'box', x: MX + x, z: MZ - 5.6, hx: 0.3, hz: 2.55 })
  }
  for (const x of [-3.3, 3.3]) {
    const wl = solid(new THREE.BoxGeometry(3.4, 1.0, 0.35), white)
    wl.position.set(x, 0.5, -8.1)
    masjid.add(wl)
    obstacles.push({ kind: 'box', x: MX + x, z: MZ - 8.1, hx: 1.75, hz: 0.3 })
  }
  const fountain = solid(new THREE.CylinderGeometry(0.7, 0.8, 0.5, 16), white)
  fountain.position.set(-3.2, 0.25, -5.6)
  obstacles.push({ kind: 'circle', x: MX - 3.2, z: MZ - 5.6, r: 0.85 })
  masjid.add(yard, fountain)
  // Signpost.
  const signPost = solid(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), stoneDark)
  signPost.position.set(1.8, 1.2, -8.6)
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.42), new THREE.MeshStandardMaterial({ map: paint(256, 80, (c) => {
    c.fillStyle = '#14110e'; c.fillRect(0, 0, 256, 80); c.strokeStyle = '#c9a25e'; c.lineWidth = 4; c.strokeRect(4, 4, 248, 72)
    c.fillStyle = '#f2ece0'; c.font = '600 40px Outfit, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MASJID', 128, 42)
  }), roughness: 0.6 }))
  plate.position.set(1.8, 2.2, -8.62)
  plate.rotation.y = Math.PI
  masjid.add(signPost, plate)
  scene.add(masjid)
  obstacles.push({ kind: 'box', x: MX, z: MZ + 1.5, hx: 5.15, hz: 4.65 })
  obstacles.push({ kind: 'circle', x: MX + 4.6, z: MZ - 3.4, r: 1.0 })
  reserved.push({ kind: 'box', x: MX, z: MZ - 1.5, hx: 7, hz: 8 })
  spot('prayer', MX, MZ - 3.9, 1.6, 'Masjid', 'The prayer hall. Shoes off, phone quiet. Sitting puts focus on your next course.', 'prayer', 'Go inside')

  const screenOf = (key: 'unit' | 'meme', x: number, z: number, rotationY: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not paint a book screen.')
    const texture = finalize(new THREE.CanvasTexture(canvas))
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.6),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    )
    plane.position.set(x, 3.1, z)
    plane.rotation.y = rotationY
    plane.userData.ghost = true
    scene.add(plane)
    return { canvas, context, texture, key }
  }
  const screens = [
    screenOf('unit', -41.7, 3.2, Math.PI / 2),
    screenOf('meme', 3.2, 42.2, Math.PI),
  ]

  const emblem = new THREE.Group()
  const basin = solid(new THREE.CylinderGeometry(2.7, 2.9, 0.55, 40), stone)
  basin.position.y = 0.28
  const rim = solid(new THREE.TorusGeometry(2.7, 0.08, 8, 40), stoneDark)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.55
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.45, 40), waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.48
  const pedestal = solid(new THREE.CylinderGeometry(0.16, 0.22, 1.05, 10), stoneDark)
  pedestal.position.y = 1
  emblem.position.y = 1.72
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2 * aspect),
    new THREE.MeshBasicMaterial({ map: mark, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, toneMapped: false }),
  )
  plane.userData.ghost = true
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.025, 8, 40), trim)
  halo.userData.ghost = true
  emblem.add(plane, halo)
  scene.add(basin, rim, water, pedestal, emblem)
  obstacles.push({ kind: 'circle', x: 0, z: 0, r: 2.9 })
  addGlow(0, 1.6, 0, 0xffd9a0, 12)
  for (let i = 0; i < 3; i += 1) {
    const ripple = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.02, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0.1, depthWrite: false, toneMapped: false }),
    )
    ripple.rotation.x = Math.PI / 2
    ripple.position.y = 0.52
    ripple.userData.ghost = true
    scene.add(ripple)
    ripples.push({ mesh: ripple, offset: i / 3 })
  }
  spot('ring', 0, 0, 4.4, 'The Grind Ring', 'Same stone for a shrimp and a whale. No tribe. No continent. Just come grind.')

  const totem = new THREE.Group()
  totem.position.set(-9, 0, -8)
  totem.rotation.y = Math.atan2(9, 8)
  const plinth = solid(new THREE.BoxGeometry(1.05, 0.28, 0.7), stoneDark)
  plinth.position.y = 0.14
  const pole = solid(new THREE.BoxGeometry(0.16, 1.7, 0.12), stone)
  pole.position.set(0, 1.15, -0.08)
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), ladderMat)
  board.position.set(0, 1.22, 0.02)
  board.userData.ghost = true
  totem.add(plinth, pole, board)
  scene.add(totem)
  obstacles.push({ kind: 'circle', x: -9, z: -8, r: 0.7 })
  spot('ladder', -9, -8, 2.3, 'The ladder', 'Shrimp, crab, fish, dolphin, shark, whale. Skill and the days you return. A bigger balance does not move it.')

  const addBench = (x: number, z: number) => {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    group.rotation.y = Math.atan2(-x, -z)
    const seat = solid(new THREE.BoxGeometry(1.35, 0.1, 0.48), wood)
    seat.position.y = 0.46
    const back = solid(new THREE.BoxGeometry(1.35, 0.42, 0.08), wood)
    back.position.set(0, 0.72, -0.2)
    const legL = solid(new THREE.BoxGeometry(0.08, 0.46, 0.38), stoneDark)
    legL.position.set(-0.52, 0.23, 0)
    const legR = solid(new THREE.BoxGeometry(0.08, 0.46, 0.38), stoneDark)
    legR.position.set(0.52, 0.23, 0)
    group.add(seat, back, legL, legR)
    scene.add(group)
    obstacles.push({ kind: 'circle', x, z, r: 0.72 })
  }
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    addBench(Math.cos(angle) * 6.6, Math.sin(angle) * 6.6)
  }

  const treeSpots: Array<[number, number, number]> = [
    [10.2, 7.4, 1],
    [-10.6, 6.6, 0.9],
    [9.2, -8.8, 1.05],
    [-12.2, -7.4, 0.95],
    [7.4, 12.2, 0.85],
    [-7.2, -12.4, 1],
    [12.4, -6.2, 0.9],
    [-12.6, 5.2, 1],
  ]
  const clearOf = (x: number, z: number) => {
    if (Math.abs(x) < 5 || Math.abs(z) < 5) return false
    if (Math.hypot(x, z) < 15) return false
    if (Math.hypot(x + 40, z - 40) < 11) return false
    if (Math.abs(x) > 56 || Math.abs(z) > 56) return false
    if (Math.abs(x) < ROAD_HALF + 2 || Math.abs(z) < ROAD_HALF + 2) return false
    if (paths.some((path) => overlaps(path, { x, z, hx: 0.7, hz: 0.7 }))) return false
    return reserved.every((box) => {
      if (box.kind !== 'box') return true
      return Math.abs(x - box.x) > box.hx || Math.abs(z - box.z) > box.hz
    })
  }
  const rand = mulberry32(19)
  for (let i = 0; i < 220 && treeSpots.length < 64; i += 1) {
    const x = (rand() - 0.5) * 100
    const z = (rand() - 0.5) * 100
    if (!clearOf(x, z)) continue
    treeSpots.push([x, z, 0.8 + rand() * 0.45])
  }
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2
    const x = -40 + Math.cos(angle) * 9
    const z = 40 + Math.sin(angle) * 9
    if (clearOf(x, z)) treeSpots.push([x, z, 0.85 + (i % 3) * 0.1])
  }

  const dummy = new THREE.Object3D()
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.05, 5), bark, treeSpots.length)
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.72, 0), leaf, treeSpots.length)
  trunks.castShadow = true
  trunks.receiveShadow = true
  crowns.castShadow = true
  const crowns2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.55, 0), leaf, treeSpots.length)
  crowns2.castShadow = true
  treeSpots.forEach(([x, z, base], index) => {
    // Full-size street and park trees (~4 m), visible at every quality level.
    const scale = base * 1.9
    dummy.position.set(x, 0.52 * scale, z)
    dummy.scale.setScalar(scale)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    trunks.setMatrixAt(index, dummy.matrix)
    dummy.position.set(x, 1.45 * scale, z)
    dummy.scale.set(scale, scale * 0.82, scale)
    dummy.updateMatrix()
    crowns.setMatrixAt(index, dummy.matrix)
    dummy.position.set(x + 0.15 * scale, 1.95 * scale, z - 0.1 * scale)
    dummy.rotation.set(0, index, 0)
    dummy.scale.setScalar(scale * 0.8)
    dummy.updateMatrix()
    crowns2.setMatrixAt(index, dummy.matrix)
    obstacles.push({ kind: 'circle', x, z, r: 0.2 * scale })
  })
  for (const m of [trunks, crowns, crowns2]) m.computeBoundingSphere()
  scene.add(trunks, crowns, crowns2)

  const addLamp = (x: number, z: number) => {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    const pole = solid(new THREE.CylinderGeometry(0.045, 0.06, 2.3, 6), stoneDark)
    pole.position.y = 1.15
    const head = solid(new THREE.SphereGeometry(0.14, 10, 8), lampMat, false)
    head.position.y = 2.35
    group.add(pole, head)
    scene.add(group)
    obstacles.push({ kind: 'circle', x, z, r: 0.26 })
  }
  for (const [x, z] of [
    [-14, 4.8],
    [-28, 4.8],
    [-38, 4.8],
    [14, -4.8],
    [28, -4.8],
    [38, -4.8],
    [4.8, -14],
    [4.8, -28],
    [4.8, -38],
    [-4.8, 14],
    [-4.8, 28],
    [-4.8, 38],
  ] as const) addLamp(x, z)

  const basinWater = new THREE.Mesh(new THREE.CircleGeometry(6.2, 32), waterMat)
  basinWater.rotation.x = -Math.PI / 2
  basinWater.position.set(-40, 0.14, 40)
  const basinRim = solid(new THREE.TorusGeometry(6.35, 0.28, 6, 40), stone)
  basinRim.rotation.x = -Math.PI / 2
  basinRim.position.set(-40, 0.14, 40)
  scene.add(basinWater, basinRim)
  obstacles.push({ kind: 'circle', x: -40, z: 40, r: 6 })
  spot('water', -34, 34, 2.4, 'The basin', 'Park water. Climate work has a desk just north of here. Swimming is not the pledge.')
  addGlow(-40, 1.2, 40, 0xbfe6ff, 6)
  addGlow(hall.x, 2.2, hall.z, 0xffe2b8, 8)
  addGlow(floor.x, 2.2, floor.z, 0x9fd4ff, 8)
  addGlow(row.x, 2.2, row.z, 0xffb089, 8)
  addGlow(trench.x, 2.2, trench.z, 0xff8fbf, 7)

  const skyRand = mulberry32(4)
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2
    const dist = 72 + skyRand() * 6
    const height = 7 + skyRand() * 10
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(3 + skyRand() * 2, height, 3 + skyRand() * 2),
      new THREE.MeshStandardMaterial({ color: 0x1c2824, roughness: 0.9 }),
    )
    box.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist)
    box.userData.ghost = true
    box.castShadow = false
    scene.add(box)
  }

  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xd7efe4, toneMapped: false }))
  moon.position.set(-28, 32, -24)
  moon.userData.ghost = true
  scene.add(moon)
  const starPositions = new Float32Array(80 * 3)
  const starRand = mulberry32(8)
  for (let i = 0; i < 80; i += 1) {
    const angle = starRand() * Math.PI * 2
    const radius = 40 + starRand() * 40
    starPositions[i * 3] = Math.cos(angle) * radius
    starPositions[i * 3 + 1] = 14 + starRand() * 28
    starPositions[i * 3 + 2] = Math.sin(angle) * radius
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPositions, 3)),
    new THREE.PointsMaterial({ color: 0xe7fff4, size: 0.16, toneMapped: false, sizeAttenuation: true }),
  )
  stars.userData.ghost = true
  scene.add(stars)

  const drawScreen = (screen: (typeof screens)[number], values: number[]) => {
    const g = screen.context
    g.fillStyle = '#0c1411'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#17f790'
    g.font = '600 18px Outfit, sans-serif'
    g.fillText(screen.key === 'unit' ? 'UNIT' : 'MEME', 12, 22)
    if (values.length < 2) {
      screen.texture.needsUpdate = true
      return
    }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(0.0001, max - min)
    const last = values[values.length - 1] ?? min
    const first = values[0] ?? min
    g.strokeStyle = last >= first ? '#17f790' : '#ff6f61'
    g.lineWidth = 3
    g.beginPath()
    values.forEach((value, index) => {
      const x = 12 + (index / (values.length - 1)) * 232
      const y = 112 - ((value - min) / span) * 78
      if (index === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    })
    g.stroke()
    screen.texture.needsUpdate = true
  }

  let nextScreen = 0
  let trimPulse = 1.12
  const setLook = (look: { time: TimeOfDay; season: Season }) => {
    const night = look.time === 'night'
    const dusk = look.time === 'dusk'
    const bear = look.season === 'bear'
    seasonBear = bear
    background.setHex(night ? 0x070a09 : dusk ? 0x24160f : 0xc5ddd2)
    fog.color.copy(background)
    fog.density = night ? 0.009 : dusk ? 0.007 : 0.0045
    sun.color.setHex(bear ? 0xc9d7ff : dusk ? 0xffb27a : 0xfff1d6)
    sun.intensity = (night ? 0.7 : dusk ? 1.2 : 1.7) * (bear ? 0.82 : 1)
    hemi.intensity = night ? 0.4 : dusk ? 0.66 : 1.08
    hemi.color.setHex(night ? 0xb7d4ff : 0xfff4e8)
    hemi.groundColor.setHex(night ? 0x1c2e26 : 0x3d4f3a)
    fill.intensity = night ? 0.22 : 0.35
    lampMat.emissiveIntensity = night ? 0.95 : dusk ? 0.45 : 0.08
    trimPulse = night ? 1.12 : dusk ? 0.7 : 0.35
    trim.emissiveIntensity = trimPulse
    waterMat.emissiveIntensity = night ? 0.5 : 0.12
    for (const facade of facades) facade.emissiveIntensity = night ? 0.32 : dusk ? 0.16 : 0.05
    for (const light of glow) light.intensity = night ? Number(light.userData.night) : dusk ? Number(light.userData.night) * 0.35 : 0
    moon.visible = night || dusk
    stars.visible = night
  }

  let seasonBear = false
  const nightSky = new THREE.Color(0x02040a)
  const nightLow = new THREE.Color(0x0a1210)
  const duskSky = new THREE.Color(0x2a3a6a)
  const duskLow = new THREE.Color(0xff9a5a)
  const daySky = new THREE.Color(0x3d8fe0)
  const dayLow = new THREE.Color(0xcfe6f0)
  const tmpA = new THREE.Color()
  const tmpB = new THREE.Color()
  const sunDay = new THREE.Color(0xffe2b8)
  const sunDusk = new THREE.Color(0xffb27a)
  const moonLight = new THREE.Color(0x8fa8ff)
  const setDaylight = (phase: number) => {
    const angle = (phase - 0.25) * Math.PI * 2
    const elev = Math.sin(angle)
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.3)
    const dusk = Math.exp(-((elev / 0.16) ** 2))
    const night = 1 - day
    tmpA.copy(nightSky).lerp(daySky, day).lerp(duskSky, dusk * 0.6)
    tmpB.copy(nightLow).lerp(dayLow, day).lerp(duskLow, dusk * 0.75)
    skyTop.copy(tmpA)
    skyLow.copy(tmpB)
    background.copy(tmpB)
    fog.color.copy(tmpB)
    fog.density = 0.009 - day * 0.0045
    // The key light is the sun by day and the moon by night, always from above the horizon.
    const up = Math.max(0.35, Math.abs(elev))
    const side = Math.cos(angle) * (elev >= 0 ? 1 : -1)
    sunOffset.set(side * 20, 8 + up * 18, 10)
    sun.color.copy(elev >= 0 ? sunDay : moonLight).lerp(sunDusk, dusk * 0.7)
    if (seasonBear) sun.color.lerp(moonLight, 0.25)
    sun.intensity = (elev >= 0 ? 0.4 + day * 0.85 : 0.3) * (seasonBear ? 0.85 : 1)
    hemi.intensity = 0.25 + day * 0.4
    hemi.color.copy(moonLight).lerp(sunDay, day)
    hemi.groundColor.setHex(0x1c2e26).lerp(tmpA.setHex(0x3d4f3a), day)
    fill.intensity = 0.12
    lampMat.emissiveIntensity = 0.08 + night * 0.87
    trimPulse = 0.25 + night * 0.45
    trim.emissiveIntensity = trimPulse
    waterMat.emissiveIntensity = 0.12 + night * 0.38
    // Wet-street night: the ground picks up neon and the env map after dark.
    groundMat.roughness = 0.92 - night * 0.5
    groundMat.metalness = 0.02 + night * 0.28
    for (const facade of facades) facade.emissiveIntensity = 0.04 + night * 0.3
    for (const light of glow) light.intensity = Number(light.userData.night) * Math.max(0, night - 0.1)
    moon.visible = night > 0.25
    moon.position.set(-Math.cos(angle) * 40, Math.max(12, -elev * 40), -24)
    stars.visible = night > 0.6
  }

  if (reduceMotion) {
    ripples.forEach((ripple, index) => {
      ripple.mesh.scale.setScalar(0.7 + index * 0.45)
      const material = ripple.mesh.material as THREE.MeshBasicMaterial
      material.opacity = 0.2
    })
  }

  return {
    obstacles,
    hotspots,
    sun,
    setLook,
    setDaylight,
    lanes: { roadHalf: ROAD_HALF, walk: ROAD_HALF + 0.7, inner: 18, outer: 39 },
    setRank(label: string) {
      ladderMap.dispose()
      ladderMap = paintLadder(label)
      ladderMat.map = ladderMap
    },
    tick(time, focus) {
      sun.position.set(focus.x + sunOffset.x, sunOffset.y, focus.z + sunOffset.z)
      sky.position.set(focus.x, 0, focus.z)
      sun.target.position.set(focus.x, 0, focus.z)
      sun.target.updateMatrixWorld()
      if (!reduceMotion) {
        trim.emissiveIntensity = trimPulse + Math.sin(time * 1.7) * 0.08
        emblem.rotation.y = time * 0.35
        for (const ripple of ripples) {
          const t = (time * 0.16 + ripple.offset) % 1
          const scale = 0.35 + t * 2.1
          ripple.mesh.scale.set(scale, scale, 1)
          const material = ripple.mesh.material as THREE.MeshBasicMaterial
          material.opacity = (1 - t) * 0.45
        }
      }
      if (time < nextScreen) return
      nextScreen = time + 0.5
      const series = getSeries()
      for (const screen of screens) drawScreen(screen, screen.key === 'unit' ? series.unit : series.meme)
    },
  }
}
