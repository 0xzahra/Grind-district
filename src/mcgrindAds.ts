// McGrind's ad campaign round the city, in Web3 humour for the people who live it: billboards on posts facing the
// road arms, an ad panel on each bus shelter, A-frame boards outside McGrind and the market, and posters on
// McGrind's side walls and the market gate. Every poster is a cell of one painted sheet (one texture), all the
// faces are one mesh and all the frames and posts another, so the whole campaign is two draw calls.
// Original lines and art; the McGrind mark is the game's own.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Obstacle } from './physics.ts'
import type { Graphics } from './logic.ts'
import { drawMcGrindMark, MCGRIND_BRIGHT, MCGRIND_GREEN } from './brandFronts.ts'
import type { Flyer } from './posters.ts'

const FONT = '"Inter Variable", Inter, system-ui, sans-serif'
const DISPLAY = '"Archivo Black", "Inter Variable", Inter, system-ui, sans-serif'

// Portrait posters: [headline, line, small print]. Landscape billboards: [headline, line].
const POSTERS: Array<[string, string, string]> = [
  ['BEAR MARKET?', "We're hiring.", 'Flip burgers, not your bags. Day and night shifts.'],
  ['GM. FRIES?', 'Open day and night.', 'Burgers · shawarma · shakes · boba'],
  ['WAGMI*', "*We're All Gonna Make It (fries)", 'Paid every shift. Tips for speed.'],
  ['NO SEED PHRASE NEEDED', 'Just show up and cook.', 'The McGrind kitchen is hiring.'],
  ['STACK WHILE YOU WAIT', 'Save from every shift.', 'Invest when the bull comes back.'],
  ['GOT RUGGED?', 'Get hired.', 'Shifts by the Campus café, all day, all night.'],
]
// What each one says when it is shared (posters.ts flyerCaption adds the rest).
// Each leads with what it is (a stranger reading it cold learns they can work a shift in the game), then the joke.
const HIRE = 'You can now get hired at McGrind, a 3D city job that pays per shift and tips for speed'
const POSTER_CAPTIONS = [
  `${HIRE} 🍔 Bear market? Flip burgers, not your bags.`,
  'McGrind is open day and night in Grind District, a free 3D city: grab a meal or work a paid shift 🍟 GM. Fries?',
  `${HIRE} 🍟 WAGMI: We're All Gonna Make It (fries).`,
  `${HIRE} 🍔 No seed phrase needed. Just show up and cook.`,
  'Work shifts at McGrind, a 3D city job that pays per shift and tips for speed 💰 Stack while you wait, invest when the bull comes back.',
  `${HIRE} 🍔 Got rugged? Get hired.`,
]
const BILLBOARD_CAPTIONS = [
  `${HIRE} 🍔 Bear market? Flip burgers, not your bags.`,
  'Work a shift at McGrind, a 3D city job that pays per shift and tips for speed 🍔 Wen bull run? Wen lunch.',
]
const BILLBOARDS: Array<[string, string]> = [
  ['Bear market? McGrind is hiring.', 'Flip burgers, not your bags · Paid every shift · By the Campus café'],
  ['Wen bull run? Wen lunch.', 'Work a shift at McGrind, stack your pay, invest when the market turns.'],
]

