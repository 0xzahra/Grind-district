// The candlestick view on the trading screen, drawn with TradingView's free Lightweight Charts library
// (https://www.tradingview.com/lightweight-charts/). Loaded only when a player first picks "Candles", so the
// game's first load does not grow. Real hourly candles for listed coins (livePrices.ts hourlyBars); practice
// assets get candles grouped from their own practice tape. Display only. The TradingView attribution is the
// "Chart by TradingView" link under the chart (exchange.ts), as the library's licence asks.
import type { Bar } from './livePrices.ts'

type Lib = typeof import('lightweight-charts')
let lib: Promise<Lib> | null = null
const load = (): Promise<Lib> => (lib ??= import('lightweight-charts'))

export type CandleView = { el: HTMLElement; set(bars: Bar[], last: number): void; destroy(): void }

/** Decimals that keep about four significant digits, so SHIB and BTC both read well. */
const decimals = (p: number): number => (p >= 10000 ? 0 : p >= 1 ? 2 : Math.min(12, Math.max(4, Math.ceil(-Math.log10(p)) + 3)))

/** Practice candles from a list of prices: every `per` points make one candle, one per "hour" ending now. */
export function barsFromSeries(data: number[], per = 3): Bar[] {
  const out: Bar[] = []
  const n = Math.floor(data.length / per)
  const end = Math.floor(Date.now() / 3_600_000) * 3600
  for (let i = 0; i < n; i++) {
    const seg = data.slice(i * per, i * per + per + 1)
    out.push([end - (n - 1 - i) * 3600, seg[0]!, Math.max(...seg), Math.min(...seg), seg[seg.length - 1]!])
  }
  return out
}

export function candleChart(): CandleView {
  const el = document.createElement('div')
  el.className = 'xch-candles'
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', 'Hourly candlestick chart')
  let chart: import('lightweight-charts').IChartApi | null = null
  let series: import('lightweight-charts').ISeriesApi<'Candlestick'> | null = null
  let pending: { bars: Bar[]; last: number } | null = null
  let sig = '', dec = -1, dead = false, fitted = false

  const apply = (bars: Bar[], last: number) => {
    if (!series || !chart || !bars.length) return
    const tail = bars[bars.length - 1]!
    const d = decimals(last || tail[4])
    if (d !== dec) { dec = d; series.applyOptions({ priceFormat: { type: 'price', precision: d, minMove: 10 ** -d } }) }
    const s = `${bars.length}:${bars[0]![0]}:${tail[0]}:${tail[1]}`
    if (s !== sig) {
      sig = s
      series.setData(bars.map((b) => ({ time: b[0] as import('lightweight-charts').UTCTimestamp, open: b[1], high: b[2], low: b[3], close: b[4] })))
      if (!fitted) { chart.timeScale().fitContent(); fitted = true }
    }
    // The last candle follows the price now.
    if (last > 0) series.update({ time: tail[0] as import('lightweight-charts').UTCTimestamp, open: tail[1], high: Math.max(tail[2], last), low: Math.min(tail[3], last), close: last })
  }

  load().then((L) => {
    if (dead) return
    const light = document.documentElement.dataset.ui === 'light'
    chart = L.createChart(el, {
      autoSize: true,
      layout: { background: { type: L.ColorType.Solid, color: 'transparent' }, textColor: light ? '#6b655a' : 'rgba(246,241,230,0.62)', fontSize: 11, fontFamily: "'Inter Variable', system-ui, sans-serif", attributionLogo: false },
      grid: { vertLines: { color: light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }, horzLines: { color: light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.08 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 3, barSpacing: 7 },
      crosshair: { mode: L.CrosshairMode.Magnet, vertLine: { color: 'rgba(217,178,106,0.5)', labelBackgroundColor: '#3a3226' }, horzLine: { color: 'rgba(217,178,106,0.5)', labelBackgroundColor: '#3a3226' } },
      // Vertical swipes scroll the sheet, not the chart; pinch and horizontal drag still work on phones.
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true },
    })
    series = chart.addSeries(L.CandlestickSeries, { upColor: '#2fc48d', downColor: '#f0616d', borderVisible: false, wickUpColor: '#2fc48d', wickDownColor: '#f0616d', priceLineColor: 'rgba(217,178,106,0.8)' })
    if (pending) apply(pending.bars, pending.last)
  }).catch(() => { el.dataset.failed = 'true'; el.textContent = 'The candle chart could not load. The line chart still works.' })

  return {
    el,
    set(bars, last) { if (dead) return; if (series) apply(bars, last); else pending = { bars, last } },
    destroy() { dead = true; try { chart?.remove() } catch { /* already gone */ } chart = null; series = null },
  }
}
