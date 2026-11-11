import * as THREE from 'three'

// Sitting: a seat is a spot on the floor plan, the direction the sitter faces, and the seat-top height.
// The sit pose is layered on the rig after the mixer runs (it works from any standing clip):
// thighs forward, shins down, hands on the lap, and the body lowered until the hips rest on the seat.
export type Seat = { x: number; z: number; yaw: number; y: number; pose?: 'sit' | 'lie' | 'workout' }
export type SeatSpot = { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; use: () => void }

type Bones = { person: THREE.Object3D; hips: THREE.Object3D; legs: THREE.Object3D[]; knees: THREE.Object3D[]; feet: THREE.Object3D[]; arms: THREE.Object3D[]; fores: THREE.Object3D[]; hands: THREE.Object3D[]; hipDrop: number }

const axis = new THREE.Vector3()
const qParent = new THREE.Quaternion()
const qDelta = new THREE.Quaternion()
const qPerson = new THREE.Quaternion()
const v = new THREE.Vector3()
const vFrom = new THREE.Vector3(), vTo = new THREE.Vector3(), vWant = new THREE.Vector3(), vFwd = new THREE.Vector3()
const qIdentity = new THREE.Quaternion()

/** Swing `bone` so the segment to `child` points along `want` (world), by the fraction `t`. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, want: THREE.Vector3, t: number) {
  if (!bone.parent) return
  bone.getWorldPosition(vFrom); child.getWorldPosition(vTo)
  vTo.sub(vFrom).normalize()
  qDelta.setFromUnitVectors(vTo, want)
  if (t < 1) qDelta.slerpQuaternions(qIdentity, qDelta.clone(), t)
  bone.parent.getWorldQuaternion(qParent)
  const inv = qParent.clone().invert()
  bone.quaternion.premultiply(inv.multiply(qDelta).multiply(qParent))
  bone.updateMatrixWorld(true)
}

function findBones(root: THREE.Object3D): Bones | null {
  const person = root.userData.person as THREE.Object3D | undefined
  if (!person) return null
  if (person.userData.sitBones) return person.userData.sitBones as Bones
  const by = (re: RegExp) => { let hit: THREE.Object3D | null = null; person.traverse((o) => { if (!hit && (o as THREE.Bone).isBone && re.test(o.name)) hit = o }); return hit as THREE.Object3D | null }
  const hips = by(/^Bip01_Pelvis$/)
  const legL = by(/^Bip01_L_Thigh$/), legR = by(/^Bip01_R_Thigh$/)
  const kneeL = by(/^Bip01_L_Calf$/), kneeR = by(/^Bip01_R_Calf$/)
  const footL = by(/^Bip01_L_Foot$/), footR = by(/^Bip01_R_Foot$/)
  const armL = by(/^Bip01_L_UpperArm$/), armR = by(/^Bip01_R_UpperArm$/)
  const foreL = by(/^Bip01_L_Forearm$/), foreR = by(/^Bip01_R_Forearm$/)
  const handL = by(/^Bip01_L_Hand$/), handR = by(/^Bip01_R_Hand$/)
  if (!hips || !legL || !legR || !kneeL || !kneeR || !footL || !footR) return null
  person.updateMatrixWorld(true)
  // Standing hip height above the feet, and thigh length: sitting drops the hips by about one thigh.
  const hipY = legL.getWorldPosition(v).y
  const kneeY = kneeL.getWorldPosition(new THREE.Vector3()).y
  const rootY = root.getWorldPosition(new THREE.Vector3()).y
  const bones: Bones = { person, hips, legs: [legL, legR], knees: [kneeL, kneeR], feet: [footL, footR], arms: [armL, armR].filter(Boolean) as THREE.Object3D[], fores: [foreL, foreR].filter(Boolean) as THREE.Object3D[], hands: [handL, handR].filter(Boolean) as THREE.Object3D[], hipDrop: hipY - rootY }
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
      // Every limb is AIMED at a direction in the sitter's own frame (never bent by an amount), so the pose is
      // the same whatever clip is playing and cannot pile up on frames where a far figure's animation is skipped.
      vFwd.set(0, 0, 1).applyQuaternion(qPerson).normalize()
      const want = (r: number, u: number, f: number) => vWant.set(0, u, 0).addScaledVector(axis, r).addScaledVector(vFwd, f).normalize()
      const sideOf = (bone: THREE.Object3D) => Math.sign(bone.getWorldPosition(vFrom).sub(b.hips.getWorldPosition(vTo)).dot(axis)) || 1
      if (pose === 'lie') {
        // Lie back on the bed: tip the whole person onto its back at mattress height.
        b.person.rotation.x = -Math.PI / 2 * t
        b.person.position.y = ((seat?.y ?? 0.5) + 0.12) * t / (root.scale.y || 1)
        return
      }
      if (b.person.rotation.x !== 0) b.person.rotation.x = 0
      if (pose === 'workout') {
        // Squat loop with the arms held forward.
        const k = (Math.sin(performance.now() / 1000 * 3.2) + 1) / 2 * t
        for (let i = 0; i < 2; i++) {
          const side = sideOf(b.legs[i]!)
          aim(b.legs[i]!, b.knees[i]!, want(side * 0.08, -Math.cos(1.0 * k), Math.sin(1.0 * k)), 1)
          aim(b.knees[i]!, b.feet[i]!, want(side * 0.02, -Math.cos(0.7 * k), -Math.sin(0.7 * k)), 1)
        }
        for (let i = 0; i < b.arms.length; i++) {
          const fore = b.fores[i], hand = b.hands[i]
          if (!fore || !hand) continue
          const side = sideOf(b.arms[i]!)
          aim(b.arms[i]!, fore, want(side * 0.12, -Math.cos(1.45 * t), Math.sin(1.45 * t)), 1)
          aim(fore, hand, want(side * 0.04, -Math.cos(1.5 * t), Math.sin(1.5 * t)), 1)
        }
        b.person.position.y = -0.32 * k / (root.scale.y || 1)
        return
      }
      // Sit: thighs level along the seat, shins straight down from its front edge, feet flat.
      for (let i = 0; i < 2; i++) {
        const side = sideOf(b.legs[i]!)
        aim(b.legs[i]!, b.knees[i]!, want(side * 0.07, -0.05, 1), t)
        aim(b.knees[i]!, b.feet[i]!, want(side * 0.02, -1, 0.04), t)
      }
      // Arms: elbows by the sides, forearms forward and a little inward, so each hand lies on its own thigh
      // (mid-thigh, or nearer the knee on the other variant).
      const variant = Math.abs(Math.round((seat?.x ?? 0) * 3) + Math.round((seat?.z ?? 0) * 5) + Math.round((seat?.yaw ?? 0) * 7)) % 2
      for (let i = 0; i < b.arms.length; i++) {
        const arm = b.arms[i]!, fore = b.fores[i], hand = b.hands[i]
        if (!fore || !hand) continue
        const side = sideOf(arm)
        aim(arm, fore, variant === 0 ? want(side * 0.1, -0.97, 0.16) : want(side * 0.08, -0.93, 0.3), t)
        aim(fore, hand, variant === 0 ? want(-side * 0.3, -0.62, 0.72) : want(-side * 0.26, -0.5, 0.82), t)
      }
      // Rest the hips on the seat top: the thigh's own thickness keeps it above the boards.
      const seatY = seat?.y ?? 0.46
      const drop = Math.max(0, b.hipDrop - (seatY + 0.09))
      b.person.position.y = -drop * t / (root.scale.y || 1)
    },
  }
}

/** A hotspot for one seat. `sit` is wired by the caller to move the player there. */
export function seatSpot(id: string, title: string, s: Seat, sit: (s: Seat) => void, r = 1.6): SeatSpot {
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
