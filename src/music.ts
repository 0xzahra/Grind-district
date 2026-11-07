import { getSave } from './state.ts'
export const THEME = '/audio/market_velocity.mp3'
const PREF = 'grind-district-music'
export function musicWanted(): boolean { try { return localStorage.getItem(PREF) === 'on' } catch { return false } }
function remember(on: boolean): void { try { localStorage.setItem(PREF, on ? 'on' : 'off') } catch { /* session remains usable */ } }

/** Existing supplied theme; play() is invoked synchronously in the user's gesture.
 * Restored preference offers Resume, never promises autoplay. Ambient is independent. */
export function bindMusic(button: HTMLButtonElement, slider: HTMLInputElement, note: HTMLParagraphElement): void {
  const audio = new Audio()
  audio.src = THEME
  audio.loop = true
  audio.preload = 'metadata'
  let playing = false, pending = false, desired = musicWanted(), started = false, generation = 0
  const level = () => Math.max(0, Math.min(100, Number(slider.value) || 0)) / 100 * 0.8
  const paint = () => {
    button.textContent = pending ? 'Starting theme…' : playing ? 'Pause theme' : desired ? 'Resume theme' : 'Play theme'
    button.setAttribute('aria-pressed', String(playing))
    slider.disabled = false // Volume/mute can be chosen before playback.
    audio.volume = level()
  }
  const fail = (error: unknown) => {
    playing = pending = false
    audio.pause()
    note.textContent = error instanceof Error && error.name === 'NotAllowedError'
      ? 'Playback needs a fresh tap on Play/Resume theme.'
      : 'Theme could not play. Check your connection, device sound and audio support; tap to retry.'
    paint()
  }
  const start = () => {
    const attempt = ++generation
    desired = true; pending = true; remember(true); paint()
    // NO fetch/HEAD/await before play: those lose transient mobile user activation.
    try {
      const result = audio.play()
      void Promise.resolve(result).then(() => {
        if (attempt !== generation) return
        if (!desired || document.hidden) { audio.pause(); return }
        pending = false; playing = started = true; note.textContent = ''; paint()
      }, error => { if (attempt === generation) fail(error) })
    } catch (error) { if (attempt === generation) fail(error) }
  }
  button.addEventListener('click', () => {
    if (playing || pending) {
      ++generation; desired = playing = pending = false; remember(false)
      audio.pause(); note.textContent = ''; paint()
    } else start()
  })
  slider.value = String(getSave().volume)
  slider.addEventListener('input', paint)
  audio.addEventListener('error', () => { ++generation; fail(new Error('Media failed')) })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ++generation; playing = pending = false; audio.pause(); paint() }
    else if (desired && started) start()
  })
  if (desired) note.textContent = 'Tap Resume theme to enable sound on this device.'
  paint()
}
