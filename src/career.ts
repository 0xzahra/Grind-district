// Career: learning / practice / jobs progress, Earn Paths, weekly free season, jobs, pinned certs, City Feed.
// localStorage per save slot (same pattern as the save); pins sync to Supabase via the existing /api/profile.
import { partySize } from './messages.ts'
import { getSave, onActivity, addReputation, earnCash, setTint, slotKey } from './state.ts'
import { SKILL_META, SKILL_ORDER, COURSE_CASH, type SkillId } from './logic.ts'
import { WORLDS, worldDone, nextMission, lockReason, careersOpen, tradingOpen } from './worlds.ts'
import { TRACKS, JOBS, JOB_LEVELS, JOB_XP_PER_LEVEL, WEEKLY_POOL, SEASON, RANKS_LADDER, RANK_STEPS, DISCLAIMER, type TaskKind } from './careerData.ts'
import { schedule } from './events.ts'

type FeedPost = { at: number; text: string; go?: string }
type Career = {
  week: string; weekCounts: Record<string, number>; /** Season challenge progress (was shown as pts/SP). Not a spendable currency. */ seasonPts: number; seasonWeek: Record<string, string[]>
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
  if (got.k === 'conference') { c.events += 1; if (partySize() >= 2) earnCash(10 * Math.min(3, partySize() - 1), 'Party event bonus', `Attended with ${partySize() - 1} party member(s).`, 10 * (partySize() - 1)) }
  // Weekly
  const wk = weekly()
  for (const w of wk) if (matches(w.kind, got)) {
    const before = c.weekCounts[w.id] ?? 0
    if (before < w.count) { c.weekCounts[w.id] = before + 1; if (before + 1 === w.count) { c.seasonPts += 1; earnCash(50, `Weekly challenge: ${w.text}`, 'Weekly challenge complete (once per week).'); toast(`Weekly done: ${w.text}. +$50.00`); grantRewards() } }
  }
  // Earn Path practice (once a day per track)
  for (const t of TRACKS) if (matches(t.task.kind, got, t.task.course) && c.trackDay[t.id] !== day()) {
    const before = rankIdx(c.track[t.id] ?? 0); c.track[t.id] = (c.track[t.id] ?? 0) + 1; c.trackDay[t.id] = day()
    earnCash(10, `Earn Path practice: ${t.title}`, 'Daily practice task (once a day per path).'); toast(`${t.title} practice · +$10`)
    const after = rankIdx(c.track[t.id]); if (after > before) post(`${getSave().name || 'You'} reached ${RANKS_LADDER[after]} in ${t.title}.`, t.place ? `place:${t.place}` : undefined)
  }
  // Job duties
  const job = JOBS.find((j) => j.id === c.job)
  if (job) { if (c.dutyDay !== day()) { c.dutyDay = day(); c.duties = [] }
    for (const d of job.duties) if (!c.duties.includes(d.id) && matches(d.kind, got)) {
      c.duties.push(d.id); const lvl = jobLevel(); c.jobXp += 1
      earnCash(5 + lvl, `Job pay: ${d.text}`, `${job.title} daily duty (once a day).`)
      addReputation(1 + Math.floor(lvl / 3), `Job duty: ${d.text}`, `${job.title} · reputation for showing up.`)
      if (jobLevel() > lvl) { post(`Promoted to ${JOB_LEVELS[jobLevel()]} ${job.title}.`); toast(`Promoted: ${JOB_LEVELS[jobLevel()]} ${job.title}`) }
    } }
  if (got.k === 'course' && got.course) post(`Passed ${SKILL_META[got.course].title}.`, 'place:Campus')
  store()
}
/** The Grind Pass draws itself at the top of the Season tab (pass.ts registers it; no import cycle). */
let seasonExtra: ((root: HTMLElement, rerender: () => void) => void) | null = null
export function setSeasonExtra(fn: (root: HTMLElement, rerender: () => void) => void): void { seasonExtra = fn }
/** Grind Pass tier skip: one season step, granting that step's free reward. False at the top of the track. */
export function advanceSeason(): boolean {
  const top = SEASON[SEASON.length - 1]?.at ?? 20
  if (c.seasonPts >= top) return false
  c.seasonPts += 1; grantRewards(); store(); return true
}
/** Wear a plate frame from the free track or the Grind Pass ('' takes it off). */
export function equipFrame(id: string): void { c.frame = id; store() }
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
// Live city moments: a deterministic rotation (every 3 hours, 45 minutes long). Show up nearby for $15 in-game (once per moment).
const MOMENTS = [
  { id: 'market', title: 'Pop-up market on the plaza', place: 'Plaza', go: 'place:The Grind Ring', x: 0, z: 0 },
  { id: 'lecture', title: 'Guest lecturer at the Campus', place: 'Campus', go: 'place:Campus', x: 0, z: -44 },
  { id: 'cars', title: 'Car show outside Gadgets', place: 'Gadgets', go: 'place:Gadgets', x: -16, z: 18 },
]
export function currentMoment(now = Date.now()) {
  const slot = Math.floor(now / (3 * 36e5)); const into = now - slot * 3 * 36e5
  return into < 45 * 60_000 ? { ...MOMENTS[slot % MOMENTS.length]!, key: `m-${slot}` } : null
}
export function startMoments(pos: () => { x: number; z: number }): void {
  const tick = () => {
    const m = currentMoment(); if (!m) return
    post(`Live now: ${m.title}. Drop by for $15 in-game.`, m.go, m.key)
    const p = pos()
    if (Math.hypot(p.x - m.x, p.z - m.z) < 14 && !c.feedSeen.includes(`${m.key}-xp`)) {
      c.feedSeen = [`${m.key}-xp`, ...c.feedSeen].slice(0, 80); store()
      earnCash(15, `City moment: ${m.title}`, 'Showed up to a live city moment.', 15); toast(`${m.title} · +$15`)
    }
  }
  tick(); window.setInterval(tick, 10_000)
}
export function feedRankUp(label: string): void { post(`${getSave().name || 'A player'} ranked up to ${label}.`, 'place:The Grind Ring') }

