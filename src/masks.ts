import * as THREE from 'three'
import type { MaskId } from './logic.ts'
import { licensedFace } from './skins.ts'

function mat(color: number, roughness = 0.45, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
}

function box(
  parent: THREE.Object3D,
  material: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.castShadow = true
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function disposeMask(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    if (!node.userData.sharedGeometry) node.geometry.dispose()
    const material = node.material
    if (Array.isArray(material)) {
      for (const item of material) item.dispose()
    } else {
      material.dispose()
    }
  })
}

/** Original face gear. The names are the collections from the city list. The meshes are not their artwork. */
export function mountMask(anchor: THREE.Object3D, mask: MaskId): void {
  const previous = anchor.getObjectByName('wear-mask')
  if (previous) {
    previous.removeFromParent()
    disposeMask(previous)
  }
  if (mask === 'none') return
  const group = new THREE.Group()
  group.name = 'wear-mask'
  const licensed = licensedFace(mask)
  if (licensed) {
    group.add(licensed)
    anchor.add(group)
    return
  }
  switch (mask) {
    case 'punk': {
      const skin = mat(0xd7b48a, 0.7)
      const ink = mat(0x1b1b1b, 0.4)
      const stripe = mat(0xc84b4b, 0.5)
      box(group, skin, 0.2, 0.08, 0.03, 0, 0.02, 0.02)
      box(group, ink, 0.16, 0.035, 0.02, 0, 0.02, 0.04)
      box(group, stripe, 0.04, 0.1, 0.03, -0.06, 0.08, 0)
      box(group, ink, 0.03, 0.04, 0.02, 0.07, -0.02, 0.03)
      break
    }
    case 'ape': {
      const fur = mat(0x6b4423, 0.72)
      const muzzle = mat(0xc4a574, 0.6)
      const gold = mat(0xf0c14a, 0.3, 0.7)
      box(group, fur, 0.2, 0.12, 0.06, 0, 0.04, 0)
      box(group, muzzle, 0.1, 0.07, 0.08, 0, -0.02, 0.05)
      box(group, gold, 0.02, 0.02, 0.02, 0.02, -0.04, 0.09)
      box(group, fur, 0.05, 0.06, 0.03, -0.11, 0.08, -0.01)
      box(group, fur, 0.05, 0.06, 0.03, 0.11, 0.08, -0.01)
      break
    }
    case 'pudgy': {
      const bill = mat(0xf4a261, 0.48)
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0xf4efe4, 0.55))
      cheek.position.set(-0.07, 0, 0.02)
      const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0xf4efe4, 0.55))
      cheekR.position.set(0.07, 0, 0.02)
      group.add(cheek, cheekR)
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), bill)
      nose.rotation.x = Math.PI / 2
      nose.position.set(0, -0.01, 0.07)
      group.add(nose)
      break
    }
    case 'azuki': {
      const red = mat(0xc4323a, 0.42)
      const white = mat(0xf7f4ee, 0.4)
      const black = mat(0x161616, 0.35)
      box(group, red, 0.18, 0.1, 0.03, 0, 0.01, 0.02)
      box(group, white, 0.06, 0.08, 0.02, 0.08, 0.06, 0.03)
      box(group, black, 0.14, 0.02, 0.02, 0, 0.02, 0.04)
      break
    }
    case 'nodemonke': {
      const grey = mat(0x8b939c, 0.5, 0.2)
      const dark = mat(0x2c3138, 0.45)
      box(group, grey, 0.22, 0.06, 0.04, 0, 0.06, 0.01)
      box(group, grey, 0.06, 0.07, 0.05, -0.12, 0.05, 0)
      box(group, grey, 0.06, 0.07, 0.05, 0.12, 0.05, 0)
      box(group, dark, 0.08, 0.04, 0.04, 0, -0.01, 0.04)
      break
    }
    case 'degods': {
      const gold = mat(0xf0c14a, 0.28, 0.82)
      const gem = mat(0x7d5cff, 0.25, 0.4)
      box(group, gold, 0.07, 0.1, 0.03, -0.08, 0.02, 0.02)
      box(group, gold, 0.07, 0.1, 0.03, 0.08, 0.02, 0.02)
      const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), gem)
      stone.position.set(0, 0.07, 0.03)
      group.add(stone)
      break
    }
    default: {
      const neverMask: never = mask
      return neverMask
    }
  }
  anchor.add(group)
}
