import * as THREE from 'three'

export type Locomotion = {
  face: (dirX: number, dirZ: number, dt: number, moving: boolean) => void
  step: (dt: number, moving: boolean, speed: number) => void
}

export function contactShadow(radius = 0.55): THREE.Mesh {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not paint a contact shadow.')
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,0.45)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  )
  disc.rotation.x = -Math.PI / 2
  disc.position.y = 0.02
  disc.userData.ghost = true
  disc.raycast = () => undefined
  return disc
}

export function locomotion(
  yawGroup: THREE.Group,
  bob: THREE.Group,
  legL: THREE.Group,
  legR: THREE.Group,
  armL: THREE.Group,
  armR: THREE.Group,
): Locomotion {
  let yaw = Math.PI
  let lean = 0
  let leanTarget = 0
  let phase = 0
  let time = 0

  return {
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
      yawGroup.rotation.y = yaw
      yawGroup.rotation.z = lean
    },
    step(dt, moving, speed) {
      time += dt
      const stride = moving ? Math.max(0.55, speed) / 1.15 : 0
      phase += moving ? stride * Math.PI * 2 * dt : dt * 1.3
      const swing = Math.sin(phase)
      const amount = moving ? 0.55 : 0.05
      legL.rotation.x = -swing * amount
      legR.rotation.x = swing * amount
      armL.rotation.x = swing * amount * 0.7
      armR.rotation.x = -swing * amount * 0.7
      bob.position.y = moving ? Math.abs(swing) * 0.05 : Math.sin(time * 1.5) * 0.015
      bob.rotation.x = moving ? 0.06 * Math.min(1, speed / 5.4) : 0
    },
  }
}
