// Share your P&L: a picture card for a coin you hold, a perpetual you have open, or the whole portfolio. It shows the
// return in percent, the entry and the price now, and your invite link. The dollar amount is hidden unless you
// switch it on (no balance shows by default). Share it to any app, post it on X, or keep it in My Gallery.
import { getSave } from './state.ts'
import { shareLink } from './share.ts'

export type PnlInfo = {
  title: string // "BTC" or "BTC-PERP" or "My portfolio"
  sub: string // "Bitcoin · Spot" or "Long 5x"
  tint: string
  pct: number // the return, in percent
  entry?: number
  mark?: number
  usd?: number // the P&L in in-game dollars (hidden unless the player shows it)
  /** A trade receipt instead of a return: the big line ("Bought 0.0012 BTC") and rows under it. */
  headline?: string
  rows?: Array<[string, string]>
  /** The small word over the card: "P&L" (default) or "Trade", "Vault"... */
  kind?: string
}

const FONT = '"Inter Variable", Inter, system-ui, sans-serif'
const money = (v: number) => `${v < 0 ? '-' : '+'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const price = (v: number) => `$${v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v >= 1 ? v.toFixed(2) : v.toPrecision(3)}`
const logo = new Image(); logo.decoding = 'async'; logo.src = '/brand/logo-new.webp'

function draw(c: HTMLCanvasElement, p: PnlInfo, showUsd: boolean): void {
  const W = 1080, H = 1350
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const up = p.pct >= 0, col = up ? '#21d98d' : '#ff5a5f'
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0b1311'); bg.addColorStop(1, up ? '#0d2a1e' : '#2a1013')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  // a soft glow and a rising (or falling) line behind the number
  const glow = g.createRadialGradient(W * 0.7, H * 0.42, 40, W * 0.7, H * 0.42, 620); glow.addColorStop(0, up ? 'rgba(33,217,141,0.22)' : 'rgba(255,90,95,0.22)'); glow.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)
  g.beginPath()
  for (let i = 0; i <= 40; i++) { const x = 60 + (i / 40) * (W - 120), t = i / 40, wob = Math.sin(i * 1.7) * 26 + Math.sin(i * 0.6) * 18; const y = H * 0.62 - (up ? t : -t) * 260 + wob; if (i) g.lineTo(x, y); else g.moveTo(x, y) }
  g.strokeStyle = up ? 'rgba(33,217,141,0.55)' : 'rgba(255,90,95,0.55)'; g.lineWidth = 6; g.lineJoin = 'round'; g.stroke()
  // the brand
  if (logo.complete && logo.naturalWidth) { const w = 300, h = w * logo.naturalHeight / logo.naturalWidth; g.drawImage(logo, 80, 80, w, h) }
  else { g.fillStyle = '#17f790'; g.font = `900 56px ${FONT}`; g.fillText('GRIND DISTRICT', 80, 140) }
  // the coin
  g.fillStyle = p.tint; g.beginPath(); g.arc(130, 380, 50, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#ffffff'; g.font = `800 46px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.title.slice(0, 1), 130, 383)
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'
  g.fillStyle = '#ffffff'; g.font = `800 64px ${FONT}`; g.fillText(p.title, 205, 380)
  g.fillStyle = 'rgba(255,255,255,0.65)'; g.font = `600 36px ${FONT}`; g.fillText(p.sub, 207, 428)
  // the return (or, for a trade receipt, what was done, fitted to the card)
  if (p.headline) {
    g.fillStyle = '#ffffff'; let size = 110; g.font = `900 ${size}px ${FONT}`
    while (g.measureText(p.headline).width > W - 160 && size > 54) { size -= 4; g.font = `900 ${size}px ${FONT}` }
    g.fillText(p.headline, 78, 660)
    if (p.pct) { g.fillStyle = col; g.font = `800 64px ${FONT}`; g.fillText(`${up ? '+' : ''}${p.pct.toFixed(2)}%`, 82, 750) }
  } else {
    g.fillStyle = col; g.font = `900 190px ${FONT}`
    g.fillText(`${up ? '+' : ''}${p.pct.toFixed(2)}%`, 74, 700)
  }
  if (showUsd && p.usd !== undefined) { g.fillStyle = col; g.font = `700 60px ${FONT}`; g.fillText(`${money(p.usd)} in-game`, 82, 790) }
  // entry and now
  let y = showUsd && p.usd !== undefined ? 900 : 860
  const rowKV = (k: string, v: string) => { g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `600 38px ${FONT}`; g.fillText(k, 82, y); g.fillStyle = '#ffffff'; g.font = `700 44px ${FONT}`; g.textAlign = 'right'; g.fillText(v, W - 82, y); g.textAlign = 'left'; y += 74 }
  if (p.entry) rowKV('Entry price', price(p.entry))
  if (p.mark) rowKV('Price now', price(p.mark))
  for (const [k, v] of p.rows ?? []) if (y < H - 290) rowKV(k, v)
  // who, and where to play
  const s = getSave()
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(80, H - 250, W - 160, 2)
  g.fillStyle = '#ffffff'; g.font = `700 42px ${FONT}`; g.fillText(s.username ? `@${s.username}` : s.name || 'Grind District player', 82, H - 175)
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = `600 32px ${FONT}`; g.fillText('Practice trading with in-game money · live market prices', 82, H - 125)
  g.fillStyle = '#17f790'; g.font = `700 34px ${FONT}`; g.fillText('grinddistrict.app', 82, H - 75)
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }

