// Skinned garments built in a rigged person's bind space: a skirt, and an abaya (a loose, straight robe from
// the shoulders to the ankles with wide sleeves) with a hijab that covers the hair, head and neck.
// Each garment is one low-poly, flat-shaded mesh bound to the same skeleton as the body, so it moves with it.
import * as THREE from 'three'

export type Frame = {
  up: THREE.Vector3
  right: THREE.Vector3
  fwd: THREE.Vector3
  /** Midpoint between the hip joints. */
  mid: THREE.Vector3
  /** Half the distance between the hip joints. */
  half: number
  /** Hip joints down to the ground. */
  leg: number
  /** Bind units per metre (from the body's height). */
  unit: number
  bone: (name: string) => number
  at: (name: string) => THREE.Vector3 | null
}

/** Measure the rig in the skinned mesh's own (bind) space. Null if the bones we need are missing. */
export function rigFrame(mesh: THREE.SkinnedMesh): Frame | null {
  const bones = mesh.skeleton.bones
  const bone = (n: string) => bones.findIndex((b) => b.name === n)
  // A bone's origin in bind space. Uses the constant bind matrix (bindMatrixInverse follows the live world matrix).
  const m = new THREE.Matrix4(), unbind = new THREE.Matrix4().copy(mesh.bindMatrix).invert()
  const at = (n: string) => { const i = bone(n); return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(m.copy(mesh.skeleton.boneInverses[i]!).invert().premultiply(unbind)) }
  const hipL = at('UpperLegL'), hipR = at('UpperLegR'), head = at('Head')
  if (!hipL || !hipR || !head || bone('Hips') < 0 || bone('LowerLegL') < 0 || bone('LowerLegR') < 0) return null
  const mid = hipL.clone().add(hipR).multiplyScalar(0.5)
  const up = head.clone().sub(mid).normalize()
  const right = hipL.clone().sub(hipR)
  const half = right.length() / 2
  right.addScaledVector(up, -right.dot(up)).normalize()
  const fwd = right.clone().cross(up).normalize()
  const pos = mesh.geometry.getAttribute('position')
  const v = new THREE.Vector3()
  let low = 0, high = 0
  for (let i = 0; i < pos.count; i++) { const h = v.fromBufferAttribute(pos, i).sub(mid).dot(up); low = Math.min(low, h); high = Math.max(high, h) }
  return { up, right, fwd, mid, half, leg: -low, unit: (high - low) / 1.7, bone, at }
}

type W = Array<[number, number]>
class Cloth {
  private P: number[] = []
  private SI: number[] = []
  private SW: number[] = []
  private C: number[] = []
  private idx: number[] = []
  private n = 0
  vert(p: THREE.Vector3, w: W, shade: number): number {
    this.P.push(p.x, p.y, p.z)
    const list = w.filter(([i, x]) => i >= 0 && x > 0).slice(0, 4)
    const sum = list.reduce((a, [, x]) => a + x, 0) || 1
    for (let k = 0; k < 4; k++) { this.SI.push(list[k]?.[0] ?? 0); this.SW.push((list[k]?.[1] ?? 0) / sum) }
    this.C.push(shade, shade, shade)
    return this.n++
  }
  /** An ellipse of `seg` vertices round `centre`, spanned by axes u and v. `w` gets the angle's cosine (u side). */
  ring(centre: THREE.Vector3, u: THREE.Vector3, ru: number, v: THREE.Vector3, rv: number, seg: number, w: (cos: number, sin: number) => W, shade: number): number[] {
    const out: number[] = []
    const p = new THREE.Vector3()
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a)
      out.push(this.vert(p.copy(centre).addScaledVector(u, c * ru).addScaledVector(v, s * rv), w(c, s), shade))
    }
    return out
  }
  /** Join two closed rings of equal length; `skip(k)` leaves a hole at segment k. */
  strip(a: number[], b: number[], skip?: (k: number) => boolean): void {
    const n = a.length
    for (let k = 0; k < n; k++) {
      if (skip?.(k)) continue
      const k1 = (k + 1) % n
      this.idx.push(a[k]!, b[k]!, a[k1]!, a[k1]!, b[k]!, b[k1]!)
    }
  }
  fan(apex: number, ring: number[]): void {
    for (let k = 0; k < ring.length; k++) this.idx.push(apex, ring[k]!, ring[(k + 1) % ring.length]!)
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3))
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4))
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3))
    g.setIndex(this.idx)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
}

const side = (c: number) => THREE.MathUtils.smoothstep(c, -0.55, 0.55)

