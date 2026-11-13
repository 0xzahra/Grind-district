// Wallet holdings, under Recent: three tabs like a real wallet app.
// - Assets: cash and stablecoins (the in-game dollar balance, topped up from USDC), coins, meme coins and the
//   city's tokens, each valued at practice prices.
// - NFTs: certificates minted on NEAR, read from the chain, with a link to each token; passed courses not yet
//   minted are counted, with the way to mint them.
// - Watchlist: starred coins with today's move (from the first price seen today on this device).
// Nothing here is shared on the public profile.
import { getSave, balanceSplit } from './state.ts'
import { COINS, SKILL_ORDER } from './logic.ts'
import { certNfts, certNftOn, certNftNetwork, heldNow, type HeldCert } from './nftAccess.ts'

type Tab = 'assets' | 'nfts' | 'watch'
let tab: Tab = 'assets'
const WATCH = 'gd.wallet.watch', OPEN = 'gd.wallet.open'
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const usd = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const px = (n: number) => (n >= 1 ? usd(n) : '$' + n.toPrecision(3))
const read = <T>(k: string, d: T): T => { try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d } catch { return d } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

const price = (id: string) => getSave().coinPrices[id] ?? COINS.find((c) => c.id === id)?.base ?? 0
/** Today's opening prices on this device (set the first time the wallet opens each day). */
function opens(): Record<string, number> {
  const day = new Date().toLocaleDateString('en-CA')
  const o = read<{ day: string; p: Record<string, number> }>(OPEN, { day: '', p: {} })
  if (o.day !== day) { o.day = day; o.p = Object.fromEntries(COINS.map((c) => [c.id, price(c.id)])); write(OPEN, o) }
  return o.p
}
const watched = (): string[] => read<string[]>(WATCH, ['btc', 'eth', 'sol'])

function row(ico: string, icoCls: string, name: string, sub: string, right: string, rightCls = '', extra?: HTMLElement): HTMLElement {
  const r = el('div', '', 'wal-tx')
  const nm = el('div'); nm.append(el('b', name), el('small', sub))
  const end = el('span', '', `wal-tx-amt ${rightCls}`.trim())
  end.textContent = right
  r.append(el('span', ico, `wal-tx-ico ${icoCls}`), nm, extra ?? end)
  if (extra) r.append(end)
  return r
}

function assets(box: HTMLElement): void {
  const s = getSave(), b = balanceSplit()
  const group = (title: string, rows: HTMLElement[]) => { if (!rows.length) return; box.append(el('p', title, 'wal-group')); for (const r of rows) box.append(r) }
  group('Cash & stablecoins', [row('$', 'cash', 'USD balance', `Earned ${usd(b.earned)} · topped up ${usd(b.toppedUp)} from USDC`, usd(b.total))])
  const coin = (cat: string) => COINS.filter((c) => c.cat === cat).flatMap((c) => {
    const q = s.coins[c.id]?.qty ?? 0
    if (!(q > 0)) return []
    const [sym, name] = c.label.split(' · ')
    return [row(sym!.slice(0, 4), cat, name ?? sym!, `${q.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${sym}`, usd(q * price(c.id)))]
  })
  group('Coins', [...coin('big'), ...coin('alt')])
  group('Meme coins', coin('meme'))
  const toks: HTMLElement[] = []
  if (s.unit.qty > 0) toks.push(row('GDC', 'tok', 'District Coin', `${s.unit.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })} GDC`, usd(s.unit.qty * s.unitPrice)))
  if (s.meme.qty > 0) toks.push(row('MEME', 'tok', 'Meme Token', `${s.meme.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })} MEME`, usd(s.meme.qty * s.memePrice)))
  group('Tokens', toks)
  const held = COINS.some((c) => (s.coins[c.id]?.qty ?? 0) > 0) || s.unit.qty > 0 || s.meme.qty > 0
  if (!held) box.append(el('p', 'No coins or tokens yet. Buy some on the Trade screen with practice money.', 'cc-muted wal-empty'))
}

