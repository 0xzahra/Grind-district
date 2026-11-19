// The DeFi desk (Trade > DeFi): practise the on-chain moves people really make, with real prices and in-game money.
// A practice wallet holds tokens on five chains. Fund it from EARNED in-game cash (never a top-up, like Perps), then
// swap on a DEX, park tokens in vaults, bridge between chains, swap cross-chain, lend, borrow against collateral
// (and get liquidated if prices fall), and vote in the Grind DAO with governance tokens earned by providing
// liquidity. Cash out USDC on Base back to your in-game balance. The wallet is a device-side record beside the
// save (the save format is untouched); cash only moves through the save's own spend and earn functions.
import { COINS, cents, money } from './logic.ts'
import { addReputation, balanceSplit, earnCash, getSave, slotKey, spendInGame } from './state.ts'
import { livePrice } from './livePrices.ts'
import {
  CHAINS, CHAIN_IDS, COIN_OF, GAME_SPEED, GRIND_PER_USD_DAY, LIQ_BONUS, MARKET, TURBO_LOSS, VAULTS,
  borrowRoom, bridgeRoute, crossRoute, grow, healthFactor, minOut, proposalsFor, swapQuote, tally, turboDrained,
  type Chain, type LendTok, type Tok, type VaultId,
} from './defiCore.ts'

type Pos = { id: string; qty: number; at: number }
type St = {
  bal: Partial<Record<Chain, Partial<Record<Tok, number>>>>
  vaults: Array<Pos & { v: VaultId; fate: number; drained?: boolean }>
  supply: Array<Pos & { tok: LendTok }>
  debt: Array<Pos & { tok: 'USDC' }>
  moving: Array<{ id: string; to: Chain; tok: Tok; qty: number; arrive: number; label: string }>
  gov: number; govAt: number
  votes: Record<string, 'for' | 'against' | 'abstain'>
  voteDay?: number
  funded?: boolean
  log: Array<{ at: number; text: string }>
}
const key = () => `gd.defi.v1:${slotKey()}`
const blank = (): St => ({ bal: {}, vaults: [], supply: [], debt: [], moving: [], gov: 0, govAt: Date.now(), votes: {}, log: [] })
function load(): St {
  try { const j = JSON.parse(localStorage.getItem(key()) ?? 'null') as St | null; return j && typeof j === 'object' && j.bal ? { ...blank(), ...j } : blank() } catch { return blank() }
}
const save = (s: St): boolean => { try { localStorage.setItem(key(), JSON.stringify(s)); return true } catch { return false } }
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const px = (t: Tok): number => { const c = COIN_OF[t]; if (!c) return 1; return livePrice(c) ?? getSave().coinPrices[c] ?? COINS.find((x) => x.id === c)?.base ?? 0 }
const has = (s: St, c: Chain, t: Tok) => s.bal[c]?.[t] ?? 0
const add = (s: St, c: Chain, t: Tok, q: number) => { const b = (s.bal[c] ??= {}); b[t] = Math.max(0, (b[t] ?? 0) + q); if (b[t]! < 1e-12) delete b[t] }
const qty = (q: number, t: Tok) => (t === 'USDC' ? q.toFixed(2) : q >= 1 ? q.toFixed(4) : q.toPrecision(4))
const note = (s: St, text: string) => { s.log.unshift({ at: Date.now(), text }); s.log.length = Math.min(s.log.length, 30) }
const out = (ok: boolean, message: string) => ({ ok, message })

/** How much of a token an action may use: Max on a chain's gas token keeps a little back for gas, like a wallet. */
function usable(s: St, c: Chain, t: Tok, fraction: number): number {
  const all = has(s, c, t)
  if (t !== CHAINS[c].gasTok) return all * fraction
  const keep = (CHAINS[c].gasUsd * 4) / Math.max(1e-9, px(t))
  return Math.max(0, Math.min(all * fraction, all - keep))
}
const gasLabel = (c: Chain) => (CHAINS[c].gasUsd < 0.01 ? `< $0.01 in ${CHAINS[c].gasTok}` : `≈ ${money(CHAINS[c].gasUsd)} in ${CHAINS[c].gasTok}`)
/** Gas for one action on a chain, paid in its gas token. */
function payGas(s: St, c: Chain): { ok: boolean; message: string } {
  const ch = CHAINS[c], need = ch.gasUsd / Math.max(1e-9, px(ch.gasTok))
  if (has(s, c, ch.gasTok) + 1e-12 < need) return out(false, `You need a little ${ch.gasTok} on ${ch.name} to pay gas (about ${money(ch.gasUsd)}). Swap or bridge some there first.`)
  add(s, c, ch.gasTok, -need)
  return out(true, '')
}
/** A small amount of the destination's gas token, so a first arrival is never stuck (many bridges offer this). */
function refuel(s: St, to: Chain, tok: Tok, q: number): number {
  const g = CHAINS[to].gasTok
  if (tok === g || has(s, to, g) > 0) return q
  const usd = Math.min(0.5, q * px(tok) * 0.1)
  add(s, to, g, usd / px(g))
  return q - usd / px(tok)
}

