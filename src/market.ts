// Grind Market: rent a stall in the covered hall, stock it with one kind of goods, set a price and sell. Residents
// buy while you play (and a little while you are away, up to two hours' worth); players who are online see your
// stall and can buy from it too (net.ts 'mkt' broadcasts: owners announce their stall, a buyer's purchase goes to
// the owner, who answers so a sold-out buyer is refunded). Takings are collected as earned in-game cash.
// The lesson is pricing: low sells fast on a thin margin, high sells slowly on a fat one. Kept on this device
// (not the save), per account slot.
import { earnCash, slotKey, spendInGame } from './state.ts'

export const GOODS = [
  { id: 'suya', title: 'Suya skewers', icon: '🍢', cost: 1.2, demand: 1.2, color: 0x8a4a2a },
  { id: 'jollof', title: 'Jollof rice packs', icon: '🍛', cost: 1.8, demand: 1.1, color: 0xd2532a },
  { id: 'plantain', title: 'Plantain chips', icon: '🍌', cost: 0.6, demand: 1.0, color: 0xf0c419 },
  { id: 'cases', title: 'Phone cases', icon: '📱', cost: 2.5, demand: 0.8, color: 0x3a5f8a },
  { id: 'tees', title: 'Grind tees', icon: '👕', cost: 4.0, demand: 0.7, color: 0x17a865 },
  { id: 'prints', title: 'Art prints', icon: '🖼️', cost: 3.0, demand: 0.6, color: 0x8a4ab0 },
] as const
export type GoodsId = (typeof GOODS)[number]['id']
export const TIERS = [
  { id: 'low', title: 'Low price', mult: 1.3, rate: 0.8, note: 'sells fast, thin margin' },
  { id: 'fair', title: 'Fair price', mult: 1.7, rate: 0.55, note: 'steady' },
  { id: 'high', title: 'High price', mult: 2.4, rate: 0.28, note: 'fat margin, sells slowly' },
] as const
export type TierId = (typeof TIERS)[number]['id']
export const RENT = 15
export const RENTABLE = 14
const TICK = 10
const AWAY_MAX = 2 * 3600_000

export type MyStall = { stall: number; until: number; goods: GoodsId; tier: TierId; stock: number; takings: number; sold: number; last: number }
export type RemoteStall = { from: string; name: string; stall: number; goods: GoodsId; tier: TierId; price: number; stock: number; seen: number }
export type MarketNet = { send: (m: Record<string, unknown>) => void; id: () => string }

const goodsOf = (id: string) => GOODS.find((g) => g.id === id)
const tierOf = (id: string) => TIERS.find((t) => t.id === id)
export const priceOf = (g: GoodsId, t: TierId) => Math.round(goodsOf(g)!.cost * tierOf(t)!.mult * 100) / 100
const money = (n: number) => `$${n.toFixed(2)}`
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }

export type Market = ReturnType<typeof createMarket>

