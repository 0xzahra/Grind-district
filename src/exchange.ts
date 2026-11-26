// The trading screen: Spot, Perps and Convert on one clean card. One asset in focus at a time with a big price,
// a simple line chart and a single order ticket; the market list sits underneath. Practice prices only.
import { COINS, COIN_CATEGORIES, RANKS, SKILL_META, TOKEN_IDS, cents, coinPrice, formatQty, money, rankFor, seasonAt, seasonLabel, type Holding, type RankId, type SkillId } from './logic.ts'
import { lockReason } from './worlds.ts'
import { addReputation, balanceSplit, convertCoin, earnCash, getSave, stakeCoin, trade, tradeCoin, unstakeCoin } from './state.ts'
import { MAX_STAKES, MIN_STAKE_USD, STAKE_PLANS, accrued, canStake, isLocked, planApr, unlockAt, type Stake, type StakePlan } from './staking.ts'
import { LEVERAGE, MAX_PERPS, closePerp, liqPrice, markPrice, openPerp, perpCash, perpPnl, perps, sweepPerps, type Perp } from './perps.ts'
import { hourly, hourlyBars, liveAt, liveChange, livePrice, wantFast } from './livePrices.ts'
import { barsFromSeries, candleChart, type CandleView } from './candleChart.ts'
import { renderDefi } from './defi.ts'
import { sharePnl } from './pnlCard.ts'
import { STABLES, stableAccrued, stableApr, stableLocked, stableStakes, stakeStable, unstakeStable, type StableId } from './stableEarn.ts'

type Asset = { id: string; sym: string; name: string; tint: string; group: string; minRank: RankId; desk?: 'unit' | 'meme' }
const TINT: Record<string, string> = { btc: '#f7931a', eth: '#7b8fe8', sol: '#19c9a0', xrp: '#8a96a3', link: '#3d6fe6', near: '#00c08b', sui: '#4da2ff', avax: '#e84142', dot: '#e6007a', doge: '#c9a93a', shib: '#e8761c', pepe: '#4c9a2a', wif: '#b98a5e', bonk: '#f5a623', ada: '#2a6bd4', ltc: '#9aa7b8', bch: '#4cc95a', uni: '#ff3d8b', aave: '#9b6fd6', atom: '#6f7390', arb: '#2d9cdb', op: '#ff3b3b', apt: '#3ccfa8', fil: '#1f8fdc', xlm: '#8fa0b3', hbar: '#5a5a5a', icp: '#f0a43a', etc: '#3ab83a', pol: '#8247e5', inj: '#14b8e6' }
// The game has Coins and Tokens, nothing else. A coin is the money of its own chain (BTC, ETH, SOL, and the
// listed coins); a token is issued on top of one (LINK, the Meme Token and the other meme tokens).
const listed = COINS.map((c): Asset => ({ id: c.id, sym: c.label.split(' · ')[0]!, name: c.label.split(' · ')[1] ?? c.label, tint: TINT[c.id] ?? '#9aa3ad', group: TOKEN_IDS.has(c.id) ? 'Tokens' : 'Coins', minRank: c.minRank }))
const ASSETS: Asset[] = [
  ...listed.filter((a) => a.group === 'Coins'),
  { id: 'meme', sym: 'MEME', name: 'Meme Token', tint: '#8fd0a6', group: 'Tokens', minRank: 'shrimp', desk: 'meme' },
  ...listed.filter((a) => a.group === 'Tokens'),
]
type Offer = { name: string; trades: number; rate: number; spread: number; pay: string; verified?: boolean; trap?: 'third' | 'offsite' | 'fake'; release?: string; since?: string; limit?: [number, number] }
// Sellers you can buy from, and buyers you can sell to. Verified merchants passed the platform's ID and address
// checks and keep a deposit; the sharks are new accounts quoting a price that is too good.
const BUY_OFFERS: Offer[] = [
  { name: 'AdaTrades', trades: 2140, rate: 99.2, spread: 0, pay: 'Bank transfer', verified: true, release: '3 min', since: '2022', limit: [10, 5000] },
  { name: 'KanoDesk', trades: 870, rate: 98.1, spread: 0, pay: 'Bank transfer', verified: true, release: '6 min', since: '2023', limit: [20, 2500] },
  { name: 'AccraBridge', trades: 1312, rate: 98.9, spread: 0.002, pay: 'Bank transfer · mobile money', verified: true, release: '4 min', since: '2021', limit: [5, 3000] },
  { name: 'QuickFlip99', trades: 14, rate: 71, spread: -0.03, pay: 'Bank transfer', trap: 'third' },
  { name: 'CheapCoinz', trades: 6, rate: 60, spread: -0.05, pay: 'WhatsApp deal', trap: 'offsite' },
]
const SELL_OFFERS: Offer[] = [
  { name: 'LagosOTC', trades: 3120, rate: 99.5, spread: 0, pay: 'Bank transfer', verified: true, release: '2 min', since: '2020', limit: [10, 10000] },
  { name: 'ZeeMerchant', trades: 640, rate: 97.8, spread: 0, pay: 'Bank transfer', verified: true, release: '7 min', since: '2023', limit: [15, 2000] },
  { name: 'NairobiNode', trades: 905, rate: 98.6, spread: -0.002, pay: 'Bank transfer · mobile money', verified: true, release: '5 min', since: '2022', limit: [5, 4000] },
  { name: 'FastPay_01', trades: 9, rate: 66, spread: 0.04, pay: 'Bank transfer', trap: 'fake' },
]
// P2P is mostly crypto to local money and back: merchants quote, and you pay or get paid, in the fiat picked here.
// The game's own cash stays in-game dollars; this converts at the live rate (Coinbase), an estimate otherwise.
const FIATS = [
  { id: 'NGN', sym: '₦', name: 'Nigerian naira' }, { id: 'GHS', sym: 'GH₵', name: 'Ghanaian cedi' }, { id: 'KES', sym: 'KSh ', name: 'Kenyan shilling' },
  { id: 'ZAR', sym: 'R', name: 'South African rand' }, { id: 'USD', sym: '$', name: 'US dollar' }, { id: 'EUR', sym: '€', name: 'Euro' }, { id: 'GBP', sym: '£', name: 'British pound' },
  { id: 'XOF', sym: 'CFA ', name: 'West African CFA franc' }, { id: 'XAF', sym: 'FCFA ', name: 'Central African CFA franc' }, { id: 'EGP', sym: 'E£', name: 'Egyptian pound' },
  { id: 'MAD', sym: 'DH ', name: 'Moroccan dirham' }, { id: 'UGX', sym: 'USh ', name: 'Ugandan shilling' }, { id: 'TZS', sym: 'TSh ', name: 'Tanzanian shilling' },
  { id: 'RWF', sym: 'FRw ', name: 'Rwandan franc' }, { id: 'ETB', sym: 'Br ', name: 'Ethiopian birr' }, { id: 'ZMW', sym: 'ZK ', name: 'Zambian kwacha' },
  { id: 'AED', sym: 'AED ', name: 'UAE dirham' }, { id: 'SAR', sym: 'SAR ', name: 'Saudi riyal' }, { id: 'TRY', sym: '₺', name: 'Turkish lira' },
  { id: 'INR', sym: '₹', name: 'Indian rupee' }, { id: 'PKR', sym: 'Rs ', name: 'Pakistani rupee' }, { id: 'BDT', sym: '৳', name: 'Bangladeshi taka' },
  { id: 'IDR', sym: 'Rp ', name: 'Indonesian rupiah' }, { id: 'MYR', sym: 'RM ', name: 'Malaysian ringgit' }, { id: 'PHP', sym: '₱', name: 'Philippine peso' },
  { id: 'VND', sym: '₫', name: 'Vietnamese dong' }, { id: 'CNY', sym: '¥', name: 'Chinese yuan' }, { id: 'JPY', sym: '¥', name: 'Japanese yen' },
  { id: 'CAD', sym: 'C$', name: 'Canadian dollar' }, { id: 'AUD', sym: 'A$', name: 'Australian dollar' }, { id: 'BRL', sym: 'R$', name: 'Brazilian real' },
  { id: 'MXN', sym: 'MX$', name: 'Mexican peso' }, { id: 'ARS', sym: 'AR$', name: 'Argentine peso' }, { id: 'CHF', sym: 'CHF ', name: 'Swiss franc' },
] as const
type FiatId = (typeof FIATS)[number]['id']
// Fallback rates (an estimate until the live rates load).
const fiatRates: Record<string, number> = { NGN: 1357, GHS: 11.8, KES: 130, ZAR: 17.5, USD: 1, EUR: 0.91, GBP: 0.76, XOF: 600, XAF: 600, EGP: 48.5, MAD: 9.9, UGX: 3700, TZS: 2650, RWF: 1380, ETB: 125, ZMW: 26, AED: 3.67, SAR: 3.75, TRY: 34, INR: 84, PKR: 280, BDT: 120, IDR: 15800, MYR: 4.5, PHP: 57, VND: 25400, CNY: 7.2, JPY: 150, CAD: 1.37, AUD: 1.53, BRL: 5.6, MXN: 19.5, ARS: 1000, CHF: 0.88 }
let fiatLive = false, fiatAt = 0
function loadFiat(): void {
  if (Date.now() - fiatAt < 600_000) return
  fiatAt = Date.now()
  void fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json()).then((j: { data?: { rates?: Record<string, string> } }) => { for (const f of FIATS) { const v = Number(j.data?.rates?.[f.id]); if (v > 0) { fiatRates[f.id] = v; fiatLive = true } } })
    .catch(() => undefined)
}
const homeFiat = (): FiatId => {
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return '' } })()
  const byZone: Record<string, FiatId> = { 'Africa/Lagos': 'NGN', 'Africa/Accra': 'GHS', 'Africa/Nairobi': 'KES', 'Africa/Johannesburg': 'ZAR', 'Europe/London': 'GBP', 'Africa/Dakar': 'XOF', 'Africa/Abidjan': 'XOF', 'Africa/Douala': 'XAF', 'Africa/Cairo': 'EGP', 'Africa/Casablanca': 'MAD', 'Africa/Kampala': 'UGX', 'Africa/Dar_es_Salaam': 'TZS', 'Africa/Kigali': 'RWF', 'Africa/Addis_Ababa': 'ETB', 'Africa/Lusaka': 'ZMW', 'Asia/Dubai': 'AED', 'Asia/Riyadh': 'SAR', 'Europe/Istanbul': 'TRY', 'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR', 'Asia/Karachi': 'PKR', 'Asia/Dhaka': 'BDT', 'Asia/Jakarta': 'IDR', 'Asia/Kuala_Lumpur': 'MYR', 'Asia/Manila': 'PHP', 'Asia/Ho_Chi_Minh': 'VND', 'Asia/Shanghai': 'CNY', 'Asia/Tokyo': 'JPY', 'America/Toronto': 'CAD', 'Australia/Sydney': 'AUD', 'America/Sao_Paulo': 'BRL', 'America/Mexico_City': 'MXN', 'America/Argentina/Buenos_Aires': 'ARS', 'Europe/Zurich': 'CHF' }
  return byZone[tz] ?? (tz.startsWith('Europe/') ? 'EUR' : 'USD')
}
let p2pFiat: FiatId = (() => { try { const v = localStorage.getItem('gd.p2p.fiat'); return FIATS.some((f) => f.id === v) ? v as FiatId : homeFiat() } catch { return homeFiat() } })()
/** In-game dollars shown in the picked fiat: ₦573,120 or $422.49. */
const fiatMoney = (usd: number): string => {
  const f = FIATS.find((x) => x.id === p2pFiat) ?? FIATS[4]
  const v = usd * (fiatRates[f.id] ?? 1)
  if (v >= 100000) return `${f.sym}${Math.round(v).toLocaleString('en-US')}`
  return `${f.sym}${v.toLocaleString('en-US', { minimumFractionDigits: v >= 1000 ? 0 : 2, maximumFractionDigits: v >= 1000 ? 0 : 2 })}`
}
const CASH: Asset = { id: 'usd', sym: 'USD', name: 'Cash', tint: '#5fae7d', group: '', minRank: 'shrimp' }
const asset = (id: string): Asset => (id === 'usd' ? CASH : ASSETS.find((a) => a.id === id) ?? ASSETS[0]!)
const priceOf = (a: Asset): number => { const s = getSave(); return a.id === 'usd' ? 1 : a.desk === 'unit' ? s.unitPrice : a.desk === 'meme' ? s.memePrice : markPrice(a.id) }
const holdingOf = (a: Asset): Holding => { const s = getSave(); return a.id === 'usd' ? { qty: s.ledger, avg: 1 } : a.desk === 'unit' ? s.unit : a.desk === 'meme' ? s.meme : s.coins[a.id] ?? { qty: 0, avg: 0 } }
const locked = (a: Asset): boolean => RANKS.findIndex((r) => r.id === a.minRank) > RANKS.findIndex((r) => r.id === rankFor(getSave().xp).id)
const rankLabel = (a: Asset): string => RANKS.find((r) => r.id === a.minRank)!.label
/** Short money for tight rows: no cents from $1,000, three significant digits under $1. */
const short = (v: number): string => (Math.abs(v) >= 1000 ? `$${Math.round(v).toLocaleString('en-US')}` : Math.abs(v) >= 1 || v === 0 ? money(v) : `$${v.toPrecision(3)}`)
const shortSigned = (v: number): string => `${v >= 0 ? '+' : '-'}${short(Math.abs(v))}`
const pct = (v: number): string => `${v >= 0 ? '+' : '-'}${Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(1)}%`
const signed = (v: number): string => `${v >= 0 ? '+' : '-'}${money(Math.abs(v))}`
const dir = (v: number): string => (v >= 0 ? 'up' : 'down')

