// The four seasons and climate change. Seasons follow the in-game calendar (two in-game days each, starting from
// the real season where you are, northern hemisphere): spring blossom and fresh leaves, summer light, autumn
// colours with leaves falling and lying on the ground, winter snow on the trees and the ground with snow falling.
// The Seasons & climate panel shows any season now, and previews climate change in the city for 2050 and 2100
// under low and high emissions: the shoreline moves in as the sea rises, the heat haze thickens, parks dry out
// and storms come more often. Figures are global averages from the IPCC's Sixth Assessment Report (2021).
// Kept beside the save (`<slot>.seasons`), so the save format is unchanged.
import * as THREE from 'three'
import { slotKey } from './state.ts'

export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'
export type ClimateId = 'today' | '2050-low' | '2050-high' | '2100-low' | '2100-high'
const ORDER: SeasonId[] = ['spring', 'summer', 'autumn', 'winter']
const DAYS_PER_SEASON = 2

export const SEASONS: Record<SeasonId, { title: string; leaf: number; leafGlow: number; leafGlowK: number; sun: number; sunTint: number; fogTint: number; snow: number; fall: 'petals' | 'leaves' | 'snow' | null; arrive: string }> = {
  spring: { title: 'Spring', leaf: 0xdcffc4, leafGlow: 0x3a5a20, leafGlowK: 0.12, sun: 1.0, sunTint: 0xfff6e8, fogTint: 0xdfeee6, snow: 0, fall: 'petals', arrive: 'Spring in Grind District: fresh leaves and blossom in the air.' },
  summer: { title: 'Summer', leaf: 0xffffff, leafGlow: 0x000000, leafGlowK: 0, sun: 1.08, sunTint: 0xfff0d0, fogTint: 0xf0e8d8, snow: 0, fall: null, arrive: 'Summer: long bright days. The beach and the park pools are calling.' },
  autumn: { title: 'Autumn', leaf: 0xffb060, leafGlow: 0xb8480c, leafGlowK: 0.55, sun: 0.94, sunTint: 0xffd9a8, fogTint: 0xe8d8c4, snow: 0, fall: 'leaves', arrive: 'Autumn: the leaves are turning gold and red, and drifting down.' },
  winter: { title: 'Winter', leaf: 0xf2f6fa, leafGlow: 0xe8eef4, leafGlowK: 0.36, sun: 0.82, sunTint: 0xdfe9ff, fogTint: 0xdfe6ee, snow: 1, fall: 'snow', arrive: 'Winter: snow on the trees and the streets. Wrap up warm.' },
}

/** Climate scenarios: warming since 1850-1900, sea-level rise since 1995-2014 (global means, IPCC AR6). */
export const CLIMATE: Record<ClimateId, { title: string; warming: string; sea: string; shore: number; heat: number; storms: number; lines: string[] }> = {
  today: { title: 'Today', warming: '+1.2 °C', sea: 'about +0.20 m since 1900', shore: 0, heat: 0, storms: 0, lines: ['The world is already about 1.2 °C warmer than before industry, mostly from burning coal, oil and gas.', 'Heatwaves that used to come once a decade now come almost three times as often.'] },
  '2050-low': { title: '2050 · low emissions', warming: 'about +1.7 °C', sea: 'about +0.19 m', shore: 6, heat: 0.3, storms: 0.2, lines: ['If the world cuts emissions fast, warming slows and levels off below 2 °C.', 'The sea still rises a little: the waterline creeps a few metres up the beach.', 'Hot days get hotter, but cities can adapt: shade, trees, cool roofs.'] },
  '2050-high': { title: '2050 · high emissions', warming: 'about +2.4 °C', sea: 'about +0.23 m', shore: 7, heat: 0.55, storms: 0.45, lines: ['If emissions keep rising, warming passes 2 °C by mid-century.', 'Heatwaves become several times more frequent; parks and crops dry out in summer.', 'Heavy downpours and storm surges hit coastal cities harder.'] },
  '2100-low': { title: '2100 · low emissions', warming: 'about +1.8 °C', sea: 'about +0.44 m (0.32 to 0.62 m)', shore: 13, heat: 0.35, storms: 0.25, lines: ['With fast, deep cuts, warming stays under 2 °C to the end of the century.', 'The sea keeps rising slowly for centuries: half the beach here is gone by 2100.', 'Still manageable with sea walls, wetlands and better building.'] },
  '2100-high': { title: '2100 · high emissions', warming: 'about +4.4 °C', sea: 'about +0.77 m (0.63 to 1.01 m; up to 2 m cannot be ruled out)', shore: 23, heat: 1, storms: 0.8, lines: ['On the highest-emission path the world is over 4 °C warmer: a different planet.', 'The beach is under water and waves reach the promenade; storm surges flood the streets.', 'Deadly heat on many days of the year, droughts, wildfires and failing harvests.'] },
}

