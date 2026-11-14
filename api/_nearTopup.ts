// NEAR mainnet top-ups: the player sends NEAR from their own wallet to the Grind District account; the server
// checks the transaction over NEAR RPC and credits in-game $ once (same 2% fee as Base). Underscore = not a
// Vercel function. Off until NEAR_TOPUP_ACCOUNT is set. No contract, no token: a plain NEAR transfer.
import { breakdown } from '../src/grindConfig.js'

export const NEAR_ORDER_TTL_MS = 30 * 60 * 1000
export const MIN_NEAR = 0.1
export const MAX_NEAR = 500
const YOCTO = 10n ** 24n
/** Chainlink NEAR / USD on Arbitrum One (8 decimals). Base has no NEAR feed. */
export const NEAR_USD_FEED = '0xBF5C3fB2633e924598A46B9D07a174a9DBcF57C0'
export const NEAR_PRICE_MAX_AGE_S = 26 * 3600 // feed heartbeat is 24 h (plus 0.5% deviation updates)

export const nearTopupAccount = () => {
  const a = (process.env.NEAR_TOPUP_ACCOUNT ?? '').trim().toLowerCase()
  return isNearAccountId(a) ? a : ''
}
export const nearRpcUrl = () => process.env.NEAR_MAINNET_RPC_URL || 'https://rpc.mainnet.near.org'
export const arbRpcUrl = () => process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'

export const isNearAccountId = (a: string) => a.length >= 2 && a.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a)
export const isNearTxHash = (h: string) => /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(h)

/** Player's amount (up to 2 decimals) -> yoctoNEAR. */
export function encodeNear(near: number): bigint {
  if (!Number.isFinite(near) || near < MIN_NEAR || near > MAX_NEAR) throw new Error(`pick between ${MIN_NEAR} and ${MAX_NEAR} NEAR`)
  const c = Math.round(near * 100)
  if (Math.abs(near * 100 - c) > 1e-6) throw new Error('use at most 2 decimals')
  return BigInt(c) * 10n ** 22n
}
export function formatNear(yocto: bigint): string {
  const whole = yocto / YOCTO
  const frac = (yocto % YOCTO).toString().padStart(24, '0').replace(/0+$/, '').slice(0, 6)
  return frac ? `${whole}.${frac}` : `${whole}`
}
/** yoctoNEAR * price(8 dp) -> micro-dollars */
export const nearToUsdMicro = (yocto: bigint, price8: bigint) => (yocto * price8) / 10n ** 26n

type Status = { SuccessValue?: string; SuccessReceiptId?: string; Failure?: unknown } | string
export type NearTx = {
  status?: Status
  transaction?: { hash?: string; signer_id?: string; receiver_id?: string; actions?: unknown[] }
  transaction_outcome?: { block_hash?: string; outcome?: { status?: Status } }
  receipts_outcome?: Array<{ block_hash?: string; outcome?: { status?: Status; executor_id?: string } }>
}
const failed = (s: Status | undefined) => !s || (typeof s === 'object' && 'Failure' in s) || s === 'Failure'

