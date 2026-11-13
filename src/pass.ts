// Grind Pass · Season 1: a premium track that runs beside the free season track, in the spirit of the Call of
// Duty battle pass. Same 20 steps (weekly challenges move both); holders get an extra reward on every step:
// exclusive looks and jewellery that the boutique never sells, two plate frames, a Season 1 Founder badge and
// in-game cash back that adds up to more than the pass costs. Bought once with the in-game balance (earned or
// topped up). Nothing random, nothing timed out from under you: a reward you reached is always yours. Stored
// per save slot beside the save, so the save format is unchanged.
import { slotKey, getSave, spendInGame, earnCash, bonusXp } from './state.ts'
import { getCareer, onCareer, advanceSeason, equipFrame, equippedFrame, post, setSeasonExtra } from './career.ts'
import { SEASON } from './careerData.ts'
import { PIECES, own, owns } from './wardrobe.ts'

export const PASS_USD = 750
export const SKIP_USD = 90
export const SEASON_NAME = 'Season 1 · Founders'
const SEASON_END = new Date('2027-01-31T23:59:59')

type Reward =
  | { kind: 'cash'; usd: number }
  | { kind: 'piece' }
  | { kind: 'frame'; id: string; label: string }
  | { kind: 'xp'; xp: number }
const TIERS: Record<number, Reward> = {
  1: { kind: 'cash', usd: 60 }, 4: { kind: 'cash', usd: 100 }, 6: { kind: 'cash', usd: 120 }, 9: { kind: 'cash', usd: 140 },
  12: { kind: 'cash', usd: 160 }, 15: { kind: 'cash', usd: 180 }, 18: { kind: 'cash', usd: 240 },
  5: { kind: 'frame', id: 'frame-pass', label: 'Emerald pass frame' },
  17: { kind: 'xp', xp: 250 },
  20: { kind: 'frame', id: 'frame-founder', label: 'Founder gold frame + Season 1 Founder badge' },
}
for (const p of PIECES) if (p.pass && !TIERS[p.pass]) TIERS[p.pass] = { kind: 'piece' }
export const PASS_TOP = SEASON[SEASON.length - 1]?.at ?? 20
export const CASH_BACK = Object.values(TIERS).reduce((a, r) => a + (r.kind === 'cash' ? r.usd : 0), 0)

/** Free-track steps with no item give this much XP, so no step on either track is ever empty. */
export const FREE_XP = 40
type Store = { owned: boolean; at: number; granted: number; free?: number }
const key = () => `${slotKey()}.pass`
const read = (): Store => { try { return { owned: false, at: 0, granted: 0, ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as Partial<Store>) } } catch { return { owned: false, at: 0, granted: 0 } } }
/** Free XP for the steps reached since last time (first run starts from where you are; nothing back-paid twice). */
function freeCatchUp(): void {
  const s = read(), pts = Math.min(PASS_TOP, getCareer().seasonPts)
  if (s.free == null) { s.free = pts; write(s); return }
  while (s.free < pts) {
    s.free += 1; write(s)
    if (!SEASON.some((r) => r.at === s.free)) bonusXp(FREE_XP, `Season step ${s.free}`, 'Free track reward.')
  }
}
const write = (s: Store) => { try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ } }

export const passOwned = () => read().owned
export const passFounder = () => { const s = read(); return s.owned && s.granted >= PASS_TOP }
export const daysLeft = () => Math.max(0, Math.ceil((SEASON_END.getTime() - Date.now()) / 864e5))

/** What one premium step gives, as words (the piece that fits your figure first). */
export function tierLabel(n: number, lady = getSave().body === 'zuri'): string {
  const r = TIERS[n]
  if (!r) return ''
  if (r.kind === 'cash') return `$${r.usd} cash back`
  if (r.kind === 'xp') return `+${r.xp} XP rank boost`
  if (r.kind === 'frame') return r.label
  const ps = PIECES.filter((p) => p.pass === n)
  const mine = ps.find((p) => !p.for || p.for === (lady ? 'lady' : 'gent')) ?? ps[0]
  return mine ? mine.label : ''
}

let toast: (m: string) => void = () => {}
let seen = -1
function grant(n: number): void {
  const r = TIERS[n]
  if (!r) return
  if (r.kind === 'cash') earnCash(r.usd, `Grind Pass tier ${n}`, 'Cash back on the Grind Pass premium track.')
  else if (r.kind === 'xp') bonusXp(r.xp, `Grind Pass tier ${n}`, 'Rank boost on the Grind Pass premium track.')
  else if (r.kind === 'frame') { if (!equippedFrame() || n === PASS_TOP) equipFrame(r.id) }
  else for (const p of PIECES) if (p.pass === n && !owns(p.id)) own(p.id)
}
/** Give every premium step reached so far that has not been given yet. */
function catchUp(): number {
  const s = read()
  if (!s.owned) return 0
  const pts = Math.min(PASS_TOP, getCareer().seasonPts)
  let n = 0
  while (s.granted < pts) { s.granted += 1; write(s); grant(s.granted); n++ }
  if (n && s.granted >= PASS_TOP) post('Season 1 Founder: every Grind Pass reward unlocked.')
  return n
}