/** Interest, governance tokens, bridge arrivals, a drained farm, liquidations: brought up to now. Returns news lines. */
export function settle(s: St, now = Date.now()): string[] {
  const news: string[] = []
  for (const m of [...s.moving]) if (m.arrive <= now) { add(s, m.to, m.tok, m.qty); s.moving = s.moving.filter((x) => x !== m); news.push(`${qty(m.qty, m.tok)} ${m.tok} arrived on ${CHAINS[m.to].name}.`); note(s, `Arrived: ${qty(m.qty, m.tok)} ${m.tok} on ${CHAINS[m.to].name}`) }
  for (const v of s.vaults) if (v.v === 'turbo' && !v.drained && turboDrained(v.fate, now - v.at)) {
    v.drained = true; v.qty = v.qty * (1 - TURBO_LOSS); v.at = now
    news.push(`Turbo Farm was drained by an exploit. ${Math.round(TURBO_LOSS * 100)}% of what you had in it is gone.`); note(s, 'Turbo Farm drained by an exploit')
  }
  // Governance tokens for every dollar provided, per game day.
  const provided = s.vaults.reduce((n, v) => n + vaultValue(v, now) * (v.drained ? 0 : 1), 0) + s.supply.reduce((n, p) => n + grow(p.qty, MARKET[p.tok].supply, now - p.at) * px(p.tok), 0)
  const days = (Math.max(0, now - s.govAt) * GAME_SPEED) / 86_400_000
  s.gov += provided * GRIND_PER_USD_DAY * days; s.govAt = now
  const h = health(s, now)
  if (h.debt > 0 && h.hf < 1) {
    // Liquidation: a liquidator repays the debt and takes that much collateral plus a 5% bonus.
    let owed = h.debt * (1 + LIQ_BONUS)
    for (const p of [...s.supply].sort((a, b) => (a.tok === 'USDC' ? 1 : 0) - (b.tok === 'USDC' ? 1 : 0))) {
      const val = grow(p.qty, MARKET[p.tok].supply, now - p.at) * px(p.tok)
      const take = Math.min(val, owed)
      const left = val - take
      p.qty = left / px(p.tok); p.at = now; owed -= take
      if (owed <= 0) break
    }
    s.supply = s.supply.filter((p) => p.qty * px(p.tok) > 0.01)
    s.debt = []
    news.push(`Liquidated: your health factor fell below 1. A liquidator repaid your ${money(h.debt)} loan and took that much of your collateral plus a ${Math.round(LIQ_BONUS * 100)}% bonus.`)
    note(s, `Liquidated: ${money(h.debt)} debt repaid from collateral`)
  }
  return news
}
const VAULT = (id: VaultId) => VAULTS.find((v) => v.id === id)!
const vaultQty = (v: St['vaults'][number], now = Date.now()) => grow(v.qty, VAULT(v.v).apy, now - v.at)
const vaultValue = (v: St['vaults'][number], now = Date.now()) => vaultQty(v, now) * px(VAULT(v.v).tok)
function health(s: St, now = Date.now()) {
  const coll = s.supply.map((p) => ({ tok: p.tok, usd: grow(p.qty, MARKET[p.tok].supply, now - p.at) * px(p.tok) }))
  const debt = s.debt.reduce((n, d) => n + grow(d.qty, MARKET.USDC.borrow, now - d.at), 0)
  return { coll, debt, hf: healthFactor(coll, debt), room: borrowRoom(coll, debt) }
}
/** Everything in the practice wallet, in dollars (positions grown to now, debt subtracted). */
export function netWorth(s = load(), now = Date.now()): number {
  let n = 0
  for (const c of CHAIN_IDS) for (const [t, q] of Object.entries(s.bal[c] ?? {})) n += (q ?? 0) * px(t as Tok)
  for (const v of s.vaults) n += vaultValue(v, now)
  const h = health(s, now)
  n += h.coll.reduce((a, x) => a + x.usd, 0) - h.debt
  for (const m of s.moving) n += m.qty * px(m.tok)
  return n
}

