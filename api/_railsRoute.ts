// Optional top-up rails served from /api/topup-confirm (no new Vercel function):
//   GET  ?rails=-config            -> which rails are configured (receivers, assets)
//   GET  ?rails=<payer address>    -> credited rail top-ups for that payer (for the game's top-up sync)
//   POST op intents-quote | intents-create | intents-tx | intents-scan     (NEAR Intents / 1Click)
//   POST op sol-create | sol-scan                                          (Solana Pay, SOL or USDC)
// A rail answers 503 until its env var is set: INTENTS_TOPUP_ACCOUNT (e.g. grinddistrict.near), SOLANA_TOPUP_ADDRESS.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  RAIL_ORDER_TTL_MS, MIN_USD, MAX_USD, INTENTS_ASSETS, intentsAccount, validRefund, intentsQuoteRequest, checkIntentsQuote, intentsCredit, oneClickDeps,
  solanaAccount, solanaCluster, usdcMint, newReference, usdToLamports, lamportsLabel, solanaPayUrl, checkSolanaPayment, solanaRpcDeps, railCredit, isSolSignature,
  type IntentsDeps, type SolDeps, type QuoteResponse,
} from './_rails.js'

type Req = { method?: string; body?: Record<string, unknown>; query?: Record<string, string | string[] | undefined> }
type Res = { status(n: number): { json(b: unknown): void } }
type Row = Record<string, unknown>

const COLS = '*, amount_text:amount_raw::text'
const rawOf = (o: Row) => BigInt(typeof o.amount_text === 'string' ? o.amount_text : String(o.amount_raw))
const usdMicroOf = (dollars: unknown): bigint | null => {
  const n = Number(dollars)
  if (!Number.isFinite(n) || n < MIN_USD || n > MAX_USD || Math.round(n * 100) !== n * 100) return null
  return BigInt(Math.round(n * 100)) * 10_000n
}
const missing = (e: { code?: string; message?: string } | null) => !!e && /42P01|PGRST205|does not exist|schema cache/i.test(`${e.code ?? ''} ${e.message ?? ''}`)

function orderOut(o: Row) {
  const q = (o.quote ?? {}) as { quote?: Row; payUrl?: string; label?: string; receiver?: string }
  return {
    orderId: o.id, rail: o.rail, asset: o.asset, status: o.status, usd: Number(o.usd_micro) / 1e6, amountRaw: rawOf(o).toString(),
    depositAddress: o.rail === 'intents' ? o.ref : undefined, depositMemo: o.memo ?? undefined, reference: o.rail === 'solana' ? o.ref : undefined,
    amountLabel: q.label, payUrl: q.payUrl, receiver: q.receiver, timeEstimate: q.quote?.timeEstimate, expiresAt: o.expires_at,
    creditUsd: o.credit_micro == null ? null : Number(o.credit_micro) / 1e6, hash: o.topup_id ?? null,
  }
}

