// My Gallery's store: the photos and videos you make in the game (screenshots, selfies, photo-booth strips and
// skits), kept on this device in IndexedDB. Separate from the save on purpose: nothing here touches progress,
// and nothing is uploaded. Each item keeps a small JPEG thumbnail for the grid.
export type MediaKind = 'screenshot' | 'selfie' | 'booth' | 'skit'
export type MediaItem = { id: string; kind: MediaKind; at: number; type: string; blob: Blob; thumb: string; w?: number; h?: number; secs?: number; title?: string }
export type MediaMeta = Omit<MediaItem, 'blob'>

const DB = 'gd-media', STORE = 'items', MAX_ITEMS = 300
let opening: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  opening ??= new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }).createIndex('at', 'at') }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => { opening = null; fail(req.error) }
  })
  return opening
}
const tx = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const d = await db()
  return new Promise((ok, fail) => { const r = run(d.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error) })
}

/** A small JPEG thumbnail of an image blob or a canvas (the longer side 320 px). */
export async function thumbOf(src: Blob | HTMLCanvasElement | HTMLVideoElement): Promise<{ thumb: string; w: number; h: number }> {
  let img: CanvasImageSource, w: number, h: number
  if (src instanceof Blob) { const b = await createImageBitmap(src); img = b; w = b.width; h = b.height }
  else if (src instanceof HTMLVideoElement) { img = src; w = src.videoWidth; h = src.videoHeight }
  else { img = src; w = src.width; h = src.height }
  const k = 320 / Math.max(w, h, 1), c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return { thumb: c.toDataURL('image/jpeg', 0.72), w, h }
}

/** Keep a new photo or video. Resolves to the stored item's id, or null when the browser refuses (full or private). */
export async function saveMedia(kind: MediaKind, blob: Blob, extra: { thumb?: string; w?: number; h?: number; secs?: number; title?: string } = {}): Promise<string | null> {
  try {
    const t = extra.thumb ? { thumb: extra.thumb, w: extra.w ?? 0, h: extra.h ?? 0 } : await thumbOf(blob)
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const item: MediaItem = { id, kind, at: Date.now(), type: blob.type || (kind === 'skit' ? 'video/webm' : 'image/png'), blob, thumb: t.thumb, w: extra.w ?? t.w, h: extra.h ?? t.h, ...(extra.secs ? { secs: extra.secs } : {}), ...(extra.title ? { title: extra.title } : {}) }
    await tx('readwrite', (s) => s.put(item))
    // Oldest first out past the cap, so the gallery never fills the device.
    const all = await listMedia()
    for (const old of all.slice(MAX_ITEMS)) await deleteMedia(old.id)
    window.dispatchEvent(new CustomEvent('gd:media', { detail: { id, kind } }))
    return id
  } catch { return null }
}
/** Everything, newest first, without the blobs (thumbnails only). */
export async function listMedia(): Promise<MediaMeta[]> {
  try {
    const all = await tx('readonly', (s) => s.getAll() as IDBRequest<MediaItem[]>)
    return all.map(({ blob: _b, ...m }) => m).sort((a, b) => b.at - a.at)
  } catch { return [] }
}
export async function getMedia(id: string): Promise<MediaItem | null> { try { return (await tx('readonly', (s) => s.get(id) as IDBRequest<MediaItem | undefined>)) ?? null } catch { return null } }
export async function deleteMedia(id: string): Promise<void> { try { await tx('readwrite', (s) => s.delete(id)); window.dispatchEvent(new CustomEvent('gd:media', { detail: { id, deleted: true } })) } catch { /* already gone */ } }

export const extOf = (type: string): string => (type.includes('mp4') ? 'mp4' : type.includes('webm') ? 'webm' : type.includes('jpeg') ? 'jpg' : 'png')
export const fileName = (m: Pick<MediaMeta, 'kind' | 'at' | 'type'>): string => `grind-district-${m.kind}-${new Date(m.at).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extOf(m.type)}`
