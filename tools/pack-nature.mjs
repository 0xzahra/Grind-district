// Packs the foliage and ground textures (Poly Haven, CC0).
//   leaves.webp  two dense leaf clumps (512 x 512 each, side by side, with alpha) composed from single
//                photographed leaves, used on the cards that make up a tree crown or a hedge
//   bark.webp    tiling bark
//   asphalt.webp, grass.webp, brick.webp   tiling ground and wall detail (512 px)
//   SRC=/path/to/downloads node tools/pack-nature.mjs
import sharp from 'sharp'
import fs from 'node:fs'
const SRC = (process.env.SRC ?? '').replace(/\/?$/, '/')
const OUT = 'public/tex/nature/'
fs.mkdirSync(OUT, { recursive: true })

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296 }

// ---- single leaves out of the atlas (connected alpha regions) ----
const atlas = await sharp(SRC + 'island_tree_02_leaves_diff_1k.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: AW, height: AH } = atlas.info
const seen = new Uint8Array(AW * AH)
const boxes = []
for (let s = 0; s < AW * AH; s++) {
  if (seen[s] || atlas.data[s * 4 + 3] < 40) continue
  let x0 = AW, y0 = AH, x1 = 0, y1 = 0, n = 0
  const stack = [s]; seen[s] = 1
  while (stack.length) {
    const k = stack.pop(); n++
    const x = k % AW, y = (k / AW) | 0
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    for (const d of [-1, 1, -AW, AW]) { const j = k + d; if (j < 0 || j >= AW * AH || seen[j] || atlas.data[j * 4 + 3] < 40) continue; if ((d === -1 && x === 0) || (d === 1 && x === AW - 1)) continue; seen[j] = 1; stack.push(j) }
  }
  if (n > 4000) boxes.push({ x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
}
const leaves = await Promise.all(boxes.map((b) => sharp(atlas.data, { raw: { width: AW, height: AH, channels: 4 } }).extract({ left: b.x0, top: b.y0, width: b.w, height: b.h }).png().toBuffer()))
console.log('leaves found', leaves.length)

// ---- clumps: leaves along twigs radiating from the clump's heart, back layers darker ----
const S = 512
async function clump(seed, twigs, perTwig, reach) {
  const r = rng(seed)
  const layers = []
  for (let layer = 0; layer < 3; layer++) {
    for (let t = 0; t < twigs; t++) {
      const a0 = (t / twigs) * Math.PI * 2 + r() * 0.5, bend = (r() - 0.5) * 0.9
      for (let i = 0; i < perTwig; i++) {
        const u = (i + r() * 0.8) / perTwig
        const a = a0 + bend * u
        const d = (0.08 + 0.92 * u) * reach * S * 0.5 * (0.85 + r() * 0.2)
        const cx = S / 2 + Math.cos(a) * d + (r() - 0.5) * 26, cy = S / 2 + Math.sin(a) * d + (r() - 0.5) * 26
        // Leaves fan off the twig, alternating sides, tips outward.
        const dir = a + (i % 2 ? 1 : -1) * (0.5 + r() * 0.5)
        const len = Math.round(46 + r() * 26)
        const buf = await sharp(leaves[Math.floor(r() * leaves.length)])
          .resize({ height: len })
          .modulate({ brightness: 0.62 + layer * 0.19 + r() * 0.1, saturation: 1.0 + r() * 0.25, hue: Math.round(10 + r() * 16) })
          .rotate((dir * 180) / Math.PI + 90, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toBuffer({ resolveWithObject: true })
        const left = Math.round(cx - buf.info.width / 2), top = Math.round(cy - buf.info.height / 2)
        if (left < 0 || top < 0 || left + buf.info.width > S || top + buf.info.height > S) continue
        layers.push({ input: buf.data, left, top })
      }
    }
  }
  return sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).raw().toBuffer()
}
const a = await clump(3, 9, 9, 0.86), b = await clump(8, 7, 8, 0.8)
const out = Buffer.alloc(S * 2 * S * 4)
for (let y = 0; y < S; y++) { a.copy(out, y * S * 2 * 4, y * S * 4, (y + 1) * S * 4); b.copy(out, (y * S * 2 + S) * 4, y * S * 4, (y + 1) * S * 4) }
// Empty texels take the average leaf green, so filtering and mipmaps never pull a dark fringe in at the edges.
let R = 0, G = 0, B = 0, N = 0
for (let k = 0; k < out.length; k += 4) if (out[k + 3] > 200) { R += out[k]; G += out[k + 1]; B += out[k + 2]; N++ }
R = Math.round(R / N); G = Math.round(G / N); B = Math.round(B / N)
for (let k = 0; k < out.length; k += 4) if (out[k + 3] < 8) { out[k] = R; out[k + 1] = G; out[k + 2] = B; out[k + 3] = 0 }
await sharp(out, { raw: { width: S * 2, height: S, channels: 4 } }).webp({ quality: 80, alphaQuality: 85, effort: 6, exact: true }).toFile(OUT + 'leaves.webp')
await sharp(SRC + 'tree_small_02_diff_1k.jpg').resize(256, 256).modulate({ brightness: 1.15 }).webp({ quality: 78 }).toFile(OUT + 'bark.webp')
// Ground and wall detail. The game multiplies these over its own painted colours, so each one's average is
// printed here (linear RGB) and copied into src/groundDetail.ts: detail / average keeps brightness unchanged.
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
for (const [src, out, size] of [['asphalt_02_diff_1k.jpg', 'asphalt.webp', 512], ['leafy_grass_diff_1k.jpg', 'grass.webp', 512], ['red_brick_03_diff_1k.jpg', 'brick.webp', 512]]) {
  const file = (process.env.TEX ?? SRC) .replace(/\/?$/, '/') + src
  if (!fs.existsSync(file)) { console.log('missing', file); continue }
  await sharp(file).resize(size, size, { kernel: 'lanczos3' }).webp({ quality: 78, effort: 6 }).toFile(OUT + out)
  const st = await sharp(file).resize(64, 64).raw().toBuffer()
  let r = 0, g = 0, b = 0
  for (let k = 0; k < st.length; k += 3) { r += lin(st[k]); g += lin(st[k + 1]); b += lin(st[k + 2]) }
  const n = st.length / 3
  console.log(out.padEnd(14), (fs.statSync(OUT + out).size / 1024).toFixed(0), 'KB  mean', [r / n, g / n, b / n].map((x) => x.toFixed(3)).join(', '))
}
{
  const st = await sharp('public/tex/surf/stone_d.webp').resize(64, 64).removeAlpha().raw().toBuffer()
  let r = 0, g = 0, b = 0
  for (let k = 0; k < st.length; k += 3) { r += lin(st[k]); g += lin(st[k + 1]); b += lin(st[k + 2]) }
  const n = st.length / 3
  console.log('stone_d.webp   mean', [r / n, g / n, b / n].map((x) => x.toFixed(3)).join(', '))
}
for (const f of ['leaves.webp', 'bark.webp']) console.log(f.padEnd(14), (fs.statSync(OUT + f).size / 1024).toFixed(0), 'KB')
console.log('coverage', ((N / (S * 2 * S)) * 100).toFixed(0) + '%', 'mean', R, G, B)
