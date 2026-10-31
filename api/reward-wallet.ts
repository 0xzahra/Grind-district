import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { getAddress } from 'viem'

// Private rewards wallet (Base). GET / POST { address } / DELETE with a Privy token. Only the caller's own row; never public.
type Req = { method?: string; headers: Record<string, string | undefined>; body?: Record<string, unknown> }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method ?? '')) return res.status(405).json({ error: 'method' })
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const secret = process.env.PRIVY_APP_SECRET, url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!appId || !secret || !url || !key) return res.status(503).json({ error: 'not configured' })
  let userId: string
  try { userId = (await new PrivyClient(appId, secret).verifyAuthToken((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))).userId } catch { return res.status(401).json({ error: 'sign in' }) }
  const db = createClient(url, key, { auth: { persistSession: false } })
  if (req.method === 'GET') {
    const r = await db.from('reward_wallets').select('address').eq('privy_user_id', userId).maybeSingle()
    if (r.error) return res.status(500).json({ error: 'read failed' })
    return res.status(200).json({ address: r.data?.address ?? null })
  }
  if (req.method === 'DELETE') {
    const { error } = await db.from('reward_wallets').delete().eq('privy_user_id', userId)
    if (error) return res.status(500).json({ error: 'delete failed' })
    return res.status(200).json({ ok: true })
  }
  const raw = String(req.body?.address ?? '').trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) return res.status(400).json({ error: 'invalid address' })
  let address: string
  try { address = getAddress(raw) } catch { return res.status(400).json({ error: 'bad checksum' }) }
  const { error } = await db.from('reward_wallets').upsert({ privy_user_id: userId, address, updated_at: new Date().toISOString() }, { onConflict: 'privy_user_id' })
  if (error) return res.status(500).json({ error: 'save failed' })
  res.status(200).json({ ok: true, address })
}