// ---- price tape for the listed coins: the save keeps only their latest price, so the chart keeps its own ----
const TAPE = 72
const tape = new Map<string, number[]>()
let taping = 0
function startTape(): void {
  if (taping) return
  for (const c of COINS) {
    // Lead-in: a walk back from the current price at the coin's own volatility, so the chart is never empty.
    const vol = COIN_CATEGORIES.find((k) => k.id === c.cat)!.vol * 80
    let seed = [...c.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) || 1
    const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296)
    const list = [markPrice(c.id)]
    for (let i = 1; i < TAPE; i++) list.unshift(Math.min(c.base * 4, Math.max(c.base * 0.2, list[0]! / (1 + (rnd() - 0.5) * 2 * vol))))
    tape.set(c.id, list)
  }
  taping = window.setInterval(() => { for (const c of COINS) { const list = tape.get(c.id)!; list.push(markPrice(c.id)); if (list.length > TAPE) list.shift() } }, 1500)
}
// Listed coins chart the real market: the last 48 hourly closes (livePrices.ts) and the price now; the 24-hour
// change is the real one. The Meme Token is the city's own and keeps its practice tape.
const isLive = (a: Asset): boolean => !a.desk && a.id !== 'usd' && livePrice(a.id) !== undefined
const series = (a: Asset): number[] => { const s = getSave(); if (a.desk === 'unit') return s.unitHist; if (a.desk === 'meme') return s.memeHist; const h48 = isLive(a) ? hourly(a.id) : []; return h48.length > 6 ? h48 : tape.get(a.id) ?? [] }
const change = (a: Asset): number => { const real = isLive(a) ? liveChange(a.id) : undefined; if (real !== undefined) return real; const s = series(a); const first = s[0] ?? priceOf(a); return first > 0 ? (priceOf(a) / first - 1) * 100 : 0 }
// Line or candles: the player's pick, kept on this device (not in the save).
const CHART_KEY = 'gd.xch.chart'
let chartMode: 'line' | 'candles' = (() => { try { return localStorage.getItem(CHART_KEY) === 'candles' ? 'candles' : 'line' } catch { return 'line' } })()
const ago = (t: number): string => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago` }

// Chart sizes come from a ResizeObserver, so a repaint never forces a layout to read the canvas size.
const chartSize = new WeakMap<HTMLCanvasElement, { w: number; h: number }>()
const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
  for (const e of entries) { const r = e.contentRect; if (r.width > 0) chartSize.set(e.target as HTMLCanvasElement, { w: r.width, h: r.height }) }
}) : null
/** A tiny chart for a market row: the last 48 hours where the live market is loaded, the practice tape otherwise. */
const sparkSig = new WeakMap<HTMLCanvasElement, string>()
function sparkline(cv: HTMLCanvasElement, hist: readonly number[], now: number, up: boolean): void {
  const data = [...hist.slice(-48), now].filter((v) => Number.isFinite(v) && v > 0)
  const sig = `${data.length}:${data[0]}:${now}`
  if (sparkSig.get(cv) === sig || data.length < 2) return
  sparkSig.set(cv, sig)
  const g = cv.getContext('2d'); if (!g) return
  const W = cv.width, H = cv.height, lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1
  g.clearRect(0, 0, W, H)
  g.beginPath()
  data.forEach((v, i) => { const x = (i / (data.length - 1)) * (W - 4) + 2, y = H - 4 - ((v - lo) / span) * (H - 8); if (i) g.lineTo(x, y); else g.moveTo(x, y) })
  g.strokeStyle = up ? '#21c98a' : '#ef5a5a'; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke()
}
function drawChart(cv: HTMLCanvasElement, data: number[], up: boolean): void {
  if (!cv.isConnected) return
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  let size = chartSize.get(cv)
  if (!size) { size = { w: cv.clientWidth || 320, h: cv.clientHeight || 132 }; chartSize.set(cv, size); sizer?.observe(cv) }
  const w = size.w, hgt = size.h
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hgt * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr) }
  const g = cv.getContext('2d')
  if (!g || data.length < 2) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, hgt)
  const min = Math.min(...data), max = Math.max(...data), span = Math.max(max - min, max * 1e-6, 1e-12)
  const X = (i: number) => 2 + (i / (data.length - 1)) * (w - 12), Y = (v: number) => 10 + (1 - (v - min) / span) * (hgt - 24)
  const col = up ? '#2fc48d' : '#f0616d'
  const path = () => { g.beginPath(); data.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))) }
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1; g.setLineDash([3, 5])
  g.beginPath(); g.moveTo(0, Y(data[0]!)); g.lineTo(w, Y(data[0]!)); g.stroke(); g.setLineDash([])
  const fill = g.createLinearGradient(0, 0, 0, hgt)
  fill.addColorStop(0, up ? 'rgba(47,196,141,0.26)' : 'rgba(240,97,109,0.24)'); fill.addColorStop(1, 'rgba(0,0,0,0)')
  path(); g.lineTo(X(data.length - 1), hgt); g.lineTo(X(0), hgt); g.closePath(); g.fillStyle = fill; g.fill()
  path(); g.strokeStyle = col; g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke()
  const lx = X(data.length - 1), ly = Y(data[data.length - 1]!)
  g.fillStyle = col; g.globalAlpha = 0.22; g.beginPath(); g.arc(lx, ly, 7, 0, Math.PI * 2); g.fill()
  g.globalAlpha = 1; g.beginPath(); g.arc(lx, ly, 3.2, 0, Math.PI * 2); g.fill()
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text) n.textContent = text
  return n
}
const icon = (a: Asset): HTMLElement => { const n = h('span', 'xch-ico', a.id === 'usd' ? '$' : a.sym[0]); n.style.setProperty('--tint', a.tint); return n }

export function renderExchange(desk: 'unit' | 'meme', hooks: { finish: (message: string, rankedUp?: RankId) => void }): { el: HTMLElement; paint: () => void } {
  startTape()
  const root = h('div', 'xch')
  let tab: 'spot' | 'perps' | 'convert' | 'p2p' | 'stake' | 'defi' = 'spot'
  wantFast()
  let live: Array<() => void> = []
  // What each tab has selected; kept while the screen is open so switching tabs loses nothing.
  // District Coin is no longer listed (only a sell-all for anyone who still holds some): open on Bitcoin instead.
  let spotId: string = desk === 'unit' ? 'btc' : desk, spotSide: 'buy' | 'sell' = 'buy', spotFrac = 0.5, plan = false
  let spotCustom: number | null = null, spotQuery = ''
  let perpId = 'btc', perpSide: 'long' | 'short' = 'long', perpLev = 5, perpFrac = 0.25
  let convFrom = 'usd', convTo = 'btc', convFrac = 0.5
  let stakeId = 'eth', stakePlan: StakePlan = 'd7', stakeFrac = 0.5
  let stableCoin: StableId = 'usdc', stablePlan: StakePlan = 'flex', stableFrac = 0.25
  let p2pDesk = false
  let p2pSide: 'buy' | 'sell' = 'buy', p2pCoin = 'btc', p2pFrac = 0.25, p2pOrder: { offer: Offer; stage: 'open' | 'bank' | 'releasing' } | null = null
  const paintNow = () => { for (const f of live) f() }
  // Candle charts made for the pane on screen; dropped whenever the pane is rebuilt or the screen closes.
  let charts: CandleView[] = []
  const dropCharts = () => { for (const c of charts) c.destroy(); charts = [] }

  const segmented = (labels: string[], active: number, pick: (i: number) => void, cls = '') => {
    const wrap = h('div', `xch-seg ${cls}`.trim())
    wrap.setAttribute('role', 'tablist')
    labels.forEach((label, i) => {
      const b = h('button', '', label)
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(i === active))
      b.onclick = () => { for (const c of wrap.children) c.setAttribute('aria-selected', 'false'); b.setAttribute('aria-selected', 'true'); pick(i) }
      wrap.append(b)
    })
    return wrap
  }
  const row = (label: string, control: HTMLElement) => { const r = h('div', 'xch-row'); r.append(h('span', 'xch-label', label), control); return r }
  const chips = (list: Asset[], active: string, pick: (a: Asset) => void) => {
    const strip = h('div', 'xch-chips')
    for (const a of list) {
      const b = h('button', 'xch-chip')
      b.type = 'button'; b.append(icon(a), h('span', '', a.sym)); b.setAttribute('aria-pressed', String(a.id === active)); b.dataset.q = `${a.sym} ${a.name}`.toLowerCase()
      if (locked(a)) b.classList.add('locked')
      b.onclick = () => pick(a)
      strip.append(b)
    }
    // Bring the chosen asset into view without moving the page.
    requestAnimationFrame(() => { const on = strip.querySelector<HTMLElement>('[aria-pressed="true"]'); if (on) strip.scrollLeft = Math.max(0, on.offsetLeft - 16) })
    return strip
  }
  const quote = (a: Asset, title: string, sub: string) => {
    const wrap = h('div', 'xch-quote')
    const head = h('div', 'xch-qhead'), names = h('div', 'xch-names')
    names.append(h('b', '', title), h('small', '', sub))
    head.append(icon(a), names)
    const price = h('div', 'xch-price'), chg = h('div', 'xch-chg'), canvas = h('canvas', 'xch-chart'), stamp = h('p', 'xch-live')
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${a.sym} recent price`)
    // Line or TradingView-style candles: one small switch beside the price.
    const frame = h('div', 'xch-chartbox')
    const credit = h('a', 'xch-tv', 'Chart by TradingView')
    credit.href = 'https://www.tradingview.com/'; credit.target = '_blank'; credit.rel = 'noopener'
    let candles: CandleView | null = null
    const setMode = () => {
      canvas.hidden = chartMode !== 'line'
      if (chartMode === 'candles' && !candles) { candles = candleChart(); charts.push(candles); frame.append(candles.el) }
      if (candles) candles.el.hidden = chartMode !== 'candles'
      frame.dataset.mode = chartMode
      credit.hidden = chartMode !== 'candles'
    }
    const modes = segmented(['Line', 'Candles'], chartMode === 'line' ? 0 : 1, (i) => {
      chartMode = i ? 'candles' : 'line'
      try { localStorage.setItem(CHART_KEY, chartMode) } catch { /* private mode */ }
      setMode(); paintNow()
    }, 'chartmode')
    const priceRow = h('div', 'xch-pricerow'), priceCol = h('div')
    priceCol.append(price, chg)
    priceRow.append(priceCol, modes)
    frame.append(canvas)
    setMode()
    wrap.append(head, priceRow, frame, credit, stamp)
    live.push(() => {
      const d = change(a), real = isLive(a), p = priceOf(a)
      price.textContent = coinPrice(p)
      chg.textContent = `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(2)}% ${real ? '24h' : 'recent'}`
      chg.dataset.dir = dir(d)
      if (chartMode === 'line') drawChart(canvas, [...series(a), p], d >= 0)
      else if (candles) { const real48 = real ? hourlyBars(a.id) : []; candles.set(real48.length > 6 ? real48 : barsFromSeries([...series(a), p]), p) }
      stamp.textContent = real ? `● Live market price · Coinbase · updated ${ago(liveAt())}. You trade it with in-game money only.` : a.desk ? 'The city\'s own token: a practice market.' : 'Live prices are loading. Showing practice prices.'
      stamp.dataset.live = String(real)
    })
    return wrap
  }
  const tile = (label: string) => { const t = h('div', 'xch-tile'), v = h('b'), s = h('small'); t.append(h('span', '', label), v, s); return { t, v, s } }
  const preview = (labels: string[]) => {
    const box = h('dl', 'xch-preview')
    const values = labels.map((label) => { const dt = h('dt', '', label), dd = h('dd'); box.append(dt, dd); return dd })
    return { box, values }
  }
  const cta = (cls: string) => { const b = h('button', `xch-go ${cls}`); b.type = 'button'; return b }
  const note = (text: string) => h('p', 'xch-note', text)
  /** The courses behind a tab: each opens on Campus and keeps its usual lock. */
  const courses = (ids: SkillId[]) => {
    const box = h('div', 'xch-learn')
    box.append(h('h3', 'xch-group', 'Learn this desk'))
    for (const id of ids) {
      const passed = !!getSave().skills[id]?.passed, lock = passed ? '' : lockReason(id)
      const b = h('button', 'xch-course'), names = h('div', 'xch-names')
      b.type = 'button'
      names.append(h('b', '', SKILL_META[id].title), h('small', '', passed ? 'Passed · on your CV' : lock || 'Course · tap to start'))
      b.append(h('span', `xch-badge${passed ? ' ok' : lock ? ' lock' : ''}`, passed ? '✓' : lock ? '🔒' : '›'), names)
      b.onclick = () => { if (!lock) window.dispatchEvent(new CustomEvent('gd:course', { detail: id })) }
      box.append(b)
    }
    return box
  }
  const result = h('p', 'xch-result')
  result.setAttribute('role', 'status')
  const done = (r: { ok: boolean; message: string; rankedUp?: RankId }, rebuild = false) => {
    result.textContent = r.message
    result.dataset.ok = String(r.ok)
    hooks.finish(r.message, r.rankedUp)
    if (rebuild) show(); else paintNow()
  }

  // ------------------------------- PORTFOLIO -------------------------------
  // Every position at a glance when Trade opens: what you hold, what you paid, what it is worth now and the
  // open profit or loss, plus open perps. Tap a row to focus that asset. Numbers repaint with the prices.
  const portfolio = () => {
    const card = h('section', 'xch-port')
    card.setAttribute('aria-label', 'Your portfolio')
    const top = h('div', 'xch-port-top'), totals = h('div', 'xch-port-totals')
    const total = h('b', 'xch-port-total'), sub = h('small', 'xch-port-sub'), pnlAll = h('div', 'xch-port-pnl')
    totals.append(h('span', 'xch-label', 'Portfolio value'), total, sub)
    top.append(totals, pnlAll)
    const mix = h('div', 'xch-port-mix')
    const rows = h('div', 'xch-port-rows')
    const shareAll = h('button', 'xch-share', 'Share my P&L') as HTMLButtonElement; shareAll.type = 'button'; shareAll.hidden = true
    let lastAll = { pnl: 0, cost: 0 }
    shareAll.onclick = () => sharePnl({ title: 'My portfolio', sub: 'Open positions · practice', tint: '#17a862', pct: lastAll.cost > 0 ? lastAll.pnl / lastAll.cost * 100 : 0, usd: lastAll.pnl }, (m) => hooks.finish(m))
    card.append(top, mix, rows, shareAll)
    type Pos = { key: string; a: Asset; qty: number; avg: number; perp?: Perp; stake?: Stake }
    const positions = (): Pos[] => {
      const out: Pos[] = []
      for (const a of ASSETS) { const hd = holdingOf(a); if (hd.qty > 0) out.push({ key: a.id, a, qty: hd.qty, avg: hd.avg }) }
      if (getSave().unit.qty > 0) out.push({ key: 'unit', a: { id: 'unit', sym: 'DIST', name: 'District Coin', tint: '#d9b26a', group: '', minRank: 'shrimp', desk: 'unit' }, qty: getSave().unit.qty, avg: getSave().unit.avg })
      for (const p of perps()) out.push({ key: `perp:${p.id}`, a: asset(p.coin), qty: p.margin * p.lev / p.entry, avg: p.entry, perp: p })
      for (const st of getSave().stakes ?? []) out.push({ key: `stake:${st.id}`, a: asset(st.coin), qty: st.qty, avg: st.avg, stake: st })
      return out
    }
    let shape = '\u0000'
    let painters: Array<() => { value: number; pnl: number; cost: number }> = []
    const build = (list: Pos[]) => {
      rows.replaceChildren(); painters = []
      if (!list.length) {
        rows.append(h('p', 'xch-port-empty', 'No positions yet. Buy any coin below and it shows up here with its live profit or loss.'))
        return
      }
      const headRow = h('div', 'xch-port-row head')
      headRow.append(h('span', '', 'Holding'), h('span', '', 'Price'), h('span', '', 'Value · P/L'))
      rows.append(headRow)
      for (const ps of list) {
        const r = h('button', 'xch-port-row'), who = h('div', 'xch-names'), mid = h('div', 'xch-port-mid'), end = h('div', 'xch-port-end')
        r.type = 'button'
        const name = h('b', '', ps.perp ? `${ps.a.sym} ${ps.perp.side === 'long' ? 'Long' : 'Short'} ${ps.perp.lev}x` : ps.stake ? `${ps.a.sym} Staked` : ps.a.sym)
        const size = h('small'), px = h('b'), entry = h('small'), val = h('b'), pl = h('small')
        who.append(name, size); mid.append(px, entry); end.append(val, pl)
        const ic = icon(ps.a)
        r.append(ic, who, mid, end)
        if (ps.perp) r.dataset.perp = ps.perp.side
        r.onclick = () => {
          if (ps.perp) { perpId = ps.a.id; tab = 'perps'; root.querySelectorAll<HTMLElement>('.xch-seg.tabs button').forEach((b, i) => b.setAttribute('aria-selected', String(i === 1))) }
          else if (ps.stake) { stakeId = ps.a.id; tab = 'stake'; root.querySelectorAll<HTMLElement>('.xch-seg.tabs button').forEach((b, i) => b.setAttribute('aria-selected', String(i === 4))) }
          else if (ps.a.id !== 'unit') spotId = ps.a.id
          result.textContent = ''; show(); root.closest('.sheet-card')?.scrollTo({ top: 0, behavior: 'smooth' })
        }
        rows.append(r)
        painters.push(() => {
          const p = ps.a.desk === 'unit' ? getSave().unitPrice : priceOf(ps.a)
          if (ps.perp) {
            const pnl = perpPnl(ps.perp, p), value = Math.max(0, ps.perp.margin + pnl)
            size.textContent = `${money(ps.perp.margin)} margin · ${formatQty(ps.qty)}`
            px.textContent = short(p); entry.textContent = `in ${short(ps.avg)}`
            val.textContent = short(value)
            pl.textContent = `${shortSigned(pnl)} ${pct(pnl / ps.perp.margin * 100)}`; pl.dataset.dir = dir(pnl)
            return { value, pnl, cost: ps.perp.margin }
          }
          const value = (ps.qty + (ps.stake ? accrued(ps.stake) : 0)) * p, cost = ps.qty * ps.avg, pnl = value - cost
          size.textContent = `${formatQty(ps.qty)} ${ps.a.sym}${ps.stake ? ` · ${STAKE_PLANS[ps.stake.plan].label}` : ''}`
          px.textContent = short(p); entry.textContent = `in ${short(ps.avg)}`
          val.textContent = short(value)
          pl.textContent = `${shortSigned(pnl)} ${pct(cost > 0 ? pnl / cost * 100 : 0)}`; pl.dataset.dir = dir(pnl)
          return { value, pnl, cost }
        })
      }
    }
    live.push(() => {
      const list = positions()
      const next = list.map((p) => p.key).join('|')
      if (next !== shape) { shape = next; build(list) }
      let held = 0, pnl = 0, cost = 0
      const parts: Array<{ tint: string; v: number }> = []
      painters.forEach((f, i) => { const r = f(); held += r.value; pnl += r.pnl; cost += r.cost; parts.push({ tint: list[i]?.a.tint ?? '#9aa3ad', v: r.value }) })
      const cash = getSave().ledger
      total.textContent = money(cash + held)
      sub.textContent = `Cash ${short(cash)} · In positions ${short(held)}`
      pnlAll.replaceChildren(h('span', 'xch-label', 'Open P/L'), h('b', '', list.length ? signed(pnl) : '$0.00'), h('small', '', list.length && cost > 0 ? `${pnl >= 0 ? '+' : ''}${(pnl / cost * 100).toFixed(2)}%` : '—'))
      pnlAll.dataset.dir = list.length ? dir(pnl) : ''
      lastAll = { pnl, cost }; shareAll.hidden = !list.length || cost <= 0
      // Allocation bar: cash plus each position, in its coin's colour.
      const sum = cash + held
      mix.replaceChildren(...[{ tint: '#5fae7d', v: cash }, ...parts].filter((x) => x.v > 0 && sum > 0).map((x) => { const seg = h('i'); seg.style.flexGrow = String(x.v / sum); seg.style.background = x.tint; return seg }))
    })
    return card
  }

  // ------------------------------- SPOT -------------------------------
  const spot = () => {
    const a = asset(spotId)
    const pane = h('div', 'xch-pane')
    // Search: type a name or symbol and the coin keys and the market list below narrow as you type.
    const search = h('input', 'xch-search') as HTMLInputElement
    search.type = 'search'; search.placeholder = `Search ${ASSETS.length} coins and tokens (name or symbol)`; search.setAttribute('aria-label', 'Search coins'); search.value = spotQuery
    const strip = chips(ASSETS, spotId, (x) => { spotId = x.id; result.textContent = ''; show() })
    const filter = () => {
      const q = spotQuery.trim().toLowerCase()
      for (const n of pane.querySelectorAll<HTMLElement>('[data-q]')) n.hidden = !!q && !(n.dataset.q ?? '').includes(q)
      for (const g of pane.querySelectorAll<HTMLElement>('.xch-list h3.xch-group')) { let n = g.nextElementSibling as HTMLElement | null, any = false; while (n && !n.matches('h3')) { if (!n.hidden) any = true; n = n.nextElementSibling as HTMLElement | null } g.hidden = !any }
    }
    search.oninput = () => { spotQuery = search.value; filter() }
    pane.append(portfolio(), search, strip, quote(a, a.name, a.sym))
    requestAnimationFrame(filter)
    if (locked(a)) pane.append(note(`${a.sym} opens at ${rankLabel(a)}. Keep climbing the ladder to trade it.`))
    else {
      const tiles = h('div', 'xch-tiles'), cash = tile('Cash'), held = tile(`${a.sym} held`), pnl = tile('Open P&L')
      tiles.append(cash.t, held.t, pnl.t)
      const shareCoin = h('button', 'xch-share', `Share my ${a.sym} P&L`) as HTMLButtonElement; shareCoin.type = 'button'; shareCoin.hidden = true
      shareCoin.onclick = () => { const hd = holdingOf(a), p = priceOf(a); if (hd.qty <= 0 || hd.avg <= 0) return; sharePnl({ title: a.sym, sub: `${a.name} · Spot, bought and held`, tint: a.tint, pct: (p / hd.avg - 1) * 100, entry: hd.avg, mark: p, usd: (p - hd.avg) * hd.qty }, (m) => hooks.finish(m)) }
      const ticket = h('div', 'xch-ticket')
      const sell = spotSide === 'sell'
      const pv = preview(sell ? ['You sell', 'You get'] : ['You pay', 'You get'])
      const go = cta(sell ? 'sell' : 'buy')
      // Or type an exact amount: dollars when buying (the coin you get shows as you type), the coin when selling
      // (the dollars you get show as you type). The 25 / 50 / Max keys clear it.
      const custom = h('input', 'xch-amount') as HTMLInputElement
      custom.type = 'number'; custom.inputMode = 'decimal'; custom.min = '0'; custom.step = 'any'
      custom.placeholder = sell ? `Or type ${a.sym}, e.g. 0.01` : 'Or type dollars, e.g. 25'
      custom.setAttribute('aria-label', sell ? `Amount of ${a.sym} to sell` : 'Dollars to spend')
      const fracs = segmented(['25%', '50%', 'Max'], spotCustom === null ? [0.25, 0.5, 1].indexOf(spotFrac) : -1, (i) => { spotFrac = [0.25, 0.5, 1][i]!; spotCustom = null; custom.value = ''; paintNow() }, 'amt')
      if (spotCustom !== null) custom.value = String(spotCustom)
      custom.oninput = () => { const v = Number(custom.value); spotCustom = custom.value.trim() && Number.isFinite(v) && v > 0 ? v : null; fracs.querySelectorAll('[aria-selected]').forEach((b) => b.setAttribute('aria-selected', 'false')); paintNow() }
      ticket.append(
        segmented(['Buy', 'Sell'], sell ? 1 : 0, (i) => { spotSide = i ? 'sell' : 'buy'; spotCustom = null; show() }, 'side'),
        row(sell ? 'Amount of your holding' : 'Amount of your cash', fracs),
        custom,
        pv.box,
      )
      if (a.desk && sell) {
        const label = h('label', 'xch-check'), box = h('input')
        box.type = 'checkbox'; box.checked = plan; box.onchange = () => { plan = box.checked }
        label.append(box, h('span', '', 'I sized this on purpose (a logged plan counts on the ladder)'))
        ticket.append(label)
      }
      ticket.append(go)
      // The share of your cash (buy) or holding (sell) this ticket is for: a key, or the typed amount.
      const share = (): number => {
        const s = getSave(), hd = holdingOf(a)
        if (spotCustom === null) return spotFrac
        const total = sell ? hd.qty : s.ledger
        return total > 0 ? Math.min(1, spotCustom / total) : 0
      }
      go.onclick = () => { const f = share(); if (f <= 0) return; done(a.desk ? trade(a.desk, spotSide, f, plan) : tradeCoin(a.id, spotSide, f)) }
      live.push(() => {
        const s = getSave(), hd = holdingOf(a), p = priceOf(a)
        cash.v.textContent = money(s.ledger)
        held.v.textContent = hd.qty > 0 ? formatQty(hd.qty) : '0'
        held.s.textContent = hd.qty > 0 ? money(hd.qty * p) : ''
        const open = hd.qty > 0 ? (p - hd.avg) * hd.qty : 0
        pnl.v.textContent = hd.qty > 0 ? signed(open) : '$0.00'
        pnl.v.dataset.dir = hd.qty > 0 ? dir(open) : ''
        pnl.s.textContent = hd.qty > 0 ? `avg ${coinPrice(hd.avg)}` : ''
        shareCoin.hidden = !(hd.qty > 0 && hd.avg > 0)
        const over = spotCustom !== null && spotCustom > (sell ? hd.qty : s.ledger) + 1e-9
        if (sell) {
          const qty = hd.qty * share()
          pv.values[0]!.textContent = `${formatQty(qty)} ${a.sym}`
          pv.values[1]!.textContent = `≈ ${money(qty * p)}`
          go.textContent = over ? `You hold ${formatQty(hd.qty)} ${a.sym}` : `Sell ${a.sym}`
          go.disabled = !(hd.qty > 0) || over || qty <= 0
        } else {
          const pay = cents(s.ledger * share())
          pv.values[0]!.textContent = money(pay)
          pv.values[1]!.textContent = `≈ ${formatQty(p > 0 ? pay / p : 0)} ${a.sym}`
          go.textContent = over ? `You have ${money(s.ledger)}` : `Buy ${a.sym}`
          go.disabled = pay < 1 || over
        }
      })
      pane.append(tiles, shareCoin, ticket, result)
      if (a.desk) pane.append(note(a.desk === 'unit' ? `${seasonLabel(seasonAt())} season. A plan logged on the sell can count when the close is red.` : `${seasonLabel(seasonAt())} season. A meme token is attention. Size small. Rank will not follow a crash.`))
      else if (COINS.find((c) => c.id === a.id)?.cat === 'big') pane.append(note('Big caps reward patience: each buy adds reputation.'))
    }
    // Markets: every listed asset with its price, recent change and what you hold.
    const list = h('div', 'xch-list')
    let group = ''
    for (const m of ASSETS) {
      if (m.group !== group) { group = m.group; list.append(h('h3', 'xch-group', group)) }
      const item = h('button', 'xch-item'), names = h('div', 'xch-names'), nums = h('div', 'xch-nums'), price = h('b'), chg = h('small')
      item.dataset.q = `${m.sym} ${m.name}`.toLowerCase()
      item.type = 'button'
      names.append(h('b', '', m.name), h('small', '', m.sym))
      nums.append(price, chg)
      const spark = h('canvas', 'xch-spark') as HTMLCanvasElement
      spark.width = 120; spark.height = 44; spark.setAttribute('aria-hidden', 'true')
      item.append(icon(m), names, spark, nums)
      if (m.id === spotId) item.setAttribute('aria-current', 'true')
      item.onclick = () => { spotId = m.id; result.textContent = ''; show(); root.closest('.sheet-card')?.scrollTo({ top: 0, behavior: 'smooth' }) }
      const lock = locked(m)
      live.push(() => {
        const hd = holdingOf(m), p = priceOf(m), d = change(m)
        price.textContent = coinPrice(p)
        chg.textContent = lock ? `Opens at ${rankLabel(m)}` : `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(2)}%${hd.qty > 0 ? ` · ${money(hd.qty * p)} held` : ''}`
        chg.dataset.dir = lock ? '' : dir(d)
        sparkline(spark, isLive(m) ? hourly(m.id) : series(m), p, d >= 0)
      })
      list.append(item)
    }
    // District Coin was delisted: anyone still holding some can sell it all at its last price, once.
    if (getSave().unit.qty > 0) {
      const card = h('div', 'xch-delisted'), go = cta('sell')
      go.textContent = 'Sell all District Coin'
      go.onclick = () => done(trade('unit', 'sell', 1, false), true)
      card.append(h('p', 'xch-note', `District Coin is delisted. You still hold ${formatQty(getSave().unit.qty)} (about ${money(getSave().unit.qty * getSave().unitPrice)}): sell it back to cash.`), go)
      pane.append(card)
    }
    pane.append(list, courses(['spot', 'risk', 'memes']))
    return pane
  }

  // ------------------------------- PERPS -------------------------------
  const perpsPane = () => {
    const coins = ASSETS.filter((a) => !a.desk)
    const a = asset(perpId)
    const pane = h('div', 'xch-pane')
    pane.append(chips(coins, perpId, (x) => { perpId = x.id; result.textContent = ''; show() }), quote(a, `${a.name} perpetual`, `${a.sym}-PERP · mark price`))
    if (locked(a)) pane.append(note(`${a.sym}-PERP opens at ${rankLabel(a)}.`))
    else {
      const ticket = h('div', 'xch-ticket')
      const pv = preview(['Margin', 'Position size', 'Entry price', 'Liquidation price'])
      const go = cta(perpSide)
      ticket.append(
        segmented(['Long', 'Short'], perpSide === 'long' ? 0 : 1, (i) => { perpSide = i ? 'short' : 'long'; show() }, 'side'),
        row('Leverage', segmented(LEVERAGE.map((l) => `${l}x`), LEVERAGE.indexOf(perpLev as (typeof LEVERAGE)[number]), (i) => { perpLev = LEVERAGE[i]!; paintNow() }, 'amt')),
        row('Margin, of earned cash', segmented(['10%', '25%', '50%'], [0.1, 0.25, 0.5].indexOf(perpFrac), (i) => { perpFrac = [0.1, 0.25, 0.5][i]!; paintNow() }, 'amt')),
        pv.box, go,
      )
      go.onclick = () => done(openPerp(a.id, perpSide, perpLev, perpFrac), true)
      live.push(() => {
        const margin = cents(perpCash() * perpFrac), entry = priceOf(a)
        pv.values[0]!.textContent = money(margin)
        pv.values[1]!.textContent = money(margin * perpLev)
        pv.values[2]!.textContent = coinPrice(entry)
        pv.values[3]!.textContent = coinPrice(liqPrice({ side: perpSide, lev: perpLev, entry }))
        go.textContent = `Open ${perpSide} · ${a.sym}-PERP`
        go.disabled = margin < 1
      })
      pane.append(ticket, result)
    }
    // Open positions, marked live.
    const book = h('div', 'xch-book')
    let shown = ''
    const rows = new Map<string, { pnl: HTMLElement; mark: HTMLElement }>()
    const build = (list: Perp[]) => {
      rows.clear()
      book.replaceChildren(h('h3', 'xch-group', `Open positions${list.length ? ` · ${list.length}/${MAX_PERPS}` : ''}`))
      if (!list.length) { book.append(note('No open positions. Pick a market, a side and a leverage above.')); return }
      for (const p of list) {
        const m = asset(p.coin), card = h('div', 'xch-pos'), top = h('div', 'xch-pos-top'), names = h('div', 'xch-names'), pnl = h('b', 'xch-pnl'), grid = h('dl', 'xch-preview'), mark = h('dd')
        names.append(h('b', '', `${m.sym}-PERP`), h('small', `xch-tag ${p.side}`, `${p.side === 'long' ? 'Long' : 'Short'} ${p.lev}x`))
        top.append(icon(m), names, pnl)
        grid.append(h('dt', '', 'Size'), h('dd', '', money(p.margin * p.lev)), h('dt', '', 'Margin'), h('dd', '', money(p.margin)), h('dt', '', 'Entry'), h('dd', '', coinPrice(p.entry)), h('dt', '', 'Mark'), mark, h('dt', '', 'Liquidation'), h('dd', '', coinPrice(liqPrice(p))))
        const close = h('button', 'xch-close', 'Close position')
        close.type = 'button'
        close.onclick = () => done(closePerp(p.id), true)
        const sharePos = h('button', 'xch-share', 'Share P&L') as HTMLButtonElement; sharePos.type = 'button'
        sharePos.onclick = () => { const mk = priceOf(m), pl = perpPnl(p, mk); sharePnl({ title: `${m.sym}-PERP`, sub: `${p.side === 'long' ? 'Long' : 'Short'} ${p.lev}x · perpetual`, tint: m.tint, pct: p.margin > 0 ? pl / p.margin * 100 : 0, entry: p.entry, mark: mk, usd: pl }, (msg) => hooks.finish(msg)) }
        card.append(top, grid, sharePos, close)
        book.append(card)
        rows.set(p.id, { pnl, mark })
      }
    }
    live.push(() => {
      for (const m of sweepPerps()) hooks.finish(m)
      const list = perps(), ids = list.map((p) => p.id).join()
      if (ids !== shown || !book.childElementCount) { shown = ids; build(list) }
      for (const p of list) {
        const r = rows.get(p.id), v = perpPnl(p)
        if (!r) continue
        r.pnl.textContent = `${signed(v)} (${v >= 0 ? '+' : '-'}${Math.abs((v / p.margin) * 100).toFixed(1)}%)`
        r.pnl.dataset.dir = dir(v)
        r.mark.textContent = coinPrice(markPrice(p.coin))
      }
    })
    pane.append(book, note('Practice perpetuals. Margin comes from earned in-game cash only, never from a top-up. A position is liquidated when its loss reaches its margin. Open positions are kept on this device.'), courses(['risk', 'moneyPaths']))
    return pane
  }

  // ------------------------------- CONVERT -------------------------------
  const convertPane = () => {
    const options = [CASH, ...ASSETS.filter((a) => !a.desk)]
    const from = asset(convFrom), to = asset(convTo)
    const pane = h('div', 'xch-pane')
    const picker = (label: string, value: string, skip: string, pick: (id: string) => void) => {
      const box = h('label', 'xch-box'), sel = h('select'), amount = h('b', 'xch-amount'), sub = h('small')
      for (const o of options) { if (o.id === skip) continue; const opt = h('option', '', `${o.sym} · ${o.name}`); opt.value = o.id; opt.disabled = locked(o); sel.append(opt) }
      sel.value = value
      sel.onchange = () => pick(sel.value)
      const line = h('div', 'xch-pick')
      line.append(icon(asset(value)), sel)
      box.append(h('span', 'xch-label', label), line, amount, sub)
      return { box, amount, sub }
    }
    const a = picker('From', convFrom, convTo, (id) => { convFrom = id; show() })
    const b = picker('To', convTo, convFrom, (id) => { convTo = id; show() })
    const swap = h('button', 'xch-swap', '⇅')
    swap.type = 'button'; swap.setAttribute('aria-label', 'Swap from and to')
    swap.onclick = () => { [convFrom, convTo] = [convTo, convFrom]; show() }
    const pv = preview(['Rate', 'Fee'])
    const go = cta('convert')
    go.onclick = () => done(convertCoin(convFrom, convTo, convFrac))
    const ticket = h('div', 'xch-ticket')
    ticket.append(a.box, swap, b.box, row(`Amount of your ${from.sym}`, segmented(['25%', '50%', 'Max'], [0.25, 0.5, 1].indexOf(convFrac), (i) => { convFrac = [0.25, 0.5, 1][i]!; paintNow() }, 'amt')), pv.box, go)
    live.push(() => {
      const have = holdingOf(from).qty, pf = priceOf(from), pt = priceOf(to)
      const qty = from.id === 'usd' ? cents(have * convFrac) : have * convFrac
      const value = qty * pf
      a.amount.textContent = from.id === 'usd' ? money(qty) : `${formatQty(qty)} ${from.sym}`
      a.sub.textContent = from.id === 'usd' ? `Cash ${money(have)}` : `You hold ${formatQty(have)} ${from.sym} · ${money(have * pf)}`
      b.amount.textContent = to.id === 'usd' ? `≈ ${money(value)}` : `≈ ${formatQty(pt > 0 ? value / pt : 0)} ${to.sym}`
      b.sub.textContent = to.id === 'usd' ? `Cash ${money(holdingOf(to).qty)}` : `You hold ${formatQty(holdingOf(to).qty)} ${to.sym}`
      const rate = pt > 0 ? pf / pt : 0
      pv.values[0]!.textContent = `1 ${from.sym} ≈ ${to.id === 'usd' ? coinPrice(rate) : `${rate >= 100 ? rate.toLocaleString('en-US', { maximumFractionDigits: 0 }) : Number(rate.toPrecision(4))} ${to.sym}`}`
      pv.values[1]!.textContent = 'None on the practice book'
      go.textContent = `Convert ${from.sym} to ${to.sym}`
      go.disabled = value < 1
    })
    pane.append(ticket, result, note('Converting (a swap) changes one asset straight into another at the current practice prices.'), courses(['stables', 'liquidity', 'defi']))
    return pane
  }

  // ------------------------------- STAKE -------------------------------
  // Practice staking (src/staking.ts): lock a coin you hold on a plan and earn more of it. In-game coins only.
  const stakePane = () => {
    const list = ASSETS.filter((x) => canStake(x.id))
    if (!canStake(stakeId)) stakeId = list.find((x) => holdingOf(x).qty > 0)?.id ?? 'eth'
    const a = asset(stakeId)
    const pane = h('div', 'xch-pane')
    const learn = h('div', 'xch-stake-learn')
    learn.append(h('b', '', 'What is staking?'), h('p', '', 'On proof-of-stake chains, coins you lock help secure the network, and it pays you new coins for it. In real life your coins can be locked for days, a validator\'s mistake can cost part of the stake ("slashing"), and the rates change. Here it is practice, with in-game coins only.'))
    pane.append(learn, chips(list, stakeId, (x) => { stakeId = x.id; result.textContent = ''; show() }))
    if (locked(a)) { pane.append(note(`${a.sym} opens at ${rankLabel(a)}. Keep climbing the ladder to stake it.`)) }
    else {
      const days = (d: number) => `${d} game day${d === 1 ? '' : 's'} (${d} real hour${d === 1 ? '' : 's'})`
      const plans: StakePlan[] = ['flex', 'd7', 'd30']
      const pv = preview(['You stake', 'Est. APR', 'Est. reward', 'Unlocks'])
      const go = cta('buy')
      go.onclick = () => done(stakeCoin(stakeId, stakeFrac, stakePlan), true)
      const ticket = h('div', 'xch-ticket')
      ticket.append(
        row('Plan', segmented(plans.map((p) => `${STAKE_PLANS[p].label} · ${planApr(stakeId, p)}%`), plans.indexOf(stakePlan), (i) => { stakePlan = plans[i]!; paintNow() }, 'amt stake-plan')),
        row(`Amount of your ${a.sym}`, segmented(['25%', '50%', 'Max'], [0.25, 0.5, 1].indexOf(stakeFrac), (i) => { stakeFrac = [0.25, 0.5, 1][i]!; paintNow() }, 'amt')),
        pv.box, go,
      )
      live.push(() => {
        const have = holdingOf(a).qty, px = priceOf(a), qty = stakeFrac >= 1 ? have : have * stakeFrac
        const plan = STAKE_PLANS[stakePlan], apr = planApr(stakeId, stakePlan)
        const reward = qty * apr / 100 * (plan.days || 7) / 365
        pv.values[0]!.textContent = `${formatQty(qty)} ${a.sym} · ${money(qty * px)}`
        pv.values[1]!.textContent = `~${apr}% a year (estimate)`
        pv.values[2]!.textContent = `≈ ${formatQty(reward)} ${a.sym} ${plan.days ? `after ${plan.days} game days` : 'per game week'}`
        pv.values[3]!.textContent = plan.days ? `After ${days(plan.days)}` : 'Any time'
        const count = getSave().stakes?.length ?? 0
        go.textContent = have <= 0 ? `Buy ${a.sym} on Spot to stake it` : count >= MAX_STAKES ? `Up to ${MAX_STAKES} stakes at once` : `Stake ${a.sym}`
        go.disabled = have <= 0 || qty * px < MIN_STAKE_USD || count >= MAX_STAKES
      })
      pane.append(ticket, result)
    }
    // Stablecoins: your in-game dollars as USDC or USDT, earning a lending yield (no chain to secure, no slashing).
    {
      const plans: StakePlan[] = ['flex', 'd7', 'd30']
      const card = h('div', 'xch-ticket xch-stable')
      const sPv = preview(['You stake', 'Est. APR', 'Est. reward'])
      const sGo = cta('buy')
      sGo.onclick = () => done(stakeStable(stableCoin, stableFrac, stablePlan), true)
      card.append(
        h('h3', 'xch-group', 'Stablecoins · USDC · USDT'),
        note('Stablecoins are not staked to secure a chain: platforms pay a yield for lending them out ("earn" or savings). The risks are the platform and the peg, not slashing. Uses earned in-game cash only.'),
        row('Coin', segmented(STABLES.map((x) => x.sym), STABLES.findIndex((x) => x.id === stableCoin), (i) => { stableCoin = STABLES[i]!.id; show() }, 'amt')),
        row('Plan', segmented(plans.map((p) => `${STAKE_PLANS[p].label} · ${stableApr(stableCoin, p)}%`), plans.indexOf(stablePlan), (i) => { stablePlan = plans[i]!; paintNow() }, 'amt stake-plan')),
        row('Amount of your earned cash', segmented(['25%', '50%', 'Max'], [0.25, 0.5, 1].indexOf(stableFrac), (i) => { stableFrac = [0.25, 0.5, 1][i]!; paintNow() }, 'amt')),
        sPv.box, sGo,
      )
      const mine = h('div', 'xch-stable-list')
      const rowsS = new Map<string, HTMLElement>()
      for (const st of stableStakes()) {
        const r = h('div', 'xch-pos'), top = h('div', 'xch-pos-top'), names = h('div', 'xch-names'), earned = h('b', 'xch-pnl')
        names.append(h('b', '', `${money(st.qty)} ${st.coin.toUpperCase()}`), h('small', `xch-tag ${st.plan === 'flex' ? 'long' : 'short'}`, `${STAKE_PLANS[st.plan].label} · ${st.apr}%`))
        top.append(names, earned)
        const btn = h('button', 'xch-close'); btn.type = 'button'
        btn.textContent = st.plan === 'flex' ? 'Unstake and claim' : stableLocked(st) ? 'Unstake early (lose the reward)' : 'Claim and unstake'
        btn.onclick = () => done(unstakeStable(st.id), true)
        r.append(top, btn); mine.append(r); rowsS.set(st.id, earned)
      }
      card.append(mine)
      live.push(() => {
        const earnedCash = balanceSplit().earned, qty = Math.floor(earnedCash * stableFrac * 100) / 100
        const plan = STAKE_PLANS[stablePlan], apr = stableApr(stableCoin, stablePlan)
        sPv.values[0]!.textContent = `${money(qty)} of ${stableCoin.toUpperCase()}`
        sPv.values[1]!.textContent = `~${apr}% a year (estimate)`
        sPv.values[2]!.textContent = `≈ ${money(qty * apr / 100 * (plan.days || 7) / 365)} ${plan.days ? `after ${plan.days} game days` : 'per game week'}`
        sGo.textContent = qty < 1 ? 'Earn $1 in the city to stake it' : `Stake ${stableCoin.toUpperCase()}`
        sGo.disabled = qty < 1
        for (const st of stableStakes()) { const e = rowsS.get(st.id); if (e) { e.textContent = `+${money(stableAccrued(st))}`; e.dataset.dir = 'up' } }
      })
      pane.append(card)
    }
    // Active stakes, with what each has earned so far.
    const book = h('div', 'xch-book')
    let shown = '\u0000'
    const rows = new Map<string, { earned: HTMLElement; status: HTMLElement; btn: HTMLButtonElement }>()
    const left = (ms: number) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m` }
    const build = (stakes: Stake[]) => {
      rows.clear()
      book.replaceChildren(h('h3', 'xch-group', `Your stakes${stakes.length ? ` · ${stakes.length}/${MAX_STAKES}` : ''}`))
      if (!stakes.length) { book.append(note('No stakes yet. Pick a coin you hold, a plan and an amount above.')); return }
      for (const st of stakes) {
        const m = asset(st.coin), card = h('div', 'xch-pos'), top = h('div', 'xch-pos-top'), names = h('div', 'xch-names'), earned = h('b', 'xch-pnl'), grid = h('dl', 'xch-preview'), status = h('dd')
        names.append(h('b', '', `${m.sym} staked`), h('small', `xch-tag ${st.plan === 'flex' ? 'long' : 'short'}`, `${STAKE_PLANS[st.plan].label} · ${st.apr}%`))
        top.append(icon(m), names, earned)
        grid.append(h('dt', '', 'Staked'), h('dd', '', `${formatQty(st.qty)} ${m.sym}`), h('dt', '', 'Status'), status)
        const btn = h('button', 'xch-close')
        btn.type = 'button'
        btn.onclick = () => done(unstakeCoin(st.id), true)
        card.append(top, grid, btn)
        book.append(card)
        rows.set(st.id, { earned, status, btn })
      }
    }
    live.push(() => {
      const stakes = getSave().stakes ?? [], ids = stakes.map((x) => x.id).join()
      if (ids !== shown) { shown = ids; build(stakes) }
      const now = Date.now()
      for (const st of stakes) {
        const r = rows.get(st.id)
        if (!r) continue
        const sym = asset(st.coin).sym, got = accrued(st, now), lock = isLocked(st, now)
        r.earned.textContent = `+${formatQty(got)} ${sym}`
        r.earned.dataset.dir = 'up'
        r.earned.title = `≈ ${money(got * priceOf(asset(st.coin)))}`
        r.status.textContent = st.plan === 'flex' ? 'Flexible · leave any time' : lock ? `Locked · opens in ${left(unlockAt(st) - now)}` : 'Lock ended · ready to claim'
        r.btn.textContent = st.plan === 'flex' ? 'Unstake and claim' : lock ? 'Unstake early (lose the reward)' : 'Claim and unstake'
      }
    })
    pane.append(book, note(`Rewards are paid in the same coin, in-game only. One real hour is one game day. A locked plan earns until its lock ends; leaving early gives the coins back without the reward. Rates are estimates and stay fixed for each stake. Nothing here is real money.`), courses(['staking', 'risk']))
    return pane
  }

  // ------------------------------- P2P -------------------------------
  // Practice peer-to-peer: pick a merchant, the coin sits in escrow, money moves bank to bank, escrow releases.
  // Two of the merchants are sharks. Walk into one and the order is cancelled with the lesson; nothing is taken.
  const p2pPane = () => {
    if (p2pDesk) return deskPane()
    const a = asset(p2pCoin), sym = a.sym, buying = p2pSide === 'buy'
    const pane = h('div', 'xch-pane')
    const amount = () => { const s = getSave(), hd = holdingOf(a), p = priceOf(a); const cash = buying ? cents(s.ledger * p2pFrac) : cents(hd.qty * p2pFrac * p); return { cash, qty: p > 0 ? cash / p : 0, ok: buying ? cash >= 1 : hd.qty > 0 } }
    loadFiat()
    const usdNote = p2pFiat === 'USD' ? '' : ` (${money(1)} in-game = ${fiatMoney(1)}${fiatLive ? ', live rate' : ', estimate'})`
    if (!p2pOrder) {
      // Your money: the local currency merchants quote in and your bank pays or receives.
      const fiatSel = h('select', 'xch-fiat') as HTMLSelectElement
      for (const f of FIATS) { const o = h('option', '', `${f.id} · ${f.name}`) as HTMLOptionElement; o.value = f.id; o.selected = f.id === p2pFiat; fiatSel.append(o) }
      fiatSel.setAttribute('aria-label', 'Your currency')
      fiatSel.onchange = () => { p2pFiat = fiatSel.value as FiatId; try { localStorage.setItem('gd.p2p.fiat', p2pFiat) } catch { /* private mode */ } show() }
      pane.append(
        note(`P2P: swap crypto for ${p2pFiat === 'USD' ? 'cash' : (FIATS.find((f) => f.id === p2pFiat)?.name ?? 'cash').toLowerCase()} in your bank, person to person, with the coin held in escrow.`),
        row('Your currency', fiatSel),
        segmented(['Buy', 'Sell'], buying ? 0 : 1, (i) => { p2pSide = i ? 'sell' : 'buy'; result.textContent = ''; show() }, 'side'),
        chips(ASSETS.filter((x) => ['btc', 'eth', 'sol'].includes(x.id)), p2pCoin, (x) => { p2pCoin = x.id; show() }),
        row(buying ? 'Amount of your cash' : `Amount of your ${sym}`, segmented(['25%', '50%', 'Max'], [0.25, 0.5, 1].indexOf(p2pFrac), (i) => { p2pFrac = [0.25, 0.5, 1][i]!; paintNow() }, 'amt')),
      )
      const sum = h('p', 'xch-note')
      live.push(() => { const m = amount(); sum.textContent = (buying ? `You pay ${fiatMoney(m.cash)} by bank transfer and receive about ${formatQty(m.qty)} ${sym}.` : m.ok ? `You sell about ${formatQty(m.qty)} ${sym} and receive ${fiatMoney(m.cash)} in your bank.` : `You hold no ${sym} to sell yet.`) + usdNote })
      const list = h('div', 'xch-list')
      list.append(h('h3', 'xch-group', buying ? `Merchants selling ${sym}` : `Merchants buying ${sym}`))
      for (const o of buying ? BUY_OFFERS : SELL_OFFERS) {
        const item = h('button', 'xch-item xch-offer'), names = h('div', 'xch-names'), nums = h('div', 'xch-nums'), price = h('b')
        item.type = 'button'
        const nm = h('b', '', o.name)
        if (o.verified) nm.append(h('span', 'p2p-ver', '✓ Verified'))
        else nm.append(h('span', 'p2p-unver', 'New account'))
        names.append(nm, h('small', '', `${o.trades.toLocaleString('en-US')} trades · ${o.rate}% completed${o.release ? ` · releases in ~${o.release}` : ''}`))
        if (o.limit) names.append(h('small', 'p2p-lim', `Limits ${fiatMoney(o.limit[0])} – ${fiatMoney(o.limit[1])}${o.since ? ` · since ${o.since}` : ''}`))
        nums.append(price, h('small', '', o.pay))
        const ico = h('span', 'xch-ico', o.name[0]); ico.style.setProperty('--tint', o.verified ? '#2f7d5b' : '#6b6f78')
        item.append(ico, names, nums)
        live.push(() => { price.textContent = p2pFiat === 'USD' ? coinPrice(priceOf(a) * (1 + o.spread)) : fiatMoney(priceOf(a) * (1 + o.spread)) })
        item.onclick = () => { if (!amount().ok) { result.textContent = buying ? 'You need at least $1 of in-game cash.' : `You hold no ${sym} to sell.`; result.dataset.ok = 'false'; return } p2pOrder = { offer: o, stage: 'open' }; result.textContent = ''; show() }
        list.append(item)
      }
      pane.append(sum, list, result, note('Practice P2P. A real platform holds the coin in escrow until both sides confirm; stay inside it. Verified merchants trade at the book price.'), merchantGuide(), courses(['p2pSharks', 'redFlags', 'scams']))
      return pane
    }
    // ---- an open order ----
    const order = p2pOrder, o = order.offer, m = amount()
    const end = (ok: boolean, message: string) => { p2pOrder = null; result.textContent = message; result.dataset.ok = String(ok); hooks.finish(message); show() }
    const complete = () => { const r = tradeCoin(a.id, p2pSide, p2pFrac); end(r.ok, r.ok ? `P2P order complete with ${o.name}. ${r.message}` : r.message) }
    const scam = (lesson: string) => end(false, `That was a scam. ${lesson} Practice mode: the order was cancelled and nothing was taken.`)
    const safe = (lesson: string) => end(true, `Good call. ${lesson} Order cancelled, nothing lost.`)
    const head = h('div', 'xch-pos'), top = h('div', 'xch-pos-top'), names = h('div', 'xch-names')
    names.append(h('b', '', `${buying ? 'Buy' : 'Sell'} ${sym} · ${o.name}${o.verified ? ' ✓' : ''}`), h('small', '', `${o.trades.toLocaleString('en-US')} trades · ${o.rate}% completed`))
    top.append(icon(a), names)
    const pv = preview(buying ? ['You pay', 'You receive', 'Payment'] : ['You sell', 'You receive', 'Payment'])
    pv.values[0]!.textContent = buying ? fiatMoney(m.cash) : `${formatQty(m.qty)} ${sym}`
    pv.values[1]!.textContent = buying ? `≈ ${formatQty(m.qty)} ${sym}` : fiatMoney(m.cash)
    pv.values[2]!.textContent = `Bank transfer (${p2pFiat})`
    const steps = h('ol', 'xch-steps')
    const at = order.stage === 'open' ? 1 : order.stage === 'bank' ? 2 : 2
    const labels = buying
      ? [`${o.name}'s ${sym} is locked in escrow`, 'You pay the seller by bank transfer', 'The seller confirms and escrow releases to you']
      : [`Your ${sym} is locked in escrow`, 'The buyer pays your bank account', 'You check your bank, then release']
    labels.forEach((t, i) => { const li = h('li', i < at ? 'done' : i === at ? 'now' : '', t); steps.append(li) })
    const say = h('p', 'xch-chat')
    // The order chat: your messages and the merchant's replies, kept with the order while it is open.
    const chat = orderChat(order, o, buying, sym)
    const actions = h('div', 'xch-actions')
    const key = (label: string, cls: string, run: () => void) => { const b = h('button', cls, label); b.type = 'button'; b.onclick = run; actions.append(b); return b }
    if (order.stage === 'releasing') {
      say.textContent = `${o.name}: Payment received. Releasing now.`
      window.setTimeout(() => { if (tab === 'p2p' && p2pOrder === order) complete() }, 1300)
    } else if (buying && !o.trap) {
      say.textContent = `${o.name}: Hello. Pay to the account shown, in your own name, then tap "I have paid". I release as soon as it lands.`
      key('I have paid', 'xch-go buy', () => { order.stage = 'releasing'; show() })
      key('Cancel order', 'xch-close', () => end(true, 'Order cancelled. The coin went back to the seller from escrow.'))
    } else if (buying && o.trap === 'third') {
      say.textContent = `${o.name}: Pay into my cousin's account, the name is different. Don't worry, do it fast.`
      key("Pay the cousin's account", 'xch-close', () => scam('The account name did not match the seller: a third-party account can be a stolen one, and your transfer can be frozen or traced to you.'))
      key('Cancel and report', 'xch-close', () => safe('Only pay an account in the seller\'s own verified name.'))
    } else if (buying) {
      say.textContent = `${o.name}: Escrow is slow. Message me on WhatsApp and send the money there, I'll send the coin after.`
      key('Take it off the platform', 'xch-close', () => scam('Off the platform there is no escrow, no dispute and no record: you pay and the coin never comes.'))
      key('Stay in escrow: cancel', 'xch-close', () => safe('A price far below the book and a push to leave the platform are both red flags.'))
    } else if (order.stage === 'bank') {
      say.textContent = o.trap ? 'Your bank: no new transfer has arrived.' : `Your bank: +${fiatMoney(m.cash)} received from ${o.name}.`
      if (o.trap) key('Cancel and report', 'xch-close', () => safe('A screenshot is not money. Release only when your own bank shows the payment.'))
      else key(`Release ${sym}`, 'xch-go sell', () => complete())
    } else {
      say.textContent = o.trap ? `${o.name}: I've paid! See the screenshot. Release now, I'm in a hurry.` : `${o.name}: Paid from my own account, same name as here. Please check your bank.`
      key('Check my bank', 'xch-go convert', () => { order.stage = 'bank'; show() })
      key(`Release ${sym} now`, 'xch-close', () => (o.trap ? scam('Fake payment screenshots are the most common P2P trick: nothing had arrived in your bank.') : complete()))
    }
    head.append(top, pv.box, steps, say, chat, actions)
    pane.append(head, result)
    return pane
  }
  /** A convincing fake bank receipt (for the scam lesson): drawn here, never from a real bank. */
  const fakeReceipt = (from: string): string => {
    const c = document.createElement('canvas'); c.width = 360; c.height = 460
    const g = c.getContext('2d')!
    g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, 360, 460)
    g.fillStyle = '#0f5fa8'; g.fillRect(0, 0, 360, 70); g.fillStyle = '#fff'; g.font = '700 22px Inter, sans-serif'; g.fillText('Transfer successful', 22, 44)
    g.fillStyle = '#1fae5b'; g.beginPath(); g.arc(180, 130, 34, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.moveTo(164, 131); g.lineTo(176, 143); g.lineTo(198, 118); g.stroke()
    g.fillStyle = '#1d2a36'; g.font = '800 30px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(fiatMoney(amountUsd()), 180, 210); g.textAlign = 'left'
    g.font = '500 15px Inter, sans-serif'
    const rows: Array<[string, string]> = [['From', from], ['To', 'Your account'], ['Reference', 'P2P ORDER'], ['Status', 'Completed ✓'], ['Date', new Date().toLocaleDateString()]]
    rows.forEach(([k, v], i) => { g.fillStyle = '#6b7783'; g.fillText(k, 24, 262 + i * 34); g.fillStyle = '#1d2a36'; g.textAlign = 'right'; g.fillText(v, 336, 262 + i * 34); g.textAlign = 'left' })
    g.fillStyle = 'rgba(0,0,0,0.04)'; g.fillRect(0, 430, 360, 30)
    return c.toDataURL('image/png')
  }
  const amountUsd = (): number => { const a = asset(p2pCoin), hd = holdingOf(a), p = priceOf(a); return p2pSide === 'buy' ? cents(getSave().ledger * p2pFrac) : cents(hd.qty * p2pFrac * p) }

  // ---- Become a merchant: how P2P merchants and cash agents earn, and a practice desk to run one ----
  const DESK_KEY = 'gd.p2pdesk.v1', DESK_ORDERS = 8, DESK_CAP = 25
  type DeskDay = { d: string; n: number; earned: number }
  const deskDay = (): DeskDay => { const d = new Date().toISOString().slice(0, 10); try { const v = JSON.parse(localStorage.getItem(DESK_KEY) ?? 'null') as DeskDay | null; return v && v.d === d ? v : { d, n: 0, earned: 0 } } catch { return { d, n: 0, earned: 0 } } }
  const saveDesk = (v: DeskDay) => { try { localStorage.setItem(DESK_KEY, JSON.stringify(v)) } catch { /* private mode */ } }
  type DeskCase = { who: string; side: 'buy' | 'sell'; usd: number; kind: 'good' | 'third' | 'fake' | 'off' }
  let deskSpread = 0.01, deskCase: DeskCase | null = null, deskMsg = ''
  const NAMES = ['Amaka', 'Kwame', 'Fatima', 'Tunde', 'Wanjiru', 'Musa', 'Ngozi', 'Kofi', 'Aisha', 'Sipho', 'Chidi', 'Zainab']
  const newCase = (): DeskCase => {
    const r = Math.random(), kind: DeskCase['kind'] = r < 0.55 ? 'good' : r < 0.7 ? 'third' : r < 0.85 ? 'fake' : 'off'
    return { who: NAMES[Math.floor(Math.random() * NAMES.length)]!, side: Math.random() < 0.5 ? 'buy' : 'sell', usd: 20 + Math.round(Math.random() * 13) * 10, kind }
  }
  const merchantGuide = (): HTMLElement => {
    const box = h('details', 'p2p-guide')
    box.append(h('summary', '', '💼 How to become a P2P merchant or cash agent, and earn'))
    const ul = h('ul', 'p2p-steps')
    for (const [t, d] of [
      ['How merchants earn', 'You post a price to buy a little under the market and a price to sell a little over it. The gap (the spread, often 0.5% to 2%) is your income on every order, times how many orders you complete.'],
      ['What platforms ask of you', 'Identity checks (KYC), a refundable security deposit, a bank or mobile money account in your own name, a high completion rate and quick release times. That is what earns the ✓ Verified badge.'],
      ['Cash agents', 'In many cities, P2P or mobile money agents help neighbours swap cash and crypto in person, and earn a small commission on each swap. Same rules: own-name accounts, records of every swap, and local law.'],
      ['The risks', 'Fake receipts, payments from someone else\'s account (which can get your bank frozen), chargebacks, and buyers who try to move you off the platform. Release only when your own bank shows the money.'],
      ['Start small', 'Begin with small limits, keep stock you can afford to hold, learn your country\'s rules on crypto and tax, and never mix your savings with your float.'],
    ] as const) { const li = h('li'); li.append(h('b', '', t), h('span', '', d)); ul.append(li) }
    const open = h('button', 'xch-go buy', 'Open my practice merchant desk') as HTMLButtonElement; open.type = 'button'
    open.onclick = () => { p2pDesk = true; deskCase = null; deskMsg = ''; show() }
    box.append(ul, open, note('Practice: earnings are in-game cash from the city (at most $' + DESK_CAP + ' a day), never real money.'))
    return box
  }
  const deskPane = (): HTMLElement => {
    const pane = h('div', 'xch-pane')
    const day = deskDay()
    const back = h('button', 'xch-close', '‹ Back to P2P') as HTMLButtonElement; back.type = 'button'; back.onclick = () => { p2pDesk = false; show() }
    pane.append(back, h('h3', 'xch-group', 'Your merchant desk · practice'))
    pane.append(note(`Orders today: ${day.n} of ${DESK_ORDERS} · earned $${day.earned.toFixed(2)} of $${DESK_CAP}. Customers pick merchants with fair prices, so a wide spread brings fewer orders.`))
    pane.append(row('Your spread', segmented(['0.5%', '1%', '2%'], [0.005, 0.01, 0.02].indexOf(deskSpread), (i) => { deskSpread = [0.005, 0.01, 0.02][i]!; show() }, 'amt')))
    if (deskMsg) { const r = h('p', 'xch-result', deskMsg); r.dataset.ok = String(!deskMsg.startsWith('✗')); pane.append(r) }
    if (day.n >= DESK_ORDERS) { pane.append(note('That is all the orders for today. Come back tomorrow for more.')); return pane }
    if (!deskCase) {
      const next = h('button', 'xch-go buy', 'Take the next order') as HTMLButtonElement; next.type = 'button'
      next.onclick = () => { if (deskSpread >= 0.02 && Math.random() < 0.4) { deskMsg = 'No one took your price this time: 2% is wide. Try again, or narrow your spread.'; show(); return } deskCase = newCase(); deskMsg = ''; show() }
      pane.append(next)
      return pane
    }
    const c = deskCase
    const card = h('div', 'xch-pos'), say = h('p', 'xch-chat'), bank = h('p', 'xch-note')
    card.append(h('b', '', `${c.who} wants to ${c.side === 'buy' ? 'buy' : 'sell'} $${c.usd} of BTC`), h('small', '', `Your spread ${(deskSpread * 100).toFixed(1)}% · you earn $${(c.usd * deskSpread).toFixed(2)} if it completes`))
    if (c.side === 'buy') {
      say.textContent = c.kind === 'good' ? `${c.who}: Paid from my own account, ${c.who}. Please check.` : c.kind === 'third' ? `${c.who}: My brother paid for me, different name, it's fine.` : c.kind === 'fake' ? `${c.who}: Sent! Here's the screenshot. Release please.` : `${c.who}: Let's finish on WhatsApp, quicker for both of us.`
      bank.textContent = c.kind === 'good' ? `Your bank: +${fiatMoney(c.usd)} received from ${c.who}.` : c.kind === 'third' ? `Your bank: +${fiatMoney(c.usd)} received from "Adewale Stores" (not the buyer's name).` : 'Your bank: no new transfer.'
    } else {
      say.textContent = c.kind === 'good' ? `${c.who}: My BTC is in escrow. Please pay to my account in my name, ${c.who}.` : c.kind === 'third' ? `${c.who}: Pay to my cousin's account please, mine has issues.` : c.kind === 'fake' ? `${c.who}: Escrow released already, check. Now pay me.` : `${c.who}: Pay me outside the platform and I'll send the coin after.`
      bank.textContent = c.kind === 'good' ? 'Escrow: the BTC is locked for you.' : c.kind === 'fake' ? 'Escrow: nothing has been released to you.' : 'Escrow: the BTC is locked for you.'
    }
    card.append(say, bank)
    const finish = (ok: boolean) => {
      const day = deskDay(); day.n++
      const safe = c.kind !== 'good'
      if (ok && !safe) {
        const pay = Math.min(c.usd * deskSpread, Math.max(0, DESK_CAP - day.earned))
        day.earned = cents(day.earned + pay)
        if (pay > 0) earnCash(cents(pay), 'P2P merchant desk', `Spread on a $${c.usd} order with ${c.who}.`)
        deskMsg = `✓ Order complete. You earned $${pay.toFixed(2)} of spread.`
      } else if (!ok && safe) {
        addReputation(1, 'P2P merchant desk', `Spotted a ${c.kind === 'third' ? 'third-party payment' : c.kind === 'fake' ? 'fake receipt' : 'move off the platform'} and cancelled.`)
        deskMsg = '✓ Good catch: cancelled and reported. Reputation +1.'
      } else if (ok && safe) deskMsg = c.kind === 'third' ? '✗ Released to a payment from someone else\'s account: that money can be reversed and your bank frozen. Practice: nothing lost.' : c.kind === 'fake' ? '✗ A screenshot is not money: nothing had arrived. Practice: nothing lost.' : '✗ Off the platform there is no escrow. Practice: nothing lost.'
      else deskMsg = '✗ That one was genuine: the money was in your bank in the buyer\'s own name. Cancelling costs you the order.'
      saveDesk(day); deskCase = null; show()
    }
    const acts = h('div', 'xch-actions')
    const k1 = h('button', 'xch-go buy', c.side === 'buy' ? 'Release the BTC' : 'Pay and complete') as HTMLButtonElement; k1.type = 'button'; k1.onclick = () => finish(true)
    const k2 = h('button', 'xch-close', 'Cancel and report') as HTMLButtonElement; k2.type = 'button'; k2.onclick = () => finish(false)
    acts.append(k1, k2); card.append(acts); pane.append(card)
    return pane
  }
  /** Practice chat with a P2P merchant: quick replies or your own words; verified merchants answer like
   *  professionals, the sharks push you off the platform or to someone else's account. */
  type ChatMsg = { me: boolean; text: string; img?: string }
  const chats = new WeakMap<object, ChatMsg[]>()
  const orderChat = (order: object, o: Offer, buying: boolean, sym: string): HTMLElement => {
    const box = h('div', 'p2p-chat')
    const log = h('div', 'p2p-log')
    const first: ChatMsg[] = [{ me: false, text: o.verified ? `Hi, ${o.name} here. Your order is open and the ${sym} is in escrow. Ask me anything here.` : `hello dear, fast deal 👍` }]
    // A shark buying from you sends a "payment receipt" picture: it looks real, and no money has moved.
    if (!buying && o.trap === 'fake') first.push({ me: false, text: 'I have paid, see receipt. Release now', img: fakeReceipt(o.name) })
    const msgs = chats.get(order) ?? first
    chats.set(order, msgs)
    const paint = () => {
      log.replaceChildren(...msgs.map((m) => {
        const p = h('p', m.me ? 'me' : 'them')
        if (m.img) { const im = h('img', 'p2p-img') as HTMLImageElement; im.src = m.img; im.alt = m.me ? 'Your picture' : 'Picture from the merchant'; im.onclick = () => window.open(m.img, '_blank', 'noopener'); p.append(im) }
        if (m.text) p.append(h('span', '', m.text))
        return p
      }))
      log.scrollTop = log.scrollHeight
    }
    const reply = (q: string): string => {
      const t = q.toLowerCase()
      if (!o.verified) {
        if (/escrow|platform|here/.test(t)) return o.trap === 'offsite' ? 'escrow is too slow bro, WhatsApp me, I send coin after' : 'no time for escrow, pay now and I release'
        if (/name|account/.test(t)) return o.trap === 'third' ? "it's my cousin account, different name but no wahala" : 'check the screenshot I sent'
        return 'pay fast, many people waiting'
      }
      if (/name|account/.test(t)) return `The account is in my own name, ${o.name}, the same as on my profile. Never pay a different name.`
      if (/paid|sent|transfer/.test(t)) return buying ? 'Thanks. I am checking my bank now; I release as soon as it lands.' : 'Sent from my own account. Please check your bank before you release.'
      if (/escrow|safe|scam/.test(t)) return 'Everything stays on the platform: the coin is in escrow until both sides confirm. If anything goes wrong, open an appeal here.'
      if (/how long|time|fast|quick/.test(t)) return `Usually about ${o.release ?? '5 min'}.`
      if (/hi|hello|salam|hey/.test(t)) return 'Hello! Ready when you are.'
      return 'Sure. Keep all payment details and messages in this chat, so support can see them if needed.'
    }
    const send = (text: string, img?: string) => {
      const v = text.trim(); if (!v && !img) return
      msgs.push({ me: true, text: v, img }); paint()
      const answer = img
        ? (o.verified ? 'Thanks, I can see your receipt. A screenshot is not money though: I check my own bank and release as soon as it lands.' : 'ok ok send more fast, other buyers waiting')
        : reply(v)
      window.setTimeout(() => { msgs.push({ me: false, text: answer }); if (log.isConnected) paint() }, 700)
    }
    // Attach a picture (a payment receipt, a screenshot): it stays on this device, in this practice chat.
    const attach = h('button', 'p2p-attach', '📎') as HTMLButtonElement; attach.type = 'button'; attach.setAttribute('aria-label', 'Attach a picture or screenshot'); attach.title = 'Attach a picture or screenshot'
    const picker = h('input') as HTMLInputElement; picker.type = 'file'; picker.accept = 'image/*'; picker.hidden = true
    attach.onclick = () => picker.click()
    picker.onchange = () => {
      const f = picker.files?.[0]; picker.value = ''
      if (!f || !f.type.startsWith('image/')) return
      if (f.size > 12_000_000) { msgs.push({ me: false, text: 'That picture is too big to send here.' }); paint(); return }
      send('', URL.createObjectURL(f))
    }
    const quick = h('div', 'p2p-quick')
    for (const q of ['Hello 👋', 'Is the account in your name?', buying ? 'I have sent the money' : 'Have you paid?', 'Can we keep it in escrow?']) { const b = h('button', 'p2p-q', q); b.type = 'button'; b.onclick = () => send(q); quick.append(b) }
    const form = h('form', 'p2p-form'), input = h('input') as HTMLInputElement, go = h('button', 'p2p-send', 'Send')
    input.type = 'text'; input.placeholder = `Message ${o.name}`; input.maxLength = 140; (go as HTMLButtonElement).type = 'submit'
    form.append(attach, picker, input, go)
    form.onsubmit = (e) => { e.preventDefault(); send(input.value); input.value = '' }
    box.append(h('p', 'xch-group', `Chat with ${o.name}`), log, quick, form, h('p', 'xch-note', 'Practice chat. On a real platform, never move a deal to WhatsApp or any other app, and never share a code, seed phrase or password.'))
    paint()
    return box
  }

  const body = h('div', 'xch-body')
  const show = () => { live = []; dropCharts(); body.replaceChildren(tab === 'spot' ? spot() : tab === 'perps' ? perpsPane() : tab === 'convert' ? convertPane() : tab === 'stake' ? stakePane() : tab === 'defi' ? renderDefi({ done: (m) => hooks.finish(m), live: (f) => live.push(f) }) : p2pPane()); paintNow() }
  root.append(segmented(['Spot', 'Perps', 'Convert', 'P2P', 'Stake', 'DeFi'], 0, (i) => { tab = (['spot', 'perps', 'convert', 'p2p', 'stake', 'defi'] as const)[i]!; p2pOrder = null; result.textContent = ''; show() }, 'tabs'), body)
  // New prices (or a chart's hourly closes) landed: repaint what is on screen.
  let seen = false
  const born = performance.now()
  const onPrices = () => { if (!root.isConnected) { if (seen || performance.now() - born > 5000) { window.removeEventListener('gd:prices', onPrices); dropCharts() } return } seen = true; paintNow() }
  window.addEventListener('gd:prices', onPrices)
  show()
  // The chart measures its box: draw again once the card is in the page.
  requestAnimationFrame(paintNow)
  let last = 0
  return { el: root, paint: () => { const t = performance.now(); if (t - last < 450) return; last = t; if (!root.isConnected) { if (seen) dropCharts(); return } seen = true; wantFast(); paintNow() } }
}
