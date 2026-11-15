// Luxury homes, whole-room looks and premium pieces: the catalogue, what you own, and the Homes panel.
// Everything is paid with in-game dollars. The 3D homes themselves live in homes.ts (loaded on the first visit).
// Kept beside the save (per save slot), so the save format is unchanged.
import { getSave, slotKey, spendInGame } from './state.ts'

export type HomeId = 'duplex' | 'mansion' | 'penthouse' | 'skyhouse'
export const HOMES: Array<{ id: HomeId; title: string; price: number; where: string; pitch: string; icon: string }> = [
  { id: 'duplex', title: 'Garden duplex', price: 9500, where: 'Green edge of town', icon: '🏡', pitch: 'Two floors joined by a glass lift and a floating stair, a walled garden and a plunge pool.' },
  { id: 'mansion', title: 'Hillside mansion', price: 32000, where: 'Hillside, south-east of the city', icon: '🏛️', pitch: 'Three levels joined by an escalator and a glass lift, a double-height hall, a cinema, a roof terrace with an infinity pool and a helipad.' },
  { id: 'penthouse', title: 'Crown penthouse', price: 48000, where: 'Top of the marina tower, 27 m up', icon: '🌇', pitch: 'A glass crown over the marina with an infinity pool on the terrace, looking across the whole district.' },
  { id: 'skyhouse', title: 'Sky house', price: 90000, where: 'Top of the Sky Tower, 110 m up', icon: '🏙️', pitch: 'Two glass floors on the tallest tower in town, a lift between them and an infinity pool that hangs over the city.' },
]

export type StyleId = 'classic' | 'scandi' | 'cotswold' | 'midcentury' | 'hamptons' | 'mayfair' | 'loft' | 'malibu' | 'deco' | 'knightsbridge'
export type Palette = { wall: number; floor: 'oak' | 'walnut' | 'marble' | 'concrete' | 'travertine'; sofa: number; accent: number; rug: number; metal: number; wood: number; art: number }
/** Whole looks: walls, floor, sofas, rugs, lamps and art change together in one tap. Original looks, named after places. */
export const STYLES: Array<{ id: StyleId; title: string; price: number; blurb: string; p: Palette }> = [
  { id: 'classic', title: 'Grind Classic', price: 0, blurb: 'Warm plaster, oak boards and a sand sofa. Every home starts here.', p: { wall: 0xe9e0d0, floor: 'oak', sofa: 0xc9b9a0, accent: 0x8a5a44, rug: 0xd8cbb6, metal: 0x6b5236, wood: 0xb08a62, art: 0x2f5d7c } },
  { id: 'scandi', title: 'Scandi Calm', price: 900, blurb: 'White walls, pale oak, a soft grey sofa and black lamps. Quiet and light.', p: { wall: 0xf3f1ec, floor: 'oak', sofa: 0x9ea3a6, accent: 0xd9cbb3, rug: 0xe4ddd0, metal: 0x1d1f22, wood: 0xd8c09a, art: 0x6f8a7a } },
  { id: 'cotswold', title: 'Cotswold Cottage', price: 1200, blurb: 'Cream walls, honey oak, a sage sofa and terracotta cushions. An English country sitting room.', p: { wall: 0xefe6d2, floor: 'oak', sofa: 0x8fa38a, accent: 0xb8613f, rug: 0xc9a77c, metal: 0x8a6a3a, wood: 0xa97c4f, art: 0x5b7a4a } },
  { id: 'midcentury', title: 'Mid-Century', price: 1600, blurb: 'Walnut, a mustard sofa, teal accents and brass. Sixties America, softened.', p: { wall: 0xf1e9dc, floor: 'walnut', sofa: 0xc99a2e, accent: 0x2f7a78, rug: 0xe2d4bb, metal: 0xb08d3c, wood: 0x6e4a30, art: 0xd2602c } },
  { id: 'hamptons', title: 'Hamptons Coast', price: 2000, blurb: 'Bright white, pale wood, linen sofas and navy stripes. A beach house on Long Island.', p: { wall: 0xf8f8f5, floor: 'oak', sofa: 0xeeeae1, accent: 0x1f3a64, rug: 0xc7d3dd, metal: 0xc9ced3, wood: 0xe0cdaf, art: 0x6aa0c8 } },
  { id: 'mayfair', title: 'Mayfair Townhouse', price: 2600, blurb: 'Deep green walls, a buttoned leather sofa, brass lamps and a Persian-style rug. Old London.', p: { wall: 0x2f4a3e, floor: 'walnut', sofa: 0x6b3a22, accent: 0xa8322a, rug: 0x7a2a26, metal: 0xc8a14a, wood: 0x5a3a26, art: 0xd9b36a } },
  { id: 'loft', title: 'Manhattan Loft', price: 3000, blurb: 'Charcoal walls, polished concrete, a cognac leather sectional and black steel.', p: { wall: 0x4a4b4e, floor: 'concrete', sofa: 0x8a4f26, accent: 0xd8cfc0, rug: 0x2b2c2e, metal: 0x16171a, wood: 0x6b4a32, art: 0xc23b2c } },
  { id: 'malibu', title: 'Malibu Modern', price: 3600, blurb: 'Sand walls, travertine floors, a white boucle sofa and terracotta. California light.', p: { wall: 0xe8dccb, floor: 'travertine', sofa: 0xf2eee6, accent: 0xc0653d, rug: 0xd9c7ad, metal: 0xc6a46a, wood: 0xb79064, art: 0xe0a15c } },
  { id: 'deco', title: 'Art Deco', price: 5200, blurb: 'Black walls, white marble, emerald velvet and gold. A 1920s grand hotel.', p: { wall: 0x17181b, floor: 'marble', sofa: 0x1f6b4e, accent: 0xd4af37, rug: 0x0f3b2c, metal: 0xd4af37, wood: 0x2a1c14, art: 0xd4af37 } },
  { id: 'knightsbridge', title: 'Knightsbridge Gold', price: 9000, blurb: 'Ivory walls, white marble, cream velvet, gold and a crystal chandelier. The top of the market.', p: { wall: 0xf4efe4, floor: 'marble', sofa: 0xefe5d0, accent: 0xc9a24a, rug: 0xe9dcc4, metal: 0xd9b45a, wood: 0x3b2a1e, art: 0xb48a3c } },
]

