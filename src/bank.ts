// Grind Bank, the panel: how crypto institutions work (custody, reserves, proof of reserves, ramps, where yield
// comes from) with a short check; an ETF desk to buy and sell two spot crypto ETFs at live prices; and a halal
// profit-sharing savings account. Practice with earned in-game cash only (never a top-up), like the DeFi desk.
// Progress lives beside the save (`<slot>.bank`), so the save format is unchanged.
import { addReputation, balanceSplit, earnCash, slotKey, spendInGame } from './state.ts'
import { FUNDS, nav, premium, sharePrice, buy, sell, settle, emptySavings, poolResult, SAVER_SHARE, type FundId, type Holdings, type Savings } from './bankCore.ts'
import { ensurePrices, livePrice } from './livePrices.ts'

export type BankTab = 'learn' | 'etf' | 'halal'
type Store = { etf: Holdings; savings: Savings; learned: boolean }
const today = () => new Date().toISOString().slice(0, 10)
const key = () => `${slotKey()}.bank`
function load(): Store {
  try {
    const v = JSON.parse(localStorage.getItem(key()) ?? 'null') as Store | null
    if (v && typeof v === 'object' && v.savings) return { etf: v.etf ?? {}, savings: settle(v.savings, today()), learned: !!v.learned }
  } catch { /* none yet */ }
  return { etf: {}, savings: emptySavings(today()), learned: false }
}
const store = (s: Store) => { try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ } }
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
const btn = (text: string, cls: string, run: () => void) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = run; return b }

const LESSON: Array<{ h: string; t: string }> = [
  { h: 'What crypto institutions are', t: 'Crypto institutions are the firms that stand between you and the blockchain: exchanges, custodians, crypto-friendly banks, payment companies and ETF issuers. They do three jobs: keep coins safe for customers (custody), move money between your local currency and crypto (on and off ramps), and offer products such as savings, loans and ETFs. The regulated ones check who you are (KYC) and follow anti-money-laundering rules.' },
  { h: 'Custody: cold and hot wallets', t: 'Most coins sit in cold storage: keys made and kept offline in vaults, often split between several people (multi-signature), so no one person can move them. A small part sits in hot wallets for daily withdrawals. With an institution the keys are theirs, not yours: easy, but you are trusting them. Self-custody means your own keys and your own responsibility.' },
  { h: 'Reserves: one for one', t: 'Customer coins should be held one for one and kept apart from the institution\'s own money. A firm that lends out or spends customer coins can fail when everyone asks for them back at once (a bank run). That is how several crypto lenders and a large exchange collapsed in 2022.' },
  { h: 'Proof of reserves', t: 'A proof of reserves shows the institution\'s wallets on-chain and a cryptographic list of what it owes customers (a Merkle tree), so you can check your own balance is counted. The good ones add an independent auditor\'s report on what is owed, and repeat it often. A one-off snapshot can be gamed; regular, audited proofs are better.' },
  { h: 'Where yield comes from', t: 'If an institution pays you a return, ask where it comes from: lending to borrowers, staking, or trading. Higher yield means higher risk. A fixed, high, guaranteed return on crypto is a warning sign, not a feature.' },
  { h: 'Ramps, fees and withdrawals', t: 'Paying in local currency, buying coins and withdrawing to your own wallet each cost something: spreads, trading fees and network fees. Before you withdraw, check the network and the address, and send a small test amount first.' },
]
const CHECK: Array<{ q: string; o: string[]; r: number; why: string }> = [
  { q: 'An institution keeps most customer coins offline, with keys split between several people. That is…', o: ['A hot wallet', 'Cold storage with multi-signature', 'Proof of stake'], r: 1, why: 'Offline keys, split so no one person can move the coins.' },
  { q: 'What does a proof of reserves let you check?', o: ['That prices will go up', 'That your balance is counted in what the institution holds and owes', 'That the bank pays interest'], r: 1, why: 'You can find your own balance in the list and see the wallets on-chain.' },
  { q: 'A platform promises 20% a year, guaranteed, on stablecoins. The steady reading?', o: ['Move everything there', 'Ask where the yield comes from; a guarantee is a warning sign', 'It must be safe if it is popular'], r: 1, why: 'Yield comes from risk. Guarantees on crypto returns are a red flag.' },
]
const ETF_FACTS = [
  ['A spot ETF holds the real coin', 'A spot Bitcoin ETF keeps actual bitcoin with a custodian. Each share stands for a fixed slice of it, so the share follows the price of bitcoin.'],
  ['Price and NAV', 'NAV is what the coins inside a share are worth. On the exchange a share can trade a little above NAV (a premium) or below it (a discount); big traders create or redeem shares to close the gap.'],
  ['The expense ratio', 'A yearly fee, here 0.25%, taken a tiny bit each day out of NAV. Over years it adds up, so low fees matter.'],
  ['Shares, not coins', 'You own fund shares, not the coins: no keys to lose, but you cannot send them on-chain. Real ETFs trade only in exchange hours; this practice desk is open all day.'],
] as const

