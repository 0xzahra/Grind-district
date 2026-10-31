// Career: learning / practice / jobs progress, Earn Paths, weekly free season, jobs, pinned certs, City Feed.
// localStorage per save slot (same pattern as the save); pins sync to Supabase via the existing /api/profile.
import { partySize } from './messages.ts'
import { getSave, onActivity, addReputation, bonusXp, setTint, slotKey } from './state.ts'
import { SKILL_META, SKILL_ORDER, type SkillId } from './logic.ts'
import { TRACKS, JOBS, JOB_LEVELS, JOB_XP_PER_LEVEL, WEEKLY_POOL, SEASON, RANKS_LADDER, RANK_STEPS, DISCLAIMER, type TaskKind } from './careerData.ts'
import { schedule } from './events.ts'

type FeedPost = { at: number; text: string; go?: string }
type Career = {
  week: string; weekCounts: Record<string, number>; seasonPts: number; seasonWeek: Record<string, string[]>
  track: Record<string, number>; trackDay: Record<string, string>
  job: string; jobXp: number; dutyDay: string; duties: string[]
  pins: SkillId[]; frame: string; houseItems: string[]; trades: number; events: number
  feed: FeedPost[]; feedSeen: string[]
}
const key = () => `${slotKey()}.career`
const blank = (): Career => ({ week: '', weekCounts: {}, seasonPts: 0, seasonWeek: {}, track: {}, trackDay: {}, job: '', jobXp: 0, dutyDay: '', duties: [], pins: [], frame: '', houseItems: [], trades: 0, events: 0, feed: [], feedSeen: [] })
let c: Career = blank()
function load(): void { try { c = { ...blank(), ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as Partial<Career>) } } catch { c = blank() } }
function store(): void { try { localStorage.setItem(key(), JSON.stringify(c)) } catch { /* private mode */ } for (const f of listeners) f() }
const listeners = new Set<() => void>()
export const onCareer = (f: () => void) => { listeners.add(f) }

