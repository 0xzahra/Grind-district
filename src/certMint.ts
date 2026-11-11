// "Mint as NFT" for a certificate: the player picks Base or NEAR. Lazy-loaded by the certificate dialog.
// A soulbound practice certificate goes to the player's own wallet; the player pays the network fee
// (gas sponsorship comes later). The game server signs a voucher only for a passed course on the
// player's own account. Hidden behind env: with no contract configured the dialog says so honestly.
import { encodeAbiParameters, encodeFunctionData, keccak256, decodeFunctionResult } from 'viem'
import { getSave } from './state.ts'
import { gameWalletAddress } from './privyWallet.ts'
import { adoptCertId } from './certs.ts'
import { track } from './track.ts'
import type { SkillId } from './logic.ts'

const BASE_NFT = String(import.meta.env.VITE_CERT_NFT_BASE ?? '')
const BASE_CHAIN = Number(import.meta.env.VITE_CERT_NFT_BASE_CHAIN || 8453)
const NEAR_NFT = String(import.meta.env.VITE_CERT_NFT_NEAR ?? '')
export const baseMintOn = () => /^0x[0-9a-fA-F]{40}$/.test(BASE_NFT)
export const nearMintOn = () => /^[a-z0-9._-]{2,64}$/.test(NEAR_NFT)
const NEAR_NET: 'testnet' | 'mainnet' = NEAR_NFT.endsWith('.testnet') ? 'testnet' : 'mainnet'
const BASE_RPC = BASE_CHAIN === 84532 ? 'https://sepolia.base.org' : 'https://mainnet.base.org'
const BASESCAN = BASE_CHAIN === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'
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

type Minted = { chain: 'base' | 'near'; tokenId: string; explorer: string; tx?: string }
const MINT_KEY = 'gd.certs.mints'
const mints = (): Record<string, Partial<Record<'base' | 'near', Minted>>> => { try { return JSON.parse(localStorage.getItem(MINT_KEY) || '{}') } catch { return {} } }
const remember = (course: string, m: Minted) => { try { const all = mints(); all[course] = { ...all[course], [m.chain]: m }; localStorage.setItem(MINT_KEY, JSON.stringify(all)) } catch { /* private mode */ } }

const baseExplorer = (id: bigint | string) => `${BASESCAN}/nft/${BASE_NFT}/${id}`

async function baseTokenOf(username: string, course: string): Promise<bigint> {
  const key = keccak256(encodeAbiParameters([{ type: 'string' }, { type: 'string' }], [username, course]))
  const data = encodeFunctionData({ abi: ABI, functionName: 'tokenOfKey', args: [key] })
  const r = await fetch(BASE_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: BASE_NFT, data }, 'latest'] }) })
  const j = (await r.json()) as { result?: `0x${string}` }
  if (!j.result) throw new Error('Base RPC error')
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

async function voucher(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const auth = await authHeaders()
  if (!auth) throw new Error('Sign in to your Grind District account first (Menu > Account), then try again.')
  const r = await fetch('/api/profile?op=cert-voucher', { method: 'POST', headers: { 'content-type': 'application/json', ...auth.headers }, body: JSON.stringify({ ...body, ...(auth.near ? { near: auth.near } : {}) }) })
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (!r.ok) throw new Error(String(j.error ?? 'Could not prepare the mint') + (r.status === 401 && auth.near ? '. Sign in with NEAR again (sign-in proofs last 10 minutes).' : '.'))
  return j
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n
}
const linkTo = (href: string, text: string) => { const a = el('a', text); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a }

