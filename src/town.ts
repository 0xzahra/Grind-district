// The town's own economy: residents with wallets, friendships, a business you own, and events you host.
//
// - Residents with wallets. Each named resident holds in-game dollars. They are paid a daily wage and spend it
//   at player businesses and events. A resident who has no money left does not buy, so what the town can spend
//   in a day is bounded by what it earns: the economy has a real ceiling, not a tap.
// - Friendships. Say hello to a resident once a day, or bring a small gift. Stranger, Acquaintance, Friend,
//   Close friend. Friends visit your business more often, pay a little more and come to your events.
// - Your business. Buy a licence in the Market hall, name it (brands welcome), buy stock wholesale and set a price.
//   Every few minutes each resident decides whether to visit: they buy if your price is at or under what the item
//   is worth to them that visit and they can afford it. Price too high and the stock sits; too low and you sell
//   out for little. Rent comes out of the till once a day. The market settles from what players and residents do,
//   with no step that a developer has to patch.
// - Events. Book the conference hall, residents with money and time buy a ticket, and you earn reputation.
// Simulated, in-game dollars only. A visit is decided by a fixed hash of the resident, the business and the time
// slot, so the same moment always plays out the same way: nothing is rolled when you press a button.
// Stored per save slot beside the save (save format unchanged).
import { slotKey, getSave, earnCash, spendInGame, addReputation } from './state.ts'
import { RESIDENTS } from './npcs.ts'
import { socialised } from './needs.ts'

export type BizKind = 'juice' | 'sweets' | 'books' | 'salon' | 'print'
export const KINDS: Record<BizKind, { label: string; item: string; licence: number; unit: number; fair: number; rent: number; pitch: string }> = {
  juice: { label: 'Juice bar', item: 'juice', licence: 300, unit: 2, fair: 5, rent: 6, pitch: 'Fresh juice and smoothies. Cheap stock, quick sales.' },
  sweets: { label: 'Confectionery', item: 'box of sweets', licence: 380, unit: 2.5, fair: 6, rent: 7, pitch: 'Chin chin, chocolates and cakes. A treat people come back for.' },
  books: { label: 'Bookshop', item: 'book', licence: 520, unit: 6, fair: 14, rent: 9, pitch: 'Books and study guides. Fewer sales, more on each.' },
  salon: { label: 'Salon chair', item: 'appointment', licence: 650, unit: 5, fair: 18, rent: 12, pitch: 'Cuts, braids and styling. Supplies cost little; your price is your name.' },
  print: { label: 'Print and merch studio', item: 'print', licence: 800, unit: 8, fair: 22, rent: 14, pitch: 'Posters, shirts and merch for brands and events.' },
}
const TICK_MS = 5 * 60_000 // one market slot
const MAX_CATCH_UP = 24 // slots simulated after time away (two hours)
const STOCK_LOT = 10
const WALLET_CAP = 400
export const LEVELS = ['Stranger', 'Acquaintance', 'Friend', 'Close friend'] as const
const LEVEL_AT = [0, 10, 30, 60]
const HELLO_PTS = 2, GIFT_PTS = 6, GIFT_USD = 10
export const EVENT_HIRE = 120, TICKET = 6

type Friend = { pts: number; helloDay?: string; giftDay?: string }
export type Biz = { kind: BizKind; name: string; price: number; stock: number; till: number; sold: number; openedAt: number; day: string; dayUnits: number; dayRevenue: number; cool: Record<string, number> }
type Sale = { at: number; who: string; usd: number }
type Town = { wallets: Record<string, number>; paidDay: string; friends: Record<string, Friend>; biz: Biz | null; simAt: number; rentDay: string; sales: Sale[]; eventDay?: string }

