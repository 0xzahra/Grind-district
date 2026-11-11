// Packs people from the Microsoft Rocketbox Avatar Library (MIT, github.com/microsoft/Microsoft-Rocketbox)
// for the web. Each figure becomes ONE skinned mesh with ONE texture atlas (one draw call on phones):
//   - the facial and finger bones are folded into the head and hands (81 bones -> 23),
//   - the mesh is welded and simplified,
//   - body, head and hair textures are packed into a 1024x640 atlas (WebP),
//   - a region mask (skin / hair / top / bottom / shoes) is baked so the game's outfit colours still apply.
// The motion-capture clips (idle, walk, run, sit, talk ...) are packed once per gender and shared by name.
//
//   SRC=/path/to/Microsoft-Rocketbox/Assets node tools/pack-rocketbox.mjs [name ...] [--debug dir]
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import { prune, dedup, resample, quantize, meshopt, reorder } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(_v) {}, style: {} }) }
globalThis.window = globalThis
const warn = console.warn; console.warn = (...a) => { if (!/FBXLoader|THREE\./.test(String(a[0]))) warn(...a) }

const SRC = (process.env.SRC ?? '').replace(/\/?$/, '/')
const OUT = process.env.OUT ?? 'public/models/people/'
const args = process.argv.slice(2)
const dbgAt = args.indexOf('--debug')
const DEBUG = dbgAt >= 0 ? args[dbgAt + 1] : null
const only = args.filter((a, i) => !a.startsWith('--') && i !== dbgAt + 1)

/**
 * The cast. `head`: 'hair' when the hair can be recoloured, 'none' when the head is covered or the hair must
 * keep its own colour (headwear and beards keep their texture). `legs`: trousers ('bottom') or a robe or dress
 * that follows the top colour ('top'). `bare`: zones where skin may show (arm, leg, torso). `sandals`: bare feet show.
 * `boots`: footwear reaches up the calf under a dress.
 */
const CAST = {
  man1: { src: 'Adults/Male_Adult_08', sex: 'm', head: 'hair', legs: 'bottom', bare: ['arm'] },
  man2: { src: 'Adults/Male_Adult_12', sex: 'm', head: 'hair', legs: 'bottom', bare: [] },
  man3: { src: 'Adults/Male_Adult_04', sex: 'm', head: 'hair', legs: 'bottom', bare: [] },
  man4: { src: 'Professions/Business_Male_05', sex: 'm', head: 'hair', legs: 'bottom', bare: [] },
  kurta: { src: 'Adults/Male_Adult_15', sex: 'm', head: 'none', legs: 'top', bare: [], sandals: true },
  woman1: { src: 'Professions/Business_Female_01', sex: 'f', head: 'hair', legs: 'bottom', bare: [] },
  woman2: { src: 'Adults/Female_Adult_06', sex: 'f', head: 'none', legs: 'top', bare: [] },
  woman3: { src: 'Adults/Female_Adult_01', sex: 'f', head: 'hair', legs: 'bottom', bare: ['arm'] },
  woman4: { src: 'Adults/Female_Adult_11', sex: 'f', head: 'hair', legs: 'top', bare: ['leg', 'torso'], boots: true },
  abaya: { src: 'Adults/Female_Adult_10', sex: 'f', head: 'none', legs: 'top', bare: [], sandals: true },
}
const CLIPS = {
  Idle: ['static', 'idle_neutral_01', { fps: 12, max: 11.6 }],
  Walk: ['xy', 'walk_neutral_01', { fps: 30, inPlace: true }],
  Jog: ['xy', 'run_neutral_01', { fps: 30, inPlace: true }],
  Run: ['xy', 'run_fast_01', { fps: 30, inPlace: true }],
  Talk: ['static', 'gestic_talk_neutral_01', { fps: 15, max: 12 }],
}

const KEEP = ['Bip01', 'Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head',
  ...['L', 'R'].flatMap((s) => [`Bip01_${s}_Clavicle`, `Bip01_${s}_UpperArm`, `Bip01_${s}_Forearm`, `Bip01_${s}_Hand`, `Bip01_${s}_Thigh`, `Bip01_${s}_Calf`, `Bip01_${s}_Foot`, `Bip01_${s}_Toe0`])]
const CM = 0.01
const AW = 1024, AH = 640
const RECT = { body: [0, 0, 512, 512], head: [512, 0, 512, 512], hair: [0, 512, 256, 128] }
const ZONE = { face: 1, scalp: 2, neck: 3, torso: 4, hip: 5, arm: 6, hand: 7, leg: 8, foot: 9, lash: 10 }
const REGION = { skin: 1, hair: 2, top: 3, bottom: 4, shoes: 5 }

const loadFbx = (file) => { const b = fs.readFileSync(file); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '') }