/** El Niño and La Niña: the tropical Pacific warming or cooling for about a year, every 2 to 7 years. */
export type EnsoId = 'neutral' | 'el-nino' | 'la-nina'
export const ENSO: Record<EnsoId, { title: string; heat: number; storms: number; cool: number; lines: string[] }> = {
  neutral: { title: 'Normal year', heat: 0, storms: 0, cool: 0, lines: [] },
  'el-nino': { title: 'El Niño year', heat: 0.3, storms: 0.35, cool: 0, lines: [
    'Every 2 to 7 years the surface of the tropical Pacific warms by 1 °C or more for about a year. The trade winds weaken and the warm water spreads east towards South America.',
    'It moves rain round the planet: floods in Peru, Ecuador and the southern United States; drought in Australia, Indonesia, southern Africa and the Sahel; a weaker Indian monsoon; coral reefs bleach in the warm water.',
    'It adds roughly 0.1 to 0.2 °C to the world\'s temperature that year. On top of climate change, El Niño years set the records: 2016, and 2023 to 2024.',
    'Here: a warmer, hazier year with dry spells broken by sudden heavy downpours.',
  ] },
  'la-nina': { title: 'La Niña year', heat: 0, storms: 0.5, cool: 0.35, lines: [
    'La Niña is the opposite swing: the tropical Pacific cools and the trade winds strengthen.',
    'It brings floods to Australia and Indonesia, drought to the southern United States and East Africa, and a busier Atlantic hurricane season.',
    'The world cools slightly for a year, but less than climate change has already warmed it.',
    'Here: cooler, bluer light and more frequent rain.',
  ] },
}

type Weatherish = { force: (on: boolean | null) => void }
type Beachish = { setRise: (metres: number) => void }

let ctl: ReturnType<typeof createSeasons> | null = null