export type LuxeId = 'piano' | 'chandelier' | 'lounge' | 'sculpture' | 'painting' | 'aquarium' | 'winewall' | 'cinema' | 'fireplace' | 'telescope' | 'palms' | 'barcart'
export const LUXE: Array<{ id: LuxeId; title: string; price: number; blurb: string; icon: string }> = [
  { id: 'palms', title: 'Potted palm trio', price: 350, icon: '🌴', blurb: 'Three kentia palms in stone planters.' },
  { id: 'barcart', title: 'Brass bar cart', price: 420, icon: '🍸', blurb: 'Glass shelves, decanters and two tumblers.' },
  { id: 'telescope', title: 'Brass telescope', price: 650, icon: '🔭', blurb: 'On a walnut tripod. Best by a big window.' },
  { id: 'lounge', title: 'Leather lounge chair', price: 900, icon: '💺', blurb: 'Moulded walnut shell, black leather and an ottoman. A design classic, in its own manner.' },
  { id: 'fireplace', title: 'Marble fireplace', price: 1300, icon: '🔥', blurb: 'A carved surround with a living flame.' },
  { id: 'sculpture', title: 'Marble sculpture', price: 1400, icon: '🗿', blurb: 'An abstract figure on a plinth.' },
  { id: 'chandelier', title: 'Crystal chandelier', price: 1600, icon: '💎', blurb: 'Three tiers of crystal over the living room.' },
  { id: 'winewall', title: 'Wine wall', price: 1900, icon: '🍷', blurb: 'A glass-fronted, lit wall of bottles.' },
  { id: 'aquarium', title: 'Reef aquarium', price: 2200, icon: '🐠', blurb: 'A long tank of coral and slow fish.' },
  { id: 'cinema', title: 'Home cinema wall', price: 2500, icon: '🎬', blurb: 'A wall-sized screen and two recliners.' },
  { id: 'piano', title: 'Grand piano', price: 2800, icon: '🎹', blurb: 'Gloss black, lid up.' },
  { id: 'painting', title: 'Old-master style painting', price: 3600, icon: '🖼️', blurb: 'A gilt-framed landscape in the manner of the Dutch masters (an original, not a copy).' },
]

