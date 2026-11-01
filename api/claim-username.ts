import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { cleanUsername } from './_username.js'
import { ensureWallet } from './_wallet.js'

type Req = { method?: string; headers: Record<string, string | undefined>; body?: { username?: string; ref?: string } }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const secret = process.env.PRIVY_APP_SECRET
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!appId || !secret || !url || !key) return res.status(503).json({ error: 'not configured' })
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  let userId: string
  try {
    userId = (await new PrivyClient(appId, secret).verifyAuthToken(token)).userId
  } catch {
    return res.status(401).json({ error: 'Sign in again' })
  }
  const db = createClient(url, key, { auth: { persistSession: false } })
  // One username per Privy account, bound server-side. An account that already has one always gets it back
  // (whatever was typed); an empty body is the "who am I" check after sign-in.
  const existing = await db.from('players').select('username').eq('privy_user_id', userId).maybeSingle()
  if (existing.data) {
    await ensureWallet(db, userId)
    const prog = await db.from('player_progress').select('save,updated_at').eq('privy_user_id', userId).maybeSingle()
    return res.status(200).json({ username: existing.data.username, userId, save: prog.error ? null : prog.data?.save ?? null })
  }
  if (!req.body?.username) return res.status(200).json({ username: null, userId })
  const c = cleanUsername(req.body?.username)
  if (!c.ok) return res.status(400).json({ error: c.reason })
  const { error } = await db.from('players').insert({ privy_user_id: userId, username: c.name })
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Taken' : 'Could not save' })
  await ensureWallet(db, userId) // in-game wallet record on sign-up; no keys involved
  // Referral: only usernames are stored; inviter must be a real, different player.
  let invitedBy: string | null = null
  const ref = cleanUsername(req.body?.ref)
  if (ref.ok && ref.name !== c.name) {
    const inviter = await db.from('players').select('username').ilike('username', ref.name).maybeSingle()
    if (inviter.data) {
      const ins = await db.from('referrals').insert({ invitee_username: c.name, inviter_username: inviter.data.username })
      if (!ins.error) invitedBy = inviter.data.username
    }
  }
  res.status(200).json({ username: c.name, userId, invitedBy })
}
