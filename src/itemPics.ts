// Shop pictures. Each item is the real low-poly display model from the showroom (showcase.ts), photographed
// once on a small lit pedestal with the game's own renderer and cached. The inline SVGs below remain as the
// instant fallback (flat mode, or before the city's renderer exists).
import * as THREE from 'three'
import { itemModel } from './showcase.ts'
import { isFineCar } from './finecars.ts'

let shoot: ((id: string) => string | null) | null = null
const shots = new Map<string, string | null>()

/** Give the shop a renderer to photograph items with (the city's own: no second WebGL context). */
export function setShopRenderer(renderer: THREE.WebGLRenderer, environment: () => THREE.Texture | null): void {
  const W = 960, H = 480 // rendered at 2x and scaled down for clean edges
  const scene = new THREE.Scene()
  const backdrop = document.createElement('canvas'); backdrop.width = 16; backdrop.height = 256
  const bg = backdrop.getContext('2d')
  if (bg) { const gr = bg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#191c1f'); gr.addColorStop(0.62, '#2c3034'); gr.addColorStop(0.63, '#3a3d40'); gr.addColorStop(1, '#25282b'); bg.fillStyle = gr; bg.fillRect(0, 0, 16, 256) }
  const bgTex = new THREE.CanvasTexture(backdrop); bgTex.colorSpace = THREE.SRGBColorSpace
  scene.background = bgTex
  const key = new THREE.DirectionalLight(0xfff1dc, 1.05); key.position.set(-2.2, 3.4, 2.6)
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.55); rim.position.set(2.6, 1.8, -2.4)
  scene.add(key, rim, new THREE.HemisphereLight(0xf2ede4, 0x3a3630, 0.5))
  scene.environmentIntensity = 0.25
  const stone = new THREE.MeshStandardMaterial({ color: 0xbdb5a8, roughness: 0.6, flatShading: true })
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8955a, roughness: 0.35, metalness: 0.85 })
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.2, 24), stone); plinth.position.y = -0.1
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.014, 6, 48).rotateX(Math.PI / 2), brass)
  const shade = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })); shade.position.y = 0.002
  scene.add(plinth, ring, shade)
  const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 30)
  camera.position.set(2.0, 1.25, 3.25)
  camera.lookAt(0, 0.26, 0)
  const target = new THREE.WebGLRenderTarget(W, H)
  target.texture.colorSpace = THREE.SRGBColorSpace
  const pixels = new Uint8Array(W * H * 4)
  const box = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3()
  shoot = (id) => {
    const model = itemModel(id)
    if (!model.children.length) return null
    // Fit every item to the plinth: longest side about 1.25 units, standing on the top, turned three-quarters.
    box.setFromObject(model); box.getSize(size); box.getCenter(centre)
    // Cars fill the turntable (they overhang it a little, as on a real one); small things keep to the plinth.
    const k = (isFineCar(id) ? 1.78 : 1.3) / Math.max(size.x, size.z, size.y * 1.3, 0.001)
    model.scale.setScalar(k)
    model.position.set(-centre.x * k, -box.min.y * k, -centre.z * k)
    // Vehicles show their side in a three-quarter view; screens face the camera.
    const turn = new THREE.Group(); turn.rotation.y = /saloon|tourer|coupe|executive|car|jet|skydrone/.test(id) ? -0.75 : 0.2; turn.add(model)
    scene.add(turn)
    scene.environment = environment()
    const prev = renderer.getRenderTarget()
    renderer.setRenderTarget(target)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.readRenderTargetPixels(target, 0, 0, W, H, pixels)
    renderer.setRenderTarget(prev)
    scene.remove(turn)
    turn.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.() })
    const full = document.createElement('canvas'); full.width = W; full.height = H
    const g = full.getContext('2d'); if (!g) return null
    const image = g.createImageData(W, H)
    for (let y = 0; y < H; y++) image.data.set(pixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4)
    g.putImageData(image, 0, 0)
    const out = document.createElement('canvas'); out.width = W / 2; out.height = H / 2
    const og = out.getContext('2d'); if (!og) return null
    og.imageSmoothingQuality = 'high'
    og.drawImage(full, 0, 0, W / 2, H / 2)
    return out.toDataURL('image/png')
  }
  shots.clear()
}

