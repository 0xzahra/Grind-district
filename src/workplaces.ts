// Inside McGrind and the Grind Market hall (rooms built by interiors.ts on the first visit).
// McGrind: a customer counter under green menu boards, a queue and diners, and a kitchen behind the counter with
// a fryer, a grill, a shawarma spit, a drinks machine and boba jars. Order a meal, or go round the counter and
// work a shift (mcgrind.ts). Grind Market: 28 stalls under coloured awnings in four rows; the 14 on the centre
// aisle are for players (market.ts) and show who runs them, the rest have traders. Shoppers fill the aisles.
import * as THREE from 'three'
import { sayLine, selfTalker } from './gestures.ts'
import { speak } from './speech.ts'
import { boxes, sign, type Floor, type HallCtx } from './halls.ts'
import { hallCrowd, standing, ATTENDEES, STUDENTS, type CrowdSpot } from './hallCrowd.ts'
import { drawMcGrindMark } from './brandFronts.ts'
import { GOODS, priceOf, type Market } from './market.ts'

type B6 = [number, number, number, number, number, number]

export function buildMcGrind(c: HallCtx, h: { shift: () => void; order: () => void }): Floor {
  const green = c.std(0x0f7a48, 0.55), cream = c.std(0xfff4dc, 0.6), steel = c.std(0xb9c0c6, 0.3, 0.7), dark = c.std(0x23262a, 0.5, 0.3)
  const brown = c.std(0x6b3a1f, 0.8), gold = c.std(0xd9a83a, 0.35, 0.2)
  const bright = new THREE.MeshStandardMaterial({ color: 0x17f790, emissive: 0x17f790, emissiveIntensity: 0.5, roughness: 0.4 })
  // Counter across the room; the gap at its north end is the way into the kitchen.
  c.box(0.9, 1.05, 11.4, green, 1.2, 0.3)
  c.box(1.05, 0.05, 11.5, cream, 1.2, 0.3, 1.05, false)
  c.box(1.06, 0.06, 11.5, bright, 1.2, 0.3, 0.95, false)
  for (const z of [-1.5, 2.5]) c.box(0.4, 0.3, 0.35, dark, 1.2, z, 1.1, false)
  // Kitchen along the east wall.
  c.box(1.6, 0.9, 1.0, steel, 9.1, -5.0); c.box(1.3, 0.02, 0.7, gold, 9.1, -5.0, 0.9, false)
  c.box(2.0, 0.9, 1.0, steel, 9.1, -2.4); c.box(1.9, 0.04, 0.9, dark, 9.1, -2.4, 0.9, false)
  boxes(c, brown, [[8.7, 0.94, -2.7, 0.3, 0.05, 0.3], [9.2, 0.94, -2.2, 0.3, 0.05, 0.3], [9.5, 0.94, -2.7, 0.3, 0.05, 0.3]])
  c.box(1.2, 0.9, 1.0, steel, 9.1, 0.4)
  const meat = c.add(new THREE.ConeGeometry(0.3, 0.95, 14), brown, 9.1, 1.45, 0.4); meat.rotation.x = Math.PI
  c.add(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), steel, 9.1, 1.55, 0.4)
  c.box(1.9, 1.9, 0.8, green, 9.2, 3.2)
  for (const dz of [-0.5, 0, 0.5]) c.add(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), bright, 8.75, 1.15, 3.2 + dz)
  c.box(1.2, 0.9, 0.9, steel, 9.1, 5.4)
  ;[0xf3e6cf, 0x5a3a2a, 0xe89ab0].forEach((col, k) => c.add(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 12), c.std(col, 0.3), 8.8 + k * 0.32, 1.12, 5.4))
  c.box(1.0, 0.9, 6.0, steel, 5.0, -0.5)
  // Menu boards over the counter, facing the customers.
  const menus: Array<(g: CanvasRenderingContext2D) => void> = [
    (g) => { g.fillStyle = '#fff4dc'; g.font = '800 64px "Inter Variable", Inter, sans-serif'; g.fillText('Burgers & Fries', 40, 90); g.font = '600 46px "Inter Variable", Inter, sans-serif'; g.fillText('🍔 Grind Burger   $4.00', 40, 190); g.fillText('🍟 Golden Fries    $2.00', 40, 270); g.fillText('🍔🍟 Meal deal      $5.50', 40, 350) },
    (g) => { drawMcGrindMark(g, 40, 40, 300); g.fillStyle = '#fff4dc'; g.font = '900 96px "Archivo Black", "Inter Variable", sans-serif'; g.fillText('McGrind', 370, 170); g.fillStyle = '#17f790'; g.font = '700 40px "Inter Variable", Inter, sans-serif'; g.fillText('Now hiring: day & night shifts', 372, 250) },
    (g) => { g.fillStyle = '#fff4dc'; g.font = '800 64px "Inter Variable", Inter, sans-serif'; g.fillText('Shawarma & Drinks', 40, 90); g.font = '600 46px "Inter Variable", Inter, sans-serif'; g.fillText('🥙 Shawarma        $4.50', 40, 190); g.fillText('🥤 Shake · 🍹 Smoothie $3', 40, 270); g.fillText('🧋 Boba tea          $3.50', 40, 350) },
  ]
  menus.forEach((draw, k) => {
    const t = c.canvasTex(1024, 384, (g) => { g.fillStyle = '#0f7a48'; g.fillRect(0, 0, 1024, 384); g.strokeStyle = '#17f790'; g.lineWidth = 8; g.strokeRect(8, 8, 1008, 368); draw(g) })
    const m = c.add(new THREE.PlaneGeometry(3.3, 1.24), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.6 }), 1.75, 2.75, -3.6 + k * 3.9)
    m.rotation.y = -Math.PI / 2; m.castShadow = false
  })
  // Dining: four tables for two (the door path down the middle stays clear).
  const tops: B6[] = [], chairs: B6[] = []
  const diners: CrowdSpot[] = []
  let free = 0
  for (const [tx, tz] of [[-7.6, -5.0], [-4.4, -5.0], [-7.6, 5.0], [-4.4, 5.0], [-7.6, -2.4], [-7.6, 2.4]] as const) {
    tops.push([tx, 0.72, tz, 1.1, 0.05, 0.75], [tx, 0, tz, 0.1, 0.72, 0.1])
    c.obstacles.push({ kind: 'box', x: c.ox + tx, z: c.oz + tz, hx: 0.6, hz: 0.42 })
    for (const s of [-1, 1]) {
      const cx = tx + s * 0.85
      chairs.push([cx, 0, tz, 0.44, 0.45, 0.44], [cx + s * 0.2, 0.45, tz, 0.05, 0.5, 0.44])
      const yaw = s < 0 ? Math.PI / 2 : -Math.PI / 2
      if ((tx * 7 + tz * 3 + s) % 3 === 0 || free > 4) diners.push({ x: cx, z: tz, yaw })
      else { free++; c.seat(`mcg${tx}${tz}${s}`, 'Table seat', cx, tz, yaw, 0.45) }
    }
  }
  boxes(c, cream, tops); boxes(c, green, chairs)
  hallCrowd(c.group, diners, STUDENTS, { cap: Math.min(diners.length, Math.ceil(c.cap / 6)), seatY: 0.45 })
  // The line at the counter, and the crew.
  const line: CrowdSpot[] = [0, 1, 2, 3].map((k) => ({ x: -0.2 - k * 0.8, z: 2.6, yaw: Math.PI / 2 }))
  hallCrowd(c.group, line, ATTENDEES.slice(1, 5), { cap: Math.min(4, Math.max(2, Math.round(c.cap / 20))), pose: 'stand' })
  for (const p of line) c.obstacles.push({ kind: 'circle', x: c.ox + p.x, z: c.oz + p.z, r: 0.28 })
  const crew = { top: 0x0f7a48, bottom: 0x23262a, shoes: 0x1a1c1f }
  standing(c.group, { model: 'man2', look: { ...crew, skin: 0x5a3825, hair: 0x0e0c0b } }, 8.0, 0, -2.4, Math.PI / 2)
  const cashier = standing(c.group, { model: 'woman2', look: { ...crew, skin: 0x8d5a3b, hair: 0x16110e } }, 2.1, 0, 0.8, -Math.PI / 2)
  const till = selfTalker(cashier, 'mcgrind-cashier')
  const GREET = ['Welcome to McGrind! One combo coming right up.', 'Hi! Burger, fries and a cold drink. Enjoy.', 'Good to see you. Fresh fries just came out.']
  let greets = 0
  c.obstacles.push({ kind: 'circle', x: c.ox + 8.0, z: c.oz - 2.4, r: 0.3 }, { kind: 'circle', x: c.ox + 2.1, z: c.oz + 0.8, r: 0.3 })
  c.use({ id: 'mcgrind-order', x: 0.1, z: -1.6, r: 1.3, title: 'McGrind counter', body: 'A burger, fries and a drink. Fills you up.', enter: 'Order a meal · $4', run: () => { const line = GREET[greets++ % GREET.length]!; speak(line, { gender: 'f', seed: 11 }); sayLine('mcgrind-cashier', line); till.play('nod'); h.order() } })
  c.use({ id: 'mcgrind-shift', x: 2.9, z: -6.7, r: 1.4, title: 'McGrind kitchen', body: 'Cook and serve the line for two and a half minutes. Earned cash at the end, tips for speed and quality.', enter: 'Work a shift', run: h.shift })
  return () => 0
}

