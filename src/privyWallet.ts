// Privy embedded wallets for Google / X / email players: an EVM wallet (Base) and a NEAR wallet, each
// created automatically after sign-in when the account has none ("users-without-wallets"). The key material lives in Privy's hidden secure iframe;
// the game only keeps the public address (localStorage, not the save) to show it in the wallet panel.
// Nothing here sends funds or touches top-up or payments. NEAR sign-in never calls this.
export const GAME_WALLET_KEY = 'gd.privy.wallet'
export const GAME_NEAR_KEY = 'gd.privy.near'
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
let bridge: Promise<void> | null = null
/** Mount Privy's secure context once and wire up messages (Privy vanilla JS SDK recipe). */
function mountBridge(privy: PrivyLike): Promise<void> {
  if (bridge) return bridge
  bridge = new Promise<void>((resolve, reject) => {
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
  }).catch((e) => { bridge = null; throw e })
  return bridge
}

type Linked = { type?: string; chain_type?: string; chainType?: string; address?: string }
const nearOf = (u: unknown) => {
  const list = ((u as { linked_accounts?: Linked[]; linkedAccounts?: Linked[] } | null)?.linked_accounts ?? (u as { linkedAccounts?: Linked[] } | null)?.linkedAccounts ?? [])
  return list.find((a) => a.type === 'wallet' && (a.chain_type ?? a.chainType) === 'near')?.address ?? ''
}
const isNear = (a: string) => /^[0-9a-f]{64}$/.test(a) || /^[a-z0-9._-]{2,64}$/.test(a)
const keep = (key: string, a: string) => { try { localStorage.setItem(key, a) } catch { /* private mode */ } }

/**
 * Find or create the player's embedded wallets: one EVM wallet (works on Base) and one NEAR wallet
 * (Privy "extended chain", implicit account). Single owner each (the player), no multisig.
 * Quiet: never throws, never blocks sign-in.
 */
export async function ensureEmbeddedWallet(privy: PrivyLike): Promise<{ evm: string; near: string }> {
  const out = { evm: '', near: '' }
  try {
    const mod = await import('@privy-io/js-sdk-core')
    const evmOf = (u: unknown) => (u ? (mod.getUserEmbeddedEthereumWallet(u as Parameters<typeof mod.getUserEmbeddedEthereumWallet>[0])?.address ?? '') : '')
    const timeout = <T>(p: Promise<T>, ms: number, what: string) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error(`${what} timed out`)), ms))])
    let user = (await privy.user.get()).user
    out.evm = evmOf(user); out.near = nearOf(user)
    if (!out.evm || !out.near) await mountBridge(privy).catch((e) => console.warn('Privy wallet iframe:', (e as Error).message))
    if (!out.evm) {
      try {
        const created = await timeout(privy.embeddedWallet.create({}), 25_000, 'EVM wallet create')
        user = created.user ?? (await privy.user.get()).user
        out.evm = evmOf(user)
      } catch (e) { console.warn('Base wallet not created:', (e as Error).message) }
    }
    if (!out.near) {
      try {
        // Same call Privy's SDK uses for its own TEE wallets, with chain_type 'near' (extended chain).
        const w = await timeout(mod.create(privy as unknown as Parameters<typeof mod.create>[0], { request: { chain_type: 'near' } }), 25_000, 'NEAR wallet create')
        out.near = (w as { address?: string }).address ?? nearOf((await privy.user.get()).user)
      } catch (e) { console.warn('NEAR wallet not created:', (e as Error).message) }
    }
    if (isAddr(out.evm)) keep(GAME_WALLET_KEY, out.evm)
    if (out.near && isNear(out.near)) keep(GAME_NEAR_KEY, out.near)
    window.dispatchEvent(new Event('gd:game-wallet'))
  } catch (e) {
    console.warn('Game wallet not created:', (e as Error).message)
  }
  return out
}

export function gameNearAddress(): string {
  try { const a = localStorage.getItem(GAME_NEAR_KEY) ?? ''; return a && isNear(a) ? a : '' } catch { return '' }
}

/** Small read-only lines for the wallet panel: short address and a copy button for each chain. */
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
  const near = gameNearAddress(); if (near) line('NEAR', near)
  return rows
}
