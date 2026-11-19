// Notifications for new messages: phone / browser push and email (Gmail). Underscore = not a Vercel function.
// - Push: standard Web Push. The VAPID key pair is derived on the server from the service role key (no extra
//   secret to manage); the public half is served at /api/messages?op=push-key. Subscriptions are kept per
//   username in the private Storage bucket "notify" (push/<username>.json, up to 5 devices).
// - Email: sent through Gmail SMTP when GMAIL_USER and GMAIL_APP_PASSWORD (a Google app password) are set in the
//   project's environment; until then emails are simply skipped. The address comes from the player's Google or
//   email sign-in (Privy). Every email has a one-click "turn off" link; the choice is kept in the same bucket.
// - At most one alert per sender per 30 minutes while earlier messages from them are still unread.
import { createECDH, createHmac } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PrivyClient } from '@privy-io/server-auth'

const BUCKET = 'notify'
const ORIGIN = 'https://www.grinddistrict.app'
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const b64u = (b: Buffer) => b.toString('base64url')

let vapid: { pub: string; priv: string } | null = null
export function vapidKeys(): { pub: string; priv: string } {
  if (vapid) return vapid
  const priv = createHmac('sha256', secret()).update('grind-district vapid v1').digest()
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(priv)
  vapid = { pub: b64u(ecdh.getPublicKey()), priv: b64u(priv) }
  return vapid
}

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } }
async function readJson<T>(db: SupabaseClient, path: string): Promise<T | null> {
  const r = await db.storage.from(BUCKET).download(path).catch(() => null)
  if (!r || r.error || !r.data) return null
  try { return JSON.parse(await r.data.text()) as T } catch { return null }
}
async function writeJson(db: SupabaseClient, path: string, value: unknown): Promise<boolean> {
  const body = new Blob([JSON.stringify(value)], { type: 'application/json' })
  let up = await db.storage.from(BUCKET).upload(path, body, { upsert: true, contentType: 'application/json' })
  if (up.error) {
    await db.storage.createBucket(BUCKET, { public: false }).catch(() => undefined)
    up = await db.storage.from(BUCKET).upload(path, body, { upsert: true, contentType: 'application/json' })
  }
  return !up.error
}

export function cleanSub(raw: unknown): Sub | null {
  const s = raw as Partial<Sub> | null
  if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 800) return null
  if (!s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string' || s.keys.p256dh.length > 200 || s.keys.auth.length > 100) return null
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }
}
export async function savePushSub(db: SupabaseClient, user: string, sub: Sub, on = true): Promise<boolean> {
  const list = ((await readJson<Sub[]>(db, `push/${user}.json`)) ?? []).filter((s) => s.endpoint !== sub.endpoint)
  if (on) list.unshift(sub)
  return writeJson(db, `push/${user}.json`, list.slice(0, 5))
}

export const emailToken = (user: string) => createHmac('sha256', secret()).update(`email-off:${user}`).digest('base64url').slice(0, 22)
export async function setEmailOff(db: SupabaseClient, user: string, off: boolean): Promise<boolean> {
  return writeJson(db, `email/${user}.json`, { off, at: new Date().toISOString() })
}
export async function emailOff(db: SupabaseClient, user: string): Promise<boolean> {
  return (await readJson<{ off?: boolean }>(db, `email/${user}.json`))?.off === true
}

async function emailOf(db: SupabaseClient, user: string): Promise<string | null> {
  const appId = process.env.PRIVY_APP_ID ?? process.env.VITE_PRIVY_APP_ID, sec = process.env.PRIVY_APP_SECRET
  if (!appId || !sec) return null
  const row = await db.from('players').select('privy_user_id').eq('username', user).maybeSingle()
  const id = row.data?.privy_user_id as string | undefined
  if (!id || id.startsWith('near:')) return null
  try {
    const u = await new PrivyClient(appId, sec).getUser(id) as unknown as { email?: { address?: string }; google?: { email?: string } }
    return u.email?.address ?? u.google?.email ?? null
  } catch { return null }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return false
  const nodemailer = (await import('nodemailer')).default
  const tx = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  await tx.sendMail({ from: `Grind District <${user}>`, to, subject, text, html })
  return true
}