// ---------- UI ----------
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const bar = (label: string, v: number, max: number) => { const w = el('div', '', 'cr-bar'); const l = el('div', '', 'cr-bar-head'); l.append(el('span', label), el('span', `${Math.min(v, max)}/${max}`)); const t = el('div', '', 'cr-track'); const f = el('i'); f.style.width = `${Math.min(100, (v / max) * 100)}%`; t.append(f); w.append(l, t); return w }
const btn = (text: string, on: () => void, cls = 'cr-btn') => { const b = el('button', text, cls); b.type = 'button'; b.onclick = on; return b }


type StepView = { text: string; sub: string; run: () => void }
let stepSource: (() => StepView) | null = null
/** main.ts hands in the HUD's next-step logic so the Career sheet always leads with the same single action. */
export function setStepSource(f: () => StepView): void { stepSource = f }
let upgradeCard: (() => HTMLElement) | null = null
/** main.ts hands in the Free Will upgrade card for the Progress tab. */
export function setUpgradeCard(f: () => HTMLElement): void { upgradeCard = f }
function nextStepCard(): HTMLElement | null {
  if (!stepSource) return null
  const st = stepSource()
  const b = el('button', '', 'cr-next'); b.type = 'button'
  b.append(el('small', 'Your next step'), el('strong', st.text), el('span', st.sub))
  b.onclick = st.run
  return b
}

