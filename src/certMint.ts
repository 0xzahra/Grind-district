// "Mint as NFT" for a certificate: the player picks an EVM chain (Base, Arbitrum, OP Mainnet, Robinhood Chain,
// Polygon, BNB Chain: one game wallet address on all of them), NEAR, or Solana devnet. Lazy-loaded by the
// certificate dialog. On EVM and NEAR a soulbound practice certificate goes to the player's own wallet and the
// player pays the network fee. On Solana the game writes a grind-cert account (a record, not a token NFT); the
// server is the issuer and pays the devnet fee, and the same record is written automatically after a passed exam
// when CERT_SOLANA_AUTO=1. Hidden behind env: with no contract configured the dialog says so honestly.
import { encodeAbiParameters, encodeFunctionData, keccak256, decodeFunctionResult } from 'viem'
import { getSave } from './state.ts'
import { gameWalletAddress } from './privyWallet.ts'
import { adoptCertId } from './certs.ts'
import { track } from './track.ts'
import type { SkillId } from './logic.ts'
import { takeExam, heldTicket } from './certExam.ts'
import { withBuilderCode } from './builderCode.ts'
import { EVM_CERT_ORDER, evmCertChain, evmNftUrl, evmTxUrl, type EvmCertChain, type EvmCertChainKey } from './chains/router.ts'
import { CHAIN_LOGOS } from './chains/certLogos.ts'
import './certMint.css'

const BASE_NFT = String(import.meta.env.VITE_CERT_NFT_BASE ?? '')
const NEAR_NFT = String(import.meta.env.VITE_CERT_NFT_NEAR ?? '')
/** Grind District on NEAR Hunt, the NEAR hackathon's community board (upvotes need a NEAR mainnet account). */
const HUNT = 'https://nearhunt.xyz/p/c1c7b574-850a-4f47-9af9-22a49339df07'
export const baseMintOn = () => /^0x[0-9a-fA-F]{40}$/.test(BASE_NFT)
export const nearMintOn = () => /^[a-z0-9._-]{2,64}$/.test(NEAR_NFT)
const SOL_PROGRAM = String(import.meta.env.VITE_CERT_SOLANA_PROGRAM ?? '').trim()
/** Live grind-cert program is on Solana devnet (6NJLLRRTkvEwijjSo62HHJF4trQowqJJLWDXxPdMB1Hd). */
export const solanaMintOn = () => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(SOL_PROGRAM)
const SOL_EXPLORER = 'https://explorer.solana.com'
const solanaTxUrl = (sig: string) => `${SOL_EXPLORER}/tx/${sig}?cluster=devnet`
const NEAR_NET: 'testnet' | 'mainnet' = NEAR_NFT.endsWith('.testnet') ? 'testnet' : 'mainnet'
/** Every EVM chain with a contract configured (Base keeps its Sepolia switch). Order = the order of the chain keys. */
type EvmLive = EvmCertChain & { contract: `0x${string}` }
const EVM: EvmLive[] = EVM_CERT_ORDER.map((k) => evmCertChain(k, import.meta.env as Record<string, string | undefined>)).filter((c): c is EvmLive => !!c)
export const evmMintOn = () => EVM.length > 0
const NEAR_RPC = NEAR_NET === 'testnet' ? 'https://rpc.testnet.near.org' : 'https://rpc.mainnet.near.org'
const NEARBLOCKS = NEAR_NET === 'testnet' ? 'https://testnet.nearblocks.io' : 'https://nearblocks.io'
const NEAR_STORAGE_YOCTO = '50000000000000000000000' // 0.05 NEAR attached for storage; unused part refunded

