// Automatic top-up: pick amount → Pay in wallet → server detects & credits. No copy/paste of address or hash.
import { GRIND_TREASURY_VAULT, BASE_USDC, breakdown, ethToUsdMicro } from './grindConfig.ts'
import { applyTopup } from './state.ts'
import { ethPrice } from './topupPrice.ts'
import { gameWalletAddress, payUsdcFromGameWallet, checkGameWalletUsdc, WalletNotSent, GAS_SPONSOR } from './privyWallet.ts'
/** Custom top-up range (mirrors api/_topupAuto.ts MIN_USDC / MAX_USDC). Default stays 5 USDC. */
const MIN_USDC = 1
const MAX_USDC = 1000
export { ethPrice } from './topupPrice.ts'
export { syncTopups, autoSyncTopups } from './topupSync.ts'

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }
const provider = (): Eip1193 | undefined => (window as unknown as { ethereum?: Eip1193 }).ethereum
const CHAIN = '0x2105'
const RPC = 'https://mainnet.base.org'
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a)
const pad = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0')
const usd = (micro: bigint) => `$${(Number(micro) / 1e6).toFixed(2)}`
const WALLET_KEY = 'gd.topup.wallet'

async function ensureBase(p: Eip1193) {
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN }] })
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: CHAIN, chainName: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: ['https://basescan.org'] }],
    })
  }
}

async function connectWallet(): Promise<string> {
  const p = provider()
  if (!p) throw new Error('Install a Base wallet (e.g. MetaMask) to top up')
  const accounts = (await p.request({ method: 'eth_requestAccounts' })) as string[]
  const a = (accounts[0] ?? '').toLowerCase()
  if (!isAddr(a)) throw new Error('No wallet account')
  try { localStorage.setItem(WALLET_KEY, a) } catch { /* private */ }
  await ensureBase(p)
  return a
}

type Order = {
  orderId: string
  asset: 'USDC' | 'ETH'
  amountRaw: string
  amountLabel: string
  status: string
  creditUsd?: number | null
  txHash?: string | null
  message?: string
  ok?: boolean
  waiting?: boolean
  error?: string
  detected?: boolean
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  let token: string | null = null
  try { token = await (await import('./login.ts')).accessToken() } catch { token = null }
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined), ...(token ? { authorization: `Bearer ${token}` } : {}) }
  if (init?.body && !headers['content-type']) headers['content-type'] = 'application/json'
  return fetch(path, { ...init, headers })
}

