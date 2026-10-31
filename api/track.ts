import { createClient } from '@supabase/supabase-js'

// Accepts batched client events and inserts them with the service role. 202 no-op until env vars exist.
const NAMES = new Set(['first_visit', 'session_start', 'signup', 'course_start', 'course_complete', 'cert_shared', 'cv_shared', 'share_click', 'transfer', 'topup_attempt'])
type Req = { method?: string; body?: { events?: Array<Record<string, unknown>> } }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(202).json({ stored: 0, note: 'tracking not configured' })
  const rows = (req.body?.events ?? []).slice(0, 200).filter((e) => NAMES.has(String(e.name))).map((e) => ({
    name: String(e.name),
    anon_id: String(e.anon_id ?? '').slice(0, 64),
    session_id: String(e.session_id ?? '').slice(0, 64),
    props: typeof e.props === 'object' && e.props ? e.props : {},
    client_at: typeof e.at === 'string' ? e.at : null,
  }))
  if (!rows.length) return res.status(200).json({ stored: 0 })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await db.from('events').insert(rows)
  if (error) return res.status(500).json({ error: 'insert failed' })
  res.status(200).json({ stored: rows.length })
}
