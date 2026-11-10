// Courses home: unit path with progress rings, continue card, streak, XP/level header, certificate gallery.
import { COURSES } from './courses.ts'
import { getSave } from './state.ts'
import { RANKS, SKILL_META, type SkillId } from './logic.ts'
import { openCertificate } from './certs.ts'
import { courseArt } from './courseArt.ts'
import { WORLDS, worldOpen, worldDone, lockReason, nextMission, worldOf, badges, scamShield } from './worlds.ts'
import { EARNING_MAP, EARNING_WARNING } from './worldCourses.ts'

/** World 5's browsable Earning Map: four groups, each branch expands to its list. */
function earningMap(): HTMLElement {
  const box = h('details', 'lx-map')
  box.append(h('summary', '', '🗺️ Open the Earning Map · Money · Skills · Time · Builder'))
  for (const g of EARNING_MAP) {
    const grp = h('details', 'lx-map-g'); grp.append(h('summary', '', `${g.group} — ${g.note}`))
    for (const [name, items] of g.branches) {
      const br = h('details', 'lx-map-b'); br.append(h('summary', '', `${name} · ${items.length}`))
      const ul = h('ul'); for (const it of items) ul.append(h('li', '', it)); br.append(ul); grp.append(br)
    }
    box.append(grp)
  }
  box.append(h('p', 'lx-map-warn', `⚠️ ${EARNING_WARNING}`))
  return box
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n
}

export function ring(frac: number, size = 44, label = ''): HTMLElement {
  const r = size / 2 - 4, c = 2 * Math.PI * r
  const w = h('div', 'lx-ring')
  w.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="4"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#d8b46a" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, frac)))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span>${label}</span>`
  return w
}

export function renderLearnHome(onCourse: (id: SkillId) => void): HTMLElement {
  const s = getSave()
  const root = h('div', 'lx')
  const passed = (id: SkillId) => Boolean(s.skills[id]?.passed)
  const done = COURSES.filter((c) => passed(c.id)).length
  const rankI = RANKS.reduce((a, r, i) => (s.xp >= r.xp ? i : a), 0)
  const next = RANKS[rankI + 1]
  const cur = RANKS[rankI]
  const frac = next ? (s.xp - cur.xp) / (next.xp - cur.xp) : 1
  // Header: level, XP bar, streak flame (muted amber, no glow)
  const head = h('div', 'lx-head')
  const lvl = h('div', 'lx-lvl'); lvl.append(ring(frac, 56, String(rankI + 1)))
  const meta = h('div', 'lx-meta')
  meta.append(h('b', '', `Level ${rankI + 1} · ${cur.label}`), h('small', '', next ? `${s.xp} / ${next.xp} XP to ${next.label}` : `${s.xp} XP · top level`))
  const bar = h('div', 'lx-bar'); const fill = h('i'); fill.style.width = `${Math.round(frac * 100)}%`; bar.append(fill); meta.append(bar)
  const streak = h('div', 'lx-streak'); streak.innerHTML = `<svg width="18" height="22" viewBox="0 0 18 22"><path d="M9 1c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="#c8894a"/></svg><b>${s.streak}</b><small>day streak</small>`
  head.append(lvl, meta, streak)
  root.append(head)
  // Continue: the next playable mission in World order.
  const nextId = nextMission()
  const nextCourse = nextId ? COURSES.find((c) => c.id === nextId) : undefined
  if (nextCourse) {
    const w = worldOf(nextCourse.id)
    const card = h('button', 'lx-continue')
    card.append(h('small', '', `Continue · World ${w?.n ?? 1}: ${w?.title ?? ''}`), h('b', '', SKILL_META[nextCourse.id].title), h('span', '', `${nextCourse.minutes} · ${nextCourse.questions.length} checks · +70 XP`))
    card.onclick = () => onCourse(nextCourse.id)
    root.append(card)
  }
  const earned = badges()
  root.append(h('p', 'lx-sub', `Your worlds · ${done}/${COURSES.length} missions · ${earned.length ? `Badges: ${earned.join(', ')}` : 'no badges yet'}`))
  for (const w of WORLDS) {
    const ids = [...w.missions, ...(w.boss ? [w.boss] : [])]
    const got = ids.filter(passed).length
    const open = worldOpen(w.n)
    const unit = h('section', `lx-unit lx-world${open ? '' : ' locked'}${worldDone(w.n) && w.n < 6 ? ' won' : ''}`)
    const uh = h('div', 'lx-unit-h'); uh.append(ring(got / ids.length, 40, `${got}/${ids.length}`))
    const ut = h('div'); ut.append(h('small', '', `World ${w.n}${open ? '' : ' · 🔒 locked'}`), h('b', '', w.title), h('small', 'lx-badge', w.n < 6 ? `${worldDone(w.n) ? '🏅' : '◇'} Reward: ${w.reward} · ${w.unlocks}` : `${open ? '' : '🔒 '}The open city: ${w.unlocks}`))
    uh.append(ut); unit.append(uh)
    const grid = h('div', 'lx-grid')
    const addCard = (id: SkillId, boss = false, target = grid) => {
      const c = COURSES.find((x) => x.id === id); if (!c) return
      const ok = passed(id), lock = lockReason(id), isNext = id === nextId
      const card = h('button', `lx-card${ok ? ' done' : ''}${isNext ? ' next' : ''}${lock ? ' locked' : ''}${boss ? ' boss' : ''}`)
      card.type = 'button'
      const body = h('div', 'lx-card-b')
      const pb = h('div', 'lx-bar'); const pf = h('i'); pf.style.width = `${ok ? 100 : isNext ? 8 : 0}%`; pb.append(pf)
      body.append(h('small', 'lx-level', boss ? `Boss${ok ? ' · ✓ Beaten' : ''}` : ok ? '✓ Done' : lock ? '🔒 Locked' : isNext ? 'Up next' : 'Mission'), h('b', '', SKILL_META[id].title), h('span', 'lx-count', lock || `${c.questions.length} checks · ${c.minutes}`), pb)
      card.append(courseArt(id), body)
      card.onclick = () => { if (!lock) onCourse(id) }
      target.append(card)
    }
    w.missions.forEach((id) => addCard(id))
    if (w.boss) addCard(w.boss, true)
    unit.append(grid)
    if (w.extra) { unit.append(h('p', 'lx-sub', `${w.extra.title}${w.extra.needsShield && !scamShield() ? ' · 🔒 earn Scam Shield' : w.extra.needsShield ? '' : ' · optional'}`)); const g2 = h('div', 'lx-grid'); unit.append(g2); w.extra.missions.forEach((id) => addCard(id, false, g2)) }
    if (w.n === 5) unit.append(earningMap())
    root.append(unit)
  }
  // Certificates gallery
  root.append(h('p', 'lx-sub', 'Certificates'))
  const gal = h('div', 'lx-certs')
  const got = COURSES.filter((c) => passed(c.id))
  if (!got.length) gal.append(h('p', 'muted', 'Pass a lesson to earn your first certificate.'))
  for (const c of got) {
    const card = h('button', 'lx-cert'); card.append(h('small', '', 'Certificate'), h('b', '', SKILL_META[c.id].title))
    card.onclick = () => void openCertificate(c.id)
    gal.append(card)
  }
  root.append(gal)
  return root
}
