import { getMorph, citizenScale } from './morph.ts'
import { NFT_COLLECTIONS_ENABLED } from './nft.ts'
import * as THREE from 'three'
import type { BodyId, MaskId } from './logic.ts'
import { mountMask } from './masks.ts'
import { contactShadow, locomotion } from './rig.ts'
import { createPlayer } from './player.ts'
import { createShrimp, type ShrimpAvatar } from './shrimp.ts'
import { createZuri } from './zuri.ts'
import { MEN, WOMEN, upgradeToHuman, type Extras, type Look } from './humans.ts'
import { worn, piece } from './wardrobe.ts'

export type Avatar = ShrimpAvatar

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, cast = true): THREE.Mesh {
  const item = new THREE.Mesh(geometry, material)
  item.castShadow = cast
  item.receiveShadow = true
  return item
}

function chainFor(parent: THREE.Group, y: number, radius: number): THREE.Mesh {
  const gold = new THREE.MeshStandardMaterial({
    color: 0xf0c14a,
    roughness: 0.28,
    metalness: 0.82,
    emissive: 0x6a4a10,
    emissiveIntensity: 0.22,
  })
  const chain = mesh(new THREE.TorusGeometry(radius, 0.028, 8, 16), gold, false)
  chain.rotation.x = Math.PI / 2.4
  chain.position.set(0, y, 0.04)
  chain.visible = false
  parent.add(chain)
  return chain
}

function limb(side: number, y: number, length: number, radius: number, material: THREE.Material): THREE.Group {
  const pivot = new THREE.Group()
  pivot.position.set(side * 0.18, y, 0)
  const part = mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material)
  part.position.y = -(length * 0.5 + radius)
  pivot.add(part)
  return pivot
}

function rigged(build: (bob: THREE.Group) => {
  tint: THREE.MeshStandardMaterial
  chain: THREE.Mesh
  legL: THREE.Group
  legR: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
}): Avatar {
  const root = new THREE.Group()
  const yaw = new THREE.Group()
  const bob = new THREE.Group()
  yaw.add(bob)
  root.add(yaw)
  root.add(contactShadow(0.5))
  const parts = build(bob)
  const maskAnchor = new THREE.Group()
  maskAnchor.name = 'mask-anchor'
  maskAnchor.position.set(0, 1.62, 0.18)
  bob.add(maskAnchor)
  const motion = locomotion(yaw, bob, parts.legL, parts.legR, parts.armL, parts.armR)
  return {
    object: root,
    face: motion.face,
    step: motion.step,
    setStyle(tint, luxury) {
      parts.tint.color.setHex(tint)
      parts.tint.emissive.setHex(tint)
      parts.tint.emissiveIntensity = 0
      parts.chain.visible = luxury
    },
    setMask(mask: MaskId) {
      mountMask(maskAnchor, mask)
    },
  }
}

function createLedger(): Avatar {
  return rigged((bob) => {
    const cloth = new THREE.MeshStandardMaterial({ color: 0x143028, roughness: 0.62, metalness: 0.08 })
    const tint = new THREE.MeshStandardMaterial({
      color: 0x17f790,
      roughness: 0.35,
      metalness: 0.12,
      emissive: 0x0a6b40,
      emissiveIntensity: 0.28,
    })
    const dark = new THREE.MeshStandardMaterial({ color: 0x101816, roughness: 0.5 })
    const torso = mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), cloth)
    torso.position.y = 1.12
    const head = mesh(new THREE.BoxGeometry(0.36, 0.34, 0.32), cloth)
    head.position.y = 1.64
    const visor = mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), tint, false)
    visor.position.set(0, 1.66, 0.16)
    const neck = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.14), dark, false)
    neck.position.y = 1.38
    bob.add(torso, head, visor, neck)
    const legL = limb(-1, 0.78, 0.46, 0.07, cloth)
    const legR = limb(1, 0.78, 0.46, 0.07, cloth)
    const armL = limb(-1.35, 1.28, 0.34, 0.055, cloth)
    const armR = limb(1.35, 1.28, 0.34, 0.055, cloth)
    bob.add(legL, legR, armL, armR)
    return { tint, chain: chainFor(bob, 1.34, 0.2), legL, legR, armL, armR }
  })
}

