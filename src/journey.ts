// First-session journey: where do new players stop? One small `step` event per milestone of the first session
// (entered the city, opened the menu, found Campus, started the first lesson, reached the quick check, passed,
// saw the CV), each carrying how long the player spent on the step before it. Leaving the page records the last
// step and the session length. Every session also says whether it is a return on a later day, so the stats page
// can show Day 1 / Day 7 / Day 30 retention. Counts only: a random visitor id, never a name, email or wallet.
import { track, flushTracking } from './track.ts'

export type Step =
  | 'auth_open' | 'signed_in' | 'enter_city' | 'menu_open' | 'learn_open' | 'lesson_start' | 'exercise_start'
  | 'lesson_leave' | 'lesson_resume' | 'lesson_complete' | 'cv_seen'

const FIRST_SEEN = 'gd.firstSeen'
const FIRST_TAB = 'gd.firstSession'
const RETURN_DAY = 'gd.returnDay'
const DAY = 86_400_000
// Lagos time (UTC+1), the same day boundary the city stats use.
const dayOf = (ms: number) => Math.floor((ms + 3_600_000) / DAY)

let first = false
let last: { step: string; at: number } = { step: 'title', at: Date.now() }
const done = new Set<string>()
let started = 0
let visibleMs = 0
let visibleSince = 0
let ended = false

/** Call once, before tracking starts (it reads the new-browser flag that the first paint left). */
export function startJourney(): void {
  started = Date.now()
  visibleSince = document.hidden ? 0 : started
  try {
    const fresh = localStorage.getItem('gd.fresh') === '1'
    let seen = Number(localStorage.getItem(FIRST_SEEN) ?? '')
    if (!Number.isFinite(seen) || seen <= 0) {
      // A brand-new browser starts its first session now. A browser that played before this update has no date:
      // it is not a first session, and today stands in as its first day (only later returns count from here).
      seen = started
      localStorage.setItem(FIRST_SEEN, String(seen))
      if (fresh) sessionStorage.setItem(FIRST_TAB, '1')
    }
    // A reload inside the first session (same tab) is still the first session.
    first = sessionStorage.getItem(FIRST_TAB) === '1'
    const days = dayOf(started) - dayOf(seen)
    if (days >= 1 && localStorage.getItem(RETURN_DAY) !== String(dayOf(started))) {
      localStorage.setItem(RETURN_DAY, String(dayOf(started)))
      track('return_session', { day: days })
    }
  } catch { /* private mode: no journey */ }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); end() } else { visibleSince = Date.now(); ended = false }
  })
  window.addEventListener('pagehide', () => { pause(); end() })
  // Signing up or in happens before the city opens; the login code announces it with this event.
  window.addEventListener('gd-auth-changed', () => step('signed_in'))
}

const pause = () => { if (visibleSince) { visibleMs += Date.now() - visibleSince; visibleSince = 0 } }

/** The page went away (closed, switched app, locked): record the session length and the step the player left on. */
function end(): void {
  if (ended || !started) return
  ended = true
  const secs = Math.round(visibleMs / 1000)
  if (secs < 1) return
  track('session_length', { secs, last: last.step, ms: Date.now() - last.at, first })
  void flushTracking()
}

/** Mark a milestone. Only the first session is followed, and each step counts once (except leave and resume). */
export function step(s: Step, props: Record<string, string | number | boolean> = {}): void {
  if (!first) return
  const repeat = s === 'lesson_leave' || s === 'lesson_resume'
  if (!repeat && done.has(s)) return
  done.add(s)
  const now = Date.now()
  track('step', { step: s, prev: last.step, ms: now - last.at, first: true, ...props })
  last = { step: s, at: now }
}

/** True while this tab is the player's first session (for tests and the stats self-check). */
export const firstSession = () => first
