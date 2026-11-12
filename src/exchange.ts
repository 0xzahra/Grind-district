// The trading screen: Spot, Perps and Convert on one clean card. One asset in focus at a time with a big price,
// a simple line chart and a single order ticket; the market list sits underneath. Practice prices only.
import { COINS, COIN_CATEGORIES, RANKS, cents, coinPrice, formatQty, money, rankFor, seasonAt, seasonLabel, type Holding, type RankId } from './logic.ts'
import { convertCoin, getSave, trade, tradeCoin } from './state.ts'
import { LEVERAGE, MAX_PERPS, closePerp, liqPrice, markPrice, openPerp, perpCash, perpPnl, perps, sweepPerps, type Perp } from './perps.ts'

type Asset = { id: string; sym: string; name: string; tint: string; group: string; minRank: RankId; desk?: 'unit' | 'meme' }
const TINT: Record<string, string> = { btc: '#f7931a', eth: '#7b8fe8', sol: '#19c9a0', link: '#3d6fe6', avax: '#e84142', dot: '#e6007a', doge: '#c9a93a', wif: '#b98a5e', bonk: '#f5a623' }
const ASSETS: Asset[] = [
  { id: 'unit', sym: 'UNIT', name: 'District coin', tint: '#d9b26a', group: 'District', minRank: 'shrimp', desk: 'unit' },
  { id: 'meme', sym: 'MEME', name: 'Trenches coin', tint: '#8fd0a6', group: 'District', minRank: 'shrimp', desk: 'meme' },
  ...COINS.map((c): Asset => ({ id: c.id, sym: c.label.split(' · ')[0]!, name: c.label.split(' · ')[1] ?? c.label, tint: TINT[c.id] ?? '#9aa3ad', group: COIN_CATEGORIES.find((k) => k.id === c.cat)!.label, minRank: c.minRank })),
]
const CASH: Asset = { id: 'usd', sym: 'USD', name: 'Cash', tint: '#5fae7d', group: '', minRank: 'shrimp' }
const asset = (id: string): Asset => (id === 'usd' ? CASH : ASSETS.find((a) => a.id === id) ?? ASSETS[0]!)
const priceOf = (a: Asset): number => { const s = getSave(); return a.id === 'usd' ? 1 : a.desk === 'unit' ? s.unitPrice : a.desk === 'meme' ? s.memePrice : markPrice(a.id) }
const holdingOf = (a: Asset): Holding => { const s = getSave(); return a.id === 'usd' ? { qty: s.ledger, avg: 1 } : a.desk === 'unit' ? s.unit : a.desk === 'meme' ? s.meme : s.coins[a.id] ?? { qty: 0, avg: 0 } }
const locked = (a: Asset): boolean => RANKS.findIndex((r) => r.id === a.minRank) > RANKS.findIndex((r) => r.id === rankFor(getSave().xp).id)
const rankLabel = (a: Asset): string => RANKS.find((r) => r.id === a.minRank)!.label
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
const series = (a: Asset): number[] => { const s = getSave(); return a.desk === 'unit' ? s.unitHist : a.desk === 'meme' ? s.memeHist : tape.get(a.id) ?? [] }
const change = (a: Asset): number => { const s = series(a); const first = s[0] ?? priceOf(a); return first > 0 ? (priceOf(a) / first - 1) * 100 : 0 }

