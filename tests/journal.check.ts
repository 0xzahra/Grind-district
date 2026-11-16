// Daily journal (src/journal.ts): today's lines by part of the day, money left out, repeats folded, a post that fits.
import { journalLines, journalCloser, journalPost } from '../src/journal.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const day = new Date(2026, 10, 16, 0, 0, 0, 0).getTime()
const at = (h: number, m = 0) => day + (h * 60 + m) * 60_000
const acts = [
  { at: at(21, 5), kind: 'social', label: 'Sat in the masjid' },
  { at: at(14, 30), kind: 'trade', label: 'Bought BTC' },
  { at: at(14, 10), kind: 'trade', label: 'Bought BTC' },
  { at: at(13, 0), kind: 'money', label: 'Top-up credited', detail: '$25.00' },
  { at: at(9, 15), kind: 'skill', label: 'Passed What the internet is' },
  { at: at(8, 0), kind: 'money', label: 'Bought a gold chain', detail: '-$40' },
  { at: at(2, 0), kind: 'gig', label: 'Posted a bounty' },
  { at: day - 3_600_000, kind: 'skill', label: 'Passed Spot trading' },
]
const lines = journalLines(acts, at(23, 0))
check(lines.length === 4, `four lines today (got ${lines.length})`)
check(lines[0]!.text === 'Posted a bounty', 'oldest first')
check(lines[1]!.text === 'Passed What the internet is at Campus', 'a pass reads as Campus')
check(lines[2]!.text === 'Bought BTC on the practice desk ×2', 'repeats fold into ×n')
check(lines[3]!.text === 'Sat in the masjid', 'the last thing of the day comes last')
check(!lines.some((l) => 'part' in l), 'one list for the day: no morning, afternoon or evening')
check(!lines.some((l) => /top-up|gold chain|\$/i.test(l.text)), 'no money, balance or amounts')
check(!lines.some((l) => /Spot trading/.test(l.text)), 'yesterday is left out')
check(journalCloser(lines) === 'Proof over vibes: another course on the CV.', 'a pass gets the proof closer')
check(journalCloser([]) === 'A quiet day in the district. Tomorrow: Campus.', 'an empty day points to Campus')
const post = journalPost(lines, 'https://www.grinddistrict.app/?src=invite&ref=zara')
check(post.replace(/https:\/\/\S+/, 'x'.repeat(23)).length <= 280, 'the post fits one post on X')
check(post.includes('• Passed What the internet is at Campus') && !/Morning|Afternoon|Evening/.test(post) && post.endsWith('ref=zara'), 'the post lists the day and ends with the invite link')
console.log(fail ? `journal: ${pass} passed, ${fail} failed` : `ok - journal: ${pass} checks`)
if (fail) process.exit(1)
