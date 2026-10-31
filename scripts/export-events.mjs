// Export Supabase events to CSV for a Dune upload.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/export-events.mjs [since-ISO] > events.csv
import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const since = process.argv[2] ?? '1970-01-01'
const db = createClient(url, key, { auth: { persistSession: false } })
const cols = ['id', 'name', 'anon_id', 'session_id', 'src', 'ref', 'utm_source', 'utm_campaign', 'props', 'created_at']
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
console.log(cols.join(','))
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('events').select('*').gte('created_at', since).order('id').range(from, from + 999)
  if (error) { console.error(error.message); process.exit(1) }
  for (const e of data) {
    const p = e.props ?? {}
    console.log([e.id, e.name, e.anon_id, e.session_id, p.src, p.ref, p.utm_source, p.utm_campaign, JSON.stringify(p), e.created_at].map(q).join(','))
  }
  if (data.length < 1000) break
}
