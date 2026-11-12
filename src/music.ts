// Theme music: "Market Velocity", supplied by the game's owner. It starts with the first tap on the title screen
// (browsers allow sound only after a tap), keeps playing through the intro and into the city without a break
// (one audio element for the whole session), and fades in. On unless the player turned it off in Settings;
// remembers on/off and volume; pauses while the tab is hidden.
const PREF = 'gd.music', LEVEL = 'gd.music.volume'
const TRACK = '/assets/audio/market-velocity.mp3'
let audio: HTMLAudioElement | null = null
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* session only */ } }
let volume = Math.max(0, Math.min(100, Number(read(LEVEL) ?? '40') || 0))
export const musicOn = () => read(PREF) !== 'off'
export const musicVolume = () => volume
const level = () => (volume / 100) * 0.6
let fade = 0
function fadeIn(a: HTMLAudioElement): void {
  window.clearInterval(fade)
  a.volume = 0
  const target = level()
  fade = window.setInterval(() => { a.volume = Math.min(target, a.volume + target / 20); if (a.volume >= target) window.clearInterval(fade) }, 60)
}
function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(TRACK)
    audio.loop = true
    audio.preload = 'auto'
    document.addEventListener('visibilitychange', () => { if (document.hidden) audio?.pause(); else if (musicOn()) void audio?.play().catch(() => {}) })
  }
  return audio
}
const start = () => { const a = el(); if (!a.paused) return; fadeIn(a); void a.play().catch(() => {}) }
export function setMusicVolume(v: number): void { volume = Math.max(0, Math.min(100, v)); write(LEVEL, String(volume)); window.clearInterval(fade); if (audio) audio.volume = level(); void import('./ambient-audio.ts').then((a) => a.syncAmbientToMusic()).catch(() => {}) }
/** Lower the theme while someone speaks, and bring it back after. */
export function duckMusic(on: boolean): void { if (!audio || audio.paused) return; window.clearInterval(fade); audio.volume = on ? level() * 0.3 : level() }
/** Call only from a tap handler. Returns false if the browser refused playback. */
export async function setMusic(on: boolean): Promise<boolean> {
  write(PREF, on ? 'on' : 'off')
  if (!on) { audio?.pause(); void import('./ambient-audio.ts').then((a) => a.syncAmbientToMusic()).catch(() => {}); return true }
  try { const a = el(); a.volume = level(); await a.play(); void import('./ambient-audio.ts').then((m) => m.syncAmbientToMusic()).catch(() => {}); return true } catch { write(PREF, 'off'); return false }
}
let armed = false
/** Start on the first tap or key of the session (title screen or city); nothing plays before a gesture. */
export function resumeMusicOnFirstTap(): void {
  if (armed || !musicOn()) return
  armed = true
  const go = () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); if (musicOn()) start() }
  window.addEventListener('pointerdown', go, { passive: true })
  window.addEventListener('keydown', go)
}