/** Open the share window for one P&L. */
export function sharePnl(p: PnlInfo, toast: (m: string) => void): void {
  document.getElementById('gd-modal')?.remove()
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'Share your P&L')
  const card = el('div', '', 'gm-card pnl-share')
  const close = () => shade.remove()
  const head = el('div', '', 'gm-head'), t = el('div')
  t.append(el('p', 'Share', 'gm-kick'), el('h3', `${p.title} ${p.kind ?? 'P&L'}`, 'gm-title'))
  const x = el('button', 'Close', 'gm-key gm-ghost'); x.type = 'button'; x.onclick = close
  head.append(t, x)
  const cv = el('canvas', '', 'pnl-canvas')
  let showUsd = false
  const paint = () => draw(cv, p, showUsd)
  paint()
  if (!logo.complete) logo.onload = paint
  const opt = el('label', '', 'pnl-opt'), box = el('input'); box.type = 'checkbox'
  box.onchange = () => { showUsd = box.checked; paint() }
  opt.append(box, el('span', 'Show the dollar amount'))
  opt.hidden = p.usd === undefined
  const file = () => new Promise<File | null>((ok) => cv.toBlob((b) => ok(b ? new File([b], `grind-district-pnl-${p.title.toLowerCase()}.png`, { type: 'image/png' }) : null), 'image/png'))
  const text = () => p.headline
    ? `${p.headline} on Grind District${p.pct ? ` (${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(2)}%)` : ''}, practice trading at live prices. Learn it before you risk it:`
    : `${p.title} ${p.pct >= 0 ? '+' : ''}${p.pct.toFixed(2)}% on Grind District, practice trading at live prices. Learn it before you risk it:`
  const link = () => shareLink('/', 'invite', getSave().username)
  const keys = el('div', '', 'gm-keys')
  const key = (label: string, cls: string, run: () => void) => { const b = el('button', label, `gm-key ${cls}`); b.type = 'button'; b.onclick = run; keys.append(b) }
  key('Share', 'gm-go', () => void file().then(async (f) => {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (f && nav.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f], text: `${text()} ${link()}` }); return } catch { /* cancelled */ return } }
    if (f) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.append(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 10000); toast('P&L card saved to Downloads. Attach it to your post.') }
  }))
  key('Post on 𝕏', 'gm-ghost', () => { window.open(`https://x.com/intent/post?text=${encodeURIComponent(text())}&url=${encodeURIComponent(link())}`, '_blank', 'noopener') })
  key('Save to My Gallery', 'gm-ghost', () => void file().then(async (f) => {
    if (!f) return
    const { saveMedia } = await import('./media.ts')
    const id = await saveMedia('screenshot', f, { title: `${p.title} ${p.kind ?? 'P&L'}` })
    toast(id ? 'Saved to My Gallery.' : 'Could not save here (storage full or a private window).')
  }))
  card.append(head, cv, opt, keys, el('p', 'Practice trading with in-game money. Not financial advice.', 'gm-sub'))
  shade.append(card)
  shade.onclick = (e) => { if (e.target === shade) close() }
  document.body.append(shade)
}
