// Activity log: buffers events locally, flushes to /api/track when VITE_TRACKING=1.
export type EventName = 'first_visit' | 'session_start' | 'signup' | 'course_start' | 'course_complete' | 'cert_shared'
  | 'cv_shared' | 'share_click' | 'transfer' | 'topup_attempt'

const ON = import.meta.env.VITE_TRACKING === '1'
const BUF = 'gd.events.buffer'
const ATTR = 'gd.attribution'
const SESSION = crypto.randomUUID?.() ?? String(Date.now())

function read<T>(key: string, fallback: T): T {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback } catch { return fallback }
}

/** First-touch attribution from ?src, ?ref and ?utm_* (kept for the first visit and sent with signup). */
export function attribution(): Record<string, string> {
  return read<Record<string, string>>(ATTR, {})
}

function captureAttribution(): void {
  const q = new URLSearchParams(location.search)
  const got: Record<string, string> = {}
  for (const [k, v] of q) if ((k === 'src' || k === 'ref' || k.startsWith('utm_')) && v) got[k] = v.slice(0, 80)
  if (!localStorage.getItem(ATTR)) {
    localStorage.setItem(ATTR, JSON.stringify({ ...got, landing: location.pathname, at: new Date().toISOString() }))
    track('first_visit', got)
  }
}

export function track(name: EventName, props: Record<string, unknown> = {}): void {
  try {
    const anon = localStorage.getItem('gd.guestId') ?? 'unknown'
    const buf = read<unknown[]>(BUF, [])
    buf.push({ name, props, anon_id: anon, session_id: SESSION, at: new Date().toISOString() })
    localStorage.setItem(BUF, JSON.stringify(buf.slice(-200)))
  } catch { /* storage full or blocked */ }
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
    track('session_start', { ref: document.referrer.slice(0, 120) })
  } catch { /* ignore */ }
  window.setInterval(() => void flush(), 15_000)
  window.addEventListener('pagehide', () => void flush())
  window.setTimeout(() => void flush(), 3000)
}
