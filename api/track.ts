import { createClient } from '@supabase/supabase-js'

// Accepts batched client events and inserts them with the service role. 202 no-op until env vars exist.
const NAMES = new Set(['first_visit', 'session_start', 'signup', 'course_start', 'course_complete', 'cert_shared', 'cert_minted', 'cv_shared', 'share_click', 'transfer', 'topup_attempt'])
type Req = { method?: string; query?: Record<string, string | string[] | undefined>; body?: { events?: Array<Record<string, unknown>> } }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  if (req.method === 'GET' && req.query?.op === 'stats') {
    // Public aggregate stats (no identities): registered players, visitors active today (Lagos day), agents seen.
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return res.status(503).json({ error: 'not configured' })
    const db = createClient(url, key, { auth: { persistSession: false } })
    const now = new Date(Date.now() + 3600_000) // Africa/Lagos
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3600_000).toISOString()
    const [players, today, agents] = await Promise.all([
      db.from('players').select('id', { count: 'exact', head: true }),
      db.from('events').select('anon_id').gte('created_at', since).in('name', ['session_start', 'first_visit']).limit(5000),
      db.from('agents').select('id', { count: 'exact', head: true }).gte('last_seen', new Date(Date.now() - 5 * 60_000).toISOString()),
    ])
    const active = new Set((today.data ?? []).map((r) => r.anon_id as string).filter(Boolean)).size
    ;(res as unknown as { setHeader?: (k: string, v: string) => void }).setHeader?.('cache-control', 'public, max-age=60')
    return res.status(200).json({ registered: players.count ?? 0, activeToday: active, agentsOnline: agents.count ?? 0 })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const url = process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !(service || anon)) return res.status(202).json({ stored: 0, note: 'tracking not configured' })
  const rows = (req.body?.events ?? []).slice(0, 200).filter((e) => NAMES.has(String(e.name))).map((e) => ({
    name: String(e.name),
    anon_id: String(e.anon_id ?? '').slice(0, 64),
    session_id: String(e.session_id ?? '').slice(0, 64),
    props: typeof e.props === 'object' && e.props ? e.props : {},
    client_at: typeof e.at === 'string' ? e.at : null,
  }))
  if (!rows.length) return res.status(200).json({ stored: 0 })
  if (service) {
    const db = createClient(url, service, { auth: { persistSession: false } })
    const { error } = await db.from('events').insert(rows)
    if (error) return res.status(500).json({ error: 'insert failed' })
    return res.status(200).json({ stored: rows.length })
  }
  // No service key: the validated SECURITY DEFINER function track_events (events table stays RLS-closed).
  const db = createClient(url, anon!, { auth: { persistSession: false } })
  const { data, error } = await db.rpc('track_events', { p_events: rows.map((r) => ({ ...r, at: r.client_at })) })
  if (error) return res.status(500).json({ error: 'insert failed' })
  res.status(200).json({ stored: data ?? 0 })
}
