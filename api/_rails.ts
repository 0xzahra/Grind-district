// Optional top-up rails, both OFF until their env vars are set (and hidden in the game unless VITE_TOPUP_RAILS lists them):
//  - Solana: pay SOL or USDC with any Solana wallet through a Solana Pay link/QR. Each order has a unique
//    reference key; the server finds the payment by that key and checks the balance change to the receiver.
//  - NEAR Intents (1Click): pay from many chains (SOL, BTC, ETH/USDC on Base, Arbitrum...). 1Click swaps it and
//    delivers USDC to the Grind District NEAR account (its NEAR Intents balance). The server keeps the signed
//    quote, checks the 1Click signature, then credits when 1Click reports SUCCESS.
// Same 2% fee as every other top-up (breakdown()). In-game dollars only; nothing is withdrawable.
// Pure helpers + small network deps. Underscore = not a Vercel function.
import { createHash, createPublicKey, verify, randomBytes } from 'node:crypto'
import { breakdown } from '../src/grindConfig.js'
import { jsonRpc, arbRpcUrl } from './_nearTopup.js'

export const RAIL_ORDER_TTL_MS = 30 * 60_000
export const MIN_USD = 1, MAX_USD = 500

// ---------- base58 ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function b58encode(b: Uint8Array): string {
  let n = 0n
  for (const x of b) n = (n << 8n) | BigInt(x)
  let s = ''
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n }
  for (const x of b) { if (x) break; s = '1' + s }
  return s
}
export function b58decode(s: string): Uint8Array {
  let n = 0n
  for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i) }
  const out: number[] = []
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n }
  for (const c of s) { if (c !== '1') break; out.unshift(0) }
  return Uint8Array.from(out)
}

// ---------- 1Click quote signature (same algorithm as @defuse-protocol/one-click-sdk-typescript verifyQuoteSignature) ----------
export const ONE_CLICK_MANAGER_PUB_KEY = 'ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc'

