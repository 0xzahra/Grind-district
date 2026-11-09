import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import rewardWallet from './_rewardWallet.js'
import { createHash, randomBytes } from 'node:crypto'
import { nearUserId, verifyNearLogin, type NearProof } from './_nearAuth.js'

// POST with a Privy Bearer token or a NEP-413 NEAR proof: upsert the caller's public share-card / progress.
// The username comes from the server's players row, never from the client.
type Req = { method?: string; query?: Record<string, string | string[] | undefined>; headers: Record<string, string | undefined>; body?: Record<string, unknown> & { near?: NearProof } }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (req.query?.op === 'reward-wallet') return rewardWallet(req, res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ error: 'not configured' })
  let userId: string
  if (req.body?.near) {
    const v = verifyNearLogin(req.body.near)
    if (!v.ok) return res.status(401).json({ error: v.error })
    userId = nearUserId(v.accountId)
  } else {
    const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
    const secret = process.env.PRIVY_APP_SECRET
    if (!appId || !secret) return res.status(503).json({ error: 'not configured' })
    try { userId = (await new PrivyClient(appId, secret).verifyAuthToken((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))).userId } catch { return res.status(401).json({ error: 'sign in' }) }
  }
  const db = createClient(url, key, { auth: { persistSession: false } })
  const p = await db.from('players').select('username').eq('privy_user_id', userId).maybeSingle()
  if (!p.data) return res.status(404).json({ error: 'claim a username first' })
  if (req.query?.op === 'grant') {
    // One-time grants per Privy account. Insert-if-absent: fresh=true only the first time (idempotent).
    const id = String(req.body?.id ?? '')
    const START: Record<string, number> = { shrimp: 1000, crab: 500, fish: 1000, dolphin: 1500, shark: 2500, whale: 3500 }
    const amount = id === 'signup' ? 1000 : id.startsWith('start:') ? START[id.slice(6)] : undefined
    if (amount === undefined) return res.status(400).json({ error: 'unknown grant' })
    const ins = await db.from('player_grants').upsert({ privy_user_id: userId, grant_id: id, amount }, { onConflict: 'privy_user_id,grant_id', ignoreDuplicates: true }).select('grant_id')
    if (ins.error) return res.status(503).json({ error: 'grants unavailable', fresh: false })
    return res.status(200).json({ fresh: (ins.data ?? []).length === 1, amount })
  }
  if (req.query?.op === 'progress') {
    // Server copy of the save (local stays the source of truth): last write wins, 256 KB cap.
    const raw = JSON.stringify(req.body?.save ?? null)
    if (!req.body?.save || raw.length > 262_144) return res.status(400).json({ error: 'bad save' })
    const up = await db.from('player_progress').upsert({ privy_user_id: userId, save: req.body.save, updated_at: new Date().toISOString() }, { onConflict: 'privy_user_id' })
    return up.error ? res.status(503).json({ error: 'progress sync unavailable' }) : res.status(200).json({ ok: true })
  }
  if (req.query?.op === 'agent-code') {
    // One-time code (30 min) the player's AI agent sends to /api/agent-register to link itself to this profile.
    const code = `gdc_${randomBytes(9).toString('base64url')}`
    const prev = await db.from('public_profiles').select('look').eq('username', p.data.username).maybeSingle()
    const look = { ...((prev.data?.look ?? {}) as Record<string, unknown>), agentClaim: { h: createHash('sha256').update(code).digest('hex'), exp: Date.now() + 30 * 60_000 } }
    const up = prev.data
      ? await db.from('public_profiles').update({ look }).eq('username', p.data.username)
      : await db.from('public_profiles').insert({ username: p.data.username, privy_user_id: userId, look })
    if (up.error) return res.status(500).json({ error: 'could not create code' })
    return res.status(200).json({ code, username: p.data.username, agent: (prev.data?.look as { agent?: unknown } | undefined)?.agent ?? null })
  }
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
  if (lk && typeof lk === 'object') row.look = { ...old, h: Math.max(0.92, Math.min(1.08, Number(lk.h) || 1)), b: Math.max(0.9, Math.min(1.15, Number(lk.b) || 1)), hair: col(lk.hair), skin: col(lk.skin), lip: col((lk as { lip?: unknown }).lip), blush: col((lk as { blush?: unknown }).blush) }
  // Daily check-in streak rides in the same jsonb (no schema change). Keep whichever record is newer.
  const lx = b.lux as { last?: unknown; streak?: unknown; best?: unknown } | undefined
  if (lx && typeof lx === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(lx.last ?? ''))) {
    const cur = { last: String(lx.last), streak: Math.round(n(lx.streak, 10000)), best: Math.round(n(lx.best, 10000)) }
    const was = old.lux as { last?: string } | undefined
    const base = (row.look ?? old) as Record<string, unknown>
    row.look = { ...base, lux: was?.last && was.last > cur.last ? was : cur }
  }
  // Career job title (e.g. Influencer / Community manager) rides in look jsonb — no schema change.
  if (typeof b.job === 'string') {
    const base = (row.look ?? old) as Record<string, unknown>
    const title = b.job.trim().slice(0, 48)
    row.look = title ? { ...base, job: title } : { ...base, job: null }
  }
  const { error } = await db.from('public_profiles').upsert(row, { onConflict: 'username' })
  if (error) return res.status(500).json({ error: 'save failed' })
  res.status(200).json({ ok: true, username: row.username, look: row.look ?? old ?? null })
}
