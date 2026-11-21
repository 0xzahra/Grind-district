// Optional top-up rails, HIDDEN unless VITE_TOPUP_RAILS lists them at build time (e.g. "solana,intents") or a tester
// sets localStorage gd.rails = "1". The server side answers 503 until its env var is set, so nothing can be paid
// until Zahra switches a rail on.
//  - Solana: pick SOL or USDC → Solana Pay QR / "Open in wallet" link → the server finds the payment by its
//    one-time reference key and credits once.
//  - Any chain (NEAR Intents): pick a coin + your refund address → send to the one-time deposit address → NEAR
//    Intents swaps to USDC for the Grind District NEAR account → credited when it reports SUCCESS.
// Same 2% fee; in-game $ only, not withdrawable.
import qrcode from 'qrcode-generator'
import { applyTopup } from './state.ts'
import { breakdown } from './grindConfig.ts'

export type Rail = 'solana' | 'intents'
const FLAGS = String(import.meta.env.VITE_TOPUP_RAILS ?? '').split(',').map((s) => s.trim())
const tester = () => { try { return localStorage.getItem('gd.rails') === '1' } catch { return false } }
export const railOn = (r: Rail) => FLAGS.includes(r) || tester()
const PAYERS_KEY = 'gd.topup.rails.payers'
const ORDER_KEY = (r: Rail) => `gd.topup.rails.order.${r}`
const PRESETS = [5, 10, 25, 50]
const usd = (micro: bigint) => `$${(Number(micro) / 1e6).toFixed(2)}`

type Cfg = { intents: null | { receiver: string; assets: Array<{ id: string; label: string; refund: string }> }; solana: null | { receiver: string; cluster: string }; min: number; max: number }
type Reply = { ok?: boolean; already?: boolean; waiting?: boolean; error?: string; stage?: string; orderId?: string; amountLabel?: string; depositAddress?: string; depositMemo?: string; payUrl?: string; receiver?: string; creditUsd?: number | null; hash?: string | null; timeEstimate?: number; status?: string }

const savedPayers = (): string[] => { try { const a = JSON.parse(localStorage.getItem(PAYERS_KEY) ?? '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(-5) : [] } catch { return [] } }
const savePayer = (a: string) => { try { localStorage.setItem(PAYERS_KEY, JSON.stringify([...savedPayers().filter((x) => x !== a), a].slice(-5))) } catch { /* private mode */ } }

async function api(init: { body?: unknown; query?: string }): Promise<{ status: number; j: Reply & Record<string, unknown> }> {
  let token: string | null = null
  try { token = await (await import('./login.ts')).accessToken() } catch { token = null }
  const headers: Record<string, string> = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'content-type': 'application/json' } : {}) }
  const r = await fetch(`/api/topup-confirm${init.query ?? ''}`, init.body ? { method: 'POST', headers, body: JSON.stringify(init.body) } : { headers })
  return { status: r.status, j: (await r.json().catch(() => ({}))) as Reply & Record<string, unknown> }
}

/** Credits made on another device (or while the game was closed) for the saved payer addresses. */
export async function syncRailTopups(onChange: () => void): Promise<void> {
  if (!railOn('solana') && !railOn('intents')) return
  let changed = false
  // A payment made after the panel was closed (or the game was left): check the open order once on load.
  for (const r of ['intents', 'solana'] as const) {
    if (!railOn(r)) continue
    let o: Reply | null = null
    try { o = JSON.parse(localStorage.getItem(ORDER_KEY(r)) ?? 'null') as Reply | null } catch { o = null }
    if (!o?.orderId) continue
    try {
      const { status, j } = await api({ body: { op: r === 'solana' ? 'sol-scan' : 'intents-scan', orderId: o.orderId } })
      if (j.ok && j.hash && j.creditUsd) changed = applyTopup(j.hash, j.creditUsd, r === 'solana' ? 'Solana' : 'NEAR Intents') || changed
      if ((j.ok && (j.creditUsd || j.already)) || status === 404 || status === 410 || (j.ok === false && !j.waiting && j.error)) { try { localStorage.removeItem(ORDER_KEY(r)) } catch { /* private mode */ } }
    } catch { /* offline: try again next load */ }
  }
  for (const p of savedPayers()) {
    try {
      const { status, j } = await api({ query: `?rails=${encodeURIComponent(p)}` })
      if (status !== 200) continue
      for (const t of (j.topups as Array<{ hash: string; credit: number; asset: string }>) ?? []) changed = applyTopup(t.hash, t.credit, t.asset) || changed
    } catch { /* offline */ }
  }
  if (changed) onChange()
}

