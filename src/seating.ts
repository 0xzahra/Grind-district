import * as THREE from 'three'

// Sitting: a seat is a spot on the floor plan, the direction the sitter faces, and the seat-top height.
// The Quaternius pack only ships Idle/Walk/Run, so the sit pose is layered on the rig after the mixer runs:
// thighs forward, shins down, hands on the lap, and the body lowered until the hips rest on the seat.
export type Seat = { x: number; z: number; yaw: number; y: number; pose?: 'sit' | 'lie' | 'workout' }
export type SeatSpot = { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; use: () => void }

type Bones = { person: THREE.Object3D; hips: THREE.Object3D; legs: THREE.Object3D[]; knees: THREE.Object3D[]; arms: THREE.Object3D[]; fores: THREE.Object3D[]; hipDrop: number }

const axis = new THREE.Vector3()
const qParent = new THREE.Quaternion()
const qDelta = new THREE.Quaternion()
const qPerson = new THREE.Quaternion()
const v = new THREE.Vector3()

/** Turn a bone about the sitter's own left-right axis by `angle`, whatever the bone's local frame is. */
function bend(bone: THREE.Object3D, angle: number) {
  if (!bone.parent) return
  bone.parent.getWorldQuaternion(qParent)
  qDelta.setFromAxisAngle(axis, angle)
  // local delta = parent^-1 * worldDelta * parent
  const inv = qParent.clone().invert()
  bone.quaternion.premultiply(inv.multiply(qDelta).multiply(qParent))
  bone.updateMatrixWorld(true)
}

function findBones(root: THREE.Object3D): Bones | null {
  const person = root.userData.person as THREE.Object3D | undefined
  if (!person) return null
  if (person.userData.sitBones) return person.userData.sitBones as Bones
  const by = (re: RegExp) => { let hit: THREE.Object3D | null = null; person.traverse((o) => { if (!hit && (o as THREE.Bone).isBone && re.test(o.name)) hit = o }); return hit as THREE.Object3D | null }
  const hips = by(/^Hips$/i)
  const legL = by(/^UpperLeg\.?L$/i), legR = by(/^UpperLeg\.?R$/i)
  const kneeL = by(/^LowerLeg\.?L$/i), kneeR = by(/^LowerLeg\.?R$/i)
  const armL = by(/^UpperArm\.?L$/i), armR = by(/^UpperArm\.?R$/i)
  const foreL = by(/^LowerArm\.?L$/i), foreR = by(/^LowerArm\.?R$/i)
  if (!hips || !legL || !legR || !kneeL || !kneeR) return null
  person.updateMatrixWorld(true)
  // Standing hip height above the feet, and thigh length: sitting drops the hips by about one thigh.
  const hipY = legL.getWorldPosition(v).y
  const kneeY = kneeL.getWorldPosition(new THREE.Vector3()).y
  const rootY = root.getWorldPosition(new THREE.Vector3()).y
  const bones: Bones = { person, hips, legs: [legL, legR], knees: [kneeL, kneeR], arms: [armL, armR].filter(Boolean) as THREE.Object3D[], fores: [foreL, foreR].filter(Boolean) as THREE.Object3D[], hipDrop: hipY - rootY }
  void kneeY
  person.userData.sitBones = bones
  return bones
}