function createMarina(): Avatar {
  return rigged((bob) => {
    const tint = new THREE.MeshStandardMaterial({
      color: 0x17f790,
      roughness: 0.42,
      metalness: 0.06,
      emissive: 0x0a6b40,
      emissiveIntensity: 0.22,
    })
    const dark = new THREE.MeshStandardMaterial({ color: 0x10241c, roughness: 0.55 })
    const body = mesh(new THREE.SphereGeometry(0.38, 18, 14), tint)
    body.scale.set(1, 1.15, 0.92)
    body.position.y = 1.05
    const head = mesh(new THREE.SphereGeometry(0.2, 16, 12), tint)
    head.position.y = 1.62
    const visor = mesh(new THREE.BoxGeometry(0.22, 0.06, 0.04), dark, false)
    visor.position.set(0, 1.64, 0.16)
    bob.add(body, head, visor)
    const legL = limb(-0.7, 0.62, 0.22, 0.06, dark)
    const legR = limb(0.7, 0.62, 0.22, 0.06, dark)
    const armL = limb(-1.5, 1.15, 0.2, 0.05, tint)
    const armR = limb(1.5, 1.15, 0.2, 0.05, tint)
    bob.add(legL, legR, armL, armR)
    return { tint, chain: chainFor(bob, 1.28, 0.24), legL, legR, armL, armR }
  })
}

function createSignal(): Avatar {
  return rigged((bob) => {
    const cloth = new THREE.MeshStandardMaterial({ color: 0x1a2420, roughness: 0.78 })
    const tint = new THREE.MeshStandardMaterial({
      color: 0x17f790,
      roughness: 0.4,
      emissive: 0x0a6b40,
      emissiveIntensity: 0.3,
    })
    const cloak = mesh(new THREE.BoxGeometry(0.62, 0.9, 0.34), cloth)
    cloak.position.y = 1.05
    const hood = mesh(new THREE.ConeGeometry(0.24, 0.42, 4), cloth)
    hood.position.y = 1.72
    const face = mesh(new THREE.SphereGeometry(0.1, 12, 10), tint, false)
    face.position.set(0, 1.5, 0.12)
    const hem = mesh(new THREE.BoxGeometry(0.64, 0.05, 0.36), tint, false)
    hem.position.y = 0.62
    bob.add(cloak, hood, face, hem)
    const legL = limb(-0.85, 0.7, 0.34, 0.06, cloth)
    const legR = limb(0.85, 0.7, 0.34, 0.06, cloth)
    const armL = limb(-1.7, 1.25, 0.36, 0.05, cloth)
    const armR = limb(1.7, 1.25, 0.36, 0.05, cloth)
    bob.add(legL, legR, armL, armR)
    return { tint, chain: chainFor(bob, 1.2, 0.22), legL, legR, armL, armR }
  })
}

// The crowd reuses eight figures. The first copy of each wears the figure's own clothes; later copies are
// re-dressed (top, trousers, skin tone, hair) so the same person is not seen twice on one street.
const CROWD_TOPS = [0x2f4a44, 0x8a3b2e, 0x1d2a44, 0xc4a574, 0x5d6b3a, 0x6b2d4a, 0xe8dcc4, 0x33363b, 0x1f6b4f, 0xb5553a]
const CROWD_BOTTOMS = [0x16171a, 0x2b3a67, 0xcdb48a, 0x3a3f47, 0x4a3a2c]
const CROWD_SKINS = [0x6f4329, 0xa8714b, 0x55321f, 0x8d5a3b, 0xbf8a62, 0x3b2316]
const CROWD_HAIR = [0x15110e, 0x2a1a12, 0x15110e, 0x5a3622]
function crowdLook(variant: number): Look | undefined {
  const round = variant >> 3
  if (round === 0) return undefined
  const k = variant * 5 + round * 3
  return { top: CROWD_TOPS[k % CROWD_TOPS.length], bottom: CROWD_BOTTOMS[k % CROWD_BOTTOMS.length], skin: CROWD_SKINS[k % CROWD_SKINS.length], hair: CROWD_HAIR[k % CROWD_HAIR.length] }
}

