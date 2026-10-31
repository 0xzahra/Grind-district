import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { blocked, type Obstacle } from './physics.ts'

// Street furniture (instanced benches, planters, bins), soft clouds, birds, café steam and dust motes.
// All instanced / a handful of draw calls so mid-range Android keeps its frame rate.
export function createAmbient(scene: THREE.Scene, obstacles: Obstacle[], lite: boolean) {
  const dummy = new THREE.Object3D()
  const spots: { x: number; z: number; rot: number }[] = []
  for (const axis of [0, 1]) for (const sign of [-1, 1]) for (const side of [-1, 1]) {
    for (let t = 19; t < 58; t += 7.5) {
      const along = sign * t
      const off = side * 5.3
      const x = axis ? off : along
      const z = axis ? along : off
      if (blocked(obstacles, x, z, 1.4)) continue
      spots.push({ x, z, rot: axis ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0 })
    }
  }
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.75 })
  const iron = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.7 })
  const benchGeo = mergeGeometries([
    new THREE.BoxGeometry(1.6, 0.06, 0.42).translate(0, 0.46, 0),
    new THREE.BoxGeometry(1.6, 0.36, 0.05).translate(0, 0.72, -0.2),
  ])!
  const benchLegs = mergeGeometries([-0.7, 0.7].map((x) => new THREE.BoxGeometry(0.06, 0.46, 0.4).translate(x, 0.23, 0)))!
  const planterGeo = new THREE.BoxGeometry(0.9, 0.55, 0.9).translate(0, 0.275, 0)
  const bushGeo = new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.85, 0)
  const binGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.8, 12).translate(0, 0.4, 0)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xbdb3a2, roughness: 0.95 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 0.85, flatShading: true })
  const n = spots.length
  const benches = new THREE.InstancedMesh(benchGeo, wood, n)
  const legs = new THREE.InstancedMesh(benchLegs, iron, n)
  const planters = new THREE.InstancedMesh(planterGeo, stoneMat, n)
  const bushes = new THREE.InstancedMesh(bushGeo, leafMat, n)
  const bins = new THREE.InstancedMesh(binGeo, iron, n)
  spots.forEach((s, i) => {
    const fx = Math.cos(s.rot)
    const fz = -Math.sin(s.rot)
    dummy.rotation.set(0, s.rot, 0)
    dummy.position.set(s.x, 0, s.z)
    dummy.updateMatrix()
    benches.setMatrixAt(i, dummy.matrix)
    legs.setMatrixAt(i, dummy.matrix)
    dummy.position.set(s.x + fx * 1.4, 0, s.z + fz * 1.4)
    dummy.updateMatrix()
    planters.setMatrixAt(i, dummy.matrix)
    bushes.setMatrixAt(i, dummy.matrix)
    dummy.position.set(s.x - fx * 1.2, 0, s.z - fz * 1.2)
    dummy.updateMatrix()
    bins.setMatrixAt(i, dummy.matrix)
    obstacles.push({ kind: 'box', x: s.x, z: s.z, hx: Math.abs(fx) * 0.8 + Math.abs(fz) * 0.25, hz: Math.abs(fz) * 0.8 + Math.abs(fx) * 0.25 })
    obstacles.push({ kind: 'circle', x: s.x + fx * 1.4, z: s.z + fz * 1.4, r: 0.55 })
  })
  for (const m of [benches, legs, planters, bushes, bins]) {
    m.castShadow = !lite
    m.receiveShadow = true
    m.computeBoundingSphere()
    scene.add(m)
  }

  // Soft clouds: a few big billboards high up, drifting.
  const cloudTex = (() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')!
    for (let i = 0; i < 14; i++) {
      const x = 40 + Math.random() * 176
      const y = 50 + Math.random() * 40
      const r = 22 + Math.random() * 30
      const grad = g.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, 'rgba(255,255,255,0.55)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 256, 128)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.8 })
  const clouds: THREE.Sprite[] = []
  for (let i = 0; i < (lite ? 5 : 9); i++) {
    const s = new THREE.Sprite(cloudMat)
    const a = (i / 9) * Math.PI * 2
    s.position.set(Math.cos(a) * 120, 60 + (i % 3) * 8, Math.sin(a) * 120)
    s.scale.set(90, 40, 1)
    s.renderOrder = -1
    s.raycast = () => undefined
    s.userData.ghost = true
    clouds.push(s)
    scene.add(s)
  }

  // Birds: tiny flapping chevrons circling over the plaza.
  const birdGeo = mergeGeometries([
    new THREE.BoxGeometry(0.5, 0.03, 0.12).translate(0.25, 0, 0).rotateZ(0.3),
    new THREE.BoxGeometry(0.5, 0.03, 0.12).translate(-0.25, 0, 0).rotateZ(-0.3),
  ])!
  const birdCount = lite ? 6 : 14
  const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshBasicMaterial({ color: 0x2a2622 }), birdCount)
  birds.frustumCulled = false
  scene.add(birds)

  // Café steam and floating dust: point sprites.
  const puffTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,0.7)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  })()
  const vents = [{ x: 28, z: -12.5 }, { x: -16, z: -50 }, { x: 31, z: -16 }]
  const steamN = lite ? 18 : 36
  const steamPos = new Float32Array(steamN * 3)
  const steamGeo = new THREE.BufferGeometry()
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3))
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ map: puffTex, size: 0.9, transparent: true, depthWrite: false, opacity: 0.35, color: 0xf4efe6 }))
  steam.frustumCulled = false
  scene.add(steam)
  const dustN = lite ? 40 : 120
  const dustPos = new Float32Array(dustN * 3)
  for (let i = 0; i < dustN; i++) dustPos.set([(Math.random() - 0.5) * 30, Math.random() * 5, (Math.random() - 0.5) * 30], i * 3)
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: puffTex, size: 0.07, transparent: true, depthWrite: false, opacity: 0.5, color: 0xffe9c4 }))
  dust.frustumCulled = false
  scene.add(dust)

  return {
    /** Street bench seats (seat-top height, facing away from the backrest) for the sitting system. */
    benchSeats: spots.map((s) => ({ x: s.x, z: s.z, yaw: s.rot, y: 0.49 })),
    tick(time: number, focus: THREE.Vector3, night: number) {
      for (const [i, c] of clouds.entries()) {
        const a = (i / clouds.length) * Math.PI * 2 + time * 0.004
        c.position.set(focus.x + Math.cos(a) * 120, c.position.y, focus.z + Math.sin(a) * 120)
      }
      cloudMat.opacity = 0.8 - night * 0.55
      for (let i = 0; i < birdCount; i++) {
        const a = time * 0.25 + (i / birdCount) * Math.PI * 2
        const r = 14 + (i % 4) * 3
        dummy.position.set(Math.cos(a) * r, 18 + (i % 3) * 2 + Math.sin(time + i) * 0.6, Math.sin(a) * r)
        dummy.rotation.set(0, -a, 0)
        dummy.scale.set(1, 1 + Math.sin(time * 9 + i) * 0.8, 1)
        dummy.updateMatrix()
        birds.setMatrixAt(i, dummy.matrix)
      }
      birds.instanceMatrix.needsUpdate = true
      birds.visible = night < 0.6
      for (let i = 0; i < steamN; i++) {
        const v = vents[i % vents.length]!
        const t = (time * 0.35 + i * 0.137) % 1
        steamPos[i * 3] = v.x + Math.sin(i * 7.1 + time) * 0.25 * t
        steamPos[i * 3 + 1] = 2.6 + t * 2.6
        steamPos[i * 3 + 2] = v.z + Math.cos(i * 3.3 + time) * 0.25 * t
      }
      steamGeo.attributes.position!.needsUpdate = true
      dust.position.set(focus.x, 0, focus.z)
      dust.rotation.y = time * 0.02
    },
  }
}
