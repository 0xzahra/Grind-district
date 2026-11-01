// Direct messages (GDD §9 "full messaging"): a Messages tab in the Control Centre, threads per player,
// notifications merged into the Control Centre inbox. Server: /api/messages (Privy-verified, service role only).
const CLAIMED_KEY = 'gd.privy.username'
const accessToken = async () => (await import('./login.ts')).accessToken()
const openLogin = () => void import('./login.ts').then((m) => m.openLogin())
import { notify } from './notify.ts'
import './messages.css'

type Line = { id: number; sender: string; recipient: string; body: string; created_at: string; read_at: string | null }
type Thread = { with: string; last: string; at: string; mine: boolean; unread: number; lastId: number }
type Ctx = { openSheet: (title: string, fill: () => void) => void; body: () => HTMLElement; openNearby: () => void; isOpen: (title: string) => boolean }

const MAX = 500
const SEEN = 'gd.dm.seen.v1'
let ctx: Ctx | null = null
let unread = 0
let current = ''

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

async function api<T>(op: string, opts: { q?: string; post?: Record<string, unknown> } = {}): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  // Guests (no claimed username) never load the Privy SDK here.
  // Any Privy trace (claimed username, user id, or an SDK session key) means try for a token: a session restored
  // from Google/email on this device may not have the username cached yet.
  const known = localStorage.getItem(CLAIMED_KEY) || localStorage.getItem('gd.privy.userId') || Object.keys(localStorage).some((k) => k.startsWith('privy:'))
  const token = known ? await accessToken() : null
  if (!token) return { ok: false, status: 401, data: { error: 'Sign in to use messages', noToken: true } as unknown as T & { error?: string } }
  const r = await fetch(`/api/messages?op=${op}${opts.q ?? ''}`, {
    method: opts.post ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, ...(opts.post ? { 'content-type': 'application/json' } : {}) },
    body: opts.post ? JSON.stringify(opts.post) : undefined,
  }).catch(() => null)
  if (!r) return { ok: false, status: 0, data: { error: 'Offline' } as T & { error?: string } }
  const data = (await r.json().catch(() => ({}))) as T & { error?: string }
  return { ok: r.ok, status: r.status, data }
}

export const dmUnread = () => unread

function signedOut(body: HTMLElement, hasSession = false) {
  // hasSession: a valid Privy token exists but no username is linked to it yet, so the fix is claiming one, not signing in.
  body.replaceChildren(
    el('p', hasSession
      ? 'You are signed in, but no username is linked yet. Claim one to send and receive messages.'
      : 'Messages go to a player’s Messages tab even when they are offline. Sign in and claim a username to send and receive them.', 'cc-muted'),
  )
  const sign = el('button', hasSession ? 'Claim username' : 'Sign in', 'dm-primary'); sign.type = 'button'; sign.onclick = () => openLogin()
  body.append(sign, nearbyRow())
}

function nearbyRow() {
  const b = el('button', '', 'cc-row dm-nearby'); b.type = 'button'
  b.append(el('strong', 'Nearby chat'), el('p', 'Talk to players within 12 m. Lines are not saved.'))
  b.onclick = () => ctx?.openNearby()
  return b
}

