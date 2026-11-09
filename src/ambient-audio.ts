// City ambient bed (traffic, horns, crowd, wind, birds) — separate from theme music.
const PREF = 'grind-district-ambient', LEVEL = 'grind-district-ambient-volume'
let context: AudioContext | null = null
let master: GainNode | null = null
let windG: GainNode | null = null
let trafficG: GainNode | null = null
let crowdG: GainNode | null = null
let birdG: GainNode | null = null
let hornG: GainNode | null = null
let active = false, bound = false, generation = 0
let message = 'Tap City sound in Settings to hear the street.'
let birdTimer: number | null = null
let hornTimer: number | null = null
let indoors = false
let plazaNear = 1

function read(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function write(key: string, value: string): void { try { localStorage.setItem(key, value) } catch { /* */ } }

let wanted = read(PREF) !== 'off'
const storedVolume = Number(read(LEVEL) ?? '70')
let volume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(100, storedVolume)) : 70

export function ambientState() { return { wanted, active, volume, message } }

function placeFactor(): number {
  if (indoors) return 0.22
  return 0.55 + 0.45 * plazaNear
}

function applyGain(): void {
  if (!master) return
  const bed = active && wanted ? (volume / 100) * 0.42 * placeFactor() : 0
  master.gain.value = bed
  if (windG) windG.gain.value = bed > 0 ? 0.55 : 0
  if (trafficG) trafficG.gain.value = bed > 0 ? (indoors ? 0.25 : 0.9) : 0
  if (crowdG) crowdG.gain.value = bed > 0 ? (indoors ? 0.15 : 0.55) : 0
  if (birdG) birdG.gain.value = bed > 0 && !indoors ? 0.4 : 0
  if (hornG) hornG.gain.value = bed > 0 && !indoors ? 0.5 : 0
}

export function setAmbientVolume(value: number): void {
  volume = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 70
  write(LEVEL, String(volume))
  applyGain()
}

export function setAmbientPlace(inside: boolean, distFromPlaza = 20): void {
  indoors = inside
  plazaNear = inside ? 0 : Math.max(0, Math.min(1, 1 - distFromPlaza / 55))
  applyGain()
}

function noiseBuffer(ctx: AudioContext, seconds: number, color: 'brown' | 'pink'): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < samples.length; i++) {
    const white = Math.random() * 2 - 1
    if (color === 'brown') { last = (last + 0.02 * white) / 1.02; samples[i] = last * 3.5 }
    else { last = 0.98 * last + 0.02 * white; samples[i] = white * 0.4 + last * 0.8 }
  }
  return buffer
}

function chirp(ctx: AudioContext, dest: AudioNode): void {
  const t0 = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  const f0 = 1600 + Math.random() * 1600
  o.frequency.setValueAtTime(f0, t0)
  o.frequency.exponentialRampToValueAtTime(f0 * (0.65 + Math.random() * 0.45), t0 + 0.12)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15)
  o.connect(g); g.connect(dest)
  o.start(t0); o.stop(t0 + 0.17)
}

function horn(ctx: AudioContext, dest: AudioNode): void {
  const t0 = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  o.frequency.setValueAtTime(220 + Math.random() * 80, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35)
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800
  o.connect(f); f.connect(g); g.connect(dest)
  o.start(t0); o.stop(t0 + 0.4)
}

function scheduleBirds(ctx: AudioContext): void {
  if (birdTimer != null) window.clearTimeout(birdTimer)
  const loop = () => {
    if (!active || !wanted || indoors || !birdG) { birdTimer = window.setTimeout(loop, 2500); return }
    if (Math.random() < 0.6) chirp(ctx, birdG)
    birdTimer = window.setTimeout(loop, 1600 + Math.random() * 4000)
  }
  birdTimer = window.setTimeout(loop, 700)
}

function scheduleHorns(ctx: AudioContext): void {
  if (hornTimer != null) window.clearTimeout(hornTimer)
  const loop = () => {
    if (!active || !wanted || indoors || !hornG) { hornTimer = window.setTimeout(loop, 4000); return }
    if (Math.random() < 0.35) horn(ctx, hornG)
    hornTimer = window.setTimeout(loop, 5000 + Math.random() * 9000)
  }
  hornTimer = window.setTimeout(loop, 3000)
}

function buildGraph(ctx: AudioContext): void {
  master = ctx.createGain(); master.gain.value = 0
  master.connect(ctx.destination)
  windG = ctx.createGain(); windG.gain.value = 0
  trafficG = ctx.createGain(); trafficG.gain.value = 0
  crowdG = ctx.createGain(); crowdG.gain.value = 0
  birdG = ctx.createGain(); birdG.gain.value = 0
  hornG = ctx.createGain(); hornG.gain.value = 0
  windG.connect(master); trafficG.connect(master); crowdG.connect(master); birdG.connect(master); hornG.connect(master)
  {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 2, 'brown'); src.loop = true
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 260; f.Q.value = 0.6
    src.connect(f); f.connect(windG); src.start()
  }
  {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 3, 'brown'); src.loop = true
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 0.5
    const lfo = ctx.createOscillator(); const lg = ctx.createGain()
    lfo.frequency.value = 0.15; lg.gain.value = 30
    lfo.connect(lg); lg.connect(f.frequency); lfo.start()
    src.connect(f); f.connect(trafficG); src.start()
  }
  {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 2.5, 'pink'); src.loop = true
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8
    src.connect(f); f.connect(crowdG); src.start()
  }
  scheduleBirds(ctx)
  scheduleHorns(ctx)
}

export async function setAmbientEnabled(on: boolean): Promise<void> {
  const attempt = ++generation
  wanted = on
  write(PREF, on ? 'on' : 'off')
  if (!on) {
    active = false; applyGain(); message = 'City sound off.'
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
        if (document.hidden) { active = false; applyGain(); void context?.suspend().catch(() => {}) }
        else if (wanted) void setAmbientEnabled(true)
      })
    }
    await context.resume()
    if (attempt !== generation) return
    if (!wanted || document.hidden) { await context.suspend(); return }
    active = true
    applyGain()
    message = 'City sound on — traffic, crowd, wind and birds (separate from Music).'
  } catch {
    if (attempt !== generation) return
    active = false; applyGain()
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

export function syncAmbientToMusic(): void { applyGain() }
