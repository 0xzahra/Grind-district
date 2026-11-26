// The Grind Grand hotel (west of the city) and Grind Mall with the Grind Fresh supermarket (east of the city).
// Their towers stand in the skyline; a canopied entrance on the city's edge street takes you in. Inside they are
// areas (homes.ts): the hotel lobby with a lift to a rooftop infinity pool and sky bar over the real city; the mall
// on two floors round an atrium with escalators and a glass lift: a supermarket, fashion, tech and pharmacy
// shops (their panels), a food court and a cinema. Lazy-loaded with the homes.
import * as THREE from 'three'
import type { Hotspot } from './world.ts'
import type { Arch } from './homes.ts'
import type { TravelCtx } from './travel.ts'
import { std, put, cube, sign, tex, person } from './travel.ts'
import { spendInGame } from './state.ts'
import { adjust } from './needs.ts'
import { crownCards, foliageMaterial } from './trees.ts'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { placeGoods, stockGondola, trolley, type Placed } from './groceries.ts'
import { filmFrame, FILM_TITLE } from './film.ts'

type B6 = [number, number, number, number, number, number]
/** Many boxes ([x, y-centre, z, w, h, d]) as one mesh: shelving, trolleys and seats cost one draw each. */
const merged = (list: B6[], m: THREE.Material): THREE.Mesh => {
  const geos = list.map(([x, y, z, w, h, d]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z))
  const mesh = new THREE.Mesh(mergeGeometries(geos), m)
  for (const g of geos) g.dispose()
  mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}

export const HOTEL = { x0: -112, z0: -60, x1: -88, z1: -36, roof: 48 }
export const MALL = { x0: 84, z0: -46, x1: 124, z1: -6, up: 6 }
const buy = (X: TravelCtx, usd: number, label: string, where: string, d: Parameters<typeof adjust>[0], ok: string) => { const p = spendInGame(usd, label, where); X.toast(p.ok ? adjust(d, 'quiet') || ok : p.message) }

// ---------------------------------------------------------------- outside, in the city

