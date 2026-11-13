// Zahra, the Campus mentor: the first lesson happens in the street, not in a quiz app.
// A few short cards (one or two sentences each), then two quick questions, then the pass files to the CV
// through the same submitCourse() as the Campus panel, so save, certificate and CV data are unchanged.
import { speak, stopSpeaking } from './speech.ts'
import { COURSES, type Course } from './courses.ts'
import { getSave, submitCourse, slotKey, type CourseResult } from './state.ts'
import { SKILL_META, type SkillId } from './logic.ts'
import { nextMission } from './worlds.ts'
import { track } from './track.ts'
import { FIRST_CARDS, PLACEMENT, TOUR, LINES, biteCards } from './mentorLines.ts'
export { biteCards }

const QUICK = 2

// Placement: Zahra asks three quick questions once. Normie (beginner) starts with the basics lesson;
// Homie (already knows the space) gets the label, but everyone plays World 1 from the start.
// Stored per save slot beside the save (not inside it), so save and account formats are unchanged.
export type Level = 'normie' | 'homie'
const levelKey = () => `${slotKey()}.level`
export function getLevel(): Level | null { try { const v = localStorage.getItem(levelKey()); return v === 'homie' || v === 'normie' ? v : null } catch { return null } }
function setLevel(l: Level): void { try { localStorage.setItem(levelKey(), l) } catch { /* private mode */ } }
/** Everyone starts at World 1 (Homie is a label only); this is just the next mission on the path. */
export function advancedNext(): SkillId | undefined { return nextMission() }


const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n
}

export type MentorHooks = {
  /** Turn the camera so Zahra is in view while she talks. */
  face?: () => void
  toast: (m: string) => void
  onRank: () => void
  fullLesson: (id: SkillId) => void
  next: () => void
  /** Walk the player to Campus (the tour's last step). */
  toCampus?: () => void
  /** Zahra's face, rendered from her figure in the city (data URL), for her card. */
  face3d?: () => string | null
}

// Zahra's welcome tour: Web3 in two lines, then how to play. Spoken in her voice (speech.ts) as each card shows;
// the joystick and menu glow when she talks about them. Shown once on this device (Settings > Tour with Zahra
// replays it). Skippable at every step.
const TOUR_KEY = 'gd.tour.v1'
export const tourSeen = (): boolean => { try { return localStorage.getItem(TOUR_KEY) === '1' } catch { return true } }

