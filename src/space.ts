// Grind Orbital: a spaceport on the coast east of the runway, and a seated trip to orbit and back. Original
// designs (rocket, capsule and company are made up). The trip, about two minutes:
//   countdown on the pad (steam, the access arm swings away) -> liftoff (plume, smoke, rumble, shake) -> climb
//   out over the sea -> main engine cut-off and stage separation -> orbit 400 km up: the curved Earth turning
//   below, a thin blue atmosphere, stars, the second stage drifting away, the camera drifting round the capsule
//   -> de-orbit burn and re-entry (plasma glow) -> three parachutes over the sea off the
//   city -> splashdown. Space is a separate set high above the world; main.ts darkens the sky while you're there.
import * as THREE from 'three'
import type { Hotspot } from './world.ts'
import type { Arch } from './homes.ts'
import type { TravelCtx } from './travel.ts'
import { std, put, cube, tex, sign } from './travel.ts'
import { spendInGame } from './state.ts'
import { adjust } from './needs.ts'

export const ORBIT_USD = 2500
const PAD = { x: 382, z: -34 }
const O = new THREE.Vector3(6000, 40000, 6000) // where space is: far from anything in the city
const R_EARTH = 8000, ALT = 400

// ---------------------------------------------------------------- textures

function noise2(seed: number) {
  const p = new Uint8Array(512)
  let s = seed
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j]!, p[i]!] }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i]!
  const g = (h: number, x: number, y: number) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y)
  const f = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255
    x -= Math.floor(x); y -= Math.floor(y)
    const u = f(x), v = f(y)
    const a = p[X]! + Y, b = p[X + 1]! + Y
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(g(p[a]!, x, y), g(p[b]!, x - 1, y), u), THREE.MathUtils.lerp(g(p[a + 1]!, x, y - 1), g(p[b + 1]!, x - 1, y - 1), u), v) * 0.7 + 0.5
  }
}
/** Earth: oceans, continents with forests, grassland and deserts by latitude, ice caps (equirectangular). */
function earthTextures(): { day: THREE.CanvasTexture; clouds: THREE.CanvasTexture } {
  const W = 1024, H = 512
  const n = noise2(7), m = noise2(19)
  const day = document.createElement('canvas'); day.width = W; day.height = H
  const g = day.getContext('2d')!
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI
    for (let x = 0; x < W; x++) {
      // Wrap round in longitude by sampling the noise on a circle.
      const a = (x / W) * Math.PI * 2
      const cx = Math.cos(a) * 1.6 + 8, cy = Math.sin(a) * 1.6 + 8, cz = y / H * 3.2
      const h = n(cx + cz * 0.7, cy - cz) * 0.6 + n(cx * 2.3 + 5, cy * 2.3 + cz * 2) * 0.3 + n(cx * 5 + 9, cy * 5 - cz * 4) * 0.1
      const dry = m(cx * 1.4 + 3, cy * 1.4 + cz)
      const k = (y * W + x) * 4
      let r: number, gg: number, b: number
      const ice = Math.abs(lat) > 1.22 + (h - 0.5) * 0.2
      if (ice) { r = 236; gg = 242; b = 246 }
      else if (h < 0.52) { const d = Math.max(0, (0.52 - h) / 0.3); r = 12 + 10 * (1 - d); gg = 52 + 40 * (1 - d); b = 104 + 50 * (1 - d) }
      else {
        const desert = Math.abs(Math.abs(lat) - 0.42) < 0.22 && dry > 0.5
        const t = Math.min(1, (h - 0.52) / 0.25)
        if (desert) { r = 196 - t * 20; gg = 164 - t * 20; b = 108 - t * 10 } else { r = 58 + t * 40; gg = 98 + t * 18; b = 44 + t * 10 }
      }
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const cl = document.createElement('canvas'); cl.width = W; cl.height = H
  const c2 = cl.getContext('2d')!
  const im2 = c2.createImageData(W, H)
  const q = noise2(41)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = (x / W) * Math.PI * 2
    const cx = Math.cos(a) * 2.2 + 4, cy = Math.sin(a) * 2.2 + 4, cz = y / H * 5
    const v = q(cx * 1.5 + cz, cy * 1.5 - cz) * 0.6 + q(cx * 4 + 2, cy * 4 + cz * 3) * 0.4
    const k = (y * W + x) * 4
    im2.data[k] = im2.data[k + 1] = im2.data[k + 2] = 255
    im2.data[k + 3] = Math.max(0, Math.min(255, (v - 0.55) * 900))
  }
  c2.putImageData(im2, 0, 0)
  const t1 = new THREE.CanvasTexture(day); t1.colorSpace = THREE.SRGBColorSpace; t1.anisotropy = 4
  const t2 = new THREE.CanvasTexture(cl); t2.colorSpace = THREE.SRGBColorSpace
  return { day: t1, clouds: t2 }
}

