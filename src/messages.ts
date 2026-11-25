// Direct messages (GDD §9 "full messaging"): a Messages tab in the Control Centre, threads per player,
// notifications merged into the Control Centre inbox. Server: /api/messages (Privy-verified, service role only).
const CLAIMED_KEY = 'gd.privy.username'
const accessToken = async () => (await import('./login.ts')).accessToken()
const openLogin = (notice = '') => void import('./login.ts').then((m) => m.openLogin(notice))
// NEAR sign-ins have no Privy session: Messages swaps the NEAR game session for its own 30-day token
// (api/messages.ts op=near-session), kept per NEAR account. It never signs anyone into a different account.
const DM_NEAR = 'gd.dm.near.v1'
const NEAR_RECIPIENT = 'grinddistrict.vercel.app'
const userId = () => { try { return localStorage.getItem('gd.privy.userId') ?? '' } catch { return '' } }
async function nearSession(proof: unknown): Promise<string | null> {
  const r = await fetch('/api/messages?op=near-session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ near: proof }) }).catch(() => null)
  const j = (await r?.json().catch(() => ({})) ?? {}) as { token?: string; exp?: number; error?: string }
  if (!r?.ok || !j.token || !j.exp) throw new Error(j.error ?? 'Could not open Messages')
  try { localStorage.setItem(DM_NEAR, JSON.stringify({ uid: userId(), token: j.token, exp: j.exp })) } catch { /* session only */ }
  return j.token
}
async function nearToken(): Promise<string | null> {
  try { const s = JSON.parse(localStorage.getItem(DM_NEAR) ?? 'null') as { uid?: string; token?: string; exp?: number } | null; if (s?.token && s.uid === userId() && (s.exp ?? 0) > Date.now() + 60_000) return s.token } catch { /* */ }
  // Just signed in with NEAR on this page: its game session is enough, no second prompt.
  const proof = (await import('./state.ts')).heldNearProof()
  return proof ? nearSession(proof).catch(() => null) : null
}
import { notify } from './notify.ts'
import { note as personaNote } from './persona.ts'
import './messages.css'

type Line = { id: number; sender: string; recipient: string; body: string; created_at: string; read_at: string | null; edited?: boolean; media?: { kind: 'image' | 'voice' | 'video' | 'file'; url: string; name?: string } }
type Attachment = { type: string; data: string }
/** Messages whose photo or video already got one fresh link (so a broken file never reloads the chat in a loop). */
const refreshed = new Set<number>()
/** The newest message drawn in the open chat (a poll reopens it only for something newer). */
let shownId = 0

const toBase64 = (blob: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => no(r.error); r.readAsDataURL(blob) })
/** A photo, resized on the phone so it sends fast (long side 1280 px, then 960 px if still large). */
async function photoAttachment(file: File): Promise<Attachment> {
  const bmp = await createImageBitmap(file)
  for (const [side, q] of [[1280, 0.8], [960, 0.7], [720, 0.62]] as const) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', q))
    if (blob && blob.size < 430_000) return { type: 'image/jpeg', data: await toBase64(blob) }
  }
  throw new Error('Photo too large')
}
const VOICE_TYPE = typeof MediaRecorder === 'undefined' ? '' : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
type Thread = { with: string; last: string; at: string; mine: boolean; unread: number; lastId: number; name?: string; char?: Char | null }
/** The character a player picked (figure, height, colours), as published with their profile. */
export type Char = { m: string; h: number; l: Record<string, unknown> }
let maker: ((c: Char) => Promise<string | null>) | null = null
/** main.ts draws player pictures (their character, head and shoulders) with the game's own renderer. */
export function setPortraitMaker(fn: (c: Char) => Promise<string | null>): void { maker = fn }
/** A round picture of a player: their character once it is drawn; until then (or with none) their initial. */
function avatar(u: string, name: string, char: Char | null | undefined, size: number, online = false): HTMLElement {
  const box = el('span', '', `av${online ? ' on' : ''}`)
  box.style.width = box.style.height = `${size}px`
  let hue = 0
  for (const ch of u) hue = (hue * 31 + ch.charCodeAt(0)) % 360
  box.style.setProperty('--av-bg', `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${(hue + 40) % 360} 48% 20%))`)
  const letter = el('span', (name.replace(/^@/, '')[0] ?? u[0] ?? '?').toUpperCase(), 'av-letter')
  letter.style.fontSize = `${Math.round(size * 0.42)}px`
  box.append(letter)
  if (char && maker) void maker(char).then((url) => { if (!url) return; box.style.setProperty('--av-pic', `url("${url}")`); box.classList.add('pic'); letter.remove() }).catch(() => undefined)
  return box
}
// Characters for people we only know by username (the Players online list): fetched in small batches, cached.
const charCache = new Map<string, Char | null>()
const charWaiters = new Map<string, Array<(c: Char | null) => void>>()
let charWant = new Set<string>(), charTimer = 0
async function fetchChars(): Promise<void> {
  charTimer = 0
  const names = [...charWant].slice(0, 40)
  charWant = new Set([...charWant].slice(40))
  if (charWant.size) charTimer = window.setTimeout(() => void fetchChars(), 300)
  const r = await api<{ people?: Record<string, { char: Char | null }> }>('cards', { q: `&u=${encodeURIComponent(names.join(','))}` })
  for (const n of names) {
    const c = r.ok ? (r.data.people?.[n]?.char ?? null) : null
    if (r.ok) charCache.set(n, c)
    for (const f of charWaiters.get(n) ?? []) f(c)
    charWaiters.delete(n)
  }
}
/** A player's picture by username: their character once known (the initial on a colour until then). */
export function playerPic(u: string, name: string, size: number, online = false): HTMLElement {
  const known = charCache.get(u)
  const box = avatar(u, name, known ?? null, size, online)
  if (known === undefined && /^[a-z0-9_]{2,20}$/.test(u)) {
    const list = charWaiters.get(u) ?? []
    list.push((c) => { if (c && maker) void maker(c).then((url) => { if (!url) return; box.style.setProperty('--av-pic', `url("${url}")`); box.classList.add('pic'); box.querySelector('.av-letter')?.remove() }).catch(() => undefined) })
    charWaiters.set(u, list)
    charWant.add(u)
    if (!charTimer) charTimer = window.setTimeout(() => void fetchChars(), 60)
  }
  return box
}
/** The chat look (no panel title bar: the chat has its own) is only for an open conversation. */
function chatMode(on: boolean): void { document.getElementById('cc-sheet')?.classList.toggle('dm-chat', on) }
type Ctx = { openSheet: (title: string, fill: () => void) => void; body: () => HTMLElement; openNearby: () => void; isOpen: (title: string) => boolean }

