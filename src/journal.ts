// Daily journal: "A day in my Web3 life". Today's activity log (lessons, trades, visits, events, jobs), grouped into
// morning, afternoon, evening and night by the player's own clock, drawn as a 1080 x 1350 card to share, with the
// invite code. Like the photo card it is drawn on the device and shows nothing private: no balance, no amounts,
// no wallet (money entries and anything about a balance or a top-up are left out). Loaded only when opened.
import { getSave } from './state.ts'
import { isWalletActivity, rankFor } from './logic.ts'
import { drawQr, inviteLink } from './photoCard.ts'

export type DayPart = 'Morning' | 'Afternoon' | 'Evening' | 'Night'
export type JournalLine = { part: DayPart; text: string; kind: string; at: number }
type Act = { at: number; kind: string; label: string; detail?: string }

const PARTS: DayPart[] = ['Morning', 'Afternoon', 'Evening', 'Night']
const partOf = (hour: number): DayPart => (hour >= 5 && hour < 12 ? 'Morning' : hour >= 12 && hour < 17 ? 'Afternoon' : hour >= 17 && hour < 22 ? 'Evening' : 'Night')

/** A friendlier sentence for a log entry. Never adds a number of dollars. */
function sentence(a: Act): string {
  const l = a.label.trim()
  if (a.kind === 'skill' && /^Passed /.test(l)) return `${l} at Campus`
  if (a.kind === 'trade') return `${l} on the practice desk`
  if (a.kind === 'climate') return `${l} (practice)`
  return l
}

/** Today's lines, oldest first, grouped by part of the day; repeats in the same part fold into "×n". Pure. */
export function journalLines(activities: Act[], now = Date.now()): JournalLine[] {
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const today = activities
    .filter((a) => a && a.at >= start.getTime() && a.at <= now + 60_000)
    .filter((a) => !isWalletActivity({ kind: a.kind, label: a.label, detail: a.detail }) && !/\$|\d+\s*(usd|usdc|near|eth)\b/i.test(a.label))
    .sort((x, y) => x.at - y.at)
  const out: JournalLine[] = []
  const seen = new Map<string, { line: JournalLine; n: number }>()
  for (const a of today) {
    const part = partOf(new Date(a.at).getHours()), text = sentence(a), key = `${part}|${text}`
    const had = seen.get(key)
    if (had) { had.n += 1; had.line.text = `${text} ×${had.n}`; continue }
    const line = { part, text, kind: a.kind, at: a.at }
    seen.set(key, { line, n: 1 }); out.push(line)
  }
  return out
}

/** One closing line in the voice of the game, from what the day held. */
export function journalCloser(lines: JournalLine[]): string {
  const has = (k: string) => lines.some((l) => l.kind === k)
  if (lines.some((l) => /^Passed /.test(l.text))) return 'Proof over vibes: another course on the CV.'
  if (has('trade') && !has('skill')) return 'Charts checked. Grass is next.'
  if (has('gig')) return 'Showed up and did the work. Reputation noticed.'
  if (has('social')) return 'Showed up for the people. That counts too.'
  if (lines.length) return 'Small steps. Same district tomorrow.'
  return 'A quiet day in the district. Tomorrow: Campus.'
}

/** The text for a post: the first line of each part, the closer and the invite link (fits one post on X). */
export function journalPost(lines: JournalLine[], link: string): string {
  const head = 'A day in my Web3 life in Grind District 🏙️'
  const body: string[] = []
  for (const p of PARTS) { const first = lines.find((l) => l.part === p); if (first) body.push(`${p}: ${first.text}.`) }
  let text = [head, '', ...body, '', journalCloser(lines)].join('\n')
  // X counts a link as 23 characters; keep the whole post within 280.
  while (text.length + 24 > 280 && body.length > 1) { body.pop(); text = [head, '', ...body, '', journalCloser(lines)].join('\n') }
  return `${text}\n${link}`
}

