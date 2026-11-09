// Wind + birds city air under the theme music. Opt-in; ducks under music; silent when muted.
const PREF = 'grind-district-ambient', LEVEL = 'grind-district-ambient-volume'
let context: AudioContext | null = null, gain: GainNode | null = null
let windGain: GainNode | null = null, birdGain: GainNode | null = null
let active = false, bound = false, generation = 0, message = 'Tap to enable ambient sound.'
let birdTimer: number | null = null
function read(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function write(key: string, value: string): void { try { localStorage.setItem(key, value) } catch { /* session only */ } }
let wanted = read(PREF) === 'on'
const storedVolume = Number(read(LEVEL) ?? '25')
let volume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(100, storedVolume)) : 25
export function ambientState() { return { wanted, active, volume, message } }

function musicMuted(): boolean {
  try {
    if (localStorage.getItem('gd.music') !== 'on') return true
    const v = Number(localStorage.getItem('gd.music.volume') ?? '40')
    return !Number.isFinite(v) || v <= 0
  } catch { return true }
}

function duckFactor(): number {
  // Under music: quieter bed. If music is muted, ambient also stays silent (respects mute).
  if (musicMuted()) return 0
  return 0.55
}

function applyGain(): void {
  if (!gain) return
  const under = duckFactor()
  const v = active && wanted ? (volume / 100) * 0.05 * under : 0
  gain.gain.value = v
  if (windGain) windGain.gain.value = v > 0 ? 0.7 : 0
  if (birdGain) birdGain.gain.value = v > 0 ? 0.35 : 0
}

export function setAmbientVolume(value: number): void {
  volume = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 25
  write(LEVEL, String(volume))
  applyGain()
}

function chirp(ctx: AudioContext, dest: AudioNode): void {
  const t0 = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  const f0 = 1800 + Math.random() * 1400
  o.frequency.setValueAtTime(f0, t0)
  o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.4), t0 + 0.12)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14)
  o.connect(g); g.connect(dest)
  o.start(t0); o.stop(t0 + 0.16)
}

function scheduleBirds(ctx: AudioContext): void {
  if (birdTimer != null) window.clearTimeout(birdTimer)
  const loop = () => {
    if (!active || !wanted || musicMuted() || !birdGain) { birdTimer = window.setTimeout(loop, 2000); return }
    if (Math.random() < 0.55) chirp(ctx, birdGain)
    if (Math.random() < 0.25) window.setTimeout(() => { if (active && birdGain) chirp(ctx, birdGain) }, 90 + Math.random() * 120)
    birdTimer = window.setTimeout(loop, 1800 + Math.random() * 4200)
  }
  birdTimer = window.setTimeout(loop, 800)
}

function buildGraph(ctx: AudioContext): void {
  // Wind: filtered brownish noise
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < samples.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    samples[i] = last * 3.5
  }
  const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true
  const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 280; filter.Q.value = 0.7
  windGain = ctx.createGain(); windGain.gain.value = 0
  birdGain = ctx.createGain(); birdGain.gain.value = 0
  gain = ctx.createGain(); gain.gain.value = 0
  source.connect(filter); filter.connect(windGain); windGain.connect(gain)
  birdGain.connect(gain)
  gain.connect(ctx.destination)
  source.start()
  scheduleBirds(ctx)
}

export async function setAmbientEnabled(on: boolean): Promise<void> {
  const attempt = ++generation
  wanted = on
  write(PREF, on ? 'on' : 'off')
  if (!on) {
    active = false; applyGain(); message = 'Ambient sound off.'
    try { await context?.suspend() } catch { message = 'Ambient sound stopped; audio context unavailable.' }
    return
  }
  try {
    if (!context) {
      const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Constructor) throw new Error('Web Audio unavailable')
      context = new Constructor()
      buildGraph(context)
    }
    const resumed = context.resume()
    if (!bound) {
      bound = true
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { ++generation; active = false; applyGain(); void context?.suspend().catch(() => { message = 'Ambient suspension failed.' }) }
        else if (ambientState().wanted) void setAmbientEnabled(true)
      })
      // Follow music mute / volume changes from settings.
      window.addEventListener('storage', () => applyGain())
      window.setInterval(() => { if (active) applyGain() }, 1500)
    }
    await resumed
    if (attempt !== generation) return
    if (!wanted || document.hidden) { await context.suspend(); return }
    active = true
    applyGain()
    message = musicMuted()
      ? 'City air ready — turn Music on (or raise volume) to hear wind and birds under the theme.'
      : 'Wind and birds under the music. Mutes with Music off / volume 0.'
  } catch {
    if (attempt !== generation) return
    active = false; applyGain()
    try { await context?.suspend() } catch { /* Zero gain still prevents unwanted sound. */ }
    message = 'Ambient could not start. Tap again; this device must support Web Audio.'
  }
}

/** Call from music toggles so ambient ducks / mutes immediately. */
export function syncAmbientToMusic(): void { applyGain() }
