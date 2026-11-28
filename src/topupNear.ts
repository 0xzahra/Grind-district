// NEAR top-up panel. Shown only when VITE_NEAR_TOPUP_ACCOUNT is set at build time. The network follows that
// account: a .testnet account means NEAR testnet (free test NEAR, for testing the game). The player connects a NEAR wallet, sends NEAR to the Grind District account, and the server
// checks the payment on NEAR before crediting in-game $ (2% fee, same as Base). Nothing is withdrawable.
import { applyTopup } from './state.ts'
import { breakdown } from './grindConfig.ts'
import { step, coinChip, howItWorks, hint, watchStatus } from './topupUi.ts'

export const NEAR_TOPUP_ACCOUNT: string = (import.meta.env.VITE_NEAR_TOPUP_ACCOUNT as string | undefined)?.trim() ?? ''
export const nearTopupOn = () => /^[a-z0-9._-]{2,64}$/.test(NEAR_TOPUP_ACCOUNT)
export const NEAR_TOPUP_NET: 'testnet' | 'mainnet' = NEAR_TOPUP_ACCOUNT.endsWith('.testnet') ? 'testnet' : 'mainnet'
const ACCOUNT_KEY = 'gd.topup.near'
const isAccount = (a: string) => /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a) && a.length >= 2 && a.length <= 64
const savedAccount = () => { try { const s = localStorage.getItem(ACCOUNT_KEY) ?? ''; return isAccount(s) ? s : '' } catch { return '' } }
const PRESETS = [1, 5, 10, 25]
const usd = (micro: bigint) => `$${(Number(micro) / 1e6).toFixed(2)}`

/** Same maths as the server: yocto * price(8 dp) / 1e26 = micro-dollars. */
export const nearUsdMicro = (near: number, price8: bigint) => (BigInt(Math.round(near * 100)) * 10n ** 22n * price8) / 10n ** 26n

// Own storage prefix so this top-up wallet never touches the NEAR sign-in's saved wallet.
const prefixed = {
  get: async (k: string) => { try { return localStorage.getItem(`gd.neartopup.${k}`) } catch { return null } },
  set: async (k: string, v: string) => { try { localStorage.setItem(`gd.neartopup.${k}`, v) } catch { /* private mode */ } },
  remove: async (k: string) => { try { localStorage.removeItem(`gd.neartopup.${k}`) } catch { /* private mode */ } },
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let conn: Promise<any> | null = null
const connector = () => (conn ??= import('@hot-labs/near-connect').then(({ NearConnector }) => new NearConnector({ network: NEAR_TOPUP_NET, storage: prefixed, features: { signAndSendTransaction: true } } as never)))

async function api(path: string, init?: RequestInit): Promise<Response> {
  let token: string | null = null
  try { token = await (await import('./login.ts')).accessToken() } catch { token = null }
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined), ...(token ? { authorization: `Bearer ${token}` } : {}) }
  if (init?.body) headers['content-type'] = 'application/json'
  return fetch(path, { ...init, headers })
}

export async function syncNearTopups(onChange: () => void): Promise<void> {
  const a = nearTopupOn() ? savedAccount() : ''
  if (!a) return
  try {
    const r = await fetch(`/api/topup-confirm?near=${encodeURIComponent(a)}`)
    if (!r.ok) return
    const { topups } = (await r.json()) as { topups: Array<{ hash: string; credit: number; asset: string }> }
    let changed = false
    for (const t of topups) changed = applyTopup(t.hash, t.credit, 'NEAR') || changed
    if (changed) onChange()
  } catch { /* offline */ }
}

type Reply = { ok?: boolean; already?: boolean; creditUsd?: number; txHash?: string; error?: string; waiting?: boolean; orderId?: string; amountLabel?: string; receiver?: string; amountYocto?: string }