const VOUCHER_TUPLE = {
  type: 'tuple', name: 'v', components: [
    { name: 'to', type: 'address' }, { name: 'courseId', type: 'string' }, { name: 'courseTitle', type: 'string' },
    { name: 'playerName', type: 'string' }, { name: 'username', type: 'string' }, { name: 'rank', type: 'string' },
    { name: 'issuedAt', type: 'uint64' }, { name: 'issuedWat', type: 'string' }, { name: 'serial', type: 'string' },
    { name: 'certId', type: 'string' }, { name: 'deadline', type: 'uint64' },
  ],
} as const
const ABI = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [VOUCHER_TUPLE, { name: 'signature', type: 'bytes' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokenOfKey', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
] as const

type ChainKey = EvmCertChainKey | 'near' | 'solana'
type Minted = { chain: ChainKey; tokenId: string; explorer: string; tx?: string }
const MINT_KEY = 'gd.certs.mints'
const mints = (): Record<string, Partial<Record<ChainKey, Minted>>> => { try { return JSON.parse(localStorage.getItem(MINT_KEY) || '{}') } catch { return {} } }
const remember = (course: string, m: Minted) => { try { const all = mints(); all[course] = { ...all[course], [m.chain]: m }; localStorage.setItem(MINT_KEY, JSON.stringify(all)) } catch { /* private mode */ } }

async function evmTokenOf(ch: EvmLive, username: string, course: string): Promise<bigint> {
  const key = keccak256(encodeAbiParameters([{ type: 'string' }, { type: 'string' }], [username, course]))
  const data = encodeFunctionData({ abi: ABI, functionName: 'tokenOfKey', args: [key] })
  const r = await fetch(ch.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: ch.contract, data }, 'latest'] }) })
  const j = (await r.json()) as { result?: `0x${string}` }
  if (!j.result) throw new Error(`${ch.label} RPC error`)
  return decodeFunctionResult({ abi: ABI, functionName: 'tokenOfKey', data: j.result }) as bigint
}

async function nearView<T>(method: string, args: object): Promise<T> {
  const r = await fetch(NEAR_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: NEAR_NFT, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) })
  const j = await r.json()
  if (j.error || !j.result?.result) throw new Error('NEAR RPC error')
  return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result))) as T
}
type NearToken = { token_id: string; owner_id: string; certificate: Record<string, string | number> } | null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nearConn: Promise<any> | null = null
const nearConnector = () => (nearConn ??= import('@hot-labs/near-connect').then(({ NearConnector }) => new NearConnector({ network: NEAR_NET, features: { signAndSendTransaction: true } })))

async function authHeaders(): Promise<{ headers: Record<string, string>; near?: unknown } | null> {
  const { accessToken, syncProgress } = await import('./login.ts')
  const token = await accessToken()
  if (token) { await syncProgress(token).catch(() => false); return { headers: { authorization: `Bearer ${token}` } } }
  const proof = (await import('./state.ts')).heldNearProof()
  if (proof) return { headers: {}, near: proof }
  return null
}

/** The server's record of this certificate (issued on first ask from the synced save): its id and printed serial. */
export async function serverCert(course: SkillId, hintId: string): Promise<{ certId: string; serial: string } | { error: string; exam?: boolean }> {
  const auth = await authHeaders()
  if (!auth) return { error: 'Sign in to your Grind District account to get a share link' }
  const r = await fetch('/api/profile?op=cert-issue', { method: 'POST', headers: { 'content-type': 'application/json', ...auth.headers }, body: JSON.stringify({ course, certId: hintId, ...(auth.near ? { near: auth.near } : {}) }) }).catch(() => null)
  const j = (await r?.json().catch(() => ({}))) as Record<string, unknown> | undefined
  if (!r?.ok || typeof j?.certId !== 'string') return { error: String(j?.error ?? 'Could not reach Grind District'), ...(j?.exam === true ? { exam: true } : {}) }
  // Auto-record on Solana (CERT_SOLANA_AUTO=1) lands in this same response: remember it so the picker can tick it.
  const sol = j.solana as { tokenId?: string; explorer?: string; tx?: string } | undefined
  if (sol && typeof sol.explorer === 'string' && typeof sol.tokenId === 'string') {
    remember(course, { chain: 'solana', tokenId: sol.tokenId, explorer: sol.explorer, ...(typeof sol.tx === 'string' ? { tx: sol.tx } : {}) })
  }
  return { certId: j.certId, serial: String(j.serial ?? '') }
}
/** The short server-graded exam for this course (a pass is recorded on the server). true = passed. */
export async function certExam(course: SkillId): Promise<boolean> {
  return !!(await takeExam(course, examPost))
}

