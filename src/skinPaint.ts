// The pixel work behind outfit colours, makeup and the player's sharper face, as plain functions over RGBA bytes
// (no three.js, no DOM), so the same code runs in the dressing worker (dressWorker.ts) and, where a browser has no
// worker canvas, on the main thread (humans.ts).
export type Rgb = [number, number, number]
/** Per region (0 = none, then skin, hair, top, bottom, shoes): the target colour and the texture's own average, linear.
 *  Couture (couture.ts) adds `bare`: UV triangles of the top painted as skin in `bareTone` (a bralette's bare midriff,
 *  shoulders and arms), and `dots`: a fine beaded weave over the top and skirt, this many texels a bead. */
export type Colours = { target: Array<Rgb | null>; mean: Rgb[]; luma: number[]; keep: number[]; bare?: Bare; bareTone?: Rgb; dots?: number }
/** A bralette on the figure: the top's triangles (u v x y z for each corner, rest pose in metres) and where the
 *  cups and band sit. Every texel of the top outside them is bare skin. */
export type Bare = { tris: Float32Array; bust: number[]; underY: number; waistY: number }
/** Inside the bralette: the band under the bust all the way round, or either cup (an ellipse over each bust point). */
export function inBra(b: Pick<Bare, 'bust' | 'underY'>, x: number, y: number, z: number): boolean {
  if (y > b.underY - 0.012 && y < b.underY + 0.024) return true
  for (let k = 0; k + 2 < b.bust.length; k += 3) {
    if (z < b.bust[k + 2]! - 0.075) continue
    const dx = (x - b.bust[k]!) / 0.082, dy = (y - (b.bust[k + 1]! + 0.004)) / 0.066
    if (dx * dx + dy * dy < 1) return true
  }
  return false
}
export type Makeup = { lip?: number | null; blush?: number | null; shadow?: number | null; liner?: boolean }

export const toLin = new Float32Array(256)
for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const toSrgb = new Uint8Array(2049)
for (let i = 0; i <= 2048; i++) { const c = i / 2048; toSrgb[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)) }
/** Roll highlights off instead of clipping them flat. */
const soft = (x: number) => (x < 0.6 ? x : 0.6 + 0.4 * (1 - Math.exp(-(x - 0.6) / 0.4)))
const out8 = (x: number) => toSrgb[Math.min(2048, Math.max(0, Math.round(x * 2048)))]!
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
/** An sRGB hex colour, linear (what THREE.Color.setHex gives). */
export const hexLin = (hex: number): Rgb => [toLin[(hex >> 16) & 255]!, toLin[(hex >> 8) & 255]!, toLin[hex & 255]!]

/** Which texels of a w x h texture are bare skin under a bralette: each top triangle is filled in texture space and
 *  every texel's own point on the body is tested against the cups and band, so the edges are smooth curves. */
export function rasterise(bare: Bare, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h), T = bare.tris
  for (let t = 0; t + 14 < T.length; t += 15) {
    const ax = T[t]! * w, ay = T[t + 1]! * h, bx = T[t + 5]! * w, by = T[t + 6]! * h, cx = T[t + 10]! * w, cy = T[t + 11]! * h
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if (Math.abs(d) < 1e-9) continue
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)))
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)))
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d, l3 = 1 - l1 - l2
        // A small margin so neighbouring triangles leave no seam between them.
        if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue
        const X = T[t + 2]! * l1 + T[t + 7]! * l2 + T[t + 12]! * l3, Y = T[t + 3]! * l1 + T[t + 8]! * l2 + T[t + 13]! * l3, Z = T[t + 4]! * l1 + T[t + 9]! * l2 + T[t + 14]! * l3
        // 1 bare skin, 2 the bralette (the top's own cloth), 3 below the waist: the top hangs over the skirt
        // there, so it is cut as part of the skirt (a high-waisted mini).
        const code = Y < bare.waistY ? 3 : inBra(bare, X, Y, Z) ? 2 : 1
        if (out[y * w + x] === 0 || code > 1) out[y * w + x] = code
      }
    }
  }
  return out
}

