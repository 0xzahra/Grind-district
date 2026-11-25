// Inside Grind Bank and Barakah Club (rooms built by interiors.ts on the first visit).
// Grind Bank: a tall marble banking hall with columns, a teller counter with three windows, a live ETF board on the
// north wall (the two spot crypto ETFs, their NAV and premium, from this minute's prices), the vault door on the
// south wall and the halal savings desk. Every desk opens the bank (bank.ts) on its own tab.
// Barakah Club: a halal night club. No alcohol, ever: a mocktail bar, a dance floor that lights up in waves, a DJ
// booth, lounge sofas, a games table (ludo and ayo) and a quiet prayer corner with its own screen.
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
  c.use({ id: 'bank-teller-1', x: 6.5, z: -2.25, r: 1.2, title: 'Teller · how crypto banks work', body: 'Custody, reserves, proof of reserves and where yield comes from.', enter: 'Ask the teller', run: greet(0, 'Welcome to Grind Bank. Let me show you how a crypto bank keeps your coins.', 'learn') })
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
  c.use({ id: 'bank-vault', x: 3.4, z: vz - 1.3, r: 1.5, title: 'The vault', body: 'Where a bank keeps most coins: offline keys, split between several people.', enter: 'Learn about custody', run: () => h.open('learn') })
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

