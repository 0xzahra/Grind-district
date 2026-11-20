// Gentle portrait retouch for every figure's face, baked into its texture once (no cost in the game).
//   node tools/beautify-faces.mjs            -> retouch every figure that is not yet retouched
//   node tools/beautify-faces.mjs --preview  -> write before/after face crops to tools/.beauty/ and change nothing
// What it does, inside the face only (the mask's skin region on the head):
//   - clearer skin: an edge-preserving smooth (guided filter) evens pores and blotches but keeps eyes, brows, lips;
//   - calmer redness, brighter under-eyes, soft light on cheekbones, the bridge of the nose, forehead and chin;
//   - women: defined brows, a fine lash line, soft lip colour chosen for the skin tone with a touch of gloss, a hint
//     of blush and contour; men: groomed brows and the same clear skin;
//   - clear eyes: the whites cleaned of their red cast, the iris a little richer.
// The face keeps its own average brightness and colour: every skin tone stays exactly as deep as it was.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'node:fs'

const DIR = 'public/models/figures/r2/'
const PREVIEW = process.argv.includes('--preview')
const W = 1024, H = 640
const FEMALE = new Set(['woman1', 'woman2', 'woman3', 'woman4', 'abaya', 'look_gown', 'look_party', 'look_pencil', 'look_skirtsuit'])
const FIGURES = ['man1', 'man2', 'man3', 'man4', 'kurta', 'look_navy', 'look_thobe', 'look_tux', ...FEMALE]

await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Box mean of a float plane over a (2r+1)^2 window (integral image). */
function boxMean(src, w, h, r) {
  const I = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += src[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row } }
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r)
      const s = I[(y1 + 1) * (w + 1) + x1 + 1] - I[y0 * (w + 1) + x1 + 1] - I[(y1 + 1) * (w + 1) + x0] + I[y0 * (w + 1) + x0]
      out[y * w + x] = s / ((x1 - x0 + 1) * (y1 - y0 + 1))
    }
  }
  return out
}
/** Guided filter (He et al.) of channel p with guide I. */
function guided(I, p, w, h, r, eps) {
  const mI = boxMean(I, w, h, r), mp = boxMean(p, w, h, r)
  const Ip = new Float32Array(w * h), II = new Float32Array(w * h)
  for (let k = 0; k < w * h; k++) { Ip[k] = I[k] * p[k]; II[k] = I[k] * I[k] }
  const mIp = boxMean(Ip, w, h, r), mII = boxMean(II, w, h, r)
  const a = new Float32Array(w * h), b = new Float32Array(w * h)
  for (let k = 0; k < w * h; k++) { const v = mII[k] - mI[k] * mI[k]; a[k] = (mIp[k] - mI[k] * mp[k]) / (v + eps); b[k] = mp[k] - a[k] * mI[k] }
  const ma = boxMean(a, w, h, r), mb = boxMean(b, w, h, r)
  const q = new Float32Array(w * h)
  for (let k = 0; k < w * h; k++) q[k] = ma[k] * I[k] + mb[k]
  return q
}

/** Centroid and extent of the darkest blob (an eye socket) in a window, relative to the window's skin. */
function findEye(R, G, B, skin, cx, cy) {
  const pts = []
  const ref = []
  for (let y = cy - 18; y <= cy + 18; y++) for (let x = cx - 28; x <= cx + 28; x++) if (skin[y * W + x]) ref.push(lum(R[y * W + x], G[y * W + x], B[y * W + x]))
  ref.sort((a, b) => a - b)
  const med = ref[Math.floor(ref.length * 0.6)] ?? 0.5
  for (let y = cy - 14; y <= cy + 14; y++) for (let x = cx - 24; x <= cx + 24; x++) {
    const k = y * W + x
    if (lum(R[k], G[k], B[k]) < med * 0.55) pts.push([x, y])
  }
  if (pts.length < 20) return { x: cx, y: cy, rx: 14, ry: 6 }
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const xs = pts.map((p) => p[0]).sort((a, b) => a - b), ys = pts.map((p) => p[1]).sort((a, b) => a - b)
  const q = (arr, f) => arr[Math.floor(arr.length * f)]
  return { x: mx, y: my, rx: Math.max(10, (q(xs, 0.97) - q(xs, 0.03)) / 2), ry: Math.max(4, (q(ys, 0.97) - q(ys, 0.03)) / 2) }
}

