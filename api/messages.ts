import { PrivyClient } from '@privy-io/server-auth'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cleanUsername } from './_username.js'
import { attachUploaded, EDITED, previewBody, removeMedia, signLines, splitBody, storeMedia, uploadSlot } from './_dmMedia.js'
import { createHmac, timingSafeEqual } from 'crypto'
import { verifyNearAuth, nearUserId } from './_nearAuth.js'
import { cronAuthorized } from './_cron.js'
import { broadcastUpdate, cleanSub, emailOff, emailToken, notifyMessage, nudgeLapsed, savePushSub, setEmailOff, vapidKeys } from './_notify.js'

// Direct messages. Identity = Privy token -> players.username, or for NEAR sign-ins a Messages session token
// (op=near-session swaps the NEAR game session, or a fresh signed login, for a 30-day token bound to near:<account>).
// Service role only (RLS on, no anon policies).
// GET  ?op=inbox             threads (last line, unread count) + blocked list
// GET  ?op=thread&with=u     last 100 lines with u (marks them read)
// POST ?op=send   {to,text,media?}  rate limited: 8/min, 200/day; up to 500 chars; media = {type, data(base64)}
//                  for one photo or voice note (private bucket, signed links on read); refused if either side blocked
// POST ?op=block  {u, on}    block / unblock
// POST ?op=report {u, id?, reason?}
type Req = { method?: string; headers: Record<string, string | undefined>; query?: Record<string, string | string[] | undefined>; body?: Record<string, unknown> }
type Res = { status(n: number): { json(b: unknown): void }; setHeader(k: string, v: string): void }

const MAX = 500
export const cleanText = (t: unknown) => String(t ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

// NEAR players have no Privy session. After one signed login message they get a Messages token:
// gdn1.<base64url {u: near:<account>, exp}>.<HMAC-SHA256>. The key is DM_SESSION_SECRET, or derived from the
// service role key so it never leaves the server. Only Messages accepts it.
const SESSION_DAYS = 30
const sessionKey = () => createHmac('sha256', process.env.DM_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').update('grind-district dm session v1').digest()
const b64u = (b: Buffer) => b.toString('base64url')
export function issueSession(userId: string): { token: string; exp: number } {
  const exp = Date.now() + SESSION_DAYS * 86_400_000
  const body = b64u(Buffer.from(JSON.stringify({ u: userId, exp })))
  return { token: `gdn1.${body}.${b64u(createHmac('sha256', sessionKey()).update(body).digest())}`, exp }
}
export function readSession(token: string): string | null {
  const [v, body, mac] = token.split('.')
  if (v !== 'gdn1' || !body || !mac) return null
  const want = createHmac('sha256', sessionKey()).update(body).digest(), got = Buffer.from(mac, 'base64url')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u?: string; exp?: number }
    return typeof p.u === 'string' && p.u.startsWith('near:') && typeof p.exp === 'number' && p.exp > Date.now() ? p.u : null
  } catch { return null }
}
const usernameOf = async (db: SupabaseClient, userId: string) => ((await db.from('players').select('username').eq('privy_user_id', userId).maybeSingle()).data?.username as string | undefined) ?? null

