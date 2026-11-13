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

let uid = 0
const hx = (n: number) => `#${n.toString(16).padStart(6, '0')}`
const mix = (n: number, t: number, to: number) => { const a = [n >> 16, (n >> 8) & 255, n & 255], b = [to >> 16, (to >> 8) & 255, to & 255]; return a.map((v, i) => Math.round(v + (b[i]! - v) * t)).reduce((s, v) => (s << 8) | v, 0) }
/** A product sample for a shade: a lipstick bullet, a blush compact, an eyeshadow pan, or an empty pan for none. */
export function sampleSvg(kind: 'lip' | 'blush' | 'shadow', hex: number | null): string {
  const id = `mk${++uid}`
  const gold = `<linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#8a6420"/><stop offset=".35" stop-color="#f3dc9a"/><stop offset=".6" stop-color="#c9a24a"/><stop offset="1" stop-color="#7a581c"/></linearGradient>`
  if (hex == null) return `<svg viewBox="0 0 48 48"><defs>${gold}</defs><circle cx="24" cy="24" r="20" fill="url(#${id}g)"/><circle cx="24" cy="24" r="16.5" fill="#1d1f22"/><path d="M14 34 34 14" stroke="#8e8e93" stroke-width="2.4" stroke-linecap="round"/></svg>`
  const c = hx(hex), lite = hx(mix(hex, 0.45, 0xffffff)), dark = hx(mix(hex, 0.4, 0x000000))
  if (kind === 'lip') return `<svg viewBox="0 0 48 48"><defs>${gold}<linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".4" stop-color="${lite}"/><stop offset=".65" stop-color="${c}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
<rect x="15" y="29" width="18" height="16" rx="2" fill="url(#${id}g)"/><rect x="16.5" y="23" width="15" height="7" rx="1" fill="url(#${id}g)" opacity=".9"/>
<path d="M18 24V12c0-2 1.5-4 3.5-5.5L30 4v20Z" fill="url(#${id}b)"/><path d="M20 22V13c0-1.4.8-2.6 2-3.4" stroke="#fff" stroke-opacity=".45" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`
  if (kind === 'blush') return `<svg viewBox="0 0 48 48"><defs>${gold}<radialGradient id="${id}p" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${lite}"/><stop offset=".6" stop-color="${c}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs>
<circle cx="24" cy="24" r="21" fill="url(#${id}g)"/><circle cx="24" cy="24" r="17.5" fill="url(#${id}p)"/>
<g stroke="#fff" stroke-opacity=".22" stroke-width=".8" fill="none"><path d="M12 20q12-7 24 0"/><path d="M11 25q13-7 26 0"/><path d="M12 30q12-7 24 0"/></g><ellipse cx="18" cy="16" rx="5" ry="2.4" fill="#fff" opacity=".22"/></svg>`
  return `<svg viewBox="0 0 48 48"><defs>${gold}<radialGradient id="${id}s" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${lite}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs>
<rect x="4" y="4" width="40" height="40" rx="9" fill="url(#${id}g)"/><rect x="8" y="8" width="32" height="32" rx="7" fill="url(#${id}s)"/>
<g fill="#fff"><circle cx="17" cy="15" r=".9" opacity=".8"/><circle cx="29" cy="21" r=".7" opacity=".6"/><circle cx="22" cy="31" r=".8" opacity=".55"/><circle cx="33" cy="33" r=".6" opacity=".5"/><circle cx="14" cy="27" r=".6" opacity=".5"/></g></svg>`
}
export const LINER_SVG = '<svg viewBox="0 0 48 48"><defs><linearGradient id="lnp" x1="0" x2="1"><stop offset="0" stop-color="#1a1c20"/><stop offset=".5" stop-color="#3a3f46"/><stop offset="1" stop-color="#121417"/></linearGradient></defs><g transform="rotate(-40 24 24)"><rect x="8" y="20" width="26" height="8" rx="2" fill="url(#lnp)"/><rect x="30" y="20" width="4" height="8" fill="#c9a24a"/><path d="M34 20l8 4-8 4z" fill="#d9b48a"/><path d="M39.5 22.8 42 24l-2.5 1.2z" fill="#0d0e10"/></g></svg>'
