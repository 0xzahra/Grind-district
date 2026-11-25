// Cash alert: a short "ka-ching" whenever money comes in (course and job pay, cash back, check-in, top-up).
// Made with Web Audio on the spot, nothing to download: the register's "ka" (a bright click and a low drawer
// thunk) then the bell's "ching" (bright partials with a slow shimmer and a softer second strike). It follows
// the game's Sound level; there is no separate switch.
import { getSave, subscribe } from './state.ts'

type Ctx = typeof AudioContext
let ctx: AudioContext | null = null
let last = 0
function audio(): AudioContext | null {
  if (!ctx) {
    const C = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctx }).webkitAudioContext) as Ctx | undefined
    if (!C) return null
    try { ctx = new C() } catch { return null }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

function bell(a: AudioContext, out: AudioNode, at: number, level: number): void {
  // A small brass bell: the fundamental, a detuned twin for shimmer, and two bright overtones.
  const parts: Array<[number, number, number]> = [[2093, 0.3, 0.95], [2101, 0.16, 0.9], [4856, 0.12, 0.55], [6280, 0.05, 0.32]]
  for (const [f, g, dur] of parts) {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f
    const og = a.createGain()
    og.gain.setValueAtTime(0.0001, at)
    og.gain.exponentialRampToValueAtTime(g * level, at + 0.005)
    og.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(og).connect(out); o.start(at); o.stop(at + dur + 0.05)
  }
}

export function kaching(): void {
  const vol = Math.max(0, Math.min(100, getSave().volume ?? 70)) / 100
  if (vol <= 0) return
  const now = performance.now()
  if (now - last < 700) return
  const a = audio()
  if (!a || a.state !== 'running') return // still locked until the first tap: stay quiet rather than queue
  last = now
  const t = a.currentTime + 0.01
  const out = a.createGain(); out.gain.value = 0.5 * vol; out.connect(a.destination)
  // "ka": a short burst of noise through a band-pass (the key), and a falling low thunk (the drawer).
  const len = Math.floor(a.sampleRate * 0.045)
  const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const ns = a.createBufferSource(); ns.buffer = buf
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2
  const ng = a.createGain(); ng.gain.value = 0.9
  ns.connect(bp).connect(ng).connect(out); ns.start(t)
  const th = a.createOscillator(); th.type = 'triangle'
  th.frequency.setValueAtTime(190, t); th.frequency.exponentialRampToValueAtTime(70, t + 0.09)
  const tg = a.createGain(); tg.gain.setValueAtTime(0.55, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.11)
  th.connect(tg).connect(out); th.start(t); th.stop(t + 0.13)
  // "ching": the bell, then its softer second strike.
  bell(a, out, t + 0.085, 1)
  bell(a, out, t + 0.2, 0.45)
  window.setTimeout(() => { try { out.disconnect() } catch { /* already gone */ } }, 1600)
}

/** Ka-ching on every rise in the in-game balance of a dollar or more (not when another account's save loads). */
export function startCashAlert(): void {
  let save = getSave()
  let prev = save.ledger
  subscribe(() => {
    const s = getSave()
    if (s !== save) { save = s; prev = s.ledger; return }
    if (s.ledger - prev >= 1) kaching()
    prev = s.ledger
  })
  // Browsers only start sound after a tap or key: open the audio on the first one.
  const unlock = () => { audio(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/**
 * Kitchen sounds for the McGrind shift, made on the spot like the ka-ching: a sizzle (patty down, a flip), the
 * fryer's roar when the basket drops, the knife's chop and the counter bell when a tray goes out. Quiet, short, and
 * silent until the first tap opens the audio.
 */
export function kitchenSound(kind: 'sizzle' | 'fry' | 'chop' | 'bell'): void {
  const vol = Math.max(0, Math.min(100, getSave().volume ?? 70)) / 100
  if (vol <= 0) return
  const a = audio()
  if (!a || a.state !== 'running') return
  const t = a.currentTime + 0.005
  const out = a.createGain(); out.gain.value = 0.3 * vol; out.connect(a.destination)
  const done = (ms: number) => window.setTimeout(() => { try { out.disconnect() } catch { /* already gone */ } }, ms)
  if (kind === 'bell') { bell(a, out, t, 0.55); done(1300); return }
  const dur = kind === 'fry' ? 1.2 : kind === 'sizzle' ? 0.65 : 0.07
  const len = Math.floor(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (kind !== 'chop' && Math.random() < 0.02 ? 2.6 : 1)
  const ns = a.createBufferSource(); ns.buffer = buf
  const f = a.createBiquadFilter()
  if (kind === 'chop') { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 1.6 } else { f.type = 'highpass'; f.frequency.value = kind === 'fry' ? 1800 : 2600 }
  const env = a.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(kind === 'chop' ? 0.9 : kind === 'fry' ? 0.7 : 0.5, t + (kind === 'chop' ? 0.004 : 0.03))
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  ns.connect(f).connect(env).connect(out); ns.start(t); ns.stop(t + dur + 0.02)
  done(dur * 1000 + 400)
}