const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA')
const key = () => `${slotKey()}.town`
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 } return h }
const unit = (s: string) => hash(s) / 4294967296 // 0..1, fixed for the same text
const cents = (n: number) => Math.round(n * 100) / 100
const wage = (name: string) => 22 + Math.round(unit(`wage:${name}`) * 38) // $22 to $60 a day
const blank = (): Town => ({ wallets: Object.fromEntries(RESIDENTS.map((r) => [r.name, 40 + Math.round(unit(`start:${r.name}`) * 80)])), paidDay: dayKey(), friends: {}, biz: null, simAt: Date.now(), rentDay: dayKey(), sales: [] })

let t: Town | null = null
let loadedFor = ''
function load(): Town {
  const k = key()
  if (t && loadedFor === k) return t
  loadedFor = k
  try { const raw = JSON.parse(localStorage.getItem(k) ?? 'null') as Partial<Town> | null; t = raw?.wallets ? { ...blank(), ...raw, wallets: { ...blank().wallets, ...raw.wallets } } : blank() } catch { t = blank() }
  return t
}
function store(): void { try { if (t) localStorage.setItem(key(), JSON.stringify(t)) } catch { /* private mode */ } }

export const levelOf = (name: string): number => { const p = load().friends[name]?.pts ?? 0; let l = 0; for (let i = 0; i < LEVEL_AT.length; i++) if (p >= LEVEL_AT[i]!) l = i; return l }
export const walletOf = (name: string): number => load().wallets[name] ?? 0

/** Wages land once a day; rent leaves the till once a day; then the market slots since the last visit play out. */
export function simulate(now = Date.now()): number {
  const s = load()
  const today = dayKey(now)
  if (s.paidDay !== today) { s.paidDay = today; for (const r of RESIDENTS) s.wallets[r.name] = Math.min(WALLET_CAP, cents((s.wallets[r.name] ?? 0) + wage(r.name))) }
  const b = s.biz
  let sold = 0
  if (b) {
    if (b.day !== today) { b.day = today; b.dayUnits = 0; b.dayRevenue = 0 }
    if (s.rentDay !== today) { s.rentDay = today; b.till = cents(Math.max(0, b.till - KINDS[b.kind].rent)) }
    const first = Math.floor(s.simAt / TICK_MS) + 1, last = Math.floor(now / TICK_MS)
    for (let slot = Math.max(first, last - MAX_CATCH_UP + 1); slot <= last; slot++) {
      for (const r of RESIDENTS) {
        if ((b.cool[r.name] ?? 0) > 0) { b.cool[r.name]! -= 1; continue }
        if (b.stock <= 0) break
        const lvl = levelOf(r.name)
        if (unit(`visit:${slot}:${r.name}:${b.kind}`) > 0.16 + 0.05 * lvl) continue // not passing by this slot
        const worth = KINDS[b.kind].fair * (0.6 + 0.9 * unit(`worth:${slot}:${r.name}:${b.kind}`)) * (1 + 0.08 * lvl)
        const purse = s.wallets[r.name] ?? 0
        if (b.price > worth || purse < b.price) continue
        s.wallets[r.name] = cents(purse - b.price)
        b.till = cents(b.till + b.price); b.stock -= 1; b.sold += 1; b.dayUnits += 1; b.dayRevenue = cents(b.dayRevenue + b.price)
        b.cool[r.name] = 3 + Math.floor(unit(`cool:${slot}:${r.name}`) * 4) // they have had theirs for a while
        s.sales.unshift({ at: slot * TICK_MS, who: r.name, usd: b.price }); if (s.sales.length > 12) s.sales.length = 12
        sold += 1
      }
    }
  }
  s.simAt = now
  store()
  return sold
}

