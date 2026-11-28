// Soft lesson streak: consecutive days with at least one lesson passed, kept on this device (localStorage, not
// the save). A missed day quietly starts it again at the next pass: no guilt message, only a short welcome back.
const KEY = 'gd.lessonStreak'
type Rec = { last: string; n: number; hi?: string }
const day = (d = new Date()) => d.toLocaleDateString('en-CA')
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return day(d) }
const read = (): Rec | null => { try { const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Rec | null; return r && typeof r.last === 'string' && Number.isFinite(r.n) ? r : null } catch { return null } }
const write = (r: Rec) => { try { localStorage.setItem(KEY, JSON.stringify(r)) } catch { /* private mode */ } }

/** Days in a row with a lesson passed, counting today or yesterday as still alive; 0 once a day was missed. */
export function lessonStreak(): number {
  const r = read()
  if (!r) return 0
  return r.last === day() || r.last === yesterday() ? r.n : 0
}

/** Call when a lesson is passed. Returns the streak after today's pass. */
export function recordLessonDay(): number {
  const r = read(), t = day()
  if (r?.last === t) return r.n
  const n = r && r.last === yesterday() ? r.n + 1 : 1
  write({ last: t, n, hi: r?.hi })
  return n
}

/** A gentle line, once a day, for a player who had a streak and missed a day (or more). Null otherwise. */
let shownNow: string | null = null // stays up for this visit (the Learn screen repaints), not on later visits today
export function welcomeBack(): string | null {
  const r = read(), t = day()
  if (shownNow && r?.last !== t) return shownNow
  if (!r || r.last === t || r.last === yesterday() || r.hi === t) return null
  write({ ...r, hi: t })
  shownNow = 'Welcome back. One lesson today starts a fresh streak, whenever you are ready.'
  return shownNow
}
