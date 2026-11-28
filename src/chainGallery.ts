// Chain Gallery: a glass hall beside the airport forecourt (south of the GA 101 terminal) with a grid of display
// slots, one per chain. Display only: no wallet, no network calls, no minting. To add a chain, add one entry to
// CHAINS below (name, brand colour, logo, tagline, a line about it); empty slots stay dark until then.
// Built once when the airport area loads; about ten draw calls in total (merged frame, glass and plinths).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Arch } from './homes.ts'

export type ChainSlot = {
  id: string
  name: string
  /** Brand colour, as a CSS hex string. */
  color: string
  /** Logo: drawn as a simple mark on the slot (no image files needed). */
  logo: 'near' | 'base' | 'solana'
  tagline: string
  about: string
}

/** The shared slot list. Order = slot order (front row left to right, then the back row). */
export const CHAINS: ChainSlot[] = [
  { id: 'near', name: 'NEAR', color: '#00ec97', logo: 'near', tagline: 'Simple accounts, chain abstraction', about: 'NEAR Protocol: readable account names and fast, low-fee transactions. In Grind District your NEAR testnet login and course certificates live here.' },
  { id: 'base', name: 'Base', color: '#0052ff', logo: 'base', tagline: 'An Ethereum layer 2 built by Coinbase', about: 'Base: an Ethereum layer 2 with low fees, secured by Ethereum. Grind District certificates can be minted on Base.' },
  { id: 'solana', name: 'Solana', color: '#9945ff', logo: 'solana', tagline: 'High speed, low cost', about: 'Solana: a fast, low-cost chain. Grind District issues course certificates on Solana devnet and takes top-ups with Solana Pay.' },
]

/** Footprint of the hall (world metres, airport area). The door faces north, towards the metro and terminal. */
export const GALLERY = { x0: 160, x1: 194, z0: 62, z1: 86, h: 8, door: [173, 181] as [number, number] }

function mark(g: CanvasRenderingContext2D, logo: ChainSlot['logo'], cx: number, cy: number, s: number, color: string): void {
  g.save(); g.translate(cx, cy)
  if (logo === 'base') {
    g.fillStyle = color; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#ffffff'; g.fillRect(-s * 0.95, -s * 0.12, s * 1.1, s * 0.24)
  } else if (logo === 'near') {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, s, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#111418'; g.lineWidth = s * 0.2; g.lineCap = 'round'; g.lineJoin = 'round'
    g.beginPath(); g.moveTo(-s * 0.45, s * 0.5); g.lineTo(-s * 0.45, -s * 0.5); g.lineTo(s * 0.45, s * 0.5); g.lineTo(s * 0.45, -s * 0.5); g.stroke()
  } else {
    const gr = g.createLinearGradient(-s, s, s, -s); gr.addColorStop(0, '#9945ff'); gr.addColorStop(1, '#14f195')
    g.fillStyle = gr
    for (const [y, flip] of [[-0.6, 1], [0, -1], [0.6, 1]] as const) {
      const h = s * 0.32, w = s * 1.7, k = s * 0.35 * flip
      g.beginPath(); g.moveTo(-w / 2 + k, y * s - h / 2); g.lineTo(w / 2 + k, y * s - h / 2); g.lineTo(w / 2 - k, y * s + h / 2); g.lineTo(-w / 2 - k, y * s + h / 2); g.closePath(); g.fill()
    }
  }
  g.restore()
}

function slotTexture(c: ChainSlot): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320
  const g = cv.getContext('2d')!
  g.fillStyle = '#0d1014'; g.fillRect(0, 0, 256, 320)
  const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, `${c.color}55`); gr.addColorStop(1, '#0d101400'); g.fillStyle = gr; g.fillRect(0, 0, 256, 320)
  g.strokeStyle = c.color; g.lineWidth = 6; g.strokeRect(5, 5, 246, 310)
  mark(g, c.logo, 128, 112, 54, c.color)
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = '800 40px Inter, system-ui, sans-serif'; g.fillText(c.name, 128, 222)
  g.fillStyle = '#c9ced6'; g.font = '500 17px Inter, system-ui, sans-serif'
  const words = c.tagline.split(' '); let line = '', y = 256
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > 220) { g.fillText(line, 128, y); y += 22; line = w } else line = t }
  if (line) g.fillText(line, 128, y)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

function signTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128
  const g = cv.getContext('2d')!
  g.fillStyle = '#101418'; g.fillRect(0, 0, 1024, 128)
  g.fillStyle = '#f2ead8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 64px Inter, system-ui, sans-serif'
  g.fillText('CHAIN GALLERY', 512, 66)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function buildChainGallery(A: Arch): void {
  const G = GALLERY, add = (o: THREE.Object3D) => A.add(0, o)
  const W = G.x1 - G.x0, D = G.z1 - G.z0, cx = (G.x0 + G.x1) / 2, cz = (G.z0 + G.z1) / 2
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)
  // Floor: polished stone with a dark border.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), new THREE.MeshStandardMaterial({ color: 0xe7e3dc, roughness: 0.22, metalness: 0.05 }))
  floor.position.set(cx, 0.04, cz); floor.receiveShadow = true; add(floor)
  // Frame: corner posts, mullions every 4 m, the roof edge and the skylight grid, merged into one mesh.
  const frame: THREE.BufferGeometry[] = []
  for (const [x, z] of [[G.x0, G.z0], [G.x1, G.z0], [G.x0, G.z1], [G.x1, G.z1]] as const) frame.push(box(0.5, G.h, 0.5, x, G.h / 2, z))
  for (let x = G.x0 + 4; x < G.x1 - 0.5; x += 4) { if (x > G.door[0] - 0.2 && x < G.door[1] + 0.2) continue; frame.push(box(0.14, G.h, 0.14, x, G.h / 2, G.z0), box(0.14, G.h, 0.14, x, G.h / 2, G.z1)) }
  for (let z = G.z0 + 4; z < G.z1 - 0.5; z += 4) frame.push(box(0.14, G.h, 0.14, G.x0, G.h / 2, z), box(0.14, G.h, 0.14, G.x1, G.h / 2, z))
  frame.push(box(W + 0.8, 0.7, 0.8, cx, G.h, G.z0), box(W + 0.8, 0.7, 0.8, cx, G.h, G.z1), box(0.8, 0.7, D, G.x0, G.h, cz), box(0.8, 0.7, D, G.x1, G.h, cz))
  for (let x = G.x0 + 4; x < G.x1; x += 4) frame.push(box(0.12, 0.2, D, x, G.h + 0.1, cz))
  frame.push(box(G.door[1] - G.door[0], 0.3, 0.3, (G.door[0] + G.door[1]) / 2, 3.1, G.z0))
  const frameMesh = new THREE.Mesh(mergeGeometries(frame.map((g) => g.toNonIndexed()))!, new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.35, metalness: 0.7 }))
  frameMesh.castShadow = true; add(frameMesh)
  // Glass: the four curtain walls (with the doorway left open) and the roof, one transparent mesh.
  const glass: THREE.BufferGeometry[] = [
    box(G.door[0] - G.x0, G.h, 0.04, (G.x0 + G.door[0]) / 2, G.h / 2, G.z0), box(G.x1 - G.door[1], G.h, 0.04, (G.door[1] + G.x1) / 2, G.h / 2, G.z0),
    box(G.door[1] - G.door[0], G.h - 3.25, 0.04, (G.door[0] + G.door[1]) / 2, 3.25 + (G.h - 3.25) / 2, G.z0),
    box(W, G.h, 0.04, cx, G.h / 2, G.z1), box(0.04, G.h, D, G.x0, G.h / 2, cz), box(0.04, G.h, D, G.x1, G.h / 2, cz),
    box(W, 0.04, D, cx, G.h + 0.02, cz),
  ]
  const glassMesh = new THREE.Mesh(mergeGeometries(glass.map((g) => g.toNonIndexed()))!, new THREE.MeshPhysicalMaterial({ color: 0xcfe3ea, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }))
  glassMesh.renderOrder = 3; add(glassMesh)
  // Sign over the door.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false }))
  sign.position.set((G.door[0] + G.door[1]) / 2, G.h - 1.2, G.z0 - 0.08); sign.rotation.y = Math.PI; add(sign)
  // Walls block movement; the doorway stays open.
  A.block(0, { x0: G.x0 - 0.2, z0: G.z0 - 0.2, x1: G.door[0], z1: G.z0 + 0.2 })
  A.block(0, { x0: G.door[1], z0: G.z0 - 0.2, x1: G.x1 + 0.2, z1: G.z0 + 0.2 })
  A.block(0, { x0: G.x0 - 0.2, z0: G.z1 - 0.2, x1: G.x1 + 0.2, z1: G.z1 + 0.2 })
  A.block(0, { x0: G.x0 - 0.2, z0: G.z0, x1: G.x0 + 0.2, z1: G.z1 })
  A.block(0, { x0: G.x1 - 0.2, z0: G.z0, x1: G.x1 + 0.2, z1: G.z1 })
  // Slots: display panels on plinths facing the door, four in the front row and three behind, set between the
  // front ones so every slot can be seen from the doorway. Filled ones carry the chain's card and a thin light in
  // its colour; empty ones stay dark.
  const plinths: THREE.BufferGeometry[] = [], dark: THREE.BufferGeometry[] = []
  const SLOTS = [...[1.5, 0.5, -0.5, -1.5].map((k) => ({ x: cx + k * 7.5, z: G.z0 + 8 })), ...[1, 0, -1].map((k) => ({ x: cx + k * 7.5, z: G.z0 + 16 }))]
  for (let i = 0; i < SLOTS.length; i++) {
    const { x, z } = SLOTS[i]!
    plinths.push(box(3.6, 0.5, 1.2, x, 0.25, z))
    const c = CHAINS[i]
    if (!c) { dark.push(box(3.2, 3.6, 0.16, x, 2.3, z)); continue }
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4), new THREE.MeshBasicMaterial({ map: slotTexture(c), toneMapped: false }))
    panel.position.set(x, 2.5, z - 0.09); panel.rotation.y = Math.PI; add(panel)
    dark.push(box(3.3, 4.1, 0.16, x, 2.5, z))
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(c.color), toneMapped: false }))
    strip.position.set(x, 0.53, z - 0.6); add(strip)
    A.use(0, { id: `chain-${c.id}`, x, z: z - 2, r: 2, title: `${c.name} · Chain Gallery`, body: `${c.tagline}. ${c.about}` })
  }
  for (const { x, z } of SLOTS) A.block(0, { x0: x - 1.8, z0: z - 0.6, x1: x + 1.8, z1: z + 0.6 })
  const stone = new THREE.Mesh(mergeGeometries(plinths.map((g) => g.toNonIndexed()))!, new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: 0.4 }))
  stone.receiveShadow = true; add(stone)
  const backs = new THREE.Mesh(mergeGeometries(dark.map((g) => g.toNonIndexed()))!, new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.5, metalness: 0.3 }))
  add(backs)
  // A welcome card just inside the door.
  A.use(0, { id: 'chain-gallery', x: (G.door[0] + G.door[1]) / 2, z: G.z0 + 2.2, r: 2, title: 'Chain Gallery', body: `The chains Grind District runs on, one slot each: ${CHAINS.map((c) => c.name).join(', ')}. Walk up to a slot to read about it. Display only: nothing here connects a wallet or sends a transaction.` })
}
