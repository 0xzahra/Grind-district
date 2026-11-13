import { nextMission } from './worlds.ts'
import { RANKS, RANK_START } from './logic.ts'
import { gameWalletChip } from './privyWallet.ts'
import { openFriends } from './messages.ts'
import * as THREE from 'three'
import { MIN_BOOM, overHead, travelBeforeWall } from './cameraBoom.ts'
import { resumeMusicOnFirstTap } from './music.ts'
import { speak } from './speech.ts'
import { setAmbientPlace, ensureAmbientOnGesture } from './ambient-audio.ts'
import { createWeather } from './weather.ts'
import { setMixerViewer, posedHuman } from './humans.ts'
import { createMentorCard, tourSeen } from './mentor.ts'
import { nextStep } from './objective.ts'
import { FREE_WILL_PRICE, buyFreeWill, ownsFreeWill, settleAway, markSeen } from './freeWill.ts'
import { createAvatar, type Avatar } from './avatars.ts'
import { loadSkinPermissions } from './skins.ts'
import { NFT_COLLECTIONS_ENABLED } from './nft.ts'
import { createAgentCompanion, createRemoteAgents } from './agent.ts'
import { MAP_LIMIT } from './minimap.ts'
import { publishProfile } from './share.ts'
import { startMoments, initCareer, renderCareer, renderFeed, onCareer, feedRankUp, getCareer, setStepSource, setUpgradeCard } from './career.ts'
import { JOBS } from './careerData.ts'
import { getNotes, markRead, setNoteFollow, mountNotifications, notify, onNotesChange, unreadCount } from './notify.ts'
import { createDrone, releaseDrone, spinDrone } from './drones.ts'
import { tagPlayer } from './player.ts'
import { assetUrl } from './assets.ts'
import { startFlat } from './flat.ts'
import { createInput } from './input.ts'
import { money, decodeShare, rankFor, seasonAt, wearsPlate, type DroneId, type Graphics, type SkillId } from './logic.ts'
import { drawMinimap, bakeSatellite, satelliteUrl } from './minimap.ts'
import { GUIDE } from './guide.ts'
import { createNet } from './net.ts'
import { encodeShare } from './logic.ts'
import { dmUnread, mountMessages, openInbox, openThread, openProfile, setPresence } from './messages.ts'
import { createTraffic } from './traffic.ts'
import { applyEnvironment, createPost, createProbe } from './quality.ts'
import { createWatch } from './watch.ts'
import { createSkyline } from './skyline.ts'
import { setShopRenderer } from './itemPics.ts'
import { setLookRenderer } from './lookShots.ts'
import { createStreetProps } from './props.ts'
import { createStreetscape } from './streetscape.ts'
import { applyPrefs } from './prefs.ts'
import { createCrowd, label as nameLabel } from './npcs.ts'
import { CITIZENS } from './citizens.ts'
import { blocked, CITY_LIMIT, PLAYER_R, resolveCollision, type Obstacle } from './physics.ts'
import { onActivity, subscribe, setTime, getSave, balanceSplit, loadSave, rememberPlace, setGraphics, tickMarket, spendInGame, bonusXp } from './state.ts'
import { mountUi } from './ui.ts'
import { createWorld, districtName, type Hotspot } from './world.ts'
import { createInteriors } from './interiors.ts'
import { createAmbient } from './ambient.ts'
import { createSeating, plazaSeats, seatSpot, workoutSpots, type Seat } from './seating.ts'
import { tickTvs } from './tv.ts'
import { tickWater } from './water.ts'
import { createPhysicalSky } from './sky.ts'
import { startNeeds, tickNeeds, socialised, paintNeedsCard, renderNeeds, onNeeds } from './needs.ts'
import { startPass } from './pass.ts'
import { startCashAlert } from './sfx.ts'
import { startReputation } from './rep.ts'
import { renderHoldings } from './walletHoldings.ts'
import { renderRankRoad, renderShopRow } from './walletRanks.ts'
import { createEstate } from './estate.ts'
import { createBeach } from './beach.ts'
import './style.css'
import './glass.css'
import { createPortrait } from './portrait.ts'
import { watchUpdates } from './update.ts'
watchUpdates()

// Faster to get around (owner request, 8 Nov): walk 2.7 -> 3.0, run 5.5 -> 7.2 m/s. Both stay inside the
// range the walk/run clips can match without feet sliding (walk clip up to ~3.0 m/s, run clip up to ~7.3 m/s).
const WALK = 3.0
const RUN = 7.2
// Tap the ground and you walk there: a brisk walking pace that keeps the walk animation (its clips are
// about 1.0 to 1.2 m/s and stay a walk up to about 1.75 m/s). The joystick and keys still jog and run.
const TAP_WALK = 1.65

let snapNext = false
let topupChunk: Promise<typeof import('./topup.ts')> | null = null
const topupModule = () => (topupChunk ??= import('./topup.ts').catch((e: unknown) => { topupChunk = null; throw e }))
// Top-up chunk loads only when the balance / top-up UI opens (keeps opening card off the critical path).

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

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  // Real game canvas only — never allocate+lose a probe context (that burned Mac GL).
  const tries: WebGLContextAttributes[] = [
    { antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false, alpha: false },
    { antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, alpha: false },
    { antialias: false, failIfMajorPerformanceCaveat: false, alpha: false },
    { antialias: false, alpha: true },
  ]
  for (const attributes of tries) {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, ...attributes })
      // Shader error checks make the browser finish every shader compile on the spot (seconds on a phone at
      // start-up). They only matter while developing, so the live game skips them.
      renderer.debug.checkShaderErrors = import.meta.env.DEV
      const gl = renderer.getContext() as WebGLRenderingContext | null
      if (!gl || gl.isContextLost?.()) { renderer.dispose(); continue }
      if (location.search.includes('stats')) (window as unknown as { __gdInfo: unknown }).__gdInfo = renderer.info
      return renderer
    } catch { continue }
  }
  return null
}

let abandoned = false

