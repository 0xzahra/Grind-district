// Top-up sheet: pay ETH or USDC on Base to GrindLedger, see the fee breakdown first, then the server credits in-game $.
import { createPublicClient, createWalletClient, custom, http, parseEther, parseUnits, erc20Abi, type Address, type EIP1193Provider } from 'viem'
import { base } from 'viem/chains'
import { grindLedgerAbi } from './grindLedgerAbi.ts'
import { GRIND_LEDGER, BASE_USDC, BASE_CHAIN_ID, ETH_USD_FEED, TREASURY_SAFE, feedAbi, breakdown, ethToUsdMicro } from './grindConfig.ts'
import { applyTopup } from './state.ts'

const pub = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
const usd = (micro: bigint) => `$${(Number(micro) / 1e6).toFixed(2)}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const eth = () => (window as unknown as { ethereum?: EIP1193Provider }).ethereum

export async function ethPrice(): Promise<bigint> {
  const [, answer] = await pub.readContract({ address: ETH_USD_FEED, abi: feedAbi, functionName: 'latestRoundData' })
  return answer
}

/** Pull credited top-ups for this wallet from the server and add any not yet in the local balance. */
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

/** On load: re-sync credited top-ups for the last wallet used here, or a wallet already connected (silent, no prompt). */
export async function autoSyncTopups(onChange: () => void): Promise<void> {
  const seen = new Set<string>()
  const saved = localStorage.getItem(WALLET_KEY)
  if (saved && /^0x[0-9a-fA-F]{40}$/.test(saved)) seen.add(saved.toLowerCase())
  try {
    const accounts = (await eth()?.request({ method: 'eth_accounts' })) as string[] | undefined
    for (const a of accounts ?? []) seen.add(a.toLowerCase())
  } catch { /* no wallet */ }
  for (const a of seen) await syncTopups(a, onChange)
}

export function renderTopup(root: HTMLElement, onCredited: () => void, opts: { demo?: boolean } = {}): void {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  let asset: 'USDC' | 'ETH' = 'USDC'
  let price = 0n
  let account: Address | null = null
  const box = el('div', '', 'topup')
  const tabs = el('div', '', 'topup-tabs')
  const tUsdc = el('button', 'USDC', 'on'); const tEth = el('button', 'ETH')
  tUsdc.type = tEth.type = 'button'
  tabs.append(tUsdc, tEth)
  const label = el('label', 'Amount (USDC)', 'topup-label')
  const input = el('input') as HTMLInputElement
  input.inputMode = 'decimal'; input.value = '10'; input.className = 'topup-input'; input.setAttribute('aria-label', 'Amount')
  const rate = el('p', '', 'cc-muted')
  const table = el('dl', '', 'topup-break')
  const status = el('p', '', 'topup-status')
  const go = el('button', 'Connect wallet', 'topup-go') as HTMLButtonElement
  go.type = 'button'
  const fine = el('p', `Paid on Base to GrindLedger ${short(GRIND_LEDGER)}. Funds go straight to the treasury Safe ${short(TREASURY_SAFE)}. In-game $ is a game balance, not a token you can withdraw.`, 'cc-muted')
  box.append(tabs, label, input, rate, table, go, status, fine)
  root.append(box)

  const amountMicro = (): { raw: bigint; usd: bigint } | null => {
    const v = input.value.trim()
    if (!/^\d*\.?\d+$/.test(v) || Number(v) <= 0) return null
    try {
      if (asset === 'USDC') { const raw = parseUnits(v, 6); return { raw, usd: raw } }
      const raw = parseEther(v); return price ? { raw, usd: ethToUsdMicro(raw, price) } : null
    } catch { return null }
  }
  const paint = () => {
    label.textContent = `Amount (${asset})`
    tUsdc.classList.toggle('on', asset === 'USDC'); tEth.classList.toggle('on', asset === 'ETH')
    rate.textContent = asset === 'USDC' ? 'Rate: 1 USDC = $1.00 in-game, minus the 2% fee.'
      : price ? `Rate: 1 ETH = $${(Number(price) / 1e8).toFixed(2)} in-game (live Chainlink ETH/USD on Base), minus the 2% fee.` : 'Loading live ETH price…'
    const a = amountMicro()
    table.replaceChildren()
    const row = (k: string, v: string, cls = '') => { table.append(el('dt', k, cls), el('dd', v, cls)) }
    if (!a) { row('You pay', '—'); go.disabled = true; return }
    const b = breakdown(a.usd)
    row('You pay', `${input.value.trim()} ${asset}${asset === 'ETH' ? ` (≈ ${usd(a.usd)})` : ''}`)
    row('2% fee to treasury', usd(b.fee))
    row('You receive (in-game)', usd(b.credit), 'topup-get')
    go.disabled = false
  }
  tUsdc.onclick = () => { asset = 'USDC'; input.value = '10'; paint() }
  tEth.onclick = () => { asset = 'ETH'; input.value = '0.005'; paint() }
  input.oninput = paint
  ethPrice().then((p) => { price = p; paint() }).catch(() => { rate.textContent = 'ETH price unavailable; use USDC.' })
  paint()
  if (opts.demo) { go.textContent = 'Confirm top-up'; status.textContent = 'Wallet 0x14b6…4ef8 on Base'; return }

  const connect = async () => {
    const p = eth()
    if (!p) { status.textContent = 'No wallet found. Open this page in a wallet browser (Coinbase Wallet, MetaMask, Rabby).'; return }
    const [a] = (await p.request({ method: 'eth_requestAccounts' })) as Address[]
    account = a
    const chain = Number(await p.request({ method: 'eth_chainId' }))
    if (chain !== BASE_CHAIN_ID) {
      try { await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] }) } catch { status.textContent = 'Switch your wallet to Base to continue.'; return }
    }
    status.textContent = `Wallet ${short(a)} on Base`
    go.textContent = 'Confirm top-up'
    try { localStorage.setItem(WALLET_KEY, a) } catch { /* private mode */ }
    void syncTopups(a, onCredited)
  }
  const pay = async () => {
    const a = amountMicro(); const p = eth()
    if (!a || !p || !account) return
    if (Number(await p.request({ method: 'eth_chainId' })) !== BASE_CHAIN_ID) { status.textContent = 'Switch your wallet to Base.'; return }
    const wallet = createWalletClient({ account, chain: base, transport: custom(p) })
    const ref = `0x${[...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
    let hash: `0x${string}`
    if (asset === 'USDC') {
      const allowance = await pub.readContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'allowance', args: [account, GRIND_LEDGER] })
      if (allowance < a.raw) {
        status.textContent = 'Step 1 of 2: approve USDC in your wallet…'
        const ap = await wallet.writeContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'approve', args: [GRIND_LEDGER, a.raw] })
        await pub.waitForTransactionReceipt({ hash: ap })
      }
      status.textContent = 'Confirm the top-up in your wallet…'
      hash = await wallet.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'topUpUSDC', args: [a.raw, ref] })
    } else {
      status.textContent = 'Confirm the top-up in your wallet…'
      hash = await wallet.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'topUp', args: [ref], value: a.raw })
    }
    status.textContent = 'Paid. Waiting for Base to confirm…'
    await pub.waitForTransactionReceipt({ hash, confirmations: 2 })
    for (let i = 0; i < 10; i += 1) {
      status.textContent = 'Crediting your in-game balance…'
      const r = await fetch('/api/topup-confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hash }) })
      const j = (await r.json()) as { ok?: boolean; creditUsd?: number; asset?: string; error?: string }
      if (j.ok && j.creditUsd) { applyTopup(hash, j.creditUsd, j.asset ?? asset); onCredited(); status.textContent = `Credited $${j.creditUsd.toFixed(2)} in-game.`; return }
      if (r.status !== 409 && r.status !== 502) { status.textContent = `Not credited: ${j.error ?? r.status}. Tx ${short(hash)}`; return }
      await new Promise((ok) => setTimeout(ok, 3000))
    }
    status.textContent = `Still confirming. Your payment is safe (tx ${short(hash)}); reopen Balance later.`
  }
  go.onclick = () => {
    go.disabled = true
    ;(account ? pay() : connect()).catch((e: Error) => { status.textContent = (e as { shortMessage?: string }).shortMessage ?? e.message ?? 'Cancelled' }).finally(() => { go.disabled = false })
  }
}
