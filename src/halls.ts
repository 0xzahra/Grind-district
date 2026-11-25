// The Campus and the conference centre inside: buildings of several rooms off a corridor or a lobby, not one hall.
// The big rooms have raked seating, rows that step up away from the front with a stepped aisle between the blocks,
// so everyone sees the board or the screen over the heads in front. Each row has a writing ledge. People fill the
// seats (hallCrowd.ts, a few instanced draws); the rest stay free. Walk up an aisle and stop at a row, or walk up
// to any free chair, and you sit (main.ts sits you on a free seat you stop beside). The conference stage can be
// climbed by its side steps and taken. Floor heights (tiers, stage, steps) are returned for the player to follow.
import * as THREE from 'three'
import type { Obstacle } from './physics.ts'
import type { Seat } from './seating.ts'
import { ATTENDEES, hallCrowd, standing, STUDENTS, type Cast, type CrowdSpot } from './hallCrowd.ts'
import { talkGestures } from './gestures.ts'
import { deckBoard, DECK_START } from './campusDeck.ts'

type Mat = THREE.Material
type Box = (bw: number, bh: number, bd: number, mat: Mat, x: number, z: number, y?: number, block?: boolean, ry?: number) => THREE.Mesh
export type HallCtx = {
  group: THREE.Group; ox: number; oz: number; w: number; d: number; H: number
  wallMat: Mat; trim: Mat
  std: (color: number, roughness?: number, metalness?: number) => THREE.MeshStandardMaterial
  box: Box
  add: (geo: THREE.BufferGeometry, mat: Mat, x: number, y: number, z: number, block?: boolean, ry?: number) => THREE.Mesh
  /** An action at a room-local point (the room adds its own position). */
  use: (u: { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; run: () => void }) => unknown
  seat: (sid: string, title: string, x: number, z: number, yaw: number, y: number) => void
  obstacles: Obstacle[]
  sit: (s: Seat) => void
  busy: (seconds: number, x: number, z: number, faceYaw: number) => void
  toast: (t: string) => void
  openLearn: () => void
  openConference: () => void
  canvasTex: (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => THREE.CanvasTexture
  /** How many people the building holds on this device. */
  cap: number
  /** Run every frame while the player is in this room (lectures, gestures). */
  onTick: (fn: (dt: number) => void) => void
}
/** Floor height at a room-local point (0 on the plain floor). */
export type Floor = (x: number, z: number) => number

const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), vv = new THREE.Vector3(), ss = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0)
const UNIT = new THREE.BoxGeometry(1, 1, 1)

/** Many boxes of one material in one draw: [x, bottom y, z, width, height, depth, yaw?]. */
export function boxes(c: HallCtx, mat: Mat, list: Array<[number, number, number, number, number, number, number?]>): void {
  if (!list.length) return
  const im = new THREE.InstancedMesh(UNIT, mat, list.length)
  list.forEach(([x, y, z, sx, sy, sz, ry = 0], i) => im.setMatrixAt(i, m4.compose(vv.set(x, y + sy / 2, z), qq.setFromAxisAngle(UP, ry), ss.set(sx, sy, sz))))
  im.castShadow = true
  im.receiveShadow = true
  im.computeBoundingSphere()
  c.group.add(im)
}

/** A partition wall with doorways (gaps) and a lintel over each, along x at z = `at` or along z at x = `at`. */
function partition(c: HallCtx, along: 'x' | 'z', at: number, from: number, to: number, gaps: Array<[number, number]>): void {
  const cuts = [...gaps].sort((a, b) => a[0] - b[0])
  let cur = from
  const seg = (a: number, b: number) => {
    if (b - a < 0.05) return
    if (along === 'x') c.box(b - a, c.H, 0.2, c.wallMat, (a + b) / 2, at)
    else c.box(0.2, c.H, b - a, c.wallMat, at, (a + b) / 2)
  }
  for (const [g0, g1] of cuts) {
    seg(cur, g0)
    // Lintel: the wall carries on over the doorway.
    if (along === 'x') c.box(g1 - g0, c.H - 2.4, 0.2, c.wallMat, (g0 + g1) / 2, at, 2.4, false)
    else c.box(0.2, c.H - 2.4, g1 - g0, c.wallMat, at, (g0 + g1) / 2, 2.4, false)
    cur = g1
  }
  seg(cur, to)
}

