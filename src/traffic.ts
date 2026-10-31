import * as THREE from 'three'
import { ARMS as LANE_ARMS, lanePoint, uturnPoint } from './lanes.ts'
import type { Graphics } from './logic.ts'
import type { Obstacle } from './physics.ts'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Kenney Car Kit (CC0). Each model merges to one geometry -> one InstancedMesh per model.
const CAR_MODELS = ['sedan', 'suv', 'taxi', 'sedan-sports', 'hatchback-sports', 'van', 'police']
const CAR_SCALE = 1.5

/**
 * Ambient city: instanced pedestrians on the sidewalks and modern cars in lanes.
 * Two draw calls for people, three for cars. Counts scale with Settings > Graphics.
 * Cars stop at the plaza stop lines on a shared signal and for the car ahead, then turn back.
 */

type Lanes = { roadHalf: number; walk: number; inner: number; outer: number }
type Arm = { ax: number; az: number } // unit vector pointing out from the plaza
const ARMS: Arm[] = [...LANE_ARMS]
const COUNTS: Record<Graphics, { people: number; cars: number }> = {
  low: { people: 14, cars: 4 },
  medium: { people: 22, cars: 8 },
  high: { people: 24, cars: 10 },
}
const CAR_COLORS = [0xf2f4f7, 0x15181c, 0x8a96a3, 0x1a4cff, 0x3d4a3f, 0xb3122e, 0x2a2f36, 0xd9c7a1]
const SHIRTS = [0x1a4cff, 0x6b5a45, 0xf2f4f7, 0x2a1422, 0xff6f91, 0x5c6b80, 0xffb347, 0x3a3f47]
const LOD = 70
const SIGNAL_PERIOD = 14

type Walker = { arm: number; side: number; t: number; dir: number; speed: number; phase: number }
type Car = { park: number; arm: number; outbound: boolean; t: number; speed: number; wait: number; turn: number; swing: number; a0: number; a1: number }

