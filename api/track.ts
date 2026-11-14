import { createClient } from '@supabase/supabase-js'
import { stocksHandler } from './_stocks.js'
import { STATS_EVENT_NAMES, collectPublicStats, publicEventProps } from './_stats.js'

// Accepts batched client events and inserts them with the service role. 202 no-op until env vars exist.
const NAMES = new Set<string>(STATS_EVENT_NAMES)
type Req = { method?: string; query?: Record<string, string | string[] | undefined>; body?: { events?: Array<Record<string, unknown>> } }
type Res = { status(n: number): { json(b: unknown): void } }

export default async function handler(req: Req, res: Res) {
  // The tokenized stock list for the Stockholders' Club (/api/stocks rewrites here; see _stocks.ts).
  if (req.query?.op === 'stocks') return stocksHandler(req, res)
  if (req.method === 'GET' && req.query?.op === 'stats') {
    // Public aggregate stats only (no identities). Cached briefly; mint and Privy reads are cached longer.
    const out = await collectPublicStats()
    if ('error' in out) return res.status(out.status).json({ error: out.error })
    ;(res as unknown as { setHeader?: (k: string, v: string) => void }).setHeader?.('cache-control', 'public, max-age=30')
    return res.status(200).json(out)
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
    props: publicEventProps(String(e.name), (typeof e.props === 'object' && e.props ? e.props : {}) as Record<string, unknown>),
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
