// The trading floor's screens and seats: exchange-style crypto charts for the walls and desk monitors (candles,
// volume, moving averages, a market heat map, an order-book depth chart, a movers board, a ticker tape), and an
// ergonomic task chair. Everything is painted or built in code; prices on the walls are set dressing.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type G = CanvasRenderingContext2D
const FONT = '-apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
const UP = '#0ecb81', DOWN = '#f6465d', BG = '#0b0e11', GRID = 'rgba(255,255,255,0.055)', TEXT = '#eaecef', DIM = '#848e9c'
function rng(seed: number): () => number { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296 }
const fmt = (v: number) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 1 }) : v >= 1 ? v.toFixed(2) : v.toPrecision(3))

/** A full exchange chart: header with last price and change, candles with wicks, MA lines, volume, axes. */
export function paintCandles(g: G, w: number, h: number, o: { pair: string; price: number; seed: number; frame?: string; bars?: number; trend?: number }): void {
  const r = rng(o.seed), n = o.bars ?? 72, k = h / 512
  g.fillStyle = BG; g.fillRect(0, 0, w, h)
  // A believable walk: drift, clustered volatility, the odd impulse bar.
  const bars: Array<{ o: number; c: number; hi: number; lo: number; v: number }> = []
  let p = o.price * (1 - (o.trend ?? 0.04)), vol = 0.006
  for (let i = 0; i < n; i++) {
    vol = Math.max(0.003, Math.min(0.02, vol * (0.85 + r() * 0.34)))
    const open = p, move = (r() - 0.47 + (o.trend ?? 0.04) * 0.25) * vol * 2.4 * (r() < 0.07 ? 2.6 : 1)
    const close = open * (1 + move)
    bars.push({ o: open, c: close, hi: Math.max(open, close) * (1 + r() * vol * 0.8), lo: Math.min(open, close) * (1 - r() * vol * 0.8), v: (0.25 + r() * 0.75) * (1 + Math.abs(move) / vol) })
    p = close
  }
  const scale = o.price / p
  for (const b of bars) { b.o *= scale; b.c *= scale; b.hi *= scale; b.lo *= scale }
  const head = 64 * k, axis = 78 * k, volH = 74 * k, foot = 26 * k
  const x0 = 10 * k, x1 = w - axis, y0 = head + 8 * k, y1 = h - foot - volH - 8 * k
  const lo = Math.min(...bars.map((b) => b.lo)), hi = Math.max(...bars.map((b) => b.hi)), span = hi - lo || 1
  const X = (i: number) => x0 + ((i + 0.5) / n) * (x1 - x0), Y = (v: number) => y1 - ((v - lo) / span) * (y1 - y0)
  // Grid, price axis, time axis.
  g.strokeStyle = GRID; g.lineWidth = 1; g.font = `500 ${13 * k}px ${FONT}`; g.fillStyle = DIM; g.textAlign = 'left'; g.textBaseline = 'middle'
  for (let i = 0; i <= 5; i++) { const y = y0 + (i / 5) * (y1 - y0); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.fillText(fmt(hi - (i / 5) * span), x1 + 8 * k, y) }
  g.textAlign = 'center'
  for (let i = 0; i < 6; i++) { const x = x0 + ((i + 0.5) / 6) * (x1 - x0); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, h - foot); g.stroke(); g.fillText(`${String((9 + i * 3) % 24).padStart(2, '0')}:00`, x, h - foot / 2) }
  // Volume.
  const vmax = Math.max(...bars.map((b) => b.v)), bw = Math.max(2, ((x1 - x0) / n) * 0.62)
  bars.forEach((b, i) => { g.fillStyle = b.c >= b.o ? 'rgba(14,203,129,0.42)' : 'rgba(246,70,93,0.42)'; const vh = (b.v / vmax) * volH; g.fillRect(X(i) - bw / 2, h - foot - vh, bw, vh) })
  // Candles.
  bars.forEach((b, i) => {
    const up = b.c >= b.o; g.fillStyle = g.strokeStyle = up ? UP : DOWN; g.lineWidth = Math.max(1, 1.4 * k)
    g.beginPath(); g.moveTo(X(i), Y(b.hi)); g.lineTo(X(i), Y(b.lo)); g.stroke()
    g.fillRect(X(i) - bw / 2, Math.min(Y(b.o), Y(b.c)), bw, Math.max(1.5 * k, Math.abs(Y(b.o) - Y(b.c))))
  })
  // Moving averages.
  const ma = (len: number, col: string) => { g.strokeStyle = col; g.lineWidth = 1.6 * k; g.beginPath(); let on = false; for (let i = len - 1; i < n; i++) { let s = 0; for (let j = 0; j < len; j++) s += bars[i - j]!.c; const y = Y(s / len); if (on) g.lineTo(X(i), y); else { g.moveTo(X(i), y); on = true } } g.stroke() }
  ma(7, '#f0b90b'); ma(25, '#c26bd8')
  // Last price line and tag.
  const last = bars[n - 1]!, first = bars[0]!, chg = (last.c / first.o - 1) * 100, col = chg >= 0 ? UP : DOWN
  g.setLineDash([4 * k, 4 * k]); g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, Y(last.c)); g.lineTo(x1, Y(last.c)); g.stroke(); g.setLineDash([])
  g.fillStyle = col; g.fillRect(x1 + 2 * k, Y(last.c) - 10 * k, axis - 6 * k, 20 * k)
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = `600 ${13 * k}px ${FONT}`; g.fillText(fmt(last.c), x1 + 8 * k, Y(last.c))
  // Header.
  g.textBaseline = 'alphabetic'; g.fillStyle = TEXT; g.font = `700 ${26 * k}px ${FONT}`; g.fillText(o.pair, 14 * k, 34 * k)
  const pw = g.measureText(o.pair).width
  g.fillStyle = col; g.fillText(fmt(last.c), 30 * k + pw, 34 * k)
  const lw = g.measureText(fmt(last.c)).width
  g.font = `600 ${17 * k}px ${FONT}`; g.fillText(`${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`, 44 * k + pw + lw, 34 * k)
  g.fillStyle = DIM; g.font = `500 ${13 * k}px ${FONT}`
  g.fillText(`${o.frame ?? '15m'}   O ${fmt(last.o)}   H ${fmt(hi)}   L ${fmt(lo)}   C ${fmt(last.c)}   MA(7)  MA(25)   Vol`, 14 * k, 56 * k)
}

