import '@fontsource/archivo-black/400.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import * as THREE from 'three'
import { createAvatar, setAvatarGraphics, type Avatar } from './avatars.ts'
import { createDrone, releaseDrone, spinDrone } from './drones.ts'
import { tagPlayer } from './player.ts'
import { assetUrl, prepareAssets } from './assets.ts'
import { startFlat } from './flat.ts'
import { createInput } from './input.ts'
import { decodeShare, rankFor, seasonAt, wearsPlate, type DroneId, type Graphics } from './logic.ts'
import { drawMinimap } from './minimap.ts'
import { bindMusic } from './music.ts'
import { createNet } from './net.ts'
import { createTraffic } from './traffic.ts'
import { applyPrefs } from './prefs.ts'
import { linkWalletWithPrivy, loginWithPrivy } from './privy.ts'
import { createCrowd } from './npcs.ts'
import { blocked, CITY_LIMIT, PLAYER_R, resolveCollision, type Obstacle } from './physics.ts'
import { attachPrivy, getSave, loadSave, rememberPlace, setVolume, tickMarket } from './state.ts'
import { mountUi } from './ui.ts'
import { mountMenu } from './menu.ts'
import { createWorld, districtName, type Hotspot } from './world.ts'
import './style.css'

const WALK = 2.7
const RUN = 5.5
const fontsReady = Promise.race([
  Promise.all([
    document.fonts.load('72px "Archivo Black"'),
    document.fonts.load('32px Outfit'),
  ]),
  new Promise<void>((resolve) => setTimeout(resolve, 1800)),
])

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
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
  const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900
  const tries: WebGLContextAttributes[] = [
    { antialias: !mobile, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false },
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

async function main(onReveal: () => void) {
  const canvas = must<HTMLCanvasElement>('#view')
  const boot = must<HTMLDivElement>('#boot')
  const bootText = must<HTMLParagraphElement>('#boot-text')
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

  const prefer: Graphics = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900 ? 'low' : 'medium'
  loadSave(prefer)
  volume.value = String(getSave().volume)

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

  // Start loading these while the title screen is visible, not after Enter is pressed.
  await fontsReady

  const renderer = createRenderer(canvas)
  if (!renderer) {
    await startFlat(onReveal)
    return
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 260)
  const mark = await loadTexture('/brand/shrimp.png')
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
  const crowd = createCrowd(scene)
  const traffic = createTraffic(scene, world.lanes, getSave().graphics)
  // ~10 real minutes per in-game day. GN time in Settings picks where the clock starts.
  const DAY_SECONDS = 600
  const phaseFor = (time: string) => (time === 'day' ? 0.42 : time === 'dusk' ? 0.74 : 0.02)
  let dayPhase = phaseFor(getSave().timeOfDay)
  let lightAcc = 1
  const calmSky = () => reduceMotion || getSave().reduceMotion

  let avatar: Avatar = createAvatar(getSave().body, getSave().tint, getSave().luxury)
  const pos = { x: getSave().posX, z: getSave().posZ }
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
    if (kind === 'none') return
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
    renderer.toneMappingExposure = 1.0
  }
  const applyGraphics = () => {
    const graphics = getSave().graphics
    const dpr = window.devicePixelRatio || 1
    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900
    const ratioLimit = graphics === 'low' ? 1 : graphics === 'medium' ? (mobile ? 1.25 : 1.5) : (mobile ? 1.5 : 2)
    renderer.setPixelRatio(Math.min(dpr, ratioLimit))
    const shadows = graphics !== 'low'
    world.setGraphics(graphics)
    setAvatarGraphics(avatar, graphics)
    crowd.setGraphics(graphics)
    renderer.shadowMap.enabled = shadows
    world.sun.castShadow = shadows
    const size = graphics === 'high' ? 2048 : 1024
    if (world.sun.shadow.mapSize.x !== size) {
      world.sun.shadow.mapSize.set(size, size)
      world.sun.shadow.map?.dispose()
      world.sun.shadow.map = null
    }
    renderer.setSize(window.innerWidth, window.innerHeight, false)
  }
  const applyBody = () => {
    const save = getSave()
    scene.remove(avatar.object)
    avatar = createAvatar(save.body, save.tint, save.luxury)
    setAvatarGraphics(avatar, save.graphics)
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
    onTopupLogin: async () => {
      const outcome = await loginWithPrivy()
      return outcome.ok ? attachPrivy(outcome.id) : outcome
    },
    onTopupLinkWallet: async () => {
      return linkWalletWithPrivy()
    },
    onTopupBalance: async () => {
      const { getTopupBalance } = await import('./topup.ts')
      return getTopupBalance()
    },
    onTopupVerify: async (hash) => {
      const { verifyTopup } = await import('./topup.ts')
      return verifyTopup(hash)
    },
  })

  must('#nav-profile').addEventListener('click', () => ui.open('profile'))
  must('#nav-topup').addEventListener('click', () => ui.open('topup'))
  must('#nav-learn').addEventListener('click', () => ui.open('learn'))
  must('#nav-city').addEventListener('click', () => ui.open('city'))
  must('#nav-settings').addEventListener('click', () => ui.open('settings'))
  map.addEventListener('click', () => ui.open('city'))
  must('#pill-rank').addEventListener('click', () => ui.open('profile'))
  must('#pill-ledger').addEventListener('click', () => ui.open('profile', { tab: 'books' }))
  must('#pill-season').addEventListener('click', () => ui.open('season'))
  must('#shot').addEventListener('click', () => {
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

  bindMusic(musicButton, volume, musicNote)
  volume.addEventListener('input', () => setVolume(Number(volume.value)))

  const input = createInput(canvas, stick, nub)

  const chat = must<HTMLFormElement>('#chat')
  const chatInput = must<HTMLInputElement>('#chat-input')
  const chatLog = must<HTMLOListElement>('#chat-log')
  const chatStatus = must<HTMLParagraphElement>('#chat-status')
  chat.hidden = false
  const identity = () => {
    const save = getSave()
    return { name: save.name, username: save.username, body: save.body, tint: save.tint }
  }
  const net = createNet({
    scene,
    me: identity(),
    getSelf: () => avatar.object,
    onLine: ({ from, text, self }) => {
      const item = document.createElement('li')
      const who = document.createElement('b')
      who.textContent = self ? 'You' : from
      item.append(who, ` ${text}`)
      chatLog.append(item)
      while (chatLog.children.length > 5) chatLog.firstElementChild?.remove()
      window.setTimeout(() => item.remove(), 20000)
    },
    onStatus: (online) => {
      chatStatus.textContent = online
        ? 'Live. Players within 12 m see what you say.'
        : 'Solo city. Only you see your bubble.'
    },
  })
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
    new THREE.MeshBasicMaterial({ color: 0x1af38f, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }),
  )
  marker.rotation.x = -Math.PI / 2
  marker.position.y = 0.04
  marker.visible = false
  marker.userData.ghost = true
  scene.add(marker)

  let camYaw = 0
  let camPitch = 0.42
  let camDist = 8.4
  let lookIdle = 0
  const camVel = new THREE.Vector3()
  const lookSmooth = new THREE.Vector3()
  const vel = { x: 0, z: 0 }
  let target: THREE.Vector3 | null = null
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
    camera.fov = width < 800 ? 62 : 52
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
    const hit = raycaster.intersectObjects(world.cameraBlockers, false)[0]
    if (!hit) return pulledCam.copy(desired)
    const travel = Math.max(0.7, hit.distance - 0.45)
    return pulledCam.copy(origin).addScaledVector(rayDirection, travel)
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
    act.hidden = !next.action
    act.textContent = next.enter ?? 'Enter'
  }

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
    crowdObstacles.push(...traffic.tick(dt, elapsed, pos, crowdObstacles))
    // Reduced motion holds the sky still at the chosen GN time.
    if (!calmSky()) dayPhase = (dayPhase + dt / DAY_SECONDS) % 1
    lightAcc += dt
    if (lightAcc > 0.25) {
      lightAcc = 0
      world.setDaylight(dayPhase)
      const sunUp = Math.sin((dayPhase - 0.25) * Math.PI * 2)
      renderer.toneMappingExposure = 0.96 + THREE.MathUtils.clamp(sunUp, 0, 1) * 0.1
    }
    world.tick(elapsed, focus.set(pos.x, 0, pos.z))
    ui.setPlace(districtName(pos.x, pos.z))

    const frame = input.read()
    const paused = ui.isOpen()
    if (frame.lookX !== 0 || frame.lookY !== 0) lookIdle = 0
    else lookIdle += dt
    camYaw -= frame.lookX * 0.0052
    camPitch = THREE.MathUtils.clamp(camPitch - frame.lookY * 0.0036, 0.18, 1.05)
    camDist = THREE.MathUtils.clamp(camDist + frame.zoom * 0.012, 4.6, 16)

    if (!paused && frame.interact && spot?.action) ui.open(spot.action, spot.house ? { house: spot.house } : undefined)

    if (!paused && frame.tap) {
      pointer.set(frame.tap.nx, frame.tap.ny)
      raycaster.setFromCamera(pointer, camera)
      if (raycaster.ray.intersectPlane(floor, tapPoint)) {
        target = tapPoint.clone()
        target.x = THREE.MathUtils.clamp(target.x, -CITY_LIMIT + 1, CITY_LIMIT - 1)
        target.z = THREE.MathUtils.clamp(target.z, -CITY_LIMIT + 1, CITY_LIMIT - 1)
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
    const speed = (running ? RUN : WALK) * mag
    const rate = 1 - Math.exp(-9 * dt)
    vel.x += (dirX * speed - vel.x) * rate
    vel.z += (dirZ * speed - vel.z) * rate
    if (paused) {
      vel.x = 0
      vel.z = 0
    }
    pos.x += vel.x * dt
    pos.z += vel.z * dt
    blockers.length = 0
    blockers.push(...world.obstacles, ...crowdObstacles)
    resolveCollision(pos, vel, blockers, PLAYER_R)
    avatar.object.position.set(pos.x, 0, pos.z)
    const moving = Math.hypot(vel.x, vel.z) > 0.22
    avatar.face(dirX, dirZ, dt, wishLen > 0.05)
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
    for (const candidate of world.hotspots) {
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

    // After a moment without manual look, ease the camera behind the walking direction.
    if (lookIdle > 1.6 && directed === false && Math.hypot(vel.x, vel.z) > 1 && !paused) {
      const behind = Math.atan2(-vel.x, -vel.z)
      const delta = Math.atan2(Math.sin(behind - camYaw), Math.cos(behind - camYaw))
      camYaw += delta * (1 - Math.exp(-1.2 * dt))
    }
    if (!cameraReady) lookSmooth.set(pos.x, 1.15, pos.z)
    lookSmooth.lerp(lookTarget.set(pos.x, 1.15, pos.z), 1 - Math.exp(-14 * dt))
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
    camera.lookAt(lookTarget)
    net.tick(dt, { x: pos.x, z: pos.z, yaw: 0, moving })
    drawMap()
    saveAcc += dt
    if (saveAcc > 2) {
      saveAcc = 0
      rememberPlace(pos.x, pos.z)
    }
  }

  scene.updateMatrixWorld(true)
  let last = performance.now()
  const frame = (now: number) => {
    requestAnimationFrame(frame)
    if (failed) return
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    if (document.hidden && revealed) return
    elapsed += dt
    try {
      update(dt)
      renderer.render(scene, camera)
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
  prepareAssets()
  play.disabled = true
  play.textContent = 'Opening the district'
  menuNote.textContent = ''
  try {
    await main(revealCity)
  } catch (error) {
    opening = false
    play.disabled = false
    play.textContent = 'Enter the district'
    menu.hidden = false
    menuNote.textContent = error instanceof Error ? error.message : 'The city could not open.'
  }
}

loadSave(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900 ? 'low' : 'medium')

mountMenu(() => {
  void begin()
})

play.focus()