export function renderTopup(root: HTMLElement, onCredited: () => void, opts: { demo?: boolean } = {}): void {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  let asset: 'USDC' | 'ETH' = 'USDC'
  let dollars = 5
  const usdcOk = () => Number.isFinite(dollars) && dollars >= MIN_USDC && dollars <= MAX_USDC && Math.abs(dollars * 100 - Math.round(dollars * 100)) < 1e-6
  let milliEth = 1
  let price = 0n
  let busy = false
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let currentOrder: Order | null = null

  const box = el('div', '', 'topup')
  const tabs = el('div', '', 'topup-tabs')
  const tUsdc = el('button', 'USDC', 'on') as HTMLButtonElement
  const tEth = el('button', 'ETH') as HTMLButtonElement
  tUsdc.type = tEth.type = 'button'
  tabs.append(tUsdc, tEth)
  const amtLabel = el('label', 'Amount', 'topup-label')
  const presets = el('div', '', 'topup-presets')
  const table = el('dl', '', 'topup-break')
  const pay = el('button', 'Pay with wallet', 'topup-go') as HTMLButtonElement
  pay.type = 'button'
  // Built-in Privy wallet (Google / X / email players): pays the same treasury, same detection.
  const payGame = el('button', 'Pay from my game wallet', 'topup-go') as HTMLButtonElement
  payGame.type = 'button'
  const custom = el('input', '', 'topup-custom') as HTMLInputElement
  custom.type = 'number'; custom.inputMode = 'decimal'; custom.min = String(MIN_USDC); custom.max = String(MAX_USDC); custom.step = '0.01'; custom.value = '5'
  custom.setAttribute('aria-label', 'Custom USDC amount')
  custom.placeholder = 'Other amount'
  custom.style.cssText = 'width:100%;margin-top:6px'
  const status = el('p', '', 'topup-status')
  const fine = el('p', 'Pays the Grind District treasury on Base automatically. In-game $ is a game balance, not withdrawable. No address or hash to copy.', 'cc-muted')
  box.append(tabs, amtLabel, presets, custom, table, pay, payGame, status, fine)
  root.append(box)

  const stopPoll = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

  const paintPresets = () => {
    presets.replaceChildren()
    const list = asset === 'USDC' ? [5, 10, 25, 50, 100] : [1, 5, 10]
    for (const n of list) {
      const b = el('button', '', '') as HTMLButtonElement
      b.type = 'button'
      b.textContent = asset === 'USDC' ? `$${n}` : `${(n / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} ETH`
      b.className = (asset === 'USDC' ? dollars === n : milliEth === n) ? 'on' : ''
      b.onclick = () => { if (asset === 'USDC') { dollars = n; custom.value = String(n) } else milliEth = n; paint() }
      presets.append(b)
    }
  }

  const paint = () => {
    tUsdc.classList.toggle('on', asset === 'USDC')
    tEth.classList.toggle('on', asset === 'ETH')
    paintPresets()
    table.replaceChildren()
    const ex = asset === 'USDC' ? (usdcOk() ? BigInt(Math.round(dollars * 100)) * 10_000n : 0n) : price ? ethToUsdMicro(BigInt(milliEth) * 10n ** 15n, price) : 0n
    if (ex) {
      const b = breakdown(ex)
      table.append(
        el('dt', asset === 'USDC' ? `$${dollars.toFixed(2).replace(/\.00$/, '')}` : `${(milliEth / 1000).toFixed(3)} ETH`),
        el('dd', usd(ex)),
        el('dt', '2% fee'),
        el('dd', usd(b.fee)),
        el('dt', 'You receive', 'topup-get'),
        el('dd', usd(b.credit), 'topup-get'),
      )
    } else if (asset === 'ETH') {
      table.append(el('dt', 'ETH price'), el('dd', 'Loading…'))
    } else {
      table.append(el('dt', `Enter ${MIN_USDC} to ${MAX_USDC} USDC`), el('dd', ''))
    }
    custom.hidden = asset !== 'USDC'
    payGame.hidden = asset !== 'USDC' || !gameWalletAddress()
    payGame.disabled = busy || !!opts.demo || !usdcOk()
    pay.disabled = busy || !!opts.demo || (asset === 'USDC' && !usdcOk())
    pay.textContent = busy ? 'Working…' : currentOrder?.status === 'waiting' ? `Waiting for ${currentOrder.amountLabel}…` : 'Pay with wallet'
  }

  const onCredit = (hash: string, credit: number, a: string) => {
    applyTopup(hash, credit, a)
    onCredited()
    status.textContent = `Credited $${credit.toFixed(2)} in-game.`
    currentOrder = null
    stopPoll()
    paint()
  }

  const tick = async (orderId: string) => {
    try {
      const r = await api('/api/topup-confirm', { method: 'POST', body: JSON.stringify({ op: 'scan', orderId }) })
      const j = (await r.json().catch(() => ({}))) as Order & { creditUsd?: number; asset?: string; txHash?: string }
      if (j.ok && j.creditUsd && (j.txHash || currentOrder?.txHash)) {
        onCredit((j.txHash || currentOrder?.txHash)!, j.creditUsd, j.asset ?? asset)
        return
      }
      if (r.status === 410) {
        status.textContent = j.error || 'Order expired. Start again.'
        currentOrder = null
        stopPoll()
        busy = false
        paint()
        return
      }
      if (j.waiting || j.status === 'waiting') status.textContent = 'Waiting for payment…'
      else if (j.detected || j.status === 'detected') status.textContent = 'Payment detected… confirming on Base…'
      else if (j.error && r.status >= 400 && r.status !== 409) status.textContent = `Not credited: ${j.error}`
      else {
        const g = await api(`/api/topup-confirm?order=${orderId}`)
        const o = (await g.json().catch(() => ({}))) as Order
        if (o.status === 'credited' && o.creditUsd && o.txHash) onCredit(o.txHash, o.creditUsd, o.asset)
        else if (o.status === 'waiting') status.textContent = 'Waiting for payment…'
        else if (o.status === 'detected') status.textContent = 'Payment detected… confirming on Base…'
      }
    } catch {
      status.textContent = 'Network hiccup; still watching for your payment…'
    }
  }

  const pollOrder = (orderId: string) => {
    stopPoll()
    pollTimer = setInterval(() => { void tick(orderId) }, 3000)
    void tick(orderId)
  }

  const payNow = async (source: 'external' | 'game' = 'external') => {
    if (asset === 'USDC' && !usdcOk()) { status.textContent = `Enter between ${MIN_USDC} and ${MAX_USDC} USDC (up to 2 decimals).`; return }
    if (source === 'game' && asset !== 'USDC') return
    busy = true
    paint()
    status.textContent = 'Creating your top-up…'
    try {
      const from = source === 'game' ? gameWalletAddress().toLowerCase() : await connectWallet()
      if (!isAddr(from)) throw new Error('No game wallet yet. Sign in with Google, X or email to create it.')
      if (source === 'game') await checkGameWalletUsdc(BASE_USDC, BigInt(Math.round(dollars * 100)) * 10_000n)
      const body = asset === 'USDC'
        ? { op: 'create', asset: 'USDC', dollars, from }
        : { op: 'create', asset: 'ETH', milliEth, from }
      const cr = await api('/api/topup-confirm', { method: 'POST', body: JSON.stringify(body) })
      const order = (await cr.json().catch(() => ({}))) as Order & { error?: string }
      if (!cr.ok || !order.orderId) throw new Error(order.error || `Could not start top-up (${cr.status})`)
      currentOrder = order
      status.textContent = source === 'game' ? `Sending ${order.amountLabel} from your game wallet…` : `Approve ${order.amountLabel} in your wallet…`
      paint()
      const amount = BigInt(order.amountRaw)
      let hash: string
      if (source === 'game') {
        const sent = await payUsdcFromGameWallet(BASE_USDC, GRIND_TREASURY_VAULT, amount)
        if (!sent.hash) {
          // Sponsored send still settling: the order scan finds the USDC transfer from this wallet.
          status.textContent = 'Payment sent (gas covered)… confirming on Base…'
          pollOrder(order.orderId)
          return
        }
        hash = sent.hash
      } else if (asset === 'USDC') {
        const p = provider()!
        const tx = { from, to: BASE_USDC, data: '0xa9059cbb' + pad(GRIND_TREASURY_VAULT) + amount.toString(16).padStart(64, '0') }
        hash = (await p.request({ method: 'eth_sendTransaction', params: [tx] })) as string
      } else {
        const p = provider()!
        const tx = { from, to: GRIND_TREASURY_VAULT, value: '0x' + amount.toString(16) }
        hash = (await p.request({ method: 'eth_sendTransaction', params: [tx] })) as string
      }
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('Wallet did not return a transaction')
      status.textContent = 'Payment sent… confirming on Base…'
      currentOrder = { ...order, txHash: hash.toLowerCase(), status: 'detected' }
      for (let i = 0; i < 12; i += 1) {
        const r = await api('/api/topup-confirm', { method: 'POST', body: JSON.stringify({ op: 'confirm', hash, from, orderId: order.orderId }) })
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; creditUsd?: number; asset?: string; error?: string }
        if (j.ok && j.creditUsd) { onCredit(hash.toLowerCase(), j.creditUsd, j.asset ?? asset); busy = false; paint(); return }
        if (r.status !== 409 && r.status !== 502) {
          status.textContent = j.error ? `Checking: ${j.error}` : 'Waiting for Base to confirm…'
          break
        }
        status.textContent = 'Waiting for Base to confirm…'
        await new Promise((ok) => setTimeout(ok, 3000))
      }
      status.textContent = 'Waiting for payment…'
      pollOrder(order.orderId)
    } catch (e) {
      status.textContent = (e as Error).message || 'Top-up cancelled'
      // Game wallet sent nothing (no USDC, no gas, or an error before sending): don't keep watching.
      if (e instanceof WalletNotSent) currentOrder = null
      else if (currentOrder?.orderId) pollOrder(currentOrder.orderId)
    } finally {
      busy = false
      paint()
    }
  }

  tUsdc.onclick = () => { asset = 'USDC'; paint() }
  tEth.onclick = () => { asset = 'ETH'; paint() }
  pay.onclick = () => { if (!opts.demo) void payNow('external') }
  payGame.onclick = () => { if (!opts.demo) void payNow('game') }
  custom.oninput = () => { const v = Number(custom.value); dollars = Number.isFinite(v) ? v : 0; paint() }
  if (GAS_SPONSOR) fine.textContent += ' Game wallet gas is covered by Grind District while the monthly allowance lasts.'
  ethPrice().then((p) => { price = p; paint() }).catch(() => { /* USDC still works */ })
  paint()
  const obs = new MutationObserver(() => { if (!root.contains(box)) { stopPoll(); obs.disconnect() } })
  obs.observe(root, { childList: true, subtree: true })
}
