import * as THREE from 'three'
import type { MaskId } from './logic.ts'
import { mountMask } from './masks.ts'
import type { ShrimpAvatar } from './shrimp.ts'
import { humanArm, humanGait, humanLeg } from './rig.ts'

const SKIN = 0xf0c4a8
const HAIR = 0xf3e2a4
const SUIT = 0x5c6b80
const SHIRT = 0x1a4cff
const FRAME = 0xd7dee6

function mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: true,
  })
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

/** Block letters on a blue plate. The words are the name and username they chose. */
export function tagPlayer(root: THREE.Object3D, name: string, handle = ''): void {
  const previous = root.getObjectByName('player-tag')
  if (previous) previous.removeFromParent()
  if (!name) return
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 220
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  const label = name.toUpperCase()
  let size = 64
  context.font = `700 ${size}px "Archivo Black", sans-serif`
  while (size > 28 && context.measureText(label).width > 560) {
    size -= 4
    context.font = `700 ${size}px "Archivo Black", sans-serif`
  }
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const plate = Math.min(600, context.measureText(label).width + 56)
  const top = handle ? 24 : 58
  const height = handle ? 148 : 88
  context.fillStyle = '#1236d6'
  context.fillRect((canvas.width - plate) / 2, top, plate, height)
  context.fillStyle = '#f7f9fc'
  context.fillText(label, 320, top + (handle ? 48 : 44))
  if (handle) {
    context.font = '600 30px Outfit, sans-serif'
    context.fillText(`@${handle}`, 320, top + 108)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.name = 'player-tag'
  sprite.scale.set(1.7, 0.58, 1)
  sprite.position.y = 2.28
  sprite.userData.ghost = true
  sprite.raycast = () => undefined
  root.add(sprite)
}

/**
 * Original low-poly citizen. Blonde swept hair, thin glasses, grey suit, blue shirt.
 * Not taken from a licensed collection. The plate reads the name they signed up with.
 */
export function createPlayer(): ShrimpAvatar {
  const skin = mat(SKIN, 0.58)
  const hairMat = mat(HAIR, 0.4)
  hairMat.emissive = new THREE.Color(0x4a3a12)
  hairMat.emissiveIntensity = 0.2
  const suit = mat(SUIT, 0.64)
  const shirt = mat(SHIRT, 0.48)
  shirt.emissive = new THREE.Color(SHIRT)
  shirt.emissiveIntensity = 0.16
  const metal = mat(FRAME, 0.16, 0.9)
  metal.emissive = new THREE.Color(0x9aa6b3)
  metal.emissiveIntensity = 0.18
  const dark = mat(0x14181c, 0.45)
  const lens = new THREE.MeshStandardMaterial({
    color: 0xb7c6d4,
    transparent: true,
    opacity: 0.22,
    roughness: 0.04,
    metalness: 0.05,
    depthWrite: false,
  })
  const iris = mat(0x3a4a36, 0.95)
  iris.envMapIntensity = 0 // matte eyes: no env or bloom sparkle
  const pupil = mat(0x10140f, 0.95)
  const lip = mat(0xc9897a, 0.52)

  const root = new THREE.Group()
  root.name = 'player-8453'
  const avatar = new THREE.Group()
  avatar.rotation.y = Math.PI
  root.add(avatar)
  const key = new THREE.PointLight(0xfff6ea, 2.6, 3.6, 2)
  key.position.set(0, 2.15, -1.1)
  avatar.add(key)
  const faceLight = new THREE.PointLight(0xe7eeff, 0.9, 2.8, 2)
  faceLight.position.set(0, 1.62, 0.9)
  avatar.add(faceLight)
  const bob = new THREE.Group()
  avatar.add(bob)

  const pelvis = part(new THREE.CylinderGeometry(0.2, 0.17, 0.2, 6), suit, bob, 0, 0.9, 0)
  pelvis.scale.z = 0.7
  part(new THREE.BoxGeometry(0.4, 0.04, 0.2), dark, bob, 0, 0.99, 0)
  const neck = part(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 6), skin, bob, 0, 1.5, 0.01)
  neck.castShadow = false

  const jacket = part(new THREE.BoxGeometry(0.5, 0.56, 0.28), suit, bob, 0, 1.2, 0)
  jacket.scale.set(1.08, 1, 1.02)
  part(new THREE.BoxGeometry(0.18, 0.42, 0.03), shirt, bob, 0, 1.18, 0.15)
  part(new THREE.BoxGeometry(0.16, 0.1, 0.02), shirt, bob, 0, 1.38, -0.145)
  part(new THREE.BoxGeometry(0.12, 0.1, 0.03), shirt, bob, 0, 1.42, 0.145)
  const button = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8)
  part(button, dark, bob, 0.04, 1.26, 0.165).rotation.x = Math.PI / 2
  part(button, dark, bob, 0.04, 1.08, 0.165).rotation.x = Math.PI / 2

  const lapelL = part(new THREE.BoxGeometry(0.1, 0.28, 0.03), suit, bob, -0.1, 1.28, 0.15)
  lapelL.rotation.z = 0.35
  const lapelR = part(new THREE.BoxGeometry(0.1, 0.28, 0.03), suit, bob, 0.1, 1.28, 0.15)
  lapelR.rotation.z = -0.35

  const headGeo = new THREE.IcosahedronGeometry(0.155, 1)
  const headPos = headGeo.attributes.position
  for (let i = 0; i < headPos.count; i += 1) {
    let x = headPos.getX(i)
    let y = headPos.getY(i)
    let z = headPos.getZ(i)
    y *= 1.24
    x *= 0.9
    if (y < -0.01) {
      const jaw = Math.min(1, -y / 0.16)
      x *= 1 - 0.36 * jaw
      z *= 1 - 0.05 * jaw
    }
    if (y < -0.1 && z > 0.02) {
      y -= 0.02
      z += 0.012
    }
    if (z > 0.07 && Math.abs(x) < 0.05 && y > -0.02 && y < 0.055) {
      z += 0.034 + (Math.abs(x) < 0.018 ? 0.02 : 0)
    }
    if (z > 0.05 && y > 0.035 && y < 0.095) z += 0.018
    if (Math.abs(x) > 0.05 && Math.abs(x) < 0.13 && y > -0.04 && y < 0.05 && z > 0.02) {
      x *= 1.08
      z += 0.012
    }
    headPos.setXYZ(i, x, y, z)
  }
  headGeo.computeVertexNormals()
  part(headGeo, skin, bob, 0, 1.64, 0.02)

  const shards = [
    [0, 1.9, -0.02, 0.22, 0.055, 0.22, -0.6, 0, 0],
    [-0.09, 1.93, 0.02, 0.1, 0.05, 0.18, -0.85, 0.3, 0.5],
    [0.09, 1.94, 0.01, 0.1, 0.048, 0.18, -0.9, -0.25, -0.42],
    [-0.15, 1.8, 0.03, 0.07, 0.04, 0.16, -0.3, 0.4, 0.85],
    [0.15, 1.81, 0.03, 0.07, 0.038, 0.16, -0.25, -0.35, -0.78],
    [0, 1.99, -0.06, 0.09, 0.08, 0.14, -1.05, 0, 0],
    [-0.04, 1.86, 0.09, 0.1, 0.035, 0.07, 0.45, 0.15, 0.2],
    [0.05, 1.85, 0.1, 0.09, 0.032, 0.07, 0.4, -0.12, -0.16],
  ] as const
  for (const [x, y, z, sx, sy, sz, rx, ry, rz] of shards) {
    const shard = part(new THREE.BoxGeometry(sx, sy, sz), hairMat, bob, x, y, z)
    shard.rotation.set(rx, ry, rz)
  }

  const nose = part(new THREE.ConeGeometry(0.026, 0.07, 4), skin, bob, 0, 1.6, 0.145)
  nose.rotation.x = Math.PI / 2
  part(new THREE.BoxGeometry(0.05, 0.012, 0.012), lip, bob, 0, 1.5, 0.155)
  const browL = part(new THREE.BoxGeometry(0.07, 0.012, 0.012), hairMat, bob, -0.05, 1.72, 0.15)
  const browR = part(new THREE.BoxGeometry(0.07, 0.012, 0.012), hairMat, bob, 0.05, 1.72, 0.15)
  browL.rotation.z = 0.12
  browR.rotation.z = -0.12

  const addEye = (side: number) => {
    part(new THREE.SphereGeometry(0.026, 8, 6), iris, bob, side * 0.058, 1.655, 0.155)
    part(new THREE.SphereGeometry(0.012, 6, 5), pupil, bob, side * 0.058, 1.655, 0.178)
  }
  addEye(-1)
  addEye(1)

  const addRim = (side: number) => {
    const outline = part(new THREE.BoxGeometry(0.125, 0.055, 0.012), dark, bob, side * 0.058, 1.655, 0.168)
    outline.castShadow = false
    const rim = part(new THREE.BoxGeometry(0.112, 0.042, 0.014), metal, bob, side * 0.058, 1.655, 0.176)
    rim.castShadow = false
    const glass = part(new THREE.PlaneGeometry(0.09, 0.03), lens, bob, side * 0.058, 1.655, 0.184)
    glass.castShadow = false
    glass.receiveShadow = false
  }
  addRim(-1)
  addRim(1)
  part(new THREE.BoxGeometry(0.028, 0.01, 0.01), metal, bob, 0, 1.658, 0.172)
  const maskAnchor = new THREE.Group()
  maskAnchor.name = 'mask-anchor'
  maskAnchor.position.set(0, 1.64, 0.2)
  bob.add(maskAnchor)
  const templeL = part(new THREE.BoxGeometry(0.01, 0.01, 0.16), metal, bob, -0.12, 1.662, 0.09)
  const templeR = part(new THREE.BoxGeometry(0.01, 0.01, 0.16), metal, bob, 0.12, 1.662, 0.09)
  templeL.castShadow = false
  templeR.castShadow = false

  const gold = mat(0xf0c14a, 0.28, 0.82)
  gold.emissive = new THREE.Color(0x6a4a10)
  gold.emissiveIntensity = 0.25
  const chain = part(new THREE.TorusGeometry(0.11, 0.012, 6, 14), gold, bob, 0, 1.28, 0.16)
  chain.rotation.x = Math.PI / 2.3
  chain.visible = false

  const shoe = dark
  const legL = humanLeg(bob, -1, { x: 0.1, hipY: 0.92, thigh: 0.44, shin: 0.41, rThigh: 0.085, rKnee: 0.065, rAnkle: 0.05 }, suit, suit, shoe)
  const legR = humanLeg(bob, 1, { x: 0.1, hipY: 0.92, thigh: 0.44, shin: 0.41, rThigh: 0.085, rKnee: 0.065, rAnkle: 0.05 }, suit, suit, shoe)
  const armL = humanArm(bob, -1, { x: 0.3, y: 1.42, upper: 0.27, fore: 0.25, r: 0.06 }, suit, shirt, skin)
  const armR = humanArm(bob, 1, { x: 0.3, y: 1.42, upper: 0.27, fore: 0.25, r: 0.06 }, suit, shirt, skin)
  const gait = humanGait(bob, [legL, legR], [armL, armR], { swing: 0.55, bounce: 0.045, idle: 0.012 })

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
    new THREE.CircleGeometry(0.46, 20),
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
      shirt.color.setHex(tint)
      shirt.emissive.setHex(tint)
      shirt.emissiveIntensity = 0.16
      chain.visible = luxury
    },
    setMask(mask: MaskId) {
      mountMask(maskAnchor, mask)
    },
  }
}
