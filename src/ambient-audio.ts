// Layered city / indoor ambient — procedural Web Audio only (no asset downloads).
// Outside: soft wind, passing traffic, horns, footsteps, faint voices.
// Inside: quiet room tone, floor footsteps, occasional kitchen clinks. Street muted.
const PREF = 'grind-district-ambient', LEVEL = 'grind-district-ambient-volume'

let context: AudioContext | null = null
let master: GainNode | null = null
let outBus: GainNode | null = null
let inBus: GainNode | null = null
let windG: GainNode | null = null
let trafficG: GainNode | null = null
let passG: GainNode | null = null
let voiceG: GainNode | null = null
let hornG: GainNode | null = null
let stepOutG: GainNode | null = null
let roomG: GainNode | null = null
let stepInG: GainNode | null = null
let kitchenG: GainNode | null = null

let active = false, bound = false, generation = 0
let message = 'Tap City sound in Settings to hear the street.'
let timers: number[] = []
let indoors = false
let plazaNear = 1
let crossGen = 0

function read(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function write(key: string, value: string): void { try { localStorage.setItem(key, value) } catch { /* */ } }

let wanted = read(PREF) !== 'off'
const storedVolume = Number(read(LEVEL) ?? '55')
let volume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(100, storedVolume)) : 55

export function ambientState() { return { wanted, active, volume, message, indoors } }

function clearTimers(): void {
  for (const id of timers) window.clearTimeout(id)
  timers = []
}

function later(ms: number, fn: () => void): void {
  timers.push(window.setTimeout(fn, ms))
}

function masterLevel(): number {
  if (!active || !wanted) return 0
  // Keep overall bed quiet/pleasant; plaza proximity only boosts outdoors a little.
  const place = indoors ? 1 : 0.75 + 0.25 * plazaNear
  return (volume / 100) * 0.22 * place
}

function ramp(g: GainNode | null, value: number, seconds = 0.75): void {
  if (!g || !context) return
  const now = context.currentTime
  const dest = Math.max(0, value)
  try {
    // Hold the audible value, then linear-fade (avoids the near-silent exponential floor).
    g.gain.cancelScheduledValues(now)
    const cur = Number.isFinite(g.gain.value) ? Math.max(0, g.gain.value) : 0
    g.gain.setValueAtTime(cur, now)
    g.gain.linearRampToValueAtTime(dest, now + Math.max(0.05, seconds))
  } catch {
    g.gain.value = dest
  }
}

function applyCrossfade(seconds = 1.1): void {
  if (!master) return
  const bed = masterLevel()
  ramp(master, bed, 0.35)
  // Crossfade street ↔ room
  ramp(outBus, indoors || bed <= 0 ? 0.0001 : 1, seconds)
  ramp(inBus, !indoors || bed <= 0 ? 0.0001 : 1, seconds)
  // Layer balances (relative to their bus)
  if (bed <= 0) {
    for (const g of [windG, trafficG, passG, voiceG, hornG, stepOutG, roomG, stepInG, kitchenG]) ramp(g, 0.0001, 0.3)
    return
  }
  if (indoors) {
    ramp(windG, 0.0001, seconds)
    ramp(trafficG, 0.0001, seconds)
    ramp(passG, 0.0001, seconds)
    ramp(voiceG, 0.0001, seconds)
    ramp(hornG, 0.0001, seconds)
    ramp(stepOutG, 0.0001, seconds)
    ramp(roomG, 0.55, seconds)
    ramp(stepInG, 0.7, seconds)
    ramp(kitchenG, 0.85, seconds)
  } else {
    ramp(roomG, 0.0001, seconds)
    ramp(stepInG, 0.0001, seconds)
    ramp(kitchenG, 0.0001, seconds)
    ramp(windG, 0.35, seconds)
    ramp(trafficG, 0.45 + 0.2 * plazaNear, seconds)
    ramp(passG, 0.55, seconds)
    ramp(voiceG, 0.28 + 0.2 * plazaNear, seconds)
    ramp(hornG, 0.4, seconds)
    ramp(stepOutG, 0.5, seconds)
  }
}

export function setAmbientVolume(value: number): void {
  volume = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 55
  write(LEVEL, String(volume))
  applyCrossfade(0.25)
}

