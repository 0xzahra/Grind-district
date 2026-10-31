import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'

// POST { name, rank, reputation, balance, skills } with a Privy token: upsert the caller's public share-card snapshot.
// The username comes from the server's players row, never from the client.
type Req = { method?: string; headers: Record<string, string | undefined>; body?: Record<string, unknown> }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const secret = process.env.PRIVY_APP_SECRET, url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!appId || !secret || !url || !key) return res.status(503).json({ error: 'not configured' })
  let userId: string
  try { userId = (await new PrivyClient(appId, secret).verifyAuthToken((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))).userId } catch { return res.status(401).json({ error: 'sign in' }) }
  const db = createClient(url, key, { auth: { persistSession: false } })
  const p = await db.from('players').select('username').eq('privy_user_id', userId).maybeSingle()
  if (!p.data) return res.status(404).json({ error: 'claim a username first' })
  const b = req.body ?? {}
  const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0))
  const row = {
    username: p.data.username, privy_user_id: userId,
    name: String(b.name ?? '').slice(0, 40), rank: String(b.rank ?? '').slice(0, 24),
    reputation: Math.round(n(b.reputation, 1_000_000)), balance: Math.round(n(b.balance, 1e11) * 100) / 100,
    skills: Array.isArray(b.skills) ? b.skills.slice(0, 12).map((s) => String(s).slice(0, 60)) : [],
    pinned: Array.isArray(b.pinned) ? b.pinned.slice(0, 3).map((s) => String(s).slice(0, 60)) : [],
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('public_profiles').upsert(row, { onConflict: 'username' })
  if (error) return res.status(500).json({ error: 'save failed' })
  res.status(200).json({ ok: true, username: row.username })
}
