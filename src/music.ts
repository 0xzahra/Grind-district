// Opt-in theme music (the track the game shipped before 31 Oct). Silent until the player taps Music on.
// Starts only from a user tap (autoplay rules); remembers on/off and volume; pauses when the tab is hidden.
const PREF = 'gd.music', LEVEL = 'gd.music.volume'
let audio: HTMLAudioElement | null = null
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* session only */ } }
let volume = Math.max(0, Math.min(100, Number(read(LEVEL) ?? '40') || 0))
export const musicOn = () => read(PREF) === 'on'
export const musicVolume = () => volume
function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/assets/audio/theme.mp3')
    audio.loop = true
    audio.preload = 'none'
    document.addEventListener('visibilitychange', () => { if (document.hidden) audio?.pause(); else if (musicOn()) void audio?.play().catch(() => {}) })
  }
  audio.volume = (volume / 100) * 0.6
  return audio
}
export function setMusicVolume(v: number): void { volume = Math.max(0, Math.min(100, v)); write(LEVEL, String(volume)); if (audio) audio.volume = (volume / 100) * 0.6; void import('./ambient-audio.ts').then((a) => a.syncAmbientToMusic()).catch(() => {}) }
/** Call only from a tap handler. Returns false if the browser refused playback. */
export async function setMusic(on: boolean): Promise<boolean> {
  write(PREF, on ? 'on' : 'off')
  if (!on) { audio?.pause(); void import('./ambient-audio.ts').then((a) => a.syncAmbientToMusic()).catch(() => {}); return true }
  try { await el().play(); void import('./ambient-audio.ts').then((a) => a.syncAmbientToMusic()).catch(() => {}); return true } catch { write(PREF, 'off'); return false }
}
/** Resume on the first tap of a session if the player left music on (never before a gesture). */
export function resumeMusicOnFirstTap(): void {
  if (!musicOn()) return
  const go = () => { void el().play().catch(() => {}) }
  window.addEventListener('pointerdown', go, { once: true })
}