/** Alert the recipient of a new direct message (push to their devices, and an email when set up). */
export async function notifyMessage(db: SupabaseClient, from: string, to: string, preview: string, messageId: number): Promise<void> {
  // Quiet while earlier messages from the same sender are still unread (30 minutes).
  const since = new Date(Date.now() - 30 * 60_000).toISOString()
  const earlier = await db.from('messages').select('id', { count: 'exact', head: true }).eq('sender', from).eq('recipient', to).is('read_at', null).gte('created_at', since).neq('id', messageId)
  if ((earlier.count ?? 0) > 0) return
  const title = `New message from @${from}`
  const body = preview.slice(0, 140) || 'Sent you a photo or voice note.'
  const url = `${ORIGIN}/?dm=${encodeURIComponent(from)}`
  const jobs: Array<Promise<unknown>> = []
  // Push
  const subs = (await readJson<Sub[]>(db, `push/${to}.json`)) ?? []
  if (subs.length) {
    const webpush = (await import('web-push')).default
    const k = vapidKeys()
    webpush.setVapidDetails('mailto:noreply@grinddistrict.app', k.pub, k.priv)
    const payload = JSON.stringify({ title, body, url, tag: `dm:${from}`, icon: `${ORIGIN}/icons/icon-192.png`, cta: 'Reply' })
    const dead: string[] = []
    jobs.push(Promise.all(subs.map((s) => webpush.sendNotification(s, payload, { TTL: 3600 }).catch((e: { statusCode?: number }) => { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint) })))
      .then(() => dead.length ? writeJson(db, `push/${to}.json`, subs.filter((s) => !dead.includes(s.endpoint))) : null))
  }
  // Email
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && !(await emailOff(db, to))) {
    jobs.push((async () => {
      const addr = await emailOf(db, to)
      if (!addr) return
      const off = `${ORIGIN}/api/messages?op=email-off&u=${encodeURIComponent(to)}&t=${emailToken(to)}`
      const text = `${title}\n\n"${body}"\n\nReply in Grind District: ${url}\n\nTurn off these emails: ${off}`
      const html = `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1d1b17">
<img src="${ORIGIN}/icons/icon-96.png" width="48" height="48" alt="Grind District" style="border-radius:12px">
<h2 style="margin:16px 0 8px;font-size:20px">${esc(title)}</h2>
<p style="margin:0 0 20px;padding:14px 16px;background:#f4f0e7;border-radius:12px;font-size:16px;line-height:1.45">${esc(body)}</p>
<a href="${url}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#1af38f;color:#04160e;font-weight:700;text-decoration:none">Reply in Grind District</a>
<p style="margin:28px 0 0;font-size:12px;color:#6b655a">You get this because someone messaged you in Grind District. <a href="${off}" style="color:#6b655a">Turn off these emails</a>.</p></div>`
      await sendEmail(addr, title, text, html)
    })())
  }
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 4000))])
}