function readTGA(file) {
  const b = fs.readFileSync(file)
  const idLen = b[0], type = b[2], w = b.readUInt16LE(12), h = b.readUInt16LE(14), bpp = b[16], desc = b[17]
  const n = bpp >> 3
  let o = 18 + idLen
  const out = Buffer.alloc(w * h * 4)
  const put = (i, p) => { const k = i * 4; if (n === 1) { out[k] = out[k + 1] = out[k + 2] = b[p]; out[k + 3] = 255 } else { out[k] = b[p + 2]; out[k + 1] = b[p + 1]; out[k + 2] = b[p]; out[k + 3] = n === 4 ? b[p + 3] : 255 } }
  if (type === 2 || type === 3) for (let i = 0; i < w * h; i++, o += n) put(i, o)
  else if (type === 10 || type === 11) {
    for (let i = 0; i < w * h;) {
      const c = b[o++], len = (c & 127) + 1
      if (c & 128) { for (let k = 0; k < len; k++) put(i++, o); o += n } else for (let k = 0; k < len; k++, o += n) put(i++, o)
    }
  } else throw new Error(`TGA type ${type} not handled: ${file}`)
  if (!(desc & 0x20)) { // bottom-left origin: flip rows
    const row = w * 4, tmp = Buffer.alloc(row)
    for (let y = 0; y < h >> 1; y++) { const a = y * row, c = (h - 1 - y) * row; out.copy(tmp, 0, a, a + row); out.copy(out, a, c, c + row); tmp.copy(out, c) }
  }
  return { w, h, data: out, alpha: n === 4 }
}

// sRGB <-> linear and Lab (D65)
const toLin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
function lab(r, g, b) {
  const R = toLin[r], G = toLin[g], B = toLin[b]
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047), y = f(R * 0.2126 + G * 0.7152 + B * 0.0722), z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
const median = (a) => { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[s.length >> 1] }

