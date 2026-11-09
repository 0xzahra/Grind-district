import { findRecentPayment } from './_grind.js'

// GET ?from=0x..: looks for a recent USDC/ETH payment from this address straight to the GrindTreasury vault
// on Base, so the top-up sheet can auto-detect the player's payment instead of asking them to find and paste
// their own transaction hash. Read-only: it only reports a hash. /api/topup-confirm still does the real
// verification (network, token, recipient, amount, finality) and the idempotent credit.
type Req = { method?: string; query?: Record<string, string | string[] | undefined> }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (req.method && req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const rpc = process.env.BASE_RPC_URL
  if (!rpc) return res.status(503).json({ error: 'top-ups are not configured' })
  const from = String(req.query?.from ?? '').toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(from)) return res.status(400).json({ error: 'bad address' })
  try {
    const found = await findRecentPayment({ rpc, from: from as `0x${string}` })
    return res.status(200).json({ hash: found?.hash ?? null })
  } catch {
    return res.status(200).json({ hash: null }) // a flaky RPC call should never block the manual-hash fallback
  }
}
