// A shift at McGrind: customers queue at the counter with an order and a patience bar, and you cook to their order
// on four stations, each a timing skill: lift the fries when they are golden, flip the patty in its window and take
// it off when done, shave the shawarma on the beat and wrap it, and fill drinks to the line (boba needs its pearls
// first). Serve a full order for its price plus a tip for speed and quality. Lunch and dinner are rushes; late night
// is quieter with better tips. Pay is earned in-game cash at the end of the shift (full pay for three shifts a day,
// half after), and a well-rated shift adds a little reputation. Kept on this device; nothing in the save changes.
import { addReputation, earnCash } from './state.ts'
import { drawMcGrindMark } from './brandFronts.ts'

type Item = 'fries' | 'burger' | 'shawarma' | 'shake' | 'smoothie' | 'boba'
type Grade = 'perfect' | 'ok'
const MENU: Record<Item, { icon: string; title: string; price: number }> = {
  fries: { icon: '🍟', title: 'Fries', price: 2.0 },
  burger: { icon: '🍔', title: 'Burger', price: 4.0 },
  shawarma: { icon: '🥙', title: 'Shawarma', price: 4.5 },
  shake: { icon: '🥤', title: 'Milkshake', price: 3.0 },
  smoothie: { icon: '🍹', title: 'Smoothie', price: 3.0 },
  boba: { icon: '🧋', title: 'Boba tea', price: 3.5 },
}
const NAMES = ['Ada', 'Tunde', 'Zainab', 'Chidi', 'Amaka', 'Musa', 'Kemi', 'Ifeanyi', 'Halima', 'Seyi', 'Bola', 'Emeka', 'Fatima', 'Uche', 'Yusuf', 'Ngozi', 'Dayo', 'Aisha']
const SHIFT_SECS = 150
const DAY_KEY = 'gd.mcgrind.day'

type Order = { id: number; name: string; items: Item[]; patience: number; max: number }
type Period = { title: string; every: number; size: [number, number]; tip: number }

/** Which part of the day it is in Lagos: lunch and dinner are rushes, late night is calm with better tips. */
function period(): Period {
  const h = new Date(Date.now() + 3_600_000).getUTCHours()
  if (h >= 11 && h < 15) return { title: 'Lunch rush', every: 5.5, size: [1, 3], tip: 1 }
  if (h >= 17 && h < 21) return { title: 'Dinner rush', every: 5.5, size: [2, 3], tip: 1.05 }
  if (h >= 21 || h < 6) return { title: 'Late night', every: 9, size: [1, 2], tip: 1.35 }
  return { title: 'Day shift', every: 7.5, size: [1, 2], tip: 1 }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }
const money = (n: number) => `$${n.toFixed(2)}`

