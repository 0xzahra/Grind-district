// Poly Haven CC0 PBR textures -> 512 px WebP; HDRI -> 512x256 flat RGBE (~0.5 MB).
import sharp from 'sharp'
import fs from 'fs'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import * as THREE from 'three'
const A = process.env.SRC ?? '/workspace/gd/assets/'
for (const f of fs.readdirSync(A).filter((f) => f.endsWith('.jpg'))) {
  await sharp(A + f).resize(512, 512).webp({ quality: f.includes('nor') ? 88 : 80 }).toFile('public/tex/' + f.replace('.jpg', '.webp'))
}
const buf = fs.readFileSync(A + 'sky.hdr')
const loader = new HDRLoader(); loader.setDataType(THREE.FloatType)
const d = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length))
const W = 512, H = 256, sx = d.width / W, sy = d.height / H
const out = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const c = [0, 0, 0]
  for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) { const k = ((y * sy + j) * d.width + (x * sx + i)) * 4; for (let n = 0; n < 3; n++) c[n] += d.data[k + n] }
  for (let n = 0; n < 3; n++) c[n] /= sx * sy
  const m = Math.max(...c); const o = (y * W + x) * 4
  if (m < 1e-32) continue
  const e = Math.ceil(Math.log2(m)); const s = 256 / 2 ** e
  out[o] = Math.min(255, c[0] * s); out[o + 1] = Math.min(255, c[1] * s); out[o + 2] = Math.min(255, c[2] * s); out[o + 3] = e + 128
}
fs.writeFileSync('public/tex/sky.hdr', Buffer.concat([Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`), out]))