const wrapText = (g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) => {
  const words = text.split(' '); let line = '', yy = y
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh } else line = t }
  if (line) g.fillText(line, x, yy)
  return yy
}
/** One portrait poster, 256 x 384 units, with its top-left corner at (x, y). */
function paintPoster(g: CanvasRenderingContext2D, i: number, x: number, y: number): void {
  const [head, line, small] = POSTERS[i % POSTERS.length]!
  g.save(); g.beginPath(); g.rect(x, y, 256, 384); g.clip()
  const bg = g.createLinearGradient(x, y, x, y + 384); bg.addColorStop(0, i % 2 ? '#0b5c36' : MCGRIND_GREEN); bg.addColorStop(1, '#063a22'); g.fillStyle = bg; g.fillRect(x, y, 256, 384)
  g.fillStyle = 'rgba(23,247,144,0.08)'; for (let k = 0; k < 12; k++) g.fillRect(x - 60 + k * 36, y, 14, 384)
  drawMcGrindMark(g, x + 16, y + 16, 56)
  g.fillStyle = '#ffffff'; g.font = `800 16px ${FONT}`; g.fillText('McGrind', x + 80, y + 40); g.fillStyle = MCGRIND_BRIGHT; g.font = `700 11px ${FONT}`; g.fillText('NOW HIRING', x + 80, y + 60)
  g.fillStyle = '#ffffff'; g.font = `400 ${head.length > 14 ? 30 : 38}px ${DISPLAY}`; g.textBaseline = 'top'
  const yHead = wrapText(g, head, x + 16, y + 100, 224, head.length > 14 ? 34 : 42)
  g.fillStyle = '#ffe3a3'; g.font = `700 20px ${FONT}`
  const yLine = wrapText(g, line, x + 16, yHead + 56, 224, 24)
  g.fillStyle = 'rgba(255,255,255,0.82)'; g.font = `500 14px ${FONT}`
  wrapText(g, small, x + 16, yLine + 40, 224, 18)
  g.fillStyle = MCGRIND_BRIGHT; g.fillRect(x, y + 344, 256, 40)
  g.fillStyle = '#04110a'; g.font = `800 14px ${FONT}`; g.textBaseline = 'middle'; g.fillText('Work a shift · by the Campus café', x + 14, y + 364, 230)
  g.textBaseline = 'alphabetic'
  g.restore()
}
/** One billboard, 512 x 256 units, with its top-left corner at (x, y). */
function paintBillboard(g: CanvasRenderingContext2D, i: number, x: number, y: number): void {
  const [head, line] = BILLBOARDS[i % BILLBOARDS.length]!
  g.save(); g.beginPath(); g.rect(x, y, 512, 256); g.clip()
  const bg = g.createLinearGradient(x, y, x + 512, y + 256); bg.addColorStop(0, MCGRIND_GREEN); bg.addColorStop(1, '#052e1b'); g.fillStyle = bg; g.fillRect(x, y, 512, 256)
  drawMcGrindMark(g, x + 22, y + 22, 112)
  g.fillStyle = '#ffffff'; g.font = `400 34px ${DISPLAY}`; g.textBaseline = 'top'
  const yy = wrapText(g, head, x + 150, y + 30, 340, 38)
  g.fillStyle = '#ffe3a3'; g.font = `600 17px ${FONT}`
  wrapText(g, line, x + 150, yy + 50, 340, 21)
  g.fillStyle = MCGRIND_BRIGHT; g.fillRect(x, y + 222, 512, 34)
  g.fillStyle = '#04110a'; g.font = `800 16px ${FONT}`; g.textBaseline = 'middle'; g.fillText('McGRIND · OPEN DAY AND NIGHT · NOW HIRING', x + 22, y + 240, 470)
  g.textBaseline = 'alphabetic'
  g.restore()
}

/** Paint the sheet: six portrait posters (256 x 384 each) and two billboards (512 x 256), in 1024 units. */
function paintSheet(g: CanvasRenderingContext2D): void {
  POSTERS.forEach((_, i) => paintPoster(g, i, (i % 3) * 256, Math.floor(i / 3) * 384))
  BILLBOARDS.forEach((_, i) => paintBillboard(g, i, i * 512, 768))
}

/** Every McGrind poster and billboard as a shareable flyer (see posters.ts). Ids are stable: links use them. */
export const MCGRIND_FLYERS: Flyer[] = [
  ...POSTERS.map(([head, line], i): Flyer => ({ id: `mcgrind-${i + 1}`, title: `McGrind: ${head.replace(/\*$/, '')}`, text: `${head} ${line}`.replace('*', ''), caption: POSTER_CAPTIONS[i] ?? `${head} ${line}`, w: 256, h: 384, paint: (g) => paintPoster(g, i, 0, 0) })),
  ...BILLBOARDS.map(([head, line], i): Flyer => ({ id: `mcgrind-billboard-${i + 1}`, title: `McGrind: ${head}`, text: `${head} ${line}`, caption: BILLBOARD_CAPTIONS[i] ?? `${head} ${line}`, w: 512, h: 256, paint: (g) => paintBillboard(g, i, 0, 0) })),
]
const flyerFor = (cell: Face['cell']): string => cell[1] >= 768 ? `mcgrind-billboard-${cell[0] / 512 + 1}` : `mcgrind-${(cell[0] / 256) + 3 * (cell[1] / 384) + 1}`