export async function openInbox(): Promise<void> {
  if (!ctx) return
  current = ''
  ctx.openSheet('Messages', () => {})
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<{ me: string; threads: Thread[]; blocked: string[] }>('inbox')
  if (!ctx.isOpen('Messages') || current) return
  if (r.status === 401) return signedOut(body, !(r.data as { noToken?: boolean }).noToken)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load messages.', 'cc-muted'), nearbyRow()); return }
  setUnread(r.data.threads.reduce((s, t) => s + t.unread, 0))
  const list = el('ol', '', 'cc-list dm-threads')
  for (const t of r.data.threads) {
    const li = el('li', '', t.unread ? 'unread' : 'read')
    if (t.unread) li.prepend(el('span', '', 'dm-dot'))
    const btn = el('button', '', 'cc-row'); btn.type = 'button'
    btn.append(el('strong', `@${t.with}${t.unread ? ` · ${t.unread} new` : ''}`), el('time', when(t.at)), el('p', `${t.mine ? 'You: ' : ''}${t.last}`.slice(0, 120)))
    btn.onclick = () => void openThread(t.with)
    li.append(btn); list.append(li)
  }
  if (!r.data.threads.length) list.append(el('li', 'No messages yet. Tap a player in the city, then Message.', 'empty'))
  const fr = el('button', '', 'cc-row dm-nearby'); fr.type = 'button'
  fr.append(el('strong', 'Friends & party'), el('p', 'Add friends, party up to 4, join me.'))
  fr.onclick = () => void openFriends()
  body.replaceChildren(el('p', `Signed in as @${r.data.me}`, 'cc-muted'), searchBox(), nearbyRow(), fr, el('h3', 'Conversations'), list)
  if (r.data.blocked.length) {
    const h = el('h3', 'Blocked'); body.append(h)
    for (const u of r.data.blocked) {
      const row = el('div', '', 'dm-blocked'); row.append(el('span', `@${u}`))
      const un = el('button', 'Unblock', 'cc-link'); un.type = 'button'
      un.onclick = async () => { await api('block', { post: { u, on: false } }); void openInbox() }
      row.append(un); body.append(row)
    }
  }
}

export async function openThread(withUser: string): Promise<void> {
  if (!ctx) return
  const u = withUser.toLowerCase()
  current = u
  ctx.openSheet(`@${u}`, () => {})
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<{ me: string; lines: Line[]; blocked: boolean }>('thread', { q: `&with=${encodeURIComponent(u)}` })
  if (current !== u) return
  if (r.status === 401) return signedOut(body, !(r.data as { noToken?: boolean }).noToken)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load.', 'cc-muted')); return }
  const back = el('button', '‹ All messages', 'cc-link'); back.type = 'button'; back.onclick = () => void openInbox()
  const prof = el('button', `View @${u}’s profile`, 'cc-link'); prof.type = 'button'; prof.onclick = () => void openProfile(u)
  const log = el('ol', '', 'dm-log')
  const add = (l: Line) => {
    const li = el('li', '', l.sender === r.data.me ? 'mine' : 'theirs')
    li.append(el('p', l.body), el('time', when(l.created_at)))
    if (l.sender !== r.data.me) {
      const rep = el('button', 'Report', 'dm-report'); rep.type = 'button'
      rep.onclick = async () => { if (!confirm(`Report this message from @${u}?`)) return; const x = await api('report', { post: { u, id: l.id, reason: 'message' } }); rep.textContent = x.ok ? 'Reported' : 'Failed'; rep.disabled = true }
      li.append(rep)
    }
    log.append(li)
  }
  r.data.lines.forEach(add)
  if (!r.data.lines.length) log.append(el('li', `Say hi to @${u}. They get a notification.`, 'dm-empty'))
  const form = el('form', '', 'dm-form')
  const ta = el('textarea'); ta.maxLength = MAX; ta.rows = 2; ta.placeholder = `Message @${u}`; ta.setAttribute('aria-label', `Message @${u}`)
  const count = el('small', `0/${MAX}`, 'dm-count')
  const send = el('button', 'Send', 'dm-primary'); send.type = 'submit'
  const status = el('p', '', 'cc-muted')
  ta.oninput = () => { count.textContent = `${ta.value.length}/${MAX}` }
  ta.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit() } }
  form.onsubmit = async (e) => {
    e.preventDefault()
    const text = ta.value.trim()
    if (!text) return
    send.disabled = true; status.textContent = ''
    const s = await api<{ line: Line }>('send', { post: { to: u, text } })
    send.disabled = false
    if (!s.ok) { status.textContent = s.data.error ?? 'Could not send'; return }
    log.querySelector('.dm-empty')?.remove()
    add(s.data.line); ta.value = ''; count.textContent = `0/${MAX}`
    log.scrollTop = log.scrollHeight
  }
  form.append(ta, count, send)
  window.setTimeout(() => ta.focus({ preventScroll: true }), 60)
  const safety = el('div', '', 'dm-safety')
  const block = el('button', r.data.blocked ? 'Unblock' : 'Block', 'cc-link'); block.type = 'button'
  block.onclick = async () => {
    const on = block.textContent === 'Block'
    if (on && !confirm(`Block @${u}? They will not be able to message you.`)) return
    const x = await api('block', { post: { u, on } })
    if (x.ok) { block.textContent = on ? 'Unblock' : 'Block'; form.hidden = on }
  }
  form.hidden = r.data.blocked
  const addF = el('button', 'Add friend', 'cc-link'); addF.type = 'button'
  addF.onclick = async () => { const x = await api<{ status?: string }>('friend', { post: { u, action: 'add' } }); addF.textContent = x.ok ? (x.data.status === 'accepted' ? 'Friends ✓' : 'Request sent') : (x.data.error ?? 'Failed'); addF.disabled = true }
  safety.append(addF, block)
  body.replaceChildren(back, prof, log, form, status, safety)
  log.scrollTop = log.scrollHeight
  void poll()
}