export type Placed = { key: string; id: string; x: number; z: number; r: number; lv: number }
type Store = { owned: HomeId[]; styles: StyleId[]; style: Partial<Record<HomeId, StyleId>>; luxe: Partial<Record<HomeId, LuxeId[]>>; layout: Partial<Record<HomeId, Record<string, [number, number, number]>>> }
const key = () => `${slotKey()}.homes`
export function readHomes(): Store {
  try { return { owned: [], styles: ['classic'], style: {}, luxe: {}, layout: {}, ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as Partial<Store>) } } catch { return { owned: [], styles: ['classic'], style: {}, luxe: {}, layout: {} } }
}
export function writeHomes(s: Store): void {
  try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ }
  window.dispatchEvent(new Event('gd:homes-changed'))
}
export const ownsHome = (id: HomeId) => readHomes().owned.includes(id)
export const styleOf = (id: HomeId): (typeof STYLES)[number] => STYLES.find((s) => s.id === (readHomes().style[id] ?? 'classic')) ?? STYLES[0]!

export function buyHome(id: HomeId): { ok: boolean; message: string } {
  const h = HOMES.find((x) => x.id === id)!
  const s = readHomes()
  if (s.owned.includes(id)) return { ok: false, message: `The ${h.title.toLowerCase()} is already yours.` }
  const paid = spendInGame(h.price, `Bought the ${h.title.toLowerCase()}`, h.where)
  if (!paid.ok) return paid
  s.owned.push(id)
  writeHomes(s)
  return { ok: true, message: `The ${h.title.toLowerCase()} is yours. Welcome home.` }
}
/** Owning a look lets you apply it to any home you own, as often as you like. */
export function buyStyle(id: StyleId): { ok: boolean; message: string } {
  const st = STYLES.find((x) => x.id === id)!
  const s = readHomes()
  if (s.styles.includes(id)) return { ok: true, message: `${st.title} is already yours.` }
  const paid = spendInGame(st.price, `Bought the ${st.title} look`, 'Whole-room style for your homes')
  if (!paid.ok) return paid
  s.styles.push(id)
  writeHomes(s)
  return { ok: true, message: `${st.title} is yours. Apply it to any home you own.` }
}
export function applyStyle(home: HomeId, id: StyleId): { ok: boolean; message: string } {
  const s = readHomes()
  if (!s.owned.includes(home)) return { ok: false, message: 'Buy the home first.' }
  if (!s.styles.includes(id)) return { ok: false, message: 'Buy the look first, or try it on.' }
  s.style[home] = id
  writeHomes(s)
  return { ok: true, message: `${STYLES.find((x) => x.id === id)!.title} applied.` }
}
export function buyLuxe(home: HomeId, id: LuxeId): { ok: boolean; message: string } {
  const it = LUXE.find((x) => x.id === id)!
  const s = readHomes()
  if (!s.owned.includes(home)) return { ok: false, message: 'Buy the home first.' }
  const list = s.luxe[home] ?? []
  if (list.includes(id)) return { ok: false, message: `The ${it.title.toLowerCase()} is already in this home.` }
  const paid = spendInGame(it.price, `Bought a ${it.title.toLowerCase()}`, HOMES.find((x) => x.id === home)!.title)
  if (!paid.ok) return paid
  s.luxe[home] = [...list, id]
  writeHomes(s)
  return { ok: true, message: `The ${it.title.toLowerCase()} is in. Tap Arrange to move it.` }
}
export function saveLayout(home: HomeId, pieceKey: string, x: number, z: number, r: number): void {
  const s = readHomes()
  const l = (s.layout[home] ??= {})
  l[pieceKey] = [Math.round(x * 100) / 100, Math.round(z * 100) / 100, Math.round(r * 100) / 100]
  writeHomes(s)
}
export function resetLayout(home: HomeId): void { const s = readHomes(); delete s.layout[home]; writeHomes(s) }

// ---------------------------------------------------------------- the Homes panel

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement; finish: (m: string) => void; reopen: () => void }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
const usd = (n: number) => `$${n.toLocaleString('en-US')}`
let tab: 'homes' | 'styles' | 'luxe' = 'homes'
/** Which home the Styles and Luxury tabs act on: the one you are in, else your newest. */
export let homeInView: HomeId | null = null
export function setHomeInView(id: HomeId | null): void { homeInView = id }
const go = (detail: Record<string, unknown>) => window.dispatchEvent(new CustomEvent('gd:home', { detail }))

