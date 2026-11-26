// The player's long-term play record and the Profile block that reads it (personaCore.ts does the reading).
// The record lives on this device beside the save (the save format is untouched), keyed to the save slot like the
// practice perpetuals. It is fed by the activity log (every logged activity passes through onActivity), by a few
// direct notes from the city (greetings, photos, rooms, screens), and by a slow tick that follows open practice
// positions so a dip held through, or sold at the bottom, is seen. Nothing here is uploaded.
import { COINS } from './logic.ts'
import { getSave, onActivity, slotKey } from './state.ts'
import { getBirthday, zodiac } from './calendar.ts'
import { getCareer } from './career.ts'
import { normalizeRecord, readPersona, personaPost, type Persona, type PersonaRecord, type Trait, type Fit } from './personaCore.ts'
import { inviteLink } from './photoCard.ts'

const key = () => `gd.persona.v1:${slotKey()}`
let cache: { key: string; rec: PersonaRecord } | null = null
let saveTimer = 0

function rec(): PersonaRecord {
  const k = key()
  if (cache?.key !== k) {
    let raw: unknown = null
    try { raw = JSON.parse(localStorage.getItem(k) ?? 'null') } catch { /* fresh */ }
    cache = { key: k, rec: normalizeRecord(raw) }
  }
  return cache.rec
}
function flush(): void {
  if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = 0 }
  try { if (cache) localStorage.setItem(cache.key, JSON.stringify(cache.rec)) } catch { /* storage full or blocked: the reading still works this session */ }
}
function store(): void { if (!saveTimer) saveTimer = window.setTimeout(flush, 1500) }
const bump = (m: Record<string, number>, k: string, n = 1) => { m[k] = (m[k] ?? 0) + n }
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const coinBySym = (sym: string) => COINS.find((c) => c.label.split(' ')[0] === sym)
const firstAmount = (s: string): number => { const m = /\$\s?([\d,]+(?:\.\d+)?)/.exec(s); return m ? Number(m[1]!.replace(/,/g, '')) : 0 }

function spot(r: PersonaRecord, label: string, detail: string): void {
  const s = r.spot, save = getSave()
  const bought = /^Bought (\S+)$/.exec(label)
  if (bought) {
    s.buys++
    const c = coinBySym(bought[1]!)
    if (!c) { if (/meme/i.test(bought[1]!)) s.meme++; return }
    s[c.cat]++
    const cash = firstAmount(detail)
    if (cash > 0) s.sizes = [...s.sizes, Math.min(1, cash / (cash + Math.max(0, save.ledger)))].slice(-60)
    const h = save.coins[c.id], price = save.coinPrices[c.id] ?? c.base
    if (h && h.qty > 0) {
      const o = s.open[c.id]
      if (o) o.avg = h.avg || o.avg
      else s.open[c.id] = { at: Date.now(), avg: h.avg || price, worst: 0, dipped: false }
    }
    return
  }
  const sold = /^Sold (\S+)$/.exec(label)
  if (!sold) return
  s.sells++
  const c = coinBySym(sold[1]!)
  if (!c) { if (/in the green/.test(detail)) s.sellsAtProfit++; else if (/in the red/.test(detail)) s.sellsAtLoss++; return }
  const o = s.open[c.id], price = save.coinPrices[c.id] ?? c.base
  const avg = o?.avg || save.coins[c.id]?.avg || price
  const pnl = avg > 0 ? price / avg - 1 : 0
  const heldMin = o ? (Date.now() - o.at) / 60_000 : NaN
  if (pnl < -0.002) {
    s.sellsAtLoss++
    if (heldMin < 30) s.quickLoss++
    if (o?.dipped && pnl <= o.worst + 0.03) { s.panic++; o.dipped = false }
  } else {
    s.sellsAtProfit++
    if (o?.dipped) { o.dipped = false; s.recovered++ }
  }
  if (o && (save.coins[c.id]?.qty ?? 0) <= 0) {
    if (Number.isFinite(heldMin)) s.holds = [...s.holds, heldMin].slice(-60)
    delete s.open[c.id]
  }
}