function setUnread(n: number) { unread = n; document.getElementById('cc-msg')?.classList.toggle('has-unread', n > 0) }

let polling = false
async function poll(): Promise<void> {
  if (polling || document.hidden || !localStorage.getItem(CLAIMED_KEY)) return
  polling = true
  try {
    const r = await api<{ threads: Thread[] }>('inbox')
    if (!r.ok) return
    let seen: Record<string, number> = {}
    try { seen = JSON.parse(localStorage.getItem(SEEN) ?? '{}') } catch { seen = {} }
    let total = 0
    for (const t of r.data.threads) {
      total += t.unread
      if (t.unread && !t.mine && (seen[t.with] ?? 0) < t.lastId && current !== t.with) {
        notify(`Message from @${t.with}`, t.last.slice(0, 120), undefined, `dm:${t.with}`)
      }
      seen[t.with] = Math.max(seen[t.with] ?? 0, t.lastId)
    }
    localStorage.setItem(SEEN, JSON.stringify(seen))
    setUnread(total)
    // Thread open: pull new lines in place.
    if (current && ctx?.isOpen(`@${current}`) && r.data.threads.some((t) => t.with === current && t.unread)) void openThread(current)
  } finally { polling = false }
}

export function mountMessages(c: Ctx): void {
  ctx = c
  window.setTimeout(() => void poll(), 4000)
  window.setInterval(() => void poll(), 20000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll() })
}

