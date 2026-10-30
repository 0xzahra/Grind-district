import * as THREE from 'three'
import { createAvatar, type Avatar } from './avatars.ts'
import type { BodyId } from './logic.ts'
import type { Obstacle } from './physics.ts'

type Point = { x: number; z: number }

type Person = {
  avatar: Avatar
  points: Point[]
  index: number
  speed: number
  x: number
  z: number
  radius: number
  moving: boolean
}

function label(name: string, rank: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not paint a nameplate.')
  context.fillStyle = 'rgba(6, 16, 12, 0.82)'
  context.beginPath()
  context.roundRect(8, 8, 240, 80, 18)
  context.fill()
  context.fillStyle = '#e9fff4'
  context.font = '700 28px Outfit, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(name, 128, 36)
  context.fillStyle = '#1af38f'
  context.font = '600 20px Outfit, sans-serif'
  context.fillText(rank, 128, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  )
  sprite.scale.set(1.7, 0.64, 1)
  sprite.position.y = 2.25
  sprite.userData.ghost = true
  sprite.raycast = () => undefined
  return sprite
}

function robot(): { object: THREE.Group; x: number; z: number } {
  const root = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({ color: 0x1c2824, roughness: 0.46, metalness: 0.35 })
  const mint = new THREE.MeshStandardMaterial({
    color: 0x1af38f,
    emissive: 0x1af38f,
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
  return { object: root, x: 10, z: 6 }
}

export function createCrowd(scene: THREE.Scene): { tick: (dt: number) => Obstacle[] } {
  const people: Person[] = []
  const specs: Array<{
    name: string
    rank: string
    body: BodyId
    tint: number
    luxury?: boolean
    speed: number
    points: Point[]
  }> = [
    { name: 'Adaeze', rank: 'Crab', body: 'player', tint: 0xff6f61, speed: 1.15, points: [{ x: -2.2, z: -37 }, { x: 2.2, z: -37 }] },
    { name: 'Malik', rank: 'Fish', body: 'player', tint: 0x9fd4ff, speed: 1.25, points: [{ x: -37, z: -2 }, { x: -37, z: 2 }] },
    { name: 'Nia', rank: 'Dolphin', body: 'player', tint: 0x1a4cff, speed: 1.2, points: [{ x: 37, z: -2 }, { x: 37, z: 2 }] },
    { name: 'Jo', rank: 'Shrimp', body: 'player', tint: 0xf0d7b0, speed: 1.35, points: [{ x: -2, z: 37 }, { x: 2, z: 37 }] },
    {
      name: 'Sefu',
      rank: 'Shark',
      body: 'player',
      tint: 0xf0d7b0,
      luxury: true,
      speed: 1.45,
      points: [
        { x: 0, z: -10 },
        { x: 10, z: 0 },
        { x: 0, z: 10 },
        { x: -10, z: 0 },
      ],
    },
  ]

  for (const spec of specs) {
    const avatar = createAvatar(spec.body, spec.tint, spec.luxury ?? false)
    avatar.object.add(label(spec.name, spec.rank))
    const start = spec.points[0]
    if (!start) continue
    avatar.object.position.set(start.x, 0, start.z)
    scene.add(avatar.object)
    people.push({
      avatar,
      points: spec.points,
      index: 1 % spec.points.length,
      speed: spec.speed,
      x: start.x,
      z: start.z,
      radius: 0.42,
      moving: true,
    })
  }

  const standers: Array<{ name: string; rank: string; body: BodyId; tint: number; x: number; z: number }> = [
    { name: 'Ife', rank: 'Crab', body: 'player', tint: 0xf0d7b0, x: -7.4, z: 3.6 },
    { name: 'Bo', rank: 'Fish', body: 'player', tint: 0x9fd4ff, x: 12, z: -36 },
  ]
  for (const spec of standers) {
    const avatar = createAvatar(spec.body, spec.tint, false)
    avatar.object.add(label(spec.name, spec.rank))
    avatar.object.position.set(spec.x, 0, spec.z)
    scene.add(avatar.object)
    people.push({
      avatar,
      points: [{ x: spec.x, z: spec.z }],
      index: 0,
      speed: 0,
      x: spec.x,
      z: spec.z,
      radius: 0.4,
      moving: false,
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
      for (const person of people) {
        const target = person.points[person.index]
        if (target && person.moving) {
          let dx = target.x - person.x
          let dz = target.z - person.z
          let dist = Math.hypot(dx, dz)
          if (dist < 0.3) {
            person.index = (person.index + 1) % person.points.length
            const next = person.points[person.index]
            if (next) {
              dx = next.x - person.x
              dz = next.z - person.z
              dist = Math.hypot(dx, dz)
            }
          }
          if (dist > 0.001) {
            const step = Math.min(dist, person.speed * dt)
            person.x += (dx / dist) * step
            person.z += (dz / dist) * step
            person.avatar.face(dx, dz, dt, true)
            person.avatar.step(dt, true, person.speed)
          }
        } else {
          person.avatar.step(dt, false, 0)
        }
        person.avatar.object.position.set(person.x, 0, person.z)
        obstacles.push({ kind: 'circle', x: person.x, z: person.z, r: person.radius })
      }

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
      unit.object.position.set(robotX, Math.sin(robotLeg * 2) * 0.03, robotZ)
      obstacles.push({ kind: 'circle', x: robotX, z: robotZ, r: 0.5 })
      return obstacles
    },
  }
}