/** A sign over a doorway, readable from the side `face` points to (+1: +z or +x, -1: -z or -x). */
export function sign(c: HallCtx, text: string, along: 'x' | 'z', at: number, mid: number, face: 1 | -1): void {
  const t = c.canvasTex(512, 128, (g) => {
    g.fillStyle = '#1d2a24'; g.fillRect(0, 0, 512, 128)
    g.strokeStyle = '#c9a25e'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116)
    g.fillStyle = '#f4efe2'; g.font = '700 46px "Inter Variable", Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, 256, 66, 480)
  })
  const m = c.add(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), along === 'x' ? mid : at + face * 0.12, 2.75, along === 'x' ? at + face * 0.12 : mid)
  m.castShadow = false
  m.rotation.y = along === 'x' ? (face > 0 ? 0 : Math.PI) : face > 0 ? Math.PI / 2 : -Math.PI / 2
}

type Raked = {
  x0: number; x1: number
  /** z of the front edge of the first row; rows run toward `dir` (people face the other way, at the front). */
  front: number; dir: 1 | -1
  rows: number; rowD: number; rise: number
  aisles: Array<[number, number]>
  seatW?: number
}
type Row = { r: number; y: number; z: number; block: [number, number]; seats: CrowdSpot[] }

/** Stepped rows of chairs with ledges between aisles. Returns every row (front first) and the floor heights. */
function raked(c: HallCtx, s: Raked, mats: { tier: Mat; chair: Mat; ledge: Mat }): { rows: Row[]; floor: (x: number, z: number) => number | null } {
  const sw = s.seatW ?? 0.78
  const yaw = s.dir === -1 ? 0 : Math.PI // facing the front
  const aisles = [...s.aisles].sort((a, b) => a[0] - b[0])
  const blocks: Array<[number, number]> = []
  let cur = s.x0
  for (const [a0, a1] of aisles) { if (a0 - cur > sw) blocks.push([cur, a0]); cur = Math.max(cur, a1) }
  if (s.x1 - cur > sw) blocks.push([cur, s.x1])
  const tiers: Array<[number, number, number, number, number, number]> = []
  const bases: Array<[number, number, number, number, number, number]> = [], backs: typeof bases = [], ledges: typeof bases = [], panels: typeof bases = []
  const rows: Row[] = []
  for (let r = 0; r < s.rows; r++) {
    const y = r * s.rise
    const zA = s.front + s.dir * r * s.rowD
    const zMid = zA + s.dir * s.rowD / 2
    if (y > 0) tiers.push([(s.x0 + s.x1) / 2, 0, zMid, s.x1 - s.x0, y, s.rowD])
    const zs = zA + s.dir * s.rowD * 0.64, zl = zA + s.dir * 0.22
    for (const block of blocks) {
      const [b0, b1] = block
      const n = Math.max(1, Math.floor((b1 - b0 - 0.1) / sw))
      const start = (b0 + b1) / 2 - ((n - 1) / 2) * sw
      const seats: CrowdSpot[] = []
      for (let k = 0; k < n; k++) {
        const x = start + k * sw
        bases.push([x, y, zs, sw - 0.14, 0.44, 0.48])
        backs.push([x, y + 0.44, zs + s.dir * 0.24, sw - 0.14, 0.52, 0.07])
        seats.push({ x, y, z: zs, yaw })
      }
      ledges.push([(b0 + b1) / 2, y + 0.7, zl, b1 - b0 - 0.08, 0.04, 0.34])
      panels.push([(b0 + b1) / 2, y, zl - s.dir * 0.15, b1 - b0 - 0.08, 0.72, 0.03])
      // The row blocks: you reach a seat from the aisle, not by climbing over the people.
      c.obstacles.push({ kind: 'box', x: c.ox + (b0 + b1) / 2, z: c.oz + (zl + zs + s.dir * 0.3) / 2, hx: (b1 - b0) / 2, hz: Math.abs(zs + s.dir * 0.3 - zl) / 2 + 0.17 })
      rows.push({ r, y, z: zs, block, seats })
    }
  }
  boxes(c, mats.tier, tiers)
  boxes(c, mats.chair, [...bases, ...backs])
  boxes(c, mats.ledge, [...ledges, ...panels])
  const zEnd = s.front + s.dir * s.rows * s.rowD
  const floor = (x: number, z: number): number | null => {
    if (x < s.x0 || x > s.x1) return null
    const t = (z - s.front) * s.dir
    if (t < 0) return null
    if (t >= s.rows * s.rowD) return Math.abs(z - zEnd) < 2.5 ? (s.rows - 1) * s.rise : null // the walkway behind the back row
    return Math.floor(t / s.rowD) * s.rise
  }
  return { rows, floor }
}

