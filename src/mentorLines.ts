// Zahra's words, kept apart from the card logic so the recorded voice clips (scripts/gen-zahra-voice.py) can be
// made from exactly these strings. Change a line here and regenerate its clip; until then it falls back to the
// device's own voice. No DOM or save access in this file.
import type { SkillId } from './logic.ts'

/** Hand-written first-lesson cards. Other courses fall back to bite-size chunks of their paragraphs. */
export const FIRST_CARDS: Partial<Record<SkillId, string[]>> = {
  internet: [
    "Hi, I'm Zahra. Welcome to World 1: The Internet. Your first mission takes a minute, right here.",
    'The internet is computers talking to computers. Your phone is one. Servers stay on and answer requests.',
    'Open a page and your phone asks a server for it. The answer comes back in small packets.',
    'Nobody owns the whole internet. It works because everyone follows the same rules, called protocols.',
    'Two quick checks and this mission goes on your CV.',
  ],
  spot: [
    "Hi, I'm Zahra. Everyone in this city starts at zero. Let's do your first lesson right here. It takes a minute.",
    'A spot trade buys the real thing, right now. Buy a coin on the spot desk and you hold that coin.',
    'Buyers bid. Sellers ask. The gap between the best bid and the best ask is the spread.',
    'Crossing the spread costs you before any fee. A wide spread usually means few people are trading.',
    'Two quick questions and this lesson goes on your CV.',
  ],
}

export const PLACEMENT = [
  { prompt: 'Someone asks for your seed phrase to "verify" your wallet. What can they do with it?', choices: ['Nothing, it is just a backup word list', 'Take everything in the wallet', 'Only see your balance'], answer: 1 },
  { prompt: 'You add two tokens to a liquidity pool and one price doubles. What usually happens?', choices: ['You end up with less of the token that went up (impermanent loss)', 'The pool pays you double', 'Nothing changes in the pool'], answer: 0 },
  { prompt: 'In most DAOs, what decides a vote?', choices: ['The founder alone', 'Governance tokens or membership held by voters', 'Whoever posts first'], answer: 1 },
]

/** Split lesson paragraphs into cards of at most two sentences (sources are dropped from the cards). */
export function biteCards(paragraphs: string[]): string[] {
  const out: string[] = []
  for (const p of paragraphs) {
    if (/^Sources?:/i.test(p.trim())) continue
    // A dot inside a word (revoke.cash, x.com, 0.5) is not the end of a sentence: hide it while splitting.
    const DOT = '\u0007'
    const kept = p.replace(/(\w)\.(?=\w)/g, `$1${DOT}`)
    const sentences = (kept.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [kept]).map((s) => s.split(DOT).join('.'))
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

/** Welcome tour: Web3 in two lines, then how to play. `spot` is the control that glows while she says it. */
export const TOUR: Array<{ say: string; spot?: string }> = [
  { say: 'Welcome to Grind District! I\u2019m Zahra. One minute, and I\u2019ll show you the one thing to do first.' },
  { say: 'Here you learn Web3 by doing it. Pass a short lesson at Campus and it goes on your CV with a certificate you keep. Practice money only: nothing real is at risk.' },
  { say: 'Move with the joystick, or W A S D on a computer. Drag to look around, pinch or scroll to zoom, or tap the ground to walk there.', spot: '#stick' },
  { say: 'Your next step always waits in this gold Next step button. Tap it and it takes you straight there.', spot: '#goal' },
  { say: 'Step one is Campus, just north of the plaza. I\u2019ll ask three quick questions, then teach your first lesson. It takes about a minute.' },
  { say: 'Pass it, and the course appears on your CV with a certificate. Open them any time from Profile in the menu. Minting the certificate on NEAR is optional.', spot: '#rail-toggle' },
  { say: 'The rest of the city, from jobs and trading to shops and the park, is there whenever you want it. One rule: never share your seed phrase. Ready?' },
]

/** Lines Zahra says outside the lessons. */
export const LINES = {
  hello: 'Hi, I\u2019m Zahra, your guide here at Campus. I help everyone find their feet in Web3. Want a quick tour, or shall we start your next lesson?',
  helloDone: 'Hi again! You\u2019ve done every lesson I teach out here. Campus has the rest, and Career has your next move. Want the tour again?',
  intro: "Hi, I'm Zahra. Are you new to crypto (a Normie) or already a Homie? Three quick questions and I'll start you at the right lesson.",
  homie: 'Homie. Nice. Everyone in this city still starts at World 1, so it should go fast for you.',
  homieDone: 'Homie. Every mission is already on your CV.',
  pass: 'Nice. That\u2019s on your CV with a certificate. Finish World 1\u2019s three missions to complete it.',
}
export const FIXED_LINES: string[] = Object.values(LINES)