/** Shift every masked pixel to its region's colour, in place. The mask's red picks the region, green its weight. */
export function recolour(data: Uint8ClampedArray, mask: Uint8ClampedArray, w: number, h: number, c: Colours): void {
  const { target, mean, luma, keep } = c
  const n = w * h
  const bare = c.bare?.tris.length && c.bareTone ? rasterise(c.bare, w, h) : null, tone = c.bareTone
  // The beaded weave: a grid of round beads in texture space (scaled with the texture, so crowd and player match).
  const cell = c.dots ? Math.max(2, (c.dots * w) / 1024) : 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    let id = Math.round(mask[o]! / 40)
    const wt = mask[o + 1]! / 255
    if (bare && id === 3 && bare[i] === 3) id = 4
    const tg = target[id]
    if (!tg || wt <= 0) continue
    const r = toLin[data[o]!]!, g = toLin[data[o + 1]!]!, b = toLin[data[o + 2]!]!
    let nr: number, ng: number, nb: number
    if (bare && tone && id === 3 && bare[i] === 1) {
      // Bare skin where the bralette leaves it: the skin tone, with only a little of the cloth's folds as shading.
      const rel = (0.2126 * r + 0.7152 * g + 0.0722 * b) / luma[3]!
      const sh = clamp(1 + (rel - 1) * 0.1, 0.9, 1.08)
      data[o] = out8(tone[0] * sh); data[o + 1] = out8(tone[1] * sh); data[o + 2] = out8(tone[2] * sh)
      continue
    }
    if (id === 1) {
      // Skin: scale every channel so the average lands on the target; lips, shadows and freckles follow.
      // The creator's tones are flat swatches; a lit, textured face reads lighter, so aim a little under them.
      const a = mean[1]!
      nr = soft(r * (tg[0] * 0.74 / a[0])); ng = soft(g * (tg[1] * 0.74 / a[1])); nb = soft(b * (tg[2] * 0.74 / a[2]))
    } else {
      const rel = (0.2126 * r + 0.7152 * g + 0.0722 * b) / luma[id]!
      const shade = clamp(1 + (rel - 1) * keep[id]!, 0.22, 1.9)
      nr = tg[0] * shade; ng = tg[1] * shade; nb = tg[2] * shade
      if (cell && (id === 3 || id === 4)) {
        // Inside a bead: lit dome with a bright crown; between beads: the darker net they are sewn to.
        const x = i % w, y = (i / w) | 0
        const row = Math.floor(y / cell), off = row & 1 ? cell / 2 : 0
        const fx = ((x + off) % cell) / cell - 0.5, fy = (y % cell) / cell - 0.5
        const d2 = (fx * fx + fy * fy) * 4
        const k = d2 < 1 ? 0.78 + 0.55 * (1 - d2) * (1 - d2) : 0.58
        nr *= k; ng *= k; nb *= k
      }
    }
    data[o] = out8(r + (nr - r) * wt); data[o + 1] = out8(g + (ng - g) * wt); data[o + 2] = out8(b + (nb - b) * wt)
  }
  void h
}

/** Resample to w x h. Smooth = box average (the picture); otherwise the nearest pixel (the mask, so ids stay exact). */
export function shrink(src: Uint8ClampedArray, sw: number, sh: number, w: number, h: number, smooth: boolean): Uint8ClampedArray<ArrayBuffer> {
  const d = new Uint8ClampedArray(w * h * 4), fx = sw / w, fy = sh / h
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy), y1 = smooth ? Math.max(y0 + 1, Math.min(sh, Math.floor((y + 1) * fy))) : y0 + 1
    const yc = Math.min(sh - 1, Math.floor((y + 0.5) * fy))
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (!smooth) { const i = (yc * sw + Math.min(sw - 1, Math.floor((x + 0.5) * fx))) * 4; d[o] = src[i]!; d[o + 1] = src[i + 1]!; d[o + 2] = src[i + 2]!; d[o + 3] = src[i + 3]!; continue }
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.min(sw, Math.floor((x + 1) * fx)))
      let r = 0, g = 0, b = 0, a = 0, k = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * sw + xx) * 4; r += src[i]!; g += src[i + 1]!; b += src[i + 2]!; a += src[i + 3]!; k++ }
      d[o] = r / k; d[o + 1] = g / k; d[o + 2] = b / k; d[o + 3] = a / k
    }
  }
  return d
}

/** Twice the size, each new pixel a bilinear blend of its four nearest (pixel centres kept aligned). */
export function double(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const W = w * 2, H = h * 2, d = new Uint8ClampedArray(W * H * 4)
  for (let Y = 0; Y < H; Y++) {
    // Output centre (Y + 0.5) / 2 - 0.5 in source pixels: rows alternate a quarter above and below a source row.
    const sy = (Y - 0.5) / 2, y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(h - 1, y0 + 1), fy = clamp(sy - y0, 0, 1)
    for (let X = 0; X < W; X++) {
      const sx = (X - 0.5) / 2, x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(w - 1, x0 + 1), fx = clamp(sx - x0, 0, 1)
      const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, e = (y1 * w + x1) * 4, o = (Y * W + X) * 4
      const wa = (1 - fx) * (1 - fy), wb = fx * (1 - fy), wc = (1 - fx) * fy, we = fx * fy
      for (let ch = 0; ch < 4; ch++) d[o + ch] = src[a + ch]! * wa + src[b + ch]! * wb + src[c + ch]! * wc + src[e + ch]! * we
    }
  }
  return d
}

