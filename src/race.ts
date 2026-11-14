// The Raceway: a five-lap time trial against the clock. Hold to accelerate, let go to brake. Every bend has a
// speed it can be taken at; go in faster and the car slides wide and loses time. It is a skill game: no bets, no
// prize money, no other drivers to pay. A clean run gives a little reputation once a day, and beating the par
// times earns a bronze, silver or gold medal (collectible cards). Cars you own are quicker than the club kart.
// Stored per save slot beside the save (save format unchanged).
import { slotKey, getSave, addReputation } from './state.ts'

type Car = { id: string; label: string; top: number; acc: number; grip: number; tint: string }
const KART: Car = { id: 'kart', label: 'Club kart', top: 150, acc: 95, grip: 1, tint: '#e9c46a' }
const OWNED: Record<string, Car> = {
  saloon: { id: 'saloon', label: 'City saloon', top: 165, acc: 100, grip: 1.02, tint: '#8d99ae' },
  tourer: { id: 'tourer', label: 'Grand tourer', top: 178, acc: 108, grip: 1.05, tint: '#9d2f2f' },
  evcoupe: { id: 'evcoupe', label: 'Electric coupé', top: 172, acc: 130, grip: 1.06, tint: '#3fb8af' },
  sportsaloon: { id: 'sportsaloon', label: 'Sport saloon', top: 176, acc: 112, grip: 1.06, tint: '#1c3f96' },
  executive: { id: 'executive', label: 'Executive saloon', top: 170, acc: 102, grip: 1.03, tint: '#c9ced3' },
  supercar: { id: 'supercar', label: 'V8 supercar', top: 192, acc: 128, grip: 1.1, tint: '#c4161c' },
  hypercar: { id: 'hypercar', label: 'Hypercar', top: 205, acc: 140, grip: 1.14, tint: '#ff7a1a' },
}
const LAPS = 5
const BRAKE = 170, COAST = 38, SLIDE_AT = 1.1
// The circuit, in a 320 x 200 space: a long straight, a hairpin, an S and a fast sweeper.
const POINTS: Array<[number, number]> = [[40, 150], [120, 165], [215, 165], [282, 150], [296, 112], [268, 84], [222, 92], [188, 70], [214, 40], [262, 34], [240, 14], [150, 18], [96, 30], [70, 62], [112, 88], [100, 118], [56, 112], [28, 126]]

type Track = { x: Float32Array; y: Float32Array; ang: Float32Array; safe: Float32Array; len: number; n: number; step: number }
let cached: Track | null = null
function track(): Track {
  if (cached) return cached
  const P = POINTS, m = P.length, per = 16, n = m * per
  const x = new Float32Array(n), y = new Float32Array(n), ang = new Float32Array(n), safe = new Float32Array(n)
  for (let i = 0; i < m; i++) {
    const p0 = P[(i - 1 + m) % m]!, p1 = P[i]!, p2 = P[(i + 1) % m]!, p3 = P[(i + 2) % m]!
    for (let j = 0; j < per; j++) {
      const u = j / per, u2 = u * u, u3 = u2 * u, k = i * per + j
      x[k] = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3)
      y[k] = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)
    }
  }
  let len = 0
  for (let k = 0; k < n; k++) { const a = (k + 1) % n; len += Math.hypot(x[a]! - x[k]!, y[a]! - y[k]!); ang[k] = Math.atan2(y[a]! - y[k]!, x[a]! - x[k]!) }
  const step = len / n
  for (let k = 0; k < n; k++) {
    let d = ang[(k + 3) % n]! - ang[(k - 3 + n) % n]!
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    const curv = Math.abs(d) / (6 * step) // radians per unit of track
    safe[k] = Math.min(400, 30 / Math.sqrt(Math.max(curv, 0.0015)))
  }
  cached = { x, y, ang, safe, len, n, step }
  return cached
}
const safeAt = (t: Track, s: number, grip: number) => t.safe[Math.floor((((s % t.len) + t.len) % t.len) / t.step) % t.n]! * grip

/** Seconds a tidy driver takes in the kart: brakes in time for every bend, never slides. Sets the medal times. */
let parCache = 0
export function par(): number {
  if (parCache) return parCache
  const t = track(), c = KART, dt = 1 / 120
  let s = 0, v = COAST, time = 0
  while (s < t.len * LAPS && time < 600) {
    // Brake if the speed could not be shed before any bend in the braking distance ahead.
    let go = true
    for (let d = 0; d <= 120; d += 4) { const lim = safeAt(t, s + d, c.grip) * 0.98; if (v * v - 2 * BRAKE * d > lim * lim) { go = false; break } }
    v = go ? Math.min(c.top, v + c.acc * dt) : Math.max(COAST, v - BRAKE * dt)
    s += v * dt; time += dt
  }
  parCache = time
  return time
}
export const MEDALS = ['', 'Bronze', 'Silver', 'Gold'] as const
const GOLD = 1.06, SILVER = 1.13, BRONZE = 1.22 // times par; flooring it and sliding through every bend earns nothing
const medalFor = (sec: number): number => { const p = par(); return sec <= p * GOLD ? 3 : sec <= p * SILVER ? 2 : sec <= p * BRONZE ? 1 : 0 }

