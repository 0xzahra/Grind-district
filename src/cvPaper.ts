// One CV, laid out like a real printed document: white page, name and professional title, a short profile,
// experience, education and certifications, skills. It reads like a CV an employer would get: no game rank,
// no XP, and the one-minute lessons are not listed one by one (they roll up into the foundation programme).
// "Download PDF" prints just the page (the browser's Save as PDF). Reads the save; writes nothing.
import { SKILL_META, SKILL_ORDER, type SkillId } from './logic.ts'
import { getSave } from './state.ts'
import { getCareer, jobLevel } from './career.ts'
import { JOBS, JOB_LEVELS, TRACKS } from './careerData.ts'
import { courseById } from './courses.ts'
import { WORLDS, worldDone } from './worlds.ts'

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }
const month = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
/** What finishing each foundation module shows an employer. */
const MODULE_SKILL: Record<number, string> = { 1: 'Internet and Web3 fundamentals', 2: 'Scam and fraud awareness', 3: 'Blockchain fundamentals', 4: 'Layer 1 / Layer 2 and use-case analysis', 5: 'Web3 career planning' }

export function renderCvPaper(): HTMLElement {
  const s = getSave(), c = getCareer()
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
  // Specialist courses are the full-length ones (seven to ten minutes of reading and a graded exercise).
  const specialist = passed.filter((id) => parseInt(courseById(id)?.minutes ?? '0', 10) >= 5)
  const modules = WORLDS.filter((w) => w.n < 6) // the five foundation worlds (World 6 is the career world)
  const done = modules.filter((w) => worldDone(w.n))
  const passedAt = (id: SkillId) => s.activities.find((a) => a.kind === 'skill' && a.label === `Passed ${SKILL_META[id].title}`)?.at
  const job = JOBS.find((j) => j.id === c.job)
  const tracks = TRACKS.filter((t) => t.courses.some((id) => specialist.includes(id)))
  const title = job ? `${JOB_LEVELS[jobLevel()]} ${job.title}` : done.length >= modules.length ? 'Web3 Generalist' : done.length || specialist.length ? 'Web3 Associate' : 'Web3 Trainee'
  const page = el('div', 'cv-paper')
  const head = el('div', 'cv-head')
  head.append(el('div', 'cv-name', s.name || 'Player'), el('div', 'cv-role', title))
  head.append(el('div', 'cv-contact', [s.username ? `@${s.username}` : '', 'grinddistrict.app'].filter(Boolean).join('   ·   ')))
  page.append(head)
  const section = (name: string) => { const sec = el('div', 'cv-sec'); sec.append(el('div', 'cv-h', name)); page.append(sec); return sec }
  const item = (sec: HTMLElement, name: string, where: string, when: string, lines: string[] = []) => {
    const row = el('div', 'cv-item'); const top = el('div', 'cv-item-top')
    top.append(el('strong', '', name), el('span', 'cv-when', when)); row.append(top)
    if (where) row.append(el('em', '', where))
    if (lines.length) { const ul = el('ul'); for (const l of lines) ul.append(el('li', '', l)); row.append(ul) }
    sec.append(row)
    return row
  }
  const areas = tracks.length ? tracks.slice(0, 3).map((t) => t.title.toLowerCase()).join(', ') : 'crypto fundamentals, online safety and wallet security'
  section('Profile').append(el('div', 'cv-p', done.length || specialist.length
    ? `${job ? `${job.title} and ` : ''}Web3 learner trained on the Grind District Campus programme. Completed ${done.length} of ${modules.length} foundation modules${specialist.length ? ` and ${specialist.length} specialist course${specialist.length === 1 ? '' : 's'}` : ''}, with practical exercises in ${areas}.`
    : 'Early-career Web3 learner enrolled in the Grind District Campus programme, building foundations in crypto, online safety and blockchain before specialising.'))
  const exp = section('Experience')
  if (job) item(exp, `${JOB_LEVELS[jobLevel()]} ${job.title}`, 'Grind District', 'Present', job.duties.map((d) => d.text))
  for (const t of tracks.slice(0, 4)) item(exp, `${t.title} · practical track`, 'Grind District Campus', '', [t.topics])
  if (!job && !tracks.length) exp.append(el('div', 'cv-p cv-muted', 'Roles appear here once a job is taken in Careers.'))
  const edu = section('Education and certifications')
  edu.dataset.sec = 'edu' // nftAccess.ts adds the on-chain credentials here
  const current = modules.find((w) => !worldDone(w.n))
  item(edu, 'Web3 Foundations Programme', 'Grind District Campus', done.length >= modules.length ? 'Completed' : `${done.length} of ${modules.length} modules`,
    done.length ? done.map((w) => `${w.title}${w.badge ? ` (${w.badge} badge)` : ''}`) : [`In progress: ${current ? current.title : 'foundation modules'}`])
  for (const id of specialist) { const at = passedAt(id); item(edu, `${SKILL_META[id].title} · certificate`, 'Grind District Campus', at ? month(at) : '', [SKILL_META[id].cv.replace(/^[^—]+— /, '').replace(/^./, (ch) => ch.toUpperCase())]).dataset.course = id }
  const sk = section('Skills')
  const tags = [...new Set([...done.map((w) => MODULE_SKILL[w.n] ?? w.title), ...specialist.map((id) => SKILL_META[id].title), ...tracks.map((t) => t.title)])].slice(0, 14)
  const list = el('div', 'cv-skills')
  for (const t of tags.length ? tags : ['Web3 fundamentals (in training)', 'Online safety', 'Wallet security']) list.append(el('span', 'cv-chip', t))
  sk.append(list)
  page.append(el('div', 'cv-foot', `Grind District Campus · grinddistrict.app · ${month(Date.now())}. Course records come from the Grind District learning game; trading practice uses simulated balances.`))
  return page
}

/** Print only the CV page; on phones and desktops the print dialog offers "Save as PDF". */
export function printCv(page: HTMLElement): void {
  document.getElementById('print-cv')?.remove()
  const box = el('div'); box.id = 'print-cv'; box.append(page.cloneNode(true))
  document.body.append(box); document.body.classList.add('printing-cv')
  const done = () => { box.remove(); document.body.classList.remove('printing-cv'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  window.setTimeout(() => window.print(), 50)
}