// Photos are taken in the background, one per frame after the panel has painted, so a shop opens at once
// with its drawn placeholders and each photo swaps in as it is ready (it used to take every photo before the
// panel could appear: seconds on a phone). Taken photos stay cached for the session.
const waiting = new Map<string, Array<(url: string | null) => void>>()
const line: string[] = []
let pumping = false
function pump(): void {
  if (pumping) return
  pumping = true
  const next = () => {
    const id = line.shift()
    if (!id) { pumping = false; return }
    let url: string | null = null
    if (shoot) { try { url = shoot(id) } catch { url = null } }
    shots.set(id, url)
    for (const f of waiting.get(id) ?? []) f(url)
    waiting.delete(id)
    requestAnimationFrame(() => window.setTimeout(next, 0))
  }
  requestAnimationFrame(() => window.setTimeout(next, 0))
}
function photoLater(id: string, done: (url: string | null) => void): void {
  const list = waiting.get(id)
  if (list) { list.push(done); return }
  waiting.set(id, [done])
  line.push(id)
  pump()
}

// Fallback: inline SVG illustrations (no network, crisp on phones).
const S = (body: string) => `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="100" fill="#0d1512"/>${body}</svg>`
// Shared gradients: brushed metal, glass and soft shadow so items read as real hardware, not blocks.
const DEFS = '<defs><linearGradient id="mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ecef"/><stop offset="1" stop-color="#9aa1a8"/></linearGradient><linearGradient id="dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4046"/><stop offset="1" stop-color="#15181b"/></linearGradient><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b5c9e"/><stop offset=".55" stop-color="#16263d"/><stop offset="1" stop-color="#0b1320"/></linearGradient><radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>'
const G = (body: string) => S(DEFS + '<ellipse cx="100" cy="92" rx="70" ry="6" fill="url(#sh)"/>' + body)
// Quadcopter: X-frame arms, four motor pods with blurred props, camera gimbal under the body.
const quad = (body: string, under = '') => G(
  '<g stroke="url(#dk)" stroke-width="5" stroke-linecap="round"><line x1="62" y1="30" x2="92" y2="46"/><line x1="138" y1="30" x2="108" y2="46"/><line x1="62" y1="62" x2="92" y2="52"/><line x1="138" y1="62" x2="108" y2="52"/></g>' +
  [[58, 28], [142, 28], [58, 64], [142, 64]].map(([x, y]) => `<ellipse cx="${x}" cy="${y - 4}" rx="24" ry="4" fill="#9fb3a8" opacity=".35"/><rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="2" fill="#2a2f33"/>`).join('') +
  body + under)
