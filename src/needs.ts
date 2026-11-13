// Needs and mood, in the spirit of The Sims and Lagos Life: energy, hunger, hygiene and social fall slowly while
// you play and come back through what the city already has: the bed, the cooker and fridge, the shower, the
// Grind Ring stand, greeting residents, chatting, events. It never blocks play. When every need is looked after
// your mood turns Inspired and courses, jobs and events give a little extra XP; a low need only nudges, with the
// place that fixes it. Time away barely counts (no punishment for a day off). Kept per save slot beside the
// save, so the save format is unchanged.
import { slotKey, onActivity, bonusXp } from './state.ts'

export type Need = 'energy' | 'hunger' | 'hygiene' | 'social'
export const NEEDS: ReadonlyArray<{ id: Need; label: string; low: string; fix: string; perMin: number }> = [
  { id: 'energy', label: 'Energy', low: 'Tired', fix: 'Sleep in your bed, or lie down on the lounger at home.', perMin: 0.8 },
  { id: 'hunger', label: 'Hunger', low: 'Hungry', fix: 'Cook or open the fridge at home, or order at the Grind Ring stand.', perMin: 1.1 },
  { id: 'hygiene', label: 'Hygiene', low: 'Needs a wash', fix: 'Take a shower, freshen up at the basin, or do the laundry.', perMin: 0.55 },
  { id: 'social', label: 'Social', low: 'Lonely', fix: 'Greet residents, chat with players near you, or join an event.', perMin: 0.7 },
]
export type Mood = { id: 'inspired' | 'content' | 'low'; label: string; note: string; lowest: Need }

type Store = { v: Record<Need, number>; at: number; nudged: Partial<Record<Need, number>>; bonusDay: string; bonusCount: number }
const key = () => `${slotKey()}.needs`
const full = (): Record<Need, number> => ({ energy: 90, hunger: 85, hygiene: 90, social: 75 })
let s: Store = { v: full(), at: Date.now(), nudged: {}, bonusDay: '', bonusCount: 0 }
let loadedFor = ''
const listeners = new Set<() => void>()
let toast: (m: string) => void = () => {}
const clamp = (n: number) => Math.max(0, Math.min(100, n))

function load(): void {
  const k = key()
  if (loadedFor === k) return
  loadedFor = k
  try {
    const raw = JSON.parse(localStorage.getItem(k) ?? 'null') as Partial<Store> | null
    s = raw?.v ? { v: { ...full(), ...raw.v }, at: raw.at ?? Date.now(), nudged: raw.nudged ?? {}, bonusDay: raw.bonusDay ?? '', bonusCount: raw.bonusCount ?? 0 } : { v: full(), at: Date.now(), nudged: {}, bonusDay: '', bonusCount: 0 }
  } catch { s = { v: full(), at: Date.now(), nudged: {}, bonusDay: '', bonusCount: 0 } }
  // Away time: a tenth of the play rate, at most 30 points, never below 30. Coming back gives you something to
  // do, never a crisis.
  const awayMin = Math.max(0, (Date.now() - s.at) / 60000)
  for (const n of NEEDS) {
    const drop = Math.min(30, awayMin * n.perMin * 0.1)
    if (drop > 0) s.v[n.id] = Math.max(Math.min(s.v[n.id], 30), s.v[n.id] - drop)
  }
  s.at = Date.now()
}
function store(): void {
  s.at = Date.now()
  try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode: needs live for this visit */ }
  for (const f of listeners) f()
}

export const onNeeds = (f: () => void): (() => void) => { listeners.add(f); return () => listeners.delete(f) }
export function needs(): Record<Need, number> { load(); return { ...s.v } }
export function mood(): Mood {
  load()
  const vals = NEEDS.map((n) => s.v[n.id])
  const lowest = NEEDS.reduce((a, n) => (s.v[n.id] < s.v[a.id] ? n : a), NEEDS[0]!)
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  if (s.v[lowest.id] >= 55 && avg >= 72) return { id: 'inspired', label: 'Inspired', note: 'Every need looked after: courses, jobs and events give +10 XP.', lowest: lowest.id }
  if (s.v[lowest.id] >= 30) return { id: 'content', label: 'Content', note: `Top up ${lowest.label.toLowerCase()} to feel Inspired and earn bonus XP.`, lowest: lowest.id }
  return { id: 'low', label: lowest.low, note: lowest.fix, lowest: lowest.id }
}

/** Change needs (positive restores). Returns a short summary such as "Hunger +60". */
export function adjust(d: Partial<Record<Need, number>>, say: 'now' | 'later' | 'quiet' = 'now'): string {
  load()
  const before = mood().id
  const parts: string[] = []
  for (const n of NEEDS) {
    const v = d[n.id]
    if (!v) continue
    const was = s.v[n.id]
    s.v[n.id] = clamp(was + v)
    const moved = Math.round(s.v[n.id] - was)
    if (moved > 0) { parts.push(`${n.label} +${moved}`); delete s.nudged[n.id] }
  }
  store()
  const after = mood().id
  const line = after === 'inspired' && before !== 'inspired' ? 'Mood: Inspired. Courses, jobs and events now give +10 XP.' : parts.join(' · ')
  // 'later': after the action's own message (dinner is ready, you feel fresh) has had its moment.
  if (line && say === 'now') toast(line)
  else if (line && say === 'later') window.setTimeout(() => toast(line), 4400)
  return parts.join(' · ')
}