export function createMentorCard(hooks: MentorHooks) {
  const root = h('div', 'mentor')
  root.hidden = true
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Zahra, Campus mentor')
  document.body.append(root)
  let open = false
  // Zahra's voice: each new line on her card is spoken (a woman's voice; Settings > Voices turns it off).
  let said = ''
  new MutationObserver(() => {
    const line = root.hidden ? '' : root.querySelector('.mentor-say')?.textContent?.trim() ?? ''
    if (!line) { if (root.hidden && said) { said = ''; stopSpeaking() } return }
    if (line !== said) { said = line; speak(line, { gender: 'f', seed: 3, voice: 'zahra' }) }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] })
  // Her face on the card lights up while she speaks.
  window.addEventListener('gd:voice', (e) => { const d = (e as CustomEvent<{ who: string; on: boolean }>).detail; if (d.who === 'zahra') root.classList.toggle('speaking', d.on) })

  let faceUrl: string | null | undefined
  const close = () => { open = false; root.hidden = true; root.replaceChildren(); document.body.classList.remove('mentor-on') }
  const shell = (step: string, total: number, at: number) => {
    const head = h('div', 'mentor-head')
    const face = h('span', 'mentor-face', 'Z'); face.setAttribute('aria-hidden', 'true')
    if (faceUrl === undefined) faceUrl = hooks.face3d?.() ?? null
    if (faceUrl) { face.style.backgroundImage = `url(${faceUrl})`; face.classList.add('has-photo') }
    face.append(h('i', 'mentor-wave'))
    const who = h('div', 'mentor-who'); who.append(h('b', '', 'Zahra'), h('small', '', step))
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

    const total0 = total
    const placement = (qi: number, right: number) => {
      const q = PLACEMENT[qi]!
      const [head, dots] = shell(`Quick check ${qi + 1} of ${PLACEMENT.length} · Normie or Homie?`, PLACEMENT.length, qi)
      const list = h('div', 'mentor-choices')
      q.choices.forEach((choice, ci) => list.append(btn(choice, 'choice', () => {
        const r = right + (ci === q.answer ? 1 : 0)
        if (qi + 1 < PLACEMENT.length) { placement(qi + 1, r); return }
        const lvl: Level = r >= 2 ? 'homie' : 'normie'
        setLevel(lvl)
        track('course_start', { course: id, placement: lvl, score: r })
        if (lvl === 'normie') { showCard(1); return }
        homie()
      })))
      root.replaceChildren(head, dots, h('p', 'mentor-say', q.prompt), list)
    }
    const homie = () => {
      const adv = advancedNext()
      const [head] = shell('You placed as a Homie', total0, 0)
      const nav = h('div', 'mentor-nav')
      if (adv === id) nav.append(btn('Start World 1', 'primary', () => showCard(1)))
      else if (adv) nav.append(btn(`Continue: ${SKILL_META[adv].title}`, 'primary', () => { close(); hooks.fullLesson(adv) }))
      root.replaceChildren(head, h('p', 'mentor-say', adv ? LINES.homie : LINES.homieDone), nav)
    }
    const intro = () => {
      const [head, dots] = shell('Campus mentor', total0, 0)
      const nav = h('div', 'mentor-nav')
      nav.append(btn("I'm new", 'ghost', () => { setLevel('normie'); showCard(1) }), btn('Test me (3 questions)', 'primary', () => placement(0, 0)))
      root.replaceChildren(head, dots, h('p', 'mentor-say', LINES.intro), nav)
    }
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
      root.replaceChildren(head, h('p', 'mentor-say', LINES.pass), nav)
    }
    const lvl = getLevel()
    if (lvl === 'homie') homie()
    else if (lvl === 'normie') showCard(0)
    else intro()
  }
  const tour = () => {
    if (open) return
    open = true
    hooks.face?.()
    root.hidden = false
    document.body.classList.add('mentor-on')
    try { localStorage.setItem(TOUR_KEY, '1') } catch { /* private mode */ }
    let lit: Element | null = null
    const light = (sel?: string) => { lit?.classList.remove('tour-spot'); lit = sel ? document.querySelector(sel) : null; lit?.classList.add('tour-spot') }
    const end = (_done: boolean) => { light(); root.classList.remove('tour-up'); close() }
    const show = (i: number) => {
      const step = TOUR[i]!
      const [head, dots] = shell(`Welcome tour \u00b7 ${i + 1} of ${TOUR.length}`, TOUR.length, i)
      head.querySelector('.mentor-x')?.addEventListener('click', () => end(false))
      light(step.spot)
      root.classList.toggle('tour-up', step.spot === '#stick') // keep the joystick she points at in view
      const nav = h('div', 'mentor-nav')
      const last = i === TOUR.length - 1
      if (last) nav.append(btn('Explore first', 'ghost', () => end(true)), btn('Take me to Campus', 'primary', () => { end(true); hooks.toCampus?.() }))
      else {
        nav.append(i ? btn('Back', 'ghost', () => show(i - 1)) : btn('Skip tour', 'ghost', () => end(false)))
        nav.append(btn('Next', 'primary', () => show(i + 1)))
      }
      root.replaceChildren(head, dots, h('p', 'mentor-say', step.say), nav)
      ;(nav.lastElementChild as HTMLButtonElement | null)?.focus({ preventScroll: true })
    }
    show(0)
  }
  /** Tapping Zahra (or walking up to her) at Campus: she says hello and offers the tour or the next lesson. */
  const hello = () => {
    if (open) return
    open = true
    hooks.face?.()
    root.hidden = false
    document.body.classList.add('mentor-on')
    const next = nextMission()
    const due = next && !getSave().skills[next]?.passed && (FIRST_CARDS[next] || COURSES.some((c) => c.id === next))
    const [head] = shell('Campus guide', 0, 0)
    const nav = h('div', 'mentor-nav')
    nav.append(btn('Show me around', 'ghost', () => { close(); tour() }))
    if (due) nav.append(btn('Start my lesson', 'primary', () => { close(); start(next) }))
    else nav.append(btn('What next?', 'primary', () => { close(); hooks.next() }))
    root.replaceChildren(head, h('p', 'mentor-say', due ? LINES.hello : LINES.helloDone), nav)
    ;(nav.lastElementChild as HTMLButtonElement | null)?.focus({ preventScroll: true })
  }
  return { start, tour, hello, close, isOpen: () => open }
}
