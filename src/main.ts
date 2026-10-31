import '@fontsource/archivo-black/400.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import * as THREE from 'three'
import { setMixerViewer } from './humans.ts'
import { createAvatar, type Avatar } from './avatars.ts'
import { loadSkinPermissions } from './skins.ts'
import { NFT_COLLECTIONS_ENABLED } from './nft.ts'
import { createAgentCompanion, createRemoteAgents } from './agent.ts'
import { MAP_LIMIT } from './minimap.ts'
import { getNotes, markRead, mountNotifications, notify, onNotesChange, unreadCount } from './notify.ts'
import { createDrone, releaseDrone, spinDrone } from './drones.ts'
import { tagPlayer } from './player.ts'
import { assetUrl, prepareAssets } from './assets.ts'
import { startFlat } from './flat.ts'
import { createInput } from './input.ts'
import { decodeShare, rankFor, seasonAt, wearsPlate, type DroneId, type Graphics } from './logic.ts'
import { drawMinimap } from './minimap.ts'
import { createNet } from './net.ts'
import { createTraffic } from './traffic.ts'
import { applyEnvironment, createPost, createProbe } from './quality.ts'
import { createWatch } from './watch.ts'
import { startTracking } from './track.ts'
import { createSkyline } from './skyline.ts'
import { applyPrefs } from './prefs.ts'
import { createCrowd } from './npcs.ts'
import { blocked, CITY_LIMIT, PLAYER_R, resolveCollision, type Obstacle } from './physics.ts'
import { onActivity, subscribe, setTime, getSave, loadSave, rememberPlace, setGraphics, tickMarket } from './state.ts'
import { mountUi } from './ui.ts'
import { mountMenu } from './menu.ts'
import { createWorld, districtName, type Hotspot } from './world.ts'
import { createInteriors } from './interiors.ts'
import { createAmbient } from './ambient.ts'
import { createPhysicalSky } from './sky.ts'
import './style.css'

const WALK = 2.7
const RUN = 5.5

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

function isUnder(root: THREE.Object3D, obj: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = obj
  while (current) {
    if (current === root) return true
    current = current.parent
  }
  return false
}

function withTimeout<T>(work: Promise<T>, ms: number, fallback: () => T, what: string): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      console.warn(`[grind] ${what} timed out after ${ms} ms; continuing without it.`)
      resolve(fallback())
    }, ms)
    work.then((value) => { clearTimeout(timer); resolve(value) }, (error) => {
      clearTimeout(timer)
      console.error(`[grind] ${what} failed; continuing without it.`, error)
      resolve(fallback())
    })
  })
}

function blankTexture(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
  t.needsUpdate = true
  return t
}

async function loadTexture(url: string): Promise<THREE.Texture> {
  const resolved = url === '/brand/shrimp.png'
    ? await assetUrl(url, '/brand/shrimp.b64', 'image/png', 0x89)
    : url
  const loader = new THREE.TextureLoader()
  return new Promise((resolve, reject) => {
    loader.load(resolved, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      resolve(texture)
    }, undefined, () => reject(new Error('Could not load the district mark.')))
  })
}

function glProbe(attributes: WebGLContextAttributes): boolean {
  const test = document.createElement('canvas')
  test.width = 16
  test.height = 16
  const gl = test.getContext('webgl2', attributes) || test.getContext('webgl', attributes)
  if (!gl) return false
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return true
}

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  const tries: WebGLContextAttributes[] = [
    { antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false },
    { antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
    { antialias: false, failIfMajorPerformanceCaveat: false },
  ]
  for (const attributes of tries) {
    if (!glProbe(attributes)) continue
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, ...attributes })
      if (!renderer.getContext()) {
        renderer.dispose()
        continue
      }
      return renderer
    } catch {
      continue
    }
  }
  return null
}

let abandoned = false