function money(r: PersonaRecord, label: string, detail: string): void {
  const p = r.perps
  const opened = /^Opened (\S+) (long|short) (\d+)x$/.exec(label)
  if (opened) {
    const lev = Number(opened[3])
    p.opens++; p.levSum += lev
    if (lev >= 10) p.lev10++
    if (opened[2] === 'short') p.shorts++
    ;(p.open[label.slice(7)] ??= []).push({ at: Date.now(), lev, side: opened[2] as 'long' | 'short' })
    return
  }
  const closed = /^(Closed|Liquidated) (\S+ (?:long|short) \d+x)$/.exec(label)
  if (closed) {
    const o = p.open[closed[2]!]?.shift()
    if (o) p.holds = [...p.holds, (Date.now() - o.at) / 60_000].slice(-60)
    if (closed[1] === 'Liquidated') { p.liquidations++; p.losses++; return }
    p.closes++
    if (/P&L \+/.test(detail)) p.wins++
    else if (/P&L -/.test(detail)) p.losses++
    return
  }
  if (/^Bought /.test(label)) r.buys++
}

function onAct(kind: string, label: string, detail: string): void {
  const r = rec(), now = new Date()
  r.hours[now.getHours()] = (r.hours[now.getHours()] ?? 0) + 1
  r.days[now.getDay()] = (r.days[now.getDay()] ?? 0) + 1
  const dk = dateKey(now)
  if (r.active[r.active.length - 1] !== dk) r.active = [...r.active.filter((d) => d !== dk), dk].slice(-90)
  bump(r.kinds, kind)
  r.lastSeen = Date.now()
  if (kind === 'trade') {
    const conv = /^Converted (\S+) to (\S+)$/.exec(label)
    if (conv) { r.spot.converts++; spot(r, `Sold ${conv[1]}`, ''); spot(r, `Bought ${conv[2]}`, ''); r.spot.sells--; r.spot.buys-- }
    else spot(r, label, detail)
  } else if (kind === 'money') money(r, label, detail)
  else if (kind === 'tax') { if (/^Paid the family/.test(label)) r.family.paid++; else if (/^Left the family/.test(label)) r.family.left++ }
  else if (kind === 'social') { if (/church|masjid/i.test(label)) bump(r.acts, 'faith'); else if (/café board/i.test(label)) bump(r.acts, 'news'); else if (/order|café|coffee|tea|water/i.test(label)) bump(r.acts, 'cafe') }
  else if (kind === 'skill') { if (/^Gym/.test(label)) bump(r.acts, 'gym'); else if (/^Joined /.test(label)) bump(r.acts, 'event'); else if (/talk/i.test(label)) bump(r.acts, 'talk') }
  else if (kind === 'gig') { if (/bounty/i.test(label)) bump(r.acts, 'bounty') }
  store()
}

/** Something the player did that the activity log does not record (a greeting, a photo, a swim...). */
export function note(act: string): void { bump(rec().acts, act); store() }
/** A room or place the player went into. */
export function notePlace(id: string): void { bump(rec().places, id); store() }
/** A screen the player opened (Boutique, Trade, Campus...). */
export function notePanel(id: string): void { bump(rec().panels, id); store() }