type Outcome = { ok: boolean; message: string }
export function openBusiness(kind: BizKind, name: string): Outcome {
  const s = load()
  if (s.biz) return { ok: false, message: 'You already run a business. Close it before opening another.' }
  const k = KINDS[kind]
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 28) || `${getSave().name || 'My'} ${k.label}`
  const r = spendInGame(k.licence, `Business licence · ${k.label}`, `${clean} opens in the Market hall.`)
  if (!r.ok) return r
  s.biz = { kind, name: clean, price: k.fair, stock: STOCK_LOT, till: 0, sold: 0, openedAt: Date.now(), day: dayKey(), dayUnits: 0, dayRevenue: 0, cool: {} }
  s.simAt = Date.now(); s.rentDay = dayKey()
  store()
  window.setTimeout(() => addReputation(5, 'Reputation: opened a business', `${clean} is open.`), 0)
  return { ok: true, message: `${clean} is open with ${STOCK_LOT} in stock. Set your price and restock when it runs low.` }
}
export function restock(lots = 1): Outcome {
  const s = load(), b = s.biz
  if (!b) return { ok: false, message: 'No business yet.' }
  const n = STOCK_LOT * lots, cost = cents(KINDS[b.kind].unit * n)
  const r = spendInGame(cost, `Stock for ${b.name}`, `${n} × ${KINDS[b.kind].item} at wholesale.`)
  if (!r.ok) return r
  b.stock += n; store()
  return { ok: true, message: `${n} more in stock.` }
}
export function setPrice(delta: number): number {
  const s = load(), b = s.biz
  if (!b) return 0
  const k = KINDS[b.kind]
  b.price = cents(Math.min(k.fair * 3, Math.max(k.unit, b.price + delta)))
  store()
  return b.price
}
export function rename(name: string): void { const b = load().biz; if (!b) return; const clean = name.replace(/\s+/g, ' ').trim().slice(0, 28); if (clean) { b.name = clean; store() } }
export function collect(): Outcome {
  const s = load(), b = s.biz
  if (!b || b.till <= 0) return { ok: false, message: 'The till is empty.' }
  const usd = b.till
  b.till = 0; store()
  earnCash(usd, `Takings from ${b.name}`, 'Paid by residents from their own wallets.')
  return { ok: true, message: `$${usd.toFixed(2)} from the till is in your balance.` }
}
export function closeBusiness(): Outcome {
  const s = load(), b = s.biz
  if (!b) return { ok: false, message: 'No business to close.' }
  const back = cents(KINDS[b.kind].licence * 0.5 + b.till + b.stock * KINDS[b.kind].unit * 0.5)
  s.biz = null; store()
  earnCash(back, `Closed ${b.name}`, 'Half the licence, the till and half the stock value.')
  return { ok: true, message: `${b.name} is closed. $${back.toFixed(2)} returned.` }
}
export const business = (): Biz | null => load().biz
export const recentSales = (): Sale[] => load().sales

export function hello(name: string): Outcome {
  const s = load(), f = (s.friends[name] ??= { pts: 0 }), today = dayKey()
  if (f.helloDay === today) return { ok: false, message: `You have already said hello to ${name} today.` }
  return bump(name, f, HELLO_PTS, () => { f.helloDay = today; socialised(6) }, `You said hello to ${name}.`)
}
export function gift(name: string): Outcome {
  const s = load(), f = (s.friends[name] ??= { pts: 0 }), today = dayKey()
  if (f.giftDay === today) return { ok: false, message: `${name} has had a gift from you today.` }
  const r = spendInGame(GIFT_USD, `Gift for ${name}`, 'A small thoughtful gift.')
  if (!r.ok) return r
  return bump(name, f, GIFT_PTS, () => { f.giftDay = today; socialised(10) }, `${name} loved the gift.`)
}
function bump(name: string, f: Friend, pts: number, mark: () => void, line: string): Outcome {
  const before = levelOf(name)
  f.pts += pts; mark(); store()
  const after = levelOf(name)
  if (after > before) {
    const rep = after === 1 ? 1 : after === 2 ? 3 : 5
    window.setTimeout(() => addReputation(rep, `Reputation: ${name} is now ${after === 1 ? 'an acquaintance' : after === 2 ? 'a friend' : 'a close friend'}`, 'Friendships take showing up.'), 0)
    return { ok: true, message: `${line} ${name} is now ${after === 1 ? 'an Acquaintance' : after === 2 ? 'a Friend' : 'a Close friend'}.` }
  }
  return { ok: true, message: line }
}
export const friendLine = (name: string): string => `${LEVELS[levelOf(name)]} · wallet $${Math.round(walletOf(name))}`