async function main(onReveal: () => void, onFail: (error: unknown) => void = () => {}) {
  const canvas = must<HTMLCanvasElement>('#view')
  const boot = must<HTMLDivElement>('#boot')
  const bootText = must<HTMLParagraphElement>('#boot-text')
  const hint = must<HTMLParagraphElement>('#hint')
  const caption = must<HTMLElement>('#caption')
  const captionTitle = must<HTMLHeadingElement>('#cap-title')
  const captionBody = must<HTMLParagraphElement>('#cap-body')
  const stick = must<HTMLDivElement>('#stick')
  const nub = must<HTMLDivElement>('#nub')
  const act = must<HTMLButtonElement>('#act')
  const map = must<HTMLCanvasElement>('#map')
  const sheet = must<HTMLElement>('#sheet')
  const toast = must<HTMLElement>('#toast')

  const prefer: Graphics = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900 ? 'low' : 'medium'
  loadSave(prefer)

  const touchQuery = window.matchMedia('(pointer: coarse)')
  const setTouch = () => {
    document.body.classList.toggle('touch', touchQuery.matches)
    stick.setAttribute('aria-hidden', touchQuery.matches ? 'false' : 'true')
  }
  setTouch()
  touchQuery.addEventListener('change', setTouch)
  window.addEventListener('touchstart', () => {
    document.body.classList.add('touch')
    stick.setAttribute('aria-hidden', 'false')
  }, { passive: true })

  const hintCopy = () => (
    document.body.classList.contains('touch')
      ? 'Stick to walk. Drag the right side to look. The mint button enters.'
      : 'WASD to walk. Shift runs. Drag to look. E enters.'
  )
  hint.textContent = hintCopy()

  await Promise.race([
    Promise.all([
      document.fonts.load('72px "Archivo Black"'),
      document.fonts.load('32px Outfit'),
    ]),
    new Promise((resolve) => setTimeout(resolve, 1800)),
  ])

  const renderer = createRenderer(canvas)
  if (!renderer) {
    await startFlat(onReveal)
    return
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.AgXToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 260)
  const mark = await withTimeout(loadTexture('/brand/shrimp.png'), 5000, blankTexture, 'District mark')
  const image = mark.image as { width?: number; height?: number }
  const aspect = image.width && image.height ? image.height / image.width : 0.86
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const world = createWorld({
    scene,
    anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    mark,
    aspect,
    reduceMotion,
    rankLabel: rankFor(getSave().xp).label,
    getSeries: () => ({ unit: getSave().unitHist, meme: getSave().memeHist }),
  })
  let travelHook: (title: string, enter?: boolean) => void = () => {}
  const crowd = createCrowd(scene)
  const agentBot = createAgentCompanion(scene)
const apiAgents = createRemoteAgents(scene)
  const physSky = createPhysicalSky(scene)
  const ambient = createAmbient(scene, world.obstacles, window.matchMedia('(pointer: coarse)').matches)
  const watch = createWatch(scene, getSave().graphics === 'low' ? 1 : 3)
  let nightLevel = 0
  const skyline = createSkyline(scene, getSave().graphics)
  const traffic = createTraffic(scene, world.lanes, getSave().graphics)
  // ~10 real minutes per in-game day. GN time in Settings picks where the clock starts.
  const DAY_SECONDS = 600
  const phaseFor = (time: string) => (time === 'day' ? 0.42 : time === 'dusk' ? 0.74 : 0.02)
  const forced = new URLSearchParams(location.search).get('time')
  if (forced === 'day' || forced === 'dusk' || forced === 'night') setTime(forced)
  let dayPhase = phaseFor(getSave().timeOfDay)
  // Phones: extra sky/ground fill so figures never go silhouette-black on dim mobile screens.
  const phoneFill = new THREE.HemisphereLight(0xdfe6ee, 0x6b5a48, 0)
  phoneFill.visible = matchMedia('(pointer: coarse)').matches
  scene.add(phoneFill)
  if (phoneFill.visible) scene.add(new THREE.AmbientLight(0xfff4e6, 0.25))
  let lightAcc = 1
  const calmSky = () => reduceMotion || getSave().reduceMotion

  let avatar: Avatar = createAvatar(getSave().body, getSave().tint, getSave().luxury)
  if (NFT_COLLECTIONS_ENABLED) void loadSkinPermissions().then(() => { if (getSave().mask !== 'none') avatar.setMask(getSave().mask) })
  const pos = { x: getSave().posX, z: getSave().posZ }
  { // Test hook: ?at=x,z starts the player there (used by the automated screenshots).
    const at = new URLSearchParams(location.search).get('at')?.split(',').map(Number)
    if (at && at.length === 2 && at.every(Number.isFinite)) { pos.x = at[0]!; pos.z = at[1]! }
  }
  if (blocked(world.obstacles, pos.x, pos.z, PLAYER_R)) {
    pos.x = 0
    pos.z = 8
  }
  avatar.object.position.set(pos.x, 0, pos.z)
  if (wearsPlate(getSave().body)) tagPlayer(avatar.object, getSave().name, getSave().username)
  avatar.setMask(getSave().mask)
  scene.add(avatar.object)
  let follower: THREE.Group | null = null
  let followerKind: DroneId | 'none' = 'none'
  const syncDrone = () => {
    const kind = getSave().drone
    if (kind === followerKind) return
    if (follower) {
      releaseDrone(follower)
      follower = null
    }
    followerKind = kind
    // Personal follow drones retired: the city is watched by patrol drones instead (watch.ts).
    if (kind === 'none' || kind) return
    follower = createDrone(kind)
    follower.position.set(pos.x + 0.8, 2.2, pos.z + 0.4)
    scene.add(follower)
  }
  syncDrone()

  const applyLook = () => {
    const time = getSave().timeOfDay
    world.setLook({ time, season: seasonAt() })
    dayPhase = phaseFor(time)
    world.setDaylight(dayPhase)
    lightAcc = 1 // re-run the eased exposure/env update on the next frame
  }
  applyEnvironment(renderer, scene)
  const post = createPost(renderer, scene, camera)
  const probe = createProbe(() => getSave().graphics, (g) => { setGraphics(g); applyGraphics() })
  const applyGraphics = () => {
    const graphics = getSave().graphics
    const dpr = window.devicePixelRatio || 1
    const coarseDev = matchMedia('(pointer: coarse)').matches
    // Phones: never above 1.5x (a 2.6x DPR screen is ~3x the pixels for no visible gain at arm's length).
    const ratio = Math.min(dpr, graphics === 'low' ? 1 : graphics === 'medium' || coarseDev ? 1.5 : 2)
    renderer.setPixelRatio(ratio)
    // Shadows only on high: the biggest single cost on mid-range Android.
    const shadows = graphics === 'high' && !matchMedia('(pointer: coarse)').matches
    renderer.shadowMap.enabled = shadows
    world.sun.castShadow = shadows
    const size = graphics === 'high' ? 2048 : 1024
    if (world.sun.shadow.mapSize.x !== size) {
      world.sun.shadow.mapSize.set(size, size)
      world.sun.shadow.map?.dispose()
      world.sun.shadow.map = null
    }
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    post.configure(graphics, window.innerWidth, window.innerHeight, ratio)
  }
  const applyBody = () => {
    const save = getSave()
    scene.remove(avatar.object)
    avatar = createAvatar(save.body, save.tint, save.luxury)
    avatar.object.position.set(pos.x, 0, pos.z)
    avatar.setMask(save.mask)
    if (wearsPlate(save.body)) tagPlayer(avatar.object, save.name, save.username)
    scene.add(avatar.object)
    syncDrone()
  }

  applyLook()
  applyGraphics()
  applyPrefs()

  const ui = mountUi(sheet, toast, {
    rank: must('#pill-rank'),
    place: must('#pill-place'),
    ledger: must('#pill-ledger'),
    season: must('#pill-season'),
    focus: must('#pill-focus'),
  }, {
    onStyle: () => {
      const save = getSave()
      avatar.setStyle(save.tint, save.luxury)
      avatar.setMask(save.mask)
      syncDrone()
      if (wearsPlate(save.body)) tagPlayer(avatar.object, save.name, save.username)
    },
    onBody: applyBody,
    onLook: applyLook,
    onGraphics: applyGraphics,
    onPrefs: applyPrefs,
    onRank: (label) => world.setRank(label),
    travel: (title, enter) => travelHook(title, enter),
  })
  function hooksTeleport(x: number, z: number) {
      pos.x = x
      pos.z = z
      vel.x = 0
      vel.z = 0
      target = null
      cameraReady = false
  }

  must('#nav-profile').addEventListener('click', () => ui.open('profile'))
  must('#nav-boutique').addEventListener('click', () => ui.open('boutique'))
  must('#nav-city').addEventListener('click', () => ui.open('city'))
  must('#nav-settings').addEventListener('click', () => ui.open('settings'))
  // Click-to-travel: tap a spot on the map and arrive outside the nearest door.
  const travelTo = (spot: Hotspot) => {
    if (interiors.inside) leaveRoom()
    const len = Math.hypot(spot.x, spot.z) || 1
    const step = Math.min(2.4, len)
    ui.close()
    hooksTeleport(spot.x - (spot.x / len) * step, spot.z - (spot.z / len) * step)
    ui.setPlace(districtName(pos.x, pos.z))
    ui.toast(`Travelled to ${spot.title}.`)
  }
  travelHook = (title, enter) => {
    const spot = world.hotspots.find((h) => h.title === title)
    if (!spot) return
    travelTo(spot)
    if (!enter) return
    if (interiors.roomFor(spot.id)) enterRoom(spot)
    else if (spot.action) ui.open(spot.action as Parameters<typeof ui.open>[0])
  }
  // Test hook: ?room=<hotspot id|action> walks you into that room after boot. Only moves the local player.
  const roomParam = new URLSearchParams(location.search).get('room')
  if (roomParam) window.setTimeout(() => {
    const spot = world.hotspots.find((h) => (h.id === roomParam || h.action === roomParam) && interiors.roomFor(h.id))
    if (spot) { travelTo(spot); enterRoom(spot) }
  }, 1500)
  map.addEventListener('click', (event) => {
    const rect = map.getBoundingClientRect()
    const wx = (((event.clientX - rect.left) / rect.width) - 0.5) * 2 * MAP_LIMIT
    const wz = (((event.clientY - rect.top) / rect.height) - 0.5) * 2 * MAP_LIMIT
    let best: Hotspot | null = null
    let bestD = Infinity
    for (const h of world.hotspots) {
      if (!h.action) continue
      const d = (h.x - wx) ** 2 + (h.z - wz) ** 2
      if (d < bestD) { bestD = d; best = h }
    }
    if (best && bestD < 14 * 14) travelTo(best)
    else ui.open('city')
  })
  must('#pill-rank').addEventListener('click', () => ui.open('profile'))
  must('#pill-ledger').addEventListener('click', () => ui.open('profile', { tab: 'books' }))
  must('#pill-season').addEventListener('click', () => ui.open('season'))
  must('#pill-place').addEventListener('click', () => ui.open('city'))
  document.querySelector('#shot')?.addEventListener('click', () => {
    renderer.render(scene, camera)
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


  const input = createInput(canvas, stick, nub)
  must('#cam-in').addEventListener('click', () => input.nudgeZoom(-260))
  must('#cam-out').addEventListener('click', () => input.nudgeZoom(260))
  must('#cam-turn').addEventListener('click', () => input.nudgeLook(-150))
  // Dock active state follows whichever panel is open.
  const navButtons = [...document.querySelectorAll<HTMLButtonElement>('#nav .icon-btn')]
  for (const b of navButtons) b.addEventListener('click', () => { for (const o of navButtons) o.classList.toggle('active', o === b) })
  new MutationObserver(() => { if (!document.body.classList.contains('sheet-open')) for (const o of navButtons) o.classList.remove('active') })
    .observe(document.body, { attributes: true, attributeFilter: ['class'] })

  const chat = must<HTMLFormElement>('#chat')
  const chatInput = must<HTMLInputElement>('#chat-input')
  const chatLog = must<HTMLOListElement>('#chat-log')
  const chatStatus = must<HTMLParagraphElement>('#chat-status')
  // Message icon: the chat stays folded until tapped. Type, or record a voice note indoors.
  mountNotifications()
  notify('Welcome to Grind District', 'You start as a shrimp. Learn, show up, and climb to whale.', 'welcome', 'place:The Grind Ring')
  onActivity((kind, label, detail) => {
    if (kind === 'tax') notify('Family request', `${label}. ${detail}`, undefined, 'panel:profile')
    else if (kind === 'skill' && label.startsWith('Passed')) notify('Course complete', `${label}. ${detail}`, undefined, 'panel:profile')
    else if (label === 'Sign-up bonus') notify('Sign-up bonus', detail, undefined, 'balance')
  })
  subscribe((rankedUp) => { if (rankedUp) notify('Rank up', `You are now ${rankFor(getSave().xp).label}.`, undefined, 'panel:profile') })
  // Map lives inside the three-line menu; the menu starts collapsed so the screen stays clear.
  document.body.classList.add('rail-shut')
  const railToggle = must<HTMLButtonElement>('#rail-toggle')
  railToggle.setAttribute('aria-expanded', 'false')
  // Control Centre (iPhone-style): one menu button on screen; everything else lives inside.
  const nav = must<HTMLElement>('#nav')
  const ccSheet = must<HTMLElement>('#cc-sheet')
  const sheetTitle = must<HTMLElement>('#cc-sheet-title')
  const sheetBody = must<HTMLElement>('#cc-sheet-body')
  const paintStatus = () => {
    must('#cc-balance').textContent = `$${getSave().ledger.toFixed(2)}`
    must('#cc-rank').textContent = `${rankFor(getSave().xp).label} · in-game balance · tap for history`
  }
  const closeSheet = () => { ccSheet.hidden = true; document.body.classList.remove('cc-sheet-on'); sheetBody.replaceChildren() }
  const setCC = (open: boolean) => {
    document.body.classList.toggle('rail-shut', !open)
    railToggle.setAttribute('aria-expanded', String(open))
    if (open) paintStatus()
    else closeSheet()
  }
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  const when = (at: number) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  // Deep links from notifications/messages: travel to a place, open a panel, chat or balance.
  const follow = (go?: string) => {
    if (!go) return false
    setCC(false)
    if (go === 'chat') { if (chat.hidden) must<HTMLButtonElement>('#msg-btn').click(); return true }
    if (go === 'balance') { setCC(true); openBalance(); return true }
    if (go.startsWith('place:')) { travelHook(go.slice(6), true); return true }
    if (go.startsWith('panel:')) { ui.open(go.slice(6) as Parameters<typeof ui.open>[0]); return true }
    return false
  }
  const openSheet = (title: string, fill: () => void) => {
    sheetTitle.textContent = title
    ccSheet.hidden = false; document.body.classList.add('cc-sheet-on')
    fill()
  }
  const renderNotes = () => {
    sheetBody.replaceChildren()
    const all = el('button', 'Mark all read', 'cc-link')
    all.type = 'button'
    all.onclick = () => { markRead(); renderNotes() }
    const list = el('ol', '', 'cc-list')
    for (const n of getNotes()) {
      const li = el('li', '', n.read ? 'read' : 'unread')
      const btn = el('button', '', 'cc-row')
      btn.type = 'button'
      btn.append(el('strong', n.title), el('time', when(n.at)), el('p', n.body))
      if (n.go) btn.append(el('span', n.go === 'chat' ? 'Open chat ›' : n.go === 'balance' ? 'Open balance ›' : n.go.startsWith('place:') ? `Go to ${n.go.slice(6)} ›` : 'Open ›', 'cc-go'))
      btn.onclick = () => { markRead(n.id); if (!follow(n.go)) renderNotes() }
      li.append(btn)
      list.append(li)
    }
    if (!getNotes().length) list.append(el('li', 'Nothing yet.', 'empty'))
    sheetBody.append(all, list)
  }
  const openBalance = () => openSheet('Balance', () => {
    const save = getSave()
    sheetBody.replaceChildren(
      el('p', `$${save.ledger.toFixed(2)}`, 'cc-big'),
      el('p', 'In-game virtual balance. Top up with ETH or USDC on Base below.', 'cc-muted'),
    )
    const topBtn = el('button', 'Top up', 'topup-go')
    topBtn.type = 'button'
    topBtn.onclick = () => { topBtn.remove(); void import('./topup.ts').then((m) => m.renderTopup(topSlot, () => { paintStatus(); const big = sheetBody.querySelector('.cc-big'); if (big) big.textContent = `$${getSave().ledger.toFixed(2)}` })) }
    const topSlot = el('div')
    sheetBody.append(topBtn, topSlot, el('h3', 'In-game activity'))
    const list = el('ol', '', 'cc-list')
    const moves = save.activities.filter((a) => a.kind === 'money' || a.kind === 'trade' || a.kind === 'gig' || a.kind === 'tax' || /\$/.test(a.detail + a.label))
    for (const a of moves) { const li = el('li'); li.append(el('strong', a.label), el('time', when(a.at)), el('p', a.detail)); list.append(li) }
    if (!moves.length) list.append(el('li', 'No in-game balance moves yet.', 'empty'))
    sheetBody.append(list)
  })
  must('#cc-sheet-back').addEventListener('click', closeSheet)
  railToggle.addEventListener('click', () => setCC(document.body.classList.contains('rail-shut')))
  nav.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target === nav) { setCC(false); return } // tap outside the modules closes
    if (target.closest('#cc-sheet')) return
    const hit = target.closest('button, a')
    if (!hit || ['cc-keys', 'cc-bell', 'cc-status'].includes(hit.id)) return
    window.setTimeout(() => setCC(false), 0)
  })
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.body.classList.contains('rail-shut')) return
    if (!ccSheet.hidden) closeSheet(); else setCC(false)
  })
  must('#cc-keys').addEventListener('click', () => { const list = must<HTMLElement>('#cc-keylist'); list.hidden = !list.hidden; must('#cc-keys').classList.toggle('on', !list.hidden) })
  must('#cc-msg').addEventListener('click', () => { if (chat.hidden) must<HTMLButtonElement>('#msg-btn').click() })
  must('#cc-bell').addEventListener('click', () => openSheet('Notifications', renderNotes))
  must('#cc-status').addEventListener('click', openBalance)
  onNotesChange(() => { if (!ccSheet.hidden && sheetTitle.textContent === 'Notifications') renderNotes() })
  // Sliders: while dragging, the menu fades away so the city stays visible; a readout shows the level and zone.
  const readout = must<HTMLElement>('#cc-readout')
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const paintReadout = (kind: 'zoom' | 'look') => {
    const place = interiors.inside ? 'Indoors' : districtName(avatar.object.position.x, avatar.object.position.z)
    if (kind === 'zoom') {
      // Slider up = zoom in. The readout mirrors the camera distance the frame loop actually uses.
      const pct = Math.round(((12 - camDist) / (12 - 3.2)) * 100)
      readout.textContent = `Zoom ${pct > 75 ? 'Close' : pct > 40 ? 'Street' : 'Wide'} · ${pct}% · ${place}`
    } else {
      const deg = ((Math.round(THREE.MathUtils.radToDeg(camYaw)) % 360) + 360) % 360
      readout.textContent = `Facing ${DIRS[Math.round(deg / 45) % 8]} · ${deg}° · ${place}`
    }
  }
  // Custom pointer-driven sliders (native vertical range inputs ignore touch-drag on iOS and some Androids).
  // The whole track is the hit area: finger height sets the value directly; pointer capture keeps the drag alive.
  const slide = (id: string, kind: 'zoom' | 'look', apply: (v: number, prev: number) => void, read: () => number) => {
    const inputEl = must<HTMLInputElement>(id)
    const track = inputEl.parentElement as HTMLElement
    track.style.touchAction = 'none'
    inputEl.style.pointerEvents = 'none'
    const paint = (v: number) => { inputEl.value = String(Math.round(v)); track.style.setProperty('--v', `${v}%`) }
    let value = 50 // camera state is read lazily (declared later in boot)
    paint(value)
    let dragging = -1
    const at = (e: PointerEvent) => { const r = track.getBoundingClientRect(); return THREE.MathUtils.clamp(((r.bottom - e.clientY) / r.height) * 100, 0, 100) }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== dragging) return
      e.preventDefault()
      const v = at(e)
      apply(v, value)
      value = v
      paint(v)
      paintReadout(kind)
    }
    const end = (e: PointerEvent) => {
      if (e.pointerId !== dragging) return
      dragging = -1
      document.body.classList.remove('cc-peek')
      track.classList.remove('active')
      readout.hidden = true
    }
    track.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      dragging = e.pointerId
      track.setPointerCapture?.(e.pointerId)
      document.body.classList.add('cc-peek')
      track.classList.add('active')
      readout.hidden = false
      value = read()
      move(e)
    })
    track.addEventListener('pointermove', move)
    track.addEventListener('pointerup', end)
    track.addEventListener('pointercancel', end)
    track.addEventListener('lostpointercapture', end)
    track.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation() })
    railToggle.addEventListener('click', () => { value = read(); paint(value) })
  }
  const ZMIN = 3.2, ZMAX = 12
  slide('#cc-zoom', 'zoom', (v) => { camDist = ZMAX - (v / 100) * (ZMAX - ZMIN) }, () => ((ZMAX - camDist) / (ZMAX - ZMIN)) * 100)
  // Turn: the full track is one full turn; dragging rotates the camera continuously, the fill shows heading.
  slide('#cc-look', 'look', (v, prev) => { camYaw += ((v - prev) / 100) * Math.PI * 2; lookIdle = 0 },
    () => (((((camYaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * 100))
  const dot = railToggle.querySelector('.cc-dot') as HTMLElement
  const bellBadge = must<HTMLElement>('#cc-bell-badge')
  window.setInterval(() => {
    const n = unreadCount()
    const msgUnread = must('#msg-btn').classList.contains('unread')
    dot.hidden = !(n || msgUnread)
    bellBadge.hidden = n === 0
    bellBadge.textContent = n > 9 ? '9+' : String(n)
    must('#cc-msg').classList.toggle('has-unread', msgUnread)
  }, 800)
  const msgBtn = must<HTMLButtonElement>('#msg-btn')
  must('#chat-close').addEventListener('click', () => { if (!chat.hidden) msgBtn.click() })
  chat.hidden = true
  msgBtn.addEventListener('click', () => {
    chat.hidden = !chat.hidden
    msgBtn.classList.remove('unread')
    msgBtn.setAttribute('aria-expanded', String(!chat.hidden))
    if (!chat.hidden) chatInput.focus()
  })
  const identity = () => {
    const save = getSave()
    return { name: save.name, username: save.username, body: save.body, tint: save.tint }
  }
  const net = createNet({
    scene,
    me: identity(),
    getSelf: () => avatar.object,
    onLine: ({ from, text, self, audio }) => {
      const item = document.createElement('li')
      const who = document.createElement('b')
      who.textContent = self ? 'You' : from
      item.append(who, ` ${text}`)
      if (audio) {
        // Tap-to-play bubble; nothing autoplays.
        const play = document.createElement('button')
        play.type = 'button'
        play.className = 'voice-play'
        play.textContent = '▶ Play'
        play.setAttribute('aria-label', `Play voice note from ${self ? 'you' : from}`)
        const el = new Audio()
        el.preload = 'none'
        el.src = audio
        play.onclick = () => { if (el.paused) { void el.play(); play.textContent = '❚❚ Pause' } else { el.pause(); play.textContent = '▶ Play' } }
        el.onended = () => { play.textContent = '▶ Play' }
        item.append(' ', play)
      }
      chatLog.append(item)
      if (chat.hidden && !self) msgBtn.classList.add('unread')
      if (!self) notify('Nearby message', `${from}: ${text}`.slice(0, 120), undefined, 'chat')
      while (chatLog.children.length > 5) chatLog.firstElementChild?.remove()
      window.setTimeout(() => item.remove(), 20000)
    },
    onStatus: (online) => {
      chatStatus.textContent = online
        ? 'Live · 12 m'
        : 'Solo city.'
    },
  })
  void import('./voice.ts').then((m) => m.mountVoice(chat, net, (t) => ui.toast(t), () => {
    if (!interiors.inside) return 'Voice notes are off on the street. Step inside a room to record.'
    if (import.meta.env.VITE_VOICE_NOTES !== '1') return 'Voice notes open soon.'
    return null
  }))
  chat.addEventListener('submit', (event) => {
    event.preventDefault()
    net.setMe(identity())
    net.say(chatInput.value)
    chatInput.value = ''
    chatInput.blur()
  })
  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') chatInput.blur()
  })
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || ui.isOpen()) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    chatInput.focus()
  })
  act.addEventListener('click', () => input.requestInteract())

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.4, 28),
    new THREE.MeshBasicMaterial({ color: 0x17f790, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }),
  )
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.04
  marker.visible = false
  marker.userData.ghost = true
  scene.add(marker)

  // Start at a 3/4-front angle so the player's face is visible.
  let camYaw = Math.PI + 0.45
  let faceYaw = Math.PI
  let stillFor = 0
  let camPitch = 0.42
  let camDist = 5.6
  let sprinting = false
  let introT = 0
  let introStart = 0
  const introPos = new THREE.Vector3()
  const shoulder = new THREE.Vector3()
  let lookIdle = 0
  const camVel = new THREE.Vector3()
  const lookSmooth = new THREE.Vector3()
  const vel = { x: 0, z: 0 }
  let target: THREE.Vector3 | null = null
  // Go home (button, Home or H key): teleport the player straight inside their house. No on-screen marker.
  const goHome = () => {
    if (interiors.inside === 'house') { ui.toast('You are home.'); return }
    const spot = world.hotspots.find((h) => h.house === 'yours' && interiors.roomFor(h.id))
    if (!spot) { ui.toast('Your house is on the east row.'); return }
    setCC(false)
    travelTo(spot)
    enterRoom(spot)
  }
  must('#go-home').addEventListener('click', goHome)
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Home' && !ui.isOpen()) {
      event.preventDefault()
      goHome()
    }
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    if (typing || event.repeat || event.ctrlKey || event.metaKey) return
    if ((event.key === 'h' || event.key === 'H') && !ui.isOpen()) goHome()
    if (event.key === 'm' || event.key === 'M') must<HTMLButtonElement>('#nav-city').click()
  })
  let busyFor = 0
  let exitCooldown = 0
  const interiors = createInteriors(scene, {
    toast: (text) => ui.toast(text),
    openPanel: (panel) => ui.open(panel),
    onLook: () => applyLook(),
    busy: (seconds, x, z, yaw) => {
      busyFor = seconds
      pos.x = x
      pos.z = z
      faceYaw = yaw
      avatar.object.rotation.y = yaw
    },
  })
  let streetDoor = { x: 0, z: 0 }
  const enterRoom = (doorSpot: Hotspot) => {
    const room = interiors.roomFor(doorSpot.id)
    if (!room) return false
    streetDoor = { x: doorSpot.x, z: doorSpot.z }
    const at = interiors.enter(room)
    pos.x = at.x
    pos.z = at.z
    vel.x = 0
    vel.z = 0
    target = null
    camYaw = at.yaw + Math.PI
    camDist = Math.min(camDist, 4.2)
    smoothCam.set(pos.x + Math.sin(camYaw) * 3, 2.6, pos.z + Math.cos(camYaw) * 3)
    camVel.set(0, 0, 0)
    exitCooldown = 1
    return true
  }
  const leaveRoom = () => {
    const out = interiors.exit(streetDoor.x, streetDoor.z)
    pos.x = out.x
    pos.z = out.z
    vel.x = 0
    vel.z = 0
    target = null
    camYaw = Math.atan2(out.x - streetDoor.x, out.z - streetDoor.z)
    smoothCam.set(pos.x + Math.sin(camYaw) * 4, 3, pos.z + Math.cos(camYaw) * 4)
    camVel.set(0, 0, 0)
    exitCooldown = 1.2
  }
  let stuck = 0
  let prevDist = Infinity
  let traveled = 0
  let activeSpot: string | null = null
  let spot: Hotspot | null = null
  let cameraReady = false
  let revealed = false
  let failed = false
  let elapsed = 0
  let season = seasonAt()
  let saveAcc = 0
  let taxLatch = false
  let crowdObstacles: Obstacle[] = []
  const blockers: Obstacle[] = []

  const raycaster = new THREE.Raycaster()
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const pointer = new THREE.Vector2()
  const tapPoint = new THREE.Vector3()
  const lookTarget = new THREE.Vector3()
  const desiredCam = new THREE.Vector3()
  const smoothCam = new THREE.Vector3()
  const pulledCam = new THREE.Vector3()
  const rayDirection = new THREE.Vector3()
  const focus = new THREE.Vector3()
  const mapCtx = map.getContext('2d')

  const resize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    camera.aspect = width / Math.max(1, height)
    camera.fov = width < 800 ? 60 : 55
    camera.updateProjectionMatrix()
    applyGraphics()
  }
  resize()
  window.addEventListener('resize', resize)

  const pullCamera = (origin: THREE.Vector3, desired: THREE.Vector3) => {
    rayDirection.subVectors(desired, origin)
    const dist = rayDirection.length()
    if (dist < 0.05) return pulledCam.copy(desired)
    rayDirection.multiplyScalar(1 / dist)
    raycaster.set(origin, rayDirection)
    raycaster.far = dist
    const hits = raycaster.intersectObjects(scene.children, true)
    for (const hit of hits) {
      if (hit.object.userData.ghost) continue
      if (isUnder(avatar.object, hit.object)) continue
      const travel = Math.max(0.7, hit.distance - 0.45)
      return pulledCam.copy(origin).addScaledVector(rayDirection, travel)
    }
    return pulledCam.copy(desired)
  }

  const showSpot = (next: Hotspot | null) => {
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
    act.hidden = !(next.action || next.use || next.exit)
    act.textContent = next.enter ?? 'Enter'
  }

  let mapAcc = 1
  const drawMap = () => {
    if (!mapCtx) return
    drawMinimap(mapCtx, map.width, map.height, pos, net.peers())
  }

  const update = (dt: number) => {
    const now = Date.now()
    tickMarket(dt, now)
    const nextSeason = seasonAt(now)
    if (nextSeason !== season) {
      season = nextSeason
      applyLook()
      ui.refresh()
    }
    crowdObstacles = crowd.tick(dt)
    agentBot.tick(dt, avatar.object.position)
  apiAgents.tick(dt)
    crowdObstacles.push(...traffic.tick(dt, elapsed, pos, crowdObstacles))
    // Reduced motion holds the sky still at the chosen GN time.
    if (!calmSky()) dayPhase = (dayPhase + dt / DAY_SECONDS) % 1
    lightAcc += dt
    if (lightAcc > 0.25) {
      lightAcc = 0
      world.setDaylight(dayPhase)
      physSky.setPhase(dayPhase, focus)
      const sunUp = Math.sin((dayPhase - 0.25) * Math.PI * 2)
      nightLevel = 1 - THREE.MathUtils.smoothstep(sunUp, -0.12, 0.3)
      post.setNight(nightLevel)
      // Ease everything with the same curve: env map and exposure fall away after dusk.
      scene.environmentIntensity = 0.6 * (1 - nightLevel) + 0.1 * nightLevel
      renderer.toneMappingExposure = THREE.MathUtils.lerp(1.18, 1.0, nightLevel) // AgX: filmic highlight roll-off, truer colours than ACES
      physSky.sky.visible = nightLevel < 0.85
  phoneFill.intensity = phoneFill.visible ? 0.4 * (1 - nightLevel) + 0.06 : 0
    }
    world.tick(elapsed, focus.set(pos.x, 0, pos.z))
    watch.tick(elapsed, focus, nightLevel)
    skyline.tick(elapsed, nightLevel)
    ambient.tick(elapsed, focus, nightLevel)
    if (!interiors.inside) ui.setPlace(districtName(pos.x, pos.z))

    const frame = input.read()
    const paused = ui.isOpen()
    if (frame.lookX !== 0 || frame.lookY !== 0) lookIdle = 0
    else lookIdle += dt
    camYaw -= frame.lookX * 0.0052
    camPitch = THREE.MathUtils.clamp(camPitch - frame.lookY * 0.0036, 0.18, 1.05)
    camDist = THREE.MathUtils.clamp(camDist + frame.zoom * 0.012, 3.2, 12)

    exitCooldown = Math.max(0, exitCooldown - dt)
    busyFor = Math.max(0, busyFor - dt)
    if (!paused && frame.interact && spot) {
      if (spot.exit) leaveRoom()
      else if (spot.use) spot.use()
      else if (!enterRoom(spot) && spot.action) ui.open(spot.action, spot.house ? { house: spot.house } : undefined)
    }

    if (!paused && frame.tap) {
      pointer.set(frame.tap.nx, frame.tap.ny)
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(floor, tapPoint)) {
        target = tapPoint.clone()
        const room = interiors.bounds()
        if (room) {
          target.x = THREE.MathUtils.clamp(target.x, room.x - room.hw, room.x + room.hw)
          target.z = THREE.MathUtils.clamp(target.z, room.z - room.hd, room.z + room.hd)
        } else {
          target.x = THREE.MathUtils.clamp(target.x, -CITY_LIMIT + 1, CITY_LIMIT - 1)
          target.z = THREE.MathUtils.clamp(target.z, -CITY_LIMIT + 1, CITY_LIMIT - 1)
        }
        stuck = 0
        prevDist = Infinity
      }
    }

    const forwardX = -Math.sin(camYaw)
    const forwardZ = -Math.cos(camYaw)
    const rightX = Math.cos(camYaw)
    const rightZ = -Math.sin(camYaw)
    const directed = !paused && Math.hypot(frame.x, frame.y) > 0.06
    let wishX = 0
    let wishZ = 0
    if (paused) {
      target = null
    } else if (directed) {
      wishX = forwardX * frame.y + rightX * frame.x
      wishZ = forwardZ * frame.y + rightZ * frame.x
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
    const running = frame.run || frame.stick > 0.88
    sprinting = running && mag > 0.2
    const speed = (running ? RUN : WALK) * mag
    // Accelerate briskly, brake harder, and settle to an exact stop so the body never drifts.
    const rate = 1 - Math.exp(-(speed > 0.01 ? 10 : 16) * dt)
    vel.x += (dirX * speed - vel.x) * rate
    vel.z += (dirZ * speed - vel.z) * rate
    if (speed < 0.01 && Math.hypot(vel.x, vel.z) < 0.08) {
      vel.x = 0
      vel.z = 0
    }
    if (paused || busyFor > 0) {
      vel.x = 0
      vel.z = 0
    }
    blockers.length = 0
    if (interiors.inside) blockers.push(...interiors.obstacles())
    else blockers.push(...world.obstacles, ...crowdObstacles)
    // Sub-step so a fast frame on a slow phone can never tunnel through a wall; boxes slide.
    const steps = Math.max(1, Math.ceil((Math.hypot(vel.x, vel.z) * dt) / 0.2))
    for (let i = 0; i < steps; i += 1) {
      pos.x += (vel.x * dt) / steps
      pos.z += (vel.z * dt) / steps
      resolveCollision(pos, vel, blockers, PLAYER_R, Boolean(interiors.inside))
    }
    avatar.object.position.set(pos.x, 0, pos.z)
    const groundSpeed = Math.hypot(vel.x, vel.z)
    const moving = groundSpeed > 0.22
    // Face where the body actually goes (after collision), falling back to the input while starting.
    const faceX = groundSpeed > 0.3 ? vel.x / groundSpeed : dirX
    const faceZ = groundSpeed > 0.3 ? vel.z / groundSpeed : dirZ
    if (groundSpeed > 0.3) faceYaw = Math.atan2(faceX, faceZ)
    stillFor = groundSpeed > 0.2 ? 0 : stillFor + dt
    avatar.face(faceX, faceZ, dt, wishLen > 0.05 || groundSpeed > 0.3)
    avatar.step(dt, moving, Math.hypot(vel.x, vel.z))
    if (follower) {
      const goalX = pos.x + 0.85
      const goalZ = pos.z + 0.45
      const glide = 1 - Math.exp(-3 * dt)
      follower.position.x += (goalX - follower.position.x) * glide
      follower.position.z += (goalZ - follower.position.z) * glide
      follower.position.y = 2.15 + Math.sin(elapsed * 3) * 0.08
      spinDrone(follower, dt, elapsed)
    }
    traveled += Math.hypot(vel.x, vel.z) * dt
    if (traveled > 10) hint.classList.add('quiet')

    marker.visible = Boolean(target) && !paused
    if (target) {
      marker.position.x = target.x
      marker.position.z = target.z
      marker.scale.setScalar(reduceMotion ? 1 : 1 + Math.sin(elapsed * 6) * 0.08)
    }

    let best: Hotspot | null = null
    let bestDist = Infinity
    const candidates: Hotspot[] = interiors.inside ? (interiors.uses() as Hotspot[]) : world.hotspots
    for (const candidate of candidates) {
      const dist = Math.hypot(pos.x - candidate.x, pos.z - candidate.z)
      // Walking through a door enters or leaves the 3D room.
      if (!paused && exitCooldown === 0 && dist < 0.75) {
        if (candidate.exit) { leaveRoom(); break }
        if (!interiors.inside && interiors.roomFor(candidate.id) && enterRoom(candidate)) break
      }
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

    // After a moment without manual look, ease the camera behind the walking direction.
    if (lookIdle > 1.6 && directed === false && Math.hypot(vel.x, vel.z) > 1 && !paused) {
      const behind = Math.atan2(-vel.x, -vel.z)
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-1.2 * dt))
    }
    // Idle for 2 s with no manual look: swing gently round to the 3/4 front so the face shows.
    if (stillFor > 2 && lookIdle > 2 && !paused) {
      const front = faceYaw + 0.45
      const delta = Math.atan2(Math.sin(front - camYaw), Math.cos(front - camYaw))
      camYaw += delta * (1 - Math.exp(-0.9 * dt))
    }
    if (!cameraReady) lookSmooth.set(pos.x, 1.15, pos.z)
    // Over-the-shoulder: frame the player slightly left of centre, GTA style.
    shoulder.set(Math.cos(camYaw), 0, -Math.sin(camYaw)).multiplyScalar(0.55 * Math.min(1, 6 / camDist))
    lookSmooth.lerp(lookTarget.set(pos.x + shoulder.x, 1.45, pos.z + shoulder.z), 1 - Math.exp(-12 * dt))
    lookTarget.copy(lookSmooth)
    const horiz = camDist * Math.cos(camPitch)
    desiredCam.set(pos.x + Math.sin(camYaw) * horiz, 1.15 + camDist * Math.sin(camPitch), pos.z + Math.cos(camYaw) * horiz)
    const ideal = pullCamera(lookTarget, desiredCam)
    if (!cameraReady) {
      smoothCam.copy(ideal)
      cameraReady = true
    } else {
      // Critically damped spring toward the ideal spot; the collision pull below snaps in instantly.
      const k = 38
      camVel.addScaledVector(pulledCam.copy(ideal).sub(smoothCam), k * dt).multiplyScalar(Math.exp(-2 * Math.sqrt(k) * dt))
      smoothCam.addScaledVector(camVel, dt)
    }
    const safe = pullCamera(lookTarget, smoothCam)
    if (safe.y < 0.4) safe.y = 0.4
    camera.position.copy(safe)
    // Cinematic intro: a high crane sweep over the skyline that settles behind the player.
    if (introT < 1 && !calmSky()) {
      introStart ||= performance.now()
      introT = Math.min(1, (performance.now() - introStart) / 3200)
      const k = introT * introT * (3 - 2 * introT)
      const a = camYaw + (1 - k) * 1.6
      introPos.set(pos.x + Math.sin(a) * 34, 26, pos.z + Math.cos(a) * 34)
      camera.position.lerpVectors(introPos, safe, k)
    }
    if (!Number.isFinite(camera.position.x + camera.position.y + camera.position.z)) {
      camera.position.set(pos.x, 6, pos.z + 8)
      camVel.set(0, 0, 0)
      smoothCam.copy(camera.position)
      introT = 1
    }
    camera.lookAt(lookTarget)
    camera.updateMatrixWorld()
    setMixerViewer(camera)
    const baseFov = window.innerWidth < 800 ? 60 : 55
    const fov = baseFov + (sprinting ? 6 : 0)
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-6 * dt))
      camera.updateProjectionMatrix()
    }
    net.tick(dt, { x: pos.x, z: pos.z, yaw: 0, moving })
    mapAcc += dt
    if (mapAcc > 0.1) { mapAcc = 0; drawMap() } // minimap at 10 Hz is plenty
    saveAcc += dt
    if (saveAcc > 2) {
      saveAcc = 0
      rememberPlace(pos.x, pos.z)
    }
  }

  await withTimeout(renderer.compileAsync(scene, camera).then(() => undefined), 4000, () => undefined, 'Shader warm-up')
  let last = performance.now()
  const frame = (now: number) => {
    if (abandoned) return
    requestAnimationFrame(frame)
    if (failed) return
    // Clamp to 50 ms: a GC/compile hitch must not teleport the player or kick the camera spring.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    if (document.hidden && revealed) return
    elapsed += dt
    try {
      update(dt)
      post.frame(dt, elapsed)
      post.render()
      if (revealed) probe(dt)
      if (!revealed) {
        revealed = true
        onReveal()
        boot.classList.add('hidden')
        boot.setAttribute('aria-hidden', 'true')
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
      console.error('[grind] Render loop error.', error)
      if (!revealed) {
        onFail(error)
        return
      }
      boot.classList.remove('hidden')
      boot.removeAttribute('aria-hidden')
      bootText.textContent = error instanceof Error ? error.message : 'The city could not stay open.'
    }
  }
  requestAnimationFrame(frame)
}

