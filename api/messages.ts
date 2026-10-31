import { PrivyClient } from '@privy-io/server-auth'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanUsername } from './_username.js'

// Direct messages. Identity = Privy token -> players.username. Service role only (RLS on, no anon policies).
// GET  ?op=inbox             threads (last line, unread count) + blocked list
// GET  ?op=thread&with=u     last 100 lines with u (marks them read)
// POST ?op=send   {to,text}  rate limited: 8/min, 200/day; 1-500 chars; refused if either side blocked
// POST ?op=block  {u, on}    block / unblock
// POST ?op=report {u, id?, reason?}
type Req = { method?: string; headers: Record<string, string | undefined>; query?: Record<string, string | string[] | undefined>; body?: Record<string, unknown> }
type Res = { status(n: number): { json(b: unknown): void }; setHeader(k: string, v: string): void }

const MAX = 500
export const cleanText = (t: unknown) => String(t ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

async function me(req: Req, db: SupabaseClient): Promise<string | null> {
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const secret = process.env.PRIVY_APP_SECRET
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!appId || !secret || !token) return null
  try {
    const { userId } = await new PrivyClient(appId, secret).verifyAuthToken(token)
    const r = await db.from('players').select('username').eq('privy_user_id', userId).maybeSingle()
    return (r.data?.username as string | undefined) ?? null
  } catch { return null }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('cache-control', 'no-store')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return res.status(503).json({ error: 'not configured' })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const user = await me(req, db)
  if (!user) return res.status(401).json({ error: 'Sign in to use messages' })
  const op = String(req.query?.op ?? '')
  const b = (req.body ?? {}) as Record<string, unknown>

  if (op === 'inbox') {
    const [rows, blocks] = await Promise.all([
      db.from('messages').select('id,sender,recipient,body,created_at,read_at').or(`sender.eq.${user},recipient.eq.${user}`).order('created_at', { ascending: false }).limit(400),
      db.from('message_blocks').select('blocked').eq('blocker', user),
    ])
    const blocked = new Set((blocks.data ?? []).map((r) => r.blocked as string))
    const threads = new Map<string, { with: string; last: string; at: string; mine: boolean; unread: number; lastId: number }>()
    for (const m of rows.data ?? []) {
      const other = m.sender === user ? m.recipient : m.sender
      if (blocked.has(other)) continue
      let t = threads.get(other)
      if (!t) { t = { with: other, last: m.body, at: m.created_at, mine: m.sender === user, unread: 0, lastId: m.id }; threads.set(other, t) }
      if (m.recipient === user && !m.read_at) t.unread++
    }
    return res.status(200).json({ me: user, threads: [...threads.values()], blocked: [...blocked] })
  }
  if (op === 'thread') {
    const c = cleanUsername(req.query?.with)
    if (!c.ok) return res.status(400).json({ error: 'bad username' })
    const o = c.name
    const r = await db.from('messages').select('id,sender,recipient,body,created_at,read_at')
      .or(`and(sender.eq.${user},recipient.eq.${o}),and(sender.eq.${o},recipient.eq.${user})`).order('created_at', { ascending: false }).limit(100)
    await db.from('messages').update({ read_at: new Date().toISOString() }).eq('sender', o).eq('recipient', user).is('read_at', null)
    const bl = await db.from('message_blocks').select('blocked').eq('blocker', user).eq('blocked', o).maybeSingle()
    return res.status(200).json({ me: user, with: o, blocked: !!bl.data, lines: (r.data ?? []).reverse() })
  }
  if (op === 'social') {
    const [fr, mine, inv] = await Promise.all([
      db.from('friendships').select('a,b,requester,status').or(`a.eq.${user},b.eq.${user}`).limit(200),
      db.from('parties').select('id,leader,members,invites,spot').contains('members', [user]).maybeSingle(),
      db.from('parties').select('id,leader,members').contains('invites', [user]).limit(10),
    ])
    const rows = fr.data ?? []
    const other = (r: { a: string; b: string }) => (r.a === user ? r.b : r.a)
    return res.status(200).json({ me: user,
      friends: rows.filter((r) => r.status === 'accepted').map(other),
      incoming: rows.filter((r) => r.status === 'pending' && r.requester !== user).map(other),
      outgoing: rows.filter((r) => r.status === 'pending' && r.requester === user).map(other),
      party: mine.data ?? null, invites: inv.data ?? [] })
  }
  if (req.method === 'POST' && op === 'party_leave') {
    const p = await db.from('parties').select('id,members,leader').contains('members', [user]).maybeSingle()
    if (p.data) { const left = (p.data.members as string[]).filter((m) => m !== user)
      if (!left.length) await db.from('parties').delete().eq('id', p.data.id)
      else await db.from('parties').update({ members: left, leader: p.data.leader === user ? left[0] : p.data.leader, updated_at: new Date().toISOString() }).eq('id', p.data.id) }
    return res.status(200).json({ ok: true })
  }
  if (req.method === 'POST' && op === 'party_spot') {
    const x = Math.max(-500, Math.min(500, Number(b.x) || 0)), z = Math.max(-500, Math.min(500, Number(b.z) || 0))
    await db.from('parties').update({ spot: { by: user, x, z, at: Date.now() }, updated_at: new Date().toISOString() }).contains('members', [user])
    return res.status(200).json({ ok: true })
  }
  if (req.method === 'POST' && op === 'party_join') {
    const id = String(b.id ?? '').slice(0, 40)
    const p = await db.from('parties').select('id,members,invites').eq('id', id).contains('invites', [user]).maybeSingle()
    if (!p.data) return res.status(404).json({ error: 'Invite expired' })
    if ((p.data.members as string[]).length >= 4) return res.status(409).json({ error: 'Party is full (4)' })
    const old = await db.from('parties').select('id,members').contains('members', [user]).maybeSingle()
    if (old.data) { const left = (old.data.members as string[]).filter((m) => m !== user); if (!left.length) await db.from('parties').delete().eq('id', old.data.id); else await db.from('parties').update({ members: left }).eq('id', old.data.id) }
    await db.from('parties').update({ members: [...(p.data.members as string[]), user], invites: (p.data.invites as string[]).filter((m) => m !== user), updated_at: new Date().toISOString() }).eq('id', id)
    return res.status(200).json({ ok: true })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const t = cleanUsername(b.to ?? b.u)
  if (!t.ok) return res.status(400).json({ error: 'bad username' })
  const other = t.name
  if (other === user) return res.status(400).json({ error: 'That is you' })

  if (op === 'send') {
    const text = cleanText(b.text)
    if (!text) return res.status(400).json({ error: 'Empty message' })
    if (text.length > MAX) return res.status(400).json({ error: `Max ${MAX} characters` })
    const exists = await db.from('players').select('username').eq('username', other).maybeSingle()
    if (!exists.data) return res.status(404).json({ error: `@${other} has not signed in yet, so they have no Messages tab` })
    const blocks = await db.from('message_blocks').select('blocker').or(`and(blocker.eq.${other},blocked.eq.${user}),and(blocker.eq.${user},blocked.eq.${other})`)
    if ((blocks.data ?? []).length) return res.status(403).json({ error: 'You cannot message this player' })
    const now = Date.now()
    const [min, day] = await Promise.all([
      db.from('messages').select('id', { count: 'exact', head: true }).eq('sender', user).gte('created_at', new Date(now - 60_000).toISOString()),
      db.from('messages').select('id', { count: 'exact', head: true }).eq('sender', user).gte('created_at', new Date(now - 86_400_000).toISOString()),
    ])
    if ((min.count ?? 0) >= 8) return res.status(429).json({ error: 'Slow down: 8 messages a minute' })
    if ((day.count ?? 0) >= 200) return res.status(429).json({ error: 'Daily limit reached (200)' })
    const ins = await db.from('messages').insert({ sender: user, recipient: other, body: text }).select('id,sender,recipient,body,created_at,read_at').single()
    if (ins.error) return res.status(500).json({ error: 'Could not send' })
    return res.status(200).json({ line: ins.data })
  }
  if (op === 'friend') {
    const [a, bb] = user < other ? [user, other] : [other, user]
    const action = String(b.action ?? 'add')
    if (action === 'remove') { await db.from('friendships').delete().eq('a', a).eq('b', bb); return res.status(200).json({ ok: true }) }
    const exists = await db.from('players').select('username').eq('username', other).maybeSingle()
    if (!exists.data) return res.status(404).json({ error: `@${other} has not signed in yet` })
    const blocks = await db.from('message_blocks').select('blocker').or(`and(blocker.eq.${other},blocked.eq.${user}),and(blocker.eq.${user},blocked.eq.${other})`)
    if ((blocks.data ?? []).length) return res.status(403).json({ error: 'Not possible with this player' })
    const cur = await db.from('friendships').select('requester,status').eq('a', a).eq('b', bb).maybeSingle()
    if (cur.data && cur.data.status === 'pending' && cur.data.requester !== user) { await db.from('friendships').update({ status: 'accepted' }).eq('a', a).eq('b', bb); return res.status(200).json({ ok: true, status: 'accepted' }) }
    if (cur.data) return res.status(200).json({ ok: true, status: cur.data.status })
    const n = await db.from('friendships').select('a', { count: 'exact', head: true }).eq('requester', user).gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    if ((n.count ?? 0) >= 30) return res.status(429).json({ error: 'Friend request limit today' })
    await db.from('friendships').insert({ a, b: bb, requester: user })
    return res.status(200).json({ ok: true, status: 'pending' })
  }
  if (op === 'party_invite') {
    const [a, bb] = user < other ? [user, other] : [other, user]
    const f = await db.from('friendships').select('status').eq('a', a).eq('b', bb).maybeSingle()
    if (f.data?.status !== 'accepted') return res.status(403).json({ error: 'Invite friends only' })
    let p = await db.from('parties').select('id,members,invites').contains('members', [user]).maybeSingle()
    if (!p.data) p = await db.from('parties').insert({ leader: user, members: [user] }).select('id,members,invites').single()
    if (!p.data) return res.status(500).json({ error: 'Could not create party' })
    if ((p.data.members as string[]).length >= 4) return res.status(409).json({ error: 'Party is full (4)' })
    const invites = [...new Set([...(p.data.invites as string[]), other])].slice(-8)
    await db.from('parties').update({ invites, updated_at: new Date().toISOString() }).eq('id', p.data.id)
    return res.status(200).json({ ok: true })
  }
  if (op === 'block') {
    if (b.on === false) await db.from('message_blocks').delete().eq('blocker', user).eq('blocked', other)
    else await db.from('message_blocks').upsert({ blocker: user, blocked: other })
    return res.status(200).json({ ok: true })
  }
  if (op === 'report') {
    const recent = await db.from('message_reports').select('id', { count: 'exact', head: true }).eq('reporter', user).gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    if ((recent.count ?? 0) >= 20) return res.status(429).json({ error: 'Report limit reached today' })
    const id = Number(b.id)
    await db.from('message_reports').insert({ reporter: user, reported: other, message_id: Number.isFinite(id) && id > 0 ? id : null, reason: cleanText(b.reason).slice(0, 200) || null })
    return res.status(200).json({ ok: true })
  }
  res.status(400).json({ error: 'unknown op' })
}
