import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createWorld } from './world.ts'
import { createCrowd } from './npcs.ts'
import { createTraffic } from './traffic.ts'
import { createSkyline } from './skyline.ts'
import { createAmbient } from './ambient.ts'
import { createPhysicalSky } from './sky.ts'
import { applyEnvironment } from './quality.ts'

// Title-screen preview: the REAL city (same world, townspeople, traffic, skyline, ambient life) at golden hour
// with a physical sky and a slow cinematic drone orbit. Desktop: soft shadows, AO, depth of field, bloom.
// Phones: shadows + bloom only, lower resolution. Disposed when the player enters.
export function startPreview(canvas: HTMLCanvasElement): () => void {
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 820
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: coarse ? 'low-power' : 'high-performance' })
  } catch {
    canvas.hidden = true
    return () => {}
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.style.opacity = '0' })
  canvas.addEventListener('webglcontextrestored', () => { canvas.style.opacity = '' })
  renderer.setPixelRatio(coarse ? Math.min(0.8, devicePixelRatio) : Math.min(1.5, devicePixelRatio))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Phones: no shadow maps (some mobile GPUs return an all-shadow depth map = black ground).
  renderer.shadowMap.enabled = !coarse
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600)
  const blank = new THREE.Texture()
  const world = createWorld({
    scene,
    anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
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
    renderer.toneMappingExposure = 1.08
    scene.environmentIntensity = 0.75
    scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x6b5a48, 0.45), new THREE.AmbientLight(0xfff4e6, 0.35))
  }
  world.sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048)
  const cam = world.sun.shadow.camera
  cam.left = cam.bottom = -40
  cam.right = cam.top = 40
  cam.far = 120
  cam.updateProjectionMatrix()
  if (scene.fog instanceof THREE.FogExp2) scene.fog.density = 0.0032

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: coarse ? THREE.UnsignedByteType : THREE.HalfFloatType, samples: coarse ? 0 : 4 }))
  composer.addPass(new RenderPass(scene, camera))
  let bokeh: BokehPass | null = null
  if (!coarse) {
    try {
      const ao = new GTAOPass(scene, camera, 1, 1)
      ao.blendIntensity = 0.8
      composer.addPass(ao)
    } catch { /* AO optional */ }
    bokeh = new BokehPass(scene, camera, { focus: 45, aperture: 0.00012, maxblur: 0.006 })
    composer.addPass(bokeh)
  }
  if (!coarse) composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.6, 0.88))
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
  const frameGap = coarse ? 33 : 16
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (document.hidden || now - last < frameGap) return
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    // Cinematic drone: slow orbit, gentle height breathing, look target drifting over the plaza.
    const a = 0.6 + t * 0.035
    const r = 30 + Math.sin(t * 0.07) * 4
    camera.position.set(Math.cos(a) * r, 20 + Math.sin(t * 0.11) * 3, Math.sin(a) * r)
    look.set(Math.cos(a + 2.4) * 6, 3, Math.sin(a + 2.4) * 6)
    camera.lookAt(look)
    if (bokeh) (bokeh.uniforms as Record<string, { value: number }>).focus!.value = camera.position.distanceTo(look)
    focus.set(look.x, 0, look.z)
    world.tick(t, focus)
    const people = crowd.tick(dt)
    traffic.tick(dt, t, focus, people)
    skyline.tick(t, 0.15)
    ambient.tick(t, focus, 0.1)
    relabel += dt
    if (relabel > 2) { relabel = 0; hideLabels() }
    composer.render(dt)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('resize', resize)
    composer.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
}
