import { createClient } from '@supabase/supabase-js'
import { cleanUsername } from './_username.js'

type Req = { method?: string; query?: Record<string, string | string[] | undefined>; headers?: Record<string, string | undefined>; body?: Record<string, unknown> }
type Res = { status(n: number): { json(b: unknown): void }; setHeader(k: string, v: string): void }

// Invite links and referral tracking. Usernames and counts only: no emails, wallets or balances.
// GET  ?u=<name>        who joined via @name's link, how far each got (courses passed, from the public profile),
//                       and how often the link was opened (and by how many visitors).
// GET  ?by=<name>       who invited @name (to give the new player their welcome gift once).
// GET  ?op=top          the top inviters of the last 30 days.
// POST ?op=open {ref, anon}  an invite link was opened (one count per visitor per inviter per day).
// POST ?op=card {data, near?}   the caller's invite photo card (a 1200x630 JPEG drawn in the game) for their /cv link
//                       preview on X and other apps. Signed in only; the username comes from the players row. The
//                       card shows the avatar, name, rank, reputation and the invite code: never a balance or wallet.
// Opens are stored in the existing events table (name 'invite_open'), so no new table is needed.
export const CARD_BUCKET = 'invite-cards'
async function storeCard(db: ReturnType<typeof createClient>, req: Req, res: Res) {
  let userId: string
  const near = req.body?.near as unknown
  if (near) {
    const { verifyNearAuth, nearUserId } = await import('./_nearAuth.js')
    const v = await verifyNearAuth(near)
    if (!v.ok) return res.status(v.status ?? 401).json({ error: v.error })
    userId = nearUserId(v.accountId)
  } else {
    const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID, secret = process.env.PRIVY_APP_SECRET
    if (!appId || !secret) return res.status(503).json({ error: 'not configured' })
    try {
      const { PrivyClient } = await import('@privy-io/server-auth')
      userId = (await new PrivyClient(appId, secret).verifyAuthToken((req.headers?.authorization ?? '').replace(/^Bearer\s+/i, ''))).userId
    } catch { return res.status(401).json({ error: 'sign in' }) }
  }
  const p = await db.from('players').select('username').eq('privy_user_id', userId).maybeSingle()
  const name = (p.data as { username?: string } | null)?.username?.toLowerCase()
  if (!name) return res.status(404).json({ error: 'claim a username first' })
  const data = String(req.body?.data ?? '')
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return res.status(400).json({ error: 'not an image' })
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length < 2000 || bytes.length > 600_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return res.status(400).json({ error: 'JPEG card only' })
  const put = () => db.storage.from(CARD_BUCKET).upload(`${name}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '300' })
  let up = await put()
  if (up.error && /bucket|not found/i.test(up.error.message)) { await db.storage.createBucket(CARD_BUCKET, { public: true }).catch(() => undefined); up = await put() }
  if (up.error) return res.status(500).json({ error: 'could not store the card' })
  return res.status(200).json({ ok: true, v: Date.now().toString(36) })
}

export default async function handler(req: Req, res: Res) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ joined: [] })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const op = String(req.query?.op ?? '')
  if (req.method === 'POST' && op === 'card') return storeCard(db, req, res)

  if (req.method === 'POST' && op === 'open') {
    const c = cleanUsername(req.body?.ref)
    const anon = String(req.body?.anon ?? '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 64)
    if (!c.ok || anon.length < 8) return res.status(400).json({ ok: false })
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const seen = await db.from('events').select('id').eq('name', 'invite_open').eq('anon_id', anon).contains('props', { ref: c.name }).gte('created_at', since).limit(1)
    if (!seen.error && seen.data?.length) return res.status(200).json({ ok: true, counted: false })
    const ins = await db.from('events').insert({ name: 'invite_open', anon_id: anon, session_id: '', props: { ref: c.name } })
    return res.status(ins.error ? 500 : 200).json({ ok: !ins.error, counted: !ins.error })
  }

  if (op === 'top') {
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
    const { data } = await db.from('referrals').select('inviter_username').gte('created_at', since).limit(5000)
    const counts = new Map<string, number>()
    for (const r of (data ?? []) as Array<{ inviter_username: string }>) counts.set(r.inviter_username.toLowerCase(), (counts.get(r.inviter_username.toLowerCase()) ?? 0) + 1)
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([u, n]) => ({ u, n }))
    res.setHeader('cache-control', 'public, max-age=120')
    return res.status(200).json({ top })
  }

  if (req.query?.by !== undefined) {
    const c = cleanUsername(req.query.by)
    if (!c.ok) return res.status(400).json({ inviter: null })
    const { data } = await db.from('referrals').select('inviter_username').ilike('invitee_username', c.name).limit(1)
    return res.status(200).json({ inviter: (data?.[0] as { inviter_username?: string } | undefined)?.inviter_username ?? null })
  }

  const c = cleanUsername(req.query?.u)
  if (!c.ok) return res.status(400).json({ joined: [] })
  const { data } = await db.from('referrals').select('invitee_username,created_at').ilike('inviter_username', c.name).order('created_at', { ascending: false }).limit(50)
  const rows = (data ?? []) as Array<{ invitee_username: string; created_at: string }>
  const names = rows.map((r) => r.invitee_username)
  const [profiles, opens] = await Promise.all([
    names.length ? db.from('public_profiles').select('username,rank,reputation,skills').in('username', names) : Promise.resolve({ data: [] as unknown[] }),
    db.from('events').select('anon_id').eq('name', 'invite_open').contains('props', { ref: c.name }).limit(5000),
  ])
  const byName = new Map(((profiles.data ?? []) as Array<{ username: string; rank: string; reputation: number; skills: string[] }>).map((p) => [p.username, p]))
  const players = rows.map((r) => { const p = byName.get(r.invitee_username); return { u: r.invitee_username, at: r.created_at, courses: p?.skills?.length ?? 0, rank: p?.rank ?? '', rep: p?.reputation ?? 0 } })
  const openRows = (opens.data ?? []) as Array<{ anon_id: string }>
  res.setHeader('cache-control', 'public, max-age=30')
  res.status(200).json({ joined: names, players, opens: openRows.length, visitors: new Set(openRows.map((o) => o.anon_id)).size })
}