/** The two buildings as seen from the city, and the entrances on the edge streets. */
export function cityVenues(scene: THREE.Scene, enter: (id: 'hotel' | 'mall') => void): Hotspot[] {
  const g = new THREE.Group(); g.name = 'venues'
  // The Grind Grand: a stone and glass tower with a crown, the pool deck lit at the top.
  // The lobby storey is its own piece (hidden while you're inside); the floors above stay, under the roof pool.
  const hotel = new THREE.Group()
  const cx = (HOTEL.x0 + HOTEL.x1) / 2, cz = (HOTEL.z0 + HOTEL.z1) / 2, w = HOTEL.x1 - HOTEL.x0
  const facade = tex(256, 512, (c) => { c.fillStyle = '#e9e2d6'; c.fillRect(0, 0, 256, 512); for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) { c.fillStyle = '#2b3a48'; c.fillRect(8 + x * 41, 10 + y * 32, 30, 22); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(8 + x * 41, 10 + y * 32, 30, 4) } }, [1, 1])
  const fm = std(0xffffff, 0.55, 0.05, { map: facade })
  // The body stops just under the roof deck's pool; a gold rim closes the top edge round it.
  cube(hotel, w, HOTEL.roof - 9.6, w, fm, cx, 8 + (HOTEL.roof - 9.6) / 2, cz)
  const lobbyShell = new THREE.Group(); lobbyShell.name = 'shell-hotel'
  cube(lobbyShell, w, 8, w, std(0x1d2a35, 0.08, 0.4, { emissive: 0x2a3a48, emissiveIntensity: 0.3 }), cx, 4, cz)
  hotel.add(lobbyShell)
  const rim = std(0xd8b25a, 0.3, 0.8)
  for (const [dx, dz, ww, dd] of [[0, -w / 2, w + 1, 0.5], [0, w / 2, w + 1, 0.5], [-w / 2, 0, 0.5, w + 1], [w / 2, 0, 0.5, w + 1]] as const) cube(hotel, ww, 2.4, dd, rim, cx + dx, HOTEL.roof - 1.0, cz + dz)
  const hs = sign('THE GRIND GRAND', 14, 2.2, { fg: '#d8b25a', weight: 900 }); hs.position.set(cx, HOTEL.roof - 3, HOTEL.z1 + 0.05); hotel.add(hs)
  g.add(hotel)
  // Grind Mall: two storeys of glass all round (as you see it from inside), lit shops behind the glass, a white
  // floor band between the storeys, a roof edge and big lettering.
  const mall = new THREE.Group(); mall.name = 'shell-mall'
  const mx = (MALL.x0 + MALL.x1) / 2, mz = (MALL.z0 + MALL.z1) / 2
  const curtain = tex(512, 512, (c) => {
    c.fillStyle = '#20384a'; c.fillRect(0, 0, 512, 512)
    for (let f = 0; f < 2; f++) {
      const y0 = f * 256
      const gl = c.createLinearGradient(0, y0, 0, y0 + 230); gl.addColorStop(0, '#5f8eab'); gl.addColorStop(0.55, '#2c4c63'); gl.addColorStop(1, '#f2d9a8')
      c.fillStyle = gl; c.fillRect(0, y0 + 12, 512, 218)
      // shops behind the glass: warm lit fronts, people-height shapes
      for (let k = 0; k < 6; k++) { c.fillStyle = ['#ffd9a0', '#c9f0d8', '#ffe8c8', '#d8e8ff', '#ffd0d8', '#f4f0c0'][(k + f) % 6]!; c.globalAlpha = 0.55; c.fillRect(8 + k * 85, y0 + 150, 70, 80); c.globalAlpha = 1 }
      c.fillStyle = '#eef0ee'; c.fillRect(0, y0 + 230, 512, 26) // floor band
    }
    c.fillStyle = '#c9d0d6'; for (let x = 0; x <= 512; x += 64) c.fillRect(x - 2, 0, 4, 512) // mullions
  }, [5, 1])
  const glassWall = std(0xffffff, 0.18, 0.35, { map: curtain, emissive: 0x334455, emissiveIntensity: 0.25 })
  cube(mall, MALL.x1 - MALL.x0, 12, MALL.z1 - MALL.z0, glassWall, mx, 6, mz)
  cube(mall, MALL.x1 - MALL.x0 + 1.2, 0.9, MALL.z1 - MALL.z0 + 1.2, std(0xeef0ee, 0.5), mx, 12.3, mz)
  cube(mall, 3.2, 0.25, 12, std(0x1d2a35, 0.3, 0.6), MALL.x0 - 1.6, 4.2, mz)
  const ms = sign('GRIND MALL', 16, 3, { fg: '#14a058', weight: 900 }); ms.position.set(MALL.x0 - 0.65, 9.4, mz); ms.rotation.y = -Math.PI / 2; mall.add(ms)
  g.add(mall)
  g.traverse((o) => { o.userData.ghost = true; o.castShadow = true })
  scene.add(g)
  // Entrances on the edge streets: a canopy, glass doors and a sign pointing the way.
  const portal = (x: number, z: number, yaw: number, title: string, colour: string) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = yaw
    cube(p, 4.2, 0.18, 2.6, std(0x1d2a35, 0.3, 0.6), 0, 3.3, 0.6)
    for (const s of [-1.9, 1.9]) cube(p, 0.14, 3.3, 0.14, std(0xc9ced4, 0.3, 0.8), s, 1.65, 1.8)
    cube(p, 3.2, 2.7, 0.06, std(0xbfd6e6, 0.05, 0.3, { transparent: true, opacity: 0.4 }), 0, 1.35, -0.4, false)
    const s = sign(title, 4, 0.6, { bg: '#0b0c0e', fg: colour, glowing: true }); s.position.set(0, 3.75, 1.92); p.add(s)
    p.traverse((o) => { o.userData.ghost = true })
    scene.add(p)
  }
  portal(-60.6, -34, Math.PI / 2, 'THE GRIND GRAND · HOTEL', '#d8b25a')
  portal(60.6, -18, -Math.PI / 2, 'GRIND MALL · SUPERMARKET', '#2bd46b')
  return [
    { id: 'venue-hotel', x: -57.6, z: -34, r: 2.2, title: 'The Grind Grand', body: 'A grand hotel: a marble lobby, suites for the night and a rooftop infinity pool and sky bar over the whole city.', enter: 'Enter the hotel', use: () => enter('hotel') },
    { id: 'venue-mall', x: 57.6, z: -18, r: 2.2, title: 'Grind Mall', body: 'Two floors of shops round a glass atrium: the Grind Fresh supermarket, fashion, tech, a pharmacy, a food court and a cinema.', enter: 'Enter the mall', use: () => enter('mall') },
  ]
}

// ---------------------------------------------------------------- the hotel

