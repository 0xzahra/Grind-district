// Share a picture with its link, from anywhere in the game (the city stats card, McGrind posters, any flyer later).
// The picture is made in the game, shown in a preview, and goes out with the post: on phones the system share sheet
// gets the image file itself plus the link (no saving to the gallery first); on computers "Copy picture" puts the
// image on the clipboard, and the X and Farcaster buttons post the link, whose page shows the same picture as its
// preview card. Links always point at the live site and say where they were posted (?src=x and so on).
export const SITE = 'https://www.grinddistrict.app'

export type ShareJob = {
  /** The finished picture. */
  canvas: HTMLCanvasElement
  /** File name without extension, e.g. "grind-district-city-stats". */
  name: string
  /** Heading over the preview, e.g. "Share the city stats". */
  heading: string
  /** The words that go with the post (the link is added after them). */
  text: string
  /** The public page for this picture (its preview card is the picture). */
  url: string
  toast: (m: string) => void
}

const tagged = (url: string, via: string) => { const u = new URL(url); u.searchParams.set('src', via); u.searchParams.set('utm_source', via); return u.toString() }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }

let open: HTMLElement | null = null

/** Show the share sheet for a picture. Every button acts in the tap itself (phones only share files from a tap). */
export async function sharePicture(job: ShareJob): Promise<void> {
  open?.remove()
  const jpeg = await new Promise<Blob | null>((res) => job.canvas.toBlob(res, 'image/jpeg', 0.92))
  if (!jpeg) { job.toast('Could not make the picture on this device.'); return }
  const file = new File([jpeg], `${job.name}.jpg`, { type: 'image/jpeg' })
  // Clipboards take PNG only; made now so "Copy picture" needs no wait inside the tap.
  const png = await new Promise<Blob | null>((res) => job.canvas.toBlob(res, 'image/png'))
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  const canFiles = !!nav.canShare?.({ files: [file] })

  const back = el('div', 'shr')
  back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true'); back.setAttribute('aria-label', job.heading)
  const card = el('div', 'shr-card')
  const head = el('div', 'shr-head')
  head.append(el('strong', '', job.heading))
  const x = el('button', 'shr-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close')
  head.append(x)
  const pic = el('img', 'shr-pic')
  const objUrl = URL.createObjectURL(jpeg)
  pic.src = objUrl; pic.alt = job.heading
  const keys = el('div', 'shr-keys')
  const key = (label: string, cls: string, run: () => void) => { const b = el('button', `shr-key ${cls}`, label); b.type = 'button'; b.onclick = run; keys.append(b); return b }
  const close = () => { URL.revokeObjectURL(objUrl); back.remove(); if (open === back) open = null; document.removeEventListener('keydown', onKey) }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  x.onclick = close
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close() })
  document.addEventListener('keydown', onKey)

  if (canFiles) {
    key('Share picture', 'gold', () => {
      void nav.share({ files: [file], title: job.heading, text: `${job.text} ${tagged(job.url, 'image')}` }).catch(() => undefined)
    })
  }
  key('Post on X', 'x', () => { window.open(`https://x.com/intent/post?text=${encodeURIComponent(job.text)}&url=${encodeURIComponent(tagged(job.url, 'x'))}`, '_blank', 'noopener') })
  key('Cast on Farcaster', 'fc', () => { window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(job.text)}&embeds[]=${encodeURIComponent(tagged(job.url, 'farcaster'))}`, '_blank', 'noopener') })
  const ClipItem = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
  if (png && ClipItem && navigator.clipboard?.write) {
    const b = key('Copy picture', 'ghost', () => {
      navigator.clipboard.write([new ClipItem({ 'image/png': png })]).then(() => { b.textContent = 'Picture copied'; job.toast('Picture copied: paste it into your post.') }, () => job.toast('This browser would not copy the picture.'))
    })
  }
  const l = key('Copy link', 'ghost', () => {
    const link = tagged(job.url, 'link')
    navigator.clipboard?.writeText(link).then(() => { l.textContent = 'Link copied' }, () => job.toast(link))
  })
  const note = el('p', 'shr-note', canFiles ? 'The picture goes with your post, with the link to play.' : 'Your post shows this picture as its preview, with the link to play.')
  card.append(head, pic, keys, note)
  back.append(card)
  document.body.append(back)
  open = back
}

/** Load a picture from the site for drawing (null when it cannot load). */
export function loadPicture(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = src
  })
}