export function createSeasons(scene: THREE.Scene, o: { foliage: THREE.Material; ground: THREE.MeshStandardMaterial; beach: Beachish; weather: Weatherish; graphics: 'low' | 'medium' | 'high'; toast: (m: string) => void }) {
  const key = () => `${slotKey()}.seasons`
  const realSeason = (): number => { const m = new Date().getMonth(); return m >= 2 && m <= 4 ? 0 : m >= 5 && m <= 7 ? 1 : m >= 8 && m <= 10 ? 2 : 3 }
  const read = (): { i: number; d: number; y?: number } => { try { const v = JSON.parse(localStorage.getItem(key()) ?? 'null') as { i: number; d: number; y?: number } | null; if (v && v.i >= 0 && v.i < 4) return v } catch { /* none yet */ } return { i: realSeason(), d: 0, y: 0 } }
  const write = (v: { i: number; d: number; y?: number }) => { try { localStorage.setItem(key(), JSON.stringify(v)) } catch { /* private mode */ } }
  let state = read()
  let preview: SeasonId | null = null
  let climate: ClimateId = 'today'
  let ensoPreview: EnsoId | null = null
  // A natural cycle: in-game years run neutral, neutral, El Niño, La Niña (one season-year is eight in-game days).
  const naturalEnso = (): EnsoId => { const y = state.y ?? 0; return y % 4 === 2 ? 'el-nino' : y % 4 === 3 ? 'la-nina' : 'neutral' }
  const enso = (): EnsoId => ensoPreview ?? naturalEnso()
  const season = (): SeasonId => preview ?? ORDER[state.i]!
  const foliage = o.foliage as THREE.MeshLambertMaterial
  const groundBase = o.ground.color.clone()
  const tmp = new THREE.Color(), tmp2 = new THREE.Color()

  // --- Falling things round the camera: petals, leaves or snow (one instanced mesh, no allocations per frame).
  const N = o.graphics === 'high' ? 700 : o.graphics === 'medium' ? 420 : 180
  const R = 16, H = 14
  // Real shapes, not squares: a notched blossom petal, a pointed leaf with a stalk, and a round snowflake.
  const petalGeo = (() => {
    const sh = new THREE.Shape()
    sh.moveTo(0, -0.5)
    sh.bezierCurveTo(0.42, -0.32, 0.5, 0.18, 0.2, 0.46)
    sh.lineTo(0, 0.32); sh.lineTo(-0.2, 0.46)
    sh.bezierCurveTo(-0.5, 0.18, -0.42, -0.32, 0, -0.5)
    return new THREE.ShapeGeometry(sh, 6)
  })()
  const leafGeo = (() => {
    const sh = new THREE.Shape()
    sh.moveTo(0, -0.62); sh.lineTo(0.03, -0.42)
    sh.bezierCurveTo(0.42, -0.3, 0.44, 0.2, 0, 0.55)
    sh.bezierCurveTo(-0.44, 0.2, -0.42, -0.3, -0.03, -0.42)
    sh.lineTo(0, -0.62)
    return new THREE.ShapeGeometry(sh, 6)
  })()
  const snowGeo = new THREE.CircleGeometry(0.5, 10)
  const fallMesh = new THREE.InstancedMesh<THREE.BufferGeometry>(petalGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true }), N)
  fallMesh.frustumCulled = false; fallMesh.visible = false; fallMesh.userData.ghost = true; fallMesh.raycast = () => undefined
  scene.add(fallMesh)
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), ph = new Float32Array(N)
  for (let i = 0; i < N; i++) { px[i] = (Math.random() * 2 - 1) * R; py[i] = Math.random() * H; pz[i] = (Math.random() * 2 - 1) * R; ph[i] = Math.random() * 100 }
  let fallKind: 'petals' | 'leaves' | 'snow' | null = null
  const paintFall = (k: typeof fallKind) => {
    fallKind = k
    if (!k) return
    fallMesh.geometry = k === 'snow' ? snowGeo : k === 'petals' ? petalGeo : leafGeo
    const pal = k === 'snow' ? [0xffffff, 0xf4f8ff] : k === 'petals' ? [0xffc4d8, 0xffe4ee, 0xffffff, 0xf7a8c4] : [0xd9531e, 0xe8a22a, 0xb8321e, 0xc9792a, 0x8a5a2a]
    for (let i = 0; i < N; i++) fallMesh.setColorAt(i, tmp.setHex(pal[i % pal.length]!))
    if (fallMesh.instanceColor) fallMesh.instanceColor.needsUpdate = true
  }
  // --- Autumn leaves lying on the ground round the city.
  const LEAVES = o.graphics === 'low' ? 350 : 900
  const ground = new THREE.InstancedMesh(leafGeo.clone().scale(0.13, 0.18, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), LEAVES)
  ground.userData.ghost = true; ground.raycast = () => undefined; ground.visible = false; ground.receiveShadow = true
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0)
    const pal = [0xc9531e, 0xe0a02a, 0xa8321e, 0xb9792a, 0x8a5a2a]
    for (let i = 0; i < LEAVES; i++) {
      const k = 0.8 + Math.random() * 0.9
      m.compose(v.set((Math.random() * 2 - 1) * 60, 0.02 + Math.random() * 0.01, (Math.random() * 2 - 1) * 60), q.setFromAxisAngle(Y, Math.random() * 6.3), s.set(k, 1, k))
      ground.setMatrixAt(i, m); ground.setColorAt(i, tmp.setHex(pal[i % pal.length]!))
    }
  }
  scene.add(ground)

  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s4 = new THREE.Vector3(), v4 = new THREE.Vector3()
  let stormClock = 0
  const applyClimateNow = () => {
    const c = CLIMATE[climate]
    o.beach.setRise(c.shore)
  }
  const api = {
    get season() { return season() },
    get climate() { return climate },
    get day() { return state.d + 1 },
    get previewing() { return preview !== null },
    next(): SeasonId { return ORDER[(state.i + 1) % 4]! },
    /** A new in-game day: seasons turn every two days. */
    newDay() {
      state.d++
      if (state.d >= DAYS_PER_SEASON) {
        const before = naturalEnso()
        state = { i: (state.i + 1) % 4, d: 0, y: (state.y ?? 0) + (state.i === 3 ? 1 : 0) }
        if (!preview) o.toast(SEASONS[ORDER[state.i]!].arrive)
        const now = naturalEnso()
        if (now !== before && now !== 'neutral') window.setTimeout(() => o.toast(`${ENSO[now].title} has begun. ${ENSO[now].lines[3]} Seasons in the menu explains it.`), 4000)
      }
      write(state)
    },
    preview(s: SeasonId | null) { preview = s && s !== ORDER[state.i] ? s : null; paintFall(SEASONS[season()].fall) },
    setClimate(c: ClimateId) { climate = c; applyClimateNow() },
    get enso() { return enso() },
    get ensoNatural() { return naturalEnso() },
    setEnso(e: EnsoId | null) { ensoPreview = e },
    /** After the day's light is set: season and climate colour the light, the haze, the leaves and the ground. */
    apply(fog: THREE.FogExp2 | null, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight, night: number) {
      const S = SEASONS[season()], E = ENSO[enso()], C0 = CLIMATE[climate]
      const C = { ...C0, heat: Math.min(1, C0.heat + E.heat) }
      if (S.fall !== fallKind) paintFall(S.fall)
      // Leaves: the season's colour, drying towards straw with heat.
      tmp.setHex(S.leaf).lerp(tmp2.setHex(0xc9b26a), C.heat * 0.45)
      if (foliage.map) foliage.color.copy(tmp)
      // Snow on the leaves in winter, a warm glow of colour in autumn (tinting alone can't lighten green leaves).
      foliage.emissive.setHex(S.leafGlow); foliage.emissiveIntensity = S.leafGlowK * (1 - night * 0.8)
      // Ground: snow in winter (a cool white glow, dimmed at night), parched in heat.
      o.ground.color.copy(groundBase).lerp(tmp2.setHex(0xe6d2a6), C.heat * 0.5)
      o.ground.emissive.setHex(0xdfe8f2); o.ground.emissiveIntensity = S.snow * 0.2 * (1 - night * 0.75)
      ground.visible = season() === 'autumn'
      sun.color.multiply(tmp.setHex(S.sunTint)).lerp(tmp2.setHex(0xffc27a), C.heat * 0.25).lerp(tmp2.setHex(0xbcd4ff), E.cool * 0.3)
      sun.intensity *= S.sun * (1 + C.heat * 0.12)
      hemi.intensity *= 0.96 + S.snow * 0.02
      if (fog) {
        fog.color.lerp(tmp.setHex(S.fogTint), 0.18 * (1 - night)).lerp(tmp2.setHex(0xd9b27a), C.heat * 0.4 * (1 - night * 0.6)).lerp(tmp2.setHex(0xc4d4e4), E.cool * 0.25 * (1 - night))
        fog.density *= 1 + S.snow * 0.08 + C.heat * 0.7
      }
    },
    /** Falling petals, leaves or snow round the camera; storms in the hotter futures. */
    tick(dt: number, cam: THREE.Camera, outside: boolean) {
      const storms = Math.max(CLIMATE[climate].storms, ENSO[enso()].storms)
      const C = { storms }
      if (C.storms > 0) { stormClock = (stormClock + dt) % 80; o.weather.force(stormClock < 26 * C.storms + 6) } else o.weather.force(null)
      const show = outside && !!fallKind && N > 0
      fallMesh.visible = show
      if (!show) return
      const snow = fallKind === 'snow', leaves = fallKind === 'leaves', petalsW = snow ? 1 : 0.8
      const speed = snow ? 1.1 : leaves ? 1.5 : 0.9
      const size = snow ? 0.06 : leaves ? 0.15 : 0.09
      const cx = cam.position.x, cy = cam.position.y - 3, cz = cam.position.z
      for (let i = 0; i < N; i++) {
        ph[i]! += dt
        let y = py[i]! - speed * dt
        if (y < 0) { y += H; px[i] = (Math.random() * 2 - 1) * R; pz[i] = (Math.random() * 2 - 1) * R }
        py[i] = y
        const t = ph[i]!
        const sway = Math.sin(t * (snow ? 0.9 : 1.6) + i) * (snow ? 0.35 : 0.7)
        v4.set(cx + px[i]! + sway, cy + y, cz + pz[i]! + Math.cos(t * 1.1 + i) * 0.3)
        e4.set(t * (leaves ? 2.4 : 1.2) + i, t * 1.7, t * (leaves ? 1.9 : 0.8))
        m4.compose(v4, q4.setFromEuler(e4), s4.set(size * (leaves ? 0.75 : petalsW), size, size))
        fallMesh.setMatrixAt(i, m4)
      }
      fallMesh.instanceMatrix.needsUpdate = true
    },
  }
  paintFall(SEASONS[season()].fall)
  ctl = api
  return api
}

