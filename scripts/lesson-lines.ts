// Prints every lesson card the Campus lesson screen shows (and reads aloud), for scripts/gen-zahra-voice.py.
import { COURSES } from '../src/courses.ts'
import { biteCards } from '../src/mentorLines.ts'
const out = new Set<string>()
for (const c of COURSES) for (const card of biteCards(c.paragraphs)) out.add(card)
console.log(JSON.stringify([...out], null, 1))
