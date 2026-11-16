// The NEAR wallet a player signed in with, shown in Balance next to the game balance: the account name and its real
// NEAR balance, read from the public NEAR RPC (mainnet for .near and implicit accounts, testnet for .testnet).
// Read-only: no keys, no signing, nothing is sent from here. Players who signed in another way see nothing.
const KEY = 'gd.near.account'

export const nearSignInAccount = (): string => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
const isTestnet = (a: string) => a.endsWith('.testnet')
const short = (a: string) => (a.length > 24 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a)

/** NEAR balance of an account in NEAR (2 decimals), or null if it cannot be read. */
export async function nearBalance(account: string): Promise<number | null> {
  const rpc = isTestnet(account) ? 'https://rpc.testnet.near.org' : 'https://rpc.mainnet.near.org'
  try {
    const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: account } }) })
    const j = (await r.json()) as { result?: { amount?: string } }
    const yocto = j.result?.amount
    if (!yocto) return null
    return Number(BigInt(yocto) / 10n ** 20n) / 10_000
  } catch { return null }
}

/** A line for the Balance sheet: "Your NEAR wallet · account · 12.34 NEAR · Copy · View", or null. */
export function nearWalletChip(): HTMLElement | null {
  const a = nearSignInAccount()
  if (!a) return null
  const row = document.createElement('div'); row.className = 'gw-chip near-chip'
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;opacity:.9;flex-wrap:wrap'
  const label = document.createElement('small'); label.textContent = `Your NEAR wallet${isTestnet(a) ? ' (testnet)' : ''}`
  const code = document.createElement('code'); code.textContent = short(a); code.title = a
  const bal = document.createElement('b'); bal.textContent = '… NEAR'; bal.style.cssText = 'font-weight:700'
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'gw-copy'; copy.textContent = 'Copy'
  copy.style.cssText = 'padding:3px 10px;font-size:12px;min-height:0;border-radius:999px'
  copy.setAttribute('aria-label', 'Copy NEAR account')
  copy.onclick = (ev) => { ev.stopPropagation(); void navigator.clipboard?.writeText(a).then(() => { copy.textContent = 'Copied' }, () => { copy.textContent = 'Copy failed' }); window.setTimeout(() => { copy.textContent = 'Copy' }, 1600) }
  const view = document.createElement('a'); view.textContent = 'View'; view.target = '_blank'; view.rel = 'noopener noreferrer'
  view.href = `https://${isTestnet(a) ? 'testnet.' : ''}nearblocks.io/address/${encodeURIComponent(a)}`
  view.style.cssText = 'font-size:12px;color:#06c763;font-weight:600'
  row.append(label, code, bal, copy, view)
  void nearBalance(a).then((n) => { bal.textContent = n == null ? 'balance unavailable' : `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} NEAR` })
  return row
}