/** Retouch RGBA bytes in place. Returns the eye/lip landmarks for the preview. */
function retouch(px, mask, female) {
  const N = W * H
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N)
  for (let k = 0; k < N; k++) { R[k] = px[k * 4] / 255; G[k] = px[k * 4 + 1] / 255; B[k] = px[k * 4 + 2] / 255 }
  // The face: skin region on the head sheet (x 512.., y ..512), with its weight; feathered at the edge.
  const skin = new Uint8Array(N)
  for (let y = 0; y < 512; y++) for (let x = 512; x < W; x++) { const k = y * W + x; if (Math.round(mask[k * 3] / 40) === 1 && mask[k * 3 + 1] > 150) skin[k] = 1 }
  const face = new Float32Array(N)
  { const f = boxMean(Float32Array.from(skin), W, H, 3); for (let k = 0; k < N; k++) face[k] = skin[k] ? clamp((f[k] - 0.35) / 0.5, 0, 1) : 0 }
  // Landmarks.
  const eL = findEye(R, G, B, skin, 740, 146), eR = findEye(R, G, B, skin, 800, 146)
  const ey = (eL.y + eR.y) / 2, nx = (eL.x + eR.x) / 2, span = eR.x - eL.x
  let lx = nx, ly = ey + 0.98 * span
  { // Lip centre: the reddest patch below the nose.
    let best = -1
    for (let y = Math.round(ey + span * 0.75); y <= Math.round(ey + span * 1.2); y++) for (let x = Math.round(nx - 12); x <= Math.round(nx + 12); x++) {
      const k = y * W + x, red = R[k] / Math.max(0.01, G[k])
      if (red > best) { best = red; lx = x; ly = y }
    }
    lx = nx // lips are centred under the nose
  }
  const S = span / 60 // landmark scale (60 px between the eyes on the shared layout)
  const blob = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) / 2)

  const before = { mean: [0, 0, 0], n: 0 }
  for (let k = 0; k < N; k++) if (face[k] > 0.5) { before.mean[0] += R[k]; before.mean[1] += G[k]; before.mean[2] += B[k]; before.n++ }

  // 1. Clear skin: guided filter on each channel, guided by luminance; stronger for women, lighter for men.
  const L = new Float32Array(N); for (let k = 0; k < N; k++) L[k] = lum(R[k], G[k], B[k])
  const gr = guided(L, R, W, H, 5, 0.0016), gg = guided(L, G, W, H, 5, 0.0016), gb = guided(L, B, W, H, 5, 0.0016)
  const smooth = female ? 0.82 : 0.55
  // Keep the eyes, brows and lips crisp: less smoothing on their landmarks.
  const keep = (x, y) => Math.max(blob(x, y, eL.x, eL.y, eL.rx * 1.3, eL.ry * 2.2), blob(x, y, eR.x, eR.y, eR.rx * 1.3, eR.ry * 2.2), 0.7 * blob(x, y, lx, ly, 22 * S, 8 * S))
  // Local mean colour (for evening redness and under-eye shadows).
  const mR = boxMean(R, W, H, 9), mG = boxMean(G, W, H, 9), mB = boxMean(B, W, H, 9)
  for (let y = 0; y < 512; y++) for (let x = 512; x < W; x++) {
    const k = y * W + x, f = face[k]
    if (f <= 0) continue
    const s = smooth * f * (1 - 0.75 * keep(x, y))
    let r = R[k] + (gr[k] - R[k]) * s, g = G[k] + (gg[k] - G[k]) * s, b = B[k] + (gb[k] - B[k]) * s
    // 2. Calm blotchy redness (not on the lips): pull towards the local mean where redder than it.
    const lip = blob(x, y, lx, ly, 26 * S, 9 * S)
    const redX = (r - (g + b) / 2) - (mR[k] - (mG[k] + mB[k]) / 2)
    if (redX > 0.015) { const t = clamp((redX - 0.015) / 0.05, 0, 1) * 0.5 * f * (1 - lip); r += (mR[k] - r) * t; g += (mG[k] - g) * t * 0.6; b += (mB[k] - b) * t * 0.6 }
    // 3. Light and shape (multiplicative, small): under-eyes, cheekbones, nose bridge, forehead, chin, soft contour.
    let lift = 0
    for (const e of [eL, eR]) {
      const ue = blob(x, y, e.x, e.y + e.ry + 6 * S, e.rx * 0.9, 4.5 * S)
      lift += (female ? 0.09 : 0.06) * ue
      // Under-eye shadows also take on the cheek's colour, not grey or purple.
      if (ue > 0.05) { const t = ue * 0.35 * f; r += (mR[k] * 1.04 - r) * t; g += (mG[k] * 1.04 - g) * t; b += (mB[k] * 1.04 - b) * t }
      const side = e === eL ? -1 : 1
      lift += (female ? 0.07 : 0.045) * blob(x, y, e.x + side * 6 * S, e.y + 30 * S, 15 * S, 7 * S)
      if (female) lift -= 0.05 * blob(x, y, e.x + side * 15 * S, e.y + 50 * S, 13 * S, 5 * S)
    }
    lift += 0.07 * blob(x, y, nx, ey + 16 * S, 3.6 * S, 15 * S)
    lift += 0.035 * blob(x, y, nx, ey - 42 * S, 22 * S, 11 * S)
    lift += 0.045 * blob(x, y, lx, ly + 30 * S, 10 * S, 6 * S)
    const m = 1 + lift * f
    r *= m; g *= m; b *= m
    if (female) {
      // 4. Brows: deepen the brow hairs (darker than the skin round them), shaping the arch.
      for (const e of [eL, eR]) {
        const band = blob(x, y, e.x + (e === eL ? -2 : 2) * S, e.y - 17 * S, 22 * S, 6 * S)
        if (band > 0.08) {
          const l = lum(r, g, b), ref = lum(mR[k], mG[k], mB[k])
          const gate = clamp((ref * 0.93 - l) / (ref * 0.22), 0, 1)
          const d = 1 - 0.4 * gate * band
          r *= d; g *= d; b *= d
        }
      }
      // 5. Lash line: a fine dark line hugging the top of each socket, flicking up at the outer corner.
      for (const e of [eL, eR]) {
        const dx = (x - e.x) / (e.rx + 1.5), dy = (y - e.y) / (e.ry + 1.5)
        const d = Math.sqrt(dx * dx + dy * dy)
        const outer = e === eL ? -1 : 1
        if (y <= e.y + 1 && d > 0.8 && d < 1.45) {
          const t = (1 - Math.abs(d - 1.1) / 0.35) * clamp((e.y + 1 - y) / (e.ry * 0.6), 0, 1)
          const wing = clamp((outer * (x - e.x)) / e.rx, 0, 1)
          const k2 = clamp(t, 0, 1) * (0.8 + 0.15 * wing)
          r *= 1 - k2 * 0.72; g *= 1 - k2 * 0.74; b *= 1 - k2 * 0.72
        }
        // A warm wash of shadow on the lid, deepest at the outer corner.
        const lid = blob(x, y, e.x + outer * e.rx * 0.25, e.y - e.ry - 3.5 * S, e.rx * 1.05, 4.2 * S) * f
        if (lid > 0.04 && y < e.y) { const t = 0.2 * lid; r *= 1 - t * 0.55; g *= 1 - t * 0.85; b *= 1 - t * 0.95 }
        // The flick: past the outer corner, a short stroke rising outwards.
        const fx = outer * (x - (e.x + outer * e.rx)), fy = (e.y - e.ry * 0.2) - y
        if (fx > 0 && fx < 5 * S && Math.abs(fy - fx * 0.45) < 1.1) { const k2 = 0.45 * (1 - fx / (5 * S)); r *= 1 - k2; g *= 1 - k2; b *= 1 - k2 }
      }
      // 6. Lips: soft colour chosen for the skin tone, only where the lip is already lip-red, and a touch of gloss.
      if (lip > 0.05) {
        const tone = lum(before.mean[0] / Math.max(1, before.n), before.mean[1] / Math.max(1, before.n), before.mean[2] / Math.max(1, before.n))
        const [tr, tg, tb] = tone > 0.55 ? [0.78, 0.36, 0.42] : tone > 0.4 ? [0.7, 0.3, 0.33] : [0.52, 0.2, 0.26]
        const red = r / Math.max(0.01, g)
        const gate = clamp((red - 1.18) / 0.35, 0, 1) * lip
        if (gate > 0) {
          const l = lum(r, g, b), tl = lum(tr, tg, tb), sc = clamp(l / tl, 0.35, 1.25)
          const amt = 0.6 * gate
          r += (tr * sc - r) * amt; g += (tg * sc - g) * amt; b += (tb * sc - b) * amt
          const gloss = 0.16 * blob(x, y, lx, ly + 3.5 * S, 7 * S, 2 * S) * gate
          r += (1 - r) * gloss; g += (1 - g) * gloss; b += (1 - b) * gloss
        }
      }
      // 7. A whisper of blush on the apples of the cheeks.
      for (const e of [eL, eR]) {
        const bl = 0.16 * blob(x, y, e.x + (e === eL ? -4 : 4) * S, e.y + 36 * S, 14 * S, 9 * S) * f
        r += (r * 1.12 - r) * bl; g += (g * 0.94 - g) * bl; b += (b * 0.98 - b) * bl
      }
    } else {
      // Men: groomed brows, a little deeper.
      for (const e of [eL, eR]) {
        const band = blob(x, y, e.x, e.y - 17 * S, 22 * S, 6 * S)
        if (band > 0.08) { const l = lum(r, g, b), ref = lum(mR[k], mG[k], mB[k]); const gate = clamp((ref * 0.93 - l) / (ref * 0.22), 0, 1); const d = 1 - 0.18 * gate * band; r *= d; g *= d; b *= d }
      }
    }
    R[k] = r; G[k] = g; B[k] = b
  }
  // 8. Same skin depth as before: scale the face back to its original average colour.
  const after = [0, 0, 0]; let n = 0
  for (let k = 0; k < N; k++) if (face[k] > 0.5) { after[0] += R[k]; after[1] += G[k]; after[2] += B[k]; n++ }
  const fix = [0, 1, 2].map((c) => before.mean[c] / Math.max(1e-6, after[c]))
  for (let k = 0; k < N; k++) if (face[k] > 0) { const f = face[k]; R[k] *= 1 + (fix[0] - 1) * f; G[k] *= 1 + (fix[1] - 1) * f; B[k] *= 1 + (fix[2] - 1) * f }
  // 9. Clear eyes: on the eyeball sheet (x 600..700, y 430..520) take the red cast out of the whites.
  for (let y = 430; y < 520; y++) for (let x = 600; x < 700; x++) {
    const k = y * W + x, l = lum(R[k], G[k], B[k])
    const cast = R[k] - (G[k] + B[k]) / 2
    if (l > 0.3 && cast > 0.03) { const t = clamp((l - 0.3) / 0.25, 0, 1) * 0.7; const wv = Math.min(1, l * 1.08); R[k] += (wv - R[k]) * t; G[k] += (wv * 0.985 - G[k]) * t; B[k] += (wv * 0.975 - B[k]) * t }
  }
  for (let k = 0; k < N; k++) { px[k * 4] = Math.round(clamp(R[k], 0, 1) * 255); px[k * 4 + 1] = Math.round(clamp(G[k], 0, 1) * 255); px[k * 4 + 2] = Math.round(clamp(B[k], 0, 1) * 255) }
  return { eL, eR, lips: [lx, ly] }
}

