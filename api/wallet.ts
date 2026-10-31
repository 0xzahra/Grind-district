import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { ensureWallet } from './_wallet.js'

// GET: the signed-in player's in-game wallet, deposit address (env DEPOSIT_ADDRESS) and deposit tag.
type Req = { method?: string; headers: Record<string, string | undefined> }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  const depositAddress = /^0x[0-9a-fA-F]{40}$/.test(process.env.DEPOSIT_ADDRESS ?? '') ? process.env.DEPOSIT_ADDRESS : null
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const secret = process.env.PRIVY_APP_SECRET
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!appId || !secret || !url || !key) return res.status(200).json({ configured: false, depositAddress })
  let userId: string
  try {
    userId = (await new PrivyClient(appId, secret).verifyAuthToken((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))).userId
  } catch {
    return res.status(401).json({ error: 'Sign in again' })
  }
  const db = createClient(url, key, { auth: { persistSession: false } })
  const wallet = await ensureWallet(db, userId)
  const ledger = await db.from('wallet_ledger').select('amount,kind,ref,created_at').eq('privy_user_id', userId).order('created_at', { ascending: false }).limit(20)
  res.status(200).json({ configured: true, depositAddress, chain: 'base', token: 'USDC', wallet, ledger: ledger.data ?? [] })
}
