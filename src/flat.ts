import { assetUrl } from './assets.ts'
import { createInput } from './input.ts'
import type { PanelId } from './logic.ts'
import { decodeShare, seasonAt } from './logic.ts'
import { bindMusic } from './music.ts'
import { CITY_LIMIT, PLAYER_R, resolveCollision, type Obstacle } from './physics.ts'
import { getSave, rememberPlace, setVolume, tickMarket } from './state.ts'
import { mountUi } from './ui.ts'
import { districtName } from './world.ts'

const WALK = 2.7
const RUN = 5.5

type Spot = {
  id: string
  x: number
  z: number
  r: number
  title: string
  body: string
  action?: PanelId
  enter?: string
}

type Block = { x: number; z: number; w: number; d: number; label: string }

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

function door(x: number, z: number, w: number, d: number, side: 'px' | 'nx' | 'pz' | 'nz'): { x: number; z: number } {
  const step = 1.45
  if (side === 'pz') return { x, z: z + d / 2 + step }
  if (side === 'nz') return { x, z: z - d / 2 - step }
  if (side === 'px') return { x: x + w / 2 + step, z }
  return { x: x - w / 2 - step, z }
}

const blocks: Block[] = [
  { x: 0, z: -48, w: 16, d: 11, label: 'Learning hall' },
  { x: 16, z: -54, w: 8, d: 7, label: 'Conference' },
  { x: -16, z: -54, w: 8, d: 7, label: 'Café' },
  { x: -12, z: -36, w: 3.2, d: 2.2, label: 'Booth' },
  { x: 12, z: -36, w: 3.2, d: 2.2, label: 'Booth' },
  { x: -48, z: 0, w: 12, d: 16, label: 'Trading floor' },
  { x: 48, z: 0, w: 12, d: 16, label: 'Influencer row' },
  { x: 0, z: 48, w: 16, d: 11, label: 'Trenches' },
  { x: 22, z: -22, w: 8, d: 7, label: 'Boutique' },
  { x: -22, z: -22, w: 8, d: 8, label: 'Gym' },
  { x: 24, z: 26, w: 9, d: 11, label: 'Church' },
  { x: 36, z: 32, w: 7, d: 6, label: 'House' },
  { x: 28, z: -16, w: 8, d: 6, label: 'Terminal café' },
  { x: -28, z: 16, w: 4.4, d: 2.6, label: 'Carbon' },
]