const COINS: Array<[string, number, number]> = [['BTC', 64280, 9], ['ETH', 3214, 6], ['SOL', 151.4, 4], ['BNB', 592, 3], ['XRP', 0.61, 2.4], ['DOGE', 0.152, 2], ['ADA', 0.46, 1.8], ['AVAX', 30.2, 1.6], ['LINK', 15.1, 1.5], ['DOT', 6.05, 1.3], ['TON', 6.8, 1.3], ['WIF', 2.12, 1], ['BONK', 0.00003, 0.9], ['NEAR', 5.4, 1.1], ['ARB', 0.94, 0.9], ['OP', 1.9, 0.9]]
const change = (r: () => number) => +((r() - 0.46) * 9).toFixed(2)

/** Market heat map: one tile per coin, sized by weight, green or red by the day's move. */
export function paintHeatmap(g: G, w: number, h: number, seed: number): void {
  const r = rng(seed)
  g.fillStyle = BG; g.fillRect(0, 0, w, h)
  g.fillStyle = TEXT; g.font = `700 ${h * 0.05}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('MARKET MAP · 24H', w * 0.02, h * 0.075)
  // Slice-and-dice layout: rows of decreasing height.
  const top = h * 0.1, rows: Array<Array<[string, number, number]>> = [COINS.slice(0, 2), COINS.slice(2, 5), COINS.slice(5, 10), COINS.slice(10, 16)]
  const heights = [0.36, 0.26, 0.2, 0.18]
  let y = top
  rows.forEach((row, ri) => {
    const rh = (h - top - 4) * heights[ri]!, total = row.reduce((s, c) => s + c[2], 0)
    let x = 4
    for (const [sym, , wt] of row) {
      const tw = ((w - 8) * wt) / total, c = change(r), a = Math.min(1, 0.28 + Math.abs(c) / 6)
      g.fillStyle = c >= 0 ? `rgba(14,150,98,${a})` : `rgba(200,52,72,${a})`
      g.fillRect(x + 2, y + 2, tw - 4, rh - 4)
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'
      const fs = Math.min(rh * 0.3, tw * 0.24)
      g.font = `700 ${fs}px ${FONT}`; g.fillText(sym, x + tw / 2, y + rh / 2 - fs * 0.35)
      g.font = `600 ${fs * 0.62}px ${FONT}`; g.fillText(`${c >= 0 ? '+' : ''}${c.toFixed(2)}%`, x + tw / 2, y + rh / 2 + fs * 0.55)
      x += tw
    }
    y += rh
  })
}

/** Order-book depth: bids build up to the left of the mid price, asks to the right. */
export function paintDepth(g: G, w: number, h: number, seed: number): void {
  const r = rng(seed), k = h / 384
  g.fillStyle = BG; g.fillRect(0, 0, w, h)
  g.fillStyle = TEXT; g.font = `700 ${22 * k}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('ORDER BOOK DEPTH · BTC/USDT', 14 * k, 34 * k)
  const y0 = 56 * k, y1 = h - 34 * k, mid = w / 2
  g.strokeStyle = GRID; for (let i = 0; i <= 4; i++) { const y = y0 + (i / 4) * (y1 - y0); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  const side = (dir: -1 | 1, col: string, fill: string) => {
    let depth = 0; const pts: Array<[number, number]> = [[mid, y1]]
    for (let i = 1; i <= 40; i++) { depth += r() * r() * 1.4 + 0.08; pts.push([mid + dir * (i / 40) * (mid - 8 * k), depth]) }
    const max = depth * 1.08
    g.beginPath(); g.moveTo(mid, y1)
    let py = y1
    for (const [x, dp] of pts.slice(1)) { const y = y1 - (dp / max) * (y1 - y0); g.lineTo(x, py); g.lineTo(x, y); py = y }
    g.lineTo(mid + dir * (mid - 8 * k), y1); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = col; g.lineWidth = 2 * k; g.stroke()
  }
  side(-1, UP, 'rgba(14,203,129,0.2)'); side(1, DOWN, 'rgba(246,70,93,0.2)')
  g.fillStyle = TEXT; g.font = `700 ${18 * k}px ${FONT}`; g.textAlign = 'center'; g.fillText('64,281.5', mid, y0 + 6 * k)
  g.fillStyle = DIM; g.font = `500 ${13 * k}px ${FONT}`
  for (const [t, x] of [['63,900', 0.12], ['64,100', 0.31], ['64,460', 0.69], ['64,660', 0.88]] as const) g.fillText(t, w * x, h - 12 * k)
  g.textAlign = 'left'; g.fillStyle = UP; g.fillText('BIDS', 14 * k, y0 + 6 * k); g.textAlign = 'right'; g.fillStyle = DOWN; g.fillText('ASKS', w - 14 * k, y0 + 6 * k)
}

/** Top movers board: symbol, price, 24h change and a sparkline per row. */
export function paintMovers(g: G, w: number, h: number, seed: number): void {
  const r = rng(seed), k = h / 384
  g.fillStyle = BG; g.fillRect(0, 0, w, h)
  g.fillStyle = TEXT; g.font = `700 ${22 * k}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('TOP MOVERS · 24H', 14 * k, 34 * k)
  g.fillStyle = DIM; g.font = `600 ${12 * k}px ${FONT}`
  g.fillText('PAIR', 14 * k, 60 * k); g.textAlign = 'right'; g.fillText('LAST', w * 0.52, 60 * k); g.fillText('24H', w * 0.72, 60 * k)
  const rows = COINS.slice(0, 9).map(([sym, price]) => ({ sym, price, c: change(r) })).sort((a, b) => b.c - a.c)
  rows.forEach((row, i) => {
    const y = (88 + i * 33) * k, col = row.c >= 0 ? UP : DOWN
    g.strokeStyle = GRID; g.beginPath(); g.moveTo(10 * k, y - 20 * k); g.lineTo(w - 10 * k, y - 20 * k); g.stroke()
    g.textAlign = 'left'; g.fillStyle = TEXT; g.font = `700 ${17 * k}px ${FONT}`; g.fillText(`${row.sym}/USDT`, 14 * k, y)
    g.textAlign = 'right'; g.font = `600 ${17 * k}px ${FONT}`; g.fillText(fmt(row.price), w * 0.52, y)
    g.fillStyle = col; g.fillText(`${row.c >= 0 ? '+' : ''}${row.c.toFixed(2)}%`, w * 0.72, y)
    g.strokeStyle = col; g.lineWidth = 1.8 * k; g.beginPath()
    let v = 0.5
    for (let j = 0; j < 18; j++) { v = Math.min(1, Math.max(0, v + (r() - 0.5 + row.c * 0.012) * 0.35)); const x = w * 0.77 + (j / 17) * w * 0.2, yy = y - 4 * k - v * 16 * k; if (j) g.lineTo(x, yy); else g.moveTo(x, yy) }
    g.stroke()
  })
}

/** Ticker tape: one long strip of pairs, prices and changes. Tiles horizontally. */
export function paintTicker(g: G, w: number, h: number, seed: number): void {
  const r = rng(seed)
  g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h)
  g.textBaseline = 'middle'; g.textAlign = 'left'
  let x = 14
  const fs = h * 0.5
  for (let i = 0; x < w - 40; i++) {
    const [sym, price] = COINS[i % COINS.length]!, c = change(r)
    g.font = `700 ${fs}px ${FONT}`; g.fillStyle = '#f0b90b'; g.fillText(sym, x, h / 2); x += g.measureText(sym).width + fs * 0.35
    g.font = `600 ${fs}px ${FONT}`; g.fillStyle = TEXT; g.fillText(fmt(price), x, h / 2); x += g.measureText(fmt(price)).width + fs * 0.35
    g.fillStyle = c >= 0 ? UP : DOWN; const t = `${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)}%`; g.fillText(t, x, h / 2); x += g.measureText(t).width + fs * 1.1
  }
}

/**
 * An ergonomic task chair facing -z: contoured seat, tall mesh back with a lumbar pad and a headrest, adjustable
 * arms, gas lift and a five-star base on casters. Two geometries (frame, upholstery) so a whole floor of them
 * is two instanced draw calls. The seat top is at 0.5 m.
 */
export function ergoChairGeometry(): { frame: THREE.BufferGeometry; pad: THREE.BufferGeometry } {
  const frame: THREE.BufferGeometry[] = [], pad: THREE.BufferGeometry[] = []
  const B = (list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); list.push(g) }
  // Base: five spokes with casters, gas lift, mechanism plate.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const spoke = new THREE.BoxGeometry(0.3, 0.028, 0.045).translate(0.15, 0.085, 0).rotateY(a); frame.push(spoke)
    frame.push(new THREE.SphereGeometry(0.03, 8, 6).translate(Math.cos(a) * 0.3, 0.03, -Math.sin(a) * 0.3))
  }
  frame.push(new THREE.CylinderGeometry(0.028, 0.034, 0.3, 10).translate(0, 0.24, 0))
  B(frame, 0.22, 0.04, 0.24, 0, 0.405, 0)
  // Seat: a pad with a waterfall front edge.
  B(pad, 0.5, 0.075, 0.44, 0, 0.462, 0.01)
  pad.push(new THREE.CylinderGeometry(0.0375, 0.0375, 0.5, 10).rotateZ(Math.PI / 2).translate(0, 0.462, -0.21))
  // Back: two uprights, a tall panel leaning back a little, lumbar pad, headrest on a neck.
  for (const sx of [-0.2, 0.2]) B(frame, 0.03, 0.66, 0.03, sx, 0.8, 0.265, 0.1)
  B(pad, 0.44, 0.58, 0.022, 0, 0.84, 0.25, 0.1)
  B(pad, 0.4, 0.13, 0.04, 0, 0.66, 0.222, 0.1)
  B(frame, 0.04, 0.16, 0.03, 0, 1.2, 0.3, 0.1)
  B(pad, 0.3, 0.13, 0.05, 0, 1.31, 0.3, 0.05)
  // Arms: post and pad each side.
  for (const sx of [-0.28, 0.28]) { B(frame, 0.03, 0.22, 0.04, sx, 0.57, 0.06); B(pad, 0.07, 0.028, 0.26, sx, 0.69, 0.0) }
  const clean = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; return n }))!
  return { frame: clean(frame), pad: clean(pad) }
}