/** Open a shift. `onEnd` runs when the panel closes. */
export function openShift(o: { toast: (m: string) => void; onEnd?: () => void }): void {
  if (document.getElementById('mg-shift')) return
  const per = period()
  const root = el('div', 'mg-shift'); root.id = 'mg-shift'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'McGrind shift')
  document.body.append(root)
  document.body.classList.add('sheet-open')
  // --- Header: mark, period, clock, takings ---
  const head = el('div', 'mg-head')
  const markC = el('canvas'); markC.width = markC.height = 96; drawMcGrindMark(markC.getContext('2d')!, 0, 0, 96); markC.className = 'mg-mark'
  const title = el('div', 'mg-title'); title.append(el('b', '', 'McGrind shift'), el('small', '', per.title))
  const clock = el('div', 'mg-clock'), till = el('div', 'mg-till')
  const quit = el('button', 'ghost mg-quit', 'End shift'); quit.type = 'button'
  head.append(markC, title, clock, till, quit)
  // --- Queue of customers ---
  const queue = el('div', 'mg-queue')
  // --- Tray of ready food ---
  const tray = el('div', 'mg-tray')
  // --- Stations ---
  const stations = el('div', 'mg-stations')
  root.append(head, queue, tray, stations)

  let t = 0, nextIn = 2, nextId = 1, served = 0, lost = 0, earned = 0, tips = 0, stars = 0, ended = false
  const orders: Order[] = []
  const ready = new Map<Item, Grade[]>()
  const say = (m: string) => { o.toast(m) }
  const addReady = (it: Item, g: Grade, n = 1) => { const l = ready.get(it) ?? []; for (let i = 0; i < n; i++) l.push(g); ready.set(it, l); paintTray() }
  const paintTray = () => {
    tray.replaceChildren(el('span', 'mg-tray-l', 'Ready:'))
    let any = false
    for (const [it, l] of ready) if (l.length) { any = true; const chip = el('span', 'mg-chip', `${MENU[it].icon} ×${l.length}`); chip.title = `${MENU[it].title}: ${l.filter((g) => g === 'perfect').length} perfect`; tray.append(chip) }
    if (!any) tray.append(el('span', 'mg-tray-e', 'nothing yet: cook something below'))
  }
  // --- Orders ---
  const newOrder = () => {
    const n = per.size[0] + Math.floor(Math.random() * (per.size[1] - per.size[0] + 1))
    const pool: Item[] = ['fries', 'burger', 'shawarma', 'shake', 'smoothie', 'boba', 'fries', 'burger']
    const items = Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]!)
    const max = 26 + items.length * 9
    orders.push({ id: nextId++, name: NAMES[Math.floor(Math.random() * NAMES.length)]!, items, patience: max, max })
  }
  const has = (items: Item[]) => {
    const need = new Map<Item, number>(); for (const it of items) need.set(it, (need.get(it) ?? 0) + 1)
    for (const [it, n] of need) if ((ready.get(it)?.length ?? 0) < n) return false
    return true
  }
  const serve = (ord: Order) => {
    if (!has(ord.items)) { say('Not everything on that order is ready yet.'); return }
    let perfect = 0, base = 0
    for (const it of ord.items) { const g = ready.get(it)!.shift()!; if (g === 'perfect') perfect++; base += MENU[it].price }
    const q = perfect / ord.items.length, speed = ord.patience / ord.max
    const tip = base * (0.05 + 0.3 * speed) * (0.5 + 0.5 * q) * per.tip
    earned += base; tips += tip; served++
    stars += 3 + Math.round(q * 1 + speed * 1)
    orders.splice(orders.indexOf(ord), 1)
    say(`${ord.name}: "${q === 1 ? 'Perfect, thank you!' : 'Thanks!'}" +${money(base + tip)}`)
    paintTray(); paintQueue()
  }
  // The line is rebuilt only when it changes (a tap on a button that is replaced mid-press would be lost);
  // the patience bars just move.
  let queueSig = '', bars: Array<{ ord: Order; bar: HTMLElement; fill: HTMLElement }> = []
  const paintQueue = () => {
    const sig = orders.slice(0, 4).map((q) => `${q.id}:${has(q.items) ? 1 : 0}`).join(',') + `|${orders.length}`
    if (sig !== queueSig) {
      queueSig = sig
      bars = []
      queue.replaceChildren(...orders.slice(0, 4).map((ord) => {
        const card = el('div', 'mg-order')
        const who = el('div', 'mg-who'); who.append(el('b', '', ord.name), el('span', 'mg-items', ord.items.map((i) => MENU[i].icon).join(' ')))
        const bar = el('div', 'mg-pat'); const fill = el('i'); bar.append(fill)
        const b = el('button', has(ord.items) ? 'primary mg-serve' : 'ghost mg-serve', 'Serve'); b.type = 'button'; b.onclick = () => serve(ord)
        card.append(who, bar, b)
        bars.push({ ord, bar, fill })
        return card
      }))
      if (!orders.length) queue.append(el('p', 'mg-empty', 'No one in line right now. Cook ahead: fries and drinks keep.'))
      if (orders.length > 4) queue.append(el('p', 'mg-more', `+${orders.length - 4} more waiting`))
    }
    for (const { ord, bar, fill } of bars) { const k = ord.patience / ord.max; fill.style.width = `${Math.max(0, k) * 100}%`; bar.classList.toggle('low', k < 0.3) }
  }

  // --- Station kit: a card with a meter, a target band and buttons ---
  const station = (icon: string, name: string, band: [number, number]) => {
    const card = el('div', 'mg-st')
    const h = el('div', 'mg-st-h'); h.append(el('span', 'mg-ic', icon), el('b', '', name))
    const meter = el('div', 'mg-meter'); const zone = el('span', 'mg-zone'); zone.style.left = `${band[0] * 100}%`; zone.style.width = `${(band[1] - band[0]) * 100}%`
    const fill = el('i'); const mark = el('span', 'mg-mk'); meter.append(zone, fill, mark)
    const note = el('small', 'mg-note')
    const row = el('div', 'mg-row')
    card.append(h, meter, note, row)
    stations.append(card)
    const btn = (label: string, run: () => void, primary = false) => { const b = el('button', primary ? 'primary' : 'ghost', label); b.type = 'button'; b.onclick = run; return b }
    return { card, fill, mark, note, row, btn, zone, setZone: (a: number, b: number) => { zone.style.left = `${a * 100}%`; zone.style.width = `${(b - a) * 100}%` } }
  }

  // Fryer: drop a basket (two portions), lift between 70% and 88% for golden; past 100% they burn.
  const fryer = station('🍟', 'Fryer', [0.7, 0.88])
  let fry = -1
  const fryRow = () => { fryer.row.replaceChildren(fry < 0 ? fryer.btn('Drop fries', () => { fry = 0; fryRow() }, true) : fryer.btn('Lift basket', () => {
    const p = fry; fry = -1; fryRow()
    if (p < 0.6) say('Pale fries: back in next time. Lift when golden.')
    else if (p > 1) say('Burnt. Into the bin.')
    else addReady('fries', p >= 0.7 && p <= 0.88 ? 'perfect' : 'ok', 2)
  }, true)) }
  fryRow()
  // Grill: put a patty on, flip it between 40% and 60%, take it off between 85% and 100%; it becomes a burger.
  const grill = station('🍔', 'Grill', [0.4, 0.6])
  let patty = -1, flipped: Grade | null = null
  const grillRow = () => {
    if (patty < 0) grill.row.replaceChildren(grill.btn('Patty on', () => { patty = 0; flipped = null; grill.setZone(0.4, 0.6); grillRow() }, true))
    else if (!flipped) grill.row.replaceChildren(grill.btn('Flip', () => { flipped = patty >= 0.4 && patty <= 0.6 ? 'perfect' : 'ok'; grill.setZone(0.85, 1); grillRow() }, true))
    else grill.row.replaceChildren(grill.btn('Take off & build', () => {
      const p = patty; patty = -1; grill.setZone(0.4, 0.6); grillRow()
      if (p < 0.75) say('Still pink inside. Leave it longer next time.')
      else if (p > 1.08) say('Burnt patty. Binned.')
      else addReady('burger', flipped === 'perfect' && p >= 0.85 && p <= 1 ? 'perfect' : 'ok')
    }, true))
  }
  grillRow()
  // Shawarma: a marker sweeps the spit; shave three times when it is in the band, then wrap.
  const spit = station('🥙', 'Shawarma', [0.42, 0.58])
  spit.card.classList.add('mg-beat')
  let shaves: number[] = []
  const spitRow = () => {
    spit.row.replaceChildren(spit.btn(`Shave (${shaves.length}/3)`, () => {
      if (shaves.length >= 3) return
      const m = (Math.sin(t * 2.6) + 1) / 2
      shaves.push(m >= 0.42 && m <= 0.58 ? 1 : 0); spitRow()
    }, true), spit.btn('Wrap', () => {
      if (shaves.length < 3) { say('Shave three times before you wrap.'); return }
      addReady('shawarma', shaves.filter(Boolean).length >= 2 ? 'perfect' : 'ok'); shaves = []; spitRow()
    }))
  }
  spitRow()
  // Drinks: pick one (boba: add pearls first), then hold Fill and let go at the line (85% to 96%).
  const bar = station('🥤', 'Drinks', [0.85, 0.96])
  let pick: 'shake' | 'smoothie' | 'boba' | null = null, pearls = false, level = 0, holding = false
  const barRow = () => {
    if (!pick) { bar.row.replaceChildren(...(['shake', 'smoothie', 'boba'] as const).map((d) => bar.btn(`${MENU[d].icon} ${MENU[d].title}`, () => { pick = d; pearls = false; level = 0; barRow() }))); return }
    if (pick === 'boba' && !pearls) { bar.row.replaceChildren(bar.btn('Add pearls', () => { pearls = true; barRow() }, true), bar.btn('Cancel', () => { pick = null; barRow() })); return }
    const fillBtn = bar.btn('Hold to fill', () => undefined, true)
    const start = (e: Event) => { e.preventDefault(); holding = true; level = 0 }
    const stop = () => {
      if (!holding) return
      holding = false
      const d = pick!; pick = null
      if (level < 0.7) say('Half a cup. Poured away.')
      else if (level > 1) say('Spilled over. Wiped down.')
      else addReady(d, level >= 0.85 && level <= 0.96 ? 'perfect' : 'ok')
      level = 0; barRow()
    }
    fillBtn.addEventListener('pointerdown', start); fillBtn.addEventListener('pointerup', stop); fillBtn.addEventListener('pointerleave', stop); fillBtn.addEventListener('pointercancel', stop)
    bar.row.replaceChildren(fillBtn)
  }
  barRow()
  paintTray(); paintQueue()

  // --- The clock: customers arrive, patience runs, food cooks. ---
  let last = performance.now(), paintAcc = 0
  const finish = (early: boolean) => {
    if (ended) return
    ended = true
    const day = (() => { try { const v = JSON.parse(localStorage.getItem(DAY_KEY) ?? 'null') as { d?: string; n?: number } | null; const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10); return v?.d === today ? { d: today, n: v.n ?? 0 } : { d: today, n: 0 } } catch { return { d: '', n: 0 } } })()
    const full = day.n < 3
    const gross = earned + tips
    const pay = Math.round((full ? gross : gross / 2) * 100) / 100
    try { localStorage.setItem(DAY_KEY, JSON.stringify({ d: day.d, n: day.n + 1 })) } catch { /* private mode */ }
    const rating = served ? Math.min(5, stars / served) : 0
    if (pay > 0) earnCash(pay, 'McGrind shift', `${served} customer${served === 1 ? '' : 's'} served${full ? '' : ' (half pay after three shifts today)'}.`)
    if (served >= 5 && rating >= 4) addReputation(1, 'McGrind shift', 'A well-rated shift at McGrind.')
    const sum = el('div', 'mg-sum')
    sum.append(el('h3', '', early ? 'Shift ended early' : 'Shift over'),
      el('p', '', `Served ${served} · walked out ${lost} · rating ${rating ? rating.toFixed(1) : '–'} / 5`),
      el('p', '', `Food ${money(earned)} + tips ${money(tips)}${full ? '' : ' · half pay after three shifts today'} = paid ${money(pay)}`),
      el('p', 'mg-save', 'Bills first, then put a little aside: the next bull run rewards the ones who saved through the bear.'))
    const again = el('button', 'primary', 'Work another shift'); again.type = 'button'
    const done = el('button', 'ghost', 'Done'); done.type = 'button'
    const close = () => { root.remove(); document.body.classList.remove('sheet-open'); o.onEnd?.() }
    again.onclick = () => { close(); openShift(o) }
    done.onclick = close
    sum.append(again, done)
    root.replaceChildren(head, sum)
  }
  quit.onclick = () => finish(true)
  const frame = (now: number) => {
    if (ended || !root.isConnected) return
    const dt = Math.min(0.1, (now - last) / 1000); last = now
    t += dt
    nextIn -= dt
    if (nextIn <= 0 && t < SHIFT_SECS - 8) { newOrder(); nextIn = per.every * (0.7 + Math.random() * 0.6) }
    for (const ord of [...orders]) { ord.patience -= dt; if (ord.patience <= 0) { orders.splice(orders.indexOf(ord), 1); lost++; say(`${ord.name} gave up waiting and left.`) } }
    if (fry >= 0) { fry += dt / 6; if (fry > 1.18) { fry = -1; fryRow(); say('The fries burnt. Lift them sooner.') } }
    if (patty >= 0) { patty += dt / 8; if (patty > 1.2) { patty = -1; grill.setZone(0.4, 0.6); grillRow(); say('A patty burnt on the grill.') } }
    if (holding) { level += dt / 2.2; if (level > 1.06) { holding = false; level = 0; pick = null; say('Spilled over. Wiped down.'); barRow() } }
    paintAcc += dt
    if (paintAcc > 0.05) {
      paintAcc = 0
      fryer.fill.style.width = `${Math.max(0, Math.min(1, fry)) * 100}%`; fryer.note.textContent = fry < 0 ? 'Two portions a basket. Golden, not pale, not burnt.' : fry < 0.6 ? 'Pale…' : fry < 0.7 ? 'Nearly…' : fry <= 0.88 ? 'Golden: lift now!' : 'Darkening!'
      grill.fill.style.width = `${Math.max(0, Math.min(1, patty)) * 100}%`; grill.note.textContent = patty < 0 ? 'Flip in the first window, take off in the second.' : !flipped ? (patty >= 0.4 && patty <= 0.6 ? 'Flip now!' : 'Sizzling…') : patty >= 0.85 && patty <= 1 ? 'Done: take it off!' : 'Cooking the other side…'
      const m = (Math.sin(t * 2.6) + 1) / 2
      spit.mark.style.left = `${m * 100}%`; spit.fill.style.width = '0%'; spit.note.textContent = shaves.length >= 3 ? 'Wrap it.' : 'Tap Shave when the marker is in the band.'
      bar.fill.style.width = `${Math.min(1, level) * 100}%`; bar.note.textContent = !pick ? 'Pick a drink.' : pick === 'boba' && !pearls ? 'Pearls in first.' : holding ? 'Filling…' : 'Hold, and let go at the line.'
      clock.textContent = `${Math.max(0, Math.ceil(SHIFT_SECS - t))}s`
      till.textContent = `${money(earned + tips)} · ${served} served`
      paintQueue()
    }
    if (t >= SHIFT_SECS && !orders.length) return finish(false)
    if (t >= SHIFT_SECS + 20) return finish(false)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