async function packPerson(name, cfg) {
  const dir = SRC + 'Avatars/' + cfg.src + '/'
  const base = path.basename(cfg.src)
  const root = loadFbx(`${dir}Export/${base}.fbx`)
  root.updateMatrixWorld(true)
  let mesh = null
  root.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o })
  const geo = mesh.geometry
  const P = geo.getAttribute('position'), N = geo.getAttribute('normal'), UV = geo.getAttribute('uv'), SI = geo.getAttribute('skinIndex'), SW = geo.getAttribute('skinWeight')
  const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => (/opacity/i.test(m.name) ? 'hair' : /head/i.test(m.name) ? 'head' : 'body'))
  const vmat = new Uint8Array(P.count)
  for (const g of geo.groups) for (let i = g.start; i < g.start + g.count; i++) vmat[i] = g.materialIndex
  // Bones: fold everything that is not kept into its nearest kept ancestor.
  const bones = mesh.skeleton.bones
  const keepIndex = new Map(KEEP.map((n, i) => [n, i]))
  const zoneOf = (bn) => {
    const n = bn.name
    if (/Eye|Lash|Blink/i.test(n) && !keepIndex.has(n)) return ZONE.lash
    if (!keepIndex.has(n)) { let p = bn; while (p && !keepIndex.has(p.name)) p = p.parent; return p?.name === 'Bip01_Head' ? ZONE.face : /Hand/.test(p?.name ?? '') ? ZONE.hand : ZONE.hip }
    if (n === 'Bip01_Head') return ZONE.scalp
    if (n === 'Bip01_Neck') return ZONE.neck
    if (/Spine1|Spine2|Clavicle/.test(n)) return ZONE.torso
    if (/UpperArm|Forearm/.test(n)) return ZONE.arm
    if (/Hand/.test(n)) return ZONE.hand
    if (/Thigh|Calf/.test(n)) return ZONE.leg
    if (/Foot|Toe/.test(n)) return ZONE.foot
    return ZONE.hip
  }
  const boneKeep = bones.map((b) => { let p = b; while (p && !keepIndex.has(p.name)) p = p.parent; return p ? keepIndex.get(p.name) : 0 })
  const boneZone = bones.map(zoneOf)
  // Vertices in the world rest pose (bind == rest in this library), metres.
  const count = P.count
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), jo = new Uint8Array(count * 4), we = new Float32Array(count * 4)
  const vzone = new Float32Array(count * 11)
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld).multiplyScalar(CM); pos.set([v.x, v.y, v.z], i * 3)
    v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], i * 3)
    const rect = RECT[mats[vmat[i]]]
    let u = UV.getX(i), t = UV.getY(i); u -= Math.floor(u) === 1 && u === 1 ? 0 : Math.floor(u); t -= Math.floor(t) === 1 && t === 1 ? 0 : Math.floor(t)
    uv[i * 2] = (rect[0] + u * rect[2]) / AW
    uv[i * 2 + 1] = (rect[1] + (1 - t) * rect[3]) / AH
    const acc = new Map()
    for (let k = 0; k < 4; k++) {
      const w = SW.getComponent(i, k); if (w <= 0) continue
      const b = SI.getComponent(i, k)
      acc.set(boneKeep[b], (acc.get(boneKeep[b]) ?? 0) + w)
      vzone[i * 11 + boneZone[b]] += w
    }
    const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    const sum = top.reduce((s, e) => s + e[1], 0) || 1
    top.forEach(([j, w], k) => { jo[i * 4 + k] = j; we[i * 4 + k] = w / sum })
  }
  // ---- textures: atlas ----
  const texDir = dir + 'Textures/'
  const find = (kind) => fs.readdirSync(texDir).find((f) => new RegExp(`_${kind}_color\\.tga$`, 'i').test(f))
  const atlas = Buffer.alloc(AW * AH * 4)
  for (let i = 3; i < atlas.length; i += 4) atlas[i] = 255
  const place = async (kind, rect) => {
    const f = find(kind === 'hair' ? 'opacity' : kind); if (!f) return false
    const t = readTGA(texDir + f)
    const small = await sharp(t.data, { raw: { width: t.w, height: t.h, channels: 4 } }).resize(rect[2], rect[3], { kernel: 'lanczos3', fit: 'fill' }).raw().toBuffer()
    for (let y = 0; y < rect[3]; y++) small.copy(atlas, ((rect[1] + y) * AW + rect[0]) * 4, y * rect[2] * 4, (y + 1) * rect[2] * 4)
    return true
  }
  await place('body', RECT.body); await place('head', RECT.head)
  const hasHair = await place('hair', RECT.hair)
  // ---- mask: rasterise the full-detail triangles into atlas space ----
  const NP = AW * AH
  const zone = new Uint8Array(NP), px3 = new Float32Array(NP), hgt = new Float32Array(NP), pz3 = new Float32Array(NP), tmat = new Uint8Array(NP)
  const MAT = { body: 0, head: 1, hair: 2 }
  for (let t = 0; t < count; t += 3) {
    const ax = uv[t * 2] * AW, ay = uv[t * 2 + 1] * AH, bx = uv[t * 2 + 2] * AW, by = uv[t * 2 + 3] * AH, cx = uv[t * 2 + 4] * AW, cy = uv[t * 2 + 5] * AH
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (Math.abs(area) < 1e-9) continue
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 1)), x1 = Math.min(AW - 1, Math.ceil(Math.max(ax, bx, cx) + 1))
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 1)), y1 = Math.min(AH - 1, Math.ceil(Math.max(ay, by, cy) + 1))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5
      const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area, w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area, w2 = 1 - w0 - w1
      const e = -0.6 / Math.sqrt(Math.abs(area) + 1) // a little conservative so thin triangles still mark their texels
      if (w0 < e || w1 < e || w2 < e) continue
      const k = y * AW + x
      if (zone[k] && (w0 < 0 || w1 < 0 || w2 < 0)) continue
      let best = 0, bw = -1
      for (let z = 1; z < 11; z++) { const s = w0 * vzone[t * 11 + z] + w1 * vzone[(t + 1) * 11 + z] + w2 * vzone[(t + 2) * 11 + z]; if (s > bw) { bw = s; best = z } }
      zone[k] = best
      px3[k] = w0 * pos[t * 3] + w1 * pos[(t + 1) * 3] + w2 * pos[(t + 2) * 3]
      hgt[k] = w0 * pos[t * 3 + 1] + w1 * pos[(t + 1) * 3 + 1] + w2 * pos[(t + 2) * 3 + 1]
      pz3[k] = w0 * pos[t * 3 + 2] + w1 * pos[(t + 1) * 3 + 2] + w2 * pos[(t + 2) * 3 + 2]
      tmat[k] = MAT[mats[vmat[t]]]
    }
  }
  // UV islands (connected covered texels): cuffs follow the sleeve or trouser they are drawn on, and the
  // mouth, teeth and eyes (their own islands) never count as hair or skin.
  const island = new Int32Array(NP).fill(-1)
  const stats = []
  {
    const stack = new Int32Array(NP)
    for (let s = 0; s < NP; s++) {
      if (!zone[s] || island[s] >= 0) continue
      const id = stats.length, z = new Uint32Array(11), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]
      let n = 0, top = 0
      stack[top++] = s; island[s] = id
      while (top) {
        const k = stack[--top]; n++; z[zone[k]]++
        lo[0] = Math.min(lo[0], px3[k]); lo[1] = Math.min(lo[1], hgt[k]); lo[2] = Math.min(lo[2], pz3[k]); hi[0] = Math.max(hi[0], px3[k]); hi[1] = Math.max(hi[1], hgt[k]); hi[2] = Math.max(hi[2], pz3[k])
        const x = k % AW
        for (const d of [-1, 1, -AW, AW]) { const j = k + d; if (j < 0 || j >= NP || (d === -1 && x === 0) || (d === 1 && x === AW - 1)) continue; if (zone[j] && island[j] < 0 && tmat[j] === tmat[k]) { island[j] = id; stack[top++] = j } }
      }
      stats.push({ n, z, lo, hi })
    }
  }
  const L = new Float32Array(NP), A = new Float32Array(NP), B = new Float32Array(NP)
  for (let k = 0; k < NP; k++) { const c = lab(atlas[k * 4], atlas[k * 4 + 1], atlas[k * 4 + 2]); L[k] = c[0]; A[k] = c[1]; B[k] = c[2] }
  const ref = (pick) => { const l = [], a = [], b = []; for (let k = 0; k < NP; k++) if (zone[k] && pick(k)) { l.push(L[k]); a.push(A[k]); b.push(B[k]) } return l.length > 40 ? [median(l), median(a), median(b), l.length] : null }
  const dist = (k, r, wl = 0.45) => (r ? Math.hypot((L[k] - r[0]) * wl, A[k] - r[1], B[k] - r[2]) : 1e9)
  const isHead = (k) => tmat[k] === MAT.head, isCard = (k) => tmat[k] === MAT.hair
  // The face window, from the texels the facial bones move: brow line, chin line and where the ears sit.
  let browY = -1e9, chinY = 1e9, zSum = 0, zN = 0, mainHead = -1
  { const per = new Map(); for (let k = 0; k < NP; k++) if (zone[k] === ZONE.face && isHead(k)) per.set(island[k], (per.get(island[k]) ?? 0) + 1); let best = 0; for (const [id, n] of per) if (n > best) { best = n; mainHead = id } }
  // On the head itself the eyelid and eyebrow bones move skin like any other part of the face; only the lash
  // cards and the eyeballs (their own islands) are left alone.
  for (let k = 0; k < NP; k++) if (island[k] === mainHead && zone[k] === ZONE.lash) zone[k] = ZONE.face
  for (let k = 0; k < NP; k++) if (island[k] === mainHead) { if (zone[k] === ZONE.face) { browY = Math.max(browY, hgt[k]); chinY = Math.min(chinY, hgt[k]) } zSum += pz3[k]; zN++ }
  const earZ = zSum / Math.max(1, zN)
  const skinRef = ref((k) => zone[k] === ZONE.face && island[k] === mainHead && hgt[k] > chinY + (browY - chinY) * 0.5 && hgt[k] < browY - (browY - chinY) * 0.12)
  const hairRef = ref((k) => (isCard(k) && zone[k] !== ZONE.lash) || (island[k] === mainHead && zone[k] === ZONE.scalp && hgt[k] > browY + 0.03))
  const far = (k, m = 16) => dist(k, skinRef) > m
  const topRef = ref((k) => zone[k] === ZONE.torso && tmat[k] === MAT.body && far(k)) ?? ref((k) => zone[k] === ZONE.torso && tmat[k] === MAT.body)
  const legRef = ref((k) => zone[k] === ZONE.leg && far(k)) ?? ref((k) => zone[k] === ZONE.leg)
  const footIsland = (k) => { const z = stats[island[k]].z; return z[ZONE.foot] > 0.25 * (z[ZONE.leg] + z[ZONE.foot]) }
  const shoeRef = ref((k) => zone[k] === ZONE.foot && footIsland(k) && (cfg.sandals ? far(k) : true)) ?? legRef
  const bare = new Set(cfg.bare ?? [])
  const headTex = cfg.headTex ?? cfg.head
  const region = new Uint8Array(NP), weight = new Uint8Array(NP)
  const skinW = (k) => { const d = dist(k, skinRef, 0.3); return d < 9 ? 1 : d > 20 ? 0 : 1 - (d - 9) / 11 }
  const near = (k, a, b, margin = 1) => dist(k, a) * margin < dist(k, b)
  const SKIN = (k, floor = 0) => { region[k] = REGION.skin; weight[k] = Math.round(Math.max(floor, skinW(k)) * 255) }
  const SET = (k, r) => { region[k] = r; weight[k] = r ? 255 : 0 }
  // Loose pieces drawn on the head texture: a ponytail or fringe counts as hair; teeth, tongue and eyes do not.
  let cx = 0; { let n = 0; for (let k = 0; k < NP; k++) if (island[k] === mainHead && zone[k] === ZONE.face) { cx += px3[k]; n++ } cx /= Math.max(1, n) }
  const loose = stats.map((st, id) => {
    if (id === mainHead) return false
    const inMouth = st.hi[1] < browY && st.lo[1] > chinY - 0.02 && st.lo[0] > cx - 0.045 && st.hi[0] < cx + 0.045 && st.lo[2] > earZ - 0.02
    return !inMouth && st.z[ZONE.face] + st.z[ZONE.lash] < st.n * 0.5
  })
  for (let k = 0; k < NP; k++) {
    let z = zone[k]; if (!z) continue
    const sw = skinW(k)
    if (z === ZONE.lash) continue
    if (isCard(k)) { SET(k, (cfg.cards ?? cfg.head) === 'hair' ? REGION.hair : (cfg.cards ?? cfg.head) === 'top' ? REGION.top : 0); continue }
    const st = stats[island[k]].z
    if (isHead(k)) {
      if (island[k] !== mainHead) { if (headTex === 'hair' && loose[island[k]] && hairRef && near(k, hairRef, skinRef, 1)) SET(k, REGION.hair); continue }
      // The whole face moves together when the skin tone changes: lids, lips, brows and stubble keep their own
      // relative tone (a pale ring round the eyes or a light beard on dark skin reads as a mask otherwise).
      const inFace = z === ZONE.face || (hgt[k] < browY + 0.012 && hgt[k] > chinY - 0.035 && pz3[k] > earZ + 0.012)
      if (inFace) { SKIN(k, 1); continue }
      const hairy = hgt[k] > browY - 0.012 || pz3[k] < earZ
      if (headTex === 'hair') { if (hairy && hairRef && near(k, hairRef, skinRef, 1.15)) SET(k, REGION.hair); else SKIN(k, 1) }
      else if (sw > 0.25) SKIN(k, 1)
      else SET(k, headTex === 'top' ? REGION.top : 0)
      continue
    }
    const upper = st[ZONE.torso] + st[ZONE.arm] + st[ZONE.neck] + st[ZONE.scalp], lower = st[ZONE.leg]
    if (z === ZONE.foot && st[ZONE.foot] <= 0.25 * (st[ZONE.leg] + st[ZONE.foot])) z = ZONE.leg // trouser cuff
    if (z === ZONE.hand && upper > st[ZONE.hand] * 3 && sw < 0.5) z = ZONE.arm // sleeve cuff
    if (z === ZONE.scalp || z === ZONE.neck) { if (cfg.head !== 'top' && sw > 0.5 && near(k, skinRef, topRef, 1.5)) SKIN(k, 1); else SET(k, REGION.top) }
    else if (z === ZONE.hand) SKIN(k, 1)
    else if (z === ZONE.torso || z === ZONE.arm) { if (bare.has(z === ZONE.arm ? 'arm' : 'torso') && sw > 0.5 && near(k, skinRef, topRef, 1.6)) SKIN(k, 1); else SET(k, REGION.top) }
    else if (z === ZONE.hip) SET(k, cfg.legs === 'top' || upper > lower ? REGION.top : REGION.bottom)
    else if (z === ZONE.leg) {
      if (st[ZONE.foot] > 0.25 * (st[ZONE.leg] + st[ZONE.foot])) SET(k, REGION.shoes) // a boot's shaft
      else if (bare.has('leg') && sw > 0.5 && near(k, skinRef, cfg.legs === 'top' ? topRef : legRef, 1.4)) SKIN(k, 1)
      else SET(k, cfg.boots && lower > upper ? REGION.shoes : upper > lower || cfg.legs === 'top' ? REGION.top : REGION.bottom)
    } else if (z === ZONE.foot) { if (cfg.sandals && sw > 0.4) SKIN(k, 1); else SET(k, REGION.shoes) }
  }
  // Region means (linear RGB, weighted) so the game can shift each region to a target colour.
  const means = {}
  for (const [key, id] of Object.entries(REGION)) {
    let r = 0, g = 0, b = 0, n = 0
    for (let k = 0; k < NP; k++) if (region[k] === id) { const w = id === REGION.skin ? (skinW(k) > 0.6 ? 1 : 0) : weight[k] / 255; r += toLin[atlas[k * 4]] * w; g += toLin[atlas[k * 4 + 1]] * w; b += toLin[atlas[k * 4 + 2]] * w; n += w }
    if (n > 200) means[key] = [r / n, g / n, b / n].map((x) => +x.toFixed(4))
  }
  // Spread region ids a few texels past the islands so filtering at the seams picks the right region.
  for (let pass = 0; pass < 4; pass++) {
    const r2 = region.slice(), w2 = weight.slice(), z2 = zone.slice()
    for (let y = 1; y < AH - 1; y++) for (let x = 1; x < AW - 1; x++) {
      const k = y * AW + x; if (zone[k]) continue
      for (const d of [-1, 1, -AW, AW]) if (zone[k + d]) { r2[k] = region[k + d]; w2[k] = weight[k + d]; z2[k] = zone[k + d]; break }
    }
    region.set(r2); weight.set(w2); zone.set(z2)
  }
  const mask = Buffer.alloc(AW * AH * 3)
  for (let k = 0; k < AW * AH; k++) { mask[k * 3] = region[k] * 40; mask[k * 3 + 1] = weight[k] }
  // ---- weld + simplify ----
  const key = new Map(), remap = new Uint32Array(count), q = (x, s) => Math.round(x * s)
  let unique = 0
  for (let i = 0; i < count; i++) {
    const h = `${q(pos[i * 3], 1e5)},${q(pos[i * 3 + 1], 1e5)},${q(pos[i * 3 + 2], 1e5)}|${q(nor[i * 3], 50)},${q(nor[i * 3 + 1], 50)},${q(nor[i * 3 + 2], 50)}|${q(uv[i * 2], 4096)},${q(uv[i * 2 + 1], 4096)}|${mats[vmat[i]] === 'hair' ? 1 : 0}`
    let id = key.get(h); if (id === undefined) { id = unique++; key.set(h, id) }
    remap[i] = id
  }
  const wp = new Float32Array(unique * 3), wn = new Float32Array(unique * 3), wu = new Float32Array(unique * 2), wj = new Uint8Array(unique * 4), ww = new Float32Array(unique * 4), whair = new Uint8Array(unique)
  for (let i = count - 1; i >= 0; i--) { const d = remap[i]; wp.set(pos.subarray(i * 3, i * 3 + 3), d * 3); wn.set(nor.subarray(i * 3, i * 3 + 3), d * 3); wu.set(uv.subarray(i * 2, i * 2 + 2), d * 2); wj.set(jo.subarray(i * 4, i * 4 + 4), d * 4); ww.set(we.subarray(i * 4, i * 4 + 4), d * 4); whair[d] = mats[vmat[i]] === 'hair' ? 1 : 0 }
  const solid = [], cards = []
  for (let t = 0; t < count; t += 3) { const a = remap[t], b = remap[t + 1], c = remap[t + 2]; if (a === b || b === c || a === c) continue; (whair[a] ? cards : solid).push(a, b, c) }
  await MeshoptSimplifier.ready
  const attr = new Float32Array(unique * 5)
  for (let i = 0; i < unique; i++) attr.set([wn[i * 3], wn[i * 3 + 1], wn[i * 3 + 2], wu[i * 2], wu[i * 2 + 1]], i * 5)
  const target = Math.floor((solid.length / 3) * (cfg.ratio ?? 0.52)) * 3
  const [simp, err] = MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(solid), wp, 3, attr, 5, [0.4, 0.4, 0.4, 1.2, 1.2], null, target, 0.02)
  const index = Uint32Array.from([...simp, ...cards])
  const [cremap, kept] = MeshoptSimplifier.compactMesh(index)
  const fp = new Float32Array(kept * 3), fn = new Float32Array(kept * 3), fu = new Float32Array(kept * 2), fj = new Uint8Array(kept * 4), fw = new Float32Array(kept * 4)
  for (let i = 0; i < unique; i++) { const d = cremap[i]; if (d === 0xffffffff) continue; fp.set(wp.subarray(i * 3, i * 3 + 3), d * 3); fn.set(wn.subarray(i * 3, i * 3 + 3), d * 3); fu.set(wu.subarray(i * 2, i * 2 + 2), d * 2); fj.set(wj.subarray(i * 4, i * 4 + 4), d * 4); fw.set(ww.subarray(i * 4, i * 4 + 4), d * 4) }
  // ---- document ----
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene(name)
  const nodes = [], inv = new Float32Array(KEEP.length * 16)
  const world = KEEP.map((n) => { const b = root.getObjectByName(n); const m = b.matrixWorld.clone(); m.elements[12] *= CM; m.elements[13] *= CM; m.elements[14] *= CM; return m })
  KEEP.forEach((n, i) => {
    const b = root.getObjectByName(n)
    const pi = keepIndex.get(b.parent?.name)
    const local = pi === undefined ? world[i].clone() : world[pi].clone().invert().multiply(world[i])
    const t = new THREE.Vector3(), r = new THREE.Quaternion(), s = new THREE.Vector3(); local.decompose(t, r, s)
    const node = doc.createNode(n).setTranslation(t.toArray()).setRotation(r.toArray())
    nodes.push(node)
    if (pi === undefined) scene.addChild(node); else nodes[pi].addChild(node)
    inv.set(world[i].clone().invert().elements, i * 16)
  })
  const skin = doc.createSkin('rig').setSkeleton(nodes[0]).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(inv).setBuffer(buffer))
  for (const n of nodes) skin.addJoint(n)
  const tex = doc.createTexture('atlas').setMimeType('image/webp').setImage(await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toBuffer())
  doc.createExtension(EXTTextureWebP).setRequired(true)
  const material = doc.createMaterial('person').setBaseColorTexture(tex).setRoughnessFactor(0.78).setMetallicFactor(0).setDoubleSided(hasHair).setAlphaMode(hasHair ? 'MASK' : 'OPAQUE').setAlphaCutoff(0.45)
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer)
  const prim = doc.createPrimitive().setMaterial(material).setIndices(acc('SCALAR', kept > 65535 ? index : Uint16Array.from(index)))
    .setAttribute('POSITION', acc('VEC3', fp)).setAttribute('NORMAL', acc('VEC3', fn)).setAttribute('TEXCOORD_0', acc('VEC2', fu)).setAttribute('JOINTS_0', acc('VEC4', fj)).setAttribute('WEIGHTS_0', acc('VEC4', fw))
  const body = doc.createNode('Person').setMesh(doc.createMesh('Person').addPrimitive(prim)).setSkin(skin)
  scene.addChild(body)
  let minY = 1e9, maxY = -1e9
  for (let i = 0; i < kept; i++) { minY = Math.min(minY, fp[i * 3 + 1]); maxY = Math.max(maxY, fp[i * 3 + 1]) }
  // Anchors for glasses, caps and necklaces, relative to the head bone in the rest pose (metres, world axes).
  const at = (n) => { const b = root.getObjectByName(n); return b ? new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).multiplyScalar(CM) : null }
  const headAt = at("Bip01_Head"), eyeL = at("Bip01_LEye"), eyeR = at("Bip01_REye")
  let crown = -1e9, front = -1e9
  for (let i = 0; i < kept; i++) if (fj[i * 4] === keepIndex.get('Bip01_Head') && fw[i * 4] > 0.6) { crown = Math.max(crown, fp[i * 3 + 1]); if (Math.abs(fp[i * 3 + 1] - (eyeL?.y ?? headAt.y + 0.09)) < 0.02) front = Math.max(front, fp[i * 3 + 2]) }
  const eye = eyeL && eyeR ? [+(((eyeL.x + eyeR.x) / 2) - headAt.x).toFixed(4), +(((eyeL.y + eyeR.y) / 2) - headAt.y).toFixed(4), +(front - headAt.z).toFixed(4), +(Math.abs(eyeL.x - eyeR.x)).toFixed(4)] : null
  scene.setExtras({ source: `Microsoft Rocketbox ${base} (MIT)`, sex: cfg.sex, height: +(maxY - minY).toFixed(4), hip: +world[0].elements[13].toFixed(4), regions: means, eye, crown: +(crown - headAt.y).toFixed(4) })
  await doc.transform(prune(), dedup(), reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  await io.write(`${OUT}${name}.glb`, doc)
  await sharp(mask, { raw: { width: AW, height: AH, channels: 3 } }).png({ compressionLevel: 9, palette: false }).toFile(`${OUT}${name}.mask.png`)
  if (DEBUG) {
    fs.mkdirSync(DEBUG, { recursive: true })
    const tint = [[40, 40, 40], [255, 170, 130], [150, 90, 40], [60, 140, 255], [60, 200, 120], [220, 60, 200]]
    const dbg = Buffer.alloc(AW * AH * 3)
    for (let k = 0; k < AW * AH; k++) { const c = tint[region[k]], w = region[k] ? 0.35 + 0.65 * (weight[k] / 255) : 1; for (let i = 0; i < 3; i++) dbg[k * 3 + i] = Math.round(atlas[k * 4 + i] * 0.35 + c[i] * 0.65 * w) }
    await sharp(dbg, { raw: { width: AW, height: AH, channels: 3 } }).jpeg({ quality: 82 }).toFile(`${DEBUG}/${name}-mask.jpg`)
    await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).flatten({ background: '#ff00ff' }).jpeg({ quality: 82 }).toFile(`${DEBUG}/${name}-atlas.jpg`)
  }
  const size = fs.statSync(`${OUT}${name}.glb`).size, msize = fs.statSync(`${OUT}${name}.mask.png`).size
  console.log(`${name.padEnd(7)} ${base.padEnd(20)} tris ${count / 3} -> ${index.length / 3} (err ${err.toFixed(4)})  verts ${kept}  glb ${(size / 1024).toFixed(0)} KB  mask ${(msize / 1024).toFixed(0)} KB  h ${(maxY - minY).toFixed(2)} m  regions ${Object.keys(means).join(',')}`)
}

