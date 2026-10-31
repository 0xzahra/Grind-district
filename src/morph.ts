// Character creator v2: height/build morphs and hair colour on the existing sculpts. Local, per device.
export type Morph = { h: number; b: number; hair: number | null }
const KEY = 'gd.morph.v1'
let m: Morph = { h: 1, b: 1, hair: null }
try { m = { ...m, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Morph>) } } catch { /* default */ }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Number(v) || 1))
export const getMorph = (): Morph => ({ h: clamp(m.h, 0.92, 1.08), b: clamp(m.b, 0.9, 1.15), hair: m.hair })
export function setMorph(p: Partial<Morph>): void { m = { ...m, ...p }; try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* private */ } }
export const HAIRS = [
  { label: 'Black', hex: 0x15110e }, { label: 'Dark brown', hex: 0x2a1a12 }, { label: 'Chestnut', hex: 0x5a3622 },
  { label: 'Blonde', hex: 0xd9c08a }, { label: 'Silver', hex: 0xb8b4ad }, { label: 'Auburn', hex: 0x7a3420 },
]
export type Style = 'all' | 'office' | 'street' | 'african'
/** Citizens vary a little so the crowd is not cloned. Deterministic per variant. */
export const citizenScale = (variant: number) => { const r = ((variant * 2654435761) >>> 0) / 4294967296; return { h: 0.94 + r * 0.12, b: 0.95 + ((r * 7) % 1) * 0.12 } }
