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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const normEmail = (s: unknown) => String(s ?? '').trim().toLowerCase().slice(0, 120)
/** Stable public label from an email: sanitized local part + 6 hex of SHA-256(email). Never reveals the domain. */
const labelFor = (email: string) => email.startsWith('eip155:') ? `agent${(email.split(':')[3] ?? '').slice(0, 8)}-${sha(email).slice(0, 6)}` : `${(email.split('@')[0] ?? '').replace(/[^a-z0-9]/g, '').slice(0, 12) || 'agent'}-${sha(email).slice(0, 6)}`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function identify(db: any, email: string): Promise<string> {
  const { data } = await db.from('agent_identities').select('label').eq('email', email).maybeSingle()
  if (data) return data.label as string
  await db.from('agent_identities').upsert({ email, label: labelFor(email) }, { onConflict: 'email', ignoreDuplicates: true })
  const { data: row, error } = await db.from('agent_identities').select('label').eq('email', email).single()
  if (error || !row) throw new Error('identify failed')
  return row.label as string
}
// ERC-8004 agent identity: CAIP-style "eip155:<chainId>:<identityRegistry>:<agentId>" (agentId = ERC-721 token id).
const ERC8004_RE = /^eip155:(\d{1,10}):(0x[0-9a-fA-F]{40}):(\d{1,78})$/
const RPC: Record<string, string> = { '1': 'https://ethereum-rpc.publicnode.com', '11155111': 'https://ethereum-sepolia-rpc.publicnode.com', '8453': 'https://mainnet.base.org', '84532': 'https://sepolia.base.org' }
/** Read-only eth_call ownerOf(agentId) on the identity registry. true = exists, false = no such token, null = could not check. */
async function erc8004Exists(chain: string, registry: string, id: string): Promise<boolean | null> {
  const rpc = RPC[chain]
  if (!rpc) return null
  const data = '0x6352211e' + BigInt(id).toString(16).padStart(64, '0')
  try {
    const r = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: registry, data }, 'latest'] }), signal: AbortSignal.timeout(4000) })
    const j = await r.json() as { result?: string; error?: unknown }
    if (j.error) return false
    return typeof j.result === 'string' && /[1-9a-f]/i.test(j.result.slice(2 + 24)) ? true : false
  } catch { return null }
}
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

  if (op === 'identify') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const email = normEmail(body.email)
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' })
    try { return res.status(200).json({ label: await identify(db, email) }) } catch { return res.status(500).json({ error: 'Could not join right now.' }) }
  }

  if (op === 'register') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    // Identity: the agent's own email, or (if it has none) its ERC-8004 agent id. Read-only checks only.
    let ident = normEmail(body.email)
    let erc: { chain: string; registry: string; id: string; verified: boolean | null } | null = null
    if (!ident) {
      const raw = String(body.erc8004_id ?? '').trim()
      const m = ERC8004_RE.exec(raw)
      if (!m) return res.status(400).json({ error: 'send "email" (your own email) or, if you have none, "erc8004_id" as eip155:<chainId>:<identityRegistry 0x…40 hex>:<agentId>' })
      const verified = await erc8004Exists(m[1]!, m[2]!, m[3]!)
      if (verified === false) return res.status(400).json({ error: 'erc8004_id: no such agent token on that registry (ownerOf reverted)' })
      erc = { chain: m[1]!, registry: m[2]!.toLowerCase(), id: m[3]!, verified }
      ident = `eip155:${erc.chain}:${erc.registry}:${erc.id}`
    } else if (!EMAIL_RE.test(ident)) return res.status(400).json({ error: 'email: a valid email address is required' })
    // Optional: link to the player who sent the prompt (one-time claim code from their Agents screen).
    let owner: string | null = null
    let ownerLook: Record<string, unknown> = {}
    const claim = String(body.claim ?? '').trim().slice(0, 40)
    if (claim) {
      const h = sha(claim)
      const { data: prof } = await db.from('public_profiles').select('username,look').eq('look->agentClaim->>h', h).maybeSingle()
      const lk = (prof?.look ?? {}) as Record<string, unknown>
      const c = lk.agentClaim as { exp?: number } | undefined
      if (!prof || !c || (c.exp ?? 0) < Date.now()) return res.status(400).json({ error: 'claim code invalid or expired; ask your player to copy a fresh prompt' })
      owner = prof.username as string
      ownerLook = lk
    }
    const name = erc ? await identify(db, ident).catch(() => `agent-${sha(ident).slice(0, 6)}`) : await identify(db, ident)
      const { agentClaim: _drop, ...rest } = ownerLook
      void _drop
    if (owner) {
      await db.from('public_profiles').update({ look: { ...rest, agent: { label: name, via: erc ? 'erc8004' : 'email', at: new Date().toISOString() } } }).eq('username', owner)
    }
    const fwd = req.headers['x-forwarded-for']
    const ip = sha(`${(Array.isArray(fwd) ? fwd[0] : fwd ?? '').split(',')[0]}|grind-agents`)
    const hour = new Date(Date.now() - 3_600_000).toISOString()
    const { count } = await db.from('agents').select('id', { count: 'exact', head: true }).eq('ip_hash', ip).gte('created_at', hour)
    if ((count ?? 0) >= 3) return res.status(429).json({ error: 'too many registrations from this network; try in an hour' })
    const token = `gda_${randomBytes(24).toString('base64url')}`
    const { data, error } = await db.from('agents').insert({ name, ident, token_hash: sha(token), ip_hash: ip }).select('id').single()
    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'that email/id already has an agent' : 'register failed' })
    return res.status(201).json({ agent_id: data.id, label: name, token, owner, identity: erc ? { type: 'erc8004', ...erc } : { type: 'email' }, note: 'Store the token. It is shown once.' })
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
