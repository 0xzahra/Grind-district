// City places around home: the corner store, pharmacy, bakery and laundromat on your street, the hospital on
// the west side, and the casino front by Mempool. Shops sell small, everyday things for in-game dollars that
// look after your needs (needs.ts): the city's day-to-day spending, as in Lagos Life. The casino is for show
// only: no game of chance exists anywhere in Grind District. Its door opens a plain card on how gambling and
// trading differ, and where to get help.
import { slotKey, spendInGame, getSave } from './state.ts'
import { adjust, needs, type Need } from './needs.ts'

export type PlaceId = 'hospital' | 'grocer' | 'pharmacy' | 'bakery' | 'laundromat'
type Item = { label: string; usd: number; d: Partial<Record<Need, number>>; note: string; once?: boolean; when?: () => string | null }
type Place = { title: string; intro: string; items: Item[]; foot?: string }

const dayKey = () => new Date().toLocaleDateString('en-CA')
const usedKey = () => `${slotKey()}.places`
const usedToday = (id: string): boolean => { try { const u = JSON.parse(localStorage.getItem(usedKey()) ?? '{}') as Record<string, string>; return u[id] === dayKey() } catch { return false } }
const markUsed = (id: string) => { try { const u = JSON.parse(localStorage.getItem(usedKey()) ?? '{}') as Record<string, string>; u[id] = dayKey(); localStorage.setItem(usedKey(), JSON.stringify(u)) } catch { /* private mode */ } }

export const PLACES: Record<PlaceId, Place> = {
  hospital: {
    title: 'Grind District Hospital',
    intro: 'Clinic, pharmacy and a quiet ward. Look after the body that does the grinding.',
    items: [
      { label: 'Check-up', usd: 20, d: { energy: 40, hygiene: 20 }, note: 'Once a day. A nurse checks you over and sends you home rested.', once: true },
      { label: 'Rest in the ward', usd: 0, d: { energy: 60 }, note: 'Free when you are exhausted (energy under 30), once a day.', once: true, when: () => (needs().energy < 30 ? null : 'The ward is for when you are exhausted. Sleep at home tonight.') },
      { label: 'Physio session', usd: 15, d: { energy: 25, social: 10 }, note: 'Stretch out the desk hours with a physiotherapist.' },
    ],
    foot: 'No trade is worth your sleep or your health.',
  },
  grocer: {
    title: 'Corner store',
    intro: 'Snacks, drinks and groceries, a few steps from your door.',
    items: [
      { label: 'Snack and a cold drink', usd: 4, d: { hunger: 30 }, note: 'Puff-puff and a malt.' },
      { label: 'Groceries for the week', usd: 14, d: { hunger: 60, energy: 5 }, note: 'Rice, plantain, tomatoes, eggs. Cook them at home.' },
    ],
  },
  pharmacy: {
    title: 'Pharmacy',
    intro: 'Everyday care on your street.',
    items: [
      { label: 'Vitamins', usd: 6, d: { energy: 20 }, note: 'A daily multivitamin.' },
      { label: 'Toiletries', usd: 5, d: { hygiene: 30 }, note: 'Soap, toothpaste and deodorant.' },
    ],
  },
  bakery: {
    title: 'Bakery',
    intro: 'Fresh bread every morning, tea all day, a table by the window.',
    items: [
      { label: 'Fresh bread and tea', usd: 5, d: { hunger: 30, social: 6 }, note: 'Agege bread, butter and hot tea.' },
      { label: 'Cake for the neighbours', usd: 12, d: { social: 30 }, note: 'Share a cake with the street.' },
    ],
  },
  laundromat: {
    title: 'Laundromat',
    intro: 'Wash, dry and fold while you get on with your day.',
    items: [
      { label: 'Wash and fold', usd: 6, d: { hygiene: 35 }, note: 'Fresh clothes, folded and bagged.' },
    ],
  },
}