export function buildClub(c: HallCtx, h: { mocktail: () => void; dance: () => void; games: () => void }): Floor {
  const dark = c.std(0x15131c, 0.6), velvet = c.std(0x5a1f4a, 0.9), gold = c.std(0xd4af6a, 0.3, 0.8), bar = c.std(0x241d2e, 0.35, 0.2)
  // The dance floor: 7 x 7 light tiles that wash through colours in slow waves (one draw call).
  const N = 7, tile = 0.98, fx = 1.5, fz = 0
  // Unlit tiles: each glows in its own colour (a lit material washed them to pastel).
  const floor = new THREE.InstancedMesh(new THREE.BoxGeometry(tile * 0.96, 0.06, tile * 0.96), new THREE.MeshBasicMaterial({ color: 0xffffff }), N * N)
  const m4 = new THREE.Matrix4(), col = new THREE.Color()
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) floor.setMatrixAt(i * N + j, m4.makeTranslation(fx + (i - (N - 1) / 2) * tile, 0.04, fz + (j - (N - 1) / 2) * tile))
  const hues = [0.83, 0.55, 0.12, 0.95, 0.42]
  const wash = (t: number) => {
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const w = Math.sin(t * 1.6 + i * 0.7 + j * 0.45) * 0.5 + 0.5
      col.setHSL((hues[Math.floor(t / 4) % hues.length]! + w * 0.22) % 1, 1, 0.12 + w * 0.4)
      floor.setColorAt(i * N + j, col)
    }
    floor.instanceColor!.needsUpdate = true
  }
  wash(0)
  floor.receiveShadow = true; floor.computeBoundingSphere()
  c.group.add(floor)
  let tt = 0, acc = 0
  c.onTick((dt) => { tt += dt; acc += dt; if (acc > 0.12) { acc = 0; wash(tt) } })
  c.use({ id: 'club-dance', x: fx, z: fz, r: 2.6, title: 'Dance floor', body: 'Halal nights: good music, good people, no alcohol.', enter: 'Dance', run: h.dance })
  // Dancers on the floor.
  const dancers: CrowdSpot[] = [[-1.2, -1.6], [0.4, 1.8], [2.6, -2.2], [3.4, 1.2], [1.0, -0.2], [-0.8, 2.6], [2.2, 2.8], [3.8, -0.6]].map(([x, z], k) => ({ x: fx + x! - 1.5, z: fz + z!, yaw: k * 1.3 }))
  hallCrowd(c.group, dancers, STUDENTS, { cap: Math.min(dancers.length, Math.max(3, Math.round(c.cap / 12))), pose: 'stand' })
  // DJ booth on the east wall, with a glowing name board behind it.
  boxes(c, dark, [[8.2, 0, 0, 1.1, 1.15, 3.2]]); boxes(c, gold, [[7.62, 1.15, 0, 0.06, 0.05, 3.2]])
  c.obstacles.push({ kind: 'box', x: c.ox + 8.4, z: c.oz, hx: 0.9, hz: 1.7 })
  standing(c.group, { model: 'man3', look: { top: 0x23232b, bottom: 0x1a1a1f, skin: 0x5a3825, hair: 0x0e0c0b } }, 8.95, 0, 0, -Math.PI / 2)
  const glow = c.canvasTex(1024, 300, (g) => {
    g.fillStyle = '#100c16'; g.fillRect(0, 0, 1024, 300)
    const grd = g.createLinearGradient(0, 0, 1024, 0); grd.addColorStop(0, '#ff4fd8'); grd.addColorStop(0.5, '#f2c46a'); grd.addColorStop(1, '#3bfaa4')
    g.fillStyle = grd; g.font = `900 150px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BARAKAH', 512, 130, 980)
    g.fillStyle = '#f4efe2'; g.font = `600 44px ${SANS}`; g.fillText('HALAL NIGHTS · NO ALCOHOL', 512, 245, 980)
  })
  const gm = c.add(new THREE.PlaneGeometry(4.8, 1.4), new THREE.MeshStandardMaterial({ map: glow, emissiveMap: glow, emissive: 0xffffff, emissiveIntensity: 0.9 }), c.w / 2 - 0.08, 3.0, 0, false, -Math.PI / 2)
  gm.castShadow = false
  // The mocktail bar along the north wall, with bright bottles of juice, zobo and syrup on the shelves.
  const bz = -c.d / 2 + 1.4
  boxes(c, bar, [[-1.5, 0, bz, 7.4, 1.08, 0.75]]); boxes(c, gold, [[-1.5, 1.08, bz, 7.6, 0.05, 0.85]])
  boxes(c, dark, [[-1.5, 1.2, -c.d / 2 + 0.25, 7.4, 0.04, 0.4], [-1.5, 1.75, -c.d / 2 + 0.25, 7.4, 0.04, 0.4]])
  c.obstacles.push({ kind: 'box', x: c.ox - 1.5, z: c.oz + bz, hx: 3.8, hz: 0.5 })
  const bottles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.15, transparent: true, opacity: 0.9 }), 28)
  const juice = [0xff6f3c, 0xc81d4a, 0x3bfaa4, 0xf2c46a, 0x8a4ab0, 0x2fa4ff, 0xff4fd8].map((x) => new THREE.Color(x))
  for (let k = 0; k < 28; k++) { bottles.setMatrixAt(k, m4.makeTranslation(-5 + (k % 14) * 0.52, k < 14 ? 1.39 : 1.94, -c.d / 2 + 0.25)); bottles.setColorAt(k, juice[k % juice.length]!) }
  bottles.computeBoundingSphere(); c.group.add(bottles)
  const barman = standing(c.group, { model: 'man2', look: { top: 0xf2efe8, bottom: 0x1a1a1f, shoes: 0x111111, skin: 0x6f4329, hair: 0x0e0c0b } }, -1.5, 0, bz - 0.8, 0)
  const barTalk = selfTalker(barman, 'club-barman')
  const menu = c.canvasTex(1024, 360, (g) => {
    g.fillStyle = '#1a1424'; g.fillRect(0, 0, 1024, 360); g.strokeStyle = '#d4af6a'; g.lineWidth = 6; g.strokeRect(8, 8, 1008, 344)
    g.fillStyle = '#f2c46a'; g.font = `800 52px ${SANS}`; g.fillText('MOCKTAILS · $3', 40, 78)
    g.fillStyle = '#f4efe2'; g.font = `500 36px ${SANS}`
    ;['Chapman (no alcohol, ever)', 'Zobo fizz with ginger', 'Mint lemonade', 'Tiger nut shake (kunu aya)', 'Virgin mango mojito', 'Coconut and lime cooler'].forEach((t, i) => g.fillText(`· ${t}`, 40 + (i % 2) * 480, 160 + Math.floor(i / 2) * 64, 460))
  })
  const mm = c.add(new THREE.PlaneGeometry(4.2, 1.48), new THREE.MeshStandardMaterial({ map: menu, emissiveMap: menu, emissive: 0xffffff, emissiveIntensity: 0.6 }), 4.4, 2.6, -c.d / 2 + 0.08, false)
  mm.castShadow = false
  const DRINKS = ['One Chapman, no alcohol, extra cucumber. Enjoy!', 'Zobo fizz coming up. Cold and spicy.', 'Mint lemonade. Fresh as the night.', 'Kunu aya, thick and sweet. Enjoy.']
  let served = 0
  c.use({ id: 'club-bar', x: -1.5, z: bz + 1.0, r: 1.6, title: 'Mocktail bar', body: 'Chapman, zobo fizz, mint lemonade, kunu. No alcohol, ever.', enter: 'Order a mocktail · $3', run: () => { const l = DRINKS[served++ % DRINKS.length]!; speak(l, { gender: 'm', seed: 31 }); sayLine('club-barman', l); barTalk.play('nod'); h.mocktail() } })
  for (const x of [-4.2, -2.6, -1.0, 0.6]) c.seat(`club-stool-${x}`, 'Bar stool', x, bz + 0.85, Math.PI, 0.72)
  // Bar stools: a gold pole, a footrest ring and a velvet seat.
  boxes(c, gold, [-4.2, -2.6, -1.0, 0.6].flatMap((x): B6[] => [[x, 0, bz + 0.85, 0.07, 0.66, 0.07], [x, 0, bz + 0.85, 0.42, 0.03, 0.42], [x, 0.28, bz + 0.85, 0.3, 0.025, 0.3]]))
  boxes(c, velvet, [-4.2, -2.6, -1.0, 0.6].map((x): B6 => [x, 0.64, bz + 0.85, 0.4, 0.09, 0.4]))
  // Lounge sofas along the south wall, and the games table.
  const sz = c.d / 2 - 1.1
  boxes(c, velvet, [[-1.0, 0, sz, 4.2, 0.45, 0.9], [-1.0, 0.45, sz + 0.38, 4.2, 0.5, 0.18], [4.6, 0, sz, 3.2, 0.45, 0.9], [4.6, 0.45, sz + 0.38, 3.2, 0.5, 0.18]])
  c.obstacles.push({ kind: 'box', x: c.ox - 1.0, z: c.oz + sz, hx: 2.15, hz: 0.5 }, { kind: 'box', x: c.ox + 4.6, z: c.oz + sz, hx: 1.65, hz: 0.5 })
  for (const x of [-2.4, -1.0, 0.4, 3.8, 5.4]) c.seat(`club-sofa-${x}`, 'Sofa', x, sz - 0.1, Math.PI, 0.45)
  boxes(c, gold, [[-1.0, 0, sz - 1.25, 1.4, 0.4, 0.7]])
  const games = c.canvasTex(512, 512, (g) => {
    // A ludo board: four coloured homes and the cross of paths.
    const cs = ['#d9534f', '#2f7a58', '#f0c419', '#3a5f8a']
    g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 512, 512)
    ;[[0, 0], [304, 0], [304, 304], [0, 304]].forEach(([x, y], i) => { g.fillStyle = cs[i]!; g.fillRect(x!, y!, 208, 208); g.fillStyle = '#fff'; g.fillRect(x! + 40, y! + 40, 128, 128) })
    g.strokeStyle = '#2a2418'; g.lineWidth = 2; for (let k = 0; k <= 15; k++) { g.beginPath(); g.moveTo(208, k * 34); g.lineTo(304, k * 34); g.stroke(); g.beginPath(); g.moveTo(k * 34, 208); g.lineTo(k * 34, 304); g.stroke() }
  })
  const tb = c.add(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: games, roughness: 0.6 }), -1.0, 0.41, sz - 1.25, false); tb.rotation.x = -Math.PI / 2
  c.use({ id: 'club-games', x: -1.0, z: sz - 2.0, r: 1.4, title: 'Games table', body: 'Ludo and ayo with whoever is sitting there.', enter: 'Play a round', run: h.games })
  const sitters: CrowdSpot[] = [{ x: 3.8, z: sz - 0.1, yaw: Math.PI }, { x: 5.4, z: sz - 0.1, yaw: Math.PI }]
  hallCrowd(c.group, sitters, ATTENDEES, { cap: Math.min(2, Math.max(1, Math.round(c.cap / 40))), seatY: 0.45 })
  // The prayer corner in the south-west: a screen, three mats and the qibla marked on the wall.
  boxes(c, c.std(0xe9e0cc, 0.8), [[-6.6, 0, c.d / 2 - 3.2, 3.6, 2.2, 0.08]])
  const mat = c.canvasTex(256, 512, (g) => {
    g.fillStyle = '#1f5a4c'; g.fillRect(0, 0, 256, 512); g.strokeStyle = '#d4af6a'; g.lineWidth = 8; g.strokeRect(14, 14, 228, 484)
    g.beginPath(); g.moveTo(40, 150); g.quadraticCurveTo(128, 40, 216, 150); g.stroke()
    g.fillStyle = 'rgba(212,175,106,0.35)'; for (let k = 0; k < 6; k++) g.fillRect(40, 220 + k * 44, 176, 10)
  })
  for (const x of [-7.8, -6.6, -5.4]) { const m = c.add(new THREE.PlaneGeometry(0.75, 1.3), new THREE.MeshStandardMaterial({ map: mat, roughness: 0.9 }), x, 0.02, c.d / 2 - 1.6, false); m.rotation.x = -Math.PI / 2; m.castShadow = false }
  sign(c, 'Prayer corner', 'z', -c.w / 2 + 0.05, c.d / 2 - 1.6, 1)
  c.use({ id: 'club-prayer', x: -6.6, z: c.d / 2 - 2.2, r: 1.4, title: 'Prayer corner', body: 'A quiet place to pray, screened from the floor.', enter: 'Rest here', run: () => c.toast('A quiet corner to pray. Prayer times are in the menu under Prayer.') })
  sign(c, 'Barakah Club', 'z', -c.w / 2 + 0.05, -2, 1)
  // A dark ceiling (seen only from below, so a camera above the room still looks in), with small lights in it.
  const lid = c.add(new THREE.PlaneGeometry(c.w, c.d), new THREE.MeshBasicMaterial({ color: 0x0d0b12 }), 0, c.H - 0.02, 0, false); lid.rotation.x = Math.PI / 2; lid.castShadow = false
  const stars = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }), 60)
  for (let k = 0; k < 60; k++) { const a = Math.sin(k * 12.9898) * 43758.5453, b2 = Math.sin(k * 78.233) * 12345.678; stars.setMatrixAt(k, m4.compose(new THREE.Vector3((a - Math.floor(a) - 0.5) * (c.w - 1), c.H - 0.04, (b2 - Math.floor(b2) - 0.5) * (c.d - 1)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1))) }
  stars.computeBoundingSphere(); c.group.add(stars)
  return () => 0
}
