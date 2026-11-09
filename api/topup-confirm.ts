import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PrivyClient } from '@privy-io/server-auth'
import { confirmTopup, type Store } from './_grind.js'
import {
  ORDER_TTL_MS, PRESET_USDC, PRESET_MILLI_ETH, encodeUsdcAmount, encodeEthAmount, matchPaymentLogs, pickOrderForPayment, orderPublic,
  TRANSFER_TOPIC, ETH_DEPOSITED, TREASURY, USDC, type ChainLog,
} from './_topupAuto.js'

// Automatic top-up: exact preset amount (e.g. 5 USDC = 5000000) + connected payer address.
// Server finds Transfer/EthDeposited from that payer to the treasury, verifies via confirmTopup, credits once.
// Oldest open order of equal amount wins when the same wallet has several. No decimal matching codes.
type Req = {
  method?: string
  body?: Record<string, unknown>
  query?: Record<string, string | string[] | undefined>
  headers: Record<string, string | undefined>
}
type Res = { status(n: number): { json(b: unknown): void } }

const rpcUrl = () => process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
const topicAddr = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0')

async function rpc(method: string, params: unknown[]): Promise<any> {
  const r = await fetch(rpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = (await r.json()) as { result?: any; error?: { message: string } }
  if (j.error) throw new Error(j.error.message)
  return j.result
}

async function authUserId(headers: Req['headers']): Promise<string | null> {
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const token = (headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!appId || !process.env.PRIVY_APP_SECRET || !token) return null
  try { return (await new PrivyClient(appId, process.env.PRIVY_APP_SECRET).verifyAuthToken(token)).userId } catch { return null }
}

function store(db: SupabaseClient): Store {
  return {
    async get(h) { const { data } = await db.from('topups').select('status,credit_micro').eq('tx_hash', h).maybeSingle(); return data },
    async claim(row) { const { error } = await db.from('topups').insert(row); return !error },
    async update(h, patch) { await db.from('topups').update(patch).eq('tx_hash', h) },
  }
}

async function runConfirm(db: SupabaseClient, hash: `0x${string}`, from: string, userId: string | null, orderId: string | null) {
  const op = process.env.GRIND_OPERATOR_KEY
  if (!op) return { ok: false as const, code: 503, error: 'top-ups are not configured' }
  const r = await confirmTopup({ hash, rpc: rpcUrl(), operatorKey: op as `0x${string}`, store: store(db), userId, from })
  if (!r.ok) return r
  if (orderId) {
    await db.from('topup_orders').update({
      status: 'credited',
      tx_hash: hash,
      player: from.toLowerCase(),
      credit_micro: Math.round(r.creditUsd * 1e6),
      credited_at: new Date().toISOString(),
      error: null,
    }).eq('id', orderId)
  }
  return { ok: true as const, already: r.already, creditUsd: r.creditUsd, asset: r.asset, feeUsd: r.feeUsd, player: r.player, orderId }
}

export default async function handler(req: Req, res: Res) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ error: 'top-ups are not configured' })
  const db = createClient(url, key, { auth: { persistSession: false } })

  if (req.method === 'GET') {
    const orderId = String(req.query?.order ?? '')
    if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) {
      const { data } = await db.from('topup_orders').select('*').eq('id', orderId).maybeSingle()
      if (!data) return res.status(404).json({ error: 'order not found' })
      if (data.status === 'waiting' && new Date(data.expires_at).getTime() < Date.now()) {
        await db.from('topup_orders').update({ status: 'expired' }).eq('id', orderId).eq('status', 'waiting')
        data.status = 'expired'
      }
      return res.status(200).json(orderPublic(data))
    }
    const player = String(req.query?.player ?? '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(player)) return res.status(400).json({ error: 'bad player' })
    const { data } = await db.from('topups').select('tx_hash,asset,credit_micro,credited_at').eq('player', player).eq('status', 'credited').order('credited_at', { ascending: false }).limit(50)
    return res.status(200).json({ topups: (data ?? []).map((t) => ({ hash: t.tx_hash, asset: t.asset, credit: Number(t.credit_micro) / 1e6, at: t.credited_at })) })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const body = req.body ?? {}
  const opName = String(body.op ?? 'confirm')
  const userId = await authUserId(req.headers)

  if (opName === 'create') {
    const asset = String(body.asset ?? 'USDC').toUpperCase() === 'ETH' ? 'ETH' : 'USDC'
    const from = String(body.from ?? '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(from)) return res.status(400).json({ error: 'connect your wallet first' })
    try {
      let amountRaw: bigint
      let tag: string
      if (asset === 'USDC') {
        const dollars = Number(body.dollars)
        if (!PRESET_USDC.includes(dollars as (typeof PRESET_USDC)[number])) return res.status(400).json({ error: 'pick 5, 10, 25, 50 or 100 USDC' })
        amountRaw = encodeUsdcAmount(dollars)
        tag = String(dollars).padStart(6, '0') // legacy column; not used for matching
      } else {
        const milliEth = Number(body.milliEth)
        if (!PRESET_MILLI_ETH.includes(milliEth as (typeof PRESET_MILLI_ETH)[number])) return res.status(400).json({ error: 'pick 0.001, 0.005 or 0.01 ETH' })
        amountRaw = encodeEthAmount(milliEth)
        tag = String(milliEth).padStart(6, '0')
      }
      const row = {
        privy_user_id: userId,
        player: from,
        asset,
        amount_raw: amountRaw.toString(),
        tag,
        status: 'waiting',
        expires_at: new Date(Date.now() + ORDER_TTL_MS).toISOString(),
      }
      const { data, error } = await db.from('topup_orders').insert(row).select('*').single()
      if (error || !data) return res.status(500).json({ error: 'could not create order' })
      return res.status(200).json(orderPublic(data))
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message || 'bad amount' })
    }
  }

  if (opName === 'scan') {
    const orderId = String(body.orderId ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return res.status(400).json({ error: 'bad order' })
    const { data: order } = await db.from('topup_orders').select('*').eq('id', orderId).maybeSingle()
    if (!order) return res.status(404).json({ error: 'order not found' })
    if (order.status === 'credited') return res.status(200).json({ ...orderPublic(order), ok: true, already: true, creditUsd: Number(order.credit_micro ?? 0) / 1e6 })
    if (order.status === 'expired' || (order.status === 'waiting' && new Date(order.expires_at).getTime() < Date.now())) {
      if (order.status === 'waiting') await db.from('topup_orders').update({ status: 'expired' }).eq('id', orderId)
      return res.status(410).json({ error: 'order expired; start a new top-up' })
    }
    const player = String(order.player ?? '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(player)) return res.status(400).json({ error: 'order has no payer wallet' })
    const amountRaw = BigInt(String(order.amount_raw))

    if (order.tx_hash && /^0x[0-9a-f]{64}$/.test(order.tx_hash)) {
      const credited = await runConfirm(db, order.tx_hash as `0x${string}`, player, order.privy_user_id ?? userId, orderId)
      if (!credited.ok) return res.status(credited.code).json({ error: credited.error, detected: true, txHash: order.tx_hash })
      return res.status(200).json({ ...credited, message: 'Credited' })
    }

    const head = parseInt(await rpc('eth_blockNumber', []), 16)
    const createdMs = new Date(order.created_at).getTime()
    const lookback = Math.min(5000, Math.max(80, Math.floor((Date.now() - createdMs) / 1500) + 40))
    const fromBlock = Math.max(0, head - lookback)
    const safeHead = Math.max(fromBlock, head - 2)
    const fromTopic = topicAddr(player)
    const toTopic = topicAddr(TREASURY)
    let logs: ChainLog[] = []
    if (order.asset === 'USDC') {
      logs = (await rpc('eth_getLogs', [{
        address: USDC,
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + safeHead.toString(16),
        topics: [TRANSFER_TOPIC, fromTopic, toTopic],
      }])) as ChainLog[]
    } else {
      logs = (await rpc('eth_getLogs', [{
        address: TREASURY,
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + safeHead.toString(16),
        topics: [ETH_DEPOSITED, fromTopic],
      }])) as ChainLog[]
    }
    const hit = matchPaymentLogs({ logs: logs ?? [], asset: order.asset, amountRaw, from: player })
    if (!hit) return res.status(200).json({ ...orderPublic(order), ok: false, waiting: true, message: 'Waiting for payment…' })

    // Load sibling open orders (same payer + asset + exact amount) and any order already holding this tx.
    const { data: siblings } = await db.from('topup_orders')
      .select('id,created_at,status,tx_hash')
      .eq('player', player)
      .eq('asset', order.asset)
      .eq('amount_raw', amountRaw.toString())
      .in('status', ['waiting', 'detected', 'credited'])
    const openOrders = (siblings ?? []).filter((o) => o.status === 'waiting' || o.status === 'detected')
    const ordersByTx: Record<string, string> = {}
    for (const o of siblings ?? []) {
      if (o.tx_hash) ordersByTx[String(o.tx_hash).toLowerCase()] = o.id
    }
    const pick = pickOrderForPayment({ openOrders, scannedOrderId: orderId, txHash: hit.hash, ordersByTx })
    if (!pick.ok) {
      if (pick.reason === 'tx_taken') {
        return res.status(200).json({ ...orderPublic(order), ok: false, waiting: true, message: 'Waiting for payment…' })
      }
      if (pick.reason === 'not_oldest') {
        // Credit belongs to an older open order — still waiting on this one.
        return res.status(200).json({ ...orderPublic(order), ok: false, waiting: true, message: 'Waiting for payment…' })
      }
      return res.status(200).json({ ...orderPublic(order), ok: false, waiting: true, message: 'Waiting for payment…' })
    }

    // Claim tx on the winning order only if still free (unique tx_hash index).
    const claim = await db.from('topup_orders').update({ status: 'detected', tx_hash: hit.hash })
      .eq('id', pick.orderId)
      .in('status', ['waiting', 'detected'])
      .is('tx_hash', null)
    // If unique constraint fails because another row got the hash, treat as taken.
    void claim

    const { data: winner } = await db.from('topup_orders').select('*').eq('id', pick.orderId).maybeSingle()
    if (winner?.tx_hash && winner.tx_hash.toLowerCase() !== hit.hash) {
      return res.status(200).json({ ...orderPublic(order), ok: false, waiting: true, message: 'Waiting for payment…' })
    }
    if (!winner?.tx_hash) {
      // Race: set explicitly; unique index rejects double claim.
      const { error: claimErr } = await db.from('topup_orders').update({ status: 'detected', tx_hash: hit.hash }).eq('id', pick.orderId)
      if (claimErr) return res.status(200).json({ ...orderPublic(order), ok: false, waiting: true, message: 'Waiting for payment…' })
    }

    const credited = await runConfirm(db, hit.hash as `0x${string}`, player, (winner ?? order).privy_user_id ?? userId, pick.orderId)
    if (!credited.ok) {
      await db.from('topup_orders').update({ error: credited.error }).eq('id', pick.orderId)
      return res.status(credited.code).json({ error: credited.error, detected: true, txHash: hit.hash, message: 'Payment detected…' })
    }
    // If we credited a different (older) order, report waiting for the scanned one unless it's the same.
    if (pick.orderId !== orderId) {
      return res.status(200).json({ ...orderPublic(order), ok: false, waiting: true, message: 'Waiting for payment…' })
    }
    return res.status(200).json({ ...credited, message: 'Credited' })
  }

  const hash = String(body.hash ?? '')
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return res.status(400).json({ error: 'bad hash' })
  const from = String(body.from ?? '')
  if (!/^0x[0-9a-fA-F]{40}$/.test(from)) return res.status(400).json({ error: 'connect the wallet you paid from' })
  const orderId = body.orderId ? String(body.orderId) : null
  if (orderId) {
    const { data: order } = await db.from('topup_orders').select('*').eq('id', orderId).maybeSingle()
    if (!order) return res.status(404).json({ error: 'order not found' })
    if (order.status === 'credited') {
      return res.status(200).json({ ok: true, already: true, creditUsd: Number(order.credit_micro ?? 0) / 1e6, asset: order.asset, orderId })
    }
    // Bind payer + hash; unique tx_hash prevents two orders claiming one payment.
    const { error: bindErr } = await db.from('topup_orders').update({
      status: 'detected',
      tx_hash: hash.toLowerCase(),
      player: from.toLowerCase(),
    }).eq('id', orderId).in('status', ['waiting', 'detected'])
    if (bindErr) return res.status(409).json({ error: 'this payment is already linked to another top-up' })
  }
  const r = await runConfirm(db, hash.toLowerCase() as `0x${string}`, from, userId, orderId)
  if (!r.ok) return res.status(r.code).json({ error: r.error })
  res.status(200).json(r)
}
