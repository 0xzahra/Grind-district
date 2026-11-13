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
    const payload = JSON.stringify({ title, body, url, tag: `dm:${from}` })
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
