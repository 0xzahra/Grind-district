// "Night Market": the short film on Grind Cinema's screen, drawn frame by frame on a canvas (no video file to
// download). Thirty-six seconds, looping: a title card, the city at dusk, a lantern-lit night market, a phone that
// asks for a seed phrase (Ada knows better), a chase past the stalls, dawn on a rooftop, the end. Original story.

export const FILM_TITLE = 'Night Market'
export const FILM_SECONDS = 36

const FONT = '"Inter Variable", Inter, system-ui, sans-serif'
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const fade = (t: number, a: number, b: number, edge = 0.6) => clamp((t - a) / edge) * clamp((b - t) / edge)
/** A rounded rectangle path (without relying on roundRect, which older phones lack). */
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

function sky(g: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bottom)
  g.fillStyle = gr; g.fillRect(0, 0, w, h)
}
function skyline(g: CanvasRenderingContext2D, w: number, h: number, shift: number, seed: number, col: string, hi: number, lit: number, t: number) {
  let x = -((shift % 400) + 400) % 400 - 40, i = Math.floor(shift / 400) * 40
  while (x < w + 40) {
    const bw = 26 + rnd(seed + i) * 40, bh = hi * (0.35 + rnd(seed + i * 3) * 0.65)
    g.fillStyle = col; g.fillRect(x, h - bh, bw, bh)
    if (lit > 0) for (let wy = h - bh + 6; wy < h - 6; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 7) {
      const k = rnd(Math.floor(wx * 3 + wy * 7 + seed))
      if (k < lit) { g.fillStyle = k < lit * 0.15 && Math.sin(t * 3 + k * 40) > 0.7 ? '#fff6c8' : '#f2c46a'; g.fillRect(wx, wy, 3, 4) }
    }
    x += bw + 2; i++
  }
}
function figure(g: CanvasRenderingContext2D, x: number, y: number, s: number, phase: number, col = '#0b0b10', run = false) {
  const sw = Math.sin(phase) * (run ? 0.9 : 0.5)
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'
  g.beginPath(); g.arc(x, y - 30 * s, 6 * s, 0, Math.PI * 2); g.fill() // head (hood)
  g.beginPath(); g.moveTo(x - 7 * s, y - 24 * s); g.lineTo(x + 7 * s, y - 24 * s); g.lineTo(x + 6 * s, y - 8 * s); g.lineTo(x - 6 * s, y - 8 * s); g.closePath(); g.fill()
  g.lineWidth = 4 * s
  for (const k of [1, -1]) { g.beginPath(); g.moveTo(x, y - 9 * s); g.lineTo(x + sw * k * 9 * s, y); g.stroke() }
  g.lineWidth = 3 * s
  for (const k of [1, -1]) { g.beginPath(); g.moveTo(x, y - 22 * s); g.lineTo(x - sw * k * 8 * s, y - 13 * s); g.stroke() }
}
function caption(g: CanvasRenderingContext2D, w: number, h: number, text: string, a: number) {
  if (a <= 0.01) return
  g.globalAlpha = a; g.font = `600 ${Math.round(h * 0.068)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(text, w / 2, h * 0.9)
  g.fillStyle = '#ffffff'; g.fillText(text, w / 2, h * 0.9); g.globalAlpha = 1
}
function lanterns(g: CanvasRenderingContext2D, w: number, t: number, y0: number) {
  g.strokeStyle = '#2a2a30'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(w / 2, y0 + 22, w, y0); g.stroke()
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (w / 9), y = y0 + Math.sin((i + 0.5) / 9 * Math.PI) * 11 + 10, sw = Math.sin(t * 1.6 + i) * 3
    const glow = g.createRadialGradient(x + sw, y, 1, x + sw, y, 18); glow.addColorStop(0, 'rgba(255,170,60,0.55)'); glow.addColorStop(1, 'rgba(255,170,60,0)')
    g.fillStyle = glow; g.fillRect(x + sw - 18, y - 18, 36, 36)
    g.fillStyle = ['#ff5a3a', '#ffb13a', '#ff7a2a'][i % 3]!; g.beginPath(); g.ellipse(x + sw, y, 6, 8, 0, 0, Math.PI * 2); g.fill()
  }
}
function stalls(g: CanvasRenderingContext2D, w: number, h: number, shift: number) {
  const cols = ['#d63c3c', '#f2c230', '#2f7a58', '#3a5f8a', '#e07a2f']
  for (let i = -1; i < 7; i++) {
    const x = i * 90 - (shift % 90), k = Math.floor(shift / 90) + i
    g.fillStyle = '#1a1414'; g.fillRect(x + 8, h * 0.52, 74, h * 0.3)
    g.fillStyle = cols[((k % 5) + 5) % 5]!; g.beginPath(); g.moveTo(x, h * 0.52); g.lineTo(x + 90, h * 0.52); g.lineTo(x + 80, h * 0.44); g.lineTo(x + 10, h * 0.44); g.closePath(); g.fill()
    g.fillStyle = 'rgba(255,220,150,0.5)'; g.fillRect(x + 14, h * 0.56, 62, 10)
    for (let j = 0; j < 5; j++) { g.fillStyle = ['#f2c230', '#d63c3c', '#6aa84f'][(j + k) % 3]!; g.beginPath(); g.arc(x + 20 + j * 12, h * 0.6, 4, 0, Math.PI * 2); g.fill() }
  }
  g.fillStyle = '#2a2224'; g.fillRect(0, h * 0.82, w, h * 0.18)
}

/** Draw the frame for time `t` (seconds; the film loops) into a w × h canvas. */
export function filmFrame(g: CanvasRenderingContext2D, t0: number, w = 512, h = 216): void {
  const t = ((t0 % FILM_SECONDS) + FILM_SECONDS) % FILM_SECONDS
  g.save()
  if (t < 3) {
    g.fillStyle = '#050507'; g.fillRect(0, 0, w, h)
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.globalAlpha = fade(t, 0, 1.6, 0.4); g.fillStyle = '#b8b0a2'; g.font = `600 ${h * 0.07}px ${FONT}`; g.fillText('GRIND PICTURES PRESENTS', w / 2, h / 2)
    g.globalAlpha = fade(t, 1.5, 3.2, 0.4); g.fillStyle = '#ffd36b'; g.font = `900 ${h * 0.2}px ${FONT}`; g.fillText(FILM_TITLE.toUpperCase(), w / 2, h / 2)
  } else if (t < 10) {
    const k = t - 3
    sky(g, w, h, '#1b1440', '#ff8a4a')
    g.fillStyle = 'rgba(255,240,210,0.9)'; g.beginPath(); g.arc(w * 0.75, h * 0.42 + k * 3, h * 0.11, 0, Math.PI * 2); g.fill()
    skyline(g, w, h, k * 10, 3, '#3a2346', h * 0.75, 0, t)
    skyline(g, w, h, k * 24, 9, '#1d1226', h * 0.62, 0.25 * clamp(k / 3), t)
    skyline(g, w, h, k * 46, 17, '#0a0710', h * 0.42, 0.35 * clamp(k / 2), t)
    caption(g, w, h, 'The city never sleeps. Neither do the scammers.', fade(t, 4, 10))
  } else if (t < 17) {
    const k = t - 10
    sky(g, w, h, '#06070f', '#1a1028')
    skyline(g, w, h, 40 + k * 6, 21, '#0d0a16', h * 0.55, 0.3, t)
    stalls(g, w, h, k * 18)
    lanterns(g, w, t, h * 0.12)
    figure(g, w * 0.18 + k * 30, h * 0.82, 1.25, t * 7)
    caption(g, w, h, 'Ada: "Someone here sold my cousin a fake wallet."', fade(t, 10.6, 17))
  } else if (t < 23) {
    const k = t - 17
    g.fillStyle = '#120d18'; g.fillRect(0, 0, w, h)
    const glow = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.5); glow.addColorStop(0, 'rgba(90,140,255,0.35)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, h)
    // the phone in a hand
    const px = w / 2 - h * 0.22, py = h * 0.08, pw = h * 0.44, ph = h * 0.84
    g.fillStyle = '#7a4a30'; g.beginPath(); g.ellipse(w / 2 + pw * 0.45, h * 0.8, pw * 0.5, h * 0.22, -0.3, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#16161a'; rr(g, px, py, pw, ph, 12); g.fill()
    g.fillStyle = '#f4f6fa'; rr(g, px + 5, py + 8, pw - 10, ph - 16, 8); g.fill()
    g.textAlign = 'left'; g.textBaseline = 'top'; g.font = `600 ${h * 0.05}px ${FONT}`
    const msgs: Array<[number, string, string]> = [[0.4, 'Support: your wallet is locked', '#e8ecf4'], [1.6, 'Send your seed phrase to unlock', '#e8ecf4'], [3.0, 'Ada: Nice try.', '#c8f5dc']]
    msgs.forEach(([at, m, bg], i) => { if (k < at) return; const y = py + 18 + i * h * 0.17; g.fillStyle = bg; rr(g, px + 10, y, pw - 20, h * 0.13, 6); g.fill(); g.fillStyle = '#20242c'; g.fillText(m, px + 14, y + 6, pw - 28) })
    if (k > 3.8) { g.save(); g.translate(w / 2, h * 0.62); g.rotate(-0.18); g.globalAlpha = clamp((k - 3.8) * 4); g.strokeStyle = '#e0242a'; g.lineWidth = 4; g.strokeRect(-62, -20, 124, 40); g.fillStyle = '#e0242a'; g.font = `900 ${h * 0.13}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SCAM', 0, 2); g.restore() }
    caption(g, w, h, 'Ada: "Nobody real ever asks for your seed phrase."', fade(t, 18.5, 23))
  } else if (t < 30) {
    const k = t - 23, shake = Math.sin(t * 40) * 1.5
    g.translate(shake, 0)
    sky(g, w, h, '#05060c', '#140d1c')
    stalls(g, w, h, k * 120)
    lanterns(g, w, t, h * 0.1)
    // speed lines and a scooter's headlight sweeping in from the left
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1
    for (let i = 0; i < 14; i++) { const y = rnd(i) * h * 0.8 + 10, x = ((rnd(i + 9) * w - k * 600) % w + w) % w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 60, y); g.stroke() }
    figure(g, w * 0.62, h * 0.82, 1.3, t * 14, '#0b0b10', true)
    const sx = -80 + k * 70
    const beam = g.createLinearGradient(sx, 0, sx + 160, 0); beam.addColorStop(0, 'rgba(255,250,210,0.5)'); beam.addColorStop(1, 'rgba(255,250,210,0)')
    g.fillStyle = beam; g.beginPath(); g.moveTo(sx + 20, h * 0.72); g.lineTo(sx + 180, h * 0.55); g.lineTo(sx + 180, h * 0.92); g.closePath(); g.fill()
    g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(sx, h * 0.84, 9, 0, Math.PI * 2); g.arc(sx + 30, h * 0.84, 9, 0, Math.PI * 2); g.fill(); g.fillRect(sx - 4, h * 0.72, 36, 12)
    caption(g, w, h, 'Ada: "Not tonight."', fade(t, 24, 30))
  } else if (t < 34) {
    const k = t - 30
    sky(g, w, h, '#3a5a8a', '#ffc88a')
    g.fillStyle = '#fff2c8'; g.beginPath(); g.arc(w * 0.5, h * 0.78 - k * 8, h * 0.14, 0, Math.PI * 2); g.fill()
    skyline(g, w, h, 120, 33, '#5a4a6a', h * 0.5, 0, t)
    g.fillStyle = '#1a1420'; g.fillRect(0, h * 0.8, w, h * 0.2)
    figure(g, w * 0.4, h * 0.8, 1.2, 0, '#1a1420'); figure(g, w * 0.47, h * 0.8, 1.1, 0.4, '#1a1420')
    caption(g, w, h, 'Ada: "Stay curious. Stay safe."', fade(t, 30.4, 34))
  } else {
    g.fillStyle = '#050507'; g.fillRect(0, 0, w, h)
    g.globalAlpha = fade(t, 34, 36.5, 0.5); g.fillStyle = '#ffd36b'; g.font = `900 ${h * 0.14}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('THE END', w / 2, h * 0.45)
    g.fillStyle = '#b8b0a2'; g.font = `600 ${h * 0.055}px ${FONT}`; g.fillText('A Grind Pictures short', w / 2, h * 0.62)
  }
  g.restore()
  // film grain flicker
  g.fillStyle = `rgba(255,255,255,${0.02 + rnd(Math.floor(t0 * 12)) * 0.02})`; g.fillRect(0, 0, w, h)
}
