// Title-screen loop, generated in code (no file to download, no licence needed): 124 BPM four-on-the-floor
// kick, offbeat hats, a bouncy bass and a bright major chord stab. Starts on the first interaction, fades out on Enter.
import { sharedContext } from './sfx.ts'

const PREF = 'gd.titleMusic.v1' // 'on' | 'off'
const BPM = 124
let gain: GainNode | null = null
let timer = 0
let playing = false
let nextBeat = 0
let beat = 0

export const titleMusicWanted = () => localStorage.getItem(PREF) !== 'off'

function kick(c: AudioContext, out: AudioNode, t: number) {
  const o = c.createOscillator(); const g = c.createGain()
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
  g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.25)
}
function hat(c: AudioContext, out: AudioNode, t: number, noise: AudioBuffer) {
  const s = c.createBufferSource(); s.buffer = noise
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000
  const g = c.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + 0.06)
}
function tone(c: AudioContext, out: AudioNode, t: number, freq: number, dur: number, vol: number, type: OscillatorType) {
  const o = c.createOscillator(); const g = c.createGain(); const f = c.createBiquadFilter()
  o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = 2400
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02)
}
const BASS = [55, 55, 82.4, 55, 65.4, 65.4, 98, 73.4] // A1 A1 E2 A1 C2 C2 G2 D2 (eighths)
const CHORDS = [[440, 554.4, 659.3], [392, 493.9, 587.3], [349.2, 440, 523.3], [392, 493.9, 587.3]] // A, G, F, G

function schedule() {
  const c = sharedContext()
  if (!c || !gain) return
  const noise = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate)
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const eighth = 60 / BPM / 2
  while (nextBeat < c.currentTime + 0.3) {
    const t = nextBeat
    const step = beat % 32
    if (step % 2 === 0) kick(c, gain, t)
    else hat(c, gain, t, noise)
    tone(c, gain, t, BASS[step % 8]! * (step >= 16 ? 1 : 1), eighth * 0.9, 0.35, 'sawtooth')
    if (step % 4 === 2) for (const f of CHORDS[Math.floor(step / 8) % 4]!) tone(c, gain, t, f, eighth * 1.6, 0.06, 'square')
    nextBeat += eighth
    beat += 1
  }
}

export function startTitleMusic(): void {
  if (playing || !titleMusicWanted()) return
  const c = sharedContext()
  if (!c) return
  gain = c.createGain(); gain.gain.value = 0.0001; gain.connect(c.destination)
  gain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 1.2)
  nextBeat = c.currentTime + 0.05; beat = 0; playing = true
  timer = window.setInterval(schedule, 100)
  schedule()
}
export function stopTitleMusic(fade = 0.8): void {
  if (!playing) return
  playing = false
  const c = sharedContext(); const g = gain
  window.clearInterval(timer)
  if (c && g) { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0.0001, c.currentTime, fade / 4); setTimeout(() => g.disconnect(), fade * 1000 + 300) }
  gain = null
}
export const titleMusicPlaying = () => playing

/** Glass play/pause + mute next to the profile button. Choice is saved. */
export function mountTitleMusic(menu: HTMLElement): () => void {
  const wrap = document.createElement('div'); wrap.className = 'title-music'
  const play = document.createElement('button'); play.type = 'button'
  const mute = document.createElement('button'); mute.type = 'button'
  const paint = () => {
    play.textContent = playing ? '❚❚' : '▶'
    play.setAttribute('aria-label', playing ? 'Pause music' : 'Play music')
    mute.textContent = titleMusicWanted() ? '♪' : '♪̸'
    mute.setAttribute('aria-label', titleMusicWanted() ? 'Mute music' : 'Unmute music')
    mute.classList.toggle('off', !titleMusicWanted())
  }
  play.onclick = (e) => { e.stopPropagation(); if (playing) stopTitleMusic(0.3); else { localStorage.setItem(PREF, 'on'); startTitleMusic() } paint() }
  mute.onclick = (e) => { e.stopPropagation(); const on = !titleMusicWanted(); localStorage.setItem(PREF, on ? 'on' : 'off'); if (on) startTitleMusic(); else stopTitleMusic(0.3); paint() }
  wrap.append(play, mute); menu.append(wrap); paint()
  const first = () => { if (!menu.hidden) { startTitleMusic(); paint() } }
  window.addEventListener('pointerdown', first, { once: true })
  window.addEventListener('keydown', first, { once: true })
  return () => { stopTitleMusic(); wrap.remove() }
}