// Where the face sits in every figure's atlas (tools/pack-rocketbox.mjs packs the head at x 512..1024, y 0..512
// of a 1024x640 sheet, and the Rocketbox heads share one layout). Atlas pixels at 1024 wide.
const FACE = { lips: [770, 205, 32, 12], cheeks: [[710, 183], [830, 183]], eyes: [[740, 146], [800, 146]] } as const
export const hasMakeup = (m?: Makeup) => !!m && (m.lip != null || m.blush != null || m.shadow != null || !!m.liner)
/** Paint makeup into RGBA data (sRGB bytes) of a w x h atlas: soft-edged, keeping the skin's own shading. */
export function paintMakeup(data: Uint8ClampedArray, w: number, h: number, m: Makeup): void {
  const sx = w / 1024, sy = h / 640
  const blend = (x0: number, y0: number, rx: number, ry: number, hex: number, amt: number, mode: 'tint' | 'shade', gate?: (r: number, g: number, b: number) => number) => {
    const [tr, tg, tb] = hexLin(hex), tl = 0.2126 * tr + 0.7152 * tg + 0.0722 * tb
    const cx = x0 * sx, cy = y0 * sy, ax = rx * sx, ay = ry * sy
    for (let y = Math.max(0, Math.floor(cy - ay)); y <= Math.min(h - 1, Math.ceil(cy + ay)); y++) {
      for (let x = Math.max(0, Math.floor(cx - ax)); x <= Math.min(w - 1, Math.ceil(cx + ax)); x++) {
        const d = ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2
        if (d >= 1) continue
        const o = (y * w + x) * 4
        const r = toLin[data[o]!]!, g = toLin[data[o + 1]!]!, b = toLin[data[o + 2]!]!
        const e = 1 - d
        let k = amt * e * e * (3 - 2 * e) // smooth falloff to the edge
        if (gate) k *= gate(r, g, b)
        if (k <= 0) continue
        const l = Math.max(0.002, 0.2126 * r + 0.7152 * g + 0.0722 * b)
        // tint: the colour carried by the skin's own light and shade; shade: a darker wash (liner, shadow).
        const s = mode === 'tint' ? clamp(l / Math.max(0.02, tl) * 0.8, 0.25, 1.2) : 1
        const nr = mode === 'tint' ? tr * s : tr, ng = mode === 'tint' ? tg * s : tg, nb = mode === 'tint' ? tb * s : tb
        data[o] = out8(r + (nr - r) * k); data[o + 1] = out8(g + (ng - g) * k); data[o + 2] = out8(b + (nb - b) * k)
      }
    }
  }
  // Lips: only where the skin is already lip-red, so the colour follows the real lip shape.
  if (m.lip != null) { const [x, y, rx, ry] = FACE.lips; blend(x, y, rx, ry, m.lip, 0.85, 'tint', (r, g) => clamp((r / Math.max(g, 0.004) - 1.35) / 0.5, 0, 1)) }
  if (m.blush != null) for (const [x, y] of FACE.cheeks) blend(x, y, 24, 17, m.blush, 0.3, 'tint')
  if (m.shadow != null) for (const [x, y] of FACE.eyes) blend(x, y - 9, 20, 8, m.shadow, 0.5, 'tint')
  if (m.liner) for (const [x, y] of FACE.eyes) blend(x, y - 4, 17, 2.6, 0x120c0a, 0.75, 'shade')
}
/** Unsharp mask over the face (eyes, brows, nose and lips: x 600..960, y 60..330 of the 1024 x 640 atlas). */
export function sharpenFace(data: Uint8ClampedArray, w: number, h: number, amount: number): void {
  const sx = w / 1024, sy = h / 640
  const x0 = Math.floor(600 * sx), x1 = Math.min(w - 1, Math.ceil(960 * sx)), y0 = Math.max(1, Math.floor(60 * sy)), y1 = Math.min(h - 1, Math.ceil(330 * sy))
  // Only the face rows are copied (the blur reads one row either side).
  const rowB = w * 4, from = (y0 - 1) * rowB, src = data.slice(from, (y1 + 1) * rowB)
  for (let y = y0; y < y1; y++) {
    for (let x = x0 + 1; x < x1; x++) {
      const o = (y * w + x) * 4
      for (let ch = 0; ch < 3; ch++) {
        const i = o + ch, j = i - from
        const blur = (src[j - 4]! + src[j + 4]! + src[j - rowB]! + src[j + rowB]! + 4 * src[j]! + src[j - rowB - 4]! + src[j - rowB + 4]! + src[j + rowB - 4]! + src[j + rowB + 4]!) / 12
        data[i] = src[j]! + (src[j]! - blur) * amount
      }
    }
  }
}

/** A whole look: recoloured, then (the player's own figure) doubled with the face sharpened, then makeup. */
export function dressPixels(base: Uint8ClampedArray, mask: Uint8ClampedArray, w: number, h: number, c: Colours, opts: { sharp?: boolean; makeup?: Makeup }): { data: Uint8ClampedArray<ArrayBuffer>; w: number; h: number } {
  let data: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(base)
  recolour(data, mask, w, h, c)
  if (opts.sharp) {
    data = double(data, w, h); w *= 2; h *= 2
    if (hasMakeup(opts.makeup)) paintMakeup(data, w, h, opts.makeup!)
    sharpenFace(data, w, h, 0.6)
  } else if (hasMakeup(opts.makeup)) paintMakeup(data, w, h, opts.makeup!)
  return { data, w, h }
}
