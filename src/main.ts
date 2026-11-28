import { FAR } from './regionMap.ts'
import { nextMission } from './worlds.ts'
import { step as journeyStep } from './journey.ts'
import { createDriveUi, nearestRoad, planRoute } from './drive.ts'
import { talkGestures, sayLine } from './gestures.ts'
import { createGarden } from './cityGrowth.ts'
import { RANKS, RANK_START, SKILL_ORDER, SKILL_META } from './logic.ts'
import { gameWalletChip } from './privyWallet.ts'
import { nearWalletChip } from './nearWallet.ts'
import { openFriends } from './messages.ts'
import * as THREE from 'three'
import { MIN_BOOM, overHead, travelBeforeWall } from './cameraBoom.ts'
import { resumeMusicOnFirstTap } from './music.ts'
import { speak } from './speech.ts'
import { setAmbientPlace, setAmbientEnv, ensureAmbientOnGesture } from './ambient-audio.ts'
import { createWeather } from './weather.ts'
import { createSeasons } from './seasons.ts'
import { canGraduate, graduatedOn } from './diploma.ts'
import { foliageMaterial as seasonFoliage } from './trees.ts'
import { setMixerViewer, posedHuman, releaseHuman, type HumanModel, type Look } from './humans.ts'
import { createMentorCard, tourSeen } from './mentor.ts'
import { nextStep } from './objective.ts'
import { FREE_WILL_PRICE, buyFreeWill, ownsFreeWill, settleAway, markSeen } from './freeWill.ts'
import { createAvatar, type Avatar } from './avatars.ts'
import { loadSkinPermissions } from './skins.ts'
import { NFT_COLLECTIONS_ENABLED } from './nft.ts'
import { createAgentCompanion, createRemoteAgents } from './agent.ts'
import { MAP_LIMIT, satelliteCanvas } from './minimap.ts'
import { publishProfile, setCharacterSource } from './share.ts'
import { startPrayerReminders } from './prayer.ts'
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
import { HOUSES } from './houses.ts'
import { createNet } from './net.ts'
import { encodeShare, VEHICLES } from './logic.ts'
import type { Ride, RideOpts } from './ride.ts'
import type { Homes, AreaId } from './homes.ts'
import type { Metro, StationId } from './metro.ts'
import { setHomeInView, type HomeId, type StyleId } from './homesShop.ts'
import { dmUnread, mountMessages, openInbox, openThread, openProfile, playerPic, setPortraitMaker, setPresence } from './messages.ts'
import { createTraffic } from './traffic.ts'
import { applyEnvironment, createPost, createProbe } from './quality.ts'
import { createWatch } from './watch.ts'
import { createSkyline } from './skyline.ts'
import { setShopRenderer } from './itemPics.ts'
import { setLookRenderer } from './lookShots.ts'
import { createStreetProps } from './props.ts'
import { createStreetscape } from './streetscape.ts'
import { applyPrefs } from './prefs.ts'
import { createCrowd, label as nameLabel, type CrowdInfo } from './npcs.ts'
import { CITIZENS } from './citizens.ts'
import { blocked, CITY_LIMIT, PLAYER_R, resolveCollision, type Obstacle } from './physics.ts'
import { autoPerformance, integratedGpu, liteOn, noteGpu, noteStruggling, setLiteNow } from './deviceTier.ts'
import { onActivity, subscribe, setTime, getSave, balanceSplit, loadSave, rememberPlace, rememberHome, setGraphics, tickMarket, spendInGame, bonusXp, isAccountBound } from './state.ts'
import { mountUi } from './ui.ts'
import { claimDaily, loginState } from './luxury.ts'
import { createWorld, districtName, type Hotspot } from './world.ts'
import { createInteriors, STREET } from './interiors.ts'
import { createMarket } from './market.ts'
import { createMcGrindAds } from './mcgrindAds.ts'
import { createAmbient } from './ambient.ts'
import { PLAZA_BENCH_LEN, STREET_BENCH_LEN, benchSlots, pickBenchSlot, createSeating, kioskSeats, plazaSeats, seatSpot, workoutSpots, type Seat } from './seating.ts'
import { tickTvs } from './tv.ts'
import { tickWater } from './water.ts'
import { createPhysicalSky } from './sky.ts'
import { startNeeds, tickNeeds, socialised, adjust as adjustNeeds, paintNeedsCard, renderNeeds, onNeeds } from './needs.ts'
import { startPass } from './pass.ts'
import { startCashAlert } from './sfx.ts'
import { startReputation } from './rep.ts'
import { renderHoldings } from './walletHoldings.ts'
import { renderRankRoad, renderShopRow } from './walletRanks.ts'
import { createEstate } from './estate.ts'
import { createBeach } from './beach.ts'
import './style.css'
import './glass.css'
import { createCamRays } from './camRays.ts'
import { sweepScene } from './batch.ts'
import { createPortrait } from './portrait.ts'
import { watchUpdates } from './update.ts'
import { installLayers } from './layers.ts'
import { isPublicStats, statsCard, statsCaption, type PublicStats } from './statsPanel.ts'
import { startPersona, note as personaNote, notePlace, notePanel } from './persona.ts'
import { initStaff } from './staff.ts'
import { createPassCard } from './passCard.ts'
watchUpdates()

// Faster to get around (owner request, 8 Nov): walk 2.7 -> 3.0, run 5.5 -> 7.2 m/s. Both stay inside the
// range the walk/run clips can match without feet sliding (walk clip up to ~3.0 m/s, run clip up to ~7.3 m/s).
const WALK = 3.0
const RUN = 7.2
// Tap the ground and you go there at a light jog (2.4 m/s): a stroll at 1.65 m/s read as slow on screen.
// The joystick and keys still walk, jog and run by how far they are pushed.
const TAP_WALK = 2.4

let snapNext = false
let topupChunk: Promise<typeof import('./topup.ts')> | null = null
const topupModule = () => (topupChunk ??= import('./topup.ts').catch((e: unknown) => { topupChunk = null; throw e }))
// Top-up chunk loads only when the balance / top-up UI opens (keeps opening card off the critical path).

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

/** Things the camera boom ignores: people (they walk by) and leaf cards (see-through foliage). */
function passesCamera(obj: THREE.Object3D): boolean {
  const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
  if (mat && !Array.isArray(mat) && mat.userData?.foliage) return true
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (o.userData.camPass) return true
  return false
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
    // Lite (low-end phones, deviceTier.ts): no MSAA, the single biggest per-pixel saving after resolution.
    ...(liteOn() ? [{ antialias: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false, alpha: false } as WebGLContextAttributes] : []),
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
  // Count the opened invite link for the friend who shared it, and give an invited player their welcome gift.
  void import('./referrals.ts').then((m) => { m.recordInviteOpen(); window.addEventListener('gd:revealed', () => window.setTimeout(() => void m.checkInviteGift((t) => ui.toast(t)), 5000), { once: true }) })
  performance.mark('gd:city-start')
  const renderer = createRenderer(canvas)
  if (!renderer) {
    await startFlat(onReveal)
    return
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // A known low-end phone GPU switches this visit to Lite (and the next one starts without MSAA).
  if (noteGpu(renderer.getContext())) setLiteNow(true)
  // Neutral tone mapping keeps colours true and crisp (AgX washed them to pastels and read as too bright).
  try { renderer.toneMapping = THREE.NeutralToneMapping } catch { renderer.toneMapping = THREE.ACESFilmicToneMapping }
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
    personaNote('greet')
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
    // The resident you greeted answers, in their own voice: a man's voice for a man, a woman's for a woman.
    const who = crowd.nearestPerson(avatar.object.position.x, avatar.object.position.z, 3)
    // One toast: the reply and the Social gain together (a second toast used to cover the reply at once).
    const gain = adjustNeeds({ social: 10 }, 'quiet')
    const said = who ? `${who.name}: ${line}` : line
    greetToast(gain ? `${said} · ${gain}` : said)
    speak(line, who ? { gender: who.gender, seed: who.seed } : { gender: getSave().body === 'zuri' ? 'f' : 'm', seed: 1 })
    // You say hello (your mouth moves), then they answer face to face.
    avatar.object.userData.talkUntil = performance.now() + 900
    who?.say(line)
    greetShown = 0; greetCool = 20; greetBtn.hidden = true
  })
  let greetToast: (m: string) => void = () => {}
  let greetShown = 0
  let greetAway = 99
  let greetCool = 0
  let serverSpoke = -99
  const SERVER_LINES = ['Welcome to Grind Ring. Coffee, juice or tea?', 'Morning! The mint tea is fresh.', 'Good to see you. What can I get you?', 'Cold brew is on special today.']
  let npcCard: HTMLElement | null = null
  // Passing cards (passCard.ts): who the person beside you is, as you walk past.
  const passCard = createPassCard()
  let passT = 0
  const agentBot = createAgentCompanion(scene)