export async function railsRoute(req: Req, res: Res, db: SupabaseClient, userId: string | null, deps: { intents?: IntentsDeps; sol?: SolDeps } = {}) {
  const intentsTo = intentsAccount(), solTo = solanaAccount()
  const ic = deps.intents ?? oneClickDeps()
  const sd = deps.sol ?? solanaRpcDeps()

  if (req.method === 'GET') {
    const q = String(req.query?.rails ?? '')
    if (q === '-config') {
      return res.status(200).json({
        intents: intentsTo ? { receiver: intentsTo, assets: INTENTS_ASSETS.map(({ id, label, refund }) => ({ id, label, refund })) } : null,
        solana: solTo ? { receiver: solTo, cluster: solanaCluster(), assets: ['SOL', 'USDC'] } : null,
        min: MIN_USD, max: MAX_USD,
      })
    }
    if (!validRefund('evm', q) && !validRefund('sol', q) && !validRefund('btc', q) && !validRefund('near', q)) return res.status(400).json({ error: 'bad address' })
    const { data } = await db.from('rail_topups').select('id,rail,credit_micro,credited_at').eq('payer', q).order('credited_at', { ascending: false }).limit(50)
    return res.status(200).json({ topups: (data ?? []).map((t) => ({ hash: String(t.id), asset: t.rail === 'solana' ? 'Solana' : 'NEAR Intents', credit: Number(t.credit_micro) / 1e6, at: t.credited_at })) })
  }

  const body = req.body ?? {}
  const op = String(body.op ?? '')
  const isIntents = op.startsWith('intents-')
  if (isIntents && !intentsTo) return res.status(503).json({ error: 'NEAR Intents top-ups are not live yet' })
  if (!isIntents && !solTo) return res.status(503).json({ error: 'Solana top-ups are not live yet' })

  // ----- create -----
  if (op === 'intents-quote' || op === 'intents-create') {
    const asset = INTENTS_ASSETS.find((a) => a.id === body.asset)
    if (!asset) return res.status(400).json({ error: 'pick a coin' })
    const usdMicro = usdMicroOf(body.dollars)
    if (usdMicro == null) return res.status(400).json({ error: `amount must be $${MIN_USD}–$${MAX_USD}` })
    const refundTo = String(body.refundTo ?? '').trim()
    if (!validRefund(asset.refund, refundTo)) return res.status(400).json({ error: `enter your ${asset.label.split(' · ')[1]} address (for refunds)` })
    const dry = op === 'intents-quote'
    const want = { originAsset: asset.id, usdMicro, refundTo, recipient: intentsTo, dry }
    let qr: QuoteResponse
    try { qr = await ic.quote(intentsQuoteRequest(want)) } catch (e) { return res.status(502).json({ error: `no quote: ${(e as Error).message}` }) }
    const chk = checkIntentsQuote(qr, want)
    if (!chk.ok) return res.status(502).json({ error: chk.error })
    const label = `${qr.quote.amountInFormatted} ${asset.symbol}`
    if (dry) return res.status(200).json({ asset: asset.id, amountLabel: label, amountIn: qr.quote.amountIn, usd: Number(usdMicro) / 1e6, timeEstimate: qr.quote.timeEstimate })
    const row = {
      rail: 'intents', privy_user_id: userId, payer: refundTo, asset: asset.id, amount_raw: String(qr.quote.amountIn), usd_micro: usdMicro.toString(),
      ref: String(qr.quote.depositAddress), memo: (qr.quote.depositMemo as string | undefined) ?? null, quote: { ...qr, label, receiver: intentsTo },
      expires_at: new Date(Date.now() + RAIL_ORDER_TTL_MS).toISOString(),
    }
    const { data, error } = await db.from('rail_topup_orders').insert(row).select(COLS).single()
    if (missing(error)) return res.status(503).json({ error: 'rail top-ups are not set up yet (run supabase/migrations/20261121090000_rail_topups.sql)' })
    if (error || !data) return res.status(500).json({ error: 'could not create order' })
    return res.status(200).json(orderOut(data))
  }

  if (op === 'sol-create') {
    const asset = body.asset === 'USDC' ? 'USDC' : body.asset === 'SOL' ? 'SOL' : null
    if (!asset) return res.status(400).json({ error: 'pick SOL or USDC' })
    const usdMicro = usdMicroOf(body.dollars)
    if (usdMicro == null) return res.status(400).json({ error: `amount must be $${MIN_USD}–$${MAX_USD}` })
    const payer = String(body.payer ?? '').trim()
    if (payer && !validRefund('sol', payer)) return res.status(400).json({ error: 'bad Solana address' })
    let raw: bigint
    if (asset === 'USDC') raw = usdMicro
    else { try { raw = usdToLamports(usdMicro, await sd.price()) } catch (e) { return res.status(503).json({ error: (e as Error).message || 'no SOL price' }) } }
    const reference = newReference(), mint = usdcMint()
    const label = asset === 'SOL' ? `${lamportsLabel(raw)} SOL` : `${(Number(raw) / 1e6).toFixed(2)} USDC`
    const payUrl = solanaPayUrl({ recipient: solTo, asset, amountRaw: raw, reference, mint })
    const row = {
      rail: 'solana', privy_user_id: userId, payer: payer || null, asset: asset === 'SOL' ? 'SOL' : `USDC:${mint}`, amount_raw: raw.toString(), usd_micro: usdMicro.toString(),
      ref: reference, quote: { payUrl, label, receiver: solTo, cluster: solanaCluster() }, expires_at: new Date(Date.now() + RAIL_ORDER_TTL_MS).toISOString(),
    }
    const { data, error } = await db.from('rail_topup_orders').insert(row).select(COLS).single()
    if (missing(error)) return res.status(503).json({ error: 'rail top-ups are not set up yet (run supabase/migrations/20261121090000_rail_topups.sql)' })
    if (error || !data) return res.status(500).json({ error: 'could not create order' })
    return res.status(200).json(orderOut(data))
  }

  // ----- existing order -----
  const id = String(body.orderId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).json({ error: 'order not found' })
  const { data: order } = await db.from('rail_topup_orders').select(COLS).eq('id', id).maybeSingle()
  if (!order || order.rail !== (isIntents ? 'intents' : 'solana')) return res.status(404).json({ error: 'order not found' })
  if (order.status === 'credited') return res.status(200).json({ ...orderOut(order), ok: true, already: true })
  if (order.status === 'refunded' || order.status === 'failed') return res.status(200).json({ ...orderOut(order), ok: false, error: order.error ?? order.status })

  const credit = async (topupId: string, payer: string | null, usdMicro: bigint, fee: bigint, cr: bigint) => {
    const row = {
      id: topupId, rail: order.rail, privy_user_id: (order.privy_user_id as string | null) ?? userId, payer: payer ?? order.payer ?? null, asset: order.asset,
      amount_raw: rawOf(order).toString(), usd_micro: usdMicro.toString(), fee_micro: fee.toString(), credit_micro: cr.toString(), order_id: order.id, credited_at: new Date().toISOString(),
    }
    const { error } = await db.from('rail_topups').insert(row)
    if (error) {
      // Already credited (same payment twice) -> report the existing credit, never a second one.
      const { data: had } = await db.from('rail_topups').select('order_id,credit_micro').eq('id', topupId).maybeSingle()
      if (had && had.order_id === order.id) return { ok: true as const, already: true, creditUsd: Number(had.credit_micro) / 1e6 }
      return { ok: false as const, error: had ? 'this payment was already used' : 'could not record the top-up' }
    }
    await db.from('rail_topup_orders').update({ status: 'credited', topup_id: topupId, credit_micro: cr.toString(), credited_at: row.credited_at, error: null }).eq('id', order.id)
    return { ok: true as const, already: false, creditUsd: Number(cr) / 1e6 }
  }

  if (op === 'intents-tx') {
    // Optional: the player pastes their deposit tx hash so 1Click picks it up sooner.
    const tx = String(body.txHash ?? '').trim()
    if (!/^[0-9A-Za-z]{20,120}$/.test(tx) && !/^0x[0-9a-fA-F]{64}$/.test(tx)) return res.status(400).json({ error: 'bad transaction id' })
    try { await ic.submit(String(order.ref), tx, order.memo as string | null) } catch (e) { return res.status(502).json({ error: (e as Error).message }) }
    return res.status(200).json({ ...orderOut(order), ok: false, waiting: true })
  }

  if (op === 'intents-scan') {
    let st
    try { st = await ic.status(String(order.ref), order.memo as string | null) } catch (e) { return res.status(502).json({ error: (e as Error).message }) }
    const r = intentsCredit(st, { ref: String(order.ref), usdMicro: BigInt(String(order.usd_micro)), recipient: intentsTo })
    if (!r.ok) {
      if (!r.waiting) await db.from('rail_topup_orders').update({ status: /refunded/.test(r.error) ? 'refunded' : 'failed', error: r.error }).eq('id', order.id)
      return res.status(200).json({ ...orderOut(order), ok: false, waiting: !!r.waiting, stage: st.status, error: r.waiting ? undefined : r.error })
    }
    const c = await credit(`intents:${order.ref}`, String(order.payer ?? ''), r.usdMicro, r.fee, r.credit)
    if (!c.ok) return res.status(409).json({ error: c.error })
    return res.status(200).json({ ...orderOut(order), ...c, hash: `intents:${order.ref}`, status: 'credited' })
  }

  if (op === 'sol-scan') {
    const asset = String(order.asset) === 'SOL' ? 'SOL' : 'USDC'
    const mint = asset === 'USDC' ? String(order.asset).split(':')[1] ?? usdcMint() : usdcMint()
    const want = { receiver: solTo, reference: String(order.ref), asset: asset as 'SOL' | 'USDC', amountRaw: rawOf(order), mint, notBeforeS: Math.floor(new Date(String(order.created_at)).getTime() / 1000) - 120 }
    const given = String(body.signature ?? '')
    let sigs: string[]
    if (given) { if (!isSolSignature(given)) return res.status(400).json({ error: 'bad signature' }); sigs = [given] }
    else {
      if (new Date(String(order.expires_at)).getTime() + 2 * 3600_000 < Date.now()) return res.status(410).json({ error: 'order expired; start a new top-up' })
      try { sigs = (await sd.signaturesFor(want.reference)).filter((s) => !s.err).map((s) => s.signature).slice(0, 5) } catch { sigs = [] }
    }
    for (const s of sigs) {
      const tx = await sd.tx(s).catch(() => null)
      const chk = tx ? checkSolanaPayment(tx, want) : { ok: false as const, error: 'not found yet' }
      if (!chk.ok) { if (given) return res.status(400).json({ error: chk.error }); continue }
      const usdMicro = BigInt(String(order.usd_micro)), b = railCredit(usdMicro)
      const c = await credit(`sol:${chk.signature}`, String(order.payer ?? chk.payer), usdMicro, b.fee, b.credit)
      if (!c.ok) return res.status(409).json({ error: c.error })
      return res.status(200).json({ ...orderOut(order), ...c, hash: `sol:${chk.signature}`, status: 'credited' })
    }
    return res.status(200).json({ ...orderOut(order), ok: false, waiting: true })
  }
  return res.status(400).json({ error: 'unknown op' })
}