export function setAmbientPlace(inside: boolean, distFromPlaza = 20): void {
  const nextNear = inside ? 0 : Math.max(0, Math.min(1, 1 - distFromPlaza / 55))
  const flipped = inside !== indoors
  const nearChanged = Math.abs(nextNear - plazaNear) > 0.12
  indoors = inside
  plazaNear = nextNear
  if (flipped) {
    const g = ++crossGen
    applyCrossfade(0.75)
    if (g === crossGen && active && wanted && context) {
      scheduleEvents(context)
      message = indoors
        ? 'City sound on — quiet room, footsteps and kitchen (separate from Music).'
        : 'City sound on — wind, traffic, horns, footsteps and distant voices (separate from Music).'
    }
  } else if (nearChanged && !indoors) {
    applyCrossfade(0.35)
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number, color: 'white' | 'pink' | 'brown'): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, last = 0
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1
    if (color === 'white') data[i] = white * 0.35
    else if (color === 'pink') {
      // Paul Kellet approx
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      data[i] = (b0 + b1 + b2 + white * 0.3) * 0.11
    } else {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
  }
  return buffer
}

function loopNoise(ctx: AudioContext, color: 'white' | 'pink' | 'brown', seconds: number, dest: AudioNode, filter: BiquadFilterNode): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, seconds, color)
  src.loop = true
  src.connect(filter)
  filter.connect(dest)
  src.start()
  return src
}

/** Soft car horn — two slightly detuned tones, distant. */
function playHorn(ctx: AudioContext, dest: AudioNode): void {
  const t0 = ctx.currentTime + 0.02
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42)
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
  const base = 260 + Math.random() * 40
  for (const mul of [1, 1.25]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(base * mul, t0)
    const og = ctx.createGain(); og.gain.value = mul === 1 ? 0.55 : 0.35
    o.connect(og); og.connect(lp)
    o.start(t0); o.stop(t0 + 0.45)
  }
  lp.connect(g); g.connect(dest)
}

/** Single footstep — soft thud + brief noise scrape. */
function playFootstep(ctx: AudioContext, dest: AudioNode, indoor: boolean): void {
  const t0 = ctx.currentTime
  const g = ctx.createGain()
  const peak = indoor ? 0.055 : 0.04
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (indoor ? 0.14 : 0.11))
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(indoor ? 95 : 130, t0)
  o.frequency.exponentialRampToValueAtTime(indoor ? 55 : 70, t0 + 0.1)
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, 0.08, 'white')
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = indoor ? 900 : 1400
  bp.Q.value = 1.2
  const ng = ctx.createGain(); ng.gain.value = indoor ? 0.35 : 0.25
  o.connect(g)
  noise.connect(bp); bp.connect(ng); ng.connect(g)
  g.connect(dest)
  o.start(t0); o.stop(t0 + 0.16)
  noise.start(t0); noise.stop(t0 + 0.08)
}

/** Soft plate / cup clink. */
function playClink(ctx: AudioContext, dest: AudioNode): void {
  const t0 = ctx.currentTime
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35)
  const f0 = 1800 + Math.random() * 1400
  for (const [mul, amp] of [[1, 0.7], [2.01, 0.35], [3.1, 0.18]] as const) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f0 * mul, t0)
    const og = ctx.createGain(); og.gain.value = amp
    o.connect(og); og.connect(g)
    o.start(t0); o.stop(t0 + 0.4)
  }
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600
  g.connect(hp); hp.connect(dest)
}

/** Distant moving car: filtered noise whoosh with pitch/gain envelope (pass-by). */
function playPassBy(ctx: AudioContext, dest: AudioNode): void {
  const t0 = ctx.currentTime
  const dur = 2.2 + Math.random() * 1.6
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 0.6, 'pink')
  src.loop = true
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4
  bp.frequency.setValueAtTime(180, t0)
  bp.frequency.exponentialRampToValueAtTime(520, t0 + dur * 0.45)
  bp.frequency.exponentialRampToValueAtTime(160, t0 + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.07, t0 + dur * 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  const pan = ctx.createStereoPanner?.() ?? null
  if (pan) {
    const from = Math.random() < 0.5 ? -0.85 : 0.85
    pan.pan.setValueAtTime(from, t0)
    pan.pan.linearRampToValueAtTime(-from, t0 + dur)
    src.connect(bp); bp.connect(g); g.connect(pan); pan.connect(dest)
  } else {
    src.connect(bp); bp.connect(g); g.connect(dest)
  }
  src.start(t0); src.stop(t0 + dur + 0.05)
}

