// The Stockholders' Club: a members' club in the city for players who hold a tokenized stock on Base.
// (Base · Stocks Maxxing, track 1.3 "Stockholder clubs".)
//
// - Join: connect a Base wallet and sign one plain message that proves you control the address. It is a
//   signature, not a transaction: no gas, nothing moves. The signature is checked against Base (smart wallets
//   too), then the game reads, for that address only, its balance of each listed stock token (Coinbase's B20
//   tokens, listed by api/_stocks.ts at /api/stocks) in a few read-only multicalls. Nothing else in the wallet is read.
// - Eligible: at least MIN_SHARES of any one listed stock. Shares = token balance × the token's multiplier, so
//   splits and reinvested dividends count.
// - Private: the address and the amounts stay on this device, beside the save (save format unchanged). The game
//   shows only that you are a member and, if you choose, a club pin on your nameplate.
// - Benefits, not rights: a research desk with a briefing for each stock you hold and a club pin. Membership gives
//   no voting or other rights in any company, and the club sells nothing.
// - Re-checked every time you open the club and when your profile opens. Sell below the minimum and membership
//   lapses at once; hold again to rejoin.
import { slotKey, getSave, addReputation } from './state.ts'

export const MIN_SHARES = 0.01
const PROOF_DAYS = 30
const STALE_MS = 10 * 60_000
const RPC = 'https://mainnet.base.org'

export type Stock = { s: string; n: string; a: `0x${string}`; d: number; m: number; nav: number | null; navAt: string | null; isin: string | null; icon: string | null; desc: string; paused: number[] }
export type Holding = { s: string; n: string; shares: number }
type Status = 'none' | 'member' | 'lapsed'
type Store = { address?: `0x${string}`; proofAt?: number; checkedAt?: number; joinedAt?: number; lapsedAt?: number; status: Status; holdings: Holding[]; lastHeld: string[]; pin: boolean; rewarded?: boolean }

const blank = (): Store => ({ status: 'none', holdings: [], lastHeld: [], pin: true })
const key = () => `${slotKey()}.club`
function read(): Store { try { return { ...blank(), ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as Partial<Store>) } } catch { return blank() } }
function write(s: Store) { try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ } }

export const clubMember = (): boolean => read().status === 'member'
const isAddr = (a: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a)
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const fmtShares = (n: number) => n >= 100 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toLocaleString('en-US', { maximumFractionDigits: 4 })
const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const few = (xs: string[]) => xs.length > 3 ? `${xs.slice(0, 3).join(', ')} and ${xs.length - 3} more` : xs.join(', ')

// The stock list, from our edge copy of Coinbase's Tokenized Stocks API.
let list: Promise<Stock[]> | null = null
export function stocks(): Promise<Stock[]> {
  list ??= fetch('/api/stocks').then(async (r) => {
    if (!r.ok) throw new Error('list')
    const j = (await r.json()) as { tokens?: Stock[] }
    const t = (j.tokens ?? []).filter((x) => isAddr(x.a) && Number.isFinite(x.d))
    if (!t.length) throw new Error('empty')
    return t
  }).catch((e: unknown) => { list = null; throw e })
  return list
}

async function chain() {
  const { createPublicClient, http } = await import('viem')
  return createPublicClient({ chain: BASE, transport: http(RPC, { retryCount: 2 }) })
}
// Base mainnet, defined here: importing viem/chains pulls in every chain viem knows (a 559 KB download).
const BASE = {
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' as const, blockCreated: 5022 } },
} as const
const BALANCE = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const

/** Shares of each listed stock this address holds, read from Base (balance × multiplier), largest first. */
export async function readHoldings(address: `0x${string}`): Promise<Holding[]> {
  const [all, c] = await Promise.all([stocks(), chain()])
  const res = await c.multicall({ contracts: all.map((t) => ({ address: t.a, abi: BALANCE, functionName: 'balanceOf' as const, args: [address] as const })), allowFailure: true, batchSize: 24_000 })
  const out: Holding[] = []
  res.forEach((r, i) => {
    const t = all[i]
    if (!t || r.status !== 'success') return
    const raw = r.result as bigint
    if (raw <= 0n) return
    out.push({ s: t.s, n: t.n, shares: (Number(raw) / 10 ** t.d) * (t.m || 1) })
  })
  return out.sort((a, b) => b.shares - a.shares)
}

type Outcome = { ok: boolean; message: string }

