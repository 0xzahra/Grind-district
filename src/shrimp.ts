import * as THREE from 'three'
import type { MaskId } from './logic.ts'
import { mountMask } from './masks.ts'

const MINT = 0x17f790

export type ShrimpAvatar = {
  object: THREE.Group
  face: (dirX: number, dirZ: number, dt: number, moving: boolean) => void
  step: (dt: number, moving: boolean, speed: number) => void
  setStyle: (tint: number, luxury: boolean) => void
  setMask: (mask: MaskId) => void
}

export function createShrimp(): ShrimpAvatar {
  const shell = new THREE.MeshStandardMaterial({
    color: MINT,
    roughness: 0.36,
    metalness: 0.08,
    emissive: 0x0a6b40,
    emissiveIntensity: 0.45,
  })
  const deep = new THREE.MeshStandardMaterial({
    color: 0x0c8a4e,
    roughness: 0.5,
    metalness: 0.05,
    emissive: 0x05381f,
    emissiveIntensity: 0.28,
  })
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0xe7fff3,
    roughness: 0.52,
    emissive: 0x12382a,
    emissiveIntensity: 0.06,
  })
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf6fff9, roughness: 0.22 })
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x07140c, roughness: 0.4 })

  const root = new THREE.Group()
  root.name = 'shrimp'
  const avatar = new THREE.Group()
  avatar.rotation.y = Math.PI
  root.add(avatar)
  const bob = new THREE.Group()
  avatar.add(bob)

  const part = (geometry: THREE.BufferGeometry, material: THREE.Material, cast = true) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = cast
    mesh.receiveShadow = true
    return mesh
  }

  const segment = (y: number, sx: number, sy: number, sz: number, material: THREE.Material) => {
    const mesh = part(new THREE.SphereGeometry(1, 20, 16), material)
    mesh.scale.set(sx, sy, sz)
    mesh.position.y = y
    bob.add(mesh)
    return mesh
  }

  segment(0.92, 0.34, 0.26, 0.3, deep)
  segment(1.16, 0.4, 0.28, 0.34, shell)
  segment(1.38, 0.32, 0.24, 0.28, shell)

  const belly = part(new THREE.SphereGeometry(1, 16, 12), bellyMat, false)
  belly.scale.set(0.22, 0.3, 0.16)
  belly.position.set(0, 1.14, 0.2)
  bob.add(belly)

  const head = part(new THREE.SphereGeometry(1, 18, 14), shell)
  head.scale.set(0.28, 0.24, 0.26)
  head.position.set(0, 1.58, 0.06)
  bob.add(head)
  const maskAnchor = new THREE.Group()
  maskAnchor.name = 'mask-anchor'
  maskAnchor.position.set(0, 1.62, 0.28)
  bob.add(maskAnchor)

  const rostrum = part(new THREE.ConeGeometry(0.08, 0.28, 8), shell)
  rostrum.rotation.x = Math.PI / 2
  rostrum.position.set(0, 1.6, 0.3)
  bob.add(rostrum)

  const belt = (y: number, radius: number) => {
    const ring = part(new THREE.TorusGeometry(radius, 0.018, 6, 18), deep, false)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
    bob.add(ring)
  }
  belt(1.04, 0.32)
  belt(1.28, 0.34)

  const gold = new THREE.MeshStandardMaterial({
    color: 0xf0c14a,
    roughness: 0.28,
    metalness: 0.82,
    emissive: 0x6a4a10,
    emissiveIntensity: 0.25,
  })
  const chain = part(new THREE.TorusGeometry(0.2, 0.03, 8, 18), gold, false)
  chain.rotation.x = Math.PI / 2.5
  chain.position.set(0, 1.4, 0.04)
  chain.visible = false
  bob.add(chain)

  for (let i = 0; i < 3; i += 1) {
    const fin = part(new THREE.ConeGeometry(0.06, 0.2, 5), deep, false)
    fin.position.set(0, 1.12 + i * 0.16, -0.16)
    fin.rotation.x = -0.35
    bob.add(fin)
  }

  const addEye = (side: number) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.1, 1.66, 0.08)
    pivot.rotation.z = side * -0.45
    pivot.rotation.x = 0.35
    const stalk = part(new THREE.CylinderGeometry(0.028, 0.034, 0.12, 7), shell, false)
    stalk.position.y = 0.06
    const eye = part(new THREE.SphereGeometry(0.07, 12, 10), eyeMat, false)
    eye.position.y = 0.14
    const pupil = part(new THREE.SphereGeometry(0.034, 8, 8), pupilMat, false)
    pupil.position.set(0, 0.16, 0.05)
    pivot.add(stalk, eye, pupil)
    bob.add(pivot)
  }
  addEye(1)
  addEye(-1)

  const feelers = new THREE.Group()
  feelers.position.set(0, 1.68, 0.04)
  const addAntenna = (side: number, rise: number, back: number, radius: number) => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * 0.05, 0, 0.02),
      new THREE.Vector3(side * 0.16, rise * 0.7, -back * 0.25),
      new THREE.Vector3(side * 0.34, rise, -back),
    )
    feelers.add(part(new THREE.TubeGeometry(curve, 16, radius, 5, false), shell, false))
  }
  addAntenna(1, 0.62, 0.48, 0.028)
  addAntenna(-1, 0.62, 0.48, 0.028)
  addAntenna(1, 0.32, 0.18, 0.02)
  addAntenna(-1, 0.32, 0.18, 0.02)
  bob.add(feelers)

  const addLeg = (side: number) => {
    const hip = new THREE.Group()
    hip.position.set(side * 0.18, 0.86, 0.02)
    hip.rotation.z = side * 0.16
    const upper = part(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), deep)
    upper.position.y = -0.21
    const knee = new THREE.Group()
    knee.position.y = -0.42
    knee.rotation.x = 0.2
    const lower = part(new THREE.CapsuleGeometry(0.05, 0.26, 4, 8), deep)
    lower.position.y = -0.18
    const foot = part(new THREE.SphereGeometry(0.075, 10, 8), deep)
    foot.scale.set(1.25, 0.42, 1.7)
    foot.position.set(0, -0.34, 0.04)
    knee.add(lower, foot)
    hip.add(upper, knee)
    bob.add(hip)
    return { hip, knee }
  }

  const addClaw = (side: number) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.3, 1.24, 0.06)
    const arm = part(new THREE.CapsuleGeometry(0.05, 0.26, 4, 8), shell)
    arm.rotation.z = side * 1.15
    arm.position.set(side * 0.16, -0.04, 0.05)
    const hand = part(new THREE.SphereGeometry(0.085, 10, 8), shell)
    hand.position.set(side * 0.32, -0.06, 0.12)
    shoulder.add(arm, hand)
    bob.add(shoulder)
    return shoulder
  }

  const legL = addLeg(-1)
  const legR = addLeg(1)
  const clawL = addClaw(-1)
  const clawR = addClaw(1)

  const tail = new THREE.Group()
  tail.position.set(0, 0.9, -0.28)
  tail.rotation.x = 0.22
  const tailSeg = (z: number, sx: number, sy: number, sz: number, y = 0) => {
    const mesh = part(new THREE.SphereGeometry(1, 14, 12), shell)
    mesh.scale.set(sx, sy, sz)
    mesh.position.set(0, y, z)
    tail.add(mesh)
  }
  tailSeg(-0.16, 0.24, 0.16, 0.18, 0)
  tailSeg(-0.34, 0.18, 0.13, 0.15, 0.02)
  tailSeg(-0.5, 0.14, 0.1, 0.12, 0.03)
  tailSeg(-0.68, 0.34, 0.055, 0.16, 0.04)
  bob.add(tail)

  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = 128
  shadowCanvas.height = 128
  const shadowContext = shadowCanvas.getContext('2d')
  if (!shadowContext) throw new Error('Could not paint the contact shadow.')
  const gradient = shadowContext.createRadialGradient(64, 64, 10, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  shadowContext.fillStyle = gradient
  shadowContext.fillRect(0, 0, 128, 128)
  const shadowTex = new THREE.CanvasTexture(shadowCanvas)
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
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
  let phase = 0
  let time = 0

  return {
    object: root,
    face(dirX, dirZ, dt, moving) {
      if (moving && dirX * dirX + dirZ * dirZ > 0.0001) {
        const target = Math.atan2(dirX, dirZ)
        const delta = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw))
        yaw += delta * (1 - Math.exp(-10 * dt))
        leanTarget = THREE.MathUtils.clamp(-delta * 1.2, -0.22, 0.22)
      } else {
        leanTarget = 0
      }
      lean += (leanTarget - lean) * (1 - Math.exp(-8 * dt))
      avatar.rotation.y = yaw
      avatar.rotation.z = lean
    },
    step(dt, moving, speed) {
      time += dt
      const stride = moving ? Math.max(0.6, speed) / 1.05 : 0
      phase += moving ? stride * Math.PI * 2 * dt : dt * 1.4
      const s = Math.sin(phase)
      const swing = moving ? 0.48 : 0.04
      legL.hip.rotation.x = -s * swing
      legR.hip.rotation.x = s * swing
      const bend = moving ? 0.5 : 0
      legL.knee.rotation.x = 0.16 + Math.max(0, -s) * bend
      legR.knee.rotation.x = 0.16 + Math.max(0, s) * bend
      clawL.rotation.x = s * swing * 0.75
      clawR.rotation.x = -s * swing * 0.75
      bob.position.y = moving ? Math.abs(s) * 0.055 : Math.sin(time * 1.6) * 0.018
      bob.rotation.x = moving ? 0.1 * Math.min(1, speed / 5.4) : 0
      tail.rotation.x = 0.22 + Math.sin(phase * 0.5) * (moving ? 0.06 : 0.03)
      tail.rotation.y = Math.sin(phase * 0.5) * (moving ? 0.22 : 0.07)
      feelers.rotation.z = Math.sin(time * 1.7) * (moving ? 0.08 : 0.05)
      feelers.rotation.x = Math.sin(time * 1.2) * 0.04
    },
    setStyle(tint: number, luxury: boolean) {
      shell.color.setHex(tint)
      shell.emissive.setHex(tint)
      shell.emissiveIntensity = 0.32
      chain.visible = luxury
    },
    setMask(mask: MaskId) {
      mountMask(maskAnchor, mask)
    },
  }
}
