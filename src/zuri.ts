import * as THREE from 'three'
import { mountMask } from './masks.ts'
import type { MaskId } from './logic.ts'
import type { ShrimpAvatar } from './shrimp.ts'
import { humanArm, humanGait, humanLeg } from './rig.ts'

const SKIN = 0xf6c4aa
const HAIR = 0x1a100e
const COAT = 0x2a1422
const FRAME = 0xf0c14a

function mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true })
}

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

/**
 * Original woman. Longer hair, a softer face, and a fitted coat.
 * Not a licensed collection. The plate reads the name they signed up with.
 */
export function createZuri(): ShrimpAvatar {
  const skin = mat(SKIN, 0.46)
  const hairMat = mat(HAIR, 0.32, 0.18)
  hairMat.emissive = new THREE.Color(0x4a241c)
  hairMat.emissiveIntensity = 0.28
  const coat = mat(COAT, 0.48, 0.12)
  const scarf = mat(0xff6f91, 0.4, 0.08)
  scarf.emissive = new THREE.Color(0xff6f91)
  scarf.emissiveIntensity = 0.18
  const dark = mat(0x140e12, 0.45)
  const lip = mat(0xd4536a, 0.38)
  const iris = mat(0x2a3c2e, 0.95)
  iris.envMapIntensity = 0
  const pupil = mat(0x100e0c, 0.3)
  const lash = mat(0x140e10, 0.4)
  const gold = mat(FRAME, 0.22, 0.86)
  gold.emissive = new THREE.Color(0x6a4a10)
  gold.emissiveIntensity = 0.3

  const root = new THREE.Group()
  root.name = 'zuri'
  const avatar = new THREE.Group()
  avatar.rotation.y = Math.PI
  root.add(avatar)
  const key = new THREE.PointLight(0xfff1ea, 2.8, 3.8, 2)
  key.position.set(0, 2.2, -1.05)
  avatar.add(key)
  const faceLight = new THREE.PointLight(0xffe8f0, 1.0, 2.6, 2)
  faceLight.position.set(0, 1.66, 0.95)
  avatar.add(faceLight)
  const bob = new THREE.Group()
  avatar.add(bob)

  const skirt = part(new THREE.CylinderGeometry(0.16, 0.24, 0.36, 7), coat, bob, 0, 0.84, 0)
  skirt.scale.z = 0.78
  const neck = part(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 6), skin, bob, 0, 1.5, 0.01)
  neck.castShadow = false

  const torso = part(new THREE.CylinderGeometry(0.2, 0.15, 0.44, 7), coat, bob, 0, 1.22, 0)
  torso.scale.z = 0.62
  part(new THREE.BoxGeometry(0.16, 0.28, 0.02), scarf, bob, 0, 1.24, 0.11)
  part(new THREE.BoxGeometry(0.22, 0.05, 0.16), gold, bob, 0, 1.02, 0.02)
  const chain = part(new THREE.TorusGeometry(0.09, 0.01, 6, 14), gold, bob, 0, 1.32, 0.12)
  chain.rotation.x = Math.PI / 2.4
  chain.visible = false

  const headGeo = new THREE.IcosahedronGeometry(0.15, 1)
  const headPos = headGeo.attributes.position
  for (let i = 0; i < headPos.count; i += 1) {
    let x = headPos.getX(i)
    let y = headPos.getY(i)
    let z = headPos.getZ(i)
    y *= 1.16
    x *= 0.92
    if (y < -0.02) {
      const jaw = Math.min(1, -y / 0.14)
      x *= 1 - 0.18 * jaw
      z *= 1 - 0.02 * jaw
    }
    if (Math.abs(x) > 0.04 && Math.abs(x) < 0.12 && y > 0.0 && y < 0.08 && z > 0) {
      x *= 1.06
      z += 0.02
    }
    if (z > 0.06 && Math.abs(x) < 0.04 && y > -0.01 && y < 0.04) z += 0.02
    headPos.setXYZ(i, x, y, z)
  }
  headGeo.computeVertexNormals()
  part(headGeo, skin, bob, 0, 1.66, 0.02)

  const locks = [
    [0, 1.92, -0.02, 0.26, 0.08, 0.24, -0.5, 0, 0],
    [-0.12, 1.78, 0.02, 0.08, 0.28, 0.1, 0.1, 0, 0.15],
    [0.12, 1.76, 0.02, 0.08, 0.32, 0.1, 0.08, 0, -0.12],
    [0, 1.55, -0.08, 0.18, 0.42, 0.08, 0.15, 0, 0],
    [-0.16, 1.48, 0.02, 0.06, 0.36, 0.08, 0, 0, 0.2],
    [0.14, 1.42, 0.04, 0.07, 0.4, 0.08, 0.05, 0, -0.25],
    [-0.05, 1.84, 0.1, 0.08, 0.04, 0.06, 0.4, 0, 0.1],
    [0.05, 1.84, 0.1, 0.08, 0.04, 0.06, 0.35, 0, -0.08],
  ] as const
  for (const [x, y, z, sx, sy, sz, rx, ry, rz] of locks) {
    const lock = part(new THREE.BoxGeometry(sx, sy, sz), hairMat, bob, x, y, z)
    lock.rotation.set(rx, ry, rz)
  }

  const nose = part(new THREE.ConeGeometry(0.02, 0.05, 4), skin, bob, 0, 1.62, 0.15)
  nose.rotation.x = Math.PI / 2
  part(new THREE.BoxGeometry(0.055, 0.016, 0.016), lip, bob, 0, 1.52, 0.15)
  part(new THREE.BoxGeometry(0.04, 0.01, 0.012), lip, bob, 0, 1.508, 0.158)
  const browL = part(new THREE.BoxGeometry(0.06, 0.01, 0.01), hairMat, bob, -0.045, 1.74, 0.145)
  const browR = part(new THREE.BoxGeometry(0.06, 0.01, 0.01), hairMat, bob, 0.045, 1.74, 0.145)
  browL.rotation.z = -0.25
  browR.rotation.z = 0.25

  const addEye = (side: number) => {
    part(new THREE.SphereGeometry(0.03, 8, 6), iris, bob, side * 0.05, 1.66, 0.15)
    part(new THREE.SphereGeometry(0.013, 6, 5), pupil, bob, side * 0.05, 1.66, 0.176)
    const fringe = part(new THREE.BoxGeometry(0.055, 0.012, 0.012), lash, bob, side * 0.05, 1.688, 0.16)
    fringe.rotation.z = side * -0.2
  }
  addEye(-1)
  addEye(1)
  part(new THREE.SphereGeometry(0.012, 6, 5), gold, bob, -0.13, 1.6, 0.04)
  part(new THREE.SphereGeometry(0.012, 6, 5), gold, bob, 0.13, 1.6, 0.04)

  const maskAnchor = new THREE.Group()
  maskAnchor.name = 'mask-anchor'
  maskAnchor.position.set(0, 1.64, 0.2)
  bob.add(maskAnchor)

  const legSpec = { x: 0.075, hipY: 0.94, thigh: 0.45, shin: 0.43, rThigh: 0.07, rKnee: 0.05, rAnkle: 0.036 }
  const legL = humanLeg(bob, -1, legSpec, coat, skin, dark)
  const legR = humanLeg(bob, 1, legSpec, coat, skin, dark)
  const armSpec = { x: 0.23, y: 1.41, upper: 0.25, fore: 0.23, r: 0.045 }
  const armL = humanArm(bob, -1, armSpec, coat, scarf, skin)
  const armR = humanArm(bob, 1, armSpec, coat, scarf, skin)
  const gait = humanGait(bob, [legL, legR], [armL, armR], { swing: 0.5, bounce: 0.04, idle: 0.012 })

  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = 128
  shadowCanvas.height = 128
  const shadowContext = shadowCanvas.getContext('2d')
  if (!shadowContext) throw new Error('Could not paint the contact shadow.')
  const gradient = shadowContext.createRadialGradient(64, 64, 10, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,0.45)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  shadowContext.fillStyle = gradient
  shadowContext.fillRect(0, 0, 128, 128)
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shadowCanvas),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  disc.rotation.x = -Math.PI / 2
  disc.position.y = 0.02
  disc.userData.ghost = true
  disc.raycast = () => undefined
  root.add(disc)

  let yaw = Math.PI
  let lean = 0
  let leanTarget = 0

  return {
    object: root,
    face(dirX, dirZ, dt, moving) {
      if (moving && dirX * dirX + dirZ * dirZ > 0.0001) {
        const target = Math.atan2(dirX, dirZ)
        const delta = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw))
        yaw += delta * (1 - Math.exp(-10 * dt))
        leanTarget = THREE.MathUtils.clamp(-delta * 1.2, -0.18, 0.18)
      } else {
        leanTarget = 0
      }
      lean += (leanTarget - lean) * (1 - Math.exp(-8 * dt))
      avatar.rotation.y = yaw
      avatar.rotation.z = lean
    },
    step(dt, moving, speed) {
      gait(dt, moving, speed)
    },
    setStyle(tint: number, luxury: boolean) {
      scarf.color.setHex(tint)
      scarf.emissive.setHex(tint)
      scarf.emissiveIntensity = 0.18
      chain.visible = luxury
    },
    setMask(mask: MaskId) {
      mountMask(maskAnchor, mask)
    },
  }
}
