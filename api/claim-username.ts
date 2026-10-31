import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'
import { cleanUsername } from './_username.js'
import { ensureWallet } from './_wallet.js'

type Req = { method?: string; headers: Record<string, string | undefined>; body?: { username?: string } }
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
  const c = cleanUsername(req.body?.username)
  if (!c.ok) return res.status(400).json({ error: c.reason })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const existing = await db.from('players').select('username').eq('privy_user_id', userId).maybeSingle()
  if (existing.data) {
    await ensureWallet(db, userId)
    return res.status(200).json({ username: existing.data.username, userId })
  }
  const { error } = await db.from('players').insert({ privy_user_id: userId, username: c.name })
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Taken' : 'Could not save' })
  await ensureWallet(db, userId) // in-game wallet record on sign-up; no keys involved
  res.status(200).json({ username: c.name, userId })
}
