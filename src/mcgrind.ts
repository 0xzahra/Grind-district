// A shift at McGrind: customers walk up to the counter with an order and a patience bar, and you cook to their
// order on four stations, each a timing skill: lift the fries when they are golden, flip the patty in its window
// and take it off when done, shave the shawarma when the knife is across the crisp band and wrap it, and fill drinks
// to the line (boba needs its pearls first). Serve a full order for its price plus a tip for speed and quality.
// Lunch and dinner are rushes; late night is quieter with better tips. Pay is earned in-game cash at the end of the
// shift (full pay for three shifts a day, half after), and a well-rated shift adds a little reputation. Kept on this
// device; nothing in the save changes.
// Everything is drawn (kitchenArt.ts): the cook's gloved hands do each job you tap, and the customer takes the tray.
// Timing taps answer on press, not release, and the drawing slows to 30 a second if a phone needs it.
import { addReputation, earnCash } from './state.ts'
import { drawMcGrindMark } from './brandFronts.ts'
import { liteOn } from './deviceTier.ts'
import { kitchenSound } from './sfx.ts'
import { CounterArt, DrinksArt, FryerArt, GOOD, GrillArt, OKAY, BAD, SpitArt, kitchenDpr, type Item } from './kitchenArt.ts'

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
const FRY_BAND: [number, number] = [0.7, 0.88]
const FLIP_BAND: [number, number] = [0.4, 0.6]
const DONE_BAND: [number, number] = [0.85, 1]
const SPIT_BAND: [number, number] = [0.4, 0.6]
const FILL_BAND: [number, number] = [0.85, 0.96]

/** `got` holds what has already been handed over, item by item, so part of an order can go out as it is cooked. */
type Order = { id: number; name: string; items: Item[]; got: Array<Grade | null>; patience: number; max: number }
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
/** Set text only when it changed (no layout work for the same words). */
const say0 = (e: HTMLElement, t: string) => { if (e.textContent !== t) e.textContent = t }
/** A button that acts the moment a finger or mouse presses it (a click from the keyboard still works). */
function pressBtn(label: string, run: () => void, primary = false): HTMLButtonElement {
  const b = el('button', primary ? 'primary' : 'ghost', label); b.type = 'button'
  b.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); run() })
  b.addEventListener('click', (e) => { if (e.detail === 0) run() })
  return b
}

