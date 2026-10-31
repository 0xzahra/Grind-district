import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import rewardWallet from './_rewardWallet.js'

// POST { name, rank, reputation, balance, skills } with a Privy token: upsert the caller's public share-card snapshot.
// The username comes from the server's players row, never from the client.
type Req = { method?: string; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | undefined>; body?: Record<string, unknown> }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (req.query?.op === 'reward-wallet') return rewardWallet(req, res)
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
  } as Record<string, unknown>
  // Character look (height, build, hair colour) rides along so it follows the account across devices.
  const lk = b.look as { h?: unknown; b?: unknown; hair?: unknown; skin?: unknown } | undefined
  const col = (v: unknown) => v == null ? null : Math.max(0, Math.min(0xffffff, Math.round(Number(v) || 0)))
  const prev = await db.from('public_profiles').select('look').eq('username', p.data.username).maybeSingle()
  const old = (prev?.data?.look ?? {}) as Record<string, unknown>
  if (lk && typeof lk === 'object') row.look = { ...old, h: Math.max(0.92, Math.min(1.08, Number(lk.h) || 1)), b: Math.max(0.9, Math.min(1.15, Number(lk.b) || 1)), hair: col(lk.hair), skin: col(lk.skin) }
  // Daily check-in streak rides in the same jsonb (no schema change). Keep whichever record is newer.
  const lx = b.lux as { last?: unknown; streak?: unknown; best?: unknown } | undefined
  if (lx && typeof lx === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(lx.last ?? ''))) {
    const cur = { last: String(lx.last), streak: Math.round(n(lx.streak, 10000)), best: Math.round(n(lx.best, 10000)) }
    const was = old.lux as { last?: string } | undefined
    const base = (row.look ?? old) as Record<string, unknown>
    row.look = { ...base, lux: was?.last && was.last > cur.last ? was : cur }
  }
  const { error } = await db.from('public_profiles').upsert(row, { onConflict: 'username' })
  if (error) return res.status(500).json({ error: 'save failed' })
  res.status(200).json({ ok: true, username: row.username, look: row.look ?? old ?? null })
}
