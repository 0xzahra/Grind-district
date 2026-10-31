import { createClient } from '@supabase/supabase-js'
import { PrivyClient } from '@privy-io/server-auth'
import { confirmTopup, type Store } from './_grind.js'

// POST { hash }: verify a GrindLedger TopUp on Base and credit the player as operator (GRIND_OPERATOR_KEY, server-only).
// GET ?player=0x..: the player's credited top-ups (for refreshing the in-game balance).
type Req = { method?: string; body?: { hash?: string }; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | undefined> }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const op = process.env.GRIND_OPERATOR_KEY
  if (!url || !key || !op) return res.status(503).json({ error: 'top-ups are not configured' })
  const db = createClient(url, key, { auth: { persistSession: false } })
  if (req.method === 'GET') {
    const player = String(req.query?.player ?? '').toLowerCase()
    if (!/^0x[0-9a-f]{40}$/.test(player)) return res.status(400).json({ error: 'bad player' })
    const { data } = await db.from('topups').select('tx_hash,asset,credit_micro,credited_at').eq('player', player).eq('status', 'credited').order('credited_at', { ascending: false }).limit(50)
    return res.status(200).json({ topups: (data ?? []).map((t) => ({ hash: t.tx_hash, asset: t.asset, credit: Number(t.credit_micro) / 1e6, at: t.credited_at })) })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const hash = String(req.body?.hash ?? '')
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return res.status(400).json({ error: 'bad hash' })
  let userId: string | null = null
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (appId && process.env.PRIVY_APP_SECRET && token) {
    try { userId = (await new PrivyClient(appId, process.env.PRIVY_APP_SECRET).verifyAuthToken(token)).userId } catch { userId = null }
  }
  const store: Store = {
    async get(h) { const { data } = await db.from('topups').select('status,credit_micro').eq('tx_hash', h).maybeSingle(); return data },
    async claim(row) { const { error } = await db.from('topups').insert(row); return !error },
    async update(h, patch) { await db.from('topups').update(patch).eq('tx_hash', h) },
  }
  const r = await confirmTopup({ hash: hash.toLowerCase() as `0x${string}`, rpc: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org', operatorKey: op as `0x${string}`, store, userId })
  if (!r.ok) return res.status(r.code).json({ error: r.error })
  res.status(200).json(r)
}