export function buyAt(place: PlaceId, i: number): { ok: boolean; message: string } {
  const p = PLACES[place], it = p.items[i]
  if (!it) return { ok: false, message: 'That is not on the counter.' }
  const id = `${place}:${i}`
  if (it.once && usedToday(id)) return { ok: false, message: `${it.label}: once a day. Come back tomorrow.` }
  const no = it.when?.()
  if (no) return { ok: false, message: no }
  if (it.usd > 0) {
    if (getSave().ledger < it.usd) return { ok: false, message: `You need $${(it.usd - getSave().ledger).toFixed(2)} more.` }
    const r = spendInGame(it.usd, `${p.title}: ${it.label}`, it.note)
    if (!r.ok) return r
  }
  if (it.once) markUsed(id)
  const got = adjust(it.d, 'quiet')
  return { ok: true, message: `${it.label}${got ? ` · ${got}` : ''}` }
}

type H = { para: (t: string, c?: string) => HTMLElement; button: (t: string, c: string, f: () => void) => HTMLElement; finish: (m: string) => void; reopen: () => void }
export function placeNodes(place: PlaceId, h: H): HTMLElement[] {
  const p = PLACES[place]
  const out: HTMLElement[] = [h.para(p.intro)]
  p.items.forEach((it, i) => {
    const used = it.once && usedToday(`${place}:${i}`)
    out.push(h.button(`${it.label} · ${it.usd ? `$${it.usd}` : 'free'}${used ? ' · done today' : ''}`, used ? 'ghost' : 'primary', () => { h.finish(buyAt(place, i).message); h.reopen() }))
    out.push(h.para(it.note, 'muted'))
  })
  if (p.foot) out.push(h.para(p.foot, 'muted'))
  return out
}

/** The casino front: closed for good. What it teaches instead. */
export function casinoNodes(h: { para: (t: string, c?: string) => HTMLElement; button: (t: string, c: string, f: () => void) => HTMLElement; learn: () => void; trade: () => void }): HTMLElement[] {
  const table = document.createElement('div'); table.className = 'gvt'
  const rows: Array<[string, string, string]> = [
    ['Who has the edge', 'The house. Every game is built so the casino wins over time.', 'Nobody by design. You need a reason (an edge) or you should not take the trade.'],
    ['What you expect', 'To lose a little on every bet, on average, forever.', 'Unknown until you test it. Without a tested plan, also a loss.'],
    ['What decides', 'Chance: cards, dice, a wheel.', 'Information, analysis and patience, then still risk.'],
    ['Losses', 'You chase them; the design rewards near misses.', 'You cap them before you enter: position size and a stop.'],
    ['Time', 'Seconds. Lights, sounds, no clocks.', 'A plan you can explain, sized to survive being wrong.'],
  ]
  const head = document.createElement('div'); head.className = 'gvt-row gvt-head'
  for (const t of ['', 'Gambling', 'Trading done right']) { const s = document.createElement('span'); s.textContent = t; head.append(s) }
  table.append(head)
  for (const [k, a, b] of rows) {
    const r = document.createElement('div'); r.className = 'gvt-row'
    for (const [t, c] of [[k, 'gvt-k'], [a, 'gvt-a'], [b, 'gvt-b']] as const) { const s = document.createElement('span'); s.textContent = t; s.className = c; r.append(s) }
    table.append(r)
  }
  return [
    h.para('Closed for good. The Velvet Room stays here as a front so everyone can see it, and nothing inside takes a bet. Gambling destroys people and families; Grind District does not run games of chance.'),
    h.para('Gambling vs trading', 'kicker'),
    table,
    h.para('Trading without a plan, with money you cannot lose, or to win back losses is gambling with a chart. Practise here with in-game money first.', 'muted'),
    h.button('Learn risk on Campus', 'primary', h.learn),
    h.button('Practise on the Trade screen', 'ghost', h.trade),
    h.para('Need help with gambling? US: call or text 1-800-GAMBLER. UK: National Gambling Helpline 0808 8020 133 (free, 24/7).', 'muted'),
  ]
}