/** Faint voice-like murmur: formant-ish filtered noise blip. */
function playWhisper(ctx: AudioContext, dest: AudioNode): void {
  const t0 = ctx.currentTime
  const dur = 0.35 + Math.random() * 0.55
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 0.2, 'pink')
  src.loop = true
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4
  const f0 = 320 + Math.random() * 420
  bp.frequency.setValueAtTime(f0, t0)
  bp.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.35), t0 + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.028, t0 + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(bp); bp.connect(g); g.connect(dest)
  src.start(t0); src.stop(t0 + dur + 0.02)
}

function scheduleEvents(ctx: AudioContext): void {
  clearTimers()
  if (!active || !wanted) return

  const passLoop = () => {
    if (!active || !wanted || !passG) return
    if (!indoors && Math.random() < 0.7) playPassBy(ctx, passG)
    later(3500 + Math.random() * 7000, passLoop)
  }
  later(1200 + Math.random() * 2000, passLoop)

  const hornLoop = () => {
    if (!active || !wanted || !hornG) return
    if (!indoors && Math.random() < 0.32) playHorn(ctx, hornG)
    later(6000 + Math.random() * 12000, hornLoop)
  }
  later(4000 + Math.random() * 3000, hornLoop)

  const voiceLoop = () => {
    if (!active || !wanted || !voiceG) return
    if (!indoors && Math.random() < 0.55) {
      playWhisper(ctx, voiceG)
      if (Math.random() < 0.4) later(180 + Math.random() * 220, () => { if (!indoors && voiceG) playWhisper(ctx, voiceG) })
    }
    later(2200 + Math.random() * 4500, voiceLoop)
  }
  later(1500, voiceLoop)

  const stepOutLoop = () => {
    if (!active || !wanted || !stepOutG) return
    if (!indoors && Math.random() < 0.65) {
      playFootstep(ctx, stepOutG, false)
      later(280 + Math.random() * 120, () => { if (!indoors && stepOutG && Math.random() < 0.8) playFootstep(ctx, stepOutG, false) })
    }
    later(1600 + Math.random() * 2800, stepOutLoop)
  }
  later(900, stepOutLoop)

  const stepInLoop = () => {
    if (!active || !wanted || !stepInG) return
    if (indoors && Math.random() < 0.7) {
      playFootstep(ctx, stepInG, true)
      later(320 + Math.random() * 140, () => { if (indoors && stepInG && Math.random() < 0.85) playFootstep(ctx, stepInG, true) })
    }
    later(1400 + Math.random() * 2200, stepInLoop)
  }
  later(1100, stepInLoop)

  const kitchenLoop = () => {
    if (!active || !wanted || !kitchenG) return
    if (indoors && Math.random() < 0.4) {
      playClink(ctx, kitchenG)
      if (Math.random() < 0.35) later(90 + Math.random() * 160, () => { if (indoors && kitchenG) playClink(ctx, kitchenG) })
    }
    later(5000 + Math.random() * 9000, kitchenLoop)
  }
  later(2500, kitchenLoop)
}