/** Read the holdings for the stored address and set membership from them. */
async function evaluate(s: Store): Promise<Outcome> {
  if (!s.address) return { ok: false, message: 'No wallet linked yet.' }
  const held = await readHoldings(s.address)
  const eligible = held.filter((h) => h.shares >= MIN_SHARES)
  const before = s.status
  s.checkedAt = Date.now()
  if (eligible.length) {
    s.status = 'member'; s.holdings = eligible; s.lastHeld = eligible.map((h) => h.s); s.joinedAt = before === 'member' ? (s.joinedAt ?? Date.now()) : Date.now(); s.lapsedAt = undefined
    const first = !s.rewarded
    s.rewarded = true
    write(s)
    if (first) window.setTimeout(() => addReputation(5, "Reputation: joined the Stockholders' Club", 'Proved a stock holding on Base.'), 0)
    const names = few(eligible.map((h) => h.s))
    return { ok: true, message: before === 'member' ? `Still a member: you hold ${names}.` : `Welcome to the Stockholders' Club. You hold ${names}.` }
  }
  s.holdings = []
  if (before === 'member') { s.status = 'lapsed'; s.lapsedAt = Date.now() } else if (before !== 'lapsed') s.status = 'none'
  write(s)
  return before === 'member'
    ? { ok: false, message: `Your membership has lapsed: this wallet no longer holds at least ${MIN_SHARES} share of a listed stock (you held ${few(s.lastHeld)}). Hold again to rejoin.` }
    : { ok: false, message: `This wallet holds no listed stock token on Base (at least ${MIN_SHARES} share), so it cannot join yet.` }
}

/** Check again if the last check is older than ten minutes (or always, with force). Signs nothing. */
export async function recheck(force = false): Promise<Outcome | null> {
  const s = read()
  if (!s.address) return null
  if (!s.proofAt || Date.now() - s.proofAt > PROOF_DAYS * 864e5) {
    if (s.status === 'member') { s.status = 'lapsed'; s.lapsedAt = Date.now(); s.holdings = []; write(s) }
    return { ok: false, message: 'Your wallet proof is over 30 days old. Sign again to keep your membership.' }
  }
  if (!force && s.checkedAt && Date.now() - s.checkedAt < STALE_MS) return null
  return evaluate(s)
}

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }
const injected = (): Eip1193 | undefined => (window as unknown as { ethereum?: Eip1193 }).ethereum

function proofText(address: string): string {
  const u = getSave().username
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
  return [
    "Grind District · Stockholders' Club",
    '',
    'I control this address. The club may read its stock token balances on Base.',
    'This is a signature, not a transaction. It costs nothing and moves nothing.',
    '',
    `Address: ${address}`,
    ...(u ? [`Player: @${u}`] : []),
    `Issued: ${new Date().toISOString()}`,
    `Nonce: ${nonce}`,
  ].join('\n')
}

/** Connect the browser wallet, prove the address with one signature, then check its holdings. */
export async function join(): Promise<Outcome> {
  const p = injected()
  if (!p) return { ok: false, message: "No wallet in this browser. Open Grind District in your wallet app's browser (Coinbase Wallet, MetaMask), then try again." }
  try {
    const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[]
    const address = accounts[0] ?? ''
    if (!isAddr(address)) return { ok: false, message: 'The wallet shared no account.' }
    const [{ toHex }, c] = await Promise.all([import('viem'), chain()])
    const message = proofText(address)
    const signature = (await p.request({ method: 'personal_sign', params: [toHex(message), address] })) as `0x${string}`
    const valid = await c.verifyMessage({ address, message, signature })
    if (!valid) return { ok: false, message: 'That signature does not match the address, so nothing was linked.' }
    const s = read()
    if (s.address?.toLowerCase() !== address.toLowerCase()) { s.status = s.status === 'member' ? 'lapsed' : s.status; s.holdings = []; s.lastHeld = s.lastHeld ?? [] }
    s.address = address
    s.proofAt = Date.now()
    return await evaluate(s)
  } catch (e) {
    const code = (e as { code?: number }).code
    if (code === 4001) return { ok: false, message: 'You cancelled in the wallet. Nothing was linked.' }
    return { ok: false, message: 'The wallet or Base did not answer. Try again in a moment.' }
  }
}

/** Forget the linked address and everything read for it. */
export function leave(): void { const s = read(); write({ ...blank(), rewarded: s.rewarded }) }
export function setPin(on: boolean): void { const s = read(); s.pin = on; write(s) }

