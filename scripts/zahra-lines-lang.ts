// Prints Zahra's welcome tour and greeting in one language (as shown on screen) for scripts/gen-zahra-voice.py.
import { TOUR, LINES } from '../src/mentorLines.ts'
import { tableFor } from '../src/i18n.ts'
const lang = process.argv[2] ?? 'es'
const table = tableFor(lang)
const lines = [...TOUR.map((t) => t.say), LINES.hello].map((en) => table[en]).filter((x): x is string => !!x)
console.log(JSON.stringify(lines, null, 1))
