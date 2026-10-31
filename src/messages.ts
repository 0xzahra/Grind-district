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
  body.replaceChildren(el('p', `Signed in as @${r.data.me}`, 'cc-muted'), nearbyRow(), list)
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
  const safety = el('div', '', 'dm-safety')
  const block = el('button', r.data.blocked ? 'Unblock' : 'Block', 'cc-link'); block.type = 'button'
  block.onclick = async () => {
    const on = block.textContent === 'Block'
    if (on && !confirm(`Block @${u}? They will not be able to message you.`)) return
    const x = await api('block', { post: { u, on } })
    if (x.ok) { block.textContent = on ? 'Unblock' : 'Block'; form.hidden = on }
  }
  form.hidden = r.data.blocked
  safety.append(block)
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
