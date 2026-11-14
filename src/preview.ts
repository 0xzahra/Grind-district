import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createWorld } from './world.ts'
import { createCrowd } from './npcs.ts'
import { createTraffic } from './traffic.ts'
import { createSkyline } from './skyline.ts'
import { createAmbient } from './ambient.ts'
import { createPhysicalSky } from './sky.ts'
import { applyEnvironment, keepFoliageOutOfAO } from './quality.ts'

// Title-screen preview: the REAL city (same world, townspeople, traffic, skyline, ambient life) at golden hour
// with a physical sky and a slow cinematic drone orbit. Desktop: soft shadows, AO, depth of field, bloom.
// Phones: shadows + bloom only, lower resolution. Disposed when the player enters.
export function startPreview(canvas: HTMLCanvasElement): () => void {
  // Decorative background only — never steal Sign up / Sign in taps.
  canvas.style.pointerEvents = 'none'
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 820
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: coarse ? 'low-power' : 'high-performance' })
    renderer.debug.checkShaderErrors = import.meta.env.DEV // no compile stalls on the title screen
  } catch {
    canvas.hidden = true
    document.getElementById('menu')?.classList.add('menu-fallback')
    return () => {}
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.style.opacity = '0' })
  canvas.addEventListener('webglcontextrestored', () => { canvas.style.opacity = '' })
  // Phones drew the title preview at 0.8x, which looked soft next to the crisp title card.
  renderer.setPixelRatio(coarse ? Math.min(1.15, devicePixelRatio) : Math.min(1.5, devicePixelRatio))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.78
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Phones: no shadow maps (some mobile GPUs return an all-shadow depth map = black ground).
  renderer.shadowMap.enabled = !coarse
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600)
  const blank = new THREE.Texture()
  const world = createWorld({
    scene,
    anisotropy: Math.min(16, renderer.capabilities.getMaxAnisotropy()),
    mark: blank,
    aspect: 0.86,
    reduceMotion: false,
    rankLabel: 'Shrimp',
    getSeries: () => ({ unit: [], meme: [] }),
  })
  applyEnvironment(renderer, scene)
  const grade = coarse ? 'low' : 'high'
  const crowd = createCrowd(scene)
  const traffic = createTraffic(scene, world.lanes, grade)
  const skyline = createSkyline(scene, grade)
  const ambient = createAmbient(scene, world.obstacles, coarse)
  const sky = createPhysicalSky(scene)
  // Clean cinematic shot: no name plates, label cards or floating markers (the game keeps them).
  const hideLabels = () => scene.traverse((o) => {
    if ((o as THREE.Sprite).isSprite && o.scale.x < 50) o.visible = false
    if (o.name === 'home-marker') o.visible = false
  })
  hideLabels()
  let relabel = 0
  const PHASE = 0.69 // golden hour
  world.setDaylight(PHASE)
  sky.setPhase(PHASE)
  world.sun.castShadow = !coarse
  // Phones: same light as desktop. Firm shadow bias (no acne darkening), and a little more fill so
  // backlit figures never read as silhouettes on small, dim screens.
  world.sun.shadow.bias = -0.0004
  world.sun.shadow.normalBias = 0.04
  if (coarse) {
    renderer.toneMappingExposure = 0.98
    scene.environmentIntensity = 0.55
    scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x6b5a48, 0.45), new THREE.AmbientLight(0xfff4e6, 0.35))
  }
  world.sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048)
  const cam = world.sun.shadow.camera
  cam.left = cam.bottom = -40
  cam.right = cam.top = 40
  cam.far = 120
  cam.updateProjectionMatrix()
  if (scene.fog instanceof THREE.FogExp2) scene.fog.density = 0.0055

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: coarse ? THREE.UnsignedByteType : THREE.HalfFloatType, samples: coarse ? 0 : 4 }))
  composer.addPass(new RenderPass(scene, camera))
  if (!coarse) {
    try {
      const ao = new GTAOPass(scene, camera, 1, 1)
      ao.blendIntensity = 0.8
      keepFoliageOutOfAO(ao, scene) // no pale squares round the leaves or a disc in each crown
      composer.addPass(ao)
    } catch { /* AO optional */ }
  }
  // Bloom barely on: Zahra MacBook showed blown-out white panels behind buildings.
  if (!coarse) composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.018, 0.55, 0.985))
  composer.addPass(new OutputPass())

  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  addEventListener('resize', resize)
  const focus = new THREE.Vector3()
  const look = new THREE.Vector3()
  let raf = 0
  let last = performance.now()
  let t = 0
  // The preview must never make the title card slow to answer. It measures what a frame costs the main thread
  // and lowers its own frame rate on slow phones (30, 20, 15 or 10 fps), pauses for a moment whenever the
  // player touches or types (so Sign in and Continue answer at once), and stops while a sign-in dialog covers it.
  let frameGap = coarse ? 33 : 16
  let cost = 0
  let hush = 0
  const press = () => { hush = performance.now() + 700 }
  addEventListener('pointerdown', press, { capture: true, passive: true })
  addEventListener('keydown', press, { capture: true })
  // Compile every shader before the first frame, without blocking: drawing first made the browser wait for each
  // shader to finish (seconds on a slow phone, with the title card frozen). Until then the card shows its sky.
  let ready = false
  let told = false
  void Promise.race([renderer.compileAsync(scene, camera).catch(() => undefined), new Promise((r) => window.setTimeout(r, 6000))]).then(() => { ready = true })
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (!ready || document.hidden || now < hush || now - last < frameGap) return
    if (document.getElementById('login-dlg')) { last = now; return }
    const began = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    // Cinematic drone: slow orbit, gentle height breathing, look target drifting over the plaza.
    const a = 0.6 + t * 0.035
    const r = 30 + Math.sin(t * 0.07) * 4
    camera.position.set(Math.cos(a) * r, 20 + Math.sin(t * 0.11) * 3, Math.sin(a) * r)
    look.set(Math.cos(a + 2.4) * 6, 3, Math.sin(a + 2.4) * 6)
    camera.lookAt(look)
    focus.set(look.x, 0, look.z)
    world.tick(t, focus)
    const people = crowd.tick(dt)
    traffic.tick(dt, t, focus, people)
    skyline.tick(t, 0.15)
    ambient.tick(t, focus, 0.1)
    relabel += dt
    if (relabel > 2) { relabel = 0; hideLabels() }
    composer.render(dt)
    // boot.ts holds back the city warm-up until the title has drawn once (slow phone lines).
    if (!told) { told = true; window.dispatchEvent(new Event('gd-preview-ready')) }
    cost = cost ? cost * 0.85 + (performance.now() - began) * 0.15 : performance.now() - began
    frameGap = coarse ? (cost > 30 ? 100 : cost > 18 ? 66 : cost > 10 ? 50 : 33) : (cost > 20 ? 33 : 16)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('pointerdown', press, { capture: true })
    removeEventListener('keydown', press, { capture: true })
    removeEventListener('resize', resize)
    try { composer.dispose() } catch { /* */ }
    try { renderer.dispose() } catch { /* */ }
    // Never forceContextLoss — poisons the next WebGL context on Mac Safari/Chrome.
    try { canvas.remove() } catch { /* */ }
  }
}