const F = '"Inter Variable", Inter, system-ui, sans-serif'
const W = 1080, H = 1350
const image = (src: string): Promise<HTMLImageElement | null> => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.onerror = () => done(null); i.src = src })
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '), out: string[] = []
  let cur = ''
  for (const w of words) { const next = cur ? `${cur} ${w}` : w; if (g.measureText(next).width <= maxW || !cur) cur = next; else { out.push(cur); cur = w } }
  if (cur) out.push(cur)
  return out
}
/** Small drawn icons (fonts do not all carry the sun and moon symbols): rising sun, full sun, crescent, star. */
function icon(g: CanvasRenderingContext2D, p: DayPart, x: number, y: number): void {
  g.save(); g.fillStyle = '#06ee74'; g.strokeStyle = '#06ee74'; g.lineWidth = 3; g.lineCap = 'round'
  const cx = x + 13, cy = y - 9
  if (p === 'Morning' || p === 'Afternoon') {
    const r = p === 'Morning' ? 7 : 8
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill()
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4)); g.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8)); g.stroke() }
    if (p === 'Morning') { g.strokeStyle = '#0d1611'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 16, cy + 6); g.lineTo(cx + 16, cy + 6); g.stroke() }
  } else if (p === 'Evening') {
    // A crescent: the moon's disc minus an offset disc, clipped to the moon (never cuts through the card).
    g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.clip()
    g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.arc(cx + 6, cy - 4, 10, 0, Math.PI * 2); g.fill('evenodd')
  } else {
    g.beginPath()
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 5 : 12; i ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) }
    g.closePath(); g.fill()
  }
  g.restore()
}

