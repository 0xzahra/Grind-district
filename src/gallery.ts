// Grind Art Gallery: "ON-CHAIN", an exhibition of NFTs read live from Ethereum (api/_gallery.ts resolves each
// token's metadata, image and current owner from the chain). A white-walled hall with a warm oak floor and track
// lights: Beeple on the north wall (EVERYDAYS: THE FIRST 5000 DAYS as the centrepiece, HUMAN ONE beside it), Yuga
// Labs on the east wall, the on-chain room (CryptoPunks drawn from contract data, Art Blocks) on the west wall,
// and the culture wall by the entrance. Each work hangs in a frame on a white mat with a museum label; walk up and
// "Look closer" for the full card and a link to the token on Etherscan. Built by homes.ts into the 'gallery' area.
import * as THREE from 'three'
import type { Arch } from './homes.ts'
import type { TravelCtx } from './travel.ts'
import { std, cube, sign, person } from './travel.ts'

export const GAL = { x: 120, z: 1400 }
const HX = 16, HZ = 11, H = 6.6

type Item = {
  id: string; room: string; title: string; artist: string; year: number; collection: string; contract: string; token: string; note: string
  name: string; desc?: string; owner: string | null; img: string | null; raw: string | null; svg: string | null; onchain: boolean; chain: string; etherscan: string; opensea?: string
}
type Slot = { id: string; x: number; z: number; ry: number; w: number; h: number; y: number; label: string }

// Where each work hangs (room-local: x east, z south; ry turns the frame to face into the hall).
const N = 0, E = -Math.PI / 2, W = Math.PI / 2, S = Math.PI
const SLOTS: Slot[] = [
  { id: 'beeple-5000', x: 0, z: -HZ + 0.06, ry: N, w: 4.6, h: 4.6, y: 3.25, label: 'EVERYDAYS: THE FIRST 5000 DAYS' },
  { id: 'beeple-human-one', x: -8.6, z: -HZ + 0.06, ry: N, w: 2.4, h: 3.4, y: 2.9, label: 'HUMAN ONE' },
  ...['bayc-8817', 'bayc-3749', 'bayc-1', 'mayc-2', 'mayc-30001'].map((id, i) => ({ id, x: HX - 0.06, z: -8 + i * 4, ry: E, w: 1.9, h: 1.9, y: 2.25, label: id })),
  ...['punk-5822', 'punk-7804', 'punk-3100', 'squiggle-0', 'fidenza-313', 'ringers-879'].map((id, i) => ({ id, x: -HX + 0.06, z: -8.5 + i * 3.4, ry: W, w: 1.75, h: 1.75, y: 2.25, label: id })),
  ...([['azuki-9605', -13.2], ['doodles-1', -9.4], ['pudgy-6873', -5.6], ['wow-1', 6.4], ['coolcats-1', 10.6]] as const).map(([id, x]) => ({ id, x, z: HZ - 0.06, ry: S, w: 1.9, h: 1.9, y: 2.25, label: id })),
]

/** Raw SVG data URLs break at their first '#' colour; encode them before loading. */
const svgSafe = (s: string) => (s.startsWith('data:image/svg+xml') && !/;base64,/.test(s) && /[#<]/.test(s.slice(s.indexOf(',') + 1)) ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.slice(s.indexOf(',') + 1))}` : s)
const short = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'unknown')
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }

/** A museum label: title, artist and year, collection, token and the owner read from the chain. */
function labelTexture(it: Item | null, fallback: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320
  const g = c.getContext('2d')!
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, 512, 320)
  g.fillStyle = '#16181b'; g.textBaseline = 'top'
  const F = '"Inter Variable", Inter, system-ui, sans-serif'
  const wrap = (t: string, y: number, size: number, weight: number, max = 2) => {
    g.font = `${weight} ${size}px ${F}`
    const words = t.split(' '); let line = '', n = 0
    for (const w of words) { const nx = line ? `${line} ${w}` : w; if (g.measureText(nx).width > 460 && line) { g.fillText(line, 26, y); y += size * 1.2; line = w; if (++n >= max - 1) break } else line = nx }
    if (line) { g.fillText(line, 26, y); y += size * 1.2 }
    return y
  }
  let y = 24
  y = wrap(it?.name ?? fallback, y, 34, 800)
  g.fillStyle = '#3c4046'
  y = wrap(it ? `${it.artist}, ${it.year}` : 'Loading from Ethereum…', y + 6, 24, 600)
  if (it) {
    y = wrap(`${it.collection} · Token #${it.token.length > 8 ? it.token.slice(-6) : it.token}`, y + 4, 22, 500)
    g.fillStyle = '#6b6f75'; y = wrap(`Owner ${short(it.owner)} · ${it.chain}`, y + 4, 20, 500)
    if (it.onchain || it.svg) { g.fillStyle = '#04803f'; wrap('Fully on-chain image', y + 6, 20, 800) }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/** Load a picture as a texture (a resized copy first, the original link if that fails; on-chain SVG directly). */
async function artTexture(it: Item, max: number): Promise<{ tex: THREE.Texture; aspect: number } | null> {
  const load = (src: string, cross: boolean) => new Promise<HTMLImageElement>((ok, no) => {
    const i = new Image(); if (cross) i.crossOrigin = 'anonymous'
    i.onload = () => ok(i); i.onerror = () => no(new Error('image')); i.src = src
  })
  let img: HTMLImageElement | null = null
  const pixel = !!it.svg
  if (it.svg) img = await load(svgSafe(it.svg), false).catch(() => null)
  if (!img && it.img) img = await load(it.img, true).catch(() => null)
  if (!img && it.raw) img = await load(it.raw, true).catch(() => null)
  if (!img) return null
  const iw = img.naturalWidth || 480, ih = img.naturalHeight || 480
  const k = Math.min(1, max / Math.max(iw, ih))
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round((pixel ? 480 : iw * k))); c.height = Math.max(1, Math.round((pixel ? 480 * ih / iw : ih * k)))
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = !pixel
  // CryptoPunks sit on their classic blue-grey; their on-chain SVG is transparent.
  if (pixel) { g.fillStyle = '#638596'; g.fillRect(0, 0, c.width, c.height) }
  g.drawImage(img, 0, 0, c.width, c.height)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  if (pixel) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false } else tex.anisotropy = 4
  return { tex, aspect: iw / ih }
}

function openArt(it: Item | null, fallback: string): void {
  document.getElementById('gd-modal')?.remove()
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', it?.name ?? fallback)
  const card = el('div', '', 'gm-card gm-art')
  const head = el('div', '', 'gm-head')
  const t = el('div'); t.append(el('p', 'Grind Art Gallery · On-chain', 'gm-kick'), el('h3', it?.name ?? fallback, 'gm-title'))
  const close = () => shade.remove()
  const x = el('button', 'Close', 'gm-key gm-ghost'); x.type = 'button'; x.onclick = close
  head.append(t, x); card.append(head)
  if (!it) {
    card.append(el('p', 'This work is still loading from Ethereum. Give it a moment and look again.', 'gm-sub'))
  } else {
    const pic = el('img', '', 'gm-art-img'); pic.alt = `${it.name} by ${it.artist}`
    pic.src = it.svg ? svgSafe(it.svg) : it.img ?? it.raw ?? ''
    if (it.svg) { pic.style.imageRendering = 'pixelated'; pic.style.background = '#638596' }
    if (!it.svg) pic.onerror = () => { if (it.raw && pic.src !== it.raw) pic.src = it.raw }
    card.append(pic, el('p', `${it.artist}, ${it.year} · ${it.collection}`, 'gm-art-by'), el('p', it.note, 'gm-sub'))
    // What the token says about itself right now (dynamic works such as HUMAN ONE change chapter over time).
    if (it.desc && it.desc.length < 200 && !it.note.includes(it.desc)) card.append(el('p', `On-chain description: “${it.desc}”`, 'gm-sub'))
    const facts = el('dl', '', 'gm-facts')
    const fact = (k: string, v: string) => { facts.append(el('dt', k), el('dd', v)) }
    fact('Chain', it.chain)
    fact('Token', `#${it.token}`)
    fact('Contract', short(it.contract))
    fact('Owner now', `${short(it.owner)} (read from the chain)`)
    fact('Image', it.svg || it.onchain ? 'Stored fully on-chain' : 'Linked from the token’s metadata (IPFS or the creator’s host)')
    card.append(facts)
    const keys = el('div', '', 'gm-keys')
    const scan = el('button', 'View the token on Etherscan', 'gm-key gm-go'); scan.type = 'button'
    scan.onclick = () => window.open(it.etherscan, '_blank', 'noopener')
    keys.append(scan)
    if (it.opensea) { const os = el('button', 'View on OpenSea', 'gm-key gm-ghost'); os.type = 'button'; os.onclick = () => window.open(it.opensea, '_blank', 'noopener'); keys.append(os) }
    card.append(keys, el('p', 'Shown for education, read live from Ethereum, as any NFT viewer shows it. The work belongs to its artist and its holder; Grind District is not affiliated with them.', 'gm-small'))
  }
  shade.append(card)
  shade.addEventListener('click', (e) => { if (e.target === shade) close() })
  shade.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
  document.body.append(shade)
  window.setTimeout(() => x.focus(), 0)
}