function nfts(box: HTMLElement, go: { profile: () => void }): void {
  const s = getSave()
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
  const paint = (held: HeldCert[], note = '') => {
    box.replaceChildren()
    box.append(el('p', `Certificates · ${certNftNetwork}`, 'wal-group'))
    for (const h of held) {
      const a = el('a', '', 'wal-nft'); a.href = h.explorer; a.target = '_blank'; a.rel = 'noopener'
      const art = el('span', '', 'wal-nft-art'); art.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 7.5 12 12l9.5-4.5L12 3Zm-6 6.4V14c0 1.9 2.7 3.5 6 3.5s6-1.6 6-3.5V9.4M21.5 7.5v6"/></svg>'
      const nm = el('div'); nm.append(el('b', h.title), el('small', `Soulbound certificate · token #${h.tokenId}`))
      a.append(art, nm, el('span', 'View ›', 'wal-see'))
      box.append(a)
    }
    const unminted = passed.length - held.length
    if (!held.length) box.append(el('p', note || (passed.length ? 'None minted yet.' : 'Pass a course on Campus to earn your first certificate.'), 'cc-muted wal-empty'))
    if (unminted > 0) {
      const more = el('button', `${unminted} passed course${unminted > 1 ? 's' : ''} ready to mint · Open your CV ›`, 'wal-mint'); more.type = 'button'
      more.onclick = go.profile
      box.append(more)
    }
  }
  if (!certNftOn() || !s.username) { paint([], 'Sign in to see certificates minted to your account.'); return }
  const now = heldNow()
  paint(now, now.length ? '' : 'Reading NEAR…')
  certNfts().then((held) => { if (box.isConnected && tab === 'nfts') paint(held) }).catch(() => { if (box.isConnected && tab === 'nfts') paint(heldNow(), 'Could not reach NEAR right now.') })
}

function watch(box: HTMLElement, rerender: () => void): void {
  const op = opens(), list = watched()
  box.append(el('p', 'Watchlist · today', 'wal-group'))
  const star = (id: string, on: boolean) => {
    const b = el('button', on ? '★' : '☆', `wal-star${on ? ' on' : ''}`); b.type = 'button'
    b.setAttribute('aria-label', on ? 'Remove from watchlist' : 'Add to watchlist')
    b.onclick = () => { const w = watched(); write(WATCH, on ? w.filter((x) => x !== id) : [...w, id]); rerender() }
    return b
  }
  for (const id of list) {
    const c = COINS.find((x) => x.id === id); if (!c) continue
    const now = price(id), o = op[id] || now, ch = o ? ((now - o) / o) * 100 : 0
    const [sym, name] = c.label.split(' · ')
    const r = row(sym!.slice(0, 4), c.cat, name ?? sym!, `${px(now)}`, `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`, ch > 0.005 ? 'in' : ch < -0.005 ? 'out' : '')
    r.append(star(id, true)); box.append(r)
  }
  if (!list.length) box.append(el('p', 'Star coins below to follow them here.', 'cc-muted wal-empty'))
  const rest = COINS.filter((c) => !list.includes(c.id))
  if (rest.length) {
    box.append(el('p', 'Add to watchlist', 'wal-group'))
    const chips = el('div', '', 'wal-chips')
    for (const c of rest) { const b = el('button', `☆ ${c.label.split(' · ')[0]}`, 'wal-chip'); b.type = 'button'; b.onclick = () => { write(WATCH, [...watched(), c.id]); rerender() }; chips.append(b) }
    box.append(chips)
  }
}

/** Draw the tabbed holdings card into root (redraws itself on tab changes). */
export function renderHoldings(root: HTMLElement, go: { profile: () => void }): void {
  const card = el('div', '', 'wal-hold')
  const seg = el('div', '', 'wal-seg')
  for (const [id, label] of [['assets', 'Assets'], ['nfts', 'NFTs'], ['watch', 'Watchlist']] as const) {
    const b = el('button', label, tab === id ? 'on' : ''); b.type = 'button'
    b.onclick = () => { tab = id; renderHoldings(root, go) }
    seg.append(b)
  }
  const box = el('div', '', 'wal-hold-body')
  if (tab === 'assets') assets(box)
  else if (tab === 'nfts') nfts(box, go)
  else watch(box, () => renderHoldings(root, go))
  card.append(seg, box)
  root.replaceChildren(card)
}