/** The server-graded certificate exam's two calls (api/_certExam.ts), signed in like every other profile call. */
const examPost = async (op: 'cert-exam' | 'cert-grade', body: Record<string, unknown>) => {
  const auth = await authHeaders()
  if (!auth) return { ok: false, j: { error: 'Sign in to your Grind District account first (Menu > Account), then try again.' } as Record<string, unknown> }
  const r = await fetch(`/api/profile?op=${op}`, { method: 'POST', headers: { 'content-type': 'application/json', ...auth.headers }, body: JSON.stringify({ ...body, ...(auth.near ? { near: auth.near } : {}) }) }).catch(() => null)
  const j = ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
  return { ok: !!r?.ok, j }
}

async function voucher(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const auth = await authHeaders()
  if (!auth) throw new Error('Sign in to your Grind District account first (Menu > Account), then try again.')
  const ticket = heldTicket(String(body.course) as SkillId)
  const r = await fetch('/api/profile?op=cert-voucher', { method: 'POST', headers: { 'content-type': 'application/json', ...auth.headers }, body: JSON.stringify({ ...body, ...(ticket ? { ticket } : {}), ...(auth.near ? { near: auth.near } : {}) }) })
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) throw new Error(String(j.error ?? 'Could not prepare the mint') + (r.status === 401 && auth.near ? '. Sign in with NEAR again (sign-in proofs last 10 minutes).' : '.'))
  return j
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n
}
const linkTo = (href: string, text: string) => { const a = el('a', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a }

/** The server looks this up: the Solana address is derived with the issuer key, so the browser cannot do it alone. */
async function solanaLookup(course: string): Promise<Minted | null> {
  const auth = await authHeaders()
  if (!auth) return null
  const r = await fetch('/api/profile?op=cert-minted', { method: 'POST', headers: { 'content-type': 'application/json', ...auth.headers }, body: JSON.stringify({ course, ...(auth.near ? { near: auth.near } : {}) }) }).catch(() => null)
  const j = (await r?.json().catch(() => ({}))) as { minted?: { tokenId?: string; explorer?: string; tx?: string } }
  const m = j?.minted
  if (!r?.ok || !m || typeof m.explorer !== 'string' || typeof m.tokenId !== 'string') return null
  return { chain: 'solana', tokenId: m.tokenId, explorer: m.explorer, ...(typeof m.tx === 'string' ? { tx: m.tx } : {}) }
}

export function renderMint(root: HTMLElement, course: SkillId, certId: string): void {
  root.replaceChildren()
  if (!evmMintOn() && !nearMintOn() && !solanaMintOn()) return
  root.removeAttribute('style')
  root.classList.add('gd-mint')
  const head = el('div', '', 'gm-head')
  const title = el('p', 'Mint as NFT', 'gm-title')
  const seal = el('span', 'Soulbound · no money value', 'gm-seal')
  head.append(title, seal)
  const note = el('p', 'A short exam first, graded on the server. Then this certificate is written to the chain you pick. On Base, the other EVM chains and NEAR it goes into your own wallet and stays there: it cannot be sold or moved. On Solana devnet the game records it for you, with no wallet needed.', 'gm-note')
  const more = el('details', '', 'gm-more')
  const sum = el('summary', 'Fees and what goes on-chain')
  more.append(sum, el('p', 'You pay the network fee yourself on Base, Arbitrum, OP Mainnet, Robinhood Chain (ETH), Polygon (POL), BNB Chain (BNB), or 0.05 NEAR attached for storage on NEAR, unused part refunded. On those chains your name, @username, course and issue time become public on-chain. On Solana devnet the game writes a certificate record (not a token NFT) and pays the test-network fee: no wallet and no fee from you, and no name on-chain. One certificate per course on each chain.'))
  const pick = el('div', '', 'gm-picks'); pick.setAttribute('role', 'radiogroup'); pick.setAttribute('aria-label', 'Chain')
  const status = el('p', '', 'gm-status'); status.setAttribute('role', 'status')
  const act = el('div', '', 'gm-act')
  const panel = el('div', '', 'gm-panel'); panel.append(status, act)
  root.append(head, note, more, pick, panel)
  // NEAR first: it is the chain the core loop and the README walk through; the EVM chains stay one tap away.
  let chain: ChainKey = nearMintOn() ? 'near' : EVM[0]!.key
  const evmOf = (k: ChainKey) => EVM.find((c) => c.key === k) ?? null
  const labelOf = (k: ChainKey) => (k === 'near' ? (NEAR_NET === 'testnet' ? 'NEAR testnet' : 'NEAR') : k === 'solana' ? 'Solana devnet' : evmOf(k)?.label ?? k)
  const logo = (k: ChainKey, cls = 'gm-logo') => { const i = el('span', '', cls); i.innerHTML = CHAIN_LOGOS[k] ?? ''; return i }
  const keys: HTMLButtonElement[] = []
  const chip = (k: ChainKey, sub: string, color: string) => {
    const b = el('button', '', 'gm-key'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.chain = k
    b.style.setProperty('--chain', color)
    const txt = el('span', '', 'gm-key-txt'); txt.append(el('b', labelOf(k).replace(/^Robinhood Chain$/, 'Robinhood')), el('small', sub))
    const tick = el('span', '✓', 'gm-tick'); tick.setAttribute('aria-hidden', 'true')
    b.append(logo(k), txt, tick)
    b.onclick = () => { chain = k; mark(); void show() }
    keys.push(b); return b
  }
  const mark = () => {
    const done = mints()[course] ?? {}
    for (const b of keys) { const k = b.dataset.chain as ChainKey; b.setAttribute('aria-checked', String(k === chain)); b.classList.toggle('minted', !!done[k]) }
  }
  if (EVM.length) {
    pick.append(el('p', 'Game wallet · one address on every chain', 'gm-group'))
    const grid = el('div', '', 'gm-grid')
    for (const c of EVM) grid.append(chip(c.key, `Gas in ${c.native}`, c.color))
    pick.append(grid)
  }
  if (nearMintOn()) {
    pick.append(el('p', 'NEAR wallet', 'gm-group'))
    const grid = el('div', '', 'gm-grid')
    grid.append(chip('near', NEAR_NET === 'testnet' ? 'Free test network' : '0.05 NEAR storage', '#00ec97'))
    pick.append(grid)
  }
  if (solanaMintOn()) {
    pick.append(el('p', 'Solana · recorded by the game', 'gm-group'))
    const grid = el('div', '', 'gm-grid')
    grid.append(chip('solana', 'No wallet or fee needed', '#9945ff'))
    pick.append(grid)
  }
  mark()
  const set = (msg: string, ...nodes: HTMLElement[]) => { panel.className = 'gm-panel'; status.textContent = msg; act.replaceChildren(...nodes) }
  const btn = (label: string, fn: () => void) => { const b = el('button', label, 'primary'); b.onclick = fn; return b }
  const keyLink = (href: string, text: string) => { const a = linkTo(href, text); a.className = 'gm-link'; return a }
  const showMinted = (m: Minted) => {
    mark()
    const ev = m.chain === 'near' || m.chain === 'solana' ? null : evmOf(m.chain)
    const explorerName = m.chain === 'solana' ? 'Solana Explorer' : ev ? ev.explorerName : 'NEARBlocks'
    const txHref = m.tx ? (m.chain === 'solana' ? solanaTxUrl(m.tx) : ev ? evmTxUrl(ev, m.tx) : `${NEARBLOCKS}/txns/${m.tx}`) : ''
    const card = el('div', '', 'gm-done')
    const badge = el('div', '', 'gm-done-badge'); badge.append(logo(m.chain, 'gm-done-logo'), el('span', '✓', 'gm-done-check'))
    const words = el('div', '', 'gm-done-words')
    const title = m.chain === 'solana' ? `Recorded on ${labelOf(m.chain)}` : `Minted on ${labelOf(m.chain)}`
    const sub = m.chain === 'solana'
      ? `Record #${m.tokenId} · soulbound certificate account · no token NFT, no money value`
      : `Token #${m.tokenId} · soulbound to your wallet · every field stored on-chain`
    words.append(el('p', title, 'gm-done-title'), el('p', sub, 'gm-done-sub'))
    card.append(badge, words)
    const links = el('div', '', 'gm-links')
    links.append(keyLink(m.explorer, `View on ${explorerName}`))
    if (txHref) links.append(keyLink(txHref, 'Transaction'))
    links.append(keyLink(`/cert/${certId}`, 'Public certificate page'))
    panel.className = 'gm-panel ok'
    status.textContent = ''
    act.replaceChildren(card, links, linkTo(HUNT, 'Enjoyed it? Upvote Grind District on NEAR Hunt'))
  }
  // Not enough gas on this chain: say which token, on which chain, to which address; nothing was sent.
  const showGas = (ch: EvmLive, addr: string) => {
    const box = el('div', '', 'gm-gas')
    box.append(logo(ch.key), el('p', `Your game wallet needs a little ${ch.native} on ${ch.label} for the network fee, usually a few cents. Nothing was sent.`))
    const row = el('div', '', 'gm-addr')
    const code = el('code', `${addr.slice(0, 8)}…${addr.slice(-6)}`)
    const copy = el('button', 'Copy address', 'gm-link'); copy.type = 'button'
    copy.onclick = () => { void navigator.clipboard?.writeText(addr).then(() => { copy.textContent = 'Copied' }).catch(() => { copy.textContent = addr }) }
    row.append(code, copy)
    panel.className = 'gm-panel warn'
    status.textContent = `Add ${ch.native} on ${ch.label}, then mint`
    act.replaceChildren(box, row, btn(`I added ${ch.native}, mint on ${ch.label}`, () => void mintEvm(ch, addr)), el('p', 'Or pick another chain above.', 'gm-hint'))
  }
  const username = getSave().username

  // Each tap starts a fresh read; a slower answer for a chain the player already left is dropped.
  let seq = 0
  const show = async () => {
    const my = ++seq
    const live = () => my === seq
    const saved = mints()[course]?.[chain]
    if (saved) return showMinted(saved)
    set('Checking the chain…')
    try {
      const ev = chain === 'near' || chain === 'solana' ? null : evmOf(chain)
      if (ev) {
        const id = await evmTokenOf(ev, username, course)
        if (!live()) return
        if (id > 0n) { const m = { chain: ev.key, tokenId: id.toString(), explorer: evmNftUrl(ev, ev.contract, id) } as Minted; remember(course, m); return showMinted(m) }
        const addr = gameWalletAddress()
        if (!addr) return set(`${ev.label} minting uses your game wallet. Sign in with Google, X or email to create it, then come back.`)
        return set(`Not minted yet. Mints to your game wallet ${addr.slice(0, 6)}…${addr.slice(-4)} on ${ev.label}.`, btn(`Mint on ${ev.label}`, () => void mintEvm(ev, addr)))
      }
      if (chain === 'solana') {
        const m = await solanaLookup(course)
        if (!live()) return
        if (m) { remember(course, m); return showMinted(m) }
        const auth = await authHeaders()
        if (!live()) return
        if (!auth) return set('Sign in to your Grind District account to see or record this certificate on Solana devnet.')
        return set('Not recorded yet. The game writes a Solana devnet record for you — no wallet or fee needed.', btn('Record on Solana devnet', () => void mintSolana()))
      }
      const t = await nearView<NearToken>('cert_for', { username, course_id: course })
      if (!live()) return
      if (t) { const m = { chain: 'near', tokenId: t.token_id, explorer: `${NEARBLOCKS}/nft-token/${NEAR_NFT}/${t.token_id}` } as Minted; remember(course, m); return showMinted(m) }
      return set('Not minted yet. Connect your NEAR wallet to mint.', btn('Connect NEAR wallet and mint', () => void mintNear()))
    } catch {
      if (!live()) return
      set('Could not reach the chain. Nothing was changed.', btn('Retry', () => void show()))
    }
  }

  // Every mint starts with the short exam, graded on the server; a pass in the last 25 minutes is reused.
  const examFirst = async (again: () => void): Promise<boolean> => {
    set('Certificate exam: a few questions from this course, graded on the server…')
    const ticket = await takeExam(course, examPost)
    if (!ticket) { set('Minting needs a pass on the short certificate exam (graded on the server, not on this device). Take it when you are ready.', btn('Take the exam', again)); return false }
    return true
  }

  // The picker holds still while a mint is in flight, so its progress never lands under another chain's key.
  const lock = (on: boolean) => { for (const b of keys) b.disabled = on; pick.classList.toggle('busy', on) }
  const mintEvm = async (ch: EvmLive, addr: string) => {
    lock(true)
    try { await mintEvmRun(ch, addr) } finally { lock(false) }
  }
  const mintEvmRun = async (ch: EvmLive, addr: string) => {
    if (!(await examFirst(() => void mintEvm(ch, addr)))) return
    set('Preparing your certificate…')
    try {
      const j = await voucher({ chain: ch.key, course, certId, to: addr })
      if (j.already) { const a = j.already as { tokenId: string; explorer: string }; const m = { chain: ch.key, tokenId: a.tokenId, explorer: a.explorer } as Minted; remember(course, m); return showMinted(m) }
      if (typeof j.certId === 'string') adoptCertId(course, j.certId)
      const v = j.voucher as Record<string, string>
      const call = encodeFunctionData({ abi: ABI, functionName: 'mint', args: [{ to: v.to as `0x${string}`, courseId: v.courseId, courseTitle: v.courseTitle, playerName: v.playerName, username: v.username, rank: v.rank, issuedAt: BigInt(v.issuedAt), issuedWat: v.issuedWat, serial: v.serial, certId: v.certId, deadline: BigInt(v.deadline) }, j.signature as `0x${string}`] })
      const data = ch.key === 'base' ? withBuilderCode(call) : call // Base Builder Code on the end (Base only)
      set('Confirm in your game wallet…')
      const { callFromGameWallet, WalletNeedsFunds } = await import('./privyWallet.ts')
      let hash: string
      try {
        ;({ hash } = await callFromGameWallet(String(j.contract), data, Number(j.chainId) || ch.chainId, ch.key === 'base' ? undefined : { rpc: ch.rpc, label: ch.label, native: ch.native }))
      } catch (e) {
        if (e instanceof WalletNeedsFunds) return showGas(ch, addr)
        throw e
      }
      track('cert_minted', { course, chain: ch.key })
      set(`Submitted. Waiting for ${ch.label} to confirm…`, keyLink(evmTxUrl(ch, hash), 'View transaction'))
      for (let i = 0; i < 20; i += 1) {
        await new Promise((r) => setTimeout(r, 3000))
        const id = await evmTokenOf(ch, username, course).catch(() => 0n)
        if (id > 0n) { const m = { chain: ch.key, tokenId: id.toString(), explorer: evmNftUrl(ch, ch.contract, id), tx: hash } as Minted; remember(course, m); return showMinted(m) }
      }
      set('Still confirming. Check the transaction; this panel shows the token once it lands.', keyLink(evmTxUrl(ch, hash), 'View transaction'), btn('Check again', () => void show()))
    } catch (e) {
      set(`Not minted: ${(e as Error).message}`, btn('Try again', () => void show()))
    }
  }

  const mintSolana = async () => {
    lock(true)
    try {
      if (!(await examFirst(() => void mintSolana()))) return
      set('Recording your certificate on Solana devnet…')
      const j = await voucher({ chain: 'solana', course, certId })
      const rec = (j.already ?? j.minted) as { tokenId?: string; explorer?: string; tx?: string } | undefined
      if (typeof j.certId === 'string') adoptCertId(course, j.certId)
      if (!rec || typeof rec.explorer !== 'string' || typeof rec.tokenId !== 'string') throw new Error('Solana did not return a record. Nothing was changed.')
      const m: Minted = { chain: 'solana', tokenId: rec.tokenId, explorer: rec.explorer, ...(typeof rec.tx === 'string' ? { tx: rec.tx } : {}) }
      remember(course, m)
      track('cert_minted', { course, chain: 'solana' })
      return showMinted(m)
    } catch (e) {
      set(`Not recorded: ${(e as Error).message}`, btn('Try again', () => void show()))
    } finally { lock(false) }
  }

  const mintNear = async () => {
    if (!(await examFirst(() => void mintNear()))) return
    set('Opening NEAR wallets…')
    try {
      const conn = await nearConnector()
      let w = await conn.wallet().catch(() => null)
      let account = w ? (await w.getAccounts())[0]?.accountId : ''
      if (!account) { w = await conn.connect(); account = (await w.getAccounts())[0]?.accountId }
      if (!account) throw new Error('No NEAR account connected')
      set('Preparing your certificate…')
      let j: Record<string, unknown>
      try {
        j = await voucher({ chain: 'near', course, certId, receiver: account })
      } catch (e) {
        // The NEAR game session lives in memory, so after a reload (or once it expires) it is gone.
        // The wallet is connected right here: sign a fresh Grind District login message with it and try once more.
        const sign = (w as unknown as { signMessage?: (p: { message: string; recipient: string; nonce: Uint8Array }) => Promise<{ accountId?: string; publicKey: string; signature: string }> } | null)?.signMessage
        if (!sign || !/sign in|10 minutes|401/i.test((e as Error).message)) throw e
        set('Confirm a sign-in message in your NEAR wallet (no funds, no transaction)…')
        const { takeNearChallenge, nearSessionFromProof } = await import('./login.ts')
        const { nonce, nonceB64 } = await takeNearChallenge()
        const message = `Grind District login\n${Date.now()}\n${nonceB64}`
        const signed = await sign.call(w, { message, recipient: 'grinddistrict.vercel.app', nonce })
        ;(await import('./state.ts')).holdNearProof(await nearSessionFromProof({ accountId: signed.accountId || account, publicKey: signed.publicKey, signature: signed.signature, message, recipient: 'grinddistrict.vercel.app', nonce: nonceB64 }))
        set('Preparing your certificate…')
        j = await voucher({ chain: 'near', course, certId, receiver: account })
      }
      if (j.already) { const a = j.already as { tokenId: string; explorer: string }; const m = { chain: 'near', tokenId: a.tokenId, explorer: a.explorer } as Minted; remember(course, m); return showMinted(m) }
      if (typeof j.certId === 'string') adoptCertId(course, j.certId)
      set('Approve in your NEAR wallet…')
      const out = await w.signAndSendTransaction({ receiverId: NEAR_NFT, actions: [{ type: 'FunctionCall', params: { methodName: 'nft_mint', args: { voucher: j.voucher, signature: j.signature }, gas: '100000000000000', deposit: NEAR_STORAGE_YOCTO } }] })
      const failed = out?.status && typeof out.status === 'object' && 'Failure' in out.status
      if (failed) return set('The contract refused the mint. Nothing was minted.', btn('Try again', () => void show()))
      track('cert_minted', { course, chain: 'near' })
      const t = await nearView<NearToken>('cert_for', { username, course_id: course }).catch(() => null)
      if (t) { const m = { chain: 'near', tokenId: t.token_id, explorer: `${NEARBLOCKS}/nft-token/${NEAR_NFT}/${t.token_id}`, tx: out?.transaction?.hash } as Minted; remember(course, m); return showMinted(m) }
      set('Submitted. NEAR is confirming.', btn('Check again', () => void show()))
    } catch (e) {
      set(`Not minted: ${(e as Error).message || 'the wallet request was rejected'}`, btn('Try again', () => void show()))
    }
  }
  void show()
}