const phoneBody = (frame: string, cams: string) => G(`<rect x="72" y="6" width="56" height="86" rx="10" fill="${frame}"/><rect x="75" y="9" width="50" height="80" rx="8" fill="#0a0c0e"/><rect x="78" y="13" width="44" height="72" rx="5" fill="url(#gl)"/><rect x="92" y="15" width="16" height="4" rx="2" fill="#0a0c0e"/><path d="M80 15 L118 15 L80 50 Z" fill="#fff" opacity=".07"/>${cams}`)
const PICS: Record<string, string> = {
  scout: quad('<rect x="86" y="40" width="28" height="16" rx="7" fill="#d9b26a"/><rect x="90" y="43" width="20" height="3" rx="1.5" fill="#fff" opacity=".35"/>', '<circle cx="100" cy="61" r="4" fill="#1a1d20" stroke="#555" stroke-width="1.5"/>'),
  courier: quad('<rect x="84" y="39" width="32" height="15" rx="6" fill="url(#mt)"/>', '<line x1="92" y1="54" x2="92" y2="60" stroke="#444" stroke-width="2"/><line x1="108" y1="54" x2="108" y2="60" stroke="#444" stroke-width="2"/><rect x="86" y="60" width="28" height="20" rx="2" fill="#b07a3c"/><line x1="100" y1="60" x2="100" y2="80" stroke="#d8b07a" stroke-width="3"/>'),
  halo: quad('<rect x="86" y="40" width="28" height="15" rx="7" fill="url(#dk)"/><circle cx="100" cy="47" r="22" fill="none" stroke="#17f790" stroke-width="3" opacity=".9"/><circle cx="100" cy="47" r="26" fill="none" stroke="#17f790" stroke-width="1" opacity=".35"/>'),
  phone: phoneBody('#2a2f35', ''),
  // Pro phone shown from the back: titanium frame, matte glass, triple-lens camera island.
  phonepro: G('<rect x="72" y="6" width="56" height="86" rx="11" fill="url(#mt)"/><rect x="75" y="9" width="50" height="80" rx="9" fill="#2c3136"/><rect x="79" y="13" width="26" height="26" rx="7" fill="#454b51"/><g fill="#0c0e10" stroke="#7d848b" stroke-width="1.5"><circle cx="86" cy="20" r="5"/><circle cx="98" cy="20" r="5"/><circle cx="86" cy="32" r="5"/></g><circle cx="98" cy="32" r="2.2" fill="#f2e9c9"/><circle cx="100" cy="62" r="6" fill="none" stroke="#5b6168" stroke-width="1.5"/>'),
  laptop: G('<path d="M58 10h84a4 4 0 0 1 4 4v58H54V14a4 4 0 0 1 4-4z" fill="url(#mt)"/><rect x="59" y="15" width="82" height="53" rx="1" fill="url(#gl)"/><circle cx="100" cy="12.5" r="1.2" fill="#333"/><path d="M36 74h128l-6 9H42z" fill="url(#mt)"/><rect x="88" y="74" width="24" height="3" rx="1.5" fill="#7d838a"/><g fill="#fff" opacity=".18"><rect x="64" y="22" width="34" height="3"/><rect x="64" y="29" width="50" height="3"/><rect x="64" y="36" width="26" height="3"/></g>'),
  desktop: G('<rect x="36" y="8" width="104" height="64" rx="4" fill="#1b1e21"/><rect x="40" y="12" width="96" height="56" rx="1" fill="url(#gl)"/><path d="M80 72h16l4 14H76z" fill="url(#mt)"/><rect x="62" y="86" width="52" height="4" rx="2" fill="url(#mt)"/><rect x="146" y="16" width="28" height="72" rx="3" fill="url(#dk)"/><g stroke="#4a5158" stroke-width="1.5"><line x1="151" y1="44" x2="169" y2="44"/><line x1="151" y1="50" x2="169" y2="50"/><line x1="151" y1="56" x2="169" y2="56"/></g><circle cx="160" cy="26" r="3" fill="#17f790"/>'),
  earbuds: G('<rect x="66" y="44" width="68" height="40" rx="20" fill="#f4f4f4"/><line x1="68" y1="56" x2="132" y2="56" stroke="#cfcfcf" stroke-width="1.5"/><circle cx="100" cy="70" r="2" fill="#7fd99a"/><g fill="#fafafa" stroke="#d6d6d6" stroke-width="1"><path d="M76 14a11 11 0 1 1 0 22h-2v18a4 4 0 0 1-8 0V26a12 12 0 0 1 10-12z"/><path d="M124 14a11 11 0 1 0 0 22h2v18a4 4 0 0 0 8 0V26a12 12 0 0 0-10-12z"/></g>'),
  watch: G('<path d="M86 2h28l-2 26H88z" fill="#c75b5b"/><path d="M88 72h24l2 26H86z" fill="#c75b5b"/><rect x="74" y="24" width="52" height="52" rx="14" fill="url(#mt)"/><rect x="79" y="29" width="42" height="42" rx="10" fill="#07090a"/><rect x="127" y="38" width="4" height="10" rx="2" fill="#9aa1a8"/><circle cx="100" cy="50" r="13" fill="none" stroke="#17f790" stroke-width="3" stroke-dasharray="58 30" transform="rotate(-90 100 50)"/><text x="100" y="54" font-size="10" text-anchor="middle" fill="#e9ecef" font-family="sans-serif">10:09</text>'),
  foldphone: G('<rect x="58" y="10" width="40" height="78" rx="6" fill="url(#mt)"/><rect x="102" y="10" width="40" height="78" rx="6" fill="url(#mt)"/><rect x="61" y="13" width="34" height="72" rx="4" fill="url(#gl)"/><rect x="105" y="13" width="34" height="72" rx="4" fill="url(#gl)"/><rect x="98" y="10" width="4" height="78" fill="#444"/>'),
  vrset: G('<rect x="46" y="30" width="108" height="44" rx="20" fill="#f2f2ee"/><rect x="52" y="35" width="96" height="34" rx="16" fill="#0b0d10"/><path d="M46 52c-14 0-14 20 0 20M154 52c14 0 14 20 0 20" fill="none" stroke="#2a2d31" stroke-width="6"/><circle cx="62" cy="40" r="2" fill="#6dffc8"/><circle cx="138" cy="40" r="2" fill="#6dffc8"/>'),
  evcoupe: S('<path d="M22 70h156v-10l-26-6-22-16H92L72 54 22 58z" fill="#dfe6ea"/><rect x="96" y="42" width="36" height="11" fill="#9cc"/><rect x="24" y="60" width="150" height="2.5" fill="#9ff3e0"/><circle cx="52" cy="72" r="10" fill="#111"/><circle cx="148" cy="72" r="10" fill="#111"/>'),
  ultrabook: G('<path d="M58 12h84a3 3 0 0 1 3 3v56H55V15a3 3 0 0 1 3-3z" fill="#5c5f63"/><rect x="58" y="15" width="84" height="53" rx="1" fill="url(#gl)"/><path d="M42 71h116l-6 9H48z" fill="#7a7d81"/>'),
  minipc: G('<rect x="30" y="12" width="96" height="56" rx="3" fill="url(#mt)"/><rect x="33" y="15" width="90" height="50" rx="1" fill="url(#gl)"/><rect x="74" y="68" width="8" height="14" fill="url(#mt)"/><rect x="134" y="62" width="34" height="22" rx="5" fill="url(#mt)"/>'),
  tablet: G('<rect x="54" y="14" width="92" height="66" rx="6" fill="#5c5f63"/><rect x="58" y="18" width="84" height="58" rx="3" fill="url(#gl)"/><rect x="60" y="84" width="70" height="3" rx="1.5" fill="#f2f2ee"/>'),
  executive: S('<path d="M16 70h168V56l-10-6-34-4-16-14H74L54 46l-30 4-8 6z" fill="#c9ced3"/><rect x="78" y="36" width="44" height="11" fill="#9cc"/><rect x="176" y="50" width="6" height="14" fill="#eee"/><circle cx="52" cy="72" r="10" fill="#111"/><circle cx="150" cy="72" r="10" fill="#111"/>'),
  sportsaloon: S('<path d="M22 70h156V58l-24-6-18-16H80L60 50l-36 6z" fill="#1c3f96"/><rect x="84" y="40" width="42" height="11" fill="#9cc"/><circle cx="56" cy="72" r="10" fill="#111"/><circle cx="146" cy="72" r="10" fill="#111"/>'),
  supercar: S('<path d="M14 72h172v-8l-30-10-22-14H96L70 52 14 62z" fill="#c4161c"/><path d="M98 42h30l12 10H84z" fill="#9cc"/><circle cx="48" cy="72" r="10" fill="#111"/><circle cx="152" cy="72" r="10" fill="#111"/>'),
  hypercar: S('<path d="M12 72h176v-7l-34-10-20-13H98L72 53 12 63z" fill="#2a2d32"/><path d="M100 44h28l12 9H88z" fill="#9cc"/><rect x="12" y="46" width="34" height="3" fill="#ff7a1a"/><rect x="26" y="48" width="3" height="12" fill="#111"/><circle cx="48" cy="72" r="10" fill="#111"/><circle cx="152" cy="72" r="10" fill="#111"/>'),
  saloon: S('<path d="M30 70h140v-14l-22-4-18-16H72L52 52 30 56z" fill="#55595e"/><rect x="76" y="40" width="44" height="12" fill="#9cc"/><circle cx="62" cy="72" r="10" fill="#111"/><circle cx="142" cy="72" r="10" fill="#111"/>'),
  tourer: S('<path d="M20 70h160v-10l-30-6-20-14H96L80 54 20 58z" fill="#7a2626"/><rect x="100" y="44" width="34" height="10" fill="#9cc"/><circle cx="50" cy="72" r="10" fill="#111"/><circle cx="150" cy="72" r="10" fill="#111"/>'),
  lightjet: S('<path d="M20 52l150-6c10 0 14 4 14 6s-4 6-14 6L20 56z" fill="#e8e8e8"/><path d="M90 52l-20-26h12l30 26zM90 54l-20 26h12l30-26zM24 52l-8-18h8l12 18z" fill="#c7c7c7"/>'),
  longjet: S('<path d="M10 50l170-6c10 0 14 4 14 6s-4 6-14 6L10 54z" fill="#f2f2f2"/><path d="M80 50l-28-34h14l40 34zM80 54l-28 34h14l40-34zM14 50l-8-20h8l14 20z" fill="#3d5a80"/>'),
  skydrone: S('<ellipse cx="100" cy="60" rx="34" ry="16" fill="#e6e6e6"/><rect x="86" y="48" width="28" height="10" rx="4" fill="#9cc"/><g fill="#2b3a33"><ellipse cx="45" cy="30" rx="22" ry="4"/><ellipse cx="155" cy="30" rx="22" ry="4"/></g><g stroke="#9fb3a8" stroke-width="4"><line x1="45" y1="30" x2="80" y2="55"/><line x1="155" y1="30" x2="120" y2="55"/></g>'),
}
/** A shop picture for `id`. With `label`, a small name tag sits on the picture like a showroom plaque. */
export function itemPic(id: string, label?: string): HTMLElement {
  const d = document.createElement('div'); d.className = 'shop-pic'; d.setAttribute('role', 'img'); d.setAttribute('aria-label', label ?? id)
  const put = (url: string) => {
    const img = document.createElement('img'); img.src = url; img.alt = ''; img.decoding = 'async'
    d.classList.add('shop-pic-photo')
    d.querySelector(':scope > svg')?.remove()
    d.prepend(img)
  }
  const have = shots.get(id)
  if (have) put(have)
  else {
    d.innerHTML = PICS[id] ?? S('')
    if (shoot && !shots.has(id)) photoLater(id, (url) => { if (url) put(url) })
  }
  if (label) { const tag = document.createElement('span'); tag.className = 'shop-tag'; tag.textContent = label; d.append(tag) }
  return d
}
