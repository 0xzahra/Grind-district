// My Gallery: every screenshot, selfie, photo-booth strip and skit you made, in one grid (media.ts keeps them on
// this device). Tap one to see it full size, then download it, share it to your socials (the phone's share sheet:
// X, Instagram, TikTok, WhatsApp...) or delete it. Selfie and Record a skit start from here too.
import { listMedia, getMedia, deleteMedia, fileName, type MediaKind, type MediaMeta } from './media.ts'

const KINDS: Array<[MediaKind | 'all', string]> = [['all', 'All'], ['screenshot', 'Screenshots'], ['selfie', 'Selfies'], ['booth', 'Photo booth'], ['skit', 'Skits']]
const LABEL: Record<MediaKind, string> = { screenshot: 'Screenshot', selfie: 'Selfie', booth: 'Photo booth', skit: 'Skit' }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const key = (label: string, cls: string, on: () => void) => { const b = el('button', label, `gm-key ${cls}`); b.type = 'button'; b.onclick = on; return b }
const when = (at: number) => new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export type GalleryDeps = { toast: (m: string) => void; shot?: () => void; selfie?: () => void; skit?: () => void }

let filter: MediaKind | 'all' = 'all'
export function openMyGallery(d: GalleryDeps): void {
  document.getElementById('gd-modal')?.remove()
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'My Gallery')
  const card = el('div', '', 'gm-card mg-card')
  const close = () => { shade.remove(); window.removeEventListener('gd:media', refresh) }
  shade.addEventListener('click', (e) => { if (e.target === shade) close() })
  const head = el('div', '', 'gm-head'), t = el('div')
  t.append(el('p', 'Saved on this device', 'gm-kick'), el('h3', 'My Gallery', 'gm-title'))
  head.append(t, key('Close', 'gm-ghost', close))
  const make = el('div', '', 'gm-keys mg-make')
  if (d.shot) make.append(key('📷 Take a screenshot', 'gm-go', () => { close(); d.shot!() }))
  if (d.selfie) make.append(key('🤳 Take a selfie', 'gm-go', () => { close(); d.selfie!() }))
  if (d.skit) make.append(key('🎬 Record a skit', 'gm-go', () => { close(); d.skit!() }))
  const tabs = el('div', '', 'mg-tabs')
  const grid = el('div', '', 'mg-grid')
  const empty = el('p', '', 'gm-sub mg-empty')
  card.append(head, make, tabs, grid, empty)
  shade.append(card); document.body.append(shade)

  const paintTabs = (items: MediaMeta[]) => {
    tabs.replaceChildren(...KINDS.map(([k, label]) => {
      const n = k === 'all' ? items.length : items.filter((m) => m.kind === k).length
      const b = el('button', `${label}${n ? ` · ${n}` : ''}`, `mg-tab${filter === k ? ' on' : ''}`); b.type = 'button'
      b.onclick = () => { filter = k; void refresh() }
      return b
    }))
  }
  async function refresh(): Promise<void> {
    const items = await listMedia()
    if (!card.isConnected) return
    paintTabs(items)
    const shown = filter === 'all' ? items : items.filter((m) => m.kind === filter)
    grid.replaceChildren(...shown.map((m) => {
      const b = el('button', '', `mg-cell mg-${m.kind}`); b.type = 'button'; b.setAttribute('aria-label', `${LABEL[m.kind]}, ${when(m.at)}`)
      const img = el('img'); img.src = m.thumb; img.alt = ''; img.loading = 'lazy'
      b.append(img, el('span', m.kind === 'skit' ? `▶ ${mmss(m.secs ?? 0)}` : LABEL[m.kind], 'mg-badge'))
      b.onclick = () => void view(m.id)
      return b
    }))
    empty.textContent = shown.length ? '' : filter === 'all'
      ? 'Nothing here yet. Take a screenshot or a selfie above, use the photo booth at Grind Park, or record a skit with friends.'
      : `No ${KINDS.find(([k]) => k === filter)![1].toLowerCase()} yet.`
  }
  window.addEventListener('gd:media', refresh)
  void refresh()

  async function view(id: string): Promise<void> {
    const m = await getMedia(id)
    if (!m || !card.isConnected) return
    const url = URL.createObjectURL(m.blob)
    const v = el('div', '', 'mg-view')
    const media = m.kind === 'skit' || m.type.startsWith('video/')
      ? fullLength(Object.assign(el('video'), { src: url, controls: true, playsInline: true, loop: true }))
      : Object.assign(el('img'), { src: url, alt: `${LABEL[m.kind]}, ${when(m.at)}` })
    media.className = 'mg-media'
    const file = new File([m.blob], fileName(m), { type: m.type })
    const back = () => { URL.revokeObjectURL(url); v.remove(); grid.hidden = false; tabs.hidden = false; make.hidden = false; empty.hidden = false }
    const download = () => { const a = el('a'); a.href = url; a.download = file.name; document.body.append(a); a.click(); a.remove(); d.toast('Downloaded.') }
    const keys = el('div', '', 'gm-keys')
    keys.append(
      key('Back', 'gm-ghost', back),
      key('Delete', 'gm-ghost mg-del', () => { if (!confirm('Delete this from My Gallery?')) return; void deleteMedia(m.id).then(back) }),
      key('Download', 'gm-ghost', download),
      key('Share', 'gm-go', () => {
        const nav = navigator as Navigator & { canShare?: (x: ShareData) => boolean }
        if (nav.canShare?.({ files: [file] })) void nav.share({ files: [file] }).catch((e: Error) => { if (e.name !== 'AbortError') download() })
        else { download(); d.toast('Downloaded. Post it from your device to X, Instagram or TikTok.') }
      }),
    )
    v.append(el('p', `${LABEL[m.kind]} · ${when(m.at)}${m.secs ? ` · ${mmss(m.secs)}` : ''}`, 'gm-sub'), media, keys)
    grid.hidden = true; tabs.hidden = true; make.hidden = true; empty.hidden = true
    card.append(v)
  }
}

/** A small "Saved to My Gallery" pill by the Gallery key that opens the gallery when tapped. */
export function flashSaved(what: string, open: () => void): void {
  document.getElementById('mg-saved')?.remove()
  const b = el('button', `${what} saved to My Gallery · View`, 'mg-saved'); b.id = 'mg-saved'; b.type = 'button'
  b.onclick = () => { b.remove(); open() }
  document.body.append(b)
  window.setTimeout(() => b.remove(), 3500)
}

/** A browser-recorded video often carries no length (WebM): the player then shows a live bar and stops short.
 *  Seek once past the end so the browser reads the real length, rewind, then play from the start. */
function fullLength(v: HTMLVideoElement): HTMLVideoElement {
  const start = () => { v.currentTime = 0; void v.play().catch(() => undefined) }
  v.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(v.duration) && v.duration > 0) { start(); return }
    const back = () => { if (!Number.isFinite(v.duration)) return; v.removeEventListener('durationchange', back); v.removeEventListener('timeupdate', back); start() }
    v.addEventListener('durationchange', back); v.addEventListener('timeupdate', back)
    v.currentTime = 1e101
  }, { once: true })
  return v
}
