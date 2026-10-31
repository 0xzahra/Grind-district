// Natural, calm human faces in the faceted reference style (01M68QTRTTP3N7XWASY1XZ8AE6.jpg).
// Every feature is placed on the actual head surface (raycast), so proportions stay human:
// eyes at mid-head, brows just above, ears at eye level, small nose and lips.
import * as THREE from 'three'

export type FaceOpts = {
  head: THREE.Mesh // the faceted head mesh (already positioned in `bob`)
  female: boolean
  skin: THREE.Material
  hair: THREE.MeshStandardMaterial
  lip: number
  iris: number
  eyeY?: number // offset of eye line from head centre (default 0)
  hairLength?: 'short' | 'long'
}

const sharedWhite = new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.55, flatShading: true, envMapIntensity: 0.2 })
const sharedPupil = new THREE.MeshStandardMaterial({ color: 0x0f0d0c, roughness: 0.4, envMapIntensity: 0 })
const lashMat = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.6 })

export function buildFace(bob: THREE.Group, o: FaceOpts): void {
  const { head } = o
  let top: THREE.Object3D = bob
  while (top.parent) top = top.parent
  top.updateMatrixWorld(true)
  const c = head.position.clone()
  head.geometry.computeBoundingBox()
  const box = head.geometry.boundingBox!
  const hw = (box.max.x - box.min.x) / 2
  const hh = (box.max.y - box.min.y) / 2
  // Surface z (in bob space) at a given x,y offset from the head centre.
  const ray = new THREE.Raycaster()
  const inv = new THREE.Matrix4().copy(bob.matrixWorld).invert()
  const surf = (dx: number, dy: number) => {
    const from = new THREE.Vector3(c.x + dx, c.y + dy, c.z + 1).applyMatrix4(bob.matrixWorld)
    const dir = new THREE.Vector3(0, 0, -1).transformDirection(bob.matrixWorld)
    ray.set(from, dir)
    const hit = ray.intersectObject(head, false)[0]
    return hit ? hit.point.applyMatrix4(inv).z : c.z + 0.12
  }
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, shadow = false) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = shadow
    bob.add(m)
    return m
  }
  const f = o.female
  const eyeY = c.y + (o.eyeY ?? 0)
  const eyeX = hw * 0.36
  const irisMat = new THREE.MeshStandardMaterial({ color: o.iris, roughness: 0.35, envMapIntensity: 0.3 })
  const lipMat = new THREE.MeshStandardMaterial({ color: o.lip, roughness: 0.45, flatShading: true })
  const browMat = o.hair

  for (const s of [-1, 1]) {
    const x = s * eyeX
    const z = surf(x, eyeY - c.y)
    // Almond eye: flattened white, iris, pupil, then a skin lid on top for a calm, relaxed gaze.
    const white = add(new THREE.SphereGeometry(0.021, 10, 6), sharedWhite, x, eyeY, z - 0.008)
    white.scale.set(f ? 1.2 : 1.1, f ? 0.62 : 0.55, 0.55)
    add(new THREE.CircleGeometry(f ? 0.0105 : 0.0095, 12), irisMat, x, eyeY - 0.001, z + 0.0035)
    add(new THREE.CircleGeometry(0.0045, 10), sharedPupil, x, eyeY - 0.001, z + 0.0040)
    const lid = add(new THREE.BoxGeometry(0.05, 0.008, 0.014), o.skin, x, eyeY + 0.012, z - 0.001)
    lid.rotation.x = -0.3
    if (f) {
      const lash = add(new THREE.BoxGeometry(0.05, 0.0045, 0.008), lashMat, x + s * 0.003, eyeY + 0.0125, z + 0.003)
      lash.rotation.z = s * -0.12
      const wing = add(new THREE.BoxGeometry(0.012, 0.003, 0.006), lashMat, x + s * 0.027, eyeY + 0.014, z - 0.002)
      wing.rotation.z = s * 0.5
    }
    // Brows: thin, slightly arched, sit just above the eye.
    const by = eyeY + (f ? 0.036 : 0.032)
    const brow = add(new THREE.BoxGeometry(f ? 0.048 : 0.056, f ? 0.006 : 0.009, 0.01), browMat, x + s * 0.004, by, surf(x, by - c.y) + 0.002)
    brow.rotation.z = s * (f ? 0.12 : 0.04)
    // Ears at eye level.
    const ear = add(new THREE.IcosahedronGeometry(0.03, 0), o.skin, s * (hw * 0.98), eyeY - 0.012, c.z - 0.01)
    ear.scale.set(0.42, f ? 0.95 : 1.15, 0.75)
  }

  // Nose: bridge between the eyes down to a small faceted tip with soft wings.
  const tipY = eyeY - hh * (f ? 0.32 : 0.36)
  const bridgeTop = eyeY + 0.006
  const bridgeLen = bridgeTop - tipY
  const bz = surf(0, (bridgeTop + tipY) / 2 - c.y)
  const bridge = add(new THREE.BoxGeometry(f ? 0.014 : 0.018, bridgeLen, 0.02), o.skin, 0, (bridgeTop + tipY) / 2, bz + 0.002)
  bridge.rotation.x = -0.18
  const tz = surf(0, tipY - c.y)
  const tip = add(new THREE.IcosahedronGeometry(f ? 0.015 : 0.018, 0), o.skin, 0, tipY, tz + 0.012)
  tip.scale.set(1.15, 0.85, 0.9)
  for (const s of [-1, 1]) {
    const wing = add(new THREE.IcosahedronGeometry(0.01, 0), o.skin, s * 0.014, tipY - 0.004, tz + 0.004)
    wing.scale.set(1, 0.8, 0.8)
  }

  // Lips: small and calm; fuller for women.
  const mouthY = tipY - hh * (f ? 0.2 : 0.21)
  const mz = surf(0, mouthY - c.y)
  const upper = add(new THREE.IcosahedronGeometry(0.02, 0), lipMat, 0, mouthY + 0.005, mz + 0.002)
  upper.scale.set(f ? 1.45 : 1.3, f ? 0.32 : 0.22, 0.45)
  const lower = add(new THREE.IcosahedronGeometry(0.02, 0), lipMat, 0, mouthY - 0.006, mz + 0.001)
  lower.scale.set(f ? 1.25 : 1.1, f ? 0.42 : 0.28, 0.45)

  // Hair cap: covers the crown, sides and the whole back of the head (no bald backs).
  const capR = Math.max(hw, hh) * 1.07
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), o.hair)
  cap.scale.set(hw / Math.max(hw, hh) * 1.02, hh / Math.max(hw, hh) * 1.0, 1.04)
  cap.position.set(c.x, c.y + hh * 0.06, c.z - 0.012)
  cap.rotation.x = -0.62 // open side faces forward-down: forehead free, back covered to the nape
  cap.castShadow = true
  bob.add(cap)
  if (o.hairLength === 'long') {
    // Long hair falls behind the shoulders, plus side curtains framing the face.
    const back = add(new THREE.CylinderGeometry(hw * 0.95, hw * 1.15, hh * 2.2, 10, 1, true, Math.PI * 0.62, Math.PI * 0.76), o.hair, c.x, c.y - hh * 0.95, c.z - 0.005, true)
    back.material = o.hair
    ;(back.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
    for (const s of [-1, 1]) {
      const side = add(new THREE.BoxGeometry(0.035, hh * 1.5, 0.09), o.hair, s * hw * 0.98, c.y - hh * 0.35, c.z + 0.015)
      side.rotation.z = s * 0.06
    }
  }
}