export function createSeating() {
  let seat: Seat | null = null
  let blend = 0
  let rootYaw0 = 0
  let lastRoot: THREE.Object3D | null = null
  let lastPose: Seat['pose'] = 'sit'
  return {
    get sitting() { return seat },
    sit(next: Seat, root: THREE.Object3D) {
      if (seat && Math.hypot(seat.x - next.x, seat.z - next.z) < 0.05) { this.stand(); return }
      if (!seat) rootYaw0 = root.rotation.y
      seat = next
      lastRoot = root
    },
    stand() {
      if (!seat) return
      seat = null
      if (lastRoot) lastRoot.rotation.y = rootYaw0
    },
    /** Call after avatar.step() each frame. Cheap: a handful of quaternion multiplies while seated, nothing otherwise. */
    apply(root: THREE.Object3D, dt: number) {
      blend += ((seat ? 1 : 0) - blend) * (1 - Math.exp(-12 * dt))
      if (blend < 0.002 && !seat) { blend = 0; const b0 = root.userData.person as THREE.Object3D | undefined; if (b0 && (b0.position.y !== 0 || b0.rotation.x !== 0)) { b0.position.y = 0; b0.rotation.x = 0 } return }
      const b = findBones(root)
      if (!b) return
      if (seat) {
        if (lastRoot !== root) { lastRoot = root; rootYaw0 = root.rotation.y }
        root.rotation.y = seat.yaw - b.person.rotation.y
      }
      root.updateMatrixWorld(true)
      b.person.getWorldQuaternion(qPerson)
      axis.set(1, 0, 0).applyQuaternion(qPerson).normalize()
      const t = blend
      const pose = seat?.pose ?? lastPose
      if (seat) lastPose = seat.pose ?? 'sit'
      if (pose === 'lie') {
        // Lie back on the bed: tip the whole person onto its back at mattress height, arms relaxed.
        b.person.rotation.x = -Math.PI / 2 * t
        b.person.position.y = ((seat?.y ?? 0.5) + 0.12) * t / (root.scale.y || 1)
        for (const a of b.arms) bend(a, -0.15 * t)
        return
      }
      if (b.person.rotation.x !== 0) b.person.rotation.x = 0
      if (pose === 'workout') {
        // Squat loop with arms forward: a simple procedural workout on top of the idle clip.
        const k = (Math.sin(performance.now() / 1000 * 3.2) + 1) / 2 * t
        for (const l of b.legs) bend(l, -1.0 * k)
        for (const kn of b.knees) bend(kn, 1.7 * k)
        for (const a of b.arms) bend(a, -1.45 * t)
        b.person.position.y = -0.32 * k / (root.scale.y || 1)
        return
      }
      for (const l of b.legs) bend(l, -1.45 * t)
      for (const k of b.knees) bend(k, 1.5 * t)
      for (const a of b.arms) bend(a, -0.45 * t)
      for (const f of b.fores) bend(f, -0.75 * t)
      // Rest the hips on the seat top (scaled person: work in world units then convert).
      const seatY = seat?.y ?? 0.46
      const drop = Math.max(0, b.hipDrop - (seatY + 0.06))
      b.person.position.y = -drop * t / (root.scale.y || 1)
    },
  }
}

/** A hotspot for one seat. `sit` is wired by the caller to move the player there. */
export function seatSpot(id: string, title: string, s: Seat, sit: (s: Seat) => void, r = 0.75): SeatSpot {
  return { id, x: s.x, z: s.z, r, title, body: 'Take a seat. Move to stand up.', enter: 'Sit', use: () => sit(s) }
}

/** Plaza benches (built in world.ts on a 6.6 m ring, backs toward the outside). */
export function plazaSeats(): Seat[] {
  const out: Seat[] = []
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const x = Math.cos(angle) * 6.6, z = Math.sin(angle) * 6.6
    const yaw = Math.atan2(-x, -z)
    out.push({ x: x + Math.sin(yaw) * 0.08, z: z + Math.cos(yaw) * 0.08, yaw, y: 0.51 })
  }
  return out
}

/** Outdoor workout spots: park lawn by the basin and the forecourt beside the gym. */
export function workoutSpots(): Seat[] {
  return [{ x: -32.5, z: 47.5, yaw: Math.PI, y: 0, pose: 'workout' }, { x: -33.8, z: 46.2, yaw: Math.PI, y: 0, pose: 'workout' }, { x: -15.4, z: -18.6, yaw: Math.PI / 2, y: 0, pose: 'workout' }]
}