const apiAgents = createRemoteAgents(scene)
  performance.mark('gd:crowd-agents')
  const physSky = createPhysicalSky(scene)
  createEstate(scene, { graphics: getSave().graphics, obstacles: world.obstacles, hotspots: world.hotspots, toast: (m) => ui.toast(m) })
  // The Graduation Garden at Campus grows a banner at each city-wide milestone of courses passed (see cityGrowth.ts).
  const garden = createGarden(scene, { graphics: getSave().graphics, obstacles: world.obstacles, hotspots: world.hotspots, toast: (m) => ui.toast(m) })
  const beach = createBeach(scene, getSave().graphics)
  const ambient = createAmbient(scene, world.obstacles, window.matchMedia('(pointer: coarse)').matches)
  const watch = createWatch(scene, getSave().graphics === 'low' ? 1 : 3)
  let nightLevel = 0
  const earDir = new THREE.Vector3()
  const skyline = createSkyline(scene, getSave().graphics)
  // Residents walk fixed waypoint lines with no runtime obstacle avoidance (citizens.ts), so keep
  // instanced street furniture off those lines at generation time instead (e.g. the bench-clipping report near Influencer row).
  const citizenWalkLines = CITIZENS.flatMap((c) => c.points.length < 2 ? [] : c.points.map((p, i) => {
    const next = c.points[(i + 1) % c.points.length]!
    return { x1: p.x, z1: p.z, x2: next.x, z2: next.z }
  }))
  createStreetProps(scene, { lamps: world.lampSpots, trees: world.treeSpots, obstacles: world.obstacles, graphics: getSave().graphics, walkLines: citizenWalkLines })
  createStreetscape(scene, { obstacles: world.obstacles, graphics: getSave().graphics })
  // McGrind's ads round the city: billboards, bus shelters, A-frames and wall posters (two draw calls in all).
  const flyerSpots = createMcGrindAds(scene, { obstacles: world.obstacles, graphics: getSave().graphics })
  performance.mark('gd:estate-beach-skyline-street')
  const traffic = createTraffic(scene, world.lanes, getSave().graphics)
  const weather = createWeather(scene, world.groundMat, matchMedia('(pointer: coarse)').matches ? 'low' : getSave().graphics)
  // Seasons and climate previews (seasons.ts): leaves, snow, light and the waterline.
  const seasons = createSeasons(scene, { foliage: seasonFoliage(), ground: world.groundMat, beach, weather, graphics: matchMedia('(pointer: coarse)').matches ? 'low' : getSave().graphics, toast: (m) => ui.toast(m) })
  let bob = 0
  let hemiBase = 1
  // ~10 real minutes per in-game day. GN time in Settings picks where the clock starts.
  const DAY_SECONDS = 600
  const phaseFor = (time: string) => (time === 'day' ? 0.42 : time === 'dusk' ? 0.74 : 0.02)
  const forced = new URLSearchParams(location.search).get('time')
  if (forced === 'day' || forced === 'dusk' || forced === 'night') setTime(forced)
  // A player who never picked a time starts in GM day and stays there. (New saves used to start at GN night with
  // a running clock, so phones opened onto a dark city.) GN night, Dusk and Auto in Settings still work as before.
  try { if (localStorage.getItem('gd.clock') === null) { localStorage.setItem('gd.clock', 'hold'); if (!forced) setTime('day') } } catch { /* private mode: the saved time stands */ }
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
  const ZAHRA_REST = -0.35
  ada.rotation.y = ZAHRA_REST
  {
    const tag = nameLabel('Zahra', 'Campus mentor')
    tag.position.y = 2.25
    ada.add(tag)
  }
  ada.userData.ghost = true
  scene.add(ada)
  // Zahra's body language follows her voice in any language: nods and an open hand while she talks, a wave hello.
  const zahraMoves = talkGestures(ada, 'zahra')
  let serverMoves: ReturnType<typeof talkGestures> | null = null
  window.addEventListener('gd:gesture', (e) => { const g = (e as CustomEvent<string>).detail; if (g === 'wave' || g === 'nod' || g === 'point') zahraMoves.play(g) })
  {
    const server = posedHuman('man1', { pose: 'stand', height: 1.76, look: { top: 0x1f5a4c, bottom: 0x23262a, shoes: 0x16181b } })
    server.position.set(0.35, 0.2, 0.32)
    server.userData.ghost = true
    scene.add(server)
    serverMoves = talkGestures(server, 'server')
  }
  resumeMusicOnFirstTap()
  ensureAmbientOnGesture()
  const needsFirstCourse = () => !Object.values(getSave().skills).some((s) => s?.passed)
  // First city entry (once per device, before any lesson is passed): one next step only, the Learning Center.
  // The menu badge, the notifications banner, the daily-streak card and the featured tile wait until the
  // first lesson is passed or the next visit, so nothing competes with that one step.
  const firstEntry = (() => { try { if (!needsFirstCourse() || localStorage.getItem('gd.firstEntry')) return false; localStorage.setItem('gd.firstEntry', '1'); return true } catch { return false } })()
  const quietStart = () => firstEntry && needsFirstCourse()
  if (firstEntry) {
    document.body.classList.add('first-entry')
    const lift = window.setInterval(() => { if (!quietStart()) { document.body.classList.remove('first-entry'); window.clearInterval(lift) } }, 2000)
  }
  let firstOpened = false // re-armed when the player walks away from Zahra, so closing the card is never a dead end
  if (needsFirstCourse()) {
    scene.add(firstMarker)
    if (!firstEntry) window.setTimeout(() => { if (needsFirstCourse()) notify('Meet Zahra at Campus', 'Follow the gold marker north of the plaza. Zahra gives you a 1-minute first lesson that files to your CV.', 'first-task', 'place:Campus') }, 2500)
  }
  const calmSky = () => reduceMotion || getSave().reduceMotion
  // The sky (and so the season) stays where the player put it unless they choose Auto in Settings: the day
  // never turns to night, or summer to winter, on its own.
  const clockHeld = () => { try { return localStorage.getItem('gd.clock') !== 'auto' } catch { return true } }

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
    // A drone you bought and equipped flies beside you (and is your camera in drone mode).
    if (kind === 'none') return
    follower = createDrone(kind)
    follower.scale.setScalar(2.2) // camera-drone size, easy to see beside you
    follower.position.set(pos.x + 0.8, 2.2, pos.z + 0.4)
    scene.add(follower)
  }
  syncDrone()

  window.addEventListener('gd:look', () => applyLook())
  // The character this player picked (figure and colours) goes out with their public profile: it is their picture
  // in other players' chats and on their profile.
  setCharacterSource(() => {
    const f = (avatar.object.userData.ownFigure as (() => { model: HumanModel; look: Look; height: number }) | undefined)?.()
    if (!f) return undefined
    const L = f.look as Record<string, unknown>, l: Record<string, unknown> = {}
    for (const k of ['skin', 'hair', 'top', 'bottom', 'shoes']) if (typeof L[k] === 'number') l[k] = L[k]
    for (const k of ['robe', 'kaftan', 'gown']) if (L[k]) l[k] = true
    if (typeof L.couture === 'string') l.couture = L.couture
    return { m: f.model, h: f.height, l }
  })
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
  const probe = createProbe(() => getSave().graphics, (g) => { if (liteOn()) return; setGraphics(g); applyGraphics() })
  const applyGraphics = () => {
    // Lite (low-end phones) draws as Low whatever the saved setting, at 1x, with one lamp light.
    const lite = liteOn()
    const graphics = lite ? 'low' : getSave().graphics
    const dpr = window.devicePixelRatio || 1
    const coarseDev = matchMedia('(pointer: coarse)').matches
    // Each tier must look and cost visibly different. Phones: 1x / 1.25x / 1.5x; desktops: 1x / 1.5x / 2x.
    // (Phones on High used to get 1.25x, below Medium's 1.5x, so High looked softer than Medium.)
    // Cap phone DPR harder so mid-range stays ~30+ FPS (High phone was 1.5× — still heavy with post).
    // Sharpness caps per tier. Phones used to draw the city at 1x on a 3x screen, which is what looked soft;
    // the post stack's resolution scaler (quality.ts) now steps down from these caps whenever frames run long.
    // High: on computers the screen's own density, up to 4K (3840x2160 worth of pixels); the scaler (quality.ts)
    // climbs there only while frames stay easy. Phones stay at 2x: smooth beats extra pixels on a small screen.
    const native4k = Math.max(1, Math.min(dpr, 3, Math.sqrt((3840 * 2160) / Math.max(1, window.innerWidth * window.innerHeight))))
    // Computers with graphics built into the processor keep High at 2x on Auto: the full 4K density made them crawl.
    const pcHigh = autoPerformance() && integratedGpu() ? Math.min(dpr, 2) : native4k
    const ratio = graphics === 'high' ? (coarseDev ? Math.min(dpr, 2) : pcHigh) : Math.min(dpr, graphics === 'low' ? (coarseDev ? 1.5 : 1.25) : (coarseDev ? 1.75 : 1.5))
    const drawRatio = lite ? Math.min(dpr, 1) : ratio
    renderer.setPixelRatio(drawRatio)
    // Real-time light budget: Low 3 street-lamp lights, Medium 4, High all 6 plus the 10 glow lights.
    // Every point light is paid for in every lit pixel, so this is the biggest lever on mid-range phones.
    world.setQuality(graphics, lite)
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
    post.configure(graphics, window.innerWidth, window.innerHeight, drawRatio)
    // Shadows on or off change every material's shader: compile them all now, in the background where the
    // browser can, instead of one by one (a freeze each) as each comes into view.
    if (performance.getEntriesByName('gd:revealed').length) void renderer.compileAsync(scene, camera).catch(() => undefined)
  }
  // The browser can drop the 3D view's GPU context (phones under memory pressure, a driver reset). three.js asks
  // for it back; once it returns, the effects stack is rebuilt at a lower resolution and the shaders recompiled.
  // Until then a small note says so, and if it does not come back, a key reloads the city (the game is saved).
  let gpuNote: HTMLElement | null = null, gpuTimer = 0, gpuDropped = false
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    gpuDropped = true
    window.clearTimeout(gpuTimer)
    gpuTimer = window.setTimeout(() => {
      gpuNote?.remove()
      gpuNote = document.createElement('div'); gpuNote.className = 'gpu-note'; gpuNote.setAttribute('role', 'status')
      const t = document.createElement('p'); t.textContent = 'Your phone paused the 3D view to free memory. Bringing it back…'
      const k = document.createElement('button'); k.type = 'button'; k.className = 'glass-btn primary'; k.textContent = 'Reload the city'; k.hidden = true
      k.onclick = () => location.reload()
      gpuNote.append(t, k); document.body.append(gpuNote)
      gpuTimer = window.setTimeout(() => { k.hidden = false }, 5000)
    }, 1200)
  })
  // Everything the GPU holds that the game cannot get back by itself: the reflected light (environment map, drawn
  // on the GPU), the sun's shadow map, the effects stack, and every uploaded picture (facades, ground, signs).
  // Facades are part metal, so without the environment map or their pictures they read as black blocks.
  // Pictures are sent again from the copies the game keeps (canvases and images); nothing is downloaded again.
  // While a menu holds the city still nothing redraws; after a refresh draw a few fresh frames (set once the loop exists).
  let redrawSoon = () => { /* set with the render loop */ }
  const refreshGpu = (why: string) => {
    try { applyEnvironment(renderer, scene, true) } catch (e) { console.warn('[grind] env', why, e) }
    try {
      const seen = new Set<THREE.Texture>()
      const touch = (t: unknown) => {
        const x = t as THREE.Texture | null | undefined
        if (!x || !(x as THREE.Texture).isTexture || seen.has(x) || (x as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) return
        seen.add(x)
        const img = x.image as { width?: number; data?: unknown } | null | undefined
        if (img && (img.width || img.data) && !(x as THREE.CubeTexture).isCubeTexture) x.needsUpdate = true
      }
      if (scene.background instanceof THREE.Texture) touch(scene.background)
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
        if (!m) return
        for (const mat of Array.isArray(m) ? m : [m]) {
          for (const k of Object.keys(mat)) { const v = (mat as unknown as Record<string, unknown>)[k]; if (v && (v as THREE.Texture).isTexture) touch(v) }
          // Shader-material uniforms, and the ones added in onBeforeCompile (the ground's stone, asphalt and grass),
          // which only the compiled program's uniform list knows about.
          for (const u of [(mat as THREE.ShaderMaterial).uniforms, (renderer.properties.get(mat) as { uniforms?: Record<string, { value?: unknown }> }).uniforms]) {
            if (u) for (const k of Object.keys(u)) touch(u[k]?.value)
          }
        }
      })
    } catch (e) { console.warn('[grind] textures', why, e) }
    try { world.sun.shadow.map?.dispose(); world.sun.shadow.map = null; renderer.shadowMap.needsUpdate = true } catch { /* no shadows */ }
    try { post.recover() } catch (e) { console.warn('[grind] post', why, e) }
  }
  // Blank-view watch. Some phones come back from another app with the 3D view a flat white (or black) sheet and no
  // lost-context report, so the recovery above never ran. After a return, a few drawn frames are sampled (16 pixels
  // read straight after drawing, only then): if every one is the same colour the effects stack and the pictures
  // are rebuilt; if the view is still blank a moment later, a key offers to reload the city (the game is saved).
  let blankAt = Infinity, blankStage = 0
  const px = new Uint8Array(4)
  const watchBlank = () => { blankStage = 0; blankAt = performance.now() + 900 }
  const viewBlank = (): boolean => {
    const gl = renderer.getContext()
    if (gl.isContextLost()) return false
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
    if (w < 8 || h < 8) return false
    let lo = 765, hi = 0
    for (let i = 1; i <= 4; i++) for (let j = 1; j <= 4; j++) {
      gl.readPixels(Math.floor((w * i) / 5), Math.floor((h * j) / 5), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const v = px[0]! + px[1]! + px[2]!
      lo = Math.min(lo, v); hi = Math.max(hi, v)
    }
    return hi - lo < 6
  }
  /** Called right after the city is drawn: checks the frame only while a check is due. */
  const checkBlank = () => {
    if (performance.now() < blankAt) return
    blankAt = Infinity
    let blank = false
    try { blank = viewBlank() } catch { return }
    if (!blank) { blankStage = 0; return }
    if (blankStage === 0) {
      console.warn('[grind] blank view after return: rebuilding')
      blankStage = 1
      refreshGpu('blank'); try { applyGraphics() } catch (e) { console.warn('[grind] blank', e) }
      redrawSoon(); blankAt = performance.now() + 1600
      return
    }
    blankStage = 2
    gpuNote?.remove()
    gpuNote = document.createElement('div'); gpuNote.className = 'gpu-note'; gpuNote.setAttribute('role', 'status')
    const t = document.createElement('p'); t.textContent = 'The 3D view did not come back after switching apps. Your game is saved.'
    const k = document.createElement('button'); k.type = 'button'; k.className = 'glass-btn primary'; k.textContent = 'Reload the city'
    k.onclick = () => location.reload()
    const x = document.createElement('button'); x.type = 'button'; x.className = 'glass-btn'; x.textContent = 'Keep playing'
    x.onclick = () => { gpuNote?.remove(); gpuNote = null }
    gpuNote.append(t, k, x); document.body.append(gpuNote)
  }
  canvas.addEventListener('webglcontextrestored', () => {
    window.clearTimeout(gpuTimer); gpuNote?.remove(); gpuNote = null
    watchBlank()
    // The reflected light every surface gets (an environment map drawn on the GPU) went with the context: without
    // it the whole city turns dark under a bright sky. Draw it again, then the effects stack and the shaders.
    refreshGpu('restore')
    try { applyGraphics() } catch (e) { console.warn('[grind] restore', e) }
    redrawSoon()
  })
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
  /** Extra map pins: [spot id, label, kind] (kind colours the pin). */
  const MAP_EXTRA: Array<[string, string, string]> = [
    ['hospital', 'Hospital', 'health'], ['venue-hotel', 'The Grind Grand hotel', 'stay'], ['venue-mall', 'Grind Mall', 'shop'],
    ['cruise', 'Harbour, cruises & party yacht', 'travel'], ['realty', 'Grind Realty', 'home'], ['villas', 'Villa row', 'home'],
    ['crown-lift', 'Crown penthouse', 'home'], ['race', 'Raceway', 'fun'], ['casino', 'Casino (closed)', 'fun'],
    ['graduation', 'Graduation 🎓', 'learn'], ['society', 'Etiquette House', 'learn'], ['market', 'Market hall', 'shop'],
    ['metro-beach', 'Metro · Beach', 'travel'], ['metro-marina', 'Metro · Marina', 'travel'], ['metro-skytower', 'Metro · Sky Tower', 'travel'], ['metro-raceway', 'Metro · Raceway', 'travel'],
  ]
  const portraitShot = (() => {
    const shot = createPortrait(renderer!, () => avatar.object)
    let big: ReturnType<typeof createPortrait> | null = null
    // Portraits show the player standing: while seated (or riding), the shot is taken from the plain animation
    // pose, and the seat pose comes back on the next frame. `hi` is the sharper shot for photo cards.
    return (yaw?: number, into?: HTMLCanvasElement, hi?: boolean) => {
      const person = avatar.object.userData.person as THREE.Object3D | undefined
      const posed = !!seating.sitting, py = person?.position.y ?? 0, rx = person?.rotation.x ?? 0
      if (posed) { avatar.object.userData.acc = 0.2; avatar.step(0, false, 0); if (person) { person.position.y = 0; person.rotation.x = 0 } }
      try { return hi ? (big ??= createPortrait(renderer!, () => avatar.object, { w: 720, h: 1200 }))(yaw, into) : shot(yaw, into) } finally { if (posed && person) { person.position.y = py; person.rotation.x = rx } }
    }
  })()
  const ui = mountUi(sheet, toast, {
    rank: must('#pill-rank'),
    place: must('#pill-place'),
    ledger: must('#pill-ledger'),
    season: must('#pill-season'),
    focus: must('#pill-focus'),
  }, {
    // The rank ladder lives on the Profile now, and "Things to buy" in the shop (both used to crowd the Balance).
    ranks: (into) => rankLadder(into),
    cityShop: (into) => cityShopRow(into),
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
    kioskStools: () => freeStools().length,
    kioskSit: () => { const s = freeStools()[0]; if (s) sitOn(s) },
    kioskServed: (label: string) => serveCup(label),
    onPrefs: applyPrefs,
    onRank: (label) => world.setRank(label),
    travel: (title, enter) => travelHook(title, enter),
    satMap: () => { try {
      if (!satelliteUrl()) { try { bake() } catch { /* vector list only */ } }
      const pins: Array<{ title: string; x: number; z: number; id?: string; kind?: string }> = GUIDE.flatMap((g) => {
        const h = findSpot(g.title)
        return h && Math.abs(h.x) < MAP_LIMIT && Math.abs(h.z) < MAP_LIMIT ? [{ title: g.title, x: h.x, z: h.z }] : []
      })
      // Places added since the guide was written: tap one to arrive beside it.
      // Those outside the satellite view are not pins, but they still get a row in the list of places.
      const more: Array<{ title: string; x: number; z: number; id: string }> = []
      for (const [id, title, kind] of MAP_EXTRA) {
        const h = streetSpots.find((x) => x.id === id) ?? world.hotspots.find((x) => x.id === id)
        if (h && Math.abs(h.x) < MAP_LIMIT && Math.abs(h.z) < MAP_LIMIT) pins.push({ title, x: h.x, z: h.z, id, kind })
        else if (h) more.push({ title, x: h.x, z: h.z, id })
      }
      return { url: satelliteUrl(), limit: MAP_LIMIT, pins, more, me: indoors() ? undefined : { x: pos.x, z: pos.z } }
    } catch { return { url: '', limit: MAP_LIMIT, pins: [] } } },
    portrait: (yaw?: number, into?: HTMLCanvasElement, hi?: boolean) => portraitShot(yaw, into, hi),
    goSpot: (id) => {
      const h = streetSpots.find((x) => x.id === id) ?? world.hotspots.find((x) => x.id === id)
      if (!h) { ui.toast('That place is still opening. Try again in a moment.'); return }
      if (homes?.inside) leaveHome()
      travelTo(h)
    },
    goFar: (area, at, title) => {
      // The map is a shortcut for the train, not a free pass: it costs the same $2 metro fare (free if you are
      // already there). Rides inside still charge their fare or need the day pass.
      if (homes?.inside !== area) {
        const paid = spendInGame(2, 'Grind Metro fare', `Map: straight to ${title ?? area}`)
        if (!paid.ok) { ui.toast(paid.message); return }
      }
      ui.close()
      window.dispatchEvent(new CustomEvent('gd:home', { detail: { op: 'enter', id: area, viewing: true, at } }))
      if (title) window.setTimeout(() => ui.toast(`You are at ${title}.`), 3200)
    },
  })
  performance.mark('gd:pre-mentor')
  let runStepRef: ((go: string) => void) | null = null
  let setCCRef: ((open: boolean) => void) | null = null
  const mentor = createMentorCard({
    toast: (m) => ui.toast(m),
    onRank: () => world.setRank(rankFor(getSave().xp).label),
    fullLesson: (course) => ui.open('learn', { course }),
    // After a lesson, 'What next?' follows the core loop (your CV, then the certificate) before jobs.
    next: () => { const st = nextStep(); runStepRef?.(st.go) },
    // Camera sits on the far side of the player from Zahra, so she and the Campus door are in frame.
    face: () => { camYaw = Math.atan2(pos.x - ada.position.x, pos.z - ada.position.z) },
    toCampus: () => travelHook('Campus', false),
    showProof: (course, first) => { setCCRef?.(false); ui.open('profile'); void import('./certs.ts').then((m) => m.openCertificate(course, { first })) },
    face3d: (() => { const shot = createPortrait(renderer!, () => ada, { w: 256, h: 256, head: true, headY: 1.5 }); return () => shot() })(),
  })
  // Zahra's welcome tour: once per device, after the first-run intro card closes; Settings can replay it.
  // It waits, however long sign-up takes, until the player is actually standing in the city: title screen gone,
  // no sign-in dialog, card or panel open, not inside a room. Then it starts after two calm seconds.
  let tourWaiting = false
  // A tour the player asks for (from the menu) also takes over one that is already waiting to start.
  let tourAsked = false
  const startTour = (force = false) => {
    if (force) tourAsked = true
    if ((!force && tourSeen()) || mentor.isOpen() || tourWaiting) return
    tourWaiting = true
    let calm = 0
    const busy = () => document.documentElement.classList.contains('title-on') || !(document.getElementById('menu')?.hidden ?? true)
      || ui.isOpen() || document.body.classList.contains('sheet-open') || !!document.getElementById('login-dlg')
      || !!document.querySelector('.gdesk, #cert-dlg, .login-dlg') || !!interiors.inside || !!homes?.inside || mentor.isOpen()
    const tryNow = () => {
      if (!force && !tourAsked && (tourSeen() || mentor.dismissed())) { tourWaiting = false; return }
      calm = busy() ? 0 : calm + 1
      if (calm < 2) { window.setTimeout(tryNow, 1000); return }
      tourWaiting = false
      tourAsked = false
      mentor.tour()
    }
    tryNow()
  }
  window.addEventListener('gd:tour', () => startTour(true))
  // Grind Park photo booth: four shots of the player from different angles, made into a strip (photoBooth.ts).
  window.addEventListener('gd:photobooth', () => {
    const shots = [0, 0.5, -0.5, 0.2].map((yaw) => portraitShot(yaw, undefined, true))
    void import('./photoBooth.ts').then((m) => m.showBoothStrip(shots))
  })
  // Set once seating exists (further down): travel stands the player up first.
  let standUp: (() => void) | null = null
  function hooksTeleport(x: number, z: number) {
      standUp?.()
      // Never arrive inside something (a kiosk, a car, a counter): take the nearest clear spot, rings outward.
      if (!interiors.inside && !homes?.inside && blocked(world.obstacles, x, z, PLAYER_R + 0.05)) {
        search: for (let r = 0.6; r <= 6; r += 0.6) for (let k = 0; k < 12; k += 1) {
          const a = (k / 12) * Math.PI * 2 + Math.PI / 2, nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r
          if (!blocked(world.obstacles, nx, nz, PLAYER_R + 0.05)) { x = nx; z = nz; break search }
        }
      }
      pos.x = x
      pos.z = z
      vel.x = 0
      vel.z = 0
      target = null
      cameraReady = false
  }

  // Map rows, pins and feed links name places loosely ("Plaza", "The Grind Ring"); the 3D spot is "Grind Ring".
  function findSpot(title: string): Hotspot | undefined {
    const bare = (t: string) => t.replace(/^the\s+/i, '').trim().toLowerCase()
    const alias: Record<string, string> = { plaza: 'grind ring', 'campus café': 'grind café', 'campus cafe': 'grind café' }
    const want = alias[bare(title)] ?? bare(title)
    return world.hotspots.find((h) => bare(h.title) === want) ?? world.hotspots.find((h) => want.startsWith(bare(h.title)) || bare(h.title).startsWith(want))
  }
  must('#nav-profile').addEventListener('click', () => ui.open('profile'))
  must('#nav-boutique').addEventListener('click', () => ui.open('boutique'))
  document.getElementById('nav-trade')?.addEventListener('click', () => ui.open('trade'))
  must('#nav-city').addEventListener('click', () => ui.open('city'))
  must('#nav-settings').addEventListener('click', () => ui.open('settings'))
  document.getElementById('nav-seasons')?.addEventListener('click', () => ui.open('seasons'))
  document.getElementById('nav-prayer')?.addEventListener('click', () => ui.open('prayertimes'))
  // Click-to-travel: tap a spot on the map and arrive outside the nearest door.
  // Picking a place on the map: a "Going to" card shows the city from above with your route to it and a dot
  // travelling along, then you arrive (it used to jump there with only a toast, so you never saw where it went).
  const goingCard = (title: string, from: { x: number; z: number }, to: { x: number; z: number }, ms = 1500): Promise<void> => new Promise((done) => {
    document.getElementById('going')?.remove()
    const card = document.createElement('div'); card.id = 'going'; card.className = 'going'; card.setAttribute('role', 'status')
    const W = 520, H = 280, cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const g = cv.getContext('2d')!
    const cx = (from.x + to.x) / 2, cz = (from.z + to.z) / 2
    const vw = Math.max(46, Math.abs(from.x - to.x) * 1.45, Math.abs(from.z - to.z) * 1.45 * (W / H)), vh = vw * (H / W)
    const sx = (x: number) => ((x - (cx - vw / 2)) / vw) * W, sy = (z: number) => ((z - (cz - vh / 2)) / vh) * H
    const base = () => {
      const sat = satelliteCanvas()
      if (sat) { const k = sat.width / (2 * MAP_LIMIT); g.drawImage(sat, (cx - vw / 2 + MAP_LIMIT) * k, (cz - vh / 2 + MAP_LIMIT) * k, vw * k, vh * k, 0, 0, W, H) }
      else { g.fillStyle = '#4b5a50'; g.fillRect(0, 0, W, H) }
      g.fillStyle = 'rgba(6, 12, 9, 0.28)'; g.fillRect(0, 0, W, H)
    }
    const m = Math.round(Math.hypot(to.x - from.x, to.z - from.z))
    const words = document.createElement('div'); words.className = 'going-t'
    const kick = document.createElement('small'); kick.textContent = 'Going to'
    const name = document.createElement('b'); name.textContent = title
    const dist = document.createElement('span'); dist.textContent = `${m} m away`
    words.append(kick, name, dist)
    card.append(cv, words)
    document.body.append(card)
    requestAnimationFrame(() => card.classList.add('in'))
    const t0 = performance.now()
    const frame = () => {
      if (!card.isConnected) return
      const u = Math.min(1, (performance.now() - t0) / (ms * 0.85))
      base()
      g.setLineDash([10, 9]); g.lineWidth = 5; g.lineCap = 'round'; g.strokeStyle = 'rgba(255, 255, 255, 0.85)'
      g.beginPath(); g.moveTo(sx(from.x), sy(from.z)); g.lineTo(sx(to.x), sy(to.z)); g.stroke(); g.setLineDash([])
      g.strokeStyle = '#3bfaa4'; g.lineWidth = 6
      g.beginPath(); g.moveTo(sx(from.x), sy(from.z)); g.lineTo(sx(from.x + (to.x - from.x) * u), sy(from.z + (to.z - from.z) * u)); g.stroke()
      // Destination pin and the moving dot.
      const px = sx(to.x), py = sy(to.z)
      g.fillStyle = '#e8b545'; g.beginPath(); g.arc(px, py - 18, 13, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(px, py); g.closePath(); g.fill()
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py - 18, 5, 0, Math.PI * 2); g.fill()
      const dx = sx(from.x + (to.x - from.x) * u), dy = sy(from.z + (to.z - from.z) * u)
      g.fillStyle = 'rgba(59, 250, 164, 0.35)'; g.beginPath(); g.arc(dx, dy, 15, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#12c873'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(dx, dy, 8, 0, Math.PI * 2); g.fill(); g.stroke()
      if (u < 1) requestAnimationFrame(frame)
    }
    frame()
    window.setTimeout(() => { done(); card.classList.remove('in'); window.setTimeout(() => card.remove(), 400) }, ms)
  })
  const travelTo = (spot: Hotspot, then?: () => void) => {
    // At the wheel of a car in the city: drive there by itself instead of jumping (places beyond the city's
    // roads, and a route that cannot be found, still travel the usual way).
    const inCity = Math.max(Math.abs(spot.x), Math.abs(spot.z)) < CITY_LIMIT - 1
    const len0 = Math.hypot(spot.x, spot.z) || 1, back = Math.min(3, len0)
    const dest = { x: spot.x - (spot.x / len0) * back, z: spot.z - (spot.z / len0) * back }
    if (ride && ride.driving && ride.kind === 'car' && ride.mode === 'free' && !drive.passenger && !interiors.inside && inCity) {
      if (drive.autoTo(spot.title, dest, { x: ride.x, z: ride.z }, world.obstacles, CITY_LIMIT - 1)) { ui.close(); setCCRef?.(false); return }
    }
    // On foot in the city, with Cab or Premium chosen on the map: a car comes and drives you there.
    const by = (() => { try { return localStorage.getItem('gd.travelBy') } catch { return null } })()
    if ((by === 'cab' || by === 'premium') && !ride?.driving && !interiors.inside && !homes?.inside && !metro?.riding && inCity && Math.hypot(dest.x - pos.x, dest.z - pos.z) > 12) {
      void callCab(spot, dest, by, then).then((ok) => { if (!ok) quickTravel(spot, then) })  // no road, or short of the fare
      return
    }
    quickTravel(spot, then)
  }
  const quickTravel = (spot: Hotspot, then?: () => void) => {
    if (interiors.inside) leaveRoom()
    const len = Math.hypot(spot.x, spot.z) || 1
    const step = Math.min(2.4, len)
    ui.close()
    // The menu holds the city still while it is open: close it too, so the city keeps drawing during the trip.
    setCCRef?.(false)
    const tx = spot.x - (spot.x / len) * step, tz = spot.z - (spot.z / len) * step
    const arrive = () => {
      hooksTeleport(tx, tz)
      ui.setPlace(districtName(pos.x, pos.z))
      ui.toast(`You are at ${spot.title}.`)
      // Let the city draw the new place before its panel opens: a panel freezes the view behind it, and opening
      // it at once left the old spot (or, on phones, a black screen) behind the panel instead of the destination.
      if (then) window.setTimeout(then, 450)
    }
    target = null
    if (Math.hypot(tx - pos.x, tz - pos.z) < 6 || homes?.inside) { arrive(); return }
    void goingCard(spot.title, { x: pos.x, z: pos.z }, { x: spot.x, z: spot.z }).then(arrive)
  }
  travelHook = (title, enter) => {
    const bare = (t: string) => t.replace(/^the\s+/i, '').replace(/[’']/g, "'").trim().toLowerCase()
    const want = bare(title)
    // Every name a place goes by: the street's doors first, then the places that load after the city opens
    // (the mall, the hotel, the metro stops), then the places beyond the centre (Grind Park, the airport).
    const MOSQUE = /^(grand )?(masjid|mosque)$/
    let spot = MOSQUE.test(want) ? world.hotspots.find((h) => h.id === 'prayer') : findSpot(title)
    if (!spot) {
      const named = (h: Hotspot) => bare(h.title).replace(/^grind metro · /, 'metro · ')
      spot = streetSpots.find((h) => named(h) === want || bare(h.title) === want)
        ?? streetSpots.find((h) => !h.id.startsWith('bench-') && (named(h).startsWith(want) || want.startsWith(named(h))) && want.length > 3)
    }
    if (!spot && /^(grind )?(metro|train|station)( station| stop)?$/.test(want)) {
      // "The metro": the nearest station on foot.
      const stops = streetSpots.filter((h) => /^metro-(beach|marina|raceway|skytower)$/.test(h.id))
      spot = stops.sort((a, b) => Math.hypot(a.x - pos.x, a.z - pos.z) - Math.hypot(b.x - pos.x, b.z - pos.z))[0]
      if (!spot) { ui.toast('The trains are starting up. Try again in a moment.'); return }
    }
    if (!spot) {
      const far = FAR.find((p) => !p.inside && (bare(p.title) === want || bare(p.title).startsWith(want) || want === p.area || want === `grind ${p.area}`))
        ?? FAR.find((p) => bare(p.title) === want)
      if (far) { if (homes?.inside !== far.area) { const paid = spendInGame(2, 'Grind Metro fare', `Straight to ${far.title}`); if (!paid.ok) { ui.toast(paid.message); return } } ui.close(); window.dispatchEvent(new CustomEvent('gd:home', { detail: { op: 'enter', id: far.area, viewing: true, at: far.at } })); window.setTimeout(() => ui.toast(`You are at ${far.title}.`), 3200); return }
    }
    if (!spot) { ui.toast(`Couldn't find ${title} on the map.`); return }
    travelTo(spot, () => {
      if (!enter) return
      if (interiors.roomFor(spot.id)) enterRoom(spot)
      else if (spot.action) ui.open(spot.action as Parameters<typeof ui.open>[0])
    })
  }
  // Test hook: ?room=<hotspot id|action> walks you into that room after boot. Only moves the local player.
  const roomParam = new URLSearchParams(location.search).get('room')
  if (roomParam) Object.assign(window, { __roomObstacles: () => ({ obs: interiors.obstacles(), r: PLAYER_R, at: { ...pos } }) }) // read-only, for the walk-path check
  if (roomParam) window.setTimeout(() => {
    const spot = world.hotspots.find((h) => (h.id === roomParam || h.action === roomParam) && interiors.roomFor(h.id))
    if (spot) travelTo(spot, () => enterRoom(spot))
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
  // Screenshot (taken from My Gallery or the selfie shutter): render a frame and copy it in the same task (the
  // drawing buffer is only valid until the frame ends), add the watermark, save it to the gallery.
  // The game's logo goes on every screenshot (the same mark as the HUD), loaded once up front.
  const shotLogo = new Image(); shotLogo.decoding = 'async'; shotLogo.src = '/brand/logo-new.webp'
  const capture = (): Promise<File | null> => {
    // Photos are 4K: this one frame is drawn with the long side at 3840 px (2560 on phones with little memory,
    // and never past what the GPU allows), copied, and the normal resolution comes straight back.
    // Phones: 2560 at most (1920 with little memory, or once the phone has dropped the 3D view this visit). A 4K
    // frame through the effects stack needs several full-size buffers at once, and that is what made phones
    // drop the 3D view and leave the screen black.
    const coarse = matchMedia('(pointer: coarse)').matches
    const lowMem = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4 && coarse
    const side = Math.min(gpuDropped || lowMem ? 1920 : coarse ? 2560 : 3840, renderer.capabilities.maxTextureSize || 4096)
    const r4k = side / Math.max(1, window.innerWidth, window.innerHeight)
    let big = false
    try { if (r4k > renderer.getPixelRatio() + 0.01) { post.snapshot(r4k); big = true } else post.render() } catch { /* use the last frame */ }
    const out = document.createElement('canvas'); out.width = canvas.width; out.height = canvas.height
    const g = out.getContext('2d')!
    g.drawImage(canvas, 0, 0)
    if (big) { try { post.restore() } catch { /* the next frame resizes anyway */ } }
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
    // A 4K PNG is 15-20 MB: big photos are high-quality JPEG (about 2-3 MB) so the gallery and sharing stay quick.
    const type = out.width * out.height > 4_000_000 ? 'image/jpeg' : 'image/png'
    return new Promise((ok) => out.toBlob((b) => ok(b ? new File([b], `grind-district-${Date.now()}.${type === 'image/jpeg' ? 'jpg' : 'png'}`, { type }) : null), type, 0.93))
  }
  // The round key beside the menu opens My Gallery; screenshots, selfies and skits are taken from there.
  const shotBtn = document.querySelector<HTMLButtonElement>('#shot')
  shotBtn?.addEventListener('click', () => openGallery())
  // Screenshots go to My Gallery (media.ts): download or share them from there. If the browser will not store
  // them (a private window), the old way: the share sheet, or a download.
  const saveShot = (pending: Promise<File | null>) => {
    personaNote('photo')
    const download = (f: File) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name
      document.body.append(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 10000)
      ui.toast('Screenshot saved to Downloads.')
    }
    void pending.then(async (file) => {
      if (!file) { ui.toast('This browser blocked the screenshot.'); return }
      const [{ saveMedia }, { flashSaved }] = await Promise.all([import('./media.ts'), import('./myGallery.ts')])
      const id = await saveMedia(selfie ? 'selfie' : 'screenshot', file)
      if (id) { flashSaved(selfie ? 'Selfie' : 'Screenshot', openGallery); return }
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file] }).catch((e: Error) => { if (e.name !== 'AbortError') download(file) })
      } else download(file)
    })
  }
  // From the gallery: the panel closes first, so the next frame is the city alone.
  const takeShot = () => { window.requestAnimationFrame(() => window.requestAnimationFrame(() => saveShot(capture()))) }
  // My Gallery (myGallery.ts), Selfie mode and Skits (skit.ts).
  let selfie: { angle: number; dist: number } | null = null
  let afterRender: (() => void) | null = null
  const selfieBar = document.createElement('div'); selfieBar.id = 'selfie-bar'; selfieBar.className = 'selfie-bar'; selfieBar.hidden = true
  {
    const b = (label: string, aria: string, on: () => void, cls = '') => { const x = document.createElement('button'); x.type = 'button'; x.textContent = label; x.setAttribute('aria-label', aria); x.className = `selfie-key ${cls}`; x.onclick = on; return x }
    selfieBar.append(
      b('×', 'Leave selfie mode', () => endSelfie(), 'selfie-x'),
      b('↺', 'Turn the camera left', () => { if (selfie) selfie.angle = Math.max(-1.3, selfie.angle - 0.35) }),
      b('−', 'Closer', () => { if (selfie) selfie.dist = Math.max(0.9, selfie.dist - 0.45) }),
      b('', 'Take the selfie', () => saveShot(capture()), 'selfie-shutter'),
      b('+', 'Further away', () => { if (selfie) selfie.dist = Math.min(4.6, selfie.dist + 0.45) }),
      b('↻', 'Turn the camera right', () => { if (selfie) selfie.angle = Math.min(1.3, selfie.angle + 0.35) }),
    )
    document.body.append(selfieBar)
  }
  const startSelfie = () => {
    if (ride?.driving || metro?.riding || homes?.flying) { ui.toast('Step out first, then take a selfie.'); return }
    target = null; vel.x = 0; vel.z = 0
    selfie = { angle: 0.35, dist: 1.5 }
    selfieBar.hidden = false; document.body.classList.add('selfie-mode')
    ui.toast('Selfie mode: frame it with the arrows and − +, then tap the shutter.')
  }
  const endSelfie = () => { selfie = null; selfieBar.hidden = true; document.body.classList.remove('selfie-mode'); cameraReady = false }
  // Drone camera: your own drone lifts off and you fly it round the city. The move stick flies it (forward, back,
  // sideways, the way the camera looks), drag to turn, hold ▲ and ▼ to climb and descend, ⌂ brings it back to
  // you. Take photos or record a video (the skit recorder) from up there; both go to My Gallery. You stand still
  // where you launched it, and the drone keeps out of the buildings' walls.
  let droneCam: { x: number; y: number; z: number; vx: number; vy: number; vz: number; climb: number } | null = null
  const droneBar = document.createElement('div'); droneBar.id = 'drone-bar'; droneBar.className = 'selfie-bar drone-bar'; droneBar.hidden = true
  const droneHint = document.createElement('p'); droneHint.className = 'drone-hint'; droneHint.hidden = true
  droneHint.textContent = matchMedia('(pointer: coarse)').matches ? 'Stick: fly · Drag: turn · Hold ▲ ▼: up and down' : 'WASD: fly · Drag: turn · R / F: up and down'
  {
    const b = (label: string, aria: string, on: () => void, cls = '') => { const x = document.createElement('button'); x.type = 'button'; x.textContent = label; x.setAttribute('aria-label', aria); x.title = aria; x.className = `selfie-key ${cls}`; x.onclick = on; return x }
    // ▲ and ▼ work while held (a finger, the mouse or the keyboard's Enter/Space)
    const hold = (label: string, aria: string, dir: number) => {
      const x = b(label, aria, () => undefined, 'drone-hold')
      const on = (e: Event) => { e.preventDefault(); if (droneCam) droneCam.climb = dir }
      const off = () => { if (droneCam && droneCam.climb === dir) droneCam.climb = 0 }
      x.addEventListener('pointerdown', on); for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) x.addEventListener(ev, off)
      x.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') on(e) }); x.addEventListener('keyup', off)
      return x
    }
    droneBar.append(
      b('×', 'Land the drone', () => endDroneCam(), 'selfie-x'),
      hold('▲', 'Climb (hold)', 1),
      hold('▼', 'Descend (hold)', -1),
      b('', 'Take a photo', () => saveShot(capture()), 'selfie-shutter'),
      b('●', 'Record a video', () => startSkit(), 'drone-rec'),
      b('⌂', 'Bring the drone back to me', () => { if (droneCam) { droneCam.x = pos.x + Math.sin(camYaw) * 3; droneCam.z = pos.z + Math.cos(camYaw) * 3; droneCam.y = avatar.object.position.y + 3; droneCam.vx = droneCam.vz = droneCam.vy = 0 } }),
    )
    document.body.append(droneBar, droneHint)
  }
  const startDroneCam = () => {
    if (getSave().drone === 'none') { ui.toast('Buy a drone in Gadgets (and equip it) to fly the drone camera.'); return }
    if (ride?.driving || metro?.riding || homes?.flying || interiors.inside || homes?.inside) { ui.toast(interiors.inside || homes?.inside ? 'Drones fly over the city: step outside first.' : 'Step out first, then launch the drone.'); return }
    if (selfie) endSelfie()
    ui.close()
    syncDrone()
    target = null; vel.x = 0; vel.z = 0
    droneCam = { x: pos.x + Math.sin(camYaw) * 1.5, y: avatar.object.position.y + 2.6, z: pos.z + Math.cos(camYaw) * 1.5, vx: 0, vy: 0, vz: 0, climb: 0 }
    droneBar.hidden = false; droneHint.hidden = false; document.body.classList.add('drone-mode')
    window.setTimeout(() => { droneHint.hidden = true }, 7000)
    ui.toast('Drone up! Fly it with the stick, drag to turn, hold ▲ ▼ to climb. Take a photo or record a video.')
  }
  const endDroneCam = () => { droneCam = null; droneBar.hidden = true; droneHint.hidden = true; document.body.classList.remove('drone-mode'); cameraReady = false }
  /** Each frame in drone mode: the stick and ▲ ▼ move the drone with a little inertia, inside the city's limits. */
  const flyDrone = (dt: number, fx: number, fy: number) => {
    const d = droneCam!
    const fwdX = -Math.sin(camYaw), fwdZ = -Math.cos(camYaw), rX = Math.cos(camYaw), rZ = -Math.sin(camYaw)
    const top = 11 // metres a second
    const k = 1 - Math.exp(-3.2 * dt)
    d.vx += ((fwdX * fy + rX * fx) * top - d.vx) * k
    d.vz += ((fwdZ * fy + rZ * fx) * top - d.vz) * k
    d.vy += (d.climb * 5 - d.vy) * k
    d.x = THREE.MathUtils.clamp(d.x + d.vx * dt, -CITY_LIMIT - 30, CITY_LIMIT + 30)
    d.z = THREE.MathUtils.clamp(d.z + d.vz * dt, -CITY_LIMIT - 30, CITY_LIMIT + 30)
    d.y = THREE.MathUtils.clamp(d.y + d.vy * dt, 1.2, 60)
    // Low down, the drone slides along walls instead of flying into buildings.
    if (d.y < 16) { const p = { x: d.x, z: d.z }; resolveCollision(p, { x: d.vx, z: d.vz }, world.obstacles, 0.5); d.x = p.x; d.z = p.z }
  }
  window.addEventListener('gd:dronecam', startDroneCam)
  // On a keyboard: WASD or the arrows fly the drone (the move keys), R climbs and F descends while held.
  window.addEventListener('keydown', (e) => { if (!droneCam || e.repeat || (e.target as HTMLElement | null)?.closest?.('input, textarea')) return; const k = e.key.toLowerCase(); if (k === 'r') droneCam.climb = 1; else if (k === 'f') droneCam.climb = -1 })
  window.addEventListener('keyup', (e) => { if (!droneCam) return; const k = e.key.toLowerCase(); if ((k === 'r' && droneCam.climb === 1) || (k === 'f' && droneCam.climb === -1)) droneCam.climb = 0 })
  // Camera glasses (Grind Lens): see the city through your own eyes and keep walking; take a photo or film what you
  // see. The figure steps out of view while you look through the glasses, and comes back when you take them off.
  let glassCam = false
  const glassBar = document.createElement('div'); glassBar.id = 'glass-bar'; glassBar.className = 'selfie-bar glass-bar'; glassBar.hidden = true
  {
    const b = (label: string, aria: string, on: () => void, cls = '') => { const x = document.createElement('button'); x.type = 'button'; x.textContent = label; x.setAttribute('aria-label', aria); x.title = aria; x.className = `selfie-key ${cls}`; x.onclick = on; return x }
    glassBar.append(b('×', 'Take the glasses off', () => endGlassCam(), 'selfie-x'), b('', 'Take a photo', () => saveShot(capture()), 'selfie-shutter'), b('●', 'Record a video', () => startSkit(), 'drone-rec'))
    const rec = document.createElement('span'); rec.className = 'glass-led'; rec.setAttribute('aria-hidden', 'true'); glassBar.prepend(rec)
    document.body.append(glassBar)
  }
  const startGlassCam = () => {
    if (!((getSave().ownedVehicles ?? []) as string[]).includes('camglasses')) { ui.toast('Get Grind Lens camera glasses in Gadgets to film what you see.'); return }
    if (ride?.driving || metro?.riding || homes?.flying) { ui.toast('Step out first, then put the glasses on.'); return }
    if (selfie) endSelfie()
    if (droneCam) endDroneCam()
    ui.close(); setCC(false)
    glassCam = true
    glassBar.hidden = false; document.body.classList.add('glass-mode')
    ui.toast('Glasses on: you see what they see. Walk, drag to look, take a photo or record. The light by the lens is on while you film.')
  }
  const endGlassCam = () => { glassCam = false; glassBar.hidden = true; document.body.classList.remove('glass-mode'); avatar.object.visible = !ride?.driving && !metro?.riding; cameraReady = false }
  window.addEventListener('gd:glasscam', startGlassCam)
  // The other cameras, from Gadgets: the phone (a selfie or a photo of the view) and the computer (record a clip).
  window.addEventListener('gd:selfie', () => { ui.close(); setCC(false); startSelfie() })
  window.addEventListener('gd:photo', () => { ui.close(); setCC(false); takeShot() })
  window.addEventListener('gd:skit', () => { ui.close(); setCC(false); startSkit() })
  const startSkit = () => void import('./skit.ts').then((m) => m.openSkit({
    canvas, logo: shotLogo, onFrame: (fn) => { afterRender = fn }, toast: (t) => ui.toast(t),
    sounds: async () => { const [a, mu] = await Promise.all([import('./ambient-audio.ts'), import('./music.ts')]); return [a.ambientTap(), mu.musicTap()].filter((x): x is MediaStream => !!x) },
    saved: (id) => { if (id) void import('./myGallery.ts').then((g) => g.flashSaved('Skit', openGallery)); else ui.toast('The skit could not be saved on this device (storage full or a private window).') },
  }))
  const openGallery = () => { setCC(false); void import('./myGallery.ts').then((g) => g.openMyGallery({ toast: (t) => ui.toast(t), shot: takeShot, selfie: startSelfie, skit: startSkit })) }
  window.addEventListener('gd:gallery', openGallery)


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
  // What's new: public/updates.json, one list of release notes. Each entry lands once in the notifications (newest
  // on top, with a link where there is one); the newest is also sent once as a phone alert by the server to players
  // who turned phone alerts on (api/_notify.ts, broadcastUpdate). Adding an entry to that file is all it takes.
  window.setTimeout(() => {
    type Update = { id: string; title: string; body: string; go?: string; push?: boolean }
    void fetch('/updates.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((d: { updates?: Update[] } | null) => {
      const list = (d?.updates ?? []).filter((u) => u && typeof u.id === 'string' && typeof u.title === 'string')
      if (!list.length) return
      // Extras wait: a new player hears about them only after passing a first lesson (the core loop comes first).
      const send = () => { for (const u of list) notify(u.title, u.body ?? '', u.id, u.go) }
      if (!needsFirstCourse()) send()
      else { const wait = window.setInterval(() => { if (!needsFirstCourse()) { window.clearInterval(wait); window.setTimeout(send, 20_000) } }, 5000) }
      // The newest note as a phone alert: the server sends it once, to everyone with alerts on (at most one a day).
      const latest = list[list.length - 1]!
      try {
        if (latest.push !== false && localStorage.getItem('gd.newsPing') !== latest.id) {
          window.setTimeout(() => { void fetch(`/api/messages?op=news-ping&id=${encodeURIComponent(latest.id)}`).then((r) => { if (r.ok) localStorage.setItem('gd.newsPing', latest.id) }).catch(() => undefined) }, 30_000)
        }
      } catch { /* private mode */ }
    }).catch(() => undefined)
  }, 4000)
  // A newer version of the game, live since this tab opened: offered (or loaded on the title screen).
  void import('./freshness.ts').then((m) => m.watchForUpdates({ onTitle: () => !document.getElementById('menu')?.hidden }))
  // Phones with alerts on pick up the newest notification design (sw.js) on their next visit.
  try { if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistration('/sw.js').then((r) => r?.update()).catch(() => undefined) } catch { /* unsupported */ }
  installLayers()
  if (!localStorage.getItem('gd.welcomed') && !localStorage.getItem('gd.privy.username')) notify('Welcome to Grind District', 'Start at Campus: Zahra teaches a five-minute lesson, and it goes on your CV with a certificate you keep. Tap the gold Next step button any time.', 'welcome', 'place:Campus')
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
    else if (kind === 'skill' && label.startsWith('Passed')) {
      notify('Course complete', `${label}. ${detail}`, undefined, 'panel:profile')
      // The last Campus course: graduation is ready.
      if (canGraduate() && !graduatedOn()) window.setTimeout(() => notify('You finished Campus 🎓', 'Every course in all six worlds passed. Your graduation is ready: cap and gown are waiting in the Great Hall.', 'grad-ready', 'panel:diploma'), 1500)
    }
    else if (label === 'Sign-up bonus') notify('Sign-up bonus', detail, undefined, 'balance')
  })
  const careerOpeners: Record<'career' | 'feed', () => void> = { career: () => {}, feed: () => {} }
  initCareer({ toast: (m) => ui.toast(m), rankUp: feedRankUp })
  startNeeds((m) => ui.toast(m))
  // The long-term play record behind the personality reading (persona.ts), and home staff (staff.ts).
  startPersona()
  initStaff({ toast: (m) => ui.toast(m), openPanel: (p) => ui.open(p), openMap: () => ui.open('city') })
  { const open = ui.open; ui.open = (p, extra) => { notePanel(p); open(p, extra) } }
  startPass((m) => ui.toast(m))
  startCashAlert()
  startReputation()
  void import('./cards.ts').then((m) => m.startCards((t) => ui.toast(t)))
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
      // The rank lives on the Profile now; the wallet card says what you do and where the history is.
      must('#cc-rank').textContent = jobTitle ? `${jobTitle} · tap for history` : 'Tap for history and wallets'
    }
  }
  nav.inert = true
  const closeSheet = () => { ccSheet.hidden = true; ccSheet.classList.remove('dm-chat'); document.body.classList.remove('cc-sheet-on'); sheetBody.replaceChildren() }
  let bakeWhenStill = () => { /* set once the map helpers exist */ }
  const setCC = (open: boolean) => {
    document.body.classList.toggle('rail-shut', !open)
    nav.inert = !open // keyboard and screen readers skip the shut menu too
    railToggle.setAttribute('aria-expanded', String(open))
    // One layer at a time: opening the menu shuts any open panel, so the two never stack.
    if (open) { if (ui.isOpen()) ui.close(); paintStatus(); paintNeedsCard(must('#cc-needs')); window.setTimeout(() => bakeWhenStill(), 350) }
    else closeSheet()
  }
  setCCRef = setCC
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
    if (go === 'gallery' || go === 'players') { window.dispatchEvent(new Event(`gd:${go}`)); return true }
    if (go === 'reload') { location.reload(); return true }
    if (go === 'streak') { setCC(true); window.dispatchEvent(new Event('gd:streak-claim')); return true }
    return false
  }
  setNoteFollow(follow)
  window.addEventListener('gd:follow', (e) => { follow(String((e as CustomEvent).detail ?? '')) })
  const openSheet = (title: string, fill: () => void) => {
    sheetTitle.textContent = title
    ccSheet.hidden = false; ccSheet.classList.remove('dm-chat'); document.body.classList.add('cc-sheet-on')
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
  /** The rank ladder (Profile). The next rank can be bought with in-game balance once more than $5 has been topped
   *  up, exactly as it was on the Balance sheet; ranks are still earned free by learning. */
  const rankLadder = (into: HTMLElement) => {
    const paint = () => {
      const b = balanceSplit()
      const road = el('div')
      renderRankRoad(road, { toppedUp: b.toppedUp, total: b.total, buy: (i) => {
        const r = RANKS[i]!, price = RANK_START[r.id]
        const paid = spendInGame(price, 'Bought ' + r.label + ' rank', 'Rank purchase with in-game balance.')
        if (!paid.ok) { ui.toast(paid.message); return }
        bonusXp(Math.max(1, r.xp - getSave().xp), 'Reached ' + r.label, 'Rank bought with in-game balance.')
        paint()
      } })
      into.replaceChildren(road)
    }
    paint()
  }
  /** "Things to buy" (the shop): the city's showcase of cars, the jet, phones, looks and upgrades. */
  const cityShopRow = (into: HTMLElement) => {
    const go = (fn: () => void) => () => { ui.close(); setCC(false); fn() }
    into.append(el('h3', 'Things to buy in the city'))
    const shop = el('div')
    renderShopRow(shop, [
      { title: 'Grand tourer', sub: 'Two seats, tan leather', price: '$900', pic: 'tourer', tone: 'graphite', go: go(() => ui.open('dealer')) },
      { title: 'Grind Pass', sub: '20 rewards, $1,000 back', price: '$750', icon: 'pass', tone: 'emerald', go: go(() => window.dispatchEvent(new CustomEvent('gd:career', { detail: 'weekly' }))) },
      { title: 'Light jet', sub: 'Six seats, regional range', price: '$1,200', pic: 'lightjet', tone: 'sky', go: go(() => ui.open('dealer')) },
      { title: 'Pro phone', sub: 'Titanium, triple camera', price: '$90', pic: 'phonepro', tone: 'graphite', go: go(() => ui.open('gadgets')) },
      { title: 'Sky drone', sub: 'Two-seat electric air taxi', price: '$1,650', pic: 'skydrone', tone: 'sky', go: go(() => ui.open('dealer')) },
      { title: 'Makeup kit', sub: 'Lipstick, blush, shadow, liner', price: '$120', icon: 'makeup', tone: 'rose', go: go(() => ui.open('boutique')) },
      { title: 'House upgrade', sub: 'Furnish the next tier', price: 'in-game', icon: 'house', tone: 'walnut', go: go(() => travelHook('Your house', true)) },
      { title: "Members' lounge", sub: 'Rooms open by rank', price: 'by rank', icon: 'lounge', tone: 'walnut', go: go(() => travelHook('Members lounge', true)) },
    ])
    into.append(shop)
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
    // Players who signed in with a NEAR wallet see that wallet here too: its account and real NEAR balance.
    const nearChip = nearWalletChip()
    if (nearChip) chips.push(nearChip)
    if (chips.length) idRow.append(...chips)
    else idRow.append(el('small', `Wallet ID ${save.username ? '@' + save.username : 'guest'}`))
    idRow.append(el('span', 'USD', 'wal-cur'))
    const split = el('p', '', 'cc-split wal-split')
    const paintSplit = () => { const b = balanceSplit(); split.replaceChildren(); for (const [k, v] of [['Earned in the city', b.earned], ['Topped up', b.toppedUp]] as const) { const c = el('span'); c.append(el('small', k), el('b', `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)); split.append(c) } }
    paintSplit()
    const roundActs = el('div', '', 'wal-round')
    // Which money goes first, in one line (state.ts settleBuckets): earned, then topped up.
    const splitNote = el('p', 'Spending uses earned money first. In-game dollars cannot be withdrawn.', 'wal-split-note')
    hero.append(greet, label, big, idRow, roundActs, split, splitNote)
    sheetBody.replaceChildren(hero)
    const tick = window.setInterval(() => {
      if (ccSheet.hidden || sheetTitle.textContent !== 'Balance' || !big.isConnected) { clearInterval(tick); return }
      if (big.dataset.v !== getSave().ledger.toFixed(2)) { paintBig(); paintSplit(); paintSpend(); paintAssets(); paintRecent() }
    }, 1000)
    const topBtn = el('button', 'Top up', 'topup-go')
    topBtn.type = 'button'
    const credited = () => { paintStatus(); paintBig(); paintSplit(); paintSpend(); paintAssets(); paintRecent(); recent.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }
    // Ranks moved to the Profile and "Things to buy" to the shop: the Balance is the money, what it bought and
    // the wallets you watch.
    const spend = el('div', '', 'cc-spend')
    const go = (fn: () => void) => () => { closeSheet(); setCC(false); fn() }
    const paintSpend = () => { spend.replaceChildren() }
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
      round('more', 'Watch', () => watch.scrollIntoView({ behavior: 'smooth', block: 'start' })),
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
        const sign = m?.[1] ?? (/^(Bought|Paid|Grind Pass ·|Grind Pass tier skip|Staked)/.test(a.label) ? '-' : /^(Top-up|Starting|Sign-up|Sold|Unstaked)/.test(a.label) ? '+' : '')
        const row = el('div', '', 'wal-tx')
        const ab = a.label.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '$'
        // A trade says how much of what, at what price: "0.0021 BTC at $64,281.50".
        const deal = a.kind === 'trade' ? (a.detail.match(/:\s*(.+? at \$[\d,.]+)/)?.[1] ?? a.detail.match(/practice at (\$[\d,.]+)/)?.[1]?.replace(/^/, 'at ') ?? '') : ''
        const nm = el('div'); nm.append(el('b', a.label), el('small', deal ? `${when(a.at)} · ${deal}` : when(a.at)))
        row.append(el('span', ab, 'wal-tx-ico'), nm, el('span', m ? `${sign}$${m[2]}` : '', `wal-tx-amt${sign === '+' ? ' in' : sign === '-' ? ' out' : ''}`))
        recent.append(row)
      }
      if (!moves.length) recent.append(el('p', 'No balance moves yet. Pass a course or check in to earn your first dollars.', 'cc-muted'))
    }
    paintRecent()
    // Watch a wallet: public addresses only, read from the chain (watchWallet.ts). Never a seed phrase or key.
    const watch = el('div', '', 'watch-card')
    void import('./watchWallet.ts').then((m) => m.renderWatch(watch)).catch(() => { watch.textContent = '' })
    sheetBody.append(topSlot, recent, assets, watch)
  })
  must('#cc-sheet-back').addEventListener('click', closeSheet)
  railToggle.addEventListener('click', () => { const opening = document.body.classList.contains('rail-shut'); if (opening) journeyStep('menu_open'); setCC(opening) })
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
  const goalGoKey = document.createElement('span'); goalGoKey.className = 'goal-go'; goalGoKey.textContent = 'Go'; goalGoKey.setAttribute('aria-hidden', 'true')
  goal.append(goalKick, goalText, goalSub, goalGoKey)
  document.body.append(goal)
  let goalGo = ''
  const runStep = (go: string) => {
    if (go === 'mentor') {
      mentor.undismiss()
      if (interiors.inside) leaveRoom()
      if (Math.hypot(pos.x, pos.z + 40.4) < 4) { firstOpened = true; mentor.start(nextMission() ?? 'internet') }
      else { firstOpened = false; travelHook('Campus', false) }
      return
    }
    if (go.startsWith('career:')) { window.dispatchEvent(new CustomEvent('gd:career', { detail: go.slice(7) })); return }
    if (go.startsWith('course:')) { window.dispatchEvent(new CustomEvent('gd:course', { detail: go.slice(7) })); return }
    if (go.startsWith('cert:')) { void import('./certs.ts').then((m) => m.openCertificate(go.slice(5) as SkillId)); return }
    follow(go)
  }
  // Compact Next step: shows for a few seconds, then folds to a small diamond. Tap the diamond to open it,
  // tap the open pill to go. A new step opens it again briefly.
  let goalTimer = 0, goalArmed = false
  // Until the first lesson is passed (and its CV and certificate seen) the pill stays open: it is the guide.
  const coreDone = () => { try { return !needsFirstCourse() && !!localStorage.getItem('gd.cvSeen') && !!localStorage.getItem('gd.certSeen') } catch { return true } }
  const foldGoal = (ms = 5000) => { window.clearTimeout(goalTimer); goalTimer = window.setTimeout(() => { if (coreDone()) goal.classList.add('folded') }, ms) }
  goal.addEventListener('click', () => {
    if (goal.classList.contains('folded')) { goal.classList.remove('folded'); foldGoal(6000); return }
    runStep(goalGo); foldGoal(2500)
  })
  const paintGoal = () => {
    const st = nextStep()
    goalGo = st.go
    let sub = st.sub
    if (st.go === 'mentor' && !interiors.inside) { const d = Math.round(Math.hypot(pos.x, pos.z + 40.4)); if (d > 4) sub = `Campus · ${d} m away` }
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
  // Back from a locked screen or another app: many phones quietly wipe what the GPU drew once (the reflected light
  // every surface gets) without reporting a lost context, and the city came back dark under a bright sky. Draw it
  // again whenever the game returns after a few seconds away, on the next frame (cheap, and only then).
  {
    let hiddenAt = 0
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { hiddenAt = performance.now(); return }
      if (!hiddenAt || performance.now() - hiddenAt < 1500) return
      hiddenAt = 0
      requestAnimationFrame(() => {
        if (renderer.getContext().isContextLost()) return // the restore handler redraws it when the context is back
        refreshGpu('resume'); redrawSoon(); watchBlank()
      })
    })
  }
  // Back from the browser's page cache (some phones keep the page frozen there when the browser is minimised).
  window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted && !renderer.getContext().isContextLost()) { refreshGpu('pageshow'); redrawSoon(); watchBlank() } })
  // Leaving (app switch, closing the tab): note whether the player is at home right now, not up to 2 s ago.
  const noteHome = () => { if (homeRestored) rememberHome(atHome()?.home ?? null) }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') noteHome() })
  window.addEventListener('pagehide', noteHome)
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
  runStepRef = runStep
  // Learn leads the menu: the next lesson (or the first one, with Zahra), with the CV and certificates behind it.
  // Until the first lesson is passed, the Boutique, Trade and Seasons keys wait, so a new player sees the
  // learning path first. They come back on their own with the first pass; nothing is taken away.
  const learnKey = document.getElementById('cc-learn')
  let learnGo = 'mentor'
  const paintLearn = () => {
    const s = getSave(), passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
    const t = document.getElementById('cc-learn-title'), sub = document.getElementById('cc-learn-sub')
    const nextId = nextMission()
    if (!passed.length) { learnGo = 'mentor'; if (t) t.textContent = 'Learn at Campus'; if (sub) sub.textContent = 'Your first lesson · about a minute · it goes on your CV' }
    else if (nextId) { learnGo = `course:${nextId}`; if (t) t.textContent = `Next lesson: ${SKILL_META[nextId].title}`; if (sub) sub.textContent = `${passed.length} passed · each one adds a certificate to your CV` }
    else { learnGo = 'panel:profile'; if (t) t.textContent = 'Every course passed'; if (sub) sub.textContent = 'Your CV and certificates' }
    // Every key shows from the start (Boutique, Trade and Seasons used to wait for the first lesson), and the
    // Learn card is gone from the menu: the Next step pill and Campus lead to lessons.
    for (const id of ['nav-boutique', 'nav-trade', 'nav-seasons']) { const b = document.getElementById(id); if (b) b.hidden = false }
    if (learnKey) learnKey.hidden = true
    const grid = document.querySelector('#nav .cc-grid')
    if (grid) grid.classList.toggle('few', [...grid.querySelectorAll<HTMLElement>('.cc-item')].filter((b) => !b.hidden).length <= 4)
  }
  learnKey?.addEventListener('click', () => runStep(learnGo))
  paintLearn()
  // Daily check-in: many players never found it. When today's reward is ready, a card sits under the next lesson
  // with a Claim key that claims it right there, and the bell carries a reminder. The reward maths is luxury.ts's.
  const streakCard = document.createElement('div')
  streakCard.className = 'cc-card cc-wide'
  streakCard.id = 'cc-streak'
  streakCard.hidden = true
  const streakText = document.createElement('span'); streakText.className = 'cc-learn-text'
  const streakTitle = document.createElement('strong'), streakSub = document.createElement('small')
  streakText.append(streakTitle, streakSub)
  const streakIcon = document.createElement('span'); streakIcon.className = 'cc-circle cc-accent'
  streakIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"/></svg>'
  const claimKey = document.createElement('button'); claimKey.type = 'button'; claimKey.className = 'cc-claim'; claimKey.textContent = 'Claim'
  streakCard.append(streakIcon, streakText, claimKey)
  learnKey?.after(streakCard)
  const streakReward = (st: ReturnType<typeof loginState>) => {
    // Same rule as claimDaily: the streak goes on from yesterday, or starts again at day 1.
    const y = new Date(); y.setDate(y.getDate() - 1)
    const next = st.last === y.toLocaleDateString('en-CA') ? st.streak + 1 : 1
    return { day: next, usd: Math.min(15, 4 + next) }
  }
  const paintStreak = () => {
    const st = loginState()
    streakCard.hidden = !st.claimable || quietStart()
    if (!st.claimable || quietStart()) return
    const r = streakReward(st)
    streakTitle.textContent = `Daily streak · day ${r.day}`
    streakSub.textContent = `Your check-in reward is ready: +$${r.usd} in-game`
    notify('Daily streak reward ready', `Day ${r.day} · +$${r.usd} in-game. Tap to claim it.`, `streak-${new Date().toLocaleDateString('en-CA')}`, 'streak')
  }
  const claimStreak = () => {
    if (!loginState().claimable) { paintStreak(); return }
    claimKey.disabled = true
    const line = claimDaily()
    ui.toast(`Daily streak claimed · ${line}`)
    for (const n of getNotes()) if (!n.read && n.go === 'streak') markRead(n.id)
    try { paintStatus() } catch { /* the balance card repaints on the next open */ }
    claimKey.disabled = false
    paintStreak()
  }
  claimKey.addEventListener('click', (e) => { e.stopPropagation(); claimStreak() })
  window.addEventListener('gd:streak-claim', claimStreak)
  window.addEventListener('gd:revealed', () => window.setTimeout(paintStreak, 2500), { once: true })
  window.setInterval(paintStreak, 60_000) // a new day while playing
  window.setInterval(() => { try { paintLearn() } catch { /* booting */ } }, 2000)
  // Featured this visit: one activity tile in the menu, a different one each session, cycling in order so the
  // same one never shows twice in a row (the last one is kept on this device). Hidden on the first city entry.
  {
    const FEATURES = [
      { id: 'trade', title: 'Trading floor', sub: 'Practice trades with in-game dollars, never real money', go: 'place:Trading floor', icon: '<path d="M4 5v14h16M8 15l3.5-4 3 2.5L19 8"/>' },
      { id: 'campus', title: 'Campus lessons', sub: 'One short lesson adds a certificate to your CV', go: 'panel:learn', icon: '<path d="M3 8.5 12 5l9 3.5-9 3.5-9-3.5Zm3 2.2V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.3"/>' },
      { id: 'beach', title: 'The beach', sub: 'Take the metro south to the sand and the sea', go: 'place:Beach', icon: '<circle cx="12" cy="8" r="3.2"/><path d="M3 17c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 21c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0"/>' },
      { id: 'wardrobe', title: 'Wardrobe', sub: 'Everyday looks are free: try one on', go: 'panel:boutique', icon: '<path d="M6 7h12l-1 13H7L6 7Zm3 0a3 3 0 0 1 6 0"/>' },
      { id: 'mcgrind', title: 'McGrind job', sub: 'Work a shift at the counter for in-game pay', go: 'place:McGrind', icon: '<path d="M5 10h14l-1.5 9h-11L5 10Zm2-4h10l1 4H6l1-4Z"/>' },
    ]
    let pick = FEATURES[0]!
    try {
      const now = sessionStorage.getItem('gd.featured.now')
      const held = FEATURES.find((f) => f.id === now)
      if (held) pick = held
      else {
        const last = FEATURES.findIndex((f) => f.id === localStorage.getItem('gd.featured.last'))
        pick = FEATURES[(last + 1) % FEATURES.length]!
        sessionStorage.setItem('gd.featured.now', pick.id); localStorage.setItem('gd.featured.last', pick.id)
      }
    } catch { /* private mode: the trading floor */ }
    const card = document.createElement('button')
    card.type = 'button'; card.className = 'cc-card cc-wide cc-featured'; card.id = 'cc-featured'
    card.dataset.feature = pick.id
    card.setAttribute('aria-label', `Featured: ${pick.title}. ${pick.sub}`)
    const icon = document.createElement('span'); icon.className = 'cc-circle cc-accent'
    icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${pick.icon}</svg>`
    const text = document.createElement('span'); text.className = 'cc-learn-text'
    text.append(Object.assign(document.createElement('em'), { className: 'cc-feat-eyebrow', textContent: 'Featured this visit' }), Object.assign(document.createElement('strong'), { textContent: pick.title }), Object.assign(document.createElement('small'), { textContent: pick.sub }))
    card.append(icon, text)
    card.addEventListener('click', () => { runStep(pick.go) })
    streakCard.after(card)
  }
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
  // Unread things are hard to miss: a red count on the menu key (notifications and messages together), and a
  // banner that slides in when notifications arrive (once per visit for what was already waiting). Tap it to open.
  const menuCount = document.createElement('span'); menuCount.className = 'cc-count'; menuCount.hidden = true; railToggle.append(menuCount)
  let banner: HTMLElement | null = null, bannerTimer = 0, seenUnread = -1
  const openNotes = () => { setCC(true); openSheet('Notifications', renderNotes) }
  // Calm: the banner waits until nothing else is on screen (a panel, a menu sheet, Zahra's card), then shows
  // for five seconds. It never lands on top of something the player is reading.
  let bannerWait = 0
  const showBanner = (n: number) => {
    const busy = document.body.classList.contains('sheet-open') || document.body.classList.contains('cc-sheet-on') || document.body.classList.contains('mentor-on') || !!document.getElementById('cert-dlg') || !!document.getElementById('gd-modal')
    if (busy) { window.clearTimeout(bannerWait); bannerWait = window.setTimeout(() => { const now = unreadCount(); if (now > 0) showBanner(now) }, 4000); return }
    banner?.remove(); window.clearTimeout(bannerTimer)
    const first = getNotes().find((x) => !x.read)
    const b = document.createElement('button'); b.type = 'button'; b.className = 'note-banner'
    b.setAttribute('aria-label', `${n} new notification${n === 1 ? '' : 's'}. Open them.`)
    const bell = el('span', '🔔', 'nb-bell')
    const text = el('span', '', 'nb-text')
    text.append(el('b', n === 1 ? '1 new notification' : `${n > 9 ? '9+' : n} new notifications`), el('span', first?.title ?? 'Tap to see what is new', 'nb-line'))
    const go = el('span', 'Open', 'nb-go')
    b.append(bell, text, go)
    b.onclick = () => { b.remove(); banner = null; openNotes() }
    document.body.append(b); banner = b
    requestAnimationFrame(() => b.classList.add('in'))
    bannerTimer = window.setTimeout(() => { b.classList.remove('in'); window.setTimeout(() => { b.remove(); if (banner === b) banner = null }, 400) }, 5000)
  }
  // Prayer reminders (prayer.ts, opt-in on the Masjid card): the same banner, with the crescent; tap for the times.
  startPrayerReminders((title, line) => {
    banner?.remove(); window.clearTimeout(bannerTimer); banner = null
    const b = document.createElement('button'); b.type = 'button'; b.className = 'note-banner pt-banner'
    b.setAttribute('aria-label', `${title}. Open prayer times.`)
    const icon = el('span', '', 'nb-bell'); icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.2A8.5 8.5 0 1 0 20.8 15 7 7 0 0 1 15.5 3.2Z"/></svg>'
    const text = el('span', '', 'nb-text'); text.append(el('b', title), el('span', line, 'nb-line'))
    b.append(icon, text, el('span', 'Times', 'nb-go'))
    b.onclick = () => { b.remove(); ui.open('prayertimes') }
    document.querySelector('.pt-banner')?.remove()
    document.body.append(b)
    requestAnimationFrame(() => b.classList.add('in'))
    window.setTimeout(() => { b.classList.remove('in'); window.setTimeout(() => b.remove(), 400) }, 15000)
  })
  window.setInterval(() => {
    const n = unreadCount()
    const msgUnread = must('#msg-btn').classList.contains('unread')
    const total = quietStart() ? 0 : n + dmUnread()
    menuCount.hidden = total === 0
    menuCount.textContent = total > 9 ? '9+' : String(total)
    dot.hidden = total > 0 || !msgUnread
    bellBadge.hidden = n === 0 || quietStart()
    bellBadge.textContent = n > 9 ? '9+' : String(n)
    must('#cc-msg').classList.toggle('has-unread', msgUnread || dmUnread() > 0)
    // The banner: only in the open city (not over the menu, a panel, the title, a selfie or a skit).
    const clear = performance.getEntriesByName('gd:revealed').length > 0 && document.body.classList.contains('rail-shut') && !ui.isOpen() && ccSheet.hidden
      && !document.body.classList.contains('selfie-mode') && !document.body.classList.contains('drone-mode') && !document.body.classList.contains('glass-mode') && !document.getElementById('sk-bar') && !document.querySelector('.mentor:not([hidden])')
    // A prayer reminder on screen keeps its place; the notifications banner waits for it to go.
    if (!clear || document.querySelector('.pt-banner') || quietStart()) return
    if (n > 0 && (seenUnread < 0 || n > seenUnread)) showBanner(n)
    seenUnread = n
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
  // The pill shows players active today (from the city stats), never fewer than are online this minute.
  // The pill shows everyone who has ever opened the game (once per browser); until that count loads, the
  // players active today, and never fewer than are online this minute.
  let activeToday = 0
  let visitorsAll = 0
  const paintChip = () => {
    const n = Math.max(visitorsAll || activeToday, onlineNow)
    onlineChip.textContent = String(n)
    onlineChip.setAttribute('aria-label', visitorsAll ? `${n} visitors all time, ${onlineNow} online now` : `${n} active today, ${onlineNow} online now`)
    onlineChip.title = `${visitorsAll ? `${n} visitors all time` : `${n} active today`} · ${onlineNow} in the city right now. Tap for city stats.`
  }
  // Tap: city stats under the pill. Stays open and refreshes on its own until you close it.
  const onlineCard = document.createElement('div'); onlineCard.id = 'online-card'; onlineCard.hidden = true
  onlineCard.setAttribute('role', 'dialog'); onlineCard.setAttribute('aria-label', 'City stats')
  let onlineCardTimer = 0
  let lastStats: PublicStats | null = null
  const closeOnlineCard = () => {
    onlineCard.hidden = true
    document.body.classList.remove('online-open')
    window.clearInterval(onlineCardTimer)
    onlineCardTimer = 0
  }
  // A card, not a long list: three headline figures, then short sections of tiles, the small print folded away.
  const paintOnlineCard = (st: PublicStats | null) => {
    const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = '') => { const e = document.createElement(tag); e.className = cls; if (text) e.textContent = text; return e }
    const card = statsCard(st, onlineNow)
    const head = mk('div', 'sc-head')
    const words = mk('div', 'sc-words'); words.append(mk('p', 'stat-title', 'City stats'), mk('span', 'sc-sub', 'Totals since launch'))
    head.append(words, mk('span', 'sc-live', `${card.online} online`))
    const tile = (t: { label: string; value: string; sub?: string }, big = false) => { const d = mk('div', big ? 'sc-tile sc-big' : 'sc-tile'); d.append(mk('b', '', t.value), mk('span', '', t.label)); if (t.sub) d.append(mk('small', '', t.sub)); return d }
    const nodes: HTMLElement[] = [head]
    if (card.hero.length) { const hero = mk('div', 'sc-hero'); hero.append(...card.hero.map((t) => tile(t, true))); nodes.push(hero) }
    for (const sec of card.sections) {
      const box = mk('section', sec.kind === 'chain' ? 'sc-sec sc-chain' : 'sc-sec'); const grid = mk('div', 'sc-grid')
      grid.append(...sec.tiles.map((t) => tile(t)))
      const h = mk('h4', '', sec.title)
      // Base's blue disc and NEAR's N, beside the on-chain heading.
      if (sec.kind === 'chain') { const marks = mk('span', 'sc-marks'); marks.innerHTML = '<svg viewBox="0 0 40 20" aria-hidden="true"><circle cx="9" cy="10" r="9" fill="#0052ff"/><rect x="3" y="8.5" width="9" height="3" fill="#fff"/><rect x="21" y="1" width="18" height="18" rx="4.5" fill="#f7f3ea"/><path d="M25.5 15V5l9 10V5" fill="none" stroke="#0b100d" stroke-width="2.2" stroke-linejoin="round"/></svg>'; h.prepend(marks) }
      box.append(h, grid)
      nodes.push(box)
    }
    if (card.note) { const d = mk('details', 'sc-note'); d.append(mk('summary', '', 'About these numbers'), mk('p', 'stat-note', card.note)); nodes.push(d) }
    const who = mk('button', 'stat-players', 'See who is online · invite them home') as HTMLButtonElement; who.type = 'button'
    who.onclick = () => { closeOnlineCard(); window.dispatchEvent(new Event('gd:players')) }
    // Share the numbers as a picture card (logo, live figures, a call to play and a QR code).
    const share = mk('button', 'stat-share', 'Share the city stats') as HTMLButtonElement; share.type = 'button'
    share.onclick = () => {
      share.disabled = true; share.textContent = 'Making the picture…'
      void Promise.all([import('./shareArt.ts'), import('./sharePicture.ts')]).then(async ([A, S]) => {
        if (!lastStats) await loadOnlineStats()
        const canvas = await A.statsShareArt(lastStats)
        const cap = statsCaption(lastStats)
        await S.sharePicture({ canvas, name: 'grind-district-city-stats', heading: 'Share the city stats', text: cap.short, caption: cap.full, url: `${S.SITE}/s/stats`, toast: (m) => ui.toast(m) })
      }).catch(() => ui.toast('Sharing is not available just now.')).finally(() => { share.disabled = false; share.textContent = 'Share the city stats' })
    }
    nodes.push(share, who)
    onlineCard.replaceChildren(...nodes)
  }
  const loadOnlineStats = async () => {
    const raw = await fetch('/api/track?op=stats').then((r) => r.ok ? r.json() : null).catch(() => null)
    const st = isPublicStats(raw) ? raw : lastStats
    if (isPublicStats(raw)) garden.set(raw.lessonsPassed, raw.certificates)
    if (st) { lastStats = st; activeToday = st.activeToday; visitorsAll = st.visitorsAll ?? 0; paintChip() }
    if (!onlineCard.hidden) paintOnlineCard(st)
  }
  const openOnlineCard = () => {
    paintOnlineCard(lastStats)
    onlineCard.hidden = false
    document.body.classList.add('online-open')
    void loadOnlineStats()
    window.clearInterval(onlineCardTimer)
    onlineCardTimer = window.setInterval(() => {
      if (onlineCard.hidden || !document.body.classList.contains('rail-shut')) { closeOnlineCard(); return }
      void loadOnlineStats()
    }, 45_000)
  }
  onlineChip.onclick = () => { if (!onlineCard.hidden) closeOnlineCard(); else openOnlineCard() }
  document.addEventListener('pointerdown', (event) => {
    if (onlineCard.hidden) return
    const t = event.target as Node | null
    if (!t || onlineCard.contains(t) || onlineChip.contains(t)) return
    closeOnlineCard()
  })
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !onlineCard.hidden) { event.preventDefault(); closeOnlineCard() }
  })
  document.querySelector('#hud header')?.append(onlineChip)
  // Today's count loads a little after the city opens, then every ten minutes.
  window.setTimeout(() => { void loadOnlineStats(); window.setInterval(() => { if (!document.hidden) void loadOnlineStats() }, 600_000) }, 6000)
  document.body.append(onlineCard)
  performance.mark('gd:pre-net')
  // Grind Market (market.ts): your stall sells while you play; online players see it and can buy.
  const market = createMarket({ toast: (m) => ui.toast(m), myName: () => getSave().name || getSave().username || 'Trader', inMarket: () => interiors.inside === 'market' })
  const buyFood = (usd: number, label: string, detail: string, fill: Partial<Record<'hunger' | 'energy' | 'social', number>>) => {
    const r = spendInGame(usd, label, detail)
    if (!r.ok) { ui.toast(r.message); return }
    ui.toast(adjustNeeds(fill, 'now') || `${label}. Fed and ready.`)
  }
  const net = createNet({
    scene,
    me: identity(),
    onVisit: (v) => void import('./players.ts').then((m) => m.showVisitInvite(v, () => acceptVisit(v))),
    onMarket: (m) => market.receive(m),
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
      paintChip()
      if (!onlineCard.hidden) paintOnlineCard(lastStats)
    },
  })
  market.attach({ send: (m) => net.market(m), id: () => net.id() })

  void import('./voice.ts').then((m) => m.mountVoice(chat, net, (t) => ui.toast(t), () => {
    if (!interiors.inside) return 'Voice notes are off on the street. Step inside a room to record.'
    if (import.meta.env.VITE_VOICE_NOTES !== '1') return 'Voice notes open soon.'
    return null
  }))
  setPresence({ find: (u) => net.findPeer(u) })
  // Rooms (net.ts): who you can see. The city, a shared venue, or one person's own home: your house on the home
  // row, or a home you own. Visiting someone keeps you in their room until you leave.
  const PRIVATE_HOMES = new Set(['duplex', 'mansion', 'penthouse', 'skyhouse'])
  const HOME_LABEL: Record<string, string> = { house: 'home', duplex: 'garden duplex', mansion: 'hillside mansion', penthouse: 'crown penthouse', skyhouse: 'sky house' }
  let visiting: { room: string; kind: string } | null = null
  let homeRestored = false // the saved home spot is not overwritten until the restore has run
  const hostKey = () => { const u = getSave().username; return u && u !== 'guest' ? u : `guest-${net.id().slice(0, 8)}` }
  const myRoom = (): string => {
    if (interiors.inside === 'house') return visiting?.kind === 'house' ? visiting.room : `house:${hostKey()}`
    if (interiors.inside) return `room:${interiors.inside}`
    const hi = homes?.inside
    if (hi && PRIVATE_HOMES.has(hi)) return visiting?.kind === hi ? visiting.room : `home:${hi}:${hostKey()}`
    if (hi) return `area:${hi}`
    return ''
  }
  const atHome = () => {
    const r = myRoom()
    if (visiting || !(r.startsWith('house:') || r.startsWith('home:'))) return null
    const kind = interiors.inside === 'house' ? 'house' : homes!.inside!
    return { room: r, home: kind, label: HOME_LABEL[kind] ?? 'home' }
  }
  const acceptVisit = (v: { room: string; home: string; from: string }) => {
    if (ride?.driving) { ui.toast('Park the car first, then accept again.'); return }
    if (homes?.inside) { ui.toast('Leave where you are first, then accept the invite.'); return }
    if (v.home === 'house') {
      if (interiors.inside && interiors.inside !== 'house') leaveRoom()
      const door = world.hotspots.find((h) => h.id === 'yours')
      if (!door) return
      visiting = { room: v.room, kind: 'house' }
      if (interiors.inside !== 'house') enterRoom(door)
      ui.toast(`You are at @${v.from}'s home.`)
    } else if (PRIVATE_HOMES.has(v.home)) {
      if (interiors.inside) leaveRoom()
      visiting = { room: v.room, kind: v.home }
      void enterHome(v.home as AreaId, true).then(() => ui.toast(`You are at @${v.from}'s ${HOME_LABEL[v.home]}.`))
    }
  }
  const openPlayersPanel = () => { setCC(false); void import('./players.ts').then((m) => m.openPlayers({
    me: () => ({ username: getSave().username, signedIn: !!localStorage.getItem('gd.privy.username') }),
    players: () => net.players(), online: () => net.online(), myRoom, atHome,
    invite: (u, v) => net.invite(u, v),
    profile: (u) => { setCC(true); void openProfile(u) },
    message: (u) => { setCC(true); void openThread(u) },
    find: (u) => { const at = net.findPeer(u); if (at) window.dispatchEvent(new CustomEvent('gd-find', { detail: { u, x: at.x, z: at.z } })); else ui.toast(`@${u} is somewhere else right now.`) },
    toast: (t) => ui.toast(t),
    dance: () => { if (seating.sitting) seating.stand(); setDance(true); ui.toast('Dancing · move to stop') },
    pic: (u, name, size, here) => playerPic(u, name, size, here),
  })) }
  document.getElementById('nav-players')?.addEventListener('click', openPlayersPanel)
  window.addEventListener('gd:players', openPlayersPanel)
  // Dance: started from the Players panel (it used to be a key that sat on screen the whole time), any move stops
  // it. Everyone in the room sees it (net.ts emote), and skits film it.
  let dancing = false
  const setDance = (on: boolean) => {
    if (dancing === on) return
    dancing = on
    avatar.object.userData.dance = on ? 1 : 0
    if (on) { target = null; personaNote('dance') }
  }
  // Tapped city resident: a small card (name, persona, what they are doing). Auto-hides; never blocks play.
  const showNpcCard = (n: { name: string; trait: string; routine: string; doing: string }) => {
    npcCard?.remove()
    const c = document.createElement('div'); c.id = 'npc-card'; c.setAttribute('role', 'status')
    const h = document.createElement('strong'); h.textContent = `${n.name} · ${n.trait}`
    const d = document.createElement('div'); d.className = 'npc-doing'; d.textContent = n.doing
    // Career mentors say so on the card: tap them for a tip and the lesson they would set you next.
    void import('./residentProfile.ts').then((rp) => { const label = rp.mentorLabel(n.trait); if (label && c.isConnected) { const m = document.createElement('div'); m.className = 'npc-mentor'; m.textContent = `${label} · tap them for a tip`; h.after(m) } })
    const r = document.createElement('div'); r.className = 'npc-routine'; r.textContent = n.routine
    c.append(h, d, r); c.onclick = () => { c.remove(); if (npcCard === c) npcCard = null }
    // Friendship and the resident's own wallet (town.ts): say hello once a day, or bring a small gift.
    let hide = window.setTimeout(() => { c.remove(); if (npcCard === c) npcCard = null }, 6000)
    void import('./town.ts').then((town) => {
      if (!c.isConnected) return
      const f = document.createElement('div'); f.className = 'npc-friend'; f.textContent = town.friendLine(n.name)
      const row = document.createElement('div'); row.className = 'npc-acts'
      const act = (label: string, run: () => { ok: boolean; message: string }) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label
        b.onclick = (e) => {
          e.stopPropagation()
          // One action at a time: both keys rest while one runs (a quick second tap does nothing).
          if (row.dataset.busy === '1') return
          row.dataset.busy = '1'
          const keys = [...row.querySelectorAll('button')]
          for (const k of keys) k.disabled = true
          const label0 = b.textContent
          b.textContent = '…'
          const out = run(); ui.toast(out.message); f.textContent = town.friendLine(n.name)
          window.setTimeout(() => { delete row.dataset.busy; for (const k of keys) k.disabled = false; b.textContent = out.ok ? `${label0} ✓` : label0; if (out.ok) b.disabled = true }, 1800)
          window.clearTimeout(hide); hide = window.setTimeout(() => { c.remove(); if (npcCard === c) npcCard = null }, 4000)
        }
        return b
      }
      row.append(act('Say hello', () => town.hello(n.name)), act('Gift · $10', () => town.gift(n.name)))
      c.append(f, row)
    })
    document.body.append(c)
    npcCard = c
  }
  // Guests: after the first reward or purchase, offer to save progress to an account (once per session);
  // on leaving with progress, the browser asks to confirm. Signed-in players sync their save every minute.
  {
    // Already loaded: no await here (an await let a queue of other work run before the city could open).
    const st = { onActivity, isAccountBound }
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
  // Player pictures for chats and profiles: their picked character, head and shoulders, drawn once each (one at a
  // time, so a long inbox never stalls the city) and kept for the visit.
  {
    const shots = new Map<string, Promise<string | null>>()
    let line: Promise<unknown> = Promise.resolve()
    setPortraitMaker((c) => {
      const key = JSON.stringify(c)
      let p = shots.get(key)
      if (!p) {
        p = line.then(() => new Promise<string | null>((done) => {
          let g: THREE.Group | null = null
          const finish = (url: string | null) => { if (g) { g.removeFromParent(); releaseHuman(g) } done(url) }
          const timer = window.setTimeout(() => finish(null), 15000)
          g = posedHuman(c.m as HumanModel, { pose: 'stand', look: c.l as Look, height: c.h, detail: 0.5, onReady: () => {
            window.clearTimeout(timer)
            // In the scene for this one shot, so it gets the city's reflected light; out again in the same moment.
            g!.position.set(0, -500, 0); scene.add(g!)
            let url: string | null = null
            try { url = createPortrait(renderer, () => g!, { w: 256, h: 256, head: true, headY: c.h * 0.89 })() } catch { url = null }
            finish(url)
          } })
        }))
        line = p
        shots.set(key, p)
      }
      return p
    })
  }
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
  // Tapped resident: their public profile (full-body shot, who they are, what they study, how well you know them).
  const openResident = (n: CrowdInfo) => {
    npcCard?.remove(); npcCard = null
    peerTarget = n.object
    let shot: string | null = null
    try { shot = peerShot() } catch { shot = null } finally { peerTarget = null }
    void import('./residentProfile.ts').then((m) => m.openResidentProfile(n, {
      shot, toast: (t) => ui.toast(t),
      friend: () => import('./town.ts').then((town) => ({ level: town.LEVELS[town.levelOf(n.name)] ?? 'Stranger', hello: () => town.hello(n.name), gift: () => town.gift(n.name) })),
    }))
  }
  void showNpcCard
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
  let moveBasisYaw: number | null = null // phones: the walk direction is held while the stick is held (see update)
  // Swimming (see the pool block in update): state, and the swimwear chosen in the Boutique (gd.swimwear).
  let swimming = false, swimMove = 0, swimY = 0, swimPosed = false, outOfWater = 0
  let swimSaved: Record<string, unknown> | null = null
  const swimwearOn = () => {
    const apply = avatar.object.userData.applyLook as ((l: Record<string, unknown>) => void) | undefined
    const cur = avatar.object.userData.look as Record<string, unknown> | undefined
    if (swimSaved || !apply || !cur) return
    swimSaved = cur
    let w: { kind?: string; color?: number; color2?: number } = {}
    try { w = JSON.parse(localStorage.getItem('gd.swimwear') ?? '{}') as typeof w } catch { /* default */ }
    const color = typeof w.color === 'number' ? w.color : 0x1f6fb2
    const second = w.kind === 'set' ? (typeof w.color2 === 'number' ? w.color2 : 0x1c2230) : color
    apply({ ...cur, top: color, bottom: second, shoes: 0x1c2230, robe: false, figure: undefined })
  }
  const swimwearOff = () => {
    const apply = avatar.object.userData.applyLook as ((l: Record<string, unknown>) => void) | undefined
    if (swimSaved && apply) apply(swimSaved)
    swimSaved = null
  }
  let faceYaw = Math.PI
  let stillFor = 0
  let camPitch = 0.42
  // Zoom range. Close enough to frame the face (was 3.2 m); not below cameraBoom's MIN_BOOM (1.15 m), so the camera never pokes into the head.
  const CAM_ZMIN = 1.2, CAM_ZMAX = 12
  let camDist = 5.6
  let camDistGoal = camDist
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
    travelTo(spot, () => enterRoom(spot))
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
    // M opens the map on its own: shut the menu first so the map does not open on top of it.
    if (event.key === 'm' || event.key === 'M') { if (!document.body.classList.contains('rail-shut')) setCC(false); must<HTMLButtonElement>('#nav-city').click() }
  })
  let busyFor = 0
  let busyTotal = 0
  let actTitle = ''
  let actEl: HTMLElement | null = null
  let actShown = ''
  const actClock = (title: string, left: number, total: number) => {
    if (!title) {
      const e = actEl; actEl = null; actShown = ''
      if (e) { e.classList.remove('in'); window.setTimeout(() => e.remove(), 300) }
      return
    }
    if (!actEl) {
      actEl = document.createElement('div'); actEl.className = 'act-clock'; actEl.setAttribute('role', 'timer')
      actEl.innerHTML = '<span class="ac-ring"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle class="ac-fill" cx="18" cy="18" r="15"/></svg></span><span class="ac-t"><b></b><small></small></span>'
      document.body.append(actEl)
      const e = actEl; requestAnimationFrame(() => e.classList.add('in'))
    }
    const secs = Math.max(0, Math.ceil(left))
    const key = `${title}|${secs}`
    if (key === actShown) return
    actShown = key
    actEl.querySelector('b')!.textContent = title
    actEl.querySelector('small')!.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} left`
    const fill = actEl.querySelector<SVGCircleElement>('.ac-fill')!, c = 2 * Math.PI * 15
    fill.style.strokeDasharray = `${c}`
    fill.style.strokeDashoffset = `${c * (1 - Math.min(1, Math.max(0, left / Math.max(0.01, total))))}`
  }
  let exitCooldown = 0
  performance.mark('gd:ui-net')
  const interiors = createInteriors(scene, {
    player: () => pos,
    rankIndex: () => RANKS.findIndex((r) => r.id === rankFor(getSave().xp).id),
    toast: (text) => ui.toast(text),
    openPanel: (panel) => ui.open(panel),
    onLook: () => applyLook(),
    busy: (seconds, x, z, yaw) => {
      // Get up first: an action started from a chair or the bed is done standing.
      if (seating.sitting) seating.stand()
      busyFor = seconds
      busyTotal = seconds
      pos.x = x
      pos.z = z
      faceYaw = yaw
      // Face the counter by turning the body, as walking does. (This used to turn the whole figure and never turned
      // it back, so after cooking, a shower or the stairs the player walked sideways or backward.) Twice: the second
      // call settles the lean the first big turn would leave.
      for (let i = 0; i < 2; i++) avatar.face(Math.sin(yaw), Math.cos(yaw), 1, true)
    },
    sit: (s) => sitOn(s),
    openCareer: (tab) => { setCC(true); openCareer(tab) },
    shift: () => void import('./mcgrind.ts').then((m) => m.openShift({ toast: (t) => ui.toast(t) })),
    eatMeal: () => buyFood(4, 'McGrind meal', 'A burger, fries and a drink.', { hunger: 55, energy: 6 }),
    snack: () => buyFood(2, 'Market snack', 'Something hot from a trader.', { hunger: 22 }),
    bank: (tab) => void import('./bank.ts').then((m) => m.openBank({ tab, toast: (t) => ui.toast(t) })),
    dine: () => buyFood(5, 'Dinner at Barakah Club', 'Shared with friends at the table.', { hunger: 55, social: 15 }),
    wellness: (room) => ui.open(room),
    market,
    openCerts: () => ui.open('profile'),
  })
  // Sitting: move onto the seat, hold still, pose the rig; any stick, key or tap stands up.
  const seating = createSeating()
  standUp = () => { if (seating.sitting) seating.stand() }
  const sitOn = (s: Seat) => {
    // One person per seat: a resident already sitting there keeps it.
    if (crowd.occupied(s.x, s.z)) { ui.toast('Someone is sitting there. Try another seat.'); return }
    seating.sit(s, avatar.object)
    if (!seating.sitting) return
    pos.x = s.x
    pos.z = s.z
    vel.x = 0
    vel.z = 0
    target = null
    faceYaw = s.yaw
  }
  // A bench seats two or three: take the free place nearest to you (tap again on yours to stand up).
  const sitBench = (slots: Seat[]) => {
    const mine = seating.sitting && slots.find((q) => Math.hypot(q.x - seating.sitting!.x, q.z - seating.sitting!.z) < 0.05)
    if (mine) { seating.stand(); return }
    const free = pickBenchSlot(slots, (x, z) => crowd.occupied(x, z), pos.x, pos.z)
    if (!free) { ui.toast('Bench is full. Try another one.'); return }
    sitOn(free)
  }
  // Zahra at the Campus steps: walk up (or tap her) and she introduces herself, any time.
  const zahraSpot: Hotspot = { id: 'zahra', x: ada.position.x, z: ada.position.z, r: 1.9, title: 'Zahra', body: 'Campus guide · onboarding', enter: 'Talk to Zahra', use: () => mentor.hello() }
  const streetSpots: Hotspot[] = [zahraSpot, ...world.hotspots, ...[...plazaSeats().map((s) => ({ s, len: PLAZA_BENCH_LEN })), ...ambient.benchSeats.map((s) => ({ s, len: STREET_BENCH_LEN }))].map(({ s, len }, i) => seatSpot(`bench-${i}`, 'Bench', s, () => sitBench(benchSlots(s, len)))),
    ...workoutSpots().map((s, i) => ({ ...seatSpot(`workout-${i}`, 'Workout spot', s, sitOn), body: 'Do a few squats. Move to stop.', enter: 'Exercise' }))]
  // Grind Ring kiosk: stand at the front of the counter to order tea or coffee, or take a free stool.
  const freeStools = () => kioskSeats().filter((s) => !crowd.occupied(s.x, s.z))
  // Graduation, by the Campus steps: progress until every Campus course is passed, then the ceremony.
  // Every side of every house on the row answers, not only the door: walk up to any wall and you can ring the
  // bell (or go home), and you are let in through the front door.
  for (const home of HOUSES) {
    const sides: Array<[string, number, number]> = [['nx', -1, 0], ['px', 1, 0], ['nz', 0, -1], ['pz', 0, 1]]
    for (const [side, sx, sz] of sides) {
      if (side === home.door) continue
      const x = home.x + sx * (home.w / 2 + 1.1), z = home.z + sz * (home.d / 2 + 1.1)
      streetSpots.push({ id: `${home.id}-side-${side}`, x, z, r: 1.8, title: home.spotTitle, body: `${home.body} The front door is round the ${home.door === 'nx' ? 'west' : home.door === 'px' ? 'east' : home.door === 'nz' ? 'north' : 'south'} side.`, enter: home.id === 'yours' ? 'Go inside' : 'Ring the bell', use: () => { const door = world.hotspots.find((h) => h.id === home.id); if (door) enterRoom(door) } })
    }
  }
  // Share any poster in the city: walk up to it and tap Share poster. The picture goes with the post (share.ts).
  const shareFlyer = (id: string) => {
    void Promise.all([import('./posters.ts'), import('./shareArt.ts'), import('./sharePicture.ts')]).then(async ([P, A, S]) => {
      const f = P.flyerById(id); if (!f) return
      const canvas = await A.flyerShareArt(f)
      const cap = P.flyerCaption(f)
      await S.sharePicture({ canvas, name: `grind-district-${f.id}`, heading: 'Share this poster', text: cap.short, caption: cap.full, url: `${S.SITE}/p/${f.id}`, toast: (m) => ui.toast(m) })
    }).catch(() => ui.toast('Sharing is not available just now.'))
  }
  flyerSpots.forEach((f, i) => streetSpots.push({ id: `share-flyer-${i}`, x: f.x, z: f.z, r: 1.25, title: 'McGrind poster', body: 'McGrind is hiring. Share this poster: the picture goes with your post.', enter: 'Share poster', use: () => shareFlyer(f.flyer) }))
  streetSpots.push({ id: 'graduation', x: 4.6, z: -41.2, r: 1.4, title: 'Graduation 🎓', body: 'Pass every course in the six Campus worlds to graduate: cap and gown, your name called, the diploma from Zahra.', enter: 'Graduation', use: () => ui.open('diploma') })
  window.addEventListener('gd:graduated', () => { notify('Graduate 🎓', 'Diploma in Web3 Foundations. Download it or share it from Graduation.', 'graduated', 'panel:diploma'); window.setTimeout(() => ui.open('diploma'), 4200) })
  // Unit 4, the labelled agent, has a job: walk up (it stops and turns to you) and ask it about agents.
  const unitSpot: Hotspot = { id: 'unit4', x: 10.1, z: 7.6, r: 1.9, title: 'Unit 4 · labelled agent', body: 'The city\u2019s labelled agent. Ask it what agents are and which are in the city now.', enter: 'Ask Unit 4', use: () => ui.open('robot') }
  streetSpots.push(unitSpot)
  window.setInterval(() => { const at = crowd.robotAt(); unitSpot.x = at.x; unitSpot.z = at.z }, 250)
  streetSpots.push({ id: 'kiosk', x: 0, z: 3.15, r: 1.5, title: 'Grind Ring kiosk', body: 'Welcome to Grind. Tea or coffee?', enter: 'Order', use: () => {
    const line = SERVER_LINES[Math.floor(Math.random() * SERVER_LINES.length)]!
    speak(line, { gender: 'm', seed: 7 }); sayLine('server', line)
    ui.open('kiosk')
  } })
  // The drink you ordered is set on the counter in front of you (or your stool) for a minute.
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.6 })
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1f5a4c, roughness: 0.8 })
  const teaMat = new THREE.MeshStandardMaterial({ color: 0xd8efe6, roughness: 0.15, transparent: true, opacity: 0.7 })
  let servedCup: THREE.Group | null = null
  let cupTimer = 0
  const serveCup = (label: string) => {
    if (servedCup) { scene.remove(servedCup); servedCup = null }
    const g = new THREE.Group()
    if (/tea/i.test(label)) {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12), teaMat))
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), sleeveMat); leaf.position.y = 0.05; g.add(leaf)
    } else {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.12, 12), cupMat))
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.036, 0.04, 12), sleeveMat); sleeve.position.y = -0.005; g.add(sleeve)
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 12), sleeveMat); lid.position.y = 0.065; g.add(lid)
    }
    g.children[0]!.position.y = 0
    g.position.set(THREE.MathUtils.clamp(pos.x, -1.3, 1.3), 1.31 + 0.06, 1.12)
    g.traverse((o) => { o.castShadow = true; o.userData.ghost = true })
    scene.add(g)
    servedCup = g
    cupTimer = 60
  }
  let streetDoor = { x: 0, z: 0 }
  // The first visit to a room builds it (walls, furniture, people) and its shaders: on a phone that is a freeze of
  // a second or more. So the screen fades to black first, the room is built and its shaders prepared behind it,
  // and then it fades in. Later visits are instant.
  let roomBusy = false
  let autoSitHold: { x: number; z: number } | null = null, autoSitStill = 0
  /** Prepare the shaders for one place and the player (lit and fogged as the scene is now), not the whole city. */
  const prepareShaders = async (place: THREE.Object3D | null): Promise<void> => {
    try {
      const jobs = [renderer.compileAsync(avatar.object, camera, scene)]
      if (place) jobs.push(renderer.compileAsync(place, camera, scene))
      await Promise.all(jobs)
    } catch { /* drawn on first sight instead */ }
  }
  const enterRoom = (doorSpot: Hotspot) => {
    const room = interiors.roomFor(doorSpot.id)
    if (!room) return false
    if (roomBusy) return true
    if (interiors.isBuilt(room)) return stepInto(doorSpot, room)
    roomBusy = true
    const veil = document.createElement('div'); veil.className = 'room-fade'; document.body.append(veil)
    requestAnimationFrame(() => veil.classList.add('on'))
    const done = () => { veil.classList.remove('on'); window.setTimeout(() => veil.remove(), 320); roomBusy = false }
    window.setTimeout(() => {
      const t0 = performance.now()
      try { stepInto(doorSpot, room) } catch (e) { console.warn('[grind] room', e); done(); return }
      const t1 = performance.now()
      // Only the room and the player need shaders made for indoors (no street fog in here). Compiling the whole
      // scene re-made every city material's indoor version too: three seconds and more of black on a phone.
      void Promise.race([prepareShaders(interiors.group(room)), new Promise((r) => window.setTimeout(r, 1200))]).then(() => {
        if (import.meta.env.DEV) ((window as unknown as { __roomTimes?: unknown[] }).__roomTimes ??= []).push({ room, build: Math.round(t1 - t0), compile: Math.round(performance.now() - t1) })
        done()
      })
    }, 240)
    return true
  }
  // Which room or area the player is in, on this device only (the save keeps the city spot and the home): the next
  // visit opens there again. Cleared on the way out.
  const noteInside = (v: { k: 'room' | 'home'; id: string } | null) => { try { if (v) localStorage.setItem('gd.lastIn', JSON.stringify({ ...v, at: Date.now() })); else localStorage.removeItem('gd.lastIn') } catch { /* private mode */ } }
  const stepInto = (doorSpot: Hotspot, room: NonNullable<ReturnType<typeof interiors.roomFor>>) => {
    // Get up first: a seat in one place must never carry over (a player left sitting on the floor by a door).
    if (seating.sitting) seating.stand()
    notePlace(room)
    noteInside({ k: 'room', id: doorSpot.id })
    streetDoor = { x: doorSpot.x, z: doorSpot.z }
    const at = interiors.enter(room)
    levelY = 0
    pos.x = at.x
    pos.z = at.z
    vel.x = 0
    vel.z = 0
    target = null
    camYaw = at.yaw + Math.PI
    camDist = camDistGoal = Math.min(camDist, 4.2)
    smoothCam.set(pos.x + Math.sin(camYaw) * 3, 2.6, pos.z + Math.cos(camYaw) * 3)
    camVel.set(0, 0, 0)
    exitCooldown = 1
    return true
  }
  const leaveRoom = () => {
    if (seating.sitting) seating.stand()
    noteInside(null)
    const out = interiors.exit(streetDoor.x, streetDoor.z)
    levelY = 0
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
  // --- Driving and boating (ride.ts, loaded on the first ride). The stick drives; the action button gets out.
  let rideMod: typeof import('./ride.ts') | null = null
  let ride: Ride | null = null
  let rideBusy = false
  let rideCam = { dist: 0, pitch: 0 }
  const rideBlockers: Obstacle[] = []
  const loadRide = () => (rideMod ? Promise.resolve(rideMod) : import('./ride.ts').then((m) => (rideMod = m)))
  const HOME_CAR = { x: 40.4, z: 30.6, heading: Math.PI }
  const DEALER_ROAD = { x: -26, z: 1.6, heading: Math.PI / 2 }
  const HARBOUR = { x: 36, z: -44.6 }
  const RACEWAY_DOOR = { x: -12, z: 53.4 }
  const DRIVABLE = ['cityhatch', 'familysedan', 'saloon', 'tourer', 'evcoupe', 'sportsaloon', 'executive', 'supercar', 'hypercar']
  const drive = createDriveUi((m) => ui.toast(m), (t, cab) => {
    if (!cab) { ui.toast(`You are at ${t}. Tap Get out when you are ready.`); return }
    // A cab drops you at the door and walks you in, as quick travel does.
    window.setTimeout(() => { endRide(); ui.toast(`You are at ${t}. Thanks for riding.`); const then = cabThen; cabThen = null; then?.() }, 500)
  }, {
    // Crowds and stalls right now (only the ones near the car matter to a 1 m grid round it).
    blockers: () => crowdObstacles.filter((b) => !ride || Math.hypot(b.x - ride.x, b.z - ride.z) < 30),
    stuck: (t, cab) => {
      if (!cab) { ui.toast('Auto-drive could not find a way through here. The wheel is yours.'); return }
      // A cab that cannot get through never strands you: the rest of the way is quick travel (the fare is kept).
      const spot = findSpot(t), then = cabThen
      cabThen = null; endRide()
      if (spot) { ui.toast('Traffic is heavy, so the cab took a shortcut.'); quickTravel(spot, then ?? undefined) }
    },
  })
  let cabThen: (() => void) | null = null
  /** Grind Cab and Grind Premium: a chic car pulls up where you stand and drives you to the place you picked. */
  const callCab = async (spot: Hotspot, dest: { x: number; z: number }, tier: 'cab' | 'premium', then?: () => void): Promise<boolean> => {
    // The cab pulls up at the nearest kerb (a short walk), not in the middle of a square full of people.
    const kerb = nearestRoad({ x: pos.x, z: pos.z })
    const pick = Math.hypot(kerb.x - pos.x, kerb.z - pos.z) < 30 ? kerb : { x: pos.x, z: pos.z }
    if (!planRoute(pick, dest, world.obstacles, CITY_LIMIT - 1)) return false
    const fare = tier === 'premium' ? 9 : 4
    const label = tier === 'premium' ? 'Grind Premium' : 'Grind Cab'
    const paid = spendInGame(fare, `${label} ride`, `To ${spot.title}`)
    if (!paid.ok) { ui.toast(`${paid.message} No cab this time: straight there instead.`); return false }
    ui.close(); setCCRef?.(false)
    const first = planRoute(pick, dest, world.obstacles, CITY_LIMIT - 1)?.[1] ?? dest
    await beginRide({ kind: 'car', model: tier === 'premium' ? 'executive' : 'familysedan', cab: tier, label, mode: 'free', temp: true, at: { x: pick.x, z: pick.z, heading: Math.atan2(first.x - pick.x, first.z - pick.z) } })
    if (!ride) return true
    cabThen = then ?? null
    drive.autoTo(spot.title, dest, { x: ride.x, z: ride.z }, world.obstacles, CITY_LIMIT - 1, { label: tier === 'premium' ? 'Premium ride' : 'Cab', stop: () => { cabThen = null; endRide(); ui.toast('Dropped off here. Thanks for riding.') } })
    ui.toast(`${label} is here (${money(fare)}). Sit back: next stop ${spot.title}.`)
    return true
  }
  // Gas, Brake and Horn show while you are at the wheel (a car or the boat), and go when you step out.
  let pedalsShown = false
  window.setInterval(() => {
    const driving = !!(ride && ride.driving)
    // Out of the car (Get out, a cab's Stop, a ride ended): any route it was following ends with it.
    if (!driving && drive.auto) { drive.stopAuto(); cabThen = null }
    const want = driving && !drive.passenger
    if (want !== pedalsShown) { pedalsShown = want; drive.show(want) }
    // In a cab the driver drives: the move stick goes away until you get out.
    document.body.classList.toggle('cab-ride', driving && drive.passenger)
    // Places of prayer stay quiet: no holiday confetti in the masjid or the Barakah Club.
    document.body.classList.toggle('in-prayer-space', interiors.inside === 'mosque' || interiors.inside === 'barakah')
  }, 200)
  const rideSpot: Hotspot = { id: '__ride__', x: 0, z: 0, r: 99, title: '', body: 'Stick up to go, back to brake, left and right to steer.', enter: 'Get out', use: () => endRide() }
  const parkedSpot: Hotspot = { id: '__parked__', x: 0, z: 0, r: 3.4, title: 'Your car', body: 'Parked. Take the wheel any time.', enter: 'Drive', use: () => takeWheel() }
  const bestOwnedCar = () => {
    const own = (getSave().ownedVehicles ?? []) as string[]
    return VEHICLES.filter((v) => DRIVABLE.includes(v.id) && own.includes(v.id)).sort((a, b) => b.price - a.price)[0] ?? null
  }
  const takeWheel = () => {
    if (!ride || interiors.inside) return
    if (seating.sitting) seating.stand()
    ride.resume()
    avatar.object.visible = false
    target = null; vel.x = 0; vel.z = 0
    rideCam = { dist: camDistGoal, pitch: camPitch }
    camDistGoal = ride.kind === 'boat' ? 14.5 : 7.4
    camPitch = ride.kind === 'boat' ? 0.34 : 0.28
    camYaw = ride.heading + Math.PI
    // A ride can start somewhere else (the circuit, the bay): the camera jumps there instead of gliding.
    if (Math.hypot(ride.x - pos.x, ride.z - pos.z) > 12) cameraReady = false
    pos.x = ride.x; pos.z = ride.z
  }
  /** Your own car waits by your house (the most valuable one you own). */
  const parkHomeCar = async () => {
    if (ride || rideBusy) return
    const v = bestOwnedCar()
    if (!v) return
    const m = await loadRide()
    if (ride || rideBusy) return
    ride = m.createRide(scene, { kind: 'car', model: v.id, label: v.label, mode: 'free', at: HOME_CAR }, { toast: (t) => ui.toast(t) })
    ride.park()
  }
  const beginRide = async (o: RideOpts) => {
    if (rideBusy) return
    if (interiors.inside || homes?.inside) { ui.toast('Step outside first.'); return }
    rideBusy = true
    try {
      const m = await loadRide()
      if (ride) { ride.dispose(); ride = null }
      if (ui.isOpen()) ui.close()
      const at = o.at ?? (o.mode === 'free' && o.kind === 'car' ? DEALER_ROAD : undefined)
      const r = m.createRide(scene, { ...o, at }, { toast: (t) => ui.toast(t) })
      // Compile the car's materials before the first frame with it, so taking the wheel never stalls.
      await Promise.race([renderer.compileAsync(scene, camera).catch(() => undefined), new Promise((done) => window.setTimeout(done, 3000))])
      ride = r
      takeWheel()
    } finally { rideBusy = false }
  }
  const endRide = () => {
    if (!ride) return
    const r = ride
    let out: { x: number; z: number }
    if (r.kind === 'boat') {
      r.dispose(); ride = null
      out = HARBOUR
      ui.toast('Back at the harbour.')
    } else {
      out = r.mode === 'race' ? RACEWAY_DOOR : r.exitSpot(world.obstacles)
      if (r.temp) { r.dispose(); ride = null; if (!/^Grind (Cab|Premium)$/.test(r.label)) ui.toast(r.mode === 'race' ? 'Back at the Raceway.' : `${r.label} handed back.`) }
      else r.park()
    }
    if (r.mode !== 'free') { const f = document.createElement('div'); f.className = 'ride-fade'; document.body.append(f); window.setTimeout(() => f.remove(), 900) }
    if (Math.hypot(out.x - pos.x, out.z - pos.z) > 12) cameraReady = false
    pos.x = out.x; pos.z = out.z
    avatar.object.visible = true
    avatar.object.position.set(pos.x, 0, pos.z)
    camDistGoal = rideCam.dist || 5.6
    camPitch = rideCam.pitch || 0.42
    vel.x = 0; vel.z = 0; target = null
    exitCooldown = 0.8
    if (!ride) window.setTimeout(() => void parkHomeCar(), 600)
  }
  window.addEventListener('gd:ride', (e) => void beginRide((e as CustomEvent<RideOpts>).detail))
  window.addEventListener('gd:revealed', () => window.setTimeout(() => void parkHomeCar(), 3500), { once: true })
  // Back where you left off: a player who was inside their own home opens there again (reload or next sign-in).
  window.addEventListener('gd:revealed', () => window.setTimeout(() => {
    const kind = getSave().homeAt
    const finish = () => { homeRestored = true }
    if (interiors.inside || homes?.inside) return finish()
    if (!kind) {
      // Not at home: back into the room or area this device was last in (a day or two at most).
      let last: { k?: string; id?: string; at?: number } | null = null
      try { last = JSON.parse(localStorage.getItem('gd.lastIn') ?? 'null') } catch { /* none */ }
      if (last?.id && Date.now() - (last.at ?? 0) < 3 * 86_400_000) {
        if (last.k === 'room') { const door = world.hotspots.find((h) => h.id === last!.id); if (door && interiors.roomFor(door.id)) enterRoom(door) }
        else if (last.k === 'home' && /^(park|airport|yacht|hotel|mall|surf|gallery)$/.test(last.id)) void enterHome(last.id as AreaId, false)
      }
      return void window.setTimeout(finish, 1500)
    }
    if (kind === 'house') {
      const door = world.hotspots.find((h) => h.id === 'yours')
      if (door) enterRoom(door)
      return void window.setTimeout(finish, 1500)
    }
    void import('./homesShop.ts').then((m) => {
      if (!m.readHomes().owned.includes(kind as never)) return finish()
      void enterHome(kind as AreaId, false).finally(finish)
    }).catch(finish)
  }, 400), { once: true })
  {
    // A car bought at the dealership is waiting at home the moment you leave the showroom.
    let owned = (getSave().ownedVehicles ?? []).length
    subscribe(() => {
      const n = (getSave().ownedVehicles ?? []).length
      if (n === owned) return
      owned = n
      if (ride && ride.driving) return
      if (ride) { ride.dispose(); ride = null }
      void parkHomeCar()
    })
  }
  ;(window as unknown as { __ride?: () => Ride | null }).__ride = import.meta.env.DEV ? () => ride : undefined
  // --- Luxury homes (homes.ts, loaded on the first visit). levelY lifts the player to the home's floor.
  let homes: Homes | null = null
  let levelY = 0
  let homeCam = { dist: 0, pitch: 0 }
  let ridePitchSaved: number | null = null
  const rideSeat: Seat = { x: 0, z: 0, yaw: 0, y: 0.45 }
  let rideHid = false
  const loadHomes = async (): Promise<Homes> => {
    if (!homes) { const m = await import('./homes.ts'); homes ??= m.createHomes(scene, { toast: (t) => ui.toast(t), openPanel: () => ui.open('homes'), leave: () => leaveHome(), train: (id) => boardMetro(id), fade: () => fadeScreen(), you: () => (avatar.object.userData.ownFigure as (() => { model: HumanModel; look: Look; height: number }) | undefined)?.() ?? null }); parkPillars() }
    return homes
  }
  const fadeScreen = () => { const f = document.createElement('div'); f.className = 'ride-fade'; document.body.append(f); window.setTimeout(() => f.remove(), 900) }
  let homeBusy = false
  const enterHome = async (id: AreaId, viewing: boolean, at?: [number, number]) => {
    notePlace(id)
    if (homeBusy) return
    if (ride?.driving) { ui.toast('Park the car first.'); return }
    if (interiors.inside) { ui.toast('Step outside first.'); return }
    homeBusy = true
    try {
      const h = await loadHomes()
      if (ui.isOpen()) ui.close()
      if (seating.sitting) seating.stand()
      const s = h.enter(id, viewing)
      // From the map: arrive at a particular place inside the area (the zoo, the golf course, the cliffs).
      if (at && (id === 'park' || id === 'airport')) { s.x = at[0]; s.z = at[1]; s.y = 0 }
      setHomeInView(id === 'park' || id === 'airport' || id === 'yacht' || id === 'hotel' || id === 'mall' || id === 'grad' || id === 'surf' || id === 'gallery' ? null : id)
      fadeScreen()
      await Promise.race([prepareShaders(h.group), new Promise((done) => window.setTimeout(done, 1500))])
      noteInside({ k: 'home', id })
      pos.x = s.x; pos.z = s.z; levelY = s.y
      vel.x = 0; vel.z = 0; target = null
      if (!homeCam.dist) homeCam = { dist: camDistGoal, pitch: camPitch }
      camDistGoal = 6.4; camPitch = 0.46
      camYaw = s.heading + Math.PI
      cameraReady = false
      avatar.object.position.set(pos.x, levelY, pos.z)
      ui.toast(id === 'park' ? 'Grind Park: the Ferris wheel, the carousel, the lake and an ice cream. The train back is at the gate.' : id === 'airport' ? 'Grind International Airport. Check in for flight GA 101 over the city, or charter the party jet in the Grind One Lounge.' : id === 'yacht' ? 'All aboard the party yacht. The DJ\'s on, and we cast off in a moment.' : id === 'surf' ? 'Grind Surf School. Walk up to the shack and grab a board: paddle out, pop up, ride one in.' : id === 'gallery' ? 'Grind Art Gallery: ON-CHAIN. Every work here is read live from Ethereum. Walk up to one and look closer.' : id === 'hotel' ? 'The Grind Grand. Book a suite at reception, or take the lift to the rooftop pool and sky bar.' : id === 'mall' ? 'Grind Mall: Grind Fresh supermarket at the back, shops on the right, the food court and cinema upstairs.' : id === 'grad' ? 'The Great Hall. Cap and gown on: take your seat with the class.' : viewing ? `A free viewing of the ${h.title.toLowerCase()}. Try a look on, then buy at Grind Realty.` : `Welcome home to your ${h.title.toLowerCase()}.`)
    } finally { homeBusy = false }
  }
  const leaveHome = () => {
    if (!homes?.inside) return
    noteInside(null)
    const out = homes.leave()
    setHomeInView(null)
    fadeScreen()
    pos.x = out.x; pos.z = out.z; levelY = 0
    vel.x = 0; vel.z = 0; target = null
    camDistGoal = homeCam.dist || 5.6; camPitch = homeCam.pitch || 0.42
    homeCam = { dist: 0, pitch: 0 }
    cameraReady = false
    avatar.object.position.set(pos.x, 0, pos.z)
    exitCooldown = 0.8
  }
  window.addEventListener('gd:home', (e) => {
    const d = (e as CustomEvent<{ op: string; id?: HomeId; viewing?: boolean; style?: StyleId; at?: [number, number] }>).detail
    if (d.op === 'enter' && d.id) void enterHome(d.id, !!d.viewing, d.at)
    else if (d.op === 'try' && d.style) { if (homes?.inside) { ui.close(); homes.tryStyle(d.style) } else ui.toast('Go to a home first (a free viewing works), then try a look on.') }
    else if (d.op === 'restyle' && homes?.inside) homes.restyle()
    else if (d.op === 'yacht') {
      // The party yacht from the harbour: paid here, then you step aboard at the jetty.
      if (ride?.driving) { ui.toast('Park the car first.'); return }
      const paid = spendInGame(150, 'Party yacht cruise', 'DJ, guests and the bay at sunset')
      if (!paid.ok) { ui.toast(paid.message); return }
      void enterHome('yacht', true)
    }
    else if (d.op === 'surf') {
      // Surfing: free to walk down to the school; a session is paid at the shack.
      if (ride?.driving) { ui.toast('Park the car first.'); return }
      void enterHome('surf', true)
    }
  })
  ;(window as unknown as { __homes?: () => Homes | null }).__homes = import.meta.env.DEV ? () => homes : undefined
  // --- The Grind Metro (metro.ts): a train round the city and out to Grind Park, loaded once the city is open.
  let metro: Metro | null = null
  let metroCam = { dist: 0, pitch: 0 }
  const metroSpot: Hotspot = { id: '__metro__', x: 0, z: 0, r: 99, title: 'Grind Metro', body: 'Ride round the city. The gold button gets you off at the next stop.', enter: 'Get off at the next stop', use: () => { metro?.requestStop(); ui.toast(`Getting off at ${metro?.nextTitle() ?? 'the next stop'}.`) } }
  const parkPillars = () => { if (metro && homes) homes.setParkObstacles(metro.pillars.map((p) => ({ kind: 'circle' as const, x: p.x, z: p.z, r: 0.85 }))) }
  const boardMetro = (id: StationId) => {
    if (!metro) { ui.toast('The trains are starting up. Try again in a moment.'); return }
    if (ride?.driving) { ui.toast('Park the car first.'); return }
    if (interiors.inside || (homes?.inside && homes.inside !== 'park' && homes.inside !== 'airport')) { ui.toast('Step outside first.'); return }
    if (homes?.moving) { ui.toast('Wait for the ride to finish.'); return }
    const paid = spendInGame(2, 'Grind Metro fare', 'A ride on the train')
    if (!paid.ok) { ui.toast(paid.message); return }
    if (homes?.inside) homes.leave()
    if (seating.sitting) seating.stand()
    if (ui.isOpen()) ui.close()
    metro.board(id)
    const v = metro.view()
    fadeScreen()
    avatar.object.visible = false
    target = null; vel.x = 0; vel.z = 0
    if (!metroCam.dist) metroCam = { dist: homeCam.dist || camDistGoal, pitch: homeCam.pitch || camPitch }
    homeCam = { dist: 0, pitch: 0 }
    camDistGoal = 15; camPitch = 0.3
    camYaw = v.heading + Math.PI
    pos.x = v.x; pos.z = v.z; levelY = v.y
    cameraReady = false
    ui.toast('Ticket bought. Up the stairs and all aboard: the gold button gets you off at the next stop.')
  }
  const metroArrive = (id: StationId) => {
    if (!metro) return
    avatar.object.visible = true
    camDistGoal = metroCam.dist || 5.6; camPitch = metroCam.pitch || 0.42
    metroCam = { dist: 0, pitch: 0 }
    if (id === 'park' || id === 'airport') { levelY = 0; void enterHome(id, true); return }
    const st = STATIONS_AT[id]
    fadeScreen()
    pos.x = st[0]; pos.z = st[1]; levelY = 0
    vel.x = 0; vel.z = 0; target = null
    avatar.object.position.set(pos.x, 0, pos.z)
    cameraReady = false
    exitCooldown = 0.8
    ui.toast(`${metro ? '' : ''}You are at the ${id === 'skytower' ? 'Sky Tower' : id[0]!.toUpperCase() + id.slice(1)} station.`)
  }
  const STATIONS_AT: Record<StationId, [number, number]> = { beach: [-8, -59.5], marina: [59, 8], raceway: [6, 59.5], park: [-118, 123], skytower: [-59, 10], airport: [141, 16] }
  // Places that load after the city opens are built hidden, their shaders compiled in the background
  // (compileAsync; in parallel on browsers that can), and only then shown, so they never freeze a frame by
  // compiling on the spot as they first come into view.
  const staged = (build: (into: THREE.Scene) => void) => {
    const holder = new THREE.Group(); holder.name = 'staged'; holder.visible = false
    scene.add(holder)
    build(holder as unknown as THREE.Scene)
    void renderer.compileAsync(holder, camera, scene).catch(() => undefined).finally(() => { holder.visible = true })
  }
  window.addEventListener('gd:revealed', () => window.setTimeout(() => {
    void import('./metro.ts').then((m) => {
      staged((into) => { metro = m.createMetro(into, { onArrive: (id) => metroArrive(id) }) })
      void import('./venues.ts').then((v) => { staged((into) => { streetSpots.push(...v.cityVenues(into, (id) => void enterHome(id, true))) }) })
      // The Pitch: a promoter's coin booth beside the Conference Centre (scam awareness, practice money only).
      void import('./pitch.ts').then((p) => { staged((into) => streetSpots.push(p.buildPitch(into, { obstacles: world.obstacles, at: { x: 21.8, z: -48.8 }, toast: (t) => ui.toast(t), openCourse: (c) => window.dispatchEvent(new CustomEvent('gd:course', { detail: c })) }).spot)) })
      for (const st of m.STATIONS) if (st.id !== 'park' && st.id !== 'airport') streetSpots.push({ id: `metro-${st.id}`, x: st.street[0], z: st.street[1], r: 2.0, title: `Grind Metro · ${st.title}`, body: 'Trains round the city and out to Grind Park, every few minutes. $2 a ride.', enter: 'Take the train · $2', use: () => boardMetro(st.id) })
      // The ticket hall at the foot of each station's stairs: buy a ticket at the machine and climb up to the train.
      for (const e of metro?.entrances ?? []) streetSpots.push({ id: `metro-hall-${e.id}`, x: e.x, z: e.z, r: 2.6, title: `${e.title} station · tickets`, body: 'Buy a ticket at the machine, go through the gates and up the stairs to the platform. Trains every few minutes.', enter: 'Buy a ticket & board · $2', use: () => boardMetro(e.id) })
      parkPillars()
    })
  }, 2500), { once: true })
  ;(window as unknown as { __metro?: () => Metro | null }).__metro = import.meta.env.DEV ? () => metro : undefined
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
  // Signboards and other boxes with a material per face draw once per material, not once per face (batch.ts).
  // Places that load later are picked up by the repeat; each mesh is only ever done once.
  window.addEventListener('gd:revealed', () => { const run = () => { sweepScene(scene) }; run(); for (const t of [4000, 10000, 25000]) window.setTimeout(run, t); window.setInterval(run, 20000) }, { once: true })
  // Camera rays test solid static meshes only, each with a bounding-volume hierarchy (camRays.ts).
  const camRays = createCamRays(scene, (o) => {
    if (o === avatar.object || o.userData.camPass) return 'tree'
    if (o.userData.ghost) return 'self'
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (mat && !Array.isArray(mat) && mat.userData?.foliage) return 'self'
    // Near-invisible effects (light cones, glows) never stop the camera.
    if (mat && !Array.isArray(mat) && mat.transparent && mat.opacity < 0.05) return 'self'
    return false
  })
  const pullCamera = (origin: THREE.Vector3, desired: THREE.Vector3) => {
    rayDirection.subVectors(desired, origin)
    const dist = rayDirection.length()
    if (dist < 0.05) return pulledCam.copy(desired)
    rayDirection.multiplyScalar(1 / dist)
    raycaster.set(origin, rayDirection)
    raycaster.far = dist
    const hits = camRays.hits(raycaster)
    for (const hit of hits) {
      if (hit.object.userData.ghost) continue
      // Only solid meshes stop the camera. Rain/dust Points have a 1 m pick radius, so they used to yank the
      // camera in at random (seen in the 8 Nov local repro: hits on Points at ~6 m with open street behind).
      if (!(hit.object as THREE.Mesh).isMesh) continue
      if (isUnder(avatar.object, hit.object)) continue
      // People walking past and leaf cards no longer yank the camera in and out by themselves.
      if (passesCamera(hit.object)) continue
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
        const blocker = camRays.hits(raycaster).find((h) => (h.object as THREE.Mesh).isMesh && !h.object.userData.ghost && !isUnder(avatar.object, h.object))
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
      for (const h of camRays.hits(raycaster)) {
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
    // While seated: always offer Stand (never leave a gold Sit button up). Not on a ride: you get off at the end.
    if (seating.sitting && seating.sitting !== rideSeat) {
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
  const bake = () => !indoors() && bakeSatellite(renderer, scene, 512, world.hemi, () => post.render()) // one-off render; 512 keeps rooftops/roads readable when zoomed
  // The satellite picture for the map is one full render read back from the GPU, which stalls everything for a
  // moment. It used to run four seconds after the city started loading, in the middle of the opening; now it
  // runs when the player opens the menu (the city holds still behind it, so nothing stutters), and the Map
  // still draws it on demand if it is not there yet.
  bakeWhenStill = () => { if (!satelliteUrl() && !indoors() && !document.body.classList.contains('rail-shut')) { try { bake() } catch { /* vector map */ } } }
  let debugView: [number[], number[]] | null = null
  // Dev only (?debugmap): how long the game logic and the draw submission take per frame, and one frame's draw calls.
  const DEV_PERF = import.meta.env.DEV && location.search.includes('debugmap')
  const perfStat = { n: 0, upd: 0, ren: 0, dt: 0 }
  if (DEV_PERF) Object.assign(window, {
    __camRays: () => ({ size: camRays.size(), pending: camRays.pending() }),
    __programs: () => (renderer.info.programs ?? []).map((p) => `${p.id} ${(p as unknown as { type: string }).type} ${p.cacheKey.slice(0, 160)}`),
    __still: (r: number) => { post.snapshot(r); const url = canvas.toDataURL('image/png'); post.restore(); return url },
    __drawBreakdown: (limit = 30) => {
      // Meshes that would be drawn now (visible chain, in the view frustum), grouped by their top-level parent.
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      const sph = new THREE.Sphere(), groups = new Map<string, { draws: number; tris: number; shadow: number; kids: string[] }>()
      for (const top of scene.children) {
        const key = `${top.name || top.type}#${top.id}`
        const walk = (o: THREE.Object3D) => {
          if (!o.visible) return
          const m = o as THREE.Mesh
          if ((m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite) && m.geometry) {
            if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
            sph.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld)
            if (!m.frustumCulled || (m as THREE.InstancedMesh).isInstancedMesh || fr.intersectsSphere(sph)) {
              const g = groups.get(key) ?? { draws: 0, tris: 0, shadow: 0, kids: [] as string[] }
              if (g.kids.length < 4) g.kids.push(`${m.geometry.type.replace('Geometry', '')}/${Array.isArray(m.material) ? `${m.material.length}mats` : (m.material as THREE.Material).type.replace('Mesh', '').replace('Material', '')}${m.name ? `:${m.name}` : ''}@${sph.center.x.toFixed(0)},${sph.center.z.toFixed(0)}`)
              const mats = Array.isArray(m.material) ? m.material.length : 1
              g.draws += mats; g.tris += ((m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position')?.count ?? 0) / 3) * ((m as THREE.InstancedMesh).count ?? 1)
              if (m.castShadow) g.shadow += mats
              groups.set(key, g)
            }
          }
          for (const c of o.children) walk(c)
        }
        walk(top)
      }
      return [...groups.entries()].sort((a, b) => b[1].draws - a[1].draws).slice(0, limit).map(([k, v]) => `${v.draws}d ${v.shadow}s ${Math.round(v.tris / 1000)}k ${k} | ${v.kids.join(' ')}`)
    },
    __rayCost: () => { const rc = new THREE.Raycaster(); const o = new THREE.Vector3(pos.x, 1.6, pos.z); camRays.hits(rc); const t0 = performance.now(); let n = 0; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; rc.set(o, new THREE.Vector3(Math.sin(a), 0.25, Math.cos(a))); rc.far = 8; n += camRays.hits(rc).length } return { msPerRay: +((performance.now() - t0) / 40).toFixed(3), n } },
    __perf: () => { const r = { frames: perfStat.n, fps: perfStat.dt ? +(perfStat.n / perfStat.dt).toFixed(1) : 0, updMs: +(perfStat.upd / Math.max(1, perfStat.n)).toFixed(2), renMs: +(perfStat.ren / Math.max(1, perfStat.n)).toFixed(2) }; perfStat.n = perfStat.upd = perfStat.ren = perfStat.dt = 0; return r },
    __blankCheck: () => { blankStage = 0; blankAt = 0 },
    __drawStats: () => { const i = renderer.info; i.autoReset = false; i.reset(); post.render(); const r = { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs?.length ?? 0, ratio: +renderer.getPixelRatio().toFixed(2) }; i.autoReset = true; return r },
  })
  let clearAir = 1
  if (import.meta.env.DEV && location.search.includes('debugmap')) Object.assign(window, { __view: (p?: number[], t?: number[]) => { debugView = p && t ? [p, t] : null; introT = 1 }, __clearAir: (k: number) => { clearAir = k }, __skyline: (on: boolean) => skyline.show(on), __hide: (name: string, on = false) => { const o = scene.getObjectByName(name); if (o) o.visible = on; return !!o }, __res: () => +renderer.getPixelRatio().toFixed(3), __scene: () => scene, __facing: () => { const p = (avatar.object.userData.person as THREE.Object3D | undefined) ?? avatar.object; const v = new THREE.Vector3(0, 0, 1).applyQuaternion(p.getWorldQuaternion(new THREE.Quaternion())); return { root: +avatar.object.rotation.y.toFixed(3), body: +Math.atan2(v.x, v.z).toFixed(3), move: Math.hypot(vel.x, vel.z) > 0.3 ? +Math.atan2(vel.x, vel.z).toFixed(3) : null, speed: +Math.hypot(vel.x, vel.z).toFixed(2) } }, __setGraphics: (g: Graphics) => { setGraphics(g); applyGraphics() }, __npcs: () => crowd.debug(), __tapNpc: (i: number) => { const n = crowd.debug()[i]; if (!n) return null; const rc = new THREE.Raycaster(new THREE.Vector3(n.x + 3, 1.1, n.z), new THREE.Vector3(-1, 0, 0)); const hit = crowd.pick(rc); if (hit) openResident(hit); return hit?.name ?? null }, __info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }), __open: (p: string) => ui.open(p as Parameters<typeof ui.open>[0]), __pick: (sx: number, sy: number) => {
    const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1), camera)
    return rc.intersectObjects(scene.children, true).slice(0, 4).map((h) => { const o = h.object as THREE.Mesh; const chain: string[] = []; for (let n: THREE.Object3D | null = o; n; n = n.parent) chain.push(n.name || n.type)
      const m = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial | undefined
      return { d: +h.distance.toFixed(2), p: h.point.toArray().map((v) => +v.toFixed(2)), geo: o.geometry?.type, params: (o.geometry as unknown as { parameters?: unknown })?.parameters, col: m?.color?.getHexString?.(), chain: chain.join('<') } })
  }, __give: (n: number) => { getSave().ledger += n }, __swim: () => ({ swimming, swimMove: +swimMove.toFixed(2), tilt: +(((avatar.object.userData.person as THREE.Object3D | undefined)?.rotation.x ?? 0).toFixed(2)), top: (avatar.object.userData.look as { top?: number } | undefined)?.top, saved: !!swimSaved }), __traffic: () => traffic.debug(), __portraitHi: () => portraitShot(0, undefined, true), __sit: () => seating.sit({ x: pos.x, z: pos.z, yaw: 0, y: 0.45 } as Parameters<typeof seating.sit>[0], avatar.object), __tax: () => { getSave().taxOpen = true }, __use: (id: string) => { const u = (interiors.uses() as Array<{ id: string; use?: () => void }>).find((x) => x.id === id); u?.use?.(); return !!u }, __cam: (y: number, pi: number, d: number) => { camYaw = y; camPitch = pi; camDist = camDistGoal = d }, __camDist: () => camDist, __tp: (x: number, z: number) => { pos.x = x; pos.z = z }, __find: (t: string) => findSpot(t)?.id ?? null, __blockers: () => blockers.slice(), __bounds: () => interiors.bounds() ?? (homes?.inside ? homes.bounds() : null), __THREE: THREE, __travel: (t: string, enter = false) => travelHook(t, enter), __goSpot: (id: string) => { const h = streetSpots.find((x) => x.id === id) ?? world.hotspots.find((x) => x.id === id); if (h) travelTo(h); return !!h }, __spotTitles: () => world.hotspots.map((h) => h.title), __rooms: () => world.hotspots.filter((h) => interiors.roomFor(h.id)).map((h) => h.id), __enter: (q: string) => { const h = world.hotspots.find((x) => (x.id === q || x.action === q) && interiors.roomFor(x.id)); return h ? enterRoom(h) : false }, __pos: () => ({ x: pos.x, z: pos.z, y: +levelY.toFixed(2), sitting: !!seating.sitting }), __near: () => (interiors.inside ? (interiors.uses() as Hotspot[]) : streetSpots).map((u) => ({ id: u.id, enter: u.enter, d: +Math.hypot(u.x - pos.x, u.z - pos.z).toFixed(2) })).filter((u) => u.d < 2.5), __sat: () => { bakeSatellite(renderer, scene, 1024); return satelliteUrl() }, __obs: () => world.obstacles, __area: (id: string) => { void enterHome(id as Parameters<typeof enterHome>[0], true) }, __spots: (q: string) => streetSpots.filter((s) => s.id.includes(q)).map((s) => ({ id: s.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1) })), __campos: () => [camera.position.x, camera.position.y, camera.position.z, camDist, camDistGoal], __crowdObs: () => crowdObstacles, __mk: () => { const r = avatar.object; const hd = r.getObjectByName("Head"); return { has: typeof r.userData.setMakeup, kids: hd ? hd.children.map((c) => c.type + ":" + c.children.length) : null, female: r.userData.person?.getObjectByName("Female") ? 1 : 0 } }, __shot: (a: number[], t: number[]) => {
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
    zahraMoves.tick(dt)
    serverMoves?.tick(dt)
    market.tick(dt)
    interiors.tick(dt)
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
    if (servedCup && (cupTimer -= dt) <= 0) { scene.remove(servedCup); servedCup = null }
    if (!interiors.inside && !ui.isOpen()) {
      const d = Math.hypot(avatar.object.position.x - 0.35, avatar.object.position.z - 0.32)
      if (d < 3.8 && elapsed - serverSpoke > 60) { serverSpoke = elapsed; const line = SERVER_LINES[Math.floor(elapsed) % SERVER_LINES.length]!; speak(line, { gender: 'm', seed: 7 }); sayLine('server', line); serverMoves?.play('wave') }
    }
  apiAgents.tick(dt)
    metro?.tick(dt)
    // Traffic gives way to the car you drive as it does to people.
    crowdObstacles.push(...traffic.tick(dt, elapsed, pos, ride && ride.driving && ride.kind === 'car' ? crowdObstacles.concat(ride.shape()) : crowdObstacles))
    // Reduced motion holds the sky still at the chosen GN time.
    // The city is mostly in daylight: the clock runs slowly while the sun is up, briskly through dusk and dawn,
    // and quickly through the night (about 8 minutes of day to 2 of night).
    if (!calmSky() && !clockHeld()) { const up = Math.sin((dayPhase - 0.25) * Math.PI * 2); const before = dayPhase; dayPhase = (dayPhase + (dt / DAY_SECONDS) * (up > 0.12 ? 0.55 : up < -0.12 ? 2.6 : 1.3)) % 1; if (dayPhase < before) seasons.newDay() }
    lightAcc += dt
    if (lightAcc > 0.25) {
      lightAcc = 0
      world.setDaylight(dayPhase)
      seasons.apply(scene.fog instanceof THREE.FogExp2 ? scene.fog : null, world.sun, world.hemi, nightLevel)
      if (homes?.flying && scene.fog instanceof THREE.FogExp2) scene.fog.density *= 0.45 // clearer air up high
      if (clearAir !== 1 && scene.fog instanceof THREE.FogExp2) scene.fog.density *= clearAir // dev only: poster stills
      if (interiors.inside && scene.fog instanceof THREE.FogExp2) scene.fog.density = 0 // no street haze indoors
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
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.84, 0.8, nightLevel) // Neutral mapping: normal daylight, not washed out
      physSky.sky.visible = nightLevel < 0.85
  phoneFill.intensity = phoneFill.visible ? 0.15 * (1 - nightLevel) + 0.06 : 0
    }
    world.tick(elapsed, focus.set(pos.x, 0, pos.z))
    watch.tick(elapsed, focus, nightLevel)
    skyline.tick(elapsed, nightLevel)
    beach.tick(dt)
    ambient.tick(elapsed, focus, nightLevel)
    if (homes?.inside) ui.setPlace(homes.title)
    else if (!interiors.inside) ui.setPlace(districtName(pos.x, pos.z))
    try {
      camera.getWorldDirection(earDir)
      setAmbientEnv(nightLevel, weather.rain(), camera.position.x, camera.position.z, earDir.x, earDir.z)
      setAmbientPlace(Boolean(interiors.inside), Math.hypot(pos.x, pos.z))
    } catch { /* */ }

    const frame = input.read()
    // In drone mode the stick flies the drone and you stand where you launched it.
    if (droneCam && !ui.isOpen()) flyDrone(dt, frame.x, frame.y)
    const paused = ui.isOpen() || mentor.isOpen() || !!selfie || !!droneCam
    if (frame.lookX !== 0 || frame.lookY !== 0) lookIdle = 0
    else lookIdle += dt
    camYaw -= frame.lookX * 0.0052
    camPitch = THREE.MathUtils.clamp(camPitch - frame.lookY * 0.0036, 0.18, 1.05)
    // Wheel/pinch moves a goal; the camera eases to it (no jumps, no runaway trackpad zoom).
    // Zoom out further outdoors (the city, the park, the airport) to see the whole place and tap anywhere to walk;
    // rooms and homes keep the close limit so the camera never leaves the walls.
    const outdoorArea = homes?.inside === 'park' || homes?.inside === 'airport'
    const zMax = (ride?.driving && ride.kind === 'boat') || metro?.riding ? 18 : interiors.inside ? CAM_ZMAX : homes?.inside ? (outdoorArea ? 36 : CAM_ZMAX) : 24
    camDistGoal = THREE.MathUtils.clamp(camDistGoal + THREE.MathUtils.clamp(frame.zoom * 0.012, -1.5, 1.5), CAM_ZMIN, zMax)
    camDist += (camDistGoal - camDist) * (1 - Math.exp(-10 * dt))

    exitCooldown = Math.max(0, exitCooldown - dt)
    busyFor = Math.max(0, busyFor - dt)
    // Activity clock: a ride (the carousel, the wheel, the coaster...) or a timed action shows what it is and how
    // long is left, so nobody wonders how long they are in for.
    {
      const mv = homes?.inside ? homes.moveClock : null
      if (mv && mv.dur > 3) { actTitle ||= spot?.title || 'On the ride'; actClock(actTitle, mv.dur - mv.t, mv.dur) }
      else if (busyFor > 0.3 && busyTotal >= 3) { actTitle ||= spot?.title || 'Busy'; actClock(actTitle, busyFor, busyTotal) }
      else if (actTitle) { actTitle = ''; actClock('', 0, 1) }
    }
    if (!paused && frame.interact) {
      if (seating.sitting && seating.sitting !== rideSeat) { seating.stand() }
      else if (seating.sitting === rideSeat) { /* riding: the ride brings you back */ }
      else if (spot) {
      if (spot.exit) leaveRoom()
      else if (spot.use) spot.use()
      else if (!enterRoom(spot) && spot.action) ui.open(spot.action, spot.house ? { house: spot.house } : undefined)
      }
    }

    let directed = false
    let moving = false
    const homeRide = homes?.inside ? homes.tick(dt, pos.x, pos.z) : null
    if (!homeRide && seating.sitting === rideSeat) seating.stand()
    if (!homeRide && rideHid) { rideHid = false; avatar.object.visible = true }
    if (homeRide) {
      // A lift or escalator carries you: no walking until it stops.
      pos.x = homeRide.x; pos.z = homeRide.z; levelY = homeRide.y
      vel.x = 0; vel.z = 0; target = null
      avatar.object.position.set(pos.x, levelY, pos.z)
      // On a ride you sit: in the coaster car, on the wheel's bench, on a carousel horse, down the slides.
      const rs = homes!.rideSeat
      if (rs) { rideSeat.x = pos.x; rideSeat.z = pos.z; rideSeat.yaw = rs.yaw; rideSeat.y = rs.y; if (!seating.sitting) seating.sit(rideSeat, avatar.object) }
      else if (seating.sitting === rideSeat) seating.stand()
      const rf = rs ? null : homes!.rideFace
      if (rf !== null) avatar.face(Math.sin(rf), Math.cos(rf), dt, true)
      // Following a golf ball: the player steps out of the picture until it stops.
      if (homes!.rideHidden) { avatar.object.visible = false; rideHid = true }
      // Stairs and ladders on a ride are stepped up, not floated up.
      const gait = rs ? 0 : homes!.rideGait
      avatar.step(dt, gait > 0.1, gait)
      seating.apply(avatar.object, dt)
    } else if (metro?.riding) {
      const v = metro.view()
      pos.x = v.x; pos.z = v.z; levelY = v.y
      vel.x = 0; vel.z = 0; target = null
      stillFor = 0
      avatar.object.position.set(pos.x, levelY, pos.z)
    } else if (ride && ride.driving) {
      // At the wheel: the stick drives, taps on the ground do nothing, the body stays in the car.
      rideBlockers.length = 0
      rideBlockers.push(...world.obstacles, ...crowdObstacles)
      // The stick steers; the Gas and Brake keys (and auto-drive, when a place was picked on the map) drive.
      ride.step(dt, paused || busyFor > 0 ? null : drive.input({ x: frame.x, y: frame.y }, ride, 16, dt), rideBlockers, world.obstacles)
      pos.x = ride.x; pos.z = ride.z
      vel.x = 0; vel.z = 0
      moving = Math.abs(ride.speed) > 0.5
      stillFor = Math.abs(ride.speed) > 0.2 ? 0 : stillFor + dt
      avatar.object.position.set(pos.x, 0, pos.z)
    } else {
    if (!paused && frame.tap) {
      pointer.set(frame.tap.nx, frame.tap.ny)
      raycaster.setFromCamera(pointer, camera)
      floor.constant = -levelY
      // A person only counts if they stand in front of where the tap meets the ground (plus a body's depth).
      const groundHit = raycaster.ray.intersectPlane(floor, tapPoint) !== null
      const reach = groundHit ? tapPoint.distanceTo(raycaster.ray.origin) + 0.9 : Infinity
      const inHome = Boolean(homes?.inside)
      const tapped = interiors.inside || inHome ? null : net.pick(raycaster, reach)
      const npc = !tapped && !interiors.inside && !inHome ? crowd.pick(raycaster, reach) : null
      const zahraHit = !tapped && !interiors.inside && !inHome && Math.hypot(pos.x - ada.position.x, pos.z - ada.position.z) < 30 && raycaster.intersectObject(ada, true).some((h) => h.distance < reach)
      if (inHome && homes!.arranging) homes!.arrangeTap(raycaster, groundHit ? tapPoint.clone() : null)
      else if (zahraHit) { if (!mentor.isOpen() && !ui.isOpen()) mentor.hello() }
      else if (tapped) void openPeer(tapped)
      else if (npc) openResident(npc)
      else if (groundHit) {
        target = tapPoint.clone()
        const room = interiors.bounds() ?? (homes?.inside ? homes.bounds() : null)
        if (room) {
          target.x = THREE.MathUtils.clamp(target.x, room.x - room.hw, room.x + room.hw)
          target.z = THREE.MathUtils.clamp(target.z, room.z - room.hd, room.z + room.hd)
        } else {
          target.x = THREE.MathUtils.clamp(target.x, -CITY_LIMIT + 1, CITY_LIMIT - 1)
          target.z = THREE.MathUtils.clamp(target.z, -CITY_LIMIT + 1, CITY_LIMIT - 1)
        }
        // A tap on furniture or water would park the walk target inside a blocker, where the player
        // slides, stalls and gives up. Nudge the target out to the nearest free spot (e.g. the pool rim).
        const inRoom = homes?.inside ? homes.obstacles() : interiors.inside ? interiors.obstacles() : world.obstacles
        resolveCollision(target, { x: 0, z: 0 }, inRoom, PLAYER_R + 0.05, Boolean(interiors.inside || homes?.inside))
        stuck = 0
        prevDist = Infinity
      }
    }

    directed = !paused && Math.hypot(frame.x, frame.y) > 0.06
    // Phones: while the stick is held, the walking direction stays the one it was pressed in, so the camera can
    // come round behind the player (below) without bending the path. Looking around by drag still steers.
    if (!directed) moveBasisYaw = null
    else if (moveBasisYaw === null || lookIdle < 0.3 || !matchMedia('(pointer: coarse)').matches) moveBasisYaw = camYaw
    const basisYaw = moveBasisYaw ?? camYaw
    const forwardX = -Math.sin(basisYaw)
    const forwardZ = -Math.cos(basisYaw)
    const rightX = Math.cos(basisYaw)
    const rightZ = -Math.sin(basisYaw)
    // A person's card goes as soon as you walk on.
    if (npcCard && directed) { npcCard.remove(); npcCard = null }
    // Passing cards: a few times a second, who is the nearest real player (first) or resident within reach.
    passT += dt
    if (passT > 0.25) {
      passT = 0
      const busyNow = !revealed || ui.isOpen() || document.body.classList.contains('sheet-open') || !!ride?.driving || !!metro?.riding || !!document.getElementById('gd-modal')
      if (busyNow) passCard.update(null)
      else {
        const peer = net.nearestPeer(pos.x, pos.z, 2.8)
        if (peer) {
          const named = peer.username && peer.username !== 'guest'
          passCard.update({ key: `p:${peer.id}`, kind: 'player', name: peer.name || (named ? `@${peer.username}` : 'Guest'), sub: named ? `@${peer.username}` : 'Playing as a guest', line: 'In the city now · say hi', hue: 42, open: () => void openPeer(peer) })
        } else {
          const npc = crowd.nearInfo(pos.x, pos.z, 2.4)
          if (npc) passCard.update({
            key: `n:${npc.name}`, kind: 'npc', name: npc.name, sub: npc.trait, line: npc.doing, hue: (npc.seed * 47) % 360,
            open: () => openResident(npc),
            extra: import('./residentProfile.ts').then((m) => m.mentorLabel(npc.trait)).catch(() => null),
          })
          else passCard.update(null)
        }
      }
    }
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
    const running = !tapWalk && !swimming && (frame.run || frame.stick > 0.88)
    sprinting = running && mag > 0.2
    // In a pool the player swims: slower than walking.
    const speed = (tapWalk ? TAP_WALK * mag : (running ? RUN : WALK) * mag) * (swimming ? 0.55 : 1)
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
    if (homes?.inside) blockers.push(...homes.obstacles())
    else if (interiors.inside) blockers.push(...interiors.obstacles())
    else blockers.push(...world.obstacles, ...crowdObstacles)
    if (ride && !ride.driving && !interiors.inside) blockers.push(...ride.shape())
    // Sub-step so a fast frame on a slow phone can never tunnel through a wall; boxes slide.
    const steps = Math.max(1, Math.ceil((Math.hypot(vel.x, vel.z) * dt) / 0.2))
    for (let i = 0; i < steps && !seating.sitting; i += 1) {
      pos.x += (vel.x * dt) / steps
      pos.z += (vel.z * dt) / steps
      resolveCollision(pos, vel, blockers, PLAYER_R, Boolean(interiors.inside || homes?.inside))
    }
    {
      // Indoors: never leave the room shell, whatever pushed the player (seats, busy moves, fast taps).
      const room = interiors.bounds() ?? (homes?.inside ? homes.bounds() : null)
      if (room) {
        pos.x = THREE.MathUtils.clamp(pos.x, room.x - room.hw, room.x + room.hw)
        pos.z = THREE.MathUtils.clamp(pos.z, room.z - room.hd, room.z + room.hd)
      }
    }
    // In a luxury home: stand at its floor height, lower in a pool.
    if (homes?.inside) levelY += (homes.floorY(pos.x, pos.z) - levelY) * (1 - Math.exp(-9 * dt))
    // The big halls have stepped seating tiers and a stage: the player climbs them as in the homes.
    else if (interiors.inside) levelY += (interiors.floorY(pos.x, pos.z) - levelY) * (1 - Math.exp(-12 * dt))
    avatar.object.position.set(pos.x, homes?.inside || interiors.inside ? levelY : 0, pos.z)
    const groundSpeed = Math.hypot(vel.x, vel.z)
    moving = groundSpeed > 0.22
    // Face where the body actually goes (after collision), falling back to the input while starting.
    const faceX = groundSpeed > 0.3 ? vel.x / groundSpeed : dirX
    const faceZ = groundSpeed > 0.3 ? vel.z / groundSpeed : dirZ
    if (groundSpeed > 0.3) faceYaw = Math.atan2(faceX, faceZ)
    stillFor = groundSpeed > 0.2 ? 0 : stillFor + dt
    // Only a seat turns the whole figure (seating.ts), and it turns it back on standing. Any other turn left on it
    // would add to the walking direction and make the player walk sideways or backward, so it is folded away here.
    if (!seating.sitting && avatar.object.rotation.y !== 0) {
      const left = avatar.object.rotation.y
      avatar.object.rotation.y = 0
      if (!(wishLen > 0.05 || groundSpeed > 0.3)) for (let i = 0; i < 2; i++) avatar.face(Math.sin(faceYaw + left), Math.cos(faceYaw + left), 1, true)
    }
    avatar.face(faceX, faceZ, dt, wishLen > 0.05 || groundSpeed > 0.3)
    // Talking with Zahra: the two of you face each other while her card is open (she turns to you, you to her);
    // afterwards she eases back to her place by the Campus steps.
    {
      const dx = pos.x - ada.position.x, dz = pos.z - ada.position.z
      const talkingTo = mentor.isOpen() && !interiors.inside && Math.hypot(dx, dz) < 9
      if (talkingTo && groundSpeed < 0.2) avatar.face(-dx, -dz, dt, true)
      else if (groundSpeed < 0.2 && !interiors.inside) {
        const t = crowd.talker()
        if (t && Math.hypot(t.x - pos.x, t.z - pos.z) < 4) avatar.face(t.x - pos.x, t.z - pos.z, dt, true)
      }
      const want = talkingTo ? Math.atan2(dx, dz) : ZAHRA_REST
      const turnBy = Math.atan2(Math.sin(want - ada.rotation.y), Math.cos(want - ada.rotation.y))
      if (Math.abs(turnBy) > 0.002) ada.rotation.y += turnBy * Math.min(1, dt * (talkingTo ? 5 : 1.5))
    }
    avatar.step(dt, moving, Math.hypot(vel.x, vel.z))
    seating.apply(avatar.object, dt)
    // Pools (homes, the hotel and the indoor pool at home): tread water when still, swim face down when moving.
    {
      const waterY = homes?.inside ? homes.waterY(pos.x, pos.z) : interiors.waterY(pos.x, pos.z)
      const inWater = waterY !== null && !seating.sitting
      if (inWater && !swimming) personaNote('swim')
      swimming = inWater
      swimMove += ((inWater && moving ? 1 : 0) - swimMove) * (1 - Math.exp(-4 * dt))
      const baseY = homes?.inside || interiors.inside ? levelY : 0
      const bob = inWater ? Math.sin(elapsed * 2.2) * 0.03 : 0
      const wantY = inWater ? waterY - (1.32 - 0.34 * swimMove) + bob : baseY
      swimY = Math.abs(swimY - wantY) > 3 ? wantY : swimY + (wantY - swimY) * (1 - Math.exp(-8 * dt))
      if (inWater || Math.abs(swimY - baseY) > 0.01) avatar.object.position.y = swimY
      else swimY = baseY
      const person = avatar.object.userData.person as THREE.Object3D | undefined
      if (person && !seating.sitting && (inWater || swimPosed)) {
        // Lie forward about the hips (0.9 m up) so the body stays where the player is, not out in front.
        const th = 1.35 * swimMove
        person.rotation.x = th
        person.position.set(0, 0.9 * (1 - Math.cos(th)), -0.9 * Math.sin(th))
        swimPosed = th > 0.002 || inWater
        if (!swimPosed) { person.rotation.x = 0; person.position.set(0, 0, 0) }
      }
      // Swimwear goes on in the water and the day's clothes come back a moment after climbing out.
      if (inWater) { outOfWater = 0; swimwearOn() } else if (swimSaved && (outOfWater += dt) > 1.2) swimwearOff()
    }
    }
    if (firstMarker.parent) {
      // Slow spin + tiny bob so it reads as a Campus waypoint, not a clipping toy.
      firstMarker.children[0]!.position.y = Math.sin(performance.now() / 900) * 0.08
      if (!needsFirstCourse()) scene.remove(firstMarker)
      else if (!interiors.inside) {
        const near = Math.hypot(pos.x, pos.z + 40.4) < 3.2 || Math.hypot(pos.x - ada.position.x, pos.z - ada.position.z) < 2.4
        if (near && !firstOpened && !ui.isOpen() && !mentor.dismissed()) { firstOpened = true; mentor.start(nextMission() ?? 'internet') }
        else if (!near && Math.hypot(pos.x, pos.z + 40.4) > 6) firstOpened = false
      }
    }
    tickTvs(dt, pos.x, pos.z, camera)
    tickWater(dt, camera)
    if (follower && droneCam) {
      // flying: the drone is where you fly it, tilted into its motion, facing the way the camera looks
      follower.position.set(droneCam.x, droneCam.y + Math.sin(elapsed * 3) * 0.04, droneCam.z)
      follower.rotation.set(THREE.MathUtils.clamp(-droneCam.vz * 0.02, -0.25, 0.25), camYaw, THREE.MathUtils.clamp(droneCam.vx * 0.02, -0.25, 0.25))
      const rotors = follower.userData.rotors as THREE.Object3D[] | undefined
      if (rotors) for (const r of rotors) r.rotation.y += dt * 40
    } else if (follower) {
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
    if (ride && !ride.driving) { parkedSpot.x = ride.x; parkedSpot.z = ride.z; parkedSpot.title = ride.label }
    const candidates: Hotspot[] = ride?.driving || metro?.riding ? [] : homes?.inside ? homes.uses() : interiors.inside ? (interiors.uses() as Hotspot[]) : ride ? [...streetSpots, parkedSpot] : streetSpots
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
    // Walk up to a free seat anywhere (a bench, a chair, a row in a hall) and stop: you sit down by yourself.
    // After standing up you have to step away first, so moving off a seat never drops you straight back in.
    if (seating.sitting) { autoSitHold = { x: pos.x, z: pos.z }; autoSitStill = 0 }
    else if (autoSitHold && Math.hypot(pos.x - autoSitHold.x, pos.z - autoSitHold.z) > 1.4) autoSitHold = null
    if (!seating.sitting && !autoSitHold && !paused && !ride?.driving && !metro?.riding && !ui.isOpen() && !dancing && Math.hypot(vel.x, vel.z) < 0.25) {
      let seatSpot: Hotspot | null = null, seatD = 0.85
      for (const c of candidates) {
        if (c.enter !== 'Sit' || !c.use) continue
        const d = Math.hypot(pos.x - c.x, pos.z - c.z)
        if (d < seatD) { seatD = d; seatSpot = c }
      }
      autoSitStill = seatSpot ? autoSitStill + dt : 0
      if (seatSpot && autoSitStill > 0.35) { autoSitStill = 0; seatSpot.use!() }
    } else autoSitStill = 0
    if (ride?.driving) { rideSpot.enter = ride.kind === 'boat' ? 'Back to harbour' : 'Get out'; rideSpot.title = ride.label; best = rideSpot }
    if (metro?.riding) { metroSpot.enter = `Get off at ${metro.nextTitle()}`; best = metroSpot }
    showSpot(best)
    // An action button nobody used fades after a few seconds of standing still; it is back the moment the
    // player moves or reaches something else.
    if (activeSpot) {
      if (activeSpot !== pillSpot || Math.hypot(pos.x - pillX, pos.z - pillZ) > 0.3) { pillSpot = activeSpot; pillX = pos.x; pillZ = pos.z; pillAge = 0; act.classList.remove('faded') }
      else if ((pillAge += dt) > 7) act.classList.add('faded')
    } else if (pillSpot) { pillSpot = null; act.classList.remove('faded') }

    if (!taxLatch && elapsed > 18 && !ui.isOpen() && getSave().taxOpen && Math.hypot(pos.x, pos.z) < 14) {
      taxLatch = true
      // A small chip, not a panel: it must never stop the player mid-walk. Tap it to answer; it fades on its own.
      const chip = document.createElement('button')
      chip.type = 'button'; chip.id = 'family-chip'; chip.className = 'glass-fab greet-fab family-fab'
      chip.textContent = 'Family request · Reply'
      chip.onclick = () => { chip.remove(); ui.open('tax') }
      document.getElementById('family-chip')?.remove()
      document.body.append(chip)
      window.setTimeout(() => chip.remove(), 20000)
    }

    // After a longer pause without manual look, ease the camera behind the walking direction (phones: less auto-swing).
    const coarseCam = matchMedia('(pointer: coarse)').matches
    // Coaster and water slides: the camera rides just behind you, looking where you are going.
    const rv = homes?.inside ? homes.rideView : null
    if (rv) {
      if (ridePitchSaved === null) ridePitchSaved = camPitch
      const behind = rv.heading + Math.PI
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-7 * dt))
      camPitch += (THREE.MathUtils.clamp(rv.pitch, 0.1, 0.9) - camPitch) * (homes?.flying ? 1 : 1 - Math.exp(-4 * dt))
    } else if (ridePitchSaved !== null) { camPitch = ridePitchSaved; ridePitchSaved = null }
    if (metro?.riding && lookIdle > 0.9) {
      const behind = metro.view().heading + Math.PI
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-1.4 * dt))
    }
    if (ride?.driving && lookIdle > 0.9) {
      // Chase camera: settle behind the car (or boat), quicker at speed.
      const behind = ride.heading + Math.PI
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-(Math.abs(ride.speed) > 1 ? 3.2 : 1.2) * dt))
    }
    // Phones, stick held: the camera comes round behind the walking direction, so a player who walks toward the
    // camera soon sees their character's back instead of walking face-first at the screen ("walking backward").
    if (coarseCam && directed && lookIdle > 0.6 && Math.hypot(vel.x, vel.z) > 1 && !paused && !ride?.driving) {
      const behind = Math.atan2(-vel.x, -vel.z)
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-1.6 * dt))
    }
    if (lookIdle > (coarseCam ? 2.8 : 1.6) && directed === false && Math.hypot(vel.x, vel.z) > 1 && !paused) {
      const behind = Math.atan2(-vel.x, -vel.z)
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-(coarseCam ? 0.55 : 1.2) * dt))
    }
    // (The desktop idle face-swing was removed: standing still, the camera turned by itself on PC.)
    void faceYaw
    if (!cameraReady) lookSmooth.set(pos.x, 1.15 + levelY, pos.z)
    // Over-the-shoulder: frame the player slightly left of centre, GTA style, on wide screens only.
    // A tall phone screen is so narrow that the same offset pushed the player half off the left edge: centre them.
    // Driving or riding the metro keeps the camera centred.
    const shoulderAmt = THREE.MathUtils.clamp((camera.aspect - 0.8) / 0.6, 0, 1)
    shoulder.set(Math.cos(camYaw), 0, -Math.sin(camYaw)).multiplyScalar((ride?.driving || metro?.riding ? 0 : 0.55) * shoulderAmt * Math.min(1, 6 / camDist) * THREE.MathUtils.clamp(camDist / 3.2, 0.3, 1)) // also eases off in a face close-up
    const flying = !!homes?.flying
    lookSmooth.lerp(lookTarget.set(pos.x + shoulder.x, (ride?.driving && ride.kind === 'boat' ? 2.7 : 1.45) + levelY, pos.z + shoulder.z), flying ? 1 : 1 - Math.exp(-12 * dt))
    lookTarget.copy(lookSmooth)
    const indoors = Boolean(interiors.inside)
    if (!indoors && cutHidden.size) restoreCut()
    const useDist = homes?.rideCam ?? (indoors ? Math.min(camDist, 4.6) : camDist) // walls between camera and player are cut away indoors
    const horiz = useDist * Math.cos(camPitch)
    desiredCam.set(pos.x + Math.sin(camYaw) * horiz, 1.15 + levelY + useDist * Math.sin(camPitch), pos.z + Math.cos(camYaw) * horiz)
    // The over-the-shoulder offset must not put the look point inside a wall (player hugging a building).
    headPt.set(pos.x, 1.45 + levelY, pos.z)
    rayDirection.subVectors(lookTarget, headPt)
    const offLen = rayDirection.length()
    if (offLen > 0.05) {
      raycaster.set(headPt, rayDirection.multiplyScalar(1 / offLen))
      raycaster.far = offLen + 0.3
      if (camRays.hits(raycaster).some((h) => (h.object as THREE.Mesh).isMesh && !h.object.userData.ghost && !isUnder(avatar.object, h.object))) lookTarget.copy(headPt)
    }
    boomBlocked = false
    const ideal = indoors ? desiredCam : pullCamera(lookTarget, desiredCam)
    // Outdoors, backed against a building: turn the view toward the open side (8 flat probes, 4x a second),
    // unless the player is dragging the camera. Indoors, walls are cut away instead.
    steerAcc += dt
    if (!interiors.inside && !ride?.driving && boomBlocked && lookIdle > 0.4 && steerAcc > 0.25 && stillFor === 0) {
      steerAcc = 0
      const reach = Math.min(6, useDist * Math.cos(camPitch))
      let bestRoom = 0
      steerYaw = null
      for (let k = 0; k < 8; k++) {
        const a = camYaw + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4)
        liftDir.set(Math.sin(a), 0, Math.cos(a))
        raycaster.set(headPt, liftDir)
        raycaster.far = reach
        const h = camRays.hits(raycaster).find((x) => (x.object as THREE.Mesh).isMesh && !x.object.userData.ghost && !isUnder(avatar.object, x.object))
        const room = h ? h.distance : reach
        if (room > bestRoom + 0.3) { bestRoom = room; steerYaw = a }
      }
      if (bestRoom < 2) steerYaw = null
    }
    if (!boomBlocked && steerAcc > 1) steerYaw = null
    if (steerYaw !== null && lookIdle > 0.7 && !interiors.inside && !ride?.driving) {
      const delta = Math.atan2(Math.sin(steerYaw - camYaw), Math.cos(steerYaw - camYaw))
      camYaw += delta * (1 - Math.exp(-1.6 * dt))
    }
    if (!cameraReady) {
      smoothCam.copy(ideal)
      cameraReady = true
    } else if (flying) {
      // In a plane at 60 m/s a spring would trail metres behind: the camera rides with the plane.
      smoothCam.copy(ideal); camVel.set(0, 0, 0)
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
    // The art gallery is a closed hall: keep the camera inside its walls (it would look in from outside).
    if (!indoors && homes?.inside === 'gallery') { const b = homes.bounds(); if (b) { safe.x = THREE.MathUtils.clamp(safe.x, b.x - b.hw - 0.35, b.x + b.hw + 0.35); safe.z = THREE.MathUtils.clamp(safe.z, b.z - b.hd - 0.35, b.z + b.hd + 0.35); safe.y = Math.min(safe.y, 6.1) } }
    camera.position.copy(safe)
    { // Very subtle walk sway (off with reduced motion).
      const sp = Math.hypot(vel.x, vel.z)
      if (!calmSky() && sp > 0.3) bob += dt * (sprinting ? 11 : 7.5)
      const amp = calmSky() ? 0 : Math.min(1, sp / 4) * 0.018
      camera.position.y += Math.sin(bob * 2) * amp
      camera.position.x += Math.cos(bob) * amp * 0.5
    }
    // No leaves or snow indoors (the Great Hall, the mall) or up in a plane.
    seasons.tick(dt, camera, !interiors.inside && !homes?.flying && homes?.inside !== 'grad' && homes?.inside !== 'mall' && homes?.inside !== 'gallery')
    { const pulse = weather.tick(dt, camera, !interiors.inside && homes?.inside !== 'gallery', calmSky())
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
    // Flights: see to the horizon, and keep the sky box round the camera at 150 m up.
    // A rocket: much further still, and in space a black sky with no haze.
    const space = homes?.space ?? 0
    const wantFar = space >= 1 ? 60000 : space > 0 ? 3000 : flying ? 900 : 260
    if (camera.far !== wantFar) { camera.far = wantFar; camera.updateProjectionMatrix() }
    if (flying) physSky.sky.position.copy(camera.position)
    // High up (the skydive's climb, the rocket's first minute) the air is thin: the ground 1-2 km below stays clear.
    if (space > 0 && scene.fog instanceof THREE.FogExp2) scene.fog.density = space >= 1 ? 0 : 0.00025
    if (space >= 1) { physSky.sky.visible = false; if (scene.background instanceof THREE.Color) scene.background.setHex(0x000004) }
    if (debugView) { camera.position.fromArray(debugView[0]); camera.lookAt(debugView[1][0], debugView[1][1], debugView[1][2]) }
    else if (glassCam) {
      // Through the glasses: the camera at the player's eyes, looking where the camera looks (drag turns, pitch tilts).
      if (ride?.driving || metro?.riding || homes?.flying) endGlassCam()
      else {
        const eye = avatar.object.position.y + 1.6 * (avatar.object.scale.y || 1)
        const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw)
        camera.position.set(pos.x + fx * 0.12, eye, pos.z + fz * 0.12)
        camera.lookAt(pos.x + fx * 4, eye + 0.35 - camPitch * 3, pos.z + fz * 4)
        if (avatar.object.visible) avatar.object.visible = false
      }
    }
    else if (droneCam) {
      // Drone camera: a chase view just behind and above your drone, looking where it flies (pitch tilts it down).
      if (ride || interiors.inside || homes?.flying || homes?.inside) endDroneCam()
      else {
        const back = 3.4, lift = 1.1 + camPitch * 1.6
        camera.position.set(droneCam.x + Math.sin(camYaw) * back, droneCam.y + lift, droneCam.z + Math.cos(camYaw) * back)
        camera.lookAt(droneCam.x - Math.sin(camYaw) * 6, droneCam.y + 0.6 - camPitch * 6, droneCam.z - Math.cos(camYaw) * 6)
      }
    }
    else if (selfie) {
      // Selfie: the camera in front of the player at arm's length (or further back for a full-body shot with the
      // street behind), turned by the arrows. The player keeps facing the lens.
      const a = faceYaw + selfie.angle, base = avatar.object.position.y
      const lookY = base + Math.max(0.95, 1.55 - (selfie.dist - 1.2) * 0.17)
      camera.position.set(pos.x + Math.sin(a) * selfie.dist, base + 1.62 + (selfie.dist - 1.2) * 0.1, pos.z + Math.cos(a) * selfie.dist)
      camera.lookAt(pos.x, lookY, pos.z)
    }
    camera.updateMatrixWorld()
    setMixerViewer(camera)
    const baseFov = (window.innerWidth < 800 ? 57 : 50) + (new URLSearchParams(location.search).has('widefov') ? 6 : 0)
    const fov = baseFov + (sprinting ? 4 : 0)
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-6 * dt))
      camera.updateProjectionMatrix()
    }
    if (visiting && !interiors.inside && !homes?.inside) visiting = null // left their home
    if (dancing && (moving || seating.sitting || ride)) setDance(false)
    net.tick(dt, { x: pos.x, z: pos.z, yaw: faceYaw, moving, act: seating.sitting, vx: vel.x, vz: vel.z, room: myRoom(), emote: dancing ? 'dance' : '' })
    mapAcc += dt
    if (mapAcc > 0.15) { mapAcc = 0; drawMap() } // minimap at ~7 Hz is plenty
    saveAcc += dt
    if (saveAcc > 2) {
      saveAcc = 0
      // Only a spot in the city is kept: rooms and homes are built far outside it, and a position from in there was
      // out of range on the next load, which put the player back at the plaza. Indoors, the door outside is kept.
      if (interiors.inside) { const st = STREET[interiors.inside]; const dx = streetDoor.x - st.cx, dz = streetDoor.z - st.cz, l = Math.hypot(dx, dz) || 1; rememberPlace(streetDoor.x + (dx / l) * 1.4, streetDoor.z + (dz / l) * 1.4) }
      else if (!homes?.inside && Math.max(Math.abs(pos.x), Math.abs(pos.z)) < CITY_LIMIT) rememberPlace(pos.x, pos.z)
      if (homeRestored) rememberHome(atHome()?.home ?? null)
    }
  }

  performance.mark('gd:interiors-loop')
  // Shader warm-up behind the loading screen. It used to stop after 1 s, so a phone compiled the rest inside the
  // first frame (a 3-8 s freeze with nothing moving). Now it gets up to 12 s (a desktop is done in well under 1 s)
  // and the Play button shows how far it has got. A failure or timeout still opens the city.
  {
    const playBtn = document.querySelector<HTMLButtonElement>('#play')
    const kinds = new Set<string>()
    scene.traverseVisible((o) => { const m = (o as THREE.Mesh).material; if ((o as THREE.Mesh).isMesh && m) for (const x of Array.isArray(m) ? m : [m]) kinds.add(`${x.type}:${(x as THREE.MeshStandardMaterial).map ? 1 : 0}:${(o as THREE.SkinnedMesh).isSkinnedMesh ? 1 : 0}:${(o as THREE.InstancedMesh).isInstancedMesh ? 1 : 0}`) })
    const start = renderer.info.programs?.length ?? 0
    const expect = Math.max(8, kinds.size)
    const tick = window.setInterval(() => {
      const done = (renderer.info.programs?.length ?? start) - start
      if (playBtn) playBtn.textContent = `Preparing graphics ${Math.min(99, Math.round((done / expect) * 100))}%`
    }, 250)
    try { await withTimeout(renderer.compileAsync(scene, camera).then(() => undefined), 12000, () => undefined, 'Shader warm-up') } finally { window.clearInterval(tick) }
    if (playBtn) playBtn.textContent = 'Opening the district'
  }
  performance.mark('gd:shaders')
  // While the full-screen menu is open the city holds still: no movement, no camera drift, no redraw.
  // The blurred backdrop keeps showing the last frame, so nothing behind the menu can shake or zoom,
  // and phones stop paying for a full 3D frame plus the blur on every tick. Dragging a zoom/look
  // slider (cc-peek) draws live again so the change is visible.
  let holdRedraw = 0
  redrawSoon = () => { holdRedraw = Math.max(holdRedraw, 3) }
  window.addEventListener('resize', () => { holdRedraw = 2 })
  let finalWarm: 'todo' | 'running' | 'done' = 'todo'
  const menuHold = () => {
    const cls = document.body.classList
    return !cls.contains('rail-shut') && !cls.contains('cc-peek')
  }
  let last = performance.now()
  // Frame pacing on phones. A phone that cannot hold 60 frames a second spends every last bit of its graphics
  // chip trying, and then the whole phone stutters (the notification shade, the keyboard, other apps). Such a
  // phone is locked to a steady 30 (remembered on the device), which leaves it room to breathe; and any phone
  // drops to 20 while nobody touches the screen and nothing moves. Computers draw every display frame.
  const coarseLoop = matchMedia('(pointer: coarse)').matches
  const FPS_KEY = 'gd.fps30'
  let lock30 = coarseLoop && (() => { try { return localStorage.getItem(FPS_KEY) === '1' } catch { return false } })()
  let lastInput = performance.now(), paceT = 0, paceN = 0, paceSum = 0
  let pcT = 0, pcN = 0, pcLast = performance.now(), pcStepAt = 0, revealedAt = Infinity
  let rafEma = 16.7, rafPrev = performance.now()
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const) window.addEventListener(ev, () => { lastInput = performance.now() }, { passive: true, capture: true })
  const frame = (now: number) => {
    if (abandoned) return
    requestAnimationFrame(frame)
    if (failed) return
    // High-refresh computer screens (120 to 165 Hz) asked the city for 2 to 3 times the frames a 60 Hz screen does:
    // hot, throttled graphics chips and stutter. There the city draws every other screen frame (60 to 82 a second).
    rafEma += (Math.min(50, now - rafPrev) - rafEma) * 0.05; rafPrev = now
    if (revealed && !coarseLoop && rafEma < 9.5 && now - last < 12) return
    if (revealed && coarseLoop) {
      const still = now - lastInput > 9000 && Math.hypot(vel.x, vel.z) < 0.05 && !ride
      const budget = still ? 50 : lock30 ? 1000 / 30 : 0
      // A few ms early, so a 60 Hz screen's 33.3 ms rhythm is not missed by a hair (which would make it 25).
      if (budget && now - last < budget - 4) return
      post.setBudget(budget || 1000 / 60)
      if (!lock30 && !still) {
        // Judge the phone over 4 s of play: under about 45 a second on average, lock to 30.
        paceSum += now - last; paceN++; paceT += now - last
        if (paceT > 4000) {
          if (paceSum / paceN > 22) {
            lock30 = true; try { localStorage.setItem(FPS_KEY, '1') } catch { /* private mode */ }
            // A phone this slow also gets Lite, now and on later visits (unless Full was chosen in Settings).
            if (noteStruggling()) { setLiteNow(true); applyGraphics(); if (!quietStart()) ui.toast('Light performance on for smoother play. Change it in Settings > Performance.') }
          }
          paceT = paceSum = paceN = 0
        }
      }
    }
    // Clamp to 50 ms: a GC/compile hitch must not teleport the player or kick the camera spring.
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
    last = now
    if (document.hidden && revealed) return
    if (revealed && menuHold()) {
      if (holdRedraw <= 0) return
      holdRedraw -= 1
      try { post.render(); checkBlank() } catch { /* keep the last frame */ }
      return
    }
    // A panel (Trade, Boutique, Profile...) covers most of the screen: the city keeps its last frame and the
    // phone's whole budget goes to the panel, so taps and scrolling answer at once. Prices keep moving.
    if (revealed && document.body.classList.contains('sheet-open')) {
      tickMarket(dt, Date.now())
      if (holdRedraw > 0) { holdRedraw -= 1; try { post.render(); checkBlank() } catch { /* keep the last frame */ } }
      return
    }
    // Computers on Auto: the same watch as phones. Judged over 5 s of the city actually drawing (not behind a panel,
    // not in the first seconds after opening): under about 30 a second, Graphics steps down one notch (High, Medium,
    // Low), and a computer still slow on Low goes Light. Each step waits 8 s to show its effect. Full never steps.
    if (revealed && !coarseLoop && autoPerformance()) {
      // Gaps longer than a quarter second are a panel or the menu just closing, not slow drawing: skipped.
      if (now - revealedAt > 6000 && now - pcLast < 250) {
        pcT += now - pcLast; pcN++
        if (pcT > 5000) {
          if (pcT / pcN > 34 && now - pcStepAt > 8000) {
            pcStepAt = now
            const g = getSave().graphics
            if (g !== 'low') { setGraphics(g === 'high' ? 'medium' : 'low'); applyGraphics(); if (!quietStart()) ui.toast(`Graphics set to ${g === 'high' ? 'Medium' : 'Low'} to keep the game smooth. Change it in Settings.`) }
            else if (!liteOn() && noteStruggling()) { setLiteNow(true); applyGraphics(); if (!quietStart()) ui.toast('Light performance on for smoother play. Change it in Settings > Performance.') }
          }
          pcT = pcN = 0
        }
      }
      pcLast = now
    }
    // Second warm-up: the first update turns on what the opening scene really uses (the sun's shadow, the time
    // of day's lights), which changes some shaders. Those are compiled here, behind the loading screen, before
    // the first frame is drawn, instead of freezing that frame.
    if (!revealed && finalWarm === 'running') return
    elapsed += dt
    if (revealed) tickNeeds(dt)
    try {
      const tu = DEV_PERF ? performance.now() : 0
      update(dt)
      if (!revealed) performance.mark('gd:first-update')
      if (!revealed && finalWarm === 'todo') {
        finalWarm = 'running'
        const playBtn = document.querySelector<HTMLButtonElement>('#play')
        if (playBtn) playBtn.textContent = 'Preparing graphics 99%'
        void withTimeout(renderer.compileAsync(scene, camera).then(() => undefined), 8000, () => undefined, 'Final shader warm-up')
          .then(() => { finalWarm = 'done'; performance.mark('gd:shaders-final'); if (playBtn) playBtn.textContent = 'Opening the district' })
        return
      }
      const tr = DEV_PERF ? performance.now() : 0
      post.frame(dt, elapsed)
      post.render()
      checkBlank()
      if (DEV_PERF) { const te = performance.now(); perfStat.n++; perfStat.upd += tr - tu; perfStat.ren += te - tr; perfStat.dt += dt }
      afterRender?.()
      if (snapNext) { snapNext = false; takeShot() }
      if (revealed) probe(dt)
      if (!revealed) {
        revealed = true
        revealedAt = performance.now()
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
        if (!tourSeen() && !new URLSearchParams(location.search).has('debugmap')) window.setTimeout(() => startTour(), 1500)
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