function openGuide(): void {
  document.getElementById('gd-modal')?.remove()
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'Gallery guide')
  const card = el('div', '', 'gm-card')
  const head = el('div', '', 'gm-head')
  const t = el('div'); t.append(el('p', 'Gallery guide', 'gm-kick'), el('h3', 'ON-CHAIN: how to read an NFT', 'gm-title'))
  const x = el('button', 'Close', 'gm-key gm-ghost'); x.type = 'button'; x.onclick = () => shade.remove()
  head.append(t, x)
  const ul = el('ul', '', 'gm-brief')
  for (const l of [
    'Every work here was read from Ethereum when you walked in: its contract, its token number, its metadata and who owns it right now.',
    'An NFT is a record on a blockchain that says who owns a token. The picture is usually stored elsewhere (IPFS or the creator’s server) and linked from the token.',
    'Some works keep the picture itself on-chain: the CryptoPunks on the west wall are drawn from data inside an Ethereum contract.',
    'Art Blocks works are generative: code stored on-chain draws each piece from the token’s own random hash.',
    'To check any NFT yourself, look up the contract and token number on a block explorer. If they do not match the collection’s official contract, it is a copy.',
  ]) ul.append(el('li', l))
  card.append(head, ul, el('p', 'Walk up to any work and tap “Look closer” for its full label.', 'gm-sub'))
  shade.append(card)
  shade.addEventListener('click', (e) => { if (e.target === shade) shade.remove() })
  document.body.append(shade)
}

