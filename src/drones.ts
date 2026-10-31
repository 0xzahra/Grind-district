import * as THREE from 'three'
import type { DroneId } from './logic.ts'

function mat(color: number, roughness: number, metalness = 0.2, glow = 0): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
  if (glow > 0) {
    material.emissive = new THREE.Color(color)
    material.emissiveIntensity = glow
  }
  return material
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material)
  item.castShadow = true
  parent.add(item)
  return item
}

function quad(parent: THREE.Object3D, shell: THREE.Material, glow: THREE.Material): THREE.Mesh[] {
  const rotors: THREE.Mesh[] = []
  const arms: Array<[number, number]> = [
    [-0.16, -0.16],
    [0.16, -0.16],
    [-0.16, 0.16],
    [0.16, 0.16],
  ]
  for (const [x, z] of arms) {
    const arm = mesh(new THREE.BoxGeometry(0.18, 0.02, 0.04), shell, parent)
    arm.position.set(x * 0.55, 0, z * 0.55)
    arm.rotation.y = Math.atan2(x, z)
    const rotor = mesh(new THREE.BoxGeometry(0.16, 0.012, 0.03), glow, parent)
    rotor.position.set(x, 0.03, z)
    rotors.push(rotor)
  }
  return rotors
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

export function createDrone(id: DroneId): THREE.Group {
  const root = new THREE.Group()
  root.name = `drone-${id}`
  const rotors: THREE.Mesh[] = []
  switch (id) {
    case 'scout': {
      const shell = mat(0x143028, 0.4, 0.35)
      const glow = mat(0xd9c08a, 0.3, 0.1, 0.35)
      mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), shell, root)
      rotors.push(...quad(root, shell, glow))
      break
    }
    case 'courier': {
      const shell = mat(0x2a241c, 0.5, 0.3)
      const glow = mat(0xf0c14a, 0.35, 0.2, 0.45)
      const box = mesh(new THREE.BoxGeometry(0.2, 0.12, 0.16), mat(0xc4a574, 0.7), root)
      box.position.y = -0.08
      mesh(new THREE.BoxGeometry(0.14, 0.05, 0.14), shell, root)
      rotors.push(...quad(root, shell, glow))
      break
    }
    case 'halo': {
      const ring = mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 18), mat(0x9fd4ff, 0.25, 0.6, 0.8), root)
      ring.rotation.x = Math.PI / 2
      mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xf7fbff, 0.2, 0.3, 0.6), root)
      const shell = mat(0x1a242c, 0.4, 0.4)
      rotors.push(...quad(root, shell, mat(0x9fd4ff, 0.3, 0.2, 0.5)))
      break
    }
    default: {
      const neverDrone: never = id
      throw new Error(neverDrone)
    }
  }
  root.userData.rotors = rotors
  return root
}

export function spinDrone(root: THREE.Object3D, dt: number, now = 0): void {
  const rotors = root.userData.rotors
  if (!Array.isArray(rotors)) return
  for (const rotor of rotors) {
    if (rotor instanceof THREE.Mesh) rotor.rotation.y += dt * 18
  }
  root.rotation.y = now * 0.6
}