export function renderNearTopup(root: HTMLElement, onCredited: () => void, opts: { demo?: boolean } = {}): { show(on: boolean): void } {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  let near = 5
  let price = 0n
  let busy = false
  let timer: ReturnType<typeof setInterval> | null = null
  const box = el('div', '', 'topup-near')
  const presets = el('div', '', 'topup-presets')
  const table = el('dl', '', 'topup-break')
  const pay = el('button', 'Pay with NEAR wallet', 'topup-go') as HTMLButtonElement
  pay.type = 'button'
  const status = el('p', '', 'topup-status')
  const fine = el('p', `Sends NEAR on NEAR ${NEAR_TOPUP_NET} to ${NEAR_TOPUP_ACCOUNT}, the Grind District account.${NEAR_TOPUP_NET === 'testnet' ? ' Testnet NEAR is free test money with no value: this top-up is for trying the game.' : ''} You pay the tiny NEAR network fee. In-game $ is a game balance, not withdrawable.`, 'cc-muted')
  watchStatus(status)
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite')
  const nearCoin = el('div', '', 'tp-coins'); nearCoin.append(coinChip('NEAR', NEAR_TOPUP_NET === 'testnet' ? 'Test coin' : 'NEAR coin', true))
  box.append(step('Pick a coin'), nearCoin, step('How much?', 'Pick an amount.'), presets, table, step('Pay'), pay, hint(NEAR_TOPUP_NET === 'testnet' ? 'Test NEAR is free play money with no real value. Approve in your NEAR wallet and we credit you.' : 'Approve in your NEAR wallet. We credit you the moment it lands.'), status, howItWorks(fine))
  root.append(box)
  const stop = () => { if (timer) { clearInterval(timer); timer = null } }

  const paint = () => {
    presets.replaceChildren()
    for (const n of PRESETS) {
      const b = el('button', `${n} NEAR`, near === n ? 'on' : '') as HTMLButtonElement
      b.type = 'button'
      b.onclick = () => { near = n; paint() }
      presets.append(b)
    }
    table.replaceChildren()
    if (price) {
      const ex = nearUsdMicro(near, price)
      const b = breakdown(ex)
      table.append(el('dt', `${near} NEAR`), el('dd', `≈ ${usd(ex)}`), el('dt', '2% fee'), el('dd', usd(b.fee)), el('dt', 'You receive', 'topup-get'), el('dd', `≈ ${usd(b.credit)}`, 'topup-get'))
    } else table.append(el('dt', 'NEAR price'), el('dd', 'Loading…'))
    pay.disabled = busy || !!opts.demo
    pay.textContent = busy ? 'Working…' : 'Pay with NEAR wallet'
  }

  const credited = (j: Reply) => {
    stop()
    if (j.txHash && j.creditUsd) applyTopup(j.txHash, j.creditUsd, 'NEAR')
    onCredited()
    status.textContent = `Credited $${(j.creditUsd ?? 0).toFixed(2)} in-game.`
    busy = false
    paint()
  }

  const watch = (orderId: string) => {
    stop()
    let n = 0
    const tick = async () => {
      n += 1
      if (n > 200) { stop(); status.textContent = 'Still not seen. If you sent it, reopen top-up later and it will be credited.'; return }
      try {
        const r = await api('/api/topup-confirm', { method: 'POST', body: JSON.stringify({ op: 'near-scan', orderId }) })
        const j = (await r.json().catch(() => ({}))) as Reply
        if (j.ok && j.creditUsd) return credited(j)
        if (r.status === 410) { stop(); status.textContent = j.error || 'Order expired. Start again.' }
        else if (j.error && r.status >= 400) status.textContent = `Not credited yet: ${j.error}`
        else status.textContent = 'Waiting for your NEAR payment…'
      } catch { status.textContent = 'Network hiccup; still watching for your payment…' }
    }
    timer = setInterval(() => { void tick() }, 4000)
    void tick()
  }

  const payNow = async () => {
    busy = true
    paint()
    let orderId = ''
    try {
      status.textContent = 'Connecting your NEAR wallet…'
      const c = await connector()
      let w = await c.wallet().catch(() => null)
      let account: string = w ? (await w.getAccounts())[0]?.accountId ?? '' : ''
      if (!account) { w = await c.connect(); account = (await w.getAccounts())[0]?.accountId ?? '' }
      if (!isAccount(account)) throw new Error(`No NEAR ${NEAR_TOPUP_NET} account connected`)
      try { localStorage.setItem(ACCOUNT_KEY, account) } catch { /* private mode */ }
      const cr = await api('/api/topup-confirm', { method: 'POST', body: JSON.stringify({ op: 'near-create', sender: account, near }) })
      const order = (await cr.json().catch(() => ({}))) as Reply
      if (!cr.ok || !order.orderId || !order.amountYocto || order.receiver !== NEAR_TOPUP_ACCOUNT) throw new Error(order.error || `Could not start top-up (${cr.status})`)
      orderId = order.orderId
      status.textContent = `Approve ${order.amountLabel} in your NEAR wallet…`
      const out = await w.signAndSendTransaction({ receiverId: order.receiver, actions: [{ type: 'Transfer', params: { deposit: order.amountYocto } }] })
      const hash = String(out?.transaction?.hash ?? '')
      if (out?.status && typeof out.status === 'object' && 'Failure' in out.status) throw new Error('The transfer failed on NEAR. Nothing was sent.')
      status.textContent = 'Payment sent… checking it on NEAR…'
      if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash)) {
        for (let i = 0; i < 6; i += 1) {
          const r = await api('/api/topup-confirm', { method: 'POST', body: JSON.stringify({ op: 'near-confirm', orderId, hash }) })
          const j = (await r.json().catch(() => ({}))) as Reply
          if (j.ok && j.creditUsd) return credited(j)
          if (![409, 502, 503].includes(r.status)) { if (j.error) status.textContent = `Checking: ${j.error}`; break }
          await new Promise((ok) => setTimeout(ok, 3000))
        }
      }
      watch(orderId)
    } catch (e) {
      status.textContent = (e as Error).message || 'Top-up cancelled'
      if (orderId && /fail|reject|cancel/i.test(status.textContent) === false) watch(orderId)
    } finally {
      busy = false
      paint()
    }
  }

  pay.onclick = () => { if (!opts.demo && !busy) void payNow() }
  fetch('/api/topup-confirm?near=-price').then((r) => r.json()).then((j: { price8?: string }) => { if (j.price8) { price = BigInt(j.price8); paint() } }).catch(() => { /* price shows Loading */ })
  paint()
  const obs = new MutationObserver(() => { if (!root.contains(box)) { stop(); obs.disconnect() } })
  obs.observe(root, { childList: true, subtree: true })
  return { show(on: boolean) { box.hidden = !on } }
}
