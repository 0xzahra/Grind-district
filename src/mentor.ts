// Ada, the Campus mentor: the first lesson happens in the street, not in a quiz app.
// A few short cards (one or two sentences each), then two quick questions, then the pass files to the CV
// through the same submitCourse() as the Campus panel, so save, certificate and CV data are unchanged.
import { COURSES, type Course } from './courses.ts'
import { getSave, submitCourse, type CourseResult } from './state.ts'
import { SKILL_META, type SkillId } from './logic.ts'
import { track } from './track.ts'

/** Hand-written first-lesson cards. Other courses fall back to bite-size chunks of their paragraphs. */
const FIRST_CARDS: Partial<Record<SkillId, string[]>> = {
  spot: [
    "Hi, I'm Ada. Everyone in this city starts at zero. Let's do your first lesson right here. It takes a minute.",
    'A spot trade buys the real thing, right now. Buy UNIT on the spot desk and you hold UNIT.',
    'Buyers bid. Sellers ask. The gap between the best bid and the best ask is the spread.',
    'Crossing the spread costs you before any fee. A wide spread usually means few people are trading.',
    'Two quick questions and this lesson goes on your CV.',
  ],
}
const QUICK = 2

/** Split lesson paragraphs into cards of at most two sentences (sources are dropped from the cards). */
export function biteCards(paragraphs: string[]): string[] {
  const out: string[] = []
  for (const p of paragraphs) {
    if (/^Sources?:/i.test(p.trim())) continue
    const sentences = p.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [p]
    let cur = ''
    let n = 0
    for (const s of sentences) {
      if (n >= 2 || (cur && (cur + ' ' + s).length > 190)) { out.push(cur); cur = ''; n = 0 }
      cur = cur ? `${cur} ${s}` : s
      n += 1
    }
    if (cur) out.push(cur)
  }
  return out
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n
}

export type MentorHooks = {
  /** Turn the camera so Ada is in view while she talks. */
  face?: () => void
  toast: (m: string) => void
  onRank: () => void
  fullLesson: (id: SkillId) => void
  next: () => void
}

export function createMentorCard(hooks: MentorHooks) {
  const root = h('div', 'mentor')
  root.hidden = true
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Ada, Campus mentor')
  document.body.append(root)
  let open = false

  const close = () => { open = false; root.hidden = true; root.replaceChildren(); document.body.classList.remove('mentor-on') }
  const shell = (step: string, total: number, at: number) => {
    const head = h('div', 'mentor-head')
    const face = h('span', 'mentor-face', 'A')
    const who = h('div', 'mentor-who'); who.append(h('b', '', 'Ada'), h('small', '', step))
    const x = h('button', 'mentor-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = close
    head.append(face, who, x)
    const dots = h('div', 'mentor-dots')
    for (let i = 0; i < total; i++) dots.append(h('i', i < at ? 'on' : i === at ? 'now' : ''))
    return [head, dots] as const
  }
  const btn = (text: string, cls: string, on: () => void) => { const b = h('button', `mentor-btn ${cls}`, text); b.type = 'button'; b.onclick = on; return b }

  const start = (id: SkillId) => {
    const course: Course | undefined = COURSES.find((c) => c.id === id)
    if (!course) return
    if (getSave().skills[id]?.passed) return
    const cards = FIRST_CARDS[id] ?? biteCards(course.paragraphs).slice(0, 4)
    const qs = course.questions.slice(0, QUICK)
    const total = cards.length + qs.length
    const picks: number[] = course.questions.map((q) => q.answer)
    open = true
    hooks.face?.()
    root.hidden = false
    document.body.classList.add('mentor-on')
    try { if (!localStorage.getItem('gd.firstCourseStarted')) localStorage.setItem('gd.firstCourseStarted', '1') } catch { /* private mode */ }
    track('course_start', { course: id, first: true, where: 'mentor' })

    const showCard = (i: number) => {
      const [head, dots] = shell(`Campus mentor · ${SKILL_META[id].title}`, total, i)
      const nav = h('div', 'mentor-nav')
      if (i > 0) nav.append(btn('Back', 'ghost', () => showCard(i - 1)))
      nav.append(btn(i === cards.length - 1 ? 'Ask me' : 'Next', 'primary', () => (i + 1 < cards.length ? showCard(i + 1) : showQ(0))))
      root.replaceChildren(head, dots, h('p', 'mentor-say', cards[i]!), nav)
      ;(nav.lastElementChild as HTMLButtonElement | null)?.focus({ preventScroll: true })
    }
    const showQ = (qi: number) => {
      const q = qs[qi]!
      const [head, dots] = shell(`Quick question ${qi + 1} of ${qs.length}`, total, cards.length + qi)
      const result = h('p', 'mentor-hint')
      const list = h('div', 'mentor-choices')
      q.choices.forEach((choice, ci) => list.append(btn(choice, 'choice', () => {
        if (ci !== q.answer) { result.textContent = `Not quite. ${q.hint}`; return }
        picks[course.questions.indexOf(q)] = ci
        if (qi + 1 < qs.length) showQ(qi + 1)
        else pass()
      })))
      root.replaceChildren(head, dots, h('p', 'mentor-say', q.prompt), list, result)
    }
    const pass = () => {
      // The remaining exercises stay in the full Campus lesson; the in-world first lesson only asks two.
      const outcome: CourseResult = submitCourse(id, picks)
      const [head] = shell('Lesson passed', total, total)
      if (outcome.ok) {
        if (outcome.rankedUp) hooks.onRank()
        hooks.toast(`${SKILL_META[id].title} filed to your CV.${outcome.stipend ? ' +$25 practice funds.' : ''}`)
      }
      const nav = h('div', 'mentor-nav')
      nav.append(btn('Read the full lesson', 'ghost', () => { close(); hooks.fullLesson(id) }), btn('What next?', 'primary', () => { close(); hooks.next() }))
      root.replaceChildren(head, h('p', 'mentor-say', 'Nice. That\u2019s on your CV with a certificate. Next, pick a job so the city pays you for showing up.'), nav)
    }
    showCard(0)
  }
  return { start, close, isOpen: () => open }
}
