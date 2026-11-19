// Outfit colours, off the main thread. This was the biggest freeze in the game on phones: about a hundred and
// sixty thousand pixels per resident, twenty residents, and the player's own figure at twice the size with its
// face sharpened (seconds of work on a slow phone, every time the outfit changed), all on the thread that also
// draws the frames. humans.ts sends each figure's texture once (a bitmap, read here); then only a look's colours
// go over and the finished pixels come back. The pixel maths is shared with the main-thread fallback: skinPaint.ts.
import { dressPixels, shrink, type Colours, type Makeup } from './skinPaint.ts'

type Px = { w: number; h: number; base: Uint8ClampedArray; mask: Uint8ClampedArray }
type Tex = { type: 'tex'; name: string; bitmap: ImageBitmap; maskUrl: string }
type Job = { type: 'dress'; id: number; name: string; detail: number; colours: Colours; sharp?: boolean; makeup?: Makeup }

const full = new Map<string, Promise<Px | null>>()
const sized = new Map<string, Promise<Px | null>>()
const post = (m: unknown, t: Transferable[] = []) => (self as unknown as { postMessage: (m: unknown, t: Transferable[]) => void }).postMessage(m, t)

function read(src: ImageBitmap, w: number, h: number): Uint8ClampedArray {
  const c = new OffscreenCanvas(w, h)
  const g = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
  g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0, w, h)
  return g.getImageData(0, 0, w, h).data
}
async function load(m: Tex): Promise<Px | null> {
  try {
    const w = m.bitmap.width, h = m.bitmap.height
    const base = read(m.bitmap, w, h)
    m.bitmap.close()
    const mb = await createImageBitmap(await (await fetch(m.maskUrl)).blob())
    const mask = read(mb, w, h)
    mb.close()
    return { w, h, base, mask }
  } catch { return null }
}
// Crowd figures wear their texture at half size: recolour at that size (a quarter of the pixels).
function at(name: string, detail: number): Promise<Px | null> {
  const f = full.get(name)
  if (!f) return Promise.resolve(null)
  if (detail >= 1) return f
  const key = `${name}|${detail}`
  let p = sized.get(key)
  if (!p) {
    p = f.then((px) => {
      if (!px) return null
      const w = Math.max(1, Math.round(px.w * detail)), h = Math.max(1, Math.round(px.h * detail))
      return { w, h, base: shrink(px.base, px.w, px.h, w, h, true), mask: shrink(px.mask, px.w, px.h, w, h, false) }
    })
    sized.set(key, p)
  }
  return p
}
async function dress(m: Job): Promise<void> {
  const px = await at(m.name, m.detail)
  if (!px) { post({ id: m.id, data: null }); return }
  const r = dressPixels(px.base, px.mask, px.w, px.h, m.colours, { sharp: m.sharp && m.detail >= 1, makeup: m.makeup })
  post({ id: m.id, data: r.data.buffer, w: r.w, h: r.h }, [r.data.buffer])
}

self.onmessage = (e: MessageEvent<Tex | Job>) => {
  const m = e.data
  if (m.type === 'tex') { if (!full.has(m.name)) full.set(m.name, load(m)); else m.bitmap.close(); return }
  void dress(m).catch(() => post({ id: m.id, data: null }))
}
