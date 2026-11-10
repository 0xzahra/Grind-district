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