/** The club pin on the profile nameplate (members who keep it on). Re-checks a stale membership first. */
export function markPlate(plate: HTMLElement): void {
  const paint = () => {
    plate.querySelector('.club-pin')?.remove()
    const s = read()
    if (s.status !== 'member' || !s.pin) return
    const pin = document.createElement('span')
    pin.className = 'club-pin'
    pin.textContent = "Stockholders' Club"
    pin.title = 'Holds a tokenized stock on Base'
    plate.append(pin)
  }
  paint()
  void recheck().then((r) => { if (r) paint() }).catch(() => {})
}

// ---- The club panel -------------------------------------------------------------------------------------------

type H = { para: (t: string, c?: string) => HTMLElement; button: (t: string, c: string, f: () => void) => HTMLElement; trade: () => void }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text) n.textContent = text
  return n
}

function briefing(t: Stock, held: Holding | undefined, h: H): HTMLElement {
  const box = el('div', 'club-brief')
  box.append(el('h4', '', `${t.s} · ${t.n}`))
  if (held) box.append(h.para(`You hold ${fmtShares(held.shares)} share${held.shares === 1 ? '' : 's'}${t.m !== 1 ? ` (tokens × multiplier ${t.m.toFixed(4)})` : ''}. Only you see this.`))
  if (t.nav != null) {
    const at = t.navAt ? Date.parse(t.navAt) : NaN
    const old = Number.isFinite(at) && Date.now() - at > 26 * 3600_000
    box.append(h.para(`Reference price (NAV): $${t.nav.toLocaleString('en-US', { maximumFractionDigits: 2 })} per token${Number.isFinite(at) ? `, updated ${when(at)}` : ''}.${old ? ' Markets are closed or the feed is paused, so this is the last value.' : ''}`))
  } else box.append(h.para('No reference price is published for this token yet. DEX prices can differ from the share price, especially when markets are closed.', 'muted'))
  if (t.isin) box.append(h.para(`ISIN ${t.isin}: use it to find the company's own filings.`, 'muted'))
  if (t.paused.length) box.append(h.para('Some token functions are paused right now (for example during a corporate action).', 'muted'))
  const about = t.desc.split(/\n\n+/).filter((p) => p && !/^About /.test(p)).slice(0, 2)
  for (const p of about) box.append(h.para(p, 'muted'))
  box.append(el('h5', '', 'Research session'))
  const ol = el('ol', 'club-steps')
  for (const step of [
    "Read the company's latest annual and quarterly reports on its investor relations site.",
    'Find the next earnings date and what the company said it expects.',
    'Write one line: why you hold it, and what would make you sell.',
    'Check how big this position is next to everything else you own.',
  ]) ol.append(el('li', '', step))
  box.append(ol, h.para('A tokenized stock gives economic exposure to the share, not a vote at the company. Not financial advice.', 'muted'))
  return box
}