const menu = must<HTMLElement>('#menu')
const play = must<HTMLButtonElement>('#play')
const menuNote = must<HTMLParagraphElement>('#menu-note')
let opening = false

function revealCity() {
  menu.hidden = true
  const boot = document.querySelector('#boot')
  if (boot) {
    boot.classList.add('hidden')
    boot.setAttribute('aria-hidden', 'true')
  }
}

async function begin() {
  if (opening) return
  opening = true
  stopPreview()
  prepareAssets()
  play.disabled = true
  play.textContent = 'Opening the district'
  menuNote.textContent = ''
  // Watchdog: if the 3D city has not shown a frame within 15 s, open the overhead map instead.
  let shown = false
  const reveal = () => { shown = true; revealCity() }
  const flatFallback = async (why: unknown) => {
    if (shown) return
    shown = true
    abandoned = true
    console.error('[grind] 3D city failed to open; switching to the overhead map.', why)
    // A canvas that already holds a WebGL context cannot give a 2D one: swap in a fresh canvas.
    const old = document.querySelector<HTMLCanvasElement>('#view')
    if (old) old.replaceWith(old.cloneNode(false))
    try {
      await startFlat(revealCity)
    } catch (error) {
      console.error('[grind] Overhead map failed too.', error)
      opening = false
      play.disabled = false
      play.textContent = 'Enter the district'
      menu.hidden = false
      menuNote.textContent = 'The city could not open on this device. Try again or another browser.'
    }
  }
  const watchdog = window.setTimeout(() => { void flatFallback(new Error('timeout')) }, 15000)
  try {
    await main(reveal, (error) => { void flatFallback(error) })
  } catch (error) {
    await flatFallback(error)
  } finally {
    if (shown) clearTimeout(watchdog)
  }
}

let stopPreview: () => void = () => {}
void import('./preview.ts').then((m) => {
  const c = document.querySelector<HTMLCanvasElement>('#menu-preview')
  if (c && !opening) stopPreview = m.startPreview(c)
}).catch(() => {})

loadSave(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900 ? 'low' : 'medium')
startTracking()

mountMenu(() => {
  void begin()
})

play.focus()
