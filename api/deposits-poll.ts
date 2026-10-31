import { createClient } from '@supabase/supabase-js'

// Cron/API: reads incoming USDC transfers on Base to DEPOSIT_ADDRESS and credits the matching player.
// DISABLED until DEPOSIT_ADDRESS, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (and DEPOSITS_ENABLED=1).
// Matching: the last 6 decimals of the USDC amount are the player's deposit_tag (e.g. 25.123456 -> tag 123456).
// Idempotent: wallet_ledger has a unique (tx_hash, log_index). No keys are held; this only reads the chain.
const USDC = '0x833589fCD6eDb6E08f4c7f8d3feE58D57d2CF8b9'
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(_req: unknown, res: Res) {
  const to = process.env.DEPOSIT_ADDRESS ?? ''
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (process.env.DEPOSITS_ENABLED !== '1' || !/^0x[0-9a-fA-F]{40}$/.test(to) || !url || !key) return res.status(503).json({ error: 'deposits disabled' })
  const rpc = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
  const call = async (method: string, params: unknown[]) =>
    ((await (await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()) as { result: any }).result
  const db = createClient(url, key, { auth: { persistSession: false } })
  const head = parseInt(await call('eth_blockNumber', []), 16)
  const cursor = await db.from('deposit_cursor').select('block').eq('id', 1).maybeSingle()
  const from = Math.max((cursor.data?.block ?? head - 2000) + 1, head - 5000)
  const safeHead = head - 3 // a few confirmations
  if (from > safeHead) return res.status(200).json({ credited: 0 })
  const logs = (await call('eth_getLogs', [{ address: USDC, fromBlock: '0x' + from.toString(16), toBlock: '0x' + safeHead.toString(16), topics: [TRANSFER, null, '0x' + to.slice(2).toLowerCase().padStart(64, '0')] }])) as Array<{ data: string; transactionHash: string; logIndex: string }>
  const rate = Number(process.env.TOPUP_RATE ?? '1') // in-game $ per USDC
  let credited = 0
  for (const log of logs ?? []) {
    const raw = BigInt(log.data)
    const tag = String(raw % 1000000n).padStart(6, '0')
    const w = await db.from('wallets').select('privy_user_id').eq('deposit_tag', tag).maybeSingle()
    if (!w.data) continue
    const amount = (Number(raw) / 1e6) * rate
    const ins = await db.from('wallet_ledger').insert({ privy_user_id: w.data.privy_user_id, amount, kind: 'deposit', ref: log.transactionHash, tx_hash: log.transactionHash, log_index: parseInt(log.logIndex, 16) })
    if (ins.error) continue // duplicate -> already credited
    await db.rpc('wallet_credit', { p_user: w.data.privy_user_id, p_amount: amount })
    credited += 1
  }
  await db.from('deposit_cursor').upsert({ id: 1, block: safeHead })
  res.status(200).json({ credited, scanned: logs?.length ?? 0 })
}
