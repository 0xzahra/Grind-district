// The one map of the whole district (the Map panel): the city centre as a satellite view with its places, the
// Grind Metro loop and its stations, Grind Park with the zoo, golf and rides to the south-west, and Grind
// International Airport with the spaceport, the cliffs and the drop zone to the east. Drag to move, pinch or
// scroll (or + and -) to zoom; tap any place to go straight there.
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
export type CityPin = { title: string; x: number; z: number; id?: string; kind?: string }
export type CityLayer = { url: string; limit: number; pins: CityPin[]; me?: { x: number; z: number } }
const KIND: Record<string, string> = { health: '#e0525a', stay: '#c9a25e', shop: '#e08a3c', travel: '#3f86e0', home: '#9a6be0', fun: '#1fb873', learn: '#d6b25e', place: '#e9cf8e' }

/** The single district map, and (hidden behind 'Show list of places') rows for the places beyond the centre. */
export function districtMapNodes(button: Btn, o: { city?: CityLayer; goFar: (p: FarPlace) => void; goPin: (p: CityPin) => void }): HTMLElement[] {
  const wrap = document.createElement('div'); wrap.className = 'region-map'
  const svg = s('svg', { viewBox: `${VB.x0} ${VB.z0} ${VB.w} ${VB.h}`, role: 'img', 'aria-label': 'Map of the whole district: the city centre, the metro, Grind Park and Grind International Airport' })
  const defs = s('defs', {})
  const sea = s('linearGradient', { id: 'rm-sea', x1: 0, y1: 0, x2: 0, y2: 1 }); sea.append(s('stop', { offset: 0, 'stop-color': '#0d2f4a' }), s('stop', { offset: 1, 'stop-color': '#1a4a6a' }))
  const land = s('radialGradient', { id: 'rm-land', cx: 0.35, cy: 0.45, r: 0.8 }); land.append(s('stop', { offset: 0, 'stop-color': '#1d2a22' }), s('stop', { offset: 1, 'stop-color': '#121a16' }))
  const clip = s('clipPath', { id: 'rm-cityclip' }); clip.append(s('rect', { x: -62, y: -62, width: 124, height: 124, rx: 8 }))
  defs.append(sea, land, clip); svg.append(defs)
  svg.append(s('rect', { x: VB.x0 - 400, y: VB.z0 - 400, width: VB.w + 800, height: VB.h + 800, fill: 'url(#rm-land)' }))
  svg.append(s('rect', { x: VB.x0 - 400, y: VB.z0 - 400, width: VB.w + 800, height: 434, fill: 'url(#rm-sea)' }))
  svg.append(s('rect', { x: VB.x0 - 400, y: VB.z0 + 34, width: VB.w + 800, height: 5, fill: '#cdb58a', opacity: 0.55 }))
  for (let i = 0; i < 9; i++) svg.append(s('path', { d: `M${VB.x0 + 20 + i * 64} ${VB.z0 + 14 + (i % 2) * 8} q8 -4 16 0 t16 0`, stroke: 'rgba(170,210,240,.35)', fill: 'none', 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }))
  svg.append(s('text', { x: VB.x0 + 10, y: VB.z0 + 24, class: 'rm-water' }, 'THE BAY'))
  svg.append(s('rect', { x: X(-244), y: 90, width: 140, height: 112, rx: 22, fill: '#1f4a2e', stroke: '#3c7a4e', 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }))
  svg.append(s('ellipse', { cx: X(-178), cy: 168, rx: 16, ry: 9, fill: '#2b6a8a', opacity: 0.8 }))
  svg.append(s('text', { x: X(-238), y: 103, class: 'rm-area' }, 'PARK & ZOO'))
  svg.append(s('rect', { x: X(134), y: -78, width: X(470) - X(134), height: 206, rx: 14, fill: '#232a2c', stroke: '#3e4a4e', 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }))
  svg.append(s('rect', { x: X(150), y: 106, width: X(430) - X(150), height: 9, rx: 2, fill: '#3a4245' }))
  for (let x = 160; x < 420; x += 24) svg.append(s('rect', { x: X(x), y: 110, width: 7, height: 1.2, fill: '#e8e2d0', opacity: 0.8 }))
  svg.append(s('text', { x: X(140), y: -66, class: 'rm-area' }, 'GRIND INTERNATIONAL'))
  // The city centre: the satellite view of the streets, or a plain block until it is ready.
  if (o.city?.url) {
    const L = o.city.limit
    svg.append(s('image', { href: o.city.url, x: -L, y: -L, width: L * 2, height: L * 2, preserveAspectRatio: 'none', 'clip-path': 'url(#rm-cityclip)' }))
  } else svg.append(s('rect', { x: -62, y: -62, width: 124, height: 124, rx: 8, fill: '#2a2f2c' }))
  svg.append(s('rect', { x: -62, y: -62, width: 124, height: 124, rx: 8, fill: 'none', stroke: '#d6b25e', 'stroke-width': 1.6, 'vector-effect': 'non-scaling-stroke' }))
  svg.append(s('path', { d: loopPath(CTRL), fill: 'none', stroke: '#0b100d', 'stroke-width': 6, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }))
  svg.append(s('path', { d: loopPath(CTRL), fill: 'none', stroke: '#e0b04c', 'stroke-width': 3, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }))
  // Pins keep their size on screen at any zoom: each is drawn at the origin and placed with translate + scale.
  const pins: Array<{ g: SVGGElement; x: number; z: number; city: boolean }> = []
  let dragged = false
  const pin = (x: number, z: number, cls: string, label: string, onTap: (() => void) | null, opts: { r?: number; glyph?: string; fill?: string; side?: boolean; city?: boolean } = {}) => {
    const g = s('g', { class: cls, ...(onTap ? { role: 'button', tabindex: 0, 'aria-label': label } : {}) }) as SVGGElement
    const r = opts.r ?? 6
    g.append(s('circle', { cx: 0, cy: 0, r, ...(opts.fill ? { fill: opts.fill } : {}) }))
    if (opts.glyph) g.append(s('text', { x: 0, y: r * 0.42, 'text-anchor': 'middle', class: 'rm-glyph' }, opts.glyph))
    if (label) g.append(s('text', opts.side ? { x: r + 4, y: 3.5, class: 'rm-station' } : { x: 0, y: r + 11, 'text-anchor': 'middle', class: 'rm-label' }, label))
    if (onTap) {
      g.addEventListener('click', () => { if (!dragged) onTap() })
      g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') onTap() })
    }
    svg.append(g); pins.push({ g, x, z, city: !!opts.city })
  }
  for (const st of STATIONS) pin(X(st.at[0]), st.at[1], 'rm-stn', st.id === 'park' || st.id === 'airport' ? '' : st.title, null, { r: 4, fill: '#fff', side: true })
  for (const c of o.city?.pins ?? []) pin(c.x, c.z, 'rm-pin rm-citypin', c.title, () => o.goPin(c), { r: 5.5, fill: KIND[c.kind ?? 'place'] ?? KIND.place, city: true })
  for (const p of FAR) pin(X(p.x), p.z, `rm-pin rm-${p.kind}`, p.title, () => o.goFar(p), { r: 10, glyph: p.glyph, side: p.id === 'park' || p.id === 'airport' })
  if (o.city?.me) pin(o.city.me.x, o.city.me.z, 'rm-me', '', null, { r: 5, fill: '#4fa3ff' })
  wrap.append(svg)

  // Pan and zoom by moving the viewBox (crisp at every zoom).
  const view = { x: VB.x0, y: VB.z0, w: VB.w }
  const aspect = 0.8 // a taller window than the district's own shape, so it reads well on a phone
  const apply = () => {
    view.w = Math.max(70, Math.min(VB.w, view.w))
    const h = view.w * aspect
    view.x = Math.max(VB.x0, Math.min(VB.x0 + VB.w - view.w, view.x))
    view.y = h >= VB.h ? VB.z0 - (h - VB.h) / 2 : Math.max(VB.z0, Math.min(VB.z0 + VB.h - h, view.y))
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${h}`)
    const u = view.w / Math.max(1, svg.clientWidth || 340)
    for (const p of pins) p.g.setAttribute('transform', `translate(${p.x} ${p.z}) scale(${u})`)
    // City labels only once the centre is big enough to read them.
    svg.classList.toggle('rm-wide', view.w > 230)
  }
  const zoomAt = (f: number, cx = view.x + view.w / 2, cy = view.y + view.w * aspect / 2) => {
    const nw = Math.max(70, Math.min(VB.w, view.w / f)); const k = nw / view.w
    view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.w = nw; apply()
  }
  const toUnits = (px: number) => px * view.w / Math.max(1, svg.clientWidth || 340)
  const pts = new Map<number, { x: number; y: number }>()
  let pinch0 = 0, moved = 0
  svg.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; dragged = false; if (pts.size === 2) { const [a1, b1] = [...pts.values()]; pinch0 = Math.hypot(a1!.x - b1!.x, a1!.y - b1!.y) } })
  svg.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId); if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }; pts.set(e.pointerId, cur)
    if (pts.size === 2) { const [a1, b1] = [...pts.values()]; const d = Math.hypot(a1!.x - b1!.x, a1!.y - b1!.y); if (pinch0) { zoomAt(d / pinch0); pinch0 = d } dragged = true; return }
    moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y)
    if (moved > 6) { dragged = true; if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId) }
    if (dragged) { view.x -= toUnits(cur.x - prev.x); view.y -= toUnits(cur.y - prev.y); apply() }
  })
  const end = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; window.setTimeout(() => { if (!pts.size) dragged = false }, 0) }
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end)
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, view.x + (e.clientX - r.left) * view.w / r.width, view.y + (e.clientY - r.top) * view.w * aspect / r.height) }, { passive: false })
  const zoom = document.createElement('div'); zoom.className = 'sat-zoom'
  for (const [t, f] of [['+', 1.5], ['−', 1 / 1.5]] as const) { const zb = document.createElement('button'); zb.type = 'button'; zb.textContent = t; zb.setAttribute('aria-label', t === '+' ? 'Zoom in' : 'Zoom out'); zb.onclick = () => zoomAt(f); zoom.append(zb) }
  const all = document.createElement('button'); all.type = 'button'; all.textContent = '⤢'; all.setAttribute('aria-label', 'Whole district'); all.onclick = () => { view.x = VB.x0; view.y = VB.z0; view.w = VB.w; apply() }
  zoom.append(all); wrap.append(zoom)
  // Open on the player in the city centre; anywhere else, on the whole district.
  requestAnimationFrame(() => {
    const me = o.city?.me
    if (me) { view.w = 150; view.x = me.x - 75; view.y = me.z - 75 * aspect } else { view.x = VB.x0; view.y = VB.z0; view.w = VB.w }
    apply()
  })
  apply()
  const cap = document.createElement('small'); cap.className = 'region-cap'; cap.textContent = 'Drag to move, pinch or scroll to zoom, ⤢ for the whole district. The gold line is the Grind Metro. Tap any place to go there.'
  const out: HTMLElement[] = [wrap, cap]
  for (const p of FAR) {
    const row = document.createElement('div'); row.className = 'map-entry region-row'
    const b = button(`${p.glyph}  ${p.title}`, 'ghost', () => o.goFar(p))
    const t = document.createElement('small'); t.textContent = p.text
    row.append(b, t); out.push(row)
  }
  return out
}
