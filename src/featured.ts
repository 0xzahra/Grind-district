// Boutique "Featured today": two bundles a day, each a runway look with a matching piece of fine jewellery at
// 20% off the two bought apart, with a countdown to local midnight (the Call of Duty store and Sims kits idea of
// a rotating offer). The pick is the same for everyone on a given day and never random at the till; pieces you
// already own drop out. Added on top of the existing free and premium wardrobe; nothing there changes.
import { PIECES, owns, type Piece } from './wardrobe.ts'

export const BUNDLE_OFF = 0.2
export type Bundle = { id: string; title: string; look: Piece; jewel: Piece; full: number; price: number }

const TITLES = ['Evening edit', 'Atelier edit', 'Gala edit', 'Weekend edit', 'Boardroom edit', 'Soirée edit']
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
function seed(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 } return h }

/** Today's bundles for a figure (lady or gent), skipping looks and jewellery already owned. */
export function featured(lady: boolean, d = new Date()): Bundle[] {
  const fits = (p: Piece) => !p.for || p.for === (lady ? 'lady' : 'gent')
  const looks = PIECES.filter((p) => p.slot === 'look' && p.usd > 0 && !p.pass && fits(p) && !owns(p.id))
  const jewels = PIECES.filter((p) => p.kind && p.usd > 0 && !p.pass && fits(p) && !owns(p.id))
  if (!looks.length || !jewels.length) return []
  let h = seed(`${dayKey(d)}:${lady ? 'l' : 'g'}`)
  const next = () => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return h }
  const out: Bundle[] = []
  const usedL = new Set<string>(), usedJ = new Set<string>()
  for (let i = 0; i < 2 && usedL.size < looks.length; i++) {
    let look = looks[next() % looks.length]!
    while (usedL.has(look.id)) look = looks[next() % looks.length]!
    let jewel = jewels[next() % jewels.length]!
    for (let k = 0; k < jewels.length && usedJ.has(jewel.id); k++) jewel = jewels[next() % jewels.length]!
    usedL.add(look.id); usedJ.add(jewel.id)
    const full = look.usd + jewel.usd
    out.push({ id: `${dayKey(d)}:${look.id}+${jewel.id}`, title: TITLES[next() % TITLES.length]!, look, jewel, full, price: Math.round(full * (1 - BUNDLE_OFF)) })
  }
  return out
}

/** "Ends in 7h 12m" until local midnight. */
export function endsIn(now = new Date()): string {
  const mid = new Date(now); mid.setHours(24, 0, 0, 0)
  const m = Math.max(0, Math.round((mid.getTime() - now.getTime()) / 60000))
  return m >= 60 ? `Ends in ${Math.floor(m / 60)}h ${m % 60}m` : `Ends in ${m}m`
}