/** Book the hall once a day. Residents who can afford a ticket and are passing come; friends come more readily. */
export function hostEvent(title: string): Outcome {
  const s = load(), today = dayKey()
  if (s.eventDay === today) return { ok: false, message: 'You have hosted today. The hall is free again tomorrow.' }
  const r = spendInGame(EVENT_HIRE, 'Conference hall hire', title)
  if (!r.ok) return r
  simulate()
  let guests = 0
  for (const res of RESIDENTS) {
    const lvl = levelOf(res.name)
    if (unit(`event:${today}:${res.name}`) > 0.35 + 0.15 * lvl) continue
    if ((s.wallets[res.name] ?? 0) < TICKET) continue
    s.wallets[res.name] = cents((s.wallets[res.name] ?? 0) - TICKET); guests += 1
  }
  s.eventDay = today; store()
  const takings = guests * TICKET
  if (takings > 0) earnCash(takings, `Tickets for ${title}`, `${guests} resident${guests === 1 ? '' : 's'} bought a ticket.`)
  const rep = 3 + Math.min(9, guests)
  window.setTimeout(() => addReputation(rep, 'Reputation: hosted an event', `${title}: ${guests} in the room.`), 0)
  return { ok: true, message: `${guests} resident${guests === 1 ? '' : 's'} came to ${title}. Tickets brought in $${takings}, the hall cost $${EVENT_HIRE}.` }
}
export const hostedToday = (): boolean => load().eventDay === dayKey()

// ---- Panels ---------------------------------------------------------------------------------------------------

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement; finish: (m: string) => void; reopen: () => void }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
const usd = (n: number) => `$${n.toFixed(2)}`

function residentsList(h: H): HTMLElement {
  const box = el('div', 'town-people')
  for (const r of [...RESIDENTS].sort((a, b) => levelOf(b.name) - levelOf(a.name) || walletOf(b.name) - walletOf(a.name))) {
    const row = el('div', 'town-person')
    const lvl = levelOf(r.name)
    row.append(el('b', '', r.name), el('span', '', r.trait), el('em', `lv${lvl}`, LEVELS[lvl]), el('i', '', `$${Math.round(walletOf(r.name))}`))
    box.append(row)
  }
  void h
  return box
}