const key = (p: CrowdSpot) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`
const hash = (i: number) => { const v = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return v - Math.floor(v) }

/** Choose who sits where: each group gets its share of `cap`, front rows fuller, with a scatter of gaps. */
function fill(groups: Array<{ spots: CrowdSpot[]; share: number }>, cap: number): { people: CrowdSpot[]; taken: Set<string> } {
  const people: CrowdSpot[] = []
  groups.forEach((g, gi) => {
    const n = Math.min(g.spots.length, Math.round(cap * g.share))
    const ranked = g.spots.map((p, i) => ({ p, w: i / g.spots.length * 1.6 + hash(i + gi * 1000) })).sort((a, b) => a.w - b.w)
    for (let i = 0; i < n; i++) people.push(ranked[i]!.p)
  })
  return { people, taken: new Set(people.map(key)) }
}

/** Row seats: stop in the aisle beside a row and you take the free seat in it nearest to you. */
function rowSeats(c: HallCtx, rows: Row[], aisles: Array<[number, number]>, taken: Set<string>, label: string): void {
  rows.forEach((row, i) => {
    const free = row.seats.filter((p) => !taken.has(key(p)))
    if (!free.length) return
    for (const [a0, a1] of aisles) {
      const near = Math.abs(a1 - row.block[0]) < 0.2 ? row.seats[0]! : Math.abs(a0 - row.block[1]) < 0.2 ? row.seats[row.seats.length - 1]! : null
      if (!near) continue
      const ax = (a0 + a1) / 2
      c.use({
        id: `${label}-row${i}-${ax.toFixed(1)}`, x: ax, z: row.z, r: 0.95, title: `${label} · row ${row.r + 1}`,
        body: 'Free seats in this row. Stop here and you sit down.', enter: 'Sit',
        run: () => {
          const best = free.slice().sort((a, b) => Math.abs(a.x - ax) - Math.abs(b.x - ax))[0]!
          c.sit({ x: c.ox + best.x, z: c.oz + best.z, yaw: best.yaw, y: 0.45 })
        },
      })
    }
  })
}

/** Flat classroom desks for two, with the free chairs sittable one by one. */
function classroom(c: HallCtx, xs: number[], zs: number[], mats: { desk: Mat; chair: Mat }, yaw: number): CrowdSpot[] {
  const tops: Array<[number, number, number, number, number, number]> = [], legs: typeof tops = [], chairs: typeof tops = []
  const spots: CrowdSpot[] = []
  const back = yaw === 0 ? -1 : 1 // chairs sit behind the desk, away from the board
  for (const x of xs) for (const z of zs) {
    tops.push([x, 0.72, z, 1.3, 0.04, 0.55])
    for (const sx of [-0.6, 0.6]) legs.push([x + sx, 0, z, 0.05, 0.72, 0.5])
    for (const px of [-0.33, 0.33]) {
      const cz = z + back * 0.5
      chairs.push([x + px, 0, cz, 0.44, 0.45, 0.42], [x + px, 0.45, cz + back * 0.2, 0.44, 0.45, 0.05])
      spots.push({ x: x + px, y: 0, z: cz, yaw })
    }
    c.obstacles.push({ kind: 'box', x: c.ox + x, z: c.oz + z, hx: 0.68, hz: 0.3 })
  }
  boxes(c, mats.desk, [...tops, ...legs])
  boxes(c, mats.chair, chairs)
  return spots
}

/** A lecture board: a 16:9 screen in a dark bezel showing the Campus deck ("Web3 From Zero", campusDeck.ts) from
 *  slide `start`, lit from within (an unlit screen keeps the deck's own colours whatever the room's light). */
function board(c: HallCtx, start: number, x: number, z: number, wdt: number, faceZ: 1 | -1, y = 2.6): { next: () => number } {
  const hgt = (wdt * 9) / 16
  const d = deckBoard({ width: c.cap <= 36 ? 768 : 1024, start })
  c.box(wdt + 0.24, hgt + 0.24, 0.06, c.std(0x15181c, 0.4, 0.3), x, z + faceZ * 0.12, y - hgt / 2 - 0.12, false)
  const m = c.add(new THREE.PlaneGeometry(wdt, hgt), new THREE.MeshBasicMaterial({ map: d.tex, color: 0xeeeeee }), x, y, z + faceZ * 0.16)
  m.castShadow = false
  m.rotation.y = faceZ > 0 ? 0 : Math.PI
  return { next: d.next }
}

/** A lecturer who talks with their hands, pauses for breath, and turns to point at the board on each new slide. */
function lecture(c: HallCtx, who: THREE.Group, name: string, b: { next: () => number }, every = 14): void {
  const moves = talkGestures(who, name)
  let tt = Math.random() * 4, talk = 0
  c.onTick((dt) => {
    moves.tick(dt)
    tt += dt; talk += dt
    if (tt >= every) { tt = 0; b.next(); moves.play('point') }
    const on = talk % 9 < 7.2
    moves.setTalking(on)
  })
}

/** Campus: two raked lecture theatres north of the corridor; two classrooms and the library south of it. */
export function buildCampus(c: HallCtx): Floor {
  const wood = c.std(0x6b4e37, 0.55), dark = c.std(0x3c2c20, 0.7), tier = c.std(0x8a6a50, 0.85)
  const chair = c.std(0x2f4a5c, 0.9), desk = c.std(0x8a6a4c, 0.6)
  // Walls: corridor (z -2.3 .. 2.3) from the door on the west wall; theatres north, classrooms and library south.
  partition(c, 'x', -2.3, -20, 20, [[-19.6, -18.0], [-0.1, 1.5], [2.5, 4.1], [18.2, 19.8]])
  partition(c, 'z', 2.0, -15, -2.3, [])
  partition(c, 'x', 2.3, -20, 20, [[-8.4, -6.8], [5.6, 7.2], [8.6, 10.6]])
  partition(c, 'z', -6.0, 2.3, 15, [])
  partition(c, 'z', 8.0, 2.3, 15, [])
  sign(c, 'Lecture Theatre A', 'x', -2.3, -18.8, 1); sign(c, 'Lecture Theatre A', 'x', -2.3, 0.7, 1)
  sign(c, 'Lecture Theatre B', 'x', -2.3, 3.3, 1); sign(c, 'Lecture Theatre B', 'x', -2.3, 19.0, 1)
  sign(c, 'Classroom 1', 'x', 2.3, -7.6, -1); sign(c, 'Classroom 2', 'x', 2.3, 6.4, -1); sign(c, 'Library', 'x', 2.3, 9.6, -1)
  // Theatre A (west) and B (east): rows rise north, away from the board on the corridor wall.
  const mats = { tier, chair, ledge: desk }
  const aislesA: Array<[number, number]> = [[-19.9, -18.7], [-9.6, -8.4], [0.7, 1.9]]
  const aislesB: Array<[number, number]> = [[2.1, 3.3], [10.4, 11.6], [18.7, 19.9]]
  const A = raked(c, { x0: -19.9, x1: 1.9, front: -5.4, dir: -1, rows: 8, rowD: 1.15, rise: 0.3, aisles: aislesA }, mats)
  const B = raked(c, { x0: 2.1, x1: 19.9, front: -5.4, dir: -1, rows: 8, rowD: 1.15, rise: 0.3, aisles: aislesB }, mats)
  const boardA = board(c, DECK_START.cover, -9.0, -2.3, 8, -1, 2.75)
  const boardB = board(c, DECK_START.finance, 11.0, -2.3, 8, -1, 2.75)
  for (const lx of [-5.6, 14.4]) {
    c.box(0.8, 1.1, 0.6, wood, lx, -3.7)
    c.use({ id: `lectern-${lx}`, x: lx, z: -4.7, r: 1.4, title: 'Lectern', body: 'Twenty short courses. Pass one and it writes your CV, resume, and portfolio.', enter: 'Open the hall', run: c.openLearn })
  }
  // Classrooms: desks for two in four rows, students facing the whiteboard on the south wall.
  const c1 = classroom(c, [-17.8, -15.0, -11.0, -8.2], [5.8, 7.6, 9.4, 11.2], { desk, chair }, 0)
  const c2 = classroom(c, [-3.8, -1.0, 3.0, 5.8], [5.8, 7.6, 9.4, 11.2], { desk, chair }, 0)
  // Library: shelves along the east and south walls, reading tables with readers.
  const shelf = c.std(0x5a3e2b, 0.7)
  const spines = [0x6e3228, 0x2a3f52, 0x3f5a34, 0x5a3a5c, 0x8a5a2c, 0xb08d57].map((col) => c.std(col, 0.85))
  c.box(0.4, 2.6, 12, shelf, 19.6, 8.7)
  c.box(11.2, 2.6, 0.4, shelf, 13.9, 14.7)
  spines.forEach((m, k) => {
    const list: Array<[number, number, number, number, number, number]> = []
    for (let sh = 0; sh < 5; sh++) {
      for (let z = 3.0 + k * 0.17; z < 14.3; z += 1.02) list.push([19.36, 0.25 + sh * 0.48, z, 0.16, 0.36, 0.15])
      for (let x = 8.7 + k * 0.17; x < 19.2; x += 1.02) list.push([x, 0.25 + sh * 0.48, 14.46, 0.15, 0.36, 0.16])
    }
    boxes(c, m, list)
  })
  const readers: CrowdSpot[] = []
  for (const tz of [5.0, 8.6, 12.2]) {
    c.box(2.6, 0.05, 1.1, desk, 13.0, tz, 0.72, false)
    for (const sx of [-1.15, 1.15]) for (const sz of [-0.45, 0.45]) c.box(0.05, 0.72, 0.05, dark, 13.0 + sx, tz + sz, 0, false)
    c.obstacles.push({ kind: 'box', x: c.ox + 13.0, z: c.oz + tz, hx: 1.35, hz: 0.6 })
    for (const sx of [-0.7, 0.7]) { readers.push({ x: 13.0 + sx, z: tz - 0.95, yaw: 0 }); readers.push({ x: 13.0 + sx, z: tz + 0.95, yaw: Math.PI }) }
  }
  boxes(c, chair, readers.map((r) => [r.x, 0, r.z + (r.yaw === 0 ? -0.05 : 0.05), 0.44, 0.45, 0.42] as [number, number, number, number, number, number]))
  c.use({ id: 'library', x: 16.6, z: 6.8, r: 1.6, title: 'Library', body: 'Every course has a source line. The shelf has the rest.', enter: 'Browse', run: () => c.toast('Read the source line under each course. Then do the four exercises.') })
  // Corridor: a courses desk by the entrance.
  c.box(2.6, 1.0, 0.7, wood, -15.6, 1.6)
  c.use({ id: 'courses-desk', x: -15.6, z: 0.6, r: 1.5, title: 'Courses desk', body: 'Every course on Campus. Pick one and start.', enter: 'See courses', run: c.openLearn })
  // Who is in today: students in both theatres, the classrooms and the library; a lecturer or teacher in each.
  const seatsA = A.rows.flatMap((r) => r.seats), seatsB = B.rows.flatMap((r) => r.seats)
  const { people, taken } = fill([{ spots: seatsA, share: 0.36 }, { spots: seatsB, share: 0.26 }, { spots: c1, share: 0.12 }, { spots: c2, share: 0.12 }, { spots: readers, share: 0.08 }], c.cap)
  hallCrowd(c.group, people, STUDENTS, { cap: people.length, seatY: 0.45 })
  rowSeats(c, A.rows, aislesA, taken, 'Theatre A')
  rowSeats(c, B.rows, aislesB, taken, 'Theatre B')
  ;[...c1, ...c2].forEach((p, i) => { if (!taken.has(key(p))) c.seat(`class${i}`, 'Classroom chair', p.x, p.z, p.yaw, 0.45) })
  const teach: Array<[Cast, number, number, number]> = [
    [{ model: 'man3', look: { top: 0x3a3f46, bottom: 0x23262a, shoes: 0x1a1c1f, skin: 0x5a3825, hair: 0x16110e } }, -7.6, -3.6, Math.PI],
    [{ model: 'woman3', look: { top: 0x6b2a3a, bottom: 0x23262a, skin: 0x8d5a3b, hair: 0x16110e } }, 12.6, -3.6, Math.PI],
    [{ model: 'man2', look: { top: 0xe8e2d6, bottom: 0x3a4a5c, skin: 0x6f4329, hair: 0x0e0c0b } }, -13.0, 13.6, Math.PI],
    [{ model: 'woman1', look: { top: 0x2f5d8a, bottom: 0x2b2f3a, skin: 0x4a2e20, hair: 0x16110e } }, 1.0, 13.6, Math.PI],
  ]
  const classBoards = [
    board(c, DECK_START.tech, -13.0, 15, 5.2, -1, 2.2),
    board(c, DECK_START.rwa, 1.0, 15, 5.2, -1, 2.2),
  ]
  const boardsFor = [boardA, boardB, classBoards[0]!, classBoards[1]!]
  teach.forEach(([cast, x, z, yaw], i) => {
    const who = standing(c.group, cast, x, 0, z, yaw)
    c.obstacles.push({ kind: 'circle', x: c.ox + x, z: c.oz + z, r: 0.3 })
    lecture(c, who, `campus-teacher-${i}`, boardsFor[i]!, i < 2 ? 14 : 20)
  })
  return (x, z) => A.floor(x, z) ?? B.floor(x, z) ?? 0
}

/** Conference centre: a lobby by the door, the raked auditorium with its stage, a panel room and a workshop room. */
export function buildConference(c: HallCtx, schedule: (g: CanvasRenderingContext2D, w: number, h: number) => void): Floor {
  const walnut = c.std(0x5a3e2b, 0.55), tier = c.std(0x3a2a30, 0.9), fabric = c.std(0x2e3a4a, 0.95), ledge = c.std(0x4a3628, 0.6)
  // Walls: the lobby runs along the south (door on the west wall at z 13); the auditorium fills the west part,
  // the panel room and the workshop room the east part.
  partition(c, 'x', 10.2, -20, 20, [[-19.6, -18.0], [6.2, 7.8], [9.0, 10.6], [18.2, 19.8]])
  partition(c, 'z', 8.0, -16, 10.2, [])
  partition(c, 'x', -2.6, 8.0, 20, [[12.0, 13.6]])
  sign(c, 'Main auditorium', 'x', 10.2, -18.8, 1); sign(c, 'Main auditorium', 'x', 10.2, 7.0, 1)
  sign(c, 'Panel room', 'x', 10.2, 9.8, 1); sign(c, 'Panel room', 'x', 10.2, 19.0, 1); sign(c, 'Workshop room', 'x', -2.6, 12.8, 1)
  // Stage at the south end, by the lobby wall: walk up its side steps. The screen hangs on the wall behind it.
  const stage = { x0: -16.4, x1: 4.4, z0: 7.0, z1: 10.1 }
  c.box(stage.x1 - stage.x0, 0.6, stage.z1 - stage.z0, walnut, (stage.x0 + stage.x1) / 2, (stage.z0 + stage.z1) / 2, 0, false)
  c.box(stage.x1 - stage.x0, 0.06, 0.06, c.trim, (stage.x0 + stage.x1) / 2, stage.z0, 0.57, false)
  for (const sx of [stage.x0 - 0.6, stage.x1 + 0.6]) c.box(1.2, 0.3, stage.z1 - stage.z0, walnut, sx, (stage.z0 + stage.z1) / 2, 0, false)
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 512
  const screenTex = new THREE.CanvasTexture(sc); screenTex.colorSpace = THREE.SRGBColorSpace
  const repaint = () => { schedule(sc.getContext('2d')!, 1024, 512); screenTex.needsUpdate = true }
  repaint()
  c.group.userData.repaint = repaint
  // The stage screen runs the Campus deck; the event schedule is on the panel room's screen (and the Join key).
  const stageDeck = board(c, DECK_START.cover, -6.0, 10.04, 7.6, -1, 2.95)
  let schedT = 0
  c.onTick((dt) => { schedT += dt; if (schedT > 60) { schedT = 0; repaint() } })
  // Lectern, the speaker beside it, and a panel of two in armchairs at the other end of the stage.
  c.box(0.9, 1.1, 0.55, walnut, 1.6, 7.6, 0.6, false)
  c.obstacles.push({ kind: 'circle', x: c.ox + 1.6, z: c.oz + 7.6, r: 0.45 })
  const speaker = standing(c.group, { model: 'woman4', look: { top: 0x7a2a3a, bottom: 0x23262a, skin: 0x5a3825, hair: 0x16110e } }, -0.4, 0.6, 7.9, Math.PI)
  lecture(c, speaker, 'conference-speaker', stageDeck, 14)
  c.obstacles.push({ kind: 'circle', x: c.ox - 0.4, z: c.oz + 7.9, r: 0.3 })
  const panel: CrowdSpot[] = []
  for (const px of [-13.2, -11.8]) {
    c.box(0.75, 0.45, 0.7, c.std(0x8a6a4c, 0.9), px, 8.3, 0.6, false)
    c.box(0.75, 0.55, 0.12, c.std(0x8a6a4c, 0.9), px, 8.7, 1.05, false)
    panel.push({ x: px, y: 0.6, z: 8.3, yaw: Math.PI })
    c.obstacles.push({ kind: 'circle', x: c.ox + px, z: c.oz + 8.3, r: 0.4 })
  }
  c.box(0.5, 0.5, 0.5, walnut, -12.5, 7.6, 0.6, false)
  c.use({
    id: 'take-stage', x: 1.6, z: 8.35, r: 1.2, title: 'The stage', body: 'Step up to the lectern. The hall is yours while you speak.', enter: 'Take the stage',
    run: () => { c.busy(5, c.ox + 1.6, c.oz + 8.25, Math.PI); c.toast('You have the stage. The whole hall is listening.') },
  })
  c.use({ id: 'event-screen', x: -6.0, z: 5.4, r: 1.8, title: 'Events', body: 'Upcoming AMAs, Spaces-style talks and demo days (the schedule is up in the panel room). Join for in-game cash and reputation.', enter: 'Join event', run: c.openConference })
  // Raked rows rising north, away from the stage.
  const aisles: Array<[number, number]> = [[-19.9, -18.7], [-6.6, -5.4], [6.7, 7.9]]
  const hall = raked(c, { x0: -19.9, x1: 7.9, front: 4.4, dir: -1, rows: 15, rowD: 1.2, rise: 0.22, aisles, seatW: 0.8 }, { tier, chair: fabric, ledge })
  // Panel room: flat rows facing its screen on the north wall. Workshop room: round tables of five.
  const pr: CrowdSpot[] = []
  const prChairs: Array<[number, number, number, number, number, number]> = []
  for (let r = 0; r < 6; r++) for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
    const x = 14 + side * (1.0 + k * 0.72), z = 0.4 + r * 1.3
    prChairs.push([x, 0, z, 0.56, 0.44, 0.5], [x, 0.44, z + 0.24, 0.56, 0.5, 0.07])
    pr.push({ x, y: 0, z, yaw: Math.PI })
  }
  for (let r = 0; r < 6; r++) for (const side of [-1, 1]) c.obstacles.push({ kind: 'box', x: c.ox + 14 + side * 2.44, z: c.oz + 0.4 + r * 1.3, hx: 1.8, hz: 0.3 })
  boxes(c, fabric, prChairs)
  const ps = c.add(new THREE.PlaneGeometry(6, 2.6), new THREE.MeshStandardMaterial({ map: screenTex, emissiveMap: screenTex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.85 }), 14, 2.4, -2.48)
  ps.castShadow = false
  const ws: CrowdSpot[] = []
  const tables: Array<[number, number, number, number, number, number]> = []
  for (const [tx, tz] of [[10.8, -13.0], [16.6, -13.0], [10.8, -7.4], [16.6, -7.4]] as const) {
    tables.push([tx, 0.72, tz, 1.5, 0.05, 1.5], [tx, 0, tz, 0.12, 0.72, 0.12])
    c.obstacles.push({ kind: 'circle', x: c.ox + tx, z: c.oz + tz, r: 0.85 })
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2, x = tx + Math.sin(a) * 1.15, z = tz + Math.cos(a) * 1.15
      tables.push([x, 0, z, 0.44, 0.45, 0.44])
      ws.push({ x, y: 0, z, yaw: a + Math.PI })
    }
  }
  boxes(c, walnut, tables)
  // Lobby: registration desk, a coffee bar and high tables with people talking.
  c.box(3.6, 1.05, 0.8, walnut, -11.0, 12.4)
  c.box(5.0, 1.05, 0.7, walnut, 13.0, 15.3)
  const high: Array<[number, number, number, number, number, number]> = []
  const talk: CrowdSpot[] = []
  for (const [hx, hz] of [[-4.0, 13.2], [1.5, 13.6], [7.0, 13.0], [16.5, 12.6]] as const) {
    high.push([hx, 0, hz, 0.08, 1.05, 0.08], [hx, 1.05, hz, 0.7, 0.04, 0.7])
    c.obstacles.push({ kind: 'circle', x: c.ox + hx, z: c.oz + hz, r: 0.4 })
    for (const a of [0.4, 2.5, 4.4]) talk.push({ x: hx + Math.sin(a) * 0.75, y: 0, z: hz + Math.cos(a) * 0.75, yaw: a + Math.PI })
  }
  boxes(c, walnut, high)
  const seatsH = hall.rows.flatMap((r) => r.seats)
  const { people, taken } = fill([{ spots: seatsH, share: 0.6 }, { spots: pr, share: 0.16 }, { spots: ws, share: 0.12 }], c.cap)
  hallCrowd(c.group, [...panel, ...people], ATTENDEES, { cap: people.length + panel.length, seatY: 0.45 })
  hallCrowd(c.group, talk.slice(0, Math.max(3, Math.round(c.cap * 0.08))), ATTENDEES.slice(0, 4), { cap: talk.length, pose: 'stand' })
  rowSeats(c, hall.rows, aisles, taken, 'Auditorium')
  pr.forEach((p, i) => { if (!taken.has(key(p))) c.seat(`panel${i}`, 'Panel room seat', p.x, p.z, p.yaw, 0.45) })
  ws.forEach((p, i) => { if (!taken.has(key(p))) c.seat(`work${i}`, 'Workshop seat', p.x, p.z, p.yaw, 0.45) })
  return (x, z) => {
    if (x >= stage.x0 && x <= stage.x1 && z >= stage.z0 && z <= stage.z1) return 0.6
    if (z >= stage.z0 && z <= stage.z1 && ((x >= stage.x0 - 1.2 && x < stage.x0) || (x > stage.x1 && x <= stage.x1 + 1.2))) return 0.3
    return hall.floor(x, z) ?? 0
  }
}
