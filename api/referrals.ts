import { createClient } from '@supabase/supabase-js'
import { cleanUsername } from './_username.js'

type Req = { method?: string; query?: Record<string, string | string[] | undefined> }
type Res = { status(n: number): { json(b: unknown): void }; setHeader(k: string, v: string): void }

// Public: usernames who joined via @u's invite link. Usernames only.
export default async function handler(req: Req, res: Res) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ joined: [] })
  const c = cleanUsername(req.query?.u)
  if (!c.ok) return res.status(400).json({ joined: [] })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await db.from('referrals').select('invitee_username').ilike('inviter_username', c.name).order('created_at', { ascending: false }).limit(50)
  res.setHeader('cache-control', 'public, max-age=30')
  res.status(200).json({ joined: (data ?? []).map((r: { invitee_username: string }) => r.invitee_username) })
}
