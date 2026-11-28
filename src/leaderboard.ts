// Lessons leaderboard (Campus). Data comes from the server (api/profile op=lb), built from server-graded exam passes.
// Only in-game display names are shown. A weekly top-3 prize is paid in in-game cash, once, by the server.
import { creditBoardReward, heldNearProof } from './state.ts'
const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

type Entry = { rank: number; name: string; passed: number; me?: boolean }
type Win = { rank: number; name: string; gained: number; me?: boolean }
type Board = {
  total: number; weekStart: number; weekEnd: number; rewards: number[]; firstPayout: number
  finished: Entry[]; climbing: Entry[]; me: { rank: number; passed: number; finished: boolean } | null
  week: Win[]; lastWeek: Win[]; reward: { rank: number; amount: number; fresh: boolean; period: string } | null
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n
}
const MEDAL = ['🥇', '🥈', '🥉']
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })

async function fetchBoard(): Promise<Board | 'signin' | 'error'> {
  try {
    const { accessToken } = await import('./login.ts')
    const t = await accessToken()
    const near = heldNearProof()
    if (!t && !near) return 'signin'
    const r = await fetch('/api/profile?op=lb', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(t ? {} : { near }),
    })
    if (r.status === 401 || r.status === 404) return 'signin'
    if (!r.ok) return 'error'
    return await r.json() as Board
  } catch { return 'error' }
}

function row(e: Entry, total: number): HTMLElement {
  const li = h('li', `lb-row${e.me ? ' me' : ''}`)
  const bar = h('div', 'lx-bar'); const fill = h('i'); fill.style.width = `${Math.round((e.passed / total) * 100)}%`; bar.append(fill)
  const mid = h('div', 'lb-mid'); mid.append(h('b', '', e.me ? `${e.name} (you)` : e.name), bar)
  li.append(h('span', 'lb-pos', `#${e.rank}`), mid, h('span', 'lb-n', `${e.passed}/${total}`))
  return li
}

function podium(list: Win[], rewards: number[], empty: string): HTMLElement {
  const box = h('div', 'lb-podium')
  if (!list.length) { box.append(h('p', 'muted lb-empty', empty)); return box }
  // 2nd, 1st, 3rd: the winner stands tallest in the middle.
  for (const i of [1, 0, 2]) {
    const w = list[i]
    const step = h('div', `lb-step s${i + 1}${w ? '' : ' none'}${w?.me ? ' me' : ''}`)
    step.append(h('span', 'lb-medal', MEDAL[i]!), h('b', '', w ? w.name : '—'), h('small', '', w ? `${w.gained} lesson${w.gained === 1 ? '' : 's'}${w.me ? ' · you' : ''}` : 'open'), h('em', '', money(rewards[i]!)))
    box.append(step)
  }
  return box
}

/** The leaderboard view. `back` is the Campus "back" key supplied by the caller. */
export function renderLeaderboard(back: HTMLElement): HTMLElement {
  const root = h('div', 'lx lb')
  root.append(back, h('p', 'lx-sub', 'Lessons leaderboard'))
  const body = h('div', 'lb-body'); root.append(body)
  body.append(h('p', 'muted', 'Loading the board…'))
  void fetchBoard().then((b) => {
    body.replaceChildren()
    if (b === 'signin') { body.append(h('p', 'lb-note', 'Sign in to see the leaderboard and play for the weekly prizes.')); return }
    if (b === 'error') { body.append(h('p', 'lb-note', 'The board could not load right now. Try again in a moment.')); return }
    const total = b.total
    if (b.reward?.fresh) creditBoardReward(b.reward.amount, b.reward.rank)
    if (b.reward) {
      const prize = h('div', `lb-prize${b.reward.fresh ? ' fresh' : ''}`)
      prize.append(h('b', '', `${MEDAL[b.reward.rank - 1]} You finished #${b.reward.rank} last week`), h('span', '', b.reward.fresh ? `${money(b.reward.amount)} in-game cash added to your balance.` : `${money(b.reward.amount)} in-game cash was already added.`))
      body.append(prize)
    }
    body.append(h('p', 'lb-sub', `This week · ${day(b.weekStart)} to ${day(b.weekEnd - 1)}`))
    body.append(podium(b.week, b.rewards, 'No lessons passed yet this week. The first pass takes the top step.'))
    const rules = h('div', 'lb-rules')
    rules.append(
      h('b', '', 'Weekly prizes (in-game cash only)'),
      h('span', '', `${MEDAL[0]} ${money(b.rewards[0]!)}   ${MEDAL[1]} ${money(b.rewards[1]!)}   ${MEDAL[2]} ${money(b.rewards[2]!)}`),
      h('small', '', `The week with the most exam-verified lessons wins. Weeks run Monday to Sunday (Nigeria time). Prizes are added once, the following week, to your balance when you open this board. First payout: ${day(b.firstPayout)}. No real money, no tokens.`),
    )
    body.append(rules)
    if (b.lastWeek.length) { body.append(h('p', 'lb-sub', 'Last week’s winners')); body.append(podium(b.lastWeek, b.rewards, '')) }
    if (b.me) body.append(h('p', 'lb-you', b.me.finished ? `You finished all ${total} lessons · #${b.me.rank} among finishers` : `You: ${b.me.passed} of ${total} lessons · #${b.me.rank} on the way`))
    else body.append(h('p', 'lb-you', `You are not on the board yet. Pass a lesson and its short exam to join (${total} lessons in all).`))
    body.append(h('p', 'lb-sub', `Finished all ${total} lessons · ${b.finished.length}`))
    const fin = h('ol', 'lb-list'); if (!b.finished.length) fin.append(h('li', 'muted lb-empty', 'Nobody has finished every lesson yet. The first finisher leads this list.')); for (const e of b.finished) fin.append(row(e, total)); body.append(fin)
    body.append(h('p', 'lb-sub', 'On the way · ranked by lessons passed'))
    const way = h('ol', 'lb-list'); if (!b.climbing.length) way.append(h('li', 'muted lb-empty', 'No one yet.')); for (const e of b.climbing) way.append(row(e, total)); body.append(way)
    body.append(h('p', 'muted lb-fine', 'Only in-game display names appear. Places come from exams graded on the server, so they cannot be edited on your device.'))
  })
  return root
}
