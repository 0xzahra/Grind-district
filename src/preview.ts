import * as THREE from 'three'
import { HOUSES } from './houses.ts'

// Title-screen live preview: a light model of the whole district with an orbiting camera and
// NPCs walking, trading at desks and sitting at the café. Transparent canvas, ~30 fps, disposed on play.
const BLOCKS: Array<[number, number, number, number, number, number]> = [
  // x, z, w, d, h, colour
  [0, -48, 16, 11, 6, 0xd8cfc0], [16, -54, 8, 7, 5, 0xcfc4b2], [-16, -54, 8, 7, 4, 0xd6c9b5],
  [-48, 0, 12, 16, 8, 0xc9bfae], [48, 0, 12, 16, 9, 0xd2c6b3], [0, 48, 16, 11, 5, 0xbfb4a2],
  [22, -22, 8, 7, 4.5, 0xe0d6c6], [-22, -22, 8, 8, 5, 0xc8bca8], [28, -16, 8, 6, 4, 0xd9cdb9],
  [-28, 16, 4.4, 2.6, 3, 0xcfc3b0], [-16, 14, 5.4, 4.2, 3.5, 0xd5c9b4],
]

export function startPreview(canvas: HTMLCanvasElement): () => void {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !matchMedia('(pointer: coarse)').matches, powerPreference: 'low-power' })
  } catch {
    canvas.hidden = true
    return () => {}
  }
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio))
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x2a2420, 70, 170)
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 400)
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a3128, 1.1))
  const sun = new THREE.DirectionalLight(0xffd6a0, 2.2)
  sun.position.set(-60, 70, 40)
  scene.add(sun)
  const m = (c: number, r = 1.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r })
  const ground = new THREE.Mesh(new THREE.CircleGeometry(72, 48), m(0x6e675e, 1))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const road = m(0x2a2b2e, 0.5)
  for (const [w, d] of [[124, 6.4], [6.4, 124]] as const) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), road)
    scene.add(r)
  }
  const roof = m(0x3b3f46, 0.7)
  const trim = new THREE.MeshStandardMaterial({ color: 0xd9b26a, metalness: 0.8, roughness: 0.45 })
  const addBlock = (x: number, z: number, w: number, d: number, h: number, c: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c))
    b.position.set(x, h / 2, z)
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4), roof)
    cap.position.set(x, h + 0.17, z)
    scene.add(b, cap)
  }
  for (const b of BLOCKS) addBlock(...b)
  for (const h of HOUSES) {
    addBlock(h.x, h.z, h.w, h.d, h.h, 0xe6dccb)
    const gable = new THREE.Mesh(new THREE.ConeGeometry(h.w * 0.62, 1.8, 4), roof)
    gable.position.set(h.x, h.h + 0.9, h.z)
    gable.rotation.y = Math.PI / 4
    scene.add(gable)
  }
  // Church with spire.
  addBlock(24, 27, 8, 11, 6, 0xd8cfc0)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 13, 3), m(0xd0c6b5))
  tower.position.set(24, 6.5, 20)
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.1, 6, 8), roof)
  spire.position.set(24, 16, 20)
  scene.add(tower, spire)
  // Plaza basin and trees.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 32), new THREE.MeshStandardMaterial({ color: 0x2a5566, roughness: 0.1, metalness: 0.4 }))
  scene.add(basin)
  const crown = new THREE.MeshStandardMaterial({ color: 0x4f7a3c, roughness: 0.9, flatShading: true })
  const trees = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.4, 0), crown, 40)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const r = i % 2 ? 11 : 34
    dummy.position.set(Math.cos(a) * r, 2.2, Math.sin(a) * r)
    dummy.scale.setScalar(0.8 + ((i * 37) % 10) / 20)
    dummy.updateMatrix()
    trees.setMatrixAt(i, dummy.matrix)
  }
  scene.add(trees)
  // NPCs: walkers on loops, traders at desks inside the trading floor's forecourt, café sitters.
  const body = new THREE.CapsuleGeometry(0.55, 1.5, 3, 8)
  const outfits = [0x2a3b5c, 0x8c2f39, 0xe8dcc8, 0x3d4a3f, 0x6b5a45, 0xc77d3a]
  type Npc = { mesh: THREE.Mesh; kind: 'walk' | 'trade' | 'cafe'; a: number; r: number; s: number; x: number; z: number }
  const npcs: Npc[] = []
  const addNpc = (kind: Npc['kind'], x: number, z: number, a = 0, r = 0, s = 0) => {
    const mesh = new THREE.Mesh(body, m(outfits[npcs.length % outfits.length]!))
    mesh.position.set(x, 1.3, z)
    scene.add(mesh)
    npcs.push({ mesh, kind, a, r, s, x, z })
  }
  for (let i = 0; i < 26; i++) addNpc('walk', 0, 0, (i / 26) * Math.PI * 2, i % 2 ? 7.5 : 20, (i % 3 ? 1 : -1) * (0.05 + (i % 5) * 0.012))
  const desk = m(0x3a2a20, 0.6)
  for (let i = 0; i < 6; i++) {
    const x = -40 + (i % 3) * 2.4
    const z = -4 + Math.floor(i / 3) * 4
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.8), desk)
    t.position.set(x, 0.4, z)
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), new THREE.MeshStandardMaterial({ color: 0x15181c, emissive: 0xd9b26a, emissiveIntensity: 0.25 }))
    screen.position.set(x, 1.05, z - 0.2)
    scene.add(t, screen)
    addNpc('trade', x, z + 0.8)
  }
  for (let i = 0; i < 4; i++) {
    const x = 26 + (i % 2) * 3
    const z = -11 + Math.floor(i / 2) * 2.5
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.75, 12), trim)
    t.position.set(x, 0.37, z)
    scene.add(t)
    addNpc('cafe', x + 0.8, z)
  }
  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  addEventListener('resize', resize)
  let raf = 0
  let last = 0
  let t = 0
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (document.hidden || now - last < 33) return
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    t += dt
    const a = t * 0.06
    camera.position.set(Math.cos(a) * 62, 30, Math.sin(a) * 62)
    camera.lookAt(0, 2, 0)
    for (const n of npcs) {
      if (n.kind === 'walk') {
        n.a += n.s * dt
        n.mesh.position.set(Math.cos(n.a) * n.r, 1.3 + Math.abs(Math.sin(t * 6 + n.r)) * 0.08, Math.sin(n.a) * n.r)
      } else if (n.kind === 'trade') {
        n.mesh.rotation.z = Math.sin(t * 2 + n.x) * 0.06
      } else {
        n.mesh.position.y = 0.6 + Math.sin(t * 1.5 + n.z) * 0.03
      }
    }
    renderer.render(scene, camera)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('resize', resize)
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
}