export function startPass(say: (m: string) => void): void {
  toast = say
  seen = getCareer().seasonPts
  catchUp()
  freeCatchUp()
  setSeasonExtra(renderPass)
  onCareer(() => {
    const pts = getCareer().seasonPts
    if (pts === seen) return
    const was = seen
    seen = pts
    if (pts < was) return
    freeCatchUp()
    if (passOwned()) {
      const n = catchUp()
      if (n) toast(`Grind Pass tier ${pts}: ${tierLabel(pts)}.`)
    } else if (pts <= PASS_TOP && TIERS[pts]) {
      // What the step would have given on the premium track (a nudge, once per step).
      window.setTimeout(() => toast(`Tier ${pts} reached. Grind Pass holders also got: ${tierLabel(pts)}.`), 4600)
    }
  })
}

export function buyPass(): { ok: boolean; message: string } {
  if (passOwned()) return { ok: true, message: 'You already hold the Grind Pass.' }
  const short = PASS_USD - getSave().ledger
  if (short > 0) return { ok: false, message: `You need $${short.toFixed(2)} more. Weekly challenges pay $50 each, or add funds from your balance card.` }
  const r = spendInGame(PASS_USD, 'Grind Pass · Season 1', `Premium track: ${PASS_TOP} rewards, $${CASH_BACK.toLocaleString('en-US')} cash back.`)
  if (!r.ok) return r
  const s = read(); s.owned = true; s.at = Date.now(); write(s)
  const n = catchUp()
  post('Got the Grind Pass for Season 1.')
  return { ok: true, message: n ? `Grind Pass unlocked. ${n} reward${n > 1 ? 's' : ''} you had already reached are yours.` : 'Grind Pass unlocked. Every challenge now pays on both tracks.' }
}
export function skipTier(): { ok: boolean; message: string } {
  if (getCareer().seasonPts >= PASS_TOP) return { ok: false, message: 'You are at the top of the season.' }
  const r = spendInGame(SKIP_USD, 'Grind Pass tier skip', 'One season step.')
  if (!r.ok) return r
  advanceSeason()
  const n = getCareer().seasonPts
  return { ok: true, message: passOwned() && TIERS[n] ? `Tier ${n}: ${tierLabel(n)} is yours.` : `Tier ${n} reached.` }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const btn = (text: string, fn: () => void, cls: string) => { const b = el('button', text, cls); b.type = 'button'; b.onclick = fn; return b }

/** The season ladder: both tracks side by side, the pass offer, tier skips. */
export function renderPass(root: HTMLElement, rerender: () => void): void {
  const owned = passOwned(), pts = getCareer().seasonPts, lady = getSave().body === 'zuri'
  const hero = el('div', '', `gp-hero${owned ? ' owned' : ''}`)
  hero.append(el('small', `${SEASON_NAME} · ${daysLeft()} days left`, 'gp-kicker'), el('strong', owned ? 'Grind Pass · active' : 'Grind Pass'))
  if (owned) hero.append(el('p', `${Math.min(pts, PASS_TOP)} of ${PASS_TOP} steps. Every weekly challenge pays on both tracks.`))
  else {
    const mine = PIECES.filter((p) => p.pass && (!p.for || p.for === (lady ? 'lady' : 'gent')))
    const looks = mine.filter((p) => p.slot === 'look').length, jewels = mine.length - looks
    hero.append(el('p', `${PASS_TOP} premium rewards: ${looks} runway looks and ${jewels} pieces of fine jewellery the boutique never sells, two plate frames, a Founder badge, and $${CASH_BACK.toLocaleString('en-US')} cash back. It pays for itself.`))
    const buy = btn(`Get the Grind Pass · $${PASS_USD}`, () => { const r = buyPass(); toast(r.message); rerender() }, 'gp-buy')
    hero.append(buy, el('small', 'Paid once with your in-game balance. Rewards you have already reached are given at once.', 'gp-fine'))
  }
  const ladder = el('ol', '', 'gp-ladder')
  const head = el('li', '', 'gp-head'); head.append(el('span', ''), el('span', 'Free'), el('span', 'Grind Pass')); ladder.append(head)
  for (let n = 1; n <= PASS_TOP; n++) {
    const reached = pts >= n
    const li = el('li', '', `${reached ? 'reached' : ''}${n === pts + 1 ? ' next' : ''}`)
    const free = SEASON.find((r) => r.at === n)
    const prem = el('span', tierLabel(n, lady), `gp-prem${owned && reached ? ' got' : owned ? '' : ' locked'}`)
    const r = TIERS[n]
    if (owned && reached && r?.kind === 'frame') { const on = equippedFrame() === r.id; prem.append(btn(on ? 'Equipped' : 'Equip', () => { equipFrame(on ? '' : r.id); rerender() }, 'cr-chip')) }
    li.append(el('b', String(n)), el('span', free ? free.label : `+${FREE_XP} XP`, `gp-free${reached ? ' got' : ''}`), prem)
    ladder.append(li)
  }
  const foot = el('div', '', 'gp-foot')
  if (pts < PASS_TOP) foot.append(btn(`Skip a tier · $${SKIP_USD}`, () => { const r = skipTier(); toast(r.message); rerender() }, 'cc-link'))
  foot.append(el('small', 'Weekly challenges move both tracks one step each. Exclusives appear in the Boutique once they are yours.', 'cc-muted'))
  root.append(hero, ladder, foot)
}
