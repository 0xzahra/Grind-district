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
  const token = localStorage.getItem(CLAIMED_KEY) ? await accessToken() : null
  if (!token) return { ok: false, status: 401, data: { error: 'Sign in to use messages' } as T & { error?: string } }
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

function signedOut(body: HTMLElement) {
  body.replaceChildren(
    el('p', 'Messages go to a player’s Messages tab even when they are offline. Sign in and claim a username to send and receive them.', 'cc-muted'),
  )
  const sign = el('button', 'Sign in', 'dm-primary'); sign.type = 'button'; sign.onclick = () => openLogin()
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
  if (r.status === 401) return signedOut(body)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load messages.', 'cc-muted'), nearbyRow()); return }
  setUnread(r.data.threads.reduce((s, t) => s + t.unread, 0))
  const list = el('ol', '', 'cc-list dm-threads')
  for (const t of r.data.threads) {
    const li = el('li', '', t.unread ? 'unread' : 'read')
    const btn = el('button', '', 'cc-row'); btn.type = 'button'
    btn.append(el('strong', `@${t.with}${t.unread ? ` · ${t.unread} new` : ''}`), el('time', when(t.at)), el('p', `${t.mine ? 'You: ' : ''}${t.last}`.slice(0, 120)))
    btn.onclick = () => void openThread(t.with)
    li.append(btn); list.append(li)
  }
  if (!r.data.threads.length) list.append(el('li', 'No messages yet. Tap a player in the city, then Message.', 'empty'))
  const fr = el('button', '', 'cc-row dm-nearby'); fr.type = 'button'
  fr.append(el('strong', 'Friends & party'), el('p', 'Add friends, party up to 4, join me.'))
  fr.onclick = () => void openFriends()
  body.replaceChildren(el('p', `Signed in as @${r.data.me}`, 'cc-muted'), nearbyRow(), fr, list)
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
  if (r.status === 401) return signedOut(body)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load.', 'cc-muted')); return }
  const back = el('button', '‹ All messages', 'cc-link'); back.type = 'button'; back.onclick = () => void openInbox()
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
  body.replaceChildren(back, log, form, status, safety)
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
  if (r.status === 401) return signedOut(body)
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