let current: HTMLElement | null = null

/** Open Grind Bank on a tab. */
export function openBank(o: { tab: BankTab; toast: (m: string) => void }): void {
  current?.remove()
  ensurePrices()
  let s = load(); store(s)
  let tab: BankTab = o.tab
  let step = 0, check = -1, note = ''
  const root = el('div', 'bk'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Grind Bank')
  const card = el('div', 'bk-card')
  const head = el('div', 'bk-head')
  const crest = el('span', 'bk-crest')
  crest.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5 12 4l9 5.5"/><path d="M4.5 9.5h15M6 10v7M10 10v7M14 10v7M18 10v7M4 17.5h16M3 20.5h18"/></svg>'
  const words = el('div', 'bk-words'); words.append(el('strong', '', 'Grind Bank'), el('span', '', 'Crypto institutions, explained · practice with earned cash'))
  const close = btn('×', 'bk-x', () => done()); close.setAttribute('aria-label', 'Close')
  head.append(crest, words, close)
  const tabs = el('div', 'bk-tabs')
  const body = el('div', 'bk-body')
  card.append(head, tabs, body)
  root.append(card)
  document.body.append(root)
  document.body.classList.add('sheet-open')
  current = root
  const done = () => { window.clearInterval(timer); root.remove(); if (current === root) current = null; document.body.classList.remove('sheet-open') }
  root.addEventListener('pointerdown', (e) => { if (e.target === root) done() })
  const earned = () => balanceSplit().earned
  const save = () => store(s)

  const render = () => {
    tabs.replaceChildren(...(['learn', 'etf', 'halal'] as const).map((t) => {
      const b = btn(t === 'learn' ? 'How it works' : t === 'etf' ? 'ETF desk' : 'Halal savings', `bk-tab${t === tab ? ' on' : ''}`, () => { tab = t; note = ''; render() })
      return b
    }))
    body.replaceChildren()
    if (tab === 'learn') renderLearn(); else if (tab === 'etf') renderEtf(); else renderHalal()
  }

  const renderLearn = () => {
    if (check < 0) {
      const c = LESSON[step]!
      const dots = el('div', 'bk-dots'); LESSON.forEach((_, i) => dots.append(el('i', i < step ? 'done' : i === step ? 'on' : '')))
      const box = el('div', 'bk-lesson'); box.append(el('p', 'bk-k', `${step + 1} of ${LESSON.length} · ${c.h}`), el('p', 'bk-t', c.t))
      const row = el('div', 'bk-row')
      if (step > 0) row.append(btn('Back', 'bk-btn ghost', () => { step--; render() }))
      row.append(btn(step < LESSON.length - 1 ? 'Next' : s.learned ? 'Check again' : 'Quick check', 'bk-btn gold', () => { if (step < LESSON.length - 1) step++; else { check = 0; note = '' } render() }))
      body.append(dots, box, row)
      if (s.learned) body.append(el('p', 'bk-note', 'You passed the crypto institutions check. Good to revise.'))
      return
    }
    const q = CHECK[check]!
    const box = el('div', 'bk-lesson ask'); box.append(el('p', 'bk-k', `Check · ${check + 1} of ${CHECK.length}`), el('p', 'bk-t', q.q))
    body.append(box)
    if (note) body.append(el('p', 'bk-wrong', note))
    q.o.forEach((opt, i) => body.append(btn(opt, 'bk-opt', () => {
      if (i !== q.r) { note = `Not quite. ${q.why}`; render(); return }
      note = ''
      if (check < CHECK.length - 1) { check++; o.toast(q.why); render(); return }
      if (!s.learned) { s.learned = true; save(); window.setTimeout(() => addReputation(3, 'Reputation: crypto institutions', 'Passed the check at Grind Bank.'), 0); o.toast('Passed: +3 reputation. Now try the ETF desk.') }
      else o.toast('Passed again.')
      check = -1; step = 0; tab = 'etf'; render()
    })))
  }

  const renderEtf = () => {
    const facts = el('details', 'bk-facts')
    facts.append(el('summary', '', 'How ETFs work, in four lines'))
    for (const [h, t] of ETF_FACTS) { const p = el('p'); p.append(el('b', '', `${h}. `), document.createTextNode(t)); facts.append(p) }
    body.append(facts)
    body.append(el('p', 'bk-note', `Earned cash only, never a top-up. You have ${money(earned())} earned.`))
    const now = Date.now()
    for (const f of FUNDS) {
      const coin = livePrice(f.coin) ?? f.fallback
      const price = sharePrice(f, coin, now), n = nav(f, coin, now), pr = premium(f, now)
      const pos = s.etf[f.id]
      const box = el('div', 'bk-fund')
      const top = el('div', 'bk-fund-top')
      const name = el('div'); name.append(el('strong', '', f.ticker), el('span', '', f.name))
      const px = el('div', 'bk-px'); px.append(el('strong', '', money(price)), el('span', pr >= 0 ? 'up' : 'down', `${pr >= 0 ? 'Premium +' : 'Discount '}${(pr * 100).toFixed(2)}% to NAV`))
      top.append(name, px)
      const grid = el('div', 'bk-kv')
      for (const [k, v] of [['NAV', money(n)], ['Holds per share', `${f.perShare} ${f.coin}`], [`${f.coin} price`, money(coin)], ['Expense ratio', `${(f.fee * 100).toFixed(2)}% a year`]] as const) { const d = el('div'); d.append(el('span', '', k), el('b', '', v)); grid.append(d) }
      box.append(top, grid)
      if (pos) {
        const value = pos.shares * price, pl = value - pos.cost
        const mine = el('div', 'bk-mine'); mine.append(el('span', '', `You hold ${pos.shares} shares · ${money(value)}`), el('b', pl >= 0 ? 'up' : 'down', `${pl >= 0 ? '+' : ''}${money(pl)}`))
        box.append(mine)
      }
      const row = el('div', 'bk-row')
      for (const usd of [25, 100, 500]) row.append(btn(`Buy ${money(usd).replace('.00', '')}`, 'bk-btn', () => trade(f.id, 'buy', usd)))
      if (pos) row.append(btn('Sell all', 'bk-btn ghost', () => trade(f.id, 'sell', pos.shares)))
      box.append(row)
      body.append(box)
    }
  }
  const trade = (id: FundId, side: 'buy' | 'sell', amount: number) => {
    const f = FUNDS.find((x) => x.id === id)!, price = sharePrice(f, livePrice(f.coin) ?? f.fallback)
    if (side === 'buy') {
      if (amount > earned() + 1e-9) { o.toast(`The ETF desk uses earned in-game cash only. You have ${money(earned())} earned.`); return }
      const r = buy(s.etf, id, amount, price)
      if (!r.shares) return
      const cost = Math.round(r.shares * price * 100) / 100
      const paid = spendInGame(cost, `Bought ${r.shares} ${f.ticker}`, `Grind Bank ETF desk at ${money(price)} a share.`)
      if (!paid.ok) { o.toast(paid.message); return }
      s.etf = r.h; save(); o.toast(`Bought ${r.shares} ${f.ticker} at ${money(price)}.`)
    } else {
      const r = sell(s.etf, id, amount, price)
      if (!r.shares) return
      earnCash(r.usd, `Sold ${r.shares} ${f.ticker}`, `Grind Bank ETF desk at ${money(price)} a share.`)
      s.etf = r.h; save(); o.toast(`Sold ${r.shares} ${f.ticker} for ${money(r.usd)}.`)
    }
    render()
  }

  const renderHalal = () => {
    s.savings = settle(s.savings, today()); save()
    const sv = s.savings
    const intro = el('div', 'bk-lesson')
    intro.append(el('p', 'bk-k', 'Profit-sharing (mudarabah) · no interest'), el('p', 'bk-t', `No interest (riba). Your savings join a pool the bank invests in screened, asset-backed trade: no alcohol, gambling or interest lending. Profit is shared ${Math.round(SAVER_SHARE * 100)}% to you and ${Math.round((1 - SAVER_SHARE) * 100)}% to the bank. If the pool loses, the loss falls on the capital: returns are never guaranteed.`))
    const acct = el('div', 'bk-fund')
    const top = el('div', 'bk-fund-top')
    const name = el('div'); name.append(el('strong', '', 'Your halal savings'), el('span', '', 'Settled once a day'))
    const px = el('div', 'bk-px'); px.append(el('strong', '', money(sv.balance)), el('span', sv.paid >= 0 ? 'up' : 'down', `${sv.paid >= 0 ? '+' : ''}${money(sv.paid)} shared so far`))
    top.append(name, px)
    acct.append(top)
    const recent = sv.log.slice(-5).reverse()
    if (recent.length) {
      const list = el('div', 'bk-kv')
      for (const r of recent) { const d = el('div'); d.append(el('span', '', `${r.day} · pool ${r.pool >= 0 ? '+' : ''}${(r.pool * 100).toFixed(3)}%`), el('b', r.amount >= 0 ? 'up' : 'down', `${r.amount >= 0 ? '+' : ''}${money(r.amount)}`)); list.append(d) }
      acct.append(list)
    } else acct.append(el('p', 'bk-note', `Today's pool result: ${poolResult(today()) >= 0 ? '+' : ''}${(poolResult(today()) * 100).toFixed(3)}%. Your first share is paid tomorrow.`))
    const row = el('div', 'bk-row')
    for (const usd of [50, 200, 1000]) row.append(btn(`Save ${money(usd).replace('.00', '')}`, 'bk-btn', () => {
      if (usd > earned() + 1e-9) { o.toast(`Halal savings take earned in-game cash only. You have ${money(earned())} earned.`); return }
      const r = spendInGame(usd, 'Halal savings deposit', 'Grind Bank · profit-sharing account.')
      if (!r.ok) { o.toast(r.message); return }
      s.savings = { ...s.savings, balance: Math.round((s.savings.balance + usd) * 100) / 100 }; save(); o.toast(`Saved ${money(usd)}. Profit is shared daily.`); render()
    }))
    if (sv.balance > 0) row.append(btn('Withdraw all', 'bk-btn ghost', () => {
      const amt = s.savings.balance
      earnCash(amt, 'Halal savings withdrawal', 'Grind Bank · profit-sharing account.')
      s.savings = { ...s.savings, balance: 0 }; save(); o.toast(`Withdrew ${money(amt)}.`); render()
    }))
    acct.append(row)
    const crypto = el('details', 'bk-facts')
    crypto.append(el('summary', '', 'Crypto and halal: what to look for'))
    for (const t of ['Scholars differ on crypto, so ask one you trust. Common screens:', 'Own the asset outright (spot), not leverage, perpetuals or options.', 'Avoid interest-bearing lending and products built like gambling.', 'Check what the project does: no alcohol, gambling or interest at its core.', 'Pay zakat on savings and holdings above the nisab, once a lunar year.']) crypto.append(el('p', '', t))
    body.append(intro, acct, crypto)
  }

  render()
  // Live prices move the ETF desk while it is open.
  const timer = window.setInterval(() => { if (tab === 'etf' && root.isConnected) render() }, 5000)
}