export function createTraffic(scene: THREE.Scene, lanes: Lanes, graphics: Graphics): {
  tick: (dt: number, time: number, focus: { x: number; z: number }, people?: Obstacle[]) => Obstacle[]
} {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const counts = COUNTS[coarse && graphics !== 'low' ? 'low' : graphics]
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()

  // People: fuller stylised bodies built from a few instanced parts (7 draw calls total).
  const box = (w: number, h: number, d: number, y: number, z = 0) => new THREE.BoxGeometry(w, h, d).translate(0, y, z)
  const torsoGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.2, 0.17, 0.56, 10).scale(1, 1, 0.62).translate(0, 1.18, 0), // chest -> waist
    new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.12, 0.45, 0.66).translate(0, 1.45, 0), // shoulders
    new THREE.CylinderGeometry(0.18, 0.19, 0.16, 10).scale(1, 1, 0.68).translate(0, 0.88, 0), // hips
    new THREE.CylinderGeometry(0.055, 0.06, 0.08, 6).translate(0, 1.53, 0), // neck
  ])!
  const legGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.085, 0.065, 0.82, 8).translate(0, -0.41, 0),
    box(0.11, 0.07, 0.24, -0.84, 0.05), // shoe
  ])!
  const armGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.06, 0.048, 0.6, 8).translate(0, -0.3, 0),
    new THREE.SphereGeometry(0.05, 6, 4).translate(0, -0.63, 0), // hand
  ])!
  const headGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(0.115, 1).scale(0.9, 1.12, 1).translate(0, 1.7, 0),
  ])!
  const hairGeo = new THREE.SphereGeometry(0.124, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.95, 1.05, 1.04).translate(0, 1.72, -0.008)
  const cloth = new THREE.MeshStandardMaterial({ roughness: 0.78, flatShading: true })
  const bodies = new THREE.InstancedMesh(torsoGeo, cloth, counts.people)
  const armsL = new THREE.InstancedMesh(armGeo, cloth, counts.people)
  const armsR = new THREE.InstancedMesh(armGeo, cloth, counts.people)
  const trousers = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true })
  const legsL = new THREE.InstancedMesh(legGeo, trousers, counts.people)
  const legsR = new THREE.InstancedMesh(legGeo, trousers, counts.people)
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.62, flatShading: true }), counts.people)
  const hair = new THREE.InstancedMesh(hairGeo, new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), counts.people)
  const skins = [0xf0c4a8, 0x8d5a3b, 0xc68a62, 0x5a3825, 0xe8b894]
  const pants = [0x22262b, 0x3a3f47, 0x1d2a3a, 0x5b4a3a, 0x2b2b2b]
  const hairs = [0x16110e, 0x3b2a1e, 0x0e0e10, 0x6b4a2e, 0xc9a66b]
  const walkers: Walker[] = []
  for (let i = 0; i < counts.people; i += 1) {
    walkers.push({ arm: i % 4, side: i % 8 < 4 ? 1 : -1, t: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.5, phase: Math.random() * 6 })
    const shirt = color.setHex(SHIRTS[i % SHIRTS.length] ?? 0xffffff)
    bodies.setColorAt(i, shirt)
    armsL.setColorAt(i, shirt)
    armsR.setColorAt(i, shirt)
    const leg = color.setHex(pants[(i * 3) % pants.length] ?? 0x222222)
    legsL.setColorAt(i, leg)
    legsR.setColorAt(i, leg)
    heads.setColorAt(i, color.setHex(skins[i % skins.length] ?? 0xf0c4a8))
    hair.setColorAt(i, color.setHex(hairs[(i * 7) % hairs.length] ?? 0x111111))
  }
  // Style variety: distinct hair shapes and outfit pieces, each one instanced; unused slots get a zero matrix.
  const hairShapes = [
    hairGeo, // short crop
    mergeGeometries([hairGeo.clone(), new THREE.SphereGeometry(0.07, 8, 6).translate(0, 1.86, -0.07)])!, // bun
    new THREE.IcosahedronGeometry(0.17, 1).scale(1, 0.95, 1).translate(0, 1.76, -0.02), // afro
    mergeGeometries([hairGeo.clone(), new THREE.BoxGeometry(0.22, 0.34, 0.08).translate(0, 1.56, -0.09)])!, // long
    mergeGeometries([hairGeo.clone(), ...[-0.07, 0, 0.07].map((x) => new THREE.CylinderGeometry(0.025, 0.02, 0.36, 5).translate(x, 1.55, -0.1))])!, // locs
    mergeGeometries([new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.73, 0), new THREE.CylinderGeometry(0.13, 0.13, 0.02, 10).scale(1, 1, 1.4).translate(0, 1.74, 0.07)])!, // cap
  ]
  const hairMat = hair.material as THREE.MeshStandardMaterial
  hair.visible = false
  const hairMeshes = hairShapes.map((g) => new THREE.InstancedMesh(g, hairMat, counts.people))
  const hoodGeo = new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4).scale(1, 1, 0.8).translate(0, 1.5, -0.08)
  const skirtGeo = new THREE.CylinderGeometry(0.17, 0.3, 0.55, 10).scale(1, 1, 0.75).translate(0, 0.62, 0)
  const coatGeo = new THREE.CylinderGeometry(0.21, 0.23, 0.5, 10).scale(1, 1, 0.66).translate(0, 0.78, 0)
  const hoods = new THREE.InstancedMesh(hoodGeo, cloth, counts.people)
  const skirts = new THREE.InstancedMesh(skirtGeo, cloth, counts.people)
  const coats = new THREE.InstancedMesh(coatGeo, cloth, counts.people)
  const hairKind = walkers.map((_, i) => (i * 5 + 1) % hairShapes.length)
  const outfit = walkers.map((_, i) => ['jacket', 'hoodie', 'dress', 'suit', 'tee'][(i * 3) % 5] as string)
  walkers.forEach((_, i) => {
    const c = new THREE.Color()
    bodies.getColorAt(i, c)
    for (const m of [hoods, skirts, coats]) m.setColorAt(i, c)
    if (outfit[i] === 'suit') { for (const m of [bodies, armsL, armsR, legsL, legsR, coats]) m.setColorAt(i, c.setHex([0x2a2d33, 0x3b3530, 0x1f2a3a][i % 3]!)) }
    if (outfit[i] === 'tee') armsL.setColorAt(i, heads.getColorAt(i, c)), armsR.setColorAt(i, c)
    hair.getColorAt(i, c)
    for (const m of hairMeshes) m.setColorAt(i, c)
  })
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  const peopleMeshes = [bodies, armsL, armsR, legsL, legsR, heads, hair, ...hairMeshes, hoods, skirts, coats]
  for (const mesh of peopleMeshes) {
    mesh.castShadow = graphics === 'high'
    mesh.frustumCulled = false
    mesh.userData.ghost = true
    mesh.raycast = () => undefined
    scene.add(mesh)
  }
  const limb = new THREE.Object3D()
  const limbAt = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, swing: number) => {
    limb.position.set(x, y, 0)
    limb.rotation.set(swing, 0, 0)
    limb.updateMatrix()
    mesh.setMatrixAt(i, limb.matrix.premultiply(dummy.matrix))
  }

  // Cars: a low body, a glass cabin, and four wheels merged into one instanced mesh.
  const carBody = new THREE.BoxGeometry(1.9, 0.55, 4.2)
  carBody.translate(0, 0.55, 0)
  const cabinGeo = new THREE.BoxGeometry(1.6, 0.5, 2.2)
  cabinGeo.translate(0, 1.07, -0.25)
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10)
  wheelGeo.rotateZ(Math.PI / 2)
  const wheelParts: THREE.BufferGeometry[] = []
  for (const [x, z] of [[-0.9, 1.35], [0.9, 1.35], [-0.9, -1.35], [0.9, -1.35]] as const) {
    const part = wheelGeo.clone()
    part.translate(x, 0.34, z)
    wheelParts.push(part)
  }
  const wheelsGeo = mergeSimple(wheelParts)
  const paint = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.55 })
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1418, roughness: 0.1, metalness: 0.8, emissive: 0x000000, emissiveIntensity: 0 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 })
  const bodiesCar = new THREE.InstancedMesh(carBody, paint, counts.cars)
  const cabins = new THREE.InstancedMesh(cabinGeo, glass, counts.cars)
  const wheels = new THREE.InstancedMesh(wheelsGeo, rubber, counts.cars)
  const cars: Car[] = []
  for (let i = 0; i < counts.cars; i += 1) {
    // Spawn spaced along the lanes: re-sample until at least 7 m (car + margin) from every car in the same lane.
    const arm = i % 4
    const outbound = i % 2 === 0
    let t = (i * 0.37) % 1
    for (let tries = 0; tries < 20; tries++) {
      if (cars.every((o) => o.arm !== arm || o.outbound !== outbound || Math.abs(o.t - t) * (lanes.outer - lanes.inner) > 7)) break
      t = (t + 0.13) % 1
    }
    cars.push({ park: 0, arm, outbound, t, speed: 6 + (i % 3), wait: 0, turn: 0, swing: 0, a0: 0, a1: 0 })
    bodiesCar.setColorAt(i, color.setHex(CAR_COLORS[i % CAR_COLORS.length] ?? 0xffffff))
  }
  for (const mesh of [bodiesCar, cabins, wheels]) {
    mesh.castShadow = graphics !== 'low'
    mesh.frustumCulled = false
    mesh.userData.ghost = true
    mesh.raycast = () => undefined
    scene.add(mesh)
  }

  // Head and tail lights: two tiny instanced emissive strips that bloom at night.
  const lightGeo = new THREE.BoxGeometry(1.3, 0.1, 0.05)
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6e0, toneMapped: false })
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false })
  const heads2 = new THREE.InstancedMesh(lightGeo, headMat, counts.cars)
  const tails = new THREE.InstancedMesh(lightGeo, tailMat, counts.cars)
  for (const mesh of [heads2, tails]) {
    mesh.frustumCulled = false
    mesh.userData.ghost = true
    mesh.raycast = () => undefined
    scene.add(mesh)
  }
  const lightOffset = new THREE.Matrix4()
  const headLocal = new THREE.Matrix4().makeTranslation(0, 0.66, 1.92)
  // The Grind District logo lives only here: a small roof sign on every car (one instanced draw call).
  const logoTex = new THREE.TextureLoader().load('/brand/logo-car.jpg')
  logoTex.colorSpace = THREE.SRGBColorSpace
  const roofSigns = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.34, 0.62), [
    new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }),
    new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }),
  ], counts.cars)
  roofSigns.frustumCulled = false
  roofSigns.userData.ghost = true
  roofSigns.raycast = () => undefined
  scene.add(roofSigns)
  const roofLocal = new THREE.Matrix4().makeTranslation(0, 1.5, -0.3)
  const tailLocal = new THREE.Matrix4().makeTranslation(0, 0.72, -1.92)

  // Swap the box cars for Kenney models once they load; boxes stay as the instant fallback.
  type Slot = { mesh: THREE.InstancedMesh; index: number }
  let slots: Slot[] | null = null
  const loader = new GLTFLoader()
  const kinds = CAR_MODELS.slice(0, Math.max(3, Math.min(CAR_MODELS.length, counts.cars)))
  Promise.all(kinds.map((name) => loader.loadAsync(`/models/cars/${name}.glb`))).then((gltfs) => {
    const perKind = kinds.map(() => 0)
    cars.forEach((_, i) => { perKind[i % kinds.length] = (perKind[i % kinds.length] ?? 0) + 1 })
    const meshes = gltfs.map((gltf, k) => {
      const parts: THREE.BufferGeometry[] = []
      let material: THREE.Material | null = null
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const g = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld)
          for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key)
          parts.push(g.index ? g.toNonIndexed() : g)
          material ??= o.material as THREE.Material
        }
      })
      const merged = mergeGeometries(parts)!
      merged.scale(CAR_SCALE, CAR_SCALE, CAR_SCALE)
      const mat = material as unknown as THREE.MeshStandardMaterial
      mat.roughness = 0.35
      mat.metalness = 0.4
      const mesh = new THREE.InstancedMesh(merged, mat, Math.max(1, perKind[k] ?? 1))
      mesh.castShadow = graphics === 'high'
      mesh.frustumCulled = false
      mesh.userData.ghost = true
      mesh.raycast = () => undefined
      scene.add(mesh)
      return mesh
    })
    const used = kinds.map(() => 0)
    slots = cars.map((_, i) => {
      const k = i % kinds.length
      return { mesh: meshes[k]!, index: used[k]!++ }
    })
    for (const m of [bodiesCar, cabins, wheels]) m.visible = false
  }).catch(() => { /* keep the box cars */ })

  // Signals at the four plaza stop lines.
  const signalMat = new THREE.MeshBasicMaterial({ color: 0x5fd27a, toneMapped: false })
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.6 })
  for (const arm of ARMS) {
    const px = arm.ax * lanes.inner + (arm.az !== 0 ? lanes.roadHalf + 0.4 : 0) * (arm.az > 0 ? -1 : 1)
    const pz = arm.az * lanes.inner + (arm.ax !== 0 ? lanes.roadHalf + 0.4 : 0) * (arm.ax > 0 ? 1 : -1)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 6), poleMat)
    pole.position.set(px, 1.3, pz)
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), signalMat)
    lamp.position.set(px, 2.7, pz)
    scene.add(pole, lamp)
  }

  const span = lanes.outer - lanes.inner
  const obstacles: Obstacle[] = []

  return {
    tick(dt, time, focus, people = []) {
      obstacles.length = 0
      const green = Math.floor(time / SIGNAL_PERIOD) % 2 === 0 // true: x arms go, false: z arms go
      signalMat.color.setHex(green ? 0x5fd27a : 0xffb347)

      walkers.forEach((w, i) => {
        w.t += (w.dir * w.speed * dt) / span
        if (w.t > 1 || w.t < 0) {
          w.dir *= -1
          w.t = THREE.MathUtils.clamp(w.t, 0, 1)
        }
        const arm = ARMS[w.arm] as Arm
        const along = lanes.inner + w.t * span
        const off = w.side * lanes.walk
        const x = arm.ax * along + (arm.az !== 0 ? off : 0)
        const z = arm.az * along + (arm.ax !== 0 ? off : 0)
        const far = Math.hypot(x - focus.x, z - focus.z) > LOD
        w.phase += dt * w.speed * 5
        const heading = Math.atan2(arm.ax * w.dir, arm.az * w.dir)
        const swing = Math.sin(w.phase) * 0.5
        dummy.position.set(x, far ? -50 : Math.abs(Math.cos(w.phase)) * 0.04, z)
        dummy.rotation.set(0, heading, 0)
        dummy.scale.setScalar(far ? 0.001 : 1)
        dummy.updateMatrix()
        bodies.setMatrixAt(i, dummy.matrix)
        heads.setMatrixAt(i, dummy.matrix)
        hairMeshes.forEach((m, k) => m.setMatrixAt(i, k === hairKind[i] ? dummy.matrix : zero))
        hoods.setMatrixAt(i, outfit[i] === 'hoodie' ? dummy.matrix : zero)
        skirts.setMatrixAt(i, outfit[i] === 'dress' ? dummy.matrix : zero)
        coats.setMatrixAt(i, outfit[i] === 'jacket' || outfit[i] === 'suit' ? dummy.matrix : zero)
        limbAt(legsL, i, -0.09, 0.86, swing)
        limbAt(legsR, i, 0.09, 0.86, -swing)
        limbAt(armsL, i, -0.25, 1.46, -swing * 0.8)
        limbAt(armsR, i, 0.25, 1.46, swing * 0.8)
      })
      for (const mesh of peopleMeshes) mesh.instanceMatrix.needsUpdate = true

      cars.forEach((car, i) => {
        const axisGo = car.arm < 2 ? green : !green
        // Inbound cars stop at the stop line on red, and for any car ahead in the same lane.
        let target = car.speed
        if (!car.outbound) {
          const gap = car.t * span
          if (!axisGo && gap < 6) target = gap < 0.6 ? 0 : Math.min(car.speed, gap)
        }
        for (const other of cars) {
          if (other === car || other.wait > 0 || other.arm !== car.arm || other.outbound !== car.outbound) continue
          const ahead = car.outbound ? other.t - car.t : car.t - other.t
          if (ahead > 0 && ahead * span < 9) target = Math.min(target, Math.max(0, (ahead * span - 6.2) * 2))
        }
        // Yield to the player and to anyone crossing in front.
        {
          const arm0 = ARMS[car.arm] as Arm
          const along0 = lanes.inner + car.t * span
          const lane0 = (car.outbound ? 1 : -1) * lanes.roadHalf * 0.5
          const cx = arm0.ax * along0 - arm0.az * lane0
          const cz = arm0.az * along0 + arm0.ax * lane0
          const d = car.outbound ? 1 : -1
          const blocked = (x: number, z: number) => {
            const fx = (x - cx) * arm0.ax * d + (z - cz) * arm0.az * d
            const sx = Math.abs((x - cx) * -arm0.az + (z - cz) * arm0.ax)
            return fx > 0 && fx < 5.5 && sx < 1.6
          }
          if (blocked(focus.x, focus.z) || people.some((o) => o.kind === 'circle' && blocked(o.x, o.z))) target = 0
        }
        const step = (target * dt) / span
        if (car.swing > 0) {
          const len = Math.abs(car.a1 - car.a0) * lanes.inner + 0.01
          car.swing += (Math.max(target, 3) * dt) / len
          if (car.swing >= 1) car.swing = 0
        } else if (car.turn > 0) {
          // U-turn in the turning bay at the arm end (never inside a building, never a lane jump).
          car.turn += (Math.max(target, 2.5) * dt) / (Math.PI * lanes.roadHalf * 0.5)
          if (car.turn >= 1) {
            car.turn = 0
            car.t = 1
            car.outbound = false
          }
        } else if (car.wait > 0) {
          // Parked in the bay at the arm end, resting; then pulls out and turns back.
          car.wait -= dt
          if (car.wait <= 0) { car.wait = 0; car.turn = 0.0001 }
        } else if (car.outbound) {
          car.t += step
          if (car.t >= 1) {
            car.t = 1
            // Some drivers park and rest at the destination, others turn straight back.
            if (Math.random() < 0.5) car.wait = 6 + Math.random() * 12
            else car.turn = 0.0001
          }
        } else {
          car.t -= step
          if (car.t <= 0) {
            // At the stop line on green: swing onto the next arm, heading out.
            car.t = 0
            if (axisGo) {
              // Only swing onto the next arm if its outbound lane is clear for a car length plus margin.
              const nextArm = (car.arm + 1 + (Math.random() < 0.5 ? 0 : 1)) % 4 // pick a destination: right or straight across
              const clear = cars.every((o) => o === car || o.arm !== nextArm || !o.outbound || o.t * span > 6.5)
              if (clear) {
                // Drive round the plaza ring to the next arm instead of jumping across it.
                const from = lanePoint(car.arm, 0, false)
                const to = lanePoint(nextArm, 0, true)
                car.a0 = Math.atan2(from.z, from.x)
                let a1 = Math.atan2(to.z, to.x)
                while (a1 - car.a0 > Math.PI) a1 -= Math.PI * 2
                while (a1 - car.a0 < -Math.PI) a1 += Math.PI * 2
                car.a1 = a1
                car.swing = 0.0001
                car.arm = nextArm
                car.outbound = true
              }
            }
          }
        }
        const arm = ARMS[car.arm] as Arm
        // Drive on the right: outbound lane is to the right of the outward direction.
        let pt = car.turn > 0 ? uturnPoint(car.arm, car.turn) : lanePoint(car.arm, car.t, car.outbound)
        if (car.swing > 0) {
          const a = car.a0 + (car.a1 - car.a0) * car.swing
          const r = Math.hypot(pt.x, pt.z) - 2.5 * Math.sin(Math.PI * car.swing)
          const sgn = Math.sign(car.a1 - car.a0) || 1
          pt = { x: Math.cos(a) * r, z: Math.sin(a) * r, heading: Math.atan2(-Math.sin(a) * sgn, Math.cos(a) * sgn) }
        }
        let x = pt.x
        let z = pt.z
        if (car.wait <= 0) car.park = 0
        if (car.wait > 0 && car.turn === 0 && car.swing === 0) {
          // Ease onto the shoulder while parked (right of travel), so through traffic can pass.
          car.park = Math.min(1, car.park + dt / 1.5)
          const off = 1.9 * Math.min(car.park, car.wait / 1.5)
          x += -Math.cos(pt.heading) * off
          z += Math.sin(pt.heading) * off
        }
        const dir = car.outbound ? 1 : -1
        // Cars are never hidden by distance (only ~10 instances): no popping at the arm-end entrances.
        const far = Math.hypot(x - focus.x, z - focus.z) > LOD + 20
        dummy.position.set(x, 0, z)
        dummy.rotation.set(0, pt.heading, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        if (slots) {
          const slot = slots[i]!
          slot.mesh.setMatrixAt(slot.index, dummy.matrix)
          slot.mesh.instanceMatrix.needsUpdate = true
        } else {
          bodiesCar.setMatrixAt(i, dummy.matrix)
          cabins.setMatrixAt(i, dummy.matrix)
          wheels.setMatrixAt(i, dummy.matrix)
        }
        heads2.setMatrixAt(i, lightOffset.multiplyMatrices(dummy.matrix, headLocal))
        roofSigns.setMatrixAt(i, lightOffset.multiplyMatrices(dummy.matrix, roofLocal))
        tails.setMatrixAt(i, lightOffset.multiplyMatrices(dummy.matrix, tailLocal))
        if (!far) {
          const hx = Math.sin(pt.heading)
          const hz = Math.cos(pt.heading)
          obstacles.push({ kind: 'circle', x: x + hx * 1.1, z: z + hz * 1.1, r: 1.05 })
          obstacles.push({ kind: 'circle', x: x - hx * 1.1, z: z - hz * 1.1, r: 1.05 })
        }
        void arm
        void dir
      })
      bodiesCar.instanceMatrix.needsUpdate = true
      cabins.instanceMatrix.needsUpdate = true
      wheels.instanceMatrix.needsUpdate = true
      heads2.instanceMatrix.needsUpdate = true
      tails.instanceMatrix.needsUpdate = true
      roofSigns.instanceMatrix.needsUpdate = true
      return obstacles
    },
  }
}

function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  for (const part of parts) {
    const geo = part.index ? part.toNonIndexed() : part
    positions.push(...(geo.getAttribute('position').array as Float32Array))
    normals.push(...(geo.getAttribute('normal').array as Float32Array))
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  return merged
}