const day = () => new Date().toISOString().slice(0, 10)
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dn); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / 864e5 + 1) / 7)}`
}
/** 6 challenges per week, deterministic from the week id (no randomness at claim time). */
export function weekly(wk = weekKey()) {
  let h = 0; for (const ch of wk) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const pool = [...WEEKLY_POOL]; const out = []
  while (out.length < 6) { h = (h * 1103515245 + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]) }
  return out
}
function rollWeek(): void { const wk = weekKey(); if (c.week !== wk) { c.week = wk; c.weekCounts = {} } }

function kindOf(kind: string, label: string): { k: TaskKind; course?: SkillId } | null {
  if (kind === 'skill' && label.startsWith('Passed ')) { const t = label.slice(7); const id = SKILL_ORDER.find((s) => SKILL_META[s].title === t); return { k: 'course', course: id } }
  if (kind === 'trade') return { k: 'trade' }
  if (label.startsWith('Joined ') || label.startsWith('Sat through the campus talk')) return { k: 'conference' }
  if (label === 'Posted a bounty') return { k: 'bounty' }
  if (label === 'Read the café board') return { k: 'cafe' }
  if (label.startsWith('Gym ')) return { k: 'gym' }
  if (label.startsWith('Pledged to')) return { k: 'pledge' }
  if (label.startsWith('Read Unit 4')) return { k: 'robot' }
  return null
}
const matches = (want: TaskKind, got: { k: TaskKind; course?: SkillId }, course?: SkillId) =>
  want === got.k ? (!course || course === got.course) : want === 'any-course' && got.k === 'course'

export function post(text: string, go?: string, once?: string): void {
  if (once) { if (c.feedSeen.includes(once)) return; c.feedSeen = [once, ...c.feedSeen].slice(0, 80) }
  c.feed = [{ at: Date.now(), text, go }, ...c.feed].slice(0, 60); store()
}
let toast: (m: string) => void = () => {}

function onAct(kind: string, label: string): void {
  if (label.startsWith('Job duty') || label.startsWith('Job level')) return
  const got = kindOf(kind, label); if (!got) return
  rollWeek()
  if (got.k === 'trade') c.trades += 1
  if (got.k === 'conference') { c.events += 1; if (partySize() >= 2) bonusXp(10 * (partySize() - 1), 'Party bonus', `Attended with ${partySize() - 1} party member(s).`) }
  // Weekly
  const wk = weekly()
  for (const w of wk) if (matches(w.kind, got)) {
    const before = c.weekCounts[w.id] ?? 0
    if (before < w.count) { c.weekCounts[w.id] = before + 1; if (before + 1 === w.count) { c.seasonPts += 1; toast(`Weekly done: ${w.text}. Season +1`); grantRewards() } }
  }
  // Earn Path practice (once a day per track)
  for (const t of TRACKS) if (matches(t.task.kind, got, t.task.course) && c.trackDay[t.id] !== day()) {
    const before = rankIdx(c.track[t.id] ?? 0); c.track[t.id] = (c.track[t.id] ?? 0) + 1; c.trackDay[t.id] = day()
    const after = rankIdx(c.track[t.id]); if (after > before) post(`${getSave().name || 'You'} reached ${RANKS_LADDER[after]} in ${t.title}.`, t.place ? `place:${t.place}` : undefined)
  }
  // Job duties
  const job = JOBS.find((j) => j.id === c.job)
  if (job) { if (c.dutyDay !== day()) { c.dutyDay = day(); c.duties = [] }
    for (const d of job.duties) if (!c.duties.includes(d.id) && matches(d.kind, got)) {
      c.duties.push(d.id); const lvl = jobLevel(); c.jobXp += 1
      addReputation(1 + Math.floor(lvl / 3), `Job duty: ${d.text}`, `${job.title} · reputation for showing up.`)
      if (jobLevel() > lvl) { post(`Promoted to ${JOB_LEVELS[jobLevel()]} ${job.title}.`); toast(`Promoted: ${JOB_LEVELS[jobLevel()]} ${job.title}`) }
    } }
  if (got.k === 'course' && got.course) post(`Passed ${SKILL_META[got.course].title}.`, 'place:Learning hall')
  store()
}
function grantRewards(): void { for (const r of SEASON) if (c.seasonPts === r.at) { post(`Unlocked ${r.label} on the free season track.`); if (r.kind === 'house') c.houseItems.push(r.id) } }

export const rankIdx = (n: number) => RANK_STEPS.reduce((a, s, i) => (n >= s ? i : a), 0)
export const jobLevel = () => Math.min(JOB_LEVELS.length - 1, Math.floor(c.jobXp / JOB_XP_PER_LEVEL))
export const getCareer = (): Readonly<Career> => c
export function pinnedTitles(): string[] { return c.pins.filter((p) => getSave().skills[p]?.passed).map((p) => SKILL_META[p].title) }

export function initCareer(opts: { toast: (m: string) => void; rankUp: (label: string) => void }): void {
  load(); rollWeek(); toast = opts.toast
  onActivity((k, l) => onAct(k, l))
  const tickEvents = () => { for (const e of schedule(new Date(), 1)) if (e.open && Math.abs(e.day.getTime() + e.hour * 36e5 - Date.now()) < 36e5) post(`${e.kind} starting: ${e.title} with ${e.host}.`, 'place:Conference centre', `ev-${e.id}`) }
  tickEvents(); window.setInterval(tickEvents, 60_000)
}
export function feedRankUp(label: string): void { post(`${getSave().name || 'A player'} ranked up to ${label}.`, 'place:The Grind Ring') }

// ---------- UI ----------
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const bar = (label: string, v: number, max: number) => { const w = el('div', '', 'cr-bar'); const l = el('div', '', 'cr-bar-head'); l.append(el('span', label), el('span', `${Math.min(v, max)}/${max}`)); const t = el('div', '', 'cr-track'); const f = el('i'); f.style.width = `${Math.min(100, (v / max) * 100)}%`; t.append(f); w.append(l, t); return w }
const btn = (text: string, on: () => void, cls = 'cr-btn') => { const b = el('button', text, cls); b.type = 'button'; b.onclick = on; return b }

export function renderCareer(root: HTMLElement, go: (to: string) => void, onPins: () => void, tab = 'overview'): void {
  rollWeek()
  const s = getSave()
  const tabs = el('div', '', 'cr-tabs')
  const body = el('div', '', 'cr-body')
  const T: Array<[string, string]> = [['overview', 'Progress'], ['paths', 'Earn Paths'], ['weekly', 'Weekly'], ['jobs', 'Jobs']]
  for (const [id, label] of T) { const b = btn(label, () => renderCareer(root, go, onPins, id), 'cr-tab' + (id === tab ? ' on' : '')); tabs.append(b) }
  root.replaceChildren(tabs, body)
  if (tab === 'overview') {
    const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
    body.append(el('h3', 'Progress'), bar('Learning · courses passed', passed.length, SKILL_ORDER.length), bar('Trading practice · sized trades', c.trades, 25), bar(`Jobs · ${c.job ? JOB_LEVELS[jobLevel()] : 'no job yet'}`, jobLevel() + (c.job ? 1 : 0), 10))
    body.append(el('h3', 'Pinned certificates'), el('p', 'Pin up to 3. They show on your /cv page and share card.', 'cc-muted'))
    if (!passed.length) body.append(el('p', 'Pass a course in the Learning hall to earn a certificate.', 'cc-muted'))
    const list = el('div', '', 'cr-pins')
    for (const id of passed) {
      const on = c.pins.includes(id)
      list.append(btn(`${on ? '✓ ' : ''}${SKILL_META[id].title}`, () => {
        if (on) c.pins = c.pins.filter((p) => p !== id); else if (c.pins.length < 3) c.pins = [...c.pins, id]; else { toast('Unpin one first (max 3).'); return }
        store(); onPins(); renderCareer(root, go, onPins, tab)
      }, 'cr-chip' + (on ? ' on' : '')))
    }
    body.append(list)
  } else if (tab === 'paths') {
    body.append(el('p', DISCLAIMER, 'cc-muted'))
    for (const t of TRACKS) {
      const n = c.track[t.id] ?? 0; const r = rankIdx(n)
      const card = el('details', '', 'cr-card')
      const sum = el('summary'); sum.append(el('strong', t.title), el('span', `${RANKS_LADDER[r]} · ${t.topics}`, 'cr-sub')); card.append(sum)
      card.append(el('p', t.lesson), el('p', `Risk: ${t.risk}`, 'cr-risk'))
      const ladder = el('ol', '', 'cr-ladder'); RANKS_LADDER.forEach((name, i) => ladder.append(el('li', `${name} · ${RANK_STEPS[i]}`, i <= r ? 'on' : ''))); card.append(ladder)
      const done = c.trackDay[t.id] === day()
      card.append(el('p', `Practice ${done ? '(done today)' : '(once a day)'}: ${t.task.text}`, 'cr-task'))
      if (t.place) card.append(btn(`Go to ${t.place} ›`, () => go(`place:${t.place}`)))
      if (t.courses.length) card.append(el('p', `Related courses: ${t.courses.map((id) => SKILL_META[id].title + (s.skills[id]?.passed ? ' ✓' : '')).join(' · ')}`, 'cc-muted'))
      body.append(card)
    }
  } else if (tab === 'weekly') {
    body.append(el('h3', `This week · ${c.week}`), el('p', 'Free season track. Cosmetic rewards only. Nothing to buy, nothing random.', 'cc-muted'))
    for (const w of weekly()) body.append(bar(w.text, c.weekCounts[w.id] ?? 0, w.count))
    body.append(el('h3', `Season · ${c.seasonPts} pts`))
    const ol = el('ol', '', 'cr-season')
    for (const r of SEASON) {
      const got = c.seasonPts >= r.at
      const li = el('li', '', got ? 'on' : ''); li.append(el('span', `${r.at} pts`), el('strong', r.label))
      if (got && r.kind === 'tint' && r.tint != null) li.append(btn(s.tint === r.tint ? 'Wearing' : 'Wear', () => { setTint(r.tint!); renderCareer(root, go, onPins, tab) }, 'cr-chip'))
      if (got && r.kind === 'frame') li.append(btn(c.frame === r.id ? 'Equipped' : 'Equip', () => { c.frame = r.id; store(); renderCareer(root, go, onPins, tab) }, 'cr-chip'))
      if (got && r.kind === 'house') li.append(el('small', 'In your house', 'cc-muted'))
      ol.append(li)
    }
    body.append(ol)
  } else {
    const job = JOBS.find((j) => j.id === c.job)
    if (!job) {
      body.append(el('p', 'Pick a job. Daily duties at city buildings raise Reputation and level you through 10 ranks.', 'cc-muted'))
      for (const j of JOBS) body.append(btn(j.title, () => { c.job = j.id; c.jobXp = 0; store(); post(`Started work as ${JOB_LEVELS[0]} ${j.title}.`); renderCareer(root, go, onPins, tab) }, 'cr-btn wide'))
    } else {
      if (c.dutyDay !== day()) { c.dutyDay = day(); c.duties = []; store() }
      body.append(el('h3', `${JOB_LEVELS[jobLevel()]} ${job.title}`), bar(`Level ${jobLevel() + 1} of 10`, c.jobXp % JOB_XP_PER_LEVEL, JOB_XP_PER_LEVEL), el('p', `Reputation ${s.reputation}`, 'cc-muted'), el('h3', 'Today\u2019s duties'))
      for (const d of job.duties) { const row = el('div', '', 'cr-duty' + (c.duties.includes(d.id) ? ' on' : '')); row.append(el('span', (c.duties.includes(d.id) ? '✓ ' : '') + d.text)); row.append(btn('Go ›', () => go(`place:${d.place}`), 'cr-chip')); body.append(row) }
      body.append(el('p', 'Ladder: ' + JOB_LEVELS.join(' → '), 'cc-muted'))
      body.append(btn('Change job (keeps reputation)', () => { c.job = ''; c.jobXp = 0; store(); renderCareer(root, go, onPins, tab) }, 'cc-link'))
    }
  }
}

export function renderFeed(root: HTMLElement, go: (to: string) => void): void {
  const list = el('ol', '', 'cc-list cr-feed')
  for (const p of c.feed) {
    const li = el('li'); const b = el('button', '', 'cc-row'); b.type = 'button'
    b.append(el('p', p.text), el('time', new Date(p.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })))
    if (p.go) { b.append(el('span', p.go.startsWith('place:') ? `Go to ${p.go.slice(6)} ›` : 'Open ›', 'cc-go')); b.onclick = () => go(p.go!) }
    li.append(b); list.append(li)
  }
  if (!c.feed.length) list.append(el('li', 'Quiet so far. Pass a course, rank up or join an event.', 'empty'))
  root.replaceChildren(el('p', 'Real city events. No likes, no counts.', 'cc-muted'), list)
}