// ---------------------------------------------------------------- the rocket

type Rocket = { group: THREE.Group; stage1: THREE.Group; stage2: THREE.Group; capsule: THREE.Group; plume: THREE.Group; plume2: THREE.Group; chutes: THREE.Group; plasma: THREE.Mesh; floaty: THREE.Object3D; seat: THREE.Vector3; inner: THREE.Group }
function rocket(): Rocket {
  const white = std(0xf3f3ef, 0.32, 0.1), black = std(0x17181b, 0.45, 0.3), metal = std(0x9aa1a8, 0.3, 0.8)
  const group = new THREE.Group()
  // First stage: 40 m, nine engines, grid fins, folded legs, a black interstage.
  const stage1 = new THREE.Group(); group.add(stage1)
  put(stage1, new THREE.CylinderGeometry(1.85, 1.85, 40, 28), white, 0, 21, 0)
  for (const y of [8, 30]) put(stage1, new THREE.CylinderGeometry(1.87, 1.87, 0.5, 28), black, 0, y, 0)
  put(stage1, new THREE.CylinderGeometry(1.86, 1.86, 3, 28), black, 0, 42.5, 0)
  for (let k = 0; k < 9; k++) { const a = (k / 8) * Math.PI * 2, r = k === 8 ? 0 : 1.15; put(stage1, new THREE.ConeGeometry(0.42, 1.0, 14, 1, true), std(0x3a3d42, 0.4, 0.7, { side: THREE.DoubleSide }), Math.cos(a) * r, 0.6, Math.sin(a) * r) }
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; const fin = cube(stage1, 1.2, 0.08, 1.0, metal, Math.cos(a) * 2.3, 40.4, Math.sin(a) * 2.3); fin.rotation.y = -a; const legM = cube(stage1, 0.28, 9, 0.18, black, Math.cos(a) * 1.95, 5.5, Math.sin(a) * 1.95); legM.rotation.y = -a }
  const logo = sign('GRIND', 14, 2.2, { fg: '#111111', weight: 900 })
  logo.rotation.set(0, 0, Math.PI / 2); logo.position.set(0, 20, 1.88); stage1.add(logo)
  // Second stage and its engine.
  const stage2 = new THREE.Group(); stage2.position.y = 44; group.add(stage2)
  put(stage2, new THREE.CylinderGeometry(1.85, 1.85, 12, 28), white, 0, 6, 0)
  put(stage2, new THREE.ConeGeometry(1.2, 2.4, 24, 1, true), std(0x2b2d31, 0.35, 0.8, { side: THREE.DoubleSide }), 0, -0.8, 0)
  // Capsule on its trunk.
  const capsule = new THREE.Group(); capsule.position.y = 56; group.add(capsule)
  const cells = tex(256, 64, (c) => { c.fillStyle = '#e9e9e4'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#1b2a4a'; for (let i = 0; i < 16; i++) c.fillRect(i * 16 + 2, 8, 12, 48) })
  put(capsule, new THREE.CylinderGeometry(1.85, 1.85, 2.4, 28), std(0xffffff, 0.4, 0.2, { map: cells }), 0, 1.2, 0)
  put(capsule, new THREE.CylinderGeometry(1.9, 1.9, 0.25, 28), std(0x2a211b, 0.8), 0, 2.52, 0)
  const skin = tex(512, 128, (c) => {
    c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, 512, 128)
    c.fillStyle = '#10151c'; for (let i = 0; i <= 4; i++) { c.beginPath(); c.roundRect(i * 128 - 20, 46, 40, 34, 9); c.fill() }
    c.fillStyle = '#14a058'; c.font = `900 22px "Inter Variable", Inter, system-ui, sans-serif`; c.fillText('GRIND ORBITAL', 300, 104)
  })
  put(capsule, new THREE.CylinderGeometry(0.78, 1.85, 3.4, 28, 1, false), std(0xffffff, 0.3, 0.15, { map: skin }), 0, 4.35, 0)
  put(capsule, new THREE.SphereGeometry(0.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), white, 0, 6.05, 0)
  put(capsule, new THREE.TorusGeometry(0.5, 0.06, 8, 24), metal, 0, 6.6, 0).rotation.x = Math.PI / 2
  // Inside: a dark shell with windows cut in it (you see out through them), three couches, glowing screens.
  const inner = new THREE.Group(); inner.position.y = 2.65; capsule.add(inner)
  const shellTex = tex(512, 128, (c) => { c.fillStyle = '#1d2026'; c.fillRect(0, 0, 512, 128); c.globalCompositeOperation = 'destination-out'; for (let i = 0; i <= 4; i++) { c.beginPath(); c.roundRect(i * 128 - 22, 40, 44, 44, 10); c.fill() } })
  const shellM = new THREE.MeshStandardMaterial({ map: shellTex, alphaTest: 0.5, side: THREE.BackSide, roughness: 0.8 })
  inner.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.72, 3.3, 28, 1, true).translate(0, 1.7, 0), shellM))
  cube(inner, 3.0, 0.06, 3.0, std(0x2a2e35, 0.8), 0, 0.03, 0)
  // Couches face the window on the -z side; a glowing screen below it.
  for (const x of [-0.72, 0, 0.72]) { cube(inner, 0.55, 0.12, 0.6, std(0xe9e9e4, 0.7), x, 0.48, -0.2); const b = cube(inner, 0.55, 0.7, 0.1, std(0xe9e9e4, 0.7), x, 0.85, 0.15); b.rotation.x = 0.25 }
  const screen = cube(inner, 1.2, 0.42, 0.04, std(0x0b1220, 0.25, 0, { emissive: 0x3a7bd5, emissiveIntensity: 0.9 }), 0, 0.95, -1.25, false)
  screen.rotation.x = 0.35
  // The little plush that floats free in orbit.
  const floaty = new THREE.Group()
  put(floaty, new THREE.SphereGeometry(0.12, 12, 8), std(0x2f6fb3, 0.9), 0, 0, 0)
  put(floaty, new THREE.SphereGeometry(0.06, 8, 6), std(0x6aa84f, 0.9), 0.07, 0.06, 0.06)
  floaty.position.set(0.25, 1.45, -0.8); floaty.visible = false; inner.add(floaty)
  // Plumes (first stage, second stage), the re-entry plasma, and parachutes.
  const flame = (len: number, r: number) => {
    const p = new THREE.Group()
    p.add(new THREE.Mesh(new THREE.ConeGeometry(r, len, 18, 1, true).translate(0, -len / 2, 0), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })))
    p.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, len * 0.55, 14, 1, true).translate(0, -len * 0.275, 0), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })))
    return p
  }
  const plume = flame(26, 2.2); plume.position.y = 0.1; plume.visible = false; stage1.add(plume)
  const plume2 = flame(14, 1.3); plume2.position.y = -1.9; plume2.visible = false; stage2.add(plume2)
  const plasma = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))
  plasma.position.y = 2.4; plasma.scale.y = 1.6; plasma.visible = false; capsule.add(plasma)
  const chutes = new THREE.Group(); chutes.visible = false; capsule.add(chutes)
  const stripes = tex(128, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff6a1a'; c.fillRect(i * 16, 0, 16, 64) } })
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2
    const dome = put(chutes, new THREE.SphereGeometry(5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), std(0xffffff, 0.8, 0, { map: stripes, side: THREE.DoubleSide }), Math.cos(a) * 4.2, 22, Math.sin(a) * 4.2, false)
    dome.scale.y = 0.6
    for (let j = 0; j < 4; j++) { const b = (j / 4) * Math.PI * 2; const from = new THREE.Vector3(0, 6.6, 0), to = new THREE.Vector3(Math.cos(a) * 4.2 + Math.cos(b) * 4.5, 20, Math.sin(a) * 4.2 + Math.sin(b) * 4.5); const line = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, from.distanceTo(to), 4), std(0xdddddd, 0.6)); line.position.copy(from).add(to).multiplyScalar(0.5); line.lookAt(to); line.rotateX(Math.PI / 2); chutes.add(line) }
  }
  return { group, stage1, stage2, capsule, plume, plume2, chutes, plasma, floaty, seat: new THREE.Vector3(0, 2.65, -0.2), inner }
}

