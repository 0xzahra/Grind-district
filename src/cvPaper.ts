// One CV, laid out like a real printed document: white A4 page, name header, a contact line with the game
// handle only, summary, education (courses + certificates), experience (jobs + careers), skills.
// "Download PDF" prints just the page (the browser's Save as PDF). Reads the save; writes nothing.
import { SKILL_META, SKILL_ORDER, rankFor, isWalletActivity, type SkillId } from './logic.ts'
import { getSave } from './state.ts'
import { getCareer, jobLevel, pinnedTitles } from './career.ts'
import { JOBS, JOB_LEVELS, TRACKS } from './careerData.ts'

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }
const month = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })

export function renderCvPaper(): HTMLElement {
  const s = getSave(), c = getCareer()
  const rank = rankFor(s.xp)
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
  const passedAt = (id: SkillId) => s.activities.find((a) => a.kind === 'skill' && a.label === `Passed ${SKILL_META[id].title}`)?.at
  const job = JOBS.find((j) => j.id === c.job)
  const page = el('div', 'cv-paper')
  const head = el('div', 'cv-head')
  head.append(el('div', 'cv-name', s.name || 'Player'), el('div', 'cv-role', job ? `${JOB_LEVELS[jobLevel()]} ${job.title}` : `${rank.label} · Grind District`))
  head.append(el('div', 'cv-contact', [s.username ? `@${s.username}` : '', 'Grind District', 'grinddistrict.app'].filter(Boolean).join('  ·  ')))
  page.append(head)
  const section = (title: string) => { const sec = el('div', 'cv-sec'); sec.append(el('div', 'cv-h', title)); page.append(sec); return sec }
  const item = (sec: HTMLElement, title: string, where: string, when: string, lines: string[] = []) => {
    const row = el('div', 'cv-item'); const top = el('div', 'cv-item-top')
    top.append(el('strong', '', title), el('span', 'cv-when', when)); row.append(top)
    if (where) row.append(el('em', '', where))
    if (lines.length) { const ul = el('ul'); for (const l of lines) ul.append(el('li', '', l)); row.append(ul) }
    sec.append(row)
  }
  const summary = section('Summary')
  summary.append(el('div', 'cv-p', passed.length
    ? `${rank.label} in Grind District with ${s.xp} XP and ${passed.length} course${passed.length === 1 ? '' : 's'} passed on Campus. Reputation ${s.reputation}, ${s.streak}-day streak.${job ? ` Currently working as ${job.title}.` : ''}`
    : `New to Grind District, learning the basics of crypto and Web3 on Campus. Reputation ${s.reputation}, ${s.streak}-day streak.`))
  const exp = section('Experience')
  if (job) item(exp, `${JOB_LEVELS[jobLevel()]} ${job.title}`, 'Grind District', 'Present', job.duties.map((d) => d.text))
  const tracks = TRACKS.filter((t) => t.courses.some((id) => s.skills[id]?.passed))
  for (const t of tracks.slice(0, 4)) item(exp, `${t.title} path`, 'Earn Paths, Grind District', '', [t.topics])
  const gigs = s.activities.filter((a) => (a.kind === 'gig' || a.kind === 'social' || a.kind === 'trade') && !isWalletActivity(a)).slice(0, 4)
  if (gigs.length) item(exp, 'City activity', 'Grind District', '', gigs.map((a) => `${a.label} (${month(a.at)})`))
  if (!job && !tracks.length && !gigs.length) exp.append(el('div', 'cv-p cv-muted', 'No roles yet. Pass a course, then take a job in Careers.'))
  const edu = section('Courses and certificates')
  if (passed.length) for (const id of passed) { const at = passedAt(id); item(edu, SKILL_META[id].title, 'Campus, Grind District · certificate', at ? month(at) : '', [SKILL_META[id].cv]) }
  else edu.append(el('div', 'cv-p cv-muted', 'No courses passed yet. Meet Zahra at Campus for the first 1-minute lesson.'))
  const pins = pinnedTitles()
  const sk = section('Skills')
  const tags = [...new Set([...pins, ...tracks.map((t) => t.title), ...passed.map((id) => SKILL_META[id].title)])].slice(0, 12)
  const list = el('div', 'cv-p cv-skills', tags.length ? tags.join('  ·  ') : 'Learning: crypto basics, wallet safety, practice trading')
  sk.append(list)
  page.append(el('div', 'cv-foot', `In-game profile, ${month(Date.now())}. Practice values only. Not financial advice.`))
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
