// Books, laid out as a ledger: a balance sheet (cash, investments at market, total assets, what you own that
// costs upkeep, net worth), the holdings table (quantity, average cost, value, profit or loss), the things you
// own, and a dated journal of every money move with money in and money out. Private to the player: none of
// these amounts go on the public profile.
import { getSave, balanceSplit } from './state.ts'
import { COINS, VEHICLES, money, type Save } from './logic.ts'

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const qtyFmt = (q: number) => q.toLocaleString('en-US', { maximumFractionDigits: q < 1 ? 6 : 4 })
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`

type Position = { name: string; sym: string; qty: number; avg: number; price: number }
function positions(s: Save): Position[] {
  const out: Position[] = []
  if (s.unit.qty > 0) out.push({ name: 'District Coin', sym: 'GDC', qty: s.unit.qty, avg: s.unit.avg, price: s.unitPrice })
  if (s.meme.qty > 0) out.push({ name: 'Meme Token', sym: 'MEME', qty: s.meme.qty, avg: s.meme.avg, price: s.memePrice })
  for (const c of COINS) {
    const h = s.coins?.[c.id]
    if (h && h.qty > 0) { const [sym, name] = c.label.split(' · '); out.push({ name: name ?? sym!, sym: sym!, qty: h.qty, avg: h.avg, price: s.coinPrices[c.id] ?? c.base }) }
  }
  return out
}

/** Amount of a logged money move: + in, − out, null when the entry carries no amount. */
function amountOf(label: string, detail: string): number | null {
  if (label.startsWith('Converted ')) return null // coin to coin: no cash in or out
  const m = detail.match(/^([+-])?\$([\d,]+(?:\.\d+)?)/) ?? label.match(/([+-])\$([\d,]+(?:\.\d+)?)/)
  if (!m) return null
  const v = Number(m[2]!.replace(/,/g, ''))
  if (!Number.isFinite(v)) return null
  if (m[1] === '-') return -v
  if (m[1] === '+') return v
  if (/^(Bought|Paid|Grind Pass ·|Grind Pass tier skip|.*: )/.test(label) && !/^(Top-up|Starting|Sign-up|Event reward|Job pay|Weekly challenge|Earn Path|Grind Pass tier \d)/.test(label)) return -v
  return v
}

export function renderLedger(): HTMLElement {
  const s = getSave(), split = balanceSplit(), pos = positions(s)
  const invest = pos.reduce((a, p) => a + p.qty * p.price, 0)
  const spent = s.wants.reduce((a, w) => a + w.spent, 0) + (s.ownedVehicles ?? []).reduce((a, id) => a + (VEHICLES.find((v) => v.id === id)?.price ?? 0), 0)
  const root = el('div', '', 'ldg')

  // Balance sheet
  const sheet = el('section', '', 'ldg-card')
  sheet.append(el('h4', 'Balance sheet'))
  const rows: Array<[string, string, string?]> = [
    ['Cash (in-game)', money(s.ledger)],
    ['  Earned', money(split.earned), 'sub'],
    ['  Topped up', money(split.toppedUp), 'sub'],
    ['Investments at market', money(invest)],
    ['Total assets', money(s.ledger + invest), 'total'],
    ['Spent on things you own', money(spent), 'neg'],
    ['Net worth', money(s.ledger + invest), 'grand'],
  ]
  const t = el('div', '', 'ldg-rows')
  for (const [k, v, c] of rows) { const r = el('div', '', `ldg-row ${c ?? ''}`); r.append(el('span', k.trim()), el('b', v)); t.append(r) }
  sheet.append(t, el('p', 'Net worth counts cash and investments. Things you own cost upkeep and are not counted as assets. Earned dollars are spent first.', 'ldg-note'))
  root.append(sheet)

  // Holdings
  const hold = el('section', '', 'ldg-card')
  hold.append(el('h4', 'Holdings'))
  if (!pos.length) hold.append(el('p', 'No coins or tokens yet. Buy on the Trade screen with practice money.', 'ldg-note'))
  else {
    const tbl = el('div', '', 'ldg-table')
    const head = el('div', '', 'ldg-tr ldg-th'); for (const h of ['Asset', 'Qty', 'Avg', 'Value', 'P&L']) head.append(el('span', h)); tbl.append(head)
    for (const p of pos) {
      const pnl = (p.price - p.avg) * p.qty
      const r = el('div', '', 'ldg-tr')
      const nm = el('span', '', 'ldg-asset'); nm.append(el('b', p.sym), el('small', p.name))
      r.append(nm, el('span', qtyFmt(p.qty)), el('span', money(p.avg)), el('span', money(p.qty * p.price)), el('span', signed(pnl), pnl >= 0 ? 'up' : 'down'))
      tbl.append(r)
    }
    hold.append(tbl)
  }
  root.append(hold)

  // What you own
  const own = el('section', '', 'ldg-card')
  own.append(el('h4', 'Things you own'))
  const items: Array<[string, string]> = []
  if (s.houseClaimed) items.push(['House', 'Upkeep'])
  if (s.luxury) items.push(['Gold chain', 'Resellable'])
  const kind = { car: 'Car', jet: 'Jet', drone: 'Air taxi', phone: 'Phone', laptop: 'Computer', accessory: 'Accessory' } as const
  for (const id of s.ownedVehicles ?? []) { const v = VEHICLES.find((x) => x.id === id); if (v) items.push([`${kind[v.kind]} · ${v.label}`, money(v.price)]) }
  for (const w of s.wants.slice().reverse()) items.push([w.label, money(w.spent)])
  if (!items.length) own.append(el('p', 'Nothing bought yet.', 'ldg-note'))
  else { const t2 = el('div', '', 'ldg-rows'); for (const [k, v] of items.slice(0, 30)) { const r = el('div', '', 'ldg-row'); r.append(el('span', k), el('b', v)); t2.append(r) } own.append(t2) }
  root.append(own)

  // Journal
  const jr = el('section', '', 'ldg-card')
  jr.append(el('h4', 'Journal'))
  const moves = s.activities.map((a) => ({ a, amt: amountOf(a.label, a.detail) })).filter((x) => x.amt !== null)
  if (!moves.length) jr.append(el('p', 'No money moves yet.', 'ldg-note'))
  else {
    const tbl = el('div', '', 'ldg-table ldg-journal')
    const head = el('div', '', 'ldg-tr ldg-th'); for (const h of ['Date', 'Entry', 'In', 'Out']) head.append(el('span', h)); tbl.append(head)
    let tin = 0, tout = 0
    for (const { a, amt } of moves) {
      const r = el('div', '', 'ldg-tr')
      const d = new Date(a.at)
      r.append(el('span', d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), 'ldg-date'), el('span', a.label, 'ldg-entry'), el('span', amt! > 0 ? money(amt!) : '', 'up'), el('span', amt! < 0 ? money(-amt!) : '', 'down'))
      if (amt! > 0) tin += amt!; else tout += -amt!
      tbl.append(r)
    }
    const tot = el('div', '', 'ldg-tr ldg-tot'); tot.append(el('span', ''), el('span', 'Totals'), el('span', money(tin), 'up'), el('span', money(tout), 'down'))
    tbl.append(tot)
    jr.append(tbl, el('p', 'The latest 40 activities are kept; trades show in Holdings at market value.', 'ldg-note'))
  }
  root.append(jr)
  return root
}
