// The Etiquette House: short masterclasses in manners, presence and a steady mind. Each is three cards and one
// question; a pass gives reputation once. They are life skills, not Web3 courses, so they give no certificate and
// do not go on the CV. The "influence" class teaches how pressure tactics work so you can spot and refuse them
// (the same defence the scam lessons build), never how to use them on people.
// Stored per save slot beside the save (save format unchanged).
import { slotKey, addReputation } from './state.ts'

type Class = { id: string; title: string; cards: string[]; ask: string; options: string[]; right: number; why: string }
export const CLASSES: Class[] = [
  {
    id: 'intro', title: 'Introductions',
    cards: ['Say your own name clearly and slowly. People cannot remember what they did not hear.', 'Repeat their name once: "Good to meet you, Amara." It tells them they matter and helps you keep it.', 'Introduce two people with a link: "Chidi audits contracts; Hana is designing a wallet." Now they have something to say.'],
    ask: 'You are introducing two people who have never met. What helps most?', options: ['Say both names and walk away', 'Give each a line about what the other does', 'Let them work it out'], right: 1,
    why: 'A link gives them a first sentence. Names alone leave a silence.',
  },
  {
    id: 'table', title: 'At the table',
    cards: ['Wait for the host to start, or for everyone to be served. Cutlery works from the outside in.', 'Your phone stays off the table. The people in front of you are the meeting.', 'Pass dishes, pour for others before yourself, and thank the people serving by looking at them.'],
    ask: 'Three forks beside your plate. Which do you use first?', options: ['The one nearest the plate', 'The outermost one', 'Whichever is biggest'], right: 1,
    why: 'Outside in: each course takes the next piece.',
  },
  {
    id: 'dress', title: 'Dress codes',
    cards: ['Black tie means a dinner suit or a long gown. Lounge suit means a suit and tie or a smart dress. Smart casual means no trainers, no tie needed.', 'When the invitation does not say, ask the host. Asking is polite; guessing is a gamble.', 'If you must guess, go one step smarter. Slightly overdressed reads as respect.'],
    ask: 'The invitation gives no dress code. What is the best move?', options: ['Wear what you wore yesterday', 'Ask the host', 'Dress down to be safe'], right: 1,
    why: 'Hosts are glad to be asked. It shows you care about their evening.',
  },
  {
    id: 'talk', title: 'Conversation',
    cards: ['Ask open questions: "How did you get into that?" beats "Do you like your job?"', 'Listen for more than half the time. Most people remember how well you listened, not what you said.', 'Leave money, salaries and holdings alone unless they bring them up. Curiosity about the person, not their balance.'],
    ask: 'Which question opens a conversation best?', options: ['"How much do you make?"', '"Do you work here?"', '"What are you working on these days?"'], right: 2,
    why: 'It is open, kind, and lets them choose how much to share.',
  },
  {
    id: 'thanks', title: 'The thank-you note',
    cards: ['Send it within a day. A late note is still better than none.', 'Be specific: name the thing they did and what it changed for you.', 'Keep it to three lines. A short true note beats a long polished one.'],
    ask: 'What makes a thank-you note land?', options: ['Length', 'Naming exactly what they did', 'Fancy paper'], right: 1,
    why: 'Specific thanks proves you noticed.',
  },
  {
    id: 'calm', title: 'A steady mind',
    cards: ['Put a pause between what happens and what you do. Ten slow breaths is a plan.', 'Judge yourself on the process you controlled, not the result you did not. A good decision can still lose.', 'Make small promises and keep them. Self-trust is built in reps, like the gym.'],
    ask: 'A careful, well-sized trade loses. What is the steady reading?', options: ['The plan was bad because it lost', 'A good process can lose; review it, then carry on', 'Double the next one to win it back'], right: 1,
    why: 'Outcomes are noisy. You keep the process and review it honestly.',
  },
  {
    id: 'influence', title: 'Influence, and how to refuse it',
    cards: ['Pressure has a pattern: hurry ("only today"), flattery ("you are smarter than the rest") and scarcity ("three spots left"). Each one tries to stop you thinking.', 'Favours create a pull to give something back. A free gift before a request is a tactic. You may say thank you and still say no.', 'Your defence is time and a second person. "I will decide tomorrow" ends most manipulation. Use these to protect people, never on them.'],
    ask: 'Someone says the offer ends in ten minutes. What is the strong reply?', options: ['"Then I had better hurry"', '"If it cannot wait a day, the answer is no"', '"Can you make it five?"'], right: 1,
    why: 'Real opportunities survive a night of sleep. Urgency is the oldest pressure tactic.',
  },
]
const REP = 3, ALL_REP = 10
const key = () => `${slotKey()}.society`
const done = (): string[] => { try { const v = JSON.parse(localStorage.getItem(key()) ?? '[]') as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } }
export const classesDone = (): number => done().length
export const polished = (): boolean => done().length >= CLASSES.length

function pass(id: string): string {
  const d = done()
  if (d.includes(id)) return 'Already passed. Good to revise.'
  d.push(id)
  try { localStorage.setItem(key(), JSON.stringify(d)) } catch { /* private mode */ }
  const c = CLASSES.find((x) => x.id === id)!
  window.setTimeout(() => addReputation(REP, `Reputation: ${c.title} class`, 'Passed at the Etiquette House.'), 0)
  if (d.length >= CLASSES.length) window.setTimeout(() => addReputation(ALL_REP, 'Reputation: polished', 'Every class at the Etiquette House passed.'), 30)
  window.dispatchEvent(new CustomEvent('gd:society', { detail: d.length }))
  return d.length >= CLASSES.length ? `Passed. That is every class: you are Polished (+${REP + ALL_REP} reputation).` : `Passed: +${REP} reputation.`
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement; finish: (m: string) => void }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }

/** The Etiquette House: the list of classes, or one class in progress. Re-renders itself. */
export function societyNodes(h: H): HTMLElement[] {
  const root = el('div', 'soc')
  let at: Class | null = null
  let step = 0
  let wrong = ''
  const render = () => {
    root.replaceChildren()
    if (!at) {
      const d = done()
      root.append(h.para(`Seven short classes in manners, presence and a steady mind. ${d.length} of ${CLASSES.length} passed${polished() ? ': you are Polished.' : '.'}`))
      for (const c of CLASSES) {
        const b = h.button(`${d.includes(c.id) ? '✓ ' : ''}${c.title}`, d.includes(c.id) ? 'ghost' : 'primary', () => { at = c; step = 0; wrong = ''; render() })
        root.append(b)
      }
      root.append(h.para('Life skills, not Web3 courses: reputation, no certificate.', 'muted'))
      return
    }
    const c = at
    root.append(el('h4', 'soc-h', c.title))
    if (step < c.cards.length) {
      root.append(el('p', 'soc-count', `${step + 1} of ${c.cards.length}`), el('p', 'soc-card', c.cards[step]!))
      root.append(h.button(step === c.cards.length - 1 ? 'To the question' : 'Next', 'primary', () => { step += 1; render() }))
    } else {
      root.append(el('p', 'soc-card', c.ask))
      if (wrong) root.append(h.para(wrong, 'soc-wrong'))
      c.options.forEach((o, i) => root.append(h.button(o, 'ghost', () => {
        if (i === c.right) { const msg = pass(c.id); h.finish(`${c.why} ${msg}`); at = null; render() } else { wrong = 'Not quite. Think about how the other person feels, then try again.'; render() }
      })))
    }
    root.append(h.button('Back to the classes', 'ghost', () => { at = null; render() }))
  }
  render()
  return [root]
}
