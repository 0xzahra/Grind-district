import * as THREE from 'three'
import type { Graphics } from './logic.ts'

/**
 * Skyline backdrop beyond the walkable city: instanced glass towers with setbacks,
 * lit window grids that glow at night, rooftop plant and blinking aviation lights.
 * 3 draw calls for towers (base, setback, crown) + 1 rooftop + 1 beacons, whatever the count.
 */
function windowTextures(): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  // Albedo: pale stone frame, blue-grey glass with a sky sheen, spandrel bands. Glow: lit panes only.
  const mk = () => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; return c }
  const a = mk(), e = mk()
  const g = a.getContext('2d')!, ge = e.getContext('2d')!
  g.fillStyle = '#a9b3bd'
  g.fillRect(0, 0, 64, 256)
  ge.fillStyle = '#000'
  ge.fillRect(0, 0, 64, 256)
  for (let y = 4; y < 256; y += 8) {
    for (let x = 3; x < 64; x += 6) {
      const grad = g.createLinearGradient(0, y, 0, y + 5)
      grad.addColorStop(0, '#93a2b0')
      grad.addColorStop(1, '#7f8f9e')
      g.fillStyle = grad
      g.fillRect(x, y, 4, 5)
      if (Math.random() < 0.3) { ge.fillStyle = '#ffe3b8'; ge.fillRect(x, y, 4, 5) }
    }
  }
  const out = [a, e].map((c, i) => {
    const t = new THREE.CanvasTexture(c)
    if (i === 0) t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })
  return { map: out[0]!, glow: out[1]! }
}

export function createSkyline(scene: THREE.Scene, graphics: Graphics) {
  const count = graphics === 'high' ? 48 : graphics === 'medium' ? 36 : 22
  const win = windowTextures()
  const glass = new THREE.MeshStandardMaterial({
    color: 0xdfe6ec, roughness: 0.9, metalness: 0, map: win.map, emissive: 0xffffff, emissiveMap: win.glow, emissiveIntensity: 0.02,
    fog: true, envMapIntensity: 0.35,
  })
  // Curtain-wall towers: reflective blue-grey glass with thin mullions; reflections come from the shared
  // scene env map (PMREM of the sky HDRI), so no extra render passes. Every fifth tower wears it.
  const mc = document.createElement('canvas'); mc.width = 32; mc.height = 128
  const mg = mc.getContext('2d')!
  mg.fillStyle = '#ffffff'; mg.fillRect(0, 0, 32, 128)
  mg.fillStyle = '#c9d0d6'; for (let y = 0; y < 128; y += 8) mg.fillRect(0, y, 32, 1); for (let x = 0; x < 32; x += 8) mg.fillRect(x, 0, 1, 128)
  const mullion = new THREE.CanvasTexture(mc); mullion.colorSpace = THREE.SRGBColorSpace; mullion.wrapS = mullion.wrapT = THREE.RepeatWrapping; mullion.repeat.set(2, 6)
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0xa3b3c2, map: mullion, roughness: 0.6, metalness: 0.15, envMapIntensity: 0.4, fog: true })
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.9, metalness: 0 })
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false })
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const base = new THREE.InstancedMesh(box, glass, count)
  const upper = new THREE.InstancedMesh(box, glass, count)
  const curtain = new THREE.InstancedMesh(box, curtainMat, count)
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  let curtains = 0
  const roof = new THREE.InstancedMesh(box, crownMat, count * 2)
  const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), beaconMat, count)
  const m = new THREE.Object3D()
  let rnd = 7
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.05
    const r = 104 + rand() * 36
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const w = 8 + rand() * 10
    const d = 8 + rand() * 10
    const h = 14 + rand() * rand() * 44
    m.position.set(x, 0, z)
    m.rotation.set(0, -a, 0)
    m.scale.set(w, h, d)
    m.updateMatrix()
    if (i % 5 === 0) { curtain.setMatrixAt(curtains++, m.matrix); base.setMatrixAt(i, hidden) } else base.setMatrixAt(i, m.matrix)
    // Setback tower on top.
    const h2 = h * (0.2 + rand() * 0.35)
    m.position.y = h
    m.scale.set(w * 0.68, h2, d * 0.68)
    m.updateMatrix()
    upper.setMatrixAt(i, m.matrix)
    // Rooftop plant boxes (AC / lift housing).
    for (let k = 0; k < 2; k++) {
      m.position.set(x + (rand() - 0.5) * w * 0.4, h + h2, z + (rand() - 0.5) * d * 0.4)
      m.scale.set(1.5 + rand() * 2, 1 + rand() * 1.5, 1.5 + rand() * 2)
      m.updateMatrix()
      roof.setMatrixAt(i * 2 + k, m.matrix)
    }
    m.position.set(x, h + h2 + 3, z)
    m.scale.setScalar(0.9)
    m.updateMatrix()
    beacons.setMatrixAt(i, m.matrix)
  }
  curtain.count = curtains
  for (const mesh of [base, upper, curtain, roof, beacons]) {
    mesh.computeBoundingSphere()
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.userData.ghost = true
    mesh.raycast = () => undefined
    scene.add(mesh)
  }
  return {
    tick(t: number, night: number) {
      glass.emissiveIntensity = 0.01 + night * 0.22
      beacons.visible = Math.sin(t * 2.4) > 0.2 && night > 0.2
    },
  }
}
