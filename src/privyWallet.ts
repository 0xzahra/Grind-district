// Privy embedded EVM wallet (works on Base) for Google / X / email players, created automatically after
// sign-in when the account has none ("users-without-wallets"). The key material lives in Privy's hidden secure iframe;
// the game only keeps the public address (localStorage, not the save) to show it in the wallet panel.
// Nothing here sends funds or touches top-up or payments. NEAR sign-in never calls this.
export const GAME_WALLET_KEY = 'gd.privy.wallet'
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a)
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function gameWalletAddress(): string {
  try { const a = localStorage.getItem(GAME_WALLET_KEY) ?? ''; return isAddr(a) ? a : '' } catch { return '' }
}

type PrivyLike = {
  setMessagePoster(p: Window): void
  embeddedWallet: { getURL(): string; onMessage(e: unknown): void; create(o: object): Promise<{ user: unknown }> }
  user: { get(): Promise<{ user: unknown }> }
}
const bridges = new WeakMap<object, Promise<void>>()
/** Mount Privy's secure context once per client and wire up messages (Privy vanilla JS SDK recipe). */
function mountBridge(privy: PrivyLike): Promise<void> {
  const had = bridges.get(privy)
  if (had) return had
  const bridge = new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.src = privy.embeddedWallet.getURL()
    iframe.style.display = 'none'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.dataset.gdPrivyWallet = '1'
    const t = window.setTimeout(() => reject(new Error('wallet iframe timed out')), 15_000)
    iframe.onload = () => { window.clearTimeout(t); resolve() }
    document.body.append(iframe)
    privy.setMessagePoster(iframe.contentWindow!)
    window.addEventListener('message', (e) => {
      if (e.source !== iframe.contentWindow) return
      try { privy.embeddedWallet.onMessage(typeof e.data === 'string' ? JSON.parse(e.data) : e.data) } catch { /* not a Privy message */ }
    })
  }).catch((e) => { bridges.delete(privy); throw e })
  bridges.set(privy, bridge)
  return bridge
}

const keep = (key: string, a: string) => { try { localStorage.setItem(key, a) } catch { /* private mode */ } }

/**
 * Find or create the player's embedded EVM wallet (one owner: the player; works on Base).
 * NEAR stays on NEAR connect. Quiet: never throws, never blocks sign-in.
 */
export async function ensureEmbeddedWallet(privy: PrivyLike): Promise<string> {
  try {
    const mod = await import('@privy-io/js-sdk-core')
    const evmOf = (u: unknown) => (u ? (mod.getUserEmbeddedEthereumWallet(u as Parameters<typeof mod.getUserEmbeddedEthereumWallet>[0])?.address ?? '') : '')
    let addr = evmOf((await privy.user.get()).user)
    if (!addr) {
      await mountBridge(privy).catch((e) => console.warn('Privy wallet iframe:', (e as Error).message))
      const created = await Promise.race([privy.embeddedWallet.create({}), new Promise<never>((_, r) => setTimeout(() => r(new Error('wallet create timed out')), 25_000))])
      addr = evmOf(created.user) || evmOf((await privy.user.get()).user)
    }
    if (isAddr(addr)) { keep(GAME_WALLET_KEY, addr); window.dispatchEvent(new Event('gd:game-wallet')) }
    return addr
  } catch (e) {
    console.warn('Base wallet not created:', (e as Error).message)
    return ''
  }
}

/** Small read-only lines for the wallet panel: short Base address and a copy button. */
export function gameWalletChip(): HTMLElement[] {
  const rows: HTMLElement[] = []
  const line = (chain: string, a: string) => {
    const row = document.createElement('div'); row.className = 'gw-chip'
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;opacity:.85'
    const label = document.createElement('small'); label.textContent = `Your ${chain} wallet`
    const code = document.createElement('code'); code.textContent = short(a); code.title = a
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'gw-copy'; copy.textContent = 'Copy'
    copy.style.cssText = 'padding:3px 10px;font-size:12px;min-height:0;border-radius:999px'
    copy.setAttribute('aria-label', `Copy ${chain} wallet address`)
    copy.onclick = (ev) => { ev.stopPropagation(); void navigator.clipboard?.writeText(a).then(() => { copy.textContent = 'Copied' }, () => { copy.textContent = 'Copy failed' }); window.setTimeout(() => { copy.textContent = 'Copy' }, 1600) }
    row.append(label, code, copy); rows.push(row)
  }
  const evm = gameWalletAddress(); if (evm) line('Base', evm)
  return rows
}

