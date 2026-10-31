import * as THREE from 'three'
import type { Graphics } from './logic.ts'

/**
 * Skyline backdrop beyond the walkable city: instanced glass towers with setbacks,
 * lit window grids that glow at night, rooftop plant and blinking aviation lights.
 * 3 draw calls for towers (base, setback, crown) + 1 rooftop + 1 beacons, whatever the count.
 */
function windowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#05080a'
  g.fillRect(0, 0, 64, 256)
  for (let y = 4; y < 256; y += 8) {
    for (let x = 3; x < 64; x += 6) {
      const lit = Math.random() < 0.35
      g.fillStyle = lit ? (Math.random() < 0.15 ? '#9ff7cf' : '#ffe8c4') : '#0d1418'
      g.fillRect(x, y, 4, 5)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function createSkyline(scene: THREE.Scene, graphics: Graphics) {
  const count = graphics === 'high' ? 90 : graphics === 'medium' ? 52 : 26
  const win = windowTexture()
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1a2a30, roughness: 0.08, metalness: 0.9, map: win, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 0.3,
    fog: true,
  })
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x20282c, roughness: 0.5, metalness: 0.6 })
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
      glass.emissiveIntensity = 0.08 + night * 1.1
      beacons.visible = Math.sin(t * 2.4) > 0.2 && night > 0.2
    },
  }
}