/** The club's door card: join, prove a holding, the benefits, lapse and leave. Re-renders itself as checks finish. */
export function clubNodes(h: H): HTMLElement[] {
  const root = el('div', 'club')
  let note = ''
  let busy = ''
  let open = ''

  const render = () => {
    const s = read()
    root.replaceChildren()
    root.append(h.para('A members\' club for people who hold tokenized stocks on Base. Membership opens research sessions and a club pin. It gives no voting or other rights in any company, and the club sells nothing.'))
    if (busy) { root.append(h.para(busy, 'club-busy')); return }
    if (note) root.append(h.para(note, 'club-note'))

    if (s.status === 'member') {
      const card = el('div', 'club-card')
      card.append(el('strong', '', 'Member'), el('span', '', `Wallet ${short(s.address ?? '')} · checked ${s.checkedAt ? when(s.checkedAt) : 'now'}`))
      root.append(card, el('h4', '', 'Your stocks (private)'))
      const rows = el('div', 'club-rows')
      for (const x of s.holdings) {
        const row = el('button', `club-row${open === x.s ? ' on' : ''}`) as HTMLButtonElement
        row.type = 'button'
        row.append(el('b', '', x.s), el('span', '', x.n), el('em', '', fmtShares(x.shares)))
        row.addEventListener('click', () => { open = open === x.s ? '' : x.s; render() })
        rows.append(row)
        if (open === x.s) {
          const slot = el('div', 'club-slot')
          rows.append(slot)
          void stocks().then((all) => { const t = all.find((y) => y.s === x.s); if (t && slot.isConnected) slot.append(briefing(t, x, h)) }).catch(() => { slot.append(h.para('The briefing could not load. Try again.', 'muted')) })
        }
      }
      root.append(rows, h.para('Tap a stock for its research session.', 'muted'))
      const pin = el('label', 'club-toggle')
      const box = el('input') as HTMLInputElement
      box.type = 'checkbox'; box.checked = s.pin
      box.addEventListener('change', () => { setPin(box.checked); note = box.checked ? 'Your club pin shows on your nameplate.' : 'Your club pin is hidden.'; render() })
      pin.append(box, document.createTextNode(' Show the club pin on my nameplate'))
      root.append(pin)
      root.append(h.button('Check my holdings again', 'ghost', () => void run(() => recheck(true))))
      root.append(h.button('Leave the club and forget this wallet', 'ghost', () => { leave(); note = 'You left the club. The wallet address was removed from this device.'; render() }))
    } else {
      if (s.status === 'lapsed') {
        if (!note) root.append(h.para(`Your membership lapsed${s.lapsedAt ? ` on ${when(s.lapsedAt)}` : ''}: this wallet no longer holds at least ${MIN_SHARES} share of a listed stock${s.lastHeld.length ? ` (you held ${few(s.lastHeld)})` : ''}.`, 'club-note'))
        if (s.address) root.append(h.button('Check again', 'primary', () => void run(() => recheck(true))))
      }
      root.append(el('h4', '', 'Join in three steps'))
      const ol = el('ol', 'club-steps')
      for (const step of [
        'Connect a wallet on Base and sign one message. It is not a transaction: no gas, nothing moves.',
        `The game reads that wallet's balance of each listed stock token on Base, and nothing else. You need at least ${MIN_SHARES} share of one.`,
        'You are in. The address and amounts stay on this device; others see only the club pin, if you show it.',
      ]) ol.append(el('li', '', step))
      root.append(ol, h.button(s.address ? 'Prove a holding with another wallet' : 'Prove a holding', 'primary', () => void run(join)))
      root.append(h.para('Stock tokens on Base are issued by Coinbase for eligible people outside the United States. The club only reads them.', 'muted'))
    }

    // Anyone can see what the club would see for a public address, without joining.
    root.append(el('h4', '', 'Check an address'))
    const form = el('form', 'club-peek')
    const input = el('input') as HTMLInputElement
    input.placeholder = '0x… a Base address'; input.autocomplete = 'off'; input.spellcheck = false
    const go = el('button', 'ghost', 'Check') as HTMLButtonElement
    go.type = 'submit'
    const out = el('div', 'club-peek-out')
    form.append(input, go)
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const a = input.value.trim()
      if (!isAddr(a)) { out.textContent = 'That is not a Base address (0x and 40 characters).'; return }
      out.textContent = 'Reading Base…'
      void readHoldings(a).then((held) => {
        const ok = held.filter((x) => x.shares >= MIN_SHARES)
        out.textContent = held.length
          ? `${ok.length ? 'Would qualify.' : `Would not qualify (under ${MIN_SHARES} share).`} Holds ${held.slice(0, 6).map((x) => `${x.s} ${fmtShares(x.shares)}`).join(', ')}${held.length > 6 ? ` and ${held.length - 6} more` : ''}.`
          : 'Holds no listed stock token on Base.'
      }).catch(() => { out.textContent = 'Base or the stock list did not answer. Try again in a moment.' })
    })
    root.append(form, out, h.para('Read-only: a public address can be looked up by anyone, but only a signature lets a wallet join.', 'muted'))
    root.append(el('h4', '', 'Before you buy a stock token'))
    root.append(h.para('A token tracks a share through a multiplier that changes with dividends and splits. Its reference price updates only while markets are open; DEX prices trade around the clock and can drift. Holding one gives economic exposure, not a vote. Practise on the Trade screen with in-game money first.', 'muted'))
    root.append(h.button('Practise on the Trade screen', 'ghost', h.trade))
  }

  const run = async (f: () => Promise<Outcome | null>) => {
    busy = 'Checking Base…'; note = ''; render()
    try { const r = await f(); note = r?.message ?? 'Up to date.' } catch { note = 'Base or the stock list did not answer. Try again in a moment.' }
    busy = ''
    if (root.isConnected) render()
  }

  render()
  // Every visit re-checks a linked wallet, so a sale ends membership straight away.
  if (read().address) void run(() => recheck(true))
  return [root]
}