/** The Market hall: start a business, or run the one you have. */
export function marketNodes(h: H): HTMLElement[] {
  const sold = simulate()
  const b = business()
  const out: HTMLElement[] = []
  if (!b) {
    out.push(h.para('Own a business in the city. Buy a licence, name it, stock it and set your price. Residents pay from their own wallets, so the town can only spend what it earns.'))
    const name = el('input', 'town-name') as HTMLInputElement
    name.placeholder = 'Name your business (your brand is welcome)'; name.maxLength = 28; name.autocomplete = 'off'
    out.push(name)
    for (const [id, k] of Object.entries(KINDS) as Array<[BizKind, (typeof KINDS)[BizKind]]>) {
      out.push(h.button(`${k.label} · licence $${k.licence}`, 'primary', () => { const r = openBusiness(id, name.value); h.finish(r.message); if (r.ok) h.reopen() }))
      out.push(h.para(`${k.pitch} Stock costs ${usd(k.unit)} each; residents think about ${usd(k.fair)} is fair. Rent $${k.rent} a day.`, 'muted'))
    }
  } else {
    const k = KINDS[b.kind]
    if (sold) out.push(h.para(`${sold} sale${sold === 1 ? '' : 's'} since you last looked.`, 'town-note'))
    const card = el('div', 'town-card')
    card.append(el('strong', '', b.name), el('span', '', `${k.label} · open since ${new Date(b.openedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`))
    out.push(card)
    const tiles = el('div', 'town-tiles')
    for (const [label, value] of [['In the till', usd(b.till)], ['In stock', String(b.stock)], ['Sold today', `${b.dayUnits} · ${usd(b.dayRevenue)}`], ['Sold in all', String(b.sold)]] as const) { const tile = el('div', 'town-tile'); tile.append(el('span', '', label), el('b', '', value)); tiles.append(tile) }
    out.push(tiles)
    const margin = b.price - k.unit
    const priceRow = el('div', 'town-price')
    const shown = el('b', '', usd(b.price))
    const hint = el('span', '', '')
    const say = () => { const p = business()!.price; shown.textContent = usd(p); hint.textContent = p > k.fair * 1.35 ? 'High: few residents will pay this.' : p < k.fair * 0.8 ? 'Low: it will sell fast for little.' : 'About what residents think is fair.' }
    const minus = h.button('−', 'ghost', () => { setPrice(-0.5); say() }), plus = h.button('+', 'ghost', () => { setPrice(0.5); say() })
    minus.setAttribute('aria-label', 'Lower the price'); plus.setAttribute('aria-label', 'Raise the price')
    priceRow.append(minus, shown, plus); say()
    out.push(el('h4', 'town-h', `Your price per ${k.item}`), priceRow, hint)
    out.push(h.para(`Each one costs you ${usd(k.unit)}, so you keep ${usd(Math.max(0, margin))} on a sale at this price. Rent is $${k.rent} a day, taken from the till.`, 'muted'))
    out.push(h.button(`Collect the till · ${usd(b.till)}`, b.till > 0 ? 'primary' : 'ghost', () => { h.finish(collect().message); h.reopen() }))
    out.push(h.button(`Restock ${STOCK_LOT} · ${usd(k.unit * STOCK_LOT)}`, b.stock <= 3 ? 'primary' : 'ghost', () => { h.finish(restock().message); h.reopen() }))
    if (b.stock <= 0) out.push(h.para('Sold out. Nobody can buy until you restock.', 'town-note'))
    const sales = recentSales()
    if (sales.length) {
      out.push(el('h4', 'town-h', 'Latest customers'))
      const list = el('div', 'town-sales')
      for (const sale of sales.slice(0, 6)) { const row = el('div', 'town-sale'); row.append(el('b', '', sale.who), el('span', '', new Date(sale.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })), el('i', '', usd(sale.usd))); list.append(row) }
      out.push(list)
    }
    const name = el('input', 'town-name') as HTMLInputElement
    name.value = b.name; name.maxLength = 28; name.autocomplete = 'off'; name.setAttribute('aria-label', 'Business name')
    out.push(el('h4', 'town-h', 'Name on the sign'), name, h.button('Save the name', 'ghost', () => { rename(name.value); h.finish('Name saved.'); h.reopen() }))
    out.push(h.button('Close the business', 'ghost', () => { h.finish(closeBusiness().message); h.reopen() }))
  }
  out.push(el('h4', 'town-h', 'Residents and their wallets'))
  out.push(h.para('Wages land once a day. Greet residents around the city to make friends: friends shop with you more often.', 'muted'))
  out.push(residentsList(h))
  return out
}

/** Host your own event: one extra block for the Conference centre panel. */
export function hostNodes(h: H): HTMLElement[] {
  const out: HTMLElement[] = [el('h4', 'town-h', 'Host your own event')]
  out.push(h.para(`Book the hall for $${EVENT_HIRE} in-game: an AMA, a meetup or a launch for your project or brand. Residents who are free and can afford a $${TICKET} ticket come along, friends first. Once a day.`, 'muted'))
  const title = el('input', 'town-name') as HTMLInputElement
  title.placeholder = 'Event title, e.g. Builders AMA'; title.maxLength = 40; title.autocomplete = 'off'
  out.push(title)
  out.push(h.button(hostedToday() ? 'Hosted today' : `Book the hall · $${EVENT_HIRE}`, hostedToday() ? 'ghost' : 'primary', () => { const r = hostEvent(title.value.trim().slice(0, 40) || 'Community meetup'); h.finish(r.message); if (r.ok) h.reopen() }))
  return out
}
