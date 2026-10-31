import { steadyPlate } from './rig.ts'
import * as THREE from 'three'
import { createAvatar, type Avatar } from './avatars.ts'
import { CITIZENS, stepCitizens, type CitizenSim } from './citizens.ts'
import { createDrone, spinDrone } from './drones.ts'
import type { Obstacle } from './physics.ts'

type Person = {
  avatar: Avatar
  sim: CitizenSim
  drone: THREE.Group | null
  radius: number
}

export function label(primary: string, secondary = ''): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not paint a nameplate.')
  context.fillStyle = 'rgba(14, 12, 10, 0.78)'
  context.beginPath()
  context.roundRect(8, 8, 240, 80, 18)
  context.fill()
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  if (secondary) {
    context.fillStyle = '#e9fff4'
    context.font = '700 28px Outfit, sans-serif'
    context.fillText(primary, 128, 36)
    context.fillStyle = '#d9b26a'
    context.font = '600 20px Outfit, sans-serif'
    context.fillText(secondary, 128, 64)
  } else {
    context.fillStyle = '#f2ece0'
    context.font = '700 28px Outfit, sans-serif'
    context.fillText(primary, 128, 48)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  sprite.scale.set(1.7, 0.64, 1)
  steadyPlate(sprite, 1.7, 0.64)
  sprite.position.y = 2.25
  sprite.userData.ghost = true
  sprite.raycast = () => undefined
  return sprite
}

function robot(): { object: THREE.Group; x: number; z: number } {
  const root = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({ color: 0x1c2824, roughness: 0.46, metalness: 0.35 })
  const mint = new THREE.MeshStandardMaterial({
    color: 0xd9b26a,
    emissive: 0xd9b26a,
    emissiveIntensity: 0.7,
    roughness: 0.35,
  })
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.32), shell)
  body.position.y = 0.78
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.28), shell)
  head.position.y = 1.22
  head.castShadow = true
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.08), mint)
  eye.position.set(0, 1.22, 0.15)
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 6), shell)
  antenna.position.y = 1.48
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mint)
  tip.position.y = 1.64
  root.add(body, head, eye, antenna, tip, label('Unit 4', 'Agent'))
  // Upgrade to the three.js RobotExpressive model (CC0, Tomás Laulhé) with walk animation once loaded.
  void import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) =>
    new GLTFLoader().loadAsync('/models/chars/RobotExpressive.glb')).then((gltf) => {
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    model.scale.setScalar(1.55 / Math.max(0.01, box.max.y - box.min.y))
    model.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true })
    for (const old of [body, head, eye, antenna, tip]) old.visible = false
    root.add(model)
    const mixer = new THREE.AnimationMixer(model)
    const walk = gltf.animations.find((a) => a.name === 'Walking')
    if (walk) mixer.clipAction(walk).play()
    root.userData.mixer = mixer
  }).catch(() => { /* keep the box robot */ })
  return { object: root, x: 10, z: 6 }
}

// Realistic skin tones and hair colours (skin, hair).
const LOOKS: Array<[number, number]> = [
  [0x8d5a3b, 0x1b1411], [0xe0b394, 0x3a2618], [0x5c3a26, 0x0f0b0a], [0xc68a64, 0x2a1a12],
  [0xf0c9ad, 0xd9c08a], [0x7a4a2e, 0x16100d], [0xb47a55, 0x4a2c1a], [0x9a6544, 0x0e0a08],
]

export function createCrowd(scene: THREE.Scene): { tick: (dt: number) => Obstacle[] } {
  const people: Person[] = []
  for (const spec of CITIZENS) {
    const avatar = createAvatar(spec.body, spec.tint, spec.luxury, people.length)
    // Street citizens show natural faces (licensed NFT faces only ever go on players who own them).
    void spec.mask
    const look = LOOKS[people.length % LOOKS.length]!
    avatar.object.traverse((node) => {
      const m = (node as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (!m || !('color' in m)) return
      if (m.name === 'skin') m.color.setHex(look[0])
      if (m.name === 'hair') m.color.setHex(look[1])
    })
    avatar.object.userData.look = { skin: look[0], hair: look[1], top: spec.tint }
    const start = spec.points[0]
    if (!start) continue
    avatar.object.position.set(start.x, 0, start.z)
    let drone: THREE.Group | null = null
    if (false as boolean && spec.drone !== 'none') { // follow drones retired
      drone = createDrone(spec.drone)
      drone.position.set(0.55, 2.15, 0.2)
      avatar.object.add(drone)
    }
    scene.add(avatar.object)
    people.push({
      avatar,
      sim: { spec, x: start.x, z: start.z, index: spec.points.length > 1 ? 1 % spec.points.length : 0 },
      drone,
      radius: spec.points.length > 1 ? 0.42 : 0.38,
    })
  }

  const unit = robot()
  unit.object.position.set(unit.x, 0, unit.z)
  scene.add(unit.object)
  let robotLeg = 0
  const robotEnds = [
    { x: 10, z: 6 },
    { x: 10, z: 9.2 },
  ]
  let robotIndex = 1
  let robotX = robotEnds[0]?.x ?? 10
  let robotZ = robotEnds[0]?.z ?? 6

  return {
    tick(dt) {
      const obstacles: Obstacle[] = []
      const before = people.map((person) => ({ x: person.sim.x, z: person.sim.z }))
      stepCitizens(people.map((person) => person.sim), dt)
      people.forEach((person, index) => {
        const prior = before[index]
        const dx = prior ? person.sim.x - prior.x : 0
        const dz = prior ? person.sim.z - prior.z : 0
        const moving = Math.hypot(dx, dz) > 0.001
        if (moving) person.avatar.face(dx, dz, dt, true)
        person.avatar.step(dt, moving, person.sim.spec.speed)
        person.avatar.object.position.set(person.sim.x, 0, person.sim.z)
        if (person.drone) spinDrone(person.drone, dt, performance.now() / 1000)
        obstacles.push({ kind: 'circle', x: person.sim.x, z: person.sim.z, r: person.radius })
      })

      const goal = robotEnds[robotIndex]
      if (goal) {
        const dx = goal.x - robotX
        const dz = goal.z - robotZ
        const dist = Math.hypot(dx, dz)
        if (dist < 0.2) robotIndex = (robotIndex + 1) % robotEnds.length
        else {
          const step = Math.min(dist, 0.7 * dt)
          robotX += (dx / dist) * step
          robotZ += (dz / dist) * step
          unit.object.rotation.y = Math.atan2(dx, dz)
        }
      }
      robotLeg += dt
      ;(unit.object.userData.mixer as THREE.AnimationMixer | undefined)?.update(dt)
      unit.object.position.set(robotX, Math.sin(robotLeg * 2) * 0.03, robotZ)
      obstacles.push({ kind: 'circle', x: robotX, z: robotZ, r: 0.5 })
      return obstacles
    },
  }
}
