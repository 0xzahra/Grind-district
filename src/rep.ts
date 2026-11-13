// Reputation is the one score players see (no XP or points anywhere on screen). Ranks still climb underneath
// as before; what a player is shown, and rewarded with, is reputation. This adds reputation for the things that
// used to show XP: passing a course, a gym set and sitting through a campus talk (events and job duties already
// give reputation in state.ts and career.ts).
import { onActivity, addReputation } from './state.ts'

export const REP = { course: 5, gym: 2, talk: 3, inspired: 3, freeStep: 5, passBoost: 50 } as const

export function startReputation(): void {
  onActivity((kind, label) => {
    if (label.startsWith('Reputation:')) return
    if (kind === 'skill' && label.startsWith('Passed ')) addLater(REP.course, 'Reputation: course passed', `${label.slice(7)} filed to your CV.`)
    else if (label.startsWith('Gym ')) addLater(REP.gym, 'Reputation: gym set', 'You showed up and trained.')
    else if (label === 'Sat through the campus talk') addLater(REP.talk, 'Reputation: campus talk', 'You stayed for the whole talk.')
  })
}
// After the activity that earned it has finished logging.
const addLater = (n: number, label: string, detail: string) => window.setTimeout(() => addReputation(n, label, detail), 0)
