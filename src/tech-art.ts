import * as THREE from 'three'
import { createDrone, spinDrone } from './drones.ts'
import type { Graphics } from './logic.ts'
import './tech-art.css'

const canvas = document.querySelector<HTMLCanvasElement>('#art-view')
const qualityInput = document.querySelector<HTMLSelectElement>('#quality')
const exposureInput = document.querySelector<HTMLInputElement>('#exposure')
const exposureValue = document.querySelector<HTMLElement>('#exposure-value')
const fpsLabel = document.querySelector<HTMLElement>('#fps')
const deviceLabel = document.querySelector<HTMLElement>('#device')
if (!canvas || !qualityInput || !exposureInput || !exposureValue || !fpsLabel || !deviceLabel) {
  throw new Error('The art test controls could not be mounted.')
}

const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !mobile,
  powerPreference: 'high-performance',
  failIfMajorPerformanceCaveat: false,
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = Number(exposureInput.value)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x51404a)
scene.fog = new THREE.Fog(0x51404a, 11, 22)
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60)
const target = new THREE.Vector3(0, 1.05, 0)
let yaw = 0.55
let pitch = 0.24
let distance = 8.8

const material = (color: number, roughness = 0.75, metalness = 0, flatShading = true) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading })
const wood = material(0x8b5c3f, 0.86)
const darkWood = material(0x543b31, 0.88)
const plaster = material(0xb79779, 0.94)
const green = material(0x2c5548, 0.72)
const brass = material(0xd29b55, 0.28, 0.72)
const charcoal = material(0x252a2a, 0.42, 0.42)
const cushion = material(0x675260, 0.9)
const addBox = (
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  surface: THREE.Material,
  cast = true,
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), surface)
  mesh.position.set(...position)
  mesh.castShadow = cast
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
const addCanvasLabel = (title: string, subtitle: string) => {
  const art = document.createElement('canvas')
  art.width = 512
  art.height = 256
  const context = art.getContext('2d')
  if (!context) throw new Error('Could not paint the art-lab sign.')
  context.fillStyle = '#2c352f'
  context.fillRect(0, 0, art.width, art.height)
  context.strokeStyle = '#d8ac76'
  context.lineWidth = 12
  context.strokeRect(12, 12, art.width - 24, art.height - 24)
  context.fillStyle = '#fff0d8'
  context.textAlign = 'center'
  context.font = '700 46px system-ui, sans-serif'
  context.fillText(title, 256, 108)
  context.fillStyle = '#b9e7c5'
  context.font = '600 22px system-ui, sans-serif'
  context.fillText(subtitle, 256, 156)
  const texture = new THREE.CanvasTexture(art)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
}

const room = new THREE.Group()
scene.add(room)
addBox(room, [8, 0.14, 5.6], [0, -0.07, 0], darkWood)
addBox(room, [8, 3.7, 0.16], [0, 1.78, -2.8], plaster)
addBox(room, [0.16, 3.7, 5.6], [-3.92, 1.78, 0], green)
addBox(room, [8, 0.12, 0.16], [0, 0.05, -2.68], brass, false)
addBox(room, [0.16, 0.12, 5.6], [-3.82, 0.05, 0], brass, false)

// A warm divided window and a small pinboard make the wall readable at a glance.
addBox(room, [1.5, 1.2, 0.08], [-2.45, 2.05, -2.68], charcoal, false)
for (const x of [-2.78, -2.12]) addBox(room, [0.06, 1.18, 0.08], [x, 2.05, -2.62], brass, false)
for (const y of [1.5, 2.58]) addBox(room, [1.45, 0.06, 0.08], [-2.45, y, -2.62], brass, false)
const windowGlass = new THREE.MeshStandardMaterial({
  color: 0xffc28a,
  emissive: 0xff8b52,
  emissiveIntensity: 0.46,
  roughness: 0.35,
  metalness: 0.08,
})
addBox(room, [0.58, 1.02, 0.035], [-2.76, 2.05, -2.61], windowGlass, false)
addBox(room, [0.58, 1.02, 0.035], [-2.14, 2.05, -2.61], windowGlass, false)
const notice = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), addCanvasLabel('FIELD LAB', 'WARM LIGHT · MOBILE'))
notice.position.set(0.55, 2.3, -2.68)
room.add(notice)
addBox(room, [2.1, 0.05, 0.06], [0.55, 1.82, -2.66], brass, false)