function drawChart(cv: HTMLCanvasElement, data: number[], up: boolean): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const w = cv.clientWidth || 320, hgt = cv.clientHeight || 132
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
  let tab: 'spot' | 'perps' | 'convert' = 'spot'
  let live: Array<() => void> = []
  // What each tab has selected; kept while the screen is open so switching tabs loses nothing.
  let spotId: string = desk, spotSide: 'buy' | 'sell' = 'buy', spotFrac = 0.5, plan = false
  let perpId = 'btc', perpSide: 'long' | 'short' = 'long', perpLev = 5, perpFrac = 0.25
  let convFrom = 'usd', convTo = 'btc', convFrac = 0.5
  const paintNow = () => { for (const f of live) f() }

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
      b.type = 'button'; b.append(icon(a), h('span', '', a.sym)); b.setAttribute('aria-pressed', String(a.id === active))
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
    const price = h('div', 'xch-price'), chg = h('div', 'xch-chg'), canvas = h('canvas', 'xch-chart')
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${a.sym} recent price`)
    wrap.append(head, price, chg, canvas)
    live.push(() => {
      const d = change(a)
      price.textContent = coinPrice(priceOf(a))
      chg.textContent = `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(2)}% recent`
      chg.dataset.dir = dir(d)
      drawChart(canvas, [...series(a), priceOf(a)], d >= 0)
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
  const result = h('p', 'xch-result')
  result.setAttribute('role', 'status')
  const done = (r: { ok: boolean; message: string; rankedUp?: RankId }, rebuild = false) => {
    result.textContent = r.message
    result.dataset.ok = String(r.ok)
    hooks.finish(r.message, r.rankedUp)
    if (rebuild) show(); else paintNow()
  }

  // ------------------------------- SPOT -------------------------------
  const spot = () => {
    const a = asset(spotId)
    const pane = h('div', 'xch-pane')
    pane.append(chips(ASSETS, spotId, (x) => { spotId = x.id; result.textContent = ''; show() }), quote(a, a.name, a.sym))
    if (locked(a)) pane.append(note(`${a.sym} opens at ${rankLabel(a)}. Keep climbing the ladder to trade it.`))
    else {
      const tiles = h('div', 'xch-tiles'), cash = tile('Cash'), held = tile(`${a.sym} held`), pnl = tile('Open P&L')
      tiles.append(cash.t, held.t, pnl.t)
      const ticket = h('div', 'xch-ticket')
      const sell = spotSide === 'sell'
      const pv = preview(sell ? ['You sell', 'You get'] : ['You pay', 'You get'])
      const go = cta(sell ? 'sell' : 'buy')
      ticket.append(
        segmented(['Buy', 'Sell'], sell ? 1 : 0, (i) => { spotSide = i ? 'sell' : 'buy'; show() }, 'side'),
        row(sell ? 'Amount of your holding' : 'Amount of your cash', segmented(['25%', '50%', 'Max'], [0.25, 0.5, 1].indexOf(spotFrac), (i) => { spotFrac = [0.25, 0.5, 1][i]!; paintNow() }, 'amt')),
        pv.box,
      )
      if (a.desk && sell) {
        const label = h('label', 'xch-check'), box = h('input')
        box.type = 'checkbox'; box.checked = plan; box.onchange = () => { plan = box.checked }
        label.append(box, h('span', '', 'I sized this on purpose (a logged plan counts on the ladder)'))
        ticket.append(label)
      }
      ticket.append(go)
      go.onclick = () => done(a.desk ? trade(a.desk, spotSide, spotFrac, plan) : tradeCoin(a.id, spotSide, spotFrac))
      live.push(() => {
        const s = getSave(), hd = holdingOf(a), p = priceOf(a)
        cash.v.textContent = money(s.ledger)
        held.v.textContent = hd.qty > 0 ? formatQty(hd.qty) : '0'
        held.s.textContent = hd.qty > 0 ? money(hd.qty * p) : ''
        const open = hd.qty > 0 ? (p - hd.avg) * hd.qty : 0
        pnl.v.textContent = hd.qty > 0 ? signed(open) : '$0.00'
        pnl.v.dataset.dir = hd.qty > 0 ? dir(open) : ''
        pnl.s.textContent = hd.qty > 0 ? `avg ${coinPrice(hd.avg)}` : ''
        if (sell) {
          const qty = hd.qty * spotFrac
          pv.values[0]!.textContent = `${formatQty(qty)} ${a.sym}`
          pv.values[1]!.textContent = `≈ ${money(qty * p)}`
          go.textContent = `Sell ${a.sym}`
          go.disabled = !(hd.qty > 0)
        } else {
          const pay = cents(s.ledger * spotFrac)
          pv.values[0]!.textContent = money(pay)
          pv.values[1]!.textContent = `≈ ${formatQty(p > 0 ? pay / p : 0)} ${a.sym}`
          go.textContent = `Buy ${a.sym}`
          go.disabled = pay < 1
        }
      })
      pane.append(tiles, ticket, result)
      if (a.desk) pane.append(note(a.desk === 'unit' ? `${seasonLabel(seasonAt())} season. A plan logged on the sell can count when the close is red.` : `${seasonLabel(seasonAt())} season. MEME is attention. Size small. Rank will not follow a crash.`))
      else if (a.group === 'Big caps') pane.append(note('Big caps reward patience: each buy adds reputation.'))
    }
    // Markets: every listed asset with its price, recent change and what you hold.
    const list = h('div', 'xch-list')
    let group = ''
    for (const m of ASSETS) {
      if (m.group !== group) { group = m.group; list.append(h('h3', 'xch-group', group)) }
      const item = h('button', 'xch-item'), names = h('div', 'xch-names'), nums = h('div', 'xch-nums'), price = h('b'), chg = h('small')
      item.type = 'button'
      names.append(h('b', '', m.name), h('small', '', m.sym))
      nums.append(price, chg)
      item.append(icon(m), names, nums)
      if (m.id === spotId) item.setAttribute('aria-current', 'true')
      item.onclick = () => { spotId = m.id; result.textContent = ''; show(); root.closest('.sheet-card')?.scrollTo({ top: 0, behavior: 'smooth' }) }
      const lock = locked(m)
      live.push(() => {
        const hd = holdingOf(m), p = priceOf(m), d = change(m)
        price.textContent = coinPrice(p)
        chg.textContent = lock ? `Opens at ${rankLabel(m)}` : `${d >= 0 ? '+' : '-'}${Math.abs(d).toFixed(2)}%${hd.qty > 0 ? ` · ${money(hd.qty * p)} held` : ''}`
        chg.dataset.dir = lock ? '' : dir(d)
      })
      list.append(item)
    }
    pane.append(list)
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
        card.append(top, grid, close)
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
    pane.append(book, note('Practice perpetuals. Margin comes from earned in-game cash only, never from a top-up. A position is liquidated when its loss reaches its margin. Open positions are kept on this device.'))
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
    pane.append(ticket, result, note('Converting swaps one asset straight into another at the current practice prices.'))
    return pane
  }

  const body = h('div', 'xch-body')
  const show = () => { live = []; body.replaceChildren(tab === 'spot' ? spot() : tab === 'perps' ? perpsPane() : convertPane()); paintNow() }
  root.append(segmented(['Spot', 'Perps', 'Convert'], 0, (i) => { tab = (['spot', 'perps', 'convert'] as const)[i]!; result.textContent = ''; show() }, 'tabs'), body)
  show()
  // The chart measures its box: draw again once the card is in the page.
  requestAnimationFrame(paintNow)
  let last = 0
  return { el: root, paint: () => { const t = performance.now(); if (t - last < 450) return; last = t; paintNow() } }
}
