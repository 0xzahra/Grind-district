// City sound: one shared AudioContext, created only after a user gesture. Everything is synthesised
// (no sample files, so no licence to track and zero download). Silent by default (GDD §12): muted until turned on.
import { getSave } from './state.ts'

const MUTE = 'gd.audio.muted.v1'
let ctx: AudioContext | null = null
let master: GainNode | null = null
let ambience: { stop: () => void } | null = null
let noiseBuf: AudioBuffer | null = null

export const isMuted = () => localStorage.getItem(MUTE) !== '0'
export function setMuted(m: boolean): void {
  localStorage.setItem(MUTE, m ? '1' : '0')
  if (!m) ensure()
  applyVolume()
  if (m) { ambience?.stop(); ambience = null } else startAmbience()
}
export function applyVolume(): void {
  if (master && ctx) master.gain.setTargetAtTime(isMuted() ? 0 : getSave().volume / 100, ctx.currentTime, 0.05)
}
function ensure(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    let last = 0
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 } // brown noise
    applyVolume()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}
function burst(freq: number, q: number, dur: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
  if (isMuted() || !ensure() || !ctx || !master || !noiseBuf) return
  const src = ctx.createBufferSource(); src.buffer = noiseBuf
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q
  const g = ctx.createGain(); const t = ctx.currentTime
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.02)
}
export const click = () => burst(2400, 4, 0.04, 0.25)
export const step = () => burst(500 + Math.random() * 200, 1.2, 0.09, 0.35)
export const door = () => { burst(180, 2, 0.35, 0.6, 'lowpass'); setTimeout(() => burst(900, 6, 0.08, 0.3), 260) }

function startAmbience(): void {
  if (ambience || isMuted() || !ensure() || !ctx || !master || !noiseBuf) return
  const c = ctx
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380
  const g = c.createGain(); g.gain.value = 0.12 // distant traffic + crowd rumble
  src.connect(lp).connect(g).connect(master!); src.start()
  const chirp = () => {
    if (isMuted()) return
    const o = c.createOscillator(); const og = c.createGain(); const t = c.currentTime
    o.type = 'sine'; o.frequency.setValueAtTime(2800 + Math.random() * 1400, t); o.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 900, t + 0.12)
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.03, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    o.connect(og).connect(master!); o.start(t); o.stop(t + 0.16)
  }
  const timer = window.setInterval(() => { if (Math.random() < 0.35) { chirp(); setTimeout(chirp, 160) } }, 2500)
  ambience = { stop: () => { clearInterval(timer); src.stop() } }
}

/** Call once at boot: unlocks lazily on the first gesture, adds UI clicks. */
export function mountSfx(): void {
  const unlock = () => { if (!isMuted()) { ensure(); startAmbience() } }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
  document.addEventListener('click', (e) => { if ((e.target as HTMLElement | null)?.closest('button')) click() }, true)
}