function buildGraph(ctx: AudioContext): void {
  master = ctx.createGain(); master.gain.value = 0.0001
  master.connect(ctx.destination)

  outBus = ctx.createGain(); outBus.gain.value = 0.0001
  inBus = ctx.createGain(); inBus.gain.value = 0.0001
  outBus.connect(master); inBus.connect(master)

  windG = ctx.createGain(); windG.gain.value = 0.0001
  trafficG = ctx.createGain(); trafficG.gain.value = 0.0001
  passG = ctx.createGain(); passG.gain.value = 0.0001
  voiceG = ctx.createGain(); voiceG.gain.value = 0.0001
  hornG = ctx.createGain(); hornG.gain.value = 0.0001
  stepOutG = ctx.createGain(); stepOutG.gain.value = 0.0001
  for (const g of [windG, trafficG, passG, voiceG, hornG, stepOutG]) g.connect(outBus)

  roomG = ctx.createGain(); roomG.gain.value = 0.0001
  stepInG = ctx.createGain(); stepInG.gain.value = 0.0001
  kitchenG = ctx.createGain(); kitchenG.gain.value = 0.0001
  for (const g of [roomG, stepInG, kitchenG]) g.connect(inBus)

  // Soft wind — very low brown, lowpass so it is breeze not hiss
  {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 0.4
    const g = ctx.createGain(); g.gain.value = 0.55
    loopNoise(ctx, 'brown', 3.2, g, f)
    g.connect(windG)
  }

  // Distant traffic bed — rumble only
  {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 110; f.Q.value = 0.5
    const g = ctx.createGain(); g.gain.value = 0.7
    const lfo = ctx.createOscillator(); const lg = ctx.createGain()
    lfo.frequency.value = 0.07; lg.gain.value = 18
    lfo.connect(lg); lg.connect(f.frequency); lfo.start()
    loopNoise(ctx, 'brown', 4, g, f)
    g.connect(trafficG)
  }

  // Quiet indoor room tone — very soft mid-low pink
  {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.5
    const g = ctx.createGain(); g.gain.value = 0.35
    loopNoise(ctx, 'pink', 2.8, g, f)
    g.connect(roomG)
  }
}

export async function setAmbientEnabled(on: boolean): Promise<void> {
  const attempt = ++generation
  wanted = on
  write(PREF, on ? 'on' : 'off')
  if (!on) {
    active = false
    clearTimers()
    applyCrossfade(0.2)
    message = 'City sound off.'
    try { await context?.suspend() } catch { /* */ }
    return
  }
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) throw new Error('Web Audio unavailable')
      context = new Ctor()
      buildGraph(context)
    }
    if (!bound) {
      bound = true
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          active = false
          clearTimers()
          applyCrossfade(0.15)
          void context?.suspend().catch(() => {})
        } else if (wanted) void setAmbientEnabled(true)
      })
    }
    await context.resume()
    if (attempt !== generation) return
    if (!wanted || document.hidden) { await context.suspend(); return }
    active = true
    applyCrossfade(0.6)
    scheduleEvents(context)
    message = indoors
      ? 'City sound on — quiet room, footsteps and kitchen (separate from Music).'
      : 'City sound on — wind, traffic, horns, footsteps and distant voices (separate from Music).'
  } catch {
    if (attempt !== generation) return
    active = false
    clearTimers()
    applyCrossfade(0.1)
    message = 'City sound could not start. Tap again after interacting with the page.'
  }
}

export function ensureAmbientOnGesture(): void {
  const kick = () => {
    if (wanted) void setAmbientEnabled(true)
    window.removeEventListener('pointerdown', kick)
    window.removeEventListener('keydown', kick)
  }
  window.addEventListener('pointerdown', kick, { once: true, passive: true })
  window.addEventListener('keydown', kick, { once: true })
}

export function syncAmbientToMusic(): void { applyCrossfade(0.2) }

// Side-effect so headless checks can read the live graph (not tree-shaken).
try {
  (globalThis as unknown as { __gdAmbient?: () => Record<string, unknown> }).__gdAmbient = ambientDebug
} catch { /* */ }

/** Test hook: expose a compact graph snapshot for headless checks. */
export function ambientDebug(): Record<string, unknown> {
  return {
    wanted, active, volume, indoors, plazaNear,
    contextState: context?.state ?? 'none',
    master: master?.gain.value ?? null,
    outBus: outBus?.gain.value ?? null,
    inBus: inBus?.gain.value ?? null,
    layers: {
      wind: windG?.gain.value ?? null,
      traffic: trafficG?.gain.value ?? null,
      pass: passG?.gain.value ?? null,
      voice: voiceG?.gain.value ?? null,
      horn: hornG?.gain.value ?? null,
      stepOut: stepOutG?.gain.value ?? null,
      room: roomG?.gain.value ?? null,
      stepIn: stepInG?.gain.value ?? null,
      kitchen: kitchenG?.gain.value ?? null,
    },
    message,
  }
}