// Low desk with real furniture proportions, a monitor, books and three recognizable gadgets.
addBox(room, [2.35, 0.14, 0.94], [0.25, 0.86, 0.3], wood)
for (const x of [-0.72, 1.22]) {
  for (const z of [-0.03, 0.63]) addBox(room, [0.1, 0.78, 0.1], [x, 0.4, z], darkWood)
}
addBox(room, [0.58, 0.22, 0.72], [0.87, 0.68, 0.26], darkWood)
addBox(room, [0.48, 0.38, 0.07], [0.87, 0.66, 0.64], brass, false)
addBox(room, [0.1, 0.34, 0.1], [0.02, 1.08, 0.13], charcoal)
addBox(room, [0.82, 0.55, 0.08], [0.02, 1.48, 0.13], charcoal)
const screen = new THREE.MeshBasicMaterial({ color: 0x73bc9a, toneMapped: false })
addBox(room, [0.72, 0.43, 0.018], [0.02, 1.48, 0.175], screen, false)
addBox(room, [0.34, 0.035, 0.16], [-0.5, 0.96, 0.21], green)
addBox(room, [0.34, 0.035, 0.16], [-0.5, 1.01, 0.21], wood)
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.2, 7), terracotta())
pot.position.set(-0.7, 1.03, 0.2)
pot.castShadow = true
room.add(pot)
for (const [x, y, z, scale] of [[-0.76, 1.22, 0.2, 0.18], [-0.62, 1.2, 0.21, 0.16], [-0.69, 1.26, 0.28, 0.17]] as const) {
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(scale * 0.48, scale, 5), green)
  leaf.position.set(x, y, z)
  leaf.castShadow = true
  room.add(leaf)
}
const droneIds = ['scout', 'courier', 'halo'] as const
const drones: THREE.Group[] = []
for (const [index, id] of droneIds.entries()) {
  const drone = createDrone(id)
  drone.scale.setScalar(1.55)
  drone.position.set(-0.25 + index * 0.45, 1.03, -0.03)
  room.add(drone)
  drones.push(drone)
}

// Bentwood stool and open shelves provide scale and block out the storage corner.
addBox(room, [0.6, 0.1, 0.56], [-1.72, 0.63, 1.18], cushion)
addBox(room, [0.6, 0.72, 0.08], [-1.72, 1.02, 1.43], wood)
for (const x of [-1.95, -1.49]) {
  for (const z of [0.98, 1.38]) addBox(room, [0.06, 0.59, 0.06], [x, 0.31, z], darkWood)
}
for (const y of [0.55, 1.35, 2.12]) addBox(room, [0.9, 0.08, 0.4], [3.0, y, -2.46], wood)
for (const [x, y, color] of [[2.7, 0.84, 0x9d7658], [3.0, 0.84, 0x456c5b], [3.31, 0.84, 0xd69b62], [2.84, 1.65, 0xc68b56], [3.18, 1.65, 0x5e7867]] as const) {
  const book = addBox(room, [0.22, 0.48, 0.27], [x, y, -2.46], material(color, 0.9), false)
  book.rotation.z = (x - 3) * 0.08
}
addBox(room, [0.48, 0.28, 0.32], [3.0, 0.73, -2.43], charcoal)
addBox(room, [0.42, 0.06, 0.03], [3.0, 0.74, -2.25], brass, false)

// Practical lamp uses a restrained point light and a visible emissive shade.
addBox(room, [0.32, 0.07, 0.32], [1.0, 0.99, 0.05], brass)
const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 7), brass)
lampStem.position.set(1.0, 1.22, 0.05)
room.add(lampStem)
const lampShade = new THREE.Mesh(
  new THREE.CylinderGeometry(0.2, 0.12, 0.2, 8),
  new THREE.MeshStandardMaterial({ color: 0xffd29a, emissive: 0xffa958, emissiveIntensity: 1.2, roughness: 0.48 }),
)
lampShade.position.set(1.0, 1.52, 0.05)
lampShade.castShadow = true
room.add(lampShade)
const practical = new THREE.PointLight(0xffb873, 1.25, 5.2, 2)
practical.position.set(1.0, 1.45, 0.05)
practical.castShadow = false
scene.add(practical)

const hemi = new THREE.HemisphereLight(0xffe5c7, 0x394b42, 0.9)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffd8ad, 1.35)
sun.position.set(-3.6, 6.5, 4.5)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = -5
sun.shadow.camera.right = 5
sun.shadow.camera.top = 5
sun.shadow.camera.bottom = -4
sun.shadow.bias = -0.0003
scene.add(sun)
sun.target.position.set(0, 0.7, 0)
scene.add(sun.target)
const fill = new THREE.DirectionalLight(0xa5d8c1, 0.28)
fill.position.set(4, 3.4, 1)
scene.add(fill)

