// Courses home: unit path with progress rings, continue card, streak, XP/level header, certificate gallery.
import { COURSES } from './courses.ts'
import { getSave } from './state.ts'
import { RANKS, SKILL_META, type SkillId } from './logic.ts'
import { openCertificate } from './certs.ts'
import { courseArt } from './courseArt.ts'
const LEVELS = ['Beginner', 'Beginner', 'Intermediate', 'Intermediate', 'Advanced', 'Advanced']

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n
}
const UNIT_NAMES = ['Foundations', 'Safety & custody', 'Markets', 'Building on-chain', 'Leadership & craft', 'Mastery']

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
  // Continue learning
  const nextCourse = COURSES.find((c) => !passed(c.id))
  if (nextCourse) {
    const card = h('button', 'lx-continue')
    const idx = COURSES.indexOf(nextCourse)
    card.append(h('small', '', `Continue learning · Unit ${Math.floor(idx / 4) + 1}`), h('b', '', SKILL_META[nextCourse.id].title), h('span', '', `${nextCourse.minutes} · ${nextCourse.questions.length} exercises · +70 XP`))
    card.onclick = () => onCourse(nextCourse.id)
    root.append(card)
  }
  const earn = h('button', 'lx-earn'); earn.append(h('b', '', 'Earn Paths'), h('span', '', 'Daily practice tracks that pay in-game cash →'))
  earn.onclick = () => window.dispatchEvent(new CustomEvent('gd:career', { detail: 'paths' }))
  root.append(earn)
  root.append(h('p', 'lx-sub', `Your path · ${done}/${COURSES.length} lessons complete`))
  // Path of units
  for (let u = 0; u * 4 < COURSES.length; u++) {
    const items = COURSES.slice(u * 4, u * 4 + 4)
    const got = items.filter((c) => passed(c.id)).length
    const unit = h('section', 'lx-unit')
    const uh = h('div', 'lx-unit-h'); uh.append(ring(got / items.length, 40, `${got}/${items.length}`))
    const ut = h('div'); ut.append(h('small', '', `Unit ${u + 1}`), h('b', '', UNIT_NAMES[u] ?? `Unit ${u + 1}`)); uh.append(ut)
    unit.append(uh)
    const path = h('div', 'lx-grid')
    items.forEach((c) => {
      const ok = passed(c.id)
      const isNext = c === nextCourse
      const card = h('button', `lx-card${ok ? ' done' : ''}${isNext ? ' next' : ''}`)
      card.type = 'button'
      const body = h('div', 'lx-card-b')
      const pct = ok ? 1 : isNext ? 0.08 : 0
      const pb = h('div', 'lx-bar'); const pf = h('i'); pf.style.width = `${Math.round(pct * 100)}%`; pb.append(pf)
      body.append(h('small', 'lx-level', `${LEVELS[u] ?? 'Advanced'}${ok ? ' · ✓ Done' : isNext ? ' · Up next' : ''}`), h('b', '', SKILL_META[c.id].title), h('span', 'lx-count', `${c.questions.length} exercises · ${c.minutes}`), pb)
      card.append(courseArt(c.id), body)
      card.onclick = () => onCourse(c.id)
      path.append(card)
    })
    unit.append(path)
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