// ---- Paying from the game wallet (Base) ----------------------------------------------------------
// Used by Top up to send the exact USDC amount to the treasury; the server's existing detection
// credits it (it matches the USDC Transfer from this address, so bundler-sent sponsored txs work too).
// Gas: sponsored by Privy only when VITE_GAS_SPONSOR=1 (off until Zahra enables Fee sponsorship in the
// Privy dashboard). Otherwise, or if sponsorship is refused (cap reached), the wallet pays its own gas.
export const GAS_SPONSOR = import.meta.env.VITE_GAS_SPONSOR === '1'
const BASE_RPC = 'https://mainnet.base.org'
const BASE_CAIP2 = 'eip155:8453'
const APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> }
type WalletPrivy = PrivyLike & {
  initialize?(): Promise<void>
  embeddedWallet: PrivyLike['embeddedWallet'] & {
    getEthereumProvider(o: object): Promise<Eip1193>
    signWithUserSigner(o: { message: string }): Promise<{ signature: string }>
  }
}
let walletPrivy: Promise<{ mod: typeof import('@privy-io/js-sdk-core'); p: WalletPrivy }> | null = null
function walletClient() {
  if (!APP_ID) return Promise.reject(new Error('Game wallet is not set up on this build.'))
  walletPrivy ??= (async () => {
    const mod = await import('@privy-io/js-sdk-core')
    const p = new mod.default({ appId: APP_ID, storage: new mod.LocalStorage() }) as unknown as WalletPrivy
    await p.initialize?.()
    await mountBridge(p)
    return { mod, p }
  })().catch((e) => { walletPrivy = null; throw e })
  return walletPrivy
}

async function baseRpc<T = string>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(BASE_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = (await r.json()) as { result?: T; error?: { message: string } }
  if (j.error || j.result === undefined) throw new Error(j.error?.message ?? 'Base RPC error')
  return j.result
}
const pad32 = (hex: string) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0')
export const usdcTransferData = (to: string, amount: bigint) => '0xa9059cbb' + pad32(to) + amount.toString(16).padStart(64, '0')

/** The game wallet did not send anything (shown as-is in the Top up status line; stop watching the order). */
export class WalletNotSent extends Error {}
/** Not enough USDC, or no ETH for gas while sponsorship is off or used up. */
export class WalletNeedsFunds extends WalletNotSent {}

/** Before opening an order: does the game wallet hold at least `amount` USDC on Base? Throws WalletNeedsFunds if not. */
export async function checkGameWalletUsdc(usdc: string, amount: bigint): Promise<void> {
  const from = gameWalletAddress()
  if (!from) throw new WalletNotSent('No game wallet yet. Sign in with Google, X or email to create it.')
  const bal = BigInt(await baseRpc('eth_call', [{ to: usdc, data: '0x70a08231' + pad32(from) }, 'latest']))
  if (bal < amount) throw new WalletNeedsFunds(`Your game wallet has ${(Number(bal) / 1e6).toFixed(2)} USDC on Base. Send at least ${(Number(amount) / 1e6).toFixed(2)} USDC on Base to ${from} first, then tap again.`)
}

/**
 * Send `amount` (6-decimal USDC units) of Base USDC from the player's game wallet to `to`.
 * Returns the tx hash when known; a sponsored send may only return once Privy has a hash (or '' if
 * still pending), in which case the caller keeps polling the order. Never sends anything else.
 */
