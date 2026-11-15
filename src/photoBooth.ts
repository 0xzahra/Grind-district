// The Grind Park photo booth's strip: four frames of the player (four camera angles on coloured backdrops) on a
// cream strip with the park's name and the date, shown on screen to save or share. The pictures come from the same
// portrait shot as the photo card; nothing leaves the device unless the player shares it.
const BG = ['#f6c6d6', '#bfe8d2', '#c5ddf6', '#f6e1a6']

const load = (src: string): Promise<HTMLImageElement | null> => new Promise((done) => { const i = new Image(); i.onload = () => done(i); i.onerror = () => done(null); i.src = src })
/** The opaque bounds of a transparent portrait. */
function bounds(img: HTMLImageElement): { x: number; y: number; w: number; h: number } {
  const w = img.naturalWidth, h = img.naturalHeight
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, w, h).data
    let x0 = w, y0 = h, x1 = -1, y1 = -1
    for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) if (d[(y * w + x) * 4 + 3]! > 170) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    return x1 < x0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  } catch { return { x: 0, y: 0, w, h } }
}

export async function drawStrip(shots: Array<string | null>): Promise<HTMLCanvasElement> {
  const W = 600, FW = 520, FH = 400, PAD = 40, GAP = 24, FOOT = 170
  const H = PAD + 4 * FH + 3 * GAP + FOOT
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#f7f1e6'; g.fillRect(0, 0, W, H)
  const imgs = await Promise.all(shots.map((s) => (s ? load(s) : Promise.resolve(null))))
  for (let i = 0; i < 4; i++) {
    const x = (W - FW) / 2, y = PAD + i * (FH + GAP)
    g.save(); g.beginPath(); g.roundRect(x, y, FW, FH, 10); g.clip()
    const bg = g.createRadialGradient(x + FW / 2, y + FH * 0.4, 30, x + FW / 2, y + FH / 2, FW * 0.75)
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, BG[i]!)
    g.fillStyle = bg; g.fillRect(x, y, FW, FH)
    const img = imgs[i]
    if (img) {
      // Head and shoulders to the waist: the top 55% of the figure, filling the frame's height.
      const b = bounds(img), sh = b.h * 0.55, k = (FH * 0.98) / sh, dw = b.w * k
      g.drawImage(img, b.x, b.y, b.w, sh, x + (FW - dw) / 2, y + FH * 0.04, dw, FH * 0.98)
    }
    g.restore()
    g.strokeStyle = 'rgba(40,30,20,.18)'; g.lineWidth = 2; g.beginPath(); g.roundRect(x, y, FW, FH, 10); g.stroke()
  }
  const fy = PAD + 4 * FH + 3 * GAP
  g.textAlign = 'center'; g.fillStyle = '#123524'
  g.font = '800 46px "Inter Variable", system-ui, sans-serif'; g.fillText('GRIND PARK', W / 2, fy + 70)
  g.fillStyle = '#b8903e'; g.font = '600 24px "Inter Variable", system-ui, sans-serif'
  g.fillText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' · grinddistrict.app', W / 2, fy + 112)
  return c
}

/** Show the strip with Save and Share. */
export async function showBoothStrip(shots: Array<string | null>): Promise<void> {
  const canvas = await drawStrip(shots)
  const url = canvas.toDataURL('image/png')
  document.getElementById('booth-strip')?.remove()
  const wrap = document.createElement('div'); wrap.id = 'booth-strip'; wrap.className = 'booth-strip'
  wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Your photo booth strip')
  const card = document.createElement('div'); card.className = 'booth-card'
  const img = document.createElement('img'); img.src = url; img.alt = 'Four photo booth frames of you at Grind Park'
  const row = document.createElement('div'); row.className = 'booth-row'
  const btn = (t: string, primary: boolean, f: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.className = `gd-btn${primary ? ' primary' : ''}`; b.onclick = f; return b }
  row.append(
    btn('Save', true, () => { const a = document.createElement('a'); a.href = url; a.download = 'grind-park-photo-strip.png'; a.click() }),
    btn('Share', false, () => {
      canvas.toBlob((blob) => {
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
        const file = blob ? new File([blob], 'grind-park-photo-strip.png', { type: 'image/png' }) : null
        if (file && nav.canShare?.({ files: [file] })) void nav.share({ files: [file], title: 'Grind Park', text: 'Photo booth at Grind Park · grinddistrict.app' }).catch(() => undefined)
        else { const a = document.createElement('a'); a.href = url; a.download = 'grind-park-photo-strip.png'; a.click() }
      }, 'image/png')
    }),
    btn('Close', false, () => wrap.remove()),
  )
  card.append(img, row); wrap.append(card)
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove() })
  document.body.append(wrap)
}