type Store = { best: number; medal: number; day: string; runs: number }
const key = () => `${slotKey()}.race`
const read = (): Store => { try { return { best: 0, medal: 0, day: '', runs: 0, ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as Partial<Store>) } } catch { return { best: 0, medal: 0, day: '', runs: 0 } } }
export const raceMedal = (): number => read().medal
export const raceBest = (): number => read().best

function finish(sec: number, slides: number): string {
  const s = read(), today = new Date().toLocaleDateString('en-CA')
  const medal = medalFor(sec), better = !s.best || sec < s.best
  if (better) s.best = Math.round(sec * 100) / 100
  const newMedal = medal > s.medal
  if (newMedal) s.medal = medal
  s.runs += 1
  const firstToday = s.day !== today
  s.day = today
  try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ }
  if (firstToday) window.setTimeout(() => addReputation(2, 'Reputation: raceway laps', `${LAPS} laps in ${sec.toFixed(1)} s.`), 0)
  if (newMedal) window.dispatchEvent(new CustomEvent('gd:race-medal', { detail: medal }))
  return `${sec.toFixed(2)} s${slides ? `, ${slides} slide${slides === 1 ? '' : 's'}` : ', a clean run'}.${better ? ' A new best.' : ''}${newMedal ? ` ${MEDALS[medal]} medal earned.` : ''}${firstToday ? ' +2 reputation.' : ''}`
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement; finish: (m: string) => void }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }

