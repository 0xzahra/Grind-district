// Luxury unlock loop: daily login streak (fixed reward, no randomness) and aspirational status unlocks.
import { getSave, earnCash } from './state.ts'
import { RANKS } from './logic.ts'

const KEY = 'gd.lux.v1'
type Lux = { last: string; streak: number; best: number }
const load = (): Lux => { try { return { last: '', streak: 0, best: 0, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { last: '', streak: 0, best: 0 } } }
const day = (d = new Date()) => d.toLocaleDateString('en-CA')

export const UNLOCKS = [
  { id: 'lounge', title: 'Private lounge access', where: 'Members\u2019 lounge, Learning campus', rank: 1, cash: 500 },
  { id: 'penthouse', title: 'Sky penthouse', where: 'Tower crown, central boulevard', rank: 2, cash: 2500 },
  { id: 'supercar', title: 'Grand tourer supercar', where: 'Garage, villa row', rank: 3, cash: 6000 },
  { id: 'yacht', title: 'Yacht deck', where: 'Waterfront promenade', rank: 4, cash: 15000 },
] as const

const rankIdx = () => { const xp = getSave().xp; return RANKS.reduce((a, r, i) => (xp >= r.xp ? i : a), 0) }
export function unlocked(): string[] {
  const r = rankIdx(), cash = getSave().ledger
  const seen = new Set<string>(JSON.parse(localStorage.getItem(KEY + '.got') ?? '[]'))
  for (const u of UNLOCKS) if (r >= u.rank && cash >= u.cash) seen.add(u.id)
  localStorage.setItem(KEY + '.got', JSON.stringify([...seen]))
  return [...seen]
}
export function loginState(): Lux & { claimable: boolean } { const l = load(); return { ...l, claimable: l.last !== day() } }
export function claimDaily(): string {
  const l = load(); const today = day()
  if (l.last === today) return 'Already claimed today. Come back tomorrow.'
  const y = new Date(); y.setDate(y.getDate() - 1)
  l.streak = l.last === day(y) ? l.streak + 1 : 1
  l.best = Math.max(l.best, l.streak); l.last = today
  localStorage.setItem(KEY, JSON.stringify(l))
  const usd = Math.min(15, 4 + l.streak)
  earnCash(usd, `Daily check-in · day ${l.streak}`, 'Fixed daily reward that grows with your streak (max $15).')
  return `Day ${l.streak} · +$${usd}`
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
export function renderBadges(): HTMLElement {
  const got = unlocked(); const wrap = h('div', 'lux-badges')
  for (const u of UNLOCKS) if (got.includes(u.id)) wrap.append(h('span', 'lux-badge', u.title))
  const l = load(); if (l.streak >= 3) wrap.append(h('span', 'lux-badge', `${l.streak}-day streak`))
  return wrap
}
export function renderLuxury(): HTMLElement {
  const box = h('section', 'glass lux')
  const st = loginState()
  box.append(h('h3', '', 'Status & unlocks'))
  const row = h('div', 'lux-login')
  row.append(h('div', '', `Daily check-in · ${st.streak}-day streak (best ${st.best})`))
  const b = h('button', st.claimable ? 'primary' : 'ghost', st.claimable ? 'Check in' : 'Checked in')
  b.onclick = () => { b.textContent = claimDaily(); b.className = 'ghost' }
  row.append(b); box.append(row)
  const got = unlocked(), r = rankIdx(), cash = getSave().ledger
  for (const u of UNLOCKS) {
    const ok = got.includes(u.id)
    const c = h('div', `lux-item${ok ? ' on' : ''}`)
    const need = ok ? 'Unlocked' : `Needs ${RANKS[u.rank].label} rank${r >= u.rank ? ' ✓' : ''} · $${u.cash.toLocaleString()} in-game cash${cash >= u.cash ? ' ✓' : ''}`
    c.append(h('b', '', u.title), h('small', '', u.where), h('small', '', need))
    box.append(c)
  }
  box.append(h('p', 'muted', 'Status unlocks are earned by rank and in-game cash held. Nothing here costs real money.'))
  return box
}
