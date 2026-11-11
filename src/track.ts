// Activity log: buffers events locally, flushes to /api/track when VITE_TRACKING=1.
// No personal data beyond a random visitor id (gd.guestId).
export type EventName =
  | 'first_visit' | 'session_start' | 'signup' | 'course_start' | 'course_complete' | 'cert_shared' | 'cert_minted'
  | 'cv_shared' | 'share_click' | 'transfer' | 'topup_attempt'
  // Dated funnel steps (Build App & Earn, 9 Nov): opened page → guest play → account → first lesson.
  | 'opened_page' | 'guest_play' | 'account_created' | 'first_lesson'

const ON = import.meta.env.VITE_TRACKING === '1'
const BUF = 'gd.events.buffer'
const ATTR = 'gd.attribution'
const FUNNEL_ONCE = 'gd.funnel.once'
const SESSION = crypto.randomUUID?.() ?? String(Date.now())

function read<T>(key: string, fallback: T): T {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback } catch { return fallback }
}

/** First-touch attribution from ?src, ?ref and ?utm_* (kept so guests / later sign-ups / NEAR keep their source). */
export function attribution(): Record<string, string> {
  return read<Record<string, string>>(ATTR, {})
}

/** Persist ?src= (and friends) as soon as possible. Safe to call more than once. */
export function captureAttribution(): void {
  try {
    const q = new URLSearchParams(location.search)
    const got: Record<string, string> = {}
    for (const [k, v] of q) if ((k === 'src' || k === 'ref' || k.startsWith('utm_')) && v) got[k] = v.slice(0, 80)
    const cur = read<Record<string, string> | null>(ATTR, null)
    if (!cur) {
      localStorage.setItem(ATTR, JSON.stringify({ ...got, landing: location.pathname, at: new Date().toISOString() }))
      track('first_visit', got)
    } else if (got.src && !cur.src) {
      // URL brought a source that the first landing lacked — keep it for later signup / NEAR.
      localStorage.setItem(ATTR, JSON.stringify({ ...cur, ...got }))
    }
  } catch { /* private mode */ }
}

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  try {
    const anon = localStorage.getItem('gd.guestId') ?? 'unknown'
    const buf = read<unknown[]>(BUF, [])
    buf.push({ name, props, anon_id: anon, session_id: SESSION, at: new Date().toISOString() })
    localStorage.setItem(BUF, JSON.stringify(buf.slice(-200)))
  } catch { /* storage full or blocked */ }
}

/** Fire a funnel step once per visitor id (dated ISO timestamp is on every event via `at`). */
export function trackFunnelOnce(name: 'opened_page' | 'guest_play' | 'account_created' | 'first_lesson', props: Record<string, unknown> = {}): void {
  try {
    const once = read<Record<string, string>>(FUNNEL_ONCE, {})
    if (once[name]) return
    once[name] = new Date().toISOString()
    localStorage.setItem(FUNNEL_ONCE, JSON.stringify(once))
    track(name, { ...props, ...attribution() })
  } catch { track(name, props) }
}

async function flush(): Promise<void> {
  if (!ON) return
  const buf = read<unknown[]>(BUF, [])
  if (!buf.length) return
  try {
    const r = await fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events: buf }), keepalive: true })
    if (r.ok) localStorage.setItem(BUF, JSON.stringify(read<unknown[]>(BUF, []).slice(buf.length)))
  } catch { /* retry next flush */ }
}

export function startTracking(): void {
  try {
    if (!localStorage.getItem('gd.guestId')) localStorage.setItem('gd.guestId', crypto.randomUUID?.() ?? String(Date.now()))
    captureAttribution()
    trackFunnelOnce('opened_page')
    track('session_start', { ref: document.referrer.slice(0, 120) })
  } catch { /* ignore */ }
  window.setInterval(() => void flush(), 15_000)
  window.addEventListener('pagehide', () => void flush())
  window.setTimeout(() => void flush(), 3000)
}
