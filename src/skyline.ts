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
  g.fillStyle = '#b9b4aa'
  g.fillRect(0, 0, 64, 256)
  ge.fillStyle = '#000'
  ge.fillRect(0, 0, 64, 256)
  for (let y = 4; y < 256; y += 8) {
    for (let x = 3; x < 64; x += 6) {
      const grad = g.createLinearGradient(0, y, 0, y + 5)
      grad.addColorStop(0, '#9fb6c4')
      grad.addColorStop(1, '#5d7484')
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
  const count = graphics === 'high' ? 90 : graphics === 'medium' ? 52 : 26
  const win = windowTextures()
  const glass = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.55, metalness: 0.1, map: win.map, emissive: 0xffffff, emissiveMap: win.glow, emissiveIntensity: 0.1,
    fog: true,
  })
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x8f8b84, roughness: 0.8, metalness: 0.1 })
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false })
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const base = new THREE.InstancedMesh(box, glass, count)
  const upper = new THREE.InstancedMesh(box, glass, count)
  const roof = new THREE.InstancedMesh(box, crownMat, count * 2)
  const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), beaconMat, count)
  const m = new THREE.Object3D()
  let rnd = 7
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.05
    const r = 92 + rand() * 40
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const w = 8 + rand() * 10
    const d = 8 + rand() * 10
    const h = 25 + rand() * rand() * 85
    m.position.set(x, 0, z)
    m.rotation.set(0, -a, 0)
    m.scale.set(w, h, d)
    m.updateMatrix()
    base.setMatrixAt(i, m.matrix)
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
  for (const mesh of [base, upper, roof, beacons]) {
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.userData.ghost = true
    mesh.raycast = () => undefined
    scene.add(mesh)
  }
  return {
    tick(t: number, night: number) {
      glass.emissiveIntensity = 0.02 + night * 0.6
      beacons.visible = Math.sin(t * 2.4) > 0.2 && night > 0.2
    },
  }
}
