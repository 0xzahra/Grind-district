// Recorded city soundscape layered on top of the procedural ambient bed.
// Loaded lazily (dynamic import + small mono MP3s in /audio) only after the city is open and City sound is on.
// All recordings are CC0 — see docs/SOUNDS.md for sources.
// Everything routes through the ambient out/in buses, so the City sound switch and volume slider still apply.

export interface SoundEnv {
  indoors: boolean
  plazaNear: number // 0..1, 1 = in the plaza
  night: number // 0..1
  rain: number // 0..1
  x: number; z: number // listener
  fx: number; fz: number // listener forward (XZ, normalised)
}

export interface Soundscape {
  update(env: SoundEnv): void
  stop(): void
  debug(): Record<string, unknown>
}

const BEDS = ['traffic', 'birds', 'chatter', 'leaves', 'crickets', 'rain', 'interior', 'hum', 'steps'] as const
const SHOTS = ['horn1', 'horn2', 'horn3', 'dog', 'siren'] as const
type Bed = typeof BEDS[number]
type Shot = typeof SHOTS[number]

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    // Callback form too: older Safari has no promise-returning decodeAudioData.
    const p = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined
    p?.then?.(resolve, reject)
  })
}

async function load(ctx: AudioContext, name: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(`/audio/${name}.mp3`)
    if (!res.ok) return null
    return await decode(ctx, await res.arrayBuffer())
  } catch { return null }
}

/** MP3 frames add a little silence at both ends; loop only the audible part so beds don't tick. */
function loopBounds(buf: AudioBuffer): [number, number] {
  const d = buf.getChannelData(0), n = d.length, lim = Math.min(4096, n >> 3)
  let a = 0, b = n - 1
  while (a < lim && Math.abs(d[a]) < 2e-4) a++
  while (b > n - 1 - lim && Math.abs(d[b]) < 2e-4) b--
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate]
}

