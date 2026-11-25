// The Graduation Garden: the two lawns in front of Campus fill with banners as the whole city learns. Every
// banner is a milestone of courses passed by all players together (1, 5, 10, 25 ... 2,000), and a board at the
// front shows the running totals and when the next banner rises. Counts come from the public stats the game
// already reads (no identities). The whole garden is two meshes (posts; banners and board on one painted sheet),
// built once with every banner in place: growing only widens how much of each mesh is drawn, so a new banner
// costs no new draw call and no rebuild.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Obstacle } from './physics.ts'
import type { Hotspot } from './world.ts'
import type { Graphics } from './logic.ts'

/** Courses passed city-wide at which each banner goes up, in the order they appear. */
export const MILESTONES = [1, 5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000] as const

export function bannersFor(passed: number): number {
  let n = 0
  for (const m of MILESTONES) if (passed >= m) n++
  return n
}

export function nextMilestone(passed: number): number | null {
  return MILESTONES.find((m) => m > passed) ?? null
}

const HUES = ['#1e5b57', '#6b2430', '#23365f', '#7a5a1c', '#2f5a2a', '#4c2a63', '#7a3a1c', '#1d4f6b']
const GOLD = '#e8c27a'
const FONT = '"Inter Variable", Inter, system-ui, sans-serif'
const CACHE = 'gd.garden.v1'
const fmt = (n: number) => n.toLocaleString('en-US')

/** Where banner k stands: alternating lawns, front (nearest the plaza) to back, inner post before outer. */
function slot(k: number): { x: number; z: number; s: number } {
  const s = k % 2 === 0 ? -1 : 1
  const p = Math.floor(k / 2), row = Math.floor(p / 2), col = p % 2
  // Clear of the tree at the left lawn's road edge and the benches along the right one.
  return { x: s * (7.6 + col * 1.8), z: -32 - row * 2, s }
}

type Garden = { set: (passed: number | undefined, certs: number | undefined) => void }