/** json-stable-stringify semantics: sorted keys, undefined object values dropped, undefined in arrays -> null. */
export function stableStringify(v: unknown): string {
  if (v && typeof (v as { toJSON?: unknown }).toJSON === 'function') v = (v as { toJSON(): unknown }).toJSON()
  if (v === undefined) return undefined as unknown as string
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined || typeof x === 'function' ? 'null' : stableStringify(x))).join(',')}]`
  const o = v as Record<string, unknown>
  const parts: string[] = []
  for (const k of Object.keys(o).sort()) {
    const val = o[k]
    if (val === undefined || typeof val === 'function') continue
    parts.push(`${JSON.stringify(k)}:${stableStringify(val)}`)
  }
  return `{${parts.join(',')}}`
}

type Obj = Record<string, unknown>
export type QuoteResponse = { correlationId?: string; timestamp: string; signature: string; quoteRequest: Obj; quote: Obj }
const orU = (x: unknown) => (x ? x : undefined)

export function quoteHash(r: QuoteResponse): string {
  const q = r.quoteRequest, a = r.quote
  const req = {
    dry: q.dry, swapType: q.swapType, slippageTolerance: q.slippageTolerance, originAsset: q.originAsset, depositType: q.depositType,
    destinationAsset: q.destinationAsset, amount: q.amount, refundTo: q.refundTo, refundType: q.refundType, recipient: q.recipient,
    recipientType: q.recipientType, deadline: q.deadline, quoteWaitingTimeMs: orU(q.quoteWaitingTimeMs), referral: orU(q.referral),
    virtualChainRecipient: orU(q.virtualChainRecipient), virtualChainRefundRecipient: orU(q.virtualChainRefundRecipient), customRecipientMsg: orU(q.customRecipientMsg),
  }
  const base = { amountIn: a.amountIn, amountInFormatted: a.amountInFormatted, amountInUsd: a.amountInUsd, minAmountIn: a.minAmountIn, amountOut: a.amountOut, amountOutFormatted: a.amountOutFormatted, amountOutUsd: a.amountOutUsd, minAmountOut: a.minAmountOut }
  const quote = q.dry ? base : { ...base, depositAddress: orU(a.depositAddress), depositMemo: orU(a.depositMemo), deadline: orU(a.deadline), timeWhenInactive: orU(a.timeWhenInactive), timeEstimate: orU(a.timeEstimate), refundFee: orU(a.refundFee), withdrawFee: orU(a.withdrawFee) }
  return b58encode(createHash('sha256').update(stableStringify({ ...req, ...quote, timestamp: r.timestamp })).digest())
}

const ed25519Key = (raw: Uint8Array) => createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(raw).toString('base64url') }, format: 'jwk' })
const strip = (s: string) => (s.startsWith('ed25519:') ? s.slice(8) : s)

export function verifyQuoteSignature(r: QuoteResponse, managerKey = ONE_CLICK_MANAGER_PUB_KEY): boolean {
  try {
    const sig = b58decode(strip(String(r.signature))), pub = b58decode(strip(managerKey))
    if (sig.length !== 64 || pub.length !== 32) return false
    return verify(null, Buffer.from(quoteHash(r)), ed25519Key(pub), Buffer.from(sig))
  } catch { return false }
}

// ---------- NEAR Intents rail ----------
export const USDC_NEAR = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1' // 6 decimals: raw = micro-dollars
/** Origin assets offered to players (all must exist in /v0/tokens). refund = the address format the player gives. */
export const INTENTS_ASSETS: Array<{ id: string; symbol: string; chain: string; label: string; refund: 'evm' | 'sol' | 'btc' | 'near' }> = [
  { id: 'nep141:sol.omft.near', symbol: 'SOL', chain: 'sol', label: 'SOL · Solana', refund: 'sol' },
  { id: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near', symbol: 'USDC', chain: 'sol', label: 'USDC · Solana', refund: 'sol' },
  { id: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near', symbol: 'USDC', chain: 'base', label: 'USDC · Base', refund: 'evm' },
  { id: 'nep141:base.omft.near', symbol: 'ETH', chain: 'base', label: 'ETH · Base', refund: 'evm' },
  { id: 'nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near', symbol: 'USDC', chain: 'arb', label: 'USDC · Arbitrum', refund: 'evm' },
  { id: 'nep141:btc.omft.near', symbol: 'BTC', chain: 'btc', label: 'BTC · Bitcoin', refund: 'btc' },
]
export const intentsAccount = () => { const a = (process.env.INTENTS_TOPUP_ACCOUNT ?? '').trim().toLowerCase(); return /^[a-z0-9._-]{2,64}\.near$/.test(a) ? a : '' }
export const oneClickBase = () => (process.env.ONECLICK_URL || 'https://1click.chaindefuser.com').replace(/\/$/, '')

export function validRefund(kind: 'evm' | 'sol' | 'btc' | 'near', a: string): boolean {
  if (kind === 'evm') return /^0x[0-9a-fA-F]{40}$/.test(a)
  if (kind === 'sol') { try { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && b58decode(a).length === 32 } catch { return false } }
  if (kind === 'btc') return /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a)
  return /^[a-z0-9._-]{2,64}$/.test(a)
}

export function intentsQuoteRequest(o: { originAsset: string; usdMicro: bigint; refundTo: string; recipient: string; dry: boolean; nowMs?: number }) {
  return {
    dry: o.dry, swapType: 'EXACT_OUTPUT', slippageTolerance: 100, originAsset: o.originAsset, depositType: 'ORIGIN_CHAIN',
    destinationAsset: USDC_NEAR, amount: o.usdMicro.toString(), refundTo: o.refundTo, refundType: 'ORIGIN_CHAIN',
    recipient: o.recipient, recipientType: 'INTENTS', deadline: new Date((o.nowMs ?? Date.now()) + RAIL_ORDER_TTL_MS).toISOString(), referral: 'grinddistrict',
  }
}

/** A quote is usable only if 1Click signed it and it is exactly what we asked for (receiver, asset, amount, refund). */
export function checkIntentsQuote(r: QuoteResponse, want: { originAsset: string; usdMicro: bigint; refundTo: string; recipient: string; dry: boolean }): { ok: true } | { ok: false; error: string } {
  if (!verifyQuoteSignature(r)) return { ok: false, error: 'quote signature did not verify' }
  const q = r.quoteRequest
  if (q.destinationAsset !== USDC_NEAR || q.recipient !== want.recipient || q.recipientType !== 'INTENTS') return { ok: false, error: 'quote pays someone else' }
  if (q.originAsset !== want.originAsset || q.refundTo !== want.refundTo || q.swapType !== 'EXACT_OUTPUT' || String(q.amount) !== want.usdMicro.toString() || Boolean(q.dry) !== want.dry) return { ok: false, error: 'quote does not match the order' }
  if (!want.dry && !(typeof r.quote.depositAddress === 'string' && r.quote.depositAddress.length >= 8)) return { ok: false, error: 'quote has no deposit address' }
  return { ok: true }
}

export type IntentsStatus = { status: string; quoteResponse?: QuoteResponse; swapDetails?: { amountOut?: string; nearTxHashes?: string[]; originChainTxHashes?: Array<{ hash: string }> } }

/** On SUCCESS: what to credit. The status must carry the same signed quote (same deposit address, receiver, asset). */
export function intentsCredit(st: IntentsStatus, order: { ref: string; usdMicro: bigint; recipient: string }): { ok: true; usdMicro: bigint; fee: bigint; credit: bigint } | { ok: false; waiting?: boolean; error: string } {
  if (st.status === 'REFUNDED' || st.status === 'FAILED') return { ok: false, error: `payment ${st.status.toLowerCase()} by NEAR Intents` }
  if (st.status !== 'SUCCESS') return { ok: false, waiting: true, error: st.status || 'waiting' }
  const qr = st.quoteResponse
  if (!qr || !verifyQuoteSignature(qr)) return { ok: false, error: 'status quote signature did not verify' }
  if (qr.quote.depositAddress !== order.ref || qr.quoteRequest.recipient !== order.recipient || qr.quoteRequest.recipientType !== 'INTENTS' || qr.quoteRequest.destinationAsset !== USDC_NEAR) return { ok: false, error: 'status does not match the order' }
  let out: bigint
  try { out = BigInt(String(st.swapDetails?.amountOut ?? '0')) } catch { out = 0n }
  if (out <= 0n) return { ok: false, waiting: true, error: 'settling' }
  // Credit what actually arrived, never more than the order asked for.
  const usd = out < order.usdMicro ? out : order.usdMicro
  const b = breakdown(usd)
  return { ok: true, usdMicro: usd, fee: b.fee, credit: b.credit }
}

export type IntentsDeps = { quote(body: Obj): Promise<QuoteResponse>; status(depositAddress: string, memo?: string | null): Promise<IntentsStatus>; submit(depositAddress: string, txHash: string, memo?: string | null): Promise<unknown> }
export function oneClickDeps(): IntentsDeps {
  const h = (): Record<string, string> => ({ 'content-type': 'application/json', ...(process.env.ONECLICK_API_KEY ? { 'X-API-Key': process.env.ONECLICK_API_KEY } : {}) })
  const call = async (path: string, init?: RequestInit) => {
    const r = await fetch(`${oneClickBase()}${path}`, { ...init, headers: h(), signal: AbortSignal.timeout(15_000) })
    const j = (await r.json().catch(() => ({}))) as Obj
    if (!r.ok) throw new Error(String(j.message ?? `1Click ${r.status}`).slice(0, 200))
    return j
  }
  return {
    quote: async (body) => (await call('/v0/quote', { method: 'POST', body: JSON.stringify(body) })) as unknown as QuoteResponse,
    status: async (a, memo) => (await call(`/v0/status?depositAddress=${encodeURIComponent(a)}${memo ? `&depositMemo=${encodeURIComponent(memo)}` : ''}`)) as unknown as IntentsStatus,
    submit: async (a, txHash, memo) => call('/v0/deposit/submit', { method: 'POST', body: JSON.stringify({ depositAddress: a, txHash, ...(memo ? { memo } : {}) }) }),
  }
}

// ---------- Solana rail (Solana Pay) ----------
export const USDC_SOL_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const USDC_SOL_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
export const SOL_USD_FEED = '0x24ceA4b8ce57cdA5058b924B9B9987992450590c' // Chainlink SOL / USD on Arbitrum (description() checked)
export const solanaAccount = () => { const a = (process.env.SOLANA_TOPUP_ADDRESS ?? '').trim(); return validRefund('sol', a) ? a : '' }
export const solanaCluster = (): 'mainnet' | 'devnet' => (process.env.SOLANA_CLUSTER === 'devnet' ? 'devnet' : 'mainnet')
export const solanaRpcUrl = () => process.env.SOLANA_RPC_URL || (solanaCluster() === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com')
export const usdcMint = () => (solanaCluster() === 'devnet' ? USDC_SOL_DEVNET_MINT : USDC_SOL_MINT)
export const newReference = () => b58encode(randomBytes(32))

/** Chainlink SOL/USD (8 decimals) on Arbitrum. */
export async function solUsdPrice(rpc = arbRpcUrl()): Promise<bigint> {
  const res = String(await jsonRpc(rpc, 'eth_call', [{ to: SOL_USD_FEED, data: '0xfeaf968c' }, 'latest']))
  if (!/^0x[0-9a-f]{320}$/i.test(res)) throw new Error('no SOL price')
  const price8 = BigInt('0x' + res.slice(66, 130)), updatedAt = Number(BigInt('0x' + res.slice(194, 258)))
  if (price8 <= 0n || price8 > 10n ** 13n) throw new Error('bad SOL price')
  if (Date.now() / 1000 - updatedAt > 26 * 3600) throw new Error('SOL price is stale')
  return price8
}
/** dollars -> lamports at price8, rounded up to 1000 lamports (wallets show 6 decimals). */
export function usdToLamports(usdMicro: bigint, price8: bigint): bigint {
  const l = (usdMicro * 10n ** 11n + price8 - 1n) / price8 // micro$ * 1e9 lamports * 1e8 / (price8 * 1e6)
  return ((l + 999n) / 1000n) * 1000n
}
export const lamportsLabel = (l: bigint) => { const s = (Number(l) / 1e9).toFixed(6); return s.replace(/0+$/, '').replace(/\.$/, '') }

export function solanaPayUrl(o: { recipient: string; asset: 'SOL' | 'USDC'; amountRaw: bigint; reference: string; mint: string }): string {
  const amount = o.asset === 'SOL' ? lamportsLabel(o.amountRaw) : (Number(o.amountRaw) / 1e6).toFixed(2)
  const p = new URLSearchParams({ amount, reference: o.reference, label: 'Grind District', message: 'In-game top-up (2% fee). Not withdrawable.' })
  if (o.asset === 'USDC') p.set('spl-token', o.mint)
  return `solana:${o.recipient}?${p.toString().replace(/\+/g, '%20')}`
}

type SolTx = {
  slot?: number; blockTime?: number | null
  meta?: { err: unknown; preBalances?: number[]; postBalances?: number[]; preTokenBalances?: Array<TokBal>; postTokenBalances?: Array<TokBal> } | null
  transaction?: { signatures?: string[]; message?: { accountKeys?: Array<string | { pubkey: string }> } }
}
type TokBal = { accountIndex: number; mint: string; owner?: string; uiTokenAmount: { amount: string } }
export type { SolTx }

/** Did this transaction pay `receiver` exactly `amountRaw` (lamports, or USDC base units of `mint`) and include the reference key? */
export function checkSolanaPayment(tx: SolTx, o: { receiver: string; reference: string; asset: 'SOL' | 'USDC'; amountRaw: bigint; mint: string; notBeforeS?: number }): { ok: true; signature: string; payer: string } | { ok: false; error: string } {
  if (!tx?.meta || !tx.transaction?.message) return { ok: false, error: 'transaction not found' }
  if (tx.meta.err) return { ok: false, error: 'transaction failed' }
  const keys = (tx.transaction.message.accountKeys ?? []).map((k) => (typeof k === 'string' ? k : k.pubkey))
  const signature = tx.transaction.signatures?.[0] ?? ''
  if (!keys.includes(o.reference)) return { ok: false, error: 'reference missing' }
  if (o.notBeforeS && tx.blockTime && tx.blockTime < o.notBeforeS) return { ok: false, error: 'payment is older than the order' }
  const payer = keys[0] ?? ''
  if (o.asset === 'SOL') {
    const i = keys.indexOf(o.receiver)
    if (i < 0) return { ok: false, error: 'receiver not in transaction' }
    const delta = BigInt(tx.meta.postBalances?.[i] ?? 0) - BigInt(tx.meta.preBalances?.[i] ?? 0)
    if (delta !== o.amountRaw) return { ok: false, error: 'amount does not match' }
    return { ok: true, signature, payer }
  }
  const sum = (arr: TokBal[] | undefined) => (arr ?? []).filter((b) => b.mint === o.mint && b.owner === o.receiver).reduce((a, b) => a + BigInt(b.uiTokenAmount.amount), 0n)
  const delta = sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances)
  if (delta !== o.amountRaw) return { ok: false, error: 'amount does not match' }
  return { ok: true, signature, payer }
}

export type SolDeps = { signaturesFor(address: string): Promise<Array<{ signature: string; err: unknown; blockTime?: number | null }>>; tx(signature: string): Promise<SolTx | null>; price(): Promise<bigint> }
export function solanaRpcDeps(): SolDeps {
  const url = solanaRpcUrl()
  return {
    signaturesFor: async (a) => (await jsonRpc(url, 'getSignaturesForAddress', [a, { limit: 10, commitment: 'confirmed' }])) ?? [],
    tx: async (s) => jsonRpc(url, 'getTransaction', [s, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]),
    price: () => solUsdPrice(),
  }
}

export const railCredit = (usdMicro: bigint) => breakdown(usdMicro)
export const isSolSignature = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(s)
