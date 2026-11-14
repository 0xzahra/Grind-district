// District Cards: a collectible album. Every card is earned by doing something in the city (visiting a place,
// passing courses, making friends, racing clean laps), or comes in the Founders pack, whose four foil cards are
// shown before you buy. Nothing is random: there are no blind packs and no odds, so collecting is never a gamble.
// Completing a set gives reputation. Stored per save slot beside the save (save format unchanged).
import { slotKey, getSave, spendInGame, addReputation, onActivity } from './state.ts'
import { levelOf, business, hostedToday } from './town.ts'
import { RESIDENTS } from './npcs.ts'
import { classesDone, CLASSES } from './society.ts'
import { raceMedal } from './race.ts'

type SetId = 'landmarks' | 'scholar' | 'society' | 'raceway' | 'founders'
type Card = { id: string; set: SetId; title: string; how: string; line: string; visit?: string; has?: () => boolean }
export const PACK_USD = 250
const SETS: Record<SetId, { label: string; glyph: string }> = {
  landmarks: { label: 'Landmarks', glyph: 'M4 20V9l8-5 8 5v11h-5v-6H9v6z' },
  scholar: { label: 'Scholar', glyph: 'M2 9l10-5 10 5-10 5zM6 12v4c2 2 10 2 12 0v-4' },
  society: { label: 'Society', glyph: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  raceway: { label: 'Raceway', glyph: 'M5 21V4h9l1 2h5v9h-7l-1-2H7v8z' },
  founders: { label: 'Founders', glyph: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
}
const passes = () => Object.values(getSave().skills).filter((s) => s?.passed).length
const friends = (min: number) => RESIDENTS.filter((r) => levelOf(r.name) >= min).length
export const CARDS: Card[] = [
  { id: 'lm-campus', set: 'landmarks', title: 'Campus', how: 'Open the courses at Campus', line: 'Where every Shrimp starts.', visit: 'learn' },
  { id: 'lm-floor', set: 'landmarks', title: 'Trading floor', how: 'Open the Trade screen', line: 'Practice first. Always.', visit: 'trade' },
  { id: 'lm-boutique', set: 'landmarks', title: 'Boutique', how: 'Visit the Boutique', line: 'Dress like you mean it.', visit: 'boutique' },
  { id: 'lm-hospital', set: 'landmarks', title: 'Hospital', how: 'Visit the Hospital', line: 'No trade is worth your health.', visit: 'hospital' },
  { id: 'lm-velvet', set: 'landmarks', title: 'The Velvet Room', how: 'Read the door of the casino front', line: 'Closed for good.', visit: 'casino' },
  { id: 'lm-club', set: 'landmarks', title: "Stockholders' Club", how: "Visit the Stockholders' Club", line: 'Benefits, not rights.', visit: 'club' },
  { id: 'lm-market', set: 'landmarks', title: 'Market hall', how: 'Visit the Market hall', line: 'Your name over the door.', visit: 'market' },
  { id: 'lm-hall', set: 'landmarks', title: 'Conference centre', how: 'Visit the Conference centre', line: 'Doors open at six.', visit: 'conference' },
  { id: 'lm-wellness', set: 'landmarks', title: 'Wellness house', how: 'Visit the Wellness house', line: 'Looking after yourself is the grind.', visit: 'wellness' },
  { id: 'lm-etiquette', set: 'landmarks', title: 'Etiquette House', how: 'Visit the Etiquette House', line: 'Manners travel.', visit: 'society' },
  { id: 'sc-1', set: 'scholar', title: 'First certificate', how: 'Pass 1 course', line: 'Proof, not points.', has: () => passes() >= 1 },
  { id: 'sc-5', set: 'scholar', title: 'Foundations', how: 'Pass 5 courses', line: 'The basics, banked.', has: () => passes() >= 5 },
  { id: 'sc-10', set: 'scholar', title: 'Specialist', how: 'Pass 10 courses', line: 'Ten certificates deep.', has: () => passes() >= 10 },
  { id: 'sc-20', set: 'scholar', title: 'Scholar', how: 'Pass 20 courses', line: 'Read the docs, not the hype.', has: () => passes() >= 20 },
  { id: 'so-friend', set: 'society', title: 'A friend in the city', how: 'Make one resident a Friend', line: 'Friendships take showing up.', has: () => friends(2) >= 1 },
  { id: 'so-circle', set: 'society', title: 'Inner circle', how: 'Make three residents Friends', line: 'Good company compounds.', has: () => friends(2) >= 3 },
  { id: 'so-close', set: 'society', title: 'Close friend', how: 'Make one resident a Close friend', line: 'Someone who would notice.', has: () => friends(3) >= 1 },
  { id: 'so-polished', set: 'society', title: 'Polished', how: 'Pass every class at the Etiquette House', line: 'Seven classes, one presence.', has: () => classesDone() >= CLASSES.length },
  { id: 'so-owner', set: 'society', title: 'Proprietor', how: 'Open a business in the Market hall', line: 'Open for business.', has: () => !!business() },
  { id: 'so-host', set: 'society', title: 'The host', how: 'Host an event at the Conference centre', line: 'The room came for you.', has: () => hostedToday() },
  { id: 'rc-bronze', set: 'raceway', title: 'Bronze laps', how: 'Earn a bronze medal at the Raceway', line: 'Smooth is fast.', has: () => raceMedal() >= 1 },
  { id: 'rc-silver', set: 'raceway', title: 'Silver laps', how: 'Earn a silver medal at the Raceway', line: 'Brake early, exit fast.', has: () => raceMedal() >= 2 },
  { id: 'rc-gold', set: 'raceway', title: 'Gold laps', how: 'Earn a gold medal at the Raceway', line: 'Every bend, on the limit.', has: () => raceMedal() >= 3 },
  { id: 'fd-shrimp', set: 'founders', title: 'The Shrimp', how: 'In the Founders pack', line: 'Everyone starts here.' },
  { id: 'fd-whale', set: 'founders', title: 'The Whale', how: 'In the Founders pack', line: 'Zero to Whale.' },
  { id: 'fd-zahra', set: 'founders', title: 'Zahra', how: 'In the Founders pack', line: 'Never share your seed phrase.' },
  { id: 'fd-ring', set: 'founders', title: 'The Grind Ring', how: 'In the Founders pack', line: 'Meet me at the stand.' },
]

type Store = { got: Record<string, number>; pack: boolean; sets: string[] }
const key = () => `${slotKey()}.cards`
const read = (): Store => { try { return { got: {}, pack: false, sets: [], ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as Partial<Store>) } } catch { return { got: {}, pack: false, sets: [] } } }
const write = (s: Store) => { try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ } }
let toast: (m: string) => void = () => {}