// ---------------------------------------------------------------- actions (each returns {ok, message})
type R = { ok: boolean; message: string; commit?: boolean }
/** Run an action on the wallet brought up to now; keep the result when it worked (or when gas was spent anyway). */
function act(run: (s: St) => R): R {
  const s = load(); settle(s)
  const r = run(s)
  if (!r.ok && !r.commit) return r
  if (!save(s)) return out(false, 'This device would not save the change, so nothing happened.')
  return r
}
export function fund(usd: number): R {
  const amt = cents(usd)
  if (amt < 1) return out(false, 'Pick an amount.')
  if (amt > balanceSplit().earned + 1e-9) return out(false, `The DeFi desk uses earned in-game cash only (never a top-up). You have ${money(balanceSplit().earned)} earned.`)
  // Record the deposit first: if it cannot be kept, nothing is spent.
  const s = load(); settle(s)
  const first = !s.funded
  const gas = first ? Math.min(1, amt * 0.1) : 0
  add(s, 'base', 'USDC', amt - gas)
  if (gas) add(s, 'base', 'ETH', gas / px('ETH'))
  if (first) { s.funded = true; s.gov += 10; s.govAt = Date.now() }
  note(s, `Added ${money(amt)} from your in-game balance`)
  if (!save(s)) return out(false, 'This device would not save the wallet, so nothing was moved.')
  const r = spendInGame(amt, 'Moved to your DeFi practice wallet', `Arrives as USDC on Base${gas ? `, with ${money(gas)} of ETH for gas` : ''}.`)
  if (!r.ok) { const back = load(); add(back, 'base', 'USDC', -(amt - gas)); if (gas) add(back, 'base', 'ETH', -gas / px('ETH')); if (first) { back.funded = false; back.gov = Math.max(0, back.gov - 10) } save(back); return r }
  return out(true, `${money(amt)} is now USDC on Base${gas ? ` (plus ${money(gas)} of ETH for gas)` : ''}.${first ? ' The Grind DAO airdropped you 10 GRIND to vote with.' : ''}`)
}
export function cashOut(fraction: number): R {
  const s = load(); settle(s)
  const amt = cents(has(s, 'base', 'USDC') * fraction)
  if (amt < 0.01) return out(false, 'Only USDC on Base cashes out. Bridge or swap some there first.')
  add(s, 'base', 'USDC', -amt); note(s, `Cashed out ${money(amt)} to your in-game balance`)
  // Take it off the wallet first, so it can never pay out twice.
  if (!save(s)) return out(false, 'This device would not save the change. Try again.')
  earnCash(amt, 'Cashed out from your DeFi practice wallet', 'USDC on Base back to in-game cash.')
  return out(true, `${money(amt)} is back in your in-game balance.`)
}
export function swap(c: Chain, from: Tok, to: Tok, fraction: number, slip: number): R {
  return act((s) => {
    if (from === to) return out(false, 'Pick two different tokens.')
    const amount = usable(s, c, from, fraction)
    if (amount <= 0) return out(false, `You have no ${from} on ${CHAINS[c].name}${from === CHAINS[c].gasTok && has(s, c, from) > 0 ? ' beyond what you need for gas' : ''}.`)
    const g = payGas(s, c); if (!g.ok) return g
    const spend = from === CHAINS[c].gasTok ? Math.min(amount, has(s, c, from)) : amount
    const q = swapQuote(spend, px(from), px(to), CHAINS[c].depth)
    // Between signing and the block, the pool's price moves a little (up to ±0.6% here). Past your slippage
    // tolerance the swap reverts: you keep your tokens, but the gas is spent.
    const got = q.out * (1 + (Math.random() - 0.5) * 0.012)
    if (got < minOut(q.out, slip)) { note(s, `Swap reverted on ${CHAINS[c].name} (slippage)`); return { ok: false, commit: true, message: `The price moved more than your ${slip}% slippage tolerance before the swap landed, so it reverted. Your ${from} is safe, but the ${money(CHAINS[c].gasUsd)} of gas is spent. Try a higher tolerance or a smaller swap.` } }
    add(s, c, from, -spend); add(s, c, to, got)
    note(s, `Swapped ${qty(spend, from)} ${from} for ${qty(got, to)} ${to} on ${CHAINS[c].name}`)
    return out(true, `Swapped ${qty(spend, from)} ${from} for ${qty(got, to)} ${to}. Pool fee ${money(q.feeUsd)}, price impact ${(q.impact * 100).toFixed(2)}%, gas ${money(CHAINS[c].gasUsd)}.`)
  })
}
export function deposit(v: VaultId, fraction: number): R {
  return act((s) => {
    const vt = VAULT(v), amount = usable(s, vt.chain, vt.tok, fraction)
    if (amount * px(vt.tok) < 0.5) return out(false, `You need some ${vt.tok} on ${CHAINS[vt.chain].name} to deposit.`)
    const g = payGas(s, vt.chain); if (!g.ok) return g
    const amt = Math.min(amount, has(s, vt.chain, vt.tok))
    add(s, vt.chain, vt.tok, -amt)
    s.vaults.push({ id: uid(), v, qty: amt, at: Date.now(), fate: Math.random() })
    note(s, `Deposited ${qty(amt, vt.tok)} ${vt.tok} into ${vt.name}`)
    return out(true, `${qty(amt, vt.tok)} ${vt.tok} is in ${vt.name}, earning about ${vt.apy}% a year (an hour here is a day).`)
  })
}
export function withdraw(v: VaultId): R {
  return act((s) => {
    const vt = VAULT(v), mine = s.vaults.filter((x) => x.v === v)
    if (!mine.length) return out(false, 'Nothing in this vault.')
    const g = payGas(s, vt.chain); if (!g.ok) return g
    const total = mine.reduce((n, x) => n + vaultQty(x), 0)
    s.vaults = s.vaults.filter((x) => x.v !== v)
    add(s, vt.chain, vt.tok, total)
    note(s, `Withdrew ${qty(total, vt.tok)} ${vt.tok} from ${vt.name}`)
    return out(true, `Withdrew ${qty(total, vt.tok)} ${vt.tok} to ${CHAINS[vt.chain].name}.`)
  })
}
export function bridge(tok: Tok, from: Chain, to: Chain, fraction: number): R {
  return act((s) => {
    const r = bridgeRoute(from, to, tok)
    if (!r) return out(false, tok === 'USDC' || tok === 'ETH' ? 'No direct bridge for that pair: use Cross-chain.' : 'Bridges here move USDC and ETH. For other tokens use Cross-chain.')
    const amount = usable(s, from, tok, fraction)
    if (amount * px(tok) < 0.5) return out(false, `You need some ${tok} on ${CHAINS[from].name}.`)
    const g = payGas(s, from); if (!g.ok) return g
    const amt = Math.min(amount, has(s, from, tok))
    add(s, from, tok, -amt)
    const net = refuel(s, to, tok, amt * (1 - r.feePct / 100) - r.feeUsd / px(tok))
    s.moving.push({ id: uid(), to, tok, qty: net, arrive: Date.now() + r.secs * 1000, label: r.label })
    note(s, `Bridging ${qty(amt, tok)} ${tok}: ${CHAINS[from].name} → ${CHAINS[to].name}`)
    return out(true, `${qty(amt, tok)} ${tok} is on its way to ${CHAINS[to].name} (${r.label}). Arrives in ${r.secs >= 60 ? `${Math.round(r.secs / 60)} min` : `${r.secs} s`} here; ${r.real} on the real chain.`)
  })
}
export function cross(from: Chain, tokIn: Tok, to: Chain, tokOut: Tok, fraction: number): R {
  return act((s) => {
    const r = crossRoute(from, to, tokIn, tokOut)
    if (!r) return out(false, 'Pick a different chain to send to, and a token that chain has.')
    const amount = usable(s, from, tokIn, fraction)
    if (amount * px(tokIn) < 0.5) return out(false, `You need some ${tokIn} on ${CHAINS[from].name}.`)
    const g = payGas(s, from); if (!g.ok) return g
    const amt = Math.min(amount, has(s, from, tokIn))
    add(s, from, tokIn, -amt)
    const usd = amt * px(tokIn) * (1 - r.feePct / 100) - r.feeUsd
    const net = refuel(s, to, tokOut, usd / px(tokOut))
    s.moving.push({ id: uid(), to, tok: tokOut, qty: net, arrive: Date.now() + r.secs * 1000, label: r.label })
    note(s, `Cross-chain: ${qty(amt, tokIn)} ${tokIn} on ${CHAINS[from].name} → ${tokOut} on ${CHAINS[to].name}`)
    return out(true, `Sent ${qty(amt, tokIn)} ${tokIn}. About ${qty(net, tokOut)} ${tokOut} lands on ${CHAINS[to].name} in ${r.secs} s.`)
  })
}
export function supply(tok: LendTok, fraction: number): R {
  return act((s) => {
    const amount = usable(s, 'base', tok, fraction)
    if (amount * px(tok) < 0.5) return out(false, `You need some ${tok} on Base to supply${tok === 'ETH' ? ' (a little is kept back for gas)' : ''}.`)
    const g = payGas(s, 'base'); if (!g.ok) return g
    const amt = Math.min(amount, has(s, 'base', tok))
    add(s, 'base', tok, -amt); s.supply.push({ id: uid(), tok, qty: amt, at: Date.now() })
    note(s, `Supplied ${qty(amt, tok)} ${tok} to the lending market`)
    return out(true, `Supplied ${qty(amt, tok)} ${tok}. It earns ${MARKET[tok].supply}% a year and can back a loan.`)
  })
}
export function unsupply(tok: LendTok): R {
  return act((s) => {
    const mine = s.supply.filter((p) => p.tok === tok)
    if (!mine.length) return out(false, `No ${tok} supplied.`)
    const rest = s.supply.filter((p) => p.tok !== tok)
    const after = health({ ...s, supply: rest })
    if (after.debt > 0 && after.hf < 1.1) return out(false, `Withdrawing that ${tok} would leave your loan nearly underwater (health ${after.hf.toFixed(2)}). Repay some first.`)
    const g = payGas(s, 'base'); if (!g.ok) return g
    const total = mine.reduce((n, p) => n + grow(p.qty, MARKET[tok].supply, Date.now() - p.at), 0)
    s.supply = rest; add(s, 'base', tok, total)
    note(s, `Withdrew ${qty(total, tok)} ${tok} from the lending market`)
    return out(true, `Withdrew ${qty(total, tok)} ${tok} to Base.`)
  })
}
export function borrow(fraction: number): R {
  return act((s) => {
    const h = health(s)
    const amt = cents(h.room * fraction)
    if (amt < 1) return out(false, 'Supply ETH, BTC or USDC first: that is your collateral.')
    const g = payGas(s, 'base'); if (!g.ok) return g
    s.debt.push({ id: uid(), tok: 'USDC', qty: amt, at: Date.now() }); add(s, 'base', 'USDC', amt)
    note(s, `Borrowed ${money(amt)} USDC`)
    const hf = health(s).hf
    return out(true, `Borrowed ${money(amt)} USDC at ${MARKET.USDC.borrow}% a year. Health factor ${hf === Infinity ? '∞' : hf.toFixed(2)}: below 1.00 you get liquidated.`)
  })
}
export function repay(fraction: number): R {
  return act((s) => {
    const h = health(s)
    if (h.debt <= 0) return out(false, 'No loan to repay.')
    const pay = Math.min(has(s, 'base', 'USDC'), h.debt * fraction)
    if (pay < 0.01) return out(false, 'You need USDC on Base to repay.')
    const g = payGas(s, 'base'); if (!g.ok) return g
    add(s, 'base', 'USDC', -pay)
    const left = h.debt - pay
    s.debt = left > 0.005 ? [{ id: uid(), tok: 'USDC', qty: left, at: Date.now() }] : []
    note(s, `Repaid ${money(pay)} of the loan`)
    return out(true, left > 0.005 ? `Repaid ${money(pay)}. ${money(left)} still owed.` : 'Loan repaid in full.')
  })
}
export function vote(pid: string, choice: 'for' | 'against' | 'abstain'): R {
  return act((s) => {
    if (s.gov < 1) return out(false, 'You need GRIND to vote. Provide liquidity (a vault or the lending market) and it builds up; your first deposit airdrops 10.')
    if (s.votes[pid]) return out(false, 'You already voted on this one.')
    s.votes[pid] = choice
    note(s, `Voted ${choice} on ${pid} with ${Math.floor(s.gov)} GRIND`)
    const day = Math.floor(Date.now() / 86_400_000)
    if (s.voteDay !== day) { s.voteDay = day; window.setTimeout(() => addReputation(1, 'Voted in the Grind DAO', `${pid}: ${choice}.`), 0) }
    return out(true, `Vote cast: ${choice} on ${pid}, weighted by your ${Math.floor(s.gov)} GRIND.`)
  })
}