async function me(req: Req, db: SupabaseClient): Promise<string | null> {
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID
  const secret = process.env.PRIVY_APP_SECRET
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (token.startsWith('gdn1.')) { const u = readSession(token); return u ? usernameOf(db, u) : null }
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
  // Notifications: the push public key, and the one-click email opt-out link from an alert email.
  if (String(req.query?.op ?? '') === 'push-key') return res.status(200).json({ key: vapidKeys().pub })
  // A game session after a deploy: send the current release's phone alert once (see broadcastUpdate).
  if (String(req.query?.op ?? '') === 'news-ping') return res.status(200).json(await broadcastUpdate(db, String(req.query?.id ?? '')).catch(() => ({ skipped: 'error' })))
  // The daily come-back reminders (vercel.json cron). Once a day at most; ?dry=1 only counts who would get one.
  if (String(req.query?.op ?? '') === 'nudge') {
    if (!cronAuthorized(req.headers)) return res.status(401).json({ error: 'unauthorized' })
    return res.status(200).json(await nudgeLapsed(db, String(req.query?.dry ?? '') === '1').catch(() => ({ error: 'failed' })))
  }
  if (String(req.query?.op ?? '') === 'email-off') {
    const u = cleanUsername(req.query?.u), t = String(req.query?.t ?? '')
    const ok = u.ok && t === emailToken(u.name) && await setEmailOff(db, u.name, true)
    res.setHeader('content-type', 'text/html; charset=utf-8')
    ;(res.status(ok ? 200 : 400) as unknown as { send(b: string): void }).send(`<!doctype html><meta name=viewport content='width=device-width'><body style="font-family:system-ui;padding:32px;max-width:520px;margin:auto"><h2>${ok ? 'Email alerts are off' : 'This link is not valid'}</h2><p>${ok ? 'You will not get message emails from Grind District. Turn them back on in Settings in the game.' : 'Open Settings in the game to change email alerts.'}</p><p><a href='https://www.grinddistrict.app'>Open Grind District</a></p></body>`)
    return
  }
  if (req.method === 'POST' && String(req.query?.op ?? '') === 'near-session') {
    const proof = (req.body ?? {}).near
    if (!proof || typeof proof !== 'object') return res.status(400).json({ error: 'missing NEAR proof' })
    const v = await verifyNearAuth(proof)
    if (!v.ok) return res.status(401).json({ error: v.error })
    const userId = nearUserId(v.accountId)
    const username = await usernameOf(db, userId)
    if (!username) return res.status(404).json({ error: 'No username is linked to this NEAR account yet' })
    return res.status(200).json({ ...issueSession(userId), username, account: v.accountId })
  }
  const user = await me(req, db)
  if (!user) return res.status(401).json({ error: 'Sign in to use messages' })
  const op = String(req.query?.op ?? '')
  const b = (req.body ?? {}) as Record<string, unknown>

  if (req.method === 'POST' && op === 'push-sub') {
    const sub = cleanSub(b.sub)
    if (!sub) return res.status(400).json({ error: 'bad subscription' })
    return res.status(200).json({ ok: await savePushSub(db, user, sub, b.on !== false) })
  }
  if (op === 'email-pref') {
    if (req.method === 'POST') await setEmailOff(db, user, b.on === false)
    return res.status(200).json({ on: !(await emailOff(db, user)), ready: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) })
  }
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
      if (!t) { t = { with: other, last: previewBody(m.body), at: m.created_at, mine: m.sender === user, unread: 0, lastId: m.id }; threads.set(other, t) }
      if (m.recipient === user && !m.read_at) t.unread++
    }
    // Each conversation's name and character, for the avatars in the list (one read for all of them).
    const names = [...threads.keys()]
    const cards = names.length ? await db.from('public_profiles').select('username,name,look').in('username', names.slice(0, 100)) : { data: [] }
    const card = new Map(((cards.data ?? []) as Array<{ username: string; name?: string; look?: { char?: unknown } | null }>).map((c) => [c.username, c]))
    const list = [...threads.values()].map((t) => ({ ...t, name: card.get(t.with)?.name ?? '', char: card.get(t.with)?.look?.char ?? null }))
    return res.status(200).json({ me: user, threads: list, blocked: [...blocked] })
  }
  if (op === 'thread') {
    const c = cleanUsername(req.query?.with)
    if (!c.ok) return res.status(400).json({ error: 'bad username' })
    const o = c.name
    const r = await db.from('messages').select('id,sender,recipient,body,created_at,read_at')
      .or(`and(sender.eq.${user},recipient.eq.${o}),and(sender.eq.${o},recipient.eq.${user})`).order('created_at', { ascending: false }).limit(100)
    await db.from('messages').update({ read_at: new Date().toISOString() }).eq('sender', o).eq('recipient', user).is('read_at', null)
    const [bl, pp] = await Promise.all([
      db.from('message_blocks').select('blocked').eq('blocker', user).eq('blocked', o).maybeSingle(),
      db.from('public_profiles').select('name,look,updated_at').eq('username', o).maybeSingle(),
    ])
    const peer = { name: (pp.data?.name as string | undefined) ?? '', seen: (pp.data?.updated_at as string | undefined) ?? null, char: ((pp.data?.look ?? {}) as { char?: unknown }).char ?? null }
    return res.status(200).json({ me: user, with: o, blocked: !!bl.data, peer, lines: await signLines(db, (r.data ?? []).reverse()) })
  }
  // Names and characters for a list of usernames (the Players online list shows everyone's character).
  if (op === 'cards') {
    const names = [...new Set(String(req.query?.u ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /^[a-z0-9_]{2,20}$/.test(x)))].slice(0, 40)
    const cards = names.length ? await db.from('public_profiles').select('username,name,look').in('username', names) : { data: [] }
    const people: Record<string, { name: string; char: unknown }> = {}
    for (const c of (cards.data ?? []) as Array<{ username: string; name?: string; look?: { char?: unknown } | null }>) people[c.username] = { name: c.name || c.username, char: c.look?.char ?? null }
    return res.status(200).json({ people })
  }
  if (op === 'search') {
    // Username/name prefix search over public profiles (players who have not shared a card still match by username).
    const raw = String(req.query?.q ?? '').toLowerCase().replace(/^@/, '')
    const q = raw.replace(/[^a-z0-9_]/g, '').slice(0, 16)
    // Names may have spaces ("zahra usman"): letters, digits and single spaces only, so the filter stays safe.
    const nm = raw.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24)
    if (q.length < 2 && nm.length < 2) return res.status(200).json({ results: [] })
    const nameLike = nm.replace(/ /g, '%')
    const [pp, pl] = await Promise.all([
      db.from('public_profiles').select('username,name,rank,updated_at').or(`${q.length >= 2 ? `username.ilike.${q}%,` : ''}name.ilike.%${nameLike}%`).order('updated_at', { ascending: false }).limit(20),
      q.length >= 2 ? db.from('players').select('username').ilike('username', `${q}%`).limit(20) : Promise.resolve({ data: [] as Array<{ username: string }> }),
    ])
    const out = new Map<string, { username: string; name: string; rank: string; seen: string | null }>()
    for (const r of pp.data ?? []) out.set(r.username, { username: r.username, name: r.name, rank: r.rank, seen: r.updated_at })
    for (const r of pl.data ?? []) if (!out.has(r.username)) out.set(r.username, { username: r.username, name: '', rank: '', seen: null })
    out.delete(user)
    return res.status(200).json({ results: [...out.values()].slice(0, 20) })
  }
  if (op === 'profile') {
    const c = cleanUsername(req.query?.u)
    if (!c.ok) return res.status(400).json({ error: 'bad username' })
    const o = c.name
    const [a, bb] = user < o ? [user, o] : [o, user]
    const [pp, pl, fr, party, bl] = await Promise.all([
      db.from('public_profiles').select('username,name,rank,reputation,skills,pinned,look,updated_at').eq('username', o).maybeSingle(),
      db.from('players').select('username').eq('username', o).maybeSingle(),
      db.from('friendships').select('requester,status').eq('a', a).eq('b', bb).maybeSingle(),
      db.from('parties').select('id,members').contains('members', [user]).maybeSingle(),
      db.from('message_blocks').select('blocker').eq('blocker', user).eq('blocked', o).maybeSingle(),
    ])
    if (!pp.data && !pl.data) return res.status(404).json({ error: 'No player with that username' })
    const f = fr.data
    const friend = !f ? 'none' : f.status === 'accepted' ? 'friends' : f.requester === user ? 'outgoing' : 'incoming'
    const lk = (pp.data?.look ?? {}) as Record<string, unknown>
    const lux = lk.lux as { streak?: number } | undefined
    return res.status(200).json({ me: user, self: o === user, profile: {
      // No balance here: another player's money is private (the profile shows rank, job and reputation).
      username: o, name: pp.data?.name ?? '', rank: pp.data?.rank ?? '', reputation: pp.data?.reputation ?? 0,
      skills: pp.data?.skills ?? [], pinned: pp.data?.pinned ?? [], seen: pp.data?.updated_at ?? null,
      look: { h: lk.h ?? 1, b: lk.b ?? 1, hair: lk.hair ?? null, skin: lk.skin ?? null }, streak: lux?.streak ?? 0,
      agent: (lk.agent as { label?: string } | undefined)?.label ?? null,
      job: typeof lk.job === 'string' ? lk.job : null,
      char: lk.char ?? null,
    }, friend, inParty: !!(party.data && (party.data.members as string[]).includes(o)), blocked: !!bl.data })
  }
  if (op === 'social') {
    const [fr, mine, inv] = await Promise.all([
      db.from('friendships').select('a,b,requester,status').or(`a.eq.${user},b.eq.${user}`).limit(200),
      db.from('parties').select('id,leader,members,invites,spot').contains('members', [user]).maybeSingle(),
      db.from('parties').select('id,leader,members').contains('invites', [user]).limit(10),
    ])
    const rows = fr.data ?? []
    const other = (r: { a: string; b: string }) => (r.a === user ? r.b : r.a)
    const friends = rows.filter((r) => r.status === 'accepted').map(other)
    const incoming = rows.filter((r) => r.status === 'pending' && r.requester !== user).map(other)
    const outgoing = rows.filter((r) => r.status === 'pending' && r.requester === user).map(other)
    // Everyone on the page, with their display name and character (for the pictures).
    const party = mine.data as { members?: string[] } | null
    const invites = (inv.data ?? []) as Array<{ leader?: string }>
    const names = [...new Set([...friends, ...incoming, ...outgoing, ...(party?.members ?? []), ...invites.map((i) => String(i.leader ?? ''))].filter(Boolean))].slice(0, 100)
    const cards = names.length ? await db.from('public_profiles').select('username,name,look').in('username', names) : { data: [] }
    const people: Record<string, { name: string; char: unknown }> = {}
    for (const c of (cards.data ?? []) as Array<{ username: string; name?: string; look?: { char?: unknown } | null }>) people[c.username] = { name: c.name || c.username, char: c.look?.char ?? null }
    return res.status(200).json({ me: user, friends, incoming, outgoing, party: mine.data ?? null, invites: inv.data ?? [], people })
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
  if (req.method === 'POST' && (op === 'edit' || op === 'delete')) {
    // Your own messages only: delete takes it away for both of you (and its photo or voice note); edit changes
    // the words for 24 hours and marks it Edited.
    const id = Number(b.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'bad message' })
    const row = await db.from('messages').select('id,sender,recipient,body,created_at,read_at').eq('id', id).maybeSingle()
    if (!row.data || row.data.sender !== user) return res.status(404).json({ error: 'You can only change your own messages' })
    const parts = splitBody(String(row.data.body))
    if (op === 'delete') {
      if (parts.path) await removeMedia(db, parts.path)
      const del = await db.from('messages').delete().eq('id', id).eq('sender', user)
      return del.error ? res.status(500).json({ error: 'Could not delete' }) : res.status(200).json({ ok: true })
    }
    if (Date.now() - Date.parse(String(row.data.created_at)) > 86_400_000) return res.status(403).json({ error: 'Messages can be edited for 24 hours' })
    const mark = parts.kind && parts.path ? `[[media:${parts.kind}:${parts.path}]]` : ''
    let text = cleanText(b.text)
    if (!text && !mark) return res.status(400).json({ error: 'Empty message: delete it instead' })
    text = text.slice(0, MAX - EDITED.length - (mark ? mark.length + 1 : 0))
    const body = EDITED + (text && mark ? `${text}\n${mark}` : text || mark)
    const up = await db.from('messages').update({ body }).eq('id', id).eq('sender', user).select('id,sender,recipient,body,created_at,read_at').single()
    if (up.error) return res.status(500).json({ error: 'Could not edit' })
    const [line] = await signLines(db, [up.data])
    return res.status(200).json({ line })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const t = cleanUsername(b.to ?? b.u)
  if (!t.ok) return res.status(400).json({ error: 'bad username' })
  const other = t.name
  if (other === user) return res.status(400).json({ error: 'That is you' })

  // A one-time upload link for a video or document (the phone uploads it straight to private storage).
  if (req.method === 'POST' && op === 'upload') {
    const slot = await uploadSlot(db, user, b)
    if ('error' in slot) return res.status(400).json(slot)
    return res.status(200).json(slot)
  }
  if (op === 'send') {
    const text = cleanText(b.text)
    if (!text && !b.media && !b.upload) return res.status(400).json({ error: 'Empty message' })
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
    let body = text
    if (b.media || b.upload) {
      const stored = b.upload ? await attachUploaded(db, user, b.upload) : await storeMedia(db, user, b.media)
      if ('error' in stored) return res.status(400).json({ error: stored.error })
      body = text ? `${text}\n${stored.mark}` : stored.mark
    }
    const ins = await db.from('messages').insert({ sender: user, recipient: other, body }).select('id,sender,recipient,body,created_at,read_at').single()
    if (ins.error) return res.status(500).json({ error: 'Could not send' })
    // Alert the recipient (push to their devices, an email when set up); never blocks the send for long.
    await notifyMessage(db, user, other, previewBody(body), ins.data.id as number).catch(() => undefined)
    const [line] = await signLines(db, [ins.data])
    return res.status(200).json({ line })
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