export async function payUsdcFromGameWallet(usdc: string, to: string, amount: bigint): Promise<{ hash: string; sponsored: boolean; from: string }> {
  try { return await payUsdcInner(usdc, to, amount) } catch (e) {
    if (e instanceof WalletNotSent) throw e
    throw new WalletNotSent(`Game wallet could not send: ${((e as Error).message || 'unknown error').replace(/\.$/, '')}. Nothing was charged.`)
  }
}
async function payUsdcInner(usdc: string, to: string, amount: bigint): Promise<{ hash: string; sponsored: boolean; from: string }> {
  const { mod, p } = await walletClient()
  const user = (await p.user.get()).user as Parameters<typeof mod.getUserEmbeddedEthereumWallet>[0]
  const wallet = mod.getUserEmbeddedEthereumWallet(user)
  if (!wallet || !isAddr(wallet.address)) throw new Error('No game wallet yet. Sign in again with Google, X or email to create it.')
  const from = wallet.address
  const data = usdcTransferData(to, amount)
  const bal = BigInt(await baseRpc('eth_call', [{ to: usdc, data: '0x70a08231' + pad32(from) }, 'latest']))
  if (bal < amount) {
    throw new WalletNeedsFunds(`Your game wallet has ${(Number(bal) / 1e6).toFixed(2)} USDC on Base. Send at least ${(Number(amount) / 1e6).toFixed(2)} USDC on Base to ${from} first, then tap again.`)
  }
  const walletId = (wallet as { id?: string | null }).id
  if (GAS_SPONSOR && walletId) {
    try {
      const sign = (i: { message: string }) => p.embeddedWallet.signWithUserSigner({ message: i.message })
      const res = await mod.rpc(p as unknown as Parameters<typeof mod.rpc>[0], sign, {
        wallet_id: walletId, method: 'eth_sendTransaction', caip2: BASE_CAIP2, sponsor: true,
        params: { transaction: { to: usdc, data: data as `0x${string}`, chain_id: 8453 } },
      } as Parameters<typeof mod.rpc>[2])
      const hash = ((res as { data?: { hash?: string } }).data?.hash ?? '').toLowerCase()
      return { hash: /^0x[0-9a-f]{64}$/.test(hash) ? hash : '', sponsored: true, from }
    } catch (e) {
      // Not enabled, chain not configured, or the sponsorship cap ran out: fall back to paying own gas.
      console.warn('Sponsored send refused, paying own gas:', (e as Error).message)
    }
  }
  const gas = BigInt(await baseRpc('eth_estimateGas', [{ from, to: usdc, data }]))
  const price = BigInt(await baseRpc('eth_gasPrice', []))
  const need = gas * price * 2n
  const eth = BigInt(await baseRpc('eth_getBalance', [from, 'latest']))
  if (eth < need) {
    throw new WalletNeedsFunds(`Your game wallet needs a little ETH on Base for gas (under $0.05). Send a small amount of ETH on Base to ${from}, then tap again.`)
  }
  const provider = await p.embeddedWallet.getEthereumProvider({ wallet, ...mod.getEntropyDetailsFromUser(user) })
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] }) } catch { /* already on Base or not needed */ }
  const hash = String(await provider.request({ method: 'eth_sendTransaction', params: [{ from, to: usdc, data, chainId: '0x2105' }] })).toLowerCase()
  return { hash, sponsored: false, from }
}

/**
 * Send one contract call (no value) from the player's game wallet on Base (8453) or Base Sepolia (84532).
 * Used by the certificate NFT mint. The player pays their own gas (sponsorship is later). Never sends value.
 */
export async function callFromGameWallet(to: string, data: `0x${string}`, chainId = 8453): Promise<{ hash: string; from: string }> {
  try {
    const { mod, p } = await walletClient()
    const user = (await p.user.get()).user as Parameters<typeof mod.getUserEmbeddedEthereumWallet>[0]
    const wallet = mod.getUserEmbeddedEthereumWallet(user)
    if (!wallet || !isAddr(wallet.address)) throw new WalletNotSent('No game wallet yet. Sign in with Google, X or email to create it.')
    const from = wallet.address
    const rpcUrl = chainId === 84532 ? 'https://sepolia.base.org' : BASE_RPC
    const call = async <T = string>(method: string, params: unknown[]): Promise<T> => {
      const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
      const j = (await r.json()) as { result?: T; error?: { message: string } }
      if (j.error || j.result === undefined) throw new Error(j.error?.message ?? 'Base RPC error')
      return j.result
    }
    const gas = BigInt(await call('eth_estimateGas', [{ from, to, data }]))
    const price = BigInt(await call('eth_gasPrice', []))
    const eth = BigInt(await call('eth_getBalance', [from, 'latest']))
    if (eth < gas * price * 2n) throw new WalletNeedsFunds(`Your game wallet needs a little ETH on Base for gas (usually under $0.05). Send a small amount of ETH on Base to ${from}, then tap again.`)
    const hex = '0x' + chainId.toString(16)
    const provider = await p.embeddedWallet.getEthereumProvider({ wallet, ...mod.getEntropyDetailsFromUser(user) })
    try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }) } catch { /* already there */ }
    const hash = String(await provider.request({ method: 'eth_sendTransaction', params: [{ from, to, data, chainId: hex }] })).toLowerCase()
    return { hash, from }
  } catch (e) {
    if (e instanceof WalletNotSent) throw e
    throw new WalletNotSent(`Game wallet could not send: ${((e as Error).message || 'unknown error').replace(/\.$/, '')}. Nothing was minted.`)
  }
}
