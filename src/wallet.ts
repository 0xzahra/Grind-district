// Optional real wallet on Base (8453). Injected EIP-1193 only; the city never holds keys.
// WalletConnect is not wired (needs a project ID). Lazy-loaded from Settings.
import qrcode from 'qrcode-generator'

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown>; on?(e: string, f: (...a: unknown[]) => void): void }
const RPC = 'https://mainnet.base.org'
const USDC = '0x833589fCD6eDb6E08f4c7f8d3feE58D57d2CF8b9'
const CHAIN = '0x2105'
let account = ''

const provider = (): Eip1193 | undefined => (window as unknown as { ethereum?: Eip1193 }).ethereum
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a)
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

async function rpc(method: string, params: unknown[]): Promise<string> {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = (await r.json()) as { result?: string; error?: { message: string } }
  if (j.error || !j.result) throw new Error(j.error?.message ?? 'RPC error')
  return j.result
}
const fmt = (v: bigint, dec: number, show = 6) => {
  const s = v.toString().padStart(dec + 1, '0')
  const whole = s.slice(0, -dec)
  const frac = s.slice(-dec).slice(0, show).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}
const parseUnits = (v: string, dec: number): bigint => {
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error('Enter a number')
  const [w, f = ''] = v.split('.')
  if (f.length > dec) throw new Error('Too many decimals')
  return BigInt(w + f.padEnd(dec, '0'))
}
const pad = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0')

async function balances(addr: string) {
  const eth = BigInt(await rpc('eth_getBalance', [addr, 'latest']))
  const usdc = BigInt(await rpc('eth_call', [{ to: USDC, data: '0x70a08231' + pad(addr) }, 'latest']))
  return { eth: fmt(eth, 18), usdc: fmt(usdc, 6, 2) }
}

async function ensureBase(p: Eip1193) {
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN }] })
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e
    await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN, chainName: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: ['https://basescan.org'] }] })
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (text) n.textContent = text
  if (cls) n.className = cls
  return n
}

export function openWallet(): void {
  document.getElementById('wallet-dlg')?.remove()
  const dlg = el('div', '', 'wallet-dlg')
  dlg.id = 'wallet-dlg'
  dlg.setAttribute('role', 'dialog')
  dlg.setAttribute('aria-label', 'Wallet on Base')
  const body = el('div', '', 'wallet-body')
  const closeBtn = el('button', 'Close', 'ghost')
  closeBtn.onclick = () => dlg.remove()
  dlg.append(el('h2', 'Wallet · Base'), body, closeBtn)
  document.body.append(dlg)
  const status = el('p', '', 'muted')

  const renderDisconnected = () => {
    body.replaceChildren(el('p', 'Connect your own wallet (MetaMask, Coinbase Wallet, Rabby). The city never sees your keys or seed phrase.', 'muted'), status)
    const p = provider()
    if (!p) {
      status.textContent = 'No browser wallet found. Open this page in your wallet app’s browser.'
      return
    }
    const b = el('button', 'Connect wallet', 'primary')
    b.onclick = async () => {
      try {
        const accs = (await p.request({ method: 'eth_requestAccounts' })) as string[]
        await ensureBase(p)
        account = accs[0] ?? ''
        void renderConnected()
      } catch (e) {
        status.textContent = `Not connected: ${(e as Error).message}`
      }
    }
    body.append(b)
  }

  const renderConnected = async () => {
    const p = provider()!
    const addrRow = el('p', short(account), 'wallet-addr')
    const copy = el('button', 'Copy', 'ghost')
    copy.onclick = () => void navigator.clipboard.writeText(account).then(() => { copy.textContent = 'Copied' })
    const scan = el('a', 'View on Basescan')
    scan.href = `https://basescan.org/address/${account}`
    scan.target = '_blank'
    scan.rel = 'noopener noreferrer'
    const bal = el('p', 'Loading balance…')
    balances(account).then((b) => { bal.textContent = `${b.eth} ETH  ·  ${b.usdc} USDC` }).catch(() => { bal.textContent = 'Balance unavailable right now' })

    const qr = qrcode(0, 'M')
    qr.addData(account)
    qr.make()
    const recv = el('div', '', 'wallet-qr')
    recv.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2 })
    recv.hidden = true
    const recvBtn = el('button', 'Receive', 'ghost')
    recvBtn.onclick = () => { recv.hidden = !recv.hidden }

    const form = el('form', '', 'wallet-send')
    const to = el('input'); to.placeholder = 'To address (0x…)'; to.autocomplete = 'off'
    const amt = el('input'); amt.placeholder = 'Amount'; amt.inputMode = 'decimal'
    const asset = el('select')
    for (const a of ['ETH', 'USDC']) asset.append(new Option(a, a))
    const go = el('button', 'Review send', 'primary'); go.type = 'submit'
    const msg = el('p', '', 'muted')
    let armed = ''
    form.append(to, amt, asset, go, msg)
    form.onsubmit = async (ev) => {
      ev.preventDefault()
      try {
        const dest = to.value.trim()
        if (!isAddr(dest)) throw new Error('That is not a valid address')
        const usdc = asset.value === 'USDC'
        const value = parseUnits(amt.value.trim(), usdc ? 6 : 18)
        if (value <= 0n) throw new Error('Amount must be above zero')
        const key = `${dest}|${value}|${asset.value}`
        if (armed !== key) {
          armed = key
          msg.textContent = `Send ${amt.value} ${asset.value} to ${short(dest)} on Base? Press Confirm, then approve in your wallet.`
          go.textContent = 'Confirm'
          return
        }
        armed = ''
        go.textContent = 'Review send'
        await ensureBase(p)
        const tx = usdc
          ? { from: account, to: USDC, data: '0xa9059cbb' + pad(dest) + value.toString(16).padStart(64, '0') }
          : { from: account, to: dest, value: '0x' + value.toString(16) }
        const hash = (await p.request({ method: 'eth_sendTransaction', params: [tx] })) as string
        msg.textContent = ''
        const link = el('a', `Sent. View ${short(hash)} on Basescan`)
        link.href = `https://basescan.org/tx/${hash}`
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        msg.append(link)
      } catch (e) {
        msg.textContent = (e as Error).message
      }
    }
    const disc = el('button', 'Disconnect', 'ghost')
    disc.onclick = async () => {
      account = ''
      try { await p.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }) } catch { /* not all wallets support it */ }
      renderDisconnected()
    }
    const row = el('div', '', 'tabs')
    row.append(copy, recvBtn, disc)
    body.replaceChildren(addrRow, bal, row, recv, scan, el('p', 'Send', 'kicker'), form, el('p', 'Grind is in-game currency and is not in this wallet.', 'muted'))
  }

  if (account) void renderConnected()
  else renderDisconnected()
}
