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

/** Tapered six-sided segment hanging down from its pivot. Cheap enough for the crowd on a phone. */
function segment(parent: THREE.Object3D, top: number, bottom: number, length: number, material: THREE.Material, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, length, 6), material)
  mesh.position.set(0, -length / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export type HumanLeg = { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group }
export type HumanArm = { shoulder: THREE.Group; elbow: THREE.Group }

/** Thigh, shin, and shoe on three pivots. The sole lands at y = 0 when the leg is straight. */
export function humanLeg(
  parent: THREE.Object3D,
  side: number,
  spec: { x: number; hipY: number; thigh: number; shin: number; rThigh: number; rKnee: number; rAnkle: number },
  upper: THREE.Material,
  lower: THREE.Material,
  shoe: THREE.Material,
): HumanLeg {
  const hip = new THREE.Group()
  hip.position.set(side * spec.x, spec.hipY, 0)
  segment(hip, spec.rThigh, spec.rKnee, spec.thigh, upper)
  const knee = new THREE.Group()
  knee.position.y = -spec.thigh
  segment(knee, spec.rKnee, spec.rAnkle, spec.shin, lower)
  const ankle = new THREE.Group()
  ankle.position.y = -spec.shin
  const foot = new THREE.Mesh(new THREE.BoxGeometry(spec.rKnee * 1.9, 0.07, spec.rKnee * 3.6), shoe)
  const footDrop = spec.hipY - spec.thigh - spec.shin
  foot.position.set(0, -footDrop + 0.035, spec.rKnee * 0.9)
  foot.castShadow = true
  ankle.add(foot)
  knee.add(ankle)
  hip.add(knee)
  parent.add(hip)
  return { hip, knee, ankle }
}

/** Upper arm, forearm, cuff, and a faceted hand on a shoulder and an elbow pivot. */
export function humanArm(
  parent: THREE.Object3D,
  side: number,
  spec: { x: number; y: number; upper: number; fore: number; r: number },
  sleeve: THREE.Material,
  cuff: THREE.Material,
  hand: THREE.Material,
): HumanArm {
  const shoulder = new THREE.Group()
  shoulder.position.set(side * spec.x, spec.y, 0)
  shoulder.rotation.z = side * 0.06
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.r * 1.15, 0), sleeve)
  cap.castShadow = true
  shoulder.add(cap)
  segment(shoulder, spec.r, spec.r * 0.86, spec.upper, sleeve)
  const elbow = new THREE.Group()
  elbow.position.y = -spec.upper
  segment(elbow, spec.r * 0.86, spec.r * 0.72, spec.fore, sleeve)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(spec.r * 0.78, spec.r * 0.78, 0.05, 6), cuff)
  band.position.y = -spec.fore + 0.02
  elbow.add(band)
  const palm = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.r * 0.85, 0), hand)
  palm.scale.set(0.8, 1.25, 0.6)
  palm.position.y = -spec.fore - spec.r * 0.8
  palm.castShadow = true
  elbow.add(palm)
  shoulder.add(elbow)
  parent.add(shoulder)
  return { shoulder, elbow }
}

/**
 * A simple walk cycle: hips swing, the trailing knee folds, the foot rolls,
 * the arms counter-swing with a soft elbow, and the torso twists a little.
 */
export function humanGait(
  bob: THREE.Group,
  legs: [HumanLeg, HumanLeg],
  arms: [HumanArm, HumanArm],
  options: { swing: number; bounce: number; idle: number },
): (dt: number, moving: boolean, speed: number) => void {
  let phase = 0
  let time = 0
  let blend = 0
  return (dt, moving, speed) => {
    time += dt
    blend += ((moving ? 1 : 0) - blend) * (1 - Math.exp(-10 * dt))
    const stride = Math.max(0.6, speed) / 1.1
    phase += (moving ? stride * Math.PI * 2 : 1.3) * dt
    const s = Math.sin(phase)
    const c = Math.cos(phase)
    const run = Math.min(1, speed / 5.5)
    const amount = options.swing * (1 + run * 0.35) * blend
    legs.forEach((leg, index) => {
      const sign = index === 0 ? 1 : -1
      const swing = s * sign
      leg.hip.rotation.x = -swing * amount
      const lift = Math.max(0, c * sign)
      leg.knee.rotation.x = (lift * (0.9 + run * 0.5) + 0.05) * blend
      leg.ankle.rotation.x = (-leg.hip.rotation.x - leg.knee.rotation.x) * 0.55 * blend
    })
    arms.forEach((arm, index) => {
      const sign = index === 0 ? -1 : 1
      arm.shoulder.rotation.x = s * sign * amount * 0.75
      arm.elbow.rotation.x = -(0.18 + (0.3 + run * 0.6) * blend * (0.5 + 0.5 * s * sign))
    })
    bob.rotation.y = s * 0.07 * blend
    bob.rotation.x = 0.05 * run * blend
    const breathe = Math.sin(time * 1.5) * options.idle
    bob.position.y = blend * (Math.abs(c) * options.bounce - options.bounce * 0.5) + (1 - blend) * breathe
  }
}
