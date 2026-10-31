// Character creator v2: height/build morphs and hair colour on the existing sculpts. Local, per device.
export type Morph = { h: number; b: number; hair: number | null; skin?: number | null; lip?: number | null; blush?: number | null }
const KEY = 'gd.morph.v1'
let m: Morph = { h: 1, b: 1, hair: null }
try { m = { ...m, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Morph>) } } catch { /* default */ }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Number(v) || 1))
export const getMorph = (): Morph => ({ h: clamp(m.h, 0.92, 1.08), b: clamp(m.b, 0.9, 1.15), hair: m.hair, skin: m.skin ?? null, lip: m.lip ?? null, blush: m.blush ?? null })
export function setMorph(p: Partial<Morph>): void { m = { ...m, ...p }; try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* private */ } }
export const HAIRS = [
  { label: 'Black', hex: 0x15110e }, { label: 'Dark brown', hex: 0x2a1a12 }, { label: 'Chestnut', hex: 0x5a3622 },
  { label: 'Blonde', hex: 0xd9c08a }, { label: 'Silver', hex: 0xb8b4ad }, { label: 'Auburn', hex: 0x7a3420 },
]
/** Realistic skin range, light to deep. */
export const SKIN_TONES = [
  { label: 'Porcelain', hex: 0xf3d9c6 }, { label: 'Fair', hex: 0xeac3a6 }, { label: 'Light', hex: 0xe0b08e }, { label: 'Light olive', hex: 0xcf9f78 },
  { label: 'Medium', hex: 0xbf8a62 }, { label: 'Tan', hex: 0xa8714b }, { label: 'Brown', hex: 0x8d5a3b }, { label: 'Rich brown', hex: 0x6f4329 },
  { label: 'Deep', hex: 0x55321f }, { label: 'Deepest', hex: 0x3b2316 },
]
export const LIPS = [{ label: 'None', hex: null }, { label: 'Nude', hex: 0xb9806e }, { label: 'Rose', hex: 0xc0636e }, { label: 'Berry', hex: 0x8a3248 }, { label: 'Classic red', hex: 0xa8222e }, { label: 'Plum', hex: 0x6a2c42 }] as const
export const BLUSH = [{ label: 'None', hex: null }, { label: 'Peach', hex: 0xe8a07e }, { label: 'Rose', hex: 0xd98c95 }, { label: 'Bronze', hex: 0xb47a52 }] as const
export type Style = 'all' | 'office' | 'street' | 'african'
/** Citizens vary a little so the crowd is not cloned. Deterministic per variant. */
export const citizenScale = (variant: number) => { const r = ((variant * 2654435761) >>> 0) / 4294967296; return { h: 0.94 + r * 0.12, b: 0.95 + ((r * 7) % 1) * 0.12 } }
/** True once the player has touched the creator on this device. */
export const hasLocalMorph = (): boolean => { try { return localStorage.getItem(KEY) !== null } catch { return false } }