export function renderMint(root: HTMLElement, course: SkillId, certId: string): void {
  root.replaceChildren()
  if (!baseMintOn() && !nearMintOn()) return
  root.style.cssText = 'border:1px solid rgba(201,162,94,.45);border-radius:12px;padding:12px;display:grid;gap:8px;background:rgba(201,162,94,.05)'
  const head = el('p', 'Mint as NFT'); head.style.cssText = 'font-weight:700;margin:0;color:#e9cd8f'
  const note = el('p', 'Writes this practice certificate to the chain you pick, into your own wallet. It is soulbound: it cannot be sold or moved, and it has no money value. You pay the network fee (Base: a little ETH for gas; NEAR: 0.05 NEAR attached for storage, unused part refunded). Gas sponsorship comes later. Your name, @username, course and issue time become public on-chain.', 'muted')
  note.style.margin = '0'
  const pick = el('div', '', 'tabs'); pick.setAttribute('role', 'radiogroup'); pick.setAttribute('aria-label', 'Chain')
  const status = el('p', '', 'muted'); status.setAttribute('role', 'status'); status.style.margin = '0'
  const act = el('div'); act.style.cssText = 'display:grid;gap:6px'
  root.append(head, note, pick, status, act)
  let chain: 'base' | 'near' = baseMintOn() ? 'base' : 'near'
  const chip = (c: 'base' | 'near', label: string, on: boolean) => {
    const b = el('button', on ? label : `${label} (soon)`, 'ghost'); b.setAttribute('role', 'radio'); b.disabled = !on
    b.onclick = () => { chain = c; pick.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); void show() }
    b.setAttribute('aria-checked', String(c === chain)); return b
  }
  pick.append(chip('base', 'Base', baseMintOn()), chip('near', NEAR_NET === 'testnet' ? 'NEAR (testnet)' : 'NEAR', nearMintOn()))
  const set = (msg: string, ...nodes: HTMLElement[]) => { status.textContent = msg; act.replaceChildren(...nodes) }
  const btn = (label: string, fn: () => void) => { const b = el('button', label, 'primary'); b.onclick = fn; return b }
  const showMinted = (m: Minted) => set(`Minted on ${m.chain === 'base' ? 'Base' : 'NEAR'} · token #${m.tokenId}. The certificate fields are stored on-chain with it.`, linkTo(m.explorer, 'View on explorer'), ...(m.tx ? [linkTo(m.chain === 'base' ? `${BASESCAN}/tx/${m.tx}` : `${NEARBLOCKS}/txns/${m.tx}`, 'View transaction')] : []), linkTo(`/cert/${certId}`, 'Public certificate page'))
  const username = getSave().username

  const show = async () => {
    const saved = mints()[course]?.[chain]
    if (saved) return showMinted(saved)
    set('Checking the chain…')
    try {
      if (chain === 'base') {
        const id = await baseTokenOf(username, course)
        if (id > 0n) { const m = { chain, tokenId: id.toString(), explorer: baseExplorer(id) } as Minted; remember(course, m); return showMinted(m) }
        const addr = gameWalletAddress()
        if (!addr) return set('Base minting uses your game wallet. Sign in with Google, X or email to create it, then come back.')
        return set(`Not minted yet. Mints to your game wallet ${addr.slice(0, 6)}…${addr.slice(-4)} on Base.`, btn('Mint on Base', () => void mintBase(addr)))
      }
      const t = await nearView<NearToken>('cert_for', { username, course_id: course })
      if (t) { const m = { chain, tokenId: t.token_id, explorer: `${NEARBLOCKS}/nft-token/${NEAR_NFT}/${t.token_id}` } as Minted; remember(course, m); return showMinted(m) }
      return set('Not minted yet. Connect your NEAR wallet to mint.', btn('Connect NEAR wallet and mint', () => void mintNear()))
    } catch {
      set('Could not reach the chain. Nothing was changed.', btn('Retry', () => void show()))
    }
  }

  const mintBase = async (addr: string) => {
    set('Preparing your certificate…')
    try {
      const j = await voucher({ chain: 'base', course, certId, to: addr })
      if (j.already) { const a = j.already as { tokenId: string; explorer: string }; const m = { chain: 'base', tokenId: a.tokenId, explorer: a.explorer } as Minted; remember(course, m); return showMinted(m) }
      if (typeof j.certId === 'string') adoptCertId(course, j.certId)
      const v = j.voucher as Record<string, string>
      const data = encodeFunctionData({ abi: ABI, functionName: 'mint', args: [{ to: v.to as `0x${string}`, courseId: v.courseId, courseTitle: v.courseTitle, playerName: v.playerName, username: v.username, rank: v.rank, issuedAt: BigInt(v.issuedAt), issuedWat: v.issuedWat, serial: v.serial, certId: v.certId, deadline: BigInt(v.deadline) }, j.signature as `0x${string}`] })
      set('Confirm in your game wallet…')
      const { callFromGameWallet } = await import('./privyWallet.ts')
      const { hash } = await callFromGameWallet(String(j.contract), data, Number(j.chainId) || BASE_CHAIN)
      track('cert_minted', { course, chain: 'base' })
      set('Submitted. Waiting for Base to confirm…', linkTo(`${BASESCAN}/tx/${hash}`, 'View transaction'))
      for (let i = 0; i < 20; i += 1) {
        await new Promise((r) => setTimeout(r, 3000))
        const id = await baseTokenOf(username, course).catch(() => 0n)
        if (id > 0n) { const m = { chain: 'base', tokenId: id.toString(), explorer: baseExplorer(id), tx: hash } as Minted; remember(course, m); return showMinted(m) }
      }
      set('Still confirming. Check the transaction; this panel shows the token once it lands.', linkTo(`${BASESCAN}/tx/${hash}`, 'View transaction'), btn('Check again', () => void show()))
    } catch (e) {
      set(`Not minted: ${(e as Error).message}`, btn('Try again', () => void show()))
    }
  }

  const mintNear = async () => {
    set('Opening NEAR wallets…')
    try {
      const conn = await nearConnector()
      let w = await conn.wallet().catch(() => null)
      let account = w ? (await w.getAccounts())[0]?.accountId : ''
      if (!account) { w = await conn.connect(); account = (await w.getAccounts())[0]?.accountId }
      if (!account) throw new Error('No NEAR account connected')
      set('Preparing your certificate…')
      const j = await voucher({ chain: 'near', course, certId, receiver: account })
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