let cfgP: Promise<Cfg | null> | null = null
const config = () => (cfgP ??= api({ query: '?rails=-config' }).then((r) => (r.status === 200 ? (r.j as unknown as Cfg) : null)).catch(() => null))

export function renderRailTopup(root: HTMLElement, rail: Rail, onCredited: () => void): { show(on: boolean): void } {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
  let dollars = 5
  let solAsset: 'SOL' | 'USDC' = 'USDC'
  let coin = ''
  let busy = false
  let waiting = false
  let timer: ReturnType<typeof setInterval> | null = null
  let cfg: Cfg | null = null
  const box = el('div', '', 'topup-rail')
  box.hidden = true
  const presets = el('div', '', 'topup-presets')
  const pick = el('div', '', 'topup-presets')
  const refund = el('input', '', 'topup-refund') as HTMLInputElement
  refund.autocomplete = 'off'; refund.spellcheck = false; refund.setAttribute('aria-label', 'Refund address')
  const table = el('dl', '', 'topup-break')
  const go = el('button', '', 'topup-go') as HTMLButtonElement
  go.type = 'button'
  const payBox = el('div', '', 'topup-railpay')
  const status = el('p', '', 'topup-status')
  const fine = el('p', rail === 'solana'
    ? 'Pay SOL or USDC on Solana from any Solana wallet (Phantom, Solflare, Backpack…). The game spots the payment by its one-time code. In-game $ is a game balance, not withdrawable.'
    : 'Pay from another chain. NEAR Intents swaps it to USDC for the Grind District NEAR account, then the game credits you. If anything goes wrong, NEAR Intents refunds to the address you enter. In-game $ is a game balance, not withdrawable.', 'cc-muted')
  box.append(el('label', 'Amount', 'topup-label'), presets, el('label', rail === 'solana' ? 'Pay with' : 'Coin', 'topup-label'), pick)
  if (rail === 'intents') box.append(refund)
  box.append(table, go, payBox, status, fine)
  root.append(box)
  const stop = () => { if (timer) { clearInterval(timer); timer = null } waiting = false }

  const assets = () => cfg?.intents?.assets ?? []
  const paint = () => {
    presets.replaceChildren()
    for (const n of PRESETS) { const b = el('button', `$${n}`, dollars === n ? 'on' : '') as HTMLButtonElement; b.type = 'button'; b.onclick = () => { dollars = n; paint() }; presets.append(b) }
    pick.replaceChildren()
    if (rail === 'solana') for (const a of ['USDC', 'SOL'] as const) { const b = el('button', a, solAsset === a ? 'on' : '') as HTMLButtonElement; b.type = 'button'; b.onclick = () => { solAsset = a; paint() }; pick.append(b) }
    else for (const a of assets()) { const b = el('button', a.label, coin === a.id ? 'on' : '') as HTMLButtonElement; b.type = 'button'; b.onclick = () => { coin = a.id; paint() }; pick.append(b) }
    const a = assets().find((x) => x.id === coin)
    refund.placeholder = a ? `Your ${a.label.split(' · ')[1]} address (refunds go here)` : 'Your address (refunds go here)'
    const b = breakdown(BigInt(dollars) * 1_000_000n)
    table.replaceChildren(el('dt', 'You pay'), el('dd', `$${dollars}.00 in ${rail === 'solana' ? solAsset : a?.label.split(' · ')[0] ?? 'crypto'}`), el('dt', '2% fee'), el('dd', usd(b.fee)), el('dt', 'You receive', 'topup-get'), el('dd', usd(b.credit), 'topup-get'))
    const live = rail === 'solana' ? !!cfg?.solana : !!cfg?.intents
    go.disabled = busy || !live || (rail === 'intents' && !coin)
    go.textContent = !live ? 'Not switched on yet' : waiting ? 'Waiting for payment…' : busy ? 'Working…' : rail === 'solana' ? 'Pay with Solana wallet' : 'Get deposit address'
  }

  const qr = (data: string) => { const q = qrcode(0, 'M'); q.addData(data); q.make(); const d = el('div', '', 'topup-qr'); d.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2 }); return d }
  const showPay = (o: Reply) => {
    payBox.replaceChildren()
    if (rail === 'solana' && o.payUrl) {
      const row = el('div', '', 'topup-addr'); const side = el('div')
      const open = el('a', 'Open in wallet', 'topup-go') as HTMLAnchorElement; open.href = o.payUrl; open.style.cssText = 'display:block;text-align:center;text-decoration:none;margin-bottom:6px'
      side.append(el('strong', `Send exactly ${o.amountLabel ?? ''}`), open, el('p', 'Or scan the code with your Solana wallet.', 'cc-muted'))
      row.append(qr(o.payUrl), side); payBox.append(row)
    } else if (o.depositAddress) {
      const row = el('div', '', 'topup-addr'); const side = el('div')
      const copy = el('button', 'Copy address', 'ghost') as HTMLButtonElement; copy.type = 'button'
      copy.onclick = () => { void navigator.clipboard?.writeText(String(o.depositAddress)).then(() => { copy.textContent = 'Copied' }) }
      side.append(el('strong', `Send exactly ${o.amountLabel ?? ''}`), el('div', String(o.depositAddress), 'topup-mono'), copy)
      if (o.depositMemo) side.append(el('div', `Memo (required): ${o.depositMemo}`, 'topup-mono'))
      row.append(qr(String(o.depositAddress)), side); payBox.append(row)
      payBox.append(el('p', `One-time address, valid for 30 minutes. Usually arrives in about ${Math.max(1, Math.round((o.timeEstimate ?? 60) / 60))} min after your payment confirms.`, 'cc-muted'))
    }
  }

  const credited = (j: Reply) => {
    stop()
    try { localStorage.removeItem(ORDER_KEY(rail)) } catch { /* private mode */ }
    if (j.hash && j.creditUsd) applyTopup(j.hash, j.creditUsd, rail === 'solana' ? 'Solana' : 'NEAR Intents')
    onCredited()
    payBox.replaceChildren()
    status.textContent = `Credited $${(j.creditUsd ?? 0).toFixed(2)} in-game.`
    busy = false; paint()
  }
  const watch = (orderId: string) => {
    stop(); waiting = true; paint()
    let n = 0
    const tick = async () => {
      if (++n > 300) { stop(); status.textContent = 'Still not seen. If you paid, reopen top-up later and it will be credited.'; return }
      try {
        const { status: code, j } = await api({ body: { op: rail === 'solana' ? 'sol-scan' : 'intents-scan', orderId } })
        if (j.ok && j.creditUsd) return credited(j)
        if (code === 410 || code === 404 || (j.ok === false && !j.waiting && j.error)) { stop(); busy = false; paint(); status.textContent = j.error || 'Order ended. Start again.'; try { localStorage.removeItem(ORDER_KEY(rail)) } catch { /* */ } return }
        status.textContent = j.stage === 'PROCESSING' || j.stage === 'KNOWN_DEPOSIT_TX' ? 'Payment seen. Swapping…' : 'Waiting for your payment…'
      } catch { status.textContent = 'Network hiccup; still watching…' }
    }
    timer = setInterval(() => { void tick() }, rail === 'solana' ? 4000 : 6000)
    void tick()
  }

  go.onclick = async () => {
    busy = true; paint(); status.textContent = ''
    try {
      let body: Record<string, unknown>
      if (rail === 'solana') body = { op: 'sol-create', asset: solAsset, dollars }
      else {
        const to = refund.value.trim()
        if (!to) throw new Error('Enter your address for refunds')
        body = { op: 'intents-create', asset: coin, dollars, refundTo: to }
      }
      const { status: code, j } = await api({ body })
      if (code !== 200 || !j.orderId) throw new Error(j.error || `Could not start (${code})`)
      if (rail === 'intents') savePayer(String(body.refundTo))
      try { localStorage.setItem(ORDER_KEY(rail), JSON.stringify(j)) } catch { /* private mode */ }
      showPay(j); watch(j.orderId)
    } catch (e) { busy = false; paint(); status.textContent = (e as Error).message }
  }

  let loaded = false
  const resume = () => {
    if (timer) return
    try { const o = JSON.parse(localStorage.getItem(ORDER_KEY(rail)) ?? 'null') as Reply | null; if (o?.orderId) { busy = true; showPay(o); watch(o.orderId) } } catch { /* none */ }
  }
  return {
    show(on: boolean) {
      box.hidden = !on
      if (!on) { stop(); paint(); return }
      if (loaded) { resume(); return }
      loaded = true
      paint()
      void config().then((c) => {
        cfg = c
        if (rail === 'solana' && c?.solana?.receiver) fine.textContent += ` Payments go to the Grind District Solana wallet ${c.solana.receiver.slice(0, 4)}…${c.solana.receiver.slice(-4)}.`
        if (rail === 'intents' && c?.intents?.receiver) fine.textContent = fine.textContent.replace('the Grind District NEAR account', `the Grind District NEAR account (${c.intents.receiver})`)
        if (rail === 'intents' && !coin) coin = c?.intents?.assets[0]?.id ?? ''
        paint()
        if (!box.hidden) resume()
      })
    },
  }
}