/** Checks a final NEAR transaction is one plain, successful NEAR transfer from `sender` to `receiver`. */
export function checkNearTransfer(tx: NearTx | null | undefined, opts: { hash: string; sender: string; receiver: string }):
  { ok: true; yocto: bigint; blockHash: string } | { ok: false; code: number; error: string } {
  if (!tx?.transaction) return { ok: false, code: 409, error: 'transaction not found or not final yet' }
  const t = tx.transaction
  if (t.hash && t.hash !== opts.hash) return { ok: false, code: 400, error: 'wrong transaction' }
  if (t.receiver_id !== opts.receiver) return { ok: false, code: 400, error: 'this transaction did not pay the Grind District NEAR account' }
  if (t.signer_id !== opts.sender) return { ok: false, code: 403, error: 'sender does not match the NEAR account you paid from' }
  const actions = t.actions ?? []
  let yocto = 0n
  for (const a of actions) {
    const dep = (a as { Transfer?: { deposit?: string } })?.Transfer?.deposit
    if (typeof dep !== 'string' || !/^\d+$/.test(dep)) return { ok: false, code: 400, error: 'only a plain NEAR transfer counts as a top-up' }
    yocto += BigInt(dep)
  }
  if (!actions.length || yocto <= 0n) return { ok: false, code: 400, error: 'no NEAR was sent' }
  if (failed(tx.status) || failed(tx.transaction_outcome?.outcome?.status)) return { ok: false, code: 400, error: 'transaction failed' }
  const receipts = tx.receipts_outcome ?? []
  if (!receipts.length || receipts.some((r) => failed(r.outcome?.status))) return { ok: false, code: 400, error: 'transfer failed (refunded)' }
  if (!receipts.some((r) => r.outcome?.executor_id === opts.receiver)) return { ok: false, code: 409, error: 'transfer not delivered yet' }
  return { ok: true, yocto, blockHash: tx.transaction_outcome?.block_hash ?? '' }
}

export async function jsonRpc(url: string, method: string, params: unknown, timeoutMs = 8000): Promise<any> {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method, params }) })
    const j = (await r.json()) as { result?: unknown; error?: { message?: string; cause?: { name?: string } } }
    if (j.error) throw Object.assign(new Error(j.error.cause?.name || j.error.message || 'rpc error'), { rpcName: j.error.cause?.name })
    return j.result
  } finally { clearTimeout(tm) }
}

/** Chainlink NEAR/USD: { price8, updatedAt } or throws. */
export async function nearUsdPrice(rpc = arbRpcUrl()): Promise<{ price8: bigint; updatedAt: number }> {
  const res = String(await jsonRpc(rpc, 'eth_call', [{ to: NEAR_USD_FEED, data: '0xfeaf968c' }, 'latest']))
  if (!/^0x[0-9a-f]{320}$/i.test(res)) throw new Error('no NEAR price')
  const price8 = BigInt('0x' + res.slice(66, 130))
  const updatedAt = Number(BigInt('0x' + res.slice(194, 258)))
  if (price8 <= 0n || price8 > 10n ** 12n) throw new Error('bad NEAR price')
  if (Date.now() / 1000 - updatedAt > NEAR_PRICE_MAX_AGE_S) throw new Error('NEAR price is stale')
  return { price8, updatedAt }
}

export type NearStore = {
  get(hash: string): Promise<{ status: string; credit_micro: string | number; sender: string } | null>
  claim(row: Record<string, unknown>): Promise<boolean>
}
export type NearDeps = {
  txStatus(hash: string, sender: string): Promise<NearTx | null>
  blockTimeMs(blockHash: string): Promise<number>
  price(): Promise<{ price8: bigint; updatedAt: number }>
  store: NearStore
}
export type NearResult =
  | { ok: true; already: boolean; creditUsd: number; feeUsd: number; asset: 'NEAR'; paid: string; sender: string; hash: string }
  | { ok: false; code: number; error: string }

