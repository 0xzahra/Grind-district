// Boutique wardrobe: original pieces priced in in-game dollars. Owned + worn items live on this device
// (localStorage) so the save schema stays unchanged. Pieces map onto the rigged models' colour regions
// (top / bottom / shoes) plus a few tiny procedural accessories, so they cost no extra draw-heavy meshes.
export type Slot = 'top' | 'bottom' | 'shoes' | 'acc'
export type Piece = { id: string; slot: Slot; label: string; usd: number; hex: number; for?: 'lady' | 'gent'; model?: 'dress' | 'suit' | 'casual' }
export const PIECES: Piece[] = [
  { id: 'tee-ivory', slot: 'top', label: 'Ivory tee', usd: 0, hex: 0xf1ece2 },
  { id: 'oxford-sky', slot: 'top', label: 'Sky oxford shirt', usd: 40, hex: 0x8fb8e8 },
  { id: 'knit-olive', slot: 'top', label: 'Olive knit', usd: 55, hex: 0x5d6b3a },
  { id: 'blazer-navy', slot: 'top', label: 'Navy blazer', usd: 120, hex: 0x1d2a44 },
  { id: 'agbada-gold', slot: 'top', label: 'Gold-thread kaftan', usd: 180, hex: 0xc8962e },
  { id: 'suit-charcoal', slot: 'top', label: 'Charcoal three-piece suit', usd: 260, hex: 0x2e3136, for: 'gent', model: 'suit' },
  { id: 'suit-cream', slot: 'top', label: 'Cream linen suit', usd: 240, hex: 0xe8dcc4, for: 'gent', model: 'suit' },
  { id: 'dress-emerald', slot: 'top', label: 'Emerald wrap dress', usd: 150, hex: 0x1f6b4f, for: 'lady', model: 'dress' },
  { id: 'dress-blush', slot: 'top', label: 'Blush slip dress', usd: 140, hex: 0xe6a9a0, for: 'lady', model: 'dress' },
  { id: 'dress-ankara', slot: 'top', label: 'Wax-print gown', usd: 210, hex: 0xb5553a, for: 'lady', model: 'dress' },
  { id: 'blouse-silk', slot: 'top', label: 'Silk blouse', usd: 90, hex: 0xf3e3d3, for: 'lady', model: 'casual' },
  { id: 'jeans-indigo', slot: 'bottom', label: 'Indigo jeans', usd: 0, hex: 0x2b3a67 },
  { id: 'chinos-sand', slot: 'bottom', label: 'Sand chinos', usd: 45, hex: 0xcdb48a },
  { id: 'trousers-black', slot: 'bottom', label: 'Tailored black trousers', usd: 70, hex: 0x16171a },
  { id: 'trousers-cream', slot: 'bottom', label: 'Cream wide trousers', usd: 75, hex: 0xe8dcc4 },
  { id: 'sneakers-white', slot: 'shoes', label: 'White sneakers', usd: 0, hex: 0xf2f2f2 },
  { id: 'loafers-brown', slot: 'shoes', label: 'Brown loafers', usd: 85, hex: 0x5a3622 },
  { id: 'heels-black', slot: 'shoes', label: 'Black heels', usd: 95, hex: 0x111111, for: 'lady' },
  { id: 'oxfords-oxblood', slot: 'shoes', label: 'Oxblood oxfords', usd: 110, hex: 0x5a1a1f, for: 'gent' },
  { id: 'watch-steel', slot: 'acc', label: 'Steel watch', usd: 160, hex: 0xc9ccd1 },
  { id: 'shades', slot: 'acc', label: 'Tortoise shades', usd: 65, hex: 0x3a2418 },
  { id: 'cap', slot: 'acc', label: 'Wool cap', usd: 35, hex: 0x2b2f36 },
  { id: 'pearls', slot: 'acc', label: 'Pearl necklace', usd: 220, hex: 0xf4efe6, for: 'lady' },
]
export type Worn = { top?: string; bottom?: string; shoes?: string; acc: string[] }
const KEY = 'gd.wardrobe.v1'
type Store = { owned: string[]; worn: Worn }
const load = (): Store => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? '') as Store; if (s && Array.isArray(s.owned)) return { owned: s.owned, worn: { ...s.worn, acc: s.worn?.acc ?? [] } } } catch { /* fresh */ } return { owned: PIECES.filter((p) => !p.usd).map((p) => p.id), worn: { acc: [] } } }
let store = load()
const save = () => localStorage.setItem(KEY, JSON.stringify(store))
export const owns = (id: string) => store.owned.includes(id) || !PIECES.find((p) => p.id === id)?.usd
export const worn = (): Worn => store.worn
export const piece = (id?: string) => PIECES.find((p) => p.id === id)
export function own(id: string): void { if (!store.owned.includes(id)) { store.owned.push(id); save() } }
export function wear(p: Piece): void {
  if (p.slot === 'acc') { const a = store.worn.acc; store.worn.acc = a.includes(p.id) ? a.filter((x) => x !== p.id) : [...a, p.id] }
  else store.worn[p.slot] = store.worn[p.slot] === p.id ? undefined : p.id
  save()
}
