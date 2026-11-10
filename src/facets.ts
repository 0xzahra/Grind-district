// Flat, faceted surface finishes (the art reference: big planar facets, matte colour, no photo textures).
// Each helper paints a small tileable canvas once; materials multiply it with a flat colour.
import * as THREE from 'three'

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296
}

/** Paint a tileable field of large triangles in slightly different tones onto `g` (w x h px). */
export function paintFacets(g: CanvasRenderingContext2D, w: number, h: number, seed: number, cells: number, contrast: number, base: [number, number, number] = [255, 255, 255]): void {
  const r = rng(seed)
  const jx: number[] = [], jy: number[] = [], tone: number[] = [], flip: boolean[] = []
  for (let i = 0; i < cells * cells; i++) { jx.push((r() - 0.5) * 0.7); jy.push((r() - 0.5) * 0.7); tone.push(r(), r()); flip.push(r() > 0.5) }
  const cw = w / cells, ch = h / cells
  const at = (i: number, j: number): [number, number] => {
    const k = ((j % cells) + cells) % cells * cells + ((i % cells) + cells) % cells
    return [(i + jx[k]!) * cw, (j + jy[k]!) * ch]
  }
  const tri = (a: [number, number], b: [number, number], c: [number, number], t: number) => {
    const k = 1 - contrast * t
    const col = `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`
    g.fillStyle = col
    g.strokeStyle = col
    g.lineWidth = 1.5
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.fill(); g.stroke()
  }
  for (let j = -1; j <= cells; j++) for (let i = -1; i <= cells; i++) {
    const k = ((j % cells) + cells) % cells * cells + ((i % cells) + cells) % cells
    const p00 = at(i, j), p10 = at(i + 1, j), p01 = at(i, j + 1), p11 = at(i + 1, j + 1)
    if (flip[k]) { tri(p00, p10, p11, tone[k * 2]!); tri(p00, p11, p01, tone[k * 2 + 1]!) }
    else { tri(p00, p10, p01, tone[k * 2]!); tri(p10, p11, p01, tone[k * 2 + 1]!) }
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