export function createGarden(scene: THREE.Scene, o: { graphics: Graphics; obstacles: Obstacle[]; hotspots: Hotspot[]; toast: (m: string) => void }): Garden {
  // One painted sheet: 16 banner cells (8 x 2) on the top half, the board's face and a plain back below.
  const S = o.graphics === 'low' ? 512 : 1024, k = S / 1024
  const cv = document.createElement('canvas'); cv.width = cv.height = S
  const g = cv.getContext('2d')!
  g.scale(k, k)
  const CW = 128, CH = 256
  MILESTONES.forEach((m, i) => {
    const x = (i % 8) * CW, y = Math.floor(i / 8) * CH
    g.fillStyle = HUES[i % HUES.length]!; g.fillRect(x, y, CW, CH)
    g.fillStyle = GOLD; g.fillRect(x, y + 10, CW, 6); g.fillRect(x, y + CH - 40, CW, 4)
    // A swallowtail notch at the foot, cut back to the sheet's dark edge colour.
    g.fillStyle = '#15130f'; g.beginPath(); g.moveTo(x + 30, y + CH); g.lineTo(x + CW / 2, y + CH - 26); g.lineTo(x + CW - 30, y + CH); g.closePath(); g.fill()
    g.fillStyle = GOLD; g.beginPath(); g.moveTo(x + CW / 2, y + 34); g.lineTo(x + CW / 2 + 13, y + 52); g.lineTo(x + CW / 2, y + 70); g.lineTo(x + CW / 2 - 13, y + 52); g.closePath(); g.fill()
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillStyle = '#fff8ea'; g.font = `800 ${m >= 1000 ? 36 : 46}px ${FONT}`; g.fillText(fmt(m), x + CW / 2, y + 118)
    g.fillStyle = GOLD; g.font = `700 15px ${FONT}`
    g.fillText(m === 1 ? 'COURSE' : 'COURSES', x + CW / 2, y + 156); g.fillText('PASSED', x + CW / 2, y + 176)
  })
  const BY = 512, BH = 448
  g.fillStyle = '#2a2620'; g.fillRect(0, BY + BH, 1024, 1024 - BY - BH) // the board's plain back
  const paintBoard = (passed: number | null, certs: number | null) => {
    g.fillStyle = '#17150f'; g.fillRect(0, BY, 1024, BH)
    g.strokeStyle = GOLD; g.lineWidth = 6; g.strokeRect(14, BY + 14, 1024 - 28, BH - 28)
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillStyle = GOLD; g.font = `800 44px ${FONT}`; g.fillText('GRADUATION GARDEN', 512, BY + 70)
    g.fillStyle = '#fff8ea'; g.font = `800 92px ${FONT}`
    g.fillText(passed == null ? 'Learn here, grow the city' : `${fmt(passed)} courses passed`, 512, BY + 180, 960)
    g.fillStyle = '#d9d2c3'; g.font = `600 40px ${FONT}`
    if (certs != null) g.fillText(`${fmt(certs)} certificates earned by players`, 512, BY + 270, 960)
    const next = passed == null ? MILESTONES[0] : nextMilestone(passed)
    g.fillStyle = GOLD; g.font = `700 38px ${FONT}`
    g.fillText(next == null ? 'Every banner is up. Thank you, graduates.' : `A new banner rises at ${fmt(next)}`, 512, BY + 360, 960)
    tex.needsUpdate = true
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4

  // Banners and board share one material and one mesh. A plane's UVs are set to its cell on the sheet.
  // Sheet coordinates are fractions from the top left; three's v runs bottom-up (the canvas is flipped on upload).
  const cell = (g0: THREE.BufferGeometry, u0: number, v0: number, u1: number, v1: number) => {
    const uv = g0.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i)
      uv.setXY(i, u0 + u * (u1 - u0), 1 - (v1 - v * (v1 - v0)))
    }
    return g0
  }
  const px = (n: number) => n / 1024
  const sheet: THREE.BufferGeometry[] = [], posts: THREE.BufferGeometry[] = []
  // Board first (always drawn), then banner k in order, so drawing the first N banners is one draw range.
  const BX = 7.6, BZ = -29.95
  {
    const front = cell(new THREE.PlaneGeometry(2.4, 1.05), 0, px(BY), 1, px(BY + BH)); front.translate(BX, 0.98, BZ + 0.035)
    const back = cell(new THREE.PlaneGeometry(2.4, 1.05), 0, px(BY + BH + 8), 1, px(1016)); back.rotateY(Math.PI); back.translate(BX, 0.98, BZ - 0.035)
    sheet.push(front, back)
    const frame = new THREE.BoxGeometry(2.5, 1.15, 0.05); frame.translate(BX, 0.98, BZ)
    posts.push(frame)
    for (const s of [-1, 1]) { const leg = new THREE.BoxGeometry(0.08, 0.45, 0.08); leg.translate(BX + s * 1.05, 0.225, BZ); posts.push(leg) }
  }
  const sheetBase = sheet.reduce((n, q) => n + q.index!.count, 0)
  const postBase = posts.reduce((n, q) => n + (q.index?.count ?? 0), 0)
  let sheetPer = 0, postPer = 0
  MILESTONES.forEach((_, i) => {
    const { x, z, s } = slot(i)
    const u0 = px((i % 8) * CW), v0 = px(Math.floor(i / 8) * CH), u1 = u0 + px(CW), v1 = v0 + px(CH)
    const bx = x + s * 0.62 // the banner hangs from an arm reaching away from the road (big enough to read from the street)
    const front = cell(new THREE.PlaneGeometry(1.0, 2.0), u0, v0, u1, v1); front.translate(bx, 3.1, z + 0.012)
    const back = cell(new THREE.PlaneGeometry(1.0, 2.0), u0, v0, u1, v1); back.rotateY(Math.PI); back.translate(bx, 3.1, z - 0.012) // turned round, it still reads left to right from behind
    sheet.push(front, back)
    const pole = new THREE.CylinderGeometry(0.06, 0.08, 4.5, 8); pole.translate(x, 2.25, z)
    const cap = new THREE.SphereGeometry(0.1, 8, 6); cap.translate(x, 4.55, z)
    const arm = new THREE.BoxGeometry(1.22, 0.045, 0.045); arm.translate(x + s * 0.61, 4.12, z)
    const foot = new THREE.BoxGeometry(1.22, 0.035, 0.035); foot.translate(x + s * 0.61, 2.08, z)
    posts.push(pole, cap, arm, foot)
    if (i === 0) { sheetPer = front.index!.count + back.index!.count; postPer = [pole, cap, arm, foot].reduce((n, q) => n + q.index!.count, 0) }
  })
  const sheetGeo = mergeGeometries(sheet, false)!, postGeo = mergeGeometries(posts, false)!
  const glow = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.85, side: THREE.FrontSide })
  const bronze = new THREE.MeshStandardMaterial({ color: 0x2f2b25, metalness: 0.55, roughness: 0.45 })
  const sheetMesh = new THREE.Mesh(sheetGeo, glow), postMesh = new THREE.Mesh(postGeo, bronze)
  for (const m of [sheetMesh, postMesh]) {
    m.castShadow = o.graphics === 'high'; m.receiveShadow = false
    m.matrixAutoUpdate = false; m.updateMatrix()
    m.name = 'graduation-garden'
    scene.add(m)
  }
  o.obstacles.push({ kind: 'box', x: BX, z: BZ, hx: 1.3, hz: 0.12 })
  const spot: Hotspot = { id: 'garden', x: BX, z: BZ + 0.9, r: 1.8, title: 'Graduation Garden', body: 'A new banner goes up here each time the city passes a milestone of courses. Pass one to help it grow.', action: 'learn', enter: 'Open courses' }
  o.hotspots.push(spot)

  let shown = 0
  const show = (n: number) => {
    for (let i = shown; i < n; i++) { const { x, z } = slot(i); o.obstacles.push({ kind: 'circle', x, z, r: 0.14 }) }
    shown = Math.max(shown, n)
    sheetGeo.setDrawRange(0, sheetBase + sheetPer * n)
    postGeo.setDrawRange(0, postBase + postPer * n)
  }
  // Start from the last totals this browser saw, so the garden does not pop in a few seconds after opening.
  let last: { p: number; c: number } | null = null
  try { const raw = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as { p?: unknown; c?: unknown } | null; if (raw && typeof raw.p === 'number' && typeof raw.c === 'number') last = { p: raw.p, c: raw.c } } catch { /* private mode */ }
  paintBoard(last?.p ?? null, last?.c ?? null)
  show(last ? bannersFor(last.p) : 0)

  return {
    set(passed, certs) {
      if (typeof passed !== 'number' || !Number.isFinite(passed) || passed < 0) return
      const c = typeof certs === 'number' && Number.isFinite(certs) ? certs : (last?.c ?? 0)
      const before = last ? bannersFor(last.p) : null
      const n = bannersFor(passed)
      if (!last || last.p !== passed || last.c !== c) paintBoard(passed, c)
      show(n)
      const next = nextMilestone(passed)
      spot.body = `${fmt(passed)} courses passed and ${fmt(c)} certificates earned by players so far. ${next == null ? 'Every banner is up.' : `The next banner goes up at ${fmt(next)} courses.`} Pass one to help it grow.`
      if (before !== null && n > before) o.toast(`A new banner went up in the Graduation Garden at Campus: the city has passed ${fmt(MILESTONES[n - 1]!)} courses.`)
      last = { p: passed, c }
      try { localStorage.setItem(CACHE, JSON.stringify(last)) } catch { /* private mode */ }
    },
  }
}
