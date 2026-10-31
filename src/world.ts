import { HOUSES, type HouseId } from './houses.ts'
import type { PanelId, Season, TimeOfDay } from './logic.ts'
import { CITY_LIMIT, type Obstacle } from './physics.ts'
import * as THREE from 'three'

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
}

export type World = {
  obstacles: Obstacle[]
  hotspots: Hotspot[]
  sun: THREE.DirectionalLight
  tick: (time: number, focus: THREE.Vector3) => void
  setLook: (look: { time: TimeOfDay; season: Season }) => void
  setRank: (label: string) => void
}

type Door = 'px' | 'nx' | 'pz' | 'nz'
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

  const stone = new THREE.MeshStandardMaterial({ color: 0x3c4b45, roughness: 0.88, metalness: 0.04 })
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x24302b, roughness: 0.9, metalness: 0.05 })
  const trim = new THREE.MeshStandardMaterial({
    color: 0x1af38f,
    emissive: 0x1af38f,
    emissiveIntensity: 1.1,
    roughness: 0.38,
  })
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a38, roughness: 0.82 })
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.9 })
  const leaf = new THREE.MeshStandardMaterial({ color: 0x1f6a45, roughness: 0.72, flatShading: true })
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffe2b8,
    emissive: 0xffc27a,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  })
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a6a5c,
    roughness: 0.18,
    metalness: 0.55,
    emissive: 0x06281f,
    emissiveIntensity: 0.45,
  })

  const solid = (geometry: THREE.BufferGeometry, material: THREE.Material, cast = true) => {
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
      g.strokeStyle = '#1af38f'
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
      g.fillStyle = '#1af38f'
      g.fillText(label, 512, 170)
      g.fillStyle = '#d5efe2'
      g.font = '500 40px Outfit, sans-serif'
      g.fillText(subtitle, 512, 300)
    })

  const paintLadder = (current: string) =>
    paint(512, 1024, (g) => {
      g.fillStyle = '#0d1512'
      g.fillRect(0, 0, 512, 1024)
      g.strokeStyle = '#1af38f'
      g.lineWidth = 12
      g.strokeRect(16, 16, 480, 992)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#9dccb6'
      g.font = '36px Outfit, sans-serif'
      g.fillText('THE LADDER', 256, 78)
      const ranks = ['WHALE', 'SHARK', 'DOLPHIN', 'FISH', 'CRAB', 'SHRIMP']
      const you = current.toUpperCase()
      ranks.forEach((rank, index) => {
        const y = 210 + index * 120
        if (rank === you) {
          g.fillStyle = '#1af38f'
          g.fillRect(48, y - 42, 416, 84)
          g.fillStyle = '#062117'
          g.font = '52px "Archivo Black", sans-serif'
        } else {
          g.fillStyle = '#8aa89a'
          g.font = '42px "Archivo Black", sans-serif'
        }
        g.fillText(rank, 256, y)
      })
    })

  let ladderMap = paintLadder(options.rankLabel)
  const ladderMat = new THREE.MeshBasicMaterial({ map: ladderMap, toneMapped: false })

  const facadeTex = (seed: number) => {
    const rand = mulberry32(seed)
    return paint(128, 256, (g) => {
      g.fillStyle = '#1a2622'
      g.fillRect(0, 0, 128, 256)
      for (let row = 18; row < 240; row += 28) {
        for (let col = 14; col < 118; col += 22) {
          if (rand() > 0.72) continue
          const lit = rand()
          g.fillStyle = lit > 0.86 ? '#1af38f' : lit > 0.45 ? '#f0d7b0' : '#121a17'
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

  const hemi = new THREE.HemisphereLight(0xb7d4ff, 0x1c2e26, 0.45)
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
  const fill = new THREE.DirectionalLight(0x8ef0c8, 0.28)
  fill.position.set(-12, 10, -8)
  scene.add(fill)

  const fog = new THREE.Fog(0x070a09, 28, 140)
  scene.fog = fog
  const background = new THREE.Color(0x070a09)
  scene.background = background

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
          map: facadeTex(spec.seed ?? 1),
          roughness: 0.84,
          metalness: 0.04,
          emissive: 0xfff1dd,
          emissiveMap: facadeTex(spec.seed ?? 1),
          emissiveIntensity: 0.28,
        })
      : stone
    if (spec.windows && material instanceof THREE.MeshStandardMaterial) facades.push(material)
    const block = solid(new THREE.BoxGeometry(spec.w, spec.h, spec.d), material)
    block.position.y = spec.h / 2
    group.add(block)
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
    obstacles.push({ kind: 'box', x: spec.x, z: spec.z, hx: spec.w / 2, hz: spec.d / 2 })
    reserved.push({ kind: 'box', x: spec.x, z: spec.z, hx: spec.w / 2 + 1.8, hz: spec.d / 2 + 1.8 })
    const stepOut = 1.45
    const doorAt: Record<Door, { x: number; z: number }> = {
      pz: { x: spec.x, z: spec.z + spec.d / 2 + stepOut },
      nz: { x: spec.x, z: spec.z - spec.d / 2 - stepOut },
      px: { x: spec.x + spec.w / 2 + stepOut, z: spec.z },
      nx: { x: spec.x - spec.w / 2 - stepOut, z: spec.z },
    }
    const at = doorAt[spec.door]
    const mat = solid(new THREE.BoxGeometry(1.5, 0.04, 1.5), trim, false)
    mat.position.set(at.x, 0.03, at.z)
    mat.userData.ghost = true
    scene.add(mat)
    return at
  }

  const hall = addBuilding({ x: 0, z: -48, w: 16, d: 11, h: 5.2, door: 'pz', title: 'Learning hall', subtitle: 'courses file themselves', windows: true, seed: 3 })
  spot('learn', hall.x, hall.z, 2.5, 'Learning hall', 'Eight short courses. Pass one and it writes your CV, resume, and portfolio.', 'learn', 'Open the hall')
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
  spot('boutique', shop.x, shop.z, 2.4, 'Boutique', 'Player 8453, Zuri, and the mascots. Masks from the collection list hang on the side wall.', 'boutique', 'Try a body')
  const gym = addBuilding({ x: -22, z: -22, w: 8, d: 8, h: 4, door: 'px', title: 'Gym', subtitle: 'reps, not leverage', windows: true, seed: 23 })
  spot('gym', gym.x, gym.z, 2.4, 'Gym', 'A short timing set. One logged set a day. Balance is not invited.', 'gym', 'Train')
  const church = addBuilding({ x: 24, z: 26, w: 9, d: 11, h: 5, door: 'nx', title: 'Church', subtitle: 'charts stay out', windows: false, steeple: true, seed: 29 })
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
  }
  const net = addBuilding({ x: 28, z: -16, w: 8, d: 6, h: 3.4, door: 'pz', title: 'Terminal café', subtitle: 'gossip and posts', windows: true, seed: 37 })
  spot('net', net.x, net.z, 2.3, 'Internet café', 'Same board as campus, closer to the row. Read it once a day.', 'cafe', 'Read the room')
  const desk = addBuilding({ x: -28, z: 16, w: 4.4, d: 2.6, h: 2.7, door: 'px', title: 'Carbon', subtitle: 'practice pledge', seed: 41 })
  spot('climate', desk.x, desk.z, 2.3, 'Carbon desk', 'Back a project with practice funds. It records the pledge. It does not retire a real tonne.', 'climate', 'The desk')
  const gadgets = addBuilding({ x: -16, z: 14, w: 5.4, d: 4.2, h: 3.1, door: 'pz', title: 'Gadgets', subtitle: 'drones', windows: true, seed: 47 })
  spot('gadgets', gadgets.x, gadgets.z, 2.2, 'Gadgets', 'Scout, courier, and halo. A drone follows you. Practice funds.', 'gadgets', 'Open the case')

  const prayer = new THREE.Group()
  prayer.position.set(-24, 0, 26)
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 6) * Math.PI * 1.35 + 0.4
    const stoneMesh = solid(new THREE.DodecahedronGeometry(0.28, 0), stone)
    stoneMesh.position.set(Math.cos(angle) * 3.1, 0.22, Math.sin(angle) * 3.1)
    prayer.add(stoneMesh)
    obstacles.push({ kind: 'circle', x: -24 + Math.cos(angle) * 3.1, z: 26 + Math.sin(angle) * 3.1, r: 0.36 })
  }
  scene.add(prayer)
  spot('prayer', -24, 26, 2.6, 'Prayer space', 'A ring of stones and no questions. Sitting puts focus on your next course.', 'prayer', 'Sit')

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
  addGlow(0, 1.6, 0, 0x1af38f, 12)
  for (let i = 0; i < 3; i += 1) {
    const ripple = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.02, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0x1af38f, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }),
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
    return reserved.every((box) => {
      if (box.kind !== 'box') return true
      return Math.abs(x - box.x) > box.hx || Math.abs(z - box.z) > box.hz
    })
  }
  const rand = mulberry32(19)
  for (let i = 0; i < 80 && treeSpots.length < 34; i += 1) {
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
  treeSpots.forEach(([x, z, scale], index) => {
    dummy.position.set(x, 0.52 * scale, z)
    dummy.scale.setScalar(scale)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    trunks.setMatrixAt(index, dummy.matrix)
    dummy.position.set(x, 1.45 * scale, z)
    dummy.scale.set(scale, scale * 0.82, scale)
    dummy.updateMatrix()
    crowns.setMatrixAt(index, dummy.matrix)
    obstacles.push({ kind: 'circle', x, z, r: 0.38 * scale })
  })
  scene.add(trunks, crowns)

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
  basinWater.position.set(-40, 0.05, 40)
  scene.add(basinWater)
  obstacles.push({ kind: 'circle', x: -40, z: 40, r: 6 })
  spot('water', -34, 34, 2.4, 'The basin', 'Park water. Climate work has a desk just north of here. Swimming is not the pledge.')
  addGlow(-40, 1.2, 40, 0x7dffe0, 6)
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
    g.fillStyle = '#1af38f'
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
    g.strokeStyle = last >= first ? '#1af38f' : '#ff6f61'
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
    background.setHex(night ? 0x070a09 : dusk ? 0x24160f : 0xc5ddd2)
    fog.color.copy(background)
    fog.near = night ? 26 : dusk ? 32 : 40
    fog.far = night ? 136 : 160
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
    setRank(label: string) {
      ladderMap.dispose()
      ladderMap = paintLadder(label)
      ladderMat.map = ladderMap
    },
    tick(time, focus) {
      sun.position.set(focus.x + 14, 22, focus.z + 10)
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