function citySpots(): Spot[] {
  const at = (index: number, side: 'px' | 'nx' | 'pz' | 'nz') => door(blocks[index].x, blocks[index].z, blocks[index].w, blocks[index].d, side)
  const hall = at(0, 'pz')
  const conference = at(1, 'pz')
  const cafe = at(2, 'pz')
  const floor = at(5, 'px')
  const row = at(6, 'nx')
  const trench = at(7, 'nz')
  const shop = at(8, 'nx')
  const gym = at(9, 'px')
  const church = at(10, 'nx')
  const house = at(11, 'nx')
  const net = at(12, 'pz')
  const desk = at(13, 'px')
  return [
    { id: 'learn', ...hall, r: 2.5, title: 'Learning hall', body: 'Eight short courses. Pass one and it writes your CV, resume, and portfolio.', action: 'learn', enter: 'Open the hall' },
    { id: 'conference', ...conference, r: 2.3, title: 'Conference hall', body: 'One talk. Proof of work, not a slogan.', action: 'conference', enter: 'Take a seat' },
    { id: 'campus-cafe', ...cafe, r: 2.3, title: 'Campus café', body: 'Headlines change with the season. They are not a signal to size up.', action: 'cafe', enter: 'Read the room' },
    { id: 'booths', x: 0, z: -35.2, r: 2.2, title: 'Campus booths', body: 'Projects pin a one-pager here. None of them can ask for your seed.' },
    { id: 'trade', ...floor, r: 2.6, title: 'Trading floor', body: 'A practice book in UNIT. A sized plan can count even when the close is red.', action: 'trade', enter: 'Open the book' },
    { id: 'bounty', ...row, r: 2.6, title: 'Influencer row', body: 'Write a bounty. Practice pay lands, and the sentence goes on your portfolio.', action: 'bounty', enter: 'Post a bounty' },
    { id: 'trench', ...trench, r: 2.6, title: 'Trenches corner', body: 'MEME moves like attention. It can leave. Rank will not follow it down.', action: 'trench', enter: 'Open the trench book' },
    { id: 'boutique', ...shop, r: 2.4, title: 'Boutique', body: 'Four original bodies, free. Licensed collections stay off this street until there is a license.', action: 'boutique', enter: 'Try a body' },
    { id: 'gym', ...gym, r: 2.4, title: 'Gym', body: 'A short timing set. One logged set a day.', action: 'gym', enter: 'Train' },
    { id: 'church', ...church, r: 2.4, title: 'Church', body: 'A quiet room. Rest counts.', action: 'church', enter: 'Step in' },
    { id: 'house', ...house, r: 2.3, title: 'House', body: 'A private room. Messaging and voice are not in this build.', action: 'house', enter: 'Your room' },
    { id: 'net', ...net, r: 2.3, title: 'Internet café', body: 'Same board as campus, closer to the row.', action: 'cafe', enter: 'Read the room' },
    { id: 'climate', ...desk, r: 2.3, title: 'Carbon desk', body: 'Back a project with practice funds. It records the pledge.', action: 'climate', enter: 'The desk' },
    { id: 'prayer', x: -24, z: 26, r: 2.6, title: 'Prayer space', body: 'A ring of stones and no questions. Sitting puts focus on your next course.', action: 'prayer', enter: 'Sit' },
    { id: 'ring', x: 0, z: 0, r: 4.4, title: 'The Grind Ring', body: 'Same stone for a shrimp and a whale. No tribe. No continent. Just come grind.' },
    { id: 'ladder', x: -9, z: -8, r: 2.3, title: 'The ladder', body: 'Shrimp, crab, fish, dolphin, shark, whale. Skill and the days you return.' },
    { id: 'water', x: -34, z: 34, r: 2.4, title: 'The basin', body: 'Park water. Climate work has a desk just north of here.' },
    { id: 'north-arch', x: 0, z: -13.4, r: 2.5, title: 'Campus road', body: 'North, to the learning hall.' },
    { id: 'south-arch', x: 0, z: 13.4, r: 2.5, title: 'Trenches road', body: 'South. Attention trades here. Your rank does not.' },
    { id: 'west-arch', x: -13.4, z: 0, r: 2.5, title: 'Trading road', body: 'West, to the spot book. Practice funds only.' },
    { id: 'east-arch', x: 13.4, z: 0, r: 2.5, title: 'Row road', body: 'East. Post a bounty. It lands on the portfolio.' },
  ]
}

function cityObstacles(): Obstacle[] {
  const obstacles: Obstacle[] = blocks.map((block) => ({ kind: 'box', x: block.x, z: block.z, hx: block.w / 2, hz: block.d / 2 }))
  obstacles.push({ kind: 'circle', x: 0, z: 0, r: 2.9 })
  obstacles.push({ kind: 'circle', x: -40, z: 40, r: 6 })
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
  return obstacles
}

function palette(time: string): { ground: string; road: string; block: string; ink: string; label: string } {
  if (time === 'day') return { ground: '#d7efe6', road: '#7ddec0', block: '#12382c', ink: '#e9fff4', label: '#e9fff4' }
  if (time === 'dusk') return { ground: '#2c221c', road: '#4e6a52', block: '#1b3330', ink: '#e9fff4', label: '#1af38f' }
  return { ground: '#12211b', road: '#1f6a52', block: '#16362c', ink: '#e9fff4', label: '#1af38f' }
}

