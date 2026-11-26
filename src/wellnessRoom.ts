// Inside the Wellness house (a room built by interiors.ts on the first visit): a reception desk by the door and
// three rooms off the hall, each with its people and its tools. The salon: two styling chairs at lit mirrors with
// stylists at work, a hood dryer, a wash basin and a shelf of products. The counselling room: two armchairs, a low
// table with tissues and water, a lamp, books and a plant, a counsellor listening. The clinic: a treatment bed under
// a magnifier lamp with an aesthetician, a dental chair with its light and tray, a cabinet. Walk up to a room to
// open its menu (places.ts). Boxes are batched per material, so the whole house is a few dozen draws.
import * as THREE from 'three'
import { boxes, type Floor, type HallCtx } from './halls.ts'
import { hallCrowd, standing, type CrowdSpot } from './hallCrowd.ts'
import { houseplantGeometry, houseplantMaterial } from './trees.ts'
import { placeGoods, TINTS, type Placed } from './groceries.ts'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { getSave } from './state.ts'
import { liteOn } from './deviceTier.ts'

type B = [number, number, number, number, number, number, number?]
export type WellnessRoom = 'salon' | 'therapy' | 'clinic'

export function buildWellness(c: HallCtx, h: { open: (room: WellnessRoom) => void }): Floor {
  const M = {
    oak: c.std(0xb98a5a, 0.6), white: c.std(0xf6f3ee, 0.5), cream: c.std(0xe9dfcf, 0.8), sage: c.std(0x8fa98a, 0.85), blush: c.std(0xd9a3a0, 0.85),
    chrome: c.std(0xc9d0d4, 0.25, 0.85), black: c.std(0x23262a, 0.4, 0.3), leather: c.std(0x2e3a36, 0.55), teal: c.std(0x2a7a72, 0.6), glass: c.std(0xcfe6ee, 0.05, 0.3),
  }
  const glow = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1cf, emissiveIntensity: 1.1, roughness: 0.4 })
  const lists: Record<keyof typeof M, B[]> = { oak: [], white: [], cream: [], sage: [], blush: [], chrome: [], black: [], leather: [], teal: [], glass: [] }
  const put = (k: keyof typeof M, x: number, y: number, z: number, w: number, hgt: number, d: number, ry = 0) => lists[k].push([x, y, z, w, hgt, d, ry])
  const block = (x: number, z: number, hx: number, hz: number) => c.obstacles.push({ kind: 'box', x: c.ox + x, z: c.oz + z, hx, hz })
  const roundBlock = (x: number, z: number, r: number) => c.obstacles.push({ kind: 'circle', x: c.ox + x, z: c.oz + z, r })
  const goods: Placed[] = []

  // ---- the hall: reception by the door, a bench, a rug down the middle, three signs over the rooms
  put('oak', -5.6, 0, -4.6, 2.6, 1.05, 0.7); put('white', -5.6, 1.05, -4.6, 2.7, 0.05, 0.8); block(-5.6, -4.6, 1.35, 0.4)
  standing(c.group, { model: 'woman2', look: { top: 0x2a7a72, bottom: 0x23262a, skin: 0x8d5a3b, hair: 0x16110e } }, -5.6, 0, -5.4, 0)
  put('sage', -5.6, 0, 4.9, 2.4, 0.45, 0.6); put('sage', -5.6, 0.45, 5.15, 2.4, 0.5, 0.12); block(-5.6, 4.9, 1.2, 0.3)
  hallCrowd(c.group, [{ x: -6.2, z: 4.85, yaw: Math.PI }, { x: -5.0, z: 4.85, yaw: Math.PI }], [{ model: 'abaya', look: { top: 0x4a3a5c, skin: 0xc68a62 } }, { model: 'man1', look: { top: 0xf2efe8, bottom: 0x1f2a3a, skin: 0x6f4329, hair: 0x16110e } }], { cap: 2, seatY: 0.45, pose: 'sit' })
  const rug = c.add(new THREE.PlaneGeometry(9, 2.2), c.std(0xcbb79a, 0.95), -2.5, 0.015, 0, false); rug.rotation.x = -Math.PI / 2; rug.castShadow = false
  // partitions: the three rooms sit along the back (east) half, split by panelled walls with open doorways
  for (const z of [-2.4, 2.4]) { put('cream', 4.75, 0, z, 8.5, 2.6, 0.12); block(4.75, z, 4.25, 0.1) }
  // front walls of the side rooms, each with a doorway nearest the hall
  for (const s of [-1, 1]) { put('cream', 0.5, 0, s * 4.7, 0.12, 2.6, 4.6); block(0.5, s * 4.7, 0.08, 2.3) }
  // the counselling room's front: a wall with a door gap, for some quiet
  put('cream', 0.5, 0, -1.6, 0.12, 2.6, 1.6); put('cream', 0.5, 0, 1.6, 0.12, 2.6, 1.6); block(0.5, -1.6, 0.08, 0.8); block(0.5, 1.6, 0.08, 0.8)
  const label = (text: string, sub: string, x: number, z: number, ry: number) => {
    const t = c.canvasTex(512, 160, (g) => {
      g.fillStyle = '#f6f3ee'; g.fillRect(0, 0, 512, 160); g.fillStyle = '#2a7a72'; g.fillRect(0, 140, 512, 20)
      g.fillStyle = '#23262a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 58px "Inter Variable", Inter, sans-serif'; g.fillText(text, 256, 62, 480)
      g.fillStyle = '#5a6a66'; g.font = '600 28px "Inter Variable", Inter, sans-serif'; g.fillText(sub, 256, 112, 480)
    })
    const m = c.add(new THREE.PlaneGeometry(1.8, 0.56), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), x, 2.25, z, false, ry); m.castShadow = false
  }
  label('Salon', 'hair · nails · shave', 0.42, -4.7, -Math.PI / 2)
  label('Counselling', 'a quiet room to talk', 0.42, 0, -Math.PI / 2)
  label('Clinic', 'skin · teeth', 0.42, 4.7, -Math.PI / 2)

  // ---- the salon (north): two styling stations at lit mirrors, a hood dryer, a basin, products
  // One long mirror over both stations: a real reflection on Medium and High (rendered at a modest size),
  // a painted one on Low and in Light mode, where a second view of the room each frame costs too much.
  {
    const mw = 4.3, mh = 1.35, mx = 3.9, my = 1.72, mz = -6.79
    put('chrome', mx, my - mh / 2 - 0.04, mz - 0.01, mw + 0.1, mh + 0.08, 0.03)
    if (!liteOn() && getSave().graphics !== 'low') {
      const r = new Reflector(new THREE.PlaneGeometry(mw, mh), { textureWidth: 640, textureHeight: 200, color: 0xc8d2d6, clipBias: 0.003 })
      r.position.set(mx, my, mz + 0.012)
      r.userData.ghost = true
      c.group.add(r)
    } else {
      const fake = c.canvasTex(512, 160, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#e9eef0'); gr.addColorStop(1, '#c9d1d4'); g.fillStyle = gr; g.fillRect(0, 0, 512, 160)
        g.fillStyle = 'rgba(46,58,54,0.55)'; for (const x of [130, 370]) { g.fillRect(x - 34, 70, 68, 90); g.fillRect(x - 40, 60, 80, 16) } // the chairs, reflected
        g.fillStyle = 'rgba(185,138,90,0.45)'; g.fillRect(0, 128, 512, 32) // the floor
        g.fillStyle = 'rgba(255,255,255,0.35)'; for (const x of [60, 300]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 46, 0); g.lineTo(x - 30, 160); g.lineTo(x - 76, 160); g.fill() }
      })
      const m = c.add(new THREE.PlaneGeometry(mw, mh), new THREE.MeshStandardMaterial({ map: fake, roughness: 0.15, metalness: 0.3 }), mx, my, mz + 0.012, false); m.castShadow = false
    }
  }
  for (const x of [2.6, 5.2]) {
    const z = -6.75
    put('white', x, 0.8, z + 0.15, 1.6, 0.06, 0.4); put('oak', x, 0, z + 0.15, 1.6, 0.8, 0.38) // counter
    put('white', x, 2.4, z, 1.2, 0.08, 0.06) // light bar over the mirror
    const bar = c.add(new THREE.BoxGeometry(1.0, 0.05, 0.03), glow, x, 2.37, z + 0.05, false); bar.castShadow = false
    // the styling chair: chrome base, leather seat and back, facing the mirror
    c.add(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 18), M.chrome, x, 0.03, z + 1.35, false)
    c.add(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 10), M.chrome, x, 0.22, z + 1.35, false)
    put('leather', x, 0.4, z + 1.35, 0.6, 0.12, 0.55); put('leather', x, 0.52, z + 1.62, 0.58, 0.7, 0.1)
    roundBlock(x, z + 1.35, 0.4)
    // the products on the counter
    for (let k = 0; k < 4; k++) goods.push({ p: k % 2 ? 'jar' : 'bottle', x: x - 0.55 + k * 0.12, y: 0.86, z: z + 0.2, tint: TINTS[k + 1], s: 0.8 })
  }
  // clients in the chairs, stylists behind them at work
  hallCrowd(c.group, [{ x: 2.6, z: -5.42, yaw: Math.PI }, { x: 5.2, z: -5.42, yaw: Math.PI }], [{ model: 'woman1', look: { top: 0xd8c3a5, bottom: 0x2b2f3a, skin: 0x8d5a3b, hair: 0x16110e } }, { model: 'man2', look: { top: 0x5a6a4a, bottom: 0x2b2d30, skin: 0x5a3825, hair: 0x0e0c0b } }], { cap: 2, seatY: 0.46, pose: 'sit' })
  const cape = { top: 0x1d1d1f, bottom: 0x1d1d1f, shoes: 0x111111 }
  standing(c.group, { model: 'woman3', look: { ...cape, skin: 0x6f4329, hair: 0x16110e } }, 2.1, 0, -4.55, Math.PI * 0.85)
  standing(c.group, { model: 'man3', look: { ...cape, skin: 0x4a2e20, hair: 0x0e0c0b } }, 5.75, 0, -4.6, -Math.PI * 0.85)
  // hood dryer on a chair by the back wall
  put('leather', 8.0, 0.42, -4.2, 0.6, 0.1, 0.6); put('leather', 8.32, 0.52, -4.2, 0.1, 0.6, 0.6); put('chrome', 8.0, 0, -4.2, 0.08, 0.42, 0.08)
  const hood = c.add(new THREE.SphereGeometry(0.32, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.white, 8.05, 1.45, -4.2, false); hood.rotation.z = 0.5
  c.add(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), M.chrome, 8.35, 0.7, -4.6, false)
  block(8.0, -4.2, 0.4, 0.4)
  // the wash basin: a black bowl on a cabinet, a chair tipped back in front
  put('black', 8.4, 0, -6.6, 1.0, 0.85, 0.6); c.add(new THREE.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.black, 8.4, 0.95, -6.55, false)
  c.add(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), M.chrome, 8.4, 1.05, -6.85, false)
  block(8.4, -6.6, 0.5, 0.35)
  // product wall: shelves of bottles and jars
  for (const y of [1.0, 1.4, 1.8]) { put('oak', 0.95, y, -6.85, 0.9, 0.04, 0.25); for (let k = 0; k < 6; k++) goods.push({ p: k % 3 ? 'bottle' : 'jar', x: 0.62 + k * 0.13, y: y + 0.04, z: -6.85, tint: TINTS[(k + 2) % TINTS.length], s: 0.75 }) }

  // ---- the counselling room (middle): armchairs face each other over a low table, a lamp, books, a plant
  const rug2 = c.add(new THREE.CircleGeometry(1.6, 28), c.std(0xb7a48a, 0.95), 5.2, 0.016, 0, false); rug2.rotation.x = -Math.PI / 2; rug2.castShadow = false
  const armchair = (x: number, z: number, face: 1 | -1, k: keyof typeof M) => {
    put(k, x, 0, z, 0.85, 0.42, 0.85); put(k, x - face * 0.36, 0.42, z, 0.14, 0.55, 0.85) // seat and back
    for (const s of [-1, 1]) put(k, x, 0.42, z + s * 0.38, 0.85, 0.22, 0.12) // arms
    roundBlock(x, z, 0.5)
  }
  armchair(3.6, 0, 1, 'sage'); armchair(6.9, 0, -1, 'blush')
  put('oak', 5.25, 0, 0, 0.9, 0.42, 0.6); block(5.25, 0, 0.45, 0.3)
  c.add(new THREE.BoxGeometry(0.22, 0.1, 0.12), M.white, 5.05, 0.47, -0.12, false) // tissues
  c.add(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10), M.glass, 5.45, 0.48, 0.12, false) // a glass of water
  hallCrowd(c.group, [{ x: 3.62, z: 0, yaw: Math.PI / 2 }, { x: 6.88, z: 0, yaw: -Math.PI / 2 }], [{ model: 'man1', look: { top: 0x2f5d8a, bottom: 0x23262a, skin: 0x5a3825, hair: 0x16110e } }, { model: 'woman4', look: { top: 0x3a4f6b, bottom: 0x23262a, skin: 0x4a2e20, hair: 0x16110e } }], { cap: 2, seatY: 0.44, pose: 'sit' })
  // floor lamp and a bookcase on the back wall
  c.add(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), M.black, 8.3, 0.75, 1.7, false)
  c.add(new THREE.CylinderGeometry(0.16, 0.24, 0.26, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3e6c8, emissive: 0xffe2a8, emissiveIntensity: 0.45, side: THREE.DoubleSide }), 8.3, 1.55, 1.7, false)
  put('oak', 8.75, 0, -1.2, 0.35, 1.9, 1.6); block(8.75, -1.2, 0.2, 0.8)
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.26, 0.05), c.std(0xffffff, 0.8), 36)
  const bm = new THREE.Matrix4(), bc = new THREE.Color(), bcol = [0x8a3a3a, 0x2f5d8a, 0x3a6a4a, 0xc9a25e, 0x5a4a6a, 0xd8d0c0]
  for (let i = 0; i < 36; i++) { const row = Math.floor(i / 12), k = i % 12; books.setMatrixAt(i, bm.makeTranslation(8.62, 0.45 + row * 0.55, -1.9 + k * 0.115)); books.setColorAt(i, bc.setHex(bcol[(i * 5) % bcol.length]!)) }
  books.castShadow = true; c.group.add(books)
  const plant = c.add(houseplantGeometry(7, 1.1, 0.55, true, 1.2), houseplantMaterial(), 8.4, 0.32, 1.95, false); plant.castShadow = true
  c.add(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 14), M.white, 8.4, 0.17, 1.95, false)

  // ---- the clinic (south): a treatment bed under a magnifier lamp, a dental chair with its light, a cabinet
  put('white', 3.2, 0, 5.6, 0.8, 0.62, 1.9); put('teal', 3.2, 0.62, 5.6, 0.82, 0.1, 1.92); put('teal', 3.2, 0.72, 6.35, 0.8, 0.22, 0.4)
  block(3.2, 5.6, 0.45, 1.0)
  c.add(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), M.chrome, 2.4, 0.85, 6.4, false)
  const arm = c.add(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8), M.chrome, 2.75, 1.65, 6.0, false); arm.rotation.z = Math.PI / 2.6
  const ring = c.add(new THREE.TorusGeometry(0.14, 0.03, 8, 20), glow, 3.1, 1.45, 5.8, false); ring.rotation.x = Math.PI / 2
  hallCrowd(c.group, [{ x: 3.2, z: 5.15, yaw: Math.PI }], [{ model: 'woman3', look: { top: 0xe8e2d6, bottom: 0x2b2f3a, skin: 0x8d5a3b, hair: 0x16110e } }], { cap: 1, seatY: 0.72, pose: 'sit' })
  const coat = { top: 0xf6f6f4, bottom: 0xf6f6f4, shoes: 0xe8e8e8 }
  standing(c.group, { model: 'woman4', look: { ...coat, skin: 0x5a3825, hair: 0x16110e } }, 2.3, 0, 5.0, Math.PI * 0.6)
  // dental chair: a reclined seat on a column, the overhead light and the instrument tray
  put('chrome', 6.6, 0, 5.4, 0.16, 0.45, 0.16)
  put('teal', 6.6, 0.45, 5.15, 0.6, 0.1, 0.9); put('teal', 6.6, 0.55, 5.85, 0.6, 0.1, 0.7, 0)
  const back = c.add(new THREE.BoxGeometry(0.58, 0.1, 0.8), M.teal, 6.6, 0.85, 4.55, false); back.rotation.x = -0.9
  block(6.6, 5.2, 0.4, 0.9)
  c.add(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), M.chrome, 7.3, 2.1, 5.0, false)
  const lamp = c.add(new THREE.BoxGeometry(0.4, 0.08, 0.2), glow, 7.0, 1.6, 4.9, false); lamp.rotation.z = 0.3
  put('chrome', 5.8, 0, 6.3, 0.06, 0.9, 0.06); put('white', 5.8, 0.9, 6.3, 0.5, 0.03, 0.35)
  for (let k = 0; k < 5; k++) c.add(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), M.chrome, 5.65 + k * 0.07, 0.94, 6.3, false).rotation.z = Math.PI / 2
  hallCrowd(c.group, [{ x: 6.6, z: 5.2, yaw: Math.PI }], [{ model: 'man3', look: { top: 0x8a6a3a, bottom: 0x23262a, skin: 0xbf8a62, hair: 0x2a1d14 } }], { cap: 1, seatY: 0.55, pose: 'sit' })
  standing(c.group, { model: 'man4', look: { ...coat, skin: 0x6f4329, hair: 0x0e0c0b } }, 7.45, 0, 5.6, -Math.PI * 0.7)
  // the cabinet of supplies along the back wall
  put('white', 8.6, 0, 3.6, 0.6, 1.8, 1.4); put('glass', 8.28, 0.9, 3.6, 0.02, 0.8, 1.3); block(8.6, 3.6, 0.3, 0.7)
  for (let k = 0; k < 8; k++) goods.push({ p: k % 2 ? 'jar' : 'bottle', x: 8.55, y: 1.0 + Math.floor(k / 4) * 0.4, z: 3.1 + (k % 4) * 0.3, tint: 0xffffff, s: 0.7 })

  for (const k of Object.keys(lists) as Array<keyof typeof M>) boxes(c, M[k], lists[k])
  if (goods.length) placeGoods(goods, c.group)

  // ---- what you can do in each room
  c.use({ id: 'well-salon', x: 3.9, z: -3.4, r: 1.6, title: 'Salon', body: 'Cuts, braids, a shave, a wash and style or a manicure. Take a chair.', enter: 'Take a chair', run: () => h.open('salon') })
  c.use({ id: 'well-therapy', x: 2.2, z: 0, r: 1.4, title: 'Counselling room', body: 'A quiet room and someone trained to listen. Breathing and journalling are free.', enter: 'Go in and talk', run: () => h.open('therapy') })
  c.use({ id: 'well-clinic', x: 4.6, z: 3.4, r: 1.6, title: 'Skin and dental clinic', body: 'A skin consultation, a facial or a dental polish with a licensed team.', enter: 'See the clinic', run: () => h.open('clinic') })
  c.use({ id: 'well-desk', x: -5.6, z: -3.5, r: 1.3, title: 'Reception', body: 'Three rooms under one roof: the salon, the counselling room and the clinic.', enter: 'Ask at reception', run: () => c.toast('"Welcome! The salon is on the left, counselling straight ahead, and the clinic on the right."') })
  return () => 0
}

/** Unused crowd type kept for callers that want to seat more visitors later. */
export type WellSpot = CrowdSpot