let started = false
/** Start recording (once, when the city opens). */
export function startPersona(): void {
  if (started) return
  started = true
  onActivity(onAct)
  const r = rec()
  if (Date.now() - r.lastSeen > 30 * 60_000) { r.sessions++; store() }
  r.lastSeen = Date.now()
  // Every 30 seconds of play: minutes played, and open positions checked against the market.
  window.setInterval(() => {
    if (document.hidden) return
    const r = rec(), save = getSave()
    r.playMin += 0.5
    r.lastSeen = Date.now()
    for (const [id, o] of Object.entries(r.spot.open)) {
      const h = save.coins[id]
      if (!h || h.qty <= 0) { delete r.spot.open[id]; continue }
      const c = COINS.find((x) => x.id === id)
      const price = save.coinPrices[id] ?? c?.base ?? 0
      const pnl = o.avg > 0 ? price / o.avg - 1 : 0
      if (pnl < o.worst) o.worst = pnl
      if (!o.seen && pnl <= -0.1) { o.seen = true; o.dipped = true; r.spot.dips++ }
      if (o.dipped && pnl >= 0) { o.dipped = false; r.spot.recovered++ }
    }
    store()
  }, 30_000)
  addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
}

/** The reading for the current player. */
export function myPersona(): Persona {
  const save = getSave(), career = getCareer()
  const b = getBirthday()
  const z = b ? zodiac(b) : null
  return readPersona(rec(), { skills: save.skills as Record<string, { passed?: boolean; tries?: number }>, tracks: career.track ?? {}, job: career.job ?? '', streak: save.streak, sign: z ? { name: z.name, sym: z.sym, trait: z.trait } : null })
}

type H = { para: (t: string, cls?: string) => HTMLElement; button: (label: string, cls: string, on: () => void) => HTMLElement }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }

/** What each trait measures, in a line, shown under it so nobody has to guess. */
const MEANS: Record<string, string> = {
  hands: 'How you hold through ups and downs: sell at the first dip, or keep to your plan.',
  style: 'How long you keep a trade open, from minutes to weeks.',
  risk: 'How much risk you take: big coins and small sizes, or memes and leverage.',
  rhythm: 'When you play: mornings, evenings, weekdays or weekends.',
  habit: 'How regularly you come back to the city.',
  learning: 'How you learn: first try, retries until it clicks, or by trying everything.',
  social: 'How much of your time is spent with other people.',
  money: 'What you do with cash: save it, spend it or put it to work.',
  values: 'What you choose to make time for when nobody asks you to.',
}
const HUE: Record<string, string> = { hands: '#e8a33a', style: '#3e9be8', risk: '#e8603a', rhythm: '#9b7be8', habit: '#2bb5a8', learning: '#4f8be8', social: '#3ec46b', money: '#d9b26a', values: '#7bc96b' }
function traitRow(t: Trait): HTMLElement {
  const unread = t.value === 'Not read yet'
  const d = el('details', '', `ps-trait${unread ? ' unread' : ''}`)
  d.style.setProperty('--hue', HUE[t.id] ?? '#9aa3ad')
  const s = el('summary')
  const text = el('span', '', 'ps-text')
  text.append(el('small', t.label, 'ps-label'), el('strong', unread ? 'Not read yet' : t.value, 'ps-val'), el('small', MEANS[t.id] ?? '', 'ps-means'))
  if (unread && t.unlock) text.append(el('small', `To read it: ${t.unlock}`, 'ps-todo'))
  s.append(el('span', t.icon, 'ps-ico'), text, el('span', unread ? 'needs play' : t.confidence, `ps-conf ${unread ? 'none' : t.confidence}`))
  d.append(s)
  const ul = el('ul', '', 'ps-why')
  for (const w of t.why) ul.append(el('li', w))
  if (t.unlock) ul.append(el('li', t.unlock, 'ps-unlock'))
  d.append(ul)
  return d
}
function fitRow(f: Fit, open = () => {}): HTMLElement {
  const d = el('details', '', 'ps-fit')
  const s = el('summary')
  const bar = el('span', '', 'ps-bar'); const fill = el('i'); fill.style.width = `${f.score}%`; bar.append(fill)
  s.append(el('strong', f.title, 'ps-val'), el('span', `${f.level} fit`, `ps-conf ${f.level === 'Strong' ? 'high' : f.level === 'Good' ? 'medium' : 'low'}`), bar)
  d.append(s)
  const ul = el('ul', '', 'ps-why')
  for (const w of f.why) ul.append(el('li', w))
  ul.append(el('li', `Next: ${f.next}`, 'ps-unlock'))
  d.append(ul)
  d.addEventListener('toggle', () => { if (d.open) open() })
  return d
}

