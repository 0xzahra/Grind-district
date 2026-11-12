import { ESTATE_ZONES } from './estate.ts'
import { HOUSES, type HouseId } from './houses.ts'
import type { Graphics, PanelId, Season, TimeOfDay } from './logic.ts'
import { LOOK, lightBudget } from './lookPalette.ts'
import { CITY_LIMIT, type Obstacle } from './physics.ts'
import * as THREE from 'three'
import { FOOTPRINTS, LANE_INNER, LANE_OUTER, RING_IN, RING_OUT, ROAD_END, ROAD_HALF, SIDE_LINES, SIDE_RECTS } from './lanes.ts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createArchitecture, type Facade, type Style } from './architecture.ts'
import { buildShowroom } from './showcase.ts'
import { createDrinkStand } from './drinkStand.ts'
import { facetMap, paintFacets } from './facets.ts'
import { createTrees, foliageMaterial } from './trees.ts'
import { groundDetail } from './groundDetail.ts'

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
  lampSpots: { x: number; z: number }[]
  treeSpots: { x: number; z: number }[]
  obstacles: Obstacle[]
  hotspots: Hotspot[]
  sun: THREE.DirectionalLight
  groundMat: THREE.MeshStandardMaterial
  hemi: THREE.HemisphereLight
  tick: (time: number, focus: THREE.Vector3) => void
  setLook: (look: { time: TimeOfDay; season: Season }) => void
  setRank: (label: string) => void
  /** Continuous day clock. 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. */
  setDaylight: (phase: number) => void
  /** Sidewalk lanes and stop lines for the ambient city. */
  lanes: { roadHalf: number; walk: number; inner: number; outer: number }
  /** Real-time light budget per graphics tier (lookPalette.ts). Call on tier change only. */
  setQuality: (graphics: Graphics) => void
}

type Door = 'px' | 'nx' | 'pz' | 'nz'
/** Axis-aligned walkway rectangle, centre and half extents. */
type Rect = { x: number; z: number; hx: number; hz: number }

