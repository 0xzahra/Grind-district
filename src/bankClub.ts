// Inside Grind Bank and Barakah Club (rooms built by interiors.ts on the first visit).
// Grind Bank: a tall marble banking hall with columns, a teller counter with three windows, a live ETF board on the
// north wall (the two spot crypto ETFs, their NAV and premium, from this minute's prices), the vault door on the
// south wall and the halal savings desk. Every desk opens the bank (bank.ts) on its own tab.
// Barakah Club: a place for friends to gather and eat together: dining tables of four with shared dishes, a serving
// counter with a host, and a quiet prayer corner behind its own screen.
import * as THREE from 'three'
import { boxes, sign, type Floor, type HallCtx } from './halls.ts'
import { hallCrowd, standing, ATTENDEES, STUDENTS, type CrowdSpot } from './hallCrowd.ts'
import { sayLine, selfTalker } from './gestures.ts'
import { speak } from './speech.ts'
import { FUNDS, nav, premium, sharePrice } from './bankCore.ts'
import { ensurePrices, livePrice } from './livePrices.ts'

type B6 = [number, number, number, number, number, number, number?]
export type BankTab = 'learn' | 'etf' | 'halal'
const SANS = '"Inter Variable", Inter, system-ui, sans-serif'

export function buildBank(c: HallCtx, h: { open: (tab: BankTab) => void }): Floor {
  const marble = c.std(0xf1ece2, 0.35), brass = c.std(0xc9a25e, 0.3, 0.8), wood = c.std(0x3b2a1e, 0.55), glass = new THREE.MeshStandardMaterial({ color: 0xcfe6f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28 })
  const steel = c.std(0x8e979e, 0.28, 0.9), navy = c.std(0x1b2a3a, 0.6)
  // Columns down both sides of the hall.
  const cols: B6[] = [], caps: B6[] = []
  for (const x of [-6.5, -1.5, 3.5]) for (const z of [-4.6, 4.6]) {
    cols.push([x, 0, z, 0.62, c.H, 0.62]); caps.push([x, 0, z, 0.9, 0.22, 0.9], [x, c.H - 0.3, z, 0.9, 0.3, 0.9])
    c.obstacles.push({ kind: 'circle', x: c.ox + x, z: c.oz + z, r: 0.45 })
  }
  boxes(c, marble, cols); boxes(c, brass, caps)
  // The teller counter along the east wall: dark wood, a brass rail, glass screens between three windows.
  const cx = 7.6
  boxes(c, wood, [[cx, 0, 0, 0.8, 1.1, 10.4]]); boxes(c, brass, [[cx - 0.42, 1.1, 0, 0.06, 0.06, 10.4]])
  boxes(c, glass, [-3.4, -1.1, 1.1, 3.4].map((z): B6 => [cx, 1.1, z, 0.04, 1.1, 2.1]))
  c.obstacles.push({ kind: 'box', x: c.ox + cx, z: c.oz, hx: 0.5, hz: 5.3 })
  const tellerLook = { top: 0x1b2a3a, bottom: 0x23262a, shoes: 0x16181b }
  const tellers = [
    standing(c.group, { model: 'woman4', look: { ...tellerLook, skin: 0x5a3825, hair: 0x16110e } }, 8.7, 0, -2.25, -Math.PI / 2),
    standing(c.group, { model: 'man4', look: { ...tellerLook, skin: 0x8d5a3b, hair: 0x0e0c0b } }, 8.7, 0, 0, -Math.PI / 2),
    standing(c.group, { model: 'abaya', look: { top: 0x1f2633, skin: 0xc68a62 } }, 8.7, 0, 2.25, -Math.PI / 2),
  ]
  const talkers = tellers.map((t, i) => selfTalker(t, `bank-teller-${i}`))
  const greet = (i: number, line: string, tab: BankTab) => () => { speak(line, { gender: i === 1 ? 'm' : 'f', seed: 20 + i }); sayLine(`bank-teller-${i}`, line); talkers[i]!.play('nod'); h.open(tab) }
  c.use({ id: 'bank-teller-1', x: 6.5, z: -2.25, r: 1.2, title: 'Teller · how crypto institutions work', body: 'Exchanges, custodians and crypto banks: custody, reserves, proof of reserves and where yield comes from.', enter: 'Ask the teller', run: greet(0, 'Welcome to Grind Bank. Let me show you how crypto institutions keep your coins.', 'learn') })
  c.use({ id: 'bank-teller-2', x: 6.5, z: 0, r: 1.2, title: 'Teller · ETF desk', body: 'Buy and sell shares of two spot crypto ETFs with earned in-game cash.', enter: 'Open the ETF desk', run: greet(1, 'Good to see you. Spot Bitcoin and Ether ETFs, right here.', 'etf') })
  c.use({ id: 'bank-teller-3', x: 6.5, z: 2.25, r: 1.2, title: 'Teller · halal savings', body: 'A profit-sharing account: no interest, profits shared 60:40.', enter: 'Open halal savings', run: greet(2, 'As-salaam alaikum. Our halal account shares profit, never interest.', 'halal') })
  for (const [z, t] of [[-2.25, 'Window 1 · Learn'], [0, 'Window 2 · ETFs'], [2.25, 'Window 3 · Halal savings']] as const) {
    const tex = c.canvasTex(512, 96, (g) => { g.fillStyle = '#1b2a3a'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#e9cf8e'; g.font = `700 40px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, 50, 490) })
    const m = c.add(new THREE.PlaneGeometry(1.9, 0.36), new THREE.MeshBasicMaterial({ map: tex }), cx - 0.02, 2.55, z, false, -Math.PI / 2)
    m.castShadow = false
  }
  // The live ETF board on the north wall: both funds' price, NAV and premium, and the coins they hold.
  const cv = document.createElement('canvas'); cv.width = 1536; cv.height = 420
  const board = new THREE.CanvasTexture(cv); board.colorSpace = THREE.SRGBColorSpace; board.anisotropy = 4
  const paint = () => {
    ensurePrices()
    const g = cv.getContext('2d')!, now = Date.now()
    g.fillStyle = '#0b1420'; g.fillRect(0, 0, 1536, 420)
    g.strokeStyle = '#c9a25e'; g.lineWidth = 6; g.strokeRect(8, 8, 1520, 404)
    g.fillStyle = '#e9cf8e'; g.font = `800 46px ${SANS}`; g.fillText('GRIND BANK · SPOT CRYPTO ETFs', 40, 72)
    g.fillStyle = '#3bfaa4'; g.beginPath(); g.arc(1420, 56, 10, 0, Math.PI * 2); g.fill(); g.font = `700 30px ${SANS}`; g.fillText('LIVE', 1440, 66)
    g.font = `600 26px ${SANS}`; g.fillStyle = 'rgba(233,239,245,0.62)'
    ;['FUND', 'PRICE', 'NAV', 'PREMIUM', 'HOLDS / SHARE', 'FEE'].forEach((t, i) => g.fillText(t, [40, 520, 760, 990, 1200, 1430][i]!, 140))
    FUNDS.forEach((f, i) => {
      const coin = livePrice(f.coin) ?? f.fallback, y = 220 + i * 95
      const n = nav(f, coin, now), p = sharePrice(f, coin, now), pr = premium(f, now)
      g.fillStyle = '#f4f6f8'; g.font = `800 44px ${SANS}`; g.fillText(f.ticker, 40, y)
      g.fillStyle = 'rgba(233,239,245,0.7)'; g.font = `500 26px ${SANS}`; g.fillText(f.name, 190, y - 4, 300)
      g.fillStyle = '#f4f6f8'; g.font = `800 44px ${SANS}`; g.fillText(`$${p.toFixed(2)}`, 520, y)
      g.fillText(`$${n.toFixed(2)}`, 760, y)
      g.fillStyle = pr >= 0 ? '#3bfaa4' : '#ff8a8a'; g.fillText(`${pr >= 0 ? '+' : ''}${(pr * 100).toFixed(2)}%`, 990, y)
      g.fillStyle = '#e9cf8e'; g.font = `700 34px ${SANS}`; g.fillText(`${f.perShare} ${f.coin}`, 1200, y)
      g.fillStyle = 'rgba(233,239,245,0.8)'; g.fillText(`${(f.fee * 100).toFixed(2)}%`, 1430, y)
    })
    g.fillStyle = 'rgba(233,239,245,0.55)'; g.font = `500 24px ${SANS}`
    g.fillText('Price is what a share trades at; NAV is what the coins inside are worth. Practice funds, earned cash only.', 40, 396, 1450)
    board.needsUpdate = true
  }
  paint()
  const bm = c.add(new THREE.PlaneGeometry(10.2, 2.79), new THREE.MeshStandardMaterial({ map: board, emissiveMap: board, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.6 }), -0.5, 3.1, -c.d / 2 + 0.08, false)
  bm.castShadow = false
  boxes(c, brass, [[-0.5, 1.62, -c.d / 2 + 0.05, 10.6, 0.08, 0.08]])
  let t = 0
  c.onTick((dt) => { t += dt; if (t > 5) { t = 0; paint() } })
  c.use({ id: 'etf-board', x: -0.5, z: -c.d / 2 + 1.6, r: 1.8, title: 'ETF board', body: 'Live prices of the two spot crypto ETFs. Tap to trade at the desk.', enter: 'Trade ETFs', run: () => h.open('etf') })
  // The vault door on the south wall: a steel disc, its wheel and bolts.
  const vz = c.d / 2 - 0.12
  const door = c.add(new THREE.CylinderGeometry(1.45, 1.45, 0.22, 40), steel, 3.4, 1.75, vz, false); door.rotation.x = Math.PI / 2
  const rim = c.add(new THREE.TorusGeometry(1.5, 0.12, 10, 40), c.std(0x5e666c, 0.4, 0.8), 3.4, 1.75, vz - 0.06, false); rim.castShadow = false
  const wheel = c.add(new THREE.TorusGeometry(0.45, 0.05, 8, 24), brass, 3.4, 1.75, vz - 0.16, false)
  for (let k = 0; k < 3; k++) { const s = c.add(new THREE.BoxGeometry(1.0, 0.06, 0.06), brass, 3.4, 1.75, vz - 0.16, false); s.rotation.z = (k * Math.PI) / 3 }
  void wheel
  sign(c, 'The vault · cold storage', 'x', c.d / 2 - 0.05, 3.4, -1)
  c.use({ id: 'bank-vault', x: 3.4, z: vz - 1.3, r: 1.5, title: 'The vault', body: 'Where an institution keeps most coins: offline keys, split between several people.', enter: 'Learn about custody', run: () => h.open('learn') })
  // The halal savings desk: a desk, two chairs and an advisor, under its own sign.
  boxes(c, wood, [[-5.2, 0, 5.9, 2.4, 0.76, 1.0]]); boxes(c, navy, [[-5.8, 0, 5.0, 0.5, 0.46, 0.5], [-4.6, 0, 5.0, 0.5, 0.46, 0.5]])
  c.obstacles.push({ kind: 'box', x: c.ox - 5.2, z: c.oz + 5.9, hx: 1.3, hz: 0.6 })
  const adv = standing(c.group, { model: 'abaya', look: { top: 0x23513f, skin: 0x8d5a3b } }, -5.2, 0, 6.9, Math.PI)
  const advTalk = selfTalker(adv, 'bank-advisor')
  sign(c, 'Halal savings · profit-sharing', 'x', c.d / 2 - 0.05, -5.2, -1)
  c.use({ id: 'halal-desk', x: -5.2, z: 4.4, r: 1.4, title: 'Halal savings desk', body: 'No interest. Your savings join a screened pool; profits are shared 60:40.', enter: 'Open halal savings', run: () => { const l = 'Welcome. Here your savings share real profit, never interest.'; speak(l, { gender: 'f', seed: 24 }); sayLine('bank-advisor', l); advTalk.play('nod'); h.open('halal') } })
  // Waiting benches in the middle of the hall.
  boxes(c, navy, [[-3.2, 0, -1.2, 2.6, 0.45, 0.6], [-3.2, 0, 1.2, 2.6, 0.45, 0.6]])
  for (const [z, yaw] of [[-1.2, 0], [1.2, Math.PI]] as const) for (const x of [-4.0, -2.4]) c.seat(`bank-${x}-${z}`, 'Bench', x, z, yaw, 0.45)
  c.obstacles.push({ kind: 'box', x: c.ox - 3.2, z: c.oz - 1.2, hx: 1.35, hz: 0.35 }, { kind: 'box', x: c.ox - 3.2, z: c.oz + 1.2, hx: 1.35, hz: 0.35 })
  sign(c, 'Grind Bank', 'z', -c.w / 2 + 0.05, 0, 1)
  // Customers waiting at the windows.
  const line: CrowdSpot[] = [[5.2, -2.25], [5.2, 2.25], [4.3, 2.25], [-1.0, -6.2]].map(([x, z]) => ({ x: x!, z: z!, yaw: x! > 0 ? Math.PI / 2 : Math.PI }))
  hallCrowd(c.group, line, ATTENDEES, { cap: Math.min(line.length, Math.max(2, Math.round(c.cap / 20))), pose: 'stand' })
  for (const p of line) c.obstacles.push({ kind: 'circle', x: c.ox + p.x, z: c.oz + p.z, r: 0.28 })
  return () => 0
}

export function buildClub(c: HallCtx, h: { dine: () => void }): Floor {
  const oak = c.std(0x7a5236, 0.55), cloth = c.std(0xf4efe4, 0.85), seatMat = c.std(0x2f5a46, 0.8), brass = c.std(0xc9a25e, 0.3, 0.8)
  // The serving counter along the north wall: warm dishes under brass lamps, and the host who serves you.
  const bz = -c.d / 2 + 1.3
  boxes(c, oak, [[-1.0, 0, bz, 8.4, 0.95, 0.8]]); boxes(c, brass, [[-1.0, 0.95, bz, 8.6, 0.04, 0.9]])
  c.obstacles.push({ kind: 'box', x: c.ox - 1.0, z: c.oz + bz, hx: 4.3, hz: 0.5 })
  const dishes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.26, 0.2, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), 8)
  const food = [0xd2541f, 0xc98a3a, 0xf3e6c8, 0x5f8a3a, 0x9c3a1e, 0xe0b04a, 0xf3e6c8, 0x7a3e22].map((x) => new THREE.Color(x))
  const m4 = new THREE.Matrix4()
  for (let k = 0; k < 8; k++) { dishes.setMatrixAt(k, m4.makeTranslation(-4.6 + k * 1.02, 1.05, bz)); dishes.setColorAt(k, food[k]!) }
  dishes.computeBoundingSphere(); c.group.add(dishes)
  const host = standing(c.group, { model: 'kurta', look: { top: 0xf2efe8, skin: 0x6f4329 } }, -1.0, 0, bz - 0.85, 0)
  const hostTalk = selfTalker(host, 'barakah-host')
  const menu = c.canvasTex(1024, 300, (g) => {
    g.fillStyle = '#2f5a46'; g.fillRect(0, 0, 1024, 300); g.strokeStyle = '#d4af6a'; g.lineWidth = 6; g.strokeRect(8, 8, 1008, 284)
    g.fillStyle = '#f6e7c1'; g.font = '800 54px "Inter Variable", Inter, sans-serif'; g.fillText('TONIGHT’S TABLE · $5', 40, 84)
    g.fillStyle = '#f4efe2'; g.font = '500 36px "Inter Variable", Inter, sans-serif'
    ;['Jollof rice and chicken', 'Suya with onions and yaji', 'Fried rice and plantain', 'Fruit, dates and hot tea'].forEach((t, i) => g.fillText(`· ${t}`, 40 + (i % 2) * 480, 170 + Math.floor(i / 2) * 64, 460))
  })
  const mm = c.add(new THREE.PlaneGeometry(4.4, 1.29), new THREE.MeshStandardMaterial({ map: menu, emissiveMap: menu, emissive: 0xffffff, emissiveIntensity: 0.45 }), -1.0, 2.6, -c.d / 2 + 0.08, false)
  mm.castShadow = false
  const SERVE = ['Welcome, friend. Jollof is fresh tonight.', 'Sit with your people. Food is on its way.', 'Suya and hot tea for the table. Enjoy.']
  let served = 0
  c.use({ id: 'barakah-serve', x: -1.0, z: bz + 1.0, r: 1.6, title: 'Serving counter', body: 'Jollof, suya, fried rice and plantain, fruit and hot tea. Eat with your friends.', enter: 'Get a plate · $5', run: () => { const l = SERVE[served++ % SERVE.length]!; speak(l, { gender: 'm', seed: 33 }); sayLine('barakah-host', l); hostTalk.play('nod'); h.dine() } })
  // Dining tables of four with white cloths, plates and shared dishes; friends at most of them.
  const tables: B6[] = [], chairs: B6[] = [], plates: Array<[number, number]> = [], centre: Array<[number, number]> = []
  const diners: CrowdSpot[] = []
  let free = 0, seatN = 0
  for (const tx of [-3.6, 1.2, 6.0]) for (const tz of [-2.6, 1.6, 5.4]) {
    tables.push([tx, 0, tz, 1.5, 0.74, 1.5]); centre.push([tx, tz])
    c.obstacles.push({ kind: 'box', x: c.ox + tx, z: c.oz + tz, hx: 0.8, hz: 0.8 })
    for (const [sx, sz, yaw] of [[0, -1.05, 0], [0, 1.05, Math.PI], [-1.05, 0, Math.PI / 2], [1.05, 0, -Math.PI / 2]] as const) {
      const x = tx + sx, z = tz + sz
      chairs.push([x, 0, z, 0.46, 0.45, 0.46], [x - Math.sin(yaw) * 0.2, 0.45, z - Math.cos(yaw) * 0.2, Math.abs(sx) ? 0.07 : 0.46, 0.5, Math.abs(sx) ? 0.46 : 0.07])
      plates.push([tx + sx * 0.45, tz + sz * 0.45])
      // Leave a chair or two free at every table for you and your friends.
      if ((seatN++ % 4 === 1 && free < 9) ) { free++; c.seat(`barakah-${tx}-${tz}-${sx}-${sz}`, 'Dining chair', x, z, yaw, 0.45) } else diners.push({ x, z, yaw })
    }
  }
  boxes(c, oak, tables.map(([x, y, z, , hh]): B6 => [x, y, z, 0.12, hh - 0.04, 0.12]))
  boxes(c, cloth, tables.map(([x, , z, w, hh, d]): B6 => [x, hh - 0.04, z, w + 0.1, 0.04, d + 0.1]))
  boxes(c, seatMat, chairs)
  const plateMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.13, 0.025, 16), c.std(0xffffff, 0.4), plates.length)
  plates.forEach(([x, z], k) => plateMesh.setMatrixAt(k, m4.makeTranslation(x, 0.775, z)))
  plateMesh.computeBoundingSphere(); c.group.add(plateMesh)
  const bowls = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), centre.length)
  centre.forEach(([x, z], k) => { bowls.setMatrixAt(k, m4.makeTranslation(x, 0.82, z)); bowls.setColorAt(k, food[k % food.length]!) })
  bowls.computeBoundingSphere(); c.group.add(bowls)
  hallCrowd(c.group, diners, [...STUDENTS, ...ATTENDEES], { cap: Math.min(diners.length, Math.max(8, Math.round(c.cap / 3))), seatY: 0.45 })
  // The prayer corner in the south-west: a screen, three mats and the qibla marked on the wall.
  boxes(c, c.std(0xe9e0cc, 0.8), [[-6.6, 0, c.d / 2 - 3.2, 3.6, 2.2, 0.08]])
  const mat = c.canvasTex(256, 512, (g) => {
    g.fillStyle = '#1f5a4c'; g.fillRect(0, 0, 256, 512); g.strokeStyle = '#d4af6a'; g.lineWidth = 8; g.strokeRect(14, 14, 228, 484)
    g.beginPath(); g.moveTo(40, 150); g.quadraticCurveTo(128, 40, 216, 150); g.stroke()
    g.fillStyle = 'rgba(212,175,106,0.35)'; for (let k = 0; k < 6; k++) g.fillRect(40, 220 + k * 44, 176, 10)
  })
  for (const x of [-7.8, -6.6, -5.4]) { const m = c.add(new THREE.PlaneGeometry(0.75, 1.3), new THREE.MeshStandardMaterial({ map: mat, roughness: 0.9 }), x, 0.02, c.d / 2 - 1.6, false); m.rotation.x = -Math.PI / 2; m.castShadow = false }
  sign(c, 'Prayer corner', 'z', -c.w / 2 + 0.05, c.d / 2 - 1.6, 1)
  c.use({ id: 'club-prayer', x: -6.6, z: c.d / 2 - 2.2, r: 1.4, title: 'Prayer corner', body: 'A quiet place to pray, screened from the dining room.', enter: 'Rest here', run: () => c.toast('A quiet corner to pray. Prayer times are in the menu under Prayer.') })
  // The name on the east wall.
  const name = c.canvasTex(1024, 300, (g) => {
    g.fillStyle = '#f4ecdc'; g.fillRect(0, 0, 1024, 300); g.strokeStyle = '#c9a25e'; g.lineWidth = 6; g.strokeRect(10, 10, 1004, 280)
    g.fillStyle = '#2f5a46'; g.font = '900 120px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Barakah', 512, 128, 960)
    g.fillStyle = '#8a6a1c'; g.font = '600 40px "Inter Variable", Inter, sans-serif'; g.fillText('FRIENDS · FOOD · FELLOWSHIP', 512, 236, 960)
  })
  const nm = c.add(new THREE.PlaneGeometry(4.4, 1.29), new THREE.MeshStandardMaterial({ map: name, roughness: 0.8 }), c.w / 2 - 0.08, 2.7, 1.6, false, -Math.PI / 2)
  nm.castShadow = false
  sign(c, 'Barakah Club', 'z', -c.w / 2 + 0.05, -2, 1)
  return () => 0
}