// ---------- Friends & parties ----------
type Party = { id: string; leader: string; members: string[]; invites: string[]; spot: { by: string; x: number; z: number; at: number } | null }
type Social = { me: string; friends: string[]; incoming: string[]; outgoing: string[]; party: Party | null; invites: Array<{ id: string; leader: string; members: string[] }> }
let social: Social | null = null
export const partySize = () => social?.party?.members.length ?? 0
const SOC_SEEN = 'gd.social.seen.v1'
export async function openFriends(): Promise<void> {
  if (!ctx) return
  current = ''
  ctx.openSheet('Friends', () => {})
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<Social>('social')
  if (r.status === 401) return signedOut(body, !(r.data as { noToken?: boolean }).noToken)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load friends.', 'cc-muted')); return }
  social = r.data
  const s = r.data
  const act = (label: string, fn: () => Promise<unknown>, cls = 'cc-link') => { const b = el('button', label, cls); b.type = 'button'; b.onclick = async () => { b.disabled = true; await fn(); void openFriends() }; return b }
  const row = (u: string, ...btns: HTMLElement[]) => { const d = el('div', '', 'dm-blocked'); d.append(el('span', `@${u}`), ...btns); return d }
  const form = el('form', '', 'dm-form'); const inp = el('input'); inp.placeholder = 'Add friend by username'; inp.maxLength = 16; inp.onkeydown = (e) => e.stopPropagation()
  const add = el('button', 'Add', 'dm-primary'); add.type = 'submit'; const st = el('p', '', 'cc-muted')
  form.onsubmit = async (e) => { e.preventDefault(); const x = await api<{ status?: string }>('friend', { post: { u: inp.value.trim().toLowerCase(), action: 'add' } }); st.textContent = x.ok ? (x.data.status === 'accepted' ? 'You are now friends.' : 'Request sent.') : (x.data.error ?? 'Failed'); if (x.ok) window.setTimeout(() => void openFriends(), 700) }
  form.append(inp, add)
  body.replaceChildren(form, st)
  body.append(el('h3', s.party ? `Party · ${s.party.members.length}/4` : 'Party'))
  if (s.party) {
    for (const m of s.party.members) body.append(row(m + (m === s.party.leader ? ' (lead)' : '')))
    body.append(el('p', 'Party members earn a $10 in-game bonus each (up to $30) when they attend conference events together.', 'cc-muted'))
    if (s.party.spot && s.party.spot.by !== s.me && Date.now() - s.party.spot.at < 15 * 60_000) body.append(act(`Join @${s.party.spot.by}`, async () => { window.dispatchEvent(new CustomEvent('gd-teleport', { detail: s.party!.spot })) }, 'dm-primary'))
    body.append(act('Join me (share my spot)', async () => { const pos = (window as unknown as { gdPos?: () => { x: number; z: number } }).gdPos?.(); if (pos) await api('party_spot', { post: pos }) }), act('Leave party', () => api('party_leave', { post: {} })))
  } else body.append(el('p', 'Invite a friend to start a party (max 4).', 'cc-muted'))
  if (s.invites.length) { body.append(el('h3', 'Party invites')); for (const i of s.invites) body.append(row(`${i.leader} · ${i.members.length}/4`, act('Join', () => api('party_join', { post: { id: i.id } }), 'dm-primary'))) }
  if (s.incoming.length) { body.append(el('h3', 'Friend requests')); for (const u of s.incoming) body.append(row(u, act('Accept', () => api('friend', { post: { u, action: 'add' } }), 'dm-primary'), act('Decline', () => api('friend', { post: { u, action: 'remove' } })))) }
  body.append(el('h3', `Friends · ${s.friends.length}`))
  for (const u of s.friends) body.append(row(u, act('Message', async () => { void openThread(u) }), ...(s.party?.members.includes(u) ? [] : [act('Invite', () => api('party_invite', { post: { u } }))]), act('Remove', () => api('friend', { post: { u, action: 'remove' } }))))
  if (!s.friends.length) body.append(el('p', 'No friends yet.', 'cc-muted'))
  for (const u of s.outgoing) body.append(row(u + ' · pending'))
}
async function pollSocial(): Promise<void> {
  if (document.hidden || !localStorage.getItem(CLAIMED_KEY)) return
  const r = await api<Social>('social'); if (!r.ok) return
  social = r.data
  let seen: string[] = []; try { seen = JSON.parse(localStorage.getItem(SOC_SEEN) ?? '[]') } catch { seen = [] }
  const fresh = (k: string) => { if (seen.includes(k)) return false; seen.push(k); return true }
  for (const u of r.data.incoming) if (fresh(`f:${u}`)) notify('Friend request', `@${u} wants to be friends.`, undefined, 'invite:friends')
  for (const i of r.data.invites) if (fresh(`p:${i.id}`)) notify('Party invite', `@${i.leader} invited you to a party.`, undefined, 'invite:party')
  const sp = r.data.party?.spot
  if (sp && sp.by !== r.data.me && fresh(`s:${sp.at}`)) notify('Join me', `@${sp.by} shared a spot with the party.`, undefined, 'invite:party')
  localStorage.setItem(SOC_SEEN, JSON.stringify(seen.slice(-200)))
}
window.setTimeout(() => void pollSocial(), 6000)
window.setInterval(() => void pollSocial(), 30000)

