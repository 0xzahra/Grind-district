// The certificate exam a player takes before minting: the course's checks, picked and shuffled by the server,
// answered here and graded on the server (api/_certExam.ts). A pass gives a ticket that the mint needs.
// This screen never sees the answers; it only shows the paper and sends back the choices.
import { SKILL_META, type SkillId } from './logic.ts'

type Post = (op: 'cert-exam' | 'cert-grade', body: Record<string, unknown>) => Promise<{ ok: boolean; j: Record<string, unknown> }>
type Paper = { token: string; seconds: number; passMark: number; questions: Array<{ prompt: string; choices: string[] }> }

const held = new Map<string, { ticket: string; until: number }>()

/** A pass ticket already earned for this course in the last 25 minutes, if any. */
export const heldTicket = (course: SkillId): string | null => {
  const h = held.get(course)
  return h && h.until > Date.now() ? h.ticket : null
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n
}

/** Run the exam. Resolves with a pass ticket, or null if the player closes it or does not pass. */
export function takeExam(course: SkillId, post: Post): Promise<string | null> {
  const ready = heldTicket(course)
  if (ready) return Promise.resolve(ready)
  const title = SKILL_META[course]?.title ?? 'this course'
  return new Promise((resolve) => {
    const shade = el('div', '', 'cx-shade'); shade.id = 'cert-exam'
    shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', `Certificate exam: ${title}`)
    const card = el('div', '', 'cx-card')
    shade.append(card)
    document.body.append(shade)
    let timer = 0
    const finish = (ticket: string | null) => { window.clearInterval(timer); shade.remove(); resolve(ticket) }
    const key = (label: string, cls: string, fn: () => void) => { const b = el('button', label, `cx-key ${cls}`); b.type = 'button'; b.onclick = fn; return b }
    const head = (sub: string) => {
      const h = el('div', '', 'cx-head')
      const t = el('div'); t.append(el('p', 'Certificate exam', 'cx-kick'), el('h3', title, 'cx-title'))
      h.append(t, key('Close', 'cx-ghost cx-close', () => finish(null)))
      return [h, el('p', sub, 'cx-sub')]
    }
    const say = (msg: string, ...keys: HTMLElement[]) => {
      const row = el('div', '', 'cx-row'); row.append(...keys)
      card.replaceChildren(head('')[0]!, el('p', msg, 'cx-msg'), ...(keys.length ? [row] : []))
    }

    const start = async () => {
      window.clearInterval(timer)
      say('Getting your exam paper from the server…')
      const r = await post('cert-exam', { course }).catch(() => null)
      if (!r?.ok) return say(String(r?.j.error ?? 'Could not reach Grind District. Nothing was changed.'), key('Try again', 'cx-go', () => void start()))
      run(r.j as unknown as Paper)
    }

    const run = (paper: Paper) => {
      const picks: number[] = paper.questions.map(() => -1)
      let i = 0
      const ends = Date.now() + paper.seconds * 1000
      const clock = el('span', '', 'cx-clock')
      const tick = () => {
        const left = Math.max(0, Math.round((ends - Date.now()) / 1000))
        clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`
        if (left <= 0) { window.clearInterval(timer); say('Time is up. Start a new paper when you are ready.', key('New paper', 'cx-go', () => void start())) }
      }
      timer = window.setInterval(tick, 1000)
      const show = () => {
        const q = paper.questions[i]!
        const [h, sub] = head(`${paper.questions.length} questions · pass mark ${paper.passMark} · graded on the server`)
        const meta = el('div', '', 'cx-meta'); meta.append(el('span', `Question ${i + 1} of ${paper.questions.length}`), clock)
        const dots = el('div', '', 'cx-dots'); paper.questions.forEach((_, k) => dots.append(el('i', '', k === i ? 'now' : picks[k]! >= 0 ? 'done' : '')))
        const list = el('div', '', 'cx-choices')
        q.choices.forEach((c, k) => {
          const b = key(c, 'cx-choice', () => { picks[i] = k; list.querySelectorAll('button').forEach((x, n) => x.setAttribute('aria-pressed', String(n === k))); next.disabled = false })
          b.setAttribute('aria-pressed', String(picks[i] === k))
          list.append(b)
        })
        const last = i === paper.questions.length - 1
        const back = key('Back', 'cx-ghost', () => { i -= 1; show() }); back.disabled = i === 0
        const next = key(last ? 'Submit for grading' : 'Next', 'cx-go', () => { if (last) void submit(); else { i += 1; show() } })
        next.disabled = picks[i]! < 0
        const row = el('div', '', 'cx-row'); row.append(back, next)
        card.replaceChildren(h!, sub!, meta, dots, el('p', q.prompt, 'cx-q'), list, row)
        tick()
      }
      const submit = async () => {
        window.clearInterval(timer)
        say('Grading on the server…')
        const r = await post('cert-grade', { course, token: paper.token, answers: picks }).catch(() => null)
        if (!r?.ok) return say(String(r?.j.error ?? 'Could not reach Grind District. Your answers were not graded.'), key('New paper', 'cx-go', () => void start()))
        const g = r.j as { score: number; of: number; passMark: number; passed: boolean; missed: number[]; ticket?: string }
        if (g.passed && g.ticket) {
          held.set(course, { ticket: g.ticket, until: Date.now() + 25 * 60 * 1000 })
          return say(`Passed: ${g.score} of ${g.of}, graded on the server. Your certificate can now be minted.`, key('Continue to mint', 'cx-go', () => finish(g.ticket!)))
        }
        const which = g.missed.map((n) => n + 1)
        const list = which.length > 1 ? `${which.slice(0, -1).join(', ')} and ${which[which.length - 1]}` : String(which[0] ?? '')
        say(`${g.score} of ${g.of}. The pass mark is ${g.passMark}. Question${which.length > 1 ? 's' : ''} ${list} need another look: read the lesson again, then take a new paper (the questions come in a new order).`, key('New paper', 'cx-go', () => void start()), key('Close', 'cx-ghost', () => finish(null)))
      }
      show()
    }
    shade.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(null) })
    void start()
  })
}