/** Open a shift. `onEnd` runs when the panel closes. */
export function openShift(o: { toast: (m: string) => void; onEnd?: () => void }): void {
  if (document.getElementById('mg-shift')) return
  const per = period()
  const dpr = kitchenDpr(liteOn())
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
  // --- The counter: customers, their orders, the pass, and a Serve button under each place in line ---
  const counter = new CounterArt()
  const front = el('div', 'mg-front')
  counter.view.c.className = 'mg-counter'
  counter.view.c.setAttribute('role', 'img')
  const serveRow = el('div', 'mg-serves')
  const serveBtns = [0, 1, 2, 3].map((i) => { const b = pressBtn('Serve', () => serveSlot(i)); b.classList.add('mg-sv'); serveRow.append(b); return b })
  // What just happened, said in the panel itself (the city's toasts sit under the shift panel).
  const sayLine = el('p', 'mg-say'); sayLine.setAttribute('aria-live', 'polite')
  front.append(counter.view.c, serveRow, sayLine)
  counter.view.c.addEventListener('click', (e) => { const i = counter.slotAt(e); if (i >= 0) serveSlot(i) })
  // --- Stations ---
  const stations = el('div', 'mg-stations')
  root.append(head, front, stations)

  let t = 0, nextIn = 2, nextId = 1, served = 0, lost = 0, earned = 0, tips = 0, stars = 0, ended = false
  const orders: Order[] = []
  const ready = new Map<Item, Grade[]>()
  let sayFor = 0
  const say = (m: string) => { sayLine.textContent = m; sayLine.classList.add('on'); sayFor = 4 }
  const passList = () => [...ready].filter(([, l]) => l.length).map(([it, l]) => [it, l.length] as [Item, number])
  const addReady = (it: Item, g: Grade, n = 1) => { const l = ready.get(it) ?? []; for (let i = 0; i < n; i++) l.push(g); ready.set(it, l); counter.setPass(passList()) }
  // --- Orders ---
  const newOrder = () => {
    const n = per.size[0] + Math.floor(Math.random() * (per.size[1] - per.size[0] + 1))
    const pool: Item[] = ['fries', 'burger', 'shawarma', 'shake', 'smoothie', 'boba', 'fries', 'burger']
    const items = Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]!)
    const max = 26 + items.length * 9
    // a name nobody in the line has, so two Serve buttons never read the same
    const free = NAMES.filter((nm) => !orders.some((q) => q.name === nm))
    const name = free[Math.floor(Math.random() * free.length)] ?? NAMES[nextId % NAMES.length]!
    orders.push({ id: nextId++, name, items, got: items.map(() => null), patience: max, max })
  }
  /** What an order still needs (items not handed over yet). */
  const left = (ord: Order) => ord.items.filter((_, i) => !ord.got[i])
  /** Whether everything an order still needs is on the pass now. */
  const has = (ord: Order) => {
    const need = new Map<Item, number>(); for (const it of left(ord)) need.set(it, (need.get(it) ?? 0) + 1)
    for (const [it, n] of need) if ((ready.get(it)?.length ?? 0) < n) return false
    return true
  }
  const names = (l: Item[]) => l.map((it) => MENU[it].title.toLowerCase()).join(' and ')
  // Serving hands over whatever of the order is on the pass; when the last item goes, they pay and leave.
  const serve = (ord: Order) => {
    let moved = 0
    ord.items.forEach((it, i) => { if (ord.got[i]) return; const l = ready.get(it); if (l?.length) { ord.got[i] = l.shift()!; moved++ } })
    if (moved) counter.setPass(passList())
    const still = left(ord)
    if (still.length) {
      if (moved) { counter.note(ord.id, 'Thanks!'); kitchenSound('chop'); say(`Handed ${ord.name} what was ready. Still to cook: ${names(still)}.`) }
      else say(`Nothing for ${ord.name} on the pass yet. Cook ${names(still)}, then tap Serve.`)
      syncLine()
      return
    }
    let perfect = 0, base = 0
    ord.items.forEach((it, i) => { if (ord.got[i] === 'perfect') perfect++; base += MENU[it].price })
    const q = perfect / ord.items.length, speed = ord.patience / ord.max
    const tip = base * (0.05 + 0.3 * speed) * (0.5 + 0.5 * q) * per.tip
    earned += base; tips += tip; served++
    stars += 3 + Math.round(q * 1 + speed * 1)
    orders.splice(orders.indexOf(ord), 1)
    counter.served(ord.id, `+${money(base + tip)}`)
    counter.setPass(passList())
    kitchenSound('bell')
    say(q === 1 ? `${ord.name}: "Perfect, thank you!" +${money(base + tip)}` : `Served ${ord.name}. +${money(base + tip)}`)
    syncLine()
  }
  const serveSlot = (i: number) => { const ord = orders[i]; if (ord) serve(ord) }
  // The line: four fixed buttons under the four places at the counter (never rebuilt, so no tap is lost).
  const syncLine = () => {
    counter.sync(orders.map((q) => ({ id: q.id, name: q.name, items: q.items, got: q.got.map(Boolean), k: q.patience / q.max, ready: has(q) })), Math.max(0, orders.length - 4))
    serveBtns.forEach((b, i) => {
      const ord = orders[i]
      b.style.visibility = ord ? 'visible' : 'hidden'
      if (!ord) return
      // gold when something of theirs is on the pass (all of it, or a part to hand over now)
      const ok = has(ord) || left(ord).some((it) => (ready.get(it)?.length ?? 0) > 0)
      say0(b, `Serve ${ord.name}`)
      b.classList.toggle('primary', ok); b.classList.toggle('ghost', !ok)
    })
  }

  // --- Station kit: a canvas with the cook's hands, a line of guidance, and the buttons ---
  const station = (name: string, view: HTMLCanvasElement) => {
    const card = el('div', 'mg-st')
    view.className = 'mg-cv'
    const info = el('div', 'mg-st-l'), note = el('small', 'mg-note')
    info.append(el('b', '', name), note)
    const row = el('div', 'mg-row')
    card.append(view, info, row)
    stations.append(card)
    return { card, note, row }
  }

  // Fryer: drop a basket (two portions), lift between 70% and 88% for golden; past 100% they burn.
  const fryArt = new FryerArt()
  const fryer = station('Fryer', fryArt.view.c)
  let fry = -1
  const fryBtn = pressBtn('Drop fries', () => {
    if (fry < 0) { fry = 0; fryArt.drop(); kitchenSound('fry'); fryBtn.textContent = 'Lift basket'; return }
    const p = fry; fry = -1; fryBtn.textContent = 'Drop fries'
    if (p < 0.6) { fryArt.lift(p, false); fryArt.pop('Pale: binned', OKAY); say('Pale fries: lift them when golden.') }
    else if (p > 1) { fryArt.lift(p, false); fryArt.pop('Burnt', BAD) }
    else { const g: Grade = p >= FRY_BAND[0] && p <= FRY_BAND[1] ? 'perfect' : 'ok'; fryArt.lift(p, true); fryArt.pop(g === 'perfect' ? 'Golden! ×2' : 'Fries ×2', g === 'perfect' ? GOOD : OKAY); window.setTimeout(() => addReady('fries', g, 2), 700) }
  }, true)
  fryer.row.append(fryBtn)
  // Grill: put a patty on, flip it between 40% and 60%, take it off between 85% and 100%; it becomes a burger.
  const grillArt = new GrillArt()
  const grill = station('Grill', grillArt.view.c)
  let patty = -1, flipped: Grade | null = null
  const grillBtn = pressBtn('Patty on', () => {
    if (patty < 0) { patty = 0; flipped = null; grillArt.flipAt = -1; grillArt.put(); window.setTimeout(() => kitchenSound('sizzle'), 300); grillBtn.textContent = 'Flip'; return }
    if (!flipped) {
      flipped = patty >= FLIP_BAND[0] && patty <= FLIP_BAND[1] ? 'perfect' : 'ok'
      grillArt.flipAt = patty; grillArt.flip(); window.setTimeout(() => kitchenSound('sizzle'), 380)
      grillArt.pop(flipped === 'perfect' ? 'Nice flip!' : patty < FLIP_BAND[0] ? 'Early flip' : 'Late flip', flipped === 'perfect' ? GOOD : OKAY)
      grillBtn.textContent = 'Take off & build'; return
    }
    const p = patty; patty = -1; grillBtn.textContent = 'Patty on'
    if (p < 0.75) { grillArt.off(false); grillArt.pop('Still pink: binned', OKAY); say('Still pink inside. Leave it longer next time.') }
    else if (p > 1.08) { grillArt.off(false); grillArt.pop('Burnt', BAD) }
    else { const g: Grade = flipped === 'perfect' && p >= DONE_BAND[0] && p <= DONE_BAND[1] ? 'perfect' : 'ok'; grillArt.off(true); grillArt.pop(g === 'perfect' ? 'Perfect burger!' : 'Burger', g === 'perfect' ? GOOD : OKAY, 250, 90); window.setTimeout(() => addReady('burger', g), 1100) }
    grillArt.flipAt = -1
  }, true)
  grill.row.append(grillBtn)
  // Shawarma: the knife sweeps the spit; shave three times while it is across the crisp band, then wrap.
  const spitArt = new SpitArt()
  const spit = station('Shawarma', spitArt.view.c)
  let shaves: number[] = []
  const marker = () => (Math.sin(t * 2.6) + 1) / 2
  const shaveBtn = pressBtn('Shave (0/3)', () => {
    if (shaves.length >= 3) { spitArt.pop('Wrap it now', OKAY); return }
    const m = marker(), good = m >= SPIT_BAND[0] && m <= SPIT_BAND[1]
    shaves.push(good ? 1 : 0); spitArt.shaves = shaves; spitArt.shave(m, good); kitchenSound('chop')
    spitArt.pop(good ? 'Crisp!' : 'Off the band', good ? GOOD : OKAY, 128, 24)
    say0(shaveBtn, `Shave (${shaves.length}/3)`)
  }, true)
  const wrapBtn = pressBtn('Wrap', () => {
    if (shaves.length < 3) { spitArt.pop('Shave 3 first', OKAY); return }
    const g: Grade = shaves.filter(Boolean).length >= 2 ? 'perfect' : 'ok'
    spitArt.wrap(); spitArt.pop(g === 'perfect' ? 'Perfect wrap!' : 'Wrapped', g === 'perfect' ? GOOD : OKAY, 250, 120)
    shaves = []; window.setTimeout(() => { spitArt.shaves = shaves; addReady('shawarma', g) }, 1150)
    say0(shaveBtn, 'Shave (0/3)')
  })
  spit.row.classList.add('mg-two'); spit.row.append(shaveBtn, wrapBtn)
  // Drinks: pick one (boba: add pearls first), then hold Fill and let go at the line (85% to 96%).
  const drinkArt = new DrinksArt()
  const bar = station('Drinks', drinkArt.view.c)
  let pick: 'shake' | 'smoothie' | 'boba' | null = null, pearls = false, level = 0, holding = false
  const pickRow = el('div', 'mg-three'), pearlBtn = pressBtn('Add pearls', () => { pearls = true; drinkArt.pearls = true; drinkArt.addPearls(); barRow() }, true)
  const pickBtns = (['shake', 'smoothie', 'boba'] as const).map((d) => pressBtn(d === 'shake' ? 'Shake' : d === 'smoothie' ? 'Smoothie' : 'Boba', () => {
    if (pick) return
    pick = d; pearls = false; level = 0; drinkArt.pick = d; drinkArt.pearls = false; drinkArt.level = 0; drinkArt.place(d); barRow()
  }))
  pickRow.append(...pickBtns)
  const fillBtn = el('button', 'primary mg-fill', 'Hold to fill'); fillBtn.type = 'button'
  const pourStart = (e?: Event) => { e?.preventDefault(); if (!pick || holding) return; holding = true; level = 0; drinkArt.pouring = true; fillBtn.classList.add('on'); say0(fillBtn, 'Let go at the line') }
  const pourStop = () => {
    if (!holding) return
    holding = false; drinkArt.pouring = false; fillBtn.classList.remove('on')
    const d = pick!, lv = level; pick = null; drinkArt.pick = null
    if (lv < 0.7) { drinkArt.done(d, lv, false, false); drinkArt.pop('Half a cup', OKAY); say('Half a cup. Poured away.') }
    else if (lv > 1) { drinkArt.done(d, lv, false, true); drinkArt.pop('Spilled', BAD) }
    else { const g: Grade = lv >= FILL_BAND[0] && lv <= FILL_BAND[1] ? 'perfect' : 'ok'; drinkArt.done(d, lv, true, false); drinkArt.pop(g === 'perfect' ? 'Right on the line!' : MENU[d].title, g === 'perfect' ? GOOD : OKAY); window.setTimeout(() => addReady(d, g), 650) }
    level = 0; drinkArt.level = 0; barRow()
  }
  fillBtn.addEventListener('pointerdown', (e) => { if (e.button === 0) pourStart(e) })
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const) fillBtn.addEventListener(ev, pourStop)
  fillBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) pourStart(e) })
  fillBtn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') pourStop() })
  const cancelBtn = pressBtn('Cancel', () => { pick = null; drinkArt.pick = null; drinkArt.cancel(); barRow() })
  let barState = ''
  const barRow = () => {
    const st = !pick ? 'pick' : pick === 'boba' && !pearls ? 'pearls' : 'fill'
    if (st === barState) return
    barState = st
    if (st === 'pick') bar.row.replaceChildren(pickRow)
    else if (st === 'pearls') { const two = el('div', 'mg-two'); two.append(pearlBtn, cancelBtn); bar.row.replaceChildren(two) }
    else { say0(fillBtn, 'Hold to fill'); bar.row.replaceChildren(fillBtn) }
  }
  barRow()
  counter.setPass([])
  syncLine()

  // --- The clock: customers arrive, patience runs, food cooks; the kitchen is drawn. ---
  let last = performance.now(), textAcc = 0, lastDraw = 0, drawEvery = 0, costEma = 0
  const finish = (early: boolean) => {
    if (ended) return
    ended = true
    for (const v of [counter.view, fryArt.view, grillArt.view, spitArt.view, drinkArt.view]) v.stop()
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
    if (ended || !root.isConnected) { if (!ended) for (const v of [counter.view, fryArt.view, grillArt.view, spitArt.view, drinkArt.view]) v.stop(); return }
    const dt = Math.min(0.1, (now - last) / 1000); last = now
    t += dt
    nextIn -= dt
    let lineChanged = false
    if (nextIn <= 0 && t < SHIFT_SECS - 8) { newOrder(); nextIn = per.every * (0.7 + Math.random() * 0.6); lineChanged = true }
    for (const ord of [...orders]) { ord.patience -= dt; if (ord.patience <= 0) { orders.splice(orders.indexOf(ord), 1); lost++; counter.left(ord.id); say(`${ord.name} gave up waiting and left.`); lineChanged = true } }
    if (fry >= 0) { fry += dt / 6; if (fry > 1.18) { fry = -1; fryBtn.textContent = 'Drop fries'; fryArt.lift(1.2, false); fryArt.pop('Burnt', BAD); say('The fries burnt. Lift them sooner.') } }
    if (patty >= 0) { patty += dt / 8; if (patty > 1.2) { patty = -1; flipped = null; grillBtn.textContent = 'Patty on'; grillArt.off(false); grillArt.flipAt = -1; grillArt.pop('Burnt', BAD); say('A patty burnt on the grill.') } }
    if (holding) { level += dt / 2.2; if (level > 1.06) { level = 1.07; pourStop() } }
    fryArt.cook = fry; grillArt.cook = patty; drinkArt.level = level
    textAcc += dt
    if (sayFor > 0) { sayFor -= dt; if (sayFor <= 0) sayLine.classList.remove('on') }
    if (lineChanged || textAcc > 0.1) syncLine()
    if (textAcc > 0.1) {
      textAcc = 0
      say0(fryer.note, fry < 0 ? 'Two portions a basket. Lift when golden.' : fry < 0.6 ? 'Pale…' : fry < FRY_BAND[0] ? 'Nearly…' : fry <= FRY_BAND[1] ? 'Golden: lift now!' : 'Darkening!')
      say0(grill.note, patty < 0 ? 'Flip in the first window, take off in the second.' : !flipped ? (patty >= FLIP_BAND[0] && patty <= FLIP_BAND[1] ? 'Flip now!' : 'Sizzling…') : patty >= DONE_BAND[0] && patty <= DONE_BAND[1] ? 'Done: take it off!' : 'Cooking the other side…')
      say0(spit.note, shaves.length >= 3 ? 'Three shaves in: wrap it.' : 'Tap Shave when the knife is on the gold band.')
      say0(bar.note, !pick ? 'Pick a drink.' : pick === 'boba' && !pearls ? 'Pearls in first.' : holding ? 'Let go at the green line.' : 'Hold, and let go at the line.')
      say0(clock, `${Math.max(0, Math.ceil(SHIFT_SECS - t))}s`)
      say0(till, `${money(earned + tips)} · ${served} served`)
      const ids = orders.slice(0, 4).map((q) => `${q.name}: ${q.items.map((i) => MENU[i].title).join(', ')}`).join('; ')
      counter.view.c.setAttribute('aria-label', ids ? `At the counter: ${ids}` : 'No one at the counter')
    }
    // Draw at the screen's pace; if the kitchen takes too long to draw on this phone, every other frame instead.
    if (!document.hidden && now - lastDraw >= drawEvery - 3) {
      lastDraw = now
      const c0 = performance.now(), s = c0 / 1000
      counter.draw(s, dpr)
      fryArt.draw(s, FRY_BAND, dpr)
      grillArt.draw(s, flipped ? DONE_BAND : FLIP_BAND, dpr)
      spitArt.draw(s, marker(), SPIT_BAND, dpr)
      drinkArt.draw(s, FILL_BAND, dpr)
      costEma += (performance.now() - c0 - costEma) * 0.1
      if (!drawEvery && costEma > 7) drawEvery = 1000 / 30
    }
    if (t >= SHIFT_SECS && !orders.length) return finish(false)
    if (t >= SHIFT_SECS + 20) return finish(false)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