const MAX = 500
const SEEN = 'gd.dm.seen.v1'
let ctx: Ctx | null = null
let unread = 0
let current = ''

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
// Inbox time, the way messaging apps show it: the time today, Yesterday, the weekday this week, else the date.
const ago = (iso: string) => {
  const d = new Date(iso), now = new Date()
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day(now) - day(d)) / 864e5)
  if (days <= 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

async function api<T>(op: string, opts: { q?: string; post?: Record<string, unknown> } = {}): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  // Guests (no claimed username) never load the Privy SDK here.
  // Any Privy trace (claimed username, user id, or an SDK session key) means try for a token: a session restored
  // from Google/email on this device may not have the username cached yet.
  const known = localStorage.getItem(CLAIMED_KEY) || localStorage.getItem('gd.privy.userId') || Object.keys(localStorage).some((k) => k.startsWith('privy:'))
  const token = userId().startsWith('near:') ? await nearToken() : known ? await accessToken() : null
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
  // Already playing under a username: never offer a generic sign-in here. Picking a different Google / X / email
  // account in it loads that account's own progress, which looked like the game switching players.
  const uid = userId(), handle = (() => { try { return localStorage.getItem(CLAIMED_KEY) ?? '' } catch { return '' } })()
  if (uid.startsWith('near:') && handle) {
    const acct = uid.slice(5)
    const status = el('p', '', 'cc-muted'); status.setAttribute('role', 'status')
    const go = el('button', 'Confirm with NEAR wallet', 'dm-primary'); go.type = 'button'
    go.onclick = () => void confirmNear(acct, go, status)
    body.replaceChildren(el('p', `You are playing as @${handle} with the NEAR account ${acct}. Confirm with that wallet once to open Messages on this device. It is a signed message only: no fee, nothing goes on-chain.`, 'cc-muted'), go, status, nearbyRow())
    return
  }
  if (handle && !hasSession) {
    const again = el('button', `Sign in as @${handle}`, 'dm-primary'); again.type = 'button'
    again.onclick = () => openLogin(`Use the Google, X or email account that owns @${handle}. Another account opens its own progress.`)
    body.replaceChildren(el('p', `You are playing as @${handle}, but this device's sign-in has expired. Sign in again with the same Google, X or email account you used for @${handle}; a different account would open that account's own progress instead.`, 'cc-muted'), again, nearbyRow())
    return
  }
  // hasSession: a valid Privy token exists but no username is linked to it yet, so the fix is claiming one, not signing in.
  body.replaceChildren(
    el('p', hasSession
      ? 'You are signed in, but no username is linked yet. Claim one to send and receive messages.'
      : 'Messages go to a player’s Messages tab even when they are offline. Sign in and claim a username to send and receive them.', 'cc-muted'),
  )
  const sign = el('button', hasSession ? 'Claim username' : 'Sign in', 'dm-primary'); sign.type = 'button'; sign.onclick = () => openLogin()
  body.append(sign, nearbyRow())
}

async function confirmNear(acct: string, btn: HTMLButtonElement, status: HTMLElement): Promise<void> {
  btn.disabled = true
  status.textContent = 'Opening your NEAR wallet…'
  try {
    const { NearConnector } = await import('@hot-labs/near-connect')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = new NearConnector({ network: 'testnet', features: { signMessage: true } }) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w: any = (await c.wallet().catch(() => null)) ?? (await c.connect())
    const nonce = crypto.getRandomValues(new Uint8Array(32))
    const nonceB64 = btoa(String.fromCharCode(...Array.from(nonce)))
    const message = `Grind District login\n${Date.now()}\n${nonceB64}`
    const signed = await w.signMessage({ message, recipient: NEAR_RECIPIENT, nonce }) as { accountId?: string; publicKey: string; signature: string }
    const accountId = (signed.accountId || (await w.getAccounts())[0]?.accountId || '').toLowerCase()
    if (accountId !== acct) throw new Error(`That wallet is ${accountId || 'another account'}. Pick ${acct}, the account you play with.`)
    status.textContent = 'Opening Messages…'
    await nearSession({ accountId, publicKey: signed.publicKey, signature: signed.signature, message, recipient: NEAR_RECIPIENT, nonce: nonceB64 })
    void openInbox()
  } catch (e) {
    btn.disabled = false
    const m = (e as Error).message || 'Could not confirm'
    status.textContent = /cancel|denied|closed|reject/i.test(m) ? 'Cancelled. Nothing changed.' : m
  }
}

/** A quick tile on the Messages home: an icon, a title and one line, the whole tile tappable. */
function tile(icon: string, title: string, sub: string, cls: string, go: () => void) {
  const b = el('button', '', `dm2-tile ${cls}`); b.type = 'button'
  const ic = el('span', '', 'dm2-tile-ico'); ic.innerHTML = icon
  const t = el('span', '', 'dm2-tile-t'); t.append(el('b', title), el('small', sub))
  b.append(ic, t)
  b.onclick = go
  return b
}
function nearbyRow() {
  return tile('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/></svg>', 'Nearby chat', 'Talk to players around you', 'near', () => ctx?.openNearby())
}
function friendsTile() {
  return tile('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.6-.3 4.8 1.2 5.5 4.3"/></svg>', 'Friends & party', 'Add friends, play together', 'friends', () => void openFriends())
}