/** Give any card whose condition is now met; reward sets that are complete. Returns the new cards. */
export function checkCards(visited?: string): Card[] {
  const s = read(), fresh: Card[] = []
  for (const c of CARDS) {
    if (s.got[c.id]) continue
    const earned = c.set === 'founders' ? s.pack : c.visit ? c.visit === visited : !!c.has?.()
    if (earned) { s.got[c.id] = Date.now(); fresh.push(c) }
  }
  if (!fresh.length) return fresh
  for (const set of Object.keys(SETS) as SetId[]) {
    if (s.sets.includes(set) || !CARDS.filter((c) => c.set === set).every((c) => s.got[c.id])) continue
    s.sets.push(set)
    window.setTimeout(() => addReputation(5, `Reputation: ${SETS[set].label} set complete`, 'Every card in the set collected.'), 60)
  }
  write(s)
  toast(fresh.length === 1 ? `New card: ${fresh[0]!.title}.` : `${fresh.length} new cards: ${fresh.map((c) => c.title).join(', ')}.`)
  return fresh
}
export const cardsHeld = (): number => Object.keys(read().got).length

export function buyPack(): { ok: boolean; message: string } {
  const s = read()
  if (s.pack) return { ok: false, message: 'You already have the Founders pack.' }
  const r = spendInGame(PACK_USD, 'Founders card pack', 'Four foil cards: The Shrimp, The Whale, Zahra, The Grind Ring.')
  if (!r.ok) return r
  s.pack = true; write(s)
  checkCards()
  return { ok: true, message: 'The Founders pack is yours: four foil cards.' }
}

export function startCards(say: (m: string) => void): void {
  toast = say
  onActivity(() => { window.setTimeout(() => checkCards(), 400) })
  window.addEventListener('gd:race-medal', () => checkCards())
  window.addEventListener('gd:society', () => checkCards())
  window.setTimeout(() => checkCards(), 4000)
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement; finish: (m: string) => void; reopen: () => void }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
function face(c: Card, got: number | undefined, n: number, preview = false): HTMLElement {
  const card = el('div', `gcard set-${c.set}${got || preview ? '' : ' back'}${c.set === 'founders' ? ' foil' : ''}`)
  const svg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${SETS[c.set].glyph}"/></svg>`
  if (got || preview) {
    card.innerHTML = `<span class="gc-no">${String(n).padStart(2, '0')}</span><span class="gc-art">${svg}</span>`
    card.append(el('strong', '', c.title), el('em', '', c.line), el('small', '', SETS[c.set].label))
  } else {
    card.innerHTML = `<span class="gc-art">${svg}</span>`
    card.append(el('strong', '', '?'), el('em', '', c.how))
  }
  card.setAttribute('role', 'img'); card.setAttribute('aria-label', got || preview ? `${c.title}: ${c.line}` : `Not collected yet. ${c.how}.`)
  return card
}

/** The Collectors' Gallery: the album, set by set, and the Founders pack. */
export function cardNodes(h: H): HTMLElement[] {
  checkCards('cards')
  const s = read()
  const out: HTMLElement[] = [h.para(`${Object.keys(s.got).length} of ${CARDS.length} cards collected. Cards are earned by doing things in the city. Nothing here is random.`)]
  let n = 0
  for (const set of Object.keys(SETS) as SetId[]) {
    const list = CARDS.filter((c) => c.set === set), have = list.filter((c) => s.got[c.id]).length
    out.push(el('h4', 'gc-h', `${SETS[set].label} · ${have} of ${list.length}${s.sets.includes(set) ? ' · complete' : ''}`))
    const grid = el('div', 'gc-grid')
    for (const c of list) { n += 1; grid.append(face(c, s.got[c.id], n, set === 'founders' && !s.pack)) }
    out.push(grid)
    if (set === 'founders' && !s.pack) {
      out.push(h.para('The Founders pack: these four foil cards, exactly as shown. No blind draws.', 'muted'))
      out.push(h.button(`Get the Founders pack · $${PACK_USD}`, 'primary', () => { const r = buyPack(); h.finish(r.message); h.reopen() }))
    }
  }
  out.push(h.para('Complete a set for +5 reputation.', 'muted'))
  return out
}