// ---------------------------------------------------------------- the screen
type Desk = 'wallet' | 'swap' | 'vaults' | 'bridge' | 'cross' | 'lend' | 'borrow' | 'dao'
const DESKS: Array<[Desk, string]> = [['wallet', 'Wallet'], ['swap', 'Swap'], ['vaults', 'Vaults'], ['bridge', 'Bridge'], ['cross', 'Cross-chain'], ['lend', 'Lend'], ['borrow', 'Borrow'], ['dao', 'DAO']]
const ui = { desk: 'wallet' as Desk, chain: 'base' as Chain, from: 'USDC' as Tok, to: 'ETH' as Tok, frac: 0.5, slip: 0.5, btok: 'USDC' as Tok, bfrom: 'base' as Chain, bto: 'arbitrum' as Chain, cfrom: 'base' as Chain, cin: 'USDC' as Tok, cto: 'solana' as Chain, cout: 'SOL' as Tok, ltok: 'ETH' as LendTok }

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
const btn = (label: string, cls: string, on: () => void) => { const b = h('button', cls, label); b.type = 'button'; b.onclick = on; return b }
const pick = <T extends string>(label: string, opts: Array<[T, string]>, now: T, set: (v: T) => void) => {
  const r = h('div', 'df-pick'); r.append(h('span', 'df-lbl', label))
  const row = h('div', 'df-opts')
  for (const [v, t] of opts) { const b = btn(t, `df-opt${v === now ? ' on' : ''}`, () => set(v)); b.setAttribute('aria-pressed', String(v === now)); row.append(b) }
  r.append(row); return r
}

