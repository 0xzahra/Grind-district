// People for the big halls (the Campus lecture hall, the conference centre), so they are never empty.
// A handful of real figures from the city's cast are posed once; each pose is then frozen into a plain mesh (the
// skin's bones baked into the vertices) and repeated across many seats with one instanced draw call per figure.
// A full hall of a hundred people costs about eight draw calls and no animation work. How many come depends on
// the Graphics setting (the caller passes `cap`); the rest of the seats stay empty.
import * as THREE from 'three'
import { posedHuman, type HumanModel, type Look } from './humans.ts'

export type CrowdSpot = { x: number; y?: number; z: number; yaw: number }
export type Cast = { model: HumanModel; look: Look; height?: number }

/** Freeze a posed skinned figure into a static geometry in its root's space (positions and normals). */
function bake(root: THREE.Object3D, mesh: THREE.SkinnedMesh): THREE.BufferGeometry {
  root.updateMatrixWorld(true)
  const src = mesh.geometry
  const pos = src.getAttribute('position'), nor = src.getAttribute('normal')
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld)
  const P = new Float32Array(pos.count * 3), N = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3(), q = new THREE.Vector3(), n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nor, i)
    // Skinning is linear per vertex, so a point a hair along the normal, skinned the same way, gives the normal.
    q.copy(p).addScaledVector(n, 0.01)
    mesh.applyBoneTransform(i, p).applyMatrix4(toRoot)
    mesh.applyBoneTransform(i, q).applyMatrix4(toRoot)
    n.subVectors(q, p).normalize()
    P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z
    N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(P, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3))
  const uv = src.getAttribute('uv')
  if (uv) out.setAttribute('uv', uv)
  const index = src.getIndex()
  if (index) out.setIndex(index)
  out.computeBoundingSphere()
  return out
}

const hash = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

/**
 * Seat `cap` people from `cast` on `spots` (room-local, yaw = the way they face) inside `group`. Spots earlier in
 * the list are filled first. `seatY` is the seat height the sitting pose is made for; `pose` 'stand' makes a
 * standing crowd instead. Figures arrive as their models load; nothing blocks.
 */
export function hallCrowd(group: THREE.Group, spots: CrowdSpot[], cast: Cast[], o: { cap: number; seatY?: number; pose?: 'sit' | 'stand' }): void {
  const take = spots.slice(0, Math.max(0, o.cap))
  if (!take.length || !cast.length) return
  // Neighbours wear different figures: step through the cast three at a time, shifting every lap.
  const byFigure: CrowdSpot[][] = cast.map(() => [])
  take.forEach((s, i) => byFigure[(i * 3 + Math.floor(i / cast.length)) % cast.length]!.push(s))
  const m4 = new THREE.Matrix4(), qy = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0)
  cast.forEach((c, k) => {
    const mine = byFigure[k]!
    if (!mine.length) return
    const root = posedHuman(c.model, {
      pose: o.pose ?? 'sit', seatY: o.seatY, look: c.look, height: c.height ?? (c.model.startsWith('woman') || c.model === 'abaya' ? 1.66 : 1.76), detail: 0.5,
      onReady: () => {
        const mesh = root.getObjectByName('Person') as THREE.SkinnedMesh | undefined
        if (!mesh?.isSkinnedMesh) return
        const im = new THREE.InstancedMesh(bake(root, mesh), mesh.material, mine.length)
        mine.forEach((s, i) => {
          const h = hash(k * 977 + i)
          // A little turn of the head-and-shoulders way and a little difference in build, so no two look cloned.
          qy.setFromAxisAngle(Y, s.yaw + (h - 0.5) * 0.24)
          const k2 = 0.96 + hash(k * 131 + i * 7) * 0.08
          im.setMatrixAt(i, m4.compose(v.set(s.x, s.y ?? 0, s.z), qy, sc.set(k2, k2, k2)))
        })
        im.computeBoundingSphere()
        im.castShadow = false
        im.receiveShadow = false
        im.userData.ghost = true
        im.raycast = () => undefined // taps and camera rays pass through the crowd (a hundred figures to test otherwise)
        im.name = 'hall-crowd'
        group.add(im)
      },
    })
  })
}

/** A standing figure (the lecturer, a speaker): one posed person, facing `yaw`. */
export function standing(group: THREE.Group, c: Cast, x: number, y: number, z: number, yaw: number): THREE.Group {
  const p = posedHuman(c.model, { pose: 'stand', look: c.look, height: c.height ?? (c.model.startsWith('woman') || c.model === 'abaya' ? 1.66 : 1.77) })
  p.position.set(x, y, z)
  p.rotation.y = yaw
  p.traverse((ob) => { ob.userData.ghost = true })
  group.add(p)
  return p
}

/** Campus students: everyday clothes, a kaftan and an abaya among them. */
export const STUDENTS: Cast[] = [
  { model: 'man1', look: { top: 0x2f5d8a, bottom: 0x23262a, skin: 0x5a3825, hair: 0x16110e } },
  { model: 'woman1', look: { top: 0xb8545a, bottom: 0x2b2f3a, skin: 0x8d5a3b, hair: 0x16110e } },
  { model: 'man2', look: { top: 0xe8e2d6, bottom: 0x3a4a5c, skin: 0x6f4329, hair: 0x0e0c0b } },
  { model: 'abaya', look: { top: 0x1f2633, skin: 0xc68a62 } },
  { model: 'woman2', look: { top: 0x2f7a58, bottom: 0x2b2f3a, skin: 0x4a2e20, hair: 0x0e0c0b } },
  { model: 'kurta', look: { top: 0xd9cbb0, skin: 0x5a3825 } },
  { model: 'man3', look: { top: 0x8a6a3a, bottom: 0x23262a, skin: 0xbf8a62, hair: 0x2a1d14 } },
  { model: 'woman3', look: { top: 0x6b4fa0, bottom: 0x23262a, skin: 0x6f4329, hair: 0x16110e } },
]

/** Conference attendees: smarter clothes, an agbada blue and suits. */
export const ATTENDEES: Cast[] = [
  { model: 'man4', look: { top: 0x2e3136, bottom: 0x2e3136, shoes: 0x1a1c1f, skin: 0x5a3825, hair: 0x0e0c0b } },
  { model: 'woman4', look: { top: 0x3a4f6b, bottom: 0x23262a, skin: 0x8d5a3b, hair: 0x16110e } },
  { model: 'man1', look: { top: 0xf2efe8, bottom: 0x1f2a3a, skin: 0x6f4329, hair: 0x16110e } },
  { model: 'woman2', look: { top: 0x8a2a3a, bottom: 0x1f2026, skin: 0x4a2e20, hair: 0x0e0c0b } },
  { model: 'kurta', look: { top: 0x2f3f5c, skin: 0x5a3825 } },
  { model: 'abaya', look: { top: 0x4a3a5c, skin: 0xc68a62 } },
  { model: 'man2', look: { top: 0x5a6a4a, bottom: 0x2b2d30, skin: 0xe0b08e, hair: 0x2a1d14 } },
  { model: 'woman1', look: { top: 0xd8c3a5, bottom: 0x2b2f3a, skin: 0xbf8a62, hair: 0x16110e } },
]