/** The Raceway panel: pick a car, drive three laps. */
export function raceNodes(h: H): HTMLElement[] {
  const t = track()
  const owned = getSave().ownedVehicles ?? []
  const cars = [KART, ...Object.values(OWNED).filter((c) => (owned as string[]).includes(c.id))]
  let car = cars[cars.length - 1]!
  const root = el('div', 'race')
  const cv = el('canvas', 'race-cv') as HTMLCanvasElement
  cv.width = 640; cv.height = 400
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'The circuit from above')
  const hud = el('div', 'race-hud')
  const lapEl = el('b', '', `Lap 1 of ${LAPS}`), timeEl = el('span', '', '0.00 s'), noteEl = el('em', '', 'Hold to accelerate. Let go before the red bends.')
  hud.append(lapEl, timeEl)
  const pedal = el('button', 'race-pedal', 'Hold to accelerate') as HTMLButtonElement
  pedal.type = 'button'
  const picks = el('div', 'tabs')
  const s0 = read(), p = par()
  const info = h.para(`Par in the kart ${p.toFixed(1)} s. Gold under ${(p * GOLD).toFixed(1)} s, silver under ${(p * SILVER).toFixed(1)} s, bronze under ${(p * BRONZE).toFixed(1)} s.${s0.best ? ` Your best: ${s0.best.toFixed(2)} s${s0.medal ? ` (${MEDALS[s0.medal]})` : ''}.` : ''}`, 'muted')

  let s = 0, v = 0, time = 0, down = false, started = false, over = false, slideFor = 0, slides = 0, last = 0, raf = 0
  const reset = () => { s = 0; v = 0; time = 0; started = false; over = false; slideFor = 0; slides = 0; lapEl.textContent = `Lap 1 of ${LAPS}`; timeEl.textContent = '0.00 s'; noteEl.textContent = 'Hold to accelerate. Let go before the red bends.'; pedal.textContent = 'Hold to accelerate' }
  const paintPicks = () => {
    picks.replaceChildren()
    for (const c of cars) picks.append(h.button(c.label, c === car ? 'primary' : 'ghost', () => { car = c; reset(); paintPicks() }))
  }
  paintPicks()

  const g = cv.getContext('2d')!
  const X = (k: number) => t.x[k]! * 2, Y = (k: number) => t.y[k]! * 2
  const draw = () => {
    g.clearRect(0, 0, 640, 400)
    g.fillStyle = '#2f5d3a'; g.fillRect(0, 0, 640, 400)
    const path = () => { g.beginPath(); g.moveTo(X(0), Y(0)); for (let k = 1; k < t.n; k++) g.lineTo(X(k), Y(k)); g.closePath() }
    g.lineJoin = 'round'; g.lineCap = 'round'
    path(); g.strokeStyle = '#f2efe6'; g.lineWidth = 34; g.stroke()
    path(); g.strokeStyle = '#3b3f45'; g.lineWidth = 28; g.stroke()
    // Bends that need braking are marked red on the racing line; the rest is a quiet dashed centre line.
    for (let k = 0; k < t.n; k++) {
      const slow = t.safe[k]! * car.grip < car.top * 0.9
      g.beginPath(); g.moveTo(X(k), Y(k)); g.lineTo(X((k + 1) % t.n), Y((k + 1) % t.n))
      g.strokeStyle = slow ? 'rgba(240,97,109,0.9)' : k % 4 < 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0)'
      g.lineWidth = slow ? 4 : 2; g.stroke()
    }
    // Start and finish line.
    g.save(); g.translate(X(0), Y(0)); g.rotate(t.ang[0]! + Math.PI / 2); g.fillStyle = '#fff'; g.fillRect(-14, -3, 28, 6); g.fillStyle = '#111'; for (let i = 0; i < 7; i++) if (i % 2) g.fillRect(-14 + i * 4, -3, 4, 3); else g.fillRect(-14 + i * 4, 0, 4, 3); g.restore()
    // The car.
    const f = (((s % t.len) + t.len) % t.len) / t.step, k = Math.floor(f) % t.n, k2 = (k + 1) % t.n, u = f - Math.floor(f)
    const cx = (t.x[k]! + (t.x[k2]! - t.x[k]!) * u) * 2, cy = (t.y[k]! + (t.y[k2]! - t.y[k]!) * u) * 2
    g.save(); g.translate(cx, cy); g.rotate(t.ang[k]! + (slideFor > 0 ? Math.sin(time * 30) * 0.5 : 0))
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-11, -5, 22, 12)
    g.fillStyle = car.tint; g.beginPath(); g.roundRect(-11, -6, 22, 12, 4); g.fill()
    g.fillStyle = 'rgba(20,24,30,0.85)'; g.fillRect(-2, -5, 7, 10)
    g.restore()
    // Speed bar with the next bend's limit.
    let ahead = 400
    for (let d = 0; d <= 90; d += 6) ahead = Math.min(ahead, safeAt(t, s + d, car.grip))
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(16, 372, 608, 14)
    g.fillStyle = v > ahead ? '#f0616d' : '#2fc48d'; g.fillRect(16, 372, 608 * Math.min(1, v / 190), 14)
    if (ahead < 190) { g.fillStyle = '#fff'; g.fillRect(16 + 608 * (ahead / 190) - 1, 368, 3, 22) }
  }
  const tick = (now: number) => {
    if (!root.isConnected) return
    raf = requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now
    if (started && !over) {
      time += dt
      if (slideFor > 0) { slideFor -= dt; v = Math.max(COAST * 0.6, v - BRAKE * 1.4 * dt) }
      else {
        v = down ? Math.min(car.top, v + car.acc * dt) : Math.max(COAST, v - BRAKE * dt)
        if (v > safeAt(t, s, car.grip) * SLIDE_AT) { slideFor = 0.9; slides += 1; noteEl.textContent = 'Too fast into the bend: the car slid wide.' }
      }
      s += v * dt
      const lap = Math.floor(s / t.len)
      if (lap >= LAPS) { over = true; const msg = finish(time, slides); noteEl.textContent = msg; h.finish(`Raceway: ${msg}`); pedal.textContent = 'Drive again' }
      else lapEl.textContent = `Lap ${lap + 1} of ${LAPS}`
      timeEl.textContent = `${time.toFixed(2)} s`
    }
    draw()
  }
  const press = (on: boolean) => {
    if (on && over) { reset(); return }
    down = on
    if (on && !started) { started = true; v = COAST; noteEl.textContent = 'Lift off before the red bends, then back on the power.' }
  }
  for (const node of [pedal, cv]) {
    node.addEventListener('pointerdown', (e) => { e.preventDefault(); press(true) })
    node.addEventListener('pointerup', () => press(false)); node.addEventListener('pointercancel', () => press(false)); node.addEventListener('pointerleave', () => press(false))
  }
  const keyDown = (e: KeyboardEvent) => { if (!root.isConnected) { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); return } if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) press(true) } }
  const keyUp = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') press(false) }
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp)
  root.append(h.para('A five-lap time trial. Hold to accelerate, let go to brake. No bets and no prize money: you race the clock.'), picks, hud, cv, noteEl, pedal, info)
  if (cars.length === 1) root.append(h.para('Cars from the dealership are quicker than the club kart.', 'muted'))
  // Start drawing once the panel is in the page.
  requestAnimationFrame(() => { last = 0; raf = requestAnimationFrame(tick) })
  void raf
  return [root]
}