export function buildHotel(A: Arch, X: TravelCtx): void {
  const H = HOTEL, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2
  const marble = tex(256, 256, (c) => { c.fillStyle = '#f1eee8'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(150,140,130,0.35)'; c.lineWidth = 1.2; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(Math.random() * 256, 0); c.bezierCurveTo(Math.random() * 256, 90, Math.random() * 256, 170, Math.random() * 256, 256); c.stroke() } c.strokeStyle = 'rgba(0,0,0,0.12)'; c.strokeRect(0, 0, 256, 256) }, [6, 6])
  const floor = std(0xffffff, 0.15, 0, { map: marble })
  A.slab(0, { x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1 }, undefined, floor)
  A.wall(0, H.x0, H.z0, H.x0, H.z1, 7, 'glass')
  A.wall(0, H.x1, H.z0, H.x1, H.z1, 7, 'glass')
  A.wall(0, H.x0, H.z0, H.x1, H.z0, 7, std(0x3a2a20, 0.6))
  A.wall(0, H.x0, H.z1, H.x1, H.z1, 7, 'glass', [[cx - 2, cx + 2]])
  const gold = std(0xd8b25a, 0.3, 0.85), walnut = std(0x5a3a22, 0.45), cream = std(0xe9e1d2, 0.8)
  const g = new THREE.Group(); A.add(0, g)
  // Reception, a chandelier, lounge sofas round a rug, a grand piano, palms in planters.
  cube(g, 6, 1.1, 1.0, walnut, cx, 0.55, H.z0 + 3.2); cube(g, 6.1, 0.06, 1.1, gold, cx, 1.12, H.z0 + 3.2, false)
  const rs = sign('RECEPTION', 4, 0.6, { fg: '#d8b25a', weight: 800 }); rs.position.set(cx, 3.2, H.z0 + 0.2); g.add(rs)
  A.block(0, { x0: cx - 3, z0: H.z0 + 2.6, x1: cx + 3, z1: H.z0 + 3.8 })
  const clerk = person('woman2', { pose: 'stand', height: 1.68, look: { top: 0x1d2a35, bottom: 0x1d2a35, shoes: 0x111111 } }); clerk.position.set(cx, 0, H.z0 + 2.2); A.add(0, clerk)
  const chand = new THREE.Group(); chand.position.set(cx, 5.6, cz)
  for (let k = 0; k < 3; k++) put(chand, new THREE.TorusGeometry(0.6 + k * 0.35, 0.03, 6, 32), gold, 0, -k * 0.35, 0).rotation.x = Math.PI / 2
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; put(chand, new THREE.SphereGeometry(0.07, 8, 6), std(0xffffff, 0.05, 0, { emissive: 0xfff0c8, emissiveIntensity: 0.9 }), Math.cos(a) * 1.0, -0.4, Math.sin(a) * 1.0, false) }
  A.add(0, chand)
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), std(0x6b2230, 0.95)); rug.rotation.x = -Math.PI / 2; rug.position.set(cx, 0.02, cz + 3); A.add(0, rug)
  for (const [dx, dz, r] of [[0, 1.2, 0], [-2.6, 3.4, Math.PI / 2], [2.6, 3.4, -Math.PI / 2]] as const) { const s = new THREE.Group(); cube(s, 2.6, 0.45, 0.9, cream, 0, 0.22, 0); cube(s, 2.6, 0.55, 0.22, cream, 0, 0.6, -0.4); s.position.set(cx + dx, 0, cz + dz); s.rotation.y = r; A.add(0, s); A.block(0, { x0: cx + dx - 1.3, z0: cz + dz - 0.5, x1: cx + dx + 1.3, z1: cz + dz + 0.5 }) }
  cube(g, 1.4, 0.4, 0.8, walnut, cx, 0.2, cz + 3.4)
  { const pi = new THREE.Group(); cube(pi, 1.5, 0.35, 2.0, std(0x0d0e10, 0.15, 0.3), 0, 0.9, 0); cube(pi, 1.5, 0.08, 0.3, std(0xf4f4f2, 0.3), 0, 1.1, 0.95); for (const [x, z] of [[-0.6, 0.8], [0.6, 0.8], [0, -0.8]] as const) cube(pi, 0.1, 0.75, 0.1, std(0x0d0e10, 0.2), x, 0.37, z); pi.position.set(H.x0 + 4, 0, cz + 4); A.add(0, pi); A.block(0, { x0: H.x0 + 3.2, z0: cz + 3, x1: H.x0 + 4.8, z1: cz + 5 }) }
  for (const [x, z] of [[H.x0 + 1.5, H.z1 - 1.5], [H.x1 - 1.5, H.z1 - 1.5], [H.x0 + 1.5, H.z0 + 1.5], [H.x1 - 1.5, H.z0 + 1.5]] as const) { cube(g, 0.9, 0.8, 0.9, std(0x2b2e33, 0.5), x, 0.4, z); put(g, new THREE.ConeGeometry(0.9, 2.2, 7), std(0x3f6b33, 0.8), x, 1.9, z) }
  A.use(0, { id: 'hotel-desk', x: cx, z: H.z0 + 4.6, r: 1.8, title: 'Reception', body: 'A suite for the night: a king bed, a rain shower and breakfast. You wake up rested and fresh.', enter: 'Book a suite tonight · $120', use: () => { const p = spendInGame(120, 'The Grind Grand, one night', 'Suite, breakfast included'); if (!p.ok) { X.toast(p.message); return } X.fade(); X.toast(adjust({ energy: 100, hygiene: 40, hunger: 25 }, 'quiet') || 'A deep sleep in a cloud of a bed. Good morning.') } })
  A.use(0, { id: 'home-exit', x: cx, z: H.z1 - 1.2, r: 1.6, title: 'The Grind Grand', body: 'Back out to the street.', enter: 'Leave the hotel', use: () => X.leave() })
  // The rooftop: an infinity pool along the city side, loungers, a sky bar, a glass rail.
  const R0 = A.lv[1]!.y
  const poolR = { x0: H.x0 + 2, z0: H.z1 - 7, x1: H.x1 - 2, z1: H.z1 - 1 }
  A.slab(1, { x0: H.x0, z0: H.z0, x1: H.x1, z1: H.z1 }, poolR, A.M.floor(H.x1 - H.x0, H.z1 - H.z0))
  A.pool(1, poolR, 'z1')
  for (const [x0, z0, x1, z1] of [[H.x0, H.z0, H.x1, H.z0], [H.x0, H.z0, H.x0, H.z1], [H.x1, H.z0, H.x1, H.z1], [H.x0, H.z1, H.x1, H.z1]] as const) A.rail(1, x0, z0, x1, z1)
  const top = new THREE.Group(); A.add(1, top)
  for (let k = 0; k < 6; k++) { const l = new THREE.Group(); cube(l, 0.7, 0.3, 1.8, std(0xf4f4f2, 0.6), 0, 0.3, 0); const b = cube(l, 0.7, 0.5, 0.1, std(0xf4f4f2, 0.6), 0, 0.55, -0.85); b.rotation.x = -0.5; l.position.set(H.x0 + 3 + k * 3.4, R0 + 0, H.z1 - 9.2); l.rotation.y = Math.PI; top.add(l) }
  cube(top, 5, 1.1, 1.0, walnut, cx, R0 + 0.55, H.z0 + 3)
  cube(top, 5.1, 0.06, 1.1, gold, cx, R0 + 1.12, H.z0 + 3, false)
  for (let k = 0; k < 8; k++) put(top, new THREE.CylinderGeometry(0.05, 0.06, 0.32, 10), std([0x7ad3ff, 0xffd36b, 0xff7ab5, 0x9cff8a][k % 4]!, 0.1, 0.2, { emissive: [0x7ad3ff, 0xffd36b, 0xff7ab5, 0x9cff8a][k % 4]!, emissiveIntensity: 0.5 }), cx - 2 + k * 0.55, R0 + 1.3, H.z0 + 2.7, false)
  const bs = sign('SKY BAR', 3, 0.6, { fg: '#d8b25a', weight: 900 }); bs.position.set(cx, R0 + 2.6, H.z0 + 2.5); top.add(bs)
  A.block(1, { x0: cx - 2.5, z0: H.z0 + 2.4, x1: cx + 2.5, z1: H.z0 + 3.6 })
  A.use(1, { id: 'hotel-bar', x: cx, z: H.z0 + 4.4, r: 1.8, title: 'Sky bar', body: 'A mocktail with the whole city at your feet.', enter: 'Order a mocktail · $8', use: () => buy(X, 8, 'Sky bar mocktail', 'The Grind Grand', { social: 10, hunger: 4 }, 'Cheers to the view.') })
  // The lift between the lobby and the roof.
  A.lift(H.x1 - 3, H.z0 + 6, [0, 1], (from) => (from === 0 ? 'Lift to the rooftop pool' : 'Lift down to the lobby'))
}