export function buildGallery(A: Arch, X: TravelCtx): void {
  const g = new THREE.Group(); A.add(0, g)
  const C = GAL
  // The hall, seen from inside: warm white walls, a pale ceiling, an oak floor.
  // The ceiling glows softly (lit from the light boxes), as in a real white-cube gallery, not a grey lid.
  const wall = std(0xf3f0ea, 0.92), ceil = std(0xfbfaf8, 0.95, 0, { emissive: 0xece7de, emissiveIntensity: 0.62 })
  const oak = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const q = c.getContext('2d')!; q.fillStyle = '#b48a5e'; q.fillRect(0, 0, 256, 256); for (let i = 0; i < 16; i++) { q.fillStyle = `rgba(${90 + (i * 37) % 40},${60 + (i * 23) % 30},${35},0.18)`; q.fillRect(0, i * 16, 256, 15) } for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(70,45,25,${Math.random() * 0.12})`; q.fillRect(Math.random() * 256, Math.random() * 256, 18 + Math.random() * 40, 1) } return c })())
  oak.wrapS = oak.wrapT = THREE.RepeatWrapping; oak.repeat.set(8, 6); oak.colorSpace = THREE.SRGBColorSpace
  const floor = std(0xffffff, 0.45, 0, { map: oak })
  const hall = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, H, HZ * 2), [wall, wall, ceil, floor, wall, wall].map((m) => { const k = m.clone(); k.side = THREE.BackSide; return k }))
  hall.position.set(C.x, H / 2, C.z); hall.receiveShadow = true; g.add(hall)
  // Skirting and a picture rail, and light boxes in the ceiling.
  const dark = std(0x2a2c2f, 0.5)
  for (const [x, z, w, d] of [[0, -HZ + 0.03, HX * 2, 0.04], [0, HZ - 0.03, HX * 2, 0.04], [-HX + 0.03, 0, 0.04, HZ * 2], [HX - 0.03, 0, 0.04, HZ * 2]] as const) { cube(g, w, 0.12, d, dark, C.x + x, 0.06, C.z + z, false); cube(g, w, 0.03, d, std(0xd8d4cc, 0.6), C.x + x, 4.5, C.z + z, false) }
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff6e6 })
  for (const x of [-10, 0, 10]) for (const z of [-5, 3]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.2), glow); p.rotation.x = Math.PI / 2; p.position.set(C.x + x, H - 0.02, C.z + z); g.add(p) }
  const lamp = new THREE.PointLight(0xfff1dc, 60, 30, 1.6); lamp.position.set(C.x, H - 0.8, C.z - 2); g.add(lamp)
  const lamp2 = new THREE.PointLight(0xfff1dc, 35, 26, 1.6); lamp2.position.set(C.x, H - 0.8, C.z + 6); g.add(lamp2)
  g.add(new THREE.HemisphereLight(0xfffaf0, 0x8a7a66, 0.55))
  // Title wall text and the disclaimer by the entrance.
  const title = sign('ON-CHAIN', 6.4, 1.0, { fg: '#16181b', weight: 900 }); title.position.set(C.x + 8.6, 4.2, C.z - HZ + 0.07); g.add(title)
  const sub = sign('NFTs READ LIVE FROM ETHEREUM', 6.4, 0.42, { fg: '#3c4046', weight: 700 }); sub.position.set(C.x + 8.6, 3.5, C.z - HZ + 0.07); g.add(sub)
  const rooms = sign('BEEPLE · YUGA LABS · LARVA LABS · ART BLOCKS · AND MORE', 6.4, 0.32, { fg: '#6b6f75', weight: 600, px: 24 }); rooms.position.set(C.x + 8.6, 3.0, C.z - HZ + 0.07); g.add(rooms)
  const wallLabel = (text: string, x: number, z: number, ry: number) => { const s = sign(text, 4.2, 0.4, { fg: '#16181b', weight: 800, px: 34 }); s.position.set(C.x + x, 4.05, C.z + z); s.rotation.y = ry; g.add(s) }
  wallLabel('YUGA LABS', HX - 0.07, 0, E)
  wallLabel('ON-CHAIN ROOM: CRYPTOPUNKS · ART BLOCKS', -HX + 0.07, 0, W)
  wallLabel('CULTURE', -9.4, HZ - 0.07, S)
  {
    // The disclaimer by the door, in two lines.
    const c = document.createElement('canvas'); c.width = 1024; c.height = 120
    const q = c.getContext('2d')!
    q.fillStyle = '#6b6f75'; q.font = '500 34px "Inter Variable", Inter, system-ui, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'
    q.fillText('Works shown for education, read live from Ethereum.', 512, 34); q.fillText('They belong to their artists and holders. Not affiliated.', 512, 84)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const note = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.5), new THREE.MeshBasicMaterial({ map: t, transparent: true }))
    note.position.set(C.x + 3.6, 1.25, C.z + HZ - 0.07); note.rotation.y = S; g.add(note)
  }

  // Frames: a dark wood frame, a white mat and the work, a track light above, a label beside.
  const frameMat = std(0x1c1a18, 0.45), matMat = new THREE.MeshBasicMaterial({ color: 0xf7f6f2 })
  const placeholder = new THREE.MeshBasicMaterial({ color: 0x2c2f33 })
  type Hung = { slot: Slot; art: THREE.Mesh; label: THREE.Mesh; frame: THREE.Group; item: Item | null }
  const hung: Hung[] = []
  for (const s of SLOTS) {
    const f = new THREE.Group(); f.position.set(C.x + s.x, s.y, C.z + s.z); f.rotation.y = s.ry; g.add(f)
    const outer = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.08), frameMat); outer.position.z = 0.04; f.add(outer)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matMat); mat.position.z = 0.085; f.add(mat)
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), placeholder); art.position.z = 0.09; f.add(art)
    const fit = (aspect: number) => {
      // The work at its own proportions inside the slot, a 10 cm mat and a 6 cm frame around it.
      let w = s.w, h = s.w / aspect
      if (h > s.h) { h = s.h; w = s.h * aspect }
      art.scale.set(w, h, 1); mat.scale.set(w + 0.2, h + 0.2, 1); outer.scale.set(w + 0.32, h + 0.32, 1)
    }
    fit(1)
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshBasicMaterial({ map: labelTexture(null, s.label) }))
    label.position.set(Math.min(s.w, s.h) / 2 + 0.62, 1.45 - s.y, 0.03); f.add(label)
    // Track light: a black can on a short stem above the frame, and a soft wash of light on the wall.
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 12), dark); can.position.set(0, s.h / 2 + 0.7, 0.2); can.rotation.x = 0.7; f.add(can)
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(s.w + 1.2, s.h + 1.4), new THREE.MeshBasicMaterial({ color: 0xfff3dc, transparent: true, opacity: 0.16, depthWrite: false }))
    wash.position.z = 0.02; f.add(wash)
    const h: Hung = { slot: s, art, label, frame: f, item: null }
    hung.push(h)
    ;(art.userData as { fit?: (a: number) => void }).fit = fit
    // Walk up and look closer: the spot is 1.6 m in front of the work.
    const fx = C.x + s.x + Math.sin(s.ry) * 1.6, fz = C.z + s.z + Math.cos(s.ry) * 1.6
    A.use(0, { id: `art-${s.id}`, x: fx, z: fz, r: Math.max(1.3, s.w * 0.45), title: s.label, body: 'A work on the chain. Look closer for its label.', enter: 'Look closer', use: () => openArt(h.item, s.label) })
  }
  // A rope line in front of the centrepiece.
  for (const x of [-2.6, 2.6]) { cube(g, 0.08, 0.9, 0.08, std(0xc9a96a, 0.3, 0.8), C.x + x, 0.45, C.z - HZ + 1.5); }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 5.2, 8), std(0x8a1f2c, 0.7)); rope.rotation.z = Math.PI / 2; rope.position.set(C.x, 0.82, C.z - HZ + 1.5); g.add(rope)
  A.block(0, { x0: C.x - 2.7, z0: C.z - HZ, x1: C.x + 2.7, z1: C.z - HZ + 1.6 })
  // Benches in the middle of the room, facing the Beeple wall.
  for (const z of [-3.2, 1.6]) { cube(g, 4.2, 0.08, 0.7, std(0x6b4a30, 0.5), C.x, 0.46, C.z + z); for (const sx of [-1.8, 1.8]) cube(g, 0.1, 0.42, 0.6, dark, C.x + sx, 0.21, C.z + z); A.block(0, { x0: C.x - 2.15, z0: C.z + z - 0.4, x1: C.x + 2.15, z1: C.z + z + 0.4 }) }
  // The front desk and the guide.
  cube(g, 2.6, 1.05, 0.7, std(0xf7f6f2, 0.4), C.x - 5.2, 0.52, C.z + HZ - 3.2)
  cube(g, 2.7, 0.05, 0.8, dark, C.x - 5.2, 1.07, C.z + HZ - 3.2)
  A.block(0, { x0: C.x - 6.6, z0: C.z + HZ - 3.6, x1: C.x - 3.8, z1: C.z + HZ - 2.8 })
  const guide = person('woman2', { pose: 'stand', height: 1.68, look: { top: 0x16181b, bottom: 0x16181b, shoes: 0x111111, skin: 0x6e4630, hair: 0x16110e } })
  guide.position.set(C.x - 5.2, 0, C.z + HZ - 2.4); guide.rotation.y = Math.PI; g.add(guide)
  A.use(0, { id: 'gallery-guide', x: C.x - 5.2, z: C.z + HZ - 4.4, r: 1.5, title: 'Gallery guide', body: 'How to read an NFT, and how this exhibition was read from the chain.', enter: 'Ask the guide', use: openGuide })
  // A few visitors looking at the work.
  const lite = matchMedia('(pointer: coarse)').matches
  const visitors: Array<[string, number, number, number]> = [['man2', -1.2, -HZ + 2.6, 0], ['woman4', 1.4, -HZ + 2.9, -0.2], ['man3', HX - 2.4, -3.6, -Math.PI / 2], ['woman1', -HX + 2.2, -2.2, Math.PI / 2], ['man1', -9.4, HZ - 2.4, Math.PI]]
  for (const [m, x, z, ry] of lite ? visitors.slice(0, 3) : visitors) {
    const v = person(m as Parameters<typeof person>[0], { pose: 'stand', height: m.startsWith('w') ? 1.66 : 1.78 })
    v.position.set(C.x + x, 0, C.z + z); v.rotation.y = ry + Math.PI; g.add(v)
    A.block(0, { x0: C.x + x - 0.3, z0: C.z + z - 0.3, x1: C.x + x + 0.3, z1: C.z + z + 0.3 })
  }
  // The way out.
  cube(g, 3.6, 3.2, 0.06, std(0x1c1a18, 0.4), C.x, 1.6, C.z + HZ - 0.02, false)
  const exitSign = sign('EXIT · BACK TO THE PROMENADE', 3.4, 0.3, { fg: '#ffffff', bg: '#1c1a18', weight: 700 }); exitSign.position.set(C.x, 3.45, C.z + HZ - 0.07); exitSign.rotation.y = S; g.add(exitSign)
  A.use(0, { id: 'home-exit', x: C.x, z: C.z + HZ - 1.1, r: 1.3, title: 'Exit', body: 'Back to the promenade.', enter: 'Leave the gallery', use: () => undefined })

  // The works themselves, read from the chain (cached by the server for six hours).
  void fetch('/api/track?op=gallery').then((r) => (r.ok ? r.json() : null)).then(async (j: { items?: Item[] } | null) => {
    const items = j?.items ?? []
    for (const h of hung) {
      const it = items.find((x) => x.id === h.slot.id) ?? null
      if (!it) continue
      h.item = it
      ;(h.label.material as THREE.MeshBasicMaterial).map = labelTexture(it, h.slot.label)
      ;(h.label.material as THREE.MeshBasicMaterial).needsUpdate = true
    }
    // Pictures load a few at a time, the centrepiece first, so the hall stays smooth.
    const queue = [...hung].filter((h) => h.item)
    const max = lite ? 640 : 1024
    const worker = async () => {
      for (;;) {
        const h = queue.shift(); if (!h || !h.art.parent) return
        const got = await artTexture(h.item!, h.slot.id === 'beeple-5000' ? max * 1.5 : max).catch(() => null)
        if (!got || !h.art.parent) continue
        h.art.material = new THREE.MeshBasicMaterial({ map: got.tex })
        ;(h.art.userData as { fit: (a: number) => void }).fit(got.aspect)
      }
    }
    await Promise.all([worker(), worker(), worker()])
  }).catch(() => X.toast('The gallery could not reach Ethereum just now. The labels will fill in when it can.'))
}
