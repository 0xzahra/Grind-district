// Boutique makeup kit: lipstick, blush, eyeshadow and liner for your own figure, painted onto the face texture
// (humans.ts). Buy the kit once with the in-game balance, then change shades freely. Free creator stays
// makeup-free; this is an optional boutique purchase. Per device, beside the save (save format unchanged).
import type { Makeup } from './humans.ts'
import { buyWant } from './state.ts'

export const KIT_USD = 120
type Shade = { label: string; hex: number | null }
export const LIPSTICK: Shade[] = [{ label: 'None', hex: null }, { label: 'Nude', hex: 0xb9806e }, { label: 'Rose', hex: 0xc0636e }, { label: 'Coral', hex: 0xd8655a }, { label: 'Berry', hex: 0x8a3248 }, { label: 'Classic red', hex: 0xa8222e }, { label: 'Plum', hex: 0x6a2c42 }]
export const BLUSH: Shade[] = [{ label: 'None', hex: null }, { label: 'Peach', hex: 0xe8a07e }, { label: 'Rose', hex: 0xd98c95 }, { label: 'Bronze', hex: 0xb47a52 }]
export const SHADOW: Shade[] = [{ label: 'None', hex: null }, { label: 'Champagne', hex: 0xd8c09a }, { label: 'Bronze', hex: 0x9a6a3e }, { label: 'Smoky', hex: 0x3a3438 }, { label: 'Plum', hex: 0x6a3a58 }, { label: 'Emerald', hex: 0x2f6a52 }]

const KEY = 'gd.makeup.v1'
type Store = { owned: boolean; m: Makeup }
const read = (): Store => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null; if (s && typeof s.owned === 'boolean') return { owned: s.owned, m: s.m ?? {} } } catch { /* fresh */ } return { owned: false, m: {} } }
const write = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ } }

export const kitOwned = () => read().owned
/** The makeup to paint on your figure (nothing until the kit is bought). */
export function makeup(): Makeup | undefined { const s = read(); return s.owned ? s.m : undefined }
export function setMakeup(p: Partial<Makeup>): void { const s = read(); s.m = { ...s.m, ...p }; write(s) }
export function buyKit(): { ok: boolean; message: string } {
  if (kitOwned()) return { ok: true, message: 'The kit is yours.' }
  const r = buyWant('Makeup kit', KIT_USD)
  if (!r.ok) return r
  write({ owned: true, m: { lip: 0xc0636e, blush: 0xe8a07e } })
  return { ok: true, message: 'Makeup kit is yours: Rose lipstick and Peach blush on. Change shades any time.' }
}