export function homesNodes(h: H): HTMLElement[] {
  const s = readHomes()
  const bal = getSave().ledger
  const target: HomeId | null = homeInView && s.owned.includes(homeInView) ? homeInView : s.owned[s.owned.length - 1] ?? null
  const tabs = el('div', 'tabs homes-tabs')
  for (const [id, label] of [['homes', 'Homes'], ['styles', 'Styles'], ['luxe', 'Luxury']] as const) tabs.append(h.button(label, tab === id ? 'primary' : 'ghost', () => { tab = id; h.reopen() }))
  const out: HTMLElement[] = [tabs]
  if (tab === 'homes') {
    out.push(h.para(`Grind Realty. Every home is paid with in-game dollars and stays yours. Book a free viewing first. You have ${usd(Math.floor(bal))}.`, 'muted'))
    for (const home of HOMES) {
      const own = s.owned.includes(home.id)
      const card = el('div', 'home-card')
      const head = el('div', 'home-head')
      head.append(el('span', 'home-icon', home.icon), el('b', '', home.title), el('span', 'home-price', own ? 'Yours' : usd(home.price)))
      card.append(head, el('p', 'home-where', home.where), el('p', 'home-pitch', home.pitch))
      const row = el('div', 'home-acts')
      if (own) row.append(h.button('Go home', 'primary', () => go({ op: 'enter', id: home.id })))
      else {
        row.append(h.button('Free viewing', 'ghost', () => go({ op: 'enter', id: home.id, viewing: true })))
        row.append(h.button(`Buy · ${usd(home.price)}`, 'primary', () => { const r = buyHome(home.id); h.finish(r.message); if (r.ok) h.reopen() }))
      }
      card.append(row)
      out.push(card)
    }
  } else if (tab === 'styles') {
    out.push(h.para(target ? `A whole look in one tap for your ${HOMES.find((x) => x.id === target)!.title.toLowerCase()}: walls, floors, sofas, rugs, lamps and art change together. Try any look first; buy it once and use it in every home you own.` : 'Buy a home first. You can still try looks on during a free viewing.', 'muted'))
    const cur = target ? styleOf(target).id : 'classic'
    const grid = el('div', 'style-grid')
    for (const st of STYLES) {
      const own = s.styles.includes(st.id)
      const card = el('div', `style-card${st.id === cur ? ' on' : ''}`)
      const sw = el('div', 'style-swatch')
      for (const c of [st.p.wall, st.p.sofa, st.p.accent, st.p.metal]) { const d = el('i'); d.style.background = `#${c.toString(16).padStart(6, '0')}`; sw.append(d) }
      card.append(sw, el('b', '', st.title), el('span', 'style-blurb', st.blurb), el('span', 'style-price', st.price ? (own ? 'Yours' : usd(st.price)) : 'Free'))
      const acts = el('div', 'style-acts')
      acts.append(h.button('Try', 'ghost', () => go({ op: 'try', style: st.id })))
      if (own && target) acts.append(h.button(st.id === cur ? 'In use' : 'Apply', st.id === cur ? 'ghost' : 'primary', () => { const r = applyStyle(target, st.id); h.finish(r.message); go({ op: 'restyle' }); h.reopen() }))
      else if (!own) acts.append(h.button(`Buy · ${usd(st.price)}`, 'primary', () => { const r = buyStyle(st.id); if (r.ok && target) applyStyle(target, st.id); h.finish(r.message); go({ op: 'restyle' }); h.reopen() }))
      card.append(acts)
      grid.append(card)
    }
    out.push(grid)
  } else {
    out.push(h.para(target ? `Premium pieces for your ${HOMES.find((x) => x.id === target)!.title.toLowerCase()}. Each one goes in at once; tap Arrange in the home to move it.` : 'Buy a home first, then furnish it here.', 'muted'))
    const have = target ? s.luxe[target] ?? [] : []
    const grid = el('div', 'luxe-grid')
    for (const it of LUXE) {
      const card = el('div', 'luxe-card')
      card.append(el('span', 'luxe-icon', it.icon), el('b', '', it.title), el('span', 'luxe-blurb', it.blurb))
      if (have.includes(it.id)) card.append(el('span', 'luxe-price', 'In your home'))
      else card.append(h.button(usd(it.price), 'primary', () => { if (!target) { h.finish('Buy a home first.'); return } const r = buyLuxe(target, it.id); h.finish(r.message); if (r.ok) go({ op: 'restyle' }); h.reopen() }))
      grid.append(card)
    }
    out.push(grid)
  }
  return out
}