// ---------- Player search & profiles ----------
type Presence = { find: (u: string) => { x: number; z: number } | null }
let presence: Presence | null = null
/** main.ts wires live city presence so profiles can say who is online and teleport near them. */
export function setPresence(p: Presence): void { presence = p }
type Profile = { username: string; name: string; rank: string; reputation: number; skills: string[]; pinned: string[]; seen: string | null; look: { h: number; b: number; hair: number | null; skin: number | null }; streak: number }

function searchBox(): HTMLElement {
  const wrap = el('div', '', 'dm-search')
  const inp = el('input'); inp.type = 'search'; inp.placeholder = 'Search players by username'; inp.maxLength = 16; inp.setAttribute('aria-label', 'Search players')
  const out = el('ol', '', 'cc-list dm-results')
  let t = 0, seq = 0
  inp.onkeydown = (e) => e.stopPropagation()
  inp.oninput = () => {
    window.clearTimeout(t)
    const q = inp.value.trim().toLowerCase().replace(/^@/, '')
    if (q.length < 2) { out.replaceChildren(); return }
    t = window.setTimeout(async () => {
      const my = ++seq
      const r = await api<{ results: Array<{ username: string; name: string; rank: string }> }>('search', { q: `&q=${encodeURIComponent(q)}` })
      if (my !== seq) return
      if (!r.ok) { out.replaceChildren(el('li', r.data.error ?? 'Search failed', 'empty')); return }
      out.replaceChildren(...r.data.results.map((p) => {
        const li = el('li'); const b = el('button', '', 'cc-row'); b.type = 'button'
        const on = presence?.find(p.username)
        b.append(el('strong', `@${p.username}${on ? ' · online' : ''}`), el('p', [p.name, p.rank].filter(Boolean).join(' · ') || 'Player'))
        b.onclick = () => void openProfile(p.username)
        li.append(b); return li
      }))
      if (!r.data.results.length) out.append(el('li', 'No players found.', 'empty'))
    }, 280)
  }
  wrap.append(inp, out)
  return wrap
}

const hex = (n: number | null, d: string) => n == null ? d : `#${Math.max(0, Math.min(0xffffff, n)).toString(16).padStart(6, '0')}`
function silhouette(p: Profile): HTMLElement {
  // Simple portrait from the saved look (skin, hair, height, build): no network image needed.
  const skin = hex(p.look.skin, '#8d5a3b'), hair = hex(p.look.hair, '#1d1612')
  const w = Math.round(46 * (p.look.b || 1)), h = Math.round(92 * (p.look.h || 1))
  const box = el('div', '', 'pf-avatar')
  box.innerHTML = `<svg viewBox="0 0 120 140" width="96" height="112" aria-hidden="true"><rect width="120" height="140" rx="16" fill="#1b2420"/><ellipse cx="60" cy="${140 - h + 30}" rx="${w / 2 + 4}" ry="${h / 2}" fill="#33413b"/><circle cx="60" cy="${140 - h + 2}" r="17" fill="${skin}"/><path d="M43 ${140 - h} q17 -22 34 0 q-2 -10 -17 -12 q-15 2 -17 12z" fill="${hair}"/></svg>`
  return box
}