export function createAvatar(body: BodyId, tint: number, luxury: boolean, variant?: number): Avatar {
  const avatar = createProcedural(body, tint, luxury)
  // Real animated people replace the human bodies (player, Zuri, citizens). Masked players keep the procedural body.
  if (body === 'player' || body === 'zuri') {
    const female = body === 'zuri'
    const own = variant === undefined
    const w = worn()
    const topPiece = own ? piece(w.top) : undefined
    // The figure follows the outfit: a dress, a casual look or a suit each have their own; an abaya or a kaftan
    // swaps to the covered or long-shirt figure inside humans.ts (see `figure`).
    const ownModel = female ? (topPiece?.model === 'casual' ? 'woman3' : 'woman4') : (topPiece?.model === 'suit' ? 'man4' : 'man1')
    const pick = variant === undefined ? 0 : (variant >> 1) % 4
    const model = own ? ownModel : female ? WOMEN[pick]! : MEN[pick]!
    const outfit = () => {
      const v = worn(), t = piece(v.top), id = String(v.top ?? '')
      // A suit is one cloth: the trousers match the jacket unless other trousers are worn.
      return { top: t?.hex, bottom: piece(v.bottom)?.hex ?? (!female && t?.model === 'suit' ? t.hex : undefined), shoes: piece(v.shoes)?.hex, sleeves: female && /^abaya/.test(id), robe: female && /^abaya/.test(id), kaftan: !female && /kaftan|agbada/.test(id), gown: female && /ankara/.test(id) }
    }
    const extras = (lux: boolean): Extras => { const a = worn().acc; return { chain: lux, watch: a.includes('watch-steel'), shades: a.includes('shades'), cap: a.includes('cap'), pearls: a.includes('pearls') } }
    if (own) avatar.object.userData.extras = extras(luxury)
    const mo = getMorph()
    const hair = mo.hair ?? (female ? 0x2a1a12 : 0xd9c08a)
    const sc = own ? mo : citizenScale(variant!)
    avatar.object.scale.set(sc.b, sc.h, sc.b)
    upgradeToHuman(avatar, model, {
      glasses: own && !female,
      makeup: undefined, // no makeup (Zahra: free modest creator, no makeup)
      extras: own ? extras(luxury) : undefined,
      look: own ? { ...(female ? { hair, ...(mo.skin ? { skin: mo.skin } : {}) } : { hair, skin: mo.skin ?? 0xe8c3a6 }), ...outfit(), top: outfit().top ?? tint } : crowdLook(variant!),
      height: female ? 1.68 : 1.78,
      detail: own ? 1 : 0.5,
    })
    if (own) {
      // Face shape: the figure applies it to its head once loaded (humans.ts), and again on every style change.
      avatar.object.userData.face = mo.f ?? 1
      // Boutique colours (blue, mint, sand, coral, ice) recolour the rigged model's top, not just the hidden procedural body.
      const setStyle = avatar.setStyle
      const base: { hair: number; skin?: number } = female ? { hair } : { hair, skin: 0xe8c3a6 }
      avatar.setStyle = (t, lux) => {
        setStyle(t, lux)
        const now = getMorph(); avatar.object.scale.set(now.b, now.h, now.b)
        avatar.object.userData.face = now.f ?? 1
        ;(avatar.object.userData.setFace as ((f: number) => void) | undefined)?.(now.f ?? 1)
        const o = outfit()
        const look = { ...base, hair: now.hair ?? base.hair, ...(now.skin ? { skin: now.skin } : {}), bottom: o.bottom, shoes: o.shoes, top: o.top ?? t, sleeves: o.sleeves, robe: o.robe, kaftan: o.kaftan, gown: o.gown }
        avatar.object.userData.extras = extras(lux)
        ;(avatar.object.userData.setExtras as ((e: Extras) => void) | undefined)?.(extras(lux))
        avatar.object.userData.look = look
        const apply = avatar.object.userData.applyLook as ((l: typeof look) => void) | undefined
        apply?.(look)
        // makeup disabled
      }
    }
    const setMask = avatar.setMask
    avatar.setMask = (mask) => {
      if (!NFT_COLLECTIONS_ENABLED) mask = 'none'
      setMask(mask)
      const root = avatar.object
      root.userData.masked = mask !== 'none'
      const person = root.userData.person as THREE.Object3D | undefined
      const procedural = root.userData.body as THREE.Object3D | undefined
      if (person && procedural) { person.visible = mask === 'none'; procedural.visible = mask !== 'none' }
    }
  }
  return avatar
}

function createProcedural(body: BodyId, tint: number, luxury: boolean): Avatar {
  switch (body) {
    case 'player': {
      const avatar = createPlayer()
      avatar.setStyle(tint, luxury)
      return avatar
    }
    case 'zuri': {
      const avatar = createZuri()
      avatar.setStyle(tint, luxury)
      return avatar
    }
    case 'shrimp': {
      const avatar = createShrimp()
      avatar.setStyle(tint, luxury)
      return avatar
    }
    case 'ledger': {
      const avatar = createLedger()
      avatar.setStyle(tint, luxury)
      return avatar
    }
    case 'marina': {
      const avatar = createMarina()
      avatar.setStyle(tint, luxury)
      return avatar
    }
    case 'signal': {
      const avatar = createSignal()
      avatar.setStyle(tint, luxury)
      return avatar
    }
    default: {
      const neverBody: never = body
      throw new Error(neverBody)
    }
  }
}