/** Waist-to-hem skirt. `hem` is how far down the leg it reaches (0.96 = ankle, 0.72 = mid-calf). */
export function skirtGeometry(f: Frame, hem = 0.72): THREE.BufferGeometry {
  const hips = f.bone('Hips'), uL = f.bone('UpperLegL'), uR = f.bone('UpperLegR'), lL = f.bone('LowerLegL'), lR = f.bone('LowerLegR')
  const cloth = new Cloth()
  const at = (h: number) => f.mid.clone().addScaledVector(f.up, h)
  const row = (h: number, rx: number, rz: number, wH: number, wU: number, wL: number) =>
    cloth.ring(at(h), f.right, rx * f.half, f.fwd, rz * f.half, 12, (c) => { const l = side(c); return wL > 0 ? [[hips, wH], [lL, wL * l], [lR, wL * (1 - l)]] : [[hips, wH], [uL, wU * l], [uR, wU * (1 - l)]] }, 1)
  const rows = [
    row(0.17 * f.leg, 1.7, 1.35, 1, 0, 0),
    row(-0.06 * f.leg, 2.15, 1.85, 0.7, 0.3, 0),
    row(-0.5 * f.leg, 2.35, 2.2, 0.35, 0.65, 0),
    row(-hem * f.leg, 2.55, 2.5, 0.3, 0, 0.7),
  ]
  for (let r = 0; r < rows.length - 1; r++) cloth.strip(rows[r]!, rows[r + 1]!)
  return cloth.build()
}

/**
 * Abaya with hijab. The robe hangs straight and loose from the shoulders to the ankles (no waist, a little
 * wider at the hem), the sleeves are wide tubes down to the wrists, and the hijab wraps the head and neck and
 * drapes over the shoulders, leaving only the face open. `head` is the bounding box of the head's skin
 * vertices in (right, up, fwd) coordinates relative to `f.mid`.
 */