export async function openProfile(username: string): Promise<void> {
  if (!ctx) return
  const u = username.toLowerCase().replace(/^@/, '')
  current = ''
  const title = `Player @${u}`
  ctx.openSheet(title, () => {})
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<{ me: string; self: boolean; profile: Profile; friend: 'none' | 'friends' | 'outgoing' | 'incoming'; inParty: boolean; blocked: boolean }>('profile', { q: `&u=${encodeURIComponent(u)}` })
  if (!ctx.isOpen(title)) return
  if (r.status === 401) return signedOut(body, !(r.data as { noToken?: boolean }).noToken)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load profile.', 'cc-muted')); return }
  const p = r.data.profile
  const here = presence?.find(u) ?? null
  const head = el('div', '', 'pf-head')
  const info = el('div')
  info.append(el('strong', p.name || `@${u}`), el('p', `@${u}`, 'cc-muted'))
  const badges = el('div', '', 'pf-badges')
  const badge = (t: string, cls = '') => badges.append(el('span', t, `pf-badge ${cls}`))
  badge(here ? 'Online · in the city' : p.seen ? `Seen ${when(p.seen)}` : 'Offline', here ? 'on' : '')
  if (p.rank) badge(p.rank)
  if (r.data.friend === 'friends') badge('Friend')
  if (r.data.inParty) badge('In your party')
  if (p.streak >= 3) badge(`${p.streak}-day streak`)
  if (p.reputation >= 1000) badge('Trusted')
  info.append(badges)
  head.append(silhouette(p), info)
  const sheet = el('div', '', 'pf-sheet')
  sheet.append(el('h3', 'Career sheet'), el('p', `Rank: ${p.rank || 'New'} · Reputation ${p.reputation.toLocaleString()}`))
  if (p.skills.length) { const ul = el('ul', '', 'pf-skills'); for (const s of p.skills) ul.append(el('li', s)); sheet.append(ul) }
  else sheet.append(el('p', 'No skills shared yet.', 'cc-muted'))
  sheet.append(el('h3', 'Pinned certificates'))
  if (p.pinned.length) { const ul = el('ul', '', 'pf-certs'); for (const s of p.pinned) ul.append(el('li', s)); sheet.append(ul) }
  else sheet.append(el('p', 'Nothing pinned.', 'cc-muted'))
  const acts = el('div', '', 'pf-actions'); const st = el('p', '', 'cc-muted')
  const btn = (t: string, fn: () => Promise<unknown> | void, cls = 'dm-primary') => { const b = el('button', t, cls); b.type = 'button'; b.onclick = async () => { b.disabled = true; try { await fn() } finally { b.disabled = false } }; acts.append(b); return b }
  if (!r.data.self) {
    btn('Message', () => { void openThread(u) })
    const fl = { none: 'Add friend', outgoing: 'Request sent', incoming: 'Accept friend', friends: 'Friends ✓' }[r.data.friend]
    const fb = btn(fl, async () => { const x = await api<{ status?: string }>('friend', { post: { u, action: 'add' } }); st.textContent = x.ok ? (x.data.status === 'accepted' ? `You and @${u} are friends.` : 'Friend request sent.') : (x.data.error ?? 'Failed'); if (x.ok) fb.textContent = x.data.status === 'accepted' ? 'Friends ✓' : 'Request sent' }, 'cc-link')
    if (r.data.friend === 'friends' || r.data.friend === 'outgoing') fb.disabled = true, fb.onclick = null
    if (!r.data.inParty) btn('Invite to party', async () => { const x = await api('party_invite', { post: { u } }); st.textContent = x.ok ? `Party invite sent to @${u}.` : (x.data.error === 'Invite friends only' ? 'Add them as a friend first: only friends can be invited.' : (x.data.error ?? 'Failed')) }, 'cc-link')
    if (here) btn('Find on map', () => { window.dispatchEvent(new CustomEvent('gd-find', { detail: { u, ...here } })) }, 'cc-link')
    if (here) btn('Go near them', () => { const at = presence?.find(u); if (at) window.dispatchEvent(new CustomEvent('gd-teleport', { detail: { ...at, who: u } })); else st.textContent = `@${u} just left the city.` }, 'cc-link')
  } else acts.append(el('p', 'This is you.', 'cc-muted'))
  const back = el('button', '‹ Messages', 'cc-link'); back.type = 'button'; back.onclick = () => void openInbox()
  body.replaceChildren(back, head, acts, st, sheet)
}