/** Verify + credit once. Credits are recorded server-side only (no on-chain ledger call, no money moves). */
export async function confirmNearTopup(deps: NearDeps, opts: { hash: string; sender: string; receiver: string; userId: string | null; orderId?: string | null; notBeforeMs?: number }): Promise<NearResult> {
  const sender = opts.sender.toLowerCase()
  if (!isNearTxHash(opts.hash)) return { ok: false, code: 400, error: 'bad transaction id' }
  if (!isNearAccountId(sender)) return { ok: false, code: 400, error: 'enter the NEAR account you paid from' }
  const prior = await deps.store.get(opts.hash)
  if (prior?.status === 'credited') {
    if (prior.sender !== sender) return { ok: false, code: 409, error: 'this payment was already used' }
    const credit = Number(prior.credit_micro) / 1e6
    return { ok: true, already: true, creditUsd: credit, feeUsd: 0, asset: 'NEAR', paid: '', sender, hash: opts.hash }
  }
  if (prior) return { ok: false, code: 409, error: `already ${prior.status}` }
  const tx = await deps.txStatus(opts.hash, sender).catch(() => null)
  const chk = checkNearTransfer(tx, { hash: opts.hash, sender, receiver: opts.receiver })
  if (!chk.ok) return chk
  if (opts.notBeforeMs) {
    const at = await deps.blockTimeMs(chk.blockHash).catch(() => 0)
    if (!at) return { ok: false, code: 502, error: 'could not read the block time' }
    if (at < opts.notBeforeMs) return { ok: false, code: 400, error: 'this payment was made before the top-up started' }
  }
  let p: { price8: bigint }
  try { p = await deps.price() } catch (e) { return { ok: false, code: 503, error: (e as Error).message || 'no NEAR price' } }
  const usdMicro = nearToUsdMicro(chk.yocto, p.price8)
  const b = breakdown(usdMicro)
  if (b.credit < 100_000n) return { ok: false, code: 400, error: 'amount too small' }
  const row = {
    tx_hash: opts.hash, sender, receiver: opts.receiver, privy_user_id: opts.userId, order_id: opts.orderId ?? null,
    yocto: chk.yocto.toString(), near_usd_8: p.price8.toString(), usd_micro: usdMicro.toString(), fee_micro: b.fee.toString(),
    credit_micro: b.credit.toString(), status: 'credited', credited_at: new Date().toISOString(),
  }
  // Primary key on tx_hash: a second claim of the same payment fails here.
  if (!(await deps.store.claim(row))) {
    const again = await deps.store.get(opts.hash)
    if (again?.status === 'credited' && again.sender === sender) return { ok: true, already: true, creditUsd: Number(again.credit_micro) / 1e6, feeUsd: 0, asset: 'NEAR', paid: chk.yocto.toString(), sender, hash: opts.hash }
    return { ok: false, code: 409, error: 'this payment was already used' }
  }
  return { ok: true, already: false, creditUsd: Number(b.credit) / 1e6, feeUsd: Number(b.fee) / 1e6, asset: 'NEAR', paid: chk.yocto.toString(), sender, hash: opts.hash }
}

/** Live NEAR RPC dependencies. */
export const nearRpcDeps = (store: NearStore): NearDeps => ({
  txStatus: async (hash, sender) => (await jsonRpc(nearRpcUrl(), 'tx', { tx_hash: hash, sender_account_id: sender, wait_until: 'FINAL' }, 12000)) as NearTx,
  blockTimeMs: async (blockHash) => Number(BigInt((await jsonRpc(nearRpcUrl(), 'block', { block_id: blockHash })).header.timestamp) / 1_000_000n),
  price: () => nearUsdPrice(),
  store,
})

/** Recent incoming transactions to the receiver (FastNEAR explorer API), for orders where the wallet gave no tx id. */
export async function recentIncoming(receiver: string): Promise<Array<{ hash: string; heightMs?: number }>> {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000)
  try {
    const r = await fetch(process.env.NEAR_TX_API_URL || 'https://tx.main.fastnear.com/v0/account', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_id: receiver, max_block_height: null }) })
    const j = (await r.json()) as { account_txs?: Array<{ transaction_hash: string; is_real_receiver?: boolean; is_success?: boolean; tx_block_timestamp?: string }> }
    return (j.account_txs ?? []).filter((t) => t.is_real_receiver && t.is_success !== false).slice(0, 60)
      .map((t) => ({ hash: t.transaction_hash, heightMs: t.tx_block_timestamp ? Number(BigInt(t.tx_block_timestamp) / 1_000_000n) : undefined }))
  } finally { clearTimeout(tm) }
}
