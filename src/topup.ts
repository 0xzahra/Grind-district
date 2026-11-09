// Top-up sheet, no wallet connect: pick USDC or ETH, copy the GrindTreasury address on Base, send from any wallet,
// then paste the transaction hash. /api/topup-confirm verifies the payment on-chain and credits in-game $.
import qrcode from 'qrcode-generator'
import { GRIND_TREASURY_VAULT, ETH_USD_FEED, breakdown, ethToUsdMicro } from './grindConfig.ts'
import { applyTopup } from './state.ts'

const RPC = 'https://mainnet.base.org'
const usd = (micro: bigint) => `$${(Number(micro) / 1e6).toFixed(2)}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a)

/** Chainlink ETH/USD latestRoundData via a plain eth_call (keeps viem out of the game bundle). 8 decimals. */
export async function ethPrice(): Promise<bigint> {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: ETH_USD_FEED, data: '0xfeaf968c' }, 'latest'] }) })
  const { result } = (await r.json()) as { result?: string }
  if (!result || result.length < 130) throw new Error('no price')
  return BigInt(`0x${result.slice(66, 130)}`)
}

/** Pull credited top-ups for this address from the server and add any not yet in the local balance. */
export async function syncTopups(player: string, onChange: () => void): Promise<void> {
  try {
    const r = await fetch(`/api/topup-confirm?player=${player}`)
    if (!r.ok) return
    const { topups } = (await r.json()) as { topups: Array<{ hash: string; credit: number; asset: string }> }
    let changed = false
    for (const t of topups) changed = applyTopup(t.hash, t.credit, t.asset) || changed
    if (changed) onChange()
  } catch { /* offline */ }
}

const WALLET_KEY = 'gd.topup.wallet'
const savedFrom = () => { try { const s = localStorage.getItem(WALLET_KEY) ?? ''; return isAddr(s) ? s : '' } catch { return '' } }

/** On load: re-sync credited top-ups for the sender address saved on this device. */
export async function autoSyncTopups(onChange: () => void): Promise<void> {
  const a = savedFrom()
  if (a) await syncTopups(a.toLowerCase(), onChange)
}

export function renderTopup(root: HTMLElement, onCredited: () => void, opts: { demo?: boolean } = {}): void {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  const input = (label: string, ph: string, mode: string) => { const i = el('input') as HTMLInputElement; i.className = 'topup-input topup-mono'; i.placeholder = ph; i.inputMode = mode; i.autocomplete = 'off'; i.spellcheck = false; i.setAttribute('aria-label', label); return i }
  let asset: 'USDC' | 'ETH' = 'USDC'
  let price = 0n
  const box = el('div', '', 'topup')
  const tabs = el('div', '', 'topup-tabs')
  const tUsdc = el('button', 'USDC', 'on'); const tEth = el('button', 'ETH')
  tUsdc.type = tEth.type = 'button'
  tabs.append(tUsdc, tEth)

  const step1 = el('label', '1. The address you will send from', 'topup-label')
  const from = input('Your sending address', '0x… your wallet address', 'text')
  from.value = savedFrom()

  const step2 = el('label', '2. Send USDC to this address', 'topup-label')
  const addrBox = el('div', '', 'topup-addr')
  const qr = el('div', '', 'topup-qr')
  try { const q = qrcode(0, 'M'); q.addData(GRIND_TREASURY_VAULT); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) } catch { qr.remove() }
  const addr = el('code', GRIND_TREASURY_VAULT, 'topup-mono')
  addrBox.append(qr, addr)
  const copy = el('button', 'Copy address', 'topup-go') as HTMLButtonElement
  copy.type = 'button'
  const base = el('p', 'Send only on Base. Other networks are lost.', 'topup-warn')
  const rate = el('p', '', 'cc-muted')
  const table = el('dl', '', 'topup-break')

  const step3 = el('label', "3. We'll detect your payment automatically", 'topup-label')
  const hashHint = el('p', "We watch Base for a payment from the address above. If it's slow to show up, paste the transaction hash here to confirm it now.", 'cc-muted')
  const hashIn = input('Transaction hash', '0x… transaction hash (optional)', 'text')
  const go = el('button', 'Confirm', 'topup-go') as HTMLButtonElement
  go.type = 'button'
  const status = el('p', '', 'topup-status')
  const fine = el('p', 'Funds go to the Grind District treasury on Base, controlled by the team Safe. In-game $ is a game balance, not a withdrawable token.', 'cc-muted')
  box.append(tabs, step1, from, step2, addrBox, copy, base, rate, table, step3, hashHint, hashIn, go, status, fine)
  root.append(box)

  const paint = () => {
    tUsdc.classList.toggle('on', asset === 'USDC'); tEth.classList.toggle('on', asset === 'ETH')
    step2.textContent = `2. Send ${asset} to this address`
    rate.textContent = asset === 'USDC' ? 'Rate: 1 USDC = $1.00 in-game, minus the 2% fee.'
      : price ? `Rate: 1 ETH ≈ $${(Number(price) / 1e8).toFixed(2)} in-game (Chainlink ETH/USD on Base at your payment's block), minus the 2% fee.` : 'Loading live ETH price…'
    table.replaceChildren()
    const ex = asset === 'USDC' ? 10_000_000n : price ? ethToUsdMicro(5n * 10n ** 15n, price) : 0n
    if (ex) { const b = breakdown(ex); table.append(el('dt', `Example: ${asset === 'USDC' ? '10 USDC' : '0.005 ETH'}`), el('dd', usd(ex)), el('dt', '2% fee'), el('dd', usd(b.fee)), el('dt', 'You receive', 'topup-get'), el('dd', usd(b.credit), 'topup-get')) }
    const okFrom = isAddr(from.value.trim())
    go.disabled = !okFrom || !/^0x[0-9a-fA-F]{64}$/.test(hashIn.value.trim())
  }
  tUsdc.onclick = () => { asset = 'USDC'; paint() }
  tEth.onclick = () => { asset = 'ETH'; paint() }
  from.oninput = () => { const v = from.value.trim(); if (isAddr(v)) { try { localStorage.setItem(WALLET_KEY, v) } catch { /* private */ } } paint(); restartWatch() }
  hashIn.oninput = paint
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(GRIND_TREASURY_VAULT); copy.textContent = 'Copied' } catch {
      const r = document.createRange(); r.selectNodeContents(addr); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); copy.textContent = 'Selected: copy it'
    }
    setTimeout(() => { copy.textContent = 'Copy address' }, 1800)
  }
  ethPrice().then((p) => { price = p; paint() }).catch(() => { rate.textContent = 'ETH price unavailable right now; USDC works.' })
  paint()
  if (opts.demo) return

  let busy = false // a confirm (manual or auto-detected) is in flight: the watch poll below waits its turn
  const confirmHash = async (hash: `0x${string}`) => {
    const sender = from.value.trim().toLowerCase()
    let token: string | null = null
    try { token = await (await import('./login.ts')).accessToken() } catch { token = null }
    for (let i = 0; i < 10; i += 1) {
      status.textContent = i ? 'Waiting for Base to confirm…' : 'Checking your payment on Base…'
      const r = await fetch('/api/topup-confirm', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ hash, from: sender }) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; creditUsd?: number; asset?: string; error?: string }
      if (j.ok && j.creditUsd) { applyTopup(hash, j.creditUsd, j.asset ?? asset); onCredited(); status.textContent = `Credited $${j.creditUsd.toFixed(2)} in-game.`; hashIn.value = ''; return }
      if (r.status !== 409 && r.status !== 502) { status.textContent = `Not credited: ${j.error ?? r.status}.`; return }
      if (/already (pending|being)/.test(j.error ?? '') && i > 3) break
      await new Promise((ok) => setTimeout(ok, 3000))
    }
    status.textContent = `Still confirming tx ${short(hash)}. Your payment is safe; tap Confirm again in a minute.`
  }
  go.onclick = () => {
    go.disabled = true
    busy = true
    confirmHash(hashIn.value.trim().toLowerCase() as `0x${string}`)
      .catch((e: Error) => { status.textContent = e.message || 'Network error; try again.' })
      .finally(() => { busy = false; paint() })
  }

  // Auto-detect: poll Base for a payment from the declared address straight to the treasury, so the player
  // never has to find and paste their own transaction hash. /api/topup-confirm still does the real
  // verification and the idempotent credit; this only discovers which hash to hand it.
  let watchTimer: ReturnType<typeof setTimeout> | null = null
  let watchedFor = ''
  const pollWatch = async () => {
    watchTimer = null
    const sender = from.value.trim().toLowerCase()
    if (!box.isConnected || sender !== watchedFor) return // the sheet closed, or the address changed under us
    if (!busy) {
      try {
        const r = await fetch(`/api/topup-watch?from=${sender}`)
        if (r.status === 503) return // not configured server-side: retrying won't help, fall back to the manual hash field
        const j = (await r.json().catch(() => ({}))) as { hash?: string | null }
        if (j.hash && box.isConnected && sender === watchedFor) {
          hashIn.value = j.hash
          busy = true
          status.textContent = 'Payment found on Base, confirming…'
          await confirmHash(j.hash.toLowerCase() as `0x${string}`).catch((e: Error) => { status.textContent = e.message || 'Network error; try again.' })
          busy = false
          paint()
        } else if (box.isConnected && sender === watchedFor) {
          status.textContent = 'Watching for your payment on Base…'
        }
      } catch { /* a flaky poll just tries again next tick */ }
    }
    if (box.isConnected && sender === watchedFor) watchTimer = setTimeout(pollWatch, 5000)
  }
  const restartWatch = () => {
    if (watchTimer) { clearTimeout(watchTimer); watchTimer = null }
    const sender = from.value.trim().toLowerCase()
    watchedFor = isAddr(sender) ? sender : ''
    if (watchedFor) watchTimer = setTimeout(pollWatch, 1200)
  }
  restartWatch()
}