const WALK_HALF = 1.1
const ASPHALT = '#4d4f53' // sun-bleached asphalt: near-black roads made the whole street read as dim

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
  if (Math.hypot(x, z - 48) < 22) return 'Mempool'
  if (Math.hypot(x + 40, z - 40) < 14) return 'The basin'
  if (z < -16 && Math.abs(x) < 8) return 'Campus'
  if (x < -16 && Math.abs(z) < 8) return 'Trading floor'
  if (x > 16 && Math.abs(z) < 8) return 'Influencer row'
  if (z > 16 && Math.abs(x) < 8) return 'Mempool'
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
  void mark; void aspect // logo mark now lives on cars; kept in options for API stability
  const obstacles: Obstacle[] = []
  const hotspots: Hotspot[] = []
  const reserved: Obstacle[] = []
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
  // Flat, faceted finishes (facets.ts): large planes of tone over a matte colour, no photo textures.
  Object.assign(stone, { map: facetMap(11, 2, 0.1, 1, anisotropy), color: new THREE.Color(0xdcd3c4), roughness: 0.95, metalness: 0 })
  Object.assign(stoneDark, { map: facetMap(19, 2, 0.12, 1, anisotropy), color: new THREE.Color(0x857f76), roughness: 0.95, metalness: 0 })
  Object.assign(trim, { color: new THREE.Color(0xd9b26a), metalness: 0.9, roughness: 0.55 })
  for (const m of [stone, stoneDark, trim]) m.needsUpdate = true
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a38, roughness: 0.82 })
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xf6ecd8,
    emissive: 0xffc27a,
    emissiveIntensity: 0.9,
    roughness: 0.6,
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
      g.font = '36px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
      g.fillText('THE LADDER', 256, 78)
      const ranks = ['WHALE', 'SHARK', 'DOLPHIN', 'FISH', 'CRAB', 'SHRIMP']
      const you = current.toUpperCase()
      ranks.forEach((rank, index) => {
        const y = 210 + index * 120
        if (rank === you) {
          g.fillStyle = '#c9a25e'
          g.fillRect(48, y - 42, 416, 84)
          g.fillStyle = '#062117'
          g.font = '800 52px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
        } else {
          g.fillStyle = '#a89c88'
          g.font = '800 42px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
        }
        g.fillText(rank, 256, y)
      })
    })

  let ladderMap = paintLadder(options.rankLabel)
  const ladderMat = new THREE.MeshBasicMaterial({ map: ladderMap, toneMapped: false })

  const groundMap = paint(2048, 2048, (g) => {
    const scale = 2048 / SPAN
    const mid = 1024
    const toX = (x: number) => mid + x * scale
    const toY = (z: number) => mid + z * scale
    // Pale warm stone ground in big soft facets (about 7 m across): planar, matte, no noise.
    paintFacets(g, 2048, 2048, 41, 26, 0.085, [205, 196, 180])
    // Park: a faceted lawn round the basin.
    g.save()
    g.beginPath(); g.arc(toX(-40), toY(40), 14 * scale, 0, Math.PI * 2); g.clip()
    paintFacets(g, 2048, 2048, 43, 40, 0.16, [118, 150, 98])
    g.restore()
    g.fillStyle = '#5d7f6a'
    g.beginPath(); g.arc(toX(-40), toY(40), 6.4 * scale, 0, Math.PI * 2); g.fill()
    // Forecourts of the four district halls: a slightly cooler, lighter stone so each has its own apron.
    const court = (x: number, z: number, w: number, d: number, seed: number) => {
      g.save()
      g.beginPath(); g.rect(toX(x - w / 2), toY(z - d / 2), w * scale, d * scale); g.clip()
      paintFacets(g, 2048, 2048, seed, 34, 0.07, [214, 208, 197])
      g.restore()
      g.strokeStyle = 'rgba(120,108,90,0.5)'; g.lineWidth = 3
      g.strokeRect(toX(x - w / 2), toY(z - d / 2), w * scale, d * scale)
    }
    court(0, -48, 32, 26, 51); court(-48, 0, 24, 30, 53); court(48, 0, 24, 30, 57); court(0, 48, 32, 24, 59)
  })

  const groundMat = new THREE.MeshStandardMaterial({ map: groundMap, roughness: 1, metalness: 0, color: 0xf2ebe0 })
  groundDetail(groundMat, anisotropy)
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
  sun.shadow.normalBias = 0.06
  sun.shadow.radius = 4 // wide, soft penumbra
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

  // Night lighting: only lamps light the city. A small pool of shadowless point lights follows the
  // player to the nearest lamps; every lamp also gets an additive ground light decal (one draw call).
  const lampSpots: { x: number; z: number; y: number }[] = []
  const POOL = 6
  const pool: THREE.PointLight[] = []
  for (let i = 0; i < POOL; i++) {
    const l = new THREE.PointLight(0xffc98a, 0, 13, 2)
    l.castShadow = false
    l.position.set(0, -50, 0)
    scene.add(l)
    pool.push(l)
  }
  let poolNight = 0
  let poolAcc = 1
  const decalTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')!
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(255,214,160,1)'); r.addColorStop(0.35, 'rgba(255,190,120,0.45)'); r.addColorStop(1, 'rgba(255,170,100,0)')
    g.fillStyle = r; g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  })()
  const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })
  let decals: THREE.InstancedMesh | null = null
  const buildDecals = () => {
    const all = [...lampSpots, ...glowSpots]
    decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), decalMat, all.length)
    const m = new THREE.Matrix4()
    all.forEach((p, i) => decals!.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, 0.04, p.z), new THREE.Quaternion(), new THREE.Vector3(7, 1, 7))))
    decals.renderOrder = 1
    decals.userData.ghost = true
    decals.raycast = () => undefined
    decals.frustumCulled = false
    scene.add(decals)
  }
  const glowSpots: { x: number; z: number; y: number }[] = []
  const addGlow = (x: number, y: number, z: number, color: number, night: number) => {
    glowSpots.push({ x, z, y })
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

  // No gateway arches and no mid-road / roadside boards (Zahra MacBook: CAMPUS gate blocked the
  // carriageway; cars drove under/through it). District names live only on building facade signs.
  spot('north-arch', 0, -13.4, 2.5, 'Campus road', 'Road north to the learning hall, where courses build your CV.')
  spot('south-arch', 0, 13.4, 2.5, 'Mempool road', 'Road south to Mempool, the fast-moving meme desk.')
  spot('west-arch', -13.4, 0, 2.5, 'Trading road', 'Road west to the trading floor.')
  spot('east-arch', 13.4, 0, 2.5, 'Row road', 'Road east to Influencer Row, where you can post bounties.')

  // Buildings come from the architecture kit (architecture.ts): tiled facades, podium shopfronts, parapets with
  // edge lighting and small fascia signs, merged per material across the city. Footprints and doors are unchanged.
  const architecture = createArchitecture({ anisotropy, stone, stoneDark, leaf: foliageMaterial(), boxUV: boxProjectUV })
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
    style?: Style
    facade?: Facade
    mint?: boolean
    floors?: number
  }) => {
    for (const extra of architecture.build(spec)) scene.add(extra)
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
    return at
  }

  const hall = addBuilding({ x: 0, z: -48, w: 16, d: 11, h: 5.2, door: 'pz', title: 'Campus', subtitle: 'learn', seed: 3, style: 'civic', floors: 2 })
  spot('learn', hall.x, hall.z, 2.5, 'Campus', 'Take short courses. Each one you pass is added to your CV.', 'learn', 'Open the hall')
  const conference = addBuilding({ x: 16, z: -54, w: 8, d: 7, h: 4.2, door: 'pz', title: 'Conference', subtitle: 'web3 events', seed: 5, style: 'glass', floors: 2 })
  spot('conference', conference.x, conference.z, 2.3, 'Conference centre', 'Stage, seats and the Web3 events schedule. Join an event for in-game cash.', 'conference', 'Go inside')
  const lounge = addBuilding({ x: -40, z: -36, w: 9, d: 7, h: 4.4, door: 'px', title: 'Members lounge', subtitle: 'rooms open by rank', seed: 53, style: 'brick', facade: 'charcoal' })
  spot('lounge', lounge.x, lounge.z, 2.4, 'Members lounge', 'Rooms and stations open as your rank grows. Friends can visit.', undefined, 'Go inside')
  const campusCafe = addBuilding({ x: -16, z: -54, w: 8, d: 7, h: 3.6, door: 'pz', title: 'Campus café', subtitle: 'the season, posted', seed: 8, style: 'brick' })
  spot('campus-cafe', campusCafe.x, campusCafe.z, 2.3, 'Campus café', 'Grab a coffee and read today\'s market headlines.', 'cafe', 'Read the room')
  addBuilding({ x: -12, z: -36, w: 3.2, d: 2.2, h: 2.6, door: 'pz', title: 'Booth', subtitle: 'no seed asks', seed: 2, style: 'kiosk' })
  addBuilding({ x: 12, z: -36, w: 3.2, d: 2.2, h: 2.6, door: 'pz', title: 'Booth', subtitle: 'one-pagers', seed: 4, style: 'kiosk' })
  spot('booths', 0, -35.2, 2.2, 'Campus booths', 'Project stands. Browse what teams are building.')

  const floor = addBuilding({ x: -48, z: 0, w: 12, d: 16, h: 6, door: 'px', title: 'Trade', subtitle: 'spot book', seed: 11, style: 'glass', mint: true, floors: 3 })
  spot('trade', floor.x, floor.z, 2.6, 'Trading floor', 'Buy and sell coins and tokens with in-game cash and practise sizing your trades.', 'trade', 'Open the book')
  const row = addBuilding({ x: 48, z: 0, w: 12, d: 16, h: 6, door: 'nx', title: 'Bounty', subtitle: 'post', seed: 13, style: 'civic', mint: true, floors: 3 })
  spot('bounty', row.x, row.z, 2.6, 'Influencer row', 'Post a bounty to earn in-game cash and add it to your portfolio.', 'bounty', 'Post a bounty')
  const trench = addBuilding({ x: 0, z: 48, w: 16, d: 11, h: 4.8, door: 'nz', title: 'Mempool', subtitle: 'meme desk', seed: 18, style: 'brick', mint: true, floors: 2 })
  spot('trench', trench.x, trench.z, 2.6, 'Mempool', 'Trade the volatile MEME coin. Big swings, high risk.', 'trench', 'Open the meme book')

  const shop = addBuilding({ x: 22, z: -22, w: 8, d: 7, h: 3.8, door: 'nx', title: 'Boutique', subtitle: 'free bodies', seed: 19, style: 'arch' })
  spot('boutique', shop.x, shop.z, 2.4, 'Boutique', 'Clothing store. Change your character, outfit and mask.', 'boutique', 'Try a body')
  const gym = addBuilding({ x: -22, z: -22, w: 8, d: 8, h: 4, door: 'px', title: 'Gym', subtitle: 'reps, not leverage', seed: 23, style: 'brick', facade: 'charcoal', mint: true })
  spot('gym', gym.x, gym.z, 2.4, 'Gym', 'Do a quick timing workout. One set a day keeps your streak going.', 'gym', 'Train')
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
      // Faceted jewel panes with dark leading (large triangles, like the rest of the city).
      const cols = ['#8a2a38', '#27508f', '#d3a640', '#2f7a58', '#6a3a7c', '#c46a2a', '#3f8f9a']
      const pr = mulberry32(77)
      const pt = (i: number, j: number): [number, number] => [i * 32 + (i % 4 ? (pr() - 0.5) * 16 : 0), j * 32 + (pr() - 0.5) * 14]
      const grid: [number, number][][] = []
      for (let j = 0; j <= 8; j++) { grid.push([]); for (let i = 0; i <= 4; i++) grid[j]!.push(pt(i, j)) }
      c.lineWidth = 3
      c.strokeStyle = '#1c1612'
      for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) {
        const q = [grid[j]![i]!, grid[j]![i + 1]!, grid[j + 1]![i + 1]!, grid[j + 1]![i]!]
        for (const tri of (i + j) % 2 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]]) {
          c.fillStyle = cols[Math.floor(pr() * cols.length)]!
          c.beginPath(); c.moveTo(tri[0]![0], tri[0]![1]); c.lineTo(tri[1]![0], tri[1]![1]); c.lineTo(tri[2]![0], tri[2]![1]); c.closePath(); c.fill(); c.stroke()
        }
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
  spot('church', church.x, church.z, 2.4, 'Church', 'A quiet place to sit and rest.', 'church', 'Step in')
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
      seed: home.seed,
      style: 'house',
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
        g.fillStyle = '#f2ece0'; g.font = '600 38px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('YOUR HOUSE', 128, 42)
      }), roughness: 0.6 }))
      plate.position.set(door.x - 1.4, 2.2, door.z + 1.6)
      plate.rotation.y = -Math.PI / 2
      scene.add(post, plate)
    }
  }
  // z was -16: its footprint overlapped the Boutique shell (22,-22) by ~2.3m x / 0.8m z. Moved clear.
  const net = addBuilding({ x: 28, z: -13, w: 8, d: 6, h: 3.4, door: 'pz', title: 'Terminal café', subtitle: 'gossip and posts', seed: 37, style: 'glass' })
  spot('net', net.x, net.z, 2.3, 'Internet café', 'Read today\'s market headlines, same as the campus café.', 'cafe', 'Read the room')
  const desk = addBuilding({ x: -28, z: 16, w: 4.4, d: 2.6, h: 2.6, door: 'px', title: 'Carbon desk', subtitle: 'practice pledge', seed: 41, style: 'kiosk', mint: true })
  spot('climate', desk.x, desk.z, 2.3, 'Carbon desk', 'Back a climate project with in-game cash and log your pledge.', 'climate', 'The desk')
  // Glass pavilion facing the plaza, just clear of the roundabout; the dealership platform sits beside it.
  const gadgets = addBuilding({ x: -20, z: 15.8, w: 5.4, d: 4.2, h: 3.1, door: 'nz', title: 'Gadgets', subtitle: 'phones · laptops · drones', seed: 47, style: 'pavilion' })
  spot('gadgets', gadgets.x, gadgets.z, 2.2, 'Gadgets', 'Phones, laptops, accessories and drones for in-game cash.', 'gadgets', 'Open the case')
  const dealerAt = { x: -27, z: 10.4 }
  spot('dealer', dealerAt.x + 2.2, dealerAt.z - 3.1, 2.2, 'Auto dealership', 'Cars, jets and air taxis for in-game cash.', 'dealer', 'Browse')
  reserved.push({ kind: 'box', x: dealerAt.x, z: dealerAt.z, hx: 3.4, hz: 3.4 })
  architecture.flush(scene)
  buildShowroom(scene, { obstacles, pavilion: { x: -20, z: 15.8, w: 5.4, d: 4.2 }, dealer: dealerAt })

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
      ...SIDE_LINES,
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
        ...SIDE_RECTS,
      ]
      // Sidewalks first, then the asphalt over them, then walkways.
      g.fillStyle = '#a7a199'
      for (const road of roads) fillRect({ ...road, hx: road.hx + (road.hx > road.hz ? 0 : 1.3), hz: road.hz + (road.hz > road.hx ? 0 : 1.3) })
      g.fillStyle = '#8f887c'
      for (const path of paths) fillRect({ ...path, hx: path.hx + 0.14, hz: path.hz + 0.14 })
      g.fillStyle = '#b9b2a6'
      for (const path of paths) fillRect(path)
      g.fillStyle = ASPHALT
      for (const road of roads) fillRect(road)
      // Rounded inside corners on the side road so the asphalt matches the driven curve.
      for (const [cx, cz] of [[30, 0], [30, 12], [44, 12]] as const) {
        g.beginPath()
        g.arc(mid + cx * scale, mid + cz * scale, (ROAD_HALF + 1.2) * scale, 0, Math.PI * 2)
        g.fill()
      }
      g.strokeStyle = 'rgba(230, 236, 232, 0.5)'
      g.lineWidth = 3
      g.setLineDash([18, 16])
      g.beginPath()
      g.moveTo(mid - ROAD_END * scale, mid)
      g.lineTo(mid - (RING_OUT + 1) * scale, mid)
      g.moveTo(mid + (RING_OUT + 1) * scale, mid)
      g.lineTo(mid + ROAD_END * scale, mid)
      g.moveTo(mid, mid - ROAD_END * scale)
      g.lineTo(mid, mid - (RING_OUT + 1) * scale)
      g.moveTo(mid, mid + (RING_OUT + 1) * scale)
      g.lineTo(mid, mid + ROAD_END * scale)
      for (const l of SIDE_LINES) {
        if (l.horizontal) { g.moveTo(mid + (l.from + 3) * scale, mid + l.at * scale); g.lineTo(mid + (l.to - 3) * scale, mid + l.at * scale) }
        else { g.moveTo(mid + l.at * scale, mid + (l.from + 3) * scale); g.lineTo(mid + l.at * scale, mid + (l.to - 3) * scale) }
      }
      g.stroke()
      g.setLineDash([])
      // Roundabout: a paver footway ring, the asphalt ring with flared mouths where the arms join, and a
      // dashed lane edge. The plaza paving sits on top so everything meets it cleanly.
      g.fillStyle = '#a7a199'
      g.beginPath(); g.arc(mid, mid, (RING_OUT + 1.6) * scale, 0, Math.PI * 2); g.fill()
      g.fillStyle = ASPHALT
      g.beginPath(); g.arc(mid, mid, RING_OUT * scale, 0, Math.PI * 2); g.fill()
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) for (const sgn of [-1, 1]) {
        const cx = dx * (RING_OUT + 0.6) + (dx ? 0 : sgn * (ROAD_HALF + 0.6)), cz = dz * (RING_OUT + 0.6) + (dz ? 0 : sgn * (ROAD_HALF + 0.6))
        g.beginPath(); g.arc(mid + cx * scale, mid + cz * scale, 1.6 * scale, 0, Math.PI * 2); g.fill()
      }
      g.strokeStyle = 'rgba(230, 236, 232, 0.45)'
      g.lineWidth = 2
      g.setLineDash([10, 12])
      g.beginPath(); g.arc(mid, mid, (RING_IN + 0.35) * scale, 0, Math.PI * 2); g.stroke()
      g.setLineDash([])
      // The plaza paving sits on top so the roads meet it cleanly.
      // Plaza: pale faceted stone, a darker band at the kerb and one fine brass inlay ring round the stand.
      g.save()
      g.beginPath(); g.arc(mid, mid, RING_IN * scale, 0, Math.PI * 2); g.clip()
      paintFacets(g, canvas.width, canvas.width, 61, 30, 0.075, [221, 214, 202])
      g.restore()
      g.strokeStyle = 'rgba(128,118,102,0.55)'
      g.lineWidth = 0.9 * scale
      g.beginPath(); g.arc(mid, mid, (RING_IN - 0.5) * scale, 0, Math.PI * 2); g.stroke()
      g.strokeStyle = 'rgba(190, 154, 92, 0.85)'
      g.lineWidth = 3
      g.beginPath(); g.arc(mid, mid, 4.2 * scale, 0, Math.PI * 2); g.stroke()
      g.beginPath(); g.arc(mid, mid, 9.5 * scale, 0, Math.PI * 2); g.stroke()
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
  white.map = facetMap(23, 2, 0.08, 1, anisotropy)
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
    c.fillStyle = '#f2ece0'; c.font = '600 40px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MASJID', 128, 42)
  }), roughness: 0.6 }))
  plate.position.set(1.8, 2.2, -8.62)
  plate.rotation.y = Math.PI
  masjid.add(signPost, plate)
  scene.add(masjid)
  obstacles.push({ kind: 'box', x: MX, z: MZ + 1.5, hx: 5.15, hz: 4.65 })
  obstacles.push({ kind: 'circle', x: MX + 4.6, z: MZ - 3.4, r: 1.0 })
  reserved.push({ kind: 'box', x: MX, z: MZ - 1.5, hx: 7, hz: 8 })
  spot('prayer', MX, MZ - 3.9, 1.6, 'Masjid', 'Prayer hall. Sit quietly to focus before your next course.', 'prayer', 'Go inside')

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

  // Plaza drinks stand: counter, awning, back bar, stools and a small still drink on the counter (drinkStand.ts).
  const drinkStand = createDrinkStand(scene, anisotropy)
  addGlow(0, 2.2, 0.6, 0xffd9a0, 4)
  obstacles.push({ kind: 'circle', x: 0, z: 0, r: 2.7 })
  reserved.push({ kind: 'circle', x: 0, z: 0, r: 3.4 })
  spot('ring', 0, 0, 4.4, 'Grind Ring', 'The plaza drinks stand. Coffee, juice, tea and a place to meet.')

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
  spot('ladder', -9, -8, 2.3, 'The ladder', 'The rank ladder: shrimp to whale. Climb it by learning and coming back daily.')

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
    if (Math.hypot(x, z) < RING_OUT + 2.4) return false // plaza + roundabout
    if (Math.hypot(x + 40, z - 40) < 11) return false
    if (ESTATE_ZONES.some((r) => Math.abs(x - r.x) < r.hx + 1 && Math.abs(z - r.z) < r.hz + 1)) return false
    if (Math.abs(x) > 56 || Math.abs(z) > 56) return false
    if (Math.abs(x) < ROAD_HALF + 2 || Math.abs(z) < ROAD_HALF + 2) return false
    if (SIDE_RECTS.some((r) => Math.abs(x - r.x) < r.hx + 2 && Math.abs(z - r.z) < r.hz + 2)) return false
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

  // Real trees (trees.ts): bark trunks with boughs and crowns of photographed leaves, two instanced meshes.
  const trees = createTrees(scene, treeSpots, { light: window.matchMedia('(pointer: coarse)').matches, anisotropy })
  for (const [x, z, base] of treeSpots) obstacles.push({ kind: 'circle', x, z, r: 0.2 * base * 1.9 })

  // Baked contact shading: a soft dark halo on the ground round every building and under every tree. Phones
  // run without shadow maps, so this is what seats the city on its ground there; with real shadows it reads
  // as ambient occlusion. Painted once into the ground map (no per-frame cost).
  {
    const canvas = groundMap.image as HTMLCanvasElement
    const g = canvas.getContext('2d')
    if (g) {
      const scale = canvas.width / SPAN, mid = canvas.width / 2
      const FAR = canvas.width * 2 // the shape itself is drawn off-canvas; only its blurred shadow lands
      g.save()
      g.shadowOffsetX = FAR
      g.fillStyle = '#000'
      g.shadowColor = 'rgba(28, 22, 14, 0.42)'
      g.shadowBlur = 1.5 * scale
      for (const f of FOOTPRINTS) g.fillRect(mid + (f.x - f.w / 2 - 0.25) * scale - FAR, mid + (f.z - f.d / 2 - 0.25) * scale, (f.w + 0.5) * scale, (f.d + 0.5) * scale)
      g.shadowColor = 'rgba(24, 30, 16, 0.34)'
      for (const [x, z, base] of treeSpots) {
        g.shadowBlur = base * 1.3 * scale
        g.beginPath(); g.arc(mid + x * scale - FAR, mid + z * scale, base * 1.25 * scale, 0, Math.PI * 2); g.fill()
      }
      g.shadowColor = 'rgba(20, 16, 10, 0.5)'
      g.shadowBlur = 0.9 * scale
      g.beginPath(); g.arc(mid - FAR, mid, 2.75 * scale, 0, Math.PI * 2); g.fill() // drinks stand
      g.restore()
      groundMap.needsUpdate = true
    }
  }

  // Street lamps: a slim bronze post on a collared base, a swan-neck arm reaching over the kerb and a frosted
  // lantern under a flat cap. All posts merge into one mesh and all lanterns into another (two draw calls).
  const lampMetal = new THREE.MeshStandardMaterial({ color: 0x2f2a25, roughness: 0.45, metalness: 0.7 })
  const lampParts: THREE.BufferGeometry[] = [], lampGlow: THREE.BufferGeometry[] = []
  const addLamp = (x: number, z: number) => {
    // The arm reaches toward the road the lamp stands beside.
    const [ax, az] = Math.abs(z) < 6 ? [0, -Math.sign(z)] : Math.abs(x) < 6 ? [-Math.sign(x), 0] : Math.abs(x - 44) < 6 ? [Math.sign(44 - x), 0] : [0, Math.sign(12 - z)]
    const yaw = Math.atan2(ax, az)
    const H = 3.25, R = 0.42
    const place = (g: THREE.BufferGeometry) => g.rotateY(yaw).translate(x, 0, z)
    lampParts.push(
      place(new THREE.CylinderGeometry(0.075, 0.11, 0.36, 8).translate(0, 0.18, 0)),
      place(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8).translate(0, 0.38, 0)),
      place(new THREE.CylinderGeometry(0.038, 0.05, H - 0.4, 8).translate(0, 0.4 + (H - 0.4) / 2, 0)),
      // Swan neck: a quarter ring from the post top out over the kerb.
      place(new THREE.TorusGeometry(R, 0.028, 6, 10, Math.PI / 2).rotateY(-Math.PI / 2).translate(0, H, R)),
      place(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6).translate(0, H + R - 0.08, R)),
      place(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 10).translate(0, H + R - 0.16, R)),
      place(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10).translate(0, H + R - 0.5, R)),
    )
    lampGlow.push(place(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 10).translate(0, H + R - 0.335, R)))
    lampSpots.push({ x: x + ax * R, z: z + az * R, y: H + R - 0.4 })
    obstacles.push({ kind: 'circle', x, z, r: 0.22 })
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
    [48, 22], [48, 34], [48, 46], [48, 62], [40, 76], [35.6, 16.4],
    // Opposite kerb of each arterial road, staggered so every stretch of road has a pool of light at night.
    [-23.5, -4.8], [-33, -4.8], [-44, -4.8], [23.5, 4.8], [33, 4.8], [44, 4.8],
    [-4.8, -23.5], [-4.8, -33], [-4.8, -44], [4.8, 23.5], [4.8, 33], [4.8, 44],
  ] as const) addLamp(x, z)
  {
    const strip = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n }))!
    const posts = new THREE.Mesh(strip(lampParts), lampMetal)
    posts.castShadow = true
    posts.receiveShadow = true
    const lanterns = new THREE.Mesh(strip(lampGlow), lampMat)
    scene.add(posts, lanterns)
  }
  // A few real warm lamp lights at road junctions (cheap: 4 lights, night only); the rest are light-pool decals.
  for (const [x, z] of [[-23.5, -4.8], [23.5, 4.8], [-4.8, -23.5], [4.8, 23.5]] as const) addGlow(x, 3.2, z, 0xffd6a0, 5)

  const basinWater = new THREE.Mesh(new THREE.CircleGeometry(6.2, 32), waterMat)
  basinWater.rotation.x = -Math.PI / 2
  basinWater.position.set(-40, 0.14, 40)
  const basinRim = solid(new THREE.TorusGeometry(6.35, 0.28, 6, 40), stone)
  basinRim.rotation.x = -Math.PI / 2
  basinRim.position.set(-40, 0.14, 40)
  scene.add(basinWater, basinRim)
  obstacles.push({ kind: 'circle', x: -40, z: 40, r: 6 })
  spot('water', -34, 34, 2.4, 'The basin', 'A park pond. The carbon desk is just to the north.')
  addGlow(-40, 1.2, 40, 0xbfe6ff, 6)
  addGlow(hall.x, 2.2, hall.z, 0xffe2b8, 8)
  addGlow(floor.x, 2.2, floor.z, 0x9fd4ff, 8)
  addGlow(row.x, 2.2, row.z, 0xffb089, 8)
  addGlow(trench.x, 2.2, trench.z, 0xff8fbf, 7)

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
    g.fillStyle = '#7fae8e'
    g.font = '600 18px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
    g.fillText(screen.key === 'unit' ? 'DISTRICT COIN' : 'MEME TOKEN', 12, 22)
    if (values.length < 2) {
      screen.texture.needsUpdate = true
      return
    }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(0.0001, max - min)
    const last = values[values.length - 1] ?? min
    const first = values[0] ?? min
    g.strokeStyle = last >= first ? '#7fae8e' : '#c4776c'
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
    background.setHex(night ? 0x0a1018 : dusk ? 0x3a2218 : 0xb8cfc8)
    fog.color.copy(background)
    fog.density = night ? 0.008 : dusk ? 0.0075 : 0.0045 // richer depth haze (Zahra: not flat bright)
    sun.color.setHex(bear ? 0xc9d7ff : dusk ? 0xff9a5c : 0xffe6c4)
    sun.intensity = (night ? 0.55 : dusk ? 0.95 : 1.25) * (bear ? 0.82 : 1)
    hemi.intensity = night ? 0.3 : dusk ? 0.48 : 0.72
    hemi.color.setHex(night ? 0xa8c0e8 : dusk ? 0xffc9a0 : 0xfff0e0)
    hemi.groundColor.setHex(night ? LOOK.lookBounceNight : LOOK.lookBounceDay)
    fill.intensity = night ? 0.16 : dusk ? 0.22 : 0.26
    lampMat.emissiveIntensity = night ? 0.65 : dusk ? 0.38 : 0.04
    trimPulse = night ? 0.95 : dusk ? 0.62 : 0.28
    trim.emissiveIntensity = trimPulse
    waterMat.emissiveIntensity = night ? 0.4 : 0.08
    architecture.setNight(night ? 1 : dusk ? 0.35 : 0)
    drinkStand.setNight(night ? 1 : dusk ? 0.35 : 0)
    for (const light of glow) light.intensity = night ? Number(light.userData.night) : dusk ? Number(light.userData.night) * 0.35 : 0
    moon.visible = night || dusk
    stars.visible = night
  }

  let seasonBear = false
  const nightSky = new THREE.Color(0x0a1430)
  const nightLow = new THREE.Color(0x141c2e)
  const duskSky = new THREE.Color(0x4a3568)
  const duskLow = new THREE.Color(0xe8955a)
  const daySky = new THREE.Color(0x4a9df0)
  const dayLow = new THREE.Color(0xd6e4ee)
  const tmpA = new THREE.Color()
  const tmpB = new THREE.Color()
  const sunDay = new THREE.Color(0xffd29c)
  const sunDusk = new THREE.Color(0xff9a5c)
  const moonLight = new THREE.Color(0x93a6d8)
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
    fog.density = 0.0064 - day * 0.0036 + dusk * 0.0016 // lighter haze by day // soft aerial haze by day, thicker at dusk
    // Day: softer sun (Zahra: too bright). Night: lamps. Dusk: warm amber.
    const up = Math.max(0.35, Math.abs(elev))
    const side = Math.cos(angle) * (elev >= 0 ? 1 : -1)
    sunOffset.set(side * 20, 8 + up * 18, 10)
    sun.color.copy(elev >= 0 ? sunDay : moonLight).lerp(sunDusk, dusk * 0.85)
    if (seasonBear) sun.color.lerp(moonLight, 0.25)
    // Warmer key with less flat fill: deeper shadows by day, a low orange sun at dusk, cool moonlight at night.
    sun.intensity = (elev >= 0 ? 0.25 + day * 1.5 + dusk * 0.12 : 0.1) * (seasonBear ? 0.88 : 1)
    sun.castShadow = day > 0.2
    hemi.intensity = 0.17 + day * 0.91 // bright sky fill by day; enough at night that the street never goes black
    hemi.color.copy(moonLight).lerp(sunDay, day).lerp(sunDusk, dusk * 0.5)
    hemi.groundColor.setHex(LOOK.bounceNight).lerp(tmpA.setHex(LOOK.bounceDay), day)
    fill.intensity = 0.02 + day * 0.25
    sun.shadow.intensity = 1 - day * 0.45 // soft daytime shadows, full at night
    lampMat.emissiveIntensity = 0.06 + night * 1.7
    trimPulse = 0.12 + night * 0.18
    trim.emissiveIntensity = trimPulse
    waterMat.emissiveIntensity = 0.04 + night * 0.07
    groundMat.roughness = 0.97 - night * 0.3
    groundMat.metalness = 0.02 + night * 0.04
    architecture.setNight(night)
    drinkStand.setNight(night)
    for (const light of glow) light.intensity = Number(light.userData.night) * 1.4 * Math.max(0, night - 0.1) // warm street-light pools
    poolNight = night
    decalMat.opacity = Math.min(1, 1.05 * Math.max(0, night - 0.15))
    if (!decals && lampSpots.length) buildDecals()
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
    lampSpots: lampSpots.map((l) => ({ x: l.x, z: l.z })),
    treeSpots: treeSpots.map(([x, z]) => ({ x, z })),
    obstacles,
    hotspots,
    sun,
    groundMat,
    hemi,
    setLook,
    setDaylight,
    lanes: { roadHalf: ROAD_HALF, walk: ROAD_HALF + 0.7, inner: LANE_INNER, outer: LANE_OUTER },
    setQuality(graphics: Graphics) {
      // Constant per tier: changing visibility changes the shader light count (one recompile).
      const budget = lightBudget(graphics)
      pool.forEach((l, i) => { l.visible = i < budget.pool })
      for (const light of glow) light.visible = budget.glow
    },
    setRank(label: string) {
      ladderMap.dispose()
      ladderMap = paintLadder(label)
      ladderMat.map = ladderMap
    },
    tick(time, focus) {
      poolAcc += 1 / 60
      if (poolAcc > 0.25) {
        poolAcc = 0
        const near = [...lampSpots, ...glowSpots].map((p) => ({ p, d: (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2 })).sort((a, b) => a.d - b.d)
        pool.forEach((l, i) => {
          const n = near[i]
          if (!n || poolNight < 0.15) { l.intensity = 0; return }
          l.position.set(n.p.x, n.p.y, n.p.z)
          l.intensity = 9 * poolNight
        })
      }
      sun.position.set(focus.x + sunOffset.x, sunOffset.y, focus.z + sunOffset.z)
      sky.position.set(focus.x, 0, focus.z)
      sun.target.position.set(focus.x, 0, focus.z)
      sun.target.updateMatrixWorld()
      if (!reduceMotion) {
        trim.emissiveIntensity = trimPulse + Math.sin(time * 1.7) * 0.08
        for (const ripple of ripples) {
          const t = (time * 0.16 + ripple.offset) % 1
          const scale = 0.35 + t * 2.1
          ripple.mesh.scale.set(scale, scale, 1)
          const material = ripple.mesh.material as THREE.MeshBasicMaterial
          material.opacity = (1 - t) * 0.45
        }
        // A light wind in the tree crowns.
        trees.sway(time)
      }
      if (time < nextScreen) return
      nextScreen = time + 0.5
      const series = getSeries()
      for (const screen of screens) drawScreen(screen, screen.key === 'unit' ? series.unit : series.meme)
    },
  }
}