// ---- Game updates: one phone alert per release to every player who turned phone alerts on ----
// The release notes live in public/updates.json (served at /updates.json). Each game session pings
// ?op=news-ping&id=<newest id>; the server reads the live list, and if that id is the newest entry (and it does not
// say "push": false) sends it once as a phone alert. Only push (people chose phone alerts in the game); never
// email. At most one alert a day: a newer note that comes sooner waits for the next ping after the day is up.
// A lock file created without overwrite makes sure two pings never send the same note twice.
type Update = { id: string; title: string; body?: string; push?: boolean }
const DAY_GAP_MS = 20 * 3600_000
export async function broadcastUpdate(db: SupabaseClient, id: string): Promise<{ sent: number; devices: number } | { skipped: string }> {
  if (!/^[\w.-]{1,64}$/.test(id)) return { skipped: 'bad id' }
  const list = await fetch(`${ORIGIN}/updates.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { updates?: Update[] } | null
  const latest = list?.updates?.[list.updates.length - 1]
  if (!latest || latest.id !== id) return { skipped: 'not the newest update' }
  if (latest.push === false) return { skipped: 'no alert for this one' }
  const last = await readJson<{ at?: string }>(db, 'broadcast/last.json')
  if (last?.at && Date.now() - Date.parse(last.at) < DAY_GAP_MS) return { skipped: 'one alert a day' }
  const lock = await db.storage.from(BUCKET).upload(`broadcast/${id}.json`, new Blob([JSON.stringify({ at: new Date().toISOString() })], { type: 'application/json' }), { upsert: false, contentType: 'application/json' })
  if (lock.error) return { skipped: 'already sent' }
  await writeJson(db, 'broadcast/last.json', { at: new Date().toISOString(), id })
  const files: string[] = []
  for (let offset = 0; offset < 5000; offset += 100) {
    const r = await db.storage.from(BUCKET).list('push', { limit: 100, offset })
    if (r.error || !r.data?.length) break
    for (const f of r.data) if (f.name.endsWith('.json')) files.push(f.name)
    if (r.data.length < 100) break
  }
  const webpush = (await import('web-push')).default
  const k = vapidKeys()
  webpush.setVapidDetails('mailto:noreply@grinddistrict.app', k.pub, k.priv)
  const payload = JSON.stringify({ title: latest.title.slice(0, 80), body: String(latest.body ?? '').slice(0, 200), url: `${ORIGIN}/?src=push-update`, tag: `update:${id}`, image: notePicture(latest.title, String(latest.body ?? ''), 'See what is new'), cta: 'See what is new' })
  let sent = 0, devices = 0
  // A few players at a time, so the function stays well inside its time limit.
  for (let i = 0; i < files.length; i += 8) {
    await Promise.all(files.slice(i, i + 8).map(async (name) => {
      const path = `push/${name}`
      const subs = (await readJson<Sub[]>(db, path)) ?? []
      if (!subs.length) return
      const dead: string[] = []
      await Promise.all(subs.map((s) => {
        devices++
        return webpush.sendNotification(s, payload, { TTL: 24 * 3600 }).then(() => { sent++ }, (e: { statusCode?: number }) => { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint) })
      }))
      if (dead.length) await writeJson(db, path, subs.filter((s) => !dead.includes(s.endpoint)))
    }))
  }
  await writeJson(db, `broadcast/${id}.json`, { at: new Date().toISOString(), players: files.length, devices, sent })
  return { sent, devices }
}

/** The big picture for a notification: Zahra beside the words (api/og.ts, kind=note). */
export const notePicture = (title: string, body: string, cta: string) =>
  `${ORIGIN}/api/og?kind=note&t=${encodeURIComponent(title.slice(0, 70))}&b=${encodeURIComponent(body.slice(0, 120))}&c=${encodeURIComponent(cta.slice(0, 24))}`

// ---- Come-back reminders: once a day the server looks for players who have been away ----
// A player away two days or more gets one reminder from Zahra: their first lesson if they have not passed one,
// otherwise the next course. By phone alert (only devices where they turned alerts on) and by email (Google or
// email sign-ins, when email is set up on the server, and never after they turn emails off). At most one every
// three days, and after four unanswered reminders it stops until they come back. Runs from the daily cron
// (vercel.json); a lock file per day makes extra calls do nothing.
type Nudge = { at: string; n: number; seen: string }
const DAY = 86_400_000
function reminder(passed: number, n: number): { title: string; body: string; cta: string } {
  if (passed === 0) {
    return n % 2 === 0
      ? { title: 'Zahra is waiting at Campus', body: 'Your first Web3 lesson takes five minutes, and it goes on your CV with a certificate you keep.', cta: 'Start the lesson' }
      : { title: 'Five minutes to your first certificate', body: 'Come back to Grind District: Zahra will walk you through your first lesson.', cta: 'Start the lesson' }
  }
  const courses = `${passed} course${passed === 1 ? '' : 's'}`
  return n % 2 === 0
    ? { title: 'Your next course is ready', body: `You have passed ${courses}. Pick up where you left off at Campus.`, cta: 'Continue' }
    : { title: 'The district misses you', body: `${courses} passed and counting. Come back and finish the next one.`, cta: 'Continue' }
}
export async function nudgeLapsed(db: SupabaseClient, dry = false): Promise<Record<string, number | string>> {
  const today = new Date().toISOString().slice(0, 10)
  if (!dry) {
    const lock = await db.storage.from(BUCKET).upload(`nudge-runs/${today}.json`, new Blob(['{}'], { type: 'application/json' }), { upsert: false, contentType: 'application/json' })
    if (lock.error) return { skipped: 'already ran today' }
  }
  const [players, saves] = await Promise.all([
    db.from('players').select('username, privy_user_id, created_at').not('username', 'is', null).limit(10000),
    db.from('player_progress').select('privy_user_id, updated_at, skills:save->skills').limit(10000),
  ])
  if (players.error) return { error: 'players unavailable' }
  const progress = new Map<string, { seen: string; passed: number }>()
  for (const r of (saves.data ?? []) as Array<{ privy_user_id?: string; updated_at?: string; skills?: Record<string, { passed?: boolean } | null> | null }>) {
    if (!r.privy_user_id) continue
    progress.set(r.privy_user_id, { seen: String(r.updated_at ?? ''), passed: Object.values(r.skills ?? {}).filter((x) => x?.passed === true).length })
  }
  const mail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const webpush = (await import('web-push')).default
  const k = vapidKeys()
  webpush.setVapidDetails('mailto:noreply@grinddistrict.app', k.pub, k.priv)
  let lapsed = 0, reminded = 0, pushed = 0, emailed = 0
  const rows = (players.data ?? []) as Array<{ username: string; privy_user_id?: string; created_at?: string }>
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(rows.slice(i, i + 5).map(async (p) => {
      const pr = progress.get(String(p.privy_user_id ?? ''))
      const seen = pr?.seen || String(p.created_at ?? '')
      const seenAt = Date.parse(seen)
      if (!Number.isFinite(seenAt) || Date.now() - seenAt < 2 * DAY) return
      lapsed++
      const past = await readJson<Nudge>(db, `nudge/${p.username}.json`)
      const n = past && past.seen === seen ? past.n : 0 // they came back since: start counting again
      if (past && past.seen === seen && Date.now() - Date.parse(past.at) < 3 * DAY) return
      if (n >= 4) return
      const msg = reminder(pr?.passed ?? 0, n)
      const url = `${ORIGIN}/?src=reminder`
      const image = notePicture(msg.title, msg.body, msg.cta)
      if (dry) { reminded++; return }
      let reached = false
      const subs = (await readJson<Sub[]>(db, `push/${p.username}.json`)) ?? []
      if (subs.length) {
        const payload = JSON.stringify({ title: msg.title, body: msg.body, url, tag: 'reminder', image, cta: msg.cta })
        const dead: string[] = []
        await Promise.all(subs.map((s) => webpush.sendNotification(s, payload, { TTL: 12 * 3600 }).then(() => { pushed++; reached = true }, (e: { statusCode?: number }) => { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.endpoint) })))
        if (dead.length) await writeJson(db, `push/${p.username}.json`, subs.filter((s) => !dead.includes(s.endpoint)))
      }
      if (mail && !(await emailOff(db, p.username))) {
        const addr = await emailOf(db, p.username)
        if (addr) {
          const off = `${ORIGIN}/api/messages?op=email-off&u=${encodeURIComponent(p.username)}&t=${emailToken(p.username)}`
          const text = `${msg.title}\n\n${msg.body}\n\nOpen Grind District: ${url}\n\nTurn off these emails: ${off}`
          const html = `<div style="font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;max-width:560px;margin:auto;padding:20px;color:#1d1b17">
<a href="${url}"><img src="${image}" width="520" alt="${esc(msg.title)}" style="width:100%;max-width:520px;border-radius:16px;display:block"></a>
<h2 style="margin:20px 0 8px;font-size:22px">${esc(msg.title)}</h2>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#3a352c">${esc(msg.body)}</p>
<a href="${url}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#1af38f;color:#04160e;font-weight:800;text-decoration:none">${esc(msg.cta)}</a>
<p style="margin:28px 0 0;font-size:12px;color:#6b655a">You get this because you play Grind District. <a href="${off}" style="color:#6b655a">Turn off these emails</a>.</p></div>`
          if (await sendEmail(addr, msg.title, text, html).catch(() => false)) { emailed++; reached = true }
        }
      }
      if (reached) reminded++
      await writeJson(db, `nudge/${p.username}.json`, { at: new Date().toISOString(), n: n + 1, seen })
    }))
  }
  return { players: rows.length, lapsed, reminded, pushed, emailed, email: mail ? 'on' : 'not set up' }
}