/** The Seasons & climate panel. */
export function seasonsNodes(h: { para: (t: string, cls?: string) => HTMLElement; button: (label: string, cls: string, on: () => void) => HTMLElement }, close: () => void, toast: (m: string) => void): HTMLElement[] {
  const c = ctl
  if (!c) return [h.para('The seasons are still settling in. Try again in a moment.')]
  const now = c.season
  const out: HTMLElement[] = []
  out.push(h.para(`It's ${SEASONS[now].title.toLowerCase()} in Grind District${c.previewing ? ' (preview)' : `, day ${c.day} of ${DAYS_PER_SEASON}`}. Seasons turn every two in-game days; next comes ${SEASONS[c.next()].title.toLowerCase()}.`))
  const row = document.createElement('div'); row.className = 'chip-row'
  for (const s of ORDER) row.append(h.button(SEASONS[s].title, s === now ? 'primary' : 'ghost', () => { c.preview(s); close(); toast(`${SEASONS[s].title} in the city. Open Seasons & climate to go back to the real season.`) }))
  out.push(row)
  if (c.previewing) out.push(h.button('Back to the real season', 'ghost', () => { c.preview(null); close() }))
  out.push(h.para('Climate change, in this city', 'section-title'))
  out.push(h.para('Pick a future and look round: the beach, the haze, the parks, the weather. Figures are world averages (IPCC, 2021). On a gently sloping beach like ours, every 10 cm of sea-level rise moves the waterline about 3 m inland, more with erosion and storm surges.'))
  const row2 = document.createElement('div'); row2.className = 'chip-row'
  for (const id of Object.keys(CLIMATE) as ClimateId[]) row2.append(h.button(CLIMATE[id].title, id === c.climate ? 'primary' : 'ghost', () => {
    c.setClimate(id); close()
    const k = CLIMATE[id]
    toast(id === 'today' ? 'Back to today.' : `${k.title}: ${k.warming} warmer, sea ${k.sea}. ${k.lines[1]}`)
  }))
  out.push(row2)
  const k = CLIMATE[c.climate]
  out.push(h.para(`${k.title}: warming ${k.warming}; sea level ${k.sea}.`, 'section-title'))
  for (const l of k.lines) out.push(h.para(l))
  out.push(h.para('El Niño and La Niña', 'section-title'))
  out.push(h.para(c.enso === 'neutral' ? 'This is a normal year in the Pacific. Every few in-game years an El Niño or a La Niña year comes round; you can see either one now.' : `This in-game year is ${c.ensoNatural === c.enso ? 'an' : 'previewing an'} ${ENSO[c.enso].title}.`))
  const row3 = document.createElement('div'); row3.className = 'chip-row'
  for (const [id, label] of [['el-nino', 'See an El Niño year'], ['la-nina', 'See a La Niña year'], ['neutral', 'Back to the real year']] as const) row3.append(h.button(label, c.enso === id ? 'primary' : 'ghost', () => {
    c.setEnso(id === 'neutral' ? null : id); close()
    toast(id === 'neutral' ? 'Back to the real year.' : `${ENSO[id].title}: ${ENSO[id].lines[3]}`)
  }))
  out.push(row3)
  if (c.enso !== 'neutral') for (const l of ENSO[c.enso].lines.slice(0, 3)) out.push(h.para(l))
  out.push(h.para('What helps: clean power and transport, efficient homes, protecting forests and wetlands, and planting trees in cities for shade. The lower path is still within reach.'))
  return out
}
