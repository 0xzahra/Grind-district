// Watch a wallet: paste a PUBLIC address (a Base/Ethereum 0x address or a NEAR account) and see what it holds,
// read straight from the chain. Read-only: nothing can be signed or moved from here, and the game never asks for a
// seed phrase or a private key. If someone pastes one by mistake, it is refused and wiped from the box at once.
// Up to three watched addresses are kept on this device only.

const KEY = 'gd.watch.v1'
const BASE_RPC = 'https://mainnet.base.org'
const NEAR_RPC = 'https://rpc.mainnet.near.org'
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

type Watched = { addr: string; kind: 'evm' | 'near'; label?: string }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const load = (): Watched[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Watched[]; return Array.isArray(v) ? v.slice(0, 3) : [] } catch { return [] } }
const save = (l: Watched[]) => { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 3))) } catch { /* private mode */ } }

/** What was pasted: a public address we can read, or a secret that must never be used. */
export function classify(raw: string): { kind: 'evm' | 'near'; addr: string } | { secret: true } | null {
  const s = raw.trim()
  if (!s) return null
  const words = s.split(/\s+/)
  // 12 or 24 plain words is a recovery phrase; 64 hex characters (with or without 0x) is a private key.
  if (words.length >= 12 && words.every((w) => /^[a-z]+$/i.test(w))) return { secret: true }
  if (/^(0x)?[0-9a-f]{64}$/i.test(s)) return { secret: true }
  if (/^ed25519:/i.test(s) || /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(s)) return { secret: true }
  if (/^0x[0-9a-f]{40}$/i.test(s)) return { kind: 'evm', addr: s.toLowerCase() }
  if (/^([a-z0-9_-]+\.)*[a-z0-9_-]+\.(near|tg)$/i.test(s)) return { kind: 'near', addr: s.toLowerCase() }
  return null
}

async function rpc(url: string, body: unknown): Promise<unknown> {
  const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 9000)
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
    const j = await r.json() as { result?: unknown; error?: unknown }
    if (j.error) throw new Error('rpc')
    return j.result
  } finally { window.clearTimeout(t) }
}
const fromUnits = (hex: string, decimals: number): number => { const v = BigInt(hex || '0x0'); const d = 10n ** BigInt(decimals); return Number(v / d) + Number(v % d) / Number(d) }
const fmt = (n: number, dp = 4) => n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 2 : dp })

async function read(w: Watched): Promise<string[]> {
  if (w.kind === 'evm') {
    const [eth, usdc] = await Promise.all([
      rpc(BASE_RPC, { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [w.addr, 'latest'] }),
      rpc(BASE_RPC, { jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: USDC_BASE, data: `0x70a08231000000000000000000000000${w.addr.slice(2)}` }, 'latest'] }),
    ])
    return [`${fmt(fromUnits(String(eth), 18))} ETH on Base`, `${fmt(fromUnits(String(usdc), 6), 2)} USDC on Base`]
  }
  const acct = await rpc(NEAR_RPC, { jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: w.addr } }) as { amount?: string }
  const yocto = BigInt(acct?.amount ?? '0'), one = 10n ** 24n
  return [`${fmt(Number(yocto / one) + Number(yocto % one) / 1e24)} NEAR`]
}

/** The Balance sheet's card: watched wallets, each read live from the chain, and a box to add one. */
export function renderWatch(box: HTMLElement): void {
  box.className = 'watch-card'
  const paint = () => {
    const list = load()
    box.replaceChildren(el('h3', 'Watch a wallet'), el('p', 'Paste a public address (0x… on Base, or name.near) to see what it holds. Read-only: nothing can be moved from here.', 'cc-muted'))
    const warn = el('p', 'Never paste a seed phrase or a private key, here or anywhere. Grind District will never ask for them.', 'watch-warn')
    for (const w of list) {
      const row = el('div', '', 'watch-row')
      const top = el('div', '', 'watch-top')
      const short = w.addr.length > 22 ? `${w.addr.slice(0, 8)}…${w.addr.slice(-6)}` : w.addr
      top.append(el('b', short), el('small', w.kind === 'evm' ? 'Base' : 'NEAR'))
      const vals = el('div', 'Reading the chain…', 'watch-vals')
      const acts = el('div', '', 'watch-acts')
      const view = el('a', 'Explorer ↗'); view.href = w.kind === 'evm' ? `https://basescan.org/address/${w.addr}` : `https://nearblocks.io/address/${w.addr}`; view.target = '_blank'; view.rel = 'noopener'
      const rm = el('button', 'Remove', 'watch-rm'); rm.type = 'button'; rm.onclick = () => { save(load().filter((x) => x.addr !== w.addr)); paint() }
      acts.append(view, rm)
      row.append(top, vals, acts)
      box.append(row)
      void read(w).then((lines) => { vals.replaceChildren(...lines.map((l) => el('span', l))) }).catch(() => { vals.textContent = 'Could not read this address just now.' })
    }
    if (list.length < 3) {
      const form = el('form', '', 'watch-form')
      const input = el('input'); input.type = 'text'; input.placeholder = '0x… or name.near'; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-label', 'Public wallet address')
      const go = el('button', 'Watch', 'watch-go'); go.type = 'submit'
      const msg = el('p', '', 'watch-msg')
      form.append(input, go)
      form.onsubmit = (e) => {
        e.preventDefault()
        const c = classify(input.value)
        if (c && 'secret' in c) { input.value = ''; msg.textContent = 'That looks like a seed phrase or a private key. It was not saved or sent anywhere. Keep it secret, and paste only a public address.'; msg.classList.add('bad'); return }
        if (!c) { msg.textContent = 'That is not a public address. Try 0x followed by 40 characters, or an account ending in .near.'; msg.classList.add('bad'); return }
        if (load().some((x) => x.addr === c.addr)) { msg.textContent = 'Already watching that one.'; return }
        save([...load(), { kind: c.kind, addr: c.addr }]); paint()
      }
      box.append(form, msg)
    }
    box.append(warn)
  }
  paint()
}