export function createSoundscape(ctx: AudioContext, outBus: AudioNode, inBus: AudioNode): Soundscape {
  let stopped = false
  let env: SoundEnv = { indoors: false, plazaNear: 0.5, night: 0, rain: 0, x: 0, z: 0, fx: 0, fz: -1 }
  const gains = new Map<Bed, GainNode>()
  const ready = new Set<string>()
  const shots = new Map<Shot, AudioBuffer>()
  const timers: number[] = []
  let lastPlayed = ''

  // Street layers feed the out bus; a muffled copy reaches the room so the street is faintly heard indoors.
  const street = ctx.createGain(); street.connect(outBus)
  const muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 520
  const muffleG = ctx.createGain(); muffleG.gain.value = 0.14
  street.connect(muffle); muffle.connect(muffleG); muffleG.connect(inBus)
  const room = ctx.createGain(); room.connect(inBus)

  for (const name of BEDS) {
    const g = ctx.createGain(); g.gain.value = 0
    g.connect(name === 'interior' ? room : street)
    gains.set(name, g)
  }
  // Indoors the hum is an AC unit in the room; outside it is a far generator at night. One loop, two sends.
  const humIn = ctx.createGain(); humIn.gain.value = 0
  humIn.connect(room)

  function targets(): Record<Bed, number> {
    const day = 1 - env.night, wet = env.rain, dry = 1 - 0.75 * wet
    const near = env.plazaNear
    return {
      traffic: (0.42 + 0.2 * near) * (0.55 + 0.45 * day),
      birds: 0.5 * day * dry * (0.6 + 0.4 * (1 - near)),
      chatter: (0.1 + 0.42 * near) * (0.35 + 0.65 * day) * (1 - 0.6 * wet),
      leaves: 0.3 * (0.7 + 0.3 * (1 - near)) * (1 - 0.5 * wet),
      crickets: 0.42 * env.night * (1 - 0.7 * wet),
      rain: 0.85 * wet,
      interior: 0.36,
      hum: 0.07 * env.night,
      steps: (0.08 + 0.22 * near) * (0.4 + 0.6 * day) * (1 - 0.5 * wet),
    }
  }

  let applied = ''
  function apply(force = false): void {
    const t = targets()
    const key = Object.values(t).map((v) => v.toFixed(2)).join() + (env.indoors ? 'i' : 'o')
    if (!force && key === applied) return
    applied = key
    const now = ctx.currentTime
    for (const name of BEDS) {
      const g = gains.get(name)!
      g.gain.setTargetAtTime(ready.has(name) ? t[name] : 0, now, 0.6)
    }
    humIn.gain.setTargetAtTime(ready.has('hum') ? 0.16 : 0, now, 0.6)
  }

  function startBed(name: Bed, buf: AudioBuffer): void {
    if (stopped) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const [a, b] = loopBounds(buf)
    src.loopStart = a; src.loopEnd = b
    src.connect(gains.get(name)!)
    if (name === 'hum') src.connect(humIn)
    // Random start offset so layers never line up the same way twice.
    src.start(ctx.currentTime + 0.05, a + Math.random() * (b - a) * 0.9)
    ready.add(name)
    apply(true)
  }

  /** One-shot from a world position: distance attenuation, a little air absorption and left/right pan. */
  function playAt(name: Shot, sx: number, sz: number, level: number, drift = 0): void {
    const buf = shots.get(name)
    if (!buf || stopped || env.indoors || ctx.state !== 'running') return
    const dx = sx - env.x, dz = sz - env.z
    const dist = Math.max(4, Math.hypot(dx, dz))
    const src = ctx.createBufferSource(); src.buffer = buf
    src.playbackRate.value = 0.94 + Math.random() * 0.12
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.value = Math.max(900, 9000 - dist * 140)
    const g = ctx.createGain(); g.gain.value = level * Math.min(1, 9 / dist)
    src.connect(lp); lp.connect(g)
    const pan = ctx.createStereoPanner?.()
    if (pan) {
      const rx = -env.fz, rz = env.fx // listener's right
      const p = Math.max(-0.9, Math.min(0.9, (dx * rx + dz * rz) / dist))
      pan.pan.setValueAtTime(p, ctx.currentTime)
      if (drift) pan.pan.linearRampToValueAtTime(Math.max(-0.9, Math.min(0.9, p + drift)), ctx.currentTime + buf.duration)
      g.connect(pan); pan.connect(street)
    } else g.connect(street)
    src.start()
    lastPlayed = `${name}@${Math.round(dist)}m`
  }

  function around(min: number, max: number): [number, number] {
    const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min)
    return [env.x + Math.cos(a) * r, env.z + Math.sin(a) * r]
  }

  function later(ms: number, fn: () => void): void { timers.push(window.setTimeout(fn, ms)) }

  function schedule(): void {
    const hornLoop = () => {
      if (stopped) return
      if (!env.indoors && shots.size && Math.random() < 0.55 - 0.25 * env.night) {
        const pick = (['horn1', 'horn2', 'horn3'] as const)[Math.floor(Math.random() * 3)]
        const [x, z] = around(14, 45)
        playAt(pick, x, z, 0.32)
      }
      later(7000 + Math.random() * 14000, hornLoop)
    }
    later(5000, hornLoop)
    const dogLoop = () => {
      if (stopped) return
      if (!env.indoors && Math.random() < 0.5 + 0.2 * env.night) { const [x, z] = around(25, 60); playAt('dog', x, z, 0.38) }
      later(45000 + Math.random() * 60000, dogLoop)
    }
    later(25000 + Math.random() * 20000, dogLoop)
    const sirenLoop = () => {
      if (stopped) return
      if (!env.indoors && Math.random() < 0.45) { const [x, z] = around(60, 110); playAt('siren', x, z, 0.5, Math.random() < 0.5 ? -0.8 : 0.8) }
      later(120000 + Math.random() * 120000, sirenLoop)
    }
    later(70000 + Math.random() * 60000, sirenLoop)
  }

  // Load the beds people hear first, then the rest, then one-shots — one at a time so the phone never stalls.
  void (async () => {
    const order: Bed[] = ['traffic', 'birds', 'chatter', 'leaves', 'steps', 'crickets', 'interior', 'rain', 'hum']
    for (const name of order) {
      if (stopped) return
      const buf = await load(ctx, name)
      if (buf) startBed(name, buf)
    }
    for (const name of SHOTS) {
      if (stopped) return
      const buf = await load(ctx, name)
      if (buf) shots.set(name, buf)
    }
    schedule()
  })()

  return {
    update(next) { env = next; apply() },
    stop() {
      stopped = true
      for (const id of timers) window.clearTimeout(id)
      for (const g of gains.values()) g.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
      humIn.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
    },
    debug() {
      const out: Record<string, number> = {}
      for (const [k, g] of gains) out[k] = Number(g.gain.value.toFixed(3))
      return { ready: [...ready], shots: [...shots.keys()], gains: out, lastPlayed }
    },
  }
}