export async function startCity(onReveal: () => void, onFail: (error: unknown) => void = () => {}) {
  performance.mark('gd:start-fn')
  const canvas = must<HTMLCanvasElement>('#view')
  const boot = must<HTMLDivElement>('#boot')
  must<HTMLParagraphElement>('#boot-text')
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

  // Don't block city boot on display fonts — system stack already paints HUD; optional faces hydrate later.
  void Promise.all([
    document.fonts.load('800 48px "Inter Variable"').catch(() => undefined),
    document.fonts.load('600 32px "Inter Variable"').catch(() => undefined),
  ])

  { const q = new URLSearchParams(location.search); const r = q.get('ref'); if (q.get('src') === 'invite' && r && /^[a-z0-9_]{3,20}$/.test(r)) localStorage.setItem('gd.invitedBy', r) }
  performance.mark('gd:city-start')
  const renderer = createRenderer(canvas)
  if (!renderer) {
    await startFlat(onReveal)
    return
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  try { renderer.toneMapping = THREE.AgXToneMapping } catch { renderer.toneMapping = THREE.ACESFilmicToneMapping }
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 260)
  const mark = await withTimeout(loadTexture('/brand/shrimp.png'), 5000, blankTexture, 'District mark')
  const image = mark.image as { width?: number; height?: number }
  const aspect = image.width && image.height ? image.height / image.width : 0.86
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  performance.mark('gd:renderer')
  const world = createWorld({
    scene,
    anisotropy: Math.min(16, renderer.capabilities.getMaxAnisotropy()),
    mark,
    aspect,
    reduceMotion,
    rankLabel: rankFor(getSave().xp).label,
    getSeries: () => ({ unit: getSave().unitHist, meme: getSave().memeHist }),
  })
  let travelHook: (title: string, enter?: boolean) => void = () => {}
  performance.mark('gd:world')
  const crowd = createCrowd(scene, (x, z) => districtName(x, z))
  const greetBtn = document.createElement('button')
  greetBtn.type = 'button'; greetBtn.id = 'greet'; greetBtn.className = 'glass-fab greet-fab'; greetBtn.textContent = 'Greet'; greetBtn.hidden = true
  document.body.append(greetBtn)
  greetBtn.addEventListener('click', () => {
    // Greetings are player-to-player flavour. With no real reply yet, keep lines neutral —
    // never event/announcement copy tied to the moment you tap Greet.
    const tips = [
      'Hi!',
      'Hello.',
      'Hey — welcome.',
      'Good to see you.',
      'Welcome to the district.',
      'Morning.',
      'How is the grind?',
    ]
    const line = tips[Math.floor(Date.now() / 8000) % tips.length]!
    greetToast(line)
    speak(line, { gender: getSave().body === 'zuri' ? 'f' : 'm', seed: 1 })
    greetShown = 0; greetCool = 20; greetBtn.hidden = true
    socialised(10)
  })
  let greetToast: (m: string) => void = () => {}
  let greetShown = 0
  let greetAway = 99
  let greetCool = 0
  let serverSpoke = -99
  const SERVER_LINES = ['Welcome to Grind Ring. Coffee, juice or tea?', 'Morning! The mint tea is fresh.', 'Good to see you. What can I get you?', 'Cold brew is on special today.']
  let npcCard: HTMLElement | null = null
  const agentBot = createAgentCompanion(scene)
const apiAgents = createRemoteAgents(scene)
  performance.mark('gd:crowd-agents')
  const physSky = createPhysicalSky(scene)
  createEstate(scene, { graphics: getSave().graphics, obstacles: world.obstacles, hotspots: world.hotspots, toast: (m) => ui.toast(m) })
  const beach = createBeach(scene, getSave().graphics)
  const ambient = createAmbient(scene, world.obstacles, window.matchMedia('(pointer: coarse)').matches)
  const watch = createWatch(scene, getSave().graphics === 'low' ? 1 : 3)
  let nightLevel = 0
  const skyline = createSkyline(scene, getSave().graphics)
  // Residents walk fixed waypoint lines with no runtime obstacle avoidance (citizens.ts), so keep
  // instanced street furniture off those lines at generation time instead (e.g. the bench-clipping report near Influencer row).
  const citizenWalkLines = CITIZENS.flatMap((c) => c.points.length < 2 ? [] : c.points.map((p, i) => {
    const next = c.points[(i + 1) % c.points.length]!
    return { x1: p.x, z1: p.z, x2: next.x, z2: next.z }
  }))
  createStreetProps(scene, { lamps: world.lampSpots, trees: world.treeSpots, obstacles: world.obstacles, graphics: getSave().graphics, walkLines: citizenWalkLines })
  createStreetscape(scene, { obstacles: world.obstacles, graphics: getSave().graphics })
  performance.mark('gd:estate-beach-skyline-street')
  const traffic = createTraffic(scene, world.lanes, getSave().graphics)
  const weather = createWeather(scene, world.groundMat, matchMedia('(pointer: coarse)').matches ? 'low' : getSave().graphics)
  let bob = 0
  let hemiBase = 1
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
  const warmAmbient = new THREE.AmbientLight(0xffe2c0, 0.11) // warmer fill, toned down (Zahra: too bright)
  scene.add(warmAmbient)
  let lightAcc = 1
  // First task (GDD onboarding): until a course is passed, a floating gold marker hangs over the Campus door
  // and a prompt points there; walking up to the door opens the courses.
  const firstMarker = new THREE.Group()
  {
    // toneMapped left on (unlike other ghost/HUD markers) so this doesn't bloom into a hazy halo on Medium/High
    // while everything else in the scene is exposure- and AgX-graded: reported as "that ring is weird" on High.
    // Waypoint gem over the Campus door (not a spinning funnel): a slim gold diamond and a soft ring on the paving.
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8c27a, emissive: 0x8a6420, emissiveIntensity: 0.6, metalness: 0.85, roughness: 0.25 })
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0).scale(1, 1.9, 1), gold); gem.position.y = 0
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c879, transparent: true, opacity: 0.5, depthWrite: false }))
    halo.position.y = -4.15
    firstMarker.add(gem, halo); firstMarker.position.set(0, 4.2, -40.4)
  }
  // Zahra, the Campus mentor, stands beside the marker: walking up to her starts the first lesson in the street.
  const ada = posedHuman('woman2', { pose: 'stand', height: 1.68 })
  ada.position.set(1.9, 0, -40.9)
  ada.rotation.y = -0.35
  {
    const tag = nameLabel('Zahra', 'Campus mentor')
    tag.position.y = 2.25
    ada.add(tag)
  }
  ada.userData.ghost = true
  scene.add(ada)
  {
    const server = posedHuman('man1', { pose: 'stand', height: 1.76, look: { top: 0x1f5a4c, bottom: 0x23262a, shoes: 0x16181b } })
    server.position.set(0.35, 0.2, 0.32)
    server.userData.ghost = true
    scene.add(server)
  }
  resumeMusicOnFirstTap()
  ensureAmbientOnGesture()
  const needsFirstCourse = () => !Object.values(getSave().skills).some((s) => s?.passed)
  let firstOpened = false // re-armed when the player walks away from Zahra, so closing the card is never a dead end
  if (needsFirstCourse()) {
    scene.add(firstMarker)
    window.setTimeout(() => { if (needsFirstCourse()) notify('Meet Zahra at Campus', 'Follow the gold marker north of the plaza. Zahra gives you a 1-minute first lesson that files to your CV.', 'first-task', 'place:Campus') }, 2500)
  }
  const calmSky = () => reduceMotion || getSave().reduceMotion
  // Settings: GN night, Dusk and GM day hold the sky where the player put it; Auto lets the day run.
  const clockHeld = () => { try { return localStorage.getItem('gd.clock') === 'hold' } catch { return false } }

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

  window.addEventListener('gd:look', () => applyLook())
  setTimeout(() => void publishProfile(), 4000) // pull the account look on a fresh device
  const applyLook = () => {
    const time = getSave().timeOfDay
    world.setLook({ time, season: seasonAt() })
    dayPhase = phaseFor(time)
    world.setDaylight(dayPhase)
    lightAcc = 1 // re-run the eased exposure/env update on the next frame
  }
  applyEnvironment(renderer, scene)
  setShopRenderer(renderer, () => scene.environment)
  setLookRenderer(renderer, () => scene.environment)
  performance.mark('gd:traffic-weather-avatar')
  const post = createPost(renderer, scene, camera)
  performance.mark('gd:post')
  const probe = createProbe(() => getSave().graphics, (g) => { setGraphics(g); applyGraphics() })
  const applyGraphics = () => {
    const graphics = getSave().graphics
    const dpr = window.devicePixelRatio || 1
    const coarseDev = matchMedia('(pointer: coarse)').matches
    // Each tier must look and cost visibly different. Phones: 1x / 1.25x / 1.5x; desktops: 1x / 1.5x / 2x.
    // (Phones on High used to get 1.25x, below Medium's 1.5x, so High looked softer than Medium.)
    // Cap phone DPR harder so mid-range stays ~30+ FPS (High phone was 1.5× — still heavy with post).
    // Sharpness caps per tier. Phones used to draw the city at 1x on a 3x screen, which is what looked soft;
    // the post stack's resolution scaler (quality.ts) now steps down from these caps whenever frames run long.
    const ratio = Math.min(dpr, graphics === 'low' ? (coarseDev ? 1.5 : 1.25) : graphics === 'medium' ? (coarseDev ? 1.75 : 1.5) : 2)
    renderer.setPixelRatio(ratio)
    // Real-time light budget: Low 3 street-lamp lights, Medium 4, High all 6 plus the 10 glow lights.
    // Every point light is paid for in every lit pixel, so this is the biggest lever on mid-range phones.
    world.setQuality(graphics)
    // Shadows only on high: the biggest single cost on mid-range Android.
    const shadows = graphics !== 'low' && !matchMedia('(pointer: coarse)').matches
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

  greetToast = (m) => { ui.toast(m) }
  ;(window as unknown as { gdPos?: () => { x: number; z: number } }).gdPos = () => ({ x: pos.x, z: pos.z })
  window.addEventListener('gd-teleport', (e) => {
    const d = (e as CustomEvent<{ x: number; z: number; who?: string }>).detail
    if (!d || interiors.inside) { ui.toast(d?.who ? 'Step outside first.' : 'Step outside to join your party.'); return }
    pos.x = d.x + 1.2; pos.z = d.z + 1.2; avatar.object.position.set(pos.x, 0, pos.z); setCC(false); ui.toast(d.who ? `You are next to @${d.who}.` : 'Joined your party.')
  })
  window.addEventListener('gd-find', (e) => {
    const d = (e as CustomEvent<{ u: string; x: number; z: number }>).detail
    const dx = d.x - pos.x, dz = d.z - pos.z, m = Math.round(Math.hypot(dx, dz))
    const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
    const dir = dirs[((Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) % 8) + 8) % 8]
    setCC(false); ui.toast(m < 3 ? `@${d.u} is right here.` : `@${d.u} is ${m} m ${dir} (gold dot on the minimap).`)
  })
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
    satMap: () => { try {
      if (!satelliteUrl()) { try { bake() } catch { /* vector list only */ } }
      const alias: Record<string, string> = { Plaza: 'The Grind Ring', 'The Plaza': 'The Grind Ring' }
      const pins = GUIDE.flatMap((g) => {
        const want = alias[g.title] ?? g.title
        const h = world.hotspots.find((s) => s.title === want) ?? world.hotspots.find((s) => want.startsWith(s.title) || s.title.startsWith(want))
        return h && Math.abs(h.x) < MAP_LIMIT && Math.abs(h.z) < MAP_LIMIT ? [{ title: g.title, x: h.x, z: h.z }] : []
      })
      return { url: satelliteUrl(), limit: MAP_LIMIT, pins, me: indoors() ? undefined : { x: pos.x, z: pos.z } }
    } catch { return { url: '', limit: MAP_LIMIT, pins: [] } } },
    portrait: (() => { const shot = createPortrait(renderer!, () => avatar.object); return () => shot() })(),
  })
  performance.mark('gd:pre-mentor')
  const mentor = createMentorCard({
    toast: (m) => ui.toast(m),
    onRank: () => world.setRank(rankFor(getSave().xp).label),
    fullLesson: (course) => ui.open('learn', { course }),
    next: () => window.dispatchEvent(new CustomEvent('gd:career', { detail: 'jobs' })),
    // Camera sits on the far side of the player from Zahra, so she and the Campus door are in frame.
    face: () => { camYaw = Math.atan2(pos.x - ada.position.x, pos.z - ada.position.z) },
    toCampus: () => travelHook('Campus', false),
    face3d: (() => { const shot = createPortrait(renderer!, () => ada, { w: 256, h: 256, head: true, headY: 1.5 }); return () => shot() })(),
  })
  // Zahra's welcome tour: once per device, after the first-run intro card closes; Settings can replay it.
  const startTour = (force = false) => {
    if ((!force && tourSeen()) || mentor.isOpen()) return
    let waited = 0
    const tryNow = () => {
      if (ui.isOpen() || document.body.classList.contains('sheet-open') || document.getElementById('login-dlg')) { if ((waited += 1) < 180) window.setTimeout(tryNow, 1000); return }
      mentor.tour()
    }
    tryNow()
  }
  window.addEventListener('gd:tour', () => startTour(true))
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
  document.getElementById('nav-trade')?.addEventListener('click', () => ui.open('trade'))
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
    const alias: Record<string, string> = { Plaza: 'The Grind Ring', 'The Plaza': 'The Grind Ring' }
    const want = alias[title] ?? title
    const spot = world.hotspots.find((h) => h.title === want) ?? world.hotspots.find((h) => want.startsWith(h.title) || h.title.startsWith(want))
    if (!spot) return
    travelTo(spot)
    if (!enter) return
    if (interiors.roomFor(spot.id)) enterRoom(spot)
    else if (spot.action) ui.open(spot.action as Parameters<typeof ui.open>[0])
  }
  // Test hook: ?room=<hotspot id|action> walks you into that room after boot. Only moves the local player.
  const roomParam = new URLSearchParams(location.search).get('room')
  if (roomParam) Object.assign(window, { __roomObstacles: () => ({ obs: interiors.obstacles(), r: PLAYER_R, at: { ...pos } }) }) // read-only, for the walk-path check
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
  // Screenshot (camera button beside the menu): grab the next rendered frame, add a small watermark, share or download.
  // Render and copy the frame inside the tap itself: the drawing buffer is still valid and the share sheet keeps its user activation.
  // Screenshot: capture on pointerdown (render a frame, PNG blob, File) so the click can call navigator.share
  // synchronously with ONLY files (Android targets drop images when text/url ride along). Fallback: download.
  let shotFile: Promise<File | null> | null = null
  // The game's logo goes on every screenshot (the same mark as the HUD), loaded once up front.
  const shotLogo = new Image(); shotLogo.decoding = 'async'; shotLogo.src = '/brand/logo-new.webp'
  const capture = (): Promise<File | null> => {
    try { post.render() } catch { /* use the last frame */ }
    const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height
    const g = out.getContext('2d')!
    g.drawImage(canvas, 0, 0)
    const s = Math.max(1, out.width / 1200)
    if (shotLogo.complete && shotLogo.naturalWidth > 0) {
      // Bottom right, a quarter of the shorter side wide, with a soft shadow so it reads on sky or floor.
      const w = Math.round(Math.min(out.width, out.height) * 0.26), h = Math.round(w * shotLogo.naturalHeight / shotLogo.naturalWidth)
      const m = Math.round(Math.min(out.width, out.height) * 0.035)
      g.save(); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = Math.round(10 * s); g.shadowOffsetY = Math.round(2 * s)
      g.drawImage(shotLogo, out.width - w - m, out.height - h - m, w, h)
      g.restore()
    } else {
      g.font = `600 ${Math.round(18 * s)}px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif`
      const label = 'GRIND DISTRICT', w = g.measureText(label).width
      g.fillStyle = 'rgba(11,10,8,0.55)'; g.beginPath(); g.roundRect(out.width - w - 44 * s, out.height - 52 * s, w + 28 * s, 34 * s, 10 * s); g.fill()
      g.fillStyle = '#d9b26a'; g.fillText(label, out.width - w - 30 * s, out.height - 29 * s)
    }
    return new Promise((ok) => out.toBlob((b) => ok(b ? new File([b], `grind-district-${Date.now()}.png`, { type: 'image/png' }) : null), 'image/png'))
  }
  const shotBtn = document.querySelector<HTMLButtonElement>('#shot')
  shotBtn?.addEventListener('pointerdown', () => { shotFile = capture() })
  shotBtn?.addEventListener('click', () => {
    const pending = shotFile ?? capture()
    shotFile = null
    const download = (f: File) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name
      document.body.append(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10000)
      ui.toast('Screenshot saved to Downloads.')
    }
    void pending.then((file) => {
      if (!file) { ui.toast('This browser blocked the screenshot.'); return }
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file] }).catch((e: Error) => { if (e.name !== 'AbortError') download(file) })
      } else download(file)
    })
  })


  performance.mark('gd:pre-input')
  const input = createInput(canvas, stick, nub)
  // Hidden stubs kept for any legacy callers.
  must('#cam-in').addEventListener('click', () => input.nudgeZoom(-260))
  must('#cam-out').addEventListener('click', () => input.nudgeZoom(260))
  must('#cam-turn').addEventListener('click', () => input.nudgeLook(-150))
  // Compact camera group: sits on body directly under #rail-toggle (☰). Icons only.
  const camDock = document.getElementById('cam-dock')
  const camToggle = document.querySelector<HTMLButtonElement>('#cam-toggle')
  const camPanel = document.querySelector<HTMLElement>('#cam-panel')
  if (camDock) {
    document.body.appendChild(camDock)
    camDock.hidden = false
  }
  const placeCamDock = () => {
    if (!camDock) return
    const menuBtn = document.getElementById('rail-toggle')
    if (!menuBtn) return
    const r = menuBtn.getBoundingClientRect()
    if (r.width < 4) { camDock.style.top = ''; camDock.style.right = ''; return } // not laid out yet: the stylesheet default applies
    camDock.style.top = `${Math.round(r.bottom + 8)}px`
    camDock.style.right = `${Math.round(window.innerWidth - r.right)}px`
    camDock.style.left = 'auto'
  }
  placeCamDock()
  window.addEventListener('resize', placeCamDock)
  // The menu button has no size while the title screen covers the HUD, so the first measure put the dock
  // off-screen for good. Re-place it whenever the button gets its real box.
  { const menuBtn = document.getElementById('rail-toggle'); if (menuBtn && 'ResizeObserver' in window) new ResizeObserver(placeCamDock).observe(menuBtn) }
  camToggle?.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!camPanel || !camToggle) return
    const open = camPanel.hidden
    camPanel.hidden = !open
    camToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
    placeCamDock()
  })
  document.addEventListener('pointerdown', (e) => {
    if (!camPanel || camPanel.hidden || !camDock) return
    if (camDock.contains(e.target as Node)) return
    camPanel.hidden = true
    camToggle?.setAttribute('aria-expanded', 'false')
  })
  document.querySelector('#cam-zoom-in')?.addEventListener('click', () => input.nudgeZoom(-260))
  document.querySelector('#cam-zoom-out')?.addEventListener('click', () => input.nudgeZoom(260))
  document.querySelector('#cam-orbit')?.addEventListener('click', () => input.nudgeLook(-150))
  document.querySelector('#cam-turn-left')?.addEventListener('click', () => input.nudgeLook(150))
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
  if (!localStorage.getItem('gd.welcomed') && !localStorage.getItem('gd.privy.username')) notify('Welcome to Grind District', 'Everyone starts at the bottom of the ladder. Learn on Campus, show up daily, climb toward whale — your CV keeps the proof.', 'welcome', 'place:The Grind Ring')
  localStorage.setItem('gd.welcomed', '1')
  // Good surprise: one soft dawn greeting per local day (streak-aware, no network).
  try {
    const day = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local tz
    if (localStorage.getItem('gd.dawnGreeting') !== day) {
      localStorage.setItem('gd.dawnGreeting', day)
      const streak = Math.max(0, Number(getSave().streak) || 0)
      const line = streak >= 2
        ? `Sunrise over the Plaza · ${streak}-day streak. Keep showing up.`
        : 'Sunrise over the Plaza. The district is waking up with you.'
      window.setTimeout(() => notify('Good morning', line, 'dawn', 'place:The Grind Ring'), 900)
    }
  } catch { /* private mode */ }
  onActivity((kind, label, detail) => {
    if (kind === 'tax') notify('Family request', `${label}. ${detail}`, undefined, 'panel:profile')
    else if (kind === 'skill' && label.startsWith('Passed')) notify('Course complete', `${label}. ${detail}`, undefined, 'panel:profile')
    else if (label === 'Sign-up bonus') notify('Sign-up bonus', detail, undefined, 'balance')
  })
  const careerOpeners: Record<'career' | 'feed', () => void> = { career: () => {}, feed: () => {} }
  initCareer({ toast: (m) => ui.toast(m), rankUp: feedRankUp })
  startNeeds((m) => ui.toast(m))
  startPass((m) => ui.toast(m))
  startCashAlert()
  startReputation()
  // startMoments ticks immediately when a moment is live; interiors is declared further down, so guard the TDZ.
  startMoments(() => { try { return interiors.inside ? { x: 1e4, z: 1e4 } : { x: pos.x, z: pos.z } } catch { return { x: pos.x, z: pos.z } } })
  subscribe((rankedUp) => { if (rankedUp) feedRankUp(rankFor(getSave().xp).label) })
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
    {
      const jobId = getCareer().job
      const jobTitle = jobId ? (JOBS.find((j) => j.id === jobId)?.title ?? '') : ''
      must('#cc-rank').textContent = jobTitle
        ? `${rankFor(getSave().xp).label} · ${jobTitle} · tap for history`
        : `${rankFor(getSave().xp).label} · in-game balance · tap for history`
    }
  }
  nav.inert = true
  const closeSheet = () => { ccSheet.hidden = true; document.body.classList.remove('cc-sheet-on'); sheetBody.replaceChildren() }
  const setCC = (open: boolean) => {
    document.body.classList.toggle('rail-shut', !open)
    nav.inert = !open // keyboard and screen readers skip the shut menu too
    railToggle.setAttribute('aria-expanded', String(open))
    if (open) { paintStatus(); paintNeedsCard(must('#cc-needs')) }
    else closeSheet()
  }
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  const when = (at: number) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  // Deep links from notifications/messages: travel to a place, open a panel, chat or balance.
  const follow = (go?: string) => {
    if (!go) return false
    setCC(false)
    if (go === 'chat') { if (chat.hidden) must<HTMLButtonElement>('#msg-btn').click(); return true }
    if (go === 'messages') { setCC(true); void openInbox(); return true }
    if (go.startsWith('dm:')) { setCC(true); void openThread(go.slice(3)); return true }
    if (go === 'balance') { setCC(true); openBalance(); return true }
    if (go.startsWith('invite:')) { setCC(true); void openFriends(); return true }
    if (go === 'feed' || go === 'career') { setCC(true); careerOpeners[go](); return true }
    if (go.startsWith('place:')) { travelHook(go.slice(6), true); return true }
    if (go.startsWith('panel:')) { ui.open(go.slice(6) as Parameters<typeof ui.open>[0]); return true }
    return false
  }
  setNoteFollow(follow)
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
      if (n.go) btn.append(el('span', n.go === 'chat' ? 'Open chat ›' : n.go.startsWith('dm:') ? 'Open thread ›' : n.go === 'balance' ? 'Open balance ›' : n.go.startsWith('place:') ? `Go to ${n.go.slice(6)} ›` : 'Open ›', 'cc-go'))
      btn.onclick = () => { markRead(n.id); if (!follow(n.go)) renderNotes() }
      li.append(btn)
      list.append(li)
    }
    if (!getNotes().length) list.append(el('li', 'Nothing yet.', 'empty'))
    sheetBody.append(all, list)
  }
  const openBalance = () => openSheet('Balance', () => {
    const save = getSave()
    // The big balance sits in a sticky head so it stays in view while the top-up form grows below it,
    // and it re-reads the ledger every second while the sheet is open (credits land asynchronously).
    // Wallet: a banking-app layout (mint header with the balance and four round actions, a dark Recent card).
    const hero = el('div', '', 'wal-hero')
    const hr = new Date().getHours()
    const greet = el('div', '', 'wal-greet')
    const ini = (save.name || save.username || 'G').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    const who = el('div'); who.append(el('b', `Hi, ${(save.name || save.username || 'there').split(' ')[0]}`), el('small', hr < 12 ? 'Good morning 👋' : hr < 17 ? 'Good afternoon 👋' : 'Good evening 👋'))
    greet.append(el('span', ini, 'wal-avatar'), who)
    let hideBal = false; try { hideBal = localStorage.getItem('gd.wallet.hide') === '1' } catch { /* private mode */ }
    const eye = el('button', '', 'wal-eye'); eye.type = 'button'; eye.setAttribute('aria-label', 'Show or hide balance')
    const label = el('p', '', 'wal-label'); label.append(el('span', 'Available balance'), eye)
    const big = el('p', '', 'cc-big wal-big')
    const paintBig = () => {
      const v = getSave().ledger
      big.dataset.v = v.toFixed(2)
      eye.innerHTML = hideBal ? '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.6 6.6C4.5 8 3 10 2 12c1 2.5 5 7 10 7 1.6 0 3-.4 4.3-1"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
      if (hideBal) { big.replaceChildren('$ ••••••'); return }
      const [w, c] = v.toFixed(2).split('.')
      big.replaceChildren(`$${Number(w).toLocaleString('en-US')}`, el('small', `.${c}`))
    }
    eye.onclick = () => { hideBal = !hideBal; try { localStorage.setItem('gd.wallet.hide', hideBal ? '1' : '0') } catch { /* private mode */ } paintBig() }
    paintBig()
    const idRow = el('div', '', 'wal-id')
    const chips = gameWalletChip()
    if (chips.length) idRow.append(...chips)
    else idRow.append(el('small', `Wallet ID ${save.username ? '@' + save.username : 'guest'}`))
    idRow.append(el('span', 'USD', 'wal-cur'))
    const split = el('p', '', 'cc-split wal-split')
    const paintSplit = () => { const b = balanceSplit(); split.replaceChildren(); for (const [k, v] of [['Earned', b.earned], ['Topped up', b.toppedUp]] as const) { const c = el('span'); c.append(el('small', k), el('b', `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)); split.append(c) } }
    paintSplit()
    const roundActs = el('div', '', 'wal-round')
    hero.append(greet, label, big, idRow, roundActs, split)
    sheetBody.replaceChildren(hero)
    const tick = window.setInterval(() => {
      if (ccSheet.hidden || sheetTitle.textContent !== 'Balance' || !big.isConnected) { clearInterval(tick); return }
      if (big.dataset.v !== getSave().ledger.toFixed(2)) { paintBig(); paintSplit(); paintSpend(); paintAssets(); paintRecent() }
    }, 1000)
    const topBtn = el('button', 'Top up', 'topup-go')
    topBtn.type = 'button'
    const credited = () => { paintStatus(); paintBig(); paintSplit(); paintSpend(); paintAssets(); paintRecent(); spend.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }
    // 'Spend it': after a deposit (or any time there is cash), shortcuts to the premium things in the city.
    const spend = el('div', '', 'cc-spend')
    const go = (fn: () => void) => () => { closeSheet(); setCC(false); fn() }
    const paintSpend = () => {
      const b = balanceSplit()
      spend.replaceChildren()
      paintRanks(b)
      if (b.total < 1) return
      spend.append(el('h3', b.toppedUp > 0 ? 'Spend it' : 'Things to buy'))
      const shop = el('div')
      renderShopRow(shop, [
        { title: 'Runway looks', sub: 'Tuxedos, gowns, couture abayas', price: 'from $340', icon: 'look', tone: 'champagne', go: go(() => ui.open('boutique')) },
        { title: 'Grand tourer', sub: 'Two seats, tan leather', price: '$900', pic: 'tourer', tone: 'graphite', go: go(() => ui.open('dealer')) },
        { title: 'Grind Pass', sub: '20 rewards, $1,000 back', price: '$750', icon: 'pass', tone: 'emerald', go: go(() => window.dispatchEvent(new CustomEvent('gd:career', { detail: 'weekly' }))) },
        { title: 'Light jet', sub: 'Six seats, regional range', price: '$1,200', pic: 'lightjet', tone: 'sky', go: go(() => ui.open('dealer')) },
        { title: 'Pro phone', sub: 'Titanium, triple camera', price: '$90', pic: 'phonepro', tone: 'graphite', go: go(() => ui.open('gadgets')) },
        { title: 'Sky drone', sub: 'Two-seat electric air taxi', price: '$1,650', pic: 'skydrone', tone: 'sky', go: go(() => ui.open('dealer')) },
        { title: 'Makeup kit', sub: 'Lipstick, blush, shadow, liner', price: '$120', icon: 'makeup', tone: 'rose', go: go(() => ui.open('boutique')) },
        { title: 'House upgrade', sub: 'Furnish the next tier', price: 'in-game', icon: 'house', tone: 'walnut', go: go(() => travelHook('Your house', true)) },
        { title: "Members' lounge", sub: 'Rooms open by rank', price: 'by rank', icon: 'lounge', tone: 'walnut', go: go(() => travelHook('Members lounge', true)) },
      ])
      spend.append(shop)
    }
    topBtn.onclick = () => {
      topBtn.disabled = true; topBtn.textContent = 'Opening…'
      // The chunk can 404 if the site was redeployed after this tab loaded: say so and offer a reload instead of failing silently.
      topupModule().then((m) => { topBtn.remove(); m.renderTopup(topSlot, credited) }).catch(() => {
        topBtn.remove()
        const fix = el('button', 'Reload to top up', 'topup-go'); fix.type = 'button'; fix.onclick = () => location.reload()
        topSlot.replaceChildren(el('p', 'The game was updated since you opened it. Reload to load the top-up.', 'cc-muted'), fix)
      })
    }
    const topSlot = el('div')
    // Ranks: every rank comes with its level balance. The next one can be bought with in-game balance once
    // more than $5 has been topped up; ranks are still earned free by learning.
    const paintRanks = (b: ReturnType<typeof balanceSplit>) => {
      const ladder = el('div', '', 'wal-ranks')
      ladder.append(el('h3', 'Ranks'))
      const road = el('div')
      // Same rule as before: the next rank can be bought from the in-game balance once more than $5 is topped up.
      renderRankRoad(road, { toppedUp: b.toppedUp, total: b.total, buy: (i) => {
        const r = RANKS[i]!, price = RANK_START[r.id]
        const paid = spendInGame(price, 'Bought ' + r.label + ' rank', 'Rank purchase with in-game balance.')
        if (!paid.ok) { ui.toast(paid.message); return }
        bonusXp(Math.max(1, r.xp - getSave().xp), 'Reached ' + r.label, 'Rank bought with in-game balance.')
        credited()
      } })
      ladder.append(road)
      spend.append(ladder)
    }
    // Everything held, valued at practice prices.
    const assets = el('div', '', 'wal-assets')
    // Assets, NFTs and Watchlist tabs (walletHoldings.ts).
    const paintAssets = () => renderHoldings(assets, { profile: go(() => ui.open('profile')) })
    paintSpend(); paintAssets()
    // Four round actions on the mint header. Top up presses the existing Top up button (its handler and the
    // top-up flow are unchanged); it opens the form just under the header.
    const ICON: Record<string, string> = {
      top: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>',
      trade: '<svg viewBox="0 0 24 24"><path d="M4 16.5 9.5 11l3.5 3.5L20 7.5M15 7.5h5v5"/></svg>',
      shop: '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8Zm3 0a3 3 0 0 1 6 0"/></svg>',
      more: '<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="6" height="6" rx="1.6"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.6"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.6"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.6"/></svg>',
    }
    const round = (icon: string, text: string, fn: () => void) => {
      const b = el('button', '', 'wal-act'); b.type = 'button'
      const c = el('span', '', 'wal-act-c'); c.innerHTML = ICON[icon]!
      b.append(c, el('small', text)); b.onclick = fn; return b
    }
    roundActs.append(
      round('top', 'Top up', () => { topBtn.click(); window.setTimeout(() => topSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300) }),
      round('trade', 'Trade', go(() => ui.open('trade'))),
      round('shop', 'Shop', go(() => ui.open('boutique'))),
      round('more', 'More', () => spend.scrollIntoView({ behavior: 'smooth', block: 'start' })),
    )
    // Recent: the balance moves, newest first, with the amount on the right.
    const recent = el('div', '', 'wal-recent')
    let showAll = false
    const paintRecent = () => {
      const moves = getSave().activities.filter((a) => a.kind === 'money' || a.kind === 'trade' || a.kind === 'gig' || a.kind === 'tax' || /\$/.test(a.detail + a.label))
      const head = el('div', '', 'wal-recent-head'); head.append(el('b', 'Recent'))
      if (moves.length > 4) { const all = el('button', showAll ? 'Show less' : 'See all', 'wal-see'); all.type = 'button'; all.onclick = () => { showAll = !showAll; paintRecent() }; head.append(all) }
      recent.replaceChildren(head)
      for (const a of showAll ? moves : moves.slice(0, 4)) {
        const m = a.detail.match(/^([+-])?\$([\d,]+(?:\.\d+)?)/) ?? a.label.match(/([+-])\$([\d,]+(?:\.\d+)?)/)
        const sign = m?.[1] ?? (/^(Bought|Paid|Grind Pass ·|Grind Pass tier skip)/.test(a.label) ? '-' : /^(Top-up|Starting|Sign-up)/.test(a.label) ? '+' : '')
        const row = el('div', '', 'wal-tx')
        const ab = a.label.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '$'
        const nm = el('div'); nm.append(el('b', a.label), el('small', when(a.at)))
        row.append(el('span', ab, 'wal-tx-ico'), nm, el('span', m ? `${sign}$${m[2]}` : '', `wal-tx-amt${sign === '+' ? ' in' : sign === '-' ? ' out' : ''}`))
        recent.append(row)
      }
      if (!moves.length) recent.append(el('p', 'No balance moves yet. Pass a course or check in to earn your first dollars.', 'cc-muted'))
    }
    paintRecent()
    sheetBody.append(topSlot, recent, assets, spend)
  })
  must('#cc-sheet-back').addEventListener('click', closeSheet)
  railToggle.addEventListener('click', () => setCC(document.body.classList.contains('rail-shut')))
  nav.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target === nav) { setCC(false); return } // tap outside the modules closes
    // composedPath, not closest: a sheet button that removes itself on click (Top up) is detached by now and would close everything.
    if (event.composedPath().includes(ccSheet) || !target.isConnected) return
    const hit = target.closest('button, a')
    // Buttons that open a sheet inside the control centre (Career, Feed, ...) must not close it: closing runs
    // closeSheet, so the sheet flashed open then vanished. Only close when the tap left no sheet open.
    if (!hit || ['cc-keys', 'cc-bell', 'cc-status', 'cc-msg', 'cc-career', 'cc-feed', 'cc-needs'].includes(hit.id)) return
    window.setTimeout(() => { if (ccSheet.hidden) setCC(false) }, 0)
  })
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || document.body.classList.contains('rail-shut')) return
    if (!ccSheet.hidden) closeSheet(); else setCC(false)
  })
  must('#cc-keys').addEventListener('click', () => { const list = must<HTMLElement>('#cc-keylist'); list.hidden = !list.hidden; must('#cc-keys').classList.toggle('on', !list.hidden) })
  // Messages tab: direct threads (server-side) plus a row into nearby chat.
  must('#cc-msg').addEventListener('click', () => void openInbox())
  mountMessages({
    openSheet,
    body: () => sheetBody,
    openNearby: () => { setCC(false); if (chat.hidden) must<HTMLButtonElement>('#msg-btn').click() },
    isOpen: (title) => !ccSheet.hidden && sheetTitle.textContent === title,
  })
  must('#cc-bell').addEventListener('click', () => openSheet('Notifications', renderNotes))
  const openCareer = (tab?: unknown) => openSheet('Career', () => renderCareer(sheetBody, (to) => { follow(to) }, () => { void publishProfile() }, typeof tab === 'string' ? tab : 'courses'))
  const openFeed = () => openSheet('City Feed', () => renderFeed(sheetBody, (to) => { follow(to) }))
  window.addEventListener('gd:career', (e) => { setCC(true); openCareer((e as CustomEvent).detail) })
  // Career > Lessons: close the control centre first (same order as every other menu item), then open that exact
  // course in the lesson sheet on the next tick, so the menu's own close can never swallow the course sheet.
  window.addEventListener('gd:course', (e) => {
    const course = (e as CustomEvent).detail as SkillId
    setCC(false)
    window.setTimeout(() => ui.open('learn', { course }), 0)
  })
  careerOpeners.career = openCareer; careerOpeners.feed = openFeed
  // Next step: one always-visible line on the HUD so a new player knows what to do now.
  const goal = document.createElement('button')
  goal.type = 'button'; goal.id = 'goal'; goal.className = 'goal-pill'
  const goalText = document.createElement('b'); const goalSub = document.createElement('small')
  const goalKick = document.createElement('span'); goalKick.className = 'goal-kick'; goalKick.textContent = 'Next step'
  goal.append(goalKick, goalText, goalSub)
  document.body.append(goal)
  let goalGo = ''
  const runStep = (go: string) => {
    if (go === 'mentor') {
      if (interiors.inside) leaveRoom()
      if (Math.hypot(pos.x, pos.z + 40.4) < 4) { firstOpened = true; mentor.start(nextMission() ?? 'internet') }
      else { firstOpened = false; travelHook('Campus', false) }
      return
    }
    if (go.startsWith('career:')) { window.dispatchEvent(new CustomEvent('gd:career', { detail: go.slice(7) })); return }
    if (go.startsWith('course:')) { window.dispatchEvent(new CustomEvent('gd:course', { detail: go.slice(7) })); return }
    follow(go)
  }
  // Compact Next step: shows for a few seconds, then folds to a small diamond. Tap the diamond to open it,
  // tap the open pill to go. A new step opens it again briefly.
  let goalTimer = 0, goalArmed = false
  const foldGoal = (ms = 5000) => { window.clearTimeout(goalTimer); goalTimer = window.setTimeout(() => goal.classList.add('folded'), ms) }
  goal.addEventListener('click', () => {
    if (goal.classList.contains('folded')) { goal.classList.remove('folded'); foldGoal(6000); return }
    runStep(goalGo); foldGoal(2500)
  })
  const paintGoal = () => {
    const st = nextStep()
    goalGo = st.go
    let sub = st.sub
    if (st.go === 'mentor' && !interiors.inside) { const d = Math.round(Math.hypot(pos.x, pos.z + 40.4)); if (d > 4) sub = `${d} m away · tap to go` }
    if (goalText.textContent !== st.text) { goal.classList.remove('folded'); goalArmed = false; goalText.textContent = st.text }
    // Fold timer starts only once the pill is actually on screen (not behind the welcome sheet).
    if (!goalArmed && goal.getClientRects().length > 0 && !document.body.classList.contains('sheet-open') && getComputedStyle(goal).visibility !== 'hidden') { goalArmed = true; foldGoal(6000) }
    if (goalSub.textContent !== sub) goalSub.textContent = sub
    goal.setAttribute('aria-label', `Next step: ${st.text}. ${sub}`)
  }
  window.setInterval(() => { try { paintGoal() } catch { /* city still booting: rooms are set up further down */ } }, 1000)
  // Free Will upgrade: residents live their own day; your character keeps earning while you are away.
  crowd.setFreeWill(ownsFreeWill())
  window.addEventListener('gd:freewill', () => crowd.setFreeWill(ownsFreeWill()))
  const awayCheck = () => { const line = settleAway(); if (line) notify('While you were away', line, `away-${Date.now()}`, 'balance') }
  window.setTimeout(awayCheck, 4000)
  window.setInterval(() => { if (document.visibilityState === 'visible') markSeen() }, 30_000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') markSeen(); else awayCheck() })
  window.addEventListener('pagehide', () => markSeen())
  setUpgradeCard(() => {
    const card = el('div', '', 'cr-card fw-card')
    const owned = ownsFreeWill()
    card.append(el('strong', `Free Will${owned ? ' · on' : ` · ${money(FREE_WILL_PRICE)} in-game`}`),
      el('p', 'City people live their own day (work, lunch, prayer, home), have moods and talk to you. Your character keeps working or studying while you are offline (up to 8 h of modest in-game pay).', 'cc-muted'))
    if (!owned) {
      const b = el('button', `Unlock for ${money(FREE_WILL_PRICE)} in-game`, 'cr-btn primary')
      b.onclick = () => { const r = buyFreeWill(); ui.toast(r.ok ? r.message : `${r.message} Earn it in the city or add funds with a top-up.`); if (r.ok) window.dispatchEvent(new CustomEvent('gd:career', { detail: 'overview' })) }
      card.append(b, el('p', 'Paid from your in-game balance. Top up from Balance if you need more.', 'cc-muted'))
    }
    return card
  })
  setStepSource(() => { const st = nextStep(); return { ...st, run: () => runStep(st.go) } })
  must('#cc-career').addEventListener('click', openCareer)
  must('#cc-feed').addEventListener('click', openFeed)
  onCareer(() => { paintStatus(); if (!ccSheet.hidden && sheetTitle.textContent === 'City Feed') renderFeed(sheetBody, (to) => { follow(to) }) })
  must('#cc-status').addEventListener('click', openBalance)
  // Fetch the top-up chunk now (while this build's assets are live) and re-sync credited top-ups for a known wallet.
  void topupModule().then((m) => m.autoSyncTopups(paintStatus)).catch(() => {})
  onNotesChange(() => { if (!ccSheet.hidden && sheetTitle.textContent === 'Notifications') renderNotes() })
  // Camera zoom/turn: external #cam-dock buttons + pinch/scroll (input.ts).
  const dot = railToggle.querySelector('.cc-dot') as HTMLElement
  const bellBadge = must<HTMLElement>('#cc-bell-badge')
  window.setInterval(() => {
    const n = unreadCount()
    const msgUnread = must('#msg-btn').classList.contains('unread')
    dot.hidden = !(n || msgUnread)
    bellBadge.hidden = n === 0
    bellBadge.textContent = n > 9 ? '9+' : String(n)
    must('#cc-msg').classList.toggle('has-unread', msgUnread || dmUnread() > 0)
    if (dmUnread() > 0) dot.hidden = false
  }, 800)
  const msgBtn = must<HTMLButtonElement>('#msg-btn')
  must('#chat-close').addEventListener('click', () => { if (!chat.hidden) msgBtn.click() })
  chat.hidden = true
  msgBtn.addEventListener('click', () => {
    chat.hidden = !chat.hidden
    msgBtn.classList.remove('unread')
    msgBtn.setAttribute('aria-expanded', String(!chat.hidden))
    if (!chat.hidden) chatInput.focus()
    chatIdle()
  })
  // The nearby box never lingers: left alone (not focused, nothing typed) it closes itself.
  let chatTimer = 0
  const chatIdle = () => {
    window.clearTimeout(chatTimer)
    if (chat.hidden) return
    chatTimer = window.setTimeout(() => { if (!chat.hidden && document.activeElement !== chatInput && !chatInput.value.trim()) msgBtn.click(); else chatIdle() }, 9000)
  }
  chatInput.addEventListener('input', chatIdle)
  chatInput.addEventListener('blur', chatIdle)
  const identity = () => {
    const save = getSave()
    return { name: save.name, username: save.username, body: save.body, tint: save.tint }
  }
  const onlineChip = document.createElement('button')
  onlineChip.type = 'button'; onlineChip.id = 'online-chip'; onlineChip.className = 'pill'; onlineChip.hidden = true
  let onlineNow = 1
  // Tap: a small card right under the dot (not a toast), so it never lands on the Next step pill.
  const onlineCard = document.createElement('div'); onlineCard.id = 'online-card'; onlineCard.hidden = true
  let onlineCardTimer = 0
  const closeOnlineCard = () => { onlineCard.hidden = true; document.body.classList.remove('online-open') }
  onlineChip.onclick = async () => {
    if (!onlineCard.hidden) { closeOnlineCard(); return }
    // Public stats: online now (live presence) + registered and active today (/api/track?op=stats).
    const st = await fetch('/api/track?op=stats').then((r) => r.ok ? r.json() : null).catch(() => null) as { registered?: number; activeToday?: number; agentsOnline?: number } | null
    const row = (k: string, v: string | number) => { const d = document.createElement('div'); const a = document.createElement('span'); a.textContent = k; const b = document.createElement('b'); b.textContent = String(v); d.append(a, b); return d }
    onlineCard.replaceChildren(row('Online now', onlineNow), ...(st ? [row('Active today', st.activeToday ?? 0), row('Registered', st.registered ?? 0), ...(st.agentsOnline ? [row('Agents', st.agentsOnline)] : [])] : []))
    onlineCard.hidden = false; document.body.classList.add('online-open')
    window.clearTimeout(onlineCardTimer); onlineCardTimer = window.setTimeout(closeOnlineCard, 5000)
  }
  document.querySelector('#hud header')?.append(onlineChip)
  document.body.append(onlineCard)
  performance.mark('gd:pre-net')
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
    getProfile: () => encodeShare(getSave()),
    onStatus: (online) => {
      chatStatus.textContent = online
        ? 'Live · 12 m'
        : 'Solo city.'
      onlineChip.hidden = !online
    },
    onCount: (n) => {
      onlineNow = n
      onlineChip.textContent = String(n); onlineChip.setAttribute('aria-label', `${n} online`)
      onlineChip.title = n > 1 ? `${n - 1} other player${n > 2 ? 's' : ''} in the city. Real players have a gold ring and a name tag.` : 'Only you right now.'
    },
  })
  void import('./voice.ts').then((m) => m.mountVoice(chat, net, (t) => ui.toast(t), () => {
    if (!interiors.inside) return 'Voice notes are off on the street. Step inside a room to record.'
    if (import.meta.env.VITE_VOICE_NOTES !== '1') return 'Voice notes open soon.'
    return null
  }))
  setPresence({ find: (u) => net.findPeer(u) })
  // Tapped city resident: a small card (name, persona, what they are doing). Auto-hides; never blocks play.
  const showNpcCard = (n: { name: string; trait: string; routine: string; doing: string }) => {
    npcCard?.remove()
    const c = document.createElement('div'); c.id = 'npc-card'; c.setAttribute('role', 'status')
    const h = document.createElement('strong'); h.textContent = `${n.name} · ${n.trait}`
    const d = document.createElement('div'); d.className = 'npc-doing'; d.textContent = n.doing
    const r = document.createElement('div'); r.className = 'npc-routine'; r.textContent = n.routine
    c.append(h, d, r); c.onclick = () => { c.remove(); if (npcCard === c) npcCard = null }
    document.body.append(c)
    npcCard = c
    window.setTimeout(() => { c.remove(); if (npcCard === c) npcCard = null }, 3500)
  }
  // Guests: after the first reward or purchase, offer to save progress to an account (once per session);
  // on leaving with progress, the browser asks to confirm. Signed-in players sync their save every minute.
  {
    const st = await import('./state.ts')
    st.onActivity(() => {
      // Sign-in is offered on the title screen only; never pop it up mid-game.
      if (st.isAccountBound() || sessionStorage.getItem('gd.savePrompted')) return
      sessionStorage.setItem('gd.savePrompted', '1')
    })
    window.addEventListener('beforeunload', (e) => {
      if (st.isAccountBound() || !sessionStorage.getItem('gd.savePrompted')) return
      e.preventDefault(); e.returnValue = ''
    })
    window.setInterval(() => { if (st.isAccountBound() && !document.hidden) void import('./login.ts').then((m) => m.syncProgress()) }, 60_000)
  }
  // Tap another player: their public profile (full-body shot + what they chose to share), then Message.
  let peerTarget: THREE.Object3D | null = null
  performance.mark('gd:pre-peershot')
  const peerShot = createPortrait(renderer, () => peerTarget!)
  let peerBusy = false
  const openPeer = async (p: { id: string; name: string; username: string; object: THREE.Object3D }) => {
    if (peerBusy) return
    // Signed-in players open the full server profile (Message, Add friend, Invite, Go near them).
    if (p.username && p.username !== 'guest' && localStorage.getItem('gd.privy.username')) { setCC(true); void openProfile(p.username); return }
    peerBusy = true
    ui.toast(`Opening ${p.name || 'player'}…`)
    try {
      peerTarget = p.object
      const shot = peerShot()
      const raw = await net.requestProfile(p.id)
      const full = raw ? decodeShare(raw) : null
      const shared = full ?? { n: p.name || 'Player', u: p.username, x: 0, p: 0, s: 0, k: [], a: [] }
      if (full && p.username) shared.u = p.username // the plate everyone sees wins over the payload
      ui.open('shared', { shared, peer: { shot, partial: !full, onMessage: () => { setCC(true); void openThread(shared.u || p.username) } } })
    } finally { peerBusy = false; peerTarget = null }
  }
  chat.addEventListener('submit', (event) => {
    event.preventDefault()
    net.setMe(identity())
    if (chatInput.value.trim()) socialised(5)
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
  must('#cc-needs').addEventListener('click', () => openSheet('Needs & mood', () => renderNeeds(sheetBody, goHome)))
  onNeeds(() => { if (!document.body.classList.contains('rail-shut')) paintNeedsCard(must('#cc-needs')); if (!ccSheet.hidden && sheetBody.querySelector('.nd-mood')) renderNeeds(sheetBody, goHome) })
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
  performance.mark('gd:ui-net')
  const interiors = createInteriors(scene, {
    rankIndex: () => RANKS.findIndex((r) => r.id === rankFor(getSave().xp).id),
    toast: (text) => ui.toast(text),
    openPanel: (panel) => ui.open(panel),
    onLook: () => applyLook(),
    busy: (seconds, x, z, yaw) => {
      // Get up first: an action started from a chair or the bed is done standing.
      if (seating.sitting) seating.stand()
      busyFor = seconds
      pos.x = x
      pos.z = z
      faceYaw = yaw
      avatar.object.rotation.y = yaw
    },
    sit: (s) => sitOn(s),
    openCareer: (tab) => { setCC(true); openCareer(tab) },
    openCerts: () => ui.open('profile'),
  })
  // Sitting: move onto the seat, hold still, pose the rig; any stick, key or tap stands up.
  const seating = createSeating()
  const sitOn = (s: Seat) => {
    seating.sit(s, avatar.object)
    if (!seating.sitting) return
    pos.x = s.x
    pos.z = s.z
    vel.x = 0
    vel.z = 0
    target = null
    faceYaw = s.yaw
  }
  // Zahra at the Campus steps: walk up (or tap her) and she introduces herself, any time.
  const zahraSpot: Hotspot = { id: 'zahra', x: ada.position.x, z: ada.position.z, r: 1.9, title: 'Zahra', body: 'Campus guide · onboarding', enter: 'Talk to Zahra', use: () => mentor.hello() }
  const streetSpots: Hotspot[] = [zahraSpot, ...world.hotspots, ...[...plazaSeats(), ...ambient.benchSeats].map((s, i) => seatSpot(`bench-${i}`, 'Bench', s, sitOn)),
    ...workoutSpots().map((s, i) => ({ ...seatSpot(`workout-${i}`, 'Workout spot', s, sitOn), body: 'Do a few squats. Move to stop.', enter: 'Exercise' }))]
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
  let loopErrors = 0
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
  const liftDir = new THREE.Vector3()
  const headPt = new THREE.Vector3()
  let boomBlocked = false
  let steerAcc = 0
  let steerYaw: number | null = null
  const focus = new THREE.Vector3()
  const mapCtx = map.getContext('2d')

  const resize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    camera.aspect = width / Math.max(1, height)
    camera.fov = width < 800 ? 57 : 50
    camera.updateProjectionMatrix()
    applyGraphics()
  }
  resize()
  window.addEventListener('resize', resize)

  // Backstop for the raycast boom: march from the player to the camera over the building footprints
  // (the same boxes the player collides with) and stop short of the first wall, so a thin or single-sided
  // facade can never let the camera slip inside a building.
  const keepOutOfBuildings = (from: THREE.Vector3, cam: THREE.Vector3) => {
    const dx = cam.x - from.x, dz = cam.z - from.z
    const len = Math.hypot(dx, dz)
    if (len < 0.3) return
    const steps = Math.ceil(len / 0.25)
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const x = from.x + dx * t, z = from.z + dz * t
      for (const o of world.obstacles) {
        if (o.kind !== 'box' || Math.min(o.hx, o.hz) < 1.6) continue
        if (Math.abs(x - o.x) < o.hx + 0.2 && Math.abs(z - o.z) < o.hz + 0.2) {
          const back = Math.max(0, (i - 1) / steps - 0.05)
          cam.x = from.x + dx * back; cam.z = from.z + dz * back
          cam.y = Math.max(cam.y, from.y + 0.6)
          return
        }
      }
    }
  }
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
      // Only solid meshes stop the camera. Rain/dust Points have a 1 m pick radius, so they used to yank the
      // camera in at random (seen in the 8 Nov local repro: hits on Points at ~6 m with open street behind).
      if (!(hit.object as THREE.Mesh).isMesh) continue
      if (isUnder(avatar.object, hit.object)) continue
      const travel = travelBeforeWall(hit.distance)
      if (travel < MIN_BOOM) boomBlocked = true
      if (travel >= MIN_BOOM) return pulledCam.copy(origin).addScaledVector(rayDirection, travel)
      // No room behind the player: rise over the head instead of pushing into it or through the wall.
      // A small sideways offset keeps lookAt from going straight down.
      const flat = Math.max(Math.min(0.2, hit.distance * 0.6), travel * Math.hypot(rayDirection.x, rayDirection.z))
      const up = overHead(origin, rayDirection, flat, interiors.inside ? 2.6 : Infinity)
      liftDir.set(up.x - origin.x, up.y - origin.y, up.z - origin.z)
      const climb = liftDir.length()
      if (climb > 0.05) {
        raycaster.set(origin, liftDir.multiplyScalar(1 / climb))
        raycaster.far = climb
        const blocker = raycaster.intersectObjects(scene.children, true).find((h) => (h.object as THREE.Mesh).isMesh && !h.object.userData.ghost && !isUnder(avatar.object, h.object))
        if (!blocker) return pulledCam.set(up.x, up.y, up.z)
      }
      // Something overhead too: stay in front of the wall (close, but never on the far side of it).
      return pulledCam.copy(origin).addScaledVector(rayDirection, travel)
    }
    return pulledCam.copy(desired)
  }

  // Indoors the camera is not squeezed between walls any more: it keeps its normal boom and any tall wall,
  // partition or cupboard between it and the player is cut away (hidden) for that frame, like a doll's house.
  // Rooms have no ceilings and sit far from the city, so there is nothing else for the camera to hit outside.
  const cutHidden = new Set<THREE.Object3D>()
  const cutNow = new Set<THREE.Object3D>()
  const hips = new THREE.Vector3()
  const restoreCut = () => { for (const o of cutHidden) o.visible = true; cutHidden.clear() }
  const cutAway = (cam: THREE.Vector3) => {
    cutNow.clear()
    for (const target of [lookTarget, hips.set(pos.x, 0.9, pos.z)]) {
      rayDirection.subVectors(target, cam)
      const len = rayDirection.length()
      if (len < 0.05) continue
      raycaster.set(cam, rayDirection.multiplyScalar(1 / len))
      raycaster.far = Math.max(0.05, len - 0.15)
      for (const h of raycaster.intersectObjects(scene.children, true)) {
        const o = h.object as THREE.Mesh
        // Whole instanced sets (benches, books) are never hidden; only single tall pieces: walls, partitions, shelves.
        if (!o.isMesh || (o as unknown as THREE.InstancedMesh).isInstancedMesh || o.userData.ghost || isUnder(avatar.object, o)) continue
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox!
        if ((bb.max.y - bb.min.y) * o.scale.y < 1.2) continue
        cutNow.add(o)
      }
    }
    for (const o of cutHidden) if (!cutNow.has(o)) { o.visible = true; cutHidden.delete(o) }
    for (const o of cutNow) if (!cutHidden.has(o) && o.visible) { o.visible = false; cutHidden.add(o) }
  }

  // Place caption: shows briefly on entering an area, then hides itself (the Enter button stays while in range).
  let captionTimer = 0
  let pillSpot: string | null = null, pillX = 0, pillZ = 0, pillAge = 0
  const showSpot = (next: Hotspot | null) => {
    // While seated: always offer Stand (never leave a gold Sit button up).
    if (seating.sitting) {
      if (activeSpot !== '__seated__') {
        activeSpot = '__seated__'
        spot = null
        clearTimeout(captionTimer)
        caption.hidden = true
        act.hidden = false
        act.textContent = 'Stand'
      }
      return
    }
    const id = next?.id ?? null
    if (id === activeSpot) {
      // Keep label in sync if we stood up into the same hotspot.
      if (next) act.textContent = next.enter ?? 'Enter'
      return
    }
    activeSpot = id
    spot = next
    clearTimeout(captionTimer)
    if (!next) {
      caption.hidden = true
      act.hidden = true
      return
    }
    captionTitle.textContent = next.title
    captionBody.textContent = next.body
    caption.hidden = false
    captionTimer = window.setTimeout(() => { caption.hidden = true }, 4000)
    act.hidden = !(next.action || next.use || next.exit)
    act.textContent = next.enter ?? 'Enter'
  }

  let mapAcc = 1
  // interiors is declared later in main(); a timer can fire before that, so read it defensively.
  const indoors = () => { try { return Boolean(interiors.inside) } catch { return true } }
  const bake = () => !indoors() && bakeSatellite(renderer, scene, 512) // one-off render; 512 keeps rooftops/roads readable when zoomed
  let baked = false
  const tryBake = () => { if (!indoors()) { bake(); baked = true } else setTimeout(tryBake, 5000) }
  setTimeout(tryBake, 4000)
  void baked
  let debugView: [number[], number[]] | null = null
  if (import.meta.env.DEV && location.search.includes('debugmap')) Object.assign(window, { __view: (p?: number[], t?: number[]) => { debugView = p && t ? [p, t] : null; introT = 1 }, __setGraphics: (g: Graphics) => { setGraphics(g); applyGraphics() }, __npcs: () => crowd.debug(), __info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }), __open: (p: string) => ui.open(p as Parameters<typeof ui.open>[0]), __pick: (sx: number, sy: number) => {
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1), camera)
    return rc.intersectObjects(scene.children, true).slice(0, 4).map((h) => { const o = h.object as THREE.Mesh; const chain: string[] = []; for (let n: THREE.Object3D | null = o; n; n = n.parent) chain.push(n.name || n.type)
      const m = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial | undefined
      return { d: +h.distance.toFixed(2), p: h.point.toArray().map((v) => +v.toFixed(2)), geo: o.geometry?.type, params: (o.geometry as unknown as { parameters?: unknown })?.parameters, col: m?.color?.getHexString?.(), chain: chain.join('<') } })
  }, __give: (n: number) => { getSave().ledger += n }, __use: (id: string) => { const u = (interiors.uses() as Array<{ id: string; use?: () => void }>).find((x) => x.id === id); u?.use?.(); return !!u }, __cam: (y: number, pi: number, d: number) => { camYaw = y; camPitch = pi; camDist = d }, __tp: (x: number, z: number) => { pos.x = x; pos.z = z }, __pos: () => ({ x: pos.x, z: pos.z }), __sat: () => { bakeSatellite(renderer, scene, 1024); return satelliteUrl() }, __obs: () => world.obstacles, __mk: () => { const r = avatar.object; const hd = r.getObjectByName("Head"); return { has: typeof r.userData.setMakeup, kids: hd ? hd.children.map((c) => c.type + ":" + c.children.length) : null, female: r.userData.person?.getObjectByName("Female") ? 1 : 0 } }, __shot: (a: number[], t: number[]) => {
    const c = new THREE.PerspectiveCamera(70, 0.6, 0.05, 200); c.position.set(a[0]!, a[1]!, a[2]!); c.lookAt(t[0]!, t[1]!, t[2]!)
    const W = 360, H = 600, rt = new THREE.WebGLRenderTarget(W, H); rt.texture.colorSpace = THREE.SRGBColorSpace
    renderer.setRenderTarget(rt); renderer.render(scene, c); renderer.setRenderTarget(null)
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px)
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d')!; const im = g.createImageData(W, H)
    for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4)
    g.putImageData(im, 0, 0); return cv.toDataURL()
  }, __face: (dy = 0) => {
    const c = new THREE.PerspectiveCamera(20, 1, 0.05, 50)
    const hp = new THREE.Vector3(); (avatar.object.getObjectByName('Head') ?? avatar.object).getWorldPosition(hp)
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(avatar.object.getWorldQuaternion(new THREE.Quaternion()))
    c.position.copy(hp).addScaledVector(fwd, -1.1); c.position.y += 0.05 + dy; c.lookAt(hp.x, hp.y + 0.05, hp.z)
    const rt = new THREE.WebGLRenderTarget(400, 400); rt.texture.colorSpace = THREE.SRGBColorSpace
    renderer.setRenderTarget(rt); renderer.render(scene, c); renderer.setRenderTarget(null)
    const px = new Uint8Array(400 * 400 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 400, 400, px)
    const cv = document.createElement('canvas'); cv.width = cv.height = 400; const g = cv.getContext('2d')!; const im = g.createImageData(400, 400)
    for (let y = 0; y < 400; y++) im.data.set(px.subarray((399 - y) * 1600, (400 - y) * 1600), y * 1600)
    g.putImageData(im, 0, 0); return cv.toDataURL()
  } })
  setInterval(bake, 10 * 60 * 1000) // refreshed rarely
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
    crowdObstacles = crowd.tick(dt, interiors.inside ? undefined : { x: avatar.object.position.x, z: avatar.object.position.z })
    {
      // Greet: appears beside a resident, leaves 1.5 s after you walk off, and steps aside after 6 s even if
      // you linger in a crowd (comes back the next time you walk up to someone).
      const near = !ui.isOpen() && !interiors.inside && crowd.nearest(avatar.object.position.x, avatar.object.position.z, 2.2)
      greetCool = Math.max(0, greetCool - dt)
      if (near && greetCool === 0) { greetAway = 0; greetShown += dt; if (greetShown > 4) { greetShown = 0; greetCool = 20 } }
      else if (!near) { greetAway += dt; if (greetAway > 0.4) greetShown = 0 }
      greetBtn.hidden = !(greetShown > 0 && greetCool === 0) || ui.isOpen()

    }
    agentBot.tick(dt, avatar.object.position)
    if (!interiors.inside && !ui.isOpen()) {
      const d = Math.hypot(avatar.object.position.x - 0.35, avatar.object.position.z - 0.32)
      if (d < 3.8 && elapsed - serverSpoke > 60) { serverSpoke = elapsed; speak(SERVER_LINES[Math.floor(elapsed) % SERVER_LINES.length]!, { gender: 'm', seed: 7 }) }
    }
  apiAgents.tick(dt)
    crowdObstacles.push(...traffic.tick(dt, elapsed, pos, crowdObstacles))
    // Reduced motion holds the sky still at the chosen GN time.
    // The city is mostly in daylight: the clock runs slowly while the sun is up, briskly through dusk and dawn,
    // and quickly through the night (about 8 minutes of day to 2 of night).
    if (!calmSky() && !clockHeld()) { const up = Math.sin((dayPhase - 0.25) * Math.PI * 2); dayPhase = (dayPhase + (dt / DAY_SECONDS) * (up > 0.12 ? 0.55 : up < -0.12 ? 2.6 : 1.3)) % 1 }
    lightAcc += dt
    if (lightAcc > 0.25) {
      lightAcc = 0
      world.setDaylight(dayPhase)
      hemiBase = world.hemi.intensity
      physSky.setPhase(dayPhase, focus)
      const sunUp = Math.sin((dayPhase - 0.25) * Math.PI * 2)
      nightLevel = 1 - THREE.MathUtils.smoothstep(sunUp, -0.12, 0.3)
      // Night bloom (soft halos on lamps and signs) comes in as the sun goes down: with the low sun still in
      // the sky it flooded the whole screen at dusk.
      post.setNight(1 - THREE.MathUtils.smoothstep(sunUp, -0.12, 0.04))
      // Ease everything with the same curve: env map and exposure fall away after dusk.
      scene.environmentIntensity = 0.5 * (1 - nightLevel) + 0.07 * nightLevel
      // Night: let the street lamps do the lighting (deeper blue between the warm pools).
      warmAmbient.intensity = 0.3 * (1 - nightLevel) + 0.035 * nightLevel
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.95, 0.86, nightLevel) // AgX: slightly lower day exposure (Zahra: too bright)
      physSky.sky.visible = nightLevel < 0.85
  phoneFill.intensity = phoneFill.visible ? 0.15 * (1 - nightLevel) + 0.06 : 0
    }
    world.tick(elapsed, focus.set(pos.x, 0, pos.z))
    watch.tick(elapsed, focus, nightLevel)
    skyline.tick(elapsed, nightLevel)
    beach.tick(dt)
    ambient.tick(elapsed, focus, nightLevel)
    if (!interiors.inside) ui.setPlace(districtName(pos.x, pos.z))
    try { setAmbientPlace(Boolean(interiors.inside), Math.hypot(pos.x, pos.z)) } catch { /* */ }

    const frame = input.read()
    const paused = ui.isOpen() || mentor.isOpen()
    if (frame.lookX !== 0 || frame.lookY !== 0) lookIdle = 0
    else lookIdle += dt
    camYaw -= frame.lookX * 0.0052
    camPitch = THREE.MathUtils.clamp(camPitch - frame.lookY * 0.0036, 0.18, 1.05)
    camDist = THREE.MathUtils.clamp(camDist + frame.zoom * 0.012, 3.2, 12)

    exitCooldown = Math.max(0, exitCooldown - dt)
    busyFor = Math.max(0, busyFor - dt)
    if (!paused && frame.interact) {
      if (seating.sitting) { seating.stand() }
      else if (spot) {
      if (spot.exit) leaveRoom()
      else if (spot.use) spot.use()
      else if (!enterRoom(spot) && spot.action) ui.open(spot.action, spot.house ? { house: spot.house } : undefined)
      }
    }

    if (!paused && frame.tap) {
      pointer.set(frame.tap.nx, frame.tap.ny)
      raycaster.setFromCamera(pointer, camera)
      // A person only counts if they stand in front of where the tap meets the ground (plus a body's depth).
      const groundHit = raycaster.ray.intersectPlane(floor, tapPoint) !== null
      const reach = groundHit ? tapPoint.distanceTo(raycaster.ray.origin) + 0.9 : Infinity
      const tapped = interiors.inside ? null : net.pick(raycaster, reach)
      const npc = !tapped && !interiors.inside ? crowd.pick(raycaster, reach) : null
      const zahraHit = !tapped && !interiors.inside && Math.hypot(pos.x - ada.position.x, pos.z - ada.position.z) < 30 && raycaster.intersectObject(ada, true).some((h) => h.distance < reach)
      if (zahraHit) { if (!mentor.isOpen() && !ui.isOpen()) mentor.hello() }
      else if (tapped) void openPeer(tapped)
      else if (npc) showNpcCard(npc)
      else if (groundHit) {
        target = tapPoint.clone()
        const room = interiors.bounds()
        if (room) {
          target.x = THREE.MathUtils.clamp(target.x, room.x - room.hw, room.x + room.hw)
          target.z = THREE.MathUtils.clamp(target.z, room.z - room.hd, room.z + room.hd)
        } else {
          target.x = THREE.MathUtils.clamp(target.x, -CITY_LIMIT + 1, CITY_LIMIT - 1)
          target.z = THREE.MathUtils.clamp(target.z, -CITY_LIMIT + 1, CITY_LIMIT - 1)
        }
        // A tap on furniture or water would park the walk target inside a blocker, where the player
        // slides, stalls and gives up. Nudge the target out to the nearest free spot (e.g. the pool rim).
        const inRoom = interiors.inside ? interiors.obstacles() : world.obstacles
        resolveCollision(target, { x: 0, z: 0 }, inRoom, PLAYER_R + 0.05, Boolean(interiors.inside))
        stuck = 0
        prevDist = Infinity
      }
    }

    const forwardX = -Math.sin(camYaw)
    const forwardZ = -Math.cos(camYaw)
    const rightX = Math.cos(camYaw)
    const rightZ = -Math.sin(camYaw)
    const directed = !paused && Math.hypot(frame.x, frame.y) > 0.06
    // A person's card goes as soon as you walk on.
    if (npcCard && directed) { npcCard.remove(); npcCard = null }
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
    // Walking to a tapped spot is always a walk; only the joystick and keys run.
    const tapWalk = !directed && target !== null
    const running = !tapWalk && (frame.run || frame.stick > 0.88)
    sprinting = running && mag > 0.2
    const speed = tapWalk ? TAP_WALK * mag : (running ? RUN : WALK) * mag
    // Accelerate briskly, brake harder, and settle to an exact stop so the body never drifts.
    const rate = 1 - Math.exp(-(speed > 0.01 ? 10 : 16) * dt)
    vel.x += (dirX * speed - vel.x) * rate
    vel.z += (dirZ * speed - vel.z) * rate
    if (speed < 0.01 && Math.hypot(vel.x, vel.z) < 0.08) {
      vel.x = 0
      vel.z = 0
    }
    if (seating.sitting && (directed || target)) seating.stand()
    if (paused || busyFor > 0 || seating.sitting) {
      vel.x = 0
      vel.z = 0
    }
    blockers.length = 0
    if (interiors.inside) blockers.push(...interiors.obstacles())
    else blockers.push(...world.obstacles, ...crowdObstacles)
    // Sub-step so a fast frame on a slow phone can never tunnel through a wall; boxes slide.
    const steps = Math.max(1, Math.ceil((Math.hypot(vel.x, vel.z) * dt) / 0.2))
    for (let i = 0; i < steps && !seating.sitting; i += 1) {
      pos.x += (vel.x * dt) / steps
      pos.z += (vel.z * dt) / steps
      resolveCollision(pos, vel, blockers, PLAYER_R, Boolean(interiors.inside))
    }
    {
      // Indoors: never leave the room shell, whatever pushed the player (seats, busy moves, fast taps).
      const room = interiors.bounds()
      if (room) {
        pos.x = THREE.MathUtils.clamp(pos.x, room.x - room.hw, room.x + room.hw)
        pos.z = THREE.MathUtils.clamp(pos.z, room.z - room.hd, room.z + room.hd)
      }
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
    seating.apply(avatar.object, dt)
    if (firstMarker.parent) {
      // Slow spin + tiny bob so it reads as a Campus waypoint, not a clipping toy.
      firstMarker.children[0]!.position.y = Math.sin(performance.now() / 900) * 0.08
      if (!needsFirstCourse()) scene.remove(firstMarker)
      else if (!interiors.inside) {
        const near = Math.hypot(pos.x, pos.z + 40.4) < 3.2 || Math.hypot(pos.x - ada.position.x, pos.z - ada.position.z) < 2.4
        if (near && !firstOpened && !ui.isOpen()) { firstOpened = true; mentor.start(nextMission() ?? 'internet') }
        else if (!near && Math.hypot(pos.x, pos.z + 40.4) > 6) firstOpened = false
      }
    }
    tickTvs(dt, pos.x, pos.z, camera)
    tickWater(dt, camera)
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
    let bestScore = Infinity
    const candidates: Hotspot[] = interiors.inside ? (interiors.uses() as Hotspot[]) : streetSpots
    for (const candidate of candidates) {
      const dist = Math.hypot(pos.x - candidate.x, pos.z - candidate.z)
      // Walking through a door enters or leaves the 3D room.
      if (!paused && exitCooldown === 0 && dist < 0.75) {
        if (candidate.exit) { leaveRoom(); break }
        if (!interiors.inside && interiors.roomFor(candidate.id) && enterRoom(candidate)) break
      }
      if (dist < candidate.r) {
        // Prefer Enter/Open actions over nearby Sit chairs (Campus desks were stealing the button).
        const sitOnly = !!candidate.use && !candidate.action && !candidate.exit && (candidate.enter === 'Sit' || candidate.enter === 'Exercise')
        const score = dist + (sitOnly ? 0.7 : 0)
        if (score < bestScore) { best = candidate; bestScore = score }
      }
    }
    showSpot(best)
    // An action button nobody used fades after a few seconds of standing still; it is back the moment the
    // player moves or reaches something else.
    if (activeSpot) {
      if (activeSpot !== pillSpot || Math.hypot(pos.x - pillX, pos.z - pillZ) > 0.3) { pillSpot = activeSpot; pillX = pos.x; pillZ = pos.z; pillAge = 0; act.classList.remove('faded') }
      else if ((pillAge += dt) > 7) act.classList.add('faded')
    } else if (pillSpot) { pillSpot = null; act.classList.remove('faded') }

    if (!taxLatch && elapsed > 18 && !ui.isOpen() && getSave().taxOpen && Math.hypot(pos.x, pos.z) < 14) {
      taxLatch = true
      ui.open('tax')
    }

    // After a longer pause without manual look, ease the camera behind the walking direction (phones: less auto-swing).
    const coarseCam = matchMedia('(pointer: coarse)').matches
    if (lookIdle > (coarseCam ? 2.8 : 1.6) && directed === false && Math.hypot(vel.x, vel.z) > 1 && !paused) {
      const behind = Math.atan2(-vel.x, -vel.z)
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-(coarseCam ? 0.55 : 1.2) * dt))
    }
    // Idle face-swing: desktop only. On phones it felt like the view “auto-adjusting” on its own.
    if (!coarseCam && stillFor > 2.5 && lookIdle > 2.5 && !paused && !interiors.inside) {
      const front = faceYaw + 0.45
      const delta = Math.atan2(Math.sin(front - camYaw), Math.cos(front - camYaw))
      camYaw += delta * (1 - Math.exp(-0.55 * dt))
    }
    if (!cameraReady) lookSmooth.set(pos.x, 1.15, pos.z)
    // Over-the-shoulder: frame the player slightly left of centre, GTA style.
    shoulder.set(Math.cos(camYaw), 0, -Math.sin(camYaw)).multiplyScalar(0.55 * Math.min(1, 6 / camDist))
    lookSmooth.lerp(lookTarget.set(pos.x + shoulder.x, 1.45, pos.z + shoulder.z), 1 - Math.exp(-12 * dt))
    lookTarget.copy(lookSmooth)
    const indoors = Boolean(interiors.inside)
    if (!indoors && cutHidden.size) restoreCut()
    const useDist = indoors ? Math.min(camDist, 4.6) : camDist // walls between camera and player are cut away indoors
    const horiz = useDist * Math.cos(camPitch)
    desiredCam.set(pos.x + Math.sin(camYaw) * horiz, 1.15 + useDist * Math.sin(camPitch), pos.z + Math.cos(camYaw) * horiz)
    // The over-the-shoulder offset must not put the look point inside a wall (player hugging a building).
    headPt.set(pos.x, 1.45, pos.z)
    rayDirection.subVectors(lookTarget, headPt)
    const offLen = rayDirection.length()
    if (offLen > 0.05) {
      raycaster.set(headPt, rayDirection.multiplyScalar(1 / offLen))
      raycaster.far = offLen + 0.3
      if (raycaster.intersectObjects(scene.children, true).some((h) => (h.object as THREE.Mesh).isMesh && !h.object.userData.ghost && !isUnder(avatar.object, h.object))) lookTarget.copy(headPt)
    }
    boomBlocked = false
    const ideal = indoors ? desiredCam : pullCamera(lookTarget, desiredCam)
    // Outdoors, backed against a building: turn the view toward the open side (8 flat probes, 4x a second),
    // unless the player is dragging the camera. Indoors, walls are cut away instead.
    steerAcc += dt
    if (!interiors.inside && boomBlocked && lookIdle > 0.4 && steerAcc > 0.25) {
      steerAcc = 0
      const reach = Math.min(6, useDist * Math.cos(camPitch))
      let bestRoom = 0
      steerYaw = null
      for (let k = 0; k < 8; k++) {
        const a = camYaw + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4)
        liftDir.set(Math.sin(a), 0, Math.cos(a))
        raycaster.set(headPt, liftDir)
        raycaster.far = reach
        const h = raycaster.intersectObjects(scene.children, true).find((x) => (x.object as THREE.Mesh).isMesh && !x.object.userData.ghost && !isUnder(avatar.object, x.object))
        const room = h ? h.distance : reach
        if (room > bestRoom + 0.3) { bestRoom = room; steerYaw = a }
      }
      if (bestRoom < 2) steerYaw = null
    }
    if (!boomBlocked && steerAcc > 1) steerYaw = null
    if (steerYaw !== null && lookIdle > 0.7 && !interiors.inside) {
      const delta = Math.atan2(Math.sin(steerYaw - camYaw), Math.cos(steerYaw - camYaw))
      camYaw += delta * (1 - Math.exp(-1.6 * dt))
    }
    if (!cameraReady) {
      smoothCam.copy(ideal)
      cameraReady = true
    } else {
      // Critically damped spring toward the ideal spot; the collision pull below snaps in instantly.
      const k = 38
      camVel.addScaledVector(pulledCam.copy(ideal).sub(smoothCam), k * dt).multiplyScalar(Math.exp(-2 * Math.sqrt(k) * dt))
      smoothCam.addScaledVector(camVel, dt)
    }
    const safe = indoors ? pulledCam.copy(smoothCam) : pullCamera(lookTarget, smoothCam)
    if (safe.y < 0.4) safe.y = 0.4
    if (!indoors) keepOutOfBuildings(lookTarget, safe)
    if (indoors) cutAway(safe)
    camera.position.copy(safe)
    { // Very subtle walk sway (off with reduced motion).
      const sp = Math.hypot(vel.x, vel.z)
      if (!calmSky() && sp > 0.3) bob += dt * (sprinting ? 11 : 7.5)
      const amp = calmSky() ? 0 : Math.min(1, sp / 4) * 0.018
      camera.position.y += Math.sin(bob * 2) * amp
      camera.position.x += Math.cos(bob) * amp * 0.5
    }
    { const pulse = weather.tick(dt, camera, !interiors.inside, calmSky())
      world.hemi.intensity = hemiBase * (1 - 0.18 * weather.rain()) + pulse * 0.9
      post.setFocus(camera.position.distanceTo(lookTarget)) }
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
    if (debugView) { camera.position.fromArray(debugView[0]); camera.lookAt(debugView[1][0], debugView[1][1], debugView[1][2]) }
    camera.updateMatrixWorld()
    setMixerViewer(camera)
    const baseFov = (window.innerWidth < 800 ? 57 : 50) + (new URLSearchParams(location.search).has('widefov') ? 6 : 0)
    const fov = baseFov + (sprinting ? 4 : 0)
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-6 * dt))
      camera.updateProjectionMatrix()
    }
    net.tick(dt, { x: pos.x, z: pos.z, yaw: 0, moving, act: seating.sitting })
    mapAcc += dt
    if (mapAcc > 0.1) { mapAcc = 0; drawMap() } // minimap at 10 Hz is plenty
    saveAcc += dt
    if (saveAcc > 2) {
      saveAcc = 0
      rememberPlace(pos.x, pos.z)
    }
  }

  performance.mark('gd:interiors-loop')
  await withTimeout(renderer.compileAsync(scene, camera).then(() => undefined), 4000, () => undefined, 'Shader warm-up')
  performance.mark('gd:shaders')
  // While the full-screen menu is open the city holds still: no movement, no camera drift, no redraw.
  // The blurred backdrop keeps showing the last frame, so nothing behind the menu can shake or zoom,
  // and phones stop paying for a full 3D frame plus the blur on every tick. Dragging a zoom/look
  // slider (cc-peek) draws live again so the change is visible.
  let holdRedraw = 0
  window.addEventListener('resize', () => { holdRedraw = 2 })
  const menuHold = () => {
    const cls = document.body.classList
    return !cls.contains('rail-shut') && !cls.contains('cc-peek')
  }
  let last = performance.now()
  const frame = (now: number) => {
    if (abandoned) return
    requestAnimationFrame(frame)
    if (failed) return
    // Clamp to 50 ms: a GC/compile hitch must not teleport the player or kick the camera spring.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    if (document.hidden && revealed) return
    if (revealed && menuHold()) {
      if (holdRedraw <= 0) return
      holdRedraw -= 1
      try { post.render() } catch { /* keep the last frame */ }
      return
    }
    // A panel (Trade, Boutique, Profile...) covers most of the screen: the city keeps its last frame and the
    // phone's whole budget goes to the panel, so taps and scrolling answer at once. Prices keep moving.
    if (revealed && document.body.classList.contains('sheet-open')) {
      tickMarket(dt, Date.now())
      if (holdRedraw > 0) { holdRedraw -= 1; try { post.render() } catch { /* keep the last frame */ } }
      return
    }
    elapsed += dt
    if (revealed) tickNeeds(dt)
    try {
      update(dt)
      if (!revealed) performance.mark('gd:first-update')
      post.frame(dt, elapsed)
      post.render()
      if (snapNext) { snapNext = false; shotBtn?.click() }
      if (revealed) probe(dt)
      if (!revealed) {
        revealed = true
        performance.mark('gd:revealed')
        window.dispatchEvent(new Event('gd:revealed'))
        onReveal()
        boot.classList.add('hidden')
        boot.setAttribute('aria-hidden', 'true')
        const matched = location.hash.match(/^#profile=([A-Za-z0-9_-]+)/)
        if (matched?.[1]) {
          const shared = decodeShare(matched[1])
          history.replaceState(null, '', `${location.pathname}${location.search}`)
          if (shared) ui.open('shared', { shared })
          else if (!getSave().seenIntro && !localStorage.getItem('gd.introSeen')) ui.open('intro')
        } else if (!getSave().seenIntro && !localStorage.getItem('gd.introSeen') && !localStorage.getItem('gd.privy.username')) {
          ui.open('intro')
        }
        if (!tourSeen() && !new URLSearchParams(location.search).has('debugmap')) window.setTimeout(() => startTour(), 2500)
        // Birthday and holiday greetings (each once a day), after the city has settled.
        window.setTimeout(() => void Promise.all([import('./calendar.ts'), import('./notify.ts')]).then(([c, n]) => c.celebrateToday((m) => ui.toast(m), (title, body, key) => n.notify(title, body, key))), tourSeen() ? 5000 : 60000)
      }
    } catch (error) {
      console.error('[grind] Render loop error.', error)
      if (!revealed) {
        failed = true
        onFail(error)
        return
      }
      // In game: never dim the screen for a glitch (e.g. a chunk from an older deploy). Keep running;
      // only after many consecutive failures stop and offer a quiet refresh toast.
      loopErrors++
      if (loopErrors < 90) return
      failed = true
      void import('./update.ts').then((m) => m.offerRefresh()).catch(() => undefined)
      return
    }
  }
  requestAnimationFrame(frame)
}
