// Wallet: the rank road and the shop row.
// - Rank road: six medallions, shrimp to whale, each in its own metal; your rank glows, the next one is lit, a
//   bar shows how close you are (no numbers: the city shows reputation, not XP). Tap a medallion for its card;
//   the next rank can be bought from that card once topped up, as before.
// - Things to buy: a row of product cards with real renders (cars, jet, phone, drone from the showroom), the
//   price, and a tap to the shop that sells it.
import { RANKS, RANK_START, rankFor, progressToNext } from './logic.ts'
import { getSave } from './state.ts'
import { itemPic } from './itemPics.ts'

const GLYPH = ['🦐', '🦀', '🐟', '🐬', '🦈', '🐋']
const METAL = ['copper', 'bronze', 'silver', 'gold', 'platinum', 'obsidian']
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const usd0 = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
let picked: number | null = null

function medal(i: number, size: 'sm' | 'lg'): HTMLElement {
  const m = el('span', '', `rk-medal ${METAL[i]} ${size}`)
  m.append(el('span', GLYPH[i]!, 'rk-glyph'))
  return m
}

/** The rank road. `buy` is offered on the next rank's card when allowed. */
export function renderRankRoad(root: HTMLElement, o: { toppedUp: number; total: number; buy: (i: number) => void }): void {
  const s = getSave()
  const now = RANKS.findIndex((r) => r.id === rankFor(s.xp).id)
  const sel = Math.min(RANKS.length - 1, picked ?? Math.min(RANKS.length - 1, now + 1))
  const box = el('div', '', 'rk')
  const head = el('div', '', 'rk-head')
  const nextR = RANKS[now + 1]
  const bar = el('span', '', 'rk-bar'); const fill = el('i'); fill.style.width = `${Math.round((nextR ? progressToNext(s.xp) : 1) * 100)}%`; bar.append(fill)
  head.append(el('small', 'Your rank'), el('b', `${GLYPH[now]} ${RANKS[now]!.label}`), bar, el('small', nextR ? `Next: ${nextR.label}. Learn on Campus, or buy it below.` : 'Top of the ladder.', 'rk-note'))
  const road = el('div', '', 'rk-road')
  RANKS.forEach((r, i) => {
    const b = el('button', '', `rk-stop${i < now ? ' done' : ''}${i === now ? ' now' : ''}${i === now + 1 ? ' next' : ''}${i === sel ? ' sel' : ''}`); b.type = 'button'
    b.append(medal(i, 'sm'), el('small', r.label))
    b.onclick = () => { picked = i; renderRankRoad(root, o) }
    road.append(b)
  })
  const r = RANKS[sel]!
  const card = el('div', '', `rk-card ${METAL[sel]}`)
  const info = el('div'); info.append(el('b', r.label), el('small', `Level balance ${usd0(RANK_START[r.id])}`))
  card.append(medal(sel, 'lg'), info)
  if (sel < now) card.append(el('span', 'Reached', 'rk-tag'))
  else if (sel === now) card.append(el('span', 'Your rank', 'rk-tag on'))
  else if (sel === now + 1) {
    const price = RANK_START[r.id]
    const ok = o.toppedUp > 5 && o.total >= price
    const btn = el('button', `Buy · ${usd0(price)}`, 'rk-buy'); btn.type = 'button'; btn.disabled = !ok
    btn.onclick = () => { picked = null; o.buy(sel) }
    card.append(btn)
  } else card.append(el('span', '🔒 Later', 'rk-tag'))
  const foot = el('p', sel === now + 1 && o.toppedUp <= 5 ? 'Top up more than $5 to buy the next rank. Ranks are always free to earn by learning.' : 'Ranks are earned free by learning and showing up.', 'cc-muted rk-foot')
  box.append(head, road, card, foot)
  root.replaceChildren(box)
  requestAnimationFrame(() => { const on = road.querySelector<HTMLElement>('.sel'); if (on) road.scrollLeft = Math.max(0, on.offsetLeft - (road.clientWidth - on.offsetWidth) / 2) })
}

export type ShopCard = { title: string; sub: string; price: string; pic?: string; icon?: string; tone: string; go: () => void }
const ICONS: Record<string, string> = {
  look: '<svg viewBox="0 0 48 48"><path d="M19 5c1 3 3 4 5 4s4-1 5-4l3 2-2 9c3 4 5 12 7 26H11c2-14 4-22 7-26L16 7l3-2Z"/><path d="M18 16h12M24 9v7"/></svg>',
  pass: '<svg viewBox="0 0 48 48"><rect x="7" y="12" width="34" height="24" rx="4"/><path d="M13 30h10M30 18l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L23 25l6-1 3-6"/></svg>',
  house: '<svg viewBox="0 0 48 48"><path d="M8 22 24 9l16 13v17H8V22Z"/><path d="M19 39V28h10v11"/></svg>',
  lounge: '<svg viewBox="0 0 48 48"><path d="M8 26v-6a4 4 0 0 1 8 0v4h16v-4a4 4 0 0 1 8 0v6a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z"/><path d="M12 30v6M36 30v6"/></svg>',
  makeup: '<svg viewBox="0 0 48 48"><rect x="19" y="20" width="10" height="20" rx="2"/><path d="M20 20v-7l8-5v12"/></svg>',
}
/** A swipeable row of product cards. */
export function renderShopRow(root: HTMLElement, cards: ShopCard[]): void {
  const row = el('div', '', 'shop-row')
  for (const c of cards) {
    const b = el('button', '', `shop-card ${c.tone}`); b.type = 'button'
    const media = el('span', '', 'shop-media')
    if (c.pic) media.append(itemPic(c.pic, c.title))
    else if (c.icon) { const i = el('span', '', 'shop-icon'); i.innerHTML = ICONS[c.icon] ?? ''; media.append(i) }
    const txt = el('span', '', 'shop-txt'); txt.append(el('b', c.title), el('small', c.sub))
    const foot = el('span', '', 'shop-foot'); foot.append(el('strong', c.price), el('span', 'Shop ›', 'shop-go'))
    b.append(media, txt, foot); b.onclick = c.go
    row.append(b)
  }
  root.replaceChildren(row)
}
