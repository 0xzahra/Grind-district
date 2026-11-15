// "Beyond the centre": a transit-style map of the whole district for the Map panel. The satellite map covers the
// city centre; this one shows the Grind Metro loop and what lies out along it: Grind Park with the zoo, golf
// and rides to the south-west, and Grind International Airport with the spaceport, the cliffs and the drop zone
// to the east. Tap a place (on the map or in the list) to go straight there.
import { CTRL, STATIONS } from './metroRoute.ts'

export type FarPlace = { id: string; area: 'park' | 'airport'; title: string; glyph: string; kind: 'fun' | 'nature' | 'travel' | 'thrill'; x: number; z: number; at?: [number, number]; text: string }
export const FAR: FarPlace[] = [
  { id: 'park', area: 'park', title: 'Grind Park', glyph: '🎡', kind: 'fun', x: -122, z: 128, text: 'Ferris wheel, carousel, coaster, water slides, a lake and ice cream.' },
  { id: 'wheel', area: 'park', title: 'Ferris wheel & carousel', glyph: '🎠', kind: 'fun', x: -145, z: 150, at: [-128, 142.4], text: 'A slow turn over the whole district, then the carousel.' },
  { id: 'coaster', area: 'park', title: 'Roller coaster', glyph: '🎢', kind: 'thrill', x: -171, z: 116, at: [-171, 117.8], text: 'Lift hill, drop and loop.' },
  { id: 'zoo', area: 'park', title: 'Grind Zoo & safari', glyph: '🦒', kind: 'nature', x: -208, z: 137, at: [-208, 135.6], text: 'Giraffes, zebras, elephants, lions and flamingos, from an open-top safari tram.' },
  { id: 'golf', area: 'park', title: 'Golf course', glyph: '⛳', kind: 'nature', x: -226, z: 183, at: [-226, 181.6], text: 'Three holes on the west lawn. Swing meter, real ball flight.' },
  { id: 'picnic', area: 'park', title: 'Picnic lawn', glyph: '🧺', kind: 'nature', x: -115, z: 184, at: [-115, 182.2], text: 'A blanket, a basket and the lake.' },
  { id: 'airport', area: 'airport', title: 'Grind International', glyph: '✈', kind: 'travel', x: 150, z: 14, text: 'Check in for economy, business or first; flights over the city and out to sea.' },
  { id: 'jet', area: 'airport', title: 'Party jet lounge', glyph: '🥂', kind: 'fun', x: 213, z: 49, at: [213, 47.2], text: 'Charter Grind One with a DJ and a dance floor at altitude.' },
  { id: 'space', area: 'airport', title: 'Spaceport · orbit flight', glyph: '🚀', kind: 'thrill', x: 382, z: -34, at: [203.2, -18], text: 'Book at the Grind Orbital desk: launch, orbit over Earth and splashdown.' },
  { id: 'cliff', area: 'airport', title: 'Cliff climbing', glyph: '🧗', kind: 'thrill', x: 446, z: -66, at: [440, -67], text: 'Guided climb up a 34 m sea cliff, then abseil down.' },
  { id: 'skydive', area: 'airport', title: 'Skydiving', glyph: '🪂', kind: 'thrill', x: 258, z: 92, at: [251, 101], text: 'Tandem-style briefing, the door, freefall, canopy and a flared landing.' },
]

