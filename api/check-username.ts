import { createClient } from '@supabase/supabase-js'
import { cleanUsername } from './_username.js'

export default async function handler(req: { query: Record<string, string> }, res: { status(n: number): { json(b: unknown): void } }) {
  const c = cleanUsername(req.query.u)
  if (!c.ok) return res.status(200).json({ available: false, reason: c.reason })
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ error: 'not configured' })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await db.from('players').select('id').ilike('username', c.name).limit(1)
  if (error) return res.status(500).json({ error: 'lookup failed' })
  res.status(200).json({ available: data.length === 0, reason: data.length ? 'Taken' : '' })
}
