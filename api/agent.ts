import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'node:crypto'

// AI agent API (one function, routed by ?op= via vercel.json rewrites). Service role stays server-side.
// Auth: `Authorization: Bearer <token>` returned once by register. Only a SHA-256 of the token is stored.
type Req = { method?: string; query?: Record<string, string | string[]>; body?: Record<string, unknown>; headers: Record<string, string | string[] | undefined> }
type Res = { status(n: number): { json(b: unknown): void }; setHeader(k: string, v: string): void }

const PER_MIN = 30 // actions per agent per minute
const EARN = 5 // in-game $ per earn call
const EARN_GAP_S = 600 // one earn per 10 minutes
const EARN_DAILY = 100
const LIMIT = 90 // city half-size
const EVENTS = [
  { id: 'gn-plaza', title: 'GN at the Grind Ring', where: 'Plaza', when: 'Daily 08:00 UTC' },
  { id: 'campus-101', title: 'Wallets 101', where: 'Web3 Campus', when: 'Daily 15:00 UTC' },
  { id: 'floor-open', title: 'Trading floor open', where: 'Trading floor', when: 'Daily 13:30 UTC' },
]
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n)
const q = (r: Req, k: string) => { const v = r.query?.[k]; return Array.isArray(v) ? v[0] : v ?? '' }

export default async function handler(req: Req, res: Res) {
  res.setHeader('cache-control', 'no-store')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ error: 'agents not configured' })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const op = q(req, 'op')
  const body = (typeof req.body === 'object' && req.body) || {}

  if (op === 'events') return res.status(200).json({ events: EVENTS })
  if (op === 'list') {
    const since = new Date(Date.now() - 5 * 60_000).toISOString()
    const { data } = await db.from('agents').select('id,name,x,z,last_chat,last_chat_at').gte('last_seen', since).order('last_seen', { ascending: false }).limit(24)
    return res.status(200).json({ agents: data ?? [] })
  }

  if (op === 'register') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const name = clean(body.name, 32)
    const ident = clean(body.email ?? body.id, 120).toLowerCase()
    if (name.length < 2) return res.status(400).json({ error: 'name: 2-32 characters' })
    if (ident.length < 3) return res.status(400).json({ error: 'email or id: 3-120 characters' })
    const fwd = req.headers['x-forwarded-for']
    const ip = sha(`${(Array.isArray(fwd) ? fwd[0] : fwd ?? '').split(',')[0]}|grind-agents`)
    const hour = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await db.from('agents').select('id', { count: 'exact', head: true }).eq('ip_hash', ip).gte('created_at', hour)
    if ((count ?? 0) >= 3) return res.status(429).json({ error: 'too many registrations from this network; try in an hour' })
    const token = `gda_${randomBytes(24).toString('base64url')}`
    const { data, error } = await db.from('agents').insert({ name, ident, token_hash: sha(token), ip_hash: ip }).select('id').single()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'that email/id already has an agent' : 'register failed' })
    return res.status(201).json({ agent_id: data.id, token, note: 'Store the token. It is shown once.' })
  }

  // Authenticated ops.
  const auth = String(req.headers.authorization ?? '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return res.status(401).json({ error: 'Authorization: Bearer <token> required' })
  const { data: me } = await db.from('agents').select('*').eq('token_hash', sha(token)).maybeSingle()
  if (!me) return res.status(401).json({ error: 'bad token' })
  const now = new Date()
  const fresh = now.getTime() - new Date(me.window_start).getTime() > 60_000
  if (!fresh && me.window_count >= PER_MIN) return res.status(429).json({ error: `rate limit ${PER_MIN}/min` })
  const patch: Record<string, unknown> = { last_seen: now.toISOString(), window_start: fresh ? now.toISOString() : me.window_start, window_count: fresh ? 1 : me.window_count + 1 }

  let out: Record<string, unknown> = {}
  if (op === 'me' || op === 'join') {
    out = { agent_id: me.id, name: me.name, balance: Number(me.balance), x: me.x, z: me.z, is_agent: true }
  } else if (op === 'move') {
    const x = Number(body.x), z = Number(body.z)
    if (!Number.isFinite(x) || !Number.isFinite(z)) return res.status(400).json({ error: 'x and z numbers' })
    patch.x = Math.max(-LIMIT, Math.min(LIMIT, x)); patch.z = Math.max(-LIMIT, Math.min(LIMIT, z))
    out = { x: patch.x, z: patch.z }
  } else if (op === 'chat') {
    const text = clean(body.text, 140)
    if (!text) return res.status(400).json({ error: 'text 1-140 chars' })
    patch.last_chat = text; patch.last_chat_at = now.toISOString()
    out = { said: text }
  } else if (op === 'earn') {
    const today = now.toISOString().slice(0, 10)
    const earned = me.earned_day === today ? Number(me.earned_today) : 0
    const gap = me.last_earn_at ? (now.getTime() - new Date(me.last_earn_at).getTime()) / 1000 : Infinity
    if (gap < EARN_GAP_S) return res.status(429).json({ error: `next earn in ${Math.ceil(EARN_GAP_S - gap)}s` })
    if (earned + EARN > EARN_DAILY) return res.status(429).json({ error: 'daily earn cap reached' })
    patch.balance = Number(me.balance) + EARN; patch.earned_today = earned + EARN; patch.earned_day = today; patch.last_earn_at = now.toISOString()
    out = { earned: EARN, balance: patch.balance, note: 'In-game money only. Not withdrawable.' }
  } else if (op === 'attend') {
    const id = clean(body.event_id, 64)
    if (!EVENTS.some((e) => e.id === id)) return res.status(404).json({ error: 'unknown event_id; GET /api/agent-events' })
    await db.from('agent_attendance').upsert({ agent_id: me.id, event_id: id })
    out = { attending: id }
  } else return res.status(404).json({ error: 'unknown op' })

  await db.from('agents').update(patch).eq('id', me.id)
  return res.status(200).json(out)
}
