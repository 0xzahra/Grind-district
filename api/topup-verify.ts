// STUB, DISABLED: verifies a Base top-up tx and would credit in-game money. Returns 503 unless TOPUP_VERIFY_ENABLED=1.
// Flow: player pays VITE_TOPUP_ADDRESS (or GrindLedger.topUp) from their wallet -> client posts { hash } here ->
// this reads the receipt from Base RPC, checks to/value/confirmations, and (once enabled) credits at TOPUP_RATE.
type Req = { method?: string; body?: { hash?: string } }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (process.env.TOPUP_VERIFY_ENABLED !== '1') return res.status(503).json({ error: 'top-up crediting is not enabled yet' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const hash = String(req.body?.hash ?? '')
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return res.status(400).json({ error: 'bad hash' })
  const to = (process.env.TOPUP_ADDRESS ?? process.env.VITE_TOPUP_ADDRESS ?? '').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(to)) return res.status(503).json({ error: 'no top-up address' })
  const rpc = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
  const call = async (method: string, params: unknown[]) =>
    ((await (await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()) as { result: Record<string, string> | null }).result
  const tx = await call('eth_getTransactionByHash', [hash])
  const receipt = await call('eth_getTransactionReceipt', [hash])
  if (!tx || !receipt || receipt.status !== '0x1') return res.status(409).json({ error: 'not confirmed' })
  if ((tx.to ?? '').toLowerCase() !== to) return res.status(400).json({ error: 'wrong recipient' })
  const wei = BigInt(tx.value ?? '0x0')
  const rate = Number(process.env.TOPUP_RATE ?? '0') // in-game units per 1 ETH
  const credit = Number(wei) / 1e18 * rate
  // TODO when enabled: record hash once in Supabase (unique), then add `credit` to the player's server-side balance.
  res.status(200).json({ ok: true, from: tx.from, wei: wei.toString(), credit, credited: false })
}
