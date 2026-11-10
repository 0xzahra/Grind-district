// Packs the CC0 Poly Haven surface sets used on floors and walls: 512 px colour and normal maps, 256 px
// roughness, WebP.   SRC=/path/to/1k-jpgs node tools/pack-surfaces.mjs
import sharp from 'sharp'
import fs from 'node:fs'
const SRC = (process.env.SRC ?? '').replace(/\/?$/, '/')
const OUT = 'public/tex/surf/'
// [source, output, size, quality, gain]: scanned floors are almost flat, so their relief (normal maps) and sheen
// variation (roughness) are strengthened here; otherwise the detail would not survive compression at all.
const jobs = [
  ['wood_floor_diff_1k.jpg', 'wood_d.webp', 512, 80], ['wood_floor_nor_gl_1k.jpg', 'wood_n.webp', 512, 84, 6], ['wood_floor_rough_1k.jpg', 'wood_r.webp', 256, 80, 3.5],
  ['marble_01_diff_1k.jpg', 'stone_d.webp', 512, 80], ['marble_01_nor_gl_1k.jpg', 'stone_n.webp', 256, 84, 5], ['marble_01_rough_1k.jpg', 'stone_r.webp', 256, 80, 3],
  ['plastered_wall_04_nor_gl_1k.jpg', 'plaster_n.webp', 512, 82, 5],
  ['fabric_pattern_07_nor_gl_1k.jpg', 'fabric_n.webp', 256, 80],
  ['rubber_tiles_nor_gl_1k.jpg', 'rubber_n.webp', 256, 82],
  ['concrete_pavers_nor_gl_1k.jpg', 'pavers_n.webp', 512, 80],
]
let total = 0
for (const [src, out, size, q, gain] of jobs) {
  let img = sharp(SRC + src).resize(size, size, { kernel: 'lanczos3' })
  if (gain) {
    const { channels } = await sharp(SRC + src).stats()
    img = /_n\./.test(out) ? img.linear([gain, gain, 1], [channels[0].mean * (1 - gain), channels[1].mean * (1 - gain), 0]) : img.linear(gain, channels[0].mean * (1 - gain))
  }
  await img.webp({ quality: q, effort: 6 }).toFile(OUT + out)
  const n = fs.statSync(OUT + out).size; total += n
  console.log(out.padEnd(16), (n / 1024).toFixed(0), 'KB')
}
console.log('total', (total / 1024).toFixed(0), 'KB')