export async function openInbox(): Promise<void> {
  if (!ctx) return
  current = ''
  ctx.openSheet('Messages', () => {})
  chatMode(false)
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<{ me: string; threads: Thread[]; blocked: string[] }>('inbox')
  if (!ctx.isOpen('Messages') || current) return
  if (r.status === 401) return signedOut(body, !(r.data as { noToken?: boolean }).noToken)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load messages.', 'cc-muted'), nearbyRow()); return }
  setUnread(r.data.threads.reduce((s, t) => s + t.unread, 0))
  const list = el('ol', '', 'cc-list dm-threads dm2-threads')
  for (const t of r.data.threads) {
    const li = el('li', '', t.unread ? 'unread' : 'read')
    const btn = el('button', '', 'dm2-row'); btn.type = 'button'
    const name = t.name || `@${t.with}`
    const mid = el('span', '', 'dm2-row-mid')
    const top = el('span', '', 'dm2-row-top'); top.append(el('b', name), el('time', ago(t.at)))
    const bottom = el('span', '', 'dm2-row-bottom'); bottom.append(el('span', `${t.mine ? 'You: ' : ''}${t.last}`.slice(0, 120), 'dm2-row-last'))
    if (t.unread) bottom.append(el('span', t.unread > 9 ? '9+' : String(t.unread), 'dm2-unread'))
    mid.append(top, bottom)
    btn.append(avatar(t.with, name, t.char ?? null, 48, !!presence?.find(t.with)), mid)
    btn.onclick = () => void openThread(t.with)
    li.append(btn); list.append(li)
  }
  if (!r.data.threads.length) list.append(el('li', 'No messages yet. Tap a player in the city, then Message.', 'empty'))
  const quick = el('div', '', 'dm2-quick'); quick.append(nearbyRow(), friendsTile())
  body.replaceChildren(el('p', `Signed in as @${r.data.me}`, 'cc-muted dm2-me'), searchBox(), quick, el('h3', 'Conversations'), list)
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

/** A voice note: play / pause, a bar you can drag to any point, and the time. (The browser's own player was
 *  squeezed into a dot in the chat bubble, and recorded notes often report no length until fully loaded, which
 *  made them impossible to scrub.) */
function voicePlayer(url: string): HTMLElement {
  const box = el('div', '', 'dm-voice')
  const au = new Audio(); au.preload = 'metadata'; au.src = url
  const play = el('button', '▶', 'dm-vplay'); play.type = 'button'; play.setAttribute('aria-label', 'Play voice note')
  const bar = el('input', '', 'dm-vbar') as HTMLInputElement; bar.type = 'range'; bar.min = '0'; bar.max = '1000'; bar.value = '0'; bar.setAttribute('aria-label', 'Position in the voice note')
  const time = el('span', '0:00', 'dm-vtime')
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
  let len = 0, dragging = false
  const known = () => Number.isFinite(au.duration) && au.duration > 0
  au.addEventListener('loadedmetadata', () => {
    if (known()) { len = au.duration; time.textContent = fmt(len); return }
    // Length unknown (a recorded webm): jump far ahead once so the browser works it out, then come back.
    const fix = () => { if (known()) { len = au.duration; au.currentTime = 0; time.textContent = fmt(len); au.removeEventListener('durationchange', fix) } }
    au.addEventListener('durationchange', fix)
    au.currentTime = 1e7
  })
  au.addEventListener('timeupdate', () => { if (!dragging && len) { bar.value = String(Math.round((au.currentTime / len) * 1000)); time.textContent = fmt(au.paused && au.currentTime === 0 ? len : au.currentTime) } })
  au.addEventListener('play', () => { play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pause') })
  au.addEventListener('pause', () => { play.textContent = '▶'; play.setAttribute('aria-label', 'Play voice note') })
  au.addEventListener('ended', () => { bar.value = '0'; time.textContent = fmt(len) })
  play.onclick = () => { if (au.paused) void au.play().catch(() => undefined); else au.pause() }
  bar.oninput = () => { dragging = true; if (len) time.textContent = fmt((Number(bar.value) / 1000) * len) }
  bar.onchange = () => { dragging = false; if (len) au.currentTime = (Number(bar.value) / 1000) * len }
  for (const ev of ['pointerdown', 'touchstart'] as const) bar.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })
  box.append(play, bar, time)
  return box
}

export async function openThread(withUser: string): Promise<void> {
  if (!ctx) return
  const u = withUser.toLowerCase()
  current = u
  ctx.openSheet(`@${u}`, () => {})
  chatMode(true)
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<{ me: string; lines: Line[]; blocked: boolean; peer?: { name: string; seen: string | null; char: Char | null } }>('thread', { q: `&with=${encodeURIComponent(u)}` })
  if (current !== u) return
  if (r.status === 401) { chatMode(false); return signedOut(body, !(r.data as { noToken?: boolean }).noToken) }
  if (!r.ok) { chatMode(false); body.replaceChildren(el('p', r.data.error ?? 'Could not load.', 'cc-muted')); return }
  // Top bar, as in a messaging app: back to all chats, their character, name and whether they are around. The
  // whole name area opens their profile (Add friend, Block and the rest live there).
  const here = presence?.find(u) ?? null
  const name = r.data.peer?.name || `@${u}`
  const head = el('div', '', 'dm2-head')
  const back = el('button', '‹', 'dm2-back'); back.type = 'button'; back.setAttribute('aria-label', 'All messages'); back.onclick = () => void openInbox()
  const who = el('button', '', 'dm2-who'); who.type = 'button'; who.setAttribute('aria-label', `@${u}'s profile`); who.onclick = () => void openProfile(u)
  const meta = el('span', '', 'dm2-meta')
  meta.append(el('b', name), el('small', here ? 'Online now' : r.data.peer?.seen ? `Last seen ${ago(r.data.peer.seen).toLowerCase() === 'yesterday' ? 'yesterday' : ago(r.data.peer.seen)}` : `@${u}`, here ? 'on' : ''))
  who.append(avatar(u, name, r.data.peer?.char ?? null, 42, !!here), meta)
  head.append(back, who)
  const log = el('ol', '', 'dm-log dm2-log')
  const status = el('p', '', 'cc-muted dm2-status')
  // A small menu on a message: your own (Edit for 24 hours, Delete for both), or theirs (Report).
  const menuFor = (li: HTMLElement, items: Array<[string, string, () => void]>) => {
    li.querySelector('.dm-menu')?.remove()
    const menu = el('div', '', 'dm-menu')
    for (const [label, cls, fn] of items) { const bt = el('button', label, cls); bt.type = 'button'; bt.onclick = () => { menu.remove(); fn() }; menu.append(bt) }
    li.append(menu)
    const away = (e: Event) => { if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener('pointerdown', away, true) } }
    window.setTimeout(() => document.addEventListener('pointerdown', away, true), 0)
  }
  shownId = 0
  // Quick replies above the typing box, like the suggested replies on LinkedIn: a greeting to open a chat, a thanks
  // or a thumbs-up to answer one. One tap sends it; a draft you were typing is kept.
  const quick = el('div', '', 'dm-quick'); quick.setAttribute('role', 'group'); quick.setAttribute('aria-label', 'Quick replies')
  let lastLine: Line | null = null
  let sendQuick: (t: string) => void = () => {}
  const paintQuick = () => {
    const fromThem = !!lastLine && lastLine.sender !== r.data.me
    const said = (lastLine?.body ?? '').toLowerCase()
    const salam = /\bsala+m|assala|as-sala|salamu|salaam/.test(said)
    const thanks = /thank|thx|jazak/.test(said)
    const question = /\?\s*$/.test(said)
    const opts = !lastLine ? ['Hi 👋', 'Assalamu alaikum', 'GM ☀️', 'Nice to meet you!', 'How are you?', 'Want to play together? 🎮']
      : fromThem ? [...(salam ? ['Wa alaikumussalam'] : []), ...(thanks ? ['You’re welcome 😊'] : []), ...(question ? ['Yes', 'Not yet'] : []), '👍', 'Thanks!', 'Thanks for sharing', 'Sounds good', 'See you in the city 🏙️']
      : ['👋', 'Any news?', 'Let’s meet in the city', 'Talk soon!']
    quick.replaceChildren(...opts.slice(0, 7).map((t) => { const b = el('button', t, 'dm-chip'); b.type = 'button'; b.onclick = () => sendQuick(t); return b }))
  }
  const add = (l: Line, at?: Element) => {
    if (!at && (!lastLine || l.id >= lastLine.id)) { lastLine = l; paintQuick() }
    shownId = Math.max(shownId, l.id)
    const mine = l.sender === r.data.me
    const li = el('li', '', mine ? 'mine' : 'theirs')
    if (l.media?.kind === 'image') {
      const img = el('img', '', 'dm-photo'); img.src = l.media.url; img.alt = 'Photo'; img.loading = 'lazy'
      img.onclick = () => window.open(l.media!.url, '_blank', 'noopener')
      // A photo link lasts an hour: if it fails (an old chat left open), load the chat once more for fresh links.
      img.onerror = () => { if (!refreshed.has(l.id)) { refreshed.add(l.id); void openThread(u) } }
      li.append(img)
    } else if (l.media?.kind === 'voice') {
      li.append(voicePlayer(l.media.url))
    } else if (l.media?.kind === 'video') {
      const v = el('video', '', 'dm-video'); v.src = l.media.url; v.controls = true; v.playsInline = true; v.preload = 'metadata'
      v.onerror = () => { if (!refreshed.has(l.id)) { refreshed.add(l.id); void openThread(u) } }
      li.append(v)
    } else if (l.media?.kind === 'file') {
      const a = el('a', '', 'dm-file'); a.href = l.media.url; a.target = '_blank'; a.rel = 'noopener noreferrer'
      const nm = l.media.name ?? 'Document'
      const ext = (/\.([a-z0-9]{2,5})$/i.exec(nm)?.[1] ?? 'doc').toUpperCase()
      a.append(el('span', ext, `dm-file-ico x-${ext.toLowerCase()}`), el('span', nm, 'dm-file-name'), el('span', 'Open', 'dm-file-go'))
      li.append(a)
    }
    const text = el('p', l.body)
    if (l.body) li.append(text)
    const stamp = el('time', `${l.edited ? 'Edited · ' : ''}${new Date(l.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`)
    stamp.title = when(l.created_at)
    li.append(stamp)
    const more = el('button', '⋯', 'dm-more'); more.type = 'button'; more.setAttribute('aria-label', mine ? 'Edit or delete this message' : 'Report this message')
    more.onclick = (ev) => {
      ev.stopPropagation()
      if (!mine) {
        menuFor(li, [['⚑  Report', 'danger', async () => {
          if (!confirm(`Report this message from @${u}?`)) return
          const x = await api('report', { post: { u, id: l.id, reason: 'message' } })
          status.textContent = x.ok ? 'Reported. Thank you.' : 'Could not report it.'
        }]])
        return
      }
      const items: Array<[string, string, () => void]> = []
      if (Date.now() - Date.parse(l.created_at) < 86_400_000) items.push(['✏️  Edit', '', () => {
        const box = el('textarea', '', 'dm-edit') as HTMLTextAreaElement; box.value = l.body; box.maxLength = MAX; box.rows = 2
        box.onkeydown = (e) => e.stopPropagation()
        const save = el('button', 'Save', 'dm-primary'), cancel = el('button', 'Cancel', 'cc-link')
        save.type = 'button'; cancel.type = 'button'
        const row = el('div', '', 'dm-edit-row'); row.append(cancel, save)
        text.hidden = true
        li.insertBefore(box, stamp); li.insertBefore(row, stamp)
        box.focus()
        cancel.onclick = () => { box.remove(); row.remove(); text.hidden = !l.body }
        save.onclick = async () => {
          save.disabled = true
          const x = await api<{ line: Line }>('edit', { post: { id: l.id, text: box.value } })
          if (!x.ok) { save.disabled = false; status.textContent = x.data.error ?? 'Could not edit'; return }
          add(x.data.line, li); li.remove()
        }
      }])
      items.push(['🗑  Delete for both', 'danger', async () => {
        if (!confirm('Delete this message for both of you?')) return
        const x = await api('delete', { post: { id: l.id } })
        if (x.ok) li.remove(); else status.textContent = 'Could not delete the message'
      }])
      menuFor(li, items)
    }
    li.append(more)
    if (at) log.insertBefore(li, at); else log.append(li)
  }
  r.data.lines.forEach((l) => add(l))
  if (!r.data.lines.length) { log.append(el('li', `Say hi to ${name}. They get a notification.`, 'dm-empty')); paintQuick() }
  // The composer: a slim bar. Photo on the left, the message in a rounded field that grows with the words, and on
  // the right the microphone (hold a voice note) or, once there is something to send, the send key.
  const form = el('form', '', 'dm2-bar')
  const ta = el('textarea', '', 'dm2-field'); ta.maxLength = MAX; ta.rows = 1; ta.placeholder = 'Message'; ta.setAttribute('aria-label', `Message @${u}`)
  const count = el('small', '', 'dm2-count')
  const send = el('button', '', 'dm2-send'); send.type = 'submit'; send.setAttribute('aria-label', 'Send'); send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-4 16-4-6-8-2Z"/></svg>'
  const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 120)}px` }
  let pending: Attachment | null = null
  let pendingFile: File | null = null
  let recording = false
  const mic = VOICE_TYPE && typeof navigator.mediaDevices?.getUserMedia === 'function' ? el('button', '', 'dm2-mic') : null
  const sync = () => {
    const has = !!ta.value.trim() || !!pending || !!pendingFile
    quick.hidden = has || recording
    send.hidden = !has && !!mic && !recording
    if (mic) mic.hidden = has && !recording
    count.textContent = ta.value.length > MAX - 100 ? `${ta.value.length}/${MAX}` : ''
  }
  ta.oninput = () => { grow(); sync() }
  ta.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit() } }
  const deliver = async (media?: Attachment) => {
    const text = ta.value.trim()
    if (!text && !media) return
    personaNote('message')
    send.disabled = true; status.textContent = media ? (media.type.startsWith('image') ? 'Sending photo…' : 'Sending voice note…') : ''
    const s = await api<{ line: Line }>('send', { post: { to: u, text, ...(media ? { media } : {}) } })
    send.disabled = false
    if (!s.ok) { status.textContent = s.data.error ?? 'Could not send'; return }
    status.textContent = ''
    log.querySelector('.dm-empty')?.remove()
    add(s.data.line); ta.value = ''; grow(); sync()
    log.scrollTop = log.scrollHeight
  }
  sendQuick = (t: string) => {
    if (send.disabled) return
    const draft = ta.value
    ta.value = t
    void deliver().then(() => { if (draft && !ta.value) { ta.value = draft; grow(); sync() } })
  }
  // Videos and documents: a one-time upload link from the server, the file straight to private storage (with
  // progress), then the message with the file attached.
  const deliverFile = async (f: File) => {
    const text = ta.value.trim()
    const what = f.type.startsWith('video') || /\.(mp4|webm|mov)$/i.test(f.name) ? 'video' : 'document'
    personaNote('message')
    send.disabled = true; status.textContent = `Uploading ${what}…`
    const slot = await api<{ path: string; url: string }>('upload', { post: { name: f.name, size: f.size } })
    if (!slot.ok) { send.disabled = false; status.textContent = slot.data.error ?? 'Could not upload'; return }
    const ok = await new Promise<boolean>((done) => {
      const x = new XMLHttpRequest()
      x.open('PUT', slot.data.url)
      x.setRequestHeader('x-upsert', 'false')
      x.upload.onprogress = (e) => { if (e.lengthComputable) status.textContent = `Uploading ${what} · ${Math.round((e.loaded / e.total) * 100)}%` }
      x.onload = () => done(x.status >= 200 && x.status < 300)
      x.onerror = () => done(false)
      const fd = new FormData(); fd.append('cacheControl', '3600'); fd.append('', f)
      x.send(fd)
    })
    if (!ok) { send.disabled = false; status.textContent = 'The upload did not finish. Check your connection and try again.'; return }
    status.textContent = 'Sending…'
    const s = await api<{ line: Line }>('send', { post: { to: u, text, upload: { path: slot.data.path, name: f.name } } })
    send.disabled = false
    if (!s.ok) { status.textContent = s.data.error ?? 'Could not send'; return }
    status.textContent = ''
    log.querySelector('.dm-empty')?.remove()
    add(s.data.line); ta.value = ''; grow(); sync()
    log.scrollTop = log.scrollHeight
  }
  // Photo: pick or take one; it shows above the bar first (add words if you like), and goes when you tap send.
  const tray = el('div', '', 'dm-tray'); tray.hidden = true
  const clearTray = () => { pending = null; pendingFile = null; for (const v of tray.querySelectorAll('video')) URL.revokeObjectURL(v.src); tray.hidden = true; tray.replaceChildren(); ta.placeholder = 'Message'; sync() }
  form.onsubmit = (e) => {
    e.preventDefault()
    if (pendingFile) { const f = pendingFile; clearTray(); void deliverFile(f); return }
    const media = pending ?? undefined
    if (media) clearTray()
    void deliver(media)
  }
  const pick = el('input'); pick.type = 'file'; pick.accept = 'image/*'; pick.hidden = true
  const photo = el('button', '', 'dm2-icon'); photo.type = 'button'; photo.setAttribute('aria-label', 'Send a photo')
  photo.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></svg>'
  photo.onclick = () => pick.click()
  // Attach: a video or a document (PDF, Word, Excel, PowerPoint, text).
  const pickFile = el('input'); pickFile.type = 'file'; pickFile.hidden = true
  pickFile.accept = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
  const clip = el('button', '', 'dm2-icon dm2-clip'); clip.type = 'button'; clip.setAttribute('aria-label', 'Send a video or a document')
  clip.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5 12.4 19a5 5 0 0 1-7.1-7.1l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.3-7.3"/></svg>'
  clip.onclick = () => pickFile.click()
  pickFile.onchange = () => {
    const f = pickFile.files?.[0]; pickFile.value = ''
    if (!f) return
    clearTray()
    pendingFile = f
    const isVideo = f.type.startsWith('video') || /\.(mp4|webm|mov)$/i.test(f.name)
    const mb = f.size >= 1_000_000 ? `${(f.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1000))} KB`
    let thumb: HTMLElement
    if (isVideo) { const v = el('video', '', 'dm-tray-img'); v.src = URL.createObjectURL(f); v.muted = true; v.playsInline = true; v.preload = 'metadata'; thumb = v }
    else { const ext = (/\.([a-z0-9]{2,5})$/i.exec(f.name)?.[1] ?? 'doc').toUpperCase(); thumb = el('span', ext, `dm-file-ico x-${ext.toLowerCase()}`) }
    const info = el('span', '', 'dm-tray-info'); info.append(el('b', f.name), el('small', `${isVideo ? 'Video' : 'Document'} · ${mb} · add a message, then tap send`, 'cc-muted'))
    const rm = el('button', 'Remove', 'cc-link'); rm.type = 'button'; rm.onclick = clearTray
    tray.replaceChildren(thumb, info, rm)
    tray.hidden = false
    ta.placeholder = 'Add a message'
    sync()
  }
  pick.onchange = async () => {
    const f = pick.files?.[0]; pick.value = ''
    if (!f) return
    pendingFile = null
    try {
      pending = await photoAttachment(f)
      const img = el('img', '', 'dm-tray-img'); img.src = `data:${pending.type};base64,${pending.data}`; img.alt = 'Photo to send'
      const rm = el('button', 'Remove', 'cc-link'); rm.type = 'button'; rm.onclick = clearTray
      tray.replaceChildren(img, el('span', 'Add a caption, then tap send.', 'cc-muted'), rm)
      tray.hidden = false
      ta.placeholder = 'Add a caption'
      sync()
      ta.focus({ preventScroll: true })
    } catch { status.textContent = 'That photo could not be used. Try a smaller one.' }
  }
  // Voice note: tap the microphone to record (up to a minute), tap again to send.
  if (mic) {
    mic.type = 'button'; mic.setAttribute('aria-label', 'Record a voice note')
    const micIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>'
    mic.innerHTML = micIcon
    let rec: MediaRecorder | null = null, started = 0, tick = 0, stop = 0
    mic.onclick = async () => {
      if (rec) { rec.stop(); return }
      let stream: MediaStream
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) } catch { status.textContent = 'Microphone permission was not given.'; return }
      const chunks: Blob[] = []
      rec = new MediaRecorder(stream, { mimeType: VOICE_TYPE, audioBitsPerSecond: 32000 })
      rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data) }
      rec.onstop = async () => {
        window.clearInterval(tick); window.clearTimeout(stop)
        stream.getTracks().forEach((t) => t.stop())
        const secs = (performance.now() - started) / 1000
        rec = null; recording = false; mic.innerHTML = micIcon; mic.classList.remove('live'); form.classList.remove('rec'); sync()
        if (secs < 0.7) return
        try { await deliver({ type: (chunks[0]?.type || VOICE_TYPE).split(';')[0]!, data: await toBase64(new Blob(chunks, { type: chunks[0]?.type || VOICE_TYPE })) }) } catch { status.textContent = 'Could not send the voice note.' }
      }
      started = performance.now(); rec.start(); recording = true; mic.classList.add('live'); form.classList.add('rec'); sync()
      const show = () => { const t = Math.floor((performance.now() - started) / 1000); mic.textContent = `■ 0:${String(t).padStart(2, '0')}` }
      show(); tick = window.setInterval(show, 500)
      stop = window.setTimeout(() => rec?.stop(), 60_000)
    }
  }
  form.append(photo, pick, clip, pickFile, ta, count, send, ...(mic ? [mic] : []))
  sync()
  if (r.data.blocked) {
    form.hidden = true
    quick.hidden = true
    status.textContent = `You blocked ${name}. Unblock them from their profile to message again.`
  } else window.setTimeout(() => ta.focus({ preventScroll: true }), 60)
  body.replaceChildren(head, log, status, tray, quick, form)
  log.scrollTop = log.scrollHeight
  void poll()
}

/** Anyone signed in can have messages: a claimed username, a Privy session, or a NEAR account. */
const canMessage = () => !!(localStorage.getItem(CLAIMED_KEY) || localStorage.getItem('gd.privy.userId') || userId().startsWith('near:'))
function setUnread(n: number) {
  unread = n
  const key = document.getElementById('cc-msg')
  if (!key) return
  key.classList.toggle('has-unread', n > 0)
  // A red count on the Messages key in the menu, like the one on Notifications.
  let badge = key.querySelector<HTMLElement>('.cc-badge.dm-count')
  if (!badge) { badge = el('span', '', 'cc-badge dm-count'); badge.hidden = true; key.prepend(badge) }
  badge.hidden = n === 0
  badge.textContent = n > 9 ? '9+' : String(n)
}

let polling = false
async function poll(): Promise<void> {
  if (polling || document.hidden || !canMessage()) return
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
    if (current && ctx?.isOpen(`@${current}`) && r.data.threads.some((t) => t.with === current && t.unread && t.lastId > shownId)) void openThread(current)
  } finally { polling = false }
}

// ---------- Alerts outside the game: push to this device, and email ----------
const PUSH = 'gd.push.v1'
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const pushOn = () => { try { return localStorage.getItem(PUSH) === 'on' && Notification.permission === 'granted' } catch { return false } }
const b64ToBytes = (s: string) => { const p = s.replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(p + '='.repeat((4 - (p.length % 4)) % 4)); return Uint8Array.from(raw, (ch) => ch.charCodeAt(0)) }
/** Turn message alerts on this device on or off. Returns a line to show the player. */
export async function setPush(on: boolean): Promise<string> {
  if (!pushSupported()) return 'This browser cannot show alerts. On iPhone, add the game to your Home Screen first.'
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    if (!on) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) { await api('push-sub', { post: { sub: sub.toJSON(), on: false } }); await sub.unsubscribe() }
      localStorage.setItem(PUSH, 'off')
      return 'Phone alerts are off.'
    }
    if ((await Notification.requestPermission()) !== 'granted') return 'Alerts are blocked for this site. Allow notifications in your browser settings.'
    const key = ((await (await fetch('/api/messages?op=push-key')).json()) as { key?: string }).key
    if (!key) return 'Could not reach the server. Try again.'
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }))
    const r = await api<{ ok: boolean }>('push-sub', { post: { sub: sub.toJSON(), on: true } })
    if (r.status === 401) return 'Sign in first, then turn phone alerts on.'
    if (!r.ok) return 'Could not save alerts. Try again.'
    localStorage.setItem(PUSH, 'on')
    return 'Phone alerts are on: new messages reach you even when the game is closed.'
  } catch { return 'Could not turn alerts on in this browser.' }
}
/** Email alerts for new messages (Google and email sign-ins). `on` undefined = read only. */
export async function emailAlerts(on?: boolean): Promise<{ on: boolean; ready: boolean } | null> {
  const r = await api<{ on: boolean; ready: boolean }>('email-pref', on === undefined ? {} : { post: { on } })
  return r.ok ? r.data : null
}

export function mountMessages(c: Ctx): void {
  ctx = c
  // A tapped alert opens that conversation (fresh tab: ?dm=<user>; open tab: a message from the service worker).
  // Through the game's own deep link (main.ts follow), which opens the menu panel the conversation lives in: opened
  // straight here it was drawn inside the closed menu, so a tapped alert showed nothing.
  // A fresh tab opened from an alert is still on the title screen for a while: wait until the city is open (the
  // player pressed Play), then open the conversation. An already open game opens it at once.
  const whenInCity = (f: () => void) => {
    if (performance.getEntriesByName('gd:revealed').length) { window.setTimeout(f, 400); return }
    window.addEventListener('gd:revealed', () => window.setTimeout(f, 900), { once: true })
  }
  const openFrom = (url: string) => { try { const u = new URL(url, location.href).searchParams.get('dm'); if (u) whenInCity(() => window.dispatchEvent(new CustomEvent('gd:follow', { detail: `dm:${u}` }))) } catch { /* */ } }
  openFrom(location.href)
  navigator.serviceWorker?.addEventListener?.('message', (e: MessageEvent) => { if (e.data?.type === 'gd-open') openFrom(String(e.data.url ?? '')) })
  // Keep this device's subscription fresh once alerts are on.
  if (pushOn()) window.setTimeout(() => void setPush(true), 8000)
  // Right after a NEAR sign-in the signed login message is still fresh (ten minutes): swap it for the Messages
  // token straight away, so a NEAR player never has to confirm again for Messages.
  const adopt = () => { if (userId().startsWith('near:')) void nearToken() }
  window.setInterval(adopt, 5000)
  window.addEventListener('focus', adopt)
  window.setTimeout(() => void poll(), 4000)
  window.setInterval(() => void poll(), 20000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll() })
}

// ---------- Friends & parties ----------
type Party = { id: string; leader: string; members: string[]; invites: string[]; spot: { by: string; x: number; z: number; at: number } | null }
type Social = { me: string; friends: string[]; incoming: string[]; outgoing: string[]; party: Party | null; invites: Array<{ id: string; leader: string; members: string[] }>; people?: Record<string, { name: string; char: Char | null }> }
let social: Social | null = null
export const partySize = () => social?.party?.members.length ?? 0
const SOC_SEEN = 'gd.social.seen.v1'
/** Friends & party: who you play with. A party is up to four friends together: share your spot and they can jump
 *  next to you; at conference events together each member earns a bonus. Every person shows with their character. */
export async function openFriends(): Promise<void> {
  if (!ctx) return
  current = ''
  ctx.openSheet('Friends & party', () => {})
  chatMode(false)
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<Social>('social')
  if (r.status === 401) return signedOut(body, !(r.data as { noToken?: boolean }).noToken)
  if (!r.ok || !Array.isArray(r.data.friends)) { body.replaceChildren(el('p', r.data.error ?? 'Could not load friends.', 'cc-muted')); return }
  social = r.data
  const s = r.data
  const who = (u: string) => s.people?.[u]
  const online = (u: string) => !!presence?.find(u)
  const act = (label: string, fn: () => Promise<unknown>, cls = 'fp-btn') => { const b = el('button', label, cls); b.type = 'button'; b.onclick = async () => { b.disabled = true; await fn(); void openFriends() }; return b }
  /** One person: picture, name, a status line, and their buttons. Tapping the picture or name opens their profile. */
  const person = (u: string, line: string, ...btns: HTMLElement[]) => {
    const row = el('div', '', 'fp-row')
    const id = el('button', '', 'fp-id'); id.type = 'button'; id.onclick = () => void openProfile(u)
    const t = el('span', '', 'fp-t'); t.append(el('b', who(u)?.name || `@${u}`), el('small', line, online(u) ? 'on' : ''))
    id.append(avatar(u, who(u)?.name || u, who(u)?.char ?? null, 44, online(u)), t)
    const tools = el('span', '', 'fp-tools'); tools.append(...btns)
    row.append(id, tools)
    return row
  }
  const section = (title: string, ...kids: HTMLElement[]) => { const sec = el('section', '', 'fp-sec'); sec.append(el('h3', title), ...kids); return sec }
  // Add a friend.
  const form = el('form', '', 'fp-add'); const inp = el('input'); inp.placeholder = 'Add a friend by username'; inp.maxLength = 20; inp.onkeydown = (e) => e.stopPropagation(); inp.setAttribute('aria-label', 'Username')
  const add = el('button', 'Add', 'fp-btn primary'); add.type = 'submit'; const st = el('p', '', 'cc-muted fp-status')
  form.onsubmit = async (e) => { e.preventDefault(); const name = inp.value.trim().replace(/^@/, '').toLowerCase(); if (!name) return; const x = await api<{ status?: string }>('friend', { post: { u: name, action: 'add' } }); st.textContent = x.ok ? (x.data.status === 'accepted' ? `You and @${name} are now friends.` : `Request sent to @${name}. They will see it in their notifications.`) : (x.data.error ?? 'Could not add them'); if (x.ok) window.setTimeout(() => void openFriends(), 900) }
  form.append(inp, add)
  body.replaceChildren(form, st)
  // The party, explained plainly.
  const party = el('section', '', 'fp-party')
  const ph = el('div', '', 'fp-party-h'); ph.append(el('span', '🎉', 'fp-party-ico'))
  const pt = el('div', '', 'fp-party-t')
  pt.append(el('b', s.party ? `Your party · ${s.party.members.length} of 4` : 'Party: play together'), el('small', 'A party is up to 4 friends playing together. Share where you are and your party can jump right next to you. At conference events together, each of you earns a $10 in-game bonus.'))
  ph.append(pt); party.append(ph)
  if (s.party) {
    const lead = s.party.leader
    const faces = el('div', '', 'fp-faces')
    for (const m of s.party.members) {
      const f = el('button', '', 'fp-face'); f.type = 'button'; f.onclick = () => void openProfile(m)
      f.append(avatar(m, who(m)?.name || m, who(m)?.char ?? null, 52, online(m)), el('small', `${m === s.me ? 'You' : who(m)?.name || `@${m}`}${m === lead ? ' 👑' : ''}`))
      faces.append(f)
    }
    for (let k = s.party.members.length; k < 4; k++) { const e2 = el('span', '', 'fp-face empty'); e2.append(el('span', '+', 'fp-plus'), el('small', 'Invite')); faces.append(e2) }
    party.append(faces)
    const sp = s.party.spot
    if (sp && sp.by !== s.me && Date.now() - sp.at < 15 * 60_000) party.append(act(`Jump to @${sp.by}`, async () => { window.dispatchEvent(new CustomEvent('gd-teleport', { detail: { ...sp, who: sp.by } })) }, 'fp-btn primary wide'))
    const share = act('📍 Share my location with the party', async () => { const pos = (window as unknown as { gdPos?: () => { x: number; z: number } }).gdPos?.(); if (pos) { await api('party_spot', { post: pos }); notify('Location shared', 'Your party can jump next to you for the next 15 minutes.') } }, 'fp-btn primary wide')
    party.append(share, el('small', 'For 15 minutes your party sees a "Jump to you" button.', 'fp-hint'), act('Leave party', () => api('party_leave', { post: {} }), 'fp-btn ghost wide'))
  } else party.append(el('small', 'To start one, tap Invite next to a friend below.', 'fp-hint'))
  body.append(party)
  if (s.invites.length) body.append(section('Party invites', ...s.invites.map((i) => person(i.leader, `Invited you · ${i.members.length} of 4 in the party`, act('Join', () => api('party_join', { post: { id: i.id } }), 'fp-btn primary')))))
  if (s.incoming.length) body.append(section('Friend requests', ...s.incoming.map((u) => person(u, 'Wants to be friends', act('Accept', () => api('friend', { post: { u, action: 'add' } }), 'fp-btn primary'), act('Decline', () => api('friend', { post: { u, action: 'remove' } }), 'fp-btn ghost')))))
  const msgIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z"/></svg>'
  const friendRows = s.friends.map((u) => {
    const msg = el('button', '', 'fp-icon'); msg.type = 'button'; msg.setAttribute('aria-label', `Message @${u}`); msg.innerHTML = msgIcon; msg.onclick = () => void openThread(u)
    const inParty = !!s.party?.members.includes(u)
    const btns: HTMLElement[] = [msg]
    if (!inParty && (s.party?.members.length ?? 1) < 4) btns.push(act('Invite', () => api('party_invite', { post: { u } }), 'fp-btn'))
    const more = el('button', '⋯', 'fp-icon'); more.type = 'button'; more.setAttribute('aria-label', `Remove @${u} as a friend`)
    more.onclick = async () => { if (confirm(`Remove @${u} from your friends?`)) { await api('friend', { post: { u, action: 'remove' } }); void openFriends() } }
    btns.push(more)
    return person(u, inParty ? 'In your party' : online(u) ? 'Online now' : `@${u}`, ...btns)
  })
  body.append(section(`Friends · ${s.friends.length}`, ...(friendRows.length ? friendRows : [el('p', 'No friends yet. Add someone by username above, or tap a player in the city.', 'cc-muted')])))
  if (s.outgoing.length) body.append(section('Requests you sent', ...s.outgoing.map((u) => person(u, 'Waiting for them to accept', act('Cancel', () => api('friend', { post: { u, action: 'remove' } }), 'fp-btn ghost')))))
}
async function pollSocial(): Promise<void> {
  if (document.hidden || !canMessage()) return
  const r = await api<Social>('social'); if (!r.ok || !Array.isArray(r.data.incoming) || !Array.isArray(r.data.invites)) return
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
type Profile = { username: string; name: string; rank: string; reputation: number; balance?: number; skills: string[]; pinned: string[]; seen: string | null; look: { h: number; b: number; hair: number | null; skin: number | null }; streak: number; agent: string | null; job?: string | null; char?: Char | null }

function searchBox(): HTMLElement {
  const wrap = el('div', '', 'dm-search')
  const inp = el('input'); inp.type = 'search'; inp.placeholder = 'Search by username or name'; inp.maxLength = 20; inp.setAttribute('aria-label', 'Search players')
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
        const li = el('li', '', 'dm-hit'); const b = el('button', '', 'cc-row'); b.type = 'button'
        const on = presence?.find(p.username)
        b.append(el('strong', `@${p.username}${on ? ' · online' : ''}`), el('p', [p.name, p.rank].filter(Boolean).join(' · ') || 'Player'))
        b.onclick = () => void openProfile(p.username)
        // Two clear actions on every result: start the chat, or look at the profile first.
        const acts = el('div', '', 'dm-hit-acts')
        const msg = el('button', 'Message', 'dm-act primary'); msg.type = 'button'; msg.onclick = () => void openThread(p.username)
        const prof = el('button', 'Profile', 'dm-act'); prof.type = 'button'; prof.onclick = () => void openProfile(p.username)
        acts.append(msg, prof)
        li.append(b, acts); return li
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
  chatMode(false)
  const body = ctx.body()
  body.replaceChildren(el('p', 'Loading…', 'cc-muted'))
  const r = await api<{ me: string; self: boolean; profile: Profile; friend: 'none' | 'friends' | 'outgoing' | 'incoming'; inParty: boolean; blocked: boolean }>('profile', { q: `&u=${encodeURIComponent(u)}` })
  if (!ctx.isOpen(title)) return
  if (r.status === 401) return signedOut(body, !(r.data as { noToken?: boolean }).noToken)
  if (!r.ok) { body.replaceChildren(el('p', r.data.error ?? 'Could not load profile.', 'cc-muted')); return }
  const p = r.data.profile
  const here = presence?.find(u) ?? null
  // Header card: their character (from the photo card they made in the game, when there is one), name, where they
  // are, and badges. Public view only: rank, job and reputation; never a balance, wallet or purchases.
  const head = el('div', '', 'pf2-head')
  // Their picture is the character they picked (drawn by the game); players who have not shared one yet show
  // their photo card or a simple figure.
  const pic = el('div', '', 'pf2-pic')
  if (p.char) pic.append(avatar(u, p.name || u, p.char, 104))
  else {
    pic.append(silhouette(p))
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
    if (base) {
      const card = new Image()
      card.onload = () => { pic.querySelector('.pf-avatar')?.remove(); pic.style.backgroundImage = `url("${card.src}")`; pic.classList.add('card') }
      card.src = `${base}/storage/v1/object/public/invite-cards/${u}.jpg`
    }
  }
  const dot = el('span', '', `pf2-dot${here ? ' on' : ''}`); pic.append(dot)
  const who = el('div', '', 'pf2-who')
  who.append(el('h2', p.name || `@${u}`), el('p', `@${u}`, 'pf2-handle'))
  who.append(el('p', here ? 'Online now · in the city' : p.seen ? `Last seen ${when(p.seen)}` : 'Offline', `pf2-status${here ? ' on' : ''}`))
  const badges = el('div', '', 'pf2-badges')
  const badge = (t: string, cls = '') => badges.append(el('span', t, `pf2-badge ${cls}`))
  if (p.job) badge(p.job, 'job')
  if (p.rank) badge(p.rank)
  if (p.agent) badge(`Agent · ${p.agent}`, 'agent')
  if (r.data.friend === 'friends') badge('Friend', 'friend')
  if (r.data.inParty) badge('In your party', 'friend')
  if (p.streak >= 3) badge(`🔥 ${p.streak}-day streak`)
  if (p.reputation >= 1000) badge('✓ Trusted', 'gold')
  who.append(badges)
  head.append(pic, who)
  // At a glance.
  const stats = el('div', '', 'pf2-stats')
  const stat = (n: string, label: string) => { const t = el('div', '', 'pf2-stat'); t.append(el('b', n), el('span', label)); stats.append(t) }
  stat(p.reputation.toLocaleString(), 'Reputation')
  stat(String(p.skills.length), p.skills.length === 1 ? 'Course passed' : 'Courses passed')
  stat(String(p.pinned.length), p.pinned.length === 1 ? 'Certificate' : 'Certificates')
  // What you can do with them.
  const acts = el('div', '', 'pf2-actions'); const st = el('p', '', 'cc-muted')
  const btn = (t: string, fn: () => Promise<unknown> | void, cls = 'pf2-key') => { const b = el('button', t, cls); b.type = 'button'; b.onclick = async () => { b.disabled = true; try { await fn() } finally { b.disabled = false } }; acts.append(b); return b }
  if (!r.data.self) {
    btn('💬 Message', () => { void openThread(u) }, 'pf2-key main')
    const fl = { none: '＋ Add friend', outgoing: 'Request sent', incoming: '✓ Accept friend', friends: 'Friends ✓' }[r.data.friend]
    const fb = btn(fl, async () => { const x = await api<{ status?: string }>('friend', { post: { u, action: 'add' } }); st.textContent = x.ok ? (x.data.status === 'accepted' ? `You and @${u} are friends.` : 'Friend request sent.') : (x.data.error ?? 'Failed'); if (x.ok) fb.textContent = x.data.status === 'accepted' ? 'Friends ✓' : 'Request sent' })
    if (r.data.friend === 'friends' || r.data.friend === 'outgoing') { fb.disabled = true; fb.onclick = null }
    if (!r.data.inParty) btn('🎉 Invite to party', async () => { const x = await api('party_invite', { post: { u } }); st.textContent = x.ok ? `Party invite sent to @${u}.` : (x.data.error === 'Invite friends only' ? 'Add them as a friend first: only friends can be invited.' : (x.data.error ?? 'Failed')) })
    if (here) btn('📍 Find on map', () => { window.dispatchEvent(new CustomEvent('gd-find', { detail: { u, ...here } })) })
    if (here) btn('🚶 Go near them', () => { const at = presence?.find(u); if (at) window.dispatchEvent(new CustomEvent('gd-teleport', { detail: { ...at, who: u } })); else st.textContent = `@${u} just left the city.` })
  } else acts.append(el('p', 'This is how other players see you.', 'cc-muted'))
  // Their CV.
  const sheet = el('div', '', 'pf2-sheet')
  const section = (title: string, items: string[], empty: string, cls: string) => {
    const card = el('section', '', 'pf2-card'); card.append(el('h3', title))
    if (items.length) { const ul = el('ul', '', `pf2-chips ${cls}`); for (const t of items) ul.append(el('li', t)); card.append(ul) }
    else card.append(el('p', empty, 'cc-muted'))
    sheet.append(card)
  }
  section('Courses on their CV', p.skills, r.data.self ? 'Pass a course at Campus and it lands here.' : 'No courses yet. Everyone starts at Campus with Zahra.', 'skills')
  section('Pinned certificates', p.pinned, r.data.self ? 'Pin a certificate from your Profile to show it here.' : 'Nothing pinned yet.', 'certs')
  const cv = el('a', 'View full CV ↗', 'pf2-cv') as HTMLAnchorElement; cv.href = `/cv/${u}`; cv.target = '_blank'; cv.rel = 'noopener'
  sheet.append(cv)
  if (!r.data.self) {
    // Safety, as in any messaging app: block (they can no longer message you) or report the player.
    const safe = el('div', '', 'pf2-safety')
    let blocked = r.data.blocked
    const bl = el('button', blocked ? `Unblock @${u}` : `Block @${u}`, 'pf2-danger'); bl.type = 'button'
    bl.onclick = async () => {
      const on = !blocked
      if (on && !confirm(`Block @${u}? They will not be able to message you.`)) return
      const x = await api('block', { post: { u, on } })
      if (x.ok) { blocked = on; bl.textContent = on ? `Unblock @${u}` : `Block @${u}`; st.textContent = on ? `@${u} is blocked.` : `@${u} is unblocked.` }
    }
    const rp = el('button', `Report @${u}`, 'pf2-danger'); rp.type = 'button'
    rp.onclick = async () => {
      if (!confirm(`Report @${u} to the Grind District team?`)) return
      const x = await api('report', { post: { u, reason: 'profile' } })
      rp.textContent = x.ok ? 'Reported' : 'Could not report'; rp.disabled = true
    }
    safe.append(bl, rp)
    sheet.append(safe)
  }
  const back = el('button', '‹ Messages', 'cc-link'); back.type = 'button'; back.onclick = () => void openInbox()
  body.replaceChildren(back, head, stats, acts, st, sheet)
}
