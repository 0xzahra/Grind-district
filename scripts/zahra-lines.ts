// Prints every line Zahra says on her card that has a recorded clip (scripts/gen-zahra-voice.py reads it).
// Tour, greeting, placement, the hand-written first lessons and the World 1 / World 2 lessons she teaches.
import { COURSES } from '../src/courses.ts'
import { FIRST_CARDS, PLACEMENT, TOUR, FIXED_LINES, biteCards } from '../src/mentorLines.ts'
const out = new Set<string>()
for (const t of TOUR) out.add(t.say)
for (const l of FIXED_LINES) out.add(l)
for (const p of PLACEMENT) out.add(p.prompt)
for (const cards of Object.values(FIRST_CARDS)) for (const c of cards ?? []) out.add(c)
// World 1 and World 2 missions (worlds.ts reads the save, so the ids are listed here).
const taught = ['internet', 'money', 'webEras', 'redFlags', 'p2pSharks', 'scams'] as const
for (const id of taught) {
  const c = COURSES.find((x) => x.id === id); if (!c) continue
  for (const card of FIRST_CARDS[id] ?? biteCards(c.paragraphs).slice(0, 4)) out.add(card)
  for (const q of c.questions.slice(0, 2)) out.add(q.prompt)
}
console.log(JSON.stringify([...out], null, 1))