export function abayaGeometry(f: Frame, head: THREE.Box3): THREE.BufferGeometry | null {
  const shL = f.at('UpperArmL'), shR = f.at('UpperArmR'), neck = f.at('Neck')
  if (!shL || !shR || !neck) return null
  const hips = f.bone('Hips'), abd = f.bone('Abdomen'), torso = f.bone('Torso'), headB = f.bone('Head')
  const uL = f.bone('UpperLegL'), uR = f.bone('UpperLegR'), lL = f.bone('LowerLegL'), lR = f.bone('LowerLegR')
  if (torso < 0 || headB < 0) return null
  const rel = (p: THREE.Vector3) => p.clone().sub(f.mid)
  const shMid = rel(shL).add(rel(shR)).multiplyScalar(0.5)
  const S = shL.distanceTo(shR) / 2 // shoulder half-span
  const hs = shMid.dot(f.up) // shoulder height above the hips
  const sf = shMid.dot(f.fwd) // how far the shoulders sit in front of the hips
  const hn = rel(neck).dot(f.up)
  const cloth = new Cloth()
  const ROBE = 0.93, VEIL = 1
  const centre = (h: number, lean: number) => f.mid.clone().addScaledVector(f.up, h).addScaledVector(f.fwd, sf * lean)
  const SEG = 12
  // Robe: collar, shoulders, chest, waist, hips, knees, hem. Straight sides, a gentle widening to the hem.
  const rows = [
    cloth.ring(centre(hn + 0.02 * f.leg, 1), f.right, 0.4 * S, f.fwd, 0.42 * S, SEG, () => [[torso, 1]], ROBE),
    cloth.ring(centre(hs + 0.015 * f.leg, 1), f.right, 1.1 * S, f.fwd, 0.74 * S, SEG, () => [[torso, 1]], ROBE),
    cloth.ring(centre(hs * 0.72, 0.85), f.right, 1.12 * S, f.fwd, 0.9 * S, SEG, () => [[torso, 0.7], [abd, 0.3]], ROBE),
    cloth.ring(centre(hs * 0.36, 0.5), f.right, 1.12 * S, f.fwd, 0.92 * S, SEG, () => [[abd, 0.6], [hips, 0.4]], ROBE),
    cloth.ring(centre(-0.06 * f.leg, 0.15), f.right, 1.16 * S, f.fwd, 0.98 * S, SEG, (c) => { const l = side(c); return [[hips, 0.8], [uL, 0.2 * l], [uR, 0.2 * (1 - l)]] }, ROBE),
    cloth.ring(centre(-0.5 * f.leg, 0), f.right, 1.24 * S, f.fwd, 1.1 * S, SEG, (c) => { const l = side(c); return [[hips, 0.45], [uL, 0.55 * l], [uR, 0.55 * (1 - l)]] }, ROBE),
    cloth.ring(centre(-0.955 * f.leg, 0), f.right, 1.34 * S, f.fwd, 1.24 * S, SEG, (c) => { const l = side(c); return [[hips, 0.38], [lL, 0.62 * l], [lR, 0.62 * (1 - l)]] }, ROBE),
  ]
  for (let r = 0; r < rows.length - 1; r++) cloth.strip(rows[r]!, rows[r + 1]!)
  // Sleeves: wide tubes from inside the shoulder to the wrist, flaring at the cuff.
  for (const s of ['L', 'R']) {
    const p0 = f.at(`UpperArm${s}`), p1 = f.at(`LowerArm${s}`), p2 = f.at(`Palm${s}`)
    const upper = f.bone(`UpperArm${s}`), lower = f.bone(`LowerArm${s}`)
    if (!p0 || !p1 || !p2 || upper < 0 || lower < 0) continue
    const dir = p2.clone().sub(p0).normalize()
    const u = f.up.clone().addScaledVector(dir, -f.up.dot(dir)).normalize()
    const v = dir.clone().cross(u).normalize()
    const m = f.unit
    // Five rings (shoulder, mid upper arm, elbow, mid forearm, cuff) so the sleeve bends smoothly with the arm
    // instead of pinching and stretching at the elbow and shoulder when walking. The shoulder ring blends a little
    // into the torso so it does not swing out of the robe; the elbow is roomier so the arm never pokes through.
    const mid = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().lerp(b, 0.5)
    const r0 = cloth.ring(p0.clone().addScaledVector(dir, -0.03 * m), u, 0.105 * m, v, 0.105 * m, 8, () => [[upper, 0.8], [torso, 0.2]], ROBE)
    const r1 = cloth.ring(mid(p0, p1), u, 0.1 * m, v, 0.1 * m, 8, () => [[upper, 1]], ROBE)
    const r2 = cloth.ring(p1.clone(), u, 0.11 * m, v, 0.11 * m, 8, () => [[upper, 0.5], [lower, 0.5]], ROBE)
    const r3 = cloth.ring(mid(p1, p2), u, 0.112 * m, v, 0.108 * m, 8, () => [[lower, 1]], ROBE)
    const r4 = cloth.ring(p2.clone().addScaledVector(dir, -0.02 * m), u, 0.125 * m, v, 0.115 * m, 8, () => [[lower, 1]], ROBE)
    cloth.strip(r0, r1)
    cloth.strip(r1, r2)
    cloth.strip(r2, r3)
    cloth.strip(r3, r4)
  }
  // Hijab: a close cap round the head with an oval opening for the face, then a drape over neck and shoulders.
  const size = head.getSize(new THREE.Vector3()), c0 = head.getCenter(new THREE.Vector3())
  const hc = f.mid.clone().addScaledVector(f.right, c0.x).addScaledVector(f.up, c0.y + size.y * 0.03).addScaledVector(f.fwd, c0.z - size.z * 0.05)
  const ax = (size.x / 2) * 1.2, ay = (size.y / 2) * 1.14, az = (size.z / 2) * 1.2
  const HS = 16, LAT = 6
  const top = cloth.vert(hc.clone().addScaledVector(f.up, ay), [[headB, 1]], VEIL)
  const lat: number[][] = []
  for (let j = 1; j < LAT; j++) {
    const th = (j / LAT) * Math.PI
    lat.push(cloth.ring(hc.clone().addScaledVector(f.up, ay * Math.cos(th)), f.right, ax * Math.sin(th), f.fwd, az * Math.sin(th), HS, () => [[headB, 1]], VEIL))
  }
  cloth.fan(top, lat[0]!)
  for (let j = 0; j < lat.length - 1; j++) {
    // Polar angle at this band's middle; the face opening runs from the brow to under the chin, 90 degrees wide.
    const cosMid = Math.cos(((j + 1.5) / LAT) * Math.PI)
    cloth.strip(lat[j]!, lat[j + 1]!, (k) => cosMid < 0.42 && cosMid > -0.75 && Math.sin(((k + 0.5) / HS) * Math.PI * 2) > 0.8)
  }
  const drape1 = cloth.ring(centre(hs + 0.03 * f.leg, 1), f.right, 0.86 * S, f.fwd, 0.72 * S, HS, () => [[torso, 0.8], [headB, 0.2]], VEIL)
  const drape2 = cloth.ring(centre(hs * 0.8, 0.9), f.right, 1.0 * S, f.fwd, 0.9 * S, HS, () => [[torso, 1]], VEIL)
  cloth.strip(lat[lat.length - 1]!, drape1)
  cloth.strip(drape1, drape2)
  return cloth.build()
}