// ---------------------------------------------------------------- the mall

export function buildMall(A: Arch, X: TravelCtx): void {
  const M = MALL, up = M.up
  const atrium = { x0: 96, z0: -34, x1: 108.5, z1: -18 }
  const tiles = tex(256, 256, (c) => { c.fillStyle = '#ece9e3'; c.fillRect(0, 0, 256, 256); c.strokeStyle = 'rgba(120,115,105,0.3)'; c.lineWidth = 2; for (let i = 0; i <= 256; i += 128) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke() } }, [10, 10])
  const floor = std(0xffffff, 0.2, 0, { map: tiles })
  A.slab(0, { x0: M.x0, z0: M.z0, x1: M.x1, z1: M.z1 }, undefined, floor)
  A.slab(1, { x0: M.x0, z0: M.z0, x1: M.x1, z1: M.z1 }, atrium, floor)
  for (const l of [0, 1]) {
    A.wall(l, M.x0, M.z0, M.x0, M.z1, 6, 'glass', l === 0 ? [[-28, -24]] : [])
    A.wall(l, M.x1, M.z0, M.x1, M.z1, 6, 'glass')
    A.wall(l, M.x0, M.z0, M.x1, M.z0, 6, 'glass')
    A.wall(l, M.x0, M.z1, M.x1, M.z1, 6, 'glass')
  }
  // A glass rail round the atrium, open where the escalator arrives.
  for (const [x0, z0, x1, z1] of [[atrium.x0, atrium.z0, atrium.x1, atrium.z0], [atrium.x0, atrium.z1, 97.6, atrium.z1], [100.4, atrium.z1, atrium.x1, atrium.z1], [atrium.x0, atrium.z0, atrium.x0, atrium.z1], [atrium.x1, atrium.z0, atrium.x1, atrium.z1]] as const) A.rail(1, x0, z0, x1, z1)
  A.block(1, { x0: atrium.x0, z0: atrium.z0, x1: atrium.x1, z1: atrium.z1 })
  // A fountain and a tree under the atrium, escalators up and a glass lift.
  const g0 = new THREE.Group(); A.add(0, g0)
  put(g0, new THREE.CylinderGeometry(2.4, 2.6, 0.5, 28), std(0xd8d1c3, 0.6), 104, 0.25, -26)
  put(g0, new THREE.CircleGeometry(2.2, 28).rotateX(-Math.PI / 2), std(0x2b9fc0, 0.05, 0.1), 104, 0.52, -26)
  put(g0, new THREE.CylinderGeometry(0.2, 0.3, 4, 8), std(0x6b4c32, 0.9), 104, 2.5, -26)
  put(g0, crownCards(2.5, 0, 61, 22), foliageMaterial(), 104, 5.2, -26)
  A.block(0, { x0: 101.4, z0: -28.6, x1: 106.6, z1: -23.4 })
  A.ride('esc', { x: 99, z: -30 }, { x: 99, z: -17 }, 0, 1)
  A.lift(113.5, -35.5, [0, 1], (from) => (from === 0 ? 'Glass lift up' : 'Glass lift down'))
  // Shopfronts: a lit sign over a glass front, a counter, and what it sells.
  const shop = (l: number, x0: number, z0: number, x1: number, z1: number, name: string, colour: string, u: Omit<Hotspot, 'x' | 'z' | 'r'>, face: 'x0' | 'x1' | 'z1') => {
    const y = A.lv[l]!.y
    const g = new THREE.Group(); A.add(l, g)
    const fx = face === 'x0' ? x0 : face === 'x1' ? x1 : (x0 + x1) / 2, fz = face === 'z1' ? z1 : (z0 + z1) / 2
    const s = sign(name, 4.6, 0.7, { bg: '#0b0c0e', fg: colour, glowing: true }); s.position.set(fx + (face === 'x0' ? -0.05 : face === 'x1' ? 0.05 : 0), y + 4.4, fz + (face === 'z1' ? 0.05 : 0)); s.rotation.y = face === 'x0' ? -Math.PI / 2 : face === 'x1' ? Math.PI / 2 : 0; g.add(s)
    const floorTint = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std(0xd9d4ca, 0.5)); floorTint.rotation.x = -Math.PI / 2; floorTint.position.set((x0 + x1) / 2, y + 0.01, (z0 + z1) / 2); g.add(floorTint)
    const ux = face === 'x0' ? x0 - 1.2 : face === 'x1' ? x1 + 1.2 : (x0 + x1) / 2, uz = face === 'z1' ? z1 + 1.2 : (z0 + z1) / 2
    A.use(l, { ...u, x: ux, z: uz, r: 1.8 } as Hotspot)
    return g
  }
  // Ground floor: Grind Fresh supermarket along the back; fashion, tech and a pharmacy down the east side.
  {
    const S = { x0: 86, z0: -45, x1: 122, z1: -37 }
    const sg = shop(0, S.x0, S.z0, S.x1, S.z1, 'GRIND FRESH · SUPERMARKET', '#2bd46b', { id: 'mall-shop', title: 'Grind Fresh', body: 'A weekly shop: bread, rice, fruit and veg, milk, eggs, chicken and the rest. It keeps you fed for days.', enter: 'Weekly shop · $45', use: () => buy(X, 45, 'Grind Fresh weekly shop', 'Grind Mall', { hunger: 60, energy: 10 }, 'Bags full. The fridge is stocked.') }, 'z1')
    // Aisles: gondola shelving stocked with real-looking products (cereal, tins, oil, milk, rice, jam), one shelf
    // run per product as shops stock them; trolleys with shopping in them in the aisles and by the tills.
    const mm = new THREE.Matrix4(), col = new THREE.Color()
    const frame: B6[] = [], goods: Placed[] = [], carts: B6[] = [], castors: Array<[number, number, number]> = []
    for (let k = 0; k < 5; k++) {
      const x = 90 + k * 6
      goods.push(...stockGondola({ x, z: S.z0 + 3.8, len: 4.6, along: 'z', seed: k }, frame))
      A.block(0, { x0: x - 0.6, z0: S.z0 + 1.4, x1: x + 0.6, z1: S.z0 + 6.2 })
    }
    // aisle signs hanging over each gondola
    ;['Breakfast', 'Tins & jars', 'Cooking oil', 'Dairy', 'Rice & grains'].forEach((t, k) => { const a = sign(t, 2.2, 0.42, { bg: '#14a058', fg: '#ffffff' }); a.position.set(90 + k * 6, 3.0, S.z0 + 3.8); a.rotation.y = Math.PI / 2; sg.add(a) })
    for (const [x, z, yaw, seed] of [[93, S.z0 + 4.2, 0, 1], [99.2, S.z0 + 2.6, Math.PI, 2], [104.6, S.z1 + 1.8, Math.PI / 2, 3], [109.5, S.z1 + 1.6, -Math.PI / 2, 4], [87.6, S.z1 + 2.4, 0, 5], [88.4, S.z1 + 2.4, 0, 0]] as const) {
      goods.push(...trolley(x, z, yaw, seed, carts, castors))
      A.block(0, { x0: x - 0.45, z0: z - 0.5, x1: x + 0.45, z1: z + 0.5 })
    }
    sg.add(merged(frame, std(0xf2f2ee, 0.5)), merged(carts, std(0xb9c2c9, 0.3, 0.85)))
    const wheelsIm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10).rotateZ(Math.PI / 2), std(0x1a1a1a, 0.6), castors.length)
    castors.forEach(([x, y, z], i) => wheelsIm.setMatrixAt(i, mm.makeTranslation(x, y, z)))
    sg.add(wheelsIm)
    placeGoods(goods, sg)
    for (let k = 0; k < 4; k++) cube(sg, 2.2, 2.2, 0.8, std(0x0b1220, 0.1, 0.3, { emissive: 0x7ad3ff, emissiveIntensity: 0.35 }), 87.6 + k * 2.4, 1.1, S.z0 + 0.5)
    const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), std(0xffffff, 0.6), 160)
    for (let i = 0; i < 160; i++) { fruit.setMatrixAt(i, mm.makeTranslation(117 + (i % 16) * 0.18, 0.95 + Math.floor(i / 80) * 0.05, S.z0 + 2 + Math.floor((i % 80) / 16) * 0.3)); fruit.setColorAt(i, col.setHex([0xd63c3c, 0xf2c230, 0x6aa84f, 0xff8c1a][i % 4]!)) }
    sg.add(fruit)
    cube(sg, 3.2, 0.8, 1.8, std(0x8a6a48, 0.8), 118.4, 0.4, S.z0 + 2.6)
    A.block(0, { x0: 116.6, z0: S.z0 + 1.6, x1: 120.2, z1: S.z0 + 3.6 })
    A.use(0, { id: 'mall-fruit', x: 118.4, z: S.z0 + 4.6, r: 1.6, title: 'Fruit and veg', body: 'Mangoes, oranges, bananas, tomatoes and peppers.', enter: 'Fresh fruit and veg · $9', use: () => buy(X, 9, 'Fresh fruit and veg', 'Grind Fresh', { hunger: 20, energy: 6 }, 'Fresh and sweet.') })
    for (const x of [100, 106, 112]) { cube(sg, 1.8, 0.95, 0.8, std(0x2b2e33, 0.4), x, 0.47, S.z1 - 0.6); cube(sg, 0.4, 0.3, 0.05, std(0x0b1220, 0.25, 0, { emissive: 0x2a5c8a, emissiveIntensity: 0.8 }), x - 0.5, 1.15, S.z1 - 0.6, false); A.block(0, { x0: x - 0.9, z0: S.z1 - 1.0, x1: x + 0.9, z1: S.z1 - 0.2 }) }
    const cashier = person('woman3', { pose: 'stand', height: 1.68, look: { top: 0x14a058, bottom: 0x1c1f26, shoes: 0x111111 } }); cashier.position.set(106, 0, S.z1 - 1.4); A.add(0, cashier)
    for (const [x, z] of [[92, -34], [94, -33]] as const) { const t = new THREE.Group(); cube(t, 0.6, 0.5, 0.9, std(0xc9ced4, 0.3, 0.8), 0, 0.7, 0); for (const [dx, dz] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]] as const) put(t, new THREE.SphereGeometry(0.06, 6, 4), std(0x1a1a1a, 0.6), dx, 0.06, dz); t.position.set(x, 0, z); A.add(0, t) }
  }
  shop(0, 116, -34, 123, -27, 'ATELIER · FASHION', '#ffd36b', { id: 'mall-fashion', title: 'Atelier', body: 'The latest looks: the full boutique.', enter: 'Browse fashion', action: 'boutique' }, 'x0')
  shop(0, 116, -26, 123, -19, 'GRIND TECH', '#7ad3ff', { id: 'mall-tech', title: 'Grind Tech', body: 'Phones, laptops and gadgets.', enter: 'Browse tech', action: 'gadgets' }, 'x0')
  shop(0, 116, -18, 123, -11, 'PHARMACY', '#2bd46b', { id: 'mall-pharmacy', title: 'Pharmacy', body: 'Medicine, vitamins and skin care.', enter: 'Pharmacy', action: 'pharmacy' }, 'x0')
  // Upper floor: food court and cinema.
  {
    const y = up
    const fc = new THREE.Group(); A.add(1, fc)
    const fs = sign('FOOD COURT', 5, 0.8, { bg: '#0b0c0e', fg: '#ff8c1a', glowing: true }); fs.position.set(104, y + 4.6, M.z0 + 0.3); fc.add(fs)
    const stalls: Array<[number, string, string, number, Parameters<typeof adjust>[0]]> = [[90, 'JOLLOF & SUYA', 'Jollof rice with suya · $12', 12, { hunger: 45, social: 4 }], [100, 'NOODLE BAR', 'A bowl of ramen · $11', 11, { hunger: 40 }], [110, 'BURGER JOINT', 'Burger and fries · $10', 10, { hunger: 40, energy: 4 }], [120, 'SMOOTHIES', 'A fruit smoothie · $6', 6, { hunger: 15, energy: 10 }]]
    for (const [x, name, enter, usd, d] of stalls) {
      cube(fc, 6.5, 1.1, 1.2, std(0x2b2e33, 0.4), x, y + 0.55, M.z0 + 2.2)
      const s = sign(name, 4, 0.55, { bg: '#1a1a1a', fg: '#ffffff' }); s.position.set(x, y + 2.8, M.z0 + 1.2); fc.add(s)
      A.block(1, { x0: x - 3.25, z0: M.z0 + 1.5, x1: x + 3.25, z1: M.z0 + 2.9 })
      A.use(1, { id: `mall-food-${x}`, x, z: M.z0 + 3.9, r: 1.6, title: name.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()), body: 'Food court, upstairs.', enter, use: () => buy(X, usd, name, 'Grind Mall food court', d, 'Delicious.') })
    }
    for (let k = 0; k < 6; k++) { const x = 88 + k * 6; put(fc, new THREE.CylinderGeometry(0.6, 0.6, 0.05, 18), std(0xf4f4f2, 0.3), x, y + 0.75, M.z0 + 7.5); put(fc, new THREE.CylinderGeometry(0.06, 0.08, 0.75, 8), std(0x9aa3ab, 0.3, 0.8), x, y + 0.37, M.z0 + 7.5) }
    // Cinema: a dark room with a big glowing screen and rows of red seats.
    const C = { x0: 113, z0: -32, x1: 123, z1: -8 }
    const cin = new THREE.Group(); A.add(1, cin)
    A.wall(1, C.x0, C.z0, C.x0, C.z1, 5, std(0x1a1014, 0.8), [[-22, -19]])
    cube(cin, C.x1 - C.x0, 0.02, C.z1 - C.z0, std(0x2a1418, 0.9), (C.x0 + C.x1) / 2, y + 0.02, (C.z0 + C.z1) / 2, false)
    // The film: an original short, drawn frame by frame onto the screen (film.ts), twelve frames a second.
    const filmC = document.createElement('canvas'); filmC.width = 512; filmC.height = 216
    const filmG = filmC.getContext('2d')!
    const filmT = new THREE.CanvasTexture(filmC); filmT.colorSpace = THREE.SRGBColorSpace
    filmFrame(filmG, 0)
    const screenM = new THREE.MeshBasicMaterial({ map: filmT, toneMapped: false })
    const screen = put(cin, new THREE.PlaneGeometry(14, 5.9), screenM, C.x1 - 0.3, y + 3.0, -20, false); screen.rotation.y = -Math.PI / 2
    // six rows of ten seats with an aisle down the middle, each row a step higher (merged: two draws in all)
    const seatsB: B6[] = [], steps: B6[] = []
    for (let r = 0; r < 6; r++) {
      const x = C.x0 + 1.6 + r * 1.15, lift = Math.max(0, 5 - r) * 0.16
      steps.push([x, y + lift / 2, -20, 1.15, lift || 0.01, 14])
      for (let k = 0; k < 10; k++) { const z = -26 + k * 1.0 + (k >= 5 ? 1.2 : 0); seatsB.push([x, y + lift + 0.23, z, 0.58, 0.45, 0.62], [x - 0.3, y + lift + 0.62, z, 0.12, 0.8, 0.62]) }
    }
    cin.add(merged(steps.filter((b) => b[4] > 0.02), std(0x3a1a20, 0.9)), merged(seatsB, std(0x9e1b2b, 0.8)))
    A.block(1, { x0: C.x0 + 1.2, z0: -26.4, x1: C.x0 + 8.2, z1: -21.3 })
    A.block(1, { x0: C.x0 + 1.2, z0: -19.9, x1: C.x0 + 8.2, z1: -14.6 })
    const cs = sign('GRIND CINEMA', 4.4, 0.7, { bg: '#0b0c0e', fg: '#ff2b55', glowing: true }); cs.position.set(C.x0 - 0.06, y + 4.2, -20.5); cs.rotation.y = -Math.PI / 2; cin.add(cs)
    // the poster outside: what is showing
    const poster = tex(256, 384, (c) => { filmFrame(c as CanvasRenderingContext2D, 6.5, 256, 384); c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 280, 256, 104); c.fillStyle = '#ffd36b'; c.font = '900 30px Inter, sans-serif'; c.textAlign = 'center'; c.fillText(FILM_TITLE.toUpperCase(), 128, 322); c.fillStyle = '#fff'; c.font = '600 16px Inter, sans-serif'; c.fillText('Now showing · Screen 1', 128, 352) })
    for (const pz of [-24.2, -16.8]) { const pm = put(cin, new THREE.PlaneGeometry(1.3, 1.95), std(0xffffff, 0.5, 0, { map: poster, emissive: 0xffffff, emissiveMap: poster, emissiveIntensity: 0.35 }), C.x0 - 0.06, y + 1.6, pz, false); pm.rotation.y = -Math.PI / 2 }
    let lastFrame = -1
    X.animate((t) => { const f = Math.floor(t * 12); if (f !== lastFrame) { lastFrame = f; filmFrame(filmG, t); filmT.needsUpdate = true } })
    const seat = { x: C.x0 + 1.6 + 3 * 1.15, z: -22.0 }
    A.use(1, { id: 'mall-cinema', x: C.x0 - 1.3, z: -20.5, r: 1.8, title: 'Grind Cinema', body: `Today: "${FILM_TITLE}", a short thriller in the city. Popcorn included.`, enter: 'Watch a film · $12', use: () => {
      const p = spendInGame(12, 'Grind Cinema ticket', `"${FILM_TITLE}"`)
      if (!p.ok) { X.toast(p.message); return }
      X.toast('Lights down. Popcorn in hand.')
      X.startMove({ from: { x: seat.x, z: seat.z, y }, to: { x: seat.x, z: seat.z, y }, t: 0, dur: 36, toLv: 1, path: () => ({ x: seat.x, z: seat.z, y }), seat: () => ({ yaw: Math.PI / 2, y: 0.45 + 0.32 }), cam: 3.4, view: () => ({ heading: Math.PI / 2, pitch: 0.18 }), done: () => X.toast(adjust({ social: 14, energy: 8 }, 'quiet') || 'What a twist at the end.'), exit: { x: C.x0 - 1.3, z: -20.5 } })
    } })
  }
  // A few shoppers, and the way out.
  for (const [x, z, r, m] of [[100, -14, 2.6, 'woman1'], [92, -22, 0.4, 'man2'], [114, -12, -1.2, 'woman4']] as const) { const p = person(m, { pose: 'stand', height: m.startsWith('w') ? 1.66 : 1.78 }); p.position.set(x, 0, z); p.rotation.y = r; A.add(0, p) }
  A.use(0, { id: 'home-exit', x: M.x0 + 1.4, z: -26, r: 1.6, title: 'Grind Mall', body: 'Back out to the street.', enter: 'Leave the mall', use: () => X.leave() })
}
