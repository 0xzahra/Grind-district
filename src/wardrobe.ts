// Boutique wardrobe. Everyday clothes are free; only the Runway collection (complete premium looks) and fine
// jewellery are paid, in in-game dollars. Owned + worn items live on this device
// (localStorage) so the save schema stays unchanged. Pieces map onto the rigged models' colour regions
// (top / bottom / shoes) plus a few tiny procedural accessories, so they cost no extra draw-heavy meshes.
export type Slot = 'look' | 'top' | 'bottom' | 'shoes' | 'acc'
/** Jewellery kinds: one of each is worn at a time. */
export type Jewel = 'earrings' | 'necklace' | 'ring' | 'watch'
export type Piece = {
  id: string; slot: Slot; label: string; usd: number; hex: number; for?: 'lady' | 'gent'; model?: 'dress' | 'suit' | 'casual'
  /** A complete look: the figure that wears it, and the colours it is cut in (none = the figure's own clothes). */
  figure?: string; palette?: { top?: number; bottom?: number; shoes?: number }
  kind?: Jewel
  note?: string
}
export const PIECES: Piece[] = [
  // ---- Free looks: the outfits the city's own figures already wear, exactly as they come ----
  { id: 'free-shirt', slot: 'look', label: 'Blue shirt & jeans', usd: 0, hex: 0x9db6d6, for: 'gent', figure: 'man1' },
  { id: 'free-denim', slot: 'look', label: 'Denim jacket & jeans', usd: 0, hex: 0x4a6a92, for: 'gent', figure: 'man2' },
  { id: 'free-bomber', slot: 'look', label: 'Bomber & hoodie', usd: 0, hex: 0x2b2f2c, for: 'gent', figure: 'man3' },
  { id: 'free-office', slot: 'look', label: 'Charcoal office suit', usd: 0, hex: 0x33363b, for: 'gent', figure: 'man4' },
  { id: 'free-kurta', slot: 'look', label: 'White kurta & kufi', usd: 0, hex: 0xe9e2d4, for: 'gent', figure: 'kurta' },
  { id: 'free-blouse', slot: 'look', label: 'Pink shirt & jeans', usd: 0, hex: 0xd98aa0, for: 'lady', figure: 'woman3' },
  { id: 'free-dress', slot: 'look', label: 'Knit dress & boots', usd: 0, hex: 0x5a3a2c, for: 'lady', figure: 'woman4' },
  { id: 'free-trouser-suit', slot: 'look', label: 'Trouser suit', usd: 0, hex: 0x1f2227, for: 'lady', figure: 'woman1' },
  { id: 'free-tunic', slot: 'look', label: 'Hijab & long tunic', usd: 0, hex: 0x7a7038, for: 'lady', figure: 'woman2' },
  { id: 'free-abaya', slot: 'look', label: 'Black abaya', usd: 0, hex: 0x1a1c22, for: 'lady', figure: 'abaya' },
  // ---- Premium: the Runway collection (complete looks) ----
  { id: 'run-evening-emerald', slot: 'look', label: 'Emerald evening set', usd: 520, hex: 0x1f6b4f, for: 'lady', figure: 'look_gown', palette: { top: 0x1f6b4f, bottom: 0x1f6b4f, shoes: 0x16171a }, note: 'Satin camisole and wide trousers in one colour' },
  { id: 'run-evening-champagne', slot: 'look', label: 'Champagne evening set', usd: 520, hex: 0xd9c3a0, for: 'lady', figure: 'look_gown', palette: { top: 0xd9c3a0, bottom: 0xd9c3a0, shoes: 0xb8955a } },
  { id: 'run-evening-noir', slot: 'look', label: 'Noir evening set', usd: 520, hex: 0x16171a, for: 'lady', figure: 'look_gown', palette: { top: 0x16171a, bottom: 0x16171a, shoes: 0x16171a } },
  { id: 'run-skirtsuit-ivory', slot: 'look', label: 'Ivory atelier skirt suit', usd: 420, hex: 0xf1ece2, for: 'lady', figure: 'look_skirtsuit', palette: { top: 0xf1ece2, bottom: 0xf1ece2 } },
  { id: 'run-skirtsuit-camel', slot: 'look', label: 'Camel atelier skirt suit', usd: 420, hex: 0x8a6a52, for: 'lady', figure: 'look_skirtsuit' },
  { id: 'run-pencil-silk', slot: 'look', label: 'Silk blouse & pencil skirt', usd: 360, hex: 0xf3e3d3, for: 'lady', figure: 'look_pencil', palette: { top: 0xf3e3d3, bottom: 0x16171a } },
  { id: 'run-soiree-ruby', slot: 'look', label: 'Ruby soirée set', usd: 390, hex: 0x8a1f2e, for: 'lady', figure: 'look_party', palette: { top: 0x8a1f2e, bottom: 0x16171a } },
  { id: 'run-abaya-pearl', slot: 'look', label: 'Pearl couture abaya', usd: 480, hex: 0xe9e2d4, for: 'lady', figure: 'abaya', palette: { top: 0xe9e2d4 } },
  { id: 'run-abaya-emerald', slot: 'look', label: 'Emerald couture abaya', usd: 480, hex: 0x1f4f44, for: 'lady', figure: 'abaya', palette: { top: 0x1f4f44 } },
  { id: 'run-abaya-burgundy', slot: 'look', label: 'Burgundy couture abaya', usd: 480, hex: 0x5a1f2c, for: 'lady', figure: 'abaya', palette: { top: 0x5a1f2c } },
  { id: 'run-tunic-teal', slot: 'look', label: 'Teal embroidered tunic', usd: 340, hex: 0x2f6a6a, for: 'lady', figure: 'woman2', palette: { top: 0x2f6a6a } },
  { id: 'run-tux-midnight', slot: 'look', label: 'Midnight tuxedo', usd: 560, hex: 0x14161a, for: 'gent', figure: 'look_tux' },
  { id: 'run-tux-ivory', slot: 'look', label: 'Ivory dinner jacket', usd: 560, hex: 0xf1ece2, for: 'gent', figure: 'look_tux', palette: { top: 0xf1ece2, bottom: 0x16171a } },
  { id: 'run-navy', slot: 'look', label: 'Navy tailored suit', usd: 480, hex: 0x1d2a44, for: 'gent', figure: 'look_navy' },
  { id: 'run-thobe-white', slot: 'look', label: 'Royal white thobe', usd: 460, hex: 0xf2efe8, for: 'gent', figure: 'look_thobe' },
  { id: 'run-thobe-sand', slot: 'look', label: 'Sand royal thobe', usd: 460, hex: 0xc4a574, for: 'gent', figure: 'look_thobe', palette: { top: 0xc4a574 } },
  { id: 'tee-ivory', slot: 'top', label: 'Ivory tee', usd: 0, hex: 0xf1ece2 },
  { id: 'oxford-sky', slot: 'top', label: 'Sky oxford shirt', usd: 0, hex: 0x8fb8e8 },
  { id: 'knit-olive', slot: 'top', label: 'Olive knit', usd: 0, hex: 0x5d6b3a },
  { id: 'blazer-navy', slot: 'top', label: 'Navy blazer', usd: 0, hex: 0x1d2a44 },
  { id: 'kaftan-sand', slot: 'top', label: 'Sand kaftan', usd: 0, hex: 0xc4a574 },
  { id: 'abaya-ink', slot: 'top', label: 'Ink abaya', usd: 0, hex: 0x1a1c22, for: 'lady', model: 'dress' },
  { id: 'abaya-rose', slot: 'top', label: 'Rose abaya', usd: 0, hex: 0xd4a0b0, for: 'lady', model: 'dress' },
  { id: 'agbada-gold', slot: 'top', label: 'Gold-thread kaftan', usd: 0, hex: 0xc8962e },
  { id: 'suit-charcoal', slot: 'top', label: 'Charcoal three-piece suit', usd: 0, hex: 0x2e3136, for: 'gent', model: 'suit' },
  { id: 'suit-cream', slot: 'top', label: 'Cream linen suit', usd: 0, hex: 0xe8dcc4, for: 'gent', model: 'suit' },
  { id: 'dress-emerald', slot: 'top', label: 'Emerald wrap dress', usd: 0, hex: 0x1f6b4f, for: 'lady', model: 'dress' },
  { id: 'dress-blush', slot: 'top', label: 'Blush slip dress', usd: 0, hex: 0xe6a9a0, for: 'lady', model: 'dress' },
  { id: 'dress-ankara', slot: 'top', label: 'Wax-print gown', usd: 0, hex: 0xb5553a, for: 'lady', model: 'dress' },
  { id: 'blouse-silk', slot: 'top', label: 'Silk blouse', usd: 0, hex: 0xf3e3d3, for: 'lady', model: 'casual' },
  { id: 'jeans-indigo', slot: 'bottom', label: 'Indigo jeans', usd: 0, hex: 0x2b3a67 },
  { id: 'chinos-sand', slot: 'bottom', label: 'Sand chinos', usd: 0, hex: 0xcdb48a },
  { id: 'trousers-black', slot: 'bottom', label: 'Tailored black trousers', usd: 0, hex: 0x16171a },
  { id: 'trousers-cream', slot: 'bottom', label: 'Cream wide trousers', usd: 0, hex: 0xe8dcc4 },
  { id: 'sneakers-white', slot: 'shoes', label: 'White sneakers', usd: 0, hex: 0xf2f2f2 },
  { id: 'loafers-brown', slot: 'shoes', label: 'Brown loafers', usd: 0, hex: 0x5a3622 },
  { id: 'heels-black', slot: 'shoes', label: 'Black heels', usd: 0, hex: 0x111111, for: 'lady' },
  { id: 'oxfords-oxblood', slot: 'shoes', label: 'Oxblood oxfords', usd: 0, hex: 0x5a1a1f, for: 'gent' },
  { id: 'watch-steel', slot: 'acc', label: 'Steel watch', usd: 160, hex: 0xc9ccd1, kind: 'watch' },
  { id: 'shades', slot: 'acc', label: 'Tortoise shades', usd: 0, hex: 0x3a2418 },
  { id: 'cap', slot: 'acc', label: 'Wool cap', usd: 0, hex: 0x2b2f36 },
  { id: 'pearls', slot: 'acc', label: 'Pearl necklace', usd: 220, hex: 0xf4efe6, for: 'lady', kind: 'necklace' },
  // ---- Premium jewellery: measured to each figure's own ears, neck, wrist and finger ----
  { id: 'ear-studs', slot: 'acc', label: 'Pearl studs', usd: 140, hex: 0xf4efe6, for: 'lady', kind: 'earrings' },
  { id: 'ear-hoops', slot: 'acc', label: 'Gold hoops', usd: 180, hex: 0xd9b26a, for: 'lady', kind: 'earrings' },
  { id: 'ear-drops', slot: 'acc', label: 'Diamond drops', usd: 420, hex: 0xe8f4ff, for: 'lady', kind: 'earrings' },
  { id: 'neck-chain', slot: 'acc', label: 'Gold chain', usd: 260, hex: 0xd9b26a, kind: 'necklace' },
  { id: 'neck-pendant', slot: 'acc', label: 'Diamond pendant', usd: 520, hex: 0xe8f4ff, kind: 'necklace' },
  { id: 'ring-band', slot: 'acc', label: 'Gold band', usd: 150, hex: 0xd9b26a, kind: 'ring' },
  { id: 'ring-solitaire', slot: 'acc', label: 'Diamond solitaire', usd: 480, hex: 0xe8f4ff, for: 'lady', kind: 'ring' },
  { id: 'ring-signet', slot: 'acc', label: 'Gold signet ring', usd: 210, hex: 0xd9b26a, for: 'gent', kind: 'ring' },
  { id: 'watch-rose', slot: 'acc', label: 'Rose-gold watch', usd: 380, hex: 0xd9a08a, kind: 'watch' },
  { id: 'watch-gold', slot: 'acc', label: 'Gold watch', usd: 540, hex: 0xd9b26a, kind: 'watch' },
]
export type Worn = { look?: string; top?: string; bottom?: string; shoes?: string; acc: string[] }
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
  if (p.slot === 'acc') {
    const a = store.worn.acc
    if (a.includes(p.id)) store.worn.acc = a.filter((x) => x !== p.id)
    // One of each kind of jewellery at a time: a new necklace replaces the old one.
    else store.worn.acc = [...a.filter((x) => !p.kind || PIECES.find((q) => q.id === x)?.kind !== p.kind), p.id]
  } else if (p.slot === 'look') {
    store.worn.look = store.worn.look === p.id ? undefined : p.id
  } else {
    store.worn[p.slot] = store.worn[p.slot] === p.id ? undefined : p.id
    // Separates are worn on the everyday figure: choosing one takes a complete look off.
    if (store.worn[p.slot]) store.worn.look = undefined
  }
  save()
}