// The airport grounds run far east; squeeze everything past x = 200 so the map stays readable on a phone.
const X = (x: number) => (x < 200 ? x : 200 + (x - 200) * 0.45)
const VB = { x0: -274, z0: -112, w: 640, h: 336 }
const svgNS = 'http://www.w3.org/2000/svg'
const s = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) => {
  const e = document.createElementNS(svgNS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  if (text) e.textContent = text
  return e
}
/** A smooth closed path through the metro control points (Catmull-Rom as cubic Béziers). */
function loopPath(pts: Array<[number, number]>): string {
  const P = pts.map(([x, z]) => [X(x), z] as const)
  let d = `M${P[0]![0]} ${P[0]![1]}`
  for (let i = 0; i < P.length; i++) {
    const p0 = P[(i - 1 + P.length) % P.length]!, p1 = P[i]!, p2 = P[(i + 1) % P.length]!, p3 = P[(i + 2) % P.length]!
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`
  }
  return `${d} Z`
}

type Btn = (text: string, c: string, f: () => void) => HTMLElement
/** The region map and the list of places beyond the centre. `go` takes you there. */
export function regionMapNodes(button: Btn, go: (p: FarPlace) => void, goCity: () => void): HTMLElement[] {
  const wrap = document.createElement('div'); wrap.className = 'region-map'
  const svg = s('svg', { viewBox: `${VB.x0} ${VB.z0} ${VB.w} ${VB.h}`, role: 'img', 'aria-label': 'Map of the whole district: the city centre, Grind Park and Grind International Airport on the metro' })
  const defs = s('defs', {})
  const sea = s('linearGradient', { id: 'rm-sea', x1: 0, y1: 0, x2: 0, y2: 1 }); sea.append(s('stop', { offset: 0, 'stop-color': '#0d2f4a' }), s('stop', { offset: 1, 'stop-color': '#1a4a6a' }))
  const land = s('radialGradient', { id: 'rm-land', cx: 0.35, cy: 0.45, r: 0.8 }); land.append(s('stop', { offset: 0, 'stop-color': '#1d2a22' }), s('stop', { offset: 1, 'stop-color': '#121a16' }))
  defs.append(sea, land); svg.append(defs)
  svg.append(s('rect', { x: VB.x0, y: VB.z0, width: VB.w, height: VB.h, fill: 'url(#rm-land)' }))
  // The sea along the north, the beach, and a few wave strokes.
  svg.append(s('rect', { x: VB.x0, y: VB.z0, width: VB.w, height: 34, fill: 'url(#rm-sea)' }))
  svg.append(s('rect', { x: VB.x0, y: VB.z0 + 34, width: VB.w, height: 5, fill: '#cdb58a', opacity: 0.55 }))
  for (let i = 0; i < 9; i++) svg.append(s('path', { d: `M${VB.x0 + 20 + i * 64} ${VB.z0 + 14 + (i % 2) * 8} q8 -4 16 0 t16 0`, stroke: 'rgba(170,210,240,.35)', fill: 'none', 'stroke-width': 1.2 }))
  svg.append(s('text', { x: VB.x0 + 10, y: VB.z0 + 24, class: 'rm-water' }, 'THE BAY'))
  // Grind Park: lawns, the lake.
  svg.append(s('rect', { x: X(-244), y: 90, width: 140, height: 112, rx: 22, fill: '#1f4a2e', stroke: '#3c7a4e', 'stroke-width': 1.2 }))
  svg.append(s('ellipse', { cx: X(-178), cy: 168, rx: 16, ry: 9, fill: '#2b6a8a', opacity: 0.8 }))
  svg.append(s('text', { x: X(-238), y: 103, class: 'rm-area' }, 'PARK & ZOO'))
  // The airport: apron and runway.
  svg.append(s('rect', { x: X(134), y: -78, width: X(470) - X(134), height: 206, rx: 14, fill: '#232a2c', stroke: '#3e4a4e', 'stroke-width': 1.2 }))
  svg.append(s('rect', { x: X(150), y: 106, width: X(430) - X(150), height: 9, rx: 2, fill: '#3a4245' }))
  for (let x = 160; x < 420; x += 24) svg.append(s('rect', { x: X(x), y: 110, width: 7, height: 1.2, fill: '#e8e2d0', opacity: 0.8 }))
  svg.append(s('text', { x: X(140), y: -66, class: 'rm-area' }, 'GRIND INTERNATIONAL'))
  // The city centre block (the satellite map above covers it in detail).
  const city = s('g', { class: 'rm-city', role: 'button', tabindex: 0, 'aria-label': 'City centre' })
  city.append(s('rect', { x: -62, y: -62, width: 124, height: 124, rx: 10, fill: '#2a2f2c', stroke: '#d6b25e', 'stroke-width': 1.4 }))
  for (let i = -48; i <= 48; i += 16) { city.append(s('line', { x1: i, y1: -58, x2: i, y2: 58, stroke: 'rgba(255,255,255,.07)' })); city.append(s('line', { x1: -58, y1: i, x2: 58, y2: i, stroke: 'rgba(255,255,255,.07)' })) }
  city.append(s('text', { x: 0, y: 4, class: 'rm-city-t', 'text-anchor': 'middle' }, 'CITY CENTRE'))
  city.addEventListener('click', goCity)
  svg.append(city)
  // The metro loop and its stations.
  svg.append(s('path', { d: loopPath(CTRL), fill: 'none', stroke: '#0b100d', 'stroke-width': 7, 'stroke-linejoin': 'round' }))
  svg.append(s('path', { d: loopPath(CTRL), fill: 'none', stroke: '#e0b04c', 'stroke-width': 3.6, 'stroke-linejoin': 'round' }))
  for (const st of STATIONS) {
    const [x, z] = st.at
    svg.append(s('circle', { cx: X(x), cy: z, r: 5, fill: '#fff', stroke: '#0b100d', 'stroke-width': 2 }))
    if (st.id !== 'park' && st.id !== 'airport') svg.append(s('text', { x: x < -30 ? X(x) - 8 : X(x) + 8, y: z - 6, class: 'rm-station', 'text-anchor': x < -30 ? 'end' : 'start' }, st.title))
  }
  // Places beyond the centre.
  for (const p of FAR) {
    const g = s('g', { class: `rm-pin rm-${p.kind}`, role: 'button', tabindex: 0, 'aria-label': p.title })
    g.append(s('circle', { cx: X(p.x), cy: p.z, r: 10 }))
    g.append(s('text', { x: X(p.x), y: p.z + 4.2, 'text-anchor': 'middle', class: 'rm-glyph' }, p.glyph))
    if (p.id === 'park' || p.id === 'airport') g.append(s('text', { x: X(p.x) + 14, y: p.z + 4, class: 'rm-station' }, p.title))
    else g.append(s('text', { x: X(p.x), y: p.z + 22, 'text-anchor': 'middle', class: 'rm-label' }, p.title))
    g.addEventListener('click', () => go(p))
    g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') go(p) })
    svg.append(g)
  }
  wrap.append(svg)
  const cap = document.createElement('small'); cap.className = 'region-cap'; cap.textContent = 'The Grind Metro loop (gold) runs round the centre and out to the park and the airport. Tap a place to go there.'
  const out: HTMLElement[] = [wrap, cap]
  for (const [area, title] of [['park', 'Grind Park · by metro'], ['airport', 'Grind International Airport · by metro']] as const) {
    const h = document.createElement('h3'); h.className = 'region-h'; h.textContent = title; out.push(h)
    for (const p of FAR.filter((f) => f.area === area)) {
      const row = document.createElement('div'); row.className = 'region-row'
      const b = button(`${p.glyph}  ${p.title}`, 'ghost', () => go(p))
      const t = document.createElement('small'); t.textContent = p.text
      row.append(b, t); out.push(row)
    }
  }
  return out
}
