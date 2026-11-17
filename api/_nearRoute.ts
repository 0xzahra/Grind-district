// NEAR top-up routes (mainnet, or testnet when the receiving account is a .testnet one), served from /api/topup-confirm (GET ?near=<account> or ?near=-price, POST op near-create /
// near-confirm / near-scan). Underscore = not a Vercel function.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  NEAR_ORDER_TTL_MS, nearTopupAccount, isNearAccountId, isNearTxHash, encodeNear, formatNear, confirmNearTopup, nearRpcDeps,
  recentIncoming, type NearStore, type NearDeps,
} from './_nearTopup.js'

type Req = { method?: string; body?: Record<string, unknown>; query?: Record<string, string | string[] | undefined> }
type Res = { status(n: number): { json(b: unknown): void } }

export const nearStore = (db: SupabaseClient): NearStore => ({
  async get(h) { const { data } = await db.from('near_topups').select('status,credit_micro,sender').eq('tx_hash', h).maybeSingle(); return data },
  async claim(row) { const { error } = await db.from('near_topups').insert(row); return !error },
})

const orderOut = (o: Record<string, unknown>, receiver: string) => ({
  orderId: o.id, asset: 'NEAR', receiver, sender: o.sender, amountYocto: String(o.yocto), amountLabel: `${formatNear(BigInt(String(o.yocto)))} NEAR`,
  status: o.status, txHash: o.tx_hash ?? null, creditUsd: o.credit_micro == null ? null : Number(o.credit_micro) / 1e6, expiresAt: o.expires_at,
})

export async function nearRoute(req: Req, res: Res, db: SupabaseClient, userId: string | null, deps?: NearDeps) {
  const receiver = nearTopupAccount()
  if (!receiver) return res.status(503).json({ error: 'NEAR top-ups are not live yet' })
  const d = deps ?? nearRpcDeps(nearStore(db))

  if (req.method === 'GET') {
    // ?near=-price: the receiver and the live NEAR/USD price (8 decimals) for the top-up screen. Display only.
    if (req.query?.near === '-price') {
      try { const p = await d.price(); return res.status(200).json({ receiver, price8: p.price8.toString(), updatedAt: p.updatedAt }) } catch (e) { return res.status(503).json({ receiver, error: (e as Error).message }) }
    }
    const sender = String(req.query?.near ?? '').toLowerCase()
    if (!isNearAccountId(sender)) return res.status(400).json({ error: 'bad account' })
    const { data } = await db.from('near_topups').select('tx_hash,credit_micro,credited_at').eq('sender', sender).eq('status', 'credited').order('credited_at', { ascending: false }).limit(50)
    return res.status(200).json({ topups: (data ?? []).map((t) => ({ hash: `near:${t.tx_hash}`, asset: 'NEAR', credit: Number(t.credit_micro) / 1e6, at: t.credited_at })) })
  }

  const body = req.body ?? {}
  const op = String(body.op)
  const credit = async (hash: string, order: Record<string, unknown>) => {
    const r = await confirmNearTopup(d, { hash, sender: String(order.sender), receiver, userId: (order.privy_user_id as string | null) ?? userId, orderId: String(order.id), notBeforeMs: new Date(String(order.created_at)).getTime() - 120_000 })
    if (r.ok && !r.already) await db.from('near_topup_orders').update({ status: 'credited', tx_hash: hash, credit_micro: Math.round(r.creditUsd * 1e6), credited_at: new Date().toISOString(), error: null }).eq('id', order.id)
    else if (!r.ok) await db.from('near_topup_orders').update({ error: r.error }).eq('id', order.id)
    return r
  }
  const loadOrder = async () => {
    const id = String(body.orderId ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null
    const { data } = await db.from('near_topup_orders').select('*').eq('id', id).maybeSingle()
    return data as Record<string, unknown> | null
  }

  if (op === 'near-create') {
    const sender = String(body.sender ?? '').toLowerCase()
    if (!isNearAccountId(sender)) return res.status(400).json({ error: 'connect your NEAR wallet first' })
    if (sender === receiver) return res.status(400).json({ error: 'pay from your own NEAR account' })
    let yocto: bigint
    try { yocto = encodeNear(Number(body.near)) } catch (e) { return res.status(400).json({ error: (e as Error).message }) }
    const row = { privy_user_id: userId, sender, yocto: yocto.toString(), status: 'waiting', expires_at: new Date(Date.now() + NEAR_ORDER_TTL_MS).toISOString() }
    const { data, error } = await db.from('near_topup_orders').insert(row).select('*').single()
    // A missing table (the NEAR top-up migration not run yet) says so, so it can be fixed from the dashboard.
    if (error && /42P01|PGRST205|does not exist|schema cache/i.test(`${error.code ?? ''} ${error.message ?? ''}`)) return res.status(503).json({ error: 'NEAR top-ups are not set up yet: the near_topup_orders table is missing (run supabase/migrations/20261115010000_near_topups.sql)' })
    if (error || !data) return res.status(500).json({ error: 'could not create order' })
    return res.status(200).json(orderOut(data, receiver))
  }

  const order = await loadOrder()
  if (!order) return res.status(404).json({ error: 'order not found' })
  if (order.status === 'credited') return res.status(200).json({ ...orderOut(order, receiver), ok: true, already: true, creditUsd: Number(order.credit_micro ?? 0) / 1e6, txHash: `near:${order.tx_hash}` })
  if (new Date(String(order.expires_at)).getTime() + 2 * 3600_000 < Date.now()) return res.status(410).json({ error: 'order expired; start a new top-up' })

  if (op === 'near-confirm') {
    // The wallet returned the transaction id: verify that exact transaction.
    const hash = String(body.hash ?? '')
    if (!isNearTxHash(hash)) return res.status(400).json({ error: 'bad transaction id' })
    const r = await credit(hash, order)
    if (!r.ok) return res.status(r.code).json({ error: r.error })
    return res.status(200).json({ ...r, txHash: `near:${hash}`, orderId: order.id })
  }

  if (op === 'near-scan') {
    // No tx id from the wallet: look through recent payments to the Grind District account for this sender.
    if (new Date(String(order.expires_at)).getTime() < Date.now()) return res.status(410).json({ error: 'order expired; start a new top-up' })
    const since = new Date(String(order.created_at)).getTime() - 120_000
    const recent = await recentIncoming(receiver).catch(() => [])
    const fresh = recent.filter((t) => isNearTxHash(t.hash) && (t.heightMs ?? Date.now()) >= since).slice(0, 12)
    const used = fresh.length ? await db.from('near_topups').select('tx_hash').in('tx_hash', fresh.map((t) => t.hash)) : { data: [] }
    const taken = new Set((used.data ?? []).map((u: { tx_hash: string }) => u.tx_hash))
    for (const t of fresh) {
      if (taken.has(t.hash)) continue
      const tx = await d.txStatus(t.hash, String(order.sender)).catch(() => null)
      const signer = tx?.transaction?.signer_id
      const sent = (tx?.transaction?.actions ?? []).reduce<bigint>((a, x) => a + BigInt((x as { Transfer?: { deposit?: string } })?.Transfer?.deposit ?? '0'), 0n)
      if (signer !== order.sender || sent !== BigInt(String(order.yocto))) continue
      const r = await credit(t.hash, order)
      if (r.ok) return res.status(200).json({ ...r, txHash: `near:${t.hash}`, orderId: order.id })
    }
    return res.status(200).json({ ...orderOut(order, receiver), ok: false, waiting: true, message: 'Waiting for payment…' })
  }
  return res.status(400).json({ error: 'unknown op' })
}