export function renderDefi(o: { done: (message: string) => void; live: (f: () => void) => void }): HTMLElement {
  const root = h('div', 'xch-pane df')
  const result = h('p', 'xch-result'); result.setAttribute('role', 'status')
  const redraw = () => { root.replaceWith(renderDefi(o)) }
  const run = (r: R) => { result.textContent = r.message; result.dataset.ok = String(r.ok); o.done(r.message); if (r.ok) { const keep = r.message; const fresh = renderDefi(o); root.replaceWith(fresh); const p = fresh.querySelector('.xch-result'); if (p) { p.textContent = keep; (p as HTMLElement).dataset.ok = 'true' } } }
  // Catch up first (arrivals, interest, liquidations) and say what happened.
  { const s = load(); const news = settle(s); save(s); if (news.length) { result.textContent = news.join(' '); result.dataset.ok = 'true' } }
  const s = load()
  const tabs = h('div', 'df-tabs')
  for (const [d, t] of DESKS) { const b = btn(t, `df-tab${ui.desk === d ? ' on' : ''}`, () => { ui.desk = d; redraw() }); b.setAttribute('aria-pressed', String(ui.desk === d)); tabs.append(b) }
  const top = h('div', 'df-top'), worth = h('b', 'df-worth'), sub = h('small', '', 'Practice DeFi wallet · real prices · in-game money')
  top.append(h('span', 'df-k', 'Wallet value'), worth, sub)
  o.live(() => { worth.textContent = money(netWorth()) })
  root.append(top, tabs)
  const body = h('div', 'df-body')
  const fracs = (now: number, set: (f: number) => void) => pick('Amount', [['0.25', '25%'], ['0.5', '50%'], ['1', 'Max']], String(now) as '0.25' | '0.5' | '1', (v) => set(Number(v)))
  const quote = (lines: Array<[string, string]>) => { const dl = h('dl', 'xch-preview'); for (const [k, v] of lines) dl.append(h('dt', '', k), h('dd', '', v)); return dl }
  const chainOpts = (list: Chain[] = CHAIN_IDS): Array<[Chain, string]> => list.map((c) => [c, CHAINS[c].name])
  const tokOpts = (c: Chain): Array<[Tok, string]> => CHAINS[c].toks.map((t) => [t, t])
  const bal = (c: Chain, t: Tok) => `${qty(has(s, c, t), t)} ${t}`

  if (ui.desk === 'wallet') {
    const list = h('div', 'df-list')
    for (const c of CHAIN_IDS) {
      const toks = Object.entries(s.bal[c] ?? {}).filter(([, q]) => (q ?? 0) > 0)
      const card = h('div', 'df-card'), hd = h('div', 'df-ch')
      hd.append(h('b', '', CHAINS[c].name), h('small', '', `${CHAINS[c].layer} · gas ${gasLabel(c)}`))
      card.append(hd)
      if (!toks.length) card.append(h('p', 'df-dim', 'Nothing here yet.'))
      for (const [t, q] of toks) { const r = h('div', 'df-row'); r.append(h('span', '', `${qty(q!, t as Tok)} ${t}`), h('span', 'df-dim', money(q! * px(t as Tok)))); card.append(r) }
      list.append(card)
    }
    for (const m of s.moving) { const left = Math.max(0, Math.ceil((m.arrive - Date.now()) / 1000)); list.append(h('p', 'df-move', `⏳ ${qty(m.qty, m.tok)} ${m.tok} → ${CHAINS[m.to].name} · ${m.label} · ${left >= 60 ? `${Math.ceil(left / 60)} min` : `${left} s`} left`)) }
    const earned = balanceSplit().earned
    const fundRow = h('div', 'gm-keys df-keys')
    for (const a of [50, 100, 250]) fundRow.append(btn(`Add $${a}`, 'xch-go buy', () => run(fund(a))))
    const outRow = h('div', 'gm-keys df-keys')
    outRow.append(btn('Cash out half', 'xch-close', () => run(cashOut(0.5))), btn('Cash out all USDC on Base', 'xch-go sell', () => run(cashOut(1))))
    body.append(h('h3', 'xch-group', 'Fund the wallet'), h('p', 'xch-note', `From earned in-game cash only (${money(earned)} earned now). It arrives as USDC on Base; your first deposit includes a little ETH for gas.`), fundRow, list,
      h('h3', 'xch-group', 'Cash out'), h('p', 'xch-note', 'Only USDC on Base goes back to your in-game balance, like an exchange that only accepts one network: bridge or swap first.'), outRow)
    if (s.log.length) { const lg = h('div', 'df-log'); lg.append(h('h3', 'xch-group', 'Activity')); for (const l of s.log.slice(0, 8)) lg.append(h('p', 'df-dim', `${new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${l.text}`)); body.append(lg) }
  }
  if (ui.desk === 'swap') {
    if (!CHAINS[ui.chain].toks.includes(ui.from)) ui.from = CHAINS[ui.chain].toks[0]!
    if (!CHAINS[ui.chain].toks.includes(ui.to) || ui.to === ui.from) ui.to = CHAINS[ui.chain].toks.find((t) => t !== ui.from)!
    const amount = usable(s, ui.chain, ui.from, ui.frac)
    const q = swapQuote(amount, px(ui.from), px(ui.to), CHAINS[ui.chain].depth)
    body.append(
      h('p', 'xch-note', 'A DEX: you trade against a pool of two tokens. Bigger trades move the pool\'s price more (price impact); slippage tolerance is the worst rate you accept before the swap reverts.'),
      pick('Chain', chainOpts(), ui.chain, (v) => { ui.chain = v; redraw() }),
      pick('You pay', tokOpts(ui.chain), ui.from, (v) => { ui.from = v; redraw() }),
      pick('You get', tokOpts(ui.chain).filter(([t]) => t !== ui.from), ui.to, (v) => { ui.to = v; redraw() }),
      fracs(ui.frac, (f) => { ui.frac = f; redraw() }),
      pick('Slippage tolerance', [['0.5', '0.5%'], ['1', '1%'], ['3', '3%']], String(ui.slip) as '0.5' | '1' | '3', (v) => { ui.slip = Number(v); redraw() }),
      quote([['Balance', bal(ui.chain, ui.from)], ['You pay', `${qty(amount, ui.from)} ${ui.from}`], ['You get (about)', `${qty(q.out, ui.to)} ${ui.to}`], ['Minimum received', `${qty(minOut(q.out, ui.slip), ui.to)} ${ui.to}`], ['Pool fee (0.3%)', money(q.feeUsd)], ['Price impact', `${(q.impact * 100).toFixed(3)}%`], ['Gas', gasLabel(ui.chain)]]),
      btn(`Swap ${ui.from} for ${ui.to}`, 'xch-go buy', () => run(swap(ui.chain, ui.from, ui.to, ui.frac, ui.slip))),
    )
  }
  if (ui.desk === 'vaults') {
    body.append(h('p', 'xch-note', 'Vaults and staking: deposit a token, earn yield on it. Yield runs at game speed (an hour here is a day). A higher yield always means a bigger risk somewhere.'))
    for (const v of VAULTS) {
      const mine = s.vaults.filter((x) => x.v === v.id), inside = mine.reduce((n, x) => n + vaultQty(x), 0)
      const card = h('div', `df-card df-vault${v.warn ? ' warn' : ''}`)
      const hd = h('div', 'df-ch'); hd.append(h('b', '', `${v.name} · ${v.tok} · ${CHAINS[v.chain].name}`), h('small', '', `${v.apy}% APY · risk: ${v.risk}`))
      card.append(hd, h('p', 'df-dim', v.how))
      if (v.warn) card.append(h('p', 'df-warn', `⚠ ${v.warn}`))
      if (mine.some((x) => x.drained)) card.append(h('p', 'df-warn', 'This farm was exploited. What is left is shown below.'))
      card.append(h('p', '', inside > 0 ? `You have ${qty(inside, v.tok)} ${v.tok} (${money(inside * px(v.tok))}) in it.` : `Your ${v.tok} on ${CHAINS[v.chain].name}: ${bal(v.chain, v.tok)}.`))
      const keys = h('div', 'gm-keys df-keys')
      keys.append(btn('Deposit half', 'xch-close', () => run(deposit(v.id, 0.5))), btn('Deposit all', 'xch-go buy', () => run(deposit(v.id, 1))))
      if (inside > 0) keys.append(btn('Withdraw', 'xch-go sell', () => run(withdraw(v.id))))
      card.append(keys); body.append(card)
    }
  }
  if (ui.desk === 'bridge') {
    const pairs: Tok[] = ['USDC', 'ETH']
    if (!pairs.includes(ui.btok)) ui.btok = 'USDC'
    const okChains = CHAIN_IDS.filter((c) => CHAINS[c].toks.includes(ui.btok))
    if (!okChains.includes(ui.bfrom)) ui.bfrom = okChains[0]!
    if (!okChains.includes(ui.bto) || ui.bto === ui.bfrom) ui.bto = okChains.find((c) => c !== ui.bfrom)!
    const r = bridgeRoute(ui.bfrom, ui.bto, ui.btok), amount = usable(s, ui.bfrom, ui.btok, ui.frac)
    body.append(
      h('p', 'xch-note', 'A bridge moves the same token from one chain to another. Official rollup bridges are the safest; withdrawals back to Ethereum wait out a challenge window.'),
      pick('Token', pairs.map((t) => [t, t] as [Tok, string]), ui.btok, (v) => { ui.btok = v; redraw() }),
      pick('From', chainOpts(okChains), ui.bfrom, (v) => { ui.bfrom = v; redraw() }),
      pick('To', chainOpts(okChains.filter((c) => c !== ui.bfrom)), ui.bto, (v) => { ui.bto = v; redraw() }),
      fracs(ui.frac, (f) => { ui.frac = f; redraw() }),
      r ? quote([['Route', r.label], ['You send', `${qty(amount, ui.btok)} ${ui.btok}`], ['Fee', r.feePct || r.feeUsd ? `${r.feePct}% + ${money(r.feeUsd)}` : 'Gas only'], ['Gas', gasLabel(ui.bfrom)], ['Arrives', `${r.secs >= 60 ? `${Math.round(r.secs / 60)} min` : `${r.secs} s`} here · ${r.real} for real`]]) : h('p', 'df-warn', 'No direct bridge for this pair (for example, ETH to Solana or NEAR). Use Cross-chain.'),
    )
    if (r) body.append(h('p', 'df-dim', r.note), btn(`Bridge ${ui.btok}`, 'xch-go buy', () => run(bridge(ui.btok, ui.bfrom, ui.bto, ui.frac))))
  }
  if (ui.desk === 'cross') {
    if (!CHAINS[ui.cfrom].toks.includes(ui.cin)) ui.cin = CHAINS[ui.cfrom].toks[0]!
    if (ui.cto === ui.cfrom) ui.cto = CHAIN_IDS.find((c) => c !== ui.cfrom)!
    if (!CHAINS[ui.cto].toks.includes(ui.cout)) ui.cout = CHAINS[ui.cto].toks[CHAINS[ui.cto].toks.length - 1]!
    const r = crossRoute(ui.cfrom, ui.cto, ui.cin, ui.cout), amount = usable(s, ui.cfrom, ui.cin, ui.frac)
    const getUsd = r ? amount * px(ui.cin) * (1 - r.feePct / 100) - r.feeUsd : 0
    body.append(
      h('p', 'xch-note', 'Cross-chain: send one token on one chain and receive a different token on another, in one step. A solver fills your order on the far side.'),
      pick('From chain', chainOpts(), ui.cfrom, (v) => { ui.cfrom = v; redraw() }),
      pick('You send', tokOpts(ui.cfrom), ui.cin, (v) => { ui.cin = v; redraw() }),
      pick('To chain', chainOpts(CHAIN_IDS.filter((c) => c !== ui.cfrom)), ui.cto, (v) => { ui.cto = v; redraw() }),
      pick('You receive', tokOpts(ui.cto), ui.cout, (v) => { ui.cout = v; redraw() }),
      fracs(ui.frac, (f) => { ui.frac = f; redraw() }),
    )
    if (r) body.append(quote([['Balance', bal(ui.cfrom, ui.cin)], ['You send', `${qty(amount, ui.cin)} ${ui.cin}`], ['You receive (about)', `${qty(Math.max(0, getUsd) / px(ui.cout), ui.cout)} ${ui.cout}`], ['Fee', `${r.feePct}% + ${money(r.feeUsd)}`], ['Gas', gasLabel(ui.cfrom)], ['Arrives', `${r.secs} s`]]), h('p', 'df-warn', r.note),
      btn(`Send ${ui.cin} → ${ui.cout} on ${CHAINS[ui.cto].name}`, 'xch-go buy', () => run(cross(ui.cfrom, ui.cin, ui.cto, ui.cout, ui.frac))))
  }
  if (ui.desk === 'lend' || ui.desk === 'borrow') {
    const hl = health(s), coll = hl.coll.reduce((n, x) => n + x.usd, 0)
    const stats = h('div', 'xch-tiles')
    const tile = (k: string, v: string, d = '') => { const t = h('div', 'xch-tile'); t.append(h('span', '', k), h('b', '', v)); if (d) (t.lastChild as HTMLElement).dataset.dir = d; stats.append(t) }
    tile('Supplied', money(coll)); tile('Borrowed', money(hl.debt)); tile('Health factor', hl.debt > 0 ? hl.hf.toFixed(2) : '—', hl.debt > 0 ? (hl.hf < 1.2 ? 'down' : 'up') : '')
    body.append(stats)
    if (ui.desk === 'lend') {
      body.append(h('p', 'xch-note', 'Lending market on Base: supply tokens to earn interest from borrowers. What you supply can also back a loan (Borrow).'),
        pick('Token', (Object.keys(MARKET) as LendTok[]).map((t) => [t, `${t} · ${MARKET[t].supply}%`] as [LendTok, string]), ui.ltok, (v) => { ui.ltok = v; redraw() }),
        quote([['Your ' + ui.ltok + ' on Base', bal('base', ui.ltok)], ['Supply rate', `${MARKET[ui.ltok].supply}% a year`], ['Counts as collateral', `${Math.round(MARKET[ui.ltok].ltv * 100)}% of its value`]]))
      const keys = h('div', 'gm-keys df-keys')
      keys.append(btn('Supply half', 'xch-close', () => run(supply(ui.ltok, 0.5))), btn('Supply all', 'xch-go buy', () => run(supply(ui.ltok, 1))))
      if (s.supply.some((p) => p.tok === ui.ltok)) keys.append(btn(`Withdraw ${ui.ltok}`, 'xch-go sell', () => run(unsupply(ui.ltok))))
      body.append(keys)
    } else {
      body.append(h('p', 'xch-note', `Borrow USDC against what you supplied, at ${MARKET.USDC.borrow}% a year. Prices are live: if your collateral falls, your health factor falls. Below 1.00 a liquidator repays your loan and takes your collateral plus a ${Math.round(LIQ_BONUS * 100)}% bonus.`),
        quote([['You can still borrow', money(hl.room)], ['Debt now', money(hl.debt)], ['Your USDC on Base', bal('base', 'USDC')]]))
      const keys = h('div', 'gm-keys df-keys')
      keys.append(btn('Borrow 25% of limit', 'xch-close', () => run(borrow(0.25))), btn('Borrow 50%', 'xch-go buy', () => run(borrow(0.5))))
      if (hl.debt > 0) keys.append(btn('Repay half', 'xch-close', () => run(repay(0.5))), btn('Repay all', 'xch-go sell', () => run(repay(1))))
      body.append(keys, h('p', 'df-dim', 'Borrowing near your limit is how people get liquidated in a sharp dip. Most keep their health factor above 1.5.'))
    }
  }
  if (ui.desk === 'dao') {
    const day = Math.floor(Date.now() / 86_400_000)
    const ends = new Date((day + 1) * 86_400_000)
    body.append(h('p', 'xch-note', `The Grind DAO runs the vaults and the lending market. GRIND tokens are voting power (no cash value here): you earn them by providing liquidity, ${GRIND_PER_USD_DAY * 100} per $100 per game day. You hold ${Math.floor(s.gov).toLocaleString()} GRIND.`))
    for (const p of proposalsFor(day)) {
      const mine = s.votes[p.id], t = tally(p, mine ? { choice: mine, weight: s.gov } : undefined)
      const card = h('div', 'df-card')
      const hd = h('div', 'df-ch'); hd.append(h('b', '', `${p.id} · ${p.title}`), h('small', '', `Voting ends ${ends.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`))
      card.append(hd, h('p', 'df-dim', p.body), h('p', '', `If it passes: ${p.effect}`))
      const pct = (n: number) => `${((n / Math.max(1, t.turnout)) * 100).toFixed(1)}%`
      const bar = h('div', 'df-bar'); const f = h('span', 'df-for'), a = h('span', 'df-against'); f.style.width = pct(t.for); a.style.width = pct(t.against); bar.append(f, a)
      card.append(bar, h('p', 'df-dim', `For ${pct(t.for)} · Against ${pct(t.against)} · Abstain ${pct(t.abstain)} · ${Math.round(t.turnout).toLocaleString()} GRIND voted · quorum ${t.quorum ? 'reached' : 'not yet'} · ${t.passing ? 'passing' : 'failing'}`))
      if (mine) card.append(h('p', 'gm-ok', `You voted ${mine}.`))
      else { const keys = h('div', 'gm-keys df-keys'); keys.append(btn('For', 'xch-go buy', () => run(vote(p.id, 'for'))), btn('Against', 'xch-go sell', () => run(vote(p.id, 'against'))), btn('Abstain', 'xch-close', () => run(vote(p.id, 'abstain')))); card.append(keys) }
      body.append(card)
    }
    body.append(h('p', 'df-dim', 'In real DAOs a few big holders often decide the outcome, and attackers have borrowed tokens just to swing a vote. Delegating to someone who votes in public is common.'))
  }
  root.append(body, result)
  return root
}