// ---------------------------------------------------------------- the spaceport and the trip

export function buildSpaceport(A: Arch, X: TravelCtx & { space: (v: number) => void }, desk: { x: number; z: number }): void {
  const g = new THREE.Group(); A.add(0, g)
  const add = (o: THREE.Object3D) => g.add(o)
  // Pad: concrete apron, flame trench, the launch tower with its crew access arm, tanks, water tower, masts.
  const conc = std(0xc9c6bf, 0.9)
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), conc); pad.rotation.x = -Math.PI / 2; pad.position.set(PAD.x, 0.02, PAD.z); pad.receiveShadow = true; add(pad)
  cube(g, 8, 0.1, 22, std(0x2a2a2a, 0.9), PAD.x, 0.03, PAD.z - 12)
  const steel = std(0x8c939b, 0.4, 0.7), red = std(0xb8322a, 0.6, 0.3)
  const tower = new THREE.Group(); tower.position.set(PAD.x + 7, 0, PAD.z)
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) cube(tower, 0.4, 72, 0.4, red, dx, 36, dz)
  for (let y = 4; y < 72; y += 6) { for (const [w, d, dx, dz] of [[4, 0.2, 0, -2], [4, 0.2, 0, 2], [0.2, 4, -2, 0], [0.2, 4, 2, 0]] as const) cube(tower, w, 0.2, d, red, dx, y, dz, false); const br = cube(tower, 0.15, 7.2, 0.15, steel, 0, y + 3, -2, false); br.rotation.z = 0.6 }
  const arm = new THREE.Group(); arm.position.set(-2, 59, 0)
  cube(arm, 4.4, 2.4, 1.8, std(0xf2f2ee, 0.5), -2.2, 1.2, 0)
  arm.add(sign('GRIND ORBITAL', 4, 0.5, { fg: '#14a058', weight: 900 })); arm.children[arm.children.length - 1]!.position.set(-2.2, 2.0, 0.92)
  tower.add(arm); add(tower)
  for (const [x, z, r] of [[PAD.x - 18, PAD.z + 16, 3.4], [PAD.x - 10, PAD.z + 18, 2.6]] as const) { put(g, new THREE.SphereGeometry(r, 20, 14), std(0xf4f4f2, 0.4, 0.2), x, r + 1.2, z); for (const dx of [-1, 1]) cube(g, 0.2, 1.4, 0.2, steel, x + dx * r * 0.6, 0.7, z) }
  put(g, new THREE.SphereGeometry(4, 20, 14), std(0xf4f4f2, 0.4, 0.2), PAD.x + 22, 32, PAD.z + 14)
  for (const dx of [-2.5, 2.5]) cube(g, 0.4, 28, 0.4, steel, PAD.x + 22 + dx, 14, PAD.z + 14)
  for (const [x, z] of [[PAD.x - 22, PAD.z - 22], [PAD.x + 22, PAD.z - 22], [PAD.x - 22, PAD.z + 22]] as const) put(g, new THREE.CylinderGeometry(0.2, 0.35, 80, 6), steel, x, 40, z)
  A.block(0, { x0: PAD.x - 6, z0: PAD.z - 6, x1: PAD.x + 10, z1: PAD.z + 6 })
  // Launch control and a viewing stand by the road in from the airport.
  {
    const lc = new THREE.Group(); lc.position.set(PAD.x - 40, 0, PAD.z + 30)
    cube(lc, 14, 5, 8, std(0xf2f2ee, 0.6), 0, 2.5, 0)
    cube(lc, 14.2, 1.4, 8.2, std(0x1b2430, 0.1, 0.5, { emissive: 0x1d3446, emissiveIntensity: 0.3 }), 0, 3.2, 0, false)
    const s = sign('GRIND ORBITAL · LAUNCH CONTROL', 12, 1.0, { fg: '#14a058', weight: 900 }); s.position.set(0, 5.6, 4.15); lc.add(s)
    add(lc)
    A.block(0, { x0: PAD.x - 47, z0: PAD.z + 26, x1: PAD.x - 33, z1: PAD.z + 34 })
  }
  const R = rocket()
  R.group.position.set(PAD.x, 0.05, PAD.z); add(R.group)
  R.group.traverse((o) => { o.castShadow = true })

  // --- Space: Earth, clouds, a thin atmosphere, stars and the Sun, far above everything else.
  const spaceSet = new THREE.Group(); spaceSet.visible = false; add(spaceSet)
  let earth: THREE.Group | null = null, clouds: THREE.Mesh | null = null
  const makeSpace = () => {
    if (earth) return
    const T = earthTextures()
    earth = new THREE.Group(); earth.position.copy(O).add(new THREE.Vector3(0, -(R_EARTH + ALT), 0))
    const surf = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH, 96, 64), new THREE.MeshStandardMaterial({ map: T.day, roughness: 0.75, metalness: 0, fog: false }))
    earth.add(surf)
    clouds = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 1.006, 96, 64), new THREE.MeshStandardMaterial({ map: T.clouds, transparent: true, depthWrite: false, roughness: 1, fog: false }))
    earth.add(clouds)
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 1.03, 96, 64), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vP; void main() { float rim = 1.0 - abs(dot(normalize(vN), normalize(-vP))); gl_FragColor = vec4(vec3(0.32, 0.58, 1.0) * pow(rim, 2.6) * 1.6, 1.0); }',
    }))
    earth.add(atmo)
    earth.rotation.z = 0.35
    spaceSet.add(earth)
    const N = 2600, pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30000).add(O); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    spaceSet.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false })))
    // The Sun, where the scene's sunlight comes from.
    let sunDir = new THREE.Vector3(0.6, 0.3, -0.7)
    A.lv[0]!.group.parent?.parent?.traverse((o) => { const l = o as THREE.DirectionalLight; if (l.isDirectionalLight && l.target) sunDir = l.position.clone().sub(l.target.position).normalize() })
    const sunTex = tex(128, 128, (c) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,248,225,0.95)'); gr.addColorStop(0.45, 'rgba(255,220,160,0.25)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128) })
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
    sun.scale.setScalar(2600); sun.position.copy(O).addScaledVector(sunDir, 24000); spaceSet.add(sun)
    // Nothing up here is for the camera's collision checks (the Sun sprite can't be ray-tested at all).
    spaceSet.traverse((o) => { o.raycast = () => undefined; o.userData.ghost = true })
  }

  // --- Sound: a deep rumble for the engines and re-entry.
  let actx: AudioContext | null = null, rumbleGain: GainNode | null = null
  const rumble = (level: number) => {
    try {
      if (!actx) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!C) return
        actx = new C()
        const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate)
        const d = buf.getChannelData(0); let last = 0
        for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 }
        const src = actx.createBufferSource(); src.buffer = buf; src.loop = true
        const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160
        rumbleGain = actx.createGain(); rumbleGain.gain.value = 0
        src.connect(lp).connect(rumbleGain).connect(actx.destination); src.start()
      }
      if (actx.state === 'suspended') void actx.resume().catch(() => undefined)
      rumbleGain!.gain.setTargetAtTime(Math.max(0, Math.min(1.2, level)), actx.currentTime, 0.2)
    } catch { /* no audio */ }
  }
  const stopSound = () => { if (actx) { const c = actx; actx = null; rumbleGain = null; void c.close().catch(() => undefined) } }
  // A big countdown on screen.
  let hud: HTMLDivElement | null = null
  const big = (text: string) => {
    if (!hud) { hud = document.createElement('div'); hud.setAttribute('style', 'position:fixed;left:0;right:0;top:120px;text-align:center;font:900 54px Inter,system-ui,sans-serif;color:#fff;text-shadow:0 3px 16px rgba(0,0,0,.6);letter-spacing:1px;z-index:60;pointer-events:none'); document.body.append(hud) }
    hud.textContent = text
  }
  const hideBig = () => { hud?.remove(); hud = null }
  X.onLeave(() => { stopSound(); hideBig(); X.space(0) })
  // Smoke puffs.
  const puffs: Array<{ m: THREE.Mesh; age: number; life: number; grow: number; vy: number }> = []
  const puffGeo = new THREE.SphereGeometry(1, 10, 8)
  const puff = (p: THREE.Vector3, size: number, life: number, vy = 0.6) => {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false }))
    m.raycast = () => undefined; m.userData.ghost = true
    m.position.copy(p); m.scale.setScalar(size); g.add(m)
    puffs.push({ m, age: 0, life, grow: size * 2.8, vy })
  }
  let lastT = X.now()
  X.animate((t) => {
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]!; p.age += dt
      const k = p.age / p.life
      p.m.scale.setScalar(p.m.scale.x + (p.grow / p.life) * dt); p.m.position.y += p.vy * dt
      ;(p.m.material as THREE.MeshStandardMaterial).opacity = 0.85 * (1 - k)
      if (k >= 1) { g.remove(p.m); (p.m.material as THREE.Material).dispose(); puffs.splice(i, 1) }
    }
    // Steam venting while she waits on the pad.
    if (!flying && Math.random() < dt * 1.2) puff(new THREE.Vector3(PAD.x + (Math.random() - 0.5) * 3, 46 + Math.random() * 8, PAD.z + 1.9), 0.7, 3, 0.4)
  })

  // --- The trip.
  let flying = false
  const CD = 10, ASC = 18, STACK = 13, ORBIT = 52, REENTRY = 12, CHUTE = 20, BOB = 5
  const t1 = CD, t2 = t1 + ASC, t3 = t2 + STACK, t4 = t3 + ORBIT, t5 = t4 + REENTRY, t6 = t5 + CHUTE, TOTAL = t6 + BOB
  const SPLASH = { x: 110, z: -300 }
  const w = new THREE.Vector3()
  const go = () => {
    if (flying) return
    const paid = spendInGame(ORBIT_USD, 'Grind Orbital: a trip to orbit', 'Launch, orbit, re-entry and splashdown')
    if (!paid.ok) { X.toast(paid.message); return }
    flying = true
    makeSpace()
    X.flying(true)
    X.fade()
    const said = new Set<string>()
    const say = (k: string, m: string) => { if (!said.has(k)) { said.add(k); X.toast(m) } }
    let phase = 'pad', view = { heading: Math.PI, pitch: 0.12 }, cam = 95
    let lastSmoke = 0
    say('in', 'Strapped in. Grind Orbital, flight GO-1: all systems go. Ten minutes compressed into two.')
    X.startMove({
      from: { x: PAD.x, z: PAD.z, y: 0 }, to: { x: PAD.x, z: PAD.z, y: 0 }, t: 0, dur: TOTAL, toLv: 0, hide: true,
      path: (u) => {
        const t = u * TOTAL
        const now = X.now()
        let shake = 0
        R.floaty.visible = false
        if (t < t1) {
          // Countdown on the pad. The access arm swings away at T-6.
          phase = 'pad'; X.space(0)
          const n = Math.ceil(t1 - t)
          big(n > 0 ? `T−${n}` : '')
          arm.rotation.y = t > 4 ? -Math.min(1.4, (t - 4) * 0.6) : 0
          if (t > t1 - 2) { R.plume.visible = true; R.plume.scale.setScalar(0.4 + (t - (t1 - 2)) * 0.3); rumble(0.4); if (now - lastSmoke > 0.05) { lastSmoke = now; for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2; puff(new THREE.Vector3(PAD.x + Math.cos(a) * 6, 1.5, PAD.z + Math.sin(a) * 6), 2.4, 5, 0.5) } } }
          R.group.position.set(PAD.x, 0.05, PAD.z); R.group.rotation.set(0, 0, 0)
          view = { heading: Math.PI * 0.62, pitch: 0.12 }; cam = 95
          w.set(PAD.x, 36, PAD.z)
          return { x: w.x, z: w.z, y: w.y - 1.45 }
        }
        if (t < t2) {
          // Liftoff and the climb out over the sea.
          phase = 'ascent'; X.space(0.5)
          const s = t - t1
          big(s < 2.5 ? 'LIFTOFF' : '')
          const y = 0.5 * 5.2 * s * s, dz = -0.5 * 0.7 * s * s
          const vy = 5.2 * s, vz = -0.7 * s
          R.group.position.set(PAD.x, y, PAD.z + dz)
          R.group.rotation.set(Math.atan2(vz, vy), 0, 0)
          R.plume.visible = true; R.plume.scale.set(1, 1 + s * 0.12, 1); R.plume.children.forEach((c, k) => { c.scale.y = 0.9 + Math.random() * 0.2 + k * 0.05 })
          rumble(1.1 - s * 0.03); shake = Math.max(0, 0.35 - s * 0.012)
          if (now - lastSmoke > 0.08 && y < 600) { lastSmoke = now; R.group.updateMatrixWorld(true); puff(R.stage1.localToWorld(w.set(0, -4, 0)).clone(), 2 + s * 0.2, 8, 0.2) }
          if (s > 3) say('tower', 'Tower cleared. Pitching over towards the sea.')
          if (s > 9) say('maxq', 'Max Q: the hardest push through the air. Hold on.')
          view = { heading: Math.PI, pitch: 0.82 }; cam = 30
          R.group.updateMatrixWorld(true)
          R.capsule.localToWorld(w.copy(R.seat))
        } else if (t < t4) {
          // Space: separation, the second stage burn, then orbit.
          X.space(1); spaceSet.visible = true
          const s = t - t2
          if (phase !== 'space') { phase = 'space'; X.fade(); big(''); rumble(0.25); R.plume.visible = false; say('meco', 'Main engine cut-off. Stage separation. Second stage ignition.') }
          // The stack lies along its orbit (-z), slowly coming upright for the capsule's orbit attitude later.
          R.group.position.copy(O)
          if (t < t3) {
            R.group.rotation.set(-Math.PI / 2, 0, 0)
            R.plume2.visible = true; R.plume2.scale.setScalar(0.9 + Math.random() * 0.2)
            R.stage1.visible = true; R.stage1.position.set(0, -(s * s) * 0.9 - s * 2, 0); R.stage1.rotation.x = s * 0.25
            if (s > 3) R.stage1.visible = s < 9
            rumble(0.3)
            view = { heading: Math.PI, pitch: 0.26 }; cam = 34
          } else {
            const o = t - t3
            if (o < 0.1) say('orbit', 'Second stage cut-off. You\'re in orbit, 400 km up, going 7.7 km a second.')
            R.plume2.visible = false; R.stage1.visible = false
            R.stage2.visible = o < 8; R.stage2.position.set(0, 44 - o * o * 0.4, 0)
            // Capsule turns upright (nose away from Earth) and floats; the camera circles it.
            const up = Math.min(1, o / 3)
            R.group.rotation.set(-Math.PI / 2 * (1 - up), 0, 0)
            rumble(0)
            if (o > 6) say('lap', 'One lap of the Earth takes about 92 minutes up here: 16 sunrises a day.')
            if (o > 14) say('line', 'That thin blue line on the horizon is the whole atmosphere.')
            if (o > 24) say('float', 'Weightless: anything not strapped down floats. The quiet up here is total.')
            if (o > 36) say('home', 'Look for the coast: Grind District is down there, smaller than a grain of sand.')
            // The camera drifts slowly round the capsule, closer, then further out to take in the whole limb of the Earth.
            view = { heading: Math.PI + o * 0.09, pitch: 0.12 + Math.sin(o * 0.12) * 0.08 }; cam = 11 + Math.sin(o * 0.08) * 5
          }
          if (earth) { earth.rotation.x = -(t - t2) * 0.006; if (clouds) clouds.rotation.y = (t - t2) * 0.002 }
          R.group.updateMatrixWorld(true)
          R.capsule.localToWorld(w.copy(R.seat))
        } else if (t < t5) {
          // De-orbit and re-entry: heat shield first, glowing.
          const s = t - t4
          if (phase !== 'reentry') { phase = 'reentry'; say('deorbit', 'De-orbit burn done. Re-entry: the heat shield is at 1,600 °C. It gets bumpy.') }
          X.space(1)
          R.stage2.visible = false
          R.group.position.copy(O).add(w.set(0, -s * s * 2.2, -s * 6))
          R.group.rotation.set(0.25, 0, 0)
          R.plasma.visible = true; (R.plasma.material as THREE.MeshBasicMaterial).opacity = Math.min(0.75, s * 0.12) * (0.8 + Math.random() * 0.4)
          rumble(Math.min(0.9, s * 0.1)); shake = Math.min(0.25, s * 0.03)
          if (earth) earth.rotation.x = -(t - t2) * 0.006
          view = { heading: Math.PI * 0.8, pitch: 0.2 }; cam = 16
          R.group.updateMatrixWorld(true)
          R.capsule.localToWorld(w.copy(R.seat))
        } else {
          // Back in our sky: three parachutes, then splashdown off the city.
          const s = t - t5
          if (phase !== 'chutes') { phase = 'chutes'; X.fade(); X.space(0.5); spaceSet.visible = false; R.plasma.visible = false; R.chutes.visible = true; say('chutes', 'Main parachutes out: three good chutes. That\'s Grind District off the left.') }
          if (s > 4) X.space(0)
          const y = Math.max(0, 480 - s * 24)
          R.group.rotation.set(0, 0, Math.sin(now * 0.8) * 0.05)
          R.group.position.set(SPLASH.x, y - 58 + Math.sin(now * 1.3) * (y <= 0 ? 0.3 : 0), SPLASH.z)
          if (y <= 0 && !said.has('splash')) { say('splash', 'Splashdown! Welcome home, astronaut.'); for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2; puff(new THREE.Vector3(SPLASH.x + Math.cos(a) * 3, 0.5, SPLASH.z + Math.sin(a) * 3), 1.4, 2.5, 1.2) } }
          rumble(0)
          view = { heading: 0.2, pitch: 0.12 }; cam = 52
          R.group.updateMatrixWorld(true)
          // Frame the capsule and its parachutes together.
          R.capsule.localToWorld(w.copy(R.seat)); w.y += 9
        }
        if (shake > 0) { w.x += (Math.random() - 0.5) * shake; w.z += (Math.random() - 0.5) * shake }
        return { x: w.x, z: w.z, y: w.y }
      },
      camFn: () => cam,
      view: () => view,
      done: () => {
        flying = false
        stopSound(); hideBig()
        X.space(0); X.flying(false); X.fade()
        spaceSet.visible = false
        R.chutes.visible = false; R.plasma.visible = false; R.plume.visible = false; R.plume2.visible = false
        R.stage1.visible = true; R.stage2.visible = true; R.stage1.position.set(0, 0, 0); R.stage1.rotation.set(0, 0, 0); R.stage2.position.set(0, 44, 0)
        R.group.position.set(PAD.x, 0.05, PAD.z); R.group.rotation.set(0, 0, 0); arm.rotation.y = 0
        X.toast(adjust({ social: 30, energy: -10 }, 'quiet') || 'You\'ve been to space. Not many people can say that.')
      },
      exit: { x: desk.x - 1.4, z: desk.z },
    })
  }
  const u: Hotspot = { id: 'air-orbital', x: desk.x - 1.4, z: desk.z, r: 1.8, title: 'Grind Orbital', body: 'Fly to orbit: countdown on the pad, liftoff, stage separation, two minutes of orbit 400 km up with the Earth below, re-entry and a splashdown off the city. About two and a half minutes.', enter: `Fly to orbit · $${ORBIT_USD.toLocaleString('en-US')}`, use: () => go() }
  A.use(0, u)
  A.use(0, { ...u, id: 'air-orbital-lc', x: PAD.x - 40, z: PAD.z + 35.4 })
}
