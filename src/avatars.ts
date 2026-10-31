import { getMorph, citizenScale } from './morph.ts'
import { NFT_COLLECTIONS_ENABLED } from './nft.ts'
import * as THREE from 'three'
import type { BodyId, MaskId } from './logic.ts'
import { mountMask } from './masks.ts'
import { contactShadow, locomotion } from './rig.ts'
import { createPlayer } from './player.ts'
import { createShrimp, type ShrimpAvatar } from './shrimp.ts'
import { createZuri } from './zuri.ts'
import { MEN, WOMEN, upgradeToHuman } from './humans.ts'

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

export function createAvatar(body: BodyId, tint: number, luxury: boolean, variant?: number): Avatar {
  const avatar = createProcedural(body, tint, luxury)
  // Real animated people replace the human bodies (player, Zuri, citizens). Masked players keep the procedural body.
  if (body === 'player' || body === 'zuri') {
    const female = body === 'zuri'
    const model = variant === undefined ? (female ? 'woman2' : 'man4') : female ? WOMEN[variant % WOMEN.length]! : MEN[variant % MEN.length]!
    const own = variant === undefined
    const mo = getMorph()
    const hair = mo.hair ?? (female ? 0x2a1a12 : 0xd9c08a)
    const sc = own ? mo : citizenScale(variant!)
    avatar.object.scale.set(sc.b, sc.h, sc.b)
    upgradeToHuman(avatar, model, {
      glasses: own && !female,
      look: own ? (female ? { hair, top: tint } : { hair, skin: 0xe8c3a6, top: tint }) : undefined,
      height: female ? 1.68 : 1.78,
    })
    if (own) {
      // Boutique colours (blue, mint, sand, coral, ice) recolour the rigged model's top, not just the hidden procedural body.
      const setStyle = avatar.setStyle
      const base = female ? { hair } : { hair, skin: 0xe8c3a6 }
      avatar.setStyle = (t, lux) => {
        setStyle(t, lux)
        const now = getMorph(); avatar.object.scale.set(now.b, now.h, now.b)
        const look = { ...base, hair: now.hair ?? base.hair, top: t }
        avatar.object.userData.look = look
        const apply = avatar.object.userData.applyLook as ((l: typeof look) => void) | undefined
        apply?.(look)
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