export function buildMarket(c: HallCtx, m: Market, h: { snack: () => void }): Floor {
  const timber = c.std(0x6b3f24, 0.8), counter = c.std(0x8a5a36, 0.7), shelf = c.std(0x5a3a22, 0.8)
  const rows = [{ z: -10.4, face: 1 }, { z: -3.8, face: 1 }, { z: 3.8, face: -1 }, { z: 10.4, face: -1 }] as const
  const cols = [-12, -7.5, -3, 1.5, 6, 10.5, 15]
  const awnColors = [0xd9534f, 0xf0c419, 0x2f7a58, 0x3a5f8a, 0xe07a2f, 0x8a4ab0, 0x1f9c8a].map((x) => new THREE.Color(x))
  const counters: B6[] = [], shelves: B6[] = [], posts: B6[] = []
  const awnings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), c.std(0xffffff, 0.8), rows.length * cols.length)
  const goods = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), c.std(0xffffff, 0.75), rows.length * cols.length * 3)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s3 = new THREE.Vector3()
  const vendors: CrowdSpot[] = [], shoppers: CrowdSpot[] = []
  type Slot = { i: number; x: number; zf: number; face: number; goodsBase: number; trader: string | null; sig: string; sign: { t: THREE.CanvasTexture; draw: () => void } | null }
  const slots: Slot[] = []
  let ai = 0, gi = 0, rent = 0
  rows.forEach((r, ri) => cols.forEach((x, ci) => {
    const zf = r.z + r.face * 0.6, zb = r.z - r.face * 0.75
    counters.push([x, 0, zf, 3.4, 1.0, 0.7]); shelves.push([x, 0, zb, 3.4, 1.7, 0.45])
    for (const sx of [-1.65, 1.65]) for (const pz of [zf, zb]) posts.push([x + sx, 0, pz, 0.08, 2.6, 0.08])
    awnings.setMatrixAt(ai, m4.compose(v.set(x, 2.64, r.z), q.identity(), s3.set(3.8, 0.08, 2.4))); awnings.setColorAt(ai, awnColors[(ri * 3 + ci) % awnColors.length]!); ai++
    c.obstacles.push({ kind: 'box', x: c.ox + x, z: c.oz + (zf + zb) / 2, hx: 1.8, hz: 0.85 })
    const playerRow = ri === 1 || ri === 2
    const slot: Slot = { i: playerRow ? rent++ : -1, x, zf, face: r.face, goodsBase: gi, trader: playerRow ? null : GOODS[(ri * 2 + ci) % GOODS.length]!.id, sig: '', sign: null }
    gi += 3
    if (playerRow) {
      // A sign over the counter that says who runs it (or that it is free to rent).
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace
      const draw = () => {
        const g = cv.getContext('2d')!, st = m.stallState(slot.i)
        g.fillStyle = st.kind === 'free' ? '#3a2a1c' : st.kind === 'mine' ? '#0f7a48' : '#23365f'; g.fillRect(0, 0, 512, 160)
        g.strokeStyle = '#f2c46a'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 148)
        g.fillStyle = '#fff6e2'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.font = '800 46px "Inter Variable", Inter, sans-serif'
        const gd = st.kind === 'mine' ? GOODS.find((x) => x.id === st.m.goods)! : st.kind === 'remote' ? GOODS.find((x) => x.id === st.r.goods)! : null
        g.fillText(st.kind === 'free' ? `Stall ${slot.i + 1} · for rent` : st.kind === 'mine' ? 'Your stall' : `${st.r.name}'s stall`, 256, 56, 480)
        g.font = '600 34px "Inter Variable", Inter, sans-serif'; g.fillStyle = '#f2c46a'
        const tier = st.kind === 'mine' ? st.m.tier : st.kind === 'remote' ? st.r.tier : 'fair'
        g.fillText(gd ? `${gd.title} · $${priceOf(gd.id, tier).toFixed(2)}` : '$15 a day · walk up to rent', 256, 116, 480)
        t.needsUpdate = true
      }
      slot.sign = { t, draw }
      draw()
      const sg = c.add(new THREE.PlaneGeometry(2.6, 0.81), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 }), x, 2.15, zf + r.face * 0.36)
      sg.rotation.y = r.face > 0 ? 0 : Math.PI; sg.castShadow = false
      c.use({ id: `stall-${slot.i}`, x, z: zf + r.face * 1.25, r: 1.4, title: `Market stall ${slot.i + 1}`, body: 'Rent it, stock it and sell, or buy from the player who runs it.', enter: 'Open stall', run: () => m.open(slot.i) })
    } else {
      vendors.push({ x, z: r.z - r.face * 0.1, yaw: r.face > 0 ? 0 : Math.PI })
      const gdx = GOODS[(ri * 2 + ci) % GOODS.length]!
      const food = gdx.id === 'suya' || gdx.id === 'jollof' || gdx.id === 'plantain'
      c.use({ id: `trader-${ri}-${ci}`, x, z: zf + r.face * 1.25, r: 1.3, title: `${gdx.title} trader`, body: food ? 'Something hot for the road.' : 'Have a look: prices are fair today.', enter: food ? 'Buy a snack · $2' : 'Browse',
        run: food ? h.snack : () => c.toast(`"${gdx.title}, best in the city. Come back when you have a stall of your own."`) })
    }
    slots.push(slot)
  }))
  boxes(c, counter, counters); boxes(c, shelf, shelves); boxes(c, timber, posts)
  awnings.instanceColor!.needsUpdate = true; awnings.computeBoundingSphere(); c.group.add(awnings)
  // Goods on the counters: traders' always; a player stall's only while someone sells there.
  const paintGoods = () => {
    for (const sl of slots) {
      const st = sl.i >= 0 ? m.stallState(sl.i) : null
      const id = sl.i < 0 ? sl.trader : st!.kind === 'mine' ? st!.m.goods : st!.kind === 'remote' ? st!.r.goods : null
      // Only a stall whose state changed is repainted (remote stalls are announced every few seconds).
      const sig = st ? `${st.kind}|${id}|${st.kind === 'mine' ? st.m.tier : st.kind === 'remote' ? `${st.r.tier}${st.r.name}` : ''}` : `t|${id}`
      if (sig === sl.sig) continue
      sl.sig = sig
      const col = new THREE.Color(id ? GOODS.find((x) => x.id === id)!.color : 0x000000)
      for (let k = 0; k < 3; k++) {
        const hgt = [0.22, 0.3, 0.18][k]!
        goods.setMatrixAt(sl.goodsBase + k, m4.compose(v.set(sl.x + (k - 1) * 1.0, 1.0 + hgt / 2, sl.zf), q.identity(), id ? s3.set(0.62, hgt, 0.46) : s3.set(0, 0, 0)))
        goods.setColorAt(sl.goodsBase + k, col)
      }
      sl.sign?.draw()
    }
    goods.instanceMatrix.needsUpdate = true
    if (goods.instanceColor) goods.instanceColor.needsUpdate = true
  }
  paintGoods()
  goods.computeBoundingSphere()
  c.group.add(goods)
  m.onChange(paintGoods)
  // Shoppers in the three aisles, looking at the stalls.
  for (let x = -14; x <= 16; x += 2.6) {
    shoppers.push({ x, z: -1.3 + ((x * 3) % 2) * 0.2, yaw: Math.PI }, { x: x + 1.3, z: 1.3, yaw: 0 })
    shoppers.push({ x: x + 0.6, z: -7.2, yaw: Math.PI }, { x: x + 1.8, z: 7.2, yaw: 0 })
  }
  const nV = Math.min(vendors.length, Math.max(8, Math.round(c.cap * 0.25)))
  hallCrowd(c.group, vendors, STUDENTS, { cap: nV, pose: 'stand' })
  const browsing = shoppers.filter((_, i) => i % 2 === 0 || c.cap > 60).slice(0, Math.max(8, Math.round(c.cap * 0.3)))
  hallCrowd(c.group, browsing, ATTENDEES, { cap: browsing.length, pose: 'stand' })
  for (const p of browsing) c.obstacles.push({ kind: 'circle', x: c.ox + p.x, z: c.oz + p.z, r: 0.3 })
  sign(c, 'Player stalls · centre aisle', 'z', -17.8, 0, 1)
  return () => 0
}