export function createMarket(o: { toast: (m: string) => void; myName: () => string; inMarket: () => boolean }) {
  const key = () => `gd.market.v1:${slotKey()}`
  let mine: MyStall | null = null
  let loadedFor = ''
  const remotes = new Map<string, RemoteStall>()
  const pendingBuys = new Map<string, number>()
  const listeners = new Set<() => void>()
  let net: MarketNet | null = null
  let saleAcc = 0, castAcc = 0
  const changed = () => { for (const f of listeners) f() }
  const save = () => { try { if (mine) localStorage.setItem(key(), JSON.stringify(mine)); else localStorage.removeItem(key()) } catch { /* private mode */ } }
  const load = () => {
    const k = key()
    if (k === loadedFor) return
    loadedFor = k
    mine = null
    try {
      const v = JSON.parse(localStorage.getItem(k) ?? 'null') as MyStall | null
      if (v && goodsOf(v.goods) && tierOf(v.tier) && Number.isFinite(v.stock)) mine = v
    } catch { /* none */ }
    // While you were away: residents kept buying, up to two hours' worth, as long as the stall was rented.
    if (mine && mine.stock > 0) {
      const until = Math.min(Date.now(), mine.until)
      const away = Math.max(0, Math.min(AWAY_MAX, until - mine.last))
      const expect = Math.floor((away / 1000 / TICK) * chance(mine, false))
      const n = Math.min(mine.stock, expect)
      if (n > 0) {
        const p = priceOf(mine.goods, mine.tier)
        mine.stock -= n; mine.sold += n; mine.takings = Math.round((mine.takings + n * p) * 100) / 100
        o.toast(`While you were away your market stall sold ${n} × ${goodsOf(mine.goods)!.title} (${money(n * p)} to collect).`)
      }
    }
    if (mine) { mine.last = Date.now(); save() }
  }
  const active = () => !!mine && mine.stall >= 0 && Date.now() < mine.until
  const chance = (m: MyStall, here: boolean) => tierOf(m.tier)!.rate * goodsOf(m.goods)!.demand * (here ? 0.6 : 0.4)
  const sell = (n: number, p: number) => {
    if (!mine) return
    mine.stock -= n; mine.sold += n; mine.takings = Math.round((mine.takings + n * p) * 100) / 100
    save(); changed()
  }
  const broadcast = () => {
    if (!net || !mine || !active()) return
    net.send({ k: 'stall', s: mine.stall, n: o.myName().slice(0, 24), g: mine.goods, t: mine.tier, st: mine.stock })
  }

  /** What a rentable stall shows: free, yours, or another online player's. */
  const stallState = (i: number): { kind: 'free' } | { kind: 'mine'; m: MyStall } | { kind: 'remote'; r: RemoteStall } => {
    load()
    if (mine && active() && mine.stall === i) return { kind: 'mine', m: mine }
    for (const r of remotes.values()) if (r.stall === i) return { kind: 'remote', r }
    return { kind: 'free' }
  }

  // --- The panel ---
  const panel = (i: number) => {
    load()
    document.getElementById('mk-panel')?.remove()
    const root = el('div', 'mk-panel'); root.id = 'mk-panel'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Market stall')
    const close = () => { root.remove(); document.body.classList.remove('sheet-open') }
    const st = stallState(i)
    const head = el('div', 'mk-head'); head.append(el('b', '', `Stall ${i + 1}`)); const x = el('button', 'ghost', 'Close'); x.type = 'button'; x.onclick = close; head.append(x)
    const body = el('div', 'mk-body')
    const btn = (label: string, run: () => void, primary = false) => { const b = el('button', primary ? 'primary' : 'ghost', label); b.type = 'button'; b.onclick = () => { run(); panel(i) }; return b }
    if (st.kind === 'remote') {
      const r = st.r, g = goodsOf(r.goods)!
      body.append(el('p', 'mk-lead', `${r.name}'s stall`), el('p', '', `${g.icon} ${g.title} · ${money(r.price)} each · ${r.stock} left`))
      if (r.stock > 0) body.append(btn(`Buy one for ${money(r.price)}`, () => buyFrom(r), true))
      else body.append(el('p', 'mk-note', 'Sold out for now.'))
    } else if (st.kind === 'free') {
      if (mine && active()) body.append(el('p', '', `You already run stall ${mine.stall + 1}. One stall at a time.`), btn('Go to my stall', () => { close(); o.toast(`Your stall is number ${mine!.stall + 1}, on the centre aisle.`) }))
      else {
        body.append(el('p', 'mk-lead', 'This stall is free.'), el('p', '', `Rent it for ${money(RENT)} for a day. Stock it, set your price, and residents and other players buy from you.`))
        if (mine && (mine.stock > 0 || mine.takings > 0)) body.append(el('p', 'mk-note', `You still have ${mine.stock} × ${goodsOf(mine.goods)!.title} in storage and ${money(mine.takings)} to collect.`))
        body.append(btn(`Rent for ${money(RENT)}`, () => {
          const r = spendInGame(RENT, 'Market stall rent', `Stall ${i + 1} at Grind Market for a day.`)
          if (!r.ok) { o.toast(r.message); return }
          mine = mine ? { ...mine, stall: i, until: Date.now() + 24 * 3600_000, last: Date.now() } : { stall: i, until: Date.now() + 24 * 3600_000, goods: 'suya', tier: 'fair', stock: 0, takings: 0, sold: 0, last: Date.now() }
          save(); changed(); broadcast(); o.toast(`Stall ${i + 1} is yours until this time tomorrow. Stock it to start selling.`)
        }, true))
      }
    } else {
      const m = st.m, g = goodsOf(m.goods)!, p = priceOf(m.goods, m.tier)
      const hrs = Math.max(0, Math.round((m.until - Date.now()) / 3600_000))
      body.append(el('p', 'mk-lead', `Your stall · ${hrs} h left on the rent`), el('p', '', `${g.icon} ${g.title}: ${m.stock} in stock · selling at ${money(p)} (cost ${money(g.cost)}) · sold ${m.sold}`))
      // Goods: switch only when the stock is gone.
      const gl = el('div', 'mk-grid')
      for (const q of GOODS) {
        const b = el('button', q.id === m.goods ? 'primary' : 'ghost', `${q.icon} ${q.title} · cost ${money(q.cost)}`); b.type = 'button'
        b.disabled = q.id !== m.goods && m.stock > 0
        b.onclick = () => { if (!mine) return; mine.goods = q.id; save(); changed(); broadcast(); panel(i) }
        gl.append(b)
      }
      body.append(el('small', 'mk-h', 'What you sell'), gl)
      const tl = el('div', 'mk-grid')
      for (const t of TIERS) {
        const b = el('button', t.id === m.tier ? 'primary' : 'ghost', `${t.title} · ${money(priceOf(m.goods, t.id))} (${t.note})`); b.type = 'button'
        b.onclick = () => { if (!mine) return; mine.tier = t.id; save(); changed(); broadcast(); panel(i) }
        tl.append(b)
      }
      body.append(el('small', 'mk-h', 'Your price'), tl)
      const buy = el('div', 'mk-grid')
      for (const n of [10, 25]) buy.append(btn(`Buy ${n} for ${money(n * g.cost)}`, () => {
        const r = spendInGame(Math.round(n * g.cost * 100) / 100, 'Market stock', `${n} × ${g.title} for your stall.`)
        if (!r.ok) { o.toast(r.message); return }
        if (mine) { mine.stock += n; save(); changed(); broadcast() }
      }))
      body.append(el('small', 'mk-h', 'Stock up'), buy)
      if (m.takings > 0) body.append(btn(`Collect ${money(m.takings)}`, () => { if (!mine) return; earnCash(mine.takings, 'Market stall takings', `${goodsOf(mine.goods)!.title} sold at Grind Market.`); o.toast(`Collected ${money(mine.takings)}.`); mine.takings = 0; save(); changed() }, true))
      body.append(el('p', 'mk-note', 'Residents buy while you play, and a little while you are away. Players who are online can buy from your stall too.'))
    }
    root.append(head, body)
    document.body.append(root)
    document.body.classList.add('sheet-open')
  }

  const buyFrom = (r: RemoteStall) => {
    if (!net) { o.toast('Not connected to the city right now.'); return }
    const p = r.price
    const paid = spendInGame(p, 'Market purchase', `${goodsOf(r.goods)!.title} from ${r.name}'s stall.`)
    if (!paid.ok) { o.toast(paid.message); return }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    pendingBuys.set(id, p)
    net.send({ k: 'buy', to: r.from, s: r.stall, g: r.goods, p, id, n: o.myName().slice(0, 24) })
    // No answer in 8 s (they went offline): money back.
    window.setTimeout(() => { if (pendingBuys.has(id)) { pendingBuys.delete(id); earnCash(p, 'Market refund', 'The seller did not answer.'); o.toast(`${r.name} did not answer. Refunded ${money(p)}.`) } }, 8000)
    o.toast(`Buying from ${r.name}…`)
  }

  return {
    onChange(f: () => void) { listeners.add(f); return () => listeners.delete(f) },
    stallState,
    open: panel,
    mine: () => { load(); return mine && active() ? mine : null },
    remotes: () => [...remotes.values()],
    attach(n: MarketNet) { net = n },
    /** A market message from another player (already parsed JSON). */
    receive(m: Record<string, unknown>) {
      const from = typeof m.from === 'string' ? m.from : ''
      if (!from || (net && from === net.id())) return
      if (m.k === 'stall') {
        const g = String(m.g), t = String(m.t), s = Number(m.s)
        if (!goodsOf(g) || !tierOf(t) || !Number.isInteger(s) || s < 0 || s >= RENTABLE) return
        remotes.set(from, { from, name: String(m.n ?? 'Trader').slice(0, 24) || 'Trader', stall: s, goods: g as GoodsId, tier: t as TierId, price: priceOf(g as GoodsId, t as TierId), stock: Math.max(0, Math.min(999, Math.floor(Number(m.st) || 0))), seen: Date.now() })
        changed()
      } else if (m.k === 'buy' && net && m.to === net.id()) {
        load()
        const ok = !!mine && active() && mine.stall === Number(m.s) && mine.goods === m.g && mine.stock > 0 && Math.abs(priceOf(mine.goods, mine.tier) - Number(m.p)) < 0.011
        if (ok) { sell(1, Number(m.p)); o.toast(`${String(m.n ?? 'A player').slice(0, 24)} bought ${goodsOf(mine!.goods)!.title} from your stall (+${money(Number(m.p))}).`); broadcast() }
        net.send({ k: 'bought', to: from, id: String(m.id ?? ''), ok })
      } else if (m.k === 'bought' && net && m.to === net.id()) {
        const id = String(m.id ?? ''), p = pendingBuys.get(id)
        if (p === undefined) return
        pendingBuys.delete(id)
        if (m.ok) o.toast('Bought. Enjoy it.')
        else { earnCash(p, 'Market refund', 'The stall had sold out.'); o.toast(`Sold out. Refunded ${money(p)}.`) }
      }
    },
    /** Every frame: residents buy now and then; your stall is announced to the city; old stalls drop off. */
    tick(dt: number) {
      saleAcc += dt; castAcc += dt
      if (saleAcc >= TICK) {
        saleAcc = 0
        load()
        if (mine && active() && mine.stock > 0 && Math.random() < chance(mine, o.inMarket())) {
          const p = priceOf(mine.goods, mine.tier)
          sell(1, p)
          if (o.inMarket()) o.toast(`A shopper bought ${goodsOf(mine.goods)!.title} at your stall (+${money(p)}).`)
        }
        if (mine) { mine.last = Date.now(); save() }
        const now = Date.now()
        let gone = false
        for (const [k, r] of remotes) if (now - r.seen > 30_000) { remotes.delete(k); gone = true }
        if (gone) changed()
      }
      if (castAcc >= 8) { castAcc = 0; broadcast() }
    },
  }
}