function terracotta(): THREE.MeshStandardMaterial {
  return material(0xb66d4c, 0.94)
}

function setGraphics(level: Graphics): void {
  const cap = level === 'high' ? (mobile ? 1.35 : 1.65) : level === 'medium' ? 1.15 : 1
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap))
  renderer.shadowMap.enabled = level !== 'low'
  sun.castShadow = level !== 'low'
  sun.shadow.mapSize.set(level === 'high' ? 1536 : 768, level === 'high' ? 1536 : 768)
  practical.intensity = level === 'high' ? 1.55 : level === 'medium' ? 0.8 : 0
  hemi.intensity = level === 'high' ? 1.05 : level === 'medium' ? 0.82 : 0.68
  fill.intensity = level === 'low' ? 0.12 : level === 'medium' ? 0.22 : 0.3
  scene.fog = level === 'low' ? null : new THREE.Fog(0x51404a, 11, level === 'high' ? 22 : 25)
  renderer.setSize(window.innerWidth, window.innerHeight, false)
}

qualityInput.addEventListener('change', () => setGraphics(qualityInput.value as Graphics))
exposureInput.addEventListener('input', () => {
  renderer.toneMappingExposure = Number(exposureInput.value)
  exposureValue.textContent = Number(exposureInput.value).toFixed(2)
})
setGraphics(qualityInput.value as Graphics)
deviceLabel.textContent = mobile ? 'Coarse-pointer profile' : 'Desktop profile'

let dragging = false
let lastX = 0
let lastY = 0
let pinchDistance = 0
const activePointers = new Map<number, { x: number; y: number }>()
const pointerDistance = () => {
  const points = [...activePointers.values()]
  const first = points[0]
  const second = points[1]
  return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0
}
canvas.addEventListener('pointerdown', (event) => {
  if ((event.target as Element).closest('.art-panel')) return
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  canvas.setPointerCapture(event.pointerId)
  if (activePointers.size === 1) {
    dragging = true
    lastX = event.clientX
    lastY = event.clientY
  } else {
    dragging = false
    pinchDistance = pointerDistance()
  }
})
canvas.addEventListener('pointermove', (event) => {
  if (!activePointers.has(event.pointerId)) return
  const previous = activePointers.get(event.pointerId)
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (activePointers.size > 1) {
    const nextDistance = pointerDistance()
    if (pinchDistance > 0 && nextDistance > 0) distance = THREE.MathUtils.clamp(distance + (pinchDistance - nextDistance) * 0.018, 6.2, 12.5)
    pinchDistance = nextDistance
    return
  }
  if (!dragging || !previous) return
  yaw -= (event.clientX - lastX) * 0.006
  pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * 0.004, 0.08, 0.72)
  lastX = event.clientX
  lastY = event.clientY
})
const endDrag = (event: PointerEvent) => {
  activePointers.delete(event.pointerId)
  pinchDistance = 0
  dragging = activePointers.size === 1
  if (dragging) {
    const remaining = activePointers.values().next().value as { x: number; y: number } | undefined
    if (remaining) {
      lastX = remaining.x
      lastY = remaining.y
    }
  }
}
canvas.addEventListener('pointerup', endDrag)
canvas.addEventListener('pointercancel', endDrag)
canvas.addEventListener('wheel', (event) => {
  event.preventDefault()
  distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.006, 6.2, 12.5)
}, { passive: false })
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight)
  camera.updateProjectionMatrix()
  setGraphics(qualityInput.value as Graphics)
})

let last = performance.now()
let fpsElapsed = 0
let fpsFrames = 0
let elapsed = 0
const frame = (now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  elapsed += dt
  fpsElapsed += dt
  fpsFrames += 1
  if (fpsElapsed >= 0.5) {
    fpsLabel.textContent = `${Math.round(fpsFrames / fpsElapsed)} FPS`
    fpsElapsed = 0
    fpsFrames = 0
  }
  const horizontal = distance * Math.cos(pitch)
  camera.position.set(
    target.x + Math.sin(yaw) * horizontal,
    target.y + distance * Math.sin(pitch),
    target.z + Math.cos(yaw) * horizontal,
  )
  camera.lookAt(target)
  for (const [index, drone] of drones.entries()) spinDrone(drone, dt, elapsed + index * 0.25)
  lampShade.material instanceof THREE.MeshStandardMaterial && (lampShade.material.emissiveIntensity = 1.05 + Math.sin(elapsed * 1.4) * 0.08)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
