// Prayer in the Grand Masjid: one rakʿah, led by the imam or prayed on your own. The player's own body goes
// through the positions (standing, bowing, prostrating, sitting, seating.ts), and a caption shows what is said.
// The men's rows hear the imam directly; the women's section, behind its screen, hears him through the speakers,
// so sisters can follow the same congregation from their side, or pray on their own.
// Nothing here is spoken aloud: the imam's words are shown, not synthesised.
import type { Seat, PrayerPose } from './seating.ts'
import { timesFor, prayerLabel, PRAYER_KEYS } from './prayer.ts'

export type PrayMode = 'men' | 'women' | 'alone'
type Step = { pose: PrayerPose; ms: number; led: string; own: string }

const STEPS: Step[] = [
  { pose: 'qiyam', ms: 3200, led: 'Allāhu akbar', own: 'Allāhu akbar' },
  { pose: 'qiyam', ms: 5200, led: 'The imam recites al-Fātiḥah and a short sūrah', own: 'Al-Fātiḥah and a short sūrah, quietly' },
  { pose: 'ruku', ms: 3600, led: 'Allāhu akbar', own: 'Subḥāna rabbiyal-ʿaẓīm' },
  { pose: 'qiyam', ms: 2800, led: 'Samiʿa Allāhu liman ḥamidah', own: 'Samiʿa Allāhu liman ḥamidah' },
  { pose: 'sujud', ms: 3600, led: 'Allāhu akbar', own: 'Subḥāna rabbiyal-aʿlā' },
  { pose: 'jalsa', ms: 2400, led: 'Allāhu akbar', own: 'Rabbighfir lī' },
  { pose: 'sujud', ms: 3400, led: 'Allāhu akbar', own: 'Subḥāna rabbiyal-aʿlā' },
  { pose: 'jalsa', ms: 4600, led: 'Allāhu akbar · the tashahhud', own: 'The tashahhud' },
  { pose: 'jalsa', ms: 3200, led: 'As-salāmu ʿalaykum wa raḥmatullāh', own: 'As-salāmu ʿalaykum wa raḥmatullāh' },
]

/** The prayer whose time it is now (after Isha until Fajr it is still Isha). */
export function currentPrayer(now = new Date()): string {
  try {
    const t = timesFor(now)
    let cur = PRAYER_KEYS[PRAYER_KEYS.length - 1]!
    for (const k of PRAYER_KEYS) if (t[k].getTime() <= now.getTime()) cur = k
    return prayerLabel(cur, now)
  } catch { return 'the prayer' }
}

let token = 0
let cap: HTMLElement | null = null
const caption = (who: string, line: string, speaker: boolean) => {
  if (!cap) {
    cap = document.createElement('div'); cap.className = 'salah-cap'; cap.setAttribute('role', 'status'); cap.setAttribute('aria-live', 'polite')
    document.body.append(cap)
  }
  cap.replaceChildren()
  const w = document.createElement('small'); w.textContent = `${speaker ? '🔊 ' : ''}${who}`
  const l = document.createElement('b'); l.textContent = line
  cap.append(w, l)
  cap.classList.add('on')
}
const hideCaption = () => { cap?.classList.remove('on') }

/**
 * Pray from `seat` (the player is seated onto it in the standing position). `here` says whether the player is still
 * on the seat (any move stands up and ends the prayer). `done` runs once the salām is given.
 */
export function pray(o: { seat: Seat; mode: PrayMode; sit: (s: Seat) => void; here: () => boolean; done: (prayer: string) => void }): void {
  const my = ++token
  const seat: Seat = { ...o.seat, pose: 'qiyam' }
  o.sit(seat)
  const name = currentPrayer()
  const who = o.mode === 'alone' ? `Praying ${name} on your own` : o.mode === 'women' ? `Imam, on the speaker · ${name} in congregation` : `Imam · ${name} in congregation`
  let i = 0
  const step = () => {
    if (my !== token) return
    if (i > 0 && !o.here()) { hideCaption(); return }
    const s = STEPS[i]
    if (!s) {
      window.setTimeout(() => { if (my === token) hideCaption() }, 1600)
      o.done(name)
      return
    }
    seat.pose = s.pose
    caption(who, o.mode === 'alone' ? s.own : s.led, o.mode === 'women')
    i++
    window.setTimeout(step, s.ms)
  }
  // A moment to settle into the row before the first takbīr.
  window.setTimeout(step, 600)
}

/** Stop a prayer in progress (leaving the masjid). */
export function stopPrayer(): void { token++; hideCaption() }