/** One lesson row: title, status, and a Start/Review button that opens that exact course. */
function lessonRow(id: SkillId, passed: boolean, next: boolean): HTMLElement {
  const row = el('div', '', 'cr-lesson' + (passed ? ' done' : next ? ' next' : ''))
  const info = el('div', '', 'cr-lesson-info')
  const lock = lockReason(id)
  info.append(el('strong', SKILL_META[id].title), el('small', passed ? 'Passed · on your CV' : lock ? `🔒 ${lock}` : `${next ? 'Up next' : 'Not started'} · +$${COURSE_CASH} on pass`))
  const b = btn(passed ? 'Review' : lock ? 'Locked' : 'Start', () => { if (!lock) window.dispatchEvent(new CustomEvent('gd:course', { detail: id })) }, passed || lock ? 'cr-btn' : 'cr-btn primary')
  if (lock) b.setAttribute('aria-disabled', 'true')
  row.append(info, b)
  return row
}
export function renderCareer(root: HTMLElement, go: (to: string) => void, onPins: () => void, tab = 'overview'): void {
  rollWeek()
  const s = getSave()
  const tabs = el('div', '', 'cr-tabs')
  const body = el('div', '', 'cr-body')
  const T: Array<[string, string]> = [['courses', 'Lessons'], ['paths', 'Careers'], ['overview', 'Progress'], ['history', 'History'], ['weekly', 'Season'], ['jobs', 'Jobs']]
  for (const [id, label] of T) { const b = btn(label, () => renderCareer(root, go, onPins, id), 'cr-tab' + (id === tab ? ' on' : '')); tabs.append(b) }
  root.replaceChildren(tabs, body)
  // The open tab is always fully in view in the scrolling strip.
  requestAnimationFrame(() => { const on = tabs.querySelector<HTMLElement>('.cr-tab.on'); if (on) tabs.scrollLeft = Math.max(0, on.offsetLeft - (tabs.clientWidth - on.offsetWidth) / 2) })
  // The next-step card guides learning; Season, History and Jobs open straight on their own content.
  if (tab === 'courses' || tab === 'paths' || tab === 'overview') { const n = nextStepCard(); if (n) body.append(n) }
  if (tab === 'courses') {
    const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed).length
    body.append(el('h3', 'Courses on Campus'), bar('Courses passed', passed, SKILL_ORDER.length), el('p', 'Each pass is filed to your CV, resume and portfolio with a certificate.', 'cc-muted'),
      btn('Walk to Campus to study in person', () => go('place:Campus')))
    const firstOpen = nextMission()
    for (const w of WORLDS) {
      body.append(el('h4', `World ${w.n} · ${w.title} · ${worldDone(w.n) && w.n < 6 ? `${w.reward} ✓` : w.reward}`))
      for (const id of [...w.missions, ...(w.boss ? [w.boss] : []), ...(w.extra?.missions ?? [])]) body.append(lessonRow(id, !!s.skills[id]?.passed, id === firstOpen))
    }
    return
  }
  if (tab === 'history') { renderFeed(body, go); return }
  if (tab === 'overview') {
    const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
    if (upgradeCard) body.append(upgradeCard())
    body.append(el('h3', 'Progress'), bar('Learning · courses passed', passed.length, SKILL_ORDER.length), bar('Trading practice · sized trades', c.trades, 25), bar(`Jobs · ${c.job ? JOB_LEVELS[jobLevel()] : 'no job yet'}`, jobLevel() + (c.job ? 1 : 0), 10))
    body.append(el('h3', 'Pinned certificates'), el('p', 'Pin up to 3. They show on your /cv page and share card.', 'cc-muted'))
    if (!passed.length) body.append(el('p', 'Pass a course in the Campus to earn a certificate.', 'cc-muted'))
    const list = el('div', '', 'cr-pins')
    for (const id of passed) {
      const on = c.pins.includes(id)
      list.append(btn(`${on ? '✓ ' : ''}${SKILL_META[id].title}`, () => {
        if (on) c.pins = c.pins.filter((p) => p !== id); else if (c.pins.length < 3) c.pins = [...c.pins, id]; else { toast('Unpin one first (max 3).'); return }
        store(); onPins(); renderCareer(root, go, onPins, tab)
      }, 'cr-chip' + (on ? ' on' : '')))
    }
    body.append(list)
  } else if (tab === 'paths' && !careersOpen()) {
    body.append(el('h3', 'Careers in the city'), el('p', '🔒 Careers open with the Pathfinder badge: finish World 5, The Earning Map, on Campus.', 'cc-muted'), btn('Go to my next mission', () => { const m = nextMission(); if (m) window.dispatchEvent(new CustomEvent('gd:course', { detail: m })) }, 'cr-btn primary'))
  } else if (tab === 'paths') {
    body.append(el('h3', 'Careers in the city'), el('p', 'Pick one. Do its task at the building once a day to rank up.', 'cc-muted'))
    const first = (txt: string) => (txt.match(/^[^.!?]+[.!?]/)?.[0] ?? txt)
    for (const t of TRACKS) {
      const n = c.track[t.id] ?? 0; const r = rankIdx(n)
      const card = el('details', '', 'cr-card')
      const done = c.trackDay[t.id] === day()
      const sum = el('summary'); sum.append(el('strong', t.title), el('span', `${RANKS_LADDER[r]}${done ? ' · done today ✓' : ''}`, 'cr-sub')); card.append(sum)
      card.append(el('p', first(t.lesson), 'cr-say'))
      card.append(el('p', `Today: ${t.task.text} · +$10 once a day`, 'cr-task'))
      if (t.id === 'trading' && !tradingOpen()) { card.append(el('p', '🔒 Trading opens after Worlds 1 to 5. Learn the map and the scams first.', 'cr-risk')); body.append(card); continue }
      if (t.place) card.append(btn(`Walk to ${t.place} ›`, () => go(`place:${t.place}`), 'cr-btn primary'))
      const nextR = RANK_STEPS[r + 1]
      card.append(nextR != null ? bar(`Next rank: ${RANKS_LADDER[r + 1]}`, n, nextR) : el('p', `Top rank: ${RANKS_LADDER[r]}`, 'cc-muted'))
      const more = el('details', '', 'cr-more'); const ms = el('summary', 'More about this career'); more.append(ms, el('p', t.lesson), el('p', `Risk: ${t.risk}`, 'cr-risk'), el('p', DISCLAIMER, 'cc-muted')); card.append(more)
      if (t.courses.length) {
        const nextId = t.courses.find((id) => !s.skills[id]?.passed)
        const doneN = t.courses.filter((id) => s.skills[id]?.passed).length
        card.append(el('h4', `Lessons for this career · ${doneN}/${t.courses.length} passed`))
        for (const id of t.courses) card.append(lessonRow(id, !!s.skills[id]?.passed, id === nextId))
      }
      body.append(card)
    }
  } else if (tab === 'weekly') {
    { const x = seasonExtra; if (x) x(body, () => renderCareer(root, go, onPins, tab)) }
    body.append(el('h3', `This week · ${c.week}`), el('p', 'Each challenge done moves the season one step. Nothing random.', 'cc-muted'))
    for (const w of weekly()) body.append(bar(`${w.text} · +$50`, c.weekCounts[w.id] ?? 0, w.count))
    body.append(el('h3', `Free track · ${c.seasonPts} of ${SEASON[SEASON.length - 1]?.at ?? 20} challenges`))
    const ol = el('ol', '', 'cr-season')
    for (const r of SEASON) {
      const got = c.seasonPts >= r.at
      const li = el('li', '', got ? 'on' : ''); li.append(el('span', `${r.at}`), el('strong', r.label))
      if (got && r.kind === 'tint' && r.tint != null) li.append(btn(s.tint === r.tint ? 'Wearing' : 'Wear', () => { setTint(r.tint!); renderCareer(root, go, onPins, tab) }, 'cr-chip'))
      if (got && r.kind === 'frame') li.append(btn(c.frame === r.id ? 'Equipped' : 'Equip', () => { c.frame = r.id; store(); renderCareer(root, go, onPins, tab) }, 'cr-chip'))
      if (got && r.kind === 'house') li.append(el('small', 'In your house', 'cc-muted'))
      ol.append(li)
    }
    body.append(ol)
  } else {
    const job = JOBS.find((j) => j.id === c.job)
    if (!job && !careersOpen()) {
      body.append(el('p', '🔒 Jobs open with the Pathfinder badge (World 5, The Earning Map). Until then, your missions on Campus pay +$' + COURSE_CASH + ' each.', 'cc-muted'))
    } else if (!job) {
      body.append(el('p', 'Pick a job. Each daily duty at a city building pays +$5 or more in-game, raises Reputation and levels you through 10 ranks.', 'cc-muted'))
      for (const j of JOBS) body.append(btn(j.title, () => { c.job = j.id; c.jobXp = 0; store(); post(`Started work as ${JOB_LEVELS[0]} ${j.title}.`); renderCareer(root, go, onPins, tab) }, 'cr-btn wide'))
    } else {
      if (c.dutyDay !== day()) { c.dutyDay = day(); c.duties = []; store() }
      body.append(el('h3', `${JOB_LEVELS[jobLevel()]} ${job.title}`), bar(`Level ${jobLevel() + 1} of 10`, c.jobXp % JOB_XP_PER_LEVEL, JOB_XP_PER_LEVEL), el('p', `Reputation ${s.reputation}`, 'cc-muted'), el('h3', 'Today\u2019s duties'))
      for (const d of job.duties) { const row = el('div', '', 'cr-duty' + (c.duties.includes(d.id) ? ' on' : '')); row.append(el('span', (c.duties.includes(d.id) ? '✓ ' : '') + d.text + ` · +$${5 + jobLevel()}`)); row.append(btn('Go ›', () => go(`place:${d.place}`), 'cr-chip')); body.append(row) }
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

/** Equipped season plate frame id ('' when none), for the profile nameplate. */
export function equippedFrame(): string { return c.frame }
/** Season house rewards the player has unlocked, placed in their home. */
export function ownedHouseItems(): string[] { return [...new Set(c.houseItems)] }