/** Skin mean (linear, weighted the way the packer does it) for the game's colour matching. */
function skinMean(px, mask) {
  let r = 0, g = 0, b = 0, n = 0
  for (let k = 0; k < W * H; k++) if (Math.round(mask[k * 3] / 40) === 1 && mask[k * 3 + 1] / 255 > 0.6) { r += toLin(px[k * 4] / 255); g += toLin(px[k * 4 + 1] / 255); b += toLin(px[k * 4 + 2] / 255); n++ }
  return n > 200 ? [r / n, g / n, b / n].map((x) => +x.toFixed(4)) : null
}

const previews = []
for (const name of FIGURES) {
  const path = `${DIR}${name}.glb`
  const doc = await io.read(path)
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const extras = scene.getExtras() ?? {}
  if (extras.beauty && !PREVIEW) { console.log(`${name}: already retouched`); continue }
  const tex = doc.getRoot().listTextures()[0]
  const { data } = await sharp(tex.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const mask = (await sharp(`${DIR}${name}.mask.png`).removeAlpha().raw().toBuffer())
  const px = new Uint8ClampedArray(data)
  const crop = async (buf) => sharp(Buffer.from(buf), { raw: { width: W, height: H, channels: 4 } }).extract({ left: 640, top: 70, width: 260, height: 200 }).resize(390, 300).removeAlpha().png().toBuffer()
  const was = await crop(px)
  const marks = retouch(px, mask, FEMALE.has(name))
  if (PREVIEW) {
    previews.push({ name, was, now: await crop(px) })
    console.log(name, JSON.stringify({ eL: [marks.eL.x.toFixed(1), marks.eL.y.toFixed(1), marks.eL.rx.toFixed(1), marks.eL.ry.toFixed(1)], eR: [marks.eR.x.toFixed(1), marks.eR.y.toFixed(1)], lips: marks.lips }))
    continue
  }
  tex.setImage(await sharp(Buffer.from(px), { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toBuffer())
  const regions = { ...(extras.regions ?? {}) }
  const sm = skinMean(px, mask)
  if (sm && regions.skin) regions.skin = sm
  scene.setExtras({ ...extras, regions, beauty: 1 })
  const size0 = fs.statSync(path).size
  await io.write(path, doc)
  console.log(`${name}: retouched  ${(size0 / 1024).toFixed(0)} -> ${(fs.statSync(path).size / 1024).toFixed(0)} KB  skin ${JSON.stringify(sm)}`)
}
if (PREVIEW && previews.length) {
  fs.mkdirSync('tools/.beauty', { recursive: true })
  const cols = 4, tw = 390 * 2 + 10, th = 300 + 10
  const rows = Math.ceil(previews.length / cols)
  await sharp({ create: { width: tw * cols, height: th * rows, channels: 3, background: '#111' } })
    .composite(previews.flatMap((p, i) => [{ input: p.was, left: (i % cols) * tw, top: Math.floor(i / cols) * th }, { input: p.now, left: (i % cols) * tw + 390, top: Math.floor(i / cols) * th }]))
    .jpeg({ quality: 88 }).toFile('tools/.beauty/before-after.jpg')
  console.log('preview: tools/.beauty/before-after.jpg')
}