/** The Profile block: "Your Web3 personality". */
export function personaNodes(h: H, say: (m: string) => void): HTMLElement {
  const box = el('section', '', 'glass persona')
  const p = myPersona()
  box.append(el('h3', 'Your Web3 persona'))
  const passed = Object.values(getSave().skills).filter((s) => s?.passed).length
  const read = p.traits.filter((t) => t.value !== 'Not read yet').length
  // The reading at a glance: who you play like, and how much of you the game has read so far.
  const hero = el('div', '', 'ps-hero')
  const meter = el('div', '', 'ps-meter'); const mf = el('i'); mf.style.width = `${p.traits.length ? Math.round(read / p.traits.length * 100) : 0}%`; meter.append(mf)
  hero.append(el('small', 'You play like', 'ps-kick'), el('p', p.title, 'ps-title'), el('p', p.line, 'ps-line'), meter, el('small', `${read} of ${p.traits.length} traits read · from ${p.evidence > 0 ? `${Math.max(0, p.evidence - passed * 3)} activities and ${passed} courses` : 'your play so far'}`, 'ps-meter-note'))
  box.append(hero, el('p', 'Your traits · tap one to see why', 'kicker'))
  const traits = el('div', '', 'ps-list')
  for (const t of p.traits) traits.append(traitRow(t))
  box.append(traits)
  box.append(el('p', 'Roles that fit you', 'kicker'))
  if (p.roles.length) { const l = el('div', '', 'ps-list'); for (const f of p.roles) l.append(fitRow(f)); box.append(l); box.append(h.para('Matched from the courses you pass, the career tracks you explore and what you do in the city. Tap a role to see why, and what would make it stronger.', 'muted ps-small')) }
  else box.append(h.para('Not enough to go on yet. Pass a few courses and explore a career track, and the game will match you to Web3 roles.', 'muted'))
  if (p.niches.length) {
    box.append(el('p', 'Your corner of Web3', 'kicker'))
    const l = el('div', '', 'ps-list'); for (const f of p.niches) l.append(fitRow(f)); box.append(l)
  }
  const row = el('div', '', 'pcard-row')
  row.append(
    h.button('Share my personality', 'primary', () => {
      const post = personaPost(p, inviteLink(getSave().username))
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
      if (nav.share) void nav.share({ title: 'My Web3 personality', text: post }).catch(() => {})
      else void navigator.clipboard.writeText(post).then(() => say('Copied. Paste it in your post.')).catch(() => say('Could not copy just now.'))
    }),
    h.button('Post on 𝕏', 'ghost', () => { window.open(`https://x.com/intent/post?text=${encodeURIComponent(personaPost(p, inviteLink(getSave().username)))}`, '_blank', 'noopener') }),
  )
  box.append(row, h.para('Worked out on this device from your own play. Nothing is uploaded, and no amounts are shown.', 'muted ps-small'))
  return box
}

/** One line for the PA's brief: the reading in a sentence and the role to work towards. */
export function personaBrief(): string[] {
  const p = myPersona()
  const out: string[] = []
  const read = p.traits.filter((t) => t.value !== 'Not read yet')
  if (read.length) out.push(`You play like ${p.title.replace(/^The /, 'a ')}: ${read.slice(0, 2).map((t) => t.value.toLowerCase()).join(', ')}.`)
  if (p.roles[0]) out.push(`Best-fit role: ${p.roles[0].title} (${p.roles[0].level.toLowerCase()} fit). Next: ${p.roles[0].next}`)
  const gap = p.traits.find((t) => t.unlock)
  if (gap) out.push(`To sharpen your reading: ${gap.unlock}`)
  return out
}
