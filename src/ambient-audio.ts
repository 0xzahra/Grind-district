// Optional synthesized quiet city-air bed, not a recorded asset or game telemetry.
// Created only after a user's explicit tap; separate preference and volume from theme.
const PREF = 'grind-district-ambient', LEVEL = 'grind-district-ambient-volume'
let context: AudioContext | null = null, gain: GainNode | null = null
let active = false, bound = false, generation = 0, message = 'Tap to enable ambient sound.'
function read(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function write(key: string, value: string): void { try { localStorage.setItem(key, value) } catch { /* session only */ } }
let wanted = read(PREF) === 'on'
const storedVolume = Number(read(LEVEL) ?? '25')
let volume = Number.isFinite(storedVolume) ? Math.max(0, Math.min(100, storedVolume)) : 25
export function ambientState() { return { wanted, active, volume, message } }
export function setAmbientVolume(value: number): void {
  volume = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 25
  write(LEVEL, String(volume))
  if (gain) gain.gain.value = active ? volume / 100 * 0.045 : 0
}
export async function setAmbientEnabled(on: boolean): Promise<void> {
  const attempt = ++generation
  wanted = on
  write(PREF, on ? 'on' : 'off')
  if (!on) {
    active = false; if (gain) gain.gain.value = 0; message = 'Ambient sound off.'
    try { await context?.suspend() } catch { message = 'Ambient sound stopped; audio context unavailable.' }
    return
  }
  try {
    if (!context) {
      const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Constructor) throw new Error('Web Audio unavailable')
      context = new Constructor()
      const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 350
      gain = context.createGain(); gain.gain.value = 0
      source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start()
    }
    // Called in the tap stack, not after fetching/awaiting unrelated work.
    const resumed = context.resume()
    if (!bound) {
      bound = true
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { ++generation; active = false; if (gain) gain.gain.value = 0; void context?.suspend().catch(() => { message = 'Ambient suspension failed.' }) }
        else if (ambientState().wanted) void setAmbientEnabled(true)
      })
    }
    await resumed
    if (attempt !== generation) return
    if (!wanted || document.hidden) { await context.suspend(); return }
    active = true; gain!.gain.value = volume / 100 * 0.045; message = 'Ambient city air on. Independent of theme music.'
  } catch {
    if (attempt !== generation) return
    active = false; if (gain) gain.gain.value = 0
    try { await context?.suspend() } catch { /* Zero gain still prevents unwanted sound. */ }
    message = 'Ambient could not start. Tap again; this device must support Web Audio.'
  }
}