let acc = 0
/** Advance needs by real play time (seconds). Call only while the city is open and the tab is visible. */
export function tickNeeds(dt: number): void {
  load()
  if (!(dt > 0) || dt > 5) return
  for (const n of NEEDS) s.v[n.id] = clamp(s.v[n.id] - (n.perMin * dt) / 60)
  acc += dt
  if (acc < 12) return
  acc = 0
  // One nudge per low need every 20 minutes, with the place that fixes it.
  const now = Date.now()
  for (const n of NEEDS) {
    if (s.v[n.id] < 25 && now - (s.nudged[n.id] ?? 0) > 20 * 60_000) {
      s.nudged[n.id] = now
      toast(`${n.low}. ${n.fix}`)
      break
    }
  }
  store()
}

// What restores what. Home interactions by their id; city moments by the activity they log.
const USE: Record<string, Partial<Record<Need, number>>> = {
  bed: { energy: 100 },
  lounger: { energy: 25, social: -2 },
  kitchen: { hunger: 60, energy: -4 },
  fridge: { hunger: 25 },
  sink: { hygiene: 6 },
  shower: { hygiene: 75, energy: 6 },
  basin: { hygiene: 25 },
  toilet: { hygiene: 6 },
  laundry: { hygiene: 18 },
  garden: { energy: -5, social: 4 },
  remote: { energy: -10, hunger: -6 },
}
/** A home interaction ran (bed, cooker, shower...). */
export function usedAtHome(id: string): void { const d = USE[id]; if (d) adjust(d, 'later') }
/** You greeted a resident or said something in the street. */
export function socialised(amount = 10): void { adjust({ social: amount }) }

export function startNeeds(say: (m: string) => void): void {
  toast = say
  load()
  onActivity((kind, label) => {
    if (label === 'Inspired bonus') return
    let d: Partial<Record<Need, number>> | null = null
    let counts = false
    if (label.startsWith('Gym ')) d = { energy: -12, hygiene: -22, hunger: -6 }
    else if (label === 'Ordered water') d = { hunger: 20 }
    else if (label === 'Read the café board') d = { hunger: 15, social: 10 }
    else if (label === 'Sat in the church' || label === 'Sat in the masjid') d = { social: 18, energy: 6 }
    else if (label.startsWith('Joined ')) { d = { social: 30, energy: -6 }; counts = true }
    else if (label === 'Sat through the campus talk') { d = { social: 15 }; counts = true }
    else if (kind === 'skill' && label.startsWith('Passed ')) { d = { energy: -8 }; counts = true }
    else if (kind === 'gig') { d = { energy: -10, hunger: -5 }; counts = true }
    if (d) adjust(d, 'quiet')
    // Inspired: a little extra XP for the things that matter, up to ten times a day.
    if (counts && mood().id === 'inspired') {
      const today = new Date().toISOString().slice(0, 10)
      if (s.bonusDay !== today) { s.bonusDay = today; s.bonusCount = 0 }
      if (s.bonusCount < 10) {
        s.bonusCount++
        store()
        window.setTimeout(() => bonusXp(10, 'Inspired bonus', 'Every need looked after: +10 XP.'), 0)
      }
    }
  })
  document.addEventListener('visibilitychange', () => { if (document.hidden) store() })
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
function bar(n: (typeof NEEDS)[number], v: number, big: boolean): HTMLElement {
  const row = el('div', '', `nd-row${v < 25 ? ' low' : v < 50 ? ' mid' : ''}`)
  const track = el('span', '', 'nd-track'); const fill = el('i'); fill.style.width = `${Math.round(v)}%`; track.append(fill)
  row.append(el('span', n.label, 'nd-name'), track)
  if (big) row.append(el('b', `${Math.round(v)}`, 'nd-val'))
  return row
}
/** The control-centre card: mood and four slim bars. */
export function paintNeedsCard(card: HTMLElement): void {
  const m = mood(), v = needs()
  const head = el('span', '', 'nd-head')
  head.append(el('strong', m.label), el('small', m.id === 'inspired' ? '+10 XP on courses, jobs and events' : 'Needs · tap for what helps'))
  const bars = el('span', '', 'nd-bars')
  for (const n of NEEDS) bars.append(bar(n, v[n.id], false))
  card.dataset.mood = m.id
  card.replaceChildren(head, bars)
}
/** The full sheet: mood, each need with its value and what restores it. */
export function renderNeeds(root: HTMLElement, goHome: () => void): void {
  const m = mood(), v = needs()
  const top = el('div', '', `nd-mood ${m.id}`)
  top.append(el('strong', m.label), el('p', m.note))
  const list = el('div', '', 'nd-list')
  for (const n of NEEDS) {
    const item = el('div', '', 'nd-item')
    item.append(bar(n, v[n.id], true), el('p', n.fix, 'cc-muted'))
    list.append(item)
  }
  const home = el('button', 'Go home', 'cc-link'); home.type = 'button'; home.onclick = goHome
  root.replaceChildren(top, list, el('p', 'Needs fall while you play and barely move while you are away. They never stop you doing anything.', 'cc-muted'), home)
}