export async function startFlat(onReady: () => void): Promise<void> {
  const canvas = must<HTMLCanvasElement>('#view')
  const hint = must<HTMLParagraphElement>('#hint')
  const caption = must<HTMLElement>('#caption')
  const captionTitle = must<HTMLHeadingElement>('#cap-title')
  const captionBody = must<HTMLParagraphElement>('#cap-body')
  const stick = must<HTMLDivElement>('#stick')
  const nub = must<HTMLDivElement>('#nub')
  const musicButton = must<HTMLButtonElement>('#music')
  const volume = must<HTMLInputElement>('#volume')
  const musicNote = must<HTMLParagraphElement>('#music-note')
  const act = must<HTMLButtonElement>('#act')
  const map = must<HTMLCanvasElement>('#map')
  const sheet = must<HTMLElement>('#sheet')
  const toast = must<HTMLElement>('#toast')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not open the city map.')
  document.body.classList.add('flat')
  hint.textContent = document.body.classList.contains('touch')
    ? 'Stick to walk. Tap the map to go there. The mint button enters.'
    : 'WASD to walk. Shift runs. Click the map to go there. E enters.'

  const mark = new Image()
  mark.src = await assetUrl('/brand/shrimp.png', '/brand/shrimp.b64', 'image/png', 0x89)
  await new Promise<void>((resolve) => {
    mark.onload = () => resolve()
    mark.onerror = () => resolve()
  })

  const spots = citySpots()
  const obstacles = cityObstacles()
  const pos = { x: getSave().posX, z: getSave().posZ }
  const vel = { x: 0, z: 0 }
  let faceX = 0
  let faceZ = -1
  let target: { x: number; z: number } | null = null
  let stuck = 0
  let prevDist = Infinity
  let traveled = 0
  let activeSpot: string | null = null
  let spot: Spot | null = null
  let revealed = false
  let failed = false
  let elapsed = 0
  let season = seasonAt()
  let saveAcc = 0
  let taxLatch = false
  const mapCtx = map.getContext('2d')

  const ui = mountUi(sheet, toast, {
    rank: must('#pill-rank'),
    place: must('#pill-place'),
    ledger: must('#pill-ledger'),
    season: must('#pill-season'),
    focus: must('#pill-focus'),
  }, {
    onStyle: () => undefined,
    onBody: () => undefined,
    onLook: () => undefined,
    onGraphics: () => undefined,
    onRank: () => undefined,
  })

  must('#nav-profile').addEventListener('click', () => ui.open('profile'))
  must('#nav-learn').addEventListener('click', () => ui.open('learn'))
  must('#nav-settings').addEventListener('click', () => ui.open('settings'))
  must('#pill-rank').addEventListener('click', () => ui.open('profile'))
  must('#pill-ledger').addEventListener('click', () => ui.open('profile', { tab: 'books' }))
  must('#pill-season').addEventListener('click', () => ui.open('season'))
  must('#shot').addEventListener('click', () => {
    try {
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = 'grind-district.png'
      link.click()
      ui.toast('Shot saved.')
    } catch {
      ui.toast('This browser blocked the shot.')
    }
  })

  bindMusic(musicButton, volume, musicNote)
  volume.addEventListener('input', () => setVolume(Number(volume.value)))
  const input = createInput(canvas, stick, nub)
  act.addEventListener('click', () => input.requestInteract())

  const resize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }
  resize()
  window.addEventListener('resize', resize)

  const showSpot = (next: Spot | null) => {
    const id = next?.id ?? null
    if (id === activeSpot) return
    activeSpot = id
    spot = next
    if (!next) {
      caption.hidden = true
      act.hidden = true
      return
    }
    captionTitle.textContent = next.title
    captionBody.textContent = next.body
    caption.hidden = false
    act.hidden = !next.action
    act.textContent = next.enter ?? 'Enter'
  }

  const drawMap = () => {
    if (!mapCtx) return
    const width = map.width
    const height = map.height
    const limit = 62
    const X = (x: number) => (x / limit * 0.5 + 0.5) * width
    const Y = (z: number) => (z / limit * 0.5 + 0.5) * height
    mapCtx.clearRect(0, 0, width, height)
    mapCtx.fillStyle = '#101816'
    mapCtx.fillRect(0, 0, width, height)
    mapCtx.strokeStyle = '#7d8c84'
    mapCtx.lineWidth = 5
    mapCtx.beginPath()
    mapCtx.moveTo(X(-46), Y(0))
    mapCtx.lineTo(X(46), Y(0))
    mapCtx.moveTo(X(0), Y(-46))
    mapCtx.lineTo(X(0), Y(46))
    mapCtx.stroke()
    mapCtx.fillStyle = '#9dccb6'
    mapCtx.font = '600 16px Outfit, sans-serif'
    mapCtx.textAlign = 'center'
    const marks: Array<[number, number, string]> = [[0, -46, 'C'], [-46, 0, 'F'], [46, 0, 'I'], [0, 46, 'T']]
    for (const [x, z, letter] of marks) mapCtx.fillText(letter, X(x), Y(z) + 5)
    mapCtx.fillStyle = '#1af38f'
    mapCtx.beginPath()
    mapCtx.arc(X(pos.x), Y(pos.z), 4, 0, Math.PI * 2)
    mapCtx.fill()
  }

  const draw = () => {
    const width = canvas.width
    const height = canvas.height
    const colors = palette(getSave().timeOfDay)
    const scale = Math.min(width, height) / 96
    const project = (x: number, z: number) => ({
      x: width / 2 + (x - pos.x) * scale,
      y: height / 2 + (z - pos.z) * scale,
    })
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.fillStyle = colors.ground
    context.fillRect(0, 0, width, height)
    context.fillStyle = colors.road
    const road = 6.4 * scale
    const origin = project(0, 0)
    context.fillRect(0, origin.y - road / 2, width, road)
    context.fillRect(origin.x - road / 2, 0, road, height)
    context.fillStyle = '#1a6a5c'
    const basin = project(-40, 40)
    context.beginPath()
    context.arc(basin.x, basin.y, 6 * scale, 0, Math.PI * 2)
    context.fill()
    for (const block of blocks) {
      const top = project(block.x - block.w / 2, block.z - block.d / 2)
      context.fillStyle = colors.block
      context.strokeStyle = '#1af38f'
      context.lineWidth = Math.max(2, scale * 0.12)
      context.fillRect(top.x, top.y, block.w * scale, block.d * scale)
      context.strokeRect(top.x, top.y, block.w * scale, block.d * scale)
      if (block.w * scale > 46) {
        context.fillStyle = colors.label
        context.font = `600 ${Math.max(13, Math.min(22, block.w * scale * 0.16))}px Outfit, sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(block.label, top.x + (block.w * scale) / 2, top.y + (block.d * scale) / 2)
      }
    }
    const ring = project(0, 0)
    context.strokeStyle = '#1af38f'
    context.lineWidth = 3
    context.beginPath()
    context.arc(ring.x, ring.y, 2.9 * scale, 0, Math.PI * 2)
    context.stroke()
    if (target && !ui.isOpen()) {
      const marker = project(target.x, target.z)
      context.beginPath()
      context.arc(marker.x, marker.y, 8, 0, Math.PI * 2)
      context.stroke()
    }
    const player = project(pos.x, pos.z)
    context.save()
    context.translate(player.x, player.y)
    const angle = Math.atan2(faceX, -faceZ)
    context.rotate(angle)
    if (mark.complete && mark.naturalWidth > 0) {
      const size = Math.max(42, scale * 2.4)
      context.drawImage(mark, -size / 2, -size * 0.62, size, size)
    } else {
      context.fillStyle = '#1af38f'
      context.beginPath()
      context.arc(0, 0, 10, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
  }

  const update = (dt: number) => {
    const now = performance.now()
    tickMarket(dt, now)
    const nextSeason = seasonAt(now)
    if (nextSeason !== season) {
      season = nextSeason
      ui.refresh()
    }
    ui.setPlace(districtName(pos.x, pos.z))
    const frame = input.read()
    const paused = ui.isOpen()
    if (!paused && frame.interact && spot?.action) ui.open(spot.action)
    if (!paused && frame.tap) {
      const scale = Math.min(canvas.width, canvas.height) / 78
      target = {
        x: pos.x + frame.tap.nx * (canvas.width / 2) / scale,
        z: pos.z - frame.tap.ny * (canvas.height / 2) / scale,
      }
      target.x = Math.max(-CITY_LIMIT + 1, Math.min(CITY_LIMIT - 1, target.x))
      target.z = Math.max(-CITY_LIMIT + 1, Math.min(CITY_LIMIT - 1, target.z))
      stuck = 0
      prevDist = Infinity
    }
    let wishX = 0
    let wishZ = 0
    const directed = !paused && Math.hypot(frame.x, frame.y) > 0.06
    if (paused) target = null
    else if (directed) {
      wishX = frame.x
      wishZ = -frame.y
      target = null
    } else if (target) {
      const dx = target.x - pos.x
      const dz = target.z - pos.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.35 || stuck > 0.7) target = null
      else {
        wishX = dx / dist
        wishZ = dz / dist
        if (dist > prevDist - 0.004) stuck += dt
        else stuck = 0
        prevDist = dist
      }
    }
    const wishLen = Math.hypot(wishX, wishZ)
    const mag = Math.min(1, wishLen)
    const dirX = wishLen > 0.001 ? wishX / wishLen : 0
    const dirZ = wishLen > 0.001 ? wishZ / wishLen : 0
    if (wishLen > 0.05) {
      faceX = dirX
      faceZ = dirZ
    }
    const speed = ((frame.run || frame.stick > 0.88) ? RUN : WALK) * mag
    const rate = 1 - Math.exp(-9 * dt)
    vel.x += (dirX * speed - vel.x) * rate
    vel.z += (dirZ * speed - vel.z) * rate
    if (paused) {
      vel.x = 0
      vel.z = 0
    }
    pos.x += vel.x * dt
    pos.z += vel.z * dt
    resolveCollision(pos, vel, obstacles, PLAYER_R)
    traveled += Math.hypot(vel.x, vel.z) * dt
    if (traveled > 10) hint.classList.add('quiet')
    let best: Spot | null = null
    let bestDist = Infinity
    for (const candidate of spots) {
      const dist = Math.hypot(pos.x - candidate.x, pos.z - candidate.z)
      if (dist < candidate.r && dist < bestDist) {
        best = candidate
        bestDist = dist
      }
    }
    showSpot(best)
    if (!taxLatch && elapsed > 18 && !ui.isOpen() && getSave().taxOpen && Math.hypot(pos.x, pos.z) < 14) {
      taxLatch = true
      ui.open('tax')
    }
    draw()
    drawMap()
    saveAcc += dt
    if (saveAcc > 2) {
      saveAcc = 0
      rememberPlace(pos.x, pos.z)
    }
  }

  let last = performance.now()
  const frame = (now: number) => {
    requestAnimationFrame(frame)
    if (failed) return
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    elapsed += dt
    try {
      update(dt)
      if (!revealed) {
        revealed = true
        onReady()
        ui.toast('This browser opened the overhead map. Same streets, same doors.')
        const matched = location.hash.match(/^#profile=([A-Za-z0-9_-]+)/)
        if (matched?.[1]) {
          const shared = decodeShare(matched[1])
          history.replaceState(null, '', `${location.pathname}${location.search}`)
          if (shared) ui.open('shared', { shared })
          else if (!getSave().seenIntro) ui.open('intro')
        } else if (!getSave().seenIntro) {
          ui.open('intro')
        }
      }
    } catch (error) {
      failed = true
      const menu = document.querySelector('#menu')
      const note = document.querySelector('#menu-note')
      const play = document.querySelector<HTMLButtonElement>('#play')
      if (menu instanceof HTMLElement) menu.hidden = false
      if (note) note.textContent = error instanceof Error ? error.message : 'The city could not stay open.'
      if (play) {
        play.disabled = false
        play.textContent = 'Enter the district'
      }
    }
  }
  requestAnimationFrame(frame)
}
