import * as THREE from 'three'
import { foliageMaterial, shrubGeometry } from './trees.ts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { blocked, type Obstacle } from './physics.ts'

// Street furniture (instanced benches, planters, bins), a small flock of birds, café steam and dust motes.
// All instanced / a handful of draw calls so mid-range Android keeps its frame rate.
export function createAmbient(scene: THREE.Scene, obstacles: Obstacle[], lite: boolean) {
  const dummy = new THREE.Object3D()
  const spots: { x: number; z: number; rot: number }[] = []
  for (const axis of [0, 1]) for (const sign of [-1, 1]) for (const side of [-1, 1]) {
    for (let t = 24; t < 58; t += 7.5) {
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
  const bushGeo = shrubGeometry(9).scale(0.56, 0.5, 0.56).translate(0, 0.88, 0)
  const binGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.8, 12).translate(0, 0.4, 0)
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xbdb3a2, roughness: 0.95 })
  const leafMat = foliageMaterial()
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

  // Clouds live in the sky shader (sky.ts); the old drifting billboard cards are gone.

  // Birds: real low-poly birds (body, head, beak, fanned tail and two hinged wings), a small flock that wheels
  // over the plaza, flapping in bursts and gliding between them. Three instanced draw calls.
  // (They used to be two flat plates each, which read as sheets of paper drifting about.)
  const birdMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.85, flatShading: true })
  const bodyGeo = mergeGeometries([
    new THREE.OctahedronGeometry(0.16, 0).scale(0.7, 0.62, 2.0),
    new THREE.OctahedronGeometry(0.09, 0).translate(0, 0.05, 0.3),
    new THREE.ConeGeometry(0.03, 0.12, 4).rotateX(Math.PI / 2).translate(0, 0.04, 0.44),
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.26), new THREE.Vector3(-0.13, 0, -0.52), new THREE.Vector3(0.13, 0, -0.52)]),
  ].map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); if (!n.getAttribute('normal')) n.computeVertexNormals(); return n }))!
  // One wing: a tapered, swept blade hinged at the shoulder (x = 0), pointing along +x.
  const wingGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0.14), new THREE.Vector3(0.34, 0, 0.1), new THREE.Vector3(0, 0, -0.12),
    new THREE.Vector3(0.34, 0, 0.1), new THREE.Vector3(0.36, 0, -0.1), new THREE.Vector3(0, 0, -0.12),
    new THREE.Vector3(0.34, 0, 0.1), new THREE.Vector3(0.72, 0, -0.16), new THREE.Vector3(0.36, 0, -0.1),
  ])
  wingGeo.computeVertexNormals()
  birdMat.side = THREE.DoubleSide
  const birdCount = lite ? 5 : 9
  const birds = new THREE.InstancedMesh(bodyGeo, birdMat, birdCount)
  const wingsL = new THREE.InstancedMesh(wingGeo, birdMat, birdCount)
  const wingsR = new THREE.InstancedMesh(wingGeo, birdMat, birdCount)
  for (const m of [birds, wingsL, wingsR]) { m.frustumCulled = false; m.userData.ghost = true; m.raycast = () => undefined; scene.add(m) }
  const wing = new THREE.Object3D()
  const flip = new THREE.Matrix4().makeScale(-1, 1, 1)

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
      for (let i = 0; i < birdCount; i++) {
        // Two loose groups wheel in opposite directions at different heights.
        const dir = i % 2 ? 1 : -1
        const a = dir * time * (0.16 + (i % 3) * 0.02) + (i / birdCount) * Math.PI * 2
        const r = 16 + (i % 4) * 3.5 + Math.sin(time * 0.21 + i) * 2
        const y = 15 + (i % 3) * 2.5 + Math.sin(time * 0.5 + i * 1.7) * 0.8
        dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r)
        // Face along the tangent of the circle and bank into the turn.
        dummy.rotation.set(0, -a + (dir > 0 ? Math.PI : 0), 0)
        dummy.rotateZ(-dir * 0.28)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        birds.setMatrixAt(i, dummy.matrix)
        // Flap for a few beats, then glide with the wings held slightly up.
        const beat = (Math.sin(time * 0.7 + i * 2.3) + 1) / 2
        const flap = beat > 0.45 ? Math.sin(time * 9 + i) * 0.75 : 0.18
        wing.position.set(0.05, 0.03, 0.02)
        wing.rotation.set(0, 0, flap)
        wing.updateMatrix()
        wingsL.setMatrixAt(i, wing.matrix.premultiply(dummy.matrix))
        wing.updateMatrix()
        wingsR.setMatrixAt(i, wing.matrix.premultiply(flip).premultiply(dummy.matrix))
      }
      birds.instanceMatrix.needsUpdate = wingsL.instanceMatrix.needsUpdate = wingsR.instanceMatrix.needsUpdate = true
      birds.visible = wingsL.visible = wingsR.visible = night < 0.6
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
