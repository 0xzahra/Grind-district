import * as THREE from 'three'
import type { Hotspot } from './world.ts'
import type { Obstacle } from './physics.ts'

// Adapted room purposes/proportions from preserved interiors.ts; no old progression,
// wallet, seating, TV, event or career dependencies. Only existing street destinations.
export const ROOM_TYPES = { learn: 'campus', yours: 'home', gym: 'gym', boutique: 'boutique', prayer: 'prayer', trade: 'trading', bounty: 'studio', conference: 'conference' } as const
export type RoomKind = typeof ROOM_TYPES[keyof typeof ROOM_TYPES]
export type Room = { group: THREE.Group; obstacles: Obstacle[]; uses: Hotspot[]; decor: THREE.Object3D[]; origin: { x: number; z: number }; w: number; d: number }
const wood = new THREE.MeshStandardMaterial({ color: 0x795638, roughness: 0.9 })
const dark = new THREE.MeshStandardMaterial({ color: 0x293632, roughness: 0.8 })
const linen = new THREE.MeshStandardMaterial({ color: 0xdfd6c4, roughness: 1 })
const wall = new THREE.MeshStandardMaterial({ color: 0xe3dccd, roughness: 1 })
const green = new THREE.MeshStandardMaterial({ color: 0x426349, roughness: 1 })
const glass = new THREE.MeshStandardMaterial({ color: 0x48636c, emissive: 0x28454d, emissiveIntensity: 0.35, roughness: 0.5 })
const gold = new THREE.MeshStandardMaterial({ color: 0xc8a15b, roughness: 0.7 })
export function buildRoom(kind: RoomKind, street: Hotspot): Room {
  const w = kind === 'home' ? 20 : kind === 'conference' ? 18 : 16
  const d = kind === 'home' ? 15 : 12
  const origin = { x: 400, z: 0 }
  const group = new THREE.Group()
  group.name = `room-${kind}`
  group.position.set(origin.x, 0, origin.z)
  const obstacles: Obstacle[] = []
  const decor: THREE.Object3D[] = []
  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const item = new THREE.Mesh(geometry, material)
    item.position.set(x, y, z)
    item.receiveShadow = true
    parent.add(item)
    return item
  }
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, bw: number, bh: number, bd: number, material = wood) => mesh(parent, new THREE.BoxGeometry(bw, bh, bd), material, x, y, z)
  const obstacle = (x: number, z: number, hx: number, hz: number) => obstacles.push({ kind: 'box', x: origin.x + x, z: origin.z + z, hx, hz })
  const piece = (name: string, x: number, z: number, hx: number, hz: number) => {
    const parent = new THREE.Group(); parent.name = name; parent.position.set(x, 0, z); parent.userData.essential = true; group.add(parent)
    obstacle(x, z, hx, hz)
    return parent
  }
  const floor = mesh(group, new THREE.PlaneGeometry(w, d), wood, 0, 0, 0)
  floor.rotation.x = -Math.PI / 2
  floor.userData.tapGround = true
  for (const side of [-1, 1]) {
    box(group, side * (w / 2 + 0.12), 1.6, 0, 0.24, 3.2, d, wall)
    obstacle(side * (w / 2 + 0.12), 0, 0.12, d / 2 + 0.24)
    box(group, 0, 1.6, side * (d / 2 + 0.12), w + 0.48, 3.2, 0.24, wall)
    obstacle(0, side * (d / 2 + 0.12), w / 2 + 0.24, 0.12)
  }
  const chair = (x: number, z: number) => {
    const p = piece('chair', x, z, 0.36, 0.4)
    box(p, 0, 0.5, 0, 0.65, 0.12, 0.65, linen)
    box(p, 0, 0.93, -0.3, 0.65, 0.8, 0.1, wood)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(p, sx * 0.25, 0.24, sz * 0.25, 0.08, 0.48, 0.08, dark)
  }
  const desk = (x: number, z: number, monitor = true) => {
    const p = piece(monitor ? 'work-desk' : 'table', x, z, 1.25, 0.65)
    box(p, 0, 0.84, 0, 2.4, 0.12, 1.2)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(p, sx * 1.04, 0.4, sz * 0.45, 0.09, 0.8, 0.09, dark)
    if (monitor) { box(p, 0, 1.35, -0.3, 1.1, 0.7, 0.09, dark); box(p, 0, 1.35, -0.24, 0.95, 0.56, 0.02, glass); box(p, 0, 0.98, -0.3, 0.1, 0.25, 0.12, dark); box(p, 0, 0.93, 0.27, 0.7, 0.04, 0.24, dark) }
  }
  const shelf = (x: number, z: number) => {
    const p = piece('bookcase', x, z, 1.05, 0.32)
    for (const sx of [-1, 1]) box(p, sx, 1, 0, 0.1, 2, 0.55)
    for (const y of [0.12, 0.75, 1.4, 2]) box(p, 0, y, 0, 2, 0.1, 0.55)
    for (const x of [-0.7, -0.4, 0.2, 0.5]) box(p, x, 1.07, 0, 0.18, 0.52, 0.4, x < 0 ? green : linen)
  }
  const lectern = (x: number, z: number) => {
    const p = piece('lectern', x, z, 0.65, 0.45)
    box(p, 0, 0.06, 0, 1.2, 0.12, 0.8, dark); box(p, 0, 0.65, 0, 0.55, 1.2, 0.4)
    box(p, 0, 1.28, 0, 1.2, 0.12, 0.8).rotation.x = 0.12
  }
  let actionAt = { x: -3, z: -0.5 }
  if (kind === 'home') {
    const bed = piece('bed', -5.5, -3.5, 1.3, 1.8)
    box(bed, 0, 0.25, 0, 2.4, 0.35, 3.4, dark); box(bed, 0, 0.53, 0, 2.3, 0.28, 3.3, linen)
    box(bed, 0, 0.75, -1.65, 2.4, 1.3, 0.15); box(bed, 0, 0.7, -1.05, 1.8, 0.16, 0.55, wall); box(bed, 0, 0.7, 0.7, 2.31, 0.07, 1.5, green)
    desk(3, -3); chair(3, -1.6); shelf(6.8, -5.5)
    const sofa = piece('sofa', -5, 2, 1.5, 0.65)
    box(sofa, 0, 0.45, 0, 2.8, 0.45, 1.1, linen); box(sofa, 0, 0.9, -0.5, 2.8, 0.7, 0.2, green)
    for (const sx of [-1, 1]) box(sofa, sx * 1.35, 0.72, 0, 0.2, 0.55, 1.1, green)
    actionAt = { x: 1.5, z: -2 }
  } else if (kind === 'campus' || kind === 'conference') {
    lectern(-3, -3.5); shelf(5.5, -4.8)
    for (const x of [-4.5, -2, 2.5, 5]) for (const z of [0, 2]) chair(x, z)
    actionAt = { x: -3, z: -2 }
  } else if (kind === 'gym') {
    const p = piece('weight-bench', -4, -2, 1.5, 0.7)
    box(p, 0, 0.65, 0, 2.6, 0.2, 0.7, linen)
    for (const x of [-1, 1]) box(p, x, 0.3, 0, 0.15, 0.6, 0.7, dark)
    box(p, -1, 1.1, -0.5, 0.1, 1.7, 0.1, dark); box(p, 1, 1.1, -0.5, 0.1, 1.7, 0.1, dark)
    mesh(p, new THREE.CylinderGeometry(0.05, 0.05, 3, 6), dark, 0, 1.7, -0.5).rotation.z = Math.PI / 2
    for (const x of [-1.2, 1.2]) mesh(p, new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), dark, x, 1.7, -0.5).rotation.z = Math.PI / 2
    actionAt = { x: -4, z: 0 }
  } else if (kind === 'boutique') {
    const p = piece('clothing-rack', -4, -3, 1.6, 0.5)
    box(p, 0, 1.8, 0, 3, 0.08, 0.08, gold)
    for (const x of [-1.4, 1.4]) { box(p, x, 0.9, 0, 0.08, 1.8, 0.08, dark); box(p, x, 0.04, 0, 0.5, 0.08, 0.8, dark) }
    for (const x of [-0.8, 0, 0.8]) box(p, x, 1.2, 0, 0.55, 0.9, 0.12, x === 0 ? linen : green)
    const mirror = piece('mirror', 5, -4, 0.7, 0.25); box(mirror, 0, 1.1, 0, 1.3, 2.2, 0.12, gold); box(mirror, 0, 1.1, 0.07, 1.12, 2, 0.02, glass)
    actionAt = { x: -4, z: -1.5 }
  } else if (kind === 'prayer') {
    lectern(-4, -4)
    const rugs = new THREE.Group(); rugs.name = 'prayer-rugs'; rugs.userData.decorative = true
    for (const x of [-4, -1, 2, 5]) box(rugs, x, 0.015, -1, 1.4, 0.02, 2, green)
    group.add(rugs); decor.push(rugs); actionAt = { x: -4, z: -2.5 }
  } else {
    desk(-4, -3); chair(-4, -1.5); desk(4, -3); chair(4, -1.5); shelf(5.5, 1.5)
    actionAt = { x: -2, z: -2 }
  }
  // Optional decoration only: no colliders, uses, or gameplay targets in this group.
  const details = new THREE.Group(); details.name = 'wall-details'; details.userData.decorative = true
  box(details, 0, 1.8, -d / 2 + 0.03, 2.8, 1.25, 0.06, gold)
  box(details, 0, 1.8, -d / 2 + 0.07, 2.6, 1.05, 0.03, kind === 'campus' ? dark : glass)
  box(details, -w / 2 + 0.04, 0.12, 0, 0.06, 0.12, d, wood)
  mesh(details, new THREE.CylinderGeometry(0.25, 0.18, 0.45, 8), linen, w / 2 - 0.7, 0.23, d / 2 - 0.7)
  mesh(details, new THREE.IcosahedronGeometry(0.45, 0), green, w / 2 - 0.7, 0.9, d / 2 - 0.7)
  group.add(details);
  for (const detail of details.children) { detail.userData.decorative = true; decor.push(detail) }
  const exitAt = { x: origin.x, z: origin.z + d / 2 - 1.2 }
  const exitMarker = box(group, 0, 0.03, d / 2 - 1.2, 1.5, 0.04, 1, gold)
  exitMarker.userData.tapUse = 'room-exit'
  // The visible lectern/desk area opens the same existing UI; no new gameplay.
  const actionMarker = box(group, actionAt.x, 0.025, actionAt.z, 1.2, 0.04, 0.8, gold)
  actionMarker.userData.tapUse = 'room-action'
  const uses: Hotspot[] = [
    { id: 'room-exit', ...exitAt, r: 1, title: 'Exit to city', body: 'Return to the door you entered.', action: street.action, enter: 'Leave room' },
    { id: 'room-action', x: origin.x + actionAt.x, z: origin.z + actionAt.z, r: 1.3, title: street.title, body: street.body, action: street.action, house: street.house, enter: street.enter },
  ]
  return { group, obstacles, uses, decor, origin, w, d }
}
export class RoomSession {
  room: Room | null = null
  street: { x: number; z: number } | null = null
  enter(room: Room, street: { x: number; z: number }): { x: number; z: number } {
    this.room = room; this.street = { ...street }
    return { x: room.origin.x, z: room.origin.z + room.d / 2 - 2.8 }
  }
  cityPosition(current: { x: number; z: number }): { x: number; z: number } { return this.street ?? current }
  exit(): { x: number; z: number } | null { const street = this.street; this.room = null; this.street = null; return street }
}