type Face = { w: number; h: number; x: number; y: number; z: number; ry: number; rx?: number; cell: [number, number, number, number] }
const portrait = (i: number): Face['cell'] => { const x = (i % 3) * 256, y = Math.floor(i / 3) * 384; return [x, y, x + 256, y + 384] }
const landscape = (i: number): Face['cell'] => [i * 512, 768, i * 512 + 512, 1024]

/** Where a poster can be shared from: a step in front of it, and which flyer it shows. */
export type FlyerSpot = { flyer: string; x: number; z: number }

export function createMcGrindAds(scene: THREE.Scene, o: { obstacles: Obstacle[]; graphics: Graphics }): FlyerSpot[] {
  const free = (x: number, z: number, hx: number, hz: number) => o.obstacles.every((b) => b.kind === 'circle'
    ? Math.abs(x - b.x) > hx + b.r + 0.2 || Math.abs(z - b.z) > hz + b.r + 0.2
    : Math.abs(x - b.x) > hx + b.hx + 0.2 || Math.abs(z - b.z) > hz + b.hz + 0.2)
  const has = (x: number, z: number) => o.obstacles.some((b) => b.kind === 'box' && Math.abs(b.x - x) < 0.3 && Math.abs(b.z - z) < 0.3)
  const faces: Face[] = []
  const frames: THREE.BufferGeometry[] = []
  const frame = (geo: THREE.BufferGeometry) => frames.push(geo)
  // Turn a local (lx, lz) offset by yaw and add it to (x, z).
  const at = (x: number, z: number, ry: number, lx: number, lz: number) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)] as const

  // Billboards on two posts, set back from the four road arms, facing the traffic.
  const spots: Array<[number, number, number]> = [[-29, -7.6, 0], [-29, 7.6, Math.PI], [29, -7.6, 0], [-7.6, -27, Math.PI / 2], [7.6, -27, -Math.PI / 2], [-7.6, 28, Math.PI / 2], [7.6, 28, -Math.PI / 2]]
  let boards = 0
  for (const [x, z, ry] of spots) {
    if (boards >= 4) break
    const along = Math.abs(Math.sin(ry)) > 0.5
    if (!free(x, z, along ? 0.4 : 3.2, along ? 3.2 : 0.4)) continue
    // The frame spans local z -0.10 .. +0.02: one face just in front of it, the other just behind.
    const front = at(x, z, ry, 0, 0.035)
    faces.push({ w: 5.6, h: 2.8, x: front[0], y: 4.0, z: front[1], ry, cell: landscape(boards % 2) })
    const back = at(x, z, ry, 0, -0.115)
    faces.push({ w: 5.6, h: 2.8, x: back[0], y: 4.0, z: back[1], ry: ry + Math.PI, cell: landscape((boards + 1) % 2) })
    const [fx, fz] = at(x, z, ry, 0, -0.04)
    frame(new THREE.BoxGeometry(5.9, 3.1, 0.12).rotateY(ry).translate(fx, 4.0, fz))
    for (const s of [-1.9, 1.9]) { const [px, pz] = at(x, z, ry, s, -0.04); frame(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 8).translate(px, 1.3, pz)); o.obstacles.push({ kind: 'circle', x: px, z: pz, r: 0.15 }) }
    boards++
  }
  // Bus shelters (streetscape.ts): a poster on the outer side panel of each.
  for (const [x, z, ry] of [[26, -5.6, 0], [-5.6, 26, Math.PI / 2]] as const) {
    if (!has(x, z)) continue
    const [px, pz] = at(x, z, ry, 1.44, 0)
    faces.push({ w: 0.8, h: 1.2, x: px, y: 1.25, z: pz, ry: ry + Math.PI / 2, cell: portrait(0) })
    const [qx, qz] = at(x, z, ry, -1.44, 0)
    faces.push({ w: 0.8, h: 1.2, x: qx, y: 1.25, z: qz, ry: ry - Math.PI / 2, cell: portrait(4) })
  }
  // A-frame boards outside McGrind and the market gate, and near the Campus steps.
  for (const [x, z, ry, a, b] of [[-25.4, -47.2, 0, 2, 1], [-31.4, -29.4, 0, 3, 5], [5.6, -38.6, -0.4, 0, 2], [-22.6, -46.9, 0.3, 5, 4]] as const) {
    if (!free(x, z, 0.5, 0.5)) continue
    for (const [side, cell] of [[1, a], [-1, b]] as const) {
      const [fx, fz] = at(x, z, ry, 0, side * 0.2)
      faces.push({ w: 0.66, h: 0.99, x: fx, y: 0.6, z: fz, ry: side > 0 ? ry : ry + Math.PI, rx: -0.17, cell: portrait(cell) })
      const [qx, qz] = at(x, z, ry, 0, side * 0.15)
      frame(new THREE.BoxGeometry(0.74, 1.08, 0.04).rotateX(-side * 0.17).rotateY(ry).translate(qx, 0.6, qz))
    }
    o.obstacles.push({ kind: 'circle', x, z, r: 0.45 })
  }
  // Wall posters: McGrind's two side walls, and either side of the market gate's door.
  const walls: Array<[number, number, number, number]> = [
    [-32.72, -52.0, -Math.PI / 2, 1], [-32.72, -54.4, -Math.PI / 2, 3], [-23.28, -52.0, Math.PI / 2, 5], [-23.28, -54.4, Math.PI / 2, 0],
    [-32.0, -30.3, 0, 2], [-26.0, -30.3, 0, 4],
  ]
  for (const [x, z, ry, cell] of walls) {
    faces.push({ w: 1.1, h: 1.65, x, y: 1.75, z, ry, cell: portrait(cell) })
    const [bx, bz] = at(x, z, ry, 0, -0.02)
    frame(new THREE.BoxGeometry(1.2, 1.75, 0.03).rotateY(ry).translate(bx, 1.75, bz))
  }
  if (!faces.length) return []
  // Share spots: in front of each face a person can walk up to (billboards from the pavement below them).
  const spotsOut: FlyerSpot[] = []
  for (const f of faces) {
    const reach = f.y > 3 ? 2.2 : 0.9
    const sx = f.x + Math.sin(f.ry) * reach, sz = f.z + Math.cos(f.ry) * reach
    if (spotsOut.some((q) => Math.hypot(q.x - sx, q.z - sz) < 1.2)) continue
    spotsOut.push({ flyer: flyerFor(f.cell), x: sx, z: sz })
  }

  // One painted sheet for every poster.
  const S = o.graphics === 'low' ? 1024 : 2048
  const cv = document.createElement('canvas'); cv.width = cv.height = S
  const g = cv.getContext('2d')!
  g.scale(S / 1024, S / 1024)
  paintSheet(g)
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  const geos = faces.map((f) => {
    const geo = new THREE.PlaneGeometry(f.w, f.h)
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute
    const [u0, v0, u1, v1] = f.cell.map((n) => n / 1024) as [number, number, number, number]
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), 1 - (v1 - uv.getY(i) * (v1 - v0)))
    if (f.rx) geo.rotateX(f.rx)
    return geo.rotateY(f.ry).translate(f.x, f.y, f.z)
  })
  const faceMesh = new THREE.Mesh(mergeGeometries(geos, false)!, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.6 }))
  const frameMesh = new THREE.Mesh(mergeGeometries(frames.map((q) => (q.index ? q.toNonIndexed() : q)), false)!, new THREE.MeshStandardMaterial({ color: 0x1c3a2a, roughness: 0.5, metalness: 0.4 }))
  for (const m of [faceMesh, frameMesh]) {
    m.castShadow = o.graphics === 'high'; m.receiveShadow = false
    m.userData.ghost = true; m.raycast = () => undefined
    m.matrixAutoUpdate = false; m.updateMatrix()
    m.name = 'mcgrind-ads'
    scene.add(m)
  }
  return spotsOut
}
