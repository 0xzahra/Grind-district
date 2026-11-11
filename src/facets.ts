// Painted surface finishes: weathered tone, slabs and boards. Each helper paints a small tileable canvas once;
// materials multiply it with a flat colour. (Photographed detail lives in surfaces.ts and groundDetail.ts.)
import * as THREE from 'three'

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296
}

/**
 * Paint a tileable, weathered tone onto `g` (w x h px): broad soft clouds of lighter and darker colour with a
 * fine grain over them, the way plaster, stone and concrete really vary. (It used to paint big flat triangles,
 * the old faceted low-poly look; the name and arguments are kept for its many callers.) `cells` sets how broad
 * the clouds are, `contrast` how strong.
 */
export function paintFacets(g: CanvasRenderingContext2D, w: number, h: number, seed: number, cells: number, contrast: number, base: [number, number, number] = [255, 255, 255]): void {
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
  g.fillRect(0, 0, w, h)
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return
  const r = rng(seed)
  /** A small grid of greys scaled up smoothly; its border wraps, so the result tiles. */
  const cloud = (n: number, amount: number) => {
    const c = document.createElement('canvas')
    c.width = c.height = n + 2
    const cg = c.getContext('2d')
    if (!cg) return
    const tone: number[] = []
    for (let i = 0; i < n * n; i++) tone.push(r())
    const im = cg.createImageData(n + 2, n + 2)
    for (let y = 0; y < n + 2; y++) for (let x = 0; x < n + 2; x++) {
      const v = Math.round(128 + (tone[((y + n - 1) % n) * n + ((x + n - 1) % n)]! - 0.5) * 255 * amount)
      im.data.set([v, v, v, 255], (y * (n + 2) + x) * 4)
    }
    cg.putImageData(im, 0, 0)
    g.save()
    g.globalCompositeOperation = 'soft-light'
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(c, -w / n, -h / n, (w * (n + 2)) / n, (h * (n + 2)) / n)
    g.restore()
  }
  const k = Math.min(1, contrast * 5.5)
  cloud(Math.max(3, Math.round(cells * 0.45)), k)
  cloud(Math.max(6, cells * 2), k * 0.6)
  // Fine grain.
  const grain = document.createElement('canvas')
  grain.width = grain.height = 128
  const gg = grain.getContext('2d')
  if (gg) {
    const im = gg.createImageData(128, 128)
    for (let i = 0; i < 128 * 128; i++) { const v = Math.round(128 + (r() - 0.5) * 90); im.data.set([v, v, v, 255], i * 4) }
    gg.putImageData(im, 0, 0)
    const pattern = g.createPattern(grain, 'repeat')
    if (pattern) { g.save(); g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5; g.fillStyle = pattern; g.fillRect(0, 0, w, h); g.restore() }
  }
}

const cache = new Map<string, THREE.CanvasTexture>()
function make(key: string, size: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = cache.get(key)
  if (!t) {
    // No canvas outside a browser (the Node look check): a blank texture keeps materials valid.
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return new THREE.CanvasTexture(undefined as unknown as HTMLCanvasElement)
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')
    if (g) draw(g)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    cache.set(key, t)
  }
  return t
}

/** White-ish facet tone map to multiply with a material colour. Returns a clone so each user can set its own repeat. */
export function facetMap(seed = 1, cells = 4, contrast = 0.12, repeat = 1, anisotropy = 4): THREE.Texture {
  const t = make(`f${seed}:${cells}:${contrast}`, 256, (g) => paintFacets(g, 256, 256, seed, cells, contrast)).clone()
  t.repeat.set(repeat, repeat)
  t.anisotropy = anisotropy
  t.needsUpdate = true
  return t
}

/** Stone paving: large slabs with fine joints, each slab its own flat tone. `n` slabs across one tile. */
export function slabMap(seed = 3, n = 3, repeat = 1, anisotropy = 4): THREE.Texture {
  const t = make(`s${seed}:${n}`, 256, (g) => {
    const r = rng(seed)
    const s = 256 / n
    g.fillStyle = '#8f8a82'
    g.fillRect(0, 0, 256, 256)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = 222 + Math.round(r() * 30)
      g.fillStyle = `rgb(${k},${k},${k})`
      const off = j % 2 ? s / 2 : 0
      for (const x of [i * s + off, i * s + off - 256]) g.fillRect(x + 1.5, j * s + 1.5, s - 3, s - 3)
    }
  }).clone()
  t.repeat.set(repeat, repeat)
  t.anisotropy = anisotropy
  t.needsUpdate = true
  return t
}

/** Timber boards along x: flat tones per board, thin joints, a few staggered butt ends. */
export function plankMap(seed = 5, boards = 6, repeat = 1, anisotropy = 4): THREE.Texture {
  const t = make(`p${seed}:${boards}`, 256, (g) => {
    const r = rng(seed)
    const h = 256 / boards
    for (let j = 0; j < boards; j++) {
      const k = 218 + Math.round(r() * 36)
      g.fillStyle = `rgb(${k},${k},${k})`
      g.fillRect(0, j * h, 256, h)
      g.fillStyle = 'rgba(0,0,0,0.28)'
      g.fillRect(0, j * h, 256, 1.5)
      const cut = Math.round(r() * 256)
      g.fillRect(cut, j * h, 1.5, h)
      const k2 = 214 + Math.round(r() * 36)
      g.fillStyle = `rgba(${k2},${k2},${k2},0.6)`
      g.fillRect(cut + 2, j * h + 2, (256 - cut) * 0.6, h - 3)
    }
  }).clone()
  t.repeat.set(repeat, repeat)
  t.anisotropy = anisotropy
  t.needsUpdate = true
  return t
}