async function packClips(sex) {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene(`motion-${sex}`)
  let nodes = null
  const info = {}
  for (const [clipName, [folder, file, o]] of Object.entries(CLIPS)) {
    const f = `${SRC}Animations/all_animations_max_motextr_${folder}/${sex}_${file}.max.fbx`
    if (!fs.existsSync(f)) { console.log('  missing', f); continue }
    const root = loadFbx(f)
    root.updateMatrixWorld(true)
    const clip = root.animations[0]
    if (!nodes) {
      // The skeleton only carries names here: every bone's rotation is keyed, and each figure keeps its own bone lengths.
      nodes = KEEP.map((n) => doc.createNode(n))
      KEEP.forEach((n, i) => { const b = root.getObjectByName(n); const pi = KEEP.indexOf(b.parent?.name); nodes[i].setRotation(b.quaternion.toArray()).setTranslation(b.position.clone().multiplyScalar(CM).toArray()); if (pi < 0) scene.addChild(nodes[i]); else nodes[pi].addChild(nodes[i]) })
      info.hip = +(root.getObjectByName('Bip01').position.y * CM).toFixed(4)
    }
    const dur = Math.min(clip.duration, o.max ?? 1e9)
    const frames = Math.max(2, Math.round(dur * o.fps) + 1)
    const times = new Float32Array(frames); for (let i = 0; i < frames; i++) times[i] = (i / (frames - 1)) * dur
    const sample = (track, t, out) => { const itp = track.createInterpolant(); const r = itp.evaluate(t); for (let k = 0; k < out.length; k++) out[k] = r[k] }
    const anim = doc.createAnimation(clipName)
    const input = doc.createAccessor().setType('SCALAR').setArray(times).setBuffer(buffer)
    const track = (n, kind) => clip.tracks.find((t) => t.name === `${n}.${kind}`)
    let travel = 0
    KEEP.forEach((n, i) => {
      const tq = track(n, 'quaternion'); if (!tq) return
      const vals = new Float32Array(frames * 4), tmp = new Float32Array(4)
      for (let k = 0; k < frames; k++) { sample(tq, times[k], tmp); if (k && tmp[0] * vals[k * 4 - 4] + tmp[1] * vals[k * 4 - 3] + tmp[2] * vals[k * 4 - 2] + tmp[3] * vals[k * 4 - 1] < 0) for (let c = 0; c < 4; c++) tmp[c] = -tmp[c]; vals.set(tmp, k * 4) }
      const s = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType('VEC4').setArray(vals).setBuffer(buffer)).setInterpolation('LINEAR')
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes[i]).setTargetPath('rotation').setSampler(s))
    })
    const tp = track('Bip01', 'position')
    if (tp) {
      const vals = new Float32Array(frames * 3), tmp = new Float32Array(3), first = new Float32Array(3), last = new Float32Array(3)
      sample(tp, 0, first); sample(tp, dur, last)
      travel = Math.hypot(last[0] - first[0], last[2] - first[2]) * CM
      for (let k = 0; k < frames; k++) {
        sample(tp, times[k], tmp)
        const u = times[k] / dur
        // In place: take out the steady travel (and any drift), keep the bob and sway. Seated/standing clips keep their height only.
        const x = o.inPlace ? tmp[0] - (first[0] + (last[0] - first[0]) * u) : tmp[0] - first[0]
        const z = o.inPlace ? tmp[2] - (first[2] + (last[2] - first[2]) * u) : tmp[2] - first[2]
        vals.set([x * CM, tmp[1] * CM, z * CM], k * 3)
      }
      const s = doc.createAnimationSampler().setInput(input).setOutput(doc.createAccessor().setType('VEC3').setArray(vals).setBuffer(buffer)).setInterpolation('LINEAR')
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(nodes[0]).setTargetPath('translation').setSampler(s))
    }
    info[clipName] = { duration: +dur.toFixed(3), speed: o.inPlace ? +(travel / dur).toFixed(3) : 0 }
  }
  scene.setExtras(info)
  await doc.transform(resample({ tolerance: 0.0006 }), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  await io.write(`${OUT}motion-${sex}.glb`, doc)
  console.log(`motion-${sex}  ${(fs.statSync(`${OUT}motion-${sex}.glb`).size / 1024).toFixed(0)} KB`, JSON.stringify(info))
}

await MeshoptEncoder.ready
fs.mkdirSync(OUT, { recursive: true })
for (const [name, cfg] of Object.entries(CAST)) if (!only.length || only.includes(name)) await packPerson(name, cfg)
if (!only.length || only.includes('motion')) for (const sex of ['m', 'f']) await packClips(sex)
