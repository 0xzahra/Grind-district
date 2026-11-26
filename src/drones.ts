import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { DroneId } from './logic.ts'

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material)
  item.castShadow = true
  parent.add(item)
  return item
}

function release(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    node.geometry.dispose()
    const material = node.material
    if (Array.isArray(material)) {
      for (const item of material) item.dispose()
    } else {
      material.dispose()
    }
  })
}

export function releaseDrone(object: THREE.Object3D): void {
  object.removeFromParent()
  release(object)
}

/**
 * A camera quadcopter shaped like the real thing: a rounded body with a dark top shell, four angled arms to the
 * motors, two-blade propellers (each with a faint blur disc while it spins), guards round the props on the Halo, a
 * camera on a gimbal under the nose, two landing legs, and navigation lights (green and white at the front, red at
 * the back). About 35 cm across; the follower scales it up to read at a distance.
 */
export function createDrone(id: DroneId): THREE.Group {
  const root = new THREE.Group()
  root.name = `drone-${id}`
  const look = id === 'courier'
    ? { body: 0xeceae4, shell: 0x2b2d31, accent: 0xf0c14a, prop: 0x1d1f22 }
    : id === 'halo'
      ? { body: 0xdfe7ee, shell: 0x1a242c, accent: 0x9fd4ff, prop: 0x2a3540 }
      : { body: 0x3a3f45, shell: 0x1c1f23, accent: 0xff7a2a, prop: 0x141618 }
  const smooth = (color: number, roughness: number, metalness = 0.1, glow = 0) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); if (glow) { m.emissive = new THREE.Color(color); m.emissiveIntensity = glow } return m }
  const body = smooth(look.body, 0.38, 0.15), shell = smooth(look.shell, 0.3, 0.3), accent = smooth(look.accent, 0.4, 0.1, 0.25)
  const metal = smooth(0x9aa1a8, 0.3, 0.8), prop = smooth(look.prop, 0.45, 0.1), lens = smooth(0x0b1016, 0.08, 0.6)
  const blur = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
  // Body: a smooth capsule along the nose, a dark shell on top, a small accent band.
  const hull = mesh(new THREE.CapsuleGeometry(0.048, 0.12, 6, 14), body, root)
  hull.rotation.x = Math.PI / 2; hull.scale.set(1, 1, 0.72)
  const top = mesh(new THREE.CapsuleGeometry(0.036, 0.09, 4, 12), shell, root)
  top.rotation.x = Math.PI / 2; top.scale.set(1, 1, 0.5); top.position.y = 0.022
  const band = mesh(new THREE.BoxGeometry(0.098, 0.008, 0.02), accent, root); band.position.set(0, 0.01, 0.07)
  // Arms, motors and propellers at the four corners.
  const rotors: THREE.Object3D[] = []
  const corners: Array<[number, number]> = [[0.15, 0.13], [-0.15, 0.13], [0.15, -0.13], [-0.15, -0.13]]
  for (const [x, z] of corners) {
    const len = Math.hypot(x, z)
    const arm = mesh(new THREE.CylinderGeometry(0.009, 0.012, len, 10), shell, root)
    arm.rotation.set(Math.PI / 2, 0, 0); arm.rotation.order = 'YXZ'; arm.rotation.y = Math.atan2(x, z)
    arm.position.set(x / 2, 0.004, z / 2)
    const motor = mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.032, 14), metal, root); motor.position.set(x, 0.016, z)
    const cap = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.01, 12), accent, root); cap.position.set(x, 0.035, z)
    const rotor = new THREE.Group(); rotor.position.set(x, 0.042, z); root.add(rotor)
    const blade = mesh(new THREE.BoxGeometry(0.165, 0.003, 0.016), prop, rotor); blade.rotation.x = 0.12
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.084, 24), blur); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; rotor.add(disc)
    rotors.push(rotor)
    if (id === 'halo') { const guard = mesh(new THREE.TorusGeometry(0.09, 0.004, 6, 32), shell, root); guard.rotation.x = Math.PI / 2; guard.position.set(x, 0.042, z) }
    // navigation lights: green right front, white left front, red at the back
    const nav = smooth(z > 0 ? (x > 0 ? 0x30ff7a : 0xffffff) : 0xff2a2a, 0.3, 0, 1.4)
    const led = mesh(new THREE.SphereGeometry(0.006, 8, 6), nav, root); led.position.set(x * 1.0, -0.004, z * 1.0)
  }
  // The camera on a two-axis gimbal under the nose, looking forward.
  const yoke = mesh(new THREE.BoxGeometry(0.036, 0.022, 0.006), shell, root); yoke.position.set(0, -0.038, 0.085)
  const cam = mesh(new THREE.SphereGeometry(0.019, 14, 10), body, root); cam.position.set(0, -0.05, 0.088)
  const glass = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 14), lens, root); glass.rotation.x = Math.PI / 2; glass.position.set(0, -0.05, 0.106)
  // Two landing legs with skids.
  for (const s of [-1, 1]) {
    for (const z of [-0.05, 0.05]) { const leg = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), shell, root); leg.position.set(s * 0.045, -0.055, z); leg.rotation.z = s * 0.35 }
    const skid = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 8), shell, root); skid.rotation.x = Math.PI / 2; skid.position.set(s * 0.058, -0.088, 0)
  }
  if (id === 'courier') { const box = mesh(new THREE.BoxGeometry(0.11, 0.07, 0.09), smooth(0xc4a574, 0.75), root); box.position.y = -0.075 }
  if (id === 'halo') { const ring = mesh(new THREE.TorusGeometry(0.06, 0.006, 8, 28), accent, root); ring.rotation.x = Math.PI / 2; ring.position.y = 0.03 }
  // Merge the fixed parts by material (the propellers stay separate, to spin): about a dozen draws, not 45.
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>()
  root.updateMatrixWorld(true)
  for (const c of [...root.children]) {
    const m = c as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material)) continue
    const g = m.geometry.clone()
    g.applyMatrix4(m.matrix)
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
    const list = byMat.get(m.material) ?? []; list.push(g); byMat.set(m.material, list)
    m.geometry.dispose(); root.remove(m)
  }
  for (const [mat, geos] of byMat) {
    const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g))
    const merged = mergeGeometries(flat)
    for (const g of [...geos, ...flat]) if (g !== merged) g.dispose()
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; root.add(mesh)
  }
  root.userData.rotors = rotors
  return root
}

export function spinDrone(root: THREE.Object3D, dt: number, now = 0): void {
  const rotors = root.userData.rotors
  if (!Array.isArray(rotors)) return
  for (const rotor of rotors) {
    if (rotor instanceof THREE.Object3D) rotor.rotation.y += dt * 40
  }
  root.rotation.y = now * 0.6
}