/** Draw the journal card for today. */
export async function drawJournal(now = Date.now()): Promise<HTMLCanvasElement> {
  const s = getSave()
  const lines = journalLines(s.activities as Act[], now)
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  try { await document.fonts.load(`800 40px "Inter Variable"`) } catch { /* system font */ }
  // Paper: deep green-black with a soft glow from the top.
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0f1a14'); bg.addColorStop(1, '#060907')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W * 0.8, 0, 20, W * 0.8, 0, 760); glow.addColorStop(0, 'rgba(6,238,116,0.18)'); glow.addColorStop(1, 'rgba(6,238,116,0)')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1
  for (let x = 0; x < W; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() }
  for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke() }
  const X = 84
  const logo = await image('/brand/logo-new.png')
  if (logo) { const h = 92, w = (logo.naturalWidth / logo.naturalHeight) * h; g.drawImage(logo, X, 70, w, h) }
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'
  g.fillStyle = '#06ee74'; g.font = `700 26px ${F}`
  const date = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
  g.fillText(date, X, 236)
  g.fillStyle = '#f7f3ea'; g.font = `800 66px ${F}`; g.fillText('A day in my Web3 life', X, 312)
  const who = `${s.name || 'Player'}${s.username ? `  ·  @${s.username}` : ''}  ·  ${rankFor(s.xp).label}`
  g.fillStyle = '#b9c3bc'; g.font = `600 28px ${F}`; g.fillText(who, X, 362)
  // The day, part by part.
  let y = 440
  const maxY = 1040
  const groups = PARTS.map((p) => ({ p, ls: lines.filter((l) => l.part === p) })).filter((x) => x.ls.length)
  if (!groups.length) {
    g.fillStyle = '#dfe6e1'; g.font = `500 36px ${F}`
    for (const t of wrap(g, 'Nothing logged yet today. Walk to Campus: Zahra’s first lesson takes a minute and goes on your CV.', W - X * 2)) { g.fillText(t, X, y); y += 50 }
  }
  for (const { p, ls } of groups) {
    if (y > maxY - 90) break
    g.fillStyle = '#06ee74'; g.font = `800 24px ${F}`
    icon(g, p, X, y); g.fillText(p.toUpperCase(), X + 40, y); y += 46
    const show = ls.slice(0, 3)
    g.font = `500 34px ${F}`
    for (const l of show) {
      for (const [i, t] of wrap(g, l.text, W - X * 2 - 40).entries()) {
        if (y > maxY) break
        g.fillStyle = i ? '#dfe6e1' : '#f7f3ea'
        if (!i) { g.fillStyle = '#06ee74'; g.beginPath(); g.arc(X + 8, y - 11, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f7f3ea' }
        g.fillText(t, X + 32, y); y += 46
      }
    }
    if (ls.length > show.length && y <= maxY) { g.fillStyle = '#8f9b93'; g.font = `500 26px ${F}`; g.fillText(`and ${ls.length - show.length} more`, X + 32, y); y += 40 }
    y += 26
  }
  // Closer.
  g.fillStyle = '#e8d29a'; g.font = `italic 600 34px ${F}`
  let cy = Math.min(Math.max(y + 6, 1000), 1080)
  for (const t of wrap(g, journalCloser(lines), W - X * 2)) { g.fillText(t, X, cy); cy += 44 }
  // Footer: reputation and courses (no money), and the invite code.
  const courses = Object.values(s.skills as Record<string, { passed?: boolean } | undefined>).filter((v) => v?.passed).length
  const fy = 1170
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(X, fy - 40); g.lineTo(W - 300, fy - 40); g.stroke()
  g.fillStyle = '#f7f3ea'; g.font = `700 30px ${F}`
  g.fillText(`★ ${s.reputation} reputation${courses ? `   ✓ ${courses} course${courses === 1 ? '' : 's'} passed` : ''}`, X, fy + 4)
  g.fillStyle = '#8f9b93'; g.font = `600 22px ${F}`
  g.fillText('LEARN WEB3 BY LIVING IT  ·  PLAY FREE AT GRINDDISTRICT.APP', X, fy + 52)
  drawQr(g, inviteLink(s.username), W - 84 - 196, 1086, 196)
  g.fillStyle = '#8f9b93'; g.font = `600 18px ${F}`; g.textAlign = 'center'
  g.fillText('SCAN TO JOIN', W - 84 - 98, 1310); g.textAlign = 'left'
  return c
}

type H = { para: (t: string, cls?: string) => HTMLElement; button: (label: string, cls: string, on: () => void) => HTMLElement }

/** The Profile block: make today's journal card, then share it, post it on X or save it. */
export function journalNodes(h: H, say: (m: string) => void): HTMLElement {
  const box = document.createElement('div'); box.className = 'pcard journal'
  const make = h.button('Make today’s journal card', 'primary', () => {
    make.remove()
    const wait = h.para('Writing up your day…', 'muted'); box.append(wait)
    void drawJournal().then((canvas) => {
      wait.remove()
      const s = getSave()
      const lines = journalLines(s.activities as Act[])
      const link = inviteLink(s.username)
      const post = journalPost(lines, link)
      const img = document.createElement('img'); img.className = 'pcard-img'; img.alt = 'Your day in Grind District'; img.src = canvas.toDataURL('image/png')
      const file = (): Promise<File | null> => new Promise((done) => canvas.toBlob((b) => done(b ? new File([b], 'grind-district-my-day.png', { type: 'image/png' }) : null), 'image/png'))
      const share = h.button('Share', 'primary', () => {
        void file().then(async (f) => {
          const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
          try {
            if (f && nav.canShare?.({ files: [f] })) { await nav.share({ files: [f], title: 'My day in Grind District', text: post }); return }
            if (nav.share) { await nav.share({ title: 'My day in Grind District', text: post }); return }
            await navigator.clipboard.writeText(post); say('Post text copied. Save the picture to add it.')
          } catch { /* the player closed the share sheet */ }
        })
      })
      const toX = h.button('Post on 𝕏', 'ghost', () => {
        const a = document.createElement('a'); a.href = img.src; a.download = 'grind-district-my-day.png'; a.click()
        window.open(`https://x.com/intent/post?text=${encodeURIComponent(post)}`, '_blank', 'noopener')
        say('Picture saved: add it to your post.')
      })
      const save = h.button('Save picture', 'ghost', () => { const a = document.createElement('a'); a.href = img.src; a.download = 'grind-district-my-day.png'; a.click(); say('Journal card saved.') })
      const row = document.createElement('div'); row.className = 'pcard-row'; row.append(share, toX, save)
      box.append(img, row, h.para('Made from today’s activity log, by your phone’s clock. No balance, amounts or wallet are shown. The code is your invite link.', 'muted'))
    }).catch(() => { wait.textContent = 'Could not draw the card just now. Try again in a moment.' })
  })
  box.append(h.para('Your day in the district as a card: lessons, trades, visits and events, morning to night.', 'muted'), make)
  return box
}
