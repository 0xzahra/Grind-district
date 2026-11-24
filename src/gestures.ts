// Body language for a speaking figure (Zahra, the Campus mentor). Driven by WHEN she speaks, not by what sounds
// she makes, so it works the same in English, Hausa, Yoruba or any other language (no phoneme or viseme tables):
// while a line plays her head nods with the rhythm of speech and her right hand comes up in an open, explaining
// gesture; when the line ends she gives a small nod; a greeting is a wave; showing something is a point.
// The arm is aimed along directions in the figure's own frame (the same way her standing pose is made), so it reads
// the same whatever way the skeleton's bones happen to be built. Nothing new is drawn (no extra draw calls), and
// the standing pose comes back exactly when she stops.
// (NVIDIA Audio2Face-3D, which drives a face from the audio itself, runs on a GPU server; this is the in-browser part.)
import * as THREE from 'three'
import { aim } from './humans.ts'

export type Gesture = 'wave' | 'nod' | 'point'
export type Gesturer = { tick: (dt: number) => void; play: (g: Gesture) => void }

type Rig = { head: THREE.Object3D; neck: THREE.Object3D | null; upper: THREE.Object3D; fore: THREE.Object3D; hand: THREE.Object3D; side: number }

/** Attach talk gestures to a posed figure. `who` is the voice name speech.ts announces (gd:voice). */
export function talkGestures(figure: THREE.Object3D, who: string): Gesturer {
  let rig: Rig | null = null
  const base = new Map<THREE.Object3D, THREE.Quaternion>()
  let talking = false, talk = 0, t = 0, nodT = -1, waveT = -1, pointT = -1, rested = true
  const right = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
  const qFig = new THREE.Quaternion(), qPar = new THREE.Quaternion(), qAx = new THREE.Quaternion(), qYaw = new THREE.Quaternion(), qInv = new THREE.Quaternion()
  const tU = new THREE.Quaternion(), tF = new THREE.Quaternion(), dU = new THREE.Vector3(), dF = new THREE.Vector3()
  const find = (): Rig | null => {
    const get = (n: string) => figure.getObjectByName(n) ?? null
    const head = get('Bip01_Head'), upper = get('Bip01_R_UpperArm'), fore = get('Bip01_R_Forearm'), hand = get('Bip01_R_Hand'), hips = get('Bip01_Pelvis')
    if (!head || !upper || !fore || !hand || !hips) return null
    const neck = get('Bip01_Neck')
    for (const o of [head, neck, upper, fore]) if (o) base.set(o, o.quaternion.clone())
    figure.updateMatrixWorld(true)
    figure.getWorldQuaternion(qFig)
    right.set(1, 0, 0).applyQuaternion(qFig)
    const at = upper.getWorldPosition(new THREE.Vector3()).sub(hips.getWorldPosition(new THREE.Vector3()))
    return { head, neck, upper, fore, hand, side: Math.sign(at.dot(right)) || 1 }
  }
  window.addEventListener('gd:voice', (e) => {
    const d = (e as CustomEvent<{ who: string; on: boolean }>).detail
    if (!d || d.who !== who) return
    if (talking && !d.on) nodT = 0 // a small nod to close the line
    talking = d.on
  })
  /** Turn a bone from its pose about a world axis (the figure's right = nod, up = look aside). */
  const turn = (o: THREE.Object3D | null, pitch: number, yaw: number) => {
    if (!o) return
    const b0 = base.get(o); if (!b0) return
    o.quaternion.copy(b0)
    if (Math.abs(pitch) + Math.abs(yaw) < 1e-4) return
    o.parent!.getWorldQuaternion(qPar)
    qAx.setFromAxisAngle(right, pitch).premultiply(qYaw.setFromAxisAngle(up, yaw))
    // local' = parent^-1 * turn * parent * local
    o.quaternion.premultiply(qInv.copy(qPar).invert().multiply(qAx).multiply(qPar))
  }
  /** A direction in the figure's frame: r to her side of the gesturing arm, u up, f forward. */
  const dir = (out: THREE.Vector3, r: number, u: number, f: number) => out.set(0, 0, 0).addScaledVector(right, r * rig!.side).addScaledVector(up, u).addScaledVector(fwd, f).normalize()
  return {
    play(g) { if (g === 'wave') waveT = 0; else if (g === 'point') pointT = 0; else nodT = 0 },
    tick(dt) {
      if (!rig) { rig = find(); if (!rig) return }
      if (!figure.visible) return
      t += dt
      talk += ((talking ? 1 : 0) - talk) * Math.min(1, dt * 4)
      const busy = talk > 0.01 || nodT >= 0 || waveT >= 0 || pointT >= 0
      if (!busy) {
        if (!rested) { for (const [o, q] of base) o.quaternion.copy(q); rested = true }
        return
      }
      rested = false
      figure.getWorldQuaternion(qFig)
      right.set(1, 0, 0).applyQuaternion(qFig); fwd.set(0, 0, 1).applyQuaternion(qFig)
      // Head: two layered nods with the rhythm of speech (syllable-ish and phrase-ish) and a slow look aside.
      let pitch = talk * (0.06 * Math.sin(t * 5.3) + 0.05 * Math.max(0, Math.sin(t * 1.7)))
      const yaw = talk * 0.09 * Math.sin(t * 0.9)
      if (nodT >= 0) { nodT += dt; pitch += 0.22 * Math.sin(Math.min(1, nodT / 0.7) * Math.PI); if (nodT > 0.7) nodT = -1 }
      turn(rig.neck, pitch * 0.4, yaw * 0.4)
      turn(rig.head, pitch * 0.6, yaw * 0.6)
      // Arm: pick what it is doing and how far it is into it (0 = her standing pose, 1 = the full gesture).
      let w = 0
      if (waveT >= 0) {
        waveT += dt
        w = Math.min(1, waveT / 0.35, (2.2 - waveT) / 0.45)
        dir(dU, 0.85, 0.35, 0.3)
        dir(dF, 0.3 + 0.42 * Math.sin(waveT * 10), 0.95, 0.1) // hand up, waving side to side
        if (waveT > 2.2) waveT = -1
      } else if (pointT >= 0) {
        pointT += dt
        w = Math.min(1, pointT / 0.4, (2 - pointT) / 0.5)
        dir(dU, 0.45, 0.1, 0.9)
        dir(dF, 0.4, 0.22, 0.9) // arm out, showing the way
        if (pointT > 2) pointT = -1
      } else if (talk > 0.01) {
        w = talk * 0.9
        dir(dU, 0.2, -0.85, 0.48)
        dir(dF, 0.3 + 0.12 * Math.sin(t * 2.1), 0.2 + 0.14 * Math.sin(t * 3.4 + 1), 0.93) // open hand, explaining
      }
      const bU = base.get(rig.upper)!, bF = base.get(rig.fore)!
      rig.upper.quaternion.copy(bU); rig.fore.quaternion.copy(bF)
      if (w > 0.001) {
        aim(rig.upper, rig.fore, dU); tU.copy(rig.upper.quaternion)
        aim(rig.fore, rig.hand, dF); tF.copy(rig.fore.quaternion)
        rig.upper.quaternion.slerpQuaternions(bU, tU, w)
        rig.fore.quaternion.slerpQuaternions(bF, tF, w)
      }
    },
  }
}
